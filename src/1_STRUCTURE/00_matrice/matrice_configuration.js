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
 * @returns {{ points: number[][], positions: Float32Array, indices: Uint16Array, wire: Float32Array, zTop: number, zBot: number }}
 */
export function buildTablettePlateBuffers(dims, zCenterMm, epaisseurMm = EPAISSEUR_PANNEAU) {
  const half = epaisseurMm / 2
  const zTop = zCenterMm + half
  const zBot = zCenterMm - half
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
    /** Couleur filaire = noir (même logique panneau) */
    edgeColor: ARETE_EDGE_COLOR || '#0a0a0a',
  }
}

// ===========================================================================
// TRAVERSE — polygone 6 points + extrusion 40 mm (matière arête)
// ===========================================================================

/** Épaisseur d’extrusion traverse (mm) — section type arête 40. */
export const TRAVERSE_EXTRUSION_MM = LARGEUR_ARETE // 40

/**
 * Profil 6 points, parralèle à (plan Z) — sens horaire.
 * les coordonnées X et Y des points des aretes suivantes :
  { arete: 'Z0', point: 3 },
  { arete: 'Z0', point: 5 },
  { arete: 'Z1', point: 5 } + 20 dans le sens X,
  { arete: 'Z0', point: 5 } + 20 dans le sens X,
  { arete: 'Z1', point: 3 },
  { arete: 'Z0', point: 3 },
 * 
 */

export const TRAVERSE_PROFILE_6 = [
  { arete: 'Z0', point: 5 },
  { arete: 'Z0', point: 3 },
  { arete: 'Z2', point: 3 },
  { arete: 'Z2', point: 5 },
  { arete: 'Z2', point: 5, dX: 20 },   // ← point décalé +20 en X
  { arete: 'Z0', point: 5, dX: -20 }  // ← point décalé −20 en X
]
/**
 * Filaire traverse (12 points : 0..5 face A, 6..11 face B).
 * Affinable comme ligne_arete.
 */
export const ligne_traverse = [
  // Face A
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 0],
  // Face B
  [6, 7],
  [7, 8],
  [8, 9],
  [9, 10],
  [10, 11],
  [11, 6],
  // Extrusion
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
  // Face A (0..5)
  for (let i = 1; i < 5; i++) faces.push([0, i, i + 1])
  // Face B (6..11) winding opposé
  for (let i = 1; i < 5; i++) faces.push([6, 6 + i + 1, 6 + i])
  // Côtés
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6
    faces.push([i, j, 6 + j])
    faces.push([i, 6 + j, 6 + i])
  }
  return faces
})()

const AXIS_VEC = {
  X: [1, 0, 0],
  Y: [0, 1, 0],
  Z: [0, 0, 1],
}

/**
 * Construit une traverse paramétrique.
 *
 * @param {object} opts
 * @param {'X'|'Y'|'Z'} opts.direction — axe d’extrusion (épaisseur TRAVERSE_EXTRUSION_MM)
 * @param {number[]} opts.center — centre du profil [x,y,z] mm
 * @param {number} opts.halfLength — demi-portée le long de l’axe long du profil (mm)
 * @param {number} [opts.halfHeight=7] — demi-hauteur du profil (mm)
 * @param {number} [opts.extrusionMm=40]
 * @param {number[][]} [opts.profile6] — profil unitaire override
 * @returns {{
 *   id: string,
 *   direction: string,
 *   points: number[][],
 *   positions: Float32Array,
 *   indices: Uint16Array,
 *   wire: Float32Array,
 *   material: 'arete',
 * }}
 */
export function buildTraverse({
  direction = 'X',
  center = [0, 0, 0],
  halfLength = 100,
  halfHeight = 7,
  extrusionMm = TRAVERSE_EXTRUSION_MM,
  profile6 = TRAVERSE_PROFILE_6,
  id = 'traverse',
} = {}) {
  const dir = String(direction).toUpperCase()
  if (!AXIS_VEC[dir]) {
    throw new Error(`Traverse : direction invalide "${direction}" (X|Y|Z)`)
  }
  if (!profile6 || profile6.length !== 6) {
    throw new Error('Traverse : profil 6 points requis')
  }

  const ex = AXIS_VEC[dir]
  // Axes locaux du profil : u = long, v = haut (Z meuble), w = extrusion
  // long = perpendiculaire à extrusion dans le plan horizontal si possible
  let uAxis
  let vAxis = [0, 0, 1]
  if (dir === 'X') {
    uAxis = [0, 1, 0] // portée en Y
  } else if (dir === 'Y') {
    uAxis = [1, 0, 0] // portée en X
  } else {
    // Extrusion Z : profil dans XY
    uAxis = [1, 0, 0]
    vAxis = [0, 1, 0]
  }

  const faceA = profile6.map(([u, v]) => {
    const uu = u * halfLength
    const vv = v * halfHeight
    return [
      center[0] + uAxis[0] * uu + vAxis[0] * vv - (ex[0] * extrusionMm) / 2,
      center[1] + uAxis[1] * uu + vAxis[1] * vv - (ex[1] * extrusionMm) / 2,
      center[2] + uAxis[2] * uu + vAxis[2] * vv - (ex[2] * extrusionMm) / 2,
    ]
  })

  const faceB = faceA.map((p) => [
    p[0] + ex[0] * extrusionMm,
    p[1] + ex[1] * extrusionMm,
    p[2] + ex[2] * extrusionMm,
  ])

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
    direction: dir,
    points,
    positions,
    indices,
    wire,
    /** Même matière que l’ossature / arête */
    material: 'arete',
    extrusionMm,
    center: [...center],
  }
}

/**
 * Deux traverses sous la tablette (portée en profondeur Y, extrusion X).
 * Positions à ⅓ et ⅔ de L — répartition stable quand on ajoute des tablettes.
 *
 * @param {{ L: number, W: number, H: number }} dims
 * @param {number} zCenterMm — Z centre plateau
 * @param {number} [epaisseurPlateau=EPAISSEUR_PANNEAU]
 */
export function buildTabletteTraverses(
  dims,
  zCenterMm,
  epaisseurPlateau = EPAISSEUR_PANNEAU,
) {
  const { L, W } = dims
  const inset = 28
  const halfLen = Math.max(40, (W - 2 * inset) / 2)
  // Sous le plateau
  const zTrav = zCenterMm - epaisseurPlateau / 2 - 10
  const xs = [L * (1 / 3), L * (2 / 3)]

  return xs.map((x, i) =>
    buildTraverse({
      id: `traverse-${i}`,
      direction: 'X',
      center: [x, W / 2, zTrav],
      halfLength: halfLen,
      halfHeight: 8,
      extrusionMm: TRAVERSE_EXTRUSION_MM,
    }),
  )
}

/**
 * Tablette complète : plateau octogonal extrudé + 2 traverses.
 * Conserve le positionnement via zCenterMm (répartition shelfZMm).
 *
 * @param {{ L: number, W: number, H: number }} dims
 * @param {number} zCenterMm
 * @param {object} [opts]
 */
export function buildTablette(dims, zCenterMm, opts = {}) {
  const epaisseur = opts.epaisseurMm ?? EPAISSEUR_PANNEAU
  const plate = buildTablettePlateBuffers(dims, zCenterMm, epaisseur)
  const traverses = buildTabletteTraverses(dims, zCenterMm, epaisseur)
  return {
    kind: 'shelf',
    plate,
    traverses,
    zCenterMm,
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
  ligne_traverse,
  face_traverse,
  buildTraverse,
  buildTabletteTraverses,
}
