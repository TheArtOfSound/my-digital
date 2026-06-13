-- Creator profile fields: bio, avatar, website. Mirrors
-- packages/store/drizzle/0003_ambiguous_expediter.sql for the D1 deployment.
ALTER TABLE creators ADD bio text;
ALTER TABLE creators ADD avatar_url text;
ALTER TABLE creators ADD website_url text;
