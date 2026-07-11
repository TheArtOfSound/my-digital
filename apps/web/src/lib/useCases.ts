/**
 * The "what can you sell here" showcase. Distilled from docs/PRODUCT_IDEAS.md:
 * these are use cases we present to visitors so an empty or young storefront
 * still communicates what My Digital is for. They are content, not features —
 * every one of them works today with the existing sell flow (a file, a price,
 * license terms, verified delivery).
 */

export interface UseCase {
  title: string;
  blurb: string;
}

export const USE_CASES: UseCase[] = [
  {
    title: "AI prompt packs",
    blurb: "Sell tested prompts without them leaking free — each buyer gets their own sealed copy."
  },
  {
    title: "Research & reports",
    blurb: "Paid PDFs with a receipt that proves who bought — useful when your work gets forwarded."
  },
  {
    title: "Code & templates",
    blurb: "Boilerplates and starter kits with license terms buyers can actually check."
  },
  {
    title: "Sample packs & loops",
    blurb: "Ship sounds with clear usage rights — personal, commercial, or per-seat."
  },
  {
    title: "Notion & workspace templates",
    blurb: "Sell your setup once; every purchase issues its own verified download."
  },
  {
    title: "Design assets",
    blurb: "Icon sets, UI kits, and libraries with attribution and resale rules in writing."
  },
  {
    title: "E-books & guides",
    blurb: "Direct sales with instant delivery — no storefront cut of your pricing."
  },
  {
    title: "Spreadsheet models",
    blurb: "Financial models and calculators where 'who is licensed' actually matters."
  },
  {
    title: "Presets & LUTs",
    blurb: "Lightroom presets and video LUTs delivered sealed, not passed around."
  },
  {
    title: "Fonts & type",
    blurb: "Seat-counted licenses are built into the license record, not the honor system."
  },
  {
    title: "Datasets",
    blurb: "Licensed data with provenance: a hash of exactly what was delivered, to whom."
  },
  {
    title: "Client deliverables",
    blurb: "Hand off final files with proof of delivery your client can verify independently."
  }
];

/** One-line answers to "is this for me?" */
export const AUDIENCES = [
  {
    who: "For sellers",
    points: [
      "Money goes to your own Stripe account — we never hold your earnings",
      "Every sale issues a license record you can point to in disputes",
      "Edit, pause, or delete listings anytime from your dashboard"
    ]
  },
  {
    who: "For buyers",
    points: [
      "Instant download, unlocked privately in your browser",
      "A receipt that verifies at a public URL — proof you actually bought it",
      "Your license terms in plain writing, not fine print"
    ]
  }
] as const;
