/**
 * Génère un GLB par ligne active de matrice_catalogue.csv.
 * Sortie : public/catalogue/glb/<id>.glb
 *
 * Usage : node scripts/generate-catalogue-glbs.mjs
 * Branché en prebuild pour que la boutique charge des modèles figés
 * (pas de calcul géométrique à l’affichage des vignettes).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Blob as NodeBlob } from 'node:buffer'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

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
const csvPath = path.join(root, 'public/catalogue/matrice_catalogue.csv')
const outDir = path.join(root, 'public/catalogue/glb')

// Imports source (même pipeline que le configurateur)
const { buildOssature } = await import(
  pathToFileURL(path.join(root, 'src/1_STRUCTURE/01_meuble3D/ossature.js')).href
)
const { buildPanneauComplet, moduleLayout } = await import(
  pathToFileURL(path.join(root, 'src/1_STRUCTURE/02_agencement/agencement.js')).href
)
const {
  FINITIONS,
  FINITIONS_OSSATURE,
  EPAISSEUR_PANNEAU,
  BOIS_ATELIER_ID,
  resolveOssatureFinish,
  DEFAULT_PANNEAU_COULEUR,
  PANNEAU_COULEURS,
} = await import(
  pathToFileURL(path.join(root, 'src/1_STRUCTURE/00_matrice/matrice_constante.js')).href
)
const { parseMatriceCatalogue } = await import(
  pathToFileURL(path.join(root, 'src/1_STRUCTURE/00_matrice/matrice_catalogue.js')).href
)

const SCALE = 0.001

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
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = name
  return mesh
}

/**
 * Filaire arêtes / panneaux — LineSegments exportés dans le GLB.
 * wire = paires de points meuble (x,y,z, x,y,z, …)
 */
function linesFromWire(wire, color, name) {
  if (!wire || wire.length < 6) return null
  const out = convertPositions(wire)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(out, 3))
  const mat = new THREE.LineBasicMaterial({
    color: color || 0x0a0a0a,
    depthTest: true,
  })
  const lines = new THREE.LineSegments(geo, mat)
  lines.name = name
  return lines
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
  const panneauColor =
    PANNEAU_COULEURS[DEFAULT_PANNEAU_COULEUR]?.color || '#d4d0c8'

  const root = new THREE.Group()
  root.name = row.id

  const edgeColor = 0x0a0a0a

  // Ossature : volume + lignes d’arêtes
  const oss = buildOssature(dims)
  for (const m of oss.meshes) {
    root.add(
      meshFromBuffers(m.positions, m.indices, woodColor, `arete-${m.id}`),
    )
    const lines = linesFromWire(m.wire, edgeColor, `arete-wire-${m.id}`)
    if (lines) root.add(lines)
  }

  // Panneaux solides + contours
  for (const nom of row.panneaux || []) {
    try {
      const data = buildPanneauComplet(nom, dims, {
        epaisseur: EPAISSEUR_PANNEAU,
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
      const plines = linesFromWire(
        buf.wire,
        edgeColor,
        `panneau-wire-${nom}`,
      )
      if (plines) root.add(plines)
    } catch (e) {
      console.warn(`  [skip panneau ${nom}]`, e.message)
    }
  }

  // Modules (boîtes simples + edges)
  const modules = row.modules || []
  for (const mod of modules) {
    const layout = moduleLayout(mod, dims, modules)
    const [cx, cy, cz] = layout.center
    const [sx, sy, sz] = layout.size
    const center = meubleToThree(cx, cy, cz)
    const geo = new THREE.BoxGeometry(
      sx * SCALE,
      sz * SCALE,
      sy * SCALE,
    )
    const mat = new THREE.MeshStandardMaterial({
      color: panneauColor,
      roughness: 0.6,
      metalness: 0.02,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(center)
    mesh.name = `mod-${mod.kind}-${mod.bayIndex}`
    root.add(mesh)
    // Contours boîte module
    const edges = new THREE.EdgesGeometry(geo)
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: edgeColor }),
    )
    line.position.copy(center)
    line.name = `mod-wire-${mod.kind}-${mod.bayIndex}`
    root.add(line)
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
if (!fs.existsSync(csvPath)) {
  console.error('[generate-glbs] catalogue manquant:', csvPath)
  process.exit(1)
}

const rows = parseMatriceCatalogue(fs.readFileSync(csvPath, 'utf8'))
fs.mkdirSync(outDir, { recursive: true })

console.log(`[generate-glbs] ${rows.length} modèles → ${path.relative(root, outDir)}`)

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

console.log(`[generate-glbs] terminé : ${ok}/${rows.length} GLB + manifest.json`)
