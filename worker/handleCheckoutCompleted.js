/**
 * Traitement de l’événement webhook checkout.session.completed
 * (blueprint : confirmer le paiement ponctuel).
 */

import { markOrderPaid } from './orders.js'

/**
 * @param {import('@cloudflare/workers-types').D1Database | undefined} db
 * @param {object} session  objet Checkout Session Stripe
 * @returns {Promise<{ handled: boolean, orderId?: string }>}
 */
export async function handleCheckoutSessionCompleted(db, session) {
  if (!session || typeof session !== 'object') {
    return { handled: false }
  }

  const orderId = session.metadata?.order_id || session.client_reference_id
  const paymentIntent =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id
  const email =
    session.customer_details?.email || session.customer_email || null
  const customerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id || null

  // Snapshot event : paid ou complete
  const paid =
    session.payment_status === 'paid' || session.status === 'complete'

  if (!paid) {
    return { handled: false, orderId: orderId || undefined }
  }

  await markOrderPaid(db, {
    orderId,
    sessionId: session.id,
    paymentIntent,
    email,
    customerId,
  })

  return { handled: true, orderId: orderId || undefined }
}
