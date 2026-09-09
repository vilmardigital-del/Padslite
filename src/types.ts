export interface PadItem {
  id: string;
  name: string;
  category: 'worship' | 'percussao' | 'ritmo' | 'fx' | 'custom';
  musicalKey?: string; // e.g. "C", "D", "E", "F", "G", "A", "B", "Em", etc.
  bpm?: number;
  url: string; // URL to the audio file (/uploads/audio/... or blob)
  originalFileName?: string;
  fileSize?: number;
  duration?: number; // in seconds
  color: string;
  isLoop: boolean;
  volume: number; // 0 to 1
  pan: number; // -1 to 1
  filterCutoff: number; // Hz, e.g. 20000 (wide open) to 200 (muffled)
  fadeInTime: number; // in seconds
  fadeOutTime: number; // in seconds
  isCustomUpload?: boolean;
  cloudStored: boolean;
  createdAt: string;
  hotkey?: string; // keyboard shortcut
}

export interface CloudStorageStats {
  totalPads: number;
  totalSizeMb: number;
  customPadsCount: number;
  storageQuotaMb: number;
}
