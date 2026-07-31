/**
 * Tablette paramétrique :
 *  - panneau octogone (8 pts arêtes Z), Z = haut, extrusion −Z
 *  - paire de traverses (buildTraversePair) au-dessus, extrusion +Z
 */
import {
  EPAISSEUR_PANNEAU,
  ARETE_EDGE_COLOR,
} from '../../00_matrice/matrice_constante.js'
import { buildGeometrie } from '../../00_matrice/matrice_geometrie.js'
import {
  buildTraversePair,
  TRAVERSE_EXTRUSION_MM,
  TRAVERSE_PROFILE_LEFT,
  TRAVERSE_PROFILE_RIGHT,
  TRAVERSE_PROFILE_6,
  TRAVERSE_PROFILE_6_BACK,
  buildTraverse,
  buildTabletteTraverses,
  resolveTraverseRef2D,
  resolveTraverseProfile2D,
  ligne_traverse,
  face_traverse,
} from '../traverse.js'

export {
  TRAVERSE_EXTRUSION_MM,
  TRAVERSE_PROFILE_LEFT,
  TRAVERSE_PROFILE_RIGHT,
  TRAVERSE_PROFILE_6,
  TRAVERSE_PROFILE_6_BACK,
  buildTraverse,
  buildTraversePair,
  buildTabletteTraverses,
  resolveTraverseRef2D,
  resolveTraverseProfile2D,
  ligne_traverse,
  face_traverse,
}

/**
 * 8 points sur arêtes Z — sens horaire vue du dessus.
 * Coins : Z0(0,0) · Z1(L,0) · Z3(L,W) · Z2(0,W)
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

export const ligne_tablette = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 0],
  [8, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [12, 13],
  [13, 14],
  [14, 15],
  [15, 8],
  [0, 8],
  [1, 9],
  [2, 10],
  [3, 11],
  [4, 12],
  [5, 13],
  [6, 14],
  [7, 15],
]

export const face_tablette = (() => {
  const faces = []
  for (let i = 1; i < 7; i++) faces.push([0, i + 1, i])
  for (let i = 1; i < 7; i++) faces.push([8, 8 + i, 8 + i + 1])
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8
    faces.push([i, j, 8 + j])
    faces.push([i, 8 + j, 8 + i])
  }
  return faces
})()

export function resolveTabletteOctogone(
  dims,
  zPlane,
  refs = TABLETTE_OCTOGONE_REFS,
) {
  const { byId } = buildGeometrie(dims)
  if (refs.length !== 8) {
    throw new Error(`Tablette : 8 refs requises, reçu ${refs.length}`)
  }
  return refs.map(({ arete, point }) => {
    const edge = byId[arete]
    if (!edge) throw new Error(`Tablette : arête Z inconnue "${arete}"`)
    const p = edge.points[point]
    if (!p) {
      throw new Error(`Tablette : point ${point} hors plage sur ${arete}`)
    }
    return [p[0], p[1], zPlane]
  })
}

/** Extrusion polygone vers le bas (−Z). */
export function extrudePolygonZ(topPts, epaisseurMm) {
  const bot = topPts.map(([x, y, z]) => [x, y, z - epaisseurMm])
  return [...topPts.map((p) => [...p]), ...bot]
}

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

/**
 * Décalage Z des traverses Y par rapport au haut du plateau (mm).
 * 0 = assises sur le plateau (position correcte d’origine).
 */
export const TABLETTE_TRAVERSE_Z_LIFT_MM = 0

/**
 * Tablette complète : plateau + paire de traverses.
 * @param {{ L: number, W: number, H: number }} dims
 * @param {number} zTopMm — haut de l’octogone
 */
export function buildTablette(dims, zTopMm, opts = {}) {
  const epaisseur = opts.epaisseurMm ?? EPAISSEUR_PANNEAU
  const plate = buildTablettePlateBuffers(dims, zTopMm, epaisseur)
  const lift = opts.traverseZLiftMm ?? TABLETTE_TRAVERSE_Z_LIFT_MM
  // Traverses au niveau du haut du plateau (+ lift optionnel)
  const traverses = buildTraversePair(dims, plate.zTop + lift)
  return {
    kind: 'shelf',
    plate,
    traverses,
    zTopMm: plate.zTop,
    zCenterMm: plate.zTop - epaisseur / 2,
    epaisseurMm: epaisseur,
    traverseZLiftMm: lift,
  }
}
