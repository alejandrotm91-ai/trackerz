import type { ReporteIA } from '../types/reporteIA';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Guardado en la nube (Cloudflare D1 a través de la API del Worker).
// Cada carga se parte en trozos JSON, se sube trozo por trozo y al final se
// "confirma": recién ahí pasa a ser la versión que ven todos los usuarios.

import { Actividad, PlanillaItem } from '../types';
import { apiFetch } from './api';

const MAX_CHUNK_CHARS = 700_000; // ~1,4 MB en el peor caso; D1 acepta filas de hasta 2 MB
const PARALLEL_UPLOADS = 4;

type ProgressFn = (pct: number, statusMsg: string) => void;
type Kind = 'master' | 'personal';

/** Agrupa valores ya serializados en trozos JSON: listas o diccionarios. */
function packArray(serialized: string[]): string[] {
  const chunks: string[] = [];
  let current: string[] = [];
  let size = 2;
  for (const s of serialized) {
    if (current.length > 0 && size + s.length + 1 > MAX_CHUNK_CHARS) {
      chunks.push(`[${current.join(',')}]`);
      current = [];
      size = 2;
    }
    current.push(s);
    size += s.length + 1;
  }
  if (current.length > 0) chunks.push(`[${current.join(',')}]`);
  return chunks;
}

function packDict(dict: Record<string, any>): string[] {
  const entries = Object.entries(dict).map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v === undefined ? null : v)}`);
  return packArray(entries).map(c => `{${c.slice(1, -1)}}`);
}

interface Upload { section: string; idx: number; body: string; label: string }

async function uploadChunks(kind: Kind, planId: string, uploads: Upload[], onProgress?: ProgressFn, from = 10, to = 92) {
  let done = 0;
  let next = 0;
  const worker = async () => {
    while (next < uploads.length) {
      const u = uploads[next++];
      await apiFetch(`/api/cloud/${kind}/${planId}/${u.section}/${u.idx}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: u.body,
      });
      done++;
      onProgress?.(from + Math.round((done / uploads.length) * (to - from)), `Guardando en la nube: ${u.label}...`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL_UPLOADS, uploads.length) }, worker));
}

function sectionUploads(section: string, chunks: string[], label: string): Upload[] {
  return chunks.map((body, idx) => ({ section, idx, body, label: `${label} (${idx + 1}/${chunks.length})` }));
}

async function commitPlan(kind: Kind, planId: string, meta: any) {
  await apiFetch(`/api/cloud/${kind}/${planId}/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(meta),
  });
}

async function getActivePlan(kind: Kind): Promise<{ id: string; meta: any } | null> {
  const res = await apiFetch(`/api/cloud/${kind}/active`, undefined, [404]);
  if (res.status === 404) return null;
  return res.json();
}

async function getSection(kind: Kind, planId: string, section: string): Promise<any[]> {
  const res = await apiFetch(`/api/cloud/${kind}/${planId}/${section}`);
  return res.json();
}

// Quita campos auxiliares pesados que la app reconstruye al cargar.
const stripHelpers = (key: string, value: any) => {
  if (key === 'unitAgregado' || key === 'scapAgregado' || key === 'capAgregado' || key === 'procesoAgregado') {
    return undefined;
  }
  return value === undefined ? null : value;
};
const serialize = (item: any) => JSON.stringify(item, stripHelpers);

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
 * Publica el Master Plan en la nube y reemplaza al anterior.
 */
export async function savePlanToCloud(
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
  onProgress?: ProgressFn
): Promise<string> {
  const planId = `plan_${Date.now()}`;
  onProgress?.(8, 'Preparando datos para la nube...');

  const uploads: Upload[] = [
    ...sectionUploads('actividades', packArray(actividades.map(compressActividad).map(serialize)), 'Actividades'),
    ...sectionUploads('planillaHojas', packArray(planillaHojas.map(compressPlanillaItem).map(serialize)), 'Hojas de Planilla'),
    ...sectionUploads('planillaPartidas', packArray(planillaPartidas.map(compressPlanillaItem).map(serialize)), 'Partidas de Planilla'),
  ];
  await uploadChunks('master', planId, uploads, onProgress);

  onProgress?.(96, 'Finalizando metadatos del Master Plan...');
  await commitPlan('master', planId, {
    fileName,
    rowCount,
    periodoSeleccionado,
    fechaCorteState,
    mapaColumnasMes,
    planillaInfo: planillaInfo || null,
    planillaTotales: planillaTotales || null,
    planillaEnmiendas: planillaEnmiendas || [],
    planillaTipRes: planillaTipRes || [],
    planillaCDOvsS: { desalineados: planillaCDOvsS?.desalineados || [] },
    updatedAt: new Date().toISOString(),
  });

  onProgress?.(100, '¡Master Plan publicado exitosamente en la nube!');
  return planId;
}

/**
 * Carga el Master Plan vigente desde la nube.
 */
export async function loadLatestPlanFromCloud(
  onProgress?: ProgressFn
): Promise<{
  planMeta: any;
  actividades: Actividad[];
  planillaHojas: PlanillaItem[];
  planillaPartidas: PlanillaItem[];
} | null> {
  onProgress?.(15, 'Buscando el último Master Plan en la nube...');
  const active = await getActivePlan('master');
  if (!active) return null;
  const planId = active.id;
  const planMeta = active.meta;

  onProgress?.(30, 'Descargando actividades del cronograma...');
  const actividades: Actividad[] = (await getSection('master', planId, 'actividades')).flat();

  // Ordenar por fila original del Excel
  actividades.sort((a, b) => {
    const idxA = parseInt(a.id.replace('row_', ''), 10) || 0;
    const idxB = parseInt(b.id.replace('row_', ''), 10) || 0;
    return idxA - idxB;
  });

  onProgress?.(50, 'Descargando hojas de certificación...');

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

  const planillaHojas: PlanillaItem[] = (await getSection('master', planId, 'planillaHojas')).flat();
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

  onProgress?.(68, 'Descargando partidas de certificación...');
  const planillaPartidas: PlanillaItem[] = (await getSection('master', planId, 'planillaPartidas')).flat();
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

  // La comparación CDO vs Planilla se calcula en el navegador desde el Master y la Planilla.
  if (!planMeta.planillaCDOvsS) planMeta.planillaCDOvsS = { desalineados: [] };

  return { planMeta, actividades, planillaHojas, planillaPartidas };
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
  /** Reporte estándar (desde la versión 2). Los reportes anteriores solo traen `markdown`. */
  reporte?: ReporteIA;
}

const reportKey = (planId?: string | null) => `ai_report_${(planId || 'latest_report').replace(/[^A-Za-z0-9_-]/g, '_')}`;

/**
 * Guarda el reporte de IA en la nube (y una copia local como caché).
 */
export async function saveAIReportToCloud(planId: string | null, reportData: AIReportData): Promise<void> {
  const targetId = planId || 'latest_report';
  localStorage.setItem(`ai_crono_report_${targetId}`, JSON.stringify(reportData));
  localStorage.setItem('ai_crono_report_latest', JSON.stringify(reportData));
  try {
    await apiFetch(`/api/docs/${reportKey(planId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportData),
    });
  } catch (error) {
    console.warn('No se pudo guardar el reporte de IA en la nube (queda guardado en este navegador):', error);
  }
}

/**
 * Carga el reporte de IA desde la nube o, si falla, desde la copia local.
 */
export async function loadAIReportFromCloud(planId?: string | null): Promise<AIReportData | null> {
  const targetId = planId || 'latest_report';
  try {
    const res = await apiFetch(`/api/docs/${reportKey(planId)}`, undefined, [404]);
    if (res.ok) {
      const data = (await res.json()) as AIReportData;
      localStorage.setItem(`ai_crono_report_${targetId}`, JSON.stringify(data));
      return data;
    }
  } catch (error) {
    console.warn('No se pudo leer el reporte de IA de la nube; se usa la copia local:', error);
  }
  try {
    const cached = localStorage.getItem(`ai_crono_report_${targetId}`) || localStorage.getItem('ai_crono_report_latest');
    if (cached) return JSON.parse(cached) as AIReportData;
  } catch (e) {
    console.error('Error leyendo el reporte de IA guardado:', e);
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
 * Publica la matriz de personal en la nube y reemplaza a la anterior.
 */
export async function savePersonalPlanToCloud(
  fileName: string,
  registros: any[],
  onProgress?: ProgressFn
): Promise<string> {
  const planId = `personal_${Date.now()}`;
  onProgress?.(10, 'Preparando registros de personal...');

  // Quitar objetos Date para que todo sea JSON puro
  const cleanRegistros = (registros || []).map(r => {
    const copy = { ...r };
    if (copy.fechaDate) delete copy.fechaDate;
    return copy;
  });

  const chunks = packArray(cleanRegistros.map(r => JSON.stringify(r)));
  await uploadChunks('personal', planId, sectionUploads('chunks', chunks, 'Registros de personal'), onProgress, 15, 85);

  onProgress?.(90, 'Finalizando metadatos de personal...');
  const ubicaciones = Array.from(new Set(cleanRegistros.map((r: any) => r.ubicacion).filter(Boolean)));
  const fechas = Array.from(new Set(cleanRegistros.map((r: any) => r.fechaIso).filter(Boolean))).sort();
  await commitPlan('personal', planId, {
    fileName,
    rowCount: cleanRegistros.length,
    ubicaciones,
    fechas,
    chunkCount: chunks.length,
    updatedAt: new Date().toISOString(),
  });

  onProgress?.(100, '¡Matriz de personal sincronizada exitosamente en la nube!');
  return planId;
}

/**
 * Carga la matriz de personal vigente desde la nube.
 */
export async function loadLatestPersonalPlanFromCloud(
  onProgress?: ProgressFn
): Promise<{ planMeta: any; registros: any[] } | null> {
  onProgress?.(15, 'Buscando datos de personal en la nube...');
  let active: { id: string; meta: any } | null;
  try {
    active = await getActivePlan('personal');
  } catch (error) {
    console.warn('No se pudo consultar la matriz de personal en la nube:', error);
    return null;
  }
  if (!active) return null;

  onProgress?.(40, 'Descargando registros de personal...');
  let registros: any[];
  try {
    registros = (await getSection('personal', active.id, 'chunks')).flat();
  } catch (error) {
    console.warn('Error descargando registros de personal:', error);
    return null;
  }
  if (registros.length === 0) return null;

  onProgress?.(100, 'Datos de personal listos');
  return { planMeta: active.meta, registros };
}
