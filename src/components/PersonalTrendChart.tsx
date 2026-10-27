/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Layers,
  Users,
  HardHat,
  ShieldAlert,
  Sun,
  Moon,
  UserCheck,
  Building2,
  Filter,
  Check,
  Maximize2,
  BarChart3,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Info
} from 'lucide-react';
import { PersonalRegistro, TipoPersonal } from '../types/personal';

interface PersonalTrendChartProps {
  allRegistros: PersonalRegistro[];
  filteredRegistros: PersonalRegistro[];
  ubicacionFilter: string;
  mesFilter: string | Set<string>;
  setMesFilter: (mes: string) => void;
  semanaFilter: string | Set<string>;
  setSemanaFilter?: (semana: string) => void;
  fechaFilter?: string | Set<string>;
  tipoFilter: 'all' | 'Directo' | 'Indirecto';
  setTipoFilter: (tipo: 'all' | 'Directo' | 'Indirecto') => void;
  empresaFilter: string;
  setEmpresaFilter: (emp: string) => void;
  frenteFilter: string;
  turnoFilter: 'all' | 'diurno' | 'noche';
  generoFilter: 'all' | 'hombres' | 'mujeres';
  searchQuery: string;
  availableMeses: [string, string][];
  availableSemanas?: [string, string][];
  hideQuickWeekSelector?: boolean;
  hideBottomSelectors?: boolean;
  defaultGranularity?: 'mensual' | 'semanal' | 'diario';
}

export interface MonthlyTrendDataPoint {
  mesKey: string;
  mesLabel: string;
  diasActivos: number;
  // Totales
  totalPersonal: number;
  directoTotal: number;
  indirectoTotal: number;
  hombresTotal: number;
  mujeresTotal: number;
  diurnoTotal: number;
  nocheTotal: number;
  // Promedios Diarios
  promTotal: number;
  promDirecto: number;
  promIndirecto: number;
  promHombres: number;
  promMujeres: number;
  promDiurno: number;
  promNoche: number;
  // Porcentajes
  pctDirecto: number;
  pctIndirecto: number;
  pctHombres: number;
  pctMujeres: number;
  // Top Empresa del periodo
  topEmpresa?: string;
  topEmpresaProm?: number;
  // MoM Delta vs periodo anterior
  deltaPromTotal?: number;
  deltaPromDirecto?: number;
  deltaPromIndirecto?: number;
}

export interface WeeklyTrendDataPoint {
  semanaKey: string;
  semanaLabel: string;
  mesKey?: string;
  diasActivos: number;
  // Totales
  totalPersonal: number;
  directoTotal: number;
  indirectoTotal: number;
  hombresTotal: number;
  mujeresTotal: number;
  diurnoTotal: number;
  nocheTotal: number;
  // Promedios Diarios
  promTotal: number;
  promDirecto: number;
  promIndirecto: number;
  promHombres: number;
  promMujeres: number;
  promDiurno: number;
  promNoche: number;
  // Porcentajes
  pctDirecto: number;
  pctIndirecto: number;
  pctHombres: number;
  pctMujeres: number;
  // Top Empresa de la semana
  topEmpresa?: string;
  topEmpresaProm?: number;
  // WoW Delta vs semana anterior
  deltaPromTotal?: number;
  deltaPromDirecto?: number;
  deltaPromIndirecto?: number;
}

export interface DailyTrendDataPoint {
  fecha: string;
  fechaIso: string;
  diaNumero: number;
  mesKey: string;
  mesLabel: string;
  semanaKey?: string;
  semanaLabel?: string;
  diasActivos: number;
  totalPersonal: number;
  directoTotal: number;
  indirectoTotal: number;
  hombresTotal: number;
  mujeresTotal: number;
  diurnoTotal: number;
  nocheTotal: number;
  promTotal: number;
  promDirecto: number;
  promIndirecto: number;
  promHombres: number;
  promMujeres: number;
  promDiurno: number;
  promNoche: number;
  pctDirecto?: number;
  pctIndirecto?: number;
  deltaPromTotal?: number;
  deltaPromDirecto?: number;
  deltaPromIndirecto?: number;
  empresasContadas: number;
}

export const PersonalTrendChart: React.FC<PersonalTrendChartProps> = ({
  allRegistros,
  filteredRegistros,
  ubicacionFilter,
  mesFilter,
  setMesFilter,
  semanaFilter,
  setSemanaFilter,
  fechaFilter,
  tipoFilter,
  setTipoFilter,
  empresaFilter,
  setEmpresaFilter,
  frenteFilter,
  turnoFilter,
  generoFilter,
  searchQuery,
  availableMeses,
  availableSemanas = [],
  hideQuickWeekSelector = false,
  hideBottomSelectors = false,
  defaultGranularity = 'mensual'
}) => {
  // Mode: 'promedio' (Promedio diario) | 'acumulado' (Total acumulado)
  const [metricMode, setMetricMode] = useState<'promedio' | 'acumulado'>('promedio');
  // Granularity: 'mensual' | 'semanal' | 'diario' (Default: mensual o definido por prop)
  const [granularity, setGranularity] = useState<'mensual' | 'semanal' | 'diario'>(defaultGranularity);
  // Visible lines toggles
  const [showDirecto, setShowDirecto] = useState<boolean>(true);
  const [showIndirecto, setShowIndirecto] = useState<boolean>(true);
  const [showTotal, setShowTotal] = useState<boolean>(true);
  // Hovered Point index for Tooltip
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const hasMesFilterActive = useMemo(() => {
    if (!mesFilter || mesFilter === 'all') return false;
    if (mesFilter instanceof Set) return mesFilter.size > 0 && mesFilter.size < availableMeses.length;
    return Boolean(mesFilter);
  }, [mesFilter, availableMeses.length]);

  const hasSemanaFilterActive = useMemo(() => {
    if (!semanaFilter || semanaFilter === 'all') return false;
    if (semanaFilter instanceof Set) return semanaFilter.size > 0 && semanaFilter.size < (availableSemanas?.length || 0);
    return Boolean(semanaFilter);
  }, [semanaFilter, availableSemanas?.length]);

  const hasFechaFilterActive = useMemo(() => {
    if (!fechaFilter || fechaFilter === 'all') return false;
    if (fechaFilter instanceof Set) return fechaFilter.size > 0;
    return Boolean(fechaFilter);
  }, [fechaFilter]);

  // Compute Monthly Aggregated Trend Series (Sorted Chronologically)
  // Reflects filteredRegistros (filtrado exacto por meses, semanas, días y demás atributos)
  const monthlyTrendData: MonthlyTrendDataPoint[] = useMemo(() => {
    const map = new Map<string, {
      mesKey: string;
      mesLabel: string;
      fechas: Set<string>;
      directo: number;
      indirecto: number;
      total: number;
      hombres: number;
      mujeres: number;
      diurno: number;
      noche: number;
      empresasMap: Map<string, number>;
    }>();

    // Si hay filtro de meses activo, pre-popular únicamente los meses seleccionados
    if (hasMesFilterActive) {
      availableMeses
        .filter(([mKey]) => {
          if (mesFilter instanceof Set) return mesFilter.has(mKey);
          return mesFilter === mKey;
        })
        .forEach(([mKey, mLabel]) => {
          map.set(mKey, {
            mesKey: mKey,
            mesLabel: mLabel,
            fechas: new Set<string>(),
            directo: 0,
            indirecto: 0,
            total: 0,
            hombres: 0,
            mujeres: 0,
            diurno: 0,
            noche: 0,
            empresasMap: new Map<string, number>()
          });
        });
    } else if (!hasSemanaFilterActive && !hasFechaFilterActive) {
      // Si no hay filtro de periodos activo, pre-popular todos los meses disponibles para progresión cronológica completa
      availableMeses.forEach(([mKey, mLabel]) => {
        map.set(mKey, {
          mesKey: mKey,
          mesLabel: mLabel,
          fechas: new Set<string>(),
          directo: 0,
          indirecto: 0,
          total: 0,
          hombres: 0,
          mujeres: 0,
          diurno: 0,
          noche: 0,
          empresasMap: new Map<string, number>()
        });
      });
    }

    filteredRegistros.forEach(r => {
      if (!r.mesKey) return;
      if (!map.has(r.mesKey)) {
        map.set(r.mesKey, {
          mesKey: r.mesKey,
          mesLabel: r.mesLabel || r.mesKey,
          fechas: new Set<string>(),
          directo: 0,
          indirecto: 0,
          total: 0,
          hombres: 0,
          mujeres: 0,
          diurno: 0,
          noche: 0,
          empresasMap: new Map<string, number>()
        });
      }

      const item = map.get(r.mesKey)!;
      if (r.fecha) item.fechas.add(r.fecha);
      item.total += r.total;
      if (r.tipo === 'Directo') {
        item.directo += r.total;
      } else {
        item.indirecto += r.total;
      }
      item.hombres += r.h;
      item.mujeres += r.m;
      item.diurno += (r.hd + r.md);
      item.noche += (r.hn + r.mn);

      if (r.empresa) {
        item.empresasMap.set(r.empresa, (item.empresasMap.get(r.empresa) || 0) + r.total);
      }
    });

    const sortedKeys = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
    const result: MonthlyTrendDataPoint[] = [];

    sortedKeys.forEach(key => {
      const data = map.get(key)!;
      const diasActivos = Math.max(1, data.fechas.size);
      const promTotal = data.total / diasActivos;
      const promDirecto = data.directo / diasActivos;
      const promIndirecto = data.indirecto / diasActivos;
      const promHombres = data.hombres / diasActivos;
      const promMujeres = data.mujeres / diasActivos;
      const promDiurno = data.diurno / diasActivos;
      const promNoche = data.noche / diasActivos;

      const pctDirecto = promTotal > 0 ? (promDirecto / promTotal) * 100 : 0;
      const pctIndirecto = promTotal > 0 ? (promIndirecto / promTotal) * 100 : 0;
      const pctHombres = promTotal > 0 ? (promHombres / promTotal) * 100 : 0;
      const pctMujeres = promTotal > 0 ? (promMujeres / promTotal) * 100 : 0;

      let topEmpresa: string | undefined = undefined;
      let topEmpresaMax = 0;
      data.empresasMap.forEach((val, emp) => {
        if (val > topEmpresaMax) {
          topEmpresaMax = val;
          topEmpresa = emp;
        }
      });

      let deltaPromTotal: number | undefined = undefined;
      let deltaPromDirecto: number | undefined = undefined;
      let deltaPromIndirecto: number | undefined = undefined;

      if (result.length > 0) {
        const prev = result[result.length - 1];
        if (prev.promTotal > 0) {
          deltaPromTotal = ((promTotal - prev.promTotal) / prev.promTotal) * 100;
        }
        if (prev.promDirecto > 0) {
          deltaPromDirecto = ((promDirecto - prev.promDirecto) / prev.promDirecto) * 100;
        }
        if (prev.promIndirecto > 0) {
          deltaPromIndirecto = ((promIndirecto - prev.promIndirecto) / prev.promIndirecto) * 100;
        }
      }

      result.push({
        mesKey: key,
        mesLabel: data.mesLabel,
        diasActivos: data.fechas.size,
        totalPersonal: data.total,
        directoTotal: data.directo,
        indirectoTotal: data.indirecto,
        hombresTotal: data.hombres,
        mujeresTotal: data.mujeres,
        diurnoTotal: data.diurno,
        nocheTotal: data.noche,
        promTotal,
        promDirecto,
        promIndirecto,
        promHombres,
        promMujeres,
        promDiurno,
        promNoche,
        pctDirecto,
        pctIndirecto,
        pctHombres,
        pctMujeres,
        topEmpresa,
        topEmpresaProm: topEmpresa ? topEmpresaMax / diasActivos : 0,
        deltaPromTotal,
        deltaPromDirecto,
        deltaPromIndirecto
      });
    });

    return result;
  }, [availableMeses, filteredRegistros, hasMesFilterActive, hasSemanaFilterActive, hasFechaFilterActive, mesFilter]);

  // Compute Weekly Aggregated Trend Series (Sorted Chronologically)
  // Reflects filteredRegistros
  const weeklyTrendData: WeeklyTrendDataPoint[] = useMemo(() => {
    const map = new Map<string, {
      semanaKey: string;
      semanaLabel: string;
      mesKey?: string;
      fechas: Set<string>;
      directo: number;
      indirecto: number;
      total: number;
      hombres: number;
      mujeres: number;
      diurno: number;
      noche: number;
      empresasMap: Map<string, number>;
    }>();

    // Si hay semanas específicamente seleccionadas, pre-popularlas
    if (hasSemanaFilterActive && availableSemanas && availableSemanas.length > 0) {
      availableSemanas
        .filter(([sKey]) => {
          if (semanaFilter instanceof Set) return semanaFilter.has(sKey);
          return semanaFilter === sKey;
        })
        .forEach(([sKey, sLabel]) => {
          map.set(sKey, {
            semanaKey: sKey,
            semanaLabel: sLabel,
            fechas: new Set<string>(),
            directo: 0,
            indirecto: 0,
            total: 0,
            hombres: 0,
            mujeres: 0,
            diurno: 0,
            noche: 0,
            empresasMap: new Map<string, number>()
          });
        });
    }

    filteredRegistros.forEach(r => {
      if (!r.semanaKey) return;
      if (!map.has(r.semanaKey)) {
        map.set(r.semanaKey, {
          semanaKey: r.semanaKey,
          semanaLabel: r.semanaLabel || r.semanaKey,
          mesKey: r.mesKey,
          fechas: new Set<string>(),
          directo: 0,
          indirecto: 0,
          total: 0,
          hombres: 0,
          mujeres: 0,
          diurno: 0,
          noche: 0,
          empresasMap: new Map<string, number>()
        });
      }

      const item = map.get(r.semanaKey)!;
      if (!item.mesKey && r.mesKey) item.mesKey = r.mesKey;
      if (r.fecha) item.fechas.add(r.fecha);
      item.total += r.total;
      if (r.tipo === 'Directo') {
        item.directo += r.total;
      } else {
        item.indirecto += r.total;
      }
      item.hombres += r.h;
      item.mujeres += r.m;
      item.diurno += (r.hd + r.md);
      item.noche += (r.hn + r.mn);

      if (r.empresa) {
        item.empresasMap.set(r.empresa, (item.empresasMap.get(r.empresa) || 0) + r.total);
      }
    });

    const sortedKeys = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
    const result: WeeklyTrendDataPoint[] = [];

    sortedKeys.forEach(key => {
      const data = map.get(key)!;
      const diasActivos = Math.max(1, data.fechas.size);
      const promTotal = data.total / diasActivos;
      const promDirecto = data.directo / diasActivos;
      const promIndirecto = data.indirecto / diasActivos;
      const promHombres = data.hombres / diasActivos;
      const promMujeres = data.mujeres / diasActivos;
      const promDiurno = data.diurno / diasActivos;
      const promNoche = data.noche / diasActivos;

      const pctDirecto = promTotal > 0 ? (promDirecto / promTotal) * 100 : 0;
      const pctIndirecto = promTotal > 0 ? (promIndirecto / promTotal) * 100 : 0;
      const pctHombres = promTotal > 0 ? (promHombres / promTotal) * 100 : 0;
      const pctMujeres = promTotal > 0 ? (promMujeres / promTotal) * 100 : 0;

      let topEmpresa: string | undefined = undefined;
      let topEmpresaMax = 0;
      data.empresasMap.forEach((val, emp) => {
        if (val > topEmpresaMax) {
          topEmpresaMax = val;
          topEmpresa = emp;
        }
      });

      let deltaPromTotal: number | undefined = undefined;
      let deltaPromDirecto: number | undefined = undefined;
      let deltaPromIndirecto: number | undefined = undefined;

      if (result.length > 0) {
        const prev = result[result.length - 1];
        if (prev.promTotal > 0) {
          deltaPromTotal = ((promTotal - prev.promTotal) / prev.promTotal) * 100;
        }
        if (prev.promDirecto > 0) {
          deltaPromDirecto = ((promDirecto - prev.promDirecto) / prev.promDirecto) * 100;
        }
        if (prev.promIndirecto > 0) {
          deltaPromIndirecto = ((promIndirecto - prev.promIndirecto) / prev.promIndirecto) * 100;
        }
      }

      result.push({
        semanaKey: key,
        semanaLabel: data.semanaLabel,
        mesKey: data.mesKey,
        diasActivos: data.fechas.size,
        totalPersonal: data.total,
        directoTotal: data.directo,
        indirectoTotal: data.indirecto,
        hombresTotal: data.hombres,
        mujeresTotal: data.mujeres,
        diurnoTotal: data.diurno,
        nocheTotal: data.noche,
        promTotal,
        promDirecto,
        promIndirecto,
        promHombres,
        promMujeres,
        promDiurno,
        promNoche,
        pctDirecto,
        pctIndirecto,
        pctHombres,
        pctMujeres,
        topEmpresa,
        topEmpresaProm: topEmpresa ? topEmpresaMax / diasActivos : 0,
        deltaPromTotal,
        deltaPromDirecto,
        deltaPromIndirecto
      });
    });

    return result;
  }, [filteredRegistros, hasSemanaFilterActive, semanaFilter, availableSemanas]);

  // Daily Trend Data
  const dailyTrendData: DailyTrendDataPoint[] = useMemo(() => {
    const map = new Map<string, {
      fecha: string;
      fechaIso: string;
      mesKey: string;
      mesLabel: string;
      semanaKey?: string;
      semanaLabel?: string;
      directo: number;
      indirecto: number;
      total: number;
      hombres: number;
      mujeres: number;
      diurno: number;
      noche: number;
      empresasSet: Set<string>;
    }>();

    filteredRegistros.forEach(r => {
      if (!r.fecha) return;
      if (!map.has(r.fecha)) {
        map.set(r.fecha, {
          fecha: r.fecha,
          fechaIso: r.fechaIso || r.fecha,
          mesKey: r.mesKey || '',
          mesLabel: r.mesLabel || '',
          semanaKey: r.semanaKey,
          semanaLabel: r.semanaLabel,
          directo: 0,
          indirecto: 0,
          total: 0,
          hombres: 0,
          mujeres: 0,
          diurno: 0,
          noche: 0,
          empresasSet: new Set<string>()
        });
      }
      const it = map.get(r.fecha)!;
      it.total += r.total;
      if (r.tipo === 'Directo') it.directo += r.total;
      else it.indirecto += r.total;
      it.hombres += r.h;
      it.mujeres += r.m;
      it.diurno += (r.hd + r.md);
      it.noche += (r.hn + r.mn);
      if (r.empresa) it.empresasSet.add(r.empresa);
    });

    const sortedDates = Array.from(map.values()).sort((a, b) => {
      if (a.fechaIso && b.fechaIso) return a.fechaIso.localeCompare(b.fechaIso);
      return a.fecha.localeCompare(b.fecha);
    });

    const result: DailyTrendDataPoint[] = [];

    sortedDates.forEach((d, i) => {
      let deltaPromTotal: number | undefined = undefined;
      let deltaPromDirecto: number | undefined = undefined;
      let deltaPromIndirecto: number | undefined = undefined;

      if (result.length > 0) {
        const prev = result[result.length - 1];
        if (prev.promTotal > 0) {
          deltaPromTotal = ((d.total - prev.promTotal) / prev.promTotal) * 100;
        }
        if (prev.promDirecto > 0) {
          deltaPromDirecto = ((d.directo - prev.promDirecto) / prev.promDirecto) * 100;
        }
        if (prev.promIndirecto > 0) {
          deltaPromIndirecto = ((d.indirecto - prev.promIndirecto) / prev.promIndirecto) * 100;
        }
      }

      result.push({
        fecha: d.fecha,
        fechaIso: d.fechaIso,
        diaNumero: i + 1,
        mesKey: d.mesKey,
        mesLabel: d.mesLabel,
        semanaKey: d.semanaKey,
        semanaLabel: d.semanaLabel,
        diasActivos: 1,
        totalPersonal: d.total,
        directoTotal: d.directo,
        indirectoTotal: d.indirecto,
        hombresTotal: d.hombres,
        mujeresTotal: d.mujeres,
        diurnoTotal: d.diurno,
        nocheTotal: d.noche,
        promTotal: d.total,
        promDirecto: d.directo,
        promIndirecto: d.indirecto,
        promHombres: d.hombres,
        promMujeres: d.mujeres,
        promDiurno: d.diurno,
        promNoche: d.noche,
        pctDirecto: d.total > 0 ? (d.directo / d.total) * 100 : 0,
        pctIndirecto: d.total > 0 ? (d.indirecto / d.total) * 100 : 0,
        deltaPromTotal,
        deltaPromDirecto,
        deltaPromIndirecto,
        empresasContadas: d.empresasSet.size
      });
    });

    return result;
  }, [filteredRegistros]);

  // Active data series according to selected granularity (mensual, semanal o diario)
  const activeSeries = useMemo(() => {
    if (granularity === 'mensual') return monthlyTrendData;
    if (granularity === 'semanal') return weeklyTrendData;
    return dailyTrendData;
  }, [granularity, monthlyTrendData, weeklyTrendData, dailyTrendData]);

  // General KPIs summary for trend based on granularity
  const summaryKpis = useMemo(() => {
    if (activeSeries.length === 0) {
      return {
        picoLabel: 'N/A',
        picoValor: 0,
        promedioGlobal: 0,
        ultimoDelta: null,
        promRatioDirecto: 0
      };
    }

    let picoItem: any = activeSeries[0];
    let sumProm = 0;
    let sumDirecto = 0;
    let sumIndirecto = 0;
    let count = 0;

    activeSeries.forEach((item: any) => {
      const valTotal = item.promTotal;
      const curMax = picoItem.promTotal;
      if (valTotal > curMax) {
        picoItem = item;
      }
      if (item.diasActivos > 0) {
        sumProm += item.promTotal;
        sumDirecto += item.promDirecto;
        sumIndirecto += item.promIndirecto;
        count++;
      }
    });

    const promedioGlobal = count > 0 ? sumProm / count : 0;
    const promRatioDirecto = (sumDirecto + sumIndirecto) > 0
      ? (sumDirecto / (sumDirecto + sumIndirecto)) * 100
      : 0;

    const ultimoItem: any = activeSeries[activeSeries.length - 1];
    const ultimoDelta = ultimoItem?.deltaPromTotal ?? null;

    const picoLabel = granularity === 'mensual'
      ? picoItem?.mesLabel
      : picoItem?.semanaLabel?.split('(')[0] || picoItem?.semanaKey;

    const picoValor = picoItem?.promTotal;

    return {
      picoLabel,
      picoValor: picoValor || 0,
      promedioGlobal,
      ultimoDelta,
      promRatioDirecto,
      totalPeriodos: activeSeries.length
    };
  }, [activeSeries, granularity]);

  // Chart Rendering Variables (SVG ViewBox Dimensions)
  const chartWidth = 960;
  const chartHeight = 340;
  const padding = { top: 25, right: 35, bottom: 50, left: 60 };
  const graphWidth = chartWidth - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;

  // Compute maximum Y value for scale
  const maxY = useMemo(() => {
    let max = 10;
    activeSeries.forEach((d: any) => {
      const valTotal = metricMode === 'promedio' ? d.promTotal : d.totalPersonal;
      const valDir = metricMode === 'promedio' ? d.promDirecto : d.directoTotal;
      const valInd = metricMode === 'promedio' ? d.promIndirecto : d.indirectoTotal;
      max = Math.max(max, valTotal, valDir, valInd);
    });
    return Math.ceil((max * 1.15) / 10) * 10 || 50;
  }, [activeSeries, metricMode]);

  // Coordinates Mapping Helpers
  const getX = (idx: number, totalPoints: number) => {
    if (totalPoints <= 1) return padding.left + graphWidth / 2;
    return padding.left + (idx / (totalPoints - 1)) * graphWidth;
  };

  const getY = (val: number) => {
    return padding.top + graphHeight - (val / maxY) * graphHeight;
  };

  // Build SVG Path Strings (Smooth Cubic Bezier or Linear)
  const buildLinePath = (points: { x: number; y: number }[]) => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 >= points.length ? points.length - 1 : i + 2];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return path;
  };

  const buildAreaPath = (points: { x: number; y: number }[]) => {
    if (points.length === 0) return '';
    const linePath = buildLinePath(points);
    const bottomY = padding.top + graphHeight;
    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  };

  // Precompute Point arrays for Directo, Indirecto, and Total
  const directPoints = useMemo(() => {
    return activeSeries.map((d: any, i) => {
      const val = metricMode === 'promedio' ? d.promDirecto : d.directoTotal;
      return { x: getX(i, activeSeries.length), y: getY(val), val, raw: d };
    });
  }, [activeSeries, metricMode, maxY]);

  const indirectPoints = useMemo(() => {
    return activeSeries.map((d: any, i) => {
      const val = metricMode === 'promedio' ? d.promIndirecto : d.indirectoTotal;
      return { x: getX(i, activeSeries.length), y: getY(val), val, raw: d };
    });
  }, [activeSeries, metricMode, maxY]);

  const totalPoints = useMemo(() => {
    return activeSeries.map((d: any, i) => {
      const val = metricMode === 'promedio' ? d.promTotal : d.totalPersonal;
      return { x: getX(i, activeSeries.length), y: getY(val), val, raw: d };
    });
  }, [activeSeries, metricMode, maxY]);

  // Selected item data on hover
  const hoveredPointRaw: any = hoveredIdx !== null && hoveredIdx >= 0 && hoveredIdx < activeSeries.length
    ? (activeSeries[hoveredIdx] as any)
    : null;

  // Hovered item X percentage in chart for dynamic tooltip placement (left vs right)
  const hoveredXPercent = useMemo(() => {
    if (hoveredIdx === null || hoveredIdx < 0 || hoveredIdx >= activeSeries.length) return 50;
    const xPos = getX(hoveredIdx, activeSeries.length);
    return (xPos / chartWidth) * 100;
  }, [hoveredIdx, activeSeries.length, chartWidth]);

  // For the initial weeks/points (first ~35% of the chart), place tooltip to the right to avoid overflowing the left edge.
  // For all subsequent weeks, place tooltip to the left of the hovered week/point.
  const isHoveredInitialPoint = hoveredXPercent < 35;

  // Grid steps (5 horizontal grid lines)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxY * f));

  return (
    <div className="ht-card bg-white border border-[#D5DEE2] rounded-xl p-5 sm:p-6 shadow-xs space-y-5" id="personal-trend-chart-card">
      {/* Header Bar: Title, Context Badges & Controls */}
      <div className="ht-card-title flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#D5DEE2] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="hidden w-9 h-9 rounded-xl bg-[#EEECFB] border border-[#C5BDF7] items-center justify-center text-[#442dd7] shadow-xs">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#14212A] tracking-tight flex items-center gap-2">
                <span className="ht-title">Curva de Tendencia de Personal</span>
                <span className="text-[10px] bg-[#EEECFB] text-[#442dd7] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Directo vs Indirecto
                </span>
              </h3>
              <p className="ht-sub">
                Comportamiento y evolución mensual o semanal de la dotación en obra.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls: Granularity Switcher (Mes / Semana) and Metric Mode */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Granularity Switch: Mes, Semana */}
          <div className="bg-[#EEF2F3] p-1 rounded-xl flex items-center border border-[#D5DEE2] text-xs font-semibold shadow-2xs">
            <button
              onClick={() => {
                setGranularity('mensual');
                setHoveredIdx(null);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                granularity === 'mensual'
                  ? 'bg-white text-[#442dd7] shadow-xs font-bold'
                  : 'text-[#5A6A74] hover:text-[#14212A]'
              }`}
              title="Ver tendencia mensual (Mes a mes)"
            >
              📅 Por Mes ({monthlyTrendData.length})
            </button>

            <button
              onClick={() => {
                setGranularity('semanal');
                setHoveredIdx(null);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                granularity === 'semanal'
                  ? 'bg-white text-[#442dd7] shadow-xs font-bold'
                  : 'text-[#5A6A74] hover:text-[#14212A]'
              }`}
              title="Ver tendencia semanal (Semana a semana)"
            >
              🗓️ Por Semana ({weeklyTrendData.length})
            </button>
          </div>

          {/* Metric Mode Switch (Promedio Diario vs Total Acumulado) */}
          <div className="bg-[#EEF2F3] p-1 rounded-xl flex items-center border border-[#D5DEE2] text-xs font-semibold">
            <button
              onClick={() => setMetricMode('promedio')}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                metricMode === 'promedio'
                  ? 'bg-white text-[#442dd7] shadow-xs font-bold'
                  : 'text-[#5A6A74] hover:text-[#14212A]'
              }`}
              title="Promedio de personas por día activo en el periodo (Métrica recomendada)"
            >
              Prom. Día
            </button>
            <button
              onClick={() => setMetricMode('acumulado')}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                metricMode === 'acumulado'
                  ? 'bg-white text-[#442dd7] shadow-xs font-bold'
                  : 'text-[#5A6A74] hover:text-[#14212A]'
              }`}
              title="Suma total acumulada de asistencias en el periodo"
            >
              Total Acum.
            </button>
          </div>
        </div>
      </div>

      {/* Filter Chips State - Visual Feedback of Active Header & Card Filters */}
      {(ubicacionFilter !== 'all' || empresaFilter !== 'all' || frenteFilter !== 'all' || tipoFilter !== 'all' || turnoFilter !== 'all' || generoFilter !== 'all' || searchQuery.trim() || hasMesFilterActive || hasSemanaFilterActive) && (
        <div className="bg-[#F5F8F9] border border-[#D5DEE2] rounded-xl px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-[#14212A] flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-[#442dd7]" />
              <span>Curva ajustada por:</span>
            </span>

            {ubicacionFilter !== 'all' && (
              <span className="bg-white border border-[#D5DEE2] text-[#14212A] px-2 py-0.5 rounded-lg font-semibold">
                📍 {ubicacionFilter}
              </span>
            )}
            {empresaFilter !== 'all' && (
              <span className="bg-[#EEECFB] border border-[#C5BDF7] text-[#442dd7] px-2 py-0.5 rounded-lg font-semibold flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                <span>{empresaFilter}</span>
              </span>
            )}
            {tipoFilter !== 'all' && (
              <span className={`px-2 py-0.5 rounded-lg font-semibold border ${
                tipoFilter === 'Directo' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                {tipoFilter === 'Directo' ? '🟢 Solo Directo' : '🟡 Solo Indirecto'}
              </span>
            )}
            {generoFilter !== 'all' && (
              <span className="bg-white border border-[#D5DEE2] text-[#14212A] px-2 py-0.5 rounded-lg font-semibold">
                {generoFilter === 'hombres' ? '👤 Hombres' : '👩 Mujeres'}
              </span>
            )}
            {turnoFilter !== 'all' && (
              <span className="bg-white border border-[#D5DEE2] text-[#14212A] px-2 py-0.5 rounded-lg font-semibold">
                {turnoFilter === 'diurno' ? '☀️ Diurno' : '🌙 Noche'}
              </span>
            )}
            {frenteFilter !== 'all' && (
              <span className="bg-white border border-[#D5DEE2] text-[#14212A] px-2 py-0.5 rounded-lg font-semibold">
                Frente: {frenteFilter}
              </span>
            )}
            {hasMesFilterActive && (
              <span className="bg-[#442dd7] text-white px-2 py-0.5 rounded-lg font-semibold flex items-center gap-1 shadow-xs">
                <Calendar className="w-3 h-3" />
                <span>
                  Mes: {
                    mesFilter instanceof Set
                      ? (mesFilter.size === 1 ? (availableMeses.find(([k]) => mesFilter.has(k))?.[1] || Array.from(mesFilter)[0]) : `${mesFilter.size} meses`)
                      : (availableMeses.find(([k]) => k === mesFilter)?.[1] || mesFilter)
                  }
                </span>
              </span>
            )}
            {hasSemanaFilterActive && (
              <span className="bg-[#3722b5] text-white px-2 py-0.5 rounded-lg font-semibold flex items-center gap-1 shadow-xs">
                <span>
                  Semana: {
                    semanaFilter instanceof Set
                      ? (semanaFilter.size === 1 ? Array.from(semanaFilter)[0] : `${semanaFilter.size} semanas`)
                      : semanaFilter
                  }
                </span>
              </span>
            )}
          </div>

          <div className="text-[11px] text-[#5A6A74] font-medium">
            {filteredRegistros.length} registros analizados
          </div>
        </div>
      )}

      {/* KPI Highlight Strip for Trend (Compact horizontal layout) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Periodo Pico */}
        <div className="bg-[#F5F8F9] border border-[#D5DEE2] rounded-xl px-3 py-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6A74] block truncate">
              {granularity === 'mensual' ? 'Mes Pico' : granularity === 'semanal' ? 'Semana Pico' : 'Día Pico'}
            </span>
            <div className="text-xs font-bold text-[#14212A] truncate" title={summaryKpis.picoLabel}>
              {summaryKpis.picoLabel}
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-base font-semibold font-['Barlow_Condensed'] text-[#442dd7]">
              {summaryKpis.picoValor ? summaryKpis.picoValor.toFixed(1) : '-'}
            </span>
            <span className="text-[10px] text-[#5A6A74] block font-medium leading-none">pers./d</span>
          </div>
        </div>

        {/* Promedio Histórico */}
        <div className="bg-[#F5F8F9] border border-[#D5DEE2] rounded-xl px-3 py-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6A74] block truncate">
              Promedio Periodo
            </span>
            <span className="text-[10px] text-[#5A6A74] block font-medium leading-none truncate">
              {activeSeries.length} {granularity === 'mensual' ? 'meses' : 'sem.'}
            </span>
          </div>
          <div className="text-right shrink-0">
            <span className="text-base font-semibold font-['Barlow_Condensed'] text-[#14212A]">
              {summaryKpis.promedioGlobal.toFixed(1)}
            </span>
            <span className="text-[10px] text-[#5A6A74] block font-medium leading-none">pers./día</span>
          </div>
        </div>

        {/* Proporción Directo / Indirecto */}
        <div className="bg-[#F5F8F9] border border-[#D5DEE2] rounded-xl px-3 py-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6A74] block truncate">
              Mix Personal
            </span>
            <span className="text-[10px] text-[#5A6A74] block font-medium leading-none">
              Directo / Ind.
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs font-semibold text-emerald-800 bg-emerald-100/80 px-1.5 py-0.5 rounded leading-none">
              🟢 {summaryKpis.promRatioDirecto.toFixed(0)}%
            </span>
            <span className="text-xs font-semibold text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded leading-none">
              🟡 {(100 - summaryKpis.promRatioDirecto).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Tendencia Último Periodo */}
        <div className="bg-[#F5F8F9] border border-[#D5DEE2] rounded-xl px-3 py-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6A74] block truncate">
              {granularity === 'semanal' ? 'Var. WoW' : 'Var. MoM'}
            </span>
            <span className="text-[10px] text-[#5A6A74] block font-medium leading-none">
              vs. anterior
            </span>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {summaryKpis.ultimoDelta !== null && summaryKpis.ultimoDelta !== undefined ? (
              <>
                {summaryKpis.ultimoDelta >= 0 ? (
                  <ArrowUpRight className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span className={`text-base font-semibold font-['Barlow_Condensed'] ${
                  summaryKpis.ultimoDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  {summaryKpis.ultimoDelta >= 0 ? `+${summaryKpis.ultimoDelta.toFixed(1)}%` : `${summaryKpis.ultimoDelta.toFixed(1)}%`}
                </span>
              </>
            ) : (
              <span className="text-xs font-medium text-[#5A6A74]">1er per.</span>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Legend & Series Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
        <div className="flex flex-wrap items-center gap-3">
          {/* Total Line Toggle */}
          <button
            onClick={() => setShowTotal(!showTotal)}
            className={`flex items-center gap-2 px-2.5 py-1 rounded-xl border transition-all cursor-pointer font-semibold ${
              showTotal
                ? 'bg-[#EEECFB] border-[#C5BDF7] text-[#442dd7] shadow-2xs'
                : 'bg-[#F5F8F9] border-[#D5DEE2] text-[#5A6A74] opacity-60'
            }`}
            title="Activar / Desactivar línea de Personal Total"
          >
            <div className="w-3 h-3 rounded-full bg-[#442dd7] flex items-center justify-center">
              {showTotal && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            <span>Personal Total</span>
          </button>

          {/* Directo Line Toggle */}
          <button
            onClick={() => {
              if (tipoFilter === 'Indirecto') {
                setTipoFilter('all');
                setShowDirecto(true);
              } else {
                setShowDirecto(!showDirecto);
              }
            }}
            className={`flex items-center gap-2 px-2.5 py-1 rounded-xl border transition-all cursor-pointer font-semibold ${
              showDirecto && tipoFilter !== 'Indirecto'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-2xs'
                : 'bg-[#F5F8F9] border-[#D5DEE2] text-[#5A6A74] opacity-60'
            }`}
            title="Activar / Desactivar línea de Personal Directo (Obra y Campo)"
          >
            <div className="w-3 h-3 rounded-full bg-emerald-500 flex items-center justify-center">
              {showDirecto && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            <span>Personal Directo</span>
          </button>

          {/* Indirecto Line Toggle */}
          <button
            onClick={() => {
              if (tipoFilter === 'Directo') {
                setTipoFilter('all');
                setShowIndirecto(true);
              } else {
                setShowIndirecto(!showIndirecto);
              }
            }}
            className={`flex items-center gap-2 px-2.5 py-1 rounded-xl border transition-all cursor-pointer font-semibold ${
              showIndirecto && tipoFilter !== 'Directo'
                ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-2xs'
                : 'bg-[#F5F8F9] border-[#D5DEE2] text-[#5A6A74] opacity-60'
            }`}
            title="Activar / Desactivar línea de Personal Indirecto (Campamento, Bodega, Puertas)"
          >
            <div className="w-3 h-3 rounded-full bg-amber-500 flex items-center justify-center">
              {showIndirecto && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            <span>Personal Indirecto</span>
          </button>
        </div>

        <div className="text-[11px] text-[#5A6A74] font-medium">
          💡 Pasa el cursor por los puntos para ver el desglose detallado
        </div>
      </div>

      {/* Main SVG Curve Chart Canvas */}
      <div className="border border-[#D5DEE2] rounded-xl p-3 bg-white overflow-x-auto shadow-xs relative select-none">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full min-w-[720px] h-[320px] block mx-auto"
          preserveAspectRatio="none"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <defs>
            {/* Gradients */}
            <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#442dd7" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#442dd7" stopOpacity="0.00" />
            </linearGradient>
            <linearGradient id="gradDirecto" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.00" />
            </linearGradient>
            <linearGradient id="gradIndirecto" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.00" />
            </linearGradient>
            {/* Drop Shadow for Lines */}
            <filter id="shadowGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
            </filter>
          </defs>

          {/* Horizontal Grid Lines and Y-Axis Labels */}
          {yTicks.map((val, idx) => {
            const yPos = getY(val);
            return (
              <g key={`ytick-${idx}`}>
                <line
                  x1={padding.left}
                  y1={yPos}
                  x2={chartWidth - padding.right}
                  y2={yPos}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  strokeDasharray={idx === 0 ? '0' : '4,4'}
                />
                <text
                  x={padding.left - 10}
                  y={yPos + 4}
                  fontSize="11"
                  fill="#64748b"
                  fontWeight="700"
                  fontFamily="ui-monospace, monospace"
                  textAnchor="end"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* X Axis Bottom Line */}
          <line
            x1={padding.left}
            y1={padding.top + graphHeight}
            x2={chartWidth - padding.right}
            y2={padding.top + graphHeight}
            stroke="#94a3b8"
            strokeWidth="1.5"
          />

          {/* Period Highlighting Columns & Vertical Cursor Lines */}
          {activeSeries.map((d: any, idx) => {
            const xPos = getX(idx, activeSeries.length);
            const isMesSel = mesFilter instanceof Set ? mesFilter.has(d.mesKey) : (mesFilter !== 'all' && d.mesKey === mesFilter);
            const isSemSel = semanaFilter instanceof Set ? semanaFilter.has(d.semanaKey) : (semanaFilter !== 'all' && d.semanaKey === semanaFilter);
            const isSelected =
              (granularity === 'mensual' && isMesSel) ||
              (granularity === 'semanal' && isSemSel);
            const isHovered = hoveredIdx === idx;

            // X-Axis primary label text
            let primaryLabel = '';
            let secondaryLabel = '';

            if (granularity === 'mensual') {
              primaryLabel = d.mesLabel.split(' ')[0];
              secondaryLabel = d.mesLabel.split(' ')[1] || d.mesKey;
            } else if (granularity === 'semanal') {
              // Only show labels for the last week of the month (or if hovered/selected to maintain context)
              let isLastWeekOfMonth = false;
              if (idx === activeSeries.length - 1) {
                isLastWeekOfMonth = true;
              } else {
                const currentMonth = d.mesKey;
                const nextMonth = activeSeries[idx + 1].mesKey;
                if (currentMonth && nextMonth && currentMonth !== nextMonth) {
                  isLastWeekOfMonth = true;
                }
              }

              if (isLastWeekOfMonth || isHovered || isSelected) {
                // e.g. "Sem 34"
                const match = (d.semanaLabel || '').match(/Sem\s*(\d+)/i);
                primaryLabel = match ? `Sem ${match[1]}` : (d.semanaKey || `S${idx + 1}`);
                // e.g. "17/08"
                const dateMatch = (d.semanaLabel || '').match(/\(([^)]+)\)/);
                secondaryLabel = dateMatch ? dateMatch[1].split('-')[0].trim() : '';
              }
            } else {
              primaryLabel = d.fecha.split('-')[0];
              secondaryLabel = d.fecha.split('-')[1] || '';
            }

            return (
              <g key={`col-highlight-${idx}`}>
                {/* Background column on hover or selected */}
                {(isHovered || isSelected) && (
                  <rect
                    x={xPos - (graphWidth / (Math.max(2, activeSeries.length) * 2))}
                    y={padding.top}
                    width={graphWidth / Math.max(1, activeSeries.length)}
                    height={graphHeight}
                    fill={isSelected ? '#442dd7' : '#F5F8F9'}
                    fillOpacity={isSelected ? '0.10' : '0.6'}
                    rx="6"
                  />
                )}

                {/* Vertical dash line */}
                <line
                  x1={xPos}
                  y1={padding.top}
                  x2={xPos}
                  y2={padding.top + graphHeight}
                  stroke={isSelected ? '#442dd7' : isHovered ? '#8E9FA8' : '#D5DEE2'}
                  strokeWidth={isSelected || isHovered ? '1.5' : '1'}
                  strokeDasharray={isSelected ? '0' : '3,3'}
                />

                {/* X Axis Primary Label */}
                <text
                  x={xPos}
                  y={padding.top + graphHeight + 18}
                  fontSize="11"
                  fill={isSelected ? '#442dd7' : isHovered ? '#14212A' : '#5A6A74'}
                  fontWeight={isSelected || isHovered ? '700' : '500'}
                  textAnchor="middle"
                >
                  {primaryLabel}
                </text>

                {/* Secondary subtitle label */}
                {secondaryLabel && (
                  <text
                    x={xPos}
                    y={padding.top + graphHeight + 32}
                    fontSize="9"
                    fill={isSelected ? '#442dd7' : '#8E9FA8'}
                    fontWeight="500"
                    textAnchor="middle"
                  >
                    {secondaryLabel}
                  </text>
                )}
              </g>
            );
          })}

          {/* Area Gradients */}
          {showTotal && tipoFilter === 'all' && (
            <path d={buildAreaPath(totalPoints)} fill="url(#gradTotal)" />
          )}
          {showDirecto && tipoFilter !== 'Indirecto' && (
            <path d={buildAreaPath(directPoints)} fill="url(#gradDirecto)" />
          )}
          {showIndirecto && tipoFilter !== 'Directo' && (
            <path d={buildAreaPath(indirectPoints)} fill="url(#gradIndirecto)" />
          )}

          {/* Lines */}
          {/* Total Line (Teal Brand) */}
          {showTotal && tipoFilter === 'all' && (
            <path
              d={buildLinePath(totalPoints)}
              fill="none"
              stroke="#442dd7"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#shadowGlow)"
            />
          )}

          {/* Directo Line (Emerald) */}
          {showDirecto && tipoFilter !== 'Indirecto' && (
            <path
              d={buildLinePath(directPoints)}
              fill="none"
              stroke="#10b981"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Indirecto Line (Amber) */}
          {showIndirecto && tipoFilter !== 'Directo' && (
            <path
              d={buildLinePath(indirectPoints)}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data Points on the Curves */}
          {activeSeries.map((d: any, idx) => {
            const pTot = totalPoints[idx];
            const pDir = directPoints[idx];
            const pInd = indirectPoints[idx];
            const isHovered = hoveredIdx === idx;
            const isMesSel = mesFilter instanceof Set ? mesFilter.has(d.mesKey) : (mesFilter !== 'all' && d.mesKey === mesFilter);
            const isSemSel = semanaFilter instanceof Set ? semanaFilter.has(d.semanaKey) : (semanaFilter !== 'all' && d.semanaKey === semanaFilter);
            const isSelected =
              (granularity === 'mensual' && isMesSel) ||
              (granularity === 'semanal' && isSemSel);

            return (
              <g key={`points-group-${idx}`} className="cursor-pointer">
                {/* Invisible Hover overlay target */}
                <rect
                  x={pTot.x - (graphWidth / (Math.max(2, activeSeries.length) * 2))}
                  y={padding.top}
                  width={graphWidth / Math.max(1, activeSeries.length)}
                  height={graphHeight}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onClick={() => {
                    if (granularity === 'mensual') {
                      setMesFilter(d.mesKey);
                    } else if (granularity === 'semanal' && setSemanaFilter) {
                      setSemanaFilter(d.semanaKey);
                    }
                  }}
                />

                {/* Total Circle Point */}
                {showTotal && tipoFilter === 'all' && (
                  <circle
                    cx={pTot.x}
                    cy={pTot.y}
                    r={isHovered ? 6.5 : isSelected ? 5.5 : 4}
                    fill="#442dd7"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    className="transition-all"
                  />
                )}

                {/* Directo Circle Point */}
                {showDirecto && tipoFilter !== 'Indirecto' && (
                  <circle
                    cx={pDir.x}
                    cy={pDir.y}
                    r={isHovered ? 6 : 3.5}
                    fill="#10b981"
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="transition-all"
                  />
                )}

                {/* Indirecto Circle Point */}
                {showIndirecto && tipoFilter !== 'Directo' && (
                  <circle
                    cx={pInd.x}
                    cy={pInd.y}
                    r={isHovered ? 6 : 3.5}
                    fill="#f59e0b"
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="transition-all"
                  />
                )}

                {/* Numeric Pill above point if hovered or active */}
                {(isHovered || isSelected || activeSeries.length <= 4) && showTotal && tipoFilter === 'all' && (
                  <g pointerEvents="none">
                    <rect
                      x={pTot.x - 22}
                      y={pTot.y - 24}
                      width="44"
                      height="18"
                      rx="6"
                      fill="#14212A"
                      stroke="#442dd7"
                      strokeWidth="1"
                    />
                    <text
                      x={pTot.x}
                      y={pTot.y - 12}
                      fontSize="10"
                      fill="#ffffff"
                      fontWeight="900"
                      fontFamily="ui-monospace, monospace"
                      textAnchor="middle"
                    >
                      {pTot.val.toFixed(1)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Interactive Floating Tooltip (When user hovers over a point) */}
        {hoveredPointRaw && (
          <div
            className="absolute top-4 bg-slate-900/95 text-white p-4 rounded-2xl shadow-xl border border-slate-700 text-xs w-72 backdrop-blur-md animate-fade-in z-20 pointer-events-none transition-all duration-75 ease-out"
            style={{
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
              ...(isHoveredInitialPoint
                ? { left: `calc(${hoveredXPercent}% + 14px)` }
                : { left: `calc(${hoveredXPercent}% - 14px)`, transform: 'translateX(-100%)' }
              )
            }}
          >
            <div className="flex items-center justify-between border-b border-slate-700 pb-2 mb-2.5">
              <div>
                <span className="text-sm font-black text-white">
                  {granularity === 'mensual'
                    ? hoveredPointRaw.mesLabel
                    : hoveredPointRaw.semanaLabel}
                </span>
                <span className="block text-[10px] text-slate-400 font-medium font-mono">
                  {`${hoveredPointRaw.diasActivos} días registrados`}
                </span>
              </div>
              <span className="text-[10px] bg-indigo-500/30 text-indigo-300 border border-indigo-400/40 px-2 py-0.5 rounded-md font-bold">
                {metricMode === 'promedio' ? 'Prom. Día' : 'Total Acum.'}
              </span>
            </div>

            <div className="space-y-1.5 font-mono">
              {/* Total Row */}
              <div className="flex items-center justify-between text-indigo-200 font-bold bg-indigo-950/60 px-2 py-1 rounded-lg">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                  <span>Personal Total:</span>
                </span>
                <span className="text-sm font-black text-white">
                  {metricMode === 'promedio' ? hoveredPointRaw.promTotal.toFixed(1) : hoveredPointRaw.totalPersonal.toLocaleString()}
                </span>
              </div>

              {/* Directo Row */}
              <div className="flex items-center justify-between text-emerald-300 px-2 py-0.5">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>🟢 Directo:</span>
                </span>
                <span className="font-bold">
                  {metricMode === 'promedio' ? hoveredPointRaw.promDirecto.toFixed(1) : hoveredPointRaw.directoTotal.toLocaleString()}
                  <span className="text-[10px] text-emerald-400 font-normal ml-1">({hoveredPointRaw.pctDirecto.toFixed(1)}%)</span>
                </span>
              </div>

              {/* Indirecto Row */}
              <div className="flex items-center justify-between text-amber-300 px-2 py-0.5">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>🟡 Indirecto:</span>
                </span>
                <span className="font-bold">
                  {metricMode === 'promedio' ? hoveredPointRaw.promIndirecto.toFixed(1) : hoveredPointRaw.indirectoTotal.toLocaleString()}
                  <span className="text-[10px] text-amber-400 font-normal ml-1">({hoveredPointRaw.pctIndirecto.toFixed(1)}%)</span>
                </span>
              </div>

              {/* Gender & Shifts breakdown */}
              <div className="pt-2 mt-2 border-t border-slate-700 text-[11px] grid grid-cols-2 gap-2 text-slate-300">
                <div>
                  <span className="text-[10px] text-slate-400 block">Género:</span>
                  <span>
                    {`${hoveredPointRaw.promHombres.toFixed(1)} H / ${hoveredPointRaw.promMujeres.toFixed(1)} M`}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Turnos:</span>
                  <span>
                    {`${hoveredPointRaw.promDiurno.toFixed(1)} Día / ${hoveredPointRaw.promNoche.toFixed(1)} Noche`}
                  </span>
                </div>
              </div>

              {hoveredPointRaw.topEmpresa && (
                <div className="pt-1.5 text-[10px] text-slate-300 truncate">
                  <span className="text-slate-400">Contratista líder:</span> <strong>{hoveredPointRaw.topEmpresa}</strong>
                </div>
              )}
            </div>

            <div className="mt-2.5 pt-1.5 border-t border-slate-700/80 text-[9px] text-indigo-300 text-center font-sans font-semibold">
              Haz clic para seleccionar o filtrar este periodo
            </div>
          </div>
        )}
      </div>

      {/* Bottom Selector Bar for Quick Period Navigation */}
      {!hideBottomSelectors && granularity === 'mensual' && monthlyTrendData.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#D5DEE2]">
          <div className="flex items-center gap-1.5 text-xs text-[#5A6A74] font-medium">
            <Calendar className="w-3.5 h-3.5 text-[#442dd7]" />
            <span>Meses en tendencia:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setMesFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mesFilter === 'all' || (mesFilter instanceof Set && mesFilter.size === 0)
                  ? 'bg-[#442dd7] text-white shadow-xs'
                  : 'bg-[#EEF2F3] text-[#5A6A74] hover:bg-[#EEECFB] hover:text-[#442dd7]'
              }`}
            >
              Todos los Meses
            </button>

            {monthlyTrendData.map(m => {
              const isSelected = mesFilter instanceof Set ? mesFilter.has(m.mesKey) : mesFilter === m.mesKey;
              return (
                <button
                  key={m.mesKey}
                  onClick={() => setMesFilter(m.mesKey)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? 'bg-[#442dd7] text-white shadow-xs'
                      : 'bg-[#EEF2F3] text-[#5A6A74] hover:bg-[#EEECFB] hover:text-[#442dd7]'
                  }`}
                  title={`Filtrar por ${m.mesLabel} (${m.promTotal.toFixed(1)} pers/día)`}
                >
                  <span>{m.mesLabel.split(' ')[0]}</span>
                  <span className={`text-[10px] font-mono ${isSelected ? 'text-[#EEECFB]' : 'text-[#8E9FA8]'}`}>
                    ({m.promTotal.toFixed(0)})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Quick Week Selector (When granularity is 'semanal') */}
      {!hideBottomSelectors && !hideQuickWeekSelector && granularity === 'semanal' && weeklyTrendData.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#D5DEE2]">
          <div className="flex items-center gap-1.5 text-xs text-[#5A6A74] font-medium">
            <Calendar className="w-3.5 h-3.5 text-[#442dd7]" />
            <span>Semanas en tendencia:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => {
                if (setSemanaFilter) setSemanaFilter('all');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                semanaFilter === 'all' || (semanaFilter instanceof Set && semanaFilter.size === 0)
                  ? 'bg-[#442dd7] text-white shadow-xs'
                  : 'bg-[#EEF2F3] text-[#5A6A74] hover:bg-[#EEECFB] hover:text-[#442dd7]'
              }`}
            >
              Todas las Semanas
            </button>

            {weeklyTrendData.map(w => {
              const isSelected = semanaFilter instanceof Set ? semanaFilter.has(w.semanaKey) : semanaFilter === w.semanaKey;
              const match = (w.semanaLabel || '').match(/Sem\s*(\d+)/i);
              const semName = match ? `Sem ${match[1]}` : w.semanaKey;

              return (
                <button
                  key={w.semanaKey}
                  onClick={() => {
                    if (setSemanaFilter) setSemanaFilter(w.semanaKey);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? 'bg-[#442dd7] text-white shadow-xs'
                      : 'bg-[#EEF2F3] text-[#5A6A74] hover:bg-[#EEECFB] hover:text-[#442dd7]'
                  }`}
                  title={`${w.semanaLabel} (${w.promTotal.toFixed(1)} pers/día)`}
                >
                  <span>{semName}</span>
                  <span className={`text-[10px] font-mono ${isSelected ? 'text-[#EEECFB]' : 'text-[#8E9FA8]'}`}>
                    ({w.promTotal.toFixed(0)})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
