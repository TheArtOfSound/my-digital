import { base64ToBytes, bytesToBase64, utf8Bytes } from "./encoding";
import { stableJson } from "./verification";

/**
 * Real Ed25519 signatures over canonical JSON (recursively sorted keys, no
 * whitespace) via WebCrypto. The signature algorithm is production-grade; what
 * is demo-only at this stage is key management: issuer keys are generated
 * ephemerally in memory with no PKI, rotation, or hardware protection.
 */
export interface IssuerSigningKeys {
  issuer: string;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicKeyB64: string;
}

export async function generateIssuerSigningKeys(issuer: string): Promise<IssuerSigningKeys> {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify"
  ])) as CryptoKeyPair;
  const rawPublicKey = await crypto.subtle.exportKey("raw", pair.publicKey);
  return {
    issuer,
    privateKey: pair.privateKey,
    publicKey: pair.publicKey,
    publicKeyB64: bytesToBase64(new Uint8Array(rawPublicKey))
  };
}

export async function importIssuerPublicKey(publicKeyB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new Uint8Array(base64ToBytes(publicKeyB64)),
    { name: "Ed25519" },
    true,
    ["verify"]
  );
}

export async function signCanonical(privateKey: CryptoKey, value: unknown): Promise<string> {
  const signature = await crypto.subtle.sign(
    { name: "Ed25519" },
    privateKey,
    new Uint8Array(utf8Bytes(stableJson(value)))
  );
  return bytesToBase64(new Uint8Array(signature));
}

export async function verifyCanonicalSignature(
  publicKey: CryptoKey,
  value: unknown,
  signatureB64: string
): Promise<boolean> {
  try {
    return await crypto.subtle.verify(
      { name: "Ed25519" },
      publicKey,
      new Uint8Array(base64ToBytes(signatureB64)),
      new Uint8Array(utf8Bytes(stableJson(value)))
    );
  } catch {
    return false;
  }
}
