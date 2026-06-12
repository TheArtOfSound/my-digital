# Deployment Plan — mydigital.imagineqira.com

Target domain per `docs/POSITIONING.md`: the app at `mydigital.imagineqira.com`, receipts verifying at `https://mydigital.imagineqira.com/verify/<receiptId>` (the web route exists). This document is the concrete plan; nothing here is deployed yet.

## 1. Shape

Two deployables, same origin:

- **Web**: static Vite build (`pnpm --filter @my-digital/web build` → `apps/web/dist`). Any static host/CDN.
- **API server**: Node 22 process (`apps/server`). Uses better-sqlite3 and a key file, so it needs a host with a **persistent disk**: Fly.io, Railway, or a small VPS (Hetzner/DO). It does NOT fit serverless/edge runtimes unless the store is swapped to D1/libsql behind the same `MarketplaceStore` interface.

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
| `MYDIGITAL_PAYMENTS` | future: `mock`/`stripe` | wiring lands with the Stripe go-live work |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | future Stripe mode | live keys only at go-live |

## 3. Master key discipline

The master key seals custody passphrases and the issuer private key. Generate once (`openssl rand -base64 32`), store in the host's secret manager, and back it up separately from the database.

- **Lose the database, keep the key**: restore from backup.
- **Lose the key, keep the database**: sealed custody secrets and the issuer private key are unrecoverable. Existing buyer vaults still unlock with their codes (custody is not needed for buyer decryption), but no new vaults can be minted for existing listings and no new licenses/receipts can be signed by the same issuer. Treat the key like the business.

Backups: nightly copy of the SQLite file (it WAL-checkpoints cleanly via `sqlite3 .backup`) plus the key in a separate vault. Do a restore drill before launch.

## 4. Stripe go-live checklist

`@my-digital/payments-stripe` exists behind the `PaymentAdapter` contract and is unit-tested against an injected fake client. It has NOT been exercised against live Stripe. Before enabling `MYDIGITAL_PAYMENTS=stripe`:

1. Split the server checkout into `begin` (create pending purchase + hosted session, return `checkoutUrl`) and `complete` (poll `confirmPayment` when the buyer returns via `success_url`). The mock path keeps the current single-call behavior.
2. Add `POST /api/webhooks/stripe` using `StripePaymentAdapter.confirmFromWebhook` (raw body + `stripe-signature` header). Prefer webhook fulfillment; events are at-least-once and the adapter is idempotent.
3. Decide one-time code delivery for webhook fulfillment: seal the raw unlock code under the master key until the buyer's first authenticated retrieval, then delete. (With the polling flow the code returns directly to the buyer's browser on `complete`, and nothing needs storing.)
4. Test-mode purchase end to end, then ONE live-mode purchase with a real card before announcing.

## 5. Hardening before public beta

- Buyer accounts/auth (the email-hash library lookup is a dev convenience, not auth).
- Remove or auth-gate `POST /api/admin/reset`.
- Rate limiting on checkout/trace; request size limits are already in place.
- HTTPS only; HSTS at the proxy.
- Log hygiene: the server logs no secrets today — keep it that way under any added logging.
- Legal pages and the support/recovery docs Stage 7 requires.

## 6. DNS

Per `docs/POSITIONING.md` §8: `mydigital.imagineqira.com` CNAME/A to the host; `market.imagineqira.com` stays reserved. The verification URL baked into receipts already points at the production domain, so receipts minted in production verify at their printed URL with no migration.
