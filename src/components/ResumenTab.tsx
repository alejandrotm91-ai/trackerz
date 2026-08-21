/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Briefcase, FileSpreadsheet, Percent, Coins, Layers, CircleDollarSign, TrendingUp, Calendar, Clock, TrendingDown, Download } from 'lucide-react';
import { ResumenFinanciero } from './ResumenFinanciero';
import { TipologiaResumen } from './TipologiaResumen';
import { ctFmt, ctFmtM } from '../utils/helpers';

interface ResumenTabProps {
  // Avance de Obra
  stats: any;
  baseVenta: string;
  setBaseVenta: (v: string) => void;
  periodoSeleccionado: any;
  setPeriodoSeleccionado: (v: any) => void;
  mapaColumnasMes: any;
  exportarAvancePeriodo: () => void;
  tipologiaSeleccionada: string | null;
  setTipologiaSeleccionada: (v: string | null) => void;

  // Certificación
  planillaInfo: any;
  planillaTotales: any;
  planillaEnmiendas: any[];
  planillaTipRes: any[];
  planillaHojas: any[];
}

export const ResumenTab: React.FC<ResumenTabProps> = ({
  stats,
  baseVenta,
  setBaseVenta,
  periodoSeleccionado,
  setPeriodoSeleccionado,
  mapaColumnasMes,
  exportarAvancePeriodo,
  tipologiaSeleccionada,
  setTipologiaSeleccionada,

  planillaInfo,
  planillaTotales,
  planillaEnmiendas,
  planillaTipRes,
  planillaHojas,
}) => {
  // Local state for expanded enmiendas in the Resumen copy of the table
  const [localEnmExpanded, setLocalEnmExpanded] = useState<Set<number>>(new Set());

  const handleToggleLocalEnm = (idx: number) => {
    setLocalEnmExpanded(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  // Compute Certificación Totales safely
  const filteredEnmsForTotal = (planillaEnmiendas && planillaEnmiendas.length > 0)
    ? planillaEnmiendas.filter(e => !e.isGranTotal && e.subtotal)
    : [];
  const totalEnmSaldoVal = filteredEnmsForTotal.length > 0
    ? filteredEnmsForTotal.reduce((acc, e) => acc + (e.subtotal.saldo || 0), 0)
    : (planillaHojas ? planillaHojas.reduce((s, h) => s + (h.saldo || 0), 0) : 0);

  const T = {
    contrato: planillaHojas ? planillaHojas.reduce((s, h) => s + (h.contrato || 0), 0) : 0,
    acum:     planillaHojas ? planillaHojas.reduce((s, h) => s + (h.acum || 0), 0) : 0,
    saldo:    totalEnmSaldoVal,
    anterior: planillaHojas ? planillaHojas.reduce((s, h) => s + (h.anterior || 0), 0) : 0,
    cert:     planillaHojas ? planillaHojas.reduce((s, h) => s + (h.cert || 0), 0) : 0,
    exc:      planillaHojas ? planillaHojas.reduce((s, h) => s + (h.exc || 0), 0) : 0,
  };
  const avanceCertPct = T.contrato > 0 ? ((T.acum / T.contrato) * 100).toFixed(1) : '0';

  return (
    <div id="resumen-tab-content" className="space-y-8 animate-fade-in">
      
      {/* 1. SECCIÓN: AVANCE DE OBRA */}
      <div id="avance-obra-container" className="bg-white rounded-3xl border border-indigo-600 shadow-md p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-indigo-50 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-550/10 rounded-xl flex items-center justify-center text-indigo-700">
              <Layers className="w-5 h-5 font-black text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Avance de Obra</h2>
              <p className="text-xs text-slate-400 font-medium">Control físico y avance financiero general por partidas</p>
            </div>
          </div>
          
          <div className="inline-flex rounded-xl shadow-mini bg-slate-100 p-1 shrink-0 self-start sm:self-auto" role="group">
            <button
              type="button"
              id="btn-header-base-reformulada"
              onClick={() => setBaseVenta('reformulada')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                baseVenta === 'reformulada'
                  ? 'bg-indigo-600 text-white shadow-mini'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              PG-004
            </button>
            <button
              type="button"
              id="btn-header-base-contrato"
              onClick={() => setBaseVenta('contrato')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                baseVenta === 'contrato'
                  ? 'bg-indigo-600 text-white shadow-mini'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              PG-003
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <ResumenFinanciero
            stats={stats}
            baseVenta={baseVenta}
            setBaseVenta={setBaseVenta}
            periodoSeleccionado={periodoSeleccionado}
            setPeriodoSeleccionado={setPeriodoSeleccionado}
            mapaColumnasMes={mapaColumnasMes}
            exportarAvancePeriodo={exportarAvancePeriodo}
          />

          <TipologiaResumen
            stats={stats}
            tipologiaSeleccionada={tipologiaSeleccionada}
            setTipologiaSeleccionada={setTipologiaSeleccionada}
          />
        </div>
      </div>

      {/* 2. SECCIÓN: CERTIFICACIÓN */}
      <div id="certificacion-container" className="bg-white rounded-3xl border border-indigo-600 shadow-md p-6 space-y-6">
        <div className="flex items-center gap-3 border-b border-indigo-50 pb-4">
          <div className="w-10 h-10 bg-indigo-550/10 rounded-xl flex items-center justify-center text-indigo-700">
            <FileSpreadsheet className="w-5 h-5 font-black text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Certificación</h2>
            <p className="text-xs text-slate-400 font-medium font-sans">Valuaciones semanales, enmiendas y planilla contractual consolidada</p>
          </div>
        </div>

        {planillaInfo ? (
          <div className="space-y-6">
            
            {/* KPIs Grid */}
            <div id="certificacion-kpi-grid" className="w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                          {/* 1. MONTO CONTRATADO */}
                <div className="border border-indigo-200/70 rounded-[14px] p-3 bg-white shadow-mini flex flex-col justify-between min-h-[82px]">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                      Monto Contratado
                    </span>
                    <div className="p-1.5 bg-indigo-50/50 border border-indigo-100/80 text-indigo-650 rounded-[10px] flex-shrink-0">
                      <CircleDollarSign className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="mt-1.5">
                    <div className="text-[16px] md:text-[18px] font-extrabold text-slate-900 tracking-tight leading-tight">
                      ${ctFmt(T.contrato)}
                    </div>
                  </div>
                </div>

                {/* 2. EJECUTADO ACUMULADO */}
                <div className="border border-indigo-200/70 rounded-[14px] p-3 bg-white shadow-mini flex flex-col justify-between min-h-[82px]">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                      Ejecutado Acumulado
                    </span>
                    <div className="p-1.5 bg-emerald-50/50 border border-emerald-100/80 text-emerald-600 rounded-[10px] flex-shrink-0">
                      <TrendingUp className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="mt-1.5">
                    <div className="text-[16px] md:text-[18px] font-extrabold text-emerald-700 tracking-tight leading-tight">
                      ${ctFmt(T.acum)}
                    </div>
                  </div>
                </div>

                {/* 3. AVANCE PERÍODO */}
                <div className="border border-indigo-200/70 rounded-[14px] p-3 bg-white shadow-mini flex flex-col justify-between min-h-[82px]">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-wider leading-none flex items-center gap-1.5">
                      Avance Período
                    </span>
                    <div className="p-1.5 bg-violet-50/50 border border-violet-100/80 text-violet-650 rounded-[10px] flex-shrink-0">
                      <Calendar className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="mt-1.5">
                    <div className="text-[16px] md:text-[18px] font-extrabold text-indigo-700 tracking-tight leading-tight">
                      ${ctFmt(T.cert)}
                    </div>
                  </div>
                </div>

                {/* 4. SALDO POR EJECUTAR */}
                <div className="border border-indigo-200/70 rounded-[14px] p-3 bg-white shadow-mini flex flex-col justify-between min-h-[82px]">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                      Saldo Por Ejecutar
                    </span>
                    <div className="p-1.5 bg-amber-50/50 border border-amber-100/80 text-amber-600 rounded-[10px] flex-shrink-0">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="mt-1.5">
                    <div className="text-[16px] md:text-[18px] font-extrabold text-amber-700 tracking-tight leading-tight">
                      ${ctFmt(T.saldo)}
                    </div>
                  </div>
                </div>

                {/* 5. EXCEDENTES */}
                <div className="border border-indigo-200/70 rounded-[14px] p-3 bg-white shadow-mini flex flex-col justify-between min-h-[82px]">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                      Excedentes
                    </span>
                    <div className="p-1.5 bg-rose-50/50 border border-rose-100/80 text-rose-500 rounded-[10px] flex-shrink-0">
                      <TrendingDown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="mt-1.5">
                    <div className="text-[16px] md:text-[18px] font-extrabold text-rose-650 tracking-tight leading-tight">
                      ${ctFmt(T.exc)}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Resumen Contrato + Enmiendas */}
            {planillaEnmiendas && planillaEnmiendas.length > 0 && (
              <div id="cert-enmiendas-box" className="p-4 bg-white border border-slate-100 rounded-2xl shadow-mini">
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-3">Resumen Contrato + Enmiendas</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 font-bold text-slate-500 border-b border-slate-100 text-left">
                        <th className="w-8"></th>
                        <th className="px-3 py-2 text-left">Enmienda</th>
                        <th className="px-3 py-2 text-right">Contrato Acum.</th>
                        <th className="px-3 py-2 text-right">Incremento</th>
                        <th className="px-3 py-2 text-right">Monto</th>
                        <th className="px-3 py-2 text-right">Planillado</th>
                        <th className="px-3 py-2 text-right">% Ejec.</th>
                        <th className="px-3 py-2 text-right">Saldo</th>
                        <th className="px-3 py-2 text-right">Excedentes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const filteredEnms = planillaEnmiendas.filter(e => !e.isGranTotal && e.subtotal);
                        const totalEnmIncremento = filteredEnms.reduce((acc, e) => acc + (e.subtotal.incremento || 0), 0);
                        const totalEnmMonto = filteredEnms.reduce((acc, e) => acc + (e.subtotal.monto || 0), 0);
                        const totalEnmPlanillado = filteredEnms.reduce((acc, e) => acc + (e.subtotal.planillado || 0), 0);
                        const totalEnmSaldo = filteredEnms.reduce((acc, e) => acc + (e.subtotal.saldo || 0), 0);
                        const totalEnmExcedentes = filteredEnms.reduce((acc, e) => acc + (e.subtotal.excedentes || 0), 0);
                        const totalEnmPctEjec = totalEnmMonto > 0 ? (totalEnmPlanillado / totalEnmMonto * 100).toFixed(1) : '—';
                        
                        const lastEnm = filteredEnms[filteredEnms.length - 1];
                        const totalContratoAcum = lastEnm ? lastEnm.subtotal.contratoAcum : 0;

                        return (
                          <React.Fragment>
                            {filteredEnms.map((enm, ei) => {
                              const s = enm.subtotal;
                              const ej = s.monto > 0 ? (s.planillado / s.monto * 100).toFixed(1) : '—';
                              const isExp = localEnmExpanded.has(ei);
                              const lbl = enm.label === 'Contrato Original' ? 'C.O' : enm.label;
                              return (
                                <React.Fragment key={ei}>
                                  <tr className={`border-t border-slate-100 cursor-pointer hover:bg-blue-50/50 ${isExp ? 'bg-blue-50/40 font-medium' : ''}`} onClick={() => handleToggleLocalEnm(ei)}>
                                    <td className="px-3 py-2 text-gray-450">{isExp ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</td>
                                    <td className="px-3 py-2 font-bold text-blue-800">{lbl}</td>
                                    <td className="px-3 py-2 text-right text-gray-400">{s.contratoAcum > 0 ? '$' + ctFmt(s.contratoAcum) : '—'}</td>
                                    <td className="px-3 py-2 text-right text-indigo-600">{s.incremento > 0 ? '$' + ctFmt(s.incremento) : '—'}</td>
                                    <td className="px-3 py-2 text-right font-medium text-slate-800">${ctFmt(s.monto)}</td>
                                    <td className="px-3 py-2 text-right text-green-700 font-semibold">${ctFmt(s.planillado)}</td>
                                    <td className="px-3 py-2 text-right font-bold text-slate-700">{ej}%</td>
                                    <td className={`px-3 py-2 text-right font-semibold ${s.saldo >= 0 ? 'text-orange-600' : 'text-red-600'}`}>{s.saldo !== 0 ? (s.saldo < 0 ? '($' + ctFmt(Math.abs(s.saldo)) + ')' : '$' + ctFmt(s.saldo)) : '—'}</td>
                                    <td className="px-3 py-2 text-right text-red-500">{s.excedentes > 0 ? '$' + ctFmt(s.excedentes) : '—'}</td>
                                  </tr>
                                  {isExp && enm.filas.map((f: any, fi: number) => {
                                    const fej = f.monto > 0 ? (f.planillado / f.monto * 100).toFixed(1) : '—';
                                    return (
                                      <tr key={`f-${ei}-${fi}`} className="bg-slate-50/40 text-slate-500 border-t border-slate-100 hover:bg-slate-100/50 transition-colors">
                                        <td className="px-3 py-1.5 text-gray-300"></td>
                                        <td className="px-3 py-1.5 pl-6 font-semibold text-slate-600">{f.tipo}</td>
                                        <td className="px-3 py-1.5 text-right text-slate-400">{f.contratoAcum > 0 ? '$' + ctFmt(f.contratoAcum) : '—'}</td>
                                        <td className="px-3 py-1.5 text-right text-indigo-500">{f.incremento > 0 ? '$' + ctFmt(f.incremento) : '—'}</td>
                                        <td className="px-3 py-1.5 text-right text-slate-705 font-medium">${ctFmt(f.monto)}</td>
                                        <td className="px-3 py-1.5 text-right text-green-600 font-medium">${ctFmt(f.planillado)}</td>
                                        <td className="px-3 py-1.5 text-right font-semibold">{fej}%</td>
                                        <td className={`px-3 py-1.5 text-right ${f.saldo >= 0 ? 'text-orange-550' : 'text-red-500'}`}>{f.saldo !== 0 ? (f.saldo < 0 ? '($' + ctFmt(Math.abs(f.saldo)) + ')' : '$' + ctFmt(f.saldo)) : '—'}</td>
                                        <td className="px-3 py-1.5 text-right text-red-400">{f.excedentes > 0 ? '$' + ctFmt(f.excedentes) : '—'}</td>
                                      </tr>
                                    );
                                  })}
                                </React.Fragment>
                              );
                            })}
                            
                            {/* Total Row */}
                            <tr className="bg-slate-100/90 border-t-2 border-slate-350 font-bold text-slate-900">
                              <td className="px-3 py-2.5"></td>
                              <td className="px-3 py-2.5 font-extrabold text-slate-800">Total</td>
                              <td className="px-3 py-2.5 text-right text-slate-600 font-bold">${ctFmt(totalContratoAcum)}</td>
                              <td className="px-3 py-2.5 text-right text-indigo-700 font-bold">{totalEnmIncremento > 0 ? '$' + ctFmt(totalEnmIncremento) : '—'}</td>
                              <td className="px-3 py-2.5 text-right font-black text-slate-900">${ctFmt(totalEnmMonto)}</td>
                              <td className="px-3 py-2.5 text-right text-green-700 font-black">${ctFmt(totalEnmPlanillado)}</td>
                              <td className="px-3 py-2.5 text-right font-black text-slate-900">{totalEnmPctEjec}%</td>
                              <td className={`px-3 py-2.5 text-right font-black ${totalEnmSaldo >= 0 ? 'text-orange-750' : 'text-red-700'}`}>{totalEnmSaldo !== 0 ? (totalEnmSaldo < 0 ? '($' + ctFmt(Math.abs(totalEnmSaldo)) + ')' : '$' + ctFmt(totalEnmSaldo)) : '—'}</td>
                              <td className="px-3 py-2.5 text-right text-red-650 font-black">{totalEnmExcedentes > 0 ? '$' + ctFmt(totalEnmExcedentes) : '—'}</td>
                            </tr>
                          </React.Fragment>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Resumen por Tipología de Contrato */}
            {planillaTipRes && planillaTipRes.length > 0 && (() => {
              const totalTipoloMonto = planillaTipRes.find(t => t.tipo === 'Total')?.monto || 0;
              return (
                <div id="cert-tipologia-box" className="p-4 bg-white border border-slate-100 rounded-2xl shadow-mini">
                  <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-3">Resumen por Tipología de Contrato</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-left font-bold text-slate-500">
                          <th className="px-4 py-2 text-left">Tipo</th>
                          <th className="px-4 py-2 text-right">Monto Contrato</th>
                          <th className="px-4 py-2 text-right">% del Total</th>
                          <th className="px-4 py-2 text-right">Planillado</th>
                          <th className="px-4 py-2 text-right">% Avance</th>
                          <th className="px-4 py-2 text-right">Saldo</th>
                          <th className="px-4 py-2 text-right">Excedentes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {planillaTipRes.map((t, i) => {
                          const isTot = t.tipo === 'Total';
                          return (
                            <tr key={i} className={`border-t border-slate-100 ${isTot ? 'bg-blue-50/70 font-bold text-slate-900 border-t-2 border-slate-200' : 'hover:bg-slate-50/50'}`}>
                              <td className="px-4 py-2.5 font-medium">{t.label || t.tipo}</td>
                              <td className="px-4 py-2.5 text-right font-semibold">${ctFmt(t.monto)}</td>
                              <td className="px-4 py-2.5 text-right text-slate-400">
                                {isTot ? '100.0%' : (totalTipoloMonto > 0 ? (t.monto / totalTipoloMonto * 100).toFixed(1) + '%' : '0.0%')}
                              </td>
                              <td className="px-4 py-2.5 text-right text-green-700">${ctFmt(t.planillado)}</td>
                              <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{isTot ? avanceCertPct : (t.monto > 0 ? (t.planillado / t.monto * 100).toFixed(1) : '0')}%</td>
                              <td className={`px-4 py-2.5 text-right font-semibold ${t.saldo >= 0 ? 'text-orange-600' : 'text-red-650'}`}>
                                {t.saldo !== 0 ? (t.saldo < 0 ? '($' + ctFmt(Math.abs(t.saldo)) + ')' : '$' + ctFmt(t.saldo)) : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-right text-red-600">${ctFmt(t.excedentes)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

          </div>
        ) : (
          <div id="cert-no-data" className="text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-sm font-medium">
            <Coins className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            La planilla de certificación no está disponible en el archivo cargado actualmente.
          </div>
        )}
      </div>

    </div>
  );
};
