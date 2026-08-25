import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useConfigStore } from '../store/useConfigStore.js'
import { useI18n } from '@texte/I18nProvider.jsx'

const NAV = [
  { to: '/', key: 'nav.home', end: true },
  { to: '/boutique', key: 'nav.shop' },
  { to: '/configurateur', key: 'nav.configurator' },
  { to: '/concept', key: 'nav.concept' },
  { to: '/contact', key: 'nav.contact' },
  { to: '/compte', key: 'nav.account' },
]

const COMPACT_AFTER = 12

function getScrollY() {
  return (
    window.scrollY ||
    window.pageYOffset ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0
  )
}

function LangSwitch() {
  const { lang, setLang, t } = useI18n()

  return (
    <div className="lang-switch" role="group" aria-label={t('lang.aria')}>
      <button
        type="button"
        className={`lang-btn${lang === 'en' ? ' is-active' : ''}`}
        onClick={() => setLang('en')}
        aria-pressed={lang === 'en'}
      >
        {t('lang.en')}
      </button>
      <span className="lang-sep" aria-hidden>
        /
      </span>
      <button
        type="button"
        className={`lang-btn${lang === 'fr' ? ' is-active' : ''}`}
        onClick={() => setLang('fr')}
        aria-pressed={lang === 'fr'}
      >
        {t('lang.fr')}
      </button>
    </div>
  )
}

export default function SiteHeader() {
  const cartCount = useConfigStore((s) => s.cartCount)
  const location = useLocation()
  const { t } = useI18n()
  const isConfig =
    location.pathname.startsWith('/configurateur') ||
    /\/boutique\/[^/]+\/configurer$/.test(location.pathname)
  const isHome = location.pathname === '/'

  const [compact, setCompact] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (isConfig) {
      setCompact(false)
      document.documentElement.style.setProperty('--header-current-h', '64px')
      return
    }

    setCompact(false)

    let raf = 0
    const update = () => {
      const next = getScrollY() > COMPACT_AFTER
      setCompact((prev) => (prev === next ? prev : next))
    }

    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(update)
    }

    const timer = window.setTimeout(update, 60)
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    document.addEventListener('scroll', onScroll, { passive: true, capture: true })
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll, { capture: true })
      document.removeEventListener('scroll', onScroll, { capture: true })
    }
  }, [isConfig, location.pathname])

  useEffect(() => {
    const h = !isConfig && compact ? '56px' : '64px'
    document.documentElement.style.setProperty('--header-current-h', h)
  }, [compact, isConfig])

  return (
    <header
      className={`site-header${compact ? ' is-compact' : ''}${
        isConfig ? ' is-config' : ''
      }${isHome ? ' is-home' : ''}${menuOpen ? ' is-menu-open' : ''}`}
    >
      <div className="site-header-inner">
        <div className="site-header-left">
          <NavLink to="/" className="site-brand" end>
            <img src="/logo-philae.jpg" alt="" className="site-logo-img" />
            <span className="site-logo-word">PHILAE</span>
          </NavLink>
        </div>

        <button
          type="button"
          className="nav-burger"
          aria-expanded={menuOpen}
          aria-controls="site-nav"
          aria-label={t('nav.menu')}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav id="site-nav" className={`site-nav${menuOpen ? ' is-open' : ''}`} aria-label={t('footer.nav')}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `nav-link${isActive ? ' active' : ''}`
              }
              onClick={() => setMenuOpen(false)}
            >
              {t(item.key)}
            </NavLink>
          ))}
        </nav>

        <div className="site-header-meta">
          <LangSwitch />
          {cartCount > 0 && (
            <span className="cart-pill" title={t('nav.shop')}>
              {cartCount}
            </span>
          )}
        </div>
      </div>
      <div className="site-header-line" />
    </header>
  )
}
