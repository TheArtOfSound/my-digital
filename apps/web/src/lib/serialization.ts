import type {
  Asset,
  AssetManifest,
  AssetVersion,
  Buyer,
  BuyerLicense,
  Creator,
  Listing,
  LockedAsset,
  ProofReceipt,
  Purchase,
  Revocation,
  UnlockCode
} from "@my-digital/types";

export interface StoredIssuer {
  name: string;
  publicKeyB64: string;
  /**
   * DEMO ONLY: the issuer private key is stored unprotected in browser
   * localStorage so the demo survives reloads. Production issuance must never
   * persist private keys like this.
   */
  privateJwk: JsonWebKey;
}

export interface MarketplaceState {
  schemaVersion: 1;
  issuer: StoredIssuer | null;
  creator: Creator | null;
  buyers: Buyer[];
  assets: Asset[];
  assetVersions: AssetVersion[];
  manifests: AssetManifest[];
  lockedAssets: LockedAsset[];
  /** Locked payload bytes per locked asset id, base64-encoded for storage. */
  lockedPayloadsB64: Record<string, string>;
  listings: Listing[];
  purchases: Purchase[];
  licenses: BuyerLicense[];
  unlockCodes: UnlockCode[];
  receipts: ProofReceipt[];
  revocations: Revocation[];
}

export function emptyMarketplaceState(): MarketplaceState {
  return {
    schemaVersion: 1,
    issuer: null,
    creator: null,
    buyers: [],
    assets: [],
    assetVersions: [],
    manifests: [],
    lockedAssets: [],
    lockedPayloadsB64: {},
    listings: [],
    purchases: [],
    licenses: [],
    unlockCodes: [],
    receipts: [],
    revocations: []
  };
}

export function serializeMarketplaceState(state: MarketplaceState): string {
  return JSON.stringify(state);
}

export function deserializeMarketplaceState(text: string): MarketplaceState | null {
  try {
    const parsed = JSON.parse(text) as Partial<MarketplaceState> | null;
    if (!parsed || typeof parsed !== "object" || parsed.schemaVersion !== 1) return null;
    return { ...emptyMarketplaceState(), ...parsed, schemaVersion: 1 };
  } catch {
    return null;
  }
}
