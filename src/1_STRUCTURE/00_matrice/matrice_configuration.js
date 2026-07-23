/**
 * Matrice configuration — une colonne par paramètre, une ligne par config.
 * Sert de schéma + helpers pour unités / modules / devis.
 */

/** Modules d’agencement interne (la porte façade = panneau "porte" dans PANNEAU_DEFS). */
export const MODULE_KINDS = {
  shelf: { id: 'shelf', label: 'Tablette', icon: '▭' },
  drawer: { id: 'drawer', label: 'Tiroir', icon: '▤' },
}

export const ENVIRONMENTS = {
  none: { id: 'none', label: 'Aucun', bg: '#0a0a0a', grid: true },
  chambre: {
    id: 'chambre',
    label: 'Chambre',
    bg: '#a8b5a8',
    room: true,
    walls: '#e8e0d5',
    floor: '#d4c4a8',
  },
  salon: {
    id: 'salon',
    label: 'Salon',
    bg: '#9aa8b0',
    room: true,
    walls: '#f0ebe3',
    floor: '#c8b89a',
  },
  atelier: {
    id: 'atelier',
    label: 'Atelier',
    bg: '#2a2a2a',
    grid: true,
    room: false,
  },
}

let _seq = 0
export function uid(prefix = 'id') {
  _seq += 1
  return `${prefix}-${Date.now().toString(36)}-${_seq}`
}

export function makeQuoteRef() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `PHL-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

export function defaultUnit(overrides = {}) {
  return {
    id: uid('meuble'),
    label: 'Meuble 1',
    dims: { L: 600, W: 400, H: 900 },
    positionMm: { x: 0, y: 0, z: 0 },
    rotationZ: 0,
    /**
     * Essence atelier (bois local) — non exposée au client.
     * Teinte de base pour le rendu 3D uniquement.
     */
    woodFinish: 'chene',
    /** Traitement de surface ossature client : brut | vernis_clair | vernis_fonce | huile */
    ossatureFinish: 'brut',
    /** Texte libre finition ossature → export matrice */
    ossatureFinitionNote: '',
    /**
     * Couleur panneau unique pour toute la config :
     * terracotta | olive | bleu_poudre | gris_cendre | jaune_orange
     */
    panneauCouleur: 'gris_cendre',
    modules: [],
    // Aucun panneau au départ — l’utilisateur active ce qu’il veut
    panneaux: [],
    ...overrides,
  }
}

export function defaultContact() {
  return {
    clientId: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    postalCode: '',
    city: '',
    country: 'FR',
  }
}

/** Ligne de configuration (schéma matrice). */
export function configRow(unit) {
  return {
    id: unit.id,
    label: unit.label,
    L: unit.dims.L,
    W: unit.dims.W,
    H: unit.dims.H,
    x: unit.positionMm.x,
    y: unit.positionMm.y,
    z: unit.positionMm.z,
    rotZ: unit.rotationZ,
    finish: unit.woodFinish,
    moduleCount: unit.modules?.length ?? 0,
    panneaux: (unit.panneaux || []).join(','),
  }
}

export default {
  MODULE_KINDS,
  ENVIRONMENTS,
  uid,
  makeQuoteRef,
  defaultUnit,
  defaultContact,
  configRow,
}
