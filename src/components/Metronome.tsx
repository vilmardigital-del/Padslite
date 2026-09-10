import React, { useState, useEffect, useRef } from 'react';
import { audioEngine } from '../services/audioEngine';
import { Play, Square, Minus, Plus } from 'lucide-react';

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
    <div id="metronome-bar" className="w-full flex items-center justify-between sm:justify-end gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs shadow-xs">
      <div className="flex items-center gap-1.5">
        <button
          onClick={toggleMetronome}
          className={`h-8 px-2.5 rounded-lg flex items-center justify-center gap-1 font-bold text-xs transition-all active:scale-95 cursor-pointer ${
            isRunning
              ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/30 animate-pulse'
              : 'bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700'
          }`}
          title={isRunning ? 'Parar Metrônomo' : 'Iniciar Metrônomo'}
        >
          {isRunning ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
          <span>{isRunning ? 'Parar' : 'Click'}</span>
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => handleBpmChange(bpm - 1)}
          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-90 text-slate-300 flex items-center justify-center font-bold cursor-pointer"
          title="Diminuir BPM"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="w-10 text-center font-mono font-bold text-sm text-amber-300">
          {bpm}
        </span>
        <button
          onClick={() => handleBpmChange(bpm + 1)}
          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-90 text-slate-300 flex items-center justify-center font-bold cursor-pointer"
          title="Aumentar BPM"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <button
        onClick={handleTap}
        className="h-8 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold tracking-wider text-[11px] active:scale-90 transition-transform cursor-pointer"
        title="Toque no ritmo para definir o tempo"
      >
        TAP
      </button>

      {/* 4 Beat visual indicator */}
      <div className="flex items-center gap-1 pl-0.5">
        {[0, 1, 2, 3].map((b) => (
          <span
            key={b}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-100 ${
              isRunning && currentBeat === b
                ? b === 0 ? 'bg-amber-400 scale-125' : 'bg-sky-400 scale-125'
                : 'bg-slate-700/80'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
