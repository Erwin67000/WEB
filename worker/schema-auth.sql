-- Comptes clients Philae (D1)
-- wrangler d1 execute philae-orders --local --file=worker/schema-auth.sql
-- wrangler d1 execute philae-orders --remote --file=worker/schema-auth.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  image TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  is_guest INTEGER NOT NULL DEFAULT 0,
  cgv_accepted_at TEXT,
  cgv_version TEXT,
  newsletter_opt_in INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS magic_links (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  cgv INTEGER NOT NULL DEFAULT 0,
  newsletter INTEGER NOT NULL DEFAULT 0,
  name TEXT,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (provider, provider_user_id)
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  nonce TEXT,
  expires_at TEXT NOT NULL
);

ALTER TABLE orders ADD COLUMN user_id TEXT;
ALTER TABLE orders ADD COLUMN guest_email TEXT;
ALTER TABLE orders ADD COLUMN cgv_accepted_at TEXT;
