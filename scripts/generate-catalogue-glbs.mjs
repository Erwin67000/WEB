/**
 * Génère un GLB par ligne active de modele_boutique.csv.
 * Source : public/catalogue/modele_boutique.csv (après sync)
 *          ou src/1_STRUCTURE/03_bibliotheque/modele_boutique.csv
 * Tablettes = octogone + 2 traverses (buildTablette).
 * Tiroirs = Würth type B : caisson, traverses, rails Dynamoov (buildTiroir).
 * Sortie : public/catalogue/glb/<id>.glb
 *
 * Usage : npm run build:catalogue-glbs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Blob as NodeBlob } from 'node:buffer'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'

// Polyfills navigateur pour GLTFExporter sous Node
if (typeof globalThis.Blob === 'undefined') globalThis.Blob = NodeBlob
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    result = null
    onloadend = null
    onerror = null
    readAsArrayBuffer(blob) {
      const p =
        typeof blob.arrayBuffer === 'function'
          ? blob.arrayBuffer()
          : Promise.resolve(blob)
      p.then((ab) => {
        this.result = ab
        this.onloadend?.({ target: this })
      }).catch((err) => this.onerror?.(err))
    }
  }
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const modeleXlsxSrc = path.join(
  root,
  'src/1_STRUCTURE/03_bibliotheque/modele_boutique.xlsx',
)
const modeleXlsxPublic = path.join(root, 'public/catalogue/modele_boutique.xlsx')
const modeleXlsSrc = path.join(
  root,
  'src/1_STRUCTURE/03_bibliotheque/modele_boutique.xls',
)
const modeleXlsPublic = path.join(root, 'public/catalogue/modele_boutique.xls')
const modelePath = path.join(root, 'public/catalogue/modele_boutique.csv')
const modeleSrc = path.join(
  root,
  'src/1_STRUCTURE/03_bibliotheque/modele_boutique.csv',
)
const xlsxPath = path.join(root, 'public/catalogue/matrice_catalogue.xlsx')
const csvPath = path.join(root, 'public/catalogue/matrice_catalogue.csv')
const outDir = path.join(root, 'public/catalogue/glb')

// Imports source (même pipeline que le configurateur)
const { buildOssature } = await import(
  pathToFileURL(path.join(root, 'src/1_STRUCTURE/01_meuble3D/ossature.js')).href
)
const {
  buildPanneauComplet,
  moduleLayout,
  buildTiroir,
  normalizeRailGeometry,
  railGeometryToThree,
  drawersTopZMm,
  pinFirstShelfOnDrawers,
} = await import(
  pathToFileURL(path.join(root, 'src/1_STRUCTURE/02_agencement/agencement.js')).href
)
const {
  FINITIONS,
  FINITIONS_OSSATURE,
  EPAISSEUR_PANNEAU,
  BOIS_ATELIER_ID,
  resolveOssatureFinish,
  PANNEAU_COULEURS,
} = await import(
  pathToFileURL(path.join(root, 'src/1_STRUCTURE/00_matrice/matrice_constante.js')).href
)
const { buildTablette } = await import(
  pathToFileURL(
    path.join(root, 'src/1_STRUCTURE/02_agencement/Z.tablette/tablette.js'),
  ).href
)

/** Couleur panneau par défaut (si non spécifiée dans le modèle) */
const BOUTIQUE_PANNEAU_COULEUR = 'olive'
const { parseMatriceCatalogue, parseMatriceCatalogueWorkbook } = await import(
  pathToFileURL(path.join(root, 'src/1_STRUCTURE/00_matrice/matrice_catalogue.js')).href
)

function readCsvText(p) {
  const raw = fs.readFileSync(p)
  let text = raw.toString('utf8')
  const looksBroken =
    text.includes('\uFFFD') ||
    (/Biblioth.|entr.|Etag./.test(text) &&
      !/Bibliothèque|entrée|Etagère/.test(text))
  if (looksBroken) text = raw.toString('latin1')
  return text
}

function loadCatalogueRows() {
  for (const p of [modeleXlsSrc, modeleXlsPublic, modeleXlsxSrc, modeleXlsxPublic]) {
    if (fs.existsSync(p)) {
      const rows = parseMatriceCatalogueWorkbook(fs.readFileSync(p))
      if (rows?.length) {
        console.log('[generate-glbs] source XLS', path.relative(root, p))
        return rows
      }
    }
  }
  for (const p of [modelePath, modeleSrc, csvPath]) {
    if (fs.existsSync(p) && p.endsWith('.csv')) {
      const rows = parseMatriceCatalogue(readCsvText(p))
      if (rows?.length) {
        console.log('[generate-glbs] source CSV', path.relative(root, p))
        return rows
      }
    }
  }
  if (fs.existsSync(xlsxPath)) {
    return parseMatriceCatalogueWorkbook(fs.readFileSync(xlsxPath))
  }
  return null
}

const SCALE = 0.001
const RAIL_METAL_COLOR = '#b4b8bc'
const RAIL_STL_PATH = path.join(root, 'public/structure/agencement/rail-gauche.stl')

function loadRailGeometryMm() {
  if (!fs.existsSync(RAIL_STL_PATH)) {
    console.warn('[generate-glbs] rail STL introuvable', RAIL_STL_PATH)
    return null
  }
  const buf = fs.readFileSync(RAIL_STL_PATH)
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  const geo = new STLLoader().parse(ab)
  return normalizeRailGeometry(geo)
}

const railGeoMm = loadRailGeometryMm()
if (railGeoMm) console.log('[generate-glbs] rails Dynamoov STL chargés')

function shadeHex(hex, factor) {
  const c = new THREE.Color(hex)
  c.multiplyScalar(factor)
  return c
}

/** Meuble coords (mm) → Three (m) : rotX(-90°) puis scale */
function meubleToThree(x, y, z) {
  return new THREE.Vector3(x * SCALE, z * SCALE, -y * SCALE)
}

function convertPositions(positions) {
  const n = positions.length / 3
  const out = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const v = meubleToThree(
      positions[i * 3],
      positions[i * 3 + 1],
      positions[i * 3 + 2],
    )
    out[i * 3] = v.x
    out[i * 3 + 1] = v.y
    out[i * 3 + 2] = v.z
  }
  return out
}

function meshFromBuffers(positions, indices, color, name) {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute(
    'position',
    new THREE.BufferAttribute(convertPositions(positions), 3),
  )
  if (indices) {
    geo.setIndex(new THREE.BufferAttribute(indices, 1))
  }
  geo.computeVertexNormals()
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.55,
    metalness: 0.05,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1.5,
    polygonOffsetUnits: 2,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = name
  return mesh
}

/**
 * Filaire exact (pas de dilatation géométrique) → fins cylindres centrés
 * sur le segment. Anti z-fighting côté viewer via polygonOffset sur les solides.
 * radiusMm un peu plus marqué pour les vignettes boutique (lisible au repos).
 */
function tubesFromWire(wire, color, name, radiusMm = 1.25) {
  if (!wire || wire.length < 6) return null
  const group = new THREE.Group()
  group.name = name
  const r = radiusMm * SCALE
  const mat = new THREE.MeshStandardMaterial({
    color: color || 0x0a0a0a,
    roughness: 0.4,
    metalness: 0.2,
    // Lignes un peu plus « proches caméra » dans le Z-buffer
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    depthWrite: false,
  })
  const nSeg = Math.floor(wire.length / 6)
  for (let i = 0; i < nSeg; i++) {
    const o = i * 6
    const a = meubleToThree(wire[o], wire[o + 1], wire[o + 2])
    const b = meubleToThree(wire[o + 3], wire[o + 4], wire[o + 5])
    const dir = new THREE.Vector3().subVectors(b, a)
    const len = dir.length()
    if (len < 1e-6) continue
    const geo = new THREE.CylinderGeometry(r, r, len, 4, 1)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(a).add(b).multiplyScalar(0.5)
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize(),
    )
    mesh.renderOrder = 2
    group.add(mesh)
  }
  return group
}

function buildRowGroup(row) {
  const dims = { L: row.L_mm, W: row.W_mm, H: row.H_mm }
  const wood = BOIS_ATELIER_ID
  const finish = FINITIONS[wood] || FINITIONS.chene
  const ossId = resolveOssatureFinish(
    row.ossature_finish || row.texture || row.wood_finish,
  )
  const surf = FINITIONS_OSSATURE[ossId] || FINITIONS_OSSATURE.brut
  const woodColor = shadeHex(finish.color, surf.shade ?? 1)
  const panneauId =
    row.panneau_couleur ||
    row.panneauCouleur ||
    BOUTIQUE_PANNEAU_COULEUR
  const panneauColor =
    PANNEAU_COULEURS[panneauId]?.color ||
    PANNEAU_COULEURS.olive?.color ||
    '#7a8f5c'

  const root = new THREE.Group()
  root.name = row.id

  const edgeColor = 0x0a0a0a

  // Ossature : volume + filaire exact (tubes fins centrés sur l’arête)
  const oss = buildOssature(dims)
  for (const m of oss.meshes) {
    root.add(
      meshFromBuffers(m.positions, m.indices, woodColor, `arete-${m.id}`),
    )
    // Arêtes ossature : trait de référence
    const lines = tubesFromWire(m.wire, edgeColor, `arete-wire-${m.id}`, 1.3)
    if (lines) root.add(lines)
  }

  const modules = pinFirstShelfOnDrawers(row.modules || [], dims)
  const porteZMin = drawersTopZMm(dims, modules)

  // Panneaux solides + contours exacts (trait plus fin que les arêtes)
  for (const nom of row.panneaux || []) {
    try {
      const data = buildPanneauComplet(nom, dims, {
        epaisseur: EPAISSEUR_PANNEAU,
        ...(nom === 'porte' && porteZMin > 0 ? { zMin: porteZMin } : {}),
      })
      const buf = data.panneau.toBuffers()
      root.add(
        meshFromBuffers(
          buf.positions,
          buf.indices,
          new THREE.Color(panneauColor),
          `panneau-${nom}`,
        ),
      )
      const plines = tubesFromWire(
        buf.wire,
        edgeColor,
        `panneau-wire-${nom}`,
        0.85,
      )
      if (plines) root.add(plines)
    } catch (e) {
      console.warn(`  [skip panneau ${nom}]`, e.message)
    }
  }

  // Modules : tablettes paramétriques (octogone + traverses) ou boîtes legacy
  const woodMat = new THREE.MeshStandardMaterial({
    color: woodColor,
    roughness: surf.roughness ?? 0.55,
    metalness: surf.metalness ?? 0.05,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  })

  for (const mod of modules) {
    if (mod.kind === 'shelf') {
      try {
        const layout = moduleLayout(mod, dims, modules)
        const zTop = layout.zTopMm ?? layout.zMm
        const tab = buildTablette(dims, zTop, { epaisseurMm: EPAISSEUR_PANNEAU })
        // Plateau (couleur panneau boutique)
        root.add(
          meshFromBuffers(
            tab.plate.positions,
            tab.plate.indices,
            new THREE.Color(panneauColor),
            `tablette-plate-${mod.id || mod.bayIndex}`,
          ),
        )
        const plateLines = tubesFromWire(
          tab.plate.wire,
          edgeColor,
          `tablette-plate-wire-${mod.id || mod.bayIndex}`,
          0.85,
        )
        if (plateLines) root.add(plateLines)
        // Traverses (matière arête / bois)
        for (const tr of tab.traverses) {
          root.add(
            meshFromBuffers(
              tr.positions,
              tr.indices,
              woodColor,
              `tablette-${tr.id}-${mod.id || mod.bayIndex}`,
            ),
          )
          const tw = tubesFromWire(
            tr.wire,
            edgeColor,
            `tablette-${tr.id}-wire-${mod.id || mod.bayIndex}`,
            1.3,
          )
          if (tw) root.add(tw)
        }
      } catch (e) {
        console.warn(`  [skip tablette ${mod.id}]`, e.message)
      }
      continue
    }

    if (mod.kind === 'drawer') {
      try {
        const layout = moduleLayout(mod, dims, modules)
        const data = buildTiroir(dims, layout, mod)
        if (data.lwkOutOfRange) {
          console.warn(
            `  [skip tiroir ${row.id}/${mod.id}] LWK hors 200–1200 mm`,
          )
          continue
        }
        if (data.depthTooSmall) {
          console.warn(`  [skip tiroir ${row.id}/${mod.id}] profondeur < 250 mm`)
          continue
        }
        for (const tr of data.traverses || []) {
          root.add(
            meshFromBuffers(
              tr.positions,
              tr.indices,
              woodColor,
              `drawer-tr-${tr.id}-${mod.id || mod.bayIndex}`,
            ),
          )
          const tw = tubesFromWire(
            tr.wire,
            edgeColor,
            `drawer-tr-wire-${tr.id}-${mod.id || mod.bayIndex}`,
            1.3,
          )
          if (tw) root.add(tw)
        }
        for (const p of data.box?.panels || []) {
          const isFacade = p.id === 'facade'
          root.add(
            meshFromBuffers(
              p.positions,
              p.indices,
              new THREE.Color(isFacade ? panneauColor : woodColor),
              `drawer-box-${p.id}-${mod.id || mod.bayIndex}`,
            ),
          )
          const pl = tubesFromWire(
            p.wire,
            edgeColor,
            `drawer-box-wire-${p.id}-${mod.id || mod.bayIndex}`,
            0.85,
          )
          if (pl) root.add(pl)
        }
        if (railGeoMm) {
          const railMat = new THREE.MeshStandardMaterial({
            color: RAIL_METAL_COLOR,
            metalness: 0.92,
            roughness: 0.28,
          })
          for (const r of data.rails || []) {
            const geo = railGeometryToThree(railGeoMm, {
              scaleX: r.scale?.x ?? 1,
              scaleY: r.scale?.y ?? 1,
              scaleZ: r.scale?.z ?? 1,
              mirrorX: Boolean(r.mirrorX),
            })
            const mesh = new THREE.Mesh(geo, railMat)
            const [x, y, z] = r.position
            mesh.position.copy(meubleToThree(x, y, z))
            mesh.name = `drawer-${r.id}-${mod.id || mod.bayIndex}`
            root.add(mesh)
          }
        }
      } catch (e) {
        console.warn(`  [skip tiroir ${row.id}/${mod.id}]`, e.message)
      }
      continue
    }

    // Portes : boîte + filaire
    const layout = moduleLayout(mod, dims, modules)
    const [cx, cy, cz] = layout.center
    const [sx, sy, sz] = layout.size
    const center = meubleToThree(cx, cy, cz)
    const geo = new THREE.BoxGeometry(sx * SCALE, sz * SCALE, sy * SCALE)
    const mat = woodMat.clone()
    mat.color = new THREE.Color(panneauColor)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(center)
    mesh.name = `mod-${mod.kind}-${mod.bayIndex}`
    root.add(mesh)

    const edges = new THREE.EdgesGeometry(geo)
    const pos = edges.attributes.position
    const edgeGroup = new THREE.Group()
    edgeGroup.position.copy(center)
    edgeGroup.name = `mod-wire-${mod.kind}-${mod.bayIndex}`
    const r = 0.0011
    const edgeMat = new THREE.MeshStandardMaterial({
      color: edgeColor,
      roughness: 0.4,
      metalness: 0.2,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      depthWrite: false,
    })
    for (let i = 0; i < pos.count; i += 2) {
      const a = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i))
      const b = new THREE.Vector3(
        pos.getX(i + 1),
        pos.getY(i + 1),
        pos.getZ(i + 1),
      )
      const dir = new THREE.Vector3().subVectors(b, a)
      const len = dir.length()
      if (len < 1e-7) continue
      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, len, 4, 1),
        edgeMat,
      )
      cyl.position.copy(a).add(b).multiplyScalar(0.5)
      cyl.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir.normalize(),
      )
      cyl.renderOrder = 2
      edgeGroup.add(cyl)
    }
    root.add(edgeGroup)
    edges.dispose()
  }

  return root
}

function exportGlb(group) {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter()
    exporter.parse(
      group,
      (result) => {
        if (result instanceof ArrayBuffer) resolve(Buffer.from(result))
        else reject(new Error('GLTFExporter n’a pas renvoyé de binaire'))
      },
      (err) => reject(err),
      { binary: true },
    )
  })
}

function disposeGroup(g) {
  g.traverse((o) => {
    if (o.geometry) o.geometry.dispose()
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
      else o.material.dispose()
    }
  })
}

// ——— main ———
const rows = loadCatalogueRows()
if (!rows) {
  console.error(
    '[generate-glbs] catalogue manquant (xlsx/xls/csv) dans public/catalogue/',
  )
  process.exit(1)
}
fs.mkdirSync(outDir, { recursive: true })

console.log(
  `[generate-glbs] ${rows.length} modèles (tablettes paramétriques) → ${path.relative(root, outDir)}`,
)

let ok = 0
for (const row of rows) {
  try {
    const group = buildRowGroup(row)
    const bin = await exportGlb(group)
    const file = path.join(outDir, `${row.id}.glb`)
    fs.writeFileSync(file, bin)
    disposeGroup(group)
    ok++
    console.log(`  ✓ ${row.id} (${(bin.length / 1024).toFixed(1)} Ko)`)
  } catch (e) {
    console.error(`  ✗ ${row.id}:`, e.message)
  }
}

// Manifest pour preload boutique
const manifest = rows.map((r) => ({
  id: r.id,
  glb: `/catalogue/glb/${r.id}.glb`,
}))
fs.writeFileSync(
  path.join(outDir, 'manifest.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), items: manifest }, null, 2),
)

// Supprime les GLB orphelins (anciens ids hors modele_boutique)
const keep = new Set(rows.map((r) => `${r.id}.glb`))
keep.add('manifest.json')
let removed = 0
for (const f of fs.readdirSync(outDir)) {
  if (!keep.has(f)) {
    fs.unlinkSync(path.join(outDir, f))
    removed++
  }
}
if (removed) console.log(`[generate-glbs] ${removed} ancien(s) GLB supprimé(s)`)

console.log(`[generate-glbs] terminé : ${ok}/${rows.length} GLB + manifest.json`)
