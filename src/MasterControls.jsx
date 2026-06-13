// MasterControls.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useAudioContext } from './AudioContextProvider';

export default function MasterControls({ masterGain, analyser }) {
  const audioCtx = useAudioContext();
  const [level, setLevel] = useState(0);
  const [gainValue, setGainValue] = useState(1); // controlled fader
  const raf = useRef();
  useEffect(() => {
    if (!analyser) return;
    analyser.fftSize = 256;
    const data = new Uint8Array(analyser.fftSize);

    const updateMeter = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const x = (data[i] - 128) / 128;
        sum += x * x;
      }
      const rms = Math.sqrt(sum / data.length);
      setLevel(rms);
      raf.current = requestAnimationFrame(updateMeter);
    };
    updateMeter();
    return () => cancelAnimationFrame(raf.current);
  }, [analyser]);

  const onFaderChange = (e) => {
    // parse and clamp to [0,1]
    const raw = parseFloat(e.target.value);
    const v = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), 1) : 0;

    setGainValue(v);

    // safely grab currentTime, fallback to 0 if undefined
    const now = typeof audioCtx.currentTime === 'number'
      ? audioCtx.currentTime
      : 0;
    masterGain.gain.setValueAtTime(v, now);
  };

  return (
    <div style={{ display:'flex', alignItems:'center', gap:'1em', padding:'0.5em' }}>
      {/* VU bar */}
      <div style={{
        width: '100px', height: '10px',
        background: '#222', position: 'relative',
        borderRadius: '2px', overflow: 'hidden'
      }}>
        <div style={{
          width: `${Math.min(level,1)*100}%`,
          height: '100%',
          background: '#4A90E2'
        }} />
      </div>

      {/* Master fader */}
      <input
        type="range"
        min="0" max="1" step="0.01"
        // defaultValue="1"
        value={gainValue}
        onChange={onFaderChange}
      />
    </div>
  );
}
