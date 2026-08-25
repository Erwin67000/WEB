import { useI18n } from '@texte/I18nProvider.jsx'
import ShopHoverButton from './ShopHoverButton.jsx'

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
        <h1 className="home-manifesto-title">
          <span className="home-manifesto-line">{t('home.titleLead')}</span>
          <span className="home-manifesto-and">{t('home.titleAnd')}</span>
          <span className="home-manifesto-line">{t('home.titleTail')}</span>
        </h1>
        <p className="home-manifesto-kicker">{t('home.kicker')}</p>
        <p className="home-manifesto-sub">{t('home.subtitle')}</p>

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

        <div className="home-manifesto-ctas">
          <ShopHoverButton variant="primary" size="lg" to="/boutique">
            {t('home.ctaShop')}
          </ShopHoverButton>
          <ShopHoverButton variant="wood" size="lg" to="/configurateur">
            {t('home.ctaConfig')}
          </ShopHoverButton>
        </div>
        <p className="home-manifesto-scroll" aria-hidden>
          {t('home.scroll')}
          <span className="home-manifesto-chev">↓</span>
        </p>
      </div>
    </section>
  )
}
