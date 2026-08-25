import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useI18n } from '@texte/I18nProvider.jsx'
import CgvAccept from '../components/CgvAccept.jsx'
import PayButton from '../components/PayButton.jsx'
import { readCheckoutDraft } from '../lib/checkoutDraft.js'
import { createCheckoutSession } from '../lib/checkout.js'
import { fetchSession, postAuth } from '../lib/authClient.js'
import { STRIPE_ENABLED } from '../lib/payments.js'

function formatEuro(n, lang) {
  return new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0)
}

export default function CommandePage() {
  const { t, lang } = useI18n()
  const [params, setParams] = useSearchParams()
  const draft = readCheckoutDraft()
  const [user, setUser] = useState(null)
  const [providers, setProviders] = useState({
    google: false,
    apple: false,
    magic: true,
    emailConfigured: false,
  })
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [cgv, setCgv] = useState(false)
  const [newsletter, setNewsletter] = useState(false)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [magicSent, setMagicSent] = useState(false)
  const [devLink, setDevLink] = useState('')

  const authFlag = params.get('auth')
  const magicToken = params.get('magic')
  const needCgvGate = Boolean(user && !user.cgvAcceptedAt)

  async function refresh() {
    const s = await fetchSession()
    setUser(s.user)
    setProviders(s.providers)
    if (s.user?.email) setEmail(s.user.email)
    if (s.user?.name) setName(s.user.name)
    return s.user
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (magicToken) {
          await postAuth('/api/auth/magic-link/verify', { token: magicToken })
          if (!cancelled) {
            setParams({}, { replace: true })
            await refresh()
          }
        } else {
          await refresh()
        }
      } catch (e) {
        if (!cancelled) setMsg(e.code === 'Lien expiré' ? t('account.linkExpired') : t('account.linkBad'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [magicToken])

  async function sendMagic() {
    if (!email.includes('@')) {
      setMsg(t('account.needEmail'))
      return
    }
    if (!cgv) {
      setMsg(t('checkout.needCgv'))
      return
    }
    setBusy(true)
    setMsg('')
    try {
      const data = await postAuth('/api/auth/magic-link', {
        email,
        name,
        cgv: true,
        newsletter,
        lang,
      })
      setMagicSent(true)
      if (data.magicUrl) setDevLink(data.magicUrl)
      setMsg(t('account.magicSent'))
    } catch (e) {
      setMsg(e.code === 'CGV_REQUIRED' ? t('checkout.needCgv') : e.message)
    } finally {
      setBusy(false)
    }
  }

  async function continueGuest() {
    if (!email.includes('@')) {
      setMsg(t('account.needEmail'))
      return
    }
    if (!cgv) {
      setMsg(t('checkout.needCgv'))
      return
    }
    setBusy(true)
    setMsg('')
    try {
      const data = await postAuth('/api/auth/guest', {
        email,
        name,
        cgv: true,
        newsletter,
      })
      setUser(data.user)
      await payWithUser(data.user)
    } catch (e) {
      setMsg(e.code === 'CGV_REQUIRED' ? t('checkout.needCgv') : e.message)
      setBusy(false)
    }
  }

  async function acceptCgvThenPay() {
    if (!cgv) {
      setMsg(t('checkout.needCgv'))
      return
    }
    setBusy(true)
    try {
      const data = await postAuth('/api/auth/cgv', { cgv: true, newsletter })
      setUser(data.user)
      await payWithUser(data.user)
    } catch (e) {
      setMsg(e.message)
      setBusy(false)
    }
  }

  async function payWithUser(u) {
    if (!draft) {
      setMsg(t('checkout.missingDraft'))
      setBusy(false)
      return
    }
    if (!STRIPE_ENABLED) {
      setMsg(t('checkout.stripeSoon'))
      setBusy(false)
      return
    }
    setBusy(true)
    setMsg(t('article.preparingPay'))
    try {
      const result = await createCheckoutSession({
        ...draft,
        lang,
        contact: {
          ...(draft.contact || {}),
          email: u?.email || email,
          name: u?.name || name,
        },
      })
      if (result.url) {
        window.location.assign(result.url)
        return
      }
      setMsg(t('article.payUnavailable'))
    } catch (e) {
      setMsg(e.message === 'STRIPE_DISABLED' ? t('checkout.stripeSoon') : e.message)
    } finally {
      setBusy(false)
    }
  }

  const ttc = draft?.pricing?.ttc || 0
  const readyToPay = user?.cgvAcceptedAt && draft

  return (
    <div className="page page-site page-commande page-pad-x">
      <p className="section-kicker">{t('checkout.payKicker')}</p>
      <h1 className="hero-title">{t('account.title')}</h1>

      <div className="commande-grid">
        <div className="commande-main">
          {loading && <p className="hint">{t('account.loading')}</p>}

          {!loading && authFlag === 'error' && (
            <p className="hint">{t('account.oauthError')}</p>
          )}

          {!loading && user && needCgvGate && (
            <div className="commande-card">
              <p className="lead">{t('account.hello', { name: user.name || user.email })}</p>
              <p className="hint">{t('account.needCgvOnce')}</p>
              <CgvAccept checked={cgv} onChange={setCgv} id="compte-cgv" />
              <label className="cgv-accept">
                <input
                  type="checkbox"
                  checked={newsletter}
                  onChange={(e) => setNewsletter(e.target.checked)}
                />
                <span>{t('account.newsletter')}</span>
              </label>
              <PayButton disabled={busy || !cgv} onClick={acceptCgvThenPay}>
                {t('account.continuePay')}
              </PayButton>
            </div>
          )}

          {!loading && readyToPay && !needCgvGate && (
            <div className="commande-card">
              <p className="lead">{t('account.hello', { name: user.name || user.email })}</p>
              <p className="hint">{user.isGuest ? t('account.guestHint') : t('account.loggedHint')}</p>
              <PayButton disabled={busy || !STRIPE_ENABLED} onClick={() => payWithUser(user)}>
                {busy
                  ? t('article.redirecting')
                  : t('account.pay', { price: Math.round(ttc) })}
              </PayButton>
              <p className="hint">
                <Link to="/compte">{t('account.myAccount')}</Link>
              </p>
            </div>
          )}

          {!loading && !user && (
            <div className="commande-card">
              <div className="auth-social">
                {providers.google && (
                  <a className="btn btn-ghost auth-social-btn" href="/api/auth/google">
                    {t('account.google')}
                  </a>
                )}
                {providers.apple && (
                  <a className="btn btn-ghost auth-social-btn" href="/api/auth/apple">
                    {t('account.apple')}
                  </a>
                )}
              </div>

              <label className="field">
                <span className="field-label">{t('client.email')}</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>
              <label className="field">
                <span className="field-label">{t('account.nameOptional')}</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </label>

              <CgvAccept checked={cgv} onChange={setCgv} id="guest-cgv" />
              <label className="cgv-accept">
                <input
                  type="checkbox"
                  checked={newsletter}
                  onChange={(e) => setNewsletter(e.target.checked)}
                />
                <span>{t('account.newsletter')}</span>
              </label>

              <div className="commande-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={sendMagic}
                >
                  {t('account.sendLink')}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={continueGuest}
                >
                  {t('account.guest')}
                </button>
              </div>
              {magicSent && <p className="hint">{t('account.magicSent')}</p>}
              {devLink && (
                <p className="hint">
                  <a href={devLink}>{t('account.devLink')}</a>
                </p>
              )}
            </div>
          )}

          {msg && <p className="hint">{msg}</p>}
        </div>

        <aside className="commande-recap">
          <h2>{t('checkout.recap')}</h2>
          {draft ? (
            <>
              <p className="commande-recap-name">{draft.productLabel}</p>
              <p className="commande-recap-price">{formatEuro(ttc, lang)}</p>
              <p className="hint">{t('article.leadTime')}</p>
            </>
          ) : (
            <p className="hint">
              {t('checkout.missingDraft')}{' '}
              <Link to="/boutique">{t('checkout.shop')}</Link>
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}
