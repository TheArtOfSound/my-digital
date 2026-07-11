# Product ideas backlog

Brainstorm of things that *could* matter for My Digital. Nothing here is a
commitment; nothing here is implemented just because it is listed. The
homepage "what you can sell here" showcase is distilled from the USE CASES
section. Honest-claims doctrine applies to every line: we never promise
"piracy-proof", and every trust feature must state what it checks.

## Use cases — what people could sell here (fuels the homepage showcase)

1. AI prompt packs and system-prompt libraries
2. Research reports and paid PDFs (analysts, indie researchers)
3. Code templates, boilerplates, starter kits
4. Sample packs, loops, and one-shots for producers
5. Notion/Obsidian templates and personal-OS setups
6. Design assets: icon sets, UI kits, Figma libraries
7. Fonts and type families (per-seat licensing fits naturally)
8. E-books, guides, and courses-as-files
9. Spreadsheet models (financial models, calculators, trackers)
10. Photography packs and Lightroom presets
11. 3D assets, textures, and game-ready models
12. Datasets (clean, licensed, with provenance)
13. Newsletters' paid archives as sealed bundles
14. Academic notes, exam prep sets, problem banks
15. Sheet music and MIDI packs
16. Video LUTs and editing presets
17. Plugin/theme licenses for indie software
18. Recipes/meal plans and coaching program PDFs
19. Legal/HR template bundles (contracts, policies)
20. Trading strategies / indicators (high-fraud niche — needs care)
21. Architecture/CAD blocks and details
22. Embroidery/cutting files (SVG/DXF crafts market)
23. Language-learning decks (Anki etc.)
24. Wallpaper/art packs with per-buyer watermarking later
25. Client handoff: agencies delivering final files with proof of delivery

## Buyer-facing trust ideas

26. "Verify before you trust" public receipt lookup (exists — keep prominent)
27. Receipt QR code on the paid page for phone verification
28. Publicly auditable seller stats (sales count, refund rate) once real
29. Buyer-visible license summary before purchase (exists as terms table)
30. Plain-language license diffs ("what you can/can't do") per listing
31. Purchase gifting (license issued to a different email)
32. Refund flow with license revocation built in
33. Delivery SLA badge ("instant delivery, verified")
34. Content hash shown pre-purchase so buyers can compare post-download
35. Third-party verifier embed (verify widget on seller's own site)

## Seller tools

36. Sales dashboard with payout status per sale (partially exists)
37. Coupons / discount codes
38. Pay-what-you-want pricing with floor
39. Versioned products: push v2, buyers keep access to both
40. Update notifications to buyers (email opt-in)
41. Draft listings and scheduled launches
42. Bundles (N products, one checkout)
43. Tiered licenses (personal / commercial / team) per listing
44. Per-seat licensing with seat counts (schema already supports seatCount)
45. Preview files (watermarked sample, first chapter, low-res pack)
46. Listing analytics: views, conversion, referrer
47. Custom storefront page per seller (bio, links, all listings)
48. Custom domain for seller storefronts
49. Embeddable buy button for sellers' own sites
50. CSV export of sales
51. Stripe tax / VAT handling guidance
52. Team accounts (multiple users, one seller profile)
53. API keys for sellers (create listings programmatically)
54. Webhooks for sellers (sale.completed → their systems)
55. Migration importer from Gumroad/Lemon Squeezy CSVs

## Licensing & proof (the moat)

56. License upgrade purchases (personal → commercial delta price)
57. License transfer with provenance chain (resale where allowed)
58. Organization licenses bound to a company name
59. Expiring licenses / subscription-style relock (careful UX)
60. Offline verifier CLI parity with the site verifier (qev CLI exists)
61. Signed "certificate of authenticity" PDF per purchase
62. Public proof pages sellers can link in portfolios ("X sold with proof")
63. Watermarking pipeline for PDFs/images (per-buyer, traceable)
64. Audio watermarking for sample packs (harder; research)
65. License revocation transparency log (public, append-only)
66. Dispute flow: buyer proves purchase via receipt, not screenshots

## Discovery & marketplace (later phase)

67. Categories + search (needs > ~20 listings to matter)
68. Curated collections ("Best prompt packs this month")
69. Seller verification tiers surfaced in search ranking
70. Reviews — only from verified purchases (receipt-gated)
71. Wishlist / follow a seller
72. New-release feed and RSS
73. Cross-promotion: "buyers of X also bought"
74. Affiliate links with tracked receipts
75. Featured slots (paid placement, clearly labeled)

## Payments & payouts

76. Multi-currency price display
77. Regional pricing (PPP)
78. Invoices for business buyers (Stripe invoicing)
79. Payout dashboard deep-link to Stripe Express (exists partially)
80. Split payouts (collaborators share a listing's revenue)
81. Crypto payments — explicitly out of scope per hard rules
82. Subscriptions for evolving products (see 59)
83. Free products (0-price) as lead magnets with receipts

## Platform & ops

84. Email receipts (transactional email; currently on-site only)
85. Magic-link login as an alternative to passwords
86. 2FA for seller accounts
87. Password reset flow (needs transactional email first)
88. Account deletion / data export (GDPR hygiene)
89. Rate limiting on auth + checkout endpoints
90. Abuse reporting on listings
91. DMCA process page and agent registration
92. Content scanning for malware on upload
93. Larger files via R2 + streaming encryption (current 1 MiB cap)
94. Chunked uploads with resume
95. CDN-served encrypted payloads (R2 public bucket, keys stay server-side)
96. Observability: structured logs, error tracking, uptime page (status page exists)
97. Backups: scheduled D1 export + restore runbook
98. Staging environment with mock payments
99. E2E test suite against preview deploys
100. Load testing checkout under concurrency

## Growth & content

101. SEO landing pages per use case ("Sell prompt packs with proof")
102. Comparison pages (vs Gumroad, vs Lemon Squeezy) — honest, factual
103. Founder changelog / build-in-public feed
104. Docs: seller handbook ("how to price digital products")
105. Docs: buyer guide ("what your receipt proves")
106. Case studies once first sellers exist
107. Launch calendar tie-ins (Product Hunt done; Peerlist scheduled)
108. Referral program with tracked receipts
109. Newsletter with sealed-archive perk (dogfooding #13)
110. Open-source the verifier (trust through inspectability)

## UX polish

111. Dark mode (respect prefers-color-scheme, keep b/w discipline)
112. Keyboard-first checkout (tab order, enter-to-pay)
113. Buyer library device sync (accounts exist; needs email link-up UX)
114. Drag-and-drop upload with progress (exists basic input)
115. Inline price suggestions ("similar items sell for…") — later, needs data
116. Empty states that teach (every page)
117. Loading skeletons instead of spinners
118. Print-friendly receipts
119. Copy-to-clipboard everywhere hashes appear (exists in places)
120. Localization (start with ES/PT/DE)

## Risk register (things that could matter by hurting)

121. Fraud sellers listing stolen content → verification tiers, DMCA, refunds
122. Chargeback abuse → Stripe Radar, receipt evidence pack
123. Malware distribution → scanning (#92), report flow (#90)
124. Key loss → master-key runbook (documented), KMS migration later
125. Stripe account risk → keep platform fees clean, clear ToS
126. Overpromising security → honest-claims doctrine enforced in copy review
127. Empty-marketplace cold start → use-case marketing (#101), seed sellers
128. Regulatory (EU DSA/consumer law) → ToS, withdrawal-right handling for digital goods
129. Accessibility debt → audit pass (contrast is strong; add focus states, ARIA)
130. Single-founder bus factor → runbooks in /docs (deployment doc exists)

## Wilder later-stage ideas

131. Escrowed commissions (pay on delivery-with-proof for custom work)
132. Ticketed content drops (limited editions with numbered receipts)
133. Proof-of-prior-art registry (timestamped hashes for creators)
134. Team libraries (company buys once, seats verify individually)
135. Marketplace API for third-party storefronts on the proof layer
136. White-label "proof of purchase" SDK for other platforms
137. Physical-goods hybrid (QR on print = digital twin receipt)
138. Creator coalitions (bundle across sellers, split payouts)
139. Grant/press kit: "verifiable digital ownership without blockchain"
140. Archive mode: seller retires, receipts stay verifiable forever (design principle already)
