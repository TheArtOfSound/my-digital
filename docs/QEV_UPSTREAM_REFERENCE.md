# QEV Upstream Reference

This document records the QEV facts My Digital should preserve when integrating with the existing QEV work.

Reference repo:

```text
TheArtOfSound/qev-desktop
```

## 1. QEV identity

QEV stands for Qira Encryption Vault.

The upstream README frames QEV as a local-first vault workflow for encrypted, tamper-evident message envelopes.

Important public line:

> QEV is not a new encryption algorithm.

My Digital must preserve this. My Digital is a commerce workflow around locked assets and licenses, not a new cipher.

## 2. Current vault schema

Current upstream schema:

```text
BRY-NFET-SX-VAULT-V2
```

My Digital should treat this as the production target for real QEV envelope integration.

## 3. Upstream cryptographic model

Upstream QEV uses established primitives:

- AEAD: XChaCha20-Poly1305
- KDF: Argon2id
- runtime crypto: libsodium through `libsodium-wrappers-sumo`
- deterministic associated-data binding over canonical vault metadata

My Digital must not silently replace this with improvised cryptography.

## 4. Vault structure

A QEV vault is a JSON document containing metadata and ciphertext needed to decrypt one encrypted envelope.

The upstream example shape includes:

- `schema`
- `version`
- `created_at`
- `mode`
- `kdf`
- `wrap`
- `content`

The two-layer key model is:

1. passphrase + Argon2id -> wrapping key
2. wrapping key encrypts random 32-byte content key
3. content key encrypts plaintext

The passphrase is not used directly as the content encryption key.

## 5. Authenticated data

Upstream QEV binds vault metadata into encryption as deterministic associated data.

The associated data is derived by canonical JSON serialization of a fixed subset of metadata with recursively sorted object keys and no whitespace.

My Digital should reuse this concept for:

- asset manifest binding
- license-to-asset binding
- receipt verification
- tamper checks

## 6. Upstream threat model to preserve

QEV protects:

- confidentiality of vault content when the vault is obtained but the phrase is secret
- integrity of ciphertext and bound metadata through authenticated encryption
- portability across CLI, browser, and desktop implementations
- local/offline creation and opening of vaults
- tamper detection for bound metadata and ciphertext

QEV does not protect against:

- weak, guessed, reused, disclosed, or phished passphrases
- forgotten phrases
- malware or compromised devices
- browser extension compromise
- malicious dependency/package compromise
- clipboard, terminal, screen, keyboard, or process capture
- a recipient who decrypts and then discloses plaintext
- legal/operational failures outside QEV

My Digital adds marketplace risks on top of QEV and must document them separately.

## 7. My Digital integration principle

My Digital should not directly entangle marketplace code with cryptographic implementation details.

Correct boundary:

```text
My Digital commerce lifecycle -> Envelope Adapter -> QEV implementation
```

The current `@my-digital/envelope` package is the adapter boundary.

## 8. Demo adapter rule

The demo envelope adapter exists only for lifecycle testing.

It must remain labeled:

```text
DEMO ONLY - NOT PRODUCTION CRYPTO - FOR LIFECYCLE TESTING
```

Fable 5 must not remove this label until real QEV integration exists.

## 9. Production adapter (implemented 2026-06-11)

`QevVaultV2EnvelopeAdapter` lives in `@my-digital/envelope` (`src/qev-vault-v2.ts`). It:

- creates `BRY-NFET-SX-VAULT-V2` envelopes byte-compatible with upstream (field names, base64url without padding, the exact buildAADV2 associated-data subset, mode whitelist `self`/`share`, KDF caps, strength presets)
- locks asset bytes under a custody vault (mode `self`) and mints buyer-specific vaults (mode `share`) from the buyer's unlock code via `wrapForCredential`
- seals commerce binding (asset version, file name, mime type, content SHA-256, license id) inside the authenticated plaintext (`MYDIGITAL-LOCKED-ASSET-V1` wrapper) so the vault stays upstream-format while the binding is tamper-evident
- unlocks with the buyer credential, with distinct structured failures for wrong credential/tampered metadata (`VAULT_WRAP_AUTH_FAILED`) and tampered ciphertext (`VAULT_CONTENT_AUTH_FAILED`)
- verifies schema/version/mode/KDF/wrap/content structure via `verifyVaultStructure`
- returns structured `VerificationResult`s everywhere

Cross-implementation compatibility is tested against the published `@bryan237l/qev-cli` in both directions. Upstream constraints to remember: the CLI requires UTF-8 plaintext (text assets are directly CLI-openable; binary assets unlock via My Digital tooling) and caps ciphertext at 1 MiB.

Custody caveat: `lock()` returns the custody passphrase as `keyMaterialB64`; the caller must treat it as a secret. It is never persisted by current code. Server-side key custody is future work, which is why the web app and the SQLite demo database intentionally stay on the demo adapter for now.

## 10. Do not over-merge products

QEV Secure remains the security/reviewer hub.

My Digital is the commerce extension.

The relationship should be stated as:

> My Digital uses QEV Secure envelope semantics to lock, license, verify, and trace digital goods.
