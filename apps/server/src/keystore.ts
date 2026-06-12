import {
  base64ToBytes,
  bytesToBase64,
  generateIssuerSigningKeys,
  importIssuerPublicKey,
  utf8Bytes
} from "@my-digital/core";
import type { MarketplaceStore, SealedSecretRecord } from "@my-digital/store";
import _sodium from "libsodium-wrappers-sumo";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const MASTER_KEY_BYTES = 32;
const NONCE_BYTES = 24;

async function getSodium(): Promise<typeof _sodium> {
  await _sodium.ready;
  return _sodium;
}

/**
 * Server keystore. Holds the master key and seals/opens secrets with
 * XChaCha20-Poly1305, binding each secret to its purpose via AAD so a sealed
 * blob cannot be replayed for a different record.
 *
 * The master key comes from MYDIGITAL_MASTER_KEY_B64 or a local key file
 * (created on first run, chmod 600). The key file is the local-dev stand-in
 * for a real KMS/HSM; that swap is the production hardening point.
 */
export class Keystore {
  private constructor(private readonly masterKey: Uint8Array) {}

  static async open(options: { keyFilePath: string }): Promise<Keystore> {
    await getSodium();
    const fromEnv = process.env.MYDIGITAL_MASTER_KEY_B64;
    if (fromEnv !== undefined && fromEnv.length > 0) {
      const key = base64ToBytes(fromEnv);
      if (key.byteLength !== MASTER_KEY_BYTES) {
        throw new Error(
          `MYDIGITAL_MASTER_KEY_B64 must decode to ${MASTER_KEY_BYTES} bytes, got ${key.byteLength}.`
        );
      }
      return new Keystore(key);
    }
    if (existsSync(options.keyFilePath)) {
      const key = base64ToBytes(readFileSync(options.keyFilePath, "utf8").trim());
      if (key.byteLength !== MASTER_KEY_BYTES) {
        throw new Error(`Master key file ${options.keyFilePath} is corrupted (wrong length).`);
      }
      return new Keystore(key);
    }
    const sodium = await getSodium();
    const key = sodium.randombytes_buf(MASTER_KEY_BYTES);
    mkdirSync(dirname(options.keyFilePath), { recursive: true });
    writeFileSync(options.keyFilePath, bytesToBase64(key), { mode: 0o600 });
    chmodSync(options.keyFilePath, 0o600);
    return new Keystore(key);
  }

  /** Test-only: an ephemeral keystore with a random in-memory master key. */
  static async ephemeral(): Promise<Keystore> {
    const sodium = await getSodium();
    return new Keystore(sodium.randombytes_buf(MASTER_KEY_BYTES));
  }

  async seal(plaintext: Uint8Array, aad: string): Promise<SealedSecretRecord> {
    const sodium = await getSodium();
    const nonce = sodium.randombytes_buf(NONCE_BYTES);
    const sealed = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      plaintext,
      utf8Bytes(aad),
      null,
      nonce,
      this.masterKey
    );
    return {
      nonceB64: bytesToBase64(nonce),
      sealedB64: bytesToBase64(sealed),
      createdAt: new Date().toISOString()
    };
  }

  async openSealed(record: SealedSecretRecord, aad: string): Promise<Uint8Array> {
    const sodium = await getSodium();
    try {
      return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        base64ToBytes(record.sealedB64),
        utf8Bytes(aad),
        base64ToBytes(record.nonceB64),
        this.masterKey
      );
    } catch {
      throw new Error(
        "Failed to open a sealed secret: wrong master key, wrong binding, or tampered record."
      );
    }
  }

  async sealString(plaintext: string, aad: string): Promise<SealedSecretRecord> {
    return this.seal(utf8Bytes(plaintext), aad);
  }

  async openSealedString(record: SealedSecretRecord, aad: string): Promise<string> {
    return new TextDecoder().decode(await this.openSealed(record, aad));
  }
}

export interface ServerIssuer {
  name: string;
  publicKeyB64: string;
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

/**
 * Loads the server issuer from the store (public record + sealed private JWK)
 * or bootstraps a new one on first run. The private key only ever exists in
 * the database sealed under the master key.
 */
export async function ensureServerIssuer(
  store: MarketplaceStore,
  keystore: Keystore,
  name: string
): Promise<ServerIssuer> {
  const aad = `issuer:${name}`;
  const existing = await store.getIssuer(name);
  const secret = await store.getIssuerSecret(name);
  if (existing && secret) {
    const jwk = JSON.parse(await keystore.openSealedString(secret, aad)) as JsonWebKey;
    const privateKey = await crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, true, [
      "sign"
    ]);
    const publicKey = await importIssuerPublicKey(existing.publicKeyB64);
    return { name, publicKeyB64: existing.publicKeyB64, publicKey, privateKey };
  }
  const keys = await generateIssuerSigningKeys(name);
  const privateJwk = await crypto.subtle.exportKey("jwk", keys.privateKey);
  await store.putIssuer({
    name,
    publicKeyB64: keys.publicKeyB64,
    createdAt: new Date().toISOString()
  });
  await store.putIssuerSecret(name, await keystore.sealString(JSON.stringify(privateJwk), aad));
  return {
    name,
    publicKeyB64: keys.publicKeyB64,
    publicKey: keys.publicKey,
    privateKey: keys.privateKey
  };
}
