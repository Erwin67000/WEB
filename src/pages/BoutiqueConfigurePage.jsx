import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ControlPanel from '../components/ControlPanel.jsx'
import { ConfigStoreProvider } from '../store/ConfigStoreContext.jsx'
import { useBoutiqueSessionStore } from '../store/useBoutiqueSessionStore.js'
import { useConfigStore } from '../store/useConfigStore.js'
import { getCatalogItem } from '../data/catalog.js'
import { useI18n, useCatalogText } from '@texte/I18nProvider.jsx'

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

/**
 * Configurateur isolé d’une ligne modele_boutique.
 * - repart toujours de la base CSV (env vide)
 * - n’écrit le main qu’après « Sauvegarder »
 */
export default function BoutiqueConfigurePage() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const { t } = useI18n()
  const catalog = useCatalogText()
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
          setError('missing')
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
        <p className="action-msg">
          {error === 'missing' ? t('boutiqueSession.missing') : error}
        </p>
        <Link to="/boutique" className="btn btn-wood">
          {t('boutiqueSession.backShop')}
        </Link>
      </div>
    )
  }

  if (!row) {
    return (
      <div className="page page-site page-pad-x" style={{ padding: '2rem' }}>
        <p className="hint">{t('boutiqueSession.loading')}</p>
      </div>
    )
  }

  const saveToMain = () => {
    const snap = useBoutiqueSessionStore.getState().getSnapshot()
    useConfigStore.getState().hydrateFromSnapshot(snap, { keepContact: true })
    useBoutiqueSessionStore.setState({ dirty: false })
    setSavedMsg(t('boutiqueSession.saved'))
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
              {t('boutiqueSession.back')}
            </button>
            <div className="session-title">
              <span className="section-kicker">{t('boutiqueSession.kicker')}</span>
              <strong>{catalog.name(row)}</strong>
              <span className="hint">{t('boutiqueSession.hint')}</span>
            </div>
          </div>
          <div className="boutique-session-bar-actions">
            {savedMsg && <span className="session-saved">{savedMsg}</span>}
            <button
              type="button"
              className="btn btn-wood session-btn"
              onClick={discardAndBack}
            >
              {t('boutiqueSession.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary session-btn"
              onClick={saveToMain}
            >
              {t('boutiqueSession.saveMain')}
            </button>
            <button
              type="button"
              className="btn btn-primary session-btn"
              onClick={saveAndOpenMain}
            >
              {t('boutiqueSession.saveOpen')}
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
