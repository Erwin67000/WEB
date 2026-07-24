/**
 * master_input.js
 * Snapshot complet du configurateur → tableau CSV téléchargeable.
 *
 * Contient :
 *  - date / réf devis / client (matrice_client)
 *  - paramètres panel (dims, finition, épaisseurs, env…)
 *  - toggles panneaux (true/false)
 *  - modules d’agencement (tablette, tiroir — la porte = panneau "porte")
 *  - positions 3D ossature + points des panneaux
 */
import { buildGeometrie } from '../1_STRUCTURE/00_matrice/matrice_geometrie.js'
import {
  PANNEAU_DEFS,
  computeQuatreRectangles,
} from '../1_STRUCTURE/00_matrice/matrice_panneau_grok.js'
import {
  EPAISSEUR_PANNEAU,
  EPAISSEUR_PORTE,
  TOLERANCE,
  DECALAGE_PANNEAU,
} from '../1_STRUCTURE/00_matrice/matrice_constante.js'
import { CLIENT_FIELDS } from './matrice_client.js'

/** Épaisseurs (mm) — figées à 14. */
export const EPAISSEURS_PANNEAU = [14]
export const EPAISSEURS_PORTE = [14]

/** Tous les noms de panneaux connus (ordre stable pour CSV / toggles). */
export const PANNEAU_KEYS = [
  'fond',
  'porte',
  'dessous',
  'dessus_interieur',
  'dessus_exterieur',
  'joue1',
  'joue2',
]

/**
 * Map toggles : chaque panneau → true/false selon la sélection unit.
 * @param {string[]} selected
 */
export function panneauToggles(selected = []) {
  const set = new Set(selected)
  const out = {}
  for (const key of PANNEAU_KEYS) {
    out[key] = set.has(key)
  }
  return out
}

/**
 * Construit le snapshot master_input depuis l’état store (ou objet compatible).
 * @param {object} state — useConfigStore.getState()
 */
export function buildMasterInput(state) {
  const date = new Date().toISOString()
  const quoteRef = state.quoteRef || ''
  const contact = state.contact || {}
  const clientId =
    contact.clientId ||
    [contact.email, contact.lastName, contact.firstName]
      .filter(Boolean)
      .join('|') ||
    ''

  const epaisseur_panneau = Number(
    state.epaisseurPanneau ?? EPAISSEUR_PANNEAU,
  )
  const epaisseur_porte = Number(state.epaisseurPorte ?? EPAISSEUR_PORTE)

  const units = (state.units || []).map((unit, index) => {
    const dims = unit.dims
    const { vertices, byId, aretes } = buildGeometrie(dims)
    const toggles = panneauToggles(unit.panneaux || [])

    // Points ossature par arête
    const ossature = {}
    for (const a of aretes) {
      ossature[a.id] = a.points.map((p) => [...p])
    }

    // Points des panneaux sélectionnés (et structure complète pour debug)
    const panneauxPoints = {}
    for (const key of PANNEAU_KEYS) {
      if (!PANNEAU_DEFS[key]) continue
      const def = PANNEAU_DEFS[key]
      const ep =
        key === 'porte' ? epaisseur_porte : epaisseur_panneau
      const rects = computeQuatreRectangles(def, byId, {
        epaisseur: ep,
        tolerance: TOLERANCE,
        decalage: DECALAGE_PANNEAU,
      })
      panneauxPoints[key] = {
        selected: toggles[key],
        base: rects.base,
        decale: rects.decale,
        tolerance: rects.tolerance,
        arriere: rects.arriere,
      }
    }

    // Modules : tablette / tiroir (+ zMm tablette)
    const modules = (unit.modules || [])
      .filter((m) => m.kind !== 'door')
      .map((m) => ({
        id: m.id,
        kind: m.kind,
        bayIndex: m.bayIndex ?? 0,
        openFactor: m.openFactor ?? 0,
        zMm: m.zMm ?? null,
      }))

    return {
      index,
      id: unit.id,
      label: unit.label,
      dims: { ...dims },
      positionMm: { ...(unit.positionMm || { x: 0, y: 0, z: 0 }) },
      rotationZ: unit.rotationZ ?? 0,
      woodFinish: unit.woodFinish || 'chene',
      ossatureFinish: unit.ossatureFinish || 'brut',
      ossatureFinitionNote: unit.ossatureFinitionNote || '',
      panneauCouleur: unit.panneauCouleur || 'gris_cendre',
      panneaux: toggles,
      modules,
      ossature_vertices: vertices,
      ossature_by_arete: ossature,
      panneaux_points: panneauxPoints,
    }
  })

  return {
    schema: 'philae-master-input-v2',
    date,
    quoteRef,
    clientId,
    client: { ...contact },
    epaisseur_panneau,
    epaisseur_porte,
    tolerance: TOLERANCE,
    decalage: DECALAGE_PANNEAU,
    environmentId: state.environmentId || 'none',
    notes: state.notes || '',
    units,
  }
}

/** Échappe une cellule CSV. */
function csvCell(v) {
  if (v == null) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/**
 * Convertit le master_input en lignes CSV (plusieurs sections via colonne `section`).
 * @param {ReturnType<typeof buildMasterInput>} master
 * @returns {string}
 */
export function masterInputToCsv(master) {
  const rows = []
  const header = [
    'section',
    'unit_index',
    'unit_id',
    'key',
    'subkey',
    'index',
    'x',
    'y',
    'z',
    'value',
  ]
  rows.push(header.join(','))

  const push = (section, unitIndex, unitId, key, subkey, index, x, y, z, value) => {
    rows.push(
      [
        section,
        unitIndex ?? '',
        unitId ?? '',
        key ?? '',
        subkey ?? '',
        index ?? '',
        x ?? '',
        y ?? '',
        z ?? '',
        value ?? '',
      ]
        .map(csvCell)
        .join(','),
    )
  }

  // --- META ---
  push('meta', '', '', 'date', '', '', '', '', '', master.date)
  push('meta', '', '', 'quoteRef', '', '', '', '', '', master.quoteRef)
  push('meta', '', '', 'clientId', '', '', '', '', '', master.clientId)
  push('meta', '', '', 'epaisseur_panneau', '', '', '', '', '', master.epaisseur_panneau)
  push('meta', '', '', 'epaisseur_porte', '', '', '', '', '', master.epaisseur_porte)
  push('meta', '', '', 'tolerance', '', '', '', '', '', master.tolerance)
  push('meta', '', '', 'decalage', '', '', '', '', '', master.decalage)
  push('meta', '', '', 'environmentId', '', '', '', '', '', master.environmentId)
  push('meta', '', '', 'notes', '', '', '', '', '', master.notes)

  // --- CLIENT (matrice_client) ---
  for (const f of CLIENT_FIELDS) {
    push(
      'client',
      '',
      '',
      f.key,
      '',
      '',
      '',
      '',
      '',
      master.client?.[f.key] ?? '',
    )
  }

  // --- UNITS ---
  for (const u of master.units) {
    push('unit', u.index, u.id, 'label', '', '', '', '', '', u.label)
    push('unit', u.index, u.id, 'L', '', '', '', '', '', u.dims.L)
    push('unit', u.index, u.id, 'W', '', '', '', '', '', u.dims.W)
    push('unit', u.index, u.id, 'H', '', '', '', '', '', u.dims.H)
    push('unit', u.index, u.id, 'pos_x', '', '', '', '', '', u.positionMm.x)
    push('unit', u.index, u.id, 'pos_y', '', '', '', '', '', u.positionMm.y)
    push('unit', u.index, u.id, 'pos_z', '', '', '', '', '', u.positionMm.z)
    push('unit', u.index, u.id, 'rotationZ', '', '', '', '', '', u.rotationZ)
    push('unit', u.index, u.id, 'woodFinish', '', '', '', '', '', u.woodFinish)
    push(
      'unit',
      u.index,
      u.id,
      'ossatureFinish',
      '',
      '',
      '',
      '',
      '',
      u.ossatureFinish || 'brut',
    )
    push(
      'unit',
      u.index,
      u.id,
      'ossatureFinitionNote',
      '',
      '',
      '',
      '',
      '',
      u.ossatureFinitionNote || '',
    )
    push(
      'unit',
      u.index,
      u.id,
      'panneauCouleur',
      '',
      '',
      '',
      '',
      '',
      u.panneauCouleur || 'gris_cendre',
    )

    // toggles panneaux
    for (const [pkey, val] of Object.entries(u.panneaux)) {
      push(
        'panneau_toggle',
        u.index,
        u.id,
        pkey,
        '',
        '',
        '',
        '',
        '',
        val ? 'true' : 'false',
      )
    }

    // modules (tablette / tiroir + zMm)
    u.modules.forEach((m, mi) => {
      push('module', u.index, u.id, m.kind, 'id', mi, '', '', '', m.id)
      push(
        'module',
        u.index,
        u.id,
        m.kind,
        'bayIndex',
        mi,
        '',
        '',
        '',
        m.bayIndex,
      )
      push(
        'module',
        u.index,
        u.id,
        m.kind,
        'openFactor',
        mi,
        '',
        '',
        '',
        m.openFactor,
      )
      if (m.kind === 'shelf') {
        push(
          'module',
          u.index,
          u.id,
          m.kind,
          'zMm',
          mi,
          '',
          '',
          '',
          m.zMm ?? '',
        )
      }
    })

    // points ossature par arête
    for (const [areteId, pts] of Object.entries(u.ossature_by_arete)) {
      pts.forEach((p, pi) => {
        push(
          'ossature_point',
          u.index,
          u.id,
          areteId,
          '',
          pi,
          p[0],
          p[1],
          p[2],
          '',
        )
      })
    }

    // points panneaux (4 rectangles × 4 coins)
    for (const [pname, pdata] of Object.entries(u.panneaux_points)) {
      push(
        'panneau_meta',
        u.index,
        u.id,
        pname,
        'selected',
        '',
        '',
        '',
        '',
        pdata.selected ? 'true' : 'false',
      )
      for (const layer of ['base', 'decale', 'tolerance', 'arriere']) {
        const pts = pdata[layer] || []
        pts.forEach((p, pi) => {
          push(
            'panneau_point',
            u.index,
            u.id,
            pname,
            layer,
            pi,
            p[0],
            p[1],
            p[2],
            '',
          )
        })
      }
    }
  }

  return rows.join('\n')
}

/**
 * Télécharge le CSV master_input dans le navigateur.
 * @param {object} state — getState() du store
 * @param {string} [filename]
 */
export function downloadMasterInputCsv(state, filename) {
  const master = buildMasterInput(state)
  const csv = masterInputToCsv(master)
  const name =
    filename ||
    `philae-master-input-${master.quoteRef || Date.now()}.csv`
  const blob = new Blob(['\uFEFF' + csv], {
    type: 'text/csv;charset=utf-8',
  })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
  return master
}

/**
 * Export JSON master (optionnel, même snapshot).
 */
export function downloadMasterInputJson(state, filename) {
  const master = buildMasterInput(state)
  const name =
    filename ||
    `philae-master-input-${master.quoteRef || Date.now()}.json`
  const blob = new Blob([JSON.stringify(master, null, 2)], {
    type: 'application/json',
  })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
  return master
}

export default {
  EPAISSEURS_PANNEAU,
  EPAISSEURS_PORTE,
  PANNEAU_KEYS,
  panneauToggles,
  buildMasterInput,
  masterInputToCsv,
  downloadMasterInputCsv,
  downloadMasterInputJson,
}
