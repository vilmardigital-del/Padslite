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
    <header className="w-full bg-[#0a1838]/95 border-b border-blue-500/35 backdrop-blur-2xl sticky top-0 z-30 transition-all shadow-[0_4px_25px_rgba(37,99,235,0.25)]">
      <div className="max-w-4xl mx-auto px-3 sm:px-5 h-14 flex items-center justify-between gap-2">
        {/* Brand & Audio Telemetry */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-blue-500 to-sky-300 flex items-center justify-center text-white font-black shadow-[0_0_15px_rgba(59,130,246,0.6)] shrink-0">
              <Music2 className="w-4 h-4" />
            </div>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0a1838] animate-pulse" />
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-white text-sm sm:text-base tracking-tight font-mono truncate uppercase">
                  Pads Pro
                </h1>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-md bg-blue-500/20 text-blue-200 border border-blue-400/40 shrink-0 font-bold">
                  HUD v2.4
                </span>
              </div>
              <p className="text-[10px] text-blue-200/70 font-mono hidden xs:block -mt-0.5">
                STUDIO AUDIO ENGINE
              </p>
            </div>
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
                  ? 'bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400 text-white border-white font-bold shadow-[0_0_12px_rgba(59,130,246,0.5)]'
                  : 'bg-[#0d224d]/90 text-white border-blue-500/40 hover:text-white hover:border-blue-400 shadow-sm'
              }`}
              title="Volume Master Geral"
            >
              <Volume2 className="w-3.5 h-3.5 text-blue-300 shrink-0" />
              <span className="font-mono text-[11px] font-bold">{Math.round(masterVolume * 100)}%</span>
            </button>

            {showVolumePopup && (
              <div className="absolute right-0 top-full mt-2 w-52 p-3.5 bg-[#0a1736]/95 backdrop-blur-2xl border border-blue-500/60 rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.8)] z-50 space-y-2.5 animate-in fade-in zoom-in-95 duration-150 text-white">
                <div className="flex justify-between text-xs text-blue-100 font-semibold font-mono">
                  <span>MASTER VOLUME</span>
                  <span className="font-mono text-white font-bold">{Math.round(masterVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={masterVolume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full accent-blue-500 h-2 bg-[#060f26] rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-blue-200/80 pt-1">
                  <button onClick={() => handleVolumeChange(0.5)} className="px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800/60 hover:text-white hover:border-blue-400">50%</button>
                  <button onClick={() => handleVolumeChange(0.85)} className="px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800/60 hover:text-white hover:border-blue-400">85%</button>
                  <button onClick={() => handleVolumeChange(1.0)} className="px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800/60 hover:text-white hover:border-blue-400">100%</button>
                </div>
              </div>
            )}
          </div>

          {/* Master Stop Button (Vivid Red Beacon) */}
          {activeCount > 0 && (
            <button
              id="btn-fade-out-all"
              onClick={onMasterFadeOut}
              className="h-9 px-3 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-[0_0_20px_rgba(239,68,68,0.7)] active:scale-95 transition-all cursor-pointer animate-pulse border border-red-400/40"
              title="Parar toda a execução imediatamente"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span className="tracking-wider font-mono">PARAR ({activeCount})</span>
            </button>
          )}

          {/* Presentation Playlist Button (Palco) */}
          {onOpenPlaylist && (
            <button
              id="btn-open-playlist"
              onClick={onOpenPlaylist}
              className={`h-9 px-2.5 sm:px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                playlistCount > 0
                  ? 'bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400 hover:from-blue-500 hover:to-sky-300 text-white border-white shadow-[0_0_15px_rgba(59,130,246,0.5)]'
                  : 'bg-[#0d224d]/90 hover:bg-[#133068] text-blue-100 border-blue-500/40 hover:border-blue-400'
              }`}
              title="Playlist de Apresentação (Palco)"
            >
              <ListMusic className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline font-mono">Palco</span>
              {playlistCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-white text-blue-950">
                  {playlistCount}
                </span>
              )}
            </button>
          )}

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
                ? 'bg-blue-600 text-white border-white shadow-[0_0_10px_rgba(59,130,246,0.4)]'
                : 'bg-[#0d224d]/90 text-blue-100 border-blue-500/40 hover:text-white hover:border-blue-400'
            }`}
            title={isFullscreen ? 'Sair da Tela Cheia' : 'Ativar Tela Cheia'}
          >
            {isFullscreen ? (
              <Minimize className="w-3.5 h-3.5 text-blue-200 shrink-0" />
            ) : (
              <Maximize className="w-3.5 h-3.5 text-blue-200 shrink-0" />
            )}
            <span className="hidden sm:inline font-mono text-[11px]">
              {isFullscreen ? 'Janela' : 'Tela Cheia'}
            </span>
          </button>

          {/* Cloud Info Button */}
          <button
            id="btn-cloud-info"
            onClick={onOpenCloudInfo}
            className="h-9 w-9 rounded-xl bg-[#0d224d]/90 border border-blue-500/40 text-blue-200 flex items-center justify-center transition-all active:scale-95 hover:border-blue-400 hover:text-white shadow-sm"
            title="Armazenamento em Nuvem"
          >
            <Cloud className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
