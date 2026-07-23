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
  const tolUnites = def.tolerance_unite ?? [
    [-1, 0, -1],
    [1, 0, -1],
    [1, 0, 1],
    [-1, 0, 1],
  ]
  const arrUnites = def.arriere_unite

  const base = makeRectangleBase(byId, def.rectangle_base)
  const decale = makeRectangleDecale(base, dec, axe)
  const tolerance = makeRectangleTolerance(decale, tol, tolUnites)
  const arriere = makeRectangleArriere(tolerance, ep, arrUnites)

  return {
    base,
    decale,
    tolerance,
    arriere,
    params: { epaisseur: ep, tolerance: tol, decalage: dec },
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
  moinsVec,
  plusVec,
  makeRectangleBase,
  makeRectangleDecale,
  makeRectangleTolerance,
  makeRectangleArriere,
  computeQuatreRectangles,
  Panneau,
}
