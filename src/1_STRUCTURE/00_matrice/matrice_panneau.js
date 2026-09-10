/**
 * ============================================================================
 * SOURCE DE VÉRITÉ — logique panneau Philae
 * ============================================================================
 * Édite UNIQUEMENT ce fichier pour la géométrie des panneaux.
 * matrice_panneau.js ne fait que ré-exporterter d’ici (shim anti-écrasement).
 *
 * Formules :
 *   base[i]      = byId[arete].points[index]
 *   decale[i]    = base[i] − DECALAGE × [0,1,0]
 *   tolerance[i] = decale[i] − TOLERANCE × [0,1,0]
 *   arriere[i]   = tolerance[i] + EPAISSEUR × unite[i]
 *
 * Types de contour (face arrière décalée) :
 *   rectangle-4biseaux — biseau 45° sur les 4 côtés (défaut, panneau plein)
 *   rectangle-3biseaux — biseau 45° sur 3 côtés, 1 côté droit (plan Z)
 *                        joue / fond partiel haut ou bas ; façade 1er tiroir au sol
 *   rectangle-2biseaux — biseau 45° sur 2 côtés (Y / X), 2 côtés droits (plan Z)
 *                        joue / fond partiel milieu ; façades de tiroirs suivantes
 */
import {
  EPAISSEUR_PANNEAU,
  TOLERANCE,
  DECALAGE_PANNEAU,
  EPAISSEUR_PORTE,
} from './matrice_constante.js'

// ---------------------------------------------------------------------------
// Topologie
// ---------------------------------------------------------------------------

/** Contour d’un rectangle 4 points. */
export const ligne_rectangle = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
]

/** Solide 8 points (face avant 0..3 + face arrière 4..7). */
export const ligne_panneau = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
]

export const face_panneau = [
  [0, 1, 2],
  [0, 2, 3],
  [4, 6, 5],
  [4, 7, 6],
  [0, 1, 5],
  [0, 5, 4],
  [1, 2, 6],
  [1, 6, 5],
  [2, 3, 7],
  [2, 7, 6],
  [3, 0, 4],
  [3, 4, 7],
]

// ---------------------------------------------------------------------------
// Définition pure (données JS valides — PAS de point1 + arithmétique ici)
// ---------------------------------------------------------------------------

/**
 * fond  = face côté X0 / X2 (Y min)
 * porte = face opposée X1 / X3 (Y max) — même logique, signes Y inversés
 */
export const PANNEAU_DEFS = {
  fond: {
    nom: 'fond',
    normal: 'Y',
    direction: 1,
    epaisseur: EPAISSEUR_PANNEAU,
    tolerance: TOLERANCE,
    decalage: DECALAGE_PANNEAU,
    /** soustraction le long de +Y (vers l’intérieur depuis Y≈0) */
    axe_decalage: [0, 1, 0],
    rectangle_base: [
      { arete: 'X0', point: 5 },
      { arete: 'X0', point: 11 },
      { arete: 'X2', point: 11 },
      { arete: 'X2', point: 5 },
    ],
    /** arriere[i] = tolerance[i] + ep × unite[i] */
    arriere_unite: [
      [-1, -1, -1],
      [1, -1, -1],
      [1, -1, 1],
      [-1, -1, 1],
    ],
    /** inset face (XZ) par coin — fond */
    tolerance_unite: [
      [-1, 0, -1],
      [1, 0, -1],
      [1, 0, 1],
      [-1, 0, 1],
    ],
    texture: 'panneau',
    couleur: '#8d6e4c',
  },

  porte: {
    nom: 'porte',
    normal: 'Y',
    direction: -1,
    epaisseur: EPAISSEUR_PORTE,
    tolerance: TOLERANCE,
    decalage: DECALAGE_PANNEAU,
    /** opposé du fond : soustraction le long de −Y (vers l’intérieur depuis Y max) */
    axe_decalage: [0, -1, 0],
    rectangle_base: [
      { arete: 'X1', point: 4 },
      { arete: 'X1', point: 10 },
      { arete: 'X3', point: 10 },
      { arete: 'X3', point: 4 },
    ],
    /** mêmes unites que fond, composante Y inversée */
    arriere_unite: [
      [1, -1, 1],
      [-1, -1, 1],
      [-1, -1, -1],
      [1, -1, -1],
    ],
    /** inset face (XZ) — même plan que fond */
    tolerance_unite: [
      [-1, 0, -1],
      [1, 0, -1],
      [1, 0, 1],
      [-1, 0, 1],
    ],
    texture: 'panneau',
    couleur: '#b8956a',
  },

  dessous: {
    nom: 'dessous',
    normal: 'Z',
    direction: -1,
    epaisseur: EPAISSEUR_PANNEAU,
    tolerance: TOLERANCE,
    decalage: DECALAGE_PANNEAU,
    /** opposé du fond : soustraction le long de −Y (vers l’intérieur depuis Y max) */
    axe_decalage: [0, 0, 1],
    rectangle_base: [
      { arete: 'X0', point: 3 },
      { arete: 'X0', point: 9 },
      { arete: 'X1', point: 9 },
      { arete: 'X1', point: 3 },
    ],
    /** mêmes unites que fond, composante Y inversée */
    arriere_unite: [
      [-1, -1, -1],
      [1, -1, -1],
      [1, 1, -1],
      [-1, 1, -1],
    ],
    /** inset face (XZ) — même plan que fond */
    tolerance_unite: [
      [-1, -1, 0],
      [1, -1, 0],
      [1, 1, 0],
      [-1, 1, 0],
    ],
    texture: 'panneau',
    couleur: '#6b5344',
  },

  /**
   * Dessus : deux variantes exclusives (ou aucune).
   * — dessus_interieur : points 3/9 (intérieur du cadre d’arêtes)
   * — dessus_exterieur : points 4/10 (extérieur)
   */
  dessus_interieur: {
    nom: 'dessus_interieur',
    normal: 'Z',
    direction: -1,
    epaisseur: EPAISSEUR_PANNEAU,
    tolerance: TOLERANCE,
    decalage: DECALAGE_PANNEAU,
    axe_decalage: [0, 0, -1],
    rectangle_base: [
      { arete: 'X2', point: 3 },
      { arete: 'X2', point: 9 },
      { arete: 'X3', point: 9 },
      { arete: 'X3', point: 3 },
    ],
    arriere_unite: [
      [-1, -1, 1],
      [1, -1, 1],
      [1, 1, 1],
      [-1, 1, 1],
    ],
    tolerance_unite: [
      [-1, -1, 0],
      [1, -1, 0],
      [1, 1, 0],
      [-1, 1, 0],
    ],
    texture: 'panneau',
    couleur: '#c4a574',
  },

  dessus_exterieur: {
    nom: 'dessus_exterieur',
    normal: 'Z',
    direction: -1,
    epaisseur: EPAISSEUR_PANNEAU,
    tolerance: TOLERANCE,
    decalage: DECALAGE_PANNEAU,
    axe_decalage: [0, 0, -1],
    rectangle_base: [
      { arete: 'X2', point: 2 },
      { arete: 'X2', point: 8 },
      { arete: 'X3', point: 8 },
      { arete: 'X3', point: 2 },
    ],
    arriere_unite: [
      [1, 1, -1],
      [-1, 1, -1],
      [-1, -1, -1],
      [1, -1, -1],
    ],
    tolerance_unite: [
      [-1, -1, 0],
      [1, -1, 0],
      [1, 1, 0],
      [-1, 1, 0],
    ],
    texture: 'panneau',
    couleur: '#a67c52',
  },

  joue1: {
    nom: 'joue1',
    normal: 'X',
    direction: 1,
    epaisseur: EPAISSEUR_PANNEAU,
    tolerance: TOLERANCE,
    decalage: DECALAGE_PANNEAU,
    /** opposé du fond : soustraction le long de −Y (vers l’intérieur depuis Y max) */
    axe_decalage: [1, 0, 0],
    rectangle_base: [
      { arete: 'Y0', point: 3 },
      { arete: 'Y0', point: 9 },
      { arete: 'Y2', point: 9 },
      { arete: 'Y2', point: 3 },
    ],
    /** mêmes unites que fond, composante Y inversée */
    arriere_unite: [
      [-1, -1, -1],
      [-1, 1, -1],
      [-1, 1, 1],
      [-1, -1, 1],
    ],
    /** inset face (XZ) — même plan que fond */
    tolerance_unite: [
      [0, -1, -1],
      [0, 1, -1],
      [0, 1, 1],
      [0, -1, 1],
    ],
    texture: 'panneau',
    couleur: '#d4b896',
  },

  joue2: {
    nom: 'joue2',
    normal: 'X',
    direction: -1,
    epaisseur: EPAISSEUR_PANNEAU,
    tolerance: TOLERANCE,
    decalage: DECALAGE_PANNEAU,
    /** opposé du fond : soustraction le long de −Y (vers l’intérieur depuis Y max) */
    axe_decalage: [-1, 0, 0],
    rectangle_base: [
      { arete: 'Y1', point: 3 },
      { arete: 'Y1', point: 9 },
      { arete: 'Y3', point: 9 },
      { arete: 'Y3', point: 3 },
    ],
    /** mêmes unites que fond, composante Y inversée */
    arriere_unite: [
      [1, -1, -1],
      [1, 1, -1],
      [1, 1, 1],
      [1, -1, 1],
    ],
    /** inset face (XZ) — même plan que fond */
    tolerance_unite: [
      [0, -1, -1],
      [0, 1, -1],
      [0, 1, 1],
      [0, -1, 1],
    ],
    texture: 'panneau',
    couleur: '#9a7b4f',
  },
}

/** Variantes mutuellement exclusives (max une à la fois, ou aucune). */
export const PANNEAU_GROUPES_EXCLUSIFS = {
  dessus: ['dessus_interieur', 'dessus_exterieur'],
}

// ---------------------------------------------------------------------------
// Types de contour (biseaux 45°)
// ---------------------------------------------------------------------------

/** Biseau 45° tout autour du rectangle de base. */
export const RECTANGLE_4BISEAUX = 'rectangle-4biseaux'
/** Biseau 45° sur 3 côtés ; le 4e (plan Z) reste droit. */
export const RECTANGLE_3BISEAUX = 'rectangle-3biseaux'
/** Biseau 45° sur 2 côtés ; les 2 côtés Z restent droits. */
export const RECTANGLE_2BISEAUX = 'rectangle-2biseaux'

/**
 * Côtés Z sans biseau, d’après le type de contour.
 * @param {string} [type]
 * @param {'zMin'|'zMax'|'bas'|'haut'} [coteDroit] — côté droit si 3 biseaux
 * @returns {{ zMin: boolean, zMax: boolean }}
 */
export function cotesDroitsZ(type, coteDroit) {
  if (type === RECTANGLE_2BISEAUX || type === 2) {
    return { zMin: true, zMax: true }
  }
  if (type === RECTANGLE_3BISEAUX || type === 3) {
    if (coteDroit === 'zMin' || coteDroit === 'bas') {
      return { zMin: true, zMax: false }
    }
    return { zMin: false, zMax: true }
  }
  return { zMin: false, zMax: false }
}

/**
 * Type de contour d’après les bornes Z réellement recalées
 * (zMin / zMax présents = côté coupé, absent = côté ossature) :
 *   aucun          → 4 biseaux (panneau plein)
 *   zMax seul      → 3 biseaux, tranche haute plate
 *   zMin seul      → 3 biseaux, tranche basse plate
 *   zMin et zMax   → 2 biseaux, les 2 tranches Z plates
 *
 * @param {{ zMin?: number, zMax?: number } | null} bounds
 */
export function resolveTypeBiseau(bounds = {}) {
  const hasZMin = Number.isFinite(Number(bounds?.zMin))
  const hasZMax = Number.isFinite(Number(bounds?.zMax))
  if (hasZMin && hasZMax) return { type: RECTANGLE_2BISEAUX }
  if (!hasZMin && hasZMax) {
    return { type: RECTANGLE_3BISEAUX, coteDroit: 'zMax' }
  }
  if (hasZMin && !hasZMax) {
    return { type: RECTANGLE_3BISEAUX, coteDroit: 'zMin' }
  }
  return { type: RECTANGLE_4BISEAUX }
}

/**
 * Annule la composante Z des unites sur les coins dont le côté Z est droit.
 * Classification des coins via le Z du rectangle de base (après zMin/zMax).
 *
 * @param {number[][]} unites
 * @param {number[][]} base
 * @param {{ zMin?: boolean, zMax?: boolean }} droit
 */
export function maskUniteZ(unites, base, droit = {}) {
  const dMin = Boolean(droit.zMin)
  const dMax = Boolean(droit.zMax)
  if (!unites || (!dMin && !dMax)) {
    return unites ? unites.map((u) => [...u]) : unites
  }
  const zs = base.map((p) => p[2])
  const zLo = Math.min(...zs)
  const zHi = Math.max(...zs)
  return unites.map((u, i) => {
    const z = base[i][2]
    const nearerMin = Math.abs(z - zLo) <= Math.abs(z - zHi)
    if ((dMin && nearerMin) || (dMax && !nearerMin)) {
      return [u[0], u[1], 0]
    }
    return [...u]
  })
}

// ---------------------------------------------------------------------------
// Helpers vectoriels
// ---------------------------------------------------------------------------

export function moinsVec(p, k, v) {
  return [p[0] - k * v[0], p[1] - k * v[1], p[2] - k * v[2]]
}

export function plusVec(p, k, v) {
  return [p[0] + k * v[0], p[1] + k * v[1], p[2] + k * v[2]]
}

// ---------------------------------------------------------------------------
// 4 fonctions = 4 rectangles
// ---------------------------------------------------------------------------

/** 1. base : coords via arête + index */
export function makeRectangleBase(byId, refs) {
  const r0 = refs[0]
  const r1 = refs[1]
  const r2 = refs[2]
  const r3 = refs[3]
  return [
    [...byId[r0.arete].points[r0.point]],
    [...byId[r1.arete].points[r1.point]],
    [...byId[r2.arete].points[r2.point]],
    [...byId[r3.arete].points[r3.point]],
  ]
}

/** 2. decale : base − DECALAGE × axe_decalage */
export function makeRectangleDecale(base, decalage, axe = [0, 1, 0]) {
  return [
    moinsVec(base[0], decalage, axe),
    moinsVec(base[1], decalage, axe),
    moinsVec(base[2], decalage, axe),
    moinsVec(base[3], decalage, axe),
  ]
}

/**
 * 3. tolerance : inset par coin
 *    point_rect[i] = face[i] − TOLERANCE × tolerance_unite[i]
 */
export function makeRectangleTolerance(decale, tolerance, unites) {
  return [
    moinsVec(decale[0], tolerance, unites[0]),
    moinsVec(decale[1], tolerance, unites[1]),
    moinsVec(decale[2], tolerance, unites[2]),
    moinsVec(decale[3], tolerance, unites[3]),
  ]
}

/**
 * 4. arriere : rect + EPAISSEUR × arriere_unite[i]
 */
export function makeRectangleArriere(tolerancePts, epaisseur, unites) {
  return [
    plusVec(tolerancePts[0], epaisseur, unites[0]),
    plusVec(tolerancePts[1], epaisseur, unites[1]),
    plusVec(tolerancePts[2], epaisseur, unites[2]),
    plusVec(tolerancePts[3], epaisseur, unites[3]),
  ]
}

/** Enchaîne les 4 fonctions (params UI optionnels). */
export function computeQuatreRectangles(def, byId, params = {}) {
  const ep = params.epaisseur ?? def.epaisseur ?? EPAISSEUR_PANNEAU
  const tol = params.tolerance ?? def.tolerance ?? TOLERANCE
  const dec = params.decalage ?? def.decalage ?? DECALAGE_PANNEAU
  const axe = def.axe_decalage ?? [0, 1, 0]
  const type = params.type ?? def.type ?? RECTANGLE_4BISEAUX
  const coteDroit = params.coteDroit ?? def.coteDroit
  let tolUnites = def.tolerance_unite ?? [
    [-1, 0, -1],
    [1, 0, -1],
    [1, 0, 1],
    [-1, 0, 1],
  ]
  let arrUnites = def.arriere_unite

  let base = makeRectangleBase(byId, def.rectangle_base)
  const hasZMin = Number.isFinite(Number(params.zMin))
  const hasZMax = Number.isFinite(Number(params.zMax))
  if (hasZMin || hasZMax) {
    const zs = base.map((p) => p[2])
    const zLo = Math.min(...zs)
    const zHi = Math.max(...zs)
    const destMin = hasZMin ? Number(params.zMin) : zLo
    const destMax = hasZMax ? Number(params.zMax) : zHi
    const span = zHi - zLo
    base = base.map((p) => [
      p[0],
      p[1],
      span === 0 ? destMin : destMin + ((p[2] - zLo) / span) * (destMax - destMin),
    ])
  }
  const hasXMin = Number.isFinite(Number(params.xMin))
  const hasXMax = Number.isFinite(Number(params.xMax))
  if (hasXMin || hasXMax) {
    const xs = base.map((p) => p[0])
    const xLo = Math.min(...xs)
    const xHi = Math.max(...xs)
    const destMin = hasXMin ? Number(params.xMin) : xLo
    const destMax = hasXMax ? Number(params.xMax) : xHi
    const span = xHi - xLo
    base = base.map((p) => [
      span === 0 ? destMin : destMin + ((p[0] - xLo) / span) * (destMax - destMin),
      p[1],
      p[2],
    ])
  }

  const droitZ = cotesDroitsZ(type, coteDroit)
  if (droitZ.zMin || droitZ.zMax) {
    tolUnites = maskUniteZ(tolUnites, base, droitZ)
    arrUnites = maskUniteZ(arrUnites, base, droitZ)
  }

  const decale = makeRectangleDecale(base, dec, axe)
  const tolerance = makeRectangleTolerance(decale, tol, tolUnites)
  const arriere = makeRectangleArriere(tolerance, ep, arrUnites)

  return {
    base,
    decale,
    tolerance,
    arriere,
    params: {
      epaisseur: ep,
      tolerance: tol,
      decalage: dec,
      type,
      coteDroit: coteDroit ?? null,
    },
  }
}

// ---------------------------------------------------------------------------
// Classe Panneau (solide 8 points)
// ---------------------------------------------------------------------------

export class Panneau {
  constructor(nom, points, meta = {}) {
    if (!points || points.length !== 8) {
      throw new Error(
        `Panneau "${nom}" : 8 points requis, reçu ${points?.length}`,
      )
    }
    this.nom = nom
    this.points = points.map((p) => [p[0], p[1], p[2]])
    this.normal = meta.normal ?? 'Y'
    this.direction = meta.direction ?? 1
    this.texture = meta.texture ?? 'panneau'
    this.epaisseur = meta.epaisseur ?? EPAISSEUR_PANNEAU
    this.faces = face_panneau
    this.lignes = ligne_panneau
  }

  get positions() {
    const out = new Float32Array(24)
    for (let i = 0; i < 8; i++) {
      out[i * 3] = this.points[i][0]
      out[i * 3 + 1] = this.points[i][1]
      out[i * 3 + 2] = this.points[i][2]
    }
    return out
  }

  get indices() {
    const out = new Uint16Array(face_panneau.length * 3)
    face_panneau.forEach((tri, i) => {
      out[i * 3] = tri[0]
      out[i * 3 + 1] = tri[1]
      out[i * 3 + 2] = tri[2]
    })
    return out
  }

  get uvs() {
    const out = new Float32Array(16)
    const uv = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]
    uv.forEach((u, i) => {
      out[i * 2] = u[0]
      out[i * 2 + 1] = u[1]
    })
    return out
  }

  get wire() {
    const out = new Float32Array(ligne_panneau.length * 6)
    ligne_panneau.forEach(([a, b], i) => {
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
      uvs: this.uvs,
      wire: this.wire,
      texture: this.texture,
      normal: this.normal,
      direction: this.direction,
    }
  }
}

export default {
  ligne_rectangle,
  ligne_panneau,
  face_panneau,
  PANNEAU_DEFS,
  RECTANGLE_4BISEAUX,
  RECTANGLE_3BISEAUX,
  RECTANGLE_2BISEAUX,
  cotesDroitsZ,
  resolveTypeBiseau,
  maskUniteZ,
  moinsVec,
  plusVec,
  makeRectangleBase,
  makeRectangleDecale,
  makeRectangleTolerance,
  makeRectangleArriere,
  computeQuatreRectangles,
  Panneau,
}
