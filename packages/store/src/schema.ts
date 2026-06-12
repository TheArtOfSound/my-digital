import { blob, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const issuers = sqliteTable("issuers", {
  name: text("name").primaryKey(),
  publicKeyB64: text("public_key_b64").notNull(),
  createdAt: text("created_at").notNull()
});

export const creators = sqliteTable("creators", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  handle: text("handle").notNull(),
  emailHash: text("email_hash").notNull(),
  createdAt: text("created_at").notNull(),
  verificationStatus: text("verification_status").notNull(),
  publicSigningKey: text("public_signing_key")
});

export const buyers = sqliteTable("buyers", {
  id: text("id").primaryKey(),
  emailHash: text("email_hash").notNull(),
  displayName: text("display_name"),
  createdAt: text("created_at").notNull()
});

export const assets = sqliteTable("assets", {
  id: text("id").primaryKey(),
  creatorId: text("creator_id")
    .notNull()
    .references(() => creators.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  createdAt: text("created_at").notNull(),
  status: text("status").notNull()
});

export const assetVersions = sqliteTable("asset_versions", {
  id: text("id").primaryKey(),
  assetId: text("asset_id")
    .notNull()
    .references(() => assets.id),
  versionLabel: text("version_label").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  contentHash: text("content_hash").notNull(),
  manifestHash: text("manifest_hash").notNull(),
  manifestJson: text("manifest_json").notNull(),
  createdAt: text("created_at").notNull(),
  changelog: text("changelog")
});

export const lockedAssets = sqliteTable("locked_assets", {
  id: text("id").primaryKey(),
  assetVersionId: text("asset_version_id")
    .notNull()
    .references(() => assetVersions.id),
  envelopeFormat: text("envelope_format").notNull(),
  envelopeVersion: text("envelope_version").notNull(),
  lockedPayloadHash: text("locked_payload_hash").notNull(),
  metadataHash: text("metadata_hash").notNull(),
  qevEngineVersion: text("qev_engine_version").notNull(),
  storageUri: text("storage_uri"),
  createdAt: text("created_at").notNull()
});

export const lockedPayloads = sqliteTable("locked_payloads", {
  lockedAssetId: text("locked_asset_id")
    .primaryKey()
    .references(() => lockedAssets.id),
  payload: blob("payload", { mode: "buffer" }).notNull()
});

export const listings = sqliteTable("listings", {
  id: text("id").primaryKey(),
  assetId: text("asset_id")
    .notNull()
    .references(() => assets.id),
  activeAssetVersionId: text("active_asset_version_id")
    .notNull()
    .references(() => assetVersions.id),
  creatorId: text("creator_id")
    .notNull()
    .references(() => creators.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  priceAmount: integer("price_amount").notNull(),
  priceCurrency: text("price_currency").notNull(),
  licenseTerms: text("license_terms").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const purchases = sqliteTable("purchases", {
  id: text("id").primaryKey(),
  listingId: text("listing_id")
    .notNull()
    .references(() => listings.id),
  buyerId: text("buyer_id")
    .notNull()
    .references(() => buyers.id),
  assetVersionId: text("asset_version_id")
    .notNull()
    .references(() => assetVersions.id),
  paymentProvider: text("payment_provider").notNull(),
  paymentProviderReference: text("payment_provider_reference").notNull(),
  amountPaid: integer("amount_paid").notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  paidAt: text("paid_at")
});

export const licenses = sqliteTable("licenses", {
  id: text("id").primaryKey(),
  purchaseId: text("purchase_id")
    .notNull()
    .references(() => purchases.id),
  buyerId: text("buyer_id")
    .notNull()
    .references(() => buyers.id),
  assetId: text("asset_id")
    .notNull()
    .references(() => assets.id),
  assetVersionId: text("asset_version_id")
    .notNull()
    .references(() => assetVersions.id),
  lockedAssetId: text("locked_asset_id")
    .notNull()
    .references(() => lockedAssets.id),
  terms: text("terms").notNull(),
  allowedUses: text("allowed_uses").notNull(),
  expiresAt: text("expires_at"),
  unlockLimit: integer("unlock_limit"),
  issuer: text("issuer").notNull(),
  issuerSignature: text("issuer_signature").notNull(),
  issuedAt: text("issued_at").notNull(),
  revokedAt: text("revoked_at")
});

export const unlockCodes = sqliteTable("unlock_codes", {
  id: text("id").primaryKey(),
  licenseId: text("license_id")
    .notNull()
    .references(() => licenses.id),
  codeHash: text("code_hash").notNull(),
  createdAt: text("created_at").notNull(),
  redeemedAt: text("redeemed_at"),
  redemptionCount: integer("redemption_count").notNull(),
  maxRedemptions: integer("max_redemptions"),
  status: text("status").notNull()
});

export const proofReceipts = sqliteTable("proof_receipts", {
  id: text("id").primaryKey(),
  purchaseId: text("purchase_id")
    .notNull()
    .references(() => purchases.id),
  licenseId: text("license_id")
    .notNull()
    .references(() => licenses.id),
  assetId: text("asset_id")
    .notNull()
    .references(() => assets.id),
  assetVersionId: text("asset_version_id")
    .notNull()
    .references(() => assetVersions.id),
  buyerIdHash: text("buyer_id_hash").notNull(),
  creatorId: text("creator_id")
    .notNull()
    .references(() => creators.id),
  receiptHash: text("receipt_hash").notNull(),
  issuerSignature: text("issuer_signature").notNull(),
  createdAt: text("created_at").notNull(),
  verificationUrl: text("verification_url")
});

export const fingerprints = sqliteTable("fingerprints", {
  id: text("id").primaryKey(),
  licenseId: text("license_id")
    .notNull()
    .references(() => licenses.id),
  assetVersionId: text("asset_version_id")
    .notNull()
    .references(() => assetVersions.id),
  fingerprintType: text("fingerprint_type").notNull(),
  fingerprintHash: text("fingerprint_hash").notNull(),
  embeddingStrategy: text("embedding_strategy").notNull(),
  confidenceModel: text("confidence_model").notNull(),
  createdAt: text("created_at").notNull()
});

export const checkoutSessions = sqliteTable("checkout_sessions", {
  id: text("id").primaryKey(),
  purchaseId: text("purchase_id")
    .notNull()
    .references(() => purchases.id),
  listingId: text("listing_id")
    .notNull()
    .references(() => listings.id),
  buyerId: text("buyer_id")
    .notNull()
    .references(() => buyers.id),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull(),
  provider: text("provider").notNull(),
  providerReference: text("provider_reference").notNull(),
  checkoutUrl: text("checkout_url"),
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at")
});

export const custodySecrets = sqliteTable("custody_secrets", {
  lockedAssetId: text("locked_asset_id")
    .primaryKey()
    .references(() => lockedAssets.id),
  nonceB64: text("nonce_b64").notNull(),
  sealedB64: text("sealed_b64").notNull(),
  createdAt: text("created_at").notNull()
});

export const issuerSecrets = sqliteTable("issuer_secrets", {
  issuerName: text("issuer_name")
    .primaryKey()
    .references(() => issuers.name),
  nonceB64: text("nonce_b64").notNull(),
  sealedB64: text("sealed_b64").notNull(),
  createdAt: text("created_at").notNull()
});

export const buyerLockedPayloads = sqliteTable("buyer_locked_payloads", {
  licenseId: text("license_id")
    .primaryKey()
    .references(() => licenses.id),
  payload: blob("payload", { mode: "buffer" }).notNull(),
  payloadHash: text("payload_hash").notNull(),
  createdAt: text("created_at").notNull()
});

export const revocations = sqliteTable("revocations", {
  id: text("id").primaryKey(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by").notNull(),
  issuerSignature: text("issuer_signature").notNull()
});
