import { PANNEAU_COULEURS } from '../1_STRUCTURE/00_matrice/matrice_constante.js'

export const SHOP_COLOR_KEY = 'philae-shop-panel-color'

export function readShopPanelColor() {
  try {
    const v = localStorage.getItem(SHOP_COLOR_KEY)
    if (v && PANNEAU_COULEURS[v] && v !== 'surmesure') return v
  } catch {
    /* ignore */
  }
  return null
}

export function writeShopPanelColor(id) {
  try {
    if (id && PANNEAU_COULEURS[id] && id !== 'surmesure') {
      localStorage.setItem(SHOP_COLOR_KEY, id)
    } else {
      localStorage.removeItem(SHOP_COLOR_KEY)
    }
  } catch {
    /* ignore */
  }
}
