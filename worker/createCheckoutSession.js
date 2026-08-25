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
 * @param {string} [opts.customerId]
 * @param {{ submit?: string, shipping?: string }} [opts.customText]
 * @param {string} [opts.receiptEmail]
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
    customerId,
    metadata = {},
    locale = 'fr',
    paymentDescription,
    customText = {},
    receiptEmail,
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
    submit_type: 'pay',
    billing_address_collection: 'required',
    phone_number_collection: { enabled: true },
    name_collection: { individual: { enabled: true } },
    tax_id_collection: { enabled: true },
    shipping_address_collection: {
      allowed_countries: [
        'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE',
        'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT',
        'RO', 'SK', 'SI', 'ES', 'SE', 'CH', 'GB', 'MC',
      ],
    },
    line_items: [
      {
        price: priceId,
        quantity,
      },
    ],
    metadata,
  }

  if (customText.submit) {
    body.custom_text = {
      ...(body.custom_text || {}),
      submit: { message: String(customText.submit).slice(0, 1200) },
    }
  }
  if (customText.shipping) {
    body.custom_text = {
      ...(body.custom_text || {}),
      shipping_address: { message: String(customText.shipping).slice(0, 1200) },
    }
  }

  if (clientReferenceId) {
    body.client_reference_id = String(clientReferenceId).slice(0, 200)
  }
  if (customerId) {
    body.customer = customerId
  } else if (customerEmail) {
    body.customer_email = String(customerEmail).slice(0, 256)
  }
  if (paymentDescription || metadata.order_id || receiptEmail) {
    body.payment_intent_data = {
      description: paymentDescription || `Commande ${metadata.order_id || ''}`,
      metadata: {
        order_id: metadata.order_id || '',
        quote_ref: metadata.quote_ref || '',
      },
      ...(receiptEmail
        ? { receipt_email: String(receiptEmail).slice(0, 256) }
        : {}),
    }
  }

  return stripeRequest(secretKey, '/v1/checkout/sessions', body)
}
