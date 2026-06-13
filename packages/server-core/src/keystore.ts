import {
  base64ToBytes,
  bytesToBase64,
  generateIssuerSigningKeys,
  importIssuerPublicKey,
  utf8Bytes
} from "@my-digital/core";
import { sodiumCryptoProvider, type QevCryptoProvider } from "@my-digital/envelope";
import type { MarketplaceStore, SealedSecretRecord } from "@my-digital/store";

const MASTER_KEY_BYTES = 32;
const NONCE_BYTES = 24;

/**
 * Server keystore. Holds the master key and seals/opens secrets with
 * XChaCha20-Poly1305, binding each secret to its purpose via AAD so a sealed
 * blob cannot be replayed for a different record.
 *
 * The crypto backend is pluggable (libsodium on Node; @noble on Workers).
 * The master key comes from raw bytes (Workers secret), the
 * MYDIGITAL_MASTER_KEY_B64 env var, or a local key file (Node dev — the
 * stand-in for a real KMS/HSM, which is the production hardening point).
 */
export class Keystore {
  private constructor(
    private readonly masterKey: Uint8Array,
    private readonly crypto: QevCryptoProvider
  ) {}

  /** Build directly from a 32-byte key (Workers: from a Workers secret). */
  static async fromKeyBytes(key: Uint8Array, crypto: QevCryptoProvider): Promise<Keystore> {
    if (key.byteLength !== MASTER_KEY_BYTES) {
      throw new Error(`Master key must be ${MASTER_KEY_BYTES} bytes, got ${key.byteLength}.`);
    }
    await crypto.ready();
    return new Keystore(key, crypto);
  }

  static async fromBase64Key(keyB64: string, crypto: QevCryptoProvider): Promise<Keystore> {
    return Keystore.fromKeyBytes(base64ToBytes(keyB64), crypto);
  }

  /** Node entry: env var, else a chmod-600 key file (created on first run). */
  static async open(options: {
    keyFilePath: string;
    crypto?: QevCryptoProvider;
  }): Promise<Keystore> {
    const crypto = options.crypto ?? sodiumCryptoProvider;
    await crypto.ready();
    const fromEnv = process.env.MYDIGITAL_MASTER_KEY_B64;
    if (fromEnv !== undefined && fromEnv.length > 0) {
      return Keystore.fromBase64Key(fromEnv, crypto);
    }
    // node:fs is imported lazily so this module loads on non-Node runtimes.
    const { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } = await import(
      "node:fs"
    );
    const { dirname } = await import("node:path");
    if (existsSync(options.keyFilePath)) {
      const key = base64ToBytes(readFileSync(options.keyFilePath, "utf8").trim());
      if (key.byteLength !== MASTER_KEY_BYTES) {
        throw new Error(`Master key file ${options.keyFilePath} is corrupted (wrong length).`);
      }
      return new Keystore(key, crypto);
    }
    const key = crypto.randomBytes(MASTER_KEY_BYTES);
    mkdirSync(dirname(options.keyFilePath), { recursive: true });
    writeFileSync(options.keyFilePath, bytesToBase64(key), { mode: 0o600 });
    chmodSync(options.keyFilePath, 0o600);
    return new Keystore(key, crypto);
  }

  /** Test-only: an ephemeral keystore with a random in-memory master key. */
  static async ephemeral(crypto: QevCryptoProvider = sodiumCryptoProvider): Promise<Keystore> {
    await crypto.ready();
    return new Keystore(crypto.randomBytes(MASTER_KEY_BYTES), crypto);
  }

  async seal(plaintext: Uint8Array, aad: string): Promise<SealedSecretRecord> {
    const nonce = this.crypto.randomBytes(NONCE_BYTES);
    const sealed = this.crypto.aeadEncrypt(plaintext, utf8Bytes(aad), nonce, this.masterKey);
    return {
      nonceB64: bytesToBase64(nonce),
      sealedB64: bytesToBase64(sealed),
      createdAt: new Date().toISOString()
    };
  }

  async openSealed(record: SealedSecretRecord, aad: string): Promise<Uint8Array> {
    try {
      return this.crypto.aeadDecrypt(
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
