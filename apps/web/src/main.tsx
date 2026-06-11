import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, NavLink, Outlet, Route, Routes } from "react-router-dom";
import { MarketplaceProvider, useMarketplace } from "./lib/marketplace";
import { CheckoutPage } from "./pages/CheckoutPage";
import { CreatorPage } from "./pages/CreatorPage";
import { HomePage } from "./pages/HomePage";
import { ListingPage } from "./pages/ListingPage";
import { SellPage } from "./pages/SellPage";
import { UnlockPage } from "./pages/UnlockPage";
import { VerifyPage } from "./pages/VerifyPage";
import "./styles.css";

function Layout() {
  const { status, unsupportedReason } = useMarketplace();

  return (
    <div className="shell">
      <nav className="nav">
        <Link className="brand" to="/">
          My Digital
        </Link>
        <div className="nav-links">
          <NavLink to="/sell">Sell</NavLink>
          <NavLink to="/unlock">Unlock</NavLink>
          <NavLink to="/verify">Verify</NavLink>
          <NavLink to="/creator">Creator</NavLink>
        </div>
        <span className="pill pill-demo">DEMO MODE</span>
      </nav>

      {status === "loading" && (
        <section className="panel">
          <p>Preparing the demo marketplace…</p>
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
        <p>
          Demo build. Envelope locking is simulated and labeled; SHA-256 hashes and Ed25519 issuer
          signatures are real. All records stay in this browser. Decrypted output is never
          persisted. This product does not claim to make piracy impossible.
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
            <Route path="/checkout/:listingId" element={<CheckoutPage />} />
            <Route path="/unlock" element={<UnlockPage />} />
            <Route path="/verify" element={<VerifyPage />} />
            <Route path="/creator" element={<CreatorPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </MarketplaceProvider>
  </React.StrictMode>
);
