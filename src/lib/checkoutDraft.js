const KEY = 'philae-checkout-draft'
const ID_KEY = 'philae-draft-id'

export function writeCheckoutDraft(draft) {
  try {
    localStorage.setItem(KEY, JSON.stringify(draft))
  } catch {
    /* ignore */
  }
}

export function readCheckoutDraft() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearCheckoutDraft() {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(ID_KEY)
  } catch {
    /* ignore */
  }
}

export function readDraftId() {
  try {
    return localStorage.getItem(ID_KEY) || ''
  } catch {
    return ''
  }
}

export async function persistDraft(draft) {
  writeCheckoutDraft(draft)
  try {
    const res = await fetch('/api/checkout/draft', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft, id: readDraftId() || undefined }),
    })
    const data = await res.json().catch(() => ({}))
    if (data.id) localStorage.setItem(ID_KEY, data.id)
    return data.id || ''
  } catch {
    return readDraftId()
  }
}

export async function fetchDraft(id) {
  const path = id
    ? `/api/checkout/draft/${encodeURIComponent(id)}`
    : '/api/checkout/draft'
  const res = await fetch(path, { credentials: 'include' })
  const data = await res.json().catch(() => ({}))
  if (data.draft) {
    writeCheckoutDraft(data.draft)
    if (data.id) localStorage.setItem(ID_KEY, data.id)
    return data.draft
  }
  return null
}
