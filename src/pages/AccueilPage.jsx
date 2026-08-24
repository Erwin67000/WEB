import HomeManifesto from '../components/HomeManifesto.jsx'
import HomeScrollStory from '../components/HomeScrollStory.jsx'
import HomeConfigViewer from '../components/HomeConfigViewer.jsx'

/**
 * Accueil :
 *  1. Plein écran — Form and function + 3 encadrés
 *  2. Scrollytelling — 6 LEVELS
 *  3. Visualiseur 3D du configurateur main (orbit + zoom)
 *  4. Pied de page (SiteFooter)
 */
export default function AccueilPage() {
  return (
    <div className="page page-accueil page-histoire page-site">
      <HomeManifesto />
      <HomeScrollStory mode="fixed" showExit={false} />
      <HomeConfigViewer />
    </div>
  )
}
