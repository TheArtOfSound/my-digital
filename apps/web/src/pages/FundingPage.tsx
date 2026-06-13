import { Link } from "react-router-dom";
import { ClaimBoundary } from "../components/ClaimBoundary";
import { FounderTierCard } from "../components/FounderTierCard";
import { FOUNDER_TIERS, FUNDRAISING_URL, LAUNCH_DATE, USE_OF_FUNDS } from "../lib/launch";

export function FundingPage() {
  const live = FUNDRAISING_URL.length > 0;

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Imagine Qira · Founder Launch</p>
        <h1>Back the launch. Become a founder.</h1>
        <p className="subhead">
          My Digital is live today: locked products, buyer-specific licenses, public receipt
          verification, and leak tracing all work now. Founder backing takes it from working launch
          to hardened, creator-ready platform by {LAUNCH_DATE}.
        </p>
        <div className="hero-actions">
          {live ? (
            <a className="btn btn-primary" href={FUNDRAISING_URL} target="_blank" rel="noreferrer">
              Become a founder — choose your amount
            </a>
          ) : (
            <span className="btn btn-ghost" aria-disabled="true">
              Founder access opens soon
            </span>
          )}
          <Link className="btn btn-ghost" to="/status">
            See what is live
          </Link>
        </div>
        <div style={{ marginTop: "22px" }}>
          <ClaimBoundary variant="funding" heading="This is reward-based, not an investment" />
        </div>
      </section>

      <section className="panel">
        <h2>Founder tiers</h2>
        <p style={{ marginBottom: "18px" }}>
          Every tier is product access and launch rewards. Backing is processed by Stripe on a
          secure hosted page; pick the amount that matches your tier.
        </p>
        <div className="tier-grid">
          {FOUNDER_TIERS.map((tier) => (
            <FounderTierCard key={tier.key} tier={tier} />
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Where the funds go</h2>
        <ul className="plain-list">
          {USE_OF_FUNDS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>What already works — verifiable right now</h2>
        <dl className="kv">
          <div>
            <dt>Locked-asset sales</dt>
            <dd>
              Products are sealed into QEV envelopes (schema BRY-NFET-SX-VAULT-V2, Argon2id and
              XChaCha20-Poly1305) before they are listed.
            </dd>
          </div>
          <div>
            <dt>Buyer-specific licenses</dt>
            <dd>Each paid checkout issues a license record and receipt unique to that buyer.</dd>
          </div>
          <div>
            <dt>Local-first unlock</dt>
            <dd>Files decrypt in the buyer's browser; access keys never reach the server.</dd>
          </div>
          <div>
            <dt>Public verification</dt>
            <dd>
              Every receipt verifies at its printed address on the{" "}
              <Link to="/verify">verifier</Link> — online or offline.
            </dd>
          </div>
          <div>
            <dt>Leak tracing</dt>
            <dd>A re-shared vault matches back to the license it was issued under, by exact hash.</dd>
          </div>
        </dl>
      </section>

      <section className="panel muted">
        <h2>What backing is — and is not</h2>
        <p style={{ marginBottom: "16px" }}>
          Backers are supporting product access and launch rewards. There is no equity, revenue
          share, token, profit share, or ownership of any kind.
        </p>
        <ClaimBoundary variant="product" />
      </section>
    </>
  );
}
