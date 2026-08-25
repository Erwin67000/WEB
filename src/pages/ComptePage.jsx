import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useI18n } from '@texte/I18nProvider.jsx'
import { fetchSession, logout, postAuth } from '../lib/authClient.js'
import { fetchDraft, writeCheckoutDraft } from '../lib/checkoutDraft.js'

function formatEuro(cents, currency = 'eur') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: (currency || 'eur').toUpperCase(),
  }).format((Number(cents) || 0) / 100)
}

export default function ComptePage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [newsletter, setNewsletter] = useState(false)
  const [draft, setDraft] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const s = await fetchSession()
      if (cancelled) return
      if (!s.user) {
        navigate('/commande', { replace: true })
        return
      }
      setUser(s.user)
      setNewsletter(Boolean(s.user.newsletter))
      const res = await fetch('/api/account/orders', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!cancelled) setOrders(data.orders || [])
      const d = await fetchDraft()
      if (!cancelled) setDraft(d)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [navigate])

  if (loading || !user) {
    return (
      <div className="page page-site page-pad-x">
        <p className="hint">{t('account.loading')}</p>
      </div>
    )
  }

  return (
    <div className="page page-site page-compte page-pad-x">
      <p className="section-kicker">{t('account.myAccount')}</p>
      <h1 className="hero-title">{user.name || user.email}</h1>
      <p className="hint">{user.email}</p>
      {user.isGuest && <p className="hint">{t('account.guestHint')}</p>}

      {draft?.productLabel && (
        <p className="hint">
          {t('account.savedPiece')}: <strong>{draft.productLabel}</strong>
          {' — '}
          <Link
            to={
              draft.config?.units?.length
                ? '/configurateur?resume=1'
                : draft.productId
                  ? `/boutique/${draft.productId}`
                  : '/commande'
            }
            onClick={() => writeCheckoutDraft(draft)}
          >
            {t('account.resumeConfig')}
          </Link>
          {' · '}
          <Link to="/commande">{t('account.continuePay')}</Link>
        </p>
      )}

      <label className="cgv-accept">
        <input
          type="checkbox"
          checked={newsletter}
          onChange={async (e) => {
            const on = e.target.checked
            setNewsletter(on)
            await postAuth('/api/auth/newsletter', { newsletter: on })
          }}
        />
        <span>{t('account.newsletter')}</span>
      </label>

      <h2 className="article-spec-title">{t('account.orders')}</h2>
      {orders.length === 0 ? (
        <p className="hint">
          {t('account.noOrders')}{' '}
          <Link to="/boutique">{t('checkout.shop')}</Link>
        </p>
      ) : (
        <ul className="compte-orders">
          {orders.map((o) => (
            <li key={o.id}>
              <strong>{o.product_label || o.quote_ref}</strong>
              <span>{formatEuro(o.amount_charged_cents, o.currency)}</span>
              <span>{o.status}</span>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="btn btn-ghost"
        onClick={async () => {
          await logout()
          navigate('/', { replace: true })
        }}
      >
        {t('account.logout')}
      </button>
    </div>
  )
}
