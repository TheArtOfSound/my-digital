import type {
  Asset,
  AssetId,
  AssetManifest,
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
  Listing,
  ListingId,
  LockedAsset,
  LockedAssetId,
  ProofReceipt,
  ProofReceiptId,
  Purchase,
  PurchaseId,
  Revocation,
  Session,
  SessionId,
  UnlockCode,
  User,
  UserId
} from "@my-digital/types";

/**
 * Issuer record persisted for verification. Only the public key is stored;
 * private signing keys must never enter the marketplace database unsealed.
 */
export interface StoredIssuerRecord {
  name: string;
  publicKeyB64: string;
  createdAt: string;
}

/**
 * A secret sealed under the server master key (XChaCha20-Poly1305) before it
 * reaches the database. The store never sees plaintext secrets; sealing and
 * opening happen in the server keystore.
 */
export interface SealedSecretRecord {
  nonceB64: string;
  sealedB64: string;
  createdAt: string;
}

/** A checkout session persisted with the pending purchase it belongs to. */
export type StoredCheckoutSession = CheckoutSession & { purchaseId: PurchaseId };

export interface MarketplaceStore {
  putIssuer(issuer: StoredIssuerRecord): Promise<void>;
  getIssuer(name: string): Promise<StoredIssuerRecord | null>;

  // Accounts & sessions.
  insertUser(user: User): Promise<void>;
  getUserById(id: UserId): Promise<User | null>;
  getUserByEmailLower(emailLower: string): Promise<User | null>;
  insertSession(session: Session): Promise<void>;
  getSession(id: SessionId): Promise<Session | null>;
  deleteSession(id: SessionId): Promise<void>;

  insertCreator(creator: Creator): Promise<void>;
  getCreator(id: CreatorId): Promise<Creator | null>;
  /** The seller profile owned by an account, if any. */
  getCreatorByUserId(userId: UserId): Promise<Creator | null>;
  listCreators(): Promise<Creator[]>;
  /** Replaces a creator's mutable profile fields. */
  updateCreator(creator: Creator): Promise<void>;

  insertBuyer(buyer: Buyer): Promise<void>;
  getBuyer(id: BuyerId): Promise<Buyer | null>;
  getBuyerByEmailHash(emailHash: string): Promise<Buyer | null>;
  /** The buyer record linked to an account, if any (persistent library). */
  getBuyerByUserId(userId: UserId): Promise<Buyer | null>;
  listBuyers(): Promise<Buyer[]>;

  insertAsset(asset: Asset): Promise<void>;
  getAsset(id: AssetId): Promise<Asset | null>;
  listAssets(): Promise<Asset[]>;
  updateAssetStatus(id: AssetId, status: Asset["status"]): Promise<void>;

  insertAssetVersion(version: AssetVersion, manifest: AssetManifest): Promise<void>;
  getAssetVersion(id: AssetVersionId): Promise<AssetVersion | null>;
  getAssetManifest(id: AssetVersionId): Promise<AssetManifest | null>;
  listAssetVersions(): Promise<AssetVersion[]>;

  insertLockedAsset(lockedAsset: LockedAsset): Promise<void>;
  getLockedAsset(id: LockedAssetId): Promise<LockedAsset | null>;
  getLockedAssetByVersion(assetVersionId: AssetVersionId): Promise<LockedAsset | null>;

  putLockedPayload(lockedAssetId: LockedAssetId, payload: Uint8Array): Promise<void>;
  getLockedPayload(lockedAssetId: LockedAssetId): Promise<Uint8Array | null>;

  putCustodySecret(lockedAssetId: LockedAssetId, secret: SealedSecretRecord): Promise<void>;
  getCustodySecret(lockedAssetId: LockedAssetId): Promise<SealedSecretRecord | null>;

  putIssuerSecret(issuerName: string, secret: SealedSecretRecord): Promise<void>;
  getIssuerSecret(issuerName: string): Promise<SealedSecretRecord | null>;

  putBuyerLockedPayload(
    licenseId: LicenseId,
    payload: Uint8Array,
    payloadHash: string
  ): Promise<void>;
  getBuyerLockedPayload(
    licenseId: LicenseId
  ): Promise<{ payload: Uint8Array; payloadHash: string } | null>;
  /** Trace support: find which license a leaked vault was minted for. */
  findBuyerLockedPayloadByHash(
    payloadHash: string
  ): Promise<{ licenseId: LicenseId; payloadHash: string } | null>;
  /** Trace support: find which asset version a leaked plaintext belongs to. */
  findAssetVersionByContentHash(contentHash: string): Promise<AssetVersion | null>;

  insertListing(listing: Listing): Promise<void>;
  getListing(id: ListingId): Promise<Listing | null>;
  listListings(): Promise<Listing[]>;
  /** Replaces a listing's mutable fields (title, price, status, …). */
  updateListing(listing: Listing): Promise<void>;
  /**
   * Deletes a listing and the asset chain behind it (asset, its versions,
   * their locked packages, payloads, and custody secrets). The caller is
   * responsible for refusing deletion when sales/licenses reference the asset.
   */
  deleteListingCascade(id: ListingId): Promise<void>;

  insertPurchase(purchase: Purchase): Promise<void>;
  getPurchase(id: PurchaseId): Promise<Purchase | null>;
  listPurchases(): Promise<Purchase[]>;
  updatePurchaseStatus(id: PurchaseId, status: Purchase["status"], paidAt?: string): Promise<void>;
  findPurchaseByProviderReference(providerReference: string): Promise<Purchase | null>;

  insertCheckoutSession(session: StoredCheckoutSession): Promise<void>;
  getCheckoutSessionByPurchase(purchaseId: PurchaseId): Promise<StoredCheckoutSession | null>;
  getCheckoutSessionByProviderReference(
    providerReference: string
  ): Promise<StoredCheckoutSession | null>;
  updateCheckoutSessionStatus(
    id: CheckoutSessionId,
    status: CheckoutSession["status"],
    completedAt?: string
  ): Promise<void>;

  insertLicense(license: BuyerLicense): Promise<void>;
  getLicense(id: LicenseId): Promise<BuyerLicense | null>;
  listLicenses(): Promise<BuyerLicense[]>;
  setLicenseRevoked(id: LicenseId, revokedAt: string): Promise<void>;

  insertUnlockCode(code: UnlockCode): Promise<void>;
  getUnlockCodeByLicense(licenseId: LicenseId): Promise<UnlockCode | null>;
  updateUnlockCode(code: UnlockCode): Promise<void>;

  insertProofReceipt(receipt: ProofReceipt): Promise<void>;
  getProofReceipt(id: ProofReceiptId): Promise<ProofReceipt | null>;
  listProofReceipts(): Promise<ProofReceipt[]>;

  insertFingerprint(fingerprint: Fingerprint): Promise<void>;
  listFingerprints(): Promise<Fingerprint[]>;

  insertRevocation(revocation: Revocation): Promise<void>;
  listRevocations(): Promise<Revocation[]>;

  /** Deletes every row. Used by the destructive demo seed command. */
  reset(): Promise<void>;
  close(): Promise<void>;
}
