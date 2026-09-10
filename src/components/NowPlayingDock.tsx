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
      <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-2.5 sm:p-3 shadow-2xl shadow-black/80 flex items-center justify-between gap-2 sm:gap-3 ring-1 ring-white/10 animate-in fade-in slide-in-from-bottom-3 duration-200">
        {/* Active Track Info */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1 pl-1">
          {/* Tone Badge or Icon */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-inner"
            style={{
              backgroundColor: activePad?.color ? `${activePad.color}25` : 'rgba(6, 182, 212, 0.15)',
              border: `1.5px solid ${activePad?.color || '#06b6d4'}`,
              color: activePad?.color || '#38bdf8'
            }}
          >
            {activePad?.keyNote ? (
              <span className="font-mono text-xs">{activePad.keyNote}</span>
            ) : (
              <Radio className="w-4 h-4 animate-pulse" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block shrink-0" />
              <p className="font-bold text-xs sm:text-sm text-white truncate">
                {activePad?.name || 'Carregando áudio...'}
              </p>
            </div>
            <p className="text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
              <span>{isLoading ? 'Decodificando original...' : 'Em reprodução contínua'}</span>
              {activePad?.bpm && (
                <>
                  <span>•</span>
                  <span>{activePad.bpm} BPM</span>
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
              className={`p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 ${
                isLoop
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
              }`}
              title={isLoop ? 'Loop Ativo' : 'Disparo Único'}
            >
              <Repeat className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">Loop</span>
            </button>
          )}

          {/* Big Thumb-Friendly STOP Button */}
          <button
            id="dock-stop-button"
            onClick={onStop}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-rose-600/40 active:scale-95 transition-all cursor-pointer ring-1 ring-white/20"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Square className="w-4 h-4 fill-current" />
            )}
            <span className="tracking-wide">PARAR</span>
          </button>
        </div>
      </div>
    </div>
  );
};
