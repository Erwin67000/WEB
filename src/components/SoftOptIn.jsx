import { useEffect, useState } from 'react'
import { useI18n } from '@texte/I18nProvider.jsx'
import {
  isNewsletterOptedIn,
  subscribeNewsletterConsent,
  toggleNewsletterConsent,
} from '../lib/plausible.js'

/**
 * Bouton facultatif : inscription newsletter.
 * Distinct de la case CGV — ne bloque pas le paiement.
 */
export default function SoftOptIn({ id = 'soft-optin' }) {
  const { t } = useI18n()
  const [on, setOn] = useState(() => isNewsletterOptedIn())

  useEffect(
    () => subscribeNewsletterConsent(() => setOn(isNewsletterOptedIn())),
    [],
  )

  return (
    <button
      type="button"
      id={id}
      className={`soft-optin-btn${on ? ' is-on' : ''}`}
      onClick={() => setOn(toggleNewsletterConsent().newsletter)}
      aria-pressed={on}
    >
      {on ? t('checkout.optInOn') : t('checkout.optInOff')}
    </button>
  )
}
