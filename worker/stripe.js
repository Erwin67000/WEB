/**
 * Client Stripe minimal pour Cloudflare Workers (fetch + form-urlencoded).
 * Pas de SDK Node — compatible runtime Workers.
 */

/**
 * Encode un objet imbriqué en paires form Stripe.
 * @returns {string[]} segments key=value déjà encodés
 */
function encodeStripeParts(data, prefix = '') {
  const parts = []
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue
    const fullKey = prefix ? `${prefix}[${key}]` : key
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item !== null && typeof item === 'object') {
          parts.push(...encodeStripeParts(item, `${fullKey}[${i}]`))
        } else if (item !== undefined && item !== null) {
          parts.push(
            `${encodeURIComponent(`${fullKey}[${i}]`)}=${encodeURIComponent(String(item))}`,
          )
        }
      })
    } else if (typeof value === 'object') {
      parts.push(...encodeStripeParts(value, fullKey))
    } else {
      parts.push(
        `${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`,
      )
    }
  }
  return parts
}

export function encodeStripeForm(data) {
  return encodeStripeParts(data).join('&')
}

/**
 * Appel API Stripe.
 * @param {string} secretKey
 * @param {string} path ex. '/v1/checkout/sessions'
 * @param {object|null} [body] objet → form-urlencoded (POST)
 * @param {string} [method]
 */
export async function stripeRequest(secretKey, path, body = null, method = 'POST') {
  const url = `https://api.stripe.com${path}`
  /** @type {Record<string, string>} */
  const headers = {
    Authorization: `Bearer ${secretKey}`,
  }
  /** @type {RequestInit} */
  const init = { method, headers }

  if (body && method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    init.body = encodeStripeForm(body)
  }

  const res = await fetch(url, init)
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      json?.error?.message ||
      json?.error?.type ||
      `Stripe HTTP ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    err.stripe = json?.error
    throw err
  }
  return json
}

/**
 * Vérifie la signature d’un webhook Stripe (v1).
 * @see https://stripe.com/docs/webhooks/signatures
 */
export async function verifyStripeWebhook(rawBody, signatureHeader, webhookSecret) {
  if (!signatureHeader || !webhookSecret) {
    throw new Error('Signature webhook manquante')
  }

  const timestamp = signatureHeader
    .split(',')
    .map((p) => p.trim())
    .find((p) => p.startsWith('t='))
    ?.slice(2)

  const signatures = signatureHeader
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.startsWith('v1='))
    .map((p) => p.slice(3))

  if (!timestamp || !signatures.length) {
    throw new Error('En-tête Stripe-Signature invalide')
  }

  const ts = Number(timestamp)
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - ts) > 300) {
    throw new Error('Timestamp webhook expiré')
  }

  const signedPayload = `${timestamp}.${rawBody}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBuf = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signedPayload),
  )
  const expected = [...new Uint8Array(sigBuf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  const ok = signatures.some((s) => timingSafeEqual(s, expected))
  if (!ok) throw new Error('Signature webhook invalide')

  return JSON.parse(rawBody)
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}
