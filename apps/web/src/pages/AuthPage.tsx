import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignup = mode === "signup";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isSignup) {
        await signup({ email, password, displayName });
      } else {
        await login({ email, password });
      }
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="hero hero-compact" style={{ maxWidth: "460px" }}>
      <p className="eyebrow">My Digital account</p>
      <h1 className="listing-title">{isSignup ? "Create your account" : "Welcome back"}</h1>
      <p className="subhead">
        {isSignup
          ? "One account to buy with a saved library, or to sell and get paid directly to your own Stripe."
          : "Sign in to reach your library, your seller dashboard, and your payouts."}
      </p>

      <form className="form" onSubmit={onSubmit}>
        {isSignup && (
          <label className="field">
            Your name
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Jane Maker"
              autoComplete="name"
              required
            />
          </label>
        )}
        <label className="field">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSignup ? "At least 8 characters" : "Your password"}
            autoComplete={isSignup ? "new-password" : "current-password"}
            minLength={8}
            required
          />
        </label>

        {error && <p className="panel-error">{error}</p>}

        <div className="hero-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Please wait…" : isSignup ? "Create account" : "Log in"}
          </button>
        </div>
      </form>

      <p className="muted-text" style={{ marginTop: "14px" }}>
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link to={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}>
              Log in
            </Link>
            .
          </>
        ) : (
          <>
            New to My Digital?{" "}
            <Link to={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}>
              Create an account
            </Link>
            .
          </>
        )}
      </p>
    </section>
  );
}
