/**
 * Module tablette — façade géométrie.
 * Source : matrice_configuration.js
 *
 * - Octogone 8 pts (arêtes Z), Z = **haut** du plateau, extrusion −Z
 * - Traverses : plan = haut plateau, extrusion +Z
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
  TRAVERSE_PROFILE_6,
  TRAVERSE_PROFILE_6_BACK,
  resolveTraverseRef2D,
  resolveTraverseProfile2D,
  ligne_traverse,
  face_traverse,
  buildTraverse,
} from '../../00_matrice/matrice_configuration.js'
