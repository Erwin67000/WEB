/**
 * Calage photo : origine → X → Z → Y0 (sur X) → Y → échelle.
 * UV stockées dans l’espace photo (0–1), pas l’écran : les bandes noires
 * ne déforment jamais le cliché.
 */

export const PHOTO_STEPS = [
  'origin',
  'axisX',
  'axisZ',
  'axisY0',
  'axisY',
  'scale',
]

/** Curseur perspective : 0° = parallèle (arête arrière figée sur X), 60° = max. */
export const PHOTO_FOV_DEFAULT = 40
export const PHOTO_FOV_MIN = 0
export const PHOTO_FOV_MAX = 60
/** Profondeur 3D du meuble à 60° — l’avant vient vers la caméra, pas l’arrière. */
export const PHOTO_DEPTH_DEFAULT = 1.45

export function clampPhotoFov(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return PHOTO_FOV_DEFAULT
  return Math.min(PHOTO_FOV_MAX, Math.max(PHOTO_FOV_MIN, n))
}

/** tan(fov/2) ; 0° → quasi-ortho (évite tan(0)). */
export function photoFovTan(fovDeg) {
  const f = Math.max(0.5, clampPhotoFov(fovDeg))
  return Math.tan((f * Math.PI) / 360)
}

/** 0° = plat dans le plan photo ; 60° = profondeur max. */
export function photoDepthK(fovDeg) {
  return (clampPhotoFov(fovDeg) / PHOTO_FOV_MAX) * PHOTO_DEPTH_DEFAULT
}

/** Distance caméra pour que le plan photo (hauteur 2) remplisse le frustum. */
export function photoCamDistance(zoom = 1, fovDeg = PHOTO_FOV_DEFAULT) {
  const z0 = 1 / Math.max(0.12, photoFovTan(fovDeg))
  return z0 / Math.max(0.4, Math.min(4, Number(zoom) || 1))
}

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
    y0Uv: null,
    yUv: null,
    hoverUv: xA,
    scale: 1,
    shiftU: 0,
    shiftV: 0,
    zoom: 1,
    fov: PHOTO_FOV_DEFAULT,
    photoAspect: 1.5,
  }
}

export async function fileToImageDataUrl(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file)
      const c = document.createElement('canvas')
      c.width = bmp.width
      c.height = bmp.height
      c.getContext('2d').drawImage(bmp, 0, 0)
      bmp.close?.()
      return c.toDataURL('image/jpeg', 0.92)
    } catch {
      /* HEIC / formats non décodés : essai data URL brut */
    }
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('lecture photo'))
    reader.readAsDataURL(file)
  })
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
  const fallback = { a: [0.07, 0.7], b: [0.93, 0.7], aspect: 1.5 }
  try {
    const img = await loadImageElement(dataUrl)
    const aspect = img.width / Math.max(1, img.height)
    const w = 480
    const h = Math.max(32, Math.round((img.height / img.width) * w))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return { ...fallback, aspect }
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
    if (pts.length < 8) return { ...fallback, aspect }
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
    if (ang > 0.7) return { ...fallback, aspect }
    const yAt = (xf) => {
      const y = (m * xf * w + c) / h
      return Math.min(0.92, Math.max(0.32, y))
    }
    return { a: [0.04, yAt(0.04)], b: [0.96, yAt(0.96)], aspect }
  } catch {
    return fallback
  }
}

export function clamp01(v) {
  return Math.min(1, Math.max(0, v))
}

/** Plan photo « contain » dans le frustum fov 90° (hauteur visible = 2). */
export function containPlane(viewAspect, photoAspect) {
  const va = Math.max(0.2, Number(viewAspect) || 1)
  const pa = Math.max(0.2, Number(photoAspect) || 1)
  if (pa >= va) {
    const w = 2 * va
    return { w, h: w / pa }
  }
  const h = 2
  return { w: 2 * pa, h }
}

/** Zone photo dans le viewport (0–1), bandes noires autour. */
export function letterboxRect(viewAspect, photoAspect) {
  const { w: pw, h: ph } = containPlane(viewAspect, photoAspect)
  const vw = pw / (2 * Math.max(0.2, viewAspect))
  const vh = ph / 2
  return {
    x: (1 - vw) / 2,
    y: (1 - vh) / 2,
    w: vw,
    h: vh,
  }
}

export function viewToPhotoUv(viewUv, rect) {
  return [
    (viewUv[0] - rect.x) / Math.max(rect.w, 1e-6),
    (viewUv[1] - rect.y) / Math.max(rect.h, 1e-6),
  ]
}

export function photoToViewUv(photoUv, rect) {
  return [
    rect.x + photoUv[0] * rect.w,
    rect.y + photoUv[1] * rect.h,
  ]
}

export function projectOnSegment(p, a, b) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy || 1e-8
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
  t = Math.min(1, Math.max(0, t))
  return [a[0] + dx * t, a[1] + dy * t]
}

/** Projection sur la droite (pas seulement le segment) — Y SketchUp. */
export function projectOnLine(p, a, b) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy || 1e-8
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
  return [a[0] + dx * t, a[1] + dy * t]
}

/** Premier point de Y : sur la droite X, pas forcément à l’origine. */
export function snapToXAxis(p, calib, origin) {
  const o = origin || calib.originUv
  if (!o || !p) return p
  const dir = xPlusUv(calib, o)
  const end = calib.xUv || [o[0] + dir[0], o[1] + dir[1]]
  const snapped = projectOnLine(p, o, end)
  return [clamp01(snapped[0]), clamp01(snapped[1])]
}

export function photoUvFromPointer(ev, el, photoAspect) {
  const viewUv = uvFromPointer(ev, el)
  const r = el.getBoundingClientRect()
  const viewAspect = r.width / Math.max(1, r.height)
  const rect = letterboxRect(viewAspect, photoAspect || viewAspect)
  const uv = viewToPhotoUv(viewUv, rect)
  return [clamp01(uv[0]), clamp01(uv[1])]
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
export function defaultYuv(origin, dirX, from = origin) {
  const p1 = [-dirX[1], dirX[0]]
  const p2 = [dirX[1], -dirX[0]]
  const pick = p1[1] > p2[1] ? p1 : p2
  const start = from || origin
  return [start[0] + pick[0] * 0.2, start[1] + pick[1] * 0.2]
}

export function dirFrom(a, b) {
  const d = [b[0] - a[0], b[1] - a[1]]
  const n = Math.hypot(d[0], d[1]) || 1
  return [d[0] / n, d[1] / n]
}

/**
 * Repère écran (monde Three, plan photo z=0) :
 * Three X = longueur, Three Y = haut, Three Z = −profondeur.
 * L’axe profondeur a une vraie composante Z caméra (perspective),
 * plus seulement un cisaillement 2D (projection parallèle).
 */
export function calibWorldBasis(calib, aspect, viewH) {
  const origin0 = calib.originUv || calib.hoverUv
  if (!origin0) return null
  const origin = [
    origin0[0] + (Number(calib.shiftU) || 0),
    origin0[1] + (Number(calib.shiftV) || 0),
  ]
  const xEnd =
    calib.xUv || (calib.step === 'axisX' ? calib.hoverUv : null)
  const dirX = xEnd ? dirFrom(origin0, xEnd) : xPlusUv(calib, origin0)
  const zEnd =
    calib.zUv || (calib.step === 'axisZ' ? calib.hoverUv : null)
  const dirZ = zEnd ? dirFrom(origin0, zEnd) : [0, -1]
  const yStart = calib.y0Uv || origin0
  const yEnd =
    calib.yUv || (calib.step === 'axisY' ? calib.hoverUv : null)
  const dirY = yEnd
    ? dirFrom(yStart, yEnd)
    : dirFrom(yStart, defaultYuv(origin0, dirX, yStart))

  const { w: planeW, h: planeH } = containPlane(
    aspect,
    calib.photoAspect || aspect,
  )
  const uvToXY = (uv) => [(uv[0] - 0.5) * planeW, (0.5 - uv[1]) * planeH]
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
  const depthK = photoDepthK(calib.fov)
  /* X et Z (hauteur) restent dans le plan photo : l’arête arrière colle à X.
     Seule la profondeur (Y) sort vers la caméra → c’est l’avant qui bouge. */
  return {
    origin: o,
    axisX: [x[0] * worldPerM, x[1] * worldPerM, 0],
    axisY: [zUp[0] * worldPerM, zUp[1] * worldPerM, 0.01],
    axisZ: [-yDep[0] * worldPerM, -yDep[1] * worldPerM, -depthK * worldPerM],
  }
}

/** NDC → UV photo (contain + dolly-zoom selon le fov). */
export function ndcToPhotoUv(ndcX, ndcY, viewAspect, camZ, photoAspect, fovDeg) {
  const z = Math.max(0.2, Number(camZ) || 1)
  const t = photoFovTan(fovDeg)
  const worldX = ndcX * viewAspect * z * t
  const worldY = ndcY * z * t
  const { w: pw, h: ph } = containPlane(viewAspect, photoAspect || viewAspect)
  return [
    clamp01(worldX / Math.max(pw, 1e-6) + 0.5),
    clamp01(0.5 - worldY / Math.max(ph, 1e-6)),
  ]
}

export function projectDeltaOnXY(du, dv, dirX, dirY) {
  const a = dirX[0]
  const b = dirY[0]
  const c = dirX[1]
  const d = dirY[1]
  const det = a * d - b * c
  if (Math.abs(det) < 1e-8) return [du, dv]
  const tX = (d * du - b * dv) / det
  const tY = (-c * du + a * dv) / det
  return [tX * dirX[0] + tY * dirY[0], tX * dirX[1] + tY * dirY[1]]
}
