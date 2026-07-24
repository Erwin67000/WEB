/**
 * Plans cliquables pour ajouter / retirer un panneau (mode gamification).
 * Raycast : seule la face la plus proche de la caméra reçoit le clic
 * (depthTest + depthWrite, filtre intersections[0]).
 */
import { useMemo } from 'react'
import * as THREE from 'three'

const SCALE = 0.001
const PAD = 6 // mm — légèrement à l’extérieur du volume
/** Épaisseur des plans de pick (mm) — fine pour éviter les collisions croisées */
const PLANE_THICK = 4

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
    size: (L, W, H) => [L * 0.9, PLANE_THICK, H * 0.9],
  },
  {
    id: 'fond',
    label: 'Fond (arrière)',
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
