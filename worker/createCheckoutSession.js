/**
 * Crée une Checkout Session Stripe (mode payment — paiement ponctuel).
 * Blueprint : POST /v1/checkout/sessions
 *   line_items[{ price, quantity }], mode=payment, success_url, cancel_url
 */

import { stripeRequest } from './stripe.js'

/**
 * @param {string} secretKey
 * @param {object} opts
 * @param {string} opts.priceId           id tarif (default_price du produit)
 * @param {number} [opts.quantity=1]
 * @param {string} opts.successUrl
 * @param {string} opts.cancelUrl
 * @param {string} [opts.clientReferenceId]
 * @param {string} [opts.customerEmail]
 * @param {Record<string, string>} [opts.metadata]
 * @param {string} [opts.locale='fr']
 * @param {string} [opts.paymentDescription]
 * @returns {Promise<object>} session Stripe (contient url, id, …)
 */
export async function createCheckoutSession(secretKey, opts) {
  const {
    priceId,
    quantity = 1,
    successUrl,
    cancelUrl,
    clientReferenceId,
    customerEmail,
    metadata = {},
    locale = 'fr',
    paymentDescription,
  } = opts

  if (!priceId) throw new Error('priceId requis pour la Checkout Session')
  if (!successUrl || !cancelUrl) {
    throw new Error('success_url et cancel_url requis')
  }

  /** Blueprint : mode payment + line_items sur un price existant */
  const body = {
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    locale,
    billing_address_collection: 'required',
    phone_number_collection: { enabled: true },
    line_items: [
      {
        price: priceId,
        quantity,
      },
    ],
    metadata,
  }

  if (clientReferenceId) {
    body.client_reference_id = String(clientReferenceId).slice(0, 200)
  }
  if (customerEmail) {
    body.customer_email = String(customerEmail).slice(0, 256)
  }
  if (paymentDescription || metadata.order_id) {
    body.payment_intent_data = {
      description: paymentDescription || `Commande ${metadata.order_id || ''}`,
      metadata: {
        order_id: metadata.order_id || '',
        quote_ref: metadata.quote_ref || '',
      },
    }
  }

  return stripeRequest(secretKey, '/v1/checkout/sessions', body)
}
