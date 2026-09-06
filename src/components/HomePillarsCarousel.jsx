import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '@texte/I18nProvider.jsx'

const PILLARS = [
  {
    id: 'design',
    n: '01',
    titleKey: 'home.pillarDesign',
    textKey: 'home.pillarDesignText',
    photo: null,
  },
  {
    id: 'liberty',
    n: '02',
    titleKey: 'home.pillarLiberty',
    textKey: 'home.pillarLibertyText',
    photo: <img src="/accueil/detail.png" alt="Liberty" />,
  },
  {
    id: 'longevity',
    n: '03',
    titleKey: 'home.pillarLongevity',
    textKey: 'home.pillarLongevityText',
    photo: null,
  },
]

export default function HomePillarsCarousel() {
  const { t } = useI18n()
  const [index, setIndex] = useState(0)
  const touchX = useRef(null)
  const n = PILLARS.length
  const slide = PILLARS[index]

  const go = useCallback(
    (dir) => {
      setIndex((cur) => (cur + dir + n) % n)
    },
    [n],
  )

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  const onPointerDown = (e) => {
    touchX.current = e.clientX
  }
  const onPointerUp = (e) => {
    if (touchX.current == null) return
    const dx = e.clientX - touchX.current
    touchX.current = null
    if (Math.abs(dx) < 48) return
    go(dx < 0 ? 1 : -1)
  }

  return (
    <section
      className="home-pillars-section"
      aria-label={t('home.pillarAria')}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <div className="home-pillars-carousel">
        <p className="section-kicker home-pillars-kicker">
          {t('home.pillarKicker')}
        </p>

        <article className="home-pillar-slide" key={slide.id}>
          <div className="home-pillar-copy">
            <span className="home-pillar-n" aria-hidden>
              {slide.n}
            </span>
            <h2 className="home-pillar-title">{t(slide.titleKey)}</h2>
            <p className="home-pillar-text">{t(slide.textKey)}</p>
          </div>
          <figure
            className={`home-pillar-photo${slide.photo ? '' : ' is-pending'}`}
          >
            {slide.photo ? (
              <img src={slide.photo} alt="" />
            ) : (
              <span>{t('home.pillarPhotoSoon')}</span>
            )}
          </figure>
        </article>

        <div className="home-pillars-nav">
          <button
            type="button"
            className="home-pillars-arrow"
            onClick={() => go(-1)}
            aria-label={t('home.pillarPrev')}
          >
            ←
          </button>
          <div className="home-pillars-dots" role="tablist">
            {PILLARS.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`${t(p.titleKey)}`}
                className={`home-pillars-dot${i === index ? ' is-active' : ''}`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
          <button
            type="button"
            className="home-pillars-arrow"
            onClick={() => go(1)}
            aria-label={t('home.pillarNext')}
          >
            →
          </button>
        </div>
      </div>
    </section>
  )
}
