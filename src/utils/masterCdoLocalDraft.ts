/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MasterCdoItem, MasterCdoWeek } from '../types/masterCdo';

const DB_NAME = 'master_cdo_local_db';
const STORE_NAME = 'drafts';
const DB_VERSION = 1;

// Versión de la estructura del Master. La 2 cuelga las partidas P6 de su actividad
// (parentActivityId); los borradores anteriores se descartan y el Master se reconstruye.
export const MASTER_DRAFT_SCHEMA_VERSION = 2;

export interface LocalMasterDraft {
  schemaVersion?: number;
  planId: string;
  fileName: string;
  items: MasterCdoItem[];
  semanas: MasterCdoWeek[];
  updatedAt: string;
  isSyncedWithCloud: boolean;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'planId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves draft locally into IndexedDB with timestamp and sync flag
 */
export async function saveLocalMasterDraft(
  planId: string,
  fileName: string,
  items: MasterCdoItem[],
  semanas: MasterCdoWeek[],
  isSyncedWithCloud: boolean = false
): Promise<LocalMasterDraft> {
  const draft: LocalMasterDraft = {
    schemaVersion: MASTER_DRAFT_SCHEMA_VERSION,
    planId: planId || 'master_cdo_default',
    fileName,
    items,
    semanas,
    updatedAt: new Date().toISOString(),
    isSyncedWithCloud
  };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(draft);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Could not save draft to IndexedDB:', err);
  }

  // Also update metadata in localStorage for quick synchronous check
  try {
    const meta = {
      planId: draft.planId,
      fileName: draft.fileName,
      updatedAt: draft.updatedAt,
      isSyncedWithCloud,
      itemsCount: items.length,
      semanasCount: semanas.length
    };
    localStorage.setItem('master_cdo_draft_meta', JSON.stringify(meta));
  } catch (e) {
    // Ignore quota or access errors
  }

  return draft;
}

/**
 * Loads the local draft from IndexedDB
 */
export async function loadLocalMasterDraft(planId: string = 'master_cdo_default'): Promise<LocalMasterDraft | null> {
  try {
    const db = await openDB();
    return await new Promise<LocalMasterDraft | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(planId);
      req.onsuccess = () => {
        const draft: LocalMasterDraft | null = req.result || null;
        if (draft && draft.schemaVersion !== MASTER_DRAFT_SCHEMA_VERSION) {
          console.info('Borrador del Master con estructura anterior: se ignora y se reconstruye.');
          resolve(null);
          return;
        }
        resolve(draft);
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('Error reading from IndexedDB:', err);
    return null;
  }
}

/**
 * Clears the local draft
 */
export async function clearLocalMasterDraft(planId: string = 'master_cdo_default'): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(planId);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
    localStorage.removeItem('master_cdo_draft_meta');
  } catch (e) {
    console.warn('Error clearing local draft:', e);
  }
}
