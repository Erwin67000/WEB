/**
 * Scrollytelling Philae — page /histoire (mode fixed).
 *
 * 6 écrans de scroll :
 *  01  Une arête en grand, légère rotation autour de Z
 *  02  Dézoom + 2 arêtes en translation pure (emboîtement)
 *  03  Étirement des 3 arêtes jusqu’à taille finale
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
import { buildOssature } from '../1_STRUCTURE/01_meuble3D/ossature.js'
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
const SCROLL_PAGES = 6

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
    text: 'Bois massif coupé selon l’angle signature PHILAE.',
  },
  {
    id: 'assemble',
    kicker: '02 · Sommet',
    title: 'La configuration au sommet',
    text: 'L’assemblage de trois arêtes forme un sommet.',
  },
  {
    id: 'stretch',
    kicker: '03 · Étirement',
    title: 'Le volume s’étire',
    text: 'Les trois arêtes grandissent jusqu’à leur longueur finale.',
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

function useBufferGeo(positions, indices) {
  return useMemo(() => {
    if (!positions) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(
        positions instanceof Float32Array
          ? positions.slice()
          : Float32Array.from(positions),
        3,
      ),
    )
    if (indices) {
      g.setIndex(
        new THREE.BufferAttribute(
          indices instanceof Uint16Array
            ? indices.slice()
            : Uint16Array.from(indices),
          1,
        ),
      )
    }
    g.computeVertexNormals()
    return g
  }, [positions, indices])
}

/** Arête solide + ligne_arete (comme le configurateur). */
function AreteSolid({ meshData, color }) {
  const { size, gl } = useThree()
  const lineMatRef = useRef(null)

  const geo = useBufferGeo(meshData.positions, meshData.indices)

  const edgeBasic = useMemo(() => {
    if (!meshData.wire) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(meshData.wire.slice(), 3),
    )
    return g
  }, [meshData.wire])

  const edgeFat = useMemo(() => {
    if (!meshData.wire) return null
    const g = new LineSegmentsGeometry()
    g.setPositions(Array.from(meshData.wire))
    return g
  }, [meshData.wire])

  const dpr = gl.getPixelRatio?.() || 1
  const resW = Math.max(1, size.width * dpr)
  const resH = Math.max(1, size.height * dpr)

  useLayoutEffect(() => {
    const mat = lineMatRef.current
    if (mat?.resolution) mat.resolution.set(resW, resH)
  }, [resW, resH])

  useEffect(
    () => () => {
      geo?.dispose()
      edgeBasic?.dispose()
      edgeFat?.dispose()
    },
    [geo, edgeBasic, edgeFat],
  )

  if (!geo) return null

  return (
    <group>
      <mesh geometry={geo} renderOrder={0}>
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
  const stretchGroup = useRef()
  const restRefs = useRef({})
  const shelvesGroup = useRef()
  const panelsGroup = useRef()

  const finalDims = { L: 600, W: 400, H: 800 }
  // Géométrie finale : on scale 200/final → 1 pour l’étirement
  const ossEnd = useMemo(() => buildOssature(finalDims), [])
  const shelves = useMemo(
    () => [0, 1].map((i) => createModule('shelf', i)),
    [],
  )

  const primaryMeshes = useMemo(
    () =>
      ossEnd.meshes.filter(
        (m) => m.id === 'X0' || m.id === 'Y0' || m.id === 'Z0',
      ),
    [ossEnd],
  )
  const restMeshes = useMemo(
    () => ossEnd.meshes.filter((m) => REST_EDGE_IDS.includes(m.id)),
    [ossEnd],
  )

  useFrame(({ camera }) => {
    const p = progressRef.current ?? 0
    // 6 écrans égaux
    const S = 1 / SCROLL_PAGES

    // 01 — une arête (grand plan, spin Z)
    const pSolo = phase(p, 0.0, S * 0.92)
    // 02 — dézoom + 2 arêtes en translation (1 écran)
    const pJoin = phase(p, S * 0.95, S * 2)
    // 03 — étirement des 3 arêtes (1 écran)
    const pStretch = phase(p, S * 2, S * 3)
    // 04 — 9 arêtes séquentielles (1 écran)
    const pRest = phase(p, S * 3, S * 4)
    // 05 — tablettes
    const pShelves = phase(p, S * 4, S * 5)
    // 06 — panneaux
    const pPanels = phase(p, S * 5, 0.99)

    // ——— Échelle des 3 arêtes d’origine (coin) ———
    // Départ : taille « 200 mm » relative au final
    const sL = lerp(200 / 600, 1, pStretch) // X
    const sH = lerp(200 / 800, 1, pStretch) // Z SketchUp → Y Three après rot
    const sW = lerp(200 / 400, 1, pStretch) // Y SketchUp → Z Three
    if (stretchGroup.current) {
      stretchGroup.current.scale.set(sL, sH, sW)
    }

    // Offsets de translation (en mm SketchUp) pour Y0 / Z0 — pure translation
    // Distance d’approche proportionnelle à la taille courante (~200 au join)
    const approach = 280
    const tJoin = 1 - pJoin // 1 = loin, 0 = en place
    // Y0 arrive le long de Y (profondeur)
    const y0off = [0, approach * tJoin, 0]
    // Z0 arrive le long de Z (hauteur)
    const z0off = [0, 0, approach * tJoin]

    // X0 : spin léger autour de Z (axe vertical SketchUp) pendant le solo,
    // s’arrête à l’emboîtement
    const spinZ = (1 - pSolo) * 0.55 + (1 - pJoin) * 0.08

    const setPrim = (id, posMm, rot = [0, 0, 0]) => {
      const g = primaryRefs.current[id]
      if (!g) return
      g.position.set(posMm[0], posMm[1], posMm[2])
      g.rotation.set(rot[0], rot[1], rot[2])
    }

    // X0 toujours en place, tourne sur Z au début
    setPrim('X0', [0, 0, 0], [0, 0, spinZ])
    setGroupOpacity(primaryRefs.current.X0, Math.max(pSolo, 0.02))

    // Y0 / Z0 : translation pure, pas de rotation
    setPrim('Y0', y0off, [0, 0, 0])
    setPrim('Z0', z0off, [0, 0, 0])
    setGroupOpacity(primaryRefs.current.Y0, pJoin)
    setGroupOpacity(primaryRefs.current.Z0, pJoin)

    // 9 arêtes restantes — séquentiel sur pRest
    REST_EDGE_IDS.forEach((id, i) => {
      const g = restRefs.current[id]
      if (!g) return
      // chaque arête occupe ~1/9 de la phase, avec léger overlap
      const slot = 1 / REST_EDGE_IDS.length
      const start = i * slot * 0.85
      const end = start + slot * 1.15
      const o = smoothstep(start, end, pRest)
      setGroupOpacity(g, o)
    })

    // 2 tablettes
    if (shelvesGroup.current) {
      shelvesGroup.current.visible = pShelves > 0.02
      shelvesGroup.current.traverse((o) => {
        if (!o.material || o.userData.shelfIndex == null) return
        const i = o.userData.shelfIndex
        const oShelf = clamp01((pShelves - i * 0.28) / 0.5)
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
            ? smoothstep(S * 5, S * 5 + S * 0.55, p)
            : smoothstep(S * 5 + S * 0.35, S * 6 - 0.02, p)
        setGroupOpacity(child, oP)
      })
    }

    // ——— Caméra ———
    // Dimensions courantes (pour cadrage)
    const L = lerp(200, 600, pStretch)
    const W = lerp(200, 400, pStretch)
    const H = lerp(200, 800, pStretch)
    const tx = (L * SCALE) / 2
    const ty = (H * SCALE) / 2
    const tz = -(W * SCALE) / 2

    // Solo : très proche, centré sur l’arête X0 (~100 mm)
    const soloTarget = new THREE.Vector3(
      100 * SCALE,
      40 * SCALE,
      -40 * SCALE,
    )
    const finalTarget = new THREE.Vector3(tx, ty, tz)

    // Dézoom pendant le join (écran 2)
    const zoomOut = phase(p, S * 0.9, S * 2)
    const look = soloTarget.clone().lerp(finalTarget, Math.max(zoomOut, pStretch))

    const soloDist = 0.42
    const joinedDist = 0.95
    const finalDist =
      Math.max(1.05, Math.sqrt(L * L + W * W + H * H) * SCALE * 1.22) * 1.05

    const dist = lerp(
      lerp(soloDist, joinedDist, zoomOut),
      finalDist,
      pStretch,
    )

    // Angle caméra : stable au début, s’ouvre doucement ensuite
    const ang = -0.95 + pJoin * 0.25 + pStretch * 0.55 + pRest * 0.25

    const camGoal = new THREE.Vector3(
      look.x + Math.cos(ang) * dist,
      look.y + dist * (0.28 + pStretch * 0.12),
      look.z + Math.sin(ang) * dist,
    )
    camera.position.lerp(camGoal, 0.12)
    camera.lookAt(look)
  })

  return (
    <group>
      {/*
        Coin d’origine (X0 Y0 Z0) — géométrie finale scalée 200→full.
        scale du stretchGroup : (sL, sH, sW) dans l’espace Three du parent rot.
      */}
      <group ref={stretchGroup} scale={[200 / 600, 200 / 800, 200 / 400]}>
        <group scale={[SCALE, SCALE, SCALE]} rotation={[-Math.PI / 2, 0, 0]}>
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
        </group>
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
