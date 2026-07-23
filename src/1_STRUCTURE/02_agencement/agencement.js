/**
 * Agencement Philae
 * — construit les solides 3D (panneaux, modules) à partir des matrices
 * — le fond est build ici, puis rendu par ModuleMesh
 */
import {
  EPAISSEUR_PANNEAU,
  EPAISSEUR_PORTE,
  TOLERANCE,
  DECALAGE_PANNEAU,
  PRIX,
} from '../00_matrice/matrice_constante.js'
import { uid } from '../00_matrice/matrice_configuration.js'
import { buildGeometrie } from '../00_matrice/matrice_geometrie.js'
import {
  PANNEAU_DEFS,
  Panneau,
  face_panneau,
  ligne_panneau,
  ligne_rectangle,
  computeQuatreRectangles,
} from '../00_matrice/matrice_panneau_grok.js'

/**
 * Rectangle3D : 4 coins 3D pour debug (base / décalé / tolérance / arrière).
 * Propriétés lues par ModuleMesh : color, wire, positions, indices.
 */
export class Rectangle3D {
  /**
   * @param {string} nom
   * @param {number[][]} points — 4 × [x,y,z] mm
   * @param {string} color — hex (#RRGGBB)
   */
  constructor(nom, points, color = '#ffffff') {
    if (!points || points.length !== 4) {
      throw new Error(
        `Rectangle3D "${nom}" : 4 points requis, reçu ${points?.length}`,
      )
    }
    this.nom = nom
    this.id = nom
    this.points = points.map((p) => [p[0], p[1], p[2]])
    this.color = color
    this.couleur = color
  }

  get positions() {
    const out = new Float32Array(12)
    for (let i = 0; i < 4; i++) {
      out[i * 3] = this.points[i][0]
      out[i * 3 + 1] = this.points[i][1]
      out[i * 3 + 2] = this.points[i][2]
    }
    return out
  }

  get indices() {
    return new Uint16Array([0, 1, 2, 0, 2, 3])
  }

  /** Filaire 4 côtés uniquement (pas ligne_panneau 12 segments). */
  get wire() {
    const out = new Float32Array(ligne_rectangle.length * 6)
    ligne_rectangle.forEach(([a, b], i) => {
      const o = i * 6
      out[o] = this.points[a][0]
      out[o + 1] = this.points[a][1]
      out[o + 2] = this.points[a][2]
      out[o + 3] = this.points[b][0]
      out[o + 4] = this.points[b][1]
      out[o + 5] = this.points[b][2]
    })
    return out
  }

  toBuffers() {
    return {
      nom: this.nom,
      positions: this.positions,
      indices: this.indices,
      wire: this.wire,
      color: this.color,
      couleur: this.couleur,
    }
  }
}

/** Couleurs debug des 4 couches + teinte solide par panneau. */
const RECT_COLORS = {
  fond: {
    base: '#4cc9f0',
    decale: '#f72585',
    tolerance: '#ffd60a',
    arriere: '#80ed99',
    solid: '#8d6e4c',
  },
  porte: {
    base: '#90e0ef',
    decale: '#ff85a1',
    tolerance: '#ffe566',
    arriere: '#95d5b2',
    solid: '#c4a574',
  },
  dessous: {
    base: '#48cae4',
    decale: '#e85d75',
    tolerance: '#f4d35e',
    arriere: '#6bcb77',
    solid: '#6b5344',
  },
  dessus_interieur: {
    base: '#00b4d8',
    decale: '#d62828',
    tolerance: '#fcbf49',
    arriere: '#2a9d8f',
    solid: '#c4a574',
  },
  dessus_exterieur: {
    base: '#48cae4',
    decale: '#e63946',
    tolerance: '#f77f00',
    arriere: '#2a9d8f',
    solid: '#a67c52',
  },
  joue1: {
    base: '#0077b6',
    decale: '#9b2226',
    tolerance: '#e9c46a',
    arriere: '#52b788',
    solid: '#d4b896',
  },
  joue2: {
    base: '#023e8a',
    decale: '#ae2012',
    tolerance: '#e76f51',
    arriere: '#40916c',
    solid: '#9a7b4f',
  },
}

export const AGENCEMENT_TYPES = {
  shelf: 'shelf',
  drawer: 'drawer',
  fond: 'fond',
  porte: 'porte',
  facade: 'facade',
  plateau: 'plateau',
  pied: 'pied',
  joue1: 'joue1',
  joue2: 'joue2',
}

/**
 * Construit un panneau nommé (fond | porte | …) via les 4 fonctions matrice.
 *
 * @param {string} nom — clé dans PANNEAU_DEFS
 * @param {{ L: number, W: number, H: number }} dims
 * @param {{ epaisseur?: number, tolerance?: number, decalage?: number }} [params]
 */
export function buildPanneauComplet(nom, dims, params = {}) {
  const def = PANNEAU_DEFS[nom]
  if (!def) throw new Error(`buildPanneauComplet : PANNEAU_DEFS.${nom} absent`)

  const { byId } = buildGeometrie(dims)
  const {
    base,
    decale,
    tolerance,
    arriere,
    params: resolved,
  } = computeQuatreRectangles(def, byId, params)

  const colors = RECT_COLORS[nom] || RECT_COLORS.fond

  const rectangles = {
    base: new Rectangle3D(`${nom}-base`, base, colors.base),
    decale: new Rectangle3D(`${nom}-decale`, decale, colors.decale),
    tolerance: new Rectangle3D(`${nom}-tolerance`, tolerance, colors.tolerance),
    arriere: new Rectangle3D(`${nom}-arriere`, arriere, colors.arriere),
  }

  const panneau = new Panneau(nom, [...tolerance, ...arriere], {
    normal: def.normal,
    direction: def.direction,
    texture: def.texture,
    epaisseur: resolved.epaisseur,
  })

  const solidColor = def.couleur || colors.solid || '#c4a574'

  return {
    nom,
    rectangles,
    panneau,
    solidColor,
    params: resolved,
    points: {
      point1: base[0],
      point2: base[1],
      point3: base[2],
      point4: base[3],
      point_face1: decale[0],
      point_face2: decale[1],
      point_face3: decale[2],
      point_face4: decale[3],
      point_rectangle1: tolerance[0],
      point_rectangle2: tolerance[1],
      point_rectangle3: tolerance[2],
      point_rectangle4: tolerance[3],
      point_arriere1: arriere[0],
      point_arriere2: arriere[1],
      point_arriere3: arriere[2],
      point_arriere4: arriere[3],
    },
  }
}

/** Alias fond */
export function buildFond(dims, params = {}) {
  return buildPanneauComplet('fond', dims, params)
}

/** Alias porte (face opposée X1/X3) */
export function buildPorte(dims, params = {}) {
  return buildPanneauComplet('porte', dims, params)
}

/**
 * Solide seul (compat).
 * @returns {import('../00_matrice/matrice_panneau_grok.js').Panneau}
 */
export function buildPanneau(nom, dims, params = {}) {
  return buildPanneauComplet(nom, dims, params).panneau
}

/**
 * @param {{ L: number, W: number, H: number }} dims
 * @param {string[]} [noms=['fond']]
 * @param {{ epaisseur?: number, tolerance?: number, decalage?: number }} [params]
 */
export function buildPanneaux(dims, noms = ['fond'], params = {}) {
  const list = []
  for (const nom of noms) {
    if (PANNEAU_DEFS[nom]) list.push(buildPanneauComplet(nom, dims, params))
  }
  return list
}

/** Expose topologie pour debug / inspection. */
export { face_panneau, ligne_panneau, PANNEAU_DEFS, Panneau }

// ---------------------------------------------------------------------------
// Modules (tiroirs, portes, tablettes) — inchangé pour l’instant
// ---------------------------------------------------------------------------

export function createModule(kind, bayIndex = 0, extras = {}) {
  return {
    id: uid(kind),
    kind,
    bayIndex,
    openFactor: 0,
    /** Hauteur libre tablette (mm depuis le sol intérieur). null = auto répartie */
    zMm: null,
    ...extras,
  }
}

/**
 * Z tablette (mm) — clamp dans la zone utile.
 * Si zMm défini, l’utilise ; sinon répartition automatique.
 */
export function shelfZMm(mod, { H }, moduleList = []) {
  const inset = 22
  const zMin = inset + EPAISSEUR_PANNEAU / 2
  const zMax = H - inset - EPAISSEUR_PANNEAU / 2
  if (mod.zMm != null && Number.isFinite(Number(mod.zMm))) {
    return Math.min(zMax, Math.max(zMin, Number(mod.zMm)))
  }
  const sameKind = moduleList.filter((m) => m.kind === 'shelf')
  const count = Math.max(sameKind.length, 1)
  const index = sameKind.findIndex((m) => m.id === mod.id)
  const i = index >= 0 ? index : mod.bayIndex ?? 0
  const step = (H - 2 * inset) / (count + 1)
  return inset + step * (i + 1)
}

export function moduleLayout(mod, { L, W, H }, moduleList = []) {
  const inset = 22
  const innerL = L - 2 * inset
  const innerW = W - 2 * inset
  const innerH = H - 2 * inset
  const z0 = inset
  const y0 = inset
  const x0 = inset

  const sameKind = moduleList.filter((m) => m.kind === mod.kind)
  const count = Math.max(sameKind.length, 1)
  const index = sameKind.findIndex((m) => m.id === mod.id)
  const i = index >= 0 ? index : mod.bayIndex

  if (mod.kind === 'shelf') {
    const z = shelfZMm(mod, { H }, moduleList)
    return {
      center: [L / 2, W / 2, z],
      size: [innerL, innerW, EPAISSEUR_PANNEAU],
      openOffset: [0, 0, 0],
      zMm: z,
      zMin: inset + EPAISSEUR_PANNEAU / 2,
      zMax: H - inset - EPAISSEUR_PANNEAU / 2,
    }
  }

  if (mod.kind === 'drawer') {
    const drawerH = Math.min(180, (innerH - TOLERANCE * count) / count - 4)
    const gap = 4
    const z = z0 + i * (drawerH + gap) + drawerH / 2
    const open = (mod.openFactor || 0) * (innerW * 0.7)
    return {
      center: [L / 2, y0 + innerW / 2 - open, z],
      size: [innerL - 4, innerW - 8, drawerH],
      faceSize: [innerL - 4, EPAISSEUR_PORTE, drawerH],
      faceCenter: [L / 2, y0 - open, z],
      openOffset: [0, -open, 0],
    }
  }

  if (mod.kind === 'door') {
    const open = (mod.openFactor || 0) * (Math.PI / 2)
    const doorW = innerL / Math.max(count, 1) - 4
    const x = x0 + i * (doorW + 4) + doorW / 2
    return {
      center: [x, y0, H / 2],
      size: [doorW, EPAISSEUR_PORTE, innerH],
      hinge: [x - doorW / 2, y0, H / 2],
      openAngle: open,
      openOffset: [0, 0, 0],
    }
  }

  return {
    center: [L / 2, W / 2, H / 2],
    size: [innerL, innerW, EPAISSEUR_PANNEAU],
    openOffset: [0, 0, 0],
  }
}

/**
 * Prix HT d’un module d’aménagement (forfait + variable surface).
 * Tablette : surface L×W ; tiroir / porte : surface façade L×H.
 */
export function modulePriceHT(mod, dims) {
  // Import local pour éviter cycle si matrice importe agencement un jour
  // Constantes lues depuis matrice_constante via lazy require pattern inline
  return modulePriceBreakdown(mod, dims).total
}

/** Détail ligne devis pour un module. */
export function modulePriceBreakdown(mod, dims) {
  const shelfArea = (dims.L * dims.W) / 1e6
  const faceArea = (dims.L * dims.H) / 1e6

  if (mod.kind === 'shelf') {
    const forfait = PRIX.tabletteForfait
    const variable = shelfArea * PRIX.tabletteParM2
    return {
      kind: 'shelf',
      label: 'Tablette',
      forfait,
      surfaceM2: shelfArea,
      variable,
      total: forfait + variable,
    }
  }
  if (mod.kind === 'drawer') {
    const forfait = PRIX.tiroirForfait
    const variable = faceArea * PRIX.tiroirParM2
    return {
      kind: 'drawer',
      label: 'Tiroir',
      forfait,
      surfaceM2: faceArea,
      variable,
      total: forfait + variable,
    }
  }
  if (mod.kind === 'door') {
    const forfait = PRIX.porteForfait
    const variable = faceArea * PRIX.porteParM2
    return {
      kind: 'door',
      label: 'Porte',
      forfait,
      surfaceM2: faceArea,
      variable,
      total: forfait + variable,
    }
  }
  return {
    kind: mod.kind,
    label: mod.kind,
    forfait: 10,
    surfaceM2: 0,
    variable: 0,
    total: 10,
  }
}
