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
      className="fixed inset-0 z-[100] text-orange-50 flex flex-col select-none overflow-hidden"
      style={{
        background: 'radial-gradient(circle at 15% 15%, rgba(255, 140, 0, 0.45) 0%, transparent 50%), radial-gradient(circle at 85% 85%, rgba(249, 115, 22, 0.40) 0%, transparent 50%), linear-gradient(135deg, #2e0d00 0%, #4f1800 30%, #752600 60%, #250900 100%)'
      }}
    >
      {/* Ultra-Minimal Stage HUD (Discrete top strip - NO standard header or banner) */}
      <div className="h-11 sm:h-12 px-3 sm:px-6 bg-[#1f0900]/95 border-b border-orange-500/40 flex items-center justify-between gap-2 shrink-0 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
        {/* Left: Setlist Badge & Exit */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            id="btn-exit-presentation"
            type="button"
            onClick={onExit}
            className="h-8 px-2.5 rounded-xl bg-[#341101] hover:bg-[#451702] text-orange-200 hover:text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95 border border-orange-500/40 shadow-xs"
            title="Sair da tela de apresentação (Esc)"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">VOLTAR</span>
          </button>

          <div className="flex items-center gap-1.5 pl-1 min-w-0 font-mono">
            <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse shrink-0 shadow-[0_0_8px_#fb923c]" />
            <span className="text-xs font-bold text-orange-200 uppercase tracking-wider truncate">
              PALCO AO VIVO ({playlistPads.length})
            </span>
          </div>
        </div>

        {/* Center: Live Status Indicator & Master STOP */}
        <div className="flex items-center gap-2">
          {activePad ? (
            <div className="flex items-center gap-2 bg-gradient-to-r from-orange-500/25 to-rose-500/25 border border-orange-400/60 px-3.5 py-1 rounded-full text-xs animate-pulse max-w-[200px] sm:max-w-xs truncate shadow-[0_0_12px_rgba(249,115,22,0.4)]">
              <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0 shadow-[0_0_6px_#fb923c]" />
              <span className="font-mono font-bold text-orange-100 truncate">
                {activePad.name}
              </span>
              {activePad.musicalKey && (
                <span className="font-mono font-black text-amber-300 shrink-0">
                  [{activePad.musicalKey}]
                </span>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-orange-300/70 hidden sm:inline font-mono">
              SISTEMA PRONTO • ESC PARA SAIR
            </span>
          )}

          {activeCount > 0 && (
            <button
              id="btn-presentation-stop-all"
              type="button"
              onClick={onMasterFadeOut}
              className="h-8 px-3.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-mono font-black text-xs flex items-center gap-1.5 shadow-[0_0_20px_rgba(239,68,68,0.7)] active:scale-95 transition-all cursor-pointer border border-red-400/40 animate-pulse"
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
              className={`h-8 px-2.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer ${
                showVolumePopup
                  ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 border-amber-300 font-black shadow-[0_0_10px_rgba(249,115,22,0.4)]'
                  : 'bg-[#2a0e01] text-orange-200 border-orange-500/40 hover:border-orange-400 hover:text-white'
              }`}
              title="Ajustar Volume Master"
            >
              <Volume2 className="w-3.5 h-3.5 shrink-0 text-orange-400" />
              <span className="font-mono text-[11px]">{Math.round(masterVolume * 100)}%</span>
            </button>

            {showVolumePopup && (
              <div className="absolute right-0 top-full mt-2 w-48 p-3 bg-[#240b01] border border-orange-500/50 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-50 space-y-2 backdrop-blur-xl">
                <div className="flex justify-between text-xs text-orange-200 font-mono font-medium">
                  <span>Volume Master</span>
                  <span className="font-mono font-bold text-amber-400">{Math.round(masterVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={masterVolume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full accent-orange-500 h-2 bg-[#120400] rounded-lg cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Manage Playlist */}
          <button
            type="button"
            onClick={onOpenPlaylistManager}
            className="h-8 px-2.5 rounded-xl bg-[#2a0e01] border border-orange-500/40 hover:border-orange-400 text-orange-200 hover:text-white text-xs font-mono font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
            title="Editar lista de áudios escalados"
          >
            <ListMusic className="w-3.5 h-3.5 text-orange-400" />
            <span className="hidden sm:inline">ESCALAR</span>
          </button>

          {/* Fullscreen toggle */}
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="h-8 w-8 rounded-xl bg-[#2a0e01] border border-orange-500/40 text-orange-300 hover:text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer"
            title={isFullscreen ? 'Sair do modo Tela Cheia' : 'Ativar Tela Cheia Total'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Close / Exit Button */}
          <button
            type="button"
            onClick={onExit}
            className="h-8 w-8 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/50 flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title="Sair da tela cheia de apresentação (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Presentation Stage - 100% Fullscreen Audio Grid (NO footer, ONLY the audios) */}
      <div className="flex-1 p-2.5 sm:p-4 md:p-6 overflow-y-auto flex flex-col justify-center">
        {playlistPads.length === 0 ? (
          <div className="max-w-md mx-auto text-center p-8 bg-[#250b01]/90 border border-orange-500/40 rounded-3xl space-y-4 backdrop-blur-xl shadow-[0_10px_35px_rgba(0,0,0,0.6)]">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center mx-auto border border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.3)]">
              <ListMusic className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-orange-100 font-mono">Nenhum áudio escalado</h2>
              <p className="text-xs text-orange-300/70 mt-1">
                Selecione os áudios que você irá usar no palco para exibi-los nesta tela única de alta performance.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenPlaylistManager}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-mono font-black text-xs sm:text-sm shadow-[0_0_20px_rgba(249,115,22,0.4)] border border-amber-300 transition-all cursor-pointer active:scale-95"
            >
              ESCALAR ÁUDIOS DO PALCO
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
                  className={`group relative rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer touch-manipulation backdrop-blur-xl ${
                    isPlaying
                      ? 'border-orange-400 bg-gradient-to-b from-[#4d1900] to-[#2b0c00] shadow-[0_0_35px_rgba(249,115,22,0.5)] ring-2 ring-orange-400/90 scale-[1.01]'
                      : 'border-orange-500/35 bg-[#250b01]/95 hover:border-orange-400/80 hover:bg-[#320f01] active:scale-[0.98] shadow-lg'
                  }`}
                  onClick={() => onTogglePlay(pad)}
                >
                  {/* Top Bar: Sequence Number, Key, BPM, Loop */}
                  <div className="p-2.5 sm:p-3 flex items-center justify-between gap-1.5">
                    {/* Index & Key */}
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-[#140500] border border-orange-500/40 text-[11px] font-mono font-black text-orange-300 flex items-center justify-center shadow-inner">
                        {String(idx + 1).padStart(2, '0')}
                      </span>

                      {pad.musicalKey ? (
                        <span
                          className="px-2.5 py-0.5 text-xs sm:text-sm font-black font-mono rounded-lg border tracking-wider shadow-sm"
                          style={{
                            backgroundColor: `${pad.color || '#ea580c'}30`,
                            borderColor: `${pad.color || '#ea580c'}70`,
                            color: pad.color || '#fed7aa'
                          }}
                        >
                          {pad.musicalKey}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] font-mono font-semibold text-orange-300/80 bg-[#140500] border border-orange-500/30 px-2 py-0.5 rounded-md">
                          {getCategoryIcon(pad.category)}
                          <span className="capitalize">{pad.category}</span>
                        </span>
                      )}

                      {pad.bpm && (
                        <span className="px-1.5 py-0.5 text-[10px] sm:text-[11px] font-mono font-semibold rounded-md bg-[#140500] text-orange-200 border border-orange-500/30">
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
                      className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        pad.isLoop
                          ? 'bg-orange-500/30 text-orange-200 border border-orange-400/70 shadow-[0_0_8px_rgba(249,115,22,0.3)]'
                          : 'bg-[#140500] text-orange-400/60 border border-orange-500/30 hover:text-orange-200'
                      }`}
                      title={pad.isLoop ? 'Modo Repetição Contínua (Loop)' : 'Toque Único'}
                    >
                      <Repeat className="w-3 h-3" />
                      <span className="hidden sm:inline">{pad.isLoop ? 'LOOP' : '1X'}</span>
                    </button>
                  </div>

                  {/* Center Tactile Trigger Body */}
                  <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-4 text-center">
                    {/* Big Studio Drum Pad Visualizer Button */}
                    <div
                      className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl flex items-center justify-center transition-all duration-200 ${
                        isPlaying
                          ? 'scale-110 shadow-[0_0_40px_rgba(249,115,22,0.8)] ring-4 ring-orange-400/90'
                          : 'shadow-lg border border-orange-500/40 group-hover:border-orange-400 group-hover:shadow-[0_0_15px_rgba(249,115,22,0.3)]'
                      }`}
                      style={{
                        backgroundColor: isPlaying ? '#ea580c' : '#331001',
                        color: isPlaying ? '#ffffff' : pad.color || '#fed7aa'
                      }}
                    >
                      {isLoading ? (
                        <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 animate-spin text-orange-300" />
                      ) : isPlaying ? (
                        <Square className="w-8 h-8 sm:w-10 sm:h-10 fill-current animate-pulse" />
                      ) : (
                        <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-current ml-1" />
                      )}
                    </div>

                    {/* Audio Title */}
                    <h3 className="mt-3 font-mono font-black text-sm sm:text-base md:text-lg text-orange-100 line-clamp-2 max-w-[95%] tracking-tight">
                      {pad.name}
                    </h3>

                    {/* Active State Pill */}
                    <div className="mt-1.5 flex items-center justify-center gap-1.5 text-xs font-mono">
                      {isLoading ? (
                        <span className="text-orange-400 font-semibold flex items-center gap-1">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> CARREGANDO...
                        </span>
                      ) : isPlaying ? (
                        <span className="text-orange-400 font-black flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-ping inline-block shadow-[0_0_8px_#fb923c]" />
                          AO VIVO NO AR
                        </span>
                      ) : (
                        <span className="text-orange-400/60 font-medium text-[11px] sm:text-xs">
                          Toque para disparar
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Strip: Category and Key shortcut hint */}
                  <div className="px-3 py-1.5 bg-[#140500]/90 border-t border-orange-500/35 flex items-center justify-between text-[11px] text-orange-300/80 font-mono">
                    <span className="flex items-center gap-1">
                      {getCategoryIcon(pad.category)}
                      <span className="capitalize">{pad.category}</span>
                    </span>
                    <span className="text-orange-400/70 font-bold">Tecla [{idx + 1}]</span>
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
