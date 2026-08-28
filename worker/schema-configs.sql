-- Configurations meuble liées au compte client
-- wrangler d1 execute philae-orders --remote --file=worker/schema-configs.sql

CREATE TABLE IF NOT EXISTS saved_configs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  quote_ref TEXT,
  json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saved_configs_user
  ON saved_configs(user_id, updated_at);
