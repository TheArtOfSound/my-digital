import {
  base64ToBytes,
  bytesToBase64,
  createVerificationResult,
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
import { compareRecordedHashes } from "./hash-comparison";

export type {
  BuyerWrappingEnvelopeAdapter,
  EnvelopeAdapter,
  EnvelopeLockInput,
  EnvelopeLockResult,
  EnvelopeUnlockInput,
  EnvelopeUnlockResult,
  EnvelopeVerifyInput,
  WrapForCredentialInput,
  WrapForCredentialResult
} from "@my-digital/types";
export {
  QEV_KDF_PRESETS,
  QEV_VAULT_SCHEMA,
  QevVaultV2EnvelopeAdapter,
  type QevKdfPreset,
  type QevVaultV2EnvelopeAdapterOptions
} from "./qev-vault-v2";
export { compareRecordedHashes } from "./hash-comparison";

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
    return compareRecordedHashes(input, {
      demoOnly: true,
      assumptions: ["Expected hashes come from trusted marketplace records."]
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
