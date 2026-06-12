# Deployment Plan — mydigital.imagineqira.com

Target domain per `docs/POSITIONING.md`: the app at `mydigital.imagineqira.com`, receipts verifying at `https://mydigital.imagineqira.com/verify/<receiptId>` (the web route exists). This document is the concrete plan; nothing here is deployed yet.

## 1. Shape

Two deployables, same origin:

- **Web**: static Vite build (`pnpm --filter @my-digital/web build` → `apps/web/dist`). Any static host/CDN.
- **API server**: Node 22 process (`apps/server`). Uses better-sqlite3 and a key file, so it needs a host with a **persistent disk**: Fly.io, Railway, or a small VPS (Hetzner/DO). It does NOT fit serverless/edge runtimes unless the store is swapped to D1/libsql behind the same `MarketplaceStore` interface.

**Single-process option (simplest):** the API server serves `apps/web/dist` itself when the build exists — static files, SPA fallback for `/verify/<receiptId>` deep links, and `/api` from one process on one port. `pnpm --filter @my-digital/web build`, then run the server; the startup banner confirms "single-process mode". A reverse proxy is then only for TLS.

Serve both behind one reverse proxy so `/api` is same-origin (no CORS). Caddy example:

```text
mydigital.imagineqira.com {
  handle /api/* {
    reverse_proxy localhost:8787
  }
  handle {
    root * /srv/my-digital/web-dist
    try_files {path} /index.html
    file_server
  }
}
```

The SPA fallback (`try_files … /index.html`) is required for `/verify/<receiptId>` deep links.

## 2. Environment

| Variable | Purpose | Production note |
|---|---|---|
| `PORT` | API port (default 8787) | — |
| `MYDIGITAL_DB` | SQLite file path | Put on the persistent volume |
| `MYDIGITAL_MASTER_KEY_B64` | 32-byte master key, base64 | Inject from a secret manager; do NOT rely on the dev key file |
| `MYDIGITAL_KDF_PRESET` | `quick`/`strong`/`vault` | `strong` (default) |
| `MYDIGITAL_PAYMENTS` | `mock` (default) / `stripe` | stripe mode requires the keys below |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe mode credentials | test keys first; live keys only at go-live |
| `MYDIGITAL_PUBLIC_URL` | public origin for Stripe redirect URLs | e.g. `https://mydigital.imagineqira.com` |
| `MYDIGITAL_ADMIN_TOKEN` | gates `POST /api/admin/reset` | REQUIRED in production |

## 3. Master key discipline

The master key seals custody passphrases and the issuer private key. Generate once (`openssl rand -base64 32`), store in the host's secret manager, and back it up separately from the database.

- **Lose the database, keep the key**: restore from backup.
- **Lose the key, keep the database**: sealed custody secrets and the issuer private key are unrecoverable. Existing buyer vaults still unlock with their codes (custody is not needed for buyer decryption), but no new vaults can be minted for existing listings and no new licenses/receipts can be signed by the same issuer. Treat the key like the business.

Backups: nightly copy of the SQLite file (it WAL-checkpoints cleanly via `sqlite3 .backup`) plus the key in a separate vault. Do a restore drill before launch.

## 4. Stripe go-live checklist

Status 2026-06-12: items 1 and 2 are BUILT and tested (fake client + service tests); item 3's polling path is built. What remains is purely key-dependent.

1. ~~Split the server checkout into `begin`/`complete`~~ — done: `POST /api/checkout/begin` (pending purchase + persisted session + `checkoutUrl`) and `POST /api/checkout/complete` (by purchase id or provider reference; restart-safe via `restoreSession`). The mock path keeps the single-call `POST /api/checkout`.
2. ~~Webhook endpoint~~ — done: `POST /api/webhooks/stripe` verifies the signature and applies the confirmation (purchase marked paid/failed; fulfillment still happens on `complete`, so the unlock code goes straight to the buyer's browser and is never stored).
3. Webhook-driven fulfillment with sealed one-time code delivery: deferred together with buyer auth (an unauthenticated retrieval endpoint would hand the code to anyone). The polling flow needs no stored codes.
4. Enable with env: `MYDIGITAL_PAYMENTS=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `MYDIGITAL_PUBLIC_URL`. Then: test-mode purchase end to end (web flow needs the small redirect UI: send the buyer to `session.checkoutUrl`, then call `complete` from the `/checkout/done` return page), then ONE live-mode purchase before announcing.

Key note (2026-06-12): the only Stripe keys present on the dev machine are LIVE keys for unrelated ventures. My Digital needs its own Stripe account's TEST keys (`sk_test_…`) for step 4 — do not point this product at another business's live account.

## 5. Hardening before public beta

- Buyer accounts/auth (the email-hash library lookup is a dev convenience, not auth).
- ~~Remove or auth-gate `POST /api/admin/reset`~~ — done: set `MYDIGITAL_ADMIN_TOKEN` and the endpoint requires the bearer token (verified 401 without it).
- Rate limiting on checkout/trace; request size limits are already in place.
- HTTPS only; HSTS at the proxy.
- Log hygiene: the server logs no secrets today — keep it that way under any added logging.
- Legal pages and the support/recovery docs Stage 7 requires.

## 6. DNS

Per `docs/POSITIONING.md` §8: `mydigital.imagineqira.com` CNAME/A to the host; `market.imagineqira.com` stays reserved. The verification URL baked into receipts already points at the production domain, so receipts minted in production verify at their printed URL with no migration.
