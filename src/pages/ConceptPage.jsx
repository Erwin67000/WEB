/**
 * Page Le concept — contenu inspiré de l’ancien accueil
 * (sans CTAs boutique / configurateur, sans prose Platon).
 */
import { useI18n } from '@texte/I18nProvider.jsx'

const STRENGTH_KEYS = [
  { n: '01', title: 'concept.s1t', text: 'concept.s1' },
  { n: '02', title: 'concept.s2t', text: 'concept.s2' },
  { n: '03', title: 'concept.s3t', text: 'concept.s3' },
  { n: '04', title: 'concept.s4t', text: 'concept.s4' },
  { n: '05', title: 'concept.s5t', text: 'concept.s5' },
  { n: '06', title: 'concept.s6t', text: 'concept.s6' },
]

export default function ConceptPage() {
  const { t } = useI18n()

  return (
    <div className="page page-concept page-site">
      <section className="hero hero-home concept-hero">
        <p className="section-kicker">{t('concept.kicker')}</p>
        <h1 className="hero-title">
          {t('concept.title')}
          <br />
          <span className="gold">{t('concept.titleGold')}</span>
        </h1>
        <p className="hero-lead">{t('concept.lead')}</p>
      </section>

      <div className="concept-visuals" aria-hidden>
        <figure>
          <img src="/accueil/renduv1.png" alt="" style={{ objectPosition: '70% 40%' }} />
        </figure>
        <figure>
          <img src="/accueil/renduv1.png" alt="" style={{ objectPosition: '55% 70%' }} />
        </figure>
        <figure>
          <img src="/accueil/renduv1.png" alt="" style={{ objectPosition: '30% 50%' }} />
        </figure>
      </div>

      <section className="home-section">
        <div className="home-section-inner">
          <p className="section-kicker">{t('concept.pathsKicker')}</p>
          <h2 className="section-title-lg">
            {t('concept.pathsTitle')} <span className="gold">{t('concept.pathsGold')}</span>
          </h2>
          <div className="path-steps path-steps-2">
            <article className="path-step">
              <h3>{t('concept.shopTitle')}</h3>
              <p>{t('concept.shopText')}</p>
            </article>
            <article className="path-step">
              <h3>{t('concept.configTitle')}</h3>
              <p>{t('concept.configText')}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="home-strengths">
        <div className="home-section-inner">
          <p className="section-kicker">{t('concept.strengthsKicker')}</p>
          <h2 className="section-title-lg">
            {t('concept.strengthsTitle')}{' '}
            <span className="gold">{t('concept.strengthsGold')}</span>
          </h2>
        </div>
        <ol className="strength-list">
          {STRENGTH_KEYS.map((item) => (
            <li key={item.n} className="strength-item">
              <span className="strength-n">{item.n}</span>
              <div>
                <h3>{t(item.title)}</h3>
                <p>{t(item.text)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-quote">
        <blockquote>
          {t('concept.quote')}
          <cite>{t('concept.cite')}</cite>
        </blockquote>
      </section>
    </div>
  )
}
