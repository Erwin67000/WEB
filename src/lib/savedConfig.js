const LOCAL_KEY = 'philae-saved-config'

export function writeLocalConfig(snapshot) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(snapshot))
  } catch {
    /* ignore */
  }
}

export function readLocalConfig() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return null
    const snap = JSON.parse(raw)
    if (!Array.isArray(snap?.units) || !snap.units.length) return null
    return snap
  } catch {
    return null
  }
}

export async function persistSavedConfig(snapshot) {
  writeLocalConfig(snapshot)
  try {
    const res = await fetch('/api/configs/current', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot }),
    })
    if (res.status === 401) return { ok: false, auth: false }
    const data = await res.json().catch(() => ({}))
    return { ok: Boolean(data.ok), id: data.id || null, auth: true }
  } catch {
    return { ok: false, auth: false }
  }
}

export async function fetchCurrentConfig() {
  try {
    const res = await fetch('/api/configs/current', { credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    return data.config || null
  } catch {
    return null
  }
}

export async function fetchConfigList() {
  try {
    const res = await fetch('/api/configs', { credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    return data.configs || []
  } catch {
    return []
  }
}

export async function fetchConfigById(id) {
  try {
    const res = await fetch(`/api/configs/${encodeURIComponent(id)}`, {
      credentials: 'include',
    })
    const data = await res.json().catch(() => ({}))
    return data.config || null
  } catch {
    return null
  }
}
