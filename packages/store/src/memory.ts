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
  UnlockCode
} from "@my-digital/types";
import type {
  MarketplaceStore,
  SealedSecretRecord,
  StoredCheckoutSession,
  StoredIssuerRecord
} from "./interface";

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** In-memory store for tests and ephemeral demos. Not persistent. */
export class MemoryMarketplaceStore implements MarketplaceStore {
  private issuers = new Map<string, StoredIssuerRecord>();
  private custodySecrets = new Map<string, SealedSecretRecord>();
  private issuerSecrets = new Map<string, SealedSecretRecord>();
  private buyerLockedPayloads = new Map<string, { payload: Uint8Array; payloadHash: string }>();
  private checkoutSessions = new Map<string, StoredCheckoutSession>();
  private creators = new Map<string, Creator>();
  private buyers = new Map<string, Buyer>();
  private assets = new Map<string, Asset>();
  private assetVersions = new Map<string, AssetVersion>();
  private manifests = new Map<string, AssetManifest>();
  private lockedAssets = new Map<string, LockedAsset>();
  private lockedPayloads = new Map<string, Uint8Array>();
  private listings = new Map<string, Listing>();
  private purchases = new Map<string, Purchase>();
  private licenses = new Map<string, BuyerLicense>();
  private unlockCodes = new Map<string, UnlockCode>();
  private proofReceipts = new Map<string, ProofReceipt>();
  private fingerprints = new Map<string, Fingerprint>();
  private revocations = new Map<string, Revocation>();

  async putIssuer(issuer: StoredIssuerRecord): Promise<void> {
    this.issuers.set(issuer.name, clone(issuer));
  }
  async getIssuer(name: string): Promise<StoredIssuerRecord | null> {
    const found = this.issuers.get(name);
    return found ? clone(found) : null;
  }

  async insertCreator(creator: Creator): Promise<void> {
    this.creators.set(creator.id, clone(creator));
  }
  async getCreator(id: CreatorId): Promise<Creator | null> {
    const found = this.creators.get(id);
    return found ? clone(found) : null;
  }
  async listCreators(): Promise<Creator[]> {
    return [...this.creators.values()].map(clone);
  }
  async updateCreator(creator: Creator): Promise<void> {
    this.creators.set(creator.id, clone(creator));
  }

  async insertBuyer(buyer: Buyer): Promise<void> {
    this.buyers.set(buyer.id, clone(buyer));
  }
  async getBuyer(id: BuyerId): Promise<Buyer | null> {
    const found = this.buyers.get(id);
    return found ? clone(found) : null;
  }
  async getBuyerByEmailHash(emailHash: string): Promise<Buyer | null> {
    const found = [...this.buyers.values()].find((buyer) => buyer.emailHash === emailHash);
    return found ? clone(found) : null;
  }
  async listBuyers(): Promise<Buyer[]> {
    return [...this.buyers.values()].map(clone);
  }

  async insertAsset(asset: Asset): Promise<void> {
    this.assets.set(asset.id, clone(asset));
  }
  async getAsset(id: AssetId): Promise<Asset | null> {
    const found = this.assets.get(id);
    return found ? clone(found) : null;
  }
  async listAssets(): Promise<Asset[]> {
    return [...this.assets.values()].map(clone);
  }
  async updateAssetStatus(id: AssetId, status: Asset["status"]): Promise<void> {
    const found = this.assets.get(id);
    if (found) this.assets.set(id, { ...found, status });
  }

  async insertAssetVersion(version: AssetVersion, manifest: AssetManifest): Promise<void> {
    this.assetVersions.set(version.id, clone(version));
    this.manifests.set(version.id, clone(manifest));
  }
  async getAssetVersion(id: AssetVersionId): Promise<AssetVersion | null> {
    const found = this.assetVersions.get(id);
    return found ? clone(found) : null;
  }
  async getAssetManifest(id: AssetVersionId): Promise<AssetManifest | null> {
    const found = this.manifests.get(id);
    return found ? clone(found) : null;
  }
  async listAssetVersions(): Promise<AssetVersion[]> {
    return [...this.assetVersions.values()].map(clone);
  }

  async insertLockedAsset(lockedAsset: LockedAsset): Promise<void> {
    this.lockedAssets.set(lockedAsset.id, clone(lockedAsset));
  }
  async getLockedAsset(id: LockedAssetId): Promise<LockedAsset | null> {
    const found = this.lockedAssets.get(id);
    return found ? clone(found) : null;
  }
  async getLockedAssetByVersion(assetVersionId: AssetVersionId): Promise<LockedAsset | null> {
    const found = [...this.lockedAssets.values()].find(
      (entry) => entry.assetVersionId === assetVersionId
    );
    return found ? clone(found) : null;
  }

  async putLockedPayload(lockedAssetId: LockedAssetId, payload: Uint8Array): Promise<void> {
    this.lockedPayloads.set(lockedAssetId, new Uint8Array(payload));
  }
  async getLockedPayload(lockedAssetId: LockedAssetId): Promise<Uint8Array | null> {
    const found = this.lockedPayloads.get(lockedAssetId);
    return found ? new Uint8Array(found) : null;
  }

  async putCustodySecret(lockedAssetId: LockedAssetId, secret: SealedSecretRecord): Promise<void> {
    this.custodySecrets.set(lockedAssetId, clone(secret));
  }
  async getCustodySecret(lockedAssetId: LockedAssetId): Promise<SealedSecretRecord | null> {
    const found = this.custodySecrets.get(lockedAssetId);
    return found ? clone(found) : null;
  }

  async putIssuerSecret(issuerName: string, secret: SealedSecretRecord): Promise<void> {
    this.issuerSecrets.set(issuerName, clone(secret));
  }
  async getIssuerSecret(issuerName: string): Promise<SealedSecretRecord | null> {
    const found = this.issuerSecrets.get(issuerName);
    return found ? clone(found) : null;
  }

  async putBuyerLockedPayload(
    licenseId: LicenseId,
    payload: Uint8Array,
    payloadHash: string
  ): Promise<void> {
    this.buyerLockedPayloads.set(licenseId, { payload: new Uint8Array(payload), payloadHash });
  }
  async getBuyerLockedPayload(
    licenseId: LicenseId
  ): Promise<{ payload: Uint8Array; payloadHash: string } | null> {
    const found = this.buyerLockedPayloads.get(licenseId);
    return found ? { payload: new Uint8Array(found.payload), payloadHash: found.payloadHash } : null;
  }
  async findBuyerLockedPayloadByHash(
    payloadHash: string
  ): Promise<{ licenseId: LicenseId; payloadHash: string } | null> {
    for (const [licenseId, entry] of this.buyerLockedPayloads) {
      if (entry.payloadHash === payloadHash) {
        return { licenseId: licenseId as LicenseId, payloadHash };
      }
    }
    return null;
  }
  async findAssetVersionByContentHash(contentHash: string): Promise<AssetVersion | null> {
    const found = [...this.assetVersions.values()].find(
      (entry) => entry.contentHash === contentHash
    );
    return found ? clone(found) : null;
  }

  async insertListing(listing: Listing): Promise<void> {
    this.listings.set(listing.id, clone(listing));
  }
  async getListing(id: ListingId): Promise<Listing | null> {
    const found = this.listings.get(id);
    return found ? clone(found) : null;
  }
  async listListings(): Promise<Listing[]> {
    return [...this.listings.values()].map(clone);
  }
  async updateListing(listing: Listing): Promise<void> {
    this.listings.set(listing.id, clone(listing));
  }
  async deleteListingCascade(id: ListingId): Promise<void> {
    const listing = this.listings.get(id);
    if (!listing) return;
    this.listings.delete(id);
    // Only tear down the asset chain if no other listing still points at it.
    const assetStillUsed = [...this.listings.values()].some(
      (entry) => entry.assetId === listing.assetId
    );
    if (assetStillUsed) return;
    for (const version of [...this.assetVersions.values()].filter(
      (entry) => entry.assetId === listing.assetId
    )) {
      const locked = [...this.lockedAssets.values()].find(
        (entry) => entry.assetVersionId === version.id
      );
      if (locked) {
        this.lockedPayloads.delete(locked.id);
        this.custodySecrets.delete(locked.id);
        this.lockedAssets.delete(locked.id);
      }
      this.assetVersions.delete(version.id);
      this.manifests.delete(version.id);
    }
    this.assets.delete(listing.assetId);
  }

  async insertPurchase(purchase: Purchase): Promise<void> {
    this.purchases.set(purchase.id, clone(purchase));
  }
  async getPurchase(id: PurchaseId): Promise<Purchase | null> {
    const found = this.purchases.get(id);
    return found ? clone(found) : null;
  }
  async listPurchases(): Promise<Purchase[]> {
    return [...this.purchases.values()].map(clone);
  }
  async updatePurchaseStatus(
    id: PurchaseId,
    status: Purchase["status"],
    paidAt?: string
  ): Promise<void> {
    const found = this.purchases.get(id);
    if (found) {
      this.purchases.set(id, {
        ...found,
        status,
        ...(paidAt !== undefined ? { paidAt } : {})
      });
    }
  }
  async findPurchaseByProviderReference(providerReference: string): Promise<Purchase | null> {
    const found = [...this.purchases.values()].find(
      (entry) => entry.paymentProviderReference === providerReference
    );
    return found ? clone(found) : null;
  }

  async insertCheckoutSession(session: StoredCheckoutSession): Promise<void> {
    this.checkoutSessions.set(session.id, clone(session));
  }
  async getCheckoutSessionByPurchase(
    purchaseId: PurchaseId
  ): Promise<StoredCheckoutSession | null> {
    const found = [...this.checkoutSessions.values()].find(
      (entry) => entry.purchaseId === purchaseId
    );
    return found ? clone(found) : null;
  }
  async getCheckoutSessionByProviderReference(
    providerReference: string
  ): Promise<StoredCheckoutSession | null> {
    const found = [...this.checkoutSessions.values()].find(
      (entry) => entry.providerReference === providerReference
    );
    return found ? clone(found) : null;
  }
  async updateCheckoutSessionStatus(
    id: CheckoutSessionId,
    status: CheckoutSession["status"],
    completedAt?: string
  ): Promise<void> {
    const found = this.checkoutSessions.get(id);
    if (found) {
      this.checkoutSessions.set(id, {
        ...found,
        status,
        ...(completedAt !== undefined ? { completedAt } : {})
      });
    }
  }

  async insertLicense(license: BuyerLicense): Promise<void> {
    this.licenses.set(license.id, clone(license));
  }
  async getLicense(id: LicenseId): Promise<BuyerLicense | null> {
    const found = this.licenses.get(id);
    return found ? clone(found) : null;
  }
  async listLicenses(): Promise<BuyerLicense[]> {
    return [...this.licenses.values()].map(clone);
  }
  async setLicenseRevoked(id: LicenseId, revokedAt: string): Promise<void> {
    const found = this.licenses.get(id);
    if (found) this.licenses.set(id, { ...found, revokedAt });
  }

  async insertUnlockCode(code: UnlockCode): Promise<void> {
    this.unlockCodes.set(code.id, clone(code));
  }
  async getUnlockCodeByLicense(licenseId: LicenseId): Promise<UnlockCode | null> {
    const found = [...this.unlockCodes.values()].find((entry) => entry.licenseId === licenseId);
    return found ? clone(found) : null;
  }
  async updateUnlockCode(code: UnlockCode): Promise<void> {
    this.unlockCodes.set(code.id, clone(code));
  }

  async insertProofReceipt(receipt: ProofReceipt): Promise<void> {
    this.proofReceipts.set(receipt.id, clone(receipt));
  }
  async getProofReceipt(id: ProofReceiptId): Promise<ProofReceipt | null> {
    const found = this.proofReceipts.get(id);
    return found ? clone(found) : null;
  }
  async listProofReceipts(): Promise<ProofReceipt[]> {
    return [...this.proofReceipts.values()].map(clone);
  }

  async insertFingerprint(fingerprint: Fingerprint): Promise<void> {
    this.fingerprints.set(fingerprint.id, clone(fingerprint));
  }
  async listFingerprints(): Promise<Fingerprint[]> {
    return [...this.fingerprints.values()].map(clone);
  }

  async insertRevocation(revocation: Revocation): Promise<void> {
    this.revocations.set(revocation.id, clone(revocation));
  }
  async listRevocations(): Promise<Revocation[]> {
    return [...this.revocations.values()].map(clone);
  }

  async reset(): Promise<void> {
    this.checkoutSessions.clear();
    this.custodySecrets.clear();
    this.issuerSecrets.clear();
    this.buyerLockedPayloads.clear();
    this.issuers.clear();
    this.creators.clear();
    this.buyers.clear();
    this.assets.clear();
    this.assetVersions.clear();
    this.manifests.clear();
    this.lockedAssets.clear();
    this.lockedPayloads.clear();
    this.listings.clear();
    this.purchases.clear();
    this.licenses.clear();
    this.unlockCodes.clear();
    this.proofReceipts.clear();
    this.fingerprints.clear();
    this.revocations.clear();
  }

  async close(): Promise<void> {
    // Nothing to release.
  }
}
