import {
  base64ToBytes,
  bytesToBase64,
  createVerificationResult,
  inferVerificationStatus,
  newLockedAssetId,
  sha256Hex
} from "@my-digital/core";
import type {
  EnvelopeAdapter,
  EnvelopeLockInput,
  EnvelopeLockResult,
  EnvelopeUnlockInput,
  EnvelopeUnlockResult,
  EnvelopeVerifyInput,
  VerificationCheck,
  VerificationResult
} from "@my-digital/types";

export type {
  EnvelopeAdapter,
  EnvelopeLockInput,
  EnvelopeLockResult,
  EnvelopeUnlockInput,
  EnvelopeUnlockResult,
  EnvelopeVerifyInput
} from "@my-digital/types";

const DEMO_WARNING = "DEMO ONLY - NOT PRODUCTION CRYPTO - FOR LIFECYCLE TESTING";

const demoOnlyWarning: VerificationCheck = {
  code: "DEMO_ONLY",
  label: "Demo-only envelope adapter",
  detail:
    "This adapter exists for lifecycle testing only and does not provide production cryptographic security."
};

const demoAssumptions = ["Production QEV envelope integration will replace this adapter."];

export class DemoEnvelopeAdapter implements EnvelopeAdapter {
  async lock(input: EnvelopeLockInput): Promise<EnvelopeLockResult> {
    const lockedPayload = new TextEncoder().encode(
      JSON.stringify({
        warning: DEMO_WARNING,
        fileName: input.fileName,
        mimeType: input.mimeType,
        payloadBase64: bytesToBase64(input.plaintext)
      })
    );

    return {
      lockedAssetId: newLockedAssetId(),
      envelopeFormat: "MYDIGITAL-DEMO-ENVELOPE",
      envelopeVersion: "0.0.1-demo",
      lockedPayload,
      lockedPayloadHash: await sha256Hex(lockedPayload),
      metadataHash: await sha256Hex(
        new TextEncoder().encode(`${input.fileName}:${input.mimeType}`)
      ),
      qevEngineVersion: "demo-adapter-not-qev-production",
      developmentOnly: true
    };
  }

  async unlock(input: EnvelopeUnlockInput): Promise<EnvelopeUnlockResult> {
    if (input.licenseMaterial.length === 0) {
      return this.failedUnlock({
        code: "MISSING_LICENSE_MATERIAL",
        label: "Missing license material",
        detail: "Demo unlock requires a non-empty license material string. No payload was returned."
      });
    }

    let decoded: { payloadBase64?: unknown };
    try {
      decoded = JSON.parse(new TextDecoder().decode(input.lockedPayload)) as {
        payloadBase64?: unknown;
      };
    } catch {
      return this.failedUnlock({
        code: "ENVELOPE_PARSE_FAILED",
        label: "Envelope parse failed",
        detail: "The locked payload is not a readable demo envelope. It may be corrupted or tampered with."
      });
    }

    if (typeof decoded.payloadBase64 !== "string") {
      return this.failedUnlock({
        code: "ENVELOPE_PAYLOAD_MISSING",
        label: "Envelope payload missing",
        detail: "The demo envelope does not contain an embedded payload field."
      });
    }

    let plaintext: Uint8Array;
    try {
      plaintext = base64ToBytes(decoded.payloadBase64);
    } catch {
      return this.failedUnlock({
        code: "ENVELOPE_PAYLOAD_DECODE_FAILED",
        label: "Envelope payload decode failed",
        detail: "The embedded payload could not be decoded. The envelope may be corrupted or tampered with."
      });
    }

    return {
      plaintext,
      verification: createVerificationResult({
        subjectType: "demo-envelope-unlock",
        subjectId: "demo",
        status: "warning",
        checksPassed: [
          {
            code: "DEMO_LICENSE_MATERIAL_PRESENT",
            label: "Demo license material present",
            detail:
              "A non-empty license material string was supplied. This is not production license verification."
          }
        ],
        warnings: [demoOnlyWarning],
        assumptions: demoAssumptions,
        artifacts: ["MYDIGITAL-DEMO-ENVELOPE"]
      })
    };
  }

  async verify(input: EnvelopeVerifyInput): Promise<VerificationResult> {
    const checksFailed: VerificationCheck[] = [];
    const checksPassed: VerificationCheck[] = [];

    if (input.expectedLockedPayloadHash === input.actualLockedPayloadHash) {
      checksPassed.push({
        code: "LOCKED_PAYLOAD_HASH_MATCH",
        label: "Locked payload hash matches",
        detail: "The provided locked payload hash matches the expected hash."
      });
    } else {
      checksFailed.push({
        code: "LOCKED_PAYLOAD_HASH_MISMATCH",
        label: "Locked payload hash mismatch",
        detail: "The provided locked payload hash does not match the expected hash."
      });
    }

    if (input.expectedMetadataHash && input.actualMetadataHash) {
      if (input.expectedMetadataHash === input.actualMetadataHash) {
        checksPassed.push({
          code: "METADATA_HASH_MATCH",
          label: "Metadata hash matches",
          detail: "The provided metadata hash matches the expected hash."
        });
      } else {
        checksFailed.push({
          code: "METADATA_HASH_MISMATCH",
          label: "Metadata hash mismatch",
          detail: "The provided metadata hash does not match the expected hash."
        });
      }
    }

    return createVerificationResult({
      subjectType: "locked-asset",
      subjectId: input.lockedAssetId,
      status: inferVerificationStatus({ failedCount: checksFailed.length, warningCount: 1 }),
      checksPassed,
      checksFailed,
      warnings: [
        {
          code: "DEMO_ONLY",
          label: "Demo-only envelope verification",
          detail:
            "This verifies lifecycle hashes only. It is not production QEV cryptographic verification."
        }
      ],
      assumptions: ["Expected hashes come from trusted marketplace records."],
      artifacts: [input.lockedAssetId]
    });
  }

  private failedUnlock(failure: VerificationCheck): EnvelopeUnlockResult {
    return {
      plaintext: new Uint8Array(),
      verification: createVerificationResult({
        subjectType: "demo-envelope-unlock",
        subjectId: "demo",
        status: "fail",
        checksFailed: [failure],
        warnings: [demoOnlyWarning],
        assumptions: demoAssumptions,
        artifacts: ["MYDIGITAL-DEMO-ENVELOPE"]
      })
    };
  }
}
