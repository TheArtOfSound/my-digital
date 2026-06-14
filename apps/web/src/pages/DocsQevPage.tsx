import { Link } from "react-router-dom";
import { ClaimBoundary } from "../components/ClaimBoundary";

const SECTIONS = [
  { id: "overview", label: "What QEV is" },
  { id: "lifecycle", label: "How a sale flows" },
  { id: "protect", label: "What it protects" },
  { id: "deep-dive", label: "Technical deep dive" },
  { id: "faq", label: "FAQ" }
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Is this DRM?",
    a: "No. It does not try to stop you from copying a file after you open it. It is a license, receipt, integrity, and traceability layer — proof of what was sold and to whom, not copy prevention."
  },
  {
    q: "Is it piracy-proof?",
    a: "No, and we will never claim it is. Once a buyer can open a file, the file can be copied. The value is verifiable proof of purchase and the ability to trace a leaked vault back to a license."
  },
  {
    q: "Do I need to trust your server?",
    a: "For the marketplace records, yes — they are served by the API. But verification works from the signed receipt itself: a receipt bundle carries the issuer public key, so anyone can verify it offline without trusting our uptime."
  },
  {
    q: "Where does unlocking happen?",
    a: "In your browser. The vault decrypts on your own device with your access key. The key and the decrypted file never travel back to our servers after purchase."
  },
  {
    q: "What if I lose my access key?",
    a: "Your library re-fetches your encrypted vault, but the one-time key is shown once. Account-based recovery is on the roadmap — see the status page."
  }
];

// The genuinely technical material, tucked behind expandable details so the
// page stays readable for everyone while implementers still have it all.
const DEEP: { summary: string; body: React.ReactNode }[] = [
  {
    summary: "The QEV Vault V2 envelope",
    body: (
      <>
        <p>
          Each product is sealed into a <span className="mono">BRY-NFET-SX-VAULT-V2</span> envelope.
          Fields are base64url without padding, and a single authenticated header (AAD) covers a
          canonical, sorted-key JSON of everything except the wrapped key and ciphertext — so no
          field can be altered without unlock failing.
        </p>
        <p>
          Keys are two-layer: your access key runs through Argon2id to derive a wrap key, which
          unwraps a random per-vault key, which decrypts the content. A buyer&rsquo;s vault is wrapped
          specifically for them, so it is unique to their purchase.
        </p>
      </>
    )
  },
  {
    summary: "Key derivation presets",
    body: (
      <p>
        Argon2id cost is tuned per environment: <strong>edge</strong> (used on Cloudflare Workers,
        low memory), <strong>quick</strong>, <strong>strong</strong>, and <strong>vault</strong>
        (highest). The construction is identical across presets — only the work factor differs — and
        all are byte-compatible with the public QEV CLI.
      </p>
    )
  },
  {
    summary: "What is signed, and how to verify offline",
    body: (
      <p>
        Licenses and receipts are signed with Ed25519 over canonical JSON. A license signs only its
        immutable claim (revocation is tracked separately, so revoking never breaks the original
        signature). A downloaded <em>receipt bundle</em> includes the issuer&rsquo;s public key, so
        anyone can verify it on their own machine — online or off — without trusting our servers.
      </p>
    )
  },
  {
    summary: "How leak tracing reports evidence",
    body: (
      <ul className="plain-list">
        <li>
          <strong>Exact vault match</strong> — a re-shared vault hashes to a known buyer vault:
          attributed to that license.
        </li>
        <li>
          <strong>Plaintext content match</strong> — the leaked file matches the product, but the
          vault is gone: reported honestly as unattributable.
        </li>
        <li>
          <strong>Vault format, no match</strong> / <strong>no evidence</strong> — stated plainly
          rather than guessed.
        </li>
      </ul>
    )
  }
];

export function DocsQevPage() {
  return (
    <>
      <section className="hero hero-compact">
        <p className="eyebrow">Imagine Qira · Trust Docs</p>
        <h2 className="listing-title">QEV, in plain language</h2>
        <p className="subhead">
          You don&rsquo;t need to understand cryptography to buy or sell here. Start at the top for
          the plain version; open the deep dive if you want the exact mechanics.
        </p>
      </section>

      <div className="docs-layout">
        <aside className="docs-toc">
          <p className="docs-toc-title">On this page</p>
          <nav>
            {SECTIONS.map((section) => (
              <a key={section.id} href={`#${section.id}`}>
                {section.label}
              </a>
            ))}
          </nav>
          <div className="docs-toc-cta">
            <Link className="btn btn-ghost btn-small" to="/verify">
              Try the verifier
            </Link>
            <Link className="btn btn-ghost btn-small" to="/status">
              What&rsquo;s live
            </Link>
          </div>
        </aside>

        <div className="docs-content">
          <section id="overview" className="panel">
            <h2>What QEV is</h2>
            <p style={{ marginBottom: "12px" }}>
              QEV (Qira Encryption Vault) is an envelope format for locking a file and binding a
              license to it. It is not a new cipher, not a blockchain, and not a token — it is a
              careful arrangement of well-known, audited building blocks.
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
                <strong>Ed25519 signatures</strong> sign each license and receipt, so anyone with the
                issuer public key can verify them.
              </li>
              <li>
                <strong>SHA-256 hashes</strong> fingerprint the content and package for integrity
                checks and leak tracing.
              </li>
            </ul>
          </section>

          <section id="lifecycle" className="panel">
            <h2>How a sale flows</h2>
            <div className="lifecycle">
              {["Create", "Lock", "List", "Buy", "License", "Unlock", "Verify", "Trace"].map(
                (step) => (
                  <span className="step" key={step}>
                    {step}
                  </span>
                )
              )}
            </div>
            <p style={{ marginTop: "14px" }}>
              A seller <strong>creates</strong> and <strong>locks</strong> a product, then{" "}
              <strong>lists</strong> it. A buyer <strong>buys</strong>; a buyer-specific{" "}
              <strong>license</strong> and receipt are issued. The buyer <strong>unlocks</strong>{" "}
              locally. Anyone can <strong>verify</strong> the receipt and package, and a leaked vault
              can be <strong>traced</strong> to its license.
            </p>
          </section>

          <section id="protect" className="panel">
            <h2>What it protects — and what it doesn&rsquo;t</h2>
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

          <section id="deep-dive" className="panel">
            <h2>Technical deep dive</h2>
            <p style={{ marginBottom: "8px" }}>
              For implementers and the security-curious. Everything here is optional — open what you
              want.
            </p>
            {DEEP.map((item) => (
              <details className="deep-detail" key={item.summary}>
                <summary>{item.summary}</summary>
                <div className="deep-detail-body">{item.body}</div>
              </details>
            ))}
          </section>

          <section id="faq" className="panel">
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
        </div>
      </div>
    </>
  );
}
