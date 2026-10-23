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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 0x8000;
  for (let i = 0; i < len; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, Math.min(i + chunkSize, len))));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Retrieve audio chunks from Firestore and reconstruct ArrayBuffer.
 */
export async function getAudioChunksFromFirestore(padId: string): Promise<ArrayBuffer | null> {
  try {
    const snap = await getDocs(collection(db, 'pads', padId, 'audioChunks'));
    if (snap.empty) return null;

    const chunks: Array<{ index: number; data: string }> = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data && data.data) {
        chunks.push({ index: data.index ?? 0, data: data.data });
      }
    });

    if (chunks.length === 0) return null;
    chunks.sort((a, b) => a.index - b.index);

    const buffers: ArrayBuffer[] = chunks.map((c) => base64ToArrayBuffer(c.data));
    const totalLength = buffers.reduce((acc, b) => acc + b.byteLength, 0);

    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const b of buffers) {
      result.set(new Uint8Array(b), offset);
      offset += b.byteLength;
    }

    return result.buffer;
  } catch (err) {
    console.warn('Notice reading audio chunks from cloud:', err);
    return null;
  }
}

/**
 * Delete audio chunks from Firestore.
 */
export async function deleteAudioChunksFromFirestore(padId: string): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'pads', padId, 'audioChunks'));
    for (const d of snap.docs) {
      await deleteDoc(d.ref).catch(() => {});
    }
  } catch {}
}

/**
 * Save audio chunks to Firestore in slices of ~600KB (well under 1MB doc limit).
 * Used as cloud backup and for Vercel/serverless environments.
 */
/**
 * Save audio chunks to Firestore in slices of ~480KB (well under 1MB doc limit).
 * Used as cloud backup and for Vercel/serverless environments.
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
    } else if (fileOrBuffer && typeof (fileOrBuffer as any).arrayBuffer === 'function') {
      arrayBuffer = await (fileOrBuffer as Blob).arrayBuffer();
    } else {
      return { totalChunks: 0, totalBytes: 0 };
    }

    const totalBytes = arrayBuffer.byteLength;
    // Chunk size: 480,000 bytes raw (~640KB base64, safe under 1MB limit)
    const CHUNK_SIZE = 480000;
    const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalBytes);
      const slice = arrayBuffer.slice(start, end);
      const base64Data = arrayBufferToBase64(slice);

      const chunkRef = doc(db, 'pads', padId, 'audioChunks', `chunk_${i}`);
      let written = false;
      for (let attempt = 0; attempt < 3 && !written; attempt++) {
        try {
          await setDoc(chunkRef, {
            index: i,
            totalChunks,
            totalBytes,
            data: base64Data,
            createdAt: new Date().toISOString()
          });
          written = true;
        } catch (writeErr) {
          if (attempt === 2) throw writeErr;
          await new Promise(r => setTimeout(r, 300));
        }
      }

      if (onProgress) {
        onProgress(Math.round(((i + 1) / totalChunks) * 100));
      }
    }

    return { totalChunks, totalBytes };
  } catch (e) {
    console.warn('Notice saving cloud chunks:', e);
    return { totalChunks: 0, totalBytes: 0 };
  }
}

const ADMIN_PIN = '4526';

/**
 * Safely merge pad lists when combining multiple incoming sources.
 */
export function mergePads(basePads: PadItem[], incomingPads: PadItem[]): PadItem[] {
  const map = new Map<string, PadItem>();

  basePads.forEach((p) => {
    if (p && p.id) map.set(p.id, p);
  });

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
 * Uses a dual authoritative sync architecture:
 * 1. Server-Sent Events (SSE) from the backend server (/api/events) - instant push across all devices
 * 2. Active Polling interval (every 4 seconds) - rock-solid connectivity guarantee
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
            // Authoritative server state: replace cache and broadcast
            saveStoredPads(data.pads);
            callback(data.pads);
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

  // 2. Cloud Firestore real-time listener
  try {
    const padsCol = collection(db, 'pads');
    firestoreUnsub = onSnapshot(
      padsCol,
      (snapshot) => {
        if (!isSubscribed) return;
        const firestoreList: PadItem[] = [];
        snapshot.forEach((d) => {
          const item = { ...(d.data() as PadItem), id: d.id };
          firestoreList.push(item);
        });
        firestoreList.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        saveStoredPads(firestoreList);
        callback(firestoreList);
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
          saveStoredPads(data.pads);
          callback(data.pads);
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
 * Authoritative: reflects actual current cloud database.
 */
export async function fetchPads(): Promise<PadItem[]> {
  try {
    const res = await fetch(getApiUrl('/api/pads'), { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.pads)) {
        saveStoredPads(data.pads);
        return data.pads;
      }
    }
  } catch (err) {
    console.warn('Server fetchPads notice, checking Firestore:', err);
  }

  // Query Firestore directly if server was transiently unreachable
  try {
    const snap = await getDocs(collection(db, 'pads'));
    const firestorePads: PadItem[] = [];
    snap.forEach(d => {
      const item = { ...(d.data() as PadItem), id: d.id };
      firestorePads.push(item);
    });
    firestorePads.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    saveStoredPads(firestorePads);
    return firestorePads;
  } catch (err) {
    console.warn('Firestore fetchPads notice:', err);
  }

  return getStoredPads() || [];
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
  formData.append('adminPin', ADMIN_PIN);

  const uploadUrl = getApiUrl('/api/upload?adminPin=' + encodeURIComponent(ADMIN_PIN));
  let uploadResponse: any = null;

  // 1. Primary upload attempt via XMLHttpRequest for smooth 0% -> 90% progress
  try {
    uploadResponse = await new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl, true);

      try {
        xhr.setRequestHeader('x-admin-pin', ADMIN_PIN);
      } catch {}

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const transferPercent = Math.min(85, 5 + Math.round((event.loaded / event.total) * 80));
          onProgress(`Enviando áudios para a nuvem (${transferPercent}%)...`, transferPercent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error('Resposta inválida do servidor de áudio.'));
          }
        } else if (xhr.status === 403) {
          reject(new Error('Acesso restrito: Senha de administrador incorreta ou necessária.'));
        } else {
          try {
            const json = JSON.parse(xhr.responseText);
            reject(new Error(json.error || `Erro HTTP ${xhr.status}`));
          } catch {
            reject(new Error(`Erro HTTP ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => reject(new Error('xhr_network_error'));
      xhr.ontimeout = () => reject(new Error('xhr_timeout'));
      xhr.timeout = 180000; // 3 minutes timeout for audio files
      xhr.send(formData);
    });
  } catch (xhrErr: any) {
    if (xhrErr?.message?.includes('Acesso restrito')) {
      throw xhrErr;
    }
    console.warn('XHR upload notice, executing robust fetch fallback:', xhrErr);
  }

  // 2. Resilient Fallback via native fetch() if XHR suffered network/CORS error
  if (!uploadResponse || !uploadResponse.success) {
    if (onProgress) onProgress('Transmitindo áudios diretamente para o servidor...', 70);
    try {
      const fetchResp = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'x-admin-pin': ADMIN_PIN,
        },
        body: formData,
      });

      if (fetchResp.ok) {
        uploadResponse = await fetchResp.json();
      } else {
        if (fetchResp.status === 403) {
          throw new Error('Acesso restrito: Senha de administrador incorreta.');
        }
        console.warn(`Server upload status ${fetchResp.status}, falling back to Cloud Firestore.`);
      }
    } catch (fetchErr: any) {
      console.warn('Server upload not reachable (e.g. Vercel/serverless), activating Cloud Firestore storage:', fetchErr);
    }
  }

  let serverAddedPads: PadItem[] = [];

  if (uploadResponse && uploadResponse.success && Array.isArray(uploadResponse.addedPads)) {
    serverAddedPads = uploadResponse.addedPads;
  } else {
    // 3. Fallback: Server was unavailable or running on Vercel/serverless!
    // Save audio into local IndexedDB + Cloud Firestore so it is NEVER lost!
    if (onProgress) onProgress('Salvando áudio no banco de dados em nuvem...', 70);
    const existingPads = getStoredPads() || [];

    for (let i = 0; i < normalizedItems.length; i++) {
      const item = normalizedItems[i];
      const padId = `pad-cloud-${Date.now()}-${i}`;
      const cleanName = item.file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');

      const keyMatch = item.file.name.match(/\b([A-G][#b]?m?)\b/i);
      const detectedKey = keyMatch ? keyMatch[1].toUpperCase() : undefined;
      const bpmMatch = item.file.name.match(/(\d{2,3})\s*bpm/i);
      const detectedBpm = bpmMatch ? parseInt(bpmMatch[1], 10) : undefined;
      const duration = await getAudioDuration(item.file);
      const category = item.category || 'worship';

      // 1. Cache binary blob in local IndexedDB for instant 0ms playback
      await storeAudioBlob(padId, item.file).catch(() => {});

      // 2. Upload chunks to Firestore (supports up to 25MB) so other devices can stream on Vercel
      if (item.file.size < 25 * 1024 * 1024) {
        if (onProgress) onProgress(`Sincronizando áudio ${i + 1} de ${normalizedItems.length} na nuvem...`, 80);
        await saveAudioChunksToFirestore(padId, item.file, (chunkPct) => {
          if (onProgress) {
            onProgress(`Sincronizando áudio ${i + 1} de ${normalizedItems.length} (${chunkPct}%)...`, 75 + Math.round(chunkPct * 0.15));
          }
        }).catch(() => {});
      }

      const pad: PadItem = {
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
        createdAt: new Date().toISOString()
      };

      // 3. Save metadata doc to Firestore
      try {
        await setDoc(doc(db, 'pads', padId), cleanPadForFirestore(pad));
      } catch (err) {
        console.warn('Notice saving pad doc to Firestore:', err);
      }

      serverAddedPads.push(pad);
    }
  }

  if (serverAddedPads.length === 0) {
    throw new Error('Falha ao processar os arquivos de áudio.');
  }

  if (onProgress) onProgress('Gravando no banco de dados e sincronizando...', 90);

  // Cache audio in local IndexedDB for instant playback & sync metadata
  for (let i = 0; i < serverAddedPads.length; i++) {
    const pad = serverAddedPads[i];
    const originalItem = normalizedItems.find(it => it.file.name === pad.originalFileName) || normalizedItems[i];

    if (originalItem?.file) {
      // Cache binary blob in local IndexedDB for immediate zero-latency playback
      await storeAudioBlob(pad.id, originalItem.file).catch(() => {});

      // Extract accurate duration if server didn't have it
      if (!pad.duration || pad.duration === 0) {
        getAudioDuration(originalItem.file).then((accurateDuration) => {
          if (accurateDuration > 0) {
            pad.duration = accurateDuration;
            fetch(getApiUrl(`/api/pads/${pad.id}?adminPin=${encodeURIComponent(ADMIN_PIN)}`), {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'x-admin-pin': ADMIN_PIN,
              },
              body: JSON.stringify({ duration: accurateDuration, adminPin: ADMIN_PIN })
            }).catch(() => {});
          }
        }).catch(() => {});
      }

      // Best effort sync metadata doc to Firestore
      try {
        const cleaned = cleanPadForFirestore(pad);
        setDoc(doc(db, 'pads', pad.id), cleaned).catch(() => {});
      } catch {
        // non-blocking
      }
    }
  }

  // Update and set stored pads immediately so new pads appear with zero delay
  const existingStored = getStoredPads() || [];
  const mergedPads = mergePads(existingStored, serverAddedPads);
  saveStoredPads(mergedPads);

  try {
    const allCurrentPads = await fetchPads();
    if (allCurrentPads && allCurrentPads.length > 0) {
      saveStoredPads(mergePads(mergedPads, allCurrentPads));
    }
  } catch {}

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
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': ADMIN_PIN,
      },
      body: JSON.stringify({ ...updates, adminPin: ADMIN_PIN }),
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
      headers: {
        'x-admin-pin': ADMIN_PIN,
      },
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
    const res = await fetch(getApiUrl('/api/pads/reset'), {
      method: 'POST',
      headers: {
        'x-admin-pin': ADMIN_PIN,
      },
    });
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
    const res = await fetch(getApiUrl('/api/pads/remove-system'), {
      method: 'POST',
      headers: {
        'x-admin-pin': ADMIN_PIN,
      },
    });
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
    await fetch(getApiUrl('/api/pads/clear-all'), {
      method: 'POST',
      headers: {
        'x-admin-pin': ADMIN_PIN,
      },
    });
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

  // 3. Clear local storage & IndexedDB
  clearStoredPads();
  return [];
}

/**
 * Create a pad from a public audio URL (e.g. Google Drive direct link, Dropbox, S3, cloud URL).
 * Perfect for Vercel and multi-device cloud streaming.
 */
export async function createPadFromUrl(params: {
  name: string;
  url: string;
  category: PadItem['category'];
  musicalKey?: string;
  bpm?: number;
}): Promise<PadItem> {
  const padId = `pad-url-${Date.now()}`;
  const existingPads = getStoredPads() || [];

  const pad: PadItem = {
    id: padId,
    name: params.name,
    category: params.category || 'worship',
    musicalKey: params.musicalKey,
    bpm: params.bpm,
    url: params.url,
    originalFileName: params.name,
    fileSize: 1000000,
    duration: 0,
    color: PAD_COLORS[existingPads.length % PAD_COLORS.length],
    isLoop: true,
    volume: 0.95,
    pan: 0,
    filterCutoff: 20000,
    fadeInTime: params.category === 'worship' ? 1.5 : 0,
    fadeOutTime: params.category === 'worship' ? 2.5 : 0.05,
    isCustomUpload: true,
    cloudStored: true,
    createdAt: new Date().toISOString()
  };

  // 1. Save metadata doc to Firestore
  try {
    await setDoc(doc(db, 'pads', padId), cleanPadForFirestore(pad));
  } catch (e) {
    console.warn('Firestore setDoc notice:', e);
  }

  // 2. Best-effort notify backend server if active
  fetch(getApiUrl(`/api/pads?adminPin=${encodeURIComponent(ADMIN_PIN)}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-pin': ADMIN_PIN },
    body: JSON.stringify({ ...pad, adminPin: ADMIN_PIN })
  }).catch(() => {});

  // 3. Update local cache
  const current = await fetchPads();
  const next = [...current.filter(p => p.id !== padId), pad];
  saveStoredPads(next);
  return pad;
}
