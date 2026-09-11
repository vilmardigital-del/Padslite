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
    <div id="metronome-bar" className="w-full flex items-center justify-between sm:justify-end gap-2 bg-[#0a1838]/90 backdrop-blur-xl border border-blue-500/40 rounded-2xl px-3 py-2 text-xs shadow-[0_4px_20px_rgba(37,99,235,0.25)]">
      <div className="flex items-center gap-1.5">
        <button
          onClick={toggleMetronome}
          className={`h-8 px-3 rounded-xl flex items-center justify-center gap-1.5 font-mono font-bold text-xs transition-all active:scale-95 cursor-pointer ${
            isRunning
              ? 'bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400 text-white font-black shadow-[0_0_15px_rgba(59,130,246,0.6)] animate-pulse border border-white'
              : 'bg-[#0e2452] text-blue-100 hover:text-white hover:bg-[#153472] border border-blue-500/35'
          }`}
          title={isRunning ? 'Parar Metrônomo' : 'Iniciar Metrônomo'}
        >
          {isRunning ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5 text-blue-300" />}
          <span>{isRunning ? 'STOP' : 'CLICK'}</span>
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => handleBpmChange(bpm - 1)}
          className="w-8 h-8 rounded-xl bg-[#0e2452] hover:bg-[#153472] active:scale-90 text-blue-200 flex items-center justify-center font-bold cursor-pointer border border-blue-500/35 transition-colors"
          title="Diminuir BPM"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <div className="px-2 py-0.5 rounded-lg bg-[#060f26] border border-blue-500/40">
          <span className="w-12 block text-center font-mono font-extrabold text-sm text-white tracking-wider">
            {bpm} <span className="text-[9px] font-normal text-blue-300/80">BPM</span>
          </span>
        </div>
        <button
          onClick={() => handleBpmChange(bpm + 1)}
          className="w-8 h-8 rounded-xl bg-[#0e2452] hover:bg-[#153472] active:scale-90 text-blue-200 flex items-center justify-center font-bold cursor-pointer border border-blue-500/35 transition-colors"
          title="Aumentar BPM"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <button
        onClick={handleTap}
        className="h-8 px-2.5 rounded-xl bg-[#0e2452] hover:bg-[#153472] text-blue-100 border border-blue-500/35 font-mono font-bold tracking-wider text-[11px] active:scale-90 transition-transform cursor-pointer"
        title="Toque no ritmo para definir o tempo"
      >
        TAP
      </button>

      {/* 4 Beat visual indicator with blue and white LED pulse */}
      <div className="flex items-center gap-1.5 pl-1">
        {[0, 1, 2, 3].map((b) => (
          <span
            key={b}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-100 ${
              isRunning && currentBeat === b
                ? b === 0
                  ? 'bg-white scale-135 shadow-[0_0_10px_#ffffff]'
                  : 'bg-blue-400 scale-125 shadow-[0_0_10px_#60a5fa]'
                : 'bg-blue-950/80 border border-blue-800/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
