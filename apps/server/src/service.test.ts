import { MockPaymentAdapter, demoPersonalLicenseTerms, sha256Hex, utf8Bytes } from "@my-digital/core";
import { QevVaultV2EnvelopeAdapter } from "@my-digital/envelope";
import { MemoryMarketplaceStore, openSqliteStore, type MarketplaceStore } from "@my-digital/store";
import type { LicenseId, ListingId } from "@my-digital/types";
import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { Keystore } from "./keystore";
import { MarketplaceService, type CheckoutOutcome } from "./service";

const PAYLOAD = utf8Bytes("Server-side locked product payload for service tests.");

async function makeService(store: MarketplaceStore = new MemoryMarketplaceStore()) {
  const keystore = await Keystore.ephemeral();
  const service = await MarketplaceService.create({
    store,
    keystore,
    envelope: new QevVaultV2EnvelopeAdapter({ preset: "quick" }),
    payments: new MockPaymentAdapter(),
    issuerName: "test-issuer",
    verificationUrlBase: "https://mydigital.imagineqira.com/verify"
  });
  return { service, store, keystore };
}

async function seedListing(service: MarketplaceService) {
  await service.ensureCreator({
    displayName: "Creator",
    handle: "creator",
    email: "creator@example.com"
  });
  return service.createLockedListing({
    title: "Prompt Pack",
    description: "Test pack",
    category: "ai-prompt-pack",
    priceAmount: 1900,
    priceCurrency: "USD",
    licenseTerms: demoPersonalLicenseTerms,
    fileName: "pack.txt",
    mimeType: "text/plain",
    payload: PAYLOAD
  });
}

async function dumpStore(store: MarketplaceStore): Promise<string> {
  const licenses = await store.listLicenses();
  const parts: unknown[] = [
    await store.listCreators(),
    await store.listBuyers(),
    await store.listAssets(),
    await store.listAssetVersions(),
    await store.listListings(),
    await store.listPurchases(),
    licenses,
    await store.listProofReceipts(),
    await store.listRevocations()
  ];
  for (const license of licenses) {
    parts.push(await store.getUnlockCodeByLicense(license.id));
    const vault = await store.getBuyerLockedPayload(license.id);
    if (vault) parts.push({ payloadHash: vault.payloadHash, payloadB64: Buffer.from(vault.payload).toString("base64") });
  }
  return JSON.stringify(parts);
}

describe("Keystore", () => {
  it("seals and opens secrets bound to an AAD", async () => {
    const keystore = await Keystore.ephemeral();
    const sealed = await keystore.sealString("custody-secret", "custody:locked_x");
    expect(await keystore.openSealedString(sealed, "custody:locked_x")).toBe("custody-secret");
    expect(sealed.sealedB64).not.toContain("custody-secret");
    await expect(keystore.openSealed(sealed, "custody:locked_y")).rejects.toThrow(
      /wrong master key, wrong binding, or tampered/
    );
  });

  it("rejects opening with a different master key", async () => {
    const a = await Keystore.ephemeral();
    const b = await Keystore.ephemeral();
    const sealed = await a.sealString("secret", "aad");
    await expect(b.openSealedString(sealed, "aad")).rejects.toThrow();
  });

  it("creates the master key file with restrictive permissions and reuses it", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mydigital-keystore-"));
    const keyFilePath = path.join(dir, "master-key.b64");
    const first = await Keystore.open({ keyFilePath });
    const sealed = await first.sealString("value", "aad");
    const mode = statSync(keyFilePath).mode & 0o777;
    expect(mode).toBe(0o600);
    const second = await Keystore.open({ keyFilePath });
    expect(await second.openSealedString(sealed, "aad")).toBe("value");
  });
});

describe("MarketplaceService listing", () => {
  it("locks with the QEV adapter and stores only a sealed custody secret", async () => {
    const { service, store } = await makeService();
    const { lockedAsset } = await seedListing(service);

    const basePayload = await store.getLockedPayload(lockedAsset.id);
    expect(basePayload).not.toBeNull();
    const vaultDoc = JSON.parse(new TextDecoder().decode(basePayload ?? new Uint8Array()));
    expect(vaultDoc.schema).toBe("BRY-NFET-SX-VAULT-V2");
    expect(vaultDoc.mode).toBe("self");

    const custody = await store.getCustodySecret(lockedAsset.id);
    expect(custody).not.toBeNull();
    expect(custody?.sealedB64.length).toBeGreaterThan(0);
  });
});

describe("MarketplaceService checkout", () => {
  it("paid checkout issues a verifiable license and a buyer vault that unlocks locally", async () => {
    const { service, store } = await makeService();
    const { listing } = await seedListing(service);
    const outcome = await service.checkout({
      listingId: listing.id,
      email: "buyer@example.com"
    });
    if (outcome.outcome !== "paid") throw new Error("expected paid outcome");

    expect((await service.verifyLicenseRecord(outcome.license.id)).status).toBe("pass");

    const vault = await service.getBuyerVault(outcome.license.id);
    expect(vault).not.toBeNull();
    expect(vault?.payloadHash).toBe(outcome.buyerVaultHash);

    // Simulates the buyer's machine: decrypt locally with the one-time code.
    const buyerAdapter = new QevVaultV2EnvelopeAdapter({ preset: "quick" });
    const unlocked = await buyerAdapter.unlock({
      lockedPayload: vault?.payload ?? new Uint8Array(),
      licenseMaterial: outcome.rawUnlockCode
    });
    expect(unlocked.verification.status).toBe("pass");
    expect(await sha256Hex(unlocked.plaintext)).toBe(await sha256Hex(PAYLOAD));

    const wrongCode = await buyerAdapter.unlock({
      lockedPayload: vault?.payload ?? new Uint8Array(),
      licenseMaterial: "UNLK-WRON-GCOD-EFOR-SURE"
    });
    expect(wrongCode.verification.status).toBe("fail");
    expect(wrongCode.plaintext.byteLength).toBe(0);

    // The raw unlock code must not exist anywhere in stored records.
    expect(await dumpStore(store)).not.toContain(outcome.rawUnlockCode);
  });

  it("declined checkout stores a failed purchase and issues nothing else", async () => {
    const { service, store } = await makeService();
    const { listing } = await seedListing(service);
    const outcome = await service.checkout({
      listingId: listing.id,
      email: "buyer@example.com",
      simulateOutcome: "failed"
    });
    expect(outcome.outcome).toBe("failed");
    expect(outcome.purchase.status).toBe("failed");
    expect(await store.listLicenses()).toHaveLength(0);
    expect(await store.listProofReceipts()).toHaveLength(0);
  });

  it("revocation makes license verification fail while the receipt stays intact", async () => {
    const { service } = await makeService();
    const { listing } = await seedListing(service);
    const outcome = (await service.checkout({
      listingId: listing.id,
      email: "buyer@example.com"
    })) as Extract<CheckoutOutcome, { outcome: "paid" }>;

    await service.revokeLicense(outcome.license.id, "test revocation");
    const verification = await service.verifyLicenseRecord(outcome.license.id);
    expect(verification.status).toBe("fail");
    expect(verification.checksFailed.map((check) => check.code)).toContain("LICENSE_REVOKED");
    expect(verification.checksPassed.map((check) => check.code)).toContain(
      "LICENSE_SIGNATURE_VALID"
    );
    const bundle = await service.getReceiptBundle(outcome.receipt.id);
    expect(bundle?.receipt.id).toBe(outcome.receipt.id);
  });

  it("reset wipes records and bootstraps a fresh issuer", async () => {
    const { service, store } = await makeService();
    const { listing } = await seedListing(service);
    await service.checkout({ listingId: listing.id, email: "buyer@example.com" });
    const issuerBefore = service.issuerInfo().publicKeyB64;
    await service.reset();
    expect(await store.listListings()).toHaveLength(0);
    expect(await store.listLicenses()).toHaveLength(0);
    expect(service.issuerInfo().publicKeyB64).not.toBe(issuerBefore);
  });
});

describe("MarketplaceService trace", () => {
  it("attributes a leaked buyer vault to its license by exact hash match", async () => {
    const { service } = await makeService();
    const { listing } = await seedListing(service);
    const outcome = (await service.checkout({
      listingId: listing.id,
      email: "buyer@example.com"
    })) as Extract<CheckoutOutcome, { outcome: "paid" }>;
    const vault = await service.getBuyerVault(outcome.license.id);

    const result = await service.trace(vault?.payload ?? new Uint8Array());
    expect(result.evidenceLevel).toBe("exact-vault-match");
    expect(result.match?.licenseId).toBe(outcome.license.id);
    expect(result.match?.fingerprintId).toBeDefined();
    expect(result.match?.licenseRevoked).toBe(false);
    expect(result.caveats.join(" ")).toContain("not who circulated it");
  });

  it("reports plaintext matches honestly as unattributable", async () => {
    const { service } = await makeService();
    await seedListing(service);
    const result = await service.trace(PAYLOAD);
    expect(result.evidenceLevel).toBe("plaintext-content-match");
    expect(result.match?.assetVersionId).toBeDefined();
    expect(result.match?.licenseId).toBeUndefined();
    expect(result.explanation).toContain("plaintext copy");
    expect(result.caveats.join(" ")).toContain("attribution to a specific buyer is not possible");
  });

  it("recognizes foreign vaults without claiming attribution", async () => {
    const { service } = await makeService();
    const foreignAdapter = new QevVaultV2EnvelopeAdapter({ preset: "quick" });
    const foreignLock = await foreignAdapter.lock({
      assetVersionId: "assetver_foreign" as never,
      fileName: "foreign.txt",
      mimeType: "text/plain",
      plaintext: utf8Bytes("foreign vault content")
    });
    const result = await service.trace(foreignLock.lockedPayload);
    expect(result.evidenceLevel).toBe("vault-format-unattributed");
    expect(result.match).toBeUndefined();
  });

  it("reports unsupported artifacts as no-evidence instead of fake confidence", async () => {
    const { service } = await makeService();
    const result = await service.trace(utf8Bytes("just some random text file"));
    expect(result.evidenceLevel).toBe("no-evidence");
    expect(result.explanation).toContain("Unsupported artifact type");
    expect(result.match).toBeUndefined();
  });
});

describe("MarketplaceService buyer library", () => {
  it("returns a buyer's purchases, licenses, and receipts by email hash", async () => {
    const { service } = await makeService();
    const { listing } = await seedListing(service);
    await service.checkout({ listingId: listing.id, email: "library@example.com" });
    await service.checkout({ listingId: listing.id, email: "other@example.com" });

    const { hashEmail } = await import("@my-digital/core");
    const library = await service.getBuyerLibrary(await hashEmail("library@example.com"));
    expect(library).not.toBeNull();
    expect(library?.purchases).toHaveLength(1);
    expect(library?.licenses).toHaveLength(1);
    expect(library?.receipts).toHaveLength(1);
    expect(await service.getBuyerLibrary("00".repeat(32))).toBeNull();
  });
});

describe("issuer persistence across restarts", () => {
  it("a second service instance on the same database keeps the issuer and old licenses verify", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mydigital-server-"));
    const dbPath = path.join(dir, "restart-test.sqlite");
    const keyFilePath = path.join(dir, "master-key.b64");

    const storeA = openSqliteStore({ path: dbPath });
    const keystoreA = await Keystore.open({ keyFilePath });
    const serviceA = await MarketplaceService.create({
      store: storeA,
      keystore: keystoreA,
      envelope: new QevVaultV2EnvelopeAdapter({ preset: "quick" }),
      payments: new MockPaymentAdapter(),
      issuerName: "restart-issuer",
      verificationUrlBase: "https://mydigital.imagineqira.com/verify"
    });
    await serviceA.ensureCreator({
      displayName: "Creator",
      handle: "creator",
      email: "creator@example.com"
    });
    const { listing } = await serviceA.createLockedListing({
      title: "Pack",
      description: "Restart test",
      category: "test",
      priceAmount: 1000,
      priceCurrency: "USD",
      licenseTerms: demoPersonalLicenseTerms,
      fileName: "pack.txt",
      mimeType: "text/plain",
      payload: PAYLOAD
    });
    const outcome = (await serviceA.checkout({
      listingId: listing.id as ListingId,
      email: "buyer@example.com"
    })) as Extract<CheckoutOutcome, { outcome: "paid" }>;
    const issuerKey = serviceA.issuerInfo().publicKeyB64;
    await storeA.close();

    const storeB = openSqliteStore({ path: dbPath });
    const keystoreB = await Keystore.open({ keyFilePath });
    const serviceB = await MarketplaceService.create({
      store: storeB,
      keystore: keystoreB,
      envelope: new QevVaultV2EnvelopeAdapter({ preset: "quick" }),
      payments: new MockPaymentAdapter(),
      issuerName: "restart-issuer",
      verificationUrlBase: "https://mydigital.imagineqira.com/verify"
    });
    expect(serviceB.issuerInfo().publicKeyB64).toBe(issuerKey);
    expect((await serviceB.verifyLicenseRecord(outcome.license.id)).status).toBe("pass");

    // A new checkout in the second process also works (custody secret opens).
    const second = await serviceB.checkout({
      listingId: listing.id as ListingId,
      email: "second-buyer@example.com"
    });
    expect(second.outcome).toBe("paid");
    await storeB.close();
  });
});

describe("HTTP app", () => {
  it("serves health, state, checkout, and vault download", async () => {
    const { service } = await makeService();
    const { listing } = await seedListing(service);
    const app = createApp(service);

    const health = await app.request("/api/health");
    expect(health.status).toBe(200);
    expect(((await health.json()) as { envelope: string }).envelope).toBe(
      "BRY-NFET-SX-VAULT-V2"
    );

    const checkout = await app.request("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: listing.id, email: "http-buyer@example.com" })
    });
    expect(checkout.status).toBe(201);
    const outcome = (await checkout.json()) as { outcome: string; license: { id: string } };
    expect(outcome.outcome).toBe("paid");

    const vault = await app.request(`/api/licenses/${outcome.license.id}/vault`);
    expect(vault.status).toBe(200);
    const vaultDoc = JSON.parse(await vault.text());
    expect(vaultDoc.schema).toBe("BRY-NFET-SX-VAULT-V2");
    expect(vaultDoc.mode).toBe("share");

    const missing = await app.request(`/api/licenses/license_missing/vault`);
    expect(missing.status).toBe(404);

    const state = await app.request("/api/state");
    const stateJson = (await state.json()) as { licenses: unknown[]; listings: unknown[] };
    expect(stateJson.listings).toHaveLength(1);
    expect(stateJson.licenses).toHaveLength(1);
  });

  it("maps service errors to JSON errors", async () => {
    const { service } = await makeService();
    const app = createApp(service);
    const bad = await app.request("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: "listing_missing", email: "x@example.com" })
    });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: string }).error).toContain("Listing not found");
  });
});
