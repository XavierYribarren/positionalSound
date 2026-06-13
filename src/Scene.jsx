import React, { Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Perf } from 'r3f-perf';
import { OrbitControls, TransformControls } from '@react-three/drei';
import EnvComp from './EnvComp';
import ObjSound from './ObjSound';
import { useSnapshot } from 'valtio';
import { sceneState as state } from './utils/sceneState';

const modes = ['translate', 'rotate', 'scale'];


function Controls() {
  const snap = useSnapshot(state);
  const scene = useThree((state) => state.scene);




  return (
    <>
      {snap.current && (
        <TransformControls
          object={scene.getObjectByName(snap.current)}
          mode={modes[snap.mode]}
        />
      )}
      <OrbitControls
        makeDefault
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 1.75}
      />
    </>
  );
}

export default function Scene({ tracks, globalPlay, playTrigger, masterGain, reverbNode }) {
  return (
    <Canvas  dpr={[1, 2]} shadows>
      {/* Lighting */}
      <pointLight position={[5, 10, 5]} intensity={50.8} castShadow />
      
      {/* Environment */}
      <EnvComp />

      {/* Main audio objects */}
      <Suspense fallback={null}>
        <group>
          {tracks.map((t, i) => (
            <ObjSound
              key={`${t.name}-${i}`}
              name={t.name}
              file={t.file}
              dist={t.dist}
              defPos={t.defPos}
              url={t.url}
              on={globalPlay}
              delay={t.delay}
              instrument={t.instrument}
              stereo={t.isStereo}
              playTrigger={playTrigger}
              globalPlay={globalPlay}
              masterGain={masterGain}
              reverbNode={reverbNode}
              onClick={() => {}}
            />
          ))}
        </group>
      </Suspense>

      {/* Controls */}
      {/* <TransformControls />
      <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 1.75} /> */}
<Controls/>
      {/* Performance monitor */}
      <Perf deepAnalyze />
    </Canvas>
  );
}
