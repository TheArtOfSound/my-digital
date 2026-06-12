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
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  MarketplaceStore,
  SealedSecretRecord,
  StoredCheckoutSession,
  StoredIssuerRecord
} from "./interface";
import * as schema from "./schema";

const MIGRATIONS_FOLDER = join(dirname(fileURLToPath(import.meta.url)), "..", "drizzle");

/** Spread helper: include the property only when the column is non-null. */
function opt<K extends string, V>(key: K, value: V | null): { [P in K]: V } | Record<never, never> {
  return value === null ? {} : ({ [key]: value } as { [P in K]: V });
}

type CreatorRow = typeof schema.creators.$inferSelect;
type BuyerRow = typeof schema.buyers.$inferSelect;
type AssetRow = typeof schema.assets.$inferSelect;
type AssetVersionRow = typeof schema.assetVersions.$inferSelect;
type LockedAssetRow = typeof schema.lockedAssets.$inferSelect;
type ListingRow = typeof schema.listings.$inferSelect;
type PurchaseRow = typeof schema.purchases.$inferSelect;
type LicenseRow = typeof schema.licenses.$inferSelect;
type UnlockCodeRow = typeof schema.unlockCodes.$inferSelect;
type ProofReceiptRow = typeof schema.proofReceipts.$inferSelect;
type FingerprintRow = typeof schema.fingerprints.$inferSelect;
type RevocationRow = typeof schema.revocations.$inferSelect;

function rowToCreator(row: CreatorRow): Creator {
  return {
    id: row.id as CreatorId,
    displayName: row.displayName,
    handle: row.handle,
    emailHash: row.emailHash,
    createdAt: row.createdAt,
    verificationStatus: row.verificationStatus as Creator["verificationStatus"],
    ...opt("publicSigningKey", row.publicSigningKey)
  };
}

function rowToBuyer(row: BuyerRow): Buyer {
  return {
    id: row.id as BuyerId,
    emailHash: row.emailHash,
    createdAt: row.createdAt,
    ...opt("displayName", row.displayName)
  };
}

function rowToAsset(row: AssetRow): Asset {
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

function rowToAssetVersion(row: AssetVersionRow): AssetVersion {
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

function rowToLockedAsset(row: LockedAssetRow): LockedAsset {
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

function rowToListing(row: ListingRow): Listing {
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

type CheckoutSessionRow = typeof schema.checkoutSessions.$inferSelect;

function rowToCheckoutSession(row: CheckoutSessionRow): StoredCheckoutSession {
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

function rowToPurchase(row: PurchaseRow): Purchase {
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

function rowToLicense(row: LicenseRow): BuyerLicense {
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

function rowToUnlockCode(row: UnlockCodeRow): UnlockCode {
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

function rowToProofReceipt(row: ProofReceiptRow): ProofReceipt {
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

function rowToFingerprint(row: FingerprintRow): Fingerprint {
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

function rowToRevocation(row: RevocationRow): Revocation {
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

export interface OpenSqliteStoreOptions {
  /** File path for the database, or ":memory:" for an ephemeral database. */
  path: string;
}

export function openSqliteStore(options: OpenSqliteStoreOptions): SqliteMarketplaceStore {
  if (options.path !== ":memory:") {
    mkdirSync(dirname(options.path), { recursive: true });
  }
  const sqlite = new Database(options.path);
  if (options.path !== ":memory:") {
    sqlite.pragma("journal_mode = WAL");
  }
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return new SqliteMarketplaceStore(db, sqlite);
}

export class SqliteMarketplaceStore implements MarketplaceStore {
  constructor(
    private readonly db: BetterSQLite3Database,
    private readonly sqlite: Database.Database
  ) {}

  async putIssuer(issuer: StoredIssuerRecord): Promise<void> {
    this.db
      .insert(schema.issuers)
      .values(issuer)
      .onConflictDoUpdate({
        target: schema.issuers.name,
        set: { publicKeyB64: issuer.publicKeyB64, createdAt: issuer.createdAt }
      })
      .run();
  }
  async getIssuer(name: string): Promise<StoredIssuerRecord | null> {
    const row = this.db
      .select()
      .from(schema.issuers)
      .where(eq(schema.issuers.name, name))
      .get();
    return row ?? null;
  }

  async insertCreator(creator: Creator): Promise<void> {
    this.db
      .insert(schema.creators)
      .values({ ...creator, publicSigningKey: creator.publicSigningKey ?? null })
      .run();
  }
  async getCreator(id: CreatorId): Promise<Creator | null> {
    const row = this.db.select().from(schema.creators).where(eq(schema.creators.id, id)).get();
    return row ? rowToCreator(row) : null;
  }
  async listCreators(): Promise<Creator[]> {
    return this.db.select().from(schema.creators).all().map(rowToCreator);
  }

  async insertBuyer(buyer: Buyer): Promise<void> {
    this.db
      .insert(schema.buyers)
      .values({ ...buyer, displayName: buyer.displayName ?? null })
      .run();
  }
  async getBuyer(id: BuyerId): Promise<Buyer | null> {
    const row = this.db.select().from(schema.buyers).where(eq(schema.buyers.id, id)).get();
    return row ? rowToBuyer(row) : null;
  }
  async getBuyerByEmailHash(emailHash: string): Promise<Buyer | null> {
    const row = this.db
      .select()
      .from(schema.buyers)
      .where(eq(schema.buyers.emailHash, emailHash))
      .get();
    return row ? rowToBuyer(row) : null;
  }
  async listBuyers(): Promise<Buyer[]> {
    return this.db.select().from(schema.buyers).all().map(rowToBuyer);
  }

  async insertAsset(asset: Asset): Promise<void> {
    this.db.insert(schema.assets).values(asset).run();
  }
  async getAsset(id: AssetId): Promise<Asset | null> {
    const row = this.db.select().from(schema.assets).where(eq(schema.assets.id, id)).get();
    return row ? rowToAsset(row) : null;
  }
  async listAssets(): Promise<Asset[]> {
    return this.db.select().from(schema.assets).all().map(rowToAsset);
  }
  async updateAssetStatus(id: AssetId, status: Asset["status"]): Promise<void> {
    this.db.update(schema.assets).set({ status }).where(eq(schema.assets.id, id)).run();
  }

  async insertAssetVersion(version: AssetVersion, manifest: AssetManifest): Promise<void> {
    this.db
      .insert(schema.assetVersions)
      .values({
        ...version,
        changelog: version.changelog ?? null,
        manifestJson: JSON.stringify(manifest)
      })
      .run();
  }
  async getAssetVersion(id: AssetVersionId): Promise<AssetVersion | null> {
    const row = this.db
      .select()
      .from(schema.assetVersions)
      .where(eq(schema.assetVersions.id, id))
      .get();
    return row ? rowToAssetVersion(row) : null;
  }
  async getAssetManifest(id: AssetVersionId): Promise<AssetManifest | null> {
    const row = this.db
      .select()
      .from(schema.assetVersions)
      .where(eq(schema.assetVersions.id, id))
      .get();
    return row ? (JSON.parse(row.manifestJson) as AssetManifest) : null;
  }
  async listAssetVersions(): Promise<AssetVersion[]> {
    return this.db.select().from(schema.assetVersions).all().map(rowToAssetVersion);
  }

  async insertLockedAsset(lockedAsset: LockedAsset): Promise<void> {
    this.db
      .insert(schema.lockedAssets)
      .values({ ...lockedAsset, storageUri: lockedAsset.storageUri ?? null })
      .run();
  }
  async getLockedAsset(id: LockedAssetId): Promise<LockedAsset | null> {
    const row = this.db
      .select()
      .from(schema.lockedAssets)
      .where(eq(schema.lockedAssets.id, id))
      .get();
    return row ? rowToLockedAsset(row) : null;
  }
  async getLockedAssetByVersion(assetVersionId: AssetVersionId): Promise<LockedAsset | null> {
    const row = this.db
      .select()
      .from(schema.lockedAssets)
      .where(eq(schema.lockedAssets.assetVersionId, assetVersionId))
      .get();
    return row ? rowToLockedAsset(row) : null;
  }

  async putLockedPayload(lockedAssetId: LockedAssetId, payload: Uint8Array): Promise<void> {
    this.db
      .insert(schema.lockedPayloads)
      .values({ lockedAssetId, payload: Buffer.from(payload) })
      .onConflictDoUpdate({
        target: schema.lockedPayloads.lockedAssetId,
        set: { payload: Buffer.from(payload) }
      })
      .run();
  }
  async getLockedPayload(lockedAssetId: LockedAssetId): Promise<Uint8Array | null> {
    const row = this.db
      .select()
      .from(schema.lockedPayloads)
      .where(eq(schema.lockedPayloads.lockedAssetId, lockedAssetId))
      .get();
    return row ? new Uint8Array(row.payload) : null;
  }

  async putCustodySecret(lockedAssetId: LockedAssetId, secret: SealedSecretRecord): Promise<void> {
    this.db
      .insert(schema.custodySecrets)
      .values({ lockedAssetId, ...secret })
      .onConflictDoUpdate({
        target: schema.custodySecrets.lockedAssetId,
        set: { nonceB64: secret.nonceB64, sealedB64: secret.sealedB64, createdAt: secret.createdAt }
      })
      .run();
  }
  async getCustodySecret(lockedAssetId: LockedAssetId): Promise<SealedSecretRecord | null> {
    const row = this.db
      .select()
      .from(schema.custodySecrets)
      .where(eq(schema.custodySecrets.lockedAssetId, lockedAssetId))
      .get();
    return row
      ? { nonceB64: row.nonceB64, sealedB64: row.sealedB64, createdAt: row.createdAt }
      : null;
  }

  async putIssuerSecret(issuerName: string, secret: SealedSecretRecord): Promise<void> {
    this.db
      .insert(schema.issuerSecrets)
      .values({ issuerName, ...secret })
      .onConflictDoUpdate({
        target: schema.issuerSecrets.issuerName,
        set: { nonceB64: secret.nonceB64, sealedB64: secret.sealedB64, createdAt: secret.createdAt }
      })
      .run();
  }
  async getIssuerSecret(issuerName: string): Promise<SealedSecretRecord | null> {
    const row = this.db
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
    this.db
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
      })
      .run();
  }
  async getBuyerLockedPayload(
    licenseId: LicenseId
  ): Promise<{ payload: Uint8Array; payloadHash: string } | null> {
    const row = this.db
      .select()
      .from(schema.buyerLockedPayloads)
      .where(eq(schema.buyerLockedPayloads.licenseId, licenseId))
      .get();
    return row ? { payload: new Uint8Array(row.payload), payloadHash: row.payloadHash } : null;
  }
  async findBuyerLockedPayloadByHash(
    payloadHash: string
  ): Promise<{ licenseId: LicenseId; payloadHash: string } | null> {
    const row = this.db
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
    const row = this.db
      .select()
      .from(schema.assetVersions)
      .where(eq(schema.assetVersions.contentHash, contentHash))
      .get();
    return row ? rowToAssetVersion(row) : null;
  }

  async insertListing(listing: Listing): Promise<void> {
    this.db
      .insert(schema.listings)
      .values({ ...listing, licenseTerms: JSON.stringify(listing.licenseTerms) })
      .run();
  }
  async getListing(id: ListingId): Promise<Listing | null> {
    const row = this.db.select().from(schema.listings).where(eq(schema.listings.id, id)).get();
    return row ? rowToListing(row) : null;
  }
  async listListings(): Promise<Listing[]> {
    return this.db.select().from(schema.listings).all().map(rowToListing);
  }

  async insertPurchase(purchase: Purchase): Promise<void> {
    this.db
      .insert(schema.purchases)
      .values({ ...purchase, paidAt: purchase.paidAt ?? null })
      .run();
  }
  async getPurchase(id: PurchaseId): Promise<Purchase | null> {
    const row = this.db.select().from(schema.purchases).where(eq(schema.purchases.id, id)).get();
    return row ? rowToPurchase(row) : null;
  }
  async listPurchases(): Promise<Purchase[]> {
    return this.db.select().from(schema.purchases).all().map(rowToPurchase);
  }
  async updatePurchaseStatus(
    id: PurchaseId,
    status: Purchase["status"],
    paidAt?: string
  ): Promise<void> {
    this.db
      .update(schema.purchases)
      .set({ status, ...(paidAt !== undefined ? { paidAt } : {}) })
      .where(eq(schema.purchases.id, id))
      .run();
  }
  async findPurchaseByProviderReference(providerReference: string): Promise<Purchase | null> {
    const row = this.db
      .select()
      .from(schema.purchases)
      .where(eq(schema.purchases.paymentProviderReference, providerReference))
      .get();
    return row ? rowToPurchase(row) : null;
  }

  async insertCheckoutSession(session: StoredCheckoutSession): Promise<void> {
    this.db
      .insert(schema.checkoutSessions)
      .values({
        ...session,
        checkoutUrl: session.checkoutUrl ?? null,
        completedAt: session.completedAt ?? null
      })
      .run();
  }
  async getCheckoutSessionByPurchase(
    purchaseId: PurchaseId
  ): Promise<StoredCheckoutSession | null> {
    const row = this.db
      .select()
      .from(schema.checkoutSessions)
      .where(eq(schema.checkoutSessions.purchaseId, purchaseId))
      .get();
    return row ? rowToCheckoutSession(row) : null;
  }
  async getCheckoutSessionByProviderReference(
    providerReference: string
  ): Promise<StoredCheckoutSession | null> {
    const row = this.db
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
    this.db
      .update(schema.checkoutSessions)
      .set({ status, ...(completedAt !== undefined ? { completedAt } : {}) })
      .where(eq(schema.checkoutSessions.id, id))
      .run();
  }

  async insertLicense(license: BuyerLicense): Promise<void> {
    this.db
      .insert(schema.licenses)
      .values({
        ...license,
        terms: JSON.stringify(license.terms),
        allowedUses: JSON.stringify(license.allowedUses),
        expiresAt: license.expiresAt ?? null,
        unlockLimit: license.unlockLimit ?? null,
        revokedAt: license.revokedAt ?? null
      })
      .run();
  }
  async getLicense(id: LicenseId): Promise<BuyerLicense | null> {
    const row = this.db.select().from(schema.licenses).where(eq(schema.licenses.id, id)).get();
    return row ? rowToLicense(row) : null;
  }
  async listLicenses(): Promise<BuyerLicense[]> {
    return this.db.select().from(schema.licenses).all().map(rowToLicense);
  }
  async setLicenseRevoked(id: LicenseId, revokedAt: string): Promise<void> {
    this.db.update(schema.licenses).set({ revokedAt }).where(eq(schema.licenses.id, id)).run();
  }

  async insertUnlockCode(code: UnlockCode): Promise<void> {
    this.db
      .insert(schema.unlockCodes)
      .values({
        ...code,
        redeemedAt: code.redeemedAt ?? null,
        maxRedemptions: code.maxRedemptions ?? null
      })
      .run();
  }
  async getUnlockCodeByLicense(licenseId: LicenseId): Promise<UnlockCode | null> {
    const row = this.db
      .select()
      .from(schema.unlockCodes)
      .where(eq(schema.unlockCodes.licenseId, licenseId))
      .get();
    return row ? rowToUnlockCode(row) : null;
  }
  async updateUnlockCode(code: UnlockCode): Promise<void> {
    this.db
      .update(schema.unlockCodes)
      .set({
        codeHash: code.codeHash,
        redeemedAt: code.redeemedAt ?? null,
        redemptionCount: code.redemptionCount,
        maxRedemptions: code.maxRedemptions ?? null,
        status: code.status
      })
      .where(eq(schema.unlockCodes.id, code.id))
      .run();
  }

  async insertProofReceipt(receipt: ProofReceipt): Promise<void> {
    this.db
      .insert(schema.proofReceipts)
      .values({ ...receipt, verificationUrl: receipt.verificationUrl ?? null })
      .run();
  }
  async getProofReceipt(id: ProofReceiptId): Promise<ProofReceipt | null> {
    const row = this.db
      .select()
      .from(schema.proofReceipts)
      .where(eq(schema.proofReceipts.id, id))
      .get();
    return row ? rowToProofReceipt(row) : null;
  }
  async listProofReceipts(): Promise<ProofReceipt[]> {
    return this.db.select().from(schema.proofReceipts).all().map(rowToProofReceipt);
  }

  async insertFingerprint(fingerprint: Fingerprint): Promise<void> {
    this.db.insert(schema.fingerprints).values(fingerprint).run();
  }
  async listFingerprints(): Promise<Fingerprint[]> {
    return this.db.select().from(schema.fingerprints).all().map(rowToFingerprint);
  }

  async insertRevocation(revocation: Revocation): Promise<void> {
    this.db.insert(schema.revocations).values(revocation).run();
  }
  async listRevocations(): Promise<Revocation[]> {
    return this.db.select().from(schema.revocations).all().map(rowToRevocation);
  }

  async reset(): Promise<void> {
    // Delete children before parents to respect foreign keys.
    this.db.delete(schema.checkoutSessions).run();
    this.db.delete(schema.custodySecrets).run();
    this.db.delete(schema.issuerSecrets).run();
    this.db.delete(schema.buyerLockedPayloads).run();
    this.db.delete(schema.revocations).run();
    this.db.delete(schema.fingerprints).run();
    this.db.delete(schema.proofReceipts).run();
    this.db.delete(schema.unlockCodes).run();
    this.db.delete(schema.licenses).run();
    this.db.delete(schema.purchases).run();
    this.db.delete(schema.listings).run();
    this.db.delete(schema.lockedPayloads).run();
    this.db.delete(schema.lockedAssets).run();
    this.db.delete(schema.assetVersions).run();
    this.db.delete(schema.assets).run();
    this.db.delete(schema.buyers).run();
    this.db.delete(schema.creators).run();
    this.db.delete(schema.issuers).run();
  }

  async close(): Promise<void> {
    this.sqlite.close();
  }
}
