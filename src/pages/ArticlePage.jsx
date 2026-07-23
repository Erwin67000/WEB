import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FINITIONS } from '../1_STRUCTURE/00_matrice/matrice_constante.js'
import { MODULE_KINDS } from '../1_STRUCTURE/00_matrice/matrice_configuration.js'
import { formatTag, getCatalogItem } from '../data/catalog.js'
import FurniturePreview3D from '../components/FurniturePreview3D.jsx'

const PRICE_DISCLAIMER =
  'Modèle figé de matrice_catalogue. Pour personnaliser : Configurer (session isolée).'

export default function ArticlePage() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const [row, setRow] = useState(null)
  const [error, setError] = useState(null)

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

  const fin = FINITIONS[row.wood_finish]
  const moduleLabels = (row.modules || [])
    .map((m) => MODULE_KINDS[m.kind]?.label || m.kind)
    .join(', ')

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
            <Link to="/contact" className="btn btn-wood">
              Demander un devis
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
