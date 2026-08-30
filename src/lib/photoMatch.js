/**
 * Calage caméra par points de fuite (équivalent fSpy / SketchUp « Adapter photo »).
 *
 * Deux segments par axe orthonormé X (rouge), Z haut (bleu), Y profondeur (vert).
 * On en déduit focale, orientation et position : les arêtes 3D parallèles
 * convergent vers le même point de fuite que dans la photo.
 *
 * Math : Caprile & Torre — le point principal est l’orthocentre du triangle
 * des 3 VP ; f² = −(vp1−pp)·(vp2−pp). VP à l’infini = perspective à 2 points.
 */

export const MATCH_STEPS = [
  'x1',
  'x2',
  'z1',
  'z2',
  'y1',
  'y2',
  'origin',
  'scale',
]

export const MATCH_LINE_OF = {
  x1: ['x', 0],
  x2: ['x', 1],
  z1: ['z', 0],
  z2: ['z', 1],
  y1: ['y', 0],
  y2: ['y', 1],
}

const AXIS_COLOR = { x: '#e24b4b', z: '#4aa3ff', y: '#3dce6a' }
export { AXIS_COLOR }

export function emptyLines() {
  return {
    x: [null, null],
    y: [null, null],
    z: [null, null],
  }
}

export function emptyPhotoCalib(xLine) {
  const xA = xLine?.a || [0.08, 0.72]
  const xB = xLine?.b || [0.92, 0.68]
  return {
    step: 'x1',
    lines: emptyLines(),
    pending: null,
    originUv: null,
    hoverUv: xA,
    scale: 1,
    shiftX: 0,
    shiftZ: 0,
    zoom: 1,
    photoAspect: Number(xLine?.aspect) > 0.05 ? Number(xLine.aspect) : 1.5,
    xA,
    xB,
  }
}

export function isLine(ln) {
  return Boolean(ln && ln.a && ln.b)
}

export function axisReady(lines, axis) {
  return isLine(lines?.[axis]?.[0]) && isLine(lines?.[axis]?.[1])
}

/** Prolonge un segment : la fuyante = la ligne tracée, pas un VP recadré. */
export function extendSeg(a, b, span = 6) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const n = Math.hypot(dx, dy) || 1
  const ux = dx / n
  const uy = dy / n
  return [
    [a[0] - ux * span, a[1] - uy * span],
    [b[0] + ux * span, b[1] + uy * span],
  ]
}

export function defaultOriginUv(calib) {
  if (calib?.originUv) return calib.originUv
  const x0 = calib?.lines?.x?.[0]
  const z0 = calib?.lines?.z?.[0]
  if (isLine(x0) && isLine(z0)) {
    const hit = lineIntersect(x0.a, x0.b, z0.a, z0.b)
    if (!hit.infinite && hit.uv) return hit.uv
  }
  if (isLine(x0)) return [...x0.a]
  return [0.42, 0.78]
}

function hypot3(x, y, z) {
  return Math.hypot(x, y, z)
}

function norm3(v) {
  const n = hypot3(v[0], v[1], v[2]) || 1
  return [v[0] / n, v[1] / n, v[2] / n]
}

function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

function mul3(m, v) {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ]
}

/** Intersection de deux droites en UV. */
export function lineIntersect(a1, a2, b1, b2) {
  const x1 = a1[0]
  const y1 = a1[1]
  const x2 = a2[0]
  const y2 = a2[1]
  const x3 = b1[0]
  const y3 = b1[1]
  const x4 = b2[0]
  const y4 = b2[1]
  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
  if (Math.abs(den) < 1e-12) {
    const d = [x2 - x1, y2 - y1]
    const n = Math.hypot(d[0], d[1]) || 1
    return { infinite: true, dir: [d[0] / n, d[1] / n], uv: null }
  }
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den
  return {
    infinite: false,
    dir: null,
    uv: [x1 + t * (x2 - x1), y1 + t * (y2 - y1)],
  }
}

export function vanishPoint(l1, l2) {
  if (!isLine(l1) || !isLine(l2)) return null
  return lineIntersect(l1.a, l1.b, l2.a, l2.b)
}

function uvToXY(uv, aspect, pp = [0.5, 0.5]) {
  return [(uv[0] - pp[0]) * aspect, pp[1] - uv[1]]
}

function xyToUv(xy, aspect, pp = [0.5, 0.5]) {
  return [xy[0] / aspect + pp[0], pp[1] - xy[1]]
}

/** Orthocentre du triangle ABC (coords euclidiennes 2D). */
function orthocenter(A, B, C) {
  const bc = [C[0] - B[0], C[1] - B[1]]
  const n1 = [-bc[1], bc[0]]
  const ab = [B[0] - A[0], B[1] - A[1]]
  const n2 = [-ab[1], ab[0]]
  const hit = lineIntersect(A, [A[0] + n1[0], A[1] + n1[1]], C, [
    C[0] + n2[0],
    C[1] + n2[1],
  ])
  if (hit.infinite || !hit.uv) return null
  return hit.uv
}

function focalFromPair(vpA, vpB, aspect, pp) {
  if (!vpA || !vpB || vpA.infinite || vpB.infinite) return null
  const a = uvToXY(vpA.uv, aspect, pp)
  const b = uvToXY(vpB.uv, aspect, pp)
  const f2 = -(a[0] * b[0] + a[1] * b[1])
  if (f2 < 1e-8) return null
  return Math.sqrt(f2)
}

/**
 * Direction d’un axe dans l’espace caméra Three (regarde −Z, Y haut).
 * f en unités de hauteur d’image.
 */
function axisDir(vp, aspect, f, pp) {
  if (!vp) return null
  if (vp.infinite) {
    const d = vp.dir || [1, 0]
    return norm3([d[0] * aspect, -d[1], 0])
  }
  const xy = uvToXY(vp.uv, aspect, pp)
  return norm3([xy[0], xy[1], -f])
}

function mat3FromColumns(x, y, z) {
  return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]]
}

function transpose3(m) {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]
}

function quatFromMat3(m) {
  const te = [
    m[0],
    m[3],
    m[6],
    0,
    m[1],
    m[4],
    m[7],
    0,
    m[2],
    m[5],
    m[8],
    0,
    0,
    0,
    0,
    1,
  ]
  const m11 = te[0]
  const m12 = te[4]
  const m13 = te[8]
  const m21 = te[1]
  const m22 = te[5]
  const m23 = te[9]
  const m31 = te[2]
  const m32 = te[6]
  const m33 = te[10]
  const trace = m11 + m22 + m33
  let x
  let y
  let z
  let w
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1)
    w = 0.25 / s
    x = (m32 - m23) * s
    y = (m13 - m31) * s
    z = (m21 - m12) * s
  } else if (m11 > m22 && m11 > m33) {
    const s = 2 * Math.sqrt(1 + m11 - m22 - m33)
    w = (m32 - m23) / s
    x = 0.25 * s
    y = (m12 + m21) / s
    z = (m13 + m31) / s
  } else if (m22 > m33) {
    const s = 2 * Math.sqrt(1 + m22 - m11 - m33)
    w = (m13 - m31) / s
    x = (m12 + m21) / s
    y = 0.25 * s
    z = (m23 + m32) / s
  } else {
    const s = 2 * Math.sqrt(1 + m33 - m11 - m22)
    w = (m21 - m12) / s
    x = (m13 + m31) / s
    y = (m23 + m32) / s
    z = 0.25 * s
  }
  const n = Math.hypot(x, y, z, w) || 1
  return [x / n, y / n, z / n, w / n]
}

function midpoint(ln) {
  return [(ln.a[0] + ln.b[0]) * 0.5, (ln.a[1] + ln.b[1]) * 0.5]
}

/**
 * Résout la caméra. Unités monde = mètres, origine 3D = coin cliqué.
 */
export function solvePhotoMatch(calib) {
  try {
    return solvePhotoMatchUnsafe(calib)
  } catch {
    return null
  }
}

function solvePhotoMatchUnsafe(calib) {
  if (!calib) return null
  const lines = calib.lines
  const hasX = axisReady(lines, 'x')
  const hasZ = axisReady(lines, 'z')
  const hasY = axisReady(lines, 'y')
  if ([hasX, hasZ, hasY].filter(Boolean).length < 2) return null
  const aspect = Math.max(0.2, Number(calib.photoAspect) || 1.5)
  const vpX = hasX ? vanishPoint(lines.x[0], lines.x[1]) : null
  const vpZ = hasZ ? vanishPoint(lines.z[0], lines.z[1]) : null
  const vpY = hasY ? vanishPoint(lines.y[0], lines.y[1]) : null
  if (hasX && !vpX) return null
  if (hasZ && !vpZ) return null
  if (hasY && !vpY) return null

  const finite = [vpX, vpZ, vpY].filter((v) => v && !v.infinite && v.uv)
  let pp = [0.5, 0.5]
  if (finite.length === 3) {
    const A = uvToXY(vpX.uv, aspect)
    const B = uvToXY(vpZ.uv, aspect)
    const C = uvToXY(vpY.uv, aspect)
    const h = orthocenter(A, B, C)
    if (h && Number.isFinite(h[0]) && Number.isFinite(h[1])) {
      const ppUv = xyToUv(h, aspect)
      if (
        Math.abs(ppUv[0] - 0.5) < 0.45 &&
        Math.abs(ppUv[1] - 0.5) < 0.45
      ) {
        pp = ppUv
      }
    }
  }

  const pairs = [
    [vpX, vpZ],
    [vpX, vpY],
    [vpZ, vpY],
  ]
  let f = null
  for (const [a, b] of pairs) {
    if (!a || !b) continue
    const cand = focalFromPair(a, b, aspect, pp)
    if (cand && cand > 0.15 && cand < 12) {
      f = cand
      break
    }
  }
  if (!f) f = 1.1

  let dX = vpX ? axisDir(vpX, aspect, f, pp) : null
  let dUp = vpZ ? axisDir(vpZ, aspect, f, pp) : null
  let dDepth = vpY ? axisDir(vpY, aspect, f, pp) : null

  if (dUp && dUp[1] < 0) dUp = [-dUp[0], -dUp[1], -dUp[2]]

  if (dX && dUp && !dDepth) dDepth = norm3(cross3(dX, dUp))
  if (dX && dDepth && !dUp) dUp = norm3(cross3(dDepth, dX))
  if (dUp && dDepth && !dX) dX = norm3(cross3(dUp, dDepth))
  if (!dX || !dUp || !dDepth) return null
  if (dUp[1] < 0) dUp = [-dUp[0], -dUp[1], -dUp[2]]

  let dZ = cross3(dX, dUp)
  if (hypot3(...dZ) < 1e-8) dZ = dDepth
  dZ = norm3(dZ)
  dX = norm3(dX)
  dUp = norm3(dUp)
  dX = norm3(cross3(dUp, dZ))
  dZ = norm3(cross3(dX, dUp))

  if (dot3(dZ, dDepth) > 0) {
    dZ = [-dZ[0], -dZ[1], -dZ[2]]
    dX = [-dX[0], -dX[1], -dX[2]]
  }

  const originUv = defaultOriginUv(calib)
  const ray = axisDir({ infinite: false, uv: originUv }, aspect, f, pp)
  if (!ray) return null

  const R_w2c = mat3FromColumns(dX, dUp, dZ)
  const R_c2w = transpose3(R_w2c)

  const zoom = Math.min(4, Math.max(0.4, Number(calib.zoom) || 1))
  const dist = 2.6 / zoom
  const pCam = [ray[0] * dist, ray[1] * dist, ray[2] * dist]
  let C = mul3(R_c2w, [-pCam[0], -pCam[1], -pCam[2]])

  if (C[1] < 0.05) {
    dX = [-dX[0], -dX[1], -dX[2]]
    dZ = [-dZ[0], -dZ[1], -dZ[2]]
    const R2 = transpose3(mat3FromColumns(dX, dUp, dZ))
    C = mul3(R2, [-pCam[0], -pCam[1], -pCam[2]])
    if (C[1] < 0.05) {
      C = [C[0], Math.abs(C[1]) + 0.4, C[2]]
    }
  }

  const Rfinal = transpose3(mat3FromColumns(dX, dUp, dZ))
  const fov = (2 * Math.atan(0.5 / Math.max(0.2, f)) * 180) / Math.PI

  return {
    ok: true,
    fov: Math.min(75, Math.max(18, fov)),
    f,
    pp,
    position: C,
    quaternion: quatFromMat3(Rfinal),
    camRight: [Rfinal[0], Rfinal[3], Rfinal[6]],
    camUp: [Rfinal[1], Rfinal[4], Rfinal[7]],
    camBack: [Rfinal[2], Rfinal[5], Rfinal[8]],
    vpX,
    vpY,
    vpZ,
    aspect,
  }
}

export function matchFovDeg(calib) {
  const s = solvePhotoMatch(calib)
  return s?.fov || null
}

/** Taille du plan photo collé à la caméra, à distance `dist`. */
export function cameraBgPlane(fovDeg, aspect, dist = 6) {
  const t = Math.tan(((fovDeg || 40) * Math.PI) / 360)
  const h = 2 * dist * t
  return { w: h * Math.max(0.2, aspect), h, dist }
}

export function avgLineUv(lines, axis) {
  const pair = lines?.[axis]
  if (!pair) return null
  const pts = []
  pair.forEach((ln) => {
    if (isLine(ln)) pts.push(midpoint(ln))
  })
  if (!pts.length) return null
  const s = pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0])
  return [s[0] / pts.length, s[1] / pts.length]
}
