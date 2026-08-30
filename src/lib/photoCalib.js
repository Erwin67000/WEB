/**
 * Calage photo ludique : le programme ne propose que le rail X
 * (intersection sol Z=0 ∩ mur du fond Y=0). L’utilisateur pose l’origine,
 * trace Z, trace Y, puis règle l’échelle à la molette.
 */

export const PHOTO_STEPS = ['origin', 'axisZ', 'axisY', 'scale']

export function emptyPhotoCalib(xLine) {
  const xA = xLine?.a || [0.08, 0.7]
  const xB = xLine?.b || [0.92, 0.7]
  return {
    step: 'origin',
    xA,
    xB,
    originUv: null,
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
 * Rail X = plinthe du mur du fond (intersection sol ∩ fond).
 * Détection volontairement simple : plus forte ligne quasi-horizontale
 * dans le tiers bas-médian. Sinon, rail horizontal par défaut.
 */
export async function detectPhotoXAxis(dataUrl) {
  const fallback = { a: [0.07, 0.7], b: [0.93, 0.7] }
  try {
    const img = await loadImageElement(dataUrl)
    const w = 420
    const h = Math.max(32, Math.round((img.height / img.width) * w))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return fallback
    ctx.drawImage(img, 0, 0, w, h)
    const { data } = ctx.getImageData(0, 0, w, h)
    const y0 = (h * 0.42) | 0
    const y1 = (h * 0.82) | 0
    const row = new Float64Array(h)
    for (let y = y0 + 1; y < y1 - 1; y += 1) {
      let s = 0
      for (let x = 2; x < w - 2; x += 1) {
        const up = grayAt(data, ((y - 1) * w + x) * 4)
        const dn = grayAt(data, ((y + 1) * w + x) * 4)
        s += Math.abs(dn - up)
      }
      row[y] = s
    }
    let bestY = ((y0 + y1) / 2) | 0
    let best = 0
    for (let y = y0; y < y1; y += 1) {
      if (row[y] > best) {
        best = row[y]
        bestY = y
      }
    }
    const yf = Math.min(0.88, Math.max(0.38, bestY / h))
    return { a: [0.06, yf], b: [0.94, yf] }
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

/** +X le long du rail, vers le plus long restant (le meuble occupe le mur). */
export function xPlusUv(calib, origin) {
  const o = origin || calib.originUv
  if (!o) return [1, 0]
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
  const dirX = xPlusUv(calib, origin)
  const dirZ = calib.zUv
    ? dirFrom(origin, calib.zUv)
    : [0, -1]
  const dirY = calib.yUv
    ? dirFrom(origin, calib.yUv)
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
