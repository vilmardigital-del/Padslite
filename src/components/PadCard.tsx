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
      className={`group relative flex flex-col justify-between rounded-2xl border transition-all duration-200 select-none overflow-hidden touch-manipulation backdrop-blur-md ${
        isPlaying
          ? 'border-orange-400 bg-gradient-to-b from-[#4d1900] via-[#2f0e01] to-[#1a0600] shadow-[0_0_30px_rgba(249,115,22,0.45)] ring-1 ring-orange-400'
          : 'border-orange-500/30 bg-[#250b01]/90 hover:border-orange-500/70 hover:shadow-[0_0_15px_rgba(249,115,22,0.2)] active:bg-[#381202]'
      }`}
    >
      {/* Pad Top Bar: Tone Key, BPM & Options */}
      <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between gap-1.5 border-b border-orange-500/15">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {pad.musicalKey ? (
            <span
              className="px-2 py-0.5 text-xs font-black font-mono rounded-lg border tracking-wider shadow-[0_0_8px_rgba(249,115,22,0.2)]"
              style={{
                backgroundColor: `${pad.color || '#ea580c'}25`,
                borderColor: `${pad.color || '#ea580c'}70`,
                color: pad.color || '#fed7aa'
              }}
            >
              {pad.musicalKey}
            </span>
          ) : (
            <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold text-orange-300 bg-orange-950/60 border border-orange-800/50 rounded-md">
              PAD
            </span>
          )}

          {pad.bpm && (
            <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-md bg-[#160500] text-orange-200 border border-orange-500/30">
              {pad.bpm} BPM
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {pad.cloudStored && (
            <span title="Armazenado na Nuvem" className="text-orange-400 p-0.5">
              <Cloud className="w-3.5 h-3.5" />
            </span>
          )}

          {/* Scale to Presentation Button (Palco) */}
          {onTogglePlaylist && (
            <button
              id={`pad-playlist-btn-${pad.id}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePlaylist(pad.id);
              }}
              className={`px-1.5 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-90 ${
                isInPlaylist
                  ? 'text-slate-950 bg-gradient-to-r from-amber-400 to-orange-400 border border-amber-300 shadow-[0_0_10px_rgba(249,115,22,0.4)]'
                  : 'text-orange-300/70 hover:text-orange-100 hover:bg-orange-950/60 border border-orange-500/20'
              }`}
              title={isInPlaylist ? 'Escalado no Palco (clique para remover)' : 'Escalar para Palco'}
            >
              <ListMusic className="w-3 h-3" />
              <span className="hidden xs:inline">Palco</span>
            </button>
          )}

          <div className="relative">
            <button
              id={`pad-menu-btn-${pad.id}`}
              onClick={(e) => {
                e.stopPropagation();
                setShowOptions(!showOptions);
              }}
              className="p-1 rounded-lg text-orange-400/80 hover:text-white hover:bg-orange-900/40 active:scale-90 transition-all cursor-pointer"
              title="Mais opções"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showOptions && (
              <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl bg-[#200800]/95 backdrop-blur-2xl border border-orange-500/50 shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-30 py-1 text-xs animate-in fade-in zoom-in-95 text-orange-100">
                <button
                  onClick={handleCopyPublicUrl}
                  className="w-full text-left px-3 py-2 text-orange-100 hover:bg-orange-900/40 flex items-center gap-2 cursor-pointer font-medium"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-orange-400" />}
                  {copiedLink ? 'Link Copiado!' : 'Copiar Link'}
                </button>
                <button
                  onClick={handleDownload}
                  className="w-full text-left px-3 py-2 text-orange-100 hover:bg-orange-900/40 flex items-center gap-2 cursor-pointer font-medium"
                >
                  <Download className="w-3.5 h-3.5 text-orange-400" />
                  Baixar Arquivo
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowOptions(false);
                    onEditPad(pad);
                  }}
                  className="w-full text-left px-3 py-2 text-orange-100 hover:bg-orange-900/40 flex items-center gap-2 cursor-pointer font-medium"
                >
                  <Edit2 className="w-3.5 h-3.5 text-orange-400" />
                  Editar Nome/Tom
                </button>
                <div className="h-px bg-orange-900/60 my-1" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowOptions(false);
                    onDeletePad(pad.id);
                  }}
                  className="w-full text-left px-3 py-2 text-rose-400 hover:bg-rose-500/15 flex items-center gap-2 cursor-pointer font-medium"
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
        type="button"
        id={`pad-trigger-${pad.id}`}
        onClick={() => onTogglePlay(pad)}
        className="w-full px-3 py-4 sm:py-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all active:scale-[0.96] group-hover:bg-white/[0.02]"
      >
        {/* Futuristic Studio Drum-Pad Trigger */}
        <div
          className={`w-16 h-16 sm:w-18 sm:h-18 rounded-2xl flex items-center justify-center transition-all duration-200 ${
            isPlaying
              ? 'scale-105 shadow-[0_0_25px_rgba(249,115,22,0.8)] ring-2 ring-orange-300'
              : 'shadow-md border border-orange-500/40 hover:border-orange-400 hover:shadow-[0_0_12px_rgba(249,115,22,0.3)]'
          }`}
          style={{
            backgroundColor: isPlaying ? '#ea580c' : '#331201',
            color: isPlaying ? '#ffffff' : pad.color || '#fb923c'
          }}
        >
          {isLoading ? (
            <Loader2 className="w-7 h-7 animate-spin text-orange-200" />
          ) : isPlaying ? (
            <Square className="w-7 h-7 fill-current animate-pulse" />
          ) : (
            <Play className="w-7 h-7 fill-current ml-0.5 text-orange-300" />
          )}
        </div>

        <h3 className="mt-2.5 font-bold text-xs sm:text-sm text-orange-100 line-clamp-2 max-w-[95%] tracking-tight font-mono">
          {pad.name}
        </h3>

        <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-mono">
          {isLoading ? (
            <span className="text-orange-300 font-semibold flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> CARREGANDO...
            </span>
          ) : isPlaying ? (
            <span className="text-orange-300 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping inline-block shadow-[0_0_8px_#fb923c]" />
              TOCANDO
            </span>
          ) : (
            <span className="text-orange-400/70 font-medium">
              {pad.isLoop ? 'LOOP' : 'ONE-SHOT'}
            </span>
          )}
        </div>
      </button>

      {/* Mixer Mini Drawer */}
      {showMixer && (
        <div className="px-3 py-2.5 bg-[#1a0600] border-t border-orange-500/30 space-y-2 text-xs animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-orange-200 font-semibold font-mono text-[11px]">
            <span>VOLUME</span>
            <span className="font-mono text-orange-400">{Math.round((pad.volume ?? 0.8) * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={pad.volume ?? 0.8}
            onChange={(e) => onUpdatePad(pad.id, { volume: parseFloat(e.target.value) })}
            className="w-full accent-orange-500 h-1.5 bg-[#2d0f01] rounded-lg cursor-pointer"
          />

          <div className="flex items-center justify-between text-orange-200 font-semibold font-mono text-[11px] pt-0.5">
            <span>FILTRO TONE</span>
            <span className="font-mono text-orange-400">
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
            className="w-full accent-orange-500 h-1.5 bg-[#2d0f01] rounded-lg cursor-pointer"
          />
        </div>
      )}

      {/* Pad Footer Controls */}
      <div className="px-2.5 py-2 bg-[#1b0700] border-t border-orange-500/25 flex items-center justify-between gap-1.5">
        <button
          id={`pad-loop-toggle-${pad.id}`}
          onClick={toggleLoop}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all active:scale-95 cursor-pointer ${
            pad.isLoop
              ? 'bg-orange-500/25 text-orange-300 border border-orange-400/50 shadow-[0_0_8px_rgba(249,115,22,0.2)]'
              : 'text-orange-400/60 hover:text-orange-200 hover:bg-orange-900/30'
          }`}
          title={pad.isLoop ? 'Loop Ativado' : 'Loop Desativado'}
        >
          <Repeat className="w-3.5 h-3.5" />
          <span>LOOP</span>
        </button>

        <div className="flex items-center gap-1">
          <button
            id={`pad-mixer-toggle-${pad.id}`}
            onClick={(e) => {
              e.stopPropagation();
              setShowMixer(!showMixer);
            }}
            className={`p-1.5 rounded-lg text-xs transition-colors active:scale-90 cursor-pointer ${
              showMixer ? 'bg-orange-600/30 text-orange-300 border border-orange-500/40' : 'text-orange-400/70 hover:text-white hover:bg-orange-900/30'
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
            className="p-1.5 rounded-lg text-xs text-orange-400/70 hover:text-white hover:bg-orange-900/30 transition-colors active:scale-90 cursor-pointer"
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
