import type { LicenseId } from "@my-digital/types";
import { useState } from "react";
import { Link } from "react-router-dom";
import { CreatorSetup } from "../components/CreatorSetup";
import { copyToClipboard, downloadJson, formatDate, formatPrice, shortHash, shortId } from "../lib/format";
import { useMarketplace } from "../lib/marketplace";

export function CreatorPage() {
  const { state, actions } = useMarketplace();
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  if (!state.creator) {
    return (
      <>
        <section className="panel">
          <h2>Creator dashboard</h2>
          <p>No creator profile exists in this browser yet.</p>
        </section>
        <CreatorSetup />
      </>
    );
  }
  const creator = state.creator;

  async function revoke(licenseId: LicenseId) {
    if (!window.confirm("Revoke this license? Unlock and verification will fail afterwards.")) {
      return;
    }
    setError(null);
    try {
      await actions.revokeLicense(licenseId, "Revoked by creator from the demo dashboard.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <>
      <section className="panel">
        <h2>Creator dashboard</h2>
        <dl className="kv">
          <div>
            <dt>Creator</dt>
            <dd>
              {creator.displayName} (@{creator.handle}) · <span className="mono">{creator.id}</span>
            </dd>
          </div>
          <div>
            <dt>Email hash</dt>
            <dd className="mono">{shortHash(creator.emailHash, 32)}</dd>
          </div>
          <div>
            <dt>Issuer</dt>
            <dd>
              {state.issuer ? (
                <>
                  {state.issuer.name} · key <span className="mono">{shortHash(state.issuer.publicKeyB64, 24)}</span>{" "}
                  <button
                    className="btn btn-ghost btn-small"
                    type="button"
                    onClick={() => {
                      if (state.issuer) {
                        void copyToClipboard(state.issuer.publicKeyB64).then(setCopiedKey);
                      }
                    }}
                  >
                    {copiedKey ? "Copied" : "Copy public key"}
                  </button>
                </>
              ) : (
                "not initialized"
              )}
            </dd>
          </div>
        </dl>
        <div className="notice">
          DEMO ONLY: the issuer private key is stored unprotected in this browser's localStorage so
          the demo survives reloads. Production issuance must never do this.
        </div>
        {error && <p className="panel-error">{error}</p>}
      </section>

      <section className="panel">
        <h2>Listings ({state.listings.length})</h2>
        {state.listings.length === 0 ? (
          <p>
            Nothing listed yet. <Link to="/sell">Lock and list a product</Link>.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Price</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.listings.map((listing) => (
                <tr key={listing.id}>
                  <td>{listing.title}</td>
                  <td>{formatPrice(listing.priceAmount, listing.priceCurrency)}</td>
                  <td>{listing.status}</td>
                  <td>
                    <Link className="btn btn-ghost btn-small" to={`/listing/${listing.id}`}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2>Purchases ({state.purchases.length})</h2>
        {state.purchases.length === 0 ? (
          <p>No purchases yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Purchase</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Paid at</th>
              </tr>
            </thead>
            <tbody>
              {state.purchases.map((purchase) => (
                <tr key={purchase.id}>
                  <td className="mono">{shortId(purchase.id, 26)}</td>
                  <td>{formatPrice(purchase.amountPaid, purchase.currency)}</td>
                  <td>
                    {purchase.status} ({purchase.paymentProvider})
                  </td>
                  <td>{purchase.paidAt ? formatDate(purchase.paidAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2>Licenses ({state.licenses.length})</h2>
        {state.licenses.length === 0 ? (
          <p>No licenses issued yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>License</th>
                <th>Asset</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.licenses.map((license) => {
                const asset = state.assets.find((entry) => entry.id === license.assetId);
                const revoked = license.revokedAt !== undefined;
                return (
                  <tr key={license.id}>
                    <td className="mono">{shortId(license.id, 26)}</td>
                    <td>{asset?.title ?? "?"}</td>
                    <td>
                      {revoked ? (
                        <span className="pill pill-fail">REVOKED</span>
                      ) : (
                        <span className="pill pill-pass">ACTIVE</span>
                      )}
                    </td>
                    <td>
                      {!revoked && (
                        <button
                          className="btn btn-danger btn-small"
                          type="button"
                          onClick={() => void revoke(license.id)}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2>Receipts ({state.receipts.length})</h2>
        {state.receipts.length === 0 ? (
          <p>No receipts yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.receipts.map((receipt) => (
                <tr key={receipt.id}>
                  <td className="mono">{shortId(receipt.id, 26)}</td>
                  <td>{formatDate(receipt.createdAt)}</td>
                  <td>
                    <button
                      className="btn btn-ghost btn-small"
                      type="button"
                      onClick={() =>
                        downloadJson(`${receipt.id}.json`, actions.makeReceiptBundle(receipt.id))
                      }
                    >
                      Download bundle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {state.revocations.length > 0 && (
        <section className="panel">
          <h2>Revocations ({state.revocations.length})</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Target</th>
                <th>Reason</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {state.revocations.map((revocation) => (
                <tr key={revocation.id}>
                  <td className="mono">{shortId(revocation.targetId, 26)}</td>
                  <td>{revocation.reason}</td>
                  <td>{formatDate(revocation.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="panel danger-zone">
        <h2>Danger zone</h2>
        <p>Deletes all demo records and the demo issuer key from this browser, then reloads.</p>
        <button
          className="btn btn-danger"
          type="button"
          onClick={() => {
            if (window.confirm("Delete all demo data in this browser?")) actions.resetDemo();
          }}
        >
          Reset demo data
        </button>
      </section>
    </>
  );
}
