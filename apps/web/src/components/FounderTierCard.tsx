import { FUNDRAISING_URL, type FounderTier } from "../lib/launch";

/**
 * One founder/backer reward tier. Reward-based only — no equity/returns/tokens
 * language anywhere. If the payment link is configured it routes to checkout;
 * otherwise it shows an honest "opens soon" state instead of a dead button.
 */
export function FounderTierCard({ tier }: { tier: FounderTier }) {
  const live = FUNDRAISING_URL.length > 0;
  return (
    <article className="tier-card">
      <header className="tier-head">
        <h3>{tier.name}</h3>
        <span className="tier-price">{tier.price}</span>
      </header>
      <ul className="tier-rewards">
        {tier.rewards.map((reward) => (
          <li key={reward}>{reward}</li>
        ))}
      </ul>
      {live ? (
        <a
          className="btn btn-primary btn-small"
          href={FUNDRAISING_URL}
          target="_blank"
          rel="noreferrer"
        >
          Back this tier
        </a>
      ) : (
        <span className="pill pill-demo">Founder access opens soon</span>
      )}
    </article>
  );
}
