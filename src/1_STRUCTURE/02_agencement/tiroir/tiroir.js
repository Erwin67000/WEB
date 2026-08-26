/**
 * Tiroir Würth type B + coulisses Dynamoov (basse).
 *
 * Empilement Z (repère meuble), zMm utilisateur = dessus des traverses Y :
 *
 *   zTraverseTop  ─────── dessus traverse Y
 *   zRailTop      ─────── = zTraverseTop  (dessus du rail)
 *                    ↕ hauteur native STL 45,7 mm
 *   zRail         ─────── bbox min STL = zTraverseTop − 45,7
 *
 *   zTraverseTop  ───────
 *                    ↕ 19,05 mm vers Z−
 *   zFond         ─────── bas du panneau de fond
 *                    ↕ décroché type B (joues plus bas que le fond)
 *   oz            ─────── bas des joues
 *
 * Largeur (plan Dynamoov) :
 *   LWK = distance faces int. traverses
 *   LWS = LWK − 20  (10 mm / côté)
 */
import {
  EPAISSEUR_PANNEAU,
  areteExtrusionMm,
} from '../../00_matrice/matrice_constante.js'
import {
  resolvePorteArriereY,
  buildFacadeTiroirBas,
  buildFacadeTiroir,
} from '../Y.porte/porte.js'
import {
  buildTraversePair,
  resolveDrawerOrigin,
} from '../traverse.js'
import {
  WURTH_DRAWER_TYPE,
  WURTH_DECROCHE_DYNAMOOV_MM,
  DYNAMOOV_SIDE_RAIL_SPACE_MM,
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
  DRAWER_WIDTH_OUT_OF_RANGE_MSG,
  DYNAMOOV_LWK_MINUS_LWS_MM,
  DYNAMOOV_LWK_MIN_MM,
  DYNAMOOV_LWK_MAX_MM,
  DYNAMOOV_SIDE_RAIL_SPACE_MM,
  DYNAMOOV_RAIL_BODY_H_MM,
  computeWurthDrawerDims,
  clampWurthHeight,
  drawerInnerWidthMm,
  isDrawerWidthAllowed,
} from './wurth.js'

export const RAIL_STL_URL = '/structure/agencement/rail-gauche.stl'
export const RAIL_STL_SCALE = 0.001
/** Fine-tune mm (repère meuble) après normalize STL. */
export const RAIL_MOUNT_OFFSET = { x: 0, y: 0, z: 0 }
/** Longueur native rail après µm→mm (axe Y CAD). */
export const RAIL_NATIVE_LENGTH_Y_MM = 550
/** zFond = zTraverseTop − 19,05 (Z négatif depuis le dessus traverse / rail). */
export const DRAWER_FOND_BELOW_TRAVERSE_TOP_MM = 19.05
/** Course d’ouverture (Y+) = 75 % de la profondeur du meuble. */
export const DRAWER_OPEN_DEPTH_RATIO = 0.75
/** Durée ouverture / fermeture (ms) — ease-in-out aux deux bouts. */
export const DRAWER_OPEN_DURATION_MS = 600

/**
 * Boîte type B — ouverture Z top, décroché bas pour Dynamoov.
 *
 * @param {{ L: number, W: number, H: number }} outer — LWS × profondeur × H
 * @param {number[]} origin — [x,y,z] bas des joues
 * @param {number} [epaisseur]
 * @param {number} [decrocheMm] — joues plus bas que le fond (type B)
 * @param {number} [zTraverseTopMm] — dessus traverse / rail ; zFond = ce plan − 19,05
 */
export function buildDrawerOpenBox(
  outer,
  origin,
  epaisseur = EPAISSEUR_PANNEAU,
  decrocheMm = WURTH_DECROCHE_DYNAMOOV_MM,
  zTraverseTopMm,
) {
  const [ox, oy, oz] = origin
  const { L, W, H } = outer
  const e = 11
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

  // zFond = dessus traverse − 19,05 (indépendant du décroché des joues)
  const zFond =
    zTraverseTopMm != null
      ? Number(zTraverseTopMm) - DRAWER_FOND_BELOW_TRAVERSE_TOP_MM
      : oz + d
  panels.push(plate('dessous', ox + e, oy, zFond, L - 2 * e, W, 9))

  // Flancs au-dessus du fond ; joues depuis oz (décroché type B)
  panels.push(plate('avant', ox + e, oy, zFond + 9, L - 2 * e, e, H - d - 9))
  panels.push(plate('arriere', ox + e, oy + W - e, zFond + 9, L - 2 * e, e, H - d - 9))
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
    /** Bas du panneau de fond (zTraverseTop − 19,05) */
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
 * Rails Dynamoov : **dessus du rail = dessus de la traverse**.
 * STL normalisé bbox min → zRail = zTraverseTop − hauteur native (45,7 mm).
 * Pas de scale X ni Z. Scale Y uniquement pour coller à la profondeur.
 */
export const RAIL_NATIVE_WIDTH_X_MM = 54.6
export const RAIL_NATIVE_HEIGHT_Z_MM = 45.7

export function buildDrawerRails(traversePair, opts = {}) {
  const [left, right] = traversePair
  const decroche = opts.decrocheMm ?? WURTH_DECROCHE_DYNAMOOV_MM
  const sideSpace = opts.sideSpaceMm ?? DYNAMOOV_SIDE_RAIL_SPACE_MM
  const railH = RAIL_NATIVE_HEIGHT_Z_MM

  const zTraverseBottom = left.zTopMm
  const zTraverseTop = zTraverseBottom + left.extrusionMm
  // Dessus rail = dessus traverse → origin STL (bbox min) = top − hauteur native
  const zRail =
    zTraverseTop - railH + (RAIL_MOUNT_OFFSET.z || 0)

  const spanY = Math.max(50, Number(opts.depthMm) || left.bounds2D.maxY - left.bounds2D.minY)
  const scaleY = spanY / RAIL_NATIVE_LENGTH_Y_MM
  const y0 =
    (opts.originY != null ? Number(opts.originY) : left.bounds2D.minY) +
    (RAIL_MOUNT_OFFSET.y || 0)

  const leftX = left.innerX + (RAIL_MOUNT_OFFSET.x || 0)
  const rightX = right.innerX - (RAIL_MOUNT_OFFSET.x || 0)

  const common = {
    stlUrl: RAIL_STL_URL,
    axis: 'Y',
    scale: { x: 1, y: scaleY, z: 1 },
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
 * zMm utilisateur = **dessus des traverses Y** (= dessus des rails).
 * Traverses extrudées vers le bas. zFond = ce plan − 19,05 mm.
 * Ouverture : offset visuel Y+ sur les panels seulement (rails fixes).
 */
export function buildTiroir(dims, layout, mod = {}, opts = {}) {
  const ep = opts.epaisseurMm ?? EPAISSEUR_PANNEAU

  // zMm = dessus traverse Y (= dessus rail)
  const zSideBottom =
    layout.zBottomMm ??
    layout.zMm ??
    Math.max(20, (layout.center?.[2] ?? 100) - (layout.hMm ?? 110) / 2)

  /**
   * Traverses Y :
   *   dessus = zMm (zSideBottom historique) = dessus des rails
   *   faceA à zTopMm = zTraverseBottom, faceB à zTraverseTop
   */
  const extrusion = areteExtrusionMm(dims)
  const zTraverseTop = zSideBottom
  const zTraverseBottom = Math.max(0, zTraverseTop - extrusion)
  const zFond = zTraverseTop - DRAWER_FOND_BELOW_TRAVERSE_TOP_MM

  const traverses = buildTraversePair(dims, zTraverseBottom, {
    leftId: 'drawer-traverse-left',
    rightId: 'drawer-traverse-right',
    extrusionMm: extrusion,
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

  if (
    wurth.lwkOutOfRange ||
    wurth.depthTooSmall ||
    wurth.depthMm < 250
  ) {
    return {
      kind: 'drawer',
      type: WURTH_DRAWER_TYPE,
      wurth,
      traverses: [],
      rails: [],
      box: { panels: [], openFace: 'Z_top' },
      depthTooSmall: Boolean(wurth.depthTooSmall),
      lwkOutOfRange: Boolean(wurth.lwkOutOfRange),
      openOffset: layout.openOffset || [0, 0, 0],
      layout,
      zSideBottom,
    }
  }

  // Rond vert + 10 mm X. Calé à l’avant (Z2), pas au fond (Z0).
  const ox = resolveDrawerOrigin(dims)
  const originX = ox.originX
  const licMm = ox.licMm
  // Rails : calés sur la traverse (Y intérieur avant).
  const originYRails = ox.originYFront - wurth.depthMm
  // Panels : le devant du caisson = face arrière de la porte (rectangle arriere).
  const yArrierePorte = resolvePorteArriereY(dims, {
    epaisseur: EPAISSEUR_PANNEAU,
  })
  const originYPanels = yArrierePorte - wurth.depthMm
  const originZ = zFond - (wurth.decrocheMm ?? WURTH_DECROCHE_DYNAMOOV_MM)

  const rails = buildDrawerRails(traverses, {
    zSideBottom,
    decrocheMm: wurth.decrocheMm,
    railBodyHMm: wurth.railBodyHMm,
    sideSpaceMm: wurth.railSideSpaceMm,
    originY: originYRails,
    depthMm: wurth.depthMm,
  })

  const box = buildDrawerOpenBox(
    { L: licMm, W: wurth.depthMm, H: wurth.hMm },
    [originX, originYPanels, originZ],
    ep,
    wurth.decrocheMm,
    zTraverseTop,
  )

  const facadeOpts = {
    zMin: originZ,
    zMax: originZ + wurth.hMm,
    epaisseur: EPAISSEUR_PANNEAU,
  }
  const facade = layout.facadeBas
    ? buildFacadeTiroirBas(dims, facadeOpts)
    : buildFacadeTiroir(dims, facadeOpts)
  box.panels.push(facade)

  return {
    kind: 'drawer',
    type: WURTH_DRAWER_TYPE,
    wurth: { ...wurth, licMm, lwkMm: Math.round(ox.traverseInnerRight - ox.traverseInnerLeft) },
    originX,
    traverses,
    rails,
    box,
    openFace: 'Z_top',
    openOffset: layout.openOffset || [0, 0, 0],
    layout,
    /** Cotes Z de référence */
    z: {
      traverseBottom: zTraverseBottom,
      traverseTop: zTraverseTop,
      sideBottom: originZ,
      fond: zFond,
      sideTop: originZ + wurth.hMm,
      rail: rails[0]?.zRail,
      railTop: zTraverseTop,
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
