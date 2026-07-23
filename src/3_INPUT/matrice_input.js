/** Entrées utilisateur / defaults du configurateur. */
export const DEFAULT_DIMS = { L: 600, W: 400, H: 900 }
export const DIM_LIMITS = {
  L: { min: 200, max: 2000, step: 5 },
  W: { min: 200, max: 800, step: 5 },
  H: { min: 300, max: 2000, step: 5 },
}

/** Épaisseurs proposées (mm) — aussi dans master_input.js */
export const EPAISSEURS_PANNEAU = [12, 14, 16]
export const EPAISSEURS_PORTE = [12, 14, 16]
