import type {
  Asset,
  AssetManifest,
  AssetVersion,
  AssetVersionId,
  Buyer,
  Creator,
  CreatorId,
  EnvelopeLockResult,
  LicenseTerms,
  Listing,
  LockedAsset,
  Purchase
} from "@my-digital/types";
import { sha256HexOfString } from "./hash";
import {
  newAssetId,
  newBuyerId,
  newCreatorId,
  newListingId,
  newPurchaseId,
  newAssetVersionId
} from "./ids";
import { createAssetManifest } from "./manifest";

export const demoPersonalLicenseTerms: LicenseTerms = {
  personalUse: true,
  commercialUse: false,
  clientWorkAllowed: false,
  redistributionAllowed: false,
  resaleAllowed: false,
  aiTrainingAllowed: false,
  attributionRequired: true,
  seatCount: 1
};

export async function hashEmail(email: string): Promise<string> {
  return sha256HexOfString(email.trim().toLowerCase());
}

export async function createCreator(input: {
  displayName: string;
  handle: string;
  email: string;
  createdAt?: string;
}): Promise<Creator> {
  return {
    id: newCreatorId(),
    displayName: input.displayName,
    handle: input.handle,
    emailHash: await hashEmail(input.email),
    createdAt: input.createdAt ?? new Date().toISOString(),
    verificationStatus: "unverified"
  };
}

export async function createBuyer(input: {
  email: string;
  displayName?: string;
  createdAt?: string;
}): Promise<Buyer> {
  return {
    id: newBuyerId(),
    emailHash: await hashEmail(input.email),
    createdAt: input.createdAt ?? new Date().toISOString(),
    ...(input.displayName !== undefined ? { displayName: input.displayName } : {})
  };
}

export function createAsset(input: {
  creatorId: CreatorId;
  title: string;
  description: string;
  category: string;
  createdAt?: string;
}): Asset {
  return {
    id: newAssetId(),
    creatorId: input.creatorId,
    title: input.title,
    description: input.description,
    category: input.category,
    createdAt: input.createdAt ?? new Date().toISOString(),
    status: "draft"
  };
}

export interface CreateAssetVersionInput {
  asset: Asset;
  versionLabel: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  changelog?: string;
  createdAt?: string;
}

export interface CreateAssetVersionResult {
  assetVersion: AssetVersion;
  manifest: AssetManifest;
}

export async function createAssetVersion(
  input: CreateAssetVersionInput
): Promise<CreateAssetVersionResult> {
  const assetVersionId = newAssetVersionId();
  const createdAt = input.createdAt ?? new Date().toISOString();
  const { manifest, contentHash, manifestHash } = await createAssetManifest({
    asset: input.asset,
    assetVersionId,
    versionLabel: input.versionLabel,
    fileName: input.fileName,
    mimeType: input.mimeType,
    bytes: input.bytes,
    createdAt
  });
  return {
    assetVersion: {
      id: assetVersionId,
      assetId: input.asset.id,
      versionLabel: input.versionLabel,
      fileName: input.fileName,
      mimeType: input.mimeType,
      byteSize: input.bytes.byteLength,
      contentHash,
      manifestHash,
      createdAt,
      ...(input.changelog !== undefined ? { changelog: input.changelog } : {})
    },
    manifest
  };
}

export function createLockedAssetRecord(input: {
  assetVersionId: AssetVersionId;
  lockResult: EnvelopeLockResult;
  storageUri?: string;
  createdAt?: string;
}): LockedAsset {
  return {
    id: input.lockResult.lockedAssetId,
    assetVersionId: input.assetVersionId,
    envelopeFormat: input.lockResult.envelopeFormat,
    envelopeVersion: input.lockResult.envelopeVersion,
    lockedPayloadHash: input.lockResult.lockedPayloadHash,
    metadataHash: input.lockResult.metadataHash,
    qevEngineVersion: input.lockResult.qevEngineVersion,
    createdAt: input.createdAt ?? new Date().toISOString(),
    ...(input.storageUri !== undefined ? { storageUri: input.storageUri } : {})
  };
}

export function createListing(input: {
  asset: Asset;
  activeAssetVersionId: AssetVersionId;
  title?: string;
  description?: string;
  priceAmount: number;
  priceCurrency: string;
  licenseTerms: LicenseTerms;
  createdAt?: string;
}): Listing {
  const createdAt = input.createdAt ?? new Date().toISOString();
  return {
    id: newListingId(),
    assetId: input.asset.id,
    activeAssetVersionId: input.activeAssetVersionId,
    creatorId: input.asset.creatorId,
    title: input.title ?? input.asset.title,
    description: input.description ?? input.asset.description,
    priceAmount: input.priceAmount,
    priceCurrency: input.priceCurrency,
    licenseTerms: input.licenseTerms,
    status: "active",
    createdAt,
    updatedAt: createdAt
  };
}

export function simulatePaidPurchase(input: {
  listing: Listing;
  buyer: Buyer;
  createdAt?: string;
}): Purchase {
  const createdAt = input.createdAt ?? new Date().toISOString();
  return {
    id: newPurchaseId(),
    listingId: input.listing.id,
    buyerId: input.buyer.id,
    assetVersionId: input.listing.activeAssetVersionId,
    paymentProvider: "mock",
    paymentProviderReference: `mockpay_${crypto.randomUUID()}`,
    amountPaid: input.listing.priceAmount,
    currency: input.listing.priceCurrency,
    status: "paid",
    createdAt,
    paidAt: createdAt
  };
}
