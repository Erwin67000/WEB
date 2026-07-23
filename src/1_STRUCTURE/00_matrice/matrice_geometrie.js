/**
 * Matrice géométrie Philae
 * 12 arêtes × 12 points = 144 points 3D (mm)
 * Formules paramétriques issues de master_geometrie.
 */
import {
  LARGEUR_ARETE,
  HAUTEUR_ARETE,
  ANGLE_GEOMETRIE,
} from './matrice_constante.js'

const l = LARGEUR_ARETE
const h = HAUTEUR_ARETE
const angle = ANGLE_GEOMETRIE

const delta_x = (Math.tan(angle) * l) / 2
const delta_hx = h * Math.tan(angle)

const R3 = Math.sqrt(h ** 2 + (l / 2) ** 2)
const acosVal = R3 > 0 ? Math.acos(l / 2 / R3) : 0
const Rot3_y = R3 * Math.cos(acosVal - Math.PI / 4)
const Rot3_z = R3 * Math.sin(acosVal - Math.PI / 4)

/** 12 points d'une arête selon X (longueur L). */
export function calcAreteX(L) {
  return [
    [0, 0, 0],
    [delta_hx, delta_hx, delta_hx],
    [delta_x, delta_x, -delta_x],
    [Rot3_y, Rot3_y, Rot3_z],
    [delta_x, -delta_x, delta_x],
    [Rot3_y, Rot3_z, Rot3_y],
    [L, 0, 0],
    [L - delta_hx, delta_hx, delta_hx],
    [L - delta_x, delta_x, -delta_x],
    [L - Rot3_y, Rot3_y, Rot3_z],
    [L - delta_x, -delta_x, delta_x],
    [L - Rot3_y, Rot3_z, Rot3_y],
  ]
}

/** 12 points d'une arête selon Y (profondeur W). */
export function calcAreteY(W) {
  return [
    [0, 0, 0],
    [delta_hx, delta_hx, delta_hx],
    [-delta_x, delta_x, delta_x],
    [Rot3_z, Rot3_y, Rot3_y],
    [delta_x, delta_x, -delta_x],
    [Rot3_y, Rot3_y, Rot3_z],
    [0, W, 0],
    [delta_hx, W - delta_hx, delta_hx],
    [-delta_x, W - delta_x, delta_x],
    [Rot3_z, W - Rot3_y, Rot3_y],
    [delta_x, W - delta_x, -delta_x],
    [Rot3_y, W - Rot3_y, Rot3_z],
  ]
}

/** 12 points d'une arête selon Z (hauteur H). */
export function calcAreteZ(H) {
  return [
    [0, 0, 0],
    [delta_hx, delta_hx, delta_hx],
    [delta_x, -delta_x, delta_x],
    [Rot3_y, Rot3_z, Rot3_y],
    [-delta_x, delta_x, delta_x],
    [Rot3_z, Rot3_y, Rot3_y],
    [0, 0, H],
    [delta_hx, delta_hx, H - delta_hx],
    [delta_x, -delta_x, H - delta_x],
    [Rot3_y, Rot3_z, H - Rot3_y],
    [-delta_x, delta_x, H - delta_x],
    [Rot3_z, Rot3_y, H - Rot3_y],
  ]
}

/** 16 segments filaires par arête (indices dans les 12 points). */
export const ligne_arete = [
  [2, 8],
  [3, 9],
  [4, 10],
  [5, 11],
  [0, 2],
  [0, 4],
  [6, 10],
  [6, 8],
  [1, 3],
  [1, 5],
  [7, 11],
  [7, 9],
  [2, 3],
  [4, 5],
  [10, 11],
  [8, 9],
]

/** 12 triangles par arête (indices dans les 12 points). */
export const face_arete = [
  [0, 2, 8],
  [8, 6, 0],
  [6, 10, 4],
  [4, 0, 6],
  [1, 3, 9],
  [9, 7, 1],
  [7, 11, 5],
  [5, 1, 7],
  [2, 3, 8],
  [8, 3, 9],
  [4, 5, 10],
  [10, 5, 11],
]

/** Symétrie d'un nuage de points selon un axe et une dimension. */
export function symetrie(points, axis, dim) {
  return points.map((p) => {
    const [x, y, z] = p
    if (axis === 'x') return [dim - x, y, z]
    if (axis === 'y') return [x, dim - y, z]
    return [x, y, dim - z]
  })
}




/**
 * Classe arête : 12 points 3D + axes.
 */
export class Arete {
  /**
   * @param {string} id - ex. 'X0', 'Y2'
   * @param {number[][]} points - 12 points [x,y,z]
   * @param {'X'|'Y'|'Z'} axis
   */
  constructor(id, points, axis) {
    this.id = id
    this.points = points
    this.axis = axis
  }

  get vertexCount() {
    return this.points.length
  }
}

/** Classe geometrie : 12 arêtes
 Construit les 12 arêtes d'un meuble à partir de L, W, H (mm).
 @returns {{ aretes: Arete[], vertices: number[][], byId: Record<string, Arete> }}
 */

export function buildGeometrie({ L, W, H }) {
  const baseX = calcAreteX(L)
  const baseY = calcAreteY(W)
  const baseZ = calcAreteZ(H)

  const map = {
    X0: new Arete('X0', baseX, 'X'),
    Y0: new Arete('Y0', baseY, 'Y'),
    Z0: new Arete('Z0', baseZ, 'Z'),
    X1: new Arete('X1', symetrie(baseX, 'y', W), 'X'),
    X2: new Arete('X2', symetrie(baseX, 'z', H), 'X'),
    Y1: new Arete('Y1', symetrie(baseY, 'x', L), 'Y'),
    Y2: new Arete('Y2', symetrie(baseY, 'z', H), 'Y'),
    Z1: new Arete('Z1', symetrie(baseZ, 'x', L), 'Z'),
    Z2: new Arete('Z2', symetrie(baseZ, 'y', W), 'Z'),
    X3: new Arete('X3', symetrie(symetrie(baseX, 'y', W), 'z', H), 'X'),
    Y3: new Arete('Y3', symetrie(symetrie(baseY, 'x', L), 'z', H), 'Y'),
    Z3: new Arete('Z3', symetrie(symetrie(baseZ, 'x', L), 'y', W), 'Z'),
  }

  const order = [
    'X0', 'Y0', 'Z0', 'X1', 'X2', 'Y1', 'Y2', 'Z1', 'Z2', 'X3', 'Y3', 'Z3',
  ]
  const aretes = order.map((id) => map[id])
  const vertices = aretes.flatMap((a) => a.points)

  return { aretes, vertices, byId: map, dimensions: { L, W, H } }
}

/**
 * Export JSON ossature (compatible formats précédents).
 */
export function toOssatureJson({ L, W, H }) {
  const { vertices, aretes } = buildGeometrie({ L, W, H })
  return {
    kind: 'philae-ossature',
    unit: 'mm',
    dimensions: { L, W, H },
    areteCount: aretes.length,
    pointsPerArete: 12,
    vertices,
  }
}

export default {
  calcAreteX,
  calcAreteY,
  calcAreteZ,
  ligne_arete,
  face_arete,
  symetrie,
  Arete,
  buildGeometrie,
  toOssatureJson,
}
