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
          ? 'border-blue-400 bg-gradient-to-b from-[#123068] via-[#0d224d] to-[#061128] shadow-[0_0_30px_rgba(37,99,235,0.55)] ring-1 ring-blue-300'
          : 'border-blue-500/30 bg-[#0a1838]/90 hover:border-blue-400/80 hover:shadow-[0_0_18px_rgba(37,99,235,0.25)] active:bg-[#0f285a]'
      }`}
    >
      {/* Pad Top Bar: Tone Key, BPM & Options */}
      <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between gap-1.5 border-b border-blue-500/15">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {pad.musicalKey ? (
            <span
              className="px-2 py-0.5 text-xs font-black font-mono rounded-lg border tracking-wider shadow-[0_0_8px_rgba(59,130,246,0.2)]"
              style={{
                backgroundColor: `${pad.color || '#3b82f6'}25`,
                borderColor: `${pad.color || '#3b82f6'}70`,
                color: pad.color || '#bfdbfe'
              }}
            >
              {pad.musicalKey}
            </span>
          ) : (
            <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold text-blue-200 bg-blue-950/60 border border-blue-800/50 rounded-md">
              PAD
            </span>
          )}

          {pad.bpm && (
            <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-md bg-[#060f26] text-blue-100 border border-blue-500/30">
              {pad.bpm} BPM
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {pad.cloudStored && (
            <span title="Armazenado na Nuvem" className="text-blue-300 p-0.5">
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
                  ? 'text-white bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400 border border-white shadow-[0_0_10px_rgba(59,130,246,0.5)]'
                  : 'text-blue-200/80 hover:text-white hover:bg-blue-950/60 border border-blue-500/25'
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
              className="p-1 rounded-lg text-blue-300 hover:text-white hover:bg-blue-900/40 active:scale-90 transition-all cursor-pointer"
              title="Mais opções"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showOptions && (
              <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl bg-[#0a1838]/98 backdrop-blur-2xl border border-blue-500/50 shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-30 py-1 text-xs animate-in fade-in zoom-in-95 text-white">
                <button
                  onClick={handleCopyPublicUrl}
                  className="w-full text-left px-3 py-2 text-white hover:bg-blue-900/50 flex items-center gap-2 cursor-pointer font-medium"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-blue-300" />}
                  {copiedLink ? 'Link Copiado!' : 'Copiar Link'}
                </button>
                <button
                  onClick={handleDownload}
                  className="w-full text-left px-3 py-2 text-white hover:bg-blue-900/50 flex items-center gap-2 cursor-pointer font-medium"
                >
                  <Download className="w-3.5 h-3.5 text-blue-300" />
                  Baixar Arquivo
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowOptions(false);
                    onEditPad(pad);
                  }}
                  className="w-full text-left px-3 py-2 text-white hover:bg-blue-900/50 flex items-center gap-2 cursor-pointer font-medium"
                >
                  <Edit2 className="w-3.5 h-3.5 text-blue-300" />
                  Editar Nome/Tom
                </button>
                <div className="h-px bg-blue-900/60 my-1" />
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
        {/* Studio Drum-Pad Trigger */}
        <div
          className={`w-16 h-16 sm:w-18 sm:h-18 rounded-2xl flex items-center justify-center transition-all duration-200 ${
            isPlaying
              ? 'scale-105 shadow-[0_0_25px_rgba(59,130,246,0.85)] ring-2 ring-white'
              : 'shadow-md border border-blue-500/40 hover:border-blue-400 hover:shadow-[0_0_12px_rgba(59,130,246,0.35)]'
          }`}
          style={{
            backgroundColor: isPlaying ? '#2563eb' : '#0d224d',
            color: isPlaying ? '#ffffff' : pad.color || '#93c5fd'
          }}
        >
          {isLoading ? (
            <Loader2 className="w-7 h-7 animate-spin text-blue-200" />
          ) : isPlaying ? (
            <Square className="w-7 h-7 fill-current animate-pulse" />
          ) : (
            <Play className="w-7 h-7 fill-current ml-0.5 text-blue-200" />
          )}
        </div>

        <h3 className="mt-2.5 font-bold text-xs sm:text-sm text-white line-clamp-2 max-w-[95%] tracking-tight font-mono">
          {pad.name}
        </h3>

        <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-mono">
          {isLoading ? (
            <span className="text-blue-300 font-semibold flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> CARREGANDO...
            </span>
          ) : isPlaying ? (
            <span className="text-white font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping inline-block shadow-[0_0_8px_#60a5fa]" />
              TOCANDO
            </span>
          ) : (
            <span className="text-blue-300/80 font-medium">
              {pad.isLoop ? 'LOOP' : 'ONE-SHOT'}
            </span>
          )}
        </div>
      </button>

      {/* Mixer Mini Drawer */}
      {showMixer && (
        <div className="px-3 py-2.5 bg-[#060f26] border-t border-blue-500/30 space-y-2 text-xs animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-blue-100 font-semibold font-mono text-[11px]">
            <span>VOLUME</span>
            <span className="font-mono text-white font-bold">{Math.round((pad.volume ?? 0.8) * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={pad.volume ?? 0.8}
            onChange={(e) => onUpdatePad(pad.id, { volume: parseFloat(e.target.value) })}
            className="w-full accent-blue-500 h-1.5 bg-[#0d224d] rounded-lg cursor-pointer"
          />

          <div className="flex items-center justify-between text-blue-100 font-semibold font-mono text-[11px] pt-0.5">
            <span>FILTRO TONE</span>
            <span className="font-mono text-white font-bold">
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
            className="w-full accent-blue-500 h-1.5 bg-[#0d224d] rounded-lg cursor-pointer"
          />
        </div>
      )}

      {/* Pad Footer Controls */}
      <div className="px-2.5 py-2 bg-[#07132e] border-t border-blue-500/25 flex items-center justify-between gap-1.5">
        <button
          id={`pad-loop-toggle-${pad.id}`}
          onClick={toggleLoop}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all active:scale-95 cursor-pointer ${
            pad.isLoop
              ? 'bg-blue-500/30 text-white border border-blue-400/60 shadow-[0_0_8px_rgba(59,130,246,0.3)]'
              : 'text-blue-300/70 hover:text-white hover:bg-blue-900/40'
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
              showMixer ? 'bg-blue-600/30 text-white border border-blue-500/40' : 'text-blue-300/70 hover:text-white hover:bg-blue-900/40'
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
            className="p-1.5 rounded-lg text-xs text-blue-300/70 hover:text-white hover:bg-blue-900/40 transition-colors active:scale-90 cursor-pointer"
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
