import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE = "My Digital";
const ORIGIN = "https://mydigital.imagineqira.com";

interface Meta {
  title: string;
  description: string;
}

const HOME_DESC =
  "My Digital is a marketplace where every digital product is sold as a locked, verifiable asset — buyer-specific licenses, local unlocks, and receipts that verify cryptographically.";

// Per-route titles + descriptions. An SPA serves one index.html for every path,
// so we keep the document metadata in sync on each navigation for crawlers that
// render JS, social unfurls of in-app links, and the browser tab/title.
const HOME: Meta = {
  title: `${SITE} — Sell digital products as locked, verifiable assets`,
  description: HOME_DESC
};
const VERIFY: Meta = {
  title: `Verify a receipt or license — ${SITE}`,
  description: "Independently verify a My Digital receipt, license, or package — online or offline."
};

const ROUTES: Record<string, Meta> = {
  "/": HOME,
  "/funding": {
    title: `Back the launch — ${SITE}`,
    description:
      "Support My Digital's launch. Contributions are support for the project, not an investment — no equity, no returns."
  },
  "/docs/qev": {
    title: `How it works & trust docs — ${SITE}`,
    description:
      "How My Digital works: QEV-locked assets, buyer-specific licenses, local-first unlock, signed receipts, and the limits we state plainly."
  },
  "/status": {
    title: `Status — ${SITE}`,
    description: "What's live on My Digital right now: payments, cryptography, and the claims we make plainly."
  },
  "/verify": VERIFY,
  "/trace": {
    title: `Trace a shared file — ${SITE}`,
    description: "Check whether a shared vault traces back to the license it was issued under."
  },
  "/sell": {
    title: `Sell on ${SITE}`,
    description: "List a digital product as a locked, verifiable asset and get paid directly to your own account."
  },
  "/library": { title: `Your library — ${SITE}`, description: "Your purchases, licenses, and receipts on My Digital." },
  "/creator": {
    title: `Seller dashboard — ${SITE}`,
    description: "Manage your seller profile, listings, payouts, and verification on My Digital."
  },
  "/unlock": {
    title: `Unlock your purchase — ${SITE}`,
    description: "Unlock and decrypt your purchased file locally in your browser."
  },
  "/login": { title: `Log in — ${SITE}`, description: "Log in to your My Digital account." },
  "/signup": {
    title: `Create your account — ${SITE}`,
    description: "Create a My Digital account to buy with a saved library, or to sell and get paid directly."
  }
};

function metaFor(pathname: string): Meta {
  const exact = ROUTES[pathname];
  if (exact) return exact;
  if (pathname.startsWith("/listing/")) return { title: `Product — ${SITE}`, description: HOME_DESC };
  if (pathname.startsWith("/verify/")) return VERIFY;
  if (pathname.startsWith("/checkout"))
    return { title: `Checkout — ${SITE}`, description: "Complete your purchase on My Digital." };
  return HOME;
}

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/** Keeps document title + description + canonical + social tags in sync per route. */
export function RouteSeo() {
  const { pathname } = useLocation();
  useEffect(() => {
    const meta = metaFor(pathname);
    const canonical = `${ORIGIN}${pathname}`;
    document.title = meta.title;
    upsertMeta("name", "description", meta.description);
    upsertMeta("property", "og:title", meta.title);
    upsertMeta("property", "og:description", meta.description);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("name", "twitter:title", meta.title);
    upsertMeta("name", "twitter:description", meta.description);
    upsertCanonical(canonical);
  }, [pathname]);
  return null;
}
