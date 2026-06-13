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

// Avatars are stored inline (data URL or https URL). Keep them small: a 200 KB
// image is ~270k base64 chars. This bounds the row well under D1's limits.
const MAX_AVATAR_CHARS = 300_000;

export const RECEIPT_BUNDLE_KIND = "MYDIGITAL-RECEIPT-BUNDLE-V1";

export interface ServiceOptions {
  store: MarketplaceStore;
  keystore: Keystore;
  envelope: BuyerWrappingEnvelopeAdapter;
  payments: PaymentAdapter;
  issuerName: string;
  verificationUrlBase: string;
  /**
   * Direct-payout (Stripe Connect) configuration. When enabled, checkout is
   * routed to the listing creator's connected account so funds go straight to
   * the creator; the platform never holds the money.
   */
  connect?: {
    enabled: boolean;
    /** Platform application fee in basis points (0 = creators keep 100%). */
    applicationFeeBps?: number;
    /** Public site origin used to build Stripe onboarding return URLs server-side. */
    publicBaseUrl?: string;
  };
}

/** Direct-payout operations a payment adapter may support (Stripe Connect). */
interface ConnectOps {
  createConnectedAccount(input: { email?: string }): Promise<string>;
  createOnboardingLink(input: {
    accountId: string;
    refreshUrl: string;
    returnUrl: string;
  }): Promise<string>;
  getAccountStatus(
    accountId: string
  ): Promise<{ chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean }>;
}

/**
 * The buyer-safe view of a creator: display fields + payout-readiness only.
 * Drops the email hash and the Stripe connected-account id so the public
 * /api/state never leaks them.
 */
function publicCreatorCard(creator: Creator): Creator {
  const card: Creator = {
    id: creator.id,
    displayName: creator.displayName,
    handle: creator.handle,
    emailHash: "",
    verificationStatus: creator.verificationStatus,
    createdAt: creator.createdAt
  };
  if (creator.publicSigningKey !== undefined) card.publicSigningKey = creator.publicSigningKey;
  if (creator.bio !== undefined) card.bio = creator.bio;
  if (creator.avatarUrl !== undefined) card.avatarUrl = creator.avatarUrl;
  if (creator.websiteUrl !== undefined) card.websiteUrl = creator.websiteUrl;
  if (creator.payoutsEnabled !== undefined) card.payoutsEnabled = creator.payoutsEnabled;
  return card;
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

  /**
   * Marketplace state. The default (public) projection is safe for any visitor:
   * only active listings + their assets + the public creator card + the issuer
   * public key. It deliberately omits buyer PII (email hashes, names),
   * purchases/licenses/receipts, and the creator's Stripe account id.
   *
   * Pass `{ includePrivate: true }` (gated by the admin token at the HTTP layer)
   * for the full creator-console view.
   */
  async getState(options?: { includePrivate?: boolean }): Promise<ServerState> {
    const { store } = this.opts;
    const includePrivate = options?.includePrivate === true;
    const creator = (await store.listCreators())[0] ?? null;

    const allListings = await store.listListings();
    const listings = includePrivate
      ? allListings
      : allListings.filter((listing) => listing.status === "active");

    const assets = await store.listAssets();
    const assetVersions = await store.listAssetVersions();
    const lockedAssets = (
      await Promise.all(assetVersions.map((version) => store.getLockedAssetByVersion(version.id)))
    ).filter((entry): entry is LockedAsset => entry !== null);

    if (!includePrivate) {
      // Only expose product metadata for listings buyers can actually see.
      const versionIds = new Set(listings.map((listing) => listing.activeAssetVersionId));
      const assetIds = new Set(listings.map((listing) => listing.assetId));
      return {
        issuer: this.issuerInfo(),
        creator: creator ? publicCreatorCard(creator) : null,
        buyers: [],
        assets: assets.filter((asset) => assetIds.has(asset.id)),
        assetVersions: assetVersions.filter((version) => versionIds.has(version.id)),
        lockedAssets: lockedAssets.filter((locked) => versionIds.has(locked.assetVersionId)),
        listings,
        purchases: [],
        licenses: [],
        unlockCodes: [],
        receipts: [],
        revocations: [],
        fingerprints: []
      };
    }

    const licenses = await store.listLicenses();
    const unlockCodes: UnlockCode[] = [];
    for (const license of licenses) {
      const code = await store.getUnlockCodeByLicense(license.id);
      if (code) unlockCodes.push(code);
    }
    return {
      issuer: this.issuerInfo(),
      creator,
      buyers: await store.listBuyers(),
      assets,
      assetVersions,
      lockedAssets,
      listings,
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

  /** Edits the creator's mutable profile (name, handle, bio, avatar, website). */
  async updateCreatorProfile(input: {
    displayName?: string;
    handle?: string;
    bio?: string;
    avatarUrl?: string;
    websiteUrl?: string;
  }): Promise<Creator> {
    const existing = (await this.opts.store.listCreators())[0];
    if (!existing) throw new Error("Create the creator profile first.");

    const updated: Creator = { ...existing };
    if (input.displayName !== undefined) {
      const name = input.displayName.trim();
      if (name.length < 1 || name.length > 80) {
        throw new Error("Display name must be 1–80 characters.");
      }
      updated.displayName = name;
    }
    if (input.handle !== undefined) {
      const handle = input.handle.trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9-]{1,31}$/.test(handle)) {
        throw new Error(
          "Handle must be 2–32 characters: lowercase letters, numbers, and hyphens, starting alphanumeric."
        );
      }
      updated.handle = handle;
    }
    if (input.bio !== undefined) {
      const bio = input.bio.trim();
      if (bio.length > 600) throw new Error("Bio must be 600 characters or fewer.");
      if (bio.length === 0) delete updated.bio;
      else updated.bio = bio;
    }
    if (input.avatarUrl !== undefined) {
      const avatar = input.avatarUrl.trim();
      if (avatar.length === 0) {
        delete updated.avatarUrl;
      } else {
        if (avatar.length > MAX_AVATAR_CHARS) {
          throw new Error("Avatar image is too large; use one under ~200 KB.");
        }
        const ok =
          avatar.startsWith("https://") ||
          /^data:image\/(png|jpeg|jpg|webp|gif);base64,/.test(avatar);
        if (!ok) throw new Error("Avatar must be an https URL or an image data URL.");
        updated.avatarUrl = avatar;
      }
    }
    if (input.websiteUrl !== undefined) {
      const site = input.websiteUrl.trim();
      if (site.length === 0) {
        delete updated.websiteUrl;
      } else if (site.length > 300 || !/^https?:\/\/\S+$/.test(site)) {
        throw new Error("Website must be an http(s) URL under 300 characters.");
      } else {
        updated.websiteUrl = site;
      }
    }
    await this.opts.store.updateCreator(updated);
    return updated;
  }

  /** Edits a listing's mutable fields, including pause/activate/archive. */
  async updateListing(input: {
    listingId: ListingId;
    title?: string;
    description?: string;
    priceAmount?: number;
    priceCurrency?: string;
    status?: Listing["status"];
  }): Promise<Listing> {
    const listing = await this.opts.store.getListing(input.listingId);
    if (!listing) throw new Error("Listing not found.");
    const updated: Listing = { ...listing };
    if (input.title !== undefined) {
      const title = input.title.trim();
      if (title.length < 1 || title.length > 120) {
        throw new Error("Title must be 1–120 characters.");
      }
      updated.title = title;
    }
    if (input.description !== undefined) {
      const description = input.description.trim();
      if (description.length > 1000) {
        throw new Error("Description must be 1000 characters or fewer.");
      }
      updated.description = description;
    }
    if (input.priceAmount !== undefined) {
      if (
        !Number.isInteger(input.priceAmount) ||
        input.priceAmount < 1 ||
        input.priceAmount > 100_000_00
      ) {
        throw new Error("Price must be a whole number of cents between 1 and 10,000,000.");
      }
      updated.priceAmount = input.priceAmount;
    }
    if (input.priceCurrency !== undefined) {
      const currency = input.priceCurrency.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a 3-letter code.");
      updated.priceCurrency = currency;
    }
    if (input.status !== undefined) {
      if (!["active", "paused", "archived"].includes(input.status)) {
        throw new Error("Status must be active, paused, or archived.");
      }
      updated.status = input.status;
    }
    updated.updatedAt = new Date().toISOString();
    await this.opts.store.updateListing(updated);
    return updated;
  }

  /**
   * Deletes a listing and its asset chain. Refuses if the listing has any
   * purchase — those carry buyer licenses/receipts whose verification must keep
   * working; the creator should archive (unlist) such listings instead.
   */
  async deleteListing(listingId: ListingId): Promise<{ deleted: true }> {
    const { store } = this.opts;
    const listing = await store.getListing(listingId);
    if (!listing) throw new Error("Listing not found.");
    const hasPurchases = (await store.listPurchases()).some(
      (entry) => entry.listingId === listingId
    );
    if (hasPurchases) {
      throw new Error(
        "This listing has purchases and cannot be deleted; archive (unlist) it instead so buyers keep verifiable receipts."
      );
    }
    await store.deleteListingCascade(listingId);
    return { deleted: true };
  }

  /** True when direct-payout (Stripe Connect) mode is active. */
  connectEnabled(): boolean {
    return this.opts.connect?.enabled === true;
  }

  private connectAdapter(): ConnectOps {
    const adapter = this.opts.payments as Partial<ConnectOps>;
    if (
      typeof adapter.createConnectedAccount !== "function" ||
      typeof adapter.createOnboardingLink !== "function" ||
      typeof adapter.getAccountStatus !== "function"
    ) {
      throw new Error(
        "The active payment provider does not support direct payouts (Stripe Connect)."
      );
    }
    return adapter as ConnectOps;
  }

  /** Public site origin for Stripe onboarding return URLs (never client-supplied). */
  private connectPublicBaseUrl(): string {
    const configured = this.opts.connect?.publicBaseUrl;
    if (configured) return configured.replace(/\/+$/, "");
    try {
      return new URL(this.opts.verificationUrlBase).origin;
    } catch {
      return "https://mydigital.imagineqira.com";
    }
  }

  /**
   * Starts (or resumes) the creator's Stripe Connect onboarding and returns a
   * hosted onboarding URL. Creates the connected account on first use; the
   * creator completes bank/identity details on Stripe's own pages. Return URLs
   * are derived server-side from the configured public origin — never taken
   * from the request — so they can't be turned into an open redirect.
   */
  async startCreatorPayoutOnboarding(): Promise<{ url: string; accountId: string }> {
    const { store } = this.opts;
    const creator = (await store.listCreators())[0];
    if (!creator) throw new Error("Create the creator profile first.");
    const connect = this.connectAdapter();
    let accountId = creator.stripeAccountId;
    if (!accountId) {
      accountId = await connect.createConnectedAccount({});
      await store.updateCreator({ ...creator, stripeAccountId: accountId });
    }
    const base = this.connectPublicBaseUrl();
    const url = await connect.createOnboardingLink({
      accountId,
      returnUrl: `${base}/creator?payouts=return`,
      refreshUrl: `${base}/creator?payouts=refresh`
    });
    return { url, accountId };
  }

  /** Re-checks the connected account with Stripe and stores the payout status. */
  async refreshCreatorPayoutStatus(): Promise<{
    stripeAccountId?: string;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
  }> {
    const { store } = this.opts;
    const creator = (await store.listCreators())[0];
    if (!creator) throw new Error("Create the creator profile first.");
    if (!creator.stripeAccountId) {
      return { chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false };
    }
    const connect = this.connectAdapter();
    const status = await connect.getAccountStatus(creator.stripeAccountId);
    const payoutsEnabled = status.payoutsEnabled && status.chargesEnabled;
    await store.updateCreator({ ...creator, payoutsEnabled });
    return {
      stripeAccountId: creator.stripeAccountId,
      chargesEnabled: status.chargesEnabled,
      payoutsEnabled,
      detailsSubmitted: status.detailsSubmitted
    };
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
    if (
      !Number.isInteger(input.priceAmount) ||
      input.priceAmount < 1 ||
      input.priceAmount > 100_000_00
    ) {
      throw new Error("Price must be a whole number of cents between 1 and 10,000,000.");
    }
    const priceCurrency = input.priceCurrency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(priceCurrency)) {
      throw new Error("Currency must be a 3-letter code.");
    }
    if (typeof input.title !== "string" || input.title.trim().length === 0) {
      throw new Error("Title is required.");
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
      priceCurrency,
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

    // Direct-payout mode: route the charge to the creator's connected account so
    // funds settle to the creator, not the platform. Block sale until ready.
    let connectExtras: { connectedAccountId: string; applicationFeeAmount: number } | undefined;
    if (this.connectEnabled()) {
      const creator = await store.getCreator(listing.creatorId);
      if (!creator?.stripeAccountId || creator.payoutsEnabled !== true) {
        throw new Error(
          "This creator has not finished setting up direct payouts, so this listing cannot be purchased yet."
        );
      }
      const feeBps = this.opts.connect?.applicationFeeBps ?? 0;
      connectExtras = {
        connectedAccountId: creator.stripeAccountId,
        applicationFeeAmount: Math.round((listing.priceAmount * feeBps) / 10000)
      };
    }

    const session = await payments.createCheckout({ listing, buyer, ...(connectExtras ?? {}) });
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
        signature: string,
        resolveSession?: (
          providerReference: string
        ) => Promise<CheckoutSession | undefined> | CheckoutSession | undefined
      ) => Promise<PaymentConfirmation | null>;
    };
    if (!adapter.confirmFromWebhook) {
      throw new Error("The active payment adapter does not support webhooks.");
    }
    // Rehydrate the persisted session if the adapter's in-memory map was lost
    // (e.g. a Worker isolate recycle between begin and the webhook delivery).
    const confirmation = await adapter.confirmFromWebhook(rawBody, signature, async (ref) => {
      const row = await store.getCheckoutSessionByProviderReference(ref);
      if (!row) return undefined;
      const { purchaseId: _purchaseId, ...session } = row;
      return session;
    });
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
