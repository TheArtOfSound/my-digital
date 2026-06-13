-- Independent creator payouts (Stripe Connect) + connected-account checkout.
-- Mirrors packages/store/drizzle/0004_legal_obadiah_stane.sql for D1.
ALTER TABLE checkout_sessions ADD connected_account_id text;
ALTER TABLE creators ADD stripe_account_id text;
ALTER TABLE creators ADD payouts_enabled integer;
