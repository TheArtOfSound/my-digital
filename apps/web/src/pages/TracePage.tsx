import type { TraceEvidenceLevel, TraceResult } from "@my-digital/types";
import { useState, type FormEvent } from "react";
import { formatDate, shortHash, shortId } from "../lib/format";
import { useMarketplace } from "../lib/marketplace";

const EVIDENCE_LABELS: Record<TraceEvidenceLevel, { label: string; pill: string }> = {
  "exact-vault-match": { label: "EXACT VAULT MATCH", pill: "pill-fail" },
  "plaintext-content-match": { label: "CONTENT MATCH — NO ATTRIBUTION", pill: "pill-warning" },
  "vault-format-unattributed": { label: "VAULT FORMAT — UNATTRIBUTED", pill: "pill-unknown" },
  "no-evidence": { label: "NO EVIDENCE", pill: "pill-unknown" }
};

export function TracePage() {
  const { actions } = useMarketplace();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TraceResult | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      if (!file) throw new Error("Choose a file to trace.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      setResult(await actions.traceArtifact(bytes));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  const evidence = result ? EVIDENCE_LABELS[result.evidenceLevel] : null;

  return (
    <>
      <section className="panel">
        <h2>Trace a suspected leak</h2>
        <p>
          Every purchase mints a unique buyer vault with the license sealed inside, so a re-shared
          vault is attributable by exact hash match. Results report honest evidence levels only —
          plaintext copies carry no buyer marking and say so plainly.
        </p>
        <form className="form" onSubmit={onSubmit}>
          <label className="field">
            Suspected leaked file
            <input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
          {error && <p className="panel-error">{error}</p>}
          <button className="btn btn-primary" disabled={busy} type="submit">
            {busy ? "Tracing…" : "Trace artifact"}
          </button>
        </form>
      </section>

      {result && evidence && (
        <section
          className={`panel ${
            result.evidenceLevel === "exact-vault-match" ? "panel-error-block" : ""
          }`}
        >
          <header className="verify-head">
            <h2>Trace result</h2>
            <span className={`pill ${evidence.pill}`}>{evidence.label}</span>
          </header>
          <p>{result.explanation}</p>
          <dl className="kv">
            <div>
              <dt>Artifact SHA-256</dt>
              <dd className="mono">{shortHash(result.artifactSha256, 40)}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>{result.artifactByteSize} bytes</dd>
            </div>
            <div>
              <dt>Checked</dt>
              <dd>{formatDate(result.checkedAt)}</dd>
            </div>
            {result.match?.licenseId && (
              <div>
                <dt>Matched license</dt>
                <dd className="mono">
                  {result.match.licenseId}
                  {result.match.licenseRevoked === true ? " (revoked)" : ""}
                </dd>
              </div>
            )}
            {result.match?.buyerIdHash && (
              <div>
                <dt>Buyer id hash</dt>
                <dd className="mono">{shortHash(result.match.buyerIdHash, 32)}</dd>
              </div>
            )}
            {result.match?.assetVersionId && (
              <div>
                <dt>Asset version</dt>
                <dd className="mono">{shortId(result.match.assetVersionId, 40)}</dd>
              </div>
            )}
            {result.match?.fingerprintId && (
              <div>
                <dt>Fingerprint record</dt>
                <dd className="mono">{shortId(result.match.fingerprintId, 40)}</dd>
              </div>
            )}
          </dl>
          <div className="assumptions">
            <h4>Caveats</h4>
            <ul>
              {result.caveats.map((caveat) => (
                <li key={caveat}>{caveat}</li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
