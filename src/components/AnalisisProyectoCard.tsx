/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Actividad } from '../types';
import { GraficoCantidadesProgramadasScap } from './GraficoCantidadesProgramadasScap';
import { 
  Layers, 
  Calendar, 
  ChevronDown, 
  ChevronRight, 
  ChevronLeft, 
  Search, 
  Filter, 
  Check, 
  Copy, 
  ChevronsUpDown, 
  ChevronsDownUp, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Package, 
  RotateCcw, 
  Building2, 
  ListFilter, 
  CheckCircle, 
  ExternalLink, 
  Wrench, 
  FolderKanban, 
  MapPin, 
  Workflow,
  ShoppingCart,
  Truck,
  HardHat,
  BarChart3
} from 'lucide-react';

interface AnalisisProyectoCardProps {
  actividades: Actividad[];
  dataPlanificadoPG004?: any;
  baseVenta?: string;
  fechaCorte?: Date;
  defaultCollapsed?: boolean;
}

interface WeekInterval {
  weekNum: number;
  label: string;
  start: Date;
  end: Date;
  dateKey?: string;
}

interface ActivityExecutionDetail {
  id: string;
  wbs: string;
  activityId: string | null;
  descripcion: string;
  unidad?: string;
  cantidad?: number | null;
  precio?: number | null;
  step?: number | null;
  planificadoPorFechaPG004?: Record<string, number>;
  blStart: Date | null;
  blFinish: Date | null;
  start: Date | null;
  finish: Date | null;
  floatDays: number | null;
  status: string;
  subcontratista?: string;
  resp?: string;
  inWeeks: boolean[]; // [w1, w2, w3, w4]
  venta?: number;
  ubicacion?: string;
  proceso?: string;
  componente?: string;
}

interface ScapPackageGroup {
  scapName: string;
  capName: string;
  componente: string;
  proceso: string;
  activitiesCount: number;
  activities: ActivityExecutionDetail[];
  minDate: Date | null;
  maxDate: Date | null;
  earliestFinish?: Date | null;
  inWeeks: boolean[]; // [w1, w2, w3, w4]
  subcontratistas: string[];
  ubicaciones: string[];
  statusSummary: {
    enEjecucion: number;
    porIniciar: number;
    completadas: number;
    conAtraso: number;
  };
  totalVenta: number;
}

export const TARGET_UBICACIONES = ['Merinos', 'Progreso', 'Guayacanes'];

/**
 * Normaliza el campo de ubicación priorizando Merinos, Progreso, Guayacanes,
 * con coincidencia flexible por subcadena y fallback en WBS o descripción.
 */
export function normalizeUbicacion(
  rawUbicacion?: string | null,
  wbs?: string | null,
  descripcion?: string | null
): string {
  const u = (rawUbicacion || '').trim();
  if (u) {
    const uLower = u.toLowerCase();
    if (uLower.includes('merino')) return 'Merinos';
    if (uLower.includes('progreso')) return 'Progreso';
    if (uLower.includes('guayacan')) return 'Guayacanes';
    return u.charAt(0).toUpperCase() + u.slice(1);
  }
  const w = (wbs || '').toLowerCase();
  const d = (descripcion || '').toLowerCase();
  if (w.includes('merino') || d.includes('merino')) return 'Merinos';
  if (w.includes('progreso') || d.includes('progreso')) return 'Progreso';
  if (w.includes('guayacan') || d.includes('guayacan')) return 'Guayacanes';
  return '';
}

/**
 * Determina si una actividad tiene estado P6 'In Progress' o 'Not Started'.
 * Excluye actividades con estado 'Completed' o terminadas/finalizadas.
 */
export function isP6InProgressOrNotStarted(a: Actividad | any): boolean {
  if (!a) return false;
  const rawStatus = (
    a.p6Status ??
    a.p6 ??
    a.estadoP6 ??
    a.estado_p6 ??
    a.status ??
    ''
  ).toString().trim();

  const s = rawStatus
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  // Excluir actividades completadas / finalizadas / terminadas / cerradas
  if (
    s === 'completed' ||
    s.includes('complet') ||
    s.includes('finaliz') ||
    s.includes('terminad') ||
    s.includes('cerrad')
  ) {
    return false;
  }

  // Aceptar In Progress / En Curso / En Progreso / En Ejecución
  if (
    s === 'in progress' ||
    s.includes('progress') ||
    s.includes('progres') ||
    s.includes('curso') ||
    s.includes('ejecu')
  ) {
    return true;
  }

  // Aceptar Not Started / No Iniciada / No Iniciado / Programada
  if (
    s === 'not started' ||
    s.includes('not start') ||
    s.includes('no inic') ||
    s.includes('no-inic') ||
    s === 'programada' ||
    s === 'programado'
  ) {
    return true;
  }

  // Si tiene avance físico registrado al 100%, considerarla completada
  if (a.avanceAT === 100) {
    return false;
  }

  // Si no tiene status definido explícitamente, en P6 por defecto es Not Started
  if (!s || s === '—' || s === '-') {
    return true;
  }

  return false;
}

interface CapGroup {
  capName: string;
  componente: string;
  proceso?: string;
  packages: ScapPackageGroup[];
  totalActivitiesCount: number;
  inWeeks: boolean[]; // [w1, w2, w3, w4]
  subcontratistas: string[];
  statusSummary: {
    enEjecucion: number;
    porIniciar: number;
    completadas: number;
    conAtraso: number;
  };
  totalVenta: number;
  minDate: Date | null;
  maxDate: Date | null;
}

interface ComponenteGroup {
  componente: string;
  caps: CapGroup[];
  totalPackagesCount: number;
  totalActivitiesCount: number;
  inWeeks: boolean[];
  totalVenta: number;
}

interface ProcesoGroup {
  proceso: string;
  caps: CapGroup[];
  totalPackagesCount: number;
  totalActivitiesCount: number;
  inWeeks: boolean[];
  totalVenta: number;
}

interface ComponenteProcesoGroup {
  componente: string;
  procesos: ProcesoGroup[];
  totalPackagesCount: number;
  totalActivitiesCount: number;
  inWeeks: boolean[];
  totalVenta: number;
}

type HierarchyMode = 'componente' | 'proceso' | 'componente_proceso';

function parseToDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return new Date(val.getFullYear(), val.getMonth(), val.getDate(), 12, 0, 0);
  }
  if (typeof val === 'string') {
    const clean = val.trim();
    const parts = clean.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return new Date(y, m, d, 12, 0, 0);
      }
    }
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
    }
  }
  if (typeof val === 'number') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
    }
  }
  return null;
}

function formatDateShort(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const m = months[d.getMonth()];
  const y = String(d.getFullYear()).slice(-2);
  return `${day}-${m}-${y}`;
}

function formatDateDayMonth(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${day} ${months[d.getMonth()]}`;
}

/**
 * Calcula la previsión económica planificada en PG-004 y la Cantidad de Obra Programada
 * dividiendo la previsión económica entre el precio (columna G de la pestaña CDO) y entre el Step (columna H de la pestaña CDO).
 * Considera las semanas en las que se desarrolla la actividad según el filtro o la ventana de 4 semanas.
 */
function getCantObraProgramadaInfo(
  act: ActivityExecutionDetail,
  fourWeeks: WeekInterval[],
  selectedWeekFilter: number | 'all'
): {
  cantObraProg: number | null;
  valorEconomico: number;
  precio: number | null;
  step: number | null;
  semanasActivasLabels: string[];
} {
  const precio = (act.precio && typeof act.precio === 'number' && act.precio > 0)
    ? act.precio
    : ((act.venta && act.cantidad && act.cantidad > 0) ? (act.venta / act.cantidad) : null);

  const step = (act.step !== undefined && act.step !== null && typeof act.step === 'number' && !isNaN(act.step) && act.step !== 0)
    ? act.step
    : null;

  const planDict = act.planificadoPorFechaPG004;
  const semanasActivasLabels: string[] = [];
  let valorEconomico = 0;

  // Determinar qué semanas aplican
  const targetWeeks: { week: WeekInterval; idx: number }[] = [];
  fourWeeks.forEach((w, idx) => {
    if (selectedWeekFilter !== 'all') {
      if (w.weekNum === selectedWeekFilter) {
        targetWeeks.push({ week: w, idx });
      }
    } else {
      if (act.inWeeks && act.inWeeks[idx]) {
        targetWeeks.push({ week: w, idx });
      }
    }
  });

  targetWeeks.forEach(({ week }) => {
    semanasActivasLabels.push(`S${week.weekNum}`);
  });

  if (planDict && Object.keys(planDict).length > 0) {
    const countedKeys = new Set<string>();

    targetWeeks.forEach(({ week }) => {
      let weekVal = 0;

      // 1. Coincidencia directa por dateKey
      if (week.dateKey && planDict[week.dateKey] !== undefined) {
        weekVal += Number(planDict[week.dateKey]) || 0;
        countedKeys.add(week.dateKey);
      }

      // 2. Coincidencia por rango de fechas de la semana [week.start, week.end]
      Object.entries(planDict).forEach(([k, val]) => {
        if (k === 'total' || countedKeys.has(k)) return;
        const num = Number(val) || 0;
        if (num === 0) return;
        const d = parseToDate(k);
        if (d && d >= week.start && d <= week.end) {
          weekVal += num;
          countedKeys.add(k);
        }
      });

      valorEconomico += weekVal;
    });

    // Fallback: si planDict solo tiene 'total' (formato dos columnas PG-004)
    if (valorEconomico === 0 && planDict['total'] && targetWeeks.length > 0) {
      const totalVal = Number(planDict['total']) || 0;
      if (totalVal > 0) {
        valorEconomico = totalVal;
      }
    }

    // Fallback secundario: si hay fechas en planDict pero ninguna cayó exactamente en las semanas
    // pero la actividad se desarrolla dentro del rango de las semanas evaluadas
    if (valorEconomico === 0 && targetWeeks.length > 0) {
      const minTargetDate = targetWeeks[0].week.start;
      const maxTargetDate = targetWeeks[targetWeeks.length - 1].week.end;
      Object.entries(planDict).forEach(([k, val]) => {
        if (k === 'total') return;
        const num = Number(val) || 0;
        if (num === 0) return;
        const d = parseToDate(k);
        if (d && d >= minTargetDate && d <= maxTargetDate) {
          valorEconomico += num;
        }
      });
    }
  }

  let cantObraProg = (precio && precio > 0 && valorEconomico > 0)
    ? (valorEconomico / precio)
    : (precio && precio > 0 && valorEconomico === 0 ? 0 : null);

  if (cantObraProg !== null && step !== null && step !== 0) {
    cantObraProg = cantObraProg / step;
  }

  return {
    cantObraProg,
    valorEconomico,
    precio,
    step,
    semanasActivasLabels
  };
}

// Helper to determine the latest finish date for a CAP from its SCAPs (or cap.maxDate)
function getCapFinishTime(cap: CapGroup): number {
  let lateF: number | null = null;
  cap.packages.forEach(p => {
    if (p.maxDate) {
      const t = p.maxDate.getTime();
      if (lateF === null || t > lateF) {
        lateF = t;
      }
    }
  });
  if (lateF === null && cap.maxDate) {
    lateF = cap.maxDate.getTime();
  }
  return lateF !== null ? lateF : Infinity;
}

// Helper to determine the earliest start date for a CAP from its SCAPs (or cap.minDate)
function getCapStartTime(cap: CapGroup): number {
  let earlyS: number | null = null;
  cap.packages.forEach(p => {
    if (p.minDate) {
      const t = p.minDate.getTime();
      if (earlyS === null || t < earlyS) {
        earlyS = t;
      }
    }
  });
  if (earlyS === null && cap.minDate) {
    earlyS = cap.minDate.getTime();
  }
  return earlyS !== null ? earlyS : Infinity;
}

// Comparator to sort CAPs by completion/termination date: earliest finish first
function sortCapsByFinish(a: CapGroup, b: CapGroup): number {
  const finishA = getCapFinishTime(a);
  const finishB = getCapFinishTime(b);
  if (finishA !== finishB) {
    return finishA - finishB; // Earliest finish date first
  }

  const startA = getCapStartTime(a);
  const startB = getCapStartTime(b);
  if (startA !== startB) {
    return startA - startB; // Earliest start date first
  }

  // Fallback: numerical prefix or alphabetical
  const matchA = a.capName.match(/^(\d+)\./);
  const matchB = b.capName.match(/^(\d+)\./);
  if (matchA && matchB) {
    return parseInt(matchA[1], 10) - parseInt(matchB[1], 10);
  }
  return a.capName.localeCompare(b.capName);
}

export const AnalisisProyectoCard: React.FC<AnalisisProyectoCardProps> = ({
  actividades,
  dataPlanificadoPG004,
  baseVenta = 'venta',
  fechaCorte,
  defaultCollapsed = true,
}) => {
  // Card collapsible state (default collapsed)
  const [isCardCollapsed, setIsCardCollapsed] = useState<boolean>(defaultCollapsed);

  // Hierarchy Mode: 'componente' | 'proceso' | 'componente_proceso' (default: 'componente_proceso')
  const [hierarchyMode, setHierarchyMode] = useState<HierarchyMode>('componente_proceso');

  // Date mode: Línea Base (bl) vs Forecast / Actual
  const [dateMode, setDateMode] = useState<'bl' | 'actual'>('bl');

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedUbicacionFilter, setSelectedUbicacionFilter] = useState<string>('all');
  const [selectedComponentFilter, setSelectedComponentFilter] = useState<string>('all');
  const [selectedProcesoFilter, setSelectedProcesoFilter] = useState<string>('all');
  const [selectedCapFilter, setSelectedCapFilter] = useState<string>('all');
  const [selectedScapFilter, setSelectedScapFilter] = useState<string>('all');
  const [selectedWeekFilter, setSelectedWeekFilter] = useState<number | 'all'>('all');
  const [isMontajeFilter, setIsMontajeFilter] = useState<boolean>(false);
  const [isProcuraFilter, setIsProcuraFilter] = useState<boolean>(false);
  const [isFleteFilter, setIsFleteFilter] = useState<boolean>(false);
  const [isConstruccionFilter, setIsConstruccionFilter] = useState<boolean>(false);
  const [copiedTsv, setCopiedTsv] = useState<boolean>(false);

  // Accordion state: Expanded components, expanded procesos, expanded CAPs and expanded SCAPs
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const [expandedProcesos, setExpandedProcesos] = useState<Set<string>>(new Set());
  const [expandedCaps, setExpandedCaps] = useState<Set<string>>(new Set());
  const [expandedScaps, setExpandedScaps] = useState<Set<string>>(new Set());

  // Actividades filtradas por estado P6 (solamente In Progress o Not Started)
  const filteredP6Actividades = useMemo(() => {
    if (!actividades || actividades.length === 0) return [];
    return actividades.filter(a => !a.esItemHoja || isP6InProgressOrNotStarted(a));
  }, [actividades]);

  // Available Ubicaciones for dropdown (Merinos, Progreso, Guayacanes)
  const availableUbicaciones = useMemo(() => {
    const ubicacionesFound = new Set<string>();
    (actividades || []).forEach(a => {
      if (!a.esItemHoja) return;
      if (!isP6InProgressOrNotStarted(a)) return;
      const ub = normalizeUbicacion(a.ubicacion, a.wbs, a.descripcion);
      if (ub) {
        ubicacionesFound.add(ub);
      }
    });

    const ordered: string[] = [];
    TARGET_UBICACIONES.forEach(u => ordered.push(u));

    Array.from(ubicacionesFound).sort().forEach(u => {
      if (!ordered.includes(u)) {
        ordered.push(u);
      }
    });

    return ordered;
  }, [actividades]);

  // Derive P6 Cut Date from GANTT field
  const p6Date = useMemo(() => parseToDate(fechaCorte), [fechaCorte]);

  const p6MonthKey = useMemo(() => {
    if (!p6Date) return null;
    const yr = p6Date.getFullYear();
    const m = String(p6Date.getMonth() + 1).padStart(2, '0');
    return `${yr}-${m}`;
  }, [p6Date]);

  // 1. Detect all available Year-Months from schedule activities
  const availableMonths = useMemo(() => {
    if (!actividades || actividades.length === 0) return [];
    const ymSet = new Set<string>();

    actividades.forEach(a => {
      if (!a.esItemHoja) return;
      if (!isP6InProgressOrNotStarted(a)) return;
      const d1 = parseToDate(a.blStart);
      const d2 = parseToDate(a.blFinish);
      const d3 = parseToDate(a.start);
      const d4 = parseToDate(a.finish);

      [d1, d2, d3, d4].forEach(d => {
        if (d) {
          const yr = d.getFullYear();
          if (yr >= 2022 && yr <= 2030) {
            const m = String(d.getMonth() + 1).padStart(2, '0');
            ymSet.add(`${yr}-${m}`);
          }
        }
      });
    });

    if (p6MonthKey) {
      ymSet.add(p6MonthKey);
    }

    const sorted = Array.from(ymSet).sort();
    return sorted.map(ym => {
      const [yearStr, monthStr] = ym.split('-');
      const monthIdx = parseInt(monthStr, 10) - 1;
      const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ];
      return {
        key: ym,
        year: parseInt(yearStr, 10),
        monthIdx,
        label: `${monthNames[monthIdx]} ${yearStr}`
      };
    });
  }, [actividades, p6MonthKey]);

  // Selected Month State - Driven by P6 cut date from GANTT, fallback to '2026-09'
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => {
    if (p6MonthKey) return p6MonthKey;
    return '2026-09';
  });

  // Keep selectedMonthKey synchronized with P6 cut date changes from GANTT
  React.useEffect(() => {
    if (p6MonthKey) {
      setSelectedMonthKey(p6MonthKey);
    }
  }, [p6MonthKey]);

  // Ensure selectedMonthKey is valid
  React.useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.some(m => m.key === selectedMonthKey)) {
      if (p6MonthKey && availableMonths.some(m => m.key === p6MonthKey)) {
        setSelectedMonthKey(p6MonthKey);
      } else {
        const sep2026 = availableMonths.find(m => m.key === '2026-09');
        if (sep2026) {
          setSelectedMonthKey('2026-09');
        } else {
          setSelectedMonthKey(availableMonths[0].key);
        }
      }
    }
  }, [availableMonths, selectedMonthKey, p6MonthKey]);

  const [startDayOffset, setStartDayOffset] = useState<number>(1);

  // 2. Compute the 4 weeks interval based on selected month & P6 cut date
  const fourWeeks: WeekInterval[] = useMemo(() => {
    if (!selectedMonthKey) {
      const now = new Date();
      return [0, 1, 2, 3].map(i => {
        const s = new Date(now.getFullYear(), now.getMonth(), 1 + i * 7, 0, 0, 0);
        const e = new Date(now.getFullYear(), now.getMonth(), 7 + i * 7, 23, 59, 59);
        return {
          weekNum: i + 1,
          label: `Semana ${i + 1}`,
          start: s,
          end: e
        };
      });
    }

    const [yearStr, monthStr] = selectedMonthKey.split('-');
    const year = parseInt(yearStr, 10);
    const monthIdx = parseInt(monthStr, 10) - 1;

    const startDay = (p6MonthKey === selectedMonthKey && p6Date)
      ? p6Date.getDate()
      : startDayOffset;

    const weeks: WeekInterval[] = [];
    const baseStartDate = new Date(year, monthIdx, startDay, 0, 0, 0);

    for (let i = 0; i < 4; i++) {
      const wStart = new Date(baseStartDate.getTime() + i * 7 * 24 * 60 * 60 * 1000);
      wStart.setHours(0, 0, 0, 0);
      const wEnd = new Date(wStart.getTime() + 6 * 24 * 60 * 60 * 1000);
      wEnd.setHours(23, 59, 59, 999);

      weeks.push({
        weekNum: i + 1,
        label: `Semana ${i + 1}`,
        start: wStart,
        end: wEnd,
        dateKey: `${wEnd.getFullYear()}-${String(wEnd.getMonth() + 1).padStart(2, '0')}-${String(wEnd.getDate()).padStart(2, '0')}`
      });
    }

    return weeks;
  }, [selectedMonthKey, p6MonthKey, p6Date, startDayOffset]);

  const windowStartDate = fourWeeks[0]?.start || new Date();
  const windowEndDate = fourWeeks[3]?.end || new Date();

  // Navigation handlers for prev / next 4 weeks
  const handlePrevPeriod = () => {
    const currentIdx = availableMonths.findIndex(m => m.key === selectedMonthKey);
    if (currentIdx > 0) {
      setSelectedMonthKey(availableMonths[currentIdx - 1].key);
    } else {
      const [y, m] = selectedMonthKey.split('-').map(Number);
      const prevDate = new Date(y, m - 2, 1);
      const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      setSelectedMonthKey(prevKey);
    }
  };

  const handleNextPeriod = () => {
    const currentIdx = availableMonths.findIndex(m => m.key === selectedMonthKey);
    if (currentIdx >= 0 && currentIdx < availableMonths.length - 1) {
      setSelectedMonthKey(availableMonths[currentIdx + 1].key);
    } else {
      const [y, m] = selectedMonthKey.split('-').map(Number);
      const nextDate = new Date(y, m, 1);
      const nextKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
      setSelectedMonthKey(nextKey);
    }
  };

  const handleResetToP6 = () => {
    if (p6MonthKey) {
      setSelectedMonthKey(p6MonthKey);
    } else {
      setSelectedMonthKey('2026-09');
    }
    setStartDayOffset(1);
    setSelectedUbicacionFilter('all');
    setSelectedComponentFilter('all');
    setSelectedProcesoFilter('all');
    setSelectedCapFilter('all');
    setSelectedScapFilter('all');
    setSelectedWeekFilter('all');
    setIsMontajeFilter(false);
    setIsProcuraFilter(false);
    setIsFleteFilter(false);
    setSearchQuery('');
    setExpandedComponents(new Set());
    setExpandedProcesos(new Set());
    setExpandedCaps(new Set());
    setExpandedScaps(new Set());
  };

  // 3. Process Activities & Build Hierarchies (Componente, Proceso [columna AF], and Comp + Proceso)
  const {
    groupedComponents,
    groupedProcesos,
    groupedCompProcesos,
    allComponentNames,
    allProcesoNames,
    allCapNames,
    allScapNames,
    totalScheduledActivities,
    totalScapPackages,
    totalActiveCaps,
    totalActiveProcesos,
    totalActiveComponents,
    packagesPerWeek
  } = useMemo(() => {
    if (!actividades || actividades.length === 0) {
      return {
        groupedComponents: [],
        groupedProcesos: [],
        groupedCompProcesos: [],
        allComponentNames: [],
        allProcesoNames: [],
        allCapNames: [],
        allScapNames: [],
        totalScheduledActivities: 0,
        totalScapPackages: 0,
        totalActiveCaps: 0,
        totalActiveProcesos: 0,
        totalActiveComponents: 0,
        packagesPerWeek: [0, 0, 0, 0]
      };
    }

    const leafItems = actividades.filter(a => a.esItemHoja && isP6InProgressOrNotStarted(a));

    // Maps for hierarchical groupings
    // 1. Componente -> CAP -> SCAP -> Activities
    const compMap = new Map<string, Map<string, Map<string, ActivityExecutionDetail[]>>>();
    // 2. Proceso (Columna AF) -> CAP -> SCAP -> Activities
    const procesoMap = new Map<string, Map<string, Map<string, ActivityExecutionDetail[]>>>();
    // 3. Componente -> Proceso -> CAP -> SCAP -> Activities
    const compProcesoMap = new Map<string, Map<string, Map<string, Map<string, ActivityExecutionDetail[]>>>>();

    const allComponentsSet = new Set<string>();
    const allProcesosSet = new Set<string>();
    const allCapsSet = new Set<string>();
    const allScapsSet = new Set<string>();

    leafItems.forEach(a => {
      // Ubicación filter: Merinos / Progreso / Guayacanes
      const actUbicacion = normalizeUbicacion(a.ubicacion, a.wbs, a.descripcion);
      if (selectedUbicacionFilter !== 'all') {
        if (actUbicacion !== selectedUbicacionFilter) return;
      }

      // Type Filters: Montaje (Inst*), Procura (Compr*), Flete (Flete*), Construcción (demás partidas)
      if (isMontajeFilter || isProcuraFilter || isFleteFilter || isConstruccionFilter) {
        const cleanName = (a.descripcion || (a as any).activityName || '').trim().replace(/^["'«\s\-\.]*/, '');
        const isM = /^inst/i.test(cleanName);
        const isP = /^compr/i.test(cleanName);
        const isF = /^flete/i.test(cleanName);
        const isC = !isM && !isP && !isF;

        const matchesMontaje = isMontajeFilter && isM;
        const matchesProcura = isProcuraFilter && isP;
        const matchesFlete = isFleteFilter && isF;
        const matchesConstruccion = isConstruccionFilter && isC;

        if (!matchesMontaje && !matchesProcura && !matchesFlete && !matchesConstruccion) return;
      }

      // Dates check
      const blStart = parseToDate(a.blStart);
      const blFinish = parseToDate(a.blFinish);
      const actualStart = parseToDate(a.start);
      const actualFinish = parseToDate(a.finish);

      const targetStart = dateMode === 'bl' 
        ? (blStart || actualStart)
        : (actualStart || blStart);

      const targetFinish = dateMode === 'bl'
        ? (blFinish || actualFinish)
        : (actualFinish || blFinish);

      if (!targetStart || !targetFinish) return;

      // Check if intersects with 4-week window [windowStartDate, windowEndDate]
      const overlapsWindow = targetStart <= windowEndDate && targetFinish >= windowStartDate;
      if (!overlapsWindow) return;

      // Previsión económica planificada PG-004
      let actPlanPG004: Record<string, number> | undefined = a.planificadoPorFechaPG004;
      if (!actPlanPG004 && dataPlanificadoPG004 && a.activityId) {
        const actIdClean = String(a.activityId).trim();
        const actIdUpper = actIdClean.toUpperCase();
        if (dataPlanificadoPG004[actIdClean]) {
          actPlanPG004 = dataPlanificadoPG004[actIdClean];
        } else if (dataPlanificadoPG004[actIdUpper]) {
          actPlanPG004 = dataPlanificadoPG004[actIdUpper];
        } else {
          const foundKey = Object.keys(dataPlanificadoPG004).find(k => k.trim().toUpperCase() === actIdUpper);
          if (foundKey) {
            actPlanPG004 = dataPlanificadoPG004[foundKey];
          }
        }
      }

      // Check intersection with each of the 4 individual weeks
      const inWeeks = fourWeeks.map(w => {
        const dateOverlap = targetStart <= w.end && targetFinish >= w.start;
        let planValue = 0;
        if (actPlanPG004) {
          if (w.dateKey && actPlanPG004[w.dateKey]) {
            planValue = Number(actPlanPG004[w.dateKey]) || 0;
          }
          if (planValue === 0) {
            Object.entries(actPlanPG004).forEach(([k, val]) => {
              if (k === 'total') return;
              const d = parseToDate(k);
              if (d && d >= w.start && d <= w.end) {
                planValue += Number(val) || 0;
              }
            });
          }
        }
        return dateOverlap || planValue > 0;
      });

      if (!inWeeks.some(Boolean)) return;

      // Componente (Columna AN)
      const rawComp = String(a.componente || '').trim();
      const compName = rawComp || '(Sin Componente)';
      allComponentsSet.add(compName);

      // Proceso (Columna AF del master)
      const rawProceso = String(a.proceso || (a as any).procesoAgregado?.proceso || '').trim();
      const procesoName = rawProceso || '(Sin Proceso)';
      allProcesosSet.add(procesoName);

      // CAP (Columna AI / Capítulo)
      const rawCap = String(a.cap || '').trim();
      const capName = rawCap || '(Sin CAP)';
      allCapsSet.add(capName);

      // SCAP (Columna AJ / Sub-Capítulo)
      const rawScap = String(a.scap || '').trim();
      const scapName = rawScap || '(Sin SCAP)';
      allScapsSet.add(scapName);

      // Precio de la columna G de la pestaña CDO (con fallback si venta y cantidad están presentes)
      const rawPrecio = (a as any).precio !== undefined && (a as any).precio !== null && !isNaN((a as any).precio)
        ? (a as any).precio
        : ((a as any).precioCdo !== undefined && (a as any).precioCdo !== null && !isNaN((a as any).precioCdo)
          ? (a as any).precioCdo
          : null);

      let actPrecio: number | null = rawPrecio;
      if ((actPrecio === null || actPrecio === 0) && a.venta && a.cantidadCdo && a.cantidadCdo > 0) {
        actPrecio = a.venta / a.cantidadCdo;
      }

      // Step de la columna H de la pestaña CDO
      const rawStep = (a as any).step !== undefined && (a as any).step !== null && !isNaN((a as any).step)
        ? (a as any).step
        : null;

      const actDetail: ActivityExecutionDetail = {
        id: a.id,
        wbs: a.wbs,
        activityId: a.activityId,
        descripcion: a.descripcion || 'Sin descripción',
        unidad: String(a.unidad ?? a.unit ?? (a as any).unitAgregado ?? '').trim(),
        cantidad: (a.cantidadCdo !== undefined && a.cantidadCdo !== null && !isNaN(a.cantidadCdo))
          ? a.cantidadCdo
          : (typeof (a as any).cantidad === 'number' && !isNaN((a as any).cantidad) ? (a as any).cantidad : null),
        precio: actPrecio,
        step: rawStep,
        planificadoPorFechaPG004: actPlanPG004,
        blStart,
        blFinish,
        start: actualStart,
        finish: actualFinish,
        floatDays: typeof a.totalFloat === 'number' ? a.totalFloat : null,
        status: a.p6Status || a.status || 'Programada',
        subcontratista: String(a.subcontratista || '').trim(),
        resp: String(a.resp || '').trim(),
        inWeeks,
        venta: a.ventaM || a.venta || 0,
        ubicacion: actUbicacion || a.ubicacion || '',
        proceso: procesoName,
        componente: compName
      };

      // 1. Fill compMap
      if (!compMap.has(compName)) compMap.set(compName, new Map());
      const capsInComp = compMap.get(compName)!;
      if (!capsInComp.has(capName)) capsInComp.set(capName, new Map());
      const scapsInComp = capsInComp.get(capName)!;
      if (!scapsInComp.has(scapName)) scapsInComp.set(scapName, []);
      scapsInComp.get(scapName)!.push(actDetail);

      // 2. Fill procesoMap
      if (!procesoMap.has(procesoName)) procesoMap.set(procesoName, new Map());
      const capsInProceso = procesoMap.get(procesoName)!;
      if (!capsInProceso.has(capName)) capsInProceso.set(capName, new Map());
      const scapsInProceso = capsInProceso.get(capName)!;
      if (!scapsInProceso.has(scapName)) scapsInProceso.set(scapName, []);
      scapsInProceso.get(scapName)!.push(actDetail);

      // 3. Fill compProcesoMap
      if (!compProcesoMap.has(compName)) compProcesoMap.set(compName, new Map());
      const procesosInCP = compProcesoMap.get(compName)!;
      if (!procesosInCP.has(procesoName)) procesosInCP.set(procesoName, new Map());
      const capsInCP = procesosInCP.get(procesoName)!;
      if (!capsInCP.has(capName)) capsInCP.set(capName, new Map());
      const scapsInCP = capsInCP.get(capName)!;
      if (!scapsInCP.has(scapName)) scapsInCP.set(scapName, []);
      scapsInCP.get(scapName)!.push(actDetail);
    });

    // Helper to build sorted package list from scapsMap
    const buildPackageList = (
      scapsMap: Map<string, ActivityExecutionDetail[]>,
      capName: string,
      compName: string,
      procesoName: string
    ) => {
      const packageList: ScapPackageGroup[] = [];
      const capInWeeks = [false, false, false, false];
      let capTotalActs = 0;
      let capTotalVenta = 0;
      const capSubsSet = new Set<string>();
      let capMinD: Date | null = null;
      let capMaxD: Date | null = null;
      const capStatusSummary = {
        enEjecucion: 0,
        porIniciar: 0,
        completadas: 0,
        conAtraso: 0
      };

      scapsMap.forEach((acts, scapName) => {
        let minD: Date | null = null;
        let maxD: Date | null = null;
        let minFinishD: Date | null = null;
        const scapInWeeks = [false, false, false, false];
        const subsSet = new Set<string>();
        let scapVenta = 0;

        const statusSummary = {
          enEjecucion: 0,
          porIniciar: 0,
          completadas: 0,
          conAtraso: 0
        };

        acts.forEach(act => {
          capTotalActs++;
          scapVenta += act.venta || 0;

          const s = act.blStart || act.start;
          const f = act.blFinish || act.finish;
          if (s) {
            if (!minD || s < minD) minD = s;
            if (!capMinD || s < capMinD) capMinD = s;
          }
          if (f) {
            if (!maxD || f > maxD) maxD = f;
            if (!capMaxD || f > capMaxD) capMaxD = f;
            if (!minFinishD || f < minFinishD) minFinishD = f;
          }

          act.inWeeks.forEach((inW, idx) => {
            if (inW) {
              scapInWeeks[idx] = true;
              capInWeeks[idx] = true;
            }
          });

          if (act.subcontratista) {
            subsSet.add(act.subcontratista);
            capSubsSet.add(act.subcontratista);
          }

          const st = act.status.toLowerCase();
          if (st.includes('progress') || st.includes('curso') || st.includes('ejecu')) {
            statusSummary.enEjecucion++;
            capStatusSummary.enEjecucion++;
          } else if (st.includes('complet') || st.includes('termin')) {
            statusSummary.completadas++;
            capStatusSummary.completadas++;
          } else {
            statusSummary.porIniciar++;
            capStatusSummary.porIniciar++;
          }

          if (act.floatDays !== null && act.floatDays < 0) {
            statusSummary.conAtraso++;
            capStatusSummary.conAtraso++;
          }
        });

        capTotalVenta += scapVenta;

        // Sort activities inside SCAP by earliest BL Finish
        acts.sort((a, b) => {
          const fA = (a.blFinish || a.finish)?.getTime() ?? Infinity;
          const fB = (b.blFinish || b.finish)?.getTime() ?? Infinity;
          if (fA !== fB) return fA - fB;
          const sA = (a.blStart || a.start)?.getTime() ?? Infinity;
          const sB = (b.blStart || b.start)?.getTime() ?? Infinity;
          if (sA !== sB) return sA - sB;
          return (a.activityId || '').localeCompare(b.activityId || '');
        });

        const pkgUbicaciones = Array.from(new Set(acts.map(act => act.ubicacion).filter(Boolean))) as string[];

        packageList.push({
          scapName,
          capName,
          componente: compName,
          proceso: procesoName,
          activitiesCount: acts.length,
          activities: acts,
          minDate: minD,
          maxDate: maxD,
          earliestFinish: minFinishD,
          inWeeks: scapInWeeks,
          subcontratistas: Array.from(subsSet),
          ubicaciones: pkgUbicaciones,
          statusSummary,
          totalVenta: scapVenta
        });
      });

      // Sort packages by earliest finish
      packageList.sort((a, b) => {
        const finishA = a.maxDate ? a.maxDate.getTime() : Infinity;
        const finishB = b.maxDate ? b.maxDate.getTime() : Infinity;
        if (finishA !== finishB) return finishA - finishB;

        const minFinA = a.earliestFinish ? a.earliestFinish.getTime() : Infinity;
        const minFinB = b.earliestFinish ? b.earliestFinish.getTime() : Infinity;
        if (minFinA !== minFinB) return minFinA - minFinB;

        const startA = a.minDate ? a.minDate.getTime() : Infinity;
        const startB = b.minDate ? b.minDate.getTime() : Infinity;
        if (startA !== startB) return startA - startB;

        return a.scapName.localeCompare(b.scapName);
      });

      return {
        packageList,
        capTotalActs,
        capTotalVenta,
        capInWeeks,
        capSubsSet,
        capMinD,
        capMaxD,
        capStatusSummary
      };
    };

    // Helper to build sorted CapGroup[] from capsMap
    const buildCapList = (
      capsMap: Map<string, Map<string, ActivityExecutionDetail[]>>,
      compName: string,
      procesoName: string
    ) => {
      const capList: CapGroup[] = [];

      capsMap.forEach((scapsMap, capName) => {
        const {
          packageList,
          capTotalActs,
          capTotalVenta,
          capInWeeks,
          capSubsSet,
          capMinD,
          capMaxD,
          capStatusSummary
        } = buildPackageList(scapsMap, capName, compName, procesoName);

        capList.push({
          capName,
          componente: compName,
          proceso: procesoName,
          packages: packageList,
          totalActivitiesCount: capTotalActs,
          inWeeks: capInWeeks,
          subcontratistas: Array.from(capSubsSet),
          statusSummary: capStatusSummary,
          totalVenta: capTotalVenta,
          minDate: capMinD,
          maxDate: capMaxD
        });
      });

      // Sort caps based on termination date (earliest finish first)
      capList.sort(sortCapsByFinish);

      return capList;
    };

    // Global counts tracking
    let totalActs = 0;
    let totalScaps = 0;
    let totalCaps = 0;
    const weekCountScaps = [new Set<string>(), new Set<string>(), new Set<string>(), new Set<string>()];

    // 1. Build groupedComponents (Componente -> CAP -> SCAP)
    const componentList: ComponenteGroup[] = [];
    compMap.forEach((capsMap, compName) => {
      const capList = buildCapList(capsMap, compName, '');
      const compInWeeks = [false, false, false, false];
      let compTotalActs = 0;
      let compTotalPackages = 0;
      let compTotalVenta = 0;

      capList.forEach(cap => {
        totalCaps++;
        compTotalActs += cap.totalActivitiesCount;
        compTotalPackages += cap.packages.length;
        compTotalVenta += cap.totalVenta;

        cap.packages.forEach(pkg => {
          totalScaps++;
          totalActs += pkg.activitiesCount;
          pkg.inWeeks.forEach((inW, idx) => {
            if (inW) {
              compInWeeks[idx] = true;
              weekCountScaps[idx].add(`${compName}:::${cap.capName}:::${pkg.scapName}`);
            }
          });
        });
      });

      componentList.push({
        componente: compName,
        caps: capList,
        totalPackagesCount: compTotalPackages,
        totalActivitiesCount: compTotalActs,
        inWeeks: compInWeeks,
        totalVenta: compTotalVenta
      });
    });

    // Sort components: Numeric prefix (01., 02.) first, then alphabetical
    componentList.sort((a, b) => {
      const matchA = a.componente.match(/^(\d+)\./);
      const matchB = b.componente.match(/^(\d+)\./);
      if (matchA && matchB) return parseInt(matchA[1], 10) - parseInt(matchB[1], 10);
      if (matchA) return -1;
      if (matchB) return 1;
      return a.componente.localeCompare(b.componente);
    });

    // 2. Build groupedProcesos (Proceso -> CAP -> SCAP)
    const procesoList: ProcesoGroup[] = [];
    procesoMap.forEach((capsMap, procesoName) => {
      const capList = buildCapList(capsMap, '', procesoName);
      const procInWeeks = [false, false, false, false];
      let procTotalActs = 0;
      let procTotalPackages = 0;
      let procTotalVenta = 0;

      capList.forEach(cap => {
        procTotalActs += cap.totalActivitiesCount;
        procTotalPackages += cap.packages.length;
        procTotalVenta += cap.totalVenta;

        cap.packages.forEach(pkg => {
          pkg.inWeeks.forEach((inW, idx) => {
            if (inW) procInWeeks[idx] = true;
          });
        });
      });

      procesoList.push({
        proceso: procesoName,
        caps: capList,
        totalPackagesCount: procTotalPackages,
        totalActivitiesCount: procTotalActs,
        inWeeks: procInWeeks,
        totalVenta: procTotalVenta
      });
    });

    // Sort procesos: numeric prefix first, then alphabetical
    procesoList.sort((a, b) => {
      const matchA = a.proceso.match(/^(\d+)\./);
      const matchB = b.proceso.match(/^(\d+)\./);
      if (matchA && matchB) return parseInt(matchA[1], 10) - parseInt(matchB[1], 10);
      if (matchA) return -1;
      if (matchB) return 1;
      return a.proceso.localeCompare(b.proceso);
    });

    // 3. Build groupedCompProcesos (Componente -> Proceso -> CAP -> SCAP)
    const compProcesoList: ComponenteProcesoGroup[] = [];
    compProcesoMap.forEach((procesosInCP, compName) => {
      const pList: ProcesoGroup[] = [];
      const compInWeeks = [false, false, false, false];
      let compTotalActs = 0;
      let compTotalPackages = 0;
      let compTotalVenta = 0;

      procesosInCP.forEach((capsMap, procesoName) => {
        const capList = buildCapList(capsMap, compName, procesoName);
        const procInWeeks = [false, false, false, false];
        let procTotalActs = 0;
        let procTotalPackages = 0;
        let procTotalVenta = 0;

        capList.forEach(cap => {
          procTotalActs += cap.totalActivitiesCount;
          procTotalPackages += cap.packages.length;
          procTotalVenta += cap.totalVenta;

          cap.packages.forEach(pkg => {
            pkg.inWeeks.forEach((inW, idx) => {
              if (inW) {
                procInWeeks[idx] = true;
                compInWeeks[idx] = true;
              }
            });
          });
        });

        pList.push({
          proceso: procesoName,
          caps: capList,
          totalPackagesCount: procTotalPackages,
          totalActivitiesCount: procTotalActs,
          inWeeks: procInWeeks,
          totalVenta: procTotalVenta
        });

        compTotalActs += procTotalActs;
        compTotalPackages += procTotalPackages;
        compTotalVenta += procTotalVenta;
      });

      pList.sort((a, b) => {
        const matchA = a.proceso.match(/^(\d+)\./);
        const matchB = b.proceso.match(/^(\d+)\./);
        if (matchA && matchB) return parseInt(matchA[1], 10) - parseInt(matchB[1], 10);
        return a.proceso.localeCompare(b.proceso);
      });

      compProcesoList.push({
        componente: compName,
        procesos: pList,
        totalPackagesCount: compTotalPackages,
        totalActivitiesCount: compTotalActs,
        inWeeks: compInWeeks,
        totalVenta: compTotalVenta
      });
    });

    compProcesoList.sort((a, b) => {
      const matchA = a.componente.match(/^(\d+)\./);
      const matchB = b.componente.match(/^(\d+)\./);
      if (matchA && matchB) return parseInt(matchA[1], 10) - parseInt(matchB[1], 10);
      if (matchA) return -1;
      if (matchB) return 1;
      return a.componente.localeCompare(b.componente);
    });

    const allSortedNames = Array.from(allComponentsSet).sort();
    const allSortedProcesos = Array.from(allProcesosSet).sort();
    const allSortedCaps = Array.from(allCapsSet).sort();
    const allSortedScaps = Array.from(allScapsSet).sort();

    return {
      groupedComponents: componentList,
      groupedProcesos: procesoList,
      groupedCompProcesos: compProcesoList,
      allComponentNames: allSortedNames,
      allProcesoNames: allSortedProcesos,
      allCapNames: allSortedCaps,
      allScapNames: allSortedScaps,
      totalScheduledActivities: totalActs,
      totalScapPackages: totalScaps,
      totalActiveCaps: totalCaps,
      totalActiveProcesos: allProcesosSet.size,
      totalActiveComponents: componentList.length,
      packagesPerWeek: [
        weekCountScaps[0].size,
        weekCountScaps[1].size,
        weekCountScaps[2].size,
        weekCountScaps[3].size
      ]
    };
  }, [actividades, dataPlanificadoPG004, dateMode, fourWeeks, windowStartDate, windowEndDate, isMontajeFilter, isProcuraFilter, isFleteFilter, isConstruccionFilter, selectedUbicacionFilter]);

  // Expand all / Collapse all depending on active hierarchy mode
  const toggleAllComponents = (expand: boolean) => {
    if (expand) {
      if (hierarchyMode === 'componente') {
        setExpandedComponents(new Set(groupedComponents.map(c => c.componente)));
        const allCapKeys = new Set<string>();
        groupedComponents.forEach(c => {
          c.caps.forEach(cap => {
            allCapKeys.add(`${c.componente}:::${cap.capName}`);
          });
        });
        setExpandedCaps(allCapKeys);
      } else if (hierarchyMode === 'proceso') {
        setExpandedProcesos(new Set(groupedProcesos.map(p => p.proceso)));
        const allCapKeys = new Set<string>();
        groupedProcesos.forEach(p => {
          p.caps.forEach(cap => {
            allCapKeys.add(`proceso:::${p.proceso}:::${cap.capName}`);
          });
        });
        setExpandedCaps(allCapKeys);
      } else {
        setExpandedComponents(new Set(groupedCompProcesos.map(c => c.componente)));
        const allProcKeys = new Set<string>();
        const allCapKeys = new Set<string>();
        groupedCompProcesos.forEach(c => {
          c.procesos.forEach(p => {
            const procKey = `${c.componente}:::${p.proceso}`;
            allProcKeys.add(procKey);
            p.caps.forEach(cap => {
              allCapKeys.add(`${procKey}:::${cap.capName}`);
            });
          });
        });
        setExpandedProcesos(allProcKeys);
        setExpandedCaps(allCapKeys);
      }
    } else {
      setExpandedComponents(new Set());
      setExpandedProcesos(new Set());
      setExpandedCaps(new Set());
      setExpandedScaps(new Set());
    }
  };

  const toggleComponent = (compName: string) => {
    setExpandedComponents(prev => {
      const next = new Set(prev);
      if (next.has(compName)) next.delete(compName);
      else next.add(compName);
      return next;
    });
  };

  const toggleProceso = (procesoKey: string) => {
    setExpandedProcesos(prev => {
      const next = new Set(prev);
      if (next.has(procesoKey)) next.delete(procesoKey);
      else next.add(procesoKey);
      return next;
    });
  };

  const toggleCap = (capKey: string) => {
    setExpandedCaps(prev => {
      const next = new Set(prev);
      if (next.has(capKey)) next.delete(capKey);
      else next.add(capKey);
      return next;
    });
  };

  const toggleScap = (scapKey: string) => {
    setExpandedScaps(prev => {
      const next = new Set(prev);
      if (next.has(scapKey)) next.delete(scapKey);
      else next.add(scapKey);
      return next;
    });
  };

  // Generic filter matcher for packages
  const matchPackage = (pkg: ScapPackageGroup, capName: string, compName: string, procesoName: string, q: string) => {
    if (selectedComponentFilter !== 'all' && compName && compName !== selectedComponentFilter) return false;
    if (selectedProcesoFilter !== 'all' && procesoName && procesoName !== selectedProcesoFilter) return false;
    if (selectedCapFilter !== 'all' && capName !== selectedCapFilter) return false;
    if (selectedWeekFilter !== 'all') {
      const wIdx = selectedWeekFilter - 1;
      if (!pkg.inWeeks[wIdx]) return false;
    }
    if (q) {
      const matchScap = pkg.scapName.toLowerCase().includes(q);
      const matchCap = capName.toLowerCase().includes(q);
      const matchComp = (compName || '').toLowerCase().includes(q);
      const matchProc = (procesoName || '').toLowerCase().includes(q);
      const matchSub = pkg.subcontratistas.some(s => s.toLowerCase().includes(q));
      const matchAct = pkg.activities.some(a => 
        (a.descripcion && a.descripcion.toLowerCase().includes(q)) ||
        (a.wbs && a.wbs.toLowerCase().includes(q)) ||
        (a.activityId && a.activityId.toLowerCase().includes(q))
      );
      return matchScap || matchCap || matchComp || matchProc || matchSub || matchAct;
    }
    return true;
  };

  // Dynamically available SCAP names based on selectedCapFilter
  const availableScapNames = useMemo(() => {
    if (selectedCapFilter === 'all') {
      return allScapNames;
    }
    const capScaps = new Set<string>();
    groupedComponents.forEach(comp => {
      comp.caps.forEach(cap => {
        if (cap.capName === selectedCapFilter) {
          cap.packages.forEach(pkg => capScaps.add(pkg.scapName));
        }
      });
    });
    return Array.from(capScaps).sort();
  }, [allScapNames, selectedCapFilter, groupedComponents]);

  // 1. Filtered components (Hierarchy: Componente -> CAP -> SCAP)
  const filteredComponents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return groupedComponents
      .filter(comp => {
        if (selectedComponentFilter !== 'all' && comp.componente !== selectedComponentFilter) return false;
        if (selectedWeekFilter !== 'all' && !comp.inWeeks[selectedWeekFilter - 1]) return false;
        return true;
      })
      .map(comp => {
        const filteredCaps = comp.caps
          .filter(cap => {
            if (selectedCapFilter !== 'all' && cap.capName !== selectedCapFilter) return false;
            if (selectedWeekFilter !== 'all' && !cap.inWeeks[selectedWeekFilter - 1]) return false;
            return true;
          })
          .map(cap => {
            const filteredPackages = cap.packages.filter(pkg => {
              if (selectedScapFilter !== 'all' && pkg.scapName !== selectedScapFilter) return false;
              return matchPackage(pkg, cap.capName, comp.componente, pkg.proceso, q);
            });
            return {
              ...cap,
              packages: filteredPackages,
              totalActivitiesCount: filteredPackages.reduce((acc, p) => acc + p.activitiesCount, 0)
            };
          })
          .filter(cap => cap.packages.length > 0)
          .sort(sortCapsByFinish);

        return {
          ...comp,
          caps: filteredCaps,
          totalPackagesCount: filteredCaps.reduce((acc, c) => acc + c.packages.length, 0),
          totalActivitiesCount: filteredCaps.reduce((acc, c) => acc + c.totalActivitiesCount, 0)
        };
      })
      .filter(comp => comp.caps.length > 0);
  }, [groupedComponents, selectedComponentFilter, selectedProcesoFilter, selectedCapFilter, selectedScapFilter, selectedWeekFilter, searchQuery]);

  // 2. Filtered procesos (Hierarchy: Proceso -> CAP -> SCAP)
  const filteredProcesos = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return groupedProcesos
      .filter(proc => {
        if (selectedProcesoFilter !== 'all' && proc.proceso !== selectedProcesoFilter) return false;
        if (selectedWeekFilter !== 'all' && !proc.inWeeks[selectedWeekFilter - 1]) return false;
        return true;
      })
      .map(proc => {
        const filteredCaps = proc.caps
          .filter(cap => {
            if (selectedCapFilter !== 'all' && cap.capName !== selectedCapFilter) return false;
            if (selectedWeekFilter !== 'all' && !cap.inWeeks[selectedWeekFilter - 1]) return false;
            return true;
          })
          .map(cap => {
            const filteredPackages = cap.packages.filter(pkg => {
              if (selectedScapFilter !== 'all' && pkg.scapName !== selectedScapFilter) return false;
              return matchPackage(pkg, cap.capName, pkg.componente, proc.proceso, q);
            });
            return {
              ...cap,
              packages: filteredPackages,
              totalActivitiesCount: filteredPackages.reduce((acc, p) => acc + p.activitiesCount, 0)
            };
          })
          .filter(cap => cap.packages.length > 0)
          .sort(sortCapsByFinish);

        return {
          ...proc,
          caps: filteredCaps,
          totalPackagesCount: filteredCaps.reduce((acc, c) => acc + c.packages.length, 0),
          totalActivitiesCount: filteredCaps.reduce((acc, c) => acc + c.totalActivitiesCount, 0)
        };
      })
      .filter(proc => proc.caps.length > 0);
  }, [groupedProcesos, selectedComponentFilter, selectedProcesoFilter, selectedCapFilter, selectedScapFilter, selectedWeekFilter, searchQuery]);

  // 3. Filtered compProcesos (Hierarchy: Componente -> Proceso -> CAP -> SCAP)
  const filteredCompProcesos = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return groupedCompProcesos
      .filter(comp => {
        if (selectedComponentFilter !== 'all' && comp.componente !== selectedComponentFilter) return false;
        if (selectedWeekFilter !== 'all' && !comp.inWeeks[selectedWeekFilter - 1]) return false;
        return true;
      })
      .map(comp => {
        const filteredProcs = comp.procesos
          .filter(proc => {
            if (selectedProcesoFilter !== 'all' && proc.proceso !== selectedProcesoFilter) return false;
            if (selectedWeekFilter !== 'all' && !proc.inWeeks[selectedWeekFilter - 1]) return false;
            return true;
          })
          .map(proc => {
            const filteredCaps = proc.caps
              .filter(cap => {
                if (selectedCapFilter !== 'all' && cap.capName !== selectedCapFilter) return false;
                if (selectedWeekFilter !== 'all' && !cap.inWeeks[selectedWeekFilter - 1]) return false;
                return true;
              })
              .map(cap => {
                const filteredPackages = cap.packages.filter(pkg => {
                  if (selectedScapFilter !== 'all' && pkg.scapName !== selectedScapFilter) return false;
                  return matchPackage(pkg, cap.capName, comp.componente, proc.proceso, q);
                });
                return {
                  ...cap,
                  packages: filteredPackages,
                  totalActivitiesCount: filteredPackages.reduce((acc, p) => acc + p.activitiesCount, 0)
                };
              })
              .filter(cap => cap.packages.length > 0)
              .sort(sortCapsByFinish);

            return {
              ...proc,
              caps: filteredCaps,
              totalPackagesCount: filteredCaps.reduce((acc, c) => acc + c.packages.length, 0),
              totalActivitiesCount: filteredCaps.reduce((acc, c) => acc + c.totalActivitiesCount, 0)
            };
          })
          .filter(proc => proc.caps.length > 0);

        return {
          ...comp,
          procesos: filteredProcs,
          totalPackagesCount: filteredProcs.reduce((acc, p) => acc + p.totalPackagesCount, 0),
          totalActivitiesCount: filteredProcs.reduce((acc, p) => acc + p.totalActivitiesCount, 0)
        };
      })
      .filter(comp => comp.procesos.length > 0);
  }, [groupedCompProcesos, selectedComponentFilter, selectedProcesoFilter, selectedCapFilter, selectedScapFilter, selectedWeekFilter, searchQuery]);

  // Export to clipboard as TSV
  const handleCopyTsv = () => {
    const header = [
      'Componente',
      'Proceso (Col. AF)',
      'Capítulo (CAP)',
      'Paquete SCAP',
      'Ubicación',
      'Actividades a Ejecutar',
      'BL Inicio',
      'BL Fin',
      'Semana 1',
      'Semana 2',
      'Semana 3',
      'Semana 4',
      'Subcontratistas',
      'Cant. Obra',
      'Cant. Obra Prog.'
    ].join('\t');

    const rows: string[] = [];

    filteredComponents.forEach(c => {
      c.caps.forEach(cap => {
        cap.packages.forEach(p => {
          let sumCant = 0;
          let sumCantProg = 0;
          p.activities.forEach(a => {
            if (a.cantidad !== null && a.cantidad !== undefined && !isNaN(a.cantidad)) {
              sumCant += a.cantidad;
            }
            const { cantObraProg } = getCantObraProgramadaInfo(a, fourWeeks, selectedWeekFilter);
            if (cantObraProg !== null && cantObraProg !== undefined && !isNaN(cantObraProg)) {
              sumCantProg += cantObraProg;
            }
          });

          rows.push([
            c.componente,
            p.proceso || '-',
            cap.capName,
            p.scapName,
            p.ubicaciones.join(', ') || '-',
            p.activitiesCount,
            formatDateShort(p.minDate),
            formatDateShort(p.maxDate),
            p.inWeeks[0] ? 'SÍ' : 'NO',
            p.inWeeks[1] ? 'SÍ' : 'NO',
            p.inWeeks[2] ? 'SÍ' : 'NO',
            p.inWeeks[3] ? 'SÍ' : 'NO',
            p.subcontratistas.join(', ') || '-',
            sumCant.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
            sumCantProg.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
          ].join('\t'));
        });
      });
    });

    const fullTsv = [header, ...rows].join('\n');
    navigator.clipboard.writeText(fullTsv).then(() => {
      setCopiedTsv(true);
      setTimeout(() => setCopiedTsv(false), 2500);
    });
  };

  // Reusable CAP and SCAP Table Renderer
  const renderCapAccordion = (cap: CapGroup, groupKeyPrefix: string) => {
    const capKey = `${groupKeyPrefix}:::${cap.capName}`;
    const isCapExpanded = expandedCaps.has(capKey);

    // Fechas BL Programadas del CAP: tomar de sus SCAPs la fecha de inicio más early y la de fin más late
    let capEarlyStart: Date | null = null;
    let capLateFinish: Date | null = null;
    cap.packages.forEach(pkg => {
      if (pkg.minDate) {
        if (!capEarlyStart || pkg.minDate.getTime() < capEarlyStart.getTime()) {
          capEarlyStart = pkg.minDate;
        }
      }
      if (pkg.maxDate) {
        if (!capLateFinish || pkg.maxDate.getTime() > capLateFinish.getTime()) {
          capLateFinish = pkg.maxDate;
        }
      }
    });
    if (!capEarlyStart && cap.minDate) capEarlyStart = cap.minDate;
    if (!capLateFinish && cap.maxDate) capLateFinish = cap.maxDate;

    // Cálculo de la suma de Cantidad de Obra y Cantidad de Obra Programada a nivel CAP
    let capTotalCantObra = 0;
    let capHasCantObra = false;
    let capTotalCantObraProg = 0;
    let capHasCantObraProg = false;
    const capUnitsMap = new Map<string, number>();

    cap.packages.forEach(pkg => {
      pkg.activities.forEach(act => {
        if (act.cantidad !== null && act.cantidad !== undefined && !isNaN(act.cantidad)) {
          capTotalCantObra += act.cantidad;
          capHasCantObra = true;
        }
        if (act.unidad && act.unidad.trim()) {
          const u = act.unidad.trim();
          capUnitsMap.set(u, (capUnitsMap.get(u) || 0) + 1);
        }
        const { cantObraProg } = getCantObraProgramadaInfo(act, fourWeeks, selectedWeekFilter);
        if (cantObraProg !== null && cantObraProg !== undefined && !isNaN(cantObraProg)) {
          capTotalCantObraProg += cantObraProg;
          capHasCantObraProg = true;
        }
      });
    });

    let capDisplayUnit = '';
    if (capUnitsMap.size === 1) {
      capDisplayUnit = Array.from(capUnitsMap.keys())[0];
    } else if (capUnitsMap.size > 1) {
      let maxCount = 0;
      capUnitsMap.forEach((cnt, u) => {
        if (cnt > maxCount) {
          maxCount = cnt;
          capDisplayUnit = u;
        }
      });
    }

    const capAllUnitsStr = Array.from(capUnitsMap.keys()).join(', ');
    const tooltipCapCantObra = capHasCantObra
      ? `Suma de Cantidad de Obra del Capítulo (${cap.totalActivitiesCount} actividades en ${cap.packages.length} paquetes): ${capTotalCantObra.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${capDisplayUnit}${capUnitsMap.size > 1 ? ` (Unidades: ${capAllUnitsStr})` : ''}`
      : 'Sin cantidad de obra registrada en este capítulo';

    const tooltipCapCantProg = capHasCantObraProg
      ? `Suma de Cantidad de Obra Programada del Capítulo (${cap.totalActivitiesCount} actividades en ${cap.packages.length} paquetes): ${capTotalCantObraProg.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${capDisplayUnit}${capUnitsMap.size > 1 ? ` (Unidades: ${capAllUnitsStr})` : ''}`
      : 'Sin cantidad de obra programada para las semanas activas';

    return (
      <div key={capKey} className="bg-white">
        {/* CAP Accordion Header Bar */}
        <div
          onClick={() => toggleCap(capKey)}
          className="bg-slate-100/95 hover:bg-slate-200/90 text-slate-800 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2 cursor-pointer transition-colors select-none border-b border-slate-200"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1 bg-indigo-100 text-indigo-700 rounded-md border border-indigo-200 shrink-0">
              <FolderKanban className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                CAP:
              </span>
              <h5 className="font-extrabold text-xs tracking-tight text-slate-900">
                {cap.capName}
              </h5>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {cap.packages.length} {cap.packages.length === 1 ? 'Paquete SCAP' : 'Paquetes SCAP'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200">
                {cap.totalActivitiesCount} act.
              </span>

              {/* Fechas BL Programadas (Early Inicio → Late Fin de SCAPs) */}
              {(capEarlyStart || capLateFinish) && (
                <span
                  className="inline-flex items-center gap-1.5 text-[10.5px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200 shadow-2xs"
                  title="Fechas BL Programadas del Capítulo (Inicio más temprano y fin más tardío de sus paquetes SCAP)"
                >
                  <Calendar className="w-3 h-3 text-indigo-600 shrink-0" />
                  <span className="text-slate-400 font-medium">BL:</span>
                  <span className="text-indigo-700 font-bold">{formatDateShort(capEarlyStart)}</span>
                  <span className="text-slate-400">→</span>
                  <span className="text-indigo-700 font-bold">{formatDateShort(capLateFinish)}</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Cant. Obra y Cant. Obra Prog. a nivel CAP (Ubicado entre las fechas y S1-S2-S3-S4) */}
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              {/* Cant. Obra CAP */}
              <div
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 shadow-2xs"
                title={tooltipCapCantObra}
              >
                <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider font-sans">Cant. Obra:</span>
                <span className="font-extrabold text-slate-900">
                  {capHasCantObra
                    ? capTotalCantObra.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                    : '-'}
                </span>
                {capDisplayUnit && capHasCantObra && (
                  <span className="text-slate-500 font-semibold text-[9.5px]">
                    {capDisplayUnit}
                  </span>
                )}
              </div>

              {/* Cant. Obra Prog. CAP */}
              <div
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50/80 border border-indigo-200 text-indigo-900 shadow-2xs"
                title={tooltipCapCantProg}
              >
                <span className="text-[9.5px] font-bold text-indigo-500 uppercase tracking-wider font-sans">Prog:</span>
                <span className={`font-extrabold ${capTotalCantObraProg > 0 ? 'text-indigo-700' : 'text-slate-400'}`}>
                  {capHasCantObraProg
                    ? capTotalCantObraProg.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                    : '-'}
                </span>
                {capDisplayUnit && capHasCantObraProg && (
                  <span className="text-indigo-600 font-semibold text-[9.5px]">
                    {capDisplayUnit}
                  </span>
                )}
              </div>
            </div>

            {/* 4-week active presence mini pills for CAP */}
            <div className="hidden sm:flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-[9.5px] font-mono">
              {fourWeeks.map((w, idx) => (
                <span
                  key={w.weekNum}
                  className={`px-1.5 py-0.5 rounded font-bold ${
                    cap.inWeeks[idx]
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'text-slate-300'
                  }`}
                  title={cap.inWeeks[idx] ? `Activo en ${w.label}` : `Sin actividad en ${w.label}`}
                >
                  S{w.weekNum}
                </span>
              ))}
            </div>

            <div className="text-slate-500">
              <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isCapExpanded ? 'rotate-90' : ''}`} />
            </div>
          </div>
        </div>

        {/* Table of SCAPs within this CAP */}
        {isCapExpanded && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-extrabold text-[10.5px] uppercase tracking-wider border-b border-slate-200">
                  <th className="py-2.5 px-3 w-8">#</th>
                  <th className="py-2.5 px-3 min-w-[200px]">Paquete SCAP</th>
                  <th className="py-2.5 px-3 text-center w-24">Actividades</th>
                  <th className="py-2.5 px-3 text-center min-w-[130px]">Fechas BL Programadas</th>
                  <th className="py-2.5 px-3 text-center min-w-[140px]">Ejecución en 4 Semanas</th>
                  <th className="py-2.5 px-3 min-w-[140px]">Subcontratista</th>
                  <th className="py-2.5 px-3 text-right min-w-[110px]" title="Suma de Cantidad de Obra de las actividades del SCAP (Columnas F y E de CDO)">Cant. Obra</th>
                  <th className="py-2.5 px-3 text-right min-w-[120px]" title="Suma de Cantidad de Obra Programada de las actividades del SCAP (Previsión PG-004 / Precio CDO / Step CDO)">Cant. Obra Prog.</th>
                  <th className="py-2.5 px-3 text-center min-w-[110px]">Estado Paquete</th>
                  <th className="py-2.5 px-3 text-center w-20">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cap.packages.map((pkg, pIdx) => {
                  const scapKey = `${groupKeyPrefix}:::${cap.capName}:::${pkg.scapName}`;
                  const isScapExpanded = expandedScaps.has(scapKey);

                  // Cálculo de la suma de Cantidad de Obra y Cantidad de Obra Programada a nivel SCAP
                  let totalCantObra = 0;
                  let hasCantObra = false;
                  let totalCantObraProg = 0;
                  let hasCantObraProg = false;
                  const unitsMap = new Map<string, number>();

                  pkg.activities.forEach(act => {
                    if (act.cantidad !== null && act.cantidad !== undefined && !isNaN(act.cantidad)) {
                      totalCantObra += act.cantidad;
                      hasCantObra = true;
                    }
                    if (act.unidad && act.unidad.trim()) {
                      const u = act.unidad.trim();
                      unitsMap.set(u, (unitsMap.get(u) || 0) + 1);
                    }
                    const { cantObraProg } = getCantObraProgramadaInfo(act, fourWeeks, selectedWeekFilter);
                    if (cantObraProg !== null && cantObraProg !== undefined && !isNaN(cantObraProg)) {
                      totalCantObraProg += cantObraProg;
                      hasCantObraProg = true;
                    }
                  });

                  let displayUnit = '';
                  if (unitsMap.size === 1) {
                    displayUnit = Array.from(unitsMap.keys())[0];
                  } else if (unitsMap.size > 1) {
                    let maxCount = 0;
                    unitsMap.forEach((cnt, u) => {
                      if (cnt > maxCount) {
                        maxCount = cnt;
                        displayUnit = u;
                      }
                    });
                  }

                  const allUnitsStr = Array.from(unitsMap.keys()).join(', ');
                  const tooltipCantObraScap = hasCantObra
                    ? `Suma de Cant. Obra (${pkg.activities.length} partidas): ${totalCantObra.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${displayUnit}${unitsMap.size > 1 ? ` (Unidades: ${allUnitsStr})` : ''}`
                    : 'Sin cantidad de obra registrada en este SCAP';

                  const tooltipCantProgScap = hasCantObraProg
                    ? `Suma de Cant. Obra Prog. (${pkg.activities.length} partidas): ${totalCantObraProg.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${displayUnit}${unitsMap.size > 1 ? ` (Unidades: ${allUnitsStr})` : ''}`
                    : 'Sin cantidad de obra programada para las semanas activas';

                  return (
                    <React.Fragment key={scapKey}>
                      <tr
                        onClick={() => toggleScap(scapKey)}
                        className={`transition-colors cursor-pointer select-none ${
                          isScapExpanded ? 'bg-indigo-50/70' : 'hover:bg-indigo-50/40'
                        }`}
                        title={isScapExpanded ? 'Hacer clic para contraer actividades' : 'Hacer clic para desplegar actividades'}
                      >
                        <td className="py-2.5 px-3 text-slate-400 font-mono text-[10px]">
                          {pIdx + 1}
                        </td>

                        {/* SCAP Name */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />
                            <div>
                              <div className="font-extrabold text-slate-900 text-xs hover:text-indigo-700 transition-colors">
                                {pkg.scapName}
                              </div>
                              {hierarchyMode === 'proceso' && pkg.componente && (
                                <span className="text-[9.5px] font-bold text-slate-500">
                                  Comp: {pkg.componente}
                                </span>
                              )}
                              {hierarchyMode === 'componente' && pkg.proceso && (
                                <span className="text-[9.5px] font-bold text-slate-700 bg-slate-100 px-1 rounded border border-slate-300">
                                  {pkg.proceso}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Activities Count */}
                        <td className="py-2.5 px-3 text-center font-bold text-slate-700 font-mono">
                          <span className="px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200">
                            {pkg.activitiesCount}
                          </span>
                        </td>

                        {/* BL Dates Range */}
                        <td className="py-2.5 px-3 text-center font-mono text-slate-600 text-[11px]">
                          {pkg.minDate && pkg.maxDate ? (
                            <div className="flex items-center justify-center gap-1 font-semibold">
                              <span className="text-indigo-700">{formatDateShort(pkg.minDate)}</span>
                              <span className="text-slate-400">→</span>
                              <span className="text-indigo-700">{formatDateShort(pkg.maxDate)}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* 4-Weeks Active Pills */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="inline-flex items-center gap-1 font-mono text-[10px]">
                            {fourWeeks.map((w, wIdx) => {
                              const isActive = pkg.inWeeks[wIdx];
                              return (
                                <span
                                  key={w.weekNum}
                                  className={`px-1.5 py-0.5 rounded font-bold ${
                                    isActive
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-xs'
                                      : 'bg-slate-100 text-slate-400 border border-slate-200'
                                  }`}
                                  title={`${w.label}: ${isActive ? 'Activo' : 'Sin trabajo programado'}`}
                                >
                                  S{w.weekNum}
                                </span>
                              );
                            })}
                          </div>
                        </td>

                        {/* Subcontratista */}
                        <td className="py-2.5 px-3 text-slate-600 text-xs">
                          {pkg.subcontratistas.length > 0 ? (
                            <div className="truncate max-w-[180px]" title={pkg.subcontratistas.join(', ')}>
                              {pkg.subcontratistas.join(', ')}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">Propio / Sin asignar</span>
                          )}
                        </td>

                        {/* Suma Cant. Obra SCAP */}
                        <td
                          className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap"
                          title={tooltipCantObraScap}
                        >
                          {hasCantObra ? (
                            <span>
                              {totalCantObra.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                              {displayUnit && (
                                <span className="text-slate-500 font-semibold text-[10px] ml-1">
                                  {displayUnit}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-normal">-</span>
                          )}
                        </td>

                        {/* Suma Cant. Obra Prog. SCAP */}
                        <td
                          className="py-2.5 px-3 text-right font-mono whitespace-nowrap"
                          title={tooltipCantProgScap}
                        >
                          {hasCantObraProg ? (
                            <span className="inline-flex items-baseline justify-end gap-1">
                              <span className={`font-bold ${totalCantObraProg > 0 ? 'text-indigo-700' : 'text-slate-400'}`}>
                                {totalCantObraProg.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                              </span>
                              {displayUnit && (
                                <span className="text-slate-500 font-semibold text-[9.5px]">
                                  {displayUnit}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-normal">-</span>
                          )}
                        </td>

                        {/* Status summary */}
                        <td className="py-2.5 px-3 text-center">
                          {pkg.statusSummary.conAtraso > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-50 text-red-700 border border-red-200">
                              <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
                              Retraso ({pkg.statusSummary.conAtraso})
                            </span>
                          ) : pkg.statusSummary.enEjecucion > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                              <Clock className="w-3 h-3 text-blue-500 shrink-0" />
                              En Curso ({pkg.statusSummary.enEjecucion})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200">
                              Programado
                            </span>
                          )}
                        </td>

                        {/* Expand Activities toggle */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleScap(scapKey);
                            }}
                            className="p-1 hover:bg-indigo-100 rounded-lg text-indigo-600 transition-colors cursor-pointer"
                            title={isScapExpanded ? 'Ocultar actividades' : 'Ver actividades'}
                          >
                            <ChevronDown className={`w-4 h-4 transition-transform ${isScapExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        </td>
                      </tr>

                      {/* Sub-row: Specific Leaf Activities within SCAP */}
                      {isScapExpanded && (
                        <tr className="bg-slate-50/90 border-b border-slate-200">
                          <td colSpan={10} className="p-3 pl-8">
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                              <div className="px-3 py-2 bg-[#F5F8F9] border-b border-[#D5DEE2] text-[#14212A] font-semibold text-[11px] flex items-center justify-between">
                                <span>Actividades detalladas en {pkg.scapName} (CAP: {cap.capName})</span>
                                <span className="text-[10px] text-[#5A6A74] font-mono font-normal">
                                  {pkg.activities.length} partidas registradas
                                </span>
                              </div>
                              <table className="w-full text-left text-[11px]">
                                <thead>
                                  <tr className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200 text-[10px] uppercase">
                                    <th className="py-2 px-3">Código WBS</th>
                                    <th className="py-2 px-3">ID Actividad</th>
                                    <th className="py-2 px-3">Descripción (Activity Name)</th>
                                    <th className="py-2 px-3 text-right" title="Cantidad de obra y unidad de medida (Columnas F y E de CDO)">Cant. Obra</th>
                                    <th className="py-2 px-3 text-right" title="Cantidad de obra programada: Previsión económica de PG-004 / Precio unitario (Columna G de CDO) / Step (Columna H de CDO)">Cant. Obra Prog.</th>
                                    <th className="py-2 px-3 text-center">BL Inicio</th>
                                    <th className="py-2 px-3 text-center">BL Fin</th>
                                    <th className="py-2 px-3 text-center">Float</th>
                                    <th className="py-2 px-3 text-center">Semanas</th>
                                    <th className="py-2 px-3 text-center">Estado P6</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-sans">
                                  {pkg.activities.map(act => {
                                    const { cantObraProg, valorEconomico, precio, step, semanasActivasLabels } = getCantObraProgramadaInfo(
                                      act,
                                      fourWeeks,
                                      selectedWeekFilter
                                    );

                                    const tooltipCantProg = cantObraProg !== null
                                      ? `Previsión económica PG-004 (${semanasActivasLabels.join(', ')}): ${valorEconomico.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / Precio Col. G CDO: ${precio?.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${step !== null ? ` / Step Col. H CDO: ${step.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}` : ''} = ${cantObraProg.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${act.unidad || ''}`
                                      : (valorEconomico > 0 && (!precio || precio <= 0))
                                      ? `Previsión económica PG-004: ${valorEconomico.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Sin precio unitario en Columna G de CDO para calcular la cantidad.`
                                      : `Sin previsión económica en PG-004 para las semanas activas (${semanasActivasLabels.join(', ') || 'sin semanas'})`;

                                    return (
                                      <tr key={act.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-1.5 px-3 font-mono text-slate-500 font-semibold">{act.wbs}</td>
                                        <td className="py-1.5 px-3 font-mono text-indigo-700 font-bold">{act.activityId || '-'}</td>
                                        <td className="py-1.5 px-3 text-slate-800 font-medium max-w-sm">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            {act.ubicacion && (
                                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0 inline-flex items-center gap-0.5">
                                                <MapPin className="w-2.5 h-2.5 text-emerald-600" />
                                                {act.ubicacion}
                                              </span>
                                            )}
                                            {act.proceso && (
                                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-300 shrink-0">
                                                {act.proceso}
                                              </span>
                                            )}
                                            {isMontajeFilter && (
                                              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                                                Montaje
                                              </span>
                                            )}
                                            {isProcuraFilter && (
                                              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300 shrink-0">
                                                Procura
                                              </span>
                                            )}
                                            {isFleteFilter && (
                                              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-purple-100 text-purple-800 border border-purple-300 shrink-0">
                                                Flete
                                              </span>
                                            )}
                                            <span>{act.descripcion}</span>
                                          </div>
                                        </td>
                                        <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                                          {act.cantidad !== null && act.cantidad !== undefined ? (
                                            <span>
                                              {act.cantidad.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                              {act.unidad && (
                                                <span className="text-slate-600 font-semibold text-[10px] ml-1">
                                                  {act.unidad}
                                                </span>
                                              )}
                                            </span>
                                          ) : (
                                            <span className="text-slate-300 font-normal">-</span>
                                          )}
                                        </td>
                                        <td
                                          className="py-1.5 px-3 text-right font-mono whitespace-nowrap"
                                          title={tooltipCantProg}
                                        >
                                          {cantObraProg !== null && cantObraProg !== undefined ? (
                                            <span className="inline-flex items-baseline justify-end gap-1">
                                              <span className={`font-bold ${cantObraProg > 0 ? 'text-indigo-700' : 'text-slate-400'}`}>
                                                {cantObraProg.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                              </span>
                                              {act.unidad && (
                                                <span className="text-slate-500 font-semibold text-[9.5px]">
                                                  {act.unidad}
                                                </span>
                                              )}
                                            </span>
                                          ) : (
                                            <span className="text-slate-300 font-normal">-</span>
                                          )}
                                        </td>
                                      <td className="py-1.5 px-3 text-center font-mono text-slate-600">{formatDateShort(act.blStart)}</td>
                                      <td className="py-1.5 px-3 text-center font-mono text-slate-600">{formatDateShort(act.blFinish)}</td>
                                      <td className="py-1.5 px-3 text-center font-mono font-bold">
                                        {act.floatDays === null ? (
                                          <span className="text-slate-400">-</span>
                                        ) : act.floatDays < 0 ? (
                                          <span className="text-red-600">({Math.abs(act.floatDays)})</span>
                                        ) : (
                                          <span className="text-slate-700">{act.floatDays}</span>
                                        )}
                                      </td>
                                      <td className="py-1.5 px-3 text-center font-mono text-[9px]">
                                        <div className="flex items-center justify-center gap-0.5">
                                          {act.inWeeks.map((inW, idx) => (
                                            <span
                                              key={idx}
                                              className={`w-4 h-4 rounded flex items-center justify-center font-bold ${
                                                inW
                                                  ? 'bg-emerald-500 text-white'
                                                  : 'bg-slate-100 text-slate-400'
                                              }`}
                                            >
                                              {idx + 1}
                                            </span>
                                          ))}
                                        </div>
                                      </td>
                                      <td className="py-1.5 px-3 text-center">
                                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-semibold">
                                          {act.status}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const totalCurrentPackages = hierarchyMode === 'componente'
    ? filteredComponents.reduce((acc, c) => acc + c.caps.reduce((a, cap) => a + cap.packages.length, 0), 0)
    : hierarchyMode === 'proceso'
    ? filteredProcesos.reduce((acc, p) => acc + p.caps.reduce((a, cap) => a + cap.packages.length, 0), 0)
    : filteredCompProcesos.reduce((acc, c) => acc + c.procesos.reduce((a, p) => a + p.caps.reduce((ap, cap) => ap + cap.packages.length, 0), 0), 0);

  const hasNoResults = hierarchyMode === 'componente'
    ? filteredComponents.length === 0
    : hierarchyMode === 'proceso'
    ? filteredProcesos.length === 0
    : filteredCompProcesos.length === 0;

  return (
    <div 
      id="tarjeta-analisis-proyecto"
      className="bg-white rounded-xl shadow-xs border border-[#D5DEE2] overflow-hidden animate-fade-in transition-all"
    >
      {/* 1. Barra de título (estilo "Estado de Actividades") */}
      <div 
        onClick={() => setIsCardCollapsed(!isCardCollapsed)}
        className={`flex items-center justify-between flex-wrap gap-x-4 gap-y-1 px-4 py-2 bg-[#F5F8F9] hover:bg-[#EEF2F3] cursor-pointer select-none ${isCardCollapsed ? '' : 'border-b border-[#D5DEE2]'}`}
        title="Hacer clic para expandir o colapsar el Análisis de Proyecto"
      >
        <span className="text-[11px] font-['Barlow_Condensed'] font-semibold text-[#14212A] uppercase tracking-wider">
          Análisis de Proyecto · <span className="text-[#5A6A74] font-mono normal-case" title="Actividades filtradas por estado P6: In Progress o Not Started">P6: In Progress &amp; Not Started · {totalScheduledActivities} actividades</span>
        </span>
        <div className="flex items-center gap-3">
          {!isCardCollapsed && <span className="hidden sm:inline text-[11px] text-[#5A6A74] font-mono">
            Componentes <b className="text-[#14212A]">{totalActiveComponents}</b> · Procesos <b className="text-[#14212A]">{totalActiveProcesos}</b> · CAP <b className="text-[#14212A]">{totalActiveCaps}</b> · SCAP <b className="text-[#14212A]">{totalScapPackages}</b> · Actividades <b className="text-[#14212A]">{totalScheduledActivities}</b>
          </span>}
          <span className="text-[#5A6A74] text-xs">{isCardCollapsed ? '▼' : '▲'}</span>
        </div>
      </div>

      {/* 2. Body of the Card */}
      {!isCardCollapsed && (
        <div className="p-4 sm:p-6 space-y-5 bg-slate-50/50">
          
          {/* Controls Bar: Week Selector, Month, Navigation, Search and Mode Toggle */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3.5">
            
            {/* Top row: Period Selector, Hierarchy Toggle & Date Mode */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
              
              {/* Month / Period Picker with Previous / Next navigation */}
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Mes / Período:</span>
                </label>

                <div className="inline-flex items-center bg-slate-100 border border-slate-200 rounded-xl p-0.5">
                  <button
                    type="button"
                    onClick={handlePrevPeriod}
                    className="p-1.5 hover:bg-white text-slate-600 hover:text-slate-900 rounded-lg transition-all cursor-pointer"
                    title="Período anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <select
                    value={selectedMonthKey}
                    onChange={(e) => setSelectedMonthKey(e.target.value)}
                    className="bg-transparent text-xs font-black text-slate-800 py-1.5 px-2.5 focus:outline-none cursor-pointer"
                  >
                    {availableMonths.map(m => (
                      <option key={m.key} value={m.key}>
                        {m.label} (4 semanas)
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleNextPeriod}
                    className="p-1.5 hover:bg-white text-slate-600 hover:text-slate-900 rounded-lg transition-all cursor-pointer"
                    title="Período siguiente"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Ubicación filter dropdown */}
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <select
                    id="select-filtro-ubicacion"
                    value={selectedUbicacionFilter}
                    onChange={(e) => {
                      setSelectedUbicacionFilter(e.target.value);
                      setExpandedComponents(new Set());
                      setExpandedProcesos(new Set());
                      setExpandedCaps(new Set());
                      setExpandedScaps(new Set());
                    }}
                    className={`text-xs font-bold rounded-xl py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer border transition-all ${
                      selectedUbicacionFilter !== 'all'
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300 ring-1 ring-emerald-300 font-extrabold'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white'
                    }`}
                    title="Filtrar según el campo de ubicación (Merinos / Progreso / Guayacanes)"
                  >
                    <option value="all">Todas las Ubicaciones ({availableUbicaciones.length})</option>
                    {availableUbicaciones.map(ub => (
                      <option key={ub} value={ub}>
                        {ub}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Hierarchy View Mode Selector: Comp + Proceso vs Por Proceso vs Por Componente */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-600">Jerarquía:</span>
                <div className="inline-flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
                  <button
                    type="button"
                    id="btn-jerarquia-comp-proceso"
                    onClick={() => {
                      setHierarchyMode('componente_proceso');
                      setExpandedComponents(new Set());
                      setExpandedProcesos(new Set());
                      setExpandedCaps(new Set());
                      setExpandedScaps(new Set());
                    }}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      hierarchyMode === 'componente_proceso'
                        ? 'bg-gradient-to-r from-[#4f39f6] to-slate-500 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Agrupar por Componente → Proceso → CAP → SCAP"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Comp. + Proceso</span>
                  </button>
                  <button
                    type="button"
                    id="btn-jerarquia-proceso"
                    onClick={() => {
                      setHierarchyMode('proceso');
                      setExpandedComponents(new Set());
                      setExpandedProcesos(new Set());
                      setExpandedCaps(new Set());
                      setExpandedScaps(new Set());
                    }}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      hierarchyMode === 'proceso'
                        ? 'bg-slate-500 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Agrupar por Proceso (Columna AF del master) → CAP → SCAP"
                  >
                    <FolderKanban className="w-3.5 h-3.5" />
                    <span>Por Proceso (Col. AF)</span>
                  </button>
                  <button
                    type="button"
                    id="btn-jerarquia-componente"
                    onClick={() => {
                      setHierarchyMode('componente');
                      setExpandedComponents(new Set());
                      setExpandedProcesos(new Set());
                      setExpandedCaps(new Set());
                      setExpandedScaps(new Set());
                    }}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      hierarchyMode === 'componente'
                        ? 'bg-[#4f39f6] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Agrupar por Componente → CAP → SCAP"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Por Componente</span>
                  </button>
                </div>
              </div>

              {/* Date Mode: Línea Base (BL) vs Actual / Forecast & Action Buttons */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">Fechas:</span>
                  <div className="inline-flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setDateMode('bl')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                        dateMode === 'bl'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Filtrar por fechas BL Inicio y BL Fin (Línea Base del Cronograma)"
                    >
                      Línea Base (BL)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateMode('actual')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                        dateMode === 'actual'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Filtrar por fechas reales / forecast (Inicio y Fin actuales)"
                    >
                      Actual / Forecast
                    </button>
                  </div>
                </div>

                {/* Action Buttons: Expand All, Collapse All, Copy */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleAllComponents(true)}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                    title="Expandir todos los grupos y capítulos"
                  >
                    <ChevronsUpDown className="w-3.5 h-3.5 text-slate-500" />
                    <span className="hidden sm:inline">Expandir Todos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleAllComponents(false)}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                    title="Colapsar todos los grupos"
                  >
                    <ChevronsDownUp className="w-3.5 h-3.5 text-slate-500" />
                    <span className="hidden sm:inline">Colapsar Todos</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyTsv}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                    title="Copiar tabla en formato TSV (para Excel/Word)"
                  >
                    {copiedTsv ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-indigo-200" />
                        <span>¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-indigo-200" />
                        <span>Copiar Tabla</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Middle row: 4-Week Timeline Strip Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {fourWeeks.map((w, idx) => {
                const isSelectedWeek = selectedWeekFilter === w.weekNum;
                const activeCount = packagesPerWeek[idx] || 0;

                return (
                  <div
                    key={w.weekNum}
                    onClick={() => {
                      setSelectedWeekFilter(isSelectedWeek ? 'all' : w.weekNum);
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer select-none ${
                      isSelectedWeek
                        ? 'bg-indigo-50 border-indigo-500 shadow-sm ring-2 ring-indigo-200'
                        : 'bg-slate-50/80 hover:bg-slate-100/90 border-slate-200'
                    }`}
                    title={`Filtrar paquetes activos en ${w.label}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-black uppercase text-indigo-900 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                        {w.label}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        activeCount > 0 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-200 text-slate-500'
                      }`}>
                        {activeCount} {activeCount === 1 ? 'paquete' : 'paquetes'}
                      </span>
                    </div>
                    <div className="text-xs font-mono font-bold text-slate-700">
                      {formatDateDayMonth(w.start)} — {formatDateDayMonth(w.end)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom row: Search, Component filter, Proceso filter, CAP filter, Montaje & Action buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              
              {/* Search input */}
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar SCAP, proceso, subcontratista o actividad..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Component filter dropdown */}
              <div className="flex items-center gap-1.5">
                <Building2 className={`w-3.5 h-3.5 shrink-0 ${selectedComponentFilter !== 'all' ? 'text-indigo-600' : 'text-slate-500'}`} />
                <select
                  id="select-filtro-componente"
                  value={selectedComponentFilter}
                  onChange={(e) => setSelectedComponentFilter(e.target.value)}
                  className={`text-xs font-bold rounded-xl py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer border transition-all ${
                    selectedComponentFilter !== 'all'
                      ? 'bg-indigo-50 text-indigo-950 border-indigo-300 ring-1 ring-indigo-300'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white'
                  }`}
                  title="Filtrar por Componente (selecciona uno específico para desplegar el gráfico de cantidades de obra programadas)"
                >
                  <option value="all">Todos los Componentes ({allComponentNames.length})</option>
                  {allComponentNames.map(cn => (
                    <option key={cn} value={cn}>
                      {cn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Proceso filter dropdown (Columna AF del master) */}
              <div className="flex items-center gap-1.5">
                <FolderKanban className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <select
                  id="select-filtro-proceso"
                  value={selectedProcesoFilter}
                  onChange={(e) => setSelectedProcesoFilter(e.target.value)}
                  className={`text-xs font-bold rounded-xl py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-slate-400 cursor-pointer border transition-all ${
                    selectedProcesoFilter !== 'all'
                      ? 'bg-slate-100 text-slate-900 border-slate-400 ring-1 ring-slate-400'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white'
                  }`}
                  title="Filtrar por Proceso (Columna AF del master)"
                >
                  <option value="all">Todos los Procesos ({allProcesoNames.length})</option>
                  {allProcesoNames.map(pr => (
                    <option key={pr} value={pr}>
                      {pr}
                    </option>
                  ))}
                </select>
              </div>

              {/* CAP filter dropdown */}
              <div className="flex items-center gap-1.5">
                <FolderKanban className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <select
                  value={selectedCapFilter}
                  onChange={(e) => {
                    setSelectedCapFilter(e.target.value);
                    setSelectedScapFilter('all');
                  }}
                  className={`text-xs font-bold rounded-xl py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer border transition-all ${
                    selectedCapFilter !== 'all'
                      ? 'bg-indigo-50 text-indigo-950 border-indigo-300 ring-1 ring-indigo-300'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white'
                  }`}
                  title="Filtrar por Capítulo CAP"
                >
                  <option value="all">Todos los CAP ({allCapNames.length})</option>
                  {allCapNames.map(cap => (
                    <option key={cap} value={cap}>
                      {cap}
                    </option>
                  ))}
                </select>
              </div>

              {/* SCAP filter dropdown */}
              <div className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <select
                  id="select-filtro-scap"
                  value={selectedScapFilter}
                  onChange={(e) => setSelectedScapFilter(e.target.value)}
                  className={`text-xs font-bold rounded-xl py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer border transition-all ${
                    selectedScapFilter !== 'all'
                      ? 'bg-indigo-50 text-indigo-950 border-indigo-300 ring-1 ring-indigo-300'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white'
                  }`}
                  title="Filtrar por Sub-Capítulo / Paquete SCAP"
                >
                  <option value="all">
                    {selectedCapFilter !== 'all' 
                      ? `Todos los SCAP del CAP (${availableScapNames.length})` 
                      : `Todos los SCAP (${availableScapNames.length})`}
                  </option>
                  {availableScapNames.map(scap => (
                    <option key={scap} value={scap}>
                      {scap}
                    </option>
                  ))}
                </select>
              </div>

              {/* Procura Filter Button */}
              <button
                type="button"
                id="btn-filtro-procura"
                onClick={() => setIsProcuraFilter(prev => !prev)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
                  isProcuraFilter
                    ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-sm ring-2 ring-blue-300'
                    : 'bg-blue-50/90 hover:bg-blue-100 text-blue-900 border-blue-300/80 shadow-mini'
                }`}
                title='Filtrar actividades cuyo Activity Name inicie por "compr"'
              >
                <ShoppingCart className={`w-3.5 h-3.5 ${isProcuraFilter ? 'text-white' : 'text-blue-700'}`} />
                <span>Procura</span>
                {isProcuraFilter && (
                  <span className="px-1.5 py-0.2 bg-white/20 text-white rounded-full text-[9px] font-black uppercase tracking-wider">
                    Activo
                  </span>
                )}
              </button>

              {/* Flete Filter Button */}
              <button
                type="button"
                id="btn-filtro-flete"
                onClick={() => setIsFleteFilter(prev => !prev)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
                  isFleteFilter
                    ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-600 shadow-sm ring-2 ring-purple-300'
                    : 'bg-purple-50/90 hover:bg-purple-100 text-purple-900 border-purple-300/80 shadow-mini'
                }`}
                title='Filtrar actividades cuyo Activity Name inicie por "flete"'
              >
                <Truck className={`w-3.5 h-3.5 ${isFleteFilter ? 'text-white' : 'text-purple-700'}`} />
                <span>Flete</span>
                {isFleteFilter && (
                  <span className="px-1.5 py-0.2 bg-white/20 text-white rounded-full text-[9px] font-black uppercase tracking-wider">
                    Activo
                  </span>
                )}
              </button>

              {/* Montaje Filter Button */}
              <button
                type="button"
                id="btn-filtro-montaje"
                onClick={() => setIsMontajeFilter(prev => !prev)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
                  isMontajeFilter
                    ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600 shadow-sm ring-2 ring-amber-300'
                    : 'bg-amber-50/90 hover:bg-amber-100 text-amber-900 border-amber-300/80 shadow-mini'
                }`}
                title='Filtrar actividades cuyo Activity Name inicie por "Inst"'
              >
                <Wrench className={`w-3.5 h-3.5 ${isMontajeFilter ? 'text-white' : 'text-amber-700'}`} />
                <span>Montaje</span>
                {isMontajeFilter && (
                  <span className="px-1.5 py-0.2 bg-white/20 text-white rounded-full text-[9px] font-black uppercase tracking-wider">
                    Activo
                  </span>
                )}
              </button>

              {/* Construcción Filter Button */}
              <button
                type="button"
                id="btn-filtro-construccion"
                onClick={() => setIsConstruccionFilter(prev => !prev)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
                  isConstruccionFilter
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-300'
                    : 'bg-emerald-50/90 hover:bg-emerald-100 text-emerald-900 border-emerald-300/80 shadow-mini'
                }`}
                title="Filtrar actividades de Construcción (demás partidas que no son Procura, Flete ni Montaje)"
              >
                <HardHat className={`w-3.5 h-3.5 ${isConstruccionFilter ? 'text-white' : 'text-emerald-700'}`} />
                <span>Construcción</span>
                {isConstruccionFilter && (
                  <span className="px-1.5 py-0.2 bg-white/20 text-white rounded-full text-[9px] font-black uppercase tracking-wider">
                    Activo
                  </span>
                )}
              </button>
            </div>

          </div>

          {/* Active Filters Notification Banner */}
          {(isMontajeFilter || isProcuraFilter || isFleteFilter || isConstruccionFilter || selectedUbicacionFilter !== 'all' || selectedProcesoFilter !== 'all' || selectedComponentFilter !== 'all' || selectedCapFilter !== 'all' || selectedScapFilter !== 'all' || selectedWeekFilter !== 'all') && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-50/80 border border-amber-200 rounded-xl px-3.5 py-2.5 text-xs text-amber-900 shadow-mini animate-fade-in">
              <div className="flex flex-wrap items-center gap-2">
                {selectedUbicacionFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs">
                    <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                    Ubicación: <strong>{selectedUbicacionFilter}</strong>
                    <button
                      type="button"
                      onClick={() => setSelectedUbicacionFilter('all')}
                      className="ml-1 hover:text-red-700 cursor-pointer text-[11px] font-bold"
                    >
                      ✕
                    </button>
                  </span>
                )}
                {selectedProcesoFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-200 text-slate-800 border border-slate-300 font-bold text-xs">
                    <FolderKanban className="w-3.5 h-3.5 text-slate-600" />
                    Proceso: <strong>{selectedProcesoFilter}</strong>
                    <button
                      type="button"
                      onClick={() => setSelectedProcesoFilter('all')}
                      className="ml-1 hover:text-red-700 cursor-pointer text-[11px] font-bold"
                    >
                      ✕
                    </button>
                  </span>
                )}
                {selectedComponentFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold text-xs">
                    <Building2 className="w-3.5 h-3.5 text-indigo-700" />
                    Componente: <strong>{selectedComponentFilter}</strong>
                    <button
                      type="button"
                      onClick={() => setSelectedComponentFilter('all')}
                      className="ml-1 hover:text-red-700 cursor-pointer text-[11px] font-bold"
                    >
                      ✕
                    </button>
                  </span>
                )}
                {selectedCapFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-200 text-slate-900 border border-slate-300 font-bold text-xs">
                    CAP: <strong>{selectedCapFilter}</strong>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCapFilter('all');
                        setSelectedScapFilter('all');
                      }}
                      className="ml-1 hover:text-red-700 cursor-pointer text-[11px] font-bold"
                    >
                      ✕
                    </button>
                  </span>
                )}
                {selectedScapFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-950 border border-indigo-300 font-bold text-xs">
                    <Package className="w-3.5 h-3.5 text-indigo-700" />
                    SCAP: <strong>{selectedScapFilter}</strong>
                    <button
                      type="button"
                      onClick={() => setSelectedScapFilter('all')}
                      className="ml-1 hover:text-red-700 cursor-pointer text-[11px] font-bold"
                    >
                      ✕
                    </button>
                  </span>
                )}
                {selectedWeekFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold text-xs">
                    Semana: <strong>Semana {selectedWeekFilter}</strong>
                    <button
                      type="button"
                      onClick={() => setSelectedWeekFilter('all')}
                      className="ml-1 hover:text-red-700 cursor-pointer text-[11px] font-bold"
                    >
                      ✕
                    </button>
                  </span>
                )}
                {isMontajeFilter && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs">
                    <Wrench className="w-3.5 h-3.5 text-amber-700" />
                    Filtro Montaje (Inst*)
                    <button
                      type="button"
                      onClick={() => setIsMontajeFilter(false)}
                      className="ml-1 hover:text-red-700 cursor-pointer text-[11px] font-bold"
                    >
                      ✕
                    </button>
                  </span>
                )}
                {isProcuraFilter && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 border border-blue-300 font-bold text-xs">
                    <ShoppingCart className="w-3.5 h-3.5 text-blue-700" />
                    Filtro Procura (compr*)
                    <button
                      type="button"
                      onClick={() => setIsProcuraFilter(false)}
                      className="ml-1 hover:text-red-700 cursor-pointer text-[11px] font-bold"
                    >
                      ✕
                    </button>
                  </span>
                )}
                {isFleteFilter && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-100 text-purple-900 border border-purple-300 font-bold text-xs">
                    <Truck className="w-3.5 h-3.5 text-purple-700" />
                    Filtro Flete (flete*)
                    <button
                      type="button"
                      onClick={() => setIsFleteFilter(false)}
                      className="ml-1 hover:text-red-700 cursor-pointer text-[11px] font-bold"
                    >
                      ✕
                    </button>
                  </span>
                )}
                {isConstruccionFilter && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs">
                    <HardHat className="w-3.5 h-3.5 text-emerald-700" />
                    Filtro Construcción
                    <button
                      type="button"
                      onClick={() => setIsConstruccionFilter(false)}
                      className="ml-1 hover:text-red-700 cursor-pointer text-[11px] font-bold"
                    >
                      ✕
                    </button>
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedUbicacionFilter('all');
                  setSelectedProcesoFilter('all');
                  setSelectedComponentFilter('all');
                  setSelectedCapFilter('all');
                  setSelectedScapFilter('all');
                  setSelectedWeekFilter('all');
                  setIsMontajeFilter(false);
                  setIsProcuraFilter(false);
                  setIsFleteFilter(false);
                  setIsConstruccionFilter(false);
                }}
                className="text-[11px] font-bold text-slate-700 hover:text-slate-950 underline cursor-pointer shrink-0 ml-auto"
              >
                Quitar filtros activos
              </button>
            </div>
          )}

          {/* 3. Main Data View: Depending on Hierarchy Mode */}
          {hasNoResults ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
              <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-600 border border-amber-200">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-black text-slate-800">
                No se encontraron paquetes para la selección activa
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No hay actividades de cronograma que coincidan con los filtros en las fechas entre el {formatDateShort(windowStartDate)} y el {formatDateShort(windowEndDate)}. Puedes restablecer los filtros o ajustar el período.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleResetToP6}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restablecer Filtros y Período</span>
                </button>
              </div>
            </div>
          ) : hierarchyMode === 'componente' ? (
            /* Mode 1: Grouped by Componente -> CAP -> SCAP (with #4f39f6 component bar) */
            <div className="space-y-4">
              {filteredComponents.map(compGroup => {
                const isExpanded = expandedComponents.has(compGroup.componente);

                return (
                  <div
                    key={compGroup.componente}
                    className="bg-white rounded-xl border border-[#D5DEE2] shadow-xs overflow-hidden transition-all"
                  >
                    {/* Component Header Accordion Bar styled in #4f39f6 */}
                    <div
                      onClick={() => toggleComponent(compGroup.componente)}
                      className="bg-[#F8DCDC] text-[#14212A] px-4 py-2 flex items-center justify-between flex-wrap gap-2.5 cursor-pointer hover:bg-[#F4CFCF] transition-colors select-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1 bg-white text-[#CD0000] rounded-lg border border-[#F2BFBF] shrink-0">
                          <Building2 className="w-4 h-4 text-[#CD0000]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-['Barlow_Condensed'] font-semibold text-[13px] tracking-wider text-[#14212A] uppercase">
                              Componente: {compGroup.componente}
                            </h4>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white text-[#5A6A74] border border-[#F2BFBF]">
                              {compGroup.caps.length} {compGroup.caps.length === 1 ? 'Capítulo CAP' : 'Capítulos CAP'}
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white text-[#5A6A74] border border-[#F2BFBF]">
                              {compGroup.totalPackagesCount} {compGroup.totalPackagesCount === 1 ? 'Paquete SCAP' : 'Paquetes SCAP'}
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white text-[#5A6A74] border border-[#F2BFBF]">
                              {compGroup.totalActivitiesCount} actividades
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* 4-week active presence mini pills */}
                        <div className="hidden sm:flex items-center gap-1 bg-white p-1 rounded-lg border border-[#F2BFBF] text-[10px] font-mono">
                          {fourWeeks.map((w, idx) => (
                            <span
                              key={w.weekNum}
                              className={`px-1.5 py-0.5 rounded font-bold ${
                                compGroup.inWeeks[idx]
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'text-[#a3aab0]'
                              }`}
                              title={compGroup.inWeeks[idx] ? `Activo en ${w.label}` : `Sin actividad en ${w.label}`}
                            >
                              S{w.weekNum}
                            </span>
                          ))}
                        </div>

                        <div className="text-[#5A6A74]">
                          <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                        </div>
                      </div>
                    </div>

                    {/* List of CAPs within Component */}
                    {isExpanded && (
                      <div className="divide-y divide-slate-200/90 bg-slate-50/40">
                        {compGroup.caps.map(cap => renderCapAccordion(cap, compGroup.componente))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : hierarchyMode === 'proceso' ? (
            /* Mode 2: Grouped by Proceso (Columna AF del master) -> CAP -> SCAP */
            <div className="space-y-4">
              {filteredProcesos.map(procesoGroup => {
                const isExpanded = expandedProcesos.has(procesoGroup.proceso);

                return (
                  <div
                    key={procesoGroup.proceso}
                    className="bg-white rounded-xl border border-[#D5DEE2] shadow-xs overflow-hidden transition-all"
                  >
                    {/* Proceso Header Accordion Bar */}
                    <div
                      onClick={() => toggleProceso(procesoGroup.proceso)}
                      className="bg-[#FBE9E9] text-[#14212A] px-4 py-2 flex items-center justify-between flex-wrap gap-2.5 cursor-pointer hover:bg-[#e4e1f9] transition-colors select-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1 bg-white text-[#CD0000] rounded-lg border border-[#F2BFBF] shrink-0">
                          <FolderKanban className="w-4 h-4 text-[#CD0000]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-['Barlow_Condensed'] font-semibold text-[13px] tracking-wider text-[#14212A] uppercase flex items-center gap-1.5">
                              <span>Proceso (Col. AF):</span>
                              <span className="text-[#CD0000]">{procesoGroup.proceso}</span>
                            </h4>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white text-[#5A6A74] border border-[#F2BFBF]">
                              {procesoGroup.caps.length} {procesoGroup.caps.length === 1 ? 'Capítulo CAP' : 'Capítulos CAP'}
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white text-[#5A6A74] border border-[#F2BFBF]">
                              {procesoGroup.totalPackagesCount} {procesoGroup.totalPackagesCount === 1 ? 'Paquete SCAP' : 'Paquetes SCAP'}
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white text-[#5A6A74] border border-[#F2BFBF]">
                              {procesoGroup.totalActivitiesCount} actividades
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* 4-week active presence mini pills */}
                        <div className="hidden sm:flex items-center gap-1 bg-black/30 p-1 rounded-lg border border-white/15 text-[10px] font-mono">
                          {fourWeeks.map((w, idx) => (
                            <span
                              key={w.weekNum}
                              className={`px-1.5 py-0.5 rounded font-bold ${
                                procesoGroup.inWeeks[idx]
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'text-[#a3aab0]'
                              }`}
                              title={procesoGroup.inWeeks[idx] ? `Activo en ${w.label}` : `Sin actividad en ${w.label}`}
                            >
                              S{w.weekNum}
                            </span>
                          ))}
                        </div>

                        <div className="text-[#5A6A74]">
                          <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                        </div>
                      </div>
                    </div>

                    {/* List of CAPs within Proceso */}
                    {isExpanded && (
                      <div className="divide-y divide-slate-200/90 bg-slate-50/40">
                        {procesoGroup.caps.map(cap => renderCapAccordion(cap, `proceso:::${procesoGroup.proceso}`))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Mode 3: Grouped by Componente (#4f39f6) -> Proceso (Columna AF) -> CAP -> SCAP */
            <div className="space-y-4">
              {filteredCompProcesos.map(compGroup => {
                const isExpanded = expandedComponents.has(compGroup.componente);

                return (
                  <div
                    key={compGroup.componente}
                    className="bg-white rounded-xl border border-[#D5DEE2] shadow-xs overflow-hidden transition-all"
                  >
                    {/* Component Header Accordion Bar styled in #4f39f6 */}
                    <div
                      onClick={() => toggleComponent(compGroup.componente)}
                      className="bg-[#F8DCDC] text-[#14212A] px-4 py-2 flex items-center justify-between flex-wrap gap-2.5 cursor-pointer hover:bg-[#F4CFCF] transition-colors select-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1 bg-white text-[#CD0000] rounded-lg border border-[#F2BFBF] shrink-0">
                          <Building2 className="w-4 h-4 text-[#CD0000]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-['Barlow_Condensed'] font-semibold text-[13px] tracking-wider text-[#14212A] uppercase">
                              Componente: {compGroup.componente}
                            </h4>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white text-[#5A6A74] border border-[#F2BFBF]">
                              {compGroup.procesos.length} {compGroup.procesos.length === 1 ? 'Proceso' : 'Procesos'}
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white text-[#5A6A74] border border-[#F2BFBF]">
                              {compGroup.totalPackagesCount} {compGroup.totalPackagesCount === 1 ? 'Paquete SCAP' : 'Paquetes SCAP'}
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white text-[#5A6A74] border border-[#F2BFBF]">
                              {compGroup.totalActivitiesCount} actividades
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-1 bg-white p-1 rounded-lg border border-[#F2BFBF] text-[10px] font-mono">
                          {fourWeeks.map((w, idx) => (
                            <span
                              key={w.weekNum}
                              className={`px-1.5 py-0.5 rounded font-bold ${
                                compGroup.inWeeks[idx]
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'text-[#a3aab0]'
                              }`}
                              title={compGroup.inWeeks[idx] ? `Activo en ${w.label}` : `Sin actividad en ${w.label}`}
                            >
                              S{w.weekNum}
                            </span>
                          ))}
                        </div>

                        <div className="text-[#5A6A74]">
                          <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                        </div>
                      </div>
                    </div>

                    {/* List of Procesos within this Component */}
                    {isExpanded && (
                      <div className="divide-y divide-slate-200 bg-slate-50/40">
                        {compGroup.procesos.map(pGroup => {
                          const procKey = `${compGroup.componente}:::${pGroup.proceso}`;
                          const isProcExpanded = expandedProcesos.has(procKey);

                          return (
                            <div key={procKey} className="bg-white">
                              {/* Sub-header for Proceso within Component */}
                              <div
                                onClick={() => toggleProceso(procKey)}
                                className="bg-[#FBE9E9] hover:bg-[#e4e1f9] text-[#14212A] px-4 py-2 flex items-center justify-between flex-wrap gap-2 cursor-pointer transition-colors select-none border-b border-[#F8DCDC]"
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="p-1 bg-white text-[#CD0000] rounded-md border border-[#F2BFBF] shrink-0">
                                    <FolderKanban className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-[10px] text-[#5A6A74] font-bold uppercase tracking-wider">
                                      Proceso (Col. AF):
                                    </span>
                                    <h5 className="font-semibold text-xs tracking-tight text-[#14212A]">
                                      {pGroup.proceso}
                                    </h5>
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white text-[#5A6A74] border border-[#F2BFBF]">
                                      {pGroup.caps.length} {pGroup.caps.length === 1 ? 'Capítulo CAP' : 'Capítulos CAP'}
                                    </span>
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white text-[#5A6A74] border border-[#F2BFBF]">
                                      {pGroup.totalPackagesCount} {pGroup.totalPackagesCount === 1 ? 'Paquete SCAP' : 'Paquetes SCAP'}
                                    </span>
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white text-[#5A6A74] border border-[#F2BFBF]">
                                      {pGroup.totalActivitiesCount} act.
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <div className="text-[#5A6A74]">
                                    <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isProcExpanded ? 'rotate-90' : ''}`} />
                                  </div>
                                </div>
                              </div>

                              {/* List of CAPs within Proceso */}
                              {isProcExpanded && (
                                <div className="divide-y divide-slate-200/90 bg-slate-50/40">
                                  {pGroup.caps.map(cap => renderCapAccordion(cap, procKey))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer note */}
          <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 font-medium border-t border-slate-200 flex-wrap gap-2">
            <span>
              * Actividades filtradas por estado P6 (In Progress o Not Started) y superposición temporal con la ventana de 4 semanas según el cronograma.
            </span>
            <span className="font-mono">
              Mostrando {totalCurrentPackages} paquetes en la jerarquía activa
            </span>
          </div>

          {/* Gráfico Dinámico de Cantidades de Obra Programadas por Mes (Mes Seleccionado + 4 Meses) Agrupado por SCAP y por Componente */}
          {selectedComponentFilter !== 'all' ? (
            <GraficoCantidadesProgramadasScap
              actividades={filteredP6Actividades}
              dataPlanificadoPG004={dataPlanificadoPG004}
              selectedMonthKey={selectedMonthKey}
              onMonthChange={setSelectedMonthKey}
              availableMonths={availableMonths}
              fourWeeks={fourWeeks}
              selectedComponentFilter={selectedComponentFilter}
              onComponentChange={setSelectedComponentFilter}
              allComponentNames={allComponentNames}
              selectedCapFilter={selectedCapFilter}
              selectedUbicacionFilter={selectedUbicacionFilter}
              dateMode={dateMode}
              isProcuraFilter={isProcuraFilter}
              onToggleProcura={() => setIsProcuraFilter(prev => !prev)}
              isFleteFilter={isFleteFilter}
              onToggleFlete={() => setIsFleteFilter(prev => !prev)}
              isMontajeFilter={isMontajeFilter}
              onToggleMontaje={() => setIsMontajeFilter(prev => !prev)}
              isConstruccionFilter={isConstruccionFilter}
              onToggleConstruccion={() => setIsConstruccionFilter(prev => !prev)}
              onResetTypeFilters={() => {
                setIsProcuraFilter(false);
                setIsFleteFilter(false);
                setIsMontajeFilter(false);
                setIsConstruccionFilter(false);
              }}
            />
          ) : (
            <div className="mt-8 border-t-2 border-slate-200/80 pt-6">
              <div className="bg-gradient-to-r from-slate-50 via-indigo-50/30 to-slate-50 border border-slate-200/90 rounded-2xl p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-200 shrink-0">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-2 flex-wrap">
                        Cantidades de Obra Programadas por Mes
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 uppercase tracking-wider">
                          Optimización de Rendimiento
                        </span>
                      </h4>
                    </div>
                  </div>

                  {allComponentNames.length > 0 && (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <span className="text-xs font-bold text-slate-600 shrink-0">Elegir Componente:</span>
                      <select
                        value={selectedComponentFilter}
                        onChange={(e) => setSelectedComponentFilter(e.target.value)}
                        className="text-xs font-bold text-indigo-700 bg-white border border-indigo-200 rounded-xl py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs cursor-pointer w-full sm:w-auto"
                      >
                        <option value="all">Seleccionar un Componente...</option>
                        {allComponentNames.map(cn => (
                          <option key={cn} value={cn}>
                            {cn}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};
