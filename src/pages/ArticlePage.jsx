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
import {
  MODULE_KINDS,
  ENVIRONMENTS,
} from '../1_STRUCTURE/00_matrice/matrice_configuration.js'
import { getCatalogItem } from '../data/catalog.js'
import FurniturePreview3D from '../components/FurniturePreview3D.jsx'
import { createCheckoutSession } from '../lib/checkout.js'
import { useI18n, useTId } from '@texte/I18nProvider.jsx'
import PayButton from '../components/PayButton.jsx'

/** Prix TTC catalogue → ventilation HT / TVA 20 %. */
function pricingFromTtc(ttc) {
  const t = Number(ttc) || 0
  const ht = t / (1 + TVA)
  return { ht, tva: t - ht, ttc: t }
}

function formatMm(n) {
  const v = Math.round(Number(n) || 0)
  return `${v.toLocaleString('fr-FR')} mm`
}

function formatEuro(n) {
  if (!Number.isFinite(n) || n <= 0) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

function formatEuro2(n) {
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('fr-FR', {
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
function buildProductSpecs(row, t, tId) {
  const L = row.L_mm || row.dims?.L || 0
  const W = row.W_mm || row.dims?.W || 0
  const H = row.H_mm || row.dims?.H || 0
  const volumeM3 = (L * W * H) / 1e9

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

  const sceneId = row.scene && row.scene !== 'none' ? row.scene : null
  const sceneLabel = sceneId
    ? ENVIRONMENTS[sceneId]?.label || sceneId
    : null

  /** Sections affichées (label + valeur) — seules les lignes non vides */
  const identity = [
    { label: t('article.spec.reference'), value: row.sku || row.id, mono: true },
    { label: t('article.spec.identity'), value: row.id, mono: true },
    {
      label: t('article.spec.category'),
      value: row.category
        ? tId('catalog.category', row.category, row.category)
        : null,
    },
    {
      label: t('article.spec.tags'),
      value:
        row.tags?.length > 0
          ? row.tags.map((tg) => formatTagLabel(tId, tg)).join('  ')
          : null,
    },
  ].filter((r) => r.value)

  const dimensions = [
    {
      label: t('article.spec.length'),
      value: L > 0 ? formatMm(L) : null,
    },
    {
      label: t('article.spec.depth'),
      value: W > 0 ? formatMm(W) : null,
    },
    {
      label: t('article.spec.height'),
      value: H > 0 ? formatMm(H) : null,
    },
    {
      label: t('article.spec.envelope'),
      value:
        L > 0 && W > 0 && H > 0
          ? `${Math.round(L)} × ${Math.round(W)} × ${Math.round(H)} mm`
          : null,
    },
    {
      label: t('article.spec.volume'),
      value:
        volumeM3 > 0
          ? `${volumeM3.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} m³`
          : null,
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
      hint: t('article.spec.woodHint'),
    },
    {
      label: t('article.spec.texture'),
      value: row.texture && row.texture !== finishId ? row.texture : null,
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
      list:
        modules.length > 0
          ? modules.map((m) => {
              const lab = tId(
                'module',
                m.kind,
                MODULE_KINDS[m.kind]?.label || m.kind,
              )
              const bay =
                m.bayIndex != null ? ` · ${Number(m.bayIndex) + 1}` : ''
              return `${lab}${bay}`
            })
          : null,
    },
    {
      label: t('article.spec.modulesSpec'),
      value: row.modules_spec || null,
      mono: true,
      secondary: true,
    },
    {
      label: t('article.spec.panelsSpec'),
      value: row.panneaux_spec || null,
      mono: true,
      secondary: true,
    },
  ].filter((r) => r.value)

  const pricingRows = [
    {
      label: t('article.spec.priceTtc'),
      value: ttc > 0 ? formatEuro(ttc) : t('article.spec.onQuote'),
      emphasize: true,
    },
    {
      label: t('article.spec.ofHt'),
      value: ttc > 0 ? formatEuro2(pricing.ht) : null,
    },
    {
      label: t('article.spec.ofVat'),
      value: ttc > 0 ? formatEuro2(pricing.tva) : null,
    },
    {
      label: t('article.spec.model3d'),
      value:
        row.price_model3d_ht_eur > 0
          ? formatEuro2(row.price_model3d_ht_eur)
          : null,
      secondary: true,
    },
    {
      label: t('article.spec.exportJson'),
      value:
        row.price_json_ht_eur > 0
          ? formatEuro2(row.price_json_ht_eur)
          : null,
      secondary: true,
    },
  ].filter((r) => r.value)

  const meta = [
    {
      label: t('article.spec.scene'),
      value: sceneId ? tId('env', sceneId, sceneLabel) : null,
    },
    {
      label: t('article.spec.featured'),
      value: row.featured ? t('article.spec.yes') : null,
    },
    {
      label: t('article.spec.docs'),
      value: row.docs_ready ? t('article.spec.docsReady') : null,
    },
    {
      label: t('article.spec.sortOrder'),
      value:
        row.sort_order != null && row.sort_order !== 0
          ? String(row.sort_order)
          : null,
      secondary: true,
    },
  ].filter((r) => r.value)

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
  const { t } = useI18n()
  const tId = useTId()
  const [row, setRow] = useState(null)
  const [error, setError] = useState(null)
  const [buyBusy, setBuyBusy] = useState(false)
  const [buyMsg, setBuyMsg] = useState('')

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
    () => (row ? buildProductSpecs(row, t, tId) : null),
    [row, t, tId],
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

  async function handleBuyNow() {
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
        config: {
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
            tags: row.tags,
          },
        },
      })
      if (result.url) {
        window.location.assign(result.url)
        return
      }
      setBuyMsg(t('article.payUnavailable'))
    } catch (e) {
      setBuyMsg(e.message || 'Erreur paiement')
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
            <p className="section-kicker">
              {tId('catalog.category', row.category, row.category)}
            </p>
          )}
          <h1 className="hero-title">
            {tId('catalog.name', row.name, row.name)}
          </h1>
          {row.short_description && (
            <p className="hero-lead">
              {tId('catalog.desc', row.short_description, row.short_description)}
            </p>
          )}

          {/* Encart dimensions + finition (toujours visible en tête) */}
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
                  {t('article.highlights.ttc', { price: formatEuro(ttc) })}
                </strong>
              </div>
            )}
          </div>

          <p className="hint article-view-hint">{t('article.viewHint')}</p>

          {/* Fiche technique complète auto */}
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

          <div className="article-actions hero-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate(`/boutique/${row.id}/configurer`)}
            >
              {t('article.configureBase')}
            </button>
            <PayButton disabled={buyBusy} onClick={handleBuyNow}>
              {buyBusy
                ? t('article.redirecting')
                : ttc >= 0.5
                  ? t('article.buy', { price: Math.round(ttc) })
                  : t('article.requestQuote')}
            </PayButton>
          </div>
          {buyMsg && <p className="hint article-order-hint">{buyMsg}</p>}
          <p className="hint article-order-hint">{t('article.payHint')}</p>
        </div>
      </div>
    </div>
  )
}
