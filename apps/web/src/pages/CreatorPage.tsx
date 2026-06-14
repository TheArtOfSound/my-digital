import type { LicenseId } from "@my-digital/types";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BecomeSeller } from "../components/BecomeSeller";
import { CreatorListingsManager } from "../components/CreatorListingsManager";
import { CreatorPayouts } from "../components/CreatorPayouts";
import { CreatorProfileEditor } from "../components/CreatorProfileEditor";
import { VerifiedBadge } from "../components/VerifiedBadge";
import type { SellerDashboard } from "../lib/api";
import { useAuth } from "../lib/auth";
import { downloadJson, formatDate, formatPrice, shortId } from "../lib/format";
import { useMarketplace } from "../lib/marketplace";

export function CreatorPage() {
  const { actions, state } = useMarketplace();
  const { user, isSeller, status: authStatus } = useAuth();
  const [dashboard, setDashboard] = useState<SellerDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [payoutNotice, setPayoutNotice] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setDashboard(await actions.loadSellerDashboard());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [actions]);

  // Reload the dashboard on mount and whenever marketplace state changes (every
  // mutation calls refresh(), so edits/sales show up without a manual reload).
  useEffect(() => {
    if (isSeller) void loadDashboard();
  }, [isSeller, state, loadDashboard]);

  // When Stripe redirects back from onboarding (?payouts=return|refresh),
  // re-check status automatically so the seller isn't left on a stale panel.
  useEffect(() => {
    const flow = searchParams.get("payouts");
    if (flow !== "return" && flow !== "refresh") return;
    const next = new URLSearchParams(searchParams);
    next.delete("payouts");
    setSearchParams(next, { replace: true });
    setPayoutNotice("Checking your payout status with Stripe…");
    void actions
      .refreshPayoutStatus()
      .then((s) =>
        setPayoutNotice(
          s.payoutsEnabled
            ? "Payouts connected — buyers now pay you directly."
            : "Stripe onboarding isn't finished yet. Use “Continue payout setup” below to complete it."
        )
      )
      .catch((cause) => setPayoutNotice(cause instanceof Error ? cause.message : String(cause)));
  }, [searchParams, setSearchParams, actions]);

  if (authStatus === "loading") {
    return (
      <section className="panel">
        <p>Loading your account…</p>
      </section>
    );
  }

  // Logged out, or logged in without a seller profile yet.
  if (!isSeller) {
    return (
      <>
        <section className="hero hero-compact">
          <p className="eyebrow">Seller dashboard</p>
          <h1 className="listing-title">Sell digital products that come with proof</h1>
          <p className="subhead">
            List locked products, issue verifiable licenses and receipts, and get paid directly to
            your own Stripe account.
          </p>
        </section>
        <BecomeSeller />
      </>
    );
  }

  const creator = dashboard?.creator;

  async function revoke(licenseId: LicenseId) {
    if (!window.confirm("Revoke this license? Unlock and verification will fail afterwards.")) {
      return;
    }
    setError(null);
    try {
      await actions.revokeLicense(licenseId, "Revoked by the seller from the dashboard.");
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

      <section className="hero hero-compact">
        <p className="eyebrow">Seller dashboard</p>
        <h1 className="listing-title">
          {creator?.displayName ?? user?.displayName}
          {creator && <VerifiedBadge creator={creator} />}
        </h1>
        <p className="subhead">
          {creator ? <>@{creator.handle}</> : "Loading…"} · Signed in as {user?.email}
        </p>
        {error && <p className="panel-error">{error}</p>}
      </section>

      {creator && (
        <>
          <CreatorPayouts creator={creator} />
          <CreatorProfileEditor creator={creator} />
        </>
      )}

      <CreatorListingsManager listings={dashboard?.listings ?? []} />

      <section className="panel">
        <h2>Sales ({dashboard?.purchases.length ?? 0})</h2>
        {!dashboard || dashboard.purchases.length === 0 ? (
          <p>No sales yet. When a buyer purchases one of your listings it appears here.</p>
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
              {dashboard.purchases.map((purchase) => (
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
        <h2>Licenses issued ({dashboard?.licenses.length ?? 0})</h2>
        {!dashboard || dashboard.licenses.length === 0 ? (
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
              {dashboard.licenses.map((license) => {
                const asset = dashboard.assets.find((entry) => entry.id === license.assetId);
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

      {dashboard && dashboard.receipts.length > 0 && (
        <section className="panel">
          <h2>Receipts ({dashboard.receipts.length})</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {dashboard.receipts.map((receipt) => (
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
        </section>
      )}
    </>
  );
}
