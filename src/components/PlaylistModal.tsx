import React, { useState } from 'react';
import {
  ListMusic,
  X,
  Play,
  Trash2,
  ChevronUp,
  ChevronDown,
  Plus,
  Check,
  Search,
  Sparkles,
  Clock,
  Music,
  Maximize2
} from 'lucide-react';
import { PadItem } from '../types';

interface PlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  allPads: PadItem[];
  playlistPadIds: string[];
  onUpdatePlaylist: (newIds: string[]) => void;
  onStartPresentation: () => void;
}

export const PlaylistModal: React.FC<PlaylistModalProps> = ({
  isOpen,
  onClose,
  allPads,
  playlistPadIds,
  onUpdatePlaylist,
  onStartPresentation
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'scaled' | 'library'>('scaled');

  if (!isOpen) return null;

  // Ordered list of pads currently scaled
  const scaledPads: PadItem[] = playlistPadIds
    .map(id => allPads.find(p => p.id === id))
    .filter((p): p is PadItem => Boolean(p));

  // Pads from library not yet scaled or matching search
  const filteredLibraryPads = allPads.filter(pad => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      pad.name.toLowerCase().includes(q) ||
      (pad.musicalKey && pad.musicalKey.toLowerCase().includes(q)) ||
      (pad.bpm && pad.bpm.toString().includes(q)) ||
      pad.category.toLowerCase().includes(q)
    );
  });

  const handleTogglePad = (padId: string) => {
    if (playlistPadIds.includes(padId)) {
      onUpdatePlaylist(playlistPadIds.filter(id => id !== padId));
    } else {
      onUpdatePlaylist([...playlistPadIds, padId]);
    }
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const next = [...playlistPadIds];
    const temp = next[index];
    next[index] = next[index - 1];
    next[index - 1] = temp;
    onUpdatePlaylist(next);
  };

  const handleMoveDown = (index: number) => {
    if (index >= playlistPadIds.length - 1) return;
    const next = [...playlistPadIds];
    const temp = next[index];
    next[index] = next[index + 1];
    next[index + 1] = temp;
    onUpdatePlaylist(next);
  };

  const handleClearPlaylist = () => {
    onUpdatePlaylist([]);
  };

  const handleAddAll = () => {
    const allIds = allPads.map(p => p.id);
    onUpdatePlaylist(allIds);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#0d1322] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <ListMusic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-100 text-sm sm:text-base">
                Playlist da Apresentação
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Escale os áudios que serão usados na tela cheia de palco
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950/40 px-3 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('scaled')}
            className={`pb-2 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'scaled'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Áudios Escalados</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] font-mono">
              {scaledPads.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`pb-2 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'library'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Escolher da Mesa</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] font-mono">
              {allPads.length}
            </span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-3.5 sm:p-4 overflow-y-auto space-y-3 flex-1">
          {activeTab === 'scaled' ? (
            /* Scaled List View with Order controls */
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Ordem de execução na apresentação:</span>
                {scaledPads.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearPlaylist}
                    className="text-rose-400 hover:text-rose-300 text-[11px] font-semibold cursor-pointer"
                  >
                    Remover Todos
                  </button>
                )}
              </div>

              {scaledPads.length === 0 ? (
                <div className="py-10 text-center space-y-2 border border-dashed border-slate-800 rounded-2xl p-6 bg-slate-900/30">
                  <ListMusic className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-300 font-semibold">
                    Nenhum áudio escalado ainda
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    Vá na aba "Escolher da Mesa" ou clique no botão de lista em cada pad para adicionar.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('library')}
                    className="mt-2 px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold transition-all cursor-pointer"
                  >
                    + Selecionar Áudios Agora
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {scaledPads.map((pad, index) => (
                    <div
                      key={pad.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs gap-2"
                    >
                      {/* Drag/Order index badge */}
                      <span className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 font-mono text-[11px] font-bold text-slate-300 flex items-center justify-center shrink-0">
                        {String(index + 1).padStart(2, '0')}
                      </span>

                      {/* Pad Info */}
                      <div className="flex-1 truncate min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-100 truncate">{pad.name}</span>
                          {pad.musicalKey && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-800 text-cyan-300 shrink-0">
                              {pad.musicalKey}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span className="capitalize">{pad.category}</span>
                          {pad.bpm && <span>• {pad.bpm} BPM</span>}
                        </div>
                      </div>

                      {/* Up/Down order controls */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                          title="Mover para cima"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveDown(index)}
                          disabled={index === scaledPads.length - 1}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                          title="Mover para baixo"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTogglePad(pad.id)}
                          className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 cursor-pointer ml-1"
                          title="Remover da playlist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Library Selection View */
            <div className="space-y-2">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por nome, tom ou categoria..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span>Clique para escalar ou desmarcar:</span>
                <button
                  type="button"
                  onClick={handleAddAll}
                  className="text-cyan-400 hover:text-cyan-300 text-[11px] font-semibold cursor-pointer"
                >
                  Adicionar Todos
                </button>
              </div>

              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {filteredLibraryPads.map((pad) => {
                  const isScaled = playlistPadIds.includes(pad.id);

                  return (
                    <div
                      key={pad.id}
                      onClick={() => handleTogglePad(pad.id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs gap-2 cursor-pointer transition-all active:scale-[0.99] ${
                        isScaled
                          ? 'bg-amber-500/15 border-amber-500/60 text-amber-200'
                          : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-900 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate min-w-0">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border text-[11px] shrink-0 ${
                            isScaled
                              ? 'bg-amber-500 border-amber-400 text-slate-950 font-bold'
                              : 'bg-slate-800 border-slate-700 text-transparent'
                          }`}
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>

                        <div className="truncate">
                          <span className="font-bold text-slate-100">{pad.name}</span>
                          <span className="text-[10px] text-slate-400 ml-2">
                            ({pad.category})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {pad.musicalKey && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-cyan-300 border border-slate-700">
                            {pad.musicalKey}
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg ${
                            isScaled
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {isScaled ? 'Escalado' : '+ Escalar'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer: Prominent Launch Presentation Button */}
        <div className="p-3.5 sm:p-4 border-t border-slate-800 flex items-center justify-between gap-2.5 bg-slate-950/70">
          <div className="text-xs text-slate-400">
            <strong>{scaledPads.length}</strong> áudio(s) pronto(s)
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Fechar
            </button>

            <button
              type="button"
              id="btn-start-presentation"
              onClick={() => {
                onClose();
                onStartPresentation();
              }}
              disabled={scaledPads.length === 0}
              className={`px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                scaledPads.length > 0
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 shadow-lg shadow-amber-500/25 active:scale-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Maximize2 className="w-4 h-4" />
              <span>Iniciar Apresentação (Tela Cheia)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
