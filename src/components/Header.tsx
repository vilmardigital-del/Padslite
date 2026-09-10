import React, { useState } from 'react';
import {
  Volume2,
  SlidersHorizontal,
  Cloud,
  UploadCloud,
  Square,
  Share2,
  Music2,
  HardDrive
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
    <header className="w-full bg-slate-950/95 border-b border-slate-800/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-1.5 sm:py-2 flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
        {/* Brand & Badge */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 shadow-md shadow-cyan-500/20 shrink-0">
            <Music2 className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <h1 className="font-bold text-slate-100 text-sm sm:text-base tracking-tight whitespace-nowrap">
              Pads de Áudio
            </h1>
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 whitespace-nowrap font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="hidden xs:inline">Nuvem:</span> {totalPadsCount} pads
            </span>
          </div>
        </div>

        {/* Master Controls & Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap ml-auto">
          {/* Master Volume Slider */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-lg px-2 sm:px-2.5 py-1" title={`Volume Master: ${Math.round(masterVolume * 100)}%`}>
            <Volume2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={masterVolume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-16 sm:w-20 accent-cyan-400 h-1 bg-slate-800 rounded cursor-pointer"
            />
            <span className="text-[10px] font-mono text-slate-400 w-7 text-right">
              {Math.round(masterVolume * 100)}%
            </span>
          </div>

          {/* Master Filter Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowFilterControl(!showFilterControl)}
              className={`px-2 sm:px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1 transition-colors ${
                masterFilter < 19000
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
              title="Filtro Master de Frequência"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span className="hidden sm:inline">Tom:</span>
              <span className="font-mono text-[10px]">
                {masterFilter >= 19000 ? 'Aberto' : `${Math.round(masterFilter / 1000)}k`}
              </span>
            </button>

            {showFilterControl && (
              <div className="absolute right-0 top-full mt-1.5 w-48 p-2.5 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl z-50 space-y-2">
                <div className="flex justify-between text-[11px] text-slate-300">
                  <span>Corte Tom</span>
                  <span className="font-mono text-cyan-400">{Math.round(masterFilter)} Hz</span>
                </div>
                <input
                  type="range"
                  min="300"
                  max="20000"
                  step="100"
                  value={masterFilter}
                  onChange={(e) => handleFilterChange(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1 bg-slate-800 rounded cursor-pointer"
                />
                <button
                  onClick={() => handleFilterChange(20000)}
                  className="w-full py-0.5 text-[10px] text-slate-400 hover:text-white bg-slate-800/60 rounded"
                >
                  Resetar (Aberto)
                </button>
              </div>
            )}
          </div>

          {/* Master Panic / Stop All */}
          <button
            id="btn-fade-out-all"
            onClick={onMasterFadeOut}
            disabled={activeCount === 0 || isFadingOut}
            className={`px-2.5 sm:px-3 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all ${
              activeCount > 0
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30 cursor-pointer animate-pulse'
                : 'bg-slate-900/60 text-slate-600 border border-slate-800/50 cursor-not-allowed'
            }`}
            title="Parar toda a reprodução imediatamente"
          >
            <Square className="w-3 h-3 fill-current" />
            <span className="hidden xs:inline">Parar Tudo</span>
            <span className="xs:hidden">Parar</span>
          </button>

          {/* Upload Button */}
          <button
            id="btn-open-upload"
            onClick={onOpenUpload}
            className="px-2.5 sm:px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-[11px] font-semibold flex items-center gap-1 shadow-sm shadow-cyan-500/20 transition-all cursor-pointer whitespace-nowrap"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Adicionar</span>
            <span className="sm:hidden">Upload</span>
          </button>

          {/* Cloud Info Button */}
          <button
            id="btn-cloud-info"
            onClick={onOpenCloudInfo}
            className="p-1 sm:px-2.5 sm:py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-sky-300 text-[11px] font-medium flex items-center gap-1 transition-colors"
            title="Nuvem Pública"
          >
            <Cloud className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Nuvem</span>
          </button>
        </div>
      </div>
    </header>
  );
};
