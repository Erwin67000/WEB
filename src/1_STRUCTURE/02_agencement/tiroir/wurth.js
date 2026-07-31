/**
 * Référentiel tiroirs sur mesure Würth ASTUCIO — type B (bois)
 * Rails DYNAMOOV : décroché 11 mm sous le tiroir.
 *
 * Guide : eshop.wurth.fr — configurateur-de-tiroirs-sur-mesure (ASTUCIO)
 *
 * - Hauteur : choix client parmi la liste Würth
 * - Profondeur : auto = plus grande profondeur Würth ≤ max ossature
 * - LIC : auto = largeur utile ossature entre faces int. des traverses
 */

import { TRAVERSE_EXTRUSION_MM } from '../traverse.js'

/** Type construction Würth : B = décroché bas pour rails dynamiques. */
export const WURTH_DRAWER_TYPE = 'B'

/**
 * Hauteurs externes disponibles (mm) — menu Würth.
 */
export const WURTH_HAUTEURS_MM = [
  58, 84, 110, 136, 162, 188, 214, 240, 266,
]

/** Hauteur par défaut à l’ajout d’un tiroir. */
export const WURTH_HAUTEUR_DEFAUT_MM = 110

/**
 * Décroché bas type B (mm) — passage des rails DYNAMOOV sous le fond.
 */
export const WURTH_DECROCHE_DYNAMOOV_MM = 11

/**
 * Profondeurs catalogue Würth (mm) — arrondi **vers le bas** auto.
 * Minimum installable = 250 mm.
 */
export const WURTH_PROFONDEURS_MM = [
  250, 270, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800,
]

/** Profondeur mini pour autoriser un tiroir (mm). */
export const WURTH_PROFONDEUR_MIN_MM = 250

export const DRAWER_DEPTH_TOO_SMALL_MSG =
  'Profondeur inférieure à la limite pour ajout de tiroir : 250 mm'

export const DRAWER_CLEARANCE_Y_MM = 4
export const DRAWER_CLEARANCE_X_MM = 4

/**
 * Plus grande valeur de la grille ≤ maxAvailable.
 */
export function snapDownToGrid(maxAvailable, grid = WURTH_PROFONDEURS_MM) {
  const sorted = [...grid].sort((a, b) => a - b)
  let best = null
  for (const v of sorted) {
    if (v <= maxAvailable) best = v
  }
  return best ?? Math.max(0, Math.floor(maxAvailable))
}

/**
 * Hauteur Würth valide (exacte ou plus proche dans la liste, ≤ maxAvailable).
 */
export function clampWurthHeight(hMm, maxAvailable = Infinity) {
  const list = WURTH_HAUTEURS_MM.filter((v) => v <= maxAvailable)
  const usable = list.length ? list : [WURTH_HAUTEURS_MM[0]]
  const n = Number(hMm)
  if (!Number.isFinite(n)) return WURTH_HAUTEUR_DEFAUT_MM
  if (usable.includes(n)) return n
  let best = usable[0]
  let bestD = Math.abs(best - n)
  for (const v of usable) {
    const d = Math.abs(v - n)
    if (d < bestD) {
      best = v
      bestD = d
    }
  }
  return best
}

/**
 * Dimensions tiroir Würth type B dérivées de l’ossature + bornes traverses.
 *
 * @param {{ L: number, W: number, H: number }} dims
 * @param {object} mod — { hMm? }
 * @param {{ minX: number, maxX: number, minY: number, maxY: number }} traverseBounds
 */
export function computeWurthDrawerDims(dims, mod, traverseBounds) {
  const maxH = Math.max(
    WURTH_HAUTEURS_MM[0],
    (dims.H || 0) - 40 - TRAVERSE_EXTRUSION_MM,
  )
  const hMm = clampWurthHeight(mod?.hMm ?? WURTH_HAUTEUR_DEFAUT_MM, maxH)

  const licRaw =
    (traverseBounds?.maxX ?? dims.L - 40) -
    (traverseBounds?.minX ?? 40) -
    2 * DRAWER_CLEARANCE_X_MM
  const licMm = Math.max(80, Math.round(licRaw))

  const depthAvail =
    (traverseBounds?.maxY ?? dims.W - 20) -
    (traverseBounds?.minY ?? 20) -
    2 * DRAWER_CLEARANCE_Y_MM
  const depthAvailableMm = Math.round(Math.max(0, depthAvail))
  const depthTooSmall = depthAvailableMm < WURTH_PROFONDEUR_MIN_MM
  const depthMm = depthTooSmall
    ? 0
    : snapDownToGrid(depthAvail)

  return {
    type: WURTH_DRAWER_TYPE,
    hMm,
    /** LIC = largeur caisson (axe X) */
    licMm,
    /** Profondeur auto (axe Y) — 0 si < 250 mm */
    depthMm,
    depthAvailableMm,
    depthTooSmall,
    depthWarn: depthTooSmall ? DRAWER_DEPTH_TOO_SMALL_MSG : null,
    decrocheMm: WURTH_DECROCHE_DYNAMOOV_MM,
    overallHeightMm: hMm + WURTH_DECROCHE_DYNAMOOV_MM,
    label: depthTooSmall
      ? DRAWER_DEPTH_TOO_SMALL_MSG
      : `Würth type ${WURTH_DRAWER_TYPE} · H ${hMm} · P ${depthMm} · LIC ${licMm}`,
  }
}
