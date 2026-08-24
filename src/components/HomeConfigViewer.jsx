import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '@texte/I18nProvider.jsx'

const Configurateur3D = lazy(() => import('../2_BUILD/3Dconfigurateur.jsx'))

export default function HomeConfigViewer() {
  const { t } = useI18n()

  return (
    <section className="home-close" aria-label={t('home.viewerAria')}>
      <div className="home-close-copy">
        <h2 className="home-close-title">{t('home.closeTitle')}</h2>
        <p className="home-close-lead">{t('home.closeLead')}</p>
        <div className="home-manifesto-ctas">
          <Link to="/boutique" className="btn btn-primary">
            {t('home.ctaShop')}
          </Link>
          <Link to="/configurateur" className="btn btn-wood">
            {t('home.ctaConfig')}
          </Link>
        </div>
      </div>
      <div className="home-viewer-stage">
        <Suspense
          fallback={
            <div className="home-viewer-fallback">{t('home.viewerLoading')}</div>
          }
        >
          <Configurateur3D orbitOnly ivory />
        </Suspense>
      </div>
    </section>
  )
}
