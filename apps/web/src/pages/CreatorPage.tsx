import type { LicenseId } from "@my-digital/types";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CreatorListingsManager } from "../components/CreatorListingsManager";
import { CreatorPayouts } from "../components/CreatorPayouts";
import { CreatorProfileEditor } from "../components/CreatorProfileEditor";
import { CreatorSetup } from "../components/CreatorSetup";
import { copyToClipboard, downloadJson, formatDate, formatPrice, shortHash, shortId } from "../lib/format";
import { useMarketplace } from "../lib/marketplace";

export function CreatorPage() {
  const { state, actions, hasAdminToken } = useMarketplace();
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [payoutNotice, setPayoutNotice] = useState<string | null>(null);

  // When Stripe redirects back from onboarding (?payouts=return|refresh),
  // re-check status automatically so the creator isn't left on a stale panel.
  useEffect(() => {
    const flow = searchParams.get("payouts");
    if (flow !== "return" && flow !== "refresh") return;
    const next = new URLSearchParams(searchParams);
    next.delete("payouts");
    setSearchParams(next, { replace: true });
    setPayoutNotice("Checking your payout status with Stripe…");
    void actions
      .refreshPayoutStatus()
      .then((status) =>
        setPayoutNotice(
          status.payoutsEnabled
            ? "Payouts connected — buyers now pay you directly."
            : "Stripe onboarding isn't finished yet. Use “Continue payout setup” below to complete it."
        )
      )
      .catch((cause) => setPayoutNotice(cause instanceof Error ? cause.message : String(cause)));
  }, [searchParams, setSearchParams, actions]);

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
      {payoutNotice && (
        <section className="panel">
          <div className="notice">{payoutNotice}</div>
        </section>
      )}
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
          The issuer's Ed25519 private key lives on the API server, sealed under the server master
          key — it is never stored in plaintext and never sent to this browser. Custody secrets for
          locked assets are sealed the same way.
        </div>
        {error && <p className="panel-error">{error}</p>}
      </section>

      <section className="panel">
        <h2>Management access</h2>
        <p>
          Editing your profile, managing listings, and connecting payouts require the management
          token (the server&rsquo;s admin token). It is stored only in this browser and sent as a
          bearer header on management requests. Buyers never need it.
        </p>
        {hasAdminToken ? (
          <div className="hero-actions">
            <span className="pill pill-pass">MANAGEMENT ENABLED</span>
            <button
              className="btn btn-ghost btn-small"
              type="button"
              onClick={() => actions.setAdminToken(undefined)}
            >
              Clear token
            </button>
          </div>
        ) : (
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault();
              actions.setAdminToken(tokenInput);
              setTokenInput("");
            }}
          >
            <label className="field">
              Management token
              <input
                type="password"
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
                placeholder="paste the admin token"
                autoComplete="off"
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={tokenInput.trim().length === 0}>
              Enable management
            </button>
          </form>
        )}
      </section>

      <CreatorPayouts creator={creator} />

      <CreatorProfileEditor creator={creator} />

      <CreatorListingsManager />

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
                      onClick={() => {
                        void actions
                          .getReceiptBundle(receipt.id)
                          .then((bundle) => downloadJson(`${receipt.id}.json`, bundle))
                          .catch((cause) =>
                            setError(cause instanceof Error ? cause.message : String(cause))
                          );
                      }}
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
        <p>
          Deletes every record in the server database and bootstraps a fresh issuer key. Existing
          receipts and licenses will no longer verify against the new issuer.
        </p>
        <button
          className="btn btn-danger"
          type="button"
          onClick={() => {
            if (window.confirm("Delete all marketplace data on the server?")) {
              setError(null);
              void actions
                .resetDemo()
                .catch((cause) =>
                  setError(cause instanceof Error ? cause.message : String(cause))
                );
            }
          }}
        >
          Reset marketplace data
        </button>
      </section>
    </>
  );
}
