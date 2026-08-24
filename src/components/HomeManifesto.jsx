import { Link } from 'react-router-dom'
import { useI18n } from '@texte/I18nProvider.jsx'

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
        <p className="home-manifesto-sub">{t('home.subtitle')}</p>
        <div className="home-manifesto-ctas">
          <Link to="/boutique" className="btn btn-primary">
            {t('home.ctaShop')}
          </Link>
          <Link to="/configurateur" className="btn btn-wood">
            {t('home.ctaConfig')}
          </Link>
        </div>
        <p className="home-manifesto-scroll" aria-hidden>
          {t('home.scroll')}
          <span className="home-manifesto-chev">↓</span>
        </p>
      </div>
    </section>
  )
}

export function HomePillars() {
  const { t } = useI18n()
  const pillars = [
    { id: 'design', n: '01', titleKey: 'home.pillarDesign', textKey: 'home.pillarDesignText' },
    { id: 'function', n: '02', titleKey: 'home.pillarFunction', textKey: 'home.pillarFunctionText' },
    { id: 'durability', n: '03', titleKey: 'home.pillarDurability', textKey: 'home.pillarDurabilityText' },
  ]

  return (
    <section className="home-pillars-section" aria-label={t('home.pillarDesign')}>
      <ul className="home-pillars">
        {pillars.map((p) => (
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
    </section>
  )
}
