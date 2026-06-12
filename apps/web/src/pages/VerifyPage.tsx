import type {
  LicenseId,
  LockedAssetId,
  ProofReceiptId,
  VerificationResult
} from "@my-digital/types";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { VerificationResultView } from "../components/VerificationResultView";
import {
  useMarketplace,
  type LockedAssetVerification,
  type PastedReceiptVerification
} from "../lib/marketplace";

function useAsyncVerify() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run<T>(task: () => Promise<T>, onDone: (value: T) => void): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      onDone(await task());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}

export function VerifyPage() {
  const { state, actions } = useMarketplace();
  const { receiptId: receiptIdParam } = useParams<{ receiptId: string }>();

  const [receiptId, setReceiptId] = useState("");
  const [receiptResult, setReceiptResult] = useState<VerificationResult | null>(null);
  const receiptVerify = useAsyncVerify();
  const deepLinkRan = useRef(false);
  const deepLinkKnown =
    receiptIdParam === undefined || state.receipts.some((entry) => entry.id === receiptIdParam);

  // Deep link: /verify/<receiptId> is the URL printed on receipts.
  useEffect(() => {
    if (receiptIdParam === undefined || deepLinkRan.current || !deepLinkKnown) return;
    deepLinkRan.current = true;
    setReceiptId(receiptIdParam);
    void actions
      .verifyReceiptRecord(receiptIdParam as ProofReceiptId)
      .then(setReceiptResult)
      .catch(() => {
        // Surfaced through the regular controls if retried manually.
      });
  }, [receiptIdParam, deepLinkKnown, actions]);

  const [pastedText, setPastedText] = useState("");
  const [pastedResult, setPastedResult] = useState<PastedReceiptVerification | null>(null);
  const pastedVerify = useAsyncVerify();

  const [licenseId, setLicenseId] = useState("");
  const [licenseResult, setLicenseResult] = useState<VerificationResult | null>(null);
  const licenseVerify = useAsyncVerify();

  const [lockedAssetId, setLockedAssetId] = useState("");
  const [simulateTamper, setSimulateTamper] = useState(false);
  const [envelopeResult, setEnvelopeResult] = useState<LockedAssetVerification | null>(null);
  const envelopeVerify = useAsyncVerify();

  const lockedAssetOptions = state.lockedAssets.map((lockedAsset) => {
    const version = state.assetVersions.find((entry) => entry.id === lockedAsset.assetVersionId);
    const asset = version
      ? state.assets.find((entry) => entry.id === version.assetId)
      : undefined;
    return {
      id: lockedAsset.id,
      label: `${asset?.title ?? "Unknown asset"} — ${version?.fileName ?? "?"} — ${lockedAsset.id}`
    };
  });

  return (
    <>
      <section className="panel">
        <h2>Verify</h2>
        <p>
          Every verification returns a structured result: what passed, what failed, what was not
          checked, and what is assumed. A bare “valid” badge is not trustworthy output.
        </p>
        {receiptIdParam !== undefined && !deepLinkKnown && (
          <p className="panel-error">
            Receipt <span className="mono">{receiptIdParam}</span> is not in this instance's
            records. If the receipt came from elsewhere, paste its bundle below — verification
            works from the bundle alone.
          </p>
        )}
      </section>

      <section className="panel">
        <h2>Proof receipt (stored)</h2>
        {state.receipts.length === 0 ? (
          <p>No receipts in this browser yet.</p>
        ) : (
          <div className="form">
            <label className="field">
              Receipt
              <select value={receiptId} onChange={(event) => setReceiptId(event.target.value)}>
                <option value="">Select a receipt…</option>
                {state.receipts.map((receipt) => (
                  <option key={receipt.id} value={receipt.id}>
                    {receipt.id}
                  </option>
                ))}
              </select>
            </label>
            {receiptVerify.error && <p className="panel-error">{receiptVerify.error}</p>}
            <button
              className="btn btn-primary"
              disabled={receiptVerify.busy || receiptId === ""}
              type="button"
              onClick={() =>
                void receiptVerify.run(
                  () => actions.verifyReceiptRecord(receiptId as ProofReceiptId),
                  setReceiptResult
                )
              }
            >
              Verify receipt
            </button>
          </div>
        )}
        {receiptResult && <VerificationResultView title="Proof receipt" result={receiptResult} />}
      </section>

      <section className="panel">
        <h2>Proof receipt (pasted)</h2>
        <p>
          Paste a downloaded receipt bundle or a bare receipt JSON. A bundle carries its issuer
          public key; trust that key only if you trust where the bundle came from.
        </p>
        <div className="form">
          <label className="field">
            Receipt JSON
            <textarea
              className="mono"
              rows={5}
              value={pastedText}
              onChange={(event) => setPastedText(event.target.value)}
              placeholder='{"kind":"MYDIGITAL-RECEIPT-BUNDLE-V1", …}'
            />
          </label>
          {pastedVerify.error && <p className="panel-error">{pastedVerify.error}</p>}
          <button
            className="btn btn-primary"
            disabled={pastedVerify.busy || pastedText.trim() === ""}
            type="button"
            onClick={() =>
              void pastedVerify.run(() => actions.verifyPastedReceipt(pastedText), setPastedResult)
            }
          >
            Verify pasted receipt
          </button>
        </div>
        {pastedResult && (
          <>
            <p className="hint">
              Issuer key source:{" "}
              {pastedResult.keySource === "pasted-bundle"
                ? "taken from the pasted bundle"
                : "this browser's demo issuer key"}
            </p>
            <VerificationResultView title="Pasted receipt" result={pastedResult.result} />
          </>
        )}
      </section>

      <section className="panel">
        <h2>Buyer license (verified by the API server)</h2>
        {state.licenses.length === 0 ? (
          <p>No licenses yet.</p>
        ) : (
          <div className="form">
            <label className="field">
              License
              <select value={licenseId} onChange={(event) => setLicenseId(event.target.value)}>
                <option value="">Select a license…</option>
                {state.licenses.map((license) => (
                  <option key={license.id} value={license.id}>
                    {license.id}
                    {license.revokedAt !== undefined ? " (revoked)" : ""}
                  </option>
                ))}
              </select>
            </label>
            {licenseVerify.error && <p className="panel-error">{licenseVerify.error}</p>}
            <button
              className="btn btn-primary"
              disabled={licenseVerify.busy || licenseId === ""}
              type="button"
              onClick={() =>
                void licenseVerify.run(
                  () => actions.verifyLicenseRecord(licenseId as LicenseId),
                  setLicenseResult
                )
              }
            >
              Verify license
            </button>
          </div>
        )}
        {licenseResult && <VerificationResultView title="Buyer license" result={licenseResult} />}
      </section>

      <section className="panel">
        <h2>Locked package integrity</h2>
        {lockedAssetOptions.length === 0 ? (
          <p>No locked assets in this browser yet.</p>
        ) : (
          <div className="form">
            <label className="field">
              Locked asset
              <select
                value={lockedAssetId}
                onChange={(event) => setLockedAssetId(event.target.value)}
              >
                <option value="">Select a locked asset…</option>
                {lockedAssetOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={simulateTamper}
                onChange={(event) => setSimulateTamper(event.target.checked)}
              />
              Simulate a tampered payload (flips one byte of an in-memory copy; the stored payload
              is unchanged)
            </label>
            {envelopeVerify.error && <p className="panel-error">{envelopeVerify.error}</p>}
            <button
              className="btn btn-primary"
              disabled={envelopeVerify.busy || lockedAssetId === ""}
              type="button"
              onClick={() =>
                void envelopeVerify.run(
                  () =>
                    actions.verifyLockedAsset(lockedAssetId as LockedAssetId, {
                      simulateTamper
                    }),
                  setEnvelopeResult
                )
              }
            >
              Verify locked package
            </button>
          </div>
        )}
        {envelopeResult && (
          <div className="verify-stack">
            <VerificationResultView
              title="Locked package integrity (recorded hashes)"
              result={envelopeResult.integrity}
            />
            <VerificationResultView
              title="Vault structure (BRY-NFET-SX-VAULT-V2)"
              result={envelopeResult.structure}
            />
          </div>
        )}
      </section>
    </>
  );
}
