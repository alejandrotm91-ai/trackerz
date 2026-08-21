/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Download, ChevronRight, ChevronDown, FileSpreadsheet, Check, ChevronsUpDown, ChevronsDownUp, Calendar, Filter, Search, Minus, ArrowUp, ArrowDown } from 'lucide-react';

interface KPITabProps {
  stats: any;
  baseVenta: string;
  setBaseVenta: (v: string) => void;
  donutPG: string;
  setDonutPG: (v: string) => void;
  periodoSeleccionado: any;
  setPeriodoSeleccionado: (v: any) => void;
  mapaColumnasMes: any;
  tipologiaSeleccionada: string | null;
  setTipologiaSeleccionada: (v: string | null) => void;
  exportarAvancePeriodo: () => void;
  datosDona: any;
  donutDim: string;
  setDonutDim: (v: string) => void;
  donutAnio: string;
  setDonutAnio: (v: string) => void;
  donutMes: string;
  setDonutMes: (v: string) => void;
  donutSemana: string;
  setDonutSemana: (v: string) => void;
  donaAgregada: any;
  planFuturoAgregado: any;
  tablaUnificada: any;
  tablaSortCol: string;
  setTablaSortCol: (v: string) => void;
  tablaSortDir: string;
  setTablaSortDir: (v: string) => void;
  datosCurvaAvance: any;
  expandedYears: Set<any>;
  setExpandedYears: React.Dispatch<React.SetStateAction<Set<any>>>;
  barrasPlanVsReal: any;
  donutAcumulado?: boolean;
  setDonutAcumulado?: (v: boolean) => void;
  ultimaSemanaConAvance?: string | null;
  actividades?: any[];
  dataPlanificadoPG004?: any;
}

export const KPITab: React.FC<KPITabProps> = ({
  stats,
  baseVenta,
  setBaseVenta,
  donutPG,
  setDonutPG,
  periodoSeleccionado,
  setPeriodoSeleccionado,
  mapaColumnasMes,
  tipologiaSeleccionada,
  setTipologiaSeleccionada,
  exportarAvancePeriodo,
  datosDona,
  donutDim,
  setDonutDim,
  donutAnio,
  setDonutAnio,
  donutMes,
  setDonutMes,
  donutSemana,
  setDonutSemana,
  donaAgregada,
  planFuturoAgregado,
  tablaUnificada,
  tablaSortCol,
  setTablaSortCol,
  tablaSortDir,
  setTablaSortDir,
  datosCurvaAvance,
  expandedYears,
  setExpandedYears,
  barrasPlanVsReal,
  donutAcumulado = false,
  setDonutAcumulado,
  ultimaSemanaConAvance,
  actividades,
  dataPlanificadoPG004,
}) => {
  if (!stats) return null;

  const [openAnio, setOpenAnio] = React.useState<boolean>(false);
  const [openMes, setOpenMes] = React.useState<boolean>(false);
  const [openSemana, setOpenSemana] = React.useState<boolean>(false);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.multiselect-dropdown')) {
        setOpenAnio(false);
        setOpenMes(false);
        setOpenSemana(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fmtMoney = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt0 = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // Curva de avance económico calculada dinámicamente con V.Plan (PG-004) y V.Ejec. (CDO V-)
  const datosCurvaAvanceCalculados = React.useMemo(() => {
    if (!actividades || actividades.length === 0) return datosCurvaAvance;

    const itemsHoja = actividades.filter(a => a.esItemHoja);
    if (itemsHoja.length === 0) return datosCurvaAvance;

    const datosPorMes: Record<string, { mes: string; yyyy: number; mm: number; ejecutado: number; planificado: number }> = {};
    const processedPlanActivityIds = new Set<string>();

    const MONTH_NAMES = [
      'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
    ];

    const getYearMonth = (fechaStr: any): { yyyy: number; mm: number } | null => {
      if (!fechaStr) return null;
      const str = String(fechaStr).trim();
      const parts = str.split('-');
      if (parts.length >= 2) {
        const yyyy = parseInt(parts[0], 10);
        const mm = parseInt(parts[1], 10);
        if (!isNaN(yyyy) && !isNaN(mm) && yyyy >= 2015 && yyyy <= 2035 && mm >= 1 && mm <= 12) {
          return { yyyy, mm };
        }
      }
      return null;
    };

    const addVal = (fechaKey: any, field: 'planificado' | 'ejecutado', val: number) => {
      const numVal = Number(val) || 0;
      if (numVal === 0) return;

      const ym = getYearMonth(fechaKey);
      if (!ym) return;

      const { yyyy, mm } = ym;
      const ymKey = `${yyyy}-${String(mm).padStart(2, '0')}`;
      if (!datosPorMes[ymKey]) {
        datosPorMes[ymKey] = {
          mes: `${MONTH_NAMES[mm - 1]} ${yyyy}`,
          yyyy,
          mm,
          ejecutado: 0,
          planificado: 0,
        };
      }
      datosPorMes[ymKey][field] += numVal;
    };

    itemsHoja.forEach(item => {
      // 1. Planificado PG-004 por semana
      let planDict = (item.planificadoPorFechaPG004 && Object.keys(item.planificadoPorFechaPG004).length > 0)
        ? item.planificadoPorFechaPG004
        : null;

      if (!planDict && dataPlanificadoPG004 && item.activityId && dataPlanificadoPG004[item.activityId]) {
        const actIdStr = String(item.activityId).trim();
        if (!processedPlanActivityIds.has(actIdStr)) {
          processedPlanActivityIds.add(actIdStr);
          planDict = dataPlanificadoPG004[item.activityId];
        }
      }

      if (planDict) {
        Object.entries(planDict).forEach(([f, v]) => {
          addVal(f, 'planificado', Number(v) || 0);
        });
      }

      // 2. Ejecutado CDO V- por semana
      if (item.certificacionesPorFecha && Object.keys(item.certificacionesPorFecha).length > 0) {
        Object.entries(item.certificacionesPorFecha).forEach(([f, v]) => {
          addVal(f, 'ejecutado', Number(v) || 0);
        });
      }
    });

    const sortedYmKeys = Object.keys(datosPorMes).sort();
    if (sortedYmKeys.length === 0) return datosCurvaAvance;

    let acumE = 0;
    let acumP = 0;
    const meses = sortedYmKeys.map(k => {
      const m = datosPorMes[k];
      acumE += m.ejecutado;
      acumP += m.planificado;
      return {
        mes: m.mes,
        anio: m.yyyy,
        ejecutado: m.ejecutado,
        planificado: m.planificado,
        acumEjecutado: acumE,
        acumPlanificado: acumP,
      };
    });

    const porAnio: Record<number, any> = {};
    meses.forEach(m => {
      if (!porAnio[m.anio]) {
        porAnio[m.anio] = { anio: m.anio, ejecutado: 0, planificado: 0, meses: [] };
      }
      porAnio[m.anio].ejecutado += m.ejecutado;
      porAnio[m.anio].planificado += m.planificado;
      porAnio[m.anio].meses.push(m);
    });

    const aniosArr = Object.values(porAnio).sort((a: any, b: any) => a.anio - b.anio);

    return { meses, aniosArr };
  }, [actividades, dataPlanificadoPG004, datosCurvaAvance]);

  const datosCurvaFinal = datosCurvaAvanceCalculados || datosCurvaAvance;

  return (
    <div id="kpi-tab-panel" className="space-y-6">
      {/* Removed Resumen Ejecutivo, KPIs & Tipologías from here as they were moved to the start of the Avance Partidas tab */}

      {/* Curva de Avance */}
      {datosCurvaFinal && (() => {
        const meses = datosCurvaFinal.meses;
        const aniosArr = datosCurvaFinal.aniosArr;
        const maxBarra = Math.max(...meses.map((d: any) => Math.max(d.ejecutado, d.planificado)), 1);
        const maxAcum  = Math.max(...meses.map((d: any) => Math.max(d.acumEjecutado, d.acumPlanificado)), 1);
        const idxCorte = meses.reduce((acc: number, m: any, i: number) => m.ejecutado > 0 ? i : acc, -1);

        return (
          <div className="bg-white rounded-2xl shadow-sm border border-indigo-600 p-6">
            <h3 className="text-lg font-bold text-slate-800 tracking-tight mb-1">Curva de Avance Económico</h3>
            <p className="text-xs text-slate-500 mb-4 font-medium">Mensualización por certificación semanal · Plan total: ${(meses[meses.length-1]?.acumPlanificado / 1e6).toFixed(1)}M · Ejecutado: ${(meses[meses.length-1]?.acumEjecutado / 1e6).toFixed(1)}M</p>

            <div className="flex flex-wrap gap-4 mb-4 text-xs font-semibold">
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-rose-500 rounded-md shadow-sm"/><span>Ejecutado mensual</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-indigo-500 rounded-md shadow-sm"/><span>Planificado mensual</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-1 bg-emerald-500 rounded-full"/><span>Acum. Ejecutado</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-1 bg-indigo-600 rounded-full"/><span>Acum. Planificado</span></div>
              {idxCorte >= 0 && (
                <div className="flex items-center gap-2"><div className="w-0.5 h-3 bg-amber-500"/><span>Fecha de corte</span></div>
              )}
            </div>

            <div className="border border-slate-150 rounded-2xl p-4 bg-slate-50/70 overflow-x-auto shadow-mini">
              <svg width="100%" height="450" viewBox="0 0 1200 450" preserveAspectRatio="xMidYMid meet" className="min-w-[1000px] block mx-auto">
                <line x1="80" y1="380" x2="1150" y2="380" stroke="#cbd5e1" strokeWidth="2" />
                <line x1="80" y1="20" x2="80" y2="380" stroke="#cbd5e1" strokeWidth="2" />
                <line x1="1150" y1="20" x2="1150" y2="380" stroke="#cbd5e1" strokeWidth="2" />
                
                {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
                  const y = 380 - (f * 360);
                  return (
                    <g key={`l${i}`}>
                      <line x1="75" y1={y} x2="80" y2={y} stroke="#94a3b8" strokeWidth="1.5" />
                      <line x1="80" y1={y} x2="1150" y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4,4" />
                      <text x="70" y={y + 4} fontSize="10" fill="#475569" fontWeight="600" textAnchor="end">{(maxBarra * f / 1e6).toFixed(1)}M</text>
                    </g>
                  );
                })}

                {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
                  const y = 380 - (f * 360);
                  return (
                    <g key={`r${i}`}>
                      <line x1="1150" y1={y} x2="1155" y2={y} stroke="#94a3b8" strokeWidth="1.5" />
                      <text x="1160" y={y + 4} fontSize="10" fill="#475569" fontWeight="600">{(maxAcum * f / 1e6).toFixed(1)}M</text>
                    </g>
                  );
                })}

                {idxCorte >= 0 && (() => {
                  const xc = 100 + (idxCorte * (1000 / meses.length)) + (1000 / meses.length / 2);
                  return <line x1={xc} y1="20" x2={xc} y2="380" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4,3" />;
                })()}

                {meses.map((d: any, i: number) => {
                  const x = 100 + (i * (1000 / meses.length));
                  const ancho = (1000 / meses.length) * 0.35;
                  const aE = (d.ejecutado / maxBarra) * 360;
                  const aP = (d.planificado / maxBarra) * 360;
                  const yAE = 380 - ((d.acumEjecutado / maxAcum) * 360);
                  const yAP = 380 - ((d.acumPlanificado / maxAcum) * 360);
                  const xPrev = 100 + ((i - 1) * (1000 / meses.length));
                  const yAEPrev = i > 0 ? 380 - ((meses[i-1].acumEjecutado / maxAcum) * 360) : yAE;
                  const yAPPrev = i > 0 ? 380 - ((meses[i-1].acumPlanificado / maxAcum) * 360) : yAP;
                  return (
                    <g key={i}>
                      <rect x={x - ancho} y={380 - aP} width={ancho} height={aP} fill="#6366f1" opacity="0.9" rx="2" />
                      <rect x={x} y={380 - aE} width={ancho} height={aE} fill="#f43f5e" opacity="0.9" rx="2" />
                      {i > 0 && <line x1={xPrev} y1={yAEPrev} x2={x} y2={yAE} stroke="#10b981" strokeWidth="3" />}
                      <circle cx={x} cy={yAE} r="4.5" fill="#10b981" stroke="white" strokeWidth="1.5" />
                      {i > 0 && <line x1={xPrev} y1={yAPPrev} x2={x} y2={yAP} stroke="#4f46e5" strokeWidth="3" />}
                      <circle cx={x} cy={yAP} r="4.5" fill="#4f46e5" stroke="white" strokeWidth="1.5" />
                      <text x={x} y="405" fontSize="10" fill="#475569" fontWeight="600" textAnchor="middle" transform={`rotate(-45 ${x} 405)`}>{d.mes}</text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Subtotales anuales */}
            <div className="mt-6">
              <h4 className="text-sm font-bold text-slate-800 mb-2.5 flex items-center gap-1.5" id="tabla-distribucion-temporal-montos">
                📋 Distribución Temporal de Montos y Avance por Período
              </h4>
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-3 w-8"></th>
                      <th className="px-3 py-3 text-left font-bold text-slate-550 uppercase tracking-wider">Período</th>
                      <th className="px-3 py-3 text-right font-bold text-slate-550 uppercase tracking-wider">Planificado</th>
                      <th className="px-3 py-3 text-right font-bold text-slate-550 uppercase tracking-wider">Ejecutado</th>
                      <th className="px-3 py-3 text-right font-bold text-slate-550 uppercase tracking-wider">Acum. Plan.</th>
                      <th className="px-3 py-3 text-right font-bold text-slate-550 uppercase tracking-wider">Acum. Ejec.</th>
                      <th className="px-3 py-3 text-right font-bold text-slate-550 uppercase tracking-wider">% Ejec.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {aniosArr.map((grupo: any) => {
                      const isExp = expandedYears.has(grupo.anio);
                      const ultimoMes = grupo.meses[grupo.meses.length - 1];
                      const pctAnio = grupo.planificado > 0 ? ((grupo.ejecutado / grupo.planificado) * 100).toFixed(1) : '0.0';
                      return (
                        <React.Fragment key={grupo.anio}>
                          <tr className="bg-indigo-50/20 font-semibold cursor-pointer border-t border-slate-200" onClick={() => setExpandedYears(p => { const n = new Set(p); if (n.has(grupo.anio)) n.delete(grupo.anio); else n.add(grupo.anio); return n; })}>
                            <td className="px-3 py-3">{isExp ? <ChevronDown className="w-4 h-4 text-indigo-600"/> : <ChevronRight className="w-4 h-4 text-indigo-600"/>}</td>
                            <td className="px-3 py-3 font-bold text-slate-800">📅 {grupo.anio}</td>
                            <td className="px-3 py-3 text-right text-indigo-700 font-bold">${fmt0(grupo.planificado)}</td>
                            <td className="px-3 py-3 text-right text-rose-700 font-bold">${fmt0(grupo.ejecutado)}</td>
                            <td className="px-3 py-3 text-right text-indigo-800 font-bold">${fmt0(ultimoMes.acumPlanificado)}</td>
                            <td className="px-3 py-3 text-right text-emerald-700 font-bold">${fmt0(ultimoMes.acumEjecutado)}</td>
                            <td className="px-3 py-3 text-right text-slate-900 font-bold"><span className="px-2 py-0.5 rounded bg-white border border-slate-200">{pctAnio}%</span></td>
                          </tr>
                          {isExp && grupo.meses.map((m: any, idx: number) => {
                            const pctMes = m.planificado > 0 ? ((m.ejecutado / m.planificado) * 100).toFixed(1) : '0.0';
                            return (
                              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                <td></td>
                                <td className="px-3 py-2 pl-6 text-slate-600 font-medium">{m.mes}</td>
                                <td className="px-3 py-2 text-right text-indigo-600 font-medium">${fmt0(m.planificado)}</td>
                                <td className="px-3 py-2 text-right text-rose-600 font-medium">${fmt0(m.ejecutado)}</td>
                                <td className="px-3 py-2 text-right text-indigo-750 font-medium">${fmt0(m.acumPlanificado)}</td>
                                <td className="px-3 py-2 text-right text-emerald-600 font-medium">${fmt0(m.acumEjecutado)}</td>
                                <td className="px-3 py-2 text-right text-slate-700 font-semibold">{pctMes}%</td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  {/* Total general de la distribución temporal */}
                  {(() => {
                    const totalEjecutado = aniosArr.reduce((acc: number, g: any) => acc + (g.ejecutado || 0), 0);
                    const totalPlanificado = aniosArr.reduce((acc: number, g: any) => acc + (g.planificado || 0), 0);
                    const ultimoGrupo = aniosArr[aniosArr.length - 1];
                    const ultMesUltGrupo = ultimoGrupo?.meses[ultimoGrupo.meses.length - 1];
                    const totalAcumEjec = ultMesUltGrupo?.acumEjecutado || 0;
                    const totalAcumPlan = ultMesUltGrupo?.acumPlanificado || 0;
                    const totalPct = totalPlanificado > 0 ? ((totalEjecutado / totalPlanificado) * 100).toFixed(1) : '0.0';
                    return (
                      <tfoot className="bg-slate-100/90 font-bold border-t-2 border-slate-300">
                        <tr id="total-general-distribucion-row">
                          <td className="px-3 py-3"></td>
                          <td className="px-3 py-3 text-slate-800 font-extrabold uppercase tracking-wide">Total General</td>
                          <td className="px-3 py-3 text-right text-indigo-700 font-extrabold">${fmt0(totalPlanificado)}</td>
                          <td className="px-3 py-3 text-right text-rose-700 font-extrabold">${fmt0(totalEjecutado)}</td>
                          <td className="px-3 py-3 text-right text-indigo-800 font-extrabold">${fmt0(totalAcumPlan)}</td>
                          <td className="px-3 py-3 text-right text-emerald-700 font-extrabold">${fmt0(totalAcumEjec)}</td>
                          <td className="px-3 py-3 text-right text-slate-900 font-extrabold">
                            <span className="px-2.5 py-0.5 rounded bg-indigo-100 border border-indigo-200 text-indigo-800">
                              {totalPct}%
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    );
                  })()}
                </table>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
