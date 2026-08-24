import { Link } from 'react-router-dom'
import { useI18n } from '@texte/I18nProvider.jsx'

const year = new Date().getFullYear()

export default function SiteFooter() {
  const { t } = useI18n()

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-brand">
          <img src="/logo-philae.jpg" alt="" className="footer-logo" />
          <div>
            <p className="footer-name">Philae</p>
            <p className="footer-tag">{t('footer.tag')}</p>
          </div>
        </div>

        <div className="footer-cols">
          <div className="footer-col">
            <h4>{t('footer.nav')}</h4>
            <Link to="/">{t('nav.home')}</Link>
            <Link to="/boutique">{t('nav.shop')}</Link>
            <Link to="/configurateur">{t('nav.configurator')}</Link>
            <Link to="/concept">{t('nav.concept')}</Link>
            <Link to="/contact">{t('nav.contact')}</Link>
          </div>

          <div className="footer-col">
            <h4>{t('footer.workshop')}</h4>
            <a href="mailto:contact@philae.design">contact@philae.design</a>
            <p>{t('footer.madeIn')}</p>
            <a
              href="https://www.philae.design/"
              target="_blank"
              rel="noreferrer"
            >
              philae.design
            </a>
          </div>

          <div className="footer-col">
            <h4>{t('footer.info')}</h4>
            <Link to="/contact">{t('footer.legal')}</Link>
            <Link to="/contact">{t('footer.terms')}</Link>
            <Link to="/contact">{t('footer.privacy')}</Link>
            <Link to="/contact">{t('footer.shipping')}</Link>
          </div>
        </div>
      </div>

      <div className="site-footer-bottom">
        <p>{t('footer.rights', { year })}</p>
        <p className="footer-credit">{t('footer.credit')}</p>
      </div>
    </footer>
  )
}
