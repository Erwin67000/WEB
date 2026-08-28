/**
 * Plans cliquables pour ajouter / retirer un panneau (mode gamification).
 * Raycast : seule la face la plus proche de la caméra reçoit le clic
 * (depthTest + depthWrite, filtre intersections[0]).
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import {
  doorBaysFromModules,
  resolvePorteBays,
} from './agencement.js'

const SCALE = 0.001
const PAD = 10 // mm — devant la porte pour pouvoir (dé)sélectionner les cases
/** Épaisseur des plans de pick (mm) — fine pour éviter les collisions croisées */
const PLANE_THICK = 4

/**
 * Faces sélectionnables.
 * — fond / porte / joue1 / joue2 / dessous / dessus_exterieur
 */
/**
 * Aligné sur PANNEAU_DEFS (matrice_panneau_grok) :
 * — fond  : face Y ≈ 0
 * — porte : face Y = W (opposée)
 * (était inversé dans le pick → corrigé)
 */
export const FACE_PICK_DEFS = [
  {
    id: 'fond',
    label: 'Fond',
    // plan Y = 0 (définition géométrique fond)
    center: (L, W, H) => [L / 2, -PAD, H / 2],
    size: (L, W, H) => [L * 0.9, PLANE_THICK, H * 0.9],
  },
  {
    id: 'porte',
    label: 'Porte',
    // plan Y = W (face opposée)
    center: (L, W, H) => [L / 2, W + PAD, H / 2],
    size: (L, W, H) => [L * 0.9, PLANE_THICK, H * 0.9],
  },
  {
    id: 'joue1',
    label: 'Joue gauche',
    center: (L, W, H) => [-PAD, W / 2, H / 2],
    size: (L, W, H) => [PLANE_THICK, W * 0.9, H * 0.9],
  },
  {
    id: 'joue2',
    label: 'Joue droite',
    center: (L, W, H) => [L + PAD, W / 2, H / 2],
    size: (L, W, H) => [PLANE_THICK, W * 0.9, H * 0.9],
  },
  {
    id: 'dessous',
    label: 'Socle (dessous)',
    center: (L, W, H) => [L / 2, W / 2, -PAD],
    size: (L, W, H) => [L * 0.9, W * 0.9, PLANE_THICK],
  },
  {
    id: 'dessus_exterieur',
    label: 'Dessus',
    center: (L, W, H) => [L / 2, W / 2, H + PAD],
    size: (L, W, H) => [L * 0.9, W * 0.9, PLANE_THICK],
  },
]

function DoorBayPlane({ dims, bay, active, onPick }) {
  const { L, W } = dims
  const zMin = Number(bay.zMin) || 0
  const zMax = Number(bay.zMax) || zMin
  const h = Math.max(8, zMax - zMin)
  const center = [L / 2, W + PAD, zMin + h / 2]
  const size = [L * 0.9, PLANE_THICK, h * 0.92]
  const pos = [
    center[0] * SCALE,
    center[2] * SCALE,
    -center[1] * SCALE,
  ]
  const args = [
    size[0] * SCALE,
    size[2] * SCALE,
    size[1] * SCALE,
  ]
  const id = `porte-bay:${bay.index}`

  const handlePointer = (e) => {
    const first = e.intersections?.[0]
    if (!first || first.object !== e.object) return
    e.stopPropagation()
    onPick(id)
  }

  return (
    <mesh
      position={pos}
      onClick={handlePointer}
      onPointerOver={(e) => {
        const first = e.intersections?.[0]
        if (!first || first.object !== e.object) return
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto'
      }}
      renderOrder={active ? 3 : 2}
    >
      <boxGeometry args={args} />
      <meshStandardMaterial
        color={active ? '#c9a227' : '#6b8f71'}
        transparent
        opacity={active ? 0.5 : 0.26}
        side={THREE.DoubleSide}
        depthTest
        depthWrite
        emissive={active ? '#c9a227' : '#3d6b4a'}
        emissiveIntensity={active ? 0.55 : 0.16}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
    </mesh>
  )
}

function FacePlane({ face, dims, active, onPick }) {
  const { L, W, H } = dims
  const center = face.center(L, W, H)
  const size = face.size(L, W, H)
  // Scene after rotX(-90): (x,y,z)_meuble → (x, z, -y)
  const pos = [
    center[0] * SCALE,
    center[2] * SCALE,
    -center[1] * SCALE,
  ]
  const args = [
    size[0] * SCALE,
    size[2] * SCALE,
    size[1] * SCALE,
  ]

  const handlePointer = (e) => {
    // Ne réagir que si cette face est la plus proche du rayon
    const first = e.intersections?.[0]
    if (!first || first.object !== e.object) return
    e.stopPropagation()
    onPick(face.id)
  }

  return (
    <mesh
      position={pos}
      onClick={handlePointer}
      onPointerOver={(e) => {
        const first = e.intersections?.[0]
        if (!first || first.object !== e.object) return
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto'
      }}
      renderOrder={active ? 2 : 1}
    >
      <boxGeometry args={args} />
      <meshStandardMaterial
        color={active ? '#c9a227' : '#6b8f71'}
        transparent
        opacity={active ? 0.42 : 0.22}
        side={THREE.DoubleSide}
        depthTest
        depthWrite
        emissive={active ? '#c9a227' : '#3d6b4a'}
        emissiveIntensity={active ? 0.4 : 0.12}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  )
}

/**
 * @param {{
 *   dims: { L: number, W: number, H: number },
 *   panneaux: string[],
 *   modules?: object[],
 *   porteBays?: number[],
 *   onPick: (faceId: string) => void,
 *   rotationZ?: number,
 * }} props
 */
export default function FacePickPlanes({
  dims,
  panneaux = [],
  modules = [],
  unit = null,
  onPick,
  rotationZ = 0,
}) {
  const faces = useMemo(
    () => FACE_PICK_DEFS.filter((f) => f.id !== 'porte'),
    [],
  )
  const bays = useMemo(
    () => doorBaysFromModules(dims, modules),
    [dims.L, dims.W, dims.H, modules],
  )
  const selectedBays = useMemo(
    () => resolvePorteBays(unit || { panneaux, porteBays: undefined }, bays),
    [unit, panneaux, bays],
  )

  return (
    <group rotation={[0, rotationZ, 0]}>
      {faces.map((face) => (
        <FacePlane
          key={face.id}
          face={face}
          dims={dims}
          active={panneaux.includes(face.id)}
          onPick={onPick}
        />
      ))}
      {bays.map((bay) => (
        <DoorBayPlane
          key={`porte-bay:${bay.index}`}
          dims={dims}
          bay={bay}
          active={selectedBays.includes(bay.index)}
          onPick={onPick}
        />
      ))}
    </group>
  )
}
