import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { downloadBytes, downloadJson, formatDate, formatPrice, shortId } from "../lib/format";
import type { BuyerLibrary } from "../lib/api";
import { useMarketplace } from "../lib/marketplace";

export function LibraryPage() {
  const { state, actions } = useMarketplace();
  const [email, setEmail] = useState("buyer@example.com");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [library, setLibrary] = useState<BuyerLibrary | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setLibrary(null);
    try {
      setLibrary(await actions.fetchLibraryByEmail(email));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="panel">
        <h2>Buyer library</h2>
        <p>
          Look up your purchases by email. The email is hashed in this browser — only the hash is
          sent. This lookup is a dev convenience, not authentication; real buyer accounts arrive
          with production auth.
        </p>
        <form className="form" onSubmit={onSubmit}>
          <label className="field">
            Email used at checkout
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          {error && <p className="panel-error">{error}</p>}
          <button className="btn btn-primary" disabled={busy} type="submit">
            {busy ? "Looking up…" : "Open my library"}
          </button>
        </form>
      </section>

      {library && (
        <section className="panel">
          <h2>Purchases ({library.purchases.length})</h2>
          {library.licenses.length === 0 ? (
            <p>No paid purchases for this email yet.</p>
          ) : (
            <div className="verify-stack">
              {library.licenses.map((license) => {
                const asset = state.assets.find((entry) => entry.id === license.assetId);
                const receipt = library.receipts.find(
                  (entry) => entry.licenseId === license.id
                );
                const purchase = library.purchases.find(
                  (entry) => entry.id === license.purchaseId
                );
                const revoked = license.revokedAt !== undefined;
                return (
                  <article className="verify-card" key={license.id}>
                    <header className="verify-head">
                      <h3>{asset?.title ?? "Unknown asset"}</h3>
                      <span className={`pill ${revoked ? "pill-fail" : "pill-pass"}`}>
                        {revoked ? "REVOKED" : "ACTIVE"}
                      </span>
                    </header>
                    <p className="verify-meta">
                      license {shortId(license.id, 30)} · issued {formatDate(license.issuedAt)}
                      {purchase
                        ? ` · paid ${formatPrice(purchase.amountPaid, purchase.currency)}`
                        : ""}
                    </p>
                    <div className="hero-actions">
                      <button
                        className="btn btn-ghost btn-small"
                        type="button"
                        onClick={() => {
                          void actions
                            .fetchBuyerVault(license.id)
                            .then((bytes) =>
                              downloadBytes(`${license.id}.vault.json`, "application/json", bytes)
                            )
                            .catch((cause) =>
                              setError(cause instanceof Error ? cause.message : String(cause))
                            );
                        }}
                      >
                        Download vault
                      </button>
                      {receipt && (
                        <button
                          className="btn btn-ghost btn-small"
                          type="button"
                          onClick={() => {
                            void actions
                              .getReceiptBundle(receipt.id)
                              .then((bundle) => downloadJson(`${receipt.id}.json`, bundle))
                              .catch((cause) =>
                                setError(cause instanceof Error ? cause.message : String(cause))
                              );
                          }}
                        >
                          Receipt bundle
                        </button>
                      )}
                      <Link className="btn btn-primary btn-small" to="/unlock">
                        Unlock
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </>
  );
}
