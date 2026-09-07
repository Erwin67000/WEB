/**
 * Export local : Collada (*.dae) + CSV géométrie réelle du configurateur.
 * DAE en millimètres, Z-up (SketchUp).
 * Panneaux = cases entre tablettes / tiroirs (pas le plein-face).
 */
import { buildOssature } from '../1_STRUCTURE/01_meuble3D/ossature.js'
import {
  buildPanneauComplet,
  face_panneau,
  moduleLayout,
  buildTablette,
  buildTiroir,
  faceGroupsForUnit,
  faceGroupBuildParams,
  porteGroupsForUnit,
  porteGroupBuildParams,
  porteXSplit,
  SEGMENTED_FACES,
} from '../1_STRUCTURE/02_agencement/agencement.js'
import {
  EPAISSEUR_PANNEAU,
  EPAISSEUR_PORTE,
} from '../1_STRUCTURE/00_matrice/matrice_constante.js'
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

function csvCell(v) {
  if (v == null) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function toMesh(id, name, positions, indices, points) {
  const pos = positions
    ? Array.from(positions)
    : (points || []).flatMap((p) => [p[0], p[1], p[2]])
  const idx = indices ? Array.from(indices) : face_panneau.flat()
  const pts =
    points ||
    (() => {
      const out = []
      for (let i = 0; i < pos.length; i += 3) {
        out.push([pos[i], pos[i + 1], pos[i + 2]])
      }
      return out
    })()
  return { id, name, positions: pos, indices: idx, points: pts }
}

function panneauToMesh(id, name, panneau) {
  if (!panneau?.points) return null
  return toMesh(
    id,
    name,
    panneau.positions,
    panneau.indices,
    panneau.points,
  )
}

function collectUnitMeshes(unit, state) {
  const meshes = []
  const dims = unit.dims
  const modules = unit.modules || []
  const epP = Number(state.epaisseurPanneau ?? EPAISSEUR_PANNEAU)
  const epD = Number(state.epaisseurPorte ?? EPAISSEUR_PORTE)

  const oss = buildOssature(dims)
  for (const m of oss.meshes) {
    meshes.push(
      toMesh(`ossature-${m.id}`, m.id, m.positions, m.indices),
    )
  }

  const selected = unit.panneaux || []
  for (const nom of selected) {
    if (nom === 'porte' || SEGMENTED_FACES.includes(nom)) continue
    try {
      const { panneau } = buildPanneauComplet(nom, dims, {
        epaisseur: nom === 'porte' ? epD : epP,
      })
      const mesh = panneauToMesh(`panneau-${nom}`, nom, panneau)
      if (mesh) meshes.push(mesh)
    } catch {
      /* panneau inconnu */
    }
  }

  for (const nom of SEGMENTED_FACES) {
    const groups = faceGroupsForUnit(unit, nom)
    groups.forEach((g, gi) => {
      try {
        const params = faceGroupBuildParams(g, dims, modules)
        const { panneau } = buildPanneauComplet(nom, dims, {
          epaisseur: epP,
          ...params,
        })
        const mesh = panneauToMesh(
          `panneau-${nom}-${g.key || gi}`,
          `${nom} ${g.key || gi}`,
          panneau,
        )
        if (mesh) meshes.push(mesh)
      } catch {
        /* ignore */
      }
    })
  }

  const split = porteXSplit(dims)
  for (const g of porteGroupsForUnit(unit)) {
    const hinge = unit.porteHinge?.[g.key] || 'left'
    const leaves =
      hinge === 'center'
        ? [
            { tag: 'L', extra: { xMax: split.xMid } },
            { tag: 'R', extra: { xMin: split.xMid } },
          ]
        : [{ tag: hinge, extra: {} }]
    for (const leaf of leaves) {
      try {
        const params = porteGroupBuildParams(g, dims, modules, leaf.extra)
        const { panneau } = buildPanneauComplet('porte', dims, {
          epaisseur: epD,
          ...params,
        })
        const mesh = panneauToMesh(
          `porte-${g.key}-${leaf.tag}`,
          `porte ${g.key} ${leaf.tag}`,
          panneau,
        )
        if (mesh) meshes.push(mesh)
      } catch {
        /* ignore */
      }
    }
  }

  modules.forEach((mod, i) => {
    if (mod.kind === 'shelf') {
      try {
        const layout = moduleLayout(mod, dims, modules)
        const zTop = layout.zTopMm ?? layout.zMm
        const data = buildTablette(dims, zTop, { epaisseurMm: epP })
        if (data?.plate) {
          meshes.push(
            toMesh(
              `tablette-${i + 1}`,
              `tablette ${i + 1}`,
              data.plate.positions,
              data.plate.indices,
              data.plate.points,
            ),
          )
        }
        ;(data?.traverses || []).forEach((tr, ti) => {
          meshes.push(
            toMesh(
              `tablette-${i + 1}-traverse-${tr.side || ti}`,
              `traverse tablette ${i + 1} ${tr.side || ti}`,
              tr.positions,
              tr.indices,
              tr.points,
            ),
          )
        })
      } catch {
        /* ignore */
      }
    }

    if (mod.kind === 'drawer') {
      try {
        const layout = moduleLayout(mod, dims, modules)
        const data = buildTiroir(dims, layout, mod, { epaisseurMm: epP })
        if (data?.lwkOutOfRange || data?.depthTooSmall) return
        ;(data.traverses || []).forEach((tr, ti) => {
          meshes.push(
            toMesh(
              `tiroir-${i + 1}-traverse-${tr.side || ti}`,
              `traverse tiroir ${i + 1} ${tr.side || ti}`,
              tr.positions,
              tr.indices,
              tr.points,
            ),
          )
        })
        ;(data.box?.panels || []).forEach((p, pi) => {
          meshes.push(
            toMesh(
              `tiroir-${i + 1}-${p.id || pi}`,
              `tiroir ${i + 1} ${p.id || pi}`,
              p.positions,
              p.indices,
              p.points,
            ),
          )
        })
      } catch {
        /* ignore */
      }
    }
  })

  return meshes
}

function geometryXml(mesh) {
  const id = safeId(mesh.id)
  const pos = mesh.positions
  const idx = mesh.indices
  const vcount = Math.floor(pos.length / 3)
  const tcount = Math.floor(idx.length / 3)
  if (!vcount || !tcount) return ''
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
  const geoms = all.map(geometryXml).filter(Boolean).join('\n')
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

function appendGeomCsv(csv, state) {
  const extra = []
  const push = (row) => extra.push(row.map(csvCell).join(','))
  ;(state.units || []).forEach((unit, ui) => {
    collectUnitMeshes(unit, state).forEach((mesh) => {
      ;(mesh.points || []).forEach((p, pi) => {
        push([
          'geom_point',
          ui,
          unit.id,
          mesh.id,
          '',
          pi,
          p[0],
          p[1],
          p[2],
          mesh.name || '',
        ])
      })
    })
  })
  if (!extra.length) return csv
  return `${csv}\n${extra.join('\n')}`
}

export function downloadFurnitureCad(state) {
  const master = buildMasterInput(state)
  const csv = appendGeomCsv(masterInputToCsv(master), state)
  const dae = buildFurnitureCollada(state)
  const slug =
    String(master.quoteRef || 'meuble')
      .replace(/[^A-Za-z0-9_\-]+/g, '-')
      .replace(/^-|-$/g, '') || 'meuble'
  const base = `philae-${slug}`
  triggerDownload(`${base}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8')
  triggerDownload(`${base}.dae`, dae, 'model/vnd.collada+xml')
  return { csv, dae, base }
}
