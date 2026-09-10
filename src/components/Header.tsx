import React, { useState } from 'react';
import {
  Volume2,
  SlidersHorizontal,
  Cloud,
  UploadCloud,
  Square,
  Music2,
  Sliders
} from 'lucide-react';
import { audioEngine } from '../services/audioEngine';

interface HeaderProps {
  activeCount: number;
  onOpenUpload: () => void;
  onOpenCloudInfo: () => void;
  onMasterFadeOut: () => void;
  isFadingOut: boolean;
  totalPadsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeCount,
  onOpenUpload,
  onOpenCloudInfo,
  onMasterFadeOut,
  isFadingOut,
  totalPadsCount,
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
    <header className="w-full bg-[#0d121f]/95 border-b border-slate-800/80 backdrop-blur-xl sticky top-0 z-30 transition-all">
      <div className="max-w-4xl mx-auto px-3 sm:px-5 h-14 flex items-center justify-between gap-2">
        {/* Brand & Pad Count Indicator */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-sky-400 flex items-center justify-center text-slate-950 font-black shadow-md shadow-cyan-500/25 shrink-0">
            <Music2 className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <h1 className="font-bold text-white text-sm sm:text-base tracking-tight truncate">
              Pads Player
            </h1>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-800/90 text-cyan-300 border border-slate-700/80 shrink-0">
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
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold shadow-sm'
                  : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:text-white'
              }`}
              title="Volume Master"
            >
              <Volume2 className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono text-[11px]">{Math.round(masterVolume * 100)}%</span>
            </button>

            {showVolumePopup && (
              <div className="absolute right-0 top-full mt-2 w-48 p-3 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex justify-between text-xs text-slate-300 font-medium">
                  <span>Volume Geral</span>
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
                <div className="flex justify-between text-[10px] text-slate-500 pt-1">
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

          {/* Upload Button */}
          <button
            id="btn-open-upload"
            onClick={onOpenUpload}
            className="h-9 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-cyan-500/25 active:scale-95 transition-all cursor-pointer"
            title="Adicionar novos áudios"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Adicionar</span>
          </button>

          {/* Cloud Info Button */}
          <button
            id="btn-cloud-info"
            onClick={onOpenCloudInfo}
            className="h-9 w-9 rounded-xl bg-slate-900/90 border border-slate-800 text-sky-400 flex items-center justify-center transition-all active:scale-95 hover:border-slate-700"
            title="Armazenamento em Nuvem"
          >
            <Cloud className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
