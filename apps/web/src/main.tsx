import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, NavLink, Outlet, Route, Routes } from "react-router-dom";
import { MarketplaceProvider, useMarketplace } from "./lib/marketplace";
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
  const { status, unsupportedReason } = useMarketplace();

  return (
    <div className="shell">
      <nav className="nav">
        <Link className="brand" to="/">
          My Digital
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
        </div>
        <span className="pill pill-demo">DEV · MOCK PAYMENTS</span>
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
        <p>
          Dev build. Assets are locked server-side into real QEV Vault V2 envelopes
          (BRY-NFET-SX-VAULT-V2, Argon2id + XChaCha20-Poly1305); custody secrets are sealed under
          the server master key. Unlock and decryption run locally in this browser — codes and
          plaintext are never sent to the server after purchase. Payments are mocked. This product
          does not claim to make piracy impossible.
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
