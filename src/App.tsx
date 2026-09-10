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
import { NowPlayingDock } from './components/NowPlayingDock';

export default function App() {
  const [pads, setPads] = useState<PadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePadIds, setActivePadIds] = useState<Set<string>>(new Set());
  const [loadingPadIds, setLoadingPadIds] = useState<Set<string>>(new Set());
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
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fullscreen controllers with multi-browser support
  const requestAppFullscreen = useCallback(() => {
    try {
      const doc = document as any;
      const docEl = document.documentElement as any;
      if (!doc.fullscreenElement && !doc.webkitFullscreenElement && !doc.mozFullScreenElement && !doc.msFullscreenElement) {
        if (docEl.requestFullscreen) {
          docEl.requestFullscreen().catch(() => {});
        } else if (docEl.webkitRequestFullscreen) {
          docEl.webkitRequestFullscreen();
        } else if (docEl.mozRequestFullScreen) {
          docEl.mozRequestFullScreen();
        } else if (docEl.msRequestFullscreen) {
          docEl.msRequestFullscreen();
        }
      }
    } catch {
      // Handled silently
    }
  }, []);

  const exitAppFullscreen = useCallback(() => {
    try {
      const doc = document as any;
      if (doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement) {
        if (doc.exitFullscreen) {
          doc.exitFullscreen().catch(() => {});
        } else if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          doc.msExitFullscreen();
        }
      }
    } catch {
      // Handled silently
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    const doc = document as any;
    const isCurrentlyFull = Boolean(
      doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement
    );
    if (isCurrentlyFull) {
      exitAppFullscreen();
    } else {
      requestAppFullscreen();
    }
  }, [requestAppFullscreen, exitAppFullscreen]);

  // Fullscreen state listener and auto-fullscreen on open / first user interaction
  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      setIsFullscreen(Boolean(
        doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement
      ));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // Attempt fullscreen immediately upon load
    requestAppFullscreen();

    // Standard browsers require a user interaction gesture to enter fullscreen.
    // Trigger fullscreen automatically on the first touch or click on screen!
    const triggerFullscreenOnFirstGesture = () => {
      const doc = document as any;
      if (!doc.fullscreenElement && !doc.webkitFullscreenElement && !doc.mozFullScreenElement && !doc.msFullscreenElement) {
        requestAppFullscreen();
      }
    };

    window.addEventListener('pointerdown', triggerFullscreenOnFirstGesture, { once: true, passive: true });
    window.addEventListener('touchstart', triggerFullscreenOnFirstGesture, { once: true, passive: true });

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      window.removeEventListener('pointerdown', triggerFullscreenOnFirstGesture);
      window.removeEventListener('touchstart', triggerFullscreenOnFirstGesture);
    };
  }, [requestAppFullscreen]);
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

  // Toggle play for a pad - strictly individual
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
      // Strictly individual: stop any other playing pads immediately so they never overlap!
      audioEngine.stopAll();
      setActivePadIds(new Set());
      audioEngine.playPad(pad, (errorMsg) => {
        showNotification(errorMsg);
      });
    }
  }, [activePadIds, loadingPadIds]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Bloquear atualização da página no F11 e redirecionar para tela cheia controlada pelo aplicativo
      if (e.key === 'F11' || e.code === 'F11') {
        e.preventDefault();
        e.stopPropagation();
        toggleFullscreen();
        return;
      }

      // Bloquear atualização acidental por F5, Ctrl+R ou Cmd+R durante o uso/performance
      if (
        e.key === 'F5' ||
        ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'))
      ) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

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

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [pads, handleTogglePad, handleMasterFadeOut, toggleFullscreen]);

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

  // Current active pad for bottom floating dock
  const currentActivePad = useMemo(() => {
    return pads.find(p => activePadIds.has(p.id)) || pads.find(p => loadingPadIds.has(p.id)) || null;
  }, [pads, activePadIds, loadingPadIds]);

  const handleTogglePadLoop = useCallback((padId: string) => {
    const pad = pads.find(p => p.id === padId);
    if (pad) {
      handleUpdatePad(padId, { isLoop: !pad.isLoop });
    }
  }, [pads, handleUpdatePad]);

  return (
    <div
      className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black notranslate"
      translate="no"
    >
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-16 inset-x-4 max-w-sm mx-auto z-50 bg-cyan-600 text-slate-950 font-bold px-4 py-2.5 rounded-2xl shadow-2xl flex items-center justify-center gap-2 text-xs sm:text-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span className="truncate">{notification}</span>
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
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      {/* Main Container - Mobile & Tablet Pro Dimensions */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-2.5 sm:px-4 py-2.5 sm:py-3.5 pb-28 sm:pb-32 space-y-2.5 sm:space-y-3">
        {/* Compact Studio Toolstrip: Visualizer & Metronome */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
          <Visualizer activeCount={activePadIds.size} />
          <Metronome />
        </div>

        {/* Search, Categories & Quick Key Filter */}
        <div className="bg-[#0f1422]/95 border border-slate-800/80 rounded-2xl p-2.5 sm:p-3 shadow-sm space-y-2.5">
          {/* Search & Main Add Button */}
          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="search-pads-input"
                type="text"
                placeholder="Buscar por nome, tom (C, D, G...), BPM..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-950/80 border border-slate-700/60 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white p-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Action: Add New Pads */}
            <button
              id="btn-upload-pads"
              onClick={() => setIsUploadOpen(true)}
              className="h-9 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer shrink-0"
              title="Adicionar novos arquivos de áudio"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden xs:inline">Adicionar</span>
            </button>

            {/* If any system pad exists, show 1-click removal */}
            {pads.some(p => !p.isCustomUpload) && (
              <button
                id="btn-remove-system-pads"
                onClick={handleRemoveSystemPads}
                className="h-9 px-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold flex items-center gap-1 border border-rose-500/30 transition-colors cursor-pointer shrink-0 active:scale-95"
                title="Remover pads padrão do sistema"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Limpar Padrão</span>
              </button>
            )}
          </div>

          {/* Quick Musical Key Filter (Touch Slider with smooth scrolling) */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pr-1 flex items-center gap-1 shrink-0">
              <Filter className="w-3 h-3" /> Tom:
            </span>
            <button
              onClick={() => setSelectedKey('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all shrink-0 active:scale-95 ${
                selectedKey === 'all'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              Todos
            </button>
            {musicalKeys.map(k => (
              <button
                key={k}
                onClick={() => setSelectedKey(selectedKey === k ? 'all' : k)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all shrink-0 active:scale-95 ${
                  selectedKey === k
                    ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/30'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700 hover:text-white'
                }`}
              >
                {k}
              </button>
            ))}
          </div>

          {/* Category Tabs Carousel */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5 text-xs">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-xl font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 active:scale-95 ${
                selectedCategory === 'all'
                  ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Todos ({categoryCounts.all})</span>
            </button>

            <button
              onClick={() => setSelectedCategory('worship')}
              className={`px-3 py-1 rounded-xl font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 active:scale-95 ${
                selectedCategory === 'worship'
                  ? 'bg-slate-800 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Worship ({categoryCounts.worship})</span>
            </button>

            <button
              onClick={() => setSelectedCategory('ritmo')}
              className={`px-3 py-1 rounded-xl font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 active:scale-95 ${
                selectedCategory === 'ritmo'
                  ? 'bg-slate-800 text-sky-300 border border-sky-500/40'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800/60'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Ritmos ({categoryCounts.ritmo})</span>
            </button>

            <button
              onClick={() => setSelectedCategory('percussao')}
              className={`px-3 py-1 rounded-xl font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 active:scale-95 ${
                selectedCategory === 'percussao'
                  ? 'bg-slate-800 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800/60'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>Percussão ({categoryCounts.percussao})</span>
            </button>

            {categoryCounts.custom > 0 && (
              <button
                onClick={() => setSelectedCategory('custom')}
                className={`px-3 py-1 rounded-xl font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 active:scale-95 ${
                  selectedCategory === 'custom'
                    ? 'bg-slate-800 text-rose-300 border border-rose-500/40'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800/60'
                }`}
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Meus Uploads ({categoryCounts.custom})</span>
              </button>
            )}
          </div>
        </div>

        {/* Touch Pads Grid - 2 cols on mobile, 3-4 cols on tablet */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Carregando pads...</p>
          </div>
        ) : pads.length === 0 ? (
          <div className="py-12 sm:py-16 px-4 text-center max-w-md mx-auto bg-[#101524] rounded-2xl border border-slate-800 shadow-xl space-y-4 my-2">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
              <UploadCloud className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-100">Pronto para seus próprios pads</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Adicione seus arquivos de áudio (MP3, WAV, M4A, OGG) para montar seu kit personalizado para celular ou tablet.
              </p>
            </div>
            <button
              id="btn-add-first-pads"
              onClick={() => setIsUploadOpen(true)}
              className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Meus Áudios</span>
            </button>
          </div>
        ) : filteredPads.length === 0 ? (
          <div className="py-16 text-center space-y-3 bg-slate-900/30 rounded-2xl border border-slate-800">
            <Music className="w-8 h-8 text-slate-600 mx-auto" />
            <h3 className="font-semibold text-sm text-slate-300">Nenhum pad encontrado</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Tente selecionar outro tom ou limpar a busca.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedKey('all');
              }}
              className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 active:scale-95 transition-colors"
            >
              Limpar Filtros
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3.5">
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

      {/* Floating Now Playing Bottom Bar for Mobile & Tablet */}
      <NowPlayingDock
        activePad={currentActivePad}
        isLoading={currentActivePad ? loadingPadIds.has(currentActivePad.id) : false}
        onStop={handleMasterFadeOut}
        onToggleLoop={currentActivePad ? () => handleTogglePadLoop(currentActivePad.id) : undefined}
        isLoop={currentActivePad?.isLoop}
      />

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
    </div>
  );
}
