import React, { forwardRef, useRef, useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';

export const Micro = forwardRef((props, ref) => {
  const { nodes, materials } = useGLTF('/mics_keys/mic_stand.glb');
  const { scene } = useThree();


  const lightRef = useRef();
  const micMeshRef = useRef(null);

  // const micMat = useMemo(() => new THREE.MeshPhongMaterial({reflectivity: 1, shininess:1, color: '#ccc', specular: '#111'}))
  const micMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        metalness: 1,
        roughness: 0.1,
        color: '#ccc',
      }), []
  );

  useEffect(() => {
    if (lightRef.current && micMeshRef.current) {
      lightRef.current.target = micMeshRef.current;
    }
  }, [scene]);

  return (
    <group {...props} dispose={null}
    position={props.position? props.position : [0,0,0]}
    >
      <group position={ [0, 4, 0]}>
        <spotLight
          ref={lightRef}
          castShadow
          userData={{ intensityMultiplier: 1000 }}
          color={props.color}
          angle={0.24}
          penumbra={0.42}
          distance={50}
          shadow-camera-far={15}
          shadow-mapSize={[256, 256]}
        />
      </group>
      <mesh
        ref={micMeshRef}
        castShadow
        receiveShadow
        geometry={nodes.Mic003.geometry}
        material={micMat}
      />

      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Sphere001.geometry}
        material={nodes.Sphere001.material}
      />
    </group>
  );
});

useGLTF.preload('/mics/mic_stand.glb');
