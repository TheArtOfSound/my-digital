# Fable 5 Execution Brief

This file is the instruction layer for the implementation agent.

## Build target

Build My Digital piece by piece as a QEV-powered digital goods commerce system.

Do not jump directly into a large marketplace. First implement and validate the locked-asset lifecycle:

```text
CREATE -> LOCK -> LIST -> BUY -> LICENSE -> UNLOCK -> VERIFY -> TRACE
```

## Product summary

My Digital lets creators sell digital products as QEV-locked assets with automatic buyer-specific unlock licenses, tamper verification, and proof-of-purchase receipts.

## Execution rule

Every phase must leave the repository in a runnable, testable state.

If a phase cannot be fully completed, preserve the last working state and document the failure in `docs/BUILD_NOTES.md`.

## Phase 0: repository foundation

Expected files:

- `README.md`
- `docs/PRODUCT_CHARTER.md`
- `docs/FABLE5_EXECUTION_BRIEF.md`
- `docs/ARCHITECTURE.md`
- `docs/THREAT_MODEL.md`
- `docs/DATA_MODEL.md`
- `docs/BUILD_NOTES.md`
- `.gitignore`
- `package.json`
- `pnpm-workspace.yaml`
- `apps/web`
- `packages/core`
- `packages/qev-lock`
- `packages/types`

## Phase 1: core domain model

Implement TypeScript domain types for:

- Creator
- Buyer
- Asset
- AssetVersion
- LockedAsset
- Listing
- Purchase
- License
- UnlockCode
- ProofReceipt
- VerificationResult
- Fingerprint
- Revocation

Rules:

- types must be explicit
- IDs must be branded or strongly distinguished where practical
- verification result must be structured, not just boolean
- license terms must be machine-readable

## Phase 2: local lock/license simulation

Implement local-only demo functions:

- create asset manifest
- hash asset bytes
- create locked asset envelope
- create listing
- simulate purchase
- issue buyer license
- verify license against asset
- unlock demo payload
- export proof receipt

This phase may use demo cryptography only if clearly labeled as development-only. Production crypto must not be faked silently.

## Phase 3: web UI skeleton

Implement minimal web routes:

- `/` landing page
- `/sell` create locked asset demo
- `/listing/:id` listing preview
- `/unlock` unlock license demo
- `/verify` verify asset/license/receipt
- `/creator` creator dashboard placeholder with real local state

No fake security theater. If something is simulated, label it.

## Phase 4: persistence

Add database schema and local persistence for the core lifecycle.

Preferred stack:

- Next.js or Vite React for web
- TypeScript
- SQLite for local/dev persistence
- Drizzle or Prisma, whichever is already easiest to wire correctly

## Phase 5: payment integration boundary

Add payment abstraction without committing to a live processor too early.

Required interface:

- create checkout session
- receive paid purchase event
- issue license after confirmed payment
- reject unpaid unlock attempts

Stripe can be used later, but the first implementation should support a mocked payment adapter.

## Phase 6: QEV integration

Integrate real QEV/BRY-NFET-SX logic only after the lifecycle works end-to-end.

Do not block the marketplace skeleton on final crypto integration.

Required integration points:

- lock asset bytes
- wrap asset key
- verify envelope metadata
- verify license signature
- unlock payload
- generate proof receipt

## Phase 7: trace/fingerprint layer

Implement only after asset lock/license/unlock/verify works.

Start with simple manifest-level fingerprinting:

- unique license ID embedded in receipt
- optional buyer-specific metadata file inside package
- visible watermark for PDFs/images only if implemented honestly

Do not claim robust forensic watermarking until it exists.

## Definition of done for first agent pass

The first useful build pass is complete when:

1. the repo installs cleanly
2. the web app runs locally
3. a creator can create a demo asset listing
4. a buyer can simulate purchase
5. a buyer-specific license is issued
6. the license verifies against the asset
7. unlock produces the original demo payload
8. a proof receipt can be viewed/exported
9. tests cover core lock/license/verify behavior
10. docs explain what is real vs simulated

## Hard prohibitions

- Do not market as piracy-proof.
- Do not call QEV a new encryption algorithm.
- Do not ship fake production crypto.
- Do not hide demo-only behavior.
- Do not build unrelated social features.
- Do not add blockchain, tokens, NFTs, wallets, or Solana unless explicitly requested later.
- Do not add AI features until the commerce primitive is stable.

## Preferred tone in UI

Clear, technical, credible.

Avoid hype. Avoid vague cyberpunk language. Use phrases like:

- locked digital asset
- buyer-specific license
- proof receipt
- tamper verification
- local-first unlock
- creator provenance
- traceable licensing
