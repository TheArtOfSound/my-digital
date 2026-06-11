import { describe, expect, it } from "vitest";
import { base64ToBytes, bytesEqual, bytesToBase64, utf8Bytes } from "./encoding";
import { sha256Hex, sha256HexOfString } from "./hash";
import {
  generateIssuerSigningKeys,
  importIssuerPublicKey,
  signCanonical,
  verifyCanonicalSignature
} from "./signing";
import { stableJson } from "./verification";

describe("stableJson", () => {
  it("serializes objects identically regardless of key order", () => {
    const a = { outer: { b: 2, a: 1 }, list: [{ y: 2, x: 1 }] };
    const b = { list: [{ x: 1, y: 2 }], outer: { a: 1, b: 2 } };
    expect(stableJson(a)).toBe(stableJson(b));
  });

  it("drops undefined properties the same way JSON.stringify does", () => {
    expect(stableJson({ a: 1, b: undefined })).toBe(stableJson({ a: 1 }));
  });
});

describe("sha256", () => {
  it("matches the known SHA-256 test vector for 'abc'", async () => {
    expect(await sha256HexOfString("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("changes when a single byte changes", async () => {
    const original = utf8Bytes("payload");
    const tampered = new Uint8Array(original);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;
    expect(await sha256Hex(original)).not.toBe(await sha256Hex(tampered));
  });
});

describe("base64 encoding", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 255, 128, 64]);
    expect(bytesEqual(base64ToBytes(bytesToBase64(bytes)), bytes)).toBe(true);
  });
});

describe("Ed25519 canonical signing", () => {
  it("signs and verifies a canonical payload", async () => {
    const keys = await generateIssuerSigningKeys("test-issuer");
    const payload = { kind: "test", value: 42 };
    const signature = await signCanonical(keys.privateKey, payload);
    expect(await verifyCanonicalSignature(keys.publicKey, payload, signature)).toBe(true);
  });

  it("verifies independently through an exported/imported public key", async () => {
    const keys = await generateIssuerSigningKeys("test-issuer");
    const payload = { kind: "portable", value: 1 };
    const signature = await signCanonical(keys.privateKey, payload);
    const importedKey = await importIssuerPublicKey(keys.publicKeyB64);
    expect(await verifyCanonicalSignature(importedKey, payload, signature)).toBe(true);
  });

  it("rejects an altered payload", async () => {
    const keys = await generateIssuerSigningKeys("test-issuer");
    const signature = await signCanonical(keys.privateKey, { value: 1 });
    expect(await verifyCanonicalSignature(keys.publicKey, { value: 2 }, signature)).toBe(false);
  });

  it("rejects a signature from a different issuer key", async () => {
    const issuerA = await generateIssuerSigningKeys("issuer-a");
    const issuerB = await generateIssuerSigningKeys("issuer-b");
    const payload = { value: 1 };
    const signature = await signCanonical(issuerA.privateKey, payload);
    expect(await verifyCanonicalSignature(issuerB.publicKey, payload, signature)).toBe(false);
  });

  it("returns false rather than throwing on malformed signatures", async () => {
    const keys = await generateIssuerSigningKeys("test-issuer");
    expect(await verifyCanonicalSignature(keys.publicKey, { value: 1 }, "not-base64!!!")).toBe(
      false
    );
  });
});
