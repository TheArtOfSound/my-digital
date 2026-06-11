import type { ListingId } from "@my-digital/types";
import { useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { copyToClipboard, downloadJson, formatPrice } from "../lib/format";
import { useMarketplace, type CheckoutResult } from "../lib/marketplace";

export function CheckoutPage() {
  const { listingId } = useParams<{ listingId: string }>();
  const { state, actions } = useMarketplace();
  const [email, setEmail] = useState("buyer@example.com");
  const [displayName, setDisplayName] = useState("Demo Buyer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [copied, setCopied] = useState(false);
  const outcomeRef = useRef<"paid" | "failed">("paid");

  const listing = state.listings.find((entry) => entry.id === listingId);
  if (!listing) {
    return (
      <section className="panel">
        <h2>Listing not found</h2>
        <p>
          This listing does not exist in this browser's demo records. <Link to="/">Back home</Link>.
        </p>
      </section>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
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
        <h2>Payment declined (simulated)</h2>
        <p>
          The mock provider reported a failed payment. Purchase{" "}
          <span className="mono">{result.purchase.id}</span> was recorded with status{" "}
          <strong>{result.purchase.status}</strong>. No license was issued, no unlock code
          exists, and no receipt was generated.
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
    const bundle = result;
    return (
      <>
        <section className="panel panel-success">
          <h2>Purchase complete (mock payment)</h2>
          <dl className="kv">
            <div>
              <dt>Purchase</dt>
              <dd className="mono">
                {bundle.purchase.id} · status {bundle.purchase.status} · provider{" "}
                {bundle.purchase.paymentProvider}
              </dd>
            </div>
            <div>
              <dt>License (buyer-specific, Ed25519-signed)</dt>
              <dd className="mono">{bundle.license.id}</dd>
            </div>
            <div>
              <dt>Receipt</dt>
              <dd className="mono">{bundle.receipt.id}</dd>
            </div>
          </dl>
        </section>

        <section className="panel panel-warning">
          <h2>Your unlock code — shown once</h2>
          <p>
            Only the SHA-256 hash of this code is stored. If you lose the code, the demo cannot
            recover it.
          </p>
          <p className="unlock-code mono">{bundle.rawUnlockCode}</p>
          <div className="hero-actions">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                void copyToClipboard(bundle.rawUnlockCode).then(setCopied);
              }}
            >
              {copied ? "Copied" : "Copy unlock code"}
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => downloadJson(`${bundle.license.id}.json`, bundle.license)}
            >
              Download license JSON
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() =>
                downloadJson(`${bundle.receipt.id}.json`, actions.makeReceiptBundle(bundle.receipt.id))
              }
            >
              Download receipt bundle
            </button>
          </div>
        </section>

        <section className="panel">
          <h2>Next steps</h2>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/unlock">
              Unlock the product
            </Link>
            <Link className="btn btn-ghost" to="/verify">
              Verify license and receipt
            </Link>
          </div>
        </section>
      </>
    );
  }

  return (
    <section className="panel">
      <h2>Mock checkout</h2>
      <p>
        {listing.title} — {formatPrice(listing.priceAmount, listing.priceCurrency)}
      </p>
      <div className="notice">
        Checkout goes through the payment adapter boundary: a checkout session is created, the
        mock provider reports a paid or failed event, and a license exists only after a paid
        confirmation. No card fields, no real charge. A Stripe adapter arrives later behind the
        same interface.
      </div>
      <form className="form" onSubmit={onSubmit}>
        <label className="field">
          Buyer email (stored as SHA-256 hash only)
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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
              : `Pay ${formatPrice(listing.priceAmount, listing.priceCurrency)} (mock)`}
          </button>
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
        </div>
      </form>
    </section>
  );
}
