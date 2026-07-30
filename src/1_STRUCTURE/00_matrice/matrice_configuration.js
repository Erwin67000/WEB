/**
 * Matrice configuration — schéma meuble + modules paramétriques.
 *
 * Tablette : octogone irrégulier (8 points sur arêtes Z) extrudé = épaisseur panneau.
 * Traverse  : polygone 6 points extrudé 40 mm (matière ossature / arête).
 *
 * Les tableaux de topologie (ligne_*, face_*) se peaufinent comme ligne_arete.
 */
import { clampDims } from '../../3_INPUT/matrice_input.js'
import {
  EPAISSEUR_PANNEAU,
  LARGEUR_ARETE,
  ARETE_EDGE_COLOR,
} from './matrice_constante.js'
import { buildGeometrie } from './matrice_geometrie.js'

/** Modules d’agencement interne (la porte façade = panneau "porte" dans PANNEAU_DEFS). */
export const MODULE_KINDS = {
  shelf: { id: 'shelf', label: 'Tablette', icon: '▭' },
  drawer: { id: 'drawer', label: 'Tiroir', icon: '▤' },
}

// ---------------------------------------------------------------------------
// Scènes 3D
// ---------------------------------------------------------------------------

/**
 * Scènes 3D — départ : aucune.
 *
 * Convention SketchUp (référence pour toutes les scènes) :
 *   origine = point d’insertion meuble 1 (configurateur)
 *   +X = vers / contre le mur
 *   +Y = du mur vers le lit (profondeur pièce)
 *   +Z = haut
 */
export const ENVIRONMENTS = {
  none: {
    id: 'none',
    label: 'Aucune scène',
    bg: '#0a0a0a',
    grid: true,
    room: false,
    glb: null,
  },
  chambre: {
    id: 'chambre',
    label: 'Chambre',
    bg: '#1a1814',
    grid: false,
    room: false,
    glb: '/environnement/chambre/chambre.glb',
    position: [0, 0, 0],
    rotation: [0, Math.PI / 2, 0],
    scale: 1,
  },
}

let _seq = 0
export function uid(prefix = 'id') {
  _seq += 1
  return `${prefix}-${Date.now().toString(36)}-${_seq}`
}

export function makeQuoteRef() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `PHL-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

export function defaultUnit(overrides = {}) {
  const unit = {
    id: uid('meuble'),
    label: 'Meuble 1',
    dims: { L: 600, W: 400, H: 900 },
    positionMm: { x: 0, y: 0, z: 0 },
    rotationZ: 0,
    woodFinish: 'chene',
    ossatureFinish: 'brut',
    ossatureFinitionNote: '',
    panneauCouleur: 'gris_cendre',
    panneauCouleurHex: '#c9a227',
    modules: [],
    panneaux: [],
    ...overrides,
  }
  if (unit.dims) unit.dims = clampDims({ L: 600, W: 400, H: 900, ...unit.dims })
  return unit
}

export function defaultContact() {
  return {
    clientId: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    postalCode: '',
    city: '',
    country: 'FR',
  }
}

export function configRow(unit) {
  return {
    id: unit.id,
    label: unit.label,
    L: unit.dims.L,
    W: unit.dims.W,
    H: unit.dims.H,
    x: unit.positionMm.x,
    y: unit.positionMm.y,
    z: unit.positionMm.z,
    rotZ: unit.rotationZ,
    finish: unit.woodFinish,
    moduleCount: unit.modules?.length ?? 0,
    panneaux: (unit.panneaux || []).join(','),
  }
}

// ===========================================================================
// TABLETTE — octogone 8 points (arêtes Z) + extrusion panneau
// ===========================================================================

/**
 * Nuage de 8 points sur les arêtes Z (2 par poteau d’angle).
 * Ordre : sens horaire vue du dessus (+Z vers l’observateur).
 * Affinez `arete` + `point` (0..11) pour caler le plateau sur l’ossature.
 *
 * Coins meuble : Z0(0,0) · Z1(L,0) · Z3(L,W) · Z2(0,W)
 */
export const TABLETTE_OCTOGONE_REFS = [
  { arete: 'Z0', point: 5 },
  { arete: 'Z0', point: 3 },
  { arete: 'Z1', point: 3 },
  { arete: 'Z1', point: 5 },
  { arete: 'Z3', point: 5 },
  { arete: 'Z3', point: 3 },
  { arete: 'Z2', point: 3 },
  { arete: 'Z2', point: 5 },
]

/**
 * Filaire solide tablette (16 points : 0..7 face haute, 8..15 face basse).
 * Affinable comme ligne_panneau / ligne_arete.
 */
export const ligne_tablette = [
  // Contour face haute (octogone)
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 0],
  // Contour face basse
  [8, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [12, 13],
  [13, 14],
  [14, 15],
  [15, 8],
  // Montants d’extrusion
  [0, 8],
  [1, 9],
  [2, 10],
  [3, 11],
  [4, 12],
  [5, 13],
  [6, 14],
  [7, 15],
]

/**
 * Triangles tablette (16 points).
 * Faces haute / basse en éventail + quads latéraux → 2 triangles.
 */
export const face_tablette = (() => {
  const faces = []
  // Face haute 0..7 (normale +Z) — sens horaire vue dessus → winding inversé pour +Z
  for (let i = 1; i < 7; i++) faces.push([0, i + 1, i])
  // Face basse 8..15 (normale −Z)
  for (let i = 1; i < 7; i++) faces.push([8, 8 + i, 8 + i + 1])
  // Côtés
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8
    faces.push([i, j, 8 + j])
    faces.push([i, 8 + j, 8 + i])
  }
  return faces
})()

/**
 * Résout les 8 points XY depuis les arêtes Z, Z forcé au plan tablette.
 * @param {{ L: number, W: number, H: number }} dims
 * @param {number} zPlane — cote Z du plan (mm)
 * @param {typeof TABLETTE_OCTOGONE_REFS} [refs]
 * @returns {number[][]} 8 × [x,y,z]
 */
export function resolveTabletteOctogone(dims, zPlane, refs = TABLETTE_OCTOGONE_REFS) {
  const { byId } = buildGeometrie(dims)
  if (refs.length !== 8) {
    throw new Error(`Tablette : 8 refs requises, reçu ${refs.length}`)
  }
  return refs.map(({ arete, point }) => {
    const edge = byId[arete]
    if (!edge) throw new Error(`Tablette : arête Z inconnue "${arete}"`)
    const p = edge.points[point]
    if (!p) {
      throw new Error(
        `Tablette : point ${point} hors plage sur ${arete} (0..${edge.points.length - 1})`,
      )
    }
    // XY issus de l’arête Z ; Z = plan tablette (sélection point 3D affinée plus bas)
    return [p[0], p[1], zPlane]
  })
}

/**
 * Extrude un polygone plan le long de −Z (épaisseur panneau).
 * Points 0..n-1 = face haute, n..2n-1 = face basse.
 * @param {number[][]} topPts
 * @param {number} epaisseurMm
 */
export function extrudePolygonZ(topPts, epaisseurMm) {
  const n = topPts.length
  const bot = topPts.map(([x, y, z]) => [x, y, z - epaisseurMm])
  return [...topPts.map((p) => [...p]), ...bot]
}

/**
 * Buffers rendu tablette (plateau seul).
 *
 * @param {{ L: number, W: number, H: number }} dims
 * @param {number} zTopMm — **haut** de la tablette (face supérieure de l’octogone)
 * @param {number} [epaisseurMm]
 * Extrusion du polygone vers le bas (−Z).
 */
export function buildTablettePlateBuffers(
  dims,
  zTopMm,
  epaisseurMm = EPAISSEUR_PANNEAU,
) {
  const zTop = Number(zTopMm)
  const zBot = zTop - epaisseurMm
  const top = resolveTabletteOctogone(dims, zTop)
  const points = extrudePolygonZ(top, epaisseurMm)

  const positions = new Float32Array(points.length * 3)
  for (let i = 0; i < points.length; i++) {
    positions[i * 3] = points[i][0]
    positions[i * 3 + 1] = points[i][1]
    positions[i * 3 + 2] = points[i][2]
  }

  const indices = new Uint16Array(face_tablette.length * 3)
  face_tablette.forEach((tri, i) => {
    indices[i * 3] = tri[0]
    indices[i * 3 + 1] = tri[1]
    indices[i * 3 + 2] = tri[2]
  })

  const wire = new Float32Array(ligne_tablette.length * 6)
  ligne_tablette.forEach(([a, b], i) => {
    const o = i * 6
    wire[o] = points[a][0]
    wire[o + 1] = points[a][1]
    wire[o + 2] = points[a][2]
    wire[o + 3] = points[b][0]
    wire[o + 4] = points[b][1]
    wire[o + 5] = points[b][2]
  })

  return {
    points,
    positions,
    indices,
    wire,
    zTop,
    zBot,
    epaisseurMm,
    edgeColor: ARETE_EDGE_COLOR || '#0a0a0a',
  }
}

// ===========================================================================
// TRAVERSE — 6 points 2D (XY depuis arêtes Z) + extrusion 40 mm vers le haut
// ===========================================================================

/** Épaisseur d’extrusion traverse (mm). */
export const TRAVERSE_EXTRUSION_MM = LARGEUR_ARETE // 40

/**
 * Profil traverse côté X min (Z0 — Z2), plan XY.
 * Refs arête Z → on lit **seulement X,Y** ; Z = haut de tablette.
 * `dX` / `dY` optionnels (mm).
 *
 * @type {{ arete: string, point: number, dX?: number, dY?: number }[]}
 */
export const TRAVERSE_PROFILE_6 = [
  { arete: 'Z0', point: 5 },
  { arete: 'Z0', point: 3 },
  { arete: 'Z2', point: 3 },
  { arete: 'Z2', point: 5 },
  { arete: 'Z2', point: 5, dX: 20 },
  { arete: 'Z0', point: 5, dX: 20 },
]

/**
 * 2ᵉ traverse côté X max (Z1 — Z3).
 * @type {typeof TRAVERSE_PROFILE_6}
 */
export const TRAVERSE_PROFILE_6_BACK = [
  { arete: 'Z1', point: 5 },
  { arete: 'Z1', point: 3 },
  { arete: 'Z3', point: 3 },
  { arete: 'Z3', point: 5 },
  { arete: 'Z3', point: 5, dX: -20 },
  { arete: 'Z1', point: 5, dX: -20 },
]

/**
 * Résout une ref → [x, y] (2D). Le Z d’arête est ignoré.
 */
export function resolveTraverseRef2D(byId, ref) {
  const edge = byId?.[ref?.arete]
  if (!edge) {
    throw new Error(`Traverse : arête inconnue "${ref?.arete}"`)
  }
  const idx = Number(ref.point)
  const p = edge.points[idx]
  if (!p) {
    throw new Error(
      `Traverse : point ${ref.point} hors plage sur ${ref.arete} (0..${edge.points.length - 1})`,
    )
  }
  const dX = Number(ref.dX ?? ref.offsetX ?? 0) || 0
  const dY = Number(ref.dY ?? ref.offsetY ?? 0) || 0
  return [p[0] + dX, p[1] + dY]
}

/**
 * 6 × [x, y] depuis dims + refs.
 */
export function resolveTraverseProfile2D(dims, refs = TRAVERSE_PROFILE_6) {
  if (!Array.isArray(refs) || refs.length !== 6) {
    throw new Error(
      `Traverse : 6 refs 2D requises, reçu ${refs?.length ?? 0}`,
    )
  }
  // Accepte encore d’anciens profils numériques [u,v] (ne doit plus arriver)
  if (Array.isArray(refs[0])) {
    throw new Error(
      'Traverse : profil unitaire [u,v] obsolète — utiliser { arete, point, dX? }',
    )
  }
  const { byId } = buildGeometrie(dims)
  return refs.map((ref) => resolveTraverseRef2D(byId, ref))
}

/** Filaire traverse (12 points : 0..5 face bas / plan tablette, 6..11 face haut). */
export const ligne_traverse = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 0],
  [6, 7],
  [7, 8],
  [8, 9],
  [9, 10],
  [10, 11],
  [11, 6],
  [0, 6],
  [1, 7],
  [2, 8],
  [3, 9],
  [4, 10],
  [5, 11],
]

/** Triangles traverse (12 points). */
export const face_traverse = (() => {
  const faces = []
  // Face plan tablette (0..5) — normale −Z (dessous des montants)
  for (let i = 1; i < 5; i++) faces.push([0, i + 1, i])
  // Face haute (6..11) — normale +Z
  for (let i = 1; i < 5; i++) faces.push([6, 6 + i, 6 + i + 1])
  // Côtés
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6
    faces.push([i, j, 6 + j])
    faces.push([i, 6 + j, 6 + i])
  }
  return faces
})()

/**
 * Construit une traverse.
 *
 * Profil 2D (XY) sur le plan Z = zTopMm (haut de l’octogone tablette).
 * Extrusion vers le **haut** (+Z) de `extrusionMm` (40 mm).
 *
 * @param {object} opts
 * @param {{ L: number, W: number, H: number }} opts.dims
 * @param {number} opts.zTopMm — même Z que le dessus du plateau
 * @param {'Z'} [opts.direction='Z']
 * @param {number} [opts.extrusionMm]
 * @param {typeof TRAVERSE_PROFILE_6} [opts.profileRefs]
 * @param {string} [opts.id]
 */
export function buildTraverse({
  dims,
  zTopMm = 0,
  direction = 'Z',
  extrusionMm = TRAVERSE_EXTRUSION_MM,
  profileRefs = TRAVERSE_PROFILE_6,
  id = 'traverse',
} = {}) {
  if (!dims) {
    throw new Error('Traverse : dims requis pour résoudre le profil 2D')
  }

  const xy = resolveTraverseProfile2D(dims, profileRefs)
  const z0 = Number(zTopMm)

  // Face A = plan du dessus de tablette ; face B = extrudée vers +Z
  const faceA = xy.map(([x, y]) => [x, y, z0])
  const faceB = xy.map(([x, y]) => [x, y, z0 + extrusionMm])
  const points = [...faceA, ...faceB]

  const positions = new Float32Array(points.length * 3)
  for (let i = 0; i < points.length; i++) {
    positions[i * 3] = points[i][0]
    positions[i * 3 + 1] = points[i][1]
    positions[i * 3 + 2] = points[i][2]
  }

  const indices = new Uint16Array(face_traverse.length * 3)
  face_traverse.forEach((tri, i) => {
    indices[i * 3] = tri[0]
    indices[i * 3 + 1] = tri[1]
    indices[i * 3 + 2] = tri[2]
  })

  const wire = new Float32Array(ligne_traverse.length * 6)
  ligne_traverse.forEach(([a, b], i) => {
    const o = i * 6
    wire[o] = points[a][0]
    wire[o + 1] = points[a][1]
    wire[o + 2] = points[a][2]
    wire[o + 3] = points[b][0]
    wire[o + 4] = points[b][1]
    wire[o + 5] = points[b][2]
  })

  return {
    id,
    direction: String(direction).toUpperCase(),
    points,
    positions,
    indices,
    wire,
    material: 'arete',
    extrusionMm,
    zTopMm: z0,
    profile2D: xy.map((p) => [...p]),
  }
}

/**
 * Deux traverses **au-dessus** du plateau :
 *  - plan = haut de l’octogone (zTopMm)
 *  - extrusion +Z
 */
export function buildTabletteTraverses(dims, zTopMm) {
  return [
    buildTraverse({
      id: 'traverse-left',
      dims,
      zTopMm,
      profileRefs: TRAVERSE_PROFILE_6,
    }),
    buildTraverse({
      id: 'traverse-right',
      dims,
      zTopMm,
      profileRefs: TRAVERSE_PROFILE_6_BACK,
    }),
  ]
}

/**
 * Tablette complète.
 *
 * @param {{ L: number, W: number, H: number }} dims
 * @param {number} zTopMm — haut de la tablette (0 < Z < H), face sup. octogone
 * @param {object} [opts]
 */
export function buildTablette(dims, zTopMm, opts = {}) {
  const epaisseur = opts.epaisseurMm ?? EPAISSEUR_PANNEAU
  const plate = buildTablettePlateBuffers(dims, zTopMm, epaisseur)
  // Traverses : même plan que le dessus du plateau, extrusion vers le haut
  const traverses = buildTabletteTraverses(dims, plate.zTop)
  return {
    kind: 'shelf',
    plate,
    traverses,
    zTopMm: plate.zTop,
    /** rétrocompat (centre géométrique du plateau) */
    zCenterMm: plate.zTop - epaisseur / 2,
    epaisseurMm: epaisseur,
  }
}

export default {
  MODULE_KINDS,
  ENVIRONMENTS,
  uid,
  makeQuoteRef,
  defaultUnit,
  defaultContact,
  configRow,
  TABLETTE_OCTOGONE_REFS,
  ligne_tablette,
  face_tablette,
  resolveTabletteOctogone,
  extrudePolygonZ,
  buildTablettePlateBuffers,
  buildTablette,
  TRAVERSE_EXTRUSION_MM,
  TRAVERSE_PROFILE_6,
  TRAVERSE_PROFILE_6_BACK,
  resolveTraverseRef2D,
  resolveTraverseProfile2D,
  ligne_traverse,
  face_traverse,
  buildTraverse,
  buildTabletteTraverses,
}
