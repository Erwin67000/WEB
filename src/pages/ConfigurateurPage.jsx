import { lazy, Suspense, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import ControlPanel from '../components/ControlPanel.jsx'
import { useConfigStore } from '../store/useConfigStore.js'
import { ENVIRONMENTS } from '../1_STRUCTURE/00_matrice/matrice_configuration.js'
import { useI18n } from '@texte/I18nProvider.jsx'

// Scène 3D lourde (three + fiber + drei) : chargée à part → UI immédiate
const Configurateur3D = lazy(() => import('../2_BUILD/3Dconfigurateur.jsx'))

function ViewportFallback() {
  const { t } = useI18n()
  return (
    <div
      className="viewport-3d"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#888',
        fontSize: '0.9rem',
        letterSpacing: '0.06em',
      }}
    >
      {t('config.loading3d')}
    </div>
  )
}

export default function ConfigurateurPage() {
  const [params] = useSearchParams()
  const setEnvironment = useConfigStore((s) => s.setEnvironment)

  // Terrain de jeu / deep-link : /configurateur?env=chambre
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
