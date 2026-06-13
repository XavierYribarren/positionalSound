import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
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
import { useDevice } from './hooks/useDevice';
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

// at the top of DemoScene.jsx
const DEMO_COLORS = {
  t1: '#888888', // Back Vocals (unassigned)
  t2: '#00ff00', // Bass
  t3: '#f6002e', // GTR Barren
  t4: '#ffae00', // GTR Erwan
  t5: '#ffffcc', // HiTom
  t6: '#00ffff', // Keys
  t7: '#ccccff', // Kick
  t8: '#ff00ff', // Lead Vox
  t9: '#ffffff', // Overheads
  t10: '#fff6e5', // Snare
  t11: '#808080', // Tom Floor
};
const DEMO_VOLUME = {
  t1: 0.48, // Back Vocals
  t2: 0.98, // Bass
  t3: 1.2, // GTR Barren
  t4: 0.97, // GTR Erwan
  t5: 0.92, // HiTom   .92
  t6: 0.8, // Keys
  t7: 1, // Kick
  t8: 0.75, // Lead Vox
  t9: 1, // Overheads
  t10: 1, // Snare
  t11: 0.85, // Tom Floor,
  t12: 0.6,
  t13: 0.5,
  t14: 0.5
};

const DEMO_SEND = {
  t1: 0.45,
  t2: 0.55,
  t3: 0.45,
  t4: 0.65,
  t5: 0.25,
  t6: 0.55,
  t7: 0.21,
  t8: 0.56,
  t9: 0.7,
  t10: 0.15,
  t11: 0.2,
};

const DEMO_MESHES = [
  { id: 'snare1', type: 'Snare', name: 'Snare 1' },
  { id: 'kick1', type: 'Kick', name: 'Kick 1' },
  { id: 'hihat1', type: 'Hihat', name: 'HiHat 1' },
  { id: 'hitom1', type: 'HiTom', name: 'HiTom 1' },
  { id: 'midtom1', type: 'MidTom', name: 'MidTom 1' },
  { id: 'floortom1', type: 'FloorTom', name: 'FloorTom 1' },
  { id: 'crash1', type: 'Crash', name: 'Crash 1' },
  { id: 'ride1', type: 'Ride', name: 'Ride 1' },
  { id: 'oh1', type: 'Overheads', name: 'Overheads' },
  {
    id: 'bass1',
    type: 'Bass',
    name: 'Bass SVT Amp',
    position: [0, 0, 10],
    rotation: [0, -Math.PI * 0.5, 0],
  },
  {
    id: 'gtr1',
    type: 'Guitar',
    name: 'Guitar Amp',
    position: [8, 0, 2],
    rotation: [0, -Math.PI * 0.5, 0],
  },
  {
    id: 'gtr2',
    type: 'Guitar',
    name: 'Guitar Amp 2',
    position: [-8, 0, 2],
    rotation: [0, Math.PI * 0.5, 0],
  },
  {
    id: 'keys1',
    type: 'Keyboard',
    name: 'Keyboard 1',
    position: [-4, 0, 5],
    rotation: [0, Math.PI * 0.75, 0],
  },
  { id: 'voc1', type: 'Vocals', name: 'Mic Vocals', position: [0, 0, 2] },
];

// 2) Your 11 demo tracks
const DEMO_TRACKS = [
  { id: 't1', url: '/demo_audio/Back_Vocals.m4a', name: 'Back Vocals' },
  { id: 't2', url: '/demo_audio/Bass.m4a', name: 'Bass' },
  { id: 't3', url: '/demo_audio/GTR_Barren.m4a', name: 'GTR Barren' },
  { id: 't4', url: '/demo_audio/GTR_Erwan.m4a', name: 'GTR Erwan' },
  { id: 't5', url: '/demo_audio/HiTom.m4a', name: 'HiTom' },
  { id: 't6', url: '/demo_audio/Keys.m4a', name: 'Keys' },
  { id: 't7', url: '/demo_audio/Kick.m4a', name: 'Kick' },
  { id: 't8', url: '/demo_audio/Lead_Vox.m4a', name: 'Lead Vox' },
  { id: 't9', url: '/demo_audio/Overheads.m4a', name: 'Overheads' },
  { id: 't10', url: '/demo_audio/Snare.m4a', name: 'Snare' },
  { id: 't11', url: '/demo_audio/Tom_Floor.m4a', name: 'Tom Floor' },
  { id: 't12', url: '/demo_audio/Crash.m4a', name: 'Crash' },
  { id: 't13', url: '/demo_audio/Ride.m4a', name: 'Ride' },
  { id: 't14', url: '/demo_audio/Hihat.m4a', name: 'Hihat' },
];

export default function DemoScene() {
  const listener = useAudioListener();
  const audioCtx = useAudioContext();
  const demoMode = true
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
  const containerRef= useRef(null)
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);



  const [playing, setPlaying] = useState(false);
  const [playOffset, setPlayOffset] = useState(0);
  const [pauseTime, setPauseTime] = useState(0);
  const [uiVisible, setUiVisible] = useState(true);
  const [perfVisible, setPerfVisible] = useState(false);

  const [trackList, setTrackList] = useState(
    DEMO_TRACKS.map((t) => ({
      id: t.id,
      url: t.url,
      name: t.name,
      buffer: null, // we'll load these with loadBuffer()
      volume: 1,
      sendLevel: 0,
    }))
  );

  const assignments = useMemo(() => {
    // helper to find by id
    const byId = (id) => {
      const t = trackList.find((t) => t.id === id);
      return t
        ? [
            {
              id: t.id,
              url: t.url,
              name: t.name,
              buffer: t.buffer,
              volume: 1,
              sendLevel: 0,
            },
          ]
        : [];
    };

    return {
      // drum kit
      snare1: byId('t10'), // Snare
      kick1: byId('t7'), // Kick
      hihat1: byId('t14'), // no loop
      hitom1: byId('t5'),
      midtom1: [], // none
      floortom1: byId('t11'),
      crash1: byId('t12'), // none
      ride1: byId('t13'), // none
      oh1: byId('t9'), // Overheads

      // amps & instruments
      bass1: byId('t2'),
      gtr1: byId('t3'), // GTR Barren
      gtr2: byId('t4'), // GTR Erwan

      keys1: byId('t6'),
      voc1: byId('t8'), // Lead Vox

      // leave Back Vocals unassigned
      null: byId('t1'),
    };
  }, [trackList]);

  const [scrubPos, setScrubPos] = useState(0);
  const [mainTrackId, setMainTrackId] = useState(null);
  const activeNodesRef = useRef({});

  const lastTapTime = useRef(0)
  const tapCount     = useRef(0)

  const handleTripleTap = () => {
    const now = Date.now()

    // if the last tap was less than 500 ms ago, we’re in the same tap sequence
    if (now - lastTapTime.current < 500) {
      tapCount.current += 1
    } else {
      // too slow → start a new sequence
      tapCount.current = 1
    }

    lastTapTime.current = now

    // once we’ve seen 3 taps in a row, toggle UI
    if (tapCount.current === 3) {
      setUiVisible(v => !v)
      tapCount.current = 0
    }
  }


  useEffect(() => {
    DEMO_TRACKS.forEach(({ id }) => {
      // add it to the store
      dispatch(addTrack(id));
      // give it its demo colour
      dispatch(setColor({ trackId: id, color: DEMO_COLORS[id] }));
      // set its starting volume to 1
      dispatch(setVolume({ trackId: id, volume: DEMO_VOLUME[id] || 1 }));
      // you could also pre-set sendLevel if you like:
      dispatch(setSendLevel({ trackId: id, sendLevel: DEMO_SEND[id] || 0 }));
    });
  }, [dispatch]);

  const [meshes] = useState(DEMO_MESHES);
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
  const [busLevel, setBusLevel] = useState(1.55);
  useEffect(() => {
    reverbGain.gain.setValueAtTime(busLevel, audioCtx.currentTime);
  }, [busLevel, reverbGain, audioCtx]);

  useEffect(() => {
    trackList.forEach((t, i) => {
      loadBuffer(t.url).then((buf) => {
        setTrackList((list) => {
          const copy = [...list];
          copy[i] = { ...copy[i], buffer: buf };
          return copy;
        });
      });
    });
  }, []);

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
    setUiVisible(false);
    // setPauseTime(null); // reset pause time
  }

  const handlePlayClick = () => {
    // 1) fullscreen right away
    if (isMobile && containerRef.current?.requestFullscreen) {
      containerRef.current.requestFullscreen().catch(() => {});
      // 2) orientation lock will only work once in fullscreen,
      //    but calling it here is fine—in some browsers it’ll queue up
      if (screen.orientation?.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    }
    // 3) immediately start audio
    playAll();
  };

  function pauseAll() {

    setPauseTime(audioCtx.currentTime - playOffset);
    setPlaying(false);
    setUiVisible(true);
  }
  function stopAll() {
    setPauseTime(0);
    setScrubPos(0); // ← record current play position
    setPlaying(false);
    setPlayOffset(0);
    setUiVisible(true);
  }

  useEffect(() => {
    if (playing) {
      setScrubPos(audioCtx.currentTime - playOffset);
    }
  }, [playing, audioCtx, playOffset]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault(); // avoid scrolling
        if (playing) pauseAll();
        else playAll();
      }
      if (e.code === 'KeyU') {
        setUiVisible((v) => !v);
      }
      if (e.code === 'KeyP') {
        setPerfVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [playing, playAll, pauseAll]);

  function updateTrack(id, props) {


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
  const playingRef = useRef(playing);
  const playOffsetRef = useRef(playOffset);
  const durationRef = useRef(duration);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    playingRef.current = playing;
    playOffsetRef.current = playOffset;
    durationRef.current = duration;
  }, [playing, playOffset, duration]);
  useEffect(() => {
    let raf;

    const loop = () => {
      if (playingRef.current) {
        const elapsed = audioCtx.currentTime - playOffsetRef.current;
        setCurrentTime(Math.min(elapsed, durationRef.current));
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

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

  const [portrait, setPortrait] = useState(
    window.matchMedia('(orientation: portrait)').matches
  );
  useEffect(() => {
    const mql = window.matchMedia('(orientation: portrait)');
    const onChange = e => setPortrait(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  // console.log(trackList)
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
      demoMode
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
      demoMode
    ]
  );
  if (isMobile && portrait) {
    return (
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'black',
          color: 'white',
          zIndex: 9999,
          padding: '1rem',
          textAlign: 'center',
        }}
      >
        <h2>
          Please rotate your device<br/>
          to landscape to continue
        </h2>
      </div>
    );
  }
  const loadedCount = trackList.filter((t) => t.buffer !== null).length
  const totalCount  = trackList.length
  const percent     = Math.round((loadedCount / totalCount) * 100)

  const allLoaded = percent === 100

  return (
    <div ref={containerRef} style={{ height: '100vh', position: 'relative' }}>
    {portrait && isMobile && playing && (
      <div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
          textAlign: 'center',
          padding: '1rem',
        }}
      >
        <h2>Please rotate your device<br/>to landscape for the best experience</h2>
      </div>
    )}
      {' '}
   {!allLoaded && (
    <div className="loader-overlay">
      <div className="loader-content">
        <div className="spinner" />
        <div className="loader-text">
          Loading… {percent}%
        </div>
      </div>
    </div>
  )}
       
      {allLoaded && (
        <><div className='canvas-main'>
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
                gl={{ antialias: true }}
                onCreated={({ gl }) => {
                  gl.shadowMap.enabled = true;
                  gl.shadowMap.type = THREE.PCFSoftShadowMap;
                }}
                onPointerMissed={() => {
                  sceneState.current = null;
                }}
                onTouchStart={handleTripleTap}
              >
                <CameraControls />
                <SceneContents {...canvasProps} />
                {perfVisible && <Perf />}
              </Canvas>
            </KeyboardControls>
          </div>
          {' '}
          <div className='rev-params'>
            {uiVisible && (
              <PlayController
              playAll={handlePlayClick}
                pauseAll={pauseAll}
                stopAll={stopAll}
                clearSession={clearSession}
                busLevel={busLevel}
                setBusLevel={setBusLevel}
                duration={duration}
                currentTime={currentTime}
                playing={playing}
                demoMode={demoMode}
              />
            )}
          </div>
     
          {/* {uiVisible && ( <div className='console-container'>
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
      </div>)}  */}
          {uiVisible && <HintTab />}
        </>
      )}
    </div>
  );
}
