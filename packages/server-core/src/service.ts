import {
  applyPaymentConfirmation,
  createAsset,
  createAssetVersion,
  createBuyer,
  createCreator,
  createListing,
  createLockedAssetRecord,
  createPendingPurchase,
  generateProofReceipt,
  hashEmail,
  issueBuyerLicense,
  issueUnlockCode,
  newFingerprintId,
  newRevocationId,
  sha256Hex,
  sha256HexOfString,
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
  CheckoutSession,
  Creator,
  Fingerprint,
  LicenseId,
  LicenseTerms,
  ListingId,
  Listing,
  LockedAsset,
  LockedAssetId,
  PaymentAdapter,
  PaymentConfirmation,
  ProofReceipt,
  ProofReceiptId,
  Purchase,
  PurchaseId,
  Revocation,
  TraceResult,
  UnlockCode,
  VerificationResult
} from "@my-digital/types";
import { Keystore, ensureServerIssuer, type ServerIssuer } from "./keystore";

// 1 MB: keeps buyer vaults (payload base64url + envelope overhead) under
// Cloudflare D1's 2 MB row limit and matches the upstream CLI's 1 MiB cap.
const MAX_PAYLOAD_BYTES = 1_000_000;

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
  fingerprints: Fingerprint[];
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
      revocations: await store.listRevocations(),
      fingerprints: await store.listFingerprints()
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
      throw new Error("Keep files under 1 MB in this instance.");
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

  /** Single-call checkout used by the mock flow: begin + complete. */
  async checkout(input: {
    listingId: ListingId;
    email: string;
    displayName?: string;
    simulateOutcome?: "paid" | "failed";
  }): Promise<CheckoutOutcome> {
    const begun = await this.beginCheckout({
      listingId: input.listingId,
      email: input.email,
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {})
    });
    return this.completeCheckout({
      purchaseId: begun.purchase.id,
      ...(input.simulateOutcome === "failed" ? { simulateOutcome: "failed" as const } : {})
    });
  }

  /** Creates the pending purchase + provider session. Redirect flows start here. */
  async beginCheckout(input: {
    listingId: ListingId;
    email: string;
    displayName?: string;
  }): Promise<{ purchase: Purchase; session: CheckoutSession }> {
    const { store, payments } = this.opts;
    const listing = await store.getListing(input.listingId);
    if (!listing) throw new Error("Listing not found.");

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

    const session = await payments.createCheckout({ listing, buyer });
    const purchase = createPendingPurchase({ listing, buyer, session });
    await store.insertPurchase(purchase);
    await store.insertCheckoutSession({ ...session, purchaseId: purchase.id });
    return { purchase, session };
  }

  /**
   * Confirms payment (poll path) and fulfills. Restart-safe: the persisted
   * session is rehydrated into the adapter. If a webhook already marked the
   * purchase paid, fulfillment proceeds without re-polling the provider.
   */
  async completeCheckout(input: {
    purchaseId?: PurchaseId;
    providerReference?: string;
    simulateOutcome?: "paid" | "failed";
  }): Promise<CheckoutOutcome> {
    const { store, payments } = this.opts;
    const purchase = input.purchaseId
      ? await store.getPurchase(input.purchaseId)
      : input.providerReference
        ? await store.findPurchaseByProviderReference(input.providerReference)
        : null;
    if (!purchase) throw new Error("Purchase not found.");
    const buyer = await store.getBuyer(purchase.buyerId);
    if (!buyer) throw new Error("Buyer record is missing.");

    if (purchase.status === "failed") return { outcome: "failed", buyer, purchase };
    const alreadyFulfilled = (await store.listLicenses()).some(
      (entry) => entry.purchaseId === purchase.id
    );
    if (alreadyFulfilled) {
      throw new Error(
        "This purchase is already fulfilled. The unlock code is shown exactly once and cannot be retrieved again."
      );
    }

    let settled = purchase;
    if (purchase.status === "pending") {
      const sessionRow = await store.getCheckoutSessionByPurchase(purchase.id);
      if (!sessionRow) throw new Error("No checkout session exists for this purchase.");
      const { purchaseId: _purchaseId, ...session } = sessionRow;
      payments.restoreSession?.(session);
      const confirmation = await payments.confirmPayment({
        sessionId: session.id,
        ...(input.simulateOutcome === "failed" ? { simulateOutcome: "failed" as const } : {})
      });
      settled = applyPaymentConfirmation(purchase, confirmation);
      await store.updatePurchaseStatus(settled.id, settled.status, settled.paidAt);
      await store.updateCheckoutSessionStatus(
        session.id,
        confirmation.session.status,
        confirmation.occurredAt
      );
      if (settled.status !== "paid") return { outcome: "failed", buyer, purchase: settled };
    }
    return this.fulfillPaidPurchase(settled, buyer);
  }

  /** Verifies a provider webhook and applies the confirmation to the purchase. */
  async handlePaymentWebhook(
    rawBody: string,
    signature: string
  ): Promise<{ handled: boolean; purchaseId?: PurchaseId; outcome?: "paid" | "failed" }> {
    const { store } = this.opts;
    const adapter = this.opts.payments as {
      confirmFromWebhook?: (
        rawBody: string,
        signature: string
      ) => Promise<PaymentConfirmation | null>;
    };
    if (!adapter.confirmFromWebhook) {
      throw new Error("The active payment adapter does not support webhooks.");
    }
    const confirmation = await adapter.confirmFromWebhook(rawBody, signature);
    if (!confirmation) return { handled: false };
    const purchase = await store.findPurchaseByProviderReference(
      confirmation.session.providerReference
    );
    if (!purchase) throw new Error("Webhook confirmation matches no purchase.");
    if (purchase.status === "pending") {
      const settled = applyPaymentConfirmation(purchase, confirmation);
      await store.updatePurchaseStatus(settled.id, settled.status, settled.paidAt);
      const sessionRow = await store.getCheckoutSessionByPurchase(purchase.id);
      if (sessionRow) {
        await store.updateCheckoutSessionStatus(
          sessionRow.id,
          confirmation.session.status,
          confirmation.occurredAt
        );
      }
    }
    return { handled: true, purchaseId: purchase.id, outcome: confirmation.outcome };
  }

  /** Mints license, unlock code, buyer vault, receipt, and fingerprint. */
  private async fulfillPaidPurchase(purchase: Purchase, buyer: Buyer): Promise<CheckoutOutcome> {
    const { store, envelope, keystore } = this.opts;
    const listing = await store.getListing(purchase.listingId);
    const assetVersion = await store.getAssetVersion(purchase.assetVersionId);
    const asset = assetVersion ? await store.getAsset(assetVersion.assetId) : null;
    const lockedAsset = assetVersion
      ? await store.getLockedAssetByVersion(assetVersion.id)
      : null;
    if (!listing || !asset || !assetVersion || !lockedAsset) {
      throw new Error("Purchase records are incomplete.");
    }

    const license = await issueBuyerLicense({
      purchase,
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
      purchase,
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
    // The buyer vault IS the fingerprint: unique per buyer, license id sealed
    // inside, attributable by exact hash match.
    await store.insertFingerprint({
      id: newFingerprintId(),
      licenseId: license.id,
      assetVersionId: assetVersion.id,
      fingerprintType: "buyer-vault-sha256",
      fingerprintHash: wrap.buyerLockedPayloadHash,
      embeddingStrategy: "per-buyer-vault-reencryption",
      confidenceModel: "exact-hash-match",
      createdAt: new Date().toISOString()
    });

    return {
      outcome: "paid",
      buyer,
      purchase,
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

  /**
   * Trace a suspected leaked artifact. Returns honest evidence levels only:
   * exact vault hash matches attribute to a license; plaintext matches state
   * plainly that no attribution is possible; everything else reports itself
   * as unattributed or unsupported rather than implying confidence.
   */
  async trace(artifact: Uint8Array): Promise<TraceResult> {
    const { store } = this.opts;
    const artifactSha256 = await sha256Hex(artifact);
    const base: Omit<TraceResult, "evidenceLevel" | "explanation" | "caveats"> = {
      id: `trace_${crypto.randomUUID()}`,
      artifactSha256,
      artifactByteSize: artifact.byteLength,
      checkedAt: new Date().toISOString()
    };
    const standingCaveat =
      "Trace evidence supports an investigation; it is not standalone proof of who leaked a file.";

    const vaultMatch = await store.findBuyerLockedPayloadByHash(artifactSha256);
    if (vaultMatch) {
      const license = await store.getLicense(vaultMatch.licenseId);
      const fingerprint = (await store.listFingerprints()).find(
        (entry) => entry.fingerprintHash === artifactSha256
      );
      return {
        ...base,
        evidenceLevel: "exact-vault-match",
        explanation:
          "This artifact is byte-identical to a buyer vault minted by this marketplace. It is the exact encrypted package issued for the matched license.",
        caveats: [
          "Possession of the vault identifies which buyer's copy circulated, not who circulated it.",
          "The vault is still encrypted; without the unlock code it does not expose the content.",
          standingCaveat
        ],
        match: {
          ...(license
            ? {
                licenseId: license.id,
                buyerIdHash: await sha256HexOfString(license.buyerId),
                assetId: license.assetId,
                assetVersionId: license.assetVersionId,
                licenseRevoked: license.revokedAt !== undefined
              }
            : { licenseId: vaultMatch.licenseId }),
          ...(fingerprint ? { fingerprintId: fingerprint.id } : {})
        }
      };
    }

    const contentMatch = await store.findAssetVersionByContentHash(artifactSha256);
    if (contentMatch) {
      return {
        ...base,
        evidenceLevel: "plaintext-content-match",
        explanation:
          "This artifact matches the decrypted content of a listed asset version. It is a plaintext copy of that product.",
        caveats: [
          "Plaintext copies carry no buyer-specific marking, so attribution to a specific buyer is not possible.",
          "Per-buyer watermarking of display formats is future work and will be claimed only once it exists.",
          standingCaveat
        ],
        match: {
          assetId: contentMatch.assetId,
          assetVersionId: contentMatch.id
        }
      };
    }

    const adapter = this.opts.envelope as {
      verifyVaultStructure?: (bytes: Uint8Array) => Promise<VerificationResult>;
    };
    const structure = adapter.verifyVaultStructure
      ? await adapter.verifyVaultStructure(artifact)
      : null;
    if (structure && structure.status === "pass") {
      return {
        ...base,
        evidenceLevel: "vault-format-unattributed",
        explanation:
          "This artifact is a structurally valid QEV vault, but it does not match any vault minted by this marketplace instance.",
        caveats: [
          "It may come from another QEV surface, another marketplace instance, or a re-encryption.",
          standingCaveat
        ]
      };
    }

    return {
      ...base,
      evidenceLevel: "no-evidence",
      explanation:
        "Unsupported artifact type for tracing: it matches no minted vault, no listed content, and is not a QEV vault.",
      caveats: [
        "No fingerprinting exists for this file type, so no honest evidence is available.",
        standingCaveat
      ]
    };
  }

  /**
   * Buyer library lookup by email hash. Dev convenience, not authentication:
   * production buyer accounts arrive with real auth.
   */
  async getBuyerLibrary(emailHash: string): Promise<{
    buyer: Buyer;
    purchases: Purchase[];
    licenses: BuyerLicense[];
    receipts: ProofReceipt[];
  } | null> {
    const { store } = this.opts;
    const buyer = await store.getBuyerByEmailHash(emailHash);
    if (!buyer) return null;
    const purchases = (await store.listPurchases()).filter(
      (entry) => entry.buyerId === buyer.id
    );
    const licenses = (await store.listLicenses()).filter(
      (entry) => entry.buyerId === buyer.id
    );
    const licenseIds = new Set(licenses.map((entry) => entry.id as string));
    const receipts = (await store.listProofReceipts()).filter((entry) =>
      licenseIds.has(entry.licenseId)
    );
    return { buyer, purchases, licenses, receipts };
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
