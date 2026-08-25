/**
 * Page d’achat : récapitulatif dynamique, acceptation CGV, paiement Stripe.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  FINITIONS_OSSATURE,
  resolveOssatureFinish,
  panneauLabel,
  TVA,
  PANNEAU_COULEURS,
} from '../1_STRUCTURE/00_matrice/matrice_constante.js'
import { getCatalogItem } from '../data/catalog.js'
import { computePricing } from '../store/createConfigStore.js'
import FurniturePreview3D from '../components/FurniturePreview3D.jsx'
import CgvAccept from '../components/CgvAccept.jsx'
import PayButton from '../components/PayButton.jsx'
import { createCheckoutSession } from '../lib/checkout.js'
import { readCheckoutDraft } from '../lib/checkoutDraft.js'
import { STRIPE_ENABLED } from '../lib/payments.js'
import { useI18n, useTId, useCatalogText } from '@texte/I18nProvider.jsx'

const SHOP_COLOR_KEY = 'philae-shop-panel-color'

function readShopColor() {
  try {
    const v = localStorage.getItem(SHOP_COLOR_KEY)
    if (v && PANNEAU_COULEURS[v] && v !== 'surmesure') return v
  } catch {
    /* ignore */
  }
  return null
}

function isFrance(country) {
  const s = String(country || '')
    .trim()
    .toUpperCase()
  return s === 'FR' || s === 'FRA' || s === 'FRANCE' || s.startsWith('FR ')
}

function formatEuro(n, lang = 'fr') {
  if (!Number.isFinite(n) || n <= 0) return '—'
  return new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

function emptyContact() {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    postalCode: '',
    city: '',
    country: 'FR',
  }
}

function recapFromCatalog(row, t, tId, catalog, panelColor) {
  const L = row.L_mm || row.dims?.L || 0
  const W = row.W_mm || row.dims?.W || 0
  const H = row.H_mm || row.dims?.H || 0
  const finishId = resolveOssatureFinish(
    row.ossature_finish || row.texture || row.wood_finish,
  )
  const modules = row.modules || []
  const panneaux = row.panneaux || []
  const ttc =
    Number(row.price_furniture_ttc_eur || row.price_ttc_eur || row.price_from) ||
    0
  const ht = ttc / (1 + TVA)
  const counts = { shelf: 0, drawer: 0, door: 0 }
  for (const m of modules) {
    if (counts[m.kind] != null) counts[m.kind] += 1
  }
  const drawerH = modules.find((m) => m.kind === 'drawer' && m.hMm)?.hMm
  const colorId = panelColor || row.panneau_couleur || row.panneauCouleur
  const color = PANNEAU_COULEURS[colorId]

  const lines = [
    { k: t('article.spec.category'), v: catalog.category(row) },
    { k: t('article.spec.reference'), v: row.sku || row.id },
    {
      k: t('article.highlights.dims'),
      v: `${Math.round(L)}×${Math.round(W)}×${Math.round(H)} mm`,
    },
    {
      k: t('article.spec.frameFinish'),
      v: tId('finish', finishId, finishId),
    },
    color
      ? {
          k: t('shop.panelColor'),
          v: tId('panelColor', color.id, color.label),
        }
      : null,
    {
      k: t('article.spec.panels'),
      v: panneaux.length
        ? panneaux.map((p) => tId('panel', p, panneauLabel(p))).join(' · ')
        : t('article.spec.noPanels'),
    },
    counts.shelf
      ? {
          k: t('module.shelf'),
          v:
            counts.shelf === 1
              ? t('moduleCount.shelfOne')
              : t('moduleCount.shelf', { n: counts.shelf }),
        }
      : null,
    counts.drawer
      ? {
          k: t('module.drawer'),
          v:
            (counts.drawer === 1
              ? t('moduleCount.drawerOne')
              : t('moduleCount.drawer', { n: counts.drawer })) +
            (drawerH ? ` · H ${drawerH} mm` : ''),
        }
      : null,
  ].filter(Boolean)

  return {
    title: catalog.name(row),
    productLabel: `${row.name || row.id} (${Math.round(L)}×${Math.round(W)}×${Math.round(H)} mm)`,
    productId: row.id,
    source: 'boutique',
    catalogRow: row,
    panelColor: colorId,
    lines,
    pricing: { ht, tva: ttc - ht, ttc },
  }
}

function recapFromDraft(draft, t, tId, catalog) {
  const units = draft.units || []
  const u = units[0] || {}
  const dims = u.dims || {}
  const L = dims.L || 0
  const W = dims.W || 0
  const H = dims.H || 0
  const finishId = resolveOssatureFinish(u.ossatureFinish)
  const modules = u.modules || []
  const panneaux = u.panneaux || []
  const pricing = draft.pricing || computePricing(units)
  const counts = { shelf: 0, drawer: 0, door: 0 }
  for (const m of modules) {
    if (counts[m.kind] != null) counts[m.kind] += 1
  }
  const drawerH = modules.find((m) => m.kind === 'drawer' && m.hMm)?.hMm
  const colorId = u.panneauCouleur
  const color = PANNEAU_COULEURS[colorId]
  const name = u.label || t('checkout.customPiece')

  const lines = [
    {
      k: t('article.highlights.dims'),
      v: `${Math.round(L)}×${Math.round(W)}×${Math.round(H)} mm`,
    },
    {
      k: t('article.spec.frameFinish'),
      v: tId('finish', finishId, finishId),
    },
    color
      ? {
          k: t('shop.panelColor'),
          v: tId('panelColor', color.id, color.label),
        }
      : null,
    {
      k: t('article.spec.panels'),
      v: panneaux.length
        ? panneaux.map((p) => tId('panel', p, panneauLabel(p))).join(' · ')
        : t('article.spec.noPanels'),
    },
    counts.shelf
      ? {
          k: t('module.shelf'),
          v:
            counts.shelf === 1
              ? t('moduleCount.shelfOne')
              : t('moduleCount.shelf', { n: counts.shelf }),
        }
      : null,
    counts.drawer
      ? {
          k: t('module.drawer'),
          v:
            (counts.drawer === 1
              ? t('moduleCount.drawerOne')
              : t('moduleCount.drawer', { n: counts.drawer })) +
            (drawerH ? ` · H ${drawerH} mm` : ''),
        }
      : null,
  ].filter(Boolean)

  return {
    title: name,
    productLabel: `${name} (${Math.round(L)}×${Math.round(W)}×${Math.round(H)} mm)`,
    productId: draft.productId || u.id,
    source: 'configurator',
    catalogRow: null,
    unit: u,
    units,
    panelColor: colorId,
    lines,
    pricing: {
      ht: pricing.ht,
      tva: pricing.tva,
      ttc: pricing.ttc,
    },
    notes: draft.notes,
    contactSeed: draft.contact,
  }
}

export default function CheckoutPage() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const tId = useTId()
  const catalog = useCatalogText()
  const [row, setRow] = useState(null)
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [acceptCgv, setAcceptCgv] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [contact, setContact] = useState(emptyContact)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    if (productId) {
      getCatalogItem(productId)
        .then((found) => {
          if (cancelled) return
          if (!found) setError('missing')
          else {
            setRow(found)
            setDraft(null)
            setError(null)
          }
        })
        .catch((e) => {
          if (!cancelled) setError(String(e.message || e))
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
      return () => {
        cancelled = true
      }
    }
    const d = readCheckoutDraft()
    if (!d) {
      setError('missing')
      setLoading(false)
      return
    }
    setDraft(d)
    if (d.contact) {
      setContact((c) => ({ ...c, ...d.contact }))
    }
    setError(null)
    setLoading(false)
    return () => {
      cancelled = true
    }
  }, [productId])

  const recap = useMemo(() => {
    if (row) return recapFromCatalog(row, t, tId, catalog, readShopColor())
    if (draft) return recapFromDraft(draft, t, tId, catalog)
    return null
  }, [row, draft, t, tId, catalog])

  const france = isFrance(contact.country)
  const ttc = recap?.pricing?.ttc || 0

  const setField = (key) => (e) =>
    setContact((c) => ({ ...c, [key]: e.target.value }))

  async function handlePay() {
    if (!acceptCgv) {
      setMsg(t('checkout.needCgv'))
      return
    }
    if (!contact.email || !contact.firstName || !contact.lastName) {
      setMsg(t('config.buyNeedContact'))
      return
    }
    if (!STRIPE_ENABLED) {
      setMsg(t('checkout.stripeSoon'))
      return
    }
    if (ttc < 0.5) {
      navigate('/contact')
      return
    }
    setBusy(true)
    setMsg(t('article.preparingPay'))
    try {
      const result = await createCheckoutSession({
        source: recap.source,
        quoteRef:
          recap.source === 'boutique'
            ? `CAT-${recap.productId}`
            : `CFG-${Date.now().toString(36)}`,
        productLabel: recap.productLabel,
        productId: recap.productId,
        paymentMode: 'full',
        pricing: recap.pricing,
        contact: {
          name: `${contact.firstName} ${contact.lastName}`.trim(),
          email: contact.email,
          phone: contact.phone,
        },
        config: {
          contact,
          deliveryCountry: contact.country,
          ecoParticipation: france,
          catalog: recap.catalogRow
            ? {
                id: recap.catalogRow.id,
                name: recap.catalogRow.name,
                sku: recap.catalogRow.sku,
                dims: recap.catalogRow.dims,
                modules: recap.catalogRow.modules,
                panneaux: recap.catalogRow.panneaux,
                panneauCouleur: recap.panelColor,
              }
            : null,
          units: recap.units || null,
          notes: recap.notes || '',
        },
      })
      if (result.url) {
        window.location.assign(result.url)
        return
      }
      setMsg(t('article.payUnavailable'))
    } catch (e) {
      if (e.message === 'STRIPE_DISABLED') setMsg(t('checkout.stripeSoon'))
      else setMsg(e.message || t('article.payUnavailable'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="page page-site page-full page-pad-x">
        <p className="hint">{t('article.loading')}</p>
      </div>
    )
  }

  if (error || !recap) {
    return (
      <div className="page page-site page-full page-pad-x">
        <p className="action-msg">
          {error === 'missing' ? t('checkout.missingDraft') : error}
        </p>
        <Link to="/boutique" className="btn btn-wood">
          {t('checkout.backShop')}
        </Link>
      </div>
    )
  }

  const backTo = productId
    ? `/boutique/${productId}`
    : '/configurateur'

  return (
    <div className="page page-site page-full page-checkout-buy">
      <div className="checkout-buy-layout">
        <div className="checkout-buy-preview">
          <FurniturePreview3D
            catalogRow={recap.catalogRow}
            unit={recap.unit}
            height="100%"
            className="article-mini"
            hint
            eager
            freeOrbit
            forceLive={Boolean(recap.panelColor && recap.catalogRow)}
            panneauCouleur={recap.panelColor || undefined}
            dpr={[1, 1.5]}
          />
        </div>

        <div className="checkout-buy-info page-pad-x">
          <Link to={backTo} className="link-back">
            {t('checkout.backToProduct')}
          </Link>
          <p className="section-kicker">{t('checkout.payKicker')}</p>
          <h1 className="hero-title">{recap.title}</h1>
          <p className="hero-lead">{t('checkout.payLead')}</p>

          <section className="article-spec-section">
            <h2 className="article-spec-title">{t('checkout.recap')}</h2>
            <dl className="spec-list">
              {recap.lines.map((line) => (
                <div className="spec-row" key={line.k}>
                  <dt>{line.k}</dt>
                  <dd>{line.v}</dd>
                </div>
              ))}
              <div className="spec-row is-emphasize">
                <dt>{t('article.spec.priceTtc')}</dt>
                <dd>{formatEuro(ttc, lang)}</dd>
              </div>
              <div className="spec-row is-secondary">
                <dt>{t('article.spec.ofHt')}</dt>
                <dd>{formatEuro(recap.pricing.ht, lang)}</dd>
              </div>
              <div className="spec-row is-secondary">
                <dt>{t('article.spec.ofVat')}</dt>
                <dd>{formatEuro(recap.pricing.tva, lang)}</dd>
              </div>
            </dl>
          </section>

          <p className="hint">{t('article.leadTime')}</p>
          <p className="hint">
            {france ? t('checkout.ecoYes') : t('checkout.ecoNo')}
          </p>
          <p className="hint">
            {recap.source === 'boutique'
              ? t('checkout.withdrawCatalog')
              : t('checkout.withdrawCustom')}
          </p>

          <section className="article-spec-section">
            <h2 className="article-spec-title">{t('checkout.contactTitle')}</h2>
            <div className="checkout-fields">
              {[
                ['firstName', 'text'],
                ['lastName', 'text'],
                ['email', 'email'],
                ['phone', 'tel'],
                ['addressLine1', 'text'],
                ['postalCode', 'text'],
                ['city', 'text'],
              ].map(([key, type]) => (
                <label key={key} className="field">
                  <span className="field-label">{t(`client.${key}`)}</span>
                  <input
                    type={type}
                    value={contact[key] || ''}
                    onChange={setField(key)}
                    required={key !== 'phone'}
                  />
                </label>
              ))}
              <label className="field">
                <span className="field-label">{t('client.country')}</span>
                <select value={contact.country} onChange={setField('country')}>
                  <option value="FR">{t('checkout.countryFR')}</option>
                  <option value="EU">{t('checkout.countryEU')}</option>
                  <option value="WORLD">{t('checkout.countryWorld')}</option>
                </select>
              </label>
            </div>
          </section>

          <CgvAccept
            id="checkout-accept-cgv"
            checked={acceptCgv}
            onChange={setAcceptCgv}
          />

          <div className="article-actions hero-actions">
            <PayButton
              disabled={
                busy ||
                !acceptCgv ||
                !STRIPE_ENABLED ||
                !contact.email ||
                !contact.firstName ||
                !contact.lastName
              }
              onClick={handlePay}
            >
              {busy
                ? t('article.redirecting')
                : t('checkout.payCta', { price: Math.round(ttc) })}
            </PayButton>
          </div>
          {!STRIPE_ENABLED && (
            <p className="hint article-order-hint">
              {t('checkout.stripeSoon')}{' '}
              <Link to="/contact">{t('checkout.contactUs')}</Link>
            </p>
          )}
          {msg && <p className="hint article-order-hint">{msg}</p>}
        </div>
      </div>
    </div>
  )
}
