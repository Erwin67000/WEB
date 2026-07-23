import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useConfigStore } from '../store/useConfigStore.js'
import { CLIENT_FIELDS } from '../3_INPUT/matrice_client.js'

const PRICE_DISCLAIMER =
  'Document indicatif généré par le configurateur Philae (matrice). TVA 20 %.'

export default function ContactPage() {
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
        <p className="section-kicker">Atelier</p>
        <h1 className="hero-title">Contact</h1>
        <p className="hero-lead">
          Une question, un projet sur mesure, un devis d&apos;ensemble : le
          formulaire exporte votre demande depuis la matrice en cours
          (réf. <strong className="gold-inline">{quoteRef}</strong>).
        </p>
      </header>

      <div className="contact-grid-site">
        <form className="contact-form-site" onSubmit={onSubmit}>
          {CLIENT_FIELDS.map((f) => (
            <label key={f.key} className="field">
              <span className="field-label">{f.label}</span>
              <input
                type={f.type}
                required={['firstName', 'lastName', 'email'].includes(f.key)}
                value={contact[f.key] || ''}
                onChange={(e) => setContact({ [f.key]: e.target.value })}
              />
            </label>
          ))}
          <label className="field">
            <span className="field-label">Message</span>
            <textarea
              rows={5}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Décrivez votre projet, dimensions, finition souhaitée…"
            />
          </label>
          <button type="submit" className="btn btn-primary">
            Envoyer la demande (export JSON)
          </button>
          {sent && (
            <p className="form-success">
              Demande exportée depuis la matrice. Écrivez-nous aussi à{' '}
              <a href="mailto:contact@philae.design">contact@philae.design</a>.
            </p>
          )}
        </form>

        <aside className="contact-aside-site">
          <div className="home-card">
            <h3>Email</h3>
            <p>
              <a href="mailto:contact@philae.design">contact@philae.design</a>
            </p>
            <p className="hint">Demandes de configuration &amp; devis</p>
          </div>
          <div className="home-card">
            <h3>Configurateur</h3>
            <p>
              Composez votre meuble en ligne, exportez JSON / CSV master_input,
              ou demandez un devis.
            </p>
            <p>
              <Link to="/configurateur">Ouvrir le configurateur →</Link>
            </p>
          </div>
          <div className="home-card">
            <h3>Matrice en cours</h3>
            <p>
              Référence devis : <strong>{quoteRef}</strong>
            </p>
            <p className="hint">
              Les dimensions et modules du configurateur sont inclus dans
              l&apos;export.
            </p>
          </div>
        </aside>
      </div>

      <p className="price-disclaimer" style={{ marginTop: '2rem' }}>
        {PRICE_DISCLAIMER}
      </p>
    </div>
  )
}
