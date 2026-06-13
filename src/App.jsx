import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { Perf } from 'r3f-perf';
import { nanoid } from 'nanoid';
import './App.css';
import ImportMenu from './ImportMenu';
import { Controls, ObjSound } from './ObjControls';
import EnvComp from './EnvComp';
import Sound from './Sound';
import { Kick } from './instruments/drumkit/Kick';
import { Snare } from './instruments/drumkit/SnareMin';
import { Hihat } from './instruments/drumkit/Hihat';
import { HihatMin } from './instruments/drumkit/HihatMin';
import { HiTom } from './instruments/drumkit/HiTom';
import { MidTom } from './instruments/drumkit/MidTom';
import { FloorTom } from './instruments/drumkit/FloorTom';
// import { Crash } from './instruments/drumkit/Crash';
import { CrashMin } from './instruments/drumkit/CrashMin';
import { Ride } from './instruments/drumkit/Ride';
import { RideMin } from './instruments/drumkit/RideMin';
import { Overheads } from './instruments/drumkit/Overheads';
import { BassSVTAmp } from './instruments/amps/BassSVTAmp';
import { GuitarAmp } from './instruments/amps/GuitarAmp';
import { Micro } from './instruments/mics/Micro';
import { Keyboard } from './instruments/keyboard_other/Keyboard';
import {
  Bloom,
  DepthOfField,
  EffectComposer,
  GodRays,
  Noise,
  Vignette,
} from '@react-three/postprocessing';

import { useSelector, useDispatch } from 'react-redux';
import { setMode, toggleMode } from './reducer/viewModeSlice';
import {
  addTrack,
  removeTrack,
  toggleVisibility,
  setColor,
  setVolume,
  setSendLevel,
} from './reducer/trackSettingsSlice';
import throttle from 'lodash.throttle';
import FrequencySpectrum from './FrequencySpectrum';
import { useAudioContext, useAudioListener } from './AudioContextProvider';
import { useBufferCache } from './hooks/useBufferCache';
import TrackConsole from './TrackConsole';
import { RxMixerVertical } from 'react-icons/rx';
import { sceneState } from './utils/sceneState';
import { MeshSpawner } from './MeshSpawner';
import { SceneContents } from './SceneContents';
import PlayController from './PlayController';
import { CustomOrbitControls } from './CustomOrbitControls';
import { KeyboardControls } from '@react-three/drei';
import { CameraControls } from './CameraControls';
import HintTab from './HintTab';
const COMPONENTS = {
  Snare: Snare,
  Kick: Kick,
  Hihat: HihatMin,
  HiTom: HiTom,
  MidTom: MidTom,
  FloorTom: FloorTom,
  Crash: CrashMin,
  Ride: RideMin,
  Overheads: Overheads,
  Guitar: GuitarAmp,
  Bass: BassSVTAmp,
  Keyboard: Keyboard,
  Vocals: Micro,
};
const AUTO_ASSIGN_KEYWORDS = {
  Guitar: ['guitar', 'gtr', 'gtramp', 'guitar amp'],
  Vocals: ['vocals', 'voc', 'vox', 'sing', 'vocal', 'lead vox'],
  Bass: ['bass', 'svt', 'bass amp'],
  Snare: ['snare', 'sn'],
  Kick: ['kick', 'bd'],
  Hihat: ['hi-hat', 'hihat', 'hh'],
  HiTom: ['hitom', 'hi tom'],
  MidTom: ['midtom', 'mid tom'],
  FloorTom: ['floortom', 'floor tom'],
  Crash: ['crash'],
  Ride: ['ride'],
  Overheads: ['overhead', 'oh'],
};

const STORAGE_KEYS = {
  trackList: 'myapp:trackList',
  assignments: 'myapp:assignments',
  meshes: 'myapp:meshes',
};

export default function App() {
  const listener = useAudioListener();
  const audioCtx = useAudioContext();

  const { loadBuffer, clearBuffer, clearAllBuffers, cache } =
    useBufferCache(audioCtx);

  const masterTapGain = useMemo(() => audioCtx.createGain(), [audioCtx]);
  const masterAnalyser = useMemo(() => audioCtx.createAnalyser(), [audioCtx]);


  useMemo(() => {
    masterTapGain.gain.value = 1;
    masterTapGain.connect(masterAnalyser);
    // ──> !!!!!!!!!!! (do *not* connect masterAnalyser to destination)
  }, [masterTapGain, masterAnalyser]);

  const dispatch = useDispatch();
  const settings = useSelector((state) => state.trackSettings);


  const [consoleOpen, setConsoleOpen] = useState(false);
  const [spawnerOpen, setSpawnerOpen] = useState(false);

  const [playing, setPlaying] = useState(false);
  const [playOffset, setPlayOffset] = useState(0);
  const [pauseTime, setPauseTime] = useState(0);
   const [uiVisible, setUiVisible] = useState(true);
  const [perfVisible, setPerfVisible] = useState(false)

  const [trackList, setTrackList] = useState([]);
  const [assignments, setAssignments] = useState({ null: [] });
  const [scrubPos, setScrubPos] = useState(0);
  const [mainTrackId, setMainTrackId] = useState(null);
  const activeNodesRef = useRef({});

  const [meshes, setMeshes] = useState(() => {
    const v = localStorage.getItem(STORAGE_KEYS.meshes);
    return v ? JSON.parse(v) : [];
  });


  const [leftDelayTime, setLeftDelayTime] = useState(0.04118);
  const [rightDelayTime, setRightDelayTime] = useState(0.04181);
  const [hpfFreq, setHpfFreq] = useState(200);
  const [lpfFreq, setLpfFreq] = useState(6500);

  const splitter = useMemo(() => audioCtx.createChannelSplitter(2), [audioCtx]);
  const leftDelayNode = useMemo(() => audioCtx.createDelay(1.0), [audioCtx]);
  const rightDelayNode = useMemo(() => audioCtx.createDelay(1.0), [audioCtx]);
  const merger = useMemo(() => audioCtx.createChannelMerger(2), [audioCtx]);
  const convolver = useMemo(() => audioCtx.createConvolver(), [audioCtx]);
  const reverbGain = useMemo(() => {
    const g = audioCtx.createGain();
    g.gain.value = 0.2; // default wet level
    return g;
  }, [audioCtx]);
  const reverbHighPass = useMemo(() => {
    const f = audioCtx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 200; // default 200 Hz
    return f;
  }, [audioCtx]);
  const reverbLowPass = useMemo(() => {
    const f = audioCtx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 5000; // default 5 kHz
    return f;
  }, [audioCtx]);
  // Load impulse response once and wire bus
  useEffect(() => {
    fetch('/SteinmanHall.wav')
      .then((res) => res.arrayBuffer())
      .then((buf) => audioCtx.decodeAudioData(buf))
      .then((decoded) => {
        convolver.buffer = decoded;

        convolver.connect(splitter);

        // 4) wire each channel through its own delay into the merger
        splitter.connect(leftDelayNode, 0);
        splitter.connect(rightDelayNode, 1);
        // delays -> merger channels
        leftDelayNode.connect(merger, 0, 0);
        rightDelayNode.connect(merger, 0, 1);
        // merger -> reverbGain -> destination

        // 5) merger → your reverbGain → listener
        merger.connect(reverbHighPass);
        reverbHighPass.connect(reverbLowPass);
        reverbLowPass.connect(reverbGain);
        reverbGain.connect(listener.getInput());
      })
      .catch(() => {});
  }, [
    audioCtx,
    convolver,
    reverbGain,
    reverbHighPass,
    reverbLowPass,
    listener,
  ]);

  useEffect(() => {
    leftDelayNode.delayTime.setValueAtTime(leftDelayTime, audioCtx.currentTime);
  }, [leftDelayTime, leftDelayNode, audioCtx]);
  useEffect(() => {
    rightDelayNode.delayTime.setValueAtTime(
      rightDelayTime,
      audioCtx.currentTime
    );
  }, [rightDelayTime, rightDelayNode, audioCtx]);
  useEffect(() => {
    reverbHighPass.frequency.setValueAtTime(hpfFreq, audioCtx.currentTime);
  }, [hpfFreq, reverbHighPass, audioCtx]);
  useEffect(() => {
    reverbLowPass.frequency.setValueAtTime(lpfFreq, audioCtx.currentTime);
  }, [lpfFreq, reverbLowPass, audioCtx]);
  // 4) UI state for global reverb bus level
  const [busLevel, setBusLevel] = useState(0.2);
  useEffect(() => {
    reverbGain.gain.setValueAtTime(busLevel, audioCtx.currentTime);
  }, [busLevel, reverbGain, audioCtx]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.meshes, JSON.stringify(meshes));
  }, [meshes]);

  function addMesh(type) {
    setMeshes((prev) => {
      const count = prev.filter((m) => m.type === type).length;
      const name = `${type} ${count + 1}`;
      return [...prev, { id: nanoid(), type, name }];
    });
  }
async function handleImport(items) {
 const newTracks = await Promise.all(
    items.map(async (f) => {
      const buffer = await loadBuffer(f.url)
      return { id: nanoid(), url: f.url, name: f.name, buffer, volume: 1, sendLevel: 0 }
    })
  )
  // 1) add to trackList
  setTrackList((prev) => [...prev, ...newTracks])
  newTracks.forEach((t) => dispatch(addTrack(t.id)))
  setTrackList((prev) => {
    const existing = new Set(prev.map((t) => t.id))
    const toAdd   = newTracks.filter((t) => !existing.has(t.id))
    if (toAdd.length === 0) return prev
    return [...prev, ...toAdd]
  })

}

  function toggleAssign(trackObj, targetMeshId) {
    setAssignments((prev) => {
      const cleaned = Object.fromEntries(
        Object.entries(prev).map(([meshId, arr]) => [
          meshId,
          arr.filter((t) => t.id !== trackObj.id),
        ])
      );
      return {
        ...cleaned,
        [targetMeshId]: [...(cleaned[targetMeshId] || []), trackObj],
      };
    });
  }

  // assuming COMPONENTS is in scope, e.g.
  // const COMPONENTS = { Snare, Kick, … }

  async function handleAutoAssign(items) {
    // 1) preload buffers & build newTracks
    const newTracks = await Promise.all(
      items.map(async (f) => {
        const buffer = await loadBuffer(f.url);
        return {
          id: nanoid(),
          file: f.file,
          url: f.url,
          name: f.name,
          buffer,
          volume: 1,
          sendLevel: 0,
        };
      })
    );

    // 2) add to trackList & dispatch Redux
    setTrackList((prev) => [...prev, ...newTracks]);
    newTracks.forEach((t) => dispatch(addTrack(t.id)));

    // 3) bucket your meshes by type
    const meshBuckets = meshes.reduce((b, m) => {
      (b[m.type] ||= []).push(m.id);
      return b;
    }, {});

    // 4) round-robin counters
    const assignedPerType = {};

    // 5) update assignments state
    setAssignments((prev) => {
      const next = { ...prev };

      newTracks.forEach((t) => {
        const nameLower = t.name.toLowerCase();

        // try keyword lookup
        let match = Object.entries(AUTO_ASSIGN_KEYWORDS).find(([type, keys]) =>
          keys.some((kw) => nameLower.includes(kw))
        )?.[0];

        // fallback to literal COMPONENTS key
        if (!match) {
          match = Object.keys(COMPONENTS).find((key) =>
            nameLower.includes(key.toLowerCase())
          );
        }

        // if we found a type and there are meshes available
        if (match && meshBuckets[match]?.length) {
          const candidates = meshBuckets[match];
          const i = assignedPerType[match] || 0;
          const meshId = candidates[i % candidates.length];
          assignedPerType[match] = i + 1;

          next[meshId] = [...(next[meshId] || []), t];
        } else {
          // no match → leave it unassigned
          next.null = [...(next.null || []), t];
        }
      });

      return next;
    });
  }

  useEffect(() => {
    const longest = trackList.reduce((longest, track) => {
      return track.buffer?.duration > (longest?.buffer?.duration || 0)
        ? track
        : longest;
    }, null);
    if (longest?.id) setMainTrackId(longest.id);
  }, [trackList]);

  async function playAll() {
    await audioCtx.resume();
    const resumeOffset = pauseTime || scrubPos || 0;
    setPlayOffset(audioCtx.currentTime - resumeOffset);
    setPlaying(true);
       setUiVisible(false)
    // setPauseTime(null); // reset pause time
  }
  function pauseAll() {
    // console.log(audioCtx.currentTime, playOffset);
    setPauseTime(audioCtx.currentTime - playOffset);
    // console.log(audioCtx.currentTime - playOffset);
    setPlaying(false);
       setUiVisible(true)
   
  }
  function stopAll() {
    setPauseTime(0);
    setScrubPos(0); // ← record current play position
    setPlaying(false);
    setPlayOffset(0);
      setUiVisible(true)
  }

  useEffect(() => {
    if (playing) {
      setScrubPos(audioCtx.currentTime - playOffset);
    }
  }, [playing, audioCtx, playOffset]);


  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();              // avoid scrolling
        if (playing) pauseAll();
        else         playAll();
      }
      if (e.code === 'KeyU') {
        setUiVisible(v => !v);
      }
       if (e.code === 'KeyP') {
        setPerfVisible(v => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [playing, playAll, pauseAll]);


  function updateTrack(id, props) {
    setAssignments((prev) => {
      const updated = {};
      for (const [bucket, tracks] of Object.entries(prev)) {
        updated[bucket] = tracks.map((t) =>
          t.id === id ? { ...t, ...props } : t
        );
      }
      return updated;
    });

    // 🔁 Sync Redux with local change
    if (props.volume !== undefined) {
      dispatch(setVolume({ trackId: id, volume: props.volume }));
    }
    if (props.sendLevel !== undefined) {
      dispatch(setSendLevel({ trackId: id, sendLevel: props.sendLevel }));
    }
  }
  function clearSession() {
    trackList.forEach((track) => {
      dispatch(removeTrack(track.id));
    });
    localStorage.removeItem(STORAGE_KEYS.meshes);
    setTrackList([]);
    setAssignments({ null: [] });
    setMeshes([]);
    stopAll();
    clearAllBuffers();
  }
  const duration = useMemo(() => {
    const main = trackList.find((t) => t.id === mainTrackId);
    return main?.buffer?.duration || 0;
  }, [mainTrackId, trackList]);

  const [currentTime, setCurrentTime] = useState(0);
  useEffect(() => {
    let raf;
    function updateTime() {
      if (playing) {
        const elapsed = audioCtx.currentTime - playOffset;
        setCurrentTime(Math.min(elapsed, duration));
      }
      raf = requestAnimationFrame(updateTime);
    }
    raf = requestAnimationFrame(updateTime);
    return () => cancelAnimationFrame(raf);
  }, [playing, playOffset, audioCtx, duration]);

  const handleVolumeChange = useCallback((trackId, newVol) => {
    dispatch(setVolume({ trackId, volume: newVol }));
  }, []);

  const analyserMapRef = useRef({});

  // 4) When each Sound reports "here’s my analyser", stash it
  const handleAnalyserReady = useCallback((trackId, analyser) => {
    analyserMapRef.current[trackId] = analyser;
  }, []);

  const sourcesForFloor = useMemo(() => {
    return Object.entries(analyserMapRef.current)
      .filter(([id]) => settings[id]?.visible)
      .map(([id, analyser]) => ({
        analyser,
        volume: settings[id].volume, // whatever you store
        color: new THREE.Color(settings[id].color),
      }));
  }, [settings]);

  function removeTrackById(trackId) {
    if (activeNodesRef.current[trackId]) {
      try {
        activeNodesRef.current[trackId].stop();
      } catch {
      }
      delete activeNodesRef.current[trackId];
    }
    const track = trackList.find((t) => t.id === trackId);
    if (track?.url) clearBuffer(track.url);
    // 1. Remove from trackList
    setTrackList((prev) => prev.filter((t) => t.id !== trackId));

    // 2. Remove from assignments (all buckets)
    setAssignments((prev) => {
      const next = {};
      for (const [bucket, arr] of Object.entries(prev)) {
        next[bucket] = arr.filter((t) => t.id !== trackId);
      }
      return next;
    });

    // 3. Remove from Redux store
    dispatch(removeTrack(trackId));
  }
  function removeMesh(meshId) {
    const removed = meshes.find((m) => m.id === meshId);
    if (!removed) return;

    setMeshes((prev) => prev.filter((m) => m.id !== meshId));

    setAssignments((prev) => {
      const reassigned = [...(prev[meshId] || [])];
      const next = { ...prev };
      delete next[meshId];
      next.null = [...(next.null || []), ...reassigned];
      return next;
    });
  }

  const onNodeReady = useCallback((trackId, node) => {
    // if there was an old node, stop it
    activeNodesRef.current[trackId]?.stop?.();
    activeNodesRef.current[trackId] = node;
  }, []);

  const onReorderTracks = useCallback(({ active, over }) => {
    if (!over) return;
    setTrackList((prev) => {
      const oldIndex = prev.findIndex((t) => t.id === active.id);
      const newIndex = prev.findIndex((t) => t.id === over.id);
      const newList = Array.from(prev);
      newList.splice(oldIndex, 1);
      newList.splice(newIndex, 0, prev[oldIndex]);
      return newList;
    });
  }, []);


// useEffect(() => {
// console.log('MESHES',meshes , '||||||', 'TRACKLIST',trackList, '||||||', 'ASSIGNMENTS', assignments)

// }, [assignments, meshes, trackList])

  const canvasProps = useMemo(
    () => ({
      meshes,
      assignments,
      settings,
      listener,
      convolver,
      masterTapGain,
      masterAnalyser,
      handleAnalyserReady,
      handleVolumeChange,
      playing,
      playOffset,
      pauseTime,
      setPlayOffset,
      setPauseTime,
      setPlaying,
      setUiVisible,
      mainTrackId,
      removeMesh,
      sceneState,
      sourcesForFloor,
      updateTrack,
      trackList,
      components: COMPONENTS,
      onNodeReady,
    }),
    [
      meshes,
      assignments,
      settings,
      listener,
      convolver,
      masterTapGain,
      masterAnalyser,
      handleAnalyserReady,
      handleVolumeChange,
      playing,
      playOffset,
      pauseTime,
      setPlayOffset,
      setPauseTime,
      setPlaying,
      setUiVisible,
      mainTrackId,
      removeMesh,
      sceneState,
      sourcesForFloor,
      updateTrack,
      trackList,
      onNodeReady,
    ]
  );


  return (
    <div style={{ height: '100vh' }}>
      <div className='rev-params'>
        {/*         
        <div className='rev-sliders'>
        <div style={{ margin: '1em 0' }} className='param'>
          <label>Left Delay (ms): {leftDelayTime}</label>
          <input
            type='range'
            min={0}
            max={0.2}
            step={0.00001}
            value={leftDelayTime}
            onChange={(e) => setLeftDelayTime(parseFloat(e.target.value))}
          />
        </div>
        <div style={{ margin: '1em 0' }} className='param'>
          <label>Right Delay (ms): {rightDelayTime}</label>
          <input
            type='range'
            min={0}
            max={0.2}
            step={0.00001}
            value={rightDelayTime}
            onChange={(e) => setRightDelayTime(parseFloat(e.target.value))}
          />
        </div>
        <div style={{ margin: '1em 0' }} className='param'>
          <label>Reverb Low-Cut (Hz): {hpfFreq}</label>
          <input
            type='range'
            min={20}
            max={2000}
            step={1}
            value={hpfFreq}
            onChange={(e) => setHpfFreq(parseFloat(e.target.value))}
          />
        </div>
        <div style={{ margin: '1em 0' }} className='param'>
          <label>Reverb High-Cut (Hz): {lpfFreq}</label>
          <input
            type='range'
            min={500}
            max={20000}
            step={100}
            value={lpfFreq}
            onChange={(e) => setLpfFreq(parseFloat(e.target.value))}
          />
        </div>
        </div> 
        */}
         {uiVisible && (   <PlayController
          playAll={playAll}
          pauseAll={pauseAll}
          stopAll={stopAll}
          clearSession={clearSession}
          busLevel={busLevel}
          setBusLevel={setBusLevel}
          duration={duration}
          currentTime={currentTime}
          playing={playing}
        />)}
      </div>

      {uiVisible && (    <div className={`spawner-container ${spawnerOpen ? 'open' : ''}`}>
        <button
          className='spawner-toggle'
          onClick={() => setSpawnerOpen((v) => !v)}
        >
          {spawnerOpen ? '×' : '☰'}
        </button>

        <MeshSpawner
          className={`mesh-spawner ${spawnerOpen ? 'open' : ''}`}
          components={COMPONENTS}
          meshes={meshes}
          addMesh={addMesh}
        />
      </div>)}

      {/* Center: 3D canvas */}

      {/* <div className='canvas-main'>{memoizedCanvas}</div> */}

      <div className='canvas-main'>
        <KeyboardControls
          map={[
            { name: 'forward', keys: ['ArrowUp', 'w', 'W'] },
            { name: 'backward', keys: ['ArrowDown', 's', 'S'] },
            { name: 'left', keys: ['ArrowLeft', 'a', 'A'] },
            { name: 'right', keys: ['ArrowRight', 'd', 'D'] },
            { name: 'jump', keys: ['Space'] },
          ]}
        >
          <Canvas
            camera={{ position: [10, 5, 20], fov: 35 }}
            dpr={[1, 2]}
            shadows
            gl={{ antialias: true, preserveDrawingBuffer: true }}
            onCreated={({ gl }) => {
              gl.shadowMap.enabled = true;
              gl.shadowMap.type = THREE.PCFSoftShadowMap;
            }}
            onPointerMissed={() => {
              sceneState.current = null;
            }}
          >
            <CameraControls />
            <SceneContents {...canvasProps} />
{perfVisible && (
            <Perf />
)}
          </Canvas>
        </KeyboardControls>
      </div>
        
         {uiVisible && ( <div className='console-container'>
        <button
          className='toggle-button'
          onClick={() => setConsoleOpen((prev) => !prev)}
        >
          <RxMixerVertical size={24} />
        </button>
        <TrackConsole
          className={`track-console ${consoleOpen ? 'open' : ''}`}
          trackList={trackList}
          settings={settings}
          assignments={assignments}
          updateTrack={updateTrack}
          visibleMap={settings}
          toggleVisibility={(trackId) => dispatch(toggleVisibility(trackId))}
          setColor={(trackId, color) => dispatch(setColor({ trackId, color }))}
          onAdd={handleImport}
          onAutoAssign={handleAutoAssign}
          removeTrack={removeTrackById}
          meshes={meshes}
          toggleAssign={toggleAssign}
          isReorderable={true}
          onReorder={onReorderTracks}
        />
      </div>)} 
        {uiVisible && (  <HintTab/>)}
    </div>
  );
}
