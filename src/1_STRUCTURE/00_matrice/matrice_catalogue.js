/**
 * Catalogue boutique — source unique :
 *   src/1_STRUCTURE/03_bibliotheque/modele_boutique.csv
 * Servi en dev/prod via (après sync) :
 *   /catalogue/modele_boutique.csv
 *
 * Schéma d’entrée (modele_boutique) :
 *   ID, Type, Nom, L, P, H, Description, taille, tags,
 *   couleur_ossature, couleur_panneau,
 *   porte (O/N), fond, joue1, joue2, socle, dessus,
 *   # tiroir, # tablette, Options
 *
 * Une ligne = un modèle préconfiguré (L/P/H renseignés = actif).
 */
import * as XLSX from 'xlsx'

/** Colonnes documentées (format interne boutique / GLB). */
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

/** URL principale — nouveau catalogue atelier. */
export const MATRICE_CATALOGUE_URL = '/catalogue/modele_boutique.csv'

/** Fallbacks (ancien pipeline). */
export const MATRICE_CATALOGUE_FALLBACKS = [
  '/catalogue/matrice_catalogue.csv',
  '/catalogue/matrice_catalogue.xlsx',
]

const MODULE_KINDS_OK = new Set(['shelf', 'drawer', 'door'])

const MODULE_TO_PANNEAU = {
  panel_external: null,
  panel_functional: null,
}

/** couleur_panneau atelier → id palette Philae */
const COULEUR_PANNEAU_MAP = {
  vert: 'olive',
  olive: 'olive',
  terracotta: 'terracotta',
  bleu: 'bleu_poudre',
  bleu_poudre: 'bleu_poudre',
  gris: 'gris_cendre',
  gris_cendre: 'gris_cendre',
  jaune: 'jaune_orange',
  jaune_orange: 'jaune_orange',
}

/** socle/dessus O-N → noms PANNEAU_DEFS */
const PANNEAU_FLAG_MAP = {
  porte: 'porte',
  'porte (o/n)': 'porte',
  fond: 'fond',
  joue1: 'joue1',
  joue2: 'joue2',
  socle: 'dessous',
  dessus: 'dessus_exterieur',
}

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

export function parsePanneauxSpec(spec) {
  if (Array.isArray(spec)) return [...spec]
  if (!spec?.trim()) return []
  return String(spec)
    .split(/[|;,/]+/)
    .map((p) => p.trim())
    .filter(Boolean)
}

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
  return s === 'true' || s === '1' || s === 'oui' || s === 'yes' || s === 'o'
}

function isOn(v) {
  const s = String(v ?? '')
    .trim()
    .toUpperCase()
  return s === 'O' || s === 'OUI' || s === 'Y' || s === 'YES' || s === '1' || s === 'TRUE'
}

function cellStr(v) {
  if (v == null) return ''
  return String(v).trim()
}

function slugify(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Détecte le format modele_boutique (colonnes ID/Type/Nom…).
 */
export function isModeleBoutiqueHeaders(headers) {
  const h = headers.map((x) => String(x).trim().toLowerCase())
  return h.includes('id') && h.includes('nom') && (h.includes('l') || h.includes('l_mm'))
}

/**
 * Prix indicatif simple si non fourni (HT ossature + modules + panneaux).
 */
function estimatePriceTtc({ L, W, H, modules, panneaux }) {
  const ossature = 900 + (4 * (L + W + H)) / 1000 * 50
  let mod = 0
  for (const m of modules) {
    if (m.kind === 'shelf') mod += 50 + (L * W) / 1e6 * 100
    if (m.kind === 'drawer') mod += 250 + (L * W * 110) / 1e9 * 1000
  }
  const pan = (panneaux?.length || 0) * (50 + 0.3 * 100)
  return Math.round((ossature + mod + pan) * 1.2)
}

/**
 * Ligne modele_boutique → objet catalogue interne.
 * @param {object} obj — cellules CSV
 * @param {number} index — index ligne data
 * @param {{ lastType?: string, lastIdNum?: number }} ctx — héritage Type / n° auto
 */
export function normalizeModeleBoutiqueRow(obj, index = 0, ctx = {}) {
  // Accès colonnes avec variantes d’en-têtes
  const get = (...keys) => {
    for (const k of keys) {
      if (obj[k] != null && String(obj[k]).trim() !== '') return obj[k]
      // case-insensitive
      const found = Object.keys(obj).find(
        (h) => h.trim().toLowerCase() === String(k).toLowerCase(),
      )
      if (found != null && String(obj[found]).trim() !== '') return obj[found]
    }
    return ''
  }

  const rawId = cellStr(get('ID', 'id'))
  const typeCell = cellStr(get('Type', 'type', 'category'))
  // Type hérité seulement pour les lignes sans ID (variantes du même modèle)
  const type =
    typeCell || (!rawId ? cellStr(ctx.lastType) : '') || ''
  const nom = cellStr(get('Nom', 'nom', 'name'))
  const L = Number(get('L', 'L_mm')) || 0
  const P = Number(get('P', 'W_mm', 'W')) || 0 // P = profondeur = W meuble
  const H = Number(get('H', 'H_mm')) || 0
  const description = cellStr(get('Description', 'description', 'short_description'))
  const taille = cellStr(get('taille', 'Taille'))
  const tagsRaw = cellStr(get('tags', 'Tags'))
  const couleurOss = cellStr(get('couleur_ossature', 'texture', 'ossature_finish'))
  const couleurPan = cellStr(get('couleur_panneau', 'panneauCouleur'))
  const nTiroir = Number(get('# tiroir', 'nb_tiroir', 'tiroirs')) || 0
  const nTablette = Number(get('# tablette', 'nb_tablette', 'tablettes')) || 0
  const options = cellStr(get('Options', 'options'))

  // Actif seulement si dimensions + nom
  const hasDims = L > 0 && P > 0 && H > 0
  const hasName = Boolean(nom)
  if (!hasDims || !hasName) {
    // Mettre à jour le contexte même pour les stubs (Type seul)
    if (type) ctx.lastType = type
    return null
  }

  // id URL / GLB stable
  const tailleSlug = slugify(taille.replace(/^#/, ''))
  const nomSlug = slugify(nom)
  let id
  let idNum = ''
  if (rawId) {
    idNum = rawId.padStart(3, '0')
    const n = Number(rawId)
    if (Number.isFinite(n)) ctx.lastIdNum = n
    id = [idNum, nomSlug, tailleSlug].filter(Boolean).join('-')
  } else {
    // Ligne sans ID (variante taille) : slug sans n° pour éviter collisions
    id = [nomSlug, tailleSlug || `${L}x${P}x${H}`].filter(Boolean).join('-')
  }
  if (type) ctx.lastType = type

  // Modules
  const modParts = []
  if (nTablette > 0) modParts.push(`shelf:${nTablette}`)
  if (nTiroir > 0) modParts.push(`drawer:${nTiroir}`)
  const modulesSpec = modParts.join('|')
  const modules = parseModulesSpec(modulesSpec)

  // Panneaux O/N
  const panneaux = []
  for (const [flagKey, panneauId] of Object.entries(PANNEAU_FLAG_MAP)) {
    const raw = get(flagKey)
    // Aussi chercher clé exacte dans obj
    let val = raw
    if (!val) {
      const found = Object.keys(obj).find(
        (h) =>
          h.trim().toLowerCase() === flagKey ||
          h.trim().toLowerCase().startsWith(flagKey.split(' ')[0]),
      )
      if (found) val = obj[found]
    }
    if (isOn(val)) panneaux.push(panneauId)
  }
  // Alias colonnes courantes
  if (isOn(get('porte (O/N)', 'porte'))) {
    if (!panneaux.includes('porte')) panneaux.push('porte')
  }
  if (isOn(get('fond'))) {
    if (!panneaux.includes('fond')) panneaux.push('fond')
  }
  if (isOn(get('joue1'))) {
    if (!panneaux.includes('joue1')) panneaux.push('joue1')
  }
  if (isOn(get('joue2'))) {
    if (!panneaux.includes('joue2')) panneaux.push('joue2')
  }
  if (isOn(get('socle'))) {
    if (!panneaux.includes('dessous')) panneaux.push('dessous')
  }
  if (isOn(get('dessus'))) {
    if (!panneaux.includes('dessus_exterieur')) panneaux.push('dessus_exterieur')
  }

  const tags = parseTagsField(tagsRaw, taille, type ? `#${slugify(type)}` : '')
  const finish = (couleurOss || 'brut').toLowerCase()
  const panneauCouleur =
    COULEUR_PANNEAU_MAP[(couleurPan || 'olive').toLowerCase()] || 'olive'

  const price = estimatePriceTtc({ L, W: P, H, modules, panneaux })

  const short =
    description ||
    [
      nom,
      taille ? `(${taille.replace(/^#/, '')})` : '',
      `${L}×${P}×${H} mm`,
      nTablette ? `${nTablette} tablette(s)` : '',
      nTiroir ? `${nTiroir} tiroir(s)` : '',
    ]
      .filter(Boolean)
      .join(' · ')

  return {
    id,
    name: nom + (taille ? ` ${taille.replace(/^#/, '')}` : ''),
    category: type || 'Autres',
    tags,
    L_mm: L,
    W_mm: P,
    H_mm: H,
    dims: { L, W: P, H },
    wood_finish: 'chene',
    texture: finish,
    ossature_finish: finish,
    modules_spec: modulesSpec,
    modules,
    panneaux_spec: panneaux.join('|'),
    panneaux,
    panneau_couleur: panneauCouleur,
    price_from: price,
    price_ttc_eur: price,
    price_furniture_ttc_eur: price,
    price_model3d_ht_eur: 45,
    price_json_ht_eur: 25,
    scene: 'none',
    short_description: short,
    featured: index < 3,
    active: true,
    sort_order: Number(rawId) || (ctx.lastIdNum || 0) * 10 + index + 1,
    docs_ready: false,
    sku: `PHL-${idNum || id.toUpperCase().slice(0, 12)}`,
    options,
    source: 'modele_boutique',
  }
}

/**
 * Normalise une ligne (legacy matrice_catalogue OU deja normalisée).
 */
export function normalizeCatalogueRow(obj) {
  // Déjà format interne ?
  if (obj.L_mm != null || obj.name != null) {
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
      panneau_couleur: cellStr(obj.panneau_couleur || obj.panneauCouleur || ''),
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
  return normalizeModeleBoutiqueRow(obj)
}

/**
 * Parse CSV (modele_boutique ou legacy).
 */
export function parseMatriceCatalogue(text) {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim())
  if (lines.length < 2) return []

  const headers = splitCsvLine(lines[0]).map((h) => h.trim())
  const boutique = isModeleBoutiqueHeaders(headers)

  const rows = []
  const ctx = { lastType: '', lastIdNum: 0 }
  lines.slice(1).forEach((line, i) => {
    const cols = splitCsvLine(line)
    const obj = {}
    headers.forEach((h, j) => {
      obj[h] = (cols[j] ?? '').trim()
    })
    if (boutique) {
      const row = normalizeModeleBoutiqueRow(obj, i, ctx)
      if (row) rows.push(row)
    } else {
      const row = normalizeCatalogueRow(obj)
      if (row?.id) rows.push(row)
    }
  })

  return finalizeRows(rows)
}

export function parseMatriceCatalogueWorkbook(data) {
  const wb = XLSX.read(data, { type: 'array', cellDates: false, raw: false })
  const sheetName =
    wb.SheetNames.find((n) => /catalogue|boutique|modele/i.test(n)) ||
    wb.SheetNames[0]
  if (!sheetName) return []
  const sheet = wb.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    raw: false,
  })
  if (!rawRows.length) return []
  const headers = Object.keys(rawRows[0])
  const boutique = isModeleBoutiqueHeaders(headers)
  const ctx = { lastType: '', lastIdNum: 0 }
  const rows = rawRows
    .map((obj, i) =>
      boutique
        ? normalizeModeleBoutiqueRow(obj, i, ctx)
        : normalizeCatalogueRow(obj),
    )
    .filter(Boolean)
  return finalizeRows(rows)
}

function finalizeRows(rows) {
  return rows
    .filter((r) => r && r.active && r.id && r.L_mm > 0 && r.H_mm > 0)
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
 * Charge le catalogue (fetch).
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
      if (!rows.length) {
        lastErr = new Error(`${url} → aucune ligne active`)
        continue
      }
      _cache = rows
      _cacheAt = now
      return rows
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr || new Error('Catalogue boutique introuvable')
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
  normalizeModeleBoutiqueRow,
  parseMatriceCatalogue,
  parseMatriceCatalogueWorkbook,
  loadMatriceCatalogue,
  getCatalogueItem,
  clearCatalogueCache,
}
