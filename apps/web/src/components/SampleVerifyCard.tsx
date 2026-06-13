import type { SampleVerification } from "../lib/launch";

const VERDICT_TONE: Record<SampleVerification["verdict"], string> = {
  Verified: "pass",
  Warning: "warning",
  Failed: "fail",
  Unknown: "unknown",
};

function List({ heading, items }: { heading: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="check-list">
      <h4>{heading}</h4>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Illustrative verifier output shown BEFORE purchase (Reddit r/smallbusiness:
 * "trust proof must show before checkout, not only after a receipt exists").
 * This mirrors the live /verify result shape: verdict + checked / passed /
 * not-checked / assumptions. It is a sample, not a live cryptographic check.
 */
export function SampleVerifyCard({ result }: { result: SampleVerification }) {
  const tone = VERDICT_TONE[result.verdict];
  return (
    <article className={`verify-card verify-${tone}`}>
      <header className="verify-head">
        <h3>Verifier result</h3>
        <span className={`pill pill-${tone}`}>{result.verdict.toUpperCase()}</span>
      </header>
      <p className="verify-meta">
        {result.subject} · sample output · checked {result.checkedAt}
      </p>
      <List heading={`Checked (${result.checked.length})`} items={result.checked} />
      <List heading={`Passed (${result.passed.length})`} items={result.passed} />
      <List heading={`Not checked (${result.notChecked.length})`} items={result.notChecked} />
      {result.assumptions.length > 0 && (
        <div className="assumptions">
          <h4>Assumptions</h4>
          <ul>
            {result.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
