import { create } from 'zustand'
import {
  defaultUnit,
  defaultContact,
  makeQuoteRef,
  uid,
  ENVIRONMENTS,
} from '../1_STRUCTURE/00_matrice/matrice_configuration.js'
import {
  createModule,
  modulePriceHT,
} from '../1_STRUCTURE/02_agencement/agencement.js'
import { Meuble } from '../1_STRUCTURE/01_meuble3D/ossature.js'
import {
  PRIX_METRE_ARETE,
  PRIX_M2_PANNEAU,
  TVA,
  DENSITE_BOIS_TENDRE,
  DENSITE_MELAMINE,
  CO2E_BOIS,
  CO2E_MELAMINE,
  EPAISSEUR_PANNEAU,
  EPAISSEUR_PORTE,
} from '../1_STRUCTURE/00_matrice/matrice_constante.js'
import {
  downloadMasterInputCsv,
  downloadMasterInputJson,
  EPAISSEURS_PANNEAU,
  EPAISSEURS_PORTE,
} from '../3_INPUT/master_input.js'
import {
  parseModulesSpec,
  parsePanneauxSpec,
} from '../1_STRUCTURE/00_matrice/matrice_catalogue.js'

const parseModulesInline = parseModulesSpec
const parsePanneauxInline = parsePanneauxSpec

export function computePricing(units) {
  let ht = 0
  for (const u of units) {
    const m = new Meuble(u.dims)
    const edgeM = m.totalEdgeLengthMm / 1000
    ht += edgeM * PRIX_METRE_ARETE
    const { L, W, H } = u.dims
    const panelM2 =
      ((u.panneaux || []).length / 6) * 2 * ((L * W + W * H + L * H) / 1e6)
    ht += panelM2 * PRIX_M2_PANNEAU * 0.35
    for (const mod of u.modules || []) {
      ht += modulePriceHT(mod, u.dims)
    }
  }
  const tva = ht * TVA
  return { ht, tva, ttc: ht + tva }
}

export function computeImpact(unit) {
  const { L, W, H } = unit.dims
  const m = new Meuble(unit.dims)
  const woodKg = m.woodVolumeM3 * DENSITE_BOIS_TENDRE
  const panelM2 = 2 * ((L * W + W * H + L * H) / 1e6)
  const caissonKg = panelM2 * 0.019 * DENSITE_MELAMINE
  return {
    panelM2,
    woodKg,
    caissonKg,
    woodCO2: woodKg * CO2E_BOIS,
    caissonCO2: caissonKg * CO2E_MELAMINE,
    gainKg: caissonKg - woodKg,
    gainCO2: caissonKg * CO2E_MELAMINE - woodKg * CO2E_BOIS,
  }
}

/** Snapshot sérialisable pour transfer session → main (une seule version main). */
export function snapshotFromState(s) {
  return {
    units: structuredClone(s.units),
    activeUnitId: s.activeUnitId,
    environmentId: s.environmentId,
    sunEnabled: s.sunEnabled,
    sunIntensity: s.sunIntensity,
    showGrid: s.showGrid,
    wireframe: s.wireframe,
    showPanneauRectangles: s.showPanneauRectangles,
    showPanneauRectFaces: s.showPanneauRectFaces,
    showPanneauSolid: s.showPanneauSolid,
    epaisseurPanneau: s.epaisseurPanneau,
    epaisseurPorte: s.epaisseurPorte,
    notes: s.notes,
    // contact du main n'est pas écrasé par défaut — géré dans hydrate
    contact: structuredClone(s.contact),
    quoteRef: s.quoteRef,
  }
}

/**
 * Crée un store matrice (main ou session boutique).
 * @param {{ name?: string }} opts
 */
export function createConfigStore(opts = {}) {
  const first = defaultUnit()

  return create((set, get) => ({
    /** Identifiant logique : 'main' | 'boutique-session' */
    storeName: opts.name || 'config',

    units: [first],
    activeUnitId: first.id,
    environmentId: 'none',
    sunEnabled: true,
    sunIntensity: 2.5,
    showGrid: true,
    wireframe: false,
    showPanneauRectangles: true,
    showPanneauRectFaces: true,
    showPanneauSolid: true,
    epaisseurPanneau: Number(EPAISSEUR_PANNEAU),
    epaisseurPorte: Number(EPAISSEUR_PORTE),
    contact: defaultContact(),
    notes: '',
    quoteRef: makeQuoteRef(),
    cartCount: 0,
    lang: 'FR',
    selection: null,
    /** id catalogue si session boutique */
    catalogProductId: null,
    dirty: false,

    getActiveUnit: () => {
      const { units, activeUnitId } = get()
      return units.find((u) => u.id === activeUnitId) || units[0]
    },

    getPricing: () => computePricing(get().units),
    getImpact: () => {
      const u = get().getActiveUnit()
      return u ? computeImpact(u) : null
    },

    setActiveUnit: (id) => set({ activeUnitId: id, dirty: true }),

    addUnit: () => {
      const n = get().units.length + 1
      const prev = get().getActiveUnit()
      const unit = defaultUnit({
        label: `Meuble ${n}`,
        positionMm: {
          x: (prev?.positionMm?.x || 0) + (prev?.dims?.L || 600) + 80,
          y: 0,
          z: 0,
        },
      })
      set((s) => ({
        units: [...s.units, unit],
        activeUnitId: unit.id,
        dirty: true,
      }))
    },

    removeUnit: (id) =>
      set((s) => {
        if (s.units.length <= 1) return s
        const units = s.units.filter((u) => u.id !== id)
        return {
          units,
          activeUnitId:
            s.activeUnitId === id ? units[0].id : s.activeUnitId,
          dirty: true,
        }
      }),

    updateUnit: (id, patch) =>
      set((s) => ({
        units: s.units.map((u) => (u.id === id ? { ...u, ...patch } : u)),
        dirty: true,
      })),

    updateDims: (id, dims) =>
      set((s) => ({
        units: s.units.map((u) =>
          u.id === id ? { ...u, dims: { ...u.dims, ...dims } } : u,
        ),
        dirty: true,
      })),

    updatePosition: (id, positionMm) =>
      set((s) => ({
        units: s.units.map((u) =>
          u.id === id
            ? { ...u, positionMm: { ...u.positionMm, ...positionMm } }
            : u,
        ),
        dirty: true,
      })),

    addModule: (kind) => {
      const id = get().activeUnitId
      set((s) => ({
        units: s.units.map((u) => {
          if (u.id !== id) return u
          const bayIndex = u.modules.filter((m) => m.kind === kind).length
          return {
            ...u,
            modules: [...u.modules, createModule(kind, bayIndex)],
          }
        }),
        dirty: true,
      }))
    },

    removeModule: (modId) => {
      const id = get().activeUnitId
      set((s) => ({
        units: s.units.map((u) =>
          u.id !== id
            ? u
            : { ...u, modules: u.modules.filter((m) => m.id !== modId) },
        ),
        dirty: true,
      }))
    },

    setModuleOpen: (modId, openFactor) => {
      const id = get().activeUnitId
      set((s) => ({
        units: s.units.map((u) =>
          u.id !== id
            ? u
            : {
                ...u,
                modules: u.modules.map((m) =>
                  m.id === modId ? { ...m, openFactor } : m,
                ),
              },
        ),
        dirty: true,
      }))
    },

    /** Position Z (mm) d’une tablette — depuis le sol du meuble. */
    setModuleZ: (modId, zMm) => {
      const id = get().activeUnitId
      set((s) => ({
        units: s.units.map((u) =>
          u.id !== id
            ? u
            : {
                ...u,
                modules: u.modules.map((m) =>
                  m.id === modId
                    ? { ...m, zMm: Number.isFinite(zMm) ? zMm : null }
                    : m,
                ),
              },
        ),
        dirty: true,
      }))
    },

    togglePanneau: (nom) => {
      const id = get().activeUnitId
      const exclusifs = {
        dessus: ['dessus_interieur', 'dessus_exterieur'],
      }
      set((s) => ({
        units: s.units.map((u) => {
          if (u.id !== id) return u
          const has = u.panneaux.includes(nom)
          if (has) {
            return {
              ...u,
              panneaux: u.panneaux.filter((p) => p !== nom),
            }
          }
          let next = [...u.panneaux, nom]
          for (const group of Object.values(exclusifs)) {
            if (group.includes(nom)) {
              next = next.filter((p) => p === nom || !group.includes(p))
            }
          }
          return { ...u, panneaux: next }
        }),
        dirty: true,
      }))
    },

    setDessusVariant: (variant) => {
      const id = get().activeUnitId
      const group = ['dessus_interieur', 'dessus_exterieur']
      set((s) => ({
        units: s.units.map((u) => {
          if (u.id !== id) return u
          const without = u.panneaux.filter((p) => !group.includes(p))
          if (!variant) return { ...u, panneaux: without }
          return { ...u, panneaux: [...without, variant] }
        }),
        dirty: true,
      }))
    },

    setEnvironment: (environmentId) => {
      const env = ENVIRONMENTS[environmentId]
      set({
        environmentId,
        showGrid: env?.grid ?? environmentId === 'none',
        dirty: true,
      })
    },

    setSun: (sunEnabled) => set({ sunEnabled, dirty: true }),
    setSunIntensity: (sunIntensity) => set({ sunIntensity, dirty: true }),
    setWireframe: (wireframe) => set({ wireframe, dirty: true }),
    setShowPanneauRectangles: (showPanneauRectangles) =>
      set({ showPanneauRectangles, dirty: true }),
    setShowPanneauRectFaces: (showPanneauRectFaces) =>
      set({ showPanneauRectFaces, dirty: true }),
    setShowPanneauSolid: (showPanneauSolid) =>
      set({ showPanneauSolid, dirty: true }),
    setEpaisseurPanneau: (epaisseurPanneau) => {
      const n = Number(epaisseurPanneau)
      if (!EPAISSEURS_PANNEAU.includes(n)) return
      set({ epaisseurPanneau: n, dirty: true })
    },
    setEpaisseurPorte: (epaisseurPorte) => {
      const n = Number(epaisseurPorte)
      if (!EPAISSEURS_PORTE.includes(n)) return
      set({ epaisseurPorte: n, dirty: true })
    },
    setNotes: (notes) => set({ notes, dirty: true }),
    setContact: (patch) =>
      set((s) => ({ contact: { ...s.contact, ...patch }, dirty: true })),
    refreshQuoteRef: () => set({ quoteRef: makeQuoteRef(), dirty: true }),
    addToCart: () => set((s) => ({ cartCount: s.cartCount + 1 })),

    getSnapshot: () => snapshotFromState(get()),

    /**
     * Remplace l’état config (main) par un snapshot de session.
     * Conserve contact + cartCount + lang du main (une seule version meuble).
     */
    hydrateFromSnapshot: (snap, { keepContact = true } = {}) => {
      if (!snap?.units?.length) return
      const prev = get()
      set({
        units: structuredClone(snap.units),
        activeUnitId: snap.activeUnitId || snap.units[0].id,
        environmentId: snap.environmentId || 'none',
        sunEnabled: snap.sunEnabled ?? true,
        sunIntensity: snap.sunIntensity ?? 2.5,
        showGrid: snap.showGrid ?? true,
        wireframe: snap.wireframe ?? false,
        showPanneauRectangles: snap.showPanneauRectangles ?? true,
        showPanneauRectFaces: snap.showPanneauRectFaces ?? true,
        showPanneauSolid: snap.showPanneauSolid ?? true,
        epaisseurPanneau: snap.epaisseurPanneau ?? Number(EPAISSEUR_PANNEAU),
        epaisseurPorte: snap.epaisseurPorte ?? Number(EPAISSEUR_PORTE),
        notes: snap.notes ?? '',
        quoteRef: snap.quoteRef || makeQuoteRef(),
        contact: keepContact
          ? prev.contact
          : structuredClone(snap.contact || defaultContact()),
        catalogProductId: null,
        dirty: false,
      })
    },

    /**
     * Réinitialise depuis une ligne matrice_catalogue (base figée).
     * Environnement vide, un seul meuble, paramètres de la ligne CSV.
     * Accepte modules/panneaux déjà normalisés (array) ou specs string.
     */
    loadFromCatalogRow: (row) => {
      if (!row) return
      // Import dynamique évité : normalise ici
      let modules = row.modules
      if (typeof modules === 'string' || !Array.isArray(modules)) {
        modules = parseModulesInline(row.modules_spec || row.modules)
      } else {
        modules = modules.map((m, i) => ({
          id: m.id || `mod-${row.id}-${i}`,
          kind: m.kind,
          bayIndex: m.bayIndex ?? i,
          openFactor: m.openFactor ?? 0,
        }))
      }
      let panneaux = row.panneaux
      if (typeof panneaux === 'string' || !Array.isArray(panneaux)) {
        panneaux = parsePanneauxInline(row.panneaux_spec || row.panneaux)
      } else {
        panneaux = [...panneaux]
      }

      const unit = defaultUnit({
        label: row.name,
        dims: { L: row.L_mm, W: row.W_mm, H: row.H_mm },
        woodFinish: row.wood_finish || 'chene',
        modules,
        panneaux,
        positionMm: { x: 0, y: 0, z: 0 },
        rotationZ: 0,
      })
      set({
        units: [unit],
        activeUnitId: unit.id,
        environmentId: 'none',
        showGrid: true,
        sunEnabled: true,
        sunIntensity: 2.5,
        wireframe: false,
        showPanneauRectangles: true,
        showPanneauRectFaces: true,
        showPanneauSolid: true,
        epaisseurPanneau: Number(EPAISSEUR_PANNEAU),
        epaisseurPorte: Number(EPAISSEUR_PORTE),
        notes: row.short_description || '',
        quoteRef: makeQuoteRef(),
        catalogProductId: row.id,
        dirty: false,
      })
    },

    exportEnsemble: () => {
      const s = get()
      return {
        options: {
          units: s.units.map((u) => ({
            ...u,
            // champs matrice finition / couleur panneau
            ossatureFinish: u.ossatureFinish || 'brut',
            ossatureFinitionNote: u.ossatureFinitionNote || '',
            panneauCouleur: u.panneauCouleur || 'gris_cendre',
          })),
          activeUnitId: s.activeUnitId,
          environmentId: s.environmentId,
          sunEnabled: s.sunEnabled,
          sunIntensity: s.sunIntensity,
          contact: s.contact,
          notes: s.notes,
          quoteRef: s.quoteRef,
          epaisseurPanneau: s.epaisseurPanneau,
          epaisseurPorte: s.epaisseurPorte,
          visitorId: uid('VIS'),
          catalogProductId: s.catalogProductId,
        },
        units: s.units.map((u) => ({
          ...u,
          ossature: new Meuble(u.dims).toJSON(),
        })),
        pricing: computePricing(s.units),
        exportedAt: new Date().toISOString(),
      }
    },

    downloadJSON: () => {
      const data = get().exportEnsemble()
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `philae-ensemble-${get().quoteRef}.json`
      a.click()
      URL.revokeObjectURL(a.href)
    },

    downloadMasterCsv: () => downloadMasterInputCsv(get()),
    downloadMasterJson: () => downloadMasterInputJson(get()),

    requestDevis: () => {
      const s = get()
      const pricing = computePricing(s.units)
      const payload = {
        requestType: 'devis',
        quoteRef: s.quoteRef,
        contact: s.contact,
        notes: s.notes,
        units: s.units,
        pricing,
        status: 'devis_sur_demande',
        createdAt: new Date().toISOString(),
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `Philae_Devis_${s.quoteRef}.json`
      a.click()
      URL.revokeObjectURL(a.href)
      return payload
    },

    requestCNC: (message = '') => {
      const s = get()
      const unit = s.getActiveUnit()
      const payload = {
        selection: s.selection || { level: 'unit', unitId: unit?.id },
        requestType: 'cnc',
        message,
        quoteRef: s.quoteRef,
        contact: s.contact,
        unit,
        createdAt: new Date().toISOString(),
        status: 'devis_sur_demande',
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `philae-demande-${s.quoteRef}-cnc.json`
      a.click()
      URL.revokeObjectURL(a.href)
      return payload
    },
  }))
}
