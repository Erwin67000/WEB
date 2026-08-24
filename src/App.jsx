import { useEffect } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom'
import SiteHeader from './components/SiteHeader.jsx'
import SiteFooter from './components/SiteFooter.jsx'
import BackToTop from './components/BackToTop.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'
import AccueilPage from './pages/AccueilPage.jsx'
import BoutiquePage from './pages/BoutiquePage.jsx'
import ArticlePage from './pages/ArticlePage.jsx'
import BoutiqueConfigurePage from './pages/BoutiqueConfigurePage.jsx'
import ConfigurateurPage from './pages/ConfigurateurPage.jsx'
import ConceptPage from './pages/ConceptPage.jsx'
import ContactPage from './pages/ContactPage.jsx'
import CheckoutSuccessPage from './pages/CheckoutSuccessPage.jsx'
import CheckoutCancelPage from './pages/CheckoutCancelPage.jsx'
import { ConfigStoreProvider } from './store/ConfigStoreContext.jsx'
import { useConfigStore } from './store/useConfigStore.js'
import { useI18n } from './i18n/I18nProvider.jsx'

function Shell() {
  const location = useLocation()
  const { t } = useI18n()
  const isMainConfig = location.pathname === '/configurateur'
  const isBoutiqueSession = /\/boutique\/[^/]+\/configurer$/.test(
    location.pathname,
  )
  const isHomeStory = location.pathname === '/'
  const isConfigMode = isMainConfig || isBoutiqueSession
  // Fond ivoire : Accueil, Boutique (+ fiche produit), Contact, pages commande
  // Noir : Configurateur, Concept, session boutique config
  const isIvoryBg =
    location.pathname === '/' ||
    location.pathname === '/contact' ||
    location.pathname === '/boutique' ||
    /^\/boutique\/[^/]+$/.test(location.pathname) ||
    location.pathname.startsWith('/commande/')

  useEffect(() => {
    document.title = isBoutiqueSession
      ? t('meta.titleBoutiqueConfig')
      : isMainConfig
        ? t('meta.titleConfig')
        : isHomeStory
          ? t('meta.titleHome')
          : t('meta.titleDefault')

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

    // Accueil scrollytelling : scroll document libre + header/footer
    if (isHomeStory) {
      document.documentElement.classList.add('story-mode')
      document.body.classList.add('story-mode')
      root?.classList.add('story-mode-root')
    } else {
      document.documentElement.classList.remove('story-mode')
      document.body.classList.remove('story-mode')
      root?.classList.remove('story-mode-root')
    }

    if (isIvoryBg) {
      document.documentElement.classList.add('theme-ivory')
      document.body.classList.add('theme-ivory')
      root?.classList.add('theme-ivory')
    } else {
      document.documentElement.classList.remove('theme-ivory')
      document.body.classList.remove('theme-ivory')
      root?.classList.remove('theme-ivory')
    }

    return () => {
      document.documentElement.classList.remove('config-lock')
      document.body.classList.remove('config-lock')
      root?.classList.remove('config-lock-root')
      document.documentElement.classList.remove('story-mode')
      document.body.classList.remove('story-mode')
      root?.classList.remove('story-mode-root')
      document.documentElement.classList.remove('theme-ivory')
      document.body.classList.remove('theme-ivory')
      root?.classList.remove('theme-ivory')
    }
  }, [isConfigMode, isMainConfig, isBoutiqueSession, isHomeStory, isIvoryBg, t])

  return (
    <ConfigStoreProvider store={useConfigStore}>
      <ScrollToTop />
      <div
        className={`site-root${isConfigMode ? ' is-config-mode' : ''}${
          isHomeStory ? ' is-story-mode' : ''
        }${isIvoryBg ? ' theme-ivory' : ''}`}
      >
        {/* Header toujours visible (y compris configurateur) */}
        <SiteHeader />
        <div
          className={`site-main${
            isConfigMode ? ' is-config' : isHomeStory ? ' is-story' : ' is-full'
          }`}
        >
          <Routes>
            <Route path="/" element={<AccueilPage />} />
            {/* Ancienne route histoire → accueil */}
            <Route path="/histoire" element={<Navigate to="/" replace />} />
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
            {/* Stripe Checkout — retour après paiement */}
            <Route path="/commande/succes" element={<CheckoutSuccessPage />} />
            <Route path="/commande/annule" element={<CheckoutCancelPage />} />
          </Routes>
        </div>
        {!isConfigMode && <SiteFooter />}
        <BackToTop />
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
