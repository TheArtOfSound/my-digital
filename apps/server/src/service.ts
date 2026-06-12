import {
  completeMockCheckout,
  createAsset,
  createAssetVersion,
  createBuyer,
  createCreator,
  createListing,
  createLockedAssetRecord,
  generateProofReceipt,
  hashEmail,
  issueBuyerLicense,
  issueUnlockCode,
  newRevocationId,
  signCanonical,
  verifyBuyerLicense
} from "@my-digital/core";
import type { MarketplaceStore } from "@my-digital/store";
import type {
  Asset,
  AssetVersion,
  Buyer,
  BuyerLicense,
  BuyerWrappingEnvelopeAdapter,
  Creator,
  LicenseId,
  LicenseTerms,
  ListingId,
  Listing,
  LockedAsset,
  LockedAssetId,
  PaymentAdapter,
  ProofReceipt,
  ProofReceiptId,
  Purchase,
  Revocation,
  UnlockCode,
  VerificationResult
} from "@my-digital/types";
import { Keystore, ensureServerIssuer, type ServerIssuer } from "./keystore";

const MAX_PAYLOAD_BYTES = 2_000_000;

export const RECEIPT_BUNDLE_KIND = "MYDIGITAL-RECEIPT-BUNDLE-V1";

export interface ServiceOptions {
  store: MarketplaceStore;
  keystore: Keystore;
  envelope: BuyerWrappingEnvelopeAdapter;
  payments: PaymentAdapter;
  issuerName: string;
  verificationUrlBase: string;
}

export interface ServerState {
  issuer: { name: string; publicKeyB64: string };
  creator: Creator | null;
  buyers: Buyer[];
  assets: Asset[];
  assetVersions: AssetVersion[];
  lockedAssets: LockedAsset[];
  listings: Listing[];
  purchases: Purchase[];
  licenses: BuyerLicense[];
  unlockCodes: UnlockCode[];
  receipts: ProofReceipt[];
  revocations: Revocation[];
}

export interface CreateListingInput {
  title: string;
  description: string;
  category: string;
  priceAmount: number;
  priceCurrency: string;
  licenseTerms: LicenseTerms;
  fileName: string;
  mimeType: string;
  payload: Uint8Array;
}

export type CheckoutOutcome =
  | {
      outcome: "paid";
      buyer: Buyer;
      purchase: Purchase;
      license: BuyerLicense;
      receipt: ProofReceipt;
      rawUnlockCode: string;
      buyerVaultHash: string;
    }
  | { outcome: "failed"; buyer: Buyer; purchase: Purchase };

function custodyAad(lockedAssetId: LockedAssetId): string {
  return `custody:${lockedAssetId}`;
}

export class MarketplaceService {
  private issuer: ServerIssuer;

  private constructor(
    private readonly opts: ServiceOptions,
    issuer: ServerIssuer
  ) {
    this.issuer = issuer;
  }

  static async create(opts: ServiceOptions): Promise<MarketplaceService> {
    const issuer = await ensureServerIssuer(opts.store, opts.keystore, opts.issuerName);
    return new MarketplaceService(opts, issuer);
  }

  issuerInfo(): { name: string; publicKeyB64: string } {
    return { name: this.issuer.name, publicKeyB64: this.issuer.publicKeyB64 };
  }

  async getState(): Promise<ServerState> {
    const { store } = this.opts;
    const creators = await store.listCreators();
    const licenses = await store.listLicenses();
    const unlockCodes: UnlockCode[] = [];
    for (const license of licenses) {
      const code = await store.getUnlockCodeByLicense(license.id);
      if (code) unlockCodes.push(code);
    }
    return {
      issuer: this.issuerInfo(),
      creator: creators[0] ?? null,
      buyers: await store.listBuyers(),
      assets: await store.listAssets(),
      assetVersions: await store.listAssetVersions(),
      lockedAssets: (
        await Promise.all(
          (await store.listAssetVersions()).map((version) =>
            store.getLockedAssetByVersion(version.id)
          )
        )
      ).filter((entry): entry is LockedAsset => entry !== null),
      listings: await store.listListings(),
      purchases: await store.listPurchases(),
      licenses,
      unlockCodes,
      receipts: await store.listProofReceipts(),
      revocations: await store.listRevocations()
    };
  }

  async ensureCreator(input: {
    displayName: string;
    handle: string;
    email: string;
  }): Promise<Creator> {
    const existing = (await this.opts.store.listCreators())[0];
    if (existing) return existing;
    const creator = await createCreator(input);
    await this.opts.store.insertCreator(creator);
    return creator;
  }

  async createLockedListing(input: CreateListingInput): Promise<{
    asset: Asset;
    assetVersion: AssetVersion;
    lockedAsset: LockedAsset;
    listing: Listing;
  }> {
    const { store, envelope, keystore } = this.opts;
    const creator = (await store.listCreators())[0];
    if (!creator) throw new Error("Create the creator profile first.");
    if (input.payload.byteLength === 0) {
      throw new Error("The product content is empty.");
    }
    if (input.payload.byteLength > MAX_PAYLOAD_BYTES) {
      throw new Error("Keep files under 2 MB in the dev instance.");
    }

    let asset = createAsset({
      creatorId: creator.id,
      title: input.title,
      description: input.description,
      category: input.category
    });
    const { assetVersion, manifest } = await createAssetVersion({
      asset,
      versionLabel: "1.0.0",
      fileName: input.fileName,
      mimeType: input.mimeType,
      bytes: input.payload
    });
    const lockResult = await envelope.lock({
      assetVersionId: assetVersion.id,
      fileName: assetVersion.fileName,
      mimeType: assetVersion.mimeType,
      plaintext: input.payload
    });
    if (lockResult.keyMaterialB64 === undefined) {
      throw new Error("Envelope adapter returned no custody key material.");
    }
    const lockedAsset = createLockedAssetRecord({ assetVersionId: assetVersion.id, lockResult });
    asset = { ...asset, status: "listed" };
    const listing = createListing({
      asset,
      activeAssetVersionId: assetVersion.id,
      priceAmount: input.priceAmount,
      priceCurrency: input.priceCurrency,
      licenseTerms: input.licenseTerms
    });

    await store.insertAsset(asset);
    await store.insertAssetVersion(assetVersion, manifest);
    await store.insertLockedAsset(lockedAsset);
    await store.putLockedPayload(lockedAsset.id, lockResult.lockedPayload);
    // The custody passphrase is sealed under the master key before it touches
    // the database, bound to this locked asset id via AAD.
    await store.putCustodySecret(
      lockedAsset.id,
      await keystore.sealString(lockResult.keyMaterialB64, custodyAad(lockedAsset.id))
    );
    await store.insertListing(listing);
    return { asset, assetVersion, lockedAsset, listing };
  }

  async checkout(input: {
    listingId: ListingId;
    email: string;
    displayName?: string;
    simulateOutcome?: "paid" | "failed";
  }): Promise<CheckoutOutcome> {
    const { store, payments, envelope, keystore } = this.opts;
    const listing = await store.getListing(input.listingId);
    if (!listing) throw new Error("Listing not found.");
    const asset = await store.getAsset(listing.assetId);
    const assetVersion = await store.getAssetVersion(listing.activeAssetVersionId);
    const lockedAsset = await store.getLockedAssetByVersion(listing.activeAssetVersionId);
    if (!asset || !assetVersion || !lockedAsset) {
      throw new Error("Listing records are incomplete.");
    }

    const emailHash = await hashEmail(input.email);
    let buyer = await store.getBuyerByEmailHash(emailHash);
    if (!buyer) {
      buyer = await createBuyer(
        input.displayName !== undefined
          ? { email: input.email, displayName: input.displayName }
          : { email: input.email }
      );
      await store.insertBuyer(buyer);
    }

    const checkout = await completeMockCheckout(payments, {
      listing,
      buyer,
      ...(input.simulateOutcome === "failed" ? { simulateOutcome: "failed" as const } : {})
    });
    await store.insertPurchase(checkout.purchase);
    if (checkout.purchase.status !== "paid") {
      return { outcome: "failed", buyer, purchase: checkout.purchase };
    }

    const license = await issueBuyerLicense({
      purchase: checkout.purchase,
      buyer,
      asset,
      assetVersion,
      lockedAsset,
      terms: listing.licenseTerms,
      issuer: this.issuer.name,
      issuerPrivateKey: this.issuer.privateKey
    });
    const { unlockCode, rawCode } = await issueUnlockCode({ licenseId: license.id });

    // Mint the buyer-specific vault: open the sealed custody passphrase, wrap
    // for the buyer's credential, persist only the encrypted result. The raw
    // code goes back to the buyer once and is never stored.
    const custodySecret = await store.getCustodySecret(lockedAsset.id);
    const basePayload = await store.getLockedPayload(lockedAsset.id);
    if (!custodySecret || !basePayload) {
      throw new Error("Custody records for this asset are missing.");
    }
    const custodyPassphrase = await keystore.openSealedString(
      custodySecret,
      custodyAad(lockedAsset.id)
    );
    const wrap = await envelope.wrapForCredential({
      lockedPayload: basePayload,
      keyMaterialB64: custodyPassphrase,
      credential: rawCode,
      licenseId: license.id
    });

    const receipt = await generateProofReceipt({
      purchase: checkout.purchase,
      license,
      creatorId: asset.creatorId,
      issuerPrivateKey: this.issuer.privateKey,
      verificationUrlBase: this.opts.verificationUrlBase
    });

    await store.insertLicense(license);
    await store.insertUnlockCode(unlockCode);
    await store.putBuyerLockedPayload(
      license.id,
      wrap.buyerLockedPayload,
      wrap.buyerLockedPayloadHash
    );
    await store.insertProofReceipt(receipt);

    return {
      outcome: "paid",
      buyer,
      purchase: checkout.purchase,
      license,
      receipt,
      rawUnlockCode: rawCode,
      buyerVaultHash: wrap.buyerLockedPayloadHash
    };
  }

  async getBuyerVault(
    licenseId: LicenseId
  ): Promise<{ payload: Uint8Array; payloadHash: string; fileName: string } | null> {
    const { store } = this.opts;
    const stored = await store.getBuyerLockedPayload(licenseId);
    if (!stored) return null;
    return { ...stored, fileName: `${licenseId}.vault.json` };
  }

  async getBaseLockedPayload(lockedAssetId: LockedAssetId): Promise<Uint8Array | null> {
    return this.opts.store.getLockedPayload(lockedAssetId);
  }

  async revokeLicense(licenseId: LicenseId, reason: string): Promise<Revocation> {
    const { store } = this.opts;
    const license = await store.getLicense(licenseId);
    if (!license) throw new Error("License not found.");
    if (license.revokedAt !== undefined) throw new Error("This license is already revoked.");
    const createdAt = new Date().toISOString();
    const creator = (await store.listCreators())[0];
    const revocationCore = {
      id: newRevocationId(),
      targetType: "license" as const,
      targetId: licenseId as string,
      reason,
      createdAt,
      createdBy: creator?.id ?? this.issuer.name
    };
    const revocation: Revocation = {
      ...revocationCore,
      issuerSignature: await signCanonical(this.issuer.privateKey, revocationCore)
    };
    await store.setLicenseRevoked(licenseId, createdAt);
    await store.insertRevocation(revocation);
    return revocation;
  }

  async verifyLicenseRecord(licenseId: LicenseId): Promise<VerificationResult> {
    const { store } = this.opts;
    const license = await store.getLicense(licenseId);
    if (!license) throw new Error("License not found.");
    const asset = await store.getAsset(license.assetId);
    const assetVersion = await store.getAssetVersion(license.assetVersionId);
    const lockedAsset = await store.getLockedAsset(license.lockedAssetId);
    if (!asset || !assetVersion || !lockedAsset) {
      throw new Error("License records are incomplete.");
    }
    return verifyBuyerLicense({
      license,
      issuerPublicKey: this.issuer.publicKey,
      expected: {
        assetId: asset.id,
        assetVersionId: assetVersion.id,
        lockedAssetId: lockedAsset.id,
        buyerId: license.buyerId
      }
    });
  }

  async getReceiptBundle(receiptId: ProofReceiptId): Promise<{
    kind: typeof RECEIPT_BUNDLE_KIND;
    receipt: ProofReceipt;
    issuer: { name: string; publicKeyB64: string };
  } | null> {
    const receipt = await this.opts.store.getProofReceipt(receiptId);
    if (!receipt) return null;
    return { kind: RECEIPT_BUNDLE_KIND, receipt, issuer: this.issuerInfo() };
  }

  /** Destructive dev reset: wipes all records and bootstraps a fresh issuer. */
  async reset(): Promise<void> {
    await this.opts.store.reset();
    this.issuer = await ensureServerIssuer(
      this.opts.store,
      this.opts.keystore,
      this.opts.issuerName
    );
  }
}
