/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FileSpreadsheet,
  CircleDollarSign,
  TrendingUp,
  Calendar,
  Clock,
  TrendingDown,
  ChevronDown,
  ChevronRight,
  Coins,
} from 'lucide-react';
import { ctFmt } from '../utils/helpers';

export interface CertificacionCardProps {
  planillaInfo?: any;
  planillaTotales?: any;
  planillaEnmiendas?: any[];
  planillaTipRes?: any[];
  planillaHojas?: any[];
  idPrefix?: string;
  showHeader?: boolean;
  showKpis?: boolean;
  showEnmiendas?: boolean;
  tipologiaTitle?: string;
}

export const CertificacionCard: React.FC<CertificacionCardProps> = ({
  planillaInfo,
  planillaTotales,
  planillaEnmiendas,
  planillaTipRes,
  planillaHojas,
  idPrefix = 'certificacion',
  showHeader = true,
  showKpis = true,
  showEnmiendas = true,
  tipologiaTitle = 'Certificación',
}) => {
  // Local state for expanded enmiendas in the table
  const [localEnmExpanded, setLocalEnmExpanded] = useState<Set<number>>(new Set());

  const handleToggleLocalEnm = (idx: number) => {
    setLocalEnmExpanded((prev) => {
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
  const filteredEnmsForTotal =
    planillaEnmiendas && planillaEnmiendas.length > 0
      ? planillaEnmiendas.filter((e) => !e.isGranTotal && e.subtotal)
      : [];
  const totalEnmSaldoVal =
    filteredEnmsForTotal.length > 0
      ? filteredEnmsForTotal.reduce((acc, e) => acc + (e.subtotal.saldo || 0), 0)
      : planillaHojas
      ? planillaHojas.reduce((s, h) => s + (h.saldo || 0), 0)
      : 0;

  const T = {
    contrato: planillaHojas ? planillaHojas.reduce((s, h) => s + (h.contrato || 0), 0) : 0,
    acum: planillaHojas ? planillaHojas.reduce((s, h) => s + (h.acum || 0), 0) : 0,
    saldo: totalEnmSaldoVal,
    anterior: planillaHojas ? planillaHojas.reduce((s, h) => s + (h.anterior || 0), 0) : 0,
    cert: planillaHojas ? planillaHojas.reduce((s, h) => s + (h.cert || 0), 0) : 0,
    exc: planillaHojas ? planillaHojas.reduce((s, h) => s + (h.exc || 0), 0) : 0,
  };
  const avanceCertPct = T.contrato > 0 ? ((T.acum / T.contrato) * 100).toFixed(1) : '0';

  return (
    <div
      id={`${idPrefix}-container`}
      className="bg-white rounded-xl border border-[#D5DEE2] shadow-xs p-3 sm:p-4 space-y-4"
    >
      {showHeader && (
        <div className="flex items-center gap-3 border-b border-[#D5DEE2] pb-3">
          <div className="w-9 h-9 bg-[#EEECFB] rounded-lg flex items-center justify-center text-[#442dd7]">
            <FileSpreadsheet className="w-4.5 h-4.5 text-[#442dd7]" />
          </div>
          <div>
            <h2 className="text-base font-['Barlow_Condensed'] font-semibold text-[#14212A] tracking-wide uppercase">Certificación</h2>
            <p className="text-[11px] text-[#5A6A74] font-medium font-sans">
              Valuaciones semanales, enmiendas y planilla contractual consolidada
            </p>
          </div>
        </div>
      )}

      {planillaInfo ? (
        <div className="space-y-4">
          {/* KPIs Grid */}
          {showKpis && (
            <div id={`${idPrefix}-kpi-grid`} className="w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                {/* 1. MONTO CONTRATADO */}
                <div className="border border-[#D5DEE2] rounded-xl p-2.5 bg-white shadow-xs flex flex-col justify-between min-h-[76px]">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-bold text-[#5A6A74] uppercase tracking-wider leading-none">
                      Monto Contratado
                    </span>
                    <div className="p-1.5 bg-[#EEECFB] text-[#442dd7] rounded-lg flex-shrink-0">
                      <CircleDollarSign className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="mt-1.5">
                    <div className="text-2xl font-['Barlow_Condensed'] font-semibold text-[#14212A] tracking-tight leading-tight">
                      {ctFmt(T.contrato)}
                    </div>
                  </div>
                </div>

                {/* 2. EJECUTADO ACUMULADO */}
                <div className="border border-[#D5DEE2] rounded-xl p-2.5 bg-white shadow-xs flex flex-col justify-between min-h-[76px]">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-bold text-[#5A6A74] uppercase tracking-wider leading-none">
                      Ejecutado Acumulado
                    </span>
                    <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg flex-shrink-0">
                      <TrendingUp className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="mt-1.5">
                    <div className="text-2xl font-['Barlow_Condensed'] font-semibold text-[#2B7F52] tracking-tight leading-tight">
                      {ctFmt(T.acum)}
                    </div>
                  </div>
                </div>

                {/* 3. AVANCE PERÍODO */}
                <div className="border border-[#D5DEE2] rounded-xl p-2.5 bg-white shadow-xs flex flex-col justify-between min-h-[76px]">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-bold text-[#5A6A74] uppercase tracking-wider leading-none flex items-center gap-1.5">
                      Avance Período
                    </span>
                    <div className="p-1.5 bg-[#EEECFB] text-[#442dd7] rounded-lg flex-shrink-0">
                      <Calendar className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="mt-1.5">
                    <div className="text-2xl font-['Barlow_Condensed'] font-semibold text-[#442dd7] tracking-tight leading-tight">
                      {ctFmt(T.cert)}
                    </div>
                  </div>
                </div>

                {/* 4. SALDO POR EJECUTAR */}
                <div className="border border-[#D5DEE2] rounded-xl p-2.5 bg-white shadow-xs flex flex-col justify-between min-h-[76px]">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-bold text-[#5A6A74] uppercase tracking-wider leading-none">
                      Saldo Por Ejecutar
                    </span>
                    <div className="p-1.5 bg-amber-50 text-amber-700 rounded-lg flex-shrink-0">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="mt-1.5">
                    <div className="text-2xl font-['Barlow_Condensed'] font-semibold text-[#A86B12] tracking-tight leading-tight">
                      {ctFmt(T.saldo)}
                    </div>
                  </div>
                </div>

                {/* 5. EXCEDENTES */}
                <div className="border border-[#D5DEE2] rounded-xl p-2.5 bg-white shadow-xs flex flex-col justify-between min-h-[76px]">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-bold text-[#5A6A74] uppercase tracking-wider leading-none">
                      Excedentes
                    </span>
                    <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg flex-shrink-0">
                      <TrendingDown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="mt-1.5">
                    <div className="text-2xl font-['Barlow_Condensed'] font-semibold text-[#B83227] tracking-tight leading-tight">
                      {ctFmt(T.exc)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Resumen Contrato + Enmiendas */}
          {showEnmiendas && planillaEnmiendas && planillaEnmiendas.length > 0 && (
            <div
              id={`${idPrefix}-enmiendas-box`}
              className="p-2.5 sm:p-3 bg-white border border-slate-100 rounded-2xl shadow-mini"
            >
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-2">
                Resumen Contrato + Enmiendas
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[10.5px] sm:text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 font-bold text-slate-500 border-b border-slate-100 text-left">
                      <th className="w-5 py-1.5 px-0.5"></th>
                      <th className="px-1.5 py-1.5 text-left">Enmienda</th>
                      <th className="px-1.5 py-1.5 text-right">Contrato Acum.</th>
                      <th className="px-1.5 py-1.5 text-right">Incremento</th>
                      <th className="px-1.5 py-1.5 text-right">Monto</th>
                      <th className="px-1.5 py-1.5 text-right">Planillado</th>
                      <th className="px-1.5 py-1.5 text-right">% Ejec.</th>
                      <th className="px-1.5 py-1.5 text-right">Saldo</th>
                      <th className="px-1.5 py-1.5 text-right">Excedentes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filteredEnms = planillaEnmiendas.filter(
                        (e) => !e.isGranTotal && e.subtotal
                      );
                      const totalEnmIncremento = filteredEnms.reduce(
                        (acc, e) => acc + (e.subtotal.incremento || 0),
                        0
                      );
                      const totalEnmMonto = filteredEnms.reduce(
                        (acc, e) => acc + (e.subtotal.monto || 0),
                        0
                      );
                      const totalEnmPlanillado = filteredEnms.reduce(
                        (acc, e) => acc + (e.subtotal.planillado || 0),
                        0
                      );
                      const totalEnmSaldo = filteredEnms.reduce(
                        (acc, e) => acc + (e.subtotal.saldo || 0),
                        0
                      );
                      const totalEnmExcedentes = filteredEnms.reduce(
                        (acc, e) => acc + (e.subtotal.excedentes || 0),
                        0
                      );
                      const totalEnmPctEjec =
                        totalEnmMonto > 0
                          ? ((totalEnmPlanillado / totalEnmMonto) * 100).toFixed(1)
                          : '—';

                      const lastEnm = filteredEnms[filteredEnms.length - 1];
                      const totalContratoAcum = lastEnm ? lastEnm.subtotal.contratoAcum : 0;

                      return (
                        <React.Fragment>
                          {filteredEnms.map((enm, ei) => {
                            const s = enm.subtotal;
                            const ej =
                              s.monto > 0 ? ((s.planillado / s.monto) * 100).toFixed(1) : '—';
                            const isExp = localEnmExpanded.has(ei);
                            const lbl = enm.label === 'Contrato Original' ? 'C.O' : enm.label;
                            return (
                              <React.Fragment key={ei}>
                                <tr
                                  className={`border-t border-slate-100 cursor-pointer hover:bg-blue-50/50 ${
                                    isExp ? 'bg-blue-50/40 font-medium' : ''
                                  }`}
                                  onClick={() => handleToggleLocalEnm(ei)}
                                >
                                  <td className="px-0.5 py-1 text-gray-450">
                                    {isExp ? (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    )}
                                  </td>
                                  <td className="px-1.5 py-1 font-bold text-blue-800 whitespace-nowrap">{lbl}</td>
                                  <td className="px-1.5 py-1 text-right text-gray-400 whitespace-nowrap font-mono">
                                    {s.contratoAcum > 0 ? ctFmt(s.contratoAcum) : '—'}
                                  </td>
                                  <td className="px-1.5 py-1 text-right text-indigo-600 whitespace-nowrap font-mono">
                                    {s.incremento > 0 ? ctFmt(s.incremento) : '—'}
                                  </td>
                                  <td className="px-1.5 py-1 text-right font-medium text-slate-800 whitespace-nowrap font-mono">
                                    {ctFmt(s.monto)}
                                  </td>
                                  <td className="px-1.5 py-1 text-right text-green-700 font-semibold whitespace-nowrap font-mono">
                                    {ctFmt(s.planillado)}
                                  </td>
                                  <td className="px-1.5 py-1 text-right font-bold text-slate-700 whitespace-nowrap">
                                    {ej}%
                                  </td>
                                  <td
                                    className={`px-1.5 py-1 text-right font-semibold whitespace-nowrap font-mono ${
                                      s.saldo >= 0 ? 'text-orange-600' : 'text-red-600'
                                    }`}
                                  >
                                    {s.saldo !== 0
                                      ? s.saldo < 0
                                        ? '(' + ctFmt(Math.abs(s.saldo)) + ')'
                                        : ctFmt(s.saldo)
                                      : '—'}
                                  </td>
                                  <td className="px-1.5 py-1 text-right text-red-500 whitespace-nowrap font-mono">
                                    {s.excedentes > 0 ? ctFmt(s.excedentes) : '—'}
                                  </td>
                                </tr>
                                {isExp &&
                                  enm.filas.map((f: any, fi: number) => {
                                    const fej =
                                      f.monto > 0
                                        ? ((f.planillado / f.monto) * 100).toFixed(1)
                                        : '—';
                                    return (
                                      <tr
                                        key={`f-${ei}-${fi}`}
                                        className="bg-slate-50/40 text-slate-500 border-t border-slate-100 hover:bg-slate-100/50 transition-colors"
                                      >
                                        <td className="px-0.5 py-1 text-gray-300"></td>
                                        <td className="px-1.5 py-1 pl-3 font-semibold text-slate-600">
                                          {f.tipo}
                                        </td>
                                        <td className="px-1.5 py-1 text-right text-slate-400 font-mono whitespace-nowrap">
                                          {f.contratoAcum > 0 ? ctFmt(f.contratoAcum) : '—'}
                                        </td>
                                        <td className="px-1.5 py-1 text-right text-indigo-500 font-mono whitespace-nowrap">
                                          {f.incremento > 0 ? ctFmt(f.incremento) : '—'}
                                        </td>
                                        <td className="px-1.5 py-1 text-right text-slate-705 font-medium font-mono whitespace-nowrap">
                                          {ctFmt(f.monto)}
                                        </td>
                                        <td className="px-1.5 py-1 text-right text-green-600 font-medium font-mono whitespace-nowrap">
                                          {ctFmt(f.planillado)}
                                        </td>
                                        <td className="px-1.5 py-1 text-right font-semibold whitespace-nowrap">
                                          {fej}%
                                        </td>
                                        <td
                                          className={`px-1.5 py-1 text-right font-mono whitespace-nowrap ${
                                            f.saldo >= 0 ? 'text-orange-550' : 'text-red-500'
                                          }`}
                                        >
                                          {f.saldo !== 0
                                            ? f.saldo < 0
                                              ? '(' + ctFmt(Math.abs(f.saldo)) + ')'
                                              : ctFmt(f.saldo)
                                            : '—'}
                                        </td>
                                        <td className="px-1.5 py-1 text-right text-red-400 font-mono whitespace-nowrap">
                                          {f.excedentes > 0 ? ctFmt(f.excedentes) : '—'}
                                        </td>
                                      </tr>
                                    );
                                  })}
                              </React.Fragment>
                            );
                          })}

                          {/* Total Row */}
                          <tr className="bg-slate-100/90 border-t-2 border-slate-350 font-bold text-slate-900">
                            <td className="px-0.5 py-1.5"></td>
                            <td className="px-1.5 py-1.5 font-extrabold text-slate-800">Total</td>
                            <td className="px-1.5 py-1.5 text-right text-slate-600 font-bold font-mono whitespace-nowrap">
                              {ctFmt(totalContratoAcum)}
                            </td>
                            <td className="px-1.5 py-1.5 text-right text-indigo-700 font-bold font-mono whitespace-nowrap">
                              {totalEnmIncremento > 0 ? ctFmt(totalEnmIncremento) : '—'}
                            </td>
                            <td className="px-1.5 py-1.5 text-right font-black text-slate-900 font-mono whitespace-nowrap">
                              {ctFmt(totalEnmMonto)}
                            </td>
                            <td className="px-1.5 py-1.5 text-right text-green-700 font-black font-mono whitespace-nowrap">
                              {ctFmt(totalEnmPlanillado)}
                            </td>
                            <td className="px-1.5 py-1.5 text-right font-black text-slate-900 whitespace-nowrap">
                              {totalEnmPctEjec}%
                            </td>
                            <td
                              className={`px-1.5 py-1.5 text-right font-black font-mono whitespace-nowrap ${
                                totalEnmSaldo >= 0 ? 'text-orange-750' : 'text-red-700'
                              }`}
                            >
                              {totalEnmSaldo !== 0
                                ? totalEnmSaldo < 0
                                  ? '(' + ctFmt(Math.abs(totalEnmSaldo)) + ')'
                                  : ctFmt(totalEnmSaldo)
                                : '—'}
                            </td>
                            <td className="px-1.5 py-1.5 text-right text-red-650 font-black font-mono whitespace-nowrap">
                              {totalEnmExcedentes > 0 ? ctFmt(totalEnmExcedentes) : '—'}
                            </td>
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
          {planillaTipRes &&
            planillaTipRes.length > 0 &&
            (() => {
              return (
                <div
                  id={`${idPrefix}-tipologia-box`}
                  className="w-full p-2.5 sm:p-3 bg-white border border-slate-100 rounded-2xl shadow-mini"
                >
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-2">
                    {tipologiaTitle}
                  </h3>
                  <div className="w-full overflow-x-auto">
                    <table className="w-full text-[10.5px] sm:text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                          <th className="px-1.5 sm:px-2 py-1.5 text-left">Tipo</th>
                          <th className="px-1.5 sm:px-2 py-1.5 text-right whitespace-nowrap">Monto Contrato</th>
                          <th className="px-1.5 sm:px-2 py-1.5 text-right whitespace-nowrap">Planillado</th>
                          <th className="px-1.5 sm:px-2 py-1.5 text-right whitespace-nowrap">% Avance</th>
                          <th className="px-1.5 sm:px-2 py-1.5 text-right whitespace-nowrap">Saldo</th>
                          <th className="px-1.5 sm:px-2 py-1.5 text-right whitespace-nowrap">Excedentes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {planillaTipRes.map((t, i) => {
                          const isTot = t.tipo === 'Total';
                          return (
                            <tr
                              key={i}
                              className={`border-t border-slate-100 ${
                                isTot
                                  ? 'bg-blue-50/70 font-bold text-slate-900 border-t-2 border-slate-200'
                                  : 'hover:bg-slate-50/50'
                              }`}
                            >
                              <td className="px-1.5 sm:px-2 py-1.5 font-medium text-slate-800">{t.label || t.tipo}</td>
                              <td className="px-1.5 sm:px-2 py-1.5 text-right font-semibold font-mono whitespace-nowrap">
                                {ctFmt(t.monto)}
                              </td>
                              <td className="px-1.5 sm:px-2 py-1.5 text-right text-green-700 font-mono whitespace-nowrap">
                                {ctFmt(t.planillado)}
                              </td>
                              <td className="px-1.5 sm:px-2 py-1.5 text-right font-semibold text-slate-800 whitespace-nowrap">
                                {isTot
                                  ? avanceCertPct
                                  : t.monto > 0
                                  ? (t.planillado / t.monto * 100).toFixed(1)
                                  : '0'}
                                %
                              </td>
                              <td
                                className={`px-1.5 sm:px-2 py-1.5 text-right font-semibold font-mono whitespace-nowrap ${
                                  t.saldo >= 0 ? 'text-orange-600' : 'text-red-650'
                                }`}
                              >
                                {t.saldo !== 0
                                  ? t.saldo < 0
                                    ? '(' + ctFmt(Math.abs(t.saldo)) + ')'
                                    : ctFmt(t.saldo)
                                  : '—'}
                              </td>
                              <td className="px-1.5 sm:px-2 py-1.5 text-right text-red-600 font-mono whitespace-nowrap">
                                {ctFmt(t.excedentes)}
                              </td>
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
        <div
          id={`${idPrefix}-no-data`}
          className="text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-sm font-medium"
        >
          <Coins className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          La planilla de certificación no está disponible en el archivo cargado actualmente.
        </div>
      )}
    </div>
  );
};
