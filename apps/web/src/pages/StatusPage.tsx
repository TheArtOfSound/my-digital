import { Link } from "react-router-dom";
import { LAUNCH_DATE, isLivePayments, paymentModeLabel } from "../lib/launch";
import { useMarketplace } from "../lib/marketplace";

interface StatusRow {
  capability: string;
  state: "Production" | "Simulated" | "Planned";
  detail: string;
}

export function StatusPage() {
  const { paymentsProvider, connectEnabled } = useMarketplace();
  const live = isLivePayments(paymentsProvider);

  const rows: StatusRow[] = [
    {
      capability: "Envelope locking (QEV Vault V2)",
      state: "Production",
      detail: "Real Argon2id + XChaCha20-Poly1305. BRY-NFET-SX-VAULT-V2, byte-compatible with the public CLI.",
    },
    {
      capability: "Buyer-specific licenses + receipts",
      state: "Production",
      detail: "Ed25519-signed over canonical JSON; verify online or offline.",
    },
    {
      capability: "Local-first unlock",
      state: "Production",
      detail: "Decryption runs in your browser. Access keys and files never reach the server after purchase.",
    },
    {
      capability: "Public verifier",
      state: "Production",
      detail: "Receipt, license, and package integrity checks at /verify, with structured results.",
    },
    {
      capability: "Leak tracing",
      state: "Production",
      detail: "Exact-vault match attributes a re-shared copy to its license; plaintext leaks reported as unattributable.",
    },
    {
      capability: "Payments",
      state: live ? "Production" : "Simulated",
      detail: live
        ? "Live Stripe hosted checkout. Card details never touch this site."
        : "Mock payment adapter — checkout is simulated and no charge occurs.",
    },
    {
      capability: "Direct creator payouts (Stripe Connect)",
      state: connectEnabled ? "Production" : "Planned",
      detail: connectEnabled
        ? "Buyers pay each creator's own connected Stripe account directly; the platform never holds creator funds."
        : "Built and tested: direct charges route payment to the creator's own Stripe account. Not yet enabled on this instance.",
    },
    {
      capability: "Buyer accounts / persistent login",
      state: "Planned",
      detail: "Library lookup is by hashed email today; real authentication is a founder-funded item.",
    },
    {
      capability: "Independent security audit",
      state: "Planned",
      detail: "Third-party review of the envelope and marketplace before creators are invited at scale.",
    },
  ];

  return (
    <>
      <section className="hero hero-compact">
        <p className="eyebrow">Imagine Qira · System Status</p>
        <h2 className="listing-title">What is production, what is simulated</h2>
        <p className="subhead">
          No fake production language. Below is exactly what runs on real cryptography and real
          infrastructure today, what is simulated in this build, and what is still planned.
        </p>
        <div className="notice">
          Active payment mode: <strong>{paymentModeLabel(paymentsProvider)}</strong>. Launch target{" "}
          {LAUNCH_DATE}.
        </div>
      </section>

      <section className="panel">
        <h2>Capabilities</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Capability</th>
              <th>State</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.capability}>
                <td>{row.capability}</td>
                <td>
                  <span
                    className={`pill ${
                      row.state === "Production"
                        ? "pill-pass"
                        : row.state === "Simulated"
                          ? "pill-warning"
                          : "pill-demo"
                    }`}
                  >
                    {row.state}
                  </span>
                </td>
                <td>{row.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>Known limits</h2>
        <ul className="plain-list">
          <li>
            Copying after unlock is possible. Once a buyer can open a file, it can be copied — the
            value is the receipt, license record, integrity, and traceability, not copy prevention.
          </li>
          <li>
            The edge build tunes the key-derivation cost low for fast in-browser unlock; it is real
            QEV crypto, not a hardened-at-rest configuration.
          </li>
          <li>Files are capped at 1 MB in this instance.</li>
          <li>
            The issuer key model is a server-held key (dev stand-in for a KMS); buyer authentication
            is not live yet.
          </li>
        </ul>
      </section>

      <section className="panel muted">
        <h2>Verify it yourself</h2>
        <p>
          Do not take this page on faith. Open the <Link to="/verify">verifier</Link> and run a real
          check on the demo package — no purchase required.
        </p>
      </section>
    </>
  );
}
