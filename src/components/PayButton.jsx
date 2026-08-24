/**
 * Bouton paiement — uiverse.io/vinodjangid07/tall-termite-79
 * (carte bancaire + mix-blend hover).
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
      className={`pay-btn${className ? ` ${className}` : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="pay-btn-label">{children}</span>
      <svg
        className="pay-btn-icon"
        viewBox="0 0 576 512"
        aria-hidden
      >
        <path d="M64 32C28.7 32 0 60.7 0 96v32H576V96c0-35.3-28.7-64-64-64H64zm512 128H0V416c0 35.3 28.7 64 64 64H512c35.3 0 64-28.7 64-64V160zM152 272c8.8 0 16 7.2 16 16s-7.2 16-16 16H104c-8.8 0-16-7.2-16-16s7.2-16 16-16h48zm80 16c0-8.8 7.2-16 16-16h48c8.8 0 16 7.2 16 16s-7.2 16-16 16H248c-8.8 0-16-7.2-16-16z" />
      </svg>
    </button>
  )
}
