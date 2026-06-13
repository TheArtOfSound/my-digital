import { COPY } from "../lib/launch";

type BoundaryVariant = "product" | "verifier" | "creator" | "funding";

const TEXT: Record<BoundaryVariant, string> = {
  product: COPY.productBoundary,
  verifier: COPY.verifierBoundary,
  creator: COPY.creatorBoundary,
  funding: COPY.fundingBoundary,
};

/**
 * Honest claim boundary. Reddit feedback (DRM objectors + r/SideProject) was
 * clear: never imply piracy-proof protection. This block states, plainly, what
 * the product does NOT do, wherever the relevant claim appears.
 */
export function ClaimBoundary({
  variant,
  heading = "What this does not do",
}: {
  variant: BoundaryVariant;
  heading?: string;
}) {
  return (
    <div className="notice">
      <strong style={{ display: "block", color: "var(--ink)", marginBottom: "4px" }}>
        {heading}
      </strong>
      {TEXT[variant]}
    </div>
  );
}
