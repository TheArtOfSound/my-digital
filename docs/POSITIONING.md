# My Digital Positioning and Competitive Landscape

Recorded 2026-06-10. External competitor claims should be re-verified before they are used in public copy.

## 1. The lane

My Digital does not compete as "another way to sell a file."

> Gumroad sells downloads. SendOwl secures delivery. Locklizard protects PDFs. Keygen licenses software. My Digital sells QEV-locked digital assets with buyer-specific unlock licenses and tamper-verifiable proof receipts.

The product is the lifecycle, not the storefront:

```text
normal file sale:
upload file -> pay -> download link

My Digital:
create asset -> QEV lock -> list -> buy -> issue license -> unlock -> verify -> trace
```

## 2. Competitive categories

### Creator storefronts — threat: high

Gumroad, Payhip, Sellfy, Podia, Lemon Squeezy (Stripe-owned since July 2024).

They own the default mental model for "sell a digital file online." Gumroad markets license keys and lightweight DRM. Sellfy markets PDF stamping and limited downloads.

They sell and deliver files. They do not produce locked proof assets with verifiable buyer-specific licenses.

### Secure digital delivery — threat: high

SendOwl, Shopify Digital Downloads and its app ecosystem.

SendOwl is the closest practical overlap: PDF stamping, document locking, expiring links, IP blocking, download limits, license key delivery.

Delivery controls are not asset identity. None of these produce a portable, tamper-verifiable package whose license and receipt can be verified independently of the platform.

### Document DRM — threat: medium-high for PDF-centric buyers

Locklizard, Digify, Vitrium.

Mature, enterprise-priced, document-centric. Do not fight them on DRM hardness.

### Software licensing — threat: medium

Keygen, Cryptolens, Paddle and Lemon Squeezy key issuance, Polar.

They license application binaries and SaaS seats. My Digital licenses any digital asset package.

### Asset marketplaces — threat: high only if we build a marketplace first

Envato, Creative Market, itch.io, BeatStars, Airbit, Etsy digital, Unity Asset Store, PromptBase, Whop, and Fab — Epic's consolidation of the Unreal Marketplace, Sketchfab store, Quixel, and ArtStation Marketplace (since late 2024).

Marketplaces need both sides at once. The primitive needs one creator and one buyer. Build the primitive first.

### Provenance standards — not competitors; expectation-setters

C2PA / Content Credentials, Content Authenticity Initiative, W3C Verifiable Credentials 2.0 (W3C Recommendation since 2025-05-15).

Track them. Long-term, receipts and licenses should be mappable to verifiable-credential shapes so My Digital proofs do not look like a proprietary island. Do not build on these standards yet.

## 3. Most dangerous direct competitors

1. **SendOwl** — closest feature overlap on secured delivery.
2. **Gumroad** — owns creator mindshare for "sell a file."
3. **Whop** — fast-moving digital goods marketplace with license gating and large distribution. Missing from earlier analysis; belongs on this list.
4. **Lemon Squeezy (Stripe)** — removes tax, payment, license-key, and delivery pain for software sellers.
5. **Locklizard** — wins any buyer whose problem is strictly "protect this PDF."

Polar (open-source merchant of record with license keys) is the same threat shape as Lemon Squeezy for developer products and is growing in that audience.

## 4. Where My Digital does not compete

- Not the fastest checkout. That is Gumroad.
- Not the biggest catalog. That is Envato and Fab.
- Not general ecommerce. That is Shopify.
- Not enterprise PDF DRM. That is Locklizard.
- Not a software license API. That is Keygen.
- Not merchant-of-record tax machinery. Integrate or defer; never build first.

## 5. The wedge

> The first digital commerce tool where every sale produces a QEV-locked asset, a buyer-specific unlock license, and a tamper-verifiable proof receipt.

What is actually defensible:

- The lock alone is table stakes. Once a buyer decrypts, the file can leak; the threat model already says so. Any storefront could ship "encrypted downloads" in a quarter.
- The durable value is the proof rails: stable asset identity, license-to-asset binding, receipt verification, creator provenance, structured trace evidence.
- Honest claims are part of the moat. Storefronts optimize checkout volume and overclaim casually; a verification product that states what was checked and what was not checked earns trust they cannot copy quickly.

## 6. First target niches

In order:

1. AI prompt packs / workflow packs — high theft anxiety, lightweight files.
2. Paid research PDFs / private reports — proof, tamper evidence, and buyer identity matter.
3. Code templates / starter kits — license receipts make sense; GitHub-adjacent verification later.
4. Sample packs / beat packs — the market already thinks in licenses.
5. Notion templates, design templates, digital workbooks.

## 7. Objections to prepare for

### "Is this NFTs?"

No. No blockchain, no tokens, no wallets, no resale speculation. Proofs are self-contained signed artifacts that verify offline. The execution brief already prohibits blockchain features.

### "Is this DRM?"

No. DRM promises prevention and routinely overclaims. My Digital claims controlled access before purchase, proof of purchase, tamper detection, license verification, and trace evidence where supported. The threat model's forbidden-claims list is the marketing boundary.

### "Buyers hate locked files."

This is the biggest product risk, and it is UX, not cryptography. Unlock must feel like a download with a receipt, not like enterprise DRM: one credential, one step, verification optional and offline-capable. If unlock friction exceeds a normal download by more than a few seconds, buyers will punish it.

## 8. Domain decision

Proposed, pending owner confirmation:

- Product app: `mydigital.imagineqira.com`
- Reserved for a possible future marketplace phase: `market.imagineqira.com`
- Rejected for hosting the app: `imagineqira.com/mydigital`. A path couples the app to the parent site's deploys, cookies, CSP, and routing. Acceptable only as a redirect to the subdomain.

Receipt URL rule: the `verificationUrl` embedded in proof receipts is a long-lived commitment — receipts outlive marketing sites. Use `https://mydigital.imagineqira.com/verify/<receiptId>` from the first receipt onward, and keep receipts verifiable offline so proofs do not depend on the domain staying alive. The URL is convenience; the signed artifact is the trust root.

## 9. Sources

- Gumroad features: https://gumroad.com/features
- Payhip features: https://payhip.com/features
- Sellfy features: https://sellfy.com/features/
- Podia features: https://www.podia.com/features
- Stripe acquires Lemon Squeezy: https://www.lemonsqueezy.com/blog/stripe-acquires-lemon-squeezy
- SendOwl features: https://www.sendowl.com/features
- Shopify Digital Downloads: https://apps.shopify.com/digital-downloads
- Locklizard document security: https://www.locklizard.com/document-security/
- Keygen: https://keygen.sh/
- Cryptolens: https://cryptolens.io/
- Envato Elements: https://elements.envato.com/
- Creative Market: https://creativemarket.com/
- itch.io: https://itch.io/
- C2PA: https://c2pa.org/
- Content Authenticity Initiative: https://contentauthenticity.org/
- W3C Verifiable Credentials 2.0: https://www.w3.org/TR/vc-data-model-2.0/
