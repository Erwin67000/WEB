/**
 * Ossature — transforme L, W, H en géométrie 3D prête pour le rendu.
 */
import {
  buildGeometrie,
  ligne_arete,
  face_arete,
  toOssatureJson,
} from '../00_matrice/matrice_geometrie.js'
import { LARGEUR_ARETE, HAUTEUR_ARETE } from '../00_matrice/matrice_constante.js'

/**
 * Classe Meuble : 12 arêtes + métriques.
 */
export class Meuble {
  /**
   * @param {{ L: number, W: number, H: number }} dims mm
   */
  constructor(dims) {
    this.dims = { ...dims }
    this._geo = null
  }

  get geometry() {
    if (!this._geo) {
      this._geo = buildGeometrie(this.dims)
    }
    return this._geo
  }

  setDims(dims) {
    this.dims = { ...dims }
    this._geo = null
  }

  /** Longueur totale des 12 arêtes (mm). */
  get totalEdgeLengthMm() {
    const { L, W, H } = this.dims
    return 4 * L + 4 * W + 4 * H
  }

  /** Volume approximatif section 40×40 (m³). */
  get woodVolumeM3() {
    const section = (LARGEUR_ARETE / 1000) * (HAUTEUR_ARETE / 1000)
    return (this.totalEdgeLengthMm / 1000) * section
  }

  toJSON() {
    return toOssatureJson(this.dims)
  }
}

/**
 * Construit buffers Three.js-ready pour une arête.
 * @returns {{ positions: Float32Array, indices: Uint16Array, wire: Float32Array }}
 */
export function areteToBuffers(points) {
  const positions = new Float32Array(points.length * 3)
  for (let i = 0; i < points.length; i++) {
    positions[i * 3] = points[i][0]
    positions[i * 3 + 1] = points[i][1]
    positions[i * 3 + 2] = points[i][2]
  }

  // face_arete : triangles de surface (plein)
  const indices = new Uint16Array(face_arete.length * 3)
  face_arete.forEach((tri, i) => {
    indices[i * 3] = tri[0]
    indices[i * 3 + 1] = tri[1]
    indices[i * 3 + 2] = tri[2]
  })

  // ligne_arete : segments filaires (anciennement "connections")
  const wire = new Float32Array(ligne_arete.length * 6)
  ligne_arete.forEach(([a, b], i) => {
    const o = i * 6
    wire[o] = points[a][0]
    wire[o + 1] = points[a][1]
    wire[o + 2] = points[a][2]
    wire[o + 3] = points[b][0]
    wire[o + 4] = points[b][1]
    wire[o + 5] = points[b][2]
  })

  return { positions, indices, wire }
}

/**
 * Entrée principale : dims → données d'ossature pour le viewer.
 */
export function buildOssature({ L, W, H }) {
  const meuble = new Meuble({ L, W, H })
  const { aretes, vertices, byId, dimensions } = meuble.geometry

  const meshes = aretes.map((arete) => ({
    id: arete.id,
    axis: arete.axis,
    ...areteToBuffers(arete.points),
  }))

  return {
    meuble,
    aretes,
    vertices,
    byId,
    dimensions,
    meshes,
    metrics: {
      totalEdgeLengthMm: meuble.totalEdgeLengthMm,
      woodVolumeM3: meuble.woodVolumeM3,
    },
  }
}

export default { Meuble, buildOssature, areteToBuffers }
