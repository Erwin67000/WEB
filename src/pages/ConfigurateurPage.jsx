import { lazy, Suspense, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import ControlPanel from '../components/ControlPanel.jsx'
import { useConfigStore } from '../store/useConfigStore.js'
import { ENVIRONMENTS } from '../1_STRUCTURE/00_matrice/matrice_configuration.js'
import { useI18n } from '@texte/I18nProvider.jsx'

const Configurateur3D = lazy(() => import('../2_BUILD/3Dconfigurateur.jsx'))

function ViewportFallback() {
  const { t } = useI18n()
  return (
    <div className="viewport-3d config-loader">
      <img src="/logo-philae.jpg" alt="" className="config-loader-mark" />
      <p className="config-loader-brand">{t('config.loadingBrand')}</p>
      <span className="config-loader-bar" aria-hidden />
      <p className="config-loader-caption">{t('config.loading3d')}</p>
    </div>
  )
}

export default function ConfigurateurPage() {
  const [params] = useSearchParams()
  const setEnvironment = useConfigStore((s) => s.setEnvironment)

  useEffect(() => {
    const env = params.get('env')
    if (env && ENVIRONMENTS[env]) {
      setEnvironment(env)
    }
  }, [params, setEnvironment])

  return (
    <div className="config-layout configurator-app">
      <ControlPanel />
      <Suspense fallback={<ViewportFallback />}>
        <Configurateur3D />
      </Suspense>
    </div>
  )
}
