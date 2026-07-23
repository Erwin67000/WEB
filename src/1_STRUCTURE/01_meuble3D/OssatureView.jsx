import { useMemo, useLayoutEffect, useEffect, useRef } from 'react'
import { useThree, extend } from '@react-three/fiber'
import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { buildOssature } from './ossature.js'
import {
  FINITIONS,
  FINITIONS_OSSATURE,
  DEFAULT_FINITION_OSSATURE,
  ARETE_EDGE_COLOR,
  ARETE_EDGE_WIDTH,
} from '../00_matrice/matrice_constante.js'

extend({ LineSegments2, LineSegmentsGeometry, LineMaterial })

/**
 * Rendu des 12 arêtes d'un meuble Philae.
 * Coordonnées en mm → scale 0.001 vers mètres Three.js.
 * Lignes d’arêtes : noir brillant, légèrement épaissies (LineSegments2).
 */
const SCALE = 0.001

function shadeHex(hex, factor) {
  const c = new THREE.Color(hex)
  c.multiplyScalar(factor)
  return `#${c.getHexString()}`
}

function AreteMesh({ mesh, color, edgeColor, wireframe, roughness, metalness }) {
  const { size } = useThree()
  const lineMatRef = useRef(null)

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3))
    geo.setIndex(new THREE.BufferAttribute(mesh.indices, 1))
    geo.computeVertexNormals()
    return geo
  }, [mesh])

  const edgeGeometry = useMemo(() => {
    const geo = new LineSegmentsGeometry()
    geo.setPositions(Array.from(mesh.wire))
    return geo
  }, [mesh])

  useLayoutEffect(() => {
    if (lineMatRef.current) {
      lineMatRef.current.resolution.set(size.width, size.height)
    }
  }, [size.width, size.height])

  useEffect(() => {
    return () => {
      geometry.dispose()
      edgeGeometry.dispose()
    }
  }, [geometry, edgeGeometry])

  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={color}
          roughness={roughness ?? 0.55}
          metalness={metalness ?? 0.05}
          side={THREE.DoubleSide}
          wireframe={wireframe}
        />
      </mesh>
      <lineSegments2 geometry={edgeGeometry}>
        <lineMaterial
          ref={lineMatRef}
          color={edgeColor}
          linewidth={ARETE_EDGE_WIDTH}
          transparent={false}
          depthTest
          resolution={[size.width, size.height]}
        />
      </lineSegments2>
    </group>
  )
}

export default function OssatureView({
  dims,
  woodFinish = 'chene',
  ossatureFinish = DEFAULT_FINITION_OSSATURE,
  wireframe = false,
  position = [0, 0, 0],
  rotationZ = 0,
  selected = false,
}) {
  const ossature = useMemo(
    () => buildOssature(dims),
    [dims.L, dims.W, dims.H],
  )
  const finish = FINITIONS[woodFinish] || FINITIONS.chene
  const surf =
    FINITIONS_OSSATURE[ossatureFinish] ||
    FINITIONS_OSSATURE[DEFAULT_FINITION_OSSATURE]

  const color = selected
    ? '#d4b896'
    : shadeHex(finish.color, surf.shade ?? 1)
  // Lignes d’arêtes : noir brillant (sélection : vert discret)
  const edgeColor = selected ? '#1b4332' : ARETE_EDGE_COLOR

  return (
    <group
      position={position}
      rotation={[0, rotationZ, 0]}
      scale={[SCALE, SCALE, SCALE]}
    >
      <group
        position={[-dims.L / 2, 0, dims.W / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        {ossature.meshes.map((m) => (
          <AreteMesh
            key={m.id}
            mesh={m}
            color={color}
            edgeColor={edgeColor}
            wireframe={wireframe}
            roughness={surf.roughness}
            metalness={Math.max(surf.metalness ?? 0.05, 0.12)}
          />
        ))}
        {selected && (
          <axesHelper args={[Math.max(dims.L, dims.W, dims.H) * 0.35]} />
        )}
      </group>
    </group>
  )
}
