export type Brand<TValue, TBrand extends string> = TValue & { readonly __brand: TBrand };

export type CreatorId = Brand<string, "CreatorId">;
export type BuyerId = Brand<string, "BuyerId">;
export type AssetId = Brand<string, "AssetId">;
export type AssetVersionId = Brand<string, "AssetVersionId">;
export type LockedAssetId = Brand<string, "LockedAssetId">;
export type ListingId = Brand<string, "ListingId">;
export type PurchaseId = Brand<string, "PurchaseId">;
export type LicenseId = Brand<string, "LicenseId">;
export type UnlockCodeId = Brand<string, "UnlockCodeId">;
export type ProofReceiptId = Brand<string, "ProofReceiptId">;
export type FingerprintId = Brand<string, "FingerprintId">;
export type RevocationId = Brand<string, "RevocationId">;

export type VerificationStatus = "pass" | "fail" | "warning" | "unknown";

export interface LicenseTerms {
  personalUse: boolean;
  commercialUse: boolean;
  clientWorkAllowed: boolean;
  redistributionAllowed: boolean;
  resaleAllowed: boolean;
  aiTrainingAllowed: boolean;
  attributionRequired: boolean;
  seatCount: number;
}

export interface Creator {
  id: CreatorId;
  displayName: string;
  handle: string;
  emailHash: string;
  createdAt: string;
  verificationStatus: "unverified" | "reviewed" | "verified";
  publicSigningKey?: string;
}

export interface Buyer {
  id: BuyerId;
  emailHash: string;
  displayName?: string;
  createdAt: string;
}

export interface Asset {
  id: AssetId;
  creatorId: CreatorId;
  title: string;
  description: string;
  category: string;
  createdAt: string;
  status: "draft" | "locked" | "listed" | "archived";
}

export interface AssetVersion {
  id: AssetVersionId;
  assetId: AssetId;
  versionLabel: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  contentHash: string;
  manifestHash: string;
  createdAt: string;
  changelog?: string;
}

export interface LockedAsset {
  id: LockedAssetId;
  assetVersionId: AssetVersionId;
  envelopeFormat: string;
  envelopeVersion: string;
  lockedPayloadHash: string;
  metadataHash: string;
  qevEngineVersion: string;
  storageUri?: string;
  createdAt: string;
}

export interface Listing {
  id: ListingId;
  assetId: AssetId;
  activeAssetVersionId: AssetVersionId;
  creatorId: CreatorId;
  title: string;
  description: string;
  priceAmount: number;
  priceCurrency: string;
  licenseTerms: LicenseTerms;
  status: "draft" | "active" | "paused" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface Purchase {
  id: PurchaseId;
  listingId: ListingId;
  buyerId: BuyerId;
  assetVersionId: AssetVersionId;
  paymentProvider: "mock" | "stripe";
  paymentProviderReference: string;
  amountPaid: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "refunded";
  createdAt: string;
  paidAt?: string;
}

export interface BuyerLicense {
  id: LicenseId;
  purchaseId: PurchaseId;
  buyerId: BuyerId;
  assetId: AssetId;
  assetVersionId: AssetVersionId;
  lockedAssetId: LockedAssetId;
  terms: LicenseTerms;
  allowedUses: string[];
  expiresAt?: string;
  unlockLimit?: number;
  issuer: string;
  issuerSignature: string;
  issuedAt: string;
  revokedAt?: string;
}

export interface UnlockCode {
  id: UnlockCodeId;
  licenseId: LicenseId;
  codeHash: string;
  createdAt: string;
  redeemedAt?: string;
  redemptionCount: number;
  maxRedemptions?: number;
  status: "active" | "redeemed" | "revoked" | "expired";
}

export interface ProofReceipt {
  id: ProofReceiptId;
  purchaseId: PurchaseId;
  licenseId: LicenseId;
  assetId: AssetId;
  assetVersionId: AssetVersionId;
  buyerIdHash: string;
  creatorId: CreatorId;
  receiptHash: string;
  issuerSignature: string;
  createdAt: string;
  verificationUrl?: string;
}

export interface VerificationCheck {
  code: string;
  label: string;
  detail: string;
}

export interface VerificationResult {
  id: string;
  status: VerificationStatus;
  checkedAt: string;
  subjectType: string;
  subjectId: string;
  checksPassed: VerificationCheck[];
  checksFailed: VerificationCheck[];
  checksSkipped: VerificationCheck[];
  warnings: VerificationCheck[];
  assumptions: string[];
  artifacts: string[];
}
