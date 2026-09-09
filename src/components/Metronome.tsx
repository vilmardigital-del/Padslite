import React, { useState, useEffect, useRef } from 'react';
import { audioEngine } from '../services/audioEngine';
import { Play, Square, Minus, Plus, Volume2 } from 'lucide-react';

export const Metronome: React.FC = () => {
  const [bpm, setBpm] = useState(100);
  const [isRunning, setIsRunning] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);

  // Tap tempo state
  const tapTimesRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      audioEngine.stopMetronome();
    };
  }, []);

  const toggleMetronome = () => {
    if (isRunning) {
      audioEngine.stopMetronome();
      setIsRunning(false);
      setCurrentBeat(0);
    } else {
      audioEngine.startMetronome(bpm, (beat) => {
        setCurrentBeat(beat);
      });
      setIsRunning(true);
    }
  };

  const handleBpmChange = (newBpm: number) => {
    const clamped = Math.max(30, Math.min(260, newBpm));
    setBpm(clamped);
    if (isRunning) {
      audioEngine.updateMetronomeBpm(clamped);
    }
  };

  const handleTap = () => {
    const now = performance.now();
    const taps = tapTimesRef.current;
    // Clear if last tap was more than 2.5 seconds ago
    if (taps.length > 0 && now - taps[taps.length - 1] > 2500) {
      taps.length = 0;
    }
    taps.push(now);
    if (taps.length > 4) taps.shift();

    if (taps.length >= 2) {
      let totalDiff = 0;
      for (let i = 1; i < taps.length; i++) {
        totalDiff += taps[i] - taps[i - 1];
      }
      const avgDiff = totalDiff / (taps.length - 1);
      const calculatedBpm = Math.round(60000 / avgDiff);
      handleBpmChange(calculatedBpm);
    }
  };

  return (
    <div id="metronome-bar" className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5 text-xs shadow-sm">
      <div className="flex items-center gap-1">
        <button
          onClick={toggleMetronome}
          className={`p-1.5 rounded-lg flex items-center justify-center transition-colors ${
            isRunning
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30 animate-pulse'
              : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
          }`}
          title={isRunning ? 'Parar Metrônomo' : 'Iniciar Metrônomo'}
        >
          {isRunning ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
        </button>
        <span className="font-semibold text-slate-300 pl-1">BPM:</span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => handleBpmChange(bpm - 1)}
          className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="w-10 text-center font-mono font-bold text-sm text-amber-300">
          {bpm}
        </span>
        <button
          onClick={() => handleBpmChange(bpm + 1)}
          className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      <input
        type="range"
        min="40"
        max="220"
        value={bpm}
        onChange={(e) => handleBpmChange(parseInt(e.target.value, 10))}
        className="w-20 accent-amber-400 h-1 bg-slate-800 rounded cursor-pointer hidden sm:block"
      />

      <button
        onClick={handleTap}
        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold tracking-wide text-[11px] active:scale-95 transition-transform"
      >
        TAP
      </button>

      {/* 4 Beat visual indicator */}
      <div className="flex items-center gap-1 pl-1">
        {[0, 1, 2, 3].map((b) => (
          <span
            key={b}
            className={`w-2 h-2 rounded-full transition-all duration-100 ${
              isRunning && currentBeat === b
                ? b === 0 ? 'bg-amber-400 scale-125' : 'bg-sky-400 scale-125'
                : 'bg-slate-700'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
