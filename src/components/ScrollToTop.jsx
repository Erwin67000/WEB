import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Remet le scroll en haut à chaque changement de page
 * (y compris retour sur l’accueil → scrollytelling à 0 %).
 */
export default function ScrollToTop() {
  const { pathname, search, hash } = useLocation()

  useEffect(() => {
    // Ancres #section : on laisse le navigateur gérer
    if (hash) return

    const reset = () => {
      window.scrollTo(0, 0)
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
      // Conteneurs internes éventuels
      const root = document.getElementById('root')
      if (root) root.scrollTop = 0
      document
        .querySelectorAll('.site-main, .page-site, .page')
        .forEach((el) => {
          if (el instanceof HTMLElement && el.scrollTop) el.scrollTop = 0
        })
    }

    // Immédiat + après paint (layout asynchrone des pages)
    reset()
    const t0 = requestAnimationFrame(reset)
    const t1 = window.setTimeout(reset, 0)
    const t2 = window.setTimeout(reset, 50)

    return () => {
      cancelAnimationFrame(t0)
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [pathname, search, hash])

  return null
}
