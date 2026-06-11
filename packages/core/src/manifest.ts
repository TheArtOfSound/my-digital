import type { Asset, AssetManifest, AssetVersionId } from "@my-digital/types";
import { sha256Hex, sha256HexOfString } from "./hash";
import { stableJson } from "./verification";

export interface CreateAssetManifestInput {
  asset: Pick<Asset, "id" | "creatorId">;
  assetVersionId: AssetVersionId;
  versionLabel: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  createdAt?: string;
}

export interface CreateAssetManifestResult {
  manifest: AssetManifest;
  contentHash: string;
  manifestHash: string;
}

export async function createAssetManifest(
  input: CreateAssetManifestInput
): Promise<CreateAssetManifestResult> {
  const contentHash = await sha256Hex(input.bytes);
  const manifest: AssetManifest = {
    schema: "MYDIGITAL-ASSET-MANIFEST-V1",
    assetId: input.asset.id,
    assetVersionId: input.assetVersionId,
    creatorId: input.asset.creatorId,
    versionLabel: input.versionLabel,
    fileName: input.fileName,
    mimeType: input.mimeType,
    byteSize: input.bytes.byteLength,
    contentHash,
    createdAt: input.createdAt ?? new Date().toISOString()
  };
  const manifestHash = await hashAssetManifest(manifest);
  return { manifest, contentHash, manifestHash };
}

export async function hashAssetManifest(manifest: AssetManifest): Promise<string> {
  return sha256HexOfString(stableJson(manifest));
}
