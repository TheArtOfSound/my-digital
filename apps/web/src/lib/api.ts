import type {
  Asset,
  AssetVersion,
  Buyer,
  BuyerLicense,
  Creator,
  Fingerprint,
  LicenseId,
  LicenseTerms,
  Listing,
  LockedAsset,
  LockedAssetId,
  ProofReceipt,
  ProofReceiptId,
  Purchase,
  Revocation,
  TraceResult,
  UnlockCode,
  VerificationResult
} from "@my-digital/types";

/** Wire shape of GET /api/state. */
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

export interface BuyerLibrary {
  buyer: Buyer;
  purchases: Purchase[];
  licenses: BuyerLicense[];
  receipts: ProofReceipt[];
}

export type ServerCheckoutOutcome =
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

export interface ReceiptBundle {
  kind: "MYDIGITAL-RECEIPT-BUNDLE-V1";
  receipt: ProofReceipt;
  issuer: { name: string; publicKeyB64: string };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Non-JSON error body; keep the status message.
    }
    throw new ApiError(message, response.status);
  }
  return (await response.json()) as T;
}

async function requestBytes(path: string): Promise<Uint8Array> {
  const response = await fetch(path);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Keep status message.
    }
    throw new ApiError(message, response.status);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function postJson(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}

export const api = {
  getState: () => requestJson<ServerState>("/api/state"),
  ensureCreator: (input: { displayName: string; handle: string; email: string }) =>
    requestJson<Creator>("/api/creator", postJson(input)),
  createListing: (input: {
    title: string;
    description: string;
    category: string;
    priceAmount: number;
    priceCurrency: string;
    licenseTerms: LicenseTerms;
    fileName: string;
    mimeType: string;
    payloadB64: string;
  }) =>
    requestJson<{
      asset: Asset;
      assetVersion: AssetVersion;
      lockedAsset: LockedAsset;
      listing: Listing;
    }>("/api/listings", postJson(input)),
  checkout: (input: {
    listingId: string;
    email: string;
    displayName?: string;
    simulateOutcome?: "paid" | "failed";
  }) => requestJson<ServerCheckoutOutcome>("/api/checkout", postJson(input)),
  fetchBuyerVault: (licenseId: LicenseId) => requestBytes(`/api/licenses/${licenseId}/vault`),
  fetchBaseLockedPayload: (lockedAssetId: LockedAssetId) =>
    requestBytes(`/api/locked-assets/${lockedAssetId}/payload`),
  revokeLicense: (licenseId: LicenseId, reason: string) =>
    requestJson<Revocation>(`/api/licenses/${licenseId}/revoke`, postJson({ reason })),
  verifyLicense: (licenseId: LicenseId) =>
    requestJson<VerificationResult>(`/api/licenses/${licenseId}/verify`),
  getReceiptBundle: (receiptId: ProofReceiptId) =>
    requestJson<ReceiptBundle>(`/api/receipts/${receiptId}/bundle`),
  trace: (artifactB64: string) =>
    requestJson<TraceResult>("/api/trace", postJson({ artifactB64 })),
  getBuyerLibrary: (emailHash: string) =>
    requestJson<BuyerLibrary>(`/api/buyers/${emailHash}/library`),
  reset: () => requestJson<{ ok: boolean }>("/api/admin/reset", { method: "POST" })
};
