const KEY = 'philae-checkout-draft'

export function writeCheckoutDraft(draft) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft))
  } catch {
    /* ignore */
  }
}

export function readCheckoutDraft() {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearCheckoutDraft() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
