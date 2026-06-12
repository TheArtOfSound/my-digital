# Build Notes

## 2026-06-10 foundation pass

Initial repository foundation created.

Added:

- README
- product charter
- Fable 5 execution brief
- architecture document
- threat model
- data model
- QEV upstream reference
- roadmap
- pnpm workspace
- strict TypeScript base config
- shared domain types
- core verification utilities
- demo envelope adapter

Important choices:

- The first product is not a full marketplace. It is the lock/license/verify commerce primitive.
- The phrase `piracy-proof` is forbidden.
- Demo envelope behavior is allowed only when clearly labeled as not production cryptography.
- Existing QEV work should be referenced through an adapter boundary rather than blindly copied.
- The package boundary for asset envelopes is `packages/envelope`.

Next expected action:

- Validate workspace install/typecheck/build.
- Add `apps/web` with minimal Vite React shell.
- Add local lifecycle demo using `@my-digital/types`, `@my-digital/core`, and `@my-digital/envelope`.

## 2026-06-10 validation and positioning pass

Validated Stage 0 exit criteria from a fresh clone. Two failures found and fixed:

- `pnpm typecheck` failed in `@my-digital/core`: workspace packages pointed `main`/`types` at `dist/`, which does not exist before a build, so a fresh clone could never typecheck. Internal packages now export `src/index.ts` directly (internal-package pattern). No package emits `dist`; `apps/web` produces the only build artifact. Package `build` scripts are now no-emit type checks. Dist emission can return when a package needs standalone publishing.
- `pnpm build` failed in `@my-digital/envelope`: `crypto.subtle.digest` rejected `Uint8Array<ArrayBufferLike>` under TS 5.7 generic typed-array rules. `sha256Hex` now copies input into a fresh `Uint8Array` before digesting.

Current state: `pnpm install`, `pnpm typecheck`, `pnpm build`, and `pnpm test` all pass from a fresh clone. Tests are still placeholder echoes; real tests arrive with Stage 1.

Added `docs/POSITIONING.md`: competitive landscape, lane statement, wedge, first niches, objection handling, and proposed domain plan (`mydigital.imagineqira.com` for the app, receipts verified at `/verify/<receiptId>`, offline verification remains the trust root).

Next expected action:

- Stage 1 local lifecycle demo with real tests (vitest): create -> lock -> list -> simulated paid purchase -> license -> unlock -> verify -> receipt, plus a tamper case that must fail verification.

## 2026-06-10 Stage 1 lifecycle pass

Implemented the full local lifecycle demo (roadmap Stage 1, execution brief Phase 2). All 13 required flow steps run, are tested, and are runnable via `pnpm demo`.

Added to `@my-digital/types`:

- `AssetManifest` (schema `MYDIGITAL-ASSET-MANIFEST-V1`)
- `Fingerprint` and `Revocation` interfaces (closing the Phase 1 type list)
- The `EnvelopeAdapter` contract (`EnvelopeAdapter`, lock/unlock/verify input/output types) moved here from `@my-digital/envelope` so core can orchestrate against the interface without a circular dependency. Envelope re-exports them.

Added to `@my-digital/core`:

- `ids.ts` prefixed ID factories matching the data model conventions
- `encoding.ts` / `hash.ts` shared base64/utf8/SHA-256 helpers (`sha256Hex` moved here from envelope)
- `signing.ts` Ed25519 signatures over canonical JSON via WebCrypto
- `manifest.ts` asset manifest creation and hashing
- `entities.ts` creator/buyer/asset/version/locked-record/listing factories and the mock paid purchase
- `licenses.ts` buyer license issuance and structured verification
- `unlock-codes.ts` unlock code generation (hash-only storage), verification, redemption
- `receipts.ts` proof receipt generation and verification, with `verificationUrl` support
- `lifecycle.ts` `runLifecycleDemo` orchestrating all 13 roadmap steps, gating unlock on verification, including the mandatory tamper-failure check

Changed in `@my-digital/envelope`:

- Demo adapter no longer returns plaintext without license material and fails structurally (instead of throwing) on corrupted envelopes
- Helper functions now come from `@my-digital/core`

Added `apps/lifecycle-demo`:

- `pnpm demo` runs the full lifecycle with readable step/verification output and exits non-zero if any step misbehaves
- End-to-end tests covering the full loop

What is real vs simulated:

- REAL: SHA-256 content/manifest/payload hashing, Ed25519 issuer signatures over canonical JSON, unlock-code hashing, tamper detection against recorded hashes and signatures.
- DEMO-ONLY: the envelope lock itself (base64 wrapper, labeled in payload, results, and UI text), the payment provider (`mock`), and issuer key management (ephemeral in-memory keypair, no PKI). License signatures cover the immutable claim only, so later revocation does not invalidate the issuance signature — the same deterministic canonical-binding concept as upstream QEV.

Validation:

- `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm demo` all pass from fresh clone
- 45 tests: 33 in core, 8 on the demo envelope adapter, 4 end-to-end
- Tamper cases fail verification as required; happy paths pass; demo-only warnings appear in every envelope verification result

Next expected action:

- Stage 2 web shell: wire `/sell`, `/listing/:id`, `/checkout/:id`, `/unlock`, `/verify`, `/creator` routes to the same core lifecycle functions with clearly labeled demo state.

## 2026-06-11 Stage 2 web shell pass

Implemented the full web shell (roadmap Stage 2, execution brief Phase 3). All routes exist and run the same `@my-digital/core` functions used by the Stage 1 demo: `/` landing with live listings, `/sell` lock-and-list flow, `/listing/:id`, `/checkout/:id` mock checkout, `/unlock`, `/verify`, `/creator` dashboard.

Structure:

- `apps/web/src/lib/marketplace.tsx` — React context store; demo records persist in browser localStorage (`mydigital-demo-marketplace-v1`); locked payloads stored base64-encoded; capped at 2 MB per file.
- `apps/web/src/lib/serialization.ts` — pure state serialization with schema versioning, covered by vitest.
- `apps/web/src/components/VerificationResultView.tsx` — renders the full structured result: checks passed, failed, not checked, warnings, and assumptions. No bare booleans anywhere in the UI.
- React Router v7, React 19, no extra state libraries.

Honesty properties verified by driving the UI in a real browser:

- The raw unlock code appears once on the checkout confirmation and is never written to storage (only its SHA-256 hash; checked against the serialized state).
- Unlock is gated: license, unlock code, and envelope verification run first; any failure blocks plaintext.
- Revoking a license from the creator dashboard creates a signed `Revocation` record, and subsequent unlock attempts fail with `LICENSE_REVOKED` while `LICENSE_SIGNATURE_VALID` still passes (signature covers the immutable claim).
- The `/verify` page includes a labeled tamper simulation (flips one byte of an in-memory copy) that fails with `LOCKED_PAYLOAD_HASH_MISMATCH`.
- Demo labels persist everywhere: DEMO MODE pill, demo-adapter notices, mock-payment notice, warning-status envelope results, and a footer stating what is real vs simulated.

Demo-only compromises, labeled in the UI:

- The issuer private key (Ed25519 JWK) is stored unprotected in localStorage so the demo survives reloads. The creator dashboard states this. Production issuance must never do this.
- Receipts embed `verificationUrl` under the proposed `https://mydigital.imagineqira.com/verify/<receiptId>` base; the URL is a convenience pointer, the signed artifact remains the trust root.

Browser requirement: WebCrypto Ed25519 (current Chrome, Safari, Firefox). The app feature-detects and shows a clear unsupported message otherwise.

Validation:

- `pnpm typecheck`, `pnpm build`, `pnpm test` (49 tests across core, envelope, web serialization, lifecycle e2e), `pnpm demo` all pass.
- Full lifecycle completed visually in a browser: creator setup -> lock/list -> listing -> mock checkout -> unlock (pass) -> verify receipt (pass) -> tamper simulation (fail as expected) -> revoke -> unlock blocked. State survived full page reloads between every step.

Next expected action:

- Stage 3 persistence: replace browser localStorage with SQLite + Drizzle or Prisma behind a storage interface, with committed migrations and a seed command.

## 2026-06-11 Stage 3 persistence pass

Added `packages/store`: a `MarketplaceStore` interface with two implementations behind it — `MemoryMarketplaceStore` (tests/ephemeral) and `SqliteMarketplaceStore` (Drizzle ORM + better-sqlite3). One conformance test suite runs against both implementations (30 tests), so the SQLite store is proven to behave identically to the in-memory reference.

Schema (`packages/store/src/schema.ts`) covers all twelve required tables — creators, buyers, assets, asset_versions, locked_assets, listings, purchases, licenses, unlock_codes, proof_receipts, fingerprints, revocations — plus two more:

- `locked_payloads`: locked payload bytes as BLOBs (local/dev storage; production moves to object storage behind `storageUri`)
- `issuers`: issuer name + public key only. Private signing keys never enter the marketplace database. Asset manifests are stored as a JSON column on `asset_versions` rather than a separate table.

Migrations are generated by drizzle-kit and committed under `packages/store/drizzle/`; `openSqliteStore` applies them automatically on open. Foreign keys are enforced (`PRAGMA foreign_keys = ON`); writes use WAL.

Commands (roadmap exit criteria):

- `pnpm db:seed` — destructive demo seed: resets the database, runs the full lifecycle via `runLifecycleDemo`, persists every record, prints the raw unlock code once (only its hash is stored).
- `pnpm db:verify [rawCode]` — fresh-process verification: loads the issuer public key and all records from disk, re-verifies license (pass), envelope hash (warning, demo), a tampered in-memory copy (must fail), receipt (pass), and — when the raw code is supplied — the unlock code plus a real unlock whose plaintext SHA-256 must match the recorded content hash. Exits non-zero on any unexpected status. Without the code it prints "not checked" rather than implying coverage.

Verified: seed in one process, verify in a separate process (restart survival), both with and without the unlock code. Database lives at `apps/lifecycle-demo/data/my-digital-demo.sqlite` (gitignored), overridable via `MYDIGITAL_DB`.

Scope note: the web app intentionally still uses its labeled browser-localStorage demo store. Moving the web app onto this database requires an API server boundary, which belongs with the payment adapter work (Stage 4) rather than half-done here.

Validation: `pnpm typecheck`, `pnpm build`, `pnpm test` (79 tests), `pnpm demo`, `pnpm db:seed`, `pnpm db:verify` all pass.

Next expected action:

- Stage 4 payment abstraction: `PaymentAdapter` interface with a mocked adapter, license issuance only after paid confirmation, tests proving unpaid purchases cannot obtain valid licenses — ideally introduced together with a thin API server over `@my-digital/store` so the web app can move off localStorage.

## 2026-06-11 Stage 4 payment abstraction pass

Added the payment boundary. The `PaymentAdapter` contract (`createCheckout`/`confirmPayment`, per the architecture doc) lives in `@my-digital/types`; `@my-digital/core` gains `payments.ts` with:

- `MockPaymentAdapter` — simulates a provider, moves no money. Checkout sessions are adapter-side state (not yet persisted records). Repeated confirmations are idempotent (provider events are at-least-once); flipping a completed session to a different outcome is refused.
- `createPendingPurchase` — purchases now start as `pending`, bound to a checkout session's provider reference, amount, and currency.
- `applyPaymentConfirmation` — the only path from `pending` to `paid` (or `failed`). Refuses confirmations whose session reference or amount/currency do not match the purchase.
- `completeMockCheckout` — convenience: checkout -> pending purchase -> confirm -> apply.

`simulatePaidPurchase` was removed; every purchase in the lifecycle script, tests, and web app now flows through the adapter. `runLifecycleDemo` step 7 is "checkout via mock payment adapter (paid event)" and aborts if payment does not confirm paid. License issuance was already gated on `status === "paid"`; the seam now exists for a Stripe adapter in its own package behind the same contract.

Web checkout goes through the adapter and gains a "Simulate declined payment" button: a declined payment stores a `failed` purchase record and the UI states plainly that no license was issued, no unlock code exists, and no receipt was generated. Browser-verified end to end (declined then paid on the same listing; creator dashboard shows both purchases; no console errors).

Tests (10 new in `packages/core/src/payments.test.ts`) cover the roadmap exit criteria directly: a mocked paid event yields a license that verifies (pass); a pending purchase cannot obtain a license; a failed payment yields no license and no unlock path; plus session binding, amount-tamper rejection, idempotency, and outcome-flip refusal.

Validation: `pnpm typecheck`, `pnpm build`, `pnpm test` (89 tests), `pnpm demo`, `pnpm db:seed`, `pnpm db:verify <code>` all pass.

Next expected action:

- Stage 5 real QEV integration: `QevVaultV2EnvelopeAdapter` implementing `BRY-NFET-SX-VAULT-V2` semantics (Argon2id + XChaCha20-Poly1305 via libsodium) behind the existing `EnvelopeAdapter` contract, with the demo adapter retained for lifecycle tests. Alternatively, a thin API server over `@my-digital/store` first if moving the web app off localStorage takes priority.

## 2026-06-11 Stage 5 real QEV integration pass

Added `QevVaultV2EnvelopeAdapter` (`packages/envelope/src/qev-vault-v2.ts`), the production envelope adapter. The demo adapter is retained unchanged for lifecycle tests; both share the recorded-hash comparison helper (`hash-comparison.ts`), with the demo warning only on the demo adapter.

Fidelity to upstream. The upstream repo (`TheArtOfSound/qev-desktop`) was cloned and the adapter was written against `docs/VAULT_FORMAT.md` and `qev-cli/lib/vault.js` directly: exact field names (`kdf.opslimit`/`memlimit`/`salt`, `wrap.nonce`/`wrapped_key`, `content.nonce`/`ciphertext`), base64url without padding, the exact `buildAADV2` associated-data subset (everything except `wrapped_key` and `ciphertext`, canonical-JSON with recursively sorted keys), the two-layer key model (Argon2id -> wrapping key -> random 32-byte vault key -> content), the `self`/`share` mode whitelist, upstream KDF caps (ops 1-10, mem 8-256 MiB), and the upstream strength presets (quick/strong/vault). Proven by cross-implementation tests against the published `@bryan237l/qev-cli@0.30.0` (devDependency) in both directions: buyer vaults minted here decrypt with the upstream implementation, and upstream-encrypted vaults unlock here.

Commerce profile on top of the format. `lock()` encrypts into a custody vault (mode `self`) under a random custody passphrase returned as `keyMaterialB64` — a secret the caller holds; it is never persisted, serialized into results, or logged (audited). `wrapForCredential()` mints a buyer-specific vault (mode `share`) under the buyer's raw unlock code, sealing the commerce binding (asset version, file name, mime type, content SHA-256, and license id) inside the authenticated plaintext as a `MYDIGITAL-LOCKED-ASSET-V1` wrapper. The vault document stays 100% upstream-format while the binding is tamper-evident through AEAD; swapping or editing any bound field breaks authentication.

Real failure semantics, structured: wrong credential or tampered metadata -> `VAULT_WRAP_AUTH_FAILED` with zero plaintext returned; tampered ciphertext with a valid credential -> `VAULT_CONTENT_AUTH_FAILED`; KDF parameters outside upstream caps are rejected; `verifyVaultStructure()` checks schema/version/mode/KDF/wrap/content shape and field lengths and reports decryption as explicitly not-attempted.

Contract changes: `EnvelopeLockResult.keyMaterialB64?` (documented as secret custody material) and `BuyerWrappingEnvelopeAdapter.wrapForCredential` in `@my-digital/types`; `isBuyerWrappingEnvelopeAdapter` guard in core. `runLifecycleDemo` now auto-numbers steps and inserts a "mint buyer-specific vault" step for wrapping adapters (14 steps on QEV, 13 on demo). `pnpm demo:qev` runs the lifecycle on real crypto at the upstream "strong" preset.

Dependency note: `libsodium-wrappers-sumo@0.7.16` ships a broken ESM entry (its `.mjs` imports a sibling file that does not exist in the package — the same bug upstream works around with `createRequire`). Fixed once for all toolchains via a committed pnpm patch (`patches/libsodium-wrappers-sumo@0.7.16.patch`) pointing the `import` condition at the working CJS build; verified with a frozen-lockfile reinstall. `@my-digital/envelope` is marked `sideEffects: false`, so the web bundle (demo adapter only) does not include libsodium — bundle size unchanged.

Deliberate deferrals, with reasons: the web app and the SQLite demo database stay on the demo adapter because the QEV adapter's custody key material belongs server-side; teaching content keys into browser localStorage or the demo database would model the wrong architecture even labeled. The API-server stage migrates both. Upstream CLI constraints recorded: UTF-8 plaintext required (text assets are directly CLI-openable; binary assets unlock via My Digital tooling) and 1 MiB ciphertext cap.

Validation: `pnpm typecheck`, `pnpm build`, `pnpm test` (103 tests: 43 core, 30 store, 20 envelope, 4 web, 6 lifecycle-demo), `pnpm demo`, `pnpm demo:qev`, `pnpm db:seed`, `pnpm db:verify <code>` all pass.

Next expected action:

- Stage 6 fingerprint/trace layer (manifest-level fingerprinting with honest evidence levels), or the thin API server over `@my-digital/store` to move the web app off localStorage and give the QEV adapter real server-side key custody — whichever Bryan prioritizes.
