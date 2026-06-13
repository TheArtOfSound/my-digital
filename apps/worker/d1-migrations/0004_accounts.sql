-- Accounts (email+password), sessions, multi-seller ownership + seller
-- verification fields. Mirrors packages/store/drizzle/0005_complete_cobalt_man.sql.
CREATE TABLE users (
  id text PRIMARY KEY NOT NULL,
  email text NOT NULL,
  email_lower text NOT NULL,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  created_at text NOT NULL
);
CREATE UNIQUE INDEX users_email_lower_unique ON users (email_lower);

CREATE TABLE sessions (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  created_at text NOT NULL,
  expires_at text NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

ALTER TABLE buyers ADD user_id text;
ALTER TABLE creators ADD user_id text;
ALTER TABLE creators ADD legal_name text;
ALTER TABLE creators ADD location text;
ALTER TABLE creators ADD verification_links text;
ALTER TABLE creators ADD verification_submitted_at text;
