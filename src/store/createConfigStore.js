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
  modulePriceBreakdown,
} from '../1_STRUCTURE/02_agencement/agencement.js'
import { Meuble } from '../1_STRUCTURE/01_meuble3D/ossature.js'
import {
  PRIX,
  TVA,
  DENSITE_BOIS_TENDRE,
  DENSITE_MELAMINE,
  CO2E_BOIS,
  CO2E_MELAMINE,
  EPAISSEUR_PANNEAU,
  EPAISSEUR_PORTE,
  BOUTIQUE_CHECKOUT_URL,
} from '../1_STRUCTURE/00_matrice/matrice_constante.js'
import {
  captureViewportScreenshot,
  buildDevisHtml,
  downloadBlob,
  openMailtoDevis,
} from './devisExport.js'
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

/** Surface m² d’un panneau selon son type et les dims (mm). */
export function panneauSurfaceM2(nom, dims) {
  const { L, W, H } = dims
  if (nom === 'fond' || nom === 'porte') return (L * H) / 1e6
  if (nom === 'joue1' || nom === 'joue2') return (W * H) / 1e6
  if (
    nom === 'dessus' ||
    nom === 'dessus_interieur' ||
    nom === 'dessus_exterieur' ||
    nom === 'dessous'
  ) {
    return (L * W) / 1e6
  }
  return (L * H) / 1e6
}

const PANNEAU_LABELS = {
  fond: 'Fond',
  porte: 'Porte',
  dessous: 'Dessous',
  joue1: 'Joue 1',
  joue2: 'Joue 2',
  dessus_interieur: 'Dessus intérieur',
  dessus_exterieur: 'Dessus extérieur',
}

/**
 * Prix HT détaillé d’un meuble :
 * ossature = forfait + variable × 4×(L+W+H)/1000 m
 * panneau  = forfait + variable × surface m² (par panneau)
 * modules  = forfait + variable surface
 */
export function computeUnitPricing(unit) {
  const m = new Meuble(unit.dims)
  const longueurCumuleeM = m.totalEdgeLengthMm / 1000 // 4×(L+W+H)/1000
  const ossatureForfait = PRIX.ossatureForfait
  const ossatureVariable = longueurCumuleeM * PRIX.ossatureParMetre
  const ossature = {
    label: 'Ossature',
    forfait: ossatureForfait,
    longueurM: longueurCumuleeM,
    variable: ossatureVariable,
    total: ossatureForfait + ossatureVariable,
  }

  const panneaux = (unit.panneaux || []).map((nom) => {
    const surfaceM2 = panneauSurfaceM2(nom, unit.dims)
    const forfait = PRIX.panneauForfait
    const variable = surfaceM2 * PRIX.panneauParM2
    return {
      nom,
      label: PANNEAU_LABELS[nom] || nom,
      forfait,
      surfaceM2,
      variable,
      total: forfait + variable,
    }
  })

  const modules = (unit.modules || []).map((mod) =>
    modulePriceBreakdown(mod, unit.dims),
  )

  const ht =
    ossature.total +
    panneaux.reduce((s, p) => s + p.total, 0) +
    modules.reduce((s, p) => s + p.total, 0)

  return {
    unitId: unit.id,
    label: unit.label,
    dims: { ...unit.dims },
    woodFinish: unit.woodFinish,
    ossatureFinish: unit.ossatureFinish || 'brut',
    panneauCouleur: unit.panneauCouleur || 'gris_cendre',
    ossature,
    panneaux,
    modules,
    ht,
  }
}

export function computePricing(units) {
  const lines = units.map(computeUnitPricing)
  const ht = lines.reduce((s, u) => s + u.ht, 0)
  const tva = ht * TVA
  return {
    ht,
    tva,
    ttc: ht + tva,
    lines,
    modele3d: PRIX.modele3d,
  }
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
    sunEnabled: false,
    sunIntensity: 2.5,
    showGrid: true,
    wireframe: false,
    showPanneauRectangles: false,
    showPanneauRectFaces: false,
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
        sunEnabled: snap.sunEnabled ?? false,
        sunIntensity: snap.sunIntensity ?? 2.5,
        showGrid: snap.showGrid ?? true,
        wireframe: snap.wireframe ?? false,
        showPanneauRectangles: snap.showPanneauRectangles ?? false,
        showPanneauRectFaces: snap.showPanneauRectFaces ?? false,
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
        sunEnabled: false,
        sunIntensity: 2.5,
        wireframe: false,
        showPanneauRectangles: false,
        showPanneauRectFaces: false,
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

    /**
     * Devis client : résumé HTML (meubles, dims, aménagements, panneaux, prix)
     * + capture photo vue par défaut + JSON technique.
     * Ouvre aussi un mailto (texte) — pièces jointes impossibles côté navigateur.
     */
    requestDevis: async () => {
      const s = get()
      const pricing = computePricing(s.units)
      const screenshot = captureViewportScreenshot()
      const payload = {
        requestType: 'devis',
        quoteRef: s.quoteRef,
        contact: s.contact,
        notes: s.notes,
        units: s.units.map((u) => ({
          id: u.id,
          label: u.label,
          dims: u.dims,
          woodFinish: u.woodFinish,
          ossatureFinish: u.ossatureFinish || 'brut',
          panneauCouleur: u.panneauCouleur || 'gris_cendre',
          modules: u.modules,
          panneaux: u.panneaux,
        })),
        pricing,
        epaisseurPanneau: s.epaisseurPanneau,
        epaisseurPorte: s.epaisseurPorte,
        status: 'devis_sur_demande',
        createdAt: new Date().toISOString(),
        hasScreenshot: Boolean(screenshot),
      }

      const html = buildDevisHtml({
        quoteRef: s.quoteRef,
        contact: s.contact,
        notes: s.notes,
        pricing,
        screenshotDataUrl: screenshot,
        epaisseurPanneau: s.epaisseurPanneau,
        epaisseurPorte: s.epaisseurPorte,
      })

      downloadBlob(
        new Blob([html], { type: 'text/html;charset=utf-8' }),
        `Philae_Devis_${s.quoteRef}.html`,
      )
      downloadBlob(
        new Blob([JSON.stringify(payload, null, 2)], {
          type: 'application/json',
        }),
        `Philae_Devis_${s.quoteRef}.json`,
      )
      if (screenshot) {
        const bin = atob(screenshot.split(',')[1] || '')
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        downloadBlob(
          new Blob([bytes], { type: 'image/png' }),
          `Philae_Devis_${s.quoteRef}.png`,
        )
      }

      openMailtoDevis({
        quoteRef: s.quoteRef,
        contact: s.contact,
        notes: s.notes,
        pricing,
        subjectPrefix: 'Demande de devis',
      })

      return { ...payload, emailed: true }
    },

    /** Demande modèle 3D à 45 € HT (forfait fixe). */
    requestModele3D: async () => {
      const s = get()
      const pricing = computePricing(s.units)
      const screenshot = captureViewportScreenshot()
      const payload = {
        requestType: 'modele_3d',
        quoteRef: s.quoteRef,
        contact: s.contact,
        notes: s.notes,
        units: s.units,
        pricingFurniture: pricing,
        priceModele3dHt: PRIX.modele3d,
        createdAt: new Date().toISOString(),
      }
      downloadBlob(
        new Blob([JSON.stringify(payload, null, 2)], {
          type: 'application/json',
        }),
        `Philae_Modele3D_${s.quoteRef}.json`,
      )
      openMailtoDevis({
        quoteRef: s.quoteRef,
        contact: s.contact,
        notes: s.notes,
        pricing,
        subjectPrefix: `Demande modèle 3D (${PRIX.modele3d} € HT)`,
        extraLines: [
          `Produit : Modèle 3D — ${PRIX.modele3d.toFixed(2)} € HT`,
          `(pièces jointes : joindre le JSON téléchargé + capture)`,
        ],
      })
      return { ...payload, screenshot: Boolean(screenshot), emailed: true }
    },

    /**
     * Acheter — lien boutique (à configurer via BOUTIQUE_CHECKOUT_URL).
     * Pour l’instant : panier local + message si URL vide.
     */
    requestAcheter: () => {
      const s = get()
      const pricing = computePricing(s.units)
      set((st) => ({ cartCount: st.cartCount + 1 }))
      const url = BOUTIQUE_CHECKOUT_URL
      if (url) {
        const sep = url.includes('?') ? '&' : '?'
        window.open(
          `${url}${sep}ref=${encodeURIComponent(s.quoteRef)}&ttc=${pricing.ttc.toFixed(2)}`,
          '_blank',
          'noopener,noreferrer',
        )
        return { url, pricing, quoteRef: s.quoteRef }
      }
      return { url: null, pricing, quoteRef: s.quoteRef }
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
