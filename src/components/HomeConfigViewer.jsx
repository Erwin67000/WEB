import { lazy, Suspense } from 'react'
import { useI18n } from '../i18n/I18nProvider.jsx'

const Configurateur3D = lazy(() => import('../2_BUILD/3Dconfigurateur.jsx'))

export default function HomeConfigViewer() {
  const { t } = useI18n()

  return (
    <section className="home-viewer" aria-label={t('home.viewerAria')}>
      <div className="home-viewer-stage">
        <Suspense
          fallback={
            <div className="home-viewer-fallback">{t('home.viewerLoading')}</div>
          }
        >
          <Configurateur3D orbitOnly ivory />
        </Suspense>
      </div>
      <p className="home-viewer-hint">{t('home.viewerHint')}</p>
    </section>
  )
}
