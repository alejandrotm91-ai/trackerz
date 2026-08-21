/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const DB_NAME = 'ProjectTrackerDB';
const DB_VERSION = 1;
const STORE_NAME = 'app_cache';

/**
 * Opens or initializes the IndexedDB database instance.
 */
function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Stores any data in IndexedDB (handles large datasets without localStorage quota limits).
 */
export async function setIdbItem<T>(key: string, value: T): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`IndexedDB set error for key "${key}":`, err);
  }
}

/**
 * Retrieves data from IndexedDB.
 */
export async function getIdbItem<T>(key: string): Promise<T | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`IndexedDB get error for key "${key}":`, err);
    return null;
  }
}

/**
 * Deletes an item from IndexedDB.
 */
export async function deleteIdbItem(key: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`IndexedDB delete error for key "${key}":`, err);
  }
}

/**
 * Safely saves data into both IndexedDB (full capacity) and localStorage (if space allows).
 * Never throws a QuotaExceededError.
 */
export async function safeSaveCache<T>(key: string, value: T): Promise<void> {
  // 1. Always save full dataset to IndexedDB
  await setIdbItem(key, value);

  // 2. Safely attempt to write to localStorage
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // Quota exceeded: clean up from localStorage so no stale truncated data remains
    console.warn(`localStorage quota exceeded for "${key}". Saved safely to IndexedDB.`);
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

/**
 * Safely retrieves cached data, checking localStorage first then IndexedDB.
 */
export async function safeGetCache<T>(key: string): Promise<T | null> {
  // 1. Try localStorage
  try {
    const local = localStorage.getItem(key);
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed !== null && parsed !== undefined) {
        return parsed;
      }
    }
  } catch (e) {
    // ignore
  }

  // 2. Check IndexedDB
  return await getIdbItem<T>(key);
}
