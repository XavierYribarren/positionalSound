import React, { forwardRef, useMemo, useRef } from 'react'
import { useGLTF, useTexture } from '@react-three/drei'
import { drumkit } from './drumkitMaterials'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
export const CrashMin = forwardRef((props, ref) => {
  const { nodes, materials } = useGLTF('/drumkit/CrashMin.glb')
    const { scene } = useThree();
        const metalMat = useMemo(() => drumkit.metalMat.clone(), []);
            const plasticMat  = useMemo(() => drumkit.plasticMat.clone(), []);
  const [cymEmissiveMap, cymNormalMap] = useTexture([
    '/drumkit/textures/cym_EmissiveMap.png',
    '/drumkit/textures/cym_normals.png',
  ]);
  useMemo(() => {
    if (cymNormalMap) {
      cymNormalMap.flipY = false;
      cymNormalMap.colorSpace = THREE.SRGBColorSpace;
    }
    if (cymEmissiveMap) {
      cymEmissiveMap.colorSpace = THREE.SRGBColorSpace;
    }
  }, [cymNormalMap, cymEmissiveMap]);
  const cymbalMaterial = useMemo(() => {
    return new THREE.MeshPhongMaterial({
      color: '#e8cc95', // a base diffuse color
      // metalness: 1,
      shininess: .81,
      reflectivity: .38,
      roughness: 0.25,
      normalMap: cymNormalMap || null,
      emissive: new THREE.Color(0xe8cc95),
      emissiveMap: cymEmissiveMap || null,
      emissiveIntensity: 0,
       name: 'cymbalMat',
       envMap: scene.environment,
      
    });
  }, [cymNormalMap, cymEmissiveMap]);
  return (
    <group {...props} dispose={null} position={[0,0,-3]}>
      <group position={[0.526, 0.475, -0.214]}>
 <mesh
          castShadow
          receiveShadow
          geometry={nodes.Circle002.geometry}
          material={metalMat}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Circle002_1.geometry}
          material={plasticMat}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Circle002_2.geometry}
            material={metalMat}
        />
        <mesh
          castShadow
          // receiveShadow
          geometry={nodes.Circle002_3.geometry}
          material={cymbalMaterial}
        />
      </group>
    </group>
  )
})

useGLTF.preload('/drumkit/CrashMin.glb')