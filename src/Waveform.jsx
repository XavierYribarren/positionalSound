import React, { useEffect, useRef } from 'react';

/**
 * Waveform
 * Renders a waveform preview for a given audio File
 * @param {{ file: File, width?: number, height?: number }} props
 */
export default function Waveform({ file, width = 600, height = 30 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!file) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const reader = new FileReader();

    reader.onload = async () => {
      try {
        // Decode via Web Audio API
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const arrayBuffer = reader.result;
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        // Extract channel data (mono)
        const rawData = audioBuffer.getChannelData(0);
        const samples = width;
        const blockSize = Math.floor(rawData.length / samples);
        const filteredData = [];
        for (let i = 0; i < samples; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(rawData[i * blockSize + j]);
          }
          filteredData.push(sum / blockSize);
        }
        const maxVal = Math.max(...filteredData);
        // Draw waveform
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#4A90E2';
        filteredData.forEach((val, i) => {
          const barHeight = (val / maxVal) * height / 5;
          ctx.fillRect(i, height - barHeight, 1, barHeight);
        });
      } catch {
      }
    };

    reader.readAsArrayBuffer(file);
    return () => {
      if (reader.readyState === FileReader.LOADING) reader.abort();
    };
  }, [file, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} />;
}
