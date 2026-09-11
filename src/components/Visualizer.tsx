import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../services/audioEngine';

interface VisualizerProps {
  activeCount: number;
}

export const Visualizer: React.FC<VisualizerProps> = ({ activeCount }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = 64;
    const dataArray = new Uint8Array(bufferLength);
    const waveArray = new Uint8Array(bufferLength);

    const render = () => {
      animId = requestAnimationFrame(render);

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      audioEngine.getAnalyserData(dataArray);
      audioEngine.getWaveformData(waveArray);

      // Gradient background subtle
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, 'rgba(10, 24, 56, 0.8)');
      bgGrad.addColorStop(1, 'rgba(6, 15, 38, 0.9)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 1.8;
      let x = 0;

      // Draw frequency spectrum bars with blue and white colors
      for (let i = 0; i < bufferLength; i++) {
        const val = dataArray[i];
        const percent = val / 255;
        const barHeight = Math.max(3, percent * height * 0.75);

        // Color gradient: Royal Blue to Pure White
        const r = Math.round(59 + percent * 196); // 59 -> 255
        const g = Math.round(130 + percent * 125); // 130 -> 255
        const b = 255; // 255

        ctx.fillStyle = activeCount > 0 ? `rgba(${r}, ${g}, ${b}, ${0.5 + percent * 0.5})` : 'rgba(37, 99, 235, 0.2)';
        ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);

        // Top glow pip (pure white)
        if (activeCount > 0 && barHeight > 6) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, height - barHeight - 2, barWidth - 1, 2);
        }

        x += barWidth;
      }

      // Draw smooth wave overlay in bright icy white-blue
      ctx.beginPath();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = activeCount > 0 ? 'rgba(219, 234, 254, 0.85)' : 'rgba(37, 99, 235, 0.3)';
      const sliceWidth = width / bufferLength;
      let wx = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = waveArray[i] / 128.0;
        const wy = (v * height) / 2;
        if (i === 0) {
          ctx.moveTo(wx, wy);
        } else {
          ctx.lineTo(wx, wy);
        }
        wx += sliceWidth;
      }
      ctx.stroke();
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [activeCount]);

  return (
    <div id="audio-visualizer-container" className="relative w-full h-12 rounded-2xl overflow-hidden border border-blue-500/40 shadow-[0_4px_20px_rgba(37,99,235,0.25)] bg-[#0a1838]/90 backdrop-blur-xl">
      <canvas
        ref={canvasRef}
        width={800}
        height={48}
        className="w-full h-full block"
      />
      <div className="absolute inset-0 pointer-events-none flex items-center justify-between px-3 text-[11px] font-mono font-medium text-blue-100">
        <span className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${activeCount > 0 ? 'bg-blue-400 shadow-[0_0_8px_#60a5fa] animate-pulse' : 'bg-blue-900/60'}`} />
          <span className="font-bold tracking-tight text-white">{activeCount > 0 ? `LIVE // ${activeCount} ÁUDIO(S)` : 'SPECTRUM IDLE'}</span>
        </span>
        <span className="font-mono text-[10px] text-blue-300/80 hidden sm:inline tracking-wider">
          48 kHz • DSP 32-BIT
        </span>
      </div>
    </div>
  );
};
