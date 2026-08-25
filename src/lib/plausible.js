/**
 * Plausible (philae.design) — pages vues sans cookie ;
 * événements enrichis + newsletter uniquement après opt-in facultatif.
 *
 * Stockage : localStorage `philae-consent-extras`.
 * Le paiement n’en dépend pas.
 */

export const CONSENT_EXTRAS_KEY = 'philae-consent-extras'
export const CONSENT_EXTRAS_EVENT = 'philae-consent-extras'
const SCRIPT_ID = 'plausible-script'
const DOMAIN = 'philae.design'
const SCRIPT_SRC =
  'https://plausible.io/js/script.manual.tagged-events.js'

function emptyConsent() {
  return { analyticsEnhanced: false, newsletter: false, at: null }
}

function queuePlausible() {
  if (typeof window === 'undefined') return
  window.plausible =
    window.plausible ||
    function plausibleProxy() {
      ;(window.plausible.q = window.plausible.q || []).push(arguments)
    }
}

export function getExtrasConsent() {
  if (typeof window === 'undefined') return emptyConsent()
  try {
    const raw = localStorage.getItem(CONSENT_EXTRAS_KEY)
    if (!raw) return emptyConsent()
    const parsed = JSON.parse(raw)
    return {
      analyticsEnhanced: Boolean(
        parsed.analyticsEnhanced ?? parsed.on ?? parsed.optIn,
      ),
      newsletter: Boolean(parsed.newsletter ?? parsed.on ?? parsed.optIn),
      at: parsed.at || null,
    }
  } catch {
    return emptyConsent()
  }
}

export function isExtrasOptedIn() {
  const c = getExtrasConsent()
  return Boolean(c.analyticsEnhanced || c.newsletter)
}

function persistConsent({ analyticsEnhanced, newsletter }) {
  const value = {
    analyticsEnhanced: Boolean(analyticsEnhanced),
    newsletter: Boolean(newsletter),
    at: new Date().toISOString(),
  }
  try {
    localStorage.setItem(CONSENT_EXTRAS_KEY, JSON.stringify(value))
  } catch {
    /* quota / mode privé */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(CONSENT_EXTRAS_EVENT, { detail: value }),
    )
  }
  return value
}

export function setExtrasConsent({ analyticsEnhanced, newsletter }) {
  const value = persistConsent({ analyticsEnhanced, newsletter })
  if (value.analyticsEnhanced || value.newsletter) {
    ensurePlausible()
    trackEvent('Extras opt-in')
    if (value.newsletter) trackEvent('Newsletter opt-in')
  }
  return value
}

export function toggleExtrasConsent() {
  const on = isExtrasOptedIn()
  return setExtrasConsent({
    analyticsEnhanced: !on,
    newsletter: !on,
  })
}

export function subscribeExtrasConsent(callback) {
  if (typeof window === 'undefined') return () => {}
  const handler = () => callback(getExtrasConsent())
  window.addEventListener(CONSENT_EXTRAS_EVENT, handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener(CONSENT_EXTRAS_EVENT, handler)
    window.removeEventListener('storage', handler)
  }
}

export function ensurePlausible() {
  if (typeof document === 'undefined') return
  queuePlausible()
  if (document.getElementById(SCRIPT_ID)) return
  const script = document.createElement('script')
  script.id = SCRIPT_ID
  script.defer = true
  const host =
    (typeof location !== 'undefined' && location.hostname) || DOMAIN
  script.dataset.domain = host.replace(/^www\./, '') || DOMAIN
  script.src = SCRIPT_SRC
  document.head.appendChild(script)
}

/** Pages vues : mesure de base, sans cookie, pas d’opt-in. */
export function trackPageview() {
  queuePlausible()
  window.plausible('pageview')
}

/**
 * Événements enrichis : uniquement si l’opt-in facultatif est actif.
 * @param {string} name
 * @param {Record<string, string|number|boolean>} [props]
 */
export function trackEvent(name, props) {
  if (!name || !getExtrasConsent().analyticsEnhanced) return
  queuePlausible()
  if (props && Object.keys(props).length) {
    window.plausible(name, { props })
  } else {
    window.plausible(name)
  }
}

export function initPlausible() {
  ensurePlausible()
}
