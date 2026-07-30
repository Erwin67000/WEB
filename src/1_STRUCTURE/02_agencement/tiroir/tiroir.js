/**
 * Tiroir paramétrique :
 *  1. Paire de traverses (identiques tablette) — buildTraversePair
 *  2. 2 rails symétriques, chacun à l’intérieur d’une traverse (STL Onshape)
 *  3. Cadre = boîte ouverte 5 faces (épaisseur panneau)
 *
 * Origine STL Onshape non fiable → normalisation auto (µm→mm + min corner → 0).
 */
import {
  EPAISSEUR_PANNEAU,
  PRIX,
} from '../../00_matrice/matrice_constante.js'
import {
  buildTraversePair,
  TRAVERSE_EXTRUSION_MM,
} from '../traverse.js'

/** URL du rail gauche (copie public + fallback source). */
export const RAIL_STL_URL = '/structure/agencement/rail-gauche.stl'

/**
 * Correction d’origine / échelle du STL Onshape.
 * Mesure brute : size ~ [54600, 550000, 47200] → microns → mm (×0.001).
 * Puis translation pour coller le coin min à l’origine locale du rail.
 *
 * Affine ici si le montage n’est pas parfait (mm).
 */
export const RAIL_STL_SCALE = 0.001
/** Offset supplémentaire après normalisation (mm) — fine-tune atelier. */
export const RAIL_MOUNT_OFFSET = { x: 0, y: 0, z: 0 }
/** Marge intérieure entre face interne traverse et rail (mm). */
export const RAIL_INSET_FROM_TRAVERSE = 2

/**
 * Filaire boîte ouverte 5 faces (pas de face Y max = ouverture façade).
 * Points 0..7 bas/haut fond+côtés — voir buildDrawerBox.
 */
export const ligne_tiroir_boite = [
  // Fond (Y min) contour bas
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  // Fond contour haut
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  // Montants fond
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
  // Face arrière (Y max intérieur) si présente — points 8..11 bas, 12..15 haut
  [8, 9],
  [9, 10],
  [10, 11],
  [11, 8],
  [12, 13],
  [13, 14],
  [14, 15],
  [15, 12],
  [8, 12],
  [9, 13],
  [10, 14],
  [11, 15],
  // Raccord côtés fond ↔ arrière (bas)
  [0, 8],
  [1, 9],
  [3, 11],
  [2, 10],
  [4, 12],
  [5, 13],
  [7, 15],
  [6, 14],
]

/**
 * Boîte ouverte 5 panneaux d’épaisseur `epaisseur` :
 * fond (Y min), 2 joues (X), dessous (Z min), dessus (Z max).
 * Ouverture vers +Y (façade).
 *
 * @param {{ L: number, W: number, H: number }} outer — dimensions extérieures mm
 * @param {number[]} origin — coin min [x,y,z] mm
 * @param {number} [epaisseur=EPAISSEUR_PANNEAU]
 */
export function buildDrawerOpenBox(
  outer,
  origin,
  epaisseur = EPAISSEUR_PANNEAU,
) {
  const [ox, oy, oz] = origin
  const { L, W, H } = outer
  const e = epaisseur
  const panels = []

  // Helper plaque axis-aligned
  const plate = (id, x0, y0, z0, sx, sy, sz) => {
    const pts = [
      [x0, y0, z0],
      [x0 + sx, y0, z0],
      [x0 + sx, y0 + sy, z0],
      [x0, y0 + sy, z0],
      [x0, y0, z0 + sz],
      [x0 + sx, y0, z0 + sz],
      [x0 + sx, y0 + sy, z0 + sz],
      [x0, y0 + sy, z0 + sz],
    ]
    // si une dim est nulle côté épaisseur, on force e
    return solidFromBoxPoints(id, pts)
  }

  // Dessous
  panels.push(
    plate('dessous', ox, oy, oz, L, W, e),
  )
  // Dessus
  panels.push(
    plate('dessus', ox, oy, oz + H - e, L, W, e),
  )
  // Fond (Y min)
  panels.push(
    plate('fond', ox, oy, oz + e, L, e, H - 2 * e),
  )
  // Joue gauche (X min)
  panels.push(
    plate('joue_g', ox, oy + e, oz + e, e, W - e, H - 2 * e),
  )
  // Joue droite (X max)
  panels.push(
    plate('joue_d', ox + L - e, oy + e, oz + e, e, W - e, H - 2 * e),
  )

  return {
    kind: 'drawer-box',
    origin: [ox, oy, oz],
    outer: { L, W, H },
    epaisseur: e,
    panels,
  }
}

function solidFromBoxPoints(id, pts8) {
  // 8 coins : 0-3 bas, 4-7 haut — même topo qu’un cube
  const faces = [
    [0, 2, 1],
    [0, 3, 2],
    [4, 5, 6],
    [4, 6, 7],
    [0, 1, 5],
    [0, 5, 4],
    [1, 2, 6],
    [1, 6, 5],
    [2, 3, 7],
    [2, 7, 6],
    [3, 0, 4],
    [3, 4, 7],
  ]
  const wirePairs = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ]
  const positions = new Float32Array(24)
  for (let i = 0; i < 8; i++) {
    positions[i * 3] = pts8[i][0]
    positions[i * 3 + 1] = pts8[i][1]
    positions[i * 3 + 2] = pts8[i][2]
  }
  const indices = new Uint16Array(faces.length * 3)
  faces.forEach((t, i) => {
    indices[i * 3] = t[0]
    indices[i * 3 + 1] = t[1]
    indices[i * 3 + 2] = t[2]
  })
  const wire = new Float32Array(wirePairs.length * 6)
  wirePairs.forEach(([a, b], i) => {
    const o = i * 6
    wire[o] = pts8[a][0]
    wire[o + 1] = pts8[a][1]
    wire[o + 2] = pts8[a][2]
    wire[o + 3] = pts8[b][0]
    wire[o + 4] = pts8[b][1]
    wire[o + 5] = pts8[b][2]
  })
  return { id, positions, indices, wire, points: pts8 }
}

/**
 * Placement des 2 rails à l’intérieur des traverses.
 * Retourne des descripteurs (pas de mesh) pour le rendu R3F.
 *
 * @param {[object, object]} traversePair — [left, right] de buildTraversePair
 * @param {object} [opts]
 */
export function buildDrawerRails(traversePair, opts = {}) {
  const [left, right] = traversePair
  const inset = opts.inset ?? RAIL_INSET_FROM_TRAVERSE
  const z = left.zTopMm + (opts.zLift ?? 2)

  // Rail gauche : face intérieure de la traverse left (+X)
  const leftMount = {
    id: 'rail-left',
    side: 'left',
    stlUrl: RAIL_STL_URL,
    /** Position origine normalisée du STL (mm, repère meuble) */
    position: [
      left.innerX + inset + (RAIL_MOUNT_OFFSET.x || 0),
      left.bounds2D.minY + (RAIL_MOUNT_OFFSET.y || 0),
      z + (RAIL_MOUNT_OFFSET.z || 0),
    ],
    /** Miroir X pour le rail droit uniquement */
    mirrorX: false,
    rotation: [0, 0, 0],
    scale: 1,
  }

  const rightMount = {
    id: 'rail-right',
    side: 'right',
    stlUrl: RAIL_STL_URL,
    position: [
      right.innerX - inset - (RAIL_MOUNT_OFFSET.x || 0),
      right.bounds2D.minY + (RAIL_MOUNT_OFFSET.y || 0),
      z + (RAIL_MOUNT_OFFSET.z || 0),
    ],
    mirrorX: true,
    rotation: [0, 0, 0],
    scale: 1,
  }

  return [leftMount, rightMount]
}

/**
 * Tiroir complet paramétrique.
 *
 * @param {{ L: number, W: number, H: number }} dims — meuble
 * @param {object} layout — moduleLayout(drawer)
 * @param {object} [opts]
 */
export function buildTiroir(dims, layout, opts = {}) {
  const ep = opts.epaisseurMm ?? EPAISSEUR_PANNEAU
  const drawerH =
    layout.size?.[2] ||
    opts.hMm ||
    PRIX.tiroirHauteurDefautMm ||
    200
  const open = layout.openOffset?.[1] || 0

  // Plan traverses = bas du volume tiroir (sous le coulissant)
  // zTop traverses : un peu sous le centre layout
  const zTraverse =
    (layout.center?.[2] ?? drawerH / 2) - drawerH / 2 - TRAVERSE_EXTRUSION_MM

  const traverses = buildTraversePair(dims, Math.max(20, zTraverse), {
    leftId: 'drawer-traverse-left',
    rightId: 'drawer-traverse-right',
  })

  const rails = buildDrawerRails(traverses, {
    zLift: TRAVERSE_EXTRUSION_MM * 0.25,
  })

  // Boîte ouverte entre les faces intérieures des traverses
  const [trL, trR] = traverses
  const boxL = Math.max(80, trR.innerX - trL.innerX - 2 * RAIL_INSET_FROM_TRAVERSE - 10)
  const boxW = Math.max(80, (layout.size?.[1] ?? dims.W * 0.7))
  const boxH = Math.max(40, drawerH - 8)
  const originX = trL.innerX + RAIL_INSET_FROM_TRAVERSE + 5
  const originY = (layout.center?.[1] ?? dims.W / 2) - boxW / 2 - open
  const originZ = (layout.center?.[2] ?? boxH / 2) - boxH / 2

  const box = buildDrawerOpenBox(
    { L: boxL, W: boxW, H: boxH },
    [originX, originY, originZ],
    ep,
  )

  return {
    kind: 'drawer',
    traverses,
    rails,
    box,
    openOffset: layout.openOffset || [0, 0, 0],
    layout,
  }
}

/**
 * Applique la correction d’origine sur une BufferGeometry Three déjà parsée.
 * (utilisé par le rendu — import THREE côté mesh uniquement)
 *
 * @param {import('three').BufferGeometry} geometry
 * @param {typeof RAIL_STL_SCALE} [scale]
 */
export function normalizeRailGeometry(geometry, scale = RAIL_STL_SCALE) {
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  if (!box) return geometry

  // Si déjà en mm (petite taille), ne pas re-scaler
  const sizeX = box.max.x - box.min.x
  const s = sizeX > 500 ? scale : 1
  if (s !== 1) {
    geometry.scale(s, s, s)
    geometry.computeBoundingBox()
  }

  const b = geometry.boundingBox
  // Coin min → origine (compense l’origine Onshape)
  geometry.translate(-b.min.x, -b.min.y, -b.min.z)
  geometry.computeBoundingBox()
  geometry.computeVertexNormals()
  return geometry
}
