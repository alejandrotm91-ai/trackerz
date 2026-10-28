/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Actividad } from '../types';
import { Sparkles, Calendar, DollarSign, Clock, Layers, TrendingUp, TrendingDown, MapPin, CheckCircle2, ChevronRight, Download, Filter, Eye, Info, Hash, FileText, Sparkle } from 'lucide-react';
import { ControlSemanalTabla } from './ControlSemanalTabla';
import { CertificacionCard } from './CertificacionCard';
import { MacWindow } from './MacWindow';
import { PersonalTrendChart } from './PersonalTrendChart';
import { usePersonalData } from '../hooks/usePersonalData';
import { exportCaratulaToPdfA3 } from '../utils/exportCaratulaPdf';

interface CaratulaTabProps {
  actividades: Actividad[];
  stats: any;
  baseVenta?: string;
  periodoSeleccionado?: any;
  datosCurvaAvance?: any;
  datosDona?: any;
  dataPlanificadoPG004?: any;
  planillaInfo?: any;
  planillaTotales?: any;
  planillaEnmiendas?: any[];
  planillaTipRes?: any[];
  planillaHojas?: any[];
}

export interface ActivityDateSource {
  id: string;
  activityId: string | null;
  descripcion: string;
  wbs: string;
  fecha: Date | null;
  componente?: string;
  ubicacion?: string;
  subcontratista?: string;
  tipo?: string;
  venta?: number;
  ventaEjecutada?: number;
}

interface ComponentMilestone {
  id: string;
  code: string;
  name: string;
  alias: string;
  componenteOriginal: string;
  baselineFinish: Date | null;
  actualFinish: Date | null;
  baselineSource: ActivityDateSource | null;
  actualSource: ActivityDateSource | null;
  floatDays: number | null;
  itemsCount: number;
  totalVenta: number;
  totalEjec: number;
  pctAvance: number;
}

interface UbicacionData {
  nombre: string;
  ventaEjec: number;
  ventaPlan: number;
  ventaTotal: number;
  ventaContrato: number;
  porcentaje: number;
  itemsCount: number;
}

// Format numbers to Million notation (e.g. 102.43M), mismo formato que Certificación
function fmtMillions(val: number): string {
  const m = val / 1_000_000;
  return `${m.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
}

// Format full amount (e.g. 102,430,009.96), mismo formato que Certificación
function fmtCurrency(val: number): string {
  return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Letra de las tablas (la misma de Certificación), con cifras alineadas
const NUM_TABLA = "font-['Segoe_UI','Helvetica_Neue',Arial,sans-serif] tabular-nums";

// Format date as DD-mmm-YY (e.g. 25-nov-23)
function formatMilestoneDate(d: Date | null | undefined): string {
  if (!d || isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const m = months[d.getMonth()];
  const y = String(d.getFullYear()).slice(-2);
  return `${day}-${m}-${y}`;
}

// Excluir actividades/fechas excluidas en el cálculo de hitos (08-oct-2027, 30-abr-2026 y 30-abr-2027)
function isExemptMilestoneDate(d: Date | null | undefined): boolean {
  if (!d || isNaN(d.getTime())) return false;
  
  const y = d.getFullYear();
  const m = d.getMonth(); // 0 = Jan, 3 = Abr, 9 = Oct
  const day = d.getDate();

  const uy = d.getUTCFullYear();
  const um = d.getUTCMonth();
  const uday = d.getUTCDate();

  // 08-oct-2027
  const isOct082027 = (y === 2027 && m === 9 && day === 8) || (uy === 2027 && um === 9 && uday === 8);
  
  // 30-abr-2026
  const isApr302026 = (y === 2026 && m === 3 && day === 30) || (uy === 2026 && um === 3 && uday === 30);

  // 30-abr-2027
  const isApr302027 = (y === 2027 && m === 3 && day === 30) || (uy === 2027 && um === 3 && uday === 30);
  
  return isOct082027 || isApr302026 || isApr302027;
}

// Semi-Circular Gauge Component matching the uploaded image
const DialGauge: React.FC<{
  title: string;
  unit: string;
  currentValueStr: string;
  currentValueColor?: string;
  minLabel?: string;
  maxLabel?: string;
  percentage: number; // 0 to 100
  idPrefix: string;
}> = ({
  unit,
  currentValueStr,
  currentValueColor = 'text-[#312E81]',
  percentage,
  idPrefix,
}) => {
  // Semi-circle SVG coordinates (from 180 deg to 0 deg)
  const radius = 70;
  const strokeWidth = 20;
  const cx = 100;
  const cy = 90;
  const clampedPct = Math.max(0, Math.min(100, percentage));
  const arcLength = Math.PI * radius; // Half circumference
  const strokeDashoffset = arcLength - (arcLength * (clampedPct / 100));

  return (
    <div id={`${idPrefix}-dial-gauge`} className="flex flex-col items-center select-none">
      <div className="relative w-32 h-[4.5rem] sm:w-36 sm:h-20 flex items-end justify-center overflow-hidden">
        <svg viewBox="0 0 200 110" className="w-full h-full">
          {/* Background Track Arc */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke="#D5DEE2"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Foreground Value Arc */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke="#312E81"
            strokeWidth={strokeWidth}
            strokeDasharray={arcLength}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Big Central Value inside the arch */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1.5 pointer-events-none">
          <span className={`text-xl sm:text-2xl font-['Barlow_Condensed'] font-semibold tracking-tight ${currentValueColor}`}>
            {currentValueStr}
          </span>
        </div>
      </div>

      {/* Subtitle / Unit label */}
      <div className="mt-0.5 text-[11px] font-semibold text-[#5A6A74] tracking-wide">
        {unit}
      </div>
    </div>
  );
};

export const CaratulaTab: React.FC<CaratulaTabProps> = ({
  actividades,
  stats,
  baseVenta = 'reformulada',
  datosCurvaAvance,
  dataPlanificadoPG004,
  planillaInfo,
  planillaTotales,
  planillaEnmiendas,
  planillaTipRes,
  planillaHojas,
}) => {
  // Top level calculations
  const itemsHoja = useMemo(() => {
    return actividades.filter(a => a.esItemHoja);
  }, [actividades]);

  // Overall financial & progress metrics
  const totalPresupuesto = useMemo(() => {
    return itemsHoja.reduce((acc, a) => acc + (baseVenta === 'contrato' ? (a.ventaM || 0) : (a.venta || 0)), 0);
  }, [itemsHoja, baseVenta]);

  const totalPlan = useMemo(() => {
    return itemsHoja.reduce((acc, a) => acc + (a.ventaPlan || 0), 0);
  }, [itemsHoja]);

  const totalEjec = useMemo(() => {
    return itemsHoja.reduce((acc, a) => acc + (a.ventaEjecutada || 0), 0);
  }, [itemsHoja]);

  const pctAvanceReal = totalPresupuesto > 0 ? (totalEjec / totalPresupuesto) * 100 : 0;
  const pctPlanificado = totalPresupuesto > 0 ? (totalPlan / totalPresupuesto) * 100 : 0;

  // Certification metrics
  const certMetrics = useMemo(() => {
    if (planillaTotales && (planillaTotales.contrato || 0) > 0) {
      const contrato = planillaTotales.contrato || 0;
      const acum = planillaTotales.acum || 0;
      const pct = (acum / contrato) * 100;
      return {
        contrato,
        acum,
        pct: Number.isFinite(pct) ? pct : 0,
      };
    }
    if (planillaHojas && planillaHojas.length > 0) {
      const contrato = planillaHojas.reduce((s: number, h: any) => s + (h.contrato || 0), 0);
      const acum = planillaHojas.reduce((s: number, h: any) => s + (h.acum || 0), 0);
      const pct = contrato > 0 ? (acum / contrato) * 100 : 0;
      return { contrato, acum, pct };
    }
    return { contrato: 0, acum: 0, pct: 0 };
  }, [planillaTotales, planillaHojas]);

  // Project duration in months (Fecha inicio: 25-may-2022, Fecha fin: 12-abr-2027)
  const durationMetrics = useMemo(() => {
    // Fecha de inicio: 25-may-2022
    const projectStartDate = new Date(2022, 4, 25);
    // Fecha de terminación: 12-abr-2027
    const projectFinishDate = new Date(2027, 3, 12);
    const today = new Date();

    // Función para calcular la diferencia precisa en meses
    const getExactMonths = (d1: Date, d2: Date) => {
      let months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
      const dayDiff = d2.getDate() - d1.getDate();
      if (dayDiff > 0) {
        const daysInMonth = new Date(d2.getFullYear(), d2.getMonth() + 1, 0).getDate();
        months += dayDiff / daysInMonth;
      } else if (dayDiff < 0) {
        const daysInPrevMonth = new Date(d2.getFullYear(), d2.getMonth(), 0).getDate();
        months += dayDiff / daysInPrevMonth;
      }
      return Math.max(0, months);
    };

    const elapsedExact = getExactMonths(projectStartDate, today);
    const totalPlannedExact = getExactMonths(projectStartDate, projectFinishDate);

    const elapsedMonths = Math.floor(elapsedExact);
    const totalPlannedMonths = Math.round(totalPlannedExact);
    const percentage = totalPlannedExact > 0 ? (elapsedExact / totalPlannedExact) * 100 : 0;

    return {
      elapsedMonths,
      totalPlannedMonths,
      percentage: Math.min(100, Math.max(0, percentage)),
    };
  }, []);

  // ==========================================
  // 1. MILESTONES DEFINITION - 5 COMPONENTES ESPECÍFICOS (Columna AN)
  // 01. Civil, 03. Mecánico, 04. Eléctrico, 05. I&C, 08. Puesta en Marcha
  // ==========================================
  const componentMilestones: ComponentMilestone[] = useMemo(() => {
    const targetConfigs = [
      {
        id: 'AC3',
        code: '01',
        name: '01. Civil',
        alias: '01. Civil',
        match: (comp: string) => comp.startsWith('01.') || comp.toLowerCase().includes('civil'),
      },
      {
        id: 'AC4',
        code: '03',
        name: '03. Mecánico',
        alias: '03. Mecánico',
        match: (comp: string) => comp.startsWith('03.') || comp.toLowerCase().includes('mecanic') || comp.toLowerCase().includes('mecánic'),
      },
      {
        id: 'AC5',
        code: '04',
        name: '04. Eléctrico',
        alias: '04. Eléctrico',
        match: (comp: string) => comp.startsWith('04.') || comp.toLowerCase().includes('electric') || comp.toLowerCase().includes('eléctric'),
      },
      {
        id: 'AC6',
        code: '05',
        name: '05. I&C',
        alias: '05. I&C',
        match: (comp: string) => comp.startsWith('05.') || comp.toLowerCase().includes('i&c') || comp.toLowerCase().includes('instrumentaci'),
      },
      {
        id: 'AC7',
        code: '08',
        name: '08. Puesta en Marcha',
        alias: '08. Puesta en Marcha',
        match: (comp: string) => comp.startsWith('08.') || comp.toLowerCase().includes('puesta en marcha') || comp.toLowerCase().includes('comisionamiento') || comp.toLowerCase().includes('commissioning'),
      },
    ];

    return targetConfigs.map((cfg) => {
      // Filtrar actividades que pertenecen ESTRICTAMENTE a este componente en Columna AN
      // y cuya Ubicación en Columna AE sea 'Merinos'
      // y DESCARTANDO actividades que tengan en finish (o blFinish) la fecha 30-abr-2026 o 08-oct-2027
      const matched = itemsHoja.filter((a) => {
        const u = (a.ubicacion || '').trim();
        const isMerinos = /merino/i.test(u);
        if (!isMerinos) return false;

        // Descartar si finish o blFinish es 30-abr-2026 o 08-oct-2027
        if (isExemptMilestoneDate(a.finish) || isExemptMilestoneDate(a.blFinish)) return false;

        const itemComp = (a.componente && String(a.componente).trim() !== '')
          ? String(a.componente).trim()
          : '';
        return cfg.match(itemComp);
      });

      // Fecha más tardía de Línea Base (Col Y: blFinish, fallback Col X: blStart)
      // Excluyendo actividades que finalicen el 08-oct-2027
      let baselineSource: ActivityDateSource | null = null;
      let baselineFinish: Date | null = null;

      for (const a of matched) {
        const d = a.blFinish || a.blStart;
        if (d && !isNaN(d.getTime()) && !isExemptMilestoneDate(d) && !isExemptMilestoneDate(a.blFinish) && !isExemptMilestoneDate(a.finish)) {
          if (!baselineFinish || d.getTime() > baselineFinish.getTime()) {
            baselineFinish = d;
            baselineSource = {
              id: a.activityId || a.idOrig || a.id || a.wbs || 'S/ID',
              activityId: a.activityId || null,
              descripcion: a.descripcion || 'Sin descripción',
              wbs: a.wbs || '',
              fecha: d,
              componente: a.componente || cfg.name,
              ubicacion: a.ubicacion || '',
              subcontratista: a.subcontratista || '',
              tipo: a.tipo || '',
              venta: a.venta || 0,
              ventaEjecutada: a.ventaEjecutada || 0,
            };
          }
        }
      }

      // Fecha más tardía Real / Pronóstico (Col AA: finish, fallback Col Z: start)
      // Excluyendo actividades que finalicen el 08-oct-2027
      let actualSource: ActivityDateSource | null = null;
      let actualFinish: Date | null = null;

      for (const a of matched) {
        const d = a.finish || a.start;
        if (d && !isNaN(d.getTime()) && !isExemptMilestoneDate(d) && !isExemptMilestoneDate(a.finish) && !isExemptMilestoneDate(a.blFinish)) {
          if (!actualFinish || d.getTime() > actualFinish.getTime()) {
            actualFinish = d;
            actualSource = {
              id: a.activityId || a.idOrig || a.id || a.wbs || 'S/ID',
              activityId: a.activityId || null,
              descripcion: a.descripcion || 'Sin descripción',
              wbs: a.wbs || '',
              fecha: d,
              componente: a.componente || cfg.name,
              ubicacion: a.ubicacion || '',
              subcontratista: a.subcontratista || '',
              tipo: a.tipo || '',
              venta: a.venta || 0,
              ventaEjecutada: a.ventaEjecutada || 0,
            };
          }
        }
      }

      // Cálculo de Float en días: baselineFinish - actualFinish
      let floatDays: number | null = null;
      if (baselineFinish && actualFinish) {
        floatDays = Math.round((baselineFinish.getTime() - actualFinish.getTime()) / (1000 * 60 * 60 * 24));
      }

      const totalVenta = matched.reduce((acc, a) => acc + (baseVenta === 'contrato' ? (a.ventaM || 0) : (a.venta || 0)), 0);
      const totalEjec = matched.reduce((acc, a) => acc + (a.ventaEjecutada || 0), 0);
      const pctAvance = totalVenta > 0 ? (totalEjec / totalVenta) * 100 : 0;

      return {
        id: cfg.id,
        code: cfg.code,
        name: cfg.name,
        alias: cfg.alias,
        componenteOriginal: cfg.name,
        baselineFinish,
        actualFinish,
        baselineSource,
        actualSource,
        floatDays,
        itemsCount: matched.length,
        totalVenta,
        totalEjec,
        pctAvance,
      };
    });
  }, [itemsHoja, baseVenta]);

  // ==========================================
  // 2. UBICACION BREAKDOWN (Merinos, Progreso, Guayacanes)
  // SUMAR.SI de Columna I (V.Contrato) buscando en Columna AE (Ubicación)
  // SUMAR.SI de Columna AV (Venta Ex.) buscando en Columna AE (Ubicación)
  // % = (V.Ejec [Col AV] / V.Contrato [Col I]) * 100
  // ==========================================
  const ubicacionData = useMemo(() => {
    const ubicacionesTarget = ['Merinos', 'Progreso', 'Guayacanes'];
    const map: Record<string, UbicacionData> = {};

    ubicacionesTarget.forEach(nombre => {
      map[nombre] = {
        nombre,
        ventaEjec: 0,      // Numerador: SUMAR.SI(Columna AE == nombre, Columna AV)
        ventaPlan: 0,
        ventaTotal: 0,
        ventaContrato: 0,  // Denominador: SUMAR.SI(Columna AE == nombre, Columna I)
        porcentaje: 0,     // (ventaEjec / ventaContrato) * 100
        itemsCount: 0,
      };
    });

    itemsHoja.forEach(a => {
      const uRaw = (a.ubicacion || '').trim();
      let matchedUbicacion: string | null = null;

      // 1. Buscar coincidencia exacta o por subcadena en la Columna AE (a.ubicacion)
      if (uRaw) {
        const uLower = uRaw.toLowerCase();
        for (const target of ubicacionesTarget) {
          if (uLower === target.toLowerCase() || uLower.includes(target.toLowerCase())) {
            matchedUbicacion = target;
            break;
          }
        }
        // Si tiene otra ubicación distinta a las 3 principales, registrarla dinámicamente
        if (!matchedUbicacion) {
          matchedUbicacion = uRaw;
        }
      } else {
        // Fallback: Inferir desde WBS o descripción si columna AE viniese vacía
        const wLower = (a.wbs || '').toLowerCase();
        const dLower = (a.descripcion || '').toLowerCase();
        for (const target of ubicacionesTarget) {
          if (wLower.includes(target.toLowerCase()) || dLower.includes(target.toLowerCase())) {
            matchedUbicacion = target;
            break;
          }
        }
      }

      if (matchedUbicacion) {
        if (!map[matchedUbicacion]) {
          map[matchedUbicacion] = {
            nombre: matchedUbicacion,
            ventaEjec: 0,
            ventaPlan: 0,
            ventaTotal: 0,
            ventaContrato: 0,
            porcentaje: 0,
            itemsCount: 0,
          };
        }

        const vContrato = a.venta || 0; // Columna I: V.Contrato (Denominador)
        const vEjec = a.ventaEjecutada || 0; // Columna AV: Venta Ex. (Numerador)
        const vPlan = a.ventaPlan || 0;

        map[matchedUbicacion].ventaContrato += vContrato;
        map[matchedUbicacion].ventaTotal += vContrato;
        map[matchedUbicacion].ventaEjec += vEjec;
        map[matchedUbicacion].ventaPlan += vPlan;
        map[matchedUbicacion].itemsCount += 1;
      }
    });

    // Filtrar ubicaciones con datos reales (o mantener las 3 estándar si tienen presupuesto/avance)
    const list = Object.values(map)
      .filter(item => item.itemsCount > 0 || item.ventaContrato > 0 || item.ventaEjec > 0)
      .sort((a, b) => b.ventaContrato - a.ventaContrato);

    list.forEach(item => {
      // Cálculo del %: Numerador (V.Ejec Col AV) / Denominador (V.Contrato Col I) * 100
      item.porcentaje = item.ventaContrato > 0 ? (item.ventaEjec / item.ventaContrato) * 100 : 0;
    });

    return list;
  }, [itemsHoja]);

  // ==========================================
  // 3. PERSONAL DATA & TREND CHART STATE
  // ==========================================
  const {
    normalizedRegistros,
    availableMeses,
    availableSemanas,
  } = usePersonalData();

  const [personalUbicacionFilter, setPersonalUbicacionFilter] = useState<string>('all');
  const [personalMesFilter, setPersonalMesFilter] = useState<string>('all');
  const [personalSemanaFilter, setPersonalSemanaFilter] = useState<string>('all');
  const [personalFechaFilter, setPersonalFechaFilter] = useState<string>('all');
  const [personalTipoFilter, setPersonalTipoFilter] = useState<'all' | 'Directo' | 'Indirecto'>('all');
  const [personalEmpresaFilter, setPersonalEmpresaFilter] = useState<string>('all');
  const [personalFrenteFilter, setPersonalFrenteFilter] = useState<string>('all');
  const [personalTurnoFilter, setPersonalTurnoFilter] = useState<'all' | 'diurno' | 'noche'>('all');
  const [personalGeneroFilter, setPersonalGeneroFilter] = useState<'all' | 'hombres' | 'mujeres'>('all');
  const [personalSearchQuery, setPersonalSearchQuery] = useState<string>('');

  const filteredPersonalRegistros = useMemo(() => {
    return normalizedRegistros.filter(r => {
      if (personalUbicacionFilter !== 'all' && r.ubicacion !== personalUbicacionFilter) return false;
      if (personalMesFilter !== 'all' && r.mesKey !== personalMesFilter) return false;
      if (personalSemanaFilter !== 'all' && r.semanaKey !== personalSemanaFilter) return false;
      if (personalFechaFilter !== 'all' && r.fecha !== personalFechaFilter) return false;
      if (personalTipoFilter !== 'all' && r.tipo !== personalTipoFilter) return false;
      if (personalEmpresaFilter !== 'all' && r.empresa !== personalEmpresaFilter) return false;
      if (personalFrenteFilter !== 'all' && r.frente !== personalFrenteFilter) return false;
      if (personalTurnoFilter === 'diurno' && (r.hd + r.md) === 0) return false;
      if (personalTurnoFilter === 'noche' && (r.hn + r.mn) === 0) return false;
      if (personalGeneroFilter === 'hombres' && r.h === 0) return false;
      if (personalGeneroFilter === 'mujeres' && r.m === 0) return false;
      if (personalSearchQuery.trim()) {
        const q = personalSearchQuery.toLowerCase().trim();
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
    normalizedRegistros,
    personalUbicacionFilter,
    personalMesFilter,
    personalSemanaFilter,
    personalFechaFilter,
    personalTipoFilter,
    personalEmpresaFilter,
    personalFrenteFilter,
    personalTurnoFilter,
    personalGeneroFilter,
    personalSearchQuery
  ]);

  // Optimization: Defer mounting heavy PersonalTrendChart on first paint
  const [renderPersonalChart, setRenderPersonalChart] = useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setRenderPersonalChart(true), 100);
    return () => clearTimeout(t);
  }, []);

  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const handleExportPdf = async () => {
    if (isExportingPdf) return;
    try {
      setIsExportingPdf(true);
      await exportCaratulaToPdfA3('caratula-container');
    } catch (err) {
      console.error('Error al exportar PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div 
      id="caratula-container" 
      style={{ fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', Arial, sans-serif" }} 
      className="relative space-y-6 w-full max-w-7xl mx-auto pb-12 animate-fade-in font-['Segoe_UI',sans-serif]"
    >
      {/* Subtle Rocket Export to PDF A3 Button */}
      <div className="flex justify-end items-center -mb-2" data-html2canvas-ignore="true">
        <button
          id="btn-export-caratula-pdf"
          type="button"
          onClick={handleExportPdf}
          disabled={isExportingPdf}
          className="group relative inline-flex items-center justify-center p-2 rounded-xl bg-white hover:bg-[#F5F8F9] border border-[#D5DEE2] hover:border-[#CD0000] text-[#5A6A74] hover:text-[#CD0000] shadow-xs transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          title="Exportar Resumen a PDF (Formato A3)"
          aria-label="Exportar Resumen a PDF en formato A3"
        >
          <span className={`text-base leading-none transition-transform duration-300 ${isExportingPdf ? 'animate-bounce' : 'group-hover:scale-125 group-hover:-rotate-12'}`}>
            🚀
          </span>
          {isExportingPdf && (
            <span className="ml-1.5 text-[11px] font-bold text-[#CD0000] font-mono tracking-tight animate-pulse">
              Generando A3...
            </span>
          )}
        </button>
      </div>

      {/* Main Container - Structured Vertical / Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT / MAIN COLUMN: Vertical Stack */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* 1. TOP SECTION: 3 SEMI-CIRCLE GAUGES */}
          <div id="card-top-gauges" className="bg-white rounded-xl px-4 py-3 border border-[#D5DEE2] shadow-xs">
            <div className="text-xs font-['Barlow_Condensed'] font-semibold uppercase tracking-wider text-[#14212A] mb-2 pb-1.5 border-b border-[#D5DEE2] flex items-center justify-between">
              <span>Indicadores Generales de Desempeño</span>
              <span className="text-[11px] font-normal text-[#5A6A74]">Corte Actual</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center justify-items-center">
              {/* Gauge 1: % Avance Proyecto */}
              <DialGauge
                idPrefix="pct-proyecto"
                title="% Avance Proyecto"
                unit="% Avance Proyecto"
                currentValueStr={`${pctAvanceReal.toFixed(2)} %`}
                currentValueColor="text-[#312E81]"
                minLabel="0,00 %"
                maxLabel={`${pctPlanificado.toFixed(2)} %`}
                percentage={pctAvanceReal}
              />

              {/* Gauge 2: % Avance Certificación */}
              <DialGauge
                idPrefix="pct-cert"
                title="% Certificación"
                unit="% Certificación"
                currentValueStr={`${certMetrics.pct.toFixed(2)} %`}
                currentValueColor="text-[#312E81]"
                minLabel="0,00 %"
                maxLabel="100,00 %"
                percentage={certMetrics.pct}
              />

              {/* Gauge 3: Mes */}
              <DialGauge
                idPrefix="mes"
                title="Mes"
                unit="Mes"
                currentValueStr={String(durationMetrics.elapsedMonths)}
                currentValueColor="text-[#312E81]"
                minLabel="0"
                maxLabel={String(durationMetrics.totalPlannedMonths)}
                percentage={durationMetrics.percentage}
              />
            </div>
          </div>

          {/* 2. MILESTONES TABLE (Fechas más tardías Z y AA por componente) */}
          <MacWindow
            id="card-milestones-table"
            title="Hitos principales por componente"
            extra="Merinos · Fechas tardías (Z y AA)"
          >
            <div className="overflow-x-auto rounded-xl border border-[#D5DEE2]">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[#F5F8F9] border-b border-[#D5DEE2] text-[#5A6A74] font-semibold">
                    <th className="py-2.5 px-3 w-12 text-center text-[#CD0000]">Id</th>
                    <th className="py-2.5 px-3">Milestone</th>
                    <th className="py-2.5 px-3 text-center text-[#CD0000]">
                      Baseline
                    </th>
                    <th className="py-2.5 px-3 text-center text-[#CD0000]">
                      Actual/Forecast
                    </th>
                    <th className="py-2.5 px-3 text-right">Float</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D5DEE2] font-medium text-[#14212A]">
                  {componentMilestones.map((m, idx) => {
                    const isNegative = m.floatDays !== null && m.floatDays < 0;
                    const baselineDateStr = formatMilestoneDate(m.baselineFinish);
                    const actualDateStr = formatMilestoneDate(m.actualFinish);

                    return (
                      <tr
                        key={`milestone-row-${m.id}-${m.name}-${idx}`}
                        className="hover:bg-[#F5F8F9] transition-colors"
                      >
                        <td className="py-2.5 px-3 text-center font-bold text-[#CD0000] font-mono">
                          {m.id}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-[#14212A]">
                          <div className="truncate max-w-[170px] sm:max-w-[220px]" title={m.alias}>
                            {m.name}
                          </div>
                        </td>

                        {/* Baseline Date Cell */}
                        <td className="py-2.5 px-3 text-center font-mono font-medium text-[#5A6A74]">
                          {baselineDateStr}
                        </td>

                        {/* Actual / Forecast Date Cell */}
                        <td className="py-2.5 px-3 text-center font-mono font-medium text-[#5A6A74]">
                          {actualDateStr}
                        </td>

                        {/* Float Cell */}
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {m.floatDays === null ? (
                            <span className="text-[#5A6A74]">-</span>
                          ) : isNegative ? (
                            <span className="text-[#B83227] font-black">
                              ({Math.abs(m.floatDays)})
                            </span>
                          ) : (
                            <span className="text-[#14212A]">
                              {m.floatDays}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-1 text-right leading-none">
              <span className="ht-note text-[11px]">
                * Valores negativos en Float indican desfase en días respecto a la línea base.
              </span>
            </div>
          </MacWindow>

          {/* 3. UBICACION / DESGLOSE EN ÁRBOL */}
          <div id="card-ubicacion-tree" className="bg-white rounded-xl px-4 py-3 border border-[#D5DEE2] shadow-xs overflow-hidden">
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#D5DEE2]">
              <div className="text-xs font-['Barlow_Condensed'] font-semibold uppercase tracking-wider text-[#14212A] flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#CD0000] shrink-0" />
                <span>Ubicación</span>
              </div>
              <span className="text-[11px] font-bold text-[#5A6A74] font-mono">
                Avance_Ejecutado
              </span>
            </div>

            {/* Tree bifurcation / branch layout */}
            <div className="flex items-center justify-between gap-2 sm:gap-4 w-full">
              
              {/* Root Node: Avance Ejecutado Total */}
              <div className="flex flex-col items-end text-right flex-1 min-w-0">
                <div className="w-full h-2 bg-[#CD0000] rounded-xs mb-1 shadow-xs" />
                <div className="text-xs font-bold text-[#14212A] tracking-tight truncate w-full">
                  Avance_Ejecutado
                </div>
                <div className={`text-xs leading-tight text-[#5A6A74] truncate w-full ${NUM_TABLA}`}>
                  {fmtCurrency(totalEjec)}
                </div>
              </div>

              {/* Connecting Tree SVG Splines */}
              <div className="w-8 sm:w-12 h-14 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 60 100" className="w-full h-full text-[#D5DEE2] stroke-current fill-none" preserveAspectRatio="none">
                  {ubicacionData.length === 1 && (
                    <path d="M 0 50 L 60 50" strokeWidth="2.5" />
                  )}
                  {ubicacionData.length === 2 && (
                    <>
                      <path d="M 0 50 C 30 50, 30 20, 60 20" strokeWidth="2.5" />
                      <path d="M 0 50 C 30 50, 30 80, 60 80" strokeWidth="2.5" />
                    </>
                  )}
                  {ubicacionData.length >= 3 && (
                    <>
                      <path d="M 0 50 C 30 50, 30 18, 60 18" strokeWidth="2.5" />
                      <path d="M 0 50 L 60 50" strokeWidth="2.5" />
                      <path d="M 0 50 C 30 50, 30 82, 60 82" strokeWidth="2.5" />
                    </>
                  )}
                </svg>
              </div>

              {/* Branch Nodes (Merinos, Progreso, etc.) */}
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                {ubicacionData.map((u) => {
                  return (
                    <div key={u.nombre} className="flex flex-col items-start text-left w-full">
                      {/* Bar Gauge */}
                      <div className="w-full h-2 bg-[#EEF2F3] rounded-xs mb-0.5 overflow-hidden border border-[#D5DEE2] relative">
                        <div
                          className="h-full bg-[#CD0000] transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(8, u.porcentaje))}%` }}
                        />
                      </div>
                      <div className="text-xs leading-tight font-bold text-[#14212A] flex items-center justify-between w-full gap-1">
                        <span className="truncate">{u.nombre}</span>
                        <span className={`text-[11px] font-normal text-[#CD0000] shrink-0 ${NUM_TABLA}`}>
                          {u.porcentaje.toFixed(1)}%
                        </span>
                      </div>
                      <div className={`text-xs leading-tight text-[#5A6A74] truncate w-full ${NUM_TABLA}`}>
                        {fmtCurrency(u.ventaEjec)}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Tabla de Control de Ejecución (Solo tabla y dropdown de semana) + Certificación */}
        <div className="lg:col-span-7 space-y-4">
          <MacWindow title="Avance por componente" extra="V. Contrato · Plan · Ejecutado">
            <ControlSemanalTabla
              actividades={actividades}
              dataPlanificadoPG004={dataPlanificadoPG004}
              baseVenta={baseVenta}
              soloTablaYSemana={true}
            />
          </MacWindow>

          <MacWindow title="Certificación" extra="Planilla contractual por tipología">
          <CertificacionCard
            planillaInfo={planillaInfo}
            planillaTotales={planillaTotales}
            planillaEnmiendas={planillaEnmiendas}
            planillaTipRes={planillaTipRes}
            planillaHojas={planillaHojas}
            idPrefix="certificacion-caratula"
            showHeader={false}
            showKpis={false}
            showEnmiendas={false}
          />
          </MacWindow>
        </div>

      </div>

      {/* 3. Curva de Tendencia de Personal (Full width, cards, toggles & interactive filters included) */}
      <div id="caratula-personal-trend-section" className="w-full">
        {renderPersonalChart ? (
          <PersonalTrendChart
            allRegistros={normalizedRegistros}
            filteredRegistros={filteredPersonalRegistros}
            ubicacionFilter={personalUbicacionFilter}
            mesFilter={personalMesFilter}
            setMesFilter={setPersonalMesFilter}
            semanaFilter={personalSemanaFilter}
            setSemanaFilter={setPersonalSemanaFilter}
            fechaFilter={personalFechaFilter}
            tipoFilter={personalTipoFilter}
            setTipoFilter={setPersonalTipoFilter}
            empresaFilter={personalEmpresaFilter}
            setEmpresaFilter={setPersonalEmpresaFilter}
            frenteFilter={personalFrenteFilter}
            turnoFilter={personalTurnoFilter}
            generoFilter={personalGeneroFilter}
            searchQuery={personalSearchQuery}
            availableMeses={availableMeses}
            availableSemanas={availableSemanas}
            hideQuickWeekSelector={true}
            hideBottomSelectors={true}
            defaultGranularity="mensual"
          />
        ) : (
          <div className="bg-white rounded-xl p-6 border border-[#D5DEE2] text-center text-xs text-[#5A6A74] font-medium animate-pulse shadow-xs">
            Cargando curva de tendencia de personal...
          </div>
        )}
      </div>
    </div>
  );
};
