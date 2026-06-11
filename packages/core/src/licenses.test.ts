import type { BuyerLicense, EnvelopeLockResult, LockedAssetId, Purchase } from "@my-digital/types";
import { describe, expect, it } from "vitest";
import { utf8Bytes } from "./encoding";
import {
  createAsset,
  createAssetVersion,
  createBuyer,
  createCreator,
  createListing,
  createLockedAssetRecord,
  demoPersonalLicenseTerms,
  simulatePaidPurchase
} from "./entities";
import { issueBuyerLicense, verifyBuyerLicense } from "./licenses";
import { generateIssuerSigningKeys } from "./signing";

function checkCodes(checks: Array<{ code: string }>): string[] {
  return checks.map((check) => check.code);
}

async function licenseFixture() {
  const issuerKeys = await generateIssuerSigningKeys("test-issuer");
  const creator = await createCreator({
    displayName: "Creator",
    handle: "creator",
    email: "creator@example.com"
  });
  const buyer = await createBuyer({ email: "buyer@example.com" });
  const asset = createAsset({
    creatorId: creator.id,
    title: "Asset",
    description: "Test asset",
    category: "test"
  });
  const { assetVersion } = await createAssetVersion({
    asset,
    versionLabel: "1.0.0",
    fileName: "asset.txt",
    mimeType: "text/plain",
    bytes: utf8Bytes("asset content")
  });
  const fakeLockResult: EnvelopeLockResult = {
    lockedAssetId: "locked_test-fixture" as LockedAssetId,
    envelopeFormat: "TEST-ENVELOPE",
    envelopeVersion: "0.0.0-test",
    lockedPayload: utf8Bytes("locked"),
    lockedPayloadHash: "00".repeat(32),
    metadataHash: "11".repeat(32),
    qevEngineVersion: "test-fixture",
    developmentOnly: true
  };
  const lockedAsset = createLockedAssetRecord({
    assetVersionId: assetVersion.id,
    lockResult: fakeLockResult
  });
  const listing = createListing({
    asset,
    activeAssetVersionId: assetVersion.id,
    priceAmount: 1000,
    priceCurrency: "USD",
    licenseTerms: demoPersonalLicenseTerms
  });
  const purchase = simulatePaidPurchase({ listing, buyer });
  return { issuerKeys, creator, buyer, asset, assetVersion, lockedAsset, listing, purchase };
}

async function issuedLicenseFixture() {
  const fixture = await licenseFixture();
  const license = await issueBuyerLicense({
    purchase: fixture.purchase,
    buyer: fixture.buyer,
    asset: fixture.asset,
    assetVersion: fixture.assetVersion,
    lockedAsset: fixture.lockedAsset,
    terms: fixture.listing.licenseTerms,
    issuer: "test-issuer",
    issuerPrivateKey: fixture.issuerKeys.privateKey
  });
  return { ...fixture, license };
}

describe("issueBuyerLicense", () => {
  it("refuses to issue a license for an unpaid purchase", async () => {
    const fixture = await licenseFixture();
    const unpaid: Purchase = { ...fixture.purchase, status: "pending" };
    await expect(
      issueBuyerLicense({
        purchase: unpaid,
        buyer: fixture.buyer,
        asset: fixture.asset,
        assetVersion: fixture.assetVersion,
        lockedAsset: fixture.lockedAsset,
        terms: fixture.listing.licenseTerms,
        issuer: "test-issuer",
        issuerPrivateKey: fixture.issuerKeys.privateKey
      })
    ).rejects.toThrow(/expected "paid"/);
  });

  it("derives allowed uses from license terms", async () => {
    const { license } = await issuedLicenseFixture();
    expect(license.allowedUses).toEqual(["personal-use"]);
  });
});

describe("verifyBuyerLicense", () => {
  it("passes for a genuine license with matching bindings", async () => {
    const { license, issuerKeys, asset, assetVersion, lockedAsset, buyer } =
      await issuedLicenseFixture();
    const result = await verifyBuyerLicense({
      license,
      issuerPublicKey: issuerKeys.publicKey,
      expected: {
        assetId: asset.id,
        assetVersionId: assetVersion.id,
        lockedAssetId: lockedAsset.id,
        buyerId: buyer.id
      }
    });
    expect(result.status).toBe("pass");
    expect(checkCodes(result.checksPassed)).toContain("LICENSE_SIGNATURE_VALID");
    expect(result.checksFailed).toHaveLength(0);
  });

  it("fails when license terms were tampered with after issuance", async () => {
    const { license, issuerKeys } = await issuedLicenseFixture();
    const tampered: BuyerLicense = {
      ...license,
      terms: { ...license.terms, commercialUse: true }
    };
    const result = await verifyBuyerLicense({ license: tampered, issuerPublicKey: issuerKeys.publicKey });
    expect(result.status).toBe("fail");
    expect(checkCodes(result.checksFailed)).toContain("LICENSE_SIGNATURE_INVALID");
  });

  it("fails when verified against a different issuer key", async () => {
    const { license } = await issuedLicenseFixture();
    const otherIssuer = await generateIssuerSigningKeys("other-issuer");
    const result = await verifyBuyerLicense({ license, issuerPublicKey: otherIssuer.publicKey });
    expect(result.status).toBe("fail");
    expect(checkCodes(result.checksFailed)).toContain("LICENSE_SIGNATURE_INVALID");
  });

  it("fails binding checks when the license is presented for a different asset version", async () => {
    const { license, issuerKeys, asset } = await issuedLicenseFixture();
    const other = await createAssetVersion({
      asset,
      versionLabel: "2.0.0",
      fileName: "asset-v2.txt",
      mimeType: "text/plain",
      bytes: utf8Bytes("different content")
    });
    const result = await verifyBuyerLicense({
      license,
      issuerPublicKey: issuerKeys.publicKey,
      expected: { assetVersionId: other.assetVersion.id }
    });
    expect(result.status).toBe("fail");
    expect(checkCodes(result.checksFailed)).toContain("LICENSE_ASSET_VERSION_BINDING_MISMATCH");
    expect(checkCodes(result.checksPassed)).toContain("LICENSE_SIGNATURE_VALID");
  });

  it("fails a revoked license while its issuance signature still verifies", async () => {
    const { license, issuerKeys } = await issuedLicenseFixture();
    const revoked: BuyerLicense = { ...license, revokedAt: "2026-06-10T12:00:00.000Z" };
    const result = await verifyBuyerLicense({ license: revoked, issuerPublicKey: issuerKeys.publicKey });
    expect(result.status).toBe("fail");
    expect(checkCodes(result.checksFailed)).toContain("LICENSE_REVOKED");
    expect(checkCodes(result.checksPassed)).toContain("LICENSE_SIGNATURE_VALID");
  });

  it("fails an expired license", async () => {
    const fixture = await licenseFixture();
    const license = await issueBuyerLicense({
      purchase: fixture.purchase,
      buyer: fixture.buyer,
      asset: fixture.asset,
      assetVersion: fixture.assetVersion,
      lockedAsset: fixture.lockedAsset,
      terms: fixture.listing.licenseTerms,
      issuer: "test-issuer",
      issuerPrivateKey: fixture.issuerKeys.privateKey,
      expiresAt: "2026-01-01T00:00:00.000Z"
    });
    const result = await verifyBuyerLicense({
      license,
      issuerPublicKey: fixture.issuerKeys.publicKey,
      now: "2026-06-10T00:00:00.000Z"
    });
    expect(result.status).toBe("fail");
    expect(checkCodes(result.checksFailed)).toContain("LICENSE_EXPIRED");
  });

  it("records skipped binding checks instead of silently ignoring them", async () => {
    const { license, issuerKeys } = await issuedLicenseFixture();
    const result = await verifyBuyerLicense({ license, issuerPublicKey: issuerKeys.publicKey });
    expect(result.status).toBe("pass");
    expect(result.checksSkipped.length).toBeGreaterThan(0);
  });
});
