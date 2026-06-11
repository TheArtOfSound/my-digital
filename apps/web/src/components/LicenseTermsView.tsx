import type { LicenseTerms } from "@my-digital/types";

const TERM_LABELS: Array<{ key: keyof Omit<LicenseTerms, "seatCount">; label: string }> = [
  { key: "personalUse", label: "Personal use" },
  { key: "commercialUse", label: "Commercial use" },
  { key: "clientWorkAllowed", label: "Client work" },
  { key: "redistributionAllowed", label: "Redistribution" },
  { key: "resaleAllowed", label: "Resale" },
  { key: "aiTrainingAllowed", label: "AI training" },
  { key: "attributionRequired", label: "Attribution required" }
];

export function LicenseTermsView({ terms }: { terms: LicenseTerms }) {
  return (
    <ul className="terms-list">
      {TERM_LABELS.map(({ key, label }) => (
        <li key={key} className={terms[key] ? "term-yes" : "term-no"}>
          <span className="term-mark">{terms[key] ? "✓" : "✕"}</span> {label}
        </li>
      ))}
      <li className="term-yes">
        <span className="term-mark">#</span> {terms.seatCount} seat
        {terms.seatCount === 1 ? "" : "s"}
      </li>
    </ul>
  );
}
