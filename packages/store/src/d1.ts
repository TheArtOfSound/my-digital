import type {
  AssetId,
  AssetManifest,
  AssetVersion,
  AssetVersionId,
  Asset,
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
import { eq } from "drizzle-orm";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import type { MarketplaceStore, SealedSecretRecord, StoredCheckoutSession, StoredIssuerRecord } from "./interface";
import {
  rowToAsset,
  rowToAssetVersion,
  rowToBuyer,
  rowToCheckoutSession,
  rowToCreator,
  rowToFingerprint,
  rowToLicense,
  rowToListing,
  rowToLockedAsset,
  rowToProofReceipt,
  rowToPurchase,
  rowToRevocation,
  rowToUnlockCode
} from "./row-mappers";
import * as schema from "./schema";

/**
 * Minimal structural type for a Cloudflare D1 binding, so this package does
 * not need @cloudflare/workers-types as a dependency.
 */
export interface D1DatabaseLike {
  prepare(query: string): unknown;
  batch(statements: unknown[]): Promise<unknown[]>;
  exec(query: string): Promise<unknown>;
  dump?(): Promise<ArrayBuffer>;
}

/**
 * Cloudflare D1 implementation of MarketplaceStore. Same Drizzle schema and
 * row mappers as the better-sqlite3 store; the only difference is the async
 * D1 driver. Blob columns use Buffer (provided by the Workers nodejs_compat
 * flag), matching the better-sqlite3 store's representation exactly.
 * Migrations are applied out of band via `wrangler d1 migrations apply`.
 */
export class D1MarketplaceStore implements MarketplaceStore {
  private readonly db: DrizzleD1Database;

  constructor(d1: D1DatabaseLike) {
    this.db = drizzle(d1 as never);
  }

  async putIssuer(issuer: StoredIssuerRecord): Promise<void> {
    await this.db
      .insert(schema.issuers)
      .values(issuer)
      .onConflictDoUpdate({
        target: schema.issuers.name,
        set: { publicKeyB64: issuer.publicKeyB64, createdAt: issuer.createdAt }
      });
  }
  async getIssuer(name: string): Promise<StoredIssuerRecord | null> {
    const row = await this.db
      .select()
      .from(schema.issuers)
      .where(eq(schema.issuers.name, name))
      .get();
    return row ?? null;
  }

  async insertCreator(creator: Creator): Promise<void> {
    await this.db
      .insert(schema.creators)
      .values({ ...creator, publicSigningKey: creator.publicSigningKey ?? null });
  }
  async getCreator(id: CreatorId): Promise<Creator | null> {
    const row = await this.db.select().from(schema.creators).where(eq(schema.creators.id, id)).get();
    return row ? rowToCreator(row) : null;
  }
  async listCreators(): Promise<Creator[]> {
    return (await this.db.select().from(schema.creators).all()).map(rowToCreator);
  }

  async insertBuyer(buyer: Buyer): Promise<void> {
    await this.db
      .insert(schema.buyers)
      .values({ ...buyer, displayName: buyer.displayName ?? null });
  }
  async getBuyer(id: BuyerId): Promise<Buyer | null> {
    const row = await this.db.select().from(schema.buyers).where(eq(schema.buyers.id, id)).get();
    return row ? rowToBuyer(row) : null;
  }
  async getBuyerByEmailHash(emailHash: string): Promise<Buyer | null> {
    const row = await this.db
      .select()
      .from(schema.buyers)
      .where(eq(schema.buyers.emailHash, emailHash))
      .get();
    return row ? rowToBuyer(row) : null;
  }
  async listBuyers(): Promise<Buyer[]> {
    return (await this.db.select().from(schema.buyers).all()).map(rowToBuyer);
  }

  async insertAsset(asset: Asset): Promise<void> {
    await this.db.insert(schema.assets).values(asset);
  }
  async getAsset(id: AssetId): Promise<Asset | null> {
    const row = await this.db.select().from(schema.assets).where(eq(schema.assets.id, id)).get();
    return row ? rowToAsset(row) : null;
  }
  async listAssets(): Promise<Asset[]> {
    return (await this.db.select().from(schema.assets).all()).map(rowToAsset);
  }
  async updateAssetStatus(id: AssetId, status: Asset["status"]): Promise<void> {
    await this.db.update(schema.assets).set({ status }).where(eq(schema.assets.id, id));
  }

  async insertAssetVersion(version: AssetVersion, manifest: AssetManifest): Promise<void> {
    await this.db.insert(schema.assetVersions).values({
      ...version,
      changelog: version.changelog ?? null,
      manifestJson: JSON.stringify(manifest)
    });
  }
  async getAssetVersion(id: AssetVersionId): Promise<AssetVersion | null> {
    const row = await this.db
      .select()
      .from(schema.assetVersions)
      .where(eq(schema.assetVersions.id, id))
      .get();
    return row ? rowToAssetVersion(row) : null;
  }
  async getAssetManifest(id: AssetVersionId): Promise<AssetManifest | null> {
    const row = await this.db
      .select()
      .from(schema.assetVersions)
      .where(eq(schema.assetVersions.id, id))
      .get();
    return row ? (JSON.parse(row.manifestJson) as AssetManifest) : null;
  }
  async listAssetVersions(): Promise<AssetVersion[]> {
    return (await this.db.select().from(schema.assetVersions).all()).map(rowToAssetVersion);
  }

  async insertLockedAsset(lockedAsset: LockedAsset): Promise<void> {
    await this.db
      .insert(schema.lockedAssets)
      .values({ ...lockedAsset, storageUri: lockedAsset.storageUri ?? null });
  }
  async getLockedAsset(id: LockedAssetId): Promise<LockedAsset | null> {
    const row = await this.db
      .select()
      .from(schema.lockedAssets)
      .where(eq(schema.lockedAssets.id, id))
      .get();
    return row ? rowToLockedAsset(row) : null;
  }
  async getLockedAssetByVersion(assetVersionId: AssetVersionId): Promise<LockedAsset | null> {
    const row = await this.db
      .select()
      .from(schema.lockedAssets)
      .where(eq(schema.lockedAssets.assetVersionId, assetVersionId))
      .get();
    return row ? rowToLockedAsset(row) : null;
  }

  async putLockedPayload(lockedAssetId: LockedAssetId, payload: Uint8Array): Promise<void> {
    await this.db
      .insert(schema.lockedPayloads)
      .values({ lockedAssetId, payload: Buffer.from(payload) })
      .onConflictDoUpdate({
        target: schema.lockedPayloads.lockedAssetId,
        set: { payload: Buffer.from(payload) }
      });
  }
  async getLockedPayload(lockedAssetId: LockedAssetId): Promise<Uint8Array | null> {
    const row = await this.db
      .select()
      .from(schema.lockedPayloads)
      .where(eq(schema.lockedPayloads.lockedAssetId, lockedAssetId))
      .get();
    return row ? new Uint8Array(row.payload) : null;
  }

  async putCustodySecret(lockedAssetId: LockedAssetId, secret: SealedSecretRecord): Promise<void> {
    await this.db
      .insert(schema.custodySecrets)
      .values({ lockedAssetId, ...secret })
      .onConflictDoUpdate({
        target: schema.custodySecrets.lockedAssetId,
        set: { nonceB64: secret.nonceB64, sealedB64: secret.sealedB64, createdAt: secret.createdAt }
      });
  }
  async getCustodySecret(lockedAssetId: LockedAssetId): Promise<SealedSecretRecord | null> {
    const row = await this.db
      .select()
      .from(schema.custodySecrets)
      .where(eq(schema.custodySecrets.lockedAssetId, lockedAssetId))
      .get();
    return row
      ? { nonceB64: row.nonceB64, sealedB64: row.sealedB64, createdAt: row.createdAt }
      : null;
  }

  async putIssuerSecret(issuerName: string, secret: SealedSecretRecord): Promise<void> {
    await this.db
      .insert(schema.issuerSecrets)
      .values({ issuerName, ...secret })
      .onConflictDoUpdate({
        target: schema.issuerSecrets.issuerName,
        set: { nonceB64: secret.nonceB64, sealedB64: secret.sealedB64, createdAt: secret.createdAt }
      });
  }
  async getIssuerSecret(issuerName: string): Promise<SealedSecretRecord | null> {
    const row = await this.db
      .select()
      .from(schema.issuerSecrets)
      .where(eq(schema.issuerSecrets.issuerName, issuerName))
      .get();
    return row
      ? { nonceB64: row.nonceB64, sealedB64: row.sealedB64, createdAt: row.createdAt }
      : null;
  }

  async putBuyerLockedPayload(
    licenseId: LicenseId,
    payload: Uint8Array,
    payloadHash: string
  ): Promise<void> {
    await this.db
      .insert(schema.buyerLockedPayloads)
      .values({
        licenseId,
        payload: Buffer.from(payload),
        payloadHash,
        createdAt: new Date().toISOString()
      })
      .onConflictDoUpdate({
        target: schema.buyerLockedPayloads.licenseId,
        set: { payload: Buffer.from(payload), payloadHash }
      });
  }
  async getBuyerLockedPayload(
    licenseId: LicenseId
  ): Promise<{ payload: Uint8Array; payloadHash: string } | null> {
    const row = await this.db
      .select()
      .from(schema.buyerLockedPayloads)
      .where(eq(schema.buyerLockedPayloads.licenseId, licenseId))
      .get();
    return row
      ? { payload: new Uint8Array(row.payload), payloadHash: row.payloadHash }
      : null;
  }
  async findBuyerLockedPayloadByHash(
    payloadHash: string
  ): Promise<{ licenseId: LicenseId; payloadHash: string } | null> {
    const row = await this.db
      .select({
        licenseId: schema.buyerLockedPayloads.licenseId,
        payloadHash: schema.buyerLockedPayloads.payloadHash
      })
      .from(schema.buyerLockedPayloads)
      .where(eq(schema.buyerLockedPayloads.payloadHash, payloadHash))
      .get();
    return row ? { licenseId: row.licenseId as LicenseId, payloadHash: row.payloadHash } : null;
  }
  async findAssetVersionByContentHash(contentHash: string): Promise<AssetVersion | null> {
    const row = await this.db
      .select()
      .from(schema.assetVersions)
      .where(eq(schema.assetVersions.contentHash, contentHash))
      .get();
    return row ? rowToAssetVersion(row) : null;
  }

  async insertListing(listing: Listing): Promise<void> {
    await this.db
      .insert(schema.listings)
      .values({ ...listing, licenseTerms: JSON.stringify(listing.licenseTerms) });
  }
  async getListing(id: ListingId): Promise<Listing | null> {
    const row = await this.db.select().from(schema.listings).where(eq(schema.listings.id, id)).get();
    return row ? rowToListing(row) : null;
  }
  async listListings(): Promise<Listing[]> {
    return (await this.db.select().from(schema.listings).all()).map(rowToListing);
  }

  async insertPurchase(purchase: Purchase): Promise<void> {
    await this.db
      .insert(schema.purchases)
      .values({ ...purchase, paidAt: purchase.paidAt ?? null });
  }
  async getPurchase(id: PurchaseId): Promise<Purchase | null> {
    const row = await this.db
      .select()
      .from(schema.purchases)
      .where(eq(schema.purchases.id, id))
      .get();
    return row ? rowToPurchase(row) : null;
  }
  async listPurchases(): Promise<Purchase[]> {
    return (await this.db.select().from(schema.purchases).all()).map(rowToPurchase);
  }
  async updatePurchaseStatus(
    id: PurchaseId,
    status: Purchase["status"],
    paidAt?: string
  ): Promise<void> {
    await this.db
      .update(schema.purchases)
      .set({ status, ...(paidAt !== undefined ? { paidAt } : {}) })
      .where(eq(schema.purchases.id, id));
  }
  async findPurchaseByProviderReference(providerReference: string): Promise<Purchase | null> {
    const row = await this.db
      .select()
      .from(schema.purchases)
      .where(eq(schema.purchases.paymentProviderReference, providerReference))
      .get();
    return row ? rowToPurchase(row) : null;
  }

  async insertCheckoutSession(session: StoredCheckoutSession): Promise<void> {
    await this.db.insert(schema.checkoutSessions).values({
      ...session,
      checkoutUrl: session.checkoutUrl ?? null,
      completedAt: session.completedAt ?? null
    });
  }
  async getCheckoutSessionByPurchase(
    purchaseId: PurchaseId
  ): Promise<StoredCheckoutSession | null> {
    const row = await this.db
      .select()
      .from(schema.checkoutSessions)
      .where(eq(schema.checkoutSessions.purchaseId, purchaseId))
      .get();
    return row ? rowToCheckoutSession(row) : null;
  }
  async getCheckoutSessionByProviderReference(
    providerReference: string
  ): Promise<StoredCheckoutSession | null> {
    const row = await this.db
      .select()
      .from(schema.checkoutSessions)
      .where(eq(schema.checkoutSessions.providerReference, providerReference))
      .get();
    return row ? rowToCheckoutSession(row) : null;
  }
  async updateCheckoutSessionStatus(
    id: CheckoutSessionId,
    status: CheckoutSession["status"],
    completedAt?: string
  ): Promise<void> {
    await this.db
      .update(schema.checkoutSessions)
      .set({ status, ...(completedAt !== undefined ? { completedAt } : {}) })
      .where(eq(schema.checkoutSessions.id, id));
  }

  async insertLicense(license: BuyerLicense): Promise<void> {
    await this.db.insert(schema.licenses).values({
      ...license,
      terms: JSON.stringify(license.terms),
      allowedUses: JSON.stringify(license.allowedUses),
      expiresAt: license.expiresAt ?? null,
      unlockLimit: license.unlockLimit ?? null,
      revokedAt: license.revokedAt ?? null
    });
  }
  async getLicense(id: LicenseId): Promise<BuyerLicense | null> {
    const row = await this.db.select().from(schema.licenses).where(eq(schema.licenses.id, id)).get();
    return row ? rowToLicense(row) : null;
  }
  async listLicenses(): Promise<BuyerLicense[]> {
    return (await this.db.select().from(schema.licenses).all()).map(rowToLicense);
  }
  async setLicenseRevoked(id: LicenseId, revokedAt: string): Promise<void> {
    await this.db.update(schema.licenses).set({ revokedAt }).where(eq(schema.licenses.id, id));
  }

  async insertUnlockCode(code: UnlockCode): Promise<void> {
    await this.db.insert(schema.unlockCodes).values({
      ...code,
      redeemedAt: code.redeemedAt ?? null,
      maxRedemptions: code.maxRedemptions ?? null
    });
  }
  async getUnlockCodeByLicense(licenseId: LicenseId): Promise<UnlockCode | null> {
    const row = await this.db
      .select()
      .from(schema.unlockCodes)
      .where(eq(schema.unlockCodes.licenseId, licenseId))
      .get();
    return row ? rowToUnlockCode(row) : null;
  }
  async updateUnlockCode(code: UnlockCode): Promise<void> {
    await this.db
      .update(schema.unlockCodes)
      .set({
        codeHash: code.codeHash,
        redeemedAt: code.redeemedAt ?? null,
        redemptionCount: code.redemptionCount,
        maxRedemptions: code.maxRedemptions ?? null,
        status: code.status
      })
      .where(eq(schema.unlockCodes.id, code.id));
  }

  async insertProofReceipt(receipt: ProofReceipt): Promise<void> {
    await this.db
      .insert(schema.proofReceipts)
      .values({ ...receipt, verificationUrl: receipt.verificationUrl ?? null });
  }
  async getProofReceipt(id: ProofReceiptId): Promise<ProofReceipt | null> {
    const row = await this.db
      .select()
      .from(schema.proofReceipts)
      .where(eq(schema.proofReceipts.id, id))
      .get();
    return row ? rowToProofReceipt(row) : null;
  }
  async listProofReceipts(): Promise<ProofReceipt[]> {
    return (await this.db.select().from(schema.proofReceipts).all()).map(rowToProofReceipt);
  }

  async insertFingerprint(fingerprint: Fingerprint): Promise<void> {
    await this.db.insert(schema.fingerprints).values(fingerprint);
  }
  async listFingerprints(): Promise<Fingerprint[]> {
    return (await this.db.select().from(schema.fingerprints).all()).map(rowToFingerprint);
  }

  async insertRevocation(revocation: Revocation): Promise<void> {
    await this.db.insert(schema.revocations).values(revocation);
  }
  async listRevocations(): Promise<Revocation[]> {
    return (await this.db.select().from(schema.revocations).all()).map(rowToRevocation);
  }

  async reset(): Promise<void> {
    // Delete children before parents to respect foreign keys.
    await this.db.delete(schema.checkoutSessions);
    await this.db.delete(schema.custodySecrets);
    await this.db.delete(schema.issuerSecrets);
    await this.db.delete(schema.buyerLockedPayloads);
    await this.db.delete(schema.revocations);
    await this.db.delete(schema.fingerprints);
    await this.db.delete(schema.proofReceipts);
    await this.db.delete(schema.unlockCodes);
    await this.db.delete(schema.licenses);
    await this.db.delete(schema.purchases);
    await this.db.delete(schema.listings);
    await this.db.delete(schema.lockedPayloads);
    await this.db.delete(schema.lockedAssets);
    await this.db.delete(schema.assetVersions);
    await this.db.delete(schema.assets);
    await this.db.delete(schema.buyers);
    await this.db.delete(schema.creators);
    await this.db.delete(schema.issuers);
  }

  async close(): Promise<void> {
    // D1 connections are managed by the Workers runtime.
  }
}
