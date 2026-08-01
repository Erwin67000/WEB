/**
 * Pont boutique → modele_boutique
 *
 * Source de vérité (atelier) :
 *   src/1_STRUCTURE/03_bibliotheque/modele_boutique.csv
 * Servi après `npm run sync:catalogue` :
 *   public/catalogue/modele_boutique.csv → /catalogue/modele_boutique.csv
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
  parseMatriceCatalogueWorkbook,
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
