import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ControlPanel from '../components/ControlPanel.jsx'
import { ConfigStoreProvider } from '../store/ConfigStoreContext.jsx'
import { useBoutiqueSessionStore } from '../store/useBoutiqueSessionStore.js'
import { useConfigStore } from '../store/useConfigStore.js'
import { getCatalogItem } from '../data/catalog.js'

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

/**
 * Configurateur isolé d’une ligne matrice_catalogue.
 * - repart toujours de la base CSV (env vide)
 * - n’écrit le main qu’après « Sauvegarder »
 */
export default function BoutiqueConfigurePage() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const [row, setRow] = useState(null)
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)
  const [savedMsg, setSavedMsg] = useState(null)

  useEffect(() => {
    let cancelled = false
    setReady(false)
    setSavedMsg(null)
    getCatalogItem(productId)
      .then((found) => {
        if (cancelled) return
        if (!found) {
          setError('Configuration introuvable dans matrice_catalogue.')
          return
        }
        setRow(found)
        // Chaque visite : base catalogue, environnement vide
        useBoutiqueSessionStore.getState().loadFromCatalogRow(found)
        setReady(true)
      })
      .catch((e) => {
        if (!cancelled) setError(String(e.message || e))
      })
    return () => {
      cancelled = true
    }
  }, [productId])

  if (error) {
    return (
      <div className="page page-site page-pad-x" style={{ padding: '2rem' }}>
        <p className="action-msg">{error}</p>
        <Link to="/boutique" className="btn btn-wood">
          ← Boutique
        </Link>
      </div>
    )
  }

  if (!row) {
    return (
      <div className="page page-site page-pad-x" style={{ padding: '2rem' }}>
        <p className="hint">Chargement de la base matrice…</p>
      </div>
    )
  }

  const saveToMain = () => {
    const snap = useBoutiqueSessionStore.getState().getSnapshot()
    useConfigStore.getState().hydrateFromSnapshot(snap, { keepContact: true })
    useBoutiqueSessionStore.setState({ dirty: false })
    setSavedMsg('Configuration enregistrée dans le configurateur principal.')
  }

  const saveAndOpenMain = () => {
    saveToMain()
    navigate('/configurateur')
  }

  const discardAndBack = () => {
    navigate(`/boutique/${productId}`)
  }

  return (
    <ConfigStoreProvider store={useBoutiqueSessionStore}>
      <div className="boutique-session-shell">
        <div className="boutique-session-bar">
          <div className="boutique-session-bar-left">
            <button
              type="button"
              className="btn btn-ghost session-btn"
              onClick={discardAndBack}
            >
              ← Retour
            </button>
            <div className="session-title">
              <span className="section-kicker">Session · matrice_catalogue</span>
              <strong>{row.name}</strong>
              <span className="hint">
                Base CSV · le main n’est modifié qu’à la sauvegarde
              </span>
            </div>
          </div>
          <div className="boutique-session-bar-actions">
            {savedMsg && <span className="session-saved">{savedMsg}</span>}
            <button
              type="button"
              className="btn btn-wood session-btn"
              onClick={discardAndBack}
            >
              Annuler
            </button>
            <button
              type="button"
              className="btn btn-primary session-btn"
              onClick={saveToMain}
            >
              Sauvegarder vers le main
            </button>
            <button
              type="button"
              className="btn btn-primary session-btn"
              onClick={saveAndOpenMain}
            >
              Sauvegarder &amp; ouvrir
            </button>
          </div>
        </div>

        {ready && (
          <div className="config-layout configurator-app boutique-session-config">
            <ControlPanel />
            <Suspense fallback={<ViewportFallback />}>
              <Configurateur3D />
            </Suspense>
          </div>
        )}
      </div>
    </ConfigStoreProvider>
  )
}
