import { useI18n } from '@texte/I18nProvider.jsx'

const SLUGS = {
  legal: 'legal',
  terms: 'terms',
  privacy: 'privacy',
  shipping: 'shipping',
}

export default function LegalPage({ kind }) {
  const { t } = useI18n()
  const key = SLUGS[kind] || 'legal'

  return (
    <div className="page page-site page-legal">
      <header className="page-head">
        <p className="section-kicker">{t('legalPage.updated')}</p>
        <h1 className="hero-title">{t(`legalPage.${key}.title`)}</h1>
      </header>
      <p className="legal-body">{t(`legalPage.${key}.body`)}</p>
    </div>
  )
}
