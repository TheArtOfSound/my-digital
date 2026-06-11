import type { VerificationCheck, VerificationResult } from "@my-digital/types";
import { formatDate } from "../lib/format";

export function StatusPill({ status }: { status: string }) {
  return <span className={`pill pill-${status}`}>{status.toUpperCase()}</span>;
}

function CheckList({
  heading,
  checks,
  tone
}: {
  heading: string;
  checks: VerificationCheck[];
  tone: "pass" | "fail" | "skip" | "warn";
}) {
  if (checks.length === 0) return null;
  return (
    <div className={`check-list check-${tone}`}>
      <h4>{heading}</h4>
      <ul>
        {checks.map((check) => (
          <li key={check.code}>
            <span className="check-code">{check.code}</span>
            <span className="check-detail">{check.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VerificationResultView({
  title,
  result
}: {
  title: string;
  result: VerificationResult;
}) {
  return (
    <article className={`verify-card verify-${result.status}`}>
      <header className="verify-head">
        <h3>{title}</h3>
        <StatusPill status={result.status} />
      </header>
      <p className="verify-meta">
        subject {result.subjectType} · {result.subjectId} · checked {formatDate(result.checkedAt)}
      </p>
      <CheckList heading={`Checks passed (${result.checksPassed.length})`} checks={result.checksPassed} tone="pass" />
      <CheckList heading={`Checks failed (${result.checksFailed.length})`} checks={result.checksFailed} tone="fail" />
      <CheckList
        heading={`Not checked (${result.checksSkipped.length})`}
        checks={result.checksSkipped}
        tone="skip"
      />
      <CheckList heading={`Warnings (${result.warnings.length})`} checks={result.warnings} tone="warn" />
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
