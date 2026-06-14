import type { Creator } from "@my-digital/types";
import { VerifiedBadge } from "./VerifiedBadge";

/** Public "sold by" creator identity shown on listings and the home page. */
export function CreatorBadge({ creator }: { creator: Creator }) {
  return (
    <div className="creator-badge">
      {creator.avatarUrl ? (
        <img className="avatar avatar-sm" src={creator.avatarUrl} alt="" />
      ) : (
        <span className="avatar avatar-sm avatar-empty" aria-hidden="true" />
      )}
      <div className="creator-badge-body">
        <span className="creator-badge-name">
          {creator.displayName} <span className="creator-badge-handle">@{creator.handle}</span>
          <VerifiedBadge creator={creator} />
        </span>
        {creator.bio && <span className="creator-badge-bio">{creator.bio}</span>}
        {creator.websiteUrl && (
          <a
            className="creator-badge-link"
            href={creator.websiteUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            {creator.websiteUrl.replace(/^https?:\/\//, "")}
          </a>
        )}
      </div>
    </div>
  );
}
