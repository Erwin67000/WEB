import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FINITIONS_OSSATURE,
  resolveOssatureFinish,
} from '../1_STRUCTURE/00_matrice/matrice_constante.js'
import {
  formatTag,
  loadCatalog,
  MATRICE_CATALOGUE_URL,
} from '../data/catalog.js'
import FurniturePreview3D from '../components/FurniturePreview3D.jsx'

const PRICE_DISCLAIMER =
  'Prix indicatifs hors livraison.'

export default function BoutiquePage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTags, setActiveTags] = useState([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadCatalog({ force: true })
      .then((data) => {
        if (!cancelled) {
          setRows(data)
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
  }, [])

  const allTags = useMemo(() => {
    const s = new Set()
    for (const r of rows) {
      for (const t of r.tags) s.add(t)
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [rows])

  const visible = useMemo(() => {
    if (activeTags.length === 0) return rows
    return rows.filter((r) => activeTags.every((t) => r.tags.includes(t)))
  }, [rows, activeTags])

  const toggleTag = (tag) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  return (
    <div className="page page-boutique page-site page-full">
      <header className="page-head page-head-full">
        <p className="section-kicker">Catalogue</p>
        <h1 className="hero-title">Boutique</h1>
        <p className="hero-lead">
          Retrouvez ici les modèles préconfigurés.
        </p>
        <p className="price-disclaimer">{PRICE_DISCLAIMER}</p>
        <p className="hint page-pad-x" style={{ paddingLeft: 0 }}>
        </p>
      </header>

      <div className="boutique-toolbar page-pad-x">
        <div className="tag-filter" role="group" aria-label="Filtrer par tags">
          <button
            type="button"
            className={`tag-chip${activeTags.length === 0 ? ' active' : ''}`}
            onClick={() => setActiveTags([])}
          >
            Tous
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`tag-chip${activeTags.includes(tag) ? ' active' : ''}`}
              onClick={() => toggleTag(tag)}
            >
              {formatTag(tag)}
            </button>
          ))}
        </div>
        <span className="hint">
          {loading
            ? 'Chargement…'
            : `${visible.length} modèle${visible.length !== 1 ? 's' : ''}`}
          {activeTags.length > 0
            ? ` · filtre ${activeTags.map(formatTag).join(' ')}`
            : ''}
        </span>
      </div>


      {!loading && !error && visible.length === 0 && (
        <p className="hint page-pad-x">
          Aucune ligne active dans la matrice. Ajoutez des modèles avec{' '}
          <code>active=true</code>.
        </p>
      )}

      <div className="product-grid page-pad-x">
        {visible.map((r) => {
          const finishId = resolveOssatureFinish(
            r.ossature_finish || r.texture || r.wood_finish,
          )
          const fin = FINITIONS_OSSATURE[finishId]
          return (
            <article
              key={r.id}
              className={`product-card${r.featured ? ' featured' : ''}`}
            >
              <div className="product-media">
                <FurniturePreview3D
                  catalogRow={r}
                  height={220}
                  className="product-mini-3d"
                />
              </div>
              <div className="product-body">
                <div className="product-meta">
                  <span className="product-cat">{r.category}</span>
                  {r.featured && <span className="badge-gold">Vedette</span>}
                </div>
                <h2 className="product-name">{r.name}</h2>
                <p className="product-desc">{r.short_description}</p>
                <p className="product-dims">
                  {fin?.label || r.wood_finish} · {r.L_mm}×{r.W_mm}×{r.H_mm} mm
                  {r.sku ? ` · ${r.sku}` : ''}
                </p>
                <div className="product-tags">
                  {r.tags.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="product-tag"
                      onClick={() =>
                        setActiveTags((prev) =>
                          prev.includes(t) ? prev : [...prev, t],
                        )
                      }
                    >
                      {formatTag(t)}
                    </button>
                  ))}
                </div>
                <div className="product-footer">
                  <span className="product-price">
                    {r.price_from
                      ? `à partir de ${r.price_from} € TTC`
                      : 'Prix sur devis'}
                  </span>
                  <div className="product-actions">
                    <Link
                      to={`/boutique/${r.id}`}
                      className="btn btn-wood btn-sm-site"
                    >
                      Détail
                    </Link>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm-site"
                      onClick={() => navigate(`/boutique/${r.id}/configurer`)}
                    >
                      Configurer
                    </button>
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
