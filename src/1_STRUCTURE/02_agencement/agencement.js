/**
 * Agencement Philae
 * — construit les solides 3D (panneaux, modules) à partir des matrices
 * — le fond est build ici, puis rendu par ModuleMesh
 */
import {
  EPAISSEUR_PANNEAU,
  EPAISSEUR_PORTE,
  TOLERANCE,
  DECALAGE_PANNEAU,
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
  ligne_rectangle,
  computeQuatreRectangles,
} from '../00_matrice/matrice_panneau_grok.js'
import { buildTraversePair } from './traverse.js'
import {
  WURTH_HAUTEUR_DEFAUT_MM,
  WURTH_DECROCHE_DYNAMOOV_MM,
  computeWurthDrawerDims,
  clampWurthHeight,
} from './tiroir/tiroir.js'

/**
 * Rectangle3D : 4 coins 3D pour debug (base / décalé / tolérance / arrière).
 * Propriétés lues par ModuleMesh : color, wire, positions, indices.
 */
export class Rectangle3D {
  /**
   * @param {string} nom
   * @param {number[][]} points — 4 × [x,y,z] mm
   * @param {string} color — hex (#RRGGBB)
   */
  constructor(nom, points, color = '#ffffff') {
    if (!points || points.length !== 4) {
      throw new Error(
        `Rectangle3D "${nom}" : 4 points requis, reçu ${points?.length}`,
      )
    }
    this.nom = nom
    this.id = nom
    this.points = points.map((p) => [p[0], p[1], p[2]])
    this.color = color
    this.couleur = color
  }

  get positions() {
    const out = new Float32Array(12)
    for (let i = 0; i < 4; i++) {
      out[i * 3] = this.points[i][0]
      out[i * 3 + 1] = this.points[i][1]
      out[i * 3 + 2] = this.points[i][2]
    }
    return out
  }

  get indices() {
    return new Uint16Array([0, 1, 2, 0, 2, 3])
  }

  /** Filaire 4 côtés uniquement (pas ligne_panneau 12 segments). */
  get wire() {
    const out = new Float32Array(ligne_rectangle.length * 6)
    ligne_rectangle.forEach(([a, b], i) => {
      const o = i * 6
      out[o] = this.points[a][0]
      out[o + 1] = this.points[a][1]
      out[o + 2] = this.points[a][2]
      out[o + 3] = this.points[b][0]
      out[o + 4] = this.points[b][1]
      out[o + 5] = this.points[b][2]
    })
    return out
  }

  toBuffers() {
    return {
      nom: this.nom,
      positions: this.positions,
      indices: this.indices,
      wire: this.wire,
      color: this.color,
      couleur: this.couleur,
    }
  }
}

/** Couleurs debug des 4 couches + teinte solide par panneau. */
const RECT_COLORS = {
  fond: {
    base: '#4cc9f0',
    decale: '#f72585',
    tolerance: '#ffd60a',
    arriere: '#80ed99',
    solid: '#8d6e4c',
  },
  porte: {
    base: '#90e0ef',
    decale: '#ff85a1',
    tolerance: '#ffe566',
    arriere: '#95d5b2',
    solid: '#c4a574',
  },
  dessous: {
    base: '#48cae4',
    decale: '#e85d75',
    tolerance: '#f4d35e',
    arriere: '#6bcb77',
    solid: '#6b5344',
  },
  dessus_interieur: {
    base: '#00b4d8',
    decale: '#d62828',
    tolerance: '#fcbf49',
    arriere: '#2a9d8f',
    solid: '#c4a574',
  },
  dessus_exterieur: {
    base: '#48cae4',
    decale: '#e63946',
    tolerance: '#f77f00',
    arriere: '#2a9d8f',
    solid: '#a67c52',
  },
  joue1: {
    base: '#0077b6',
    decale: '#9b2226',
    tolerance: '#e9c46a',
    arriere: '#52b788',
    solid: '#d4b896',
  },
  joue2: {
    base: '#023e8a',
    decale: '#ae2012',
    tolerance: '#e76f51',
    arriere: '#40916c',
    solid: '#9a7b4f',
  },
}

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
 * Construit un panneau nommé (fond | porte | …) via les 4 fonctions matrice.
 *
 * @param {string} nom — clé dans PANNEAU_DEFS
 * @param {{ L: number, W: number, H: number }} dims
 * @param {{ epaisseur?: number, tolerance?: number, decalage?: number }} [params]
 */
export function buildPanneauComplet(nom, dims, params = {}) {
  const def = PANNEAU_DEFS[nom]
  if (!def) throw new Error(`buildPanneauComplet : PANNEAU_DEFS.${nom} absent`)

  const { byId } = buildGeometrie(dims)
  const {
    base,
    decale,
    tolerance,
    arriere,
    params: resolved,
  } = computeQuatreRectangles(def, byId, params)

  const colors = RECT_COLORS[nom] || RECT_COLORS.fond

  const rectangles = {
    base: new Rectangle3D(`${nom}-base`, base, colors.base),
    decale: new Rectangle3D(`${nom}-decale`, decale, colors.decale),
    tolerance: new Rectangle3D(`${nom}-tolerance`, tolerance, colors.tolerance),
    arriere: new Rectangle3D(`${nom}-arriere`, arriere, colors.arriere),
  }

  const panneau = new Panneau(nom, [...tolerance, ...arriere], {
    normal: def.normal,
    direction: def.direction,
    texture: def.texture,
    epaisseur: resolved.epaisseur,
  })

  const solidColor = def.couleur || colors.solid || '#c4a574'

  return {
    nom,
    rectangles,
    panneau,
    solidColor,
    params: resolved,
    points: {
      point1: base[0],
      point2: base[1],
      point3: base[2],
      point4: base[3],
      point_face1: decale[0],
      point_face2: decale[1],
      point_face3: decale[2],
      point_face4: decale[3],
      point_rectangle1: tolerance[0],
      point_rectangle2: tolerance[1],
      point_rectangle3: tolerance[2],
      point_rectangle4: tolerance[3],
      point_arriere1: arriere[0],
      point_arriere2: arriere[1],
      point_arriere3: arriere[2],
      point_arriere4: arriere[3],
    },
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
 * @returns {import('../00_matrice/matrice_panneau_grok.js').Panneau}
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
  WURTH_DRAWER_TYPE,
  WURTH_HAUTEURS_MM,
  WURTH_HAUTEUR_DEFAUT_MM,
  WURTH_DECROCHE_DYNAMOOV_MM,
  WURTH_PROFONDEURS_MM,
  WURTH_PROFONDEUR_MIN_MM,
  DRAWER_DEPTH_TOO_SMALL_MSG,
  computeWurthDrawerDims,
  clampWurthHeight,
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
 * Z tablette (mm) = **haut** de l’octogone (face supérieure).
 * Clamp pour laisser la place à l’épaisseur (vers le bas) + traverses (vers le haut).
 */
export function shelfZMm(mod, dims, moduleList = []) {
  const { H } = dims
  const inset = 22
  const extrusion = areteExtrusionMm(dims)
  // Bas du plateau ≥ inset ; haut + extrusion traverses (section arête) ≤ H − inset
  const zMin = inset + EPAISSEUR_PANNEAU
  const zMax = Math.max(zMin, H - inset - extrusion)
  if (mod.zMm != null && Number.isFinite(Number(mod.zMm))) {
    return Math.min(zMax, Math.max(zMin, Number(mod.zMm)))
  }
  const sameKind = moduleList.filter((m) => m.kind === 'shelf')
  const count = Math.max(sameKind.length, 1)
  const index = sameKind.findIndex((m) => m.id === mod.id)
  const i = index >= 0 ? index : mod.bayIndex ?? 0
  const step = (zMax - zMin) / (count + 1)
  return zMin + step * (i + 1)
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
    const zCenter = zTop - EPAISSEUR_PANNEAU / 2
    return {
      center: [L / 2, W / 2, zCenter],
      size: [innerL, innerW, EPAISSEUR_PANNEAU],
      openOffset: [0, 0, 0],
      zMm: zTop,
      zTopMm: zTop,
      zMin: inset + EPAISSEUR_PANNEAU,
      zMax: Math.max(inset + EPAISSEUR_PANNEAU, H - inset - extrusion),
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
     * zMm = bas des joues du tiroir (= dessus des traverses Y / plan rails).
     * Traverses extrudées vers le bas sous ce plan.
     */
    const zMin = z0 + extrusion
    const zMax = Math.max(zMin, H - inset - drawerH)
    let zSideBottom
    if (mod.zMm != null && Number.isFinite(Number(mod.zMm))) {
      zSideBottom = Math.min(zMax, Math.max(zMin, Number(mod.zMm)))
    } else {
      const gap = 8
      const stackH = drawerH + gap
      zSideBottom = zMin + i * stackH
      zSideBottom = Math.min(zMax, Math.max(zMin, zSideBottom))
    }
    const zCenter = zSideBottom + drawerH / 2
    const open = (mod.openFactor || 0) * (Math.max(wurth.depthMm, 1) * 0.55)
    return {
      center: [
        L / 2,
        (traverseBounds.minY + traverseBounds.maxY) / 2 - open,
        zCenter,
      ],
      size: [wurth.licMm, Math.max(wurth.depthMm, 1), drawerH],
      openOffset: [0, -open, 0],
      wurth,
      zMm: zSideBottom,
      zBottomMm: zSideBottom,
      /** Bas d’extrusion des traverses (dessous) */
      zTraverseMm: zSideBottom - extrusion,
      zMin,
      zMax,
      hMm: drawerH,
      licMm: wurth.licMm,
      lwkMm: wurth.lwkMm,
      depthMm: wurth.depthMm,
      depthTooSmall: Boolean(wurth.depthTooSmall),
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
