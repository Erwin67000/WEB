/**
 * Recalcule price_furniture_ttc_eur pour chaque ligne de
 * public/catalogue/matrice_catalogue.xlsx selon PRIX.
 *
 * Usage: node scripts/recalc-catalogue-prices.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
import {
  parseMatriceCatalogue,
  parseMatriceCatalogueWorkbook,
  CATALOGUE_COLUMNS,
} from '../src/1_STRUCTURE/00_matrice/matrice_catalogue.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const xlsxPath = path.join(root, 'public/catalogue/matrice_catalogue.xlsx')
const csvPath = path.join(root, 'public/catalogue/matrice_catalogue.csv')

const TVA = 0.2
const PRIX = {
  ossatureForfait: 900,
  ossatureParMetre: 50,
  panneauForfait: 50,
  panneauParM2: 100,
  tabletteForfait: 50,
  tabletteParM2: 100,
  tiroirForfait: 250,
  tiroirParM3: 1000,
  tiroirHauteurDefautMm: 200,
  porteForfait: 250,
  porteParM2: 100,
  modele3d: 45,
}

function panneauSurfaceM2(nom, dims) {
  const { L, W, H } = dims
  if (nom === 'fond' || nom === 'porte') return (L * H) / 1e6
  if (nom === 'joue1' || nom === 'joue2') return (W * H) / 1e6
  if (
    nom === 'dessus' ||
    nom === 'dessus_interieur' ||
    nom === 'dessus_exterieur' ||
    nom === 'dessous'
  ) {
    return (L * W) / 1e6
  }
  return (L * H) / 1e6
}

function parseModules(spec) {
  if (!spec?.trim()) return []
  const out = []
  for (const part of String(spec).split('|')) {
    const [kindRaw, countStr] = part.split(':')
    const kind = (kindRaw || '').trim().toLowerCase()
    if (!kind) continue
    const n = Math.max(1, Number(countStr) || 1)
    for (let i = 0; i < n; i++) out.push({ kind })
  }
  return out
}

function modulePrice(m, dims) {
  const shelfArea = (dims.L * dims.W) / 1e6
  if (m.kind === 'shelf') {
    return PRIX.tabletteForfait + shelfArea * PRIX.tabletteParM2
  }
  if (m.kind === 'drawer') {
    const h = PRIX.tiroirHauteurDefautMm
    const vol = (dims.L * dims.W * h) / 1e9
    return PRIX.tiroirForfait + vol * PRIX.tiroirParM3
  }
  if (m.kind === 'door') {
    return PRIX.porteForfait + ((dims.L * dims.H) / 1e6) * PRIX.porteParM2
  }
  return 0
}

function unitHt(row) {
  const dims = {
    L: Number(row.L_mm) || 0,
    W: Number(row.W_mm) || 0,
    H: Number(row.H_mm) || 0,
  }
  const longueurM = (4 * (dims.L + dims.W + dims.H)) / 1000
  const ossature = PRIX.ossatureForfait + longueurM * PRIX.ossatureParMetre
  const panneaux = String(row.panneaux || '')
    .split(/[|;,/]+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const panTotal = panneaux.reduce(
    (s, nom) =>
      s + PRIX.panneauForfait + panneauSurfaceM2(nom, dims) * PRIX.panneauParM2,
    0,
  )
  const modTotal = parseModules(row.modules)
    .map((m) => modulePrice(m, dims))
    .reduce((a, b) => a + b, 0)
  return ossature + panTotal + modTotal
}

function loadRawSheet() {
  if (fs.existsSync(xlsxPath)) {
    const wb = XLSX.read(fs.readFileSync(xlsxPath), { type: 'buffer' })
    const name =
      wb.SheetNames.find((n) => /catalogue/i.test(n)) || wb.SheetNames[0]
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], {
      defval: '',
      raw: false,
    })
    return { kind: 'xlsx', rows, wb, sheetName: name }
  }
  if (fs.existsSync(csvPath)) {
    const text = fs.readFileSync(csvPath, 'utf8')
    const parsed = parseMatriceCatalogue(text)
    // re-read as objects for write
    const wb = XLSX.read(text, { type: 'string' })
    const name = wb.SheetNames[0]
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], {
      defval: '',
      raw: false,
    })
    return { kind: 'csv', rows, wb, sheetName: name }
  }
  console.error('Catalogue introuvable (xlsx/csv)')
  process.exit(1)
}

const { rows } = loadRawSheet()
const report = []
const updated = rows.map((obj) => {
  const ht = unitHt(obj)
  const ttc = Math.round(ht * (1 + TVA))
  const old = Number(obj.price_furniture_ttc_eur) || 0
  report.push({
    id: obj.id,
    old,
    new: ttc,
    delta: ttc - old,
    ht: Math.round(ht * 100) / 100,
  })
  return {
    ...obj,
    price_furniture_ttc_eur: ttc,
    price_model3d_ht_eur: PRIX.modele3d,
  }
})

// Écriture xlsx (ordre de colonnes stable)
const ordered = updated.map((r) => {
  const o = {}
  for (const c of CATALOGUE_COLUMNS) {
    if (r[c] !== undefined) o[c] = r[c]
  }
  // conserver colonnes extras
  for (const k of Object.keys(r)) {
    if (!(k in o)) o[k] = r[k]
  }
  return o
})

const sheet = XLSX.utils.json_to_sheet(ordered)
const out = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(out, sheet, 'catalogue')
XLSX.writeFile(out, xlsxPath)

console.table(report)
console.log(
  `\n${report.length} configurations → ${path.relative(root, xlsxPath)}`,
)
