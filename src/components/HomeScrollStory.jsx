/**
 * Scrollytelling Philae — page /histoire (mode fixed).
 *
 * 5 étapes :
 *  01  Une arête unique apparaît
 *  02  Les 2 autres s’emboîtent
 *  03  Le cadre s’ouvre (12 arêtes)
 *  04  Deux tablettes
 *  05  Plateau & socle (olive)
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
const SCROLL_PAGES = 5

const STORY = [
  {
    id: 'one',
    kicker: '01 · Origine',
    title: 'Une arête',
    text: 'Tout commence par un profil. Une seule pièce usinée — la grammaire du meuble Philae.',
  },
  {
    id: 'assemble',
    kicker: '02 · Signature',
    title: 'L’emboîtement',
    text: 'Deux arêtes rejoignent la première. X, Y et Z se croisent au sommet — l’angle signature.',
  },
  {
    id: 'frame',
    kicker: '03 · Volume',
    title: 'Le cadre s’ouvre',
    text: 'Les douze arêtes dessinent le meuble : 600 × 400 × 800 mm. L’ossature définit l’espace avant toute surface.',
  },
  {
    id: 'shelves',
    kicker: '04 · Fonctions',
    title: 'Les tablettes s’installent',
    text: 'Deux tablettes se glissent dans le cadre. Libre, modulable, sans caisson opaque.',
  },
  {
    id: 'panels',
    kicker: '05 · Finitions',
    title: 'Plateau & socle',
    text: 'Les panneaux olive complètent le volume — dessus, dessous, et plus si vous le voulez.',
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
  const solidMatRef = useRef(null)
  const basicLineRef = useRef(null)
  const fatLineRef = useRef(null)

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

  // Expose materials for opacity control from parent useFrame via userData
  useEffect(() => {
    if (solidMatRef.current) solidMatRef.current.userData.storyMat = true
  }, [])

  if (!geo) return null

  return (
    <group
      userData={{
        solidMatRef,
        basicLineRef,
        fatLineRef,
        lineMatRef,
      }}
    >
      <mesh geometry={geo} renderOrder={0}>
        <meshStandardMaterial
          ref={solidMatRef}
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
        <lineSegments geometry={edgeBasic} renderOrder={2} ref={basicLineRef}>
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
        <lineSegments2 geometry={edgeFat} renderOrder={3} ref={fatLineRef}>
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
  group.visible = o > 0.02
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
    // LineSegments2
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
  const primaryGroups = useRef({})
  const secondaryGroup = useRef()
  const shelvesGroup = useRef()
  const panelsGroup = useRef()

  const finalDims = { L: 600, W: 400, H: 800 }
  const startDims = { L: 200, W: 200, H: 200 }

  const ossStart = useMemo(() => buildOssature(startDims), [])
  const ossEnd = useMemo(() => buildOssature(finalDims), [])
  // 2 tablettes (pas 3)
  const shelves = useMemo(
    () => [0, 1].map((i) => createModule('shelf', i)),
    [],
  )
  const primaryMeshes = useMemo(
    () =>
      ossStart.meshes.filter(
        (m) => m.id === 'X0' || m.id === 'Y0' || m.id === 'Z0',
      ),
    [ossStart],
  )
  const fullMeshes = ossEnd.meshes

  useFrame(({ camera }) => {
    const p = progressRef.current ?? 0

    // 5 phases
    // 01 : une arête apparaît
    const pAppear = phase(p, 0.0, 0.16)
    // 02 : les 2 autres s’emboîtent
    const pJoin = phase(p, 0.14, 0.34)
    // 03 : cadre 12 arêtes
    const pFrame = phase(p, 0.32, 0.54)
    // 04 : 2 tablettes
    const pShelves = phase(p, 0.5, 0.72)
    // 05 : panneaux
    const pPanels = phase(p, 0.7, 0.96)

    // Arête unique (X0) : apparaît en place, légère rotation résiduelle
    const spinSolo = (1 - pAppear) * Math.PI * 0.85
    const flySolo = (1 - pAppear) * 80

    // Y0 / Z0 : volent jusqu’à l’emboîtement
    const spinJoin = (1 - pJoin) * Math.PI * 1.6
    const flyJoin = (1 - pJoin) * 220

    const setPrim = (id, pos, rot) => {
      const g = primaryGroups.current[id]
      if (!g) return
      g.position.set(pos[0], pos[1], pos[2])
      g.rotation.set(rot[0], rot[1], rot[2])
    }

    // X0 : déjà là dès l’étape 1
    setPrim(
      'X0',
      [0, -flySolo * 0.15, flySolo * 0.1],
      [0, spinSolo * 0.25, spinSolo * 0.1],
    )
    setGroupOpacity(primaryGroups.current.X0, pAppear)

    // Y0 & Z0 : arrivent à l’étape 2
    setPrim(
      'Y0',
      [flyJoin * 0.55, 0, -flyJoin],
      [spinJoin * 0.35, 0, -spinJoin],
    )
    setPrim(
      'Z0',
      [-flyJoin * 0.35, flyJoin, 0],
      [-spinJoin, spinJoin * 0.2, 0],
    )
    setGroupOpacity(primaryGroups.current.Y0, pJoin)
    setGroupOpacity(primaryGroups.current.Z0, pJoin)

    // Cadre complet (fade-in + scale 200→final)
    if (secondaryGroup.current) {
      const sx = lerp(200 / 600, 1, pFrame)
      const sy = lerp(200 / 800, 1, pFrame)
      const sz = lerp(200 / 400, 1, pFrame)
      secondaryGroup.current.scale.set(sx, sy, sz)
      setGroupOpacity(secondaryGroup.current, pFrame)
    }

    // Masquer les 3 primaires quand le cadre complet est presque opaque
    const primVis = pFrame < 0.92
    for (const id of ['X0', 'Y0', 'Z0']) {
      const g = primaryGroups.current[id]
      if (!g) continue
      if (!primVis) {
        g.visible = false
      }
    }

    // 2 tablettes
    if (shelvesGroup.current) {
      shelvesGroup.current.visible = pShelves > 0.02
      shelvesGroup.current.traverse((o) => {
        if (o.isMesh && o.material && o.userData.shelfIndex != null) {
          const i = o.userData.shelfIndex
          const oShelf = clamp01((pShelves - i * 0.28) / 0.5)
          o.material.transparent = true
          o.material.opacity = oShelf
          o.material.depthWrite = oShelf > 0.9
          o.visible = oShelf > 0.02
        }
        if (o.isLineSegments && o.material && o.userData.shelfIndex != null) {
          const i = o.userData.shelfIndex
          const oShelf = clamp01((pShelves - i * 0.28) / 0.5)
          o.material.transparent = true
          o.material.opacity = oShelf
          o.visible = oShelf > 0.02
        }
      })
    }

    // Panneaux olive (dessus puis dessous)
    if (panelsGroup.current) {
      panelsGroup.current.visible = pPanels > 0.02
      panelsGroup.current.children.forEach((child, groupIdx) => {
        const oP =
          groupIdx === 0
            ? smoothstep(0.7, 0.86, p)
            : smoothstep(0.82, 0.96, p)
        setGroupOpacity(child, oP)
      })
    }

    // Caméra suit le volume
    const L = lerp(200, 600, pFrame)
    const W = lerp(200, 400, pFrame)
    const H = lerp(200, 800, pFrame)
    const tx = (L * SCALE) / 2
    const ty = (H * SCALE) / 2
    const tz = -(W * SCALE) / 2
    // Plus proche au début (1 arête), s’éloigne pour le volume
    const baseDist =
      Math.max(0.85, Math.sqrt(L * L + W * W + H * H) * SCALE * 1.15) * 1.1
    const dist = lerp(baseDist * 0.72, baseDist * 1.05, pFrame)
    const ang = -0.85 + p * 1.05
    camera.position.lerp(
      new THREE.Vector3(
        tx + Math.cos(ang) * dist,
        ty + dist * 0.38,
        tz + Math.sin(ang) * dist,
      ),
      0.14,
    )
    camera.lookAt(tx, ty, tz)
  })

  return (
    <group>
      {/* 3 arêtes primaires (200 mm) — étapes 01–02 */}
      <group scale={[SCALE, SCALE, SCALE]} rotation={[-Math.PI / 2, 0, 0]}>
        {primaryMeshes.map((m) => (
          <group
            key={`p-${m.id}`}
            ref={(el) => {
              if (el) primaryGroups.current[m.id] = el
            }}
            visible={false}
          >
            <AreteSolid meshData={m} color={WOOD} />
          </group>
        ))}
      </group>

      {/* Cadre complet — étape 03 */}
      <group
        ref={secondaryGroup}
        scale={[200 / 600, 200 / 800, 200 / 400]}
        visible={false}
      >
        <group scale={[SCALE, SCALE, SCALE]} rotation={[-Math.PI / 2, 0, 0]}>
          {fullMeshes.map((m) => (
            <AreteSolid key={`f-${m.id}`} meshData={m} color={WOOD} />
          ))}
        </group>
      </group>

      {/* 2 tablettes olive — étape 04 */}
      <group ref={shelvesGroup} visible={false}>
        {shelves.map((mod, i) => {
          const layout = moduleLayout(mod, finalDims, shelves)
          const sx = layout.size[0] * SCALE
          const sy = layout.size[2] * SCALE
          const sz = layout.size[1] * SCALE
          // Wire box edges (ligne style configurateur)
          const hx = sx / 2
          const hy = sy / 2
          const hz = sz / 2
          const wire = new Float32Array([
            // bottom
            -hx, -hy, -hz, hx, -hy, -hz,
            hx, -hy, -hz, hx, -hy, hz,
            hx, -hy, hz, -hx, -hy, hz,
            -hx, -hy, hz, -hx, -hy, -hz,
            // top
            -hx, hy, -hz, hx, hy, -hz,
            hx, hy, -hz, hx, hy, hz,
            hx, hy, hz, -hx, hy, hz,
            -hx, hy, hz, -hx, hy, -hz,
            // verticals
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

      {/* Plateau & socle olive — étape 05 */}
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
