import type { Listing, ListingId } from "@my-digital/types";
import { useState } from "react";
import { Link } from "react-router-dom";
import { formatPrice } from "../lib/format";
import { useMarketplace } from "../lib/marketplace";

interface EditDraft {
  title: string;
  description: string;
  priceDollars: string;
  priceCurrency: string;
}

function statusPillClass(status: Listing["status"]): string {
  if (status === "active") return "pill pill-pass";
  if (status === "archived") return "pill pill-demo";
  return "pill pill-warning";
}

export function CreatorListingsManager({ listings }: { listings: Listing[] }) {
  const { actions } = useMarketplace();
  const [editingId, setEditingId] = useState<ListingId | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function startEdit(listing: Listing) {
    setError(null);
    setEditingId(listing.id);
    setDraft({
      title: listing.title,
      description: listing.description,
      priceDollars: (listing.priceAmount / 100).toFixed(2),
      priceCurrency: listing.priceCurrency
    });
  }

  async function run(id: string, task: () => Promise<unknown>) {
    setBusyId(id);
    setError(null);
    try {
      await task();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyId(null);
    }
  }

  async function saveEdit(listing: Listing) {
    if (!draft) return;
    const dollars = Number(draft.priceDollars);
    if (!Number.isFinite(dollars) || dollars < 0) {
      setError("Enter a valid price.");
      return;
    }
    await run(listing.id, async () => {
      await actions.updateListing({
        listingId: listing.id,
        title: draft.title,
        description: draft.description,
        priceAmount: Math.round(dollars * 100),
        priceCurrency: draft.priceCurrency
      });
      setEditingId(null);
      setDraft(null);
    });
  }

  if (listings.length === 0) {
    return (
      <section className="panel">
        <h2>Your listings (0)</h2>
        <p>
          Nothing listed yet. <Link to="/sell">Lock and list a product</Link>.
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Your listings ({listings.length})</h2>
      <p>Edit details, change status (pause or unlist), or delete unsold listings.</p>
      {error && <p className="panel-error">{error}</p>}
      <div className="listing-manager">
        {listings.map((listing) => {
          const editing = editingId === listing.id;
          const busy = busyId === listing.id;
          return (
            <article className="manage-card" key={listing.id}>
              {editing && draft ? (
                <div className="form">
                  <label className="field">
                    Title
                    <input
                      value={draft.title}
                      onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                    />
                  </label>
                  <label className="field">
                    Description
                    <textarea
                      rows={2}
                      value={draft.description}
                      onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                    />
                  </label>
                  <div className="field-row">
                    <label className="field">
                      Price
                      <input
                        value={draft.priceDollars}
                        inputMode="decimal"
                        onChange={(event) =>
                          setDraft({ ...draft, priceDollars: event.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      Currency
                      <input
                        value={draft.priceCurrency}
                        maxLength={3}
                        onChange={(event) =>
                          setDraft({ ...draft, priceCurrency: event.target.value })
                        }
                      />
                    </label>
                  </div>
                  <div className="hero-actions">
                    <button
                      className="btn btn-primary btn-small"
                      type="button"
                      disabled={busy}
                      onClick={() => void saveEdit(listing)}
                    >
                      {busy ? "Saving…" : "Save changes"}
                    </button>
                    <button
                      className="btn btn-ghost btn-small"
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setDraft(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="manage-head">
                    <div>
                      <h3 className="manage-title">{listing.title}</h3>
                      <p className="manage-meta">
                        {formatPrice(listing.priceAmount, listing.priceCurrency)} ·{" "}
                        {listing.description}
                      </p>
                    </div>
                    <span className={statusPillClass(listing.status)}>
                      {listing.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="manage-actions">
                    <label className="manage-status">
                      Status
                      <select
                        value={listing.status === "draft" ? "active" : listing.status}
                        disabled={busy}
                        onChange={(event) =>
                          void run(listing.id, () =>
                            actions.updateListing({
                              listingId: listing.id,
                              status: event.target.value as "active" | "paused" | "archived"
                            })
                          )
                        }
                      >
                        <option value="active">Active (listed)</option>
                        <option value="paused">Paused (hidden)</option>
                        <option value="archived">Archived (unlisted)</option>
                      </select>
                    </label>
                    <Link className="btn btn-ghost btn-small" to={`/listing/${listing.id}`}>
                      View
                    </Link>
                    <button
                      className="btn btn-ghost btn-small"
                      type="button"
                      onClick={() => startEdit(listing)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger btn-small"
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete "${listing.title}"? This removes the listing and its locked package. Listings with sales can't be deleted — archive those instead.`
                          )
                        ) {
                          void run(listing.id, () => actions.deleteListing(listing.id));
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
