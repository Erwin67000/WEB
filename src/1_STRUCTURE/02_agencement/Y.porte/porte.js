/**
 * Porte façade (panneau Y) — même pipeline que les 6 panneaux du meuble.
 *
 * Params optionnels pour une façade tiroir :
 *   zMin / zMax  — recale le rectangle de base sur la hauteur du tiroir
 *                  (un seul des deux suffit : l’autre garde le Z porte)
 *   epaisseur    — défaut = épaisseur panneau
 */
import { EPAISSEUR_PANNEAU } from '../../00_matrice/matrice_constante.js'
import { buildGeometrie } from '../../00_matrice/matrice_geometrie.js'
import {
  PANNEAU_DEFS,
  Panneau,
  computeQuatreRectangles,
  RECTANGLE_3BISEAUX,
  RECTANGLE_2BISEAUX,
} from '../../00_matrice/matrice_panneau.js'

export function computePorteRectangles(dims, params = {}) {
  const def = PANNEAU_DEFS.porte
  if (!def) throw new Error('buildPorte : PANNEAU_DEFS.porte absent')
  const { byId } = buildGeometrie(dims)
  return computeQuatreRectangles(def, byId, {
    epaisseur: params.epaisseur ?? EPAISSEUR_PANNEAU,
    zMin: params.zMin,
    zMax: params.zMax,
    type: params.type,
    coteDroit: params.coteDroit,
  })
}

/** Y de la face intérieure (rectangle arrière) de la porte. */
export function resolvePorteArriereY(dims, params = {}) {
  const { arriere } = computePorteRectangles(dims, params)
  return arriere[0][1]
}

export function buildPorte(dims, params = {}) {
  const def = PANNEAU_DEFS.porte
  const { tolerance, arriere, params: resolved } = computePorteRectangles(
    dims,
    params,
  )
  const nom = params.id || 'porte'
  const panneau = new Panneau(nom, [...tolerance, ...arriere], {
    normal: def.normal,
    direction: def.direction,
    texture: def.texture,
    epaisseur: resolved.epaisseur,
  })
  return {
    id: nom,
    nom,
    panneau,
    positions: panneau.positions,
    indices: panneau.indices,
    wire: panneau.wire,
    points: panneau.points,
    params: resolved,
    yArriere: arriere[0][1],
  }
}

/**
 * Façade du **1er tiroir calé tout en bas**.
 * rectangle-3biseaux : biseau 45° bas / gauche / droite, tranche haute plate (plan Z).
 */
export function buildFacadeTiroirBas(dims, { zMax, epaisseur } = {}) {
  return buildPorte(dims, {
    id: 'facade',
    zMax,
    epaisseur: epaisseur ?? EPAISSEUR_PANNEAU,
    type: RECTANGLE_3BISEAUX,
    coteDroit: 'zMax',
  })
}

/**
 * Façade de tous les **autres cas** (2e tiroir, 1er relevé, …).
 * rectangle-2biseaux : biseau 45° gauche / droite, tranches haut et bas plates (plan Z).
 */
export function buildFacadeTiroir(dims, { zMin, zMax, epaisseur } = {}) {
  return buildPorte(dims, {
    id: 'facade',
    zMin,
    zMax,
    epaisseur: epaisseur ?? EPAISSEUR_PANNEAU,
    type: RECTANGLE_2BISEAUX,
  })
}
