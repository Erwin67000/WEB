/**
 * Matrice configuration — schéma meuble, modules, scènes, contact.
 *
 * Géométrie tablette / traverse / tiroir → 02_agencement/
 *   traverse.js · Z.tablette/tablette.js · tiroir/tiroir.js
 * (ré-exportés ici pour rétrocompat des imports existants)
 */
import { clampDims } from '../../3_INPUT/matrice_input.js'

/** Modules d’agencement interne (la porte façade = panneau "porte"). */
export const MODULE_KINDS = {
  drawer: { id: 'drawer', label: 'Tiroir', icon: '▤' },
  shelf: { id: 'shelf', label: 'Tablette', icon: '▭' },
}

/**
 * Scènes 3D.
 * Convention SketchUp : origine = meuble 1, +X mur, +Y profondeur, +Z haut.
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
    position: [0, 0, 0],
    rotation: [0, Math.PI / 2, 0],
    scale: 1,
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
    woodFinish: 'chene',
    ossatureFinish: 'brut',
    ossatureFinitionNote: '',
    panneauCouleur: 'gris_cendre',
    panneauCouleurHex: '#c9a227',
    modules: [],
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

// Rétrocompat — géométrie déplacée dans 02_agencement
export {
  buildTablette,
  buildTablettePlateBuffers,
  TABLETTE_OCTOGONE_REFS,
  ligne_tablette,
  face_tablette,
  resolveTabletteOctogone,
  extrudePolygonZ,
  TRAVERSE_EXTRUSION_MM,
  TRAVERSE_PROFILE_6,
  TRAVERSE_PROFILE_6_BACK,
  TRAVERSE_PROFILE_LEFT,
  TRAVERSE_PROFILE_RIGHT,
  buildTraverse,
  buildTraversePair,
  buildTabletteTraverses,
  resolveTraverseRef2D,
  resolveTraverseProfile2D,
  ligne_traverse,
  face_traverse,
} from '../02_agencement/Z.tablette/tablette.js'

export default {
  MODULE_KINDS,
  ENVIRONMENTS,
  uid,
  makeQuoteRef,
  defaultUnit,
  defaultContact,
  configRow,
}
