/**
 * Tiroir Würth type B + coulisses Dynamoov (basse).
 *
 * Empilement Z (bas → haut), avec traverses Y en support des rails :
 *
 *   zTraverseTop  ─────── dessus traverse Y (violet sur le schéma)
 *   zRail         ─────── rail posé SUR la traverse (corps ~10–13 mm)
 *   zSideBottom   ─────── bas des joues du tiroir (= zMm utilisateur)
 *                    ↕ décroché type B 11 mm (rail dans le volume sous le fond)
 *   zFond         ─────── panneau de fond du tiroir
 *   zSideTop      ─────── haut des joues (ouverture Z top)
 *
 * Largeur (plan Dynamoov) :
 *   LWK = distance faces int. traverses
 *   LWS = LWK − 42  (21 mm / côté pour la coulisse)
 */
import { EPAISSEUR_PANNEAU } from '../../00_matrice/matrice_constante.js'
import {
  buildTraversePair,
  TRAVERSE_EXTRUSION_MM,
} from '../traverse.js'
import {
  WURTH_DRAWER_TYPE,
  WURTH_DECROCHE_DYNAMOOV_MM,
  DYNAMOOV_SIDE_RAIL_SPACE_MM,
  DYNAMOOV_RAIL_BODY_H_MM,
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
  DYNAMOOV_LWK_MINUS_LWS_MM,
  DYNAMOOV_SIDE_RAIL_SPACE_MM,
  DYNAMOOV_RAIL_BODY_H_MM,
  computeWurthDrawerDims,
  clampWurthHeight,
} from './wurth.js'

export const RAIL_STL_URL = '/structure/agencement/rail-gauche.stl'
export const RAIL_STL_SCALE = 0.001
/** Fine-tune mm (repère meuble) après normalize STL. */
export const RAIL_MOUNT_OFFSET = { x: 0, y: 0, z: 0 }
/** Longueur native rail après µm→mm (axe Y CAD). */
export const RAIL_NATIVE_LENGTH_Y_MM = 550

/**
 * Boîte type B — ouverture Z top, décroché bas pour Dynamoov.
 *
 * @param {{ L: number, W: number, H: number }} outer — LWS × profondeur × H
 * @param {number[]} origin — [x,y,z] bas des joues (z = zSideBottom)
 * @param {number} [epaisseur]
 * @param {number} [decrocheMm] — surélévation du fond (11 mm type B)
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

  // Fond surélevé (décroché B) — le rail Dynamoov passe dessous
  const zFond = oz + d
  panels.push(plate('dessous', ox + e, oy + e, zFond, L - 2 * e, W - 2 * e, e))

  // Flancs pleine hauteur H depuis oz (ouverture Z top)
  // Joues : épaisseur e, s’arrêtent au-dessus du rail en laissant le décroché
  panels.push(plate('fond', ox, oy, oz + d, L, e, H - d))
  panels.push(plate('arriere', ox, oy + W - e, oz + d, L, e, H - d))
  // Joues latérales : du bas (oz) pour le décroché visible, ou depuis oz+d
  // Type B : joues descendent bas pour guider ; fond à +11
  panels.push(plate('joue_g', ox, oy, oz, e, W, H))
  panels.push(plate('joue_d', ox + L - e, oy, oz, e, W, H))

  return {
    kind: 'drawer-box',
    openFace: 'Z_top',
    type: WURTH_DRAWER_TYPE,
    decrocheMm: d,
    origin: [ox, oy, oz],
    outer: { L, W, H },
    epaisseur: e,
    panels,
    /** Z dessus du fond (appui charge) */
    zFond,
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
 * Rails Dynamoov entre **traverse Y (dessous)** et **panneau bois du tiroir (dessus)**.
 *
 * Coin en L (croquis rose) :
 *   - bras horizontal = dessus de la traverse (appui mécanique)
 *   - bras vertical   = face ext. de la joue du tiroir
 *   - le rail occupe ce coin, dans le décroché type B (sous le fond)
 *
 * Largeur cible ≈ 21 mm (Dynamoov LWK−LWS = 42 → 21 / côté).
 * Hauteur cible ≈ min(13, décroché−1) mm.
 *
 * Dimensions natives STL après normalize : ~54.6 × 550 × 47.2 mm (X×Y×Z).
 */
export const RAIL_NATIVE_WIDTH_X_MM = 54.6
export const RAIL_NATIVE_HEIGHT_Z_MM = 47.2

export function buildDrawerRails(traversePair, opts = {}) {
  const [left, right] = traversePair
  const decroche = opts.decrocheMm ?? WURTH_DECROCHE_DYNAMOOV_MM
  const sideSpace = opts.sideSpaceMm ?? DYNAMOOV_SIDE_RAIL_SPACE_MM // 21 mm
  // Hauteur rail dans le décroché, sous le fond du tiroir
  const railH = Math.min(
    opts.railBodyHMm ?? DYNAMOOV_RAIL_BODY_H_MM,
    Math.max(6, decroche - 1),
  )

  // Dessus de traverse = plan d’appui (inchangé — position traverse correcte)
  const zTraverseTop = left.zTopMm + left.extrusionMm
  const zRail = zTraverseTop + (RAIL_MOUNT_OFFSET.z || 0)

  const spanY = Math.max(50, left.bounds2D.maxY - left.bounds2D.minY)
  const scaleY = spanY / RAIL_NATIVE_LENGTH_Y_MM
  const y0 = left.bounds2D.minY + (RAIL_MOUNT_OFFSET.y || 0)

  // Largeur rail ≈ emprise Dynamoov 21 mm (entre face int. traverse et joue tiroir)
  const scaleX = sideSpace / RAIL_NATIVE_WIDTH_X_MM
  const scaleZ = railH / RAIL_NATIVE_HEIGHT_Z_MM

  /**
   * Ancrage sur la face intérieure de la traverse, rail vers le centre
   * (sous la joue du tiroir, dans le coin L rose).
   * Gauche : origin à innerX, mesh en +X (vers le caisson / sous le tiroir).
   * Droite : origin à innerX, mirror → mesh en −X.
   */
  const leftX = left.innerX + (RAIL_MOUNT_OFFSET.x || 0)
  const rightX = right.innerX - (RAIL_MOUNT_OFFSET.x || 0)

  const common = {
    stlUrl: RAIL_STL_URL,
    axis: 'Y',
    scale: { x: scaleX, y: scaleY, z: scaleZ },
    rotation: [0, 0, 0],
    spanY,
    zTraverseTop,
    zRail,
    railBodyHMm: railH,
    decrocheMm: decroche,
    sideSpaceMm: sideSpace,
  }

  return [
    {
      ...common,
      id: 'rail-left',
      side: 'left',
      position: [leftX, y0, zRail],
      mirrorX: false,
    },
    {
      ...common,
      id: 'rail-right',
      side: 'right',
      position: [rightX, y0, zRail],
      mirrorX: true,
    },
  ]
}

/**
 * Tiroir Würth type B + Dynamoov complet.
 *
 * zMm utilisateur = bas des joues du tiroir (plan de référence Z).
 * Traverses : leur **dessus** est à zMm (support rails), extrusion vers le bas.
 */
export function buildTiroir(dims, layout, mod = {}, opts = {}) {
  const ep = opts.epaisseurMm ?? EPAISSEUR_PANNEAU
  const open = layout.openOffset?.[1] || 0

  // Bas des joues = position Z choisie
  const zSideBottom =
    layout.zBottomMm ??
    layout.zMm ??
    Math.max(20, (layout.center?.[2] ?? 100) - (layout.hMm ?? 110) / 2)

  /**
   * Traverses Y sous les rails :
   *   dessus traverse = bas des joues (zSideBottom)
   *   → zTopMm traverse = zSideBottom − TRAVERSE_EXTRUSION (extrusion +Z)
   *   faceA à zTopMm, faceB à zTopMm+40 = zSideBottom
   */
  const zTraverseBottom = Math.max(0, zSideBottom - TRAVERSE_EXTRUSION_MM)

  const traverses = buildTraversePair(dims, zTraverseBottom, {
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
    layout.wurth || computeWurthDrawerDims(dims, mod, traverseBounds)

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
      zSideBottom,
    }
  }

  const rails = buildDrawerRails(traverses, {
    zSideBottom,
    decrocheMm: wurth.decrocheMm,
    railBodyHMm: wurth.railBodyHMm,
    sideSpaceMm: wurth.railSideSpaceMm,
  })

  // Centrage LWS dans LWK (jeu 21 mm / côté déjà dans LWS = LWK−42)
  const LWK = traverseBounds.maxX - traverseBounds.minX
  const originX = traverseBounds.minX + (LWK - wurth.licMm) / 2
  const originY =
    (traverseBounds.minY + traverseBounds.maxY) / 2 -
    wurth.depthMm / 2 -
    open
  const originZ = zSideBottom

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
    /** Cotes Z de référence */
    z: {
      traverseBottom: zTraverseBottom,
      traverseTop: zSideBottom,
      sideBottom: zSideBottom,
      fond: zSideBottom + wurth.decrocheMm,
      sideTop: zSideBottom + wurth.hMm,
      rail: rails[0]?.zRail,
    },
  }
}

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
 * meuble (x,y,z) → Three (x, z, −y) × 0.001
 * STL : Y = longueur (axe traverses / profondeur)
 *
 * @param {import('three').BufferGeometry} geometryMm
 * @param {number|{ scaleX?: number, scaleY?: number, scaleZ?: number, mirrorX?: boolean }} scaleYOrOpts
 * @param {boolean} [mirrorXLegacy]
 */
export function railGeometryToThree(
  geometryMm,
  scaleYOrOpts = 1,
  mirrorXLegacy = false,
) {
  const opts =
    typeof scaleYOrOpts === 'object' && scaleYOrOpts != null
      ? scaleYOrOpts
      : { scaleY: scaleYOrOpts, mirrorX: mirrorXLegacy }
  const scaleX = opts.scaleX ?? 1
  const scaleY = opts.scaleY ?? 1
  const scaleZ = opts.scaleZ ?? 1
  const mirrorX = Boolean(opts.mirrorX)

  const geo = geometryMm.clone()
  const pos = geo.attributes.position
  const SCALE = 0.001
  const sx = (mirrorX ? -1 : 1) * scaleX
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) * sx
    const y = pos.getY(i) * scaleY
    const z = pos.getZ(i) * scaleZ
    pos.setXYZ(i, x * SCALE, z * SCALE, -y * SCALE)
  }
  pos.needsUpdate = true
  geo.computeBoundingBox()
  geo.computeVertexNormals()
  return geo
}
