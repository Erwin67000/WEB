/**
 * Scrollytelling accueil (inspiration Lunar Wheel) :
 * 1. Trois arêtes X/Y/Z (200 mm) tournent puis s’emboîtent au sommet
 * 2. Croissance → L600 × W400 × H800, les 12 arêtes
 * 3. Tablettes
 * 4. Plateau supérieur + socle
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { buildOssature } from '../1_STRUCTURE/01_meuble3D/ossature.js'
import { buildPanneauComplet, createModule, moduleLayout } from '../1_STRUCTURE/02_agencement/agencement.js'
import { FINITIONS, DEFAULT_PANNEAU_COULEUR, PANNEAU_COULEURS } from '../1_STRUCTURE/00_matrice/matrice_constante.js'

const SCALE = 0.001
const WOOD = FINITIONS.chene.color
const PANEL = PANNEAU_COULEURS[DEFAULT_PANNEAU_COULEUR]?.color || '#d4d0c8'

const STORY = [
  {
    id: 'assemble',
    kicker: '01 · Signature',
    title: 'Trois arêtes, un sommet',
    text: 'X, Y et Z se rejoignent. La géométrie Philae naît d’un emboîtement précis — 200 mm, l’unité de départ.',
  },
  {
    id: 'frame',
    kicker: '02 · Volume',
    title: 'Le cadre s’ouvre',
    text: 'Les douze arêtes dessinent le meuble : 600 × 400 × 800 mm. L’ossature définit l’espace avant toute surface.',
  },
  {
    id: 'shelves',
    kicker: '03 · Fonctions',
    title: 'Les tablettes s’installent',
    text: 'L’aménagement se glisse dans le cadre. Libre, modulable, sans caisson opaque.',
  },
  {
    id: 'panels',
    kicker: '04 · Finitions',
    title: 'Plateau & socle',
    text: 'Les panneaux complètent le volume là où la fonction l’exige — dessus, dessous, et plus si vous le voulez.',
  },
]

function clamp01(t) {
  return Math.min(1, Math.max(0, t))
}
function lerp(a, b, t) {
  return a + (b - a) * t
}
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}
function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0 || 1))
  return t * t * (3 - 2 * t)
}

/** Mesh d’une arête depuis buffers ossature (mm, repère meuble). */
function AreteSolid({ meshData, color, opacity = 1 }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(meshData.positions.slice(), 3),
    )
    g.setIndex(new THREE.BufferAttribute(meshData.indices.slice(), 1))
    g.computeVertexNormals()
    return g
  }, [meshData])

  useEffect(() => () => geo.dispose(), [geo])

  return (
    <mesh geometry={geo} castShadow>
      <meshStandardMaterial
        color={color}
        roughness={0.5}
        metalness={0.06}
        side={THREE.DoubleSide}
        transparent={opacity < 1}
        opacity={opacity}
        polygonOffset
        polygonOffsetFactor={1}
        polygonOffsetUnits={1}
      />
    </mesh>
  )
}

function PanneauSolid({ nom, dims, opacity = 1 }) {
  const data = useMemo(() => {
    try {
      return buildPanneauComplet(nom, dims, { epaisseur: 14 })
    } catch {
      return null
    }
  }, [nom, dims.L, dims.W, dims.H])

  const geo = useMemo(() => {
    if (!data) return null
    const buf = data.panneau.toBuffers()
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(buf.positions, 3))
    g.setIndex(new THREE.BufferAttribute(buf.indices, 1))
    g.computeVertexNormals()
    return g
  }, [data])

  useEffect(() => () => geo?.dispose(), [geo])
  if (!geo) return null

  return (
    <mesh geometry={geo} castShadow>
      <meshStandardMaterial
        color={PANEL}
        roughness={0.55}
        metalness={0.04}
        side={THREE.DoubleSide}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  )
}

function ShelfBox({ dims, mod, modules, opacity = 1 }) {
  const layout = moduleLayout(mod, dims, modules)
  const [cx, cy, cz] = layout.center
  const [sx, sy, sz] = layout.size
  // meuble mm → three m after parent rotX(-90)
  const pos = [cx * SCALE, cz * SCALE, -cy * SCALE]
  const args = [sx * SCALE, sz * SCALE, sy * SCALE]
  return (
    <mesh position={pos} castShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial
        color={PANEL}
        roughness={0.6}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  )
}

/**
 * Scène animée par progress 0→1 (scroll).
 */
function StoryMesh({ progress }) {
  // Phases
  const pAssemble = easeInOut(smoothstep(0.0, 0.28, progress))
  const pGrow = easeInOut(smoothstep(0.22, 0.52, progress))
  const pShelves = easeInOut(smoothstep(0.5, 0.74, progress))
  const pPanels = easeInOut(smoothstep(0.72, 0.96, progress))

  const L = lerp(200, 600, pGrow)
  const W = lerp(200, 400, pGrow)
  const H = lerp(200, 800, pGrow)
  const dims = useMemo(() => ({ L, W, H }), [L, W, H])

  const oss = useMemo(() => buildOssature(dims), [dims])

  // Spin des 3 arêtes avant emboîtement
  const spin = (1 - pAssemble) * Math.PI * 2.2
  const fly = (1 - pAssemble) * 180 // mm offset

  // Tablettes (3) — apparaissent progressivement
  const shelves = useMemo(() => {
    return [0, 1, 2].map((i) => createModule('shelf', i))
  }, [])

  // Centre optique du meuble pour la caméra
  const target = useMemo(
    () => new THREE.Vector3((L * SCALE) / 2, (H * SCALE) / 2, -(W * SCALE) / 2),
    [L, W, H],
  )

  const groupRef = useRef()
  useFrame(({ clock }) => {
    if (!groupRef.current) return
    // Légère respiration une fois assemblé
    const breathe =
      pAssemble > 0.95 ? Math.sin(clock.elapsedTime * 0.6) * 0.008 : 0
    groupRef.current.rotation.y = breathe
  })

  // Opacité des arêtes « secondaires » (les 9 après X0,Y0,Z0)
  const secondaryOpacity = smoothstep(0.35, 0.55, progress)

  return (
    <group ref={groupRef}>
      <group
        scale={[SCALE, SCALE, SCALE]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        {oss.meshes.map((m, idx) => {
          const isPrimary = m.id === 'X0' || m.id === 'Y0' || m.id === 'Z0'
          if (!isPrimary && secondaryOpacity < 0.02) return null

          // Emboîtement : les 3 primaires volent + tournent
          let extraRot = [0, 0, 0]
          let extraPos = [0, 0, 0]
          if (isPrimary && pAssemble < 1) {
            if (m.id === 'X0') {
              extraRot = [0, spin, spin * 0.4]
              extraPos = [0, -fly, fly * 0.5]
            } else if (m.id === 'Y0') {
              extraRot = [spin * 0.5, 0, -spin]
              extraPos = [fly * 0.6, 0, -fly]
            } else if (m.id === 'Z0') {
              extraRot = [-spin, spin * 0.3, 0]
              extraPos = [-fly * 0.4, fly, 0]
            }
          }

          const opacity = isPrimary
            ? 1
            : secondaryOpacity

          return (
            <group
              key={m.id}
              position={extraPos}
              rotation={extraRot}
            >
              <AreteSolid
                meshData={m}
                color={WOOD}
                opacity={opacity}
              />
            </group>
          )
        })}
      </group>

      {/* Tablettes (repère three déjà converti dans ShelfBox) */}
      {pShelves > 0.02 &&
        shelves.map((mod, i) => {
          const o = clamp01((pShelves - i * 0.2) / 0.5)
          if (o < 0.02) return null
          return (
            <group key={mod.id} scale={[1, 1, 1]}>
              <ShelfBox
                dims={dims}
                mod={mod}
                modules={shelves}
                opacity={o}
              />
            </group>
          )
        })}

      {/* Panneaux dans le même repère que l’ossature */}
      <group scale={[SCALE, SCALE, SCALE]} rotation={[-Math.PI / 2, 0, 0]}>
        {pPanels > 0.02 && (
          <>
            <PanneauSolid
              nom="dessus_exterieur"
              dims={dims}
              opacity={smoothstep(0.72, 0.88, progress)}
            />
            <PanneauSolid
              nom="dessous"
              dims={dims}
              opacity={smoothstep(0.82, 0.96, progress)}
            />
          </>
        )}
      </group>

      {/* Cible invisible pour orbit */}
      <mesh position={target} visible={false}>
        <sphereGeometry args={[0.01]} />
      </mesh>
    </group>
  )
}

function StoryCamera({ progress }) {
  const L = lerp(200, 600, easeInOut(smoothstep(0.22, 0.52, progress)))
  const W = lerp(200, 400, easeInOut(smoothstep(0.22, 0.52, progress)))
  const H = lerp(200, 800, easeInOut(smoothstep(0.22, 0.52, progress)))
  const tx = (L * SCALE) / 2
  const ty = (H * SCALE) / 2
  const tz = -(W * SCALE) / 2
  const dist = Math.max(1.2, Math.sqrt(L * L + W * W + H * H) * SCALE * 1.15)

  // Caméra qui tourne doucement autour pendant le scroll
  const ang = -0.9 + progress * 0.85
  const cx = tx + Math.cos(ang) * dist * 1.05
  const cy = ty + dist * 0.42
  const cz = tz + Math.sin(ang) * dist * 1.05

  useFrame(({ camera }) => {
    camera.position.lerp(new THREE.Vector3(cx, cy, cz), 0.08)
    camera.lookAt(tx, ty, tz)
  })
  return null
}

function StoryScene({ progress }) {
  return (
    <>
      <color attach="background" args={['#0a0a0a']} />
      <ambientLight intensity={0.45} />
      <hemisphereLight args={['#e8f0ff', '#2a2010', 0.4]} />
      <directionalLight
        position={[4, 6, 3]}
        intensity={1.35}
        color="#fff5e6"
        castShadow
      />
      <directionalLight position={[-3, 2, -4]} intensity={0.35} />
      <StoryMesh progress={progress} />
      <StoryCamera progress={progress} />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        enableRotate={false}
      />
    </>
  )
}

export default function HomeScrollStory() {
  const rootRef = useRef(null)
  const [progress, setProgress] = useState(0)
  const [activeChapter, setActiveChapter] = useState(0)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return

    const onScroll = () => {
      const rect = el.getBoundingClientRect()
      const total = el.offsetHeight - window.innerHeight
      const scrolled = -rect.top
      const p = total > 0 ? clamp01(scrolled / total) : 0
      setProgress(p)
      const ch = Math.min(
        STORY.length - 1,
        Math.floor(p * STORY.length + 0.001),
      )
      setActiveChapter(ch)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  const chapter = STORY[activeChapter]

  return (
    <div className="home-story" ref={rootRef}>
      <div className="home-story-sticky">
        <div className="home-story-canvas">
          <Canvas
            dpr={[1, 1.5]}
            camera={{ position: [1.8, 1.2, 2.2], fov: 40, near: 0.01, far: 50 }}
            gl={{
              antialias: true,
              toneMapping: THREE.ACESFilmicToneMapping,
              alpha: false,
            }}
          >
            <Suspense fallback={null}>
              <StoryScene progress={progress} />
            </Suspense>
          </Canvas>
        </div>

        <div className="home-story-copy">
          <p className="section-kicker">{chapter.kicker}</p>
          <h2 className="home-story-title">{chapter.title}</h2>
          <p className="home-story-text">{chapter.text}</p>
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
                className={i === activeChapter ? 'active' : i < activeChapter ? 'done' : ''}
              >
                <span>{String(i + 1).padStart(2, '0')}</span> {s.title}
              </li>
            ))}
          </ol>
          <p className="home-story-hint">Faites défiler pour assembler · ↓</p>
        </div>
      </div>

      {/* Spacer : longueur du récit (scroll) */}
      <div className="home-story-spacer" aria-hidden />
    </div>
  )
}
