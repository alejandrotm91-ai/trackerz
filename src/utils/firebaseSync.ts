/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  writeBatch,
  getDocFromServer,
  deleteDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Actividad, PlanillaItem } from '../types';
import { safeSaveCache, safeGetCache } from './idbStorage';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errStr = error instanceof Error ? error.message : String(error);
  const isQuota = errStr.toLowerCase().includes('quota') || 
                  errStr.toLowerCase().includes('resource-exhausted') || 
                  errStr.toLowerCase().includes('limit') ||
                  errStr.toLowerCase().includes('free daily read units');

  const errInfo: FirestoreErrorInfo = {
    error: errStr,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
    },
    operationType,
    path
  };

  if (isQuota) {
    console.warn('Firestore Quota Limit Warning (Fallback local offline storage):', JSON.stringify(errInfo));
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
  throw new Error(JSON.stringify(errInfo));
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Validates connection to Firestore as requested by guidelines
 */
export async function testFirestoreConnection() {
  const pathForConnection = 'test/connection';
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration or network status.");
    }
  }
}

/**
 * Saves a parsed Master Plan to Firestore with subcollections.
 * Uses Firestore Batches of 500 for maximum performance.
 */
export function compressActividad(act: any): any {
  const clean: any = {};
  for (const [key, val] of Object.entries(act)) {
    // Keep essential identity fields
    if (key === 'id' || key === 'wbs' || key === 'descripcion') {
      clean[key] = val;
      continue;
    }
    if (val === null || val === undefined) {
      continue;
    }
    if (val instanceof Date) {
      clean[key] = val.toISOString();
      continue;
    }
    // Remove empty strings
    if (typeof val === 'string' && val.trim() === '') {
      continue;
    }
    // Remove 0 values for fields where 0 is default/falsy (do NOT include totalFloat here, as 0 means critical path)
    if (typeof val === 'number' && val === 0 && (
      key === 'diasAtrasoInicio' || 
      key === 'diasAtrasoFin' || 
      key === 'diasAtrasoMaximo' || 
      key === 'excedente' || 
      key === 'balance' || 
      key === 'saldo' ||
      key === 'ventaFebrero'
    )) {
      continue;
    }
    // Remove false for boolean fields
    if (typeof val === 'boolean' && val === false) {
      continue;
    }
    // Filter empty objects/arrays or objects with only 0/empty values (like certificaciones)
    if (typeof val === 'object') {
      if (Array.isArray(val)) {
        if (val.length === 0) continue;
      } else {
        const subClean: Record<string, any> = {};
        for (const [k, v] of Object.entries(val)) {
          if (v !== null && v !== undefined && v !== '' && v !== 0) {
            subClean[k] = v;
          }
        }
        if (Object.keys(subClean).length === 0) continue;
        clean[key] = subClean;
        continue;
      }
    }
    clean[key] = val;
  }
  return clean;
}

export function compressPlanillaItem(p: any): any {
  const clean: any = {};
  for (const [key, val] of Object.entries(p)) {
    if (key === 'id' || key === 'cod' || key === 'desc') {
      clean[key] = val;
      continue;
    }
    if (val === null || val === undefined) {
      continue;
    }
    if (typeof val === 'string' && val.trim() === '') {
      continue;
    }
    if (typeof val === 'number' && val === 0) {
      continue;
    }
    if (typeof val === 'boolean' && val === false) {
      continue;
    }
    clean[key] = val;
  }
  return clean;
}

/**
 * Deletes a Master Plan completely from Firestore, including all subcollections
 * (actividades, planillaHojas, planillaPartidas, cdo_vs_sabana_F, cdo_vs_sabana_H)
 * using batch deletion (up to 500 ops per batch), and finally deletes the plan document.
 */
export async function deletePlanCompletely(planId: string): Promise<void> {
  if (!planId) return;

  const subcollections = [
    'actividades',
    'planillaHojas',
    'planillaPartidas',
    'cdo_vs_sabana_F',
    'cdo_vs_sabana_H'
  ];

  for (const subcol of subcollections) {
    try {
      const colRef = collection(db, 'master_plans', planId, subcol);
      const snapshot = await getDocs(colRef);
      if (!snapshot.empty) {
        let batch = writeBatch(db);
        let count = 0;

        for (const docSnap of snapshot.docs) {
          batch.delete(docSnap.ref);
          count++;

          if (count === 500) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }

        if (count > 0) {
          await batch.commit();
        }
      }
    } catch (subErr) {
      console.warn(`Error deleting subcollection ${subcol} for plan ${planId}:`, subErr);
    }
  }

  // Finally delete the main plan document
  try {
    const mainDocRef = doc(db, 'master_plans', planId);
    await deleteDoc(mainDocRef);
  } catch (docErr) {
    console.warn(`Error deleting plan document master_plans/${planId}:`, docErr);
  }
}

/**
 * Saves a parsed Master Plan to Firestore with subcollections.
 * Uses dynamic byte-capped chunk sizes (keeping all documents < 450 KB, well within the 1 MB Firestore limit)
 * and sequential document streaming with backoff retries to prevent write errors.
 * Automatically cleans up the previous plan after the new plan is fully persisted.
 */
export async function savePlanToFirebase(
  fileName: string,
  rowCount: number,
  periodoSeleccionado: any,
  fechaCorteState: string,
  mapaColumnasMes: any,
  planillaInfo: any,
  planillaTotales: any,
  planillaCDOvsS: any,
  actividades: Actividad[],
  planillaHojas: PlanillaItem[],
  planillaPartidas: PlanillaItem[],
  planillaEnmiendas: any[],
  planillaTipRes: any[],
  onProgress?: (pct: number, statusMsg: string) => void
): Promise<string> {
  // Read previous active plan ID before writing the new plan
  let oldPlanId: string | null = null;
  try {
    const activeDocSnap = await getDoc(doc(db, 'system_config', 'active_plan'));
    if (activeDocSnap.exists()) {
      oldPlanId = activeDocSnap.data()?.activePlanId || null;
    }
    // Fallback: If active_plan is missing, check latest plan in master_plans
    if (!oldPlanId) {
      const q = query(collection(db, 'master_plans'), orderBy('updatedAt', 'desc'), limit(1));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        oldPlanId = qSnap.docs[0].id;
      }
    }
  } catch (e) {
    console.warn('Could not read old activePlanId (non-blocking):', e);
  }

  const planId = `plan_${Date.now()}`;
  const planPath = `master_plans/${planId}`;

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Accumulate chunk documents to write sequentially
  const operations: { ref: any; data: any; description: string }[] = [];

  const addOperation = (subcolName: string, docId: string, item: any, description: string) => {
    const docRef = doc(db, 'master_plans', planId, subcolName, docId);
    
    // Sanitize fields to avoid undefined values and strip massive duplicate helper objects to keep database size tiny
    const cleanItem = JSON.parse(JSON.stringify(item, (key, value) => {
      if (key === 'unitAgregado' || key === 'scapAgregado' || key === 'capAgregado' || key === 'procesoAgregado') {
        return undefined; // Strips these fields to keep database size tiny. They will be rebuilt on the fly.
      }
      return value === undefined ? null : value;
    }));

    operations.push({ ref: docRef, data: cleanItem, description });
  };

  // Safe chunking helper that guarantees each Firestore document is strictly under ~400 KB (limit is 1,048,576 bytes)
  const chunkArrayBySize = <T>(array: T[], maxBytes: number = 380000, maxCount: number = 350): { id: string; items: T[] }[] => {
    const chunks: { id: string; items: T[] }[] = [];
    let currentChunk: T[] = [];
    let currentEstimatedBytes = 80;

    for (let i = 0; i < array.length; i++) {
      const item = array[i];
      const itemBytes = (JSON.stringify(item) || '').length * 1.5;

      if (currentChunk.length > 0 && (currentEstimatedBytes + itemBytes > maxBytes || currentChunk.length >= maxCount)) {
        chunks.push({
          id: `chunk_${chunks.length}`,
          items: currentChunk
        });
        currentChunk = [];
        currentEstimatedBytes = 80;
      }

      currentChunk.push(item);
      currentEstimatedBytes += itemBytes + 2;
    }

    if (currentChunk.length > 0) {
      chunks.push({
        id: `chunk_${chunks.length}`,
        items: currentChunk
      });
    }
    return chunks;
  };

  // Safe dictionary chunking helper for CDO mapping trees
  const chunkDictBySize = (dict: Record<string, any>, maxBytes: number = 380000, maxKeys: number = 400): { id: string; entries: Record<string, any> }[] => {
    const chunks: { id: string; entries: Record<string, any> }[] = [];
    let currentChunk: Record<string, any> = {};
    let currentBytes = 80;
    let currentKeyCount = 0;

    for (const [k, v] of Object.entries(dict)) {
      const entryBytes = (k.length + (JSON.stringify(v) || '').length + 4) * 1.5;
      if (currentKeyCount > 0 && (currentBytes + entryBytes > maxBytes || currentKeyCount >= maxKeys)) {
        chunks.push({
          id: `chunk_${chunks.length}`,
          entries: currentChunk
        });
        currentChunk = {};
        currentBytes = 80;
        currentKeyCount = 0;
      }
      currentChunk[k] = v;
      currentBytes += entryBytes;
      currentKeyCount++;
    }

    if (currentKeyCount > 0) {
      chunks.push({
        id: `chunk_${chunks.length}`,
        entries: currentChunk
      });
    }

    return chunks;
  };

  // 1. Prepare actividades using dynamic size-capped chunking (max ~380 KB per doc, safe for Firestore 1MB ceiling)
  if (actividades.length > 0) {
    const compressedAct = actividades.map(compressActividad);
    const chunks = chunkArrayBySize(compressedAct, 380000, 350);
    chunks.forEach((chunk, i) => {
      addOperation('actividades', chunk.id, chunk, `Actividades (${i + 1}/${chunks.length})`);
    });
  }

  // 2. Prepare planillaHojas using size-capped chunking
  if (planillaHojas.length > 0) {
    const compressedHojas = planillaHojas.map(compressPlanillaItem);
    const chunks = chunkArrayBySize(compressedHojas, 380000, 500);
    chunks.forEach((chunk, i) => {
      addOperation('planillaHojas', chunk.id, chunk, `Hojas de Planilla (${i + 1}/${chunks.length})`);
    });
  }

  // 3. Prepare planillaPartidas using size-capped chunking
  if (planillaPartidas.length > 0) {
    const compressedPartidas = planillaPartidas.map(compressPlanillaItem);
    const chunks = chunkArrayBySize(compressedPartidas, 380000, 500);
    chunks.forEach((chunk, i) => {
      addOperation('planillaPartidas', chunk.id, chunk, `Partidas de Planilla (${i + 1}/${chunks.length})`);
    });
  }

  // 4. Prepare cdo_vs_sabana_F entries using size-capped chunking
  if (planillaCDOvsS && planillaCDOvsS.F) {
    const fChunks = chunkDictBySize(planillaCDOvsS.F, 380000, 400);
    fChunks.forEach((chunkObj, i) => {
      addOperation('cdo_vs_sabana_F', chunkObj.id, chunkObj, `Mapeos CDO (F) (${i + 1}/${fChunks.length})`);
    });
  }

  // 5. Prepare cdo_vs_sabana_H entries using size-capped chunking
  if (planillaCDOvsS && planillaCDOvsS.H) {
    const hChunks = chunkDictBySize(planillaCDOvsS.H, 380000, 400);
    hChunks.forEach((chunkObj, i) => {
      addOperation('cdo_vs_sabana_H', chunkObj.id, chunkObj, `Mapeos CDO (H) (${i + 1}/${hChunks.length})`);
    });
  }

  // Execute sequential document writes with server ACK and backoff retry.
  // By awaiting each setDoc sequentially with spacing delay, the Firestore client write stream queue
  // depth is strictly kept clear, completely preventing write queue exhaustion.
  const totalOps = operations.length;
  for (let idx = 0; idx < totalOps; idx++) {
    const op = operations[idx];
    const progressPct = 10 + Math.round((idx / (totalOps + 1)) * 85);
    
    if (onProgress) {
      onProgress(progressPct, `Guardando en la nube: ${op.description}...`);
    }

    const writeDocWithRetry = async (retryCount = 0): Promise<void> => {
      try {
        await setDoc(op.ref, op.data);
      } catch (error) {
        const errStr = String(error).toLowerCase();
        const isDailyQuota = errStr.includes('quota') || errStr.includes('free daily write units') || errStr.includes('free daily read units') || errStr.includes('free tier database');
        if (isDailyQuota) {
          // Break immediately on daily quota exhaustion to avoid unnecessary SDK backoff loops
          handleFirestoreError(error, OperationType.WRITE, op.ref.path);
        }
        if (
          retryCount < 3 && 
          (errStr.includes('resource-exhausted') || errStr.includes('backoff') || errStr.includes('unavailable') || errStr.includes('stream') || errStr.includes('queued') || errStr.includes('deadline'))
        ) {
          const waitMs = (retryCount + 1) * 2000;
          console.warn(`Throttling detected on ${op.description}. Retrying in ${waitMs}ms (attempt ${retryCount + 1}/3)...`);
          await delay(waitMs);
          return writeDocWithRetry(retryCount + 1);
        }
        handleFirestoreError(error, OperationType.WRITE, op.ref.path);
      }
    };

    await writeDocWithRetry();
    if (idx < totalOps - 1) {
      await delay(350); // Steady interval between writes to keep Firestore write stream queue healthy
    }
  }

  // 6. Create main plan document at the absolute end, ensuring atomicity (it won't register if subcol writes crash)
  if (onProgress) {
    onProgress(96, 'Finalizando metadatos del Master Plan...');
  }

  try {
    const metaDocDesc = {
      fileName,
      rowCount,
      periodoSeleccionado,
      fechaCorteState,
      mapaColumnasMes,
      planillaInfo: planillaInfo || null,
      planillaTotales: planillaTotales || null,
      planillaEnmiendas: planillaEnmiendas || [],
      planillaTipRes: planillaTipRes || [],
      planillaCDOvsS: {
        desalineados: planillaCDOvsS?.desalineados || []
      },
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'master_plans', planId), metaDocDesc);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, planPath);
  }

  // 7. Update active_plan reference in system_config
  try {
    await setDoc(doc(db, 'system_config', 'active_plan'), {
      activePlanId: planId,
      updatedAt: new Date().toISOString(),
      fileName
    });
  } catch (e) {
    console.warn('Could not update system_config/active_plan:', e);
  }

  // 8. Clean up old plan completely from Firestore now that the new one is fully saved and operational
  if (oldPlanId && oldPlanId !== planId) {
    if (onProgress) {
      onProgress(98, 'Limpiando plan anterior...');
    }
    try {
      await deletePlanCompletely(oldPlanId);
    } catch (cleanErr) {
      console.warn(`Non-blocking notice: Could not fully delete previous plan ${oldPlanId}:`, cleanErr);
    }
  }

  if (onProgress) {
    onProgress(100, '¡Master Plan publicado exitosamente en la nube!');
  }

  return planId;
}

/**
 * Loads the latest uploaded Master Plan and all of its elements
 */
export async function loadLatestPlanFromFirebase(
  onProgress?: (pct: number, statusMsg: string) => void
): Promise<{
  planMeta: any;
  actividades: Actividad[];
  planillaHojas: PlanillaItem[];
  planillaPartidas: PlanillaItem[];
} | null> {
  const masterCollectionPath = 'master_plans';
  let planId: string | null = null;
  let planMeta: any = null;

  if (onProgress) {
    onProgress(15, 'Buscando el último Master Plan en la nube...');
  }

  try {
    const q = query(collection(db, 'master_plans'), orderBy('updatedAt', 'desc'), limit(1));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return null;
    }
    const docSnap = querySnapshot.docs[0];
    planId = docSnap.id;
    planMeta = docSnap.data();
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, masterCollectionPath);
  }

  if (!planId) return null;

  if (onProgress) {
    onProgress(30, 'Descargando actividades del cronograma...');
  }

  // Retrieve subcollections sequentially to optimize read integrity & bandwidth
  const actividades: Actividad[] = [];
  try {
    const actSnap = await getDocs(collection(db, 'master_plans', planId, 'actividades'));
    actSnap.forEach(d => {
      const data = d.data();
      if (data && Array.isArray(data.items)) {
        actividades.push(...data.items);
      } else if (data) {
        actividades.push(data as Actividad);
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `master_plans/${planId}/actividades`);
  }

  // Sort activities by their original row index
  actividades.sort((a, b) => {
    const idxA = parseInt(a.id.replace('row_', ''), 10) || 0;
    const idxB = parseInt(b.id.replace('row_', ''), 10) || 0;
    return idxA - idxB;
  });

  if (onProgress) {
    onProgress(50, 'Descargando hojas de certificación...');
  }

  // Re-hydrate dates from string format into JS Date objects, and restore compressed/falsy properties
  actividades.forEach(a => {
    if (a.blStart && typeof a.blStart === 'string') {
      a.blStart = new Date(a.blStart);
      if (isNaN(a.blStart.getTime())) a.blStart = null;
    }
    if (a.blFinish && typeof a.blFinish === 'string') {
      a.blFinish = new Date(a.blFinish);
      if (isNaN(a.blFinish.getTime())) a.blFinish = null;
    }
    if (a.start && typeof a.start === 'string') {
      a.start = new Date(a.start);
      if (isNaN(a.start.getTime())) a.start = null;
    }
    if (a.finish && typeof a.finish === 'string') {
      a.finish = new Date(a.finish);
      if (isNaN(a.finish.getTime())) a.finish = null;
    }

    // Restore omitted defaults
    a.activityId = a.activityId ?? null;
    a.unidad = a.unidad ?? '';
    a.nivel = a.nivel ?? 0;
    a.esItemHoja = a.esItemHoja ?? false;
    a.venta = a.venta ?? 0;
    a.ventaM = a.ventaM ?? 0;
    a.ventaPlan = a.ventaPlan ?? 0;
    a.ventaEjecutada = a.ventaEjecutada ?? 0;
    a.balance = a.balance ?? 0;
    a.saldo = a.saldo ?? 0;
    a.excedente = a.excedente ?? 0;
    a.partidas = a.partidas ?? '';
    a.tipo = a.tipo ?? 'Otros';
    a.subcontratista = a.subcontratista ?? '';
    a.ubicacion = a.ubicacion ?? '';
    a.proceso = a.proceso ?? '';
    a.cap = a.cap ?? '';
    a.scap = a.scap ?? '';
    a.macro = a.macro ?? '';
    a.componente = a.componente ?? '';
    a.unit = a.unit ?? '';
    a.resp = a.resp ?? '';
    a.grupo = a.grupo ?? '';
    a.status = a.status ?? '';
    a.ventaFebrero = a.ventaFebrero ?? 0;
    a.cantidadCdo = a.cantidadCdo ?? null;
    a.precio = a.precio ?? null;
    a.step = a.step ?? null;
    a.certificaciones = a.certificaciones ?? {};
    a.certificacionesPorFecha = a.certificacionesPorFecha ?? {};
    a.diasAtrasoInicio = a.diasAtrasoInicio ?? 0;
    a.diasAtrasoFin = a.diasAtrasoFin ?? 0;
    a.diasAtrasoMaximo = a.diasAtrasoMaximo ?? 0;
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const p6Status = a.p6Status || a.status || '';
    const isCompleted = p6Status === 'Completed' || a.avanceAT === 100;
    const isStarted = p6Status === 'In Progress' || p6Status === 'Completed' || (a.avanceAT !== undefined && a.avanceAT > 0);

    const targetStart = (a.blStart instanceof Date && !isNaN(a.blStart.getTime()))
      ? a.blStart
      : (a.start instanceof Date && !isNaN(a.start.getTime()) ? a.start : null);

    const targetFinish = (a.blFinish instanceof Date && !isNaN(a.blFinish.getTime()))
      ? a.blFinish
      : (a.finish instanceof Date && !isNaN(a.finish.getTime()) ? a.finish : null);

    const debiaHaberIniciado = !!(targetStart && targetStart <= today);
    const atrasadoInicio = debiaHaberIniciado && !isStarted;

    const debiaHaberTerminado = !!(targetFinish && targetFinish <= today);
    const atrasadoFin = debiaHaberTerminado && !isCompleted;

    a.estaAtrasadoCronograma = atrasadoInicio || atrasadoFin;
    a.totalFloat = a.totalFloat ?? null;
    a.p6Status = a.p6Status ?? '';
  });

  const planillaHojas: PlanillaItem[] = [];
  try {
    const hojasSnap = await getDocs(collection(db, 'master_plans', planId, 'planillaHojas'));
    hojasSnap.forEach(d => {
      const data = d.data();
      if (data && Array.isArray(data.items)) {
        planillaHojas.push(...data.items);
      } else if (data) {
        planillaHojas.push(data as PlanillaItem);
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `master_plans/${planId}/planillaHojas`);
  }

  // Sort planillaHojas by original excel index
  planillaHojas.sort((a, b) => {
    const idxA = parseInt(a.id.replace('p', ''), 10) || 0;
    const idxB = parseInt(b.id.replace('p', ''), 10) || 0;
    return idxA - idxB;
  });

  planillaHojas.forEach(h => {
    h.nivel = h.nivel ?? 0;
    h.esHoja = h.esHoja ?? false;
    h.tipo = h.tipo ?? '';
    h.macro = h.macro ?? '';
    h.tipoG = h.tipoG ?? '';
    h.unidad = h.unidad ?? '';
    h.tarifa = h.tarifa ?? 0;
    h.contrato = h.contrato ?? 0;
    h.saldo = h.saldo ?? 0;
    h.acum = h.acum ?? 0;
    h.anterior = h.anterior ?? 0;
    h.cert = h.cert ?? 0;
    h.exc = h.exc ?? 0;
    h.excE6 = h.excE6 ?? 0;
  });

  if (onProgress) {
    onProgress(68, 'Descargando partidas de certificación...');
  }

  const planillaPartidas: PlanillaItem[] = [];
  try {
    const partidasSnap = await getDocs(collection(db, 'master_plans', planId, 'planillaPartidas'));
    partidasSnap.forEach(d => {
      const data = d.data();
      if (data && Array.isArray(data.items)) {
        planillaPartidas.push(...data.items);
      } else if (data) {
        planillaPartidas.push(data as PlanillaItem);
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `master_plans/${planId}/planillaPartidas`);
  }

  // Sort planillaPartidas by original excel index
  planillaPartidas.sort((a, b) => {
    const idxA = parseInt(a.id.replace('p', ''), 10) || 0;
    const idxB = parseInt(b.id.replace('p', ''), 10) || 0;
    return idxA - idxB;
  });

  planillaPartidas.forEach(p => {
    p.nivel = p.nivel ?? 0;
    p.esHoja = p.esHoja ?? false;
    p.tipo = p.tipo ?? '';
    p.macro = p.macro ?? '';
    p.tipoG = p.tipoG ?? '';
    p.unidad = p.unidad ?? '';
    p.tarifa = p.tarifa ?? 0;
    p.contrato = p.contrato ?? 0;
    p.saldo = p.saldo ?? 0;
    p.acum = p.acum ?? 0;
    p.anterior = p.anterior ?? 0;
    p.cert = p.cert ?? 0;
    p.exc = p.exc ?? 0;
    p.excE6 = p.excE6 ?? 0;
  });

  if (onProgress) {
    onProgress(82, 'Descargando matrices CDO vs Sábana...');
  }

  // Load and reconstruct F comparison tree (supports chunked or unchunked formats)
  const F: Record<string, any> = {};
  try {
    const fSnap = await getDocs(collection(db, 'master_plans', planId, 'cdo_vs_sabana_F'));
    fSnap.forEach(d => {
      const data = d.data();
      if (data && data.entries) {
        Object.assign(F, data.entries);
      } else if (data && data.val !== undefined) {
        F[d.id] = data.val;
      }
    });
  } catch (error) {
    console.warn('No se encontraron registros de cdo_vs_sabana_F', error);
  }

  // Load and reconstruct H comparison tree (supports chunked or unchunked formats)
  const H: Record<string, any> = {};
  try {
    const hSnap = await getDocs(collection(db, 'master_plans', planId, 'cdo_vs_sabana_H'));
    hSnap.forEach(d => {
      const data = d.data();
      if (data && data.entries) {
        Object.assign(H, data.entries);
      } else if (data && data.val !== undefined) {
        H[d.id] = data.val;
      }
    });
  } catch (error) {
    console.warn('No se encontraron registros de cdo_vs_sabana_H', error);
  }

  // Re-assemble planar payload
  if (!planMeta.planillaCDOvsS) {
    planMeta.planillaCDOvsS = { desalineados: [] };
  }
  planMeta.planillaCDOvsS.F = F;
  planMeta.planillaCDOvsS.H = H;

  return {
    planMeta,
    actividades,
    planillaHojas,
    planillaPartidas
  };
}

export interface AIReportData {
  markdown: string;
  updatedAt: string;
  updatedBy: string;
  summary?: {
    total: number;
    totalDelayed: number;
    totalUpcoming: number;
    totalItemsCriticos10k?: number;
    totalMontoCritico10kUSD?: number;
  };
}

/**
 * Saves the AI report to Firestore under the current plan (or 'latest')
 */
export async function saveAIReportToFirebase(
  planId: string | null,
  reportData: AIReportData
): Promise<void> {
  const targetId = planId || 'latest_report';
  try {
    const ref = doc(db, 'ai_reports', targetId);
    await setDoc(ref, reportData, { merge: true });
    // Also save to localStorage as instant cache
    localStorage.setItem(`ai_crono_report_${targetId}`, JSON.stringify(reportData));
    localStorage.setItem('ai_crono_report_latest', JSON.stringify(reportData));
  } catch (error) {
    console.warn('Could not save AI Report to Firestore, saving to localStorage:', error);
    localStorage.setItem(`ai_crono_report_${targetId}`, JSON.stringify(reportData));
    localStorage.setItem('ai_crono_report_latest', JSON.stringify(reportData));
  }
}

/**
 * Loads the AI report from Firestore or localStorage
 */
export async function loadAIReportFromFirebase(
  planId?: string | null
): Promise<AIReportData | null> {
  const targetId = planId || 'latest_report';
  
  // 1. Try Firestore first
  try {
    const ref = doc(db, 'ai_reports', targetId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as AIReportData;
      localStorage.setItem(`ai_crono_report_${targetId}`, JSON.stringify(data));
      return data;
    }
  } catch (error) {
    console.warn('Could not fetch AI Report from Firestore, falling back to local storage:', error);
  }

  // 2. Try localStorage fallback
  try {
    const cached = localStorage.getItem(`ai_crono_report_${targetId}`) || localStorage.getItem('ai_crono_report_latest');
    if (cached) {
      return JSON.parse(cached) as AIReportData;
    }
  } catch (e) {
    console.error('Error parsing cached AI report:', e);
  }

  return null;
}

export interface PersonalMatrixMeta {
  updatedAt: string;
  updatedBy: string;
  fileName: string;
  rowCount: number;
  ubicaciones: string[];
  fechas: string[];
  totales: {
    totalPersonal: number;
    directoTotal: number;
    indirectoTotal: number;
    hTotal: number;
    mTotal: number;
    diurnoTotal: number;
    nocheTotal: number;
    totalEmpresas: number;
  };
}

/**
 * Deletes a Personal Plan completely from Firestore, including its chunks subcollection,
 * and finally deletes the plan document.
 */
export async function deletePersonalPlanCompletely(planId: string): Promise<void> {
  if (!planId) return;

  try {
    const chunksCol = collection(db, 'personal_plans', planId, 'chunks');
    const snapshot = await getDocs(chunksCol);
    if (!snapshot.empty) {
      let batch = writeBatch(db);
      let count = 0;

      for (const docSnap of snapshot.docs) {
        batch.delete(docSnap.ref);
        count++;

        if (count === 500) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }

      if (count > 0) {
        await batch.commit();
      }
    }
  } catch (subErr) {
    console.warn(`Error deleting chunks subcollection for personal plan ${planId}:`, subErr);
  }

  // Finally delete the main plan document
  try {
    const mainDocRef = doc(db, 'personal_plans', planId);
    await deleteDoc(mainDocRef);
  } catch (docErr) {
    console.warn(`Error deleting personal plan document personal_plans/${planId}:`, docErr);
  }
}

/**
 * Saves a parsed Personal Matrix to Firestore with size-capped chunks.
 * Replaces any previous personal plan completely (fresh upload without accumulating).
 */
export async function savePersonalPlanToFirebase(
  fileName: string,
  registros: any[],
  onProgress?: (pct: number, statusMsg: string) => void
): Promise<string> {
  // Read previous active personal plan ID before writing the new plan
  let oldPlanId: string | null = null;
  try {
    const activeDocSnap = await getDoc(doc(db, 'system_config', 'active_personal_plan'));
    if (activeDocSnap.exists()) {
      oldPlanId = activeDocSnap.data()?.activePlanId || null;
    }
    if (!oldPlanId) {
      const q = query(collection(db, 'personal_plans'), orderBy('updatedAt', 'desc'), limit(1));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        oldPlanId = qSnap.docs[0].id;
      }
    }
  } catch (e) {
    console.warn('Could not read old active_personal_plan (non-blocking):', e);
  }

  const planId = `personal_${Date.now()}`;
  const planPath = `personal_plans/${planId}`;

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  if (onProgress) {
    onProgress(10, 'Preparando registros de personal...');
  }

  // Safe chunking helper (~380 KB per doc)
  const chunkArrayBySize = <T>(array: T[], maxBytes: number = 380000, maxCount: number = 400): { id: string; items: T[] }[] => {
    const chunks: { id: string; items: T[] }[] = [];
    let currentChunk: T[] = [];
    let currentEstimatedBytes = 80;

    for (let i = 0; i < array.length; i++) {
      const item = array[i];
      const itemBytes = (JSON.stringify(item) || '').length * 1.5;

      if (currentChunk.length > 0 && (currentEstimatedBytes + itemBytes > maxBytes || currentChunk.length >= maxCount)) {
        chunks.push({
          id: `chunk_${chunks.length}`,
          items: currentChunk
        });
        currentChunk = [];
        currentEstimatedBytes = 80;
      }

      currentChunk.push(item);
      currentEstimatedBytes += itemBytes + 2;
    }

    if (currentChunk.length > 0) {
      chunks.push({
        id: `chunk_${chunks.length}`,
        items: currentChunk
      });
    }
    return chunks;
  };

  // Strip Date objects for pure JSON serializability
  const cleanRegistros = (registros || []).map(r => {
    const copy = { ...r };
    if (copy.fechaDate) {
      delete copy.fechaDate;
    }
    return copy;
  });

  const chunks = chunkArrayBySize(cleanRegistros, 380000, 400);
  const totalChunks = chunks.length;

  for (let i = 0; i < totalChunks; i++) {
    const chunk = chunks[i];
    const chunkDocRef = doc(db, 'personal_plans', planId, 'chunks', chunk.id);

    if (onProgress) {
      const pct = 15 + Math.round(((i + 1) / totalChunks) * 70);
      onProgress(pct, `Guardando registros en la nube (${i + 1}/${totalChunks})...`);
    }

    const writeDocWithRetry = async (retryCount = 0): Promise<void> => {
      try {
        await setDoc(chunkDocRef, chunk);
      } catch (error) {
        const errStr = String(error).toLowerCase();
        const isDailyQuota = errStr.includes('quota') || errStr.includes('free daily write units');
        if (isDailyQuota) {
          handleFirestoreError(error, OperationType.WRITE, chunkDocRef.path);
        }
        if (
          retryCount < 3 &&
          (errStr.includes('resource-exhausted') || errStr.includes('backoff') || errStr.includes('unavailable') || errStr.includes('stream'))
        ) {
          const waitMs = (retryCount + 1) * 2000;
          await delay(waitMs);
          return writeDocWithRetry(retryCount + 1);
        }
        handleFirestoreError(error, OperationType.WRITE, chunkDocRef.path);
      }
    };

    await writeDocWithRetry();
    if (i < totalChunks - 1) {
      await delay(250);
    }
  }

  // Calculate metadata summaries
  const ubicaciones = Array.from(new Set(cleanRegistros.map((r: any) => r.ubicacion).filter(Boolean)));
  const fechas = Array.from(new Set(cleanRegistros.map((r: any) => r.fechaIso).filter(Boolean))).sort();

  if (onProgress) {
    onProgress(90, 'Finalizando metadatos de personal...');
  }

  try {
    const metaDoc = {
      fileName,
      rowCount: cleanRegistros.length,
      ubicaciones,
      fechas,
      chunkCount: totalChunks,
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'personal_plans', planId), metaDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, planPath);
  }

  // Update active reference
  try {
    await setDoc(doc(db, 'system_config', 'active_personal_plan'), {
      activePlanId: planId,
      updatedAt: new Date().toISOString(),
      fileName,
      rowCount: cleanRegistros.length
    });
  } catch (e) {
    console.warn('Could not update system_config/active_personal_plan:', e);
  }

  // Clean up old personal plan completely
  if (oldPlanId && oldPlanId !== planId) {
    if (onProgress) {
      onProgress(95, 'Limpiando carga de personal anterior...');
    }
    try {
      await deletePersonalPlanCompletely(oldPlanId);
    } catch (cleanErr) {
      console.warn(`Non-blocking notice: Could not fully delete previous personal plan ${oldPlanId}:`, cleanErr);
    }
  }

  if (onProgress) {
    onProgress(100, '¡Matriz de personal sincronizada exitosamente en la nube!');
  }

  return planId;
}

/**
 * Loads the latest Personal Plan from Firestore
 */
export async function loadLatestPersonalPlanFromFirebase(
  onProgress?: (pct: number, statusMsg: string) => void
): Promise<{
  planMeta: any;
  registros: any[];
} | null> {
  const collectionPath = 'personal_plans';
  let planId: string | null = null;
  let planMeta: any = null;

  if (onProgress) {
    onProgress(15, 'Buscando datos de personal en la nube...');
  }

  try {
    // 1. Check system_config first
    const activeDocSnap = await getDoc(doc(db, 'system_config', 'active_personal_plan'));
    if (activeDocSnap.exists() && activeDocSnap.data()?.activePlanId) {
      const activeId = activeDocSnap.data().activePlanId;
      const planDocSnap = await getDoc(doc(db, 'personal_plans', activeId));
      if (planDocSnap.exists()) {
        planId = activeId;
        planMeta = planDocSnap.data();
      }
    }

    // 2. Fallback query
    if (!planId) {
      const q = query(collection(db, 'personal_plans'), orderBy('updatedAt', 'desc'), limit(1));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        planId = docSnap.id;
        planMeta = docSnap.data();
      }
    }
  } catch (error) {
    console.warn('Could not query personal_plans in Firestore:', error);
    return null;
  }

  if (!planId || !planMeta) return null;

  if (onProgress) {
    onProgress(40, 'Descargando registros de personal...');
  }

  const registros: any[] = [];
  try {
    const chunksSnap = await getDocs(collection(db, 'personal_plans', planId, 'chunks'));
    chunksSnap.forEach(d => {
      const data = d.data();
      if (data && Array.isArray(data.items)) {
        registros.push(...data.items);
      }
    });
  } catch (error) {
    console.warn(`Error reading personal_plans/${planId}/chunks:`, error);
    return null;
  }

  if (registros.length === 0) return null;

  if (onProgress) {
    onProgress(100, 'Datos de personal listos');
  }

  return {
    planMeta,
    registros
  };
}



