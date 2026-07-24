/**
 * Matrice configuration — une colonne par paramètre, une ligne par config.
 * Sert de schéma + helpers pour unités / modules / devis.
 */
import { clampDims } from '../../3_INPUT/matrice_input.js'

/** Modules d’agencement interne (la porte façade = panneau "porte" dans PANNEAU_DEFS). */
export const MODULE_KINDS = {
  shelf: { id: 'shelf', label: 'Tablette', icon: '▭' },
  drawer: { id: 'drawer', label: 'Tiroir', icon: '▤' },
}

/**
 * Scènes 3D — départ : aucune.
 * chambre : GLB dans public/environnement/chambre/chambre.glb
 * (source atelier : 1_STRUCTURE/03_bibliotheque/environnement/chambre/)
 */
export const ENVIRONMENTS = {
  none: {
    id: 'none',
    label: 'Aucune scène',
    bg: '#0a0a0a',
    grid: true,
    room: false,
    glb: null,
  },
  chambre: {
    id: 'chambre',
    label: 'Chambre',
    bg: '#1a1814',
    grid: false,
    room: false,
    glb: '/environnement/chambre/chambre.glb',
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
  const unit = {
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
    /** Hex libre si panneauCouleur === 'surmesure' */
    panneauCouleurHex: '#c9a227',
    modules: [],
    // Aucun panneau au départ — l’utilisateur active ce qu’il veut
    panneaux: [],
    ...overrides,
  }
  if (unit.dims) unit.dims = clampDims({ L: 600, W: 400, H: 900, ...unit.dims })
  return unit
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
