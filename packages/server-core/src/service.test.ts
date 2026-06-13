import { MockPaymentAdapter, demoPersonalLicenseTerms, sha256Hex, utf8Bytes } from "@my-digital/core";
import { QevVaultV2EnvelopeAdapter } from "@my-digital/envelope";
import {
  StripePaymentAdapter,
  type StripeLikeClient,
  type StripeLikeEvent
} from "@my-digital/payments-stripe";
import { MemoryMarketplaceStore, type MarketplaceStore } from "@my-digital/store";
import { openSqliteStore } from "@my-digital/store/node";
import type { LicenseId, ListingId } from "@my-digital/types";
import { mkdtempSync, statSync, writeFileSync } from "node:fs";
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

describe("MarketplaceService creator profile", () => {
  it("updates profile fields and normalizes/validates them", async () => {
    const { service } = await makeService();
    await service.ensureCreator({ displayName: "C", handle: "c", email: "c@example.com" });

    const updated = await service.updateCreatorProfile({
      displayName: "Renamed Maker",
      handle: "Renamed-Maker",
      bio: "I make verified prompt packs.",
      avatarUrl: "https://cdn.example.com/a.png",
      websiteUrl: "https://maker.example.com"
    });
    expect(updated.displayName).toBe("Renamed Maker");
    expect(updated.handle).toBe("renamed-maker");
    expect(updated.bio).toBe("I make verified prompt packs.");
    expect(updated.avatarUrl).toBe("https://cdn.example.com/a.png");

    const state = await service.getState();
    expect(state.creator?.handle).toBe("renamed-maker");

    // Clearing optional fields with empty strings removes them.
    const cleared = await service.updateCreatorProfile({ bio: "", websiteUrl: "" });
    expect(cleared.bio).toBeUndefined();
    expect(cleared.websiteUrl).toBeUndefined();

    await expect(service.updateCreatorProfile({ handle: "no spaces!" })).rejects.toThrow(/Handle/);
    await expect(service.updateCreatorProfile({ avatarUrl: "ftp://nope" })).rejects.toThrow(
      /Avatar/
    );
    await expect(
      service.updateCreatorProfile({ avatarUrl: `data:image/png;base64,${"A".repeat(400_000)}` })
    ).rejects.toThrow(/too large/);
  });

  it("refuses a profile update before any creator exists", async () => {
    const { service } = await makeService();
    await expect(service.updateCreatorProfile({ displayName: "X" })).rejects.toThrow(
      /Create the creator/
    );
  });
});

describe("MarketplaceService listing management", () => {
  it("edits a listing's title, price, and status with validation", async () => {
    const { service } = await makeService();
    const { listing } = await seedListing(service);
    const updated = await service.updateListing({
      listingId: listing.id,
      title: "Updated Pack",
      priceAmount: 2500,
      status: "paused"
    });
    expect(updated.title).toBe("Updated Pack");
    expect(updated.priceAmount).toBe(2500);
    expect(updated.status).toBe("paused");
    expect(updated.updatedAt >= listing.updatedAt).toBe(true);

    await expect(
      service.updateListing({ listingId: listing.id, status: "nonsense" as never })
    ).rejects.toThrow(/Status/);
    await expect(
      service.updateListing({ listingId: listing.id, priceAmount: -1 })
    ).rejects.toThrow(/Price/);
  });

  it("deletes an unsold listing and tears down its asset chain", async () => {
    const { service, store } = await makeService();
    const { listing, lockedAsset } = await seedListing(service);
    const result = await service.deleteListing(listing.id);
    expect(result.deleted).toBe(true);
    expect(await store.getListing(listing.id)).toBeNull();
    expect(await store.getLockedPayload(lockedAsset.id)).toBeNull();
    expect(await store.getCustodySecret(lockedAsset.id)).toBeNull();
    expect(await store.listAssets()).toHaveLength(0);
    expect(await store.listAssetVersions()).toHaveLength(0);
  });

  it("refuses to delete a listing with a purchase, keeping buyer proof intact", async () => {
    const { service, store } = await makeService();
    const { listing } = await seedListing(service);
    await service.checkout({ listingId: listing.id, email: "buyer@example.com" });
    await expect(service.deleteListing(listing.id)).rejects.toThrow(/archive/i);
    expect(await store.getListing(listing.id)).not.toBeNull();
    expect(await store.listLicenses()).toHaveLength(1);
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

describe("begin/complete checkout (redirect-style flow)", () => {
  it("begin persists a pending purchase and session; complete confirms and fulfills", async () => {
    const { service, store } = await makeService();
    const { listing } = await seedListing(service);
    const begun = await service.beginCheckout({
      listingId: listing.id,
      email: "redirect-buyer@example.com"
    });
    expect(begun.purchase.status).toBe("pending");
    expect((await store.getCheckoutSessionByPurchase(begun.purchase.id))?.status).toBe("open");
    expect(await store.listLicenses()).toHaveLength(0);

    const outcome = await service.completeCheckout({ purchaseId: begun.purchase.id });
    if (outcome.outcome !== "paid") throw new Error("expected paid");
    expect(outcome.rawUnlockCode).toMatch(/^UNLK-/);
    expect((await store.getPurchase(begun.purchase.id))?.status).toBe("paid");
    expect((await store.getCheckoutSessionByPurchase(begun.purchase.id))?.status).toBe("paid");

    await expect(service.completeCheckout({ purchaseId: begun.purchase.id })).rejects.toThrow(
      /already fulfilled/
    );
  });

  it("completes by provider reference and supports the declined path", async () => {
    const { service } = await makeService();
    const { listing } = await seedListing(service);
    const begun = await service.beginCheckout({
      listingId: listing.id,
      email: "declined@example.com"
    });
    const outcome = await service.completeCheckout({
      providerReference: begun.session.providerReference,
      simulateOutcome: "failed"
    });
    expect(outcome.outcome).toBe("failed");
    expect(outcome.purchase.status).toBe("failed");
  });

  it("survives a service restart between begin and complete", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mydigital-resume-"));
    const dbPath = path.join(dir, "resume.sqlite");
    const keyFilePath = path.join(dir, "master-key.b64");
    const makeOn = async () => {
      const store = openSqliteStore({ path: dbPath });
      const keystore = await Keystore.open({ keyFilePath });
      const service = await MarketplaceService.create({
        store,
        keystore,
        envelope: new QevVaultV2EnvelopeAdapter({ preset: "quick" }),
        payments: new MockPaymentAdapter(),
        issuerName: "resume-issuer",
        verificationUrlBase: "https://mydigital.imagineqira.com/verify"
      });
      return { store, service };
    };

    const first = await makeOn();
    const { listing } = await seedListing(first.service);
    const begun = await first.service.beginCheckout({
      listingId: listing.id as ListingId,
      email: "resume@example.com"
    });
    await first.store.close();

    // Fresh process: adapter session map is empty; the persisted session row
    // is rehydrated via restoreSession before confirmation.
    const second = await makeOn();
    const outcome = await second.service.completeCheckout({ purchaseId: begun.purchase.id });
    expect(outcome.outcome).toBe("paid");
    await second.store.close();
  });
});

describe("Stripe-adapter service flow (fake client)", () => {
  async function makeStripeService() {
    const stripeSession = {
      id: "cs_live_flow",
      url: "https://checkout.stripe.com/c/pay/cs_live_flow",
      status: "open",
      payment_status: "unpaid",
      amount_total: 1900,
      currency: "usd",
      metadata: {} as Record<string, string>
    };
    const client: StripeLikeClient = {
      checkout: {
        sessions: {
          async create(params) {
            stripeSession.metadata = (params as { metadata: Record<string, string> }).metadata;
            return stripeSession;
          },
          async retrieve() {
            return stripeSession;
          }
        }
      },
      webhooks: {
        async constructEventAsync(payload, header) {
          if (header !== "valid-signature") throw new Error("signature verification failed");
          return JSON.parse(payload) as StripeLikeEvent;
        }
      }
    };
    const adapter = new StripePaymentAdapter({
      client,
      successUrl: "https://example.com/done",
      cancelUrl: "https://example.com/",
      webhookSecret: "whsec_test"
    });
    const store = new MemoryMarketplaceStore();
    const keystore = await Keystore.ephemeral();
    const service = await MarketplaceService.create({
      store,
      keystore,
      envelope: new QevVaultV2EnvelopeAdapter({ preset: "quick" }),
      payments: adapter,
      issuerName: "stripe-test-issuer",
      verificationUrlBase: "https://mydigital.imagineqira.com/verify"
    });
    return { service, store, stripeSession };
  }

  it("webhook marks the purchase paid; complete fulfills without re-polling", async () => {
    const { service, store, stripeSession } = await makeStripeService();
    const { listing } = await seedListing(service);
    const begun = await service.beginCheckout({
      listingId: listing.id,
      email: "stripe-buyer@example.com"
    });
    expect(begun.session.checkoutUrl).toContain("checkout.stripe.com");
    expect(begun.purchase.status).toBe("pending");

    const event = {
      id: "evt_flow_1",
      type: "checkout.session.completed",
      data: {
        object: { ...stripeSession, status: "complete", payment_status: "paid" }
      }
    };
    const webhook = await service.handlePaymentWebhook(JSON.stringify(event), "valid-signature");
    expect(webhook.handled).toBe(true);
    expect(webhook.outcome).toBe("paid");
    expect((await store.getPurchase(begun.purchase.id))?.status).toBe("paid");
    expect(await store.listLicenses()).toHaveLength(0);

    const outcome = await service.completeCheckout({ purchaseId: begun.purchase.id });
    if (outcome.outcome !== "paid") throw new Error("expected paid");
    expect(outcome.rawUnlockCode).toMatch(/^UNLK-/);
    expect(await service.getBuyerVault(outcome.license.id)).not.toBeNull();
  });

  it("rejects webhooks with bad signatures", async () => {
    const { service } = await makeStripeService();
    await expect(service.handlePaymentWebhook("{}", "bad-signature")).rejects.toThrow(
      /signature/
    );
  });

  it("mock adapter refuses webhook handling with a clear error", async () => {
    const { service } = await makeService();
    await expect(service.handlePaymentWebhook("{}", "sig")).rejects.toThrow(
      /does not support webhooks/
    );
  });
});

describe("Direct payouts (Stripe Connect)", () => {
  async function makeConnectService(accountStatus?: {
    charges_enabled: boolean;
    payouts_enabled: boolean;
    details_submitted: boolean;
  }) {
    const stripeSession = {
      id: "cs_connect_flow",
      url: "https://checkout.stripe.com/c/pay/cs_connect_flow",
      status: "open",
      payment_status: "unpaid",
      amount_total: 1900,
      currency: "usd",
      metadata: {} as Record<string, string>
    };
    const captured: {
      createOptions?: { stripeAccount?: string } | undefined;
      lastParams?: Record<string, unknown>;
      accountsCreated: number;
    } = { accountsCreated: 0 };
    const status = accountStatus ?? {
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true
    };
    const client: StripeLikeClient = {
      checkout: {
        sessions: {
          async create(params, options) {
            stripeSession.metadata = (params as { metadata: Record<string, string> }).metadata;
            captured.createOptions = options;
            captured.lastParams = params;
            return stripeSession;
          },
          async retrieve() {
            return stripeSession;
          }
        }
      },
      webhooks: {
        async constructEventAsync(payload, header) {
          if (header !== "valid-signature") throw new Error("signature verification failed");
          return JSON.parse(payload) as StripeLikeEvent;
        }
      },
      accounts: {
        async create() {
          captured.accountsCreated += 1;
          return { id: "acct_connected_1" };
        },
        async retrieve(id) {
          return { id, ...status };
        }
      },
      accountLinks: {
        async create() {
          return { url: "https://connect.stripe.com/setup/s/acct_connected_1" };
        }
      }
    };
    const adapter = new StripePaymentAdapter({
      client,
      successUrl: "https://example.com/done",
      cancelUrl: "https://example.com/",
      webhookSecret: "whsec_test"
    });
    const store = new MemoryMarketplaceStore();
    const keystore = await Keystore.ephemeral();
    const service = await MarketplaceService.create({
      store,
      keystore,
      envelope: new QevVaultV2EnvelopeAdapter({ preset: "quick" }),
      payments: adapter,
      issuerName: "connect-test-issuer",
      verificationUrlBase: "https://mydigital.imagineqira.com/verify",
      connect: { enabled: true, applicationFeeBps: 500 }
    });
    return { service, store, captured };
  }

  it("onboarding creates a connected account; refresh records payout status", async () => {
    const { service, store, captured } = await makeConnectService();
    await seedListing(service);
    const onboard = await service.startCreatorPayoutOnboarding();
    expect(onboard.url).toContain("connect.stripe.com");
    expect(onboard.accountId).toBe("acct_connected_1");
    expect(captured.accountsCreated).toBe(1);
    expect((await store.listCreators())[0]?.stripeAccountId).toBe("acct_connected_1");

    // A second onboarding reuses the account rather than creating another.
    await service.startCreatorPayoutOnboarding();
    expect(captured.accountsCreated).toBe(1);

    const status = await service.refreshCreatorPayoutStatus();
    expect(status.payoutsEnabled).toBe(true);
    expect((await store.listCreators())[0]?.payoutsEnabled).toBe(true);
  });

  it("routes checkout to the creator's connected account with the platform fee", async () => {
    const { service, captured } = await makeConnectService();
    const { listing } = await seedListing(service);
    await service.startCreatorPayoutOnboarding();
    await service.refreshCreatorPayoutStatus();

    const begun = await service.beginCheckout({
      listingId: listing.id,
      email: "buyer@example.com"
    });
    expect(begun.session.connectedAccountId).toBe("acct_connected_1");
    expect(captured.createOptions?.stripeAccount).toBe("acct_connected_1");
    const fee = (captured.lastParams as { payment_intent_data?: { application_fee_amount?: number } })
      .payment_intent_data?.application_fee_amount;
    expect(fee).toBe(95); // 5% of 1900
  });

  it("refuses checkout until the creator has finished payout onboarding", async () => {
    const { service } = await makeConnectService();
    const { listing } = await seedListing(service);
    await expect(
      service.beginCheckout({ listingId: listing.id, email: "buyer@example.com" })
    ).rejects.toThrow(/direct payouts/);
  });

  it("does not record payouts as enabled when Stripe says details are incomplete", async () => {
    const { service, store } = await makeConnectService({
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false
    });
    await seedListing(service);
    await service.startCreatorPayoutOnboarding();
    const status = await service.refreshCreatorPayoutStatus();
    expect(status.payoutsEnabled).toBe(false);
    expect((await store.listCreators())[0]?.payoutsEnabled).toBe(false);
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

  it("supports creator profile update and listing edit/delete over HTTP", async () => {
    const { service } = await makeService();
    const { listing } = await seedListing(service);
    const app = createApp(service);

    const patchCreator = await app.request("/api/creator", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "HTTP Maker", bio: "HTTP bio" })
    });
    expect(patchCreator.status).toBe(200);
    expect(((await patchCreator.json()) as { bio: string }).bio).toBe("HTTP bio");

    const patchListing = await app.request(`/api/listings/${listing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paused" })
    });
    expect(patchListing.status).toBe(200);
    expect(((await patchListing.json()) as { status: string }).status).toBe("paused");

    const del = await app.request(`/api/listings/${listing.id}`, { method: "DELETE" });
    expect(del.status).toBe(200);
    expect(((await del.json()) as { deleted: boolean }).deleted).toBe(true);
    expect((await service.getState()).listings).toHaveLength(0);
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

  it("gates the admin reset behind a bearer token when configured", async () => {
    const { service } = await makeService();
    const app = createApp(service, { adminToken: "secret-token" });
    const denied = await app.request("/api/admin/reset", { method: "POST" });
    expect(denied.status).toBe(401);
    const allowed = await app.request("/api/admin/reset", {
      method: "POST",
      headers: { Authorization: "Bearer secret-token" }
    });
    expect(allowed.status).toBe(200);
  });

  it("gates creator/listing mutations behind the admin token but leaves buyer flows open", async () => {
    const { service } = await makeService();
    const { listing } = await seedListing(service);
    const app = createApp(service, { adminToken: "secret-token" });

    const noTokenPatch = await app.request("/api/creator", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio: "blocked" })
    });
    expect(noTokenPatch.status).toBe(401);

    const noTokenDelete = await app.request(`/api/listings/${listing.id}`, { method: "DELETE" });
    expect(noTokenDelete.status).toBe(401);

    const noTokenOnboard = await app.request("/api/creator/payouts/onboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnUrl: "https://x/r", refreshUrl: "https://x/f" })
    });
    expect(noTokenOnboard.status).toBe(401);

    // Buyers can still check out without the management token.
    const openCheckout = await app.request("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: listing.id, email: "open@example.com" })
    });
    expect(openCheckout.status).toBe(201);

    const okPatch = await app.request("/api/creator", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: "Bearer secret-token" },
      body: JSON.stringify({ bio: "gated bio" })
    });
    expect(okPatch.status).toBe(200);
    expect(((await okPatch.json()) as { bio: string }).bio).toBe("gated bio");
  });

  it("reports connect mode in health (off by default)", async () => {
    const { service } = await makeService();
    const app = createApp(service);
    const health = await app.request("/api/health");
    expect(((await health.json()) as { connect: boolean }).connect).toBe(false);
  });

  it("serves the static web build with SPA fallback when configured", async () => {
    const { service } = await makeService();
    const staticRoot = mkdtempSync(path.join(tmpdir(), "mydigital-static-"));
    writeFileSync(path.join(staticRoot, "index.html"), "<!doctype html><title>md</title>");
    writeFileSync(path.join(staticRoot, "app.js"), "console.log(1)");
    const app = createApp(service, { staticRoot });

    const index = await app.request("/");
    expect(index.status).toBe(200);
    expect(index.headers.get("content-type")).toContain("text/html");

    const asset = await app.request("/app.js");
    expect(asset.headers.get("content-type")).toContain("text/javascript");

    // Client-side routes fall back to index.html (receipt deep links).
    const deepLink = await app.request("/verify/receipt_x");
    expect(await deepLink.text()).toContain("<title>md</title>");

    // Path traversal stays inside the root.
    const traversal = await app.request("/../service.ts");
    expect(await traversal.text()).toContain("<title>md</title>");

    const api = await app.request("/api/health");
    expect(((await api.json()) as { ok: boolean }).ok).toBe(true);
  });
});
