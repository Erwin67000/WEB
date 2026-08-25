/**
 * Client checkout Philae → API Worker Stripe.
 * Ne contient jamais la clé secrète Stripe (uniquement appels /api/*).
 */

/**
 * Crée une Session Checkout et renvoie l’URL Stripe.
 *
 * @param {object} payload
 * @param {'configurator'|'boutique'} payload.source
 * @param {string} payload.quoteRef
 * @param {string} payload.productLabel
 * @param {string} [payload.productId]
 * @param {'full'|'deposit'} [payload.paymentMode='full']
 * @param {number} [payload.depositPercent]
 * @param {{ ht: number, tva: number, ttc: number }} payload.pricing
 * @param {{ name?: string, email?: string, phone?: string }} [payload.contact]
 * @param {object} [payload.config] snapshot configuration
 * @returns {Promise<{
 *   ok: boolean,
 *   url: string,
 *   orderId: string,
 *   sessionId: string,
 *   paymentMode: string,
 *   amountChargedCents: number,
 * }>}
 */
import { STRIPE_ENABLED } from './payments.js'

export async function createCheckoutSession(payload) {
  if (!STRIPE_ENABLED) {
    throw new Error('STRIPE_DISABLED')
  }
  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paymentMode: 'full',
      ...payload,
    }),
  })

  let data = {}
  try {
    data = await res.json()
  } catch {
    data = {}
  }

  if (!res.ok) {
    throw new Error(data.error || `Checkout impossible (${res.status})`)
  }
  if (!data.url) {
    throw new Error('Réponse Stripe sans URL de paiement')
  }
  return data
}

/**
 * Charge le statut d’une commande (page succès).
 * @param {{ orderId?: string, sessionId?: string }} q
 */
export async function fetchOrderStatus({ orderId, sessionId } = {}) {
  const id = orderId || 'by-session'
  const params = new URLSearchParams()
  if (sessionId) params.set('session_id', sessionId)
  const qs = params.toString()
  const res = await fetch(`/api/orders/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || 'Commande introuvable')
  }
  return data
}

/**
 * Libellé produit pour Checkout à partir d’unités configurateur.
 * @param {Array<{ label?: string, dims?: { L: number, W: number, H: number } }>} units
 */
export function labelFromUnits(units = []) {
  if (!units.length) return 'Mobilier Philae sur mesure'
  const u = units[0]
  const dims = u.dims
    ? `${Math.round(u.dims.L)}×${Math.round(u.dims.W)}×${Math.round(u.dims.H)} mm`
    : ''
  const name = u.label || 'Meuble Philae'
  if (units.length === 1) {
    return dims ? `${name} (${dims})` : name
  }
  return `${name} + ${units.length - 1} autre(s)`
}
