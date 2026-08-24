import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useConfigStore } from '../store/useConfigStore.js'
import { CLIENT_FIELDS } from '../3_INPUT/matrice_client.js'
import { useI18n } from '@texte/I18nProvider.jsx'

export default function ContactPage() {
  const { t } = useI18n()
  const contact = useConfigStore((s) => s.contact)
  const setContact = useConfigStore((s) => s.setContact)
  const notes = useConfigStore((s) => s.notes)
  const setNotes = useConfigStore((s) => s.setNotes)
  const quoteRef = useConfigStore((s) => s.quoteRef)
  const requestDevis = useConfigStore((s) => s.requestDevis)
  const [sent, setSent] = useState(false)

  const onSubmit = (e) => {
    e.preventDefault()
    requestDevis()
    setSent(true)
  }

  return (
    <div className="page page-contact page-site">
      <header className="page-head">
        <p className="section-kicker">{t('contact.kicker')}</p>
        <h1 className="hero-title">{t('contact.title')}</h1>
        <p className="hero-lead">{t('contact.lead')}</p>
      </header>

      <div className="contact-grid-site">
        <form className="contact-form-site" onSubmit={onSubmit}>
          {CLIENT_FIELDS.map((f) => (
            <label key={f.key} className="field">
              <span className="field-label">{t(`client.${f.key}`)}</span>
              <input
                type={f.type}
                required={['firstName', 'lastName', 'email'].includes(f.key)}
                value={contact[f.key] || ''}
                onChange={(e) => setContact({ [f.key]: e.target.value })}
              />
            </label>
          ))}
          <label className="field">
            <span className="field-label">{t('contact.message')}</span>
            <textarea
              rows={5}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('contact.placeholder')}
            />
          </label>
          <button type="submit" className="btn btn-primary">
            {t('contact.send')}
          </button>
          {sent && (
            <p className="form-success">
              {t('contact.sentLead')}{' '}
              <a href="mailto:contact@philae.design">contact@philae.design</a>.
            </p>
          )}
        </form>

        <aside className="contact-aside-site">
          <div className="home-card">
            <h3>{t('contact.emailTitle')}</h3>
            <p>
              <a href="mailto:contact@philae.design">contact@philae.design</a>
            </p>
            <p className="hint">{t('contact.emailHint')}</p>
          </div>
          <div className="home-card">
            <h3>{t('contact.configTitle')}</h3>
            <p>{t('contact.configText')}</p>
            <p>
              <Link to="/configurateur">{t('contact.configLink')}</Link>
            </p>
          </div>
          <div className="home-card">
            <h3>{t('contact.matrixTitle')}</h3>
            <p>
              {t('contact.quoteRefLabel')} <strong>{quoteRef}</strong>
            </p>
            <p className="hint">{t('contact.matrixHint')}</p>
          </div>
        </aside>
      </div>

      <p className="price-disclaimer" style={{ marginTop: '2rem' }}>
        {t('contact.disclaimer')}
      </p>
    </div>
  )
}
