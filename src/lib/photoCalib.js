/**
 * Calage photo : origine → X (plinthe) → Z → Y → échelle.
 * Une suggestion de rail X (sol ∩ mur du fond) est proposée, l’utilisateur la trace.
 */

export const PHOTO_STEPS = ['origin', 'axisX', 'axisZ', 'axisY', 'scale']

export function emptyPhotoCalib(xLine) {
  const xA = xLine?.a || [0.08, 0.7]
  const xB = xLine?.b || [0.92, 0.7]
  return {
    step: 'origin',
    xA,
    xB,
    originUv: null,
    xUv: null,
    zUv: null,
    yUv: null,
    hoverUv: null,
    scale: 1,
  }
}

export function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('photo load failed'))
    img.src = url
  })
}

function grayAt(data, i) {
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
}

/**
 * Suggestion du rail X = rencontre sol / mur du fond (plinthe).
 * On cherche, colonne par colonne, le plus fort bord horizontal
 * puis on ajuste une droite (pente de la plinthe).
 */
export async function detectPhotoXAxis(dataUrl) {
  const fallback = { a: [0.07, 0.7], b: [0.93, 0.7] }
  try {
    const img = await loadImageElement(dataUrl)
    const w = 480
    const h = Math.max(32, Math.round((img.height / img.width) * w))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return fallback
    ctx.drawImage(img, 0, 0, w, h)
    const { data } = ctx.getImageData(0, 0, w, h)
    const y0 = (h * 0.38) | 0
    const y1 = (h * 0.88) | 0
    const pts = []
    const step = 6
    for (let x = 8; x < w - 8; x += step) {
      let bestY = (y0 + y1) >> 1
      let best = -1
      for (let y = y0 + 2; y < y1 - 2; y += 1) {
        const up = grayAt(data, ((y - 2) * w + x) * 4)
        const dn = grayAt(data, ((y + 2) * w + x) * 4)
        const e = Math.abs(dn - up)
        if (e > best) {
          best = e
          bestY = y
        }
      }
      if (best > 6) pts.push({ x, y: bestY, e: best })
    }
    if (pts.length < 8) return fallback
    pts.sort((a, b) => b.e - a.e)
    const strong = pts.slice(0, Math.max(12, (pts.length * 0.55) | 0))
    let sx = 0
    let sy = 0
    let sxx = 0
    let sxy = 0
    const n = strong.length
    for (let i = 0; i < n; i += 1) {
      sx += strong[i].x
      sy += strong[i].y
      sxx += strong[i].x * strong[i].x
      sxy += strong[i].x * strong[i].y
    }
    const den = n * sxx - sx * sx
    const m = Math.abs(den) < 1e-6 ? 0 : (n * sxy - sx * sy) / den
    const c = (sy - m * sx) / n
    const ang = Math.abs(Math.atan(m))
    if (ang > 0.7) return fallback
    const yAt = (xf) => {
      const y = (m * xf * w + c) / h
      return Math.min(0.92, Math.max(0.32, y))
    }
    return { a: [0.04, yAt(0.04)], b: [0.96, yAt(0.96)] }
  } catch {
    return fallback
  }
}

export function clamp01(v) {
  return Math.min(1, Math.max(0, v))
}

export function projectOnSegment(p, a, b) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy || 1e-8
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
  t = Math.min(1, Math.max(0, t))
  return [a[0] + dx * t, a[1] + dy * t]
}

export function uvFromPointer(ev, el) {
  const r = el.getBoundingClientRect()
  const w = Math.max(1, r.width)
  const h = Math.max(1, r.height)
  return [
    clamp01((ev.clientX - r.left) / w),
    clamp01((ev.clientY - r.top) / h),
  ]
}

/** +X : tracé utilisateur (origine → xUv), sinon suggestion de plinthe. */
export function xPlusUv(calib, origin) {
  const o = origin || calib.originUv
  if (!o) return [1, 0]
  if (calib.xUv) return dirFrom(o, calib.xUv)
  const dA = Math.hypot(calib.xA[0] - o[0], calib.xA[1] - o[1])
  const dB = Math.hypot(calib.xB[0] - o[0], calib.xB[1] - o[1])
  const end = dB >= dA ? calib.xB : calib.xA
  const d = [end[0] - o[0], end[1] - o[1]]
  const n = Math.hypot(d[0], d[1]) || 1
  return [d[0] / n, d[1] / n]
}

export function defaultZuv(origin) {
  return [origin[0], Math.max(0.02, origin[1] - 0.22)]
}

/** Perpendiculaire à X, vers le bas de l’image (le sol). */
export function defaultYuv(origin, dirX) {
  const p1 = [-dirX[1], dirX[0]]
  const p2 = [dirX[1], -dirX[0]]
  const pick = p1[1] > p2[1] ? p1 : p2
  return [origin[0] + pick[0] * 0.2, origin[1] + pick[1] * 0.2]
}

export function dirFrom(a, b) {
  const d = [b[0] - a[0], b[1] - a[1]]
  const n = Math.hypot(d[0], d[1]) || 1
  return [d[0] / n, d[1] / n]
}

/**
 * Repère écran (monde Three, caméra photo fov 90° à z=1) :
 * Three X = longueur, Three Y = haut, Three Z = −profondeur.
 */
export function calibWorldBasis(calib, aspect, viewH) {
  const origin = calib.originUv || calib.hoverUv
  if (!origin) return null
  const xEnd =
    calib.xUv || (calib.step === 'axisX' ? calib.hoverUv : null)
  const dirX = xEnd ? dirFrom(origin, xEnd) : xPlusUv(calib, origin)
  const zEnd =
    calib.zUv || (calib.step === 'axisZ' ? calib.hoverUv : null)
  const dirZ = zEnd ? dirFrom(origin, zEnd) : [0, -1]
  const yEnd =
    calib.yUv || (calib.step === 'axisY' ? calib.hoverUv : null)
  const dirY = yEnd
    ? dirFrom(origin, yEnd)
    : dirFrom(origin, defaultYuv(origin, dirX))

  const uvToXY = (uv) => [(uv[0] * 2 - 1) * aspect, -(uv[1] * 2 - 1)]
  const o = uvToXY(origin)
  const toVec = (dir) => {
    const p = uvToXY([origin[0] + dir[0], origin[1] + dir[1]])
    const v = [p[0] - o[0], p[1] - o[1]]
    const n = Math.hypot(v[0], v[1]) || 1
    return [v[0] / n, v[1] / n]
  }
  const x = toVec(dirX)
  const zUp = toVec(dirZ)
  const yDep = toVec(dirY)
  const ppm = 150 * (Number(calib.scale) || 1)
  const worldPerM = ppm / Math.max(80, viewH * 0.5)

  return {
    origin: o,
    axisX: [x[0] * worldPerM, x[1] * worldPerM, 0],
    axisY: [zUp[0] * worldPerM, zUp[1] * worldPerM, 0.01],
    axisZ: [-yDep[0] * worldPerM, -yDep[1] * worldPerM, -0.35 * worldPerM],
  }
}
