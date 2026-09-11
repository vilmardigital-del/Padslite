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
  VolumeX,
  ListMusic
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
import { PresentationView } from './components/PresentationView';
import { PlaylistModal } from './components/PlaylistModal';

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

  // Presentation Playlist state
  const [playlistPadIds, setPlaylistPadIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pads_presentation_playlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(false);

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isCloudInfoOpen, setIsCloudInfoOpen] = useState(false);
  const [editingPad, setEditingPad] = useState<PadItem | null>(null);
  const [stats, setStats] = useState<CloudStorageStats | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVirtualFullscreen, setIsVirtualFullscreen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  }, []);

  // Fullscreen controller supporting Native Fullscreen API + Immersive Virtual Fullscreen fallback
  const toggleFullscreen = useCallback(async () => {
    const doc = document as any;
    const docEl = document.documentElement as any;

    const isNativeFull = Boolean(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );

    // If currently active in either native or virtual mode, exit
    if (isNativeFull || isVirtualFullscreen) {
      if (isNativeFull) {
        try {
          if (doc.exitFullscreen) {
            await doc.exitFullscreen();
          } else if (doc.webkitExitFullscreen) {
            doc.webkitExitFullscreen();
          } else if (doc.mozCancelFullScreen) {
            doc.mozCancelFullScreen();
          } else if (doc.msExitFullscreen) {
            doc.msExitFullscreen();
          }
        } catch {
          // Ignore exit error
        }
      }
      setIsVirtualFullscreen(false);
      setIsFullscreen(false);
      showNotification('Modo janela restaurado');
      return;
    }

    // Try to enter native fullscreen
    let enteredNative = false;
    try {
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
        enteredNative = true;
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
        enteredNative = true;
      } else if (docEl.mozRequestFullScreen) {
        docEl.mozRequestFullScreen();
        enteredNative = true;
      } else if (docEl.msRequestFullscreen) {
        docEl.msRequestFullscreen();
        enteredNative = true;
      }
    } catch {
      enteredNative = false;
    }

    if (enteredNative) {
      setIsFullscreen(true);
      setIsVirtualFullscreen(false);
      showNotification('Tela cheia ativada');
    } else {
      // Fallback: activate virtual immersive mode (works inside iframes and unsupported browsers)
      setIsVirtualFullscreen(true);
      setIsFullscreen(true);
      const isIframe = window.self !== window.top;
      if (isIframe) {
        showNotification('Tela cheia ativada no app! Para tela cheia do monitor, abra em nova aba.');
      } else {
        showNotification('Modo tela cheia ativado');
      }
    }
  }, [isVirtualFullscreen, showNotification]);

  // Fullscreen state listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      const isNative = Boolean(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      if (isNative) {
        setIsFullscreen(true);
      } else if (!isVirtualFullscreen) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [isVirtualFullscreen]);

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

  // Playlist actions
  const updatePlaylistPadIds = useCallback((newIds: string[]) => {
    setPlaylistPadIds(newIds);
    try {
      localStorage.setItem('pads_presentation_playlist', JSON.stringify(newIds));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleTogglePadInPlaylist = useCallback((padId: string) => {
    setPlaylistPadIds(prev => {
      let next: string[];
      if (prev.includes(padId)) {
        next = prev.filter(id => id !== padId);
        showNotification('Áudio removido da apresentação');
      } else {
        next = [...prev, padId];
        showNotification('Áudio escalado para a apresentação!');
      }
      try {
        localStorage.setItem('pads_presentation_playlist', JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  }, [showNotification]);

  const handleStartPresentation = useCallback(() => {
    if (playlistPadIds.length === 0) {
      setIsPlaylistModalOpen(true);
      showNotification('Selecione primeiro os áudios da apresentação');
      return;
    }
    setIsPresentationMode(true);
    if (!isFullscreen) {
      toggleFullscreen();
    }
    showNotification('Modo Apresentação ativado!');
  }, [playlistPadIds.length, isFullscreen, toggleFullscreen, showNotification]);

  const handleExitPresentation = useCallback(() => {
    setIsPresentationMode(false);
    showNotification('Apresentação finalizada');
  }, [showNotification]);

  // Scaled pads for presentation
  const playlistPads = useMemo(() => {
    return playlistPadIds
      .map(id => pads.find(p => p.id === id))
      .filter((p): p is PadItem => Boolean(p));
  }, [playlistPadIds, pads]);

  // Filtered Pads
  const filteredPads = useMemo(() => {
    return pads.filter(pad => {
      // Category filter
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'presentation') {
          if (!playlistPadIds.includes(pad.id)) return false;
        } else if (selectedCategory === 'custom') {
          if (!pad.isCustomUpload) return false;
        } else if (pad.category !== selectedCategory) {
          return false;
        }
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
  }, [pads, selectedCategory, selectedKey, searchQuery, playlistPadIds]);

  const categoryCounts = useMemo(() => {
    return {
      all: pads.length,
      worship: pads.filter(p => p.category === 'worship').length,
      ritmo: pads.filter(p => p.category === 'ritmo').length,
      percussao: pads.filter(p => p.category === 'percussao').length,
      custom: pads.filter(p => p.isCustomUpload).length,
      presentation: playlistPadIds.length,
    };
  }, [pads, playlistPadIds.length]);

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

  // FULLSCREEN PRESENTATION MODE - Sem cabeçalho, sem rodapé, apenas os áudios escalados!
  if (isPresentationMode) {
    return (
      <>
        <PresentationView
          playlistPads={playlistPads}
          activePadIds={activePadIds}
          loadingPadIds={loadingPadIds}
          onTogglePlay={handleTogglePad}
          onMasterFadeOut={handleMasterFadeOut}
          onExit={handleExitPresentation}
          onOpenPlaylistManager={() => setIsPlaylistModalOpen(true)}
          onTogglePadLoop={handleTogglePadLoop}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
        />
        <PlaylistModal
          isOpen={isPlaylistModalOpen}
          onClose={() => setIsPlaylistModalOpen(false)}
          allPads={pads}
          playlistPadIds={playlistPadIds}
          onUpdatePlaylist={updatePlaylistPadIds}
          onStartPresentation={handleStartPresentation}
        />
      </>
    );
  }

  return (
    <div
      className={`min-h-screen text-amber-50 flex flex-col font-sans selection:bg-amber-400 selection:text-black notranslate ${
        isVirtualFullscreen ? 'fixed inset-0 z-50 overflow-y-auto w-full h-full' : 'w-full'
      }`}
      style={{
        background: 'radial-gradient(ellipse at 15% 15%, rgba(245, 158, 11, 0.22) 0%, transparent 55%), radial-gradient(ellipse at 85% 85%, rgba(234, 88, 12, 0.26) 0%, transparent 55%), radial-gradient(ellipse at 50% 30%, rgba(251, 191, 36, 0.12) 0%, transparent 70%), linear-gradient(140deg, #1a0800 0%, #2c0e00 25%, #421903 50%, #2a0f01 75%, #180700 100%)',
        backgroundAttachment: 'fixed',
      }}
      translate="no"
    >
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-16 inset-x-4 max-w-sm mx-auto z-50 bg-amber-500 text-slate-950 font-bold px-4 py-2.5 rounded-2xl shadow-2xl flex items-center justify-center gap-2 text-xs sm:text-sm animate-in fade-in slide-in-from-top-2 duration-200 border border-amber-300/40">
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
        onOpenPlaylist={() => setIsPlaylistModalOpen(true)}
        playlistCount={playlistPadIds.length}
      />

      {/* Main Container - Mobile & Tablet Pro Dimensions */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-2.5 sm:px-4 py-2.5 sm:py-3.5 pb-28 sm:pb-32 space-y-2.5 sm:space-y-3">
        {/* Compact Studio Toolstrip: Visualizer & Metronome */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
          <Visualizer activeCount={activePadIds.size} />
          <Metronome />
        </div>

        {/* Search, Categories & Quick Key Filter */}
        <div className="bg-[#220d02]/90 border border-amber-700/35 rounded-2xl p-2.5 sm:p-3 shadow-lg shadow-orange-950/40 space-y-2.5 backdrop-blur-md">
          {/* Search & Main Add Button */}
          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-amber-500/70 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="search-pads-input"
                type="text"
                placeholder="Buscar por nome, tom (C, D, G...), BPM..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-[#140600]/90 border border-amber-800/50 rounded-xl text-xs sm:text-sm text-amber-100 placeholder-amber-600/60 focus:outline-none focus:border-amber-400 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-amber-400 hover:text-white p-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Action: Add New Pads */}
            <button
              id="btn-upload-pads"
              onClick={() => setIsUploadOpen(true)}
              className="h-9 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-orange-500/20 active:scale-95 transition-all cursor-pointer shrink-0"
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
            <span className="text-[10px] font-bold text-amber-400/80 uppercase tracking-wider pr-1 flex items-center gap-1 shrink-0">
              <Filter className="w-3 h-3 text-amber-400" /> Tom:
            </span>
            <button
              onClick={() => setSelectedKey('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all shrink-0 active:scale-95 ${
                selectedKey === 'all'
                  ? 'bg-amber-400 text-slate-950 shadow-sm shadow-amber-500/40'
                  : 'bg-[#180700] text-amber-300/80 border border-amber-900/60 hover:text-white hover:border-amber-700'
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
                    ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 shadow-sm shadow-amber-500/30 font-black'
                    : 'bg-[#180700] text-amber-200/90 border border-amber-900/60 hover:border-amber-500/60 hover:text-white'
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
                  ? 'bg-amber-500/25 text-amber-200 border border-amber-500/50 shadow-xs'
                  : 'bg-[#180700]/70 text-amber-400/70 hover:text-amber-200 border border-amber-900/50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Todos ({categoryCounts.all})</span>
            </button>

            <button
              onClick={() => setSelectedCategory('worship')}
              className={`px-3 py-1 rounded-xl font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 active:scale-95 ${
                selectedCategory === 'worship'
                  ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-xs'
                  : 'bg-[#180700]/70 text-amber-400/70 hover:text-amber-200 border border-amber-900/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Worship ({categoryCounts.worship})</span>
            </button>

            <button
              onClick={() => setSelectedCategory('ritmo')}
              className={`px-3 py-1 rounded-xl font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 active:scale-95 ${
                selectedCategory === 'ritmo'
                  ? 'bg-orange-500/25 text-orange-200 border border-orange-500/50 shadow-xs'
                  : 'bg-[#180700]/70 text-amber-400/70 hover:text-amber-200 border border-amber-900/50'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-orange-400" />
              <span>Ritmos ({categoryCounts.ritmo})</span>
            </button>

            <button
              onClick={() => setSelectedCategory('percussao')}
              className={`px-3 py-1 rounded-xl font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 active:scale-95 ${
                selectedCategory === 'percussao'
                  ? 'bg-amber-600/25 text-amber-200 border border-amber-600/50 shadow-xs'
                  : 'bg-[#180700]/70 text-amber-400/70 hover:text-amber-200 border border-amber-900/50'
              }`}
            >
              <Music className="w-3.5 h-3.5 text-amber-400" />
              <span>Percussão ({categoryCounts.percussao})</span>
            </button>

            {/* Presentation Playlist Tab */}
            <button
              id="tab-presentation-playlist"
              onClick={() => setSelectedCategory('presentation')}
              className={`px-3 py-1 rounded-xl font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 active:scale-95 ${
                selectedCategory === 'presentation'
                  ? 'bg-amber-500 text-slate-950 font-bold border border-amber-400 shadow-sm'
                  : 'bg-[#180700]/70 text-amber-400 hover:text-amber-200 border border-amber-900/50'
              }`}
            >
              <ListMusic className="w-3.5 h-3.5" />
              <span>Apresentação ({categoryCounts.presentation})</span>
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

          {/* Quick Launch Banner when on Presentation Tab */}
          {selectedCategory === 'presentation' && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs">
              <span className="text-amber-200 font-medium">
                {playlistPads.length} áudio(s) escalado(s) para o palco
              </span>
              <button
                type="button"
                id="btn-launch-presentation-banner"
                onClick={handleStartPresentation}
                disabled={playlistPads.length === 0}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-40"
              >
                <ListMusic className="w-3.5 h-3.5" />
                <span>Abrir Apresentação (Tela Cheia)</span>
              </button>
            </div>
          )}
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
              {selectedCategory === 'presentation'
                ? 'Nenhum áudio foi escalado para a apresentação ainda. Clique no ícone de lista nos pads para adicionar.'
                : 'Tente selecionar outro tom ou limpar a busca.'}
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedKey('all');
              }}
              className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 active:scale-95 transition-colors"
            >
              Ver Todos os Pads
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
                isInPlaylist={playlistPadIds.includes(pad.id)}
                onTogglePlay={handleTogglePad}
                onUpdatePad={handleUpdatePad}
                onDeletePad={handleDeletePad}
                onEditPad={(p) => setEditingPad(p)}
                onTogglePlaylist={handleTogglePadInPlaylist}
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
      <PlaylistModal
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
        allPads={pads}
        playlistPadIds={playlistPadIds}
        onUpdatePlaylist={updatePlaylistPadIds}
        onStartPresentation={handleStartPresentation}
      />

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
        initialCategory={selectedCategory === 'ritmo' || selectedCategory === 'percussao' ? selectedCategory : 'worship'}
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
