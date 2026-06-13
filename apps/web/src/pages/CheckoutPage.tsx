import type { ListingId } from "@my-digital/types";
import { useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { PaidOutcomePanel } from "../components/PaidOutcomePanel";
import { formatPrice } from "../lib/format";
import { useMarketplace, type CheckoutResult } from "../lib/marketplace";

export function CheckoutPage() {
  const { listingId } = useParams<{ listingId: string }>();
  const { state, actions, paymentsProvider } = useMarketplace();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const outcomeRef = useRef<"paid" | "failed">("paid");
  const stripeMode = paymentsProvider === "stripe";

  const listing = state.listings.find((entry) => entry.id === listingId);
  if (!listing) {
    return (
      <section className="panel">
        <h2>Listing not found</h2>
        <p>
          This listing does not exist in the marketplace records. <Link to="/">Back home</Link>.
        </p>
      </section>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (stripeMode) {
        // Redirect flow: create the pending purchase and hosted session, then
        // hand the buyer to Stripe. Fulfillment happens on /checkout/done.
        const begun = await actions.beginCheckout({
          listingId: listing!.id as ListingId,
          email,
          ...(displayName.trim().length > 0 ? { displayName: displayName.trim() } : {})
        });
        if (!begun.session.checkoutUrl) {
          throw new Error("The payment provider did not return a checkout page.");
        }
        window.location.assign(begun.session.checkoutUrl);
        return;
      }
      const checkoutResult = await actions.buyListing({
        listingId: listing!.id as ListingId,
        email,
        ...(displayName.trim().length > 0 ? { displayName: displayName.trim() } : {}),
        ...(outcomeRef.current === "failed" ? { simulateOutcome: "failed" as const } : {})
      });
      setResult(checkoutResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
      outcomeRef.current = "paid";
    }
  }

  if (result && result.outcome === "failed") {
    return (
      <section className="panel panel-error-block">
        <h2>Payment declined</h2>
        <p>
          The payment provider reported a failed payment. Purchase{" "}
          <span className="mono">{result.purchase.id}</span> was recorded with status{" "}
          <strong>{result.purchase.status}</strong>. No license was issued, no unlock code exists,
          no vault was minted, and no receipt was generated.
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary" type="button" onClick={() => setResult(null)}>
            Try again
          </button>
          <Link className="btn btn-ghost" to="/creator">
            Creator dashboard
          </Link>
        </div>
      </section>
    );
  }

  if (result) {
    return <PaidOutcomePanel outcome={result} />;
  }

  return (
    <section className="panel">
      <h2>Checkout</h2>
      <p>
        {listing.title} — {formatPrice(listing.priceAmount, listing.priceCurrency)}
      </p>
      {stripeMode ? (
        <div className="notice">
          Payment is processed by Stripe on a secure hosted page. After payment you return here
          to receive your license, your one-time unlock code, and your encrypted vault. Card
          details never touch this site.
        </div>
      ) : (
        <div className="notice">
          This preview instance uses a simulated payment provider: a checkout session is created,
          the provider reports a paid or failed event, and only a paid confirmation mints your
          license and encrypted vault. No card fields, no real charge.
        </div>
      )}
      <form className="form" onSubmit={onSubmit}>
        <label className="field">
          Buyer email (stored as SHA-256 hash only)
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>
        <label className="field">
          Display name (optional)
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </label>
        {error && <p className="panel-error">{error}</p>}
        <div className="hero-actions">
          <button
            className="btn btn-primary"
            disabled={busy}
            type="submit"
            onClick={() => {
              outcomeRef.current = "paid";
            }}
          >
            {busy
              ? "Processing…"
              : stripeMode
                ? `Pay ${formatPrice(listing.priceAmount, listing.priceCurrency)} with Stripe`
                : `Pay ${formatPrice(listing.priceAmount, listing.priceCurrency)} (simulated)`}
          </button>
          {!stripeMode && (
            <button
              className="btn btn-ghost"
              disabled={busy}
              type="submit"
              onClick={() => {
                outcomeRef.current = "failed";
              }}
            >
              Simulate declined payment
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
