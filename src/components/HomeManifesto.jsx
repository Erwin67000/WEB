import { useI18n } from '@texte/I18nProvider.jsx'

const PILLARS = [
  { id: 'design', n: '01', titleKey: 'home.pillarDesign', textKey: 'home.pillarDesignText' },
  { id: 'function', n: '02', titleKey: 'home.pillarFunction', textKey: 'home.pillarFunctionText' },
  { id: 'durability', n: '03', titleKey: 'home.pillarDurability', textKey: 'home.pillarDurabilityText' },
]

export default function HomeManifesto() {
  const { t } = useI18n()

  return (
    <section className="home-manifesto" aria-label={t('home.manifestoAria')}>
      <div className="home-manifesto-bg" aria-hidden>
        <img src="/accueil/hero-frame.jpg" alt="" />
      </div>
      <div className="home-manifesto-inner">
        <p className="section-kicker home-manifesto-kicker">{t('home.kicker')}</p>
        <h1 className="home-manifesto-title">
          {t('home.titleLead')}
          <span className="home-manifesto-and"> {t('home.titleAnd')} </span>
          {t('home.titleTail')}
        </h1>

        <ul className="home-pillars">
          {PILLARS.map((p) => (
            <li key={p.id}>
              <article className="home-pillar pillar-hover">
                <span className="home-pillar-n" aria-hidden>
                  {p.n}
                </span>
                <h2 className="home-pillar-title">{t(p.titleKey)}</h2>
                <p className="home-pillar-text">{t(p.textKey)}</p>
              </article>
            </li>
          ))}
        </ul>

        <p className="home-manifesto-scroll" aria-hidden>
          {t('home.scroll')}
          <span className="home-manifesto-chev">↓</span>
        </p>
      </div>
    </section>
  )
}
