import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useConfigStore } from '../store/useConfigStore.js'
import { useI18n } from '@texte/I18nProvider.jsx'

const IDENTITY = ['firstName', 'lastName', 'email', 'phone']
const ADDRESS = [
  'addressLine1',
  'addressLine2',
  'postalCode',
  'city',
  'country',
]
const REQUIRED = ['firstName', 'lastName', 'email']

export default function ContactPage() {
  const { t } = useI18n()
  const contact = useConfigStore((s) => s.contact)
  const setContact = useConfigStore((s) => s.setContact)
  const notes = useConfigStore((s) => s.notes)
  const setNotes = useConfigStore((s) => s.setNotes)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const fieldType = (key) => {
    if (key === 'email') return 'email'
    if (key === 'phone') return 'tel'
    return 'text'
  }

  const onSubmit = (e) => {
    e.preventDefault()
    const missing = REQUIRED.some((k) => !String(contact[k] || '').trim())
    if (missing) {
      setError(t('contact.errorRequired'))
      setSent(false)
      return
    }
    setError('')
    setSent(true)
  }

  const renderField = (key) => (
    <label key={key} className="field">
      <span className="field-label">
        {t(`client.${key}`)}
        {REQUIRED.includes(key) ? ' *' : ''}
      </span>
      <input
        type={fieldType(key)}
        required={REQUIRED.includes(key)}
        value={contact[key] || ''}
        onChange={(e) => setContact({ [key]: e.target.value })}
        aria-required={REQUIRED.includes(key)}
      />
    </label>
  )

  return (
    <div className="page page-contact page-site">
      <header className="page-head">
        <p className="section-kicker">{t('contact.kicker')}</p>
        <h1 className="hero-title">{t('contact.title')}</h1>
        <p className="hero-lead">{t('contact.lead')}</p>
      </header>

      <div className="contact-grid-site">
        <form className="contact-form-site" onSubmit={onSubmit} noValidate>
          <div className="contact-form-cols">
            <div>
              <p className="field-label contact-col-head">{t('config.client')}</p>
              {IDENTITY.map(renderField)}
            </div>
            <div>
              <p className="field-label contact-col-head">{t('client.addressLine1')}</p>
              {ADDRESS.map(renderField)}
            </div>
          </div>
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
          {error && <p className="form-error">{error}</p>}
          {sent && (
            <p className="form-success">
              {t('contact.sentOk')} {t('contact.sentLead')}{' '}
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
            <h3>{t('contact.workshopTitle')}</h3>
            <p>{t('contact.workshopText')}</p>
          </div>
        </aside>
      </div>

      <p className="price-disclaimer" style={{ marginTop: '2rem' }}>
        {t('contact.disclaimer')}
      </p>
    </div>
  )
}
