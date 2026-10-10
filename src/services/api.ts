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
  '#eab308', '#84cc16', '#10b981', '#06b6d4',
  '#14b8a6', '#0ea5e9', '#64748b', '#d946ef'
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
 * which cause Firestore SDK setDoc() to throw an error.
 */
export function cleanPadForFirestore<T extends Record<string, any>>(pad: T): Record<string, any> {
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(pad)) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }
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
 * Write a single document with retry logic
 */
async function setDocWithRetry(docRef: any, data: any, maxRetries = 3): Promise<void> {
  let lastError: any = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await setDoc(docRef, data);
      return;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }
    }
  }
  throw lastError;
}

/**
 * Save audio binary chunks directly to Firestore subcollection.
 * Guarantees permanent persistence across all users, devices, and container restarts!
 */
export async function saveAudioChunksToFirestore(
  padId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ totalChunks: number; totalBytes: number }> {
  const base64 = await fileToBase64(file);
  // 320,000 chars per chunk (~240KB binary, safely below Firestore 1MB doc limit)
  const CHUNK_SIZE = 320 * 1024;
  const totalChunks = Math.ceil(base64.length / CHUNK_SIZE);

  // Write chunks in controlled batches of 4
  const BATCH_SIZE = 4;
  for (let batchStart = 0; batchStart < totalChunks; batchStart += BATCH_SIZE) {
    const batchPromises: Promise<any>[] = [];
    const batchEnd = Math.min(batchStart + BATCH_SIZE, totalChunks);

    for (let i = batchStart; i < batchEnd; i++) {
      const chunkData = base64.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const chunkDocRef = doc(db, 'pads', padId, 'audioChunks', String(i));
      batchPromises.push(
        setDocWithRetry(chunkDocRef, {
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

  return { totalChunks, totalBytes: file.size };
}

/**
 * Retrieve audio binary chunks from Firestore subcollection and reconstruct into ArrayBuffer.
 * Enables audio playback on ANY device connected to the database.
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
 * The Firestore database is the AUTHORITATIVE SINGLE SOURCE OF TRUTH across all devices.
 * When ANY user adds, updates, or deletes a pad, all connected devices receive the update immediately.
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

        firestoreList.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        // Authoritative sync: save current cloud pads to local cache
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
 * Fetch all pads from Firestore database.
 * If Firestore is available, its state is returned and saved locally.
 */
export async function fetchPads(): Promise<PadItem[]> {
  try {
    const padsCol = collection(db, 'pads');
    const snapshot = await getDocs(padsCol);
    const firestoreList: PadItem[] = [];
    snapshot.forEach(d => {
      firestoreList.push({ ...(d.data() as PadItem), id: d.id });
    });
    firestoreList.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    saveStoredPads(firestoreList);
    return firestoreList;
  } catch (err) {
    console.warn('fetchPads Firestore notice, using local cache:', err);
    const local = getStoredPads() || [];
    return local;
  }
}

/**
 * Fetch cloud storage stats for all users.
 */
export async function fetchCloudStats(): Promise<CloudStorageStats> {
  try {
    const pads = await fetchPads();
    const customCount = pads.filter(p => p.isCustomUpload).length;
    const totalBytes = pads.reduce((acc, p) => acc + (p.fileSize || 500000), 0);
    const totalSizeMb = Math.round((totalBytes / (1024 * 1024)) * 100) / 100;

    return {
      totalPads: pads.length,
      totalSizeMb,
      customPadsCount: customCount,
      storageQuotaMb: 10240,
    };
  } catch {
    return {
      totalPads: 0,
      totalSizeMb: 0,
      customPadsCount: 0,
      storageQuotaMb: 10240,
    };
  }
}

/**
 * Upload audio files.
 * TRIPLE-PERSISTENCE ARCHITECTURE:
 * 1. Saves full binary audio chunks to Firestore subcollection (pads/{padId}/audioChunks)
 *    for PERMANENT multi-device cloud storage synchronized across all phones and computers.
 * 2. Caches audio blob in IndexedDB for instantaneous local zero-latency playback.
 * 3. Best-effort upload to backend server disk (/uploads/audio) for instant streaming.
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

  // Try uploading to backend /api/upload as auxiliary stream helper
  let serverUploadedPads: any[] = [];
  try {
    if (onProgress) onProgress('Preparando arquivos de áudio...', 5);
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
    console.warn('Auxiliary server upload notice (continuing with database persistence):', err);
  }

  // Process and save each file permanently to Firestore and IndexedDB
  for (let i = 0; i < normalizedItems.length; i++) {
    const { file, category: userCategory } = normalizedItems[i];
    const serverPad = serverUploadedPads[i] || serverUploadedPads.find(p => p.originalFileName === file.name);

    const padId = `pad_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');

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

    // 1. Cache binary blob in local IndexedDB for immediate playback on this device
    await storeAudioBlob(padId, file);

    // 2. Save binary audio chunks directly into Firestore database subcollection
    if (onProgress) {
      const basePct = 10 + Math.round((i / normalizedItems.length) * 80);
      onProgress(`Salvando "${cleanName}" no banco de dados Firestore...`, basePct);
    }

    const chunkResult = await saveAudioChunksToFirestore(padId, file, (chunkPct) => {
      if (onProgress) {
        const itemPct = 10 + Math.round(((i + chunkPct / 100) / normalizedItems.length) * 80);
        onProgress(`Gravando no banco (${i + 1}/${normalizedItems.length}) - ${chunkPct}%...`, itemPct);
      }
    });

    const padUrl = serverPad?.url || `/api/audio/${padId}`;

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
      hasCloudAudioChunks: chunkResult.totalChunks > 0,
      totalAudioChunks: chunkResult.totalChunks,
      createdAt: new Date().toISOString()
    };

    // 3. Save pad metadata document to Firestore
    const cleaned = cleanPadForFirestore(pad);
    await setDoc(doc(db, 'pads', padId), cleaned);

    addedPads.push(pad);
    currentPads.push(pad);
  }

  if (onProgress) onProgress('Finalizando sincronização entre todos os dispositivos...', 100);

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
  // 1. Update in Firestore with cleaned object (synchronizes to all connected devices)
  try {
    const padRef = doc(db, 'pads', id);
    const cleaned = cleanPadForFirestore(updates);
    await setDoc(padRef, cleaned, { merge: true });
  } catch (err) {
    console.warn('Firestore updatePad notice:', err);
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
 * Delete a pad.
 * Deletes from Firestore (including all audio chunks), propagates to all devices in real-time.
 */
export async function deletePad(id: string): Promise<void> {
  // 1. Delete audio chunks from Firestore subcollection
  await deleteAudioChunksFromFirestore(id);

  // 2. Delete main document from Firestore (propagates to all users in real-time via onSnapshot)
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
    const snapshot = await getDocs(collection(db, 'pads'));
    const batch = writeBatch(db);
    let toDeleteCount = 0;
    snapshot.forEach((d) => {
      const item = d.data() as PadItem;
      if (!item.isCustomUpload) {
        batch.delete(d.ref);
        toDeleteCount++;
      }
    });
    if (toDeleteCount > 0) {
      await batch.commit();
    }
  } catch (e) {
    console.warn('Firestore remove system notice:', e);
  }

  try {
    await fetch(getApiUrl('/api/pads/remove-system'), { method: 'POST' });
  } catch (e) {
    console.warn('Remove system notice:', e);
  }

  const current = await fetchPads();
  const customOnly = current.filter(p => p.isCustomUpload);
  saveStoredPads(customOnly);
  return customOnly;
}

/**
 * Clear all pads completely across all devices and database.
 */
export async function clearAllPads(): Promise<PadItem[]> {
  try {
    const snapshot = await getDocs(collection(db, 'pads'));
    for (const d of snapshot.docs) {
      await deleteAudioChunksFromFirestore(d.id);
      await deleteDoc(d.ref);
    }
  } catch (e) {
    console.warn('Clear firestore notice:', e);
  }

  try {
    await fetch(getApiUrl('/api/pads/clear-all'), { method: 'POST' });
  } catch (e) {
    console.warn('Clear server pads notice:', e);
  }

  clearStoredPads();
  return [];
}
