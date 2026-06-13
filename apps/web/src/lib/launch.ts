// Shared launch content: copy blocks, founder tiers, comparison rows, and
// sample (illustrative) records used by proof previews. Centralized here so the
// product's claims and positioning live in one typed place (per the launch brief)
// rather than scattered across components.

export const LAUNCH_DATE = "July 1, 2026";

/** Reward-based crowdfunding link (Stripe). Empty string => not yet wired. */
export const FUNDRAISING_URL = "https://buy.stripe.com/fZu8wP890dge5WJ9a77kc00";

export type PaymentMode = "mock" | "stripe" | "indiegogo" | "disabled";

export function paymentModeLabel(provider: string): string {
  switch (provider) {
    case "stripe":
      return "Live — Stripe hosted checkout";
    case "indiegogo":
      return "Live — Indiegogo campaign";
    case "disabled":
      return "Disabled";
    default:
      return "Preview — simulated payments";
  }
}

export function isLivePayments(provider: string): boolean {
  return provider === "stripe" || provider === "indiegogo";
}

// --- Plain-language copy blocks (installed verbatim across the site) ----------

export const COPY = {
  heroHeadline: "Verified receipts for digital downloads.",
  heroSubcopy:
    "Sell locked digital products with buyer-specific licenses, local unlocks, and receipts that verify publicly.",
  positioning:
    "Verified receipts for digital downloads. Buyer-specific licenses. Public artifact verification. No fake piracy-proof claims.",
  buyerProof:
    "Before you buy, see exactly what you receive: a license record, a receipt, an unlock method, and a verifier result.",
  // Claim boundaries — the honesty discipline Reddit (r/SideProject, DRM objectors) praised.
  productBoundary:
    "My Digital does not stop copying after unlock. It gives creators and buyers a clearer license, receipt, integrity, and traceability trail.",
  verifierBoundary:
    "This verifier checks the receipt and package record. It does not judge product quality, legality, originality, safety, value, or whether a buyer copied the file after unlock.",
  creatorBoundary:
    "Creators can issue digital products as locked assets with buyer-specific license records and verifiable receipts.",
  fundingBoundary:
    "Backers are supporting product access and launch rewards. This is not equity, revenue share, token sale, or an investment offering.",
  unlockReframe:
    "Unlocking is just your access step. Enter your access key (or open it from your library) and the file decrypts on your own device — no account, no waiting on our servers.",
} as const;

// --- First-launch niches (narrow wedge, not "every file type") ---------------

export const LAUNCH_NICHES = [
  "Paid templates",
  "Prompt packs",
  "Reports & PDFs",
  "Code assets",
] as const;

// --- Comparison: what My Digital adds over plain download stores -------------

export interface ComparisonRow {
  capability: string;
  others: string;
  mydigital: string;
}

export const COMPARISON_ROWS: ComparisonRow[] = [
  {
    capability: "Delivers the file to the buyer",
    others: "Yes",
    mydigital: "Yes",
  },
  {
    capability: "Buyer-specific license record",
    others: "No — same link/file for everyone",
    mydigital: "Yes — issued per buyer",
  },
  {
    capability: "Signed receipt that verifies publicly",
    others: "No",
    mydigital: "Yes — at /verify, online or offline",
  },
  {
    capability: "Independent package/artifact verifier",
    others: "No",
    mydigital: "Yes — checks integrity + structure",
  },
  {
    capability: "Leak traceability back to a license",
    others: "No",
    mydigital: "Yes — exact-match, reported honestly",
  },
  {
    capability: "Claims to make copying impossible",
    others: "Often implied",
    mydigital: "No — never; copying after unlock is possible",
  },
];

// --- Founder tiers (reward-based, no investment language) --------------------

export interface FounderTier {
  key: string;
  name: string;
  price: string;
  rewards: string[];
}

export const FOUNDER_TIERS: FounderTier[] = [
  {
    key: "supporter",
    name: "Supporter",
    price: "$9",
    rewards: [
      "Launch wall name or handle",
      "Founder update emails",
      "Founder receipt",
    ],
  },
  {
    key: "creator-founder",
    name: "Creator Founder",
    price: "$29",
    rewards: [
      "Early creator account",
      "First locked product page",
      "Founder badge",
      "July 1 onboarding priority",
    ],
  },
  {
    key: "lifetime-founder",
    name: "Lifetime Founder",
    price: "$99",
    rewards: [
      "25 locked artifact credits",
      "Lifetime founder status",
      "Priority launch support",
    ],
  },
  {
    key: "studio-founder",
    name: "Studio Founder",
    price: "$249",
    rewards: [
      "100 locked artifact credits",
      "Custom verifier / listing setup",
      "Direct onboarding help",
    ],
  },
];

export const USE_OF_FUNDS = [
  "Infrastructure and reliability",
  "Product polish across buyer and creator flows",
  "Creator onboarding and payouts",
  "Verifier and trust documentation",
  "Independent security review",
  "Launch support",
] as const;

// --- Sample (illustrative) records for the pre-purchase proof preview --------
// These are NOT live cryptographic artifacts. They show, before any payment,
// exactly what a buyer receives and what a verifier result looks like.

export interface SampleLicense {
  licenseId: string;
  product: string;
  buyerLabel: string;
  issuedAt: string;
  unlockMethod: string;
  terms: string;
}

export interface SampleReceipt {
  receiptId: string;
  product: string;
  licenseId: string;
  issuedAt: string;
  verifyUrl: string;
  artifactHash: string;
}

export interface SampleVerification {
  verdict: "Verified" | "Warning" | "Failed" | "Unknown";
  subject: string;
  checkedAt: string;
  checked: string[];
  passed: string[];
  notChecked: string[];
  assumptions: string[];
}

export const SAMPLE_LICENSE: SampleLicense = {
  licenseId: "lic_sample_8f31c0a4",
  product: "Demo Prompt Pack",
  buyerLabel: "buyer #a91f (email hash)",
  issuedAt: "2026-06-12T14:08:00Z",
  unlockMethod: "Local access key (decrypts on your device)",
  terms: "Personal use, attribution required, 1 licensed seat",
};

export const SAMPLE_RECEIPT: SampleReceipt = {
  receiptId: "rcpt_sample_2db70f15",
  product: "Demo Prompt Pack",
  licenseId: "lic_sample_8f31c0a4",
  issuedAt: "2026-06-12T14:08:01Z",
  verifyUrl: "https://mydigital.imagineqira.com/verify/rcpt_sample_2db70f15",
  artifactHash: "8831deca1763b23ad1d0cb9a1d433f0aec908217…",
};

export const SAMPLE_VERIFICATION: SampleVerification = {
  verdict: "Verified",
  subject: "proof receipt · rcpt_sample_2db70f15",
  checkedAt: "2026-06-12T14:09:00Z",
  checked: [
    "Receipt signature (issuer Ed25519)",
    "License id and buyer binding",
    "Artifact hash (SHA-256)",
    "Envelope schema (BRY-NFET-SX-VAULT-V2)",
    "Issued timestamp and product id",
  ],
  passed: [
    "Receipt signature matches the issuer public key",
    "Receipt binds to its license and purchase",
    "Recorded artifact hash is well-formed",
  ],
  notChecked: [
    "Whether the product is good, legal, or original",
    "Whether the buyer copied the file after unlock",
    "Factual truth or safety of the content",
  ],
  assumptions: [
    "The issuer public key is the one printed on the receipt bundle.",
    "Trust that key only if you trust where the bundle came from.",
  ],
};
