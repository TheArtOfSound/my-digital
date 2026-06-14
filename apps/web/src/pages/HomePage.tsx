import { Link } from "react-router-dom";
import { formatPrice } from "../lib/format";
import { isLivePayments } from "../lib/launch";
import { useMarketplace } from "../lib/marketplace";

export function HomePage() {
  const { state, paymentsProvider } = useMarketplace();
  const live = isLivePayments(paymentsProvider);
  const hasListings = state.listings.length > 0;

  return (
    <>
      <section className="hero">
        <h1>Sell digital products. Get paid directly.</h1>
        <p className="subhead">
          Upload a file, set a price, and start selling. Buyers download instantly and get a receipt
          that proves the purchase — and your earnings go straight to your own Stripe account, not
          ours.
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary" to="/sell">
            Start selling
          </Link>
          <a className="btn btn-ghost" href="#products">
            Browse products
          </a>
        </div>
      </section>

      <section className="panel" id="products">
        <div className="section-head">
          <h2>{hasListings ? "Browse products" : "Products"}</h2>
          {hasListings && (
            <Link to="/sell" className="section-link">
              Sell yours →
            </Link>
          )}
        </div>
        {hasListings ? (
          <div className="listing-grid">
            {state.listings.map((listing) => (
              <Link className="listing-card" key={listing.id} to={`/listing/${listing.id}`}>
                <h3>{listing.title}</h3>
                <p>{listing.description}</p>
                <p className="listing-price">
                  {formatPrice(listing.priceAmount, listing.priceCurrency)}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <p>
            Nothing for sale just yet. <Link to="/sell">List the first product</Link> — it takes a
            couple of minutes.
          </p>
        )}
      </section>

      <section className="panel">
        <h2>How it works</h2>
        <div className="how-grid">
          <div className="how-step">
            <span className="how-num">1</span>
            <h3>Upload &amp; price it</h3>
            <p>
              Add your file, write a short description, set a price. Your product is sealed so only
              paying buyers can open it.
            </p>
          </div>
          <div className="how-step">
            <span className="how-num">2</span>
            <h3>Buyers pay you directly</h3>
            <p>
              Checkout runs on Stripe and the money lands in your own account. My Digital never holds
              your earnings.
            </p>
          </div>
          <div className="how-step">
            <span className="how-num">3</span>
            <h3>Proof + a secure download</h3>
            <p>
              Every sale issues a buyer-specific download and a receipt anyone can verify — so a
              purchase is provable, not just a file in an inbox.
            </p>
          </div>
        </div>
      </section>

      <section className="panel muted">
        <p style={{ margin: 0 }}>
          Built on real cryptography (QEV Vault V2), so every purchase is independently verifiable.
          We don't claim it makes copying impossible — we make ownership <em>provable</em>.{" "}
          <Link to="/docs/qev">See how it works →</Link>
        </p>
        <p className="hint" style={{ marginTop: "10px", marginBottom: 0 }}>
          {live ? "Payments run live on Stripe. " : "Preview build — payments are simulated. "}
          <Link to="/verify">Try the verifier</Link> · <Link to="/status">What's live</Link>
        </p>
      </section>
    </>
  );
}
