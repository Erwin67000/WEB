/**
 * Persistance commandes — Cloudflare D1.
 * Si env.DB est absent (dev sans D1), les opérations no-op / lecture null.
 */

function nowIso() {
  return new Date().toISOString()
}

/**
 * @param {import('@cloudflare/workers-types').D1Database | undefined} db
 * @param {object} order
 */
export async function insertOrder(db, order) {
  if (!db) {
    console.warn('[orders] D1 non configuré — commande non persistée', order.id)
    return { persisted: false }
  }

  await db
    .prepare(
      `INSERT INTO orders (
        id, quote_ref, status, payment_mode, deposit_percent,
        amount_ht_cents, amount_tva_cents, amount_ttc_cents, amount_charged_cents,
        currency, customer_email, customer_name, stripe_customer_id,
        product_label, config_json, source, catalog_product_id,
        stripe_product_id, stripe_price_id, stripe_session_id,
        created_at, updated_at,
        user_id, guest_email, cgv_accepted_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?
      )`,
    )
    .bind(
      order.id,
      order.quote_ref,
      order.status || 'pending',
      order.payment_mode || 'full',
      order.deposit_percent ?? 100,
      order.amount_ht_cents,
      order.amount_tva_cents,
      order.amount_ttc_cents,
      order.amount_charged_cents,
      order.currency || 'eur',
      order.customer_email || null,
      order.customer_name || null,
      order.stripe_customer_id || null,
      order.product_label || null,
      order.config_json || null,
      order.source || null,
      order.catalog_product_id || order.product_id || null,
      order.stripe_product_id || null,
      order.stripe_price_id || null,
      order.stripe_session_id || null,
      order.created_at || nowIso(),
      order.updated_at || nowIso(),
      order.user_id || null,
      order.guest_email || null,
      order.cgv_accepted_at || null,
    )
    .run()

  return { persisted: true }
}

/**
 * Enregistre les ids Stripe produit / tarif après createProduct.
 */
export async function updateOrderStripeCatalog(
  db,
  orderId,
  { stripeProductId, stripePriceId },
) {
  if (!db) return
  await db
    .prepare(
      `UPDATE orders SET
        stripe_product_id = ?,
        stripe_price_id = ?,
        updated_at = ?
      WHERE id = ?`,
    )
    .bind(stripeProductId || null, stripePriceId || null, nowIso(), orderId)
    .run()
}

export async function updateOrderSession(db, orderId, stripeSessionId) {
  if (!db) return
  await db
    .prepare(
      `UPDATE orders SET stripe_session_id = ?, updated_at = ? WHERE id = ?`,
    )
    .bind(stripeSessionId, nowIso(), orderId)
    .run()
}

export async function markOrderPaid(
  db,
  { orderId, sessionId, paymentIntent, email, customerId },
) {
  if (!db) return { updated: false }
  const paidAt = nowIso()

  if (orderId) {
    await db
      .prepare(
        `UPDATE orders SET
          status = 'paid',
          paid_at = ?,
          updated_at = ?,
          stripe_payment_intent = COALESCE(?, stripe_payment_intent),
          customer_email = COALESCE(?, customer_email),
          stripe_customer_id = COALESCE(?, stripe_customer_id),
          stripe_session_id = COALESCE(?, stripe_session_id)
        WHERE id = ?`,
      )
      .bind(
        paidAt,
        paidAt,
        paymentIntent || null,
        email || null,
        customerId || null,
        sessionId || null,
        orderId,
      )
      .run()
    return { updated: true, orderId }
  }

  if (sessionId) {
    await db
      .prepare(
        `UPDATE orders SET
          status = 'paid',
          paid_at = ?,
          updated_at = ?,
          stripe_payment_intent = COALESCE(?, stripe_payment_intent),
          customer_email = COALESCE(?, customer_email),
          stripe_customer_id = COALESCE(?, stripe_customer_id)
        WHERE stripe_session_id = ?`,
      )
      .bind(
        paidAt,
        paidAt,
        paymentIntent || null,
        email || null,
        customerId || null,
        sessionId,
      )
      .run()
    return { updated: true, sessionId }
  }

  return { updated: false }
}

export async function getOrderById(db, id) {
  if (!db || !id) return null
  return db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(id).first()
}

export async function getOrderBySession(db, sessionId) {
  if (!db || !sessionId) return null
  return db
    .prepare(`SELECT * FROM orders WHERE stripe_session_id = ?`)
    .bind(sessionId)
    .first()
}
