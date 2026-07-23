/**
 * Session temporaire pour configurer un produit boutique.
 * Réinitialisée à la base catalogue à chaque ouverture.
 * N’affecte le main qu’après « Sauvegarder vers le configurateur ».
 */
import { createConfigStore } from './createConfigStore.js'

export const useBoutiqueSessionStore = createConfigStore({
  name: 'boutique-session',
})
