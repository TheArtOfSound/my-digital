import type { Creator } from "@my-digital/types";
import { useState, type FormEvent } from "react";
import { fileToAvatarDataUrl } from "../lib/image";
import { useMarketplace } from "../lib/marketplace";

export function CreatorProfileEditor({ creator }: { creator: Creator }) {
  const { actions } = useMarketplace();
  const [displayName, setDisplayName] = useState(creator.displayName);
  const [handle, setHandle] = useState(creator.handle);
  const [bio, setBio] = useState(creator.bio ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(creator.websiteUrl ?? "");
  const [avatarUrl, setAvatarUrl] = useState(creator.avatarUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onAvatar(file: File | null) {
    if (!file) return;
    setError(null);
    setSaved(false);
    try {
      setAvatarUrl(await fileToAvatarDataUrl(file));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await actions.updateCreatorProfile({ displayName, handle, bio, avatarUrl, websiteUrl });
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>Edit profile</h2>
      <p>
        Your name, handle, photo, and bio appear to buyers on every listing you sell. Only a hash of
        your email is stored.
      </p>
      <form className="form" onSubmit={onSubmit}>
        <div className="avatar-row">
          {avatarUrl ? (
            <img className="avatar" src={avatarUrl} alt="Profile preview" />
          ) : (
            <span className="avatar avatar-empty">No photo</span>
          )}
          <div className="avatar-controls">
            <label className="field">
              Profile picture
              <input
                type="file"
                accept="image/*"
                onChange={(event) => void onAvatar(event.target.files?.[0] ?? null)}
              />
            </label>
            {avatarUrl && (
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => {
                  setAvatarUrl("");
                  setSaved(false);
                }}
              >
                Remove photo
              </button>
            )}
          </div>
        </div>
        <label className="field">
          Display name
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={80}
            required
          />
        </label>
        <label className="field">
          Handle
          <input
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            maxLength={32}
            required
          />
        </label>
        <label className="field">
          Bio
          <textarea
            rows={3}
            value={bio}
            maxLength={600}
            onChange={(event) => setBio(event.target.value)}
            placeholder="What you make and why buyers can trust your proofs."
          />
        </label>
        <label className="field">
          Website (optional)
          <input
            value={websiteUrl}
            onChange={(event) => setWebsiteUrl(event.target.value)}
            placeholder="https://"
          />
        </label>
        {error && <p className="panel-error">{error}</p>}
        {saved && <p className="hint">Profile saved.</p>}
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? "Saving…" : "Save profile"}
        </button>
      </form>
    </section>
  );
}
