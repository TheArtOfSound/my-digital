import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PaidOutcomePanel } from "../components/PaidOutcomePanel";
import { useMarketplace, type CheckoutResult } from "../lib/marketplace";

/**
 * Return page from the hosted payment provider. Stripe redirects here with
 * ?session_id=<providerReference>; completion confirms the payment (poll or
 * already-settled webhook) and fulfills: license, one-time code, vault.
 */
export function CheckoutDonePage() {
  const { actions } = useMarketplace();
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ran = useRef(false);

  async function complete() {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await actions.completeCheckout({ providerReference: sessionId }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void complete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!sessionId) {
    return (
      <section className="panel">
        <h2>Missing payment session</h2>
        <p>
          This page expects to be reached from the payment provider.{" "}
          <Link to="/">Back to listings</Link>.
        </p>
      </section>
    );
  }

  if (result && result.outcome === "paid") {
    return <PaidOutcomePanel outcome={result} />;
  }

  if (result && result.outcome === "failed") {
    return (
      <section className="panel panel-error-block">
        <h2>Payment not completed</h2>
        <p>
          The payment provider reported this checkout as failed or expired. Purchase{" "}
          <span className="mono">{result.purchase.id}</span> was recorded with status{" "}
          <strong>{result.purchase.status}</strong>. Nothing was issued and no charge stands.
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary" to="/">
            Back to listings
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Finalizing your purchase</h2>
      {busy && <p>Confirming payment and minting your license and vault…</p>}
      {error && (
        <>
          <p className="panel-error">{error}</p>
          <p>
            If you completed payment moments ago, the confirmation may still be settling. If this
            purchase was already fulfilled, your unlock code was shown once at fulfillment and
            cannot be retrieved again — your vault and receipt remain available in{" "}
            <Link to="/library">your library</Link>.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void complete()}>
              Try again
            </button>
            <Link className="btn btn-ghost" to="/library">
              Open my library
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
