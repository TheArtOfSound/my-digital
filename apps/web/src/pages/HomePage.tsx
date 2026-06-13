import { Link } from "react-router-dom";
import { ClaimBoundary } from "../components/ClaimBoundary";
import { BUYER_FLOW, FlowStepper } from "../components/FlowStepper";
import { ProofPreview } from "../components/ProofPreview";
import { formatPrice } from "../lib/format";
import { COMPARISON_ROWS, COPY, LAUNCH_DATE, LAUNCH_NICHES, isLivePayments } from "../lib/launch";
import { useMarketplace } from "../lib/marketplace";

export function HomePage() {
  const { state, paymentsProvider } = useMarketplace();
  const live = isLivePayments(paymentsProvider);

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Imagine Qira · Verified digital commerce</p>
        <h1>{COPY.heroHeadline}</h1>
        <p className="subhead">{COPY.heroSubcopy}</p>
        <div className="hero-actions">
          <Link className="btn btn-primary" to="/sell">
            Sell a digital product
          </Link>
          <Link className="btn btn-ghost" to="/verify">
            Try the verifier demo
          </Link>
          <Link className="btn btn-ghost" to="/funding">
            Back the launch
          </Link>
        </div>
        <div className="notice">
          {COPY.positioning}{" "}
          {live
            ? "Payments are processed by Stripe on its secure hosted checkout."
            : "Preview build: payments are simulated and no charges occur — see the status page."}
        </div>
      </section>

      <ProofPreview heading="What a buyer receives — before they pay" />

      <section className="panel">
        <h2>How a sale works for a buyer</h2>
        <FlowStepper steps={BUYER_FLOW} />
        <p style={{ marginTop: "14px" }}>
          Unlocking is just your access step — not a cryptography exam. The full creator-to-trace
          lifecycle (Create, Lock, List, Buy, License, Unlock, Verify, Trace) is explained in the{" "}
          <Link to="/docs/qev">trust docs</Link>.
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
                <p className="listing-price">
                  {formatPrice(listing.priceAmount, listing.priceCurrency)}
                </p>
              </Link>
            ))}
          </div>
        )}
        <p className="hint" style={{ marginTop: "12px" }}>
          First launch wedge: {LAUNCH_NICHES.join(", ")} — proof-sensitive digital goods, not every
          file type.
        </p>
      </section>

      <section className="panel">
        <h2>Why not just a download link?</h2>
        <p style={{ marginBottom: "16px" }}>
          Gumroad, Shopify digital downloads, and Drive/Dropbox links all deliver a file. My Digital
          adds a verifiable receipt, a buyer-specific license, and a public verifier on top — it is a
          proof layer, not a generic store clone.
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>Capability</th>
              <th>Download link / store</th>
              <th>My Digital</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row) => (
              <tr key={row.capability}>
                <td>{row.capability}</td>
                <td>{row.others}</td>
                <td>{row.mydigital}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid">
        <article className="card">
          <h3>For creators</h3>
          <p>
            {COPY.creatorBoundary} Custody secrets are sealed server-side; leaked copies trace back
            to the license they were issued under.
          </p>
        </article>
        <article className="card">
          <h3>For buyers</h3>
          <p>
            You receive your own license record, a receipt that verifies publicly, and an access key
            shown once. Decryption runs locally — your key and your files never touch our servers.
          </p>
        </article>
        <article className="card">
          <h3>For verification</h3>
          <p>
            The <Link to="/verify">verifier</Link> is the trust center: it states what was checked,
            what passed, what was not checked, and what is assumed — online or offline, before you
            buy.
          </p>
        </article>
      </section>

      <section className="panel muted">
        <h2>What we claim, plainly</h2>
        <p style={{ marginBottom: "16px" }}>
          This platform improves controlled access, proof of purchase, license verification, and leak
          traceability. It does not claim to make piracy impossible, and it never will.
        </p>
        <ClaimBoundary variant="product" />
        <p className="hint" style={{ marginTop: "14px" }}>
          Launch target {LAUNCH_DATE}. See exactly what is live versus simulated on the{" "}
          <Link to="/status">status page</Link>.
        </p>
      </section>
    </>
  );
}
