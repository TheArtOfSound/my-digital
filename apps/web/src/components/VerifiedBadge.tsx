import type { Creator } from "@my-digital/types";

/**
 * Trust badge for a seller. "Verified" is earned automatically from objective
 * signals (identity details provided + payouts connected); "Reviewed" is a
 * higher tier granted by a manual Imagine Qira review. Nothing is shown for
 * unverified sellers — we never imply more than we actually checked.
 */
export function VerifiedBadge({ creator }: { creator: Creator }) {
  const base: React.CSSProperties = { marginLeft: "8px", verticalAlign: "middle" };
  if (creator.verificationStatus === "reviewed") {
    return (
      <span className="pill pill-pass" style={base} title="Identity reviewed by Imagine Qira">
        REVIEWED
      </span>
    );
  }
  if (creator.verificationStatus === "verified") {
    return (
      <span
        className="pill pill-pass"
        style={base}
        title="Identity details provided and payouts connected"
      >
        VERIFIED
      </span>
    );
  }
  return null;
}
