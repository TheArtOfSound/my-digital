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

Roadmap Stages 0–6 complete; Stage 7 (marketplace beta) in progress with the server backbone done. The whole lifecycle spine is implemented: CREATE → LOCK → LIST → BUY → LICENSE → UNLOCK → VERIFY → TRACE, with `/trace` attributing leaked buyer vaults by exact hash match (every vault is unique with its license sealed inside) and reporting plaintext leaks as honestly unattributable. The real product loop runs with `pnpm server` + `pnpm dev`: the API server (`apps/server`, Hono + SQLite) locks assets into real QEV Vault V2 envelopes (`BRY-NFET-SX-VAULT-V2`, Argon2id + XChaCha20-Poly1305, cross-implementation tested against the published qev CLI), seals custody and issuer secrets under a server master key, and mints a buyer-specific encrypted vault at each paid checkout. Unlock is local-first: the browser downloads the vault and decrypts it client-side — unlock codes and plaintext never reach the server after purchase, and downloaded vaults also open offline. Payments flow through a `PaymentAdapter` boundary with a mock provider — purchases start pending and licenses exist only after a paid confirmation event. Buyers have a library (`/library`, email hashed in-browser) and receipts verify at their printed URL (`/verify/<receiptId>`). `@my-digital/payments-stripe` implements the payment contract (unit-tested; live Stripe validation pending — see `docs/DEPLOYMENT.md` for the go-live checklist and the `mydigital.imagineqira.com` deployment plan). Additional runners: `pnpm demo` / `pnpm demo:qev` (scripted lifecycle on the demo / real envelope adapter) and `pnpm db:seed` + `pnpm db:verify` (fresh-process verification of persisted records). Do not treat this repository as production software yet: payments are mocked, there is no buyer auth, and the master key file is a local stand-in for a KMS.

## Ownership / license status

No open-source license has been granted yet. Until a license is added, all rights are reserved by the repository owner.
