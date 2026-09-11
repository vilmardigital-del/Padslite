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
          ? 'border-amber-400 bg-gradient-to-b from-[#3a1603] to-[#200c01] shadow-xl shadow-amber-500/25 ring-1 ring-amber-400/60'
          : 'border-amber-900/45 bg-[#200c02]/90 hover:border-amber-500/50 active:bg-[#2c1203] shadow-sm'
      }`}
    >
      {/* Pad Top Bar: Tone Key, BPM & Options */}
      <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {pad.musicalKey ? (
            <span
              className="px-2 py-0.5 text-xs font-black font-mono rounded-lg border tracking-wider shadow-xs"
              style={{
                backgroundColor: `${pad.color || '#f59e0b'}20`,
                borderColor: `${pad.color || '#f59e0b'}50`,
                color: pad.color || '#fbbf24'
              }}
            >
              {pad.musicalKey}
            </span>
          ) : (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold text-amber-300/80 bg-amber-900/40 rounded-md">
              Pad
            </span>
          )}

          {pad.bpm && (
            <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded-md bg-[#180700] text-amber-200 border border-amber-900/60">
              {pad.bpm} BPM
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {pad.cloudStored && (
            <span title="Armazenado na Nuvem" className="text-amber-400/80 p-1">
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
                  ? 'text-amber-300 bg-amber-500/30 border border-amber-400 shadow-xs'
                  : 'text-amber-500/60 hover:text-amber-300 hover:bg-amber-900/30'
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
              className="p-1.5 rounded-lg text-amber-400/70 hover:text-white hover:bg-amber-900/40 active:scale-90 transition-all cursor-pointer"
              title="Mais opções"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showOptions && (
              <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl bg-[#220d02] border border-amber-700/60 shadow-2xl z-30 py-1 text-xs animate-in fade-in zoom-in-95 text-amber-100">
                <button
                  onClick={handleCopyPublicUrl}
                  className="w-full text-left px-3 py-2 text-amber-100 hover:bg-amber-900/40 flex items-center gap-2 cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-amber-400" />}
                  {copiedLink ? 'Link Copiado!' : 'Copiar Link'}
                </button>
                <button
                  onClick={handleDownload}
                  className="w-full text-left px-3 py-2 text-amber-100 hover:bg-amber-900/40 flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  Baixar Arquivo
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowOptions(false);
                    onEditPad(pad);
                  }}
                  className="w-full text-left px-3 py-2 text-amber-100 hover:bg-amber-900/40 flex items-center gap-2 cursor-pointer"
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
                    className="w-full text-left px-3 py-2 text-amber-100 hover:bg-amber-900/40 flex items-center gap-2 cursor-pointer"
                  >
                    <ListMusic className="w-3.5 h-3.5 text-amber-400" />
                    {isInPlaylist ? 'Remover da Apresentação' : 'Escalar para Apresentação'}
                  </button>
                )}
                <div className="h-px bg-amber-900/60 my-1" />
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
              ? 'scale-105 shadow-xl ring-2 ring-amber-400/80'
              : 'shadow-md border border-amber-800/60 hover:border-amber-600/70'
          }`}
          style={{
            backgroundColor: isPlaying ? '#ea580c' : '#280f02',
            boxShadow: isPlaying
              ? '0 0 28px rgba(234, 88, 12, 0.6)'
              : 'inset 0 1px 0 rgba(255,255,255,0.05)',
            color: isPlaying ? '#ffffff' : pad.color || '#f59e0b'
          }}
        >
          {isLoading ? (
            <Loader2 className="w-7 h-7 animate-spin text-amber-300" />
          ) : isPlaying ? (
            <Square className="w-7 h-7 fill-current animate-pulse" />
          ) : (
            <Play className="w-7 h-7 fill-current ml-0.5" />
          )}
        </div>

        <h3 className="mt-2.5 font-bold text-xs sm:text-sm text-amber-100 line-clamp-2 max-w-[95%] tracking-tight">
          {pad.name}
        </h3>

        <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px]">
          {isLoading ? (
            <span className="text-amber-400 font-semibold flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Carregando...
            </span>
          ) : isPlaying ? (
            <span className="text-orange-400 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping inline-block" />
              Tocando
            </span>
          ) : (
            <span className="text-amber-400/70 font-medium">
              {pad.isLoop ? 'Loop Ativo' : 'Toque Único'}
            </span>
          )}
        </div>
      </button>

      {/* Mixer Mini Drawer */}
      {showMixer && (
        <div className="px-3 py-2 bg-[#160701] border-t border-amber-900/60 space-y-2 text-xs animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-amber-200 font-medium text-[11px]">
            <span>Volume</span>
            <span className="font-mono text-amber-400">{Math.round((pad.volume ?? 0.8) * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={pad.volume ?? 0.8}
            onChange={(e) => onUpdatePad(pad.id, { volume: parseFloat(e.target.value) })}
            className="w-full accent-amber-500 h-1.5 bg-[#2a1002] rounded-lg cursor-pointer"
          />

          <div className="flex items-center justify-between text-amber-200 font-medium text-[11px] pt-0.5">
            <span>Filtro Tom</span>
            <span className="font-mono text-amber-400">
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
            className="w-full accent-amber-500 h-1.5 bg-[#2a1002] rounded-lg cursor-pointer"
          />
        </div>
      )}

      {/* Pad Footer Controls */}
      <div className="px-2.5 py-2 bg-[#190801] border-t border-amber-900/60 flex items-center justify-between gap-1.5">
        <button
          id={`pad-loop-toggle-${pad.id}`}
          onClick={toggleLoop}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all active:scale-95 ${
            pad.isLoop
              ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50'
              : 'text-amber-400/60 hover:text-amber-200 hover:bg-amber-900/30'
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
              showMixer ? 'bg-amber-900/60 text-amber-300' : 'text-amber-400/70 hover:text-white hover:bg-amber-900/30'
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
            className="p-1.5 rounded-lg text-xs text-amber-400/70 hover:text-white hover:bg-amber-900/30 transition-colors active:scale-90"
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
