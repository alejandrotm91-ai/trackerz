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
  mesFilter: string;
  setMesFilter: (mes: string) => void;
  semanaFilter: string;
  setSemanaFilter?: (semana: string) => void;
  fechaFilter: string;
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
  totalPersonal: number;
  directoTotal: number;
  indirectoTotal: number;
  hombresTotal: number;
  mujeresTotal: number;
  diurnoTotal: number;
  nocheTotal: number;
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
  availableSemanas = []
}) => {
  // Mode: 'promedio' (Promedio diario) | 'acumulado' (Total acumulado)
  const [metricMode, setMetricMode] = useState<'promedio' | 'acumulado'>('promedio');
  // Granularity: 'mensual' | 'semanal' | 'diaria' (Default: semanal)
  const [granularity, setGranularity] = useState<'mensual' | 'semanal' | 'diaria'>('semanal');
  // Visible lines toggles
  const [showDirecto, setShowDirecto] = useState<boolean>(true);
  const [showIndirecto, setShowIndirecto] = useState<boolean>(true);
  const [showTotal, setShowTotal] = useState<boolean>(true);
  // Hovered Point index for Tooltip
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Filter records respecting all header/card filters EXCEPT mesFilter and semanaFilter (so we can plot full trend across all months/weeks)
  // But if the user has selected specific empresa/frente/tipo/genero/turno, those ARE applied to the trend!
  const recordsForFullTrend = useMemo(() => {
    return allRegistros.filter(r => {
      // Ubicacion
      if (ubicacionFilter !== 'all' && r.ubicacion !== ubicacionFilter) return false;
      // Tipo (Directo / Indirecto)
      if (tipoFilter !== 'all' && r.tipo !== tipoFilter) return false;
      // Empresa
      if (empresaFilter !== 'all' && r.empresa !== empresaFilter) return false;
      // Frente
      if (frenteFilter !== 'all' && r.frente !== frenteFilter) return false;
      // Turno
      if (turnoFilter === 'diurno' && (r.hd + r.md) === 0) return false;
      if (turnoFilter === 'noche' && (r.hn + r.mn) === 0) return false;
      // Genero
      if (generoFilter === 'hombres' && r.h === 0) return false;
      if (generoFilter === 'mujeres' && r.m === 0) return false;
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const emp = (r.empresa || '').toLowerCase();
        const f = (r.frente || '').toLowerCase();
        const act = (r.actividad || '').toLowerCase();
        const u = (r.ubicacion || '').toLowerCase();
        if (!emp.includes(q) && !f.includes(q) && !act.includes(q) && !u.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [
    allRegistros,
    ubicacionFilter,
    tipoFilter,
    empresaFilter,
    frenteFilter,
    turnoFilter,
    generoFilter,
    searchQuery
  ]);

  // Compute Monthly Aggregated Trend Series (Sorted Chronologically)
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

    recordsForFullTrend.forEach(r => {
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
  }, [availableMeses, recordsForFullTrend]);

  // Compute Weekly Aggregated Trend Series (Sorted Chronologically)
  const weeklyTrendData: WeeklyTrendDataPoint[] = useMemo(() => {
    const map = new Map<string, {
      semanaKey: string;
      semanaLabel: string;
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

    // If mesFilter is set, we can either restrict to weeks in that month or show all weeks
    const recordsToGroup = mesFilter !== 'all'
      ? recordsForFullTrend.filter(r => r.mesKey === mesFilter)
      : recordsForFullTrend;

    recordsToGroup.forEach(r => {
      if (!r.semanaKey) return;
      if (!map.has(r.semanaKey)) {
        map.set(r.semanaKey, {
          semanaKey: r.semanaKey,
          semanaLabel: r.semanaLabel || r.semanaKey,
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
  }, [recordsForFullTrend, mesFilter]);

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

    return sortedDates.map((d, i) => ({
      fecha: d.fecha,
      fechaIso: d.fechaIso,
      diaNumero: i + 1,
      mesKey: d.mesKey,
      mesLabel: d.mesLabel,
      semanaKey: d.semanaKey,
      semanaLabel: d.semanaLabel,
      totalPersonal: d.total,
      directoTotal: d.directo,
      indirectoTotal: d.indirecto,
      hombresTotal: d.hombres,
      mujeresTotal: d.mujeres,
      diurnoTotal: d.diurno,
      nocheTotal: d.noche,
      empresasContadas: d.empresasSet.size
    }));
  }, [filteredRegistros]);

  // Active data series according to selected granularity
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
      const valTotal = granularity === 'diaria' ? item.totalPersonal : item.promTotal;
      const curMax = granularity === 'diaria' ? picoItem.totalPersonal : picoItem.promTotal;
      if (valTotal > curMax) {
        picoItem = item;
      }
      if (granularity === 'diaria') {
        sumProm += item.totalPersonal;
        sumDirecto += item.directoTotal;
        sumIndirecto += item.indirectoTotal;
        count++;
      } else if (item.diasActivos > 0) {
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
    const ultimoDelta = granularity !== 'diaria' ? ultimoItem?.deltaPromTotal : null;

    const picoLabel = granularity === 'mensual'
      ? picoItem?.mesLabel
      : granularity === 'semanal'
      ? picoItem?.semanaLabel?.split('(')[0] || picoItem?.semanaKey
      : picoItem?.fecha;

    const picoValor = granularity === 'diaria' ? picoItem?.totalPersonal : picoItem?.promTotal;

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
      if (granularity === 'diaria') {
        max = Math.max(max, d.totalPersonal, d.directoTotal, d.indirectoTotal);
      } else {
        const valTotal = metricMode === 'promedio' ? d.promTotal : d.totalPersonal;
        const valDir = metricMode === 'promedio' ? d.promDirecto : d.directoTotal;
        const valInd = metricMode === 'promedio' ? d.promIndirecto : d.indirectoTotal;
        max = Math.max(max, valTotal, valDir, valInd);
      }
    });
    return Math.ceil((max * 1.15) / 10) * 10 || 50;
  }, [activeSeries, granularity, metricMode]);

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
      const val = granularity === 'diaria'
        ? d.directoTotal
        : (metricMode === 'promedio' ? d.promDirecto : d.directoTotal);
      return { x: getX(i, activeSeries.length), y: getY(val), val, raw: d };
    });
  }, [activeSeries, granularity, metricMode, maxY]);

  const indirectPoints = useMemo(() => {
    return activeSeries.map((d: any, i) => {
      const val = granularity === 'diaria'
        ? d.indirectoTotal
        : (metricMode === 'promedio' ? d.promIndirecto : d.indirectoTotal);
      return { x: getX(i, activeSeries.length), y: getY(val), val, raw: d };
    });
  }, [activeSeries, granularity, metricMode, maxY]);

  const totalPoints = useMemo(() => {
    return activeSeries.map((d: any, i) => {
      const val = granularity === 'diaria'
        ? d.totalPersonal
        : (metricMode === 'promedio' ? d.promTotal : d.totalPersonal);
      return { x: getX(i, activeSeries.length), y: getY(val), val, raw: d };
    });
  }, [activeSeries, granularity, metricMode, maxY]);

  // Selected item data on hover
  const hoveredPointRaw: any = hoveredIdx !== null && hoveredIdx >= 0 && hoveredIdx < activeSeries.length
    ? (activeSeries[hoveredIdx] as any)
    : null;

  // Grid steps (5 horizontal grid lines)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxY * f));

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5" id="personal-trend-chart-card">
      {/* Header Bar: Title, Context Badges & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shadow-xs">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Curva de Tendencia de Personal</span>
                <span className="text-[10px] bg-indigo-100 text-indigo-800 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Directo vs Indirecto
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Comportamiento y evolución mensual, semanal o diaria de la dotación en obra.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls: Granularity Switcher (Mes / Semana / Día) and Metric Mode */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Granularity Switch: Mes, Semana, Día */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200 text-xs font-bold shadow-2xs">
            <button
              onClick={() => {
                setGranularity('mensual');
                setHoveredIdx(null);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                granularity === 'mensual'
                  ? 'bg-white text-indigo-950 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
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
                  ? 'bg-white text-indigo-950 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Ver tendencia semanal (Semana a semana)"
            >
              🗓️ Por Semana ({weeklyTrendData.length})
            </button>

            <button
              onClick={() => {
                setGranularity('diaria');
                setHoveredIdx(null);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                granularity === 'diaria'
                  ? 'bg-white text-indigo-950 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Ver evolución día a día de los registros filtrados"
            >
              📊 Por Día ({dailyTrendData.length})
            </button>
          </div>

          {/* Metric Mode Switch (Promedio Diario vs Total Acumulado) */}
          {granularity !== 'diaria' && (
            <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200 text-xs font-bold">
              <button
                onClick={() => setMetricMode('promedio')}
                className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  metricMode === 'promedio'
                    ? 'bg-white text-indigo-950 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Promedio de personas por día activo en el periodo (Métrica recomendada)"
              >
                Prom. Día
              </button>
              <button
                onClick={() => setMetricMode('acumulado')}
                className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  metricMode === 'acumulado'
                    ? 'bg-white text-indigo-950 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Suma total acumulada de asistencias en el periodo"
              >
                Total Acum.
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter Chips State - Visual Feedback of Active Header & Card Filters */}
      {(ubicacionFilter !== 'all' || empresaFilter !== 'all' || frenteFilter !== 'all' || tipoFilter !== 'all' || turnoFilter !== 'all' || generoFilter !== 'all' || searchQuery.trim() || mesFilter !== 'all' || semanaFilter !== 'all') && (
        <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-extrabold text-indigo-900 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-indigo-600" />
              <span>Curva ajustada por:</span>
            </span>

            {ubicacionFilter !== 'all' && (
              <span className="bg-white border border-indigo-200 text-indigo-950 px-2 py-0.5 rounded-lg font-bold">
                📍 {ubicacionFilter}
              </span>
            )}
            {empresaFilter !== 'all' && (
              <span className="bg-indigo-100 border border-indigo-300 text-indigo-900 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                <span>{empresaFilter}</span>
              </span>
            )}
            {tipoFilter !== 'all' && (
              <span className={`px-2 py-0.5 rounded-lg font-bold border ${
                tipoFilter === 'Directo' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-amber-100 text-amber-900 border-amber-300'
              }`}>
                {tipoFilter === 'Directo' ? '🟢 Solo Directo' : '🟡 Solo Indirecto'}
              </span>
            )}
            {generoFilter !== 'all' && (
              <span className="bg-white border border-indigo-200 text-indigo-900 px-2 py-0.5 rounded-lg font-bold">
                {generoFilter === 'hombres' ? '👤 Hombres' : '👩 Mujeres'}
              </span>
            )}
            {turnoFilter !== 'all' && (
              <span className="bg-white border border-indigo-200 text-indigo-900 px-2 py-0.5 rounded-lg font-bold">
                {turnoFilter === 'diurno' ? '☀️ Diurno' : '🌙 Noche'}
              </span>
            )}
            {frenteFilter !== 'all' && (
              <span className="bg-white border border-indigo-200 text-indigo-900 px-2 py-0.5 rounded-lg font-bold">
                Frente: {frenteFilter}
              </span>
            )}
            {mesFilter !== 'all' && (
              <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 shadow-xs">
                <Calendar className="w-3 h-3" />
                <span>Mes: {availableMeses.find(([k]) => k === mesFilter)?.[1] || mesFilter}</span>
              </span>
            )}
            {semanaFilter !== 'all' && (
              <span className="bg-indigo-700 text-white px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 shadow-xs">
                <span>Semana activa</span>
              </span>
            )}
          </div>

          <div className="text-[11px] text-slate-500 font-medium">
            {recordsForFullTrend.length} registros analizados
          </div>
        </div>
      )}

      {/* KPI Highlight Strip for Trend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Periodo Pico */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            {granularity === 'mensual' ? 'Mes Pico' : granularity === 'semanal' ? 'Semana Pico' : 'Día Pico'}
          </span>
          <div className="mt-1">
            <div className="text-base font-black text-slate-900 truncate" title={summaryKpis.picoLabel}>
              {summaryKpis.picoLabel}
            </div>
            <div className="text-xs font-mono font-bold text-indigo-700">
              {summaryKpis.picoValor ? `${summaryKpis.picoValor.toFixed(1)} pers./día` : '-'}
            </div>
          </div>
        </div>

        {/* Promedio Histórico */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            {granularity === 'diaria' ? 'Dotación Diaria Promedio' : 'Promedio por Periodo'}
          </span>
          <div className="mt-1">
            <div className="text-xl font-black text-slate-900 font-mono">
              {summaryKpis.promedioGlobal.toFixed(1)}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              Personas / día ({activeSeries.length} {granularity === 'mensual' ? 'meses' : granularity === 'semanal' ? 'semanas' : 'días'})
            </div>
          </div>
        </div>

        {/* Proporción Directo / Indirecto */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            Mix Directo / Indirecto
          </span>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded">
              🟢 {summaryKpis.promRatioDirecto.toFixed(0)}% Dir
            </span>
            <span className="text-xs font-bold text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded">
              🟡 {(100 - summaryKpis.promRatioDirecto).toFixed(0)}% Ind
            </span>
          </div>
        </div>

        {/* Tendencia Último Periodo */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            {granularity === 'semanal' ? 'Variación WoW (vs Sem. Ant.)' : 'Variación MoM (vs Mes Ant.)'}
          </span>
          <div className="mt-1 flex items-center gap-1.5">
            {summaryKpis.ultimoDelta !== null && summaryKpis.ultimoDelta !== undefined ? (
              <>
                {summaryKpis.ultimoDelta >= 0 ? (
                  <ArrowUpRight className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <ArrowDownRight className="w-5 h-5 text-rose-600 shrink-0" />
                )}
                <span className={`text-base font-black font-mono ${
                  summaryKpis.ultimoDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  {summaryKpis.ultimoDelta >= 0 ? `+${summaryKpis.ultimoDelta.toFixed(1)}%` : `${summaryKpis.ultimoDelta.toFixed(1)}%`}
                </span>
              </>
            ) : (
              <span className="text-xs font-medium text-slate-400">Primer periodo</span>
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
            className={`flex items-center gap-2 px-2.5 py-1 rounded-xl border transition-all cursor-pointer font-bold ${
              showTotal
                ? 'bg-indigo-50 border-indigo-300 text-indigo-950 shadow-2xs'
                : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
            }`}
            title="Activar / Desactivar línea de Personal Total"
          >
            <div className="w-3 h-3 rounded-full bg-indigo-600 flex items-center justify-center">
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
            className={`flex items-center gap-2 px-2.5 py-1 rounded-xl border transition-all cursor-pointer font-bold ${
              showDirecto && tipoFilter !== 'Indirecto'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-2xs'
                : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
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
            className={`flex items-center gap-2 px-2.5 py-1 rounded-xl border transition-all cursor-pointer font-bold ${
              showIndirecto && tipoFilter !== 'Directo'
                ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-2xs'
                : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
            }`}
            title="Activar / Desactivar línea de Personal Indirecto (Campamento, Bodega, Puertas)"
          >
            <div className="w-3 h-3 rounded-full bg-amber-500 flex items-center justify-center">
              {showIndirecto && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            <span>Personal Indirecto</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-400 font-medium">
          💡 Pasa el cursor por los puntos para ver el desglose detallado
        </div>
      </div>

      {/* Main SVG Curve Chart Canvas */}
      <div className="border border-slate-200 rounded-2xl p-3 bg-gradient-to-b from-slate-50/50 to-white overflow-x-auto shadow-inner relative select-none">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full min-w-[720px] h-[320px] block mx-auto"
          preserveAspectRatio="none"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <defs>
            {/* Gradients */}
            <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.00" />
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
            const isSelected =
              (granularity === 'mensual' && mesFilter !== 'all' && d.mesKey === mesFilter) ||
              (granularity === 'semanal' && semanaFilter !== 'all' && d.semanaKey === semanaFilter);
            const isHovered = hoveredIdx === idx;

            // X-Axis primary label text
            let primaryLabel = '';
            let secondaryLabel = '';

            if (granularity === 'mensual') {
              primaryLabel = d.mesLabel.split(' ')[0];
              secondaryLabel = d.mesLabel.split(' ')[1] || d.mesKey;
            } else if (granularity === 'semanal') {
              // e.g. "Sem 34"
              const match = (d.semanaLabel || '').match(/Sem\s*(\d+)/i);
              primaryLabel = match ? `Sem ${match[1]}` : (d.semanaKey || `S${idx + 1}`);
              // e.g. "17/08"
              const dateMatch = (d.semanaLabel || '').match(/\(([^)]+)\)/);
              secondaryLabel = dateMatch ? dateMatch[1].split('-')[0].trim() : '';
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
                    fill={isSelected ? '#6366f1' : '#f1f5f9'}
                    fillOpacity={isSelected ? '0.08' : '0.6'}
                    rx="6"
                  />
                )}

                {/* Vertical dash line */}
                <line
                  x1={xPos}
                  y1={padding.top}
                  x2={xPos}
                  y2={padding.top + graphHeight}
                  stroke={isSelected ? '#6366f1' : isHovered ? '#94a3b8' : '#e2e8f0'}
                  strokeWidth={isSelected || isHovered ? '1.5' : '1'}
                  strokeDasharray={isSelected ? '0' : '3,3'}
                />

                {/* X Axis Primary Label */}
                <text
                  x={xPos}
                  y={padding.top + graphHeight + 18}
                  fontSize="11"
                  fill={isSelected ? '#4338ca' : isHovered ? '#0f172a' : '#475569'}
                  fontWeight={isSelected || isHovered ? '900' : '700'}
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
                    fill={isSelected ? '#6366f1' : '#94a3b8'}
                    fontWeight="600"
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
          {/* Total Line (Indigo) */}
          {showTotal && tipoFilter === 'all' && (
            <path
              d={buildLinePath(totalPoints)}
              fill="none"
              stroke="#6366f1"
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
            const isSelected =
              (granularity === 'mensual' && mesFilter !== 'all' && d.mesKey === mesFilter) ||
              (granularity === 'semanal' && semanaFilter !== 'all' && d.semanaKey === semanaFilter);

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
                      if (mesFilter === d.mesKey) setMesFilter('all');
                      else setMesFilter(d.mesKey);
                    } else if (granularity === 'semanal' && setSemanaFilter) {
                      if (semanaFilter === d.semanaKey) setSemanaFilter('all');
                      else setSemanaFilter(d.semanaKey);
                    }
                  }}
                />

                {/* Total Circle Point */}
                {showTotal && tipoFilter === 'all' && (
                  <circle
                    cx={pTot.x}
                    cy={pTot.y}
                    r={isHovered ? 6.5 : isSelected ? 5.5 : 4}
                    fill="#6366f1"
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
                      fill="#1e1b4b"
                      stroke="#4338ca"
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
            className="absolute top-4 right-4 bg-slate-900/95 text-white p-4 rounded-2xl shadow-xl border border-slate-700 text-xs w-72 backdrop-blur-md animate-fade-in z-20 pointer-events-none"
            style={{
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)'
            }}
          >
            <div className="flex items-center justify-between border-b border-slate-700 pb-2 mb-2.5">
              <div>
                <span className="text-sm font-black text-white">
                  {granularity === 'mensual'
                    ? hoveredPointRaw.mesLabel
                    : granularity === 'semanal'
                    ? hoveredPointRaw.semanaLabel
                    : `Fecha: ${hoveredPointRaw.fecha}`}
                </span>
                <span className="block text-[10px] text-slate-400 font-medium font-mono">
                  {granularity !== 'diaria'
                    ? `${hoveredPointRaw.diasActivos} días registrados`
                    : `${hoveredPointRaw.empresasContadas} empresas`}
                </span>
              </div>
              <span className="text-[10px] bg-indigo-500/30 text-indigo-300 border border-indigo-400/40 px-2 py-0.5 rounded-md font-bold">
                {granularity === 'diaria' ? 'Por Día' : (metricMode === 'promedio' ? 'Prom. Día' : 'Total Acum.')}
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
                  {granularity === 'diaria'
                    ? hoveredPointRaw.totalPersonal
                    : (metricMode === 'promedio' ? hoveredPointRaw.promTotal.toFixed(1) : hoveredPointRaw.totalPersonal.toLocaleString())}
                </span>
              </div>

              {/* Directo Row */}
              <div className="flex items-center justify-between text-emerald-300 px-2 py-0.5">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>🟢 Directo:</span>
                </span>
                <span className="font-bold">
                  {granularity === 'diaria'
                    ? hoveredPointRaw.directoTotal
                    : (metricMode === 'promedio' ? hoveredPointRaw.promDirecto.toFixed(1) : hoveredPointRaw.directoTotal.toLocaleString())}
                  {granularity !== 'diaria' && (
                    <span className="text-[10px] text-emerald-400 font-normal ml-1">({hoveredPointRaw.pctDirecto.toFixed(1)}%)</span>
                  )}
                </span>
              </div>

              {/* Indirecto Row */}
              <div className="flex items-center justify-between text-amber-300 px-2 py-0.5">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>🟡 Indirecto:</span>
                </span>
                <span className="font-bold">
                  {granularity === 'diaria'
                    ? hoveredPointRaw.indirectoTotal
                    : (metricMode === 'promedio' ? hoveredPointRaw.promIndirecto.toFixed(1) : hoveredPointRaw.indirectoTotal.toLocaleString())}
                  {granularity !== 'diaria' && (
                    <span className="text-[10px] text-amber-400 font-normal ml-1">({hoveredPointRaw.pctIndirecto.toFixed(1)}%)</span>
                  )}
                </span>
              </div>

              {/* Gender & Shifts breakdown */}
              <div className="pt-2 mt-2 border-t border-slate-700 text-[11px] grid grid-cols-2 gap-2 text-slate-300">
                <div>
                  <span className="text-[10px] text-slate-400 block">Género:</span>
                  <span>
                    {granularity === 'diaria'
                      ? `${hoveredPointRaw.hombresTotal} H / ${hoveredPointRaw.mujeresTotal} M`
                      : `${hoveredPointRaw.promHombres.toFixed(1)} H / ${hoveredPointRaw.promMujeres.toFixed(1)} M`}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Turnos:</span>
                  <span>
                    {granularity === 'diaria'
                      ? `${hoveredPointRaw.diurnoTotal} Día / ${hoveredPointRaw.nocheTotal} Noche`
                      : `${hoveredPointRaw.promDiurno.toFixed(1)} Día / ${hoveredPointRaw.promNoche.toFixed(1)} Noche`}
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
      {granularity === 'mensual' && monthlyTrendData.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            <span>Meses en tendencia:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setMesFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mesFilter === 'all'
                  ? 'bg-indigo-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Todos los Meses
            </button>

            {monthlyTrendData.map(m => {
              const isSelected = mesFilter === m.mesKey;
              return (
                <button
                  key={m.mesKey}
                  onClick={() => setMesFilter(m.mesKey)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-900'
                  }`}
                  title={`Filtrar por ${m.mesLabel} (${m.promTotal.toFixed(1)} pers/día)`}
                >
                  <span>{m.mesLabel.split(' ')[0]}</span>
                  <span className={`text-[10px] font-mono ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>
                    ({m.promTotal.toFixed(0)})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Quick Week Selector (When granularity is 'semanal') */}
      {granularity === 'semanal' && weeklyTrendData.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            <span>Semanas en tendencia:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => {
                if (setSemanaFilter) setSemanaFilter('all');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                semanaFilter === 'all'
                  ? 'bg-indigo-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Todas las Semanas
            </button>

            {weeklyTrendData.map(w => {
              const isSelected = semanaFilter === w.semanaKey;
              const match = (w.semanaLabel || '').match(/Sem\s*(\d+)/i);
              const semName = match ? `Sem ${match[1]}` : w.semanaKey;

              return (
                <button
                  key={w.semanaKey}
                  onClick={() => {
                    if (setSemanaFilter) setSemanaFilter(w.semanaKey);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-900'
                  }`}
                  title={`${w.semanaLabel} (${w.promTotal.toFixed(1)} pers/día)`}
                >
                  <span>{semName}</span>
                  <span className={`text-[10px] font-mono ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>
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
