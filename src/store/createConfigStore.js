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
  liftShelvesAboveDrawers,
  pinFirstShelfOnDrawers,
  doorBaysFromModules,
  resolvePorteBays,
  porteGroupsForUnit,
  inheritPorteHinge,
  panelBaysFromModules,
  resolveFaceBays,
  faceGroupsForUnit,
  panelBaysOverlappingZ,
  unionBayIndices,
  lockedJoueBaySet,
  SEGMENTED_FACES,
} from '../1_STRUCTURE/02_agencement/agencement.js'
import { Meuble } from '../1_STRUCTURE/01_meuble3D/ossature.js'
import { emptyPhotoCalib } from '../lib/photoCalib.js'
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
  BOIS_ATELIER_ID,
  resolveOssatureFinish,
  PANNEAU_LABELS,
} from '../1_STRUCTURE/00_matrice/matrice_constante.js'
import {
  captureViewportScreenshot,
  buildDevisHtml,
  downloadBlob,
  openMailtoDevis,
} from './devisExport.js'
import { readShopPanelColor } from '../lib/shopPanelColor.js'
import { downloadFilledDevis } from '../2_BUILD/document/fillDevisTemplate.js'
import {
  downloadMasterInputCsv,
  downloadMasterInputJson,
  EPAISSEURS_PANNEAU,
  EPAISSEURS_PORTE,
} from '../3_INPUT/master_input.js'
import { clampDims } from '../3_INPUT/matrice_input.js'
import {
  parseModulesSpec,
  parsePanneauxSpec,
} from '../1_STRUCTURE/00_matrice/matrice_catalogue.js'

const parseModulesInline = parseModulesSpec
const parsePanneauxInline = parsePanneauxSpec

/** Surface m² d’un panneau selon son type et les dims (mm). */
export function panneauSurfaceM2(nom, dims, unit = null) {
  const { L, W, H } = dims
  if (nom === 'porte' && unit) {
    const groups = porteGroupsForUnit(unit)
    const hMm = groups.reduce(
      (s, g) => s + Math.max(0, (g.zMax ?? H) - (g.zMin ?? 0)),
      0,
    )
    return (L * Math.max(0, hMm)) / 1e6
  }
  if ((nom === 'fond' || nom === 'joue1' || nom === 'joue2') && unit) {
    const groups = faceGroupsForUnit(unit, nom)
    const hMm = groups.reduce(
      (s, g) => s + Math.max(0, (g.zMax ?? H) - (g.zMin ?? 0)),
      0,
    )
    if (nom === 'fond') return (L * Math.max(0, hMm)) / 1e6
    return (W * Math.max(0, hMm)) / 1e6
  }
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
    const surfaceM2 = panneauSurfaceM2(nom, unit.dims, unit)
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
  const first = defaultUnit({
    modules: [createModule('shelf', 0)],
    panneaux: ['fond', 'dessus_exterieur', 'dessous'],
  })

  return create((set, get) => ({
    /** Identifiant logique : 'main' | 'boutique-session' */
    storeName: opts.name || 'config',

    units: [first],
    activeUnitId: first.id,
    environmentId: 'none',
    /** Photo de pièce (data URL JPEG/PNG) — le meuble = géométrie courante. */
    scenePhotoDataUrl: null,
    scenePhotoName: '',
    /** Rubrique « Scène 3D » ouverte (mini-environnement photo). */
    sceneSheetOpen: false,
    /** Pose du meuble dans la photo : X/Y sol, rot. Z, échelle apparente. */
    photoPose: { xMm: 0, yMm: 0, rotZ: 0, scale: 1 },
    photoCamera: null,
    photoRoom: null,
    /** Calage : origine → X → Z → Y0 (sur X) → Y + molette. Conservé hors Scène. */
    photoCalib: null,
    sunEnabled: false,
    sunIntensity: 2.5,
    showGrid: false,
    wireframe: false,
    showPanneauRectangles: false,
    showPanneauRectFaces: false,
    showPanneauSolid: true,
    epaisseurPanneau: Number(EPAISSEUR_PANNEAU),
    epaisseurPorte: Number(EPAISSEUR_PORTE),
    /** Mode clic-face pour ajouter un panneau (gamification) */
    panneauPickMode: false,
    contact: defaultContact(),
    notes: '',
    quoteRef: makeQuoteRef(),
    cartCount: 0,
    lang: 'FR',
    selection: null,
    /** id catalogue si session boutique */
    catalogProductId: null,
    /**
     * true = session boutique : L/W/H figés (personnalisation hors dimensions).
     * false = configurateur libre.
     */
    dimsLocked: false,
    dirty: false,
    /** true après restore cloud / snapshot — évite d’écraser un travail en cours */
    configHydrated: false,

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

    /** Max 3 meubles client. Retourne { ok, unit? } ou { ok: false, reason }. */
    addUnit: () => {
      // Session boutique : un seul modèle figé, pas de multi-meubles
      if (get().dimsLocked) {
        return {
          ok: false,
          reason:
            'Ce configurateur boutique est limité à un seul modèle. Utilisez le configurateur libre pour plusieurs meubles.',
        }
      }
      const MAX_UNITS = 3
      if (get().units.length >= MAX_UNITS) {
        return {
          ok: false,
          reason:
            'Veuillez nous contacter via notre formulaire pour tout projet d’envergure',
        }
      }
      const n = get().units.length + 1
      const prev = get().getActiveUnit()
      // Meuble 1 reste à l’origine ; suivants décalés en X
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
      return { ok: true, unit }
    },

    removeUnit: (id) =>
      set((s) => {
        if (s.units.length <= 1) return s
        const units = s.units.filter((u) => u.id !== id)
        // Le premier restant redevient l’ancrage (non déplaçable)
        if (units[0]) {
          units[0] = {
            ...units[0],
            positionMm: { x: 0, y: 0, z: 0 },
          }
        }
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
      set((s) => {
        if (s.dimsLocked) return s
        return {
          units: s.units.map((u) =>
            u.id === id
              ? { ...u, dims: { ...u.dims, ...clampDims(dims) } }
              : u,
          ),
          dirty: true,
        }
      }),

    updatePosition: (id, positionMm) =>
      set((s) => {
        // Premier meuble (index 0) : non déplaçable
        if (s.units[0]?.id === id) {
          return {
            units: s.units.map((u) =>
              u.id === id
                ? { ...u, positionMm: { x: 0, y: 0, z: 0 } }
                : u,
            ),
            dirty: true,
          }
        }
        return {
          units: s.units.map((u) =>
            u.id === id
              ? { ...u, positionMm: { ...u.positionMm, ...positionMm } }
              : u,
          ),
          dirty: true,
        }
      }),

    addModule: (kind) => {
      const id = get().activeUnitId
      set((s) => ({
        units: s.units.map((u) => {
          if (u.id !== id) return u
          const bayIndex = u.modules.filter((m) => m.kind === kind).length
          const modules = [...u.modules, createModule(kind, bayIndex)]
          return {
            ...u,
            modules:
              kind === 'drawer'
                ? liftShelvesAboveDrawers(modules, u.dims)
                : modules,
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

    /** Position Z (mm) d’une tablette — haut de l’octogone. */
    setModuleZ: (modId, zMm) => {
      const id = get().activeUnitId
      set((s) => ({
        units: s.units.map((u) => {
          if (u.id !== id) return u
          const modules = u.modules.map((m) =>
            m.id === modId
              ? { ...m, zMm: Number.isFinite(zMm) ? zMm : null }
              : m,
          )
          const changed = u.modules.find((m) => m.id === modId)
          return {
            ...u,
            modules:
              changed?.kind === 'drawer'
                ? liftShelvesAboveDrawers(modules, u.dims)
                : modules,
          }
        }),
        dirty: true,
      }))
    },

    /** Hauteur tiroir (mm) — liste Würth. */
    setModuleH: (modId, hMm) => {
      const id = get().activeUnitId
      const n = Number(hMm)
      set((s) => ({
        units: s.units.map((u) => {
          if (u.id !== id) return u
          const modules = u.modules.map((m) =>
            m.id === modId && m.kind === 'drawer'
              ? { ...m, hMm: Number.isFinite(n) ? n : m.hMm }
              : m,
          )
          return {
            ...u,
            modules: liftShelvesAboveDrawers(modules, u.dims),
          }
        }),
        dirty: true,
      }))
    },

    /**
     * Position Z (mm) tablette ou tiroir.
     * Tablette : haut de l’octogone · Tiroir : bas du caisson (plan rails).
     */
    // setModuleZ déjà gère tout kind via zMm — tiroir inclus

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
            const clearSeg = SEGMENTED_FACES.includes(nom)
              ? { [`${nom}Bays`]: [] }
              : {}
            return {
              ...u,
              panneaux: u.panneaux.filter((p) => p !== nom),
              ...(nom === 'porte'
                ? { porteBays: [], porteOpen: {}, porteHinge: {} }
                : clearSeg),
            }
          }
          let next = [...u.panneaux, nom]
          for (const group of Object.values(exclusifs)) {
            if (group.includes(nom)) {
              next = next.filter((p) => p === nom || !group.includes(p))
            }
          }
          if (nom === 'porte') {
            return { ...u, panneaux: next, porteBays: undefined }
          }
          if (SEGMENTED_FACES.includes(nom)) {
            return { ...u, panneaux: next, [`${nom}Bays`]: undefined }
          }
          return { ...u, panneaux: next }
        }),
        dirty: true,
      }))
    },

    togglePorteBay: (index) => {
      const id = get().activeUnitId
      const n = Number(index)
      if (!Number.isInteger(n)) return
      set((s) => ({
        units: s.units.map((u) => {
          if (u.id !== id) return u
          const bays = doorBaysFromModules(u.dims, u.modules)
          if (n < 0 || n >= bays.length) return u
          const oldGroups = porteGroupsForUnit(u)
          const current = resolvePorteBays(u, bays)
          const has = current.includes(n)
          const porteBays = has
            ? current.filter((i) => i !== n)
            : [...current, n].sort((a, b) => a - b)
          let panneaux = porteBays.length
            ? u.panneaux.includes('porte')
              ? u.panneaux
              : [...u.panneaux, 'porte']
            : u.panneaux.filter((p) => p !== 'porte')
          let joue1Bays = u.joue1Bays
          let joue2Bays = u.joue2Bays
          if (!has) {
            const panelBays = panelBaysFromModules(u.dims, u.modules)
            const overlap = panelBaysOverlappingZ(
              panelBays,
              bays[n].zMin,
              bays[n].zMax,
            )
            if (overlap.length) {
              joue1Bays = unionBayIndices(
                resolveFaceBays(u, 'joue1', panelBays),
                overlap,
              )
              joue2Bays = unionBayIndices(
                resolveFaceBays(u, 'joue2', panelBays),
                overlap,
              )
              if (!panneaux.includes('joue1')) panneaux = [...panneaux, 'joue1']
              if (!panneaux.includes('joue2')) panneaux = [...panneaux, 'joue2']
            }
          }
          const nextUnit = {
            ...u,
            porteBays,
            panneaux,
            joue1Bays,
            joue2Bays,
          }
          const newGroups = porteGroupsForUnit(nextUnit)
          return {
            ...nextUnit,
            porteHinge: inheritPorteHinge(
              oldGroups,
              newGroups,
              u.porteHinge || {},
            ),
            porteOpen: porteBays.length ? u.porteOpen || {} : {},
          }
        }),
        dirty: true,
      }))
    },

    removePorteGroup: (firstIndex, lastIndex) => {
      const id = get().activeUnitId
      const a = Number(firstIndex)
      const b = Number(lastIndex)
      if (!Number.isInteger(a) || !Number.isInteger(b)) return
      set((s) => ({
        units: s.units.map((u) => {
          if (u.id !== id) return u
          const bays = doorBaysFromModules(u.dims, u.modules)
          const oldGroups = porteGroupsForUnit(u)
          const current = resolvePorteBays(u, bays)
          const porteBays = current.filter((i) => i < a || i > b)
          const panneaux = porteBays.length
            ? u.panneaux.includes('porte')
              ? u.panneaux
              : [...u.panneaux, 'porte']
            : u.panneaux.filter((p) => p !== 'porte')
          const nextUnit = { ...u, porteBays, panneaux }
          const newGroups = porteGroupsForUnit(nextUnit)
          return {
            ...nextUnit,
            porteHinge: inheritPorteHinge(
              oldGroups,
              newGroups,
              u.porteHinge || {},
            ),
            porteOpen: porteBays.length ? u.porteOpen || {} : {},
          }
        }),
        dirty: true,
      }))
    },

    toggleFaceBay: (faceId, index) => {
      if (!SEGMENTED_FACES.includes(faceId)) return
      const id = get().activeUnitId
      const n = Number(index)
      if (!Number.isInteger(n)) return
      const field = `${faceId}Bays`
      set((s) => ({
        units: s.units.map((u) => {
          if (u.id !== id) return u
          const bays = panelBaysFromModules(u.dims, u.modules)
          if (n < 0 || n >= bays.length) return u
          const current = resolveFaceBays(u, faceId, bays)
          const has = current.includes(n)
          const locked =
            faceId === 'joue1' || faceId === 'joue2'
              ? lockedJoueBaySet(u)
              : new Set()
          if (has && locked.has(n)) return u
          const nextBays = has
            ? current.filter((i) => i !== n)
            : [...current, n].sort((a, b) => a - b)
          const panneaux = nextBays.length
            ? u.panneaux.includes(faceId)
              ? u.panneaux
              : [...u.panneaux, faceId]
            : u.panneaux.filter((p) => p !== faceId)
          return { ...u, [field]: nextBays, panneaux }
        }),
        dirty: true,
      }))
    },

    removeFaceGroup: (faceId, firstIndex, lastIndex) => {
      if (!SEGMENTED_FACES.includes(faceId)) return
      const id = get().activeUnitId
      const a = Number(firstIndex)
      const b = Number(lastIndex)
      if (!Number.isInteger(a) || !Number.isInteger(b)) return
      const field = `${faceId}Bays`
      set((s) => ({
        units: s.units.map((u) => {
          if (u.id !== id) return u
          const bays = panelBaysFromModules(u.dims, u.modules)
          const current = resolveFaceBays(u, faceId, bays)
          const locked =
            faceId === 'joue1' || faceId === 'joue2'
              ? lockedJoueBaySet(u)
              : new Set()
          const nextBays = current.filter(
            (i) => i < a || i > b || locked.has(i),
          )
          const panneaux = nextBays.length
            ? u.panneaux.includes(faceId)
              ? u.panneaux
              : [...u.panneaux, faceId]
            : u.panneaux.filter((p) => p !== faceId)
          return { ...u, [field]: nextBays, panneaux }
        }),
        dirty: true,
      }))
    },

    setPorteHinge: (key, hinge) => {
      if (!key) return
      const mode = ['left', 'right', 'center'].includes(hinge)
        ? hinge
        : 'left'
      const id = get().activeUnitId
      set((s) => ({
        units: s.units.map((u) => {
          if (u.id !== id) return u
          return {
            ...u,
            porteHinge: { ...(u.porteHinge || {}), [key]: mode },
          }
        }),
        dirty: true,
      }))
    },

    togglePorteOpen: (key) => {
      if (!key) return
      const id = get().activeUnitId
      set((s) => ({
        units: s.units.map((u) => {
          if (u.id !== id) return u
          const open = { ...(u.porteOpen || {}) }
          open[key] = open[key] ? 0 : 1
          return { ...u, porteOpen: open }
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

    setScenePhoto: (dataUrl, name = '', extras = {}) => {
      const nextCalib = extras.calib || emptyPhotoCalib(extras.xLine)
      if (Number(extras.photoAspect) > 0.05) {
        nextCalib.photoAspect = Number(extras.photoAspect)
      } else if (Number(extras.xLine?.aspect) > 0.05) {
        nextCalib.photoAspect = Number(extras.xLine.aspect)
      }
      set({
        scenePhotoDataUrl: dataUrl || null,
        scenePhotoName: name || '',
        environmentId: dataUrl ? 'none' : get().environmentId,
        showGrid: dataUrl ? false : get().showGrid,
        photoPose: { xMm: 0, yMm: 0, rotZ: 0, scale: 1 },
        photoCamera: null,
        photoRoom: null,
        photoCalib: dataUrl ? nextCalib : null,
        dirty: true,
      })
    },

    clearScenePhoto: () =>
      set({
        scenePhotoDataUrl: null,
        scenePhotoName: '',
        photoPose: { xMm: 0, yMm: 0, rotZ: 0, scale: 1 },
        photoCamera: null,
        photoRoom: null,
        photoCalib: null,
        dirty: true,
      }),

    setSceneSheetOpen: (open) => set({ sceneSheetOpen: Boolean(open) }),

    setPhotoPose: (patch) =>
      set((s) => {
        const prev = s.photoPose || { xMm: 0, yMm: 0, rotZ: 0, scale: 1 }
        const scale = Number(patch.scale ?? prev.scale)
        return {
          photoPose: {
            xMm: Number(patch.xMm ?? prev.xMm) || 0,
            yMm: Number(patch.yMm ?? prev.yMm) || 0,
            rotZ: Number(patch.rotZ ?? prev.rotZ) || 0,
            scale: Math.min(4, Math.max(0.25, Number.isFinite(scale) ? scale : 1)),
          },
        }
      }),

    setPhotoCamera: (photoCamera) => set({ photoCamera }),

    setPhotoCalib: (patch) =>
      set((s) => {
        const prev = s.photoCalib
        if (!prev) return {}
        return { photoCalib: { ...prev, ...patch } }
      }),

    resetPhotoCalib: () =>
      set((s) => {
        const prev = s.photoCalib
        if (!prev) return {}
        return {
          photoCalib: {
            ...prev,
            step: 'x1',
            lines: {
              x: [null, null],
              y: [null, null],
              z: [null, null],
            },
            pending: null,
            originUv: null,
            hoverUv: prev.xA || null,
            scale: 1,
            shiftX: 0,
            shiftZ: 0,
            zoom: 1,
          },
        }
      }),

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
      // figé à 14 mm — ignore les valeurs hors liste
      const n = Number(epaisseurPanneau)
      if (!EPAISSEURS_PANNEAU.includes(n)) return
      set({ epaisseurPanneau: n, dirty: true })
    },
    setEpaisseurPorte: (epaisseurPorte) => {
      const n = Number(epaisseurPorte)
      if (!EPAISSEURS_PORTE.includes(n)) return
      set({ epaisseurPorte: n, dirty: true })
    },
    setPanneauPickMode: (panneauPickMode) =>
      set({ panneauPickMode: Boolean(panneauPickMode) }),
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
        // Main configurateur : dimensions toujours libres après import boutique
        dimsLocked: false,
        epaisseurPanneau: snap.epaisseurPanneau ?? Number(EPAISSEUR_PANNEAU),
        epaisseurPorte: snap.epaisseurPorte ?? Number(EPAISSEUR_PORTE),
        notes: snap.notes ?? '',
        quoteRef: snap.quoteRef || makeQuoteRef(),
        contact: keepContact
          ? prev.contact
          : structuredClone(snap.contact || defaultContact()),
        catalogProductId: null,
        dirty: false,
        configHydrated: true,
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
          ...(m.hMm != null ? { hMm: m.hMm } : {}),
          ...(m.zMm != null ? { zMm: m.zMm } : {}),
        }))
      }
      let panneaux = row.panneaux
      if (typeof panneaux === 'string' || !Array.isArray(panneaux)) {
        panneaux = parsePanneauxInline(row.panneaux_spec || row.panneaux)
      } else {
        panneaux = [...panneaux]
      }

      const dims = clampDims({ L: row.L_mm, W: row.W_mm, H: row.H_mm })
      modules = pinFirstShelfOnDrawers(modules, dims)

      const unit = defaultUnit({
        label: row.name,
        dims,
        // Bois local atelier (non choisi client) + finition surface catalogue
        woodFinish: BOIS_ATELIER_ID,
        ossatureFinish: resolveOssatureFinish(
          row.ossature_finish || row.texture || row.wood_finish,
        ),
        // Couleur boutique choisie par le client, sinon couleur catalogue
        panneauCouleur:
          readShopPanelColor() ||
          row.panneau_couleur ||
          row.panneauCouleur ||
          'olive',
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
        // Boutique dédiée : dimensions du modèle figées
        dimsLocked: true,
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

      // Publipostage Word (template devis.docx)
      let docxOk = false
      try {
        await downloadFilledDevis(s, pricing)
        docxOk = true
      } catch (err) {
        console.warn('[devis] template Word non généré :', err)
      }

      openMailtoDevis({
        quoteRef: s.quoteRef,
        contact: s.contact,
        notes: s.notes,
        pricing,
        subjectPrefix: 'Demande de devis',
        extraLines: docxOk
          ? ['Fichier Word devis téléchargé — à joindre au mail.']
          : ['(Word devis non généré — voir console)'],
      })

      return { ...payload, emailed: true, docx: docxOk }
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
     * Acheter — Stripe Checkout Session (paiement total TTC).
     * Crée une session via /api/checkout puis redirige vers Stripe.
     * @returns {Promise<{ url?: string, orderId?: string, pricing, quoteRef, error?: string }>}
     */
    requestAcheter: async () => {
      const s = get()
      const pricing = computePricing(s.units)
      set((st) => ({ cartCount: st.cartCount + 1 }))

      const { STRIPE_ENABLED } = await import('../lib/payments.js')
      if (!STRIPE_ENABLED) {
        return {
          url: null,
          pricing,
          quoteRef: s.quoteRef,
          error: 'STRIPE_DISABLED',
        }
      }

      if (!Number.isFinite(pricing.ttc) || pricing.ttc < 0.5) {
        return {
          url: null,
          pricing,
          quoteRef: s.quoteRef,
          error: 'Montant insuffisant pour un paiement en ligne',
        }
      }

      // Secours legacy si URL boutique configurée manuellement
      if (BOUTIQUE_CHECKOUT_URL) {
        const sep = BOUTIQUE_CHECKOUT_URL.includes('?') ? '&' : '?'
        const url = `${BOUTIQUE_CHECKOUT_URL}${sep}ref=${encodeURIComponent(s.quoteRef)}&ttc=${pricing.ttc.toFixed(2)}`
        window.open(url, '_blank', 'noopener,noreferrer')
        return { url, pricing, quoteRef: s.quoteRef }
      }

      try {
        const { createCheckoutSession, labelFromUnits } = await import(
          '../lib/checkout.js'
        )
        const { getExtrasConsent } = await import('../lib/plausible.js')
        const result = await createCheckoutSession({
          source: s.dimsLocked ? 'boutique' : 'configurator',
          quoteRef: s.quoteRef,
          productLabel: labelFromUnits(s.units),
          lang:
            typeof document !== 'undefined'
              ? document.documentElement.lang || 'fr'
              : 'fr',
          productId: s.catalogProductId || undefined,
          paymentMode: 'full',
          pricing: {
            ht: pricing.ht,
            tva: pricing.tva,
            ttc: pricing.ttc,
          },
          contact: s.contact || {},
          config: {
            quoteRef: s.quoteRef,
            units: snapshotFromState(s).units,
            environmentId: s.environmentId,
            notes: s.notes,
            contact: s.contact,
            pricing,
            extrasConsent: getExtrasConsent(),
          },
        })

        if (result.url) {
          // Redirection pleine page → Stripe Checkout (ne démonte pas le 3D avant)
          window.location.assign(result.url)
        }
        return {
          url: result.url,
          orderId: result.orderId,
          sessionId: result.sessionId,
          pricing,
          quoteRef: s.quoteRef,
        }
      } catch (e) {
        console.error('[requestAcheter]', e)
        return {
          url: null,
          pricing,
          quoteRef: s.quoteRef,
          error:
            e.message ||
            'Paiement indisponible — contact@philae.design',
        }
      }
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
