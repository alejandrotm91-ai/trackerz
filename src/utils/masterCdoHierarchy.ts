/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MasterCdoItem, MasterCdoWeek } from '../types/masterCdo';
import { Actividad } from '../types';

/** Step de una fila: vacío = 1; un 0 explícito se respeta (p. ej. filas de Ingeniería). */
export function stepDeFila(step: any): number {
  return step === null || step === undefined || step === '' ? 1 : (Number(step) || 0);
}

/** Venta de una fila = Col I del CDO tal cual. Solo se calcula si la fila no trae venta. */
export function ventaDeFila(item: { venta?: any; cantidadPresupuesto?: any; precio?: any; step?: any }): number {
  if (item.venta !== null && item.venta !== undefined && item.venta !== '') return Number(item.venta) || 0;
  return calcularVenta(item.cantidadPresupuesto, item.precio, item.step);
}

/** Fórmula de la Col I: ROUND(Cantidad × Precio, 2) × Step. */
export function calcularVenta(cantidad: any, precio: any, step: any): number {
  return (Math.round((Number(cantidad) || 0) * (Number(precio) || 0) * 100) / 100) * stepDeFila(step);
}

export type MasterHierarchyMode = 'wbs' | 'tipo_subc_scap_unit' | 'flat';

/**
 * Extract 4-digit year from week object (from fecha, id, or label)
 */
export function extractWeekYear(sem: MasterCdoWeek): string {
  if (!sem) return '2026';
  const textCandidates = [sem.fecha, sem.id, sem.label].filter(Boolean) as string[];

  // 1. Look for explicit 4-digit year 2000-2099 anywhere in fecha, id, or label
  for (const str of textCandidates) {
    const match4 = str.match(/\b(20\d{2})\b/);
    if (match4) return match4[1];

    const matchEnd4 = str.match(/[-/.](20\d{2})\b/);
    if (matchEnd4) return matchEnd4[1];
  }

  // 2. Look for 2-digit year at the end (e.g. 22-Feb-26, 15-03-25, 06-11-24)
  for (const str of textCandidates) {
    const match2 = str.match(/[-/.](2[0-9]|3[0-9])\b/);
    if (match2) {
      return `20${match2[1]}`;
    }
  }

  // 3. Try parsing with native Date
  for (const str of textCandidates) {
    const d = new Date(str);
    if (!isNaN(d.getFullYear())) {
      let yr = d.getFullYear();
      if (yr < 100) yr += 2000;
      if (yr >= 2000 && yr <= 2100) return String(yr);
    }
  }

  return '2026';
}

/**
 * Get list of sorted unique years available in semanas.
 * Guaranteed to never return empty array to prevent filter UI disappearing.
 */
export function getAvailableWeekYears(semanas: MasterCdoWeek[]): string[] {
  const set = new Set<string>();
  if (Array.isArray(semanas)) {
    semanas.forEach(s => {
      if (s) {
        set.add(extractWeekYear(s));
      }
    });
  }
  const result = Array.from(set).sort();
  return result.length > 0 ? result : ['2026'];
}

export interface MasterHierarchyNode {
  key: string;
  parentKey: string | null;
  wbs: string;
  idOrig: string;
  activityId: string;
  descripcion: string;
  unidad: string;
  nivel: number; // 2: Capítulos / Tipo, 3: Subcapítulos / SubC, 4: Paquetes / Scap, etc.
  depth: number; // 0 for root, 1, 2, 3...
  esHoja: boolean;
  subcontratista: string;
  tipo?: string;
  cap?: string;
  scap?: string;
  unit?: string;
  macro?: string;
  grupo?: string;
  partidas?: string;
  componente?: string;
  ubicacion?: string;
  proceso?: string;
  resp?: string;

  // Direct reference to item if leaf
  itemRef?: MasterCdoItem;

  // Rolled-up or direct metrics
  cantidadPresupuesto: number;
  precio: number;
  step: number;
  venta: number;
  cantAcum: number;
  avanceEcon: number;
  saldoEcon: number;
  pctAvance: number;

  // Weekly values (sum across leaves or direct)
  cantidadesSemanales: Record<string, number>;
  avanceEconSemanales: Record<string, number>;

  // Children count under this branch
  totalLeavesCount: number;
  directChildrenKeys: string[];
}

export interface HierarchyStyle {
  rowBg: string;
  hoverBg: string;
  textCls: string;
  wbsCls: string;
  borderLeft: string;
  levelBadgeBg: string;
  levelBadgeText: string;
  levelName: string;
  accentColor: string;
}

/**
 * Standard default descriptions for chapters 1 to 17 and .D.
 * Used as fallback if no custom description is found in Column A.
 */
export const DEFAULT_CHAPTER_DESCRIPTIONS: Record<string, string> = {
  '1': 'Obras Preliminares / Movimiento de Tierras',
  '2': 'Obras Civiles y Estructuras de Concreto',
  '3': 'Montaje de Equipos Mecánicos',
  '4': 'Montaje de Equipos Eléctricos',
  '5': 'Instrumentación y Control (I&C)',
  '6': 'Climatización y Ventilación (HVAC)',
  '7': 'Tuberías y Piping',
  '8': 'Obras Arquitectónicas',
  '9': 'Plan de Manejo Ambiental (PMA)',
  '10': 'Pruebas y Ensayos de Calidad',
  '11': 'Comisionamiento y Pruebas',
  '12': 'Ingeniería y Gestión de Construcción',
  '13': 'Seguridad y Salud Ocupacional (SSOMA)',
  '14': 'Servicios Auxiliares e Infraestructura Temporal',
  '15': 'Interconexiones y Suministros',
  '16': 'Cierre y Desmovilización',
  '17': 'Puesta en Marcha del Sistema',
  'd': 'Partidas Directas / Adicionales',
  'D': 'Partidas Directas / Adicionales',
  'a1': 'Actividades Preliminares / Generales',
  'A1': 'Actividades Preliminares / Generales'
};

/**
 * Separates a raw Column A entry into clean WBS code and hierarchy description.
 * Examples:
 * "p.17  Puesta en Marcha del Sistema" -> { wbs: "p.17", description: "Puesta en Marcha del Sistema", normalizedWbs: "p.17" }
 * "p0926.17  Puesta en Marcha del Sistema" -> { wbs: "p0926.17", description: "Puesta en Marcha del Sistema", normalizedWbs: "p.17" }
 * "p.1  Obras Civiles" -> { wbs: "p.1", description: "Obras Civiles", normalizedWbs: "p.1" }
 * "p.1.1  Movimiento de Tierras" -> { wbs: "p.1.1", description: "Movimiento de Tierras", normalizedWbs: "p.1.1" }
 * "p0926.D  Partidas Adicionales" -> { wbs: "p0926.D", description: "Partidas Adicionales", normalizedWbs: "p.d" }
 * "17. Puesta en Marcha del Sistema" -> { wbs: "17", description: "Puesta en Marcha del Sistema", normalizedWbs: "p.17" }
 */
export function parseWbsAndDescription(raw: any): {
  wbs: string;
  description: string;
  normalizedWbs: string;
} {
  if (raw === null || raw === undefined) {
    return { wbs: '', description: '', normalizedWbs: '' };
  }
  const str = String(raw).trim();
  if (!str) {
    return { wbs: '', description: '', normalizedWbs: '' };
  }

  // Handle prefix like "Capítulo 17" or "Cap. 17"
  const capPrefixMatch = str.match(/^(?:cap[ií]tulo|cap\.?)\s*([\w\d\.]+)\s*[-–—:]?\s*(.*)$/i);
  if (capPrefixMatch) {
    const rawNum = capPrefixMatch[1].trim();
    const restDesc = capPrefixMatch[2].trim().replace(/^[-–—:\.\s]+/, '');
    const code = rawNum.startsWith('p.') ? rawNum : `p.${rawNum}`;
    const norm = code.toLowerCase().replace(/^p\d{4}\./, 'p.');
    return {
      wbs: code,
      description: restDesc,
      normalizedWbs: norm
    };
  }

  // 1. Matches WBS code (e.g. p.17, p0926.17, p1026.1.1, p.1, p.D, p0926.D, 17, 1.1) followed by separator/whitespace and description
  const match = str.match(
    /^([pP](?:\d{4}|\.)[\w\d\.]*|[pP]\d+(?:\.[\w\d]+)*|\d+(?:\.[\w\d]+)*)\.?\s*(?:[-–—:]\s*|\s{1,})(.*)$/
  );

  if (match) {
    const code = match[1].trim().replace(/\.$/, '');
    const desc = match[2].trim().replace(/^[-–—:\.\s]+/, '').trim();
    
    if (desc) {
      let norm = code.toLowerCase().replace(/^p\d{4}\./, 'p.');
      if (/^\d+(?:\.[\w\d]+)*$/.test(norm)) {
        norm = `p.${norm}`;
      }
      return {
        wbs: code,
        description: desc,
        normalizedWbs: norm
      };
    }
  }

  // 2. Check if multiple spaces exist: e.g. "p.17    Puesta en Marcha del Sistema"
  if (str.includes('  ')) {
    const parts = str.split(/\s{2,}/);
    const code = parts[0].trim().replace(/\.$/, '');
    const desc = parts.slice(1).join(' ').trim().replace(/^[-–—:\.\s]+/, '').trim();
    let norm = code.toLowerCase().replace(/^p\d{4}\./, 'p.');
    if (/^\d+(?:\.[\w\d]+)*$/.test(norm)) {
      norm = `p.${norm}`;
    }
    return {
      wbs: code,
      description: desc,
      normalizedWbs: norm
    };
  }

  // 3. Check single space where first word looks like WBS code (e.g. "p.17 Puesta...")
  const firstSpaceIdx = str.search(/\s/);
  if (firstSpaceIdx > 0) {
    const firstWord = str.substring(0, firstSpaceIdx).trim().replace(/\.$/, '');
    const rest = str.substring(firstSpaceIdx).trim().replace(/^[-–—:\.\s]+/, '').trim();
    if (/^(?:[pP](?:\d{4}|\.)[\w\d\.]*|[pP]\d+(?:\.[\w\d]+)*|\d+(?:\.[\w\d]+)*)$/i.test(firstWord) && rest.length > 0) {
      let norm = firstWord.toLowerCase().replace(/^p\d{4}\./, 'p.');
      if (/^\d+(?:\.[\w\d]+)*$/.test(norm)) {
        norm = `p.${norm}`;
      }
      return {
        wbs: firstWord,
        description: rest,
        normalizedWbs: norm
      };
    }
  }

  // Single WBS without description
  let norm = str.toLowerCase().replace(/^p\d{4}\./, 'p.');
  if (/^\d+(?:\.[\w\d]+)*$/.test(norm)) {
    norm = `p.${norm}`;
  }
  return {
    wbs: str,
    description: '',
    normalizedWbs: norm
  };
}

/**
 * Helper to determine if a WBS has '.D' (or '.d') directly following the project code (e.g. p0926.D, p1026.D, p.D).
 */
export function hasDirectoOrDSegment(wbs: string): boolean {
  if (!wbs) return false;
  const clean = wbs.trim();
  // Matches project prefix like p0926, p1026, p0326, or p followed by .D or .d
  if (/^p\d{4}\.d(\.|$)/i.test(clean)) return true;
  if (/^p\.d(\.|$)/i.test(clean)) return true;
  const parts = clean.split('.');
  if (parts.length >= 2 && /^d$/i.test(parts[1])) return true;
  if (/^d(\.|$)/i.test(clean)) return true;
  return false;
}

/**
 * Extracts the top-level hierarchy segment ("nivel más superior") of a WBS code.
 * For example:
 * - "p0926.A1" -> "A1"
 * - "p0926.A1.01" -> "A1"
 * - "p0926.D" -> "D"
 * - "p0926.D.01" -> "D"
 * - "p0926.1" -> "1"
 * - "p0926.17" -> "17"
 * - "p.A1" -> "A1"
 * - "A1.01" -> "A1"
 */
export function getTopHierarchySegment(wbs: string): string {
  if (!wbs) return '';
  const clean = wbs.trim();
  const parts = clean.split('.');
  if (parts.length === 0) return '';
  const isProjPrefix = /^[pP](\d+)?$/i.test(parts[0]);
  if (isProjPrefix && parts.length > 1) {
    return parts[1];
  }
  return parts[0];
}

/**
 * Checks if the top-level hierarchy segment contains letters (e.g. "A1", "D").
 */
export function topSegmentHasLetters(wbs: string): boolean {
  const top = getTopHierarchySegment(wbs);
  return /[a-zA-Z]/.test(top);
}

/**
 * Natural comparator for WBS codes.
 * Ensures:
 * 1. Hierarchies that have letters in their highest level (e.g. p0926.A1, p0926.D) appear FIRST.
 * 2. Standard chapters 1 to 17 (e.g. p0926.1, p0926.2 ... p0926.17) sort in ascending numerical order after.
 * 3. Sub-levels (e.g. p0926.1.1, p0926.1.2 ... p0926.1.10) sort naturally by numeric segments.
 */
export function compareWbs(wbsA: string, wbsB: string): number {
  if (!wbsA && !wbsB) return 0;
  if (!wbsA) return 1;
  if (!wbsB) return -1;

  const cleanA = wbsA.trim();
  const cleanB = wbsB.trim();
  if (cleanA === cleanB) return 0;

  // 1. Hierarchies whose top-level segment has letters appear first (e.g. p0926.A1, p0926.D)
  const hasLettersA = topSegmentHasLetters(cleanA);
  const hasLettersB = topSegmentHasLetters(cleanB);

  if (hasLettersA && !hasLettersB) return -1; // A has letters in top segment -> comes first
  if (!hasLettersA && hasLettersB) return 1;  // B has letters in top segment -> comes first

  // 2. Segment by segment comparison
  const partsA = cleanA.split('.');
  const partsB = cleanB.split('.');

  // Compare project prefix if both have one and they differ (e.g. p0926 vs p1026)
  const isProjA = /^[pP](\d+)?$/i.test(partsA[0]);
  const isProjB = /^[pP](\d+)?$/i.test(partsB[0]);

  if (isProjA && isProjB && partsA[0].toLowerCase() !== partsB[0].toLowerCase()) {
    const cmpPrefix = partsA[0].localeCompare(partsB[0], undefined, { numeric: true });
    if (cmpPrefix !== 0) return cmpPrefix;
  }

  // Determine starting segment index for hierarchy
  const startIdxA = (isProjA && partsA.length > 1) ? 1 : 0;
  const startIdxB = (isProjB && partsB.length > 1) ? 1 : 0;

  // Top segment comparison
  const topA = partsA[startIdxA];
  const topB = partsB[startIdxB];

  if (hasLettersA && hasLettersB) {
    if (topA !== topB) {
      const cmpTop = topA.localeCompare(topB, undefined, { numeric: true, sensitivity: 'base' });
      if (cmpTop !== 0) return cmpTop;
    }
  } else if (!hasLettersA && !hasLettersB) {
    // Both are numeric top segments (e.g. 1, 2, ..., 17)
    const isNumTopA = /^\d+$/.test(topA);
    const isNumTopB = /^\d+$/.test(topB);
    if (isNumTopA && isNumTopB) {
      const numA = parseInt(topA, 10);
      const numB = parseInt(topB, 10);
      if (numA !== numB) return numA - numB;
    } else if (topA !== topB) {
      const cmpTop = topA.localeCompare(topB, undefined, { numeric: true });
      if (cmpTop !== 0) return cmpTop;
    }
  }

  // Compare subsequent segments
  const maxLen = Math.max(partsA.length - startIdxA, partsB.length - startIdxB);
  for (let offset = 0; offset < maxLen; offset++) {
    const segA = partsA[startIdxA + offset];
    const segB = partsB[startIdxB + offset];

    if (segA === undefined && segB === undefined) break;
    if (segA === undefined) return -1; // Shorter ancestor comes first
    if (segB === undefined) return 1;

    if (segA === segB) continue;

    // Numeric comparison for subsegments (1, 2... 9, 10... 17)
    const isNumA = /^\d+$/.test(segA);
    const isNumB = /^\d+$/.test(segB);

    if (isNumA && isNumB) {
      const numA = parseInt(segA, 10);
      const numB = parseInt(segB, 10);
      if (numA !== numB) return numA - numB;
      const cmp = segA.localeCompare(segB);
      if (cmp !== 0) return cmp;
    } else {
      const cmp = segA.localeCompare(segB, undefined, { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp;
    }
  }

  return cleanA.localeCompare(cleanB, undefined, { numeric: true });
}

/**
 * Returns visual color styles for a given hierarchy level, matching the Cronograma Gantt palette.
 */
export function getHierarchyRowStyles(nivel: number, esHoja: boolean): HierarchyStyle {
  if (esHoja) {
    return {
      rowBg: 'bg-white',
      hoverBg: 'hover:bg-slate-50/80',
      textCls: 'text-slate-700 font-medium',
      wbsCls: 'bg-slate-50 text-slate-650 border-slate-200 font-medium',
      borderLeft: 'border-l-4 border-l-transparent',
      levelBadgeBg: 'bg-slate-100 text-slate-600 border-slate-200',
      levelBadgeText: 'text-slate-600',
      levelName: 'Partida',
      accentColor: '#64748b'
    };
  }

  switch (nivel) {
    case 2: // Nivel 1 en UI / Capítulos (p.1, p.2... o Tipo)
      return {
        rowBg: 'bg-blue-50/85',
        hoverBg: 'hover:bg-blue-100/80',
        textCls: 'font-black text-blue-950 text-xs',
        wbsCls: 'bg-blue-100 text-blue-800 border-blue-300 font-bold',
        borderLeft: 'border-l-4 border-l-blue-600',
        levelBadgeBg: 'bg-blue-600 text-white border-blue-700 font-bold',
        levelBadgeText: 'text-blue-800',
        levelName: 'Capítulo',
        accentColor: '#2563eb'
      };
    case 3: // Subcapítulos (p.1.1... o SubC)
      return {
        rowBg: 'bg-emerald-50/75',
        hoverBg: 'hover:bg-emerald-100/75',
        textCls: 'font-bold text-emerald-950 text-xs',
        wbsCls: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
        borderLeft: 'border-l-4 border-l-emerald-500',
        levelBadgeBg: 'bg-emerald-600 text-white border-emerald-700 font-bold',
        levelBadgeText: 'text-emerald-800',
        levelName: 'Subcapítulo',
        accentColor: '#059669'
      };
    case 4: // Paquetes (p.1.1.1... o Scap)
      return {
        rowBg: 'bg-purple-50/70',
        hoverBg: 'hover:bg-purple-100/70',
        textCls: 'font-bold text-purple-950 text-xs',
        wbsCls: 'bg-purple-100 text-purple-800 border-purple-250 font-semibold',
        borderLeft: 'border-l-4 border-l-purple-500',
        levelBadgeBg: 'bg-purple-600 text-white border-purple-700 font-semibold',
        levelBadgeText: 'text-purple-800',
        levelName: 'Paquete',
        accentColor: '#7c3aed'
      };
    case 5: // Subpaquetes (p.1.1.1.1... o Unit)
      return {
        rowBg: 'bg-amber-50/70',
        hoverBg: 'hover:bg-amber-100/70',
        textCls: 'font-semibold text-amber-950 text-xs',
        wbsCls: 'bg-amber-100 text-amber-800 border-amber-250 font-semibold',
        borderLeft: 'border-l-4 border-l-amber-500',
        levelBadgeBg: 'bg-amber-600 text-white border-amber-700 font-semibold',
        levelBadgeText: 'text-amber-800',
        levelName: 'Subpaquete',
        accentColor: '#d97706'
      };
    case 6: // Detalle
      return {
        rowBg: 'bg-rose-50/60',
        hoverBg: 'hover:bg-rose-100/60',
        textCls: 'font-medium text-rose-950 text-xs',
        wbsCls: 'bg-rose-100 text-rose-800 border-rose-200 font-medium',
        borderLeft: 'border-l-4 border-l-rose-400',
        levelBadgeBg: 'bg-rose-600 text-white border-rose-700 font-medium',
        levelBadgeText: 'text-rose-800',
        levelName: 'Detalle',
        accentColor: '#db2777'
      };
    default:
      return {
        rowBg: 'bg-cyan-50/60',
        hoverBg: 'hover:bg-cyan-100/60',
        textCls: 'font-medium text-cyan-950 text-xs',
        wbsCls: 'bg-cyan-100 text-cyan-800 border-cyan-200 font-medium',
        borderLeft: 'border-l-4 border-l-cyan-405',
        levelBadgeBg: 'bg-cyan-600 text-white border-cyan-700 font-medium',
        levelBadgeText: 'text-cyan-800',
        levelName: `Nivel ${nivel}`,
        accentColor: '#0891b2'
      };
  }
}

/**
 * Builds a hierarchical tree from MasterCdoItem list and project actividades.
 */
export function buildMasterHierarchyTree(
  items: MasterCdoItem[],
  semanas: MasterCdoWeek[],
  actividades: Actividad[] = [],
  mode: MasterHierarchyMode = 'wbs'
): {
  nodeMap: Map<string, MasterHierarchyNode>;
  rootKeys: string[];
  allKeys: string[];
} {
  const nodeMap = new Map<string, MasterHierarchyNode>();
  const rootKeys: string[] = [];
  const allKeys: string[] = [];

  // Build lookup maps from actividades for descriptions and metadata
  const actividadByWbs = new Map<string, Actividad>();
  const actividadById = new Map<string, Actividad>();
  actividades.forEach(a => {
    if (a.wbs) {
      const parsed = parseWbsAndDescription(a.wbs);
      const cleanWbs = parsed.wbs || a.wbs;
      actividadByWbs.set(a.wbs.trim().toLowerCase(), a);
      actividadByWbs.set(cleanWbs.trim().toLowerCase(), a);
      actividadByWbs.set(cleanWbs.trim().toLowerCase().replace(/^p\d{4}\./, 'p.'), a);
    }
    if (a.activityId) actividadById.set(a.activityId.trim().toLowerCase(), a);
    if (a.id) actividadById.set(String(a.id).trim().toLowerCase(), a);
  });

  // Flat mode: simple 1-to-1 conversion
  if (mode === 'flat') {
    const sortedItems = [...items].sort((a, b) => compareWbs(a.wbs || '', b.wbs || ''));
    sortedItems.forEach(item => {
      const parsedItem = parseWbsAndDescription(item.wbs);
      const cleanWbs = parsedItem.wbs || item.wbs || '';
      const cantPres = Number(item.cantidadPresupuesto) || 0;
      const precio = Number(item.precio) || 0;
      const step = stepDeFila(item.step);
      const venta = ventaDeFila(item);

      const refAct = actividadById.get((item.activityId || '').toLowerCase()) ||
                     actividadById.get((item.id || '').toLowerCase()) ||
                     actividadByWbs.get(cleanWbs.toLowerCase());

      let cantAcum = Object.values(item.cantidadesSemanales || {}).reduce((s: number, val: any) => s + (Number(val) || 0), 0) as number;
      let avanceEconSum = Object.values(item.ventasSemanales || {}).reduce((s: number, val: any) => s + (Number(val) || 0), 0) as number;
      const cantSem = { ...(item.cantidadesSemanales || {}) } as Record<string, number>;
      const econSem = { ...(item.ventasSemanales || {}) } as Record<string, number>;

      const avanceEcon = avanceEconSum;
      const saldoEcon = Math.max(0, venta - avanceEcon);
      const pctAvance = cantPres > 0 ? (cantAcum / cantPres) * 100 : (venta > 0 ? (avanceEcon / venta) * 100 : 0);

      const node: MasterHierarchyNode = {
        key: item.id,
        parentKey: null,
        wbs: cleanWbs,
        idOrig: item.idOrig || '',
        activityId: item.activityId || '',
        descripcion: item.descripcion || parsedItem.description || '',
        unidad: item.unidad || 'UND',
        nivel: 2,
        depth: 0,
        esHoja: true,
        subcontratista: item.subcontratista || refAct?.subcontratista || 'Propio',
        tipo: item.tipo || refAct?.tipo || item.cap || '',
        cap: item.cap || refAct?.cap || '',
        scap: item.scap || refAct?.scap || '',
        unit: item.unit || refAct?.unit || '',
        macro: item.macro || refAct?.macro || '',
        grupo: item.grupo || refAct?.grupo || '',
        partidas: item.partidas || refAct?.partidas || '',
        componente: item.componente || refAct?.componente || '',
        ubicacion: item.ubicacion || refAct?.ubicacion || '',
        proceso: item.proceso || refAct?.proceso || '',
        resp: item.resp || refAct?.resp || '',
        itemRef: item,
        cantidadPresupuesto: cantPres,
        precio,
        step,
        venta,
        cantAcum,
        avanceEcon,
        saldoEcon,
        pctAvance: Number(pctAvance.toFixed(2)),
        cantidadesSemanales: cantSem,
        avanceEconSemanales: econSem,
        totalLeavesCount: 1,
        directChildrenKeys: []
      };

      nodeMap.set(node.key, node);
      rootKeys.push(node.key);
      allKeys.push(node.key);
    });

    return { nodeMap, rootKeys, allKeys };
  }

  // ── Register all hierarchy descriptions from Column A and activities ──
  const wbsDescriptions = new Map<string, string>();
  // weak = nombre deducido (CAP/SCAP o nombre de una actividad): solo se usa si la fila de
  // encabezado del CDO no da uno; nunca reemplaza al nombre real.
  const registerDesc = (code: string, desc: string, weak = false) => {
    if (!code || !desc) return;
    const cleanCode = code.trim().toLowerCase();
    const cleanDesc = desc.trim();
    if (!cleanDesc) return;
    if (weak) {
      const normWeak = cleanCode.replace(/^p\d{4}\./, 'p.');
      if (wbsDescriptions.has(cleanCode) || wbsDescriptions.has(normWeak)) return;
    }
    const isGeneric = /^partida\s+/i.test(cleanDesc) || /^cap[ií]tulo\s+/i.test(cleanDesc) || /^subcap[ií]tulo\s+/i.test(cleanDesc);
    if (wbsDescriptions.has(cleanCode) && isGeneric) return;

    wbsDescriptions.set(cleanCode, cleanDesc);
    const norm = cleanCode.replace(/^p\d{4}\./, 'p.');
    wbsDescriptions.set(norm, cleanDesc);

    if (norm.startsWith('p.')) {
      const suffix = norm.slice(2);
      wbsDescriptions.set(suffix, cleanDesc);
      wbsDescriptions.set(`p0926.${suffix}`, cleanDesc);
      wbsDescriptions.set(`p1026.${suffix}`, cleanDesc);
      wbsDescriptions.set(`p.${suffix}`, cleanDesc);
    }
  };

  // 1. Pre-seed default chapter names (1-17, D)
  Object.entries(DEFAULT_CHAPTER_DESCRIPTIONS).forEach(([ch, desc]) => {
    registerDesc(ch, desc);
    registerDesc(`p.${ch}`, desc);
    registerDesc(`p0926.${ch}`, desc);
    registerDesc(`p1026.${ch}`, desc);
  });

  // 2. Extract from actividades (Column A, wbsRaw, wbs, cap, scap, etc.)
  actividades.forEach(a => {
    if ((a as any).wbsRaw) {
      const p = parseWbsAndDescription((a as any).wbsRaw);
      if (p.description) {
        registerDesc(p.wbs, p.description);
        registerDesc(p.normalizedWbs, p.description);
      }
    }
    if (a.wbs) {
      const p = parseWbsAndDescription(a.wbs);
      if (p.description) {
        registerDesc(p.wbs, p.description);
        registerDesc(p.normalizedWbs, p.description);
      }
      if (a.descripcion && !a.esItemHoja) {
        registerDesc(p.wbs || a.wbs, a.descripcion);
      } else if (a.descripcion) {
        registerDesc(p.wbs || a.wbs, a.descripcion, true);
      }
    }
    if (a.cap && a.wbs) {
      const pCap = parseWbsAndDescription(a.cap);
      const capDesc = pCap.description || a.cap.replace(/^[\d\.]+\s*[-–—:]?\s*/, '').trim();
      if (capDesc) {
        const parts = (a.wbs || '').split('.');
        if (parts.length >= 2) {
          registerDesc(parts.slice(0, 2).join('.'), capDesc, true);
        }
      }
    }
    if (a.scap && a.wbs) {
      const pScap = parseWbsAndDescription(a.scap);
      const scapDesc = pScap.description || a.scap.replace(/^[\d\.]+\s*[-–—:]?\s*/, '').trim();
      if (scapDesc) {
        const parts = (a.wbs || '').split('.');
        if (parts.length >= 3) {
          registerDesc(parts.slice(0, 3).join('.'), scapDesc, true);
        }
      }
    }
  });

  // 3. Extract from items (Master CDO rows)
  items.forEach(item => {
    if (item.wbs) {
      const p = parseWbsAndDescription(item.wbs);
      if (p.description) {
        registerDesc(p.wbs, p.description);
        registerDesc(p.normalizedWbs, p.description);
      }
      if (item.descripcion && (item.esItemHoja === false || !item.activityId)) {
        registerDesc(p.wbs || item.wbs, item.descripcion);
      }
    }
    if ((item as any).wbsDesc) {
      registerDesc(item.wbs, (item as any).wbsDesc);
    }
    if ((item as any).wbsRaw) {
      const p = parseWbsAndDescription((item as any).wbsRaw);
      if (p.description) {
        registerDesc(p.wbs, p.description);
        registerDesc(p.normalizedWbs, p.description);
      }
    }
    if (item.cap && item.wbs) {
      const pCap = parseWbsAndDescription(item.cap);
      const capDesc = pCap.description || item.cap.replace(/^[\d\.]+\s*[-–—:]?\s*/, '').trim();
      if (capDesc) {
        const parts = (item.wbs || '').split('.');
        if (parts.length >= 2) {
          registerDesc(parts.slice(0, 2).join('.'), capDesc, true);
        }
      }
    }
    if (item.scap && item.wbs) {
      const pScap = parseWbsAndDescription(item.scap);
      const scapDesc = pScap.description || item.scap.replace(/^[\d\.]+\s*[-–—:]?\s*/, '').trim();
      if (scapDesc) {
        const parts = (item.wbs || '').split('.');
        if (parts.length >= 3) {
          registerDesc(parts.slice(0, 3).join('.'), scapDesc, true);
        }
      }
    }
  });

  const getHierarchyDescription = (wbsKey: string, level: number): string => {
    const key = wbsKey.trim().toLowerCase();
    const normKey = key.replace(/^p\d{4}\./, 'p.');

    // 1. Direct match in registered descriptions
    if (wbsDescriptions.has(key)) return wbsDescriptions.get(key)!;
    if (wbsDescriptions.has(normKey)) return wbsDescriptions.get(normKey)!;

    // Suffix without 'p.' (e.g. '17' or '17.1')
    const noPKey = normKey.startsWith('p.') ? normKey.slice(2) : normKey;
    if (wbsDescriptions.has(noPKey)) return wbsDescriptions.get(noPKey)!;

    // 2. Match from actividadByWbs
    const refAct = actividadByWbs.get(key) || actividadByWbs.get(normKey) || actividadByWbs.get(noPKey);
    if (refAct?.descripcion && !/^partida\s+/i.test(refAct.descripcion)) {
      return refAct.descripcion;
    }
    if (refAct?.cap && level === 2) {
      const pCap = parseWbsAndDescription(refAct.cap);
      if (pCap.description) return pCap.description;
    }
    if (refAct?.scap && level === 3) {
      const pScap = parseWbsAndDescription(refAct.scap);
      if (pScap.description) return pScap.description;
    }

    // 3. Match by chapter segment (e.g. 17 from p0926.17)
    const parts = normKey.split('.');
    if (parts.length >= 2) {
      const chapterSeg = parts[1];
      if (wbsDescriptions.has(chapterSeg)) {
        return wbsDescriptions.get(chapterSeg)!;
      }
      if (level === 2 && DEFAULT_CHAPTER_DESCRIPTIONS[chapterSeg]) {
        return DEFAULT_CHAPTER_DESCRIPTIONS[chapterSeg];
      }
    }

    // 4. Default fallback with clean label
    const isD = hasDirectoOrDSegment(wbsKey);
    if (isD) {
      return level === 2
        ? 'Partidas Directas / Adicionales'
        : `Subcapítulo ${wbsKey}`;
    }

    return level === 2 ? `Capítulo ${wbsKey}` : `Subcapítulo ${wbsKey}`;
  };

  // Helper to normalize WBS
  // Igual que el Gantt: "p0926.1.4" y "p.1.4" son el mismo nodo (se muestra como "p.1.4").
  const normalizeWbs = (w: string) => {
    if (!w) return '';
    const parsed = parseWbsAndDescription(w);
    return (parsed.wbs || w).trim().replace(/\s+/g, '').replace(/^p\d{4}\./i, 'p.');
  };
  const isProjectRoot = (w: string) => /^p\d{4}$/i.test(w) || /^p\.?$/i.test(w);

  if (mode === 'wbs') {
    // ── VISTA WBS: Jerarquía por Capítulos, Subcapítulos y Paquetes ──
    const parentsAdded = new Set<string>();

    // 1. First ensure all parent header nodes from actividades exist or get extracted
    actividades.forEach(a => {
      if (!a.esItemHoja && a.wbs) {
        const rawWbs = a.wbs || '';
        const parsed = parseWbsAndDescription(rawWbs);
        const wbs = normalizeWbs(rawWbs);
        if (!wbs || isProjectRoot(wbs)) return; // Excluir la raíz del proyecto (p0926)
        if (!parentsAdded.has(wbs)) {
          parentsAdded.add(wbs);
          const parts = wbs.split('.');
          const hasProjectCode = /^[pP]/.test(parts[0]);
          const minLengthForParent = hasProjectCode ? 2 : 1;
          let parentKey = parts.length > minLengthForParent ? parts.slice(0, -1).join('.') : null;
          
          const desc = parsed.description || (a.descripcion && !/^partida\s+/i.test(a.descripcion) ? a.descripcion : getHierarchyDescription(wbs, parts.length));
          const node: MasterHierarchyNode = {
            key: wbs,
            parentKey,
            wbs,
            idOrig: a.idOrig ? String(a.idOrig) : '',
            activityId: a.activityId || '',
            descripcion: desc,
            unidad: a.unidad || 'UND',
            nivel: parts.length,
            depth: Math.max(0, parts.length - minLengthForParent),
            esHoja: false,
            subcontratista: a.subcontratista || '',
            cap: a.cap || '',
            scap: a.scap || '',
            cantidadPresupuesto: 0,
            precio: 0,
            step: 1,
            venta: 0,
            cantAcum: 0,
            avanceEcon: 0,
            saldoEcon: 0,
            pctAvance: 0,
            cantidadesSemanales: {},
            avanceEconSemanales: {},
            totalLeavesCount: 0,
            directChildrenKeys: []
          };
          nodeMap.set(wbs, node);
          allKeys.push(wbs);
        }
      }
    });

    // 2. Add all leaf items from CDO, ensuring their ancestor WBS nodes exist
    items.forEach((item, idx) => {
      const rawWbs = item.wbs || '';
      const parsedItem = parseWbsAndDescription(rawWbs);
      const cleanWbs = parsedItem.wbs || rawWbs;
      const wbs = cleanWbs ? normalizeWbs(cleanWbs) : `sin_wbs_${idx}`;
      if (isProjectRoot(wbs)) return; // fila raíz del proyecto (p0926)
      const parts = wbs.split('.');

      // Clean up item itself if it had merged Column A text
      if (parsedItem.wbs && parsedItem.description) {
        item.wbs = parsedItem.wbs;
      }
      if (parsedItem.description && (!item.descripcion || /^partida\s+/i.test(item.descripcion))) {
        item.descripcion = parsedItem.description;
      }

      // Generate missing ancestors if any (from chapter level 2 upwards)
      const hasProjectCode = /^[pP]/.test(parts[0]);
      const minLevel = hasProjectCode ? 2 : 1;

      if (parts.length >= minLevel) {
        const maxAncestorLevel = item.esItemHoja === false ? parts.length : Math.max(minLevel, parts.length - 1);
        for (let i = minLevel; i <= maxAncestorLevel; i++) {
          const ancestorWbs = parts.slice(0, i).join('.');
          if (!nodeMap.has(ancestorWbs)) {
            const ancParent = i > minLevel ? parts.slice(0, i - 1).join('.') : null;
            const refAct = actividadByWbs.get(ancestorWbs.toLowerCase()) || actividadByWbs.get(ancestorWbs.toLowerCase().replace(/^p\d{4}\./, 'p.'));
            const desc = getHierarchyDescription(ancestorWbs, i);
            const ancNode: MasterHierarchyNode = {
              key: ancestorWbs,
              parentKey: ancParent,
              wbs: ancestorWbs,
              idOrig: '',
              activityId: '',
              descripcion: desc,
              unidad: '',
              nivel: i,
              depth: Math.max(0, i - minLevel),
              esHoja: false,
              subcontratista: refAct?.subcontratista || '',
              cap: refAct?.cap || '',
              scap: refAct?.scap || '',
              cantidadPresupuesto: 0,
              precio: 0,
              step: 1,
              venta: 0,
              cantAcum: 0,
              avanceEcon: 0,
              saldoEcon: 0,
              pctAvance: 0,
              cantidadesSemanales: {},
              avanceEconSemanales: {},
              totalLeavesCount: 0,
              directChildrenKeys: []
            };
            nodeMap.set(ancestorWbs, ancNode);
            allKeys.push(ancestorWbs);
          }
        }
      }

      // Check if this item is a leaf or a header row in the CDO file
      const isHeader = item.esItemHoja === false || (nodeMap.has(wbs) && !nodeMap.get(wbs)!.esHoja && item.id === wbs);

      if (isHeader) {
        // Update header description if present
        const existing = nodeMap.get(wbs);
        if (existing) {
          const newDesc = parsedItem.description || (item.descripcion && !/^partida\s+/i.test(item.descripcion) ? item.descripcion : existing.descripcion);
          if (newDesc) existing.descripcion = newDesc;
          if (item.subcontratista) existing.subcontratista = item.subcontratista;
        }
        return;
      }

      // Create Leaf Node
      const cantPres = Number(item.cantidadPresupuesto) || 0;
      const precio = Number(item.precio) || 0;
      const step = stepDeFila(item.step);
      const venta = ventaDeFila(item);

      const matchedAct = actividadById.get((item.activityId || '').toLowerCase()) ||
                         actividadById.get((item.id || '').toLowerCase()) ||
                         actividadByWbs.get(cleanWbs.toLowerCase());

      let cantAcum = Object.values(item.cantidadesSemanales || {}).reduce((s: number, val: any) => s + (Number(val) || 0), 0) as number;
      let avanceEconSum = Object.values(item.ventasSemanales || {}).reduce((s: number, val: any) => s + (Number(val) || 0), 0) as number;
      const cantSem = { ...(item.cantidadesSemanales || {}) } as Record<string, number>;
      const econSem = { ...(item.ventasSemanales || {}) } as Record<string, number>;

      const avanceEcon = avanceEconSum;
      const saldoEcon = Math.max(0, venta - avanceEcon);
      const pctAvance = cantPres > 0 ? (cantAcum / cantPres) * 100 : (venta > 0 ? (avanceEcon / venta) * 100 : 0);

      // Parent key for leaf item:
      // If item's WBS is p.1.1.05 and parts.length > 2:
      // If nodeMap has p.1.1.05 as header, parent is p.1.1.05
      // Else parent is p.1.1
      let parentKey: string | null = null;
      if (parts.length > minLevel) {
        const parentCandidate = parts.slice(0, -1).join('.');
        if (nodeMap.has(wbs) && nodeMap.get(wbs)!.key !== item.id) {
          parentKey = wbs;
        } else if (nodeMap.has(parentCandidate)) {
          parentKey = parentCandidate;
        } else {
          parentKey = parts.slice(0, minLevel).join('.'); // Fallback to root chapter p.X or 1
        }
      } else if (parts.length === minLevel) {
        parentKey = wbs;
      }

      const leafKey = `leaf_${item.id}`;
      const leafDepth = parentKey && nodeMap.has(parentKey) ? nodeMap.get(parentKey)!.depth + 1 : 1;

      const leafNode: MasterHierarchyNode = {
        key: leafKey,
        parentKey,
        wbs: cleanWbs || item.wbs || '',
        idOrig: item.idOrig || '',
        activityId: item.activityId || '',
        descripcion: item.descripcion || parsedItem.description || (actividadByWbs.get(cleanWbs.toLowerCase())?.descripcion) || '',
        unidad: item.unidad || 'UND',
        nivel: leafDepth + 2,
        depth: leafDepth,
        esHoja: true,
        subcontratista: item.subcontratista || matchedAct?.subcontratista || 'Propio',
        tipo: item.tipo || matchedAct?.tipo || '',
        cap: item.cap || matchedAct?.cap || '',
        scap: item.scap || matchedAct?.scap || '',
        unit: item.unit || matchedAct?.unit || '',
        macro: item.macro || matchedAct?.macro || '',
        grupo: item.grupo || matchedAct?.grupo || '',
        partidas: item.partidas || matchedAct?.partidas || '',
        componente: item.componente || matchedAct?.componente || '',
        ubicacion: item.ubicacion || matchedAct?.ubicacion || '',
        proceso: item.proceso || matchedAct?.proceso || '',
        resp: item.resp || matchedAct?.resp || '',
        itemRef: item,
        cantidadPresupuesto: cantPres,
        precio,
        step,
        venta,
        cantAcum,
        avanceEcon,
        saldoEcon,
        pctAvance: Number(pctAvance.toFixed(2)),
        cantidadesSemanales: cantSem,
        avanceEconSemanales: econSem,
        totalLeavesCount: 1,
        directChildrenKeys: []
      };

      nodeMap.set(leafKey, leafNode);
      allKeys.push(leafKey);
    });

    // Partidas de actividades P6: cuelgan de su actividad (no de la WBS). La actividad P6 pasa
    // a ser un grupo y su total es la suma de sus partidas, igual que en el Gantt.
    const leafByActivityId = new Map<string, string>();
    nodeMap.forEach(n => {
      if (n.esHoja && n.activityId && !n.itemRef?.parentActivityId) {
        leafByActivityId.set(n.activityId.trim().toLowerCase(), n.key);
      }
    });
    nodeMap.forEach(n => {
      const pid = n.itemRef?.parentActivityId;
      if (!n.esHoja || !pid) return;
      let parentKey = leafByActivityId.get(String(pid).trim().toLowerCase());
      if (!parentKey) {
        // Actividad P6 inexistente en el CDO (p. ej. "11.5.1.p6"): va al capítulo WBS más cercano.
        const parts = normalizeWbs(String(pid).replace(/\.p6$/i, '')).replace(/^(?!p\.)/i, 'p.').split('.');
        while (parts.length > 1 && !(nodeMap.has(parts.join('.')) && !nodeMap.get(parts.join('.'))!.esHoja)) parts.pop();
        const k = parts.join('.');
        if (parts.length > 1 && nodeMap.has(k)) {
          n.parentKey = k;
          n.depth = nodeMap.get(k)!.depth + 1;
          n.nivel = n.depth + 2;
        }
        return;
      }
      const parent = nodeMap.get(parentKey);
      if (!parent) return;
      parent.esHoja = false;
      n.parentKey = parentKey;
      n.depth = parent.depth + 1;
      n.nivel = n.depth + 2;
    });

  } else if (mode === 'tipo_subc_scap_unit') {
    // ── VISTA 2: Componente (Columna AJ) -> Tipo -> Subcontratista -> Scap -> Unit -> Actividades ──
    const componentesAdded = new Set<string>();
    const tiposAdded = new Set<string>();
    const subcsAdded = new Set<string>();
    const scapsAdded = new Set<string>();
    const unitsAdded = new Set<string>();

    items.forEach(item => {
      const actRef = actividadById.get((item.activityId || '').toLowerCase()) ||
                     actividadByWbs.get((item.wbs || '').toLowerCase());

      const compVal = (item.componente || actRef?.componente || (actRef as any)?.comp || 'Sin Componente').trim() || 'Sin Componente';
      const tipoVal = (item.tipo || actRef?.tipo || (actRef as any)?.tipoG || item.cap || 'Sin Tipo').trim() || 'Sin Tipo';
      const subcVal = (item.subcontratista || actRef?.subcontratista || 'Sin Subcontratista').trim() || 'Sin Subcontratista';
      const scapVal = (item.scap || actRef?.scap || 'Sin Scap').trim() || 'Sin Scap';
      const unitVal = (actRef?.unit || item.unit || 'General').trim() || 'General';

      const compKey = `COMP__${compVal}`;
      const tipoKey = `${compKey}__TIPO__${tipoVal}`;
      const subcKey = `${tipoKey}__SUBC__${subcVal}`;
      const scapKey = `${subcKey}__SCAP__${scapVal}`;
      const unitKey = `${scapKey}__UNIT__${unitVal}`;
      const leafKey = `leaf_${item.id}`;

      // Nivel 2: Componente (Raíz)
      if (!componentesAdded.has(compKey)) {
        componentesAdded.add(compKey);
        const node: MasterHierarchyNode = {
          key: compKey,
          parentKey: null,
          wbs: 'COMPONENTE',
          idOrig: '',
          activityId: '',
          descripcion: compVal,
          unidad: '',
          nivel: 2,
          depth: 0,
          esHoja: false,
          subcontratista: '',
          componente: compVal,
          tipo: '',
          cantidadPresupuesto: 0,
          precio: 0,
          step: 1,
          venta: 0,
          cantAcum: 0,
          avanceEcon: 0,
          saldoEcon: 0,
          pctAvance: 0,
          cantidadesSemanales: {},
          avanceEconSemanales: {},
          totalLeavesCount: 0,
          directChildrenKeys: []
        };
        nodeMap.set(compKey, node);
        allKeys.push(compKey);
      }

      // Nivel 3: Tipo
      if (!tiposAdded.has(tipoKey)) {
        tiposAdded.add(tipoKey);
        const node: MasterHierarchyNode = {
          key: tipoKey,
          parentKey: compKey,
          wbs: 'TIPO',
          idOrig: '',
          activityId: '',
          descripcion: tipoVal,
          unidad: '',
          nivel: 3,
          depth: 1,
          esHoja: false,
          subcontratista: '',
          componente: compVal,
          tipo: tipoVal,
          cantidadPresupuesto: 0,
          precio: 0,
          step: 1,
          venta: 0,
          cantAcum: 0,
          avanceEcon: 0,
          saldoEcon: 0,
          pctAvance: 0,
          cantidadesSemanales: {},
          avanceEconSemanales: {},
          totalLeavesCount: 0,
          directChildrenKeys: []
        };
        nodeMap.set(tipoKey, node);
        allKeys.push(tipoKey);
      }

      // Nivel 4: Subcontratista
      if (!subcsAdded.has(subcKey)) {
        subcsAdded.add(subcKey);
        const node: MasterHierarchyNode = {
          key: subcKey,
          parentKey: tipoKey,
          wbs: 'SUBC',
          idOrig: '',
          activityId: '',
          descripcion: subcVal,
          unidad: '',
          nivel: 4,
          depth: 2,
          esHoja: false,
          subcontratista: subcVal,
          componente: compVal,
          tipo: tipoVal,
          cantidadPresupuesto: 0,
          precio: 0,
          step: 1,
          venta: 0,
          cantAcum: 0,
          avanceEcon: 0,
          saldoEcon: 0,
          pctAvance: 0,
          cantidadesSemanales: {},
          avanceEconSemanales: {},
          totalLeavesCount: 0,
          directChildrenKeys: []
        };
        nodeMap.set(subcKey, node);
        allKeys.push(subcKey);
      }

      // Nivel 5: Scap
      if (!scapsAdded.has(scapKey)) {
        scapsAdded.add(scapKey);
        const node: MasterHierarchyNode = {
          key: scapKey,
          parentKey: subcKey,
          wbs: 'SCAP',
          idOrig: '',
          activityId: '',
          descripcion: scapVal,
          unidad: '',
          nivel: 5,
          depth: 3,
          esHoja: false,
          subcontratista: subcVal,
          componente: compVal,
          scap: scapVal,
          tipo: tipoVal,
          cantidadPresupuesto: 0,
          precio: 0,
          step: 1,
          venta: 0,
          cantAcum: 0,
          avanceEcon: 0,
          saldoEcon: 0,
          pctAvance: 0,
          cantidadesSemanales: {},
          avanceEconSemanales: {},
          totalLeavesCount: 0,
          directChildrenKeys: []
        };
        nodeMap.set(scapKey, node);
        allKeys.push(scapKey);
      }

      // Nivel 6: Unit
      if (!unitsAdded.has(unitKey)) {
        unitsAdded.add(unitKey);
        const node: MasterHierarchyNode = {
          key: unitKey,
          parentKey: scapKey,
          wbs: 'UNIT',
          idOrig: '',
          activityId: '',
          descripcion: `Frente: ${unitVal}`,
          unidad: '',
          nivel: 6,
          depth: 4,
          esHoja: false,
          subcontratista: subcVal,
          componente: compVal,
          unit: unitVal,
          tipo: tipoVal,
          cantidadPresupuesto: 0,
          precio: 0,
          step: 1,
          venta: 0,
          cantAcum: 0,
          avanceEcon: 0,
          saldoEcon: 0,
          pctAvance: 0,
          cantidadesSemanales: {},
          avanceEconSemanales: {},
          totalLeavesCount: 0,
          directChildrenKeys: []
        };
        nodeMap.set(unitKey, node);
        allKeys.push(unitKey);
      }

      // Leaf Node
      const cantPres = Number(item.cantidadPresupuesto) || 0;
      const precio = Number(item.precio) || 0;
      const step = stepDeFila(item.step);
      const venta = ventaDeFila(item);

      let cantAcum = Object.values(item.cantidadesSemanales || {}).reduce((s: number, val: any) => s + (Number(val) || 0), 0) as number;
      let avanceEconSum = Object.values(item.ventasSemanales || {}).reduce((s: number, val: any) => s + (Number(val) || 0), 0) as number;
      const cantSem = { ...(item.cantidadesSemanales || {}) } as Record<string, number>;
      const econSem = { ...(item.ventasSemanales || {}) } as Record<string, number>;

      const avanceEcon = avanceEconSum;
      const saldoEcon = Math.max(0, venta - avanceEcon);
      const pctAvance = cantPres > 0 ? (cantAcum / cantPres) * 100 : (venta > 0 ? (avanceEcon / venta) * 100 : 0);

      const leafNode: MasterHierarchyNode = {
        key: leafKey,
        parentKey: unitKey,
        wbs: item.wbs || '',
        idOrig: item.idOrig || '',
        activityId: item.activityId || '',
        descripcion: item.descripcion || '',
        unidad: item.unidad || 'UND',
        nivel: 7,
        depth: 5,
        esHoja: true,
        subcontratista: subcVal,
        tipo: tipoVal,
        cap: item.cap || actRef?.cap || '',
        scap: scapVal,
        unit: unitVal,
        macro: item.macro || actRef?.macro || '',
        grupo: item.grupo || actRef?.grupo || '',
        partidas: item.partidas || actRef?.partidas || '',
        componente: compVal,
        ubicacion: item.ubicacion || actRef?.ubicacion || '',
        proceso: item.proceso || actRef?.proceso || '',
        resp: item.resp || actRef?.resp || '',
        itemRef: item,
        cantidadPresupuesto: cantPres,
        precio,
        step,
        venta,
        cantAcum,
        avanceEcon,
        saldoEcon,
        pctAvance: Number(pctAvance.toFixed(2)),
        cantidadesSemanales: cantSem,
        avanceEconSemanales: econSem,
        totalLeavesCount: 1,
        directChildrenKeys: []
      };

      nodeMap.set(leafKey, leafNode);
      allKeys.push(leafKey);
    });
  }

  // 3. Link parent-child references and identify root keys
  nodeMap.forEach(node => {
    if (node.parentKey && nodeMap.has(node.parentKey)) {
      nodeMap.get(node.parentKey)!.directChildrenKeys.push(node.key);
    } else {
      rootKeys.push(node.key);
    }
  });

  // 4. Roll-up metric aggregation from bottom-up (leaves to roots)
  const computeMetrics = (nodeKey: string): {
    cantPres: number;
    venta: number;
    cantAcum: number;
    avanceEcon: number;
    saldoEcon: number;
    cantSem: Record<string, number>;
    econSem: Record<string, number>;
    totalLeaves: number;
    units: Set<string>;
  } => {
    const node = nodeMap.get(nodeKey);
    if (!node) {
      return {
        cantPres: 0,
        venta: 0,
        cantAcum: 0,
        avanceEcon: 0,
        saldoEcon: 0,
        cantSem: {},
        econSem: {},
        totalLeaves: 0,
        units: new Set()
      };
    }

    if (node.esHoja) {
      const units = new Set<string>();
      if (node.unidad) units.add(node.unidad.toUpperCase());
      return {
        cantPres: node.cantidadPresupuesto,
        venta: node.venta,
        cantAcum: node.cantAcum,
        avanceEcon: node.avanceEcon,
        saldoEcon: node.saldoEcon,
        cantSem: { ...node.cantidadesSemanales },
        econSem: { ...node.avanceEconSemanales },
        totalLeaves: 1,
        units
      };
    }

    let rolledCantPres = 0;
    let rolledVenta = 0;
    let rolledCantAcum = 0;
    let rolledAvanceEcon = 0;
    let rolledSaldoEcon = 0;
    let rolledLeaves = 0;
    const rolledCantSem: Record<string, number> = {};
    const rolledEconSem: Record<string, number> = {};
    const childUnits = new Set<string>();

    node.directChildrenKeys.forEach(chKey => {
      const ch = computeMetrics(chKey);
      rolledCantPres += ch.cantPres;
      rolledVenta += ch.venta;
      rolledCantAcum += ch.cantAcum;
      rolledAvanceEcon += ch.avanceEcon;
      rolledSaldoEcon += ch.saldoEcon;
      rolledLeaves += ch.totalLeaves;

      ch.units.forEach(u => childUnits.add(u));

      semanas.forEach(sem => {
        rolledCantSem[sem.id] = (rolledCantSem[sem.id] || 0) + (ch.cantSem[sem.id] || 0);
        rolledEconSem[sem.id] = (rolledEconSem[sem.id] || 0) + (ch.econSem[sem.id] || 0);
      });
    });

    node.cantidadPresupuesto = rolledCantPres;
    node.venta = rolledVenta;
    node.cantAcum = rolledCantAcum;
    node.avanceEcon = rolledAvanceEcon;
    node.saldoEcon = Math.max(0, rolledVenta - rolledAvanceEcon);
    node.pctAvance = rolledVenta > 0
      ? Number(((rolledAvanceEcon / rolledVenta) * 100).toFixed(2))
      : 0;
    node.totalLeavesCount = rolledLeaves;
    node.cantidadesSemanales = rolledCantSem;
    node.avanceEconSemanales = rolledEconSem;

    // Unit display: if all children share the same unit, keep it; otherwise show multiple or leave empty
    if (childUnits.size === 1) {
      node.unidad = Array.from(childUnits)[0];
    } else if (childUnits.size > 1) {
      node.unidad = 'Var.';
    }

    return {
      cantPres: rolledCantPres,
      venta: rolledVenta,
      cantAcum: rolledCantAcum,
      avanceEcon: rolledAvanceEcon,
      saldoEcon: node.saldoEcon,
      cantSem: rolledCantSem,
      econSem: rolledEconSem,
      totalLeaves: rolledLeaves,
      units: childUnits
    };
  };

  rootKeys.forEach(rKey => computeMetrics(rKey));

  // 5. Remove empty parent nodes that have 0 leaf children (dead branches)
  const prunedRootKeys: string[] = [];
  rootKeys.forEach(rKey => {
    const node = nodeMap.get(rKey);
    if (node && (node.totalLeavesCount > 0 || node.esHoja)) {
      prunedRootKeys.push(rKey);
    }
  });

  // Sort roots naturally (chapters with letters in top level like p0926.A1 and p0926.D first, then numeric chapters 1 to 17)
  prunedRootKeys.sort((aKey, bKey) => {
    const aNode = nodeMap.get(aKey);
    const bNode = nodeMap.get(bKey);
    if (!aNode || !bNode) return 0;
    if (mode === 'tipo_subc_scap_unit') {
      return (aNode.descripcion || '').localeCompare(bNode.descripcion || '');
    }
    return compareWbs(aNode.wbs, bNode.wbs);
  });

  return { nodeMap, rootKeys: prunedRootKeys, allKeys };
}

export type TextFilterOperator = 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'equals' | 'not_equals';

export interface HierarchyTextFilter {
  op1: TextFilterOperator;
  val1: string;
  logic: 'and' | 'or';
  op2: TextFilterOperator;
  val2: string;
  active: boolean;
}

export function evaluateHierarchyTextFilter(cellValue: string, filter?: HierarchyTextFilter | null): boolean {
  if (!filter || !filter.active) return true;
  if (!filter.val1 && !filter.val2) return true;

  const checkOp = (val: string, op: TextFilterOperator) => {
    if (!val) return true;
    const lowerVal = val.trim().toLowerCase();
    const target = (cellValue || '').trim().toLowerCase();
    switch (op) {
      case 'contains': return target.includes(lowerVal);
      case 'not_contains': return !target.includes(lowerVal);
      case 'starts_with': return target.startsWith(lowerVal);
      case 'ends_with': return target.endsWith(lowerVal);
      case 'equals': return target === lowerVal;
      case 'not_equals': return target !== lowerVal;
      default: return true;
    }
  };

  const match1 = filter.val1 ? checkOp(filter.val1, filter.op1) : true;
  const match2 = filter.val2 ? checkOp(filter.val2, filter.op2) : true;

  if (!filter.val1) return match2;
  if (!filter.val2) return match1;
  return filter.logic === 'and' ? (match1 && match2) : (match1 || match2);
}

/**
 * Checks whether a hierarchy node (leaf or parent) matches the search text in any of its textual fields.
 */
function nodeMatchesSearchQuery(node: MasterHierarchyNode, searchLower: string): boolean {
  if (!searchLower) return true;
  
  const fieldsToCheck = [
    node.wbs,
    node.descripcion,
    node.idOrig,
    node.itemRef?.idOrig,
    node.activityId,
    node.itemRef?.activityId,
    node.subcontratista,
    node.itemRef?.subcontratista,
    node.tipo,
    node.itemRef?.tipo,
    node.cap,
    node.itemRef?.cap,
    node.scap,
    node.itemRef?.scap,
    node.unit,
    node.itemRef?.unit,
    node.macro,
    node.itemRef?.macro,
    node.grupo,
    node.itemRef?.grupo,
    node.partidas,
    node.componente,
    node.ubicacion,
    node.proceso,
    node.resp,
    node.unidad
  ];

  return fieldsToCheck.some(f => f && typeof f === 'string' && f.toLowerCase().includes(searchLower));
}

/**
 * Flattens the visible nodes based on active expansion and filters.
 * Works seamlessly whether the tree is collapsed or fully expanded:
 * When any search or filter is active, it evaluates the entire tree dataset and automatically
 * expands the branches containing matching items so they are immediately visible.
 */
export function getVisibleHierarchyNodes(
  nodeMap: Map<string, MasterHierarchyNode>,
  rootKeys: string[],
  expandedKeys: Set<string>,
  filterSubc: string = 'all',
  filterAvance: 'all' | 'con_avance' | 'sin_avance' | 'saldo_pendiente' = 'all',
  searchTerm: string = '',
  columnFilters?: {
    idOrigFilter?: HierarchyTextFilter;
    activityIdFilter?: HierarchyTextFilter;
  }
): MasterHierarchyNode[] {
  const visibleList: MasterHierarchyNode[] = [];
  const normalizedSearch = searchTerm.trim().toLowerCase();
  
  const isIdOrigActive = Boolean(columnFilters?.idOrigFilter?.active && (columnFilters.idOrigFilter.val1 || columnFilters.idOrigFilter.val2));
  const isActivityIdActive = Boolean(columnFilters?.activityIdFilter?.active && (columnFilters.activityIdFilter.val1 || columnFilters.activityIdFilter.val2));

  const isFilterActive = 
    filterSubc !== 'all' || 
    filterAvance !== 'all' || 
    normalizedSearch !== '' ||
    isIdOrigActive ||
    isActivityIdActive;

  // Set of node keys that should be included in the visible tree
  const matchingNodeKeys = new Set<string>();

  if (isFilterActive) {
    // Helper to test if a leaf node matches non-search criteria (subcontractor, avance, column filters)
    const leafMatchesNonSearchFilters = (node: MasterHierarchyNode): boolean => {
      if (!node.esHoja) return false;
      if (filterSubc !== 'all' && node.subcontratista !== filterSubc) return false;
      if (filterAvance === 'con_avance' && node.cantAcum <= 0) return false;
      if (filterAvance === 'sin_avance' && node.cantAcum > 0) return false;
      if (filterAvance === 'saldo_pendiente' && node.saldoEcon <= 0) return false;

      if (isIdOrigActive) {
        const idOrigVal = node.idOrig || node.itemRef?.idOrig || '';
        if (!evaluateHierarchyTextFilter(idOrigVal, columnFilters?.idOrigFilter)) return false;
      }

      if (isActivityIdActive) {
        const actIdVal = node.activityId || node.itemRef?.activityId || '';
        if (!evaluateHierarchyTextFilter(actIdVal, columnFilters?.activityIdFilter)) return false;
      }

      return true;
    };

    // Recursive traversal to collect matches
    const checkMatching = (nodeKey: string, parentMatchedSearch: boolean): boolean => {
      const node = nodeMap.get(nodeKey);
      if (!node) return false;

      // Does this current node itself match the search query?
      const thisNodeMatchesSearch = normalizedSearch ? nodeMatchesSearchQuery(node, normalizedSearch) : false;
      const searchIsSatisfied = !normalizedSearch || parentMatchedSearch || thisNodeMatchesSearch;

      if (node.esHoja) {
        const matchesFilters = leafMatchesNonSearchFilters(node);
        const matches = matchesFilters && searchIsSatisfied;
        if (matches) {
          matchingNodeKeys.add(nodeKey);
        }
        return matches;
      }

      // If it's a parent node, check if any children match
      let hasMatchInBranch = false;
      node.directChildrenKeys.forEach(chKey => {
        if (checkMatching(chKey, searchIsSatisfied)) {
          hasMatchInBranch = true;
        }
      });

      if (hasMatchInBranch) {
        matchingNodeKeys.add(nodeKey);
      }
      return hasMatchInBranch;
    };

    rootKeys.forEach(rKey => checkMatching(rKey, false));
  }

  // Recursive traversal respecting expanded state
  const traverse = (nodeKey: string) => {
    const node = nodeMap.get(nodeKey);
    if (!node) return;

    if (isFilterActive && !matchingNodeKeys.has(nodeKey)) {
      return;
    }

    visibleList.push(node);

    // If node is a parent: when filter is active, expand all branches that contain matches!
    const isExpanded = isFilterActive || expandedKeys.has(nodeKey);
    if (!node.esHoja && isExpanded) {
      // Sort children: headers first, then leaves by WBS / description
      const children = node.directChildrenKeys
        .map(k => nodeMap.get(k))
        .filter((n): n is MasterHierarchyNode => !!n);

      children.sort((a, b) => {
        if (!a.esHoja && b.esHoja) return -1;
        if (a.esHoja && !b.esHoja) return 1;
        if (a.wbs && b.wbs) {
          return compareWbs(a.wbs, b.wbs);
        }
        return (a.descripcion || '').localeCompare(b.descripcion || '');
      });

      children.forEach(ch => traverse(ch.key));
    }
  };

  rootKeys.forEach(rKey => traverse(rKey));
  return visibleList;
}

/**
 * Returns all matching leaf nodes in the tree across the entire dataset,
 * independent of whether nodes are currently expanded or collapsed.
 */
export function getMatchingLeafNodes(
  nodeMap: Map<string, MasterHierarchyNode>,
  rootKeys: string[],
  filterSubc: string = 'all',
  filterAvance: 'all' | 'con_avance' | 'sin_avance' | 'saldo_pendiente' = 'all',
  searchTerm: string = '',
  columnFilters?: {
    idOrigFilter?: HierarchyTextFilter;
    activityIdFilter?: HierarchyTextFilter;
  }
): MasterHierarchyNode[] {
  const allLeafNodes = Array.from(nodeMap.values()).filter(n => n.esHoja);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  
  const isIdOrigActive = Boolean(columnFilters?.idOrigFilter?.active && (columnFilters.idOrigFilter.val1 || columnFilters.idOrigFilter.val2));
  const isActivityIdActive = Boolean(columnFilters?.activityIdFilter?.active && (columnFilters.activityIdFilter.val1 || columnFilters.activityIdFilter.val2));

  const isFilterActive = 
    filterSubc !== 'all' || 
    filterAvance !== 'all' || 
    normalizedSearch !== '' ||
    isIdOrigActive ||
    isActivityIdActive;

  if (!isFilterActive) return allLeafNodes;

  // Build a map of nodeKey -> parentKey to check if any ancestor matched the search
  const parentKeyMap = new Map<string, string | null>();
  nodeMap.forEach((node, key) => {
    parentKeyMap.set(key, node.parentKey);
  });

  const nodeSearchCache = new Map<string, boolean>();
  const doesNodeOrAncestorMatchSearch = (nodeKey: string): boolean => {
    if (!normalizedSearch) return true;
    if (nodeSearchCache.has(nodeKey)) return nodeSearchCache.get(nodeKey)!;

    const node = nodeMap.get(nodeKey);
    if (!node) return false;

    if (nodeMatchesSearchQuery(node, normalizedSearch)) {
      nodeSearchCache.set(nodeKey, true);
      return true;
    }

    if (node.parentKey) {
      const parentMatches = doesNodeOrAncestorMatchSearch(node.parentKey);
      nodeSearchCache.set(nodeKey, parentMatches);
      return parentMatches;
    }

    nodeSearchCache.set(nodeKey, false);
    return false;
  };

  return allLeafNodes.filter(node => {
    if (filterSubc !== 'all' && node.subcontratista !== filterSubc) return false;
    if (filterAvance === 'con_avance' && node.cantAcum <= 0) return false;
    if (filterAvance === 'sin_avance' && node.cantAcum > 0) return false;
    if (filterAvance === 'saldo_pendiente' && node.saldoEcon <= 0) return false;

    if (isIdOrigActive) {
      const idOrigVal = node.idOrig || node.itemRef?.idOrig || '';
      if (!evaluateHierarchyTextFilter(idOrigVal, columnFilters?.idOrigFilter)) return false;
    }

    if (isActivityIdActive) {
      const actIdVal = node.activityId || node.itemRef?.activityId || '';
      if (!evaluateHierarchyTextFilter(actIdVal, columnFilters?.activityIdFilter)) return false;
    }

    if (normalizedSearch) {
      if (!doesNodeOrAncestorMatchSearch(node.key)) return false;
    }

    return true;
  });
}

export interface MasterTableSummaryTotals {
  count: number;
  totalCantPresupuesto: number;
  totalVentaPresupuesto: number;
  totalCantAcumulada: number;
  totalAvanceEconomico: number;
  totalSaldoEconomico: number;
  pctAvanceEconomico: number;
  weeklyEconomicTotals: Record<string, number>;
  weeklyQtyTotals: Record<string, number>;
}

/**
 * Calculates aggregated master table summary totals for leaf items/nodes,
 * including total Venta ($), total Avance Económico ($), and weekly economic & quantity totals.
 */
export function calculateMasterTableSummary(
  leafNodes: MasterHierarchyNode[],
  semanas: MasterCdoWeek[],
  fallbackItems?: MasterCdoItem[]
): MasterTableSummaryTotals {
  let totalCantPresupuesto = 0;
  let totalVentaPresupuesto = 0;
  let totalCantAcumulada = 0;
  let totalAvanceEconomico = 0;
  let totalSaldoEconomico = 0;
  const weeklyEconomicTotals: Record<string, number> = {};
  const weeklyQtyTotals: Record<string, number> = {};

  semanas.forEach(s => {
    weeklyEconomicTotals[s.id] = 0;
    weeklyQtyTotals[s.id] = 0;
  });

  if (leafNodes && leafNodes.length > 0) {
    leafNodes.forEach(node => {
      totalCantPresupuesto += Number(node.cantidadPresupuesto) || 0;
      totalVentaPresupuesto += Number(node.venta) || 0;
      totalCantAcumulada += Number(node.cantAcum) || 0;
      totalAvanceEconomico += Number(node.avanceEcon) || 0;
      totalSaldoEconomico += Number(node.saldoEcon) || 0;

      semanas.forEach(s => {
        const wEcon = Number(node.avanceEconSemanales?.[s.id]) || 0;
        const wQty = Number(node.cantidadesSemanales?.[s.id]) || 0;
        weeklyEconomicTotals[s.id] = (weeklyEconomicTotals[s.id] || 0) + wEcon;
        weeklyQtyTotals[s.id] = (weeklyQtyTotals[s.id] || 0) + wQty;
      });
    });
  } else if (fallbackItems && fallbackItems.length > 0) {
    fallbackItems.forEach(item => {
      const cantPres = Number(item.cantidadPresupuesto) || 0;
      const precio = Number(item.precio) || 0;
      const step = stepDeFila(item.step);
      const venta = ventaDeFila(item);

      totalCantPresupuesto += cantPres;
      totalVentaPresupuesto += venta;

      let itemCantAcum = Object.values(item.cantidadesSemanales || {}).reduce((s: number, val: any) => s + (Number(val) || 0), 0) as number;
      let itemAvanceEcon = Object.values(item.ventasSemanales || {}).reduce((s: number, val: any) => s + (Number(val) || 0), 0) as number;

      semanas.forEach(s => {
        const q = Number(item.cantidadesSemanales?.[s.id]) || 0;
        let v = (item.ventasSemanales && typeof item.ventasSemanales[s.id] === 'number')
          ? item.ventasSemanales[s.id]
          : 0;

        weeklyEconomicTotals[s.id] = (weeklyEconomicTotals[s.id] || 0) + v;
        weeklyQtyTotals[s.id] = (weeklyQtyTotals[s.id] || 0) + q;
      });

      totalCantAcumulada += itemCantAcum;
      totalAvanceEconomico += itemAvanceEcon;
      totalSaldoEconomico += Math.max(0, venta - itemAvanceEcon);
    });
  }

  const pctAvanceEconomico = totalVentaPresupuesto > 0
    ? (totalAvanceEconomico / totalVentaPresupuesto) * 100
    : 0;

  return {
    count: leafNodes && leafNodes.length > 0 ? leafNodes.length : (fallbackItems?.length || 0),
    totalCantPresupuesto,
    totalVentaPresupuesto,
    totalCantAcumulada,
    totalAvanceEconomico,
    totalSaldoEconomico,
    pctAvanceEconomico: Number(pctAvanceEconomico.toFixed(2)),
    weeklyEconomicTotals,
    weeklyQtyTotals
  };
}
