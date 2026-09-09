import React, { useState } from 'react';
import {
  Volume2,
  SlidersHorizontal,
  Cloud,
  UploadCloud,
  Mic,
  Square,
  Share2,
  Music2,
  HardDrive
} from 'lucide-react';
import { audioEngine } from '../services/audioEngine';

interface HeaderProps {
  activeCount: number;
  onOpenUpload: () => void;
  onOpenRecord: () => void;
  onOpenCloudInfo: () => void;
  onMasterFadeOut: () => void;
  isFadingOut: boolean;
  totalPadsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeCount,
  onOpenUpload,
  onOpenRecord,
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
    <header className="w-full bg-slate-950/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Brand & Cloud Status */}
        <div className="flex items-center justify-between md:justify-start gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 shadow-lg shadow-cyan-500/25">
              <Music2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-slate-100 text-lg tracking-tight">
                  Pads de Áudio em Nuvem
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  Nuvem Ativa ({totalPadsCount} pads)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Player ao vivo, loops e pads para ministração e apresentações
              </p>
            </div>
          </div>

          <button
            onClick={onOpenCloudInfo}
            className="md:hidden p-2 rounded-xl bg-slate-800 text-cyan-300 border border-slate-700 flex items-center gap-1 text-xs"
            title="Nuvem Pública"
          >
            <Cloud className="w-4 h-4" />
          </button>
        </div>

        {/* Master Audio Controls & Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5 sm:gap-3">
          {/* Master Volume Slider */}
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5">
            <Volume2 className="w-4 h-4 text-slate-400" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={masterVolume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-20 sm:w-28 accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              title={`Volume Master: ${Math.round(masterVolume * 100)}%`}
            />
            <span className="text-[11px] font-mono text-slate-400 w-8 text-right">
              {Math.round(masterVolume * 100)}%
            </span>
          </div>

          {/* Master Filter Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowFilterControl(!showFilterControl)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                masterFilter < 19000
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
              title="Filtro Master de Frequência (Tone Cutoff)"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tom:</span>
              <span className="font-mono">
                {masterFilter >= 19000 ? 'Aberto' : `${Math.round(masterFilter / 1000)}k`}
              </span>
            </button>

            {showFilterControl && (
              <div className="absolute right-0 top-full mt-2 w-52 p-3 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl z-30 space-y-2">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Corte de Frequência</span>
                  <span className="font-mono text-cyan-400">{Math.round(masterFilter)} Hz</span>
                </div>
                <input
                  type="range"
                  min="300"
                  max="20000"
                  step="100"
                  value={masterFilter}
                  onChange={(e) => handleFilterChange(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
                <button
                  onClick={() => handleFilterChange(20000)}
                  className="w-full py-1 text-[11px] text-slate-400 hover:text-white bg-slate-800/60 rounded"
                >
                  Resetar para Aberto
                </button>
              </div>
            )}
          </div>

          {/* Master Panic / Fade Out All */}
          <button
            id="btn-fade-out-all"
            onClick={onMasterFadeOut}
            disabled={activeCount === 0 || isFadingOut}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeCount > 0
                ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 shadow-sm cursor-pointer'
                : 'bg-slate-900/60 text-slate-600 border border-slate-800/50 cursor-not-allowed'
            }`}
            title="Fade Out Geral: finaliza suavemente todos os pads que estão tocando"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Fade Out Geral</span>
          </button>

          {/* Upload Button */}
          <button
            id="btn-open-upload"
            onClick={onOpenUpload}
            className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span className="hidden sm:inline">Adicionar Áudios</span>
            <span className="sm:hidden">Upload</span>
          </button>

          {/* Record Button */}
          <button
            id="btn-open-record"
            onClick={onOpenRecord}
            className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-rose-400 text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="Gravar Áudio no Microfone"
          >
            <Mic className="w-4 h-4" />
            <span className="hidden sm:inline">Gravar Mic</span>
          </button>

          {/* Cloud Info Button */}
          <button
            id="btn-cloud-info"
            onClick={onOpenCloudInfo}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-sky-300 text-xs font-medium transition-colors"
            title="Gerenciar Nuvem e Links Públicos"
          >
            <Cloud className="w-4 h-4" />
            <span>Nuvem Pública</span>
          </button>
        </div>
      </div>
    </header>
  );
};
