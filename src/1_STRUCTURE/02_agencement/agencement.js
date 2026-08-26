/**
 * Agencement Philae
 * — construit les solides 3D (panneaux, modules) à partir des matrices
 * — le fond est build ici, puis rendu par ModuleMesh
 */
import {
  EPAISSEUR_PANNEAU,
  EPAISSEUR_PORTE,
  DRAWER_STACK_GAP_MM,
  PRIX,
  areteExtrusionMm,
} from '../00_matrice/matrice_constante.js'
import { uid } from '../00_matrice/matrice_configuration.js'
import { buildGeometrie } from '../00_matrice/matrice_geometrie.js'
import {
  PANNEAU_DEFS,
  Panneau,
  face_panneau,
  ligne_panneau,
  computeQuatreRectangles,
} from '../00_matrice/matrice_panneau.js'
import { buildTraversePair } from './traverse.js'
import {
  WURTH_HAUTEUR_DEFAUT_MM,
  WURTH_DECROCHE_DYNAMOOV_MM,
  computeWurthDrawerDims,
  clampWurthHeight,
} from './tiroir/tiroir.js'

export const AGENCEMENT_TYPES = {
  shelf: 'shelf',
  drawer: 'drawer',
  fond: 'fond',
  porte: 'porte',
  facade: 'facade',
  plateau: 'plateau',
  pied: 'pied',
  joue1: 'joue1',
  joue2: 'joue2',
}

/**
 * Construit un panneau nommé (fond | porte | …) — solide 8 points.
 *
 * @param {string} nom — clé dans PANNEAU_DEFS
 * @param {{ L: number, W: number, H: number }} dims
 * @param {{ epaisseur?: number, tolerance?: number, decalage?: number }} [params]
 */
export function buildPanneauComplet(nom, dims, params = {}) {
  const def = PANNEAU_DEFS[nom]
  if (!def) throw new Error(`buildPanneauComplet : PANNEAU_DEFS.${nom} absent`)

  const { byId } = buildGeometrie(dims)
  const { tolerance, arriere, params: resolved } = computeQuatreRectangles(
    def,
    byId,
    params,
  )

  const panneau = new Panneau(nom, [...tolerance, ...arriere], {
    normal: def.normal,
    direction: def.direction,
    texture: def.texture,
    epaisseur: resolved.epaisseur,
  })

  return {
    nom,
    panneau,
    solidColor: def.couleur || '#c4a574',
    params: resolved,
  }
}

/** Alias fond */
export function buildFond(dims, params = {}) {
  return buildPanneauComplet('fond', dims, params)
}

/** Alias porte (face opposée X1/X3) */
export function buildPorte(dims, params = {}) {
  return buildPanneauComplet('porte', dims, params)
}

/**
 * Solide seul (compat).
 * @returns {import('../00_matrice/matrice_panneau.js').Panneau}
 */
export function buildPanneau(nom, dims, params = {}) {
  return buildPanneauComplet(nom, dims, params).panneau
}

/**
 * @param {{ L: number, W: number, H: number }} dims
 * @param {string[]} [noms=['fond']]
 * @param {{ epaisseur?: number, tolerance?: number, decalage?: number }} [params]
 */
export function buildPanneaux(dims, noms = ['fond'], params = {}) {
  const list = []
  for (const nom of noms) {
    if (PANNEAU_DEFS[nom]) list.push(buildPanneauComplet(nom, dims, params))
  }
  return list
}

/** Expose topologie pour debug / inspection. */
export { face_panneau, ligne_panneau, PANNEAU_DEFS, Panneau }

// ---------------------------------------------------------------------------
// Modules — orchestration
//   panneaux (6 + variantes) : buildPanneauComplet / PANNEAU_DEFS
//   traverses Y par paire    : ./traverse.js
//   tablettes               : ./Z.tablette/tablette.js
//   tiroirs                 : ./tiroir/tiroir.js
// ---------------------------------------------------------------------------

export {
  buildTraverse,
  buildTraversePair,
  buildTabletteTraverses,
  TRAVERSE_EXTRUSION_MM,
  traverseExtrusionForDims,
  TRAVERSE_PROFILE_LEFT,
  TRAVERSE_PROFILE_RIGHT,
  TRAVERSE_PROFILE_6,
  TRAVERSE_PROFILE_6_BACK,
  ligne_traverse,
  face_traverse,
  resolveTraverseProfile2D,
} from './traverse.js'

export {
  buildTablette,
  buildTablettePlateBuffers,
  TABLETTE_OCTOGONE_REFS,
  ligne_tablette,
  face_tablette,
  resolveTabletteOctogone,
} from './Z.tablette/tablette.js'

export {
  buildTiroir,
  buildDrawerOpenBox,
  buildDrawerRails,
  normalizeRailGeometry,
  railGeometryToThree,
  RAIL_STL_URL,
  RAIL_STL_SCALE,
  RAIL_MOUNT_OFFSET,
  DRAWER_OPEN_DEPTH_RATIO,
  DRAWER_OPEN_DURATION_MS,
  WURTH_DRAWER_TYPE,
  WURTH_HAUTEURS_MM,
  WURTH_HAUTEUR_DEFAUT_MM,
  WURTH_DECROCHE_DYNAMOOV_MM,
  WURTH_PROFONDEURS_MM,
  WURTH_PROFONDEUR_MIN_MM,
  DRAWER_DEPTH_TOO_SMALL_MSG,
  DRAWER_WIDTH_OUT_OF_RANGE_MSG,
  DYNAMOOV_LWK_MIN_MM,
  DYNAMOOV_LWK_MAX_MM,
  computeWurthDrawerDims,
  clampWurthHeight,
  drawerInnerWidthMm,
  isDrawerWidthAllowed,
} from './tiroir/tiroir.js'

export function createModule(kind, bayIndex = 0, extras = {}) {
  const base = {
    id: uid(kind),
    kind,
    bayIndex,
    openFactor: 0,
    /** Hauteur libre tablette (mm) — haut octogone. null = auto */
    zMm: null,
    ...extras,
  }
  // Tiroir Würth : hauteur discrète à l’ajout
  if (kind === 'drawer' && base.hMm == null) {
    base.hMm = WURTH_HAUTEUR_DEFAUT_MM
  }
  return base
}

/**
 * Plancher Z des tiroirs = 2.6 × hauteur d’arête
 * (dessus de traverse du 1er tiroir, au-dessus des arêtes basses).
 */
export function drawerFloorZMm(dims = {}) {
  return 2.6 * areteExtrusionMm(dims)
}

/**
 * Z min du dessus de traverse d’un tiroir (index dans la liste des tiroirs).
 *   index 0 : 2.6 × hauteur_arete
 *   index n : 2.6 × hauteur_arete + Σ_{k<n} (H_k + 15)
 */
export function drawerZMinMm(dims = {}, moduleList = [], drawerIndex = 0) {
  const gap = Number(DRAWER_STACK_GAP_MM) || 15
  const drawers = moduleList.filter((m) => m.kind === 'drawer')
  let z = drawerFloorZMm(dims)
  const n = Math.max(0, Number(drawerIndex) || 0)
  for (let k = 0; k < n && k < drawers.length; k++) {
    z += drawerHeightMm(drawers[k]) + gap
  }
  return z
}

/**
 * Z haut des tiroirs (mm) : sommet du caisson le plus haut.
 * 0 s’il n’y a pas de tiroir.
 */
export function drawersTopZMm(dims = {}, moduleList = []) {
  const drawers = moduleList.filter((m) => m.kind === 'drawer')
  if (!drawers.length) return 0
  let top = 0
  drawers.forEach((d, i) => {
    const h = drawerHeightMm(d)
    const zBottom =
      d.zMm != null && Number.isFinite(Number(d.zMm))
        ? Number(d.zMm)
        : drawerZMinMm(dims, moduleList, i)
    top = Math.max(top, zBottom + h)
  })
  return top
}

/**
 * Bornes Z tablette (haut de l’octogone).
 * S’il y a des tiroirs, le bas du plateau ≥ sommet des tiroirs.
 */
export function shelfZBounds(dims = {}, moduleList = []) {
  const { H } = dims
  const inset = 22
  const extrusion = areteExtrusionMm(dims)
  const zMinFloor = inset + EPAISSEUR_PANNEAU
  const drawerTop = drawersTopZMm(dims, moduleList)
  const zMin =
    drawerTop > 0
      ? Math.max(zMinFloor, drawerTop + EPAISSEUR_PANNEAU)
      : zMinFloor
  const zMax = Math.max(zMin, (Number(H) || 0) - inset - extrusion)
  return { zMin, zMax, drawerTop }
}

export function liftShelvesAboveDrawers(modules = [], dims = {}) {
  const { zMin } = shelfZBounds(dims, modules)
  return modules.map((m) => {
    if (m.kind !== 'shelf') return m
    if (m.zMm == null || !Number.isFinite(Number(m.zMm))) return m
    if (Number(m.zMm) < zMin) return { ...m, zMm: zMin }
    return m
  })
}

/**
 * Z tablette (mm) = **haut** de l’octogone (face supérieure).
 * Clamp pour laisser la place à l’épaisseur (vers le bas) + traverses (vers le haut).
 * Avec tiroirs : bas du plateau ≥ Z haut des tiroirs.
 */
export function shelfZMm(mod, dims, moduleList = []) {
  const { zMin, zMax } = shelfZBounds(dims, moduleList)
  if (mod.zMm != null && Number.isFinite(Number(mod.zMm))) {
    return Math.min(zMax, Math.max(zMin, Number(mod.zMm)))
  }
  const sameKind = moduleList.filter((m) => m.kind === 'shelf')
  const count = Math.max(sameKind.length, 1)
  const index = sameKind.findIndex((m) => m.id === mod.id)
  const i = Math.max(0, index >= 0 ? index : mod.bayIndex ?? 0)
  if (count === 1) return (zMin + zMax) / 2
  const span = zMax - zMin
  return zMin + (span * i) / (count - 1)
}

export function moduleLayout(mod, { L, W, H }, moduleList = []) {
  const inset = 22
  const innerL = L - 2 * inset
  const innerW = W - 2 * inset
  const innerH = H - 2 * inset
  const z0 = inset
  const y0 = inset
  const x0 = inset

  const sameKind = moduleList.filter((m) => m.kind === mod.kind)
  const count = Math.max(sameKind.length, 1)
  const index = sameKind.findIndex((m) => m.id === mod.id)
  const i = index >= 0 ? index : mod.bayIndex

  const dims = { L, W, H }
  const extrusion = areteExtrusionMm(dims)

  if (mod.kind === 'shelf') {
    /** zMm = haut de tablette (octogone) */
    const zTop = shelfZMm(mod, dims, moduleList)
    const bounds = shelfZBounds(dims, moduleList)
    const zCenter = zTop - EPAISSEUR_PANNEAU / 2
    return {
      center: [L / 2, W / 2, zCenter],
      size: [innerL, innerW, EPAISSEUR_PANNEAU],
      openOffset: [0, 0, 0],
      zMm: zTop,
      zTopMm: zTop,
      zMin: bounds.zMin,
      zMax: bounds.zMax,
      drawerTopMm: bounds.drawerTop,
      areteExtrusionMm: extrusion,
    }
  }

  if (mod.kind === 'drawer') {
    // Bornes traverses pour LWK / profondeur (profil à Z provisoire)
    const zTraverseGuess = z0 + 8
    const [trL, trR] = buildTraversePair(dims, zTraverseGuess)
    const traverseBounds = {
      minX: trL.innerX,
      maxX: trR.innerX,
      minY: Math.min(trL.bounds2D.minY, trR.bounds2D.minY),
      maxY: Math.max(trL.bounds2D.maxY, trR.bounds2D.maxY),
    }
    const wurth = computeWurthDrawerDims(dims, mod, traverseBounds)
    const drawerH = wurth.hMm
    /**
     * zMm = dessus des traverses Y (= dessus des rails).
     * Traverses extrudées vers le bas sous ce plan.
     * zFond du tiroir = zMm − 19,05.
     */
    const zMin = drawerZMinMm(dims, moduleList, i)
    const zMax = Math.max(zMin, H - inset - drawerH)
    const zSideBottom =
      mod.zMm != null && Number.isFinite(Number(mod.zMm))
        ? Math.min(zMax, Math.max(zMin, Number(mod.zMm)))
        : zMin
    const zCenter = zSideBottom + drawerH / 2
    const atFloor = Math.abs(zSideBottom - zMin) < 1
    return {
      center: [
        L / 2,
        (traverseBounds.minY + traverseBounds.maxY) / 2,
        zCenter,
      ],
      size: [wurth.licMm, Math.max(wurth.depthMm, 1), drawerH],
      openOffset: [0, 0, 0],
      wurth,
      zMm: zSideBottom,
      zBottomMm: zSideBottom,
      /** Bas d’extrusion des traverses (dessous) */
      zTraverseMm: zSideBottom - extrusion,
      zMin,
      zMax,
      drawerIndex: i,
      atFloor,
      /** 1er tiroir + curseur au plancher → façade « bas » */
      facadeBas: i === 0 && atFloor,
      hMm: drawerH,
      licMm: wurth.licMm,
      lwkMm: wurth.lwkMm,
      depthMm: wurth.depthMm,
      depthTooSmall: Boolean(wurth.depthTooSmall),
      lwkOutOfRange: Boolean(wurth.lwkOutOfRange),
      areteExtrusionMm: extrusion,
    }
  }

  if (mod.kind === 'door') {
    const open = (mod.openFactor || 0) * (Math.PI / 2)
    const doorW = innerL / Math.max(count, 1) - 4
    const x = x0 + i * (doorW + 4) + doorW / 2
    return {
      center: [x, y0, H / 2],
      size: [doorW, EPAISSEUR_PORTE, innerH],
      hinge: [x - doorW / 2, y0, H / 2],
      openAngle: open,
      openOffset: [0, 0, 0],
    }
  }

  return {
    center: [L / 2, W / 2, H / 2],
    size: [innerL, innerW, EPAISSEUR_PANNEAU],
    openOffset: [0, 0, 0],
  }
}

/**
 * Prix HT d’un module d’aménagement (forfait + variable).
 * Tablette : surface L×W (m²)
 * Tiroir : volume L×W×H_tiroir (m³) — H parmi 200/300/400 mm
 * Porte : surface façade L×H (m²)
 */
export function modulePriceHT(mod, dims) {
  return modulePriceBreakdown(mod, dims).total
}

/** Hauteur tiroir Würth (mm) — liste discrète. */
export function drawerHeightMm(mod) {
  return clampWurthHeight(
    mod?.hMm ?? mod?.heightMm ?? WURTH_HAUTEUR_DEFAUT_MM,
  )
}

/** Détail ligne devis pour un module. */
export function modulePriceBreakdown(mod, dims) {
  const shelfArea = (dims.L * dims.W) / 1e6
  const faceArea = (dims.L * dims.H) / 1e6

  if (mod.kind === 'shelf') {
    const forfait = PRIX.tabletteForfait
    const variable = shelfArea * PRIX.tabletteParM2
    return {
      kind: 'shelf',
      label: 'Tablette',
      forfait,
      surfaceM2: shelfArea,
      variable,
      total: forfait + variable,
    }
  }
  if (mod.kind === 'drawer') {
    const layout = moduleLayout(mod, dims, [mod])
    const hMm = layout.hMm ?? drawerHeightMm(mod)
    const lic = layout.licMm ?? dims.L
    const depth = layout.depthMm ?? dims.W
    const volumeM3 = (lic * depth * hMm) / 1e9
    const forfait = PRIX.tiroirForfait
    const variable = volumeM3 * PRIX.tiroirParM3
    return {
      kind: 'drawer',
      label: `Tiroir Würth B H${hMm}`,
      forfait,
      hMm,
      licMm: lic,
      depthMm: depth,
      volumeM3,
      surfaceM2: volumeM3,
      variable,
      total: forfait + variable,
    }
  }
  if (mod.kind === 'door') {
    const forfait = PRIX.porteForfait
    const variable = faceArea * PRIX.porteParM2
    return {
      kind: 'door',
      label: 'Porte',
      forfait,
      surfaceM2: faceArea,
      variable,
      total: forfait + variable,
    }
  }
  if (mod.kind === 'pied') {
    const forfait = PRIX.piedForfait
    return {
      kind: 'pied',
      label: 'Pied',
      forfait,
      surfaceM2: 0,
      variable: 0,
      total: forfait,
    }
  }
  return {
    kind: mod.kind,
    label: mod.kind,
    forfait: 10,
    surfaceM2: 0,
    variable: 0,
    total: 10,
  }
}
