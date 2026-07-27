import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Bouton « remonter en haut » — visible sur l’accueil après scroll.
 */
export default function BackToTop() {
  const location = useLocation()
  const isHome = location.pathname === '/'
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isHome) {
      setVisible(false)
      return
    }
    const onScroll = () => setVisible(window.scrollY > 320)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isHome])

  if (!isHome || !visible) return null

  return (
    <button
      type="button"
      className="back-to-top"
      aria-label="Revenir en haut de la page"
      title="Haut de page"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <span aria-hidden>↑</span>
      <span className="back-to-top-label">Haut</span>
    </button>
  )
}
