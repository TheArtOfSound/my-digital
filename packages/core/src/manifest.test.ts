import type { AssetId, AssetVersionId, CreatorId } from "@my-digital/types";
import { describe, expect, it } from "vitest";
import { utf8Bytes } from "./encoding";
import { createAssetManifest } from "./manifest";

const fixedInput = {
  asset: { id: "asset_test" as AssetId, creatorId: "creator_test" as CreatorId },
  assetVersionId: "assetver_test" as AssetVersionId,
  versionLabel: "1.0.0",
  fileName: "demo.txt",
  mimeType: "text/plain",
  createdAt: "2026-06-10T00:00:00.000Z"
};

describe("createAssetManifest", () => {
  it("produces a deterministic manifest hash for identical input", async () => {
    const first = await createAssetManifest({ ...fixedInput, bytes: utf8Bytes("content") });
    const second = await createAssetManifest({ ...fixedInput, bytes: utf8Bytes("content") });
    expect(first.manifestHash).toBe(second.manifestHash);
    expect(first.contentHash).toBe(second.contentHash);
    expect(first.manifest.schema).toBe("MYDIGITAL-ASSET-MANIFEST-V1");
    expect(first.manifest.byteSize).toBe(7);
  });

  it("changes both hashes when the content bytes change", async () => {
    const original = await createAssetManifest({ ...fixedInput, bytes: utf8Bytes("content") });
    const changed = await createAssetManifest({ ...fixedInput, bytes: utf8Bytes("Content") });
    expect(changed.contentHash).not.toBe(original.contentHash);
    expect(changed.manifestHash).not.toBe(original.manifestHash);
  });
});
