# Support and Recovery

What can and cannot be done when something goes wrong. The honest answers below are design properties, not policy choices — say them plainly in support replies.

## Buyer: "I lost my unlock code"

The code cannot be recovered. Only its SHA-256 hash is stored, and the buyer vault is encrypted under a key derived from the code. Nobody — including the platform — can decrypt the vault without it.

Remedy: the creator (or operator) can comp a replacement: run a new fulfillment for the same listing and buyer (new license, new code, new vault) and optionally revoke the lost license. The original purchase and receipt remain valid proof of the purchase itself.

## Buyer: "I lost the vault file"

Recoverable. The encrypted vault is stored server-side; re-download it from the buyer library (`/library`) or `GET /api/licenses/<id>/vault`. Possessing the vault without the code exposes nothing.

## Buyer: "My license shows REVOKED"

Revocation is a creator/operator action and is recorded with a signed revocation record (reason included). The license's issuance signature still verifies — the license was genuinely issued, then revoked. Disputes are between buyer and creator; the records show exactly what happened and when.

## Buyer: "Does the platform see what I unlocked?"

No. Unlock runs locally (browser or CLI). The server never receives the code or the plaintext after purchase. Consequence: the platform also cannot prove whether a buyer ever unlocked — only that the vault and code were issued.

## Creator: "I think my product leaked"

Use `/trace`. Outcomes and their honest meaning:

- **Exact vault match** — that specific buyer's encrypted copy circulated. It identifies whose copy it is, not who shared it. Reasonable next steps: contact the buyer, revoke the license, keep the trace result and fingerprint record as evidence.
- **Content match, no attribution** — a decrypted copy leaked; plaintext carries no buyer marking, so no one can be identified. Do not accuse anyone based on this result.
- **Unattributed vault / no evidence** — nothing actionable.

## Operator: lost database vs lost master key

See `docs/DEPLOYMENT.md` §3. Short version: lost database → restore backup. Lost master key → existing buyers keep unlocking with their codes, but custody secrets and the issuer key are gone: no new fulfillment for existing listings, no new signatures from the same issuer. Back the key up separately from the database.

## Operator: payments stuck "pending"

A pending purchase means no paid confirmation arrived (abandoned checkout or provider delay). `POST /api/checkout/complete` with the purchase id retries confirmation; a declined/expired session settles it as failed. Pending purchases never produce licenses, codes, vaults, or receipts.

## What support must never claim

Per `docs/THREAT_MODEL.md`: no recovery of unlock codes, no piracy-proofing, no attribution from plaintext leaks, no claims about what happens on buyer devices after unlock.
