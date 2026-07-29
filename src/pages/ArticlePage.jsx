/**
 * Page produit boutique — fiche auto depuis la ligne matrice_catalogue.
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
import { formatTag, getCatalogItem } from '../data/catalog.js'
import FurniturePreview3D from '../components/FurniturePreview3D.jsx'
import { createCheckoutSession } from '../lib/checkout.js'

const PRICE_DISCLAIMER =
  'Prix TTC indicatif catalogue. Personnalisation via Configurer (session isolée). Fabrication sur commande.'

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

const MODULE_LABELS = {
  shelf: MODULE_KINDS.shelf?.label || 'Tablette',
  drawer: MODULE_KINDS.drawer?.label || 'Tiroir',
  door: 'Porte (module)',
}

/**
 * Agrège les modules par kind → « 2 tablettes, 1 tiroir ».
 */
function summarizeModules(modules = []) {
  if (!modules.length) return null
  const counts = new Map()
  for (const m of modules) {
    const k = m.kind || 'autre'
    counts.set(k, (counts.get(k) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([kind, n]) => {
      const label = MODULE_LABELS[kind] || kind
      return n > 1 ? `${n} ${label.toLowerCase()}s` : `1 ${label.toLowerCase()}`
    })
    .join(', ')
}

/**
 * Construit la fiche technique complète depuis une ligne catalogue.
 * Chaque champ présent dans la matrice apparaît automatiquement.
 */
function buildProductSpecs(row) {
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
    { label: 'Référence', value: row.sku || row.id, mono: true },
    { label: 'Identifiant', value: row.id, mono: true },
    { label: 'Catégorie', value: row.category || null },
    {
      label: 'Tags',
      value:
        row.tags?.length > 0
          ? row.tags.map(formatTag).join('  ')
          : null,
    },
  ].filter((r) => r.value)

  const dimensions = [
    {
      label: 'Longueur (L)',
      value: L > 0 ? formatMm(L) : null,
    },
    {
      label: 'Profondeur (W)',
      value: W > 0 ? formatMm(W) : null,
    },
    {
      label: 'Hauteur (H)',
      value: H > 0 ? formatMm(H) : null,
    },
    {
      label: 'Encombrement',
      value:
        L > 0 && W > 0 && H > 0
          ? `${Math.round(L)} × ${Math.round(W)} × ${Math.round(H)} mm`
          : null,
    },
    {
      label: 'Volume enveloppe',
      value:
        volumeM3 > 0
          ? `${volumeM3.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} m³`
          : null,
    },
  ].filter((r) => r.value)

  const finition = [
    {
      label: 'Finition ossature',
      value: fin?.label || finishId || null,
      swatch: fin?.previewColor || null,
    },
    {
      label: 'Essence (atelier)',
      value: wood?.label || woodId || null,
      swatch: wood?.color || null,
      hint: 'Bois local atelier — non choisi par le client',
    },
    {
      label: 'Texture matrice',
      value: row.texture && row.texture !== finishId ? row.texture : null,
    },
  ].filter((r) => r.value)

  const composition = [
    {
      label: 'Panneaux',
      value:
        panneaux.length > 0
          ? panneaux.map(panneauLabel).join(' · ')
          : 'Aucun (ossature seule)',
      list: panneaux.length
        ? panneaux.map((p) => panneauLabel(p))
        : null,
    },
    {
      label: 'Épaisseur panneau',
      value: panneaux.length ? `${EPAISSEUR_PANNEAU} mm` : null,
    },
    {
      label: 'Modules',
      value: summarizeModules(modules) || 'Aucun',
      list:
        modules.length > 0
          ? modules.map((m) => {
              const lab = MODULE_LABELS[m.kind] || m.kind
              const bay =
                m.bayIndex != null ? ` · baie ${Number(m.bayIndex) + 1}` : ''
              return `${lab}${bay}`
            })
          : null,
    },
    {
      label: 'Spec modules (CSV)',
      value: row.modules_spec || null,
      mono: true,
      secondary: true,
    },
    {
      label: 'Spec panneaux (CSV)',
      value: row.panneaux_spec || null,
      mono: true,
      secondary: true,
    },
  ].filter((r) => r.value)

  const pricingRows = [
    {
      label: 'Prix TTC',
      value: ttc > 0 ? formatEuro(ttc) : 'Sur devis',
      emphasize: true,
    },
    {
      label: 'dont HT',
      value: ttc > 0 ? formatEuro2(pricing.ht) : null,
    },
    {
      label: 'dont TVA 20 %',
      value: ttc > 0 ? formatEuro2(pricing.tva) : null,
    },
    {
      label: 'Modèle 3D (HT)',
      value:
        row.price_model3d_ht_eur > 0
          ? formatEuro2(row.price_model3d_ht_eur)
          : null,
      secondary: true,
    },
    {
      label: 'Export JSON (HT)',
      value:
        row.price_json_ht_eur > 0
          ? formatEuro2(row.price_json_ht_eur)
          : null,
      secondary: true,
    },
  ].filter((r) => r.value)

  const meta = [
    {
      label: 'Scène 3D',
      value: sceneLabel,
    },
    {
      label: 'Mise en avant',
      value: row.featured ? 'Oui' : null,
    },
    {
      label: 'Docs atelier',
      value: row.docs_ready ? 'Prêtes' : null,
    },
    {
      label: 'Ordre catalogue',
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
      { id: 'identity', title: 'Référence', rows: identity },
      { id: 'dimensions', title: 'Dimensions', rows: dimensions },
      { id: 'finition', title: 'Finition', rows: finition },
      { id: 'composition', title: 'Composition', rows: composition },
      { id: 'pricing', title: 'Tarif', rows: pricingRows },
      ...(meta.length
        ? [{ id: 'meta', title: 'Informations', rows: meta }]
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
  const [row, setRow] = useState(null)
  const [error, setError] = useState(null)
  const [buyBusy, setBuyBusy] = useState(false)
  const [buyMsg, setBuyMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    getCatalogItem(productId)
      .then((found) => {
        if (cancelled) return
        if (!found) setError('Configuration introuvable dans matrice_catalogue.')
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

  const specs = useMemo(() => (row ? buildProductSpecs(row) : null), [row])

  if (error) {
    return (
      <div className="page page-site page-full page-pad-x">
        <p className="action-msg">{error}</p>
        <Link to="/boutique" className="btn btn-wood">
          ← Boutique
        </Link>
      </div>
    )
  }

  if (!row || !specs) {
    return (
      <div className="page page-site page-full page-pad-x">
        <p className="hint">Chargement de la matrice…</p>
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
    setBuyMsg('Préparation du paiement sécurisé…')
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
      setBuyMsg('Paiement indisponible — contact@philae.design')
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
            ← Boutique
          </button>

          {row.category && (
            <p className="section-kicker">{row.category}</p>
          )}
          <h1 className="hero-title">{row.name}</h1>
          {row.short_description && (
            <p className="hero-lead">{row.short_description}</p>
          )}

          {/* Encart dimensions + finition (toujours visible en tête) */}
          <div className="article-highlights">
            {specs.L > 0 && (
              <div className="article-highlight">
                <span className="article-highlight-k">Dimensions</span>
                <strong>
                  {Math.round(specs.L)}×{Math.round(specs.W)}×
                  {Math.round(specs.H)}
                  <span className="article-highlight-unit"> mm</span>
                </strong>
              </div>
            )}
            {specs.fin && (
              <div className="article-highlight">
                <span className="article-highlight-k">Finition</span>
                <strong className="article-highlight-finish">
                  {specs.fin.previewColor && (
                    <span
                      className="spec-swatch"
                      style={{ background: specs.fin.previewColor }}
                      aria-hidden
                    />
                  )}
                  {specs.fin.label}
                </strong>
              </div>
            )}
            {ttc > 0 && (
              <div className="article-highlight">
                <span className="article-highlight-k">Prix</span>
                <strong className="product-price">{formatEuro(ttc)} TTC</strong>
              </div>
            )}
          </div>

          <p className="hint article-view-hint">
            Visualisation figée (ligne matrice) — orbit et zoom uniquement.
            Contours panneaux plus fins que les arêtes ossature.
          </p>

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

          <p className="price-disclaimer">{PRICE_DISCLAIMER}</p>

          <div className="article-actions hero-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate(`/boutique/${row.id}/configurer`)}
            >
              Configurer cette base
            </button>
            <button
              type="button"
              className="btn btn-wood"
              disabled={buyBusy}
              onClick={handleBuyNow}
            >
              {buyBusy
                ? 'Redirection…'
                : ttc >= 0.5
                  ? `Acheter · ${Math.round(ttc)} € TTC`
                  : 'Demander un devis'}
            </button>
          </div>
          {buyMsg && <p className="hint article-order-hint">{buyMsg}</p>}
          <p className="hint article-order-hint">
            Paiement sécurisé Stripe · Fabrication sur commande
          </p>
        </div>
      </div>
    </div>
  )
}
