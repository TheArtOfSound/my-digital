import type { SampleLicense } from "../lib/launch";

/** Renders a buyer-specific license record (sample or real, same shape). */
export function LicenseCard({ license }: { license: SampleLicense }) {
  return (
    <article className="proof-card">
      <header className="proof-card-head">
        <h3>License record</h3>
        <span className="pill pill-demo">SAMPLE</span>
      </header>
      <dl className="kv">
        <div>
          <dt>License id</dt>
          <dd className="mono">{license.licenseId}</dd>
        </div>
        <div>
          <dt>Product</dt>
          <dd>{license.product}</dd>
        </div>
        <div>
          <dt>Issued to</dt>
          <dd>{license.buyerLabel}</dd>
        </div>
        <div>
          <dt>Terms</dt>
          <dd>{license.terms}</dd>
        </div>
        <div>
          <dt>Access method</dt>
          <dd>{license.unlockMethod}</dd>
        </div>
      </dl>
    </article>
  );
}
