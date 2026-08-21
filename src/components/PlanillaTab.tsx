/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Search, ChevronDown, ChevronRight, CircleDollarSign, TrendingUp, Calendar, Clock, TrendingDown, Download } from 'lucide-react';
import { ctTipoLabel, ctTipoCfg, ctFmt, ctFmtM, ctPf } from '../utils/helpers';
import { CdoVsPlanillaTab } from './CdoVsPlanillaTab';
import { PlanillaItem } from '../types';

interface PlanillaTabProps {
  planillaInfo: any;
  planillaCDOvsS: any;
  planillaTotales: any;
  planillaEnmiendas: any[];
  planillaTipRes: any[];
  planillaHojas: PlanillaItem[];
  planillaPartidas: PlanillaItem[];
  enmExpanded: Set<number>;
  setEnmExpanded: (v: Set<number> | ((prev: Set<number>) => Set<number>)) => void;
  ctExpanded: Set<string>;
  setCtExpanded: (v: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  ctSearch: string;
  setCtSearch: (v: string) => void;
  ctFilterTipo: string;
  setCtFilterTipo: (v: string) => void;
  ctSoloCert: boolean;
  setCtSoloCert: (v: boolean) => void;
  certOpen: boolean;
  setCertOpen: (v: boolean) => void;
}

export const PlanillaTab: React.FC<PlanillaTabProps> = ({
  planillaInfo,
  planillaCDOvsS,
  planillaTotales,
  planillaEnmiendas,
  planillaTipRes,
  planillaHojas,
  planillaPartidas,
  enmExpanded,
  setEnmExpanded,
  ctExpanded,
  setCtExpanded,
  ctSearch,
  setCtSearch,
  ctFilterTipo,
  setCtFilterTipo,
  ctSoloCert,
  setCtSoloCert,
  certOpen,
  setCertOpen,
}) => {
  if (!planillaInfo) return null;

  const [graficosOpen, setGraficosOpen] = React.useState(false);

  const q = ctSearch.toLowerCase();
  const hojasFilt = planillaHojas.filter(h => {
    if (ctFilterTipo && h.tipo !== ctFilterTipo) return false;
    if (ctSoloCert && h.cert === 0) return false;
    if (q && !h.desc.toLowerCase().includes(q) && !h.cod.includes(q)) return false;
    return true;
  });
  
  const hayFiltro = !!(ctFilterTipo || ctSoloCert || q);

  const ctSumar = (cod: string) => {
    const prefix = cod + '.';
    let c = 0, a = 0, s = 0, cert = 0;
    hojasFilt.forEach(h => {
      if (h.cod !== cod && !h.cod.startsWith(prefix)) return;
      c += h.contrato; a += h.acum; s += h.saldo; cert += h.cert;
    });
    return { contrato: c, acum: a, saldo: s, cert };
  };

  const _hojaBase = hayFiltro ? hojasFilt : planillaHojas;

  // Calculate totalEnmSaldo if there are no active filters
  const filteredEnmsForTotal = (!hayFiltro && planillaEnmiendas && planillaEnmiendas.length > 0)
    ? planillaEnmiendas.filter(e => !e.isGranTotal && e.subtotal)
    : [];
  const totalEnmSaldoVal = filteredEnmsForTotal.length > 0
    ? filteredEnmsForTotal.reduce((acc, e) => acc + (e.subtotal.saldo || 0), 0)
    : _hojaBase.reduce((s, h) => s + h.saldo, 0);

  const T = {
    contrato: _hojaBase.reduce((s, h) => s + h.contrato, 0),
    acum:     _hojaBase.reduce((s, h) => s + h.acum, 0),
    saldo:    totalEnmSaldoVal,
    anterior: _hojaBase.reduce((s, h) => s + h.anterior, 0),
    cert:     _hojaBase.reduce((s, h) => s + h.cert, 0),
    exc:      _hojaBase.reduce((s, h) => s + h.exc, 0),
    excE6:    _hojaBase.reduce((s, h) => s + h.excE6, 0),
  };
  const avance = T.contrato > 0 ? (T.acum / T.contrato * 100).toFixed(1) : '0';
  const conCert = hojasFilt.filter(h => h.cert > 0).length;

  const porTipo: Record<string, any> = {};
  planillaHojas.forEach(h => {
    if (!porTipo[h.tipo]) porTipo[h.tipo] = { tipo: h.tipo, contrato: 0, acum: 0, cert: 0, items: 0 };
    porTipo[h.tipo].contrato += h.contrato;
    porTipo[h.tipo].acum += h.acum;
    porTipo[h.tipo].cert += h.cert;
    porTipo[h.tipo].items++;
  });
  const tipArray = Object.values(porTipo).sort((a: any, b: any) => b.contrato - a.contrato);

  const visible = new Set<string>();
  hojasFilt.forEach(h => {
    const parts = h.cod.split('.');
    for (let i = 1; i <= parts.length; i++) visible.add(parts.slice(0, i).join('.'));
  });
  
  const treePartFilt = planillaPartidas.filter(p => visible.has(p.cod));
  const allVis = [...treePartFilt, ...hojasFilt].sort((a, b) => {
    const pa = a.cod.split('.').map(Number);
    const pb = b.cod.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d !== 0) return d;
    }
    return 0;
  });
  const rootVis = allVis.filter(it => it.nivel === 1);

  const ctToggle = (id: string) => setCtExpanded(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  const renderCtItem = (item: any): React.ReactNode => {
    const hijos = allVis.filter(h => h.cod.startsWith(item.cod + '.') && h.nivel === item.nivel + 1);
    const isExp = ctExpanded.has(item.id);
    const depth = item.nivel - 1;
    const v = item.esHoja ? item : ctSumar(item.cod);
    const av = v.contrato > 0 ? (v.acum / v.contrato * 100) : 0;
    const cfg = ctTipoCfg(item.tipo || '');
    let rowBg = 'bg-white font-normal';
    let descClass = 'text-gray-900 text-sm';
    if (!item.esHoja) {
      if (item.nivel === 1) {
        rowBg = 'bg-blue-50/85 border-l-4 border-l-blue-650 hover:bg-blue-100/70';
        descClass = 'text-blue-950 font-extrabold text-[13px]';
      } else if (item.nivel === 2) {
        rowBg = 'bg-emerald-50/65 border-l-2 border-l-emerald-500 hover:bg-emerald-100/60';
        descClass = 'text-emerald-900 font-bold text-[12px]';
      } else if (item.nivel === 3) {
        rowBg = 'bg-purple-50/65 border-l-2 border-l-purple-500 hover:bg-purple-100/60';
        descClass = 'text-purple-900 font-bold text-[12px]';
      } else if (item.nivel === 4) {
        rowBg = 'bg-amber-50/65 border-l-2 border-l-amber-500 hover:bg-amber-100/60';
        descClass = 'text-amber-900 font-semibold text-[12px]';
      } else if (item.nivel === 5) {
        rowBg = 'bg-rose-50/65 border-l-2 border-l-rose-400 hover:bg-rose-100/60';
        descClass = 'text-rose-900 font-semibold text-[12px]';
      } else {
        rowBg = 'bg-slate-50/80 border-l-2 border-l-slate-400 hover:bg-slate-100';
        descClass = 'text-slate-800 font-medium text-[12px]';
      }
    } else {
      descClass = 'text-gray-800 text-[12px] font-normal';
    }
    
    return (
      <React.Fragment key={item.id}>
        <div className={`flex items-center border-b border-gray-100 cursor-pointer ${rowBg}`}
          style={{ paddingLeft: 4 + depth * 4, paddingRight: 12, paddingTop: 7, paddingBottom: 7 }}
          onClick={() => hijos.length && ctToggle(item.id)}>
          <div className="flex-shrink-0 w-5 mr-1">
            {hijos.length > 0 && (isExp ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />)}
          </div>
          <div className="flex-shrink-0 w-12 mr-2 text-center text-xs flex items-center justify-center">
            {item.esHoja && <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap inline-block leading-none ${cfg.bg} ${cfg.text}`} title={item.tipo || ''}>{ctTipoLabel(item.tipo) || '—'}</span>}
          </div>
          <div className="flex-1 min-w-0 mr-4">
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">{item.cod}</span>
              <span className={`truncate ${descClass}`}>{item.desc}</span>
            </div>
            {item.esHoja && item.unidad && <div className="text-[10px] text-gray-400">{item.tarifa > 0 && `$${ctFmt(item.tarifa, 4)}/${item.unidad}`}</div>}
          </div>
          <div className="flex-shrink-0 grid text-right text-xs" style={{ gridTemplateColumns: '8.5rem 8.5rem 7rem 5.5rem 7rem', gap: '8px', width: '39rem' }}>
            <div><div className="font-semibold">${ctFmt(v.contrato)}</div><div className="text-gray-400 text-[10px]">Contrato</div></div>
            <div><div className="text-green-700 font-semibold">${ctFmt(v.acum)}</div><div className="text-gray-400 text-[10px]">Acumulado</div></div>
            <div><div className={`font-semibold ${v.cert > 0 ? 'text-purple-700 font-extrabold' : 'text-gray-300'}`}>{v.cert > 0 ? `$${ctFmt(v.cert)}` : '—'}</div><div className="text-gray-400 text-[10px]">Esta Cert.</div></div>
            <div>
              <div className="font-semibold text-gray-700">{av.toFixed(1)}%</div>
              <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mt-0.5">
                <div className={`h-full ${av >= 100 ? 'bg-green-500' : av >= 75 ? 'bg-blue-500' : 'bg-red-400'}`} style={{ width: `${Math.min(av, 100)}%` }} />
              </div>
            </div>
            <div><div className={`font-semibold ${v.saldo < 0 ? 'text-red-600' : 'text-orange-600'}`}>{v.saldo < 0 ? `($${ctFmt(Math.abs(v.saldo))})` : `$${ctFmt(v.saldo)}`}</div><div className="text-gray-400 text-[10px]">Saldo</div></div>
          </div>
        </div>
        {isExp && hijos.map(h => renderCtItem(h))}
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-4">
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

          {" "}
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

          {" "}
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

          {" "}
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

          {" "}
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
      {planillaEnmiendas.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5 border border-indigo-600">
          <h2 className="text-base font-bold text-indigo-950 mb-3">Resumen Contrato + Enmiendas</h2>
          <div className="overflow-x-auto text-xs">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-gray-100 font-semibold text-gray-600 border-b">
                  <th className="w-6"></th>
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
                        const isExp = enmExpanded.has(ei);
                        const toggle = () => setEnmExpanded(prev => {
                          const n = new Set(prev);
                          if (n.has(ei)) n.delete(ei);
                          else n.add(ei);
                          return n;
                        });
                        const lbl = enm.label === 'Contrato Original' ? 'C.O' : enm.label;
                        return (
                          <React.Fragment key={ei}>
                            <tr className={`border-t cursor-pointer hover:bg-blue-50 ${isExp ? 'bg-blue-50 font-medium' : ''}`} onClick={toggle}>
                              <td className="px-3 py-2 text-gray-400">{isExp ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</td>
                              <td className="px-3 py-2 font-bold text-blue-800">{lbl}</td>
                              <td className="px-3 py-2 text-right text-gray-400">{s.contratoAcum > 0 ? '$' + ctFmt(s.contratoAcum) : '—'}</td>
                              <td className="px-3 py-2 text-right text-indigo-600">{s.incremento > 0 ? '$' + ctFmt(s.incremento) : '—'}</td>
                              <td className="px-3 py-2 text-right font-medium">${ctFmt(s.monto)}</td>
                              <td className="px-3 py-2 text-right text-green-700 font-medium">${ctFmt(s.planillado)}</td>
                              <td className="px-3 py-2 text-right font-semibold">{ej}%</td>
                              <td className={`px-3 py-2 text-right ${s.saldo >= 0 ? 'text-orange-600 font-semibold' : 'text-red-600 font-semibold'}`}>{s.saldo !== 0 ? (s.saldo < 0 ? '($' + ctFmt(Math.abs(s.saldo)) + ')' : '$' + ctFmt(s.saldo)) : '—'}</td>
                              <td className="px-3 py-2 text-right text-red-500">{s.excedentes > 0 ? '$' + ctFmt(s.excedentes) : '—'}</td>
                            </tr>
                            {isExp && enm.filas.map((f: any, fi: number) => {
                              const fej = f.monto > 0 ? (f.planillado / f.monto * 100).toFixed(1) : '—';
                              return (
                                <tr key={`f-${ei}-${fi}`} className="bg-slate-50/70 text-slate-550 border-t border-slate-150 hover:bg-slate-100/60 transition-colors">
                                  <td className="px-3 py-1.5 text-gray-300"></td>
                                  <td className="px-3 py-1.5 pl-6 font-semibold text-slate-600">{f.tipo}</td>
                                  <td className="px-3 py-1.5 text-right text-slate-400">{f.contratoAcum > 0 ? '$' + ctFmt(f.contratoAcum) : '—'}</td>
                                  <td className="px-3 py-1.5 text-right text-indigo-500">{f.incremento > 0 ? '$' + ctFmt(f.incremento) : '—'}</td>
                                  <td className="px-3 py-1.5 text-right text-slate-700 font-medium">${ctFmt(f.monto)}</td>
                                  <td className="px-3 py-1.5 text-right text-green-600 font-medium">${ctFmt(f.planillado)}</td>
                                  <td className="px-3 py-1.5 text-right font-semibold">{fej}%</td>
                                  <td className={`px-3 py-1.5 text-right ${f.saldo >= 0 ? 'text-orange-500' : 'text-red-500'}`}>{f.saldo !== 0 ? (f.saldo < 0 ? '($' + ctFmt(Math.abs(f.saldo)) + ')' : '$' + ctFmt(f.saldo)) : '—'}</td>
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
                        <td className="px-3 py-2.5 font-bold text-slate-850">Total</td>
                        <td className="px-3 py-2.5 text-right text-slate-600 font-bold">${ctFmt(totalContratoAcum)}</td>
                        <td className="px-3 py-2.5 text-right text-indigo-700 font-bold">{totalEnmIncremento > 0 ? '$' + ctFmt(totalEnmIncremento) : '—'}</td>
                        <td className="px-3 py-2.5 text-right font-black text-slate-900">${ctFmt(totalEnmMonto)}</td>
                        <td className="px-3 py-2.5 text-right text-green-700 font-black">${ctFmt(totalEnmPlanillado)}</td>
                        <td className="px-3 py-2.5 text-right font-black text-slate-900">{totalEnmPctEjec}%</td>
                        <td className={`px-3 py-2.5 text-right font-black ${totalEnmSaldo >= 0 ? 'text-orange-700' : 'text-red-700'}`}>{totalEnmSaldo !== 0 ? (totalEnmSaldo < 0 ? '($' + ctFmt(Math.abs(totalEnmSaldo)) + ')' : '$' + ctFmt(totalEnmSaldo)) : '—'}</td>
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

      {/* Tipología resumen */}
      {planillaTipRes.length > 0 && (() => {
        const totalTipoloMonto = planillaTipRes.find(t => t.tipo === 'Total')?.monto || 0;
        return (
          <div className="bg-white rounded-xl shadow-sm p-5 border border-indigo-600">
            <h2 className="text-base font-bold text-indigo-950 mb-3">Resumen por Tipología de Contrato</h2>
            <div className="overflow-x-auto text-xs">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-100 border-b">
                  <tr>
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
                      <tr key={i} className={`border-t ${isTot ? 'bg-blue-50 font-bold' : 'hover:bg-gray-50'}`}>
                        <td className="px-4 py-2.5 font-medium">{t.label || t.tipo}</td>
                        <td className="px-4 py-2.5 text-right font-semibold">${ctFmt(t.monto)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-500">
                          {isTot ? '100.0%' : (totalTipoloMonto > 0 ? (t.monto / totalTipoloMonto * 100).toFixed(1) + '%' : '0.0%')}
                        </td>
                        <td className="px-4 py-2.5 text-right text-green-700">${ctFmt(t.planillado)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold">{isTot ? avance : (t.monto > 0 ? (t.planillado / t.monto * 100).toFixed(1) : '0')}%</td>
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

      {/* Gráficos de Certificación por Tipo */}
      {planillaHojas.length > 0 && (() => {
        // Group and sum h.cert (Esta Cert.) or h.acum (V. ACUMULADA) based on ctSoloCert checkbox
        const targetHojas = ctSoloCert ? planillaHojas.filter(h => h.cert > 0) : planillaHojas;

        const sumasPorTipo: Record<string, { tipo: string; label: string; planillado: number; contrato: number }> = {};
        targetHojas.forEach(h => {
          const tKey = h.tipo || 'Sin match';
          const label = ctTipoLabel(tKey);
          if (!sumasPorTipo[tKey]) {
            sumasPorTipo[tKey] = {
              tipo: tKey,
              label: label === 'Sin match' ? 'Sin clasificación' : label,
              planillado: 0,
              contrato: 0
            };
          }
          sumasPorTipo[tKey].planillado += ctSoloCert ? h.cert : h.acum;
          sumasPorTipo[tKey].contrato += h.contrato;
        });

        const colorsByTipo: Record<string, string> = {
          '01.Preliminares': '#64748b', // Slate
          '02.Obra Civil': '#3b82f6', // Blue
          '09.Obra Arquitectonica': '#ec4899', // Pink
          '07.Tuberia': '#f59e0b', // Amber/Yellow
          '07.Tuberia_Int.': '#d97706',
          '07.Tuberia_Patio': '#b45309',
          '07.Tuberia_Ext.': '#78350f',
          '06.Climatizacion': '#06b6d4', // Cyan
          '03.Equipo Mecanico': '#10b981', // Emerald
          '03.Equipo Mecanico - Principal': '#059669',
          '04.Equipo Electrico': '#8b5cf6', // Violet
          '05.Instrumentacion y Control': '#f97316', // Orange
          '10.PMA': '#14b8a6', // Teal
          '11.Puesta en Marcha': '#ef4444', // Red
        };

        const fallbackColores = [
          '#1e40af', '#3b82f6', '#06b6d4', '#0ea5e9', 
          '#10b981', '#84cc16', '#eab308', '#f97316', 
          '#ef4444', '#ec4899', '#a855f7', '#6366f1'
        ];

        const rows = Object.values(sumasPorTipo)
          .filter(t => t.planillado > 0)
          .map((t, idx) => ({
            nombre: t.label,
            total: t.planillado,
            contrato: t.contrato,
            tipo: t.tipo,
            color: colorsByTipo[t.tipo] || fallbackColores[idx % fallbackColores.length]
          }))
          .sort((a, b) => b.contrato - a.contrato);

        const totalAcum = rows.reduce((s, r) => s + r.total, 0);

        if (totalAcum <= 0) return null;

        // Build SVG segments
        const cx = 150, cy = 150, rExt = 120, rInt = 75;
        let acumAng = -Math.PI / 2;
        
        const segmentos = rows.map((r, i) => {
          let frac = r.total / totalAcum;
          if (frac >= 1) frac = 0.9999;
          const angIni = acumAng;
          const angFin = acumAng + frac * 2 * Math.PI;
          acumAng = angFin;

          const x1 = cx + rExt * Math.cos(angIni);
          const y1 = cy + rExt * Math.sin(angIni);
          const x2 = cx + rExt * Math.cos(angFin);
          const y2 = cy + rExt * Math.sin(angFin);
          const x3 = cx + rInt * Math.cos(angFin);
          const y3 = cy + rInt * Math.sin(angFin);
          const x4 = cx + rInt * Math.cos(angIni);
          const y4 = cy + rInt * Math.sin(angIni);
          const largo = frac > 0.5 ? 1 : 0;
          const path = `M ${x1} ${y1} A ${rExt} ${rExt} 0 ${largo} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInt} ${rInt} 0 ${largo} 0 ${x4} ${y4} Z`;
          
          return {
            ...r,
            path,
            frac: r.total / totalAcum,
          };
        });

        const labelCentro = ctSoloCert ? "Esta Planilla" : "V. Acumulada";
        const descTexto = ctSoloCert 
          ? "Monto certificado del período actual por tipo de contrato (Esta Cert.)"
          : "Volumen acumulado certificado a la fecha por tipo de contrato (V. Acumulada)";

        return (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-indigo-600">
            <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-150 select-none">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => setGraficosOpen(!graficosOpen)}>
                <span className="text-base font-bold text-indigo-950">Gráficos de Certificación por Tipo</span>
                <span className="text-xs text-gray-400">({graficosOpen ? 'Cerrar' : 'Abrir'})</span>
              </div>
              <div className="flex items-center gap-4">
                <label className="text-xs text-indigo-950 flex items-center gap-1.5 cursor-pointer font-bold bg-indigo-50/80 hover:bg-indigo-100/80 px-2.5 py-1 rounded-md border border-indigo-200 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={ctSoloCert} 
                    onChange={e => setCtSoloCert(e.target.checked)} 
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                  />
                  <span>Solo con Cert. en esta planilla</span>
                </label>
                <button 
                  onClick={() => setGraficosOpen(!graficosOpen)} 
                  className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:bg-indigo-50 text-lg font-bold"
                >
                  {graficosOpen ? '−' : '+'}
                </button>
              </div>
            </div>
            {graficosOpen && (
              <div className="p-5">
                <p className="text-xs text-slate-500 mb-4 font-medium">
                  {descTexto}
                </p>
                
                <div className="flex flex-col md:flex-row items-center justify-center gap-8">
              {/* Pie Chart SVG */}
              <div className="relative flex-shrink-0 w-[300px] h-[300px]">
                <svg width="300" height="300" viewBox="0 0 300 300" className="mx-auto block">
                  {segmentos.map((s, idx) => {
                    const isSelected = ctFilterTipo === s.tipo;
                    return (
                      <path
                        key={idx}
                        d={s.path}
                        fill={s.color}
                        stroke={isSelected ? "#1e1b4b" : "#ffffff"}
                        strokeWidth={isSelected ? "3.5" : "2"}
                        className="transition-all duration-300 hover:opacity-90 cursor-pointer"
                        style={{
                          transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                          transformOrigin: '150px 150px'
                        }}
                        onClick={() => {
                          if (ctFilterTipo === s.tipo) {
                            setCtFilterTipo('');
                          } else {
                            setCtFilterTipo(s.tipo);
                            if (!certOpen) setCertOpen(true);
                          }
                        }}
                      >
                        <title>{`${s.nombre}: $${ctFmt(s.total)} (${(s.frac * 100).toFixed(1)}%)`}</title>
                      </path>
                    );
                  })}
                  <text x="150" y="140" fontSize="11" fill="#475569" textAnchor="middle" fontWeight="600" className="font-sans">{labelCentro}</text>
                  <text x="150" y="160" fontSize="15" fill="#1e1b4b" textAnchor="middle" fontWeight="800" className="font-sans">${ctFmt(totalAcum)}</text>
                  <text x="150" y="175" fontSize="9" fill="#94a3b8" textAnchor="middle" className="font-sans">total certificado</text>
                </svg>
              </div>

              {/* Legend Grid */}
              <div className="flex-1 w-full">
                {(() => {
                  const half = Math.ceil(segmentos.length / 2);
                  const col1 = segmentos.slice(0, half);
                  const col2 = segmentos.slice(half);
                  const isAnySelected = ctFilterTipo !== '';

                  const renderLegendCard = (s: any, idx: number) => {
                    const isSelected = ctFilterTipo === s.tipo;
                    const cardOpacity = isAnySelected && !isSelected ? 'opacity-40 hover:opacity-100 ring-0' : 'opacity-100';
                    const activeBorder = isSelected 
                      ? 'border-indigo-600 bg-indigo-50 hover:bg-indigo-100/60 ring-2 ring-indigo-500/15 font-semibold shadow-xs' 
                      : 'border-slate-100 hover:bg-slate-50 hover:border-slate-300';

                    return (
                      <div 
                        key={idx} 
                        onClick={() => {
                          if (ctFilterTipo === s.tipo) {
                            setCtFilterTipo('');
                          } else {
                            setCtFilterTipo(s.tipo);
                            if (!certOpen) setCertOpen(true);
                          }
                        }}
                        className={`flex items-center justify-between gap-3 p-1.5 px-2.5 rounded-lg border transition-all text-[11px] cursor-pointer select-none active:scale-[0.98] ${cardOpacity} ${activeBorder}`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div 
                            className={`rounded-full flex-shrink-0 transition-transform duration-200 ${isSelected ? 'w-2.5 h-2.5 scale-125' : 'w-2 h-2'}`} 
                            style={{ backgroundColor: s.color }} 
                          />
                          <span className={`truncate ${isSelected ? 'text-indigo-950 font-black' : 'font-extrabold text-slate-755'}`} title={s.nombre}>
                            {s.nombre}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <span className="w-[105px] text-right font-mono text-slate-600 font-semibold">${ctFmt(s.contrato)}</span>
                          <div className="w-[125px] text-right flex items-center justify-end gap-1">
                            <span className={`font-mono font-bold ${isSelected ? 'text-indigo-805 scale-105 font-black' : 'text-indigo-700'}`}>${ctFmt(s.total)}</span>
                            <span className="text-[10px] text-slate-400 font-semibold">({(s.frac * 100).toFixed(1)}%)</span>
                          </div>
                        </div>
                      </div>
                    );
                  };

                  return (
                    <>
                      {/* Headers to avoid label repetition, aligning perfectly with standard column widths */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 mb-1.5 text-[9px] font-black text-slate-400 tracking-wider uppercase">
                        <div className="hidden sm:flex items-center justify-between px-2.5 py-1 border-b border-slate-100">
                          <span>Tipo</span>
                          <div className="flex items-center gap-4">
                            <span className="w-[105px] text-right">V. Contrato</span>
                            <span className="w-[125px] text-right">{ctSoloCert ? 'Esta Cert' : 'V. Acumulado (%)'}</span>
                          </div>
                        </div>
                        <div className="hidden lg:flex items-center justify-between px-2.5 py-1 border-b border-slate-100">
                          <span>Tipo</span>
                          <div className="flex items-center gap-4">
                            <span className="w-[105px] text-right">V. Contrato</span>
                            <span className="w-[125px] text-right">{ctSoloCert ? 'Esta Cert' : 'V. Acumulado (%)'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-1">
                        {/* Left column / Block 1 */}
                        <div className="flex flex-col gap-y-1">
                          {col1.map((s, idx) => renderLegendCard(s, idx))}
                        </div>

                        {/* Right column / Block 2 */}
                        <div className="flex flex-col gap-y-1">
                          {col2.map((s, idx) => renderLegendCard(s, idx))}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  })()}

      {/* Accordeon certificación details */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-indigo-600">
        <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-150 select-none">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCertOpen(!certOpen)}>
            <span className="text-base font-bold text-gray-800">Detalle de Certificación</span>
            <span className="text-xs text-gray-400">({certOpen ? 'Cerrar' : 'Abrir'})</span>
          </div>
          <div className="flex items-center gap-4">
            <label className="text-xs text-indigo-950 flex items-center gap-1.5 cursor-pointer font-bold bg-indigo-50/80 hover:bg-indigo-100/80 px-2.5 py-1 rounded-md border border-indigo-200 transition-colors">
              <input 
                type="checkbox" 
                checked={ctSoloCert} 
                onChange={e => setCtSoloCert(e.target.checked)} 
                className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
              />
              <span>Solo con Cert. en esta planilla</span>
            </label>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setCertOpen(!certOpen);
              }} 
              className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:bg-blue-50 text-lg font-bold"
            >
              {certOpen ? '−' : '+'}
            </button>
          </div>
        </div>
        {certOpen && (
          <div>
            {/* Search filter bar */}
            <div className="px-4 py-2 border-b bg-gray-50 flex gap-2 flex-wrap items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Buscar código o descripción..." 
                  value={ctSearch} 
                  onChange={e => setCtSearch(e.target.value)} 
                  className="w-full pl-8 pr-3 py-1 border rounded text-xs" 
                />
              </div>
              {ctFilterTipo && <button onClick={() => setCtFilterTipo('')} className="text-xs text-blue-600 bg-blue-100 hover:bg-blue-200 px-2 py-0.5 rounded font-medium">Filtro Tipo: {ctFilterTipo} ✕</button>}
            </div>

            {/* Table Header */}
            <div className="flex items-center bg-slate-50 border-b border-gray-200 font-semibold text-[10px] text-slate-500 py-2.5 px-3" style={{ paddingLeft: '12px', paddingRight: '12px' }}>
              <div className="flex-shrink-0 w-5 mr-1"></div> {/* Left spacer for folder caret */}
              <div className="flex-shrink-0 w-10 mr-2 text-center uppercase tracking-wider font-bold">Tipo</div>
              <div className="flex-1 min-w-0 mr-4 text-left uppercase tracking-wider font-bold">Descripción</div>
              <div className="flex-shrink-0 grid text-right uppercase tracking-wider font-bold" style={{ gridTemplateColumns: '8.5rem 8.5rem 7rem 5.5rem 7rem', gap: '8px', width: '39rem' }}>
                <div>V. Contrato</div>
                <div>V. Acumulada</div>
                <div>Esta Cert.</div>
                <div className="text-right">Avance</div>
                <div>Saldo</div>
              </div>
            </div>

            <div>
              {rootVis.map(it => renderCtItem(it))}
            </div>
            
            {/* Table Footer totals */}
            <div className="flex items-center bg-blue-150 border-t-2 border-blue-300 font-bold text-sm" style={{ paddingLeft: 12+5+10+4, paddingRight: 12, paddingTop: 10, paddingBottom: 10 }}>
              <div className="flex-1">TOTAL GENERAL (PLANILLA)</div>
              <div className="flex-shrink-0 grid text-right text-xs" style={{ gridTemplateColumns: '8.5rem 8.5rem 7rem 5.5rem 7rem', gap: '8px', width: '39rem' }}>
                <div>${ctFmt(T.contrato)}</div>
                <div className="text-green-800">${ctFmt(T.acum)}</div>
                <div className="text-purple-700">${ctFmt(T.cert)}</div>
                <div>{avance}%</div>
                <div className="text-orange-700">${ctFmt(T.saldo)}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {planillaCDOvsS && Object.keys(planillaCDOvsS.F || {}).length > 0 && (
        <CdoVsPlanillaTab cdoVsS={planillaCDOvsS} />
      )}
    </div>
  );
};
