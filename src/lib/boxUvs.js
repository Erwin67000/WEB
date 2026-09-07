import * as THREE from 'three'

/** Taille réelle du carreau Poliigon (mm) — 1 m. */
export const WOOD_TILE_MM = 1000

/**
 * UV box-projectés depuis des positions meuble (mm, SketchUp XYZ).
 * À coller sur une géométrie Three de même nombre de sommets.
 */
export function boxUvsFromFurnitureMm(
  positionsMm,
  indices,
  tileMm = WOOD_TILE_MM,
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
  const uv = new Float32Array(n * 2)
  const inv = 1 / tileMm
  for (let i = 0; i < n; i++) {
    const x = positionsMm[i * 3]
    const y = positionsMm[i * 3 + 1]
    const z = positionsMm[i * 3 + 2]
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
  return uv
}

export function applyBoxUvs(geometry, positionsMm, indices, tileMm) {
  const uv = boxUvsFromFurnitureMm(positionsMm, indices, tileMm)
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}
