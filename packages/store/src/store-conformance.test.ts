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
  FingerprintId,
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
  RevocationId,
  UnlockCode,
  UnlockCodeId
} from "@my-digital/types";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MarketplaceStore } from "./interface";
import { MemoryMarketplaceStore } from "./memory";
import { openSqliteStore } from "./sqlite";

const NOW = "2026-06-11T00:00:00.000Z";

const creator: Creator = {
  id: "creator_conf" as CreatorId,
  displayName: "Creator",
  handle: "creator",
  emailHash: "aa".repeat(32),
  createdAt: NOW,
  verificationStatus: "unverified"
};

const buyer: Buyer = {
  id: "buyer_conf" as BuyerId,
  emailHash: "bb".repeat(32),
  displayName: "Buyer",
  createdAt: NOW
};

const asset: Asset = {
  id: "asset_conf" as AssetId,
  creatorId: creator.id,
  title: "Asset",
  description: "Conformance asset",
  category: "test",
  createdAt: NOW,
  status: "draft"
};

const assetVersion: AssetVersion = {
  id: "assetver_conf" as AssetVersionId,
  assetId: asset.id,
  versionLabel: "1.0.0",
  fileName: "asset.txt",
  mimeType: "text/plain",
  byteSize: 11,
  contentHash: "cc".repeat(32),
  manifestHash: "dd".repeat(32),
  createdAt: NOW
};

const manifest: AssetManifest = {
  schema: "MYDIGITAL-ASSET-MANIFEST-V1",
  assetId: asset.id,
  assetVersionId: assetVersion.id,
  creatorId: creator.id,
  versionLabel: "1.0.0",
  fileName: "asset.txt",
  mimeType: "text/plain",
  byteSize: 11,
  contentHash: assetVersion.contentHash,
  createdAt: NOW
};

const lockedAsset: LockedAsset = {
  id: "locked_conf" as LockedAssetId,
  assetVersionId: assetVersion.id,
  envelopeFormat: "TEST-ENVELOPE",
  envelopeVersion: "0.0.0-test",
  lockedPayloadHash: "ee".repeat(32),
  metadataHash: "ff".repeat(32),
  qevEngineVersion: "test",
  createdAt: NOW
};

const payloadBytes = new Uint8Array([0, 1, 2, 3, 250, 251, 252, 253, 254, 255]);

const listing: Listing = {
  id: "listing_conf" as ListingId,
  assetId: asset.id,
  activeAssetVersionId: assetVersion.id,
  creatorId: creator.id,
  title: "Listing",
  description: "Conformance listing",
  priceAmount: 1900,
  priceCurrency: "USD",
  licenseTerms: {
    personalUse: true,
    commercialUse: false,
    clientWorkAllowed: false,
    redistributionAllowed: false,
    resaleAllowed: false,
    aiTrainingAllowed: false,
    attributionRequired: true,
    seatCount: 1
  },
  status: "active",
  createdAt: NOW,
  updatedAt: NOW
};

const purchase: Purchase = {
  id: "purchase_conf" as PurchaseId,
  listingId: listing.id,
  buyerId: buyer.id,
  assetVersionId: assetVersion.id,
  paymentProvider: "mock",
  paymentProviderReference: "mockpay_conf",
  amountPaid: 1900,
  currency: "USD",
  status: "paid",
  createdAt: NOW,
  paidAt: NOW
};

const license: BuyerLicense = {
  id: "license_conf" as LicenseId,
  purchaseId: purchase.id,
  buyerId: buyer.id,
  assetId: asset.id,
  assetVersionId: assetVersion.id,
  lockedAssetId: lockedAsset.id,
  terms: listing.licenseTerms,
  allowedUses: ["personal-use"],
  expiresAt: "2027-01-01T00:00:00.000Z",
  unlockLimit: 3,
  issuer: "test-issuer",
  issuerSignature: "sig",
  issuedAt: NOW
};

const unlockCode: UnlockCode = {
  id: "unlock_conf" as UnlockCodeId,
  licenseId: license.id,
  codeHash: "12".repeat(32),
  createdAt: NOW,
  redemptionCount: 0,
  status: "active"
};

const receipt: ProofReceipt = {
  id: "receipt_conf" as ProofReceiptId,
  purchaseId: purchase.id,
  licenseId: license.id,
  assetId: asset.id,
  assetVersionId: assetVersion.id,
  buyerIdHash: "34".repeat(32),
  creatorId: creator.id,
  receiptHash: "56".repeat(32),
  issuerSignature: "sig",
  createdAt: NOW,
  verificationUrl: "https://mydigital.imagineqira.com/verify/receipt_conf"
};

const fingerprint: Fingerprint = {
  id: "fingerprint_conf" as FingerprintId,
  licenseId: license.id,
  assetVersionId: assetVersion.id,
  fingerprintType: "manifest-embed",
  fingerprintHash: "78".repeat(32),
  embeddingStrategy: "none-yet",
  confidenceModel: "none-yet",
  createdAt: NOW
};

const revocation: Revocation = {
  id: "revocation_conf" as RevocationId,
  targetType: "license",
  targetId: license.id,
  reason: "conformance test",
  createdAt: NOW,
  createdBy: creator.id,
  issuerSignature: "sig"
};

function conformance(name: string, makeStore: () => Promise<MarketplaceStore>): void {
  describe(`${name} store conformance`, () => {
    let store: MarketplaceStore;

    beforeAll(async () => {
      store = await makeStore();
    });

    afterAll(async () => {
      await store.close();
    });

    it("round-trips the issuer record", async () => {
      await store.putIssuer({ name: "test-issuer", publicKeyB64: "AAAA", createdAt: NOW });
      await store.putIssuer({ name: "test-issuer", publicKeyB64: "BBBB", createdAt: NOW });
      expect(await store.getIssuer("test-issuer")).toEqual({
        name: "test-issuer",
        publicKeyB64: "BBBB",
        createdAt: NOW
      });
      expect(await store.getIssuer("missing")).toBeNull();
    });

    it("round-trips creators", async () => {
      await store.insertCreator(creator);
      expect(await store.getCreator(creator.id)).toEqual(creator);
      expect(await store.listCreators()).toEqual([creator]);
    });

    it("round-trips buyers and finds them by email hash", async () => {
      await store.insertBuyer(buyer);
      expect(await store.getBuyer(buyer.id)).toEqual(buyer);
      expect(await store.getBuyerByEmailHash(buyer.emailHash)).toEqual(buyer);
      expect(await store.getBuyerByEmailHash("00".repeat(32))).toBeNull();
    });

    it("round-trips assets and updates their status", async () => {
      await store.insertAsset(asset);
      expect(await store.getAsset(asset.id)).toEqual(asset);
      await store.updateAssetStatus(asset.id, "listed");
      expect((await store.getAsset(asset.id))?.status).toBe("listed");
    });

    it("round-trips asset versions together with their manifest", async () => {
      await store.insertAssetVersion(assetVersion, manifest);
      expect(await store.getAssetVersion(assetVersion.id)).toEqual(assetVersion);
      expect(await store.getAssetManifest(assetVersion.id)).toEqual(manifest);
    });

    it("round-trips locked assets and finds them by version", async () => {
      await store.insertLockedAsset(lockedAsset);
      expect(await store.getLockedAsset(lockedAsset.id)).toEqual(lockedAsset);
      expect(await store.getLockedAssetByVersion(assetVersion.id)).toEqual(lockedAsset);
    });

    it("round-trips locked payload bytes exactly", async () => {
      await store.putLockedPayload(lockedAsset.id, payloadBytes);
      const restored = await store.getLockedPayload(lockedAsset.id);
      expect(restored).not.toBeNull();
      expect([...(restored ?? new Uint8Array())]).toEqual([...payloadBytes]);
      expect(await store.getLockedPayload("locked_missing" as LockedAssetId)).toBeNull();
    });

    it("round-trips sealed custody secrets (upsert included)", async () => {
      await store.putCustodySecret(lockedAsset.id, {
        nonceB64: "nonce-1",
        sealedB64: "sealed-1",
        createdAt: NOW
      });
      await store.putCustodySecret(lockedAsset.id, {
        nonceB64: "nonce-2",
        sealedB64: "sealed-2",
        createdAt: NOW
      });
      expect(await store.getCustodySecret(lockedAsset.id)).toEqual({
        nonceB64: "nonce-2",
        sealedB64: "sealed-2",
        createdAt: NOW
      });
      expect(await store.getCustodySecret("locked_missing" as LockedAssetId)).toBeNull();
    });

    it("round-trips sealed issuer secrets", async () => {
      await store.putIssuerSecret("test-issuer", {
        nonceB64: "issuer-nonce",
        sealedB64: "issuer-sealed",
        createdAt: NOW
      });
      expect(await store.getIssuerSecret("test-issuer")).toEqual({
        nonceB64: "issuer-nonce",
        sealedB64: "issuer-sealed",
        createdAt: NOW
      });
      expect(await store.getIssuerSecret("missing")).toBeNull();
    });

    it("round-trips listings including license terms JSON", async () => {
      await store.insertListing(listing);
      expect(await store.getListing(listing.id)).toEqual(listing);
    });

    it("round-trips purchases", async () => {
      await store.insertPurchase(purchase);
      expect(await store.getPurchase(purchase.id)).toEqual(purchase);
    });

    it("round-trips licenses including optional fields", async () => {
      await store.insertLicense(license);
      expect(await store.getLicense(license.id)).toEqual(license);
    });

    it("records revocation on a license", async () => {
      await store.setLicenseRevoked(license.id, "2026-06-12T00:00:00.000Z");
      expect((await store.getLicense(license.id))?.revokedAt).toBe("2026-06-12T00:00:00.000Z");
    });

    it("round-trips unlock codes and persists redemption updates", async () => {
      await store.insertUnlockCode(unlockCode);
      expect(await store.getUnlockCodeByLicense(license.id)).toEqual(unlockCode);
      const redeemed: UnlockCode = {
        ...unlockCode,
        redemptionCount: 1,
        redeemedAt: NOW,
        status: "redeemed"
      };
      await store.updateUnlockCode(redeemed);
      expect(await store.getUnlockCodeByLicense(license.id)).toEqual(redeemed);
    });

    it("round-trips proof receipts", async () => {
      await store.insertProofReceipt(receipt);
      expect(await store.getProofReceipt(receipt.id)).toEqual(receipt);
      expect(await store.listProofReceipts()).toEqual([receipt]);
    });

    it("round-trips buyer locked payloads with their hash", async () => {
      await store.putBuyerLockedPayload(license.id, payloadBytes, "9a".repeat(32));
      const restored = await store.getBuyerLockedPayload(license.id);
      expect(restored).not.toBeNull();
      expect([...(restored?.payload ?? new Uint8Array())]).toEqual([...payloadBytes]);
      expect(restored?.payloadHash).toBe("9a".repeat(32));
      expect(await store.getBuyerLockedPayload("license_missing" as LicenseId)).toBeNull();
    });

    it("round-trips fingerprints and revocations", async () => {
      await store.insertFingerprint(fingerprint);
      await store.insertRevocation(revocation);
      expect(await store.listFingerprints()).toEqual([fingerprint]);
      expect(await store.listRevocations()).toEqual([revocation]);
    });

    it("reset clears every table", async () => {
      await store.reset();
      expect(await store.listCreators()).toEqual([]);
      expect(await store.listBuyers()).toEqual([]);
      expect(await store.listAssets()).toEqual([]);
      expect(await store.listListings()).toEqual([]);
      expect(await store.listLicenses()).toEqual([]);
      expect(await store.listProofReceipts()).toEqual([]);
      expect(await store.getIssuer("test-issuer")).toBeNull();
      expect(await store.getLockedPayload(lockedAsset.id)).toBeNull();
      expect(await store.getCustodySecret(lockedAsset.id)).toBeNull();
      expect(await store.getIssuerSecret("test-issuer")).toBeNull();
      expect(await store.getBuyerLockedPayload(license.id)).toBeNull();
    });
  });
}

conformance("memory", async () => new MemoryMarketplaceStore());
conformance("sqlite (:memory:)", async () => openSqliteStore({ path: ":memory:" }));
