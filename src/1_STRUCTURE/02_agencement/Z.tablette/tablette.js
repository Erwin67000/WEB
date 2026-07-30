/**
 * Module tablette — façade géométrie.
 * Implémentation source : matrice_configuration.js
 *   - octogone 8 pts (arêtes Z) extrudé EPAISSEUR_PANNEAU
 *   - 2 traverses (buildTraverse)
 */
export {
  TABLETTE_OCTOGONE_REFS,
  ligne_tablette,
  face_tablette,
  resolveTabletteOctogone,
  extrudePolygonZ,
  buildTablettePlateBuffers,
  buildTablette,
  buildTabletteTraverses,
  TRAVERSE_EXTRUSION_MM,
  TRAVERSE_OFFSET_X_MM,
  TRAVERSE_PROFILE_6,
  TRAVERSE_PROFILE_6_BACK,
  resolveTraverseRef2D,
  resolveTraverseProfile2D,
  ligne_traverse,
  face_traverse,
  buildTraverse,
} from '../../00_matrice/matrice_configuration.js'
