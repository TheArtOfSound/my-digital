import type {
  Asset,
  AssetId,
  AssetVersion,
  AssetVersionId,
  Buyer,
  BuyerId,
  BuyerLicense,
  LicenseTerms,
  LockedAsset,
  LockedAssetId,
  Purchase,
  VerificationCheck,
  VerificationResult
} from "@my-digital/types";
import { newLicenseId } from "./ids";
import { signCanonical, verifyCanonicalSignature } from "./signing";
import { createVerificationResult, inferVerificationStatus } from "./verification";

export function allowedUsesFromTerms(terms: LicenseTerms): string[] {
  const uses: string[] = [];
  if (terms.personalUse) uses.push("personal-use");
  if (terms.commercialUse) uses.push("commercial-use");
  if (terms.clientWorkAllowed) uses.push("client-work");
  return uses;
}

type LicenseClaim = Omit<BuyerLicense, "issuerSignature" | "revokedAt">;

/**
 * The issuer signature covers the immutable license claim only. Mutable state
 * (revokedAt) stays outside the signed payload so revoking a license does not
 * invalidate the signature over its original issuance.
 */
export function licenseSigningPayload(
  license: LicenseClaim & Partial<Pick<BuyerLicense, "issuerSignature" | "revokedAt">>
): LicenseClaim {
  return {
    id: license.id,
    purchaseId: license.purchaseId,
    buyerId: license.buyerId,
    assetId: license.assetId,
    assetVersionId: license.assetVersionId,
    lockedAssetId: license.lockedAssetId,
    terms: license.terms,
    allowedUses: license.allowedUses,
    issuer: license.issuer,
    issuedAt: license.issuedAt,
    ...(license.expiresAt !== undefined ? { expiresAt: license.expiresAt } : {}),
    ...(license.unlockLimit !== undefined ? { unlockLimit: license.unlockLimit } : {})
  };
}

export interface IssueBuyerLicenseInput {
  purchase: Purchase;
  buyer: Buyer;
  asset: Asset;
  assetVersion: AssetVersion;
  lockedAsset: LockedAsset;
  terms: LicenseTerms;
  issuer: string;
  issuerPrivateKey: CryptoKey;
  expiresAt?: string;
  unlockLimit?: number;
  issuedAt?: string;
}

export async function issueBuyerLicense(input: IssueBuyerLicenseInput): Promise<BuyerLicense> {
  if (input.purchase.status !== "paid") {
    throw new Error(
      `Cannot issue license: purchase ${input.purchase.id} has status "${input.purchase.status}", expected "paid".`
    );
  }
  if (input.purchase.buyerId !== input.buyer.id) {
    throw new Error(
      `Cannot issue license: purchase ${input.purchase.id} belongs to a different buyer.`
    );
  }
  if (input.assetVersion.assetId !== input.asset.id) {
    throw new Error(
      `Cannot issue license: asset version ${input.assetVersion.id} does not belong to asset ${input.asset.id}.`
    );
  }
  if (input.lockedAsset.assetVersionId !== input.assetVersion.id) {
    throw new Error(
      `Cannot issue license: locked asset ${input.lockedAsset.id} does not wrap asset version ${input.assetVersion.id}.`
    );
  }

  const claim: LicenseClaim = {
    id: newLicenseId(),
    purchaseId: input.purchase.id,
    buyerId: input.buyer.id,
    assetId: input.asset.id,
    assetVersionId: input.assetVersion.id,
    lockedAssetId: input.lockedAsset.id,
    terms: input.terms,
    allowedUses: allowedUsesFromTerms(input.terms),
    issuer: input.issuer,
    issuedAt: input.issuedAt ?? new Date().toISOString(),
    ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
    ...(input.unlockLimit !== undefined ? { unlockLimit: input.unlockLimit } : {})
  };
  const issuerSignature = await signCanonical(input.issuerPrivateKey, licenseSigningPayload(claim));
  return { ...claim, issuerSignature };
}

export interface VerifyBuyerLicenseInput {
  license: BuyerLicense;
  issuerPublicKey: CryptoKey;
  expected?: {
    assetId?: AssetId;
    assetVersionId?: AssetVersionId;
    lockedAssetId?: LockedAssetId;
    buyerId?: BuyerId;
  };
  now?: string;
}

export async function verifyBuyerLicense(
  input: VerifyBuyerLicenseInput
): Promise<VerificationResult> {
  const now = input.now ?? new Date().toISOString();
  const checksPassed: VerificationCheck[] = [];
  const checksFailed: VerificationCheck[] = [];
  const checksSkipped: VerificationCheck[] = [];

  const signatureValid = await verifyCanonicalSignature(
    input.issuerPublicKey,
    licenseSigningPayload(input.license),
    input.license.issuerSignature
  );
  (signatureValid ? checksPassed : checksFailed).push(
    signatureValid
      ? {
          code: "LICENSE_SIGNATURE_VALID",
          label: "Issuer signature valid",
          detail: "Ed25519 signature over the canonical license claim verifies with the issuer public key."
        }
      : {
          code: "LICENSE_SIGNATURE_INVALID",
          label: "Issuer signature invalid",
          detail: "Ed25519 signature does not verify against the canonical license claim. The license was altered or was not issued by this issuer."
        }
  );

  const bindings: Array<{
    code: string;
    label: string;
    expected: string | undefined;
    actual: string;
  }> = [
    {
      code: "LICENSE_ASSET_BINDING",
      label: "License-to-asset binding",
      expected: input.expected?.assetId,
      actual: input.license.assetId
    },
    {
      code: "LICENSE_ASSET_VERSION_BINDING",
      label: "License-to-asset-version binding",
      expected: input.expected?.assetVersionId,
      actual: input.license.assetVersionId
    },
    {
      code: "LICENSE_LOCKED_ASSET_BINDING",
      label: "License-to-locked-asset binding",
      expected: input.expected?.lockedAssetId,
      actual: input.license.lockedAssetId
    },
    {
      code: "LICENSE_BUYER_BINDING",
      label: "License-to-buyer binding",
      expected: input.expected?.buyerId,
      actual: input.license.buyerId
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
        detail: `License field matches expected value ${binding.expected}.`
      });
    } else {
      checksFailed.push({
        code: `${binding.code}_MISMATCH`,
        label: binding.label,
        detail: `License field ${binding.actual} does not match expected value ${binding.expected}.`
      });
    }
  }

  if (input.license.revokedAt !== undefined) {
    checksFailed.push({
      code: "LICENSE_REVOKED",
      label: "License revoked",
      detail: `License was revoked at ${input.license.revokedAt}.`
    });
  } else {
    checksPassed.push({
      code: "LICENSE_NOT_REVOKED",
      label: "License not revoked",
      detail: "No revocation is recorded on this license."
    });
  }

  if (input.license.expiresAt === undefined) {
    checksPassed.push({
      code: "LICENSE_NO_EXPIRY",
      label: "License expiry",
      detail: "License has no expiry date."
    });
  } else if (Date.parse(input.license.expiresAt) > Date.parse(now)) {
    checksPassed.push({
      code: "LICENSE_NOT_EXPIRED",
      label: "License expiry",
      detail: `License is valid until ${input.license.expiresAt}.`
    });
  } else {
    checksFailed.push({
      code: "LICENSE_EXPIRED",
      label: "License expired",
      detail: `License expired at ${input.license.expiresAt}.`
    });
  }

  return createVerificationResult({
    subjectType: "buyer-license",
    subjectId: input.license.id,
    status: inferVerificationStatus({ failedCount: checksFailed.length, warningCount: 0 }),
    checksPassed,
    checksFailed,
    checksSkipped,
    assumptions: [
      "The issuer public key is assumed to come from a trusted marketplace record.",
      "Purchase payment state is recorded by the marketplace and is not re-verified cryptographically here."
    ],
    artifacts: [input.license.id, input.license.assetVersionId, input.license.lockedAssetId]
  });
}
