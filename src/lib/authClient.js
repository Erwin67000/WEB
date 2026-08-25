export async function fetchSession() {
  const res = await fetch('/api/auth/session', { credentials: 'include' })
  const data = await res.json().catch(() => ({}))
  return {
    user: data.user || null,
    providers: data.providers || { google: false, apple: false, magic: true },
  }
}

export async function postAuth(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`)
    err.code = data.error
    throw err
  }
  return data
}

export function logout() {
  return postAuth('/api/auth/logout', {})
}
