import type {
  BuyerLicense,
  CreatorId,
  LicenseId,
  ProofReceipt,
  Purchase,
  PurchaseId,
  VerificationCheck,
  VerificationResult
} from "@my-digital/types";
import { sha256HexOfString } from "./hash";
import { newProofReceiptId } from "./ids";
import { signCanonical, verifyCanonicalSignature } from "./signing";
import { createVerificationResult, inferVerificationStatus, stableJson } from "./verification";

type ReceiptCore = Omit<ProofReceipt, "receiptHash" | "issuerSignature">;

function receiptCoreFields(
  receipt: ReceiptCore & Partial<Pick<ProofReceipt, "receiptHash" | "issuerSignature">>
): ReceiptCore {
  return {
    id: receipt.id,
    purchaseId: receipt.purchaseId,
    licenseId: receipt.licenseId,
    assetId: receipt.assetId,
    assetVersionId: receipt.assetVersionId,
    buyerIdHash: receipt.buyerIdHash,
    creatorId: receipt.creatorId,
    createdAt: receipt.createdAt,
    ...(receipt.verificationUrl !== undefined ? { verificationUrl: receipt.verificationUrl } : {})
  };
}

export interface GenerateProofReceiptInput {
  purchase: Purchase;
  license: BuyerLicense;
  creatorId: CreatorId;
  issuerPrivateKey: CryptoKey;
  /** Base URL such as https://mydigital.imagineqira.com/verify; the receipt id is appended. */
  verificationUrlBase?: string;
  createdAt?: string;
}

export async function generateProofReceipt(
  input: GenerateProofReceiptInput
): Promise<ProofReceipt> {
  if (input.license.purchaseId !== input.purchase.id) {
    throw new Error(
      `Cannot generate receipt: license ${input.license.id} does not belong to purchase ${input.purchase.id}.`
    );
  }
  const id = newProofReceiptId();
  const core: ReceiptCore = {
    id,
    purchaseId: input.purchase.id,
    licenseId: input.license.id,
    assetId: input.license.assetId,
    assetVersionId: input.license.assetVersionId,
    buyerIdHash: await sha256HexOfString(input.license.buyerId),
    creatorId: input.creatorId,
    createdAt: input.createdAt ?? new Date().toISOString(),
    ...(input.verificationUrlBase !== undefined
      ? { verificationUrl: `${input.verificationUrlBase.replace(/\/$/, "")}/${id}` }
      : {})
  };
  const receiptHash = await sha256HexOfString(stableJson(core));
  const issuerSignature = await signCanonical(input.issuerPrivateKey, { ...core, receiptHash });
  return { ...core, receiptHash, issuerSignature };
}

export interface VerifyProofReceiptInput {
  receipt: ProofReceipt;
  issuerPublicKey: CryptoKey;
  expected?: {
    purchaseId?: PurchaseId;
    licenseId?: LicenseId;
  };
}

export async function verifyProofReceipt(
  input: VerifyProofReceiptInput
): Promise<VerificationResult> {
  const checksPassed: VerificationCheck[] = [];
  const checksFailed: VerificationCheck[] = [];
  const checksSkipped: VerificationCheck[] = [];

  const core = receiptCoreFields(input.receipt);
  const recomputedHash = await sha256HexOfString(stableJson(core));
  const hashMatches = recomputedHash === input.receipt.receiptHash;
  (hashMatches ? checksPassed : checksFailed).push(
    hashMatches
      ? {
          code: "RECEIPT_HASH_MATCH",
          label: "Receipt hash match",
          detail: "Recomputed SHA-256 over the canonical receipt fields matches the stored receipt hash."
        }
      : {
          code: "RECEIPT_HASH_MISMATCH",
          label: "Receipt hash mismatch",
          detail: "Recomputed SHA-256 over the canonical receipt fields does not match the stored receipt hash. The receipt was altered."
        }
  );

  const signatureValid = await verifyCanonicalSignature(
    input.issuerPublicKey,
    { ...core, receiptHash: input.receipt.receiptHash },
    input.receipt.issuerSignature
  );
  (signatureValid ? checksPassed : checksFailed).push(
    signatureValid
      ? {
          code: "RECEIPT_SIGNATURE_VALID",
          label: "Issuer signature valid",
          detail: "Ed25519 signature over the canonical receipt verifies with the issuer public key."
        }
      : {
          code: "RECEIPT_SIGNATURE_INVALID",
          label: "Issuer signature invalid",
          detail: "Ed25519 signature does not verify against the canonical receipt. The receipt was altered or was not issued by this issuer."
        }
  );

  const bindings: Array<{ code: string; label: string; expected: string | undefined; actual: string }> = [
    {
      code: "RECEIPT_PURCHASE_BINDING",
      label: "Receipt-to-purchase binding",
      expected: input.expected?.purchaseId,
      actual: input.receipt.purchaseId
    },
    {
      code: "RECEIPT_LICENSE_BINDING",
      label: "Receipt-to-license binding",
      expected: input.expected?.licenseId,
      actual: input.receipt.licenseId
    }
  ];
  for (const binding of bindings) {
    if (binding.expected === undefined) {
      checksSkipped.push({
        code: `${binding.code}_SKIPPED`,
        label: binding.label,
        detail: "No expected value supplied, so this binding was not checked."
      });
    } else if (binding.expected === binding.actual) {
      checksPassed.push({
        code: binding.code,
        label: binding.label,
        detail: `Receipt field matches expected value ${binding.expected}.`
      });
    } else {
      checksFailed.push({
        code: `${binding.code}_MISMATCH`,
        label: binding.label,
        detail: `Receipt field ${binding.actual} does not match expected value ${binding.expected}.`
      });
    }
  }

  return createVerificationResult({
    subjectType: "proof-receipt",
    subjectId: input.receipt.id,
    status: inferVerificationStatus({ failedCount: checksFailed.length, warningCount: 0 }),
    checksPassed,
    checksFailed,
    checksSkipped,
    assumptions: ["The issuer public key is assumed to come from a trusted marketplace record."],
    artifacts: [input.receipt.id, input.receipt.purchaseId, input.receipt.licenseId]
  });
}
