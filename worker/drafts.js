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
  return `dft_${crypto.randomUUID().replace(/-/g, '')}`
}

function nowIso() {
  return new Date().toISOString()
}

export async function handleDrafts(request, env, cors) {
  if (!env.DB) return json({ error: 'Base indisponible' }, 503, cors)
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/$/, '') || '/'
  const user = await getSessionUser(request, env)

  if (path === '/api/checkout/draft' && request.method === 'POST') {
    let body = {}
    try {
      body = await request.json()
    } catch {
      return json({ error: 'JSON invalide' }, 400, cors)
    }
    const draft = body.draft
    if (!draft || typeof draft !== 'object') {
      return json({ error: 'Brouillon vide' }, 400, cors)
    }
    const existingId = String(body.id || '').slice(0, 80)
    const t = nowIso()
    const payload = JSON.stringify(draft).slice(0, 900_000)
    if (existingId) {
      const row = await env.DB.prepare(`SELECT id, user_id FROM checkout_drafts WHERE id = ?`)
        .bind(existingId)
        .first()
      if (row) {
        await env.DB.prepare(
          `UPDATE checkout_drafts SET json = ?, user_id = COALESCE(?, user_id), updated_at = ? WHERE id = ?`,
        )
          .bind(payload, user?.id || null, t, existingId)
          .run()
        return json({ ok: true, id: existingId }, 200, cors)
      }
    }
    const id = newId()
    await env.DB.prepare(
      `INSERT INTO checkout_drafts (id, user_id, json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(id, user?.id || null, payload, t, t)
      .run()
    return json({ ok: true, id }, 200, cors)
  }

  if (path === '/api/checkout/draft' && request.method === 'GET') {
    if (!user) return json({ draft: null }, 200, cors)
    const row = await env.DB.prepare(
      `SELECT id, json FROM checkout_drafts WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`,
    )
      .bind(user.id)
      .first()
    if (!row) return json({ draft: null }, 200, cors)
    return json({ ok: true, id: row.id, draft: JSON.parse(row.json) }, 200, cors)
  }

  const byId = path.match(/^\/api\/checkout\/draft\/([^/]+)$/)
  if (byId && request.method === 'GET') {
    const row = await env.DB.prepare(`SELECT id, json, user_id FROM checkout_drafts WHERE id = ?`)
      .bind(decodeURIComponent(byId[1]))
      .first()
    if (!row) return json({ error: 'Brouillon introuvable' }, 404, cors)
    if (user?.id && !row.user_id) {
      await env.DB.prepare(
        `UPDATE checkout_drafts SET user_id = ?, updated_at = ? WHERE id = ?`,
      )
        .bind(user.id, nowIso(), row.id)
        .run()
    }
    return json({ ok: true, id: row.id, draft: JSON.parse(row.json) }, 200, cors)
  }

  return null
}
