-- Commandes Philae (Cloudflare D1)
-- Création : wrangler d1 execute philae-orders --file=worker/schema.sql
-- Local    : wrangler d1 execute philae-orders --local --file=worker/schema.sql

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  quote_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  -- full | deposit (acompte paramétrable plus tard)
  payment_mode TEXT NOT NULL DEFAULT 'full',
  deposit_percent INTEGER NOT NULL DEFAULT 100,
  amount_ht_cents INTEGER NOT NULL,
  amount_tva_cents INTEGER NOT NULL,
  amount_ttc_cents INTEGER NOT NULL,
  amount_charged_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'eur',
  customer_email TEXT,
  customer_name TEXT,
  -- Stripe Customer (si renvoyé par Checkout)
  stripe_customer_id TEXT,
  product_label TEXT,
  -- Snapshot configuration / catalogue (JSON)
  config_json TEXT,
  source TEXT,
  -- id produit catalogue Philae (pas Stripe)
  catalog_product_id TEXT,
  -- Identifiants Stripe (blueprint product → price → session)
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  stripe_session_id TEXT,
  stripe_payment_intent TEXT,
  created_at TEXT NOT NULL,
  paid_at TEXT,
  updated_at TEXT,
  user_id TEXT,
  guest_email TEXT,
  cgv_accepted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_product ON orders(stripe_product_id);
