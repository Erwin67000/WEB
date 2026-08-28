/**
 * Configurations meuble persistées (compte client).
 * GET  /api/configs          → liste
 * GET  /api/configs/current  → dernière
 * PUT  /api/configs/current  → upsert dernière
 * GET  /api/configs/:id
 * DELETE /api/configs/:id
 */
import { getSessionUser } from './auth.js'

function json(data, status = 200, cors = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...cors,
    },
  })
}

function newId() {
  return `cfg_${crypto.randomUUID().replace(/-/g, '')}`
}

function nowIso() {
  return new Date().toISOString()
}

function titleFromSnap(snap) {
  const units = snap?.units || []
  if (!units.length) return 'Configuration'
  if (units.length === 1) return units[0].label || 'Meuble 1'
  return `${units[0].label || 'Meuble'} (+${units.length - 1})`
}

function parseSnap(row) {
  if (!row) return null
  let snap = null
  try {
    snap = JSON.parse(row.json)
  } catch {
    return null
  }
  return {
    id: row.id,
    title: row.title || titleFromSnap(snap),
    quoteRef: row.quote_ref || snap?.quoteRef || '',
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    snapshot: snap,
  }
}

export async function handleConfigs(request, env, cors) {
  if (!env.DB) return json({ error: 'Base indisponible' }, 503, cors)
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/$/, '') || '/'
  const user = await getSessionUser(request, env)

  if (path === '/api/configs' && request.method === 'GET') {
    if (!user) return json({ configs: [] }, 200, cors)
    const { results } = await env.DB.prepare(
      `SELECT id, title, quote_ref, json, created_at, updated_at
       FROM saved_configs WHERE user_id = ? ORDER BY updated_at DESC LIMIT 20`,
    )
      .bind(user.id)
      .all()
    return json(
      { configs: (results || []).map(parseSnap).filter(Boolean) },
      200,
      cors,
    )
  }

  if (path === '/api/configs/current' && request.method === 'GET') {
    if (!user) return json({ config: null }, 200, cors)
    const row = await env.DB.prepare(
      `SELECT id, title, quote_ref, json, created_at, updated_at
       FROM saved_configs WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`,
    )
      .bind(user.id)
      .first()
    return json({ config: parseSnap(row) }, 200, cors)
  }

  if (path === '/api/configs/current' && request.method === 'PUT') {
    if (!user) return json({ error: 'Connexion requise' }, 401, cors)
    let body = {}
    try {
      body = await request.json()
    } catch {
      return json({ error: 'JSON invalide' }, 400, cors)
    }
    const snap = body.snapshot
    if (!snap || !Array.isArray(snap.units) || !snap.units.length) {
      return json({ error: 'Configuration vide' }, 400, cors)
    }
    const payload = JSON.stringify(snap).slice(0, 900_000)
    const title = String(body.title || titleFromSnap(snap)).slice(0, 160)
    const quoteRef = String(snap.quoteRef || body.quoteRef || '').slice(0, 80)
    const t = nowIso()
    const existing = await env.DB.prepare(
      `SELECT id FROM saved_configs WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`,
    )
      .bind(user.id)
      .first()
    if (existing) {
      await env.DB.prepare(
        `UPDATE saved_configs
         SET title = ?, quote_ref = ?, json = ?, updated_at = ?
         WHERE id = ?`,
      )
        .bind(title, quoteRef, payload, t, existing.id)
        .run()
      return json({ ok: true, id: existing.id }, 200, cors)
    }
    const id = newId()
    await env.DB.prepare(
      `INSERT INTO saved_configs
        (id, user_id, title, quote_ref, json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, user.id, title, quoteRef, payload, t, t)
      .run()
    return json({ ok: true, id }, 200, cors)
  }

  const byId = path.match(/^\/api\/configs\/([^/]+)$/)
  if (byId && request.method === 'GET') {
    if (!user) return json({ error: 'Connexion requise' }, 401, cors)
    const row = await env.DB.prepare(
      `SELECT id, title, quote_ref, json, created_at, updated_at
       FROM saved_configs WHERE id = ? AND user_id = ?`,
    )
      .bind(decodeURIComponent(byId[1]), user.id)
      .first()
    if (!row) return json({ error: 'Introuvable' }, 404, cors)
    return json({ config: parseSnap(row) }, 200, cors)
  }

  if (byId && request.method === 'DELETE') {
    if (!user) return json({ error: 'Connexion requise' }, 401, cors)
    await env.DB.prepare(
      `DELETE FROM saved_configs WHERE id = ? AND user_id = ?`,
    )
      .bind(decodeURIComponent(byId[1]), user.id)
      .run()
    return json({ ok: true }, 200, cors)
  }

  return null
}
