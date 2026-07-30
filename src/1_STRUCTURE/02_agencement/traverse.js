/**
 * Traverses paramétriques (profil 6 pts en plan XY, extrusion +Z).
 * Toujours utilisées **par paire** (gauche / droite) — tablette & tiroir.
 */
import { LARGEUR_ARETE } from '../00_matrice/matrice_constante.js'
import { buildGeometrie } from '../00_matrice/matrice_geometrie.js'

/** Épaisseur d’extrusion (mm) — section type arête 40. */
export const TRAVERSE_EXTRUSION_MM = LARGEUR_ARETE

/**
 * Profil gauche (X min) : Z0 — Z2, plan XY.
 * Z injecté par l’appelant (haut tablette / plan tiroir).
 * @type {{ arete: string, point: number, dX?: number, dY?: number }[]}
 */
export const TRAVERSE_PROFILE_LEFT = [
  { arete: 'Z0', point: 3 },
  { arete: 'Z0', point: 5 },
  { arete: 'Z2', point: 5 },
  { arete: 'Z2', point: 3 },
  { arete: 'Z2', point: 3, dX: 11.75 },
  { arete: 'Z0', point: 3, dX: 11.75 },
]

/**
 * Profil droit (X max) : Z1 — Z3.
 * @type {typeof TRAVERSE_PROFILE_LEFT}
 */
export const TRAVERSE_PROFILE_RIGHT = [
  { arete: 'Z1', point: 3 },
  { arete: 'Z1', point: 5 },
  { arete: 'Z3', point: 5 },
  { arete: 'Z3', point: 3 },
  { arete: 'Z3', point: 3, dX: -11.75 },
  { arete: 'Z1', point: 3, dX: -11.75 },
]

/** @deprecated alias */
export const TRAVERSE_PROFILE_6 = TRAVERSE_PROFILE_LEFT
/** @deprecated alias */
export const TRAVERSE_PROFILE_6_BACK = TRAVERSE_PROFILE_RIGHT

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

export const face_traverse = (() => {
  const faces = []
  for (let i = 1; i < 5; i++) faces.push([0, i + 1, i])
  for (let i = 1; i < 5; i++) faces.push([6, 6 + i, 6 + i + 1])
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6
    faces.push([i, j, 6 + j])
    faces.push([i, 6 + j, 6 + i])
  }
  return faces
})()

export function resolveTraverseRef2D(byId, ref) {
  const edge = byId?.[ref?.arete]
  if (!edge) throw new Error(`Traverse : arête inconnue "${ref?.arete}"`)
  const p = edge.points[Number(ref.point)]
  if (!p) {
    throw new Error(
      `Traverse : point ${ref.point} hors plage sur ${ref.arete}`,
    )
  }
  const dX = Number(ref.dX ?? ref.offsetX ?? 0) || 0
  const dY = Number(ref.dY ?? ref.offsetY ?? 0) || 0
  return [p[0] + dX, p[1] + dY]
}

export function resolveTraverseProfile2D(dims, refs = TRAVERSE_PROFILE_LEFT) {
  if (!Array.isArray(refs) || refs.length !== 6) {
    throw new Error(`Traverse : 6 refs 2D requises, reçu ${refs?.length ?? 0}`)
  }
  if (Array.isArray(refs[0])) {
    throw new Error('Traverse : utiliser { arete, point, dX? }')
  }
  const { byId } = buildGeometrie(dims)
  return refs.map((ref) => resolveTraverseRef2D(byId, ref))
}

/**
 * Une traverse : profil 2D à zTopMm, extrusion +Z.
 */
export function buildTraverse({
  dims,
  zTopMm = 0,
  extrusionMm = TRAVERSE_EXTRUSION_MM,
  profileRefs = TRAVERSE_PROFILE_LEFT,
  id = 'traverse',
  side = 'left',
} = {}) {
  if (!dims) throw new Error('Traverse : dims requis')
  const xy = resolveTraverseProfile2D(dims, profileRefs)
  const z0 = Number(zTopMm)
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

  // Emprise XY pour positionner rails / tiroirs
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const [x, y] of xy) {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }

  return {
    id,
    side,
    direction: 'Z',
    points,
    positions,
    indices,
    wire,
    material: 'arete',
    extrusionMm,
    zTopMm: z0,
    zTop: z0 + extrusionMm,
    profile2D: xy.map((p) => [...p]),
    bounds2D: { minX, maxX, minY, maxY },
    /** Face intérieure (vers le centre meuble) pour coller le rail */
    innerX: side === 'left' ? maxX : minX,
  }
}

/**
 * Paire de traverses Y (gauche + droite) au même Z.
 * Point d’entrée unique pour tablette & tiroir.
 *
 * @param {{ L: number, W: number, H: number }} dims
 * @param {number} zTopMm — plan bas des traverses (haut plateau / plan tiroir)
 * @param {object} [opts]
 * @returns {[object, object]} [left, right]
 */
export function buildTraversePair(dims, zTopMm, opts = {}) {
  const extrusionMm = opts.extrusionMm ?? TRAVERSE_EXTRUSION_MM
  const left = buildTraverse({
    id: opts.leftId || 'traverse-left',
    side: 'left',
    dims,
    zTopMm,
    extrusionMm,
    profileRefs: opts.leftProfile || TRAVERSE_PROFILE_LEFT,
  })
  const right = buildTraverse({
    id: opts.rightId || 'traverse-right',
    side: 'right',
    dims,
    zTopMm,
    extrusionMm,
    profileRefs: opts.rightProfile || TRAVERSE_PROFILE_RIGHT,
  })
  return [left, right]
}

/** @deprecated → buildTraversePair */
export function buildTabletteTraverses(dims, zTopMm) {
  return buildTraversePair(dims, zTopMm)
}
