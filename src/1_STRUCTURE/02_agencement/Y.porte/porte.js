/**
 * Porte façade (panneau Y) — même pipeline que les 6 panneaux du meuble.
 *
 * Params optionnels pour une façade tiroir :
 *   zMin / zMax  — recale le rectangle de base sur la hauteur du tiroir
 *   epaisseur    — défaut = épaisseur panneau
 */
import { EPAISSEUR_PANNEAU } from '../../00_matrice/matrice_constante.js'
import { buildGeometrie } from '../../00_matrice/matrice_geometrie.js'
import {
  PANNEAU_DEFS,
  Panneau,
  computeQuatreRectangles,
} from '../../00_matrice/matrice_panneau.js'

export function buildPorte(dims, params = {}) {
  const def = PANNEAU_DEFS.porte
  if (!def) throw new Error('buildPorte : PANNEAU_DEFS.porte absent')
  const { byId } = buildGeometrie(dims)
  const { tolerance, arriere, params: resolved } = computeQuatreRectangles(
    def,
    byId,
    {
      epaisseur: params.epaisseur ?? EPAISSEUR_PANNEAU,
      zMin: params.zMin,
      zMax: params.zMax,
    },
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
  }
}
