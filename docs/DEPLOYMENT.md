# Deployment — mydigital.imagineqira.com

## LIVE NOW (2026-06-12)

The full stack is deployed and verified on Cloudflare:

- **URL:** https://my-digital.bryanleonard237.workers.dev
- **Worker:** `my-digital` (Cloudflare account `eaa59df7…`), Hono app + SPA assets in one Worker.
- **Database:** D1 `my-digital` (`97051f63-cb33-4026-8eb5-1a36257164a2`), schema applied from `apps/worker/d1-migrations/0001_init.sql`.
- **Crypto on the edge:** the QEV Vault V2 adapter runs on the pure-JS `@noble` backend (Argon2id + XChaCha20-Poly1305) at the `edge` preset — libsodium's WASM can't init on Workers. Byte-compatibility with libsodium and the upstream qev CLI is enforced by the envelope test suite, and was reproven live: a vault locked on the Worker, stored in D1, downloaded, and decrypted by the upstream `@bryan237l/qev-cli` with the buyer's code recovered the exact plaintext.
- **Secrets set (never in the repo):** `MYDIGITAL_MASTER_KEY_B64` (32-byte master key sealing custody + issuer secrets) and `MYDIGITAL_ADMIN_TOKEN` (gates `/api/admin/reset`).
- **Payments:** `mock` (var `MYDIGITAL_PAYMENTS`). Flip to `stripe` by setting that var plus the `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` secrets.
- **Verified live:** health, creator → edge lock → listing → checkout → buyer vault download → local decrypt, trace (exact-vault-match), SPA serving, `/verify/:receiptId` deep link (SPA fallback 200), admin reset gated (401). Test data was wiped afterward; the issuer keypair is preserved.

### Redeploy / operate

```bash
pnpm --filter @my-digital/web build          # refresh static assets
cd apps/worker && wrangler deploy            # deploy Worker + assets
wrangler d1 migrations apply my-digital --remote   # apply new migrations
wrangler tail my-digital                     # live logs
wrangler secret put MYDIGITAL_ADMIN_TOKEN    # rotate the admin token
```

When new store migrations are generated (`pnpm --filter @my-digital/store generate`), regenerate the D1 migration: concatenate `packages/store/drizzle/*.sql` (in order) into a new `apps/worker/d1-migrations/000N_*.sql` and `wrangler d1 migrations apply my-digital --remote`.

## Custom domain: mydigital.imagineqira.com

Not yet attached. `imagineqira.com` is on GoDaddy nameservers (`ns53/54.domaincontrol.com`), not Cloudflare, and a Worker custom domain requires the zone on Cloudflare. Steps (the nameserver change is owner-only and affects the existing imagineqira.com site + email, so migrate records first):

1. Add `imagineqira.com` as a zone in the Cloudflare dashboard (or `POST /zones`). Let Cloudflare scan existing DNS, then **verify every record imported** — especially the apex `A 54.167.112.215`, `www`, and all **MX/TXT (email)** records. A missed MX record means email goes down at cutover.
2. At GoDaddy, change the nameservers to the two Cloudflare nameservers shown for the zone. Wait for activation.
3. Uncomment the `routes` block in `apps/worker/wrangler.jsonc` (custom_domain `mydigital.imagineqira.com`) and `wrangler deploy`. Cloudflare issues the TLS cert and routes the hostname to the Worker automatically.
4. The receipt `verificationUrl` is already `https://mydigital.imagineqira.com/verify/<id>`, so receipts verify at their printed URL once the domain is attached — no data migration.

`market.imagineqira.com` stays reserved per `docs/POSITIONING.md`.

---

# Original plan — mydigital.imagineqira.com

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

Live-API validation (2026-06-12, owner-authorized, against the Trend account `acct_1TdqpyGz3eX0vCtE`): the adapter authenticated against live Stripe and created real Checkout Sessions (params accepted); `complete` correctly refused an open session, and after expiring the session at Stripe it settled the purchase as failed; a correctly HMAC-signed webhook was verified by the real Stripe SDK (a forged signature was rejected by the SDK itself) and fulfillment then produced the license, one-time code, receipt, and buyer vault. Both live sessions were expired afterward; zero charges. The ONLY unexercised step in the whole system is a human completing the hosted page with a real card — that single purchase remains the final go-live gate, ideally on a My Digital-branded Stripe account rather than Trend.

## 5. Hardening before public beta

- Buyer accounts/auth (the email-hash library lookup is a dev convenience, not auth).
- ~~Remove or auth-gate `POST /api/admin/reset`~~ — done: set `MYDIGITAL_ADMIN_TOKEN` and the endpoint requires the bearer token (verified 401 without it).
- Rate limiting on checkout/trace; request size limits are already in place.
- HTTPS only; HSTS at the proxy.
- Log hygiene: the server logs no secrets today — keep it that way under any added logging.
- Legal pages and the support/recovery docs Stage 7 requires.

## 6. DNS

Per `docs/POSITIONING.md` §8: `mydigital.imagineqira.com` CNAME/A to the host; `market.imagineqira.com` stays reserved. The verification URL baked into receipts already points at the production domain, so receipts minted in production verify at their printed URL with no migration.
