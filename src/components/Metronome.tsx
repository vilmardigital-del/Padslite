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
    <div id="metronome-bar" className="w-full flex items-center justify-between sm:justify-end gap-2 bg-[#2d0f01]/90 backdrop-blur-xl border border-orange-500/40 rounded-2xl px-3 py-2 text-xs shadow-[0_4px_20px_rgba(234,88,12,0.2)]">
      <div className="flex items-center gap-1.5">
        <button
          onClick={toggleMetronome}
          className={`h-8 px-3 rounded-xl flex items-center justify-center gap-1.5 font-mono font-bold text-xs transition-all active:scale-95 cursor-pointer ${
            isRunning
              ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black shadow-[0_0_15px_rgba(249,115,22,0.6)] animate-pulse'
              : 'bg-[#401502] text-orange-200 hover:text-white hover:bg-[#521c03] border border-orange-500/30'
          }`}
          title={isRunning ? 'Parar Metrônomo' : 'Iniciar Metrônomo'}
        >
          {isRunning ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5 text-orange-400" />}
          <span>{isRunning ? 'STOP' : 'CLICK'}</span>
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => handleBpmChange(bpm - 1)}
          className="w-8 h-8 rounded-xl bg-[#3f1602] hover:bg-[#541e03] active:scale-90 text-orange-300 flex items-center justify-center font-bold cursor-pointer border border-orange-500/30 transition-colors"
          title="Diminuir BPM"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <div className="px-2 py-0.5 rounded-lg bg-[#190600] border border-orange-500/40">
          <span className="w-12 block text-center font-mono font-extrabold text-sm text-orange-300 tracking-wider">
            {bpm} <span className="text-[9px] font-normal text-orange-400/70">BPM</span>
          </span>
        </div>
        <button
          onClick={() => handleBpmChange(bpm + 1)}
          className="w-8 h-8 rounded-xl bg-[#3f1602] hover:bg-[#541e03] active:scale-90 text-orange-300 flex items-center justify-center font-bold cursor-pointer border border-orange-500/30 transition-colors"
          title="Aumentar BPM"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <button
        onClick={handleTap}
        className="h-8 px-2.5 rounded-xl bg-[#3f1602] hover:bg-[#521c03] text-orange-200 border border-orange-500/30 font-mono font-bold tracking-wider text-[11px] active:scale-90 transition-transform cursor-pointer"
        title="Toque no ritmo para definir o tempo"
      >
        TAP
      </button>

      {/* 4 Beat visual indicator with futuristic LED pulse */}
      <div className="flex items-center gap-1.5 pl-1">
        {[0, 1, 2, 3].map((b) => (
          <span
            key={b}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-100 ${
              isRunning && currentBeat === b
                ? b === 0
                  ? 'bg-amber-300 scale-135 shadow-[0_0_10px_#fde047]'
                  : 'bg-orange-400 scale-125 shadow-[0_0_10px_#fb923c]'
                : 'bg-orange-950/80 border border-orange-800/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
