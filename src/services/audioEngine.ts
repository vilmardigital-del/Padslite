import { PadItem } from '../types';
import { getAudioBlob } from './storage';

interface ActivePadState {
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  filterNode?: BiquadFilterNode;
  pannerNode?: StereoPannerNode;
  startTime: number;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterFilter: BiquadFilterNode | null = null;
  private analyser: AnalyserNode | null = null;
  private bufferCache: Map<string, AudioBuffer> = new Map();
  private activePads: Map<string, ActivePadState> = new Map();
  private pendingLoads: Set<string> = new Set();
  private listeners: Set<(padId: string, isPlaying: boolean) => void> = new Set();
  private loadingListeners: Set<(padId: string, isLoading: boolean) => void> = new Set();

  private metronomeTimer: number | null = null;
  private isMetronomeActive: boolean = false;
  private metronomeBpm: number = 100;
  private metronomeGain: GainNode | null = null;
  private metronomeBeat: number = 0;
  private onBeatCallback: ((beat: number) => void) | null = null;

  public init() {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();

        // Master gain with clean flat response
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

        // Master filter for global tone control
        this.masterFilter = this.ctx.createBiquadFilter();
        this.masterFilter.type = 'lowpass';
        this.masterFilter.frequency.setValueAtTime(20000, this.ctx.currentTime);

        // Visualizer analyser
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.8;

        this.masterGain.connect(this.masterFilter);
        this.masterFilter.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);

        // Metronome gain
        this.metronomeGain = this.ctx.createGain();
        this.metronomeGain.gain.value = 0.5;
        this.metronomeGain.connect(this.ctx.destination);
      }

      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch (e) {
      console.warn('AudioContext initialization deferred:', e);
    }
  }

  public subscribe(fn: (padId: string, isPlaying: boolean) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  public subscribeLoading(fn: (padId: string, isLoading: boolean) => void) {
    this.loadingListeners.add(fn);
    return () => this.loadingListeners.delete(fn);
  }

  private notify(padId: string, isPlaying: boolean) {
    this.listeners.forEach(fn => fn(padId, isPlaying));
  }

  private notifyLoading(padId: string, isLoading: boolean) {
    this.loadingListeners.forEach(fn => fn(padId, isLoading));
  }

  public isPadLoading(padId: string): boolean {
    return this.pendingLoads.has(padId);
  }

  // Load and decode pure original audio file with ZERO AI/synthetic alteration
  public async getAudioBuffer(url: string): Promise<AudioBuffer> {
    this.init();
    if (!this.ctx) {
      throw new Error('AudioContext não disponível');
    }

    if (this.bufferCache.has(url)) {
      return this.bufferCache.get(url)!;
    }

    // 1. Check if URL is stored in IndexedDB (idb://)
    if (url.startsWith('idb://')) {
      const blobId = url.replace('idb://', '');
      const data = await getAudioBlob(blobId);
      if (!data) {
        throw new Error('Áudio original não encontrado no armazenamento local');
      }

      let arrayBuffer: ArrayBuffer;
      if (data instanceof Blob) {
        arrayBuffer = await data.arrayBuffer();
      } else {
        arrayBuffer = data;
      }

      // decodeAudioData detaches the arrayBuffer, so we pass a slice
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
      this.bufferCache.set(url, audioBuffer);
      return audioBuffer;
    }

    // 2. Fetch from server or static URL
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Falha ao carregar áudio (${resp.status}): ${url}`);
    }

    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new Error('Arquivo de áudio não encontrado no servidor');
    }

    const arrayBuffer = await resp.arrayBuffer();
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
    this.bufferCache.set(url, audioBuffer);
    return audioBuffer;
  }

  public isPadPlaying(padId: string): boolean {
    return this.activePads.has(padId);
  }

  public async playPad(pad: PadItem, onError?: (errorMsg: string) => void) {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    // If this pad is currently playing, clicking again stops it immediately
    if (this.activePads.has(pad.id)) {
      this.stopPad(pad.id);
      return;
    }

    // If already loading this pad, cancel it
    if (this.pendingLoads.has(pad.id)) {
      this.pendingLoads.delete(pad.id);
      this.notifyLoading(pad.id, false);
      return;
    }

    this.pendingLoads.add(pad.id);
    this.notifyLoading(pad.id, true);

    try {
      const buffer = await this.getAudioBuffer(pad.url);

      // Verify user didn't hit stop while audio was loading
      if (!this.pendingLoads.has(pad.id)) {
        return;
      }
      this.pendingLoads.delete(pad.id);
      this.notifyLoading(pad.id, false);

      // Stop any existing instance of this pad if present
      if (this.activePads.has(pad.id)) {
        this.stopPad(pad.id);
      }

      const now = this.ctx.currentTime;
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = pad.isLoop;

      const gainNode = this.ctx.createGain();
      const targetVol = pad.volume !== undefined ? pad.volume : 0.9;
      // Start with original volume cleanly and immediately (0.005s fast micro-ramp avoids click)
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.linearRampToValueAtTime(Math.max(0.001, targetVol), now + 0.008);

      let lastNode: AudioNode = source;

      // Optional manual filter (only if user explicitly moved filter slider below 19000Hz)
      let filterNode: BiquadFilterNode | undefined;
      if (pad.filterCutoff && pad.filterCutoff < 19000) {
        filterNode = this.ctx.createBiquadFilter();
        filterNode.type = 'lowpass';
        filterNode.frequency.setValueAtTime(pad.filterCutoff, now);
        lastNode.connect(filterNode);
        lastNode = filterNode;
      }

      // Optional manual stereo pan (only if user changed pan)
      let pannerNode: StereoPannerNode | undefined;
      if (pad.pan && pad.pan !== 0 && this.ctx.createStereoPanner) {
        pannerNode = this.ctx.createStereoPanner();
        pannerNode.pan.setValueAtTime(pad.pan, now);
        lastNode.connect(pannerNode);
        lastNode = pannerNode;
      }

      lastNode.connect(gainNode);
      gainNode.connect(this.masterGain);

      source.onended = () => {
        if (this.activePads.get(pad.id)?.source === source) {
          this.activePads.delete(pad.id);
          this.notify(pad.id, false);
        }
      };

      source.start(now);
      this.activePads.set(pad.id, {
        source,
        gainNode,
        filterNode,
        pannerNode,
        startTime: now,
      });

      this.notify(pad.id, true);
    } catch (err: any) {
      this.pendingLoads.delete(pad.id);
      this.notifyLoading(pad.id, false);
      console.error(`Erro ao reproduzir áudio do pad "${pad.name}":`, err);
      if (onError) {
        onError(err.message || 'Erro ao carregar o arquivo de áudio original.');
      }
    }
  }

  // Stop a specific pad immediately
  public stopPad(padId: string, _fadeOutTime?: number) {
    // If it was still loading, cancel loading immediately
    if (this.pendingLoads.has(padId)) {
      this.pendingLoads.delete(padId);
      this.notifyLoading(padId, false);
    }

    const active = this.activePads.get(padId);
    if (!active || !this.ctx) {
      // Ensure UI is notified even if already stopped
      this.notify(padId, false);
      return;
    }

    // IMMEDIATELY remove from active map so UI updates instantly without lag
    this.activePads.delete(padId);
    this.notify(padId, false);

    const now = this.ctx.currentTime;
    try {
      // 15ms fast micro-fade to avoid speaker pops/clicks, then hard stop
      active.gainNode.gain.cancelScheduledValues(now);
      active.gainNode.gain.setValueAtTime(active.gainNode.gain.value, now);
      active.gainNode.gain.linearRampToValueAtTime(0, now + 0.015);

      setTimeout(() => {
        try {
          active.source.stop();
          active.source.disconnect();
          active.gainNode.disconnect();
          if (active.filterNode) active.filterNode.disconnect();
          if (active.pannerNode) active.pannerNode.disconnect();
        } catch {
          // Already stopped/disconnected
        }
      }, 25);
    } catch {
      try {
        active.source.stop();
        active.source.disconnect();
        active.gainNode.disconnect();
      } catch {
        // Safe catch
      }
    }
  }

  // Stop all active pads immediately
  public stopAll(_fadeOutTime?: number) {
    this.pendingLoads.clear();
    const padIds = Array.from(this.activePads.keys());
    padIds.forEach(id => this.stopPad(id));
  }

  public setPadVolume(padId: string, volume: number) {
    const active = this.activePads.get(padId);
    if (active && this.ctx) {
      active.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
      active.gainNode.gain.setValueAtTime(Math.max(0.0001, volume), this.ctx.currentTime);
    }
  }

  public setPadFilter(padId: string, cutoff: number) {
    const active = this.activePads.get(padId);
    if (active && active.filterNode && this.ctx) {
      active.filterNode.frequency.setValueAtTime(cutoff, this.ctx.currentTime);
    }
  }

  public setPadPan(padId: string, pan: number) {
    const active = this.activePads.get(padId);
    if (active && active.pannerNode && 'pan' in active.pannerNode && this.ctx) {
      active.pannerNode.pan.setValueAtTime(pan, this.ctx.currentTime);
    }
  }

  public setMasterVolume(vol: number) {
    this.init();
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(Math.max(0.0001, vol), this.ctx.currentTime);
    }
  }

  public setMasterFilter(freq: number) {
    this.init();
    if (this.masterFilter && this.ctx) {
      this.masterFilter.frequency.setValueAtTime(freq, this.ctx.currentTime);
    }
  }

  public getAnalyserData(dataArray: Uint8Array): void {
    if (this.analyser) {
      this.analyser.getByteFrequencyData(dataArray);
    }
  }

  public getWaveformData(dataArray: Uint8Array): void {
    if (this.analyser) {
      this.analyser.getByteTimeDomainData(dataArray);
    }
  }

  public getActivePadsCount(): number {
    return this.activePads.size;
  }

  // --- Metronome Functions ---
  public startMetronome(bpm: number, onBeat?: (beat: number) => void) {
    this.init();
    this.metronomeBpm = bpm;
    this.onBeatCallback = onBeat || null;
    this.isMetronomeActive = true;
    this.metronomeBeat = 0;

    if (this.metronomeTimer) clearInterval(this.metronomeTimer);

    const intervalMs = (60 / this.metronomeBpm) * 1000;
    this.playClick(true);
    this.metronomeTimer = window.setInterval(() => {
      this.metronomeBeat = (this.metronomeBeat + 1) % 4;
      this.playClick(this.metronomeBeat === 0);
      if (this.onBeatCallback) this.onBeatCallback(this.metronomeBeat);
    }, intervalMs);
  }

  public updateMetronomeBpm(bpm: number) {
    this.metronomeBpm = bpm;
    if (this.isMetronomeActive) {
      this.startMetronome(bpm, this.onBeatCallback || undefined);
    }
  }

  public stopMetronome() {
    this.isMetronomeActive = false;
    if (this.metronomeTimer) {
      clearInterval(this.metronomeTimer);
      this.metronomeTimer = null;
    }
  }

  public isMetronomeRunning(): boolean {
    return this.isMetronomeActive;
  }

  private playClick(isFirstBeat: boolean) {
    if (!this.ctx || !this.metronomeGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(isFirstBeat ? 1200 : 800, now);

    gain.gain.setValueAtTime(1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.metronomeGain);

    osc.start(now);
    osc.stop(now + 0.05);
  }
}

export const audioEngine = new AudioEngine();
