/**
 * Export local de la configuration : Collada (*.dae) + CSV géométrie complète.
 * DAE en millimètres, Z-up (SketchUp). CSV = master_input (ossature, panneaux, modules).
 */
import { buildOssature } from '../1_STRUCTURE/01_meuble3D/ossature.js'
import {
  buildPanneauComplet,
  face_panneau,
  moduleLayout,
} from '../1_STRUCTURE/02_agencement/agencement.js'
import {
  buildMasterInput,
  masterInputToCsv,
} from '../3_INPUT/master_input.js'

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function safeId(s) {
  const t = String(s || 'n').replace(/[^A-Za-z0-9_\-]/g, '_')
  return /^[A-Za-z]/.test(t) ? t : `n_${t}`
}

function triggerDownload(filename, text, mime) {
  const blob = new Blob([text], { type: mime })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1500)
}

function boxMesh(id, center, size) {
  const [cx, cy, cz] = center
  const [sx, sy, sz] = size
  const hx = sx / 2
  const hy = sy / 2
  const hz = sz / 2
  const positions = [
    cx - hx, cy - hy, cz - hz,
    cx + hx, cy - hy, cz - hz,
    cx + hx, cy + hy, cz - hz,
    cx - hx, cy + hy, cz - hz,
    cx - hx, cy - hy, cz + hz,
    cx + hx, cy - hy, cz + hz,
    cx + hx, cy + hy, cz + hz,
    cx - hx, cy + hy, cz + hz,
  ]
  const indices = [
    0, 2, 1, 0, 3, 2,
    4, 5, 6, 4, 6, 7,
    0, 1, 5, 0, 5, 4,
    1, 2, 6, 1, 6, 5,
    2, 3, 7, 2, 7, 6,
    3, 0, 4, 3, 4, 7,
  ]
  return { id, name: id, positions, indices }
}

function collectUnitMeshes(unit, state) {
  const meshes = []
  const oss = buildOssature(unit.dims)
  for (const m of oss.meshes) {
    meshes.push({
      id: `ossature-${m.id}`,
      name: m.id,
      positions: Array.from(m.positions),
      indices: Array.from(m.indices),
    })
  }

  const epP = Number(state.epaisseurPanneau)
  const epD = Number(state.epaisseurPorte)
  const selected = unit.panneaux || []
  for (const nom of selected) {
    try {
      const { panneau } = buildPanneauComplet(nom, unit.dims, {
        epaisseur: nom === 'porte' ? epD : epP,
      })
      const pts = panneau.points || []
      meshes.push({
        id: `panneau-${nom}`,
        name: nom,
        positions: pts.flatMap((p) => [p[0], p[1], p[2]]),
        indices: face_panneau.flat(),
      })
    } catch {
      /* panneau inconnu */
    }
  }

  const mods = unit.modules || []
  mods.forEach((mod, i) => {
    if (mod.kind !== 'shelf') return
    try {
      const layout = moduleLayout(mod, unit.dims, mods)
      meshes.push(
        boxMesh(`tablette-${i + 1}`, layout.center, layout.size),
      )
    } catch {
      /* ignore */
    }
  })

  return meshes
}

function geometryXml(mesh) {
  const id = safeId(mesh.id)
  const pos = mesh.positions
  const idx = mesh.indices
  const vcount = pos.length / 3
  const tcount = idx.length / 3
  const floatStr = pos.map((n) => Number(n).toFixed(4)).join(' ')
  const pStr = idx.join(' ')
  return `      <geometry id="${id}" name="${xmlEscape(mesh.name || id)}">
        <mesh>
          <source id="${id}-positions">
            <float_array id="${id}-positions-array" count="${pos.length}">${floatStr}</float_array>
            <technique_common>
              <accessor source="#${id}-positions-array" count="${vcount}" stride="3">
                <param name="X" type="float"/>
                <param name="Y" type="float"/>
                <param name="Z" type="float"/>
              </accessor>
            </technique_common>
          </source>
          <vertices id="${id}-vertices">
            <input semantic="POSITION" source="#${id}-positions"/>
          </vertices>
          <triangles count="${tcount}">
            <input semantic="VERTEX" source="#${id}-vertices" offset="0"/>
            <p>${pStr}</p>
          </triangles>
        </mesh>
      </geometry>`
}

function nodeXml(unit, meshes, index) {
  const nid = safeId(`unit-${index + 1}-${unit.id}`)
  const pos = unit.positionMm || { x: 0, y: 0, z: 0 }
  const rot = Number(unit.rotationZ) || 0
  const kids = meshes
    .map((m) => {
      const gid = safeId(m.id)
      return `        <node id="${nid}-${gid}" name="${xmlEscape(m.name || gid)}">
          <instance_geometry url="#${gid}"/>
        </node>`
    })
    .join('\n')
  return `      <node id="${nid}" name="${xmlEscape(unit.label || `Meuble ${index + 1}`)}">
        <translate>${Number(pos.x) || 0} ${Number(pos.y) || 0} ${Number(pos.z) || 0}</translate>
        <rotate>0 0 1 ${rot}</rotate>
${kids}
      </node>`
}

export function buildFurnitureCollada(state) {
  const units = state.units || []
  const all = []
  const unitMeshes = units.map((unit, i) => {
    const meshes = collectUnitMeshes(unit, state).map((m) => ({
      ...m,
      id: `u${i}-${m.id}`,
    }))
    all.push(...meshes)
    return meshes
  })
  const now = new Date().toISOString()
  const geoms = all.map(geometryXml).join('\n')
  const nodes = units
    .map((u, i) => nodeXml(u, unitMeshes[i], i))
    .join('\n')
  return `<?xml version="1.0" encoding="utf-8"?>
<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">
  <asset>
    <contributor>
      <author>Philae</author>
      <authoring_tool>philae.design</authoring_tool>
    </contributor>
    <created>${now}</created>
    <modified>${now}</modified>
    <unit name="millimeter" meter="0.001"/>
    <up_axis>Z_UP</up_axis>
  </asset>
  <library_geometries>
${geoms}
  </library_geometries>
  <library_visual_scenes>
    <visual_scene id="PhilaeScene" name="Philae">
${nodes}
    </visual_scene>
  </library_visual_scenes>
  <scene>
    <instance_visual_scene url="#PhilaeScene"/>
  </scene>
</COLLADA>
`
}

export function downloadFurnitureCad(state) {
  const master = buildMasterInput(state)
  const csv = masterInputToCsv(master)
  const dae = buildFurnitureCollada(state)
  const slug = String(master.quoteRef || 'meuble')
    .replace(/[^A-Za-z0-9_\-]+/g, '-')
    .replace(/^-|-$/g, '') || 'meuble'
  const base = `philae-${slug}`
  triggerDownload(
    `${base}.csv`,
    `\uFEFF${csv}`,
    'text/csv;charset=utf-8',
  )
  triggerDownload(`${base}.dae`, dae, 'model/vnd.collada+xml')
  return { csv, dae, base }
}
