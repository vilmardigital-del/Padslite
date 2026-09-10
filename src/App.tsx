import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  SlidersHorizontal,
  Volume2,
  Square,
  Plus,
  Radio,
  Music,
  Layers,
  Sparkles,
  Info,
  CheckCircle,
  Clock,
  ArrowRightLeft,
  Filter,
  Flame,
  Cloud,
  UploadCloud,
  Trash2,
  User,
  VolumeX
} from 'lucide-react';
import { PadItem, CloudStorageStats } from './types';
import { audioEngine } from './services/audioEngine';
import {
  fetchPads,
  fetchCloudStats,
  updatePadOnServer,
  deletePadOnServer,
  resetPadsOnServer,
  removeSystemPads,
  clearAllPads
} from './services/api';
import { saveStoredPads, getStoredPads, getDefaultPads } from './services/storage';
import { Header } from './components/Header';
import { PadCard } from './components/PadCard';
import { Visualizer } from './components/Visualizer';
import { Metronome } from './components/Metronome';
import { UploadModal } from './components/UploadModal';
import { PadEditModal } from './components/PadEditModal';
import { CloudStorageInfo } from './components/CloudStorageInfo';

export default function App() {
  const [pads, setPads] = useState<PadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePadIds, setActivePadIds] = useState<Set<string>>(new Set());
  const [loadingPadIds, setLoadingPadIds] = useState<Set<string>>(new Set());
  const [playbackMode, setPlaybackMode] = useState<'single' | 'multi'>('single');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string>('all');
  const [isCrossfadeMode, setIsCrossfadeMode] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isCloudInfoOpen, setIsCloudInfoOpen] = useState(false);
  const [editingPad, setEditingPad] = useState<PadItem | null>(null);
  const [stats, setStats] = useState<CloudStorageStats | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Load pads & stats
  const loadData = async () => {
    try {
      setLoading(true);
      // Clean local storage of system pads if user had them cached
      const localPads = getStoredPads();
      if (localPads && localPads.some(p => !p.isCustomUpload)) {
        const customOnly = localPads.filter(p => p.isCustomUpload);
        saveStoredPads(customOnly);
      }

      const [padsData, statsData] = await Promise.all([fetchPads(), fetchCloudStats()]);
      // Filter out system pads and guarantee immediate pure audio playback
      const customOnly = padsData
        .filter(p => p.isCustomUpload)
        .map(p => ({
          ...p,
          fadeInTime: 0,
          fadeOutTime: 0.05,
        }));
      setPads(customOnly);
      saveStoredPads(customOnly);
      setStats(statsData);
    } catch (err: any) {
      console.error('Error loading data:', err);
      const fallback = (getStoredPads() || [])
        .filter(p => p.isCustomUpload)
        .map(p => ({ ...p, fadeInTime: 0, fadeOutTime: 0.05 }));
      setPads(fallback);
      showNotification('Pads carregados localmente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Subscribe to Audio Engine state changes
    const unsubscribe = audioEngine.subscribe((padId, isPlaying) => {
      setActivePadIds(prev => {
        const next = new Set(prev);
        if (isPlaying) {
          next.add(padId);
        } else {
          next.delete(padId);
        }
        return next;
      });
    });

    const unsubscribeLoading = audioEngine.subscribeLoading((padId, isLoading) => {
      setLoadingPadIds(prev => {
        const next = new Set(prev);
        if (isLoading) {
          next.add(padId);
        } else {
          next.delete(padId);
        }
        return next;
      });
    });

    return () => {
      unsubscribe();
      unsubscribeLoading();
      audioEngine.stopAll();
    };
  }, []);

  // Master Stop All - instant, no lingering audio
  const handleMasterFadeOut = useCallback(() => {
    if (activePadIds.size === 0 && loadingPadIds.size === 0) return;
    setIsFadingOut(true);
    audioEngine.stopAll();
    setActivePadIds(new Set());
    setLoadingPadIds(new Set());
    showNotification('Reprodução parada.');
    setTimeout(() => {
      setIsFadingOut(false);
    }, 150);
  }, [activePadIds.size, loadingPadIds.size]);

  // Toggle play for a pad - individual or multi
  const handleTogglePad = useCallback((pad: PadItem) => {
    const isPlaying = activePadIds.has(pad.id);
    const isLoading = loadingPadIds.has(pad.id);

    if (isPlaying || isLoading) {
      // Stop it immediately without any delay or overlap
      audioEngine.stopPad(pad.id);
      setActivePadIds(prev => {
        const next = new Set(prev);
        next.delete(pad.id);
        return next;
      });
    } else {
      // In Single Mode (Default): stop any other currently playing pads immediately!
      if (playbackMode === 'single') {
        audioEngine.stopAll();
        setActivePadIds(new Set());
      }
      audioEngine.playPad(pad, (errorMsg) => {
        showNotification(errorMsg);
      });
    }
  }, [activePadIds, loadingPadIds, playbackMode]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in input or select
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleMasterFadeOut();
        return;
      }

      const key = e.key.toUpperCase();
      const matchedPad = pads.find(p => p.hotkey && p.hotkey.toUpperCase() === key);
      if (matchedPad) {
        e.preventDefault();
        handleTogglePad(matchedPad);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pads, handleTogglePad, handleMasterFadeOut]);

  // Update pad settings
  const handleUpdatePad = async (padId: string, updates: Partial<PadItem>) => {
    // Immediate optimistic local update
    setPads(prev => {
      const next = prev.map(p => p.id === padId ? { ...p, ...updates } : p);
      saveStoredPads(next);
      return next;
    });

    // Update ongoing audio parameters in real time if playing
    if (updates.volume !== undefined) {
      audioEngine.setPadVolume(padId, updates.volume);
    }
    if (updates.filterCutoff !== undefined) {
      audioEngine.setPadFilter(padId, updates.filterCutoff);
    }
    if (updates.pan !== undefined) {
      audioEngine.setPadPan(padId, updates.pan);
    }

    try {
      await updatePadOnServer(padId, updates);
    } catch (err: any) {
      console.warn('Sync notice:', err);
    }
  };

  // Delete pad
  const handleDeletePad = async (padId: string) => {
    if (activePadIds.has(padId)) {
      audioEngine.stopPad(padId, 0.1);
    }
    setPads(prev => {
      const next = prev.filter(p => p.id !== padId);
      saveStoredPads(next);
      return next;
    });
    showNotification('Pad removido da lista');

    try {
      await deletePadOnServer(padId);
      const updatedStats = await fetchCloudStats();
      setStats(updatedStats);
    } catch (err: any) {
      console.warn('Delete notice:', err);
    }
  };

  // Upload success
  const handleUploadSuccess = (newPads: PadItem[]) => {
    setPads(prev => {
      const next = [...prev, ...newPads];
      saveStoredPads(next);
      return next;
    });
    showNotification(`${newPads.length} novo(s) áudio(s) adicionado(s) com sucesso!`);
    fetchCloudStats().then(setStats).catch(console.error);
  };

  // Reset pads to standard 22
  const handleResetPads = async () => {
    setIsResetting(true);
    audioEngine.stopAll(0);
    try {
      const resetPads = await resetPadsOnServer();
      setPads(resetPads);
      const updatedStats = await fetchCloudStats();
      setStats(updatedStats);
      showNotification('Padrão de 22 pads restaurado com sucesso!');
    } catch (err: any) {
      showNotification('Erro ao restaurar pads');
    } finally {
      setIsResetting(false);
    }
  };

  // Remove system-added pads (leaves only user's own pads)
  const handleRemoveSystemPads = async () => {
    audioEngine.stopAll(0.1);
    try {
      const customOnly = await removeSystemPads();
      setPads(customOnly);
      showNotification('Pads do sistema removidos com sucesso!');
      const updatedStats = await fetchCloudStats();
      setStats(updatedStats);
    } catch {
      showNotification('Erro ao remover pads do sistema');
    }
  };

  // Clear all pads completely
  const handleClearAllPads = async () => {
    audioEngine.stopAll(0.1);
    try {
      await clearAllPads();
      setPads([]);
      showNotification('Todos os pads foram removidos.');
      const updatedStats = await fetchCloudStats();
      setStats(updatedStats);
    } catch {
      showNotification('Erro ao limpar pads');
    }
  };

  // Filtered Pads
  const filteredPads = useMemo(() => {
    return pads.filter(pad => {
      // Category filter
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'custom' && !pad.isCustomUpload) return false;
        if (selectedCategory !== 'custom' && pad.category !== selectedCategory) return false;
      }

      // Musical Key filter
      if (selectedKey !== 'all') {
        if (pad.musicalKey !== selectedKey) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = pad.name.toLowerCase().includes(query);
        const matchesKey = pad.musicalKey?.toLowerCase().includes(query);
        const matchesCategory = pad.category.toLowerCase().includes(query);
        const matchesBpm = pad.bpm?.toString().includes(query);
        if (!matchesName && !matchesKey && !matchesCategory && !matchesBpm) return false;
      }

      return true;
    });
  }, [pads, selectedCategory, selectedKey, searchQuery]);

  const categoryCounts = useMemo(() => {
    return {
      all: pads.length,
      worship: pads.filter(p => p.category === 'worship').length,
      ritmo: pads.filter(p => p.category === 'ritmo').length,
      percussao: pads.filter(p => p.category === 'percussao').length,
      custom: pads.filter(p => p.isCustomUpload).length,
    };
  }, [pads]);

  const musicalKeys = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-cyan-600 text-slate-950 font-semibold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-sm animate-bounce">
          <CheckCircle className="w-4 h-4" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Header */}
      <Header
        activeCount={activePadIds.size}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenCloudInfo={() => setIsCloudInfoOpen(true)}
        onMasterFadeOut={handleMasterFadeOut}
        isFadingOut={isFadingOut}
        totalPadsCount={pads.length}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-5 py-2.5 sm:py-3.5 space-y-2.5 sm:space-y-3">
        {/* Top Control Bar: Audio Visualizer & Metronome */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 sm:gap-3 items-center">
          <div className="lg:col-span-2">
            <Visualizer activeCount={activePadIds.size} />
          </div>
          <div className="flex items-center justify-between lg:justify-end gap-2">
            <Metronome />
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5 sm:p-3 shadow-sm space-y-2.5">
          {/* Search, Categories, and Mode Toggle */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="search-pads-input"
                type="text"
                placeholder="Buscar pad por nome, tom (C, D, G...), ritmo ou BPM..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-700/60 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Playback Mode Selector & Quick Action Buttons */}
            <div className="flex items-center flex-wrap gap-2">
              {/* Playback Mode: Individual vs Sobreposição */}
              <div className="flex items-center p-1 bg-slate-950/80 border border-slate-800 rounded-xl text-xs gap-1">
                <button
                  id="btn-mode-single"
                  onClick={() => {
                    setPlaybackMode('single');
                    if (activePadIds.size > 1) {
                      audioEngine.stopAll();
                      setActivePadIds(new Set());
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                    playbackMode === 'single'
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Modo Individual: ao dar Play em um áudio, para os outros automaticamente"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Modo Individual</span>
                </button>

                <button
                  id="btn-mode-multi"
                  onClick={() => setPlaybackMode('multi')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                    playbackMode === 'multi'
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Modo Sobreposição: permite disparar múltiplos áudios ao mesmo tempo"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Sobreposição</span>
                </button>
              </div>

              {/* Instant Stop All Button */}
              {(activePadIds.size > 0 || loadingPadIds.size > 0) && (
                <button
                  id="btn-stop-all-active"
                  onClick={handleMasterFadeOut}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/30 transition-all cursor-pointer animate-pulse"
                  title="Parar toda a execução imediatamente"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Parar Tudo ({activePadIds.size})</span>
                </button>
              )}

              {/* If any system pad exists, show 1-click removal */}
              {pads.some(p => !p.isCustomUpload) && (
                <button
                  id="btn-remove-system-pads"
                  onClick={handleRemoveSystemPads}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold flex items-center gap-1.5 border border-rose-500/30 transition-colors cursor-pointer"
                  title="Remover pads padrão do sistema"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remover Sistema</span>
                </button>
              )}

              {/* Add Custom Audio */}
              <button
                id="btn-upload-pads"
                onClick={() => setIsUploadOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-cyan-500/20 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar Áudios</span>
              </button>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                selectedCategory === 'all'
                  ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md shadow-cyan-500/20'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Todos os Pads ({categoryCounts.all})</span>
            </button>

            <button
              onClick={() => setSelectedCategory('worship')}
              className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                selectedCategory === 'worship'
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/20'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Pads Contínuos / Worship ({categoryCounts.worship})</span>
            </button>

            <button
              onClick={() => setSelectedCategory('ritmo')}
              className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                selectedCategory === 'ritmo'
                  ? 'bg-sky-500 text-slate-950 font-semibold shadow-md shadow-sky-500/20'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Ritmos & Loops ({categoryCounts.ritmo})</span>
            </button>

            <button
              onClick={() => setSelectedCategory('percussao')}
              className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                selectedCategory === 'percussao'
                  ? 'bg-emerald-500 text-slate-950 font-semibold shadow-md shadow-emerald-500/20'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>Percussão & Bateria ({categoryCounts.percussao})</span>
            </button>

            {categoryCounts.custom > 0 && (
              <button
                onClick={() => setSelectedCategory('custom')}
                className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedCategory === 'custom'
                    ? 'bg-rose-500 text-white font-semibold shadow-md shadow-rose-500/20'
                    : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Meus Uploads ({categoryCounts.custom})</span>
              </button>
            )}
          </div>

          {/* Quick Key Filter (Piano Keys Row) */}
          <div className="flex items-center gap-1 overflow-x-auto pt-1 border-t border-slate-800/60 text-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider pr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Tom:
            </span>
            <button
              onClick={() => setSelectedKey('all')}
              className={`px-2 py-1 rounded-lg text-xs font-mono transition-colors ${
                selectedKey === 'all'
                  ? 'bg-slate-700 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Todos
            </button>
            {musicalKeys.map(k => (
              <button
                key={k}
                onClick={() => setSelectedKey(selectedKey === k ? 'all' : k)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                  selectedKey === k
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/30'
                    : 'bg-slate-950/60 text-slate-300 border border-slate-800 hover:border-slate-700 hover:text-white'
                }`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        {/* Pads Grid Area */}
        {loading ? (
          <div className="py-24 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-400">Carregando lista de pads...</p>
          </div>
        ) : pads.length === 0 ? (
          <div className="py-16 sm:py-20 px-6 text-center max-w-lg mx-auto bg-slate-900/40 rounded-2xl border border-slate-800/80 shadow-xl space-y-4 my-4">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
              <UploadCloud className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base sm:text-lg font-bold text-slate-100">Pronto para seus próprios pads!</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Os pads padrão do sistema foram removidos. Adicione seus próprios arquivos de áudio (MP3, WAV, M4A, OGG) para criar seu repertório personalizado.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <button
                id="btn-add-first-pads"
                onClick={() => setIsUploadOpen(true)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar Meus Primeiros Áudios</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Arraste ou selecione múltiplos arquivos. O sistema detecta tom e BPM automaticamente!
            </p>
          </div>
        ) : filteredPads.length === 0 ? (
          <div className="py-20 text-center space-y-3 bg-slate-900/30 rounded-2xl border border-slate-800">
            <Music className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="font-semibold text-slate-300">Nenhum pad encontrado</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Nenhum pad corresponde aos filtros atuais. Tente limpar a busca ou adicione novos arquivos de áudio.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedKey('all');
              }}
              className="px-4 py-2 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Limpar Filtros
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {filteredPads.map(pad => (
              <PadCard
                key={pad.id}
                pad={pad}
                isPlaying={activePadIds.has(pad.id)}
                isLoading={loadingPadIds.has(pad.id)}
                onTogglePlay={handleTogglePad}
                onUpdatePad={handleUpdatePad}
                onDeletePad={handleDeletePad}
                onEditPad={(p) => setEditingPad(p)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />

      <PadEditModal
        pad={editingPad}
        isOpen={!!editingPad}
        onClose={() => setEditingPad(null)}
        onSave={handleUpdatePad}
      />

      <CloudStorageInfo
        isOpen={isCloudInfoOpen}
        onClose={() => setIsCloudInfoOpen(false)}
        stats={stats}
        pads={pads}
        onResetPads={handleResetPads}
        onRemoveSystemPads={handleRemoveSystemPads}
        onClearAll={handleClearAllPads}
        isResetting={isResetting}
      />

      {/* Footer info bar */}
      <footer className="w-full bg-slate-950 border-t border-slate-900 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-2">
            <span>Pads de Áudio em Nuvem</span>
            <span>•</span>
            <span>{pads.length} pads disponíveis para uso público</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-[11px] text-slate-600">
              Espaço em Nuvem • Teclas [1-0, Q-P, A-S] • Barra de espaço: Fade Out
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
