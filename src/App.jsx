import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import SiteHeader from './components/SiteHeader.jsx'
import SiteFooter from './components/SiteFooter.jsx'
import AccueilPage from './pages/AccueilPage.jsx'
import HistoirePage from './pages/HistoirePage.jsx'
import BoutiquePage from './pages/BoutiquePage.jsx'
import ArticlePage from './pages/ArticlePage.jsx'
import BoutiqueConfigurePage from './pages/BoutiqueConfigurePage.jsx'
import ConfigurateurPage from './pages/ConfigurateurPage.jsx'
import ConceptPage from './pages/ConceptPage.jsx'
import ContactPage from './pages/ContactPage.jsx'
import { ConfigStoreProvider } from './store/ConfigStoreContext.jsx'
import { useConfigStore } from './store/useConfigStore.js'

function Shell() {
  const location = useLocation()
  const isMainConfig = location.pathname === '/configurateur'
  const isBoutiqueSession = /\/boutique\/[^/]+\/configurer$/.test(
    location.pathname,
  )
  const isHistoire = location.pathname === '/histoire'
  const isConfigMode = isMainConfig || isBoutiqueSession
  // Plein écran sans header / footer
  const isChromeLess = isConfigMode || isHistoire

  useEffect(() => {
    document.title = isHistoire
      ? 'Philae — Histoire'
      : isBoutiqueSession
        ? 'Philae — Configurer (boutique)'
        : isMainConfig
          ? 'Philae — Configurateur'
          : 'Philae — Mobilier géométrique'

    const root = document.getElementById('root')
    // config-lock bloque le scroll document — on ne l’applique PAS à /histoire
    if (isConfigMode) {
      document.documentElement.classList.add('config-lock')
      document.body.classList.add('config-lock')
      root?.classList.add('config-lock-root')
    } else {
      document.documentElement.classList.remove('config-lock')
      document.body.classList.remove('config-lock')
      root?.classList.remove('config-lock-root')
    }

    if (isHistoire) {
      document.documentElement.classList.add('story-mode')
      document.body.classList.add('story-mode')
      root?.classList.add('story-mode-root')
    } else {
      document.documentElement.classList.remove('story-mode')
      document.body.classList.remove('story-mode')
      root?.classList.remove('story-mode-root')
    }

    return () => {
      document.documentElement.classList.remove('config-lock')
      document.body.classList.remove('config-lock')
      root?.classList.remove('config-lock-root')
      document.documentElement.classList.remove('story-mode')
      document.body.classList.remove('story-mode')
      root?.classList.remove('story-mode-root')
    }
  }, [isConfigMode, isMainConfig, isBoutiqueSession, isHistoire])

  return (
    <ConfigStoreProvider store={useConfigStore}>
      <div
        className={`site-root${isConfigMode ? ' is-config-mode' : ''}${
          isHistoire ? ' is-story-mode' : ''
        }`}
      >
        {!isChromeLess && <SiteHeader />}
        <div
          className={`site-main${
            isConfigMode ? ' is-config' : isHistoire ? ' is-story' : ' is-full'
          }`}
        >
          <Routes>
            <Route path="/" element={<AccueilPage />} />
            <Route path="/histoire" element={<HistoirePage />} />
            <Route path="/boutique" element={<BoutiquePage />} />
            <Route path="/boutique/:productId" element={<ArticlePage />} />
            <Route
              path="/boutique/:productId/configurer"
              element={<BoutiqueConfigurePage />}
            />
            <Route path="/configurateur" element={<ConfigurateurPage />} />
            <Route path="/concept" element={<ConceptPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/atelier" element={<ConceptPage />} />
          </Routes>
        </div>
        {!isChromeLess && <SiteFooter />}
      </div>
    </ConfigStoreProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  )
}
