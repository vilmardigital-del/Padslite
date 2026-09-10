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
      bgGrad.addColorStop(0, 'rgba(15, 23, 42, 0.6)');
      bgGrad.addColorStop(1, 'rgba(2, 6, 23, 0.8)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 1.8;
      let x = 0;

      // Draw frequency spectrum bars
      for (let i = 0; i < bufferLength; i++) {
        const val = dataArray[i];
        const percent = val / 255;
        const barHeight = Math.max(3, percent * height * 0.75);

        // Color gradient based on frequency/intensity
        const r = Math.round(59 + percent * 180);
        const g = Math.round(130 + percent * 80);
        const b = Math.round(246 - percent * 60);

        ctx.fillStyle = activeCount > 0 ? `rgba(${r}, ${g}, ${b}, ${0.4 + percent * 0.6})` : 'rgba(100, 116, 139, 0.2)';
        ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);

        // Top glow pip
        if (activeCount > 0 && barHeight > 6) {
          ctx.fillStyle = `rgb(${r}, ${g}, 255)`;
          ctx.fillRect(x, height - barHeight - 2, barWidth - 1, 2);
        }

        x += barWidth;
      }

      // Draw smooth wave overlay
      ctx.beginPath();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = activeCount > 0 ? 'rgba(56, 189, 248, 0.65)' : 'rgba(71, 85, 105, 0.3)';
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
    <div id="audio-visualizer-container" className="relative w-full h-10 sm:h-11 rounded-lg overflow-hidden border border-slate-700/50 shadow-inner bg-slate-900/60">
      <canvas
        ref={canvasRef}
        width={800}
        height={44}
        className="w-full h-full block"
      />
      <div className="absolute inset-0 pointer-events-none flex items-center justify-between px-3 text-[11px] font-medium text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${activeCount > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
          {activeCount > 0 ? `${activeCount} áudio(s) em reprodução` : 'Pronto'}
        </span>
        <span className="font-mono text-[10px] text-slate-500 hidden sm:inline">
          Nuvem Pública • 44.1 kHz
        </span>
      </div>
    </div>
  );
};
