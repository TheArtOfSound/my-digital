import {
  bytesEqual,
  importIssuerPublicKey,
  runLifecycleDemo,
  utf8Bytes,
  verifyBuyerLicense,
  verifyProofReceipt
} from "@my-digital/core";
import { DemoEnvelopeAdapter } from "@my-digital/envelope";
import { describe, expect, it } from "vitest";

describe("full lifecycle demo (end to end)", () => {
  it("runs CREATE through TRACE-precursor with all expected outcomes", async () => {
    const payload = utf8Bytes("e2e demo payload bytes");
    const result = await runLifecycleDemo(new DemoEnvelopeAdapter(), { payload });

    expect(result.demoOnly).toBe(true);
    expect(result.steps).toHaveLength(13);
    expect(result.steps.every((step) => step.ok)).toBe(true);

    expect(result.verifications.license.status).toBe("pass");
    expect(result.verifications.unlockCode.status).toBe("pass");
    expect(result.verifications.envelope.status).toBe("warning");
    expect(
      result.verifications.envelope.warnings.map((warning) => warning.code)
    ).toContain("DEMO_ONLY");
    expect(result.verifications.receipt.status).toBe("pass");

    expect(bytesEqual(result.unlockedPayload, payload)).toBe(true);

    expect(result.verifications.tamperedEnvelope.status).toBe("fail");
  });

  it("issues a buyer-specific license bound to the purchase and asset", async () => {
    const result = await runLifecycleDemo(new DemoEnvelopeAdapter());
    expect(result.license.buyerId).toBe(result.buyer.id);
    expect(result.license.purchaseId).toBe(result.purchase.id);
    expect(result.license.assetVersionId).toBe(result.assetVersion.id);
    expect(result.license.lockedAssetId).toBe(result.lockedAsset.id);
    expect(result.receipt.licenseId).toBe(result.license.id);
  });

  it("produces proofs that verify with only the exported issuer public key", async () => {
    const result = await runLifecycleDemo(new DemoEnvelopeAdapter());
    const importedKey = await importIssuerPublicKey(result.issuer.publicKeyB64);

    const licenseResult = await verifyBuyerLicense({
      license: result.license,
      issuerPublicKey: importedKey
    });
    expect(licenseResult.status).toBe("pass");

    const receiptResult = await verifyProofReceipt({
      receipt: result.receipt,
      issuerPublicKey: importedKey,
      expected: { purchaseId: result.purchase.id, licenseId: result.license.id }
    });
    expect(receiptResult.status).toBe("pass");
  });

  it("keeps the raw unlock code out of stored records", async () => {
    const result = await runLifecycleDemo(new DemoEnvelopeAdapter());
    const storedRecords = JSON.stringify({
      unlockCode: result.unlockCode,
      license: result.license,
      receipt: result.receipt,
      purchase: result.purchase
    });
    expect(storedRecords).not.toContain(result.rawUnlockCode);
  });
});
