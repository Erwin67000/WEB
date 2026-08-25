/**
 * Paiement en ligne. Laisser `false` jusqu’à activation Stripe.
 * L’acceptation des CGV reste obligatoire avant tout accès au paiement.
 */
export const STRIPE_ENABLED = false

export function isFranceCountry(country) {
  const s = String(country || '')
    .trim()
    .toUpperCase()
  return s === 'FR' || s === 'FRA' || s === 'FRANCE' || s.startsWith('FR ')
}
