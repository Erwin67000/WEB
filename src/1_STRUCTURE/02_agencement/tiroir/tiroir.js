/**
 * Tiroir paramétrique :
 *  1. Paire de traverses (identiques tablette) — buildTraversePair
 *  2. 2 rails symétriques, alignés axe Y avec les traverses (STL Onshape)
 *  3. Cadre = boîte ouverte 5 faces (épaisseur panneau), **ouverture Z top**
 *
 * Origine STL Onshape non fiable → normalisation auto (µm→mm + min corner → 0).
 * Longueur STL brute ~550 mm sur Y → re-scale pour coller à la portée Y des traverses.
 */
import { EPAISSEUR_PANNEAU } from '../../00_matrice/matrice_constante.js'
import {
  buildTraversePair,
  TRAVERSE_EXTRUSION_MM,
} from '../traverse.js'
import {
  WURTH_DRAWER_TYPE,
  WURTH_DECROCHE_DYNAMOOV_MM,
  WURTH_HAUTEUR_DEFAUT_MM,
  computeWurthDrawerDims,
} from './wurth.js'

export {
  WURTH_DRAWER_TYPE,
  WURTH_HAUTEURS_MM,
  WURTH_HAUTEUR_DEFAUT_MM,
  WURTH_DECROCHE_DYNAMOOV_MM,
  WURTH_PROFONDEURS_MM,
  WURTH_PROFONDEUR_MIN_MM,
  DRAWER_DEPTH_TOO_SMALL_MSG,
  computeWurthDrawerDims,
  clampWurthHeight,
} from './wurth.js'

/** URL du rail gauche (public). */
export const RAIL_STL_URL = '/structure/agencement/rail-gauche.stl'

/**
 * Correction d’origine / échelle du STL Onshape.
 * Mesure brute : size ~ [54600, 550000, 47200] → microns → mm (×0.001).
 * Après normalize : long axe = +Y (aligné traverses).
 */
export const RAIL_STL_SCALE = 0.001
/** Offset mm après normalisation (repère meuble). */
export const RAIL_MOUNT_OFFSET = { x: 0, y: 0, z: 0 }
/** Marge intérieure face traverse → rail (mm). */
export const RAIL_INSET_FROM_TRAVERSE = 2
/** Longueur native du rail après scale µm→mm (axe Y). */
export const RAIL_NATIVE_LENGTH_Y_MM = 550

/**
 * Boîte ouverte 5 panneaux — **face ouverte = Z top**.
 * Type B Würth : décroché bas `decrocheMm` (11 mm) sous le fond pour rails DYNAMOOV.
 * Les côtés descendent jusqu’à oz ; le fond est surélevé de decrocheMm.
 *
 * @param {{ L: number, W: number, H: number }} outer — dims extérieures (LIC × profondeur × H Würth)
 * @param {number[]} origin — coin min [x,y,z] mm (bas des joues = plan rails)
 * @param {number} [epaisseur=EPAISSEUR_PANNEAU]
 * @param {number} [decrocheMm=WURTH_DECROCHE_DYNAMOOV_MM]
 */
export function buildDrawerOpenBox(
  outer,
  origin,
  epaisseur = EPAISSEUR_PANNEAU,
  decrocheMm = WURTH_DECROCHE_DYNAMOOV_MM,
) {
  const [ox, oy, oz] = origin
  const { L, W, H } = outer
  const e = epaisseur
  const d = Math.max(0, decrocheMm)
  const panels = []

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
    return solidFromBoxPoints(id, pts)
  }

  // Fond surélevé (décroché type B) — laisse le passage rails sous le tiroir
  const zFond = oz + d
  panels.push(plate('dessous', ox, oy, zFond, L, W, e))

  // Côtés pleine hauteur H depuis oz (décroché visible en bas)
  // Fond / arrière / joues : de oz jusqu’à oz+H (ouverture Z top)
  const sideH = H
  panels.push(plate('fond', ox, oy, oz, L, e, sideH))
  panels.push(plate('arriere', ox, oy + W - e, oz, L, e, sideH))
  panels.push(plate('joue_g', ox, oy + e, oz, e, W - 2 * e, sideH))
  panels.push(plate('joue_d', ox + L - e, oy + e, oz, e, W - 2 * e, sideH))

  return {
    kind: 'drawer-box',
    openFace: 'Z_top',
    type: WURTH_DRAWER_TYPE,
    decrocheMm: d,
    origin: [ox, oy, oz],
    outer: { L, W, H },
    epaisseur: e,
    panels,
  }
}

function solidFromBoxPoints(id, pts8) {
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
 * 2 rails alignés **axe Y** avec les traverses (portée profondeur).
 * STL normalisé : long axe = +Y.
 *
 * @param {[object, object]} traversePair — [left, right]
 * @param {object} [opts]
 */
export function buildDrawerRails(traversePair, opts = {}) {
  const [left, right] = traversePair
  const inset = opts.inset ?? RAIL_INSET_FROM_TRAVERSE
  // Rail posé sur le plan haut des traverses (même Z base + petit lift)
  const z = left.zTopMm + (opts.zLift ?? 1)

  const spanY = Math.max(
    50,
    left.bounds2D.maxY - left.bounds2D.minY,
  )
  // Scale Y pour coller la longueur du rail à la traverse
  const scaleY = spanY / RAIL_NATIVE_LENGTH_Y_MM

  const y0 = left.bounds2D.minY + (RAIL_MOUNT_OFFSET.y || 0)

  const leftMount = {
    id: 'rail-left',
    side: 'left',
    stlUrl: RAIL_STL_URL,
    /** Origine STL normalisée (min corner) → début de la traverse en Y */
    position: [
      left.innerX + inset + (RAIL_MOUNT_OFFSET.x || 0),
      y0,
      z + (RAIL_MOUNT_OFFSET.z || 0),
    ],
    /** Alignement long axe = Y (traverses) */
    axis: 'Y',
    mirrorX: false,
    /** Facteurs d’échelle locaux (géométrie déjà en mm) */
    scale: { x: 1, y: scaleY, z: 1 },
    rotation: [0, 0, 0],
    spanY,
  }

  const rightMount = {
    id: 'rail-right',
    side: 'right',
    stlUrl: RAIL_STL_URL,
    position: [
      right.innerX - inset - (RAIL_MOUNT_OFFSET.x || 0),
      y0,
      z + (RAIL_MOUNT_OFFSET.z || 0),
    ],
    axis: 'Y',
    mirrorX: true,
    scale: { x: 1, y: scaleY, z: 1 },
    rotation: [0, 0, 0],
    spanY,
  }

  return [leftMount, rightMount]
}

/**
 * Tiroir Würth type B complet.
 *
 * @param {{ L: number, W: number, H: number }} dims
 * @param {object} layout — moduleLayout(drawer) avec wurth / size
 * @param {object} [mod] — module store (hMm)
 */
export function buildTiroir(dims, layout, mod = {}, opts = {}) {
  const ep = opts.epaisseurMm ?? EPAISSEUR_PANNEAU
  const open = layout.openOffset?.[1] || 0

  // zMm module = bas du tiroir ; traverses juste en dessous
  const zBottom =
    layout.zBottomMm ??
    layout.zMm ??
    Math.max(20, (layout.center?.[2] ?? 100) - (layout.hMm ?? 110) / 2)
  const zTraverse =
    layout.zTraverseMm ?? Math.max(8, zBottom - TRAVERSE_EXTRUSION_MM)

  const traverses = buildTraversePair(dims, zTraverse, {
    leftId: 'drawer-traverse-left',
    rightId: 'drawer-traverse-right',
  })

  const [trL, trR] = traverses
  const traverseBounds = {
    minX: trL.innerX,
    maxX: trR.innerX,
    minY: Math.min(trL.bounds2D.minY, trR.bounds2D.minY),
    maxY: Math.max(trL.bounds2D.maxY, trR.bounds2D.maxY),
  }

  const wurth =
    layout.wurth ||
    computeWurthDrawerDims(dims, mod, traverseBounds)

  // Pas de géométrie utile si profondeur < 250 mm
  if (wurth.depthTooSmall || wurth.depthMm < 250) {
    return {
      kind: 'drawer',
      type: WURTH_DRAWER_TYPE,
      wurth,
      traverses: [],
      rails: [],
      box: { panels: [], openFace: 'Z_top' },
      depthTooSmall: true,
      openOffset: layout.openOffset || [0, 0, 0],
      layout,
    }
  }

  const rails = buildDrawerRails(traverses, {
    zLift: TRAVERSE_EXTRUSION_MM,
  })

  const originX =
    (traverseBounds.minX + traverseBounds.maxX) / 2 - wurth.licMm / 2
  const originY =
    (traverseBounds.minY + traverseBounds.maxY) / 2 -
    wurth.depthMm / 2 -
    open
  // Bas des joues = position Z choisie
  const originZ = zBottom

  const box = buildDrawerOpenBox(
    { L: wurth.licMm, W: wurth.depthMm, H: wurth.hMm },
    [originX, originY, originZ],
    ep,
    wurth.decrocheMm,
  )

  return {
    kind: 'drawer',
    type: WURTH_DRAWER_TYPE,
    wurth,
    traverses,
    rails,
    box,
    openFace: 'Z_top',
    openOffset: layout.openOffset || [0, 0, 0],
    layout,
  }
}

/**
 * Normalise la géométrie rail (mm, origine min) :
 *  - µm → mm si besoin
 *  - coin min → (0,0,0)
 *  - conserve repère CAD : X=largeur, **Y=longueur (axe traverses)**, Z=hauteur
 *
 * @param {import('three').BufferGeometry} geometry
 */
export function normalizeRailGeometry(geometry, scale = RAIL_STL_SCALE) {
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  if (!box) return geometry

  const sizeX = box.max.x - box.min.x
  const s = sizeX > 500 ? scale : 1
  if (s !== 1) {
    geometry.scale(s, s, s)
    geometry.computeBoundingBox()
  }

  const b = geometry.boundingBox
  geometry.translate(-b.min.x, -b.min.y, -b.min.z)
  geometry.computeBoundingBox()
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Convertit une géométrie rail (mm, Y=longueur) vers le repère Three du site :
 *   meuble (x,y,z) → Three (x, z, −y)  × 0.001
 * avec scaleY optionnel pour coller à la portée de la traverse.
 *
 * @param {import('three').BufferGeometry} geometryMm — déjà normalisée
 * @param {number} [scaleY=1]
 * @param {boolean} [mirrorX=false]
 * @returns {import('three').BufferGeometry}
 */
export function railGeometryToThree(geometryMm, scaleY = 1, mirrorX = false) {
  const geo = geometryMm.clone()
  const pos = geo.attributes.position
  const SCALE = 0.001
  const sx = mirrorX ? -1 : 1
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) * sx
    const y = pos.getY(i) * scaleY
    const z = pos.getZ(i)
    // meuble → Three
    pos.setXYZ(i, x * SCALE, z * SCALE, -y * SCALE)
  }
  pos.needsUpdate = true
  geo.computeBoundingBox()
  geo.computeVertexNormals()
  return geo
}
