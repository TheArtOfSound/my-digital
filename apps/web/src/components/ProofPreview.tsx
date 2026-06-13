import { Link } from "react-router-dom";
import { COPY, SAMPLE_LICENSE, SAMPLE_RECEIPT, SAMPLE_VERIFICATION } from "../lib/launch";
import { ClaimBoundary } from "./ClaimBoundary";
import { LicenseCard } from "./LicenseCard";
import { ReceiptCard } from "./ReceiptCard";
import { SampleVerifyCard } from "./SampleVerifyCard";

/**
 * "Before you buy, see exactly what you receive." Shows the license record,
 * proof receipt, and a verifier result up front — the pre-checkout trust proof
 * Reddit asked for. Reusable on the homepage and on every listing.
 */
export function ProofPreview({ heading = "Before you buy" }: { heading?: string }) {
  return (
    <section className="panel">
      <h2>{heading}</h2>
      <p style={{ marginBottom: "18px" }}>{COPY.buyerProof}</p>
      <div className="proof-grid">
        <LicenseCard license={SAMPLE_LICENSE} />
        <ReceiptCard receipt={SAMPLE_RECEIPT} />
      </div>
      <SampleVerifyCard result={SAMPLE_VERIFICATION} />
      <p className="hint" style={{ marginTop: "14px" }}>
        This is a sample of what every buyer receives. Try a real check on the{" "}
        <Link to="/verify">verifier</Link> — no purchase required.
      </p>
      <div style={{ marginTop: "16px" }}>
        <ClaimBoundary variant="product" />
      </div>
    </section>
  );
}
