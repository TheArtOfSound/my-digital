# My Digital Roadmap

## Principle

Build the smallest honest QEV commerce primitive first. Do not build a broad marketplace until the lock/license/verify loop is real.

## Stage 0 — Repo foundation

Status: in progress.

Required:

- product charter
- Fable 5 execution brief
- QEV upstream reference
- architecture doc
- threat model
- data model
- strict TypeScript workspace
- shared domain types
- envelope adapter boundary
- demo adapter clearly labeled as demo-only

Exit criteria:

- docs exist
- workspace installs
- packages typecheck/build

## Stage 1 — Local lifecycle demo

Goal: prove the product loop without real payments or production QEV crypto.

Required flow:

1. create creator
2. create buyer
3. create asset bytes
4. create asset manifest
5. lock asset using demo envelope adapter
6. create listing
7. simulate paid purchase
8. issue buyer-specific license
9. issue unlock code
10. verify license against asset
11. unlock demo payload
12. generate proof receipt
13. tamper with payload and show verification failure

Exit criteria:

- local script or web UI runs the full lifecycle
- verification results are structured
- demo-only warnings are visible
- tests cover pass/fail verification

## Stage 2 — Web shell

Goal: make the flow visible and usable.

Routes:

- `/` landing page
- `/sell` create demo asset/listing
- `/listing/:id` listing preview
- `/checkout/:id` mocked checkout
- `/unlock` unlock with code/license
- `/verify` verify package/license/receipt
- `/creator` creator dashboard

Exit criteria:

- web app runs locally
- no route is fake without labeling
- local state persists at least in memory or local storage
- user can complete demo lifecycle visually

## Stage 3 — Persistence

Goal: replace in-memory state with local/dev database.

Preferred:

- SQLite
- Drizzle or Prisma

Required tables:

- creators
- buyers
- assets
- asset_versions
- locked_assets
- listings
- purchases
- licenses
- unlock_codes
- proof_receipts
- fingerprints
- revocations

Exit criteria:

- lifecycle survives reload/restart
- migrations are committed
- seed/demo command exists

## Stage 4 — Payment abstraction

Goal: payment-confirmed license issuance.

Required:

- payment adapter interface
- mocked payment adapter
- future Stripe adapter boundary
- license issuance only after paid confirmation
- unpaid unlock attempt rejection

Exit criteria:

- tests prove unpaid purchase does not issue valid license
- mocked paid event issues valid license

## Stage 5 — Real QEV integration

Goal: replace demo envelope behavior with QEV Vault V2 integration.

Required:

- reference `TheArtOfSound/qev-desktop`
- use `BRY-NFET-SX-VAULT-V2` semantics
- preserve Argon2id/XChaCha20-Poly1305 model
- preserve deterministic associated-data binding concept
- return structured verification results

Exit criteria:

- demo adapter still available for tests
- production adapter clearly separated
- docs explain what is production crypto vs lifecycle demo

## Stage 6 — Fingerprint/trace layer

Goal: begin leak traceability honestly.

Start simple:

- embed license manifest inside package
- buyer-specific receipt file
- visible watermark for supported display assets

Do not claim robust forensic watermarking until implemented and tested.

Exit criteria:

- trace checks return evidence level
- unsupported file types report unsupported rather than fake confidence

## Stage 7 — Creator marketplace beta

Goal: actual seller/buyer product.

Required:

- creator onboarding
- listing pages
- paid checkout
- buyer library
- license download
- receipt verification
- revocation view
- dispute/support workflow

Exit criteria:

- first real creator can sell one locked product
- first buyer can purchase/unlock/verify
- support/recovery docs exist

## Deferred explicitly

Do not add yet:

- social feed
- NFTs
- tokens
- Solana
- AI content generation
- complex DRM
- creator analytics dashboard
- affiliate marketplace
- mobile app
- enterprise SSO

These can exist later only after the primitive is stable.
