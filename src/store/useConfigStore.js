/**
 * Store principal (main configurateur).
 * Une seule version active — persiste tant que l’app est ouverte.
 * Ne pas écraser depuis la boutique sans action « Sauvegarder ».
 */
import { createConfigStore } from './createConfigStore.js'

export const useConfigStore = createConfigStore({ name: 'main' })
