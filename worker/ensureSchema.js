/**
 * Crée les tables auth / brouillons si absentes (prod comme local).
 */

const CREATE = [
  `CREATE TABLE IF NOT EXISTS users (
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
    address_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS magic_links (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    cgv INTEGER NOT NULL DEFAULT 0,
    newsletter INTEGER NOT NULL DEFAULT 0,
    name TEXT,
    expires_at TEXT NOT NULL,
    consumed_at TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS oauth_accounts (
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (provider, provider_user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS oauth_states (
    state TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    nonce TEXT,
    draft_id TEXT,
    expires_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS checkout_drafts (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_drafts_user ON checkout_drafts(user_id)`,
]

const ALTER = [
  `ALTER TABLE orders ADD COLUMN user_id TEXT`,
  `ALTER TABLE orders ADD COLUMN guest_email TEXT`,
  `ALTER TABLE orders ADD COLUMN cgv_accepted_at TEXT`,
  `ALTER TABLE orders ADD COLUMN confirmation_sent_at TEXT`,
  `ALTER TABLE users ADD COLUMN address_json TEXT`,
  `ALTER TABLE oauth_states ADD COLUMN draft_id TEXT`,
]

let ready = false
let inflight = null

export async function ensureSchema(db) {
  if (!db || ready) return
  if (inflight) return inflight
  inflight = (async () => {
    for (const sql of CREATE) {
      await db.prepare(sql).run()
    }
    for (const sql of ALTER) {
      try {
        await db.prepare(sql).run()
      } catch {
        /* colonne déjà présente */
      }
    }
    ready = true
  })().finally(() => {
    inflight = null
  })
  return inflight
}
