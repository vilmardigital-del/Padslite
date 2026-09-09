import React, { useState } from 'react';
import { PadItem } from '../types';
import {
  Play,
  Square,
  Repeat,
  Volume2,
  VolumeX,
  MoreVertical,
  Download,
  Share2,
  Edit2,
  Trash2,
  Sliders,
  Check,
  Cloud
} from 'lucide-react';

interface PadCardProps {
  pad: PadItem;
  isPlaying: boolean;
  onTogglePlay: (pad: PadItem) => void;
  onUpdatePad: (padId: string, updates: Partial<PadItem>) => void;
  onDeletePad: (padId: string) => void;
  onEditPad: (pad: PadItem) => void;
}

export const PadCard: React.FC<PadCardProps> = ({
  pad,
  isPlaying,
  onTogglePlay,
  onUpdatePad,
  onDeletePad,
  onEditPad,
}) => {
  const [showOptions, setShowOptions] = useState(false);
  const [showMixer, setShowMixer] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyPublicUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    const fullUrl = `${window.location.origin}${pad.url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = pad.url;
    link.download = pad.originalFileName || `${pad.name}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleLoop = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdatePad(pad.id, { isLoop: !pad.isLoop });
  };

  return (
    <div
      id={`pad-card-${pad.id}`}
      className={`group relative flex flex-col justify-between rounded-2xl border transition-all duration-200 select-none overflow-hidden ${
        isPlaying
          ? 'border-cyan-400/80 bg-slate-900 shadow-lg shadow-cyan-500/20 ring-2 ring-cyan-400/40'
          : 'border-slate-800 bg-slate-900/80 hover:border-slate-700 hover:bg-slate-800/80 shadow'
      }`}
    >
      {/* Pad Top Bar */}
      <div className="p-3.5 pb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {pad.musicalKey && (
            <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Tom {pad.musicalKey}
            </span>
          )}
          {pad.bpm && (
            <span className="px-1.5 py-0.5 text-[11px] font-medium rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30">
              {pad.bpm} BPM
            </span>
          )}
          {pad.hotkey && (
            <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-400 border border-slate-700">
              [{pad.hotkey}]
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {pad.cloudStored && (
            <span title="Armazenado na Nuvem Pública" className="text-cyan-400/70 p-1">
              <Cloud className="w-3.5 h-3.5" />
            </span>
          )}
          <div className="relative">
            <button
              id={`pad-menu-btn-${pad.id}`}
              onClick={(e) => {
                e.stopPropagation();
                setShowOptions(!showOptions);
              }}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
              title="Mais opções"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showOptions && (
              <div className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-slate-950 border border-slate-700 shadow-xl z-30 py-1 text-xs">
                <button
                  onClick={handleCopyPublicUrl}
                  className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-cyan-400" />}
                  {copiedLink ? 'Link Copiado!' : 'Copiar Link Nuvem'}
                </button>
                <button
                  onClick={handleDownload}
                  className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                  Baixar Áudio
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowOptions(false);
                    onEditPad(pad);
                  }}
                  className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                >
                  <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                  Editar Pad
                </button>
                <div className="h-px bg-slate-800 my-1" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowOptions(false);
                    onDeletePad(pad.id);
                  }}
                  className="w-full text-left px-3 py-2 text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remover Pad
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Touch / Trigger Area */}
      <button
        id={`pad-trigger-${pad.id}`}
        onClick={() => onTogglePlay(pad)}
        className="w-full px-4 py-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all active:scale-[0.98] group-hover:bg-white/[0.02]"
        style={{
          borderTop: `3px solid ${pad.color || '#38bdf8'}`,
        }}
      >
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-md ${
            isPlaying
              ? 'scale-110 shadow-lg'
              : 'scale-100 hover:scale-105'
          }`}
          style={{
            backgroundColor: isPlaying ? pad.color || '#0284c7' : 'rgba(30, 41, 59, 0.8)',
            boxShadow: isPlaying ? `0 0 24px ${pad.color}88` : undefined,
            color: isPlaying ? '#ffffff' : pad.color || '#38bdf8'
          }}
        >
          {isPlaying ? (
            <Square className="w-6 h-6 fill-current animate-pulse" />
          ) : (
            <Play className="w-6 h-6 fill-current ml-0.5" />
          )}
        </div>

        <h3 className="mt-3 font-semibold text-sm text-slate-100 line-clamp-2 max-w-[90%] tracking-wide">
          {pad.name}
        </h3>

        <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
          <span className="capitalize">{pad.category}</span>
          <span>•</span>
          <span>{pad.isLoop ? 'Loop Contínuo' : 'Disparo Único'}</span>
        </div>
      </button>

      {/* Mixer Mini Drawer */}
      {showMixer && (
        <div className="px-3.5 py-2.5 bg-slate-950/80 border-t border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Volume</span>
            <span className="font-mono text-slate-200">{Math.round((pad.volume ?? 0.8) * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={pad.volume ?? 0.8}
            onChange={(e) => onUpdatePad(pad.id, { volume: parseFloat(e.target.value) })}
            className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />

          <div className="flex items-center justify-between pt-1">
            <span className="text-slate-400">Filtro (Tom)</span>
            <span className="font-mono text-slate-200">
              {pad.filterCutoff >= 19000 ? 'Aberto' : `${Math.round(pad.filterCutoff)}Hz`}
            </span>
          </div>
          <input
            type="range"
            min="200"
            max="20000"
            step="100"
            value={pad.filterCutoff ?? 20000}
            onChange={(e) => onUpdatePad(pad.id, { filterCutoff: parseFloat(e.target.value) })}
            className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>
      )}

      {/* Pad Footer Controls */}
      <div className="p-2.5 bg-slate-900/90 border-t border-slate-800/80 flex items-center justify-between gap-2">
        <button
          id={`pad-loop-toggle-${pad.id}`}
          onClick={toggleLoop}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            pad.isLoop
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title={pad.isLoop ? 'Loop Ativado' : 'Loop Desativado'}
        >
          <Repeat className="w-3.5 h-3.5" />
          <span>Loop</span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            id={`pad-mixer-toggle-${pad.id}`}
            onClick={(e) => {
              e.stopPropagation();
              setShowMixer(!showMixer);
            }}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              showMixer ? 'bg-slate-700 text-cyan-300' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Ajustes de Volume e Tom"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>

          <button
            id={`pad-mute-toggle-${pad.id}`}
            onClick={(e) => {
              e.stopPropagation();
              const isMuted = (pad.volume ?? 0.8) === 0;
              onUpdatePad(pad.id, { volume: isMuted ? 0.8 : 0 });
            }}
            className="p-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={(pad.volume ?? 0.8) === 0 ? 'Desmutar' : 'Mutar'}
          >
            {(pad.volume ?? 0.8) === 0 ? (
              <VolumeX className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
