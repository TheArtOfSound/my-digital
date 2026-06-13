import { useState } from "react";
import { Link } from "react-router-dom";
import { copyToClipboard, downloadBytes, downloadJson } from "../lib/format";
import { useMarketplace, type CheckoutResult } from "../lib/marketplace";

type PaidOutcome = Extract<CheckoutResult, { outcome: "paid" }>;

/** Post-payment panel: purchase summary, the once-shown unlock code, downloads. */
export function PaidOutcomePanel({ outcome }: { outcome: PaidOutcome }) {
  const { actions } = useMarketplace();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <section className="panel panel-success">
        <h2>Purchase complete</h2>
        <dl className="kv">
          <div>
            <dt>Purchase</dt>
            <dd className="mono">
              {outcome.purchase.id} · status {outcome.purchase.status} · provider{" "}
              {outcome.purchase.paymentProvider}
            </dd>
          </div>
          <div>
            <dt>License (buyer-specific, signed)</dt>
            <dd className="mono">{outcome.license.id}</dd>
          </div>
          <div>
            <dt>Your encrypted vault</dt>
            <dd className="mono">hash {outcome.buyerVaultHash.slice(0, 32)}…</dd>
          </div>
          <div>
            <dt>Receipt</dt>
            <dd className="mono">{outcome.receipt.id}</dd>
          </div>
        </dl>
      </section>

      <section className="panel panel-warning">
        <h2>Your unlock code — shown once</h2>
        <p>
          Only the SHA-256 hash of this code is stored. The code decrypts your vault locally; it
          is never sent to the server. If you lose it, it cannot be recovered.
        </p>
        <p className="unlock-code mono">{outcome.rawUnlockCode}</p>
        <div className="hero-actions">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              void copyToClipboard(outcome.rawUnlockCode).then(setCopied);
            }}
          >
            {copied ? "Copied" : "Copy unlock code"}
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => {
              void actions
                .fetchBuyerVault(outcome.license.id)
                .then((bytes) =>
                  downloadBytes(`${outcome.license.id}.vault.json`, "application/json", bytes)
                )
                .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
            }}
          >
            Download locked vault
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => {
              void actions
                .getReceiptBundle(outcome.receipt.id)
                .then((receiptBundle) => downloadJson(`${outcome.receipt.id}.json`, receiptBundle))
                .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
            }}
          >
            Download receipt bundle
          </button>
        </div>
        {error && <p className="panel-error">{error}</p>}
      </section>

      <section className="panel">
        <h2>Next steps</h2>
        <p>
          Unlock runs entirely in your browser (or with the qev CLI for text assets). The vault is
          a standard BRY-NFET-SX-VAULT-V2 document; your receipt verifies at its printed address.
        </p>
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
