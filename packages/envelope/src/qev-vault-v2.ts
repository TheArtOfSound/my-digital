import {
  createVerificationResult,
  inferVerificationStatus,
  newLockedAssetId,
  sha256Hex,
  stableJson,
  utf8Bytes
} from "@my-digital/core";
import type {
  BuyerWrappingEnvelopeAdapter,
  EnvelopeLockInput,
  EnvelopeLockResult,
  EnvelopeUnlockInput,
  EnvelopeUnlockResult,
  EnvelopeVerifyInput,
  VerificationCheck,
  VerificationResult,
  WrapForCredentialInput,
  WrapForCredentialResult
} from "@my-digital/types";
import { compareRecordedHashes } from "./hash-comparison";
import {
  b64urlDecode,
  b64urlEncode,
  sodiumCryptoProvider,
  type QevCryptoProvider
} from "./qev-crypto";

/**
 * Production envelope adapter implementing upstream QEV Vault V2 semantics
 * (TheArtOfSound/qev-desktop, schema BRY-NFET-SX-VAULT-V2):
 *
 * - Argon2id (ALG_ARGON2ID13 parameters) derives a wrapping key from the
 *   credential; the wrapping key encrypts a random 32-byte vault key; the
 *   vault key encrypts the plaintext (XChaCha20-Poly1305, 24-byte nonces).
 * - All binary fields are base64url without padding.
 * - Associated data is derived deterministically from the fixed metadata
 *   subset upstream uses (buildAADV2): everything except wrapped_key and
 *   ciphertext, canonical-JSON serialized with recursively sorted keys.
 * - mode "self" marks the creator custody vault; mode "share" marks
 *   buyer-specific vaults, matching the upstream mode whitelist.
 *
 * Commerce binding (asset version, file name, mime type, content hash, and
 * license id for buyer vaults) is sealed INSIDE the authenticated plaintext
 * as a canonical JSON wrapper, so the vault document itself stays fully
 * upstream-compatible while the binding remains tamper-evident via AEAD.
 *
 * The crypto backend is pluggable (libsodium by default; @noble on runtimes
 * without WASM instantiation, e.g. Cloudflare Workers) — see qev-crypto.ts.
 *
 * What is NOT production-grade here: custody key handling. lock() returns
 * the custody passphrase to the caller, which must treat it as a secret.
 */

export const QEV_VAULT_SCHEMA = "BRY-NFET-SX-VAULT-V2";
export const QEV_AEAD_ALG = "XChaCha20-Poly1305";
export const QEV_KDF_ALG = "argon2id";
export const MYDIGITAL_INNER_KIND = "MYDIGITAL-LOCKED-ASSET-V1";
const ENGINE_VERSION = "0.0.1-foundation-mydigital";

const SALT_BYTES = 16;
const NONCE_BYTES = 24;
const KEY_BYTES = 32;
const TAG_BYTES = 16;
const MIN_OPSLIMIT = 1;
const MAX_OPSLIMIT = 10;
const MIN_MEMLIMIT = 8 * 1024 * 1024;
const MAX_MEMLIMIT = 256 * 1024 * 1024;

/**
 * Upstream strength presets (docs/VAULT_FORMAT.md) plus "edge": the upstream
 * minimum memlimit, for CPU-budgeted runtimes. Honest rationale: My Digital
 * credentials are random high-entropy secrets (custody passphrases 192 bits,
 * unlock codes ~79 bits), so KDF cost is defense-in-depth here, not the
 * primary barrier the way it is for human passphrases.
 */
export const QEV_KDF_PRESETS = {
  edge: { opslimit: 1, memlimit: 8 * 1024 * 1024 },
  quick: { opslimit: 1, memlimit: 32 * 1024 * 1024 },
  strong: { opslimit: 4, memlimit: 96 * 1024 * 1024 },
  vault: { opslimit: 6, memlimit: 128 * 1024 * 1024 }
} as const;

export type QevKdfPreset = keyof typeof QEV_KDF_PRESETS;

interface QevVaultDocument {
  schema: string;
  version: string;
  created_at: string;
  mode: string;
  kdf: { algorithm: string; opslimit: number; memlimit: number; salt: string };
  wrap: { algorithm: string; nonce: string; wrapped_key: string };
  content: { algorithm: string; nonce: string; ciphertext: string };
}

interface MyDigitalInnerEnvelope {
  kind: string;
  binding: {
    asset_version_id: string;
    file_name: string;
    mime_type: string;
    content_sha256: string;
    license_id?: string;
  };
  payload_b64: string;
}

/** AAD over the same fixed metadata subset as upstream buildAADV2. */
function buildAad(vault: QevVaultDocument): Uint8Array {
  return utf8Bytes(
    stableJson({
      content: { algorithm: vault.content.algorithm, nonce: vault.content.nonce },
      created_at: vault.created_at,
      kdf: {
        algorithm: vault.kdf.algorithm,
        memlimit: vault.kdf.memlimit,
        opslimit: vault.kdf.opslimit,
        salt: vault.kdf.salt
      },
      mode: vault.mode,
      schema: vault.schema,
      version: vault.version,
      wrap: { algorithm: vault.wrap.algorithm, nonce: vault.wrap.nonce }
    })
  );
}

async function encryptVault(
  crypto: QevCryptoProvider,
  input: {
    plaintext: Uint8Array;
    password: string;
    mode: "self" | "share";
    opslimit: number;
    memlimit: number;
  }
): Promise<QevVaultDocument> {
  await crypto.ready();
  const salt = crypto.randomBytes(SALT_BYTES);
  const wrapNonce = crypto.randomBytes(NONCE_BYTES);
  const contentNonce = crypto.randomBytes(NONCE_BYTES);
  const vaultKey = crypto.randomBytes(KEY_BYTES);

  const vault: QevVaultDocument = {
    schema: QEV_VAULT_SCHEMA,
    version: ENGINE_VERSION,
    created_at: new Date().toISOString(),
    mode: input.mode,
    kdf: {
      algorithm: QEV_KDF_ALG,
      opslimit: input.opslimit,
      memlimit: input.memlimit,
      salt: b64urlEncode(salt)
    },
    wrap: { algorithm: QEV_AEAD_ALG, nonce: b64urlEncode(wrapNonce), wrapped_key: "" },
    content: {
      algorithm: QEV_AEAD_ALG,
      nonce: b64urlEncode(contentNonce),
      ciphertext: ""
    }
  };
  const aad = buildAad(vault);

  const wrapKey = crypto.argon2id(
    utf8Bytes(input.password),
    salt,
    input.opslimit,
    input.memlimit,
    KEY_BYTES
  );
  try {
    vault.wrap.wrapped_key = b64urlEncode(crypto.aeadEncrypt(vaultKey, aad, wrapNonce, wrapKey));
  } finally {
    crypto.wipe(wrapKey);
  }
  try {
    vault.content.ciphertext = b64urlEncode(
      crypto.aeadEncrypt(input.plaintext, aad, contentNonce, vaultKey)
    );
  } finally {
    crypto.wipe(vaultKey);
  }
  return vault;
}

type VaultFailure = { failure: VerificationCheck };

function isFailure<T>(value: T | VaultFailure): value is VaultFailure {
  return typeof value === "object" && value !== null && "failure" in value;
}

function structuralProblem(vault: unknown): VerificationCheck | null {
  if (!vault || typeof vault !== "object") {
    return {
      code: "VAULT_NOT_AN_OBJECT",
      label: "Vault malformed",
      detail: "The locked payload is not a JSON object."
    };
  }
  const doc = vault as Partial<QevVaultDocument>;
  if (doc.schema !== QEV_VAULT_SCHEMA) {
    return {
      code: "VAULT_SCHEMA_UNSUPPORTED",
      label: "Unsupported vault schema",
      detail: `Expected schema ${QEV_VAULT_SCHEMA}, found "${String(doc.schema)}".`
    };
  }
  if (typeof doc.version !== "string" || doc.version.length === 0) {
    return {
      code: "VAULT_VERSION_MISSING",
      label: "Vault malformed",
      detail: "The version field is missing."
    };
  }
  if (typeof doc.created_at !== "string" || doc.created_at.length === 0) {
    return {
      code: "VAULT_CREATED_AT_MISSING",
      label: "Vault malformed",
      detail: "The created_at field is missing."
    };
  }
  if (doc.mode !== "self" && doc.mode !== "share") {
    return {
      code: "VAULT_MODE_INVALID",
      label: "Vault malformed",
      detail: `Mode must be "self" or "share", found "${String(doc.mode)}".`
    };
  }
  const kdf = doc.kdf;
  if (!kdf || kdf.algorithm !== QEV_KDF_ALG) {
    return {
      code: "VAULT_KDF_UNSUPPORTED",
      label: "Unsupported KDF",
      detail: `The kdf section is missing or its algorithm is not ${QEV_KDF_ALG}.`
    };
  }
  if (
    typeof kdf.opslimit !== "number" ||
    kdf.opslimit < MIN_OPSLIMIT ||
    kdf.opslimit > MAX_OPSLIMIT ||
    typeof kdf.memlimit !== "number" ||
    kdf.memlimit < MIN_MEMLIMIT ||
    kdf.memlimit > MAX_MEMLIMIT
  ) {
    return {
      code: "VAULT_KDF_PARAMS_OUT_OF_RANGE",
      label: "KDF parameters out of range",
      detail: `Argon2id parameters must be within opslimit ${MIN_OPSLIMIT}-${MAX_OPSLIMIT} and memlimit ${MIN_MEMLIMIT}-${MAX_MEMLIMIT} bytes.`
    };
  }
  if (typeof kdf.salt !== "string" || kdf.salt.length === 0) {
    return {
      code: "VAULT_KDF_SALT_MISSING",
      label: "Vault malformed",
      detail: "The kdf.salt field is missing."
    };
  }
  const wrap = doc.wrap;
  if (
    !wrap ||
    wrap.algorithm !== QEV_AEAD_ALG ||
    typeof wrap.nonce !== "string" ||
    wrap.nonce.length === 0 ||
    typeof wrap.wrapped_key !== "string" ||
    wrap.wrapped_key.length === 0
  ) {
    return {
      code: "VAULT_WRAP_SECTION_INVALID",
      label: "Vault malformed",
      detail: `The wrap section is missing, incomplete, or not ${QEV_AEAD_ALG}.`
    };
  }
  const content = doc.content;
  if (
    !content ||
    content.algorithm !== QEV_AEAD_ALG ||
    typeof content.nonce !== "string" ||
    content.nonce.length === 0 ||
    typeof content.ciphertext !== "string" ||
    content.ciphertext.length === 0
  ) {
    return {
      code: "VAULT_CONTENT_SECTION_INVALID",
      label: "Vault malformed",
      detail: `The content section is missing, incomplete, or not ${QEV_AEAD_ALG}.`
    };
  }
  return null;
}

function parseVaultBytes(bytes: Uint8Array): QevVaultDocument | VaultFailure {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return {
      failure: {
        code: "VAULT_PARSE_FAILED",
        label: "Vault parse failed",
        detail: "The locked payload is not readable JSON. It may be corrupted or tampered with."
      }
    };
  }
  const problem = structuralProblem(parsed);
  if (problem) return { failure: problem };
  return parsed as QevVaultDocument;
}

async function decryptVault(
  crypto: QevCryptoProvider,
  input: {
    vault: QevVaultDocument;
    password: string;
  }
): Promise<Uint8Array | VaultFailure> {
  await crypto.ready();
  const { vault } = input;

  let salt: Uint8Array;
  let wrapNonce: Uint8Array;
  let wrappedKey: Uint8Array;
  let contentNonce: Uint8Array;
  let contentCt: Uint8Array;
  try {
    salt = b64urlDecode(vault.kdf.salt);
    wrapNonce = b64urlDecode(vault.wrap.nonce);
    wrappedKey = b64urlDecode(vault.wrap.wrapped_key);
    contentNonce = b64urlDecode(vault.content.nonce);
    contentCt = b64urlDecode(vault.content.ciphertext);
  } catch {
    return {
      failure: {
        code: "VAULT_BASE64URL_INVALID",
        label: "Vault malformed",
        detail: "A binary field is not valid base64url-without-padding."
      }
    };
  }
  if (
    salt.length !== SALT_BYTES ||
    wrapNonce.length !== NONCE_BYTES ||
    contentNonce.length !== NONCE_BYTES ||
    wrappedKey.length !== KEY_BYTES + TAG_BYTES ||
    contentCt.length === 0
  ) {
    return {
      failure: {
        code: "VAULT_FIELD_LENGTHS_INVALID",
        label: "Vault malformed",
        detail: "Salt, nonce, wrapped key, or ciphertext lengths do not match the V2 format."
      }
    };
  }

  const aad = buildAad(vault);
  const wrapKey = crypto.argon2id(
    utf8Bytes(input.password),
    salt,
    vault.kdf.opslimit,
    vault.kdf.memlimit,
    KEY_BYTES
  );

  let vaultKey: Uint8Array;
  try {
    vaultKey = crypto.aeadDecrypt(wrappedKey, aad, wrapNonce, wrapKey);
  } catch {
    return {
      failure: {
        code: "VAULT_WRAP_AUTH_FAILED",
        label: "Wrong credential or tampered vault",
        detail:
          "The wrapping layer failed authentication: the credential is wrong or the vault metadata/wrap block was tampered with."
      }
    };
  } finally {
    crypto.wipe(wrapKey);
  }

  try {
    return crypto.aeadDecrypt(contentCt, aad, contentNonce, vaultKey);
  } catch {
    return {
      failure: {
        code: "VAULT_CONTENT_AUTH_FAILED",
        label: "Vault content tampered",
        detail:
          "The credential was correct (wrap layer verified) but the content block failed authentication: the ciphertext was tampered with."
      }
    };
  } finally {
    crypto.wipe(vaultKey);
  }
}

export interface QevVaultV2EnvelopeAdapterOptions {
  /** Argon2id strength preset; matches upstream presets plus "edge". Default "strong". */
  preset?: QevKdfPreset;
  /** Crypto backend; defaults to libsodium. Workers should pass nobleCryptoProvider. */
  crypto?: QevCryptoProvider;
}

export class QevVaultV2EnvelopeAdapter implements BuyerWrappingEnvelopeAdapter {
  private readonly opslimit: number;
  private readonly memlimit: number;
  private readonly crypto: QevCryptoProvider;

  constructor(options: QevVaultV2EnvelopeAdapterOptions = {}) {
    const preset = QEV_KDF_PRESETS[options.preset ?? "strong"];
    this.opslimit = preset.opslimit;
    this.memlimit = preset.memlimit;
    this.crypto = options.crypto ?? sodiumCryptoProvider;
  }

  async lock(input: EnvelopeLockInput): Promise<EnvelopeLockResult> {
    await this.crypto.ready();
    const custodyPassphrase = b64urlEncode(this.crypto.randomBytes(24));
    const contentSha256 = await sha256Hex(input.plaintext);
    const binding = {
      asset_version_id: input.assetVersionId as string,
      file_name: input.fileName,
      mime_type: input.mimeType,
      content_sha256: contentSha256
    };
    const inner: MyDigitalInnerEnvelope = {
      kind: MYDIGITAL_INNER_KIND,
      binding,
      payload_b64: b64urlEncode(input.plaintext)
    };
    const vault = await encryptVault(this.crypto, {
      plaintext: utf8Bytes(stableJson(inner)),
      password: custodyPassphrase,
      mode: "self",
      opslimit: this.opslimit,
      memlimit: this.memlimit
    });
    const lockedPayload = utf8Bytes(JSON.stringify(vault));
    return {
      lockedAssetId: newLockedAssetId(),
      envelopeFormat: QEV_VAULT_SCHEMA,
      envelopeVersion: vault.version,
      lockedPayload,
      lockedPayloadHash: await sha256Hex(lockedPayload),
      metadataHash: await sha256Hex(utf8Bytes(stableJson(binding))),
      qevEngineVersion: `qev-vault-v2/${this.crypto.name}-${ENGINE_VERSION}`,
      developmentOnly: false,
      keyMaterialB64: custodyPassphrase
    };
  }

  async wrapForCredential(input: WrapForCredentialInput): Promise<WrapForCredentialResult> {
    const parsed = parseVaultBytes(input.lockedPayload);
    if (isFailure(parsed)) {
      throw new Error(`Cannot wrap for credential: ${parsed.failure.detail}`);
    }
    const innerBytes = await decryptVault(this.crypto, {
      vault: parsed,
      password: input.keyMaterialB64
    });
    if (isFailure(innerBytes)) {
      throw new Error(`Cannot wrap for credential: ${innerBytes.failure.detail}`);
    }
    let inner: MyDigitalInnerEnvelope;
    try {
      inner = JSON.parse(new TextDecoder().decode(innerBytes)) as MyDigitalInnerEnvelope;
    } catch {
      throw new Error("Cannot wrap for credential: custody vault inner envelope is unreadable.");
    }
    if (inner.kind !== MYDIGITAL_INNER_KIND) {
      throw new Error("Cannot wrap for credential: custody vault has no commerce inner envelope.");
    }
    const buyerInner: MyDigitalInnerEnvelope = {
      ...inner,
      binding: { ...inner.binding, license_id: input.licenseId as string }
    };
    const buyerVault = await encryptVault(this.crypto, {
      plaintext: utf8Bytes(stableJson(buyerInner)),
      password: input.credential,
      mode: "share",
      opslimit: this.opslimit,
      memlimit: this.memlimit
    });
    const buyerLockedPayload = utf8Bytes(JSON.stringify(buyerVault));
    this.crypto.wipe(innerBytes);
    return {
      buyerLockedPayload,
      buyerLockedPayloadHash: await sha256Hex(buyerLockedPayload)
    };
  }

  async unlock(input: EnvelopeUnlockInput): Promise<EnvelopeUnlockResult> {
    if (input.licenseMaterial.length === 0) {
      return failedUnlock({
        code: "MISSING_LICENSE_MATERIAL",
        label: "Missing license material",
        detail: "Unlock requires a non-empty credential. No payload was returned."
      });
    }
    const parsed = parseVaultBytes(input.lockedPayload);
    if (isFailure(parsed)) return failedUnlock(parsed.failure);

    const plaintext = await decryptVault(this.crypto, {
      vault: parsed,
      password: input.licenseMaterial
    });
    if (isFailure(plaintext)) return failedUnlock(plaintext.failure);

    const checksPassed: VerificationCheck[] = [
      {
        code: "VAULT_WRAP_AUTH_VERIFIED",
        label: "Credential verified",
        detail:
          "Argon2id-derived wrapping key opened the wrap block; XChaCha20-Poly1305 authentication passed over the bound metadata."
      },
      {
        code: "VAULT_CONTENT_AUTH_VERIFIED",
        label: "Content authenticated",
        detail: "The content block decrypted with a valid Poly1305 authentication tag."
      }
    ];
    const checksSkipped: VerificationCheck[] = [];

    let payload: Uint8Array = plaintext;
    let inner: MyDigitalInnerEnvelope | null = null;
    try {
      const candidate = JSON.parse(new TextDecoder().decode(plaintext)) as MyDigitalInnerEnvelope;
      if (candidate.kind === MYDIGITAL_INNER_KIND) inner = candidate;
    } catch {
      inner = null;
    }

    if (inner) {
      try {
        payload = b64urlDecode(inner.payload_b64);
      } catch {
        return failedUnlock({
          code: "INNER_PAYLOAD_DECODE_FAILED",
          label: "Inner payload decode failed",
          detail: "The commerce inner envelope payload is not valid base64url."
        });
      }
      const payloadHash = await sha256Hex(payload);
      if (payloadHash !== inner.binding.content_sha256) {
        return failedUnlock({
          code: "INNER_CONTENT_HASH_MISMATCH",
          label: "Inner content hash mismatch",
          detail: "The decrypted payload does not match the content hash sealed inside the vault."
        });
      }
      checksPassed.push({
        code: "INNER_CONTENT_HASH_MATCH",
        label: "Sealed content hash match",
        detail:
          "SHA-256 of the decrypted payload matches the hash sealed inside the authenticated envelope."
      });
      checksPassed.push({
        code: "INNER_BINDING_PRESENT",
        label: "Commerce binding present",
        detail: `Vault is bound to asset version ${inner.binding.asset_version_id}${
          inner.binding.license_id !== undefined ? ` and license ${inner.binding.license_id}` : ""
        }.`
      });
    } else {
      checksSkipped.push({
        code: "INNER_BINDING_ABSENT",
        label: "Commerce binding",
        detail:
          "The vault decrypted to raw content without a My Digital inner envelope, so no asset/license binding was checked."
      });
    }

    return {
      plaintext: payload,
      verification: createVerificationResult({
        subjectType: "qev-vault-v2-unlock",
        subjectId: inner?.binding.license_id ?? inner?.binding.asset_version_id ?? "unbound-vault",
        status: "pass",
        checksPassed,
        checksSkipped,
        assumptions: [
          "The credential was delivered to the right buyer; credential delivery is outside the envelope boundary.",
          "Custody of the creator-side key material is demo-grade until server-side custody exists."
        ],
        artifacts: [QEV_VAULT_SCHEMA]
      })
    };
  }

  async verify(input: EnvelopeVerifyInput): Promise<VerificationResult> {
    return compareRecordedHashes(input, {
      demoOnly: false,
      assumptions: [
        "Expected hashes come from trusted marketplace records.",
        "This check compares recorded hashes only; cryptographic integrity is enforced by AEAD authentication at unlock."
      ]
    });
  }

  /**
   * Structural verification of a vault document: schema, version, mode,
   * KDF parameters, wrap and content sections, and field lengths.
   */
  async verifyVaultStructure(lockedPayload: Uint8Array): Promise<VerificationResult> {
    const checksPassed: VerificationCheck[] = [];
    const checksFailed: VerificationCheck[] = [];

    const parsed = parseVaultBytes(lockedPayload);
    if (isFailure(parsed)) {
      checksFailed.push(parsed.failure);
    } else {
      checksPassed.push(
        {
          code: "VAULT_SCHEMA_VALID",
          label: "Schema",
          detail: `Schema is ${QEV_VAULT_SCHEMA}, version ${parsed.version}, mode "${parsed.mode}".`
        },
        {
          code: "VAULT_KDF_PARAMS_VALID",
          label: "KDF parameters",
          detail: `Argon2id opslimit ${parsed.kdf.opslimit}, memlimit ${parsed.kdf.memlimit} bytes, within upstream caps.`
        }
      );
      try {
        const salt = b64urlDecode(parsed.kdf.salt);
        const wrapNonce = b64urlDecode(parsed.wrap.nonce);
        const wrappedKey = b64urlDecode(parsed.wrap.wrapped_key);
        const contentNonce = b64urlDecode(parsed.content.nonce);
        const ciphertext = b64urlDecode(parsed.content.ciphertext);
        if (
          salt.length === SALT_BYTES &&
          wrapNonce.length === NONCE_BYTES &&
          contentNonce.length === NONCE_BYTES &&
          wrappedKey.length === KEY_BYTES + TAG_BYTES &&
          ciphertext.length > 0
        ) {
          checksPassed.push({
            code: "VAULT_FIELD_LENGTHS_VALID",
            label: "Binary field lengths",
            detail: "Salt, nonces, wrapped key, and ciphertext have valid V2 lengths."
          });
        } else {
          checksFailed.push({
            code: "VAULT_FIELD_LENGTHS_INVALID",
            label: "Binary field lengths",
            detail: "One or more binary fields have lengths that do not match the V2 format."
          });
        }
      } catch {
        checksFailed.push({
          code: "VAULT_BASE64URL_INVALID",
          label: "Binary field encoding",
          detail: "A binary field is not valid base64url-without-padding."
        });
      }
    }

    return createVerificationResult({
      subjectType: "qev-vault-v2-structure",
      subjectId: QEV_VAULT_SCHEMA,
      status: inferVerificationStatus({
        failedCount: checksFailed.length,
        warningCount: 0
      }),
      checksPassed,
      checksFailed,
      checksSkipped: [
        {
          code: "DECRYPTION_NOT_ATTEMPTED",
          label: "Decryption",
          detail:
            "Structural verification does not attempt decryption; AEAD integrity is checked at unlock."
        }
      ],
      assumptions: [],
      artifacts: [QEV_VAULT_SCHEMA]
    });
  }
}

function failedUnlock(failure: VerificationCheck): EnvelopeUnlockResult {
  return {
    plaintext: new Uint8Array(),
    verification: createVerificationResult({
      subjectType: "qev-vault-v2-unlock",
      subjectId: QEV_VAULT_SCHEMA,
      status: "fail",
      checksFailed: [failure],
      assumptions: [
        "The credential was delivered to the right buyer; credential delivery is outside the envelope boundary."
      ],
      artifacts: [QEV_VAULT_SCHEMA]
    })
  };
}
