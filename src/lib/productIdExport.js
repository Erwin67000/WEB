/**
 * Fiche produit ProductID.xlsx — remplie depuis la configuration.
 * Une feuille par meuble + feuille « atelier » (détail usinage / Würth).
 */
import * as XLSX from 'xlsx'
import PizZip from 'pizzip'
import {
  ATELIER_COLUMNS,
  buildAtelierRows,
} from './atelierExport.js'
import { computePricing } from '../store/createConfigStore.js'
import { outsideDimensions } from '../1_STRUCTURE/00_matrice/matrice_geometrie.js'
import {
  TVA,
  EPAISSEUR_PANNEAU,
  DRAWER_FACADE_DOWN_EXTEND_MM,
} from '../1_STRUCTURE/00_matrice/matrice_constante.js'
import {
  moduleLayout,
  buildTiroir,
  resolveTabletteOctogone,
} from '../1_STRUCTURE/02_agencement/agencement.js'

/** face atelier → colonnes Length/Width (1-indexed Excel col) — Panel1 = ligne 34 */
const FACE_COLS = {
  porte: [2, 3],
  fond: [4, 5],
  joue1: [6, 7],
  joue2: [8, 9],
  dessus_exterieur: [10, 11],
  dessus: [10, 11],
  dessous: [12, 13],
}

const PANEL_FIRST_ROW = 34
const DRAWER_FIRST_ROW = 23
const DRAWER_MAX = 6

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

function aabb(points) {
  if (!points?.length) return null
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const p of points) {
    const x = Number(p[0])
    const y = Number(p[1])
    const z = Number(p[2])
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
    if (z < minZ) minZ = z
    if (z > maxZ) maxZ = z
  }
  return { dx: maxX - minX, dy: maxY - minY, dz: maxZ - minZ }
}

/** Plateau octogone : emprise complète (pas L−2×inset). */
function shelfFootprint(dims) {
  try {
    const pts = resolveTabletteOctogone(dims, 0)
    const box = aabb(pts)
    if (box) return { length: mm(box.dx), width: mm(box.dy) }
  } catch {
    /* fallback L × P */
  }
  return { length: mm(dims.L), width: mm(dims.W ?? dims.P) }
}

/** Façade tiroir réelle (largeur × hauteur), depuis le solide. */
function drawerFacadeSize(unit, mod, modules) {
  const dims = unit.dims
  const layout = moduleLayout(mod, dims, modules)
  const h = Number(layout.hMm) || 0
  const fallbackH =
    (layout.facadeBas ? h : h + (Number(DRAWER_FACADE_DOWN_EXTEND_MM) || 15)) +
    (layout.isLastDrawer ? Number(EPAISSEUR_PANNEAU) || 15 : 0)
  try {
    const data = buildTiroir(dims, layout, mod, {
      epaisseurMm: EPAISSEUR_PANNEAU,
    })
    if (data?.lwkOutOfRange || data?.depthTooSmall) {
      return { width: mm(dims.L), height: mm(fallbackH) }
    }
    const facade = (data.box?.panels || []).find(
      (p) => p.id === 'facade' || p.nom === 'facade',
    )
    const box = aabb(facade?.points || facade?.panneau?.points)
    if (box && box.dx > 0 && box.dz > 0) {
      return { width: mm(box.dx), height: mm(box.dz) }
    }
  } catch {
    /* fallback */
  }
  return { width: mm(dims.L), height: mm(fallbackH) }
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
  const modules = unit.modules || []
  const drawerMods = modules.filter((m) => m.kind === 'drawer')
  const shelfMods = modules.filter((m) => m.kind === 'shelf')

  const ofUnit = atelierRows.filter(
    (r) => r.ligne !== 'meta' && String(r.meuble_index) === String(unitIndex),
  )
  const drawers = ofUnit.filter((r) => r.ligne === 'tiroir')
  const shelves = ofUnit.filter((r) => r.ligne === 'tablette')
  const panels = ofUnit.filter(
    (r) => r.ligne === 'panneau' || r.ligne === 'porte',
  )

  setCell(ws, 'C3', sku)
  setCell(ws, 'C4', unit.label || unit.id || `Meuble ${unitIndex + 1}`)

  setCell(ws, 'B7', contact.firstName || '')
  setCell(ws, 'D7', contact.lastName || '')
  setCell(ws, 'B8', contact.email || '')
  setCell(ws, 'D8', phone.indicatif)
  setCell(ws, 'F8', phone.number)
  setCell(
    ws,
    'B9',
    [contact.addressLine1, contact.addressLine2].filter(Boolean).join(' '),
  )
  setCell(ws, 'D9', contact.postalCode || '')
  setCell(ws, 'F9', contact.city || '')
  setCell(ws, 'H9', contact.country || '')
  setCell(ws, 'B10', contact.siret || '')
  setCell(ws, 'D10', contact.tva || '')

  setCell(ws, 'B14', mm(L))
  setCell(ws, 'C14', mm(ext.Lreel))
  setCell(ws, 'B15', mm(P))
  setCell(ws, 'C15', mm(ext.Wreel))
  setCell(ws, 'B16', mm(H))
  setCell(ws, 'C16', mm(ext.Hreel))

  const firstDrawer = drawers[0]
  if (firstDrawer) {
    setCell(ws, 'B20', firstDrawer.lwk_mm)
    setCell(ws, 'B21', firstDrawer.lic_mm)
  }

  drawerMods.slice(0, DRAWER_MAX).forEach((mod, i) => {
    const row = DRAWER_FIRST_ROW + i
    const layout = moduleLayout(mod, dims, modules)
    const info = drawers[i]
    const h = mm(info?.wurth_h_mm || info?.h_mm || layout.hMm)
    const facade = drawerFacadeSize(unit, mod, modules)
    setCell(ws, colRow(2, row), h)
    setCell(ws, colRow(3, row), facade.height)
    setCell(ws, colRow(4, row), facade.width)
  })

  const shelfSize = shelfFootprint({ L, W: P, H })
  setCell(ws, 'H19', shelfMods.length)
  setCell(ws, 'H20', shelfSize.length)
  setCell(ws, 'H21', shelfSize.width)
  if (shelves.length) {
    setCell(ws, 'G22', 'Z')
    setCell(ws, 'H22', shelves.map((s) => s.z_haut_mm).join(' | '))
    setCell(ws, 'I22', 'mm')
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
      const row = PANEL_FIRST_ROW + i
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
  setCell(ws, 'B47', options)

  const line = pricing?.lines?.[unitIndex]
  const ht = line?.ht ?? pricing?.ht
  const tvaAmt = ht != null ? ht * TVA : pricing?.tva
  const ttc = ht != null ? ht * (1 + TVA) : pricing?.ttc
  setCell(ws, 'B50', euro(ht))
  setCell(ws, 'C50', '€ HT')
  setCell(ws, 'B51', euro(ttc))
  setCell(ws, 'C51', '€ TTC')
  setCell(ws, 'B52', euro(tvaAmt))
  setCell(ws, 'C52', `€ (${Math.round(TVA * 100)} %)`)
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

  const filledB64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' })
  return restoreTemplateLogo(templateBuf, filledB64)
}

/**
 * SheetJS retire les images. On recopie logo + drawing du modèle
 * dans le xlsx rempli (media, drawings, rels, Content_Types).
 */
function restoreTemplateLogo(templateBuf, filledB64) {
  const src = new PizZip(templateBuf)
  const dst = new PizZip(Buffer.from(filledB64, 'base64'))

  for (const name of Object.keys(src.files)) {
    if (name.endsWith('/')) continue
    if (name.startsWith('xl/media/') || name.startsWith('xl/drawings/')) {
      dst.file(name, src.file(name).asUint8Array())
    }
  }

  let ctypes = dst.file('[Content_Types].xml')?.asText() || ''
  if (ctypes && !/Extension="png"/.test(ctypes)) {
    ctypes = ctypes.replace(
      '</Types>',
      '<Default ContentType="image/png" Extension="png"/></Types>',
    )
  }
  if (ctypes && !/drawings\/drawing1\.xml/.test(ctypes)) {
    ctypes = ctypes.replace(
      '</Types>',
      '<Override ContentType="application/vnd.openxmlformats-officedocument.drawing+xml" PartName="/xl/drawings/drawing1.xml"/></Types>',
    )
  }
  if (ctypes) dst.file('[Content_Types].xml', ctypes)

  const relsPath = 'xl/worksheets/_rels/sheet1.xml.rels'
  const srcRels = src.file(relsPath)
  if (srcRels) dst.file(relsPath, srcRels.asText())

  const sheetPath = 'xl/worksheets/sheet1.xml'
  const sheetFile = dst.file(sheetPath)
  if (sheetFile) {
    let sheet = sheetFile.asText()
    if (!/<drawing[\s>]/.test(sheet)) {
      if (!/xmlns:r=/.test(sheet)) {
        sheet = sheet.replace(
          /<worksheet\b/,
          '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
        )
      }
      sheet = sheet.replace(
        '</worksheet>',
        '<drawing r:id="rId1"/></worksheet>',
      )
      dst.file(sheetPath, sheet)
    }
  }

  const out = dst.generate({ type: 'uint8array', compression: 'DEFLATE' })
  return Buffer.from(out).toString('base64')
}

export default { buildProductIdBase64 }
