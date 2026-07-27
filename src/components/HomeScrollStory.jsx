/**
 * Scrollytelling Philae — page /histoire (mode fixed).
 *
 * ~12 viewports de scroll (6 phases × ~2 écrans) pour des animations plus douces.
 *
 *  01  Une arête 200 mm, légère rotation autour de Z
 *  02  Dézoom + 2 arêtes 200 mm en translation pure (sommet)
 *  03  Allongement paramétrique L/W/H (géométrie reconstruite, pas de scale)
 *  04  Les 9 autres arêtes apparaissent en séquence
 *  05  Deux tablettes (fonctions)
 *  06  Plateau & socle olive (panneaux)
 */
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber'
import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import {
  buildOssature,
  areteToBuffers,
} from '../1_STRUCTURE/01_meuble3D/ossature.js'
import { buildGeometrie } from '../1_STRUCTURE/00_matrice/matrice_geometrie.js'
import {
  buildPanneauComplet,
  createModule,
  moduleLayout,
} from '../1_STRUCTURE/02_agencement/agencement.js'
import {
  FINITIONS,
  PANNEAU_COULEURS,
  ARETE_EDGE_COLOR,
  ARETE_EDGE_WIDTH,
} from '../1_STRUCTURE/00_matrice/matrice_constante.js'

extend({ LineSegments2, LineSegmentsGeometry, LineMaterial })

const SCALE = 0.001
const WOOD = FINITIONS.chene.color
const PANEL = PANNEAU_COULEURS.olive.color
const PANEL_EDGE = PANNEAU_COULEURS.olive.edge
/** Longueur totale du track ≈ 12 viewports (animations mieux définies) */
const SCROLL_PAGES = 12
/** 6 phases narratives, chacune ≈ 2 viewports */
const N_PHASES = 6
const UNIT_MM = 200
const FINAL_L = 600
const FINAL_W = 400
const FINAL_H = 800

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
  {
    id: 'one',
    kicker: '01 · Origine',
    title: 'L’arête parfaite',
    text: 'Une arête de 200 mm — bois massif coupé selon l’angle signature PHILAE.',
  },
  {
    id: 'assemble',
    kicker: '02 · Sommet',
    title: 'La configuration au sommet',
    text: 'Deux arêtes de 200 mm rejoignent la première. Trois profils forment le sommet.',
  },
  {
    id: 'stretch',
    kicker: '03 · Étirement',
    title: 'Le volume s’étire',
    text: 'Les trois arêtes s’allongent de 200 mm jusqu’à 600 × 400 × 800 mm.',
  },
  {
    id: 'frame',
    kicker: '04 · Ossature',
    title: '12 arêtes',
    text: 'Les neuf autres arêtes complètent l’ossature et ferment le volume.',
  },
  {
    id: 'shelves',
    kicker: '05 · Fonctions',
    title: 'Les fonctions sont ajoutées',
    text: 'Configuration unique pour respecter les besoins.',
  },
  {
    id: 'panels',
    kicker: '06 · Finitions',
    title: 'Panneaux',
    text: 'Les panneaux complètent le volume.',
  },
]

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
 * Arête solide + ligne_arete.
 * Si `live` : les buffers sont mis à jour en place quand meshData change
 * (même topologie, positions recalculées via L/W/H).
 */
function AreteSolid({ meshData, color, live = false }) {
  const { size, gl } = useThree()
  const lineMatRef = useRef(null)
  const solidGeoRef = useRef(null)
  const edgeBasicRef = useRef(null)
  const edgeFatRef = useRef(null)

  // Géométries stables (topologie fixe)
  const solidGeo = useMemo(() => {
    if (!meshData?.positions) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(meshData.positions.slice(), 3),
    )
    g.setIndex(new THREE.BufferAttribute(meshData.indices.slice(), 1))
    g.computeVertexNormals()
    solidGeoRef.current = g
    return g
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- init once

  const edgeBasic = useMemo(() => {
    if (!meshData?.wire) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(meshData.wire.slice(), 3),
    )
    edgeBasicRef.current = g
    return g
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const edgeFat = useMemo(() => {
    if (!meshData?.wire) return null
    const g = new LineSegmentsGeometry()
    g.setPositions(Array.from(meshData.wire))
    edgeFatRef.current = g
    return g
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Mise à jour live des positions (allongement paramétrique)
  useLayoutEffect(() => {
    if (!meshData) return
    const sg = solidGeoRef.current
    if (sg) {
      const pos = sg.getAttribute('position')
      if (pos && pos.array.length === meshData.positions.length) {
        pos.array.set(meshData.positions)
        pos.needsUpdate = true
        sg.computeVertexNormals()
        sg.computeBoundingSphere()
      }
    }
    const eb = edgeBasicRef.current
    if (eb && meshData.wire) {
      const wpos = eb.getAttribute('position')
      if (wpos && wpos.array.length === meshData.wire.length) {
        wpos.array.set(meshData.wire)
        wpos.needsUpdate = true
        eb.computeBoundingSphere()
      }
    }
    const ef = edgeFatRef.current
    if (ef && meshData.wire) {
      ef.setPositions(Array.from(meshData.wire))
    }
  }, [meshData, live])

  // Init non-live : rebuild si meshData change d’identité
  useLayoutEffect(() => {
    if (live || !meshData || !solidGeoRef.current) return
    const pos = solidGeoRef.current.getAttribute('position')
    if (pos && pos.array.length === meshData.positions.length) {
      pos.array.set(meshData.positions)
      pos.needsUpdate = true
      solidGeoRef.current.computeVertexNormals()
    }
    if (edgeBasicRef.current && meshData.wire) {
      const wpos = edgeBasicRef.current.getAttribute('position')
      if (wpos) {
        wpos.array.set(meshData.wire)
        wpos.needsUpdate = true
      }
    }
    if (edgeFatRef.current && meshData.wire) {
      edgeFatRef.current.setPositions(Array.from(meshData.wire))
    }
  }, [meshData, live])

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

function StoryWorld({ progressRef }) {
  const primaryRefs = useRef({})
  const restRefs = useRef({})
  const shelvesGroup = useRef()
  const panelsGroup = useRef()

  const finalDims = { L: FINAL_L, W: FINAL_W, H: FINAL_H }

  // Dims courantes du coin (paramétriques — pas de scale non-uniforme)
  const [cornerDims, setCornerDims] = useState({
    L: UNIT_MM,
    W: UNIT_MM,
    H: UNIT_MM,
  })
  const cornerKeyRef = useRef(`${UNIT_MM}|${UNIT_MM}|${UNIT_MM}`)

  // Cadre final pour les 9 arêtes restantes
  const ossEnd = useMemo(() => buildOssature(finalDims), [])
  const shelves = useMemo(
    () => [0, 1].map((i) => createModule('shelf', i)),
    [],
  )

  // 3 arêtes d’origine : géométrie reconstruite à chaque L/W/H
  const primaryMeshes = useMemo(() => {
    const { L, W, H } = cornerDims
    return ['X0', 'Y0', 'Z0']
      .map((id) => meshDataForArete(id, L, W, H))
      .filter(Boolean)
  }, [cornerDims.L, cornerDims.W, cornerDims.H])

  const restMeshes = useMemo(
    () => ossEnd.meshes.filter((m) => REST_EDGE_IDS.includes(m.id)),
    [ossEnd],
  )

  useFrame(({ camera }) => {
    const p = progressRef.current ?? 0
    // 6 phases narratives, chacune ≈ 2 viewports sur un track de 12
    const PH = 1 / N_PHASES

    // 01 — une arête 200 mm (grand plan, spin Z) · ~2 écrans
    const pSolo = phase(p, 0.0, PH * 0.95)
    // 02 — dézoom + 2 arêtes 200 mm en translation · ~2 écrans
    const pJoin = phase(p, PH * 0.88, PH * 2)
    // 03 — allongement paramétrique L/W/H · ~2 écrans
    const pStretch = phase(p, PH * 2, PH * 3)
    // 04 — 9 arêtes séquentielles · ~2 écrans
    const pRest = phase(p, PH * 3, PH * 4)
    // 05 — tablettes · ~2 écrans
    const pShelves = phase(p, PH * 4, PH * 5)
    // 06 — panneaux · ~2 écrans
    const pPanels = phase(p, PH * 5, 0.995)

    // ——— Dims paramétriques (allongement le long de chaque axe) ———
    // X0 s’allonge avec L, Y0 avec W, Z0 avec H — profils non déformés
    const L = lerp(UNIT_MM, FINAL_L, pStretch)
    const W = lerp(UNIT_MM, FINAL_W, pStretch)
    const H = lerp(UNIT_MM, FINAL_H, pStretch)

    // Quantize 1 mm → rebuild géométrie sans flood de setState
    const qL = Math.round(L)
    const qW = Math.round(W)
    const qH = Math.round(H)
    const key = `${qL}|${qW}|${qH}`
    if (key !== cornerKeyRef.current) {
      cornerKeyRef.current = key
      setCornerDims({ L: qL, W: qW, H: qH })
    }

    // Offsets translation (mm SketchUp) — pure translation, à 200 mm
    const approach = 320
    const tJoin = 1 - pJoin // 1 = loin, 0 = en place
    const y0off = [0, approach * tJoin, 0]
    const z0off = [0, 0, approach * tJoin]

    // X0 : spin léger autour de Z pendant le solo, s’arrête à l’emboîtement
    const spinZ = (1 - pSolo) * 0.55 * (1 - pJoin * 0.85)

    const setPrim = (id, posMm, rot = [0, 0, 0]) => {
      const g = primaryRefs.current[id]
      if (!g) return
      g.position.set(posMm[0], posMm[1], posMm[2])
      g.rotation.set(rot[0], rot[1], rot[2])
    }

    // X0 en place dès le début
    setPrim('X0', [0, 0, 0], [0, 0, spinZ])
    setGroupOpacity(primaryRefs.current.X0, Math.max(pSolo, 0.02))

    // Y0 / Z0 : translation pure, pas de rotation
    setPrim('Y0', y0off, [0, 0, 0])
    setPrim('Z0', z0off, [0, 0, 0])
    setGroupOpacity(primaryRefs.current.Y0, pJoin)
    setGroupOpacity(primaryRefs.current.Z0, pJoin)

    // 9 arêtes restantes — séquentiel (taille finale)
    REST_EDGE_IDS.forEach((id, i) => {
      const g = restRefs.current[id]
      if (!g) return
      const n = REST_EDGE_IDS.length
      const slot = 1 / n
      const start = i * slot * 0.78
      const end = start + slot * 1.25
      const o = smoothstep(start, end, pRest)
      setGroupOpacity(g, o)
    })

    // 2 tablettes
    if (shelvesGroup.current) {
      shelvesGroup.current.visible = pShelves > 0.02
      shelvesGroup.current.traverse((o) => {
        if (!o.material || o.userData.shelfIndex == null) return
        const i = o.userData.shelfIndex
        const oShelf = clamp01((pShelves - i * 0.22) / 0.55)
        o.material.transparent = true
        o.material.opacity = oShelf
        if (o.isMesh) o.material.depthWrite = oShelf > 0.9
        o.visible = oShelf > 0.02
      })
    }

    // Panneaux olive
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

    const soloTarget = new THREE.Vector3(
      UNIT_MM * 0.5 * SCALE,
      35 * SCALE,
      -35 * SCALE,
    )
    const finalTarget = new THREE.Vector3(tx, ty, tz)

    const zoomOut = phase(p, PH * 0.85, PH * 2)
    const look = soloTarget
      .clone()
      .lerp(finalTarget, Math.max(zoomOut, pStretch))

    const soloDist = 0.38
    const joinedDist = 0.88
    const finalDist =
      Math.max(1.05, Math.sqrt(L * L + W * W + H * H) * SCALE * 1.22) * 1.05

    const dist = lerp(
      lerp(soloDist, joinedDist, zoomOut),
      finalDist,
      pStretch,
    )

    const ang = -0.95 + pJoin * 0.25 + pStretch * 0.55 + pRest * 0.25

    const camGoal = new THREE.Vector3(
      look.x + Math.cos(ang) * dist,
      look.y + dist * (0.28 + pStretch * 0.12),
      look.z + Math.sin(ang) * dist,
    )
    camera.position.lerp(camGoal, 0.08)
    camera.lookAt(look)
  })

  return (
    <group>
      {/*
        Coin X0/Y0/Z0 — géométrie reconstruite via L/W/H (calcAreteX/Y/Z).
        Pas de scale non-uniforme : le profil reste correct.
      */}
      <group scale={[SCALE, SCALE, SCALE]} rotation={[-Math.PI / 2, 0, 0]}>
        {primaryMeshes.map((m) => (
          <group
            key={`p-${m.id}`}
            ref={(el) => {
              if (el) primaryRefs.current[m.id] = el
            }}
            visible={false}
          >
            <AreteSolid meshData={m} color={WOOD} live />
          </group>
        ))}
      </group>

      {/* 9 arêtes restantes — taille finale, fade séquentiel */}
      <group scale={[SCALE, SCALE, SCALE]} rotation={[-Math.PI / 2, 0, 0]}>
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
      </group>

      {/* 2 tablettes olive */}
      <group ref={shelvesGroup} visible={false}>
        {shelves.map((mod, i) => {
          const layout = moduleLayout(mod, finalDims, shelves)
          const sx = layout.size[0] * SCALE
          const sy = layout.size[2] * SCALE
          const sz = layout.size[1] * SCALE
          const hx = sx / 2
          const hy = sy / 2
          const hz = sz / 2
          const wire = new Float32Array([
            -hx, -hy, -hz, hx, -hy, -hz,
            hx, -hy, -hz, hx, -hy, hz,
            hx, -hy, hz, -hx, -hy, hz,
            -hx, -hy, hz, -hx, -hy, -hz,
            -hx, hy, -hz, hx, hy, -hz,
            hx, hy, -hz, hx, hy, hz,
            hx, hy, hz, -hx, hy, hz,
            -hx, hy, hz, -hx, hy, -hz,
            -hx, -hy, -hz, -hx, hy, -hz,
            hx, -hy, -hz, hx, hy, -hz,
            hx, -hy, hz, hx, hy, hz,
            -hx, -hy, hz, -hx, hy, hz,
          ])
          return (
            <group
              key={mod.id}
              userData={{ shelfIndex: i }}
              position={[
                layout.center[0] * SCALE,
                layout.center[2] * SCALE,
                -layout.center[1] * SCALE,
              ]}
            >
              <mesh userData={{ shelfIndex: i }}>
                <boxGeometry args={[sx, sy, sz]} />
                <meshStandardMaterial
                  color={PANEL}
                  roughness={0.55}
                  metalness={0.04}
                  transparent
                  polygonOffset
                  polygonOffsetFactor={1}
                  polygonOffsetUnits={1}
                />
              </mesh>
              <lineSegments userData={{ shelfIndex: i }} renderOrder={2}>
                <bufferGeometry>
                  <bufferAttribute
                    attach="attributes-position"
                    args={[wire, 3]}
                  />
                </bufferGeometry>
                <lineBasicMaterial
                  color={PANEL_EDGE}
                  depthTest
                  depthWrite={false}
                  transparent
                  polygonOffset
                  polygonOffsetFactor={-2}
                  polygonOffsetUnits={-2}
                />
              </lineSegments>
            </group>
          )
        })}
      </group>

      {/* Plateau & socle olive */}
      <group
        ref={panelsGroup}
        scale={[SCALE, SCALE, SCALE]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      >
        <group>
          <PanneauSolid nom="dessus_exterieur" dims={finalDims} />
        </group>
        <group>
          <PanneauSolid nom="dessous" dims={finalDims} />
        </group>
      </group>
    </group>
  )
}

function StoryScene({ progressRef }) {
  return (
    <>
      <color attach="background" args={['#0a0a0a']} />
      <ambientLight intensity={0.5} />
      <hemisphereLight args={['#e8f0ff', '#2a2010', 0.42]} />
      <directionalLight position={[4, 6, 3]} intensity={1.4} color="#fff5e6" />
      <directionalLight position={[-3, 2, -4]} intensity={0.35} />
      <StoryWorld progressRef={progressRef} />
    </>
  )
}

/**
 * @param {{ mode?: 'fixed' | 'sticky' }} props
 */
export default function HomeScrollStory({ mode = 'fixed' }) {
  const trackRef = useRef(null)
  const progressRef = useRef(0)
  const [progress, setProgress] = useState(0)
  const [chapter, setChapter] = useState(0)
  const isFixed = mode === 'fixed'

  useEffect(() => {
    const el = trackRef.current
    if (!el) return

    let raf = 0
    let alive = true
    let lastP = -1
    let lastCh = -1

    const loop = () => {
      if (!alive) return
      const p = getTrackProgress(el)
      progressRef.current = p

      if (Math.abs(p - lastP) > 0.002) {
        lastP = p
        setProgress(p)
        const ch = Math.min(
          STORY.length - 1,
          Math.floor(p * STORY.length + 0.001),
        )
        if (ch !== lastCh) {
          lastCh = ch
          setChapter(ch)
        }
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
  const trackVh = SCROLL_PAGES * 100

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
        <div className="home-story-copy">
          <p className="section-kicker">{ch.kicker}</p>
          <h2 className="home-story-title">{ch.title}</h2>
          <p className="home-story-text">{ch.text}</p>
          <div className="home-story-progress" aria-hidden>
            <div
              className="home-story-progress-bar"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <ol className="home-story-chapters">
            {STORY.map((s, i) => (
              <li
                key={s.id}
                className={
                  i === chapter ? 'active' : i < chapter ? 'done' : ''
                }
              >
                <span>{String(i + 1).padStart(2, '0')}</span>
                {s.title}
              </li>
            ))}
          </ol>
          <p className="home-story-hint">
            Scroll · {STORY.length} étapes · {Math.round(progress * 100)}%
          </p>
        </div>
      </div>

      {isFixed && (
        <Link to="/" className="home-story-exit">
          ← Accueil
        </Link>
      )}
    </>
  )

  if (isFixed) {
    return (
      <div
        className="home-story home-story--fixed"
        aria-label="Assemblage du meuble Philae"
      >
        <div className="home-story-stage">{stage}</div>
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
      aria-label="Assemblage du meuble Philae"
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
