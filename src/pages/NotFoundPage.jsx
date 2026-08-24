import { Link } from 'react-router-dom'
import { useI18n } from '@texte/I18nProvider.jsx'

export default function NotFoundPage() {
  const { t } = useI18n()
  return (
    <div className="page page-site page-legal">
      <header className="page-head">
        <p className="section-kicker">404</p>
        <h1 className="hero-title">{t('notFound.title')}</h1>
        <p className="hero-lead">{t('notFound.lead')}</p>
        <Link to="/" className="btn btn-primary">
          {t('notFound.home')}
        </Link>
      </header>
    </div>
  )
}
