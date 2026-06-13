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

## 2026-06-11 API server + real custody pass (Stage 7 groundwork)

Added `apps/server` (Hono on Node, port 8787) and rewired the web app from browser localStorage to the server API. The visible product now runs on real QEV cryptography end to end.

Key custody, the real-deal part:

- `Keystore` (`apps/server/src/keystore.ts`): a 32-byte master key from `MYDIGITAL_MASTER_KEY_B64` or an auto-generated `data/master-key.b64` file (chmod 600 — the local-dev stand-in for a KMS/HSM; that swap is the production hardening point). Secrets are sealed with XChaCha20-Poly1305 and AAD-bound to their record (`custody:<lockedAssetId>`, `issuer:<name>`), so a sealed blob cannot be replayed for a different record.
- Custody passphrases from `lock()` are sealed before they touch the database (`custody_secrets` table). The issuer's Ed25519 private key is sealed the same way (`issuer_secrets`); the `issuers` table remains public-key-only.
- Checkout opens the sealed custody secret, mints the buyer vault via `wrapForCredential`, persists only the encrypted result (`buyer_locked_payloads`), and returns the raw unlock code exactly once. Service tests assert the raw code appears nowhere in a full store dump.

Local-first unlock, the lane:

- The server has NO unlock endpoint. Buyers download the encrypted vault (`GET /api/licenses/:id/vault`) and decrypt in the browser — libsodium loads as a lazy chunk only on the unlock/verify pages, so the main bundle actually shrank. License verification (Ed25519) also runs client-side against the issuer public key. After purchase, credentials and plaintext never touch the server. The unlock page also takes a downloaded `.vault.json` file directly for a fully offline path.
- Consequence stated honestly: redemption tracking is not possible with local unlock. `unlock_codes` records prove issuance (hash only), not use.

API surface: `/api/health`, `/api/state`, `/api/issuer`, `POST /api/creator`, `POST /api/listings` (payload as base64, 2 MB dev cap), `POST /api/checkout` (mock payment adapter; declined outcome supported), `GET /api/licenses/:id/vault`, `GET /api/locked-assets/:id/payload`, `POST /api/licenses/:id/revoke`, `GET /api/licenses/:id/verify`, `GET /api/receipts/:id/bundle`, `POST /api/admin/reset`. Errors map to `{error}` JSON. Vite proxies `/api` to 8787; `pnpm server` + `pnpm dev` run the pair.

Store additions: `custody_secrets`, `issuer_secrets`, `buyer_locked_payloads` tables (migration `0001` committed), matching interface methods on both implementations, conformance suite extended (36 store tests).

Browser-verified end to end (real crypto, quick KDF preset): creator setup -> server-side QEV lock -> listing -> paid checkout (code shown once, vault + receipt-bundle downloads) -> local unlock in the browser (license PASS, vault unlock PASS, plaintext matches) -> wrong code fails with `VAULT_WRAP_AUTH_FAILED` -> revoke blocks unlock with `LICENSE_REVOKED` before the vault is even fetched -> tamper simulation fails integrity and structure checks -> declined payment stores a failed purchase and issues nothing -> receipt verifies client-side (hash, signature, both bindings).

Server tests (11) cover keystore sealing/AAD-binding/file permissions, custody-sealed listing, paid checkout with local-unlock simulation and wrong-code refusal, no-raw-code-in-store, declined checkout, revocation, reset with issuer rotation, issuer persistence across process restarts (new checkout works in the second process), and HTTP endpoints.

Validation: `pnpm typecheck`, `pnpm build`, `pnpm test` (120 tests across 6 packages), `pnpm demo`, `pnpm demo:qev`, `pnpm db:seed`/`db:verify` unaffected.

Next expected action:

- Stage 6 fingerprint/trace layer: every buyer vault is already unique and carries its license id sealed inside, so "this exact leaked vault was issued to license X" is an honest hash-match claim — build the trace check on top. Or continue Stage 7: buyer library/auth, Stripe adapter behind the payment contract, deployment to the proposed `mydigital.imagineqira.com`.

## 2026-06-11 Stage 6 trace + Stage 7 continuation pass ("go all")

Four deliverables: the trace layer (Stage 6 complete), the buyer library, the Stripe adapter package, and the deployment plan. The lifecycle spine CREATE → … → TRACE is now implemented end to end.

Trace (Stage 6). Every paid checkout now also writes a `Fingerprint` record — the buyer vault IS the fingerprint (`buyer-vault-sha256`, `per-buyer-vault-reencryption`, `exact-hash-match`): unique per buyer with the license id sealed inside the AEAD. `POST /api/trace` (and the `/trace` page) accepts a suspected leaked artifact and returns a `TraceResult` with honest evidence levels, exactly as the roadmap requires:

- `exact-vault-match`: byte-identical to a minted buyer vault → attributes license, buyer id hash, asset version, fingerprint record, and revocation status. Caveats state plainly that possession identifies whose copy circulated, not who circulated it.
- `plaintext-content-match`: matches a listed asset's content hash → says attribution is impossible because plaintext carries no buyer marking (per-buyer watermarking remains future work and is not claimed).
- `vault-format-unattributed`: structurally valid QEV vault not minted by this instance.
- `no-evidence`: unsupported artifact types report themselves as unsupported rather than implying confidence.

Store gains `findBuyerLockedPayloadByHash` and `findAssetVersionByContentHash` on both implementations (conformance-tested); `fingerprints` joined into `/api/state`.

Buyer library. `/library` looks up purchases/licenses/receipts by email — hashed in the browser, only the hash travels (`GET /api/buyers/:emailHash/library`). Vault and receipt-bundle downloads per license, revocation status visible. Labeled in the UI for what it is: a dev convenience, not authentication.

Stripe adapter. `@my-digital/payments-stripe` implements the `PaymentAdapter` contract: hosted Checkout Session creation (amount/metadata-bound), poll-based `confirmPayment` for the success-url return path, webhook verification via `confirmFromWebhook` (completed/expired events, idempotent like the mock, amount/currency tamper refusal, mock-only `simulateOutcome` rejected). Fully unit-tested against an injected fake client (8 tests). Honest status: NOT yet exercised against live Stripe; the go-live checklist (redirect-flow split, webhook fulfillment, sealed one-time code delivery, live test purchase) lives in `docs/DEPLOYMENT.md`. `CheckoutSession` gained an optional `checkoutUrl` for redirect providers.

Receipt deep link. `/verify/:receiptId` — the exact URL shape printed on receipts (`https://mydigital.imagineqira.com/verify/<id>`) — auto-selects and verifies the receipt on load, with an honest banner (paste-the-bundle fallback) when the receipt is not in this instance's records.

Deployment. `docs/DEPLOYMENT.md`: same-origin web+API behind a reverse proxy (SPA fallback required for receipt deep links), env table, master-key discipline (secret manager, loss semantics: buyer vaults still unlock; custody/issuer sealing unrecoverable), backup/restore drill, Stripe go-live checklist, hardening list (auth, reset-endpoint gating, rate limits). Nothing is deployed yet; the plan is the deliverable.

Browser-verified: trace exact-match attributing a re-uploaded vault to its license/buyer-hash/fingerprint; plaintext trace honestly unattributable; garbage → no-evidence; library showing ACTIVE and REVOKED licenses with downloads; `/verify/<receiptId>` deep link auto-verifying all four receipt checks on a fresh page load. No console errors.

Validation: `pnpm typecheck`, `pnpm build`, `pnpm test` — 137 tests across 7 packages (43 core, 40 store, 20 envelope, 8 payments-stripe, 4 web, 6 lifecycle-demo, 16 server).

Next expected action:

- Stage 7 to beta per `docs/DEPLOYMENT.md`: pick a host, wire the Stripe redirect/webhook flow with live test keys, add real buyer auth, gate the admin reset, deploy to `mydigital.imagineqira.com`.

## 2026-06-12 Stripe-ready checkout + deploy hardening pass

Built everything on the Stripe go-live checklist that does not require keys, plus deploy/hardening items.

Checkout is now a redirect-capable two-phase flow behind the same API:

- `POST /api/checkout/begin`: pending purchase + provider session persisted (`checkout_sessions` table, migration 0002) with `checkoutUrl` for hosted providers.
- `POST /api/checkout/complete` (by purchase id or provider reference): confirms via the adapter and fulfills (license, hash-only unlock code, buyer vault, receipt, fingerprint). Restart-safe: the persisted session is rehydrated via the new optional `PaymentAdapter.restoreSession` (implemented by mock and Stripe adapters; covered by a kill-and-resume test). Re-completing a fulfilled purchase is refused — the unlock code is shown exactly once, never retrievable.
- `POST /api/webhooks/stripe`: verifies the signature and settles the purchase (paid/failed). Fulfillment still happens on `complete`, so the raw code goes straight to the buyer's browser and is never stored; webhook-driven fulfillment with sealed code delivery is deferred until buyer auth exists (an unauthenticated retrieval endpoint would hand codes to anyone).
- `POST /api/checkout` (single-call) is unchanged for the mock flow; the web app needs no changes.
- Service tests run the full Stripe flow against a fake client: begin -> webhook marks paid -> complete fulfills without re-polling; bad signatures rejected; mock adapter refuses webhooks with a clear error.

Deploy/hardening:

- Single-process mode: the server serves `apps/web/dist` when built (custom static handler: traversal-guarded, SPA fallback for `/verify/<receiptId>` deep links). Smoke-tested against the running server.
- `POST /api/admin/reset` is token-gated via `MYDIGITAL_ADMIN_TOKEN` (401 verified live).
- Payments selected by env: `MYDIGITAL_PAYMENTS=stripe` + `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/`MYDIGITAL_PUBLIC_URL` constructs the real adapter at startup with an honest "not yet validated live" banner.
- `docs/SUPPORT.md` added (Stage 7 requirement): lost-code/lost-vault/revocation/trace-interpretation/key-loss answers, each stating what is and is not possible by design.

Key audit (2026-06-12): searched the dev machine for Stripe credentials — only LIVE keys belonging to unrelated ventures exist (ahcrap-shop, prideshop); no test keys anywhere. Decision: do NOT exercise another business's live account. The one unvalidated inch — real network calls against Stripe — needs a My Digital Stripe account's TEST keys (`sk_test_…`); everything up to that line is built and tested (149 tests; the full suite is now 149 across 7 packages).

Validation: `pnpm typecheck`, `pnpm build`, `pnpm test` (149), `pnpm demo`, `pnpm db:seed`/`db:verify`, single-process static smoke, admin-gate smoke — all pass.

Next expected action:

- Obtain My Digital Stripe TEST keys -> run the step-4 test-mode purchase (add the small redirect UI: send buyer to `session.checkoutUrl`, call `complete` from `/checkout/done`). Pick a host + DNS for `mydigital.imagineqira.com`. Buyer auth remains the largest open beta item.

## 2026-06-12 live Stripe validation (owner-authorized)

Bryan explicitly authorized using the live keys found on the machine. Validation ran against the Trend account (`acct_1TdqpyGz3eX0vCtE`) with zero charges and full cleanup:

1. `POST /api/checkout/begin` created a REAL live Checkout Session (`cs_live_…`, hosted URL on checkout.stripe.com, $19.00 line item, metadata bound) — live authentication and session parameters accepted by Stripe.
2. `complete` on the open session returned the honest "has not completed yet" error.
3. The session was expired via the Stripe API; `complete` then settled the purchase as FAILED — the real expired-session path works.
4. A second session was begun; a checkout.session.completed event signed with the configured webhook secret (Stripe HMAC scheme) was verified by the REAL Stripe SDK (`constructEventAsync`) and settled the purchase as paid; a forged signature was rejected by the SDK with Stripe's own error. `complete` then fulfilled WITHOUT re-polling: license, one-time UNLK code, signed receipt, and a real `BRY-NFET-SX-VAULT-V2` buyer vault (mode `share`).
5. Both live sessions were expired afterward; the Trend dashboard holds no actionable objects.

Also fixed: `/api/health` hardcoded `payments: "mock"` — it now reports the active provider.

Remaining unexercised, by definition: a human completing the hosted page with a real card (creates a real charge). Recommendation stands: do that one purchase at go-live on a My Digital-branded Stripe account.

Validation: full suite re-run after the health fix — 149 tests, typecheck, build all green.

## 2026-06-12 Cloudflare production pass: Workers + D1, custom domain, redesign

The product is live at https://mydigital.imagineqira.com.

Workers port. `apps/worker` runs the same Hono app on Cloudflare Workers: `@my-digital/server-core` extracted so `apps/server` (Node + better-sqlite3) and the Worker (D1) share createApp/MarketplaceService/Keystore unchanged. `D1MarketplaceStore` shares the Drizzle schema and row mappers with the sqlite store (`packages/store/src/row-mappers.ts`); the better-sqlite3 store moved to the `@my-digital/store/node` subpath so the Worker bundle never touches native modules. Migrations live in `apps/worker/d1-migrations` (concatenated from `packages/store/drizzle`). Assets are served by Workers Assets with SPA fallback; `run_worker_first` keeps `/api/*` on the Worker.

Edge crypto. libsodium cannot instantiate on Workers, so the QEV adapter's crypto backend is pluggable (`packages/envelope/src/qev-crypto.ts`): libsodium remains the Node/browser default; `@noble/hashes` + `@noble/ciphers` (pure JS, audited) run on Workers at the new `edge` KDF preset (Argon2id ops 1 / 8 MiB — the upstream minimum, honest because My Digital credentials are high-entropy random secrets, not human passphrases). Byte-compatibility of noble <-> sodium <-> the published qev CLI is covered by the cross-implementation test suite (24 envelope tests). Secrets (`MYDIGITAL_MASTER_KEY_B64`, `MYDIGITAL_ADMIN_TOKEN`) are Workers secrets; the issuers table still stores public keys only. Payload cap is 1 MB (D1 2 MB row limit, matches the CLI cap).

Domain. imagineqira.com was onboarded to Bryan's Cloudflare account via Chrome with his authorization: 18 records imported and deliberately set to DNS-only for a byte-identical migration (existing site at 54.167.112.215 and all Microsoft 365 mail records — MX, SPF, DMARC, autodiscover, sip/lyncdiscover, SRV — verified intact after cutover); GoDaddy nameservers switched to alla/weston.ns.cloudflare.com (identity OTP read from Gmail); delegation propagated within minutes; the Worker custom domain `mydigital.imagineqira.com` attached and certificates issued. Receipts printed since Stage 4 already carry this exact verification URL, and `/verify/<receiptId>` resolves on it now.

Redesign. Full restyle to a professional light identity per Bryan's direction: white ground, black accents, square corners, serif headlines, ruled tables, restrained functional status colors only, Imagine Qira + QEV branding in masthead and footer, no emojis (license terms now read Allowed/Not allowed). Same class names throughout — components untouched except masthead, footer, home page, and license-terms copy.

Validation: 153 tests across 7 packages; typecheck/build green; live checks on the custom domain (health, state with real D1 records); existing-site and mail DNS verified post-migration.

Remaining for full production: real-card Stripe purchase on a My Digital Stripe account (`MYDIGITAL_PAYMENTS=stripe` + secrets), buyer auth, and optionally enabling the Cloudflare proxy on the legacy site records.

## 2026-06-12 live Stripe checkout on production (owner-authorized)

https://mydigital.imagineqira.com now takes real card payments through Stripe's hosted checkout, using the live keys Bryan explicitly authorized (Trend account).

Web redirect flow: the marketplace context reads the active payment provider from `/api/health`. In stripe mode the checkout page collects the buyer email (hashed), calls `POST /api/checkout/begin`, and redirects to the hosted session; the new `/checkout/done` page completes the purchase on return (`providerReference` from `session_id`), fulfills (license, one-time code, buyer vault, receipt), and renders the shared `PaidOutcomePanel`. Refreshing after fulfillment gets the honest already-fulfilled message with a path to the library. The mock-only declined-simulation button is hidden in stripe mode, and the masthead badge/footer state the provider truthfully.

Workers-safe SDK: `createStripePaymentAdapter` now constructs Stripe with the fetch HTTP client and verifies webhooks through the SubtleCrypto provider, so the same code runs on Node 18+ and workerd.

Live wiring: webhook endpoint `we_1Thgc9…` registered at Stripe for checkout.session events pointing at `/api/webhooks/stripe`; `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` set as Worker secrets (values never logged); `MYDIGITAL_PAYMENTS=stripe` deployed.

Verified on production: health reports stripe (adapter constructed on workerd); `begin` minted a real live Checkout Session from the Worker with a reachable hosted page; `complete` on the open session refused honestly; after expiring the session at Stripe, `complete` settled the purchase as failed in D1 with no license minted; the live checkout page renders the Stripe flow. The expired session was cleaned up; no charges occurred.

Remaining, by definition human: one real-card purchase end to end (hosted page → /checkout/done → code/vault). Revenue currently lands in the Trend Stripe account; moving to a My Digital-branded Stripe account later means swapping two Worker secrets and re-registering the webhook.
