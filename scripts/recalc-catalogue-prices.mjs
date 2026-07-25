/**
 * Recalcule price_furniture_ttc_eur pour chaque ligne de
 * public/catalogue/matrice_catalogue.csv selon PRIX (matrice_constante).
 *
 * Formules HT :
 *   ossature = forfait + 4×(L+W+H)/1000 × €/m
 *   panneau  = forfait + surface m² × €/m²
 *   tablette = forfait + L×W m² × €/m²
 *   tiroir   = forfait + L×W×H_tiroir m³ × €/m³  (H défaut 200 mm)
 *   porte    = forfait + L×H m² × €/m²
 * TTC catalogue = round(HT × 1.2)
 *
 * Usage: node scripts/recalc-catalogue-prices.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

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
  piedForfait: 100,
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
    if (!['shelf', 'drawer', 'door', 'pied'].includes(kind)) continue
    const n = Math.max(1, Number(countStr) || 1)
    for (let b = 0; b < n; b++) out.push({ kind })
  }
  return out
}

function parsePanneaux(spec) {
  if (!spec?.trim()) return []
  return String(spec)
    .split(/[|;,/]+/)
    .map((p) => p.trim())
    .filter(Boolean)
}

function modulePrice(mod, dims) {
  if (mod.kind === 'shelf') {
    const a = (dims.L * dims.W) / 1e6
    return PRIX.tabletteForfait + a * PRIX.tabletteParM2
  }
  if (mod.kind === 'drawer') {
    const h = PRIX.tiroirHauteurDefautMm
    const v = (dims.L * dims.W * h) / 1e9
    return PRIX.tiroirForfait + v * PRIX.tiroirParM3
  }
  if (mod.kind === 'door') {
    const a = (dims.L * dims.H) / 1e6
    return PRIX.porteForfait + a * PRIX.porteParM2
  }
  if (mod.kind === 'pied') return PRIX.piedForfait
  return 10
}

function unitHt(row) {
  const dims = { L: +row.L_mm, W: +row.W_mm, H: +row.H_mm }
  const longueurM = (4 * (dims.L + dims.W + dims.H)) / 1000
  const ossature = PRIX.ossatureForfait + longueurM * PRIX.ossatureParMetre
  const panTotal = parsePanneaux(row.panneaux)
    .map((n) => PRIX.panneauForfait + panneauSurfaceM2(n, dims) * PRIX.panneauParM2)
    .reduce((a, b) => a + b, 0)
  const modTotal = parseModules(row.modules)
    .map((m) => modulePrice(m, dims))
    .reduce((a, b) => a + b, 0)
  return {
    id: row.id,
    ossature,
    panneaux: panTotal,
    modules: modTotal,
    ht: ossature + panTotal + modTotal,
  }
}

function splitCsvLine(line) {
  const out = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"'
        i++
      } else inQ = !inQ
    } else if (ch === ',' && !inQ) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

function quoteField(c, header) {
  if (header === 'tags') return `"${String(c).replace(/^"|"$/g, '')}"`
  if (/[",\n]/.test(c)) return `"${String(c).replace(/"/g, '""')}"`
  return c
}

const csvPath = path.join(root, 'public/catalogue/matrice_catalogue.csv')
const text = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '')
const lines = text.split(/\r?\n/).filter((l) => l.trim())
const headers = splitCsvLine(lines[0])
const priceIdx = headers.indexOf('price_furniture_ttc_eur')
const model3dIdx = headers.indexOf('price_model3d_ht_eur')

if (priceIdx < 0) {
  console.error('Colonne price_furniture_ttc_eur introuvable')
  process.exit(1)
}

const finalLines = [lines[0]]
const report = []

for (const line of lines.slice(1)) {
  const cols = splitCsvLine(line)
  const obj = {}
  headers.forEach((h, i) => {
    obj[h] = (cols[i] ?? '').trim()
  })
  const detail = unitHt(obj)
  const ttc = Math.round(detail.ht * (1 + TVA))
  const old = Number(obj.price_furniture_ttc_eur) || 0
  cols[priceIdx] = String(ttc)
  if (model3dIdx >= 0) cols[model3dIdx] = String(PRIX.modele3d)

  finalLines.push(cols.map((c, i) => quoteField(c, headers[i])).join(','))
  report.push({
    id: obj.id,
    old,
    new: ttc,
    delta: ttc - old,
    ht: Math.round(detail.ht * 100) / 100,
  })
}

fs.writeFileSync(csvPath, finalLines.join('\n') + '\n', 'utf8')
console.table(report)
console.log(`\n${report.length} configurations mises à jour → ${path.relative(root, csvPath)}`)
