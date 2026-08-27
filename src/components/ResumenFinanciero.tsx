/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Download } from 'lucide-react';

interface ResumenFinancieroProps {
  stats: any;
  baseVenta: string;
  setBaseVenta: (v: string) => void;
  periodoSeleccionado: any;
  setPeriodoSeleccionado: (v: any) => void;
  mapaColumnasMes: any;
  exportarAvancePeriodo: () => void;
}

export const ResumenFinanciero: React.FC<ResumenFinancieroProps> = ({
  stats,
  baseVenta,
  setBaseVenta,
  periodoSeleccionado,
  setPeriodoSeleccionado,
  mapaColumnasMes,
  exportarAvancePeriodo,
}) => {
  if (!stats) return null;

  return (
    <div id="resumen-financiero-panel" className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Monto Contratado */}
        <div className="bg-white rounded-2xl shadow-mini hover:shadow-sm transition-all border border-indigo-600">
          <div className="p-3 sm:p-4 xl:p-5">
            <div className="flex items-start justify-between gap-1.5">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 truncate">
                  Monto Contratado <span className="text-[9px] font-normal text-slate-400">(PG-004)</span>
                </div>
                <div className="font-black text-slate-800 mb-1 tracking-tight animate-fade-in" style={{ fontSize: '18px' }} title={`$${stats.totalVenta.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
                  ${stats.totalVenta.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] sm:text-xs text-slate-500 font-medium truncate mb-2">
                  {stats.actividadesPrincipales} partidas principales
                </div>
                {/* Migrated Avance General Progress Bar */}
                <div className="pt-2 border-t border-slate-100 mt-2">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Avance General</span>
                    <span className="text-xs font-black text-emerald-600">{stats.avanceGeneral}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${Math.min(stats.avanceGeneral, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0 border border-indigo-150">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        
        {/* Ejecutado Acumulado */}
        <div className="bg-white rounded-2xl shadow-mini hover:shadow-sm transition-all border border-indigo-600">
          <div className="p-3 sm:p-4 xl:p-5">
            <div className="flex items-start justify-between gap-1.5">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 truncate">Ejecutado Acumulado</div>
                <div className="font-black text-emerald-700 mb-1 tracking-tight animate-fade-in" style={{ fontSize: '18px' }} title={`$${stats.totalVentaEjecutada.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
                  ${stats.totalVentaEjecutada.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">
                  <span className="text-emerald-600 font-semibold">{stats.avanceGeneral}%</span> del contrato
                </div>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0 border border-emerald-150">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        
        {/* Avance del Período con Selector */}
        <div className="bg-white rounded-2xl shadow-mini hover:shadow-sm transition-all border border-indigo-600">
          <div className="p-3 sm:p-4 xl:p-5">
            <div className="flex items-start justify-between gap-1.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">Avance Período</div>
                  <button
                    onClick={() => exportarAvancePeriodo()}
                    className="text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1"
                    title="Exportar detalle del período"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Monto Económico por delante */}
                <div className="font-black text-indigo-700 mb-0.5 tracking-tight animate-fade-in" style={{ fontSize: '18px' }} title={`$${(stats.totalVentaPeriodo || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
                  ${(stats.totalVentaPeriodo || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] sm:text-xs text-slate-500 font-medium mb-3 truncate">
                  {periodoSeleccionado.anio === 'TODOS' ? 'Total acumulado' : `${periodoSeleccionado.mes} ${periodoSeleccionado.anio}`}
                </div>
                
                {/* Dropdown de período abajo */}
                <div className="mt-1">
                  <select 
                    className="text-[10px] sm:text-xs px-1.5 py-1 border border-slate-250 rounded-xl bg-slate-50 text-slate-755 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full font-semibold truncate"
                    value={`${periodoSeleccionado.anio}-${periodoSeleccionado.mes}`}
                    onChange={(e) => {
                      const [anio, mes] = e.target.value.split('-');
                      setPeriodoSeleccionado({ anio, mes, semanas: [] });
                    }}
                  >
                    <option value="TODOS-TODOS">📋 TODOS</option>
                    {(() => {
                      const ordenMes: any = {Enero:1,Febrero:2,Marzo:3,Abril:4,Mayo:5,Junio:6,Julio:7,Agosto:8,Septiembre:9,Octubre:10,Noviembre:11,Diciembre:12};
                      const setClaves = new Set<string>(Object.keys(mapaColumnasMes || {}));
                      // Garantizar meses estándar de 2026 incluyendo Julio 2026
                      ['2026-Enero', '2026-Febrero', '2026-Marzo', '2026-Abril', '2026-Mayo', '2026-Junio', '2026-Julio'].forEach(k => setClaves.add(k));
                      if (periodoSeleccionado?.anio && periodoSeleccionado?.mes && periodoSeleccionado.anio !== 'TODOS') {
                        setClaves.add(`${periodoSeleccionado.anio}-${periodoSeleccionado.mes}`);
                      }

                      const porAnio: Record<string, any[]> = {};
                      Array.from(setClaves).forEach(k => {
                        const [a, m] = k.split('-');
                        if (a && m) {
                          if (!porAnio[a]) porAnio[a] = [];
                          porAnio[a].push({ key: k, mes: m });
                        }
                      });
                      const aniosOrdenados = Object.keys(porAnio).sort((a, b) => parseInt(b) - parseInt(a));
                      return aniosOrdenados.map(anio => {
                        const meses = porAnio[anio].sort((a, b) => (ordenMes[b.mes] || 0) - (ordenMes[a.mes] || 0));
                        return (
                          <optgroup key={anio} label={anio}>
                            {meses.map(it => (
                              <option key={it.key} value={it.key}>{it.mes} {anio}</option>
                            ))}
                          </optgroup>
                        );
                      });
                    })()}
                  </select>
                </div>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0 border border-indigo-150">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        
        {/* Saldo por Ejecutar */}
        <div className="bg-white rounded-2xl shadow-mini hover:shadow-sm transition-all border border-indigo-600">
          <div className="p-3 sm:p-4 xl:p-5">
            <div className="flex items-start justify-between gap-1.5">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 truncate">Saldo por Ejecutar</div>
                <div className="font-black text-amber-700 mb-1 tracking-tight animate-fade-in" style={{ fontSize: '18px' }} title={`$${stats.totalSaldo.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
                  ${stats.totalSaldo.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">
                  Pendiente de ejecutar
                </div>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0 border border-amber-150">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Excedentes Card */}
        <div className="bg-white rounded-2xl shadow-mini hover:shadow-sm transition-all border border-indigo-600">
          <div className="p-3 sm:p-4 xl:p-5">
            <div className="flex items-start justify-between gap-1.5">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 truncate">Excedentes</div>
                <div className={`font-black mb-1 tracking-tight animate-fade-in ${stats.totalExcedentes >= 0 ? 'text-rose-600' : 'text-indigo-650'}`} style={{ fontSize: '18px' }} title={`$${stats.totalExcedentes.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
                  ${stats.totalExcedentes.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">
                  {stats.totalExcedentes >= 0 ? 'Sobreejecución' : 'Ahorro'}
                </div>
              </div>
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${stats.totalExcedentes >= 0 ? 'bg-rose-50 border-rose-150' : 'bg-indigo-50 border-indigo-150'}`}>
                <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${stats.totalExcedentes >= 0 ? 'text-rose-600' : 'text-indigo-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {stats.totalExcedentes >= 0 ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  )}
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
