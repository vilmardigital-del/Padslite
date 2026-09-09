import { PadItem } from '../types';

interface ActivePadState {
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  filterNode: BiquadFilterNode;
  pannerNode: StereoPannerNode;
  startTime: number;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterFilter: BiquadFilterNode | null = null;
  private analyser: AnalyserNode | null = null;
  private bufferCache: Map<string, AudioBuffer> = new Map();
  private activePads: Map<string, ActivePadState> = new Map();
  private listeners: Set<(padId: string, isPlaying: boolean) => void> = new Set();

  private metronomeTimer: number | null = null;
  private isMetronomeActive: boolean = false;
  private metronomeBpm: number = 100;
  private metronomeGain: GainNode | null = null;
  private metronomeBeat: number = 0;
  private onBeatCallback: ((beat: number) => void) | null = null;

  public init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

      this.masterFilter = this.ctx.createBiquadFilter();
      this.masterFilter.type = 'lowpass';
      this.masterFilter.frequency.setValueAtTime(20000, this.ctx.currentTime);

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      this.masterFilter.connect(this.masterGain);
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      this.metronomeGain = this.ctx.createGain();
      this.metronomeGain.gain.value = 0.5;
      this.metronomeGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public subscribe(fn: (padId: string, isPlaying: boolean) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(padId: string, isPlaying: boolean) {
    this.listeners.forEach(fn => fn(padId, isPlaying));
  }

  public async getAudioBuffer(url: string): Promise<AudioBuffer | null> {
    this.init();
    if (this.bufferCache.has(url)) {
      return this.bufferCache.get(url)!;
    }

    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP error ${resp.status}`);
      const arrayBuffer = await resp.arrayBuffer();
      const audioBuffer = await this.ctx!.decodeAudioData(arrayBuffer);
      this.bufferCache.set(url, audioBuffer);
      return audioBuffer;
    } catch (err) {
      console.error('Failed to load/decode audio:', url, err);
      return null;
    }
  }

  public isPadPlaying(padId: string): boolean {
    return this.activePads.has(padId);
  }

  public async playPad(pad: PadItem) {
    this.init();
    if (!this.ctx || !this.masterFilter) return;

    // If already playing, stop it first smoothly
    if (this.activePads.has(pad.id)) {
      this.stopPad(pad.id, pad.fadeOutTime || 0.4);
      return;
    }

    const buffer = await this.getAudioBuffer(pad.url);
    if (!buffer) {
      console.error('Could not play pad, buffer unavailable:', pad.url);
      return;
    }

    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = pad.isLoop;

    const gainNode = this.ctx.createGain();
    const filterNode = this.ctx.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(pad.filterCutoff || 20000, now);

    let pannerNode: any;
    if (this.ctx.createStereoPanner) {
      pannerNode = this.ctx.createStereoPanner();
      pannerNode.pan.setValueAtTime(pad.pan || 0, now);
    } else {
      pannerNode = this.ctx.createGain();
    }

    // Fade in envelope
    const targetVol = pad.volume ?? 0.8;
    const fadeIn = pad.fadeInTime || 0.05;
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.001, targetVol), now + fadeIn);

    // Audio node connections: source -> filter -> panner -> padGain -> masterFilter
    source.connect(filterNode);
    filterNode.connect(pannerNode);
    pannerNode.connect(gainNode);
    gainNode.connect(this.masterFilter);

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
  }

  public stopPad(padId: string, fadeOutSeconds?: number) {
    const active = this.activePads.get(padId);
    if (!active || !this.ctx) return;

    const now = this.ctx.currentTime;
    const fadeOut = fadeOutSeconds !== undefined ? fadeOutSeconds : 0.5;

    // Smooth release fade out
    try {
      active.gainNode.gain.cancelScheduledValues(now);
      active.gainNode.gain.setValueAtTime(Math.max(0.001, active.gainNode.gain.value), now);
      active.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + fadeOut);

      setTimeout(() => {
        try {
          active.source.stop();
          active.source.disconnect();
          active.gainNode.disconnect();
          active.filterNode.disconnect();
        } catch {
          // Ignore if already stopped
        }
        if (this.activePads.get(padId) === active) {
          this.activePads.delete(padId);
          this.notify(padId, false);
        }
      }, fadeOut * 1000 + 50);
    } catch {
      active.source.stop();
      this.activePads.delete(padId);
      this.notify(padId, false);
    }
  }

  public stopAll(fadeOutSeconds: number = 2.0) {
    const padIds = Array.from(this.activePads.keys());
    padIds.forEach(id => this.stopPad(id, fadeOutSeconds));
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
    if (active && this.ctx) {
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
