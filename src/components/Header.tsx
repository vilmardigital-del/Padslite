import React, { useState } from 'react';
import {
  Volume2,
  SlidersHorizontal,
  Cloud,
  UploadCloud,
  Square,
  Music2,
  Sliders,
  Maximize,
  Minimize,
  ListMusic
} from 'lucide-react';
import { audioEngine } from '../services/audioEngine';

interface HeaderProps {
  activeCount: number;
  onOpenUpload: () => void;
  onOpenCloudInfo: () => void;
  onMasterFadeOut: () => void;
  isFadingOut: boolean;
  totalPadsCount: number;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onOpenPlaylist?: () => void;
  playlistCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeCount,
  onOpenUpload,
  onOpenCloudInfo,
  onMasterFadeOut,
  isFadingOut,
  totalPadsCount,
  isFullscreen,
  onToggleFullscreen,
  onOpenPlaylist,
  playlistCount = 0,
}) => {
  const [masterVolume, setMasterVolume] = useState(0.85);
  const [masterFilter, setMasterFilter] = useState(20000);
  const [showVolumePopup, setShowVolumePopup] = useState(false);
  const [showFilterControl, setShowFilterControl] = useState(false);

  const handleVolumeChange = (val: number) => {
    setMasterVolume(val);
    audioEngine.setMasterVolume(val);
  };

  const handleFilterChange = (val: number) => {
    setMasterFilter(val);
    audioEngine.setMasterFilter(val);
  };

  return (
    <header className="w-full bg-[#1c0a01]/95 border-b border-amber-600/30 backdrop-blur-xl sticky top-0 z-30 transition-all shadow-md shadow-orange-950/20">
      <div className="max-w-4xl mx-auto px-3 sm:px-5 h-14 flex items-center justify-between gap-2">
        {/* Brand & Pad Count Indicator */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-400 flex items-center justify-center text-slate-950 font-black shadow-md shadow-orange-500/25 shrink-0">
            <Music2 className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <h1 className="font-bold text-amber-100 text-sm sm:text-base tracking-tight truncate">
              Pads Player
            </h1>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#2a1002] text-amber-300 border border-amber-750/60 shrink-0">
              {totalPadsCount}
            </span>
          </div>
        </div>

        {/* Master Controls for Touch Devices */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Master Volume Quick Touch */}
          <div className="relative">
            <button
              onClick={() => setShowVolumePopup(!showVolumePopup)}
              className={`h-9 px-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 ${
                showVolumePopup
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 border-amber-400 font-bold shadow-sm'
                  : 'bg-[#240e02]/90 text-amber-200 border-amber-800/60 hover:text-white hover:border-amber-600'
              }`}
              title="Volume Master"
            >
              <Volume2 className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono text-[11px]">{Math.round(masterVolume * 100)}%</span>
            </button>

            {showVolumePopup && (
              <div className="absolute right-0 top-full mt-2 w-48 p-3 bg-[#240e02] border border-amber-600/50 rounded-2xl shadow-2xl z-50 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex justify-between text-xs text-amber-200 font-medium">
                  <span>Volume Geral</span>
                  <span className="font-mono text-amber-400">{Math.round(masterVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={masterVolume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 h-2 bg-[#160800] rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-amber-400/80 pt-1">
                  <button onClick={() => handleVolumeChange(0.5)} className="hover:text-white">50%</button>
                  <button onClick={() => handleVolumeChange(0.85)} className="hover:text-white">85%</button>
                  <button onClick={() => handleVolumeChange(1.0)} className="hover:text-white">100%</button>
                </div>
              </div>
            )}
          </div>

          {/* Master Stop Button (Only visible if something is playing) */}
          {activeCount > 0 && (
            <button
              id="btn-fade-out-all"
              onClick={onMasterFadeOut}
              className="h-9 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-600/40 active:scale-95 transition-all cursor-pointer animate-pulse"
              title="Parar toda a execução imediatamente"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>PARAR</span>
            </button>
          )}

          {/* Presentation Playlist Button */}
          {onOpenPlaylist && (
            <button
              id="btn-open-playlist"
              onClick={onOpenPlaylist}
              className={`h-9 px-2.5 sm:px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                playlistCount > 0
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                  : 'bg-[#240e02]/90 hover:bg-[#2e1303] text-amber-300 border-amber-800/60 hover:border-amber-500/40'
              }`}
              title="Playlist de Apresentação (áudios escalados para o palco)"
            >
              <ListMusic className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Apresentação</span>
              {playlistCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-slate-950 text-amber-300">
                  {playlistCount}
                </span>
              )}
            </button>
          )}

          {/* Upload Button */}
          <button
            id="btn-open-upload"
            onClick={onOpenUpload}
            className="h-9 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-orange-500/25 active:scale-95 transition-all cursor-pointer"
            title="Adicionar novos áudios"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Adicionar</span>
          </button>

          {/* Fullscreen Toggle Button */}
          <button
            id="btn-toggle-fullscreen"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFullscreen();
            }}
            className={`h-9 px-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer select-none ${
              isFullscreen
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10'
                : 'bg-[#240e02]/90 text-amber-200 border-amber-800/60 hover:text-white hover:border-amber-600'
            }`}
            title={isFullscreen ? 'Sair da Tela Cheia' : 'Ativar Tela Cheia'}
          >
            {isFullscreen ? (
              <Minimize className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            ) : (
              <Maximize className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="hidden sm:inline font-mono text-[11px]">
              {isFullscreen ? 'Janela' : 'Tela Cheia'}
            </span>
          </button>

          {/* Cloud Info Button */}
          <button
            id="btn-cloud-info"
            onClick={onOpenCloudInfo}
            className="h-9 w-9 rounded-xl bg-[#240e02]/90 border border-amber-800/60 text-amber-400 flex items-center justify-center transition-all active:scale-95 hover:border-amber-500/60"
            title="Armazenamento em Nuvem"
          >
            <Cloud className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
