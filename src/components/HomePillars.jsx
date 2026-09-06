import { useEffect, useRef } from 'react'
import { useI18n } from '@texte/I18nProvider.jsx'

const PILLARS = [
  {
    id: 'design',
    n: '01',
    titleKey: 'home.pillarDesign',
    textKey: 'home.pillarDesignText',
    photo: '/accueil/concept.png',
    objectPosition: '50% 48%',
  },
  {
    id: 'liberty',
    n: '02',
    titleKey: 'home.pillarLiberty',
    textKey: 'home.pillarLibertyText',
    photo: '/accueil/design.png',
    objectPosition: '28% 50%',
  },
  {
    id: 'longevity',
    n: '03',
    titleKey: 'home.pillarLongevity',
    textKey: 'home.pillarLongevityText',
    photo: '/accueil/detail.png',
    objectPosition: '58% 50%',
  },
]

export default function HomePillars() {
  const { t } = useI18n()
  const rootRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const panels = [...root.querySelectorAll('.home-pillar-panel')]
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) entry.target.classList.add('is-in')
        }
      },
      { threshold: 0.32, rootMargin: '0px 0px -10% 0px' },
    )
    panels.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <section
      ref={rootRef}
      className="home-pillars-section"
      aria-label={t('home.pillarAria')}
    >
      {PILLARS.map((p) => (
        <article key={p.id} className="home-pillar-panel">
          <div className="home-pillar-panel-bg" aria-hidden>
            <img src={p.photo} alt="" style={{ objectPosition: p.objectPosition }} />
          </div>
          <div className="home-pillar-panel-copy">
            <span className="home-pillar-panel-n" aria-hidden>
              {p.n}
            </span>
            <h2 className="home-pillar-panel-title">{t(p.titleKey)}</h2>
            <p className="home-pillar-panel-text">{t(p.textKey)}</p>
          </div>
        </article>
      ))}
    </section>
  )
}
