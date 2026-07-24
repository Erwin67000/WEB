import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  OrbitControls,
  Grid,
  ContactShadows,
  useGLTF,
} from '@react-three/drei'
import * as THREE from 'three'
import OssatureView from '../1_STRUCTURE/01_meuble3D/OssatureView.jsx'
import AgencementView from '../1_STRUCTURE/02_agencement/ModuleMesh.jsx'
import FacePickPlanes from '../1_STRUCTURE/02_agencement/FacePickPlanes.jsx'
import { ENVIRONMENTS } from '../1_STRUCTURE/00_matrice/matrice_configuration.js'
import { useActiveConfigStore } from '../store/ConfigStoreContext.jsx'

const SCALE = 0.001

/**
 * Caméra par défaut : tournée de 180° autour de l’axe vertical (Y Three = Z meuble).
 * Avant [2.2, 1.6, 2.8] montrait l’arrière → on regarde depuis l’opposé.
 */
export const DEFAULT_CAMERA_POS = [-2.2, 1.6, -2.8]
export const DEFAULT_CAMERA_TARGET = [0.35, 0.45, -0.25]

/**
 * Apparition légère : scale + légère montée (meubel 1 ou meuble ajouté).
 * key=unit.id force un rejoue de l’anim à chaque nouvel id.
 */
function UnitGroup({ unit, selected, wireframe, pickMode, onPickFace }) {
  const groupRef = useRef()
  const t0 = useRef(performance.now())

  useEffect(() => {
    t0.current = performance.now()
  }, [unit.id])

  useFrame(() => {
    const g = groupRef.current
    if (!g) return
    const t = Math.min(1, (performance.now() - t0.current) / 520)
    // easeOutCubic
    const e = 1 - (1 - t) ** 3
    const s = 0.88 + 0.12 * e
    g.scale.setScalar(s)
    // petite montée (mm → m via pos déjà en m côté parent)
    const lift = (1 - e) * 0.06
    g.position.y =
      (unit.positionMm?.z || 0) * SCALE + lift
  })

  const pos = [
    (unit.positionMm?.x || 0) * SCALE,
    (unit.positionMm?.z || 0) * SCALE,
    -(unit.positionMm?.y || 0) * SCALE,
  ]
  const rotY = (unit.rotationZ || 0) * (Math.PI / 180)

  return (
    <group ref={groupRef} position={pos}>
      <OssatureView
        dims={unit.dims}
        woodFinish={unit.woodFinish}
        ossatureFinish={unit.ossatureFinish}
        wireframe={wireframe}
        rotationZ={rotY}
        selected={selected}
      />
      <group rotation={[0, rotY, 0]}>
        <AgencementView
          dims={unit.dims}
          modules={unit.modules}
          panneaux={unit.panneaux}
          woodFinish={unit.woodFinish}
          panneauCouleur={unit.panneauCouleur}
          panneauCouleurHex={unit.panneauCouleurHex}
        />
      </group>
      {pickMode && selected && (
        <group position={[0, 0, 0]}>
          <FacePickPlanes
            dims={unit.dims}
            panneaux={unit.panneaux || []}
            rotationZ={rotY}
            onPick={onPickFace}
          />
        </group>
      )}
    </group>
  )
}

/**
 * Scène GLB (SketchUp → glTF).
 *
 * Convention Philae (une fois pour toutes) :
 * — Origine du GLB = origine du meuble 1 / configurateur (0,0,0)
 * — X : contre le mur (même sens que longueur meuble)
 * — Y SketchUp (mur → lit) : profondeur — en glTF Y-up, c’est souvent −Z Three
 * — Z SketchUp (haut) → Y Three (export glTF standard)
 *
 * Aucun recentrage auto : la géométrie doit être modélisée à l’origine SketchUp.
 * Ajustements fin via env.position / env.rotation / env.scale (mètres, radians).
 */
function GlbScene({ url, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 }) {
  const { scene } = useGLTF(url)
  const root = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true
        obj.receiveShadow = true
      }
    })
    return clone
  }, [scene])

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <primitive object={root} />
    </group>
  )
}

function EnvironmentScene({ env }) {
  if (!env || env.id === 'none' || !env.glb) return null
  return (
    <Suspense fallback={null}>
      <GlbScene
        url={env.glb}
        position={env.position || [0, 0, 0]}
        rotation={env.rotation || [0, 0, 0]}
        scale={env.scale ?? 1}
      />
    </Suspense>
  )
}

/** Sol invisible pour recevoir les ombres projetées (même sans pièce). */
function ShadowFloor() {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[20, 20]} />
      <shadowMaterial transparent opacity={0.28} />
    </mesh>
  )
}

function SunLight({ enabled, intensity }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (!ref.current || !enabled) return
    const t = clock.elapsedTime * 0.05
    ref.current.position.set(
      Math.cos(t) * 8,
      6 + Math.sin(t) * 1.5,
      Math.sin(t) * 8,
    )
    ref.current.target.position.set(0, 0.4, 0)
    ref.current.target.updateMatrixWorld()
  })
  if (!enabled) return null
  return (
    <directionalLight
      ref={ref}
      intensity={intensity}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.00025}
      shadow-normalBias={0.02}
      position={[5, 8, 4]}
      color="#fff5e6"
      shadow-camera-near={0.5}
      shadow-camera-far={30}
      shadow-camera-left={-6}
      shadow-camera-right={6}
      shadow-camera-top={6}
      shadow-camera-bottom={-6}
    />
  )
}

function SceneContent() {
  const units = useActiveConfigStore((s) => s.units)
  const activeUnitId = useActiveConfigStore((s) => s.activeUnitId)
  const environmentId = useActiveConfigStore((s) => s.environmentId)
  const sunEnabled = useActiveConfigStore((s) => s.sunEnabled)
  const sunIntensity = useActiveConfigStore((s) => s.sunIntensity)
  const showGrid = useActiveConfigStore((s) => s.showGrid)
  const wireframe = useActiveConfigStore((s) => s.wireframe)
  const panneauPickMode = useActiveConfigStore((s) => s.panneauPickMode)
  const togglePanneau = useActiveConfigStore((s) => s.togglePanneau)
  const env = ENVIRONMENTS[environmentId] || ENVIRONMENTS.none

  const active = units.find((u) => u.id === activeUnitId) || units[0]
  // Cible orbit = centre du volume (origine meuble fixée au coin 0,0,0)
  const orbitTarget = active
    ? [
        ((active.positionMm?.x || 0) + active.dims.L / 2) * SCALE,
        ((active.positionMm?.z || 0) + active.dims.H / 2) * SCALE,
        -((active.positionMm?.y || 0) + active.dims.W / 2) * SCALE,
      ]
    : DEFAULT_CAMERA_TARGET

  const onPickFace = (faceId) => {
    togglePanneau(faceId)
    // reste en mode pick pour enchaîner, ou désactive après 1er clic ?
    // On reste en mode jusqu’à clic « Terminer » dans le panel
  }

  return (
    <>
      <color attach="background" args={[env.bg || '#0a0a0a']} />
      <ambientLight intensity={sunEnabled ? 0.28 : 0.55} />
      <hemisphereLight args={['#e8f0ff', '#3a3020', sunEnabled ? 0.35 : 0.45]} />
      <SunLight enabled={sunEnabled} intensity={sunIntensity} />
      {!sunEnabled && (
        <directionalLight position={[-3, 5, -2]} intensity={0.45} color="#fff8ee" />
      )}

      {showGrid && !env.room && (
        <Grid
          args={[20, 20]}
          cellSize={0.2}
          cellThickness={0.6}
          cellColor="#2a2a2a"
          sectionSize={1}
          sectionThickness={1}
          sectionColor="#3d3d20"
          fadeDistance={18}
          fadeStrength={1.2}
          infiniteGrid
          position={[0, 0.001, 0]}
        />
      )}

      <EnvironmentScene env={env} />
      {sunEnabled && <ShadowFloor />}

      {units.map((u) => (
        <UnitGroup
          key={u.id}
          unit={u}
          selected={u.id === activeUnitId}
          wireframe={wireframe}
          pickMode={panneauPickMode}
          onPickFace={onPickFace}
        />
      ))}

      <ContactShadows
        position={[0, 0.001, 0]}
        opacity={sunEnabled ? 0.22 : 0.35}
        scale={12}
        blur={2.5}
        far={4}
      />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={0.5}
        maxDistance={20}
        /* Mode ajout panneau : on peut passer sous z=0 pour cliquer le socle.
           Sinon z=0 infranchissable (polar max ≈ horizon). */
        maxPolarAngle={panneauPickMode ? Math.PI * 0.98 : Math.PI * 0.49}
        minPolarAngle={0}
        target={orbitTarget}
        enabled
      />
      <CameraFloorClamp pickMode={panneauPickMode} />
    </>
  )
}

/**
 * En quittant le mode pick : si la caméra est sous l’horizon, on la relève
 * pour rétablir z=0 infranchissable.
 */
function CameraFloorClamp({ pickMode }) {
  const { camera, controls } = useThree()
  const prevPick = useRef(pickMode)

  useEffect(() => {
    if (prevPick.current && !pickMode) {
      // Sortie du mode pick : clamp polar ≤ horizon
      const target = controls?.target || new THREE.Vector3(0, 0.4, 0)
      const offset = camera.position.clone().sub(target)
      const spherical = new THREE.Spherical().setFromVector3(offset)
      const maxPhi = Math.PI * 0.49
      if (spherical.phi > maxPhi) {
        spherical.phi = maxPhi
        offset.setFromSpherical(spherical)
        camera.position.copy(target).add(offset)
        camera.lookAt(target)
        if (controls) {
          controls.update?.()
        }
      }
    }
    prevPick.current = pickMode
  }, [pickMode, camera, controls])

  return null
}

export default function Configurateur3D() {
  const panneauPickMode = useActiveConfigStore((s) => s.panneauPickMode)

  return (
    <div className={`viewport-3d${panneauPickMode ? ' pick-mode' : ''}`}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{
          position: DEFAULT_CAMERA_POS,
          fov: 45,
          near: 0.01,
          far: 100,
        }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          powerPreference: 'high-performance',
        }}
        onCreated={({ gl, camera }) => {
          gl.shadowMap.enabled = true
          gl.shadowMap.type = THREE.PCFSoftShadowMap
          camera.lookAt(...DEFAULT_CAMERA_TARGET)
        }}
      >
        <Suspense fallback={null}>
          <SceneContent />
        </Suspense>
      </Canvas>
      <div className="viewport-hint">
        {panneauPickMode
          ? 'Cliquez une face du meuble pour ajouter / retirer un panneau'
          : 'Orbit · molette zoom · clic droit pan · ombres soleil'}
      </div>
    </div>
  )
}

// Précharge la scène chambre si présente
if (typeof window !== 'undefined') {
  try {
    useGLTF.preload('/environnement/chambre/chambre.glb')
  } catch {
    /* ignore */
  }
}
