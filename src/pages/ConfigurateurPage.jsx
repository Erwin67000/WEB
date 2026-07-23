import { lazy, Suspense } from 'react'
import ControlPanel from '../components/ControlPanel.jsx'

// Scène 3D lourde (three + fiber + drei) : chargée à part → UI immédiate
const Configurateur3D = lazy(() => import('../2_BUILD/3Dconfigurateur.jsx'))

function ViewportFallback() {
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
      Chargement de la scène 3D…
    </div>
  )
}

export default function ConfigurateurPage() {
  return (
    <div className="config-layout configurator-app">
      <ControlPanel />
      <Suspense fallback={<ViewportFallback />}>
        <Configurateur3D />
      </Suspense>
    </div>
  )
}
