/** Constantes de fabrication Philae (mm). */

/**
 * Section d’arête selon l’encombrement du meuble :
 *   max(L, P/W, H) < 1000 mm  →  30×30
 *   max(L, P/W, H) ≥ 1000 mm  →  40×40
 */
export const ARETE_SEUIL_GRANDE_MM = 1000
export const ARETE_SECTION_PETITE = Object.freeze({ largeur: 30, hauteur: 30 })
export const ARETE_SECTION_GRANDE = Object.freeze({ largeur: 40, hauteur: 40 })

/**
 * Résout la section d’arête pour un meuble.
 * @param {{ L?: number, W?: number, P?: number, H?: number } | null} dims
 * @returns {{ largeur: number, hauteur: number, maxDim: number, grande: boolean, label: string }}
 */
export function resolveAreteSection(dims = {}) {
  const L = Number(dims?.L) || 0
  const W = Number(dims?.W ?? dims?.P) || 0
  const H = Number(dims?.H) || 0
  const maxDim = Math.max(L, W, H)
  const grande = maxDim >= ARETE_SEUIL_GRANDE_MM
  const sec = grande ? ARETE_SECTION_GRANDE : ARETE_SECTION_PETITE
  return {
    largeur: sec.largeur,
    hauteur: sec.hauteur,
    maxDim,
    grande,
    label: `${sec.largeur}×${sec.hauteur}`,
  }
}

/** Largeur de section (= extrusion traverses) pour un meuble. */
export function areteExtrusionMm(dims) {
  return resolveAreteSection(dims).largeur
}

/** Défaut rétrocompat (petit meuble 30×30). Préférer resolveAreteSection(dims). */
export const LARGEUR_ARETE = ARETE_SECTION_PETITE.largeur
export const HAUTEUR_ARETE = ARETE_SECTION_PETITE.hauteur
export const TOLERANCE = 1
/** Épaisseur figée fabrication (mm) — plus de choix UI client. */
export const EPAISSEUR_PANNEAU = 15
export const EPAISSEUR_PORTE = 15
/** @deprecated figé à 15 mm */
export const EPAISSEURS_PANNEAU = [15]
/** @deprecated figé à 15 mm */
export const EPAISSEURS_PORTE = [15]
/** Décalage face panneau depuis le point d’arête (mm) — fixe, plus de slider. */
export const DECALAGE_PANNEAU = 0

/**
 * Jeu Z entre deux tiroirs empilés (mm).
 * Tiroir 1 au plus bas ; tiroir n+1 = haut du tiroir n + ce décalage.
 */
export const DRAWER_STACK_GAP_MM = 40

/** Angle géométrique signature (rad) — tan(angle) ≈ 1/√2. */
export const ANGLE_GEOMETRIE = 0.6155

/** Densités / facteurs CO₂e indicatifs (non certifiés ACV). */
export const DENSITE_BOIS_TENDRE = 450 // kg/m³
export const DENSITE_MELAMINE = 650 // kg/m³
export const CO2E_BOIS = 0.35 // kg CO₂e / kg
export const CO2E_MELAMINE = 0.85 // kg CO₂e / kg

export const TVA = 0.2

/**
 * Matrice de prix HT (indicatif atelier) — à ajuster ici.
 *
 * Ossature : forfait + variable × longueur cumulée des 12 arêtes
 *   longueur_m = 4 × (L + W + H) / 1000   (L,W,H en mm)
 *
 * Panneau : forfait par panneau + variable × surface (m²)
 * Tablette : forfait + variable × surface L×W (m²)
 * Tiroir : forfait + variable × volume L×W×H_tiroir (m³)
 *   H_tiroir parmi 200 / 300 / 400 mm (défaut catalogue : 200 mm)
 * Porte (module) : forfait + variable × façade L×H (m²)
 */
export const PRIX = {
  /** Ossature bois (section 30×30 ou 40×40 selon max dim) */
  ossatureForfait: 500,
  /** € HT / m de longueur cumulée 4×(L+W+H) */
  ossatureParMetre: 50,

  /** Forfait HT par panneau (fond, joue, dessus…) */
  panneauForfait: 50,
  /** € HT / m² de panneau */
  panneauParM2: 100,

  /** Tablette */
  tabletteForfait: 50,
  tabletteParM2: 100,

  /**
   * Tiroir Würth type B : volume m³ = LIC × profondeur × H (mm → /1e9)
   * H parmi hauteurs Würth ASTUCIO (voir tiroir/wurth.js)
   */
  tiroirForfait: 150,
  tiroirParM3: 1000,
  /** @deprecated → WURTH_HAUTEUR_DEFAUT_MM */
  tiroirHauteurDefautMm: 110,
  /** @deprecated → WURTH_HAUTEURS_MM */
  tiroirHauteursMm: [58, 84, 110, 136, 162, 188, 214, 240, 266],

  /** Porte (module) */
  porteForfait: 250,
  porteParM2: 100,

  /** Pied (module) */
  piedForfait: 100,

  /** Produit numérique modèle 3D (HT) — bouton client */
  modele3d: 45,
}

/** Min et max des valeurs de Longueur (mm), Largeur (mm), Hauteur (mm) */
export const LONGUEUR_MIN = 200
export const LONGUEUR_MAX = 2200
export const LARGEUR_MIN = 200
export const LARGEUR_MAX = 2200
export const HAUTEUR_MIN = 200
export const HAUTEUR_MAX = 2200



/** @deprecated utiliser PRIX.ossatureParMetre */
export const PRIX_METRE_ARETE = PRIX.ossatureParMetre
/** @deprecated utiliser PRIX.panneauParM2 */
export const PRIX_M2_PANNEAU = PRIX.panneauParM2

/** Couleur des lignes d’arêtes ossature (noir brillant). */
export const ARETE_EDGE_COLOR = '#0a0a0a'
/** Épaisseur des lignes d’arêtes en pixels (LineMaterial / LineSegments2). */
export const ARETE_EDGE_WIDTH = 2.4

/** Couleur des contours de panneaux + tablettes (noir). */
export const PANNEAU_EDGE_COLOR = '#000000'
/**
 * Contours panneaux : trait un peu plus fin que les arêtes ossature.
 * (ARETE_EDGE_WIDTH ≈ 2.4 → panneau ≈ 1.65)
 */
export const PANNEAU_EDGE_WIDTH = 1.65

/** Rayon tubes GLB catalogue (mm) — arêtes vs panneaux. */
export const ARETE_TUBE_RADIUS_MM = 1.3
export const PANNEAU_TUBE_RADIUS_MM = 0.85

/** Libellés panneaux (catalogue / fiche produit / devis). */
export const PANNEAU_LABELS = {
  fond: 'Fond',
  porte: 'Porte',
  dessous: 'Dessous',
  joue1: 'Joue 1',
  joue2: 'Joue 2',
  dessus_interieur: 'Dessus intérieur',
  dessus_exterieur: 'Dessus extérieur',
}

export function panneauLabel(nom) {
  return PANNEAU_LABELS[nom] || String(nom || '').replace(/_/g, ' ')
}

/**
 * @deprecated Préférer l’API Stripe `/api/checkout` (Worker).
 * Si non vide, requestAcheter peut encore ouvrir cette URL en secours.
 */
export const BOUTIQUE_CHECKOUT_URL = ''

/**
 * Essence atelier (non choisie par le client) — teinte de base du bois local.
 * Le client choisit uniquement la finition de surface (FINITIONS_OSSATURE_CLIENT).
 */
export const BOIS_ATELIER_ID = 'chene'

/** Essence / teinte bois (couleur ossature de base — usage atelier / rétrocompat). */
export const FINITIONS = {
  chene: { id: 'chene', label: 'Chêne', color: '#c4a574', edge: '#9a7b4f' },
  hetre: { id: 'hetre', label: 'Hêtre', color: '#d4b896', edge: '#b8956a' },
  sapin: { id: 'sapin', label: 'Sapin', color: '#e8d5b0', edge: '#c9b48a' },
  noyer: { id: 'noyer', label: 'Noyer', color: '#6b4423', edge: '#4a2f18' },
  frene: { id: 'frene', label: 'Frêne', color: '#d4c4a8', edge: '#b8a888' },
  brut: { id: 'brut', label: 'Brut', color: '#8b6b4a', edge: '#6a5038' },
}

/**
 * Finition de surface de l’ossature (traitement) — enregistrée dans la matrice.
 * S’applique par-dessus l’essence atelier (bois local, non choisi par le client).
 * previewColor : pastille UI client.
 */
export const FINITIONS_OSSATURE = {
  brut: {
    id: 'brut',
    label: 'Brut',
    roughness: 0.88,
    metalness: 0.02,
    shade: 1,
    previewColor: '#c4a574',
  },
  vernis_clair: {
    id: 'vernis_clair',
    label: 'Vernis clair',
    roughness: 0.32,
    metalness: 0.08,
    shade: 1.06,
    previewColor: '#d4b896',
  },
  vernis_fonce: {
    id: 'vernis_fonce',
    label: 'Vernis foncé',
    roughness: 0.28,
    metalness: 0.1,
    shade: 0.72,
    previewColor: '#8a6a42',
  },
  huile: {
    id: 'huile',
    label: 'Huile naturelle',
    roughness: 0.48,
    metalness: 0.03,
    shade: 0.95,
    previewColor: '#b8956a',
  },
  // Conservées pour rétrocompat exports / anciennes configs (non proposées au client)
  grave: {
    id: 'grave',
    label: 'Gravé',
    roughness: 0.78,
    metalness: 0.04,
    shade: 0.9,
    previewColor: '#a88860',
  },
  cire: {
    id: 'cire',
    label: 'Cire',
    roughness: 0.42,
    metalness: 0.05,
    shade: 1.02,
    previewColor: '#c9b48a',
  },
}

/** Finitions proposées au client dans le control panel. */
export const FINITIONS_OSSATURE_CLIENT = [
  'brut',
  'vernis_clair',
  'vernis_fonce',
  'huile',
]

/**
 * 5 couleurs panneau — tons site (or / ivoire / bois), contrastent légèrement.
 * Appliquées à tous les panneaux d’une configuration.
 */
/** Contours filaires panneaux : toujours noir (indépendant de la teinte de face). */
const PANNEAU_EDGE_HEX = '#000000'

export const PANNEAU_COULEURS = {
  terracotta: {
    id: 'terracotta',
    label: 'Terracotta',
    color: '#c4785a',
    edge: PANNEAU_EDGE_HEX,
  },
  olive: {
    id: 'olive',
    label: 'Olive',
    color: '#7a8f5c',
    edge: PANNEAU_EDGE_HEX,
  },
  bleu_poudre: {
    id: 'bleu_poudre',
    label: 'Bleu clair poudré',
    color: '#a8c4d4',
    edge: PANNEAU_EDGE_HEX,
  },
  gris_cendre: {
    id: 'gris_cendre',
    label: 'Gris cendre blanc',
    color: '#d4d0c8',
    edge: PANNEAU_EDGE_HEX,
  },
  jaune_orange: {
    id: 'jaune_orange',
    label: 'Jaune orangé clair',
    color: '#e8b86d',
    edge: PANNEAU_EDGE_HEX,
  },
  /** Couleur libre (spectre) — le hex est dans unit.panneauCouleurHex */
  surmesure: {
    id: 'surmesure',
    label: 'Sur mesure',
    color: '#c9a227',
    edge: PANNEAU_EDGE_HEX,
  },
}

export const DEFAULT_PANNEAU_COULEUR = 'gris_cendre'
export const DEFAULT_PANNEAU_HEX = '#c9a227'

/** Résout la couleur de panneau (id catalogue ou hex sur mesure). */
export function resolvePanneauColor(panneauCouleur, panneauCouleurHex) {
  if (panneauCouleur === 'surmesure' || String(panneauCouleur || '').startsWith('#')) {
    const hex =
      panneauCouleurHex ||
      (String(panneauCouleur || '').startsWith('#') ? panneauCouleur : DEFAULT_PANNEAU_HEX)
    return {
      id: 'surmesure',
      label: 'Sur mesure',
      color: hex,
      edge: PANNEAU_EDGE_HEX,
    }
  }
  return (
    PANNEAU_COULEURS[panneauCouleur] ||
    PANNEAU_COULEURS[DEFAULT_PANNEAU_COULEUR]
  )
}

function shadeEdge(hex) {
  try {
    const n = parseInt(String(hex).replace('#', ''), 16)
    const r = Math.max(0, ((n >> 16) & 255) * 0.72)
    const g = Math.max(0, ((n >> 8) & 255) * 0.72)
    const b = Math.max(0, (n & 255) * 0.72)
    return (
      '#' +
      [r, g, b]
        .map((v) => Math.round(v).toString(16).padStart(2, '0'))
        .join('')
    )
  } catch {
    return '#666666'
  }
}
export const DEFAULT_FINITION_OSSATURE = 'brut'

/**
 * Résout une finition ossature client depuis une valeur catalogue
 * (texture, wood_finish, ossature_finish, alias libres).
 * Valeurs valides client : brut | vernis_clair | vernis_fonce | huile
 */
export function resolveOssatureFinish(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_')
  if (!s) return DEFAULT_FINITION_OSSATURE
  if (FINITIONS_OSSATURE[s]) return s
  const aliases = {
    vernis: 'vernis_clair',
    clair: 'vernis_clair',
    fonce: 'vernis_fonce',
    foncé: 'vernis_fonce',
    huile_naturelle: 'huile',
    oil: 'huile',
    raw: 'brut',
    bois_brut: 'brut',
    chene_clair: 'vernis_clair',
    hetre_clair: 'vernis_clair',
    sapin_clair: 'brut',
    noyer_fonce: 'vernis_fonce',
  }
  if (aliases[s] && FINITIONS_OSSATURE[aliases[s]]) return aliases[s]
  // Anciennes essences catalogue → finition par défaut
  if (FINITIONS[s]) return DEFAULT_FINITION_OSSATURE
  return DEFAULT_FINITION_OSSATURE
}

export default {
  LARGEUR_ARETE,
  HAUTEUR_ARETE,
  ARETE_SEUIL_GRANDE_MM,
  ARETE_SECTION_PETITE,
  ARETE_SECTION_GRANDE,
  resolveAreteSection,
  areteExtrusionMm,
  TOLERANCE,
  EPAISSEUR_PANNEAU,
  EPAISSEUR_PORTE,
  ANGLE_GEOMETRIE,
}
