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

  try {
    const res = await fetch('/api/pads');
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data.pads)) {
          // If user had local custom pads, preserve them
          if (localPads) {
            const serverIds = new Set(data.pads.map((p: PadItem) => p.id));
            const customLocals = localPads.filter(p => p.isCustomUpload && !serverIds.has(p.id));
            const merged = [...data.pads, ...customLocals];
            saveStoredPads(merged);
            return merged;
          }
          saveStoredPads(data.pads);
          return data.pads;
        }
      }
    }
  } catch (err) {
    console.warn('Backend API /api/pads unavailable, using client storage / static fallback:', err);
  }

  // Fallback 1: LocalStorage (even if empty [])
  if (localPads !== null && Array.isArray(localPads)) {
    return localPads;
  }

  // Fallback 2: Static /pads.json (copied for Vercel)
  try {
    const staticRes = await fetch('/pads.json');
    if (staticRes.ok) {
      const contentType = staticRes.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const staticPads = await staticRes.json();
        if (Array.isArray(staticPads)) {
          saveStoredPads(staticPads);
          return staticPads;
        }
      }
    }
  } catch {
    // continue to default pads
  }

  // Fallback 3: In-memory default pads (empty)
  const defaults = getDefaultPads();
  saveStoredPads(defaults);
  return defaults;
}

export async function fetchCloudStats(): Promise<CloudStorageStats> {
  try {
    const res = await fetch('/api/stats');
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        return {
          totalPads: data.totalPads || 0,
          totalSizeMb: data.totalSizeMb || 0,
          customPadsCount: data.customPadsCount || 0,
          storageQuotaMb: data.storageQuotaMb || 10240,
        };
      }
    }
  } catch {
    // calculate fallback
  }

  const pads = getStoredPads() || getDefaultPads();
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

export async function uploadAudioFiles(files: File[]): Promise<{ addedPads: PadItem[]; totalPads: number }> {
  // First attempt: Server API upload (if server is active)
  try {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('audioFiles', file);
    });

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success && Array.isArray(data.addedPads)) {
          // Sync with local storage
          const current = getStoredPads() || getDefaultPads();
          const updated = [...current, ...data.addedPads];
          saveStoredPads(updated);
          return {
            addedPads: data.addedPads,
            totalPads: updated.length,
          };
        }
      }
    }
  } catch (serverErr) {
    console.warn('Server upload not reachable, saving to browser cloud storage (IndexedDB):', serverErr);
  }

  // Second path: Local IndexedDB persistent cloud upload (works 100% on Vercel without a server!)
  const currentPads = getStoredPads() || getDefaultPads();
  const addedPads: PadItem[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const padId = `pad-custom-${Date.now()}-${i}`;
    const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');

    // Detect musical key (e.g. C, C#, Dm, etc.)
    const keyMatch = file.name.match(/\b([A-G][#b]?m?)\b/i);
    const detectedKey = keyMatch ? keyMatch[1].toUpperCase() : undefined;

    // Detect BPM
    const bpmMatch = file.name.match(/\b(\d{2,3})\s*bpm\b/i);
    const detectedBpm = bpmMatch ? parseInt(bpmMatch[1], 10) : undefined;

    // Detect category
    let category: PadItem['category'] = 'custom';
    const lower = file.name.toLowerCase();
    if (detectedKey || lower.includes('worship') || lower.includes('ambient') || lower.includes('pad')) {
      category = 'worship';
    } else if (lower.includes('samba') || lower.includes('pagode') || lower.includes('batucada') || lower.includes('percuss')) {
      category = 'percussao';
    } else if (lower.includes('loop') || lower.includes('beat') || lower.includes('drum')) {
      category = 'ritmo';
    }

    // Persist audio blob in IndexedDB
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
      volume: 0.85,
      pan: 0,
      filterCutoff: 20000,
      fadeInTime: category === 'worship' ? 1.5 : 0.05,
      fadeOutTime: category === 'worship' ? 2.0 : 0.1,
      isCustomUpload: true,
      cloudStored: true,
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

export async function updatePadOnServer(id: string, updates: Partial<PadItem>): Promise<PadItem> {
  // 1. Immediately persist changes locally in browser storage
  const currentPads = getStoredPads() || getDefaultPads();
  const index = currentPads.findIndex(p => p.id === id);
  let updatedPad: PadItem;

  if (index !== -1) {
    updatedPad = {
      ...currentPads[index],
      ...updates,
      id // ensure id is never changed
    };
    currentPads[index] = updatedPad;
    saveStoredPads(currentPads);
  } else {
    updatedPad = { id, ...updates } as PadItem;
  }

  // 2. Background attempt to update server (if server running)
  try {
    fetch(`/api/pads/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).catch(() => {});
  } catch {
    // non-blocking
  }

  return updatedPad;
}

export async function deletePadOnServer(id: string): Promise<void> {
  // 1. Delete from local storage
  const currentPads = getStoredPads() || getDefaultPads();
  const filtered = currentPads.filter(p => p.id !== id);
  saveStoredPads(filtered);

  // 2. Delete blob if in IndexedDB
  await deleteAudioBlob(id);

  // 3. Attempt server delete
  try {
    fetch(`/api/pads/${id}`, { method: 'DELETE' }).catch(() => {});
  } catch {
    // non-blocking
  }
}

// Remove all pre-loaded system pads, keeping only user's custom uploads
export async function removeSystemPads(): Promise<PadItem[]> {
  const current = getStoredPads() || [];
  const customOnly = current.filter(p => p.isCustomUpload === true);
  saveStoredPads(customOnly);

  try {
    await fetch('/api/pads/remove-system', { method: 'POST' });
  } catch {
    // non-blocking
  }

  return customOnly;
}

// Clear all pads completely (clean slate)
export async function clearAllPads(): Promise<PadItem[]> {
  clearStoredPads();
  try {
    await fetch('/api/pads/clear-all', { method: 'POST' });
  } catch {
    // non-blocking
  }
  return [];
}

export async function resetPadsOnServer(): Promise<PadItem[]> {
  clearStoredPads();
  const defaults = getDefaultPads();
  saveStoredPads(defaults);

  try {
    fetch('/api/pads/reset', { method: 'POST' }).catch(() => {});
  } catch {
    // non-blocking
  }

  return defaults;
}
