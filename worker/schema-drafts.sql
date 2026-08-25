CREATE TABLE IF NOT EXISTS checkout_drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_drafts_user ON checkout_drafts(user_id);

ALTER TABLE oauth_states ADD COLUMN draft_id TEXT;
ALTER TABLE orders ADD COLUMN confirmation_sent_at TEXT;
ALTER TABLE users ADD COLUMN address_json TEXT;
