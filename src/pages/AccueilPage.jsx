import { useCallback, useState } from 'react'
import HomeScrollStory from '../components/HomeScrollStory.jsx'
import HomePlayground from '../components/HomePlayground.jsx'

/**
 * Accueil = récit scrollytelling (jeu d’assemblage)
 *          + terrain de jeu (missions, mondes, XP).
 * Vision : playground pour designers en herbe.
 */
export default function AccueilPage() {
  const [storyXp, setStoryXp] = useState(0)

  const onStoryProgress = useCallback(({ progress }) => {
    // XP récit : jusqu’à 150 en fin de scrollytelling
    const xp = Math.round(Math.min(1, progress) * 150)
    setStoryXp((prev) => Math.max(prev, xp))
  }, [])

  return (
    <div className="page page-accueil page-histoire page-site page-playground">
      <HomeScrollStory
        mode="fixed"
        showExit={false}
        onProgress={onStoryProgress}
      />
      <HomePlayground storyXp={storyXp} />
    </div>
  )
}
