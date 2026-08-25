/**
 * Crée un produit Stripe + tarif par défaut (blueprint one-time payment).
 * POST /v1/products  +  default_price_data
 *
 * Chaque commande Philae a un prix dynamique (config / catalogue) :
 * on crée donc un produit Stripe par commande, puis on réutilise
 * `default_price` dans la Checkout Session.
 */

import { stripeRequest } from './stripe.js'

/**
 * @param {string} secretKey
 * @param {object} opts
 * @param {string} opts.name
 * @param {string} [opts.description]
 * @param {number} opts.unitAmountCents  montant en centimes
 * @param {string} [opts.currency='eur']
 * @param {Record<string, string>} [opts.metadata]
 * @param {string[]} [opts.images] URLs HTTPS publiques
 * @returns {Promise<{ productId: string, priceId: string, product: object }>}
 */
export async function createProductWithDefaultPrice(secretKey, opts) {
  const {
    name,
    description,
    unitAmountCents,
    currency = 'eur',
    metadata = {},
    images = [],
  } = opts

  if (!name) throw new Error('Nom produit requis')
  if (!Number.isFinite(unitAmountCents) || unitAmountCents < 50) {
    throw new Error('Montant produit invalide (min. 50 centimes)')
  }

  /** Blueprint : POST /v1/products + default_price_data */
  const product = await stripeRequest(secretKey, '/v1/products', {
    name: String(name).slice(0, 250),
    ...(description
      ? { description: String(description).slice(0, 500) }
      : {}),
    ...(Array.isArray(images) && images.length
      ? { images: images.slice(0, 8) }
      : {}),
    default_price_data: {
      currency: String(currency).toLowerCase(),
      unit_amount: Math.round(unitAmountCents),
      // TVA française déjà dans le TTC côté Philae
      tax_behavior: 'inclusive',
    },
    metadata,
  })

  // default_price peut être un id string ou un objet expansé
  const priceId =
    typeof product.default_price === 'string'
      ? product.default_price
      : product.default_price?.id

  if (!priceId) {
    throw new Error('Stripe n’a pas renvoyé default_price pour le produit')
  }

  return {
    productId: product.id,
    priceId,
    product,
  }
}
