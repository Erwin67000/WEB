import { lazy, Suspense } from 'react'
import { useI18n } from '@texte/I18nProvider.jsx'
import ShopHoverButton from './ShopHoverButton.jsx'

const Configurateur3D = lazy(() => import('../2_BUILD/3Dconfigurateur.jsx'))

export default function HomeConfigViewer() {
  const { t } = useI18n()

  return (
    <section className="home-close" aria-label={t('home.viewerAria')}>
      <div className="home-close-copy">
        <h2 className="home-close-title">{t('home.closeTitle')}</h2>
        <p className="home-close-lead">{t('home.closeLead')}</p>
        <div className="home-manifesto-ctas">
          <ShopHoverButton variant="wood" size="lg" to="/boutique">
            {t('home.ctaShop')}
          </ShopHoverButton>
          <ShopHoverButton variant="primary" size="lg" to="/configurateur">
            {t('home.ctaConfig')}
          </ShopHoverButton>
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
