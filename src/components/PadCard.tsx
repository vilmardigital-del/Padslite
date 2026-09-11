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
  Cloud,
  Loader2,
  ListMusic
} from 'lucide-react';

interface PadCardProps {
  pad: PadItem;
  isPlaying: boolean;
  isLoading?: boolean;
  isInPlaylist?: boolean;
  onTogglePlay: (pad: PadItem) => void;
  onUpdatePad: (padId: string, updates: Partial<PadItem>) => void;
  onDeletePad: (padId: string) => void;
  onEditPad: (pad: PadItem) => void;
  onTogglePlaylist?: (padId: string) => void;
}

export const PadCard: React.FC<PadCardProps> = ({
  pad,
  isPlaying,
  isLoading = false,
  isInPlaylist = false,
  onTogglePlay,
  onUpdatePad,
  onDeletePad,
  onEditPad,
  onTogglePlaylist,
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
      className={`group relative flex flex-col justify-between rounded-2xl border transition-all duration-200 select-none overflow-hidden touch-manipulation ${
        isPlaying
          ? 'border-cyan-400 bg-gradient-to-b from-slate-900 to-[#0e1424] shadow-xl shadow-cyan-500/20 ring-1 ring-cyan-400/50'
          : 'border-slate-800/80 bg-[#111625]/90 hover:border-slate-700/90 active:bg-[#151c2e] shadow-sm'
      }`}
    >
      {/* Pad Top Bar: Tone Key, BPM & Options */}
      <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {pad.musicalKey ? (
            <span
              className="px-2 py-0.5 text-xs font-black font-mono rounded-lg border tracking-wider shadow-xs"
              style={{
                backgroundColor: `${pad.color || '#38bdf8'}18`,
                borderColor: `${pad.color || '#38bdf8'}40`,
                color: pad.color || '#38bdf8'
              }}
            >
              {pad.musicalKey}
            </span>
          ) : (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-slate-800/60 rounded-md">
              Pad
            </span>
          )}

          {pad.bpm && (
            <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded-md bg-slate-800/80 text-slate-300 border border-slate-700/60">
              {pad.bpm} BPM
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {pad.cloudStored && (
            <span title="Armazenado na Nuvem" className="text-cyan-400/70 p-1">
              <Cloud className="w-3 h-3" />
            </span>
          )}

          {/* Scale to Presentation Button */}
          {onTogglePlaylist && (
            <button
              id={`pad-playlist-btn-${pad.id}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePlaylist(pad.id);
              }}
              className={`p-1.5 rounded-lg transition-all cursor-pointer active:scale-90 ${
                isInPlaylist
                  ? 'text-amber-300 bg-amber-500/25 border border-amber-500/40 shadow-xs'
                  : 'text-slate-500 hover:text-amber-300 hover:bg-slate-800'
              }`}
              title={isInPlaylist ? 'Escalado na Apresentação (clique para remover)' : 'Escalar para Apresentação'}
            >
              <ListMusic className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="relative">
            <button
              id={`pad-menu-btn-${pad.id}`}
              onClick={(e) => {
                e.stopPropagation();
                setShowOptions(!showOptions);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 active:scale-90 transition-all cursor-pointer"
              title="Mais opções"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showOptions && (
              <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl z-30 py-1 text-xs animate-in fade-in zoom-in-95">
                <button
                  onClick={handleCopyPublicUrl}
                  className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-cyan-400" />}
                  {copiedLink ? 'Link Copiado!' : 'Copiar Link'}
                </button>
                <button
                  onClick={handleDownload}
                  className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  Baixar Arquivo
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowOptions(false);
                    onEditPad(pad);
                  }}
                  className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                  Editar Nome/Tom
                </button>
                {onTogglePlaylist && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowOptions(false);
                      onTogglePlaylist(pad.id);
                    }}
                    className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                  >
                    <ListMusic className="w-3.5 h-3.5 text-amber-400" />
                    {isInPlaylist ? 'Remover da Apresentação' : 'Escalar para Apresentação'}
                  </button>
                )}
                <div className="h-px bg-slate-800 my-1" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowOptions(false);
                    onDeletePad(pad.id);
                  }}
                  className="w-full text-left px-3 py-2 text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remover
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Touch / Trigger Area - High Ergonimics for Fingers */}
      <button
        id={`pad-trigger-${pad.id}`}
        onClick={() => onTogglePlay(pad)}
        className="w-full px-3 py-4 sm:py-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all active:scale-[0.96] group-hover:bg-white/[0.01]"
      >
        {/* Physical Studio Drum-Pad Style Button */}
        <div
          className={`w-16 h-16 sm:w-18 sm:h-18 rounded-2xl flex items-center justify-center transition-all duration-200 ${
            isPlaying
              ? 'scale-105 shadow-xl ring-2 ring-rose-400/80'
              : 'shadow-md border border-slate-700/60 hover:border-slate-600'
          }`}
          style={{
            backgroundColor: isPlaying ? '#e11d48' : '#171f33',
            boxShadow: isPlaying
              ? '0 0 28px rgba(225, 29, 72, 0.6)'
              : 'inset 0 1px 0 rgba(255,255,255,0.05)',
            color: isPlaying ? '#ffffff' : pad.color || '#38bdf8'
          }}
        >
          {isLoading ? (
            <Loader2 className="w-7 h-7 animate-spin text-cyan-300" />
          ) : isPlaying ? (
            <Square className="w-7 h-7 fill-current animate-pulse" />
          ) : (
            <Play className="w-7 h-7 fill-current ml-0.5" />
          )}
        </div>

        <h3 className="mt-2.5 font-bold text-xs sm:text-sm text-slate-100 line-clamp-2 max-w-[95%] tracking-tight">
          {pad.name}
        </h3>

        <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px]">
          {isLoading ? (
            <span className="text-cyan-400 font-semibold flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Carregando...
            </span>
          ) : isPlaying ? (
            <span className="text-rose-400 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
              Tocando
            </span>
          ) : (
            <span className="text-slate-400 font-medium">
              {pad.isLoop ? 'Loop Ativo' : 'Toque Único'}
            </span>
          )}
        </div>
      </button>

      {/* Mixer Mini Drawer */}
      {showMixer && (
        <div className="px-3 py-2 bg-slate-950/90 border-t border-slate-800 space-y-2 text-xs animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-slate-300 font-medium text-[11px]">
            <span>Volume</span>
            <span className="font-mono text-cyan-400">{Math.round((pad.volume ?? 0.8) * 100)}%</span>
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

          <div className="flex items-center justify-between text-slate-300 font-medium text-[11px] pt-0.5">
            <span>Filtro Tom</span>
            <span className="font-mono text-cyan-400">
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
      <div className="px-2.5 py-2 bg-[#0c101c] border-t border-slate-800/80 flex items-center justify-between gap-1.5">
        <button
          id={`pad-loop-toggle-${pad.id}`}
          onClick={toggleLoop}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all active:scale-95 ${
            pad.isLoop
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title={pad.isLoop ? 'Loop Ativado' : 'Loop Desativado'}
        >
          <Repeat className="w-3.5 h-3.5" />
          <span>Loop</span>
        </button>

        <div className="flex items-center gap-1">
          <button
            id={`pad-mixer-toggle-${pad.id}`}
            onClick={(e) => {
              e.stopPropagation();
              setShowMixer(!showMixer);
            }}
            className={`p-1.5 rounded-lg text-xs transition-colors active:scale-90 ${
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
            className="p-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors active:scale-90"
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
