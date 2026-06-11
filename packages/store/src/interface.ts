import type {
  Asset,
  AssetId,
  AssetManifest,
  AssetVersion,
  AssetVersionId,
  Buyer,
  BuyerId,
  BuyerLicense,
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
  UnlockCode
} from "@my-digital/types";

/**
 * Issuer record persisted for verification. Only the public key is stored;
 * private signing keys must never enter the marketplace database.
 */
export interface StoredIssuerRecord {
  name: string;
  publicKeyB64: string;
  createdAt: string;
}

export interface MarketplaceStore {
  putIssuer(issuer: StoredIssuerRecord): Promise<void>;
  getIssuer(name: string): Promise<StoredIssuerRecord | null>;

  insertCreator(creator: Creator): Promise<void>;
  getCreator(id: CreatorId): Promise<Creator | null>;
  listCreators(): Promise<Creator[]>;

  insertBuyer(buyer: Buyer): Promise<void>;
  getBuyer(id: BuyerId): Promise<Buyer | null>;
  getBuyerByEmailHash(emailHash: string): Promise<Buyer | null>;
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

  insertListing(listing: Listing): Promise<void>;
  getListing(id: ListingId): Promise<Listing | null>;
  listListings(): Promise<Listing[]>;

  insertPurchase(purchase: Purchase): Promise<void>;
  getPurchase(id: PurchaseId): Promise<Purchase | null>;
  listPurchases(): Promise<Purchase[]>;

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
