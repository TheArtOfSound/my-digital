import { bytesEqual, sha256Hex, utf8Bytes } from "@my-digital/core";
import type { AssetVersionId } from "@my-digital/types";
import { describe, expect, it } from "vitest";
import { DemoEnvelopeAdapter } from "./index";

const adapter = new DemoEnvelopeAdapter();

const lockInput = {
  assetVersionId: "assetver_test" as AssetVersionId,
  fileName: "demo.txt",
  mimeType: "text/plain",
  plaintext: utf8Bytes("demo plaintext content")
};

describe("DemoEnvelopeAdapter.lock", () => {
  it("marks every lock result as development-only", async () => {
    const result = await adapter.lock(lockInput);
    expect(result.developmentOnly).toBe(true);
    expect(result.envelopeFormat).toBe("MYDIGITAL-DEMO-ENVELOPE");
    expect(new TextDecoder().decode(result.lockedPayload)).toContain("DEMO ONLY");
  });
});

describe("DemoEnvelopeAdapter.unlock", () => {
  it("round-trips the plaintext when license material is supplied", async () => {
    const locked = await adapter.lock(lockInput);
    const result = await adapter.unlock({
      lockedPayload: locked.lockedPayload,
      licenseMaterial: "UNLK-TEST-TEST-TEST-TEST"
    });
    expect(bytesEqual(result.plaintext, lockInput.plaintext)).toBe(true);
    expect(result.verification.status).toBe("warning");
    expect(result.verification.warnings.map((warning) => warning.code)).toContain("DEMO_ONLY");
  });

  it("returns no plaintext and fails without license material", async () => {
    const locked = await adapter.lock(lockInput);
    const result = await adapter.unlock({
      lockedPayload: locked.lockedPayload,
      licenseMaterial: ""
    });
    expect(result.plaintext.byteLength).toBe(0);
    expect(result.verification.status).toBe("fail");
    expect(result.verification.checksFailed.map((check) => check.code)).toContain(
      "MISSING_LICENSE_MATERIAL"
    );
  });

  it("fails structurally on a corrupted envelope instead of throwing", async () => {
    const result = await adapter.unlock({
      lockedPayload: utf8Bytes("this is not a demo envelope"),
      licenseMaterial: "UNLK-TEST-TEST-TEST-TEST"
    });
    expect(result.plaintext.byteLength).toBe(0);
    expect(result.verification.status).toBe("fail");
    expect(result.verification.checksFailed.map((check) => check.code)).toContain(
      "ENVELOPE_PARSE_FAILED"
    );
  });

  it("fails structurally when the payload field is missing", async () => {
    const result = await adapter.unlock({
      lockedPayload: utf8Bytes(JSON.stringify({ warning: "no payload here" })),
      licenseMaterial: "UNLK-TEST-TEST-TEST-TEST"
    });
    expect(result.verification.status).toBe("fail");
    expect(result.verification.checksFailed.map((check) => check.code)).toContain(
      "ENVELOPE_PAYLOAD_MISSING"
    );
  });
});

describe("DemoEnvelopeAdapter.verify", () => {
  it("reports warning status (never silent pass) for matching hashes", async () => {
    const locked = await adapter.lock(lockInput);
    const actualHash = await sha256Hex(locked.lockedPayload);
    const result = await adapter.verify({
      lockedAssetId: locked.lockedAssetId,
      expectedLockedPayloadHash: locked.lockedPayloadHash,
      actualLockedPayloadHash: actualHash,
      expectedMetadataHash: locked.metadataHash,
      actualMetadataHash: locked.metadataHash
    });
    expect(result.status).toBe("warning");
    expect(result.checksPassed.map((check) => check.code)).toContain("LOCKED_PAYLOAD_HASH_MATCH");
    expect(result.checksFailed).toHaveLength(0);
  });

  it("fails when the locked payload was tampered with", async () => {
    const locked = await adapter.lock(lockInput);
    const tampered = new Uint8Array(locked.lockedPayload);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;
    const result = await adapter.verify({
      lockedAssetId: locked.lockedAssetId,
      expectedLockedPayloadHash: locked.lockedPayloadHash,
      actualLockedPayloadHash: await sha256Hex(tampered)
    });
    expect(result.status).toBe("fail");
    expect(result.checksFailed.map((check) => check.code)).toContain(
      "LOCKED_PAYLOAD_HASH_MISMATCH"
    );
  });

  it("fails on metadata hash mismatch", async () => {
    const locked = await adapter.lock(lockInput);
    const actualHash = await sha256Hex(locked.lockedPayload);
    const result = await adapter.verify({
      lockedAssetId: locked.lockedAssetId,
      expectedLockedPayloadHash: locked.lockedPayloadHash,
      actualLockedPayloadHash: actualHash,
      expectedMetadataHash: locked.metadataHash,
      actualMetadataHash: "00".repeat(32)
    });
    expect(result.status).toBe("fail");
    expect(result.checksFailed.map((check) => check.code)).toContain("METADATA_HASH_MISMATCH");
  });
});
