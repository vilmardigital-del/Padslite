import { PadItem, CloudStorageStats } from '../types';
import {
  getStoredPads,
  saveStoredPads,
  getDefaultPads,
  clearStoredPads,
  storeAudioBlob,
  deleteAudioBlob
} from './storage';

const PAD_COLORS = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316',
  '#eab308', '#84cc16', '#10b981', '#06b6d4'
];

export async function fetchPads(): Promise<PadItem[]> {
  const localPads = getStoredPads();
  if (localPads && Array.isArray(localPads)) {
    return localPads;
  }
  const defaults = getDefaultPads();
  saveStoredPads(defaults);
  return defaults;
}

export async function fetchCloudStats(): Promise<CloudStorageStats> {
  const pads = await fetchPads();
  const customCount = pads.filter(p => p.isCustomUpload).length;
  const totalBytes = pads.reduce((acc, p) => acc + (p.fileSize || 529244), 0);
  const totalSizeMb = Math.round((totalBytes / (1024 * 1024)) * 100) / 100;

  return {
    totalPads: pads.length,
    totalSizeMb,
    customPadsCount: customCount,
    storageQuotaMb: 10240,
  };
}

export interface AudioUploadItem {
  file: File;
  category?: PadItem['category'];
}

export async function uploadAudioFiles(
  items: Array<AudioUploadItem | File>
): Promise<{ addedPads: PadItem[]; totalPads: number }> {
  const normalizedItems: AudioUploadItem[] = items.map(item => {
    if (item instanceof File) {
      return { file: item };
    }
    return item;
  });

  const currentPads = await fetchPads();
  const addedPads: PadItem[] = [];

  for (let i = 0; i < normalizedItems.length; i++) {
    const { file, category: userCategory } = normalizedItems[i];
    const padId = `pad-custom-${Date.now()}-${i}`;
    const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');

    const keyMatch = file.name.match(/\b([A-G][#b]?m?)\b/i);
    const detectedKey = keyMatch ? keyMatch[1].toUpperCase() : undefined;

    const bpmMatch = file.name.match(/\b(\d{2,3})\s*bpm\b/i);
    const detectedBpm = bpmMatch ? parseInt(bpmMatch[1], 10) : undefined;

    let category: PadItem['category'] = userCategory || 'custom';
    if (!userCategory) {
      const lower = file.name.toLowerCase();
      if (detectedKey || lower.includes('worship') || lower.includes('ambient') || lower.includes('pad')) {
        category = 'worship';
      } else if (lower.includes('samba') || lower.includes('pagode') || lower.includes('batucada') || lower.includes('percuss')) {
        category = 'percussao';
      } else if (lower.includes('loop') || lower.includes('beat') || lower.includes('drum')) {
        category = 'ritmo';
      }
    }

    await storeAudioBlob(padId, file);

    const pad: PadItem = {
      id: padId,
      name: cleanName,
      category,
      musicalKey: detectedKey,
      bpm: detectedBpm,
      url: `idb://${padId}`,
      originalFileName: file.name,
      fileSize: file.size,
      duration: 5.0,
      color: PAD_COLORS[(currentPads.length + i) % PAD_COLORS.length],
      isLoop: true,
      volume: 0.95,
      pan: 0,
      filterCutoff: 20000,
      fadeInTime: category === 'worship' ? 1.5 : 0,
      fadeOutTime: category === 'worship' ? 2.5 : 0.05,
      isCustomUpload: true,
      createdAt: new Date().toISOString()
    };

    currentPads.push(pad);
    addedPads.push(pad);
  }

  saveStoredPads(currentPads);

  return {
    addedPads,
    totalPads: currentPads.length
  };
}

export async function updatePad(id: string, updates: Partial<PadItem>): Promise<PadItem> {
  const pads = await fetchPads();
  const index = pads.findIndex(p => p.id === id);
  if (index === -1) throw new Error('Pad não encontrado.');
  
  const updatedPad = { ...pads[index], ...updates, id };
  pads[index] = updatedPad;
  saveStoredPads(pads);
  
  return updatedPad;
}

export async function deletePad(id: string): Promise<void> {
  await deleteAudioBlob(id);
  
  const pads = (await fetchPads()).filter(p => p.id !== id);
  saveStoredPads(pads);
}

// Para remover pads do sistema (apenas admin)
export async function removeSystemPads(): Promise<PadItem[]> {
  const current = await fetchPads();
  const customOnly = current.filter(p => p.isCustomUpload === true);
  saveStoredPads(customOnly);
  return customOnly;
}

export async function clearAllPads(): Promise<PadItem[]> {
  clearStoredPads();
  return [];
}

export async function resetPads(): Promise<PadItem[]> {
  clearStoredPads();
  const defaults = getDefaultPads();
  saveStoredPads(defaults);
  return defaults;
}
