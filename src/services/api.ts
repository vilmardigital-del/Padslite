import { PadItem, CloudStorageStats } from '../types';
import { db } from './firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
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

export interface AudioUploadItem {
  file: File;
  category?: PadItem['category'];
}

/**
 * Real-time subscription to Firestore pads collection.
 * When ANY user adds, updates, or deletes a pad, all connected users receive the update immediately.
 */
export function subscribePads(callback: (pads: PadItem[]) => void): () => void {
  try {
    const padsCol = collection(db, 'pads');
    const unsubscribe = onSnapshot(
      padsCol,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: PadItem[] = [];
          snapshot.forEach((d) => {
            list.push({ ...(d.data() as PadItem), id: d.id });
          });
          list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
          saveStoredPads(list);
          callback(list);
        } else {
          // If Firestore collection has no documents, fallback to fetchPads
          fetchPads().then((pads) => {
            if (pads.length > 0) {
              callback(pads);
            }
          }).catch(() => {});
        }
      },
      (error) => {
        console.warn('Firestore subscription notice, falling back to local/api:', error);
        fetchPads().then((pads) => callback(pads)).catch(() => {});
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Failed to setup Firestore subscription:', err);
    return () => {};
  }
}

/**
 * Fetch all pads. Checks Firestore first, then backend API /api/pads, then local cache.
 */
export async function fetchPads(): Promise<PadItem[]> {
  try {
    // 1. Try Firestore first
    const padsCol = collection(db, 'pads');
    const snapshot = await getDocs(padsCol);
    if (!snapshot.empty) {
      const list: PadItem[] = [];
      snapshot.forEach((d) => {
        list.push({ ...(d.data() as PadItem), id: d.id });
      });
      list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      saveStoredPads(list);
      return list;
    }

    // 2. If Firestore is empty, fetch from backend API
    const res = await fetch('/api/pads');
    if (res.ok) {
      const data = await res.json();
      if (data.pads && Array.isArray(data.pads) && data.pads.length > 0) {
        // Sync to Firestore in background so all users share it
        try {
          const batch = writeBatch(db);
          data.pads.forEach((p: PadItem) => {
            const ref = doc(db, 'pads', p.id);
            batch.set(ref, p);
          });
          await batch.commit();
        } catch (syncErr) {
          console.warn('Firestore initial sync notice:', syncErr);
        }
        saveStoredPads(data.pads);
        return data.pads;
      }
    }
  } catch (err) {
    console.warn('fetchPads network/firestore notice:', err);
  }

  // 3. Fallback to cached local storage
  const localPads = getStoredPads();
  if (localPads && Array.isArray(localPads) && localPads.length > 0) {
    return localPads;
  }

  return [];
}

/**
 * Fetch cloud storage stats for all users.
 */
export async function fetchCloudStats(): Promise<CloudStorageStats> {
  try {
    const res = await fetch('/api/stats');
    if (res.ok) {
      const data = await res.json();
      return {
        totalPads: data.totalPads,
        totalSizeMb: data.totalSizeMb,
        customPadsCount: data.customPadsCount,
        storageQuotaMb: data.storageQuotaMb || 10240,
      };
    }
  } catch {
    // fallback
  }

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

/**
 * Upload audio files. Uploads to the backend server so the files are hosted publicly,
 * then saves pad metadata to Firestore so ALL users can immediately access and play them!
 */
export async function uploadAudioFiles(
  items: Array<AudioUploadItem | File>
): Promise<{ addedPads: PadItem[]; totalPads: number }> {
  const normalizedItems: AudioUploadItem[] = items.map(item => {
    if (item instanceof File) {
      return { file: item };
    }
    return item;
  });

  const addedPads: PadItem[] = [];

  try {
    const formData = new FormData();
    const categoryMap: Record<string, string> = {};

    normalizedItems.forEach(item => {
      formData.append('audioFiles', item.file);
      if (item.category) {
        categoryMap[item.file.name] = item.category;
      }
    });
    formData.append('categoriesJson', JSON.stringify(categoryMap));

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      if (data.addedPads && Array.isArray(data.addedPads)) {
        for (const pad of data.addedPads) {
          // Save pad metadata to Firestore so ALL users see it in real-time
          try {
            await setDoc(doc(db, 'pads', pad.id), pad);
          } catch (e) {
            console.warn('Firestore doc set notice:', e);
          }
          addedPads.push(pad);
        }

        // Cache files in local IndexedDB for zero-latency local playback
        for (let i = 0; i < normalizedItems.length; i++) {
          const item = normalizedItems[i];
          const matched = addedPads.find(p => p.originalFileName === item.file.name) || addedPads[i];
          if (matched) {
            await storeAudioBlob(matched.id, item.file);
          }
        }

        const currentPads = await fetchPads();
        return {
          addedPads,
          totalPads: currentPads.length,
        };
      }
    }
  } catch (err) {
    console.warn('Server upload notice, falling back to local IDB + Firestore:', err);
  }

  // Fallback if backend server endpoint is unreachable
  const currentPads = await fetchPads();
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
      cloudStored: true,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'pads', padId), pad);
    } catch (e) {
      console.warn('Firestore fallback doc set notice:', e);
    }

    currentPads.push(pad);
    addedPads.push(pad);
  }

  saveStoredPads(currentPads);

  return {
    addedPads,
    totalPads: currentPads.length
  };
}

/**
 * Update pad settings. All users can update any pad, and changes sync to Firestore and the server.
 */
export async function updatePad(id: string, updates: Partial<PadItem>): Promise<PadItem> {
  // 1. Update in Firestore (propagates to all users in real-time)
  try {
    await setDoc(doc(db, 'pads', id), updates, { merge: true });
  } catch (err) {
    console.warn('Firestore updateDoc notice:', err);
  }

  // 2. Update in backend server
  try {
    await fetch(`/api/pads/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  } catch (err) {
    console.warn('Server updatePad notice:', err);
  }

  // 3. Update in local cache
  const pads = getStoredPads() || [];
  const index = pads.findIndex(p => p.id === id);
  let updatedPad: PadItem;
  if (index !== -1) {
    updatedPad = { ...pads[index], ...updates, id };
    pads[index] = updatedPad;
    saveStoredPads(pads);
  } else {
    updatedPad = { ...updates, id } as PadItem;
  }

  return updatedPad;
}

/**
 * Delete a pad. All users can delete any pad. Deletes from Firestore, backend server, and local storage.
 */
export async function deletePad(id: string): Promise<void> {
  // 1. Delete from Firestore (propagates to all users in real-time)
  try {
    await deleteDoc(doc(db, 'pads', id));
  } catch (err) {
    console.warn('Firestore deleteDoc notice:', err);
  }

  // 2. Delete from backend server
  try {
    await fetch(`/api/pads/${id}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('Server deletePad notice:', err);
  }

  // 3. Delete from IndexedDB
  await deleteAudioBlob(id);

  // 4. Update local cache
  const pads = getStoredPads() || [];
  const filtered = pads.filter(p => p.id !== id);
  saveStoredPads(filtered);
}

/**
 * Reset pads to the standard cloud kit.
 */
export async function resetPads(): Promise<PadItem[]> {
  try {
    const res = await fetch('/api/pads/reset', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      if (data.pads && Array.isArray(data.pads)) {
        try {
          const batch = writeBatch(db);
          data.pads.forEach((p: PadItem) => {
            batch.set(doc(db, 'pads', p.id), p);
          });
          await batch.commit();
        } catch (e) {
          console.warn('Firestore reset sync notice:', e);
        }
        saveStoredPads(data.pads);
        return data.pads;
      }
    }
  } catch (err) {
    console.warn('Reset pads notice:', err);
  }
  return [];
}

/**
 * Remove system pads keeping custom uploads only.
 */
export async function removeSystemPads(): Promise<PadItem[]> {
  try {
    const res = await fetch('/api/pads/remove-system', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      if (data.pads && Array.isArray(data.pads)) {
        try {
          const snapshot = await getDocs(collection(db, 'pads'));
          const batch = writeBatch(db);
          snapshot.forEach((d) => {
            const item = d.data() as PadItem;
            if (!item.isCustomUpload) {
              batch.delete(d.ref);
            }
          });
          await batch.commit();
        } catch (e) {
          console.warn('Firestore remove system notice:', e);
        }
        saveStoredPads(data.pads);
        return data.pads;
      }
    }
  } catch (e) {
    console.warn('Remove system notice:', e);
  }

  const current = await fetchPads();
  const customOnly = current.filter(p => p.isCustomUpload);
  saveStoredPads(customOnly);
  return customOnly;
}

/**
 * Clear all pads completely across all users.
 */
export async function clearAllPads(): Promise<PadItem[]> {
  try {
    await fetch('/api/pads/clear-all', { method: 'POST' });
  } catch (e) {
    console.warn('Clear server pads notice:', e);
  }

  try {
    const snapshot = await getDocs(collection(db, 'pads'));
    const batch = writeBatch(db);
    snapshot.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (e) {
    console.warn('Clear firestore notice:', e);
  }

  clearStoredPads();
  return [];
}
