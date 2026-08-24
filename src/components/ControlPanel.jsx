import { useMemo, useState, useRef, useEffect } from 'react'
import { useActiveConfigStore, useActiveConfigStoreApi } from '../store/ConfigStoreContext.jsx'
import {
  FINITIONS_OSSATURE,
  FINITIONS_OSSATURE_CLIENT,
  PANNEAU_COULEURS,
  EPAISSEUR_PANNEAU,
  DEFAULT_PANNEAU_HEX,
  areteExtrusionMm,
} from '../1_STRUCTURE/00_matrice/matrice_constante.js'
import {
  MODULE_KINDS,
  ENVIRONMENTS,
} from '../1_STRUCTURE/00_matrice/matrice_configuration.js'
import {
  shelfZMm,
  moduleLayout,
  WURTH_HAUTEURS_MM,
  WURTH_PROFONDEUR_MIN_MM,
} from '../1_STRUCTURE/02_agencement/agencement.js'
import { DIM_LIMITS } from '../3_INPUT/matrice_input.js'
import { CLIENT_FIELDS } from '../3_INPUT/matrice_client.js'
import { FACE_PICK_DEFS } from '../1_STRUCTURE/02_agencement/FacePickPlanes.jsx'
import { useI18n, useTId } from '@texte/I18nProvider.jsx'

/** Labels courts pour chips des panneaux actifs */
const PANNEAU_CHIP_LABELS = Object.fromEntries(
  FACE_PICK_DEFS.map((f) => [f.id, f.label]),
)

/**
 * Rangée compacte : Label · [valeur] · unité, puis slider dessous.
 * (Longueur / Profondeur / Hauteur / Pos. X / Pos. Y / Z tablette)
 */
function SliderDim({ label, value, onChange, min, max, step = 5, unit = 'mm' }) {
  return (
    <label className="field slider-dim slider-dim-compact">
      <div className="slider-dim-head">
        <span className="field-label">{label}</span>
        <div className="slider-dim-input">
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <span className="field-unit">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

/** Rotation seule (sans slider long) — compacte. */
function NumFieldInline({ label, value, onChange, min, max, step = 1, unit = '°' }) {
  return (
    <label className="field slider-dim-compact">
      <div className="slider-dim-head">
        <span className="field-label">{label}</span>
        <div className="slider-dim-input">
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <span className="field-unit">{unit}</span>
        </div>
      </div>
    </label>
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
  const notes = useActiveConfigStore((s) => s.notes)
  const quoteRef = useActiveConfigStore((s) => s.quoteRef)
  const contact = useActiveConfigStore((s) => s.contact)
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
  const setNotes = useActiveConfigStore((s) => s.setNotes)
  const setContact = useActiveConfigStore((s) => s.setContact)
  const requestModele3D = useActiveConfigStore((s) => s.requestModele3D)
  const requestAcheter = useActiveConfigStore((s) => s.requestAcheter)
  const refreshQuoteRef = useActiveConfigStore((s) => s.refreshQuoteRef)

  const storeApi = useActiveConfigStoreApi()

  const unit = useMemo(
    () => units.find((u) => u.id === activeUnitId) || units[0],
    [units, activeUnitId],
  )

  const pricing = useMemo(
    () => storeApi.getState().getPricing(),
    [units, storeApi],
  )

  const impact = useMemo(
    () => storeApi.getState().getImpact(),
    [unit, storeApi],
  )

  const { t } = useI18n()
  const tId = useTId()
  const [flash, setFlash] = useState('')
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  /** Chip en cours de renommage (id meuble) */
  const [editingUnitId, setEditingUnitId] = useState(null)
  const renameInputRef = useRef(null)
  /**
   * Configurateur libre : Dimensions ouverte.
   * Session boutique (dimsLocked) : Dimensions + Agencements + Panneaux ouverts ;
   * section Meubles masquée (un seul modèle).
   */
  const [openSections, setOpenSections] = useState(() => ({
    meuble: false,
    dims: true,
    modules: !!dimsLocked,
    panneaux: !!dimsLocked,
    scene: false,
    contact: false,
    devis: false,
  }))

  // Si on entre en session boutique après le montage, ouvrir les bonnes sections
  useEffect(() => {
    if (!dimsLocked) return
    setOpenSections((s) => ({
      ...s,
      meuble: false,
      dims: true,
      modules: true,
      panneaux: true,
    }))
  }, [dimsLocked])

  useEffect(() => {
    if (editingUnitId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [editingUnitId])

  if (!unit) return null

  const toggle = (k) =>
    setOpenSections((s) => ({ ...s, [k]: !s[k] }))

  const notify = (msg) => {
    setFlash(msg)
    setTimeout(() => setFlash(''), 4200)
  }

  /** Index du meuble actif (0 = premier, non déplaçable) */
  const activeUnitIndex = units.findIndex((u) => u.id === activeUnitId)
  const isPrimaryUnit = activeUnitIndex <= 0
  const canShowPosition = activeUnitIndex >= 1

  return (
    <aside className={`control-panel${mobileOpen ? ' mobile-open' : ''}`}>
      <button
        type="button"
        className="panel-mobile-toggle"
        onClick={() => setMobileOpen((o) => !o)}
        aria-expanded={mobileOpen}
      >
        <span className="panel-mobile-handle" />
        <span>
          {mobileOpen ? t('config.hideOptions') : t('config.options')}
        </span>
        <span className="chev">{mobileOpen ? '▾' : '▴'}</span>
      </button>
      <div className="panel-scroll">
        {/* Meubles — masqué en session boutique (un seul modèle figé) */}
        {!dimsLocked && (
          <section className="panel-section">
            <button
              type="button"
              className="section-head"
              onClick={() => toggle('meuble')}
            >
              <span>{t('config.furniture')}</span>
              <span className="chev">{openSections.meuble ? '▾' : '▸'}</span>
            </button>
            {openSections.meuble && (
              <div className="section-body">
                <div className="unit-list">
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
                        {/^Meuble\s+\d+$/i.test(u.label || '')
                          ? t('config.unitN', { n: idx + 1 })
                          : u.label || t('config.unitN', { n: idx + 1 })}
                      </button>
                    ),
                  )}
                </div>
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
              </div>
            )}
          </section>
        )}

        {/* Dimensions — en boutique : L×P×H du modèle (figées) */}
        <section className="panel-section">
          <button type="button" className="section-head" onClick={() => toggle('dims')}>
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
                      {unit.dims.L} × {unit.dims.W} × {unit.dims.H}
                    </strong>{' '}
                    mm
                    <span className="muted"> {t('config.lwh')}</span>
                  </p>
                  <p className="muted" style={{ fontSize: '0.68rem', margin: 0 }}>
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
                    onChange={(L) => updateDims(unit.id, { L })}
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
                    step={10}
                    onChange={(x) => updatePosition(unit.id, { x })}
                  />
                  <SliderDim
                    label={t('config.posY')}
                    value={unit.positionMm.y}
                    min={-5000}
                    max={5000}
                    step={10}
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

        {/* Modules */}
        <section className="panel-section">
          <button type="button" className="section-head" onClick={() => toggle('modules')}>
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
                    onClick={() => addModule(k.id)}
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
                  const shelfExtrusion = areteExtrusionMm(unit.dims)
                  const shelfZMin = 22 + Number(EPAISSEUR_PANNEAU)
                  const shelfZMax =
                    unit.dims.H - 22 - shelfExtrusion
                  const drawerLayout =
                    m.kind === 'drawer'
                      ? moduleLayout(m, unit.dims, unit.modules)
                      : null
                  const wurth = drawerLayout?.wurth
                  const drawerZ = drawerLayout?.zBottomMm ?? drawerLayout?.zMm
                  const drawerZMin =
                    drawerLayout?.zMin ?? 22 + shelfExtrusion
                  const drawerZMax = drawerLayout?.zMax ?? unit.dims.H - 100
                  const depthTooSmall = Boolean(
                    drawerLayout?.depthTooSmall || wurth?.depthTooSmall,
                  )
                  return (
                    <li key={m.id} className="mod-item">
                      <div className="mod-head">
                        <span>
                          {tId(
                            'module',
                            m.kind,
                            MODULE_KINDS[m.kind]?.label || m.kind,
                          )}
                          {m.kind === 'drawer' ? ' · Würth B' : ''}
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
                          step={5}
                          onChange={(z) => setModuleZ(m.id, z)}
                        />
                      )}
                      {m.kind === 'drawer' && (
                        <>
                          {depthTooSmall ? (
                            <p className="drawer-warn" role="alert">
                              {t('config.drawerTooShallow', {
                                min: WURTH_PROFONDEUR_MIN_MM,
                              })}
                            </p>
                          ) : null}
                          <SliderDim
                            label={t('config.posZ')}
                            value={Math.round(
                              m.zMm != null ? m.zMm : drawerZ ?? drawerZMin,
                            )}
                            min={Math.round(drawerZMin)}
                            max={Math.round(drawerZMax)}
                            step={5}
                            onChange={(z) => setModuleZ(m.id, z)}
                          />
                          <label className="field compact">
                            <span className="field-label">{t('config.height')}</span>
                            <select
                              className="field-input"
                              value={m.hMm ?? wurth?.hMm ?? 110}
                              onChange={(e) =>
                                setModuleH(m.id, Number(e.target.value))
                              }
                            >
                              {WURTH_HAUTEURS_MM.map((h) => (
                                <option key={h} value={h}>
                                  {h} mm
                                </option>
                              ))}
                            </select>
                          </label>
                          <p className="muted drawer-dims-hint">
                            {t('config.depthAuto')}{' '}
                            <strong>
                              {depthTooSmall
                                ? `${wurth?.depthAvailableMm ?? 0} mm`
                                : `${wurth?.depthMm ?? '—'} mm`}
                            </strong>
                            {' · '}
                            LWS{' '}
                            <strong>{wurth?.licMm ?? '—'} mm</strong>
                            {wurth?.lwkMm != null && (
                              <>
                                {' '}
                                <span className="hint">
                                  (LWK {wurth.lwkMm} − 42)
                                </span>
                              </>
                            )}
                          </p>
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
          <button type="button" className="section-head" onClick={() => toggle('panneaux')}>
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
                        onClick={() =>
                          updateUnit(unit.id, { panneauCouleur: c.id })
                        }
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
                <label
                  className={`color-swatch-btn surmesure-btn${
                    unit.panneauCouleur === 'surmesure' ? ' active' : ''
                  }`}
                  title={t('config.customColor')}
                >
                  <span
                    className="color-swatch"
                    style={{
                      background:
                        unit.panneauCouleurHex || DEFAULT_PANNEAU_HEX,
                      backgroundImage:
                        unit.panneauCouleur === 'surmesure'
                          ? 'none'
                          : 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                    }}
                  />
                  <span className="color-swatch-label">{t('config.custom')}</span>
                  <input
                    type="color"
                    className="color-input-hidden"
                    value={unit.panneauCouleurHex || DEFAULT_PANNEAU_HEX}
                    onChange={(e) =>
                      updateUnit(unit.id, {
                        panneauCouleur: 'surmesure',
                        panneauCouleurHex: e.target.value,
                      })
                    }
                    onClick={() =>
                      updateUnit(unit.id, {
                        panneauCouleur: 'surmesure',
                        panneauCouleurHex:
                          unit.panneauCouleurHex || DEFAULT_PANNEAU_HEX,
                      })
                    }
                  />
                </label>
              </div>
            </div>
          )}
        </section>

        {/* Scène */}
        <section className="panel-section">
          <button type="button" className="section-head" onClick={() => toggle('scene')}>
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

        {/* Contact */}
        <section className="panel-section">
          <button type="button" className="section-head" onClick={() => toggle('contact')}>
            <span>{t('config.client')}</span>
            <span className="chev">{openSections.contact ? '▾' : '▸'}</span>
          </button>
          {openSections.contact && (
            <div className="section-body">
              {CLIENT_FIELDS.map((f) => (
                <label key={f.key} className="field">
                  <span className="field-label">{t(`client.${f.key}`)}</span>
                  <input
                    type={f.type}
                    value={contact[f.key] || ''}
                    onChange={(e) => setContact({ [f.key]: e.target.value })}
                  />
                </label>
              ))}
              <label className="field">
                <span className="field-label">{t('config.notes')}</span>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('config.notesPlaceholder')}
                />
              </label>
            </div>
          )}
        </section>

        {/* Achat / export */}
        <section className="panel-section">
          <button type="button" className="section-head" onClick={() => toggle('devis')}>
            <span>{t('config.buy')}</span>
            <span className="chev">{openSections.devis ? '▾' : '▸'}</span>
          </button>
          {openSections.devis && (
            <div className="section-body">
              <div className="quote-ref">
                <span>{t('config.ref')}</span>
                <strong>{quoteRef}</strong>
                <button type="button" className="btn-icon" onClick={refreshQuoteRef} title={t('config.newRef')}>
                  ↻
                </button>
              </div>
              <div className="price-block">
                <div>
                  <span>{t('config.totalHt')}</span>
                  <strong>{pricing.ht.toFixed(2)} €</strong>
                </div>
                <div>
                  <span>{t('config.vat')}</span>
                  <strong>{pricing.tva.toFixed(2)} €</strong>
                </div>
                <div className="ttc">
                  <span>{t('config.ttc')}</span>
                  <strong>{pricing.ttc.toFixed(2)} €</strong>
                </div>
              </div>
              {impact && (
                <div className="impact-block">
                  <p className="impact-title">{t('config.impact')}</p>
                  <p>
                    {t('config.impactLine1', {
                      wood: impact.woodKg.toFixed(1),
                      caisson: impact.caissonKg.toFixed(1),
                    })}
                  </p>
                  <p>
                    {t('config.impactLine2', {
                      gain: impact.gainKg.toFixed(1),
                      co2: impact.gainCO2.toFixed(1),
                    })}
                  </p>
                </div>
              )}
              <div className="row-actions col client-actions">
                <button
                  type="button"
                  className="btn primary"
                  disabled={checkoutBusy || pricing.ttc < 0.5}
                  onClick={async () => {
                    setCheckoutBusy(true)
                    notify(t('config.preparingPay'))
                    try {
                      const result = await requestAcheter()
                      if (result?.error) {
                        notify(result.error)
                        return
                      }
                      if (result?.url) {
                        notify(t('config.redirectStripe'))
                        return
                      }
                      notify(t('config.payUnavailable'))
                    } finally {
                      setCheckoutBusy(false)
                    }
                  }}
                >
                  {checkoutBusy
                    ? t('config.redirecting')
                    : t('config.buyPrice', { price: pricing.ttc.toFixed(0) })}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={async () => {
                    await requestModele3D()
                    notify(t('config.model3dDone'))
                  }}
                >
                  {t('config.model3d')}
                </button>
              </div>
              <p className="legal-hint">
                {t('config.legal')}
              </p>
            </div>
          )}
        </section>
      </div>
      {flash && <div className="panel-flash">{flash}</div>}
    </aside>
  )
}
