import { Link, useParams } from "react-router-dom";
import { CreatorBadge } from "../components/CreatorBadge";
import { BUYER_FLOW, FlowStepper } from "../components/FlowStepper";
import { LicenseTermsView } from "../components/LicenseTermsView";
import { ProofPreview } from "../components/ProofPreview";
import { formatPrice, shortHash } from "../lib/format";
import { useMarketplace } from "../lib/marketplace";

export function ListingPage() {
  const { listingId } = useParams<{ listingId: string }>();
  const { state, paymentsProvider } = useMarketplace();
  const stripeLive = paymentsProvider === "stripe";

  const listing = state.listings.find((entry) => entry.id === listingId);
  if (!listing) {
    return (
      <section className="panel">
        <h2>Listing not found</h2>
        <p>
          This listing is not available in the marketplace.{" "}
          <Link to="/sell">Lock and list a product</Link> to create one.
        </p>
      </section>
    );
  }
  const assetVersion = state.assetVersions.find(
    (entry) => entry.id === listing.activeAssetVersionId
  );
  const lockedAsset = state.lockedAssets.find(
    (entry) => entry.assetVersionId === listing.activeAssetVersionId
  );
  // The demo adapter stamps this format; the real QEV Vault V2 adapter stamps
  // BRY-NFET-SX-VAULT-V2. Drive the label from data instead of hardcoding it.
  const isDemoEnvelope = lockedAsset?.envelopeFormat === "MYDIGITAL-DEMO-ENVELOPE";

  return (
    <>
      <section className="hero hero-compact">
        <p className="eyebrow">{listing.status === "active" ? "Active listing" : listing.status}</p>
        <h2 className="listing-title">{listing.title}</h2>
        <p className="subhead">{listing.description}</p>
        <p className="listing-price-big">{formatPrice(listing.priceAmount, listing.priceCurrency)}</p>
        <div className="hero-actions">
          <Link className="btn btn-primary" to={`/checkout/${listing.id}`}>
            {stripeLive ? "Buy securely with Stripe" : "Buy with mock checkout"}
          </Link>
        </div>
        <div className="notice">
          {stripeLive
            ? "Buying issues a buyer-specific license, a one-time access key, and a signed proof receipt. Payment is processed by Stripe on its secure hosted checkout; card details never touch this site."
            : "Buying issues a buyer-specific license, a one-time access key, and a signed proof receipt. Payment is simulated by the mock adapter — no real charge."}
        </div>
      </section>

      {state.creator && (
        <section className="panel">
          <h2>Sold by</h2>
          <CreatorBadge creator={state.creator} />
        </section>
      )}

      <ProofPreview heading="What you receive when you buy this" />

      <section className="panel">
        <h2>How you'll get it</h2>
        <FlowStepper steps={BUYER_FLOW} />
      </section>

      <section className="panel">
        <h2>Asset identity</h2>
        {assetVersion && lockedAsset ? (
          <dl className="kv">
            <div>
              <dt>File</dt>
              <dd>
                {assetVersion.fileName} · {assetVersion.mimeType} · {assetVersion.byteSize} bytes ·
                version {assetVersion.versionLabel}
              </dd>
            </div>
            <div>
              <dt>Content hash (SHA-256, real)</dt>
              <dd className="mono">{shortHash(assetVersion.contentHash, 40)}</dd>
            </div>
            <div>
              <dt>Manifest hash (SHA-256, real)</dt>
              <dd className="mono">{shortHash(assetVersion.manifestHash, 40)}</dd>
            </div>
            <div>
              <dt>Envelope</dt>
              <dd className="mono">
                {lockedAsset.envelopeFormat} {lockedAsset.envelopeVersion} —{" "}
                {isDemoEnvelope ? (
                  <span className="pill pill-demo">DEMO ONLY</span>
                ) : (
                  <span className="pill pill-pass">PRODUCTION ENVELOPE</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Locked payload hash</dt>
              <dd className="mono">{shortHash(lockedAsset.lockedPayloadHash, 40)}</dd>
            </div>
          </dl>
        ) : (
          <p>Asset records are incomplete for this listing.</p>
        )}
      </section>

      <section className="panel">
        <h2>License terms</h2>
        <LicenseTermsView terms={listing.licenseTerms} />
      </section>
    </>
  );
}
