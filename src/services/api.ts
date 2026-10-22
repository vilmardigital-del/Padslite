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
 * Audio binary chunks helper (no-op since audio is stored on server filesystem and cached in IndexedDB).
 */
export async function getAudioChunksFromFirestore(_padId: string): Promise<ArrayBuffer | null> {
  return null;
}

/**
 * Delete audio chunks helper (no-op).
 */
export async function deleteAudioChunksFromFirestore(_padId: string): Promise<void> {
  return Promise.resolve();
}

/**
 * Audio chunk saver (no-op to prevent Firestore quota limit exhaustion).
 * Audio files are stored on server disk and cached in local browser IndexedDB.
 */
export async function saveAudioChunksToFirestore(
  _padId: string,
  _fileOrBuffer: File | Blob | ArrayBuffer,
  onProgress?: (percent: number) => void
): Promise<{ totalChunks: number; totalBytes: number }> {
  if (onProgress) onProgress(100);
  return { totalChunks: 0, totalBytes: 0 };
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
        const errText = await fetchResp.text().catch(() => '');
        throw new Error(`Erro no servidor (${fetchResp.status}): ${errText || 'Falha ao salvar áudio'}`);
      }
    } catch (fetchErr: any) {
      console.error('Fetch upload error:', fetchErr);
      throw new Error('Falha ao conectar com o servidor. Verifique sua conexão com a internet e tente novamente.');
    }
  }

  if (!uploadResponse || !uploadResponse.success || !Array.isArray(uploadResponse.addedPads)) {
    throw new Error('Falha ao processar os arquivos de áudio no servidor.');
  }

  const serverAddedPads: PadItem[] = uploadResponse.addedPads;

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

  // Update and set stored pads so new pads are immediately available
  const allCurrentPads = await fetchPads();
  saveStoredPads(allCurrentPads);

  if (onProgress) onProgress('Áudios salvos com sucesso e sincronizados!', 100);

  return {
    addedPads: serverAddedPads,
    totalPads: allCurrentPads.length
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
