/**
 * Dictionnaire des champs de publipostage devis.
 * Utilisés dans le template Word : {nom_du_champ}
 * (syntaxe docxtemplater — accolades simples).
 *
 * Quand vous ajoutez une balise dans Word, utilisez EXACTEMENT
 * un des identifiants de la colonne « tag » ci-dessous.
 */

import {
  FINITIONS_OSSATURE,
} from '../../1_STRUCTURE/00_matrice/matrice_constante.js'

/** Description documentée des champs (guide + validation). */
export const MERGE_FIELD_DEFS = [
  // —— Devis / méta ——
  { tag: 'quote_ref', group: 'devis', label: 'Référence devis' },
  { tag: 'date_devis', group: 'devis', label: 'Date du devis' },
  { tag: 'date_iso', group: 'devis', label: 'Date ISO' },
  { tag: 'notes', group: 'devis', label: 'Notes client' },

  // —— Client ——
  { tag: 'client_prenom', group: 'client', label: 'Prénom' },
  { tag: 'client_nom', group: 'client', label: 'Nom' },
  { tag: 'client_fullname', group: 'client', label: 'Nom complet' },
  { tag: 'client_email', group: 'client', label: 'E-mail' },
  { tag: 'client_tel', group: 'client', label: 'Téléphone' },
  { tag: 'client_adresse', group: 'client', label: 'Adresse ligne 1' },
  { tag: 'client_adresse2', group: 'client', label: 'Complément' },
  { tag: 'client_cp', group: 'client', label: 'Code postal' },
  { tag: 'client_ville', group: 'client', label: 'Ville' },
  { tag: 'client_pays', group: 'client', label: 'Pays' },
  { tag: 'client_id', group: 'client', label: 'ID client' },

  // —— Meuble principal (1er / actif) ——
  { tag: 'meuble_label', group: 'meuble', label: 'Libellé meuble' },
  { tag: 'meuble_L', group: 'meuble', label: 'Longueur mm' },
  { tag: 'meuble_W', group: 'meuble', label: 'Profondeur mm' },
  { tag: 'meuble_H', group: 'meuble', label: 'Hauteur mm' },
  { tag: 'meuble_dims', group: 'meuble', label: 'L × P × H (texte)' },
  { tag: 'meuble_finition', group: 'meuble', label: 'Finition ossature (libellé)' },
  { tag: 'meuble_finition_id', group: 'meuble', label: 'Finition id' },
  { tag: 'meuble_panneaux', group: 'meuble', label: 'Liste panneaux' },
  { tag: 'meuble_modules', group: 'meuble', label: 'Liste aménagements' },
  { tag: 'epaisseur_panneau', group: 'meuble', label: 'Épaisseur panneau mm' },
  { tag: 'epaisseur_porte', group: 'meuble', label: 'Épaisseur porte mm' },

  // —— Prix ——
  { tag: 'prix_ht', group: 'prix', label: 'Total HT (€)' },
  { tag: 'prix_tva', group: 'prix', label: 'TVA (€)' },
  { tag: 'prix_ttc', group: 'prix', label: 'Total TTC (€)' },
  { tag: 'prix_modele3d', group: 'prix', label: 'Prix modèle 3D HT' },

  // —— Boucles (tableaux docxtemplater) ——
  // {#meubles} … {/meubles}  et  {#lignes} … {/lignes}
  {
    tag: 'meubles',
    group: 'boucles',
    label: 'Liste des meubles (boucle)',
    isLoop: true,
  },
  {
    tag: 'lignes',
    group: 'boucles',
    label: 'Lignes de prix détaillées (boucle)',
    isLoop: true,
  },
]

/**
 * Construit l’objet de données pour docxtemplater
 * à partir de l’état store + pricing.
 */
export function buildMergeData(state, pricing) {
  const contact = state.contact || {}
  const units = state.units || []
  const active =
    units.find((u) => u.id === state.activeUnitId) || units[0] || null
  const finishId = active?.ossatureFinish || 'brut'
  const finishLabel =
    FINITIONS_OSSATURE[finishId]?.label || finishId

  const euro = (n) =>
    Number(n || 0).toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const dateDevis = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`

  const meubles = units.map((u, i) => {
    const fId = u.ossatureFinish || 'brut'
    return {
      index: i + 1,
      label: u.label || `Meuble ${i + 1}`,
      L: u.dims?.L ?? '',
      W: u.dims?.W ?? '',
      H: u.dims?.H ?? '',
      dims: `${u.dims?.L ?? '—'} × ${u.dims?.W ?? '—'} × ${u.dims?.H ?? '—'} mm`,
      finition: FINITIONS_OSSATURE[fId]?.label || fId,
      finition_id: fId,
      panneaux: (u.panneaux || []).join(', ') || 'aucun',
      modules: (u.modules || [])
        .map((m) => m.kind)
        .join(', ') || 'aucun',
    }
  })

  /** Lignes prix pour tableau Word {#lignes}…{/lignes} */
  const lignes = []
  for (const line of pricing?.lines || []) {
    lignes.push({
      type: 'Ossature',
      designation: `${line.label} — ossature`,
      detail: `${line.ossature.longueurM.toFixed(2)} m`,
      qte: 1,
      pu: euro(line.ossature.total),
      total: euro(line.ossature.total),
    })
    for (const p of line.panneaux || []) {
      lignes.push({
        type: 'Panneau',
        designation: `${line.label} — ${p.label}`,
        detail: `${p.surfaceM2.toFixed(3)} m²`,
        qte: 1,
        pu: euro(p.total),
        total: euro(p.total),
      })
    }
    for (const m of line.modules || []) {
      lignes.push({
        type: 'Aménagement',
        designation: `${line.label} — ${m.label}`,
        detail: m.surfaceM2 ? `${m.surfaceM2.toFixed(3)} m²` : '',
        qte: 1,
        pu: euro(m.total),
        total: euro(m.total),
      })
    }
  }

  return {
    quote_ref: state.quoteRef || '',
    date_devis: dateDevis,
    date_iso: now.toISOString().slice(0, 10),
    notes: state.notes || '',

    client_prenom: contact.firstName || '',
    client_nom: contact.lastName || '',
    client_fullname: [contact.firstName, contact.lastName]
      .filter(Boolean)
      .join(' '),
    client_email: contact.email || '',
    client_tel: contact.phone || '',
    client_adresse: contact.addressLine1 || '',
    client_adresse2: contact.addressLine2 || '',
    client_cp: contact.postalCode || '',
    client_ville: contact.city || '',
    client_pays: contact.country || 'FR',
    client_id: contact.clientId || '',

    meuble_label: active?.label || '',
    meuble_L: active?.dims?.L ?? '',
    meuble_W: active?.dims?.W ?? '',
    meuble_H: active?.dims?.H ?? '',
    meuble_dims: active
      ? `${active.dims.L} × ${active.dims.W} × ${active.dims.H} mm`
      : '',
    meuble_finition: finishLabel,
    meuble_finition_id: finishId,
    meuble_panneaux: (active?.panneaux || []).join(', ') || 'aucun',
    meuble_modules:
      (active?.modules || []).map((m) => m.kind).join(', ') || 'aucun',
    epaisseur_panneau: state.epaisseurPanneau ?? '',
    epaisseur_porte: state.epaisseurPorte ?? '',

    prix_ht: euro(pricing?.ht),
    prix_tva: euro(pricing?.tva),
    prix_ttc: euro(pricing?.ttc),
    prix_modele3d: euro(pricing?.modele3d),

    meubles,
    lignes,
  }
}
