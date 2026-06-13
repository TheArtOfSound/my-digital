import type {
  Asset,
  AssetId,
  AssetVersion,
  AssetVersionId,
  Buyer,
  BuyerId,
  BuyerLicense,
  CheckoutSession,
  CheckoutSessionId,
  Creator,
  CreatorId,
  Fingerprint,
  LicenseId,
  LicenseTerms,
  Listing,
  ListingId,
  LockedAsset,
  LockedAssetId,
  ProofReceipt,
  ProofReceiptId,
  Purchase,
  PurchaseId,
  Revocation,
  UnlockCode
} from "@my-digital/types";
import type { StoredCheckoutSession } from "./interface";
import * as schema from "./schema";

/** Spread helper: include the property only when the column is non-null. */
export function opt<K extends string, V>(
  key: K,
  value: V | null
): { [P in K]: V } | Record<never, never> {
  return value === null ? {} : ({ [key]: value } as { [P in K]: V });
}

type CreatorRow = typeof schema.creators.$inferSelect;
type BuyerRow = typeof schema.buyers.$inferSelect;
type AssetRow = typeof schema.assets.$inferSelect;
type AssetVersionRow = typeof schema.assetVersions.$inferSelect;
type LockedAssetRow = typeof schema.lockedAssets.$inferSelect;
type ListingRow = typeof schema.listings.$inferSelect;
type CheckoutSessionRow = typeof schema.checkoutSessions.$inferSelect;
type PurchaseRow = typeof schema.purchases.$inferSelect;
type LicenseRow = typeof schema.licenses.$inferSelect;
type UnlockCodeRow = typeof schema.unlockCodes.$inferSelect;
type ProofReceiptRow = typeof schema.proofReceipts.$inferSelect;
type FingerprintRow = typeof schema.fingerprints.$inferSelect;
type RevocationRow = typeof schema.revocations.$inferSelect;

export function rowToCreator(row: CreatorRow): Creator {
  return {
    id: row.id as CreatorId,
    displayName: row.displayName,
    handle: row.handle,
    emailHash: row.emailHash,
    createdAt: row.createdAt,
    verificationStatus: row.verificationStatus as Creator["verificationStatus"],
    ...opt("publicSigningKey", row.publicSigningKey),
    ...opt("bio", row.bio),
    ...opt("avatarUrl", row.avatarUrl),
    ...opt("websiteUrl", row.websiteUrl)
  };
}

export function rowToBuyer(row: BuyerRow): Buyer {
  return {
    id: row.id as BuyerId,
    emailHash: row.emailHash,
    createdAt: row.createdAt,
    ...opt("displayName", row.displayName)
  };
}

export function rowToAsset(row: AssetRow): Asset {
  return {
    id: row.id as AssetId,
    creatorId: row.creatorId as CreatorId,
    title: row.title,
    description: row.description,
    category: row.category,
    createdAt: row.createdAt,
    status: row.status as Asset["status"]
  };
}

export function rowToAssetVersion(row: AssetVersionRow): AssetVersion {
  return {
    id: row.id as AssetVersionId,
    assetId: row.assetId as AssetId,
    versionLabel: row.versionLabel,
    fileName: row.fileName,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    contentHash: row.contentHash,
    manifestHash: row.manifestHash,
    createdAt: row.createdAt,
    ...opt("changelog", row.changelog)
  };
}

export function rowToLockedAsset(row: LockedAssetRow): LockedAsset {
  return {
    id: row.id as LockedAssetId,
    assetVersionId: row.assetVersionId as AssetVersionId,
    envelopeFormat: row.envelopeFormat,
    envelopeVersion: row.envelopeVersion,
    lockedPayloadHash: row.lockedPayloadHash,
    metadataHash: row.metadataHash,
    qevEngineVersion: row.qevEngineVersion,
    createdAt: row.createdAt,
    ...opt("storageUri", row.storageUri)
  };
}

export function rowToListing(row: ListingRow): Listing {
  return {
    id: row.id as ListingId,
    assetId: row.assetId as AssetId,
    activeAssetVersionId: row.activeAssetVersionId as AssetVersionId,
    creatorId: row.creatorId as CreatorId,
    title: row.title,
    description: row.description,
    priceAmount: row.priceAmount,
    priceCurrency: row.priceCurrency,
    licenseTerms: JSON.parse(row.licenseTerms) as LicenseTerms,
    status: row.status as Listing["status"],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export function rowToCheckoutSession(row: CheckoutSessionRow): StoredCheckoutSession {
  return {
    id: row.id as CheckoutSessionId,
    purchaseId: row.purchaseId as PurchaseId,
    listingId: row.listingId as ListingId,
    buyerId: row.buyerId as BuyerId,
    amount: row.amount,
    currency: row.currency,
    status: row.status as CheckoutSession["status"],
    provider: row.provider as CheckoutSession["provider"],
    providerReference: row.providerReference,
    createdAt: row.createdAt,
    ...opt("checkoutUrl", row.checkoutUrl),
    ...opt("completedAt", row.completedAt)
  };
}

export function rowToPurchase(row: PurchaseRow): Purchase {
  return {
    id: row.id as PurchaseId,
    listingId: row.listingId as ListingId,
    buyerId: row.buyerId as BuyerId,
    assetVersionId: row.assetVersionId as AssetVersionId,
    paymentProvider: row.paymentProvider as Purchase["paymentProvider"],
    paymentProviderReference: row.paymentProviderReference,
    amountPaid: row.amountPaid,
    currency: row.currency,
    status: row.status as Purchase["status"],
    createdAt: row.createdAt,
    ...opt("paidAt", row.paidAt)
  };
}

export function rowToLicense(row: LicenseRow): BuyerLicense {
  return {
    id: row.id as LicenseId,
    purchaseId: row.purchaseId as PurchaseId,
    buyerId: row.buyerId as BuyerId,
    assetId: row.assetId as AssetId,
    assetVersionId: row.assetVersionId as AssetVersionId,
    lockedAssetId: row.lockedAssetId as LockedAssetId,
    terms: JSON.parse(row.terms) as LicenseTerms,
    allowedUses: JSON.parse(row.allowedUses) as string[],
    issuer: row.issuer,
    issuerSignature: row.issuerSignature,
    issuedAt: row.issuedAt,
    ...opt("expiresAt", row.expiresAt),
    ...opt("unlockLimit", row.unlockLimit),
    ...opt("revokedAt", row.revokedAt)
  };
}

export function rowToUnlockCode(row: UnlockCodeRow): UnlockCode {
  return {
    id: row.id as UnlockCode["id"],
    licenseId: row.licenseId as LicenseId,
    codeHash: row.codeHash,
    createdAt: row.createdAt,
    redemptionCount: row.redemptionCount,
    status: row.status as UnlockCode["status"],
    ...opt("redeemedAt", row.redeemedAt),
    ...opt("maxRedemptions", row.maxRedemptions)
  };
}

export function rowToProofReceipt(row: ProofReceiptRow): ProofReceipt {
  return {
    id: row.id as ProofReceiptId,
    purchaseId: row.purchaseId as PurchaseId,
    licenseId: row.licenseId as LicenseId,
    assetId: row.assetId as AssetId,
    assetVersionId: row.assetVersionId as AssetVersionId,
    buyerIdHash: row.buyerIdHash,
    creatorId: row.creatorId as CreatorId,
    receiptHash: row.receiptHash,
    issuerSignature: row.issuerSignature,
    createdAt: row.createdAt,
    ...opt("verificationUrl", row.verificationUrl)
  };
}

export function rowToFingerprint(row: FingerprintRow): Fingerprint {
  return {
    id: row.id as Fingerprint["id"],
    licenseId: row.licenseId as LicenseId,
    assetVersionId: row.assetVersionId as AssetVersionId,
    fingerprintType: row.fingerprintType,
    fingerprintHash: row.fingerprintHash,
    embeddingStrategy: row.embeddingStrategy,
    confidenceModel: row.confidenceModel,
    createdAt: row.createdAt
  };
}

export function rowToRevocation(row: RevocationRow): Revocation {
  return {
    id: row.id as Revocation["id"],
    targetType: row.targetType as Revocation["targetType"],
    targetId: row.targetId,
    reason: row.reason,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    issuerSignature: row.issuerSignature
  };
}
