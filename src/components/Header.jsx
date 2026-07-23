import { NavLink } from 'react-router-dom'
import { useConfigStore } from '../store/useConfigStore.js'

export default function Header() {
  const cartCount = useConfigStore((s) => s.cartCount)
  const lang = useConfigStore((s) => s.lang)

  return (
    <header className="site-header">
      <NavLink to="/" className="brand" end>
        <span className="brand-mark" aria-hidden>
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <path
              d="M4 28 L16 4 L28 28 Z"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
            <path
              d="M10 28 L16 14 L22 28"
              stroke="currentColor"
              strokeWidth="1.2"
              fill="none"
            />
          </svg>
        </span>
        <span className="brand-name">PHILAE</span>
      </NavLink>

      <nav className="main-nav">
        <NavLink to="/" end>
          Configurateur
        </NavLink>
        <NavLink to="/boutique">Boutique</NavLink>
        <NavLink to="/atelier">Atelier</NavLink>
        <NavLink to="/contact">Contact</NavLink>
      </nav>

      <div className="header-actions">
        <button type="button" className="lang-btn" aria-label="Langue">
          {lang}
        </button>
        <button type="button" className="cart-btn" aria-label="Panier">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M6 6h15l-1.5 9h-12z" />
            <circle cx="9" cy="20" r="1" fill="currentColor" />
            <circle cx="18" cy="20" r="1" fill="currentColor" />
            <path d="M6 6L5 3H2" />
          </svg>
          <span className="cart-count">{cartCount}</span>
        </button>
      </div>
    </header>
  )
}
