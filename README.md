# My Digital

My Digital is the planned QEV commerce extension: a marketplace and tooling layer for selling digital products as locked, verifiable, buyer-specific QEV assets.

This repository is intentionally starting from a clean foundation. The first objective is not to rush a UI. The first objective is to define the product boundary, security claims, data model, and build sequence tightly enough that an implementation agent can execute without inventing the wrong system.

## Core product thesis

Creators should be able to sell digital goods as encrypted proof assets.

A buyer should receive a unique unlock credential that can prove:

- which asset was purchased
- which version was purchased
- which license terms apply
- whether the locked asset has been altered
- whether the unlock credential was issued by the marketplace
- whether the credential is valid for that asset

My Digital does **not** claim to make piracy impossible. It is designed to reduce unauthorized access, strengthen proof of purchase, improve creator-side licensing, and support leak traceability where asset type permits fingerprinting.

## Working product loop

```text
CREATE -> LOCK -> LIST -> BUY -> LICENSE -> UNLOCK -> VERIFY -> TRACE
```

## Public positioning

> My Digital lets creators sell digital products as QEV-locked assets with automatic buyer-specific unlock licenses, tamper verification, and proof-of-purchase receipts.

## Repo status

Roadmap Stages 0–5 complete. The full CREATE → LOCK → LIST → BUY → LICENSE → UNLOCK → VERIFY loop runs locally four ways: `pnpm demo` (script, demo envelope), `pnpm demo:qev` (script on the real QEV Vault V2 envelope adapter — `BRY-NFET-SX-VAULT-V2` with Argon2id + XChaCha20-Poly1305, cross-implementation tested against the published qev CLI), `pnpm dev` (web app at `/sell`, `/listing/:id`, `/checkout/:id`, `/unlock`, `/verify`, `/creator`, state in browser localStorage), and `pnpm db:seed` + `pnpm db:verify` (SQLite persistence with committed migrations; records verify in a fresh process). SHA-256 hashing and Ed25519 issuer signatures are real everywhere; the web app and demo database intentionally keep the labeled demo envelope adapter until server-side key custody exists. Payments flow through a `PaymentAdapter` boundary with a mock provider — purchases start pending and licenses exist only after a paid confirmation event. Do not treat this repository as production software yet.

## Ownership / license status

No open-source license has been granted yet. Until a license is added, all rights are reserved by the repository owner.
