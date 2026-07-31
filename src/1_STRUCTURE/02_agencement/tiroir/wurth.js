/**
 * Référentiel tiroirs sur mesure Würth ASTUCIO — type B (bois)
 * Coulisses Dynamoov (basse, sortie totale) — plan technique :
 *   LWS = (LWK − 42) ⁺⁰/₋₁,₅   ·  min LWS = 138
 *   Jeu latéral rail ≈ 21 mm / côté
 *   Décroché bas type B ≈ 11 mm (passage rail sous le fond)
 *   Hauteur corps de rail ≈ 10–13 mm (max 13)
 *
 * Guide coulisse :
 *   eshop.wurth.fr … Coulisse Dynamoov Tipmatic sortie totale
 */

import { TRAVERSE_EXTRUSION_MM } from '../traverse.js'

/** Type construction Würth : B = décroché bas pour rails dynamiques. */
export const WURTH_DRAWER_TYPE = 'B'

/** Hauteurs externes tiroir (mm) — menu Würth ASTUCIO. */
export const WURTH_HAUTEURS_MM = [
  58, 84, 110, 136, 162, 188, 214, 240, 266,
]

export const WURTH_HAUTEUR_DEFAUT_MM = 110

/**
 * Décroché bas type B (mm) — fond surélevé pour loger la coulisse sous le tiroir.
 * (valeur atelier Philae / type B ASTUCIO)
 */
export const WURTH_DECROCHE_DYNAMOOV_MM = 11

/**
 * Plan Dynamoov (coupe frontale) :
 *   LWK = largeur intérieure caisson (entre faces int. des traverses Y)
 *   LWS = largeur tiroir = LWK − 42
 *   21 mm / côté = emprise coulisse entre paroi et flanc du tiroir
 */
export const DYNAMOOV_LWK_MINUS_LWS_MM = 42
export const DYNAMOOV_SIDE_RAIL_SPACE_MM = 21 // 42 / 2
/** Hauteur corps de coulisse (mm) — plan : min 10, max 13. */
export const DYNAMOOV_RAIL_BODY_H_MM = 13
export const DYNAMOOV_LWS_MIN_MM = 138

/**
 * Profondeurs catalogue Würth (mm) — arrondi **vers le bas** auto.
 * Minimum installable = 250 mm.
 */
export const WURTH_PROFONDEURS_MM = [
  250, 270, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800,
]

export const WURTH_PROFONDEUR_MIN_MM = 250

export const DRAWER_DEPTH_TOO_SMALL_MSG =
  'Profondeur inférieure à la limite pour ajout de tiroir : 250 mm'

/** Jeu Y (façade / fond) en plus de la grille profondeur. */
export const DRAWER_CLEARANCE_Y_MM = 4

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
 * Dimensions tiroir Würth type B + Dynamoov.
 *
 * @param {{ L: number, W: number, H: number }} dims
 * @param {object} mod — { hMm? }
 * @param {{ minX: number, maxX: number, minY: number, maxY: number }} traverseBounds
 *   faces intérieures des traverses Y (LWK en X, profondeur max en Y)
 */
export function computeWurthDrawerDims(dims, mod, traverseBounds) {
  const maxH = Math.max(
    WURTH_HAUTEURS_MM[0],
    (dims.H || 0) - 40 - TRAVERSE_EXTRUSION_MM - DYNAMOOV_RAIL_BODY_H_MM,
  )
  const hMm = clampWurthHeight(mod?.hMm ?? WURTH_HAUTEUR_DEFAUT_MM, maxH)

  // LWK = largeur intérieure entre traverses (faces int.)
  const LWK = Math.max(
    0,
    (traverseBounds?.maxX ?? dims.L - 40) -
      (traverseBounds?.minX ?? 40),
  )
  // LWS = (LWK − 42)  — plan Dynamoov
  const licRaw = LWK - DYNAMOOV_LWK_MINUS_LWS_MM
  const licMm = Math.max(DYNAMOOV_LWS_MIN_MM, Math.round(licRaw))

  const depthAvail =
    (traverseBounds?.maxY ?? dims.W - 20) -
    (traverseBounds?.minY ?? 20) -
    2 * DRAWER_CLEARANCE_Y_MM
  const depthAvailableMm = Math.round(Math.max(0, depthAvail))
  const depthTooSmall = depthAvailableMm < WURTH_PROFONDEUR_MIN_MM
  const depthMm = depthTooSmall ? 0 : snapDownToGrid(depthAvail)

  return {
    type: WURTH_DRAWER_TYPE,
    hMm,
    /** LWK caisson (entre traverses) */
    lwkMm: Math.round(LWK),
    /** LWS / LIC tiroir = LWK − 42 */
    licMm,
    depthMm,
    depthAvailableMm,
    depthTooSmall,
    depthWarn: depthTooSmall ? DRAWER_DEPTH_TOO_SMALL_MSG : null,
    /** Décroché bas type B (fond surélevé) */
    decrocheMm: WURTH_DECROCHE_DYNAMOOV_MM,
    /** Emprise latérale rail par côté (mm) */
    railSideSpaceMm: DYNAMOOV_SIDE_RAIL_SPACE_MM,
    /** Hauteur corps rail (mm) — sur le dessus de traverse */
    railBodyHMm: DYNAMOOV_RAIL_BODY_H_MM,
    overallHeightMm: hMm, // H Würth = hors-tout flancs (décroché inclus dans H)
    label: depthTooSmall
      ? DRAWER_DEPTH_TOO_SMALL_MSG
      : `Würth B · H ${hMm} · P ${depthMm} · LWS ${licMm} (LWK ${Math.round(LWK)})`,
  }
}
