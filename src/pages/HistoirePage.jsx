import HomeScrollStory from '../components/HomeScrollStory.jsx'

/**
 * Page récit scrollytelling — plein écran, sans chrome site.
 * Route : /histoire
 */
export default function HistoirePage() {
  return (
    <div className="page page-histoire">
      <HomeScrollStory mode="fixed" />
    </div>
  )
}
