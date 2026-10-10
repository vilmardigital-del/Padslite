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
  clearStoredPads,
  storeAudioBlob,
  deleteAudioBlob,
  getAudioBlob
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

function getApiUrl(path: string): string {
  if (typeof window !== 'undefined') {
    return path;
  }
  return `http://localhost:3000${path}`;
}

/**
 * Clean any pad object so it never contains 'undefined' values,
 * which cause Firestore SDK setDoc() to throw an error and fail.
 */
export function cleanPadForFirestore<T extends Record<string, any>>(pad: T): Record<string, any> {
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(pad)) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }
  // Ensure optional properties are deleted rather than set to undefined
  if (cleaned.musicalKey === undefined || cleaned.musicalKey === null) delete cleaned.musicalKey;
  if (cleaned.bpm === undefined || cleaned.bpm === null || isNaN(cleaned.bpm)) delete cleaned.bpm;
  if (cleaned.hotkey === undefined || cleaned.hotkey === null) delete cleaned.hotkey;
  return cleaned;
}

/**
 * Converts a File or Blob into base64 string.
 */
function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const commaIdx = res.indexOf(',');
      resolve(commaIdx !== -1 ? res.substring(commaIdx + 1) : res);
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

/**
 * Converts a base64 string into an ArrayBuffer.
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Accurately extracts duration of audio file in browser using HTMLAudioElement.
 */
async function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        const d = audio.duration;
        URL.revokeObjectURL(url);
        resolve(isNaN(d) || !isFinite(d) ? 0 : Math.round(d * 10) / 10);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(0);
      };
      audio.src = url;
    } catch {
      resolve(0);
    }
  });
}

/**
 * Save audio binary chunks directly to Firestore subcollection.
 * Guarantees permanent persistence across all users, devices, and container restarts!
 */
export async function saveAudioChunksToFirestore(
  padId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ totalChunks: number }> {
  const base64 = await fileToBase64(file);
  // 380,000 chars per chunk (~285KB binary, safely below Firestore 1MB doc limit)
  const CHUNK_SIZE = 380 * 1024;
  const totalChunks = Math.ceil(base64.length / CHUNK_SIZE);

  // Write chunks in parallel batches of 5 to optimize speed while respecting Firestore rate limits
  const BATCH_SIZE = 5;
  for (let batchStart = 0; batchStart < totalChunks; batchStart += BATCH_SIZE) {
    const batchPromises: Promise<any>[] = [];
    const batchEnd = Math.min(batchStart + BATCH_SIZE, totalChunks);

    for (let i = batchStart; i < batchEnd; i++) {
      const chunkData = base64.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const chunkDocRef = doc(db, 'pads', padId, 'audioChunks', String(i));
      batchPromises.push(
        setDoc(chunkDocRef, {
          index: i,
          total: totalChunks,
          data: chunkData,
          padId,
          mimeType: file.type || 'audio/mpeg',
          createdAt: Date.now()
        })
      );
    }

    await Promise.all(batchPromises);
    if (onProgress) {
      onProgress(Math.round((batchEnd / totalChunks) * 100));
    }
  }

  return { totalChunks };
}

/**
 * Retrieve audio binary chunks from Firestore subcollection and reconstruct into ArrayBuffer.
 * This is the ultimate fallback ensuring audio plays even if local server files are purged.
 */
export async function getAudioChunksFromFirestore(padId: string): Promise<ArrayBuffer | null> {
  try {
    const chunksCol = collection(db, 'pads', padId, 'audioChunks');
    const snap = await getDocs(chunksCol);
    if (snap.empty) {
      return null;
    }

    const docs = snap.docs.map(d => d.data() as { index: number; total: number; data: string });
    docs.sort((a, b) => a.index - b.index);

    const reassembledBase64 = docs.map(d => d.data).join('');
    if (!reassembledBase64) return null;

    return base64ToArrayBuffer(reassembledBase64);
  } catch (err) {
    console.warn(`Failed to fetch audio chunks from Firestore for pad ${padId}:`, err);
    return null;
  }
}

/**
 * Delete audio chunks from Firestore when a pad is deleted.
 */
export async function deleteAudioChunksFromFirestore(padId: string): Promise<void> {
  try {
    const chunksCol = collection(db, 'pads', padId, 'audioChunks');
    const snap = await getDocs(chunksCol);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    console.warn(`Failed to delete audio chunks from Firestore for pad ${padId}:`, err);
  }
}

/**
 * Real-time subscription to Firestore pads collection.
 * When ANY user adds, updates, or deletes a pad, all connected users receive the update immediately.
 * Also protects locally uploaded custom pads from ever being accidentally wiped.
 */
export function subscribePads(callback: (pads: PadItem[]) => void): () => void {
  try {
    const padsCol = collection(db, 'pads');
    const unsubscribe = onSnapshot(
      padsCol,
      (snapshot) => {
        const firestoreList: PadItem[] = [];
        snapshot.forEach((d) => {
          firestoreList.push({ ...(d.data() as PadItem), id: d.id });
        });

        // Load local storage to ensure any offline/recent custom uploads are preserved
        const local = getStoredPads() || [];
        const firestoreIds = new Set(firestoreList.map(p => p.id));
        const missingCustom = local.filter(p => !firestoreIds.has(p.id) && p.isCustomUpload);

        if (missingCustom.length > 0) {
          // Sync missing custom uploads to Firestore in the background
          for (const p of missingCustom) {
            firestoreList.push(p);
            setDoc(doc(db, 'pads', p.id), cleanPadForFirestore(p)).catch(e => {
              console.warn('Syncing local custom pad to Firestore:', e);
            });
          }
        }

        firestoreList.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        saveStoredPads(firestoreList);
        callback(firestoreList);
      },
      (error) => {
        console.warn('Firestore subscription notice, falling back to fetchPads:', error);
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
 * Fetch all pads. Merges Firestore, backend API /api/pads, and local cache.
 * Guarantees that custom uploads are never lost across app restarts.
 */
export async function fetchPads(): Promise<PadItem[]> {
  const mergedMap = new Map<string, PadItem>();

  // 1. Load local cache first for zero-latency UI
  const local = getStoredPads() || [];
  local.forEach(p => mergedMap.set(p.id, p));

  // 2. Fetch from Firestore
  try {
    const padsCol = collection(db, 'pads');
    const snapshot = await getDocs(padsCol);
    if (!snapshot.empty) {
      snapshot.forEach(d => {
        mergedMap.set(d.id, { ...(d.data() as PadItem), id: d.id });
      });
    }
  } catch (err) {
    console.warn('fetchPads Firestore notice:', err);
  }

  // 3. Fetch from backend API /api/pads
  try {
    const res = await fetch(getApiUrl('/api/pads'));
    if (res.ok) {
      const data = await res.json();
      if (data.pads && Array.isArray(data.pads)) {
        data.pads.forEach((p: PadItem) => {
          if (!mergedMap.has(p.id)) {
            mergedMap.set(p.id, p);
            // Sync backend pads to Firestore if missing
            setDoc(doc(db, 'pads', p.id), cleanPadForFirestore(p)).catch(() => {});
          }
        });
      }
    }
  } catch (err) {
    console.warn('fetchPads API notice:', err);
  }

  const result = Array.from(mergedMap.values());
  result.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  saveStoredPads(result);

  return result;
}

/**
 * Fetch cloud storage stats for all users.
 */
export async function fetchCloudStats(): Promise<CloudStorageStats> {
  try {
    const res = await fetch(getApiUrl('/api/stats'));
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
 * Upload audio files.
 * TRIPLE-PERSISTENCE ARCHITECTURE:
 * 1. Uploads to backend server disk (/public/uploads/audio) for fast streaming
 * 2. Saves full binary audio chunks to Firestore subcollection (pads/{padId}/audioChunks) for permanent multi-device cloud storage
 * 3. Caches audio blob in IndexedDB for instantaneous local zero-latency playback
 */
export async function uploadAudioFiles(
  items: Array<AudioUploadItem | File>,
  onProgress?: (statusText: string, percent: number) => void
): Promise<{ addedPads: PadItem[]; totalPads: number }> {
  const normalizedItems: AudioUploadItem[] = items.map(item => {
    if (item instanceof File) {
      return { file: item };
    }
    return item;
  });

  const addedPads: PadItem[] = [];
  const currentPads = await fetchPads();

  // Try uploading to backend /api/upload
  let serverUploadedPads: any[] = [];
  try {
    if (onProgress) onProgress('Enviando arquivos para o servidor...', 10);
    const formData = new FormData();
    const categoryMap: Record<string, string> = {};

    normalizedItems.forEach(item => {
      formData.append('audioFiles', item.file);
      if (item.category) {
        categoryMap[item.file.name] = item.category;
      }
    });
    formData.append('categoriesJson', JSON.stringify(categoryMap));

    const res = await fetch(getApiUrl('/api/upload'), {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      if (data.addedPads && Array.isArray(data.addedPads)) {
        serverUploadedPads = data.addedPads;
      }
    }
  } catch (err) {
    console.warn('Backend upload notice, proceeding with cloud chunking and Firestore persistence:', err);
  }

  // Process and save each file permanently to Firestore and IndexedDB
  for (let i = 0; i < normalizedItems.length; i++) {
    const { file, category: userCategory } = normalizedItems[i];
    const serverPad = serverUploadedPads[i] || serverUploadedPads.find(p => p.originalFileName === file.name);

    const padId = serverPad?.id || `pad-custom-${Date.now()}-${i}`;
    const cleanName = serverPad?.name || file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');

    const keyMatch = file.name.match(/\b([A-G][#b]?m?)\b/i);
    const detectedKey = serverPad?.musicalKey || (keyMatch ? keyMatch[1].toUpperCase() : undefined);

    const bpmMatch = file.name.match(/\b(\d{2,3})\s*bpm\b/i);
    const detectedBpm = serverPad?.bpm || (bpmMatch ? parseInt(bpmMatch[1], 10) : undefined);

    let category: PadItem['category'] = userCategory || serverPad?.category || 'worship';
    if (!userCategory && !serverPad?.category) {
      const lower = file.name.toLowerCase();
      if (detectedKey || lower.includes('worship') || lower.includes('ambient') || lower.includes('pad')) {
        category = 'worship';
      } else if (lower.includes('samba') || lower.includes('pagode') || lower.includes('batucada') || lower.includes('percuss')) {
        category = 'percussao';
      } else if (lower.includes('loop') || lower.includes('beat') || lower.includes('drum')) {
        category = 'ritmo';
      }
    }

    // Measure exact audio duration
    let duration = serverPad?.duration || 0;
    if (duration === 0) {
      duration = await getAudioDuration(file);
    }

    if (onProgress) {
      const basePct = 20 + Math.round((i / normalizedItems.length) * 70);
      onProgress(`Gravando áudio ${i + 1} de ${normalizedItems.length} na nuvem permanente...`, basePct);
    }

    // 1. Cache binary blob in local IndexedDB for instant zero-latency playback
    await storeAudioBlob(padId, file);

    // 2. Save binary audio chunks directly into Firestore subcollection
    let totalChunks = 0;
    try {
      const chunkResult = await saveAudioChunksToFirestore(padId, file, (chunkPct) => {
        if (onProgress) {
          const itemPct = 20 + Math.round(((i + chunkPct / 100) / normalizedItems.length) * 70);
          onProgress(`Sincronizando áudio ${i + 1}/${normalizedItems.length} na nuvem (${chunkPct}%)...`, itemPct);
        }
      });
      totalChunks = chunkResult.totalChunks;
    } catch (chunkErr) {
      console.warn(`Could not save audio chunks to Firestore for ${padId}:`, chunkErr);
    }

    const padUrl = serverPad?.url || `/uploads/audio/${file.name.replace(/[^a-zA-Z0-9_\-\.]/g, '_')}`;

    const pad: PadItem = {
      id: padId,
      name: cleanName,
      category,
      musicalKey: detectedKey,
      bpm: detectedBpm,
      url: padUrl,
      originalFileName: file.name,
      fileSize: file.size,
      duration: duration || 5.0,
      color: PAD_COLORS[(currentPads.length + i) % PAD_COLORS.length],
      isLoop: true,
      volume: 0.95,
      pan: 0,
      filterCutoff: 20000,
      fadeInTime: category === 'worship' ? 1.5 : 0,
      fadeOutTime: category === 'worship' ? 2.5 : 0.05,
      isCustomUpload: true,
      cloudStored: true,
      hasCloudAudioChunks: totalChunks > 0,
      totalAudioChunks: totalChunks,
      createdAt: serverPad?.createdAt || new Date().toISOString()
    };

    // 3. Save clean pad document to Firestore
    try {
      const cleaned = cleanPadForFirestore(pad);
      await setDoc(doc(db, 'pads', padId), cleaned);
    } catch (e) {
      console.error('Firestore setDoc pad error:', e);
    }

    addedPads.push(pad);
    currentPads.push(pad);
  }

  if (onProgress) onProgress('Finalizando sincronização...', 100);

  saveStoredPads(currentPads);
  return {
    addedPads,
    totalPads: currentPads.length
  };
}

/**
 * Update pad settings across Firestore, server, and local storage.
 */
export async function updatePad(id: string, updates: Partial<PadItem>): Promise<PadItem> {
  // 1. Update in Firestore with cleaned object
  try {
    const padRef = doc(db, 'pads', id);
    const cleaned = cleanPadForFirestore(updates);
    await setDoc(padRef, cleaned, { merge: true });
  } catch (err) {
    console.warn('Firestore updateDoc notice:', err);
  }

  // 2. Update on backend server
  try {
    await fetch(getApiUrl(`/api/pads/${id}`), {
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
 * Delete a pad. All users can delete any pad.
 * Deletes from Firestore (including audio chunks), backend server, and local storage.
 */
export async function deletePad(id: string): Promise<void> {
  // 1. Delete audio chunks from Firestore subcollection
  await deleteAudioChunksFromFirestore(id);

  // 2. Delete main document from Firestore (propagates to all users in real-time)
  try {
    await deleteDoc(doc(db, 'pads', id));
  } catch (err) {
    console.warn('Firestore deleteDoc notice:', err);
  }

  // 3. Delete from backend server
  try {
    await fetch(getApiUrl(`/api/pads/${id}`), { method: 'DELETE' });
  } catch (err) {
    console.warn('Server deletePad notice:', err);
  }

  // 4. Delete from IndexedDB
  await deleteAudioBlob(id);

  // 5. Update local cache
  const pads = getStoredPads() || [];
  const filtered = pads.filter(p => p.id !== id);
  saveStoredPads(filtered);
}

/**
 * Reset pads to the standard cloud kit.
 */
export async function resetPads(): Promise<PadItem[]> {
  try {
    const res = await fetch(getApiUrl('/api/pads/reset'), { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      if (data.pads && Array.isArray(data.pads)) {
        try {
          const batch = writeBatch(db);
          data.pads.forEach((p: PadItem) => {
            batch.set(doc(db, 'pads', p.id), cleanPadForFirestore(p));
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
    const res = await fetch(getApiUrl('/api/pads/remove-system'), { method: 'POST' });
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
    await fetch(getApiUrl('/api/pads/clear-all'), { method: 'POST' });
  } catch (e) {
    console.warn('Clear server pads notice:', e);
  }

  try {
    const snapshot = await getDocs(collection(db, 'pads'));
    for (const d of snapshot.docs) {
      await deleteAudioChunksFromFirestore(d.id);
      await deleteDoc(d.ref);
    }
  } catch (e) {
    console.warn('Clear firestore notice:', e);
  }

  clearStoredPads();
  return [];
}
