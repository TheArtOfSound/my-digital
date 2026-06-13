import { Link } from "react-router-dom";
import { formatPrice } from "../lib/format";
import { useMarketplace } from "../lib/marketplace";

const lifecycle = ["Create", "Lock", "List", "Buy", "License", "Unlock", "Verify", "Trace"];

export function HomePage() {
  const { state } = useMarketplace();

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Imagine Qira · QEV-Secured Commerce</p>
        <h1>A marketplace where every digital product is sold as a locked, verifiable asset.</h1>
        <p className="subhead">
          My Digital packages each product into a QEV envelope. Every purchase issues a
          buyer-specific license, a one-time unlock code, and a signed receipt that verifies at
          its printed address — and unlocking happens on the buyer's own machine, not our
          servers.
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary" to="/sell">
            Lock and list a product
          </Link>
          <Link className="btn btn-ghost" to="/creator">
            Creator dashboard
          </Link>
        </div>
        <div className="notice">
          Preview build: envelope locking, licensing, receipts, and trace are fully operational
          on QEV Vault V2 cryptography. Payments are simulated — no charges occur.
        </div>
      </section>

      <section className="panel">
        <h2>How a sale works</h2>
        <div className="lifecycle">
          {lifecycle.map((step) => (
            <span className="step" key={step}>
              {step}
            </span>
          ))}
        </div>
        <p style={{ marginTop: "14px" }}>
          The lifecycle is the product: assets are locked before listing, licenses are issued only
          after confirmed payment, and every artifact — license, receipt, vault — can be
          independently verified.
        </p>
      </section>

      <section className="panel">
        <h2>Listings ({state.listings.length})</h2>
        {state.listings.length === 0 ? (
          <p>
            Nothing is listed yet. <Link to="/sell">Lock and list the first product</Link> to run
            the lifecycle end to end.
          </p>
        ) : (
          <div className="listing-grid">
            {state.listings.map((listing) => (
              <Link className="listing-card" key={listing.id} to={`/listing/${listing.id}`}>
                <h3>{listing.title}</h3>
                <p>{listing.description}</p>
                <p className="listing-price">{formatPrice(listing.priceAmount, listing.priceCurrency)}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="grid">
        <article className="card">
          <h3>For creators</h3>
          <p>
            Files are locked into QEV asset envelopes with machine-readable license terms. Custody
            secrets are sealed server-side; leaked copies trace back to the license they were
            issued under.
          </p>
        </article>
        <article className="card">
          <h3>For buyers</h3>
          <p>
            You receive your own encrypted vault, an unlock code shown exactly once, and a signed
            receipt. Decryption runs locally — your code and your files never touch our servers.
          </p>
        </article>
        <article className="card">
          <h3>For verification</h3>
          <p>
            Licenses, receipts, and packages verify cryptographically, online or offline. Every
            result states what was checked, what was not, and what is assumed.
          </p>
        </article>
      </section>

      <section className="panel muted">
        <h2>What we claim, plainly</h2>
        <p>
          This platform improves controlled access, proof of purchase, license verification, and
          leak traceability. It does not claim to make piracy impossible, and it never will.
        </p>
      </section>
    </>
  );
}
