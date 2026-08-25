import HomeManifesto from '../components/HomeManifesto.jsx'
import HomeScrollStory from '../components/HomeScrollStory.jsx'
import HomeConfigViewer from '../components/HomeConfigViewer.jsx'

export default function AccueilPage() {
  return (
    <div className="page page-accueil page-histoire page-site">
      <HomeManifesto />
      <HomeScrollStory mode="fixed" showExit={false} />
      <HomeConfigViewer />
    </div>
  )
}
