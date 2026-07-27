import { NavLink, useLocation } from 'react-router-dom'
import { useConfigStore } from '../store/useConfigStore.js'

const NAV = [
  { to: '/', label: 'Accueil', end: true },
  { to: '/boutique', label: 'Boutique' },
  { to: '/configurateur', label: 'Configurateur' },
  { to: '/concept', label: 'Le concept' },
  { to: '/contact', label: 'Contact' },
]

export default function SiteHeader() {
  const cartCount = useConfigStore((s) => s.cartCount)
  const location = useLocation()
  const isConfig = location.pathname.startsWith('/configurateur')

  return (
    <header className={`site-header${isConfig ? ' is-config' : ''}`}>
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
