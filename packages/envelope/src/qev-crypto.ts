import { argon2id as nobleArgon2id } from "@noble/hashes/argon2";
import { xchacha20poly1305 } from "@noble/ciphers/chacha";

/** Structural subset of libsodium-wrappers-sumo this provider uses. */
interface SodiumLike {
  ready: Promise<void>;
  randombytes_buf(length: number): Uint8Array;
  crypto_pwhash(
    outLength: number,
    password: Uint8Array,
    salt: Uint8Array,
    opslimit: number,
    memlimit: number,
    algorithm: number
  ): Uint8Array;
  crypto_pwhash_ALG_ARGON2ID13: number;
  crypto_aead_xchacha20poly1305_ietf_encrypt(
    message: Uint8Array,
    additionalData: Uint8Array | null,
    secretNonce: null,
    publicNonce: Uint8Array,
    key: Uint8Array
  ): Uint8Array;
  crypto_aead_xchacha20poly1305_ietf_decrypt(
    secretNonce: null,
    ciphertext: Uint8Array,
    additionalData: Uint8Array | null,
    publicNonce: Uint8Array,
    key: Uint8Array
  ): Uint8Array;
  memzero(bytes: Uint8Array): void;
}

/**
 * Crypto backend for the QEV Vault V2 adapter. Two interchangeable
 * implementations of the same primitives (Argon2id, XChaCha20-Poly1305):
 *
 * - sodium: libsodium-wrappers-sumo (the upstream runtime; Node + browsers).
 * - noble:  @noble/hashes + @noble/ciphers, pure JS — used on runtimes that
 *   cannot instantiate libsodium's WASM (Cloudflare Workers).
 *
 * Byte-compatibility between the two (and with the upstream qev CLI) is
 * enforced by running the full adapter test suite, including the
 * cross-implementation vectors, against BOTH providers.
 */
export interface QevCryptoProvider {
  readonly name: "sodium" | "noble";
  ready(): Promise<void>;
  randomBytes(length: number): Uint8Array;
  argon2id(
    password: Uint8Array,
    salt: Uint8Array,
    opslimit: number,
    memlimitBytes: number,
    outLength: number
  ): Uint8Array;
  /** XChaCha20-Poly1305 encrypt; returns ciphertext with the 16-byte tag appended. */
  aeadEncrypt(message: Uint8Array, aad: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array;
  /** XChaCha20-Poly1305 decrypt; throws on authentication failure. */
  aeadDecrypt(ciphertext: Uint8Array, aad: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array;
  wipe(bytes: Uint8Array): void;
}

class SodiumProvider implements QevCryptoProvider {
  readonly name = "sodium" as const;
  private sodium: SodiumLike | null = null;

  // libsodium is imported lazily so this module loads on runtimes where
  // libsodium's WASM/RNG probe fails at import (e.g. Cloudflare Workers).
  // Callers always await ready() before the synchronous crypto methods.
  async ready(): Promise<void> {
    if (this.sodium) return;
    const mod = (await import("libsodium-wrappers-sumo")) as unknown as {
      default: SodiumLike;
    };
    await mod.default.ready;
    this.sodium = mod.default;
  }
  private require(): SodiumLike {
    if (!this.sodium) throw new Error("Sodium crypto provider used before ready() resolved.");
    return this.sodium;
  }
  randomBytes(length: number): Uint8Array {
    return this.require().randombytes_buf(length);
  }
  argon2id(
    password: Uint8Array,
    salt: Uint8Array,
    opslimit: number,
    memlimitBytes: number,
    outLength: number
  ): Uint8Array {
    const sodium = this.require();
    return sodium.crypto_pwhash(
      outLength,
      password,
      salt,
      opslimit,
      memlimitBytes,
      sodium.crypto_pwhash_ALG_ARGON2ID13
    );
  }
  aeadEncrypt(message: Uint8Array, aad: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array {
    return this.require().crypto_aead_xchacha20poly1305_ietf_encrypt(message, aad, null, nonce, key);
  }
  aeadDecrypt(ciphertext: Uint8Array, aad: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array {
    return this.require().crypto_aead_xchacha20poly1305_ietf_decrypt(null, ciphertext, aad, nonce, key);
  }
  wipe(bytes: Uint8Array): void {
    this.require().memzero(bytes);
  }
}

class NobleProvider implements QevCryptoProvider {
  readonly name = "noble" as const;

  async ready(): Promise<void> {
    // Pure JS; nothing to initialize.
  }
  randomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }
  argon2id(
    password: Uint8Array,
    salt: Uint8Array,
    opslimit: number,
    memlimitBytes: number,
    outLength: number
  ): Uint8Array {
    // libsodium's memlimit is bytes; Argon2's m parameter is KiB. p=1 and
    // version 0x13 match crypto_pwhash_ALG_ARGON2ID13 exactly.
    return nobleArgon2id(password, salt, {
      t: opslimit,
      m: Math.floor(memlimitBytes / 1024),
      p: 1,
      dkLen: outLength
    });
  }
  aeadEncrypt(message: Uint8Array, aad: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array {
    return xchacha20poly1305(key, nonce, aad).encrypt(message);
  }
  aeadDecrypt(ciphertext: Uint8Array, aad: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array {
    return xchacha20poly1305(key, nonce, aad).decrypt(ciphertext);
  }
  wipe(bytes: Uint8Array): void {
    bytes.fill(0);
  }
}

export const sodiumCryptoProvider: QevCryptoProvider = new SodiumProvider();
export const nobleCryptoProvider: QevCryptoProvider = new NobleProvider();

/** Base64url without padding, shared by both providers (upstream encoding). */
export function b64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function b64urlDecode(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
