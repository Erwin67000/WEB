import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  OrbitControls,
  Grid,
  ContactShadows,
  Environment as DreiEnv,
} from '@react-three/drei'
import * as THREE from 'three'
import OssatureView from '../1_STRUCTURE/01_meuble3D/OssatureView.jsx'
import AgencementView from '../1_STRUCTURE/02_agencement/ModuleMesh.jsx'
import { ENVIRONMENTS } from '../1_STRUCTURE/00_matrice/matrice_configuration.js'
import { useActiveConfigStore } from '../store/ConfigStoreContext.jsx'

const SCALE = 0.001

/**
 * Caméra par défaut : tournée de 180° autour de l’axe vertical (Y Three = Z meuble).
 * Avant [2.2, 1.6, 2.8] montrait l’arrière → on regarde depuis l’opposé.
 */
export const DEFAULT_CAMERA_POS = [-2.2, 1.6, -2.8]
export const DEFAULT_CAMERA_TARGET = [0.35, 0.45, -0.25]

function UnitGroup({ unit, selected, wireframe }) {
  const pos = [
    (unit.positionMm?.x || 0) * SCALE,
    (unit.positionMm?.z || 0) * SCALE,
    -(unit.positionMm?.y || 0) * SCALE,
  ]
  return (
    <group position={pos}>
      <OssatureView
        dims={unit.dims}
        woodFinish={unit.woodFinish}
        ossatureFinish={unit.ossatureFinish}
        wireframe={wireframe}
        rotationZ={(unit.rotationZ || 0) * (Math.PI / 180)}
        selected={selected}
      />
      <group rotation={[0, (unit.rotationZ || 0) * (Math.PI / 180), 0]}>
        <AgencementView
          dims={unit.dims}
          modules={unit.modules}
          panneaux={unit.panneaux}
          woodFinish={unit.woodFinish}
          panneauCouleur={unit.panneauCouleur}
        />
      </group>
    </group>
  )
}

function Room({ env }) {
  if (!env?.room) return null
  const s = 6
  const h = 2.8
  const wall = env.walls || '#e8e0d5'
  const floor = env.floor || '#d4c4a8'
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[s, s]} />
        <meshStandardMaterial color={floor} roughness={0.85} />
      </mesh>
      <mesh position={[0, h / 2, -s / 2]} receiveShadow>
        <boxGeometry args={[s, h, 0.08]} />
        <meshStandardMaterial color={wall} roughness={0.9} />
      </mesh>
      <mesh position={[-s / 2, h / 2, 0]} receiveShadow>
        <boxGeometry args={[0.08, h, s]} />
        <meshStandardMaterial color={wall} roughness={0.9} />
      </mesh>
      <mesh position={[s / 2, h / 2, 0]} receiveShadow>
        <boxGeometry args={[0.08, h, s]} />
        <meshStandardMaterial
          color={wall}
          roughness={0.95}
          transparent
          opacity={0.15}
        />
      </mesh>
    </group>
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

  return (
    <>
      <color attach="background" args={[env.bg || '#0a0a0a']} />
      <ambientLight intensity={sunEnabled ? 0.28 : 0.55} />
      <hemisphereLight args={['#e8f0ff', '#3a3020', sunEnabled ? 0.35 : 0.45]} />
      <SunLight enabled={sunEnabled} intensity={sunIntensity} />
      {/* Remplissage sans ombre si soleil off — géométrie toujours visible */}
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

      <Room env={env} />
      {/* Sol d’ombres : les panneaux absents laissent passer la lumière */}
      {sunEnabled && <ShadowFloor />}

      {units.map((u) => (
        <UnitGroup
          key={u.id}
          unit={u}
          selected={u.id === activeUnitId}
          wireframe={wireframe}
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
        maxPolarAngle={Math.PI * 0.49}
        target={orbitTarget}
      />
    </>
  )
}

export default function Configurateur3D() {
  const environmentId = useActiveConfigStore((s) => s.environmentId)
  const env = ENVIRONMENTS[environmentId] || ENVIRONMENTS.none

  return (
    <div className="viewport-3d">
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
          {env.room && (
            <DreiEnv preset="apartment" environmentIntensity={0.25} />
          )}
        </Suspense>
      </Canvas>
      <div className="viewport-hint">
        Orbit · molette zoom · clic droit pan · ombres soleil
      </div>
    </div>
  )
}
