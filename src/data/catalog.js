/**
 * Pont boutique → matrice_catalogue
 *
 * La source de vérité n’est plus un tableau JS hardcodé :
 *   01_structure/08_bibliotheque/models/boutique/matrice_catalogue.csv
 *
 * API async : loadCatalog() / getCatalogItem(id)
 */

export {
  formatTag,
  loadMatriceCatalogue as loadCatalog,
  getCatalogueItem as getCatalogItemAsync,
  parseModulesSpec,
  parsePanneauxSpec,
  parseMatriceCatalogue,
  MATRICE_CATALOGUE_URL,
  CATALOGUE_COLUMNS,
} from '../1_STRUCTURE/00_matrice/matrice_catalogue.js'

import {
  getCatalogueItem,
  loadMatriceCatalogue,
} from '../1_STRUCTURE/00_matrice/matrice_catalogue.js'

/** @deprecated Préférer loadCatalog() — conservé pour imports synchrones impossibles. */
export const CATALOG = []

export async function getCatalogItem(id) {
  return getCatalogueItem(id)
}

export async function loadBoutiqueRows() {
  return loadMatriceCatalogue()
}
