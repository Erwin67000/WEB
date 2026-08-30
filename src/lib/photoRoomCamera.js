/**
 * Mini-environnement photo : repère pièce.
 *
 * Origine = coin sol des deux murs.
 * +X  = longueur / mur du fond (le plus frontal, ou le plus « vert »)
 * +Y meuble = profondeur / second mur  →  Three −Z
 * +Z meuble = haut                      →  Three +Y
 *
 * La photo reste un fond écran : on calcule une caméra dont la projection
 * superpose ces axes sur les plinthes détectées.
 */

export const DEFAULT_PHOTO_CAMERA = {
  pos: [1.27, 1.35, -2.9],
  target: [0.04, 0.36, -0.04],
  fov: 48,
}

const CAMERA_HEIGHT_M = 1.35

export function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('photo load failed'))
    img.src = url
  })
}

function rgbToHsv(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d > 1e-6) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max < 1e-6 ? 0 : d / max
  return { h, s, v: max }
}

function classifyPixel(r, g, b) {
  const { h, s, v } = rgbToHsv(r, g, b)
  const green =
    h > 90 && h < 180 && s > 0.18 && v > 0.12 && g > r && g > b
  const white = s < 0.16 && v > 0.62
  // Parquet / bois : orange saturé. Évite le mur blanc chauffé par une lampe.
  const wood =
    h > 12 &&
    h < 52 &&
    s > 0.28 &&
    s < 0.92 &&
    v > 0.18 &&
    v < 0.88 &&
    r - b > 40 &&
    g < r * 0.88
  return { green, white, wood, h, s, v }
}

function floodFloor(wood, w, h) {
  const floor = new Uint8Array(w * h)
  const stack = []
  const y0 = h - 1
  for (let x = 0; x < w; x += 1) {
    const i = y0 * w + x
    if (wood[i]) {
      floor[i] = 1
      stack.push(i)
    }
  }
  // also seed a few rows so a thin non-wood strip at the very bottom doesn't kill it
  for (let y = h - 2; y >= h - 6 && y >= 0; y -= 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x
      if (wood[i] && !floor[i]) {
        floor[i] = 1
        stack.push(i)
      }
    }
  }
  while (stack.length) {
    const i = stack.pop()
    const x = i % w
    const y = (i - x) / w
    const neigh = [i - 1, i + 1, i - w, i + w]
    for (let k = 0; k < 4; k += 1) {
      const j = neigh[k]
      if (j < 0 || j >= w * h) continue
      const nx = j % w
      const ny = (j - nx) / w
      if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue
      if (floor[j] || !wood[j]) continue
      floor[j] = 1
      stack.push(j)
    }
  }
  return floor
}

function floorTopPoints(floor, w, h) {
  const pts = []
  const yMin = Math.floor(h * 0.18)
  for (let x = 0; x < w; x += 1) {
    let top = -1
    for (let y = yMin; y < h; y += 1) {
      if (floor[y * w + x]) {
        top = y
        break
      }
    }
    if (top >= 0) pts.push({ x, y: top })
  }
  return pts
}

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function ransacLine(points, iters = 280, thresh = 3.5) {
  if (!points || points.length < 8) return null
  let best = null
  let bestN = -1
  const n = points.length
  const rnd = mulberry32(0x9e3779b1 + n * 17)
  for (let t = 0; t < iters; t += 1) {
    const i = (rnd() * n) | 0
    let j = (rnd() * n) | 0
    if (j === i) j = (j + 1) % n
    const a = points[i]
    const b = points[j]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy)
    if (len < 8) continue
    const nx = -dy / len
    const ny = dx / len
    let count = 0
    for (let k = 0; k < n; k += 1) {
      const d = Math.abs((points[k].x - a.x) * nx + (points[k].y - a.y) * ny)
      if (d < thresh) count += 1
    }
    if (count > bestN) {
      bestN = count
      best = { a, b, nx, ny }
    }
  }
  if (!best || bestN < 8) return null
  const inliers = []
  for (let k = 0; k < n; k += 1) {
    const d = Math.abs(
      (points[k].x - best.a.x) * best.nx + (points[k].y - best.a.y) * best.ny,
    )
    if (d < thresh) inliers.push(points[k])
  }
  let sumX = 0
  let sumY = 0
  let sumXX = 0
  let sumXY = 0
  for (let k = 0; k < inliers.length; k += 1) {
    sumX += inliers[k].x
    sumY += inliers[k].y
    sumXX += inliers[k].x * inliers[k].x
    sumXY += inliers[k].x * inliers[k].y
  }
  const m = inliers.length
  const denom = m * sumXX - sumX * sumX
  let slope
  let intercept
  if (Math.abs(denom) < 1e-6) {
    slope = 1e6
    intercept = inliers[0].x
  } else {
    slope = (m * sumXY - sumX * sumY) / denom
    intercept = (sumY - slope * sumX) / m
  }
  let xmin = inliers[0].x
  let xmax = inliers[0].x
  for (let k = 1; k < inliers.length; k += 1) {
    if (inliers[k].x < xmin) xmin = inliers[k].x
    if (inliers[k].x > xmax) xmax = inliers[k].x
  }
  return {
    m: slope,
    c: intercept,
    n: inliers.length,
    xmin,
    xmax,
    angle: Math.atan(slope),
  }
}

function lineAtX(line, x) {
  return line.m * x + line.c
}

function lineIntersect(a, b) {
  const d = a.m - b.m
  if (Math.abs(d) < 1e-6) return null
  const x = (b.c - a.c) / d
  const y = a.m * x + a.c
  return { x, y }
}

function meanColorAbove(data, w, h, pts, line) {
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  let greenN = 0
  let whiteN = 0
  const step = Math.max(1, Math.floor(pts.length / 40))
  for (let i = 0; i < pts.length; i += step) {
    const p = pts[i]
    const yLine = lineAtX(line, p.x)
    const y = Math.max(2, Math.round(yLine - 18))
    if (y >= h) continue
    const o = (y * w + p.x) * 4
    r += data[o]
    g += data[o + 1]
    b += data[o + 2]
    n += 1
    const c = classifyPixel(data[o], data[o + 1], data[o + 2])
    if (c.green) greenN += 1
    if (c.white) whiteN += 1
  }
  if (!n) return { r: 0, g: 0, b: 0, greenFrac: 0, whiteFrac: 0 }
  return {
    r: r / n,
    g: g / n,
    b: b / n,
    greenFrac: greenN / n,
    whiteFrac: whiteN / n,
  }
}

function distToLine(p, line) {
  return Math.abs(p.y - (line.m * p.x + line.c)) / Math.hypot(line.m, 1)
}

function analyzeImageData(data, w, h) {
  const wood = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i += 1) {
    const o = i * 4
    const y = Math.floor(i / w)
    const c = classifyPixel(data[o], data[o + 1], data[o + 2])
    // Le sol est dans le bas de l’image ; ça coupe les faux bois du mur.
    if (c.wood && y > h * 0.32) wood[i] = 1
  }
  const floor = floodFloor(wood, w, h)
  const contour = floorTopPoints(floor, w, h)
  if (contour.length < 24) return null

  const first = ransacLine(contour)
  if (!first) return null
  const rest = contour.filter((p) => distToLine(p, first) > 5)
  const second = ransacLine(rest)

  let lineA = first
  let lineB = second
  if (lineB && Math.abs(lineA.angle) > Math.abs(lineB.angle)) {
    const tmp = lineA
    lineA = lineB
    lineB = tmp
  }

  let corner = lineB ? lineIntersect(lineA, lineB) : null
  if (
    !corner ||
    corner.x < w * 0.08 ||
    corner.x > w * 0.92 ||
    corner.y < h * 0.28 ||
    corner.y > h * 0.9
  ) {
    const xLo = w * 0.2
    const xHi = w * 0.85
    let apex = contour[0]
    for (let i = 0; i < contour.length; i += 1) {
      const p = contour[i]
      if (p.x < xLo || p.x > xHi) continue
      if (p.y < apex.y) apex = p
    }
    corner = { x: apex.x, y: apex.y }
  }

  const leftPts = contour.filter((p) => p.x < corner.x - 6)
  const rightPts = contour.filter((p) => p.x > corner.x + 6)
  const leftFit = ransacLine(leftPts) || lineA
  const rightFit = ransacLine(rightPts) || lineB
  const hit = leftFit && rightFit ? lineIntersect(leftFit, rightFit) : null
  if (
    hit &&
    hit.x > w * 0.1 &&
    hit.x < w * 0.9 &&
    hit.y > h * 0.28 &&
    hit.y < h * 0.9
  ) {
    corner = hit
  }

  const leftLine = leftFit || lineA
  const rightLine = rightFit || lineB || lineA
  const leftColor = meanColorAbove(data, w, h, leftPts, leftLine)
  const rightColor = meanColorAbove(data, w, h, rightPts, rightLine)

  const leftHoriz = Math.abs(leftLine.angle)
  const rightHoriz = Math.abs(rightLine.angle)
  const leftIsFond =
    leftColor.greenFrac - rightColor.greenFrac > 0.1 ||
    (Math.abs(leftColor.greenFrac - rightColor.greenFrac) <= 0.1 &&
      leftHoriz <= rightHoriz)

  const fondLine = leftIsFond ? leftLine : rightLine
  const sideLine = leftIsFond ? rightLine : leftLine
  const fondLeft = leftIsFond

  const dirFond = fondLeft
    ? { x: -1, y: -fondLine.m }
    : { x: 1, y: fondLine.m }
  const dirSide = fondLeft
    ? { x: 1, y: sideLine.m }
    : { x: -1, y: -sideLine.m }
  const nF = Math.hypot(dirFond.x, dirFond.y) || 1
  const nS = Math.hypot(dirSide.x, dirSide.y) || 1
  return {
    cornerUv: [corner.x / w, corner.y / h],
    dirX: [dirFond.x / nF / w, dirFond.y / nF / h],
    dirY: [dirSide.x / nS / w, dirSide.y / nS / h],
  }
}

function angDiff(a, b) {
  let d = a - b
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return Math.abs(d)
}

function yawPitchToR(yaw, pitch) {
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  // R = Ry(yaw) · Rx(pitch)  — caméra → monde
  return [
    [cy, sy * sp, sy * cp],
    [0, cp, -sp],
    [-sy, cy * sp, cy * cp],
  ]
}

function mulR(R, v) {
  return [
    R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2],
    R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2],
    R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2],
  ]
}

function mulRT(R, v) {
  return [
    R[0][0] * v[0] + R[1][0] * v[1] + R[2][0] * v[2],
    R[0][1] * v[0] + R[1][1] * v[1] + R[2][1] * v[2],
    R[0][2] * v[0] + R[1][2] * v[1] + R[2][2] * v[2],
  ]
}

function pixelToDirCam(u, v, fovV, w, h) {
  const fy = h / 2 / Math.tan((fovV * Math.PI) / 360)
  const cx = (w - 1) / 2
  const cy = (h - 1) / 2
  const x = (u - cx) / fy
  const y = -(v - cy) / fy
  const z = -1
  const n = Math.hypot(x, y, z) || 1
  return [x / n, y / n, z / n]
}

function projectPoint(P, C, R, fovV, w, h) {
  const d = [P[0] - C[0], P[1] - C[1], P[2] - C[2]]
  const X = mulRT(R, d)
  if (X[2] > -0.02) return null
  const fy = h / 2 / Math.tan((fovV * Math.PI) / 360)
  const cx = (w - 1) / 2
  const cy = (h - 1) / 2
  return [cx + (fy * X[0]) / -X[2], cy - (fy * X[1]) / -X[2]]
}

function quaternionFromCamToWorld(R) {
  const m00 = R[0][0]
  const m01 = R[0][1]
  const m02 = R[0][2]
  const m10 = R[1][0]
  const m11 = R[1][1]
  const m12 = R[1][2]
  const m20 = R[2][0]
  const m21 = R[2][1]
  const m22 = R[2][2]
  const tr = m00 + m11 + m22
  let qw
  let qx
  let qy
  let qz
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2
    qw = 0.25 * s
    qx = (m21 - m12) / s
    qy = (m02 - m20) / s
    qz = (m10 - m01) / s
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2
    qw = (m21 - m12) / s
    qx = 0.25 * s
    qy = (m01 + m10) / s
    qz = (m02 + m20) / s
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2
    qw = (m02 - m20) / s
    qx = (m01 + m10) / s
    qy = 0.25 * s
    qz = (m12 + m21) / s
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2
    qw = (m10 - m01) / s
    qx = (m02 + m20) / s
    qy = (m12 + m21) / s
    qz = 0.25 * s
  }
  return [qx, qy, qz, qw]
}

/**
 * Caméra Three.js telle que l’origine (coin) se projette sur corner,
 * +X le long de dirX, +Y meuble (Three −Z) le long de dirY.
 */
export function solvePhotoCamera(axes, width, height) {
  if (!axes?.cornerUv || !axes.dirX || !axes.dirY) return null
  const w = Math.max(2, width)
  const h = Math.max(2, height)
  const corner = [axes.cornerUv[0] * w, axes.cornerUv[1] * h]
  const dirX = [axes.dirX[0] * w, axes.dirX[1] * h]
  const dirY = [axes.dirY[0] * w, axes.dirY[1] * h]
  const tX = Math.atan2(dirX[1], dirX[0])
  const tY = Math.atan2(dirY[1], dirY[0])
  const H = CAMERA_HEIGHT_M

  let best = null

  const evaluate = (fov, pitch, yaw) => {
    const R = yawPitchToR(yaw, pitch)
    const dcam = pixelToDirCam(corner[0], corner[1], fov, w, h)
    const dworld = mulR(R, dcam)
    if (Math.abs(dworld[1]) < 1e-6) return
    const s = -H / dworld[1]
    if (s < 0.8 || s > 8) return
    const C = [-s * dworld[0], -s * dworld[1], -s * dworld[2]]
    if (C[0] < 0.08 || C[2] > -0.08) return
    const p0 = projectPoint([0, 0, 0], C, R, fov, w, h)
    const pX = projectPoint([1, 0, 0], C, R, fov, w, h)
    const pY = projectPoint([0, 0, -1], C, R, fov, w, h)
    if (!p0 || !pX || !pY) return
    const aX = Math.atan2(pX[1] - p0[1], pX[0] - p0[0])
    const aY = Math.atan2(pY[1] - p0[1], pY[0] - p0[0])
    const err = angDiff(aX, tX) + angDiff(aY, tY)
    const dist = Math.hypot(C[0], C[2])
    const cost = err * 3 + 0.12 * Math.abs(dist - 2.7) + 0.008 * Math.abs(fov - 48)
    if (!best || cost < best.cost) {
      best = { cost, err, fov, pitch, yaw, C, R, dist }
    }
  }

  for (let fov = 34; fov <= 60; fov += 4) {
    for (let pitch = -0.22; pitch <= 0.72; pitch += 0.055) {
      for (let yaw = -Math.PI; yaw < Math.PI; yaw += 0.13) {
        evaluate(fov, pitch, yaw)
      }
    }
  }
  if (best) {
    const fov0 = best.fov
    const p0 = best.pitch
    const y0 = best.yaw
    for (let fov = fov0 - 5; fov <= fov0 + 5; fov += 1.2) {
      for (let pitch = p0 - 0.08; pitch <= p0 + 0.08; pitch += 0.02) {
        for (let yaw = y0 - 0.12; yaw <= y0 + 0.12; yaw += 0.025) {
          evaluate(fov, pitch, yaw)
        }
      }
    }
  }
  if (!best || best.err > 0.55) return null

  const forward = mulR(best.R, [0, 0, -1])
  const target = [
    best.C[0] + forward[0],
    best.C[1] + forward[1],
    best.C[2] + forward[2],
  ]
  return {
    pos: best.C,
    target,
    fov: best.fov,
    quaternion: quaternionFromCamToWorld(best.R),
    errDeg: (best.err * 180) / Math.PI,
  }
}

export function analyzePhotoPixels(data, w, h) {
  return analyzeImageData(data, w, h)
}

export async function estimatePhotoRoom(dataUrl) {
  const img = await loadImageElement(dataUrl)
  const maxW = 640
  const scale = Math.min(1, maxW / Math.max(img.width, 1))
  const w = Math.max(32, Math.round(img.width * scale))
  const h = Math.max(32, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { axes: null, camera: { ...DEFAULT_PHOTO_CAMERA } }
  ctx.drawImage(img, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)
  const axes = analyzeImageData(data, w, h)
  const camera = axes
    ? solvePhotoCamera(axes, w, h) || { ...DEFAULT_PHOTO_CAMERA }
    : { ...DEFAULT_PHOTO_CAMERA }
  return { axes, camera }
}
