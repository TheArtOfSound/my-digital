import type { LicenseId } from "@my-digital/types";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { VerificationResultView } from "../components/VerificationResultView";
import { downloadBytes } from "../lib/format";
import {
  useMarketplace,
  type LocalVaultUnlockOutcome,
  type UnlockOutcome
} from "../lib/marketplace";

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

  const [vaultFile, setVaultFile] = useState<File | null>(null);
  const [fileCode, setFileCode] = useState("");
  const [fileBusy, setFileBusy] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileOutcome, setFileOutcome] = useState<LocalVaultUnlockOutcome | null>(null);

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

  async function onFileSubmit(event: FormEvent) {
    event.preventDefault();
    setFileBusy(true);
    setFileError(null);
    setFileOutcome(null);
    try {
      if (!vaultFile) throw new Error("Choose a vault file.");
      const bytes = new Uint8Array(await vaultFile.arrayBuffer());
      const result = await actions.unlockVaultBytes({ bytes, rawCode: fileCode.trim() });
      setFileOutcome(result);
    } catch (cause) {
      setFileError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setFileBusy(false);
    }
  }

  return (
    <>
      <section className="panel">
        <h2>Unlock a purchased product</h2>
        <p>
          Decryption runs locally in this browser — Argon2id and XChaCha20-Poly1305 via libsodium.
          Your unlock code and the decrypted file never leave this page; the server only delivers
          the encrypted vault. License verification (Ed25519) also runs here, against the issuer
          public key.
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
              {busy ? "Deriving key and decrypting…" : "Verify and unlock locally"}
            </button>
          </form>
        )}
      </section>

      {outcome && (
        <>
          {outcome.plaintext ? (
            <section className="panel panel-success">
              <h2>Unlocked locally</h2>
              <p>
                {outcome.fileName} · {outcome.mimeType} · {outcome.plaintext.byteLength} bytes —
                decrypted in this browser; nothing was sent to the server.
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
                Verification failed, so no plaintext was produced. The structured results below
                state exactly which check failed.
              </p>
            </section>
          )}
          <section className="panel">
            <h2>Verification results</h2>
            <div className="verify-stack">
              <VerificationResultView title="Buyer license (verified in this browser)" result={outcome.verifications.license} />
              {outcome.verifications.unlock && (
                <VerificationResultView title="Vault unlock (QEV Vault V2, local)" result={outcome.verifications.unlock} />
              )}
            </div>
          </section>
        </>
      )}

      <section className="panel">
        <h2>Unlock from a vault file</h2>
        <p>
          Fully offline path: pick a downloaded <span className="mono">.vault.json</span> file and
          enter the code. No marketplace records are involved — the vault and credential carry
          everything needed.
        </p>
        <form className="form" onSubmit={onFileSubmit}>
          <label className="field">
            Vault file
            <input
              type="file"
              accept=".json,application/json"
              onChange={(event) => setVaultFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <label className="field">
            Unlock code
            <input
              className="mono"
              value={fileCode}
              onChange={(event) => setFileCode(event.target.value)}
              placeholder="UNLK-XXXX-XXXX-XXXX-XXXX"
              required
            />
          </label>
          {fileError && <p className="panel-error">{fileError}</p>}
          <button className="btn btn-primary" disabled={fileBusy} type="submit">
            {fileBusy ? "Deriving key and decrypting…" : "Unlock file locally"}
          </button>
        </form>
        {fileOutcome && (
          <>
            {fileOutcome.plaintext && (
              <p className="hint">
                Decrypted {fileOutcome.plaintext.byteLength} bytes.{" "}
                <button
                  className="btn btn-ghost btn-small"
                  type="button"
                  onClick={() =>
                    fileOutcome.plaintext &&
                    downloadBytes("unlocked-file", "application/octet-stream", fileOutcome.plaintext)
                  }
                >
                  Download
                </button>
              </p>
            )}
            <VerificationResultView title="Vault unlock (local file)" result={fileOutcome.verification} />
          </>
        )}
      </section>
    </>
  );
}
