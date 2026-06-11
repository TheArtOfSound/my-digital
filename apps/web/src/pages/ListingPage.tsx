import { Link, useParams } from "react-router-dom";
import { LicenseTermsView } from "../components/LicenseTermsView";
import { formatPrice, shortHash } from "../lib/format";
import { useMarketplace } from "../lib/marketplace";

export function ListingPage() {
  const { listingId } = useParams<{ listingId: string }>();
  const { state } = useMarketplace();

  const listing = state.listings.find((entry) => entry.id === listingId);
  if (!listing) {
    return (
      <section className="panel">
        <h2>Listing not found</h2>
        <p>
          This listing does not exist in this browser's demo records.{" "}
          <Link to="/sell">Create one</Link>.
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

  return (
    <>
      <section className="hero hero-compact">
        <p className="eyebrow">{listing.status === "active" ? "Active listing" : listing.status}</p>
        <h2 className="listing-title">{listing.title}</h2>
        <p className="subhead">{listing.description}</p>
        <p className="listing-price-big">{formatPrice(listing.priceAmount, listing.priceCurrency)}</p>
        <div className="hero-actions">
          <Link className="btn btn-primary" to={`/checkout/${listing.id}`}>
            Buy with mock checkout
          </Link>
        </div>
        <div className="notice">
          Buying issues a buyer-specific license, a one-time-shown unlock code, and a signed proof
          receipt. Payment is simulated by the mock adapter — no real charge.
        </div>
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
                <span className="pill pill-demo">DEMO ONLY</span>
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
