import type { SampleReceipt } from "../lib/launch";

/** Renders a proof receipt (sample or real, same shape). */
export function ReceiptCard({ receipt }: { receipt: SampleReceipt }) {
  return (
    <article className="proof-card">
      <header className="proof-card-head">
        <h3>Proof receipt</h3>
        <span className="pill pill-demo">SAMPLE</span>
      </header>
      <dl className="kv">
        <div>
          <dt>Receipt id</dt>
          <dd className="mono">{receipt.receiptId}</dd>
        </div>
        <div>
          <dt>Product</dt>
          <dd>{receipt.product}</dd>
        </div>
        <div>
          <dt>License</dt>
          <dd className="mono">{receipt.licenseId}</dd>
        </div>
        <div>
          <dt>Artifact hash</dt>
          <dd className="mono">{receipt.artifactHash}</dd>
        </div>
        <div>
          <dt>Verifies at</dt>
          <dd className="mono">{receipt.verifyUrl}</dd>
        </div>
      </dl>
    </article>
  );
}
