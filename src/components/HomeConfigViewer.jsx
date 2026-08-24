import { lazy, Suspense } from 'react'
import { useI18n } from '@texte/I18nProvider.jsx'

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
    </section>
  )
}
