import { useMemo, useEffect, useLayoutEffect, useRef } from 'react'
import { useThree, extend } from '@react-three/fiber'
import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { buildOssature } from './ossature.js'
import { inflateWireMm } from './edgeWire.js'
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
 * Contours noirs dilatés (anti z-fighting) + polygonOffset sur le volume.
 */
const SCALE = 0.001
/** Dilatation filaire (mm meuble) pour sortir les lignes du solide */
const WIRE_INFLATE_MM = 1.1

function shadeHex(hex, factor) {
  const c = new THREE.Color(hex)
  c.multiplyScalar(factor)
  return `#${c.getHexString()}`
}

function AreteMesh({ mesh, color, wireframe, roughness, metalness }) {
  const { size, gl } = useThree()
  const lineMatRef = useRef(null)

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3))
    geo.setIndex(new THREE.BufferAttribute(mesh.indices, 1))
    geo.computeVertexNormals()
    return geo
  }, [mesh])

  const inflatedWire = useMemo(
    () => inflateWireMm(mesh.wire, WIRE_INFLATE_MM),
    [mesh],
  )

  const edgeBasic = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(inflatedWire, 3))
    return geo
  }, [inflatedWire])

  const edgeFat = useMemo(() => {
    const geo = new LineSegmentsGeometry()
    geo.setPositions(Array.from(inflatedWire))
    return geo
  }, [inflatedWire])

  const dpr = gl.getPixelRatio?.() || 1
  const resW = Math.max(1, size.width * dpr)
  const resH = Math.max(1, size.height * dpr)

  useLayoutEffect(() => {
    const mat = lineMatRef.current
    if (mat?.resolution) mat.resolution.set(resW, resH)
  }, [resW, resH])

  useEffect(() => {
    return () => {
      geometry.dispose()
      edgeBasic.dispose()
      edgeFat.dispose()
    }
  }, [geometry, edgeBasic, edgeFat])

  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow renderOrder={0}>
        <meshStandardMaterial
          color={color}
          roughness={roughness ?? 0.55}
          metalness={metalness ?? 0.05}
          side={THREE.DoubleSide}
          wireframe={wireframe}
          // Recule le volume dans le depth buffer → les lignes gagnent si coplanaires
          polygonOffset
          polygonOffsetFactor={1.5}
          polygonOffsetUnits={2}
        />
      </mesh>
      <lineSegments geometry={edgeBasic} renderOrder={2}>
        <lineBasicMaterial
          color={ARETE_EDGE_COLOR}
          depthTest
          depthWrite={false}
        />
      </lineSegments>
      <lineSegments2 geometry={edgeFat} renderOrder={3}>
        <lineMaterial
          ref={lineMatRef}
          color={ARETE_EDGE_COLOR}
          linewidth={ARETE_EDGE_WIDTH}
          transparent={false}
          depthTest
          depthWrite={false}
          resolution={[resW, resH]}
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
    ? shadeHex(finish.color, (surf.shade ?? 1) * 1.08)
    : shadeHex(finish.color, surf.shade ?? 1)

  return (
    <group
      position={position}
      rotation={[0, rotationZ, 0]}
      scale={[SCALE, SCALE, SCALE]}
    >
      <group position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {ossature.meshes.map((m) => (
          <AreteMesh
            key={m.id}
            mesh={m}
            color={color}
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
