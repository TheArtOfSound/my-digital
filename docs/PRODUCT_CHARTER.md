# My Digital Product Charter

## 1. Mission

My Digital is a QEV-powered digital commerce layer for locked digital goods. It gives creators a way to package, sell, license, and verify digital products using encrypted asset capsules and buyer-specific unlock credentials.

The goal is not to build a generic marketplace first. The first goal is to build the commerce primitive:

1. creator uploads a file
2. system locks the file into a QEV-style asset capsule
3. creator publishes a listing
4. buyer purchases the asset
5. system issues a unique unlock license
6. buyer unlocks the product
7. creator and buyer can verify purchase, license, and asset integrity later

## 2. Product category

My Digital is not only a marketplace. It is a cryptographic commerce workflow.

It combines:

- digital downloads
- encrypted asset packaging
- buyer-specific unlock credentials
- license receipts
- tamper verification
- optional buyer-specific fingerprinting
- creator-side provenance records

## 3. Primary users

### Creators

Creators who sell files, templates, assets, or knowledge products.

Initial best-fit categories:

- beat packs
- sample packs
- ebooks
- paid PDFs
- Notion templates
- design packs
- AI prompt packs
- code templates
- research packets
- photography packs
- 3D assets

### Buyers

Buyers who want a simple unlock flow and a verifiable receipt proving they bought the product legitimately.

### Reviewers / technical evaluators

People evaluating whether the QEV locking, license, and verification model is credible.

## 4. Claims My Digital can make

My Digital can claim:

- digital products are encrypted before distribution
- each buyer receives a unique unlock credential
- licenses can be verified against asset identity
- asset tampering can be detected
- creator provenance can be recorded
- purchase receipts can be exported and verified
- leak tracing may be possible for supported asset types

## 5. Claims My Digital must not make

My Digital must not claim:

- piracy is impossible
- all leaks can be prevented
- screenshots or screen recordings can be stopped
- buyers cannot redistribute decrypted files
- QEV is a new cipher
- QEV replaces copyright registration
- QEV replaces legal enforcement
- QEV is enterprise DRM without third-party review

## 6. Trust posture

My Digital should be honest, sharp, and technically credible.

Preferred claim:

> My Digital reduces unauthorized access and strengthens creator proof through QEV-locked assets, buyer-specific unlock licenses, and tamper-verifiable receipts.

Rejected claim:

> My Digital stops piracy forever.

## 7. MVP definition

The MVP is not a full marketplace. The MVP is QEV Sell Lock.

A creator can:

1. upload a product file
2. set title, description, price, and license terms
3. generate a locked asset package
4. create a listing
5. simulate or process a purchase
6. issue a buyer-specific unlock license
7. verify that the license matches the asset
8. export a receipt

## 8. Non-negotiable implementation principles

- No vague crypto claims.
- No hidden plaintext storage without explicit development-only labeling.
- No fake verification UI.
- No placeholder security claims.
- No bloated marketplace before the lock/license/verify loop works.
- Every critical object must have a stable ID and hashable representation.
- Every verification result must explain what was checked and what was not checked.
- Every unlock flow must distinguish demo mode from production mode.

## 9. North-star lifecycle

```text
CREATE -> LOCK -> LIST -> BUY -> LICENSE -> UNLOCK -> VERIFY -> TRACE
```

This lifecycle is the spine of the product. Every feature should support one of these stages.
