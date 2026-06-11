import type { LicenseId } from "@my-digital/types";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { VerificationResultView } from "../components/VerificationResultView";
import { downloadBytes } from "../lib/format";
import { useMarketplace, type UnlockOutcome } from "../lib/marketplace";

function plaintextPreview(bytes: Uint8Array, mimeType: string): string | null {
  if (!mimeType.startsWith("text/")) return null;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return text.length > 600 ? `${text.slice(0, 600)}…` : text;
  } catch {
    return null;
  }
}

export function UnlockPage() {
  const { state, actions } = useMarketplace();
  const [licenseId, setLicenseId] = useState("");
  const [rawCode, setRawCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<UnlockOutcome | null>(null);

  const licenseOptions = state.licenses.map((license) => {
    const asset = state.assets.find((entry) => entry.id === license.assetId);
    return {
      id: license.id,
      label: `${asset?.title ?? "Unknown asset"} — ${license.id}${
        license.revokedAt !== undefined ? " (revoked)" : ""
      }`
    };
  });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setOutcome(null);
    try {
      if (licenseId === "") throw new Error("Select a license.");
      const result = await actions.unlockWithCode({
        licenseId: licenseId as LicenseId,
        rawCode: rawCode.trim()
      });
      setOutcome(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="panel">
        <h2>Unlock a purchased product</h2>
        <p>
          Unlock runs three checks first — license signature and bindings, unlock code hash, and
          locked payload integrity. If any check fails, no plaintext is returned. Decrypted output
          is never persisted by the demo.
        </p>
        {licenseOptions.length === 0 ? (
          <p>
            No licenses exist yet. <Link to="/">Buy a listing</Link> to receive a license and
            unlock code.
          </p>
        ) : (
          <form className="form" onSubmit={onSubmit}>
            <label className="field">
              License
              <select value={licenseId} onChange={(event) => setLicenseId(event.target.value)}>
                <option value="">Select a license…</option>
                {licenseOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Unlock code (shown once at checkout)
              <input
                className="mono"
                value={rawCode}
                onChange={(event) => setRawCode(event.target.value)}
                placeholder="UNLK-XXXX-XXXX-XXXX-XXXX"
                required
              />
            </label>
            {error && <p className="panel-error">{error}</p>}
            <button className="btn btn-primary" disabled={busy} type="submit">
              {busy ? "Verifying…" : "Verify and unlock"}
            </button>
          </form>
        )}
      </section>

      {outcome && (
        <>
          {outcome.plaintext ? (
            <section className="panel panel-success">
              <h2>Unlocked</h2>
              <p>
                {outcome.fileName} · {outcome.mimeType} · {outcome.plaintext.byteLength} bytes —
                matches the purchased asset version.
              </p>
              {(() => {
                const preview = plaintextPreview(outcome.plaintext, outcome.mimeType);
                return preview ? <pre className="code">{preview}</pre> : null;
              })()}
              <button
                className="btn btn-primary"
                type="button"
                onClick={() =>
                  outcome.plaintext &&
                  downloadBytes(outcome.fileName, outcome.mimeType, outcome.plaintext)
                }
              >
                Download unlocked file
              </button>
            </section>
          ) : (
            <section className="panel panel-error-block">
              <h2>Unlock blocked</h2>
              <p>
                Verification failed, so no plaintext was returned. The structured results below
                state exactly which check failed.
              </p>
            </section>
          )}
          <section className="panel">
            <h2>Verification results</h2>
            <div className="verify-stack">
              <VerificationResultView title="Buyer license" result={outcome.verifications.license} />
              <VerificationResultView title="Unlock code" result={outcome.verifications.unlockCode} />
              <VerificationResultView title="Locked envelope" result={outcome.verifications.envelope} />
              {outcome.verifications.unlock && (
                <VerificationResultView title="Unlock operation" result={outcome.verifications.unlock} />
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
