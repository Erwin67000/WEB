import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FINITIONS_OSSATURE,
  PANNEAU_COULEURS,
  resolveOssatureFinish,
} from '../1_STRUCTURE/00_matrice/matrice_constante.js'
import { loadCatalog } from '../data/catalog.js'
import FurniturePreview3D from '../components/FurniturePreview3D.jsx'
import { preloadCatalogGlbs } from '../components/CatalogGlbPreview.jsx'
import { useI18n, useTId, useCatalogText } from '@texte/I18nProvider.jsx'

const SHOP_COLOR_KEY = 'philae-shop-panel-color'
const PALETTE = Object.values(PANNEAU_COULEURS).filter((c) => c.id !== 'surmesure')

function readShopColor() {
  try {
    const v = localStorage.getItem(SHOP_COLOR_KEY)
    if (v && PANNEAU_COULEURS[v] && v !== 'surmesure') return v
  } catch {
    /* ignore */
  }
  return null
}

export default function BoutiquePage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const tId = useTId()
  const catalog = useCatalogText()
  const [rows, setRows] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeRooms, setActiveRooms] = useState([])
  const [activeNames, setActiveNames] = useState([])
  const [panelColor, setPanelColor] = useState(readShopColor)

  const setColor = (id) => {
    setPanelColor(id)
    try {
      if (id) localStorage.setItem(SHOP_COLOR_KEY, id)
      else localStorage.removeItem(SHOP_COLOR_KEY)
    } catch {
      /* ignore */
    }
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

  const rooms = useMemo(() => {
    const map = new Map()
    for (const r of rows) {
      if (r.category && !map.has(r.category)) {
        map.set(r.category, r.categoryEn || '')
      }
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], 'fr'),
    )
  }, [rows])

  const names = useMemo(() => {
    const map = new Map()
    for (const r of rows) {
      if (r.name && !map.has(r.name)) {
        map.set(r.name, r.nameEn || '')
      }
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], 'fr'),
    )
  }, [rows])

  const visible = useMemo(() => {
    return rows.filter((r) => {
      const roomOk =
        activeRooms.length === 0 || activeRooms.includes(r.category)
      const nameOk =
        activeNames.length === 0 || activeNames.includes(r.name)
      return roomOk && nameOk
    })
  }, [rows, activeRooms, activeNames])

  const toggle = (list, setList, value) => {
    setList((prev) =>
      prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value],
    )
  }

  const filterLabel = [
    ...activeRooms.map((c) => {
      const en = rooms.find(([fr]) => fr === c)?.[1]
      return catalog.category(c, en)
    }),
    ...activeNames.map((n) => {
      const en = names.find(([fr]) => fr === n)?.[1]
      return catalog.name(n, en)
    }),
  ].join(' · ')

  return (
    <div className="page page-boutique page-site page-full">
      <header className="page-head page-head-full">
        <p className="section-kicker">{t('shop.kicker')}</p>
        <h1 className="hero-title">{t('shop.title')}</h1>
        <p className="hero-lead">{t('shop.lead')}</p>
        <p className="price-disclaimer">{t('shop.priceDisclaimer')}</p>
      </header>

      <div className="boutique-toolbar page-pad-x">
        <div className="boutique-filters">
          <div className="filter-row">
            <span className="filter-label">{t('shop.filterRooms')}</span>
            <div className="tag-filter" role="group" aria-label={t('shop.filterRooms')}>
              <button
                type="button"
                className={`tag-chip${activeRooms.length === 0 ? ' active' : ''}`}
                onClick={() => setActiveRooms([])}
              >
                {t('shop.all')}
              </button>
              {rooms.map(([room, roomEn]) => (
                <button
                  key={room}
                  type="button"
                  className={`tag-chip${activeRooms.includes(room) ? ' active' : ''}`}
                  onClick={() => toggle(activeRooms, setActiveRooms, room)}
                >
                  {catalog.category(room, roomEn)}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-row">
            <span className="filter-label">{t('shop.filterModels')}</span>
            <div className="tag-filter" role="group" aria-label={t('shop.filterModels')}>
              <button
                type="button"
                className={`tag-chip${activeNames.length === 0 ? ' active' : ''}`}
                onClick={() => setActiveNames([])}
              >
                {t('shop.all')}
              </button>
              {names.map(([name, nameEn]) => (
                <button
                  key={name}
                  type="button"
                  className={`tag-chip${activeNames.includes(name) ? ' active' : ''}`}
                  onClick={() => toggle(activeNames, setActiveNames, name)}
                >
                  {catalog.name(name, nameEn)}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-row">
            <span className="filter-label">{t('shop.panelColor')}</span>
            <div className="shop-swatches" role="group" aria-label={t('shop.panelColor')}>
              {PALETTE.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`shop-swatch${panelColor === c.id ? ' active' : ''}`}
                  title={tId('panelColor', c.id, c.label)}
                  onClick={() => setColor(panelColor === c.id ? null : c.id)}
                >
                  <span className="shop-swatch-chip" style={{ background: c.color }} />
                  <span className="shop-swatch-name">
                    {tId('panelColor', c.id, c.label)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <span className="hint">
          {loading
            ? t('shop.loading')
            : visible.length === 1
              ? t('shop.countOne')
              : t('shop.countMany', { n: visible.length })}
          {filterLabel ? t('shop.filterBy', { filter: filterLabel }) : ''}
        </span>
      </div>

      {!loading && !error && visible.length === 0 && (
        <p className="hint page-pad-x">{t('shop.empty')}</p>
      )}

      <div className="product-grid page-pad-x">
        {visible.map((r, index) => {
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
                  hint
                  interactive
                  freeOrbit
                  eager={index < 8}
                  forceLive={Boolean(panelColor)}
                  panneauCouleur={panelColor || undefined}
                />
              </div>
              <div className="product-body">
                <div className="product-meta">
                  <span className="product-cat">
                    {catalog.category(r)}
                  </span>
                  {r.featured && (
                    <span className="badge-gold">{t('shop.featured')}</span>
                  )}
                </div>
                <h2 className="product-name">
                  <Link to={`/boutique/${r.id}`} className="product-name-link">
                    {catalog.name(r)}
                  </Link>
                </h2>
                {catalog.desc(r) ? (
                  <p className="product-desc">{catalog.desc(r)}</p>
                ) : null}
                <p className="product-dims">
                  {tId('finish', finishId, fin?.label || r.wood_finish)} · {r.L_mm}
                  ×{r.W_mm}×{r.H_mm} mm
                  {r.sku ? ` · ${r.sku}` : ''}
                </p>
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
