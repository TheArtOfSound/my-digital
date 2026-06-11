import type { LicenseId, UnlockCode, VerificationCheck, VerificationResult } from "@my-digital/types";
import { sha256HexOfString } from "./hash";
import { newUnlockCodeId } from "./ids";
import { createVerificationResult, inferVerificationStatus } from "./verification";

// Alphabet omits easily confused characters (0/O, 1/I/L).
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_GROUPS = 4;
const CODE_GROUP_LENGTH = 4;

export function generateRawUnlockCode(): string {
  const needed = CODE_GROUPS * CODE_GROUP_LENGTH;
  const chars: string[] = [];
  // Rejection sampling keeps the character distribution unbiased.
  const limit = 256 - (256 % CODE_ALPHABET.length);
  while (chars.length < needed) {
    const buffer = new Uint8Array(needed * 2);
    crypto.getRandomValues(buffer);
    for (const byte of buffer) {
      if (chars.length >= needed) break;
      if (byte < limit) chars.push(CODE_ALPHABET[byte % CODE_ALPHABET.length]!);
    }
  }
  const groups: string[] = [];
  for (let i = 0; i < CODE_GROUPS; i++) {
    groups.push(chars.slice(i * CODE_GROUP_LENGTH, (i + 1) * CODE_GROUP_LENGTH).join(""));
  }
  return `UNLK-${groups.join("-")}`;
}

export async function issueUnlockCode(input: {
  licenseId: LicenseId;
  maxRedemptions?: number;
  createdAt?: string;
}): Promise<{ unlockCode: UnlockCode; rawCode: string }> {
  const rawCode = generateRawUnlockCode();
  return {
    rawCode,
    unlockCode: {
      id: newUnlockCodeId(),
      licenseId: input.licenseId,
      codeHash: await sha256HexOfString(rawCode),
      createdAt: input.createdAt ?? new Date().toISOString(),
      redemptionCount: 0,
      status: "active",
      ...(input.maxRedemptions !== undefined ? { maxRedemptions: input.maxRedemptions } : {})
    }
  };
}

export async function verifyUnlockCode(input: {
  rawCode: string;
  unlockCode: UnlockCode;
}): Promise<VerificationResult> {
  const checksPassed: VerificationCheck[] = [];
  const checksFailed: VerificationCheck[] = [];

  const hashMatches = (await sha256HexOfString(input.rawCode)) === input.unlockCode.codeHash;
  (hashMatches ? checksPassed : checksFailed).push(
    hashMatches
      ? {
          code: "UNLOCK_CODE_HASH_MATCH",
          label: "Unlock code hash match",
          detail: "SHA-256 of the presented code matches the stored code hash."
        }
      : {
          code: "UNLOCK_CODE_HASH_MISMATCH",
          label: "Unlock code hash mismatch",
          detail: "SHA-256 of the presented code does not match the stored code hash."
        }
  );

  if (input.unlockCode.status === "active") {
    checksPassed.push({
      code: "UNLOCK_CODE_ACTIVE",
      label: "Unlock code active",
      detail: "Unlock code status is active."
    });
  } else {
    checksFailed.push({
      code: "UNLOCK_CODE_NOT_ACTIVE",
      label: "Unlock code not active",
      detail: `Unlock code status is "${input.unlockCode.status}".`
    });
  }

  if (input.unlockCode.maxRedemptions === undefined) {
    checksPassed.push({
      code: "UNLOCK_CODE_NO_REDEMPTION_LIMIT",
      label: "Redemption limit",
      detail: "No redemption limit is set for this code."
    });
  } else if (input.unlockCode.redemptionCount < input.unlockCode.maxRedemptions) {
    checksPassed.push({
      code: "UNLOCK_CODE_REDEMPTIONS_REMAINING",
      label: "Redemption limit",
      detail: `${input.unlockCode.redemptionCount} of ${input.unlockCode.maxRedemptions} redemptions used.`
    });
  } else {
    checksFailed.push({
      code: "UNLOCK_CODE_REDEMPTIONS_EXHAUSTED",
      label: "Redemption limit",
      detail: `All ${input.unlockCode.maxRedemptions} redemptions have been used.`
    });
  }

  return createVerificationResult({
    subjectType: "unlock-code",
    subjectId: input.unlockCode.id,
    status: inferVerificationStatus({ failedCount: checksFailed.length, warningCount: 0 }),
    checksPassed,
    checksFailed,
    assumptions: ["The unlock code record is assumed to come from trusted marketplace storage."],
    artifacts: [input.unlockCode.id, input.unlockCode.licenseId]
  });
}

export function redeemUnlockCode(unlockCode: UnlockCode, redeemedAt?: string): UnlockCode {
  const redemptionCount = unlockCode.redemptionCount + 1;
  const exhausted =
    unlockCode.maxRedemptions !== undefined && redemptionCount >= unlockCode.maxRedemptions;
  return {
    ...unlockCode,
    redemptionCount,
    redeemedAt: redeemedAt ?? new Date().toISOString(),
    status: exhausted ? "redeemed" : unlockCode.status
  };
}
