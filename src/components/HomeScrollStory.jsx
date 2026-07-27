/**
 * Scrollytelling accueil — pleine largeur, 4 viewports de scroll.
 * Progression liée à window.scrollY ; molette OK même au-dessus du canvas.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { buildOssature } from '../1_STRUCTURE/01_meuble3D/ossature.js'
import {
  buildPanneauComplet,
  createModule,
  moduleLayout,
} from '../1_STRUCTURE/02_agencement/agencement.js'
import {
  FINITIONS,
  DEFAULT_PANNEAU_COULEUR,
  PANNEAU_COULEURS,
} from '../1_STRUCTURE/00_matrice/matrice_constante.js'

const SCALE = 0.001
const WOOD = FINITIONS.chene.color
const PANEL = PANNEAU_COULEURS[DEFAULT_PANNEAU_COULEUR]?.color || '#d4d0c8'
const STORY_VH = 4

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

/**
 * Progression 0→1 pendant que la section sticky est « scrollee ».
 * Conteneur = N × 100vh ; sticky = 100vh → plage scrollable = (N-1)×vh.
 */
function computeScrollProgress(sectionEl) {
  if (!sectionEl) return 0
  const rect = sectionEl.getBoundingClientRect()
  const total = sectionEl.offsetHeight - window.innerHeight
  if (total <= 1) return 0
  // rect.top = 0 au début du sticky pin ; devient négatif en progressant
  const scrolled = -rect.top
  return clamp01(scrolled / total)
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

function AreteSolid({ meshData, color, opacity = 1 }) {
  const geo = useBufferGeo(meshData.positions, meshData.indices)
  useEffect(() => () => geo?.dispose(), [geo])
  if (!geo) return null
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial
        color={color}
        roughness={0.5}
        metalness={0.06}
        side={THREE.DoubleSide}
        transparent={opacity < 0.999}
        opacity={opacity}
        depthWrite={opacity > 0.95}
        polygonOffset
        polygonOffsetFactor={1}
        polygonOffsetUnits={1}
      />
    </mesh>
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
    <mesh geometry={geo}>
      <meshStandardMaterial
        color={PANEL}
        roughness={0.55}
        metalness={0.04}
        side={THREE.DoubleSide}
        transparent
        opacity={1}
      />
    </mesh>
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
  const shelves = useMemo(
    () => [0, 1, 2].map((i) => createModule('shelf', i)),
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

    // 4 phases égales sur le scroll
    const p1 = phase(p, 0.0, 0.25)
    const p2 = phase(p, 0.22, 0.5)
    const p3 = phase(p, 0.48, 0.74)
    const p4 = phase(p, 0.72, 0.98)

    // Spin uniquement tant que l’emboîtement n’est pas fini (lié au scroll, pas au temps)
    const spin = (1 - p1) * Math.PI * 2.4
    const fly = (1 - p1) * 220

    const setPrim = (id, pos, rot) => {
      const g = primaryGroups.current[id]
      if (!g) return
      g.position.set(pos[0], pos[1], pos[2])
      g.rotation.set(rot[0], rot[1], rot[2])
    }

    setPrim('X0', [0, -fly, fly * 0.45], [0, spin, spin * 0.35])
    setPrim('Y0', [fly * 0.55, 0, -fly], [spin * 0.4, 0, -spin])
    setPrim('Z0', [-fly * 0.35, fly, 0], [-spin, spin * 0.25, 0])

    // Cadre complet (scale morph)
    if (secondaryGroup.current) {
      const sx = lerp(200 / 600, 1, p2)
      const sy = lerp(200 / 800, 1, p2)
      const sz = lerp(200 / 400, 1, p2)
      secondaryGroup.current.scale.set(sx, sy, sz)
      secondaryGroup.current.visible = p2 > 0.04
      secondaryGroup.current.traverse((o) => {
        if (o.isMesh && o.material) {
          o.material.transparent = true
          o.material.opacity = clamp01(p2)
          o.material.depthWrite = p2 > 0.9
        }
      })
    }

    // Masquer les 3 arêtes 200 mm quand le cadre final est dominant
    const primVis = p2 < 0.88
    for (const id of ['X0', 'Y0', 'Z0']) {
      const g = primaryGroups.current[id]
      if (g) g.visible = primVis
    }

    if (shelvesGroup.current) {
      shelvesGroup.current.visible = p3 > 0.02
      shelvesGroup.current.traverse((o) => {
        if (o.isMesh && o.material && o.userData.shelfIndex != null) {
          const i = o.userData.shelfIndex
          const oShelf = clamp01((p3 - i * 0.18) / 0.45)
          o.material.transparent = true
          o.material.opacity = oShelf
          o.material.depthWrite = oShelf > 0.9
          o.visible = oShelf > 0.02
        }
      })
    }

    if (panelsGroup.current) {
      panelsGroup.current.visible = p4 > 0.02
      let meshIdx = 0
      panelsGroup.current.traverse((o) => {
        if (!o.isMesh || !o.material) return
        const oP =
          meshIdx === 0
            ? smoothstep(0.72, 0.88, p)
            : smoothstep(0.84, 0.98, p)
        meshIdx += 1
        o.material.transparent = true
        o.material.opacity = oP
        o.material.depthWrite = oP > 0.9
        o.visible = oP > 0.02
      })
    }

    const L = lerp(200, 600, p2)
    const W = lerp(200, 400, p2)
    const H = lerp(200, 800, p2)
    const tx = (L * SCALE) / 2
    const ty = (H * SCALE) / 2
    const tz = -(W * SCALE) / 2
    const dist =
      Math.max(1.15, Math.sqrt(L * L + W * W + H * H) * SCALE * 1.2) * 1.05
    const ang = -1.0 + p * 1.05
    const cx = tx + Math.cos(ang) * dist
    const cy = ty + dist * 0.38
    const cz = tz + Math.sin(ang) * dist
    camera.position.lerp(new THREE.Vector3(cx, cy, cz), 0.14)
    camera.lookAt(tx, ty, tz)
  })

  return (
    <group>
      <group scale={[SCALE, SCALE, SCALE]} rotation={[-Math.PI / 2, 0, 0]}>
        {primaryMeshes.map((m) => (
          <group
            key={`p-${m.id}`}
            ref={(el) => {
              if (el) primaryGroups.current[m.id] = el
            }}
          >
            <AreteSolid meshData={m} color={WOOD} />
          </group>
        ))}
      </group>

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

      <group ref={shelvesGroup} visible={false}>
        {shelves.map((mod, i) => {
          const layout = moduleLayout(mod, finalDims, shelves)
          return (
            <mesh
              key={mod.id}
              userData={{ shelfIndex: i }}
              position={[
                layout.center[0] * SCALE,
                layout.center[2] * SCALE,
                -layout.center[1] * SCALE,
              ]}
            >
              <boxGeometry
                args={[
                  layout.size[0] * SCALE,
                  layout.size[2] * SCALE,
                  layout.size[1] * SCALE,
                ]}
              />
              <meshStandardMaterial color={PANEL} roughness={0.6} transparent />
            </mesh>
          )
        })}
      </group>

      <group
        ref={panelsGroup}
        scale={[SCALE, SCALE, SCALE]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      >
        <PanneauSolid nom="dessus_exterieur" dims={finalDims} />
        <PanneauSolid nom="dessous" dims={finalDims} />
      </group>
    </group>
  )
}

function StoryScene({ progressRef }) {
  return (
    <>
      <color attach="background" args={['#0a0a0a']} />
      <ambientLight intensity={0.48} />
      <hemisphereLight args={['#e8f0ff', '#2a2010', 0.42]} />
      <directionalLight position={[4, 6, 3]} intensity={1.4} color="#fff5e6" />
      <directionalLight position={[-3, 2, -4]} intensity={0.35} />
      <StoryWorld progressRef={progressRef} />
    </>
  )
}

export default function HomeScrollStory() {
  const sectionRef = useRef(null)
  const progressRef = useRef(0)
  const [progress, setProgress] = useState(0)
  const [chapter, setChapter] = useState(0)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return

    let raf = 0
    const update = () => {
      const p = computeScrollProgress(el)
      progressRef.current = p
      // UI React (texte / barre) — throttle via rAF déjà
      setProgress((prev) => (Math.abs(prev - p) > 0.002 ? p : prev))
      const ch = Math.min(
        STORY.length - 1,
        Math.floor(p * STORY.length + 0.001),
      )
      setChapter((prev) => (prev !== ch ? ch : prev))
    }

    const onScrollOrResize = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScrollOrResize, { passive: true })
    window.addEventListener('resize', onScrollOrResize)

    // Molette au-dessus du canvas : forcer le scroll document
    // (WebGL capture souvent le wheel et bloque le % de progression)
    const onWheel = (e) => {
      // Ne pas bloquer si l’utilisateur est sur un lien/bouton de l’overlay
      if (e.target.closest?.('a, button, input, textarea, select')) return
      // Si le navigateur ne scrolle pas (canvas), propager manuellement
      if (Math.abs(e.deltaY) > 0) {
        const before = window.scrollY
        // laisse le défaut d’abord ; si rien n’a bougé, scrollBy
        requestAnimationFrame(() => {
          if (window.scrollY === before) {
            window.scrollBy({ top: e.deltaY, left: 0, behavior: 'auto' })
          }
        })
      }
    }
    el.addEventListener('wheel', onWheel, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScrollOrResize)
      window.removeEventListener('resize', onScrollOrResize)
      el.removeEventListener('wheel', onWheel)
      cancelAnimationFrame(raf)
    }
  }, [])

  const ch = STORY[chapter]

  return (
    <section
      ref={sectionRef}
      className="home-story"
      style={{ height: `${STORY_VH * 100}vh` }}
      aria-label="Assemblage du meuble Philae"
    >
      <div className="home-story-sticky">
        {/* Canvas : pointer-events none → le scroll page marche partout */}
        <div className="home-story-canvas">
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
            eventSource={sectionRef}
            eventPrefix="client"
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
              Scroll · 4 étapes · {Math.round(progress * 100)}%
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
