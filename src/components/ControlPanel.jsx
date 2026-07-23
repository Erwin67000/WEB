import { useMemo, useState } from 'react'
import { useActiveConfigStore, useActiveConfigStoreApi } from '../store/ConfigStoreContext.jsx'
import {
  FINITIONS,
  FINITIONS_OSSATURE,
  PANNEAU_COULEURS,
  EPAISSEUR_PANNEAU,
} from '../1_STRUCTURE/00_matrice/matrice_constante.js'
import {
  MODULE_KINDS,
  ENVIRONMENTS,
} from '../1_STRUCTURE/00_matrice/matrice_configuration.js'
import { shelfZMm } from '../1_STRUCTURE/02_agencement/agencement.js'
import { DIM_LIMITS } from '../3_INPUT/matrice_input.js'
import { CLIENT_FIELDS } from '../3_INPUT/matrice_client.js'
import {
  EPAISSEURS_PANNEAU,
  EPAISSEURS_PORTE,
} from '../3_INPUT/master_input.js'

import { PANNEAU_DEFS } from '../1_STRUCTURE/00_matrice/matrice_panneau_grok.js'

/** Labels UI — alignés sur les clés de PANNEAU_DEFS */
const PANNEAU_LABELS = {
  fond: 'Fond',
  porte: 'Porte',
  dessous: 'Dessous',
  joue1: 'Joue 1',
  joue2: 'Joue 2',
}

/** Dessus : exclusif (aucun | intérieur | extérieur) */
const DESSUS_OPTIONS = [
  { id: null, label: 'Aucun' },
  { id: 'dessus_interieur', label: 'Dessus intérieur' },
  { id: 'dessus_exterieur', label: 'Dessus extérieur' },
]

function NumField({ label, value, onChange, min, max, step = 1, unit = 'mm' }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <div className="field-input-row">
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
    </label>
  )
}

/** Slider + saisie numérique (Longueur / Profondeur / Hauteur / Z tablette). */
function SliderDim({ label, value, onChange, min, max, step = 5, unit = 'mm' }) {
  return (
    <label className="field slider-dim">
      <span className="field-label">
        {label}{' '}
        <strong className="slider-val">
          {value}
          {unit}
        </strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="field-input-row">
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
  const showPanneauRectangles = useActiveConfigStore((s) => s.showPanneauRectangles)
  const showPanneauRectFaces = useActiveConfigStore((s) => s.showPanneauRectFaces)
  const showPanneauSolid = useActiveConfigStore((s) => s.showPanneauSolid)
  const epaisseurPanneau = useActiveConfigStore((s) => s.epaisseurPanneau)
  const epaisseurPorte = useActiveConfigStore((s) => s.epaisseurPorte)
  const notes = useActiveConfigStore((s) => s.notes)
  const quoteRef = useActiveConfigStore((s) => s.quoteRef)
  const contact = useActiveConfigStore((s) => s.contact)

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
  const setDessusVariant = useActiveConfigStore((s) => s.setDessusVariant)
  const setEnvironment = useActiveConfigStore((s) => s.setEnvironment)
  const setSun = useActiveConfigStore((s) => s.setSun)
  const setSunIntensity = useActiveConfigStore((s) => s.setSunIntensity)
  const setWireframe = useActiveConfigStore((s) => s.setWireframe)
  const setShowPanneauRectangles = useActiveConfigStore(
    (s) => s.setShowPanneauRectangles,
  )
  const setShowPanneauRectFaces = useActiveConfigStore(
    (s) => s.setShowPanneauRectFaces,
  )
  const setShowPanneauSolid = useActiveConfigStore((s) => s.setShowPanneauSolid)
  const setEpaisseurPanneau = useActiveConfigStore((s) => s.setEpaisseurPanneau)
  const setEpaisseurPorte = useActiveConfigStore((s) => s.setEpaisseurPorte)
  const setNotes = useActiveConfigStore((s) => s.setNotes)
  const setContact = useActiveConfigStore((s) => s.setContact)
  const downloadJSON = useActiveConfigStore((s) => s.downloadJSON)
  const downloadMasterCsv = useActiveConfigStore((s) => s.downloadMasterCsv)
  const requestDevis = useActiveConfigStore((s) => s.requestDevis)
  const requestCNC = useActiveConfigStore((s) => s.requestCNC)
  const addToCart = useActiveConfigStore((s) => s.addToCart)
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
  const [openSections, setOpenSections] = useState({
    meuble: true,
    dims: true,
    modules: true,
    panneaux: true,
    scene: true,
    contact: false,
    devis: true,
  })

  if (!unit) return null

  const toggle = (k) =>
    setOpenSections((s) => ({ ...s, [k]: !s[k] }))

  const notify = (msg) => {
    setFlash(msg)
    setTimeout(() => setFlash(''), 2800)
  }

  return (
    <aside className="control-panel">
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
                {units.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className={`unit-chip ${u.id === activeUnitId ? 'active' : ''}`}
                    onClick={() => setActiveUnit(u.id)}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
              <div className="row-actions">
                <button type="button" className="btn-sm" onClick={addUnit}>
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
              <label className="field">
                <span className="field-label">Libellé</span>
                <input
                  type="text"
                  value={unit.label}
                  onChange={(e) => updateUnit(unit.id, { label: e.target.value })}
                />
              </label>
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
              <div className="field-grid-3">
                <NumField
                  label="Pos. X"
                  value={unit.positionMm.x}
                  min={-5000}
                  max={5000}
                  step={10}
                  onChange={(x) => updatePosition(unit.id, { x })}
                />
                <NumField
                  label="Pos. Y"
                  value={unit.positionMm.y}
                  min={-5000}
                  max={5000}
                  step={10}
                  onChange={(y) => updatePosition(unit.id, { y })}
                />
                <NumField
                  label="Rot. Z"
                  value={unit.rotationZ}
                  min={-180}
                  max={180}
                  step={5}
                  unit="°"
                  onChange={(rotationZ) => updateUnit(unit.id, { rotationZ })}
                />
              </div>
              <label className="field">
                <span className="field-label">Essence bois</span>
                <select
                  value={unit.woodFinish}
                  onChange={(e) =>
                    updateUnit(unit.id, { woodFinish: e.target.value })
                  }
                >
                  {Object.values(FINITIONS).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Finition ossature</span>
                <select
                  value={unit.ossatureFinish || 'brut'}
                  onChange={(e) =>
                    updateUnit(unit.id, { ossatureFinish: e.target.value })
                  }
                >
                  {Object.values(FINITIONS_OSSATURE).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">
                  Note finition (libre → matrice)
                </span>
                <textarea
                  rows={2}
                  value={unit.ossatureFinitionNote || ''}
                  onChange={(e) =>
                    updateUnit(unit.id, {
                      ossatureFinitionNote: e.target.value,
                    })
                  }
                  placeholder="Ex. vernis mat satiné, teinte sur échantillon atelier…"
                />
              </label>
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
                  Aucun module — tablette ou tiroir. La porte façade = panneau « Porte ».
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
            <div className="section-body">
              <p className="muted" style={{ marginBottom: '0.35rem' }}>
                Couleur unique pour tous les panneaux de cette configuration
              </p>
              <div className="color-swatch-grid">
                {Object.values(PANNEAU_COULEURS).map((c) => {
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
              </div>

              <p className="muted" style={{ margin: '0.65rem 0 0.35rem' }}>
                Panneaux — 4 rectangles chacun (base / décalé / tolérance / arrière)
              </p>
              <label className="check-item">
                <input
                  type="checkbox"
                  checked={showPanneauRectangles}
                  onChange={(e) => setShowPanneauRectangles(e.target.checked)}
                />
                Rectangles (base / décalé / tolérance / arrière)
              </label>
              <label className="check-item">
                <input
                  type="checkbox"
                  checked={showPanneauRectFaces}
                  onChange={(e) => setShowPanneauRectFaces(e.target.checked)}
                  disabled={!showPanneauRectangles}
                />
                Faces semi-transparentes
              </label>
              <label className="check-item">
                <input
                  type="checkbox"
                  checked={showPanneauSolid}
                  onChange={(e) => setShowPanneauSolid(e.target.checked)}
                />
                Solide 3D panneau (par-dessus)
              </label>

              <p className="muted" style={{ margin: '0.5rem 0 0.25rem' }}>
                Épaisseurs (mm)
              </p>
              <label className="field">
                <span className="field-label">Épaisseur panneau</span>
                <select
                  value={epaisseurPanneau}
                  onChange={(e) => setEpaisseurPanneau(Number(e.target.value))}
                >
                  {EPAISSEURS_PANNEAU.map((v) => (
                    <option key={v} value={v}>
                      {v} mm
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Épaisseur porte</span>
                <select
                  value={epaisseurPorte}
                  onChange={(e) => setEpaisseurPorte(Number(e.target.value))}
                >
                  {EPAISSEURS_PORTE.map((v) => (
                    <option key={v} value={v}>
                      {v} mm
                    </option>
                  ))}
                </select>
              </label>

              <div className="muted" style={{ fontSize: '0.72rem', lineHeight: 1.45 }}>
                <span style={{ color: '#4cc9f0' }}>■</span> base &nbsp;
                <span style={{ color: '#f72585' }}>■</span> décalé &nbsp;
                <span style={{ color: '#ffd60a' }}>■</span> tolérance &nbsp;
                <span style={{ color: '#80ed99' }}>■</span> arrière
              </div>

              <p className="muted" style={{ margin: '0.65rem 0 0.3rem' }}>
                Panneaux (toggle true/false — aucun au départ)
              </p>
              <div className="check-grid">
                {Object.entries(PANNEAU_LABELS).map(([id, label]) => {
                  const defined = Boolean(PANNEAU_DEFS[id])
                  const swatch = PANNEAU_DEFS[id]?.couleur
                  return (
                    <label
                      key={id}
                      className="check-item"
                      title={defined ? label : `${label} — à venir`}
                    >
                      <input
                        type="checkbox"
                        checked={unit.panneaux.includes(id)}
                        onChange={() => togglePanneau(id)}
                        disabled={!defined}
                      />
                      {swatch && (
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 2,
                            background: swatch,
                            display: 'inline-block',
                            flexShrink: 0,
                          }}
                        />
                      )}
                      {label}
                      {!defined && <span className="muted"> …</span>}
                    </label>
                  )
                })}
              </div>

              <p className="muted" style={{ margin: '0.65rem 0 0.3rem' }}>
                Dessus (un seul, ou aucun)
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {DESSUS_OPTIONS.map((opt) => {
                  const active = opt.id
                    ? unit.panneaux.includes(opt.id)
                    : !unit.panneaux.includes('dessus_interieur') &&
                      !unit.panneaux.includes('dessus_exterieur')
                  const swatch = opt.id ? PANNEAU_DEFS[opt.id]?.couleur : null
                  return (
                    <label key={opt.label} className="check-item">
                      <input
                        type="radio"
                        name="dessus-variant"
                        checked={active}
                        onChange={() => setDessusVariant(opt.id)}
                        disabled={opt.id ? !PANNEAU_DEFS[opt.id] : false}
                      />
                      {swatch && (
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 2,
                            background: swatch,
                            display: 'inline-block',
                          }}
                        />
                      )}
                      {opt.label}
                    </label>
                  )
                })}
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
              <label className="check-item">
                <input
                  type="checkbox"
                  checked={wireframe}
                  onChange={(e) => setWireframe(e.target.checked)}
                />
                Filaire
              </label>
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
              <div className="row-actions col">
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    requestDevis()
                    notify('Demande de devis exportée')
                  }}
                >
                  Demander un devis
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    downloadJSON()
                    notify('Configuration JSON téléchargée')
                  }}
                >
                  Export JSON
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    downloadMasterCsv()
                    notify('master_input CSV exporté')
                  }}
                >
                  Export master_input CSV
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    requestCNC('Demande CNC depuis configurateur')
                    notify('Demande CNC exportée')
                  }}
                >
                  Demande CNC
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    addToCart()
                    notify('Ajouté au panier')
                  }}
                >
                  Ajouter au panier
                </button>
              </div>
              <p className="legal-hint">
                Prix indicatifs, merci de nous transmettre votre demande de configuration pour analyse.
                Contact : contact@philae.design
              </p>
            </div>
          )}
        </section>
      </div>
      {flash && <div className="panel-flash">{flash}</div>}
    </aside>
  )
}
