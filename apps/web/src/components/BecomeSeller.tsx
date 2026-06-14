import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useMarketplace } from "../lib/marketplace";

/**
 * Shown on the Sell / Creator pages when the visitor can't yet sell: it prompts
 * sign-in when logged out, or turns an existing account into a seller.
 */
export function BecomeSeller({ onDone }: { onDone?: () => void }) {
  const { user, isSeller, refresh } = useAuth();
  const { actions } = useMarketplace();
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <section className="panel">
        <h2>Start selling on My Digital</h2>
        <p>
          Create an account (or sign in) to open your seller dashboard, list locked products, and
          get paid <strong>directly to your own Stripe</strong>.
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary" to="/signup?next=/creator">
            Create an account
          </Link>
          <Link className="btn btn-ghost" to="/login?next=/creator">
            Log in
          </Link>
        </div>
      </section>
    );
  }

  if (isSeller) return null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await actions.becomeSeller(handle.trim() ? { handle: handle.trim() } : undefined);
      await refresh();
      onDone?.();
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Could not set up your seller profile."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>Become a seller</h2>
      <p>
        Your seller profile starts from your account name ({user.displayName}). Choose a public
        handle, or we&rsquo;ll generate one — you can edit everything afterward.
      </p>
      <form className="form" onSubmit={onSubmit}>
        <label className="field">
          Public handle (optional)
          <input
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder="your-handle"
            maxLength={32}
            autoComplete="off"
          />
        </label>
        {error && <p className="panel-error">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Setting up…" : "Become a seller"}
        </button>
      </form>
    </section>
  );
}
