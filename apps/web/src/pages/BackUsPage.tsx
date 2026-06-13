import { Link } from "react-router-dom";
import { useMarketplace } from "../lib/marketplace";

export const FUNDRAISING_URL = "https://buy.stripe.com/fZu8wP890dge5WJ9a77kc00";

export function BackUsPage() {
  const { state } = useMarketplace();
  const firstListing = state.listings[0];

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Imagine Qira · Launch Campaign</p>
        <h1>Help us launch the marketplace where buying digital means owning proof.</h1>
        <p className="subhead">
          My Digital is live today. Every product is sold as a locked QEV asset: buyers get their
          own encrypted vault, a one-time unlock code, a cryptographically signed license, and a
          receipt that verifies at its printed address. Unlocking happens on the buyer's machine —
          never on our servers. Your backing takes it from working launch to hardened platform.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href={FUNDRAISING_URL} target="_blank" rel="noreferrer">
            Back the launch — choose your amount
          </a>
          {firstListing && (
            <Link className="btn btn-ghost" to={`/listing/${firstListing.id}`}>
              Or buy the first product
            </Link>
          )}
        </div>
        <div className="notice">
          Backing is processed by Stripe on a secure hosted page (minimum $5, any amount you
          choose). Contributions are support for the project, not an investment: no equity, no
          interest, no promised returns.
        </div>
      </section>

      <section className="panel">
        <h2>What already works — verifiable right now</h2>
        <dl className="kv">
          <div>
            <dt>Locked-asset sales</dt>
            <dd>
              Products are sealed into QEV envelopes (schema BRY-NFET-SX-VAULT-V2, Argon2id and
              XChaCha20-Poly1305) before they are ever listed.
            </dd>
          </div>
          <div>
            <dt>Buyer-specific vaults</dt>
            <dd>
              Each paid checkout mints a vault unique to that buyer, with the license sealed
              inside the encryption itself.
            </dd>
          </div>
          <div>
            <dt>Local-first unlock</dt>
            <dd>
              Decryption runs in the buyer's browser. Unlock codes and decrypted files never reach
              the server after purchase.
            </dd>
          </div>
          <div>
            <dt>Verifiable receipts</dt>
            <dd>
              Every receipt is signed and verifies at its printed URL — and offline, because the
              signed artifact is the trust root, not our uptime.
            </dd>
          </div>
          <div>
            <dt>Leak tracing</dt>
            <dd>
              A re-shared vault identifies which license it was issued under by exact hash match.
              Plaintext leaks are reported honestly as unattributable.
            </dd>
          </div>
          <div>
            <dt>Real payments</dt>
            <dd>Live Stripe checkout on the hosted page; card details never touch this site.</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <h2>What your backing funds</h2>
        <dl className="kv">
          <div>
            <dt>Independent security audit</dt>
            <dd>
              Third-party review of the envelope implementation and the marketplace before we
              invite creators at scale.
            </dd>
          </div>
          <div>
            <dt>Buyer accounts</dt>
            <dd>Real authentication and a durable purchase library across devices.</dd>
          </div>
          <div>
            <dt>Creator onboarding</dt>
            <dd>Payouts, storefront tools, and the first cohort of creators in proof-sensitive
              niches: prompt packs, research, code templates, sample packs.</dd>
          </div>
          <div>
            <dt>Open verification tooling</dt>
            <dd>
              Vaults already open with the public qev CLI. We fund keeping the verification layer
              open so proofs outlive any one platform.
            </dd>
          </div>
        </dl>
      </section>

      <section className="panel muted">
        <h2>What we claim, plainly</h2>
        <p>
          This platform improves controlled access, proof of purchase, license verification, and
          leak traceability. It does not make piracy impossible, and we will never tell you —
          or your buyers — otherwise.
        </p>
      </section>
    </>
  );
}
