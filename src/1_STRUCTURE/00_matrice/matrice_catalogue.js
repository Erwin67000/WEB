/**
 * matrice_catalogue — lecture de la gamme boutique.
 *
 * Source unique (Excel, éditable dans VS Code via extension Excel Viewer) :
 *   public/catalogue/matrice_catalogue.xlsx
 * Servi en dev/prod via :
 *   /catalogue/matrice_catalogue.xlsx
 *
 * Fallback legacy : .csv si le xlsx est absent.
 *
 * Une ligne = un modèle. La boutique boucle sur les lignes active=true.
 */
import * as XLSX from 'xlsx'

/** Colonnes documentées (schéma matrice). */
export const CATALOGUE_COLUMNS = [
  'id',
  'name',
  'category',
  'tags',
  'L_mm',
  'W_mm',
  'H_mm',
  'wood_finish',
  'texture',
  'modules',
  'panneaux',
  'price_furniture_ttc_eur',
  'price_model3d_ht_eur',
  'price_json_ht_eur',
  'scene',
  'short_description',
  'featured',
  'active',
  'sort_order',
  'docs_ready',
  'sku',
]

/** URL principale — Excel. */
export const MATRICE_CATALOGUE_URL = '/catalogue/matrice_catalogue.xlsx'

/** Fallbacks (ordre de tentative). */
export const MATRICE_CATALOGUE_FALLBACKS = [
  '/catalogue/matrice_catalogue.xls',
  '/catalogue/matrice_catalogue.csv',
]

/** Kinds de modules reconnus par l’agencement. */
const MODULE_KINDS_OK = new Set(['shelf', 'drawer', 'door'])

/** Kinds CSV legacy mappés vers panneaux. */
const MODULE_TO_PANNEAU = {
  panel_external: null,
  panel_functional: null,
}

/**
 * Parse `drawer:2|shelf:1` → [{ kind, bayIndex, id, openFactor }, …]
 */
export function parseModulesSpec(spec) {
  if (Array.isArray(spec)) {
    return spec.map((m, i) => ({
      id: m.id || `mod-${i}`,
      kind: m.kind,
      bayIndex: m.bayIndex ?? i,
      openFactor: m.openFactor ?? 0,
    }))
  }
  if (spec == null || !String(spec).trim()) return []
  const out = []
  let i = 0
  for (const part of String(spec).split('|')) {
    const [kindRaw, countStr] = part.split(':')
    const kind = (kindRaw || '').trim().toLowerCase()
    if (!kind) continue
    if (MODULE_TO_PANNEAU[kind] !== undefined) continue
    if (!MODULE_KINDS_OK.has(kind)) continue
    const n = Math.max(1, Number(countStr) || 1)
    for (let b = 0; b < n; b++) {
      out.push({
        id: `mod-${i++}`,
        kind,
        bayIndex: b,
        openFactor: 0,
      })
    }
  }
  return out
}

/**
 * Parse `fond|joue1|dessus_exterieur` → string[]
 */
export function parsePanneauxSpec(spec) {
  if (Array.isArray(spec)) return [...spec]
  if (!spec?.trim()) return []
  return String(spec)
    .split(/[|;,/]+/)
    .map((p) => p.trim())
    .filter(Boolean)
}

/** Tags : `#bureau salon|armoire` ou `bureau,table-basse` */
export function parseTagsField(...rawParts) {
  const seen = new Set()
  const out = []
  for (const raw of rawParts) {
    if (raw == null || raw === '') continue
    const parts = String(raw)
      .split(/[,|;/\s]+/)
      .map((t) => t.trim().replace(/^#+/, '').toLowerCase())
      .filter(Boolean)
    for (const t of parts) {
      if (!seen.has(t)) {
        seen.add(t)
        out.push(t)
      }
    }
  }
  return out
}

export function formatTag(tag) {
  return tag.startsWith('#') ? tag : `#${tag}`
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

function asBool(v, defaultTrue = false) {
  if (v === undefined || v === null || v === '') return defaultTrue
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  const s = String(v).toLowerCase().trim()
  return s === 'true' || s === '1' || s === 'oui' || s === 'yes'
}

function cellStr(v) {
  if (v == null) return ''
  return String(v).trim()
}

/**
 * Normalise un objet ligne brute (clés = en-têtes) → CatalogueRow.
 */
export function normalizeCatalogueRow(obj) {
  const category = cellStr(obj.category)
  const tags = parseTagsField(obj.tags, obj.tag)
  const modulesSpec = cellStr(obj.modules)
  const panneauxSpec = cellStr(obj.panneaux)
  const L = Number(obj.L_mm) || 0
  const W = Number(obj.W_mm) || 0
  const H = Number(obj.H_mm) || 0

  return {
    id: cellStr(obj.id),
    name: cellStr(obj.name),
    category,
    tags,
    L_mm: L,
    W_mm: W,
    H_mm: H,
    dims: { L, W, H },
    wood_finish: cellStr(obj.wood_finish || 'chene').toLowerCase(),
    texture: cellStr(obj.texture || obj.ossature_finish || '').toLowerCase(),
    ossature_finish: cellStr(
      obj.ossature_finish || obj.texture || '',
    ).toLowerCase(),
    modules_spec: modulesSpec,
    modules: parseModulesSpec(modulesSpec),
    panneaux_spec: panneauxSpec,
    panneaux: parsePanneauxSpec(panneauxSpec),
    price_from:
      Number(obj.price_furniture_ttc_eur || obj.price_ttc_eur) || 0,
    price_ttc_eur:
      Number(obj.price_furniture_ttc_eur || obj.price_ttc_eur) || 0,
    price_furniture_ttc_eur:
      Number(obj.price_furniture_ttc_eur || obj.price_ttc_eur) || 0,
    price_model3d_ht_eur: Number(obj.price_model3d_ht_eur) || 49,
    price_json_ht_eur: Number(obj.price_json_ht_eur) || 25,
    scene: cellStr(obj.scene || 'none'),
    short_description: cellStr(obj.short_description),
    featured: asBool(obj.featured, false),
    active: asBool(obj.active, true),
    sort_order: Number(obj.sort_order) || 0,
    docs_ready: asBool(obj.docs_ready, false),
    sku: cellStr(obj.sku || obj.id),
  }
}

/**
 * Parse le CSV matrice_catalogue → lignes normalisées.
 * @returns {object[]}
 */
export function parseMatriceCatalogue(text) {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) return []

  const headers = splitCsvLine(lines[0]).map((h) => h.trim())
  const rows = lines.slice(1).map((line) => {
    const cols = splitCsvLine(line)
    const obj = {}
    headers.forEach((h, i) => {
      obj[h] = (cols[i] ?? '').trim()
    })
    return normalizeCatalogueRow(obj)
  })

  return finalizeRows(rows)
}

/**
 * Parse un classeur Excel (ArrayBuffer | Uint8Array | Buffer) → lignes.
 */
export function parseMatriceCatalogueWorkbook(data) {
  const wb = XLSX.read(data, { type: 'array', cellDates: false, raw: false })
  const sheetName =
    wb.SheetNames.find((n) => /catalogue/i.test(n)) || wb.SheetNames[0]
  if (!sheetName) return []
  const sheet = wb.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    raw: false,
  })
  return finalizeRows(rawRows.map((obj) => normalizeCatalogueRow(obj)))
}

function finalizeRows(rows) {
  return rows
    .filter((r) => r.active && r.id)
    .sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'fr'),
    )
}

let _cache = null
let _cacheAt = 0
const CACHE_MS = 2000

function isExcelUrl(url) {
  return /\.xlsx?$/i.test(url)
}

/**
 * Charge la matrice catalogue (fetch + parse Excel ou CSV).
 */
export async function loadMatriceCatalogue({ force = false } = {}) {
  const now = Date.now()
  if (!force && _cache && now - _cacheAt < CACHE_MS) return _cache

  const urls = [MATRICE_CATALOGUE_URL, ...MATRICE_CATALOGUE_FALLBACKS]
  let lastErr = null
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-cache' })
      if (!res.ok) {
        lastErr = new Error(`${url} → ${res.status}`)
        continue
      }
      let rows
      if (isExcelUrl(url)) {
        const ab = await res.arrayBuffer()
        rows = parseMatriceCatalogueWorkbook(new Uint8Array(ab))
      } else {
        rows = parseMatriceCatalogue(await res.text())
      }
      _cache = rows
      _cacheAt = now
      return rows
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr || new Error('matrice_catalogue introuvable')
}

export async function getCatalogueItem(id, opts) {
  const rows = await loadMatriceCatalogue(opts)
  return rows.find((r) => r.id === id) ?? null
}

export function clearCatalogueCache() {
  _cache = null
  _cacheAt = 0
}

export default {
  CATALOGUE_COLUMNS,
  MATRICE_CATALOGUE_URL,
  MATRICE_CATALOGUE_FALLBACKS,
  parseModulesSpec,
  parsePanneauxSpec,
  parseTagsField,
  formatTag,
  normalizeCatalogueRow,
  parseMatriceCatalogue,
  parseMatriceCatalogueWorkbook,
  loadMatriceCatalogue,
  getCatalogueItem,
  clearCatalogueCache,
}
