import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const lifecycle = ["CREATE", "LOCK", "LIST", "BUY", "LICENSE", "UNLOCK", "VERIFY", "TRACE"];

function App() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">QEV commerce extension</p>
        <h1>Sell digital products as locked, verifiable assets.</h1>
        <p className="subhead">
          My Digital is the QEV-powered commerce primitive for encrypted digital goods,
          buyer-specific unlock licenses, tamper verification, and proof-of-purchase receipts.
        </p>
        <div className="notice">
          <strong>Foundation build:</strong> this app starts with a clearly labeled demo envelope adapter.
          Production QEV Vault V2 integration comes after the lifecycle works end-to-end.
        </div>
      </section>

      <section className="panel">
        <h2>Core lifecycle</h2>
        <div className="lifecycle">
          {lifecycle.map((step) => (
            <span className="step" key={step}>{step}</span>
          ))}
        </div>
      </section>

      <section className="grid">
        <article className="card">
          <h3>Creator promise</h3>
          <p>Lock files into QEV-style asset envelopes and sell them with clear license terms.</p>
        </article>
        <article className="card">
          <h3>Buyer promise</h3>
          <p>Receive a buyer-specific unlock credential and a verifiable purchase receipt.</p>
        </article>
        <article className="card">
          <h3>Trust promise</h3>
          <p>Verify asset integrity, license binding, and receipt status without vague security theater.</p>
        </article>
      </section>

      <section className="panel muted">
        <h2>Build rule</h2>
        <p>
          This product improves controlled access, proof, and traceability. It must remain honest about
          what it verifies, what it does not verify, and what remains outside the application boundary.
        </p>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
