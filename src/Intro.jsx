// Intro.jsx
import React, { useState, useEffect } from 'react';
import { useGLTF, useTexture, useProgress } from '@react-three/drei';
import { Link, Outlet, useLocation } from 'react-router-dom';
import './css/Intro.css';
import bgImg from './assets/MusicroomRender-min.png';
import { useDevice } from './hooks/useDevice';

const MODELS = [
  '/amps/bass_svt.glb',
  '/amps/guitar_amp.glb',
  '/drumkit/HihatMin.glb',
  '/drumkit/CrashMin.glb',
  '/drumkit/Kick.glb',
  '/drumkit/Overhead.glb',
  '/drumkit/RideMin.glb',
  '/drumkit/SnareMin.glb',
  '/drumkit/Tom2.glb',
  '/drumkit/Tom3.glb',
  '/drumkit/TomFloor.glb',
];
const TEXTURES = [
  '/amps/textures/Comb_Comb_BaseColor.png',
  '/amps/textures/Comb_Comb_Normal.png',
  '/amps/textures/Comb_Comb_Roughness.png',
  '/amps/textures/Comb_Comb_Metallic.png',
  '/drumkit/textures/cym_EmissiveMap.png',
  '/drumkit/textures/cym_normals.png',
];

export default function Intro() {
  const [preloaded, setPreloaded] = useState(false);
  const { loaded, total } = useProgress();
  const {isMobile}= useDevice()
  const location = useLocation();

  // Preload all assets once
  useEffect(() => {
    MODELS.forEach(useGLTF.preload);
    useTexture.preload(TEXTURES);
  }, []);

  // When loading is done, mark preloaded
  useEffect(() => {
    if (total > 0 && loaded >= total) {
      setPreloaded(true);
    }
  }, [loaded, total]);

  // While loading, show spinner
  if (!preloaded) {
    return (
      <div className={`fullscreen bg ${isMobile ? 'mobile' : 'desktop'}`}>
        <div className='main-titles'>
          <h1>MusicRoom</h1>
          <h3>Virtual 3D music space by BarrenXY</h3>
        </div>
        <div className='message-box'>
          Loading… ({loaded}/{total})
        </div>
      </div>
    );
  }

  // If we've preloaded and the path is NOT exactly "/", render the chosen route
  if (location.pathname !== '/') {
    return <Outlet />;
  }
  const bgStyle = {
    backgroundImage: `
      linear-gradient(to top, rgba(10,10,10,0.8), rgba(29,29,31,0.8)),
      url(${bgImg})
    `,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
  // Otherwise (we're at "/"), show the splash with both choices
  return (
<div className={`fullscreen ${isMobile ? 'mobile' : 'desktop'}`} style={bgStyle}>
     <div className={`main-titles ${isMobile ? 'mobile' : ''}`}>
        <h1>MusicRoom</h1>
        <h3>Virtual 3D music space <span className='by'>by</span> BarrenXY</h3>
      </div>
  
        <div className={`landing-buttons ${isMobile ? 'mobile' : ''}`}>
        {!isMobile ? <Link to='visualizer'>
            <button className='visualizer-av'>Try the Visualizer</button>
          </Link> : <button className='visualizer-unav'>Playground available on desktop only</button> }
          <Link to='demo'>
            <button className='demo-btn'>Barren Gamble - Your Expectations</button>
          </Link>
        </div>

    </div>
  );
}
