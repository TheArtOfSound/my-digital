import type { Creator } from "@my-digital/types";
import { useState } from "react";
import { useMarketplace } from "../lib/marketplace";

/**
 * Direct-payout (Stripe Connect) controls. The creator connects their own
 * Stripe account; buyers then pay that account directly (the platform never
 * holds the funds). Onboarding happens on Stripe's hosted pages.
 */
export function CreatorPayouts({ creator }: { creator: Creator }) {
  const { connectEnabled, actions } = useMarketplace();
  const [busy, setBusy] = useState<null | "onboard" | "refresh">(null);
  const [error, setError] = useState<string | null>(null);

  const status: "enabled" | "pending" | "not-connected" = creator.payoutsEnabled
    ? "enabled"
    : creator.stripeAccountId
      ? "pending"
      : "not-connected";

  async function connect() {
    setError(null);
    setBusy("onboard");
    try {
      const { url } = await actions.startPayoutOnboarding();
      window.location.assign(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(null);
    }
  }

  async function refresh() {
    setError(null);
    setBusy("refresh");
    try {
      await actions.refreshPayoutStatus();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel">
      <h2>Payouts — get paid directly</h2>
      <p>
        Buyers pay <strong>your own Stripe account</strong> directly. My Digital never holds your
        money: with direct charges you are the merchant of record and funds settle to you, not to
        the platform. You complete bank and identity details on Stripe&rsquo;s own secure pages.
      </p>
      <dl className="kv">
        <div>
          <dt>Direct-payout mode</dt>
          <dd>
            {connectEnabled ? (
              <span className="pill pill-pass">ON</span>
            ) : (
              <span className="pill pill-demo">OFF — not enabled yet</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Your payout account</dt>
          <dd>
            {status === "enabled" ? (
              <span className="pill pill-pass">PAYOUTS ENABLED</span>
            ) : status === "pending" ? (
              <span className="pill pill-warning">ONBOARDING INCOMPLETE</span>
            ) : (
              <span className="pill pill-demo">NOT CONNECTED</span>
            )}
            {creator.stripeAccountId ? (
              <>
                {" "}
                · <span className="mono">{creator.stripeAccountId}</span>
              </>
            ) : null}
          </dd>
        </div>
      </dl>
      <div className="hero-actions">
        <button
          className="btn btn-primary"
          type="button"
          disabled={busy !== null}
          onClick={() => void connect()}
        >
          {busy === "onboard"
            ? "Opening Stripe…"
            : creator.stripeAccountId
              ? "Continue payout setup"
              : "Connect payouts with Stripe"}
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          disabled={busy !== null || !creator.stripeAccountId}
          onClick={() => void refresh()}
        >
          {busy === "refresh" ? "Checking…" : "Refresh status"}
        </button>
      </div>
      {error && <p className="panel-error">{error}</p>}
    </section>
  );
}
