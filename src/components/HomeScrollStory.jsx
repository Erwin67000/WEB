/**
 * Scrollytelling Philae — accueil (mode fixed).
 *
 *  01  Dessin de l’arête X : croix (0,0,0) → longueur 200 → ligne_arete croquis
 *      → traits configurateur + faces
 *  02  Arêtes Y & Z rejoignent le sommet (translation)
 *      + rotation vue 90° autour de Z (entre 02 et 03)
 *  03  Allongement paramétrique L/W/H
 *      + rotation vue +45° autour de Z (entre 03 et 04)
 *  04  9 arêtes restantes
 *  05  Tablettes
 *  06  Panneaux olive
 */
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '@texte/I18nProvider.jsx'
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber'
import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import {
  buildOssature,
  areteToBuffers,
} from '../1_STRUCTURE/01_meuble3D/ossature.js'
import {
  buildGeometrie,
  calcAreteX,
  ligne_arete,
} from '../1_STRUCTURE/00_matrice/matrice_geometrie.js'
import {
  buildPanneauComplet,
  buildTablette,
  createModule,
  moduleLayout,
} from '../1_STRUCTURE/02_agencement/agencement.js'
import {
  FINITIONS,
  PANNEAU_COULEURS,
  ARETE_EDGE_COLOR,
  ARETE_EDGE_WIDTH,
  EPAISSEUR_PANNEAU,
} from '../1_STRUCTURE/00_matrice/matrice_constante.js'

extend({ LineSegments2, LineSegmentsGeometry, LineMaterial })

const SCALE = 0.001
const WOOD = FINITIONS.chene.color
const PANEL = PANNEAU_COULEURS.olive.color
const PANEL_EDGE = PANNEAU_COULEURS.olive.edge
/** 1 viewport par phase (6 phases) — plus de course crème vide */
const SCROLL_PAGES = 6
/** Aligné sur STORY.length */
const N_PHASES = 6
const UNIT_MM = 200
const FINAL_L = 600
const FINAL_W = 400
const FINAL_H = 800
const PRIMARY_IDS = ['X0', 'Y0', 'Z0']

/** Les 9 arêtes hors coin d’origine X0/Y0/Z0 */
const REST_EDGE_IDS = [
  'X1',
  'X2',
  'Y1',
  'Y2',
  'Z1',
  'Z2',
  'X3',
  'Y3',
  'Z3',
]

const STORY = [
  { id: 'one' },
  { id: 'assemble' },
  { id: 'stretch' },
  { id: 'frame' },
  { id: 'shelves' },
  { id: 'panels' },
]

/** Couleur croquis (foncé sur fond ivoire) */
const SKETCH_COLOR = '#1a1610'
const SKETCH_WIDTH = 3.2

function clamp01(t) {
  return Math.min(1, Math.max(0, t))
}
function lerp(a, b, t) {
  return a + (b - a) * t
}
function easeInOut(t) {
  const x = clamp01(t)
  return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2
}
function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a || 1))
  return t * t * (3 - 2 * t)
}
function phase(p, start, end) {
  return easeInOut(smoothstep(start, end, p))
}

function getTrackProgress(trackEl) {
  if (!trackEl) return 0
  const rect = trackEl.getBoundingClientRect()
  const vh = window.innerHeight || 1
  const h = trackEl.offsetHeight || 0
  const total = h - vh
  if (total <= 1) return 0
  return clamp01(-rect.top / total)
}

/**
 * Construit les buffers d’une arête pour des dims données
 * (allongement le long de l’axe — profil non déformé).
 */
function meshDataForArete(id, L, W, H) {
  const { byId } = buildGeometrie({ L, W, H })
  const arete = byId[id]
  if (!arete) return null
  return { id, axis: arete.axis, ...areteToBuffers(arete.points) }
}

/**
 * Met à jour en place les buffers d’un groupe arête (solide + fils).
 * Topologie fixe → même longueur de buffers, positions recalculées.
 */
function applyAreteMeshData(group, meshData) {
  if (!group || !meshData?.positions) return
  group.traverse((obj) => {
    if (obj.isMesh && obj.geometry?.getAttribute?.('position')) {
      const pos = obj.geometry.getAttribute('position')
      if (pos.array.length === meshData.positions.length) {
        pos.array.set(meshData.positions)
        pos.needsUpdate = true
        obj.geometry.computeVertexNormals()
        obj.geometry.computeBoundingSphere?.()
      }
    }
    // LineSegments basique (pas LineSegments2)
    if (
      obj.isLineSegments &&
      obj.type !== 'LineSegments2' &&
      meshData.wire &&
      obj.geometry?.getAttribute?.('position')
    ) {
      const wpos = obj.geometry.getAttribute('position')
      if (wpos.array.length === meshData.wire.length) {
        wpos.array.set(meshData.wire)
        wpos.needsUpdate = true
        obj.geometry.computeBoundingSphere?.()
      }
    }
    // Contours épais
    if (
      (obj.isLine2 || obj.type === 'LineSegments2') &&
      meshData.wire &&
      obj.geometry?.setPositions
    ) {
      obj.geometry.setPositions(Array.from(meshData.wire))
    }
  })
}

/** Arête solide + ligne_arete (comme le configurateur). */
function AreteSolid({ meshData, color }) {
  const { size, gl } = useThree()
  const lineMatRef = useRef(null)

  // Rebuild complet quand meshData de départ change (montage)
  const solidGeo = useMemo(() => {
    if (!meshData?.positions) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(meshData.positions.slice(), 3),
    )
    g.setIndex(new THREE.BufferAttribute(meshData.indices.slice(), 1))
    g.computeVertexNormals()
    return g
  }, [meshData])

  const edgeBasic = useMemo(() => {
    if (!meshData?.wire) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(meshData.wire.slice(), 3),
    )
    return g
  }, [meshData])

  const edgeFat = useMemo(() => {
    if (!meshData?.wire) return null
    const g = new LineSegmentsGeometry()
    g.setPositions(Array.from(meshData.wire))
    return g
  }, [meshData])

  const dpr = gl.getPixelRatio?.() || 1
  const resW = Math.max(1, size.width * dpr)
  const resH = Math.max(1, size.height * dpr)

  useLayoutEffect(() => {
    const mat = lineMatRef.current
    if (mat?.resolution) mat.resolution.set(resW, resH)
  }, [resW, resH])

  useEffect(
    () => () => {
      solidGeo?.dispose()
      edgeBasic?.dispose()
      edgeFat?.dispose()
    },
    [solidGeo, edgeBasic, edgeFat],
  )

  if (!solidGeo) return null

  return (
    <group>
      <mesh geometry={solidGeo} renderOrder={0}>
        <meshStandardMaterial
          color={color}
          roughness={0.5}
          metalness={0.06}
          side={THREE.DoubleSide}
          transparent
          opacity={1}
          polygonOffset
          polygonOffsetFactor={2}
          polygonOffsetUnits={2}
        />
      </mesh>
      {edgeBasic && (
        <lineSegments geometry={edgeBasic} renderOrder={2}>
          <lineBasicMaterial
            color={ARETE_EDGE_COLOR}
            depthTest
            depthWrite={false}
            transparent
            opacity={1}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </lineSegments>
      )}
      {edgeFat && (
        <lineSegments2 geometry={edgeFat} renderOrder={3}>
          <lineMaterial
            ref={lineMatRef}
            color={ARETE_EDGE_COLOR}
            linewidth={ARETE_EDGE_WIDTH}
            transparent
            opacity={1}
            depthTest
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
            resolution={[resW, resH]}
          />
        </lineSegments2>
      )}
    </group>
  )
}

function setGroupOpacity(group, opacity) {
  if (!group) return
  const o = clamp01(opacity)
  group.visible = o > 0.015
  group.traverse((obj) => {
    if (obj.isMesh && obj.material) {
      obj.material.transparent = true
      obj.material.opacity = o
      obj.material.depthWrite = o > 0.9
    }
    if (obj.isLineSegments && obj.material) {
      obj.material.transparent = true
      obj.material.opacity = o
    }
    if (obj.isLine2 || obj.type === 'LineSegments2') {
      if (obj.material) {
        obj.material.transparent = true
        obj.material.opacity = o
      }
    }
  })
}

/** Opacité séparée faces (mesh) / contours (lignes) d’un groupe arête. */
function setAretePartsOpacity(group, solidOp, lineOp) {
  if (!group) return
  const so = clamp01(solidOp)
  const lo = clamp01(lineOp)
  group.visible = so > 0.015 || lo > 0.015
  group.traverse((obj) => {
    if (obj.isMesh && obj.material) {
      obj.material.transparent = true
      obj.material.opacity = so
      obj.material.depthWrite = so > 0.9
      obj.visible = so > 0.015
    }
    if (obj.isLineSegments && obj.material) {
      obj.material.transparent = true
      obj.material.opacity = lo
      obj.visible = lo > 0.015
    }
    if (obj.isLine2 || obj.type === 'LineSegments2') {
      if (obj.material) {
        obj.material.transparent = true
        obj.material.opacity = lo
        obj.visible = lo > 0.015
      }
    }
  })
}

/** Petits segments pointillés entre 2 points (mm). */
function buildDashedPositions(a, b, dashMm = 10, gapMm = 7) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const dz = b[2] - a[2]
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1
  const ux = dx / len
  const uy = dy / len
  const uz = dz / len
  const step = dashMm + gapMm
  const out = []
  let d = 0
  while (d < len) {
    const d1 = Math.min(d + dashMm, len)
    out.push(
      a[0] + ux * d,
      a[1] + uy * d,
      a[2] + uz * d,
      a[0] + ux * d1,
      a[1] + uy * d1,
      a[2] + uz * d1,
    )
    d += step
  }
  return out
}

/**
 * Révélation croquis arête X.
 * API : sketchApiRef.current.set({ pointA, dim, sketch, sketchW, dimFade })
 *  - pointA : premier point (origine)
 *  - dim    : 2e point + ligne pointillée (sans flèche ni libellé)
 *  - dimFade: disparaît au début de l’assemblage 3 arêtes
 */
function SketchRevealX({ sketchApiRef, unitL = UNIT_MM }) {
  const { size, gl } = useThree()
  const pointAMat = useRef(null)
  const pointBMat = useRef(null)
  const dashMat = useRef(null)
  const sketchMatRef = useRef(null)
  const dimGroupRef = useRef(null)

  const points = useMemo(() => calcAreteX(unitL), [unitL])
  const a0 = points[0] // (0,0,0)
  const a6 = points[6] // (L,0,0)

  // Croix / point marqueur (légèrement plus petite)
  const makeCrossGeo = (cx, cy, cz, s = 7) => {
    const g = new LineSegmentsGeometry()
    g.setPositions([
      cx - s, cy, cz, cx + s, cy, cz,
      cx, cy - s, cz, cx, cy + s, cz,
      cx, cy, cz - s, cx, cy, cz + s,
    ])
    return g
  }

  const crossAGeo = useMemo(
    () => makeCrossGeo(a0[0], a0[1], a0[2], 7.5),
    [a0],
  )
  const crossBGeo = useMemo(
    () => makeCrossGeo(a6[0], a6[1], a6[2], 7.5),
    [a6],
  )

  const dashGeo = useMemo(() => {
    const g = new LineSegmentsGeometry()
    g.setPositions(buildDashedPositions(a0, a6, 11, 8))
    return g
  }, [a0, a6])

  const sketchGeo = useMemo(() => {
    const arr = []
    for (const [i, j] of ligne_arete) {
      arr.push(
        points[i][0],
        points[i][1],
        points[i][2],
        points[j][0],
        points[j][1],
        points[j][2],
      )
    }
    const g = new LineSegmentsGeometry()
    g.setPositions(arr)
    return g
  }, [points])

  const dpr = gl.getPixelRatio?.() || 1
  const resW = Math.max(1, size.width * dpr)
  const resH = Math.max(1, size.height * dpr)

  useLayoutEffect(() => {
    for (const r of [pointAMat, pointBMat, dashMat, sketchMatRef]) {
      if (r.current?.resolution) r.current.resolution.set(resW, resH)
    }
  }, [resW, resH])

  useEffect(() => {
    sketchApiRef.current = {
      set({
        pointA = 0,
        dim = 0,
        sketch = 0,
        sketchW = SKETCH_WIDTH,
        dimFade = 1,
      }) {
        const d = clamp01(dim) * clamp01(dimFade)
        const a = clamp01(pointA) * clamp01(dimFade)

        if (pointAMat.current) {
          pointAMat.current.opacity = a
          pointAMat.current.visible = a > 0.02
          if (pointAMat.current.resolution) {
            pointAMat.current.resolution.set(resW, resH)
          }
        }
        if (pointBMat.current) {
          pointBMat.current.opacity = d
          pointBMat.current.visible = d > 0.02
          if (pointBMat.current.resolution) {
            pointBMat.current.resolution.set(resW, resH)
          }
        }
        if (dashMat.current) {
          dashMat.current.opacity = d
          dashMat.current.visible = d > 0.02
          if (dashMat.current.resolution) {
            dashMat.current.resolution.set(resW, resH)
          }
        }
        if (dimGroupRef.current) {
          dimGroupRef.current.visible = d > 0.02 || a > 0.02
        }

        if (sketchMatRef.current) {
          sketchMatRef.current.opacity = clamp01(sketch)
          sketchMatRef.current.linewidth = sketchW
          sketchMatRef.current.visible = sketch > 0.02
          if (sketchMatRef.current.resolution) {
            sketchMatRef.current.resolution.set(resW, resH)
          }
        }
      },
    }
    return () => {
      sketchApiRef.current = null
    }
  }, [sketchApiRef, resW, resH])

  useEffect(
    () => () => {
      crossAGeo.dispose()
      crossBGeo.dispose()
      dashGeo.dispose()
      sketchGeo.dispose()
    },
    [crossAGeo, crossBGeo, dashGeo, sketchGeo],
  )

  return (
    <group>
      {/* Point A — origine */}
      <lineSegments2 geometry={crossAGeo} renderOrder={6}>
        <lineMaterial
          ref={pointAMat}
          color={SKETCH_COLOR}
          linewidth={2.6}
          transparent
          opacity={0}
          depthTest
          depthWrite={false}
          resolution={[resW, resH]}
        />
      </lineSegments2>

      {/* Point B + pointillés (sans flèche ni libellé) */}
      <group ref={dimGroupRef} visible={false}>
        <lineSegments2 geometry={crossBGeo} renderOrder={6}>
          <lineMaterial
            ref={pointBMat}
            color={SKETCH_COLOR}
            linewidth={2.6}
            transparent
            opacity={0}
            depthTest
            depthWrite={false}
            resolution={[resW, resH]}
          />
        </lineSegments2>
        <lineSegments2 geometry={dashGeo} renderOrder={5}>
          <lineMaterial
            ref={dashMat}
            color={SKETCH_COLOR}
            linewidth={2.2}
            transparent
            opacity={0}
            depthTest
            depthWrite={false}
            resolution={[resW, resH]}
          />
        </lineSegments2>
      </group>

      {/* ligne_arete croquis */}
      <lineSegments2 geometry={sketchGeo} renderOrder={4}>
        <lineMaterial
          ref={sketchMatRef}
          color={SKETCH_COLOR}
          linewidth={SKETCH_WIDTH}
          transparent
          opacity={0}
          depthTest
          depthWrite={false}
          resolution={[resW, resH]}
        />
      </lineSegments2>
    </group>
  )
}

function PanneauSolid({ nom, dims }) {
  const data = useMemo(() => {
    try {
      return buildPanneauComplet(nom, dims, { epaisseur: 14 })
    } catch {
      return null
    }
  }, [nom, dims.L, dims.W, dims.H])

  const { geo, edgeGeo } = useMemo(() => {
    if (!data) return { geo: null, edgeGeo: null }
    const buf = data.panneau.toBuffers()
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(buf.positions, 3))
    g.setIndex(new THREE.BufferAttribute(buf.indices, 1))
    g.computeVertexNormals()
    const e = new THREE.BufferGeometry()
    e.setAttribute(
      'position',
      new THREE.BufferAttribute(buf.wire.slice(), 3),
    )
    return { geo: g, edgeGeo: e }
  }, [data])

  useEffect(
    () => () => {
      geo?.dispose()
      edgeGeo?.dispose()
    },
    [geo, edgeGeo],
  )
  if (!geo) return null

  return (
    <group>
      <mesh geometry={geo}>
        <meshStandardMaterial
          color={PANEL}
          roughness={0.55}
          metalness={0.04}
          side={THREE.DoubleSide}
          transparent
          opacity={1}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      {edgeGeo && (
        <lineSegments geometry={edgeGeo} renderOrder={2}>
          <lineBasicMaterial
            color={PANEL_EDGE}
            depthTest
            depthWrite={false}
            transparent
            opacity={1}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </lineSegments>
      )}
    </group>
  )
}

/** Tablette réelle : plateau octogone + 2 traverses bois (coords mm SketchUp). */
function TabletteSolid({ dims, zTopMm, plateColor, woodColor }) {
  const data = useMemo(() => {
    try {
      return buildTablette(dims, zTopMm, { epaisseurMm: EPAISSEUR_PANNEAU })
    } catch {
      return null
    }
  }, [dims.L, dims.W, dims.H, zTopMm])

  const parts = useMemo(() => {
    if (!data?.plate) return []
    const list = [
      {
        id: 'plate',
        positions: data.plate.positions,
        indices: data.plate.indices,
        wire: data.plate.wire,
        color: plateColor,
      },
      ...data.traverses.map((tr) => ({
        id: tr.id,
        positions: tr.positions,
        indices: tr.indices,
        wire: tr.wire,
        color: woodColor,
      })),
    ]
    return list.map((part) => {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute(
        'position',
        new THREE.BufferAttribute(part.positions.slice(), 3),
      )
      geo.setIndex(new THREE.BufferAttribute(part.indices.slice(), 1))
      geo.computeVertexNormals()
      const edgeGeo = new THREE.BufferGeometry()
      edgeGeo.setAttribute(
        'position',
        new THREE.BufferAttribute(part.wire.slice(), 3),
      )
      return { ...part, geo, edgeGeo }
    })
  }, [data, plateColor, woodColor])

  useEffect(
    () => () => {
      for (const p of parts) {
        p.geo.dispose()
        p.edgeGeo.dispose()
      }
    },
    [parts],
  )

  if (!parts.length) return null

  return (
    <group>
      {parts.map((p) => (
        <group key={p.id}>
          <mesh geometry={p.geo}>
            <meshStandardMaterial
              color={p.color}
              roughness={0.55}
              metalness={0.04}
              side={THREE.DoubleSide}
              transparent
              opacity={1}
              polygonOffset
              polygonOffsetFactor={1}
              polygonOffsetUnits={1}
            />
          </mesh>
          <lineSegments geometry={p.edgeGeo} renderOrder={2}>
            <lineBasicMaterial
              color={PANEL_EDGE}
              depthTest
              depthWrite={false}
              transparent
              opacity={1}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </lineSegments>
        </group>
      ))}
    </group>
  )
}

function StoryWorld({ progressRef }) {
  const primaryRefs = useRef({})
  const restRefs = useRef({})
  const shelvesGroup = useRef()
  const panelsGroup = useRef()
  const spinGroup = useRef()
  const sketchApiRef = useRef(null)

  const finalDims = { L: FINAL_L, W: FINAL_W, H: FINAL_H }

  const primaryMeshes = useMemo(() => {
    return PRIMARY_IDS.map((id) =>
      meshDataForArete(id, UNIT_MM, UNIT_MM, UNIT_MM),
    ).filter(Boolean)
  }, [])

  const ossEnd = useMemo(() => buildOssature(finalDims), [])
  const restMeshes = useMemo(
    () => ossEnd.meshes.filter((m) => REST_EDGE_IDS.includes(m.id)),
    [ossEnd],
  )
  const shelves = useMemo(
    () => [0, 1].map((i) => createModule('shelf', i)),
    [],
  )

  useFrame(({ camera }) => {
    const p = progressRef.current ?? 0
    const PH = 1 / N_PHASES

    // ——— Phases narratives ———
    // 01 : dessin arête X (sous-étapes)
    // 02 : Y+Z translation
    // 03 : allongement
    // 04 : 9 arêtes
    // 05–06 : tablettes / panneaux
    const pJoin = phase(p, PH * 0.92, PH * 2)
    const pStretch = phase(p, PH * 2, PH * 3)
    const pRest = phase(p, PH * 3, PH * 4)
    const pShelves = phase(p, PH * 4, PH * 5)
    const pPanels = phase(p, PH * 5, 0.995)

    // Progression brute 0→1 dans la phase 01 (pour le dessin)
    const tDraw = smoothstep(0, PH * 0.9, p)

    // Sous-étapes du dessin (01)
    // 1) premier point origine
    const pPointA = smoothstep(0.0, 0.1, tDraw)
    // 2) 2e point + ligne pointillée
    const pDim = smoothstep(0.1, 0.28, tDraw)
    // 3) ligne_arete croquis
    const pSketch = smoothstep(0.28, 0.52, tDraw)
    // 4) traits configurateur + faces (encore translucides)
    const pClean = smoothstep(0.48, 0.7, tDraw)
    const pFaces = smoothstep(0.6, 0.88, tDraw)
    // Croquis s’efface quand le solide / traits prennent le relais
    const sketchFade = 1 - smoothstep(0.6, 0.8, tDraw)

    // Cote dimension : disparaît dès le début de l’assemblage 3 arêtes
    const dimFade = 1 - smoothstep(0.02, 0.35, pJoin)

    const sketchW = lerp(SKETCH_WIDTH * 1.35, ARETE_EDGE_WIDTH, pClean)

    sketchApiRef.current?.set({
      pointA: Math.max(pPointA, pDim),
      dim: pDim,
      sketch: pSketch * sketchFade,
      sketchW,
      dimFade,
    })

    // ——— Dims (allongement phase 03) ———
    const L = lerp(UNIT_MM, FINAL_L, pStretch)
    const W = lerp(UNIT_MM, FINAL_W, pStretch)
    const H = lerp(UNIT_MM, FINAL_H, pStretch)

    for (const id of PRIMARY_IDS) {
      const data = meshDataForArete(id, L, W, H)
      applyAreteMeshData(primaryRefs.current[id], data)
    }

    // Translation Y0 / Z0 (phase 02)
    const approach = 320
    const tJoin = 1 - pJoin
    const y0off = [0, approach * tJoin, 0]
    const z0off = [0, 0, approach * tJoin]

    const setPrim = (id, posMm) => {
      const g = primaryRefs.current[id]
      if (!g) return
      g.position.set(posMm[0], posMm[1], posMm[2])
      g.rotation.set(0, 0, 0)
    }

    // Rotation vue : entre 02 et 03 → +90° ; entre 03 et 04 → +45°
    // Pendant la rotation 90°, les 3 arêtes passent de translucides → opaque final
    const rot90T = phase(p, PH * 1.75, PH * 2.2)
    const rot90 = rot90T * (Math.PI / 2)
    const rot45 = phase(p, PH * 2.75, PH * 3.25) * (Math.PI / 4)
    if (spinGroup.current) {
      spinGroup.current.rotation.y = rot90 + rot45
    }

    // Solides translucides pour laisser lire la géométrie, puis opaque à rot90
    const GHOST = 0.28
    const solidOp = lerp(GHOST, 1, rot90T)

    setPrim('X0', [0, 0, 0])
    // Faces X0 : apparaissent avec pFaces, restent ghost jusqu’à rot90
    setAretePartsOpacity(
      primaryRefs.current.X0,
      pFaces * solidOp,
      Math.max(pClean, pFaces * 0.85),
    )

    setPrim('Y0', y0off)
    setPrim('Z0', z0off)
    // Y0 / Z0 : lignes nettes + faces ghost → opaque à la rotation 90°
    setAretePartsOpacity(
      primaryRefs.current.Y0,
      pJoin * solidOp,
      pJoin,
    )
    setAretePartsOpacity(
      primaryRefs.current.Z0,
      pJoin * solidOp,
      pJoin,
    )

    // 9 arêtes
    REST_EDGE_IDS.forEach((id, i) => {
      const g = restRefs.current[id]
      if (!g) return
      const n = REST_EDGE_IDS.length
      const slot = 1 / n
      const start = i * slot * 0.78
      const end = start + slot * 1.25
      setGroupOpacity(g, smoothstep(start, end, pRest))
    })

    // Tablettes (octogone + 2 traverses)
    if (shelvesGroup.current) {
      shelvesGroup.current.visible = pShelves > 0.02
      shelvesGroup.current.children.forEach((child, i) => {
        const oShelf = clamp01((pShelves - i * 0.22) / 0.55)
        setGroupOpacity(child, oShelf)
      })
    }

    // Panneaux
    if (panelsGroup.current) {
      panelsGroup.current.visible = pPanels > 0.02
      panelsGroup.current.children.forEach((child, groupIdx) => {
        const oP =
          groupIdx === 0
            ? smoothstep(PH * 5, PH * 5 + PH * 0.55, p)
            : smoothstep(PH * 5 + PH * 0.35, 0.99, p)
        setGroupOpacity(child, oP)
      })
    }

    // ——— Caméra ———
    const tx = (L * SCALE) / 2
    const ty = (H * SCALE) / 2
    const tz = -(W * SCALE) / 2

    // Phase dessin : cadrage proche de l’origine / longueur X
    const originTarget = new THREE.Vector3(0, 20 * SCALE, -15 * SCALE)
    const soloTarget = new THREE.Vector3(
      UNIT_MM * 0.45 * SCALE,
      40 * SCALE,
      -40 * SCALE,
    )
    const finalTarget = new THREE.Vector3(tx, ty, tz)

    const lookDraw = originTarget
      .clone()
      .lerp(soloTarget, Math.max(pDim, pSketch))
    const zoomOut = phase(p, PH * 0.85, PH * 2)
    const look = lookDraw
      .clone()
      .lerp(finalTarget, Math.max(zoomOut, pStretch))

    const drawDist = lerp(0.32, 0.48, Math.max(pDim, pSketch, pFaces))
    const joinedDist = 0.9
    const finalDist =
      Math.max(1.05, Math.sqrt(L * L + W * W + H * H) * SCALE * 1.22) * 1.05

    const dist = lerp(
      lerp(drawDist, joinedDist, zoomOut),
      finalDist,
      pStretch,
    )

    // À partir du LEVEL 03 : le meuble descend dans le cadre
    // (sens inverse : caméra plus basse, regard un peu plus haut).
    const frameDown = lerp(0, 0.38, pStretch)
    look.y += frameDown * 0.22

    // Angle caméra de base (la rotation modèle gère 90° / +45°)
    const ang = -0.85 + pJoin * 0.2 + pStretch * 0.35

    const camGoal = new THREE.Vector3(
      look.x + Math.cos(ang) * dist,
      look.y + dist * (0.32 + pStretch * 0.1) - frameDown,
      look.z + Math.sin(ang) * dist,
    )
    camera.position.lerp(camGoal, 0.1)
    camera.lookAt(look)
  })

  return (
    <group>
      {/*
        spinGroup : rotation autour de l’axe vertical (Z SketchUp)
        entre phases 02→03 (+90°) et 03→04 (+45°).
      */}
      <group ref={spinGroup}>
        <group scale={[SCALE, SCALE, SCALE]} rotation={[-Math.PI / 2, 0, 0]}>
          {/* Croquis progressif arête X */}
          <SketchRevealX sketchApiRef={sketchApiRef} unitL={UNIT_MM} />

          {/* Solides configurateur X0 Y0 Z0 */}
          {primaryMeshes.map((m) => (
            <group
              key={`p-${m.id}`}
              ref={(el) => {
                if (el) primaryRefs.current[m.id] = el
              }}
              visible={false}
            >
              <AreteSolid meshData={m} color={WOOD} />
            </group>
          ))}

          {/* 9 arêtes restantes */}
          {restMeshes.map((m) => (
            <group
              key={`r-${m.id}`}
              ref={(el) => {
                if (el) restRefs.current[m.id] = el
              }}
              visible={false}
            >
              <AreteSolid meshData={m} color={WOOD} />
            </group>
          ))}

          {/* Panneaux (même repère SketchUp) */}
          <group ref={panelsGroup} visible={false}>
            <group>
              <PanneauSolid nom="dessus_exterieur" dims={finalDims} />
            </group>
            <group>
              <PanneauSolid nom="dessous" dims={finalDims} />
            </group>
          </group>

          {/* Tablettes : octogone + 2 traverses bois */}
          <group ref={shelvesGroup} visible={false}>
            {shelves.map((mod) => {
              const layout = moduleLayout(mod, finalDims, shelves)
              const zTop =
                layout.zTopMm ?? layout.zMm ?? layout.center[2]
              return (
                <group key={mod.id}>
                  <TabletteSolid
                    dims={finalDims}
                    zTopMm={zTop}
                    plateColor={PANEL}
                    woodColor={WOOD}
                  />
                </group>
              )
            })}
          </group>
        </group>
      </group>
    </group>
  )
}

function StoryScene({ progressRef }) {
  return (
    <>
      <color attach="background" args={['#f5f0e6']} />
      <ambientLight intensity={0.5} />
      <hemisphereLight args={['#e8f0ff', '#2a2010', 0.42]} />
      <directionalLight position={[4, 6, 3]} intensity={1.4} color="#fff5e6" />
      <directionalLight position={[-3, 2, -4]} intensity={0.35} />
      <StoryWorld progressRef={progressRef} />
    </>
  )
}

/**
 * @param {{ mode?: 'fixed' | 'sticky', showExit?: boolean }} props
 */
/**
 * Fondu texte :
 * - entrée rapide (~1 scroll)
 * - reste bien visible au milieu de l’étape
 * - sortie seulement sur le dernier demi-scroll
 */
const TEXT_FADE_IN_SCROLLS = 0.65
const TEXT_FADE_OUT_SCROLLS = 0.35

export default function HomeScrollStory({
  mode = 'fixed',
  showExit = false,
  onProgress,
}) {
  const { t } = useI18n()
  const trackRef = useRef(null)
  const stageRef = useRef(null)
  const progressRef = useRef(0)
  const copyRef = useRef(null)
  const onProgressRef = useRef(onProgress)
  onProgressRef.current = onProgress
  const [chapter, setChapter] = useState(0)
  const [hudP, setHudP] = useState(0)
  const isFixed = mode === 'fixed'

  useEffect(() => {
    const el = trackRef.current
    if (!el) return

    let raf = 0
    let alive = true
    let lastCh = -1
    let lastHudBucket = -1

    const loop = () => {
      if (!alive) return
      const p = getTrackProgress(el)
      progressRef.current = p

      // Visible seulement pendant le track :
      //  — masqué tant que le manifeste (au-dessus) occupe l’écran
      //  — masqué une fois le track passé → visualiseur / footer
      const stage = stageRef.current
      if (stage) {
        const rect = el.getBoundingClientRect()
        const vh = window.innerHeight || 1
        const headerH = parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            '--header-current-h',
          ),
        ) || 72
        if (rect.bottom <= 0 || rect.top >= vh) {
          stage.style.opacity = '0'
          stage.style.visibility = 'hidden'
          stage.style.pointerEvents = 'none'
        } else if (rect.top > headerH + 8) {
          // Track pas encore entré — manifeste encore à l’écran
          stage.style.opacity = '0'
          stage.style.visibility = 'hidden'
          stage.style.pointerEvents = 'none'
        } else if (rect.bottom < vh * 0.35) {
          const o = clamp01(rect.bottom / (vh * 0.35))
          stage.style.opacity = String(o)
          stage.style.visibility = 'visible'
          stage.style.pointerEvents = 'none'
        } else {
          stage.style.opacity = '1'
          stage.style.visibility = 'visible'
          stage.style.pointerEvents = 'none'
        }
      }

      const ch = Math.min(
        STORY.length - 1,
        Math.floor(p * STORY.length + 0.001),
      )
      if (ch !== lastCh) {
        lastCh = ch
        setChapter(ch)
      }

      // HUD + callback parent (throttle ~2 %)
      const bucket = Math.floor(p * 50)
      if (bucket !== lastHudBucket) {
        lastHudBucket = bucket
        setHudP(p)
        onProgressRef.current?.({ chapter: ch, progress: p })
      }

      // Fondu : visible plus longtemps au centre de l’étape
      const chapterStart = ch / STORY.length
      const chapterEnd = (ch + 1) / STORY.length
      const scrollsInto = Math.max(0, p - chapterStart) * SCROLL_PAGES
      const scrollsLeft = Math.max(0, chapterEnd - p) * SCROLL_PAGES

      const fadeIn = easeInOut(
        clamp01(scrollsInto / TEXT_FADE_IN_SCROLLS),
      )
      const fadeOut =
        ch < STORY.length - 1
          ? easeInOut(clamp01(scrollsLeft / TEXT_FADE_OUT_SCROLLS))
          : 1
      const op = Math.min(fadeIn, fadeOut)

      if (copyRef.current) {
        copyRef.current.style.opacity = String(op)
      }

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [])

  const ch = STORY[chapter]
  const chKicker = t(`story.${ch.id}.kicker`)
  const chTitle = t(`story.${ch.id}.title`)
  const chText = t(`story.${ch.id}.text`)
  const trackVh = SCROLL_PAGES * 100

  /** Scroll au début de l’étape i (progression = i / N) */
  const goToChapter = (i) => {
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0
    const docTop = scrollY + rect.top
    const h = el.offsetHeight || 0
    const vh = window.innerHeight || 1
    const total = Math.max(1, h - vh)
    const p = clamp01(i / STORY.length)
    const y = docTop + p * total + 2
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' })
  }

  const stage = (
    <>
      <div className="home-story-canvas" aria-hidden>
        <Canvas
          dpr={[1, 1.5]}
          camera={{
            position: [1.6, 1.1, 2.0],
            fov: 42,
            near: 0.01,
            far: 80,
          }}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            alpha: false,
          }}
          style={{ pointerEvents: 'none' }}
          onCreated={({ gl }) => {
            gl.domElement.style.pointerEvents = 'none'
            gl.domElement.style.touchAction = 'pan-y'
          }}
        >
          <Suspense fallback={null}>
            <StoryScene progressRef={progressRef} />
          </Suspense>
        </Canvas>
      </div>

      <div className="home-story-overlay">
        {/* HUD gamifié — coin haut droit */}
        <div className="home-story-hud">
          <div className="home-story-hud-row">
            <span className="home-story-hud-label">{t('story.hudLabel')}</span>
            <span className="home-story-hud-pct">
              {Math.round(hudP * 100)}%
            </span>
          </div>
          <div className="home-story-hud-bar">
            <i style={{ width: `${Math.round(hudP * 100)}%` }} />
          </div>
          <div
            className="home-story-hud-pips"
            role="group"
            aria-label={t('story.chaptersAria')}
          >
            {STORY.map((s, i) => {
              const kicker = t(`story.${s.id}.kicker`)
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`home-story-hud-pip${
                    i < chapter ? ' done' : i === chapter ? ' active' : ''
                  }`}
                  onClick={() => goToChapter(i)}
                  aria-current={i === chapter ? 'step' : undefined}
                  title={t('story.goTo', { kicker })}
                  aria-label={t('story.goTo', { kicker })}
                />
              )
            })}
          </div>
        </div>

        <div
          key={chapter}
          ref={copyRef}
          className="home-story-copy home-story-copy-stack"
        >
          <div className="home-story-head">
            <p className="section-kicker home-story-kicker">{chKicker}</p>
            <h2 className="home-story-title">{chTitle}</h2>
          </div>
          <p className="home-story-text">{chText}</p>
        </div>
      </div>

      {showExit && (
        <Link to="/concept" className="home-story-exit">
          Le concept →
        </Link>
      )}
    </>
  )

  if (isFixed) {
    return (
      <div
        className="home-story home-story--fixed home-story--with-header"
        aria-label={t('story.aria')}
      >
        <div ref={stageRef} className="home-story-stage">
          {stage}
        </div>
        <div
          ref={trackRef}
          className="home-story-track"
          style={{ height: `${trackVh}vh` }}
          aria-hidden
        />
      </div>
    )
  }

  return (
    <section
      ref={trackRef}
      className="home-story home-story--sticky"
      aria-label={t('story.aria')}
      style={{ height: `${trackVh}vh` }}
    >
      <div className="home-story-sticky">{stage}</div>
      <div
        className="home-story-scroll-space"
        style={{ height: `${(SCROLL_PAGES - 1) * 100}vh` }}
        aria-hidden
      />
    </section>
  )
}
