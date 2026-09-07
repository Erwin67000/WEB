import * as THREE from 'three'

/** Taille réelle du carreau Poliigon (mm) — 1 m. */
export const WOOD_TILE_MM = 1000

function furnitureBBox(positionsMm) {
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  const n = positionsMm.length / 3
  for (let i = 0; i < n; i++) {
    const x = positionsMm[i * 3]
    const y = positionsMm[i * 3 + 1]
    const z = positionsMm[i * 3 + 2]
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (z < minZ) minZ = z
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
    if (z > maxZ) maxZ = z
  }
  return { minX, minY, minZ, maxX, maxY, maxZ }
}

/** Axe le plus long du solide (famille d’arête X / Y / Z). */
export function inferFurnitureAxis(positionsMm) {
  const { minX, minY, minZ, maxX, maxY, maxZ } = furnitureBBox(positionsMm)
  const dx = maxX - minX
  const dy = maxY - minY
  const dz = maxZ - minZ
  if (dx >= dy && dx >= dz) return 'X'
  if (dy >= dx && dy >= dz) return 'Y'
  return 'Z'
}

/**
 * UV box-projectés depuis des positions meuble (mm, SketchUp XYZ).
 * Le veinage suit l’axe long : Z est la référence ; X et Y sont tournés de 90°.
 */
export function boxUvsFromFurnitureMm(
  positionsMm,
  indices,
  tileMm = WOOD_TILE_MM,
  axis,
) {
  const tmp = new THREE.BufferGeometry()
  tmp.setAttribute(
    'position',
    new THREE.BufferAttribute(Float32Array.from(positionsMm), 3),
  )
  tmp.setIndex(
    new THREE.BufferAttribute(Uint32Array.from(indices), 1),
  )
  tmp.computeVertexNormals()
  const nrm = tmp.getAttribute('normal')
  const n = positionsMm.length / 3
  const { minX, minY, minZ } = furnitureBBox(positionsMm)
  const uv = new Float32Array(n * 2)
  const inv = 1 / tileMm
  for (let i = 0; i < n; i++) {
    const x = positionsMm[i * 3] - minX
    const y = positionsMm[i * 3 + 1] - minY
    const z = positionsMm[i * 3 + 2] - minZ
    const nx = Math.abs(nrm.getX(i))
    const ny = Math.abs(nrm.getY(i))
    const nz = Math.abs(nrm.getZ(i))
    if (nx >= ny && nx >= nz) {
      uv[i * 2] = y * inv
      uv[i * 2 + 1] = z * inv
    } else if (ny >= nx && ny >= nz) {
      uv[i * 2] = x * inv
      uv[i * 2 + 1] = z * inv
    } else {
      uv[i * 2] = x * inv
      uv[i * 2 + 1] = y * inv
    }
  }
  tmp.dispose()
  const family = String(axis || inferFurnitureAxis(positionsMm)).toUpperCase()
  if (family === 'X' || family === 'Y') {
    for (let i = 0; i < n; i++) {
      const u = uv[i * 2]
      uv[i * 2] = uv[i * 2 + 1]
      uv[i * 2 + 1] = u
    }
  }
  return uv
}

export function applyBoxUvs(geometry, positionsMm, indices, tileMm, axis) {
  const uv = boxUvsFromFurnitureMm(positionsMm, indices, tileMm, axis)
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}
