/** Scale SketchUp mm → Three.js metres. */
export const FURNITURE_SCALE = 0.001

/** Centre géométrique (L/2, H/2, −P/2) dans le repère Three. */
export function furnitureCenterThree(dims = {}) {
  const L = Number(dims.L) || 0
  const W = Number(dims.W ?? dims.P) || 0
  const H = Number(dims.H) || 0
  return [(L * FURNITURE_SCALE) / 2, (H * FURNITURE_SCALE) / 2, -(W * FURNITURE_SCALE) / 2]
}

export function furnitureCameraPos(dims = {}) {
  const [tx, ty, tz] = furnitureCenterThree(dims)
  const L = Number(dims.L) || 0
  const W = Number(dims.W ?? dims.P) || 0
  const H = Number(dims.H) || 0
  const halfDiag = Math.sqrt(L * L + W * W + H * H) * FURNITURE_SCALE * 0.5
  const d = Math.max(0.95, halfDiag * 2.55)
  return [tx - d * 0.82, ty + d * 0.52, tz - d * 0.95]
}

export function furnitureMaxDim(dims = {}) {
  const L = Number(dims.L) || 0
  const W = Number(dims.W ?? dims.P) || 0
  const H = Number(dims.H) || 0
  return Math.max(L, W, H) * FURNITURE_SCALE
}
