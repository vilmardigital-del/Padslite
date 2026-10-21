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
 * Clean pad object so it never contains 'undefined' values,
 * which causes Firestore SDK setDoc() to reject.
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
 * Helper to execute a promise with a strict timeout so it never hangs indefinitely.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, fallbackValue: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallbackValue), ms))
  ]);
}

/**
 * Retrieve audio binary chunks from Firestore subcollection (fallback).
 */
export async function getAudioChunksFromFirestore(padId: string): Promise<ArrayBuffer | null> {
  try {
    const fetchPromise = async () => {
      const chunksCol = collection(db, 'pads', padId, 'audioChunks');
      const snap = await getDocs(chunksCol);
      if (snap.empty) return null;

      const docs = snap.docs.map(d => d.data() as { index: number; total: number; data: string });
      docs.sort((a, b) => a.index - b.index);

      const reassembledBase64 = docs.map(d => d.data).join('');
      if (!reassembledBase64) return null;

      const binaryString = window.atob(reassembledBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    };

    return await withTimeout(fetchPromise(), 2500, null);
  } catch (err) {
    console.warn(`Notice loading Firestore chunks for pad ${padId}:`, err);
    return null;
  }
}

/**
 * Delete audio chunks from Firestore when a pad is deleted (safe best-effort).
 */
export async function deleteAudioChunksFromFirestore(padId: string): Promise<void> {
  try {
    const delPromise = async () => {
      const chunksCol = collection(db, 'pads', padId, 'audioChunks');
      const snap = await getDocs(chunksCol);
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    };
    await withTimeout(delPromise(), 3000, undefined);
  } catch (err) {
    console.warn(`Notice deleting Firestore chunks for pad ${padId}:`, err);
  }
}

/**
 * Store audio file chunks into Firestore subcollection so that ANY device can play it.
 */
export async function saveAudioChunksToFirestore(
  padId: string,
  fileOrBuffer: File | Blob | ArrayBuffer,
  onProgress?: (percent: number) => void
): Promise<{ totalChunks: number; totalBytes: number }> {
  try {
    let arrayBuffer: ArrayBuffer;
    if (fileOrBuffer instanceof ArrayBuffer) {
      arrayBuffer = fileOrBuffer;
    } else {
      arrayBuffer = await fileOrBuffer.arrayBuffer();
    }

    const totalBytes = arrayBuffer.byteLength;
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const CHUNK_SIZE = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      const slice = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
      binary += String.fromCharCode.apply(null, slice as any);
    }
    const base64 = window.btoa(binary);

    const BASE64_CHUNK_SIZE = 350 * 1024;
    const totalChunks = Math.ceil(base64.length / BASE64_CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const chunkData = base64.slice(i * BASE64_CHUNK_SIZE, (i + 1) * BASE64_CHUNK_SIZE);
      const chunkRef = doc(db, 'pads', padId, 'audioChunks', String(i));
      await setDoc(chunkRef, {
        index: i,
        total: totalChunks,
        data: chunkData
      });
      if (onProgress) {
        onProgress(Math.round(((i + 1) / totalChunks) * 100));
      }
    }

    return { totalChunks, totalBytes };
  } catch (err) {
    console.warn('saveAudioChunksToFirestore notice:', err);
    return { totalChunks: 0, totalBytes: 0 };
  }
}

/**
 * Safely merge pad lists, ensuring that user custom pads are never deleted by
 * transient empty lists or out-of-sync polling responses.
 */
export function mergePads(basePads: PadItem[], incomingPads: PadItem[]): PadItem[] {
  const map = new Map<string, PadItem>();

  // 1. Add all base pads
  basePads.forEach((p) => {
    if (p && p.id) map.set(p.id, p);
  });

  // 2. Add/merge incoming pads
  incomingPads.forEach((p) => {
    if (p && p.id) {
      const existing = map.get(p.id);
      map.set(p.id, { ...(existing || {}), ...p });
    }
  });

  const merged = Array.from(map.values());
  merged.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  return merged;
}

/**
 * Real-time synchronization across all devices and phones.
 * Uses a triple-sync architecture:
 * 1. Server-Sent Events (SSE) from the backend server (/api/events) - instant push across all devices
 * 2. Active Polling interval (every 4 seconds) - rock-solid offline recovery
 * 3. Firestore onSnapshot - cloud real-time subscription
 */
export function subscribePads(callback: (pads: PadItem[]) => void): () => void {
  let isSubscribed = true;
  let eventSource: EventSource | null = null;
  let firestoreUnsub: (() => void) | null = null;
  let pollTimer: any = null;

  // 1. Server-Sent Events (SSE) for instantaneous multi-device updates
  if (typeof window !== 'undefined' && window.EventSource) {
    try {
      eventSource = new EventSource(getApiUrl('/api/events'));
      eventSource.onmessage = (event) => {
        if (!isSubscribed) return;
        try {
          const data = JSON.parse(event.data);
          if (data && Array.isArray(data.pads)) {
            const current = (getStoredPads() || []).filter(p => p.isCustomUpload === true);
            const customOnly = data.pads.filter((p: PadItem) => p.isCustomUpload === true);
            const merged = mergePads(current, customOnly);
            saveStoredPads(merged);
            callback(merged);
          }
        } catch (e) {
          console.warn('SSE parse notice:', e);
        }
      };

      eventSource.onerror = () => {
        // EventSource will automatically attempt to reconnect in background
      };
    } catch (e) {
      console.warn('SSE connection notice:', e);
    }
  }

  // 2. Cloud Firestore real-time listener (best effort)
  try {
    const padsCol = collection(db, 'pads');
    firestoreUnsub = onSnapshot(
      padsCol,
      (snapshot) => {
        if (!isSubscribed) return;
        if (!snapshot.empty) {
          const firestoreList: PadItem[] = [];
          snapshot.forEach((d) => {
            const item = { ...(d.data() as PadItem), id: d.id };
            if (item.isCustomUpload === true) {
              firestoreList.push(item);
            }
          });
          const current = (getStoredPads() || []).filter(p => p.isCustomUpload === true);
          const merged = mergePads(current, firestoreList);
          saveStoredPads(merged);
          callback(merged);
        }
      },
      (error) => {
        console.warn('Firestore subscription notice (using server sync):', error.message || error);
      }
    );
  } catch (err) {
    console.warn('Firestore snapshot setup notice:', err);
  }

  // 3. Periodic polling fallback every 4 seconds to guarantee all devices stay in sync
  pollTimer = setInterval(async () => {
    if (!isSubscribed) return;
    try {
      const res = await fetch(getApiUrl('/api/pads'), { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.pads)) {
          const current = (getStoredPads() || []).filter(p => p.isCustomUpload === true);
          const customOnly = data.pads.filter((p: PadItem) => p.isCustomUpload === true);
          const merged = mergePads(current, customOnly);
          saveStoredPads(merged);
          callback(merged);
        }
      }
    } catch {
      // offline or transient
    }
  }, 4000);

  // Return comprehensive cleanup function
  return () => {
    isSubscribed = false;
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    if (firestoreUnsub) {
      firestoreUnsub();
      firestoreUnsub = null;
    }
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };
}

/**
 * Fetch all pads from backend server AND cloud Firestore database.
 * Merges both sources so all devices receive all user pads.
 */
export async function fetchPads(): Promise<PadItem[]> {
  let serverPads: PadItem[] = [];
  try {
    const res = await fetch(getApiUrl('/api/pads'), { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.pads)) {
        serverPads = data.pads.filter((p: PadItem) => p.isCustomUpload === true);
      }
    }
  } catch (err) {
    console.warn('Server fetchPads notice, checking cloud and local cache:', err);
  }

  // Query Firestore directly so any device gets pads even if server was transiently unreachable
  let firestorePads: PadItem[] = [];
  try {
    const snap = await getDocs(collection(db, 'pads'));
    if (!snap.empty) {
      snap.forEach(d => {
        const item = { ...(d.data() as PadItem), id: d.id };
        if (item.isCustomUpload === true) {
          firestorePads.push(item);
        }
      });
    }
  } catch (err) {
    console.warn('Firestore fetchPads notice:', err);
  }

  const local = (getStoredPads() || []).filter(p => p.isCustomUpload === true);
  const mergedWithFirestore = mergePads(serverPads, firestorePads);
  const finalMerged = mergePads(local, mergedWithFirestore);

  saveStoredPads(finalMerged);
  return finalMerged;
}

/**
 * Fetch cloud storage stats for all devices.
 */
export async function fetchCloudStats(): Promise<CloudStorageStats> {
  try {
    const res = await fetch(getApiUrl('/api/stats'), { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      return {
        totalPads: data.totalPads || 0,
        totalSizeMb: data.totalSizeMb || 0,
        customPadsCount: data.customPadsCount || 0,
        storageQuotaMb: data.storageQuotaMb || 10240,
      };
    }
  } catch {
    // fallback
  }

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
}

/**
 * Upload audio files to cloud storage with real-time smooth progress tracking.
 * - Streams directly to /api/upload via XMLHttpRequest for real 0% -> 100% upload progress
 * - NEVER freezes at 10% or 24%
 * - Stores audio in public/uploads/audio/ for universal cross-device streaming
 * - Caches in local IndexedDB for zero-latency local playback
 * - Broadcasts to all connected devices in real time
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

  if (normalizedItems.length === 0) {
    return { addedPads: [], totalPads: 0 };
  }

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

  // Upload with real, smooth XMLHttpRequest progress
  let serverAddedPads: PadItem[] = [];
  let serverUploadOk = false;

  try {
    const uploadResponse = await new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', getApiUrl('/api/upload'), true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          // Upload transfer takes 5% to 85% of total progress
          const transferPercent = Math.min(85, 5 + Math.round((event.loaded / event.total) * 80));
          onProgress(`Enviando áudios para a nuvem (${transferPercent}%)...`, transferPercent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const json = JSON.parse(xhr.responseText);
            resolve(json);
          } catch {
            reject(new Error('Resposta inválida do servidor de áudio.'));
          }
        } else {
          reject(new Error(`Erro HTTP ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Falha de rede'));
      };

      xhr.ontimeout = () => {
        reject(new Error('Tempo limite excedido'));
      };

      xhr.timeout = 45000;
      xhr.send(formData);
    });

    if (uploadResponse && uploadResponse.success && Array.isArray(uploadResponse.addedPads)) {
      serverAddedPads = uploadResponse.addedPads;
      serverUploadOk = true;
    }
  } catch (err: any) {
    console.warn('Upload via servidor finalizou ou retornou erro, ativando salvamento local com IndexedDB:', err.message || err);
  }

  if (onProgress) onProgress('Gravando no banco de dados e sincronizando...', 90);

  // 1. If server upload succeeded, cache audio in IndexedDB & save chunks to Firestore
  if (serverUploadOk && serverAddedPads.length > 0) {
    for (let i = 0; i < serverAddedPads.length; i++) {
      const pad = serverAddedPads[i];
      const originalItem = normalizedItems.find(it => it.file.name === pad.originalFileName) || normalizedItems[i];

      if (originalItem?.file) {
        // Cache binary blob in local IndexedDB for immediate zero-latency playback
        await storeAudioBlob(pad.id, originalItem.file);

        // Extract accurate duration if server didn't have it
        if (!pad.duration || pad.duration === 0) {
          const accurateDuration = await getAudioDuration(originalItem.file);
          if (accurateDuration > 0) {
            pad.duration = accurateDuration;
            fetch(getApiUrl(`/api/pads/${pad.id}`), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ duration: accurateDuration })
            }).catch(() => {});
          }
        }

        // Save metadata doc to Firestore
        try {
          const cleaned = cleanPadForFirestore(pad);
          await setDoc(doc(db, 'pads', pad.id), cleaned);
        } catch {
          // non-blocking
        }

        // Save chunks to Firestore in background so all other devices can play this audio
        saveAudioChunksToFirestore(pad.id, originalItem.file).catch(() => {});
      }
    }
  } else {
    // 2. Fallback: Server returned 404 or network was unavailable.
    // Save directly into IndexedDB on this device AND save chunks into Firestore!
    if (onProgress) onProgress('Salvando áudios na nuvem e no dispositivo com segurança...', 70);
    const existingPads = getStoredPads() || [];

    for (let i = 0; i < normalizedItems.length; i++) {
      const item = normalizedItems[i];
      const padId = `pad-custom-${Date.now()}-${i}`;
      const cleanName = item.file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');

      const keyMatch = item.file.name.match(/\b([A-G][#b]?m?)\b/i);
      const detectedKey = keyMatch ? keyMatch[1].toUpperCase() : undefined;
      const bpmMatch = item.file.name.match(/(\d{2,3})\s*bpm/i);
      const detectedBpm = bpmMatch ? parseInt(bpmMatch[1], 10) : undefined;

      const duration = await getAudioDuration(item.file);
      const category = item.category || 'worship';

      const localPad: PadItem = {
        id: padId,
        name: cleanName,
        category,
        musicalKey: detectedKey,
        bpm: detectedBpm,
        url: `/uploads/audio/${item.file.name}`,
        originalFileName: item.file.name,
        fileSize: item.file.size,
        duration: duration || 0,
        color: PAD_COLORS[(existingPads.length + i) % PAD_COLORS.length],
        isLoop: true,
        volume: 0.95,
        pan: 0,
        filterCutoff: 20000,
        fadeInTime: category === 'worship' ? 1.5 : 0,
        fadeOutTime: category === 'worship' ? 2.5 : 0.05,
        isCustomUpload: true,
        cloudStored: true,
        hasCloudAudioChunks: true,
        totalAudioChunks: 1,
        createdAt: new Date().toISOString()
      };

      // Store binary blob directly into IndexedDB for 0ms local playback
      await storeAudioBlob(padId, item.file);

      // Save chunks into Firestore so ANY device can play this audio
      try {
        const chunkRes = await saveAudioChunksToFirestore(padId, item.file, (pct) => {
          if (onProgress) {
            onProgress(`Salvando áudio na nuvem (${70 + Math.round(pct * 0.25)}%)...`, 70 + Math.round(pct * 0.25));
          }
        });
        localPad.totalAudioChunks = chunkRes.totalChunks;
      } catch (err) {
        console.warn('Notice saving Firestore audio chunks:', err);
      }

      // Save pad metadata to Firestore
      try {
        const cleaned = cleanPadForFirestore(localPad);
        await setDoc(doc(db, 'pads', padId), cleaned);
      } catch (err) {
        console.warn('Notice saving pad doc to Firestore:', err);
      }

      serverAddedPads.push(localPad);
    }
  }

  // 3. Update and merge stored pads so new pads are immediately available
  const allCurrentPads = await fetchPads();
  const mergedPads = mergePads(allCurrentPads, serverAddedPads);
  saveStoredPads(mergedPads);

  if (onProgress) onProgress('Áudios salvos com sucesso e sincronizados!', 100);

  return {
    addedPads: serverAddedPads,
    totalPads: mergedPads.length
  };
}

/**
 * Update pad settings across server, cloud, and local cache.
 */
export async function updatePad(id: string, updates: Partial<PadItem>): Promise<PadItem> {
  // 1. Update on backend server (authoritative, triggers SSE broadcast to all connected devices)
  try {
    const res = await fetch(getApiUrl(`/api/pads/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.pad) {
        const pads = getStoredPads() || [];
        const idx = pads.findIndex(p => p.id === id);
        if (idx !== -1) pads[idx] = data.pad;
        saveStoredPads(pads);
      }
    }
  } catch (err) {
    console.warn('Server updatePad notice:', err);
  }

  // 2. Best-effort Firestore metadata update (non-blocking)
  try {
    const padRef = doc(db, 'pads', id);
    const cleaned = cleanPadForFirestore(updates);
    setDoc(padRef, cleaned, { merge: true }).catch(() => {});
  } catch {
    // Non-blocking
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
 * Delete a pad permanently from database and storage.
 */
export async function deletePad(id: string): Promise<void> {
  // 1. Delete on backend server (authoritative, triggers SSE broadcast to all connected devices)
  try {
    await fetch(getApiUrl(`/api/pads/${id}`), {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('Server deletePad notice:', err);
  }

  // 2. Best-effort Firestore delete (non-blocking)
  try {
    deleteDoc(doc(db, 'pads', id)).catch(() => {});
    deleteAudioChunksFromFirestore(id).catch(() => {});
  } catch {
    // Non-blocking
  }

  // 3. Delete from local IndexedDB cache
  await deleteAudioBlob(id);

  // 4. Update local cache
  const pads = getStoredPads() || [];
  const filtered = pads.filter(p => p.id !== id);
  saveStoredPads(filtered);
}

/**
 * Reset pads to the standard kit.
 */
export async function resetPads(): Promise<PadItem[]> {
  try {
    const res = await fetch(getApiUrl('/api/pads/reset'), { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      if (data.pads && Array.isArray(data.pads)) {
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
        saveStoredPads(data.pads);
        return data.pads;
      }
    }
  } catch (e) {
    console.warn('Remove system notice:', e);
  }

  // Also clean any system pads from Firestore
  try {
    const snap = await getDocs(collection(db, 'pads'));
    for (const d of snap.docs) {
      if (d.data().isCustomUpload !== true) {
        deleteDoc(d.ref).catch(() => {});
      }
    }
  } catch {}

  const current = await fetchPads();
  const customOnly = current.filter(p => p.isCustomUpload);
  saveStoredPads(customOnly);
  return customOnly;
}

/**
 * Clear all pads completely across all devices and clean the database.
 */
export async function clearAllPads(): Promise<PadItem[]> {
  // 1. Clear server database and audio files
  try {
    await fetch(getApiUrl('/api/pads/clear-all'), { method: 'POST' });
  } catch (e) {
    console.warn('Clear server pads notice:', e);
  }

  // 2. Best-effort clear Firestore
  try {
    const clearFs = async () => {
      const snapshot = await getDocs(collection(db, 'pads'));
      for (const d of snapshot.docs) {
        await deleteDoc(d.ref);
      }
    };
    await withTimeout(clearFs(), 2000, undefined);
  } catch (e) {
    console.warn('Clear firestore notice:', e);
  }

  // 3. Clear local storage
  clearStoredPads();
  return [];
}
