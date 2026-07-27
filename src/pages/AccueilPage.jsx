import HomeScrollStory from '../components/HomeScrollStory.jsx'

/**
 * Accueil = récit scrollytelling.
 * Header site au-dessus ; footer après la course de scroll.
 */
export default function AccueilPage() {
  return (
    <div className="page page-accueil page-histoire page-site">
      <HomeScrollStory mode="fixed" showExit={false} />
    </div>
  )
}
