import type { LicenseId, ProofReceipt } from "@my-digital/types";
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
import { issueBuyerLicense } from "./licenses";
import { generateProofReceipt, verifyProofReceipt } from "./receipts";
import { generateIssuerSigningKeys } from "./signing";
import type { EnvelopeLockResult, LockedAssetId } from "@my-digital/types";

async function receiptFixture() {
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
    lockedAssetId: "locked_receipt-test" as LockedAssetId,
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
  const license = await issueBuyerLicense({
    purchase,
    buyer,
    asset,
    assetVersion,
    lockedAsset,
    terms: listing.licenseTerms,
    issuer: "test-issuer",
    issuerPrivateKey: issuerKeys.privateKey
  });
  const receipt = await generateProofReceipt({
    purchase,
    license,
    creatorId: creator.id,
    issuerPrivateKey: issuerKeys.privateKey,
    verificationUrlBase: "https://mydigital.imagineqira.com/verify"
  });
  return { issuerKeys, creator, buyer, purchase, license, receipt };
}

describe("generateProofReceipt", () => {
  it("embeds a verification URL ending in the receipt id", async () => {
    const { receipt } = await receiptFixture();
    expect(receipt.verificationUrl).toBe(
      `https://mydigital.imagineqira.com/verify/${receipt.id}`
    );
  });

  it("refuses a license that belongs to a different purchase", async () => {
    const { license, purchase, creator, issuerKeys } = await receiptFixture();
    const foreignLicense = { ...license, purchaseId: "purchase_other" as typeof purchase.id };
    await expect(
      generateProofReceipt({
        purchase,
        license: foreignLicense,
        creatorId: creator.id,
        issuerPrivateKey: issuerKeys.privateKey
      })
    ).rejects.toThrow(/does not belong to purchase/);
  });
});

describe("verifyProofReceipt", () => {
  it("passes for a genuine receipt with matching bindings", async () => {
    const { receipt, issuerKeys, purchase, license } = await receiptFixture();
    const result = await verifyProofReceipt({
      receipt,
      issuerPublicKey: issuerKeys.publicKey,
      expected: { purchaseId: purchase.id, licenseId: license.id }
    });
    expect(result.status).toBe("pass");
    const codes = result.checksPassed.map((check) => check.code);
    expect(codes).toContain("RECEIPT_HASH_MATCH");
    expect(codes).toContain("RECEIPT_SIGNATURE_VALID");
  });

  it("fails when a receipt field was tampered with", async () => {
    const { receipt, issuerKeys } = await receiptFixture();
    const tampered: ProofReceipt = { ...receipt, licenseId: "license_forged" as LicenseId };
    const result = await verifyProofReceipt({ receipt: tampered, issuerPublicKey: issuerKeys.publicKey });
    expect(result.status).toBe("fail");
    const codes = result.checksFailed.map((check) => check.code);
    expect(codes).toContain("RECEIPT_HASH_MISMATCH");
    expect(codes).toContain("RECEIPT_SIGNATURE_INVALID");
  });

  it("fails when the receipt hash itself was rewritten", async () => {
    const { receipt, issuerKeys } = await receiptFixture();
    const tampered: ProofReceipt = { ...receipt, receiptHash: "ff".repeat(32) };
    const result = await verifyProofReceipt({ receipt: tampered, issuerPublicKey: issuerKeys.publicKey });
    expect(result.status).toBe("fail");
  });

  it("fails with a different issuer key", async () => {
    const { receipt } = await receiptFixture();
    const otherIssuer = await generateIssuerSigningKeys("other-issuer");
    const result = await verifyProofReceipt({ receipt, issuerPublicKey: otherIssuer.publicKey });
    expect(result.status).toBe("fail");
    expect(result.checksFailed.map((check) => check.code)).toContain("RECEIPT_SIGNATURE_INVALID");
  });
});
