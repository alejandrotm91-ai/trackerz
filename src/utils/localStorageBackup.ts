/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Actividad, PlanillaItem } from '../types';
import { safeSaveCache, safeGetCache } from './idbStorage';

const STORAGE_KEY = 'control_tracker_plan_backup';

export interface LocalPlanBackup {
  actividades: Actividad[];
  planillaHojas: PlanillaItem[];
  planillaPartidas: PlanillaItem[];
  planillaCDOvsS: any;
  planillaTotales: any;
  planillaEnmiendas: any[];
  planillaTipRes: any[];
  planillaInfo: any;
  fileData: any;
  periodoSeleccionado: any;
  fechaCorteState: string;
  mapaColumnasMes: any;
  dataPlanificado?: any;
  dataPlanificadoPG004?: any;
}

export function savePlanToLocalStorage(data: LocalPlanBackup): boolean {
  // Fire and forget to IndexedDB for large payloads
  safeSaveCache(STORAGE_KEY, data).catch(e => console.warn('safeSaveCache plan backup error:', e));

  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, serialized);
    return true;
  } catch (err) {
    console.warn('localStorage quota reached for plan backup. Saved safely to IndexedDB.');
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    return true;
  }
}

export function loadPlanFromLocalStorage(): LocalPlanBackup | null {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (serialized) {
      return JSON.parse(serialized);
    }
  } catch (err) {
    console.warn('No se pudo leer la copia de seguridad de localStorage:', err);
  }
  return null;
}

export async function loadPlanFromLocalCacheAsync(): Promise<LocalPlanBackup | null> {
  return await safeGetCache<LocalPlanBackup>(STORAGE_KEY);
}
