/**
 * Pieds sous le panneau dessous (socle).
 *
 * petit  (50 mm)  — 4 pieds réglables NM-ML-50-75
 *   platine 80×92, embase Ø80, hauteur 50–75 mm
 *   https://www.lamaisondelagenceur.com/boutique/articles/fichier/1918
 *
 * moyen  (200 mm) / grand (500 mm) — 4 poteaux bois (section d’arête),
 *   inset 50 mm depuis les bords du socle, du plan Z=0 (sol) au bas du socle.
 */
import { buildGeometrie } from '../../00_matrice/matrice_geometrie.js'
import {
  PANNEAU_DEFS,
  computeQuatreRectangles,
} from '../../00_matrice/matrice_panneau.js'
import {
  SOCLE_OPTIONS_MM,
  unitLiftMm,
  resolveAreteSection,
} from '../../00_matrice/matrice_constante.js'

/** Inset depuis le bord du panneau socle jusqu’à la face ext. du pied (mm). */
export const PIED_INSET_MM = 50

/** NM-ML-50-75 */
export const PIED_REGLABLE = {
  ref: 'NM-ML-50-75',
  plateX: 80,
  plateY: 92,
  plateH: 12,
  padD: 80,
  padH: 8,
  stemD: 28,
  hMin: 50,
  hMax: 75,
}

export function resolvePiedKind(socleMm) {
  const n = Number(socleMm)
  if (n === 50) return 'petit'
  if (n === 200) return 'moyen'
  if (n === 500) return 'grand'
  const opt = SOCLE_OPTIONS_MM.find((o) => o.mm === n)
  return opt?.id || null
}

function dessousAabb(dims) {
  const def = PANNEAU_DEFS.dessous
  if (!def) return null
  const { byId } = buildGeometrie(dims)
  const { tolerance, arriere } = computeQuatreRectangles(def, byId, {})
  const pts = [...(tolerance || []), ...(arriere || [])]
  if (!pts.length) return null
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const zs = pts.map((p) => p[2])
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  }
}

function cornerCenters(bounds, footX, footY, inset) {
  const spanX = bounds.maxX - bounds.minX
  const spanY = bounds.maxY - bounds.minY
  const ix = Math.min(inset, Math.max(2, (spanX - footX) / 2 - 1))
  const iy = Math.min(inset, Math.max(2, (spanY - footY) / 2 - 1))
  const x0 = bounds.minX + ix + footX / 2
  const x1 = bounds.maxX - ix - footX / 2
  const y0 = bounds.minY + iy + footY / 2
  const y1 = bounds.maxY - iy - footY / 2
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ]
}

function boxSolid(id, x0, y0, z0, x1, y1, z1, material, color) {
  const pts = [
    [x0, y0, z0],
    [x1, y0, z0],
    [x1, y1, z0],
    [x0, y1, z0],
    [x0, y0, z1],
    [x1, y0, z1],
    [x1, y1, z1],
    [x0, y1, z1],
  ]
  return solidFromPoints(id, pts, material, color)
}

function cylinderSolid(id, cx, cy, z0, z1, r, n, material, color) {
  const bot = []
  const top = []
  const segs = Math.max(8, n | 0)
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2
    const x = cx + r * Math.cos(a)
    const y = cy + r * Math.sin(a)
    bot.push([x, y, z0])
    top.push([x, y, z1])
  }
  const pts = [...bot, ...top]
  const faces = []
  for (let i = 1; i < segs - 1; i++) faces.push([0, i + 1, i])
  const t0 = segs
  for (let i = 1; i < segs - 1; i++) faces.push([t0, t0 + i, t0 + i + 1])
  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % segs
    faces.push([i, j, segs + j])
    faces.push([i, segs + j, segs + i])
  }
  const wirePairs = []
  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % segs
    wirePairs.push([i, j], [segs + i, segs + j], [i, segs + i])
  }
  return buffersFrom(id, pts, faces, wirePairs, material, color)
}

function solidFromPoints(id, pts8, material, color) {
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
  return buffersFrom(id, pts8, faces, wirePairs, material, color)
}

function buffersFrom(id, pts, faces, wirePairs, material, color) {
  const positions = new Float32Array(pts.length * 3)
  for (let i = 0; i < pts.length; i++) {
    positions[i * 3] = pts[i][0]
    positions[i * 3 + 1] = pts[i][1]
    positions[i * 3 + 2] = pts[i][2]
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
    wire[o] = pts[a][0]
    wire[o + 1] = pts[a][1]
    wire[o + 2] = pts[a][2]
    wire[o + 3] = pts[b][0]
    wire[o + 4] = pts[b][1]
    wire[o + 5] = pts[b][2]
  })
  return { id, positions, indices, wire, points: pts, material, color }
}

function buildReglable(i, cx, cy, zBot, zTop) {
  const p = PIED_REGLABLE
  const zPlateBot = zTop - p.plateH
  const zPadTop = zBot + p.padH
  const hx = p.plateX / 2
  const hy = p.plateY / 2
  const solids = []
  solids.push(
    boxSolid(
      `pied-${i}-platine`,
      cx - hx,
      cy - hy,
      zPlateBot,
      cx + hx,
      cy + hy,
      zTop,
      'plastic',
      '#3a3a3a',
    ),
  )
  const stemTop = Math.max(zPadTop + 2, zPlateBot)
  solids.push(
    cylinderSolid(
      `pied-${i}-tige`,
      cx,
      cy,
      zPadTop,
      stemTop,
      p.stemD / 2,
      12,
      'metal',
      '#9a9a9a',
    ),
  )
  solids.push(
    cylinderSolid(
      `pied-${i}-embase`,
      cx,
      cy,
      zBot,
      zPadTop,
      p.padD / 2,
      20,
      'rubber',
      '#1c1c1c',
    ),
  )
  return solids
}

function buildBois(i, cx, cy, zBot, zTop, section) {
  const h = section / 2
  return [
    boxSolid(
      `pied-${i}`,
      cx - h,
      cy - h,
      zBot,
      cx + h,
      cy + h,
      zTop,
      'wood',
      null,
    ),
  ]
}

/**
 * @param {{ L: number, W: number, H: number }} dims
 * @param {{ socleMm?: number, liftMm?: number }} [opts]
 */
export function buildPieds(dims, opts = {}) {
  const socleMm = Number(opts.socleMm) || 0
  const kind = resolvePiedKind(socleMm)
  if (!kind) return { kind: null, solids: [] }

  const bounds = dessousAabb(dims)
  if (!bounds) return { kind, solids: [] }

  const liftMm =
    Number.isFinite(Number(opts.liftMm))
      ? Number(opts.liftMm)
      : unitLiftMm({ dims, panneaux: ['dessous'], socleMm })
  const zTop = bounds.minZ
  const zBot = -liftMm
  if (!(zTop > zBot + 2)) return { kind, solids: [] }

  const section = resolveAreteSection(dims).largeur
  const footX = kind === 'petit' ? PIED_REGLABLE.plateX : section
  const footY = kind === 'petit' ? PIED_REGLABLE.plateY : section
  const centers = cornerCenters(bounds, footX, footY, PIED_INSET_MM)

  const solids = []
  centers.forEach(([cx, cy], i) => {
    if (kind === 'petit') {
      solids.push(...buildReglable(i, cx, cy, zBot, zTop))
    } else {
      solids.push(...buildBois(i, cx, cy, zBot, zTop, section))
    }
  })
  return { kind, solids, bounds, zBot, zTop }
}

export default {
  PIED_INSET_MM,
  PIED_REGLABLE,
  resolvePiedKind,
  buildPieds,
}
