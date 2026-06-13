import { Link } from "react-router-dom";
import { ClaimBoundary } from "../components/ClaimBoundary";

const FAQ: { q: string; a: string }[] = [
  {
    q: "Is this DRM?",
    a: "No. It does not try to stop you from copying a file after you open it. It is a license, receipt, integrity, and traceability layer — proof of what was sold and to whom, not copy prevention.",
  },
  {
    q: "Is it piracy-proof?",
    a: "No, and we will never claim it is. Once a buyer can open a file, the file can be copied. The value is verifiable proof of purchase and the ability to trace a leaked vault back to a license.",
  },
  {
    q: "Do I need to trust your server?",
    a: "For the marketplace records, yes — they are served by the API. But verification works from the signed receipt itself: a receipt bundle carries the issuer public key, so anyone can verify it offline without trusting our uptime.",
  },
  {
    q: "Where does unlocking happen?",
    a: "In your browser. The vault decrypts on your own device with your access key. The key and the decrypted file never travel back to our servers after purchase.",
  },
  {
    q: "What if I lose my access key?",
    a: "Your library re-fetches your encrypted vault, but the one-time key is shown once. Buyer accounts and recovery are a planned, founder-funded item — see the status page.",
  },
];

export function DocsQevPage() {
  return (
    <>
      <section className="hero hero-compact">
        <p className="eyebrow">Imagine Qira · Trust Docs</p>
        <h2 className="listing-title">QEV, in plain language</h2>
        <p className="subhead">
          You do not need to understand cryptography to buy or sell here. This page is for anyone who
          wants to know exactly what QEV is, what it protects, and what it deliberately does not.
        </p>
      </section>

      <section className="panel">
        <h2>What QEV is</h2>
        <p style={{ marginBottom: "12px" }}>
          QEV (Qira Encryption Vault) is an envelope format for locking a file and binding a license
          to it. It is not a new cipher, not a blockchain, and not a token. It is a careful
          arrangement of well-known, audited building blocks.
        </p>
        <ul className="plain-list">
          <li>
            <strong>Argon2id</strong> turns an access key into an encryption key (memory-hard, to
            slow brute force).
          </li>
          <li>
            <strong>XChaCha20-Poly1305</strong> encrypts the file and authenticates it, so any
            tampering is detected on unlock.
          </li>
          <li>
            <strong>Ed25519 signatures</strong> sign each license and receipt, so they can be
            verified by anyone holding the issuer public key.
          </li>
          <li>
            <strong>SHA-256 hashes</strong> fingerprint the content and package for integrity checks
            and leak tracing.
          </li>
        </ul>
      </section>

      <section className="panel">
        <h2>The lifecycle</h2>
        <div className="lifecycle">
          {["Create", "Lock", "List", "Buy", "License", "Unlock", "Verify", "Trace"].map((step) => (
            <span className="step" key={step}>
              {step}
            </span>
          ))}
        </div>
        <p style={{ marginTop: "14px" }}>
          A creator <strong>creates</strong> and <strong>locks</strong> a product, then{" "}
          <strong>lists</strong> it. A buyer <strong>buys</strong>; a buyer-specific{" "}
          <strong>license</strong> and receipt are issued. The buyer <strong>unlocks</strong>{" "}
          locally. Anyone can <strong>verify</strong> the receipt and package, and a leaked vault can
          be <strong>traced</strong> to its license.
        </p>
      </section>

      <section className="panel">
        <h2>Threat model — what it does and does not protect</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Protects against</th>
              <th>Does not protect against</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Forged or altered receipts and licenses</td>
              <td>A buyer copying the file after they unlock it</td>
            </tr>
            <tr>
              <td>Silent tampering with the locked package</td>
              <td>Screenshots, screen recording, or retyping content</td>
            </tr>
            <tr>
              <td>Disputed proof of purchase</td>
              <td>Judging whether a product is good, legal, or original</td>
            </tr>
            <tr>
              <td>An unattributed leak (exact vault traces to a license)</td>
              <td>A leak of the plaintext only (reported as unattributable)</td>
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: "16px" }}>
          <ClaimBoundary variant="verifier" />
        </div>
      </section>

      <section className="panel">
        <h2>FAQ</h2>
        <dl className="kv">
          {FAQ.map((entry) => (
            <div key={entry.q}>
              <dt style={{ textTransform: "none", letterSpacing: 0 }}>{entry.q}</dt>
              <dd>{entry.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="panel muted">
        <h2>See it work</h2>
        <p>
          Run a real verification on the demo package at the{" "}
          <Link to="/verify">verifier</Link>, or read exactly what is live on the{" "}
          <Link to="/status">status page</Link>.
        </p>
      </section>
    </>
  );
}
