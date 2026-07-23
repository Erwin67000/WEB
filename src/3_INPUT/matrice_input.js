/** Entrées utilisateur / defaults du configurateur. */
import {
  LONGUEUR_MIN,
  LONGUEUR_MAX,
  LARGEUR_MIN,
  LARGEUR_MAX,
  HAUTEUR_MIN,
  HAUTEUR_MAX,
} from '../1_STRUCTURE/00_matrice/matrice_constante.js'

export const DEFAULT_DIMS = { L: 600, W: 400, H: 900 }

/**
 * Limites UI / formules pour L (longueur X), W (largeur/profondeur Y), H (hauteur Z).
 * Source unique : matrice_constante.js
 */
export const DIM_LIMITS = {
  L: { min: LONGUEUR_MIN, max: LONGUEUR_MAX, step: 5 },
  W: { min: LARGEUR_MIN, max: LARGEUR_MAX, step: 5 },
  H: { min: HAUTEUR_MIN, max: HAUTEUR_MAX, step: 5 },
}

/** Borne une dimension L|W|H aux min/max catalogue. */
export function clampDim(axis, value) {
  const lim = DIM_LIMITS[axis]
  const n = Number(value)
  if (!lim || !Number.isFinite(n)) return lim?.min ?? 0
  return Math.min(lim.max, Math.max(lim.min, n))
}

/** Borne un objet dims partiel ou complet. */
export function clampDims(dims = {}) {
  const out = { ...dims }
  if (out.L != null) out.L = clampDim('L', out.L)
  if (out.W != null) out.W = clampDim('W', out.W)
  if (out.H != null) out.H = clampDim('H', out.H)
  return out
}

/** Épaisseurs proposées (mm) — aussi dans master_input.js */
export const EPAISSEURS_PANNEAU = [12, 14, 16]
export const EPAISSEURS_PORTE = [12, 14, 16]
