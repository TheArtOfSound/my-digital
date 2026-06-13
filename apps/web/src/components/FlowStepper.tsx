export interface FlowStep {
  label: string;
  detail: string;
}

/**
 * Buyer-facing three-step flow. Reddit feedback said the one-time unlock "sounds
 * like friction" if it leads — so the buyer journey is framed as a normal,
 * simple Buy → Unlock → Verify, with cryptography kept out of the headline.
 */
export function FlowStepper({ steps }: { steps: FlowStep[] }) {
  return (
    <ol className="flow-stepper">
      {steps.map((step, index) => (
        <li key={step.label} className="flow-step">
          <span className="flow-step-num">{index + 1}</span>
          <span className="flow-step-body">
            <span className="flow-step-label">{step.label}</span>
            <span className="flow-step-detail">{step.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export const BUYER_FLOW: FlowStep[] = [
  {
    label: "Buy",
    detail: "Pay on a secure page. You see the license, receipt, and access method before checkout.",
  },
  {
    label: "Unlock",
    detail: "Open your access key from your library. The file decrypts on your device, not our servers.",
  },
  {
    label: "Verify",
    detail: "Anyone can check your receipt and package at its printed address — online or offline.",
  },
];
