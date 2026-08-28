import { useMemo, useState, useRef, useEffect } from 'react'
import { useActiveConfigStore, useActiveConfigStoreApi } from '../store/ConfigStoreContext.jsx'
import {
  FINITIONS_OSSATURE,
  FINITIONS_OSSATURE_CLIENT,
  PANNEAU_COULEURS,
  EPAISSEUR_PANNEAU,
  areteExtrusionMm,
} from '../1_STRUCTURE/00_matrice/matrice_constante.js'
import {
  MODULE_KINDS,
  ENVIRONMENTS,
} from '../1_STRUCTURE/00_matrice/matrice_configuration.js'
import {
  shelfZMm,
  shelfZBounds,
  moduleLayout,
  WURTH_PROFONDEUR_MIN_MM,
  WURTH_HAUTEURS_MM,
  WURTH_HAUTEUR_DEFAUT_MM,
  DYNAMOOV_LWK_MIN_MM,
  DYNAMOOV_LWK_MAX_MM,
  drawerInnerWidthMm,
  isDrawerWidthAllowed,
} from '../1_STRUCTURE/02_agencement/agencement.js'
import { DIM_LIMITS, formatMmAsCm, parseCmInputToMm } from '../3_INPUT/matrice_input.js'

import { FACE_PICK_DEFS } from '../1_STRUCTURE/02_agencement/FacePickPlanes.jsx'
import { useNavigate } from 'react-router-dom'
import { useI18n, useTId } from '@texte/I18nProvider.jsx'
import PayButton from './PayButton.jsx'
import { persistDraft } from '../lib/checkoutDraft.js'
import { STRIPE_ENABLED } from '../lib/payments.js'
import { writeShopPanelColor } from '../lib/shopPanelColor.js'
import { labelFromUnits } from '../lib/checkout.js'

/** Labels courts pour chips des panneaux actifs */
const PANNEAU_CHIP_LABELS = Object.fromEntries(
  FACE_PICK_DEFS.map((f) => [f.id, f.label]),
)

const CM_DRAFT_RE = /^-?[0-9]*[.,]?[0-9]*$/

function selectInputText(el) {
  if (!el || typeof el.select !== 'function') return
  requestAnimationFrame(() => {
    try {
      el.select()
    } catch {
      /* ignore */
    }
  })
}

/**
 * Rangée compacte : Label · [valeur cm] · cm, puis slider (stockage mm).
 * Clic = sélection du nombre (saisie directe, virgule ou point, 0,1 cm = 1 mm).
 */
function SliderDim({ label, value, onChange, min, max, step = 1 }) {
  const inputRef = useRef(null)
  const justFocused = useRef(false)
  const [draft, setDraft] = useState(null)

  useEffect(() => {
    if (document.activeElement !== inputRef.current) setDraft(null)
  }, [value])

  const display = draft != null ? draft : formatMmAsCm(value)
  const rangeVal = Math.min(max, Math.max(min, Number(value) || min))

  const commit = (raw) => {
    setDraft(null)
    const mm = parseCmInputToMm(raw)
    if (!Number.isFinite(mm)) return
    onChange(Math.min(max, Math.max(min, mm)))
  }

  return (
    <label className="field slider-dim slider-dim-compact">
      <div className="slider-dim-head">
        <span className="field-label">{label}</span>
        <div className="slider-dim-input">
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            value={display}
            onFocus={(e) => {
              justFocused.current = true
              setDraft(formatMmAsCm(value))
              selectInputText(e.target)
            }}
            onMouseDown={(e) => {
              if (document.activeElement !== e.target) justFocused.current = true
            }}
            onMouseUp={(e) => {
              if (justFocused.current) {
                e.preventDefault()
                justFocused.current = false
                e.target.select()
              }
            }}
            onChange={(e) => {
              const v = e.target.value
              if (v !== '' && !CM_DRAFT_RE.test(v)) return
              setDraft(v)
            }}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commit(e.target.value)
                e.currentTarget.blur()
              } else if (e.key === 'Escape') {
                setDraft(null)
                e.currentTarget.blur()
              }
            }}
          />
          <span className="field-unit">cm</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={rangeVal}
        onChange={(e) => {
          setDraft(null)
          onChange(Number(e.target.value))
        }}
      />
    </label>
  )
}

/** Rotation seule (sans slider long) — compacte. */
function NumFieldInline({ label, value, onChange, min, max, unit = '°' }) {
  const inputRef = useRef(null)
  const justFocused = useRef(false)
  const [draft, setDraft] = useState(null)

  useEffect(() => {
    if (document.activeElement !== inputRef.current) setDraft(null)
  }, [value])

  const display = draft != null ? draft : String(value ?? '')

  const commit = (raw) => {
    setDraft(null)
    const n = Number(String(raw).trim().replace(',', '.'))
    if (!Number.isFinite(n)) return
    onChange(Math.min(max, Math.max(min, n)))
  }

  return (
    <label className="field slider-dim-compact">
      <div className="slider-dim-head">
        <span className="field-label">{label}</span>
        <div className="slider-dim-input">
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            value={display}
            onFocus={(e) => {
              justFocused.current = true
              setDraft(String(value ?? ''))
              selectInputText(e.target)
            }}
            onMouseUp={(e) => {
              if (justFocused.current) {
                e.preventDefault()
                justFocused.current = false
                e.target.select()
              }
            }}
            onChange={(e) => {
              const v = e.target.value
              if (v !== '' && !CM_DRAFT_RE.test(v)) return
              setDraft(v)
            }}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commit(e.target.value)
                e.currentTarget.blur()
              } else if (e.key === 'Escape') {
                setDraft(null)
                e.currentTarget.blur()
              }
            }}
          />
          <span className="field-unit">{unit}</span>
        </div>
      </div>
    </label>
  )
}

function FabIcon({ name }) {
  const common = {
    viewBox: '0 0 24 24',
    width: '22',
    height: '22',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }
  if (name === 'meuble') {
    return (
      <svg {...common}>
        <rect x="3.5" y="9" width="17" height="11.5" rx="1.4" />
        <path d="M6.5 9V5.8A1.8 1.8 0 0 1 8.3 4h7.4A1.8 1.8 0 0 1 17.5 5.8V9" />
      </svg>
    )
  }
  if (name === 'dims') {
    return (
      <svg {...common}>
        <path d="M4 20V7.5M4 20h12.5" />
        <path d="M4 7.5h4.5M16.5 20v-4.5" />
        <rect x="9.5" y="4" width="10.5" height="10.5" rx="1.2" />
      </svg>
    )
  }
  if (name === 'modules') {
    return (
      <svg {...common}>
        <rect x="3.5" y="3.5" width="17" height="17" rx="1.4" />
        <path d="M3.5 10h17M3.5 16.5h17M10 3.5v17" />
      </svg>
    )
  }
  if (name === 'panneaux') {
    return (
      <svg {...common}>
        <rect x="4" y="5.5" width="13" height="13" rx="1.2" />
        <path d="M8.5 3.5h11v13" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 5.2V3.4M12 20.6v-1.8M5.2 12H3.4M20.6 12h-1.8M7.1 7.1 5.8 5.8M18.2 18.2l-1.3-1.3M7.1 16.9 5.8 18.2M18.2 5.8l-1.3 1.3" />
    </svg>
  )
}

export default function ControlPanel() {
  // Select only stable store slices (never call helpers that return new objects
  // inside useConfigStore selectors — that causes infinite re-render loops).
  const units = useActiveConfigStore((s) => s.units)
  const activeUnitId = useActiveConfigStore((s) => s.activeUnitId)
  const environmentId = useActiveConfigStore((s) => s.environmentId)
  const sunEnabled = useActiveConfigStore((s) => s.sunEnabled)
  const sunIntensity = useActiveConfigStore((s) => s.sunIntensity)
  const wireframe = useActiveConfigStore((s) => s.wireframe)

  const panneauPickMode = useActiveConfigStore((s) => s.panneauPickMode)
  const dimsLocked = useActiveConfigStore((s) => s.dimsLocked)

  const setActiveUnit = useActiveConfigStore((s) => s.setActiveUnit)
  const addUnit = useActiveConfigStore((s) => s.addUnit)
  const removeUnit = useActiveConfigStore((s) => s.removeUnit)
  const updateUnit = useActiveConfigStore((s) => s.updateUnit)
  const updateDims = useActiveConfigStore((s) => s.updateDims)
  const updatePosition = useActiveConfigStore((s) => s.updatePosition)
  const addModule = useActiveConfigStore((s) => s.addModule)
  const removeModule = useActiveConfigStore((s) => s.removeModule)
  const setModuleOpen = useActiveConfigStore((s) => s.setModuleOpen)
  const setModuleZ = useActiveConfigStore((s) => s.setModuleZ)
  const setModuleH = useActiveConfigStore((s) => s.setModuleH)
  const togglePanneau = useActiveConfigStore((s) => s.togglePanneau)
  const setEnvironment = useActiveConfigStore((s) => s.setEnvironment)
  const setSun = useActiveConfigStore((s) => s.setSun)
  const setSunIntensity = useActiveConfigStore((s) => s.setSunIntensity)
  const setWireframe = useActiveConfigStore((s) => s.setWireframe)
  const setPanneauPickMode = useActiveConfigStore((s) => s.setPanneauPickMode)
  const contact = useActiveConfigStore((s) => s.contact)

  const storeApi = useActiveConfigStoreApi()

  const unit = useMemo(
    () => units.find((u) => u.id === activeUnitId) || units[0],
    [units, activeUnitId],
  )

  const pricing = useMemo(
    () => storeApi.getState().getPricing(),
    [units, storeApi],
  )

  const { t } = useI18n()
  const tId = useTId()
  const navigate = useNavigate()
  const [flash, setFlash] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [drawerWidthAlert, setDrawerWidthAlert] = useState(false)
  /** Chip en cours de renommage (id meuble) */
  const [editingUnitId, setEditingUnitId] = useState(null)
  const renameInputRef = useRef(null)
  const [openSections, setOpenSections] = useState(() => ({
    meuble: false,
    dims: false,
    modules: false,
    panneaux: false,
    scene: false,
    devis: false,
  }))

  useEffect(() => {
    if (editingUnitId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [editingUnitId])

  if (!unit) return null

  const CORE_SECTIONS = ['meuble', 'dims', 'modules', 'panneaux', 'scene']
  const toggleExclusive = (k) =>
    setOpenSections((s) => {
      const closing = Boolean(s[k])
      return {
        ...s,
        meuble: false,
        dims: false,
        modules: false,
        panneaux: false,
        scene: false,
        [k]: !closing,
      }
    })
  const sheetOpen = CORE_SECTIONS.some((k) => openSections[k])
  const fabItems = [
    { id: 'meuble', label: t('config.furniture'), icon: 'meuble' },
    { id: 'dims', label: t('config.dims'), icon: 'dims' },
    { id: 'modules', label: t('config.layout'), icon: 'modules' },
    { id: 'panneaux', label: t('config.panels'), icon: 'panneaux' },
    { id: 'scene', label: t('config.scene'), icon: 'scene' },
  ]

  const notify = (msg) => {
    setFlash(msg)
    setTimeout(() => setFlash(''), 4200)
  }

  /** Index du meuble actif (0 = premier, non déplaçable) */
  const activeUnitIndex = units.findIndex((u) => u.id === activeUnitId)
  const isPrimaryUnit = activeUnitIndex <= 0
  const canShowPosition = activeUnitIndex >= 1

  return (
    <aside
      className={`control-panel${mobileOpen ? ' mobile-open' : ''}${
        sheetOpen ? ' is-sheet-open' : ''
      }`}
    >
      <div className="config-fab-bar" role="toolbar" aria-label={t('config.options')}>
        {fabItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`config-fab${openSections[item.id] ? ' is-active' : ''}`}
            onClick={() => toggleExclusive(item.id)}
            aria-pressed={Boolean(openSections[item.id])}
            title={item.label}
            aria-label={item.label}
          >
            <FabIcon name={item.icon} />
          </button>
        ))}
      </div>
      <div className="panel-scroll">
        <section className="panel-section">
          <button
            type="button"
            className="section-head"
            onClick={() => toggleExclusive('meuble')}
          >
            <span>{t('config.furniture')}</span>
            <span className="chev">{openSections.meuble ? '▾' : '▸'}</span>
          </button>
          {openSections.meuble && (
            <div className="section-body">
                {!dimsLocked && (
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn-sm"
                      onClick={() => {
                        const result = addUnit()
                        if (result && result.ok === false) {
                          notify(
                            result.reason === 'max-units' ||
                              /envergure|larger-scale/i.test(result.reason || '')
                              ? t('config.reasonLarge')
                              : result.reason
                                ? t('config.reasonBoutique')
                                : t('config.reasonLarge'),
                          )
                        }
                      }}
                    >
                      {t('config.addPiece')}
                    </button>
                    <button
                      type="button"
                      className="btn-sm danger"
                      onClick={() => removeUnit(activeUnitId)}
                      disabled={units.length <= 1}
                    >
                      {t('config.remove')}
                    </button>
                  </div>
                )}
                <div className="unit-list unit-list-stack">
                  {units.map((u, idx) =>
                    editingUnitId === u.id ? (
                      <input
                        key={u.id}
                        ref={renameInputRef}
                        className="unit-chip-input"
                        type="text"
                        value={u.label}
                        maxLength={40}
                        onChange={(e) =>
                          updateUnit(u.id, { label: e.target.value })
                        }
                        onBlur={() => setEditingUnitId(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Escape') {
                            setEditingUnitId(null)
                          }
                        }}
                      />
                    ) : (
                      <button
                        key={u.id}
                        type="button"
                        className={`unit-chip ${u.id === activeUnitId ? 'active' : ''}`}
                        title={
                          u.id === activeUnitId
                            ? t('config.renameHint')
                            : t('config.selectHint')
                        }
                        onClick={() => {
                          if (u.id === activeUnitId) {
                            setEditingUnitId(u.id)
                          } else {
                            setActiveUnit(u.id)
                            setEditingUnitId(null)
                          }
                        }}
                      >
                        <span className="unit-chip-name">
                          {/^Meuble\s+\d+$/i.test(u.label || '')
                            ? t('config.unitN', { n: idx + 1 })
                            : u.label || t('config.unitN', { n: idx + 1 })}
                        </span>
                        <span className="unit-chip-dims">
                          {formatMmAsCm(u.dims.L)} × {formatMmAsCm(u.dims.W)} ×{' '}
                          {formatMmAsCm(u.dims.H)} {t('config.unitCm')}
                        </span>
                      </button>
                    ),
                  )}
                </div>
                <p className="field-label" style={{ marginTop: '0.35rem' }}>
                  {t('config.frameFinish')}
                </p>
                <div className="finish-choice-list">
                  {FINITIONS_OSSATURE_CLIENT.map((id) => {
                    const f = FINITIONS_OSSATURE[id]
                    if (!f) return null
                    const active = (unit.ossatureFinish || 'brut') === id
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`finish-choice-btn${active ? ' active' : ''}`}
                        onClick={() =>
                          updateUnit(unit.id, { ossatureFinish: id })
                        }
                      >
                        <span className="finish-choice-label">
                          {tId('finish', id, f.label)}
                        </span>
                        <span
                          className="finish-choice-swatch"
                          style={{ background: f.previewColor }}
                          title={tId('finish', id, f.label)}
                        />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </section>

        {/* Dimensions — en boutique : L×P×H du modèle (figées) */}
        <section className="panel-section">
          <button type="button" className="section-head" onClick={() => toggleExclusive('dims')}>
            <span>
              {dimsLocked ? t('config.dimsModel') : t('config.dims')}
            </span>
            <span className="chev">{openSections.dims ? '▾' : '▸'}</span>
          </button>
          {openSections.dims && (
            <div className="section-body">
              {dimsLocked ? (
                <div className="dims-locked-block">
                  <p className="muted" style={{ margin: 0 }}>
                    {t('config.dimsLocked')}
                  </p>
                  <p className="dims-locked-values">
                    <strong>
                      {formatMmAsCm(unit.dims.L)} × {formatMmAsCm(unit.dims.W)} ×{' '}
                      {formatMmAsCm(unit.dims.H)}
                    </strong>{' '}
                    {t('config.unitCm')}
                    <span className="muted"> {t('config.lwh')}</span>
                  </p>
                  <p className="muted" style={{ fontSize: '0.8125rem', margin: 0 }}>
                    {t('config.dimsLockedHint')}
                  </p>
                </div>
              ) : (
                <>
                  <SliderDim
                    label={t('config.length')}
                    value={unit.dims.L}
                    min={DIM_LIMITS.L.min}
                    max={DIM_LIMITS.L.max}
                    step={DIM_LIMITS.L.step}
                    onChange={(L) => {
                      const next = { ...unit.dims, L }
                      const hasDrawers = unit.modules.some(
                        (m) => m.kind === 'drawer',
                      )
                      if (
                        hasDrawers &&
                        isDrawerWidthAllowed(unit.dims) &&
                        !isDrawerWidthAllowed(next)
                      ) {
                        setDrawerWidthAlert(true)
                      }
                      updateDims(unit.id, { L })
                    }}
                  />
                  <SliderDim
                    label={t('config.depth')}
                    value={unit.dims.W}
                    min={DIM_LIMITS.W.min}
                    max={DIM_LIMITS.W.max}
                    step={DIM_LIMITS.W.step}
                    onChange={(W) => updateDims(unit.id, { W })}
                  />
                  <SliderDim
                    label={t('config.height')}
                    value={unit.dims.H}
                    min={DIM_LIMITS.H.min}
                    max={DIM_LIMITS.H.max}
                    step={DIM_LIMITS.H.step}
                    onChange={(H) => updateDims(unit.id, { H })}
                  />
                </>
              )}
              {canShowPosition && !dimsLocked && (
                <>
                  <SliderDim
                    label={t('config.posX')}
                    value={unit.positionMm.x}
                    min={-5000}
                    max={5000}
                    step={1}
                    onChange={(x) => updatePosition(unit.id, { x })}
                  />
                  <SliderDim
                    label={t('config.posY')}
                    value={unit.positionMm.y}
                    min={-5000}
                    max={5000}
                    step={1}
                    onChange={(y) => updatePosition(unit.id, { y })}
                  />
                </>
              )}
              {!dimsLocked && (
                <NumFieldInline
                  label={t('config.rotZ')}
                  value={unit.rotationZ}
                  min={-180}
                  max={180}
                  step={5}
                  unit="°"
                  onChange={(rotationZ) =>
                    updateUnit(unit.id, { rotationZ })
                  }
                />
              )}
            </div>
          )}
        </section>

        {/* Modules */}
        <section className="panel-section">
          <button type="button" className="section-head" onClick={() => toggleExclusive('modules')}>
            <span>{t('config.layout')}</span>
            <span className="chev">{openSections.modules ? '▾' : '▸'}</span>
          </button>
          {openSections.modules && (
            <div className="section-body">
              <div className="row-actions wrap">
                {Object.values(MODULE_KINDS).map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    className="btn-sm"
                    onClick={() => {
                      if (
                        k.id === 'drawer' &&
                        !isDrawerWidthAllowed(unit.dims)
                      ) {
                        setDrawerWidthAlert(true)
                        return
                      }
                      addModule(k.id)
                    }}
                  >
                    + {tId('module', k.id, k.label)}
                  </button>
                ))}
              </div>
              {unit.modules.length === 0 && (
                <p className="muted">
                  {t('config.noModules')}
                </p>
              )}
              <ul className="mod-list">
                {unit.modules.map((m) => {
                  const shelfZ =
                    m.kind === 'shelf'
                      ? shelfZMm(m, unit.dims, unit.modules)
                      : null
                  const shelfBounds =
                    m.kind === 'shelf'
                      ? shelfZBounds(unit.dims, unit.modules)
                      : null
                  const shelfExtrusion = areteExtrusionMm(unit.dims)
                  const shelfZMin = shelfBounds?.zMin ?? 22 + Number(EPAISSEUR_PANNEAU)
                  const shelfZMax = shelfBounds?.zMax ?? unit.dims.H - 22 - shelfExtrusion
                  const drawerLayout =
                    m.kind === 'drawer'
                      ? moduleLayout(m, unit.dims, unit.modules)
                      : null
                  const wurth = drawerLayout?.wurth
                  const depthTooSmall = Boolean(
                    drawerLayout?.depthTooSmall || wurth?.depthTooSmall,
                  )
                  const lwkOutOfRange = Boolean(
                    drawerLayout?.lwkOutOfRange || wurth?.lwkOutOfRange,
                  )
                  const depthMm = depthTooSmall
                    ? wurth?.depthAvailableMm ?? 0
                    : wurth?.depthMm
                  return (
                    <li key={m.id} className="mod-item">
                      <div className="mod-head">
                        <span>
                          {tId(
                            'module',
                            m.kind,
                            MODULE_KINDS[m.kind]?.label || m.kind,
                          )}
                        </span>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => removeModule(m.id)}
                          aria-label={t('config.removeAria')}
                        >
                          ×
                        </button>
                      </div>
                      {m.kind === 'shelf' && (
                        <SliderDim
                          label={t('config.posZ')}
                          value={Math.round(shelfZ)}
                          min={Math.round(shelfZMin)}
                          max={Math.round(shelfZMax)}
                          step={1}
                          onChange={(z) => setModuleZ(m.id, z)}
                        />
                      )}
                      {m.kind === 'drawer' && (
                        <>
                          {lwkOutOfRange ? (
                            <p className="drawer-warn" role="alert">
                              {t('config.drawerWidthRange', {
                                min: DYNAMOOV_LWK_MIN_MM,
                                max: DYNAMOOV_LWK_MAX_MM,
                                lwk: wurth?.lwkMm ?? drawerInnerWidthMm(unit.dims),
                              })}
                            </p>
                          ) : null}
                          {depthTooSmall && !lwkOutOfRange ? (
                            <p className="drawer-warn" role="alert">
                              {t('config.drawerTooShallow', {
                                min: formatMmAsCm(WURTH_PROFONDEUR_MIN_MM),
                              })}
                            </p>
                          ) : null}
                          <label className="field compact">
                            <span className="field-label">
                              {t('config.drawerHeight')}
                            </span>
                            <select
                              className="field-input"
                              value={m.hMm ?? wurth?.hMm ?? WURTH_HAUTEUR_DEFAUT_MM}
                              onChange={(e) =>
                                setModuleH(m.id, Number(e.target.value))
                              }
                            >
                              {WURTH_HAUTEURS_MM.map((h) => (
                                <option key={h} value={h}>
                                  {formatMmAsCm(h)} {t('config.unitCm')}
                                </option>
                              ))}
                            </select>
                          </label>
                          <p className="muted drawer-dims-hint">
                            {t('config.depthAuto')}{' '}
                            <strong>
                              {depthMm != null
                                ? `${formatMmAsCm(depthMm)} ${t('config.unitCm')}`
                                : '—'}
                            </strong>
                          </p>
                        </>
                      )}
                      {m.kind === 'door' && (
                        <label className="field compact">
                          <span className="field-label">{t('config.opening')}</span>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={m.openFactor || 0}
                            onChange={(e) =>
                              setModuleOpen(m.id, Number(e.target.value))
                            }
                          />
                        </label>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </section>

        {/* Panneaux */}
        <section className="panel-section">
          <button type="button" className="section-head" onClick={() => toggleExclusive('panneaux')}>
            <span>{t('config.panels')}</span>
            <span className="chev">{openSections.panneaux ? '▾' : '▸'}</span>
          </button>
          {openSections.panneaux && (
            <div className="section-body panneaux-game">
              <button
                type="button"
                className={`btn panneau-pick-btn${panneauPickMode ? ' active' : ''} primary`}
                onClick={() => setPanneauPickMode(!panneauPickMode)}
              >
                {panneauPickMode
                  ? t('config.doneFaces')
                  : t('config.addPanel')}
              </button>
              {panneauPickMode && (
                <p className="pick-hint">
                  {t('config.pickHint')}
                  <br />
                  {t('config.pickHintDoor')}
                </p>
              )}

              {(unit.panneaux || []).length > 0 ? (
                <div className="panneau-chips">
                  {(unit.panneaux || []).map((id) => (
                    <button
                      key={id}
                      type="button"
                      className="panneau-chip"
                      title={t('config.removePanel')}
                      onClick={() => togglePanneau(id)}
                    >
                      {tId('panel', id, PANNEAU_CHIP_LABELS[id] || id)}
                      <span aria-hidden>×</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted">{t('config.noPanels')}</p>
              )}

              <p className="field-label" style={{ marginTop: '0.35rem' }}>
                {t('config.panelColor')}
              </p>
              <div className="color-swatch-grid">
                {Object.values(PANNEAU_COULEURS)
                  .filter((c) => c.id !== 'surmesure')
                  .map((c) => {
                    const active =
                      (unit.panneauCouleur || 'gris_cendre') === c.id
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`color-swatch-btn${active ? ' active' : ''}`}
                        title={tId('panelColor', c.id, c.label)}
                        onClick={() => {
                          updateUnit(unit.id, { panneauCouleur: c.id })
                          writeShopPanelColor(c.id)
                        }}
                      >
                        <span
                          className="color-swatch"
                          style={{ background: c.color }}
                        />
                        <span className="color-swatch-label">
                          {tId('panelColor', c.id, c.label)}
                        </span>
                      </button>
                    )
                  })}
              </div>
            </div>
          )}
        </section>

        {/* Scène */}
        <section className="panel-section">
          <button type="button" className="section-head" onClick={() => toggleExclusive('scene')}>
            <span>{t('config.scene')}</span>
            <span className="chev">{openSections.scene ? '▾' : '▸'}</span>
          </button>
          {openSections.scene && (
            <div className="section-body">
              <label className="field">
                <span className="field-label">{t('config.environment')}</span>
                <select
                  value={environmentId}
                  onChange={(e) => setEnvironment(e.target.value)}
                >
                  {Object.values(ENVIRONMENTS).map((e) => (
                    <option key={e.id} value={e.id}>
                      {tId('env', e.id, e.label)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="check-item">
                <input
                  type="checkbox"
                  checked={sunEnabled}
                  onChange={(e) => setSun(e.target.checked)}
                />
                {t('config.sun')}
              </label>
              {sunEnabled && (
                <label className="field compact">
                  <span className="field-label">
                    {t('config.intensity', { n: sunIntensity.toFixed(1) })}
                  </span>
                  <input
                    type="range"
                    min={0.2}
                    max={5}
                    step={0.1}
                    value={sunIntensity}
                    onChange={(e) => setSunIntensity(Number(e.target.value))}
                  />
                </label>
              )}
            </div>
          )}
        </section>

      </div>
      <div className="config-buy-float">
        <button
          type="button"
          className="config-price-btn"
          tabIndex={-1}
          aria-label={`${pricing.ttc.toFixed(0)} € ${t('config.ttc')}`}
        >
          {pricing.ttc.toFixed(0)} € {t('config.ttc')}
        </button>
        <PayButton
          disabled={!STRIPE_ENABLED || pricing.ttc < 0.5}
          onClick={async () => {
            const { trackEvent } = await import('../lib/plausible.js')
            const { getExtrasConsent } = await import('../lib/plausible.js')
            trackEvent('Checkout intent', { source: 'configurator' })
            await persistDraft({
              source: dimsLocked ? 'boutique' : 'configurator',
              quoteRef: storeApi.getState().quoteRef,
              productLabel: labelFromUnits(units),
              lang: document.documentElement.lang || 'fr',
              productId: storeApi.getState().catalogProductId || undefined,
              paymentMode: 'full',
              pricing: {
                ht: pricing.ht,
                tva: pricing.tva,
                ttc: pricing.ttc,
              },
              contact,
              config: {
                quoteRef: storeApi.getState().quoteRef,
                units,
                notes: storeApi.getState().notes,
                contact,
                pricing,
                extrasConsent: getExtrasConsent(),
              },
            })
            navigate('/commande')
          }}
        >
          {t('config.buy')}
        </PayButton>
      </div>
      {flash && <div className="panel-flash">{flash}</div>}
      {drawerWidthAlert && (
        <div
          className="drawer-alert-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setDrawerWidthAlert(false)}
        >
          <div
            className="drawer-alert"
            onClick={(e) => e.stopPropagation()}
          >
            <p>
              {t('config.drawerWidthRange', {
                min: DYNAMOOV_LWK_MIN_MM,
                max: DYNAMOOV_LWK_MAX_MM,
                lwk: drawerInnerWidthMm(unit.dims),
              })}
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => setDrawerWidthAlert(false)}
            >
              {t('config.ok')}
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
