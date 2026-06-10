import { createVerificationResult, inferVerificationStatus } from "@my-digital/core";
import type { AssetVersionId, LockedAssetId, VerificationResult } from "@my-digital/types";

export interface EnvelopeAdapter {
  lock(input: EnvelopeLockInput): Promise<EnvelopeLockResult>;
  unlock(input: EnvelopeUnlockInput): Promise<EnvelopeUnlockResult>;
  verify(input: EnvelopeVerifyInput): Promise<VerificationResult>;
}

export interface EnvelopeLockInput {
  assetVersionId: AssetVersionId;
  fileName: string;
  mimeType: string;
  plaintext: Uint8Array;
}

export interface EnvelopeLockResult {
  lockedAssetId: LockedAssetId;
  envelopeFormat: string;
  envelopeVersion: string;
  lockedPayload: Uint8Array;
  lockedPayloadHash: string;
  metadataHash: string;
  qevEngineVersion: string;
  developmentOnly: boolean;
}

export interface EnvelopeUnlockInput {
  lockedPayload: Uint8Array;
  licenseMaterial: string;
}

export interface EnvelopeUnlockResult {
  plaintext: Uint8Array;
  verification: VerificationResult;
}

export interface EnvelopeVerifyInput {
  lockedAssetId: LockedAssetId;
  expectedLockedPayloadHash: string;
  actualLockedPayloadHash: string;
  expectedMetadataHash?: string;
  actualMetadataHash?: string;
}

export class DemoEnvelopeAdapter implements EnvelopeAdapter {
  async lock(input: EnvelopeLockInput): Promise<EnvelopeLockResult> {
    const lockedPayload = new TextEncoder().encode(
      JSON.stringify({
        warning: "DEMO ONLY - NOT PRODUCTION CRYPTO - FOR LIFECYCLE TESTING",
        fileName: input.fileName,
        mimeType: input.mimeType,
        payloadBase64: bytesToBase64(input.plaintext)
      })
    );

    return {
      lockedAssetId: `locked_${crypto.randomUUID()}` as LockedAssetId,
      envelopeFormat: "MYDIGITAL-DEMO-ENVELOPE",
      envelopeVersion: "0.0.1-demo",
      lockedPayload,
      lockedPayloadHash: await sha256Hex(lockedPayload),
      metadataHash: await sha256Hex(new TextEncoder().encode(`${input.fileName}:${input.mimeType}`)),
      qevEngineVersion: "demo-adapter-not-qev-production",
      developmentOnly: true
    };
  }

  async unlock(input: EnvelopeUnlockInput): Promise<EnvelopeUnlockResult> {
    const decoded = JSON.parse(new TextDecoder().decode(input.lockedPayload)) as { payloadBase64?: string };
    const plaintext = decoded.payloadBase64 ? base64ToBytes(decoded.payloadBase64) : new Uint8Array();

    return {
      plaintext,
      verification: createVerificationResult({
        subjectType: "demo-envelope-unlock",
        subjectId: "demo",
        status: input.licenseMaterial.length > 0 ? "warning" : "fail",
        checksPassed: input.licenseMaterial.length > 0 ? [
          {
            code: "DEMO_LICENSE_MATERIAL_PRESENT",
            label: "Demo license material present",
            detail: "A non-empty license material string was supplied. This is not production license verification."
          }
        ] : [],
        checksFailed: input.licenseMaterial.length === 0 ? [
          {
            code: "MISSING_LICENSE_MATERIAL",
            label: "Missing license material",
            detail: "Demo unlock requires a non-empty license material string."
          }
        ] : [],
        warnings: [
          {
            code: "DEMO_ONLY",
            label: "Demo-only unlock",
            detail: "This adapter is for lifecycle testing only and does not provide production cryptographic security."
          }
        ],
        assumptions: ["Production QEV envelope integration will replace this adapter."],
        artifacts: ["MYDIGITAL-DEMO-ENVELOPE"]
      })
    };
  }

  async verify(input: EnvelopeVerifyInput): Promise<VerificationResult> {
    const checksFailed = [];
    const checksPassed = [];

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
          detail: "This verifies lifecycle hashes only. It is not production QEV cryptographic verification."
        }
      ],
      assumptions: ["Expected hashes come from trusted marketplace records."],
      artifacts: [input.lockedAssetId]
    });
  }
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
