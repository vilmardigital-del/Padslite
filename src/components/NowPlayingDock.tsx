import React from 'react';
import { Square, Volume2, VolumeX, Repeat, Radio, Loader2 } from 'lucide-react';
import { PadItem } from '../types';

interface NowPlayingDockProps {
  activePad: PadItem | null;
  isLoading: boolean;
  onStop: () => void;
  onToggleLoop?: () => void;
  isLoop?: boolean;
}

export const NowPlayingDock: React.FC<NowPlayingDockProps> = ({
  activePad,
  isLoading,
  onStop,
  onToggleLoop,
  isLoop,
}) => {
  if (!activePad && !isLoading) return null;

  return (
    <div className="fixed bottom-3 inset-x-3 sm:inset-x-6 z-40 max-w-2xl mx-auto pointer-events-none">
      <div className="pointer-events-auto bg-[#0a1838]/95 backdrop-blur-2xl border border-blue-500/50 rounded-2xl p-2.5 sm:p-3 shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex items-center justify-between gap-2 sm:gap-3 ring-1 ring-blue-500/30 animate-in fade-in slide-in-from-bottom-3 duration-200">
        {/* Active Track Info */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1 pl-1">
          {/* Tone Badge or Icon */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-[0_0_10px_rgba(59,130,246,0.3)] font-mono"
            style={{
              backgroundColor: activePad?.color ? `${activePad.color}25` : 'rgba(37, 99, 235, 0.2)',
              border: `1.5px solid ${activePad?.color || '#3b82f6'}`,
              color: activePad?.color || '#bfdbfe'
            }}
          >
            {activePad?.musicalKey ? (
              <span className="font-mono font-black text-xs">{activePad.musicalKey}</span>
            ) : (
              <Radio className="w-4 h-4 animate-pulse text-blue-300" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping inline-block shrink-0 shadow-[0_0_8px_#60a5fa]" />
              <p className="font-bold text-xs sm:text-sm text-white truncate font-mono">
                {activePad?.name || 'Carregando áudio...'}
              </p>
            </div>
            <p className="text-[11px] font-mono text-blue-200/80 truncate flex items-center gap-1 mt-0.5">
              <span>{isLoading ? 'DECODIFICANDO DSP...' : 'REPRODUÇÃO AO VIVO'}</span>
              {activePad?.bpm && (
                <>
                  <span>•</span>
                  <span className="text-white font-bold">{activePad.bpm} BPM</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Quick Actions & Stop Button */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onToggleLoop && (
            <button
              onClick={onToggleLoop}
              className={`p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer ${
                isLoop
                  ? 'bg-blue-500/30 text-white border border-blue-400/60 shadow-[0_0_8px_rgba(59,130,246,0.3)]'
                  : 'bg-[#0e2452]/80 text-blue-200/70 hover:text-white border border-blue-500/30'
              }`}
              title={isLoop ? 'Loop Ativo' : 'Disparo Único'}
            >
              <Repeat className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">LOOP</span>
            </button>
          )}

          {/* Big Thumb-Friendly STOP Button (Vivid Red Beacon) */}
          <button
            id="dock-stop-button"
            onClick={onStop}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-500 text-white font-mono font-black text-xs sm:text-sm flex items-center gap-2 shadow-[0_0_20px_rgba(239,68,68,0.7)] active:scale-95 transition-all cursor-pointer border border-red-400/40"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Square className="w-4 h-4 fill-current" />
            )}
            <span className="tracking-wider">PARAR</span>
          </button>
        </div>
      </div>
    </div>
  );
};
