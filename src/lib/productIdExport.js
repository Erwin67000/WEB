/**
 * Fiche produit ProductID.xlsx — remplie depuis la configuration.
 * Une feuille par meuble + feuille « atelier » (détail usinage / Würth).
 */
import * as XLSX from 'xlsx'
import {
  ATELIER_COLUMNS,
  buildAtelierRows,
} from './atelierExport.js'
import { computePricing } from '../store/createConfigStore.js'
import { outsideDimensions } from '../1_STRUCTURE/00_matrice/matrice_geometrie.js'
import { TVA } from '../1_STRUCTURE/00_matrice/matrice_constante.js'

const DRAWER_H_ROWS = {
  58: 24,
  84: 25,
  110: 26,
  136: 27,
  188: 28,
  214: 29,
  240: 30,
  266: 31,
}

/** face atelier → colonnes Length/Width (1-indexed Excel col) */
const FACE_COLS = {
  porte: [2, 3],
  fond: [4, 5],
  joue1: [6, 7],
  joue2: [8, 9],
  dessus_exterieur: [10, 11],
  dessus: [10, 11],
  dessous: [12, 13],
}

function mm(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return ''
  const r = Math.round(v * 10) / 10
  return Object.is(r, -0) ? 0 : r
}

function setCell(ws, addr, value) {
  if (value == null || value === '') return
  const prev = ws[addr] || {}
  const t = typeof value === 'number' ? 'n' : 's'
  ws[addr] = { ...prev, t, v: value }
}

function colRow(c, r) {
  return XLSX.utils.encode_cell({ c: c - 1, r: r - 1 })
}

function splitPhone(phone) {
  const s = String(phone || '').trim()
  if (!s) return { indicatif: '', number: '' }
  const m = s.match(/^(\+\d{1,4})\s*(.*)$/)
  if (m) return { indicatif: m[1], number: m[2].trim() }
  if (s.startsWith('00')) {
    const rest = s.slice(2)
    const m2 = rest.match(/^(\d{1,3})\s*(.*)$/)
    if (m2) return { indicatif: `+${m2[1]}`, number: m2[2].trim() }
  }
  if (s.startsWith('0')) return { indicatif: '+33', number: s.replace(/^0/, '') }
  return { indicatif: '', number: s }
}

function euro(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return ''
  return Math.round(v * 100) / 100
}

function cloneSheet(ws) {
  return JSON.parse(JSON.stringify(ws))
}

function fillUnitSheet(ws, state, unit, unitIndex, atelierRows, pricing) {
  const contact = state.contact || {}
  const dims = unit.dims || {}
  const L = Number(dims.L) || 0
  const P = Number(dims.W ?? dims.P) || 0
  const H = Number(dims.H) || 0
  const ext = outsideDimensions({ L, W: P, H })
  const quoteRef = state.quoteRef || ''
  const sku = state.catalogProductId || `PHL-${quoteRef || unit.id || unitIndex + 1}`
  const phone = splitPhone(contact.phone)

  const ofUnit = atelierRows.filter(
    (r) => r.ligne !== 'meta' && String(r.meuble_index) === String(unitIndex),
  )
  const drawers = ofUnit.filter((r) => r.ligne === 'tiroir')
  const shelves = ofUnit.filter((r) => r.ligne === 'tablette')
  const panels = ofUnit.filter(
    (r) => r.ligne === 'panneau' || r.ligne === 'porte',
  )

  setCell(ws, 'B4', sku)
  setCell(ws, 'B5', unit.label || unit.id || `Meuble ${unitIndex + 1}`)

  setCell(ws, 'B8', contact.firstName || '')
  setCell(ws, 'D8', contact.lastName || '')
  setCell(ws, 'B9', contact.email || '')
  setCell(ws, 'D9', phone.indicatif)
  setCell(ws, 'F9', phone.number)
  setCell(
    ws,
    'B10',
    [contact.addressLine1, contact.addressLine2].filter(Boolean).join(' '),
  )
  setCell(ws, 'D10', contact.postalCode || '')
  setCell(ws, 'F10', contact.city || '')
  setCell(ws, 'H10', contact.country || '')
  setCell(ws, 'B11', contact.siret || '')
  setCell(ws, 'D11', contact.tva || '')

  setCell(ws, 'B14', mm(L))
  setCell(ws, 'B15', mm(P))
  setCell(ws, 'B16', mm(H))
  setCell(ws, 'E14', mm(ext.Lreel))
  setCell(ws, 'F14', 'hors-tout')
  setCell(ws, 'E15', mm(ext.Wreel))
  setCell(ws, 'F15', 'hors-tout')
  setCell(ws, 'E16', mm(ext.Hreel))
  setCell(ws, 'F16', 'hors-tout')

  const firstDrawer = drawers[0]
  if (firstDrawer) {
    setCell(ws, 'D21', firstDrawer.lwk_mm)
    setCell(ws, 'B22', firstDrawer.lic_mm)
    setCell(ws, 'F21', mm(L))
    setCell(ws, 'F22', firstDrawer.h_mm)
    if (firstDrawer.notes && /premier|floor|bas/i.test(String(firstDrawer.notes))) {
      setCell(ws, 'H23', 'O')
    }
  }

  const heightCounts = {}
  for (const d of drawers) {
    const h = Math.round(Number(d.wurth_h_mm || d.h_mm) || 0)
    heightCounts[h] = (heightCounts[h] || 0) + 1
  }
  for (const [h, row] of Object.entries(DRAWER_H_ROWS)) {
    const n = heightCounts[Number(h)] || 0
    if (n) {
      setCell(ws, colRow(2, row), n)
      setCell(ws, colRow(6, row), n)
    } else {
      setCell(ws, colRow(2, row), '')
    }
  }
  const otherH = Object.entries(heightCounts).filter(
    ([h]) => DRAWER_H_ROWS[Number(h)] == null,
  )
  if (otherH.length) {
    setCell(
      ws,
      'F23',
      otherH.map(([h, n]) => `${h}×${n}`).join(' | '),
    )
  }

  setCell(ws, 'B33', shelves.length || '')
  if (shelves[0]) {
    setCell(ws, 'B34', shelves[0].L_utile_mm)
    setCell(ws, 'B35', shelves[0].P_utile_mm)
  }
  if (shelves.length) {
    setCell(ws, 'A36', 'Z tablettes')
    setCell(ws, 'B36', shelves.map((s) => s.z_haut_mm).join(' | '))
    setCell(ws, 'C36', 'mm')
  }
  if (drawers.length) {
    setCell(ws, 'A37', 'Z tiroirs')
    setCell(
      ws,
      'B37',
      drawers.map((d) => `${d.z_bas_mm}–${d.z_haut_mm}`).join(' | '),
    )
    setCell(ws, 'C37', 'mm')
  }

  const byFace = new Map()
  for (const p of panels) {
    const face = p.face
    if (!FACE_COLS[face]) continue
    if (!byFace.has(face)) byFace.set(face, [])
    byFace.get(face).push(p)
  }
  for (const [face, list] of byFace) {
    const [cL, cW] = FACE_COLS[face]
    list.slice(0, 10).forEach((p, i) => {
      const row = 41 + i
      const len = p.usinage_L_mm || p.L_utile_mm
      const wid = p.usinage_H_mm || p.h_mm
      setCell(ws, colRow(cL, row), len)
      setCell(ws, colRow(cW, row), wid)
    })
  }

  const hinges = [
    ...new Set(panels.filter((p) => p.ligne === 'porte').map((p) => p.charniere)),
  ]
    .filter(Boolean)
    .join(', ')
  const options = [
    unit.ossatureFinish ? `ossature=${unit.ossatureFinish}` : '',
    unit.panneauCouleur ? `panneau=${unit.panneauCouleur}` : '',
    unit.porteCouleur || unit.panneauCouleur
      ? `porte=${unit.porteCouleur || unit.panneauCouleur}`
      : '',
    hinges ? `charniere=${hinges}` : '',
    quoteRef ? `devis=${quoteRef}` : '',
    state.notes || '',
  ]
    .filter(Boolean)
    .join(' · ')
  setCell(ws, 'B54', options)

  const line = pricing?.lines?.[unitIndex]
  const ht = line?.ht ?? pricing?.ht
  const tvaAmt = ht != null ? ht * TVA : pricing?.tva
  const ttc = ht != null ? ht * (1 + TVA) : pricing?.ttc
  setCell(ws, 'B58', euro(ttc))
  setCell(ws, 'C58', '€ TTC')
  setCell(ws, 'B59', euro(tvaAmt))
  setCell(ws, 'C59', `€ (${Math.round(TVA * 100)} %)`)
  setCell(ws, 'B60', '')
}

/**
 * @param {object} state store / snapshot
 * @param {ArrayBuffer|Buffer|Uint8Array} templateBuf
 * @returns {string} xlsx en base64
 */
export function buildProductIdBase64(state, templateBuf) {
  const wb = XLSX.read(templateBuf, { type: 'buffer', cellStyles: true })
  const templateName =
    wb.SheetNames.find((n) => /productid/i.test(n)) || wb.SheetNames[0]
  const templateWs = wb.Sheets[templateName]
  if (!templateWs) throw new Error('Feuille ProductID introuvable dans le modèle')

  const units = state.units || []
  const atelierRows = buildAtelierRows(state)
  let pricing = null
  try {
    pricing = computePricing(units)
  } catch {
    pricing = null
  }

  units.forEach((unit, i) => {
    const ws = cloneSheet(templateWs)
    fillUnitSheet(ws, state, unit, i, atelierRows, pricing)
    const sheetName =
      i === 0
        ? 'ProductID'
        : `ProductID_${i + 1}`.slice(0, 31)
    if (i === 0) wb.Sheets[templateName] = ws
    else XLSX.utils.book_append_sheet(wb, ws, sheetName)
  })

  const detail = [ATELIER_COLUMNS, ...atelierRows.map((r) => ATELIER_COLUMNS.map((h) => r[h] ?? ''))]
  const wsAtelier = XLSX.utils.aoa_to_sheet(detail)
  wsAtelier['!views'] = [{ state: 'frozen', ySplit: 1, topLeftCell: 'A2' }]
  XLSX.utils.book_append_sheet(wb, wsAtelier, 'atelier')

  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' })
}

export default { buildProductIdBase64 }
