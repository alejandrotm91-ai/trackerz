/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, ChevronDown, Download, Filter, Sparkles, Brain, Send, AlertCircle, RefreshCw, FileSpreadsheet, Copy, FileText, Check, Calendar, ChevronsUpDown, ChevronsDownUp, Layers, Terminal, ShoppingCart, Truck, Wrench, HardHat, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { GanttMetricas } from './GanttMetricas';
import { GanttPorContratar } from './GanttPorContratar';
import { GanttTipologia } from './GanttTipologia';
import { ControlSemanalTabla } from './ControlSemanalTabla';
import { AnalisisProyectoCard } from './AnalisisProyectoCard';
import { isIgnoredFinishDate } from '../utils/helpers';
import { exportGanttToPdfA3 } from '../utils/exportGanttPdf';
import { compareWbs, parseWbsAndDescription, DEFAULT_CHAPTER_DESCRIPTIONS, hasDirectoOrDSegment } from '../utils/masterCdoHierarchy';

interface CronogramaTabProps {
  actividades: any[];
  dataPlanificadoPG004?: any;
  statsCronograma: any;
  kpiSelected: string | null;
  setKpiSelected: (v: string | null) => void;
  kpiExp: Set<string>;
  setKpiExp: (v: Set<string>) => void;
  ganttStatus: string;
  setGanttStatus: (v: string) => void;
  ganttFloat: string;
  setGanttFloat: (v: string) => void;
  ganttPAc?: string;
  setGanttPAc?: (v: string) => void;
  ganttTipo: string;
  setGanttTipo: (v: string) => void;
  ganttExp: Set<string>;
  setGanttExp: (v: Set<string>) => void;
  ganttMetricsOpen: boolean;
  setGanttMetricsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  ganttTipoOpen: boolean;
  setGanttTipoOpen: React.Dispatch<React.SetStateAction<boolean>>;
  ganttZoom: string;
  setGanttZoom: (v: string) => void;
  ganttSearch: string;
  setGanttSearch: (v: string) => void;
  partidaSeleccionada: string | null;
  setPartidaSeleccionada: (v: string | null) => void;
  tarjetasPartidasExpandidas: boolean;
  setTarjetasPartidasExpandidas: (v: boolean) => void;
  tarjetasTipologiasExpandidas: boolean;
  setTarjetasTipologiasExpandidas: (v: boolean) => void;
  filteredActividades: any[];
  filterLevel: string;
  setFilterLevel: (v: string) => void;
  filterTipologia: string;
  setFilterTipologia: (v: string) => void;
  filterResp: Set<string>;
  setFilterResp: (v: any) => void;
  expandedItems: Set<string>;
  setExpandedItems: (v: Set<string>) => void;
  tipologiaSeleccionada: string | null;
  setTipologiaSeleccionada: (v: string | null) => void;
  procesosExpandidos: Set<string>;
  setProcesosExpandidos: (v: Set<string>) => void;
  capsExpandidos: Set<string>;
  setCapsExpandidos: (v: Set<string>) => void;
  scapsExpandidos: Set<string>;
  setScapsExpandidos: (v: Set<string>) => void;
  unitsExpandidos: Set<string>;
  setUnitsExpandidos: (v: Set<string>) => void;

  isRespFilterActive: boolean;
  matchesRespFilter: (item: any) => boolean;
  calcularAvance: (item: any) => number;
  calcularValoresReales: (item: any) => any;
  toggleExpand: (id: string) => void;
  exportarCronograma: () => void;
  searchTerm: string;

  filterTipologiaRetraso: string;
  setFilterTipologiaRetraso: React.Dispatch<React.SetStateAction<string>>;
  expandedRESPs: Set<string>;
  setExpandedRESPs: (resps: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  expandedTipos: Set<string>;
  setExpandedTipos: (tipos: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  expandedSCAPs: Set<string>;
  setExpandedSCAPs: (scaps: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  expandedSubPartidas: Set<string>;
  setExpandedSubPartidas: (subpartidas: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  baseVenta: string;
  isGanttAIPanelOpen?: boolean;
  setIsGanttAIPanelOpen?: (val: boolean) => void;
  fechaCorteState: Date;
  setFechaCorteState: (d: Date) => void;
  isLoggedIn: boolean;
}

export const CronogramaTab: React.FC<CronogramaTabProps> = ({
  actividades: rawActividades,
  dataPlanificadoPG004,
  statsCronograma,
  kpiSelected,
  setKpiSelected,
  kpiExp,
  setKpiExp,
  ganttStatus,
  setGanttStatus,
  ganttFloat,
  setGanttFloat,
  ganttPAc: propsGanttPAc,
  setGanttPAc: propsSetGanttPAc,
  ganttTipo,
  setGanttTipo,
  ganttExp,
  setGanttExp,
  ganttMetricsOpen,
  setGanttMetricsOpen,
  ganttTipoOpen,
  setGanttTipoOpen,
  ganttZoom,
  setGanttZoom,
  ganttSearch,
  setGanttSearch,
  partidaSeleccionada,
  setPartidaSeleccionada,
  tarjetasPartidasExpandidas,
  setTarjetasPartidasExpandidas,
  tarjetasTipologiasExpandidas,
  setTarjetasTipologiasExpandidas,
  filteredActividades,
  filterLevel,
  setFilterLevel,
  filterTipologia,
  setFilterTipologia,
  filterResp,
  setFilterResp,
  expandedItems,
  setExpandedItems,
  tipologiaSeleccionada,
  setTipologiaSeleccionada,
  procesosExpandidos,
  setProcesosExpandidos,
  capsExpandidos,
  setCapsExpandidos,
  scapsExpandidos,
  setScapsExpandidos,
  unitsExpandidos,
  setUnitsExpandidos,

  isRespFilterActive,
  matchesRespFilter,
  calcularAvance,
  calcularValoresReales,
  toggleExpand,
  exportarCronograma,
  searchTerm,

  filterTipologiaRetraso,
  setFilterTipologiaRetraso,
  expandedRESPs,
  setExpandedRESPs,
  expandedTipos,
  setExpandedTipos,
  expandedSCAPs,
  setExpandedSCAPs,
  expandedSubPartidas,
  setExpandedSubPartidas,
  baseVenta,
  isGanttAIPanelOpen = false,
  setIsGanttAIPanelOpen,
  fechaCorteState,
  setFechaCorteState,
  isLoggedIn,
}) => {
  // Helper para verificar si una actividad pertenece a la partida D
  const isPartidaD = React.useCallback((a: any): boolean => {
    if (!a) return false;
    const rawWbs = String(a.wbs || a.wbsRaw || '');
    if (hasDirectoOrDSegment(rawWbs)) return true;
    const clean = rawWbs.trim().toLowerCase();
    if (clean.startsWith('p.d') || (clean.startsWith('p0') && clean.includes('.d'))) return true;
    const parts = clean.split('.');
    if (parts.length >= 2 && parts[1] === 'd') return true;
    if (parts.length === 1 && parts[0] === 'd') return true;

    const partidasStr = String(a.partidas || a.partida || '').trim().toLowerCase();
    if (partidasStr === 'd' || partidasStr.startsWith('d.') || partidasStr.startsWith('partida d') || partidasStr === 'partidas directas / adicionales') return true;

    const capStr = String(a.cap || '').trim().toLowerCase();
    if (capStr === 'd' || capStr.startsWith('d.') || capStr.startsWith('partida d')) return true;

    return false;
  }, []);

  // Actualizar fechas baseline para actividades que al no estar en la partida D tienen BL inicio y BL Fin 30-abr-27:
  // Para esas actividades se actualizan las fechas baseline a las que tengamos en inicio y fin
  const actividades = React.useMemo(() => {
    if (!rawActividades || !Array.isArray(rawActividades)) return [];

    const toValidDate = (d: any): Date | null => {
      if (!d) return null;
      if (d instanceof Date && !isNaN(d.getTime())) return d;
      if (typeof d === 'string' || typeof d === 'number') {
        const pd = new Date(d);
        if (!isNaN(pd.getTime())) return pd;
      }
      return null;
    };

    return rawActividades.map(a => {
      const safeStart = toValidDate(a.start);
      const safeFinish = toValidDate(a.finish);
      let newBlStart = toValidDate(a.blStart);
      let newBlFinish = toValidDate(a.blFinish);

      if (!isPartidaD(a)) {
        const blStartIs30Abr = isIgnoredFinishDate(a.blStart);
        const blFinishIs30Abr = isIgnoredFinishDate(a.blFinish);
        if (blStartIs30Abr || blFinishIs30Abr) {
          if (blStartIs30Abr) newBlStart = safeStart || newBlStart;
          if (blFinishIs30Abr) newBlFinish = safeFinish || newBlFinish;
        }
      }

      return {
        ...a,
        start: safeStart || a.start,
        finish: safeFinish || a.finish,
        blStart: newBlStart || a.blStart,
        blFinish: newBlFinish || a.blFinish
      };
    });
  }, [rawActividades, isPartidaD]);

  const { globalMinFloat, hasNegativeGlobalFloat } = React.useMemo(() => {
    const validFloats = actividades
      .filter(a => a.esItemHoja && a.totalFloat !== null && a.totalFloat !== undefined && !isNaN(Number(a.totalFloat)))
      .map(a => Number(a.totalFloat));
    const minVal = validFloats.length > 0 ? Math.min(...validFloats) : 0;
    return { globalMinFloat: minVal, hasNegativeGlobalFloat: minVal < 0 };
  }, [actividades]);

  const ganttBodyRef = useRef<HTMLDivElement>(null);
  const ganttBarRef = useRef<HTMLDivElement>(null);

  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const scrollTopRef = useRef(0);
  const [dragActive, setDragActive] = React.useState(false);

  // Optimization: Defer mounting heavy bottom table to allow Gantt chart to paint immediately
  const [renderBottomControl, setRenderBottomControl] = React.useState(false);
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setRenderBottomControl(true);
    }, 120);
    return () => clearTimeout(timer);
  }, []);

  const handleGanttMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, [role="button"]')) {
      return;
    }
    if (e.button !== 0) return;
    const el = ganttBarRef.current;
    if (!el) return;

    isDraggingRef.current = true;
    setDragActive(true);

    startXRef.current = e.pageX - el.offsetLeft;
    startYRef.current = e.pageY - el.offsetTop;
    scrollLeftRef.current = el.scrollLeft;
    scrollTopRef.current = el.scrollTop;
  };

  const handleGanttMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const el = ganttBarRef.current;
    if (!el) return;

    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const y = e.pageY - el.offsetTop;
    const walkX = (x - startXRef.current);
    const walkY = (y - startYRef.current);

    el.scrollLeft = scrollLeftRef.current - walkX;
    el.scrollTop = scrollTopRef.current - walkY;
  };

  const handleGanttMouseUpOrLeave = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setDragActive(false);
    }
  };

  const [showAllKpi, setShowAllKpi] = React.useState(false);
  const [collapsedMonths, setCollapsedMonths] = React.useState<Record<string, boolean>>({});
  const [collapsedYears, setCollapsedYears] = React.useState<Record<string, boolean>>({});
  const [selectedRoots, setSelectedRoots] = React.useState<Set<string>>(new Set());
  const [multiSelEnabled, setMultiSelEnabled] = React.useState(false);
  const [appliedSelectedRoots, setAppliedSelectedRoots] = React.useState<Set<string>>(new Set());
  const [ganttHierarchyLevel, setGanttHierarchyLevel] = React.useState<string>('all');
  const [ganttHierarchyMode, setGanttHierarchyMode] = React.useState<'wbs' | 'tipo_subc_scap_unit'>('wbs');

  const [internalGanttPAc, setInternalGanttPAc] = React.useState<string>('all');
  const ganttPAc = propsGanttPAc ?? internalGanttPAc;
  const setGanttPAc = propsSetGanttPAc ?? setInternalGanttPAc;
  const [isGanttPAcDropdownOpen, setIsGanttPAcDropdownOpen] = React.useState<boolean>(false);
  const pacDropdownRef = React.useRef<HTMLDivElement>(null);
  const [isPythonMenuOpen, setIsPythonMenuOpen] = React.useState<boolean>(false);
  const pythonMenuRef = React.useRef<HTMLDivElement>(null);

  // Filtros de Tipo en Gantt: Procura, Flete, Montaje, Construcción
  const [isGanttProcuraFilter, setIsGanttProcuraFilter] = React.useState<boolean>(false);
  const [isGanttFleteFilter, setIsGanttFleteFilter] = React.useState<boolean>(false);
  const [isGanttMontajeFilter, setIsGanttMontajeFilter] = React.useState<boolean>(false);
  const [isGanttConstruccionFilter, setIsGanttConstruccionFilter] = React.useState<boolean>(false);

  // Estados de ordenamiento por fecha en el Gantt: 'start' (Inicio) o 'finish' (Fin)
  const [ganttSortField, setGanttSortField] = React.useState<'start' | 'finish' | null>(null);
  const [ganttSortOrder, setGanttSortOrder] = React.useState<'asc' | 'desc'>('asc');

  const handleToggleDateSort = (field: 'start' | 'finish') => {
    if (ganttSortField !== field) {
      setGanttSortField(field);
      setGanttSortOrder('asc'); // Primero earliest a latest
    } else if (ganttSortOrder === 'asc') {
      setGanttSortOrder('desc'); // Luego latest a earliest
    } else {
      setGanttSortField(null); // Quitar orden
      setGanttSortOrder('asc');
    }
  };

  const ganttPAcDisponibles = React.useMemo(() => {
    if (!actividades) return [];
    const set = new Set<string>();
    actividades.forEach(a => {
      if (a.esItemHoja) {
        const val = (a.pAc || '').trim();
        if (val) set.add(val);
        else set.add('(Sin P.Ac)');
      }
    });
    return Array.from(set).sort((a, b) => {
      if (a === '(Sin P.Ac)') return 1;
      if (b === '(Sin P.Ac)') return -1;
      return a.localeCompare(b);
    });
  }, [actividades]);

  const [searchFieldType, setSearchFieldType] = React.useState<'descripcion' | 'cap' | 'scap' | 'subcontratista' | 'pac'>('descripcion');
  const [isSearchPopupOpen, setIsSearchPopupOpen] = React.useState(false);
  const [popupCoords, setPopupCoords] = React.useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const searchRef = React.useRef<HTMLDivElement>(null);
  const blStartFilterRef = React.useRef<HTMLDivElement>(null);
  const blFinishFilterRef = React.useRef<HTMLDivElement>(null);
  const smartFilterRef = React.useRef<HTMLDivElement>(null);

  // --- Estados de Filtro Inteligente de Fechas ---
  const [isSmartFilterOpen, setIsSmartFilterOpen] = React.useState(false);
  const [smartFilterActive, setSmartFilterActive] = React.useState(false);
  const [smartFilterStart, setSmartFilterStart] = React.useState<string>('2026-07-15');
  const [smartFilterEnd, setSmartFilterEnd] = React.useState<string>('2026-07-31');

  // --- Estados de Filtro Tipo Excel para BL Inicio ---
  const [blStartFilterActive, setBlStartFilterActive] = React.useState(false);
  const [blStartSelectedDays, setBlStartSelectedDays] = React.useState<Set<string>>(new Set());
  const [isBlStartFilterOpen, setIsBlStartFilterOpen] = React.useState(false);
  const [tempBlStartSelectedDays, setTempBlStartSelectedDays] = React.useState<Set<string>>(new Set());
  const [tempBlStartFilterActive, setTempBlStartFilterActive] = React.useState(false);
  const [blStartExpandedYears, setBlStartExpandedYears] = React.useState<Set<number>>(new Set());
  const [blStartExpandedMonths, setBlStartExpandedMonths] = React.useState<Set<string>>(new Set()); // Formato: "YYYY-MM"

  // --- Estados de Filtro Tipo Excel para BL Fin ---
  const [blFinishFilterActive, setBlFinishFilterActive] = React.useState(false);
  const [blFinishSelectedDays, setBlFinishSelectedDays] = React.useState<Set<string>>(new Set());
  const [isBlFinishFilterOpen, setIsBlFinishFilterOpen] = React.useState(false);
  const [tempBlFinishSelectedDays, setTempBlFinishSelectedDays] = React.useState<Set<string>>(new Set());
  const [tempBlFinishFilterActive, setTempBlFinishFilterActive] = React.useState(false);
  const [blFinishExpandedYears, setBlFinishExpandedYears] = React.useState<Set<number>>(new Set());
  const [blFinishExpandedMonths, setBlFinishExpandedMonths] = React.useState<Set<string>>(new Set()); // Formato: "YYYY-MM"

  // Árboles de fechas memoizados para BL Inicio y BL Fin (solo de ítems hojas)
  const blStartTreeData = React.useMemo(() => {
    const dates = actividades
      .filter(a => a.esItemHoja && a.blStart instanceof Date && !isNaN(a.blStart.getTime()))
      .map(a => a.blStart as Date);
    
    const hasNull = actividades.some(a => a.esItemHoja && (!a.blStart || !(a.blStart instanceof Date) || isNaN(a.blStart.getTime())));

    const tree: Record<number, Record<number, number[]>> = {};
    dates.forEach(d => {
      const yr = d.getFullYear();
      const m = d.getMonth();
      const dy = d.getDate();
      if (!tree[yr]) tree[yr] = {};
      if (!tree[yr][m]) tree[yr][m] = [];
      if (!tree[yr][m].includes(dy)) {
        tree[yr][m].push(dy);
      }
    });

    Object.keys(tree).forEach(yr => {
      const year = Number(yr);
      Object.keys(tree[year]).forEach(m => {
        const month = Number(m);
        tree[year][month].sort((a, b) => a - b);
      });
    });

    return { tree, hasNull };
  }, [actividades]);

  const blFinishTreeData = React.useMemo(() => {
    const dates = actividades
      .filter(a => a.esItemHoja && a.blFinish instanceof Date && !isNaN(a.blFinish.getTime()))
      .map(a => a.blFinish as Date);
    
    const hasNull = actividades.some(a => a.esItemHoja && (!a.blFinish || !(a.blFinish instanceof Date) || isNaN(a.blFinish.getTime())));

    const tree: Record<number, Record<number, number[]>> = {};
    dates.forEach(d => {
      const yr = d.getFullYear();
      const m = d.getMonth();
      const dy = d.getDate();
      if (!tree[yr]) tree[yr] = {};
      if (!tree[yr][m]) tree[yr][m] = [];
      if (!tree[yr][m].includes(dy)) {
        tree[yr][m].push(dy);
      }
    });

    Object.keys(tree).forEach(yr => {
      const year = Number(yr);
      Object.keys(tree[year]).forEach(m => {
        const month = Number(m);
        tree[year][month].sort((a, b) => a - b);
      });
    });

    return { tree, hasNull };
  }, [actividades]);

  // Funciones auxiliares para obtener todas las llaves (keys) posibles de fechas
  const getAllBlStartKeys = React.useCallback(() => {
    const keys = new Set<string>();
    const { tree, hasNull } = blStartTreeData;
    if (hasNull) keys.add("null");
    Object.keys(tree).forEach(yr => {
      const year = Number(yr);
      Object.keys(tree[year]).forEach(m => {
        const month = Number(m);
        tree[year][month].forEach(day => {
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          keys.add(key);
        });
      });
    });
    return keys;
  }, [blStartTreeData]);

  const getAllBlFinishKeys = React.useCallback(() => {
    const keys = new Set<string>();
    const { tree, hasNull } = blFinishTreeData;
    if (hasNull) keys.add("null");
    Object.keys(tree).forEach(yr => {
      const year = Number(yr);
      Object.keys(tree[year]).forEach(m => {
        const month = Number(m);
        tree[year][month].forEach(day => {
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          keys.add(key);
        });
      });
    });
    return keys;
  }, [blFinishTreeData]);

  // Funciones auxiliares para obtener llaves por año o por mes
  const getBlStartKeysForYear = React.useCallback((year: number) => {
    const keys = new Set<string>();
    const months = blStartTreeData.tree[year] || {};
    Object.keys(months).forEach(m => {
      const month = Number(m);
      months[month].forEach(day => {
        keys.add(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
      });
    });
    return keys;
  }, [blStartTreeData]);

  const getBlStartKeysForMonth = React.useCallback((year: number, month: number) => {
    const keys = new Set<string>();
    const days = (blStartTreeData.tree[year] && blStartTreeData.tree[year][month]) || [];
    days.forEach(day => {
      keys.add(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    });
    return keys;
  }, [blStartTreeData]);

  const getBlFinishKeysForYear = React.useCallback((year: number) => {
    const keys = new Set<string>();
    const months = blFinishTreeData.tree[year] || {};
    Object.keys(months).forEach(m => {
      const month = Number(m);
      months[month].forEach(day => {
        keys.add(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
      });
    });
    return keys;
  }, [blFinishTreeData]);

  const getBlFinishKeysForMonth = React.useCallback((year: number, month: number) => {
    const keys = new Set<string>();
    const days = (blFinishTreeData.tree[year] && blFinishTreeData.tree[year][month]) || [];
    days.forEach(day => {
      keys.add(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    });
    return keys;
  }, [blFinishTreeData]);


  // Filter activities for metrics cards based on appliedSelectedRoots
  const filteredActividadesForStats = React.useMemo(() => {
    let list = actividades;

    // 1. WBS roots filter
    if (appliedSelectedRoots && appliedSelectedRoots.size > 0) {
      const norm = (wbs: string) => wbs.replace(/^p\d{4}\./, 'p.');
      list = list.filter(a => {
        const nwbs = norm(a.wbs || '');
        return Array.from(appliedSelectedRoots).some(root => {
          return nwbs === root || nwbs.startsWith(root + '.');
        });
      });
    }

    // 2. Filtro inteligente (smartFilterActive)
    if (smartFilterActive) {
      const sTime = new Date(smartFilterStart + 'T00:00:00');
      const eTime = new Date(smartFilterEnd + 'T23:59:59');
      const sTimeMs = sTime.getTime();
      const eTimeMs = eTime.getTime();
      const validPeriod = !isNaN(sTimeMs) && !isNaN(eTimeMs);

      if (validPeriod) {
        list = list.filter(a => {
          const hasStart = a.blStart instanceof Date && !isNaN(a.blStart.getTime());
          const hasFinish = a.blFinish instanceof Date && !isNaN(a.blFinish.getTime());
          
          if (hasStart && hasFinish) {
            const startVal = a.blStart.getTime();
            const finishVal = a.blFinish.getTime();
            return (startVal <= eTimeMs) && (finishVal >= sTimeMs);
          }
          
          if (a.esItemHoja) {
            return false;
          }
          return true;
        });
      }
    }

    // 3. Filtro Procura / Flete / Montaje / Construcción
    if (isGanttMontajeFilter || isGanttProcuraFilter || isGanttFleteFilter || isGanttConstruccionFilter) {
      list = list.filter(a => {
        if (!a.esItemHoja) return true;
        const cleanName = (a.descripcion || (a as any).activityName || '').trim().replace(/^["'«\s\-\.]*/, '');
        const isM = /^inst/i.test(cleanName);
        const isP = /^compr/i.test(cleanName);
        const isF = /^flete/i.test(cleanName);
        const isC = !isM && !isP && !isF;

        const matchesMontaje = isGanttMontajeFilter && isM;
        const matchesProcura = isGanttProcuraFilter && isP;
        const matchesFlete = isGanttFleteFilter && isF;
        const matchesConstruccion = isGanttConstruccionFilter && isC;

        return matchesMontaje || matchesProcura || matchesFlete || matchesConstruccion;
      });
    }

    return list;
  }, [actividades, appliedSelectedRoots, smartFilterActive, smartFilterStart, smartFilterEnd, isGanttMontajeFilter, isGanttProcuraFilter, isGanttFleteFilter, isGanttConstruccionFilter]);
  
  // Estados para reporte de equipos a demanda
  const [eqReportOpen, setEqReportOpen] = React.useState(false);
  const [eqAiOpen, setEqAiOpen] = React.useState(false);
  const [eqAiMessages, setEqAiMessages] = React.useState<{ role: 'user' | 'assistant' | 'system'; content: string }[]>([
    {
      role: 'assistant',
      content: '👋 **¡Hola! Soy tu Asistente de Inteligencia.**\n\nPuedo ayudarte a analizar los equipos industriales de este reporte para identificar frentes de riesgo y optimizar la programación.'
    }
  ]);
  const [eqAiInput, setEqAiInput] = React.useState('');
  const [eqAiSuggestionsOpen, setEqAiSuggestionsOpen] = React.useState(false);
  const [eqAiLoading, setEqAiLoading] = React.useState(false);
  const [eqAiError, setEqAiError] = React.useState<string | null>(null);
  const [ganttPorContratarOpen, setGanttPorContratarOpen] = React.useState(true);
  const [eqSearchQuery, setEqSearchQuery] = React.useState('');
  const [eqSubCFilter, setEqSubCFilter] = React.useState('all');
  const [eqTipoFilter, setEqTipoFilter] = React.useState('all');
  const [copiedAlert, setCopiedAlert] = React.useState(false);
  const [copiedGantt, setCopiedGantt] = React.useState(false);
  const [isExportingGanttPdf, setIsExportingGanttPdf] = React.useState(false);

  const handleExportGanttPdf = async () => {
    try {
      setIsExportingGanttPdf(true);
      setIsSmartFilterOpen(false);
      setIsBlStartFilterOpen(false);
      setIsBlFinishFilterOpen(false);
      setIsGanttPAcDropdownOpen(false);
      setIsPythonMenuOpen(false);
      await exportGanttToPdfA3('gantt-card-container');
    } catch (err) {
      console.error('Error al exportar GANTT a PDF:', err);
    } finally {
      setIsExportingGanttPdf(false);
    }
  };
  const [reportTab, setReportTab] = React.useState<'table' | 'text'>('table');
  const [expandedReportWbs, setExpandedReportWbs] = React.useState<Record<string, boolean>>({});
  const [expandedReportScap, setExpandedReportScap] = React.useState<Record<string, boolean>>({});
  const [expandedReportSubc, setExpandedReportSubc] = React.useState<Record<string, boolean>>({});
  const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>({
    'Por Contratar': true,
    'Contratados': true
  });

  const updatePopupCoords = () => {
    if (searchRef.current) {
      const rect = searchRef.current.getBoundingClientRect();
      setPopupCoords({
        top: rect.bottom,
        left: rect.left,
        width: rect.width
      });
    }
  };

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        const portalEl = document.getElementById('gantt-smart-search-portal');
        if (portalEl && portalEl.contains(event.target as Node)) {
          return;
        }
        setIsSearchPopupOpen(false);
      }

      if (blStartFilterRef.current && !blStartFilterRef.current.contains(event.target as Node)) {
        setIsBlStartFilterOpen(false);
      }

      if (blFinishFilterRef.current && !blFinishFilterRef.current.contains(event.target as Node)) {
        setIsBlFinishFilterOpen(false);
      }

      if (smartFilterRef.current && !smartFilterRef.current.contains(event.target as Node)) {
        setIsSmartFilterOpen(false);
      }

      if (pythonMenuRef.current && !pythonMenuRef.current.contains(event.target as Node)) {
        setIsPythonMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  React.useEffect(() => {
    if (isSearchPopupOpen) {
      updatePopupCoords();
      window.addEventListener('resize', updatePopupCoords);
      window.addEventListener('scroll', updatePopupCoords, true);
    }
    return () => {
      window.removeEventListener('resize', updatePopupCoords);
      window.removeEventListener('scroll', updatePopupCoords, true);
    };
  }, [isSearchPopupOpen]);

  const getUniqueValues = (field: 'cap' | 'scap' | 'subcontratista' | 'pac') => {
    const valuesSet = new Set<string>();
    
    // Filtramos las actividades según la tipología seleccionada antes de extraer los valores únicos
    let filteredList = actividades;
    if (tipologiaSeleccionada) {
      filteredList = actividades.filter(a => a.tipo === tipologiaSeleccionada);
    } else if (filterTipologia && filterTipologia !== 'all') {
      filteredList = actividades.filter(a => a.tipo === filterTipologia);
    }

    if (ganttTipo && ganttTipo !== 'all') {
      const allowedTipos = ganttTipo.split(',');
      filteredList = filteredList.filter(a => allowedTipos.includes(a.tipo));
    }

    filteredList.forEach(a => {
      let val = '';
      if (field === 'cap') val = a.cap;
      else if (field === 'scap') val = a.scap;
      else if (field === 'subcontratista') val = a.subcontratista || a.subC;
      else if (field === 'pac') val = a.pAc;

      if (val && typeof val === 'string' && val.trim() !== '') {
        valuesSet.add(val.trim());
      }
    });
    return Array.from(valuesSet).sort((a, b) => a.localeCompare(b));
  };

  // Gemini state hooks
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [analysisResult, setAnalysisResult] = React.useState<string | null>(null);
  const [aiError, setAiError] = React.useState<string | null>(null);
  const [customQuestion, setCustomQuestion] = React.useState('');

  React.useEffect(() => {
    if (isGanttAIPanelOpen && !analysisResult && !isAnalyzing) {
      runGeminiAnalysis();
    }
  }, [isGanttAIPanelOpen]);

  const runGeminiAnalysis = async (specificPrompt?: string) => {
    setIsAnalyzing(true);
    setAiError(null);
    try {
      const statsPayload = {
        total: actividades.length,
        completed: actividades.filter(a => a.p6 === 'Completed' || a.status === 'Completed').length,
        started: actividades.filter(a => a.p6 === 'In Progress' || a.status === 'In Progress').length,
        notStarted: actividades.filter(a => a.p6 === 'Not Started' || a.status === 'Not Started').length,
        delayed: actividades.filter(a => a.estaAtrasadoCronograma || a.retraso > 0).length,
        pctCompleted: Math.round((actividades.filter(a => a.p6 === 'Completed').length / (actividades.length || 1)) * 100),
      };

      // Select representatives - especially delayed WBS items
      const delayed = actividades.filter(a => a.estaAtrasadoCronograma || a.totalFloat < 0);
      const sample = (delayed.length > 0 ? delayed : actividades)
        .slice(0, 45)
        .map(a => ({
          wbs: a.wbs,
          descripcion: a.descripcion,
          duracion: a.duracion,
          p6: a.p6 || a.status || 'Not Started',
          totalFloat: a.totalFloat,
          diasAtrasoMaximo: a.diasAtrasoMaximo || 0,
        }));

      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stats: statsPayload,
          sampleActivities: sample,
          customPrompt: specificPrompt || null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'API_KEY_MISSING') {
          setAiError(data.message);
        } else {
          setAiError(data.message || 'Error al comunicarse con el servidor AI.');
        }
      } else {
        setAnalysisResult(data.analysis);
      }
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'Hubo un problema al procesar la solicitud con la IA.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const parseBoldAndItalic = (str: string) => {
    const parts: React.ReactNode[] = [];
    let currentStr = str;
    let key = 0;
    
    while (currentStr.includes('**')) {
      const startIndex = currentStr.indexOf('**');
      const endIndex = currentStr.indexOf('**', startIndex + 2);
      if (endIndex === -1) break;
      
      // Text before bold
      if (startIndex > 0) {
        parts.push(<span key={key++}>{currentStr.substring(0, startIndex)}</span>);
      }
      // Bold text
      parts.push(
        <strong key={key++} className="font-extrabold text-indigo-200">
          {currentStr.substring(startIndex + 2, endIndex)}
        </strong>
      );
      currentStr = currentStr.substring(endIndex + 2);
    }
    
    if (currentStr) {
      parts.push(<span key={key++}>{currentStr}</span>);
    }
    
    return parts.length > 0 ? parts : str;
  };

  const renderMarkdown = (text: string | null) => {
    if (!text) return null;
    
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Headers
      if (line.startsWith('### ')) {
        return <h4 key={idx} className="text-xs font-bold text-indigo-300 mt-4 mb-2 border-b border-indigo-950/40 pb-1 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-indigo-400" /> {line.replace('### ', '')}</h4>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={idx} className="text-sm font-black text-white mt-5 mb-2.5 flex items-center gap-2 border-b border-indigo-500/30 pb-1"><Brain className="w-4 h-4 text-indigo-400" /> {line.replace('## ', '')}</h3>;
      }
      if (line.startsWith('# ')) {
        return <h2 key={idx} className="text-base font-black text-indigo-100 mt-6 mb-3 tracking-tight">{line.replace('# ', '')}</h2>;
      }
      
      // Unordered lists
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const content = line.substring(2);
        return (
          <li key={idx} className="ml-4 list-disc text-slate-300 text-xs mb-1.5 leading-relaxed">
            {parseBoldAndItalic(content)}
          </li>
        );
      }

      // Ordered lists
      const orderedMatch = line.match(/^(\d+)\.\s(.*)/);
      if (orderedMatch) {
        const num = orderedMatch[1];
        const content = orderedMatch[2];
        return (
          <div key={idx} className="flex gap-2 ml-2 mb-2 text-xs leading-relaxed text-slate-300">
            <span className="font-extrabold text-indigo-400 font-mono">{num}.</span>
            <span className="flex-1">{parseBoldAndItalic(content)}</span>
          </div>
        );
      }
      
      // Empty lines
      if (!line.trim()) return <div key={idx} className="h-2" />;
      
      // Simple paragraph
      return <p key={idx} className="text-xs text-slate-300 leading-relaxed mb-2">{parseBoldAndItalic(line)}</p>;
    });
  };

  React.useEffect(() => {
    setShowAllKpi(false);
  }, [kpiSelected]);

  const { maps, minNivel } = React.useMemo(() => {
    const nonLeaves = actividades.filter(a => !a.esItemHoja);
    const subPartidasByParentWbs = new Map<string, any[]>();
    const leavesByParentWbs = new Map<string, any[]>();

    const cleanWbs = (w: string) => (w || '').replace(/^p\d*\.?/, '');

    // 1. Map clean-to-original for fast closest parent finding
    const nonLeavesCleaned = nonLeaves.map(p => ({
      original: p,
      clean: cleanWbs(p.wbs)
    }));

    // 2. Group sub-partidas by closest parent WBS using cleaned values to prevent prefix mismatches
    nonLeaves.forEach(a => {
      const childClean = cleanWbs(a.wbs);
      if (!childClean) return;

      let bestParent: any = null;
      let bestParentCleanLength = -1;

      nonLeavesCleaned.forEach(parentObj => {
        const parentClean = parentObj.clean;
        // The parent must be strictly shorter than the child to be a parent,
        // and the child must start with the parent's clean path followed by a dot.
        if (parentClean.length < childClean.length && childClean.startsWith(parentClean + '.')) {
          if (parentClean.length > bestParentCleanLength) {
            bestParentCleanLength = parentClean.length;
            bestParent = parentObj.original;
          }
        }
      });

      if (bestParent) {
        const pWbs = bestParent.wbs;
        if (!subPartidasByParentWbs.has(pWbs)) {
          subPartidasByParentWbs.set(pWbs, []);
        }
        subPartidasByParentWbs.get(pWbs)!.push(a);
      }
    });

    // 3. Find closest parent for each leaf activity
    actividades.forEach(a => {
      if (a.esItemHoja) {
        const leafClean = cleanWbs(a.wbs);
        if (!leafClean) return;

        let bestParent: any = null;
        let bestParentCleanLength = -1;

        nonLeavesCleaned.forEach(parentObj => {
          const parentClean = parentObj.clean;
          const isParent = leafClean === parentClean || leafClean.startsWith(parentClean + '.');
          if (isParent) {
            if (parentClean.length > bestParentCleanLength) {
              bestParentCleanLength = parentClean.length;
              bestParent = parentObj.original;
            }
          }
        });

        if (bestParent) {
          const pWbs = bestParent.wbs;
          if (!leavesByParentWbs.has(pWbs)) {
            leavesByParentWbs.set(pWbs, []);
          }
          leavesByParentWbs.get(pWbs)!.push(a);
        }
      }
    });

    const calculatedMinNivel = nonLeaves.length > 0 ? Math.min(...nonLeaves.map(a => a.nivel)) : 1;

    return {
      maps: {
        subPartidasByParentWbs,
        leavesByParentWbs
      },
      minNivel: calculatedMinNivel
    };
  }, [actividades]);

  // All automatic Gantt expansion logic has been removed to keep the chart collapsed by default.
  // The user will expand and collapse sections manually as needed.

  if (!statsCronograma) return null;

  const tipologiasDisponibles = [
    '01.Preliminares',
    '02.Obra Civil',
    '03.Equipo Mecanico',
    '04.Equipo Electrico',
    '05.Instrumentacion y Control',
    '06.Climatizacion',
    '07.Tuberia',
    '09.Obra Arquitectonica',
    '10.PMA',
    '11.Puesta en Marcha'
  ];

  const ROW_H = 26;
  const COL_W = ganttZoom === 'month' ? 50 : 84;
  const isValidDate = (d: any) => d instanceof Date && !isNaN(d.getTime());

  const fmtShort = (d: Date | null) => {
    if (!isValidDate(d) || !d) return '—';
    const mm = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][d.getMonth()];
    return `${String(d.getDate()).padStart(2, '0')}-${mm}-${String(d.getFullYear()).slice(2)}`;
  };

  const normalize = (wbs: string) => wbs.replace(/^p\d{4}\./, 'p.');

  // Render tree item
  const renderActividadItem = (item: any): React.ReactNode => {
    let hasChildren = false;
    let tieneSubPartidas = false;
    let tieneItems = false;
    
    let subPartidasList: any[] = [];
    let leafItemsList: any[] = [];

    if (!item.esItemHoja) {
      const parentWbs = item.wbs || '';
      subPartidasList = maps.subPartidasByParentWbs.get(parentWbs) || [];

      const rawLeafItems = maps.leavesByParentWbs.get(parentWbs) || [];
      if (tipologiaSeleccionada) {
        leafItemsList = rawLeafItems.filter(a => a.tipo === tipologiaSeleccionada);
      } else {
        leafItemsList = rawLeafItems;
      }

      tieneSubPartidas = subPartidasList.length > 0;
      tieneItems = leafItemsList.length > 0;
      hasChildren = tieneSubPartidas || tieneItems;
    }
    
    const isExpanded = expandedItems.has(item.id);
    const avance = calcularAvance(item);
    const indentLevel = (item.nivel - 1) * 4;
    const valoresReales = calcularValoresReales(item);
    
    let rowBg = '';
    if (!item.esItemHoja) {
      const level = item.nivel;
      if (level <= 1) {
        rowBg = 'bg-slate-200/90 border-l-[6px] border-slate-700 font-extrabold text-slate-900';
      } else if (level === 2) {
        rowBg = 'bg-blue-100/60 border-l-4 border-blue-600 font-bold text-blue-900';
      } else if (level === 3) {
        rowBg = 'bg-amber-50 border-l-4 border-amber-500 font-bold text-amber-900';
      } else if (level === 4) {
        rowBg = 'bg-emerald-50/70 border-l-4 border-emerald-500 font-bold text-emerald-950';
      } else if (level === 5) {
        rowBg = 'bg-sky-50 border-l-4 border-sky-500 font-semibold text-sky-900';
      } else if (level === 6) {
        rowBg = 'bg-purple-50 border-l-4 border-purple-400 font-semibold text-purple-900';
      } else {
        rowBg = 'bg-rose-50 border-l-4 border-rose-400 font-semibold text-rose-900';
      }
    } else {
      rowBg = 'bg-white hover:bg-gray-50';
    }

    return (
      <div key={item.id} className="border-b border-gray-100">
        <div
          className={`flex items-center py-3 px-4 cursor-pointer transition-colors ${rowBg}`}
          style={{ paddingLeft: `${8 + indentLevel}px` }}
          onClick={() => {
            if (hasChildren) toggleExpand(item.id);
          }}
        >
          <div className="flex-shrink-0 w-6">
            {hasChildren && (
              isExpanded ? 
                <ChevronDown className="w-4 h-4 text-gray-500" /> : 
                <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </div>
          
          <div className="flex-1 grid gap-3 items-center" style={{ gridTemplateColumns: '80px 2fr 1.4fr 1.4fr 1.4fr 1.6fr 1.2fr 90px' }}>
            <div className="text-xs text-gray-600 font-mono text-center">{item.activityId || ''}</div>
            <div>
              <div className="flex items-center gap-2">
                {!item.esItemHoja && (
                  <div className="text-xs text-blue-600 font-mono bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{item.wbs}</div>
                )}
                <div className={`${!item.esItemHoja ? 'font-bold' : ''} text-sm flex-1`}>{item.descripcion}</div>
              </div>
            </div>
            
            <div className="text-center font-semibold">{valoresReales.venta.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            <div className="text-center text-blue-700 font-semibold">{valoresReales.ventaPlan.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            <div className="text-center text-green-700 font-semibold">{valoresReales.ventaEjecutada.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <div className="text-sm font-semibold">{avance}%</div>
                <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full ${avance >= 100 ? 'bg-green-500' : avance >= 75 ? 'bg-blue-500' : 'bg-red-500'}`} style={{ width: `${Math.min(avance, 100)}%` }} />
                </div>
              </div>
            </div>
            
            <div className="text-center">
              <div className={`text-sm font-semibold ${valoresReales.saldo < 0 ? 'text-red-600' : 'text-green-700'}`}>
                {valoresReales.saldo < 0 ? `(${Math.abs(valoresReales.saldo).toLocaleString('en-US', { minimumFractionDigits: 2 })})` : `${valoresReales.saldo.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              </div>
            </div>
            <div className="text-center font-semibold text-gray-500">-</div>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {leafItemsList.map(child => renderActividadItem(child))}
            {subPartidasList.map(child => renderActividadItem(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* IA Schedule Intel Panel */}
      {isGanttAIPanelOpen && (
        <div className="bg-slate-900 border border-indigo-500/80 rounded-2xl shadow-xl overflow-hidden relative transition-all animate-fade-in">
          {/* Subtle decorative grid background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />
          
          <div className="p-5 relative z-10">
            <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-800 pb-4 mb-5">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/10 shrink-0">
                  <Sparkles className="w-5.5 h-5.5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <span>Asistente de Inteligencia Artificial</span>
                    <span className="text-[9px] font-black uppercase tracking-wider bg-indigo-500/25 border border-indigo-400/40 text-indigo-200 px-2.5 py-0.5 rounded-full">
                      PMI-SP Advisor
                    </span>
                  </h3>
                  <p className="text-xs text-slate-450 max-w-2xl mt-0.5 leading-relaxed">
                    Consulte al motor de IA para auditar la lógica del WBS, analizar holguras totales (Total Float), diagnosticar causas de atraso y generar planes de aceleración de plazos.
                  </p>
                </div>
              </div>

              {setIsGanttAIPanelOpen && (
                <button
                  onClick={() => setIsGanttAIPanelOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 border border-slate-750 hover:bg-slate-750 hover:text-white text-xs font-bold transition-all active:scale-95 cursor-pointer"
                >
                  ✕ Cerrar Inteligencia
                </button>
              )}
            </div>

            {/* Presets and Chat entry */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left panel: Prompts and Inputs */}
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-slate-850/60 p-4 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-450 block mb-2">
                    Análisis Rápidos Recomendados
                  </span>
                  <div className="flex flex-col gap-2">
                    {[
                      { label: '🩺 Salud General & Desviaciones', prompt: 'Realiza un diagnóstico completo de salud general del cronograma, reportando tasa de atrasos y WBS críticos.' },
                      { label: '⛓️ Camino Crítico & Holguras', prompt: 'Identifica las actividades con mayor holgura negativa o nula (Total Float = 0) y qué riesgo conllevan para la entrega del hito final.' },
                      { label: '🚀 Estrategias de Aceleración', prompt: 'Brinda recomendaciones concretas de resecuenciación lógica (Fast-Tracking) y crashing de recursos basadas en las actividades más desviadas.' },
                      { label: '📋 Plan de Acción PMI-SP de 3 Pasos', prompt: 'Genera un plan estratégico de acción inmediata paso a paso para regularizar los frentes de trabajo con desfases superiores a los 30 días.' }
                    ].map((preset, index) => (
                      <button
                        key={index}
                        disabled={isAnalyzing}
                        onClick={() => runGeminiAnalysis(preset.prompt)}
                        className="w-full text-left p-2.5 rounded-lg text-slate-200 text-xs bg-slate-805 hover:bg-slate-750 hover:text-white border border-slate-750 font-medium transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ask custom container */}
                <div className="bg-slate-850/60 p-4 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-450 block mb-2">
                    Consulta Personalizada al Experto
                  </span>
                  <div className="space-y-2">
                    <textarea
                      value={customQuestion}
                      onChange={(e) => setCustomQuestion(e.target.value)}
                      placeholder="Ej. ¿Cómo afectan los atrasos en procura al hito final? ¿Qué WBS tiene menor holgura total?"
                      rows={3}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none font-semibold"
                    />
                    <button
                      onClick={() => {
                        if (customQuestion.trim() && !isAnalyzing) {
                          runGeminiAnalysis(customQuestion);
                        }
                      }}
                      disabled={!customQuestion.trim() || isAnalyzing}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-mini cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Consultar Asesor AI
                    </button>
                  </div>
                </div>
              </div>

              {/* Right panel: Analysis Output */}
              <div className="lg:col-span-8 flex flex-col min-h-64 bg-slate-950 p-5 rounded-2xl border border-slate-850 justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-4">
                    <span className="text-xs font-black text-slate-400 flex items-center gap-2">
                      <Brain className="w-4 h-4 text-indigo-400" />
                      Resultado del Análisis Inteligente
                    </span>
                    {analysisResult && !isAnalyzing && (
                      <button
                        onClick={() => runGeminiAnalysis()}
                        className="text-[10px] uppercase font-black text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" /> Re-analizar
                      </button>
                    )}
                  </div>

                  {isAnalyzing ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
                      <div className="relative flex items-center justify-center mb-4">
                        <div className="w-12 h-12 rounded-full border-t-2 border-indigo-500 animate-spin" />
                        <Sparkles className="w-5 h-5 text-indigo-200 absolute animate-pulse" />
                      </div>
                      <h4 className="text-sm font-bold text-white mb-1">Analizando Base de Datos de Planificación...</h4>
                      <p className="text-xs text-slate-405 max-w-sm mx-auto leading-relaxed">
                        Transmitiendo métricas agregadas del WBS, estados de Primavera P6 y coeficientes de holgura total al agente de Gemini...
                      </p>
                    </div>
                  ) : aiError ? (
                    <div className="bg-red-950/40 border border-red-500/40 p-4 rounded-xl text-red-200 animate-fade-in">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="w-4.5 h-4.5 text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-black text-red-100 uppercase tracking-wide">Falta Configuración</h4>
                          <p className="text-xs text-red-300/90 mt-1 leading-relaxed">
                            {aiError}
                          </p>
                          <div className="mt-3 text-[10px] bg-red-900/30 border border-red-800/45 p-2.5 rounded font-mono text-indigo-200">
                            Tip: si el problema persiste, intenta de nuevo en unos minutos.
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : analysisResult ? (
                    <div className="space-y-1 text-slate-200 pr-1 max-h-[420px] overflow-y-auto custom-scrollbar animate-fade-in">
                      {renderMarkdown(analysisResult)}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 animate-fade-in">
                      <Brain className="w-10 h-10 text-indigo-500/60 mb-3" />
                      <h4 className="text-xs font-bold text-slate-300">Asesor de Planificación Activo</h4>
                      <p className="text-[11px] text-slate-500 max-w-sm mt-1">
                        Seleccione uno de los análisis rápidos recomendados de la izquierda o formule su propia pregunta respecto a las partidas de este cronograma.
                      </p>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-900 mt-4 pt-3 flex items-center justify-between text-[10px] text-slate-500 font-bold">
                  <span>CONFORMIDAD PMI STANDARD</span>
                  <span>Active Intelligence</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {kpiSelected && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg flex items-center justify-between text-xs animate-fade-in shadow-mini">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <span className="font-semibold text-blue-900">
              Filtro Activo: El Cronograma Gantt está filtrado mostrando únicamente las actividades correspondientes a: <strong>
              {kpiSelected === 'atrasados' ? 'Items con Atraso' :
               kpiSelected === 'acTotal' ? 'Total Act.' :
               kpiSelected === 'acCompletadas' ? 'Actividades Completadas' :
               kpiSelected === 'acEnCurso' ? 'Actividades en Curso' :
               kpiSelected === 'acNoIniciadas' ? 'Actividades no Iniciadas' :
               kpiSelected === 'acCriticas' ? (hasNegativeGlobalFloat ? `Ruta Crítica (${globalMinFloat}d)` : 'Actividades Críticas (0d)') :
               kpiSelected === 'acSubcriticas' ? 'Actividades Subcríticas (<0d)' :
               kpiSelected === 'acRiesgosas' ? 'Actividades Riesgosas (0-20d)' :
               'Riesgo Crítico'}
              </strong>. El árbol se ha auto-expandido automáticamente.
            </span>
          </div>
          <button
            onClick={() => setKpiSelected(null)}
            className="text-[10px] bg-white text-blue-700 hover:bg-blue-100 px-2.5 py-1 rounded border border-blue-300 transition-colors font-bold uppercase tracking-wider shadow-mini"
          >
            ✕ Limpiar Filtro KPI
          </button>
        </div>
      )}

      {/* Gantt controllers & visualizers */}
      <GanttMetricas
        actividades={filteredActividadesForStats}
        ganttStatus={ganttStatus}
        setGanttStatus={setGanttStatus}
        ganttFloat={ganttFloat}
        setGanttFloat={setGanttFloat}
        setGanttTipo={setGanttTipo}
        setGanttExp={setGanttExp}
        ganttMetricsOpen={ganttMetricsOpen}
        setGanttMetricsOpen={setGanttMetricsOpen}
      />
      <GanttPorContratar
        actividades={filteredActividadesForStats}
        onOpenReport={() => setEqReportOpen(true)}
        isOpen={ganttPorContratarOpen}
        setIsOpen={setGanttPorContratarOpen}
      />
      <GanttTipologia
        actividades={filteredActividadesForStats}
        ganttTipo={ganttTipo}
        setGanttTipo={setGanttTipo}
        setGanttStatus={setGanttStatus}
        ganttStatus={ganttStatus}
        setGanttFloat={setGanttFloat}
        ganttFloat={ganttFloat}
        setGanttExp={setGanttExp}
        ganttTipoOpen={ganttTipoOpen}
        setGanttTipoOpen={setGanttTipoOpen}
      />

      {appliedSelectedRoots.size > 0 && (
        <div className="mb-3 p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-amber-900 text-xs font-bold flex items-center justify-between shadow-mini animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span>ℹ️ Los contadores de las tarjetas de arriba están filtrados por las {appliedSelectedRoots.size} partidas seleccionadas en la tabla.</span>
          </div>
          <button 
            onClick={() => {
              setSelectedRoots(new Set());
              setAppliedSelectedRoots(new Set());
            }} 
            className="text-[10px] bg-white hover:bg-amber-100 text-amber-800 px-2 py-0.5 rounded-lg border border-amber-300 font-extrabold transition-all ml-4"
          >
            Quitar Filtro
          </button>
        </div>
      )}

      {/* Gantt Interactive SVG Container */}
      {(() => {
        const ROW_H = 26;
        const COL_W = ganttZoom === 'month' ? 50 : 84;

        // ── Helpers ──────────────────────────────────────────────────
        const isValidDate = (d: any): d is Date => d instanceof Date && !isNaN(d.getTime());
        const fmtShort = (d: Date | null) => {
          if (!isValidDate(d)) return '—';
          const mm = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][d.getMonth()];
          return `${String(d.getDate()).padStart(2, '0')}-${mm}-${String(d.getFullYear()).slice(2)}`;
        };
        const getShortMonthName = (monthIndex: number) => {
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          return months[monthIndex % 12];
        };
        const normalize = (wbs: string) => wbs.replace(/^p\d{4}\./, 'p.');

        // ── Custom Checkbox for Excel Style Dropdown ─────────────────
        const renderCustomCheckbox = (checked: boolean, indeterminate: boolean | undefined, onChange: () => void) => {
          return (
            <div 
              onClick={(e) => { e.stopPropagation(); onChange(); }}
              className="flex items-center cursor-pointer select-none py-0.5"
            >
              <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all shrink-0 ${
                checked 
                  ? 'bg-indigo-600 border-indigo-600 text-white' 
                  : indeterminate 
                    ? 'bg-indigo-500 border-indigo-500 text-white' 
                    : 'bg-white border-slate-300 hover:border-slate-400'
              }`}>
                {checked && (
                  <svg className="w-2.5 h-2.5 stroke-[3] stroke-current text-white" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {!checked && indeterminate && (
                  <div className="w-1.5 h-0.5 bg-white rounded" />
                )}
              </div>
            </div>
          );
        };

        // ── Dropdown Filtro BL Inicio ────────────────────────────────
        const renderBlStartFilterDropdown = () => {
          const allKeys = getAllBlStartKeys();
          const selectAllChecked = allKeys.size > 0 && Array.from(allKeys).every(k => tempBlStartSelectedDays.has(k));
          const selectAllNone = Array.from(allKeys).every(k => !tempBlStartSelectedDays.has(k));
          const selectAllIndeterminate = !selectAllChecked && !selectAllNone;

          const { tree, hasNull } = blStartTreeData;

          return (
            <div 
              className="ht-dd absolute top-full left-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 text-slate-700 font-sans text-xs p-3 flex flex-col gap-2.5 max-h-[380px] overflow-hidden select-none"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">
                Filtro BL Inicio
              </div>

              {/* Tree Container */}
              <div className="flex-1 overflow-y-auto space-y-1.5 max-h-56 pr-1 scrollbar-thin">
                {/* Seleccionar Todo */}
                <div className="flex items-center gap-1.5 hover:bg-slate-50 rounded px-1 py-0.5 transition-colors">
                  {renderCustomCheckbox(selectAllChecked, selectAllIndeterminate, () => {
                    const newSet = new Set<string>();
                    if (!selectAllChecked) {
                      allKeys.forEach(k => newSet.add(k));
                    }
                    setTempBlStartSelectedDays(newSet);
                  })}
                  <span className="font-bold text-slate-700 cursor-pointer text-[11px]" onClick={() => {
                    const newSet = new Set<string>();
                    if (!selectAllChecked) {
                      allKeys.forEach(k => newSet.add(k));
                    }
                    setTempBlStartSelectedDays(newSet);
                  }}>
                    (Seleccionar todo)
                  </span>
                </div>

                {/* Years, Months, Days */}
                {Object.keys(tree).sort().map(yrStr => {
                  const year = Number(yrStr);
                  const months = tree[year];
                  const isYearExpanded = blStartExpandedYears.has(year);
                  const yearKeys = getBlStartKeysForYear(year);
                  const yrAllChecked = Array.from(yearKeys).every(k => tempBlStartSelectedDays.has(k));
                  const yrNoneChecked = Array.from(yearKeys).every(k => !tempBlStartSelectedDays.has(k));
                  const yrIndeterminate = !yrAllChecked && !yrNoneChecked;

                  return (
                    <div key={year} className="space-y-1 pl-1">
                      {/* Year Header */}
                      <div className="flex items-center gap-1.5 hover:bg-slate-50 rounded px-1 py-0.5 transition-colors">
                        <button
                          onClick={() => {
                            const newSet = new Set(blStartExpandedYears);
                            if (isYearExpanded) newSet.delete(year);
                            else newSet.add(year);
                            setBlStartExpandedYears(newSet);
                          }}
                          className="p-0.5 hover:bg-slate-150 rounded text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                        >
                          {isYearExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                        {renderCustomCheckbox(yrAllChecked, yrIndeterminate, () => {
                          const newSet = new Set(tempBlStartSelectedDays);
                          if (yrAllChecked) {
                            yearKeys.forEach(k => newSet.delete(k));
                          } else {
                            yearKeys.forEach(k => newSet.add(k));
                          }
                          setTempBlStartSelectedDays(newSet);
                        })}
                        <span 
                          className="font-bold text-slate-600 cursor-pointer text-[11px]"
                          onClick={() => {
                            const newSet = new Set(blStartExpandedYears);
                            if (isYearExpanded) newSet.delete(year);
                            else newSet.add(year);
                            setBlStartExpandedYears(newSet);
                          }}
                        >
                          {year}
                        </span>
                      </div>

                      {/* Months under Year */}
                      {isYearExpanded && Object.keys(months).map(mStr => {
                        const month = Number(mStr);
                        const days = months[month];
                        const monthKey = `${year}-${month}`;
                        const isMonthExpanded = blStartExpandedMonths.has(monthKey);
                        const monthKeys = getBlStartKeysForMonth(year, month);
                        const moAllChecked = Array.from(monthKeys).every(k => tempBlStartSelectedDays.has(k));
                        const moNoneChecked = Array.from(monthKeys).every(k => !tempBlStartSelectedDays.has(k));
                        const moIndeterminate = !moAllChecked && !moNoneChecked;

                        const monthLabel = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][month];

                        return (
                          <div key={monthKey} className="space-y-1 pl-4">
                            {/* Month Header */}
                            <div className="flex items-center gap-1.5 hover:bg-slate-50 rounded px-1 py-0.5 transition-colors">
                              <button
                                onClick={() => {
                                  const newSet = new Set(blStartExpandedMonths);
                                  if (isMonthExpanded) newSet.delete(monthKey);
                                  else newSet.add(monthKey);
                                  setBlStartExpandedMonths(newSet);
                                }}
                                className="p-0.5 hover:bg-slate-150 rounded text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                              >
                                {isMonthExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                              </button>
                              {renderCustomCheckbox(moAllChecked, moIndeterminate, () => {
                                const newSet = new Set(tempBlStartSelectedDays);
                                if (moAllChecked) {
                                  monthKeys.forEach(k => newSet.delete(k));
                                } else {
                                  monthKeys.forEach(k => newSet.add(k));
                                }
                                setTempBlStartSelectedDays(newSet);
                              })}
                              <span 
                                className="font-medium text-slate-600 cursor-pointer text-[10.5px]"
                                onClick={() => {
                                  const newSet = new Set(blStartExpandedMonths);
                                  if (isMonthExpanded) newSet.delete(monthKey);
                                  else newSet.add(monthKey);
                                  setBlStartExpandedMonths(newSet);
                                }}
                              >
                                {monthLabel}
                              </span>
                            </div>

                            {/* Days under Month */}
                            {isMonthExpanded && days.map(day => {
                              const dayKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                              const isDayChecked = tempBlStartSelectedDays.has(dayKey);

                              return (
                                <div key={day} className="flex items-center gap-1.5 hover:bg-slate-50 rounded pl-8 pr-1 py-0.5 transition-colors">
                                  <div className="w-4 shrink-0" />
                                  {renderCustomCheckbox(isDayChecked, undefined, () => {
                                    const newSet = new Set(tempBlStartSelectedDays);
                                    if (isDayChecked) {
                                      newSet.delete(dayKey);
                                    } else {
                                      newSet.add(dayKey);
                                    }
                                    setTempBlStartSelectedDays(newSet);
                                  })}
                                  <span 
                                    className="text-slate-500 cursor-pointer text-[10px]"
                                    onClick={() => {
                                      const newSet = new Set(tempBlStartSelectedDays);
                                      if (isDayChecked) {
                                        newSet.delete(dayKey);
                                      } else {
                                        newSet.add(dayKey);
                                      }
                                      setTempBlStartSelectedDays(newSet);
                                    }}
                                  >
                                    {String(day).padStart(2, '0')}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Null/Empty Dates */}
                {hasNull && (
                  <div className="flex items-center gap-1.5 hover:bg-slate-50 rounded px-1 py-0.5 transition-colors pl-1">
                    <div className="w-4 shrink-0" />
                    {renderCustomCheckbox(tempBlStartSelectedDays.has("null"), undefined, () => {
                      const newSet = new Set(tempBlStartSelectedDays);
                      if (newSet.has("null")) {
                        newSet.delete("null");
                      } else {
                        newSet.add("null");
                      }
                      setTempBlStartSelectedDays(newSet);
                    })}
                    <span className="text-slate-500 font-medium cursor-pointer text-[10.5px]" onClick={() => {
                      const newSet = new Set(tempBlStartSelectedDays);
                      if (newSet.has("null")) {
                        newSet.delete("null");
                      } else {
                        newSet.add("null");
                      }
                      setTempBlStartSelectedDays(newSet);
                    }}>
                      (Vacías)
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-1.5 border-t border-slate-100 pt-2 shrink-0">
                <button
                  onClick={() => {
                    setIsBlStartFilterOpen(false);
                  }}
                  className="px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors border border-transparent"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    const isAnyUnchecked = tempBlStartSelectedDays.size < allKeys.size;
                    setBlStartSelectedDays(new Set(tempBlStartSelectedDays));
                    setBlStartFilterActive(isAnyUnchecked);
                    setIsBlStartFilterOpen(false);
                  }}
                  className="px-3 py-1 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-mini transition-colors"
                >
                  Aceptar
                </button>
              </div>
            </div>
          );
        };

        // ── Dropdown Filtro BL Fin ───────────────────────────────────
        const renderBlFinishFilterDropdown = () => {
          const allKeys = getAllBlFinishKeys();
          const selectAllChecked = allKeys.size > 0 && Array.from(allKeys).every(k => tempBlFinishSelectedDays.has(k));
          const selectAllNone = Array.from(allKeys).every(k => !tempBlFinishSelectedDays.has(k));
          const selectAllIndeterminate = !selectAllChecked && !selectAllNone;

          const { tree, hasNull } = blFinishTreeData;

          return (
            <div 
              className="ht-dd absolute top-full left-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 text-slate-700 font-sans text-xs p-3 flex flex-col gap-2.5 max-h-[380px] overflow-hidden select-none"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">
                Filtro BL Fin
              </div>

              {/* Tree Container */}
              <div className="flex-1 overflow-y-auto space-y-1.5 max-h-56 pr-1 scrollbar-thin">
                {/* Seleccionar Todo */}
                <div className="flex items-center gap-1.5 hover:bg-slate-50 rounded px-1 py-0.5 transition-colors">
                  {renderCustomCheckbox(selectAllChecked, selectAllIndeterminate, () => {
                    const newSet = new Set<string>();
                    if (!selectAllChecked) {
                      allKeys.forEach(k => newSet.add(k));
                    }
                    setTempBlFinishSelectedDays(newSet);
                  })}
                  <span className="font-bold text-slate-700 cursor-pointer text-[11px]" onClick={() => {
                    const newSet = new Set<string>();
                    if (!selectAllChecked) {
                      allKeys.forEach(k => newSet.add(k));
                    }
                    setTempBlFinishSelectedDays(newSet);
                  }}>
                    (Seleccionar todo)
                  </span>
                </div>

                {/* Years, Months, Days */}
                {Object.keys(tree).sort().map(yrStr => {
                  const year = Number(yrStr);
                  const months = tree[year];
                  const isYearExpanded = blFinishExpandedYears.has(year);
                  const yearKeys = getBlFinishKeysForYear(year);
                  const yrAllChecked = Array.from(yearKeys).every(k => tempBlFinishSelectedDays.has(k));
                  const yrNoneChecked = Array.from(yearKeys).every(k => !tempBlFinishSelectedDays.has(k));
                  const yrIndeterminate = !yrAllChecked && !yrNoneChecked;

                  return (
                    <div key={year} className="space-y-1 pl-1">
                      {/* Year Header */}
                      <div className="flex items-center gap-1.5 hover:bg-slate-50 rounded px-1 py-0.5 transition-colors">
                        <button
                          onClick={() => {
                            const newSet = new Set(blFinishExpandedYears);
                            if (isYearExpanded) newSet.delete(year);
                            else newSet.add(year);
                            setBlFinishExpandedYears(newSet);
                          }}
                          className="p-0.5 hover:bg-slate-150 rounded text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                        >
                          {isYearExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                        {renderCustomCheckbox(yrAllChecked, yrIndeterminate, () => {
                          const newSet = new Set(tempBlFinishSelectedDays);
                          if (yrAllChecked) {
                            yearKeys.forEach(k => newSet.delete(k));
                          } else {
                            yearKeys.forEach(k => newSet.add(k));
                          }
                          setTempBlFinishSelectedDays(newSet);
                        })}
                        <span 
                          className="font-bold text-slate-600 cursor-pointer text-[11px]"
                          onClick={() => {
                            const newSet = new Set(blFinishExpandedYears);
                            if (isYearExpanded) newSet.delete(year);
                            else newSet.add(year);
                            setBlFinishExpandedYears(newSet);
                          }}
                        >
                          {year}
                        </span>
                      </div>

                      {/* Months under Year */}
                      {isYearExpanded && Object.keys(months).map(mStr => {
                        const month = Number(mStr);
                        const days = months[month];
                        const monthKey = `${year}-${month}`;
                        const isMonthExpanded = blFinishExpandedMonths.has(monthKey);
                        const monthKeys = getBlFinishKeysForMonth(year, month);
                        const moAllChecked = Array.from(monthKeys).every(k => tempBlFinishSelectedDays.has(k));
                        const moNoneChecked = Array.from(monthKeys).every(k => !tempBlFinishSelectedDays.has(k));
                        const moIndeterminate = !moAllChecked && !moNoneChecked;

                        const monthLabel = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][month];

                        return (
                          <div key={monthKey} className="space-y-1 pl-4">
                            {/* Month Header */}
                            <div className="flex items-center gap-1.5 hover:bg-slate-50 rounded px-1 py-0.5 transition-colors">
                              <button
                                onClick={() => {
                                  const newSet = new Set(blFinishExpandedMonths);
                                  if (isMonthExpanded) newSet.delete(monthKey);
                                  else newSet.add(monthKey);
                                  setBlFinishExpandedMonths(newSet);
                                }}
                                className="p-0.5 hover:bg-slate-150 rounded text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                              >
                                {isMonthExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                              </button>
                              {renderCustomCheckbox(moAllChecked, moIndeterminate, () => {
                                const newSet = new Set(tempBlFinishSelectedDays);
                                if (moAllChecked) {
                                  monthKeys.forEach(k => newSet.delete(k));
                                } else {
                                  monthKeys.forEach(k => newSet.add(k));
                                }
                                setTempBlFinishSelectedDays(newSet);
                              })}
                              <span 
                                className="font-medium text-slate-600 cursor-pointer text-[10.5px]"
                                onClick={() => {
                                  const newSet = new Set(blFinishExpandedMonths);
                                  if (isMonthExpanded) newSet.delete(monthKey);
                                  else newSet.add(monthKey);
                                  setBlFinishExpandedMonths(newSet);
                                }}
                              >
                                {monthLabel}
                              </span>
                            </div>

                            {/* Days under Month */}
                            {isMonthExpanded && days.map(day => {
                              const dayKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                              const isDayChecked = tempBlFinishSelectedDays.has(dayKey);

                              return (
                                <div key={day} className="flex items-center gap-1.5 hover:bg-slate-50 rounded pl-8 pr-1 py-0.5 transition-colors">
                                  <div className="w-4 shrink-0" />
                                  {renderCustomCheckbox(isDayChecked, undefined, () => {
                                    const newSet = new Set(tempBlFinishSelectedDays);
                                    if (isDayChecked) {
                                      newSet.delete(dayKey);
                                    } else {
                                      newSet.add(dayKey);
                                    }
                                    setTempBlFinishSelectedDays(newSet);
                                  })}
                                  <span 
                                    className="text-slate-500 cursor-pointer text-[10px]"
                                    onClick={() => {
                                      const newSet = new Set(tempBlFinishSelectedDays);
                                      if (isDayChecked) {
                                        newSet.delete(dayKey);
                                      } else {
                                        newSet.add(dayKey);
                                      }
                                      setTempBlFinishSelectedDays(newSet);
                                    }}
                                  >
                                    {String(day).padStart(2, '0')}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Null/Empty Dates */}
                {hasNull && (
                  <div className="flex items-center gap-1.5 hover:bg-slate-50 rounded px-1 py-0.5 transition-colors pl-1">
                    <div className="w-4 shrink-0" />
                    {renderCustomCheckbox(tempBlFinishSelectedDays.has("null"), undefined, () => {
                      const newSet = new Set(tempBlFinishSelectedDays);
                      if (newSet.has("null")) {
                        newSet.delete("null");
                      } else {
                        newSet.add("null");
                      }
                      setTempBlFinishSelectedDays(newSet);
                    })}
                    <span className="text-slate-500 font-medium cursor-pointer text-[10.5px]" onClick={() => {
                      const newSet = new Set(tempBlFinishSelectedDays);
                      if (newSet.has("null")) {
                        newSet.delete("null");
                      } else {
                        newSet.add("null");
                      }
                      setTempBlFinishSelectedDays(newSet);
                    }}>
                      (Vacías)
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-1.5 border-t border-slate-100 pt-2 shrink-0">
                <button
                  onClick={() => {
                    setIsBlFinishFilterOpen(false);
                  }}
                  className="px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors border border-transparent"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    const isAnyUnchecked = tempBlFinishSelectedDays.size < allKeys.size;
                    setBlFinishSelectedDays(new Set(tempBlFinishSelectedDays));
                    setBlFinishFilterActive(isAnyUnchecked);
                    setIsBlFinishFilterOpen(false);
                  }}
                  className="px-3 py-1 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-mini transition-colors"
                >
                  Aceptar
                </button>
              </div>
            </div>
          );
        };

        // ── Construir árbol normalizado desde actividades ─────────────
        const ganttNodes: any[] = [];
        const partidasAdded = new Set<string>();

        if (ganttHierarchyMode === 'wbs') {
          // Pre-populate descriptions dictionary from Column A and activity names
          const wbsDescLookup = new Map<string, string>();
          actividades.forEach(a => {
            const raw = a.wbs || (a as any).wbsRaw || '';
            const p = parseWbsAndDescription(raw);
            if (p.description) {
              const cleanCode = p.wbs.toLowerCase();
              wbsDescLookup.set(cleanCode, p.description);
              wbsDescLookup.set(cleanCode.replace(/^p\d{4}\./, 'p.'), p.description);
            }
            if (a.descripcion && !a.esItemHoja) {
              const cleanCode = (p.wbs || raw).toLowerCase();
              if (!wbsDescLookup.has(cleanCode)) {
                wbsDescLookup.set(cleanCode, a.descripcion);
                wbsDescLookup.set(cleanCode.replace(/^p\d{4}\./, 'p.'), a.descripcion);
              }
            }
          });

          actividades.forEach(a => {
            const rawWbs = a.wbs || (a as any).wbsRaw || '';
            const scapLower = String(a.scap || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            const isValvula = scapLower === 'valvulas' || /valvul/i.test(scapLower);
            if (!isValvula && rawWbs.toLowerCase().includes('p6')) {
              return;
            }
            // Excluir toda actividad que inicie con Procura
            if (a.descripcion && a.descripcion.trim().toLowerCase().startsWith('procura')) {
              return;
            }
            const parsed = parseWbsAndDescription(rawWbs);
            const wbs = normalize(parsed.wbs || rawWbs);
            if (!wbs.startsWith('p.') && !wbs.startsWith('p.D') && !wbs.toLowerCase().startsWith('p.d')) return;
            // Excluir raíz del proyecto (e.g. p0326, p0526, etc.)
            if (/^p\d{4}$/.test(wbs)) return;

            if (!a.esItemHoja) {
              // Partida: agregar una sola vez
              if (!partidasAdded.has(wbs)) {
                partidasAdded.add(wbs);
                const parts = wbs.split('.');
                const chSeg = parts[1];
                const resolvedDesc = parsed.description ||
                  (a.descripcion && !/^partida\s+/i.test(a.descripcion) ? a.descripcion : null) ||
                  wbsDescLookup.get(wbs.toLowerCase()) ||
                  wbsDescLookup.get(wbs.toLowerCase().replace(/^p\d{4}\./, 'p.')) ||
                  (chSeg && DEFAULT_CHAPTER_DESCRIPTIONS[chSeg]) ||
                  a.descripcion || '';

                ganttNodes.push({
                  key: wbs,
                  wbs,
                  parentKey: parts.length > 2 ? parts.slice(0, -1).join('.') : null,
                  actId: null,
                  desc: resolvedDesc,
                  nivel: parts.length,
                  start: null,
                  finish: null,
                  blStart: null,
                  blFinish: null,
                  tf: null,
                  p6: '',
                  tipo: '',
                  esHoja: false
                });
              }
            } else {
              // Eliminar actividades que no tienen total float (campo es null o indefinido)
              if (a.totalFloat === null || a.totalFloat === undefined) return;

              // Excluir actividades con finish 30-abr-2027 (específicamente 08:00 am / fecha fin 30-abr-2027)
              if (isIgnoredFinishDate(a.finish)) return;

              // Hoja: clave única wbs.__actId
              const parentKey = wbs; // partida padre es el wbs normalizado
              const key = `${wbs}.__${a.activityId || a.id}`;
              const leafDesc = a.descripcion || parsed.description || '';
              ganttNodes.push({
                key,
                wbs,
                parentKey,
                actId: a.activityId || null,
                desc: leafDesc,
                nivel: wbs.split('.').length + 1,
                start: isValidDate(a.start) ? a.start : null,
                finish: isValidDate(a.finish) ? a.finish : null,
                blStart: isValidDate(a.blStart) ? a.blStart : null,
                blFinish: isValidDate(a.blFinish) ? a.blFinish : null,
                tf: a.totalFloat,
                p6: a.p6Status || '',
                tipo: a.tipo || '',
                esHoja: true,
                actividadRef: a
              });
            }
          });
        } else {
          // ── Vista 2: Agrupación Jerárquica Componente (Columna AJ) -> Tipo -> SubC -> Scap -> Unit -> Actividad ──
          const componentesAdded = new Set<string>();
          const tiposAdded = new Set<string>();
          const subcsAdded = new Set<string>();
          const scapsAdded = new Set<string>();
          const unitsAdded = new Set<string>();

          actividades.forEach(a => {
            if (!a.esItemHoja) return;
            const rawWbs = a.wbs || '';
            const scapLower = String(a.scap || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            const isValvula = scapLower === 'valvulas' || /valvul/i.test(scapLower);
            if (!isValvula && rawWbs.toLowerCase().includes('p6')) return;
            if (a.descripcion && a.descripcion.trim().toLowerCase().startsWith('procura')) return;
            const wbs = normalize(rawWbs);
            if (!wbs.startsWith('p.') && !wbs.startsWith('p.D') && !wbs.toLowerCase().startsWith('p.d')) return;
            if (/^p\d{4}$/.test(wbs)) return;
            if (a.totalFloat === null || a.totalFloat === undefined) return;
            if (isIgnoredFinishDate(a.finish)) return;

            const compVal = (a.componente || (a as any).comp || '').trim() || 'Sin Componente';
            const tipoVal = (a.tipo || (a as any).tipoG || '').trim() || 'Sin Tipo';
            const subcVal = (a.subcontratista || (a as any).subC || '').trim() || 'Sin SubC';
            const scapVal = (a.scap || '').trim() || 'Sin Scap';
            const unitVal = (a.unit || '').trim() || 'Sin Unit';

            const compKey = `COMP__${compVal}`;
            const tipoKey = `${compKey}__TIPO__${tipoVal}`;
            const subcKey = `${tipoKey}__SUBC__${subcVal}`;
            const scapKey = `${subcKey}__SCAP__${scapVal}`;
            const unitKey = `${scapKey}__UNIT__${unitVal}`;
            const actKey = `${unitKey}__ACT__${a.id || a.activityId}_${a.wbs || ''}`;

            // Nivel 2: Componente (Raíz)
            if (!componentesAdded.has(compKey)) {
              componentesAdded.add(compKey);
              ganttNodes.push({
                key: compKey,
                wbs: 'COMPONENTE',
                parentKey: null,
                actId: null,
                desc: compVal,
                nivel: 2,
                start: null,
                finish: null,
                blStart: null,
                blFinish: null,
                tf: null,
                p6: '',
                tipo: '',
                esHoja: false
              });
            }

            // Nivel 3: Tipo (Hijo de Componente)
            if (!tiposAdded.has(tipoKey)) {
              tiposAdded.add(tipoKey);
              ganttNodes.push({
                key: tipoKey,
                wbs: 'TIPO',
                parentKey: compKey,
                actId: null,
                desc: tipoVal,
                nivel: 3,
                start: null,
                finish: null,
                blStart: null,
                blFinish: null,
                tf: null,
                p6: '',
                tipo: tipoVal,
                esHoja: false
              });
            }

            // Nivel 4: SubC (Hijo de Tipo)
            if (!subcsAdded.has(subcKey)) {
              subcsAdded.add(subcKey);
              ganttNodes.push({
                key: subcKey,
                wbs: 'SUBC',
                parentKey: tipoKey,
                actId: null,
                desc: subcVal,
                nivel: 4,
                start: null,
                finish: null,
                blStart: null,
                blFinish: null,
                tf: null,
                p6: '',
                tipo: tipoVal,
                esHoja: false
              });
            }

            // Nivel 5: Scap (Hijo de SubC)
            if (!scapsAdded.has(scapKey)) {
              scapsAdded.add(scapKey);
              ganttNodes.push({
                key: scapKey,
                wbs: 'SCAP',
                parentKey: subcKey,
                actId: null,
                desc: scapVal,
                nivel: 5,
                start: null,
                finish: null,
                blStart: null,
                blFinish: null,
                tf: null,
                p6: '',
                tipo: tipoVal,
                esHoja: false
              });
            }

            // Nivel 6: Unit (Hijo de Scap)
            if (!unitsAdded.has(unitKey)) {
              unitsAdded.add(unitKey);
              ganttNodes.push({
                key: unitKey,
                wbs: 'UNIT',
                parentKey: scapKey,
                actId: null,
                desc: unitVal,
                nivel: 6,
                start: null,
                finish: null,
                blStart: null,
                blFinish: null,
                tf: null,
                p6: '',
                tipo: tipoVal,
                esHoja: false
              });
            }

            // Nivel 7: Actividad (Hoja)
            ganttNodes.push({
              key: actKey,
              wbs,
              parentKey: unitKey,
              actId: a.activityId || null,
              desc: a.descripcion || '',
              nivel: 7,
              start: isValidDate(a.start) ? a.start : null,
              finish: isValidDate(a.finish) ? a.finish : null,
              blStart: isValidDate(a.blStart) ? a.blStart : null,
              blFinish: isValidDate(a.blFinish) ? a.blFinish : null,
              tf: a.totalFloat,
              p6: a.p6Status || '',
              tipo: a.tipo || '',
              esHoja: true,
              actividadRef: a
            });
          });
        }

        // ── Mapa por key para lookup rápido ──────────────────────────
        const nodeMap = new Map<string, any>(ganttNodes.map(n => [n.key, n]));

        // ── Children Mapping for O(1) lookup ──
        const childrenMap = new Map<string, any[]>();
        ganttNodes.forEach(n => {
          if (n.parentKey) {
            if (!childrenMap.has(n.parentKey)) {
              childrenMap.set(n.parentKey, []);
            }
            childrenMap.get(n.parentKey)!.push(n);
          }
        });

        // ── Cache de fechas para ordenamiento de cualquier nodo (hojas o carpetas) ──
        const nodeSpanMap = new Map<string, { start: Date | null; finish: Date | null }>();
        const getNodeSpan = (key: string): { start: Date | null; finish: Date | null } => {
          if (nodeSpanMap.has(key)) return nodeSpanMap.get(key)!;
          const node = nodeMap.get(key);
          if (!node) return { start: null, finish: null };
          if (node.esHoja) {
            const res = {
              start: isValidDate(node.start) ? node.start : null,
              finish: isValidDate(node.finish) ? node.finish : null
            };
            nodeSpanMap.set(key, res);
            return res;
          }
          const children = childrenMap.get(key) || [];
          let minStart: number | null = null;
          let maxFinish: number | null = null;
          children.forEach(c => {
            const childSpan = getNodeSpan(c.key);
            if (childSpan.start && isValidDate(childSpan.start)) {
              const t = childSpan.start.getTime();
              if (minStart === null || t < minStart) minStart = t;
            }
            if (childSpan.finish && isValidDate(childSpan.finish)) {
              const t = childSpan.finish.getTime();
              if (maxFinish === null || t > maxFinish) maxFinish = t;
            }
          });
          const res = {
            start: minStart !== null ? new Date(minStart) : null,
            finish: maxFinish !== null ? new Date(maxFinish) : null
          };
          nodeSpanMap.set(key, res);
          return res;
        };

        const compareByDate = (a: any, b: any): number => {
          if (!ganttSortField) return 0;
          const spanA = getNodeSpan(a.key);
          const spanB = getNodeSpan(b.key);
          const dateA = ganttSortField === 'start' ? spanA.start : spanA.finish;
          const dateB = ganttSortField === 'start' ? spanB.start : spanB.finish;
          const timeA = dateA && isValidDate(dateA) ? dateA.getTime() : null;
          const timeB = dateB && isValidDate(dateB) ? dateB.getTime() : null;

          if (timeA !== null && timeB !== null) {
            if (timeA !== timeB) {
              return ganttSortOrder === 'asc' ? timeA - timeB : timeB - timeA;
            }
          } else if (timeA !== null) {
            return -1;
          } else if (timeB !== null) {
            return 1;
          }
          return 0;
        };

        // ── Raíces: nivel 2 (p.1..p.17 en WBS, o Tipos en Vista 2), no hojas ──────────────
        const ganttRoots = ganttNodes
          .filter(n => n.nivel === 2 && !n.esHoja)
          .sort((a, b) => {
            if (ganttSortField) {
              const dateDiff = compareByDate(a, b);
              if (dateDiff !== 0) return dateDiff;
            }
            if (ganttHierarchyMode === 'tipo_subc_scap_unit') {
              return (a.desc || '').localeCompare(b.desc || '');
            }
            return compareWbs(a.wbs, b.wbs);
          });

        const childrenOf = (key: string) => {
          const list = childrenMap.get(key) || [];
          if (ganttHierarchyMode === 'tipo_subc_scap_unit') {
            return list.slice().sort((a, b) => {
              if (!a.esHoja && b.esHoja) return -1;
              if (a.esHoja && !b.esHoja) return 1;
              if (ganttSortField) {
                const dateDiff = compareByDate(a, b);
                if (dateDiff !== 0) return dateDiff;
              }
              if (a.esHoja && b.esHoja) {
                if (a.start && b.start) {
                  const diff = a.start.getTime() - b.start.getTime();
                  if (diff !== 0) return diff;
                }
                return (a.actId || a.desc || '').localeCompare(b.actId || b.desc || '');
              }
              return (a.desc || '').localeCompare(b.desc || '');
            });
          }
          return list.slice().sort((a, b) => {
            if (!a.esHoja && b.esHoja) return -1;
            if (a.esHoja && !b.esHoja) return 1;
            if (ganttSortField) {
              const dateDiff = compareByDate(a, b);
              if (dateDiff !== 0) return dateDiff;
            }
            return compareWbs(a.wbs, b.wbs);
          });
        };

        // ── Rango del proyecto ────────────────────────────────────────
        const today = new Date();
        const datesList: number[] = [];
        ganttNodes.forEach(n => {
          if (isValidDate(n.start)) datesList.push(n.start.getTime());
          if (isValidDate(n.finish)) datesList.push(n.finish.getTime());
          if (isValidDate(n.blStart)) datesList.push(n.blStart.getTime());
          if (isValidDate(n.blFinish)) datesList.push(n.blFinish.getTime());
        });
        if (isValidDate(today)) datesList.push(today.getTime());
        if (isValidDate(fechaCorteState)) datesList.push(fechaCorteState.getTime());

        if (!datesList.length) {
          return (
            <div className="bg-white rounded-2xl shadow-sm border border-indigo-600 p-8 text-center text-xs text-slate-400 font-medium">
              No hay actividades de cronograma con fechas válidas.
            </div>
          );
        }

        const minDateRaw = new Date(Math.min(...datesList));
        const maxDateRaw = new Date(Math.max(...datesList));

        let ganttMinDate: Date;
        let ganttMaxDate: Date;
        const timeCols: any[] = [];

        if (ganttZoom === 'month') {
          ganttMinDate = new Date(minDateRaw.getFullYear(), minDateRaw.getMonth(), 1);
          ganttMaxDate = new Date(maxDateRaw.getFullYear(), maxDateRaw.getMonth() + 1, 1);

          const cur = new Date(ganttMinDate);
          while (cur < ganttMaxDate) {
            timeCols.push({
              date: new Date(cur),
              label: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][cur.getMonth()] + ' ' + String(cur.getFullYear()).slice(2)
            });
            cur.setMonth(cur.getMonth() + 1);
          }
        } else {
          // Trimestral (Q1=Ene-Mar, Q2=Abr-Jun, Q3=Jul-Sep, Q4=Oct-Dic)
          const qStartMonth = Math.floor(minDateRaw.getMonth() / 3) * 3;
          ganttMinDate = new Date(minDateRaw.getFullYear(), qStartMonth, 1);

          const maxQEndMonth = (Math.floor(maxDateRaw.getMonth() / 3) + 1) * 3;
          ganttMaxDate = new Date(maxDateRaw.getFullYear(), maxQEndMonth, 1);

          const cur = new Date(ganttMinDate);
          while (cur < ganttMaxDate) {
            const qIndex = Math.floor(cur.getMonth() / 3) + 1;
            const lbl = `Q${qIndex} ${cur.getFullYear()}`;
            timeCols.push({
              date: new Date(cur),
              label: lbl,
              qMonthStart: cur.getMonth()
            });
            cur.setMonth(cur.getMonth() + 3);
          }
        }

        const TOTAL_W = timeCols.length * COL_W;
        const dateToX = (d: Date | null) => {
          if (!isValidDate(d)) return -1;
          const t = d.getTime();
          const startT = ganttMinDate.getTime();
          const endT = ganttMaxDate.getTime();
          if (endT <= startT) return -1;
          const ratio = (t - startT) / (endT - startT);
          return Math.max(0, Math.min(ratio * TOTAL_W, TOTAL_W));
        };
        const todayX = dateToX(today);
        const fechaCorteX = dateToX(fechaCorteState);

        // ── Colores por status ────────────────────────────────────────
        const statusColor = (s: string) => ({ 'Completed': '#16a34a', 'In Progress': '#2563eb', 'Not Started': '#6b7280' }[s] || '#ea580c');
        const statusBg = (s: string) => ({ 'Completed': 'bg-green-100 text-green-800', 'In Progress': 'bg-blue-100 text-blue-800', 'Not Started': 'bg-gray-100 text-gray-500' }[s] || 'bg-orange-100 text-orange-700');
        const statusLbl = (s: string) => ({ 'Completed': 'Completado', 'In Progress': 'En Curso', 'Not Started': 'No inic.' }[s] || s || '—');

        // ── Filtro ────────────────────────────────────────────────────
        const qg = ganttSearch.toLowerCase().trim();
        const passFilter = (n: any) => {
          // KPI Selected filters
          if (kpiSelected && n.esHoja) {
            const descLower = n.desc?.trim().toLowerCase() || '';
            if (descLower.startsWith('procura')) return false;

            const rawWbs = n.wbs || '';
            const wbs = rawWbs.replace(/^p\d{4}\./, 'p.');
            if (wbs.startsWith('p.D')) return false;

            const act = n.actividadRef;
            if (!act) return false;

            let match = false;
            if (kpiSelected === 'atrasados') {
              match = !!act.estaAtrasadoCronograma;
            } else if (kpiSelected === 'acTotal') {
              match = true;
            } else if (kpiSelected === 'acCompletadas') {
              const p = (act.p6Status || act.status || act.p6 || '').toLowerCase();
              match = p === 'completed' || p.includes('complet') || p.includes('finaliz');
            } else if (kpiSelected === 'acEnCurso') {
              const p = (act.p6Status || act.status || act.p6 || '').toLowerCase();
              match = p === 'in progress' || p.includes('progress') || p.includes('progreso') || p.includes('curso');
            } else if (kpiSelected === 'acNoIniciadas') {
              const p = (act.p6Status || act.status || act.p6 || '').toLowerCase();
              match = p === 'not started' || p.includes('not start') || p.includes('no inic') || p.includes('no-inic');
            } else if (kpiSelected === 'acCriticas') {
              if (act.totalFloat === null || act.totalFloat === undefined || isNaN(Number(act.totalFloat))) match = false;
              else {
                const val = Number(act.totalFloat);
                match = hasNegativeGlobalFloat ? val === globalMinFloat : val === 0;
              }
            } else if (kpiSelected === 'acSubcriticas') {
              if (act.totalFloat === null || act.totalFloat === undefined || isNaN(Number(act.totalFloat))) match = false;
              else {
                const val = Number(act.totalFloat);
                match = hasNegativeGlobalFloat ? (val > globalMinFloat && val < 0) : false;
              }
            } else if (kpiSelected === 'acRiesgosas') {
              if (act.totalFloat === null || act.totalFloat === undefined || isNaN(Number(act.totalFloat))) match = false;
              else {
                const val = Number(act.totalFloat);
                match = val >= 0 && val <= 20;
              }
            } else if (kpiSelected === 'criticos') {
              match = act.diasAtrasoMaximo > 30;
            }
            if (!match) return false;
          }

          // Status
          if (ganttStatus !== 'all' && n.esHoja) {
            const rawP = (n.actividadRef?.p6Status || n.p6 || n.actividadRef?.status || '').trim().toLowerCase();
            let cat = 'other';
            if (rawP === 'completed' || rawP.includes('complet') || rawP.includes('finaliz')) cat = 'completed';
            else if (rawP === 'in progress' || rawP.includes('progress') || rawP.includes('progreso') || rawP.includes('curso')) cat = 'in progress';
            else if (rawP === 'not started' || rawP.includes('not start') || rawP.includes('no inic') || rawP.includes('no-inic')) cat = 'not started';

            const allowedStatuses = ganttStatus.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
            const matchKnown = allowedStatuses.includes(cat) || allowedStatuses.includes(rawP);
            const matchOther = allowedStatuses.includes('__other__') && cat === 'other';
            if (!matchKnown && !matchOther) return false;
          }
          // P.Ac
          if (ganttPAc !== 'all' && n.esHoja) {
            if (ganttPAc === '__none__') return false;
            const allowedPAcs = ganttPAc.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
            const rawPAc = (n.actividadRef?.pAc || n.pAc || '').trim().toLowerCase();
            const normalizedItemPAc = rawPAc || '(sin p.ac)';
            const matches = allowedPAcs.some(p => {
              if (p === '(sin p.ac)' || p === 'sin p.ac' || p === 'sin p_ac' || p === 'vacio' || p === '(vacio)' || p === 'sin pac') {
                return !rawPAc || normalizedItemPAc === '(sin p.ac)';
              }
              return rawPAc === p || normalizedItemPAc === p;
            });
            if (!matches) return false;
          }
          // Tipología
          if (ganttTipo !== 'all' && n.esHoja) {
            const allowedTipos = ganttTipo.split(',');
            if (!allowedTipos.includes(n.tipo)) return false;
          }
          // Search string
          if (qg) {
            if (searchFieldType === 'descripcion') {
              if (!n.desc?.toLowerCase().includes(qg) && !n.actId?.toLowerCase().includes(qg) && !n.wbs?.toLowerCase().includes(qg)) {
                return false;
              }
            } else if (searchFieldType === 'cap') {
              const capValue = n.actividadRef?.cap?.toLowerCase() || '';
              if (!capValue.includes(qg)) return false;
            } else if (searchFieldType === 'scap') {
              const scapValue = n.actividadRef?.scap?.toLowerCase() || '';
              if (!scapValue.includes(qg)) return false;
            } else if (searchFieldType === 'subcontratista') {
              const subcValue = n.actividadRef?.subcontratista?.toLowerCase() || '';
              if (!subcValue.includes(qg)) return false;
            } else if (searchFieldType === 'pac') {
              const pacValue = (n.actividadRef?.pAc || n.pAc || '').toLowerCase();
              if (!pacValue.includes(qg)) return false;
            }
          }
          // Float values
          if (ganttFloat !== 'all' && n.esHoja) {
            const tf = n.tf;
            const allowedFloats = ganttFloat.split(',').map(s => s.trim()).filter(Boolean);
            const matchesAny = allowedFloats.some(fVal => {
              if (fVal === 'atrasados') {
                return !!n.actividadRef?.estaAtrasadoCronograma;
              } else if (fVal === 'criticos') {
                return !!(n.actividadRef && n.actividadRef.diasAtrasoMaximo > 30);
              } else if (fVal === 'criticas' || fVal === '0') {
                if (tf === null || tf === undefined || isNaN(Number(tf))) return false;
                const val = Number(tf);
                return hasNegativeGlobalFloat ? val === globalMinFloat : val === 0;
              } else if (fVal === 'subcriticas' || fVal === 'negativos') {
                if (tf === null || tf === undefined || isNaN(Number(tf))) return false;
                const val = Number(tf);
                return hasNegativeGlobalFloat ? (val > globalMinFloat && val < 0) : false;
              } else if (fVal === 'riesgosas' || fVal === 'lte20' || fVal === 'lte20sub' || fVal === 'lte40sub') {
                if (tf === null || tf === undefined || isNaN(Number(tf))) return false;
                const val = Number(tf);
                return val >= 0 && val <= 20;
              } else if (fVal === 'lte10') {
                return tf !== null && tf >= 0 && tf <= 10;
              } else if (fVal === 'lte50' || fVal === 'lte45') {
                return tf !== null && tf <= 50;
              } else if (fVal === 'gt50') {
                return tf !== null && tf > 50;
              } else if (fVal === 'sd') {
                return tf === null || tf === undefined;
              }
              return false;
            });
            if (!matchesAny) return false;
          }

          // Root filter
          if (appliedSelectedRoots.size > 0) {
            let rootKey: string | null = null;
            let tempKey = n.key;
            while (tempKey) {
              const nodeObj = nodeMap.get(tempKey);
              if (!nodeObj) break;
              if (nodeObj.nivel === 2) {
                rootKey = tempKey;
                break;
              }
              tempKey = nodeObj.parentKey;
            }
            if (!rootKey || !appliedSelectedRoots.has(rootKey)) {
              return false;
            }
          }

          // BL Inicio Excel-style filter
          if (blStartFilterActive && n.esHoja) {
            const key = isValidDate(n.blStart)
              ? `${n.blStart.getFullYear()}-${String(n.blStart.getMonth() + 1).padStart(2, '0')}-${String(n.blStart.getDate()).padStart(2, '0')}`
              : "null";
            if (!blStartSelectedDays.has(key)) return false;
          }

          // BL Fin Excel-style filter
          if (blFinishFilterActive && n.esHoja) {
            const key = isValidDate(n.blFinish)
              ? `${n.blFinish.getFullYear()}-${String(n.blFinish.getMonth() + 1).padStart(2, '0')}-${String(n.blFinish.getDate()).padStart(2, '0')}`
              : "null";
            if (!blFinishSelectedDays.has(key)) return false;
          }

          // Filtro Inteligente de Fechas (overlaps with period)
          if (smartFilterActive && n.esHoja) {
            if (!n.blStart || !isValidDate(n.blStart) || !n.blFinish || !isValidDate(n.blFinish)) {
              return false;
            }
            const sTime = new Date(smartFilterStart + 'T00:00:00');
            const eTime = new Date(smartFilterEnd + 'T23:59:59');
            if (!isNaN(sTime.getTime()) && !isNaN(eTime.getTime())) {
              const startVal = n.blStart.getTime();
              const finishVal = n.blFinish.getTime();
              
              const overlaps = (startVal <= eTime.getTime()) && (finishVal >= sTime.getTime());
              if (!overlaps) return false;
            }
          }

          // Filtro Procura / Flete / Montaje / Construcción
          if ((isGanttMontajeFilter || isGanttProcuraFilter || isGanttFleteFilter || isGanttConstruccionFilter) && n.esHoja) {
            const cleanName = (n.desc || n.actividadRef?.descripcion || (n.actividadRef as any)?.activityName || '').trim().replace(/^["'«\s\-\.]*/, '');
            const isM = /^inst/i.test(cleanName);
            const isP = /^compr/i.test(cleanName);
            const isF = /^flete/i.test(cleanName);
            const isC = !isM && !isP && !isF;

            const matchesMontaje = isGanttMontajeFilter && isM;
            const matchesProcura = isGanttProcuraFilter && isP;
            const matchesFlete = isGanttFleteFilter && isF;
            const matchesConstruccion = isGanttConstruccionFilter && isC;

            if (!matchesMontaje && !matchesProcura && !matchesFlete && !matchesConstruccion) return false;
          }

          return true;
        };

        // ── Set de nodos visibles: hojas que pasan + todos sus ancestros ──
        const visibleKeys = (() => {
          const s = new Set<string>();
          ganttNodes.forEach(n => {
            if (!n.esHoja) return;
            if (!passFilter(n)) return;
            // Agregar la hoja
            s.add(n.key);
            // Agregar todos sus ancestros dinámicamente usando nodeMap
            let cur = n.parentKey;
            while (cur) {
              s.add(cur);
              const parentNode = nodeMap.get(cur);
              cur = parentNode ? parentNode.parentKey : null;
            }
          });
          return s;
        })();

        // ── Cuenta de actividades visibles por partida (recursivo o memoizado) ──
        const visibleCountMap = new Map<string, number>();
        const calcVisibleCount = (key: string): number => {
          if (visibleCountMap.has(key)) return visibleCountMap.get(key)!;
          const node = nodeMap.get(key);
          if (!node) return 0;
          if (node.esHoja) {
            const count = visibleKeys.has(key) ? 1 : 0;
            visibleCountMap.set(key, count);
            return count;
          }
          let sum = 0;
          const children = childrenOf(key);
          children.forEach(c => {
            sum += calcVisibleCount(c.key);
          });
          visibleCountMap.set(key, sum);
          return sum;
        };

        // ── Span de fechas dinámico de un nodo (recursivo sobre hijos visibles con caché) ────
        const spanCacheMap = new Map<string, { start: Date | null, finish: Date | null }>();
        const calcSpan = (key: string): { start: Date | null, finish: Date | null } => {
          if (spanCacheMap.has(key)) return spanCacheMap.get(key)!;
          const node = nodeMap.get(key);
          if (!node) return { start: null, finish: null };
          
          if (node.esHoja) {
            const res = { start: node.start, finish: node.finish };
            spanCacheMap.set(key, res);
            return res;
          }

          let minTime: number | null = null;
          let maxTime: number | null = null;
          
          const children = childrenOf(key);
          children.forEach(c => {
            const hasVisibleChildren = calcVisibleCount(c.key) > 0;
            if (hasVisibleChildren) {
              const childSpan = calcSpan(c.key);
              if (childSpan.start && isValidDate(childSpan.start)) {
                const t = childSpan.start.getTime();
                if (minTime === null || t < minTime) minTime = t;
              }
              if (childSpan.finish && isValidDate(childSpan.finish)) {
                const t = childSpan.finish.getTime();
                if (maxTime === null || t > maxTime) maxTime = t;
              }
            }
          });

          const res = {
            start: minTime !== null ? new Date(minTime) : null,
            finish: maxTime !== null ? new Date(maxTime) : null
          };
          spanCacheMap.set(key, res);
          return res;
        };

        // ── Baseline Span de fechas dinámico de un nodo (recursivo sobre hijos visibles con caché) ────
        const blSpanCacheMap = new Map<string, { blStart: Date | null, blFinish: Date | null }>();
        const calcBlSpan = (key: string): { blStart: Date | null, blFinish: Date | null } => {
          if (blSpanCacheMap.has(key)) return blSpanCacheMap.get(key)!;
          const node = nodeMap.get(key);
          if (!node) return { blStart: null, blFinish: null };
          
          if (node.esHoja) {
            const res = { blStart: node.blStart, blFinish: node.blFinish };
            blSpanCacheMap.set(key, res);
            return res;
          }

          let minTime: number | null = null;
          let maxTime: number | null = null;
          
          const children = childrenOf(key);
          children.forEach(c => {
            const hasVisibleChildren = calcVisibleCount(c.key) > 0;
            if (hasVisibleChildren) {
              const childBlSpan = calcBlSpan(c.key);
              if (childBlSpan.blStart && isValidDate(childBlSpan.blStart)) {
                const t = childBlSpan.blStart.getTime();
                if (minTime === null || t < minTime) minTime = t;
              }
              if (childBlSpan.blFinish && isValidDate(childBlSpan.blFinish)) {
                const t = childBlSpan.blFinish.getTime();
                if (maxTime === null || t > maxTime) maxTime = t;
              }
            }
          });

          const res = {
            blStart: minTime !== null ? new Date(minTime) : null,
            blFinish: maxTime !== null ? new Date(maxTime) : null
          };
          blSpanCacheMap.set(key, res);
          return res;
        };

        // ── Total Float mínimo dinámico según jerarquía (recursivo sobre hijos visibles con caché) ────
        const minTfCacheMap = new Map<string, number | null>();
        const calcMinTf = (key: string): number | null => {
          if (minTfCacheMap.has(key)) return minTfCacheMap.get(key)!;
          const node = nodeMap.get(key);
          if (!node) return null;

          if (node.esHoja) {
            const rawVal = node.tf;
            const res = (rawVal !== null && rawVal !== undefined && !isNaN(Number(rawVal))) ? Number(rawVal) : null;
            minTfCacheMap.set(key, res);
            return res;
          }

          let minVal: number | null = null;
          const children = childrenOf(key);
          children.forEach(c => {
            const hasVisibleChildren = calcVisibleCount(c.key) > 0;
            if (hasVisibleChildren) {
              const childTf = calcMinTf(c.key);
              if (childTf !== null && !isNaN(childTf)) {
                if (minVal === null || childTf < minVal) {
                  minVal = childTf;
                }
              }
            }
          });

          minTfCacheMap.set(key, minVal);
          return minVal;
        };

        // ── Render de un nodo (fila tabla + barra) ───────────────────
        const tableRows: React.ReactNode[] = [];
        const barRows: React.ReactNode[] = [];

        const renderNode = (node: any, depth: number) => {
          if (!visibleKeys.has(node.key)) return;

          const toggleRoot = (key: string, isMulti: boolean) => {
            const actualMulti = isMulti || multiSelEnabled;
            let nextSet: Set<string>;
            if (actualMulti) {
              const copy = new Set<string>(selectedRoots);
              if (copy.has(key)) {
                copy.delete(key);
              } else {
                copy.add(key);
              }
              nextSet = copy;
            } else {
              const copy = new Set<string>();
              if (selectedRoots.has(key) && selectedRoots.size === 1) {
                // toggle off if already selected exclusively
              } else {
                copy.add(key);
              }
              nextSet = copy;
            }
            setSelectedRoots(nextSet);
            setAppliedSelectedRoots(nextSet);
          };

          const isExp = ganttExp.has(node.key);
          const children = childrenOf(node.key).filter(c => visibleKeys.has(c.key));
          const hasChildren = children.length > 0;

          const span = node.esHoja
            ? { start: node.start, finish: node.finish }
            : calcSpan(node.key);

          const blSpan = node.esHoja
            ? { blStart: node.blStart, blFinish: node.blFinish }
            : calcBlSpan(node.key);

          const dur = isValidDate(span.start) && isValidDate(span.finish)
            ? Math.round((span.finish.getTime() - span.start.getTime()) / 86400000) : 0;

          const isRoot = node.nivel === 2;
          
          // Hierarchical coloring schema for parenting levels to distinguish them clearly
          const rowBg = node.esHoja ? 'bg-white'
            : node.nivel === 2 ? 'bg-[#FDF3F3] font-bold border-l-4 border-l-[#CD0000]'
            : node.nivel === 3 ? 'bg-emerald-50/70 font-semibold border-l-4 border-l-emerald-500'
            : node.nivel === 4 ? 'bg-purple-50/60 font-semibold border-l-4 border-l-purple-500'
            : node.nivel === 5 ? 'bg-amber-50/60 font-medium border-l-4 border-l-amber-500'
            : node.nivel === 6 ? 'bg-blue-50/50 border-l-4 border-l-blue-400'
            : 'bg-cyan-50/50 border-l-4 border-l-cyan-405';

          const textCls = node.esHoja ? 'text-gray-700 font-medium'
            : node.nivel === 2 ? 'font-black text-[#6B0505] text-[11px]'
            : node.nivel === 3 ? 'font-bold text-emerald-900 text-[10.5px]'
            : node.nivel === 4 ? 'font-semibold text-purple-900 text-[10px]'
            : node.nivel === 5 ? 'font-semibold text-amber-900 text-[10px]'
            : node.nivel === 6 ? 'font-medium text-blue-900 text-[10px]'
            : 'font-medium text-cyan-900 text-[10px]';

          let barH = node.esHoja ? 13 : isRoot ? 8 : 6;
          let barTop = (ROW_H - barH) / 2;

          const blX1 = dateToX(blSpan.blStart);
          const blX2 = dateToX(blSpan.blFinish);
          const blBarW = blX1 >= 0 && blX2 > blX1 ? Math.max(blX2 - blX1, 2) : 0;

          let blBarH = 0;
          let blBarTop = 0;

          if (blBarW > 0) {
            if (node.esHoja) {
              barH = 10;
              barTop = 3;
              blBarH = 6;
              blBarTop = 15;
            } else {
              barH = 6;
              barTop = 4;
              blBarH = 4;
              blBarTop = 15;
            }
          }

          const barColor = node.esHoja ? statusColor(node.p6)
            : node.nivel === 2 ? '#CD0000' // Rojo de la marca
            : node.nivel === 3 ? '#059669' // Emerald 600
            : node.nivel === 4 ? '#7c3aed' // Purple 600
            : node.nivel === 5 ? '#d97706' // Amber 600
            : node.nivel === 6 ? '#2563eb' // Blue 600
            : '#0891b2'; // Cyan 600
          const barOpacity = node.esHoja ? 1 : 0.6;

          const wbsCls = node.esHoja 
            ? 'bg-slate-50 text-slate-650 border-slate-200 font-medium'
            : node.nivel === 2 ? 'bg-[#FBE5E5] text-[#8A0000] border-[#EFA3A3]'
            : node.nivel === 3 ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
            : node.nivel === 4 ? 'bg-purple-100 text-purple-800 border-purple-250'
            : node.nivel === 5 ? 'bg-amber-100 text-amber-800 border-amber-250'
            : node.nivel === 6 ? 'bg-blue-100 text-blue-800 border-blue-200'
            : 'bg-cyan-100 text-cyan-800 border-cyan-200';

          const x1 = dateToX(span.start);
          const x2 = dateToX(span.finish);
          const barW = x1 >= 0 && x2 > x1 ? Math.max(x2 - x1, 2) : 0;

          const indentW = depth * 2;

          tableRows.push(
            <div key={`t-${node.key}`}
              onClick={isRoot ? (e) => {
                const target = e.target as HTMLElement;
                if (target.closest('button')) return;
                const isMulti = e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.nativeEvent?.ctrlKey || e.nativeEvent?.metaKey || e.nativeEvent?.shiftKey;
                toggleRoot(node.key, isMulti);
              } : undefined}
              onContextMenu={isRoot ? (e) => {
                const isMulti = e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.nativeEvent?.ctrlKey || e.nativeEvent?.metaKey || e.nativeEvent?.shiftKey;
                if (isMulti) {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleRoot(node.key, true);
                }
              } : undefined}
              className={`flex border-b border-gray-100 hover:bg-amber-50 ${rowBg} ${isRoot ? 'cursor-pointer select-none' : ''} flex-shrink-0 text-[10px] items-center`}
              style={{ height: ROW_H }}>
              <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 16 + indentW }}>
                {!node.esHoja && hasChildren &&
                  <button onClick={(e) => {
                    e.stopPropagation();
                    const n = new Set(ganttExp);
                    if (n.has(node.key)) n.delete(node.key);
                    else n.add(node.key);
                    setGanttExp(n);
                  }}
                    className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-blue-600 transition-colors font-bold">
                    {isExp
                      ? <ChevronDown className="w-3 h-3" />
                      : <ChevronRight className="w-3 h-3" />}
                  </button>}
              </div>
              <div className="flex-shrink-0 flex items-center px-1" style={{ width: 92 }}>
                <span className={`font-mono text-[8.5px] px-1.5 py-0.5 rounded-lg border truncate max-w-full font-bold ${wbsCls}`}
                  title={node.actId || node.wbs}>
                  {node.actId ? node.actId : node.wbs}
                </span>
              </div>
              <div className={`flex-1 flex items-center gap-1.5 px-1 truncate min-w-0 ${textCls}`} title={node.desc}>
                <span className="truncate">{node.desc}</span>
                {(() => {
                  if (!node.esHoja) return null;
                  const rowTf = calcMinTf(node.key);
                  if (rowTf === null || rowTf === undefined) return null;
                  const isRc = hasNegativeGlobalFloat ? rowTf === globalMinFloat : rowTf === 0;
                  const isSubc = hasNegativeGlobalFloat && (rowTf > globalMinFloat && rowTf < 0);
                  if (isRc) {
                    return (
                      <span className="px-1 py-0.2 rounded text-[7px] font-black bg-red-100 text-red-700 border border-red-300 shrink-0 uppercase tracking-tighter" title={`Ruta Crítica (Float mínimo: ${rowTf}d)`}>
                        RC
                      </span>
                    );
                  }
                  if (isSubc) {
                    return (
                      <span className="px-1 py-0.2 rounded text-[7px] font-black bg-orange-100 text-orange-700 border border-orange-300 shrink-0 uppercase tracking-tighter" title={`Subcrítica / Critical (Float: ${rowTf}d)`}>
                        Subcrítica
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
              <div className="flex-shrink-0 flex items-center justify-end px-1 font-mono text-[9px] text-slate-700 font-semibold truncate" style={{ width: 68 }} title={
                node.esHoja ? (() => {
                  const act = node.actividadRef || a_find_or_mock(node.key);
                  const cant = act?.cantidadCdo;
                  const u = act?.unidad || act?.unit || '';
                  return cant !== undefined && cant !== null ? `${cant.toLocaleString('es-ES')}${u ? ' ' + u : ''}`.trim() : '—';
                })() : undefined
              }>
                {node.esHoja ? (
                  (() => {
                    const act = node.actividadRef || a_find_or_mock(node.key);
                    const cant = act?.cantidadCdo;
                    const u = act?.unidad || act?.unit || '';
                    if (cant !== undefined && cant !== null) {
                      return `${cant.toLocaleString('es-ES')}${u ? ' ' + u : ''}`.trim();
                    }
                    return '—';
                  })()
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </div>
              <div className="flex-shrink-0 flex items-center justify-center px-1 font-mono text-[9px]" style={{ width: 54 }}>
                {node.esHoja ? (
                  <span className="text-slate-400">1</span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-bold">
                    {calcVisibleCount(node.key)}
                  </span>
                )}
              </div>
              <div className="flex-shrink-0 flex items-center justify-center px-1 font-bold" style={{ width: 72 }}>
                {node.nivel === 2 ? (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const isMulti = e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.nativeEvent?.ctrlKey || e.nativeEvent?.metaKey || e.nativeEvent?.shiftKey;
                      toggleRoot(node.key, isMulti);
                    }}
                    onContextMenu={(e) => {
                      const isMulti = e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.nativeEvent?.ctrlKey || e.nativeEvent?.metaKey || e.nativeEvent?.shiftKey;
                      if (isMulti) {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleRoot(node.key, true);
                      }
                    }}
                    className={`w-4 h-4 flex items-center justify-center rounded border cursor-pointer select-none shadow-mini transition-all ${
                      selectedRoots.has(node.key)
                        ? "border-indigo-600 bg-indigo-600 text-white shadow-[0_0_4px_rgba(79,70,229,0.4)]"
                        : "border-slate-300 bg-white hover:border-indigo-400"
                    }`}
                    title={
                      multiSelEnabled
                        ? `Filtrar por la partida general: ${node.desc} (Modo Multi-Selección activo)`
                        : `Filtrar solo por la partida general: ${node.desc}\n(Mantén presionado Ctrl o Cmd o activa Multi-Sel. para selección múltiple)`
                    }
                  >
                    {selectedRoots.has(node.key) && (
                      <svg className="w-2.5 h-2.5 fill-current text-white stroke-white stroke-[2]" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                      </svg>
                    )}
                  </div>
                ) : node.p6 ? (
                  <span className={`text-[8.5px] px-2 py-0.5 rounded-full inline-block scale-90 border font-bold ${statusBg(node.p6)}`}>
                    {statusLbl(node.p6)}
                  </span>
                ) : null}
              </div>
              <div className="flex-shrink-0 flex items-center px-1 text-gray-450 text-[9px] font-mono" style={{ width: 62 }}>{fmtShort(span.start)}</div>
              <div className="flex-shrink-0 flex items-center px-1 text-gray-455 text-[9px] font-mono" style={{ width: 62 }}>{fmtShort(span.finish)}</div>
              <div className="flex-shrink-0 flex items-center px-1 text-gray-450 text-[9px] font-mono" style={{ width: 62 }}>{fmtShort(blSpan.blStart)}</div>
              <div className="flex-shrink-0 flex items-center px-1 text-gray-455 text-[9px] font-mono" style={{ width: 62 }}>{fmtShort(blSpan.blFinish)}</div>
              {(() => {
                const rowTf = calcMinTf(node.key);
                const isRc = node.esHoja && rowTf !== null && (hasNegativeGlobalFloat ? rowTf === globalMinFloat : rowTf === 0);
                const isSubc = node.esHoja && rowTf !== null && hasNegativeGlobalFloat && (rowTf > globalMinFloat && rowTf < 0);
                const isRiesg = node.esHoja && rowTf !== null && (rowTf >= 0 && rowTf <= 20);
                return (
                  <div 
                    className={`flex-shrink-0 flex items-center justify-end px-1 font-mono text-[9px] ${
                      rowTf === null || rowTf === undefined
                        ? 'text-slate-300'
                        : isRc
                          ? 'text-red-700 bg-red-100/90 px-1 rounded font-black border border-red-300 shadow-xs'
                          : isSubc
                            ? 'text-orange-700 bg-orange-100/80 px-1 rounded font-black border border-orange-250'
                            : isRiesg
                              ? 'text-amber-800 bg-amber-50 px-1 rounded font-bold border border-amber-200'
                              : rowTf < 0
                                ? 'text-rose-600 font-black'
                                : !node.esHoja
                                  ? 'text-slate-800 font-extrabold'
                                  : 'text-slate-600 font-bold'
                    }`} 
                    style={{ minWidth: 32 }}
                    title={
                      rowTf !== null && rowTf !== undefined
                        ? !node.esHoja
                          ? `Total Float mín. (Jerarquía): ${rowTf}d`
                          : isRc
                            ? `Ruta Crítica (TF: ${rowTf}d - Float más bajo)`
                            : isSubc
                              ? `Subcrítica / Critical (TF: ${rowTf}d - Float negativo)`
                              : isRiesg
                                ? `Riesgosa (TF: ${rowTf}d - Float entre 0 y 20)`
                                : `Total Float: ${rowTf}d`
                        : undefined
                    }
                  >
                    {rowTf !== null && rowTf !== undefined ? `${rowTf}d` : ''}
                  </div>
                );
              })()}
            </div>
          );

          // Gantt grid correlative background color based on hierarchy depth
          const ganttRowBg = node.esHoja ? '#FFFFFF'
            : node.nivel === 2 ? '#FDF3F3'
            : node.nivel === 3 ? '#ECFDF5'
            : node.nivel === 4 ? '#F3E8FF'
            : node.nivel === 5 ? '#FEF3C7'
            : node.nivel === 6 ? '#EFF6FF'
            : '#ECFEFF';

          const rowTfVal = calcMinTf(node.key);
          const isRc = node.esHoja && rowTfVal !== null && (hasNegativeGlobalFloat ? rowTfVal === globalMinFloat : rowTfVal === 0);
          const isSubc = node.esHoja && rowTfVal !== null && hasNegativeGlobalFloat && (rowTfVal > globalMinFloat && rowTfVal < 0);
          const isRiesg = node.esHoja && rowTfVal !== null && (rowTfVal >= 0 && rowTfVal <= 20);

          barRows.push(
            <div key={`b-${node.key}`}
              style={{
                height: ROW_H,
                background: ganttRowBg,
                position: 'relative',
                borderBottom: '1px solid #F3F4F6',
                flexShrink: 0
              }}>
              {barW > 0 && (
                <div style={{
                  position: 'absolute',
                  left: x1,
                  width: barW,
                  top: barTop,
                  height: barH,
                  background: barColor,
                  borderRadius: barH / 2,
                  opacity: barOpacity,
                  border: isRc ? '2px solid #dc2626' : isSubc ? '1.5px solid #ea580c' : isRiesg ? '1px solid #d97706' : 'none',
                  boxShadow: isRc ? '0 0 6px rgba(220, 38, 38, 0.6)' : isSubc ? '0 0 4px rgba(234, 88, 12, 0.4)' : node.esHoja ? '0 1px 2px rgba(0,0,0,0.15)' : 'none'
                }}
                  className="flex items-center justify-end pr-1"
                  title={`${node.desc}\n${fmtShort(span.start)} → ${fmtShort(span.finish)}\n${node.esHoja ? `TF: ${rowTfVal !== null ? `${rowTfVal}d` : '—'} ${isRc ? '• [RUTA CRÍTICA]' : isSubc ? '• [SUBCRÍTICA]' : isRiesg ? '• [RIESGOSA]' : ''}` : `TF mín (jerarquía): ${rowTfVal !== null ? `${rowTfVal}d` : '—'}`}`}>
                  {node.esHoja && barW > 36 && (node.p6 === 'In Progress' || node.p6 === 'Completed') && (
                    <span className="text-[7.5px] font-black text-white px-1 uppercase leading-none truncate select-none pointer-events-none">
                      {Math.round((node.actividadRef || a_find_or_mock(node.key)).avanceAT ?? 0)}%
                    </span>
                  )}
                </div>
              )}
              {blBarW > 0 && (
                <div style={{
                  position: 'absolute',
                  left: blX1,
                  width: blBarW,
                  top: blBarTop,
                  height: blBarH,
                  background: '#eab308', // Beautiful gold/yellow for baseline/control
                  borderRadius: blBarH / 2,
                  opacity: node.esHoja ? 0.9 : 0.6,
                  boxShadow: node.esHoja ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  border: node.esHoja ? '1px solid #ca8a04' : 'none' // gold border for high contrast and crisp edges
                }}
                  className="flex items-center justify-end pr-1"
                  title={`${node.desc} (Línea Base / Control)\nBL Inicio: ${fmtShort(blSpan.blStart)} → BL Fin: ${fmtShort(blSpan.blFinish)}`}
                />
              )}
            </div>
          );

          if (isExp && hasChildren) {
            children.forEach(c => renderNode(c, depth + 1));
          }
        };

        const a_find_or_mock = (key: string) => {
          if (key.includes('__ACT__')) {
            const id = key.split('__ACT__')[1].split('_')[0];
            return actividades.find(act => (act.activityId || act.id) === id) || { avance: 0, avanceAT: 0 };
          }
          const parts = key.split('.__');
          if (parts.length > 1) {
            const id = parts[1];
            return actividades.find(act => act.id === id) || { avance: 0, avanceAT: 0 };
          }
          return { avance: 0, avanceAT: 0 };
        };

        ganttRoots.forEach(root => {
          renderNode(root, 0);
        });

        if (tableRows.length === 0) {
          tableRows.push(
            <div key="empty" className="p-8 text-center text-xs text-slate-400 font-medium" style={{ height: 100 }}>
              No se encontraron actividades de acuerdo a estos filtros.
            </div>
          );
        }

        const TABLE_W = 16 + 92 + 286 + 68 + 54 + 72 + 62 + 62 + 62 + 62 + 28; // 864px total left panel table width

        const handleExportGanttXls = () => {
          const rows: string[] = [];
          rows.push(["Id", "Descripción", "Cantidad", "Act.Count", "Inicio", "Fin", "BL Inicio", "BL Fin", "Total Float (TF)"].join("\t"));

          const htmlRowsArray: string[] = [];

          const traverse = (node: any, depth: number) => {
            if (!visibleKeys.has(node.key)) return;

            const span = node.esHoja
              ? { start: node.start, finish: node.finish }
              : calcSpan(node.key);

            const blSpan = node.esHoja
              ? { blStart: node.blStart, blFinish: node.blFinish }
              : calcBlSpan(node.key);

            const actCount = node.esHoja ? "1" : String(calcVisibleCount(node.key));
            const id = node.actId ? node.actId : node.wbs;
            const descIndented = "   ".repeat(depth) + node.desc;
            const inicioStr = fmtShort(span.start);
            const finStr = fmtShort(span.finish);
            const blInicioStr = fmtShort(blSpan.blStart);
            const blFinStr = fmtShort(blSpan.blFinish);
            const rowTf = calcMinTf(node.key);
            const tfStr = rowTf !== null && rowTf !== undefined ? `${rowTf}d` : "—";

            const act = node.actividadRef || a_find_or_mock(node.key);
            const cantStr = node.esHoja && act?.cantidadCdo !== undefined && act?.cantidadCdo !== null
              ? `${act.cantidadCdo.toLocaleString('es-ES')}${act.unidad || act.unit ? ' ' + (act.unidad || act.unit) : ''}`.trim()
              : "—";

            rows.push([
              id,
              descIndented,
              cantStr,
              actCount,
              inicioStr,
              finStr,
              blInicioStr,
              blFinStr,
              tfStr
            ].join("\t"));

            // Formateo HTML para pegar en Excel
            const isParent = !node.esHoja;
            let bg = "#ffffff";
            let fg = "#334155";
            let weight = "normal";
            let fs = "11px";

            if (isParent) {
              weight = "bold";
              if (depth === 0) {
                bg = "#cbd5e1";
                fg = "#0f172a";
                fs = "12px";
              } else if (depth === 1) {
                bg = "#e2e8f0";
                fg = "#1e293b";
                fs = "11.5px";
              } else {
                bg = "#f1f5f9";
                fg = "#334155";
                fs = "11px";
              }
            }

            const indentHtml = "&nbsp;".repeat(depth * 5);
            const descHtml = `${indentHtml}${node.desc}`;

            const trHtml = `
              <tr style="background-color: ${bg}; color: ${fg}; font-weight: ${weight}; font-size: ${fs};">
                <td style="padding: 6px 12px; border: 1px solid #cbd5e1; font-family: monospace;">${id}</td>
                <td style="padding: 6px 12px; border: 1px solid #cbd5e1; text-align: left;">${descHtml}</td>
                <td style="padding: 6px 12px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace;">${cantStr}</td>
                <td style="padding: 6px 12px; border: 1px solid #cbd5e1; text-align: center;">${actCount}</td>
                <td style="padding: 6px 12px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace;">${inicioStr}</td>
                <td style="padding: 6px 12px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace;">${finStr}</td>
                <td style="padding: 6px 12px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace;">${blInicioStr}</td>
                <td style="padding: 6px 12px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace;">${blFinStr}</td>
                <td style="padding: 6px 12px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; font-weight: bold;">${tfStr}</td>
              </tr>
            `.trim();
            htmlRowsArray.push(trHtml);

            const isExp = ganttExp.has(node.key);
            const children = childrenOf(node.key).filter(c => visibleKeys.has(c.key));
            const hasChildren = children.length > 0;

            if (isExp && hasChildren) {
              children.forEach(c => traverse(c, depth + 1));
            }
          };

          ganttRoots.forEach(root => {
            traverse(root, 0);
          });

          const tsvContent = rows.join("\n");
          const htmlRows = htmlRowsArray.join("\n");
          const htmlContent = `
            <table style="border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11px; color: #334155; width: 100%;">
              <thead>
                <tr style="background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: left;">
                  <th style="padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: bold;">Id</th>
                  <th style="padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: bold;">Descripción</th>
                  <th style="padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: bold; text-align: right;">Cantidad</th>
                  <th style="padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: bold; text-align: center;">Act.Count</th>
                  <th style="padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: bold; text-align: center;">Inicio</th>
                  <th style="padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: bold; text-align: center;">Fin</th>
                  <th style="padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: bold; text-align: center;">BL Inicio</th>
                  <th style="padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: bold; text-align: center;">BL Fin</th>
                  <th style="padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: bold; text-align: right;">TF</th>
                </tr>
              </thead>
              <tbody>
                ${htmlRows}
              </tbody>
            </table>
          `.trim();

          try {
            const clipboardItem = new ClipboardItem({
              "text/plain": new Blob([tsvContent], { type: "text/plain" }),
              "text/html": new Blob([htmlContent], { type: "text/html" })
            });
            navigator.clipboard.write([clipboardItem]).then(() => {
              setCopiedGantt(true);
              setTimeout(() => {
                setCopiedGantt(false);
              }, 2000);
            }).catch((err) => {
              console.error("Rich copy failed, falling back to plain text:", err);
              navigator.clipboard.writeText(tsvContent).then(() => {
                setCopiedGantt(true);
                setTimeout(() => {
                  setCopiedGantt(false);
                }, 2000);
              });
            });
          } catch (e) {
            console.error("ClipboardItem not supported, falling back to plain text:", e);
            navigator.clipboard.writeText(tsvContent).then(() => {
              setCopiedGantt(true);
              setTimeout(() => {
                setCopiedGantt(false);
              }, 2000);
            });
          }
        };

        return (
          <div id="gantt-card-container" className="mt-6 bg-white rounded-xl shadow-xs border border-[#D5DEE2] overflow-hidden">
            {/* Controles del Gantt */}
            <div id="gantt-controls-toolbar" className="flex flex-col gap-2.5 px-4 py-3 border-b border-[#D5DEE2] bg-[#F5F8F9]">
              {/* Fila 1 de Controles: Jerarquía, Status, TF, Exp/Colap, P.Ac, P6 y Export */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-['Barlow_Condensed'] font-semibold text-[#14212A] mr-1 uppercase tracking-wider">Gantt</span>

              {/* Toggle de Jerarquía (Vista 1 WBS vs Vista 2 Tipo - SubC - Scap - Unit) */}
              <div className="inline-flex p-0.5 rounded-lg bg-white border border-[#D5DEE2] shadow-xs select-none shrink-0" id="gantt-hierarchy-mode-toggle">
                <button
                  type="button"
                  id="btn-gantt-hierarchy-wbs"
                  onClick={() => {
                    if (ganttHierarchyMode !== 'wbs') {
                      setGanttHierarchyMode('wbs');
                      setGanttExp(new Set());
                      setSelectedRoots(new Set());
                      setAppliedSelectedRoots(new Set());
                      setGanttHierarchyLevel('all');
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                    ganttHierarchyMode === 'wbs'
                      ? 'bg-[#CD0000] text-white shadow-xs'
                      : 'text-[#5A6A74] hover:text-[#14212A] hover:bg-[#F5F8F9]'
                  }`}
                  title="Vista 1: WBS (Partidas / Capítulos)"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>WBS</span>
                </button>
                <button
                  type="button"
                  id="btn-gantt-hierarchy-custom"
                  onClick={() => {
                    if (ganttHierarchyMode !== 'tipo_subc_scap_unit') {
                      setGanttHierarchyMode('tipo_subc_scap_unit');
                      setGanttExp(new Set());
                      setSelectedRoots(new Set());
                      setAppliedSelectedRoots(new Set());
                      setGanttHierarchyLevel('all');
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                    ganttHierarchyMode === 'tipo_subc_scap_unit'
                      ? 'bg-[#CD0000] text-white shadow-xs'
                      : 'text-[#5A6A74] hover:text-[#14212A] hover:bg-[#F5F8F9]'
                  }`}
                  title="Vista 2: Fases (Componente - Tipo - SubC - Scap - Unit)"
                >
                  <span className="w-2 h-2 rounded-full bg-[#2B7F52]" />
                  <span>Fases</span>
                </button>
              </div>

              {/* Checkbox Multi-Sel. */}
              <label id="checkbox-gantt-multi-sel" className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-650 cursor-pointer select-none bg-indigo-50/70 hover:bg-indigo-100/80 px-2.5 py-1 rounded-xl border border-indigo-200/50 hover:border-indigo-300 shadow-mini transition-all group shrink-0">
                <input
                  type="checkbox"
                  checked={multiSelEnabled}
                  onChange={e => {
                    const checked = e.target.checked;
                    setMultiSelEnabled(checked);
                    if (!checked) {
                      setAppliedSelectedRoots(new Set(selectedRoots));
                    }
                  }}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer transition-all"
                />
                <span className="group-hover:text-slate-800 transition-colors">Multi-Sel.</span>
              </label>

              {/* Filtro status */}
              <div className="flex rounded-xl border border-slate-200/75 overflow-hidden text-[9px] p-0.5 bg-slate-100 font-bold ml-1">
                {[
                  ['all', 'Todos'],
                  ['Completed', 'Completado'],
                  ['In Progress', 'En Curso'],
                  ['Not Started', 'No inic.']
                ].map(([v, l]) => {
                  const active = v === 'all' 
                    ? ganttStatus === 'all' 
                    : ganttStatus.split(',').map(s => s.trim().toLowerCase()).includes(v.toLowerCase());
                  return (
                    <button
                      key={v}
                      onClick={(e) => {
                        setGanttExp(new Set());
                        if (v === 'all') {
                          setGanttStatus('all');
                          return;
                        }
                        const isCtrl = e && (e.ctrlKey || e.metaKey);
                        let currentList = ganttStatus === 'all' ? [] : ganttStatus.split(',').map(s => s.trim()).filter(Boolean);

                        if (isCtrl || multiSelEnabled) {
                          if (currentList.some(s => s.toLowerCase() === v.toLowerCase())) {
                            currentList = currentList.filter(x => x.toLowerCase() !== v.toLowerCase());
                          } else {
                            currentList.push(v);
                          }
                          setGanttStatus(currentList.length === 0 ? 'all' : currentList.join(','));
                        } else {
                          if (currentList.length > 1 && currentList.some(s => s.toLowerCase() === v.toLowerCase())) {
                            currentList = currentList.filter(x => x.toLowerCase() !== v.toLowerCase());
                            setGanttStatus(currentList.length === 0 ? 'all' : currentList.join(','));
                          } else {
                            const isActive = currentList.length === 1 && currentList[0].toLowerCase() === v.toLowerCase();
                            setGanttTipo('all');
                            setGanttStatus(isActive ? 'all' : v);
                          }
                        }
                      }}
                      className={`px-2.5 py-1 rounded-md transition-all ${active ? 'bg-[#CD0000] text-white shadow-xs' : 'text-[#5A6A74] hover:text-[#14212A] hover:bg-white'}`}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>

              {/* Filtro Total Float */}
              <div className="flex items-center gap-1 text-[9px] font-bold">
                <span className="text-[#5A6A74] font-black mr-0.5">TF:</span>
                <div className="flex rounded-lg border border-[#D5DEE2] overflow-hidden p-0.5 bg-[#F5F8F9] font-bold">
                  {[
                    ['all', 'Todos'],
                    ['criticas', hasNegativeGlobalFloat ? `RC (${globalMinFloat}d)` : 'RC'],
                    ['subcriticas', 'SubCrit.'],
                    ['riesgosas', 'Risk']
                  ].map(([v, l]) => {
                    const isTfActive = v === 'all'
                      ? ganttFloat === 'all'
                      : (() => {
                          const list = ganttFloat.split(',').map(s => s.trim());
                          if (v === 'criticas') return list.includes('criticas') || list.includes('0');
                          if (v === 'subcriticas') return list.includes('subcriticas') || list.includes('negativos');
                          if (v === 'riesgosas') return list.includes('riesgosas') || list.includes('lte20') || list.includes('lte20sub');
                          return list.includes(v);
                        })();
                    return (
                      <button
                        key={v}
                        onClick={(e) => {
                          setGanttExp(new Set());
                          if (v === 'all') {
                            setGanttFloat('all');
                          } else {
                            const isCtrl = e.ctrlKey || e.metaKey;
                            if (isCtrl) {
                              let currentList = ganttFloat === 'all' ? [] : ganttFloat.split(',').filter(Boolean);
                              if (currentList.includes(v)) {
                                currentList = currentList.filter(x => x !== v);
                              } else {
                                currentList.push(v);
                              }
                              setGanttFloat(currentList.length === 0 ? 'all' : currentList.join(','));
                            } else {
                              setGanttFloat(isTfActive ? 'all' : v);
                            }
                          }
                        }}
                        className={`px-2 py-1 rounded-md transition-all ${isTfActive ? 'bg-[#CD0000] text-white shadow-xs font-bold' : 'text-[#5A6A74] hover:text-[#14212A] hover:bg-white'}`}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Toggle Expandir / Colapsar Todo ubicado junto a TF */}
              <div 
                id="gantt-exp-colap-toggle"
                className="inline-flex p-0.5 rounded-lg border border-[#D5DEE2] bg-[#F5F8F9] font-bold text-[9.5px] shrink-0 select-none shadow-xs"
                title="Expandir o Colapsar toda la jerarquía de partidas"
              >
                <button
                  type="button"
                  id="btn-gantt-expand-all"
                  onClick={() => {
                    const allParentKeys = ganttNodes.filter(n => !n.esHoja).map(n => n.key);
                    setGanttExp(new Set(allParentKeys));
                    setGanttHierarchyLevel('all');
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    ganttExp.size > 0 && ganttHierarchyLevel !== '1'
                      ? 'bg-white text-[#CD0000] shadow-xs border border-[#D5DEE2] font-bold'
                      : 'text-[#5A6A74] hover:text-[#14212A] hover:bg-white/60'
                  }`}
                  title="Expandir todas las partidas de la jerarquía"
                >
                  <ChevronsUpDown className="w-3.5 h-3.5 text-[#CD0000]" />
                  <span>Exp.</span>
                </button>
                <button
                  type="button"
                  id="btn-gantt-collapse-all"
                  onClick={() => {
                    setGanttExp(new Set());
                    setGanttHierarchyLevel('1');
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    ganttExp.size === 0 || ganttHierarchyLevel === '1'
                      ? 'bg-white text-[#CD0000] shadow-xs border border-[#D5DEE2] font-bold'
                      : 'text-[#5A6A74] hover:text-[#14212A] hover:bg-white/60'
                  }`}
                  title="Colapsar toda la jerarquía"
                >
                  <ChevronsDownUp className="w-3.5 h-3.5 text-[#CD0000]" />
                  <span>Colap.</span>
                </button>
              </div>

              {/* Filtro P.Ac (Columna AO) */}
              <div className="relative shrink-0" ref={pacDropdownRef}>
                <button
                  type="button"
                  id="btn-gantt-pac-filter"
                  onClick={() => setIsGanttPAcDropdownOpen(!isGanttPAcDropdownOpen)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition-all text-[10px] font-bold shadow-xs cursor-pointer ${
                    ganttPAc !== 'all'
                      ? 'bg-[#CD0000] text-white border-[#CD0000] hover:bg-[#A80000]'
                      : 'bg-white text-[#5A6A74] border-[#D5DEE2] hover:bg-[#F5F8F9] hover:text-[#14212A]'
                  }`}
                  title="Filtrar actividades por P.Ac (Columna AO CDO)"
                >
                  <Filter className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span className="truncate max-w-[85px]">
                    {ganttPAc === 'all'
                      ? 'P.Ac'
                      : ganttPAc === '__none__'
                      ? 'P.Ac (0)'
                      : ganttPAc.split(',').length === 1
                      ? `P.Ac: ${ganttPAc}`
                      : `P.Ac (${ganttPAc.split(',').length})`}
                  </span>
                  <ChevronDown className={`w-3 h-3 transition-transform shrink-0 ${isGanttPAcDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isGanttPAcDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={(e) => { e.stopPropagation(); setIsGanttPAcDropdownOpen(false); }} 
                    />
                    <div 
                      className="ht-dd absolute left-0 mt-1 w-64 max-h-72 overflow-y-auto bg-white border border-indigo-200 rounded-2xl shadow-2xl z-50 p-2 text-xs animate-fade-in select-none"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="px-2 py-1 mb-1.5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filtro P.Ac</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setGanttPAc('all');
                              setGanttExp(new Set());
                            }}
                            className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md transition-all cursor-pointer"
                          >
                            ✓ Todos
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setGanttPAc('__none__');
                              setGanttExp(new Set());
                            }}
                            className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-all cursor-pointer"
                          >
                            ✗ Limpiar
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        {ganttPAcDisponibles.length === 0 ? (
                          <div className="p-3 text-center text-slate-400 italic text-[10px]">No hay valores de P.Ac disponibles</div>
                        ) : (
                          ganttPAcDisponibles.map(pacVal => {
                            const isSelected = ganttPAc === 'all' 
                              ? true 
                              : ganttPAc === '__none__'
                              ? false
                              : ganttPAc.split(',').map(s => s.trim().toLowerCase()).includes(pacVal.toLowerCase());
                            return (
                              <button
                                key={pacVal}
                                type="button"
                                onClick={() => {
                                  setGanttExp(new Set());
                                  let current = ganttPAc === 'all' 
                                    ? [...ganttPAcDisponibles] 
                                    : ganttPAc === '__none__' 
                                    ? [] 
                                    : ganttPAc.split(',').map(s => s.trim()).filter(Boolean);
                                  
                                  const exists = current.some(x => x.toLowerCase() === pacVal.toLowerCase());
                                  if (exists) {
                                    current = current.filter(x => x.toLowerCase() !== pacVal.toLowerCase());
                                  } else {
                                    current.push(pacVal);
                                  }

                                  if (current.length === 0) {
                                    setGanttPAc('__none__');
                                  } else if (current.length === ganttPAcDisponibles.length) {
                                    setGanttPAc('all');
                                  } else {
                                    setGanttPAc(current.join(','));
                                  }
                                }}
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
                                  <span className="truncate text-[10.5px]">{pacVal}</span>
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

              {/* Informative DD block located right next to active actions */}
              <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-2 py-1 rounded-xl border border-emerald-200/65 shadow-mini shrink-0 select-none">
                <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-[10px] font-black tracking-wider text-emerald-800">p6:</span>
                {isLoggedIn ? (
                  <input
                    type="date"
                    id="gantt-dd-input"
                    value={(() => {
                      if (!(fechaCorteState instanceof Date) || isNaN(fechaCorteState.getTime())) return '';
                      const y = fechaCorteState.getFullYear();
                      const m = String(fechaCorteState.getMonth() + 1).padStart(2, '0');
                      const d = String(fechaCorteState.getDate()).padStart(2, '0');
                      return `${y}-${m}-${d}`;
                    })()}
                    onChange={(e) => {
                      if (e.target.value) {
                        const [y, m, d] = e.target.value.split('-').map(Number);
                        setFechaCorteState(new Date(y, m - 1, d, 12, 0, 0));
                      }
                    }}
                    className="bg-white border border-emerald-300 rounded px-1 py-0.5 text-[9.5px] font-bold text-slate-800 outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer min-w-[85px] max-w-[95px]"
                    title="Modificar fecha de corte de Primavera"
                  />
                ) : (
                  <span className="text-[10px] font-extrabold text-emerald-900 bg-white border border-emerald-200/50 px-2 py-0.5 rounded-lg">
                    {fechaCorteState instanceof Date && !isNaN(fechaCorteState.getTime())
                      ? fechaCorteState.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })
                      : '—'}
                  </span>
                )}
              </div>

              {/* Dropdown Export (Exportaciones XLS y PDF) ubicado al lado de p6 */}
              <div id="gantt-export-dropdown-container" className="relative shrink-0" ref={pythonMenuRef}>
                <button
                  type="button"
                  id="btn-gantt-export-dropdown"
                  onClick={() => setIsPythonMenuOpen(!isPythonMenuOpen)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-all text-[10px] font-bold shadow-mini cursor-pointer active:scale-95 ${
                    isPythonMenuOpen
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                      : isExportingGanttPdf
                      ? 'bg-rose-50 text-rose-700 border-rose-300'
                      : copiedGantt
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  title="Opciones de exportación (xls, PDF)"
                >
                  {isExportingGanttPdf ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 text-rose-600 animate-spin" />
                      <span className="text-rose-700 font-extrabold animate-pulse">Generando A3...</span>
                    </>
                  ) : copiedGantt ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white animate-scale-up" />
                      <span>¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5 text-indigo-600" />
                      <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isPythonMenuOpen ? 'rotate-180' : ''}`} />
                    </>
                  )}
                </button>

                {isPythonMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsPythonMenuOpen(false);
                      }}
                    />
                    <div
                      id="gantt-export-menu"
                      className="ht-dd absolute left-0 mt-1.5 w-36 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-1.5 select-none animate-fade-in space-y-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        id="btn-export-gantt-xls"
                        onClick={() => {
                          handleExportGanttXls();
                          setIsPythonMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-[11px] font-bold transition-all cursor-pointer group ${
                          copiedGantt
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-800'
                        }`}
                        title="Copiar datos estructurados de la vista actual para Excel"
                      >
                        {copiedGantt ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 animate-scale-up shrink-0" />
                        ) : (
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform shrink-0" />
                        )}
                        <span>xls</span>
                      </button>

                      <button
                        type="button"
                        id="btn-export-gantt-pdf"
                        onClick={() => {
                          handleExportGanttPdf();
                          setIsPythonMenuOpen(false);
                        }}
                        disabled={isExportingGanttPdf}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-[11px] font-bold transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group ${
                          isExportingGanttPdf
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'text-slate-700 hover:bg-rose-50 hover:text-rose-800'
                        }`}
                        title="Exportar imagen de toda la tarjeta GANTT a PDF en formato A3"
                      >
                        {isExportingGanttPdf ? (
                          <RefreshCw className="w-3.5 h-3.5 text-rose-600 animate-spin shrink-0" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-rose-600 group-hover:scale-110 transition-transform shrink-0" />
                        )}
                        <span>PDF</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Fila 2 de Controles: Búsqueda, Fechas, Jerarquía, Limpiar y al final Botones Procura, Flete, Montaje, Construcción */}
            <div className="flex items-center justify-between gap-3 flex-wrap pt-1.5 border-t border-slate-200/60">
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Feature de Búsqueda inteligente ubicado al lado de p6 */}
              <div className="relative min-w-40 max-w-56 shrink-0" ref={searchRef}>
                <input
                  type="text"
                  placeholder={
                    searchFieldType === 'descripcion' ? "Buscar..." :
                    searchFieldType === 'cap' ? "Buscar CAP..." :
                    searchFieldType === 'scap' ? "Buscar Scap..." :
                    searchFieldType === 'subcontratista' ? "Buscar SubC..." :
                    "Buscar P.Ac..."
                  }
                  value={ganttSearch}
                  onChange={e => setGanttSearch(e.target.value)}
                  onFocus={() => setIsSearchPopupOpen(true)}
                  onClick={() => setIsSearchPopupOpen(true)}
                  className="w-full pl-7 pr-7 py-1 border border-slate-250 rounded-xl text-[10.5px] font-semibold bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-mini transition-all"
                />
                <svg className="absolute left-2.5 top-1.5 w-3 h-3 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSearchPopupOpen(!isSearchPopupOpen);
                  }}
                  className="absolute right-2 top-1.5 w-4 h-4 flex items-center justify-center text-slate-450 hover:text-indigo-600 transition-colors rounded hover:bg-slate-100 cursor-pointer"
                  title="Filtros inteligentes de columnas"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {/* Popover inteligente */}
                {isSearchPopupOpen && createPortal(
                  <div
                    id="gantt-smart-search-portal"
                    style={{
                      position: 'fixed',
                      top: `${popupCoords.top + 6}px`,
                      left: `${popupCoords.left}px`,
                      width: `${Math.max(popupCoords.width, 280)}px`,
                      transition: 'top 0.15s cubic-bezier(0.16, 1, 0.3, 1), left 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    className="bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-3 text-left"
                  >
                    <div className="font-black text-slate-800 border-b border-slate-150 pb-2 mb-2.5 flex items-center justify-between text-[11px]">
                      <span>Filtro Inteligente de Búsqueda</span>
                      <span className="text-[9px] text-indigo-600 bg-indigo-50 font-bold px-1.5 py-0.5 rounded-md">Pestaña CDO</span>
                    </div>
                    
                    <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-2">Seleccione Columna:</p>
                    <div className="grid grid-cols-3 gap-1.5 mb-3">
                      {(['descripcion', 'cap', 'scap', 'subcontratista', 'pac'] as const).map((field) => {
                        const label = {
                          descripcion: 'Descripción',
                          cap: 'CAP',
                          scap: 'Paquete',
                          subcontratista: 'SubC',
                          pac: 'P.Ac'
                        }[field];
                        const col = {
                          descripcion: 'Col. Descripción',
                          cap: 'Col. CAP',
                          scap: 'Col. Paquete',
                          subcontratista: 'Col. Subcontratista',
                          pac: 'Col. P.Ac'
                        }[field];
                        const isSelected = searchFieldType === field;
                        return (
                          <button
                            key={field}
                            type="button"
                            onClick={() => {
                              setSearchFieldType(field);
                              setGanttSearch('');
                            }}
                            className={`px-2 py-2 rounded-xl border text-left flex flex-col justify-between transition-all font-bold group cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                            }`}
                          >
                            <span className="text-[10px]">{label}</span>
                            <span className={`text-[8px] font-medium leading-none mt-1 ${
                              isSelected ? 'text-indigo-205' : 'text-slate-400 group-hover:text-slate-500'
                            }`}>{col}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Menú de selección de valores únicos */}
                    {searchFieldType !== 'descripcion' && (
                      <div className="border-t border-slate-150 pt-2.5">
                        <div className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
                          <span>Valores en datos:</span>
                          <span className="text-[10px] text-slate-605 bg-slate-100 px-1.5 py-0.2 rounded-md font-bold">
                            {getUniqueValues(searchFieldType as 'cap' | 'scap' | 'subcontratista' | 'pac').length}
                          </span>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                          {getUniqueValues(searchFieldType as 'cap' | 'scap' | 'subcontratista' | 'pac').map((val) => {
                            const isCurrentSearch = ganttSearch === val;
                            return (
                              <button
                                key={val}
                                type="button"
                                onClick={() => {
                                  setGanttSearch(val);
                                  setIsSearchPopupOpen(false);
                                }}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg border transition-all text-[10px] break-words whitespace-normal block leading-tight cursor-pointer ${
                                  isCurrentSearch
                                    ? 'bg-indigo-600 border-indigo-600 text-white font-extrabold shadow-sm'
                                    : 'bg-slate-50 border-slate-150 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 text-slate-700 font-semibold'
                                }`}
                                title={val}
                              >
                                {val}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>,
                  document.body
                )}
              </div>

              {/* Tag/Badge de búsqueda activa por columna */}
              {searchFieldType !== 'descripcion' && (
                <span className="px-2.5 py-1 text-[10px] bg-indigo-50 border border-indigo-200/60 text-indigo-700 rounded-xl font-bold flex items-center gap-1.5 shadow-mini shrink-0">
                  <span className="opacity-75 font-semibold text-[8.5px] uppercase bg-indigo-200/40 px-1 py-0.2 rounded">
                    {searchFieldType === 'cap' ? 'CAP' : searchFieldType === 'scap' ? 'Paquete' : searchFieldType === 'subcontratista' ? 'SubC' : 'P.Ac'}
                  </span>
                  <span className="max-w-28 truncate">{searchFieldType === 'cap' ? 'CAP' : searchFieldType === 'scap' ? 'Scap' : searchFieldType === 'subcontratista' ? 'SubC' : 'P.Ac'}:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchFieldType('descripcion');
                      setGanttSearch('');
                    }}
                    className="w-3.5 h-3.5 flex items-center justify-center text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100 rounded-full font-black leading-none cursor-pointer"
                    title="Restablecer a búsqueda general"
                  >
                    ✕
                  </button>
                </span>
              )}

              {/* Filtro Inteligente de Fechas */}
              <div ref={smartFilterRef} className="relative shrink-0">
                <button
                  onClick={() => setIsSmartFilterOpen(!isSmartFilterOpen)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-all text-[10px] font-bold shadow-mini ${
                    smartFilterActive 
                      ? 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700' 
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  title="Filtro de Ejecución (BL Inicio / BL Fin)"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${smartFilterActive ? 'text-amber-300 animate-pulse' : 'text-indigo-500'}`} />
                  <span>Filtro</span>
                </button>

                {isSmartFilterOpen && (
                  <div className="ht-dd absolute right-0 mt-1.5 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-3.5 flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="font-extrabold text-slate-800 text-[11px] tracking-wide">Filtro de Ejecución</span>
                      </div>
                      {smartFilterActive && (
                        <button
                          onClick={() => setSmartFilterActive(false)}
                          className="text-[9px] font-bold text-red-650 bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded-lg transition-colors"
                        >
                          Desactivar
                        </button>
                      )}
                    </div>

                    <p className="text-[10px] text-slate-500 leading-normal">
                      Muestra actividades en ejecución en el período especificado según sus fechas BL.
                    </p>

                    <div className="space-y-2.5">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-black text-slate-500 tracking-wider uppercase">Inicio del período</label>
                        <input
                          type="date"
                          value={smartFilterStart}
                          onChange={(e) => setSmartFilterStart(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 rounded-lg p-1.5 text-xs font-semibold text-slate-800 outline-none transition-all cursor-pointer"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-black text-slate-500 tracking-wider uppercase">Fin del período</label>
                        <input
                          type="date"
                          value={smartFilterEnd}
                          onChange={(e) => setSmartFilterEnd(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 rounded-lg p-1.5 text-xs font-semibold text-slate-800 outline-none transition-all cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setIsSmartFilterOpen(false);
                        }}
                        className="flex-1 py-1.5 px-3 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold text-[10px] transition-all text-center"
                      >
                        Cerrar
                      </button>
                      <button
                        onClick={() => {
                          setSmartFilterActive(true);
                          setIsSmartFilterOpen(false);
                        }}
                        className="flex-1 py-1.5 px-3 bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98] rounded-xl font-bold text-[10px] shadow-sm transition-all text-center"
                      >
                        Aplicar Filtro
                      </button>
                    </div>
                  </div>
                )}
              </div>



              {/* Selector de Nivel por Jerarquía */}
              <div 
                id="gantt-hierarchy-level-selector"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 transition-all text-[10px] font-bold shadow-mini shrink-0 group"
                title="Desplegar para decidir hasta qué nivel de la jerarquía visualizar"
              >
                <Layers className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <label htmlFor="selector-gantt-nivel-jerarquia" className="text-slate-500 font-extrabold select-none cursor-pointer">
                  Jerarquía:
                </label>
                <select
                  id="selector-gantt-nivel-jerarquia"
                  value={ganttHierarchyLevel}
                  onChange={(e) => {
                    const lvl = e.target.value;
                    setGanttHierarchyLevel(lvl);
                    if (lvl === '1') {
                      setGanttExp(new Set());
                    } else if (lvl === 'all') {
                      const allParentKeys = ganttNodes.filter(n => !n.esHoja).map(n => n.key);
                      setGanttExp(new Set(allParentKeys));
                    } else {
                      const targetLvl = parseInt(lvl, 10);
                      const keysToExpand = ganttNodes
                        .filter(n => !n.esHoja && n.nivel <= targetLvl)
                        .map(n => n.key);
                      setGanttExp(new Set(keysToExpand));
                    }
                  }}
                  className="bg-transparent font-bold text-slate-800 text-[10px] outline-none cursor-pointer pr-1 hover:text-indigo-600 transition-colors"
                >
                  {ganttHierarchyMode === 'tipo_subc_scap_unit' ? (
                    <>
                      <option value="1">Nivel 1 (Componentes)</option>
                      <option value="2">Nivel 2 (Tipologías)</option>
                      <option value="3">Nivel 3 (Subcontratistas)</option>
                      <option value="4">Nivel 4 (Paquetes / Scap)</option>
                      <option value="5">Nivel 5 (Unidades)</option>
                      <option value="all">Todos los Niveles (Actividades)</option>
                    </>
                  ) : (
                    <>
                      <option value="1">Nivel 1 (Capítulos)</option>
                      <option value="2">Nivel 2 (Subcapítulos)</option>
                      <option value="3">Nivel 3 (Paquetes)</option>
                      <option value="4">Nivel 4 (Subpaquetes)</option>
                      <option value="5">Nivel 5 (Detalle)</option>
                      <option value="all">Todos los Niveles</option>
                    </>
                  )}
                </select>
              </div>

              <div className="flex gap-1.5 text-[9.5px] font-bold">
                {(ganttStatus !== 'all' || ganttFloat !== 'all' || ganttPAc !== 'all' || ganttTipo !== 'all' || qg || appliedSelectedRoots.size > 0 || selectedRoots.size > 0 || blStartFilterActive || blFinishFilterActive || smartFilterActive || isGanttProcuraFilter || isGanttFleteFilter || isGanttMontajeFilter || isGanttConstruccionFilter || ganttSortField !== null) && (
                  <button
                    onClick={() => {
                      setGanttStatus('all');
                      setGanttFloat('all');
                      setGanttPAc('all');
                      setGanttTipo('all');
                      setGanttSearch('');
                      setGanttExp(new Set());
                      setSelectedRoots(new Set());
                      setAppliedSelectedRoots(new Set());
                      setBlStartFilterActive(false);
                      setBlStartSelectedDays(new Set());
                      setBlFinishFilterActive(false);
                      setBlFinishSelectedDays(new Set());
                      setSmartFilterActive(false);
                      setGanttHierarchyLevel('all');
                      setIsGanttProcuraFilter(false);
                      setIsGanttFleteFilter(false);
                      setIsGanttMontajeFilter(false);
                      setIsGanttConstruccionFilter(false);
                      setGanttSortField(null);
                      setGanttSortOrder('asc');
                    }}
                    className="px-2.5 py-1 bg-red-100 text-red-650 rounded-xl hover:bg-red-150 transition-colors font-bold uppercase tracking-wide shadow-mini"
                  >
                    ✕ Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Botones Procura, Flete, Montaje, Construcción al final de la segunda fila */}
            <div className="flex items-center gap-1.5 flex-wrap ml-auto">
              {/* Procura Filter Button */}
              <button
                type="button"
                id="btn-gantt-filtro-procura"
                onClick={() => setIsGanttProcuraFilter(prev => !prev)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
                  isGanttProcuraFilter
                    ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-sm ring-2 ring-blue-300'
                    : 'bg-blue-50/90 hover:bg-blue-100 text-blue-900 border-blue-300/80 shadow-mini'
                }`}
                title='Filtrar actividades cuyo Activity Name inicie por "compr"'
              >
                <ShoppingCart className={`w-3.5 h-3.5 ${isGanttProcuraFilter ? 'text-white' : 'text-blue-700'}`} />
                <span>Procura</span>
                {isGanttProcuraFilter && (
                  <span className="px-1.5 py-0.2 bg-white/20 text-white rounded-full text-[9px] font-black uppercase tracking-wider">
                    Activo
                  </span>
                )}
              </button>

              {/* Flete Filter Button */}
              <button
                type="button"
                id="btn-gantt-filtro-flete"
                onClick={() => setIsGanttFleteFilter(prev => !prev)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
                  isGanttFleteFilter
                    ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-600 shadow-sm ring-2 ring-purple-300'
                    : 'bg-purple-50/90 hover:bg-purple-100 text-purple-900 border-purple-300/80 shadow-mini'
                }`}
                title='Filtrar actividades cuyo Activity Name inicie por "flete"'
              >
                <Truck className={`w-3.5 h-3.5 ${isGanttFleteFilter ? 'text-white' : 'text-purple-700'}`} />
                <span>Flete</span>
                {isGanttFleteFilter && (
                  <span className="px-1.5 py-0.2 bg-white/20 text-white rounded-full text-[9px] font-black uppercase tracking-wider">
                    Activo
                  </span>
                )}
              </button>

              {/* Montaje Filter Button */}
              <button
                type="button"
                id="btn-gantt-filtro-montaje"
                onClick={() => setIsGanttMontajeFilter(prev => !prev)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
                  isGanttMontajeFilter
                    ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600 shadow-sm ring-2 ring-amber-300'
                    : 'bg-amber-50/90 hover:bg-amber-100 text-amber-900 border-amber-300/80 shadow-mini'
                }`}
                title='Filtrar actividades cuyo Activity Name inicie por "Inst"'
              >
                <Wrench className={`w-3.5 h-3.5 ${isGanttMontajeFilter ? 'text-white' : 'text-amber-700'}`} />
                <span>Montaje</span>
                {isGanttMontajeFilter && (
                  <span className="px-1.5 py-0.2 bg-white/20 text-white rounded-full text-[9px] font-black uppercase tracking-wider">
                    Activo
                  </span>
                )}
              </button>

              {/* Construcción Filter Button */}
              <button
                type="button"
                id="btn-gantt-filtro-construccion"
                onClick={() => setIsGanttConstruccionFilter(prev => !prev)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
                  isGanttConstruccionFilter
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-300'
                    : 'bg-emerald-50/90 hover:bg-emerald-100 text-emerald-900 border-emerald-300/80 shadow-mini'
                }`}
                title="Filtrar actividades de Construcción (demás partidas que no son Procura, Flete ni Montaje)"
              >
                <HardHat className={`w-3.5 h-3.5 ${isGanttConstruccionFilter ? 'text-white' : 'text-emerald-700'}`} />
                <span>Construcción</span>
                {isGanttConstruccionFilter && (
                  <span className="px-1.5 py-0.2 bg-white/20 text-white rounded-full text-[9px] font-black uppercase tracking-wider">
                    Activo
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

            <div id="gantt-viewport-container" className="flex overflow-hidden relative" style={{ maxHeight: '70vh' }}>
              {/* Panel izquierdo sticky de la Tabla */}
              <div className="flex-shrink-0 border-r-2 border-slate-350 flex flex-col z-20 bg-white shadow-[3px_0_6px_rgba(0,0,0,0.05)]" style={{ width: TABLE_W }}>
                <div id="gantt-table-header" className="flex-shrink-0 flex items-center bg-slate-100 border-b border-slate-200 text-[9.5px] font-black text-slate-500 tracking-wider" style={{ height: ganttZoom === 'quarter' ? ROW_H * 2 : ROW_H }}>
                  <div style={{ width: 16 }} />
                  <div style={{ width: 92 }} className="px-1 text-left">{ganttHierarchyMode === 'tipo_subc_scap_unit' ? 'Nivel / Id' : 'Id'}</div>
                  <div className="flex-1 px-1 text-left">{ganttHierarchyMode === 'tipo_subc_scap_unit' ? 'Jerarquía / Descripción' : 'Descripción'}</div>
                  <div style={{ width: 68 }} className="text-right px-1" title="Cantidad CDO (Columna F)">Cant.</div>
                  <div style={{ width: 54 }} className="text-center px-1">Act.Count</div>
                  <div style={{ width: 72 }} className="text-center cursor-help underline decoration-dotted decoration-slate-400" title={ganttHierarchyMode === 'tipo_subc_scap_unit' ? "Estado de actividad o Selector de Componente (Nivel 1). Mantén presionado Ctrl o Cmd para seleccionar múltiples" : "Estado de sub-actividad o Selector de Partida Nivel 1. Mantén presionado Ctrl o Cmd para seleccionar múltiples"}>Status</div>
                  <div 
                    style={{ width: 62 }} 
                    onClick={() => handleToggleDateSort('start')}
                    className={`px-1 text-left flex items-center justify-between cursor-pointer select-none group transition-colors ${
                      ganttSortField === 'start'
                        ? 'text-indigo-700 bg-indigo-50/90 font-black'
                        : 'hover:text-indigo-600 hover:bg-slate-200/60'
                    }`}
                    title={
                      ganttSortField === 'start'
                        ? ganttSortOrder === 'asc'
                          ? "Orden: Más antiguo a más reciente (Earliest → Latest). Clic para ordenar de más reciente a más antiguo."
                          : "Orden: Más reciente a más antiguo (Latest → Earliest). Clic para restablecer orden."
                        : "Ordenar por fecha de Inicio (Earliest a Latest)"
                    }
                  >
                    <span>Inicio</span>
                    {ganttSortField === 'start' ? (
                      ganttSortOrder === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 stroke-[2.5] shrink-0" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-indigo-600 stroke-[2.5] shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    )}
                  </div>
                  <div 
                    style={{ width: 62 }} 
                    onClick={() => handleToggleDateSort('finish')}
                    className={`px-1 text-left flex items-center justify-between cursor-pointer select-none group transition-colors ${
                      ganttSortField === 'finish'
                        ? 'text-indigo-700 bg-indigo-50/90 font-black'
                        : 'hover:text-indigo-600 hover:bg-slate-200/60'
                    }`}
                    title={
                      ganttSortField === 'finish'
                        ? ganttSortOrder === 'asc'
                          ? "Orden: Más antiguo a más reciente (Earliest → Latest). Clic para ordenar de más reciente a más antiguo."
                          : "Orden: Más reciente a más antiguo (Latest → Earliest). Clic para restablecer orden."
                        : "Ordenar por fecha de Fin (Earliest a Latest)"
                    }
                  >
                    <span>Fin</span>
                    {ganttSortField === 'finish' ? (
                      ganttSortOrder === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 stroke-[2.5] shrink-0" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-indigo-600 stroke-[2.5] shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    )}
                  </div>
                  <div ref={blStartFilterRef} style={{ width: 62 }} className="px-1 text-left relative flex items-center justify-between group">
                    <span>BL Inicio</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isBlStartFilterOpen) {
                          setTempBlStartSelectedDays(new Set(blStartSelectedDays));
                          if (!blStartFilterActive) {
                            setTempBlStartSelectedDays(getAllBlStartKeys());
                          }
                        }
                        setIsBlStartFilterOpen(!isBlStartFilterOpen);
                        setIsBlFinishFilterOpen(false);
                      }}
                      className={`p-0.5 rounded hover:bg-slate-200 transition-colors cursor-pointer shrink-0 ${
                        blStartFilterActive ? 'text-indigo-600 font-black scale-110' : 'text-slate-400 group-hover:text-slate-600'
                      }`}
                      title="Filtrar BL Inicio"
                    >
                      <Filter className="w-2.5 h-2.5" />
                    </button>
                    {isBlStartFilterOpen && renderBlStartFilterDropdown()}
                  </div>
                  <div ref={blFinishFilterRef} style={{ width: 62 }} className="px-1 text-left relative flex items-center justify-between group">
                    <span>BL Fin</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isBlFinishFilterOpen) {
                          setTempBlFinishSelectedDays(new Set(blFinishSelectedDays));
                          if (!blFinishFilterActive) {
                            setTempBlFinishSelectedDays(getAllBlFinishKeys());
                          }
                        }
                        setIsBlFinishFilterOpen(!isBlFinishFilterOpen);
                        setIsBlStartFilterOpen(false);
                      }}
                      className={`p-0.5 rounded hover:bg-slate-200 transition-colors cursor-pointer shrink-0 ${
                        blFinishFilterActive ? 'text-indigo-600 font-black scale-110' : 'text-slate-400 group-hover:text-slate-600'
                      }`}
                      title="Filtrar BL Fin"
                    >
                      <Filter className="w-2.5 h-2.5" />
                    </button>
                    {isBlFinishFilterOpen && renderBlFinishFilterDropdown()}
                  </div>
                  <div style={{ width: 28 }} className="text-right px-1 pr-1.5 cursor-help" title="Total Float (TF): Despliega el menor valor según la jerarquía">Tf</div>
                </div>
                <div
                  id="gantt-body-scroll-container"
                  className="flex-1 overflow-y-scroll"
                  ref={ganttBodyRef}
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  onScroll={e => {
                    if (ganttBarRef.current) {
                      const target = e.target as HTMLDivElement;
                      ganttBarRef.current.scrollTop = target.scrollTop;
                    }
                  }}
                >
                  <div className="flex flex-col">{tableRows}</div>
                </div>
              </div>

              {/* Panel derecho scrollable de las barras del Gantt */}
              <div className="flex-1 flex flex-col overflow-hidden min-w-0 z-10 bg-slate-50/10">
                {/* Cabecera del tiempo fijada arriba */}
                <div className="flex-shrink-0 border-b border-slate-200/80 bg-slate-100" style={{ overflowX: 'hidden' }}>
                  <div id="gantt-time-header" className="flex flex-col" style={{ width: TOTAL_W, height: ganttZoom === 'quarter' ? ROW_H * 2 : ROW_H }}>
                    {/* Fila superior: Quarters o Meses según zoom */}
                    <div className="flex" style={{ height: ROW_H }}>
                      {timeCols.map((col, i) => (
                        <div
                          key={i}
                          className="flex-shrink-0 border-r border-slate-200/60 flex items-center justify-center text-[9px] font-black text-slate-500/80 uppercase tracking-widest"
                          style={{ width: COL_W }}
                        >
                          {col.label}
                        </div>
                      ))}
                    </div>
                    {/* Fila inferior: Solo en caso de zoom de trimestre (los meses resumidos) */}
                    {ganttZoom === 'quarter' && (
                      <div className="flex border-t border-slate-200/55 bg-slate-50/70" style={{ height: ROW_H }}>
                        {timeCols.map((col, i) => {
                          const baseMonth = col.qMonthStart !== undefined ? col.qMonthStart : col.date.getMonth();
                          const subMonths = [
                            getShortMonthName(baseMonth),
                            getShortMonthName(baseMonth + 1),
                            getShortMonthName(baseMonth + 2)
                          ];
                          return (
                            <div key={i} className="flex-shrink-0 border-r border-slate-200/60 flex" style={{ width: COL_W }}>
                              {subMonths.map((mName, subI) => (
                                <div
                                  key={subI}
                                  className="flex-1 flex items-center justify-center text-[8px] font-bold text-slate-450 border-r border-slate-200/20 last:border-r-0 uppercase"
                                >
                                  {mName}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Contenedor principal de barras (con scroll vertical y horizontal) */}
                <div
                  id="gantt-bars-scroll-container"
                  className={`flex-1 overflow-auto ${dragActive ? 'select-none' : ''}`}
                  style={{ cursor: dragActive ? 'grabbing' : 'grab' }}
                  ref={el => {
                    ganttBarRef.current = el;
                    if (el && todayX > 0 && !(el as any)._scrolledToToday) {
                      const containerW = el.clientWidth || 800;
                      el.scrollLeft = Math.max(0, todayX - containerW / 2);
                      (el as any)._scrolledToToday = true;
                    }
                  }}
                  onScroll={e => {
                    const target = e.target as HTMLDivElement;
                    if (ganttBodyRef.current) {
                      ganttBodyRef.current.scrollTop = target.scrollTop;
                    }
                    const hdr = document.getElementById('gantt-time-header');
                    if (hdr) {
                      hdr.style.transform = `translateX(-${target.scrollLeft}px)`;
                    }
                  }}
                  onMouseDown={handleGanttMouseDown}
                  onMouseMove={handleGanttMouseMove}
                  onMouseUp={handleGanttMouseUpOrLeave}
                  onMouseLeave={handleGanttMouseUpOrLeave}
                >
                  <div id="gantt-bars-inner-container" style={{ width: TOTAL_W, position: 'relative' }}>
                    {/* Líneas de cuadrícula vertical */}
                    {timeCols.map((col, i) => (
                      <div
                        key={i}
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left: i * COL_W,
                          width: COL_W,
                          borderRight: '1px solid #E2E8F0',
                          pointerEvents: 'none',
                          display: 'flex'
                        }}
                      >
                        {ganttZoom === 'quarter' && (
                          <>
                            <div className="h-full border-r border-slate-200/20" style={{ width: COL_W / 3 }} />
                            <div className="h-full border-r border-slate-200/20" style={{ width: COL_W / 3 }} />
                          </>
                        )}
                      </div>
                    ))}

                    {/* Línea de Hoy (Today Line) */}
                    {todayX > 0 && todayX < TOTAL_W && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left: todayX,
                          width: 2,
                          background: 'rgba(239, 68, 68, 0.75)',
                          zIndex: 10,
                          pointerEvents: 'none'
                        }}
                      />
                    )}

                    {/* Línea de Fecha de Corte / Data Date (p6 Line) */}
                    {fechaCorteX > 0 && fechaCorteX < TOTAL_W && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left: fechaCorteX,
                          width: 0,
                          borderLeft: '2.5px dotted #10b981',
                          zIndex: 12,
                          pointerEvents: 'none'
                        }}
                        title={`Fecha de Corte (p6): ${fechaCorteState.toLocaleDateString()}`}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            top: 4,
                            left: -10,
                            background: '#10b981',
                            color: '#ffffff',
                            fontSize: '7.5px',
                            fontWeight: '950',
                            padding: '1px 3px',
                            borderRadius: '3px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                            pointerEvents: 'none',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          p6
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col">{barRows}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Reporte de Atrasos Card */}
      {kpiSelected === 'atrasados' && (() => {
        const delayedHojas = actividades.filter(a => {
          if (!a.esItemHoja) return false;
          if (!a.estaAtrasadoCronograma) return false;
          if (!a.start || isNaN(a.start.getTime())) return false;
          // Exclude procura activities
          if (a.descripcion && a.descripcion.trim().toLowerCase().startsWith('procura')) return false;
          return true;
        });

        // Group by Year and then by Month
        const groupedByYearAndMonth: Record<string, Record<string, any[]>> = {};
        delayedHojas.forEach(a => {
          const yyyy = String(a.start!.getFullYear());
          const mm = String(a.start!.getMonth() + 1).padStart(2, '0');
          if (!groupedByYearAndMonth[yyyy]) {
            groupedByYearAndMonth[yyyy] = {};
          }
          if (!groupedByYearAndMonth[yyyy][mm]) {
            groupedByYearAndMonth[yyyy][mm] = [];
          }
          groupedByYearAndMonth[yyyy][mm].push(a);
        });

        const sortedYears = Object.keys(groupedByYearAndMonth).sort();

        const getMonthNameES = (mmStr: string) => {
          const months = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
          ];
          const idx = parseInt(mmStr, 10) - 1;
          return months[idx];
        };

        const toggleYear = (yr: string) => {
          setCollapsedYears(prev => {
            const current = prev[yr] !== false; // if undefined, it is collapsed (true)
            return {
              ...prev,
              [yr]: !current
            };
          });
        };

        const toggleMonth = (mKey: string) => {
          setCollapsedMonths(prev => {
            const current = prev[mKey] !== false; // if undefined, it is collapsed (true)
            return {
              ...prev,
              [mKey]: !current
            };
          });
        };

        const fmtDateString = (d: Date | null | undefined) => {
          if (!d) return '—';
          const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = months[d.getMonth()];
          const yy = String(d.getFullYear()).slice(2);
          return `${dd}-${mm}-${yy}`;
        };

        return (
          <div className="bg-white rounded-2xl shadow-sm border border-red-300 overflow-hidden animate-fade-in mt-2">
            <div className="bg-gradient-to-r from-red-50 to-orange-50 px-5 py-4 border-b border-red-200 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm text-red-950 flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                  </span>
                  📋 Reporte de Atrasos
                </h3>

              </div>
              <span className="text-[10px] bg-red-100 text-red-800 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">
                {delayedHojas.length} Items Atrasados
              </span>
            </div>

            <div className="p-4 space-y-4">
              {sortedYears.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500 font-semibold bg-gray-50 rounded-xl">
                  No se registran actividades con atraso para mostrar.
                </div>
              ) : (
                sortedYears.map(year => {
                  const monthsObj = groupedByYearAndMonth[year];
                  const sortedMonths = Object.keys(monthsObj).sort();
                  const totalYearItems = Object.values(monthsObj).reduce((sum, list) => sum + list.length, 0);
                  const isYearCollapsed = collapsedYears[year] !== false;

                  return (
                    <div key={year} className="border border-slate-200 rounded-xl overflow-hidden shadow-mini bg-white">
                      {/* Cabecera del Año */}
                      <div
                        onClick={() => toggleYear(year)}
                        className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 to-slate-100/80 hover:bg-slate-100 cursor-pointer select-none border-b border-slate-200 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {isYearCollapsed ? (
                            <ChevronRight className="w-5 h-5 text-slate-500" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-600" />
                          )}
                          <span className="font-extrabold text-xs text-slate-800 tracking-wider">
                            AÑO {year}
                          </span>
                          <span className="text-[10pt] bg-slate-200/80 text-slate-700 px-2.5 py-0.5 rounded-full font-black">
                            {totalYearItems} {totalYearItems === 1 ? 'actividad' : 'actividades'}
                          </span>
                        </div>
                      </div>

                      {/* Meses correspondientes al año */}
                      {!isYearCollapsed && (
                        <div className="p-3 space-y-3 bg-slate-50/40">
                          {sortedMonths.map(month => {
                            const monthKey = `${year}-${month}`;
                            const items = monthsObj[month];
                            const label = `${getMonthNameES(month)} ${year}`;
                            const isMonthCollapsed = collapsedMonths[monthKey] !== false;

                            return (
                              <div key={monthKey} className="border rounded-xl bg-white overflow-hidden transition-all shadow-mini border-slate-200">
                                {/* Cabecera del Mes */}
                                <div
                                  onClick={() => toggleMonth(monthKey)}
                                  className="flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 cursor-pointer select-none border-b border-slate-100"
                                >
                                  <div className="flex items-center gap-2">
                                    {isMonthCollapsed ? (
                                      <ChevronRight className="w-4 h-4 text-slate-500" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4 text-slate-600" />
                                    )}
                                    <span className="font-bold text-[11px] text-slate-700 uppercase tracking-wide">
                                      {label}
                                    </span>
                                    <span className="text-[9px] bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                                      {items.length} {items.length === 1 ? 'actividad' : 'actividades'}
                                    </span>
                                  </div>
                                </div>

                                {/* Tabla de Actividades para este Mes */}
                                {!isMonthCollapsed && (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs text-slate-700 table-auto border-collapse">
                                      <thead>
                                        <tr className="bg-slate-100 border-b border-slate-200 text-[9.5px] font-black uppercase text-slate-500 tracking-wider">
                                          <th className="px-4 py-2.5" style={{ width: '130px' }}>ID Actividad</th>
                                          <th className="px-4 py-2.5">Descripción de la Actividad</th>
                                          <th className="px-4 py-2.5 text-center" style={{ width: '110px' }}>Prog. Inicio</th>
                                          <th className="px-4 py-2.5 text-center" style={{ width: '110px' }}>Prog. Fin</th>
                                          <th className="px-4 py-2.5 text-center" style={{ width: '100px' }}>Estado</th>
                                          <th className="px-4 py-2.5 text-center" style={{ width: '90px' }}>% Avance (AT)</th>
                                          <th className="px-4 py-2.5 text-right pr-6" style={{ width: '100px' }}>Atraso (Días)</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 bg-white font-sans">
                                        {items.map(item => {
                                          const statusBg = {
                                            'Completed': 'bg-green-100 text-green-800 border-green-200',
                                            'In Progress': 'bg-blue-100 text-blue-800 border-blue-200',
                                            'Not Started': 'bg-gray-100 text-gray-500 border-gray-200'
                                          }[item.p6Status] || 'bg-orange-100 text-orange-700 border-orange-200';

                                          const statusLbl = {
                                            'Completed': 'Completado',
                                            'In Progress': 'En Curso',
                                            'Not Started': 'No inic.'
                                          }[item.p6Status] || item.p6Status || '—';

                                          const showProgress = item.p6Status === 'In Progress' || item.p6Status === 'Completed';
                                          const progressVal = item.avanceAT !== null && item.avanceAT !== undefined
                                            ? `${Math.round(item.avanceAT)}%`
                                            : '0%';

                                          return (
                                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                              <td className="px-4 py-3 font-mono text-[10.5px] font-bold text-slate-600">
                                                {item.activityId || item.wbs}
                                              </td>
                                              <td className="px-4 py-3 font-medium text-slate-900 leading-normal" title={item.descripcion}>
                                                {item.descripcion}
                                              </td>
                                              <td className="px-4 py-3 text-center font-mono text-[10px] text-slate-500">
                                                {fmtDateString(item.start)}
                                              </td>
                                              <td className="px-4 py-3 text-center font-mono text-[10px] text-slate-500">
                                                {fmtDateString(item.finish)}
                                              </td>
                                              <td className="px-4 py-3 text-center">
                                                <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black border uppercase tracking-wider ${statusBg}`}>
                                                  {statusLbl}
                                                </span>
                                              </td>
                                              <td className="px-4 py-3 text-center font-mono text-[10px] font-bold text-slate-700">
                                                {showProgress ? progressVal : '—'}
                                              </td>
                                              <td className="px-4 py-3 text-right pr-6 font-mono text-[10px] font-bold text-red-650">
                                                {item.diasAtrasoMaximo}d
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })()}

      {/* Tarjeta Colapsable: Control de Ejecución (Control Semanal PG-004 vs CDO V-) */}
      {!tipologiaSeleccionada && !partidaSeleccionada && (
        <div id="cronograma-control-ejecucion-container" className="w-full -mt-3">
          {renderBottomControl ? (
            <ControlSemanalTabla
              actividades={actividades}
              dataPlanificadoPG004={dataPlanificadoPG004}
              baseVenta={baseVenta}
            />
          ) : (
            <div className="bg-white rounded-xl p-4 border border-slate-200 text-center text-xs text-slate-400 font-medium animate-pulse">
              Cargando tabla de control de ejecución...
            </div>
          )}

      {/* Tarjeta Colapsable: Análisis de Proyecto (Visión por Paquetes SCAP a 4 semanas por Componente) */}
      {!tipologiaSeleccionada && !partidaSeleccionada && (
        <div id="cronograma-analisis-proyecto-container" className="w-full mt-3">
          <AnalisisProyectoCard
            actividades={actividades}
            dataPlanificadoPG004={dataPlanificadoPG004}
            baseVenta={baseVenta}
            fechaCorte={fechaCorteState}
          />
        </div>
      )}

      {/* Partida Seleccionada view detail */}
      {partidaSeleccionada && (
        <div className="bg-white rounded-xl shadow-sm border border-indigo-600 overflow-hidden">
          <div className="bg-blue-50 px-5 py-3 border-b flex justify-between items-center">
            <h3 className="font-bold text-blue-900">{partidaSeleccionada.replace('p.', '')} - Vista Detallada</h3>
            <button onClick={() => setPartidaSeleccionada(null)} className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 transition-colors">Volver</button>
          </div>
          
          <div className="p-4 border-b flex items-center gap-3">
            <Filter className="w-4 h-4 text-gray-400" />
            <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} className="border text-xs rounded p-1.5 bg-white">
              <option value="all">Filtro Nivel: Todos</option>
              <option value="2">Nivel 2</option>
              <option value="3">Nivel 3</option>
              <option value="4">Nivel 4</option>
            </select>
            <select value={filterTipologia} onChange={e => setFilterTipologia(e.target.value)} className="border text-xs rounded p-1.5 bg-white">
              <option value="all">Filtro Tipo: Todas</option>
              {tipologiasDisponibles.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto text-xs">
            {filteredActividades
              .filter(a => {
                const suf = a.wbs.replace(/^p\d*\.?/, '');
                const nivelUnoItem = suf.split('.')[0];
                const nivelUnoSeleccionado = partidaSeleccionada.replace('p.', '');
                return nivelUnoItem === nivelUnoSeleccionado;
              })
              .map(item => renderActividadItem(item))}
          </div>
        </div>
      )}

      {/* Modal Reporte de Equipos */}
      {eqReportOpen && (() => {
        const cleanWbs = (w: string) => (w || '').replace(/^p\d*\.?/, '').trim();

        // Mapa para resolver la descripción de cada WBS limpia (p.ej. "12.5.1.B.31.29" -> "Celda de medicion principal de 13.8 kv")
        const wbsNameMap: Record<string, string> = {};
        
        const cleanDescription = (desc: string) => {
          if (!desc) return '';
          let cleaned = desc.replace(/procura\s+de\s+/gi, '').trim();
          if (cleaned.length > 0) {
            cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
          }
          return cleaned;
        };

        actividades.forEach(a => {
          if (!a.esItemHoja) {
            const cw = cleanWbs(a.wbs);
            if (cw && a.descripcion) {
              wbsNameMap[cw] = cleanDescription(a.descripcion);
            }
          }
        });

        // Completar descripciones de WBS faltantes usando como fallback las partidas/hojas directas
        actividades.forEach(a => {
          const cw = cleanWbs(a.wbs);
          if (cw && !wbsNameMap[cw] && a.descripcion) {
            wbsNameMap[cw] = cleanDescription(a.descripcion);
          }
        });

        const isSubcontratistaValido = (sub: string | null | undefined): boolean => {
          if (!sub) return false;
          const s = sub.trim().toLowerCase();
          if (s === '' || s === 'sin contratista' || s.includes('sin contratista') || s.includes('por contratar') || s.includes('pendiente') || s.includes('sin subcontratista') || s === 'general / sin contratista') {
            return false;
          }
          return true;
        };

        const computeAggregatedMetrics = (itemList: any[]) => {
          let minStart: Date | null = null;
          let maxFinish: Date | null = null;

          const qtyByIdOrig = new Map<string, { qty: number; unit: string }>();
          let noIdOrigCounter = 0;

          itemList.forEach(it => {
            const key = it.idOrig ? String(it.idOrig).trim() : `__no_id_${noIdOrigCounter++}`;
            const qty = (it.cantidadCdo !== undefined && it.cantidadCdo !== null) ? it.cantidadCdo : 0;
            const u = String(it.unidad || it.unit || '').trim();

            const existing = qtyByIdOrig.get(key);
            if (!existing || qty > existing.qty) {
              qtyByIdOrig.set(key, { qty, unit: u });
            }

            if (it.start) {
              const s = new Date(it.start);
              if (!isNaN(s.getTime())) {
                if (!minStart || s < minStart) minStart = s;
              }
            }
            if (it.finish) {
              const f = new Date(it.finish);
              if (!isNaN(f.getTime())) {
                if (!maxFinish || f > maxFinish) maxFinish = f;
              }
            }
          });

          const qtyByUnit = new Map<string, number>();
          qtyByIdOrig.forEach(({ qty, unit }) => {
            qtyByUnit.set(unit, (qtyByUnit.get(unit) || 0) + qty);
          });

          const formatSpanishResumenDate = (dt: Date | null) => {
            if (!dt) return '';
            const day = String(dt.getDate()).padStart(2, '0');
            const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
            const month = months[dt.getMonth()];
            const year = String(dt.getFullYear()).slice(2);
            return `${day}.${month}.${year}`;
          };

          const rangeText = (minStart && maxFinish) ? `${formatSpanishResumenDate(minStart)} a ${formatSpanishResumenDate(maxFinish)}` : '';
          
          const parts: string[] = [];
          qtyByUnit.forEach((totalQty, unit) => {
            if (totalQty > 0) {
              parts.push(`${totalQty.toLocaleString('es-ES')} ${unit || 'u'}`);
            }
          });
          const cantText = parts.length > 0 ? parts.join(', ') : '';

          let totalCant = 0;
          qtyByUnit.forEach(qty => {
            totalCant += qty;
          });

          return { totalCant, cantText, rangeText, minStart, maxFinish };
        };

        const getWbsName = (wbs: string) => {
          const cw = cleanWbs(wbs);
          return wbsNameMap[cw] || cw || 'General / Otros';
        };

        const isEquipmentActivity = (a: any) => {
          if (!a.esItemHoja) return false;

          const scapLower = String(a.scap || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          const isValvula = scapLower === 'valvulas' || /valvul/i.test(scapLower);

          // Excluir equipos/paquetes con activityId conteniendo 'p6', EXCEPTO para SCAP de válvulas
          const actId = (a.activityId || '').toLowerCase();
          const pId = (a.id || '').toLowerCase();
          if (!isValvula && (actId.includes('p6') || pId.includes('p6'))) {
            return false;
          }

          // Excluir bloque p.D "Actividades pendientes de confirmar por el Ingeniero" (excepto válvulas)
          if (!isValvula) {
            const rawWbs = a.wbs || '';
            const wbs = rawWbs.replace(/^p\d{4}\./, 'p.');
            if (wbs.startsWith('p.D') || wbs.toLowerCase().startsWith('pd')) return false;
          }

          // Excluir actividades de procura (procura, procurement) pero mantener las de "compra" o "adquisición"
          const descLower = (a.descripcion || '').toLowerCase();
          if (
            descLower.startsWith('procura') || 
            descLower.includes('procura') || 
            descLower.includes('procurement')
          ) {
            return false;
          }

          const tipoName = (a.tipo || '').toLowerCase();
          const isElectrico = tipoName.includes('electrico') || tipoName.includes('eléctrico') || tipoName.includes('electrica') || tipoName.includes('eléctrica');
          const isMecanico = tipoName.includes('mecanico') || tipoName.includes('mecánico');
          const isInstrumentacion = tipoName.includes('instrumentacion') || tipoName.includes('instrumentación') || tipoName.includes('control');
          
          if (!isElectrico && !isMecanico && !isInstrumentacion) return false;
          
          const status = (a.p6Status || a.status || '').toLowerCase();
          const isEnCurso = status === 'in progress' || status.includes('curso') || status.includes('progreso');
          const isNoInecido = status === 'not started' || status.includes('iniciado') || status.includes('inicio');
          
          return isEnCurso || isNoInecido;
        };

        const matchesTipo = (it: any) => {
          if (eqTipoFilter === 'all') return true;
          const t = (it.tipo || '').toLowerCase();
          if (eqTipoFilter === 'electrico') {
            return t.includes('electrico') || t.includes('eléctrico') || t.includes('electrica') || t.includes('eléctrica');
          }
          if (eqTipoFilter === 'mecanico') {
            return t.includes('mecanico') || t.includes('mecánico');
          }
          if (eqTipoFilter === 'instrumentacion') {
            return t.includes('instrumentacion') || t.includes('instrumentación') || t.includes('control');
          }
          return true;
        };

        const getUniqueEquipmentKey = (desc: string) => {
          if (!desc) return '';
          let clean = desc.trim();
          
          const separators = [" - ", " – ", " — ", " | ", " : "];
          for (const sep of separators) {
            const parts = clean.split(sep);
            if (parts.length > 1) {
              const firstPart = parts[0].trim();
              if (firstPart.length > 3) {
                clean = firstPart;
                break;
              }
            }
          }

          const prefixesToRemove = [
            /^(suministro y montaje de|suministro y montaje|suministro de|suministro e instalación|suministro e instalacion|instalación de|instalacion de|montaje de|compra de|flete de|adquisicion de|adquisición de|fabricacion de|fabricación de|pruebas de|comisionamiento de)\s+/i
          ];
          for (const rx of prefixesToRemove) {
            clean = clean.replace(rx, '');
          }

          const suffixesToRemove = [
            /\s*[\(\[].*?(compra|fabricación|fabricacion|flete|instalacion|instalación|suministro|montaje|pruebas|fat|adquisición|adquisicion)[\)\]]/i,
            /\s+(compra|fabricación|fabricacion|flete|instalacion|instalación|suministro|montaje|pruebas|fat|adquisición|adquisicion)$/i
          ];
          for (const rx of suffixesToRemove) {
            clean = clean.replace(rx, '');
          }

          return clean.trim();
        };

        const getUniqueEquipmentsList = (actList: any[]) => {
          const map: Record<string, {
            key: string;
            descripcion: string;
            tipo: string;
            subcontratista: string;
            status: string;
            activities: any[];
          }> = {};

          actList.forEach(it => {
            const cw = cleanWbs(it.wbs);
            const key = cw.toLowerCase();
            if (!key) return;

            const subVal = (it.subcontratista || '').trim();
            const validSub = isSubcontratistaValido(subVal) ? subVal : '';

            if (!map[key]) {
              map[key] = {
                key,
                descripcion: getWbsName(it.wbs) || it.descripcion,
                tipo: it.tipo || 'Otros',
                subcontratista: validSub,
                status: 'not started',
                activities: []
              };
            }

            if (validSub && !map[key].subcontratista) {
              map[key].subcontratista = validSub;
            }

            const itemTipo = it.tipo || '';
            if (itemTipo && (!map[key].tipo || map[key].tipo === 'Otros')) {
              map[key].tipo = itemTipo;
            }

            const s = (it.p6Status || it.status || '').toLowerCase();
            if (s === 'in progress' || s.includes('curso') || s.includes('progreso')) {
              map[key].status = 'in progress';
            }

            map[key].activities.push(it);
          });

          return Object.values(map);
        };

        const rawList = actividades.filter(isEquipmentActivity);
        const uniqueRawList = getUniqueEquipmentsList(rawList);

        const countMecanico = uniqueRawList.filter(eq => {
          const t = eq.tipo.toLowerCase();
          return t.includes('mecanico') || t.includes('mecánico');
        }).length;
        const countElectrico = uniqueRawList.filter(eq => {
          const t = eq.tipo.toLowerCase();
          return t.includes('electrico') || t.includes('eléctrico') || t.includes('electrica') || t.includes('eléctrica');
        }).length;
        const countIandC = uniqueRawList.filter(eq => {
          const t = eq.tipo.toLowerCase();
          return t.includes('instrumentacion') || t.includes('instrumentación') || t.includes('control');
        }).length;

        const list = rawList.filter(matchesTipo);

        // Unique subcontractors list for selector
        const allSubCs = Array.from(new Set(
          list
            .map(it => (it.subcontratista || '').trim())
            .filter(isSubcontratistaValido)
        )).sort();

        // Statistics over unique equipments of filtered list
        const uniqueList = getUniqueEquipmentsList(list);
        const totalEquip = uniqueList.length;
        const countContratados = uniqueList.filter(eq => isSubcontratistaValido(eq.subcontratista)).length;
        const countPorContratar = uniqueList.filter(eq => !isSubcontratistaValido(eq.subcontratista)).length;
        const countEnCurso = uniqueList.filter(eq => eq.status === 'in progress').length;
        const countNoIniciado = uniqueList.filter(eq => eq.status !== 'in progress').length;

        // Pendientes por contratar por disciplina (unfiltered by tipologia to stay constant)
        const pendingMecanico = uniqueRawList.filter(eq => {
          if (isSubcontratistaValido(eq.subcontratista)) return false;
          const t = eq.tipo.toLowerCase();
          return t.includes('mecanico') || t.includes('mecánico');
        }).length;
        const pendingElectrico = uniqueRawList.filter(eq => {
          if (isSubcontratistaValido(eq.subcontratista)) return false;
          const t = eq.tipo.toLowerCase();
          return t.includes('electrico') || t.includes('eléctrico') || t.includes('electrica') || t.includes('eléctrica');
        }).length;
        const pendingIandC = uniqueRawList.filter(eq => {
          if (isSubcontratistaValido(eq.subcontratista)) return false;
          const t = eq.tipo.toLowerCase();
          return t.includes('instrumentacion') || t.includes('instrumentación') || t.includes('control');
        }).length;

        const subcMapByWbs: Record<string, string> = {};
        uniqueList.forEach(eq => {
          subcMapByWbs[eq.key] = eq.subcontratista;
        });

        // Grouping
        const grouped: Record<string, any[]> = {
          'Por Contratar': [],
          'Contratados': []
        };
        list.forEach(item => {
          const cwKey = cleanWbs(item.wbs).toLowerCase();
          const resolvedSubC = subcMapByWbs[cwKey] || '';
          const scKey = isSubcontratistaValido(resolvedSubC) ? 'Contratados' : 'Por Contratar';
          grouped[scKey].push(item);
        });

        // Filtering
        const filteredGrouped: Record<string, any[]> = {};
        Object.entries(grouped).forEach(([groupName, items]) => {
          if (eqSubCFilter === 'Por Contratar' && groupName !== 'Por Contratar') return;
          if (eqSubCFilter !== 'all' && eqSubCFilter !== 'Por Contratar' && groupName !== 'Contratados') return;

          const matchedItems = items.filter(it => {
            if (eqSubCFilter !== 'all' && eqSubCFilter !== 'Por Contratar' && eqSubCFilter !== 'Contratados') {
              if ((it.subcontratista || '').trim() !== eqSubCFilter) return false;
            }

            const query = eqSearchQuery.toLowerCase().trim();
            if (!query) return true;
            const wName = getWbsName(it.wbs).toLowerCase();
            const sub = (it.subcontratista || '').toLowerCase();
            return it.descripcion.toLowerCase().includes(query) || 
                   sub.includes(query) || 
                   (it.tipo || '').toLowerCase().includes(query) || 
                   wName.includes(query) || 
                   cleanWbs(it.wbs).toLowerCase().includes(query);
          });

          if (matchedItems.length > 0) {
            filteredGrouped[groupName] = matchedItems;
          }
        });

        const getExpectedPhaseText = (startStr: any, finishStr: any) => {
          const parseDate = (d: any): Date | null => {
            if (d instanceof Date && !isNaN(d.getTime())) return d;
            if (typeof d === 'string') {
              const t = Date.parse(d);
              if (!isNaN(t)) return new Date(t);
            }
            return null;
          };

          const s = parseDate(startStr);
          const f = parseDate(finishStr);
          
          if (!s || !f) {
            return {
              phase: "Fechas no definidas en Primavera P6",
              badge: "bg-slate-100 text-slate-600",
              percent: 0,
              colorClass: "text-slate-500",
              phaseKey: "no-dates"
            };
          }

          const refDate = new Date("2026-05-28"); // today's reference date as per environment context
          
          if (refDate < s) {
            const daysToStart = Math.ceil((s.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
            return {
              phase: `Planificación Previa (Inicia en ${daysToStart} días - ${s.toLocaleDateString('es-ES', {day: 'numeric', month: 'short'})})`,
              badge: "bg-blue-50 text-blue-700 border border-blue-200",
              percent: 0,
              colorClass: "text-blue-600 font-semibold",
              phaseKey: "previa"
            };
          }

          if (refDate > f) {
            const daysOverdue = Math.ceil((refDate.getTime() - f.getTime()) / (1000 * 60 * 60 * 24));
            return {
              phase: `Completo / Debería estar entregado (Fin planeado hace ${daysOverdue} días - ${f.toLocaleDateString('es-ES', {day: 'numeric', month: 'short'})})`,
              badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
              percent: 100,
              colorClass: "text-emerald-600 font-semibold",
              phaseKey: "completado"
            };
          }

          // Today is between start and finish
          const totalDur = f.getTime() - s.getTime();
          const elapsed = refDate.getTime() - s.getTime();
          const ratio = totalDur > 0 ? (elapsed / totalDur) : 0;
          const pct = Math.min(100, Math.max(0, Math.round(ratio * 100)));

          let phaseString = "";
          let badgeClass = "";
          let phaseKey = "";
          if (pct <= 15) {
            phaseString = `Ingeniería Inicial / Aprobación de Planos (Esperado: ${pct}%)`;
            badgeClass = "bg-sky-50 text-sky-700 border border-sky-200";
            phaseKey = "ingenieria";
          } else if (pct <= 40) {
            phaseString = `Procura de Componentes y Suministros (Esperado: ${pct}%)`;
            badgeClass = "bg-indigo-50 text-indigo-700 border border-indigo-200";
            phaseKey = "procura";
          } else if (pct <= 75) {
            phaseString = `Fabricación Activa en Taller (Debería estar fabricado o en fases finales: ${pct}%)`;
            badgeClass = "bg-amber-50 text-amber-700 border border-amber-200";
            phaseKey = "fabricacion";
          } else if (pct <= 90) {
            phaseString = `Ensamble Final y Pruebas FAT de Taller (Esperado: ${pct}%)`;
            badgeClass = "bg-orange-50 text-orange-700 border border-orange-200";
            phaseKey = "pruebas";
          } else {
            phaseString = `Pruebas Finales superadas, Despacho / En Tránsito (Esperado: ${pct}%)`;
            badgeClass = "bg-purple-50 text-purple-700 border border-purple-200";
            phaseKey = "transito";
          }

          return {
            phase: phaseString,
            badge: badgeClass,
            percent: pct,
            colorClass: "text-indigo-650 font-bold",
            phaseKey
          };
        };

        // Plaintext report & Hierarchical HTML/CSV report generator
        let plainTextReport = `======================================================================\n`;
        plainTextReport += `📋 REPORTE DE CONTROL DE EQUIPOS - EVALUACIÓN AL: 28/05/2026\n`;
        plainTextReport += `JERARQUÍA: [Nivel 1: Grupo] ➔ [Nivel 2: Contratista] ➔ [Nivel 3: Paquete] ➔ [Nivel 4: WBS / Equipo]\n`;
        plainTextReport += `(Excluye Actividades de Procura)\n`;
        plainTextReport += `======================================================================\n\n`;

        let htmlRows = ``;
        const csvRows: string[][] = [
          ['Nivel_Jerarquico', 'Jerarquia_Completa', 'Grupo', 'Contratista', 'Paquete_SCAP', 'Codigo_WBS', 'Nombre_WBS', 'Equipos_Unicos', 'Cantidad_Total', 'Unidad', 'Fecha_Inicio', 'Fecha_Fin']
        ];

        Object.entries(filteredGrouped).forEach(([subC, matchedItems]) => {
          const isContratadosReport = subC === 'Contratados';
          const uniqueEqCount = Array.from(new Set(matchedItems.map(it => cleanWbs(it.wbs).toLowerCase()))).length;
          
          const grupoName = subC.toUpperCase();

          // NIVEL 1: GRUPO
          plainTextReport += `[NIVEL 1 - GRUPO] 🏗️ GRUPO: ${grupoName} (${uniqueEqCount} Equipos Únicos)\n`;
          plainTextReport += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

          htmlRows += `
            <tr style="background: #0f172a; color: #ffffff; font-weight: 800; border-bottom: 2px solid #334155;">
              <td style="padding: 10px 12px; font-size: 11px; background: #1e293b; color: #f59e0b; font-weight: 900; width: 140px; text-transform: uppercase;">NIVEL 1 (GRUPO)</td>
              <td style="padding: 10px 12px; font-size: 13px;">🏗️ GRUPO: ${grupoName} (${uniqueEqCount} Equipos Únicos)</td>
              <td style="padding: 10px 12px; text-align: right; font-weight: 800; font-size: 11px;">—</td>
              <td style="padding: 10px 12px; text-align: center; color: #cbd5e1; font-size: 11px;">—</td>
            </tr>
          `;

          csvRows.push(['Nivel 1 - Grupo', `GRUPO: ${grupoName}`, grupoName, '', '', '', '', String(uniqueEqCount), '', '', '', '']);

          if (isContratadosReport) {
            // Group by actual subcontratista
            const subCGroups: Record<string, any[]> = {};
            matchedItems.forEach(it => {
              const subName = (it.subcontratista || '').trim() || 'General / Sin Contratista';
              if (!subCGroups[subName]) {
                subCGroups[subName] = [];
              }
              subCGroups[subName].push(it);
            });

            Object.entries(subCGroups).forEach(([subName, subItems]) => {
              const subUniqueEqCount = Array.from(new Set(subItems.map(it => cleanWbs(it.wbs).toLowerCase()))).length;
              const subUpper = subName.toUpperCase();

              // NIVEL 2: CONTRATISTA
              plainTextReport += `  │\n`;
              plainTextReport += `  ├─► [NIVEL 2 - CONTRATISTA] 🏭 CONTRATISTA: ${subUpper} (${subUniqueEqCount} Equipos Únicos)\n`;
              plainTextReport += `  │   ----------------------------------------------------------------\n`;

              htmlRows += `
                <tr style="background: #064e3b; color: #ffffff; font-weight: 700; border-bottom: 1px solid #047857;">
                  <td style="padding: 8px 12px 8px 20px; font-size: 10px; background: #065f46; color: #a7f3d0; font-weight: 800; text-transform: uppercase;">NIVEL 2 (CONTRATISTA)</td>
                  <td style="padding: 8px 12px 8px 24px; font-size: 12px;">🏭 CONTRATISTA: ${subUpper} (${subUniqueEqCount} Equipos Únicos)</td>
                  <td style="padding: 8px 12px; text-align: right; font-weight: 700; font-size: 11px;">—</td>
                  <td style="padding: 8px 12px; text-align: center; color: #a7f3d0; font-size: 11px;">—</td>
                </tr>
              `;

              csvRows.push(['Nivel 2 - Contratista', `CONTRATISTA: ${subUpper}`, grupoName, subUpper, '', '', '', String(subUniqueEqCount), '', '', '', '']);

              // Group by Paquete (scap)
              const scapTree: Record<string, any[]> = {};
              subItems.forEach(it => {
                const sc = it.scap || 'General / Sin SCAP';
                if (!scapTree[sc]) {
                  scapTree[sc] = [];
                }
                scapTree[sc].push(it);
              });

              Object.entries(scapTree).forEach(([scapName, scapItems]) => {
                const scapUniqueEqCount = Array.from(new Set(scapItems.map(it => cleanWbs(it.wbs).toLowerCase()))).length;
                const scapUpper = scapName.toUpperCase();

                // NIVEL 3: PAQUETE
                plainTextReport += `  │   │\n`;
                plainTextReport += `  │   ├──► [NIVEL 3 - PAQUETE] 🔷 PAQUETE / SCAP: ${scapUpper} (${scapUniqueEqCount} Equipos Únicos)\n`;

                htmlRows += `
                  <tr style="background: #eff6ff; color: #1e40af; font-weight: 700; border-bottom: 1px solid #bfdbfe;">
                    <td style="padding: 7px 12px 7px 32px; font-size: 10px; background: #dbeafe; color: #1d4ed8; font-weight: 800; text-transform: uppercase;">NIVEL 3 (PAQUETE)</td>
                    <td style="padding: 7px 12px 7px 36px; font-size: 11.5px;">🔷 PAQUETE / SCAP: ${scapUpper} (${scapUniqueEqCount} Equipos Únicos)</td>
                    <td style="padding: 7px 12px; text-align: right; font-weight: 700; font-size: 11px;">—</td>
                    <td style="padding: 7px 12px; text-align: center; color: #1d4ed8; font-size: 11px;">—</td>
                  </tr>
                `;

                csvRows.push(['Nivel 3 - Paquete', `PAQUETE: ${scapUpper}`, grupoName, subUpper, scapUpper, '', '', String(scapUniqueEqCount), '', '', '', '']);

                // Agrupado interno por WBS limpia
                const wbsTree: Record<string, { wbsName: string; items: any[] }> = {};
                scapItems.forEach(it => {
                  const cw = cleanWbs(it.wbs);
                  const wName = getWbsName(it.wbs);
                  if (!wbsTree[cw]) {
                    wbsTree[cw] = { wbsName: wName, items: [] };
                  }
                  wbsTree[cw].items.push(it);
                });

                Object.entries(wbsTree).forEach(([cwKey, val]) => {
                  const uniqueIdOrigs = Array.from(new Set(val.items.map(it => it.idOrig).filter(Boolean)));
                  const wbsUniqueEqCount = uniqueIdOrigs.length > 0 ? uniqueIdOrigs.length : 1;

                  let totalCant = 0;
                  const units = new Set<string>();
                  let minStart: Date | null = null;
                  let maxFinish: Date | null = null;

                  const qtyByIdOrig = new Map<string, number>();
                  let noIdOrigCounter = 0;

                  val.items.forEach(it => {
                    const key = it.idOrig ? String(it.idOrig).trim() : `__no_id_${noIdOrigCounter++}`;
                    const qty = (it.cantidadCdo !== undefined && it.cantidadCdo !== null) ? it.cantidadCdo : 0;
                    const existing = qtyByIdOrig.get(key) || 0;
                    if (qty > existing) {
                      qtyByIdOrig.set(key, qty);
                    }
                    const u = it.unidad || it.unit;
                    if (u) {
                      units.add(String(u).trim());
                    }
                    if (it.start) {
                      const s = new Date(it.start);
                      if (!isNaN(s.getTime())) {
                        if (!minStart || s < minStart) minStart = s;
                      }
                    }
                    if (it.finish) {
                      const f = new Date(it.finish);
                      if (!isNaN(f.getTime())) {
                        if (!maxFinish || f > maxFinish) maxFinish = f;
                      }
                    }
                  });

                  qtyByIdOrig.forEach(qty => {
                    totalCant += qty;
                  });

                  const formatSpanishResumenDate = (dt: Date | null) => {
                    if (!dt) return '';
                    const day = String(dt.getDate()).padStart(2, '0');
                    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
                    const month = months[dt.getMonth()];
                    const year = String(dt.getFullYear()).slice(2);
                    return `${day}.${month}.${year}`;
                  };

                  const rangeText = (minStart && maxFinish) ? `${formatSpanishResumenDate(minStart)} a ${formatSpanishResumenDate(maxFinish)}` : '—';
                  const unitStr = units.size > 0 ? Array.from(units).join(', ') : 'glb';
                  const cantText = totalCant > 0 ? `${totalCant.toLocaleString('es-ES')} ${unitStr}`.trim() : '—';

                  // NIVEL 4: WBS / EQUIPO
                  plainTextReport += `  │   │   │\n`;
                  plainTextReport += `  │   │   └──► [NIVEL 4 - WBS / EQUIPO] 📦 WBS: ${val.wbsName.toUpperCase()} (Código WBS: ${cwKey}) (${wbsUniqueEqCount} Equipos)\n`;
                  if (cantText !== '—' || rangeText !== '—') {
                    plainTextReport += `  │   │          • Cantidad Total: ${cantText} | Programación: ${rangeText}\n`;
                  }

                  htmlRows += `
                    <tr style="background: #ffffff; color: #1e293b; border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 6px 12px 6px 44px; font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">NIVEL 4 (WBS)</td>
                      <td style="padding: 6px 12px 6px 48px; font-size: 11px;">📦 <strong>${val.wbsName.toUpperCase()}</strong> <span style="color: #64748b; font-size: 10px;">(WBS: ${cwKey}) [${wbsUniqueEqCount} eq]</span></td>
                      <td style="padding: 6px 12px; text-align: right; font-weight: 600; font-size: 11px; color: #0f172a;">${cantText}</td>
                      <td style="padding: 6px 12px; text-align: center; color: #475569; font-size: 11px;">${rangeText}</td>
                    </tr>
                  `;

                  csvRows.push([
                    'Nivel 4 - WBS/Equipo',
                    `WBS: ${val.wbsName} (${cwKey})`,
                    grupoName,
                    subUpper,
                    scapUpper,
                    cwKey,
                    val.wbsName,
                    String(wbsUniqueEqCount),
                    String(totalCant),
                    unitStr,
                    minStart ? minStart.toISOString().slice(0, 10) : '',
                    maxFinish ? maxFinish.toISOString().slice(0, 10) : ''
                  ]);
                });
              });
              plainTextReport += `\n`;
            });
          } else {
            // "Por Contratar"
            const subUpper = 'POR CONTRATAR';

            // NIVEL 2: CONTRATISTA
            plainTextReport += `  │\n`;
            plainTextReport += `  ├─► [NIVEL 2 - CONTRATISTA] 🏭 CONTRATISTA: POR CONTRATAR (Pendiente de adjudicación)\n`;
            plainTextReport += `  │   ----------------------------------------------------------------\n`;

            htmlRows += `
              <tr style="background: #78350f; color: #ffffff; font-weight: 700; border-bottom: 1px solid #92400e;">
                <td style="padding: 8px 12px 8px 20px; font-size: 10px; background: #92400e; color: #fef3c7; font-weight: 800; text-transform: uppercase;">NIVEL 2 (CONTRATISTA)</td>
                <td style="padding: 8px 12px 8px 24px; font-size: 12px;">🏭 CONTRATISTA: POR CONTRATAR (Pendiente de adjudicación)</td>
                <td style="padding: 8px 12px; text-align: right; font-weight: 700; font-size: 11px;">—</td>
                <td style="padding: 8px 12px; text-align: center; color: #fef3c7; font-size: 11px;">—</td>
              </tr>
            `;

            csvRows.push(['Nivel 2 - Contratista', 'CONTRATISTA: POR CONTRATAR', grupoName, 'Por Contratar', '', '', '', String(uniqueEqCount), '', '', '', '']);

            const scapTree: Record<string, any[]> = {};
            matchedItems.forEach(it => {
              const sc = it.scap || 'General / Sin SCAP';
              if (!scapTree[sc]) {
                scapTree[sc] = [];
              }
              scapTree[sc].push(it);
            });

            Object.entries(scapTree).forEach(([scapName, scapItems]) => {
              const scapUniqueEqCount = Array.from(new Set(scapItems.map(it => cleanWbs(it.wbs).toLowerCase()))).length;
              const scapUpper = scapName.toUpperCase();

              // NIVEL 3: PAQUETE
              plainTextReport += `  │   │\n`;
              plainTextReport += `  │   ├──► [NIVEL 3 - PAQUETE] 🔷 PAQUETE / SCAP: ${scapUpper} (${scapUniqueEqCount} Equipos Únicos)\n`;

              htmlRows += `
                <tr style="background: #fef3c7; color: #92400e; font-weight: 700; border-bottom: 1px solid #fde68a;">
                  <td style="padding: 7px 12px 7px 32px; font-size: 10px; background: #fde68a; color: #78350f; font-weight: 800; text-transform: uppercase;">NIVEL 3 (PAQUETE)</td>
                  <td style="padding: 7px 12px 7px 36px; font-size: 11.5px;">🔷 PAQUETE / SCAP: ${scapUpper} (${scapUniqueEqCount} Equipos Únicos)</td>
                  <td style="padding: 7px 12px; text-align: right; font-weight: 700; font-size: 11px;">—</td>
                  <td style="padding: 7px 12px; text-align: center; color: #92400e; font-size: 11px;">—</td>
                </tr>
              `;

              csvRows.push(['Nivel 3 - Paquete', `PAQUETE: ${scapUpper}`, grupoName, 'Por Contratar', scapUpper, '', '', String(scapUniqueEqCount), '', '', '', '']);

              const wbsTree: Record<string, { wbsName: string; items: any[] }> = {};
              scapItems.forEach(it => {
                const cw = cleanWbs(it.wbs);
                const wName = getWbsName(it.wbs);
                if (!wbsTree[cw]) {
                  wbsTree[cw] = { wbsName: wName, items: [] };
                }
                wbsTree[cw].items.push(it);
              });

              Object.entries(wbsTree).forEach(([cwKey, val]) => {
                const uniqueIdOrigs = Array.from(new Set(val.items.map(it => it.idOrig).filter(Boolean)));
                const wbsUniqueEqCount = uniqueIdOrigs.length > 0 ? uniqueIdOrigs.length : 1;

                let totalCant = 0;
                const units = new Set<string>();
                let minStart: Date | null = null;
                let maxFinish: Date | null = null;

                const qtyByIdOrig = new Map<string, number>();
                let noIdOrigCounter = 0;

                val.items.forEach(it => {
                  const key = it.idOrig ? String(it.idOrig).trim() : `__no_id_${noIdOrigCounter++}`;
                  const qty = (it.cantidadCdo !== undefined && it.cantidadCdo !== null) ? it.cantidadCdo : 0;
                  const existing = qtyByIdOrig.get(key) || 0;
                  if (qty > existing) {
                    qtyByIdOrig.set(key, qty);
                  }
                  const u = it.unidad || it.unit;
                  if (u) {
                    units.add(String(u).trim());
                  }
                  if (it.start) {
                    const s = new Date(it.start);
                    if (!isNaN(s.getTime())) {
                      if (!minStart || s < minStart) minStart = s;
                    }
                  }
                  if (it.finish) {
                    const f = new Date(it.finish);
                    if (!isNaN(f.getTime())) {
                      if (!maxFinish || f > maxFinish) maxFinish = f;
                    }
                  }
                });

                qtyByIdOrig.forEach(qty => {
                  totalCant += qty;
                });

                const formatSpanishResumenDate = (dt: Date | null) => {
                  if (!dt) return '';
                  const day = String(dt.getDate()).padStart(2, '0');
                  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
                  const month = months[dt.getMonth()];
                  const year = String(dt.getFullYear()).slice(2);
                  return `${day}.${month}.${year}`;
                };

                const rangeText = (minStart && maxFinish) ? `${formatSpanishResumenDate(minStart)} a ${formatSpanishResumenDate(maxFinish)}` : '—';
                const unitStr = units.size > 0 ? Array.from(units).join(', ') : 'glb';
                const cantText = totalCant > 0 ? `${totalCant.toLocaleString('es-ES')} ${unitStr}`.trim() : '—';

                // NIVEL 4: WBS / EQUIPO
                plainTextReport += `  │   │   │\n`;
                plainTextReport += `  │   │   └──► [NIVEL 4 - WBS / EQUIPO] 📦 WBS: ${val.wbsName.toUpperCase()} (Código WBS: ${cwKey}) (${wbsUniqueEqCount} Equipos)\n`;
                if (cantText !== '—' || rangeText !== '—') {
                  plainTextReport += `  │   │          • Cantidad Total: ${cantText} | Programación: ${rangeText}\n`;
                }

                htmlRows += `
                  <tr style="background: #ffffff; color: #1e293b; border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 6px 12px 6px 44px; font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">NIVEL 4 (WBS)</td>
                    <td style="padding: 6px 12px 6px 48px; font-size: 11px;">📦 <strong>${val.wbsName.toUpperCase()}</strong> <span style="color: #64748b; font-size: 10px;">(WBS: ${cwKey}) [${wbsUniqueEqCount} eq]</span></td>
                    <td style="padding: 6px 12px; text-align: right; font-weight: 600; font-size: 11px; color: #0f172a;">${cantText}</td>
                    <td style="padding: 6px 12px; text-align: center; color: #475569; font-size: 11px;">${rangeText}</td>
                  </tr>
                `;

                csvRows.push([
                  'Nivel 4 - WBS/Equipo',
                  `WBS: ${val.wbsName} (${cwKey})`,
                  grupoName,
                  'Por Contratar',
                  scapUpper,
                  cwKey,
                  val.wbsName,
                  String(wbsUniqueEqCount),
                  String(totalCant),
                  unitStr,
                  minStart ? minStart.toISOString().slice(0, 10) : '',
                  maxFinish ? maxFinish.toISOString().slice(0, 10) : ''
                ]);
              });
            });
            plainTextReport += `\n`;
          }
          plainTextReport += `\n`;
        });

        const fullHtmlReport = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reporte Jerárquico de Control de Equipos</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #0f172a; margin: 20px; padding: 0; }
    table { width: 100%; border-collapse: collapse; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #cbd5e1; }
    th { background: #0f172a; color: #ffffff; font-weight: 800; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
  </style>
</head>
<body>
  <div style="background: #0f172a; color: #ffffff; padding: 16px 20px; border-radius: 12px 12px 0 0;">
    <h2 style="margin: 0; font-size: 16px; font-weight: 900;">📋 REPORTE DE CONTROL DE EQUIPOS - ESTRUCTURA JERÁRQUICA</h2>
    <p style="margin: 4px 0 0 0; font-size: 11px; color: #cbd5e1;">Corte: 28 de Mayo, 2026 | Leyenda: N1 (Grupo) ➔ N2 (Contratista) ➔ N3 (Paquete / SCAP) ➔ N4 (WBS / Equipo)</p>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 140px;">NIVEL JERÁRQUICO</th>
        <th>ELEMENTO / DESCRIPCIÓN</th>
        <th style="width: 140px; text-align: right;">CANTIDAD TOTAL</th>
        <th style="width: 180px; text-align: center;">PROGRAMACIÓN</th>
      </tr>
    </thead>
    <tbody>
      ${htmlRows}
    </tbody>
  </table>
</body>
</html>`;

        const handleCopyTextDirect = async () => {
          try {
            if (navigator.clipboard && window.ClipboardItem) {
              const textBlob = new Blob([plainTextReport], { type: 'text/plain' });
              const htmlBlob = new Blob([fullHtmlReport], { type: 'text/html' });
              await navigator.clipboard.write([
                new ClipboardItem({
                  'text/plain': textBlob,
                  'text/html': htmlBlob,
                })
              ]);
            } else {
              await navigator.clipboard.writeText(plainTextReport);
            }
            setCopiedAlert(true);
            setTimeout(() => setCopiedAlert(false), 2200);
          } catch (err) {
            navigator.clipboard.writeText(plainTextReport);
            setCopiedAlert(true);
            setTimeout(() => setCopiedAlert(false), 2200);
          }
        };

        const handleDownloadCsvDirect = () => {
          const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
          const csvContent = csvRows.map(row => row.map(esc).join(';')).join('\r\n');
          const b64 = btoa(unescape(encodeURIComponent('\uFEFF' + csvContent)));
          const a = document.createElement('a');
          a.href = `data:text/csv;charset=utf-8;base64,${b64}`;
          a.download = `Reporte_Equipos_Jerarquico_${new Date().toISOString().slice(0, 10)}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        };

        const executeSendMessage = async (textToSend: string) => {
          const trimmed = textToSend.trim();
          if (!trimmed) return;

          setEqAiError(null);
          setEqAiLoading(true);

          // Append user message
          const userMsg = { role: 'user' as const, content: trimmed };
          const updatedMessages = [...eqAiMessages, userMsg];
          setEqAiMessages(updatedMessages);
          setEqAiInput('');

          try {
            const response = await fetch('/api/ai/equipment-analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                plainTextReport,
                history: updatedMessages.slice(0, -1),
                userQuestion: trimmed
              })
            });

            if (!response.ok) {
              const errData = await response.json().catch(() => ({}));
              throw new Error(errData.message || `Error del servidor (${response.status})`);
            }

            const data = await response.json();
            setEqAiMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
          } catch (err: any) {
            console.error("Error asking AI assistant:", err);
            setEqAiError(err.message || 'Error inesperado al conectar con el Asistente AI.');
          } finally {
            setEqAiLoading(false);
          }
        };

        const handleSendMessage = () => {
          executeSendMessage(eqAiInput);
        };

        const handleSendPreset = (presetText: string) => {
          if (eqAiLoading) return;
          executeSendMessage(presetText);
        };

        const hasAnyItems = Object.keys(filteredGrouped).length > 0;

        const isMecActive = eqTipoFilter === 'mecanico' && eqSubCFilter === 'Por Contratar';
        const isElecActive = eqTipoFilter === 'electrico' && eqSubCFilter === 'Por Contratar';
        const isIandCActive = eqTipoFilter === 'instrumentacion' && eqSubCFilter === 'Por Contratar';

        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in" id="equipment-report-modal">
            <div className={`bg-white rounded-2xl shadow-2xl border border-slate-200 w-full h-[94vh] max-h-[96vh] flex flex-col overflow-hidden transition-all duration-300 animate-scale-up ${eqAiOpen ? 'max-w-[1290px]' : 'max-w-[1034px]'}`}>
              
              {/* Header */}
              <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white font-bold shadow-md shadow-amber-500/25 shrink-0">
                    <FileSpreadsheet className="w-5 h-5 text-amber-50" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black flex items-center gap-2">
                      Reporte de Equipos
                    </h3>
                    <p className="text-[10.5px] text-slate-300 font-medium font-sans">
                      Agrupado por WBS real sin prefijos mensuales · Corte: 28 de Mayo, 2026
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEqReportOpen(false)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 border border-slate-700"
                >
                  ✕ Cerrar Reporte
                </button>
              </div>

              {/* Stats Cards Row */}
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0 text-left">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-mini">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Total Paquetes</span>
                  <div className="text-xl font-black text-slate-850 mt-0.5">{totalEquip}</div>
                  <div className="text-[9.5px] text-slate-500 font-bold mt-0.5 font-sans">Mec / Elec / I&C</div>
                </div>
                <div 
                  onClick={() => {
                    if (eqSubCFilter === 'Por Contratar') {
                      setEqSubCFilter('all');
                    } else {
                      setEqSubCFilter('Por Contratar');
                    }
                  }}
                  className={`p-3 rounded-xl border shadow-mini transition-all duration-200 cursor-pointer select-none ${
                    eqSubCFilter === 'Por Contratar' 
                      ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-300' 
                      : 'bg-white border-slate-200 hover:border-slate-350 hover:bg-slate-50/50 hover:scale-[1.01]'
                  }`}
                >
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider flex items-center justify-between">
                    <span>Por Contratar</span>
                    {eqSubCFilter === 'Por Contratar' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />}
                  </span>
                  <div className="text-xl font-black text-amber-600 mt-0.5">{countPorContratar}</div>
                  <div className="text-[9.5px] text-amber-600/80 font-bold mt-0.5 font-sans">S/ SubC asignado</div>
                </div>
                <div 
                  onClick={() => {
                    if (eqSubCFilter === 'Contratados') {
                      setEqSubCFilter('all');
                    } else {
                      setEqSubCFilter('Contratados');
                    }
                  }}
                  className={`p-3 rounded-xl border shadow-mini transition-all duration-200 cursor-pointer select-none ${
                    eqSubCFilter === 'Contratados' 
                      ? 'bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-300' 
                      : 'bg-white border-slate-200 hover:border-slate-350 hover:bg-slate-50/50 hover:scale-[1.01]'
                  }`}
                >
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider flex items-center justify-between">
                    <span>Adjudicados</span>
                    {eqSubCFilter === 'Contratados' && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />}
                  </span>
                  <div className="text-xl font-black text-indigo-650 mt-0.5">{countContratados}</div>
                  <div className="text-[9.5px] text-indigo-600/85 font-bold mt-0.5 font-sans">Con SubC definido</div>
                </div>
                <div 
                  onClick={() => {
                    if (isMecActive) {
                      setEqTipoFilter('all');
                      setEqSubCFilter('all');
                    } else {
                      setEqTipoFilter('mecanico');
                      setEqSubCFilter('Por Contratar');
                    }
                  }}
                  className={`p-3 rounded-xl border shadow-mini border-l-4 border-l-amber-500 animate-fade-in transition-all duration-200 cursor-pointer select-none ${
                    isMecActive 
                      ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-300' 
                      : 'bg-white border-slate-200 hover:border-slate-350 hover:bg-slate-50/50 hover:scale-[1.01]'
                  }`}
                >
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider flex items-center justify-between">
                    <span>Mecánica</span>
                    {isMecActive && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />}
                  </span>
                  <div className="text-xl font-black text-slate-850 mt-0.5">
                    {pendingMecanico} <span className="text-xs font-bold text-slate-500 ml-1">paquetes</span>
                  </div>
                  <div className="text-[9.5px] text-amber-600/90 font-bold mt-0.5 font-sans">Mec. Por Contratar</div>
                </div>
                <div 
                  onClick={() => {
                    if (isElecActive) {
                      setEqTipoFilter('all');
                      setEqSubCFilter('all');
                    } else {
                      setEqTipoFilter('electrico');
                      setEqSubCFilter('Por Contratar');
                    }
                  }}
                  className={`p-3 rounded-xl border shadow-mini border-l-4 border-l-amber-500 animate-fade-in transition-all duration-200 cursor-pointer select-none ${
                    isElecActive 
                      ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-300' 
                      : 'bg-white border-slate-200 hover:border-slate-350 hover:bg-slate-50/50 hover:scale-[1.01]'
                  }`}
                >
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider flex items-center justify-between">
                    <span>Eléctrica</span>
                    {isElecActive && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />}
                  </span>
                  <div className="text-xl font-black text-slate-850 mt-0.5">
                    {pendingElectrico} <span className="text-xs font-bold text-slate-500 ml-1">paquetes</span>
                  </div>
                  <div className="text-[9.5px] text-amber-600/90 font-bold mt-0.5 font-sans">Elec. Por Contratar</div>
                </div>
                <div 
                  onClick={() => {
                    if (isIandCActive) {
                      setEqTipoFilter('all');
                      setEqSubCFilter('all');
                    } else {
                      setEqTipoFilter('instrumentacion');
                      setEqSubCFilter('Por Contratar');
                    }
                  }}
                  className={`p-3 rounded-xl border shadow-mini border-l-4 border-l-amber-500 animate-fade-in col-span-2 md:col-span-1 lg:col-span-1 transition-all duration-200 cursor-pointer select-none ${
                    isIandCActive 
                      ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-300' 
                      : 'bg-white border-slate-200 hover:border-slate-350 hover:bg-slate-50/50 hover:scale-[1.01]'
                  }`}
                >
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider flex items-center justify-between">
                    <span>I&C</span>
                    {isIandCActive && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />}
                  </span>
                  <div className="text-xl font-black text-slate-850 mt-0.5">
                    {pendingIandC} <span className="text-xs font-bold text-slate-500 ml-1">paquetes</span>
                  </div>
                  <div className="text-[9.5px] text-amber-600/90 font-bold mt-0.5 font-sans">I&C Por Contratar</div>
                </div>
              </div>

              {/* Toolbar & Filter area */}
              <div className="px-6 py-3 border-b border-slate-150 bg-white flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
                  <div className="relative w-44 lg:w-48 shrink-0">
                    <input
                      type="text"
                      placeholder="Buscar paquete..."
                      value={eqSearchQuery}
                      onChange={e => setEqSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 border border-slate-250 rounded-xl text-xs font-semibold bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-mini transition-all"
                    />
                    <svg className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>

                   <select
                    value={eqTipoFilter}
                    onChange={e => setEqTipoFilter(e.target.value)}
                    className="border border-slate-250 text-xs font-semibold rounded-xl px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-mini animate-fade-in"
                  >
                    <option value="all">Tipología: Todas</option>
                    <option value="mecanico">Mecánico</option>
                    <option value="electrico">Eléctrico</option>
                    <option value="instrumentacion">I&C</option>
                  </select>

                   <select
                    value={eqSubCFilter}
                    onChange={e => setEqSubCFilter(e.target.value)}
                    className="border border-slate-250 text-xs font-semibold rounded-xl px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-mini animate-fade-in"
                  >
                    <option value="all">SubC: Todos</option>
                    {countPorContratar > 0 && (
                      <option value="Por Contratar" className="text-amber-600 font-bold">⚠️ Por Contratar</option>
                    )}
                    <option value="Contratados" className="text-indigo-600 font-bold">🤝 Adjudicados (Todos)</option>
                    {allSubCs.map(sc => {
                      return (
                        <option key={sc} value={sc}>{sc}</option>
                      );
                    })}
                  </select>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEqAiOpen(prev => !prev)}
                    className={`px-3 py-1.5 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95 ${
                      eqAiOpen 
                        ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse' 
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                    <span>{eqAiOpen ? 'Cerrar IA' : 'IA Asistente'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyTextDirect}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                    title="Copiar reporte jerárquico (Texto plano con árbol + HTML con formato para Excel/Word)"
                  >
                    {copiedAlert ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-indigo-200" />
                        <span>¡Copiado Jerárquico!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-indigo-150" />
                        <span>Copiar Reporte Jerárquico</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadCsvDirect}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-slate-100 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95 border border-slate-700"
                    title="Descargar reporte con desglose de jerarquías N1-N4 en formato CSV / Excel"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-300" />
                    <span>Exportar CSV</span>
                  </button>
                </div>
              </div>

              {/* Modal Body Scroll Space with Side-by-Side Panel */}
              <div className="flex-1 flex flex-row min-h-0 bg-slate-50 divide-x divide-slate-200">
                <div className="flex-1 overflow-y-auto p-6 min-h-0">
                  <div className="space-y-6 animate-fade-in">
                  {!hasAnyItems ? (
                      <div className="bg-white rounded-2xl p-16 text-center border border-slate-200 shadow-mini flex flex-col items-center">
                        <AlertCircle className="w-10 h-10 text-slate-400 mb-3" />
                        <h4 className="text-sm font-bold text-slate-800">No se encontraron paquetes</h4>
                        <p className="text-xs text-slate-500 max-w-sm mt-1">
                          Pruebe ajustando el buscador o los filtros de subcontratistas en la barra superior. Note que se han filtrado las actividades de procura.
                        </p>
                      </div>
                    ) : (
                      Object.entries(filteredGrouped).map(([subC, items]) => {
                        const isPorContratar = subC === 'Por Contratar';
                        const isContratados = subC === 'Contratados';
                        const groupMetrics = computeAggregatedMetrics(items);

                        if (isContratados) {
                          // Group contratistas first
                          const subCGroups: Record<string, any[]> = {};
                          items.forEach(it => {
                            const subName = (it.subcontratista || '').trim() || 'General / Sin Contratista';
                            if (!subCGroups[subName]) {
                              subCGroups[subName] = [];
                            }
                            subCGroups[subName].push(it);
                          });

                          return (
                            <div key={subC} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left font-sans">
                              {/* Group Header for Contratados */}
                              <div 
                                onClick={() => {
                                  setCollapsedGroups(prev => ({
                                    ...prev,
                                    [subC]: !prev[subC]
                                  }));
                                }}
                                className="px-4 py-3 flex items-center justify-between border-b bg-emerald-500/10 border-emerald-250 text-emerald-950 bg-emerald-50/45 cursor-pointer hover:bg-emerald-500/15 transition-colors select-none"
                              >
                                <div className="flex flex-col gap-0.5 text-left min-w-0">
                                  <div className="flex items-center gap-2">
                                    {collapsedGroups[subC] ? (
                                      <ChevronRight className="w-4 h-4 text-emerald-700 shrink-0" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4 text-emerald-700 shrink-0" />
                                    )}
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span className="font-extrabold text-[12px] uppercase tracking-wider">{subC}</span>
                                    <span className="px-1.5 py-0.5 bg-white/75 rounded-full text-[9px] font-black border uppercase shrink-0">
                                      {(() => {
                                        const uCount = Array.from(new Set(items.map(it => cleanWbs(it.wbs).toLowerCase()))).length;
                                        return `${uCount} ${uCount === 1 ? 'paquete' : 'paquetes'}`;
                                      })()}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-[9.5px] mt-1 ml-6 flex-wrap">
                                    {groupMetrics.cantText && (
                                      <span className="text-emerald-900 font-mono">
                                        Cant. Total: <span className="font-bold">{groupMetrics.cantText}</span>
                                      </span>
                                    )}
                                    {groupMetrics.rangeText && (
                                      <span className="text-emerald-950 border-emerald-250 bg-white/80 font-mono px-1.5 py-0.5 rounded border">
                                        Programación: <span className="font-bold">{groupMetrics.rangeText}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span className="text-[9.5px] bg-emerald-500/20 border border-emerald-300 text-emerald-800 font-black px-2.5 py-0.5 rounded-full uppercase shrink-0">
                                  ✅ ADJUDICADO / CONTRATADO
                                </span>
                              </div>

                              {/* List of Subcontractors */}
                              {!collapsedGroups[subC] && (
                                <div className="divide-y-2 divide-slate-150 animate-fade-in">
                                  {Object.entries(subCGroups).map(([subName, subItems]) => {
                                  // Group by Paquete (scap)
                                  const scapGroups: Record<string, any[]> = {};
                                  subItems.forEach(it => {
                                    const sc = it.scap || 'General / Sin SCAP';
                                    if (!scapGroups[sc]) {
                                      scapGroups[sc] = [];
                                    }
                                    scapGroups[sc].push(it);
                                  });

                                  const subcCollapseKey = `${subC}_${subName}`;
                                  const isSubcCollapsed = !expandedReportSubc[subcCollapseKey];
                                  const toggleSubcCollapse = () => {
                                    setExpandedReportSubc(prev => ({
                                      ...prev,
                                      [subcCollapseKey]: !prev[subcCollapseKey]
                                    }));
                                  };

                                  const subcMetrics = computeAggregatedMetrics(subItems);

                                  return (
                                    <div key={subName} className="bg-slate-50/10">
                                      {/* SubC level superior hierarchy header */}
                                      <div 
                                        onClick={toggleSubcCollapse}
                                        className="px-4 py-2.5 border-b border-indigo-200/50 flex items-center justify-between hover:opacity-90 transition-opacity cursor-pointer select-none"
                                        style={{ backgroundColor: '#FBE5E5' }}
                                      >
                                        <div className="flex flex-col gap-0.5 text-left min-w-0">
                                          <div className="flex items-center gap-2">
                                            {isSubcCollapsed ? (
                                              <ChevronRight className="w-4 h-4 text-indigo-700 shrink-0" />
                                            ) : (
                                              <ChevronDown className="w-4 h-4 text-indigo-700 shrink-0" />
                                            )}
                                            <div className="w-4 h-4 rounded bg-indigo-650 text-white flex items-center justify-center text-[9px] font-black">
                                              🏗️
                                            </div>
                                            <span className="text-[11px] font-extrabold text-indigo-950 uppercase tracking-tight">
                                              SubC: {subName}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-3 text-[9.5px] mt-1 ml-6 flex-wrap">
                                            {subcMetrics.cantText && (
                                              <span className="text-indigo-800 font-mono">
                                                Cant. Total: <span className="font-bold">{subcMetrics.cantText}</span>
                                              </span>
                                            )}
                                            {subcMetrics.rangeText && (
                                              <span className="text-indigo-900 font-mono bg-white/75 px-1.5 py-0.5 rounded border border-indigo-150">
                                                Programación: <span className="font-bold">{subcMetrics.rangeText}</span>
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-150 text-indigo-700 rounded-lg text-[9px] font-black uppercase shrink-0">
                                          {(() => {
                                            const uCount = Array.from(new Set(subItems.map(it => cleanWbs(it.wbs).toLowerCase()))).length;
                                            return `${uCount} ${uCount === 1 ? 'paquete' : 'paquetes'}`;
                                          })()}
                                        </span>
                                      </div>

                                      {/* Secciones de Paquete de este Subcontractor */}
                                      {!isSubcCollapsed && (
                                        <div className="divide-y divide-slate-100">
                                          {Object.entries(scapGroups).sort(([, aItems], [, bItems]) => {
                                            const getMinBlFinish = (items: any[]) => {
                                              let minT = Infinity;
                                              items.forEach(it => {
                                                const f = it.blFinish || it.finish;
                                                if (f instanceof Date && !isNaN(f.getTime())) {
                                                  if (f.getTime() < minT) minT = f.getTime();
                                                }
                                              });
                                              return minT;
                                            };
                                            const diff = getMinBlFinish(aItems) - getMinBlFinish(bItems);
                                            if (diff !== 0) return diff;
                                            return 0;
                                          }).map(([scName, scapItems]) => {
                                          // Group by WBS
                                          const wbsGroups: Record<string, { wbsName: string; items: any[] }> = {};
                                          scapItems.forEach(it => {
                                            const cw = cleanWbs(it.wbs);
                                            const wName = getWbsName(it.wbs);
                                            if (!wbsGroups[cw]) {
                                              wbsGroups[cw] = { wbsName: wName, items: [] };
                                            }
                                            wbsGroups[cw].items.push(it);
                                          });

                                          const scapCollapseKey = `${subC}_${subName}_${scName}`;
                                          const isScapCollapsed = !expandedReportScap[scapCollapseKey];
                                          const toggleScapCollapse = () => {
                                            setExpandedReportScap(prev => ({
                                              ...prev,
                                              [scapCollapseKey]: !prev[scapCollapseKey]
                                            }));
                                          };

                                          const scapMetrics = computeAggregatedMetrics(scapItems);

                                          return (
                                            <div key={scName} className="bg-slate-50/20 mr-2 ml-4 my-2 border border-slate-200 rounded-xl overflow-hidden shadow-mini">
                                              {/* Paquete Header inside SubC */}
                                              <div 
                                                onClick={toggleScapCollapse}
                                                className="px-4 py-2.5 border-b border-amber-200/50 flex items-center justify-between cursor-pointer transition-colors hover:opacity-95"
                                                style={{ backgroundColor: '#fef3c7' }}
                                              >
                                                <div className="flex flex-col gap-0.5 text-left min-w-0">
                                                  <div className="flex items-center gap-2">
                                                    {isScapCollapsed ? (
                                                      <ChevronRight className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                                    ) : (
                                                      <ChevronDown className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                                    )}
                                                    <span className="text-[10.5px] font-black text-indigo-850 uppercase tracking-wide">
                                                      🔷 Paquete: {scName}
                                                    </span>
                                                  </div>
                                                  <div className="flex items-center gap-3 text-[9.5px] mt-1 ml-5 flex-wrap">
                                                    {scapMetrics.cantText && (
                                                      <span className="text-indigo-850 font-mono">
                                                        Cant. Total: <span className="font-bold">{scapMetrics.cantText}</span>
                                                      </span>
                                                    )}
                                                    {scapMetrics.rangeText && (
                                                      <span className="text-amber-950 font-mono bg-white/75 px-1.5 py-0.5 rounded border border-amber-200">
                                                        Programación: <span className="font-bold">{scapMetrics.rangeText}</span>
                                                      </span>
                                                    )}
                                                  </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                  <span className="px-2 py-0.5 bg-indigo-100/60 border border-indigo-200/50 text-indigo-700 rounded-lg text-[9px] font-bold">
                                                    {(() => {
                                                      const uCount = Array.from(new Set(scapItems.map(it => cleanWbs(it.wbs).toLowerCase()))).length;
                                                      return `${uCount} ${uCount === 1 ? 'paquete' : 'paquetes'}`;
                                                    })()}
                                                  </span>
                                                </div>
                                              </div>

                                              {/* Secciones de WBS de este Paquete */}
                                              {!isScapCollapsed && (
                                                <div className="divide-y divide-slate-100 bg-white animate-fade-in">
                                                  {Object.entries(wbsGroups).map(([cwKey, val]) => {
                                                    const collapseKey = `${subC}_${subName}_${scName}_${cwKey}`;
                                                    const isCollapsed = !expandedReportWbs[collapseKey];
                                                    const toggleCollapse = () => {
                                                      setExpandedReportWbs(prev => ({
                                                        ...prev,
                                                        [collapseKey]: !prev[collapseKey]
                                                      }));
                                                    };

                                                    const uniqueIdOrigs = Array.from(new Set(val.items.map(it => it.idOrig).filter(Boolean)));
                                                    const idDisplay = uniqueIdOrigs.length > 0 ? uniqueIdOrigs : [cwKey];

                                                    const wbsMetrics = (() => {
                                                      let totalCant = 0;
                                                      const units = new Set<string>();
                                                      let minStart: Date | null = null;
                                                      let maxFinish: Date | null = null;

                                                      // Group by idOrig to avoid duplicate summation of the same equipment phases
                                                      const qtyByIdOrig = new Map<string, number>();
                                                      let noIdOrigCounter = 0;

                                                      val.items.forEach(it => {
                                                        const key = it.idOrig ? String(it.idOrig).trim() : `__no_id_${noIdOrigCounter++}`;
                                                        const qty = (it.cantidadCdo !== undefined && it.cantidadCdo !== null) ? it.cantidadCdo : 0;
                                                        
                                                        // Keep the maximum quantity among items with the same idOrig
                                                        const existing = qtyByIdOrig.get(key) || 0;
                                                        if (qty > existing) {
                                                          qtyByIdOrig.set(key, qty);
                                                        }

                                                        const u = it.unidad || it.unit;
                                                        if (u) {
                                                          units.add(String(u).trim());
                                                        }
                                                        if (it.start) {
                                                          const s = new Date(it.start);
                                                          if (!isNaN(s.getTime())) {
                                                            if (!minStart || s < minStart) minStart = s;
                                                          }
                                                        }
                                                        if (it.finish) {
                                                          const f = new Date(it.finish);
                                                          if (!isNaN(f.getTime())) {
                                                            if (!maxFinish || f > maxFinish) maxFinish = f;
                                                          }
                                                        }
                                                      });

                                                      qtyByIdOrig.forEach(qty => {
                                                        totalCant += qty;
                                                      });

                                                      const formatSpanishResumenDate = (dt: Date | null) => {
                                                        if (!dt) return '';
                                                        const day = String(dt.getDate()).padStart(2, '0');
                                                        const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
                                                        const month = months[dt.getMonth()];
                                                        const year = String(dt.getFullYear()).slice(2);
                                                        return `${day}.${month}.${year}`;
                                                      };

                                                      const rangeText = (minStart && maxFinish) ? `${formatSpanishResumenDate(minStart)} a ${formatSpanishResumenDate(maxFinish)}` : '';
                                                      const unitStr = units.size > 0 ? Array.from(units).join(', ') : '';
                                                      const cantText = totalCant > 0 ? `${totalCant.toLocaleString('es-ES')} ${unitStr}`.trim() : '';

                                                      return { cantText, rangeText };
                                                    })();

                                                    return (
                                                      <div key={cwKey} className="bg-white">
                                                        {/* WBS Subheader */}
                                                        <div 
                                                          onClick={toggleCollapse}
                                                          className="px-4 py-2 hover:bg-slate-100 flex items-center justify-between cursor-pointer border-b border-slate-200 transition-colors"
                                                          style={{ backgroundColor: '#f1f5f9' }}
                                                        >
                                                          <div className="flex items-center gap-3 text-slate-700 min-w-0 flex-1">
                                                            {isCollapsed ? (
                                                              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                            ) : (
                                                              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                            )}
                                                            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                                              <div className="flex items-center gap-2 flex-nowrap min-w-0">
                                                                <div className="flex items-center gap-1 flex-nowrap shrink-0">
                                                                  {idDisplay.map((id, idIdx) => (
                                                                    <span key={idIdx} className="text-[9px] font-mono font-black text-indigo-600 bg-indigo-50/70 border border-indigo-150 px-1.5 py-0.25 rounded shrink-0">
                                                                      {id}
                                                                    </span>
                                                                  ))}
                                                                </div>
                                                                <span className="text-[10.5px] font-bold text-indigo-950 font-sans tracking-tight uppercase truncate" title={val.wbsName}>
                                                                  {val.wbsName}
                                                                </span>
                                                              </div>
                                                              <div className="flex items-center gap-3 mt-0.5 text-[9.5px] flex-wrap">
                                                                {wbsMetrics.cantText && (
                                                                  <span className="text-slate-600 font-mono">
                                                                    Cant. Total: <span className="font-bold text-slate-800">{wbsMetrics.cantText}</span>
                                                                  </span>
                                                                )}
                                                                {wbsMetrics.rangeText && (
                                                                  <span className="text-slate-500 font-mono">
                                                                    Programación: <span className="font-bold text-indigo-950 bg-slate-100/80 px-1.5 py-0.5 rounded border border-slate-200/50">{wbsMetrics.rangeText}</span>
                                                                  </span>
                                                                )}
                                                              </div>
                                                            </div>
                                                          </div>
                                                          <div className="flex items-center gap-2">
                                                            <span className="px-2 py-0.5 bg-slate-50 border border-slate-200 text-indigo-650 rounded-lg text-[9px] font-bold">
                                                              {(() => {
                                                                const uCount = Array.from(new Set(val.items.map(it => cleanWbs(it.wbs).toLowerCase()))).length;
                                                                return `${uCount} ${uCount === 1 ? 'paquete' : 'paquetes'}`;
                                                              })()}
                                                            </span>
                                                          </div>
                                                        </div>

                                                        {/* Subgroup Items Table */}
                                                        {!isCollapsed && (
                                                          <div className="overflow-x-auto animate-fade-in">
                                                            <table className="w-full text-left border-collapse min-w-[700px]">
                                                              <thead>
                                                                <tr className="bg-slate-50/20 border-b border-slate-150 text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">
                                                                  <th className="px-3 py-1.5">id.Orig</th>
                                                                  <th className="px-4 py-1.5">Activity id</th>
                                                                  <th className="px-3 py-1.5 text-right">Cant.</th>
                                                                  <th className="px-4 py-1.5">Descripcion</th>
                                                                  <th className="px-3 py-1.5">Contratista</th>
                                                                  <th className="px-3 py-1.5">Status</th>
                                                                  <th className="px-4 py-1.5">Duracion</th>
                                                                </tr>
                                                              </thead>
                                                              <tbody className="divide-y divide-slate-100 text-[10.5px]">
                                                                {val.items.map((it) => {
                                                                  const s_dt = it.start;
                                                                  const f_dt = it.finish;
                                                                  const { phase, percent, colorClass, phaseKey } = getExpectedPhaseText(s_dt, f_dt);
                                                                  const cleanTipo = (it.tipo || '').replace(/^\d+\./, '');
                                                                  const formatShortDate = (d: any) => {
                                                                    if (!d) return '';
                                                                    const dt = new Date(d);
                                                                    if (isNaN(dt.getTime())) return '';
                                                                    const day = String(dt.getDate()).padStart(2, '0');
                                                                     const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
                                                                     const month = months[dt.getMonth()];
                                                                     const year = String(dt.getFullYear()).slice(2);
                                                                     return `${day}.${month}.${year}`;
                                                                  };
                                                                  const sStr = formatShortDate(s_dt);
                                                                  const fStr = formatShortDate(f_dt);
                                                                  const rangeStr = (sStr || fStr) ? `${sStr} - ${fStr}` : '';

                                                                  let statusBadge = "bg-slate-100 text-slate-500";
                                                                  const stat = (it.p6Status || it.status || '').toLowerCase();
                                                                  if (stat === 'in progress' || stat.includes('curso') || stat.includes('progreso')) {
                                                                    statusBadge = "bg-blue-105 text-blue-700 border border-blue-200 font-semibold";
                                                                  } else if (stat === 'not started' || stat.includes('iniciado') || stat.includes('inicio')) {
                                                                    statusBadge = "bg-slate-100 text-slate-600 border border-slate-200";
                                                                  }

                                                                  return (
                                                                    <tr key={it.id} className="hover:bg-slate-50/40 transition-colors">
                                                                      <td className="px-3 py-1.5 text-slate-500 font-medium font-mono text-[9.5px]">{it.idOrig || '—'}</td>
                                                                      <td className="px-4 py-1.5 font-mono text-[9px] text-slate-400 whitespace-nowrap">{it.activityId || '—'}</td>
                                                                      <td className="px-3 py-1.5 font-mono text-[9.5px] text-slate-600 text-right whitespace-nowrap">
                                                                        {it.cantidadCdo !== undefined && it.cantidadCdo !== null ? `${it.cantidadCdo.toLocaleString('es-ES')} ${it.unidad || it.unit || ''}`.trim() : '—'}
                                                                      </td>
                                                                      <td className="px-4 py-1.5 max-w-[280px] sm:max-w-xs md:max-w-sm lg:max-w-md">
                                                                        <div className="font-bold text-slate-750 font-sans tracking-tight truncate" title={it.descripcion}>
                                                                          {it.descripcion}
                                                                        </div>
                                                                      </td>
                                                                      <td className="px-3 py-1.5 whitespace-nowrap">
                                                                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[9px] font-bold border border-emerald-150 shadow-mini">
                                                                          {it.subcontratista || '—'}
                                                                        </span>
                                                                      </td>
                                                                      <td className="px-3 py-1.5 whitespace-nowrap">
                                                                        <span className={`px-2 py-0.5 rounded-md text-[8.5px] ${statusBadge}`}>
                                                                          {it.p6Status || 'Not Started'}
                                                                        </span>
                                                                      </td>
                                                                      <td className="px-4 py-1.5 max-w-xs whitespace-nowrap">
                                                                         <div className="flex flex-col gap-0.5">
                                                                           <div className="text-[10px] font-bold text-slate-700 whitespace-nowrap">{rangeStr}</div>
                                                                           {s_dt && f_dt && (
                                                                             <div className="text-[9px] font-medium text-slate-500 font-mono">
                                                                               {Math.round((new Date(f_dt).getTime() - new Date(s_dt).getTime()) / (1000 * 60 * 60 * 24))} días
                                                                             </div>
                                                                           )}
                                                                         </div>
                                                                       </td>
                                                                    </tr>
                                                                  );
                                                                })}
                                                              </tbody>
                                                            </table>
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
                                  </div>
                                );
                              })}
                              </div>
                            )}
                          </div>
                        );
                      }

                      const scapGroups: Record<string, any[]> = {};
                      items.forEach(it => {
                        const sc = it.scap || 'General / Sin SCAP';
                        if (!scapGroups[sc]) {
                          scapGroups[sc] = [];
                        }
                        scapGroups[sc].push(it);
                      });

                      return (
                        <div key={subC} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left font-sans">
                          {/* Group Header */}
                          <div 
                            onClick={() => {
                              setCollapsedGroups(prev => ({
                                ...prev,
                                [subC]: !prev[subC]
                              }));
                            }}
                            className={`px-4 py-3 flex items-center justify-between border-b cursor-pointer select-none transition-colors ${
                              isPorContratar 
                                ? 'bg-amber-500/10 hover:bg-amber-500/15 border-amber-200 text-amber-900 bg-amber-50/50' 
                                : isContratados
                                  ? 'bg-emerald-500/10 hover:bg-emerald-500/15 border-emerald-250 text-emerald-950 bg-emerald-50/45'
                                  : 'bg-slate-100 hover:bg-slate-155 border-slate-200 text-slate-800'
                            }`}
                          >
                            <div className="flex flex-col gap-0.5 text-left min-w-0">
                              <div className="flex items-center gap-2">
                                {collapsedGroups[subC] ? (
                                  <ChevronRight className={`w-4 h-4 shrink-0 ${isPorContratar ? 'text-amber-700' : 'text-slate-500'}`} />
                                ) : (
                                  <ChevronDown className={`w-4 h-4 shrink-0 ${isPorContratar ? 'text-amber-700' : 'text-slate-500'}`} />
                                )}
                                <span className={`w-2 h-2 rounded-full ${
                                  isPorContratar 
                                    ? 'bg-amber-500 animate-pulse' 
                                    : isContratados 
                                      ? 'bg-emerald-500' 
                                      : 'bg-indigo-500'
                                }`} />
                                <span className="font-extrabold text-[12px] uppercase tracking-wider">{subC}</span>
                                <span className="px-1.5 py-0.5 bg-white/75 rounded-full text-[9px] font-black border uppercase shrink-0">
                                  {(() => {
                                    const uCount = Array.from(new Set(items.map(it => cleanWbs(it.wbs).toLowerCase()))).length;
                                    return `${uCount} ${uCount === 1 ? 'paquete' : 'paquetes'}`;
                                  })()}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[9.5px] mt-1 ml-6 flex-wrap">
                                {groupMetrics.cantText && (
                                  <span className={`${isPorContratar ? 'text-amber-900 font-bold' : 'text-slate-600'} font-mono`}>
                                    Cant. Total: <span className={isPorContratar ? 'text-amber-950 font-extrabold' : 'font-bold text-slate-800'}>{groupMetrics.cantText}</span>
                                  </span>
                                )}
                                {groupMetrics.rangeText && (
                                  <span className={`${isPorContratar ? 'text-amber-950 border-amber-250 bg-white/80' : 'text-slate-700 border-slate-200 bg-white/80'} font-mono px-1.5 py-0.5 rounded border`}>
                                    Programación: <span className="font-bold">{groupMetrics.rangeText}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                            {isPorContratar && (
                              <span className="text-[9.5px] bg-amber-500/25 border border-amber-300 text-amber-800 font-black px-2.5 py-0.5 rounded-full uppercase shrink-0">
                                ⚠️ FRENTE DE RIESGO
                              </span>
                            )}
                            {isContratados && (
                              <span className="text-[9.5px] bg-emerald-500/20 border border-emerald-300 text-emerald-800 font-black px-2.5 py-0.5 rounded-full uppercase shrink-0">
                                ✅ ADJUDICADO / CONTRATADO
                              </span>
                            )}
                          </div>

                          {/* Secciones de SCAP (now Paquete) */}
                          {!collapsedGroups[subC] && (
                            <div className="divide-y divide-slate-150">
                                {Object.entries(scapGroups).sort(([, aItems], [, bItems]) => {
                                  const getMinBlFinish = (items: any[]) => {
                                    let minT = Infinity;
                                    items.forEach(it => {
                                      const f = it.blFinish || it.finish;
                                      if (f instanceof Date && !isNaN(f.getTime())) {
                                        if (f.getTime() < minT) minT = f.getTime();
                                      }
                                    });
                                    return minT;
                                  };
                                  const diff = getMinBlFinish(aItems) - getMinBlFinish(bItems);
                                  if (diff !== 0) return diff;
                                  return 0;
                                }).map(([scName, scapItems]) => {
                                // Agrupar items de este SCAP por WBS limpia
                                const wbsGroups: Record<string, { wbsName: string; items: any[] }> = {};
                                scapItems.forEach(it => {
                                  const cw = cleanWbs(it.wbs);
                                  const wName = getWbsName(it.wbs);
                                  if (!wbsGroups[cw]) {
                                    wbsGroups[cw] = { wbsName: wName, items: [] };
                                  }
                                  wbsGroups[cw].items.push(it);
                                });

                                const scapCollapseKey = `${subC}_${scName}`;
                                const isScapCollapsed = !expandedReportScap[scapCollapseKey];
                                const toggleScapCollapse = () => {
                                  setExpandedReportScap(prev => ({
                                    ...prev,
                                    [scapCollapseKey]: !prev[scapCollapseKey]
                                  }));
                                };

                                const scapMetrics = computeAggregatedMetrics(scapItems);

                                return (
                                  <div key={scName} className="bg-slate-50/20 mr-2 ml-4 my-2 border border-slate-200 rounded-xl overflow-hidden shadow-mini">
                                    {/* SCAP Header inside Subcontractor (now Paquete) */}
                                    <div 
                                      onClick={toggleScapCollapse}
                                      className="px-4 py-2.5 border-b border-amber-200/50 flex items-center justify-between cursor-pointer transition-colors hover:opacity-95"
                                      style={{ backgroundColor: '#fef3c7' }}
                                    >
                                      <div className="flex flex-col gap-0.5 text-left min-w-0">
                                        <div className="flex items-center gap-2">
                                          {isScapCollapsed ? (
                                            <ChevronRight className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                          ) : (
                                            <ChevronDown className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                          )}
                                          <span className="text-[10.5px] font-black text-indigo-850 uppercase tracking-wide">
                                            🔷 Paquete: {scName}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[9.5px] mt-1 ml-5 flex-wrap">
                                          {scapMetrics.cantText && (
                                            <span className="text-indigo-850 font-mono">
                                              Cant. Total: <span className="font-bold">{scapMetrics.cantText}</span>
                                            </span>
                                          )}
                                          {scapMetrics.rangeText && (
                                            <span className="text-amber-950 font-mono bg-white/75 px-1.5 py-0.5 rounded border border-amber-250">
                                              Programación: <span className="font-bold">{scapMetrics.rangeText}</span>
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="px-2 py-0.5 bg-indigo-100/60 border border-indigo-200/50 text-indigo-700 rounded-lg text-[9px] font-bold">
                                          {(() => {
                                            const uCount = Array.from(new Set(scapItems.map(it => cleanWbs(it.wbs).toLowerCase()))).length;
                                            return `${uCount} ${uCount === 1 ? 'paquete' : 'paquetes'}`;
                                          })()}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Secciones de WBS individuales colapsables dentro del SCAP */}
                                    {!isScapCollapsed && (
                                      <div className="divide-y divide-slate-150 bg-white animate-fade-in">
                                        {Object.entries(wbsGroups).map(([cwKey, val]) => {
                                          const collapseKey = `${subC}_${scName}_${cwKey}`;
                                          const isCollapsed = !expandedReportWbs[collapseKey];
                                          const toggleCollapse = () => {
                                            setExpandedReportWbs(prev => ({
                                              ...prev,
                                              [collapseKey]: !prev[collapseKey]
                                            }));
                                          };

                                          const uniqueIdOrigs = Array.from(new Set(val.items.map(it => it.idOrig).filter(Boolean)));
                                          const idDisplay = uniqueIdOrigs.length > 0 ? uniqueIdOrigs : [cwKey];

                                          const wbsMetrics = (() => {
                                            let totalCant = 0;
                                            const units = new Set<string>();
                                            let minStart: Date | null = null;
                                            let maxFinish: Date | null = null;

                                            // Group by idOrig to avoid duplicate summation of the same equipment phases
                                            const qtyByIdOrig = new Map<string, number>();
                                            let noIdOrigCounter = 0;

                                            val.items.forEach(it => {
                                              const key = it.idOrig ? String(it.idOrig).trim() : `__no_id_${noIdOrigCounter++}`;
                                              const qty = (it.cantidadCdo !== undefined && it.cantidadCdo !== null) ? it.cantidadCdo : 0;
                                              
                                              // Keep the maximum quantity among items with the same idOrig
                                              const existing = qtyByIdOrig.get(key) || 0;
                                              if (qty > existing) {
                                                qtyByIdOrig.set(key, qty);
                                              }

                                              const u = it.unidad || it.unit;
                                              if (u) {
                                                units.add(String(u).trim());
                                              }
                                              if (it.start) {
                                                const s = new Date(it.start);
                                                if (!isNaN(s.getTime())) {
                                                  if (!minStart || s < minStart) minStart = s;
                                                }
                                              }
                                              if (it.finish) {
                                                const f = new Date(it.finish);
                                                if (!isNaN(f.getTime())) {
                                                  if (!maxFinish || f > maxFinish) maxFinish = f;
                                                }
                                              }
                                            });

                                            qtyByIdOrig.forEach(qty => {
                                              totalCant += qty;
                                            });

                                            const formatSpanishResumenDate = (dt: Date | null) => {
                                              if (!dt) return '';
                                              const day = String(dt.getDate()).padStart(2, '0');
                                              const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
                                              const month = months[dt.getMonth()];
                                              const year = String(dt.getFullYear()).slice(2);
                                              return `${day}.${month}.${year}`;
                                            };

                                            const rangeText = (minStart && maxFinish) ? `${formatSpanishResumenDate(minStart)} a ${formatSpanishResumenDate(maxFinish)}` : '';
                                            const unitStr = units.size > 0 ? Array.from(units).join(', ') : '';
                                            const cantText = totalCant > 0 ? `${totalCant.toLocaleString('es-ES')} ${unitStr}`.trim() : '';

                                            return { cantText, rangeText };
                                          })();

                                          return (
                                            <div key={cwKey} className="bg-white">
                                              {/* WBS Subheader */}
                                              <div 
                                                onClick={toggleCollapse}
                                                className="px-4 py-2 hover:bg-slate-100 flex items-center justify-between cursor-pointer border-b border-slate-200 transition-colors"
                                                style={{ backgroundColor: '#f1f5f9' }}
                                              >
                                                <div className="flex items-center gap-3 text-slate-700 min-w-0 flex-1">
                                                  {isCollapsed ? (
                                                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                  ) : (
                                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                  )}
                                                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-nowrap min-w-0">
                                                      <div className="flex items-center gap-1 flex-nowrap shrink-0">
                                                        {idDisplay.map((id, idIdx) => (
                                                          <span key={idIdx} className="text-[9px] font-mono font-black text-indigo-600 bg-indigo-50/70 border border-indigo-150 px-1.5 py-0.25 rounded shrink-0">
                                                            {id}
                                                          </span>
                                                        ))}
                                                      </div>
                                                      <span className="text-[11px] font-extrabold text-indigo-950 font-sans tracking-tight uppercase truncate" title={val.wbsName}>
                                                        {val.wbsName}
                                                      </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-0.5 text-[9.5px] flex-wrap">
                                                      {wbsMetrics.cantText && (
                                                        <span className="text-slate-600 font-mono">
                                                          Cant. Total: <span className="font-bold text-slate-800">{wbsMetrics.cantText}</span>
                                                        </span>
                                                      )}
                                                      {wbsMetrics.rangeText && (
                                                        <span className="text-slate-500 font-mono">
                                                          Programación: <span className="font-bold text-indigo-950 bg-slate-100/80 px-1.5 py-0.5 rounded border border-slate-200/50">{wbsMetrics.rangeText}</span>
                                                        </span>
                                                      )}
                                                    </div>
                                                  </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <span className="px-2 py-0.5 bg-slate-50 border border-slate-200 text-indigo-650 rounded-lg text-[9px] font-bold">
                                                    {(() => {
                                                      const uCount = Array.from(new Set(val.items.map(it => cleanWbs(it.wbs).toLowerCase()))).length;
                                                      return `${uCount} ${uCount === 1 ? 'paquete' : 'paquetes'}`;
                                                    })()}
                                                  </span>
                                                </div>
                                              </div>

                                              {/* Subgroup Items Table */}
                                              {!isCollapsed && (
                                                <div className="overflow-x-auto animate-fade-in">
                                                  <table className="w-full text-left border-collapse min-w-[700px]">
                                                    <thead>
                                                      <tr className="bg-slate-50/30 border-b border-slate-150 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                                        <th className="px-3 py-2">id.Orig</th>
                                                         <th className="px-4 py-2">Activity id</th>
                                                         <th className="px-3 py-2 text-right">Cant.</th>
                                                        <th className="px-4 py-2">Descripcion</th>
                                                        {isContratados && (
                                                          <th className="px-3 py-2">Contratista</th>
                                                        )}
                                                        <th className="px-3 py-2">Status</th>
                                                        <th className="px-4 py-2">Duracion</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 text-[11px]">
                                                      {val.items.map((it) => {
                                                        const s_dt = it.start;
                                                        const f_dt = it.finish;
                                                        const { phase, percent, colorClass, phaseKey } = getExpectedPhaseText(s_dt, f_dt);
                                                        const cleanTipo = (it.tipo || '').replace(/^\d+\./, '');

                                                        let statusBadge = "bg-slate-100 text-slate-500";
                                                        const stat = (it.p6Status || it.status || '').toLowerCase();
                                                        if (stat === 'in progress' || stat.includes('curso') || stat.includes('progreso')) {
                                                          statusBadge = "bg-blue-105 text-blue-700 border border-blue-200 font-semibold";
                                                        } else if (stat === 'not started' || stat.includes('iniciado') || stat.includes('inicio')) {
                                                          statusBadge = "bg-slate-100 text-slate-600 border border-slate-200";
                                                        }

                                                        return (
                                                          <tr key={it.id} className="hover:bg-slate-50/40 transition-colors">
                                                            <td className="px-3 py-2 text-slate-500 font-medium font-mono text-[10px]">{it.idOrig || '—'}</td>
                                                             <td className="px-4 py-2 font-mono text-[9px] text-slate-400 whitespace-nowrap">{it.activityId || '—'}</td>
                                                             <td className="px-3 py-2 font-mono text-[10px] text-slate-600 text-right whitespace-nowrap">{it.cantidadCdo !== undefined && it.cantidadCdo !== null ? `${it.cantidadCdo.toLocaleString('es-ES')} ${it.unidad || it.unit || ''}`.trim() : '—'}</td>
                                                            <td className="px-4 py-2">
                                                              <div className="font-bold text-slate-750 font-sans tracking-tight truncate max-w-[280px] sm:max-w-xs md:max-w-sm lg:max-w-md" title={it.descripcion}>{it.descripcion}</div>
                                                            </td>
                                                            {isContratados && (
                                                              <td className="px-3 py-2 whitespace-nowrap">
                                                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[10px] font-bold border border-emerald-150 shadow-mini">
                                                                  {it.subcontratista || '—'}
                                                                </span>
                                                              </td>
                                                            )}
                                                            
                                                            <td className="px-3 py-2 whitespace-nowrap">
                                                              <span className={`px-2 py-0.5 rounded-md text-[9px] ${statusBadge}`}>
                                                                {it.p6Status || 'Not Started'}
                                                              </span>
                                                            </td>
                                                            <td className="px-4 py-2 max-w-xs whitespace-nowrap">
                                                               <div className="flex flex-col gap-0.5">
                                                                 <div className="text-[10.5px] font-bold text-slate-700 whitespace-nowrap">
                                                                    {(() => {
                                                                      const format = (d: any) => {
                                                                          if (!d) return '';
                                                                          const dt = new Date(d);
                                                                          if (isNaN(dt.getTime())) return '';
                                                                          const day = String(dt.getDate()).padStart(2, '0');
                                                                          const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
                                                                          const month = months[dt.getMonth()];
                                                                          const year = String(dt.getFullYear()).slice(2);
                                                                          return `${day}.${month}.${year}`;
                                                                        };
                                                                      const s = format(s_dt);
                                                                      const f = format(f_dt);
                                                                      return (s || f) ? `${s} - ${f}` : '';
                                                                    })()}
                                                                  </div>
                                                                 {s_dt && f_dt && (
                                                                   <div className="text-[9px] font-medium text-slate-500 font-mono">
                                                                     {Math.round((new Date(f_dt).getTime() - new Date(s_dt).getTime()) / (1000 * 60 * 60 * 24))} días
                                                                   </div>
                                                                 )}
                                                               </div>
                                                             </td>
                                                          </tr>
                                                        );
                                                      })}
                                                    </tbody>
                                                  </table>
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
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right side: AI Assistant Sidebar */}
                {eqAiOpen && (
                  <div className="w-96 shrink-0 bg-white flex flex-col h-full max-h-full overflow-hidden border-l border-slate-200 animate-slide-in">
                    {/* Assistant Header */}
                    <div className="p-4 bg-slate-950 text-white flex items-center justify-between shrink-0 select-none">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                        <span className="text-xs font-black uppercase tracking-wider">Inteligencia</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEqAiOpen(false)}
                        className="text-slate-400 hover:text-white font-black text-xs px-2 py-0.5 rounded hover:bg-slate-800 transition-colors"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Messages scrollarea */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-slate-50/50">
                      {eqAiMessages.map((msg, idx) => (
                        <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                          <div className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-mini ${
                            msg.role === 'user' 
                              ? 'bg-indigo-600 text-white font-medium rounded-tr-none text-left' 
                              : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none text-left'
                          }`}>
                            {msg.role !== 'user' ? (
                              <div className="prose prose-xs max-w-none text-slate-800">
                                {msg.content.split('\n').map((line, lIdx) => {
                                  // Basic markdown rendering supporting Bold text and bullets
                                  const trimmedLine = line.trim();
                                  if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
                                    const parts = trimmedLine.substring(2).split('**');
                                    return (
                                      <ul key={lIdx} className="list-disc pl-4 mb-1 last:mb-0">
                                        <li className="text-slate-800">
                                          {parts.map((p, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="font-extrabold text-slate-955">{p}</strong> : p)}
                                        </li>
                                      </ul>
                                    );
                                  }
                                  const parts = line.split('**');
                                  return (
                                    <p key={lIdx} className="mb-1 last:mb-0">
                                      {parts.map((p, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="font-extrabold text-slate-955">{p}</strong> : p)}
                                    </p>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            )}
                          </div>
                        </div>
                      ))}

                      {eqAiLoading && (
                        <div className="flex items-center gap-2 text-slate-500 text-[11px] font-bold pl-1">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                          <span>La IA está procesando...</span>
                        </div>
                      )}

                      {eqAiError && (
                        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 font-bold">
                            <AlertCircle className="w-4 h-4 text-red-500" />
                            <span>Error del Asistente</span>
                          </div>
                          <p className="font-medium text-[11px] leading-normal">{eqAiError}</p>
                        </div>
                      )}
                    </div>

                    {/* Preset Suggestions */}
                    <div className="bg-white border-t border-slate-150 shrink-0 text-left flex flex-col">
                      <button
                        type="button"
                        onClick={() => setEqAiSuggestionsOpen(prev => !prev)}
                        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors text-left select-none border-b border-slate-100"
                      >
                        <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">
                          💡 Consultas sugeridas
                        </span>
                        <span className="text-slate-400 text-[10px] font-bold">
                          {eqAiSuggestionsOpen ? '▲ Ocultar' : '▼ Mostrar'}
                        </span>
                      </button>

                      {eqAiSuggestionsOpen && (
                        <div className="p-3 flex flex-col gap-1.5 bg-slate-50/50">
                          <button
                            type="button"
                            onClick={() => handleSendPreset("¿Cuáles son los frentes de riesgo (\"Por Contratar\") más críticos en fechas?")}
                            disabled={eqAiLoading}
                            className="text-[9.5px] bg-white hover:bg-slate-100 text-slate-700 font-bold px-2 py-1.5 rounded-lg border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer text-left truncate max-w-full shadow-mini"
                          >
                            🚨 Frentes críticos por contratar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendPreset("Haz un análisis sumando cantidades por tipos de unidad (u, glb, etc.) para ver el volumen total.")}
                            disabled={eqAiLoading}
                            className="text-[9.5px] bg-white hover:bg-slate-100 text-slate-700 font-bold px-2 py-1.5 rounded-lg border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer text-left truncate max-w-full shadow-mini"
                          >
                            🔢 Sumar cantidades por unidades
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendPreset("Recomienda estrategias de aceleración para los frentes retrasados.")}
                            disabled={eqAiLoading}
                            className="text-[9.5px] bg-white hover:bg-slate-100 text-slate-700 font-bold px-2 py-1.5 rounded-lg border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer text-left truncate max-w-full shadow-mini"
                          >
                            ⚡ Plan de acción para mitigar retrasos
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Message Input */}
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendMessage();
                      }}
                      className="p-3 bg-slate-50 border-t border-slate-150 flex items-center gap-2 shrink-0"
                    >
                      <input
                        type="text"
                        value={eqAiInput}
                        onChange={e => setEqAiInput(e.target.value)}
                        placeholder="Pregúntale a la IA..."
                        disabled={eqAiLoading}
                        className="flex-1 bg-white border border-slate-250 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 disabled:opacity-70 shadow-mini"
                      />
                      <button
                        type="submit"
                        disabled={eqAiLoading || !eqAiInput.trim()}
                        className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all disabled:opacity-50 cursor-pointer shrink-0 active:scale-95 flex items-center justify-center"
                      >
                        <Send className="w-3.5 h-3.5 text-white" />
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 text-[10px] text-slate-500 font-bold flex justify-between items-center shrink-0 select-none">
                <span>CONFORMIDAD CONTROL DE PROYECTOS INTEGRADO</span>
                <span className="flex items-center gap-1 font-mono">
                  <Calendar className="w-3.5 h-3.5" /> Reference Cut Datum: 28/05/2026
                </span>
              </div>

            </div>
          </div>
        );
      })()}

        </div>
      )}
    </div>
  );
};
