import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FINITIONS_OSSATURE,
  resolveOssatureFinish,
} from '../1_STRUCTURE/00_matrice/matrice_constante.js'
import { loadCatalog } from '../data/catalog.js'
import FurniturePreview3D from '../components/FurniturePreview3D.jsx'
import { preloadCatalogGlbs } from '../components/CatalogGlbPreview.jsx'
import { useI18n, useTId } from '@texte/I18nProvider.jsx'

function tagKey(tag) {
  return String(tag || '')
    .replace(/^#/, '')
    .toLowerCase()
}

export default function BoutiquePage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const tId = useTId()
  const [rows, setRows] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTags, setActiveTags] = useState([])

  const formatTagLabel = (tag) => {
    const raw = tagKey(tag)
    const label = tId('catalog.tag', raw, raw)
    return `#${label}`
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadCatalog({ force: true })
      .then((data) => {
        if (!cancelled) {
          setRows(data)
          setError(null)
          preloadCatalogGlbs(data.map((r) => r.id))
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
      for (const tg of r.tags) s.add(tg)
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [rows])

  const visible = useMemo(() => {
    if (activeTags.length === 0) return rows
    return rows.filter((r) => activeTags.every((tg) => r.tags.includes(tg)))
  }, [rows, activeTags])

  const toggleTag = (tag) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((tg) => tg !== tag) : [...prev, tag],
    )
  }

  return (
    <div className="page page-boutique page-site page-full">
      <header className="page-head page-head-full">
        <p className="section-kicker">{t('shop.kicker')}</p>
        <h1 className="hero-title">{t('shop.title')}</h1>
        <p className="hero-lead">{t('shop.lead')}</p>
        <p className="price-disclaimer">{t('shop.priceDisclaimer')}</p>
        <p className="hint page-pad-x" style={{ paddingLeft: 0 }} />
      </header>

      <div className="boutique-toolbar page-pad-x">
        <div className="tag-filter" role="group" aria-label={t('shop.filterAria')}>
          <button
            type="button"
            className={`tag-chip${activeTags.length === 0 ? ' active' : ''}`}
            onClick={() => setActiveTags([])}
          >
            {t('shop.all')}
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`tag-chip${activeTags.includes(tag) ? ' active' : ''}`}
              onClick={() => toggleTag(tag)}
            >
              {formatTagLabel(tag)}
            </button>
          ))}
        </div>
        <span className="hint">
          {loading
            ? t('shop.loading')
            : visible.length === 1
              ? t('shop.countOne')
              : t('shop.countMany', { n: visible.length })}
          {activeTags.length > 0
            ? t('shop.filterBy', {
                filter: activeTags.map(formatTagLabel).join(' '),
              })
            : ''}
        </span>
      </div>

      {!loading && !error && visible.length === 0 && (
        <p className="hint page-pad-x">{t('shop.empty')}</p>
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
                  <span className="product-cat">
                    {tId('catalog.category', r.category, r.category)}
                  </span>
                  {r.featured && (
                    <span className="badge-gold">{t('shop.featured')}</span>
                  )}
                </div>
                <h2 className="product-name">
                  <Link
                    to={`/boutique/${r.id}`}
                    className="product-name-link"
                  >
                    {tId('catalog.name', r.name, r.name)}
                  </Link>
                </h2>
                <p className="product-desc">
                  {tId('catalog.desc', r.short_description, r.short_description)}
                </p>
                <p className="product-dims">
                  {tId('finish', finishId, fin?.label || r.wood_finish)} · {r.L_mm}
                  ×{r.W_mm}×{r.H_mm} mm
                  {r.sku ? ` · ${r.sku}` : ''}
                </p>
                <div className="product-tags">
                  {r.tags.map((tg) => (
                    <button
                      key={tg}
                      type="button"
                      className="product-tag"
                      onClick={() =>
                        setActiveTags((prev) =>
                          prev.includes(tg) ? prev : [...prev, tg],
                        )
                      }
                    >
                      {formatTagLabel(tg)}
                    </button>
                  ))}
                </div>
                <div className="product-footer">
                  <span className="product-price">
                    {r.price_from
                      ? t('shop.fromPrice', { price: r.price_from })
                      : t('shop.onQuote')}
                  </span>
                  <div className="product-actions">
                    <Link
                      to={`/boutique/${r.id}`}
                      className="btn btn-wood btn-sm-site"
                    >
                      {t('shop.detail')}
                    </Link>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm-site"
                      onClick={() => navigate(`/boutique/${r.id}/configurer`)}
                    >
                      {t('shop.configure')}
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
