/**
 * Philae — Cloudflare Worker (Stripe one-time Checkout blueprint)
 *
 * Séquence (noms domaine, pas numéros de chapitre) :
 *   1. createProductWithDefaultPrice  → POST /v1/products
 *   2. createCheckoutSession          → POST /v1/checkout/sessions (mode=payment)
 *   3. handleCheckoutSessionCompleted → webhook checkout.session.completed
 *
 * Routes :
 *   POST /api/checkout            → produit + tarif + session → { url }
 *   POST /api/webhooks/stripe     → confirmation paiement
 *   GET  /api/orders/:id          → lecture commande (page succès)
 *   GET  /api/health
 */

import { stripeRequest, verifyStripeWebhook } from './stripe.js'
import { createProductWithDefaultPrice } from './createProduct.js'
import { createCheckoutSession } from './createCheckoutSession.js'
import { handleCheckoutSessionCompleted } from './handleCheckoutCompleted.js'
import {
  insertOrder,
  updateOrderStripeCatalog,
  updateOrderSession,
  getOrderById,
  getOrderBySession,
} from './orders.js'
import { presentOrder, isoCountry } from './orderPresentation.js'
import { handleAuth, getSessionUser } from './auth.js'
import { handleDrafts } from './drafts.js'
import { handleConfigs } from './configs.js'
import { sendMail, orderConfirmationCopy } from './mail.js'
import { ensureSchema } from './ensureSchema.js'

/** Acompte futur : 100 = paiement total. Override via env.DEPOSIT_PERCENT */
const DEFAULT_DEPOSIT_PERCENT = 100

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  })
}

function corsHeaders(origin, env) {
  const allowed = (env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const ok =
    !allowed.length ||
    allowed.includes(origin) ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  return {
    'Access-Control-Allow-Origin': ok ? origin || '*' : allowed[0] || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature',
    'Access-Control-Allow-Credentials': 'true',
  }
}

function eurosToCents(n) {
  const v = Math.round(Number(n) * 100)
  if (!Number.isFinite(v) || v < 50) {
    throw new Error('Montant invalide (minimum 0,50 €)')
  }
  return v
}

function makeOrderId() {
  const t = Date.now().toString(36).toUpperCase()
  const r = crypto.randomUUID().slice(0, 8).toUpperCase()
  return `PHL-${t}-${r}`
}

function siteOrigin(request, env) {
  if (env.SITE_URL) return env.SITE_URL.replace(/\/$/, '')
  return new URL(request.url).origin
}

/**
 * Tunnel paiement ponctuel (blueprint Checkout) :
 * createProduct → createCheckoutSession → client suit session.url
 */
async function handleCreateCheckout(request, env) {
  if (!env.STRIPE_SECRET_KEY) {
    return json(
      {
        error:
          'Stripe non configuré (STRIPE_SECRET_KEY manquant). Voir .dev.vars.example',
      },
      503,
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'JSON invalide' }, 400)
  }

  const pricing = body.pricing || {}
  const ht = Number(pricing.ht)
  const tva = Number(pricing.tva)
  const ttc = Number(pricing.ttc)

  if (![ht, tva, ttc].every((n) => Number.isFinite(n)) || ttc <= 0) {
    return json({ error: 'pricing.ht / tva / ttc requis' }, 400)
  }

  const paymentMode = body.paymentMode === 'deposit' ? 'deposit' : 'full'
  const depositPercent =
    paymentMode === 'deposit'
      ? Math.min(
          100,
          Math.max(
            1,
            Number(body.depositPercent) || Number(env.DEPOSIT_PERCENT) || 30,
          ),
        )
      : DEFAULT_DEPOSIT_PERCENT

  const amountTtcCents = eurosToCents(ttc)
  const amountHtCents = Math.round(ht * 100)
  const amountTvaCents = Math.round(tva * 100)
  const amountChargedCents =
    paymentMode === 'deposit'
      ? Math.max(50, Math.round((amountTtcCents * depositPercent) / 100))
      : amountTtcCents

  const sessionUser = await getSessionUser(request, env)
  if (!sessionUser) {
    return json({ error: 'AUTH_REQUIRED' }, 401)
  }
  if (!sessionUser.cgvAcceptedAt) {
    return json({ error: 'CGV_REQUIRED' }, 400)
  }

  const orderId = makeOrderId()
  const quoteRef = String(body.quoteRef || orderId).slice(0, 64)
  const origin = siteOrigin(request, env)
  const contact = {
    ...(body.config?.contact || {}),
    ...(body.contact || {}),
    email: body.contact?.email || body.config?.contact?.email || sessionUser.email,
    name:
      body.contact?.name ||
      sessionUser.name ||
      `${body.config?.contact?.firstName || ''} ${body.config?.contact?.lastName || ''}`.trim(),
  }
  const catalogProductId = body.productId ? String(body.productId) : null
  const presentation = presentOrder(body, quoteRef, origin)
  const productLabel = String(
    presentation.name || body.productLabel || 'Meuble PHILAE',
  ).slice(0, 120)
  const description = presentation.description
  const customerName =
    contact.name ||
    `${contact.firstName || ''} ${contact.lastName || ''}`.trim()

  let configJson = null
  try {
    configJson = body.config
      ? JSON.stringify(body.config).slice(0, 900_000)
      : null
  } catch {
    configJson = null
  }

  const createdAt = new Date().toISOString()

  // Enregistrement commande locale (pending) avant appels Stripe
  await insertOrder(env.DB, {
    id: orderId,
    quote_ref: quoteRef,
    status: 'pending',
    payment_mode: paymentMode,
    deposit_percent: depositPercent,
    amount_ht_cents: amountHtCents,
    amount_tva_cents: amountTvaCents,
    amount_ttc_cents: amountTtcCents,
    amount_charged_cents: amountChargedCents,
    currency: 'eur',
    customer_email: contact.email || sessionUser?.email || null,
    customer_name: customerName || sessionUser?.name || null,
    product_label: productLabel,
    config_json: configJson,
    source: body.source || 'configurator',
    catalog_product_id: catalogProductId,
    user_id: sessionUser.id,
    guest_email: sessionUser.isGuest ? sessionUser.email : null,
    cgv_accepted_at: sessionUser.cgvAcceptedAt,
    stripe_customer_id: sessionUser.stripeCustomerId || null,
    created_at: createdAt,
    updated_at: createdAt,
  })

  // —— 1. Créer produit + tarif (POST /v1/products + default_price_data) ——
  let stripeProductId
  let stripePriceId
  try {
    const created = await createProductWithDefaultPrice(env.STRIPE_SECRET_KEY, {
      name: productLabel,
      description,
      unitAmountCents: amountChargedCents,
      currency: 'eur',
      images: presentation.imageUrl ? [presentation.imageUrl] : [],
      metadata: {
        order_id: orderId,
        quote_ref: quoteRef,
        payment_mode: paymentMode,
        catalog_product_id: catalogProductId || '',
        source: String(body.source || 'configurator'),
      },
    })
    stripeProductId = created.productId
    stripePriceId = created.priceId
  } catch (e) {
    console.error('[createProduct]', e.message, e.stripe)
    return json({ error: e.message || 'Erreur création produit Stripe' }, e.status || 502)
  }

  await updateOrderStripeCatalog(env.DB, orderId, {
    stripeProductId,
    stripePriceId,
  })

  // —— 2. Checkout Session (POST /v1/checkout/sessions, mode=payment) ——
  const successUrl = `${origin}/commande/succes?session_id={CHECKOUT_SESSION_ID}&order_id=${encodeURIComponent(orderId)}`
  const cancelUrl = `${origin}/commande/annule?order_id=${encodeURIComponent(orderId)}`

  const country = isoCountry(contact.country || body.config?.deliveryCountry)
  let customerId
  if (sessionUser.stripeCustomerId) {
    customerId = sessionUser.stripeCustomerId
  } else if (contact.email) {
    try {
      const customer = await stripeRequest(env.STRIPE_SECRET_KEY, '/v1/customers', {
        email: String(contact.email).slice(0, 256),
        ...(customerName ? { name: customerName.slice(0, 256) } : {}),
        ...(contact.phone ? { phone: String(contact.phone).slice(0, 40) } : {}),
        metadata: { order_id: orderId, quote_ref: quoteRef },
        ...(contact.addressLine1 && contact.city
          ? {
              address: {
                line1: String(contact.addressLine1).slice(0, 200),
                ...(contact.addressLine2
                  ? { line2: String(contact.addressLine2).slice(0, 200) }
                  : {}),
                city: String(contact.city).slice(0, 100),
                postal_code: String(contact.postalCode || '').slice(0, 20),
                ...(country ? { country } : {}),
              },
            }
          : {}),
      })
      customerId = customer.id
      if (customerId && env.DB) {
        await env.DB.prepare(
          `UPDATE users SET stripe_customer_id = ?, updated_at = ? WHERE id = ?`,
        )
          .bind(customerId, new Date().toISOString(), sessionUser.id)
          .run()
      }
    } catch (e) {
      console.warn('[customer]', e.message)
    }
  }

  let session
  try {
    session = await createCheckoutSession(env.STRIPE_SECRET_KEY, {
      priceId: stripePriceId,
      quantity: 1,
      successUrl,
      cancelUrl,
      clientReferenceId: orderId,
      customerId,
      customerEmail: customerId ? undefined : contact.email || undefined,
      locale: presentation.lang,
      paymentDescription: `${productLabel} — ${quoteRef}`,
      receiptEmail: contact.email || sessionUser.email,
      customText: {
        submit: presentation.submitMessage,
        shipping: presentation.shippingMessage,
      },
      metadata: {
        order_id: orderId,
        quote_ref: quoteRef,
        payment_mode: paymentMode,
        deposit_percent: String(depositPercent),
        amount_ttc_cents: String(amountTtcCents),
        amount_charged_cents: String(amountChargedCents),
        source: String(body.source || 'configurator'),
        catalog_product_id: catalogProductId || '',
        stripe_product_id: stripeProductId,
        stripe_price_id: stripePriceId,
        product_label: productLabel.slice(0, 400),
      },
    })
  } catch (e) {
    console.error('[createCheckoutSession]', e.message, e.stripe)
    return json({ error: e.message || 'Erreur Checkout Session' }, e.status || 502)
  }

  await updateOrderSession(env.DB, orderId, session.id)

  // Le client finalise via session.url (étape UI du blueprint)
  return json({
    ok: true,
    orderId,
    sessionId: session.id,
    url: session.url,
    stripeProductId,
    stripePriceId,
    paymentMode,
    depositPercent,
    amountChargedCents,
    amountTtcCents,
  })
}

/**
 * Webhook Stripe — écoute checkout.session.completed
 */
async function handleStripeWebhook(request, env) {
  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: 'Stripe non configuré' }, 503)
  }

  const rawBody = await request.text()
  let event

  if (env.STRIPE_WEBHOOK_SECRET) {
    try {
      event = await verifyStripeWebhook(
        rawBody,
        request.headers.get('Stripe-Signature'),
        env.STRIPE_WEBHOOK_SECRET,
      )
    } catch (e) {
      console.error('[webhook] signature', e.message)
      return json({ error: e.message }, 400)
    }
  } else {
    console.warn('[webhook] STRIPE_WEBHOOK_SECRET absent — vérif désactivée (dev only)')
    try {
      event = JSON.parse(rawBody)
    } catch {
      return json({ error: 'Body invalide' }, 400)
    }
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data?.object || {}
    const result = await handleCheckoutSessionCompleted(env.DB, session)
    console.log('[webhook] checkout.session.completed', result)
    if (result?.handled && result.orderId) {
      await sendOrderConfirmation(env, result.orderId)
    }
  }

  return json({ received: true })
}

async function sendOrderConfirmation(env, orderId) {
  if (!env.DB || !orderId) return { sent: false }
  const order = await env.DB.prepare(`SELECT * FROM orders WHERE id = ?`)
    .bind(orderId)
    .first()
  if (!order || order.status !== 'paid') return { sent: false }
  if (order.confirmation_sent_at) return { sent: true, already: true }
  const to = order.customer_email
  const copy = orderConfirmationCopy(order, 'fr')
  const result = await sendMail(env, { to, ...copy })
  if (result.sent || result.preview) {
    await env.DB.prepare(
      `UPDATE orders SET confirmation_sent_at = ? WHERE id = ?`,
    )
      .bind(new Date().toISOString(), orderId)
      .run()
  }
  return result
}

async function handleGetOrder(request, env, orderId) {
  const url = new URL(request.url)
  const sessionId = url.searchParams.get('session_id')

  let order = null
  if (orderId && orderId !== 'by-session') {
    order = await getOrderById(env.DB, orderId)
  }
  if (!order && sessionId) {
    order = await getOrderBySession(env.DB, sessionId)
  }

  if (!order) {
    if (sessionId && env.STRIPE_SECRET_KEY) {
      try {
        const session = await stripeRequest(
          env.STRIPE_SECRET_KEY,
          `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
          null,
          'GET',
        )
        return json({
          ok: true,
          source: 'stripe',
          order: {
            id: session.metadata?.order_id || session.client_reference_id,
            quote_ref: session.metadata?.quote_ref,
            status:
              session.payment_status === 'paid' ? 'paid' : session.status,
            amount_charged_cents: session.amount_total,
            currency: session.currency,
            customer_email: session.customer_details?.email,
            stripe_customer_id:
              typeof session.customer === 'string'
                ? session.customer
                : session.customer?.id,
            stripe_session_id: session.id,
            stripe_product_id: session.metadata?.stripe_product_id,
            stripe_price_id: session.metadata?.stripe_price_id,
            payment_mode: session.metadata?.payment_mode || 'full',
          },
        })
      } catch (e) {
        return json({ error: e.message }, 404)
      }
    }
    return json({ error: 'Commande introuvable' }, 404)
  }

  const { config_json: _cfg, ...safe } = order
  return json({ ok: true, source: 'db', order: safe })
}

async function handleApi(request, env, _ctx) {
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/$/, '') || '/'
  const origin = request.headers.get('Origin') || ''
  const cors = corsHeaders(origin, env)

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  try {
    if (env.DB) await ensureSchema(env.DB)

    if (path.startsWith('/api/auth') || path.startsWith('/api/account')) {
      const authRes = await handleAuth(request, env, cors)
      if (authRes) return authRes
    }

    if (path.startsWith('/api/checkout/draft')) {
      const draftRes = await handleDrafts(request, env, cors)
      if (draftRes) return draftRes
    }

    if (path.startsWith('/api/configs')) {
      const cfgRes = await handleConfigs(request, env, cors)
      if (cfgRes) return cfgRes
    }

    if (path === '/api/health' && request.method === 'GET') {
      return json(
        {
          ok: true,
          stripe: Boolean(env.STRIPE_SECRET_KEY),
          db: Boolean(env.DB),
          webhook: Boolean(env.STRIPE_WEBHOOK_SECRET),
          blueprint: 'one-time-payment-checkout',
        },
        200,
        cors,
      )
    }

    // Alias blueprint + route Philae
    if (
      (path === '/api/checkout' || path === '/api/create-checkout-session') &&
      request.method === 'POST'
    ) {
      const res = await handleCreateCheckout(request, env)
      const headers = new Headers(res.headers)
      Object.entries(cors).forEach(([k, v]) => headers.set(k, v))
      return new Response(res.body, { status: res.status, headers })
    }

    if (path === '/api/webhooks/stripe' && request.method === 'POST') {
      return handleStripeWebhook(request, env)
    }

    const notifyMatch = path.match(/^\/api\/orders\/([^/]+)\/notify$/)
    if (notifyMatch && request.method === 'POST') {
      const result = await sendOrderConfirmation(
        env,
        decodeURIComponent(notifyMatch[1]),
      )
      return json({ ok: true, ...result }, 200, cors)
    }

    const orderMatch = path.match(/^\/api\/orders\/([^/]+)$/)
    if (orderMatch && request.method === 'GET') {
      const res = await handleGetOrder(
        request,
        env,
        decodeURIComponent(orderMatch[1]),
      )
      const headers = new Headers(res.headers)
      Object.entries(cors).forEach(([k, v]) => headers.set(k, v))
      return new Response(res.body, { status: res.status, headers })
    }

    return json({ error: 'Not found', path }, 404, cors)
  } catch (e) {
    console.error('[api]', e)
    return json({ error: e.message || 'Erreur serveur' }, 500, cors)
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, ctx)
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request)
    }

    return new Response('Philae worker — configure [assets] dans wrangler.toml', {
      status: 404,
    })
  },
}
