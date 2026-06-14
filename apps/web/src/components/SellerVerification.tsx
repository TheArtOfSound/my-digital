import type { Creator } from "@my-digital/types";
import { useState, type FormEvent } from "react";
import { useMarketplace } from "../lib/marketplace";

/**
 * Seller self-verification. The "Verified" badge is granted automatically from
 * two objective signals — identity details provided here AND payouts connected —
 * so the badge never implies more than we actually checked. A higher "Reviewed"
 * tier is granted by a manual Imagine Qira review.
 */
export function SellerVerification({ creator }: { creator: Creator }) {
  const { actions } = useMarketplace();
  const [legalName, setLegalName] = useState(creator.legalName ?? "");
  const [location, setLocation] = useState(creator.location ?? "");
  const [links, setLinks] = useState((creator.verificationLinks ?? []).join("\n"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const identityComplete = Boolean(creator.legalName && creator.location);
  const payoutsConnected = creator.payoutsEnabled === true;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await actions.submitVerification({
        legalName,
        location,
        links: links
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      });
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>Verification — earn the Verified badge</h2>
      <p>
        Show buyers who you are. The <strong>Verified</strong> badge is granted automatically the
        moment you have <em>both</em> added the identity details below and connected payouts above —
        no waiting on a review. We label it honestly: it means exactly those two things.
      </p>
      <dl className="kv">
        <div>
          <dt>Current status</dt>
          <dd>
            {creator.verificationStatus === "reviewed" ? (
              <span className="pill pill-pass">REVIEWED BY IMAGINE QIRA</span>
            ) : creator.verificationStatus === "verified" ? (
              <span className="pill pill-pass">VERIFIED</span>
            ) : (
              <span className="pill pill-demo">NOT VERIFIED YET</span>
            )}
          </dd>
        </div>
        <div>
          <dt>1 · Identity details</dt>
          <dd>
            {identityComplete ? (
              <span className="pill pill-pass">PROVIDED</span>
            ) : (
              <span className="pill pill-warning">NEEDED</span>
            )}
          </dd>
        </div>
        <div>
          <dt>2 · Payouts connected</dt>
          <dd>
            {payoutsConnected ? (
              <span className="pill pill-pass">YES</span>
            ) : (
              <span className="pill pill-warning">NOT YET</span>
            )}
          </dd>
        </div>
      </dl>
      <form className="form" onSubmit={onSubmit}>
        <label className="field">
          Legal or business name
          <input
            value={legalName}
            onChange={(event) => setLegalName(event.target.value)}
            maxLength={120}
            placeholder="Jane A. Maker  /  Maker Studio LLC"
            required
          />
        </label>
        <label className="field">
          Location
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            maxLength={120}
            placeholder="City, Country"
            required
          />
        </label>
        <label className="field">
          Verification links (one per line, optional)
          <textarea
            rows={3}
            value={links}
            onChange={(event) => setLinks(event.target.value)}
            placeholder={"https://your-site.com\nhttps://github.com/you\nhttps://www.linkedin.com/in/you"}
          />
        </label>
        {error && <p className="panel-error">{error}</p>}
        {saved && (
          <p className="hint">
            Saved.{" "}
            {payoutsConnected
              ? "Your Verified badge is active."
              : "Connect payouts above to activate your Verified badge."}
          </p>
        )}
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? "Saving…" : "Save verification details"}
        </button>
      </form>
    </section>
  );
}
