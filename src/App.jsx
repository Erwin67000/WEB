import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import SiteHeader from './components/SiteHeader.jsx'
import SiteFooter from './components/SiteFooter.jsx'
import AccueilPage from './pages/AccueilPage.jsx'
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
  const isConfigMode = isMainConfig || isBoutiqueSession

  useEffect(() => {
    document.title = isBoutiqueSession
      ? 'Philae — Configurer (boutique)'
      : isMainConfig
        ? 'Philae — Configurateur'
        : 'Philae — Mobilier géométrique'

    const root = document.getElementById('root')
    if (isConfigMode) {
      document.documentElement.classList.add('config-lock')
      document.body.classList.add('config-lock')
      root?.classList.add('config-lock-root')
    } else {
      document.documentElement.classList.remove('config-lock')
      document.body.classList.remove('config-lock')
      root?.classList.remove('config-lock-root')
    }
    return () => {
      document.documentElement.classList.remove('config-lock')
      document.body.classList.remove('config-lock')
      root?.classList.remove('config-lock-root')
    }
  }, [isConfigMode, isMainConfig, isBoutiqueSession])

  return (
    <ConfigStoreProvider store={useConfigStore}>
      <div className={`site-root${isConfigMode ? ' is-config-mode' : ''}`}>
        <SiteHeader />
        <div
          className={`site-main${isConfigMode ? ' is-config' : ' is-full'}`}
        >
          <Routes>
            <Route path="/" element={<AccueilPage />} />
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
        {!isConfigMode && <SiteFooter />}
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
