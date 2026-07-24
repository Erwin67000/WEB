import { useMemo, useState, useRef, useEffect } from 'react'
import { useActiveConfigStore, useActiveConfigStoreApi } from '../store/ConfigStoreContext.jsx'
import {
  FINITIONS_OSSATURE,
  FINITIONS_OSSATURE_CLIENT,
  PANNEAU_COULEURS,
  EPAISSEUR_PANNEAU,
  DEFAULT_PANNEAU_HEX,
} from '../1_STRUCTURE/00_matrice/matrice_constante.js'
import {
  MODULE_KINDS,
  ENVIRONMENTS,
} from '../1_STRUCTURE/00_matrice/matrice_configuration.js'
import { shelfZMm } from '../1_STRUCTURE/02_agencement/agencement.js'
import { DIM_LIMITS } from '../3_INPUT/matrice_input.js'
import { CLIENT_FIELDS } from '../3_INPUT/matrice_client.js'
import { FACE_PICK_DEFS } from '../1_STRUCTURE/02_agencement/FacePickPlanes.jsx'

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
  const togglePanneau = useActiveConfigStore((s) => s.togglePanneau)
  const setEnvironment = useActiveConfigStore((s) => s.setEnvironment)
  const setSun = useActiveConfigStore((s) => s.setSun)
  const setSunIntensity = useActiveConfigStore((s) => s.setSunIntensity)
  const setWireframe = useActiveConfigStore((s) => s.setWireframe)
  const setPanneauPickMode = useActiveConfigStore((s) => s.setPanneauPickMode)
  const setNotes = useActiveConfigStore((s) => s.setNotes)
  const setContact = useActiveConfigStore((s) => s.setContact)
  const requestDevis = useActiveConfigStore((s) => s.requestDevis)
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

  const [flash, setFlash] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  /** Chip en cours de renommage (id meuble) */
  const [editingUnitId, setEditingUnitId] = useState(null)
  const renameInputRef = useRef(null)
  /** Au départ : seule la section Dimensions est ouverte. */
  const [openSections, setOpenSections] = useState({
    meuble: false,
    dims: true,
    modules: false,
    panneaux: false,
    scene: false,
    contact: false,
    devis: false,
  })

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
          {mobileOpen ? 'Masquer les options' : 'Options & devis'}
        </span>
        <span className="chev">{mobileOpen ? '▾' : '▴'}</span>
      </button>
      <div className="panel-scroll">
        {/* Meubles */}
        <section className="panel-section">
          <button type="button" className="section-head" onClick={() => toggle('meuble')}>
            <span>Meubles</span>
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
                          ? 'Cliquer pour renommer'
                          : 'Sélectionner'
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
                      {u.label || `Meuble ${idx + 1}`}
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
                        result.reason ||
                          'Veuillez nous contacter via notre formulaire pour tout projet d’envergure',
                      )
                    }
                  }}
                >
                  + Meuble
                </button>
                <button
                  type="button"
                  className="btn-sm danger"
                  onClick={() => removeUnit(activeUnitId)}
                  disabled={units.length <= 1}
                >
                  Supprimer
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Dimensions */}
        <section className="panel-section">
          <button type="button" className="section-head" onClick={() => toggle('dims')}>
            <span>Dimensions</span>
            <span className="chev">{openSections.dims ? '▾' : '▸'}</span>
          </button>
          {openSections.dims && (
            <div className="section-body">
              <SliderDim
                label="Longueur (L)"
                value={unit.dims.L}
                min={DIM_LIMITS.L.min}
                max={DIM_LIMITS.L.max}
                step={DIM_LIMITS.L.step}
                onChange={(L) => updateDims(unit.id, { L })}
              />
              <SliderDim
                label="Profondeur (W)"
                value={unit.dims.W}
                min={DIM_LIMITS.W.min}
                max={DIM_LIMITS.W.max}
                step={DIM_LIMITS.W.step}
                onChange={(W) => updateDims(unit.id, { W })}
              />
              <SliderDim
                label="Hauteur (H)"
                value={unit.dims.H}
                min={DIM_LIMITS.H.min}
                max={DIM_LIMITS.H.max}
                step={DIM_LIMITS.H.step}
                onChange={(H) => updateDims(unit.id, { H })}
              />
              {canShowPosition && (
                <>
                  <SliderDim
                    label="Pos. X"
                    value={unit.positionMm.x}
                    min={-5000}
                    max={5000}
                    step={10}
                    onChange={(x) => updatePosition(unit.id, { x })}
                  />
                  <SliderDim
                    label="Pos. Y"
                    value={unit.positionMm.y}
                    min={-5000}
                    max={5000}
                    step={10}
                    onChange={(y) => updatePosition(unit.id, { y })}
                  />
                </>
              )}
              <NumFieldInline
                label="Rot. Z"
                value={unit.rotationZ}
                min={-180}
                max={180}
                step={5}
                unit="°"
                onChange={(rotationZ) => updateUnit(unit.id, { rotationZ })}
              />

              <p className="field-label" style={{ marginTop: '0.35rem' }}>
                Finition ossature
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
                      <span className="finish-choice-label">{f.label}</span>
                      <span
                        className="finish-choice-swatch"
                        style={{ background: f.previewColor }}
                        title={f.label}
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
            <span>Agencement</span>
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
                    + {k.label}
                  </button>
                ))}
              </div>
              {unit.modules.length === 0 && (
                <p className="muted">
                  Aucun module.
                </p>
              )}
              <ul className="mod-list">
                {unit.modules.map((m) => {
                  const zLayout =
                    m.kind === 'shelf'
                      ? shelfZMm(m, unit.dims, unit.modules)
                      : null
                  const zMin =
                    22 + Number(EPAISSEUR_PANNEAU) / 2
                  const zMax =
                    unit.dims.H - 22 - Number(EPAISSEUR_PANNEAU) / 2
                  return (
                    <li key={m.id} className="mod-item">
                      <div className="mod-head">
                        <span>
                          {MODULE_KINDS[m.kind]?.label || m.kind}
                        </span>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => removeModule(m.id)}
                          aria-label="Retirer"
                        >
                          ×
                        </button>
                      </div>
                      {m.kind === 'shelf' && (
                        <SliderDim
                          label="Position Z tablette"
                          value={Math.round(zLayout)}
                          min={Math.round(zMin)}
                          max={Math.round(zMax)}
                          step={5}
                          onChange={(z) => setModuleZ(m.id, z)}
                        />
                      )}
                      {(m.kind === 'drawer' || m.kind === 'door') && (
                        <label className="field compact">
                          <span className="field-label">Ouverture</span>
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
            <span>Panneaux</span>
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
                  ? '✓ Terminer (faces)'
                  : '+ Ajouter un panneau'}
              </button>
              {panneauPickMode && (
                <p className="pick-hint">
                  Cliquez une <strong>face du meuble</strong> dans la vue 3D.
                  Recliquez pour retirer.
                </p>
              )}

              {(unit.panneaux || []).length > 0 ? (
                <div className="panneau-chips">
                  {(unit.panneaux || []).map((id) => (
                    <button
                      key={id}
                      type="button"
                      className="panneau-chip"
                      title="Retirer"
                      onClick={() => togglePanneau(id)}
                    >
                      {PANNEAU_CHIP_LABELS[id] || id}
                      <span aria-hidden>×</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted">Aucun panneau</p>
              )}

              <p className="field-label" style={{ marginTop: '0.35rem' }}>
                Couleur des panneaux
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
                        title={c.label}
                        onClick={() =>
                          updateUnit(unit.id, { panneauCouleur: c.id })
                        }
                      >
                        <span
                          className="color-swatch"
                          style={{ background: c.color }}
                        />
                        <span className="color-swatch-label">{c.label}</span>
                      </button>
                    )
                  })}
                <label
                  className={`color-swatch-btn surmesure-btn${
                    unit.panneauCouleur === 'surmesure' ? ' active' : ''
                  }`}
                  title="Sur mesure — spectre RVB"
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
                  <span className="color-swatch-label">Sur mesure</span>
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
            <span>Scène 3D</span>
            <span className="chev">{openSections.scene ? '▾' : '▸'}</span>
          </button>
          {openSections.scene && (
            <div className="section-body">
              <label className="field">
                <span className="field-label">Environnement</span>
                <select
                  value={environmentId}
                  onChange={(e) => setEnvironment(e.target.value)}
                >
                  {Object.values(ENVIRONMENTS).map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.label}
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
                Soleil
              </label>
              {sunEnabled && (
                <label className="field compact">
                  <span className="field-label">Intensité {sunIntensity.toFixed(1)}</span>
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
            <span>Client</span>
            <span className="chev">{openSections.contact ? '▾' : '▸'}</span>
          </button>
          {openSections.contact && (
            <div className="section-body">
              {CLIENT_FIELDS.map((f) => (
                <label key={f.key} className="field">
                  <span className="field-label">{f.label}</span>
                  <input
                    type={f.type}
                    value={contact[f.key] || ''}
                    onChange={(e) => setContact({ [f.key]: e.target.value })}
                  />
                </label>
              ))}
              <label className="field">
                <span className="field-label">Notes</span>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex. Buffet bas 2 tiroirs signature Philae"
                />
              </label>
            </div>
          )}
        </section>

        {/* Devis */}
        <section className="panel-section">
          <button type="button" className="section-head" onClick={() => toggle('devis')}>
            <span>Devis & export</span>
            <span className="chev">{openSections.devis ? '▾' : '▸'}</span>
          </button>
          {openSections.devis && (
            <div className="section-body">
              <div className="quote-ref">
                <span>Réf.</span>
                <strong>{quoteRef}</strong>
                <button type="button" className="btn-icon" onClick={refreshQuoteRef} title="Nouvelle réf.">
                  ↻
                </button>
              </div>
              <div className="price-block">
                <div>
                  <span>Total HT</span>
                  <strong>{pricing.ht.toFixed(2)} €</strong>
                </div>
                <div>
                  <span>TVA 20 %</span>
                  <strong>{pricing.tva.toFixed(2)} €</strong>
                </div>
                <div className="ttc">
                  <span>TTC indicatif</span>
                  <strong>{pricing.ttc.toFixed(2)} €</strong>
                </div>
              </div>
              {impact && (
                <div className="impact-block">
                  <p className="impact-title">Impact (indicatif)</p>
                  <p>
                    Ossature ~{impact.woodKg.toFixed(1)} kg · Caisson ~{impact.caissonKg.toFixed(1)} kg
                  </p>
                  <p>
                    Gain matière ~{impact.gainKg.toFixed(1)} kg · CO₂e ~{impact.gainCO2.toFixed(1)} kg
                  </p>
                </div>
              )}
              <div className="row-actions col client-actions">
                <button
                  type="button"
                  className="btn primary"
                  onClick={async () => {
                    const result = await requestDevis()
                    notify(
                      result?.emailed
                        ? 'Devis préparé — client mail ouvert'
                        : 'Devis téléchargé (HTML + photo)',
                    )
                  }}
                >
                  Devis ({pricing.ttc.toFixed(0)} € TTC)
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={async () => {
                    await requestModele3D()
                    notify('Demande modèle 3D (45 €) préparée')
                  }}
                >
                  Modèle 3D (45 €)
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const result = requestAcheter()
                    notify(
                      result?.url
                        ? 'Redirection boutique…'
                        : 'Achat en ligne : bientôt disponible',
                    )
                  }}
                >
                  Acheter
                </button>
              </div>
              <p className="legal-hint">
                Prix indicatifs. Le devis résume meubles, dimensions, aménagements
                et panneaux. Contact : contact@philae.design
              </p>
            </div>
          )}
        </section>
      </div>
      {flash && <div className="panel-flash">{flash}</div>}
    </aside>
  )
}
