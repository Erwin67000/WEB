/**
 * Bouton paiement — mêmes couleurs et animation que « Voir la boutique ».
 */
export default function PayButton({
  children,
  disabled = false,
  onClick,
  type = 'button',
  className = '',
}) {
  return (
    <button
      type={type}
      className={`shop-hover-btn shop-hover-btn-wood${className ? ` ${className}` : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="shop-hover-btn-dot" aria-hidden />
      <span className="shop-hover-btn-idle">{children}</span>
      <span className="shop-hover-btn-active">
        <span>{children}</span>
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
      </span>
    </button>
  )
}
