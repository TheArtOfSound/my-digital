import { Link } from "react-router-dom";
import { formatPrice } from "../lib/format";
import { useMarketplace } from "../lib/marketplace";

const lifecycle = ["CREATE", "LOCK", "LIST", "BUY", "LICENSE", "UNLOCK", "VERIFY", "TRACE"];

export function HomePage() {
  const { state } = useMarketplace();

  return (
    <>
      <section className="hero">
        <p className="eyebrow">QEV commerce extension</p>
        <h1>Sell digital products as locked, verifiable assets.</h1>
        <p className="subhead">
          My Digital is the QEV-powered commerce primitive for encrypted digital goods,
          buyer-specific unlock licenses, tamper verification, and proof-of-purchase receipts.
        </p>
        <div className="notice">
          <strong>Demo build:</strong> envelope locking uses a clearly labeled demo adapter — not
          production cryptography. SHA-256 hashing and Ed25519 issuer signatures are real. All
          state lives in this browser.
        </div>
        <div className="hero-actions">
          <Link className="btn btn-primary" to="/sell">
            Lock and list a product
          </Link>
          <Link className="btn btn-ghost" to="/creator">
            Creator dashboard
          </Link>
        </div>
      </section>

      <section className="panel">
        <h2>Core lifecycle</h2>
        <div className="lifecycle">
          {lifecycle.map((step) => (
            <span className="step" key={step}>
              {step}
            </span>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Demo listings ({state.listings.length})</h2>
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
          <h3>Creator promise</h3>
          <p>Lock files into QEV-style asset envelopes and sell them with clear license terms.</p>
        </article>
        <article className="card">
          <h3>Buyer promise</h3>
          <p>Receive a buyer-specific unlock credential and a verifiable purchase receipt.</p>
        </article>
        <article className="card">
          <h3>Trust promise</h3>
          <p>Verify asset integrity, license binding, and receipt status without vague security theater.</p>
        </article>
      </section>

      <section className="panel muted">
        <h2>Build rule</h2>
        <p>
          This product improves controlled access, proof, and traceability. It must remain honest
          about what it verifies, what it does not verify, and what remains outside the
          application boundary.
        </p>
      </section>
    </>
  );
}
