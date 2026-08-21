/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Download, ChevronRight, ChevronDown, FileSpreadsheet, Check, Copy, ChevronsUpDown, ChevronsDownUp, Calendar, Filter, Search, Minus, ArrowUp, ArrowDown, RotateCcw, CheckCircle2 } from 'lucide-react';

export interface ControlSemanalTablaProps {
  actividades: any[];
  dataPlanificadoPG004?: any;
  baseVenta?: string;
}

export const ControlSemanalTabla: React.FC<ControlSemanalTablaProps> = ({
  actividades,
  dataPlanificadoPG004,
  baseVenta = 'venta',
}) => {
  const [selectedWeeks, setSelectedWeeks] = React.useState<Set<string>>(new Set());
  const [isAllSelected, setIsAllSelected] = React.useState<boolean>(true);
  const [selectedTipologias, setSelectedTipologias] = React.useState<Set<string>>(new Set());
  const [isAllTipologiasSelected, setIsAllTipologiasSelected] = React.useState<boolean>(true);
  const [isTipologiaDropdownOpen, setIsTipologiaDropdownOpen] = React.useState<boolean>(false);

  const [selectedStatuses, setSelectedStatuses] = React.useState<Set<string>>(new Set());
  const [isAllStatusSelected, setIsAllStatusSelected] = React.useState<boolean>(true);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = React.useState<boolean>(false);

  const [selectedSubCs, setSelectedSubCs] = React.useState<Set<string>>(new Set());
  const [isAllSubCsSelected, setIsAllSubCsSelected] = React.useState<boolean>(true);
  const [isSubCDropdownOpen, setIsSubCDropdownOpen] = React.useState<boolean>(false);

  const [filterVariacion, setFilterVariacion] = React.useState<'all' | 'pos' | 'neg'>('all');
  const [isVariacionDropdownOpen, setIsVariacionDropdownOpen] = React.useState<boolean>(false);
  const [excludePartidaD, setExcludePartidaD] = React.useState<boolean>(false);
  const [variacionSort, setVariacionSort] = React.useState<'asc' | 'desc'>('asc');
  const [isTipologiasSummaryOpen, setIsTipologiasSummaryOpen] = React.useState<boolean>(false);
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [filterCheckSet, setFilterCheckSet] = React.useState<'all' | 'retraso' | 'adelanto' | 'en_plazo'>('all');
  const [isCardCollapsed, setIsCardCollapsed] = React.useState<boolean>(false);
  const [isExpandMenuOpen, setIsExpandMenuOpen] = React.useState<boolean>(false);
  const [copied, setCopied] = React.useState<boolean>(false);

  // Tree filter dropdown state for week selector
  const [isWeekDropdownOpen, setIsWeekDropdownOpen] = React.useState<boolean>(false);
  const [qsYear, setQsYear] = React.useState<string>('');
  const [qsMonth, setQsMonth] = React.useState<string>('');
  const [qsDay, setQsDay] = React.useState<string>('');

  // Hierarchy expansion state
  const [expandedTipos, setExpandedTipos] = React.useState<Set<string>>(new Set());
  const [expandedRESPs, setExpandedRESPs] = React.useState<Set<string>>(new Set());
  const [expandedSCAPs, setExpandedSCAPs] = React.useState<Set<string>>(new Set());
  const [expandedSubCs, setExpandedSubCs] = React.useState<Set<string>>(new Set());
  const [expandedSubPartidas, setExpandedSubPartidas] = React.useState<Set<string>>(new Set());
  const [expandedCheckSets, setExpandedCheckSets] = React.useState<Set<string>>(new Set());

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

  const currentWeekLabel = React.useMemo(() => {
    if (isAllSelected || activeWeekSet.size === availableWeeks.length || availableWeeks.length === 0) {
      return 'Todas las Semanas (Acumulado Total)';
    }
    if (activeWeekSet.size === 0) {
      return 'Ninguna Semana Seleccionada';
    }

    const sortedActive = Array.from(activeWeekSet).sort();
    const lastActive = sortedActive[sortedActive.length - 1];
    const weeksUpToLast = availableWeeks.filter(w => w <= lastActive);

    if (sortedActive.length === weeksUpToLast.length && sortedActive.every((w, i) => w === weeksUpToLast[i])) {
      const partes = lastActive.split('-');
      const dateFormatted = partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : lastActive;
      return `Hasta ${dateFormatted} (${sortedActive.length} sem)`;
    }

    if (sortedActive.length === 1) {
      const partes = sortedActive[0].split('-');
      const dateFormatted = partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : sortedActive[0];
      return `${dateFormatted}`;
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
  const fmtDNum = (d: number) => d < 0 
    ? `($${Math.abs(d).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` 
    : `$${(d || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

    const ejecDict = (item.certificacionesPorFecha && Object.keys(item.certificacionesPorFecha).length > 0)
      ? item.certificacionesPorFecha
      : null;

    const hasDatePlanDict = !!(planDict && Object.keys(planDict).some(k => /^\d{4}-\d{2}-\d{2}$/.test(k)));
    const hasDateEjecDict = !!(ejecDict && Object.keys(ejecDict).some(k => /^\d{4}-\d{2}-\d{2}$/.test(k)));

    const isTotalMode = isAllSelected || activeWeekSet.size === availableWeeks.length;

    if (isTotalMode) {
      if (hasDatePlanDict) {
        vPlan = Object.entries(planDict).reduce((sum: number, [k, val]: [string, any]) => {
          return sum + (/^\d{4}-\d{2}-\d{2}$/.test(k) ? (Number(val) || 0) : 0);
        }, 0);
      } else {
        vPlan = item.ventaPlan || 0;
      }

      if (hasDateEjecDict) {
        const sumEjec = Object.entries(ejecDict).reduce((sum: number, [k, val]: [string, any]) => {
          return sum + (/^\d{4}-\d{2}-\d{2}$/.test(k) ? (Number(val) || 0) : 0);
        }, 0);
        vEjec = sumEjec > 0 ? sumEjec : (item.ventaEjecutada || 0);
      } else {
        vEjec = item.ventaEjecutada || 0;
      }
    } else {
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

    const vContrato = getVB(item);
    const variacion = vEjec - vPlan;

    return { vPlan, vEjec, vContrato, variacion };
  }, [isAllSelected, activeWeekSet, availableWeeks.length, dataPlanificadoPG004, planificadoPG004LowerIndex, baseVenta]);

  const getItemPrecio = React.useCallback((item: any): number => {
    if (item.precio && typeof item.precio === 'number' && item.precio > 0) {
      return item.precio;
    }
    const v = baseVenta === 'contrato' ? (item.ventaM || 0) : (item.venta || 0);
    const q = item.cantidadCdo;
    if (v > 0 && typeof q === 'number' && q > 0) {
      return v / q;
    }
    return 0;
  }, [baseVenta]);

  const getCantidadTooltipForItem = React.useCallback((item: any, valorEcon: number, label: string) => {
    let extraInfo = '';
    if (label.includes('Plan')) {
      const acumPlan = item.ventaPlan || 0;
      extraInfo = `💰 Acum. Planificado (AS): $${acumPlan.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    } else if (label.includes('Ejec.')) {
      const acumEjec = item.ventaEjecutada || 0;
      extraInfo = `💰 Acum. Ejecutado (AV): $${acumEjec.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
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

  const getCantidadTooltipForGroup = React.useCallback((items: any[], type: 'contrato' | 'plan' | 'ejec' | 'desv', label: string) => {
    if (!items || items.length === 0) return undefined;
    let totalCant = 0;
    let itemsCountWithPrice = 0;
    const unitsSet = new Set<string>();

    items.forEach(item => {
      const p = getItemPrecio(item);
      if (p > 0) {
        const { vPlan, vEjec, vContrato, variacion } = getItemWeekValues(item);
        let val = 0;
        if (type === 'contrato') val = vContrato;
        else if (type === 'plan') val = vPlan;
        else if (type === 'ejec') val = vEjec;
        else if (type === 'desv') val = variacion;

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
    setExcludePartidaD(false);
    setFilterVariacion('all');
    setSearchQuery('');
    setFilterCheckSet('all');
  }, []);

  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (!isAllSelected && selectedWeeks.size > 0 && selectedWeeks.size < availableWeeks.length) count++;
    if (!isAllTipologiasSelected && selectedTipologias.size > 0 && selectedTipologias.size < tipologíasDisponibles.length) count++;
    if (!isAllStatusSelected && selectedStatuses.size > 0 && selectedStatuses.size < statusDisponibles.length) count++;
    if (!isAllSubCsSelected && selectedSubCs.size > 0 && selectedSubCs.size < subCsDisponibles.length) count++;
    if (excludePartidaD) count++;
    if (filterVariacion !== 'all') count++;
    if (searchQuery.trim() !== '') count++;
    if (filterCheckSet !== 'all') count++;
    return count;
  }, [
    isAllSelected, selectedWeeks.size, availableWeeks.length,
    isAllTipologiasSelected, selectedTipologias.size, tipologíasDisponibles.length,
    isAllStatusSelected, selectedStatuses.size, statusDisponibles.length,
    isAllSubCsSelected, selectedSubCs.size, subCsDisponibles.length,
    excludePartidaD, filterVariacion, searchQuery, filterCheckSet
  ]);

  const hasActiveFilters = activeFiltersCount > 0;
  const isPartidaD = React.useCallback((item: any): boolean => {
    if (!item) return false;
    const rawWbs = String(item.wbs || item.wbsPath || '').trim();
    if (rawWbs) {
      const normWbs = rawWbs.replace(/^p\d{4}\./i, 'p.').toLowerCase();
      if (normWbs === 'p.d' || normWbs.startsWith('p.d.')) return true;
      const lowerRaw = rawWbs.toLowerCase();
      if (lowerRaw === 'd' || lowerRaw.startsWith('d.') || lowerRaw.startsWith('p.d')) return true;
    }
    const partidaStr = String(item.partida || '').trim().toLowerCase();
    if (partidaStr) {
      if (partidaStr === 'd' || partidaStr.startsWith('p.d') || partidaStr.startsWith('d.')) return true;
    }
    return false;
  }, []);

  const leafItems = React.useMemo(() => {
    if (!actividades) return [];
    const isTotalMode = isAllSelected || activeWeekSet.size === availableWeeks.length;

    return actividades.filter(item => {
      if (!item.esItemHoja) return false;

      if (excludePartidaD && isPartidaD(item)) return false;

      const { vPlan, vEjec, variacion } = getItemWeekValues(item);

      if (!isTotalMode) {
        if (vPlan === 0 && vEjec === 0) return false;
      } else {
        if (vPlan === 0 && vEjec === 0 && (item.ventaPlan || 0) === 0 && (item.ventaEjecutada || 0) === 0) return false;
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

      // Exclude cent-level negative variations (e.g. -0.01 to -0.99) caused by rounding from Retrasos
      if (filterVariacion === 'neg' && variacion >= -1) return false;
      if (filterVariacion === 'pos' && variacion <= 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const wbs = String(item.wbs || '').toLowerCase();
        const act = String(item.activityId || '').toLowerCase();
        const desc = String(item.descripcion || '').toLowerCase();
        const sub = String(item.subcontratista || item.subC || '').toLowerCase();
        if (!wbs.includes(q) && !act.includes(q) && !desc.includes(q) && !sub.includes(q)) {
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
    filterVariacion, searchQuery, excludePartidaD, isPartidaD, filterCheckSet
  ]);

  // Summary per Tipología for summary cards
  const tipologiasSummary = React.useMemo(() => {
    if (!actividades) return [];
    const map: Record<string, { nombre: string; ventaPlan: number; ventaEjecutada: number; ventaContrato: number; items: number }> = {};

    const isTotalMode = isAllSelected || activeWeekSet.size === availableWeeks.length;

    actividades.forEach(item => {
      if (!item.esItemHoja) return;

      if (excludePartidaD && isPartidaD(item)) return;

      const { vPlan, vEjec, vContrato, variacion } = getItemWeekValues(item);

      if (!isTotalMode) {
        if (vPlan === 0 && vEjec === 0) return;
      } else {
        if (vPlan === 0 && vEjec === 0 && (item.ventaPlan || 0) === 0 && (item.ventaEjecutada || 0) === 0) return;
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
    filterVariacion, searchQuery, excludePartidaD, isPartidaD
  ]);

  // Hierarchical grouping: Tipo -> Grupo -> CAP -> SCAP -> SubC -> Items
  const byTipo = React.useMemo(() => {
    const tree: Record<string, any> = {};
    leafItems.forEach(item => {
      const t = item.tipo || '(Sin Tipo)';
      const g = item.grupo || '(Sin Grupo)';
      const c = item.cap || '(Sin CAP)';
      const s = item.scap || '(Sin SCAP)';
      const subC = (item.subcontratista || item.subC || '').trim() || '(Sin SubC)';
      if (!tree[t]) tree[t] = {};
      if (!tree[t][g]) tree[t][g] = {};
      if (!tree[t][g][c]) tree[t][g][c] = {};
      if (!tree[t][g][c][s]) tree[t][g][c][s] = {};
      if (!tree[t][g][c][s][subC]) tree[t][g][c][s][subC] = [];
      tree[t][g][c][s][subC].push(item);
    });
    return tree;
  }, [leafItems]);

  const tot = React.useCallback((itemsArr: any[]) => {
    let plan = 0;
    let ejec = 0;
    let contrato = 0;
    let maxBlFinish: Date | null = null;

    itemsArr.forEach(i => {
      const { vPlan, vEjec, vContrato } = getItemWeekValues(i);
      plan += vPlan;
      ejec += vEjec;
      contrato += vContrato;

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

  const globalTot = React.useMemo(() => tot(leafItems), [tot, leafItems]);

  const checkSetSummary = React.useMemo(() => {
    const summary: Record<string, {
      checkSetProps: any,
      tipologias: Record<string, { plan: number, ejec: number, desv: number, count: number }>,
      totalPlan: number,
      totalEjec: number,
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
          totalDesv: 0,
          totalCount: 0
        };
      }
      
      const tipo = item.tipo || 'Sin Tipo';
      if (!summary[csKey].tipologias[tipo]) {
        summary[csKey].tipologias[tipo] = { plan: 0, ejec: 0, desv: 0, count: 0 };
      }
      
      const { vPlan, vEjec, variacion } = getItemWeekValues(item);
      
      summary[csKey].tipologias[tipo].plan += vPlan;
      summary[csKey].tipologias[tipo].ejec += vEjec;
      summary[csKey].tipologias[tipo].desv += variacion;
      summary[csKey].tipologias[tipo].count += 1;
      
      summary[csKey].totalPlan += vPlan;
      summary[csKey].totalEjec += vEjec;
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


  const sortedTipos = React.useMemo(() => {
    return Object.entries(byTipo).sort((a, b) => {
      const itemsA = Object.values(a[1]).flatMap((g: any) => Object.values(g).flatMap((c: any) => Object.values(c).flatMap((s: any) => Object.values(s).flat())));
      const itemsB = Object.values(b[1]).flatMap((g: any) => Object.values(g).flatMap((c: any) => Object.values(c).flatMap((s: any) => Object.values(s).flat())));
      const desvA = tot(itemsA).desv;
      const desvB = tot(itemsB).desv;
      return desvA - desvB;
    });
  }, [byTipo, tot]);

  const handleExpandToLevel = (targetLevel: number) => {
    const allTipos = new Set<string>();
    const allGrupos = new Set<string>();
    const allCaps = new Set<string>();
    const allScaps = new Set<string>();
    const allSubCs = new Set<string>();

    sortedTipos.forEach(([tipo, grupos]) => {
      allTipos.add(tipo);
      if (targetLevel >= 2) {
        Object.entries(grupos).forEach(([grupo, caps]: any) => {
          const gKey = `${tipo}__${grupo}`;
          allGrupos.add(gKey);
          if (targetLevel >= 3) {
            Object.entries(caps).forEach(([cap, scaps]: any) => {
              const capKey = `${gKey}__${cap}`;
              allCaps.add(capKey);
              if (targetLevel >= 4) {
                Object.entries(scaps).forEach(([scap, subCs]: any) => {
                  const sKey = `${capKey}__${scap}`;
                  allScaps.add(sKey);
                  if (targetLevel >= 5) {
                    Object.entries(subCs).forEach(([subC]: any) => {
                      allSubCs.add(`${sKey}__${subC}`);
                    });
                  }
                });
              }
            });
          }
        });
      }
    });

    setExpandedTipos(targetLevel >= 1 ? allTipos : new Set());
    setExpandedRESPs(targetLevel >= 2 ? allGrupos : new Set());
    setExpandedSubPartidas(targetLevel >= 3 ? allCaps : new Set());
    setExpandedSCAPs(targetLevel >= 4 ? allScaps : new Set());
    setExpandedSubCs(targetLevel >= 5 ? allSubCs : new Set());
  };

  const handleCollapseAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTipos(new Set());
    setExpandedRESPs(new Set());
    setExpandedSCAPs(new Set());
    setExpandedSubCs(new Set());
    setExpandedSubPartidas(new Set());
  };

  const handleCopyTableForExcel = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const tsvRows: string[] = [];
    tsvRows.push(["WBS / Nivel Jerárquico", "Activity ID", "Descripción", "BL Finish", "V. Contrato", "V.Plan", "V.Ejec", "Variación", "% Avance", "Check Set"].join("\t"));

    const htmlRowsArray: string[] = [];

    const hasAnyExpanded = expandedTipos.size > 0 || expandedRESPs.size > 0 || expandedSubPartidas.size > 0 || expandedSCAPs.size > 0 || expandedSubCs.size > 0;
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
      checkSetText: string = ''
    ) => {
      const pctAvance = vPlan > 0 ? (vEjec / vPlan * 100) : (vEjec > 0 ? 100 : 0);
      const pctStr = `${pctAvance.toFixed(2)}%`;
      const desvColor = desv < 0 ? '#b91c1c' : '#15803d';

      tsvRows.push([
        wbsText,
        actId,
        desc,
        blFinishStr,
        fmtMoney(vContrato),
        fmtMoney(vPlan),
        fmtMoney(vEjec),
        fmtMoney(desv),
        pctStr,
        checkSetText
      ].join("\t"));

      const indentSpaces = "&nbsp;".repeat(indentCount * 2);
      const paddingLeft = 4 + (indentCount * 5);

      // Explicit inline styles on every td for full Excel background fill & typography hierarchy
      htmlRowsArray.push(`
        <tr style="background-color: ${bg}; color: ${fg}; font-weight: ${fontWeight}; font-size: ${fontSize};">
          <td style="padding: 6px 10px; padding-left: ${paddingLeft}px; border: 1px solid #cbd5e1; font-family: Calibri, Arial, sans-serif; background-color: ${bg}; color: ${fg}; font-weight: ${fontWeight}; mso-number-format: '\\@';">${indentSpaces}${wbsText}</td>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-family: Calibri, Arial, sans-serif; background-color: ${bg}; color: ${fg}; font-weight: ${fontWeight}; mso-number-format: '\\@';">${actId}</td>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-family: Calibri, Arial, sans-serif; background-color: ${bg}; color: ${fg}; font-weight: ${fontWeight};">${desc}</td>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: center; font-family: Calibri, Arial, sans-serif; background-color: ${bg}; color: ${fg};">${blFinishStr}</td>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: Calibri, Arial, sans-serif; background-color: ${bg}; color: ${fg}; font-weight: ${fontWeight}; mso-number-format: '\\$#,##0.00';">$${fmtMoney(vContrato)}</td>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: Calibri, Arial, sans-serif; background-color: ${bg}; color: ${fg === '#ffffff' ? '#ffffff' : '#1d4ed8'}; font-weight: ${fontWeight}; mso-number-format: '\\$#,##0.00';">$${fmtMoney(vPlan)}</td>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: Calibri, Arial, sans-serif; background-color: ${bg}; color: ${fg === '#ffffff' ? '#ffffff' : '#15803d'}; font-weight: ${fontWeight}; mso-number-format: '\\$#,##0.00';">$${fmtMoney(vEjec)}</td>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: Calibri, Arial, sans-serif; background-color: ${bg}; color: ${fg === '#ffffff' ? '#ffffff' : desvColor}; font-weight: bold; mso-number-format: '\\$#,##0.00';">${fmtDNum(desv)}</td>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: Calibri, Arial, sans-serif; background-color: ${bg}; color: ${fg}; font-weight: ${fontWeight}; mso-number-format: '0.00%';">${pctStr}</td>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: center; font-family: Calibri, Arial, sans-serif; background-color: ${bg}; color: ${fg}; font-weight: ${fontWeight};">${checkSetText}</td>
        </tr>
      `.trim());
    };

    // TOTAL PROYECTO ROW (Top)
    addRowHtml('TOTAL FILTRADO', '', `(${leafItems.length.toLocaleString()} items)`, fmtDateVal(globalTot.maxBlFinish), globalTot.contrato, globalTot.plan, globalTot.ejec, globalTot.desv, '#1e1b4b', '#ffffff', 'bold', '11.5px', 0, getAccumulatedCheckSet(leafItems).text);

    sortedTipos.forEach(([tipo, grupos]) => {
      const allItemsInTipo = Object.values(grupos).flatMap((g: any) => Object.values(g).flatMap((c: any) => Object.values(c).flatMap((s: any) => Object.values(s).flat())));
      if (allItemsInTipo.length === 0) return;
      const tT = tot(allItemsInTipo);

      // N1: Tipo
      addRowHtml(`🏷️ ${tipo}`, '', `(${tT.count} items)`, fmtDateVal(tT.maxBlFinish), tT.contrato, tT.plan, tT.ejec, tT.desv, '#1e1b4b', '#ffffff', 'bold', '11px', 0, getAccumulatedCheckSet(allItemsInTipo).text);

      const isTipoExp = isAll || expandedTipos.has(tipo);
      if (isTipoExp) {
        Object.entries(grupos).forEach(([grupo, caps]: any) => {
          const grupoKey = `${tipo}__${grupo}`;
          const allG = Object.values(caps).flatMap((c: any) => Object.values(c).flatMap((s: any) => Object.values(s).flat()));
          if (allG.length === 0) return;
          const gT = tot(allG);

          // N2: Grupo
          addRowHtml(`📁 ${grupo}`, '', `(${gT.count} items)`, fmtDateVal(gT.maxBlFinish), gT.contrato, gT.plan, gT.ejec, gT.desv, '#f3e8ff', '#3b0764', 'bold', '11px', 1, getAccumulatedCheckSet(allG).text);

          const isGrupoExp = isAll || expandedRESPs.has(grupoKey);
          if (isGrupoExp) {
            Object.entries(caps).forEach(([cap, scaps]: any) => {
              const capKey = `${grupoKey}__${cap}`;
              const allCap = Object.values(scaps).flatMap((s: any) => Object.values(s).flat());
              if (allCap.length === 0) return;
              const cT = tot(allCap);

              // N3: Subpartida / CAP
              addRowHtml(`📄 ${cap}`, '', `(${cT.count} items)`, fmtDateVal(cT.maxBlFinish), cT.contrato, cT.plan, cT.ejec, cT.desv, '#d1fae5', '#064e3b', 'bold', '10.5px', 2);

              const isCapExp = isAll || expandedSubPartidas.has(capKey);
              if (isCapExp) {
                Object.entries(scaps).forEach(([scap, subCs]: any) => {
                  const scapKey = `${capKey}__${scap}`;
                  const allS = Object.values(subCs).flat();
                  if (allS.length === 0) return;
                  const sT = tot(allS);

                  // N4: SCAP
                  addRowHtml(`📦 ${scap}`, '', `(${sT.count} items)`, fmtDateVal(sT.maxBlFinish), sT.contrato, sT.plan, sT.ejec, sT.desv, '#e0f2fe', '#082f49', 'bold', '10.5px', 3);

                  const isScapExp = isAll || expandedSCAPs.has(scapKey);
                  if (isScapExp) {
                    Object.entries(subCs).forEach(([subC, items]: any) => {
                      const subCKey = `${scapKey}__${subC}`;
                      if (!Array.isArray(items) || items.length === 0) return;
                      const subCTot = tot(items);

                      // N5: Subcontratista
                      addRowHtml(`🏗️ SubC: ${subC}`, '', `(${subCTot.count} items)`, fmtDateVal(subCTot.maxBlFinish), subCTot.contrato, subCTot.plan, subCTot.ejec, subCTot.desv, '#fef3c7', '#451a03', 'bold', '10px', 4, getAccumulatedCheckSet(items).text);

                      const isSubCExp = isAll || expandedSubCs.has(subCKey);
                      if (isSubCExp) {
                        // N6: Leaf items
                        items.forEach((item: any) => {
                          const { vPlan, vEjec, vContrato, variacion } = getItemWeekValues(item);
                          addRowHtml(String(item.wbs || '').trim(), item.activityId || '', item.descripcion || '', fmtDateVal(item.blFinish), vContrato, vPlan, vEjec, variacion, '#ffffff', '#334155', 'normal', '9.5px', 5, getAccumulatedCheckSet([item]).text);
                        });
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }
    });

    const tsvContent = tsvRows.join("\n");
    const htmlRows = htmlRowsArray.join("\n");

    const htmlContent = `
      <table style="border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11px; color: #1e293b; width: 100%;">
        <thead>
          <tr style="background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: left;">
            <th style="padding: 8px 10px; border: 1px solid #64748b; background-color: #1e1b4b; color: #ffffff; font-weight: bold;">WBS / Nivel Jerárquico</th>
            <th style="padding: 8px 10px; border: 1px solid #64748b; background-color: #1e1b4b; color: #ffffff; font-weight: bold;">Activity ID</th>
            <th style="padding: 8px 10px; border: 1px solid #64748b; background-color: #1e1b4b; color: #ffffff; font-weight: bold;">Descripción</th>
            <th style="padding: 8px 10px; border: 1px solid #64748b; background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: center;">BL Finish</th>
            <th style="padding: 8px 10px; border: 1px solid #64748b; background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: right;">V. Contrato</th>
            <th style="padding: 8px 10px; border: 1px solid #64748b; background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: right;">V.Plan</th>
            <th style="padding: 8px 10px; border: 1px solid #64748b; background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: right;">V.Ejec</th>
            <th style="padding: 8px 10px; border: 1px solid #64748b; background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: right;">Variación</th>
            <th style="padding: 8px 10px; border: 1px solid #64748b; background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: right;">% Avance</th>
            <th style="padding: 8px 10px; border: 1px solid #64748b; background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: center;">Check Set</th>
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

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-indigo-600 overflow-hidden animate-fade-in mt-6" id="tarjeta-kpi-avance-semanal">
      {/* Header Bar */}
      <div 
        onClick={() => setIsCardCollapsed(!isCardCollapsed)}
        className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 px-5 py-4 text-white flex items-center justify-between flex-wrap gap-3 cursor-pointer select-none hover:opacity-95 transition-all"
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
            <p className="text-xs text-indigo-200/80 font-medium mt-0.5">
              Valores económicos planificados desde PG-004 (col H+) y ejecutados desde CDO (col AY+ con casilla 'V-') por semana.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
          {/* Expandir por Nivel Dropdown */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setIsExpandMenuOpen(!isExpandMenuOpen); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-500/40 bg-indigo-700/80 hover:bg-indigo-600 text-white transition-all text-xs font-bold shadow-sm shrink-0 cursor-pointer active:scale-95"
            >
              <ChevronsUpDown className="w-4 h-4 text-indigo-200" />
              <span>Exp. Nivel</span>
              <ChevronDown className="w-3 h-3 text-indigo-300 ml-0.5" />
            </button>

            {isExpandMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setIsExpandMenuOpen(false); }} />
                <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1 text-xs animate-fade-in select-none text-slate-800">
                  <div className="px-3 py-1 font-semibold text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-100">
                    Expandir Jerarquía
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleExpandToLevel(1); setIsExpandMenuOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-slate-700 font-medium flex items-center justify-between">
                    <span>Nivel 1: Tipologías</span>
                    <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-mono font-bold">N1</span>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleExpandToLevel(2); setIsExpandMenuOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-purple-50 text-slate-700 font-medium flex items-center justify-between">
                    <span>Nivel 2: Grupos</span>
                    <span className="text-[9px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-mono font-bold">N2</span>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleExpandToLevel(3); setIsExpandMenuOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-slate-700 font-medium flex items-center justify-between">
                    <span>Nivel 3: Subpartidas (CAP)</span>
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">N3</span>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleExpandToLevel(4); setIsExpandMenuOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-sky-50 text-slate-700 font-medium flex items-center justify-between">
                    <span>Nivel 4: SCAPs</span>
                    <span className="text-[9px] bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-mono font-bold">N4</span>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleExpandToLevel(5); setIsExpandMenuOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-amber-50 text-slate-700 font-medium flex items-center justify-between border-t border-slate-100">
                    <span>Nivel 5: Subcontratistas</span>
                    <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-mono font-bold">N5</span>
                  </button>
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

      {!isCardCollapsed && (
        <div className="p-5 space-y-4">
          {/* Controls Bar: Semana Filter, Tipología Filter, Status Filter, Variación Filter & Search */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-wrap items-end gap-3">
            {/* Filter by Week / Period (Desplegable Jerárquico con Selección Múltiple) */}
            <div className="relative flex-1 min-w-[240px]" id="contenedor-desplegable-semanal">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Filtrar por Período / Semana:</span>
              </label>
              
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsWeekDropdownOpen(!isWeekDropdownOpen);
                }}
                className="w-full text-xs bg-white border border-slate-300 hover:border-indigo-400 rounded-xl px-3 py-2 font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center justify-between gap-2 text-left transition-all cursor-pointer"
              >
                <span className="truncate flex items-center gap-1.5">
                  <span className="text-indigo-600 font-bold">📅</span>
                  <span>{currentWeekLabel}</span>
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
                    className="absolute left-0 right-0 mt-1 max-h-96 overflow-y-auto bg-white border border-indigo-200 rounded-2xl shadow-2xl z-50 p-2 text-xs animate-fade-in select-none"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-2 py-1 mb-1.5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Selección Múltiple</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handleSelectAll}
                          className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md transition-all cursor-pointer"
                        >
                          ✓ Seleccionar Todo
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

                    {/* Quick Selection Dropdown Menu */}
                    <div className="px-2 py-2 mb-2 border-b border-slate-100 bg-indigo-50/40 rounded-lg mx-1">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Acción rápida por semana
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
                            className="flex-1 text-[10px] font-bold px-2 py-1.5 rounded-md bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
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
                            className="flex-1 text-[10px] font-bold px-2 py-1.5 rounded-md bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                          >
                            Hasta aquí
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>
                </>
              )}
            </div>

            {/* Filter by Tipología */}
            <div className="relative flex-1 min-w-[200px]" id="contenedor-desplegable-tipologia">
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

            {/* Filter by Status (Col. W CDO) */}
            <div className="relative flex-1 min-w-[180px]" id="contenedor-desplegable-status">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5 truncate">
                <Filter className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="truncate">Status (Col. W):</span>
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
            <div className="flex flex-col justify-end min-w-[170px]" id="contenedor-filtro-partida-d">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5 truncate">
                <Filter className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="truncate">Partida D (WBS):</span>
              </label>
              <button
                type="button"
                onClick={() => setExcludePartidaD(!excludePartidaD)}
                className={`w-full text-xs font-bold rounded-xl px-3 py-2 border transition-all flex items-center justify-between gap-2 cursor-pointer shadow-xs ${
                  excludePartidaD
                    ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 ring-2 ring-amber-400/50 font-bold'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
                title={excludePartidaD ? "Mostrando sin Partida D. Haz clic para incluir Partida D." : "Haz clic para quitar todo lo que pertenece a la Partida D de la WBS"}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <span className="text-sm">{excludePartidaD ? '🚫' : '📁'}</span>
                  <span className="truncate">{excludePartidaD ? 'Sin Partida D' : 'Con Partida D'}</span>
                </span>
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                  excludePartidaD ? 'bg-amber-600 border-amber-600 text-white' : 'border-slate-300 bg-white'
                }`}>
                  {excludePartidaD && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </div>
              </button>
            </div>

            {/* Filter by Variación (Dropdown) */}
            <div className="relative flex-1 min-w-[180px]" id="contenedor-desplegable-variacion">
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
            <div className="relative flex-1 min-w-[180px]" id="contenedor-desplegable-subc">
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
                    <div className="px-2 py-1 mb-1.5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-1">
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

                    <div className="space-y-1">
                      {subCsDisponibles.length === 0 ? (
                        <div className="p-3 text-center text-slate-400 italic">No hay SubC disponibles</div>
                      ) : (
                        subCsDisponibles.map(sub => {
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
          </div>

          {/* KPI Resumen Pill Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-indigo-50/60 border border-indigo-200/80 rounded-2xl p-3.5 text-center">
              <span className="text-[10px] font-extrabold uppercase text-indigo-600 tracking-wider block mb-0.5">Planificado (PG-004)</span>
              <span className="text-base font-extrabold text-indigo-900 font-mono">${fmtMoney(globalTot.plan)}</span>
            </div>
            <div className="bg-rose-50/60 border border-rose-200/80 rounded-2xl p-3.5 text-center">
              <span className="text-[10px] font-extrabold uppercase text-rose-600 tracking-wider block mb-0.5">Ejecutado (CDO V-)</span>
              <span className="text-base font-extrabold text-rose-900 font-mono">${fmtMoney(globalTot.ejec)}</span>
            </div>
            <div className={`border rounded-2xl p-3.5 text-center ${globalTot.desv < 0 ? 'bg-amber-50/60 border-amber-200/80' : 'bg-emerald-50/60 border-emerald-200/80'}`}>
              <span className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider block mb-0.5">Variación Económica</span>
              <span className={`text-base font-extrabold font-mono ${globalTot.desv < 0 ? 'text-amber-800' : 'text-emerald-800'}`}>
                {fmtDNum(globalTot.desv)}
              </span>
            </div>
            <div className="bg-slate-100 border border-slate-200 rounded-2xl p-3.5 text-center">
              <span className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider block mb-0.5">% Avance Económico</span>
              <span className="text-base font-extrabold text-slate-800 font-mono">
                {globalTot.plan > 0 ? `${((globalTot.ejec / globalTot.plan) * 100).toFixed(2)}%` : '—'}
              </span>
            </div>
          </div>

          {/* Tarjetas de Análisis por Tipología (Menu Colapsable) */}
          {tipologiasSummary.length > 0 && (
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

          {/* Table Container */}
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-indigo-50/80 border border-indigo-100 px-3.5 py-2 rounded-xl text-[11px] text-indigo-900 font-medium shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="text-sm">💡</span>
                <span>
                  <strong>Tip de Cantidades:</strong> Pasa el cursor (hover) sobre los valores de <strong>V. Contrato, V. Plan, V. Ejec. o Variación</strong> para ver la cantidad resultante.
                </span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr className="bg-indigo-950 text-white font-extrabold text-[11px] text-left">
                  <th className="px-3.5 py-3 border-b border-indigo-800">WBS / Nivel Jerárquico</th>
                  <th className="px-3.5 py-3 border-b border-indigo-800">Activity ID</th>
                  <th className="px-3.5 py-3 border-b border-indigo-800 max-w-[200px] w-[200px]">Descripción</th>
                  <th className="px-3.5 py-3 border-b border-indigo-800 text-center">BL Finish</th>
                  <th className="px-3.5 py-3 border-b border-indigo-800 text-right">V. Contrato</th>
                  <th className="px-3.5 py-3 border-b border-indigo-800 text-right text-indigo-200">V.Plan</th>
                  <th className="px-3.5 py-3 border-b border-indigo-800 text-right text-rose-200">V.Ejec</th>
                  <th 
                    className="px-3.5 py-3 border-b border-indigo-800 text-right cursor-pointer select-none hover:bg-indigo-900/80 transition-colors"
                    onClick={() => setVariacionSort(prev => prev === 'asc' ? 'desc' : 'asc')}
                    title="Clic para cambiar el orden por Variación"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Variación</span>
                      {variacionSort === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-indigo-200 stroke-[2.5]" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-indigo-200 stroke-[2.5]" />
                      )}
                    </div>
                  </th>
                  <th className="px-3.5 py-3 border-b border-indigo-800 text-right">% Avance</th>
                  <th className="px-3.5 py-3 border-b border-indigo-800 text-center">Check Set</th>
                </tr>
              </thead>
              <tbody className="bg-indigo-950 text-white font-extrabold text-xs shadow-md z-10 sticky top-0">
                <tr>
                  <td className="px-3.5 py-3 border-t border-indigo-800" colSpan={3}>
                    TOTAL FILTRADO ({leafItems.length.toLocaleString()} ítems)
                  </td>
                  <td className="px-3.5 py-3 border-t border-indigo-800 text-center font-mono text-[10px] text-indigo-200">
                    {fmtDateVal(globalTot.maxBlFinish)}
                  </td>
                  <td className="px-3.5 py-3 border-t border-indigo-800 text-right font-mono">
                    ${fmtMoney(globalTot.contrato)}
                  </td>
                  <td className="px-3.5 py-3 border-t border-indigo-800 text-right font-mono text-indigo-200">
                    ${fmtMoney(globalTot.plan)}
                  </td>
                  <td className="px-3.5 py-3 border-t border-indigo-800 text-right font-mono text-rose-200">
                    ${fmtMoney(globalTot.ejec)}
                  </td>
                  <td className="px-3.5 py-3 border-t border-indigo-800 text-right font-mono">
                    {fmtDNum(globalTot.desv)}
                  </td>
                  <td className="px-3.5 py-3 border-t border-indigo-800 text-right font-mono">
                    {globalTot.plan > 0 ? `${((globalTot.ejec / globalTot.plan) * 100).toFixed(2)}%` : '—'}
                  </td>
                  <td className="px-3.5 py-3 border-t border-indigo-800 text-center font-mono">
                    {(() => {
                      const csTot = getAccumulatedCheckSet(leafItems);
                      return (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${csTot.bg} ${csTot.textC}`}>
                          <span className={`w-1 h-1 rounded-full ${csTot.dot}`}></span>{csTot.text}
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              </tbody>
              <tbody className="divide-y divide-slate-100">
                {sortedTipos.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400 font-medium">
                      No hay datos para la semana y filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  sortedTipos.map(([tipo, grupos]) => {
                    const allItemsInTipo = Object.values(grupos).flatMap((g: any) => Object.values(g).flatMap((c: any) => Object.values(c).flatMap((s: any) => Object.values(s).flat())));
                    if (allItemsInTipo.length === 0) return null;
                    const tT = tot(allItemsInTipo);
                    const isTipoExp = expandedTipos.has(tipo);
                    const pctTipo = tT.plan > 0 ? (tT.ejec / tT.plan * 100) : (tT.ejec > 0 ? 100 : 0);
                    const csTipo = getAccumulatedCheckSet(allItemsInTipo);

                    return (
                      <React.Fragment key={tipo}>
                        {/* N1: TIPOLOGIA */}
                        <tr 
                          onClick={() => setExpandedTipos(prev => {
                            const next = new Set(prev);
                            if (next.has(tipo)) next.delete(tipo); else next.add(tipo);
                            return next;
                          })}
                          className="bg-indigo-900 text-white hover:bg-indigo-950 font-extrabold cursor-pointer transition-colors border-b border-indigo-950 shadow-xs"
                        >
                          <td className="px-2 py-2 pl-2 flex items-center gap-1.5">
                            {isTipoExp ? <ChevronDown className="w-3.5 h-3.5 text-indigo-200 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-indigo-200 shrink-0" />}
                            <span>🏷️ {tipo}</span>
                          </td>
                          <td className="px-2 py-2 font-mono text-[10px] text-indigo-200">({tT.count} items)</td>
                          <td className="px-2 py-2"></td>
                          <td className="px-2 py-2 text-center font-mono text-[10px] text-indigo-100">{fmtDateVal(tT.maxBlFinish)}</td>
                          <td className="px-2 py-2 text-right font-mono text-white cursor-help" title={getCantidadTooltipForGroup(allItemsInTipo, 'contrato', 'V. Contrato')}>${fmtMoney(tT.contrato)}</td>
                          <td className="px-2 py-2 text-right font-mono text-indigo-200 cursor-help" title={getCantidadTooltipForGroup(allItemsInTipo, 'plan', 'V.Plan')}>${fmtMoney(tT.plan)}</td>
                          <td className="px-2 py-2 text-right font-mono text-rose-300 cursor-help" title={getCantidadTooltipForGroup(allItemsInTipo, 'ejec', 'V.Ejec')}>${fmtMoney(tT.ejec)}</td>
                          <td className={`px-2 py-2 text-right font-mono font-black cursor-help ${tT.desv < 0 ? 'text-rose-300' : 'text-emerald-300'}`} title={getCantidadTooltipForGroup(allItemsInTipo, 'desv', 'Variación')}>{fmtDNum(tT.desv)}</td>
                          <td className="px-2 py-2 text-right font-mono text-white">{pctTipo.toFixed(2)}%</td>
                          <td className="px-2 py-2 text-center font-mono"><span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${csTipo.bg} ${csTipo.textC}`}><span className={`w-1 h-1 rounded-full ${csTipo.dot}`}></span>{csTipo.text}</span></td>
                        </tr>

                        {isTipoExp && Object.entries(grupos).sort((a: any, b: any) => {
                          const desvA = tot(Object.values(a[1]).flatMap((c: any) => Object.values(c).flatMap((s: any) => Object.values(s).flat()))).desv;
                          const desvB = tot(Object.values(b[1]).flatMap((c: any) => Object.values(c).flatMap((s: any) => Object.values(s).flat()))).desv;
                          return variacionSort === 'asc' ? desvA - desvB : desvB - desvA;
                        }).map(([grupo, caps]: any) => {
                          const grupoKey = `${tipo}__${grupo}`;
                          const allG = Object.values(caps).flatMap((c: any) => Object.values(c).flatMap((s: any) => Object.values(s).flat()));
                          if (allG.length === 0) return null;
                          const gT = tot(allG);
                          const isGrupoExp = expandedRESPs.has(grupoKey);
                          const pctGrupo = gT.plan > 0 ? (gT.ejec / gT.plan * 100) : (gT.ejec > 0 ? 100 : 0);
                          const csGrupo = getAccumulatedCheckSet(allG);

                          return (
                            <React.Fragment key={grupoKey}>
                              {/* N2: GRUPO */}
                              <tr
                                onClick={() => setExpandedRESPs(prev => {
                                  const next = new Set(prev);
                                  if (next.has(grupoKey)) next.delete(grupoKey); else next.add(grupoKey);
                                  return next;
                                })}
                                className="bg-purple-100/90 hover:bg-purple-200/90 text-purple-950 font-extrabold cursor-pointer transition-colors border-b border-purple-200 border-l-4 border-l-purple-600"
                              >
                                <td className="px-2 py-1.5 pl-3.5 flex items-center gap-1.5">
                                  {isGrupoExp ? <ChevronDown className="w-3.5 h-3.5 text-purple-700 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-purple-700 shrink-0" />}
                                  <span>📁 {grupo}</span>
                                </td>
                                <td className="px-2 py-1.5 font-mono text-[10px] text-purple-700">({gT.count} items)</td>
                                <td className="px-2 py-1.5"></td>
                                <td className="px-2 py-1.5 text-center font-mono text-[10px]">{fmtDateVal(gT.maxBlFinish)}</td>
                                <td className="px-2 py-1.5 text-right font-mono cursor-help" title={getCantidadTooltipForGroup(allG, 'contrato', 'V. Contrato')}>${fmtMoney(gT.contrato)}</td>
                                <td className="px-2 py-1.5 text-right font-mono text-indigo-700 cursor-help" title={getCantidadTooltipForGroup(allG, 'plan', 'V.Plan')}>${fmtMoney(gT.plan)}</td>
                                <td className="px-2 py-1.5 text-right font-mono text-rose-700 cursor-help" title={getCantidadTooltipForGroup(allG, 'ejec', 'V.Ejec')}>${fmtMoney(gT.ejec)}</td>
                                <td className={`px-2 py-1.5 text-right font-mono font-black cursor-help ${gT.desv < 0 ? 'text-rose-700' : 'text-emerald-700'}`} title={getCantidadTooltipForGroup(allG, 'desv', 'Variación')}>{fmtDNum(gT.desv)}</td>
                                <td className="px-2 py-1.5 text-right font-mono">{pctGrupo.toFixed(2)}%</td>
                                <td className="px-2 py-1.5 text-center font-mono"><span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${csGrupo.bg} ${csGrupo.textC}`}><span className={`w-1 h-1 rounded-full ${csGrupo.dot}`}></span>{csGrupo.text}</span></td>
                              </tr>

                              {isGrupoExp && Object.entries(caps).sort((a: any, b: any) => {
                                const desvA = tot(Object.values(a[1]).flatMap((s: any) => Object.values(s).flat())).desv;
                                const desvB = tot(Object.values(b[1]).flatMap((s: any) => Object.values(s).flat())).desv;
                                return variacionSort === 'asc' ? desvA - desvB : desvB - desvA;
                              }).map(([cap, scaps]: any) => {
                                const capKey = `${grupoKey}__${cap}`;
                                const allCap = Object.values(scaps).flatMap((s: any) => Object.values(s).flat());
                                if (allCap.length === 0) return null;
                                const cT = tot(allCap);
                                const isCapExp = expandedSubPartidas.has(capKey);
                                const pctCap = cT.plan > 0 ? (cT.ejec / cT.plan * 100) : (cT.ejec > 0 ? 100 : 0);
                                const csCap = getAccumulatedCheckSet(allCap);

                                return (
                                  <React.Fragment key={capKey}>
                                    {/* N3: CAP (Subpartida) */}
                                    <tr
                                      onClick={() => setExpandedSubPartidas(prev => {
                                        const next = new Set(prev);
                                        if (next.has(capKey)) next.delete(capKey); else next.add(capKey);
                                        return next;
                                      })}
                                      className="bg-emerald-100/90 hover:bg-emerald-200/90 text-emerald-950 font-bold cursor-pointer transition-colors border-b border-emerald-200 border-l-4 border-l-emerald-600"
                                    >
                                      <td className="px-2 py-1.5 pl-5 flex items-center gap-1.5">
                                        {isCapExp ? <ChevronDown className="w-3.5 h-3.5 text-emerald-800 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-emerald-800 shrink-0" />}
                                        <span>📄 {cap}</span>
                                      </td>
                                      <td className="px-2 py-1.5 font-mono text-[10px] text-emerald-800">({cT.count} items)</td>
                                      <td className="px-2 py-1.5"></td>
                                      <td className="px-2 py-1.5 text-center font-mono text-[10px]">{fmtDateVal(cT.maxBlFinish)}</td>
                                      <td className="px-2 py-1.5 text-right font-mono cursor-help" title={getCantidadTooltipForGroup(allCap, 'contrato', 'V. Contrato')}>${fmtMoney(cT.contrato)}</td>
                                      <td className="px-2 py-1.5 text-right font-mono text-indigo-700 cursor-help" title={getCantidadTooltipForGroup(allCap, 'plan', 'V.Plan')}>${fmtMoney(cT.plan)}</td>
                                      <td className="px-2 py-1.5 text-right font-mono text-rose-700 cursor-help" title={getCantidadTooltipForGroup(allCap, 'ejec', 'V.Ejec')}>${fmtMoney(cT.ejec)}</td>
                                      <td className={`px-2 py-1.5 text-right font-mono font-black cursor-help ${cT.desv < 0 ? 'text-rose-700' : 'text-emerald-700'}`} title={getCantidadTooltipForGroup(allCap, 'desv', 'Variación')}>{fmtDNum(cT.desv)}</td>
                                      <td className="px-2 py-1.5 text-right font-mono">{pctCap.toFixed(2)}%</td>
                                      <td className="px-2 py-1.5 text-center font-mono"><span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${csCap.bg} ${csCap.textC}`}><span className={`w-1 h-1 rounded-full ${csCap.dot}`}></span>{csCap.text}</span></td>
                                    </tr>

                                    {isCapExp && Object.entries(scaps).sort((a: any, b: any) => {
                                      const desvA = tot(Object.values(a[1]).flat()).desv;
                                      const desvB = tot(Object.values(b[1]).flat()).desv;
                                      return variacionSort === 'asc' ? desvA - desvB : desvB - desvA;
                                    }).map(([scap, subCs]: any) => {
                                      const scapKey = `${capKey}__${scap}`;
                                      const allS = Object.values(subCs).flat();
                                      if (allS.length === 0) return null;
                                      const sT = tot(allS);
                                      const isScapExp = expandedSCAPs.has(scapKey);
                                      const pctScap = sT.plan > 0 ? (sT.ejec / sT.plan * 100) : (sT.ejec > 0 ? 100 : 0);
                                      const csScap = getAccumulatedCheckSet(allS);

                                      return (
                                        <React.Fragment key={scapKey}>
                                          {/* N4: SCAP */}
                                          <tr
                                            onClick={() => setExpandedSCAPs(prev => {
                                              const next = new Set(prev);
                                              if (next.has(scapKey)) next.delete(scapKey); else next.add(scapKey);
                                              return next;
                                            })}
                                            className="bg-sky-100/90 hover:bg-sky-200/90 text-sky-950 font-bold cursor-pointer transition-colors border-b border-sky-200 border-l-4 border-l-sky-600"
                                          >
                                            <td className="px-2 py-1.5 pl-6 flex items-center gap-1.5">
                                              {isScapExp ? <ChevronDown className="w-3.5 h-3.5 text-sky-700 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-sky-700 shrink-0" />}
                                              <span>📦 {scap}</span>
                                            </td>
                                            <td className="px-2 py-1.5 font-mono text-[10px] text-sky-700">({sT.count} items)</td>
                                            <td className="px-2 py-1.5"></td>
                                            <td className="px-2 py-1.5 text-center font-mono text-[10px]">{fmtDateVal(sT.maxBlFinish)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono cursor-help" title={getCantidadTooltipForGroup(allS, 'contrato', 'V. Contrato')}>${fmtMoney(sT.contrato)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono text-indigo-700 cursor-help" title={getCantidadTooltipForGroup(allS, 'plan', 'V.Plan')}>${fmtMoney(sT.plan)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono text-rose-700 cursor-help" title={getCantidadTooltipForGroup(allS, 'ejec', 'V.Ejec')}>${fmtMoney(sT.ejec)}</td>
                                            <td className={`px-2 py-1.5 text-right font-mono font-black cursor-help ${sT.desv < 0 ? 'text-rose-700' : 'text-emerald-700'}`} title={getCantidadTooltipForGroup(allS, 'desv', 'Variación')}>{fmtDNum(sT.desv)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono">{pctScap.toFixed(2)}%</td>
                                            <td className="px-2 py-1.5 text-center font-mono"><span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${csScap.bg} ${csScap.textC}`}><span className={`w-1 h-1 rounded-full ${csScap.dot}`}></span>{csScap.text}</span></td>
                                          </tr>

                                          {isScapExp && Object.entries(subCs).sort((a: any, b: any) => {
                                            const desvA = tot(Array.isArray(a[1]) ? a[1] : []).desv;
                                            const desvB = tot(Array.isArray(b[1]) ? b[1] : []).desv;
                                            return variacionSort === 'asc' ? desvA - desvB : desvB - desvA;
                                          }).map(([subC, items]: any) => {
                                            const subCKey = `${scapKey}__${subC}`;
                                            if (!Array.isArray(items) || items.length === 0) return null;
                                            const subCTot = tot(items);
                                            const isSubCExp = expandedSubCs.has(subCKey);
                                            const pctSubC = subCTot.plan > 0 ? (subCTot.ejec / subCTot.plan * 100) : (subCTot.ejec > 0 ? 100 : 0);
                                            const csSubC = getAccumulatedCheckSet(items);

                                            return (
                                              <React.Fragment key={subCKey}>
                                                {/* N5: SUBCONTRATISTA */}
                                                <tr
                                                  onClick={() => setExpandedSubCs(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(subCKey)) next.delete(subCKey); else next.add(subCKey);
                                                    return next;
                                                  })}
                                                  className="bg-amber-100/90 hover:bg-amber-200/90 text-amber-950 font-semibold cursor-pointer transition-colors border-b border-amber-200 border-l-4 border-l-amber-600"
                                                >
                                                  <td className="px-2 py-1.5 pl-7 flex items-center gap-1.5">
                                                    {isSubCExp ? <ChevronDown className="w-3.5 h-3.5 text-amber-800 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-amber-800 shrink-0" />}
                                                    <span>🏗️ SubC: {subC}</span>
                                                  </td>
                                                  <td className="px-2 py-1.5 font-mono text-[10px] text-amber-800">({subCTot.count} items)</td>
                                                  <td className="px-2 py-1.5"></td>
                                                  <td className="px-2 py-1.5 text-center font-mono text-[10px]">{fmtDateVal(subCTot.maxBlFinish)}</td>
                                                  <td className="px-2 py-1.5 text-right font-mono cursor-help" title={getCantidadTooltipForGroup(items, 'contrato', 'V. Contrato')}>${fmtMoney(subCTot.contrato)}</td>
                                                  <td className="px-2 py-1.5 text-right font-mono text-indigo-700 cursor-help" title={getCantidadTooltipForGroup(items, 'plan', 'V.Plan')}>${fmtMoney(subCTot.plan)}</td>
                                                  <td className="px-2 py-1.5 text-right font-mono text-rose-700 cursor-help" title={getCantidadTooltipForGroup(items, 'ejec', 'V.Ejec')}>${fmtMoney(subCTot.ejec)}</td>
                                                  <td className={`px-2 py-1.5 text-right font-mono font-black cursor-help ${subCTot.desv < 0 ? 'text-rose-700' : 'text-emerald-700'}`} title={getCantidadTooltipForGroup(items, 'desv', 'Variación')}>{fmtDNum(subCTot.desv)}</td>
                                                  <td className="px-2 py-1.5 text-right font-mono">{pctSubC.toFixed(2)}%</td>
                                                  <td className="px-2 py-1.5 text-center font-mono"><span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${csSubC.bg} ${csSubC.textC}`}><span className={`w-1 h-1 rounded-full ${csSubC.dot}`}></span>{csSubC.text}</span></td>
                                                </tr>

                                                {/* N6: LEAF ACTIVITIES */}
                                                {isSubCExp && [...items].sort((a: any, b: any) => {
                                                  const desvA = getItemWeekValues(a).variacion;
                                                  const desvB = getItemWeekValues(b).variacion;
                                                  return variacionSort === 'asc' ? desvA - desvB : desvB - desvA;
                                                }).map((item: any) => {
                                                  const { vPlan, vEjec, vContrato, variacion } = getItemWeekValues(item);
                                                  const pctItem = vPlan > 0 ? (vEjec / vPlan * 100) : (vEjec > 0 ? 100 : 0);
                                                  const csItem = getAccumulatedCheckSet([item]);

                                                  return (
                                                    <tr key={item.activityId || item.wbs} className="bg-white hover:bg-slate-50 transition-colors text-[11px] text-slate-700 border-b border-slate-100 border-l-4 border-l-slate-300">
                                                      <td className="px-2 py-1.5 pl-8 font-mono font-semibold text-slate-800">
                                                        <div className="truncate" title={item.wbs}>{item.wbs}</div>
                                                      </td>
                                                      <td className="px-2 py-1.5 font-mono text-slate-500">{item.activityId}</td>
                                                      <td className="px-2 py-1.5 text-slate-800 font-medium max-w-[200px]">
                                                        <div className="truncate max-w-[200px]" title={item.descripcion}>{item.descripcion}</div>
                                                      </td>
                                                      <td className="px-2 py-1.5 text-center font-mono text-[10px] text-slate-500">{fmtDateVal(item.blFinish)}</td>
                                                      <td className="px-2 py-1.5 text-right font-mono text-slate-600 cursor-help hover:bg-slate-100 transition-colors" title={getCantidadTooltipForItem(item, vContrato, 'V. Contrato')}>${fmtMoney(vContrato)}</td>
                                                      <td className="px-2 py-1.5 text-right font-mono font-bold text-indigo-700 cursor-help hover:bg-indigo-50 transition-colors" title={getCantidadTooltipForItem(item, vPlan, 'V.Plan')}>${fmtMoney(vPlan)}</td>
                                                      <td className="px-2 py-1.5 text-right font-mono font-bold text-rose-700 cursor-help hover:bg-rose-50 transition-colors" title={getCantidadTooltipForItem(item, vEjec, 'V.Ejec')}>${fmtMoney(vEjec)}</td>
                                                      <td className={`px-2 py-1.5 text-right font-mono font-bold cursor-help hover:bg-slate-100 transition-colors ${variacion < 0 ? 'text-rose-600' : 'text-emerald-600'}`} title={getCantidadTooltipForItem(item, variacion, 'Variación')}>
                                                        {fmtDNum(variacion)}
                                                      </td>
                                                      <td className="px-2 py-1.5 text-right font-mono">{pctItem.toFixed(2)}%</td>
                                                      <td className="px-2 py-1.5 text-center font-mono"><span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${csItem.bg} ${csItem.textC}`}><span className={`w-1 h-1 rounded-full ${csItem.dot}`}></span>{csItem.text}</span></td>
                                                    </tr>
                                                  );
                                                })}
                                              </React.Fragment>
                                            );
                                          })}
                                        </React.Fragment>
                                      );
                                    })}
                                  </React.Fragment>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
              
            </table>
          </div>

          {/* Resumen Check Set */}
          {checkSetSummary.length > 0 && (
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
                      <th className="px-4 py-3 border-b border-slate-700 font-bold text-right">Variación</th>
                      <th className="px-4 py-3 border-b border-slate-700 font-bold text-center w-32">Cant. Actividades</th>
                    </tr>
                  </thead>
                  <tbody className="bg-slate-900 text-white font-extrabold text-xs shadow-xs">
                    <tr>
                      <td className="px-4 py-3 border-b border-slate-800" colSpan={2}>
                        TOTAL GENERAL
                      </td>
                      <td className="px-4 py-3 border-b border-slate-800 text-right font-mono text-indigo-300">
                        ${fmtMoney(globalTot.plan)}
                      </td>
                      <td className="px-4 py-3 border-b border-slate-800 text-right font-mono text-rose-300">
                        ${fmtMoney(globalTot.ejec)}
                      </td>
                      <td className={`px-4 py-3 border-b border-slate-800 text-right font-mono ${globalTot.desv < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {fmtDNum(globalTot.desv)}
                      </td>
                      <td className="px-4 py-3 border-b border-slate-800 text-center font-mono">
                        {leafItems.length}
                      </td>
                    </tr>
                  </tbody>
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
                             <td className="px-4 py-3 border-b border-slate-200 text-right text-rose-700 font-mono">
                               ${fmtMoney(csData.totalEjec)}
                             </td>
                             <td className={`px-4 py-3 border-b border-slate-200 text-right font-mono font-black ${csData.totalDesv < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
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
                               <td className="px-4 py-2 text-right font-mono text-slate-600">
                                 ${fmtMoney(tData.ejec)}
                               </td>
                               <td className={`px-4 py-2 text-right font-mono font-bold ${tData.desv < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
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
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    )}
  </div>
  );
};
