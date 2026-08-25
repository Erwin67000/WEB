import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useI18n } from '@texte/I18nProvider.jsx'
import CgvAccept from '../components/CgvAccept.jsx'
import PayButton from '../components/PayButton.jsx'
import {
  readCheckoutDraft,
  persistDraft,
  fetchDraft,
  readDraftId,
} from '../lib/checkoutDraft.js'
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

const emptyAddress = {
  firstName: '',
  lastName: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  city: '',
  country: 'FR',
}

export default function CommandePage() {
  const { t, lang } = useI18n()
  const [params, setParams] = useSearchParams()
  const [draft, setDraft] = useState(() => readCheckoutDraft())
  const [user, setUser] = useState(null)
  const [providers, setProviders] = useState({
    google: false,
    apple: false,
    magic: true,
  })
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [address, setAddress] = useState(emptyAddress)
  const [cgv, setCgv] = useState(false)
  const [newsletter, setNewsletter] = useState(false)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [magicSent, setMagicSent] = useState(false)
  const [devLink, setDevLink] = useState('')

  const authFlag = params.get('auth')
  const magicToken = params.get('magic')
  const draftParam = params.get('draft')
  const needCgvGate = Boolean(user && !user.cgvAcceptedAt)
  const readyForAddress = Boolean(user?.cgvAcceptedAt)

  function fillAddress(src = {}) {
    setAddress((a) => ({
      ...a,
      firstName: src.firstName || a.firstName,
      lastName: src.lastName || a.lastName,
      phone: src.phone || a.phone,
      addressLine1: src.addressLine1 || a.addressLine1,
      addressLine2: src.addressLine2 || a.addressLine2,
      postalCode: src.postalCode || a.postalCode,
      city: src.city || a.city,
      country: src.country || a.country || 'FR',
    }))
  }

  async function refresh() {
    const s = await fetchSession()
    setUser(s.user)
    setProviders(s.providers)
    if (s.user?.email) setEmail(s.user.email)
    if (s.user?.name) setName(s.user.name)
    if (s.user?.address) fillAddress(s.user.address)
    if (s.user?.name && !s.user.address) {
      const parts = String(s.user.name).split(' ')
      setAddress((a) => ({
        ...a,
        firstName: a.firstName || parts[0] || '',
        lastName: a.lastName || parts.slice(1).join(' '),
      }))
    }
    return s.user
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (draftParam) {
          const remote = await fetchDraft(draftParam)
          if (remote && !cancelled) setDraft(remote)
        } else {
          const remote = await fetchDraft()
          if (remote && !cancelled) setDraft(remote)
        }
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
        if (!cancelled) {
          setMsg(
            e.code === 'Lien expiré' ? t('account.linkExpired') : t('account.linkBad'),
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [magicToken, draftParam])

  async function saveCurrentDraft() {
    if (!draft) return readDraftId()
    return persistDraft(draft)
  }

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
      await saveCurrentDraft()
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
      await saveCurrentDraft()
      const data = await postAuth('/api/auth/guest', {
        email,
        name: name || `${address.firstName} ${address.lastName}`.trim(),
        firstName: address.firstName,
        lastName: address.lastName,
        cgv: true,
        newsletter,
      })
      setUser(data.user)
    } catch (e) {
      setMsg(e.code === 'CGV_REQUIRED' ? t('checkout.needCgv') : e.message)
    } finally {
      setBusy(false)
    }
  }

  async function acceptCgvThenContinue() {
    if (!cgv) {
      setMsg(t('checkout.needCgv'))
      return
    }
    setBusy(true)
    try {
      const data = await postAuth('/api/auth/cgv', { cgv: true, newsletter })
      setUser(data.user)
    } catch (e) {
      setMsg(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function payNow() {
    if (!draft) {
      setMsg(t('checkout.missingDraft'))
      return
    }
    if (!STRIPE_ENABLED) {
      setMsg(t('checkout.stripeSoon'))
      return
    }
    setBusy(true)
    setMsg(t('article.preparingPay'))
    try {
      const fullName =
        `${address.firstName} ${address.lastName}`.trim() || name || user?.name
      await postAuth('/api/account/address', address).catch(() => {})
      const nextDraft = {
        ...draft,
        contact: {
          ...address,
          name: fullName,
          email: user?.email || email,
        },
        config: {
          ...(draft.config || {}),
          contact: {
            ...address,
            email: user?.email || email,
            name: fullName,
          },
          deliveryCountry: address.country,
          ecoParticipation: address.country === 'FR',
        },
      }
      await persistDraft(nextDraft)
      const result = await createCheckoutSession({
        ...nextDraft,
        lang,
        contact: {
          ...address,
          name: fullName,
          email: user?.email || email,
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

  async function startGoogle(e) {
    e.preventDefault()
    const id = await saveCurrentDraft()
    window.location.href = `/api/auth/google${id ? `?draft=${encodeURIComponent(id)}` : ''}`
  }

  const ttc = draft?.pricing?.ttc || 0
  const setAddr = (key) => (e) =>
    setAddress((a) => ({ ...a, [key]: e.target.value }))

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
              <p className="lead">
                {t('account.hello', { name: user.name || user.email })}
              </p>
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
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !cgv}
                onClick={acceptCgvThenContinue}
              >
                {t('account.continuePay')}
              </button>
            </div>
          )}

          {!loading && readyForAddress && (
            <form
              className="commande-card"
              autoComplete="on"
              onSubmit={(e) => {
                e.preventDefault()
                payNow()
              }}
            >
              <p className="lead">
                {t('account.hello', { name: user.name || user.email })}
              </p>
              <p className="hint">
                {user.isGuest ? t('account.guestHint') : t('account.loggedHint')}
              </p>

              <label className="field">
                <span className="field-label">{t('client.firstName')}</span>
                <input
                  name="given-name"
                  autoComplete="given-name"
                  value={address.firstName}
                  onChange={setAddr('firstName')}
                />
              </label>
              <label className="field">
                <span className="field-label">{t('client.lastName')}</span>
                <input
                  name="family-name"
                  autoComplete="family-name"
                  value={address.lastName}
                  onChange={setAddr('lastName')}
                />
              </label>
              <label className="field">
                <span className="field-label">{t('client.phone')}</span>
                <input
                  type="tel"
                  name="tel"
                  autoComplete="tel"
                  value={address.phone}
                  onChange={setAddr('phone')}
                />
              </label>
              <label className="field">
                <span className="field-label">{t('client.addressLine1')}</span>
                <input
                  name="street-address"
                  autoComplete="street-address"
                  value={address.addressLine1}
                  onChange={setAddr('addressLine1')}
                />
              </label>
              <label className="field">
                <span className="field-label">{t('client.postalCode')}</span>
                <input
                  name="postal-code"
                  autoComplete="postal-code"
                  value={address.postalCode}
                  onChange={setAddr('postalCode')}
                />
              </label>
              <label className="field">
                <span className="field-label">{t('client.city')}</span>
                <input
                  name="address-level2"
                  autoComplete="address-level2"
                  value={address.city}
                  onChange={setAddr('city')}
                />
              </label>
              <label className="field">
                <span className="field-label">{t('client.country')}</span>
                <select
                  name="country"
                  autoComplete="country"
                  value={address.country}
                  onChange={setAddr('country')}
                >
                  <option value="FR">{t('checkout.countryFR')}</option>
                  <option value="BE">Belgique</option>
                  <option value="CH">Suisse</option>
                  <option value="DE">Deutschland</option>
                  <option value="LU">Luxembourg</option>
                  <option value="IT">Italia</option>
                  <option value="ES">España</option>
                  <option value="GB">United Kingdom</option>
                </select>
              </label>

              <PayButton disabled={busy || !STRIPE_ENABLED} type="submit">
                {busy
                  ? t('article.redirecting')
                  : t('account.pay', { price: Math.round(ttc) })}
              </PayButton>
              <p className="hint">
                <Link to="/compte">{t('account.myAccount')}</Link>
                {' · '}
                <Link to="/configurateur">{t('account.resumeConfig')}</Link>
              </p>
            </form>
          )}

          {!loading && !user && (
            <div className="commande-card">
              <div className="auth-social">
                <a
                  className="btn btn-ghost auth-social-btn"
                  href="/api/auth/google"
                  onClick={startGoogle}
                >
                  {t('account.google')}
                </a>
                {providers.apple && (
                  <a className="btn btn-ghost auth-social-btn" href="/api/auth/apple">
                    {t('account.apple')}
                  </a>
                )}
              </div>
              {!providers.google && (
                <p className="hint">{t('account.googleHint')}</p>
              )}

              <label className="field">
                <span className="field-label">{t('client.email')}</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">{t('account.nameOptional')}</span>
                <input
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
              {' · '}
              <Link to="/configurateur">{t('nav.configurator')}</Link>
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}
