import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useConfigStore } from '../store/useConfigStore.js'

const NAV = [
  { to: '/', label: 'Accueil', end: true },
  { to: '/boutique', label: 'Boutique' },
  { to: '/configurateur', label: 'Configurateur' },
  { to: '/concept', label: 'Le concept' },
  { to: '/contact', label: 'Contact' },
]

/** Dès le premier pixel de scroll sur l’accueil → version compacte */
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

export default function SiteHeader() {
  const cartCount = useConfigStore((s) => s.cartCount)
  const location = useLocation()
  const isConfig =
    location.pathname.startsWith('/configurateur') ||
    /\/boutique\/[^/]+\/configurer$/.test(location.pathname)
  const isHome = location.pathname === '/'

  // Compact uniquement sur l’accueil, dès qu’on descend
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    if (!isHome) {
      setCompact(false)
      document.documentElement.style.setProperty('--header-current-h', '72px')
      return
    }

    // Au (re)chargement de l’accueil : grand bandeau tant que scroll = 0
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

    // Après ScrollToTop (reset asynchrone)
    const t = window.setTimeout(update, 60)
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    document.addEventListener('scroll', onScroll, { passive: true, capture: true })
    return () => {
      clearTimeout(t)
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll, { capture: true })
      document.removeEventListener('scroll', onScroll, { capture: true })
    }
  }, [isHome, location.pathname])

  // Hauteur CSS pour le stage 3D + spacer sous le header fixe
  useEffect(() => {
    const h = isHome && compact ? '52px' : '72px'
    document.documentElement.style.setProperty('--header-current-h', h)
  }, [compact, isHome])

  return (
    <header
      className={`site-header${isHome && compact ? ' is-compact' : ''}${
        isConfig ? ' is-config' : ''
      }${isHome ? ' is-home' : ''}`}
    >
      <div className="site-header-inner">
        <NavLink to="/" className="site-brand" end>
          <img src="/logo-philae.jpg" alt="" className="site-logo-img" />
          <span className="site-logo-word">PHILAE</span>
        </NavLink>

        <nav className="site-nav" aria-label="Navigation principale">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `nav-link${isActive ? ' active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="site-header-meta">
          <span className="gold-dot" aria-hidden />
          <span className="meta-text">Atelier</span>
          {cartCount > 0 && (
            <span className="cart-pill" title="Articles au panier">
              {cartCount}
            </span>
          )}
        </div>
      </div>
      <div className="site-header-line" />
    </header>
  )
}
