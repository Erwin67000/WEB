/**
 * Mini-environnement photo — repère orthonormé, indépendant des couleurs.
 *
 * 1. Plan Z = 0 : sol (plinthes), quel que soit le revêtement.
 * 2. Plan Y du fond : mur du fond. Intersection sol ∩ fond = vecteur X (longueur).
 * 3. Verticale (porte, angle, montant) = vecteur Z → Y par produit vectoriel.
 * 4. Si un second mur (angle) est vu, sa plinthe vérifie Y et ancre la hauteur caméra.
 *
 * Convention meuble : +X longueur le long du fond, +Y profondeur, +Z haut.
 * Three.js : (x, z, −y).
 */

export const DEFAULT_PHOTO_CAMERA = {
  pos: [1.27, 1.35, -2.9],
  target: [0.04, 0.36, -0.04],
  fov: 48,
}

const CAMERA_HEIGHTS_M = [1.15, 1.35, 1.55]

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

function toGray(data, w, h) {
  const g = new Float32Array(w * h)
  for (let i = 0, p = 0; i < w * h; i += 1, p += 4) g[i] = grayAt(data, p)
  return g
}

function sobelMag(g, w, h) {
  const mag = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y += 1) {
    const row = y * w
    for (let x = 1; x < w - 1; x += 1) {
      const i = row + x
      const gx = g[i + 1] - g[i - 1]
      const gy = g[i + w] - g[i - w]
      mag[i] = Math.hypot(gx, gy)
    }
  }
  return mag
}

function percentile(arr, p) {
  const copy = Array.from(arr)
  copy.sort((a, b) => a - b)
  const i = Math.min(copy.length - 1, Math.max(0, Math.floor((p / 100) * copy.length)))
  return copy[i]
}

function houghPeaks(mag, w, h, { thetaMin, thetaMax, nPeaks, magPct }) {
  const magTh = percentile(mag, magPct)
  const pts = []
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      if (mag[y * w + x] >= magTh) pts.push(x, y)
    }
  }
  const maxPts = 9000
  if (pts.length / 2 > maxPts) {
    const step = Math.ceil(pts.length / 2 / maxPts)
    const slim = []
    for (let i = 0; i < pts.length; i += step * 2) {
      slim.push(pts[i], pts[i + 1])
    }
    pts.length = 0
    pts.push(...slim)
  }
  const nTheta = 90
  const diag = (Math.hypot(w, h) | 0) + 2
  const accH = 2 * diag
  const acc = new Int16Array(accH * nTheta)
  const thetas = new Float32Array(nTheta)
  const cos = new Float32Array(nTheta)
  const sin = new Float32Array(nTheta)
  for (let t = 0; t < nTheta; t += 1) {
    const th = (t * Math.PI) / nTheta
    thetas[t] = th
    cos[t] = Math.cos(th)
    sin[t] = Math.sin(th)
  }
  const t0 = Math.max(0, Math.floor((thetaMin / Math.PI) * nTheta))
  const t1 = Math.min(nTheta, Math.ceil((thetaMax / Math.PI) * nTheta))
  for (let i = 0; i < pts.length; i += 2) {
    const x = pts[i]
    const y = pts[i + 1]
    for (let t = t0; t < t1; t += 1) {
      const rho = (x * cos[t] + y * sin[t]) | 0
      acc[(rho + diag) * nTheta + t] += 1
    }
  }
  const peaks = []
  const used = new Int8Array(accH * nTheta)
  for (let p = 0; p < nPeaks; p += 1) {
    let best = 16
    let bi = -1
    for (let i = 0; i < acc.length; i += 1) {
      if (used[i]) continue
      if (acc[i] > best) {
        best = acc[i]
        bi = i
      }
    }
    if (bi < 0) break
    const rhoI = (bi / nTheta) | 0
    const tI = bi - rhoI * nTheta
    peaks.push({ rho: rhoI - diag, theta: thetas[tI], votes: best })
    for (let dr = -5; dr <= 5; dr += 1) {
      for (let dt = -3; dt <= 3; dt += 1) {
        const rr = rhoI + dr
        let tt = tI + dt
        if (tt < 0) tt += nTheta
        if (tt >= nTheta) tt -= nTheta
        if (rr >= 0 && rr < accH) used[rr * nTheta + tt] = 1
      }
    }
  }
  return { peaks, magTh }
}

function extractSegment(mag, w, h, rho, theta, magTh) {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  const dx = -s
  const dy = c
  let x0
  let y0
  if (Math.abs(s) > Math.abs(c)) {
    y0 = h * 0.5
    x0 = (rho - y0 * s) / (Math.abs(c) > 1e-6 ? c : 1e-6)
  } else {
    x0 = w * 0.5
    y0 = (rho - x0 * c) / (Math.abs(s) > 1e-6 ? s : 1e-6)
  }
  const n = (Math.hypot(w, h) * 2) | 0
  const hits = []
  for (let i = -n; i < n; i += 1) {
    const x = x0 + dx * i
    const y = y0 + dy * i
    const xi = Math.round(x)
    const yi = Math.round(y)
    if (xi < 1 || yi < 1 || xi >= w - 1 || yi >= h - 1) continue
    if (mag[yi * w + xi] >= magTh) hits.push(i, x, y)
  }
  if (hits.length < 30) return null
  let bestS = 0
  let bestE = 0
  let runS = 0
  const nHits = hits.length / 3
  for (let k = 1; k < nHits; k += 1) {
    if (hits[k * 3] - hits[(k - 1) * 3] > 5) {
      if (k - runS > bestE - bestS) {
        bestS = runS
        bestE = k
      }
      runS = k
    }
  }
  if (nHits - runS > bestE - bestS) {
    bestS = runS
    bestE = nHits
  }
  if (bestE - bestS < 10) return null
  const x1 = hits[bestS * 3 + 1]
  const y1 = hits[bestS * 3 + 2]
  const x2 = hits[(bestE - 1) * 3 + 1]
  const y2 = hits[(bestE - 1) * 3 + 2]
  const length = Math.hypot(x2 - x1, y2 - y1)
  if (length < 20) return null
  const dirDeg = (((theta * 180) / Math.PI + 90) % 180 + 180) % 180
  return {
    x1,
    y1,
    x2,
    y2,
    length,
    dirDeg,
    theta,
    rho,
    midX: (x1 + x2) * 0.5,
    midY: (y1 + y2) * 0.5,
    yMin: Math.min(y1, y2),
    yMax: Math.max(y1, y2),
  }
}

function isVerticalDir(deg) {
  return Math.abs(deg - 90) < 24
}

function detectSegments(mag, w, h) {
  const vert = houghPeaks(mag, w, h, {
    thetaMin: 0,
    thetaMax: (24 * Math.PI) / 180,
    nPeaks: 16,
    magPct: 80,
  })
  const vert2 = houghPeaks(mag, w, h, {
    thetaMin: Math.PI - (24 * Math.PI) / 180,
    thetaMax: Math.PI,
    nPeaks: 10,
    magPct: 80,
  })
  const rest = houghPeaks(mag, w, h, {
    thetaMin: (22 * Math.PI) / 180,
    thetaMax: Math.PI - (22 * Math.PI) / 180,
    nPeaks: 28,
    magPct: 84,
  })
  const segs = []
  const pushPeak = (peak, magTh) => {
    const s = extractSegment(mag, w, h, peak.rho, peak.theta, magTh)
    if (s) segs.push(s)
  }
  vert.peaks.forEach((p) => pushPeak(p, vert.magTh))
  vert2.peaks.forEach((p) => pushPeak(p, vert2.magTh))
  rest.peaks.forEach((p) => pushPeak(p, rest.magTh))
  return segs
}

function structureScore(g, w, h) {
  let colVar = 0
  let rowVar = 0
  const colMean = new Float32Array(w)
  const rowMean = new Float32Array(h)
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const gx = Math.abs(g[y * w + x + 1] - g[y * w + x - 1])
      const gy = Math.abs(g[(y + 1) * w + x] - g[(y - 1) * w + x])
      colMean[x] += gx
      rowMean[y] += gy
    }
  }
  for (let x = 1; x < w - 1; x += 1) colMean[x] /= h
  for (let y = 1; y < h - 1; y += 1) rowMean[y] /= w
  const cAvg = colMean.reduce((a, b) => a + b, 0) / w
  const rAvg = rowMean.reduce((a, b) => a + b, 0) / h
  for (let x = 0; x < w; x += 1) colVar += (colMean[x] - cAvg) ** 2
  for (let y = 0; y < h; y += 1) rowVar += (rowMean[y] - rAvg) ** 2
  colVar = Math.sqrt(colVar / w)
  rowVar = Math.sqrt(rowVar / h)
  let lowH = 0
  let upH = 0
  let nL = 0
  let nU = 0
  const yLo = (h * 0.55) | 0
  const yHi = (h * 0.45) | 0
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const gy = Math.abs(g[(y + 1) * w + x] - g[(y - 1) * w + x])
      if (y >= yLo) {
        lowH += gy
        nL += 1
      } else if (y <= yHi) {
        upH += gy
        nU += 1
      }
    }
  }
  const low = nL ? lowH / nL : 0
  const up = nU ? upH / nU : 0
  return { colVar, rowVar, floorRatio: low / (up + 1e-6) }
}

function rotateGray(g, w, h, rotCw) {
  if (rotCw === 0) return { g, w, h }
  if (rotCw === 180) {
    const o = new Float32Array(w * h)
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        o[(h - 1 - y) * w + (w - 1 - x)] = g[y * w + x]
      }
    }
    return { g: o, w, h }
  }
  const nw = h
  const nh = w
  const o = new Float32Array(nw * nh)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (rotCw === 90) o[x * nw + (h - 1 - y)] = g[y * w + x]
      else o[(w - 1 - x) * nw + y] = g[y * w + x]
    }
  }
  return { g: o, w: nw, h: nh }
}

function chooseOrientation(g, w, h) {
  const candidates = [0]
  const s0 = structureScore(g, w, h)
  if (s0.rowVar > s0.colVar * 1.12) {
    candidates.length = 0
    candidates.push(90, 270)
  } else {
    candidates.push(180)
  }
  let best = 0
  let bestScore = -1e9
  for (let i = 0; i < candidates.length; i += 1) {
    const rot = candidates[i]
    const r = rotateGray(g, w, h, rot)
    const s = structureScore(r.g, r.w, r.h)
    const upright = s.colVar - s.rowVar * 0.35
    const floor = Math.log(s.floorRatio + 0.15)
    const score = upright + floor * 4
    if (score > bestScore) {
      bestScore = score
      best = rot
    }
  }
  return best
}

function rotateRgba(data, w, h, rotCw) {
  if (rotCw === 0) return { data, w, h }
  const src = data
  const px = (x, y) => {
    const i = (y * w + x) * 4
    return [src[i], src[i + 1], src[i + 2], src[i + 3]]
  }
  if (rotCw === 180) {
    const out = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const [r, g, b, a] = px(w - 1 - x, h - 1 - y)
        const o = (y * w + x) * 4
        out[o] = r
        out[o + 1] = g
        out[o + 2] = b
        out[o + 3] = a
      }
    }
    return { data: out, w, h }
  }
  const nw = h
  const nh = w
  const out = new Uint8ClampedArray(nw * nh * 4)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const [r, g, b, a] = px(x, y)
      let nx
      let ny
      if (rotCw === 90) {
        nx = h - 1 - y
        ny = x
      } else {
        nx = y
        ny = w - 1 - x
      }
      const o = (ny * nw + nx) * 4
      out[o] = r
      out[o + 1] = g
      out[o + 2] = b
      out[o + 3] = a
    }
  }
  return { data: out, w: nw, h: nh }
}

function fitLine(points) {
  if (!points || points.length < 6) return null
  let best = null
  let bestN = -1
  const n = points.length
  const rnd = (s) => {
    s = (s + 0x6d2b79f5) | 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  let seed = 0x9e3779b1 + n * 13
  for (let t = 0; t < 220; t += 1) {
    const i = (rnd((seed += 17)) * n) | 0
    let j = (rnd((seed += 17)) * n) | 0
    if (j === i) j = (j + 1) % n
    const a = points[i]
    const b = points[j]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy)
    if (len < 10) continue
    const nx = -dy / len
    const ny = dx / len
    let count = 0
    for (let k = 0; k < n; k += 1) {
      const d = Math.abs((points[k].x - a.x) * nx + (points[k].y - a.y) * ny)
      if (d < 4) count += 1
    }
    if (count > bestN) {
      bestN = count
      best = { a, nx, ny }
    }
  }
  if (!best || bestN < 6) return null
  const inliers = points.filter(
    (p) => Math.abs((p.x - best.a.x) * best.nx + (p.y - best.a.y) * best.ny) < 4,
  )
  let sx = 0
  let sy = 0
  let sxx = 0
  let sxy = 0
  for (let k = 0; k < inliers.length; k += 1) {
    sx += inliers[k].x
    sy += inliers[k].y
    sxx += inliers[k].x * inliers[k].x
    sxy += inliers[k].x * inliers[k].y
  }
  const m = inliers.length
  const den = m * sxx - sx * sx
  const slope = Math.abs(den) < 1e-6 ? 1e6 : (m * sxy - sx * sy) / den
  const intercept = (sy - slope * sx) / m
  return {
    m: slope,
    c: intercept,
    n: inliers.length,
    angle: Math.atan(slope),
    inliers,
  }
}

function intersectLines(a, b) {
  const d = a.m - b.m
  if (Math.abs(d) < 1e-6) return null
  const x = (b.c - a.c) / d
  return { x, y: a.m * x + a.c }
}

function unit(x, y) {
  const n = Math.hypot(x, y) || 1
  return [x / n, y / n]
}

function angleDelta(a, b) {
  let d = Math.abs(a - b) % 180
  if (d > 90) d = 180 - d
  return d
}

function plinthBands(g, w, h) {
  const row = new Float32Array(h)
  for (let y = 2; y < h - 2; y += 1) {
    let s = 0
    for (let x = 2; x < w - 2; x += 1) {
      s += Math.abs(g[(y + 1) * w + x] - g[(y - 1) * w + x])
    }
    row[y] = s / w
  }
  const y0 = (h * 0.4) | 0
  const y1 = (h * 0.86) | 0
  const cands = []
  for (let y = y0 + 5; y < y1 - 5; y += 1) {
    if (row[y] >= row[y - 4] && row[y] >= row[y + 4]) {
      cands.push({ y, e: row[y] })
    }
  }
  cands.sort((a, b) => b.e - a.e)
  const minGap = h * 0.045
  const bands = []
  for (let i = 0; i < cands.length && bands.length < 3; i += 1) {
    if (bands.every((b) => Math.abs(b - cands[i].y) >= minGap)) {
      bands.push(cands[i].y)
    }
  }
  if (!bands.length) bands.push(((y0 + y1) / 2) | 0)
  return bands
}

function nearBand(y, bands, tol) {
  for (let i = 0; i < bands.length; i += 1) {
    if (Math.abs(y - bands[i]) <= tol) return true
  }
  return false
}

function clusterPlinths(segs) {
  const clusters = []
  segs.forEach((s) => {
    let hit = null
    let hitD = 22
    for (let i = 0; i < clusters.length; i += 1) {
      const d = angleDelta(clusters[i].deg, s.dirDeg)
      if (d < hitD) {
        hitD = d
        hit = clusters[i]
      }
    }
    if (hit) {
      hit.segs.push(s)
      hit.length += s.length
      hit.deg =
        (hit.deg * (hit.segs.length - 1) + s.dirDeg) / hit.segs.length
    } else {
      clusters.push({ deg: s.dirDeg, segs: [s], length: s.length })
    }
  })
  clusters.sort((a, b) => b.length - a.length)
  return clusters
}

function lineFromSegs(cluster) {
  const points = []
  cluster.segs.forEach((s) => {
    const steps = Math.max(2, Math.floor(s.length / 16))
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps
      points.push({
        x: s.x1 + (s.x2 - s.x1) * t,
        y: s.y1 + (s.y2 - s.y1) * t,
      })
    }
  })
  return fitLine(points)
}

/**
 * Construit X (sol ∩ fond), Z (verticales), Y (orthonormé),
 * vérifié par la seconde plinthe si un angle est visible.
 */
function kmeans3(pts) {
  if (pts.length < 9) return []
  const cents = [
    pts[0].slice(),
    pts[(pts.length / 2) | 0].slice(),
    pts[pts.length - 1].slice(),
  ]
  const lab = new Int16Array(pts.length)
  for (let it = 0; it < 7; it += 1) {
    for (let i = 0; i < pts.length; i += 1) {
      let b = 0
      let bd = 1e12
      for (let c = 0; c < 3; c += 1) {
        const d =
          (pts[i][0] - cents[c][0]) ** 2 +
          (pts[i][1] - cents[c][1]) ** 2 +
          (pts[i][2] - cents[c][2]) ** 2
        if (d < bd) {
          bd = d
          b = c
        }
      }
      lab[i] = b
    }
    for (let c = 0; c < 3; c += 1) {
      let n = 0
      let r = 0
      let g = 0
      let b = 0
      for (let i = 0; i < pts.length; i += 1) {
        if (lab[i] !== c) continue
        n += 1
        r += pts[i][0]
        g += pts[i][1]
        b += pts[i][2]
      }
      if (n) {
        cents[c][0] = r / n
        cents[c][1] = g / n
        cents[c][2] = b / n
      }
    }
  }
  return cents
}

function floodFloorMask(data, w, h) {
  const ySeed = (h * 0.78) | 0
  const samples = []
  for (let y = ySeed; y < h; y += 2) {
    for (let x = 0; x < w; x += 3) {
      const i = (y * w + x) * 4
      samples.push([data[i], data[i + 1], data[i + 2]])
    }
  }
  const cents = kmeans3(samples)
  const floor = new Uint8Array(w * h)
  const tol2 = 48 * 48
  const yTopLim = (h * 0.12) | 0
  for (let c = 0; c < cents.length; c += 1) {
    const vis = new Uint8Array(w * h)
    const q = []
    const cr = cents[c][0]
    const cg = cents[c][1]
    const cb = cents[c][2]
    const match = (x, y) => {
      const i = (y * w + x) * 4
      const d =
        (data[i] - cr) ** 2 + (data[i + 1] - cg) ** 2 + (data[i + 2] - cb) ** 2
      return d <= tol2
    }
    for (let y = h - 1; y >= ySeed; y -= 1) {
      for (let x = 0; x < w; x += 2) {
        const id = y * w + x
        if (vis[id] || !match(x, y)) continue
        vis[id] = 1
        q.push(id)
      }
    }
    for (let qi = 0; qi < q.length; qi += 1) {
      const id = q[qi]
      const x = id % w
      const y = (id - x) / w
      const neigh = [id - 1, id + 1, id - w, id + w]
      for (let k = 0; k < 4; k += 1) {
        const j = neigh[k]
        if (j < 0 || j >= w * h || vis[j]) continue
        const nx = j % w
        const ny = (j - nx) / w
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue
        if (!match(nx, ny)) continue
        vis[j] = 1
        q.push(j)
      }
    }
    let top = 0
    let nTop = 0
    let ySum = 0
    let yMin = h
    let n = 0
    for (let i = 0; i < vis.length; i += 1) {
      if (!vis[i]) continue
      n += 1
      const y = (i / w) | 0
      ySum += y
      if (y < yMin) yMin = y
      if (y < yTopLim) {
        top += 1
        nTop += 1
      }
    }
    const area = n / (w * h)
    const topF = nTop ? top / (yTopLim * w) : 0
    const med = n ? ySum / n / h : 0
    const span = n ? (h - yMin) / h : 0
    const keep =
      area > 0.03 &&
      topF < 0.02 &&
      med > 0.62 &&
      yMin > h * 0.38 &&
      span < 0.5
    if (keep) {
      for (let i = 0; i < vis.length; i += 1) if (vis[i]) floor[i] = 1
    }
  }
  return floor
}

function floorEnvelope(floor, w, h) {
  const pts = []
  const yMin = (h * 0.2) | 0
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

function clipEnvelope(envelope, h) {
  if (!envelope || envelope.length < 16) return envelope || []
  const ys = envelope.map((p) => p.y).sort((a, b) => a - b)
  const med = ys[(ys.length * 0.45) | 0]
  const lo = med - h * 0.1
  const hi = med + h * 0.14
  return envelope.filter((p) => p.y >= lo && p.y <= hi)
}

function meanY(line) {
  if (!line?.inliers?.length) return 0
  return line.inliers.reduce((s, p) => s + p.y, 0) / line.inliers.length
}

function axesFromGeometry(segs, w, h, bands, envelope) {
  const lines = []
  const clipped = clipEnvelope(envelope, h)
  if (clipped && clipped.length > 24) {
    const first = fitLine(clipped)
    if (first) {
      lines.push(first)
      const rest = clipped.filter((p) => {
        const d = Math.abs(p.y - (first.m * p.x + first.c)) / Math.hypot(first.m, 1)
        return d > 6
      })
      const second = fitLine(rest)
      if (second && Math.abs(second.angle - first.angle) > 0.18) lines.push(second)
    }
  }
  if (lines.length < 2) {
    const tol = h * 0.11
    const plinthSegs = segs.filter((s) => {
      if (isVerticalDir(s.dirDeg) || s.length < 28) return false
      if (s.midY < h * 0.36 || s.midY > h * 0.9) return false
      const horiz = Math.min(s.dirDeg, 180 - s.dirDeg)
      if (horiz > 40 && horiz < 50) return false
      if (bands && bands.length && !nearBand(s.midY, bands, tol)) return false
      return true
    })
    const clusters = clusterPlinths(plinthSegs)
    for (let i = 0; i < clusters.length && lines.length < 2; i += 1) {
      if (
        lines.length &&
        angleDelta(((Math.atan(lines[0].m) * 180) / Math.PI + 360) % 180, clusters[i].deg) < 18
      ) {
        continue
      }
      const ln = lineFromSegs(clusters[i])
      if (ln) lines.push(ln)
    }
  }
  if (!lines.length) return null

  let fond = lines[0]
  let side = lines[1] || null
  if (side) {
    const yF = meanY(fond)
    const yS = meanY(side)
    const span = (line) => {
      const xs = line.inliers.map((p) => p.x)
      return Math.max(...xs) - Math.min(...xs)
    }
    const sF = span(fond)
    const sS = span(side)
    const swapFar = yS < yF - 10 && sS > w * 0.22
    const swapHoriz =
      Math.abs(yS - yF) < 14 &&
      Math.abs(side.angle) < Math.abs(fond.angle) &&
      sS > w * 0.18
    const swapWide =
      sS > sF * 1.2 && Math.abs(side.angle) <= Math.abs(fond.angle) + 0.2
    if (swapFar || swapHoriz || swapWide) {
      const tmp = fond
      fond = side
      side = tmp
    }
  }

  let corner = side ? intersectLines(fond, side) : null
  if (
    !corner ||
    corner.x < w * 0.04 ||
    corner.x > w * 0.96 ||
    corner.y < h * 0.22 ||
    corner.y > h * 0.95
  ) {
    const xs = fond.inliers.map((p) => p.x)
    const mid = xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1)
    corner = { x: mid, y: fond.m * mid + fond.c }
  }

  if (corner.x < w * 0.14 || corner.x > w * 0.86) {
    let best = null
    const src = clipped.length > 12 ? clipped : envelope || []
    for (let i = 0; i < src.length; i += 1) {
      const p = src[i]
      if (p.x < w * 0.18 || p.x > w * 0.82) continue
      if (!best || p.y < best.y) best = p
    }
    if (best) corner = best
  }

  const leftN = fond.inliers.filter((p) => p.x < corner.x).length
  const rightN = fond.inliers.filter((p) => p.x > corner.x).length
  const fondLeft = leftN >= rightN
  const dirXpix = fondLeft ? unit(-1, -fond.m) : unit(1, fond.m)

  let dirYpix
  if (side) {
    const along = unit(1, side.m)
    const vx = w * 0.5 - corner.x
    const vy = h * 0.92 - corner.y
    const sign = along[0] * vx + along[1] * vy >= 0 ? 1 : -1
    dirYpix = [along[0] * sign, along[1] * sign]
  } else {
    const inward = unit(fond.m, -1)
    const probeY = corner.y + inward[1] * 40
    dirYpix = probeY > corner.y ? inward : [-inward[0], -inward[1]]
  }

  const nX = Math.hypot(dirXpix[0], dirXpix[1]) || 1
  const nY = Math.hypot(dirYpix[0], dirYpix[1]) || 1
  return {
    cornerUv: [corner.x / w, corner.y / h],
    dirX: [dirXpix[0] / nX / w, dirXpix[1] / nX / h],
    dirY: [dirYpix[0] / nY / w, dirYpix[1] / nY / h],
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

export function solvePhotoCamera(axes, width, height) {
  if (!axes?.cornerUv || !axes.dirX || !axes.dirY) return null
  const w = Math.max(2, width)
  const h = Math.max(2, height)
  const corner = [axes.cornerUv[0] * w, axes.cornerUv[1] * h]
  const dirX = [axes.dirX[0] * w, axes.dirX[1] * h]
  const dirY = [axes.dirY[0] * w, axes.dirY[1] * h]
  const tX = Math.atan2(dirX[1], dirX[0])
  const tY = Math.atan2(dirY[1], dirY[0])

  let best = null
  const evaluate = (fov, pitch, yaw, H) => {
    const R = yawPitchToR(yaw, pitch)
    const dcam = pixelToDirCam(corner[0], corner[1], fov, w, h)
    const dworld = mulR(R, dcam)
    if (Math.abs(dworld[1]) < 1e-6) return
    const s = -H / dworld[1]
    if (s < 0.6 || s > 10) return
    const C = [-s * dworld[0], -s * dworld[1], -s * dworld[2]]
    if (C[2] > -0.08 || C[1] < 0.4 || C[1] > 2.8) return
    const p0 = projectPoint([0, 0, 0], C, R, fov, w, h)
    const pX = projectPoint([1, 0, 0], C, R, fov, w, h)
    const pY = projectPoint([0, 0, -1], C, R, fov, w, h)
    if (!p0 || !pX || !pY) return
    const aX = Math.atan2(pX[1] - p0[1], pX[0] - p0[0])
    const aY = Math.atan2(pY[1] - p0[1], pY[0] - p0[0])
    const err = angDiff(aX, tX) + angDiff(aY, tY)
    const dist = Math.hypot(C[0], C[2])
    const cost =
      err * 3 + 0.1 * Math.abs(dist - 2.6) + 0.008 * Math.abs(fov - 48)
    if (!best || cost < best.cost) {
      best = { cost, err, fov, pitch, yaw, C, R, dist, H }
    }
  }

  for (let hi = 0; hi < CAMERA_HEIGHTS_M.length; hi += 1) {
    const H = CAMERA_HEIGHTS_M[hi]
    for (let fov = 34; fov <= 60; fov += 5) {
      for (let pitch = -0.22; pitch <= 0.72; pitch += 0.06) {
        for (let yaw = -Math.PI; yaw < Math.PI; yaw += 0.14) {
          evaluate(fov, pitch, yaw, H)
        }
      }
    }
  }
  if (best) {
    const { fov: fov0, pitch: p0, yaw: y0, H } = best
    for (let fov = fov0 - 4; fov <= fov0 + 4; fov += 1.2) {
      for (let pitch = p0 - 0.07; pitch <= p0 + 0.07; pitch += 0.02) {
        for (let yaw = y0 - 0.12; yaw <= y0 + 0.12; yaw += 0.028) {
          evaluate(fov, pitch, yaw, H)
        }
      }
    }
  }
  if (!best || best.err > 0.6) return null

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
    heightM: best.H,
  }
}

export function debugPhotoSegments(data, w, h) {
  const g = toGray(data, w, h)
  const rot = chooseOrientation(g, w, h)
  const rotated = rotateRgba(data, w, h, rot)
  const mag = sobelMag(
    toGray(rotated.data, rotated.w, rotated.h),
    rotated.w,
    rotated.h,
  )
  const segs = detectSegments(mag, rotated.w, rotated.h)
  const g2 = toGray(rotated.data, rotated.w, rotated.h)
  const bands = plinthBands(g2, rotated.w, rotated.h)
  return {
    rotation: rot,
    width: rotated.w,
    height: rotated.h,
    bands: bands.map((y) => +(y / rotated.h).toFixed(3)),
    segs: segs.map((s) => ({
      dirDeg: +s.dirDeg.toFixed(1),
      length: +s.length.toFixed(1),
      mid: [+(s.midX / rotated.w).toFixed(2), +(s.midY / rotated.h).toFixed(2)],
      vert: isVerticalDir(s.dirDeg),
    })),
  }
}

export function analyzePhotoPixels(data, w, h) {
  const g = toGray(data, w, h)
  const rot = chooseOrientation(g, w, h)
  const rotated = rotateRgba(data, w, h, rot)
  const mag = sobelMag(
    toGray(rotated.data, rotated.w, rotated.h),
    rotated.w,
    rotated.h,
  )
  const segs = detectSegments(mag, rotated.w, rotated.h)
  const g2 = toGray(rotated.data, rotated.w, rotated.h)
  const bands = plinthBands(g2, rotated.w, rotated.h)
  const floor = floodFloorMask(rotated.data, rotated.w, rotated.h)
  const envelope = floorEnvelope(floor, rotated.w, rotated.h)
  const axes = axesFromGeometry(segs, rotated.w, rotated.h, bands, envelope)
  return { axes, rotation: rot, width: rotated.w, height: rotated.h }
}

export async function estimatePhotoRoom(dataUrl) {
  const img = await loadImageElement(dataUrl)
  const maxW = 640
  const scale = Math.min(1, maxW / Math.max(img.width, 1))
  const w0 = Math.max(32, Math.round(img.width * scale))
  const h0 = Math.max(32, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w0
  canvas.height = h0
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { axes: null, camera: { ...DEFAULT_PHOTO_CAMERA }, dataUrl }
  ctx.drawImage(img, 0, 0, w0, h0)
  const src = ctx.getImageData(0, 0, w0, h0)
  const g = toGray(src.data, w0, h0)
  const rot = chooseOrientation(g, w0, h0)
  const rotated = rotateRgba(src.data, w0, h0, rot)
  const mag = sobelMag(toGray(rotated.data, rotated.w, rotated.h), rotated.w, rotated.h)
  const segs = detectSegments(mag, rotated.w, rotated.h)
  const g2 = toGray(rotated.data, rotated.w, rotated.h)
  const bands = plinthBands(g2, rotated.w, rotated.h)
  const floor = floodFloorMask(rotated.data, rotated.w, rotated.h)
  const envelope = floorEnvelope(floor, rotated.w, rotated.h)
  const axes = axesFromGeometry(segs, rotated.w, rotated.h, bands, envelope)
  const camera = axes
    ? solvePhotoCamera(axes, rotated.w, rotated.h) || { ...DEFAULT_PHOTO_CAMERA }
    : { ...DEFAULT_PHOTO_CAMERA }

  let outUrl = dataUrl
  if (rot !== 0) {
    const full = document.createElement('canvas')
    const fw = rot === 90 || rot === 270 ? img.height : img.width
    const fh = rot === 90 || rot === 270 ? img.width : img.height
    full.width = fw
    full.height = fh
    const fctx = full.getContext('2d')
    fctx.translate(fw / 2, fh / 2)
    fctx.rotate((rot * Math.PI) / 180)
    fctx.drawImage(img, -img.width / 2, -img.height / 2)
    outUrl = full.toDataURL('image/jpeg', 0.92)
  }

  return { axes, camera, dataUrl: outUrl, rotation: rot }
}
