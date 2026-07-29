import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  FINITIONS_OSSATURE,
  resolveOssatureFinish,
  TVA,
} from '../1_STRUCTURE/00_matrice/matrice_constante.js'
import { MODULE_KINDS } from '../1_STRUCTURE/00_matrice/matrice_configuration.js'
import { formatTag, getCatalogItem } from '../data/catalog.js'
import FurniturePreview3D from '../components/FurniturePreview3D.jsx'
import { createCheckoutSession } from '../lib/checkout.js'

const PRICE_DISCLAIMER =
  'Modèle figé de matrice_catalogue. Pour personnaliser : Configurer (session isolée).'

/** Prix TTC catalogue → ventilation HT / TVA 20 % (prix affiché TTC). */
function pricingFromTtc(ttc) {
  const t = Number(ttc) || 0
  const ht = t / (1 + TVA)
  return { ht, tva: t - ht, ttc: t }
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

  if (!row) {
    return (
      <div className="page page-site page-full page-pad-x">
        <p className="hint">Chargement de la matrice…</p>
      </div>
    )
  }

  const finishId = resolveOssatureFinish(
    row.ossature_finish || row.texture || row.wood_finish,
  )
  const fin = FINITIONS_OSSATURE[finishId]
  const moduleLabels = (row.modules || [])
    .map((m) => MODULE_KINDS[m.kind]?.label || m.kind)
    .join(', ')

  const ttc =
    Number(row.price_furniture_ttc_eur || row.price_ttc_eur || row.price_from) ||
    0

  async function handleBuyNow() {
    if (ttc < 0.5) {
      navigate('/contact')
      return
    }
    setBuyBusy(true)
    setBuyMsg('Préparation du paiement sécurisé…')
    try {
      const dims = row.dims || {}
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
        pricing: pricingFromTtc(ttc),
        config: {
          catalog: {
            id: row.id,
            name: row.name,
            dims: row.dims,
            modules: row.modules,
            panneaux: row.panneaux,
            ossature_finish: row.ossature_finish || row.texture,
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

          <p className="section-kicker">{row.category}</p>
          <h1 className="hero-title">{row.name}</h1>
          <p className="hero-lead">{row.short_description}</p>

          <p className="hint article-view-hint">
            Visualisation figée (ligne matrice) — orbit et zoom uniquement.
          </p>

          <dl className="spec-list">
            <div>
              <dt>SKU</dt>
              <dd className="mono">{row.sku || row.id}</dd>
            </div>
            <div>
              <dt>Dimensions</dt>
              <dd>
                L {row.L_mm} · W {row.W_mm} · H {row.H_mm} mm
              </dd>
            </div>
            <div>
              <dt>Finition</dt>
              <dd>{fin?.label || row.wood_finish}</dd>
            </div>
            <div>
              <dt>Modules</dt>
              <dd>
                {moduleLabels || 'Aucun (ossature seule)'}
                {row.modules_spec ? (
                  <span className="hint"> · {row.modules_spec}</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>Panneaux</dt>
              <dd>
                {(row.panneaux || []).length
                  ? row.panneaux.join(', ')
                  : 'Aucun'}
              </dd>
            </div>
            <div>
              <dt>Tags</dt>
              <dd>{row.tags.map(formatTag).join(' ')}</dd>
            </div>
            <div>
              <dt>Prix indicatif</dt>
              <dd className="product-price">
                {row.price_from
                  ? `à partir de ${row.price_from} € TTC`
                  : 'Sur devis'}
              </dd>
            </div>
          </dl>

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
