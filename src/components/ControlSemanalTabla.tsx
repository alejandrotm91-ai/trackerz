/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Download, ChevronRight, ChevronDown, FileSpreadsheet, Check, Copy, ChevronsUpDown, ChevronsDownUp, Calendar, Filter, Search, Minus, ArrowUp, ArrowDown, ArrowUpDown, RotateCcw, CheckCircle2, Percent, SlidersHorizontal, Plus, X, Layers, Sparkles } from 'lucide-react';
import { hasDirectoOrDSegment } from '../utils/masterCdoHierarchy';

export interface ControlSemanalTablaProps {
  actividades: any[];
  dataPlanificadoPG004?: any;
  baseVenta?: string;
  soloTablaYSemana?: boolean;
  defaultCollapsed?: boolean;
  modoEVInicial?: boolean;
}


export type HierarchyDimensionId = 
  | 'componente' 
  | 'tipo' 
  | 'grupo' 
  | 'partida' 
  | 'cap' 
  | 'scap' 
  | 'subcontratista';

export interface HierarchyDimensionMeta {
  id: HierarchyDimensionId;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
  headerColorClass: string;
}

export const HIERARCHY_DIMENSIONS: Record<HierarchyDimensionId, HierarchyDimensionMeta> = {
  componente: {
    id: 'componente',
    label: 'Componente (Col. AN)',
    shortLabel: 'Componente',
    icon: '🏛️',
    description: 'Componente de obra o infraestructura',
    headerColorClass: '#f8fafc'
  },
  tipo: {
    id: 'tipo',
    label: 'Tipología',
    shortLabel: 'Tipología',
    icon: '🏷️',
    description: 'Tipología de edificación o lote',
    headerColorClass: '#312e81'
  },
  grupo: {
    id: 'grupo',
    label: 'Grupo',
    shortLabel: 'Grupo',
    icon: '📁',
    description: 'Grupo o fase de ejecución',
    headerColorClass: '#f3e8ff'
  },
  partida: {
    id: 'partida',
    label: 'Partida (Col. AC CDO)',
    shortLabel: 'Partida',
    icon: '📑',
    description: 'Partida presupuestaria (Columna AC)',
    headerColorClass: '#d1fae5'
  },
  cap: {
    id: 'cap',
    label: 'Subpartida / CAP',
    shortLabel: 'CAP',
    icon: '📄',
    description: 'Capítulo o Subpartida principal',
    headerColorClass: '#d1fae5'
  },
  scap: {
    id: 'scap',
    label: 'SCAP',
    shortLabel: 'SCAP',
    icon: '📦',
    description: 'Subcapítulo detallado',
    headerColorClass: '#e0f2fe'
  },
  subcontratista: {
    id: 'subcontratista',
    label: 'Subcontratista',
    shortLabel: 'SubC',
    icon: '🏗️',
    description: 'Empresa contratista ejecutora',
    headerColorClass: '#fef3c7'
  }
};

export const DEFAULT_HIERARCHY: HierarchyDimensionId[] = [
  'componente',
  'tipo',
  'grupo',
  'cap',
  'scap',
  'subcontratista'
];

export const HIERARCHY_PRESETS: { id: string; name: string; description: string; icon: string; dimensions: HierarchyDimensionId[] }[] = [
  {
    id: 'default',
    name: 'Predeterminada (Estándar)',
    description: 'Componente ➔ Tipología ➔ Grupo ➔ CAP ➔ SCAP ➔ SubC',
    icon: '⚡',
    dimensions: ['componente', 'tipo', 'grupo', 'cap', 'scap', 'subcontratista']
  },
  {
    id: 'partidas',
    name: 'Por Partidas (Col. AC)',
    description: 'Partida ➔ CAP ➔ SCAP ➔ Subcontratista',
    icon: '📑',
    dimensions: ['partida', 'cap', 'scap', 'subcontratista']
  },
  {
    id: 'cap_scap',
    name: 'Por CAP ➔ SCAP',
    description: 'CAP (Subpartida) ➔ SCAP ➔ Subcontratista',
    icon: '📄',
    dimensions: ['cap', 'scap', 'subcontratista']
  },
  {
    id: 'scap_cap',
    name: 'Por SCAP ➔ CAP',
    description: 'SCAP ➔ CAP (Subpartida) ➔ Subcontratista',
    icon: '📦',
    dimensions: ['scap', 'cap', 'subcontratista']
  },
  {
    id: 'comp_partida',
    name: 'Componente ➔ Partida',
    description: 'Componente ➔ Partida ➔ CAP ➔ SCAP',
    icon: '🏛️',
    dimensions: ['componente', 'partida', 'cap', 'scap']
  },
  {
    id: 'subc_cap',
    name: 'Por Subcontratista',
    description: 'Subcontratista ➔ CAP ➔ SCAP',
    icon: '🏗️',
    dimensions: ['subcontratista', 'cap', 'scap']
  }
];

export interface DynamicHierarchyNode {
  key: string;
  dimId: HierarchyDimensionId;
  value: string;
  levelIndex: number;
  items: any[];
  children?: DynamicHierarchyNode[];
}

const LEVEL_STYLES = [
  {
    bg: 'bg-slate-50 hover:bg-slate-100/90 text-slate-800 font-bold border-b border-slate-200 shadow-2xs',
    text: 'text-indigo-700',
    badge: 'bg-slate-900 text-white',
    subText: 'text-slate-500',
    chevron: 'text-slate-600',
    dateText: 'text-slate-600',
    vContrato: 'text-slate-900',
    vPlan: 'text-indigo-700 font-bold',
    vEjec: 'text-slate-800',
    vSobre: 'text-amber-700'
  },
  {
    bg: 'bg-indigo-900/95 text-white hover:bg-[#442dd7] font-extrabold border-b border-indigo-950 shadow-xs',
    text: 'text-white',
    badge: 'bg-indigo-100 text-indigo-800',
    subText: 'text-indigo-200',
    chevron: 'text-indigo-200',
    dateText: 'text-indigo-100',
    vContrato: 'text-white',
    vPlan: 'text-indigo-200',
    vEjec: 'text-slate-300',
    vSobre: 'text-amber-300'
  },
  {
    bg: 'bg-purple-100/90 hover:bg-purple-200/90 text-purple-950 font-extrabold border-b border-purple-200 border-l-2 border-l-purple-600',
    text: 'text-purple-950',
    badge: 'bg-purple-200 text-purple-900',
    subText: 'text-purple-700',
    chevron: 'text-purple-700',
    dateText: 'text-purple-800',
    vContrato: 'text-purple-950',
    vPlan: 'text-indigo-700',
    vEjec: 'text-slate-600',
    vSobre: 'text-amber-700'
  },
  {
    bg: 'bg-emerald-100/90 hover:bg-emerald-200/90 text-emerald-950 font-bold border-b border-emerald-200 border-l-2 border-l-emerald-600',
    text: 'text-emerald-950',
    badge: 'bg-emerald-200 text-emerald-900',
    subText: 'text-emerald-800',
    chevron: 'text-emerald-800',
    dateText: 'text-emerald-800',
    vContrato: 'text-emerald-950',
    vPlan: 'text-indigo-700',
    vEjec: 'text-slate-600',
    vSobre: 'text-amber-700'
  },
  {
    bg: 'bg-sky-100/90 hover:bg-sky-200/90 text-sky-950 font-bold border-b border-sky-200 border-l-2 border-l-sky-600',
    text: 'text-sky-950',
    badge: 'bg-sky-200 text-sky-900',
    subText: 'text-sky-700',
    chevron: 'text-sky-700',
    dateText: 'text-sky-800',
    vContrato: 'text-sky-950',
    vPlan: 'text-indigo-700',
    vEjec: 'text-slate-600',
    vSobre: 'text-amber-700'
  },
  {
    bg: 'bg-amber-100/90 hover:bg-amber-200/90 text-amber-950 font-semibold border-b border-amber-200 border-l-2 border-l-amber-600',
    text: 'text-amber-950',
    badge: 'bg-amber-200 text-amber-900',
    subText: 'text-amber-800',
    chevron: 'text-amber-800',
    dateText: 'text-amber-800',
    vContrato: 'text-amber-950',
    vPlan: 'text-indigo-700',
    vEjec: 'text-slate-600',
    vSobre: 'text-amber-700'
  },
  {
    bg: 'bg-teal-100/90 hover:bg-teal-200/90 text-teal-950 font-semibold border-b border-teal-200 border-l-2 border-l-teal-600',
    text: 'text-teal-950',
    badge: 'bg-teal-200 text-teal-900',
    subText: 'text-teal-800',
    chevron: 'text-teal-800',
    dateText: 'text-teal-800',
    vContrato: 'text-teal-950',
    vPlan: 'text-indigo-700',
    vEjec: 'text-slate-600',
    vSobre: 'text-amber-700'
  }
];

export const EXCEL_LEVEL_COLORS = [
  // Nivel 1 (index 0 - Slate 50): bg-slate-50, text-slate-800, text-indigo-700
  {
    bg: '#f8fafc',
    fg: '#1e293b',
    labelColor: '#4338ca',
    vContrato: '#0f172a',
    vPlan: '#4338ca',
    vEjec: '#1e293b',
    vSobre: '#b45309',
    borderColor: '#e2e8f0'
  },
  // Nivel 2 (index 1 - Indigo 900): bg-indigo-900/95, text-white
  {
    bg: '#312e81',
    fg: '#ffffff',
    labelColor: '#ffffff',
    vContrato: '#ffffff',
    vPlan: '#c7d2fe',
    vEjec: '#cbd5e1',
    vSobre: '#fde68a',
    borderColor: '#1e1b4b'
  },
  // Nivel 3 (index 2 - Purple 100): bg-purple-100/90, text-purple-950
  {
    bg: '#f3e8ff',
    fg: '#3b0764',
    labelColor: '#3b0764',
    vContrato: '#3b0764',
    vPlan: '#4338ca',
    vEjec: '#475569',
    vSobre: '#b45309',
    borderColor: '#e9d5ff'
  },
  // Nivel 4 (index 3 - Emerald 100): bg-emerald-100/90, text-emerald-950
  {
    bg: '#d1fae5',
    fg: '#064e3b',
    labelColor: '#064e3b',
    vContrato: '#064e3b',
    vPlan: '#4338ca',
    vEjec: '#475569',
    vSobre: '#b45309',
    borderColor: '#a7f3d0'
  },
  // Nivel 5 (index 4 - Sky 100): bg-sky-100/90, text-sky-950
  {
    bg: '#e0f2fe',
    fg: '#082f49',
    labelColor: '#082f49',
    vContrato: '#082f49',
    vPlan: '#4338ca',
    vEjec: '#475569',
    vSobre: '#b45309',
    borderColor: '#bae6fd'
  },
  // Nivel 6 (index 5 - Amber 100): bg-amber-100/90, text-amber-950
  {
    bg: '#fef3c7',
    fg: '#78350f',
    labelColor: '#78350f',
    vContrato: '#78350f',
    vPlan: '#4338ca',
    vEjec: '#475569',
    vSobre: '#b45309',
    borderColor: '#fde68a'
  },
  // Nivel 7 (index 6 - Teal 100): bg-teal-100/90, text-teal-950
  {
    bg: '#ccfbf1',
    fg: '#042f2e',
    labelColor: '#042f2e',
    vContrato: '#042f2e',
    vPlan: '#4338ca',
    vEjec: '#475569',
    vSobre: '#b45309',
    borderColor: '#99f6e4'
  }
];

export const ControlSemanalTabla: React.FC<ControlSemanalTablaProps> = ({
  actividades,
  dataPlanificadoPG004,
  baseVenta = 'venta',
  soloTablaYSemana = false,
  defaultCollapsed,
  modoEVInicial = false,
}) => {
  const [modoEV, setModoEV] = React.useState<boolean>(soloTablaYSemana ? false : modoEVInicial);
  const [selectedWeeks, setSelectedWeeks] = React.useState<Set<string>>(new Set());
  const [isAllSelected, setIsAllSelected] = React.useState<boolean>(true);
  const [selectedTipologias, setSelectedTipologias] = React.useState<Set<string>>(new Set());
  const [isAllTipologiasSelected, setIsAllTipologiasSelected] = React.useState<boolean>(true);
  const [isTipologiaDropdownOpen, setIsTipologiaDropdownOpen] = React.useState<boolean>(false);

  const [selectedStatuses, setSelectedStatuses] = React.useState<Set<string>>(new Set());
  const [isAllStatusSelected, setIsAllStatusSelected] = React.useState<boolean>(true);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = React.useState<boolean>(false);

  const [selectedPAcs, setSelectedPAcs] = React.useState<Set<string>>(new Set());
  const [isAllPAcSelected, setIsAllPAcSelected] = React.useState<boolean>(true);
  const [isPAcDropdownOpen, setIsPAcDropdownOpen] = React.useState<boolean>(false);

  const [selectedPartidas, setSelectedPartidas] = React.useState<Set<string>>(new Set());
  const [isAllPartidasSelected, setIsAllPartidasSelected] = React.useState<boolean>(true);
  const [isPartidasDropdownOpen, setIsPartidasDropdownOpen] = React.useState<boolean>(false);
  const [partidasSearchQuery, setPartidasSearchQuery] = React.useState<string>('');

  const [selectedSubCs, setSelectedSubCs] = React.useState<Set<string>>(new Set());
  const [isAllSubCsSelected, setIsAllSubCsSelected] = React.useState<boolean>(true);
  const [isSubCDropdownOpen, setIsSubCDropdownOpen] = React.useState<boolean>(false);
  const [subCSearchQuery, setSubCSearchQuery] = React.useState<string>('');
  const subCSearchInputRef = React.useRef<HTMLInputElement | null>(null);

  const [filterVariacion, setFilterVariacion] = React.useState<'all' | 'pos' | 'neg'>('all');
  const [filterPlanEjec, setFilterPlanEjec] = React.useState<'all' | 'plan' | 'ejec'>('all');
  const [isVariacionDropdownOpen, setIsVariacionDropdownOpen] = React.useState<boolean>(false);
  const [filterPartidaD, setFilterPartidaD] = React.useState<'all' | 'only_d' | 'exclude_d'>('all');
  const [isPartidaDDropdownOpen, setIsPartidaDDropdownOpen] = React.useState<boolean>(false);
  const excludePartidaD = filterPartidaD === 'exclude_d';
  const setExcludePartidaD = (val: boolean) => setFilterPartidaD(val ? 'exclude_d' : 'all');
  const [filterFloatNegativo, setFilterFloatNegativo] = React.useState<boolean>(false);

  const totalFloatNegativoCount = React.useMemo(() => {
    if (!actividades) return 0;
    return actividades.filter(a => {
      if (!a.esItemHoja) return false;
      const f = a.totalFloat !== undefined ? a.totalFloat : (a.tf !== undefined ? a.tf : a.float);
      return f !== null && f !== undefined && !isNaN(Number(f)) && Number(f) < 0;
    }).length;
  }, [actividades]);
  const [sortColumn, setSortColumn] = React.useState<
    'wbs' | 'activityId' | 'descripcion' | 'blFinish' | 'contrato' | 'plan' | 'ejec' | 'sobreEjec' | 'pctPlan' | 'pctEjec' | 'variacion' | 'pctAvance' | 'checkSet'
  >('wbs');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');
  const [isTipologiasSummaryOpen, setIsTipologiasSummaryOpen] = React.useState<boolean>(false);
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [filterCheckSet, setFilterCheckSet] = React.useState<'all' | 'retraso' | 'adelanto' | 'en_plazo'>('all');
  const [modoPorcentaje, setModoPorcentaje] = React.useState<'total' | 'ponderado'>('total');
  const [isCardCollapsed, setIsCardCollapsed] = React.useState<boolean>(
    defaultCollapsed !== undefined ? defaultCollapsed : (soloTablaYSemana ? false : true)
  );
  const [isExpandMenuOpen, setIsExpandMenuOpen] = React.useState<boolean>(false);
  const [copied, setCopied] = React.useState<boolean>(false);

  // Tree filter dropdown state for week selector
  const [isWeekDropdownOpen, setIsWeekDropdownOpen] = React.useState<boolean>(false);
  const [qsYear, setQsYear] = React.useState<string>('');
  const [qsMonth, setQsMonth] = React.useState<string>('');
  const [qsDay, setQsDay] = React.useState<string>('');

  // Hierarchy expansion state
  const [expandedComponentes, setExpandedComponentes] = React.useState<Set<string>>(new Set());
  const [expandedTipos, setExpandedTipos] = React.useState<Set<string>>(new Set());
  const [expandedRESPs, setExpandedRESPs] = React.useState<Set<string>>(new Set());
  const [expandedSCAPs, setExpandedSCAPs] = React.useState<Set<string>>(new Set());
  const [expandedSubCs, setExpandedSubCs] = React.useState<Set<string>>(new Set());
  const [expandedSubPartidas, setExpandedSubPartidas] = React.useState<Set<string>>(new Set());
  const [expandedCheckSets, setExpandedCheckSets] = React.useState<Set<string>>(new Set());

  const [hasInitializedDefaultWeek, setHasInitializedDefaultWeek] = React.useState<boolean>(false);
  // Dynamic Hierarchy state
  const [activeHierarchy, setActiveHierarchy] = React.useState<HierarchyDimensionId[]>(() => {
    try {
      const saved = localStorage.getItem('control_semanal_jerarquia');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(id => HIERARCHY_DIMENSIONS[id as HierarchyDimensionId])) {
          return parsed as HierarchyDimensionId[];
        }
      }
    } catch {
      // fallback
    }
    return DEFAULT_HIERARCHY;
  });
  const [expandedNodes, setExpandedNodes] = React.useState<Set<string>>(new Set());
  const [isHierarchyModalOpen, setIsHierarchyModalOpen] = React.useState<boolean>(false);
  const [isPresetMenuOpen, setIsPresetMenuOpen] = React.useState<boolean>(false);
  const [isAddDimMenuOpen, setIsAddDimMenuOpen] = React.useState<boolean>(false);
  const [isHierarchyBarCollapsed, setIsHierarchyBarCollapsed] = React.useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('control_semanal_jerarquia_colapsada');
      if (saved !== null) {
        return saved === 'true';
      }
    } catch {
      // fallback
    }
    return true; // Por defecto colapsada según requerimiento del usuario
  });

  // Sync isHierarchyBarCollapsed to localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem('control_semanal_jerarquia_colapsada', String(isHierarchyBarCollapsed));
    } catch {
      // ignore
    }
  }, [isHierarchyBarCollapsed]);

  // Sync to localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem('control_semanal_jerarquia', JSON.stringify(activeHierarchy));
    } catch {
      // ignore
    }
  }, [activeHierarchy]);


  // Available weeks from CDO (V-) & PG-004
  const availableWeeks = React.useMemo(() => {
    if (!actividades || actividades.length === 0) return [];
    const weekSet = new Set<string>();
    const isReasonableYear = (k: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return false;
      const yr = parseInt(k.substring(0, 4), 10);
      return yr >= 2020 && yr <= 2040;
    };

    actividades.forEach(item => {
      if (!item.esItemHoja) return;
      if (item.certificacionesPorFecha) {
        Object.keys(item.certificacionesPorFecha).forEach(k => {
          if (isReasonableYear(k)) weekSet.add(k);
        });
      }
      if (item.planificadoPorFechaPG004) {
        Object.keys(item.planificadoPorFechaPG004).forEach(k => {
          if (isReasonableYear(k)) weekSet.add(k);
        });
      }
      if (dataPlanificadoPG004 && item.activityId && dataPlanificadoPG004[item.activityId]) {
        Object.keys(dataPlanificadoPG004[item.activityId]).forEach(k => {
          if (isReasonableYear(k)) weekSet.add(k);
        });
      }
    });
    return Array.from(weekSet).sort();
  }, [actividades, dataPlanificadoPG004]);

  // Set the default week to the last one with executed values
  React.useEffect(() => {
    if (!hasInitializedDefaultWeek && actividades && actividades.length > 0) {
      let maxWeek = '';
      const isReasonableYear = (k: string) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return false;
        const yr = parseInt(k.substring(0, 4), 10);
        return yr >= 2020 && yr <= 2040;
      };

      actividades.forEach(item => {
        if (item.esItemHoja && item.certificacionesPorFecha) {
          Object.keys(item.certificacionesPorFecha).forEach(k => {
            if (isReasonableYear(k)) {
              const val = Number(item.certificacionesPorFecha[k]) || 0;
              if (Math.abs(val) > 0.001) {
                if (k > maxWeek) maxWeek = k;
              }
            }
          });
        }
      });
      if (maxWeek && availableWeeks.includes(maxWeek)) {
        const upToWeeks = availableWeeks.filter(w => w <= maxWeek);
        setIsAllSelected(upToWeeks.length === availableWeeks.length);
        setSelectedWeeks(new Set(upToWeeks));
        
        const partes = maxWeek.split('-');
        if (partes.length === 3) {
          setQsYear(partes[0]);
          setQsMonth(partes[1]);
          setQsDay(partes[2]);
        }

        const maxIdx = availableWeeks.indexOf(maxWeek);
        const startIdx = Math.max(0, maxIdx - 3);
        const sWk = availableWeeks[startIdx] || availableWeeks[0];
        const eWk = maxWeek;
        setRangeStartWeek(sWk);
        setRangeEndWeek(eWk);

        const sParts = sWk.split('-');
        if (sParts.length === 3) {
          setRangeStartYear(sParts[0]);
          setRangeStartMonth(sParts[1]);
          setRangeStartDay(sParts[2]);
        }
        const eParts = eWk.split('-');
        if (eParts.length === 3) {
          setRangeEndYear(eParts[0]);
          setRangeEndMonth(eParts[1]);
          setRangeEndDay(eParts[2]);
        }
      }
      setHasInitializedDefaultWeek(true);
    }
  }, [actividades, availableWeeks, hasInitializedDefaultWeek]);

  const [rangeStartYear, setRangeStartYear] = React.useState<string>('');
  const [rangeStartMonth, setRangeStartMonth] = React.useState<string>('');
  const [rangeStartDay, setRangeStartDay] = React.useState<string>('');

  const [rangeEndYear, setRangeEndYear] = React.useState<string>('');
  const [rangeEndMonth, setRangeEndMonth] = React.useState<string>('');
  const [rangeEndDay, setRangeEndDay] = React.useState<string>('');

  const [rangeStartWeek, setRangeStartWeek] = React.useState<string>('');
  const [rangeEndWeek, setRangeEndWeek] = React.useState<string>('');
  const [weekTabMode, setWeekTabMode] = React.useState<'range' | 'quick'>('range');

  // Derive final range start week string from year/month/day
  const finalRangeStartWeek = React.useMemo(() => {
    if (rangeStartYear && rangeStartMonth && rangeStartDay) {
      return `${rangeStartYear}-${rangeStartMonth}-${rangeStartDay}`;
    }
    return rangeStartWeek || (availableWeeks[0] || '');
  }, [rangeStartYear, rangeStartMonth, rangeStartDay, rangeStartWeek, availableWeeks]);

  // Derive final range end week string from year/month/day
  const finalRangeEndWeek = React.useMemo(() => {
    if (rangeEndYear && rangeEndMonth && rangeEndDay) {
      return `${rangeEndYear}-${rangeEndMonth}-${rangeEndDay}`;
    }
    return rangeEndWeek || (availableWeeks[availableWeeks.length - 1] || '');
  }, [rangeEndYear, rangeEndMonth, rangeEndDay, rangeEndWeek, availableWeeks]);

  // Available months/days for Range Start
  const rangeStartAvailableYears = React.useMemo(() => {
    return Array.from(new Set(availableWeeks.map(wk => wk.substring(0, 4)))).sort();
  }, [availableWeeks]);

  const rangeStartAvailableMonths = React.useMemo(() => {
    if (!rangeStartYear) return [];
    return Array.from(new Set(
      availableWeeks
        .filter(wk => wk.startsWith(rangeStartYear))
        .map(wk => wk.substring(5, 7))
    )).sort();
  }, [availableWeeks, rangeStartYear]);

  const rangeStartAvailableDays = React.useMemo(() => {
    if (!rangeStartYear || !rangeStartMonth) return [];
    const prefix = `${rangeStartYear}-${rangeStartMonth}`;
    return Array.from(new Set(
      availableWeeks
        .filter(wk => wk.startsWith(prefix))
        .map(wk => wk.substring(8, 10))
    )).sort();
  }, [availableWeeks, rangeStartYear, rangeStartMonth]);

  // Available months/days for Range End
  const rangeEndAvailableYears = React.useMemo(() => {
    return Array.from(new Set(availableWeeks.map(wk => wk.substring(0, 4)))).sort();
  }, [availableWeeks]);

  const rangeEndAvailableMonths = React.useMemo(() => {
    if (!rangeEndYear) return [];
    return Array.from(new Set(
      availableWeeks
        .filter(wk => wk.startsWith(rangeEndYear))
        .map(wk => wk.substring(5, 7))
    )).sort();
  }, [availableWeeks, rangeEndYear]);

  const rangeEndAvailableDays = React.useMemo(() => {
    if (!rangeEndYear || !rangeEndMonth) return [];
    const prefix = `${rangeEndYear}-${rangeEndMonth}`;
    return Array.from(new Set(
      availableWeeks
        .filter(wk => wk.startsWith(prefix))
        .map(wk => wk.substring(8, 10))
    )).sort();
  }, [availableWeeks, rangeEndYear, rangeEndMonth]);

  const isRangeStartValid = finalRangeStartWeek && availableWeeks.includes(finalRangeStartWeek);
  const isRangeEndValid = finalRangeEndWeek && availableWeeks.includes(finalRangeEndWeek);
  const isRangeSelectionValid = isRangeStartValid && isRangeEndValid;

  React.useEffect(() => {
    if (availableWeeks.length > 0) {
      if (!rangeStartWeek || !availableWeeks.includes(rangeStartWeek)) {
        const firstWk = availableWeeks[0];
        setRangeStartWeek(firstWk);
        const parts = firstWk.split('-');
        if (parts.length === 3) {
          setRangeStartYear(parts[0]);
          setRangeStartMonth(parts[1]);
          setRangeStartDay(parts[2]);
        }
      }
      if (!rangeEndWeek || !availableWeeks.includes(rangeEndWeek)) {
        const lastWk = availableWeeks[availableWeeks.length - 1];
        setRangeEndWeek(lastWk);
        const parts = lastWk.split('-');
        if (parts.length === 3) {
          setRangeEndYear(parts[0]);
          setRangeEndMonth(parts[1]);
          setRangeEndDay(parts[2]);
        }
      }
    }
  }, [availableWeeks, rangeStartWeek, rangeEndWeek]);

  // Active weeks set: if isAllSelected is true, includes all available weeks
  const activeWeekSet = React.useMemo(() => {
    if (isAllSelected) return new Set(availableWeeks);
    return selectedWeeks;
  }, [isAllSelected, selectedWeeks, availableWeeks]);

  const qsAvailableYears = React.useMemo(() => {
    return Array.from(new Set(availableWeeks.map(wk => wk.substring(0, 4)))).sort();
  }, [availableWeeks]);

  const qsAvailableMonths = React.useMemo(() => {
    if (!qsYear) return [];
    return Array.from(new Set(
      availableWeeks
        .filter(wk => wk.startsWith(qsYear))
        .map(wk => wk.substring(5, 7))
    )).sort();
  }, [availableWeeks, qsYear]);

  const qsAvailableDays = React.useMemo(() => {
    if (!qsYear || !qsMonth) return [];
    const prefix = `${qsYear}-${qsMonth}`;
    return Array.from(new Set(
      availableWeeks
        .filter(wk => wk.startsWith(prefix))
        .map(wk => wk.substring(8, 10))
    )).sort();
  }, [availableWeeks, qsYear, qsMonth]);

  const finalQuickSelectWeek = (qsYear && qsMonth && qsDay) ? `${qsYear}-${qsMonth}-${qsDay}` : '';
  const isQuickSelectValid = finalQuickSelectWeek && availableWeeks.includes(finalQuickSelectWeek);

  const isSoloEstaActive = React.useMemo(() => {
    if (!isQuickSelectValid) return false;
    return activeWeekSet.size === 1 && activeWeekSet.has(finalQuickSelectWeek);
  }, [isQuickSelectValid, activeWeekSet, finalQuickSelectWeek]);

  const isHastaAquiActive = React.useMemo(() => {
    if (!isQuickSelectValid || activeWeekSet.size === 0) return false;
    let maxInActive = '';
    activeWeekSet.forEach(w => {
      if (w > maxInActive) maxInActive = w;
    });
    if (maxInActive !== finalQuickSelectWeek) return false;
    
    // Check if it has all weeks up to finalQuickSelectWeek
    let expectedCount = 0;
    for (let i = 0; i < availableWeeks.length; i++) {
      if (availableWeeks[i] <= finalQuickSelectWeek) {
        expectedCount++;
        if (!activeWeekSet.has(availableWeeks[i])) return false;
      }
    }
    return activeWeekSet.size === expectedCount;
  }, [isQuickSelectValid, activeWeekSet, finalQuickSelectWeek, availableWeeks]);

  const isRangeActive = React.useMemo(() => {
    if (!finalRangeStartWeek || !finalRangeEndWeek || !isRangeSelectionValid || activeWeekSet.size === 0) return false;
    const [from, to] = finalRangeStartWeek <= finalRangeEndWeek ? [finalRangeStartWeek, finalRangeEndWeek] : [finalRangeEndWeek, finalRangeStartWeek];
    const expectedWeeks = availableWeeks.filter(w => w >= from && w <= to);
    if (expectedWeeks.length !== activeWeekSet.size) return false;
    return expectedWeeks.every(w => activeWeekSet.has(w));
  }, [finalRangeStartWeek, finalRangeEndWeek, isRangeSelectionValid, activeWeekSet, availableWeeks]);

  const formatWeekDateHuman = (dateStr: string) => {
    if (!dateStr) return '';
    const partes = dateStr.split('-');
    if (partes.length === 3) {
      const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      const mIdx = parseInt(partes[1], 10) - 1;
      const mNom = meses[mIdx] || partes[1];
      return `${partes[2]}-${mNom}-${partes[0]}`;
    }
    return dateStr;
  };

  const formatWeekDateFull = (dateStr: string) => {
    if (!dateStr) return '';
    const partes = dateStr.split('-');
    if (partes.length === 3) {
      const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      const mIdx = parseInt(partes[1], 10) - 1;
      const mNom = meses[mIdx] || partes[1];
      return `${partes[2]}/${partes[1]}/${partes[0]} (${partes[2]}-${mNom}-${partes[0]})`;
    }
    return dateStr;
  };

  // Handlers for multi-selection
  const handleSelectAll = React.useCallback(() => {
    setIsAllSelected(true);
    setSelectedWeeks(new Set(availableWeeks));
    setQsYear('');
    setQsMonth('');
    setQsDay('');
  }, [availableWeeks]);

  const handleDeselectAll = React.useCallback(() => {
    setIsAllSelected(false);
    setSelectedWeeks(new Set());
    setQsYear('');
    setQsMonth('');
    setQsDay('');
  }, []);

  const handleSelectUpTo = React.useCallback((targetWk: string) => {
    const upToWeeks = availableWeeks.filter(w => w <= targetWk);
    const newSet = new Set(upToWeeks);
    setIsAllSelected(newSet.size === availableWeeks.length && availableWeeks.length > 0);
    setSelectedWeeks(newSet);
  }, [availableWeeks]);

  const handleSelectSingle = React.useCallback((targetWk: string) => {
    setIsAllSelected(availableWeeks.length === 1 && availableWeeks[0] === targetWk);
    setSelectedWeeks(new Set([targetWk]));
  }, [availableWeeks]);

  const handleSelectRange = React.useCallback((startWk: string, endWk: string) => {
    if (!startWk || !endWk) return;
    const [from, to] = startWk <= endWk ? [startWk, endWk] : [endWk, startWk];
    const inRangeWeeks = availableWeeks.filter(w => w >= from && w <= to);
    const newSet = new Set(inRangeWeeks);
    setIsAllSelected(newSet.size === availableWeeks.length && availableWeeks.length > 0);
    setSelectedWeeks(newSet);

    // Sync input selectors
    setRangeStartWeek(from);
    setRangeEndWeek(to);
    const sParts = from.split('-');
    if (sParts.length === 3) {
      setRangeStartYear(sParts[0]);
      setRangeStartMonth(sParts[1]);
      setRangeStartDay(sParts[2]);
    }
    const eParts = to.split('-');
    if (eParts.length === 3) {
      setRangeEndYear(eParts[0]);
      setRangeEndMonth(eParts[1]);
      setRangeEndDay(eParts[2]);
    }
  }, [availableWeeks]);

  const handleSelectLastNWeeks = React.useCallback((n: number) => {
    if (availableWeeks.length === 0) return;
    const targetEnd = finalRangeEndWeek && availableWeeks.includes(finalRangeEndWeek) ? finalRangeEndWeek : availableWeeks[availableWeeks.length - 1];
    const endIdx = availableWeeks.indexOf(targetEnd);
    const startIdx = Math.max(0, endIdx - n + 1);
    const startWk = availableWeeks[startIdx];
    handleSelectRange(startWk, targetEnd);
  }, [availableWeeks, finalRangeEndWeek, handleSelectRange]);

  const handleSelectMonthOfEndWeek = React.useCallback(() => {
    if (availableWeeks.length === 0) return;
    const targetEnd = finalRangeEndWeek && availableWeeks.includes(finalRangeEndWeek) ? finalRangeEndWeek : availableWeeks[availableWeeks.length - 1];
    const prefix = targetEnd.substring(0, 7);
    const monthWeeks = availableWeeks.filter(w => w.startsWith(prefix));
    if (monthWeeks.length > 0) {
      const startWk = monthWeeks[0];
      const endWk = monthWeeks[monthWeeks.length - 1];
      handleSelectRange(startWk, endWk);
    }
  }, [availableWeeks, finalRangeEndWeek, handleSelectRange]);

  const handleToggleWeek = React.useCallback((wk: string) => {
    if (isAllSelected) {
      const next = new Set(availableWeeks);
      next.delete(wk);
      setIsAllSelected(false);
      setSelectedWeeks(next);
    } else {
      const next = new Set(selectedWeeks);
      if (next.has(wk)) {
        next.delete(wk);
      } else {
        next.add(wk);
      }
      if (next.size === availableWeeks.length && availableWeeks.length > 0) {
        setIsAllSelected(true);
      }
      setSelectedWeeks(next);
    }
  }, [isAllSelected, availableWeeks, selectedWeeks]);

  const currentWeekLabel = React.useMemo(() => {
    if (isAllSelected || activeWeekSet.size === availableWeeks.length || availableWeeks.length === 0) {
      return 'Todas las Semanas (Acumulado Total)';
    }
    if (activeWeekSet.size === 0) {
      return 'Ninguna Semana Seleccionada';
    }

    const sortedActive = Array.from(activeWeekSet).sort();
    const firstActive = sortedActive[0];
    const lastActive = sortedActive[sortedActive.length - 1];

    if (sortedActive.length === 1) {
      return formatWeekDateHuman(sortedActive[0]);
    }

    const rangeWeeks = availableWeeks.filter(w => w >= firstActive && w <= lastActive);
    const isContiguousRange = sortedActive.length === rangeWeeks.length && sortedActive.every((w, i) => w === rangeWeeks[i]);

    if (isContiguousRange) {
      if (firstActive === availableWeeks[0]) {
        return `Hasta ${formatWeekDateHuman(lastActive)} (${sortedActive.length} sem)`;
      }
      return `Del ${formatWeekDateHuman(firstActive)} al ${formatWeekDateHuman(lastActive)} (${sortedActive.length} sem)`;
    }

    return `${sortedActive.length} de ${availableWeeks.length} semanas seleccionadas`;
  }, [isAllSelected, activeWeekSet, availableWeeks]);

  const formatWeekLabel = (dateStr: string) => {
    const partes = dateStr.split('-');
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return dateStr;
  };

  const fmtMoney = (v: number) => (v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtMillions = (v: number) => `${((v || 0) / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
  const fmtDNum = (d: number) => d < 0 
    ? `($${Math.abs(d).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` 
    : `$${(d || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDNumMillions = (d: number) => d < 0 
    ? `($${fmtMillions(Math.abs(d))})` 
    : `$${fmtMillions(d)}`;

  const fmtDateVal = (d: Date | string | null | undefined): string => {
    if (!d) return '—';
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return '—';
    const day = String(dt.getDate()).padStart(2, '0');
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const year = dt.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getVB = (i: any) => baseVenta === 'contrato' ? (i.ventaM || 0) : (i.venta || 0);

  const maxActiveDateStr = React.useMemo(() => {
    if (activeWeekSet.size === 0) return null;
    let maxD = '';
    activeWeekSet.forEach(wk => {
      if (wk > maxD) maxD = wk;
    });
    return maxD || null;
  }, [activeWeekSet]);

  const getItemIsoDate = (d: Date | string | null | undefined): string | null => {
    if (!d) return null;
    if (typeof d === 'string') {
      const match = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    }
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return null;
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const planificadoPG004LowerIndex = React.useMemo(() => {
    const index: Record<string, any> = {};
    if (!dataPlanificadoPG004) return index;
    Object.keys(dataPlanificadoPG004).forEach(k => {
      index[k.toLowerCase().trim()] = dataPlanificadoPG004[k];
    });
    return index;
  }, [dataPlanificadoPG004]);

  const getItemWeekValues = React.useCallback((item: any) => {
    let vPlan = 0;
    let vEjec = 0;

    const actIdClean = item.activityId ? String(item.activityId).trim() : '';
    const actIdLower = actIdClean.toLowerCase();
    const wbsClean = item.wbs ? String(item.wbs).trim() : '';
    const wbsLower = wbsClean.toLowerCase();

    let planDict = (item.planificadoPorFechaPG004 && Object.keys(item.planificadoPorFechaPG004).length > 0)
      ? item.planificadoPorFechaPG004
      : null;

    if (!planDict && dataPlanificadoPG004) {
      if (item.activityId && dataPlanificadoPG004[item.activityId]) planDict = dataPlanificadoPG004[item.activityId];
      else if (actIdClean && dataPlanificadoPG004[actIdClean]) planDict = dataPlanificadoPG004[actIdClean];
      else if (actIdLower && planificadoPG004LowerIndex[actIdLower]) planDict = planificadoPG004LowerIndex[actIdLower];
      else if (wbsClean && dataPlanificadoPG004[wbsClean]) planDict = dataPlanificadoPG004[wbsClean];
      else if (wbsLower && planificadoPG004LowerIndex[wbsLower]) planDict = planificadoPG004LowerIndex[wbsLower];
    }

    const contratoDict = (item.planificadoPorFecha && Object.keys(item.planificadoPorFecha).length > 0)
      ? item.planificadoPorFecha
      : null;

    const ejecDict = (item.certificacionesPorFecha && Object.keys(item.certificacionesPorFecha).length > 0)
      ? item.certificacionesPorFecha
      : null;

    const hasDatePlanDict = !!(planDict && Object.keys(planDict).some(k => /^\d{4}-\d{2}-\d{2}$/.test(k)));
    const hasDateEjecDict = !!(ejecDict && Object.keys(ejecDict).some(k => /^\d{4}-\d{2}-\d{2}$/.test(k)));

    const isTotalMode = isAllSelected || activeWeekSet.size === availableWeeks.length;

    if (isTotalMode) {
      // 1. V.Plan
      if (hasDatePlanDict) {
        vPlan = Object.entries(planDict).reduce((sum: number, [k, val]: [string, any]) => {
          return sum + (/^\d{4}-\d{2}-\d{2}$/.test(k) ? (Number(val) || 0) : 0);
        }, 0);
      } else {
        vPlan = item.ventaPlan || 0;
      }

      // 2. V.Ejec
      if (hasDateEjecDict) {
        const sumEjec = Object.entries(ejecDict).reduce((sum: number, [k, val]: [string, any]) => {
          return sum + (/^\d{4}-\d{2}-\d{2}$/.test(k) ? (Number(val) || 0) : 0);
        }, 0);
        vEjec = sumEjec > 0 ? sumEjec : (item.ventaEjecutada || 0);
      } else {
        vEjec = item.ventaEjecutada || 0;
      }
    } else {
      // 1. V.Plan
      if (hasDatePlanDict) {
        Object.entries(planDict).forEach(([k, val]) => {
          if (activeWeekSet.has(k)) vPlan += Number(val) || 0;
        });
      } else {
        const itemDateStr = getItemIsoDate(item.blFinish || item.finish || item.blStart || item.start);
        if (itemDateStr && activeWeekSet.has(itemDateStr)) {
          vPlan = item.ventaPlan || 0;
        }
      }

      // 2. V.Ejec
      if (hasDateEjecDict) {
        Object.entries(ejecDict).forEach(([k, val]) => {
          if (activeWeekSet.has(k)) vEjec += Number(val) || 0;
        });
      } else {
        const itemDateStr = getItemIsoDate(item.actualFinish || item.finish || item.blFinish || item.blStart || item.start);
        if (itemDateStr && activeWeekSet.has(itemDateStr)) {
          vEjec = item.ventaEjecutada || 0;
        }
      }
    }

    // 3. V.Contrato (Valor estático de la columna I del master en CDO con SUMAR.SI para p6)
    const vContrato = Number(item.venta) || 0;

    const rawVEjec = vEjec;
    let sobreEjecucion = 0;

    // Modo E.V (Earned Value): según Activity ID, V.Ejec no puede ser mayor que V.Contrato
    // como máximo es ese valor y el saldo restante por encima se acumula en sobreEjecucion
    // NOTA: Solo disponible en la pestaña Cronograma (!soloTablaYSemana), excluido de Resumen
    if (!soloTablaYSemana && modoEV) {
      if (rawVEjec > vContrato) {
        vEjec = vContrato;
        sobreEjecucion = rawVEjec - vContrato;
      } else {
        vEjec = rawVEjec;
        sobreEjecucion = 0;
      }
    }

    const variacion = vEjec - vPlan;

    return { vPlan, vEjec, vContrato, variacion, sobreEjecucion, rawVEjec };
  }, [isAllSelected, activeWeekSet, availableWeeks.length, dataPlanificadoPG004, planificadoPG004LowerIndex, modoEV, soloTablaYSemana]);

  const getItemPrecio = React.useCallback((item: any): number => {
    if (item.precio && typeof item.precio === 'number' && item.precio > 0) {
      return item.precio;
    }
    const v = Number(item.venta) || 0;
    const q = item.cantidadCdo;
    if (v > 0 && typeof q === 'number' && q > 0) {
      return v / q;
    }
    return 0;
  }, []);

  const getCantidadTooltipForItem = React.useCallback((item: any, valorEcon: number, label: string) => {
    let extraInfo = '';
    if (label.includes('Contrato')) {
      const acumContrato = Number(item.venta) || 0;
      extraInfo = `💰 Presupuesto Contrato (Col I): $${acumContrato.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    } else if (label.includes('Plan')) {
      const acumPlan = item.ventaPlan || 0;
      extraInfo = `💰 Acum. Planificado (AS): $${acumPlan.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    } else if (label.includes('Ejec.')) {
      const acumEjec = item.ventaEjecutada || 0;
      extraInfo = `💰 Acum. Ejecutado (AV): $${acumEjec.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    } else if (label.includes('Sobre')) {
      extraInfo = `💰 Saldo Sobre Ejecución (excedente sobre V.Contrato): $${valorEcon.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    }

    const p = getItemPrecio(item);
    if (!p || p <= 0) {
      return extraInfo + '⚠️ Cantidad no disponible';
    }
    const cant = valorEcon / p;
    const unitStr = (item.unidad || item.unit || '').trim();
    const cantFmt = cant.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${extraInfo}📦 Cantidad: ${cantFmt}${unitStr ? ' ' + unitStr : ''}`;
  }, [getItemPrecio]);

  const getCantidadTooltipForGroup = React.useCallback((items: any[], type: 'contrato' | 'plan' | 'ejec' | 'desv' | 'sobreEjec', label: string) => {
    if (!items || items.length === 0) return undefined;
    let totalCant = 0;
    let itemsCountWithPrice = 0;
    const unitsSet = new Set<string>();

    items.forEach(item => {
      const p = getItemPrecio(item);
      if (p > 0) {
        const { vPlan, vEjec, vContrato, variacion, sobreEjecucion } = getItemWeekValues(item);
        let val = 0;
        if (type === 'contrato') val = vContrato;
        else if (type === 'plan') val = vPlan;
        else if (type === 'ejec') val = vEjec;
        else if (type === 'desv') val = variacion;
        else if (type === 'sobreEjec') val = sobreEjecucion || 0;

        totalCant += (val / p);
        itemsCountWithPrice++;
        const u = (item.unidad || item.unit || '').trim();
        if (u) unitsSet.add(u);
      }
    });

    if (itemsCountWithPrice === 0) return '⚠️ Cantidad no disponible';

    const cantFmt = totalCant.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const unitsStr = Array.from(unitsSet).join(', ');
    return `📦 Cantidad: ${cantFmt}${unitsStr ? ' ' + unitsStr : ''}`;
  }, [getItemPrecio, getItemWeekValues]);

  // Unique tipologías list for filter dropdown
  const tipologíasDisponibles = React.useMemo(() => {
    if (!actividades) return [];
    const set = new Set<string>();
    actividades.forEach(i => { if (i.esItemHoja && i.tipo) set.add(i.tipo); });
    return Array.from(set).sort();
  }, [actividades]);

  // Unique status list (columna W CDO) for filter dropdown
  const statusDisponibles = React.useMemo(() => {
    if (!actividades) return [];
    const set = new Set<string>();
    actividades.forEach(i => {
      if (i.esItemHoja) {
        const st = (i.p6Status || i.status || i.p6 || '').trim();
        if (st) set.add(st);
      }
    });
    return Array.from(set).sort();
  }, [actividades]);

  // Unique SubC list (columna N CDO) for filter dropdown
  const subCsDisponibles = React.useMemo(() => {
    if (!actividades) return [];
    const set = new Set<string>();
    actividades.forEach(i => {
      if (i.esItemHoja) {
        const sub = (i.subcontratista || i.subC || '').trim() || '(Sin SubC)';
        set.add(sub);
      }
    });
    return Array.from(set).sort((a, b) => {
      if (a === '(Sin SubC)') return 1;
      if (b === '(Sin SubC)') return -1;
      return a.localeCompare(b);
    });
  }, [actividades]);

  // Filtered SubC list based on search query
  const filteredSubCs = React.useMemo(() => {
    if (!subCSearchQuery.trim()) return subCsDisponibles;
    const q = subCSearchQuery.toLowerCase().trim();
    return subCsDisponibles.filter(sub => sub.toLowerCase().includes(q));
  }, [subCsDisponibles, subCSearchQuery]);

  // Auto-focus search input when SubC dropdown opens
  React.useEffect(() => {
    if (isSubCDropdownOpen) {
      setTimeout(() => {
        subCSearchInputRef.current?.focus();
      }, 60);
    }
  }, [isSubCDropdownOpen]);

  // Unique P.Ac list (columna AO CDO) for filter dropdown
  const pacsDisponibles = React.useMemo(() => {
    if (!actividades) return [];
    const set = new Set<string>();
    actividades.forEach(i => {
      if (i.esItemHoja) {
        const val = (i.pAc || '').trim() || '(Sin P.Ac)';
        set.add(val);
      }
    });
    return Array.from(set).sort((a, b) => {
      if (a === '(Sin P.Ac)') return 1;
      if (b === '(Sin P.Ac)') return -1;
      return a.localeCompare(b);
    });
  }, [actividades]);

  // Active Tipología Set
  const activeTipologiaSet = React.useMemo(() => {
    if (isAllTipologiasSelected) return new Set(tipologíasDisponibles);
    return selectedTipologias;
  }, [isAllTipologiasSelected, selectedTipologias, tipologíasDisponibles]);

  // Active Status Set
  const activeStatusSet = React.useMemo(() => {
    if (isAllStatusSelected) return new Set(statusDisponibles);
    return selectedStatuses;
  }, [isAllStatusSelected, selectedStatuses, statusDisponibles]);

  // Active SubC Set
  const activeSubCSet = React.useMemo(() => {
    if (isAllSubCsSelected) return new Set(subCsDisponibles);
    return selectedSubCs;
  }, [isAllSubCsSelected, selectedSubCs, subCsDisponibles]);

  // Active P.Ac Set
  const activePAcSet = React.useMemo(() => {
    if (isAllPAcSelected) return new Set(pacsDisponibles);
    return selectedPAcs;
  }, [isAllPAcSelected, selectedPAcs, pacsDisponibles]);

  // Unique Partidas list (columna AC CDO) for filter dropdown
  const partidasDisponibles = React.useMemo(() => {
    if (!actividades) return [];
    const set = new Set<string>();
    actividades.forEach(i => {
      if (i.esItemHoja) {
        const val = (i.partidas || (i as any).partida || '').trim() || '(Sin Partida)';
        set.add(val);
      }
    });
    return Array.from(set).sort((a, b) => {
      if (a === '(Sin Partida)') return 1;
      if (b === '(Sin Partida)') return -1;
      return a.localeCompare(b);
    });
  }, [actividades]);

  // Active Partidas Set
  const activePartidasSet = React.useMemo(() => {
    if (isAllPartidasSelected) return new Set(partidasDisponibles);
    return selectedPartidas;
  }, [isAllPartidasSelected, selectedPartidas, partidasDisponibles]);

  const handleSelectAllTipologias = () => {
    setIsAllTipologiasSelected(true);
    setSelectedTipologias(new Set(tipologíasDisponibles));
  };

  const handleDeselectAllTipologias = () => {
    setIsAllTipologiasSelected(false);
    setSelectedTipologias(new Set());
  };

  const handleToggleTipologia = (tipo: string) => {
    if (isAllTipologiasSelected) {
      const next = new Set(tipologíasDisponibles);
      next.delete(tipo);
      setIsAllTipologiasSelected(false);
      setSelectedTipologias(next);
    } else {
      const next = new Set(selectedTipologias);
      if (next.has(tipo)) {
        next.delete(tipo);
      } else {
        next.add(tipo);
      }
      if (next.size === tipologíasDisponibles.length && tipologíasDisponibles.length > 0) {
        setIsAllTipologiasSelected(true);
      }
      setSelectedTipologias(next);
    }
  };

  const getTipologiaFilterLabel = () => {
    if (isAllTipologiasSelected || activeTipologiaSet.size === tipologíasDisponibles.length) {
      return "Todas las Tipologías";
    }
    if (activeTipologiaSet.size === 0) {
      return "Ninguna Tipología (0)";
    }
    if (activeTipologiaSet.size === 1) {
      const single = Array.from(activeTipologiaSet)[0];
      return single.includes('.') ? single.split('.')[1] : single;
    }
    return `${activeTipologiaSet.size} de ${tipologíasDisponibles.length} Tipologías`;
  };

  const handleSelectAllStatus = () => {
    setIsAllStatusSelected(true);
    setSelectedStatuses(new Set(statusDisponibles));
  };

  const handleDeselectAllStatus = () => {
    setIsAllStatusSelected(false);
    setSelectedStatuses(new Set());
  };

  const handleToggleStatus = (st: string) => {
    if (isAllStatusSelected) {
      const next = new Set(statusDisponibles);
      next.delete(st);
      setIsAllStatusSelected(false);
      setSelectedStatuses(next);
    } else {
      const next = new Set(selectedStatuses);
      if (next.has(st)) {
        next.delete(st);
      } else {
        next.add(st);
      }
      if (next.size === statusDisponibles.length && statusDisponibles.length > 0) {
        setIsAllStatusSelected(true);
      }
      setSelectedStatuses(next);
    }
  };

  const getStatusFilterLabel = () => {
    if (isAllStatusSelected || activeStatusSet.size === statusDisponibles.length) {
      return "Todos los Status";
    }
    if (activeStatusSet.size === 0) {
      return "Ningún Status (0)";
    }
    if (activeStatusSet.size === 1) {
      return Array.from(activeStatusSet)[0];
    }
    return `${activeStatusSet.size} de ${statusDisponibles.length} Status`;
  };

  const handleSelectAllSubCs = () => {
    setIsAllSubCsSelected(true);
    setSelectedSubCs(new Set(subCsDisponibles));
  };

  const handleDeselectAllSubCs = () => {
    setIsAllSubCsSelected(false);
    setSelectedSubCs(new Set());
  };

  const handleToggleSubC = (sub: string) => {
    if (isAllSubCsSelected) {
      const next = new Set(subCsDisponibles);
      next.delete(sub);
      setIsAllSubCsSelected(false);
      setSelectedSubCs(next);
    } else {
      const next = new Set(selectedSubCs);
      if (next.has(sub)) {
        next.delete(sub);
      } else {
        next.add(sub);
      }
      if (next.size === subCsDisponibles.length && subCsDisponibles.length > 0) {
        setIsAllSubCsSelected(true);
      }
      setSelectedSubCs(next);
    }
  };

  const getSubCFilterLabel = () => {
    if (isAllSubCsSelected || activeSubCSet.size === subCsDisponibles.length) {
      return "Todos los SubC";
    }
    if (activeSubCSet.size === 0) {
      return "Ningún SubC (0)";
    }
    if (activeSubCSet.size === 1) {
      return Array.from(activeSubCSet)[0];
    }
    return `${activeSubCSet.size} de ${subCsDisponibles.length} SubC`;
  };

  const handleSelectAllPAc = () => {
    setIsAllPAcSelected(true);
    setSelectedPAcs(new Set(pacsDisponibles));
  };

  const handleDeselectAllPAc = () => {
    setIsAllPAcSelected(false);
    setSelectedPAcs(new Set());
  };

  const handleTogglePAc = (pacVal: string) => {
    if (isAllPAcSelected) {
      const next = new Set(pacsDisponibles);
      next.delete(pacVal);
      setIsAllPAcSelected(false);
      setSelectedPAcs(next);
    } else {
      const next = new Set(selectedPAcs);
      if (next.has(pacVal)) {
        next.delete(pacVal);
      } else {
        next.add(pacVal);
      }
      if (next.size === pacsDisponibles.length && pacsDisponibles.length > 0) {
        setIsAllPAcSelected(true);
      }
      setSelectedPAcs(next);
    }
  };

  const getPAcFilterLabel = () => {
    if (isAllPAcSelected || activePAcSet.size === pacsDisponibles.length) {
      return "Todos los P.Ac";
    }
    if (activePAcSet.size === 0) {
      return "Ningún P.Ac (0)";
    }
    if (activePAcSet.size === 1) {
      return Array.from(activePAcSet)[0];
    }
    return `${activePAcSet.size} de ${pacsDisponibles.length} P.Ac`;
  };

  const handleSelectAllPartidas = () => {
    setIsAllPartidasSelected(true);
    setSelectedPartidas(new Set(partidasDisponibles));
  };

  const handleDeselectAllPartidas = () => {
    setIsAllPartidasSelected(false);
    setSelectedPartidas(new Set());
  };

  const handleTogglePartida = (partidaVal: string) => {
    if (isAllPartidasSelected) {
      const next = new Set(partidasDisponibles);
      next.delete(partidaVal);
      setIsAllPartidasSelected(false);
      setSelectedPartidas(next);
    } else {
      const next = new Set(selectedPartidas);
      if (next.has(partidaVal)) {
        next.delete(partidaVal);
      } else {
        next.add(partidaVal);
      }
      if (next.size === partidasDisponibles.length && partidasDisponibles.length > 0) {
        setIsAllPartidasSelected(true);
      }
      setSelectedPartidas(next);
    }
  };

  const getPartidasFilterLabel = () => {
    if (isAllPartidasSelected || activePartidasSet.size === partidasDisponibles.length) {
      return "Todas las Partidas";
    }
    if (activePartidasSet.size === 0) {
      return "Ninguna Partida (0)";
    }
    if (activePartidasSet.size === 1) {
      return Array.from(activePartidasSet)[0];
    }
    return `${activePartidasSet.size} de ${partidasDisponibles.length} Partidas`;
  };

  const getVariacionFilterLabel = () => {
    switch (filterVariacion) {
      case 'neg':
        return 'Retrasos (-)';
      case 'pos':
        return 'Adelantos (+)';
      default:
        return 'Todos';
    }
  };

  // Reset all filters helper
  const handleResetAllFilters = React.useCallback(() => {
    setIsAllSelected(true);
    setSelectedWeeks(new Set());
    setIsAllTipologiasSelected(true);
    setSelectedTipologias(new Set());
    setIsAllStatusSelected(true);
    setSelectedStatuses(new Set());
    setIsAllSubCsSelected(true);
    setSelectedSubCs(new Set());
    setIsAllPAcSelected(true);
    setSelectedPAcs(new Set());
    setIsAllPartidasSelected(true);
    setSelectedPartidas(new Set());
    setPartidasSearchQuery('');
    setSubCSearchQuery('');
    setFilterPartidaD('all');
    setFilterVariacion('all');
    setFilterPlanEjec('all');
    setSearchQuery('');
    setFilterCheckSet('all');
    setFilterFloatNegativo(false);
  }, []);

  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (!isAllSelected && selectedWeeks.size > 0 && selectedWeeks.size < availableWeeks.length) count++;
    if (!isAllTipologiasSelected && selectedTipologias.size > 0 && selectedTipologias.size < tipologíasDisponibles.length) count++;
    if (!isAllStatusSelected && selectedStatuses.size > 0 && selectedStatuses.size < statusDisponibles.length) count++;
    if (!isAllSubCsSelected && selectedSubCs.size > 0 && selectedSubCs.size < subCsDisponibles.length) count++;
    if (!isAllPAcSelected && selectedPAcs.size > 0 && selectedPAcs.size < pacsDisponibles.length) count++;
    if (!isAllPartidasSelected && selectedPartidas.size > 0 && selectedPartidas.size < partidasDisponibles.length) count++;
    if (filterPartidaD !== 'all') count++;
    if (filterVariacion !== 'all') count++;
    if (filterPlanEjec !== 'all') count++;
    if (filterFloatNegativo) count++;
    if (searchQuery.trim() !== '') count++;
    if (filterCheckSet !== 'all') count++;
    return count;
  }, [
    isAllSelected, selectedWeeks.size, availableWeeks.length,
    isAllTipologiasSelected, selectedTipologias.size, tipologíasDisponibles.length,
    isAllStatusSelected, selectedStatuses.size, statusDisponibles.length,
    isAllSubCsSelected, selectedSubCs.size, subCsDisponibles.length,
    isAllPAcSelected, selectedPAcs.size, pacsDisponibles.length,
    isAllPartidasSelected, selectedPartidas.size, partidasDisponibles.length,
    filterPartidaD, filterVariacion, filterPlanEjec, filterFloatNegativo, searchQuery, filterCheckSet
  ]);

  const hasActiveFilters = activeFiltersCount > 0;
  const isPartidaD = React.useCallback((item: any): boolean => {
    if (!item) return false;
    const rawWbs = String(item.wbs || item.wbsPath || (item as any).wbsRaw || '').trim();
    if (rawWbs) {
      if (hasDirectoOrDSegment(rawWbs)) return true;
      const normWbs = rawWbs.replace(/^p\d{4}\./i, 'p.').toLowerCase();
      if (normWbs === 'p.d' || normWbs.startsWith('p.d.')) return true;
      const lowerRaw = rawWbs.toLowerCase();
      if (lowerRaw === 'd' || lowerRaw.startsWith('d.') || lowerRaw.startsWith('p.d')) return true;
      const parts = lowerRaw.split('.');
      if (parts.length >= 2 && parts[1] === 'd') return true;
    }
    const partidaStr = String(item.partida || item.partidas || '').trim().toLowerCase();
    if (partidaStr) {
      if (partidaStr === 'd' || partidaStr.startsWith('p.d') || partidaStr.startsWith('d.') || partidaStr.startsWith('partida d') || partidaStr === 'partidas directas / adicionales') return true;
    }
    const capStr = String(item.cap || '').trim().toLowerCase();
    if (capStr === 'd' || capStr.startsWith('d.') || capStr.startsWith('partida d')) return true;
    return false;
  }, []);

  const baseLeafItems = React.useMemo(() => {
    if (!actividades) return [];
    const isTotalMode = isAllSelected || activeWeekSet.size === availableWeeks.length;

    return actividades.filter(item => {
      if (!item.esItemHoja) return false;

      if (filterFloatNegativo) {
        const tf = item.totalFloat !== undefined ? item.totalFloat : (item.tf !== undefined ? item.tf : item.float);
        if (tf === null || tf === undefined || isNaN(Number(tf)) || Number(tf) >= 0) {
          return false;
        }
      }

      if (filterPartidaD === 'exclude_d' && isPartidaD(item)) return false;
      if (filterPartidaD === 'only_d' && !isPartidaD(item)) return false;

      const { vPlan, vEjec, variacion } = getItemWeekValues(item);

      if (!isTotalMode) {
        if (vPlan === 0 && vEjec === 0) return false;
      }

      if (!isAllTipologiasSelected && activeTipologiaSet.size < tipologíasDisponibles.length) {
        if (!activeTipologiaSet.has(item.tipo)) return false;
      }

      if (!isAllStatusSelected && activeStatusSet.size < statusDisponibles.length) {
        const itemSt = (item.p6Status || item.status || item.p6 || '').trim();
        if (!activeStatusSet.has(itemSt)) return false;
      }

      if (!isAllSubCsSelected && activeSubCSet.size < subCsDisponibles.length) {
        const itemSubC = (item.subcontratista || item.subC || '').trim() || '(Sin SubC)';
        if (!activeSubCSet.has(itemSubC)) return false;
      }

      if (!isAllPAcSelected && activePAcSet.size < pacsDisponibles.length) {
        const itemPAc = (item.pAc || '').trim() || '(Sin P.Ac)';
        if (!activePAcSet.has(itemPAc)) return false;
      }

      if (!isAllPartidasSelected && activePartidasSet.size < partidasDisponibles.length) {
        const itemPartida = (item.partidas || (item as any).partida || '').trim() || '(Sin Partida)';
        if (!activePartidasSet.has(itemPartida)) return false;
      }

      // Exclude cent-level negative variations (e.g. -0.01 to -0.99) caused by rounding from Retrasos
      if (filterVariacion === 'neg' && variacion >= -1) return false;
      if (filterVariacion === 'pos' && variacion <= 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const wbs = String(item.wbs || '').toLowerCase();
        const act = String(item.activityId || '').toLowerCase();
        const desc = String(item.descripcion || '').toLowerCase();
        const sub = String(item.subcontratista || item.subC || '').toLowerCase();
        const part = String(item.partidas || (item as any).partida || '').toLowerCase();
        if (!wbs.includes(q) && !act.includes(q) && !desc.includes(q) && !sub.includes(q) && !part.includes(q)) {
          return false;
        }
      }

      if (filterCheckSet !== 'all') {
        const as = item.ventaPlan || 0;
        const av = item.ventaEjecutada || 0;
        const diff = as - av;
        if (filterCheckSet === 'en_plazo' && Math.abs(diff) > 1) return false;
        if (filterCheckSet === 'retraso' && diff <= 1) return false;
        if (filterCheckSet === 'adelanto' && diff >= -1) return false;
      }

      return true;
    });
  }, [
    actividades, getItemWeekValues, isAllSelected, activeWeekSet, availableWeeks.length,
    isAllTipologiasSelected, activeTipologiaSet, tipologíasDisponibles.length,
    isAllStatusSelected, activeStatusSet, statusDisponibles.length,
    isAllSubCsSelected, activeSubCSet, subCsDisponibles.length,
    isAllPAcSelected, activePAcSet, pacsDisponibles.length,
    isAllPartidasSelected, activePartidasSet, partidasDisponibles.length,
    filterVariacion, searchQuery, filterPartidaD, isPartidaD, filterCheckSet, filterFloatNegativo
  ]);

  const leafItems = React.useMemo(() => {
    if (filterPlanEjec === 'plan') {
      return baseLeafItems.filter(item => {
        const { vPlan } = getItemWeekValues(item);
        return vPlan > 0.001;
      });
    }
    if (filterPlanEjec === 'ejec') {
      return baseLeafItems.filter(item => {
        const { vEjec } = getItemWeekValues(item);
        return vEjec > 0.001;
      });
    }
    return baseLeafItems;
  }, [baseLeafItems, filterPlanEjec, getItemWeekValues]);

  // Summary per Tipología for summary cards
  const tipologiasSummary = React.useMemo(() => {
    if (!actividades) return [];
    const map: Record<string, { nombre: string; ventaPlan: number; ventaEjecutada: number; ventaContrato: number; items: number }> = {};

    const isTotalMode = isAllSelected || activeWeekSet.size === availableWeeks.length;

    actividades.forEach(item => {
      if (!item.esItemHoja) return;

      if (filterFloatNegativo) {
        const tf = item.totalFloat !== undefined ? item.totalFloat : (item.tf !== undefined ? item.tf : item.float);
        if (tf === null || tf === undefined || isNaN(Number(tf)) || Number(tf) >= 0) return;
      }

      if (filterPartidaD === 'exclude_d' && isPartidaD(item)) return;
      if (filterPartidaD === 'only_d' && !isPartidaD(item)) return;

      const { vPlan, vEjec, vContrato, variacion } = getItemWeekValues(item);

      if (!isTotalMode) {
        if (vPlan === 0 && vEjec === 0) return;
      }

      if (!isAllStatusSelected && activeStatusSet.size < statusDisponibles.length) {
        const itemSt = (item.p6Status || item.status || item.p6 || '').trim();
        if (!activeStatusSet.has(itemSt)) return;
      }

      if (!isAllSubCsSelected && activeSubCSet.size < subCsDisponibles.length) {
        const itemSubC = (item.subcontratista || item.subC || '').trim() || '(Sin SubC)';
        if (!activeSubCSet.has(itemSubC)) return;
      }

      // Exclude cent-level negative variations (e.g. -0.01 to -0.99) caused by rounding from Retrasos
      if (filterVariacion === 'neg' && variacion >= -1) return;
      if (filterVariacion === 'pos' && variacion <= 0) return;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const wbs = String(item.wbs || '').toLowerCase();
        const act = String(item.activityId || '').toLowerCase();
        const desc = String(item.descripcion || '').toLowerCase();
        const sub = String(item.subcontratista || item.subC || '').toLowerCase();
        if (!wbs.includes(q) && !act.includes(q) && !desc.includes(q) && !sub.includes(q)) {
          return;
        }
      }

      const tipo = item.tipo || '(Sin Tipo)';
      if (!map[tipo]) {
        map[tipo] = { nombre: tipo, ventaPlan: 0, ventaEjecutada: 0, ventaContrato: 0, items: 0 };
      }
      map[tipo].ventaPlan += vPlan;
      map[tipo].ventaEjecutada += vEjec;
      map[tipo].ventaContrato += vContrato;
      map[tipo].items += 1;
    });

    return Object.values(map)
      .map(t => {
        const desviacion = t.ventaEjecutada - t.ventaPlan;
        const avance = t.ventaPlan > 0 ? ((t.ventaEjecutada / t.ventaPlan) * 100).toFixed(2) : '0.00';
        return { ...t, desviacion, avance };
      })
      .sort((a, b) => b.items - a.items || a.nombre.localeCompare(b.nombre));
  }, [
    actividades, getItemWeekValues, isAllSelected, activeWeekSet, availableWeeks.length,
    isAllStatusSelected, activeStatusSet, statusDisponibles.length,
    isAllSubCsSelected, activeSubCSet, subCsDisponibles.length,
    filterVariacion, searchQuery, filterPartidaD, isPartidaD, filterFloatNegativo
  ]);

  // Hierarchical grouping: Componente (Col. AN) -> Tipo -> Grupo -> CAP -> SCAP -> SubC -> Items
  const byHierarchy = React.useMemo(() => {
    const tree: Record<string, Record<string, Record<string, Record<string, Record<string, Record<string, any[]>>>>>> = {};
    leafItems.forEach(item => {
      const comp = (item.componente || '').trim() || '(Sin Componente)';
      const t = item.tipo || '(Sin Tipo)';
      const g = item.grupo || '(Sin Grupo)';
      const c = item.cap || '(Sin CAP)';
      const s = item.scap || '(Sin SCAP)';
      const subC = (item.subcontratista || item.subC || '').trim() || '(Sin SubC)';

      if (!tree[comp]) tree[comp] = {};
      if (!tree[comp][t]) tree[comp][t] = {};
      if (!tree[comp][t][g]) tree[comp][t][g] = {};
      if (!tree[comp][t][g][c]) tree[comp][t][g][c] = {};
      if (!tree[comp][t][g][c][s]) tree[comp][t][g][c][s] = {};
      if (!tree[comp][t][g][c][s][subC]) tree[comp][t][g][c][s][subC] = [];
      tree[comp][t][g][c][s][subC].push(item);
    });
    return tree;
  }, [leafItems]);

  const getItemsInComponente = React.useCallback((tipos: any) => {
    return Object.values(tipos).flatMap((grupos: any) =>
      Object.values(grupos).flatMap((caps: any) =>
        Object.values(caps).flatMap((scaps: any) =>
          Object.values(scaps).flatMap((subCs: any) =>
            Object.values(subCs).flat()
          )
        )
      )
    );
  }, []);

  const getItemsInTipo = React.useCallback((grupos: any) => {
    return Object.values(grupos).flatMap((caps: any) =>
      Object.values(caps).flatMap((scaps: any) =>
        Object.values(scaps).flatMap((subCs: any) =>
          Object.values(subCs).flat()
        )
      )
    );
  }, []);

  const getItemsInGrupo = React.useCallback((caps: any) => {
    return Object.values(caps).flatMap((scaps: any) =>
      Object.values(scaps).flatMap((subCs: any) =>
        Object.values(subCs).flat()
      )
    );
  }, []);

  const getItemsInCap = React.useCallback((scaps: any) => {
    return Object.values(scaps).flatMap((subCs: any) =>
      Object.values(subCs).flat()
    );
  }, []);

  const tot = React.useCallback((itemsArr: any[]) => {
    let plan = 0;
    let ejec = 0;
    let contrato = 0;
    let sobreEjec = 0;
    let maxBlFinish: Date | null = null;

    itemsArr.forEach(i => {
      const { vPlan, vEjec, vContrato, sobreEjecucion } = getItemWeekValues(i);
      plan += vPlan;
      ejec += vEjec;
      contrato += vContrato;
      sobreEjec += (sobreEjecucion || 0);

      if (i.blFinish) {
        const dt = i.blFinish instanceof Date ? i.blFinish : new Date(i.blFinish);
        if (!isNaN(dt.getTime())) {
          if (!maxBlFinish || dt > maxBlFinish) maxBlFinish = dt;
        }
      }
    });

    return {
      count: itemsArr.length,
      plan,
      ejec,
      contrato,
      sobreEjec,
      desv: ejec - plan,
      maxBlFinish
    };
  }, [getItemWeekValues]);

  const getAccumulatedCheckSet = React.useCallback((itemsArr: any[]) => {
    let as = 0;
    let av = 0;
    itemsArr.forEach(i => {
      as += (i.ventaPlan || 0);
      av += (i.ventaEjecutada || 0);
    });
    
    const diff = as - av;
    if (Math.abs(diff) <= 1) return { text: 'En Plazo', bg: 'bg-slate-100', textC: 'text-slate-600', dot: 'bg-slate-400' };
    if (as > av) return { text: 'Retraso', bg: 'bg-rose-100', textC: 'text-rose-700', dot: 'bg-rose-500' };
    return { text: 'Adelanto', bg: 'bg-emerald-100', textC: 'text-emerald-700', dot: 'bg-emerald-500' };
  }, []);

  const kpiTot = React.useMemo(() => tot(baseLeafItems), [tot, baseLeafItems]);
  const globalTot = React.useMemo(() => tot(leafItems), [tot, leafItems]);

  // Total V. Contrato of all raw activities without any search/status filters
  const totalVContratoUnfiltered = React.useMemo(() => {
    if (!actividades || !Array.isArray(actividades)) return 0;
    return actividades.reduce((sum: number, act: any) => {
      if (!act.esItemHoja) return sum;
      return sum + (Number(act.venta) || 0);
    }, 0);
  }, [actividades]);

  // Map of total V. Contrato per component of all raw activities without any search/status filters
  const totalVContratoByComponentUnfiltered = React.useMemo(() => {
    const map = new Map<string, number>();
    if (!actividades || !Array.isArray(actividades)) return map;
    actividades.forEach((act: any) => {
      if (!act.esItemHoja) return;
      const comp = (act.componente || '').trim() || '(Sin Componente)';
      const v = Number(act.venta) || 0;
      map.set(comp, (map.get(comp) || 0) + v);
    });
    return map;
  }, [actividades]);

  // Statistics on how many planned activities have execution in the active period
  const planEjecStats = React.useMemo(() => {
    let plannedCount = 0;
    let plannedWithEjecCount = 0;
    let ejecCount = 0;
    let ejecWithPlanCount = 0;

    baseLeafItems.forEach(item => {
      const { vPlan, vEjec } = getItemWeekValues(item);
      const hasPlan = vPlan > 0.001;
      const hasEjec = vEjec > 0.001;

      if (hasPlan) {
        plannedCount++;
        if (hasEjec) plannedWithEjecCount++;
      }
      if (hasEjec) {
        ejecCount++;
        if (hasPlan) ejecWithPlanCount++;
      }
    });

    return {
      plannedCount,
      plannedWithEjecCount,
      ejecCount,
      ejecWithPlanCount,
    };
  }, [baseLeafItems, getItemWeekValues]);

  const checkSetSummary = React.useMemo(() => {
    const summary: Record<string, {
      checkSetProps: any,
      tipologias: Record<string, { plan: number, ejec: number, sobreEjec: number, desv: number, count: number }>,
      totalPlan: number,
      totalEjec: number,
      totalSobreEjec: number,
      totalDesv: number,
      totalCount: number
    }> = {};

    leafItems.forEach(item => {
      const cs = getAccumulatedCheckSet([item]);
      const csKey = cs.text;
      if (!summary[csKey]) {
        summary[csKey] = {
          checkSetProps: cs,
          tipologias: {},
          totalPlan: 0,
          totalEjec: 0,
          totalSobreEjec: 0,
          totalDesv: 0,
          totalCount: 0
        };
      }
      
      const tipo = item.tipo || 'Sin Tipo';
      if (!summary[csKey].tipologias[tipo]) {
        summary[csKey].tipologias[tipo] = { plan: 0, ejec: 0, sobreEjec: 0, desv: 0, count: 0 };
      }
      
      const { vPlan, vEjec, variacion, sobreEjecucion } = getItemWeekValues(item);
      
      summary[csKey].tipologias[tipo].plan += vPlan;
      summary[csKey].tipologias[tipo].ejec += vEjec;
      summary[csKey].tipologias[tipo].sobreEjec += (sobreEjecucion || 0);
      summary[csKey].tipologias[tipo].desv += variacion;
      summary[csKey].tipologias[tipo].count += 1;
      
      summary[csKey].totalPlan += vPlan;
      summary[csKey].totalEjec += vEjec;
      summary[csKey].totalSobreEjec += (sobreEjecucion || 0);
      summary[csKey].totalDesv += variacion;
      summary[csKey].totalCount += 1;
    });

    // Ordenar Check Sets para que tengan un orden predecible
    const ordenCheckSets = ['Adelanto', 'En Plazo', 'Retraso'];
    
    return Object.entries(summary).sort((a, b) => {
       const idxA = ordenCheckSets.indexOf(a[0]);
       const idxB = ordenCheckSets.indexOf(b[0]);
       return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });
  }, [leafItems, getAccumulatedCheckSet, getItemWeekValues]);


  const compareHierarchy = React.useCallback((keyA: string, keyB: string, getItemsA: () => any[], getItemsB: () => any[]) => {
    let diff = 0;
    const itemsA = getItemsA();
    const itemsB = getItemsB();
    const totA = tot(itemsA);
    const totB = tot(itemsB);

    switch (sortColumn) {
      case 'wbs':
        diff = keyA.localeCompare(keyB, undefined, { numeric: true, sensitivity: 'base' });
        break;
      case 'activityId':
        diff = totA.count - totB.count;
        if (diff === 0) diff = keyA.localeCompare(keyB, undefined, { numeric: true, sensitivity: 'base' });
        break;
      case 'descripcion':
        diff = keyA.localeCompare(keyB, undefined, { sensitivity: 'base' });
        break;
      case 'blFinish': {
        const timeA = totA.maxBlFinish instanceof Date ? totA.maxBlFinish.getTime() : (totA.maxBlFinish ? new Date(totA.maxBlFinish).getTime() : 0);
        const timeB = totB.maxBlFinish instanceof Date ? totB.maxBlFinish.getTime() : (totB.maxBlFinish ? new Date(totB.maxBlFinish).getTime() : 0);
        const validA = !isNaN(timeA) && timeA > 0;
        const validB = !isNaN(timeB) && timeB > 0;
        if (!validA && !validB) diff = 0;
        else if (!validA) diff = 1;
        else if (!validB) diff = -1;
        else diff = timeA - timeB;
        break;
      }
      case 'contrato':
        diff = totA.contrato - totB.contrato;
        break;
      case 'plan':
        diff = totA.plan - totB.plan;
        break;
      case 'ejec':
        diff = totA.ejec - totB.ejec;
        break;
      case 'sobreEjec':
        diff = (totA.sobreEjec || 0) - (totB.sobreEjec || 0);
        break;
      case 'pctPlan': {
        const compUnfilteredContratoA = totalVContratoByComponentUnfiltered.get(keyA) || 0;
        const compBasePctA = modoPorcentaje === 'ponderado'
          ? (compUnfilteredContratoA > 0 ? compUnfilteredContratoA : (totA.contrato > 0 ? totA.contrato : 0))
          : totalVContratoUnfiltered;
        const pctA = compBasePctA > 0 ? (totA.plan / compBasePctA) * 100 : 0;

        const compUnfilteredContratoB = totalVContratoByComponentUnfiltered.get(keyB) || 0;
        const compBasePctB = modoPorcentaje === 'ponderado'
          ? (compUnfilteredContratoB > 0 ? compUnfilteredContratoB : (totB.contrato > 0 ? totB.contrato : 0))
          : totalVContratoUnfiltered;
        const pctB = compBasePctB > 0 ? (totB.plan / compBasePctB) * 100 : 0;
        diff = pctA - pctB;
        break;
      }
      case 'pctEjec': {
        const compUnfilteredContratoA = totalVContratoByComponentUnfiltered.get(keyA) || 0;
        const compBasePctA = modoPorcentaje === 'ponderado'
          ? (compUnfilteredContratoA > 0 ? compUnfilteredContratoA : (totA.contrato > 0 ? totA.contrato : 0))
          : totalVContratoUnfiltered;
        const pctA = compBasePctA > 0 ? (totA.ejec / compBasePctA) * 100 : 0;

        const compUnfilteredContratoB = totalVContratoByComponentUnfiltered.get(keyB) || 0;
        const compBasePctB = modoPorcentaje === 'ponderado'
          ? (compUnfilteredContratoB > 0 ? compUnfilteredContratoB : (totB.contrato > 0 ? totB.contrato : 0))
          : totalVContratoUnfiltered;
        const pctB = compBasePctB > 0 ? (totB.ejec / compBasePctB) * 100 : 0;
        diff = pctA - pctB;
        break;
      }
      case 'variacion':
        if (soloTablaYSemana) {
          const compUnfilteredContratoA = totalVContratoByComponentUnfiltered.get(keyA) || 0;
          const compBasePctA = modoPorcentaje === 'ponderado'
            ? (compUnfilteredContratoA > 0 ? compUnfilteredContratoA : (totA.contrato > 0 ? totA.contrato : 0))
            : totalVContratoUnfiltered;
          const pctDesvA = compBasePctA > 0 ? ((totA.ejec - totA.plan) / compBasePctA) * 100 : 0;

          const compUnfilteredContratoB = totalVContratoByComponentUnfiltered.get(keyB) || 0;
          const compBasePctB = modoPorcentaje === 'ponderado'
            ? (compUnfilteredContratoB > 0 ? compUnfilteredContratoB : (totB.contrato > 0 ? totB.contrato : 0))
            : totalVContratoUnfiltered;
          const pctDesvB = compBasePctB > 0 ? ((totB.ejec - totB.plan) / compBasePctB) * 100 : 0;
          diff = pctDesvA - pctDesvB;
        } else {
          diff = totA.desv - totB.desv;
        }
        break;
      case 'pctAvance': {
        const pctA = totA.plan > 0 ? (totA.ejec / totA.plan * 100) : (totA.ejec > 0 ? 100 : 0);
        const pctB = totB.plan > 0 ? (totB.ejec / totB.plan * 100) : (totB.ejec > 0 ? 100 : 0);
        diff = pctA - pctB;
        break;
      }
      case 'checkSet': {
        const rank = (text: string) => {
          if (text === 'Retraso') return 1;
          if (text === 'En Plazo') return 2;
          if (text === 'Adelanto') return 3;
          return 4;
        };
        const csA = getAccumulatedCheckSet(itemsA);
        const csB = getAccumulatedCheckSet(itemsB);
        diff = rank(csA.text) - rank(csB.text);
        break;
      }
      default:
        diff = keyA.localeCompare(keyB, undefined, { numeric: true, sensitivity: 'base' });
    }

    return sortDirection === 'asc' ? diff : -diff;
  }, [sortColumn, sortDirection, tot, soloTablaYSemana, totalVContratoByComponentUnfiltered, totalVContratoUnfiltered, modoPorcentaje, getAccumulatedCheckSet]);

  const compareLeafItems = React.useCallback((itemA: any, itemB: any) => {
    let diff = 0;
    const vA = getItemWeekValues(itemA);
    const vB = getItemWeekValues(itemB);

    switch (sortColumn) {
      case 'wbs': {
        const strA = String(itemA.wbs || itemA.activityId || '');
        const strB = String(itemB.wbs || itemB.activityId || '');
        diff = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
        break;
      }
      case 'activityId': {
        const strA = String(itemA.activityId || itemA.wbs || '');
        const strB = String(itemB.activityId || itemB.wbs || '');
        diff = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
        break;
      }
      case 'descripcion': {
        const strA = String(itemA.descripcion || '');
        const strB = String(itemB.descripcion || '');
        diff = strA.localeCompare(strB, undefined, { sensitivity: 'base' });
        break;
      }
      case 'blFinish': {
        const timeA = itemA.blFinish instanceof Date ? itemA.blFinish.getTime() : (itemA.blFinish ? new Date(itemA.blFinish).getTime() : 0);
        const timeB = itemB.blFinish instanceof Date ? itemB.blFinish.getTime() : (itemB.blFinish ? new Date(itemB.blFinish).getTime() : 0);
        const validA = !isNaN(timeA) && timeA > 0;
        const validB = !isNaN(timeB) && timeB > 0;
        if (!validA && !validB) diff = 0;
        else if (!validA) diff = 1;
        else if (!validB) diff = -1;
        else diff = timeA - timeB;
        break;
      }
      case 'contrato':
        diff = vA.vContrato - vB.vContrato;
        break;
      case 'plan':
        diff = vA.vPlan - vB.vPlan;
        break;
      case 'ejec':
        diff = vA.vEjec - vB.vEjec;
        break;
      case 'sobreEjec':
        diff = (vA.sobreEjecucion || 0) - (vB.sobreEjecucion || 0);
        break;
      case 'pctPlan': {
        const pctA = vA.vContrato > 0 ? (vA.vPlan / vA.vContrato) * 100 : 0;
        const pctB = vB.vContrato > 0 ? (vB.vPlan / vB.vContrato) * 100 : 0;
        diff = pctA - pctB;
        break;
      }
      case 'pctEjec': {
        const pctA = vA.vContrato > 0 ? (vA.vEjec / vA.vContrato) * 100 : 0;
        const pctB = vB.vContrato > 0 ? (vB.vEjec / vB.vContrato) * 100 : 0;
        diff = pctA - pctB;
        break;
      }
      case 'variacion':
        diff = vA.variacion - vB.variacion;
        break;
      case 'pctAvance': {
        const pctA = vA.vPlan > 0 ? (vA.vEjec / vA.vPlan * 100) : (vA.vEjec > 0 ? 100 : 0);
        const pctB = vB.vPlan > 0 ? (vB.vEjec / vB.vPlan * 100) : (vB.vEjec > 0 ? 100 : 0);
        diff = pctA - pctB;
        break;
      }
      case 'checkSet': {
        const rank = (text: string) => {
          if (text === 'Retraso') return 1;
          if (text === 'En Plazo') return 2;
          if (text === 'Adelanto') return 3;
          return 4;
        };
        const csA = getAccumulatedCheckSet([itemA]);
        const csB = getAccumulatedCheckSet([itemB]);
        diff = rank(csA.text) - rank(csB.text);
        break;
      }
      default: {
        const strA = String(itemA.wbs || itemA.activityId || '');
        const strB = String(itemB.wbs || itemB.activityId || '');
        diff = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
      }
    }

    return sortDirection === 'asc' ? diff : -diff;
  }, [sortColumn, sortDirection, getItemWeekValues, getAccumulatedCheckSet]);

  const handleToggleSort = (
    col: 'wbs' | 'activityId' | 'descripcion' | 'blFinish' | 'contrato' | 'plan' | 'ejec' | 'sobreEjec' | 'pctPlan' | 'pctEjec' | 'variacion' | 'pctAvance' | 'checkSet'
  ) => {
    if (sortColumn === col) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  const sortedComponentes = React.useMemo(() => {
    return Object.entries(byHierarchy).sort((a, b) => {
      return compareHierarchy(a[0], b[0], () => getItemsInComponente(a[1]), () => getItemsInComponente(b[1]));
    });
  }, [byHierarchy, compareHierarchy, getItemsInComponente]);


  const getDimensionValue = React.useCallback((item: any, dimId: HierarchyDimensionId): string => {
    switch (dimId) {
      case 'componente':
        return (item.componente || '').trim() || '(Sin Componente)';
      case 'tipo':
        return (item.tipo || '').trim() || '(Sin Tipo)';
      case 'grupo':
        return (item.grupo || '').trim() || '(Sin Grupo)';
      case 'partida':
        return (item.partidas || (item as any).partida || '').trim() || '(Sin Partida)';
      case 'cap':
        return (item.cap || '').trim() || '(Sin CAP)';
      case 'scap':
        return (item.scap || '').trim() || '(Sin SCAP)';
      case 'subcontratista':
        return (item.subcontratista || item.subC || '').trim() || '(Sin SubC)';
      default:
        return '(Sin Asignar)';
    }
  }, []);

  const buildDynamicHierarchyTree = React.useCallback((
    items: any[],
    dimensions: HierarchyDimensionId[],
    levelIndex = 0,
    parentKey = ''
  ): DynamicHierarchyNode[] => {
    if (levelIndex >= dimensions.length || items.length === 0) {
      return [];
    }

    const dimId = dimensions[levelIndex];
    const groupsMap = new Map<string, any[]>();

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const val = getDimensionValue(it, dimId);
      let arr = groupsMap.get(val);
      if (!arr) {
        arr = [];
        groupsMap.set(val, arr);
      }
      arr.push(it);
    }

    const entries = Array.from(groupsMap.entries());

    // Sort groups using compareHierarchy
    entries.sort((a, b) => {
      return compareHierarchy(a[0], b[0], () => a[1], () => b[1]);
    });

    const nodes: DynamicHierarchyNode[] = [];
    for (let i = 0; i < entries.length; i++) {
      const [val, groupItems] = entries[i];
      const nodeKey = parentKey ? `${parentKey}___${dimId}:${val}` : `${dimId}:${val}`;
      
      let children: DynamicHierarchyNode[] | undefined;
      if (levelIndex + 1 < dimensions.length) {
        children = buildDynamicHierarchyTree(groupItems, dimensions, levelIndex + 1, nodeKey);
      }

      nodes.push({
        key: nodeKey,
        dimId,
        value: val,
        levelIndex,
        items: groupItems,
        children
      });
    }

    return nodes;
  }, [getDimensionValue, compareHierarchy]);

  const dynamicHierarchyTree = React.useMemo(() => {
    if (soloTablaYSemana) return [];
    return buildDynamicHierarchyTree(leafItems, activeHierarchy);
  }, [leafItems, activeHierarchy, soloTablaYSemana, buildDynamicHierarchyTree]);

  const toggleNode = React.useCallback((nodeKey: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeKey)) next.delete(nodeKey);
      else next.add(nodeKey);
      return next;
    });
  }, []);

  const handleApplyPreset = React.useCallback((presetDims: HierarchyDimensionId[]) => {
    setActiveHierarchy(presetDims);
    setExpandedNodes(new Set());
  }, []);

  const handleMoveDimension = React.useCallback((index: number, direction: 'up' | 'down') => {
    setActiveHierarchy(prev => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
    setExpandedNodes(new Set());
  }, []);

  const handleRemoveDimension = React.useCallback((dimId: HierarchyDimensionId) => {
    if (activeHierarchy.length <= 1) return;
    setActiveHierarchy(prev => prev.filter(d => d !== dimId));
    setExpandedNodes(new Set());
  }, [activeHierarchy.length]);

  const handleAddDimension = React.useCallback((dimId: HierarchyDimensionId) => {
    if (!activeHierarchy.includes(dimId)) {
      setActiveHierarchy(prev => [...prev, dimId]);
      setExpandedNodes(new Set());
    }
  }, [activeHierarchy]);

  const handleResetHierarchy = React.useCallback(() => {
    setActiveHierarchy(DEFAULT_HIERARCHY);
    setExpandedNodes(new Set());
  }, []);

  const availableDimensionsToAdd = React.useMemo(() => {
    return (Object.keys(HIERARCHY_DIMENSIONS) as HierarchyDimensionId[]).filter(
      id => !activeHierarchy.includes(id)
    );
  }, [activeHierarchy]);

  const dimensionCounts = React.useMemo(() => {
    const counts: Record<HierarchyDimensionId, number> = {
      componente: 0,
      tipo: 0,
      grupo: 0,
      partida: 0,
      cap: 0,
      scap: 0,
      subcontratista: 0
    };
    const sets: Record<HierarchyDimensionId, Set<string>> = {
      componente: new Set(),
      tipo: new Set(),
      grupo: new Set(),
      partida: new Set(),
      cap: new Set(),
      scap: new Set(),
      subcontratista: new Set()
    };
    leafItems.forEach(item => {
      (Object.keys(sets) as HierarchyDimensionId[]).forEach(dimId => {
        const val = getDimensionValue(item, dimId);
        if (val && val !== '(Sin Asignar)' && !val.startsWith('(Sin ')) {
          sets[dimId].add(val);
        }
      });
    });
    (Object.keys(counts) as HierarchyDimensionId[]).forEach(dimId => {
      counts[dimId] = sets[dimId].size;
    });
    return counts;
  }, [leafItems, getDimensionValue]);

  const handleExpandToLevel = React.useCallback((targetLevel: number) => {
    if (isCardCollapsed) {
      setIsCardCollapsed(false);
    }
    const nextExpanded = new Set<string>();

    if (targetLevel > 0) {
      const collectKeys = (nodeList: DynamicHierarchyNode[]) => {
        nodeList.forEach(n => {
          if (n.levelIndex < targetLevel) {
            nextExpanded.add(n.key);
            if (n.children && n.children.length > 0) {
              collectKeys(n.children);
            }
          }
        });
      };
      collectKeys(dynamicHierarchyTree);
    }

    setExpandedNodes(nextExpanded);
  }, [isCardCollapsed, dynamicHierarchyTree]);

  const handleCollapseAll = React.useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedNodes(new Set());
    setExpandedComponentes(new Set());
    setExpandedTipos(new Set());
    setExpandedRESPs(new Set());
    setExpandedSCAPs(new Set());
    setExpandedSubCs(new Set());
    setExpandedSubPartidas(new Set());
  }, []);


  const handleCopyTableForExcel = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const isEVExportActive = !soloTablaYSemana && modoEV;

    const tsvRows: string[] = [];
    const tsvHeaderCols = ["WBS / Nivel Jerárquico", "Activity ID", "CAP", "Descripción", "BL Finish", "V. Contrato", "V.Plan", "V.Ejec"];
    if (isEVExportActive) tsvHeaderCols.push("Sobre Ejecución");
    tsvHeaderCols.push("Variación", "% Avance", "Check Set");
    tsvRows.push(tsvHeaderCols.join("\t"));

    const htmlRowsArray: string[] = [];

    const hasAnyExpanded = expandedComponentes.size > 0 || expandedTipos.size > 0 || expandedRESPs.size > 0 || expandedSubPartidas.size > 0 || expandedSCAPs.size > 0 || expandedSubCs.size > 0;
    const isAll = !hasAnyExpanded;

    const addRowHtml = (
      wbsText: string,
      actId: string,
      desc: string,
      blFinishStr: string,
      vContrato: number,
      vPlan: number,
      vEjec: number,
      desv: number,
      bg: string,
      fg: string,
      fontWeight: string = 'bold',
      fontSize: string = '11px',
      indentCount: number = 0,
      checkSetText: string = '',
      capText: string = '',
      sobreEjec: number = 0,
      cellStyles?: {
        vPlanColor?: string;
        vEjecColor?: string;
        vContratoColor?: string;
        sobreEjecColor?: string;
        desvColor?: string;
        borderColor?: string;
        labelColor?: string;
      }
    ) => {
      const pctAvance = vPlan > 0 ? (vEjec / vPlan * 100) : (vEjec > 0 ? 100 : 0);
      const pctStr = `${pctAvance.toFixed(2)}%`;
      const isDarkRow = fg.toLowerCase() === '#ffffff';
      const desvColor = cellStyles?.desvColor || (isDarkRow ? (desv < 0 ? '#fca5a5' : '#86efac') : (desv < 0 ? '#dc2626' : '#15803d'));
      const planColor = cellStyles?.vPlanColor || (isDarkRow ? '#c7d2fe' : '#4338ca');
      const ejecColor = cellStyles?.vEjecColor || (isDarkRow ? '#cbd5e1' : '#475569');
      const contratoColor = cellStyles?.vContratoColor || (isDarkRow ? '#ffffff' : fg);
      const sobreColor = cellStyles?.sobreEjecColor || (isDarkRow ? '#fde68a' : '#b45309');
      const bColor = cellStyles?.borderColor || (isDarkRow ? '#1e1b4b' : '#cbd5e1');
      const firstColColor = cellStyles?.labelColor || fg;

      const tsvCols = [
        wbsText,
        actId,
        capText,
        desc,
        blFinishStr,
        fmtMoney(vContrato),
        fmtMoney(vPlan),
        fmtMoney(vEjec)
      ];
      if (isEVExportActive) tsvCols.push(fmtMoney(sobreEjec));
      tsvCols.push(fmtMoney(desv), pctStr, checkSetText);
      tsvRows.push(tsvCols.join("\t"));

      const indentSpaces = "&nbsp;".repeat(indentCount);
      const paddingLeft = 4 + (indentCount * 4);

      const sobreEjecTd = isEVExportActive ? `
          <td style="padding: 6px 10px; border: 1px solid ${bColor}; text-align: right; font-family: Calibri, Arial, sans-serif; background-color: ${bg}; color: ${sobreColor}; font-weight: ${fontWeight}; mso-number-format: '\\$#,##0.00';">$${fmtMoney(sobreEjec)}</td>
      ` : '';

      // Explicit inline styles on every td for full Excel background fill & typography hierarchy
      htmlRowsArray.push(`
        <tr style="background-color: ${bg}; color: ${fg}; font-weight: ${fontWeight}; font-size: ${fontSize};">
          <td style="padding: 6px 10px; padding-left: ${paddingLeft}px; border: 1px solid ${bColor}; font-family: Calibri, Arial, sans-serif; background-color: ${bg}; color: ${firstColColor}; font-weight: ${fontWeight}; mso-number-format: '\\@';">${indentSpaces}${wbsText}</td>
          <td style="padding: 6px 10px; border: 1px solid ${bColor}; font-family: Calibri, Arial, sans-serif; background-color: ${bg}; color: ${fg}; font-weight: ${fontWeight}; mso-number-format: '\\@';">${actId}</td>
          <td style="padding: 6px 10px; border: 1px solid ${bColor}; font-family: Calibri, Arial, sans-serif; background-color: ${bg}; color: ${fg}; font-weight: ${fontWeight}; mso-number-format: '\\@';">${capText}</td>
          <td style="padding: 6px 10px; border: 1px solid ${bColor}; font-family: Calibri, Arial, sans-serif; background-color: ${bg}; color: ${fg}; font-weight: ${fontWeight};">${desc}</td>
          <td style="padding: 6px 10px; border: 1px solid ${bColor}; text-align: center; font-family: Calibri, Arial, sans-serif; background-color: ${bg}; color: ${fg};">${blFinishStr}</td>
          <td style="padding: 6px 10px; border: 1px solid ${bColor}; text-align: right; font-family: Calibri, Arial, sans-serif; background-color: ${bg}; color: ${contratoColor}; font-weight: ${fontWeight}; mso-number-format: '\\$#,##0.00';">$${fmtMoney(vContrato)}</td>
          <td style="padding: 6px 10px; border: 1px solid ${bColor}; text-align: right; font-family: Calibri, Arial, sans-serif; background-color: ${bg}; color: ${planColor}; font-weight: ${fontWeight}; mso-number-format: '\\$#,##0.00';">$${fmtMoney(vPlan)}</td>
          <td style="padding: 6px 10px; border: 1px solid ${bColor}; text-align: right; font-family: Calibri, Arial, sans-serif; background-color: ${bg}; color: ${ejecColor}; font-weight: ${fontWeight}; mso-number-format: '\\$#,##0.00';">$${fmtMoney(vEjec)}</td>
          ${sobreEjecTd}
          <td style="padding: 6px 10px; border: 1px solid ${bColor}; text-align: right; font-family: Calibri, Arial, sans-serif; background-color: ${bg}; color: ${desvColor}; font-weight: bold; mso-number-format: '\\$#,##0.00';">${fmtDNum(desv)}</td>
          <td style="padding: 6px 10px; border: 1px solid ${bColor}; text-align: right; font-family: Calibri, Arial, sans-serif; background-color: ${bg}; color: ${fg}; font-weight: ${fontWeight}; mso-number-format: '0.00%';">${pctStr}</td>
          <td style="padding: 6px 10px; border: 1px solid ${bColor}; text-align: center; font-family: Calibri, Arial, sans-serif; background-color: ${bg}; color: ${fg}; font-weight: ${fontWeight};">${checkSetText}</td>
        </tr>
      `.trim());
    };

    const exportDynamicNode = (node: DynamicHierarchyNode) => {
      const meta = HIERARCHY_DIMENSIONS[node.dimId];
      const nodeTot = tot(node.items);
      const isExp = isAll || expandedNodes.has(node.key);
      const levelColor = EXCEL_LEVEL_COLORS[Math.min(node.levelIndex, EXCEL_LEVEL_COLORS.length - 1)];

      addRowHtml(
        `${meta.icon} ${node.value}`,
        '',
        `(${nodeTot.count} it.)`,
        fmtDateVal(nodeTot.maxBlFinish),
        nodeTot.contrato,
        nodeTot.plan,
        nodeTot.ejec,
        nodeTot.desv,
        levelColor.bg,
        levelColor.fg,
        'bold',
        '10.5px',
        node.levelIndex,
        getAccumulatedCheckSet(node.items).text,
        '',
        nodeTot.sobreEjec,
        {
          vPlanColor: levelColor.vPlan,
          vEjecColor: levelColor.vEjec,
          vContratoColor: levelColor.vContrato,
          sobreEjecColor: levelColor.vSobre,
          borderColor: levelColor.borderColor,
          labelColor: levelColor.labelColor
        }
      );

      if (isExp) {
        if (node.children && node.children.length > 0) {
          node.children.forEach(exportDynamicNode);
        } else {
          // Leaf items
          [...node.items].sort(compareLeafItems).forEach((item: any) => {
            const { vPlan, vEjec, vContrato, variacion, sobreEjecucion } = getItemWeekValues(item);
            const capVal = String(item.cap || '').trim();
            addRowHtml(
              String(item.wbs || '').trim(),
              item.activityId || '',
              item.descripcion || '',
              fmtDateVal(item.blFinish),
              vContrato,
              vPlan,
              vEjec,
              variacion,
              '#ffffff',
              '#334155',
              'normal',
              '9.5px',
              node.levelIndex + 1,
              getAccumulatedCheckSet([item]).text,
              capVal,
              sobreEjecucion,
              {
                vPlanColor: '#4338ca',
                vEjecColor: '#64748b',
                vContratoColor: '#475569',
                sobreEjecColor: '#b45309',
                borderColor: '#e2e8f0',
                labelColor: '#0f172a'
              }
            );
          });
        }
      }
    };

    if (soloTablaYSemana) {
      sortedComponentes.forEach(([comp, tipos]: any) => {
        const allItemsInComp = getItemsInComponente(tipos);
        if (allItemsInComp.length === 0) return;
        const compTot = tot(allItemsInComp);
        const l1 = EXCEL_LEVEL_COLORS[0];
        addRowHtml(
          `🏛️ ${comp}`,
          '',
          `(${compTot.count} it.)`,
          fmtDateVal(compTot.maxBlFinish),
          compTot.contrato,
          compTot.plan,
          compTot.ejec,
          compTot.desv,
          l1.bg,
          l1.fg,
          'bold',
          '11px',
          0,
          getAccumulatedCheckSet(allItemsInComp).text,
          '',
          compTot.sobreEjec,
          {
            vPlanColor: l1.vPlan,
            vEjecColor: l1.vEjec,
            vContratoColor: l1.vContrato,
            sobreEjecColor: l1.vSobre,
            borderColor: l1.borderColor,
            labelColor: l1.labelColor
          }
        );
      });
    } else {
      dynamicHierarchyTree.forEach(exportDynamicNode);
    }

    // TOTAL PROYECTO ROW (Bottom) - Matches table tfoot (bg-[#442dd7] #1e1b4b, text-white)
    addRowHtml(
      'TOTAL FILTRADO',
      '',
      `(${leafItems.length.toLocaleString()} it.)`,
      fmtDateVal(globalTot.maxBlFinish),
      globalTot.contrato,
      globalTot.plan,
      globalTot.ejec,
      globalTot.desv,
      '#1e1b4b',
      '#ffffff',
      'bold',
      '11.5px',
      0,
      getAccumulatedCheckSet(leafItems).text,
      '',
      globalTot.sobreEjec,
      {
        vPlanColor: '#c7d2fe',
        vEjecColor: '#cbd5e1',
        vContratoColor: '#ffffff',
        sobreEjecColor: '#fde68a',
        borderColor: '#312e81',
        labelColor: '#ffffff'
      }
    );

    const tsvContent = tsvRows.join("\n");
    const htmlRows = htmlRowsArray.join("\n");

    const htmlContent = `
      <table style="border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11px; color: #1e293b; width: 100%;">
        <thead>
          <tr style="background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: left;">
            <th style="padding: 8px 10px; border: 1px solid #312e81; background-color: #1e1b4b; color: #ffffff; font-weight: bold;">WBS / Nivel Jerárquico</th>
            <th style="padding: 8px 10px; border: 1px solid #312e81; background-color: #1e1b4b; color: #ffffff; font-weight: bold;">Activity ID</th>
            <th style="padding: 8px 10px; border: 1px solid #312e81; background-color: #1e1b4b; color: #ffffff; font-weight: bold;">CAP</th>
            <th style="padding: 8px 10px; border: 1px solid #312e81; background-color: #1e1b4b; color: #ffffff; font-weight: bold;">Descripción</th>
            <th style="padding: 8px 10px; border: 1px solid #312e81; background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: center;">BL Finish</th>
            <th style="padding: 8px 10px; border: 1px solid #312e81; background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: right;">V. Contrato</th>
            <th style="padding: 8px 10px; border: 1px solid #312e81; background-color: #1e1b4b; color: #c7d2fe; font-weight: bold; text-align: right;">V.Plan</th>
            <th style="padding: 8px 10px; border: 1px solid #312e81; background-color: #1e1b4b; color: #fecdd3; font-weight: bold; text-align: right;">V.Ejec</th>
            ${isEVExportActive ? '<th style="padding: 8px 10px; border: 1px solid #312e81; background-color: #1e1b4b; color: #fde68a; font-weight: bold; text-align: right;">Sobre Ejecución</th>' : ''}
            <th style="padding: 8px 10px; border: 1px solid #312e81; background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: right;">Variación</th>
            <th style="padding: 8px 10px; border: 1px solid #312e81; background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: right;">% Avance</th>
            <th style="padding: 8px 10px; border: 1px solid #312e81; background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: center;">Check Set</th>
          </tr>
        </thead>
        <tbody>
          ${htmlRows}
        </tbody>
      </table>
    `.trim();

    // Copy formatted HTML & TSV to clipboard
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const clipboardItem = new ClipboardItem({
          "text/html": new Blob([htmlContent], { type: "text/html" }),
          "text/plain": new Blob([tsvContent], { type: "text/plain" })
        });
        await navigator.clipboard.write([clipboardItem]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
        return;
      }
    } catch (e) {
      console.warn("ClipboardItem write failed, fallback to writeText", e);
    }

    try {
      await navigator.clipboard.writeText(tsvContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn("writeText fallback failed", e);
    }
  };


  // Recursive renderer for dynamic hierarchy tree
  const renderDynamicNode = (node: DynamicHierarchyNode) => {
    const meta = HIERARCHY_DIMENSIONS[node.dimId];
    const nodeTot = tot(node.items);
    if (nodeTot.count === 0) return null;
    const isExp = expandedNodes.has(node.key);
    const pctNode = nodeTot.plan > 0 ? (nodeTot.ejec / nodeTot.plan * 100) : (nodeTot.ejec > 0 ? 100 : 0);
    const csNode = getAccumulatedCheckSet(node.items);
    const levelStyle = LEVEL_STYLES[Math.min(node.levelIndex, LEVEL_STYLES.length - 1)];
    const indentPx = Math.max(1, node.levelIndex * 2 + 1);
    const isTerminalLevel = !node.children || node.children.length === 0;

    return (
      <React.Fragment key={node.key}>
        <tr
          onClick={() => toggleNode(node.key)}
          className={`${levelStyle.bg} cursor-pointer transition-colors whitespace-nowrap`}
        >
          <td
            colSpan={3}
            className="px-1 py-1.5 whitespace-nowrap overflow-hidden"
            style={{ paddingLeft: `${indentPx}px` }}
          >
            <div className="flex items-center gap-1 whitespace-nowrap overflow-hidden min-w-0">
              {isExp ? (
                <ChevronDown className={`w-3.5 h-3.5 ${levelStyle.chevron} shrink-0`} />
              ) : (
                <ChevronRight className={`w-3.5 h-3.5 ${levelStyle.chevron} shrink-0`} />
              )}
              <span
                className={`text-[11px] tracking-wide font-bold whitespace-nowrap truncate min-w-0 ${levelStyle.text}`}
                title={`${meta.label}: ${node.value}`}
              >
                {meta.icon} {node.value}
              </span>
              <span className={`text-[10px] font-mono ${levelStyle.subText} whitespace-nowrap shrink-0`}>
                ({nodeTot.count} it.)
              </span>
            </div>
          </td>
          <td className={`px-2 py-2 text-center font-mono text-[10px] ${levelStyle.dateText} whitespace-nowrap`}>
            {fmtDateVal(nodeTot.maxBlFinish)}
          </td>
          <td
            className={`px-2 py-2 text-right font-mono cursor-help whitespace-nowrap ${levelStyle.vContrato}`}
            title={modoEV 
              ? `Monto Exacto Contrato: $${fmtMoney(nodeTot.contrato)}${getCantidadTooltipForGroup(node.items, 'contrato', 'V. Contrato') ? '\n' + getCantidadTooltipForGroup(node.items, 'contrato', 'V. Contrato') : ''}` 
              : getCantidadTooltipForGroup(node.items, 'contrato', 'V. Contrato')}
          >
            {modoEV ? fmtMillions(nodeTot.contrato) : `$${fmtMoney(nodeTot.contrato)}`}
          </td>
          <td
            className={`px-2 py-2 text-right font-mono cursor-help whitespace-nowrap ${levelStyle.vPlan}`}
            title={getCantidadTooltipForGroup(node.items, 'plan', 'V.Plan')}
          >
            ${fmtMoney(nodeTot.plan)}
          </td>
          <td
            className={`px-2 py-2 text-right font-mono cursor-help whitespace-nowrap ${levelStyle.vEjec}`}
            title={getCantidadTooltipForGroup(node.items, 'ejec', 'V.Ejec')}
          >
            ${fmtMoney(nodeTot.ejec)}
          </td>
          {modoEV && (
            <td
              className={`px-2 py-2 text-right font-mono cursor-help font-bold whitespace-nowrap ${levelStyle.vSobre}`}
              title={getCantidadTooltipForGroup(node.items, 'sobreEjec', 'Sobre Ejecución')}
            >
              ${fmtMoney(nodeTot.sobreEjec)}
            </td>
          )}
          <td
            className={`px-2 py-2 text-right font-mono font-black cursor-help whitespace-nowrap ${nodeTot.desv < 0 ? 'text-red-600' : 'text-emerald-700'}`}
            title={getCantidadTooltipForGroup(node.items, 'desv', 'Variación')}
          >
            {fmtDNum(nodeTot.desv)}
          </td>
          <td className="px-2 py-2 text-right font-mono whitespace-nowrap">
            {pctNode.toFixed(2)}%
          </td>
          <td className="px-2 py-2 text-center font-mono whitespace-nowrap">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${csNode.bg} ${csNode.textC}`}>
              <span className={`w-1 h-1 rounded-full ${csNode.dot}`}></span>
              {csNode.text}
            </span>
          </td>
        </tr>

        {/* Render children if expanded */}
        {isExp && (
          isTerminalLevel ? (
            // Leaf items
            [...node.items].sort(compareLeafItems).map((item: any) => {
              const { vPlan, vEjec, vContrato, variacion, sobreEjecucion } = getItemWeekValues(item);
              const pctItem = vPlan > 0 ? (vEjec / vPlan * 100) : (vEjec > 0 ? 100 : 0);
              const csItem = getAccumulatedCheckSet([item]);
              const leafIndentPx = node.levelIndex * 2 + 3;

              return (
                <tr
                  key={item.activityId || item.wbs}
                  className="bg-white hover:bg-slate-50 transition-colors text-[11px] text-slate-700 border-b border-slate-100 border-l-2 border-l-slate-300 whitespace-nowrap"
                >
                  <td
                    className="w-[125px] max-w-[125px] px-1 py-1 font-mono font-semibold text-slate-800 whitespace-nowrap overflow-hidden"
                    style={{ paddingLeft: `${leafIndentPx}px` }}
                  >
                    <div className="truncate whitespace-nowrap min-w-0" title={item.wbs}>
                      {item.wbs}
                    </div>
                  </td>
                  <td className="px-1.5 py-1.5 font-mono text-slate-500 whitespace-nowrap">
                    {item.activityId}
                  </td>
                  <td className="px-2 py-1.5 text-slate-800 font-medium min-w-[130px] max-w-[280px] whitespace-nowrap overflow-hidden">
                    <div className="truncate min-w-0 whitespace-nowrap" title={item.descripcion}>
                      {item.descripcion}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-center font-mono text-[10px] text-slate-500">
                    {fmtDateVal(item.blFinish)}
                  </td>
                  <td
                    className="px-2 py-1.5 text-right font-mono text-slate-600 cursor-help hover:bg-slate-100 transition-colors whitespace-nowrap"
                    title={getCantidadTooltipForItem(item, vContrato, 'V. Contrato')}
                  >
                    {modoEV ? fmtMillions(vContrato) : `$${fmtMoney(vContrato)}`}
                  </td>
                  <td
                    className="px-2 py-1.5 text-right font-mono font-bold text-indigo-700 cursor-help hover:bg-indigo-50 transition-colors"
                    title={getCantidadTooltipForItem(item, vPlan, 'V.Plan')}
                  >
                    ${fmtMoney(vPlan)}
                  </td>
                  <td
                    className="px-2 py-1.5 text-right font-mono font-bold text-slate-400 cursor-help hover:bg-slate-100 transition-colors"
                    title={getCantidadTooltipForItem(item, vEjec, 'V.Ejec')}
                  >
                    ${fmtMoney(vEjec)}
                  </td>
                  {modoEV && (
                    <td
                      className="px-2 py-1.5 text-right font-mono font-bold text-amber-600 cursor-help hover:bg-amber-50 transition-colors whitespace-nowrap"
                      title={getCantidadTooltipForItem(item, sobreEjecucion, 'Sobre Ejecución')}
                    >
                      ${fmtMoney(sobreEjecucion)}
                    </td>
                  )}
                  <td
                    className={`px-2 py-1.5 text-right font-mono font-bold cursor-help hover:bg-slate-100 transition-colors ${variacion < 0 ? 'text-red-600' : 'text-emerald-600'}`}
                    title={getCantidadTooltipForItem(item, variacion, 'Variación')}
                  >
                    {fmtDNum(variacion)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">
                    {pctItem.toFixed(2)}%
                  </td>
                  <td className="px-2 py-1.5 text-center font-mono">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${csItem.bg} ${csItem.textC}`}>
                      <span className={`w-1 h-1 rounded-full ${csItem.dot}`}></span>
                      {csItem.text}
                    </span>
                  </td>
                </tr>
              );
            })
          ) : (
            node.children!.map(child => renderDynamicNode(child))
          )
        )}
      </React.Fragment>
    );
  };

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200/90 relative ${isCardCollapsed ? 'overflow-hidden' : 'overflow-visible'} animate-fade-in ${soloTablaYSemana ? 'mt-0' : 'mt-6'}`} id="tarjeta-kpi-avance-semanal">
      {/* Header Bar */}
      {!soloTablaYSemana && (
        <div 
          onClick={() => setIsCardCollapsed(!isCardCollapsed)}
          className={`bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 px-5 py-4 text-white flex items-center justify-between flex-wrap gap-3 cursor-pointer select-none hover:opacity-95 transition-all relative ${isExpandMenuOpen ? 'z-50' : 'z-30'} ${isCardCollapsed ? 'rounded-2xl' : 'rounded-t-2xl'}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-700/50 rounded-xl border border-indigo-500/40">
              {isCardCollapsed ? <ChevronRight className="w-5 h-5 text-indigo-200" /> : <ChevronDown className="w-5 h-5 text-indigo-200" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                  <span>📅 Control de Ejecución</span>
                </h3>
                <span className="text-[10px] bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2.5 py-0.5 rounded-full font-mono font-bold uppercase">
                  {currentWeekLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
            {/* Botón Filtro Float Negativo (Reloj) */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setFilterFloatNegativo(prev => !prev); }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all text-xs font-bold shadow-sm shrink-0 cursor-pointer active:scale-95 ${
                filterFloatNegativo
                  ? 'bg-rose-500 text-white border-rose-300 shadow-rose-900/30 ring-2 ring-rose-300/80 font-black'
                  : 'border-indigo-500/40 bg-indigo-700/80 hover:bg-indigo-600 text-white'
              }`}
              title={
                filterFloatNegativo
                  ? `Filtro activo: mostrando solo ${totalFloatNegativoCount} actividades con Float Negativo (<0d). Clic para desactivar.`
                  : `Filtrar actividades con Float Negativo (<0d) (Columna X CDO: ${totalFloatNegativoCount} actividades)`
              }
              id="btn-filtro-float-negativo-header"
            >
              <span className="text-sm select-none" role="img" aria-label="Reloj">⏰</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                filterFloatNegativo ? 'bg-white text-rose-700' : 'bg-rose-500/30 text-rose-200 border border-rose-400/40'
              }`}>
                {totalFloatNegativoCount}
              </span>
            </button>

            {/* Modo E.V (Earned Value) Toggle Button */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setModoEV(prev => !prev); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all text-xs font-bold shadow-sm shrink-0 cursor-pointer active:scale-95 ${
                modoEV
                  ? 'bg-amber-400 text-amber-950 border-amber-300 shadow-amber-900/30 ring-2 ring-amber-300/80 font-black'
                  : 'border-indigo-500/40 bg-indigo-700/80 hover:bg-indigo-600 text-white'
              }`}
              title={modoEV ? "Modo E.V activo: V.Ejec topeado a V.Contrato y columna Sobre Ejecución visible. Clic para desactivar." : "Activar modo E.V (Earned Value): recalcula V.Ejec (máx. V.Contrato) y muestra columna Sobre Ejecución"}
              id="btn-toggle-modo-ev-header"
            >
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-black ${modoEV ? 'bg-amber-600 text-white' : 'bg-indigo-900/80 text-amber-300'}`}>
                E.V
              </span>
              <span>{modoEV ? 'Modo E.V (ON)' : 'Modo E.V'}</span>
            </button>

            {/* Organizar Jerarquía Button (Header) */}
            {!soloTablaYSemana && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsHierarchyModalOpen(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-500/40 bg-indigo-700/80 hover:bg-indigo-600 text-white transition-all text-xs font-bold shadow-sm shrink-0 cursor-pointer active:scale-95"
                title="Organizar la jerarquía de la tabla (CAP, SCAP, Partidas, etc. estilo Power BI)"
                id="btn-organizar-jerarquia-header"
              >
                <SlidersHorizontal className="w-4 h-4 text-indigo-200" />
                <span>Jerarquía</span>
                <span className="text-[10px] bg-indigo-900/90 text-indigo-200 px-1.5 py-0.2 rounded font-mono font-bold">
                  {activeHierarchy.length}
                </span>
              </button>
            )}

            {/* Expandir por Nivel Dropdown */}
            <div className={`relative ${isExpandMenuOpen ? 'z-50' : 'z-auto'}`}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsExpandMenuOpen(!isExpandMenuOpen); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-500/40 bg-indigo-700/80 hover:bg-indigo-600 text-white transition-all text-xs font-bold shadow-sm shrink-0 cursor-pointer active:scale-95"
                id="btn-expandir-nivel-control-semanal"
              >
                <ChevronsUpDown className="w-4 h-4 text-indigo-200" />
                <span>Exp. Nivel</span>
                <ChevronDown className="w-3 h-3 text-indigo-300 ml-0.5" />
              </button>

              {isExpandMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setIsExpandMenuOpen(false); }} />
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200/90 rounded-2xl shadow-2xl z-50 py-1.5 text-xs animate-fade-in select-none text-slate-800 ring-1 ring-black/10">
                    <div className="px-3.5 py-1.5 font-bold text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                      <span>Expandir Jerarquía</span>
                      <span className="text-[9px] text-indigo-600 font-semibold">Tabla Semanal</span>
                    </div>
                    <div className="p-1 space-y-0.5 max-h-72 overflow-y-auto">
                      {activeHierarchy.map((dimId, idx) => {
                        const meta = HIERARCHY_DIMENSIONS[dimId];
                        const style = LEVEL_STYLES[Math.min(idx, LEVEL_STYLES.length - 1)];
                        return (
                          <button
                            key={dimId}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleExpandToLevel(idx + 1); setIsExpandMenuOpen(false); }}
                            className="w-full text-left px-3 py-2 hover:bg-indigo-50/70 rounded-xl text-slate-800 font-medium flex items-center justify-between transition-colors cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5 truncate">
                              <span>{meta.icon}</span>
                              <span className="truncate">Nivel {idx + 1}: {meta.shortLabel}</span>
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${style.badge}`}>
                              N{idx + 1}
                            </span>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleExpandToLevel(activeHierarchy.length + 1); setIsExpandMenuOpen(false); }}
                        className="w-full text-left px-3 py-2 hover:bg-indigo-50/70 rounded-xl text-slate-800 font-medium flex items-center justify-between border-t border-slate-100 transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <span>📋</span>
                          <span className="truncate">Nivel {activeHierarchy.length + 1}: Actividades (Hojas)</span>
                        </span>
                        <span className="text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-mono font-bold">
                          N{activeHierarchy.length + 1}
                        </span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={handleCollapseAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-500/40 bg-indigo-700/80 hover:bg-indigo-600 text-white transition-all text-xs font-bold shadow-sm shrink-0 cursor-pointer active:scale-95"
              title="Colapsar todo"
              id="btn-colapsar-control-semanal"
            >
              <ChevronsDownUp className="w-4 h-4 text-indigo-200" />
              <span>Colapsar</span>
            </button>

            <button
              onClick={handleCopyTableForExcel}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all text-xs font-bold shadow-sm shrink-0 cursor-pointer active:scale-95 ${
                copied
                  ? 'bg-emerald-600 border-emerald-400 text-white shadow-emerald-900/30'
                  : 'border-emerald-500/50 bg-emerald-700/90 hover:bg-emerald-600 text-white'
              }`}
              title="Copiar tabla filtrada para Excel con formato y colores por jerarquía"
              id="btn-copiar-excel-control-semanal"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-200" />
                  <span>¡Copiado para Excel!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-emerald-200" />
                  <span>Copiar Tabla</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {!isCardCollapsed && (
        <div className="p-5 space-y-4">
          {/* Controls Bar: Semana Filter, Tipología Filter, Status Filter, Variación Filter & Search */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-wrap items-end gap-3 relative z-20">
            {/* Filter by Week / Period (Desplegable Jerárquico con Selección Múltiple) */}
            <div className={`relative ${isWeekDropdownOpen ? 'z-30' : 'z-auto'} ${soloTablaYSemana ? 'w-auto min-w-[170px] max-w-[240px] flex-initial shrink-0' : 'flex-1 min-w-[240px]'}`} id="contenedor-desplegable-semanal">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5 whitespace-nowrap">
                <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>{soloTablaYSemana ? 'Período / Semana:' : 'Filtrar por Período / Semana:'}</span>
              </label>
              
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsWeekDropdownOpen(!isWeekDropdownOpen);
                }}
                className="w-full text-xs bg-white border border-slate-300 hover:border-indigo-400 rounded-xl px-2.5 py-2 font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center justify-between gap-2 text-left transition-all cursor-pointer h-[38px]"
              >
                <span className="truncate flex items-center gap-1.5">
                  <span className="text-indigo-600 font-bold">📅</span>
                  <span className="truncate">{currentWeekLabel}</span>
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isWeekDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isWeekDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={(e) => { e.stopPropagation(); setIsWeekDropdownOpen(false); }} 
                  />
                  <div 
                    className="absolute left-0 min-w-[320px] sm:min-w-[380px] max-w-[90vw] mt-1.5 max-h-[460px] overflow-y-auto bg-white border border-indigo-200 rounded-2xl shadow-2xl z-50 p-2.5 text-xs animate-fade-in select-none ring-1 ring-slate-900/5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Header with Quick Actions */}
                    <div className="px-2 py-1 mb-2 border-b border-slate-100 flex items-center justify-between flex-wrap gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filtrar Período</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handleSelectAll}
                          className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md transition-all cursor-pointer"
                        >
                          ✓ Todo el Proyecto
                        </button>
                        <button
                          type="button"
                          onClick={handleDeselectAll}
                          className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-all cursor-pointer"
                        >
                          ✗ Limpiar
                        </button>
                      </div>
                    </div>

                    {/* Mode Navigation Tabs */}
                    <div className="flex bg-slate-100 p-1 rounded-xl mb-2.5 gap-1">
                      <button
                        type="button"
                        onClick={() => setWeekTabMode('range')}
                        className={`flex-1 py-1.5 px-2 text-[10.5px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          weekTabMode === 'range'
                            ? 'bg-white text-indigo-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span>↔</span>
                        <span>Entre Semanas</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setWeekTabMode('quick')}
                        className={`flex-1 py-1.5 px-2 text-[10.5px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          weekTabMode === 'quick'
                            ? 'bg-white text-indigo-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span>📅</span>
                        <span>Semana / Hasta</span>
                      </button>
                    </div>

                    {/* TAB 1: RANGO ENTRE SEMANAS (DESDE / HASTA) */}
                    {weekTabMode === 'range' && (
                      <div className="space-y-2.5 px-1 py-1">
                        <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-2.5 space-y-2.5">
                          <div className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider flex items-center justify-between">
                            <span>Rango de Semanas:</span>
                            {isRangeSelectionValid && (
                              <span className="text-[9px] bg-indigo-200/60 text-indigo-800 px-1.5 py-0.5 rounded font-mono font-bold">
                                {availableWeeks.filter(w => {
                                  const [from, to] = finalRangeStartWeek <= finalRangeEndWeek ? [finalRangeStartWeek, finalRangeEndWeek] : [finalRangeEndWeek, finalRangeStartWeek];
                                  return w >= from && w <= to;
                                }).length} sem.
                              </span>
                            )}
                          </div>

                          {/* SECCIÓN DESDE: AÑO / MES / DÍA */}
                          <div className="bg-white/80 border border-indigo-100/80 rounded-lg p-2 space-y-1.5 shadow-2xs">
                            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                Desde:
                              </span>
                              {isRangeStartValid && (
                                <span className="text-[9px] text-indigo-700 font-semibold">
                                  {formatWeekDateHuman(finalRangeStartWeek)}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-1.5">
                              <select
                                className="flex-1 text-xs bg-white border border-slate-200 rounded-md px-1 py-1.5 text-slate-700 font-medium focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 cursor-pointer"
                                value={rangeStartYear}
                                onChange={(e) => {
                                  setRangeStartYear(e.target.value);
                                  setRangeStartMonth('');
                                  setRangeStartDay('');
                                }}
                              >
                                <option value="">Año</option>
                                {rangeStartAvailableYears.map(yr => (
                                  <option key={`rs-y-${yr}`} value={yr}>{yr}</option>
                                ))}
                              </select>

                              <select
                                className="flex-[1.5] text-xs bg-white border border-slate-200 rounded-md px-1 py-1.5 text-slate-700 font-medium focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-50 cursor-pointer"
                                value={rangeStartMonth}
                                onChange={(e) => {
                                  setRangeStartMonth(e.target.value);
                                  setRangeStartDay('');
                                }}
                                disabled={!rangeStartYear}
                              >
                                <option value="">Mes</option>
                                {rangeStartAvailableMonths.map(m => (
                                  <option key={`rs-m-${m}`} value={m}>
                                    {['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(m, 10) - 1] || m}
                                  </option>
                                ))}
                              </select>

                              <select
                                className="flex-1 text-xs bg-white border border-slate-200 rounded-md px-1 py-1.5 text-slate-700 font-medium focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-50 cursor-pointer"
                                value={rangeStartDay}
                                onChange={(e) => setRangeStartDay(e.target.value)}
                                disabled={!rangeStartMonth}
                              >
                                <option value="">Día</option>
                                {rangeStartAvailableDays.map(d => (
                                  <option key={`rs-d-${d}`} value={d}>{d}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* SECCIÓN HASTA: AÑO / MES / DÍA */}
                          <div className="bg-white/80 border border-indigo-100/80 rounded-lg p-2 space-y-1.5 shadow-2xs">
                            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                Hasta:
                              </span>
                              {isRangeEndValid && (
                                <span className="text-[9px] text-indigo-700 font-semibold">
                                  {formatWeekDateHuman(finalRangeEndWeek)}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-1.5">
                              <select
                                className="flex-1 text-xs bg-white border border-slate-200 rounded-md px-1 py-1.5 text-slate-700 font-medium focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 cursor-pointer"
                                value={rangeEndYear}
                                onChange={(e) => {
                                  setRangeEndYear(e.target.value);
                                  setRangeEndMonth('');
                                  setRangeEndDay('');
                                }}
                              >
                                <option value="">Año</option>
                                {rangeEndAvailableYears.map(yr => (
                                  <option key={`re-y-${yr}`} value={yr}>{yr}</option>
                                ))}
                              </select>

                              <select
                                className="flex-[1.5] text-xs bg-white border border-slate-200 rounded-md px-1 py-1.5 text-slate-700 font-medium focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-50 cursor-pointer"
                                value={rangeEndMonth}
                                onChange={(e) => {
                                  setRangeEndMonth(e.target.value);
                                  setRangeEndDay('');
                                }}
                                disabled={!rangeEndYear}
                              >
                                <option value="">Mes</option>
                                {rangeEndAvailableMonths.map(m => (
                                  <option key={`re-m-${m}`} value={m}>
                                    {['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(m, 10) - 1] || m}
                                  </option>
                                ))}
                              </select>

                              <select
                                className="flex-1 text-xs bg-white border border-slate-200 rounded-md px-1 py-1.5 text-slate-700 font-medium focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-50 cursor-pointer"
                                value={rangeEndDay}
                                onChange={(e) => setRangeEndDay(e.target.value)}
                                disabled={!rangeEndMonth}
                              >
                                <option value="">Día</option>
                                {rangeEndAvailableDays.map(d => (
                                  <option key={`re-d-${d}`} value={d}>{d}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Botón Aplicar Rango */}
                          <button
                            type="button"
                            disabled={!isRangeSelectionValid}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isRangeSelectionValid) {
                                handleSelectRange(finalRangeStartWeek, finalRangeEndWeek);
                              }
                            }}
                            className={`w-full py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                              isRangeActive
                                ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 ring-offset-1 hover:bg-indigo-700'
                                : 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white active:scale-98'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>
                              {!isRangeSelectionValid
                                ? 'Seleccione Desde y Hasta válidos'
                                : isRangeActive
                                ? `Rango Activo (${formatWeekDateHuman(finalRangeStartWeek <= finalRangeEndWeek ? finalRangeStartWeek : finalRangeEndWeek)} a ${formatWeekDateHuman(finalRangeStartWeek <= finalRangeEndWeek ? finalRangeEndWeek : finalRangeStartWeek)})`
                                : `Aplicar Rango (${formatWeekDateHuman(finalRangeStartWeek <= finalRangeEndWeek ? finalRangeStartWeek : finalRangeEndWeek)} a ${formatWeekDateHuman(finalRangeStartWeek <= finalRangeEndWeek ? finalRangeEndWeek : finalRangeStartWeek)})`}
                            </span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* TAB 2: SEMANA INDIVIDUAL / HASTA AQUÍ */}
                    {weekTabMode === 'quick' && (
                      <div className="px-2 py-2 mb-1 border border-slate-200 bg-indigo-50/40 rounded-xl space-y-2">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Selección por Año / Mes / Día</span>
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-1.5">
                            <select
                              className="flex-1 text-xs bg-white border border-slate-200 rounded-md px-1 py-1.5 text-slate-700 font-medium focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                              value={qsYear}
                              onChange={(e) => {
                                setQsYear(e.target.value);
                                setQsMonth('');
                                setQsDay('');
                              }}
                            >
                              <option value="">Año</option>
                              {qsAvailableYears.map(yr => (
                                <option key={`qsy-${yr}`} value={yr}>{yr}</option>
                              ))}
                            </select>

                            <select
                              className="flex-[1.5] text-xs bg-white border border-slate-200 rounded-md px-1 py-1.5 text-slate-700 font-medium focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
                              value={qsMonth}
                              onChange={(e) => {
                                setQsMonth(e.target.value);
                                setQsDay('');
                              }}
                              disabled={!qsYear}
                            >
                              <option value="">Mes</option>
                              {qsAvailableMonths.map(m => (
                                <option key={`qsm-${m}`} value={m}>
                                  {['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(m, 10) - 1] || m}
                                </option>
                              ))}
                            </select>

                            <select
                              className="flex-1 text-xs bg-white border border-slate-200 rounded-md px-1 py-1.5 text-slate-700 font-medium focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
                              value={qsDay}
                              onChange={(e) => setQsDay(e.target.value)}
                              disabled={!qsMonth}
                            >
                              <option value="">Día</option>
                              {qsAvailableDays.map(d => (
                                <option key={`qsd-${d}`} value={d}>{d}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={!isQuickSelectValid}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isQuickSelectValid) handleSelectSingle(finalQuickSelectWeek);
                              }}
                              className={`flex-1 text-[10px] font-bold px-2 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${
                                isSoloEstaActive
                                  ? 'bg-indigo-600 text-white border border-indigo-600 ring-2 ring-indigo-300 ring-offset-1'
                                  : 'bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white'
                              }`}
                            >
                              Sólo esta
                            </button>
                            <button
                              type="button"
                              disabled={!isQuickSelectValid}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isQuickSelectValid) handleSelectUpTo(finalQuickSelectWeek);
                              }}
                              className={`flex-1 text-[10px] font-bold px-2 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${
                                isHastaAquiActive
                                  ? 'bg-indigo-600 text-white border border-indigo-600 ring-2 ring-indigo-300 ring-offset-1'
                                  : 'bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white'
                              }`}
                            >
                              Hasta aquí
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                </>
              )}
            </div>

            {/* Filter by P.Ac (Col. AO CDO) - Available in Caratula & Full Table */}
            <div className={`relative ${soloTablaYSemana ? 'w-auto min-w-[160px] max-w-[220px] flex-initial shrink-0' : 'flex-1 min-w-[180px]'}`} id="contenedor-desplegable-pac">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5 whitespace-nowrap">
                <Filter className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="truncate">P.Ac (Col. AO):</span>
              </label>
              <button
                type="button"
                onClick={() => setIsPAcDropdownOpen(prev => !prev)}
                className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-800 shadow-xs hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all flex items-center justify-between gap-2 cursor-pointer h-[38px]"
              >
                <span className="truncate flex items-center gap-1.5">
                  <span className="text-indigo-600 font-bold">🎯</span>
                  <span className="truncate">{getPAcFilterLabel()}</span>
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isPAcDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isPAcDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={(e) => { e.stopPropagation(); setIsPAcDropdownOpen(false); }} 
                  />
                  <div 
                    className="absolute left-0 min-w-[260px] sm:min-w-[300px] max-w-[90vw] mt-1.5 max-h-80 overflow-y-auto bg-white border border-indigo-200 rounded-2xl shadow-2xl z-50 p-2 text-xs animate-fade-in select-none ring-1 ring-slate-900/5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-2 py-1 mb-1.5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Selección P.Ac</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handleSelectAllPAc}
                          className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md transition-all cursor-pointer"
                        >
                          ✓ Seleccionar Todo
                        </button>
                        <button
                          type="button"
                          onClick={handleDeselectAllPAc}
                          className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-all cursor-pointer"
                        >
                          ✗ Limpiar
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {pacsDisponibles.length === 0 ? (
                        <div className="p-3 text-center text-slate-400 italic">No hay valores de P.Ac disponibles</div>
                      ) : (
                        pacsDisponibles.map(pacVal => {
                          const isSelected = activePAcSet.has(pacVal);
                          return (
                            <button
                              key={pacVal}
                              type="button"
                              onClick={() => handleTogglePAc(pacVal)}
                              className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-50 text-indigo-900 border border-indigo-200/80 font-bold'
                                  : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                                  isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                                }`}>
                                  {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                </div>
                                <span className="truncate">{pacVal}</span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Toggle Total / Ponderado para % Plan y % Ejec (Vista Carátula) */}
            {soloTablaYSemana && (
              <div className="flex flex-col gap-1 shrink-0" id="contenedor-toggle-modo-porcentaje">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1 whitespace-nowrap">
                  <Percent className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Base %:</span>
                </label>
                <div className="inline-flex p-0.5 bg-slate-200/90 rounded-xl border border-slate-300 shadow-inner h-[38px] items-center">
                  <button
                    type="button"
                    onClick={() => setModoPorcentaje('total')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      modoPorcentaje === 'total'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                    title="Total: Divide entre el V. Contrato del Proyecto Total sin filtros"
                  >
                    Total
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoPorcentaje('ponderado')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      modoPorcentaje === 'ponderado'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                    title="Ponderado: Divide entre el V. Contrato del Proyecto del componente sin filtros"
                  >
                    Pond.
                  </button>
                </div>
              </div>
            )}


            {/* Quick Reset in Carátula View if filters are active */}
            {soloTablaYSemana && hasActiveFilters && (
              <div className="flex flex-col gap-1 justify-end shrink-0" id="caratula-limpiar-filtros">
                <label className="block text-xs font-bold text-transparent select-none pointer-events-none mb-1">
                  Reset
                </label>
                <button
                  type="button"
                  onClick={handleResetAllFilters}
                  className="flex items-center gap-1.5 px-3 h-[38px] text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap"
                  title={`Limpiar filtros activos (${activeFiltersCount})`}
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                  <span>Limpiar</span>
                  <span className="bg-rose-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-extrabold shadow-2xs">
                    {activeFiltersCount}
                  </span>
                </button>
              </div>
            )}

            {/* Other Filters (Hidden when soloTablaYSemana is active) */}
            {!soloTablaYSemana && (
              <>
                {/* Filter by Partidas (Col. AC CDO) */}
                <div className={`relative flex-1 min-w-[180px] ${isPartidasDropdownOpen ? 'z-30' : 'z-auto'}`} id="contenedor-desplegable-partidas">
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5 whitespace-nowrap">
                    <Filter className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="truncate">Partidas (Col. AC):</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsPartidasDropdownOpen(prev => !prev)}
                    className={`w-full text-xs bg-white border rounded-xl px-3 py-2 font-semibold shadow-xs hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all flex items-center justify-between gap-2 cursor-pointer h-[38px] ${
                      !isAllPartidasSelected && activePartidasSet.size < partidasDisponibles.length
                        ? 'border-indigo-400 text-indigo-950 font-bold bg-indigo-50/50 ring-1 ring-indigo-300'
                        : 'border-slate-300 text-slate-800'
                    }`}
                    title={getPartidasFilterLabel()}
                  >
                    <span className="truncate flex items-center gap-1.5">
                      <span className="text-indigo-600 font-bold">📑</span>
                      <span className="truncate">{getPartidasFilterLabel()}</span>
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isPartidasDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isPartidasDropdownOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={(e) => { e.stopPropagation(); setIsPartidasDropdownOpen(false); }} 
                      />
                      <div 
                        className="absolute left-0 min-w-[280px] sm:min-w-[320px] max-w-[90vw] mt-1.5 max-h-80 overflow-y-auto bg-white border border-indigo-200 rounded-2xl shadow-2xl z-50 p-2 text-xs animate-fade-in select-none ring-1 ring-slate-900/5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="px-2 py-1 mb-1.5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Partidas (Col. AC)</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={handleSelectAllPartidas}
                              className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md transition-all cursor-pointer"
                            >
                              ✓ Seleccionar Todo
                            </button>
                            <button
                              type="button"
                              onClick={handleDeselectAllPartidas}
                              className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-all cursor-pointer"
                            >
                              ✗ Limpiar
                            </button>
                          </div>
                        </div>

                        {partidasDisponibles.length > 5 && (
                          <div className="px-1 pb-1.5 mb-1 border-b border-slate-100">
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="Buscar partida..."
                                value={partidasSearchQuery}
                                onChange={(e) => setPartidasSearchQuery(e.target.value)}
                                className="w-full text-[11px] bg-slate-50 border border-slate-200 rounded-lg pl-6 pr-2 py-1 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <Search className="w-3 h-3 text-slate-400 absolute left-1.5 top-2 pointer-events-none" />
                              {partidasSearchQuery && (
                                <button
                                  type="button"
                                  onClick={() => setPartidasSearchQuery('')}
                                  className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-600 text-[10px]"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="space-y-1">
                          {partidasDisponibles.length === 0 ? (
                            <div className="p-3 text-center text-slate-400 italic">No hay partidas disponibles</div>
                          ) : (
                            partidasDisponibles
                              .filter(p => !partidasSearchQuery || p.toLowerCase().includes(partidasSearchQuery.toLowerCase()))
                              .map(partidaVal => {
                                const isSelected = activePartidasSet.has(partidaVal);
                                return (
                                  <button
                                    key={partidaVal}
                                    type="button"
                                    onClick={() => handleTogglePartida(partidaVal)}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                      isSelected
                                        ? 'bg-indigo-50 text-indigo-900 border border-indigo-200/80 font-bold'
                                        : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                                        isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                                      }`}>
                                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                      </div>
                                      <span className="truncate">{partidaVal}</span>
                                    </div>
                                  </button>
                                );
                              })
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Filter by Tipología */}
                <div className={`relative flex-1 min-w-[200px] ${isTipologiaDropdownOpen ? 'z-30' : 'z-auto'}`} id="contenedor-desplegable-tipologia">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-indigo-600" />
                <span>Tipología:</span>
              </label>
              <button
                type="button"
                onClick={() => setIsTipologiaDropdownOpen(prev => !prev)}
                className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-800 shadow-xs hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all flex items-center justify-between gap-2 cursor-pointer"
              >
                <span className="truncate flex items-center gap-1.5">
                  <span className="text-indigo-600 font-bold">🏷️</span>
                  <span className="truncate">{getTipologiaFilterLabel()}</span>
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isTipologiaDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isTipologiaDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={(e) => { e.stopPropagation(); setIsTipologiaDropdownOpen(false); }} 
                  />
                  <div 
                    className="absolute left-0 right-0 mt-1 max-h-80 overflow-y-auto bg-white border border-indigo-200 rounded-2xl shadow-2xl z-50 p-2 text-xs animate-fade-in select-none"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-2 py-1 mb-1.5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Selección Múltiple</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handleSelectAllTipologias}
                          className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md transition-all cursor-pointer"
                        >
                          ✓ Seleccionar Todo
                        </button>
                        <button
                          type="button"
                          onClick={handleDeselectAllTipologias}
                          className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-all cursor-pointer"
                        >
                          ✗ Limpiar
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {tipologíasDisponibles.length === 0 ? (
                        <div className="p-3 text-center text-slate-400 italic">No hay tipologías disponibles</div>
                      ) : (
                        tipologíasDisponibles.map(tip => {
                          const isSelected = activeTipologiaSet.has(tip);
                          return (
                            <button
                              key={tip}
                              type="button"
                              onClick={() => handleToggleTipologia(tip)}
                              className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-50 text-indigo-900 border border-indigo-200/80 font-bold'
                                  : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                                  isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                                }`}>
                                  {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                </div>
                                <span className="truncate">{tip}</span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Filter by Status */}
            <div className={`relative flex-1 min-w-[180px] ${isStatusDropdownOpen ? 'z-30' : 'z-auto'}`} id="contenedor-desplegable-status">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5 truncate">
                <Filter className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="truncate">Status:</span>
              </label>
              <button
                type="button"
                onClick={() => setIsStatusDropdownOpen(prev => !prev)}
                className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-800 shadow-xs hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all flex items-center justify-between gap-2 cursor-pointer"
              >
                <span className="truncate flex items-center gap-1.5">
                  <span className="text-indigo-600 font-bold">📊</span>
                  <span className="truncate">{getStatusFilterLabel()}</span>
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isStatusDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={(e) => { e.stopPropagation(); setIsStatusDropdownOpen(false); }} 
                  />
                  <div 
                    className="absolute left-0 right-0 mt-1 max-h-80 overflow-y-auto bg-white border border-indigo-200 rounded-2xl shadow-2xl z-50 p-2 text-xs animate-fade-in select-none"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-2 py-1 mb-1.5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Selección Múltiple</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handleSelectAllStatus}
                          className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md transition-all cursor-pointer"
                        >
                          ✓ Seleccionar Todo
                        </button>
                        <button
                          type="button"
                          onClick={handleDeselectAllStatus}
                          className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-all cursor-pointer"
                        >
                          ✗ Limpiar
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {statusDisponibles.length === 0 ? (
                        <div className="p-3 text-center text-slate-400 italic">No hay status disponibles</div>
                      ) : (
                        statusDisponibles.map(st => {
                          const isSelected = activeStatusSet.has(st);
                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => handleToggleStatus(st)}
                              className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-50 text-indigo-900 border border-indigo-200/80 font-bold'
                                  : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                                  isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                                }`}>
                                  {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                </div>
                                <span className="truncate">{st}</span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Filter by Partida D WBS */}
            <div className={`relative flex-1 min-w-[175px] ${isPartidaDDropdownOpen ? 'z-30' : 'z-auto'}`} id="contenedor-filtro-partida-d">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5 truncate">
                <Filter className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="truncate">Partida D (WBS):</span>
              </label>
              <button
                type="button"
                onClick={() => setIsPartidaDDropdownOpen(prev => !prev)}
                className={`w-full text-xs bg-white border rounded-xl px-3 py-2 font-semibold shadow-xs hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all flex items-center justify-between gap-2 cursor-pointer h-[38px] ${
                  filterPartidaD === 'only_d'
                    ? 'border-indigo-500 text-indigo-950 font-bold bg-indigo-50/70 ring-1 ring-indigo-400'
                    : filterPartidaD === 'exclude_d'
                      ? 'border-amber-400 text-amber-950 font-bold bg-amber-50/70 ring-1 ring-amber-300'
                      : 'border-slate-300 text-slate-800'
                }`}
                title={
                  filterPartidaD === 'only_d'
                    ? "Filtrando: Solo ítems de Partida D activos"
                    : filterPartidaD === 'exclude_d'
                      ? "Filtrando: Sin Partida D (excluida)"
                      : "Partida D: Con Partida D (todas)"
                }
              >
                <span className="truncate flex items-center gap-1.5">
                  <span className="text-sm">
                    {filterPartidaD === 'only_d' ? '🎯' : filterPartidaD === 'exclude_d' ? '🚫' : '📁'}
                  </span>
                  <span className="truncate font-bold">
                    {filterPartidaD === 'only_d'
                      ? 'Solo Partida D'
                      : filterPartidaD === 'exclude_d'
                        ? 'Sin Partida D'
                        : 'Con Partida D'}
                  </span>
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isPartidaDDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isPartidaDDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={(e) => { e.stopPropagation(); setIsPartidaDDropdownOpen(false); }} 
                  />
                  <div 
                    className="absolute left-0 min-w-[220px] mt-1 bg-white border border-indigo-200 rounded-2xl shadow-2xl z-50 p-2 text-xs animate-fade-in select-none ring-1 ring-slate-900/5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-2 py-1 mb-1.5 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filtro Partida D</span>
                      {filterPartidaD !== 'all' && (
                        <button
                          type="button"
                          onClick={() => {
                            setFilterPartidaD('all');
                            setIsPartidaDDropdownOpen(false);
                          }}
                          className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-all cursor-pointer"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>

                    <div className="space-y-1">
                      {/* Opción 1: Con Partida D (Todo) */}
                      <button
                        type="button"
                        onClick={() => {
                          setFilterPartidaD('all');
                          setIsPartidaDDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between gap-2 cursor-pointer ${
                          filterPartidaD === 'all'
                            ? 'bg-slate-100 text-slate-900 border border-slate-300 font-bold'
                            : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-sm">📁</span>
                          <div className="flex flex-col">
                            <span className="truncate font-bold">Con Partida D</span>
                            <span className="text-[10px] text-slate-400 font-normal">Todas las partidas</span>
                          </div>
                        </div>
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                          filterPartidaD === 'all' ? 'bg-slate-800 border-slate-800 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {filterPartidaD === 'all' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </button>

                      {/* Opción 2: Solo Partida D (Filtrar Partida D) */}
                      <button
                        type="button"
                        onClick={() => {
                          setFilterPartidaD('only_d');
                          setIsPartidaDDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between gap-2 cursor-pointer ${
                          filterPartidaD === 'only_d'
                            ? 'bg-indigo-50 text-indigo-950 border border-indigo-300 font-bold shadow-xs ring-1 ring-indigo-200'
                            : 'hover:bg-indigo-50/50 text-slate-700 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-sm">🎯</span>
                          <div className="flex flex-col">
                            <span className="truncate font-bold text-indigo-900">Solo Partida D</span>
                            <span className="text-[10px] text-indigo-600 font-medium">Filtrar ítems de Partida D</span>
                          </div>
                        </div>
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                          filterPartidaD === 'only_d' ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {filterPartidaD === 'only_d' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </button>

                      {/* Opción 3: Sin Partida D (Excluir Partida D) */}
                      <button
                        type="button"
                        onClick={() => {
                          setFilterPartidaD('exclude_d');
                          setIsPartidaDDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between gap-2 cursor-pointer ${
                          filterPartidaD === 'exclude_d'
                            ? 'bg-amber-50 text-amber-950 border border-amber-300 font-bold shadow-xs ring-1 ring-amber-200'
                            : 'hover:bg-amber-50/50 text-slate-700 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-sm">🚫</span>
                          <div className="flex flex-col">
                            <span className="truncate font-bold text-amber-900">Sin Partida D</span>
                            <span className="text-[10px] text-amber-600 font-medium">Excluir ítems de Partida D</span>
                          </div>
                        </div>
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                          filterPartidaD === 'exclude_d' ? 'bg-amber-600 border-amber-600 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {filterPartidaD === 'exclude_d' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Filter by Variación (Dropdown) */}
            <div className={`relative flex-1 min-w-[180px] ${isVariacionDropdownOpen ? 'z-30' : 'z-auto'}`} id="contenedor-desplegable-variacion">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5 truncate">
                <Filter className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="truncate">Estado de Variación:</span>
              </label>
              <button
                type="button"
                onClick={() => setIsVariacionDropdownOpen(prev => !prev)}
                className={`w-full text-xs bg-white border rounded-xl px-3 py-2 font-semibold shadow-xs hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all flex items-center justify-between gap-2 cursor-pointer ${
                  filterVariacion !== 'all'
                    ? 'border-indigo-400 text-indigo-950 font-bold bg-indigo-50/50 ring-1 ring-indigo-300'
                    : 'border-slate-300 text-slate-800'
                }`}
              >
                <span className="truncate flex items-center gap-1.5">
                  <span className="text-indigo-600 font-bold">
                    {filterVariacion === 'neg' ? '🔴' : filterVariacion === 'pos' ? '🟢' : '⚪'}
                  </span>
                  <span className="truncate">{getVariacionFilterLabel()}</span>
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isVariacionDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isVariacionDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={(e) => { e.stopPropagation(); setIsVariacionDropdownOpen(false); }} 
                  />
                  <div 
                    className="absolute left-0 right-0 mt-1 bg-white border border-indigo-200 rounded-2xl shadow-2xl z-50 p-2 text-xs animate-fade-in select-none"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-2 py-1 mb-1.5 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Opciones de Variación</span>
                      {filterVariacion !== 'all' && (
                        <button
                          type="button"
                          onClick={() => {
                            setFilterVariacion('all');
                            setIsVariacionDropdownOpen(false);
                          }}
                          className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-all cursor-pointer"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>

                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setFilterVariacion('all');
                          setIsVariacionDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between gap-2 cursor-pointer ${
                          filterVariacion === 'all'
                            ? 'bg-indigo-50 text-indigo-900 border border-indigo-200/80 font-bold'
                            : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                            filterVariacion === 'all' ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                          }`}>
                            {filterVariacion === 'all' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <span className="truncate">Todos</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setFilterVariacion('neg');
                          setIsVariacionDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between gap-2 cursor-pointer ${
                          filterVariacion === 'neg'
                            ? 'bg-rose-50 text-rose-900 border border-rose-200/80 font-bold'
                            : 'hover:bg-rose-50/50 text-slate-700 border border-transparent'
                        }`}
                        title="Solo ítems con retraso real (variación < -$1)"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                            filterVariacion === 'neg' ? 'bg-rose-600 border-rose-600 text-white' : 'border-slate-300 bg-white'
                          }`}>
                            {filterVariacion === 'neg' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <span className="truncate text-rose-700 font-bold">Retrasos (-)</span>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-rose-100 text-rose-800 shrink-0">
                          Desvío &lt; -$1
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setFilterVariacion('pos');
                          setIsVariacionDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between gap-2 cursor-pointer ${
                          filterVariacion === 'pos'
                            ? 'bg-emerald-50 text-emerald-900 border border-emerald-200/80 font-bold'
                            : 'hover:bg-emerald-50/50 text-slate-700 border border-transparent'
                        }`}
                        title="Solo ítems con adelanto (ejecutado > plan)"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                            filterVariacion === 'pos' ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                          }`}>
                            {filterVariacion === 'pos' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <span className="truncate text-emerald-700 font-bold">Adelantos (+)</span>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-emerald-100 text-emerald-800 shrink-0">
                          Desvío &gt; $0
                        </span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Filter by SubC (Columna N CDO) */}
            <div className={`relative flex-1 min-w-[180px] ${isSubCDropdownOpen ? 'z-30' : 'z-auto'}`} id="contenedor-desplegable-subc">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5 truncate">
                <Filter className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="truncate">SubC (Col. N):</span>
              </label>
              <button
                type="button"
                onClick={() => setIsSubCDropdownOpen(prev => !prev)}
                className={`w-full text-xs bg-white border rounded-xl px-3 py-2 font-semibold shadow-xs hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all flex items-center justify-between gap-2 cursor-pointer ${
                  !isAllSubCsSelected && activeSubCSet.size < subCsDisponibles.length
                    ? 'border-indigo-400 text-indigo-950 font-bold bg-indigo-50/50 ring-1 ring-indigo-300'
                    : 'border-slate-300 text-slate-800'
                }`}
              >
                <span className="truncate flex items-center gap-1.5">
                  <span className="text-indigo-600 font-bold">🏗️</span>
                  <span className="truncate">{getSubCFilterLabel()}</span>
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isSubCDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isSubCDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={(e) => { e.stopPropagation(); setIsSubCDropdownOpen(false); }} 
                  />
                  <div 
                    className="absolute left-0 right-0 mt-1 max-h-80 overflow-y-auto bg-white border border-indigo-200 rounded-2xl shadow-2xl z-50 p-2 text-xs animate-fade-in select-none"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="sticky top-0 bg-white z-10 pb-1 pt-0.5 border-b border-slate-100 mb-1.5">
                      <div className="px-1 py-1 flex items-center justify-between flex-wrap gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Selección Múltiple</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={handleSelectAllSubCs}
                            className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md transition-all cursor-pointer"
                          >
                            ✓ Seleccionar Todo
                          </button>
                          <button
                            type="button"
                            onClick={handleDeselectAllSubCs}
                            className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-all cursor-pointer"
                          >
                            ✗ Limpiar
                          </button>
                        </div>
                      </div>

                      {/* Buscador de texto para Subcontratistas */}
                      <div className="px-1 pt-1 pb-1">
                        <div className="relative">
                          <input
                            ref={subCSearchInputRef}
                            type="text"
                            placeholder="Buscar subcontratista..."
                            value={subCSearchQuery}
                            onChange={(e) => setSubCSearchQuery(e.target.value)}
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-7 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2.5 pointer-events-none" />
                          {subCSearchQuery && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSubCSearchQuery('');
                                subCSearchInputRef.current?.focus();
                              }}
                              className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 p-0.5 rounded text-xs transition-colors"
                              title="Limpiar búsqueda"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        {subCSearchQuery.trim() && (
                          <div className="flex items-center justify-between mt-1 px-1 text-[10px] text-slate-500 font-medium">
                            <span>
                              {filteredSubCs.length} {filteredSubCs.length === 1 ? 'coincidencia' : 'coincidencias'}
                            </span>
                            {filteredSubCs.length > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const next = new Set(selectedSubCs);
                                  filteredSubCs.forEach(s => next.add(s));
                                  setSelectedSubCs(next);
                                  if (next.size === subCsDisponibles.length) {
                                    setIsAllSubCsSelected(true);
                                  } else {
                                    setIsAllSubCsSelected(false);
                                  }
                                }}
                                className="text-indigo-600 hover:text-indigo-800 font-semibold hover:underline cursor-pointer"
                              >
                                + Seleccionar filtrados
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      {subCsDisponibles.length === 0 ? (
                        <div className="p-3 text-center text-slate-400 italic">No hay SubC disponibles</div>
                      ) : filteredSubCs.length === 0 ? (
                        <div className="p-3 text-center text-slate-400 italic text-[11px]">
                          No se encontraron subcontratistas para &ldquo;{subCSearchQuery}&rdquo;
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setSubCSearchQuery('');
                                subCSearchInputRef.current?.focus();
                              }}
                              className="text-indigo-600 hover:underline font-semibold text-[10px] cursor-pointer"
                            >
                              Borrar búsqueda
                            </button>
                          </div>
                        </div>
                      ) : (
                        filteredSubCs.map(sub => {
                          const isSelected = activeSubCSet.has(sub);
                          return (
                            <button
                              key={sub}
                              type="button"
                              onClick={() => handleToggleSubC(sub)}
                              className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-50 text-indigo-900 border border-indigo-200/80 font-bold'
                                  : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                                  isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                                }`}>
                                  {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                </div>
                                <span className="truncate">{sub}</span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Search Input */}
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-indigo-600" />
                <span>Buscar WBS / Actividad:</span>
              </label>
              <input
                type="text"
                placeholder="Filtrar por texto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Check Set Filter */}
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Check Set:</span>
              </label>
              <select
                value={filterCheckSet}
                onChange={(e) => setFilterCheckSet(e.target.value as any)}
                className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">Todos</option>
                <option value="en_plazo">⚪ En Plazo</option>
                <option value="retraso">🔴 Retraso</option>
                <option value="adelanto">🟢 Adelanto</option>
              </select>
            </div>

            {/* Clear / Reset All Filters Button */}
            <div className="flex flex-col justify-end">
              <label className="block text-[10px] font-bold text-transparent mb-1 select-none pointer-events-none" aria-hidden="true">
                Acción
              </label>
              <button
                type="button"
                onClick={handleResetAllFilters}
                disabled={!hasActiveFilters}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer whitespace-nowrap shadow-xs ${
                  hasActiveFilters
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300 hover:border-rose-400 ring-2 ring-rose-200 active:scale-95'
                    : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                }`}
                title={hasActiveFilters ? `Haz clic para limpiar todos los filtros (${activeFiltersCount} activo${activeFiltersCount > 1 ? 's' : ''})` : "No hay filtros activos"}
              >
                <RotateCcw className={`w-3.5 h-3.5 ${hasActiveFilters ? 'text-rose-600' : 'text-slate-400'}`} />
                <span>Limpiar Filtros</span>
                {hasActiveFilters && (
                  <span className="ml-0.5 bg-rose-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-extrabold shadow-2xs">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            </div>
              </>
            )}
          </div>


          {/* KPI Resumen Pill Bar */}
          {!soloTablaYSemana && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" id="kpi-resumen-pill-bar">
              {/* Card Planificado (PG-004) */}
              <div 
                id="kpi-card-planificado-pg004"
                onClick={() => setFilterPlanEjec(prev => prev === 'plan' ? 'all' : 'plan')}
                className={`border rounded-2xl p-3.5 text-center cursor-pointer transition-all select-none relative group ${
                  filterPlanEjec === 'plan'
                    ? 'bg-indigo-100/95 border-indigo-500 ring-2 ring-indigo-500 ring-offset-1 shadow-md scale-[1.01]'
                    : 'bg-indigo-50/60 border-indigo-200/80 hover:bg-indigo-100/70 hover:border-indigo-300 shadow-xs active:scale-98'
                }`}
                title={filterPlanEjec === 'plan' ? 'Filtro activo: Mostrando solo actividades planificadas. Clic para quitar filtro.' : 'Clic para filtrar la tabla por actividades con avance planificado en este período'}
              >
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                  <span className="text-[10px] font-extrabold uppercase text-indigo-700 tracking-wider">Planificado (PG-004)</span>
                  {filterPlanEjec === 'plan' && (
                    <span className="bg-indigo-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-extrabold shadow-2xs">
                      Activo ✕
                    </span>
                  )}
                </div>
                <span className="text-base font-extrabold text-indigo-950 font-mono block">${fmtMoney(kpiTot.plan)}</span>
                <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">
                  {filterPlanEjec === 'plan' ? (
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      <span className="text-indigo-800 font-bold">✓ Filtrando ({leafItems.length} activ.)</span>
                      <span className="text-indigo-400 font-normal">•</span>
                      <span className="text-emerald-800 bg-emerald-100/90 border border-emerald-300/80 px-1.5 py-0.2 rounded font-bold shadow-2xs">
                        {planEjecStats.plannedWithEjecCount} ejecutadas
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <span>{planEjecStats.plannedCount} activ.</span>
                      <span className="text-indigo-500 font-medium">({planEjecStats.plannedWithEjecCount} ejecutadas)</span>
                      <span className="text-indigo-400 text-[9px] ml-0.5">🔍 Filtrar</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Ejecutado (CDO V-) */}
              <div 
                id="kpi-card-ejecutado-cdo"
                onClick={() => setFilterPlanEjec(prev => prev === 'ejec' ? 'all' : 'ejec')}
                className={`border rounded-2xl p-3.5 text-center cursor-pointer transition-all select-none relative group ${
                  filterPlanEjec === 'ejec'
                    ? 'bg-rose-100/95 border-rose-500 ring-2 ring-rose-500 ring-offset-1 shadow-md scale-[1.01]'
                    : 'bg-rose-50/60 border-rose-200/80 hover:bg-rose-100/70 hover:border-rose-300 shadow-xs active:scale-98'
                }`}
                title={filterPlanEjec === 'ejec' ? 'Filtro activo: Mostrando solo actividades ejecutadas. Clic para quitar filtro.' : 'Clic para filtrar la tabla por actividades con avance ejecutado en este período'}
              >
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                  <span className="text-[10px] font-extrabold uppercase text-rose-700 tracking-wider">
                    {modoEV ? 'V.Ejec (E.V)' : 'Ejecutado (CDO V-)'}
                  </span>
                  {filterPlanEjec === 'ejec' && (
                    <span className="bg-rose-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-extrabold shadow-2xs">
                      Activo ✕
                    </span>
                  )}
                </div>
                <span className="text-base font-extrabold text-rose-950 font-mono block">${fmtMoney(kpiTot.ejec)}</span>
                {modoEV && kpiTot.sobreEjec > 0 && (
                  <div className="mt-0.5">
                    <span className="text-[9.5px] text-amber-800 font-extrabold bg-amber-100 border border-amber-300/80 px-1.5 py-0.2 rounded shadow-2xs">
                      Sobre Ejec.: ${fmtMoney(kpiTot.sobreEjec)}
                    </span>
                  </div>
                )}
                <div className="text-[10px] text-rose-600 font-semibold mt-0.5">
                  {filterPlanEjec === 'ejec' ? (
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      <span className="text-rose-800 font-bold">✓ Filtrando ({leafItems.length} activ.)</span>
                      <span className="text-rose-400 font-normal">•</span>
                      <span className="text-indigo-800 bg-indigo-100/90 border border-indigo-300/80 px-1.5 py-0.2 rounded font-bold shadow-2xs">
                        {planEjecStats.ejecWithPlanCount} planificadas
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <span>{planEjecStats.ejecCount} activ.</span>
                      <span className="text-rose-500 font-medium">({planEjecStats.ejecWithPlanCount} planificadas)</span>
                      <span className="text-rose-400 text-[9px] ml-0.5">🔍 Filtrar</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Variación Económica */}
              <div className={`border rounded-2xl p-3.5 text-center transition-all ${kpiTot.desv < 0 ? 'bg-amber-50/60 border-amber-200/80' : 'bg-emerald-50/60 border-emerald-200/80'}`}>
                <span className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider block mb-0.5">Variación Económica</span>
                <span className={`text-base font-extrabold font-mono block ${kpiTot.desv < 0 ? 'text-amber-800' : 'text-emerald-800'}`}>
                  {fmtDNum(kpiTot.desv)}
                </span>
                <span className="text-[10px] text-slate-400 block font-medium mt-0.5">
                  {kpiTot.desv < 0 ? 'Desvío en contra' : 'En plazo / favor'}
                </span>
              </div>

              {/* Card % Avance Económico */}
              <div className="bg-slate-100 border border-slate-200 rounded-2xl p-3.5 text-center">
                <span className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider block mb-0.5">% Avance Económico</span>
                <span className="text-base font-extrabold text-slate-800 font-mono block">
                  {kpiTot.plan > 0 ? `${((kpiTot.ejec / kpiTot.plan) * 100).toFixed(2)}%` : '—'}
                </span>
                <span className="text-[10px] text-slate-400 block font-medium mt-0.5">
                  Ejecutado / Plan
                </span>
              </div>
            </div>
          )}

          {/* Tarjetas de Análisis por Tipología (Menu Colapsable) */}
          {!soloTablaYSemana && tipologiasSummary.length > 0 && (
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3 space-y-2">
              <div 
                className="flex items-center justify-between cursor-pointer select-none py-0.5 px-1 rounded-xl hover:bg-slate-100/60 transition-colors"
                onClick={() => setIsTipologiasSummaryOpen(prev => !prev)}
              >
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-white border border-slate-200 text-slate-600 shadow-2xs">
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isTipologiasSummaryOpen ? 'rotate-180' : ''}`} />
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <span>🏷️ Resumen por Tipología (Columna H CDO)</span>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-full">
                      {tipologiasSummary.length} {tipologiasSummary.length === 1 ? 'tipología' : 'tipologías'}
                    </span>
                  </h4>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {!isAllTipologiasSelected && activeTipologiaSet.size < tipologíasDisponibles.length && (
                    <button
                      type="button"
                      onClick={handleSelectAllTipologias}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                    >
                      Limpiar filtro ({activeTipologiaSet.size}/{tipologíasDisponibles.length}) ✕
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsTipologiasSummaryOpen(prev => !prev)}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    {isTipologiasSummaryOpen ? 'Ocultar tarjetas ▲' : 'Ver tarjetas ▼'}
                  </button>
                </div>
              </div>

              {isTipologiasSummaryOpen && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-1 border-t border-slate-200/60 animate-fade-in">
                  {tipologiasSummary.map((tip) => {
                    const colorClasses: Record<string, string> = {
                      '01.Preliminares': 'bg-gray-50 border-gray-300 hover:bg-gray-100',
                      '02.Obra Civil': 'bg-blue-50 border-blue-300 hover:bg-blue-100',
                      '03.Equipo Mecanico': 'bg-purple-50 border-purple-300 hover:bg-purple-100',
                      '04.Equipo Electrico': 'bg-yellow-50 border-yellow-300 hover:bg-yellow-100',
                      '07.Tuberia': 'bg-cyan-50 border-cyan-300 hover:bg-cyan-100',
                      '09.Obra Arquitectonica': 'bg-pink-50 border-pink-300 hover:bg-pink-100'
                    };
                    const textColorClasses: Record<string, string> = {
                      '01.Preliminares': 'text-gray-800',
                      '02.Obra Civil': 'text-blue-900',
                      '03.Equipo Mecanico': 'text-purple-900',
                      '04.Equipo Electrico': 'text-amber-900',
                      '07.Tuberia': 'text-cyan-900',
                      '09.Obra Arquitectonica': 'text-pink-900'
                    };
                    const barColorClasses: Record<string, string> = {
                      '01.Preliminares': 'bg-gray-500',
                      '02.Obra Civil': 'bg-blue-500',
                      '03.Equipo Mecanico': 'bg-purple-500',
                      '04.Equipo Electrico': 'bg-amber-500',
                      '07.Tuberia': 'bg-cyan-500',
                      '09.Obra Arquitectonica': 'bg-pink-500'
                    };
                    const colorClass = colorClasses[tip.nombre] || 'bg-white border-slate-200 hover:bg-slate-50';
                    const textColor = textColorClasses[tip.nombre] || 'text-slate-800';
                    const barColor = barColorClasses[tip.nombre] || 'bg-indigo-500';
                    const isSelected = activeTipologiaSet.has(tip.nombre) && activeTipologiaSet.size < tipologíasDisponibles.length;
                    const desvAbs = Math.abs(tip.desviacion);
                    const desvFmt = desvAbs >= 1000000
                      ? `$${(desvAbs / 1000000).toFixed(2)}M`
                      : desvAbs >= 1000
                      ? `$${(desvAbs / 1000).toFixed(1)}K`
                      : `$${desvAbs.toFixed(0)}`;

                    return (
                      <div
                        key={tip.nombre}
                        className={`border rounded-xl p-2.5 cursor-pointer transition-all flex flex-col justify-between shadow-xs select-none ${
                          isSelected
                            ? 'ring-2 ring-indigo-600 ring-offset-1 bg-indigo-50/90 border-indigo-400'
                            : colorClass
                        }`}
                        onClick={() => {
                          if (isAllTipologiasSelected || activeTipologiaSet.size === tipologíasDisponibles.length) {
                            setIsAllTipologiasSelected(false);
                            setSelectedTipologias(new Set([tip.nombre]));
                          } else if (activeTipologiaSet.has(tip.nombre) && activeTipologiaSet.size === 1) {
                            handleSelectAllTipologias();
                          } else {
                            handleToggleTipologia(tip.nombre);
                          }
                        }}
                      >
                        <div className="flex justify-between items-start gap-1 mb-1">
                          <h5 className={`font-bold text-[11px] ${textColor} leading-tight truncate`} title={tip.nombre}>
                            {tip.nombre.includes('.') ? tip.nombre.split('.')[1] : tip.nombre}
                          </h5>
                          <span className="text-[9px] px-1.5 py-0.2 bg-white/90 rounded-full font-bold text-slate-600 flex-shrink-0 shadow-2xs">
                            {tip.items}
                          </span>
                        </div>
                        <div>
                          <div className="flex justify-between items-baseline leading-none mb-1">
                            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-tight">Variación $</span>
                            <p className={`text-xs font-black font-mono ${tip.desviacion >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {tip.desviacion >= 0 ? desvFmt : `(${desvFmt})`}
                            </p>
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex justify-between items-center text-[9px] leading-none">
                              <span className={`opacity-75 ${textColor}`}>Ejecutado</span>
                              <span className={`font-bold font-mono ${textColor}`}>{tip.avance}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden border border-black/5">
                              <div
                                className={`h-full ${barColor} transition-all duration-300`}
                                style={{ width: `${Math.min(Math.max(parseFloat(tip.avance), 0), 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Interactive Hierarchy Bar (Estilo Power BI) */}
          {!soloTablaYSemana && (
            <div 
              className={`bg-slate-50 border border-slate-200/90 rounded-2xl shadow-2xs mb-2 transition-all duration-200 ${
                isHierarchyBarCollapsed ? 'p-1.5 sm:p-2' : 'p-2.5 space-y-2'
              }`} 
              id="barra-jerarquia-dinamica"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div 
                  onClick={() => setIsHierarchyBarCollapsed(prev => !prev)}
                  className="flex items-center gap-2 cursor-pointer select-none group min-h-[30px]"
                  title={isHierarchyBarCollapsed ? "Clic para expandir los controles de jerarquía" : "Clic para colapsar la barra de jerarquía"}
                >
                  <div className="p-1 rounded-lg text-indigo-700 bg-indigo-50/80 group-hover:bg-indigo-100 transition-colors shrink-0">
                    {isHierarchyBarCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 group-hover:text-indigo-900 transition-colors shrink-0">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Jerarquía de la Tabla:</span>
                  </div>

                  {isHierarchyBarCollapsed ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1 text-[11px] text-slate-700 font-semibold bg-white/90 border border-slate-200 rounded-lg px-2 py-0.5 shadow-2xs">
                        {activeHierarchy.map((dimId, i) => (
                          <React.Fragment key={dimId}>
                            <span className="text-slate-800 font-bold flex items-center gap-0.5">
                              <span className="text-[10px]">{HIERARCHY_DIMENSIONS[dimId]?.icon}</span>
                              <span>{HIERARCHY_DIMENSIONS[dimId]?.shortLabel || dimId}</span>
                            </span>
                            <span className="text-slate-300 text-[10px]">➔</span>
                          </React.Fragment>
                        ))}
                        <span className="text-slate-400 font-medium text-[10.5px]">Actividades</span>
                      </div>
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded border border-indigo-100 hidden sm:inline">
                        {activeHierarchy.length} niv.
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-500 font-medium hidden md:inline">
                      (Organiza el orden de niveles arrastrando o con flechas ◀ ▶)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {isHierarchyBarCollapsed ? (
                    <>
                      {/* Collapsed actions */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsHierarchyModalOpen(true);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl shadow-2xs transition-all cursor-pointer"
                        title="Configuración avanzada de jerarquía"
                      >
                        <span>⚙️ Configurar</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsHierarchyBarCollapsed(false);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl shadow-2xs transition-all cursor-pointer"
                        title="Expandir barra de jerarquía"
                      >
                        <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Expandir</span>
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Presets dropdown */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsPresetMenuOpen(prev => !prev)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-white hover:bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-xl shadow-2xs transition-all cursor-pointer"
                          title="Seleccionar plantilla de jerarquía rápida"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Plantillas Rápidas</span>
                          <ChevronDown className="w-3 h-3 text-indigo-500" />
                        </button>
                        {isPresetMenuOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsPresetMenuOpen(false)} />
                            <div className="absolute right-0 mt-1.5 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1 text-xs ring-1 ring-black/10">
                              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                                Plantillas de Jerarquía
                              </div>
                              {HIERARCHY_PRESETS.map(preset => (
                                <button
                                  key={preset.id}
                                  type="button"
                                  onClick={() => {
                                    handleApplyPreset(preset.dimensions);
                                    setIsPresetMenuOpen(false);
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-indigo-50 flex flex-col transition-colors cursor-pointer border-b border-slate-50 last:border-b-0"
                                >
                                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                    <span>{preset.icon}</span>
                                    <span>{preset.name}</span>
                                  </div>
                                  <span className="text-[10px] text-slate-500 truncate mt-0.5">{preset.description}</span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Add level dropdown */}
                      {availableDimensionsToAdd.length > 0 && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setIsAddDimMenuOpen(prev => !prev)}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl shadow-2xs transition-all cursor-pointer"
                            title="Agregar nivel a la jerarquía"
                          >
                            <Plus className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Nivel</span>
                          </button>
                          {isAddDimMenuOpen && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setIsAddDimMenuOpen(false)} />
                              <div className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1 text-xs ring-1 ring-black/10">
                                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                                  Agregar Campo
                                </div>
                                {availableDimensionsToAdd.map(dimId => {
                                  const meta = HIERARCHY_DIMENSIONS[dimId];
                                  return (
                                    <button
                                      key={dimId}
                                      type="button"
                                      onClick={() => {
                                        handleAddDimension(dimId);
                                        setIsAddDimMenuOpen(false);
                                      }}
                                      className="w-full text-left px-3 py-2 hover:bg-emerald-50 flex items-center justify-between text-slate-800 font-semibold transition-colors cursor-pointer"
                                    >
                                      <span className="flex items-center gap-1.5 truncate">
                                        <span>{meta.icon}</span>
                                        <span className="truncate">{meta.label}</span>
                                      </span>
                                      <Plus className="w-3.5 h-3.5 text-emerald-600" />
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* Config modal button */}
                      <button
                        type="button"
                        onClick={() => setIsHierarchyModalOpen(true)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-2xs transition-all cursor-pointer"
                        title="Configuración avanzada de jerarquía (Power BI Matrix)"
                        id="btn-configurar-jerarquia"
                      >
                        <span>⚙️ Configurar</span>
                      </button>

                      {/* Reset button */}
                      <button
                        type="button"
                        onClick={handleResetHierarchy}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl transition-all cursor-pointer"
                        title="Restablecer jerarquía a valores predeterminados"
                      >
                        <RotateCcw className="w-3 h-3 text-slate-500" />
                        <span className="hidden sm:inline">Restablecer</span>
                      </button>

                      {/* Collapse button */}
                      <button
                        type="button"
                        onClick={() => setIsHierarchyBarCollapsed(true)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs"
                        title="Colapsar barra de jerarquía"
                      >
                        <ChevronDown className="w-3.5 h-3.5 text-slate-500 rotate-180" />
                        <span>Colapsar</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Badges flow (only shown when expanded) */}
              {!isHierarchyBarCollapsed && (
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  {activeHierarchy.map((dimId, index) => {
                    const meta = HIERARCHY_DIMENSIONS[dimId];
                    const isFirst = index === 0;
                    const isLast = index === activeHierarchy.length - 1;
                    return (
                      <React.Fragment key={dimId}>
                        <div className="inline-flex items-center bg-white border border-slate-300 rounded-xl shadow-2xs pl-2 pr-1 py-1 text-xs font-bold text-slate-800 gap-1.5 hover:border-indigo-400 transition-all group">
                          <span className="text-[10px] bg-indigo-100 text-indigo-900 px-1 py-0.2 rounded font-mono font-black">
                            N{index + 1}
                          </span>
                          <span>{meta.icon}</span>
                          <span className="font-bold text-slate-900 whitespace-nowrap">{meta.shortLabel}</span>

                          <div className="flex items-center gap-0.5 ml-1">
                            {/* Move Left / Up */}
                            <button
                              type="button"
                              disabled={isFirst}
                              onClick={() => handleMoveDimension(index, 'up')}
                              className={`p-0.5 rounded hover:bg-indigo-100 transition-colors ${isFirst ? 'opacity-25 cursor-not-allowed' : 'text-slate-600 hover:text-indigo-800 cursor-pointer'}`}
                              title={isFirst ? "Primer nivel" : `Mover antes de ${HIERARCHY_DIMENSIONS[activeHierarchy[index - 1]].shortLabel}`}
                            >
                              ◀
                            </button>
                            {/* Move Right / Down */}
                            <button
                              type="button"
                              disabled={isLast}
                              onClick={() => handleMoveDimension(index, 'down')}
                              className={`p-0.5 rounded hover:bg-indigo-100 transition-colors ${isLast ? 'opacity-25 cursor-not-allowed' : 'text-slate-600 hover:text-indigo-800 cursor-pointer'}`}
                              title={isLast ? "Último nivel" : `Mover después de ${HIERARCHY_DIMENSIONS[activeHierarchy[index + 1]].shortLabel}`}
                            >
                              ▶
                            </button>
                            {/* Remove Level */}
                            {activeHierarchy.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveDimension(dimId)}
                                className="p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer ml-0.5"
                                title={`Quitar ${meta.label} de la jerarquía`}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>

                        {!isLast && (
                          <span className="text-slate-400 text-xs font-bold select-none">➔</span>
                        )}
                      </React.Fragment>
                    );
                  })}

                  <span className="text-slate-400 text-xs font-bold select-none">➔</span>
                  <div className="inline-flex items-center bg-slate-100 border border-slate-200 rounded-xl px-2 py-1 text-xs font-semibold text-slate-500 gap-1.5" title="Nivel terminal: Actividades individuales">
                    <span className="text-[10px] bg-slate-300 text-slate-700 px-1 py-0.2 rounded font-mono font-bold">
                      N{activeHierarchy.length + 1}
                    </span>
                    <span>📋</span>
                    <span>Actividades (Hojas)</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Table Container */}
          <div className="space-y-2">
            {!soloTablaYSemana && (
              <div className="flex items-center justify-between bg-indigo-50/80 border border-indigo-100 px-3.5 py-2 rounded-xl text-[11px] text-indigo-900 font-medium shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="text-sm">💡</span>
                  <span>
                    <strong>Tip de Cantidades:</strong> Pasa el cursor (hover) sobre los valores de <strong>V. Contrato, V. Plan, V. Ejec. o Variación</strong> para ver la cantidad resultante.
                  </span>
                </div>
              </div>
            )}

            <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#442dd7] text-white font-extrabold text-[11px] text-left whitespace-nowrap">
                  <th 
                    className={`border-b border-[#3722b5] cursor-pointer select-none hover:bg-[#3722b5]/80 transition-colors whitespace-nowrap ${
                      soloTablaYSemana 
                        ? 'w-1 whitespace-nowrap px-2 py-2.5 text-left' 
                        : 'w-[125px] max-w-[125px] px-1 py-2.5 text-left'
                    }`}
                    onClick={() => handleToggleSort('wbs')}
                    title={soloTablaYSemana ? "Clic para cambiar el orden por Componente" : "Clic para cambiar el orden por WBS / Nivel Jerárquico"}
                  >
                    <div className="flex items-center justify-start gap-1 whitespace-nowrap">
                      <span className="whitespace-nowrap text-[10px]">{soloTablaYSemana ? 'Componente' : 'WBS / Nivel Jerárquico'}</span>
                      {sortColumn === 'wbs' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-200 stroke-[2.5]" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-200 stroke-[2.5]" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400 opacity-40 hover:opacity-100" />
                      )}
                    </div>
                  </th>
                  {!soloTablaYSemana && (
                    <>
                      <th 
                        className="px-2 py-2.5 border-b border-[#3722b5] cursor-pointer select-none hover:bg-[#3722b5]/80 transition-colors whitespace-nowrap"
                        onClick={() => handleToggleSort('activityId')}
                        title="Clic para cambiar el orden por Activity ID"
                      >
                        <div className="flex items-center justify-start gap-1 whitespace-nowrap">
                          <span className="whitespace-nowrap">Activity ID</span>
                          {sortColumn === 'activityId' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-indigo-200 stroke-[2.5]" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-indigo-200 stroke-[2.5]" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400 opacity-40 hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-2 py-2.5 border-b border-[#3722b5] min-w-[130px] max-w-[280px] cursor-pointer select-none hover:bg-[#3722b5]/80 transition-colors whitespace-nowrap"
                        onClick={() => handleToggleSort('descripcion')}
                        title="Clic para cambiar el orden por Descripción"
                      >
                        <div className="flex items-center justify-start gap-1 whitespace-nowrap">
                          <span className="whitespace-nowrap text-[10.5px]">Descripción</span>
                          {sortColumn === 'descripcion' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-indigo-200 stroke-[2.5]" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-indigo-200 stroke-[2.5]" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400 opacity-40 hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-2 py-2.5 border-b border-[#3722b5] text-center cursor-pointer select-none hover:bg-[#3722b5]/80 transition-colors whitespace-nowrap"
                        onClick={() => handleToggleSort('blFinish')}
                        title="Clic para cambiar el orden por BL Finish"
                      >
                        <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                          <span className="whitespace-nowrap">BL Finish</span>
                          {sortColumn === 'blFinish' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-indigo-200 stroke-[2.5]" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-indigo-200 stroke-[2.5]" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400 opacity-40 hover:opacity-100" />
                          )}
                        </div>
                      </th>
                    </>
                  )}
                  <th 
                    className="px-2 py-2.5 border-b border-[#3722b5] text-right cursor-pointer select-none hover:bg-[#3722b5]/80 transition-colors whitespace-nowrap"
                    onClick={() => handleToggleSort('contrato')}
                    title={modoEV ? "Clic para ordenar por V. Contrato (valores abreviados en Millones M)" : "Clic para cambiar el orden por V. Contrato"}
                  >
                    <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                      <span className="whitespace-nowrap">V. Contrato</span>
                      {sortColumn === 'contrato' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-200 stroke-[2.5]" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-200 stroke-[2.5]" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400 opacity-40 hover:opacity-100" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-2 py-2.5 border-b border-[#3722b5] text-right text-indigo-200 cursor-pointer select-none hover:bg-[#3722b5]/80 transition-colors whitespace-nowrap"
                    onClick={() => handleToggleSort('plan')}
                    title="Clic para cambiar el orden por V.Plan"
                  >
                    <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                      <span className="whitespace-nowrap">V.Plan</span>
                      {sortColumn === 'plan' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-200 stroke-[2.5]" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-200 stroke-[2.5]" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400 opacity-40 hover:opacity-100" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-2 py-2.5 border-b border-[#3722b5] text-right text-rose-200 cursor-pointer select-none hover:bg-[#3722b5]/80 transition-colors whitespace-nowrap"
                    onClick={() => handleToggleSort('ejec')}
                    title="Clic para cambiar el orden por V.Ejec"
                  >
                    <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                      <span className="whitespace-nowrap">V.Ejec</span>
                      {sortColumn === 'ejec' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-200 stroke-[2.5]" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-200 stroke-[2.5]" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400 opacity-40 hover:opacity-100" />
                      )}
                    </div>
                  </th>
                  {!soloTablaYSemana && modoEV && (
                    <th 
                      className="px-2 py-2.5 border-b border-[#3722b5] text-right text-amber-300 cursor-pointer select-none hover:bg-[#3722b5]/80 transition-colors whitespace-nowrap"
                      onClick={() => handleToggleSort('sobreEjec')}
                      title="Clic para cambiar el orden por Sobre Ejecución"
                    >
                      <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                        <span className="whitespace-nowrap">Sobre Ejecución</span>
                        {sortColumn === 'sobreEjec' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-amber-400 opacity-40 hover:opacity-100" />
                        )}
                      </div>
                    </th>
                  )}
                  {soloTablaYSemana && (
                    <th 
                      className="px-2 py-2.5 border-b border-[#3722b5] text-right text-indigo-300 cursor-pointer select-none hover:bg-[#3722b5]/80 transition-colors whitespace-nowrap"
                      onClick={() => handleToggleSort('pctPlan')}
                      title="Clic para cambiar el orden por % Plan"
                    >
                      <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                        <span className="whitespace-nowrap">% Plan</span>
                        {sortColumn === 'pctPlan' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-indigo-200 stroke-[2.5]" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-indigo-200 stroke-[2.5]" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400 opacity-40 hover:opacity-100" />
                        )}
                      </div>
                    </th>
                  )}
                  {soloTablaYSemana && (
                    <th 
                      className="px-2 py-2.5 border-b border-[#3722b5] text-right text-rose-300 cursor-pointer select-none hover:bg-[#3722b5]/80 transition-colors whitespace-nowrap"
                      onClick={() => handleToggleSort('pctEjec')}
                      title="Clic para cambiar el orden por % Ejec"
                    >
                      <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                        <span className="whitespace-nowrap">% Ejec</span>
                        {sortColumn === 'pctEjec' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-indigo-200 stroke-[2.5]" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-indigo-200 stroke-[2.5]" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400 opacity-40 hover:opacity-100" />
                        )}
                      </div>
                    </th>
                  )}
                  <th 
                    className="px-2 py-2.5 border-b border-[#3722b5] text-right cursor-pointer select-none hover:bg-[#3722b5]/80 transition-colors whitespace-nowrap"
                    onClick={() => handleToggleSort('variacion')}
                    title={soloTablaYSemana ? "Clic para cambiar el orden por % Variación" : "Clic para cambiar el orden por Variación"}
                  >
                    <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                      <span className="whitespace-nowrap">{soloTablaYSemana ? '% Variación' : 'Variación'}</span>
                      {sortColumn === 'variacion' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-200 stroke-[2.5]" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-200 stroke-[2.5]" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400 opacity-40 hover:opacity-100" />
                      )}
                    </div>
                  </th>
                  {!soloTablaYSemana && (
                    <>
                      <th 
                        className="px-2 py-2.5 border-b border-[#3722b5] text-right cursor-pointer select-none hover:bg-[#3722b5]/80 transition-colors whitespace-nowrap"
                        onClick={() => handleToggleSort('pctAvance')}
                        title="Clic para cambiar el orden por % Avance"
                      >
                        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                          <span className="whitespace-nowrap">% Avance</span>
                          {sortColumn === 'pctAvance' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-indigo-200 stroke-[2.5]" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-indigo-200 stroke-[2.5]" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400 opacity-40 hover:opacity-100" />
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-2 py-2.5 border-b border-[#3722b5] text-center cursor-pointer select-none hover:bg-[#3722b5]/80 transition-colors whitespace-nowrap"
                        onClick={() => handleToggleSort('checkSet')}
                        title="Clic para cambiar el orden por Check Set"
                      >
                        <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                          <span className="whitespace-nowrap">Check Set</span>
                          {sortColumn === 'checkSet' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-indigo-200 stroke-[2.5]" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-indigo-200 stroke-[2.5]" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400 opacity-40 hover:opacity-100" />
                          )}
                        </div>
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {soloTablaYSemana ? (
                  sortedComponentes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                        No hay datos para la semana y filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    sortedComponentes.map(([comp, tipos]: any) => {
                      const allItemsInComp = getItemsInComponente(tipos);
                      if (allItemsInComp.length === 0) return null;
                      const compTot = tot(allItemsInComp);
                      const compUnfilteredContrato = totalVContratoByComponentUnfiltered.get(comp) || 0;
                      const compBasePct = modoPorcentaje === 'ponderado'
                        ? (compUnfilteredContrato > 0 ? compUnfilteredContrato : (compTot.contrato > 0 ? compTot.contrato : 0))
                        : totalVContratoUnfiltered;

                      const compPctPlanVal = compBasePct > 0 ? (compTot.plan / compBasePct) * 100 : 0;
                      const compPctEjecVal = compBasePct > 0 ? (compTot.ejec / compBasePct) * 100 : 0;
                      const compPctDesvVal = compPctEjecVal - compPctPlanVal;

                      return (
                        <tr key={comp} className="text-slate-800 hover:bg-slate-50/50 transition-colors whitespace-nowrap">
                          <td className="w-1 whitespace-nowrap px-2 py-2 pl-1.5 overflow-hidden">
                            <div className="flex items-center gap-1 whitespace-nowrap overflow-hidden min-w-0">
                              <span className="font-medium text-slate-800 whitespace-nowrap truncate min-w-0" title={comp}>🏛️ {comp}</span>
                            </div>
                          </td>
                          <td 
                            className="px-2.5 py-2.5 text-right font-mono text-slate-900 cursor-help font-semibold whitespace-nowrap" 
                            title={`Monto Exacto Contrato: $${fmtMoney(compTot.contrato)}`}
                          >
                            ${fmtMillions(compTot.contrato)}
                          </td>
                          <td 
                            className="px-2.5 py-2.5 text-right font-mono text-slate-700 cursor-help whitespace-nowrap" 
                            title={`Monto Exacto Plan: $${fmtMoney(compTot.plan)}`}
                          >
                            ${fmtMillions(compTot.plan)}
                          </td>
                          <td 
                            className="px-2.5 py-2.5 text-right font-mono text-green-700 cursor-help whitespace-nowrap" 
                            title={`Monto Exacto Ejec: $${fmtMoney(compTot.ejec)}`}
                          >
                            ${fmtMillions(compTot.ejec)}
                          </td>
                          <td 
                            className="px-2.5 py-2.5 text-right font-mono text-slate-700 cursor-help whitespace-nowrap" 
                            title={`% Plan (${modoPorcentaje === 'ponderado' ? 'Ponderado sobre V. Contrato sin filtrar de ' + comp : 'Total sobre V. Contrato Global sin filtrar'} - Base: $${fmtMoney(compBasePct)}): ${compPctPlanVal.toFixed(4)}%`}
                          >
                            {compPctPlanVal.toFixed(2)}%
                          </td>
                          <td 
                            className="px-2.5 py-2.5 text-right font-mono text-slate-800 cursor-help font-semibold whitespace-nowrap" 
                            title={`% Ejec (${modoPorcentaje === 'ponderado' ? 'Ponderado sobre V. Contrato sin filtrar de ' + comp : 'Total sobre V. Contrato Global sin filtrar'} - Base: $${fmtMoney(compBasePct)}): ${compPctEjecVal.toFixed(4)}%`}
                          >
                            {compPctEjecVal.toFixed(2)}%
                          </td>
                          <td 
                            className={`px-2.5 py-2.5 text-right font-mono font-semibold cursor-help whitespace-nowrap ${compPctDesvVal < 0 ? 'text-red-600' : 'text-green-700'}`} 
                            title={`Monto Exacto Variación: ${fmtDNum(compTot.desv)} | % Variación (% Ejec - % Plan): ${compPctDesvVal.toFixed(4)}%`}
                          >
                            {compPctDesvVal > 0 ? `+${compPctDesvVal.toFixed(2)}%` : `${compPctDesvVal.toFixed(2)}%`}
                          </td>
                        </tr>
                      );
                    })
                  )
                ) : (
                  dynamicHierarchyTree.length === 0 ? (
                    <tr>
                      <td colSpan={modoEV ? 11 : 10} className="py-8 text-center text-slate-400 font-medium">
                        No hay datos para la semana y filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    dynamicHierarchyTree.map(rootNode => renderDynamicNode(rootNode))
                  )
                )}
              </tbody>
              <tfoot className="bg-[#442dd7] text-white font-extrabold text-xs shadow-md border-t-2 border-indigo-700">
                <tr className="ht-g lv0">
                  <td 
                    className={`border-t border-[#3722b5] overflow-hidden ${
                      soloTablaYSemana 
                        ? 'w-1 whitespace-nowrap px-2 py-2.5' 
                        : 'px-2 py-2.5'
                    }`} 
                    colSpan={soloTablaYSemana ? 1 : 3}
                  >
                    <div className="truncate" title={soloTablaYSemana ? `Total (${leafItems.length.toLocaleString()} it.)` : undefined}>
                      {soloTablaYSemana ? 'TOTAL' : `TOTAL FILTRADO (${leafItems.length.toLocaleString()} it.)`}
                    </div>
                  </td>
                  {!soloTablaYSemana && (
                    <td className="px-2 py-2.5 border-t border-[#3722b5] text-center font-mono text-[10px] text-indigo-200">
                      {fmtDateVal(globalTot.maxBlFinish)}
                    </td>
                  )}
                  {soloTablaYSemana ? (
                    <>
                      <td className="px-2 py-2.5 border-t border-[#3722b5] text-right font-mono font-black" title={`Monto Total: $${fmtMoney(globalTot.contrato)}`}>
                        ${fmtMillions(globalTot.contrato)}
                      </td>
                      <td className="px-2 py-2.5 border-t border-[#3722b5] text-right font-mono font-black text-indigo-200" title={`Monto Plan: $${fmtMoney(globalTot.plan)}`}>
                        ${fmtMillions(globalTot.plan)}
                      </td>
                      <td className="px-2 py-2.5 border-t border-[#3722b5] text-right font-mono font-black text-rose-200" title={`Monto Ejec: $${fmtMoney(globalTot.ejec)}`}>
                        ${fmtMillions(globalTot.ejec)}
                      </td>
                      <td className="px-2 py-2.5 border-t border-[#3722b5] text-right font-mono font-black text-indigo-300" title={`Total % Plan sobre V. Contrato Global sin filtrar: $${fmtMoney(totalVContratoUnfiltered)}`}>
                        {totalVContratoUnfiltered > 0 ? `${((globalTot.plan / totalVContratoUnfiltered) * 100).toFixed(2)}%` : '0.00%'}
                      </td>
                      <td className="px-2 py-2.5 border-t border-[#3722b5] text-right font-mono font-black text-rose-300" title={`Total % Ejec sobre V. Contrato Global sin filtrar: $${fmtMoney(totalVContratoUnfiltered)}`}>
                        {totalVContratoUnfiltered > 0 ? `${((globalTot.ejec / totalVContratoUnfiltered) * 100).toFixed(2)}%` : '0.00%'}
                      </td>
                      <td className={`px-2 py-2.5 border-t border-[#3722b5] text-right font-mono font-black ${globalTot.desv < 0 ? 'text-red-400' : 'text-emerald-400'}`} title={`Monto Variación: ${fmtDNum(globalTot.desv)} | Total % Variación: ${totalVContratoUnfiltered > 0 ? (((globalTot.ejec - globalTot.plan) / totalVContratoUnfiltered) * 100).toFixed(4) : '0.0000'}%`}>
                        {(() => {
                          const totalPctPlan = totalVContratoUnfiltered > 0 ? (globalTot.plan / totalVContratoUnfiltered) * 100 : 0;
                          const totalPctEjec = totalVContratoUnfiltered > 0 ? (globalTot.ejec / totalVContratoUnfiltered) * 100 : 0;
                          const totalPctDesv = totalPctEjec - totalPctPlan;
                          return totalPctDesv > 0 ? `+${totalPctDesv.toFixed(2)}%` : `${totalPctDesv.toFixed(2)}%`;
                        })()}
                      </td>
                    </>
                  ) : (
                    <>
                      <td 
                        className="px-2 py-2.5 border-t border-[#3722b5] text-right font-mono whitespace-nowrap"
                        title={`Monto Total Contrato: $${fmtMoney(globalTot.contrato)}`}
                      >
                        {modoEV ? fmtMillions(globalTot.contrato) : `$${fmtMoney(globalTot.contrato)}`}
                      </td>
                      <td className="px-2 py-2.5 border-t border-[#3722b5] text-right font-mono text-indigo-200">
                        ${fmtMoney(globalTot.plan)}
                      </td>
                      <td className="px-2 py-2.5 border-t border-[#3722b5] text-right font-mono text-slate-300">
                        ${fmtMoney(globalTot.ejec)}
                      </td>
                      {modoEV && (
                        <td className="px-2 py-2.5 border-t border-[#3722b5] text-right font-mono text-amber-300 font-bold whitespace-nowrap" title={`Monto Sobre Ejecución: $${fmtMoney(globalTot.sobreEjec)}`}>
                          ${fmtMoney(globalTot.sobreEjec)}
                        </td>
                      )}
                      <td className={`px-2 py-2.5 border-t border-[#3722b5] text-right font-mono font-black ${globalTot.desv < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {fmtDNum(globalTot.desv)}
                      </td>
                      <td className="px-2 py-2.5 border-t border-[#3722b5] text-right font-mono">
                        {globalTot.plan > 0 ? `${((globalTot.ejec / globalTot.plan) * 100).toFixed(2)}%` : '—'}
                      </td>
                      <td className="px-2 py-2.5 border-t border-[#3722b5] text-center font-mono">
                        {(() => {
                          const csTot = getAccumulatedCheckSet(leafItems);
                          return (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${csTot.bg} ${csTot.textC}`}>
                              <span className={`w-1 h-1 rounded-full ${csTot.dot}`}></span>{csTot.text}
                            </span>
                          );
                        })()}
                      </td>
                    </>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Resumen Check Set */}
          {!soloTablaYSemana && checkSetSummary.length > 0 && (
            <div className="mt-8 space-y-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                Resumen por Check Set y Tipología
              </h3>
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="min-w-full text-xs border-collapse text-left">
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th className="px-4 py-3 border-b border-slate-700 font-bold w-40">Check Set</th>
                      <th className="px-4 py-3 border-b border-slate-700 font-bold">Tipología</th>
                      <th className="px-4 py-3 border-b border-slate-700 font-bold text-right">V.Plan</th>
                      <th className="px-4 py-3 border-b border-slate-700 font-bold text-right">V.Ejec</th>
                      {modoEV && (
                        <th className="px-4 py-3 border-b border-slate-700 font-bold text-right text-amber-300">Sobre Ejecución</th>
                      )}
                      <th className="px-4 py-3 border-b border-slate-700 font-bold text-right">Variación</th>
                      <th className="px-4 py-3 border-b border-slate-700 font-bold text-center w-32">Cant. Actividades</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {checkSetSummary.map(([csKey, csData]) => {
                       const tipos = Object.entries(csData.tipologias).sort((a, b) => b[1].desv - a[1].desv);
                       return (
                         <React.Fragment key={csKey}>
                           {/* Fila del Check Set (Total) */}
                           <tr 
                             className="bg-slate-100 font-bold cursor-pointer hover:bg-slate-200 transition-colors"
                             onClick={() => setExpandedCheckSets(prev => {
                               const next = new Set(prev);
                               if (next.has(csKey)) next.delete(csKey); else next.add(csKey);
                               return next;
                             })}
                           >
                             <td className="px-4 py-3 border-b border-slate-200">
                               <div className="flex items-center gap-1.5">
                                 {expandedCheckSets.has(csKey) ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                                 <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase ${csData.checkSetProps.bg} ${csData.checkSetProps.textC}`}>
                                   <span className={`w-1.5 h-1.5 rounded-full ${csData.checkSetProps.dot}`}></span>{csKey}
                                 </span>
                               </div>
                             </td>
                             <td className="px-4 py-3 border-b border-slate-200 text-slate-600 text-[10px] uppercase tracking-wider font-extrabold">
                               Total {csKey}
                             </td>
                             <td className="px-4 py-3 border-b border-slate-200 text-right text-indigo-700 font-mono">
                               ${fmtMoney(csData.totalPlan)}
                             </td>
                             <td className="px-4 py-3 border-b border-slate-200 text-right text-slate-500 font-mono">
                               ${fmtMoney(csData.totalEjec)}
                             </td>
                             {modoEV && (
                               <td className="px-4 py-3 border-b border-slate-200 text-right text-amber-600 font-mono font-bold">
                                 ${fmtMoney(csData.totalSobreEjec || 0)}
                               </td>
                             )}
                             <td className={`px-4 py-3 border-b border-slate-200 text-right font-mono font-black ${csData.totalDesv < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                               {fmtDNum(csData.totalDesv)}
                             </td>
                             <td className="px-4 py-3 border-b border-slate-200 text-center font-bold text-slate-800 bg-slate-200/50">
                               {csData.totalCount}
                             </td>
                           </tr>
                           
                           {/* Filas de Tipologías */}
                           {expandedCheckSets.has(csKey) && tipos.map(([tipo, tData]) => (
                             <tr key={`${csKey}-${tipo}`} className="bg-white hover:bg-slate-50 transition-colors">
                               <td className="px-4 py-2 border-r border-slate-100 bg-slate-50/30"></td>
                               <td className="px-4 py-2 text-slate-700 font-medium pl-6 relative">
                                 <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-200"></div>
                                 <span className="text-[11px]">{tipo}</span>
                               </td>
                               <td className="px-4 py-2 text-right font-mono text-slate-600">
                                 ${fmtMoney(tData.plan)}
                               </td>
                               <td className="px-4 py-2 text-right font-mono text-slate-500">
                                 ${fmtMoney(tData.ejec)}
                               </td>
                               {modoEV && (
                                 <td className="px-4 py-2 text-right font-mono text-amber-600 font-bold">
                                   ${fmtMoney(tData.sobreEjec || 0)}
                                 </td>
                               )}
                               <td className={`px-4 py-2 text-right font-mono font-bold ${tData.desv < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                 {fmtDNum(tData.desv)}
                               </td>
                               <td className="px-4 py-2 text-center font-mono text-slate-600 font-medium border-l border-slate-100">
                                 {tData.count}
                               </td>
                             </tr>
                           ))}
                         </React.Fragment>
                       );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-900 text-white font-extrabold text-xs shadow-xs border-t-2 border-slate-700">
                    <tr>
                      <td className="px-4 py-3 border-t border-slate-700" colSpan={2}>
                        TOTAL GENERAL
                      </td>
                      <td className="px-4 py-3 border-t border-slate-700 text-right font-mono text-indigo-300">
                        ${fmtMoney(globalTot.plan)}
                      </td>
                      <td className="px-4 py-3 border-t border-slate-700 text-right font-mono text-slate-300">
                        ${fmtMoney(globalTot.ejec)}
                      </td>
                      {modoEV && (
                        <td className="px-4 py-3 border-t border-slate-700 text-right font-mono text-amber-300 font-bold">
                          ${fmtMoney(globalTot.sobreEjec)}
                        </td>
                      )}
                      <td className={`px-4 py-3 border-t border-slate-700 text-right font-mono font-black ${globalTot.desv < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {fmtDNum(globalTot.desv)}
                      </td>
                      <td className="px-4 py-3 border-t border-slate-700 text-center font-mono">
                        {leafItems.length}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    )}

      {/* Modal Organizar Jerarquía (Estilo Power BI) */}
      {isHierarchyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in" onClick={() => setIsHierarchyModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-slate-800 ring-1 ring-black/10" onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/80 border border-indigo-400/40 flex items-center justify-center shadow-inner">
                  <SlidersHorizontal className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold flex items-center gap-2">
                    <span>Organizar Jerarquía de la Tabla</span>
                    <span className="text-[10px] bg-amber-400 text-amber-950 font-black px-2 py-0.5 rounded-full uppercase">Power BI Matrix</span>
                  </h3>
                  <p className="text-xs text-indigo-200 mt-0.5">
                    Personaliza el orden de agrupación jerárquica (Filas de la matriz) según tus requerimientos.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHierarchyModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Presets Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Plantillas Rápidas Recomendadas:</span>
                  </label>
                  <span className="text-[11px] text-slate-400">1-clic para aplicar</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {HIERARCHY_PRESETS.map(preset => {
                    const isCurrent = preset.dimensions.length === activeHierarchy.length &&
                      preset.dimensions.every((d, i) => d === activeHierarchy[i]);
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleApplyPreset(preset.dimensions)}
                        className={`text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isCurrent
                            ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-200 text-indigo-950 shadow-xs'
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-extrabold text-xs flex items-center gap-1.5">
                            <span>{preset.icon}</span>
                            <span>{preset.name}</span>
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold">
                              Activa
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 mt-1 font-mono">
                          {preset.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Hierarchy Order List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Niveles de Filas Activos ({activeHierarchy.length}):</span>
                  </label>
                  <span className="text-[11px] text-slate-500 font-medium">
                    (Usa ⬆️ y ⬇️ para cambiar el orden)
                  </span>
                </div>

                <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  {activeHierarchy.map((dimId, idx) => {
                    const meta = HIERARCHY_DIMENSIONS[dimId];
                    const isFirst = idx === 0;
                    const isLast = idx === activeHierarchy.length - 1;
                    const count = dimensionCounts[dimId];
                    const style = LEVEL_STYLES[Math.min(idx, LEVEL_STYLES.length - 1)];

                    return (
                      <div
                        key={dimId}
                        className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-3 shadow-2xs hover:border-indigo-300 transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`text-[10px] px-2 py-1 rounded font-mono font-black shrink-0 ${style.badge}`}>
                            Nivel {idx + 1}
                          </span>
                          <span className="text-lg shrink-0">{meta.icon}</span>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-slate-900 truncate flex items-center gap-2">
                              <span>{meta.label}</span>
                              <span className="text-[10px] text-slate-500 font-normal font-mono">
                                ({count} {count === 1 ? 'único' : 'únicos'} en datos)
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">{meta.description}</div>
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={isFirst}
                            onClick={() => handleMoveDimension(idx, 'up')}
                            className={`px-2 py-1 text-xs font-bold rounded-lg border transition-all ${
                              isFirst
                                ? 'opacity-25 bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                : 'bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-900 border-slate-300 cursor-pointer active:scale-95'
                            }`}
                            title="Subir nivel"
                          >
                            ⬆️ Subir
                          </button>
                          <button
                            type="button"
                            disabled={isLast}
                            onClick={() => handleMoveDimension(idx, 'down')}
                            className={`px-2 py-1 text-xs font-bold rounded-lg border transition-all ${
                              isLast
                                ? 'opacity-25 bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                : 'bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-900 border-slate-300 cursor-pointer active:scale-95'
                            }`}
                            title="Bajar nivel"
                          >
                            ⬇️ Bajar
                          </button>
                          {activeHierarchy.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveDimension(dimId)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer ml-1"
                              title="Quitar este nivel de la jerarquía"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Available Fields to Add */}
              {availableDimensionsToAdd.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Campos Disponibles para Agregar:</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableDimensionsToAdd.map(dimId => {
                      const meta = HIERARCHY_DIMENSIONS[dimId];
                      const count = dimensionCounts[dimId];
                      return (
                        <button
                          key={dimId}
                          type="button"
                          onClick={() => handleAddDimension(dimId)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 shadow-2xs transition-all cursor-pointer active:scale-95"
                          title={`Agregar ${meta.label} al final de la jerarquía`}
                        >
                          <span>{meta.icon}</span>
                          <span>+ {meta.shortLabel}</span>
                          <span className="text-[10px] text-emerald-700 font-normal">({count})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetHierarchy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-white rounded-xl border border-slate-200 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Restablecer Predeterminado</span>
              </button>

              <button
                type="button"
                onClick={() => setIsHierarchyModalOpen(false)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Aplicar y Cerrar</span>
              </button>
            </div>

          </div>
        </div>
      )}

  </div>
  );
};
