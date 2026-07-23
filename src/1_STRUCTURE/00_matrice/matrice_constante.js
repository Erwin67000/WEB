/** Constantes de fabrication Philae (mm). */
export const LARGEUR_ARETE = 40
export const HAUTEUR_ARETE = 40
export const TOLERANCE = 1
/** Défauts épaisseur (mm) — choix discrets 12 | 14 | 16 dans le panel. */
export const EPAISSEUR_PANNEAU = 12
export const EPAISSEUR_PORTE = 12
/** Options proposées dans l’UI. */
export const EPAISSEURS_PANNEAU = [12, 14, 16]
export const EPAISSEURS_PORTE = [12, 14, 16]
/** Décalage face panneau depuis le point d’arête (mm) — fixe, plus de slider. */
export const DECALAGE_PANNEAU = 0

/** Angle géométrique signature (rad) — tan(angle) ≈ 1/√2. */
export const ANGLE_GEOMETRIE = 0.6155

/** Densités / facteurs CO₂e indicatifs (non certifiés ACV). */
export const DENSITE_BOIS_TENDRE = 450 // kg/m³
export const DENSITE_MELAMINE = 650 // kg/m³
export const CO2E_BOIS = 0.35 // kg CO₂e / kg
export const CO2E_MELAMINE = 0.85 // kg CO₂e / kg

export const TVA = 0.2

/** Prix indicatif HT par mètre d'arête 40×40 (bois tendre). */
export const PRIX_METRE_ARETE = 12

/** Prix indicatif HT par m² de panneau. */
export const PRIX_M2_PANNEAU = 45

/** Essence / teinte bois (couleur ossature de base). */
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
 * S’applique par-dessus l’essence (FINITIONS).
 */
export const FINITIONS_OSSATURE = {
  brut: {
    id: 'brut',
    label: 'Brut',
    roughness: 0.88,
    metalness: 0.02,
    /** multiplie la teinte essence (1 = inchangé) */
    shade: 1,
  },
  vernis_clair: {
    id: 'vernis_clair',
    label: 'Vernis clair',
    roughness: 0.32,
    metalness: 0.08,
    shade: 1.06,
  },
  vernis_fonce: {
    id: 'vernis_fonce',
    label: 'Vernis foncé',
    roughness: 0.28,
    metalness: 0.1,
    shade: 0.72,
  },
  grave: {
    id: 'grave',
    label: 'Gravé',
    roughness: 0.78,
    metalness: 0.04,
    shade: 0.9,
  },
  huile: {
    id: 'huile',
    label: 'Huile naturelle',
    roughness: 0.48,
    metalness: 0.03,
    shade: 0.95,
  },
  cire: {
    id: 'cire',
    label: 'Cire',
    roughness: 0.42,
    metalness: 0.05,
    shade: 1.02,
  },
}

/**
 * 5 couleurs panneau — tons site (or / ivoire / bois), contrastent légèrement.
 * Appliquées à tous les panneaux d’une configuration.
 */
export const PANNEAU_COULEURS = {
  terracotta: {
    id: 'terracotta',
    label: 'Terracotta',
    color: '#c4785a',
    edge: '#9a5a42',
  },
  olive: {
    id: 'olive',
    label: 'Olive',
    color: '#7a8f5c',
    edge: '#5a6b42',
  },
  bleu_poudre: {
    id: 'bleu_poudre',
    label: 'Bleu clair poudré',
    color: '#a8c4d4',
    edge: '#7a9aab',
  },
  gris_cendre: {
    id: 'gris_cendre',
    label: 'Gris cendre blanc',
    color: '#d4d0c8',
    edge: '#a8a49c',
  },
  jaune_orange: {
    id: 'jaune_orange',
    label: 'Jaune orangé clair',
    color: '#e8b86d',
    edge: '#c49448',
  },
}

export const DEFAULT_PANNEAU_COULEUR = 'gris_cendre'
export const DEFAULT_FINITION_OSSATURE = 'brut'

export default {
  LARGEUR_ARETE,
  HAUTEUR_ARETE,
  TOLERANCE,
  EPAISSEUR_PANNEAU,
  EPAISSEUR_PORTE,
  ANGLE_GEOMETRIE,
}
