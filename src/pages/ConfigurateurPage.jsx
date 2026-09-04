import { lazy, Suspense, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import ControlPanel from '../components/ControlPanel.jsx'
import { useConfigStore } from '../store/useConfigStore.js'
import { snapshotFromState } from '../store/createConfigStore.js'
import { ENVIRONMENTS } from '../1_STRUCTURE/00_matrice/matrice_configuration.js'
import { useI18n } from '@texte/I18nProvider.jsx'
import { fetchSession } from '../lib/authClient.js'
import {
  persistSavedConfig,
  fetchCurrentConfig,
  readLocalConfig,
} from '../lib/savedConfig.js'
import { bindPhilaeCadExport } from '../lib/furnitureExport.js'

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
  const hydrateFromSnapshot = useConfigStore((s) => s.hydrateFromSnapshot)
  const restored = useRef(false)

  useEffect(() => {
    const env = params.get('env')
    if (env && ENVIRONMENTS[env]) {
      setEnvironment(env)
    }
  }, [params, setEnvironment])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const st = useConfigStore.getState()
      if (st.configHydrated || st.dirty) return
      if (params.get('resume') === '1') {
        const { fetchDraft } = await import('../lib/checkoutDraft.js')
        const draft = await fetchDraft()
        if (cancelled) return
        if (draft?.config?.units?.length) {
          hydrateFromSnapshot(
            {
              units: draft.config.units,
              notes: draft.config.notes,
              quoteRef: draft.quoteRef,
              contact: draft.config.contact,
              environmentId: draft.config.environmentId,
            },
            { keepContact: false },
          )
          restored.current = true
          return
        }
      }
      const session = await fetchSession()
      if (cancelled) return
      if (session.user) {
        const remote = await fetchCurrentConfig()
        if (cancelled) return
        if (remote?.snapshot?.units?.length) {
          hydrateFromSnapshot(remote.snapshot, { keepContact: false })
          restored.current = true
          return
        }
      }
      const local = readLocalConfig()
      if (!cancelled && local?.units?.length) {
        hydrateFromSnapshot(local, { keepContact: false })
        restored.current = true
      }
    })()
    return () => {
      cancelled = true
    }
  }, [params, hydrateFromSnapshot])

  useEffect(() => {
    let timer = 0
    const flush = () => {
      const snap = snapshotFromState(useConfigStore.getState())
      persistSavedConfig(snap)
    }
    const unsub = useConfigStore.subscribe((s) => {
      if (!s.dirty) return
      window.clearTimeout(timer)
      timer = window.setTimeout(flush, 1600)
    })
    const onHide = () => {
      if (useConfigStore.getState().dirty) flush()
    }
    window.addEventListener('pagehide', onHide)
    return () => {
      unsub()
      window.clearTimeout(timer)
      window.removeEventListener('pagehide', onHide)
    }
  }, [])

  useEffect(() => {
    return bindPhilaeCadExport(() => useConfigStore.getState())
  }, [])

  return (
    <div className="config-layout configurator-app">
      <ControlPanel />
      <Suspense fallback={<ViewportFallback />}>
        <Configurateur3D />
      </Suspense>
    </div>
  )
}
