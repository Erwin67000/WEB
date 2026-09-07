import { useLayoutEffect } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import {
  FINITIONS_OSSATURE,
  DEFAULT_FINITION_OSSATURE,
} from '../1_STRUCTURE/00_matrice/matrice_constante.js'

const BRUT = FINITIONS_OSSATURE[DEFAULT_FINITION_OSSATURE]

export function usesWoodMaps(ossatureFinish) {
  const id = ossatureFinish || DEFAULT_FINITION_OSSATURE
  return Boolean(FINITIONS_OSSATURE[id]?.maps)
}

export function useWoodOakMaps() {
  const maps = BRUT.maps
  const [map, roughnessMap, normalMap] = useTexture([
    maps.color,
    maps.roughness,
    maps.normal,
  ])

  useLayoutEffect(() => {
    map.colorSpace = THREE.SRGBColorSpace
    roughnessMap.colorSpace = THREE.NoColorSpace
    normalMap.colorSpace = THREE.NoColorSpace
    for (const t of [map, roughnessMap, normalMap]) {
      t.wrapS = THREE.RepeatWrapping
      t.wrapT = THREE.RepeatWrapping
      t.anisotropy = 8
      t.needsUpdate = true
    }
  }, [map, roughnessMap, normalMap])

  return { map, roughnessMap, normalMap }
}

/** PBR chêne Poliigon — à utiliser dans un <mesh> (Canvas). */
export default function WoodStandardMaterial({
  roughness = BRUT.roughness,
  metalness = BRUT.metalness,
  ...rest
}) {
  const maps = useWoodOakMaps()
  return (
    <meshStandardMaterial
      map={maps.map}
      roughnessMap={maps.roughnessMap}
      normalMap={maps.normalMap}
      color="#ffffff"
      roughness={roughness}
      metalness={metalness}
      normalScale={[1, 1]}
      {...rest}
    />
  )
}
