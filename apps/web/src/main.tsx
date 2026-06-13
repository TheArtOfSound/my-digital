import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, NavLink, Outlet, Route, Routes } from "react-router-dom";
import { MarketplaceProvider, useMarketplace } from "./lib/marketplace";
import { BackUsPage } from "./pages/BackUsPage";
import { CheckoutDonePage } from "./pages/CheckoutDonePage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { CreatorPage } from "./pages/CreatorPage";
import { HomePage } from "./pages/HomePage";
import { LibraryPage } from "./pages/LibraryPage";
import { ListingPage } from "./pages/ListingPage";
import { SellPage } from "./pages/SellPage";
import { TracePage } from "./pages/TracePage";
import { UnlockPage } from "./pages/UnlockPage";
import { VerifyPage } from "./pages/VerifyPage";
import "./styles.css";

function Layout() {
  const { status, unsupportedReason, paymentsProvider } = useMarketplace();
  const stripeLive = paymentsProvider === "stripe";

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
          <NavLink to="/back">Back Us</NavLink>
        </div>
        <span className="pill pill-demo">
          {stripeLive ? "Payments by Stripe" : "Preview — Mock Payments"}
        </span>
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
          Every asset sold here is locked into a QEV envelope (Qira Encryption Vault, schema
          BRY-NFET-SX-VAULT-V2, Argon2id and XChaCha20-Poly1305). Custody secrets are sealed under
          the server master key. Unlock and decryption run locally in your browser; unlock codes
          and decrypted files are never sent to the server after purchase.
        </p>
        <p>
          {stripeLive
            ? "Payments are processed by Stripe on its hosted checkout; card details never touch this site. "
            : "Preview build: payments are simulated and no charges occur. "}
          This product improves controlled access, proof of purchase, and traceability; it does
          not claim to make piracy impossible.
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
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="/sell" element={<SellPage />} />
            <Route path="/listing/:listingId" element={<ListingPage />} />
            <Route path="/back" element={<BackUsPage />} />
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
    </MarketplaceProvider>
  </React.StrictMode>
);
