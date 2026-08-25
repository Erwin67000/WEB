/**
 * Bouton hover type Magic UI / 21st.dev interactive-hover-button :
 * pastille qui s’étend, libellé qui glisse, flèche qui entre.
 * Variantes de fond distinctes (wood / primary).
 */
import { Link } from 'react-router-dom'

function ArrowIcon() {
  return (
    <svg
      className="shop-hover-btn-arrow"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M13.172 12 8.222 7.05l1.414-1.414L16 12l-6.364 6.364-1.414-1.414z"
      />
    </svg>
  )
}

export default function ShopHoverButton({
  children,
  variant = 'wood',
  to,
  type = 'button',
  onClick,
  className = '',
  disabled = false,
}) {
  const cls = `shop-hover-btn shop-hover-btn-${variant}${className ? ` ${className}` : ''}`
  const inner = (
    <>
      <span className="shop-hover-btn-dot" aria-hidden />
      <span className="shop-hover-btn-idle">{children}</span>
      <span className="shop-hover-btn-active">
        <span>{children}</span>
        <ArrowIcon />
      </span>
    </>
  )

  if (to) {
    return (
      <Link to={to} className={cls}>
        {inner}
      </Link>
    )
  }

  return (
    <button
      type={type}
      className={cls}
      onClick={onClick}
      disabled={disabled}
    >
      {inner}
    </button>
  )
}
