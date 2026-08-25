import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '@texte/I18nProvider.jsx'
import {
  isExtrasOptedIn,
  subscribeExtrasConsent,
  toggleExtrasConsent,
} from '../lib/plausible.js'

/**
 * Bouton d’opt-in facultatif (newsletter + événements Plausible enrichis).
 * Distinct de la case CGV — ne bloque pas le paiement.
 */
export default function SoftOptIn({ id = 'soft-optin' }) {
  const { t } = useI18n()
  const [on, setOn] = useState(() => isExtrasOptedIn())

  useEffect(() => subscribeExtrasConsent(() => setOn(isExtrasOptedIn())), [])

  return (
    <div className="soft-optin">
      <button
        type="button"
        id={id}
        className={`soft-optin-btn${on ? ' is-on' : ''}`}
        onClick={() => {
          const next = toggleExtrasConsent()
          setOn(Boolean(next.analyticsEnhanced || next.newsletter))
        }}
        aria-pressed={on}
      >
        {on ? t('checkout.optInOn') : t('checkout.optInOff')}
      </button>
      <p className="soft-optin-hint">
        {t('checkout.optInHint')}{' '}
        <Link to="/politique-cookies">{t('checkout.optInCookies')}</Link>
      </p>
    </div>
  )
}
