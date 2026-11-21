import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import {
  BarChart3,
  Filter,
  Calendar,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Table as TableIcon,
  Copy,
  Check,
  Info,
  Package,
  TrendingUp,
  Sparkles,
  ShoppingCart,
  Truck,
  Wrench,
  HardHat
} from 'lucide-react';
import { Actividad } from '../types';

export interface WeekInterval {
  weekNum: number;
  label: string;
  start: Date;
  end: Date;
  dateKey?: string;
}

export interface MonthInterval {
  key: string; // '2026-09'
  year: number;
  monthIdx: number; // 0-11
  label: string; // 'Septiembre 2026'
  shortLabel: string; // 'Sep 26'
  start: Date;
  end: Date;
  isBaseMonth: boolean;
  offset: number; // 0 for base, 1 for +1, etc.
}

export interface ScapStageCardItem {
  scap: string;
  unit: string;
  sumPFM: number;
  activeQty: number;
  activeLabel: string;
  activeStageKey: 'all' | 'procura' | 'flete' | 'montaje' | 'construccion' | 'mixed';
  procura: number;
  flete: number;
  montaje: number;
  construccion: number;
  hasProcura: boolean;
  hasFlete: boolean;
  hasMontaje: boolean;
  hasConstruccion: boolean;
}

export interface GraficoCantidadesProgramadasScapProps {
  actividades: Actividad[];
  dataPlanificadoPG004?: Record<string, Record<string, number>>;
  selectedMonthKey: string;
  onMonthChange?: (monthKey: string) => void;
  availableMonths?: Array<{ key: string; label: string }>;
  fourWeeks?: WeekInterval[];
  selectedComponentFilter: string;
  onComponentChange?: (comp: string) => void;
  allComponentNames?: string[];
  selectedCapFilter?: string;
  selectedUbicacionFilter?: string;
  dateMode?: 'bl' | 'actual';
  // Filtros de Tipo / Etapa de Actividad
  isProcuraFilter?: boolean;
  onToggleProcura?: () => void;
  isFleteFilter?: boolean;
  onToggleFlete?: () => void;
  isMontajeFilter?: boolean;
  onToggleMontaje?: () => void;
  isConstruccionFilter?: boolean;
  onToggleConstruccion?: () => void;
  onResetTypeFilters?: () => void;
}

const SCAP_PALETTE = [
  '#CD0000', // Indigo
  '#0284c7', // Sky
  '#059669', // Emerald
  '#d97706', // Amber
  '#db2777', // Pink
  '#7c3aed', // Purple
  '#0d9488', // Teal
  '#ea580c', // Orange
  '#2563eb', // Blue
  '#65a30d', // Lime
  '#9333ea', // Violet
  '#0891b2', // Cyan
  '#c026d3', // Fuchsia
  '#475569', // Slate
  '#b45309', // Warm amber
  '#15803d', // Dark green
  '#3b82f6', // Bright blue
  '#10b981', // Emerald light
  '#f59e0b', // Amber bright
  '#ec4899', // Pink bright
];

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const MONTH_SHORT_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

function normalizeStr(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseDateHelper(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return new Date(val.getFullYear(), val.getMonth(), val.getDate(), 12, 0, 0);
  }
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s) return null;
    const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10), 12, 0, 0);
    }
    const dmyMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dmyMatch) {
      return new Date(parseInt(dmyMatch[3], 10), parseInt(dmyMatch[2], 10) - 1, parseInt(dmyMatch[1], 10), 12, 0, 0);
    }
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  if (typeof val === 'number' && !isNaN(val) && val > 30000 && val < 60000) {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + val * 86400000);
  }
  return null;
}

export const GraficoCantidadesProgramadasScap: React.FC<GraficoCantidadesProgramadasScapProps> = ({
  actividades,
  dataPlanificadoPG004,
  selectedMonthKey,
  onMonthChange,
  availableMonths = [],
  selectedComponentFilter,
  onComponentChange,
  allComponentNames = [],
  selectedCapFilter = 'all',
  selectedUbicacionFilter = 'all',
  dateMode = 'bl',
  isProcuraFilter: isProcuraFilterProp,
  onToggleProcura,
  isFleteFilter: isFleteFilterProp,
  onToggleFlete,
  isMontajeFilter: isMontajeFilterProp,
  onToggleMontaje,
  isConstruccionFilter: isConstruccionFilterProp,
  onToggleConstruccion,
  onResetTypeFilters,
}) => {
  // Presentation modes
  const [showDataTable, setShowDataTable] = useState<boolean>(false);
  const [copiedTable, setCopiedTable] = useState<boolean>(false);

  // Local fallback states for activity types (Procura, Flete, Montaje, Construcción)
  const [localIsProcura, setLocalIsProcura] = useState<boolean>(false);
  const [localIsFlete, setLocalIsFlete] = useState<boolean>(false);
  const [localIsMontaje, setLocalIsMontaje] = useState<boolean>(false);
  const [localIsConstruccion, setLocalIsConstruccion] = useState<boolean>(false);

  const effectiveIsProcura = isProcuraFilterProp !== undefined ? isProcuraFilterProp : localIsProcura;
  const effectiveIsFlete = isFleteFilterProp !== undefined ? isFleteFilterProp : localIsFlete;
  const effectiveIsMontaje = isMontajeFilterProp !== undefined ? isMontajeFilterProp : localIsMontaje;
  const effectiveIsConstruccion = isConstruccionFilterProp !== undefined ? isConstruccionFilterProp : localIsConstruccion;

  const toggleProcura = () => {
    if (onToggleProcura) onToggleProcura();
    else setLocalIsProcura(p => !p);
  };
  const toggleFlete = () => {
    if (onToggleFlete) onToggleFlete();
    else setLocalIsFlete(p => !p);
  };
  const toggleMontaje = () => {
    if (onToggleMontaje) onToggleMontaje();
    else setLocalIsMontaje(p => !p);
  };
  const toggleConstruccion = () => {
    if (onToggleConstruccion) onToggleConstruccion();
    else setLocalIsConstruccion(p => !p);
  };
  const resetTypeFilters = () => {
    if (onResetTypeFilters) {
      onResetTypeFilters();
    } else {
      setLocalIsProcura(false);
      setLocalIsFlete(false);
      setLocalIsMontaje(false);
      setLocalIsConstruccion(false);
    }
  };

  // Active component filter
  const activeComponent = selectedComponentFilter || 'all';

  // Selection of active SCAPs (only those checked will be in the stacked bars)
  const [selectedScaps, setSelectedScaps] = useState<Set<string>>(new Set());
  const [userHasCustomizedScaps, setUserHasCustomizedScaps] = useState<boolean>(false);
  const [isScapCardsExpanded, setIsScapCardsExpanded] = useState<boolean>(false);
  const prevComponentRef = useRef<string>(activeComponent);

  // 1. Build the 5-month window: [Mes Seleccionado, +1, +2, +3, +4]
  const fiveMonths: MonthInterval[] = useMemo(() => {
    const baseKey = selectedMonthKey || '2026-09';
    const [yStr, mStr] = baseKey.split('-');
    const baseYear = parseInt(yStr, 10) || 2026;
    const baseMonthIdx = (parseInt(mStr, 10) || 9) - 1; // 0-indexed

    const months: MonthInterval[] = [];
    for (let offset = 0; offset < 5; offset++) {
      const d = new Date(baseYear, baseMonthIdx + offset, 1, 0, 0, 0);
      const yr = d.getFullYear();
      const mIdx = d.getMonth();
      const key = `${yr}-${String(mIdx + 1).padStart(2, '0')}`;
      const start = new Date(yr, mIdx, 1, 0, 0, 0);
      const end = new Date(yr, mIdx + 1, 0, 23, 59, 59, 999);

      months.push({
        key,
        year: yr,
        monthIdx: mIdx,
        label: `${MONTH_NAMES_ES[mIdx]} ${yr}`,
        shortLabel: `${MONTH_SHORT_ES[mIdx]} ${String(yr).slice(-2)}`,
        start,
        end,
        isBaseMonth: offset === 0,
        offset,
      });
    }
    return months;
  }, [selectedMonthKey]);

  // Window start and end dates
  const windowStartDate = fiveMonths[0]?.start || new Date();
  const windowEndDate = fiveMonths[4]?.end || new Date();

  // Current Month Label (for headers and badges)
  const currentMonthLabel = useMemo(() => {
    const found = availableMonths.find(m => m.key === selectedMonthKey);
    if (found) return found.label;
    return fiveMonths[0]?.label || selectedMonthKey;
  }, [availableMonths, selectedMonthKey, fiveMonths]);

  // Current Month Index in availableMonths for navigation
  const currentMonthIndex = useMemo(() => {
    return availableMonths.findIndex(m => m.key === selectedMonthKey);
  }, [availableMonths, selectedMonthKey]);

  const handlePrevMonth = () => {
    if (!onMonthChange) return;
    if (currentMonthIndex > 0) {
      onMonthChange(availableMonths[currentMonthIndex - 1].key);
    } else if (fiveMonths[0]) {
      const d = new Date(fiveMonths[0].year, fiveMonths[0].monthIdx - 1, 1);
      const prevKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      onMonthChange(prevKey);
    }
  };

  const handleNextMonth = () => {
    if (!onMonthChange) return;
    if (currentMonthIndex >= 0 && currentMonthIndex < availableMonths.length - 1) {
      onMonthChange(availableMonths[currentMonthIndex + 1].key);
    } else if (fiveMonths[0]) {
      const d = new Date(fiveMonths[0].year, fiveMonths[0].monthIdx + 1, 1);
      const nextKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      onMonthChange(nextKey);
    }
  };

  // 2. Aggregate monthly quantities strictly for the selected component (or all)
  const {
    monthlyData,
    scapsInComponent,
    allScapList,
    componentsWithData,
    scapUnits,
    scapTotalsInPeriod,
    componentTotalsInPeriod,
    totalPeriodQuantity,
    baseMonthQuantity,
    peakMonthInfo,
    typeCounts,
    scapStageCards,
  } = useMemo(() => {
    if (!actividades || actividades.length === 0 || fiveMonths.length === 0 || !activeComponent || activeComponent === 'all') {
      return {
        monthlyData: [],
        scapsInComponent: [] as string[],
        allScapList: [] as string[],
        componentsWithData: [] as string[],
        scapUnits: {} as Record<string, string>,
        scapTotalsInPeriod: {} as Record<string, number>,
        componentTotalsInPeriod: {} as Record<string, number>,
        totalPeriodQuantity: 0,
        baseMonthQuantity: 0,
        peakMonthInfo: null as { label: string; total: number } | null,
        typeCounts: { total: 0, procura: 0, flete: 0, montaje: 0, construccion: 0 },
        scapStageCards: [] as ScapStageCardItem[],
      };
    }

    const typeCounts = {
      total: 0,
      procura: 0,
      flete: 0,
      montaje: 0,
      construccion: 0,
    };

    const scapUnitCounts: Record<string, Record<string, number>> = {};
    const scapPeriodTotals: Record<string, number> = {};
    const compPeriodTotals: Record<string, number> = {};
    const compsWithDataFound = new Set<string>();
    const allScapsFound = new Set<string>();

    // Accumulator for SCAP stage breakdown across the 5 months
    const scapStageMap: Record<string, {
      scap: string;
      procura: number;
      flete: number;
      montaje: number;
      construccion: number;
      hasProcura: boolean;
      hasFlete: boolean;
      hasMontaje: boolean;
      hasConstruccion: boolean;
    }> = {};

    // 5 months accumulator: monthIdx -> { scapName -> qty }
    const monthScapQuantities: Array<Record<string, number>> = fiveMonths.map(() => ({}));
    const monthCompQuantities: Array<Record<string, number>> = fiveMonths.map(() => ({}));

    // Pre-normalize component filter for fast and strict matching
    const targetCompNorm = activeComponent !== 'all' ? normalizeStr(activeComponent) : null;

    actividades.forEach(a => {
      // Must be a leaf activity
      if (!a.esItemHoja) return;

      // Ubicación filter
      if (selectedUbicacionFilter !== 'all') {
        const u = String(a.ubicacion || '').trim();
        if (u && !u.toLowerCase().includes(selectedUbicacionFilter.toLowerCase())) {
          return;
        }
      }

      // CAP filter
      const rawCap = String(a.cap || (a as any).capitulo || '').trim();
      const capName = rawCap || '(Sin CAP)';
      if (selectedCapFilter !== 'all' && capName !== selectedCapFilter) {
        return;
      }

      // Componente
      const rawComp = String(a.componente || '').trim();
      const compName = rawComp || '(Sin Componente)';
      const compNorm = normalizeStr(compName);

      // Track all components seen in the leaf activities
      compsWithDataFound.add(compName);

      // STRICT COMPONENT FILTER:
      // If a component is selected (e.g. Mecánico y Montaje), EXCLUDE any activity that does not belong to it!
      // This prevents "Urbanismo" or any other non-related package from leaking into the data.
      if (targetCompNorm !== null && compNorm !== targetCompNorm) {
        return;
      }

      // Activity Type: Procura (Compr*), Flete (Flete*), Montaje (Inst*), Construcción (demás partidas)
      const cleanDesc = (a.descripcion || (a as any).activityName || '').trim().replace(/^["'«\s\-\.]*/, '');
      const isM = /^inst/i.test(cleanDesc);
      const isP = /^compr/i.test(cleanDesc);
      const isF = /^flete/i.test(cleanDesc);
      const isC = !isM && !isP && !isF;

      typeCounts.total++;
      if (isP) typeCounts.procura++;
      else if (isF) typeCounts.flete++;
      else if (isM) typeCounts.montaje++;
      else typeCounts.construccion++;

      // Filter by Activity Type if one or more filters are active
      const hasTypeFilter = effectiveIsMontaje || effectiveIsProcura || effectiveIsFlete || effectiveIsConstruccion;
      let matchesTypeFilter = true;
      if (hasTypeFilter) {
        const matchesMontaje = effectiveIsMontaje && isM;
        const matchesProcura = effectiveIsProcura && isP;
        const matchesFlete = effectiveIsFlete && isF;
        const matchesConstruccion = effectiveIsConstruccion && isC;
        matchesTypeFilter = Boolean(matchesMontaje || matchesProcura || matchesFlete || matchesConstruccion);
      }

      // SCAP
      const rawScap = String(a.scap || (a as any).paqueteScap || '').trim();
      const scapName = rawScap || '(Sin SCAP)';
      if (matchesTypeFilter) {
        allScapsFound.add(scapName);
      }

      // Unit tracking
      const rawUnidad = String(a.unidad ?? a.unit ?? (a as any).unitAgregado ?? '').trim();
      if (rawUnidad) {
        if (!scapUnitCounts[scapName]) scapUnitCounts[scapName] = {};
        scapUnitCounts[scapName][rawUnidad] = (scapUnitCounts[scapName][rawUnidad] || 0) + 1;
      }

      // Price: Columna G CDO
      const rawPrecio = (a as any).precio !== undefined && (a as any).precio !== null && !isNaN((a as any).precio) && (a as any).precio > 0
        ? (a as any).precio
        : ((a as any).precioCdo !== undefined && (a as any).precioCdo !== null && !isNaN((a as any).precioCdo) && (a as any).precioCdo > 0
          ? (a as any).precioCdo
          : (a.venta && a.cantidadCdo && a.cantidadCdo > 0 ? a.venta / a.cantidadCdo : null));

      // Step: Columna H CDO
      const rawStep = (a as any).step !== undefined && (a as any).step !== null && !isNaN((a as any).step) && (a as any).step > 0
        ? (a as any).step
        : 1;

      // Dates based on dateMode ('bl' vs 'actual')
      const blS = parseDateHelper(a.blStart);
      const blF = parseDateHelper(a.blFinish);
      const actS = parseDateHelper(a.start);
      const actF = parseDateHelper(a.finish);

      const targetStart = dateMode === 'bl' ? (blS || actS) : (actS || blS);
      const targetFinish = dateMode === 'bl' ? (blF || actF) : (actF || blF);

      // Total Cantidad de Obra
      const cantObraTotal = (a.cantidadCdo !== undefined && a.cantidadCdo !== null && !isNaN(a.cantidadCdo) && a.cantidadCdo > 0)
        ? a.cantidadCdo
        : (typeof (a as any).cantidad === 'number' && !isNaN((a as any).cantidad) && (a as any).cantidad > 0 ? (a as any).cantidad : 0);

      // Planificado PG-004
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

      // Distribute quantities across the 5 months
      let act5MonthSum = 0;
      fiveMonths.forEach((m, mIdx) => {
        let monthVal = 0;
        let isFromPG004 = false;

        // 1. Economic plan in PG-004 falling within this month
        if (actPlanPG004 && Object.keys(actPlanPG004).length > 0) {
          Object.entries(actPlanPG004).forEach(([dateStr, val]) => {
            if (dateStr === 'total') return;
            const num = Number(val) || 0;
            if (num <= 0) return;

            // Direct key match (e.g. '2026-09')
            if (dateStr === m.key) {
              monthVal += num;
              isFromPG004 = true;
              return;
            }

            // Date match within month bounds
            const d = parseDateHelper(dateStr);
            if (d && d >= m.start && d <= m.end) {
              monthVal += num;
              isFromPG004 = true;
            }
          });
        }

        let cantMonth = 0;
        if (isFromPG004 && monthVal > 0 && rawPrecio && rawPrecio > 0) {
          cantMonth = (monthVal / rawPrecio) / rawStep;
        } else if (targetStart && targetFinish && targetFinish >= targetStart) {
          // Fallback: Schedule date overlap with this month
          const segStart = targetStart > m.start ? targetStart : m.start;
          const segEnd = targetFinish < m.end ? targetFinish : m.end;

          if (segEnd >= segStart && cantObraTotal > 0) {
            const overlapDays = Math.max(1, Math.round((segEnd.getTime() - segStart.getTime()) / 86400000) + 1);
            const totalSpanDays = Math.max(1, Math.round((targetFinish.getTime() - targetStart.getTime()) / 86400000) + 1);
            const prop = Math.min(1, overlapDays / totalSpanDays);
            cantMonth = cantObraTotal * prop;
          }
        }

        if (cantMonth > 0 && !isNaN(cantMonth)) {
          act5MonthSum += cantMonth;

          // Add to monthly SCAP quantity ONLY if it matches the active type filter
          if (matchesTypeFilter) {
            monthScapQuantities[mIdx][scapName] = (monthScapQuantities[mIdx][scapName] || 0) + cantMonth;
            scapPeriodTotals[scapName] = (scapPeriodTotals[scapName] || 0) + cantMonth;

            // Add to monthly Component quantity
            monthCompQuantities[mIdx][compName] = (monthCompQuantities[mIdx][compName] || 0) + cantMonth;
            compPeriodTotals[compName] = (compPeriodTotals[compName] || 0) + cantMonth;
          }
        }
      });

      // Accumulate 5-month totals by stage for this SCAP
      if (!scapStageMap[scapName]) {
        scapStageMap[scapName] = {
          scap: scapName,
          procura: 0,
          flete: 0,
          montaje: 0,
          construccion: 0,
          hasProcura: false,
          hasFlete: false,
          hasMontaje: false,
          hasConstruccion: false,
        };
      }
      if (isP) {
        scapStageMap[scapName].hasProcura = true;
        scapStageMap[scapName].procura += act5MonthSum;
      } else if (isF) {
        scapStageMap[scapName].hasFlete = true;
        scapStageMap[scapName].flete += act5MonthSum;
      } else if (isM) {
        scapStageMap[scapName].hasMontaje = true;
        scapStageMap[scapName].montaje += act5MonthSum;
      } else {
        scapStageMap[scapName].hasConstruccion = true;
        scapStageMap[scapName].construccion += act5MonthSum;
      }
    });

    // Determine best unit per SCAP
    const finalScapUnits: Record<string, string> = {};
    Object.entries(scapUnitCounts).forEach(([scap, units]) => {
      let bestUnit = '';
      let bestCount = 0;
      Object.entries(units).forEach(([u, cnt]) => {
        if (cnt > bestCount) {
          bestCount = cnt;
          bestUnit = u;
        }
      });
      finalScapUnits[scap] = bestUnit;
    });

    // SCAPs strictly belonging to the active selection and having planned quantity > 0
    // (sorted by volume in this 5-month period)
    const validScaps = Array.from(allScapsFound)
      .filter(scap => (scapPeriodTotals[scap] || 0) > 0)
      .sort((a, b) => (scapPeriodTotals[b] || 0) - (scapPeriodTotals[a] || 0));

    // Components sorted by total planned volume
    const sortedComps = Array.from(compsWithDataFound).sort((a, b) => {
      return (compPeriodTotals[b] || 0) - (compPeriodTotals[a] || 0);
    });

    // Build the 5 monthly chart rows
    let grandTotal = 0;
    let baseMonthTotal = 0;
    let peakMonth: { label: string; total: number } | null = null;

    const formattedMonthlyData = fiveMonths.map((m, mIdx) => {
      const row: Record<string, any> = {
        monthKey: m.key,
        label: m.label,
        shortLabel: m.shortLabel,
        isBaseMonth: m.isBaseMonth,
        offset: m.offset,
        _totalMonth: 0,
      };

      let monthSum = 0;
      const scapsThisMonth = monthScapQuantities[mIdx] || {};
      Object.entries(scapsThisMonth).forEach(([scap, qty]) => {
        const rounded = Math.round(qty * 100) / 100;
        row[scap] = rounded;
        monthSum += rounded;
      });

      row._totalMonth = Math.round(monthSum * 100) / 100;
      grandTotal += monthSum;

      if (m.isBaseMonth) {
        baseMonthTotal = monthSum;
      }

      if (!peakMonth || monthSum > peakMonth.total) {
        peakMonth = { label: m.label, total: Math.round(monthSum) };
      }

      return row;
    });

    // Generate SCAP accumulation cards for Procura, Flete and Montaje (and Construcción if active)
    const scapStageCards: ScapStageCardItem[] = Object.values(scapStageMap)
      .filter(item => {
        // Filter strictly to SCAPs related to Procura, Flete or Montaje (or Construcción if active)
        if (effectiveIsMontaje) return item.montaje > 0 || item.hasMontaje;
        if (effectiveIsProcura) return item.procura > 0 || item.hasProcura;
        if (effectiveIsFlete) return item.flete > 0 || item.hasFlete;
        if (effectiveIsConstruccion) return item.construccion > 0 || item.hasConstruccion;
        // When no filter (Todos): strictly SCAPs related to Procura, Flete, and Montaje
        return item.procura > 0 || item.flete > 0 || item.montaje > 0 || item.hasProcura || item.hasFlete || item.hasMontaje;
      })
      .map(item => {
        const unit = finalScapUnits[item.scap] || 'und';
        const sumPFM = Math.round((item.procura + item.flete + item.montaje) * 100) / 100;

        let activeQty = sumPFM;
        let activeLabel = 'Sumatoria (Procura + Flete + Montaje)';
        let activeStageKey: 'all' | 'procura' | 'flete' | 'montaje' | 'construccion' | 'mixed' = 'all';

        const activeCount = (effectiveIsProcura ? 1 : 0) + (effectiveIsFlete ? 1 : 0) + (effectiveIsMontaje ? 1 : 0) + (effectiveIsConstruccion ? 1 : 0);

        if (activeCount === 1) {
          if (effectiveIsMontaje) {
            activeQty = Math.round(item.montaje * 100) / 100;
            activeLabel = 'A Instalar (Montaje)';
            activeStageKey = 'montaje';
          } else if (effectiveIsProcura) {
            activeQty = Math.round(item.procura * 100) / 100;
            activeLabel = 'A Comprar (Procura)';
            activeStageKey = 'procura';
          } else if (effectiveIsFlete) {
            activeQty = Math.round(item.flete * 100) / 100;
            activeLabel = 'A Transportar (Flete)';
            activeStageKey = 'flete';
          } else if (effectiveIsConstruccion) {
            activeQty = Math.round(item.construccion * 100) / 100;
            activeLabel = 'Construcción';
            activeStageKey = 'construccion';
          }
        } else if (activeCount > 1) {
          activeStageKey = 'mixed';
          activeQty = Math.round((
            (effectiveIsProcura ? item.procura : 0) +
            (effectiveIsFlete ? item.flete : 0) +
            (effectiveIsMontaje ? item.montaje : 0) +
            (effectiveIsConstruccion ? item.construccion : 0)
          ) * 100) / 100;
          activeLabel = 'Etapas Seleccionadas';
        }

        return {
          scap: item.scap,
          unit,
          sumPFM,
          activeQty,
          activeLabel,
          activeStageKey,
          procura: Math.round(item.procura * 100) / 100,
          flete: Math.round(item.flete * 100) / 100,
          montaje: Math.round(item.montaje * 100) / 100,
          construccion: Math.round(item.construccion * 100) / 100,
          hasProcura: item.hasProcura,
          hasFlete: item.hasFlete,
          hasMontaje: item.hasMontaje,
          hasConstruccion: item.hasConstruccion,
        };
      })
      .sort((a, b) => b.activeQty - a.activeQty);

    return {
      monthlyData: formattedMonthlyData,
      scapsInComponent: validScaps,
      allScapList: validScaps,
      componentsWithData: sortedComps,
      scapUnits: finalScapUnits,
      scapTotalsInPeriod: scapPeriodTotals,
      componentTotalsInPeriod: compPeriodTotals,
      totalPeriodQuantity: Math.round(grandTotal),
      baseMonthQuantity: Math.round(baseMonthTotal),
      peakMonthInfo: peakMonth,
      typeCounts,
      scapStageCards,
    };
  }, [actividades, dataPlanificadoPG004, fiveMonths, activeComponent, selectedCapFilter, selectedUbicacionFilter, dateMode, effectiveIsMontaje, effectiveIsProcura, effectiveIsFlete, effectiveIsConstruccion]);

  // Synchronize SCAP selection when component changes:
  // Automatically select the active SCAPs of the selected component
  useEffect(() => {
    if (prevComponentRef.current !== activeComponent) {
      prevComponentRef.current = activeComponent;
      setUserHasCustomizedScaps(false);
      // Select all SCAPs of this component
      setSelectedScaps(new Set(scapsInComponent));
    } else if (!userHasCustomizedScaps) {
      setSelectedScaps(new Set(scapsInComponent));
    }
  }, [activeComponent, scapsInComponent, userHasCustomizedScaps]);

  // SCAP color mapping based on index (covers both scapsInComponent and any card in scapStageCards)
  const scapColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    scapsInComponent.forEach((scap, idx) => {
      map[scap] = SCAP_PALETTE[idx % SCAP_PALETTE.length];
    });
    scapStageCards.forEach((card, idx) => {
      if (!map[card.scap]) {
        map[card.scap] = SCAP_PALETTE[(scapsInComponent.length + idx) % SCAP_PALETTE.length];
      }
    });
    return map;
  }, [scapsInComponent, scapStageCards]);

  // Active SCAPs array: STRICTLY only SCAPs that are in scapsInComponent AND are selected
  // This guarantees no other SCAP (like Urbanismo) can ever be rendered in the stacked bars
  const activeScapsArray = useMemo(() => {
    return scapsInComponent.filter(s => selectedScaps.has(s));
  }, [scapsInComponent, selectedScaps]);

  // Handlers for SCAP selection
  const toggleScap = (scap: string) => {
    setUserHasCustomizedScaps(true);
    setSelectedScaps(prev => {
      const next = new Set(prev);
      if (next.has(scap)) next.delete(scap);
      else next.add(scap);
      return next;
    });
  };

  const selectSingleScap = (scap: string) => {
    setUserHasCustomizedScaps(true);
    setSelectedScaps(new Set([scap]));
  };

  const selectTopN = (n: number) => {
    setUserHasCustomizedScaps(true);
    setSelectedScaps(new Set(scapsInComponent.slice(0, n)));
  };

  const selectAll = () => {
    setUserHasCustomizedScaps(true);
    setSelectedScaps(new Set(scapsInComponent));
  };

  const selectNone = () => {
    setUserHasCustomizedScaps(true);
    setSelectedScaps(new Set());
  };

  // Determine current value of the SCAP dropdown
  const currentScapDropdownValue = useMemo(() => {
    if (scapsInComponent.length === 0) return 'none';
    if (selectedScaps.size === scapsInComponent.length) return 'all';
    if (selectedScaps.size === 1) {
      const single = Array.from(selectedScaps)[0];
      if (scapsInComponent.includes(single)) return single;
    }
    if (selectedScaps.size === 5 && scapsInComponent.length > 5 && scapsInComponent.slice(0, 5).every(s => selectedScaps.has(s))) {
      return 'top5';
    }
    if (selectedScaps.size === 10 && scapsInComponent.length > 10 && scapsInComponent.slice(0, 10).every(s => selectedScaps.has(s))) {
      return 'top10';
    }
    return 'custom';
  }, [selectedScaps, scapsInComponent]);

  const handleScapDropdownChange = (val: string) => {
    setUserHasCustomizedScaps(true);
    if (val === 'all') {
      setSelectedScaps(new Set(scapsInComponent));
    } else if (val === 'top5') {
      setSelectedScaps(new Set(scapsInComponent.slice(0, 5)));
    } else if (val === 'top10') {
      setSelectedScaps(new Set(scapsInComponent.slice(0, 10)));
    } else if (val === 'none') {
      setSelectedScaps(new Set());
    } else {
      setSelectedScaps(new Set([val]));
    }
  };

  // Component change handler
  const handleComponentChange = (newComp: string) => {
    setUserHasCustomizedScaps(false);
    if (onComponentChange) {
      onComponentChange(newComp);
    }
  };

  // Filtered Chart Data: Each row represents one of the 5 months,
  // populated ONLY with the active SCAPs of the selection
  const filteredChartData = useMemo(() => {
    return monthlyData.map(item => {
      const row: Record<string, any> = {
        monthKey: item.monthKey,
        label: item.label,
        shortLabel: item.shortLabel,
        isBaseMonth: item.isBaseMonth,
        offset: item.offset,
        _totalSelected: 0,
      };

      let monthTotal = 0;
      activeScapsArray.forEach(scap => {
        const val = item[scap] || 0;
        row[scap] = val;
        monthTotal += val;
      });

      row._totalSelected = Math.round(monthTotal * 100) / 100;
      return row;
    });
  }, [monthlyData, activeScapsArray]);

  // Total quantity in current view across the 5 months
  const currentFilteredTotal = useMemo(() => {
    return filteredChartData.reduce((acc, r) => acc + (r._totalSelected || 0), 0);
  }, [filteredChartData]);

  // Base month quantity in current selection
  const baseMonthFilteredTotal = useMemo(() => {
    const baseRow = filteredChartData.find(r => r.isBaseMonth);
    return baseRow ? baseRow._totalSelected : 0;
  }, [filteredChartData]);

  // Copy table to clipboard as TSV
  const handleCopyTable = () => {
    const headers = ['Mes', 'Período', ...activeScapsArray, 'Total Mes'];
    const rows = filteredChartData.map(d => {
      const line = [
        d.label,
        d.isBaseMonth ? 'Mes Base Seleccionado' : `Mes +${d.offset}`,
        ...activeScapsArray.map(scap => (d[scap] ? d[scap].toLocaleString('es-ES') : '0')),
        d._totalSelected.toLocaleString('es-ES')
      ];
      return line.join('\t');
    });

    const summaryLine = [
      'TOTAL PERÍODO (5 MESES)',
      '-',
      ...activeScapsArray.map(scap => {
        const total = filteredChartData.reduce((acc, d) => acc + (d[scap] || 0), 0);
        return total.toLocaleString('es-ES');
      }),
      currentFilteredTotal.toLocaleString('es-ES')
    ];

    const tsv = [headers.join('\t'), ...rows, summaryLine.join('\t')].join('\n');
    navigator.clipboard.writeText(tsv).then(() => {
      setCopiedTable(true);
      setTimeout(() => setCopiedTable(false), 2500);
    });
  };

  // Custom Tick for the X Axis: Mes + Distintivo para el Mes Base
  const renderCustomAxisTick = ({ x, y, payload }: any) => {
    const item = filteredChartData.find(d => d.label === payload.value || d.shortLabel === payload.value || d.monthKey === payload.value);
    const isBase = item?.isBaseMonth;

    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={15}
          textAnchor="middle"
          fill={isBase ? '#A80000' : '#1e293b'}
          fontSize={12}
          fontWeight={isBase ? 900 : 700}
          fontFamily="inherit"
        >
          {item?.label || payload.value}
        </text>
        <text
          x={0}
          y={0}
          dy={30}
          textAnchor="middle"
          fill={isBase ? '#D93030' : '#94a3b8'}
          fontSize={10}
          fontWeight={isBase ? 800 : 600}
          fontFamily="inherit"
        >
          {isBase ? '★ Mes Seleccionado' : `Mes +${item?.offset || 0}`}
        </text>
      </g>
    );
  };

  // Custom Chart Tooltip
  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const dataItem = payload[0]?.payload;
    const monthLabel = dataItem?.label || label;
    const isBase = dataItem?.isBaseMonth;

    // Filter items with quantity > 0 and sort descending
    const items = payload
      .filter((p: any) => typeof p.value === 'number' && p.value > 0)
      .sort((a: any, b: any) => b.value - a.value);

    const monthTotal = items.reduce((acc: number, cur: any) => acc + cur.value, 0);

    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/80 rounded-xl p-3.5 shadow-2xl text-xs max-w-xs sm:max-w-sm pointer-events-none">
        <div className="border-b border-slate-700/80 pb-2 mb-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-extrabold text-sm text-slate-100">{monthLabel}</span>
            </div>
            {isBase && (
              <span className="px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-300 font-extrabold text-[9.5px] uppercase tracking-wider border border-indigo-500/40">
                Mes Base
              </span>
            )}
          </div>
          <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
            <span>Total Programado:</span>
            <span className="font-mono text-indigo-300 font-extrabold">
              {monthTotal.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-slate-400 italic py-1 text-center text-[11px]">
            Sin cantidades programadas para los SCAPs activos en este mes
          </div>
        ) : (
          <div className="space-y-1">
            {items.map((entry: any) => {
              const scapName = entry.dataKey;
              const unit = scapUnits[scapName] || '';
              return (
                <div key={scapName} className="flex items-center justify-between gap-3 text-[11px]">
                  <div className="flex items-center gap-1.5 truncate max-w-[190px]">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-slate-200 font-medium truncate" title={scapName}>
                      {scapName}
                    </span>
                  </div>
                  <div className="font-mono font-bold text-right shrink-0">
                    <span className="text-white">
                      {entry.value.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </span>
                    {unit && (
                      <span className="text-slate-400 text-[9.5px] ml-1 font-sans">
                        {unit}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (!actividades || actividades.length === 0 || !activeComponent || activeComponent === 'all') {
    return null;
  }

  return (
    <div className="mt-8 border-t-2 border-slate-200/80 pt-6">
      {/* Header with Title and Mode Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
              Cantidades de Obra Programadas por Mes
              <span className="text-[10.5px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 uppercase tracking-wider">
                Mes Seleccionado + 4 Meses
              </span>
              <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
                SCAPs Dinámicos por Componente
              </span>
            </h3>
          </div>
        </div>

        {/* Month Selector & Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
          {/* Synchronized Month Navigation */}
          <div className="inline-flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-slate-100 disabled:opacity-40 text-slate-600 hover:text-slate-900 rounded-lg transition-all cursor-pointer"
              title="Mover ventana 1 mes atrás"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 px-2">
              <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              {availableMonths.length > 0 && onMonthChange ? (
                <select
                  value={selectedMonthKey}
                  onChange={(e) => onMonthChange(e.target.value)}
                  className="bg-transparent text-xs font-black text-slate-800 py-1.5 focus:outline-hidden cursor-pointer"
                >
                  {availableMonths.map(m => (
                    <option key={m.key} value={m.key}>
                      {m.label} (+ 4 meses)
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs font-black text-slate-800 py-1.5">
                  {currentMonthLabel} (+ 4 meses)
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-slate-100 disabled:opacity-40 text-slate-600 hover:text-slate-900 rounded-lg transition-all cursor-pointer"
              title="Mover ventana 1 mes adelante"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Table view toggle */}
          <button
            type="button"
            onClick={() => setShowDataTable(!showDataTable)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
              showDataTable
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>{showDataTable ? 'Ocultar Tabla' : 'Ver Tabla'}</span>
          </button>
        </div>
      </div>

      {/* Component Selection Bar & SCAP Dropdown */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 my-4 shadow-2xs space-y-3">
        {/* Row 1: Active Component Header & Switchers */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-xs font-extrabold text-slate-800">
              Componente Activo:
            </span>
            <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200">
              {activeComponent}
            </span>
            <span className="text-[10.5px] text-slate-400 font-medium">
              ({scapsInComponent.length} paquetes SCAP detectados)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {(allComponentNames.length > 1 || componentsWithData.length > 1) && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-500">Cambiar:</span>
                <select
                  value={activeComponent}
                  onChange={(e) => handleComponentChange(e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg py-1 px-2.5 focus:outline-hidden cursor-pointer"
                >
                  {(allComponentNames.length > 0 ? allComponentNames : componentsWithData).map(comp => (
                    <option key={comp} value={comp}>
                      {comp}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              type="button"
              onClick={() => handleComponentChange('all')}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-lg py-1 px-2.5 transition-colors cursor-pointer flex items-center gap-1"
              title="Cerrar gráfico y volver a vista general de todos los componentes"
            >
              <span>✕ Cerrar Gráfico</span>
            </button>
          </div>
        </div>

        {/* Row 2: Dropdown de SCAP en la misma tarjeta */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <div className="flex items-center gap-1.5">
              <Package className="w-4 h-4 text-indigo-600 shrink-0" />
              <label htmlFor="dropdown-filtro-scap" className="text-xs font-extrabold text-slate-800 shrink-0">
                Dropdown de SCAP:
              </label>
            </div>

            <select
              id="dropdown-filtro-scap"
              value={currentScapDropdownValue}
              onChange={(e) => handleScapDropdownChange(e.target.value)}
              className="text-xs font-bold text-indigo-950 bg-white border border-indigo-200 rounded-xl py-1.5 px-3 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer min-w-[240px] max-w-full sm:max-w-md transition-all"
            >
              {currentScapDropdownValue === 'custom' && (
                <option value="custom" disabled>
                  Selección personalizada ({selectedScaps.size} SCAPs seleccionados)
                </option>
              )}
              <option value="all">
                Todos los SCAPs de {activeComponent} ({scapsInComponent.length} paquetes)
              </option>
              {scapsInComponent.length > 5 && (
                <option value="top5">⭐ Top 5 SCAPs con mayor volumen</option>
              )}
              {scapsInComponent.length > 10 && (
                <option value="top10">⭐ Top 10 SCAPs con mayor volumen</option>
              )}
              <optgroup label="Paquetes SCAP individuales:">
                {scapsInComponent.map(scap => {
                  const total = scapTotalsInPeriod[scap] || 0;
                  const unit = scapUnits[scap] || '';
                  return (
                    <option key={scap} value={scap}>
                      {scap} {total > 0 ? `(${total.toLocaleString('es-ES', { maximumFractionDigits: 0 })} ${unit})` : ''}
                    </option>
                  );
                })}
              </optgroup>
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-100/70 border border-indigo-200 px-2 py-0.5 rounded-md">
              {activeScapsArray.length} / {scapsInComponent.length} en barras
            </span>
            {selectedScaps.size !== scapsInComponent.length && (
              <button
                type="button"
                onClick={() => handleScapDropdownChange('all')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                title="Mostrar todos los SCAPs de este componente"
              >
                Ver todos
              </button>
            )}
          </div>
        </div>

        {/* Row 3: Horizontal Component Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10.5px] font-semibold text-slate-500 mr-1 shrink-0">
            Alternar componente:
          </span>
          {(allComponentNames.length > 0 ? allComponentNames : componentsWithData).map(comp => {
            const isSelected = activeComponent === comp;
            const total = componentTotalsInPeriod[comp] || 0;

            return (
              <button
                key={comp}
                type="button"
                onClick={() => handleComponentChange(comp)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all border cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs font-extrabold'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 font-bold'
                }`}
              >
                <span>{comp}</span>
                {total > 0 && isSelected && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-indigo-700/80 text-white">
                    {total.toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Ribbon for the 5-Month Window and Selection */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-sans">
            Total Período (5 Meses)
          </span>
          <div className="text-base sm:text-lg font-mono font-extrabold text-indigo-700 mt-0.5">
            {currentFilteredTotal.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-slate-500 font-medium">
            {fiveMonths[0]?.shortLabel} a {fiveMonths[4]?.shortLabel} ({activeScapsArray.length} SCAPs activos)
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-sans">
            Mes Seleccionado ({fiveMonths[0]?.shortLabel})
          </span>
          <div className="text-base sm:text-lg font-mono font-extrabold text-slate-800 mt-0.5">
            {baseMonthFilteredTotal.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-slate-500 font-medium truncate block">
            {activeComponent === 'all' ? 'Todos los componentes' : `Comp: ${activeComponent}`}
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-sans">
            Mes Pico del Período
          </span>
          <div className="text-xs sm:text-sm font-extrabold text-emerald-700 mt-0.5 truncate" title={peakMonthInfo?.label || '-'}>
            {peakMonthInfo ? peakMonthInfo.label : '-'}
          </div>
          <span className="text-[10px] font-mono text-emerald-600 font-semibold block">
            {peakMonthInfo ? `${peakMonthInfo.total.toLocaleString('es-ES')} cant. prog.` : '-'}
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-sans">
            SCAP Mayor Volumen
          </span>
          <div className="text-xs sm:text-sm font-extrabold text-slate-900 mt-0.5 truncate" title={scapsInComponent[0] || '-'}>
            {scapsInComponent[0] || '-'}
          </div>
          <span className="text-[10px] font-mono text-slate-500 font-medium block">
            {scapsInComponent[0] ? `${(scapTotalsInPeriod[scapsInComponent[0]] || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })} ${scapUnits[scapsInComponent[0]] || ''}` : '-'}
          </span>
        </div>
      </div>

      {/* Activity Stage / Type Filter Bar (Procura, Flete, Montaje, Construcción) */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-4 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="text-xs font-extrabold text-slate-800">
              Tipo / Etapa de Actividad:
            </span>
            {(effectiveIsProcura || effectiveIsFlete || effectiveIsMontaje || effectiveIsConstruccion) ? (
              <span className="text-[10.5px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                Filtro activo
              </span>
            ) : (
              <span className="text-[10.5px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                Mostrando todas ({typeCounts.total} act.)
              </span>
            )}
          </div>

          {/* Type Filter Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Todos Button */}
            <button
              type="button"
              id="btn-scap-tipo-todos"
              onClick={resetTypeFilters}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                !effectiveIsProcura && !effectiveIsFlete && !effectiveIsMontaje && !effectiveIsConstruccion
                  ? 'bg-slate-800 text-white border-slate-900 shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
              }`}
              title="Mostrar todas las actividades del componente"
            >
              Todos ({typeCounts.total})
            </button>

            {/* Procura Button */}
            <button
              type="button"
              id="btn-scap-tipo-procura"
              onClick={toggleProcura}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                effectiveIsProcura
                  ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-xs ring-2 ring-blue-300'
                  : 'bg-blue-50/90 hover:bg-blue-100 text-blue-900 border-blue-200 shadow-2xs'
              }`}
              title='Filtrar actividades cuyo nombre inicie por "compr"'
            >
              <ShoppingCart className={`w-3.5 h-3.5 ${effectiveIsProcura ? 'text-white' : 'text-blue-700'}`} />
              <span>Procura</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                effectiveIsProcura ? 'bg-white/20 text-white' : 'bg-blue-200/70 text-blue-900'
              }`}>
                {typeCounts.procura}
              </span>
            </button>

            {/* Flete Button */}
            <button
              type="button"
              id="btn-scap-tipo-flete"
              onClick={toggleFlete}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                effectiveIsFlete
                  ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-600 shadow-xs ring-2 ring-purple-300'
                  : 'bg-purple-50/90 hover:bg-purple-100 text-purple-900 border-purple-200 shadow-2xs'
              }`}
              title='Filtrar actividades cuyo nombre inicie por "flete"'
            >
              <Truck className={`w-3.5 h-3.5 ${effectiveIsFlete ? 'text-white' : 'text-purple-700'}`} />
              <span>Flete</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                effectiveIsFlete ? 'bg-white/20 text-white' : 'bg-purple-200/70 text-purple-900'
              }`}>
                {typeCounts.flete}
              </span>
            </button>

            {/* Montaje Button */}
            <button
              type="button"
              id="btn-scap-tipo-montaje"
              onClick={toggleMontaje}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                effectiveIsMontaje
                  ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600 shadow-xs ring-2 ring-amber-300'
                  : 'bg-amber-50/90 hover:bg-amber-100 text-amber-900 border-amber-200 shadow-2xs'
              }`}
              title='Filtrar actividades cuyo nombre inicie por "inst"'
            >
              <Wrench className={`w-3.5 h-3.5 ${effectiveIsMontaje ? 'text-white' : 'text-amber-700'}`} />
              <span>Montaje</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                effectiveIsMontaje ? 'bg-white/20 text-white' : 'bg-amber-200/70 text-amber-900'
              }`}>
                {typeCounts.montaje}
              </span>
            </button>

            {/* Construcción Button */}
            <button
              type="button"
              id="btn-scap-tipo-construccion"
              onClick={toggleConstruccion}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                effectiveIsConstruccion
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-300'
                  : 'bg-emerald-50/90 hover:bg-emerald-100 text-emerald-900 border-emerald-200 shadow-2xs'
              }`}
              title="Filtrar actividades de Construcción (partidas que no son Procura, Flete ni Montaje)"
            >
              <HardHat className={`w-3.5 h-3.5 ${effectiveIsConstruccion ? 'text-white' : 'text-emerald-700'}`} />
              <span>Construcción</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                effectiveIsConstruccion ? 'bg-white/20 text-white' : 'bg-emerald-200/70 text-emerald-900'
              }`}>
                {typeCounts.construccion}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Tarjetas de Acumulado de Meses Vistos por SCAP (Procura, Flete y Montaje) */}
      {scapStageCards.length > 0 && (
        <div id="seccion-tarjetas-acumulado-scap" className="bg-slate-50/70 border border-slate-200/90 rounded-xl p-2.5 sm:p-3 mb-3 shadow-2xs transition-all">
          {/* Header de la sección de tarjetas (Click para expandir / colapsar) */}
          <div
            onClick={() => setIsScapCardsExpanded(prev => !prev)}
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 cursor-pointer select-none group/header ${
              isScapCardsExpanded ? 'pb-2 mb-2.5 border-b border-slate-200' : ''
            }`}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                className="p-0.5 text-slate-500 group-hover/header:text-indigo-600 rounded transition-colors"
                aria-label={isScapCardsExpanded ? 'Colapsar sección' : 'Expandir sección'}
              >
                {isScapCardsExpanded ? (
                  <ChevronDown className="w-4 h-4 text-indigo-600" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover/header:text-indigo-600" />
                )}
              </button>
              <Package className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <h4 className="text-xs font-extrabold text-slate-800 group-hover/header:text-indigo-900 transition-colors">
                Acumulado 5 Meses ({fiveMonths[0]?.shortLabel} – {fiveMonths[4]?.shortLabel})
              </h4>
              <span className="text-slate-300 hidden sm:inline">|</span>
              <div className="inline-flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                <span className="inline-flex items-center gap-1"><span>🛒</span> Procura</span>
                <span className="text-slate-300 font-light">/</span>
                <span className="inline-flex items-center gap-1"><span>🚚</span> Flete</span>
                <span className="text-slate-300 font-light">/</span>
                <span className="inline-flex items-center gap-1"><span>🔧</span> Montaje</span>
              </div>
            </div>

            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <span className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs">
                {scapStageCards.length} {scapStageCards.length === 1 ? 'SCAP' : 'SCAPs'}
              </span>

              {isScapCardsExpanded && userHasCustomizedScaps && (
                <button
                  type="button"
                  id="btn-restablecer-todos-scap-tarjetas"
                  onClick={selectAll}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
                  title="Restablecer selección a todos los SCAP"
                >
                  Seleccionar Todos
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsScapCardsExpanded(prev => !prev)}
                className="text-[10px] font-semibold text-slate-500 hover:text-indigo-600 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 px-2 py-0.5 rounded cursor-pointer transition-colors flex items-center gap-1"
              >
                <span>{isScapCardsExpanded ? 'Colapsar' : 'Expandir'}</span>
                {isScapCardsExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>

          {/* Grid de Tarjetas SCAP Compactas en una Sola Línea (Colapsable, colapsado por defecto) */}
          {isScapCardsExpanded && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 animate-in fade-in duration-150">
              {scapStageCards.map(card => {
                const color = scapColorMap[card.scap] || '#D93030';
                const isSelected = selectedScaps.has(card.scap);
                const cardId = `tarjeta-scap-${card.scap.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
                const displayUnit = (card.unit === 'und' || card.unit === 'unidad' || card.unit === 'unidades') ? 'u' : card.unit;
                const lowerName = card.scap.trim().toLowerCase();
                const displayName = lowerName === 'bombas' || lowerName === 'bomba'
                  ? 'Bomb.'
                  : lowerName === 'compuestas' || lowerName === 'compuesta'
                  ? 'Comp.'
                  : card.scap;

                return (
                  <div
                    key={card.scap}
                    id={cardId}
                    onClick={() => toggleScap(card.scap)}
                    className={`group relative rounded-lg border py-1.5 px-2.5 transition-all cursor-pointer select-none flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-white border-indigo-300 shadow-2xs ring-1 ring-indigo-500/30'
                        : 'bg-white/60 border-slate-200/80 opacity-50 hover:opacity-100 hover:bg-white'
                    }`}
                    title={`Clic para ${isSelected ? 'ocultar' : 'mostrar'} ${card.scap} en el gráfico`}
                  >
                    {/* Lado izquierdo: Color + Nombre SCAP abreviado + Botón Solo */}
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-bold text-xs text-slate-800 truncate" title={card.scap}>
                        {displayName}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectSingleScap(card.scap);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-[9px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-1 py-0.5 rounded cursor-pointer transition-opacity shrink-0"
                        title={`Enfocar exclusivamente ${card.scap}`}
                      >
                        Solo
                      </button>
                    </div>

                    {/* Lado derecho: Todo en una línea — 🛒 101,5 / 🚚 94,4 / 🔧 7,8 u */}
                    <div className="flex items-center gap-1 text-[11px] font-mono shrink-0 whitespace-nowrap">
                      {/* Procura */}
                      <span
                        className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded transition-colors ${
                          effectiveIsProcura
                            ? 'bg-blue-600 text-white font-bold'
                            : 'text-slate-700 bg-slate-100/80'
                        }`}
                        title={`🛒 Procura: ${card.procura.toLocaleString('es-ES', { maximumFractionDigits: 1 })} ${displayUnit}`}
                      >
                        <span className="text-[10px]">🛒</span>
                        <span>{card.procura.toLocaleString('es-ES', { maximumFractionDigits: 1 })}</span>
                      </span>

                      <span className="text-slate-300 font-sans font-light">/</span>

                      {/* Flete */}
                      <span
                        className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded transition-colors ${
                          effectiveIsFlete
                            ? 'bg-purple-600 text-white font-bold'
                            : 'text-slate-700 bg-slate-100/80'
                        }`}
                        title={`🚚 Flete: ${card.flete.toLocaleString('es-ES', { maximumFractionDigits: 1 })} ${displayUnit}`}
                      >
                        <span className="text-[10px]">🚚</span>
                        <span>{card.flete.toLocaleString('es-ES', { maximumFractionDigits: 1 })}</span>
                      </span>

                      <span className="text-slate-300 font-sans font-light">/</span>

                      {/* Montaje */}
                      <span
                        className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded transition-colors ${
                          effectiveIsMontaje
                            ? 'bg-amber-600 text-white font-bold'
                            : 'text-slate-700 bg-slate-100/80'
                        }`}
                        title={`🔧 Montaje: ${card.montaje.toLocaleString('es-ES', { maximumFractionDigits: 1 })} ${displayUnit}`}
                      >
                        <span className="text-[10px]">🔧</span>
                        <span>{card.montaje.toLocaleString('es-ES', { maximumFractionDigits: 1 })}</span>
                      </span>

                      {/* Construcción si está presente o activa */}
                      {card.construccion > 0 && (effectiveIsConstruccion || (!effectiveIsProcura && !effectiveIsFlete && !effectiveIsMontaje)) && (
                        <>
                          <span className="text-slate-300 font-sans font-light">/</span>
                          <span
                            className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded transition-colors ${
                              effectiveIsConstruccion
                                ? 'bg-emerald-600 text-white font-bold'
                                : 'text-slate-700 bg-slate-100/80'
                            }`}
                            title={`👷 Construcción: ${card.construccion.toLocaleString('es-ES', { maximumFractionDigits: 1 })} ${displayUnit}`}
                          >
                            <span className="text-[10px]">👷</span>
                            <span>{card.construccion.toLocaleString('es-ES', { maximumFractionDigits: 1 })}</span>
                          </span>
                        </>
                      )}

                      {/* Unidad */}
                      <span className="text-[10px] font-bold text-slate-500 font-sans ml-0.5">
                        {displayUnit}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Main Chart Area: Eje X con Meses (Mes Seleccionado + 4 Meses) */}
      {filteredChartData.length === 0 || activeScapsArray.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center my-4">
          <Info className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-700">No hay datos para la combinación seleccionada</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            {activeScapsArray.length === 0
              ? 'Por favor selecciona al menos un paquete SCAP arriba para visualizar sus cantidades programadas en las barras.'
              : 'No se encontraron registros de obra programada en los 5 meses para el componente seleccionado.'}
          </p>
          {activeScapsArray.length === 0 && scapsInComponent.length > 0 && (
            <button
              type="button"
              onClick={() => selectTopN(6)}
              className="mt-3 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Seleccionar Principales SCAPs
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-slate-100 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-slate-800">
                {activeComponent === 'all' ? 'Todos los Componentes' : `Componente: ${activeComponent}`}
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-xs font-semibold text-slate-600">
                Ventana de 5 Meses ({fiveMonths[0]?.label} a {fiveMonths[4]?.label})
              </span>
            </div>
            <div className="text-[11px] font-mono text-indigo-600 font-bold">
              Total 5 Meses: {currentFilteredTotal.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="h-80 sm:h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={filteredChartData}
                margin={{ top: 20, right: 25, left: 15, bottom: 35 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tick={renderCustomAxisTick}
                  interval={0}
                  height={55}
                />
                <YAxis
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickFormatter={val => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                />
                <Tooltip content={<CustomChartTooltip />} />

                {/* DYNAMIC BARS: Strictly only active SCAPs belonging to the selected component (always stacked) */}
                {activeScapsArray.map((scap, idx) => (
                  <Bar
                    key={scap}
                    dataKey={scap}
                    name={scap}
                    stackId="a"
                    fill={scapColorMap[scap] || SCAP_PALETTE[idx % SCAP_PALETTE.length]}
                    radius={[0, 0, 0, 0]}
                    maxBarSize={64}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 text-center text-[10.5px] text-slate-400 font-medium">
            * Eje X: Mes Seleccionado ({fiveMonths[0]?.label}) + 4 meses siguientes | Eje Y: Cantidad de obra programada de los SCAPs activos de {activeComponent === 'all' ? 'todos los componentes' : activeComponent}
          </div>
        </div>
      )}

      {/* Expandable Monthly Data Table */}
      {showDataTable && filteredChartData.length > 0 && (
        <div className="mt-4 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-xs font-extrabold text-slate-800 block">
                Matriz Mensual de Cantidades Programadas por SCAP (Mes Seleccionado + 4 Meses)
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                Componente: {activeComponent === 'all' ? 'Todos los componentes' : activeComponent} | Período: {fiveMonths[0]?.label} a {fiveMonths[4]?.label}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyTable}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
            >
              {copiedTable ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copiar a Portapapeles (TSV)</span>
                </>
              )}
            </button>
          </div>

          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead className="bg-slate-100 text-slate-700 font-extrabold text-[10.5px] uppercase tracking-wider sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 whitespace-nowrap bg-slate-100">Paquete SCAP</th>
                  <th className="py-2.5 px-2 text-center whitespace-nowrap bg-slate-100">Unidad</th>
                  {filteredChartData.map(d => (
                    <th
                      key={d.monthKey}
                      className={`py-2.5 px-3 text-right whitespace-nowrap ${
                        d.isBaseMonth ? 'bg-indigo-100/70 text-indigo-950 font-black' : 'bg-slate-100'
                      }`}
                    >
                      <div>{d.label}</div>
                      <div className="text-[9px] font-normal text-slate-500 lowercase font-mono">
                        {d.isBaseMonth ? 'Mes Base' : `Mes +${d.offset}`}
                      </div>
                    </th>
                  ))}
                  <th className="py-2.5 px-3 text-right font-extrabold text-indigo-900 bg-indigo-50 whitespace-nowrap">
                    Total 5 Meses
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {activeScapsArray.map((scap, idx) => {
                  const scapTotal = filteredChartData.reduce((acc, d) => acc + (d[scap] || 0), 0);
                  const unit = scapUnits[scap] || '';

                  return (
                    <tr key={scap} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="py-2 px-3 font-bold text-slate-800 whitespace-nowrap font-sans">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-xs shrink-0"
                            style={{ backgroundColor: scapColorMap[scap] }}
                          />
                          <span title={scap}>{scap}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center text-slate-500 font-sans text-[10px]">
                        {unit || '-'}
                      </td>
                      {filteredChartData.map(d => {
                        const val = d[scap] || 0;
                        return (
                          <td
                            key={d.monthKey}
                            className={`py-2 px-3 text-right whitespace-nowrap ${
                              d.isBaseMonth ? 'bg-indigo-50/30 font-bold' : ''
                            } ${
                              val > 0 ? 'text-slate-800 font-semibold' : 'text-slate-300'
                            }`}
                          >
                            {val > 0 ? val.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '-'}
                          </td>
                        );
                      })}
                      <td className="py-2 px-3 text-right font-bold text-indigo-700 bg-indigo-50/60 whitespace-nowrap">
                        {scapTotal.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 text-slate-900 font-mono font-extrabold text-[11px] border-t-2 border-slate-300">
                <tr>
                  <td className="py-2.5 px-3 font-sans uppercase">Total Mes</td>
                  <td className="py-2.5 px-2 text-center">-</td>
                  {filteredChartData.map(d => (
                    <td
                      key={d.monthKey}
                      className={`py-2.5 px-3 text-right ${
                        d.isBaseMonth ? 'bg-indigo-100/70 text-indigo-950 font-black' : 'text-indigo-800'
                      }`}
                    >
                      {d._totalSelected.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                  ))}
                  <td className="py-2.5 px-3 text-right text-indigo-900 bg-indigo-100">
                    {currentFilteredTotal.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
