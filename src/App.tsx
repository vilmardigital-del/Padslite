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
      className={`min-h-screen text-orange-50 flex flex-col font-sans selection:bg-orange-500 selection:text-black notranslate ${
        isVirtualFullscreen ? 'fixed inset-0 z-50 overflow-y-auto w-full h-full' : 'w-full'
      }`}
      style={{
        background: 'radial-gradient(circle at 10% 15%, rgba(255, 140, 0, 0.42) 0%, transparent 45%), radial-gradient(circle at 90% 85%, rgba(249, 115, 22, 0.38) 0%, transparent 50%), radial-gradient(circle at 50% 40%, rgba(251, 146, 60, 0.22) 0%, transparent 60%), linear-gradient(135deg, #381200 0%, #5e1e00 25%, #882e00 50%, #521900 75%, #290b00 100%)',
        backgroundAttachment: 'fixed',
      }}
      translate="no"
    >
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-16 inset-x-4 max-w-sm mx-auto z-50 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 text-slate-950 font-black px-4 py-2.5 rounded-2xl shadow-[0_0_25px_rgba(249,115,22,0.6)] flex items-center justify-center gap-2 text-xs sm:text-sm animate-in fade-in slide-in-from-top-2 duration-200 border border-amber-300">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span className="truncate font-mono">{notification}</span>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
          <Visualizer activeCount={activePadIds.size} />
          <Metronome />
        </div>

        {/* Search, Categories & Quick Key Filter */}
        <div className="bg-[#270b00]/90 border border-orange-500/40 rounded-2xl p-2.5 sm:p-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)] space-y-2.5 backdrop-blur-2xl">
          {/* Search & Main Add Button */}
          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-orange-400/80 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="search-pads-input"
                type="text"
                placeholder="Buscar áudio por nome, tom (C, D, G...), BPM..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-[#170500]/95 border border-orange-500/40 rounded-xl text-xs sm:text-sm text-orange-100 placeholder-orange-400/50 focus:outline-none focus:border-orange-400 transition-colors shadow-inner font-mono"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-orange-400 hover:text-white p-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Action: Add New Pads (Futuristic Neon Button) */}
            <button
              id="btn-upload-pads"
              onClick={() => setIsUploadOpen(true)}
              className="h-9 px-3.5 rounded-xl bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 hover:from-amber-300 hover:to-orange-400 text-slate-950 text-xs font-mono font-black flex items-center gap-1.5 shadow-[0_0_15px_rgba(249,115,22,0.5)] border border-amber-300 active:scale-95 transition-all cursor-pointer shrink-0"
              title="Adicionar novos arquivos de áudio"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden xs:inline">ADICIONAR</span>
            </button>

            {/* If any system pad exists, show 1-click removal */}
            {pads.some(p => !p.isCustomUpload) && (
              <button
                id="btn-remove-system-pads"
                onClick={handleRemoveSystemPads}
                className="h-9 px-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold flex items-center gap-1 border border-rose-500/40 transition-colors cursor-pointer shrink-0 active:scale-95"
                title="Remover pads padrão do sistema"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Limpar Padrão</span>
              </button>
            )}
          </div>

          {/* Quick Musical Key Filter (Touch Slider with smooth scrolling) */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5 text-xs">
            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider pr-1 flex items-center gap-1 shrink-0 font-mono">
              <Filter className="w-3 h-3 text-orange-400" /> TOM:
            </span>
            <button
              onClick={() => setSelectedKey('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all shrink-0 active:scale-95 cursor-pointer ${
                selectedKey === 'all'
                  ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 shadow-[0_0_10px_rgba(249,115,22,0.5)] font-black'
                  : 'bg-[#1a0600] text-orange-200/80 border border-orange-500/30 hover:text-white hover:border-orange-400'
              }`}
            >
              TODOS
            </button>
            {musicalKeys.map(k => (
              <button
                key={k}
                onClick={() => setSelectedKey(selectedKey === k ? 'all' : k)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all shrink-0 active:scale-95 cursor-pointer ${
                  selectedKey === k
                    ? 'bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 text-slate-950 shadow-[0_0_12px_rgba(249,115,22,0.5)] font-black border border-orange-300'
                    : 'bg-[#1a0600] text-orange-200 border border-orange-500/30 hover:border-orange-400 hover:text-white'
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
              className={`px-3 py-1.5 rounded-xl font-mono font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-orange-500/30 text-orange-200 border border-orange-400/70 shadow-[0_0_10px_rgba(249,115,22,0.25)]'
                  : 'bg-[#1a0600]/80 text-orange-300/70 hover:text-orange-100 border border-orange-500/25'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-orange-400" />
              <span>Todos ({categoryCounts.all})</span>
            </button>

            <button
              onClick={() => setSelectedCategory('worship')}
              className={`px-3 py-1.5 rounded-xl font-mono font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer ${
                selectedCategory === 'worship'
                  ? 'bg-amber-500/30 text-amber-200 border border-amber-400/70 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                  : 'bg-[#1a0600]/80 text-orange-300/70 hover:text-orange-100 border border-orange-500/25'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Worship ({categoryCounts.worship})</span>
            </button>

            <button
              onClick={() => setSelectedCategory('ritmo')}
              className={`px-3 py-1.5 rounded-xl font-mono font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer ${
                selectedCategory === 'ritmo'
                  ? 'bg-orange-500/30 text-orange-200 border border-orange-400/70 shadow-[0_0_10px_rgba(249,115,22,0.3)]'
                  : 'bg-[#1a0600]/80 text-orange-300/70 hover:text-orange-100 border border-orange-500/25'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-orange-400" />
              <span>Ritmos ({categoryCounts.ritmo})</span>
            </button>

            <button
              onClick={() => setSelectedCategory('percussao')}
              className={`px-3 py-1.5 rounded-xl font-mono font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer ${
                selectedCategory === 'percussao'
                  ? 'bg-amber-600/30 text-amber-200 border border-amber-500/70 shadow-[0_0_10px_rgba(217,119,6,0.3)]'
                  : 'bg-[#1a0600]/80 text-orange-300/70 hover:text-orange-100 border border-orange-500/25'
              }`}
            >
              <Music className="w-3.5 h-3.5 text-amber-400" />
              <span>Percussão ({categoryCounts.percussao})</span>
            </button>

            {/* Presentation Playlist Tab (Palco) */}
            <button
              id="tab-presentation-playlist"
              onClick={() => setSelectedCategory('presentation')}
              className={`px-3 py-1.5 rounded-xl font-mono font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer ${
                selectedCategory === 'presentation'
                  ? 'bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 text-slate-950 font-black border border-amber-300 shadow-[0_0_15px_rgba(249,115,22,0.4)]'
                  : 'bg-[#1a0600]/80 text-orange-300 hover:text-white border border-orange-500/30'
              }`}
            >
              <ListMusic className="w-3.5 h-3.5" />
              <span>Palco ({categoryCounts.presentation})</span>
            </button>

            {categoryCounts.custom > 0 && (
              <button
                onClick={() => setSelectedCategory('custom')}
                className={`px-3 py-1.5 rounded-xl font-mono font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer ${
                  selectedCategory === 'custom'
                    ? 'bg-orange-500/30 text-orange-200 border border-orange-400'
                    : 'bg-[#1a0600]/80 text-orange-400/70 hover:text-orange-200 border border-orange-500/25'
                }`}
              >
                <Cloud className="w-3.5 h-3.5 text-orange-400" />
                <span>Uploads ({categoryCounts.custom})</span>
              </button>
            )}
          </div>

          {/* Quick Launch Banner when on Presentation Tab */}
          {selectedCategory === 'presentation' && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-orange-500/20 via-amber-500/15 to-orange-500/20 border border-orange-500/40 text-xs shadow-inner">
              <span className="text-orange-200 font-mono font-semibold">
                {playlistPads.length} áudio(s) escalado(s) para o palco
              </span>
              <button
                type="button"
                id="btn-launch-presentation-banner"
                onClick={handleStartPresentation}
                disabled={playlistPads.length === 0}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-mono font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-40 shadow-[0_0_15px_rgba(249,115,22,0.4)] border border-amber-300"
              >
                <ListMusic className="w-3.5 h-3.5" />
                <span>Entrar no Palco (Tela Cheia)</span>
              </button>
            </div>
          )}
        </div>

        {/* Touch Pads Grid - 2 cols on mobile, 3-4 cols on tablet */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-9 h-9 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto shadow-[0_0_15px_rgba(249,115,22,0.5)]" />
            <p className="text-xs font-mono text-orange-300/80">INICIALIZANDO MOTOR DSP...</p>
          </div>
        ) : pads.length === 0 ? (
          <div className="py-12 sm:py-16 px-4 text-center max-w-md mx-auto bg-[#250b01]/90 rounded-2xl border border-orange-500/40 shadow-[0_10px_35px_rgba(0,0,0,0.6)] space-y-4 my-2 backdrop-blur-xl">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/20 border border-orange-500/50 flex items-center justify-center text-orange-400 mx-auto shadow-[0_0_20px_rgba(249,115,22,0.3)]">
              <UploadCloud className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-orange-100 font-mono">SEU KIT DE ÁUDIO</h3>
              <p className="text-xs text-orange-300/70 leading-relaxed font-sans">
                Adicione seus arquivos de áudio (MP3, WAV, M4A, OGG) para montar seu kit personalizado de pads para worship, ritmo ou percussão.
              </p>
            </div>
            <button
              id="btn-add-first-pads"
              onClick={() => setIsUploadOpen(true)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 text-slate-950 font-mono font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(249,115,22,0.5)] border border-amber-300 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>ADICIONAR MEUS ÁUDIOS</span>
            </button>
          </div>
        ) : filteredPads.length === 0 ? (
          <div className="py-16 text-center space-y-3 bg-[#250b01]/80 rounded-2xl border border-orange-500/30 backdrop-blur-xl">
            <Music className="w-8 h-8 text-orange-500/60 mx-auto animate-pulse" />
            <h3 className="font-semibold text-sm text-orange-200 font-mono">Nenhum áudio encontrado</h3>
            <p className="text-xs text-orange-300/70 max-w-xs mx-auto">
              {selectedCategory === 'presentation'
                ? 'Nenhum áudio foi escalado para o palco ainda. Clique no botão "Palco" nos cards para adicionar.'
                : 'Tente selecionar outro tom ou limpar a busca.'}
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedKey('all');
              }}
              className="px-4 py-2 text-xs font-mono font-bold rounded-xl bg-[#3b1502] text-orange-200 border border-orange-500/40 hover:border-orange-400 active:scale-95 transition-colors cursor-pointer"
            >
              VER TODOS OS ÁUDIOS
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
