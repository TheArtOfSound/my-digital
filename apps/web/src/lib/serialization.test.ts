import { bytesEqual, base64ToBytes, bytesToBase64, utf8Bytes } from "@my-digital/core";
import type { Asset, AssetId, CreatorId } from "@my-digital/types";
import { describe, expect, it } from "vitest";
import {
  deserializeMarketplaceState,
  emptyMarketplaceState,
  serializeMarketplaceState
} from "./serialization";

const demoAsset: Asset = {
  id: "asset_serialization-test" as AssetId,
  creatorId: "creator_serialization-test" as CreatorId,
  title: "Asset",
  description: "Test",
  category: "test",
  createdAt: "2026-06-10T00:00:00.000Z",
  status: "listed"
};

describe("marketplace state serialization", () => {
  it("round-trips state including base64 locked payloads", () => {
    const payload = utf8Bytes("locked payload bytes");
    const state = {
      ...emptyMarketplaceState(),
      assets: [demoAsset],
      lockedPayloadsB64: { locked_test: bytesToBase64(payload) }
    };
    const restored = deserializeMarketplaceState(serializeMarketplaceState(state));
    expect(restored).not.toBeNull();
    expect(restored?.assets).toEqual([demoAsset]);
    const restoredB64 = restored?.lockedPayloadsB64["locked_test"];
    expect(restoredB64).toBeDefined();
    expect(bytesEqual(base64ToBytes(restoredB64 ?? ""), payload)).toBe(true);
  });

  it("returns null for corrupted JSON", () => {
    expect(deserializeMarketplaceState("{not json")).toBeNull();
  });

  it("returns null for unknown schema versions", () => {
    expect(deserializeMarketplaceState(JSON.stringify({ schemaVersion: 99 }))).toBeNull();
  });

  it("fills missing collections with empty defaults", () => {
    const restored = deserializeMarketplaceState(JSON.stringify({ schemaVersion: 1 }));
    expect(restored).not.toBeNull();
    expect(restored?.listings).toEqual([]);
    expect(restored?.lockedPayloadsB64).toEqual({});
    expect(restored?.creator).toBeNull();
  });
});
