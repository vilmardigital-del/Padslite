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
      bgGrad.addColorStop(0, 'rgba(32, 11, 2, 0.75)');
      bgGrad.addColorStop(1, 'rgba(20, 6, 1, 0.85)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 1.8;
      let x = 0;

      // Draw frequency spectrum bars with orange and gold colors
      for (let i = 0; i < bufferLength; i++) {
        const val = dataArray[i];
        const percent = val / 255;
        const barHeight = Math.max(3, percent * height * 0.75);

        // Color gradient: Warm Orange to Gold
        const r = Math.round(234 + percent * 21); // 234 -> 255
        const g = Math.round(110 + percent * 90); // 110 -> 200 (orange to gold)
        const b = Math.round(11 + percent * 25);

        ctx.fillStyle = activeCount > 0 ? `rgba(${r}, ${g}, ${b}, ${0.45 + percent * 0.55})` : 'rgba(180, 83, 9, 0.2)';
        ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);

        // Top glow pip (gold)
        if (activeCount > 0 && barHeight > 6) {
          ctx.fillStyle = 'rgb(253, 224, 71)';
          ctx.fillRect(x, height - barHeight - 2, barWidth - 1, 2);
        }

        x += barWidth;
      }

      // Draw smooth wave overlay in warm gold
      ctx.beginPath();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = activeCount > 0 ? 'rgba(251, 191, 36, 0.75)' : 'rgba(180, 83, 9, 0.3)';
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
    <div id="audio-visualizer-container" className="relative w-full h-12 rounded-2xl overflow-hidden border border-orange-500/40 shadow-[0_4px_20px_rgba(234,88,12,0.2)] bg-[#260c01]/90 backdrop-blur-xl">
      <canvas
        ref={canvasRef}
        width={800}
        height={48}
        className="w-full h-full block"
      />
      <div className="absolute inset-0 pointer-events-none flex items-center justify-between px-3 text-[11px] font-mono font-medium text-orange-200/90">
        <span className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${activeCount > 0 ? 'bg-orange-400 shadow-[0_0_8px_#fb923c] animate-pulse' : 'bg-orange-900/60'}`} />
          <span className="font-bold tracking-tight">{activeCount > 0 ? `LIVE // ${activeCount} ÁUDIO(S)` : 'SPECTRUM IDLE'}</span>
        </span>
        <span className="font-mono text-[10px] text-orange-400/80 hidden sm:inline tracking-wider">
          48 kHz • DSP 32-BIT
        </span>
      </div>
    </div>
  );
};
