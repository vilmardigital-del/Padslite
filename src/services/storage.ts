import { PadItem } from '../types';
import { DEFAULT_PADS } from '../constants/defaultPads';

const STORAGE_KEY = 'cloud_audio_pads_v2';
const DB_NAME = 'pad_audio_cache_db';
const DB_VERSION = 1;
const STORE_NAME = 'audio_blobs';

// Open IndexedDB safely
function openIndexedDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => resolve(null);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result as IDBDatabase;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    } catch {
      resolve(null);
    }
  });
}

// Store audio blob in IndexedDB
export async function storeAudioBlob(id: string, blob: Blob | ArrayBuffer): Promise<boolean> {
  try {
    const db = await openIndexedDB();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(blob, id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

// Retrieve audio blob from IndexedDB
export async function getAudioBlob(id: string): Promise<Blob | ArrayBuffer | null> {
  try {
    const db = await openIndexedDB();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

// Delete audio blob from IndexedDB
export async function deleteAudioBlob(id: string): Promise<boolean> {
  try {
    const db = await openIndexedDB();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

// Get saved pads from localStorage
export function getStoredPads(): PadItem[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to parse localStorage pads:', e);
  }
  return null;
}

// Save pads to localStorage
export function saveStoredPads(pads: PadItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pads));
  } catch (e) {
    console.warn('Failed to save pads to localStorage:', e);
  }
}

// Remove system pads keeping only custom uploads
export function removeSystemPadsFromStorage(): PadItem[] {
  const current = getStoredPads() || [];
  const customOnly = current.filter(p => p.isCustomUpload === true);
  saveStoredPads(customOnly);
  return customOnly;
}

// Clear stored pads
export function clearStoredPads(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  } catch (e) {
    console.warn('Failed to clear localStorage pads:', e);
  }
}

// Default pads: now empty so user can add their own pads
export function getDefaultPads(): PadItem[] {
  return [];
}

// Factory example pads (optional recovery)
export function getFactoryPads(): PadItem[] {
  return JSON.parse(JSON.stringify(DEFAULT_PADS));
}
