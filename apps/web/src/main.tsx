import React from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate
} from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { isLivePayments } from "./lib/launch";
import { MarketplaceProvider, useMarketplace } from "./lib/marketplace";
import { AuthPage } from "./pages/AuthPage";
import { CheckoutDonePage } from "./pages/CheckoutDonePage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { CreatorPage } from "./pages/CreatorPage";
import { DocsQevPage } from "./pages/DocsQevPage";
import { FundingPage } from "./pages/FundingPage";
import { HomePage } from "./pages/HomePage";
import { LibraryPage } from "./pages/LibraryPage";
import { ListingPage } from "./pages/ListingPage";
import { SellPage } from "./pages/SellPage";
import { StatusPage } from "./pages/StatusPage";
import { TracePage } from "./pages/TracePage";
import { UnlockPage } from "./pages/UnlockPage";
import { VerifyPage } from "./pages/VerifyPage";
import "./styles.css";

function AccountMenu() {
  const { user, status, logout } = useAuth();
  const navigate = useNavigate();
  if (status === "loading") return null;
  if (!user) {
    return (
      <span className="account-menu">
        <NavLink to="/login">Log in</NavLink>
        <NavLink to="/signup" className="btn btn-ghost btn-small">
          Sign up
        </NavLink>
      </span>
    );
  }
  return (
    <span className="account-menu">
      <NavLink to="/creator" title={user.email} className="account-name">
        {user.displayName}
      </NavLink>
      <button
        type="button"
        className="linklike"
        onClick={async () => {
          await logout();
          navigate("/");
        }}
      >
        Log out
      </button>
    </span>
  );
}

function Layout() {
  const { status, unsupportedReason, paymentsProvider } = useMarketplace();
  const live = isLivePayments(paymentsProvider);

  return (
    <div className="shell">
      <nav className="nav">
        <Link className="brand" to="/">
          My Digital
          <small>An Imagine Qira Company</small>
        </Link>
        <div className="nav-links">
          <NavLink to="/sell">Sell</NavLink>
          <NavLink to="/library">Library</NavLink>
          <NavLink to="/unlock">Unlock</NavLink>
          <NavLink to="/verify" end>
            Verify
          </NavLink>
          <NavLink to="/trace">Trace</NavLink>
          <NavLink to="/creator">Creator</NavLink>
          <NavLink to="/funding">Funding</NavLink>
          <NavLink to="/docs/qev">Docs</NavLink>
        </div>
        <div className="nav-right">
          <NavLink to="/status" className="pill pill-demo" style={{ textDecoration: "none" }}>
            {live ? "Payments by Stripe" : "Preview — Mock Payments"}
          </NavLink>
          <AccountMenu />
        </div>
      </nav>

      {status === "loading" && (
        <section className="panel">
          <p>Connecting to the marketplace API…</p>
        </section>
      )}
      {status === "offline" && (
        <section className="panel panel-error-block">
          <h2>API server not running</h2>
          <p>
            The marketplace API is not reachable. Start it in another terminal with{" "}
            <span className="mono">pnpm server</span>, then reload this page.
          </p>
        </section>
      )}
      {status === "unsupported" && (
        <section className="panel panel-error-block">
          <h2>Browser not supported</h2>
          <p>{unsupportedReason}</p>
        </section>
      )}
      {status === "ready" && <Outlet />}

      <footer className="footer">
        <p className="footer-brand">My Digital — An Imagine Qira Company</p>
        <p>
          Verified receipts for digital downloads. Buyer-specific licenses, local unlocks, and
          public artifact verification, on QEV Vault V2 cryptography (schema BRY-NFET-SX-VAULT-V2,
          Argon2id and XChaCha20-Poly1305). Unlock and decryption run locally; access keys and
          decrypted files are never sent to the server after purchase.
        </p>
        <p>
          {live
            ? "Payments are processed by Stripe on its hosted checkout; card details never touch this site. "
            : "Preview build: payments are simulated and no charges occur. "}
          My Digital does not make copying impossible after unlock — it provides license records,
          receipts, integrity, and traceability.
        </p>
        <p>
          <Link to="/status">Status</Link> · <Link to="/docs/qev">Trust docs</Link> ·{" "}
          <Link to="/verify">Verifier</Link> · <Link to="/funding">Back the launch</Link>
        </p>
      </footer>
    </div>
  );
}

function NotFoundPage() {
  return (
    <section className="panel">
      <h2>Page not found</h2>
      <p>
        <Link to="/">Back to the landing page</Link>.
      </p>
    </section>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MarketplaceProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="/sell" element={<SellPage />} />
            <Route path="/listing/:listingId" element={<ListingPage />} />
            <Route path="/funding" element={<FundingPage />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/signup" element={<AuthPage mode="signup" />} />
            {/* /back was the original fundraising route; keep the link alive. */}
            <Route path="/back" element={<Navigate to="/funding" replace />} />
            <Route path="/status" element={<StatusPage />} />
            <Route path="/docs/qev" element={<DocsQevPage />} />
            <Route path="/checkout/done" element={<CheckoutDonePage />} />
            <Route path="/checkout/:listingId" element={<CheckoutPage />} />
            <Route path="/unlock" element={<UnlockPage />} />
            <Route path="/verify" element={<VerifyPage />} />
            <Route path="/verify/:receiptId" element={<VerifyPage />} />
            <Route path="/trace" element={<TracePage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/creator" element={<CreatorPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </MarketplaceProvider>
  </React.StrictMode>
);
