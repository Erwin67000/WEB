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
 * radiusMm très fin (~0.25 mm) pour rester collé à l’arête même en zoom fort.
 */
function tubesFromWire(wire, color, name, radiusMm = 0.28) {
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
  const panneauColor =
    PANNEAU_COULEURS[DEFAULT_PANNEAU_COULEUR]?.color || '#d4d0c8'

  const root = new THREE.Group()
  root.name = row.id

  const edgeColor = 0x0a0a0a

  // Ossature : volume + filaire exact (tubes fins centrés sur l’arête)
  const oss = buildOssature(dims)
  for (const m of oss.meshes) {
    root.add(
      meshFromBuffers(m.positions, m.indices, woodColor, `arete-${m.id}`),
    )
    const lines = tubesFromWire(m.wire, edgeColor, `arete-wire-${m.id}`, 0.28)
    if (lines) root.add(lines)
  }

  // Panneaux solides + contours exacts
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
      const plines = tubesFromWire(
        buf.wire,
        edgeColor,
        `panneau-wire-${nom}`,
        0.25,
      )
      if (plines) root.add(plines)
    } catch (e) {
      console.warn(`  [skip panneau ${nom}]`, e.message)
    }
  }

  // Modules (boîtes + contours exacts sur arêtes de la boîte)
  const modules = row.modules || []
  for (const mod of modules) {
    const layout = moduleLayout(mod, dims, modules)
    const [cx, cy, cz] = layout.center
    const [sx, sy, sz] = layout.size
    const center = meubleToThree(cx, cy, cz)
    const geo = new THREE.BoxGeometry(sx * SCALE, sz * SCALE, sy * SCALE)
    const mat = new THREE.MeshStandardMaterial({
      color: panneauColor,
      roughness: 0.6,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(center)
    mesh.name = `mod-${mod.kind}-${mod.bayIndex}`
    root.add(mesh)

    const edges = new THREE.EdgesGeometry(geo)
    const pos = edges.attributes.position
    const edgeGroup = new THREE.Group()
    edgeGroup.position.copy(center)
    edgeGroup.name = `mod-wire-${mod.kind}-${mod.bayIndex}`
    const r = 0.00028
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
