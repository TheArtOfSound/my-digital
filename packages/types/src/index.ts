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
  /** Short creator bio shown on the public profile. */
  bio?: string;
  /** Avatar as an https URL or a small data: URL (image/*). */
  avatarUrl?: string;
  /** Optional creator website / link. */
  websiteUrl?: string;
  /**
   * The creator's own Stripe Connect account id (acct_…). When set and payouts
   * are enabled, buyers pay this account directly — funds never touch the
   * platform's Stripe balance.
   */
  stripeAccountId?: string;
  /** True once Stripe reports the connected account can accept charges/payouts. */
  payoutsEnabled?: boolean;
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

export interface Fingerprint {
  id: FingerprintId;
  licenseId: LicenseId;
  assetVersionId: AssetVersionId;
  fingerprintType: string;
  fingerprintHash: string;
  embeddingStrategy: string;
  confidenceModel: string;
  createdAt: string;
}

export interface Revocation {
  id: RevocationId;
  targetType: "license" | "unlockCode";
  targetId: string;
  reason: string;
  createdAt: string;
  createdBy: string;
  issuerSignature: string;
}

export interface AssetManifest {
  schema: "MYDIGITAL-ASSET-MANIFEST-V1";
  assetId: AssetId;
  assetVersionId: AssetVersionId;
  creatorId: CreatorId;
  versionLabel: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  contentHash: string;
  createdAt: string;
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
  /**
   * Custody key material returned by adapters whose lock operation produces
   * a key needed to mint buyer-specific wraps later. Treat as a secret: it
   * decrypts the locked asset. Absent for adapters without buyer wrapping.
   */
  keyMaterialB64?: string;
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

export interface EnvelopeAdapter {
  lock(input: EnvelopeLockInput): Promise<EnvelopeLockResult>;
  unlock(input: EnvelopeUnlockInput): Promise<EnvelopeUnlockResult>;
  verify(input: EnvelopeVerifyInput): Promise<VerificationResult>;
}

export interface WrapForCredentialInput {
  /** The locked payload produced by lock() (the custody envelope). */
  lockedPayload: Uint8Array;
  /** The custody key material returned by lock(). */
  keyMaterialB64: string;
  /** The buyer credential (raw unlock code or passphrase). */
  credential: string;
  /** The license this wrap is bound to. */
  licenseId: LicenseId;
}

export interface WrapForCredentialResult {
  /** Buyer-specific locked payload, unlockable only with the credential. */
  buyerLockedPayload: Uint8Array;
  buyerLockedPayloadHash: string;
}

/**
 * Envelope adapters that support minting buyer-specific locked payloads
 * from a custody-locked asset plus a buyer credential.
 */
export interface BuyerWrappingEnvelopeAdapter extends EnvelopeAdapter {
  wrapForCredential(input: WrapForCredentialInput): Promise<WrapForCredentialResult>;
}

export type CheckoutSessionId = Brand<string, "CheckoutSessionId">;

export interface CheckoutSession {
  id: CheckoutSessionId;
  listingId: ListingId;
  buyerId: BuyerId;
  amount: number;
  currency: string;
  status: "open" | "paid" | "failed" | "expired";
  provider: "mock" | "stripe";
  providerReference: string;
  createdAt: string;
  completedAt?: string;
  /** Hosted checkout URL for redirect-based providers; absent for the mock. */
  checkoutUrl?: string;
  /**
   * Stripe Connect account the charge was created on (direct charge). Persisted
   * so confirmation after a restart retrieves the session on the right account.
   */
  connectedAccountId?: string;
}

export interface CreateCheckoutInput {
  listing: Listing;
  buyer: Buyer;
  /**
   * Stripe Connect account to charge directly (the creator's account). When
   * set, the charge is created on this account and the buyer pays the creator
   * directly; the platform may take an application fee.
   */
  connectedAccountId?: string;
  /** Platform application fee in the smallest currency unit (cents). */
  applicationFeeAmount?: number;
}

export interface ConfirmPaymentInput {
  sessionId: CheckoutSessionId;
  /** Mock adapter only: which outcome the simulated provider reports. Real adapters ignore this. */
  simulateOutcome?: "paid" | "failed";
}

export interface PaymentConfirmation {
  session: CheckoutSession;
  outcome: "paid" | "failed";
  providerEventId: string;
  occurredAt: string;
}

export interface PaymentAdapter {
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  confirmPayment(input: ConfirmPaymentInput): Promise<PaymentConfirmation>;
  /**
   * Rehydrate a session persisted by the caller (e.g. after a server
   * restart) so confirmPayment can complete it. Optional: adapters with
   * purely in-memory sessions implement it; callers feature-detect.
   */
  restoreSession?(session: CheckoutSession): void;
}

/**
 * Honest trace evidence levels, strongest to weakest:
 * - exact-vault-match: byte-identical to a buyer vault minted by this
 *   marketplace; attributable to a specific license.
 * - plaintext-content-match: matches a listed asset's decrypted content;
 *   plaintext copies carry no buyer-specific marking, so no attribution.
 * - vault-format-unattributed: a valid QEV vault, but not one minted here.
 * - no-evidence: unsupported artifact type; no fingerprinting exists for it.
 */
export type TraceEvidenceLevel =
  | "exact-vault-match"
  | "plaintext-content-match"
  | "vault-format-unattributed"
  | "no-evidence";

export interface TraceResult {
  id: string;
  evidenceLevel: TraceEvidenceLevel;
  artifactSha256: string;
  artifactByteSize: number;
  explanation: string;
  caveats: string[];
  checkedAt: string;
  match?: {
    licenseId?: LicenseId;
    buyerIdHash?: string;
    assetId?: AssetId;
    assetVersionId?: AssetVersionId;
    fingerprintId?: FingerprintId;
    licenseRevoked?: boolean;
  };
}
