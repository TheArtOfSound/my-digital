import { useState, type FormEvent } from "react";
import { useMarketplace } from "../lib/marketplace";

export function CreatorSetup() {
  const { actions } = useMarketplace();
  const [displayName, setDisplayName] = useState("Demo Creator");
  const [handle, setHandle] = useState("demo-creator");
  const [email, setEmail] = useState("creator@example.com");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await actions.ensureCreator({ displayName, handle, email });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>Create the demo creator profile</h2>
      <p>
        One local creator identity is used for everything you lock and list. Only a hash of the
        email is stored.
      </p>
      <form className="form" onSubmit={onSubmit}>
        <label className="field">
          Display name
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
        </label>
        <label className="field">
          Handle
          <input value={handle} onChange={(event) => setHandle(event.target.value)} required />
        </label>
        <label className="field">
          Email (stored as SHA-256 hash only)
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        {error && <p className="panel-error">{error}</p>}
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? "Creating…" : "Create creator profile"}
        </button>
      </form>
    </section>
  );
}
