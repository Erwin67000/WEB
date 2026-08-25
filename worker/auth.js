/**
 * Auth Philae — session D1, lien magique, Google, Apple, invité.
 * Pas de mot de passe.
 */
import { sendMail, accountCopy } from './mail.js'

export const CGV_VERSION = '2026-08-25'
const COOKIE = 'philae_sid'
const SESSION_DAYS = 30
const MAGIC_MINUTES = 20

function nowIso() {
  return new Date().toISOString()
}

function plusMinutes(m) {
  return new Date(Date.now() + m * 60_000).toISOString()
}

function plusDays(d) {
  return new Date(Date.now() + d * 86_400_000).toISOString()
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  })
}

function siteOrigin(request, env) {
  if (env.SITE_URL) return env.SITE_URL.replace(/\/$/, '')
  return new URL(request.url).origin
}

function cookieHeader(id, request) {
  const secure = new URL(request.url).protocol === 'https:'
  const parts = [
    `${COOKIE}=${id}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_DAYS * 86400}`,
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

function clearCookieHeader(request) {
  const secure = new URL(request.url).protocol === 'https:'
  const parts = [`${COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

function readCookie(request) {
  const raw = request.headers.get('Cookie') || ''
  const hit = raw.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${COOKIE}=`))
  return hit ? decodeURIComponent(hit.slice(COOKIE.length + 1)) : ''
}

function newId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`
}

async function sha256hex(s) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(s),
  )
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function publicUser(row) {
  if (!row) return null
  let address = null
  try {
    address = row.address_json ? JSON.parse(row.address_json) : null
  } catch {
    address = null
  }
  return {
    id: row.id,
    email: row.email,
    name: row.name || '',
    image: row.image || '',
    isGuest: Boolean(row.is_guest),
    emailVerified: Boolean(row.email_verified),
    cgvAcceptedAt: row.cgv_accepted_at || null,
    newsletter: Boolean(row.newsletter_opt_in),
    stripeCustomerId: row.stripe_customer_id || null,
    address,
  }
}

export async function getSessionUser(request, env) {
  if (!env.DB) return null
  const sid = readCookie(request)
  if (!sid) return null
  const session = await env.DB.prepare(
    `SELECT s.id AS sid, s.expires_at, u.*
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ?`,
  )
    .bind(sid)
    .first()
  if (!session) return null
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sid).run()
    return null
  }
  return publicUser(session)
}

async function createSession(env, userId) {
  const id = newId('ses')
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
  )
    .bind(id, userId, plusDays(SESSION_DAYS), nowIso())
    .run()
  return id
}

async function upsertUser(env, { email, name, image, verified, guest, cgv, newsletter }) {
  const mail = String(email || '').trim().toLowerCase()
  if (!mail || !mail.includes('@')) throw new Error('E-mail invalide')
  const existing = await env.DB.prepare(`SELECT * FROM users WHERE email = ?`)
    .bind(mail)
    .first()
  const t = nowIso()
  if (existing) {
    const cgvAt =
      cgv && !existing.cgv_accepted_at ? t : existing.cgv_accepted_at
    await env.DB.prepare(
      `UPDATE users SET
        name = COALESCE(?, name),
        image = COALESCE(?, image),
        email_verified = CASE WHEN ? = 1 THEN 1 ELSE email_verified END,
        is_guest = CASE WHEN ? = 0 THEN 0 ELSE is_guest END,
        cgv_accepted_at = COALESCE(?, cgv_accepted_at),
        cgv_version = CASE WHEN ? = 1 THEN ? ELSE cgv_version END,
        newsletter_opt_in = CASE WHEN ? = 1 THEN 1 ELSE newsletter_opt_in END,
        updated_at = ?
      WHERE id = ?`,
    )
      .bind(
        name || null,
        image || null,
        verified ? 1 : 0,
        guest ? 1 : 0,
        cgvAt,
        cgv ? 1 : 0,
        CGV_VERSION,
        newsletter ? 1 : 0,
        t,
        existing.id,
      )
      .run()
    return env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(existing.id).first()
  }
  const id = newId('usr')
  await env.DB.prepare(
    `INSERT INTO users (
      id, email, name, image, email_verified, is_guest,
      cgv_accepted_at, cgv_version, newsletter_opt_in,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      mail,
      name || null,
      image || null,
      verified ? 1 : 0,
      guest ? 1 : 0,
      cgv ? t : null,
      cgv ? CGV_VERSION : null,
      newsletter ? 1 : 0,
      t,
      t,
    )
    .run()
  return env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(id).first()
}

async function sendMagicEmail(env, to, url, lang) {
  const fr = !String(lang || '').toLowerCase().startsWith('en')
  const subject = fr ? 'Votre lien de connexion PHILAE' : 'Your PHILAE sign-in link'
  const text = fr
    ? `Bonjour,\n\nCliquez pour vous connecter (valable ${MAGIC_MINUTES} min) :\n${url}\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.\n\n— Atelier Philae`
    : `Hello,\n\nClick to sign in (valid ${MAGIC_MINUTES} min):\n${url}\n\nIf you did not request this, ignore this e-mail.\n\n— Atelier Philae`

  if (env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.MAIL_FROM || 'PHILAE <noreply@philae.design>',
        to: [to],
        subject,
        text,
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`E-mail non envoyé (${res.status}) ${err.slice(0, 200)}`)
    }
    return { sent: true }
  }
  console.log('[magic-link]', to, url)
  return { sent: false }
}

function providers(env) {
  return {
    google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    apple: Boolean(
      env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY,
    ),
    magic: true,
    emailConfigured: Boolean(env.RESEND_API_KEY),
  }
}

export async function handleAuth(request, env, cors) {
  if (!env.DB) return json({ error: 'Base indisponible' }, 503, cors)
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/$/, '') || '/'

  const withCors = (res) => {
    const headers = new Headers(res.headers)
    Object.entries(cors).forEach(([k, v]) => headers.set(k, v))
    return new Response(res.body, { status: res.status, headers })
  }

  if (path === '/api/auth/providers' && request.method === 'GET') {
    return withCors(json(providers(env), 200))
  }

  if (path === '/api/auth/session' && request.method === 'GET') {
    const user = await getSessionUser(request, env)
    return withCors(json({ user, providers: providers(env) }))
  }

  if (path === '/api/auth/logout' && request.method === 'POST') {
    const sid = readCookie(request)
    if (sid) await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sid).run()
    return withCors(
      json({ ok: true }, 200, { 'Set-Cookie': clearCookieHeader(request) }),
    )
  }

  if (path === '/api/auth/magic-link' && request.method === 'POST') {
    let body = {}
    try {
      body = await request.json()
    } catch {
      return withCors(json({ error: 'JSON invalide' }, 400))
    }
    const email = String(body.email || '').trim().toLowerCase()
    if (!email.includes('@')) return withCors(json({ error: 'E-mail invalide' }, 400))
    if (!body.cgv) {
      return withCors(json({ error: 'CGV_REQUIRED' }, 400))
    }
    const token = newId('mag').slice(4)
    const hash = await sha256hex(token)
    await env.DB.prepare(
      `INSERT INTO magic_links (id, email, token_hash, cgv, newsletter, name, expires_at, created_at)
       VALUES (?, ?, ?, 1, ?, ?, ?, ?)`,
    )
      .bind(
        newId('ml'),
        email,
        hash,
        body.newsletter ? 1 : 0,
        body.name ? String(body.name).slice(0, 120) : null,
        plusMinutes(MAGIC_MINUTES),
        nowIso(),
      )
      .run()
    const origin = siteOrigin(request, env)
    const magicUrl = `${origin}/commande?magic=${encodeURIComponent(token)}`
    let mailed
    try {
      mailed = await sendMagicEmail(env, email, magicUrl, body.lang)
    } catch (e) {
      return withCors(json({ error: e.message || 'E-mail impossible' }, 502))
    }
    return withCors(
      json({
        ok: true,
        sent: mailed.sent,
        ...(mailed.sent ? {} : { magicUrl }),
      }),
    )
  }

  if (path === '/api/auth/magic-link/verify' && request.method === 'POST') {
    let body = {}
    try {
      body = await request.json()
    } catch {
      return withCors(json({ error: 'JSON invalide' }, 400))
    }
    const token = String(body.token || url.searchParams.get('token') || '')
    if (!token) return withCors(json({ error: 'Lien invalide' }, 400))
    const hash = await sha256hex(token)
    const row = await env.DB.prepare(
      `SELECT * FROM magic_links WHERE token_hash = ?`,
    )
      .bind(hash)
      .first()
    if (!row || row.consumed_at) return withCors(json({ error: 'Lien invalide' }, 400))
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return withCors(json({ error: 'Lien expiré' }, 400))
    }
    await env.DB.prepare(
      `UPDATE magic_links SET consumed_at = ? WHERE id = ?`,
    )
      .bind(nowIso(), row.id)
      .run()
    const user = await upsertUser(env, {
      email: row.email,
      name: row.name,
      verified: true,
      guest: false,
      cgv: Boolean(row.cgv),
      newsletter: Boolean(row.newsletter),
    })
    const sid = await createSession(env, user.id)
    if (Date.now() - new Date(user.created_at).getTime() < 15_000) {
      const copy = accountCopy(publicUser(user), body.lang)
      sendMail(env, { to: user.email, ...copy }).catch(() => {})
    }
    return withCors(
      json(
        { ok: true, user: publicUser(user) },
        200,
        { 'Set-Cookie': cookieHeader(sid, request) },
      ),
    )
  }

  if (path === '/api/auth/guest' && request.method === 'POST') {
    let body = {}
    try {
      body = await request.json()
    } catch {
      return withCors(json({ error: 'JSON invalide' }, 400))
    }
    const email = String(body.email || '').trim().toLowerCase()
    if (!email.includes('@')) return withCors(json({ error: 'E-mail invalide' }, 400))
    if (!body.cgv) return withCors(json({ error: 'CGV_REQUIRED' }, 400))
    const name = `${body.firstName || ''} ${body.lastName || ''}`.trim() || body.name || ''
    const user = await upsertUser(env, {
      email,
      name,
      verified: false,
      guest: true,
      cgv: true,
      newsletter: Boolean(body.newsletter),
    })
    const sid = await createSession(env, user.id)
    return withCors(
      json(
        { ok: true, user: publicUser(user) },
        200,
        { 'Set-Cookie': cookieHeader(sid, request) },
      ),
    )
  }

  if (path === '/api/auth/cgv' && request.method === 'POST') {
    const sessionUser = await getSessionUser(request, env)
    if (!sessionUser) return withCors(json({ error: 'NON_AUTH' }, 401))
    let body = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }
    if (!body.cgv) return withCors(json({ error: 'CGV_REQUIRED' }, 400))
    const t = nowIso()
    await env.DB.prepare(
      `UPDATE users SET cgv_accepted_at = ?, cgv_version = ?,
        newsletter_opt_in = CASE WHEN ? = 1 THEN 1 ELSE newsletter_opt_in END,
        updated_at = ? WHERE id = ?`,
    )
      .bind(t, CGV_VERSION, body.newsletter ? 1 : 0, t, sessionUser.id)
      .run()
    const user = await env.DB.prepare(`SELECT * FROM users WHERE id = ?`)
      .bind(sessionUser.id)
      .first()
    return withCors(json({ ok: true, user: publicUser(user) }))
  }

  if (path === '/api/auth/newsletter' && request.method === 'POST') {
    const sessionUser = await getSessionUser(request, env)
    if (!sessionUser) return withCors(json({ error: 'NON_AUTH' }, 401))
    let body = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }
    await env.DB.prepare(
      `UPDATE users SET newsletter_opt_in = ?, updated_at = ? WHERE id = ?`,
    )
      .bind(body.newsletter ? 1 : 0, nowIso(), sessionUser.id)
      .run()
    return withCors(json({ ok: true, newsletter: Boolean(body.newsletter) }))
  }

  if (path === '/api/account/address' && request.method === 'POST') {
    const sessionUser = await getSessionUser(request, env)
    if (!sessionUser) return withCors(json({ error: 'NON_AUTH' }, 401))
    let body = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }
    const address = {
      firstName: String(body.firstName || '').slice(0, 80),
      lastName: String(body.lastName || '').slice(0, 80),
      phone: String(body.phone || '').slice(0, 40),
      addressLine1: String(body.addressLine1 || '').slice(0, 200),
      addressLine2: String(body.addressLine2 || '').slice(0, 200),
      postalCode: String(body.postalCode || '').slice(0, 20),
      city: String(body.city || '').slice(0, 100),
      country: String(body.country || 'FR').slice(0, 8),
    }
    const name = `${address.firstName} ${address.lastName}`.trim()
    await env.DB.prepare(
      `UPDATE users SET address_json = ?, name = COALESCE(NULLIF(?, ''), name), updated_at = ? WHERE id = ?`,
    )
      .bind(JSON.stringify(address), name, nowIso(), sessionUser.id)
      .run()
    const user = await env.DB.prepare(`SELECT * FROM users WHERE id = ?`)
      .bind(sessionUser.id)
      .first()
    return withCors(json({ ok: true, user: publicUser(user) }))
  }

  if (path === '/api/auth/google' && request.method === 'GET') {
    if (!providers(env).google) {
      const origin = siteOrigin(request, env)
      return new Response(
        `<!doctype html><meta charset="utf-8"><title>Google</title>
<body style="font-family:sans-serif;padding:2rem;max-width:38rem;line-height:1.5">
<p>Google n’est pas encore branché sur ce serveur.</p>
<p>Cloud Console → ID client OAuth → type <strong>Application Web</strong>.</p>
<p>Origines : <code>https://philae.design</code>, <code>https://www.philae.design</code>, <code>http://localhost:3102</code></p>
<p>Redirections :<br>
<code>https://www.philae.design/api/auth/callback/google</code><br>
<code>https://philae.design/api/auth/callback/google</code><br>
<code>http://localhost:3102/api/auth/callback/google</code></p>
<p><strong>En local</strong> : coller les clés dans <code>.dev.vars</code> puis <code>npm run dev:api</code>.</p>
<p><strong>En live</strong> (ce site) :</p>
<pre style="background:#f5f0e6;padding:0.8rem">npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put SITE_URL
# SITE_URL = https://www.philae.design</pre>
<p><a href="/commande">Retour à la commande</a></p>
</body>`,
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
      )
    }
    const state = newId('st')
    const draftId = url.searchParams.get('draft') || null
    await env.DB.prepare(
      `INSERT INTO oauth_states (state, provider, draft_id, expires_at) VALUES (?, 'google', ?, ?)`,
    )
      .bind(state, draftId, plusMinutes(15))
      .run()
    const origin = siteOrigin(request, env)
    const redirectUri = `${origin}/api/auth/callback/google`
    const g = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    g.searchParams.set('client_id', env.GOOGLE_CLIENT_ID)
    g.searchParams.set('redirect_uri', redirectUri)
    g.searchParams.set('response_type', 'code')
    g.searchParams.set('scope', 'openid email profile')
    g.searchParams.set('state', state)
    g.searchParams.set('prompt', 'select_account')
    return Response.redirect(g.toString(), 302)
  }

  if (path === '/api/auth/callback/google' && request.method === 'GET') {
    const origin = siteOrigin(request, env)
    const fail = `${origin}/commande?auth=error`
    try {
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const st = state
        ? await env.DB.prepare(`SELECT * FROM oauth_states WHERE state = ? AND provider = 'google'`)
            .bind(state)
            .first()
        : null
      if (!code || !st) return Response.redirect(fail, 302)
      await env.DB.prepare(`DELETE FROM oauth_states WHERE state = ?`).bind(state).run()
      const redirectUri = `${origin}/api/auth/callback/google`
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      })
      const tokens = await tokenRes.json()
      if (!tokens.access_token) return Response.redirect(fail, 302)
      const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      const info = await infoRes.json()
      if (!info.email) return Response.redirect(fail, 302)
      const user = await upsertUser(env, {
        email: info.email,
        name: info.name || '',
        image: info.picture || '',
        verified: Boolean(info.email_verified),
        guest: false,
        cgv: false,
        newsletter: false,
      })
      await env.DB.prepare(
        `INSERT OR REPLACE INTO oauth_accounts (provider, provider_user_id, user_id, created_at)
         VALUES ('google', ?, ?, ?)`,
      )
        .bind(String(info.sub), user.id, nowIso())
        .run()
      const sid = await createSession(env, user.id)
      if (st.draft_id) {
        await env.DB.prepare(
          `UPDATE checkout_drafts SET user_id = ?, updated_at = ? WHERE id = ?`,
        )
          .bind(user.id, nowIso(), st.draft_id)
          .run()
      }
      if (Date.now() - new Date(user.created_at).getTime() < 15_000) {
        const copy = accountCopy(publicUser(user))
        sendMail(env, { to: user.email, ...copy }).catch(() => {})
      }
      const flag = user.cgv_accepted_at ? 'ok' : 'cgv'
      const draftQ = st.draft_id ? `&draft=${encodeURIComponent(st.draft_id)}` : ''
      const next = `${origin}/commande?auth=${flag}${draftQ}`
      const res = new Response(null, {
        status: 302,
        headers: {
          Location: next,
          'Set-Cookie': cookieHeader(sid, request),
        },
      })
      return res
    } catch (e) {
      console.error('[google]', e)
      return Response.redirect(fail, 302)
    }
  }

  if (path === '/api/auth/apple' && request.method === 'GET') {
    if (!providers(env).apple) return withCors(json({ error: 'APPLE_OFF' }, 503))
    const state = newId('st')
    const nonce = newId('n')
    await env.DB.prepare(
      `INSERT INTO oauth_states (state, provider, nonce, expires_at) VALUES (?, 'apple', ?, ?)`,
    )
      .bind(state, nonce, plusMinutes(15))
      .run()
    const origin = siteOrigin(request, env)
    const a = new URL('https://appleid.apple.com/auth/authorize')
    a.searchParams.set('client_id', env.APPLE_CLIENT_ID)
    a.searchParams.set('redirect_uri', `${origin}/api/auth/callback/apple`)
    a.searchParams.set('response_type', 'code')
    a.searchParams.set('response_mode', 'query')
    a.searchParams.set('scope', 'name email')
    a.searchParams.set('state', state)
    a.searchParams.set('nonce', nonce)
    return Response.redirect(a.toString(), 302)
  }

  if (path === '/api/auth/callback/apple' && request.method === 'GET') {
    const origin = siteOrigin(request, env)
    const fail = `${origin}/commande?auth=error`
    try {
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const st = state
        ? await env.DB.prepare(`SELECT * FROM oauth_states WHERE state = ? AND provider = 'apple'`)
            .bind(state)
            .first()
        : null
      if (!code || !st) return Response.redirect(fail, 302)
      await env.DB.prepare(`DELETE FROM oauth_states WHERE state = ?`).bind(state).run()
      const clientSecret = await appleClientSecret(env)
      const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.APPLE_CLIENT_ID,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: `${origin}/api/auth/callback/apple`,
        }),
      })
      const tokens = await tokenRes.json()
      const payload = decodeJwt(tokens.id_token)
      const email = payload?.email
      const sub = payload?.sub
      if (!email || !sub) return Response.redirect(fail, 302)
      const user = await upsertUser(env, {
        email,
        name: '',
        verified: true,
        guest: false,
        cgv: false,
        newsletter: false,
      })
      await env.DB.prepare(
        `INSERT OR REPLACE INTO oauth_accounts (provider, provider_user_id, user_id, created_at)
         VALUES ('apple', ?, ?, ?)`,
      )
        .bind(String(sub), user.id, nowIso())
        .run()
      const sid = await createSession(env, user.id)
      const next = user.cgv_accepted_at
        ? `${origin}/commande?auth=ok`
        : `${origin}/commande?auth=cgv`
      return new Response(null, {
        status: 302,
        headers: {
          Location: next,
          'Set-Cookie': cookieHeader(sid, request),
        },
      })
    } catch (e) {
      console.error('[apple]', e)
      return Response.redirect(fail, 302)
    }
  }

  if (path === '/api/account/orders' && request.method === 'GET') {
    const sessionUser = await getSessionUser(request, env)
    if (!sessionUser) return withCors(json({ error: 'NON_AUTH' }, 401))
    const { results } = await env.DB.prepare(
      `SELECT id, quote_ref, status, amount_charged_cents, currency, product_label,
              created_at, paid_at
       FROM orders
       WHERE user_id = ? OR customer_email = ?
       ORDER BY created_at DESC
       LIMIT 50`,
    )
      .bind(sessionUser.id, sessionUser.email)
      .all()
    return withCors(json({ ok: true, orders: results || [] }))
  }

  return null
}

function decodeJwt(token) {
  if (!token) return null
  try {
    const part = String(token).split('.')[1]
    const pad = part.replace(/-/g, '+').replace(/_/g, '/')
    const jsonStr = atob(pad)
    return JSON.parse(jsonStr)
  } catch {
    return null
  }
}

/** Secret client Apple (JWT ES256, 5 min). */
async function appleClientSecret(env) {
  const pem = String(env.APPLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  const pkcs8 = pemToPkcs8(pem)
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  const header = { alg: 'ES256', kid: env.APPLE_KEY_ID }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: env.APPLE_TEAM_ID,
    iat: now,
    exp: now + 300,
    aud: 'https://appleid.apple.com',
    sub: env.APPLE_CLIENT_ID,
  }
  const enc = (obj) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  const data = `${enc(header)}.${enc(payload)}`
  const sigBuf = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(data),
  )
  const sig = derToJose(new Uint8Array(sigBuf))
  return `${data}.${sig}`
}

function pemToPkcs8(pem) {
  const b64 = pem.replace(/-----.*?-----/g, '').replace(/\s+/g, '')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

function derToJose(sig) {
  // WebCrypto ECDSA may return raw r||s (64 bytes) or DER. Apple wants raw JOSE.
  let raw = sig
  if (sig.length === 64) raw = sig
  else raw = derEcdsaToRaw(sig)
  let s = ''
  for (let i = 0; i < raw.length; i++) s += String.fromCharCode(raw[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function derEcdsaToRaw(der) {
  // Minimal DER SEQUENCE of two INTEGERs → 32+32
  let offset = 2
  if (der[1] & 0x80) offset += der[1] & 0x7f
  const readInt = () => {
    if (der[offset] !== 0x02) throw new Error('DER')
    const len = der[offset + 1]
    offset += 2
    let bytes = der.slice(offset, offset + len)
    offset += len
    while (bytes.length > 32 && bytes[0] === 0) bytes = bytes.slice(1)
    if (bytes.length < 32) {
      const pad = new Uint8Array(32)
      pad.set(bytes, 32 - bytes.length)
      bytes = pad
    }
    return bytes
  }
  const r = readInt()
  const s = readInt()
  const out = new Uint8Array(64)
  out.set(r, 0)
  out.set(s, 32)
  return out
}
