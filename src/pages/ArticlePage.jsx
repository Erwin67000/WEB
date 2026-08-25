/**
 * Page produit boutique — fiche auto depuis la ligne modele_boutique.
 * Toutes les infos (dims, finition, modules, panneaux, prix…) sont dérivées
 * du CSV, sans saisie manuelle par fiche.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  FINITIONS,
  FINITIONS_OSSATURE,
  BOIS_ATELIER_ID,
  resolveOssatureFinish,
  panneauLabel,
  TVA,
  EPAISSEUR_PANNEAU,
} from '../1_STRUCTURE/00_matrice/matrice_constante.js'
import { MODULE_KINDS } from '../1_STRUCTURE/00_matrice/matrice_configuration.js'
import { getCatalogItem } from '../data/catalog.js'
import FurniturePreview3D from '../components/FurniturePreview3D.jsx'
import { useI18n, useTId, useCatalogText } from '@texte/I18nProvider.jsx'
import CgvAccept from '../components/CgvAccept.jsx'
import PayButton from '../components/PayButton.jsx'
import { createCheckoutSession } from '../lib/checkout.js'
import { STRIPE_ENABLED, isFranceCountry } from '../lib/payments.js'

/** Prix TTC catalogue → ventilation HT / TVA 20 %. */
function pricingFromTtc(ttc) {
  const t = Number(ttc) || 0
  const ht = t / (1 + TVA)
  return { ht, tva: t - ht, ttc: t }
}

function localeOf(lang) {
  return lang === 'en' ? 'en-GB' : 'fr-FR'
}

function formatMm(n, lang = 'fr') {
  const v = Math.round(Number(n) || 0)
  return `${v.toLocaleString(localeOf(lang))} mm`
}

function formatEuro(n, lang = 'fr') {
  if (!Number.isFinite(n) || n <= 0) return '—'
  return new Intl.NumberFormat(localeOf(lang), {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

function formatEuro2(n, lang = 'fr') {
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat(localeOf(lang), {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function tagKey(tag) {
  return String(tag || '')
    .replace(/^#/, '')
    .toLowerCase()
}

function formatTagLabel(tId, tag) {
  const raw = tagKey(tag)
  return `#${tId('catalog.tag', raw, raw)}`
}

/**
 * Agrège les modules par kind → « 2 shelves, 1 drawer ».
 */
function summarizeModules(modules = [], t) {
  if (!modules.length) return null
  const counts = new Map()
  for (const m of modules) {
    const k = m.kind || 'autre'
    counts.set(k, (counts.get(k) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([kind, n]) => {
      if (kind === 'shelf' || kind === 'drawer' || kind === 'door') {
        return n > 1
          ? t(`moduleCount.${kind}`, { n })
          : t(`moduleCount.${kind}One`)
      }
      return n > 1 ? `${n} ${kind}` : `1 ${kind}`
    })
    .join(', ')
}

/**
 * Construit la fiche technique complète depuis une ligne catalogue.
 * Chaque champ présent dans la matrice apparaît automatiquement.
 */
function buildProductSpecs(row, t, tId, catalog, lang = 'fr') {
  const L = row.L_mm || row.dims?.L || 0
  const W = row.W_mm || row.dims?.W || 0
  const H = row.H_mm || row.dims?.H || 0

  const finishId = resolveOssatureFinish(
    row.ossature_finish || row.texture || row.wood_finish,
  )
  const fin = FINITIONS_OSSATURE[finishId]
  const woodId = (row.wood_finish || BOIS_ATELIER_ID).toLowerCase()
  const wood = FINITIONS[woodId] || FINITIONS[BOIS_ATELIER_ID]

  const modules = row.modules || []
  const panneaux = row.panneaux || []
  const ttc = Number(
    row.price_furniture_ttc_eur || row.price_ttc_eur || row.price_from,
  ) || 0
  const pricing = pricingFromTtc(ttc)

  /** Sections affichées (label + valeur) — seules les lignes non vides */
  const identity = [
    { label: t('article.spec.reference'), value: row.sku || null, mono: true },
    {
      label: t('article.spec.category'),
      value: row.category
        ? catalog.category(row)
        : null,
    },
  ].filter((r) => r.value)

  const dimensions = [
    {
      label: t('article.spec.length'),
      value: L > 0 ? formatMm(L, lang) : null,
    },
    {
      label: t('article.spec.depth'),
      value: W > 0 ? formatMm(W, lang) : null,
    },
    {
      label: t('article.spec.height'),
      value: H > 0 ? formatMm(H, lang) : null,
    },
  ].filter((r) => r.value)

  const finition = [
    {
      label: t('article.spec.frameFinish'),
      value: tId('finish', finishId, fin?.label || finishId || null),
      swatch: fin?.previewColor || null,
    },
    {
      label: t('article.spec.wood'),
      value: tId('wood', woodId, wood?.label || woodId || null),
      swatch: wood?.color || null,
    },
  ].filter((r) => r.value)

  const composition = [
    {
      label: t('article.spec.panels'),
      value:
        panneaux.length > 0
          ? panneaux.map((p) => tId('panel', p, panneauLabel(p))).join(' · ')
          : t('article.spec.noPanels'),
      list: panneaux.length
        ? panneaux.map((p) => tId('panel', p, panneauLabel(p)))
        : null,
    },
    {
      label: t('article.spec.panelThickness'),
      value: panneaux.length ? `${EPAISSEUR_PANNEAU} mm` : null,
    },
    {
      label: t('article.spec.modules'),
      value: summarizeModules(modules, t) || t('article.spec.none'),
    },
    {
      label: t('article.spec.drawerHeight'),
      value: (() => {
        const h = modules.find((m) => m.kind === 'drawer' && m.hMm)?.hMm
        return h ? formatMm(h, lang) : null
      })(),
    },
  ].filter((r) => r.value)

  const pricingRows = [
    {
      label: t('article.spec.priceTtc'),
      value: ttc > 0 ? formatEuro(ttc, lang) : t('article.spec.onQuote'),
      emphasize: true,
    },
    {
      label: t('article.spec.ofHt'),
      value: ttc > 0 ? formatEuro2(pricing.ht, lang) : null,
    },
    {
      label: t('article.spec.ofVat'),
      value: ttc > 0 ? formatEuro2(pricing.tva, lang) : null,
    },
  ].filter((r) => r.value)

  const meta = []

  return {
    L,
    W,
    H,
    finishId,
    fin,
    wood,
    modules,
    panneaux,
    ttc,
    pricing,
    sections: [
      { id: 'identity', title: t('article.section.identity'), rows: identity },
      { id: 'dimensions', title: t('article.section.dimensions'), rows: dimensions },
      { id: 'finition', title: t('article.section.finish'), rows: finition },
      { id: 'composition', title: t('article.section.composition'), rows: composition },
      { id: 'pricing', title: t('article.section.pricing'), rows: pricingRows },
      ...(meta.length
        ? [{ id: 'meta', title: t('article.section.meta'), rows: meta }]
        : []),
    ],
  }
}

function SpecRow({ row }) {
  return (
    <div
      className={`spec-row${row.secondary ? ' is-secondary' : ''}${
        row.emphasize ? ' is-emphasize' : ''
      }`}
    >
      <dt>{row.label}</dt>
      <dd>
        <span className="spec-value-main">
          {row.swatch && (
            <span
              className="spec-swatch"
              style={{ background: row.swatch }}
              title={row.value}
              aria-hidden
            />
          )}
          <span className={row.mono ? 'mono' : undefined}>{row.value}</span>
        </span>
        {row.hint && <span className="spec-hint">{row.hint}</span>}
        {row.list?.length > 0 && (
          <ul className="spec-chips">
            {row.list.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </dd>
    </div>
  )
}

export default function ArticlePage() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const tId = useTId()
  const catalog = useCatalogText()
  const [row, setRow] = useState(null)
  const [error, setError] = useState(null)
  const [acceptCgv, setAcceptCgv] = useState(false)
  const [buyBusy, setBuyBusy] = useState(false)
  const [buyMsg, setBuyMsg] = useState('')
  const [contact, setContact] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    addressLine1: '',
    postalCode: '',
    city: '',
    country: 'FR',
  })

  useEffect(() => {
    let cancelled = false
    getCatalogItem(productId)
      .then((found) => {
        if (cancelled) return
        if (!found) setError('missing')
        else {
          setRow(found)
          setError(null)
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e.message || e))
      })
    return () => {
      cancelled = true
    }
  }, [productId])

  const specs = useMemo(
    () => (row ? buildProductSpecs(row, t, tId, catalog, lang) : null),
    [row, t, tId, catalog, lang],
  )

  if (error) {
    return (
      <div className="page page-site page-full page-pad-x">
        <p className="action-msg">
          {error === 'missing' ? t('article.missing') : error}
        </p>
        <Link to="/boutique" className="btn btn-wood">
          {t('article.back')}
        </Link>
      </div>
    )
  }

  if (!row || !specs) {
    return (
      <div className="page page-site page-full page-pad-x">
        <p className="hint">{t('article.loading')}</p>
      </div>
    )
  }

  const { ttc, pricing } = specs
  const france = isFranceCountry(contact.country)
  const setField = (key) => (e) =>
    setContact((c) => ({ ...c, [key]: e.target.value }))

  async function handlePay() {
    if (!acceptCgv) {
      setBuyMsg(t('checkout.needCgv'))
      return
    }
    if (!contact.email || !contact.firstName || !contact.lastName) {
      setBuyMsg(t('config.buyNeedContact'))
      return
    }
    if (!STRIPE_ENABLED) {
      setBuyMsg(t('checkout.stripeSoon'))
      return
    }
    if (ttc < 0.5) {
      navigate('/contact')
      return
    }
    setBuyBusy(true)
    setBuyMsg(t('article.preparingPay'))
    try {
      const dims = row.dims || { L: row.L_mm, W: row.W_mm, H: row.H_mm }
      const dimLabel =
        dims.L && dims.W && dims.H
          ? ` (${Math.round(dims.L)}×${Math.round(dims.W)}×${Math.round(dims.H)} mm)`
          : ''
      const result = await createCheckoutSession({
        source: 'boutique',
        quoteRef: `CAT-${row.id}`,
        productLabel: `${row.name || row.id}${dimLabel}`,
        productId: row.id,
        paymentMode: 'full',
        pricing,
        contact: {
          name: `${contact.firstName} ${contact.lastName}`.trim(),
          email: contact.email,
          phone: contact.phone,
        },
        config: {
          contact,
          deliveryCountry: contact.country,
          ecoParticipation: france,
          catalog: {
            id: row.id,
            name: row.name,
            sku: row.sku,
            dims,
            modules: row.modules,
            panneaux: row.panneaux,
            ossature_finish: row.ossature_finish || row.texture,
            wood_finish: row.wood_finish,
            category: row.category,
          },
        },
      })
      if (result.url) {
        window.location.assign(result.url)
        return
      }
      setBuyMsg(t('article.payUnavailable'))
    } catch (e) {
      if (e.message === 'STRIPE_DISABLED') setBuyMsg(t('checkout.stripeSoon'))
      else setBuyMsg(e.message || t('article.payUnavailable'))
    } finally {
      setBuyBusy(false)
    }
  }

  return (
    <div className="page page-article page-site page-full">
      <div className="article-layout">
        <div className="article-preview">
          <FurniturePreview3D
            catalogRow={row}
            height="100%"
            className="article-mini"
            hint
            eager
            freeOrbit
            dpr={[1, 1.5]}
          />
        </div>

        <div className="article-info page-pad-x">
          <button
            type="button"
            className="link-back"
            onClick={() => navigate('/boutique')}
          >
            {t('article.back')}
          </button>

          {row.category && (
            <p className="section-kicker">{catalog.category(row)}</p>
          )}
          <h1 className="hero-title">{catalog.name(row)}</h1>
          {catalog.desc(row) ? (
            <p className="hero-lead">{catalog.desc(row)}</p>
          ) : null}

          <div className="article-highlights">
            {specs.L > 0 && (
              <div className="article-highlight">
                <span className="article-highlight-k">
                  {t('article.highlights.dims')}
                </span>
                <strong>
                  {Math.round(specs.L)}×{Math.round(specs.W)}×
                  {Math.round(specs.H)}
                  <span className="article-highlight-unit"> mm</span>
                </strong>
              </div>
            )}
            {specs.fin && (
              <div className="article-highlight">
                <span className="article-highlight-k">
                  {t('article.highlights.finish')}
                </span>
                <strong className="article-highlight-finish">
                  {specs.fin.previewColor && (
                    <span
                      className="spec-swatch"
                      style={{ background: specs.fin.previewColor }}
                      aria-hidden
                    />
                  )}
                  {tId('finish', specs.finishId, specs.fin.label)}
                </strong>
              </div>
            )}
            {ttc > 0 && (
              <div className="article-highlight">
                <span className="article-highlight-k">
                  {t('article.highlights.price')}
                </span>
                <strong className="product-price">
                  {t('article.highlights.ttc', {
                    price: formatEuro(ttc, lang),
                  })}
                </strong>
              </div>
            )}
          </div>

          <p className="hint">{t('article.leadTime')}</p>
          <p className="hint">
            {france ? t('checkout.ecoYes') : t('checkout.ecoNo')}
          </p>
          <p className="hint">{t('checkout.withdrawCatalog')}</p>

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
            id={`cgv-${row.id}`}
            checked={acceptCgv}
            onChange={setAcceptCgv}
          />

          <div className="article-actions hero-actions article-actions-fold">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate(`/boutique/${row.id}/configurer`)}
            >
              {t('article.configureBase')}
            </button>
            <PayButton
              disabled={
                buyBusy ||
                !acceptCgv ||
                !STRIPE_ENABLED ||
                !contact.email ||
                !contact.firstName ||
                !contact.lastName
              }
              onClick={handlePay}
            >
              {buyBusy
                ? t('article.redirecting')
                : t('article.buy', { price: Math.round(ttc) })}
            </PayButton>
          </div>
          {!STRIPE_ENABLED && (
            <p className="hint article-order-hint">
              {t('checkout.stripeSoon')}{' '}
              <Link to="/contact">{t('checkout.contactUs')}</Link>
            </p>
          )}
          {buyMsg && <p className="hint article-order-hint">{buyMsg}</p>}

          {specs.sections.map((section) =>
            section.rows.length ? (
              <section key={section.id} className="article-spec-section">
                <h2 className="article-spec-title">{section.title}</h2>
                <dl className="spec-list">
                  {section.rows.map((r) => (
                    <SpecRow key={`${section.id}-${r.label}`} row={r} />
                  ))}
                </dl>
              </section>
            ) : null,
          )}

          <p className="price-disclaimer">{t('article.priceDisclaimer')}</p>
          <p className="hint article-order-hint">{t('article.payHint')}</p>
        </div>
      </div>
    </div>
  )
}
