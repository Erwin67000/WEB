/**
 * Utilitaires filaires d’arêtes / panneaux.
 * Les lignes coïncident souvent avec les faces → z-fighting selon l’angle caméra.
 * On dilate les points du wire depuis le centroïde pour les sortir légèrement du solide.
 */

/**
 * @param {Float32Array|number[]} wire — positions xyz (ou paires de segments)
 * @param {number} inflateMm — décalage radial en mm (défaut 0.9)
 * @returns {Float32Array}
 */
export function inflateWireMm(wire, inflateMm = 0.9) {
  const src = wire instanceof Float32Array ? wire : Float32Array.from(wire)
  const n = Math.floor(src.length / 3)
  if (n < 2) return src

  let cx = 0
  let cy = 0
  let cz = 0
  for (let i = 0; i < n; i++) {
    cx += src[i * 3]
    cy += src[i * 3 + 1]
    cz += src[i * 3 + 2]
  }
  cx /= n
  cy /= n
  cz /= n

  let avgR = 0
  for (let i = 0; i < n; i++) {
    const dx = src[i * 3] - cx
    const dy = src[i * 3 + 1] - cy
    const dz = src[i * 3 + 2] - cz
    avgR += Math.sqrt(dx * dx + dy * dy + dz * dz)
  }
  avgR /= n
  if (avgR < 1e-6) return src.slice()

  const scale = (avgR + inflateMm) / avgR
  const out = new Float32Array(src.length)
  for (let i = 0; i < n; i++) {
    out[i * 3] = cx + (src[i * 3] - cx) * scale
    out[i * 3 + 1] = cy + (src[i * 3 + 1] - cy) * scale
    out[i * 3 + 2] = cz + (src[i * 3 + 2] - cz) * scale
  }
  return out
}
