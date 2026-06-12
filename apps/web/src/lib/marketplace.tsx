import {
  bytesToBase64,
  importIssuerPublicKey,
  sha256Hex,
  verifyBuyerLicense,
  verifyProofReceipt
} from "@my-digital/core";
import type {
  Asset,
  AssetVersion,
  BuyerLicense,
  Creator,
  LicenseId,
  LicenseTerms,
  ListingId,
  Listing,
  LockedAsset,
  LockedAssetId,
  ProofReceipt,
  ProofReceiptId,
  VerificationResult
} from "@my-digital/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { api, type ReceiptBundle, type ServerCheckoutOutcome, type ServerState } from "./api";
import { checkDemoCryptoSupport } from "./capability";

export const RECEIPT_BUNDLE_KIND = "MYDIGITAL-RECEIPT-BUNDLE-V1";

/** The QEV adapter (and libsodium) loads lazily, only when actually unlocking. */
async function loadQevAdapter() {
  const { QevVaultV2EnvelopeAdapter } = await import("@my-digital/envelope");
  return new QevVaultV2EnvelopeAdapter();
}

function emptyServerState(): ServerState {
  return {
    issuer: { name: "", publicKeyB64: "" },
    creator: null,
    buyers: [],
    assets: [],
    assetVersions: [],
    lockedAssets: [],
    listings: [],
    purchases: [],
    licenses: [],
    unlockCodes: [],
    receipts: [],
    revocations: []
  };
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

export type CheckoutResult = ServerCheckoutOutcome;

export interface UnlockOutcome {
  license: BuyerLicense;
  fileName: string;
  mimeType: string;
  verifications: {
    license: VerificationResult;
    unlock?: VerificationResult;
  };
  /** Null when verification failed and no plaintext was produced. */
  plaintext: Uint8Array | null;
}

export interface LocalVaultUnlockOutcome {
  verification: VerificationResult;
  plaintext: Uint8Array | null;
}

export interface PastedReceiptVerification {
  result: VerificationResult;
  keySource: "pasted-bundle" | "local-issuer";
}

export interface LockedAssetVerification {
  integrity: VerificationResult;
  structure: VerificationResult;
}

interface MarketplaceActions {
  refresh(): Promise<void>;
  ensureCreator(input: { displayName: string; handle: string; email: string }): Promise<Creator>;
  createLockedListing(input: CreateLockedListingInput): Promise<CreateLockedListingResult>;
  buyListing(input: {
    listingId: ListingId;
    email: string;
    displayName?: string;
    simulateOutcome?: "paid" | "failed";
  }): Promise<CheckoutResult>;
  fetchBuyerVault(licenseId: LicenseId): Promise<Uint8Array>;
  unlockWithCode(input: { licenseId: LicenseId; rawCode: string }): Promise<UnlockOutcome>;
  unlockVaultBytes(input: {
    bytes: Uint8Array;
    rawCode: string;
  }): Promise<LocalVaultUnlockOutcome>;
  revokeLicense(licenseId: LicenseId, reason: string): Promise<void>;
  verifyLicenseRecord(licenseId: LicenseId): Promise<VerificationResult>;
  verifyReceiptRecord(receiptId: ProofReceiptId): Promise<VerificationResult>;
  verifyPastedReceipt(text: string): Promise<PastedReceiptVerification>;
  verifyLockedAsset(
    lockedAssetId: LockedAssetId,
    options?: { simulateTamper?: boolean }
  ): Promise<LockedAssetVerification>;
  getReceiptBundle(receiptId: ProofReceiptId): Promise<ReceiptBundle>;
  resetDemo(): Promise<void>;
}

interface MarketplaceContextValue {
  status: "loading" | "offline" | "unsupported" | "ready";
  unsupportedReason: string | null;
  state: ServerState;
  actions: MarketplaceActions;
}

const MarketplaceContext = createContext<MarketplaceContextValue | null>(null);

export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<MarketplaceContextValue["status"]>("loading");
  const [unsupportedReason, setUnsupportedReason] = useState<string | null>(null);
  const [state, setState] = useState<ServerState>(emptyServerState);
  const stateRef = useRef(state);

  const refresh = useCallback(async (): Promise<void> => {
    const next = await api.getState();
    stateRef.current = next;
    setState(next);
  }, []);

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
      try {
        await refresh();
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("offline");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const actions = useMemo<MarketplaceActions>(() => {
    const current = (): ServerState => stateRef.current;

    const issuerKey = async (): Promise<CryptoKey> => {
      const publicKeyB64 = current().issuer.publicKeyB64;
      if (publicKeyB64.length === 0) throw new Error("The server issuer is not available.");
      return importIssuerPublicKey(publicKeyB64);
    };

    const findOrThrow = <T,>(value: T | undefined, what: string): T => {
      if (value === undefined) throw new Error(`${what} was not found in the marketplace records.`);
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
      return { license, asset, assetVersion, lockedAsset };
    };

    return {
      refresh,

      async ensureCreator(input) {
        const creator = await api.ensureCreator(input);
        await refresh();
        return creator;
      },

      async createLockedListing(input) {
        if (input.bytes.byteLength === 0) {
          throw new Error("The product content is empty. Add text content or choose a file.");
        }
        if (input.bytes.byteLength > 2_000_000) {
          throw new Error("Keep files under 2 MB in the dev instance.");
        }
        const result = await api.createListing({
          title: input.title,
          description: input.description,
          category: input.category,
          priceAmount: input.priceAmount,
          priceCurrency: input.priceCurrency,
          licenseTerms: input.licenseTerms,
          fileName: input.fileName,
          mimeType: input.mimeType,
          payloadB64: bytesToBase64(input.bytes)
        });
        await refresh();
        return result;
      },

      async buyListing(input) {
        const outcome = await api.checkout({
          listingId: input.listingId,
          email: input.email,
          ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
          ...(input.simulateOutcome === "failed" ? { simulateOutcome: "failed" as const } : {})
        });
        await refresh();
        return outcome;
      },

      async fetchBuyerVault(licenseId) {
        return api.fetchBuyerVault(licenseId);
      },

      async unlockWithCode(input) {
        const { license, asset, assetVersion, lockedAsset } = licenseRecords(input.licenseId);
        const licenseVerification = await verifyBuyerLicense({
          license,
          issuerPublicKey: await issuerKey(),
          expected: {
            assetId: asset.id,
            assetVersionId: assetVersion.id,
            lockedAssetId: lockedAsset.id,
            buyerId: license.buyerId
          }
        });
        if (licenseVerification.status === "fail") {
          return {
            license,
            fileName: assetVersion.fileName,
            mimeType: assetVersion.mimeType,
            verifications: { license: licenseVerification },
            plaintext: null
          };
        }
        const vaultBytes = await api.fetchBuyerVault(license.id);
        const adapter = await loadQevAdapter();
        const unlockResult = await adapter.unlock({
          lockedPayload: vaultBytes,
          licenseMaterial: input.rawCode
        });
        const unlocked = unlockResult.verification.status !== "fail";
        return {
          license,
          fileName: assetVersion.fileName,
          mimeType: assetVersion.mimeType,
          verifications: { license: licenseVerification, unlock: unlockResult.verification },
          plaintext: unlocked ? unlockResult.plaintext : null
        };
      },

      async unlockVaultBytes(input) {
        const adapter = await loadQevAdapter();
        const unlockResult = await adapter.unlock({
          lockedPayload: input.bytes,
          licenseMaterial: input.rawCode
        });
        return {
          verification: unlockResult.verification,
          plaintext:
            unlockResult.verification.status !== "fail" ? unlockResult.plaintext : null
        };
      },

      async revokeLicense(licenseId, reason) {
        await api.revokeLicense(licenseId, reason);
        await refresh();
      },

      async verifyLicenseRecord(licenseId) {
        return api.verifyLicense(licenseId);
      },

      async verifyReceiptRecord(receiptId) {
        const receipt = findOrThrow(
          current().receipts.find((entry) => entry.id === receiptId),
          "Receipt"
        );
        return verifyProofReceipt({
          receipt,
          issuerPublicKey: await issuerKey(),
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
          publicKey = await issuerKey();
          keySource = "local-issuer";
        } else {
          throw new Error("The pasted JSON is neither a receipt bundle nor a proof receipt object.");
        }
        const result = await verifyProofReceipt({ receipt, issuerPublicKey: publicKey });
        return { result, keySource };
      },

      async verifyLockedAsset(lockedAssetId, options) {
        const lockedAsset = findOrThrow(
          current().lockedAssets.find((entry) => entry.id === lockedAssetId),
          "Locked asset"
        );
        const payload = await api.fetchBaseLockedPayload(lockedAsset.id);
        if (options?.simulateTamper === true) {
          // Flips one byte of the downloaded copy; server records are unchanged.
          payload[0] = (payload[0] ?? 0) ^ 0xff;
        }
        const [{ compareRecordedHashes }, adapter] = await Promise.all([
          import("@my-digital/envelope"),
          loadQevAdapter()
        ]);
        const integrity = compareRecordedHashes(
          {
            lockedAssetId: lockedAsset.id,
            expectedLockedPayloadHash: lockedAsset.lockedPayloadHash,
            actualLockedPayloadHash: await sha256Hex(payload),
            expectedMetadataHash: lockedAsset.metadataHash,
            actualMetadataHash: lockedAsset.metadataHash
          },
          {
            demoOnly: false,
            assumptions: [
              "Expected hashes come from the marketplace records served by the API.",
              "Cryptographic integrity of the vault content is enforced by AEAD at unlock."
            ]
          }
        );
        const structure = await adapter.verifyVaultStructure(payload);
        return { integrity, structure };
      },

      async getReceiptBundle(receiptId) {
        return api.getReceiptBundle(receiptId);
      },

      async resetDemo() {
        await api.reset();
        await refresh();
      }
    };
  }, [refresh]);

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
