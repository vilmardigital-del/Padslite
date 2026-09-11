import React, { useState, useEffect } from 'react';
import {
  Square,
  Play,
  X,
  Volume2,
  Repeat,
  Sparkles,
  Clock,
  Music,
  Maximize2,
  Minimize2,
  Sliders,
  ListMusic,
  Loader2,
  ArrowLeft
} from 'lucide-react';
import { PadItem } from '../types';
import { audioEngine } from '../services/audioEngine';

interface PresentationViewProps {
  playlistPads: PadItem[];
  activePadIds: Set<string>;
  loadingPadIds: Set<string>;
  onTogglePlay: (pad: PadItem) => void;
  onMasterFadeOut: () => void;
  onExit: () => void;
  onOpenPlaylistManager: () => void;
  onTogglePadLoop: (padId: string) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export const PresentationView: React.FC<PresentationViewProps> = ({
  playlistPads,
  activePadIds,
  loadingPadIds,
  onTogglePlay,
  onMasterFadeOut,
  onExit,
  onOpenPlaylistManager,
  onTogglePadLoop,
  isFullscreen,
  onToggleFullscreen
}) => {
  const [masterVolume, setMasterVolume] = useState(0.85);
  const [showVolumePopup, setShowVolumePopup] = useState(false);

  // Identify which pad is currently playing in the playlist
  const activePad = playlistPads.find(p => activePadIds.has(p.id));
  const activeCount = activePadIds.size;

  const handleVolumeChange = (val: number) => {
    setMasterVolume(val);
    audioEngine.setMasterVolume(val);
  };

  // Keyboard shortcut listener for live stage: Esc = exit, Space = stop, Numbers = trigger pad
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        onMasterFadeOut();
        return;
      }
      // Number keys 1-9 to trigger playlist items in sequence
      if (/^[1-9]$/.test(e.key)) {
        const index = parseInt(e.key, 10) - 1;
        if (playlistPads[index]) {
          e.preventDefault();
          onTogglePlay(playlistPads[index]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playlistPads, onExit, onMasterFadeOut, onTogglePlay]);

  // Determine grid template based on number of scaled audios
  const getGridClasses = (count: number) => {
    if (count === 1) return 'grid-cols-1 max-w-2xl mx-auto';
    if (count === 2) return 'grid-cols-1 sm:grid-cols-2';
    if (count === 3) return 'grid-cols-1 sm:grid-cols-3';
    if (count === 4) return 'grid-cols-2 sm:grid-cols-2 md:grid-cols-4';
    if (count <= 6) return 'grid-cols-2 sm:grid-cols-3';
    if (count <= 8) return 'grid-cols-2 sm:grid-cols-4';
    return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';
  };

  const getCategoryIcon = (category: PadItem['category']) => {
    switch (category) {
      case 'worship':
        return <Sparkles className="w-3.5 h-3.5 text-amber-400" />;
      case 'ritmo':
        return <Clock className="w-3.5 h-3.5 text-sky-400" />;
      case 'percussao':
        return <Music className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Music className="w-3.5 h-3.5 text-cyan-400" />;
    }
  };

  return (
    <div
      id="presentation-fullscreen-root"
      className="fixed inset-0 z-[100] bg-[#050811] text-white flex flex-col select-none overflow-hidden"
    >
      {/* Ultra-Minimal Stage HUD (Discrete top strip - NO standard header or banner) */}
      <div className="h-11 sm:h-12 px-3 sm:px-6 bg-[#090e1c]/90 border-b border-slate-800/80 flex items-center justify-between gap-2 shrink-0 backdrop-blur-md">
        {/* Left: Setlist Badge & Exit */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            id="btn-exit-presentation"
            type="button"
            onClick={onExit}
            className="h-8 px-2.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95 border border-slate-700/60"
            title="Sair da tela de apresentação (Esc)"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Voltar</span>
          </button>

          <div className="flex items-center gap-1.5 pl-1 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider truncate">
              Apresentação ({playlistPads.length})
            </span>
          </div>
        </div>

        {/* Center: Live Status Indicator & Master STOP */}
        <div className="flex items-center gap-2">
          {activePad ? (
            <div className="flex items-center gap-2 bg-rose-500/15 border border-rose-500/40 px-3 py-1 rounded-full text-xs animate-pulse max-w-[200px] sm:max-w-xs truncate">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span className="font-semibold text-rose-200 truncate">
                {activePad.name}
              </span>
              {activePad.musicalKey && (
                <span className="font-mono font-bold text-rose-300 shrink-0">
                  [{activePad.musicalKey}]
                </span>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-slate-400 hidden sm:inline font-mono">
              Pronto para tocar
            </span>
          )}

          {activeCount > 0 && (
            <button
              id="btn-presentation-stop-all"
              type="button"
              onClick={onMasterFadeOut}
              className="h-8 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1.5 shadow-lg shadow-rose-600/40 active:scale-95 transition-all cursor-pointer animate-pulse"
              title="Parar áudio imediatamente (Espaço)"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>PARAR</span>
            </button>
          )}
        </div>

        {/* Right: Quick Stage Utilities */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Volume master quick adjust */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowVolumePopup(!showVolumePopup)}
              className={`h-8 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 ${
                showVolumePopup
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                  : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:text-white'
              }`}
              title="Ajustar Volume Master"
            >
              <Volume2 className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono text-[11px]">{Math.round(masterVolume * 100)}%</span>
            </button>

            {showVolumePopup && (
              <div className="absolute right-0 top-full mt-2 w-48 p-3 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 space-y-2">
                <div className="flex justify-between text-xs text-slate-300 font-medium">
                  <span>Volume Master</span>
                  <span className="font-mono text-cyan-400">{Math.round(masterVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={masterVolume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Manage Playlist */}
          <button
            type="button"
            onClick={onOpenPlaylistManager}
            className="h-8 px-2.5 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
            title="Editar lista de áudios escalados"
          >
            <ListMusic className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Escalar</span>
          </button>

          {/* Fullscreen toggle */}
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="h-8 w-8 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer"
            title={isFullscreen ? 'Sair do modo Tela Cheia' : 'Ativar Tela Cheia Total'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Close / Exit Button */}
          <button
            type="button"
            onClick={onExit}
            className="h-8 w-8 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title="Sair da tela cheia de apresentação (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Presentation Stage - 100% Fullscreen Audio Grid (NO footer, ONLY the audios) */}
      <div className="flex-1 p-2 sm:p-4 md:p-5 overflow-y-auto flex flex-col justify-center">
        {playlistPads.length === 0 ? (
          <div className="max-w-md mx-auto text-center p-8 bg-slate-900/60 border border-slate-800 rounded-3xl space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
              <ListMusic className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Nenhum áudio escalado</h2>
              <p className="text-xs text-slate-400 mt-1">
                Selecione os áudios que você irá usar na sua apresentação para exibi-los nesta tela.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenPlaylistManager}
              className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-cyan-500/20 transition-all cursor-pointer active:scale-95"
            >
              Escalar Áudios da Apresentação
            </button>
          </div>
        ) : (
          <div
            className={`grid gap-2.5 sm:gap-3.5 md:gap-4.5 w-full h-full ${getGridClasses(
              playlistPads.length
            )}`}
          >
            {playlistPads.map((pad, idx) => {
              const isPlaying = activePadIds.has(pad.id);
              const isLoading = loadingPadIds.has(pad.id);

              return (
                <div
                  key={`presentation-${pad.id}`}
                  className={`group relative rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer touch-manipulation ${
                    isPlaying
                      ? 'border-rose-500 bg-gradient-to-b from-slate-900 to-[#190d16] shadow-2xl shadow-rose-500/30 ring-2 ring-rose-500/80 scale-[1.01]'
                      : 'border-slate-800 bg-[#0c1220]/95 hover:border-slate-700 hover:bg-[#11192e] active:scale-[0.98]'
                  }`}
                  onClick={() => onTogglePlay(pad)}
                >
                  {/* Top Bar: Sequence Number, Key, BPM, Loop */}
                  <div className="p-2.5 sm:p-3 flex items-center justify-between gap-1.5">
                    {/* Index & Key */}
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-slate-800/80 border border-slate-700 text-[11px] font-mono font-bold text-slate-300 flex items-center justify-center">
                        {String(idx + 1).padStart(2, '0')}
                      </span>

                      {pad.musicalKey ? (
                        <span
                          className="px-2.5 py-0.5 text-xs sm:text-sm font-black font-mono rounded-lg border tracking-wider shadow-sm"
                          style={{
                            backgroundColor: `${pad.color || '#38bdf8'}22`,
                            borderColor: `${pad.color || '#38bdf8'}60`,
                            color: pad.color || '#38bdf8'
                          }}
                        >
                          {pad.musicalKey}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md">
                          {getCategoryIcon(pad.category)}
                          <span className="capitalize">{pad.category}</span>
                        </span>
                      )}

                      {pad.bpm && (
                        <span className="px-1.5 py-0.5 text-[10px] sm:text-[11px] font-mono font-semibold rounded-md bg-slate-800/90 text-slate-300 border border-slate-700/60">
                          {pad.bpm} BPM
                        </span>
                      )}
                    </div>

                    {/* Loop Toggle Badge */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePadLoop(pad.id);
                      }}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        pad.isLoop
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'bg-slate-800/70 text-slate-400 border border-slate-700/50 hover:text-slate-200'
                      }`}
                      title={pad.isLoop ? 'Modo Repetição Contínua (Loop)' : 'Toque Único'}
                    >
                      <Repeat className="w-3 h-3" />
                      <span className="hidden sm:inline">{pad.isLoop ? 'Loop' : '1x'}</span>
                    </button>
                  </div>

                  {/* Center Tactile Trigger Body */}
                  <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-4 text-center">
                    {/* Big Studio Drum Pad Visualizer Button */}
                    <div
                      className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl flex items-center justify-center transition-all duration-200 ${
                        isPlaying
                          ? 'scale-110 shadow-2xl ring-4 ring-rose-400/90'
                          : 'shadow-lg border border-slate-700/70 group-hover:border-slate-500'
                      }`}
                      style={{
                        backgroundColor: isPlaying ? '#e11d48' : '#141c2e',
                        boxShadow: isPlaying
                          ? '0 0 35px rgba(225, 29, 72, 0.75)'
                          : 'inset 0 1px 0 rgba(255,255,255,0.08)',
                        color: isPlaying ? '#ffffff' : pad.color || '#38bdf8'
                      }}
                    >
                      {isLoading ? (
                        <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 animate-spin text-cyan-300" />
                      ) : isPlaying ? (
                        <Square className="w-8 h-8 sm:w-10 sm:h-10 fill-current animate-pulse" />
                      ) : (
                        <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-current ml-1" />
                      )}
                    </div>

                    {/* Audio Title */}
                    <h3 className="mt-3 font-extrabold text-sm sm:text-base md:text-lg text-slate-100 line-clamp-2 max-w-[95%] tracking-tight">
                      {pad.name}
                    </h3>

                    {/* Active State Pill */}
                    <div className="mt-1.5 flex items-center justify-center gap-1.5 text-xs">
                      {isLoading ? (
                        <span className="text-cyan-400 font-semibold flex items-center gap-1">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...
                        </span>
                      ) : isPlaying ? (
                        <span className="text-rose-400 font-black flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping inline-block" />
                          EM EXECUÇÃO
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium text-[11px] sm:text-xs">
                          Toque para iniciar
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Strip: Category and Key shortcut hint */}
                  <div className="px-3 py-1.5 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      {getCategoryIcon(pad.category)}
                      <span className="capitalize">{pad.category}</span>
                    </span>
                    <span className="text-slate-500">Tecla [{idx + 1}]</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
