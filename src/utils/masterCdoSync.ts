/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import { MasterCdoItem, MasterCdoWeek, MasterCdoPlanDoc, MasterCdoTotals } from '../types/masterCdo';
import { Actividad } from '../types';
import { parseWbsAndDescription, stepDeFila, ventaDeFila } from './masterCdoHierarchy';
import { parseFlexibleDate } from '../hooks/useMasterPlan';
import { apiFetch } from './api';

/**
 * Calculates master CDO totals
 */
export function calculateMasterTotals(items: MasterCdoItem[], semanas: MasterCdoWeek[]): MasterCdoTotals {
  let totalVentaPresupuesto = 0;
  let totalAvanceEconomico = 0;
  let totalCantidadPresupuesto = 0;
  let totalCantidadEjecutada = 0;

  // Una actividad P6 vale la suma de sus partidas: no se cuenta su propia fila.
  const actividadesP6 = new Set(
    items.map(i => i.parentActivityId?.trim().toLowerCase()).filter(Boolean) as string[]
  );

  for (const item of items) {
    if (!item.parentActivityId && item.activityId && actividadesP6.has(item.activityId.trim().toLowerCase())) continue;
    const cantPres = Number(item.cantidadPresupuesto) || 0;
    const precio = Number(item.precio) || 0;
    const step = stepDeFila(item.step);
    const venta = ventaDeFila(item);

    totalVentaPresupuesto += venta;
    totalCantidadPresupuesto += cantPres;

    // Calculate executed quantities across all weeks
    let itemCantEjecutada = 0;
    if (item.cantidadesSemanales) {
      for (const sem of semanas) {
        const q = Number(item.cantidadesSemanales[sem.id]) || 0;
        itemCantEjecutada += q;
      }
    }

    totalCantidadEjecutada += itemCantEjecutada;
    let itemAvanceEcon = 0;
    if (item.ventasSemanales) {
      for (const sem of semanas) {
        itemAvanceEcon += Number(item.ventasSemanales[sem.id]) || 0;
      }
    } else {
      itemAvanceEcon = itemCantEjecutada * precio * step;
    }
    totalAvanceEconomico += itemAvanceEcon;
  }

  const totalSaldoEconomico = Math.max(0, totalVentaPresupuesto - totalAvanceEconomico);
  const pctAvanceEconomico = totalVentaPresupuesto > 0
    ? (totalAvanceEconomico / totalVentaPresupuesto) * 100
    : 0;
  const pctAvanceFisico = totalCantidadPresupuesto > 0
    ? (totalCantidadEjecutada / totalCantidadPresupuesto) * 100
    : 0;

  return {
    totalVentaPresupuesto,
    totalAvanceEconomico,
    totalSaldoEconomico,
    pctAvanceEconomico: Number(pctAvanceEconomico.toFixed(2)),
    totalCantidadPresupuesto,
    totalCantidadEjecutada,
    pctAvanceFisico: Number(pctAvanceFisico.toFixed(2))
  };
}

/**
 * Converts standard project Actividades into MasterCdoItem items
 */
export function initializeMasterCdoFromActividades(
  actividades: Actividad[],
  mapaColumnasMes?: Record<string, any>
): { items: MasterCdoItem[]; semanas: MasterCdoWeek[] } {
  // Collect all unique date keys found across actividades (certificaciones, planificado, etc.)
  const detectedDatesSet = new Set<string>();

  const conHijos: any[] = [];
  actividades.forEach(a => { conHijos.push(a); (a.hijosP6 || []).forEach(h => conHijos.push(h)); });
  conHijos.forEach(a => {
    if (a.certificacionesPorFecha) {
      Object.keys(a.certificacionesPorFecha).forEach(d => {
        if (d && d.match(/^\d{4}-\d{2}-\d{2}$/)) {
          detectedDatesSet.add(d);
        }
      });
    }
    if ((a as any).planificadoPorFecha) {
      Object.keys((a as any).planificadoPorFecha).forEach(d => {
        if (d && d.match(/^\d{4}-\d{2}-\d{2}$/)) {
          detectedDatesSet.add(d);
        }
      });
    }
    if ((a as any).planificadoPorFechaPG004) {
      Object.keys((a as any).planificadoPorFechaPG004).forEach(d => {
        if (d && d.match(/^\d{4}-\d{2}-\d{2}$/)) {
          detectedDatesSet.add(d);
        }
      });
    }
  });

  // Also check mapaColumnasMes keys (e.g. "2024-Marzo", "2025-Enero", "2026-Febrero")
  if (mapaColumnasMes) {
    const monthIndexMap: Record<string, string> = {
      enero: '01', febrero: '02', marzo: '03', abril: '04',
      mayo: '05', junio: '06', julio: '07', agosto: '08',
      septiembre: '09', setiembre: '09', octubre: '10', noviembre: '11', diciembre: '12'
    };
    Object.keys(mapaColumnasMes).forEach(k => {
      const match = k.match(/^(\d{4})-([a-zA-Z]+)$/);
      if (match) {
        const y = match[1];
        const mStr = match[2].toLowerCase();
        const m = monthIndexMap[mStr] || '01';
        // Add representative Fridays or week cuts for that month if not already present
        const sampleDate = `${y}-${m}-15`;
        detectedDatesSet.add(sampleDate);
      }
    });
  }

  const sortedDates = Array.from(detectedDatesSet).sort();

  // Build semanas list
  const semanas: MasterCdoWeek[] = [];
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  if (sortedDates.length > 0) {
    sortedDates.forEach((dStr) => {
      const parts = dStr.split('-');
      const yyyy = parts[0];
      const mm = parseInt(parts[1], 10);
      const dd = parts[2];
      const monthName = months[mm - 1] || mm;
      semanas.push({
        id: dStr,
        fecha: dStr,
        label: `Sem ${dd}-${monthName}-${yyyy}`
      });
    });
  } else {
    // Generate default weekly periods for the current year
    const baseDate = new Date();
    const currYear = baseDate.getFullYear();
    for (let i = 7; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - (i * 7));
      const iso = d.toISOString().split('T')[0];
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      semanas.push({
        id: iso,
        fecha: iso,
        label: `Sem ${dd}/${mm}/${currYear}`
      });
    }
  }

  // Convierte una actividad (o una partida de actividad P6) en una fila del Master.
  const toItem = (act: Actividad, idx: number): MasterCdoItem => {
    const cantPres = Number(act.cantidadCdo) || 0;
    const precio = Number(act.precio) || 0;
    const step = stepDeFila(act.step);
    const venta = Number(act.venta) || 0; // Col I tal cual

    // Initial weekly quantities & monetary progress:
    // 1. If cantidadesPorFecha exists (from Q- columns), it holds the true physical quantity.
    // 2. certificacionesPorFecha holds monetary progress (Venta en $).
    // If only monetary progress exists, derive physical quantity: Cantidad = Venta / (Precio * Step).
    const cantidadesSemanales: Record<string, number> = {};
    const ventasSemanales: Record<string, number> = {};

    if (act.cantidadesPorFecha) {
      Object.entries(act.cantidadesPorFecha).forEach(([dt, q]) => {
        if (typeof q === 'number' && q > 0) {
          cantidadesSemanales[dt] = q;
        }
      });
    }

    if (act.certificacionesPorFecha) {
      Object.entries(act.certificacionesPorFecha).forEach(([dt, val]) => {
        if (val && val > 0) {
          ventasSemanales[dt] = val;
          // If no explicit physical quantity was set, derive it from Venta
          if (cantidadesSemanales[dt] === undefined) {
            if (precio > 0 && step > 0) {
              cantidadesSemanales[dt] = Number((val / (precio * step)).toFixed(4));
            } else {
              cantidadesSemanales[dt] = val;
            }
          }
        }
      });
    }

    // Ensure ventasSemanales exists for every week with quantities
    if (precio > 0 && step > 0) {
      Object.entries(cantidadesSemanales).forEach(([dt, q]) => {
        if (q > 0 && ventasSemanales[dt] === undefined) {
          ventasSemanales[dt] = Number((q * precio * step).toFixed(2));
        }
      });
    }

    const parsed = parseWbsAndDescription(act.wbs || (act as any).wbsRaw);
    const cleanWbs = parsed.wbs || act.wbs || '';
    const cleanDesc = (act.descripcion && !/^partida\s+/i.test(act.descripcion)) ? act.descripcion : (parsed.description || act.descripcion || '');

    return {
      id: act.id || `row_${idx + 1}`,
      wbs: cleanWbs,
      idOrig: act.idOrig ? String(act.idOrig) : '',
      activityId: act.activityId || '',
      descripcion: cleanDesc,
      unidad: act.unidad || 'UND',
      cantidadPresupuesto: cantPres,
      precio: precio,
      step: step,
      venta: venta,
      subcontratista: act.subcontratista || 'Propio',
      pAc: act.pAc || '',
      cap: act.cap || '',
      scap: act.scap || '',
      macro: act.macro || '',
      grupo: act.grupo || '',
      tipo: act.tipo || '',
      partidas: act.partidas || '',
      unit: act.unit || '',
      componente: act.componente || '',
      ubicacion: act.ubicacion || '',
      resp: act.resp || '',
      proceso: act.proceso || '',
      status: act.status || 'No Iniciado',
      esItemHoja: act.esItemHoja ?? true,
      cantidadesSemanales,
      ventasSemanales
    };
  };

  // Mismo orden que el CDO: cada actividad P6 seguida de sus partidas (que cuelgan de ella).
  const items: MasterCdoItem[] = [];
  actividades.forEach((act, idx) => {
    items.push(toItem(act, idx));
    (act.hijosP6 || []).forEach(h => {
      const comoActividad = {
        ...h,
        wbs: act.wbs,
        wbsRaw: (act as any).wbsRaw,
        esItemHoja: true,
      } as unknown as Actividad;
      items.push({ ...toItem(comoActividad, idx), parentActivityId: act.activityId || '' });
    });
  });

  return { items, semanas };
}

/**
 * Guarda el Master CDO en D1 a través de la API del Worker
 */
export async function saveMasterCdoToCloud(
  planId: string,
  fileName: string,
  items: MasterCdoItem[],
  semanas: MasterCdoWeek[],
  userName: string = 'Admin',
  onProgress?: (pct: number, statusMsg: string) => void
): Promise<string> {
  if (onProgress) onProgress(10, 'Preparando sincronización con SQL...');
  
  const totales = calculateMasterTotals(items, semanas);
  
  const planData: MasterCdoPlanDoc = {
    id: planId,
    fileName: fileName,
    totalRows: items.length,
    semanas: semanas,
    updatedAt: new Date().toISOString(),
    updatedBy: userName,
    totales
  };

  if (onProgress) onProgress(40, 'Enviando datos al servidor SQL...');
  await apiFetch('/api/master-cdo/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId, planData, items })
  });

  if (onProgress) onProgress(100, '¡Guardado exitoso en SQL!');
  return planId;
}

export async function loadLatestMasterCdoFromCloud(
  onProgress?: (pct: number, statusMsg: string) => void,
  chunkDelay: number = 0
): Promise<{
  planDoc: MasterCdoPlanDoc;
  items: MasterCdoItem[];
} | null> {
  const planId = 'master_cdo_default'; // Default plan ID for now
  if (onProgress) onProgress(10, 'Conectando a base de datos SQL...');
  
  if (onProgress) onProgress(50, 'Descargando información desde SQL...');
  const response = await apiFetch(`/api/master-cdo/load/${planId}`, undefined, [404]);
  if (response.status === 404) {
    return null; // Plan not found
  }

  if (onProgress) onProgress(90, 'Procesando datos recibidos...');
  const data = await response.json();
  
  if (onProgress) onProgress(100, '¡Descarga completa!');
  return data;
}

export async function parseMasterCdoFromExcel(
  file: File,
  onProgress?: (pct: number, msg: string) => void
): Promise<{ items: MasterCdoItem[]; semanas: MasterCdoWeek[]; fileName: string }> {
  if (onProgress) onProgress(10, 'Leyendo archivo Excel...');
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  const workbook = XLSX.read(data, { type: 'array' });

  if (onProgress) onProgress(30, 'Buscando hoja CDO...');
  const cdoSheetName = workbook.SheetNames.find(n => n.trim().toLowerCase() === 'cdo') || workbook.SheetNames[0];
  if (!cdoSheetName) {
    throw new Error('No se encontró la pestaña CDO en el archivo Excel proporcionado.');
  }

  const worksheet = workbook.Sheets[cdoSheetName];
  const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

  if (jsonData.length < 2) {
    throw new Error('La pestaña CDO está vacía o no contiene filas de datos.');
  }

  const row0 = jsonData[0] || [];
  const headers = jsonData[1] || [];

  // Identify fixed columns
  const normalize = (val: any) =>
    String(val || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  let stepCol = 7;
  let precioCol = 6;
  let cantCol = 5;
  let subcCol = 9;
  let obsCol = 37; // Column AL fallback

  for (let c = 0; c < headers.length; c++) {
    const h = normalize(headers[c]);
    if (h.includes('step')) stepCol = c;
    if (h.includes('precio') || h.includes('p.u.') || h.includes('pu') || h.includes('unit price')) precioCol = c;
    if (h.includes('cant') || h.includes('cantidad') || h.includes('presupuesto')) cantCol = c;
    if (h.includes('subc') || h.includes('subcontrat')) subcCol = c;
    if (h === 'obs' || h.startsWith('obs')) obsCol = c;
  }

  // Detect weekly progress columns (columns starting with V-, Q-, or formatted dates)
  interface DetectedCol {
    colIndex: number;
    weekId: string;
    label: string;
    kind: 'qty' | 'econ' | 'unknown';
  }
  const weeklyCols: DetectedCol[] = [];
  const weekMap = new Map<string, { id: string; fecha: string; label: string }>();

  for (let c = 8; c < headers.length; c++) {
    const hStr = String(headers[c] || '').trim();
    const r0Str = String(row0[c] || '').trim();
    const testText = `${hStr} ${r0Str}`.trim();
    const upperH = hStr.toUpperCase();
    const upperR0 = r0Str.toUpperCase();

    // Check if it's a date or weekly column
    const parsedDate = parseFlexibleDate(headers[c]) || parseFlexibleDate(row0[c]) || parseFlexibleDate(testText);
    const dateMatch = testText.match(/(\d{4}[-/]\d{2}[-/]\d{2})|(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/);
    const isQ = upperH.startsWith('Q-') || upperH.startsWith('Q_') || upperH.startsWith('CANT') || upperR0.startsWith('Q');
    const isV = upperH.startsWith('V-') || upperH.startsWith('V_') || upperH.startsWith('VENTA') || upperH === 'V' || upperR0.startsWith('V');
    const isSem = upperH.startsWith('SEM') || upperR0.startsWith('SEM');

    // Skip known non-week columns that might be falsely matched
    const exactSkips = ['VENTA', 'VENTA_PLAN', 'CANTIDAD EX', 'VENTA EX', 'CANT. ACUM', 'CANT. ACUM.', 'AVANCE', 'CANTIDAD ACUMULADA', 'TOTAL', 'TOTALES'];
    if (exactSkips.includes(upperH) || upperH.startsWith('VENTA_') || upperH.startsWith('VENTA EX')) {
      continue;
    }

    if (parsedDate || dateMatch || isQ || isV || isSem) {
      let weekId = `sem_${c}`;
      let label = hStr || `Sem ${c - 7}`;
      let fecha = '2026-01-01';

      if (parsedDate && !isNaN(parsedDate.getTime())) {
        const yyyy = parsedDate.getFullYear();
        const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const dd = String(parsedDate.getDate()).padStart(2, '0');
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const monthName = months[parsedDate.getMonth()] || mm;
        weekId = `${yyyy}-${mm}-${dd}`;
        fecha = weekId;
        label = `Sem ${dd}-${monthName}-${yyyy}`;
      } else if (dateMatch) {
        weekId = dateMatch[0].replace(/\//g, '-');
        fecha = weekId;
        label = `Sem ${weekId}`;
      }

      const kind: 'qty' | 'econ' | 'unknown' = isQ ? 'qty' : (isV ? 'econ' : 'unknown');

      weeklyCols.push({
        colIndex: c,
        weekId,
        label,
        kind
      });

      if (!weekMap.has(weekId)) {
        weekMap.set(weekId, {
          id: weekId,
          fecha,
          label
        });
      }
    }
  }

  // Build unique semanas list sorted chronologically
  const semanas: MasterCdoWeek[] = weekMap.size > 0
    ? Array.from(weekMap.values()).sort((a, b) => (a.fecha || a.id).localeCompare(b.fecha || b.id))
    : [
        { id: '2026-02-06', fecha: '2026-02-06', label: 'Sem 06-Feb-2026' },
        { id: '2026-02-13', fecha: '2026-02-13', label: 'Sem 13-Feb-2026' },
        { id: '2026-02-20', fecha: '2026-02-20', label: 'Sem 20-Feb-2026' },
        { id: '2026-02-27', fecha: '2026-02-27', label: 'Sem 27-Feb-2026' },
      ];

  if (onProgress) onProgress(60, 'Procesando actividades de CDO...');

  const items: MasterCdoItem[] = [];

  for (let i = 2; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row) continue;

    // Obs solo cuenta si trae texto de WBS (hay filas con basura tipo "¿").
    const obsTxt = row[obsCol] ? String(row[obsCol]).trim() : '';
    const rawObs = /[a-z0-9]/i.test(obsTxt) ? obsTxt : '';
    const rawColA = row[0] ? String(row[0]).trim() : '';
    const hierarchyText = rawObs || rawColA;
    if (!hierarchyText) continue;

    const { wbs, description: wbsDesc } = parseWbsAndDescription(hierarchyText);
    if (!wbs) continue;

    const parseNum = (v: any) => {
      if (typeof v === 'number') return isNaN(v) ? 0 : v;
      if (!v) return 0;
      const parsed = parseFloat(String(v).replace(/[$,]/g, '').trim());
      return isNaN(parsed) ? 0 : parsed;
    };

    const idOrig = row[1] ? String(row[1]).trim() : '';
    const activityId = row[2] ? String(row[2]).trim() : '';
    const rawDesc = row[3] ? String(row[3]).trim() : '';
    const descripcion = rawDesc || wbsDesc || `Partida ${idOrig || wbs}`;
    const unidad = row[4] ? String(row[4]).trim() : 'UND';
    const cantidadPresupuesto = parseNum(row[cantCol]);
    const precio = parseNum(row[precioCol]);
    const step = stepDeFila(row[stepCol]);
    const venta = parseNum(row[8]); // Col I tal cual (vacía = 0)
    const subcontratista = row[subcCol] ? String(row[subcCol]).trim() : 'Propio';
    const esItemHoja = !!activityId || cantidadPresupuesto > 0;

    const cantidadesSemanales: Record<string, number> = {};
    const ventasSemanales: Record<string, number> = {};

    weeklyCols.forEach(wc => {
      const val = parseNum(row[wc.colIndex]);
      if (val > 0) {
        if (wc.kind === 'qty') {
          cantidadesSemanales[wc.weekId] = val;
        } else if (wc.kind === 'econ') {
          ventasSemanales[wc.weekId] = val;
        } else {
          // Unknown kind: check if likely monetary
          if (cantidadPresupuesto > 0 && precio > 0 && step > 0 && val > cantidadPresupuesto) {
            ventasSemanales[wc.weekId] = val;
          } else {
            cantidadesSemanales[wc.weekId] = val;
          }
        }
      }
    });

    // Cross-derive missing Q or V
    weekMap.forEach((_, wId) => {
      const q = cantidadesSemanales[wId];
      const v = ventasSemanales[wId];
      if (q !== undefined && v === undefined && precio > 0 && step > 0) {
        ventasSemanales[wId] = Number((q * precio * step).toFixed(2));
      } else if (v !== undefined && q === undefined) {
        if (precio > 0 && step > 0) {
          cantidadesSemanales[wId] = Number((v / (precio * step)).toFixed(4));
        } else {
          cantidadesSemanales[wId] = v;
        }
      }
    });

    // Partida de una actividad P6: su Col A es el Activity ID ".p6" de la actividad.
    const parentActivityId = activityId && /p6/i.test(rawColA) ? rawColA : undefined;

    items.push({
      ...(parentActivityId ? { parentActivityId } : {}),
      id: `row_${i}`,
      wbs,
      wbsRaw: rawColA,
      wbsDesc,
      idOrig,
      activityId,
      descripcion,
      unidad,
      cantidadPresupuesto,
      precio,
      step,
      venta,
      subcontratista,
      esItemHoja,
      cantidadesSemanales,
      ventasSemanales
    });
  }

  if (onProgress) onProgress(100, 'Importación completada.');

  return {
    items,
    semanas,
    fileName: file.name
  };
}

/**
 * Exports current Master CDO to an Excel workbook (.xlsx)
 */
export function exportMasterCdoToExcel(
  items: MasterCdoItem[],
  semanas: MasterCdoWeek[],
  fileName: string = 'Master_CDO_Avance_Semanal.xlsx'
) {
  // Build header rows
  const headerRow1: string[] = [
    'WBS',
    'id.Orig',
    'Activity ID',
    'Descripción / Actividad',
    'Unidad',
    'Cant. Presupuesto',
    'Precio Unitario',
    'Step',
    'Venta Contrato',
    'Subcontratista',
    'Cant. Acumulada',
    'Avance Econ. Total',
    'Saldo Económico',
    '% Avance'
  ];

  // Add weekly columns: for each week we create 2 columns: Cantidad and Avance Económico
  semanas.forEach(sem => {
    headerRow1.push(`Q - ${sem.label}`);
    headerRow1.push(`V - ${sem.label}`);
  });

  const aoaData: any[][] = [headerRow1];

  items.forEach(item => {
    const cantPres = Number(item.cantidadPresupuesto) || 0;
    const precio = Number(item.precio) || 0;
    const step = stepDeFila(item.step);
    const venta = ventaDeFila(item);

    let sumCantEjecutada = 0;
    const weeklyValues: number[] = [];

    semanas.forEach(sem => {
      const q = Number(item.cantidadesSemanales?.[sem.id]) || 0;
      const v = q * precio * step;
      sumCantEjecutada += q;
      weeklyValues.push(q);
      weeklyValues.push(Number(v.toFixed(2)));
    });

    const avanceEconTotal = sumCantEjecutada * precio * step;
    const saldoEcon = Math.max(0, venta - avanceEconTotal);
    const pct = venta > 0 ? Number(((avanceEconTotal / venta) * 100).toFixed(2)) : 0;

    const row: any[] = [
      item.wbs,
      item.idOrig,
      item.activityId,
      item.descripcion,
      item.unidad,
      cantPres,
      precio,
      step,
      venta,
      item.subcontratista,
      sumCantEjecutada,
      Number(avanceEconTotal.toFixed(2)),
      Number(saldoEcon.toFixed(2)),
      `${pct}%`,
      ...weeklyValues
    ];

    aoaData.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoaData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'CDO');
  XLSX.writeFile(wb, fileName);
}
