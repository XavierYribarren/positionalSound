import { Environment, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import * as THREE from 'three';
import LightBars from './LightBars';

function EnvComp({ playing, analyser }) {
  const mode = useSelector((state) => state.viewMode);

  const floorRef = useRef();
  const lightRef = useRef();
  const [target, setTarget] = useState(() => (playing ? 0 : 1));
  const repeatScale = 50;

  const [floorCol, floorNorm, floorRough, floorAO, floorDif] = useTexture([
    '/stage_texture/Stage_Floor_001_basecolor.jpg',
    '/stage_texture/Stage_Floor_001_normal.jpg',
    '/stage_texture/floor_Rough-min.png',
    '/stage_texture/Stage_Floor_001_ambientOcclusion.jpg',
    '/stage_texture/floor_Dif-min.png',
  ]);

  // Texture config — stable, pas besoin de recourir à useMemo
  useMemo(() => {
    [floorCol, floorNorm, floorRough, floorAO, floorDif].forEach((tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeatScale, repeatScale);
      tex.colorSpace = THREE.SRGBColorSpace;
    });
  }, [floorCol, floorNorm, floorRough, floorAO, floorDif]);

  // ✅ Dépendances ajoutées + dispose dans le cleanup
  const floorMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#050505',
        roughnessMap: floorRough,
        metalnessMap: floorRough,
      }),
    [floorRough]
  );

  // ✅ Dispose du matériau et des textures au unmount
  useEffect(() => {
    return () => {
      floorMat.dispose();
      [floorCol, floorNorm, floorRough, floorAO, floorDif].forEach((tex) =>
        tex.dispose()
      );
    };
  }, [floorMat, floorCol, floorNorm, floorRough, floorAO, floorDif]);

  useEffect(() => {
    setTarget(playing ? 0 : 4);
  }, [playing]);

  useFrame((_, delta) => {
    if (!lightRef.current) return;
    const cur = lightRef.current.intensity;
    lightRef.current.intensity = THREE.MathUtils.lerp(cur, target, delta * 4);
  });

  return (
    <>
      <pointLight
        position={[-2, 15, 0]}
        castShadow
        ref={lightRef}
        decay={0.2}
        power={0}
        scale={10}
        color={0xffffff}
        shadow-radius={2}
        shadow-bias={-0.00008}
      />
      <mesh
        ref={floorRef}
        rotation={[-Math.PI * 0.5, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        material={floorMat}
        scale={5}
      >
        <planeGeometry args={[100, 100]} />
      </mesh>
      <LightBars count={24} radius={120} analyser={analyser} />
      <Environment preset='city' environmentIntensity={0.02} />
    </>
  );
}

export default EnvComp;