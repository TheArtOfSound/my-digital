import { createVerificationResult, inferVerificationStatus } from "@my-digital/core";
import type { EnvelopeVerifyInput, VerificationCheck, VerificationResult } from "@my-digital/types";

/** Recorded-hash comparison shared by the demo and production adapters. */
export function compareRecordedHashes(
  input: EnvelopeVerifyInput,
  options: { demoOnly: boolean; assumptions: string[] }
): VerificationResult {
  const checksPassed: VerificationCheck[] = [];
  const checksFailed: VerificationCheck[] = [];

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

  const warnings: VerificationCheck[] = options.demoOnly
    ? [
        {
          code: "DEMO_ONLY",
          label: "Demo-only envelope verification",
          detail:
            "This verifies lifecycle hashes only. It is not production QEV cryptographic verification."
        }
      ]
    : [];

  return createVerificationResult({
    subjectType: "locked-asset",
    subjectId: input.lockedAssetId,
    status: inferVerificationStatus({
      failedCount: checksFailed.length,
      warningCount: warnings.length
    }),
    checksPassed,
    checksFailed,
    warnings,
    assumptions: options.assumptions,
    artifacts: [input.lockedAssetId]
  });
}
