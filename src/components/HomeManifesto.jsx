import { useI18n } from '@texte/I18nProvider.jsx'

export default function HomeManifesto() {
  const { t } = useI18n()

  return (
    <section className="home-manifesto" aria-label={t('home.manifestoAria')}>
      <div className="home-manifesto-bg" aria-hidden>
        <img src="/accueil/manifesto.png" alt="" />
      </div>
      <div className="home-manifesto-inner">
        <h1 className="home-manifesto-title">
          <span className="home-manifesto-line">{t('home.titleLead')}</span>
          <span className="home-manifesto-and">{t('home.titleAnd')}</span>
          <span className="home-manifesto-line">{t('home.titleTail')}</span>
        </h1>
      </div>
      <p className="home-manifesto-scroll" aria-hidden>
        {t('home.scroll')}
        <span className="home-manifesto-chev">↓</span>
      </p>
    </section>
  )
}
