/**
 * Plans cliquables pour ajouter / retirer un panneau (mode gamification).
 * Coordonnées meuble (mm) → même repère que l’ossature (scale + rot X −90°).
 */
import { useMemo } from 'react'
import * as THREE from 'three'

const SCALE = 0.001
const PAD = 8 // mm — légèrement à l’extérieur du volume

/**
 * Faces sélectionnables.
 * — fond / porte / joue1 / joue2 / dessous / dessus_exterieur
 */
export const FACE_PICK_DEFS = [
  {
    id: 'porte',
    label: 'Porte (avant)',
    // plan Y = 0 (avant)
    center: (L, W, H) => [L / 2, -PAD, H / 2],
    size: (L, W, H) => [L * 0.92, 2, H * 0.92],
  },
  {
    id: 'fond',
    label: 'Fond (arrière)',
    center: (L, W, H) => [L / 2, W + PAD, H / 2],
    size: (L, W, H) => [L * 0.92, 2, H * 0.92],
  },
  {
    id: 'joue1',
    label: 'Joue gauche',
    center: (L, W, H) => [-PAD, W / 2, H / 2],
    size: (L, W, H) => [2, W * 0.92, H * 0.92],
  },
  {
    id: 'joue2',
    label: 'Joue droite',
    center: (L, W, H) => [L + PAD, W / 2, H / 2],
    size: (L, W, H) => [2, W * 0.92, H * 0.92],
  },
  {
    id: 'dessous',
    label: 'Socle (dessous)',
    center: (L, W, H) => [L / 2, W / 2, -PAD],
    size: (L, W, H) => [L * 0.92, W * 0.92, 2],
  },
  {
    id: 'dessus_exterieur',
    label: 'Dessus',
    center: (L, W, H) => [L / 2, W / 2, H + PAD],
    size: (L, W, H) => [L * 0.92, W * 0.92, 2],
  },
]

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

  return (
    <mesh
      position={pos}
      onClick={(e) => {
        e.stopPropagation()
        onPick(face.id)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto'
      }}
    >
      <boxGeometry args={args} />
      <meshStandardMaterial
        color={active ? '#c9a227' : '#6b8f71'}
        transparent
        opacity={active ? 0.38 : 0.18}
        side={THREE.DoubleSide}
        depthWrite={false}
        emissive={active ? '#c9a227' : '#4a7c59'}
        emissiveIntensity={active ? 0.35 : 0.15}
      />
    </mesh>
  )
}

/**
 * @param {{
 *   dims: { L: number, W: number, H: number },
 *   panneaux: string[],
 *   onPick: (faceId: string) => void,
 *   rotationZ?: number,
 * }} props
 */
export default function FacePickPlanes({
  dims,
  panneaux = [],
  onPick,
  rotationZ = 0,
}) {
  const faces = useMemo(() => FACE_PICK_DEFS, [])

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
    </group>
  )
}
