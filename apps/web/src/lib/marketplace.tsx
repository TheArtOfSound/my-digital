import {
  base64ToBytes,
  bytesToBase64,
  createAsset,
  createAssetVersion,
  createBuyer,
  createCreator,
  createListing,
  createLockedAssetRecord,
  generateIssuerSigningKeys,
  generateProofReceipt,
  hashEmail,
  importIssuerPublicKey,
  issueBuyerLicense,
  issueUnlockCode,
  newRevocationId,
  redeemUnlockCode,
  sha256Hex,
  signCanonical,
  simulatePaidPurchase,
  verifyBuyerLicense,
  verifyProofReceipt,
  verifyUnlockCode
} from "@my-digital/core";
import { DemoEnvelopeAdapter } from "@my-digital/envelope";
import type {
  Asset,
  AssetVersion,
  Buyer,
  BuyerLicense,
  Creator,
  LicenseId,
  LicenseTerms,
  Listing,
  ListingId,
  LockedAsset,
  LockedAssetId,
  ProofReceipt,
  ProofReceiptId,
  Purchase,
  Revocation,
  UnlockCode,
  VerificationResult
} from "@my-digital/types";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { checkDemoCryptoSupport } from "./capability";
import {
  deserializeMarketplaceState,
  emptyMarketplaceState,
  serializeMarketplaceState,
  type MarketplaceState
} from "./serialization";

const STORAGE_KEY = "mydigital-demo-marketplace-v1";
const ISSUER_NAME = "my-digital-demo-issuer";
const VERIFICATION_URL_BASE = "https://mydigital.imagineqira.com/verify";
const MAX_PAYLOAD_BYTES = 2_000_000;

export const RECEIPT_BUNDLE_KIND = "MYDIGITAL-RECEIPT-BUNDLE-V1";

export interface ReceiptBundle {
  kind: typeof RECEIPT_BUNDLE_KIND;
  demoOnly: true;
  receipt: ProofReceipt;
  issuer: { name: string; publicKeyB64: string };
}

export interface CreateLockedListingInput {
  title: string;
  description: string;
  category: string;
  priceAmount: number;
  priceCurrency: string;
  licenseTerms: LicenseTerms;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface CreateLockedListingResult {
  asset: Asset;
  assetVersion: AssetVersion;
  lockedAsset: LockedAsset;
  listing: Listing;
}

export interface PurchaseBundle {
  buyer: Buyer;
  purchase: Purchase;
  license: BuyerLicense;
  unlockCode: UnlockCode;
  rawUnlockCode: string;
  receipt: ProofReceipt;
}

export interface UnlockOutcome {
  license: BuyerLicense;
  fileName: string;
  mimeType: string;
  verifications: {
    license: VerificationResult;
    unlockCode: VerificationResult;
    envelope: VerificationResult;
    unlock?: VerificationResult;
  };
  /** Null when verification failed and no plaintext was returned. */
  plaintext: Uint8Array | null;
}

export interface PastedReceiptVerification {
  result: VerificationResult;
  keySource: "pasted-bundle" | "local-issuer";
}

interface MarketplaceActions {
  ensureCreator(input: { displayName: string; handle: string; email: string }): Promise<Creator>;
  createLockedListing(input: CreateLockedListingInput): Promise<CreateLockedListingResult>;
  buyListing(input: {
    listingId: ListingId;
    email: string;
    displayName?: string;
  }): Promise<PurchaseBundle>;
  unlockWithCode(input: { licenseId: LicenseId; rawCode: string }): Promise<UnlockOutcome>;
  revokeLicense(licenseId: LicenseId, reason: string): Promise<Revocation>;
  verifyLicenseRecord(licenseId: LicenseId): Promise<VerificationResult>;
  verifyReceiptRecord(receiptId: ProofReceiptId): Promise<VerificationResult>;
  verifyPastedReceipt(text: string): Promise<PastedReceiptVerification>;
  verifyLockedAsset(
    lockedAssetId: LockedAssetId,
    options?: { simulateTamper?: boolean }
  ): Promise<VerificationResult>;
  makeReceiptBundle(receiptId: ProofReceiptId): ReceiptBundle;
  resetDemo(): void;
}

interface MarketplaceContextValue {
  status: "loading" | "unsupported" | "ready";
  unsupportedReason: string | null;
  state: MarketplaceState;
  actions: MarketplaceActions;
}

const MarketplaceContext = createContext<MarketplaceContextValue | null>(null);

export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "unsupported" | "ready">("loading");
  const [unsupportedReason, setUnsupportedReason] = useState<string | null>(null);
  const [state, setState] = useState<MarketplaceState>(emptyMarketplaceState);
  const stateRef = useRef(state);
  const privateKeyRef = useRef<CryptoKey | null>(null);
  const publicKeyRef = useRef<CryptoKey | null>(null);
  const adapter = useMemo(() => new DemoEnvelopeAdapter(), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const support = await checkDemoCryptoSupport();
      if (cancelled) return;
      if (!support.supported) {
        setUnsupportedReason(support.reason ?? "Unsupported browser.");
        setStatus("unsupported");
        return;
      }

      const storedText = localStorage.getItem(STORAGE_KEY);
      let loaded = storedText !== null ? deserializeMarketplaceState(storedText) : null;
      loaded ??= emptyMarketplaceState();

      if (loaded.issuer) {
        try {
          privateKeyRef.current = await crypto.subtle.importKey(
            "jwk",
            loaded.issuer.privateJwk,
            { name: "Ed25519" },
            true,
            ["sign"]
          );
          publicKeyRef.current = await importIssuerPublicKey(loaded.issuer.publicKeyB64);
        } catch {
          loaded = { ...loaded, issuer: null };
        }
      }
      if (!loaded.issuer) {
        const keys = await generateIssuerSigningKeys(ISSUER_NAME);
        const privateJwk = await crypto.subtle.exportKey("jwk", keys.privateKey);
        privateKeyRef.current = keys.privateKey;
        publicKeyRef.current = keys.publicKey;
        loaded = {
          ...loaded,
          issuer: { name: keys.issuer, publicKeyB64: keys.publicKeyB64, privateJwk }
        };
      }

      if (cancelled) return;
      stateRef.current = loaded;
      setState(loaded);
      try {
        localStorage.setItem(STORAGE_KEY, serializeMarketplaceState(loaded));
      } catch {
        // Persisting at startup is best-effort; actions surface storage errors.
      }
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const actions = useMemo<MarketplaceActions>(() => {
    const current = (): MarketplaceState => stateRef.current;

    const apply = (next: MarketplaceState): void => {
      try {
        localStorage.setItem(STORAGE_KEY, serializeMarketplaceState(next));
      } catch {
        throw new Error(
          "Browser storage is full or unavailable, so the demo could not persist this change. Try a smaller file or reset the demo data."
        );
      }
      stateRef.current = next;
      setState(next);
    };

    const requirePrivateKey = (): CryptoKey => {
      const key = privateKeyRef.current;
      if (!key) throw new Error("Demo issuer key is not ready yet.");
      return key;
    };

    const requirePublicKey = (): CryptoKey => {
      const key = publicKeyRef.current;
      if (!key) throw new Error("Demo issuer key is not ready yet.");
      return key;
    };

    const findOrThrow = <T,>(value: T | undefined, what: string): T => {
      if (value === undefined) throw new Error(`${what} was not found in the demo records.`);
      return value;
    };

    const licenseRecords = (licenseId: LicenseId) => {
      const stateNow = current();
      const license = findOrThrow(
        stateNow.licenses.find((entry) => entry.id === licenseId),
        "License"
      );
      const asset = findOrThrow(
        stateNow.assets.find((entry) => entry.id === license.assetId),
        "Asset"
      );
      const assetVersion = findOrThrow(
        stateNow.assetVersions.find((entry) => entry.id === license.assetVersionId),
        "Asset version"
      );
      const lockedAsset = findOrThrow(
        stateNow.lockedAssets.find((entry) => entry.id === license.lockedAssetId),
        "Locked asset"
      );
      return { stateNow, license, asset, assetVersion, lockedAsset };
    };

    return {
      async ensureCreator(input) {
        const existing = current().creator;
        if (existing) return existing;
        const creator = await createCreator(input);
        apply({ ...current(), creator });
        return creator;
      },

      async createLockedListing(input) {
        const stateNow = current();
        if (!stateNow.creator) {
          throw new Error("Create the demo creator profile first (on the Creator page or above).");
        }
        if (input.bytes.byteLength === 0) {
          throw new Error("The product content is empty. Add text content or choose a file.");
        }
        if (input.bytes.byteLength > MAX_PAYLOAD_BYTES) {
          throw new Error(
            "The demo stores locked payloads in browser localStorage. Keep files under 2 MB."
          );
        }

        let asset = createAsset({
          creatorId: stateNow.creator.id,
          title: input.title,
          description: input.description,
          category: input.category
        });
        const { assetVersion, manifest } = await createAssetVersion({
          asset,
          versionLabel: "1.0.0",
          fileName: input.fileName,
          mimeType: input.mimeType,
          bytes: input.bytes
        });
        const lockResult = await adapter.lock({
          assetVersionId: assetVersion.id,
          fileName: assetVersion.fileName,
          mimeType: assetVersion.mimeType,
          plaintext: input.bytes
        });
        const lockedAsset = createLockedAssetRecord({
          assetVersionId: assetVersion.id,
          lockResult
        });
        const listing = createListing({
          asset,
          activeAssetVersionId: assetVersion.id,
          priceAmount: input.priceAmount,
          priceCurrency: input.priceCurrency,
          licenseTerms: input.licenseTerms
        });
        asset = { ...asset, status: "listed" };

        apply({
          ...stateNow,
          assets: [...stateNow.assets, asset],
          assetVersions: [...stateNow.assetVersions, assetVersion],
          manifests: [...stateNow.manifests, manifest],
          lockedAssets: [...stateNow.lockedAssets, lockedAsset],
          lockedPayloadsB64: {
            ...stateNow.lockedPayloadsB64,
            [lockedAsset.id]: bytesToBase64(lockResult.lockedPayload)
          },
          listings: [...stateNow.listings, listing]
        });
        return { asset, assetVersion, lockedAsset, listing };
      },

      async buyListing(input) {
        const stateNow = current();
        const issuer = findOrThrow(stateNow.issuer ?? undefined, "Demo issuer");
        const listing = findOrThrow(
          stateNow.listings.find((entry) => entry.id === input.listingId),
          "Listing"
        );
        const asset = findOrThrow(
          stateNow.assets.find((entry) => entry.id === listing.assetId),
          "Asset"
        );
        const assetVersion = findOrThrow(
          stateNow.assetVersions.find((entry) => entry.id === listing.activeAssetVersionId),
          "Asset version"
        );
        const lockedAsset = findOrThrow(
          stateNow.lockedAssets.find((entry) => entry.assetVersionId === assetVersion.id),
          "Locked asset"
        );

        const emailHash = await hashEmail(input.email);
        const buyer =
          stateNow.buyers.find((entry) => entry.emailHash === emailHash) ??
          (await createBuyer(
            input.displayName !== undefined
              ? { email: input.email, displayName: input.displayName }
              : { email: input.email }
          ));

        const purchase = simulatePaidPurchase({ listing, buyer });
        const license = await issueBuyerLicense({
          purchase,
          buyer,
          asset,
          assetVersion,
          lockedAsset,
          terms: listing.licenseTerms,
          issuer: issuer.name,
          issuerPrivateKey: requirePrivateKey()
        });
        const { unlockCode, rawCode } = await issueUnlockCode({ licenseId: license.id });
        const receipt = await generateProofReceipt({
          purchase,
          license,
          creatorId: asset.creatorId,
          issuerPrivateKey: requirePrivateKey(),
          verificationUrlBase: VERIFICATION_URL_BASE
        });

        apply({
          ...stateNow,
          buyers: stateNow.buyers.some((entry) => entry.id === buyer.id)
            ? stateNow.buyers
            : [...stateNow.buyers, buyer],
          purchases: [...stateNow.purchases, purchase],
          licenses: [...stateNow.licenses, license],
          unlockCodes: [...stateNow.unlockCodes, unlockCode],
          receipts: [...stateNow.receipts, receipt]
        });
        return { buyer, purchase, license, unlockCode, rawUnlockCode: rawCode, receipt };
      },

      async unlockWithCode(input) {
        const { stateNow, license, asset, assetVersion, lockedAsset } = licenseRecords(
          input.licenseId
        );
        const unlockCodeRecord = findOrThrow(
          stateNow.unlockCodes.find((entry) => entry.licenseId === license.id),
          "Unlock code record"
        );
        const payloadB64 = stateNow.lockedPayloadsB64[lockedAsset.id];
        const lockedPayload = base64ToBytes(
          findOrThrow(payloadB64, "Locked payload for this asset")
        );

        const licenseVerification = await verifyBuyerLicense({
          license,
          issuerPublicKey: requirePublicKey(),
          expected: {
            assetId: asset.id,
            assetVersionId: assetVersion.id,
            lockedAssetId: lockedAsset.id,
            buyerId: license.buyerId
          }
        });
        const codeVerification = await verifyUnlockCode({
          rawCode: input.rawCode,
          unlockCode: unlockCodeRecord
        });
        const envelopeVerification = await adapter.verify({
          lockedAssetId: lockedAsset.id,
          expectedLockedPayloadHash: lockedAsset.lockedPayloadHash,
          actualLockedPayloadHash: await sha256Hex(lockedPayload),
          expectedMetadataHash: lockedAsset.metadataHash,
          actualMetadataHash: lockedAsset.metadataHash
        });

        const blocked =
          licenseVerification.status === "fail" ||
          codeVerification.status === "fail" ||
          envelopeVerification.status === "fail";
        if (blocked) {
          return {
            license,
            fileName: assetVersion.fileName,
            mimeType: assetVersion.mimeType,
            verifications: {
              license: licenseVerification,
              unlockCode: codeVerification,
              envelope: envelopeVerification
            },
            plaintext: null
          };
        }

        const unlockResult = await adapter.unlock({
          lockedPayload,
          licenseMaterial: input.rawCode
        });
        const unlocked = unlockResult.verification.status !== "fail";
        if (unlocked) {
          const redeemed = redeemUnlockCode(unlockCodeRecord);
          apply({
            ...current(),
            unlockCodes: current().unlockCodes.map((entry) =>
              entry.id === redeemed.id ? redeemed : entry
            )
          });
        }
        return {
          license,
          fileName: assetVersion.fileName,
          mimeType: assetVersion.mimeType,
          verifications: {
            license: licenseVerification,
            unlockCode: codeVerification,
            envelope: envelopeVerification,
            unlock: unlockResult.verification
          },
          plaintext: unlocked ? unlockResult.plaintext : null
        };
      },

      async revokeLicense(licenseId, reason) {
        const stateNow = current();
        const license = findOrThrow(
          stateNow.licenses.find((entry) => entry.id === licenseId),
          "License"
        );
        if (license.revokedAt !== undefined) {
          throw new Error("This license is already revoked.");
        }
        const createdAt = new Date().toISOString();
        const createdBy = stateNow.creator?.id ?? ISSUER_NAME;
        const revocationCore = {
          id: newRevocationId(),
          targetType: "license" as const,
          targetId: licenseId,
          reason,
          createdAt,
          createdBy
        };
        const revocation: Revocation = {
          ...revocationCore,
          issuerSignature: await signCanonical(requirePrivateKey(), revocationCore)
        };
        apply({
          ...stateNow,
          licenses: stateNow.licenses.map((entry) =>
            entry.id === licenseId ? { ...entry, revokedAt: createdAt } : entry
          ),
          revocations: [...stateNow.revocations, revocation]
        });
        return revocation;
      },

      async verifyLicenseRecord(licenseId) {
        const { license, asset, assetVersion, lockedAsset } = licenseRecords(licenseId);
        return verifyBuyerLicense({
          license,
          issuerPublicKey: requirePublicKey(),
          expected: {
            assetId: asset.id,
            assetVersionId: assetVersion.id,
            lockedAssetId: lockedAsset.id,
            buyerId: license.buyerId
          }
        });
      },

      async verifyReceiptRecord(receiptId) {
        const stateNow = current();
        const receipt = findOrThrow(
          stateNow.receipts.find((entry) => entry.id === receiptId),
          "Receipt"
        );
        return verifyProofReceipt({
          receipt,
          issuerPublicKey: requirePublicKey(),
          expected: { purchaseId: receipt.purchaseId, licenseId: receipt.licenseId }
        });
      },

      async verifyPastedReceipt(text) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error("The pasted text is not valid JSON.");
        }
        const candidate = parsed as Partial<ReceiptBundle> & Partial<ProofReceipt>;
        let receipt: ProofReceipt;
        let keySource: PastedReceiptVerification["keySource"];
        let publicKey: CryptoKey;
        if (candidate.kind === RECEIPT_BUNDLE_KIND && candidate.receipt && candidate.issuer) {
          receipt = candidate.receipt;
          try {
            publicKey = await importIssuerPublicKey(candidate.issuer.publicKeyB64);
          } catch {
            throw new Error("The bundle's issuer public key could not be imported.");
          }
          keySource = "pasted-bundle";
        } else if (
          typeof candidate.id === "string" &&
          typeof candidate.receiptHash === "string" &&
          typeof candidate.issuerSignature === "string"
        ) {
          receipt = candidate as ProofReceipt;
          publicKey = requirePublicKey();
          keySource = "local-issuer";
        } else {
          throw new Error(
            "The pasted JSON is neither a receipt bundle nor a proof receipt object."
          );
        }
        const result = await verifyProofReceipt({ receipt, issuerPublicKey: publicKey });
        return { result, keySource };
      },

      async verifyLockedAsset(lockedAssetId, options) {
        const stateNow = current();
        const lockedAsset = findOrThrow(
          stateNow.lockedAssets.find((entry) => entry.id === lockedAssetId),
          "Locked asset"
        );
        const payload = base64ToBytes(
          findOrThrow(stateNow.lockedPayloadsB64[lockedAsset.id], "Locked payload")
        );
        if (options?.simulateTamper === true) {
          // Flips one byte of an in-memory copy; the stored payload is unchanged.
          payload[0] = (payload[0] ?? 0) ^ 0xff;
        }
        return adapter.verify({
          lockedAssetId: lockedAsset.id,
          expectedLockedPayloadHash: lockedAsset.lockedPayloadHash,
          actualLockedPayloadHash: await sha256Hex(payload),
          expectedMetadataHash: lockedAsset.metadataHash,
          actualMetadataHash: lockedAsset.metadataHash
        });
      },

      makeReceiptBundle(receiptId) {
        const stateNow = current();
        const receipt = findOrThrow(
          stateNow.receipts.find((entry) => entry.id === receiptId),
          "Receipt"
        );
        const issuer = findOrThrow(stateNow.issuer ?? undefined, "Demo issuer");
        return {
          kind: RECEIPT_BUNDLE_KIND,
          demoOnly: true,
          receipt,
          issuer: { name: issuer.name, publicKeyB64: issuer.publicKeyB64 }
        };
      },

      resetDemo() {
        localStorage.removeItem(STORAGE_KEY);
        window.location.reload();
      }
    };
  }, [adapter]);

  const value = useMemo<MarketplaceContextValue>(
    () => ({ status, unsupportedReason, state, actions }),
    [status, unsupportedReason, state, actions]
  );

  return <MarketplaceContext.Provider value={value}>{children}</MarketplaceContext.Provider>;
}

export function useMarketplace(): MarketplaceContextValue {
  const context = useContext(MarketplaceContext);
  if (!context) throw new Error("useMarketplace must be used inside MarketplaceProvider.");
  return context;
}
