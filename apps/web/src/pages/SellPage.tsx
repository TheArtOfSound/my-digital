import { demoPersonalLicenseTerms, utf8Bytes } from "@my-digital/core";
import type { LicenseTerms } from "@my-digital/types";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { BecomeSeller } from "../components/BecomeSeller";
import { shortHash } from "../lib/format";
import { useAuth } from "../lib/auth";
import { useMarketplace, type CreateLockedListingResult } from "../lib/marketplace";

const CATEGORIES = [
  "ai-prompt-pack",
  "research-pdf",
  "code-template",
  "sample-pack",
  "notion-template",
  "design-template",
  "other"
];

const TERM_FIELDS: Array<{ key: keyof Omit<LicenseTerms, "seatCount">; label: string }> = [
  { key: "personalUse", label: "Personal use" },
  { key: "commercialUse", label: "Commercial use" },
  { key: "clientWorkAllowed", label: "Client work" },
  { key: "redistributionAllowed", label: "Redistribution" },
  { key: "resaleAllowed", label: "Resale" },
  { key: "aiTrainingAllowed", label: "AI training" },
  { key: "attributionRequired", label: "Attribution required" }
];

const SAMPLE_CONTENT =
  "My Digital demo product.\n\nPrompt 1: Summarize a contract into plain language.\nPrompt 2: Draft a release note from a changelog.\nPrompt 3: Turn meeting notes into action items.\n";

export function SellPage() {
  const { actions } = useMarketplace();
  const { isSeller } = useAuth();
  const [title, setTitle] = useState("Demo Prompt Pack");
  const [description, setDescription] = useState("Ten working prompts for everyday tasks.");
  const [category, setCategory] = useState(CATEGORIES[0] ?? "other");
  const [priceDollars, setPriceDollars] = useState("19.00");
  const [terms, setTerms] = useState<LicenseTerms>(demoPersonalLicenseTerms);
  const [content, setContent] = useState(SAMPLE_CONTENT);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateLockedListingResult | null>(null);

  if (!isSeller) {
    return (
      <>
        <section className="panel">
          <h2>Sell a locked digital product</h2>
          <p>Open your seller account to lock a file into a QEV asset and list it for sale.</p>
        </section>
        <BecomeSeller />
      </>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const priceAmount = Math.round(Number.parseFloat(priceDollars) * 100);
      if (!Number.isFinite(priceAmount) || priceAmount < 0) {
        throw new Error("Enter a valid price.");
      }
      let bytes: Uint8Array;
      let fileName: string;
      let mimeType: string;
      if (file) {
        bytes = new Uint8Array(await file.arrayBuffer());
        fileName = file.name;
        mimeType = file.type || "application/octet-stream";
      } else {
        bytes = utf8Bytes(content);
        fileName = "demo-content.txt";
        mimeType = "text/plain";
      }
      const created = await actions.createLockedListing({
        title,
        description,
        category,
        priceAmount,
        priceCurrency: "USD",
        licenseTerms: terms,
        fileName,
        mimeType,
        bytes
      });
      setResult(created);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="panel">
        <h2>Sell a locked digital product</h2>
        <p>
          The file is hashed (SHA-256), described in a manifest, and locked server-side into a real{" "}
          <strong>QEV Vault V2</strong> envelope (Argon2id + XChaCha20-Poly1305). The custody secret
          is sealed under the server master key before it touches the database.
        </p>
        <form className="form" onSubmit={onSubmit}>
          <label className="field">
            Title
            <input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>
          <label className="field">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              required
            />
          </label>
          <div className="field-row">
            <label className="field">
              Category
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {CATEGORIES.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Price (USD)
              <input
                type="number"
                min="0"
                step="0.01"
                value={priceDollars}
                onChange={(event) => setPriceDollars(event.target.value)}
                required
              />
            </label>
            <label className="field">
              License seats
              <input
                type="number"
                min="1"
                step="1"
                value={terms.seatCount}
                onChange={(event) =>
                  setTerms({ ...terms, seatCount: Math.max(1, Number(event.target.value) || 1) })
                }
              />
            </label>
          </div>
          <fieldset className="field">
            <legend>License terms (machine-readable)</legend>
            <div className="checks">
              {TERM_FIELDS.map(({ key, label }) => (
                <label className="check" key={key}>
                  <input
                    type="checkbox"
                    checked={terms[key]}
                    onChange={(event) => setTerms({ ...terms, [key]: event.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="field">
            Product content (text)
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={5}
              disabled={file !== null}
            />
          </label>
          <label className="field">
            Or choose a file (max 1 MB in this instance)
            <input
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          {file && (
            <p className="hint">
              Using {file.name} ({Math.ceil(file.size / 1024)} KB).{" "}
              <button className="btn btn-ghost btn-small" type="button" onClick={() => setFile(null)}>
                Use text content instead
              </button>
            </p>
          )}
          {error && <p className="panel-error">{error}</p>}
          <button className="btn btn-primary" disabled={busy} type="submit">
            {busy ? "Locking…" : "Lock asset and create listing"}
          </button>
        </form>
      </section>

      {result && (
        <section className="panel panel-success">
          <h2>Locked and listed</h2>
          <dl className="kv">
            <div>
              <dt>Asset</dt>
              <dd className="mono">{result.asset.id}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd className="mono">{result.assetVersion.id}</dd>
            </div>
            <div>
              <dt>Content hash (SHA-256, real)</dt>
              <dd className="mono">{shortHash(result.assetVersion.contentHash, 32)}</dd>
            </div>
            <div>
              <dt>Manifest hash (SHA-256, real)</dt>
              <dd className="mono">{shortHash(result.assetVersion.manifestHash, 32)}</dd>
            </div>
            <div>
              <dt>Locked asset</dt>
              <dd className="mono">
                {result.lockedAsset.id} · {result.lockedAsset.envelopeFormat}
              </dd>
            </div>
          </dl>
          <div className="hero-actions">
            <Link className="btn btn-primary" to={`/listing/${result.listing.id}`}>
              View listing
            </Link>
            <Link className="btn btn-ghost" to="/creator">
              Creator dashboard
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
