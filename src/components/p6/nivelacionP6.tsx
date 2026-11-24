/**
 * Ventana «Level Crews» del módulo P6: elige un conjunto de actividades (subcontratista, SCAP y fase),
 * diagnostica su lógica de cuadrillas y propone una nueva (N cuadrillas, una estructura completa
 * de continuo, nivelada dentro de la holgura). Muestra el antes y el después y, si es admin, la aplica
 * como cambios sin guardar (luego F9 y Save).
 */
import React from 'react';
import { X, Play, Check } from 'lucide-react';
import { celda } from '../../utils/p6/xer';
import type { ModeloP6 } from '../../utils/p6/modelo';
import { CAMPOS_AGRUPACION, valorCampo, type CampoAgrupacion, type Clasificacion } from '../../utils/p6/vistaEjecucion';
import { faseDe, type FaseUso } from '../../utils/p6/uso';
import { buscarMejor, diagnosticar, histograma, meses, negativas, peorHolgura, picoYDesv, proponer, type Diagnostico, type Propuesta } from '../../utils/p6/nivelacion';
import type { Actividad } from '../../types';

const MES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fCorta = (t: number | null | undefined) => {
  if (t == null || !isFinite(t)) return '';
  const d = new Date(t * 60000);
  return `${String(d.getUTCDate()).padStart(2, '0')}-${MES[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(2)}`;
};
const FASES: [FaseUso | '', string][] = [['', 'Any phase'], ['procura', 'Procurement'], ['flete', 'Freight'], ['montaje', 'Installation'], ['construccion', 'Construction']];

export interface FiltroNivel { subc: string; scap: string; fase: FaseUso | ''; grupo: CampoAgrupacion; tipo: CampoAgrupacion }
const POR_DEFECTO: FiltroNivel = { subc: 'CMO', scap: 'Compuertas', fase: 'montaje', grupo: 'cap', tipo: 'unit' };

export const DialogoNivelacion: React.FC<{
  m: ModeloP6; clasif: Map<string, Clasificacion>; master: Map<string, Actividad>; editable: boolean; version: number;
  onAplicar: (prop: Propuesta, resumen: string) => void; onIr: (i: number) => void; onCerrar: () => void;
}> = ({ m, clasif, master, editable, version, onAplicar, onIr, onCerrar }) => {
  const [f, setF] = React.useState<FiltroNivel>(() => { try { return { ...POR_DEFECTO, ...JSON.parse(localStorage.getItem('p6.nivel') || '{}') }; } catch { return POR_DEFECTO; } });
  React.useEffect(() => { try { localStorage.setItem('p6.nivel', JSON.stringify(f)); } catch { /* sin almacenamiento */ } }, [f]);
  const t = m.task;
  const cod = (i: number) => celda(t, t.filas[i], 'task_code');
  const campo = React.useCallback((i: number, k: CampoAgrupacion) => { const c = celda(t, t.filas[i], 'task_code'); return valorCampo(master.get(c), k, clasif.get(c)); }, [t, master, clasif]);
  // Valores existentes para los desplegables
  const valores = React.useMemo(() => {
    const subc = new Map<string, number>(), scap = new Map<string, number>();
    t.filas.forEach((fl, i) => {
      if (celda(t, fl, 'status_code') === 'TK_Complete') return;
      const s = campo(i, 'subcontratista'); if (s) subc.set(s, (subc.get(s) ?? 0) + 1);
      if (!f.subc || s === f.subc) { const c = campo(i, 'scap'); if (c) scap.set(c, (scap.get(c) ?? 0) + 1); }
    });
    const orden = (x: Map<string, number>) => [...x].sort((a, b) => a[0].localeCompare(b[0], 'es', { numeric: true }));
    return { subc: orden(subc), scap: orden(scap) };
  }, [t, campo, f.subc, version]);
  /** Actividades (no hitos ni LOE) de un subcontratista por fase, para no dejar el conjunto vacío. */
  const fasesDeSubc = React.useCallback((subc: string, scap = '') => {
    const n = new Map<FaseUso, number>();
    t.filas.forEach((fl, i) => {
      if (subc && campo(i, 'subcontratista') !== subc) return;
      if (scap && campo(i, 'scap') !== scap) return;
      const tipo = celda(t, fl, 'task_type');
      if (tipo === 'TT_Mile' || tipo === 'TT_FinMile' || tipo === 'TT_LOE' || tipo === 'TT_WBS') return;
      const fa = faseDe(celda(t, fl, 'task_name'));
      n.set(fa, (n.get(fa) ?? 0) + 1);
    });
    return n;
  }, [t, campo]);
  // Al cambiar de subcontratista se mantiene la fase solo si tiene actividades en ella (p. ej. Tesco
  // solo tiene «Suministro e Instalación…», que por el nombre son Construction, no Installation)
  const cambiarSubc = (subc: string) => {
    const n = fasesDeSubc(subc);
    setF({ ...f, subc, scap: '', fase: f.fase && (n.get(f.fase) ?? 0) > 0 ? f.fase : '' });
  };
  const conjunto = React.useMemo(() => {
    const out: number[] = [];
    t.filas.forEach((fl, i) => {
      if (f.subc && campo(i, 'subcontratista') !== f.subc) return;
      if (f.scap && campo(i, 'scap') !== f.scap) return;
      if (f.fase && faseDe(celda(t, fl, 'task_name')) !== f.fase) return;
      const tipo = celda(t, fl, 'task_type');
      if (tipo === 'TT_Mile' || tipo === 'TT_FinMile' || tipo === 'TT_LOE' || tipo === 'TT_WBS') return;
      out.push(i);
    });
    return out;
  }, [t, campo, f.subc, f.scap, f.fase, version]);

  const [ocupado, setOcupado] = React.useState(false);
  const [res, setRes] = React.useState<{ d: Diagnostico; prop: Propuesta; auto: { n: number; tope: number } | null; viable: boolean; alcanzado: boolean; vale: boolean; manual: boolean } | null>(null);
  /** ¿Merece la pena? Termina antes (o igual), no retrasa el proyecto y no empeora la holgura. */
  const valeLaPena = (d: Diagnostico, p: Propuesta) => p.despues.finConjunto <= d.antes.finConjunto + 1 && p.despues.finProyecto <= d.antes.finProyecto + 1
    && negativas(p.despues) <= negativas(d.antes) && peorHolgura(p.despues) >= peorHolgura(d.antes) - 240;
  const [manual, setManual] = React.useState<{ n: number; tope: string }>({ n: 3, tope: '' });
  const [verEnlaces, setVerEnlaces] = React.useState(false);
  const analizar = (op?: { n: number; tope: number }) => {
    setOcupado(true);
    window.setTimeout(() => {
      try {
        const d = diagnosticar(m, conjunto, i => campo(i, f.grupo), i => campo(i, f.tipo));
        if (op) {
          const prop = proponer(m, d, { cuadrillas: op.n, tope: op.tope });
          const vale = valeLaPena(d, prop);
          setRes({ d, prop, auto: res?.auto ?? null, viable: vale && prop.deficit.length === 0, alcanzado: res?.alcanzado ?? false, vale, manual: true });
        } else {
          const { mejor, probadas, objetivoAlcanzado } = buscarMejor(m, d);
          // Sin opción que valga la pena: se muestra la más cercana (la que termina antes y, a igualdad, con mejor holgura)
          const elegido = mejor ?? [...probadas].sort((a, b) => (a.prop.despues.finConjunto - b.prop.despues.finConjunto) || (peorHolgura(b.prop.despues) - peorHolgura(a.prop.despues)))[0];
          setRes({ d, prop: elegido.prop, auto: mejor ? { n: mejor.op.cuadrillas, tope: mejor.op.tope ?? Infinity } : null, viable: !!mejor && objetivoAlcanzado, alcanzado: objetivoAlcanzado, vale: !!mejor, manual: false });
          setManual({ n: elegido.op.cuadrillas, tope: isFinite(elegido.op.tope ?? Infinity) ? String(elegido.op.tope) : '' });
        }
      } finally { setOcupado(false); }
    }, 30);
  };
  // Sin resultado si cambia el conjunto
  React.useEffect(() => { setRes(null); }, [conjunto]);

  const lim = React.useMemo(() => meses(m.fechaDatos, 36), [m.fechaDatos]);
  const graf = React.useMemo(() => {
    if (!res) return null;
    const a = histograma(m, res.d, res.d.antes, lim), b = histograma(m, res.d, res.prop.despues, lim);
    let ult = 0;
    for (let k = 0; k < a.length; k++) if (a[k] > 0.01 || b[k] > 0.01) ult = k;
    return { a: a.slice(0, ult + 1), b: b.slice(0, ult + 1), pa: picoYDesv(a), pb: picoYDesv(b) };
  }, [res, m, lim]);
  const diasDe = (i: number, min: number | null | undefined) => {
    if (min == null) return '—';
    const hd = m.calendarios.get(celda(t, t.filas[i], 'clndr_id'))?.horasDia || 8;
    return String(Math.round(min / (hd * 60)));
  };
  const hdProm = m.calendarios.values().next().value?.horasDia || 8;
  const tfTxt = (x: number) => (isFinite(x) ? `${Math.round(x / (hdProm * 60))}d` : '—');

  const sel = 'border border-[#D5DEE2] rounded px-1.5 py-1 bg-white';
  const metrica = (etq: string, a: string, b: string, mejor: boolean | null) => (
    <div className="border border-[#E2E6E9] rounded px-2 py-1 bg-white">
      <div className="text-[10px] text-[#5A6A74]">{etq}</div>
      <div className="font-semibold"><span className="text-[#5A6A74]">{a}</span> → <span className={mejor == null ? '' : mejor ? 'text-[#2B7F52]' : 'text-red-600'}>{b}</span></div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] bg-black/30 flex items-center justify-center p-4" onClick={onCerrar}>
      <div className="bg-[#F4F4F4] border border-[#9A9A9A] shadow-2xl w-[1100px] max-w-full max-h-[94vh] flex flex-col text-[11.5px] text-[#14212A]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#E2E2E2] border-b border-[#B5B5B5]">
          <b>Level Crews</b>
          <button onClick={onCerrar} className="p-0.5 hover:bg-white rounded cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-3 flex flex-col gap-3 overflow-auto">
          {/* Conjunto */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">Activities:</span>
            <select value={f.subc} onChange={e => cambiarSubc(e.target.value)} className={sel} title="Subcontractor (11.SubC)">
              <option value="">Any subcontractor</option>
              {valores.subc.map(([v, n]) => <option key={v} value={v}>{v} ({n})</option>)}
            </select>
            <select value={f.scap} onChange={e => setF({ ...f, scap: e.target.value })} className={sel} title="SCAP (07.SCAP)">
              <option value="">Any SCAP</option>
              {valores.scap.map(([v, n]) => <option key={v} value={v}>{v} ({n})</option>)}
            </select>
            <select value={f.fase} onChange={e => setF({ ...f, fase: e.target.value as FaseUso | '' })} className={sel} title="Phase by activity name">
              {FASES.map(([k, etq]) => <option key={k} value={k}>{etq}</option>)}
            </select>
            <span className="text-[#5A6A74]">· structure</span>
            <select value={f.grupo} onChange={e => setF({ ...f, grupo: e.target.value as CampoAgrupacion })} className={sel} title="A crew installs a whole structure of this field continuously">
              {CAMPOS_AGRUPACION.map(c => <option key={c.k} value={c.k}>{c.etq}</option>)}
            </select>
            <span className="text-[#5A6A74]">· type</span>
            <select value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value as CampoAgrupacion })} className={sel} title="Within a structure, same type in a row">
              {CAMPOS_AGRUPACION.map(c => <option key={c.k} value={c.k}>{c.etq}</option>)}
            </select>
            <span className="text-[#5A6A74]">{conjunto.length} activities</span>
            {!conjunto.length && f.fase && (() => {
              // Sin actividades en la fase elegida: dice en qué fases sí tiene
              const n = fasesDeSubc(f.subc, f.scap);
              const hay = FASES.filter(([k]) => k && (n.get(k as FaseUso) ?? 0) > 0).map(([k, etq]) => `${etq} (${n.get(k as FaseUso)})`);
              return hay.length ? <span className="text-[#C9701E]">None in this phase; it has: {hay.join(', ')}</span> : null;
            })()}
            <button onClick={() => analizar()} disabled={ocupado || !conjunto.length}
              className="ml-auto px-3 py-1 rounded bg-[#312E81] text-white font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50">
              <Play className="w-3.5 h-3.5" /> {ocupado ? 'Analyzing…' : 'Analyze & find best'}
            </button>
          </div>
          {!res && !ocupado && (
            <div className="text-[#5A6A74] leading-relaxed">
              Removes the crew links between the selected activities (their external logic —freight, area release, end milestones— is kept),
              finds when each one can really start, and rebuilds the sequence with N crews that install a whole structure continuously,
              leveling the monthly Remaining Units within float. Priority 1 is total float: every activity must end with float ≥ 0, or at its own
              limit when its equipment arrives so late that not even unlimited crews could reach 0. Then it must not delay the set or the project,
              and among those options (1–8 crews, several monthly caps and levels of structure continuity) it keeps the flattest. Durations are never changed.
            </div>
          )}
          {res && graf && (
            <>
              {/* Hallazgos */}
              <div className="bg-white border border-[#E2E6E9] rounded p-2">
                <div className="font-semibold mb-1">Findings in the current logic</div>
                {res.d.hallazgos.length ? <ul className="list-disc pl-5 space-y-0.5">{res.d.hallazgos.map((h, k) => <li key={k}>{h}</li>)}</ul> : <div className="text-[#5A6A74]">No issues found.</div>}
              </div>
              {/* Opciones y métricas */}
              <div className="flex items-end gap-2 flex-wrap">
                <label className="flex flex-col gap-0.5"><span className="text-[10px] text-[#5A6A74]">Crews</span>
                  <input type="number" min={1} max={12} value={manual.n} onChange={e => setManual({ ...manual, n: Number(e.target.value) || 1 })} className={`${sel} w-16`} /></label>
                <label className="flex flex-col gap-0.5"><span className="text-[10px] text-[#5A6A74]">Monthly cap (units, empty = none)</span>
                  <input type="number" min={1} value={manual.tope} onChange={e => setManual({ ...manual, tope: e.target.value })} className={`${sel} w-28`} /></label>
                <button onClick={() => analizar({ n: manual.n, tope: manual.tope ? Number(manual.tope) : Infinity })} disabled={ocupado}
                  className="px-2 py-1 border border-[#B5B5B5] rounded bg-white hover:bg-[#F5F8F9] cursor-pointer">Recalculate</button>
                <span className="text-[#5A6A74] pb-1">{res.auto ? `Best found: ${res.auto.n} crews${isFinite(res.auto.tope) ? `, cap ${res.auto.tope}/month` : ''}` : ''}</span>
                {!res.vale
                  ? <span className="text-red-600 font-semibold pb-1">Not worth leveling: {res.manual ? 'this option does not finish' : 'no tested crew option finishes'} the set by {fCorta(res.d.antes.finConjunto)} (current logic) with a flatter monthly workload, without delaying the project or worsening float. Shown only for reference; it cannot be applied.</span>
                  : res.prop.deficit.length === 0
                  ? <span className="text-[#2B7F52] font-semibold pb-1">Float target met: every activity ≥ 0{res.d.limitantes.length ? `, except ${res.d.limitantes.length} that arrive too late (at their limit)` : ''}.</span>
                  : <span className="text-red-600 font-semibold pb-1">{res.prop.deficit.length} activities stay below their float target{res.alcanzado ? '' : ' (best reachable by resequencing)'}: {res.prop.deficit.slice(0, 6).map(cod).join(', ')}{res.prop.deficit.length > 6 ? '…' : ''}</span>}
              </div>
              <div className="grid grid-cols-6 gap-2">
                {metrica('Peak month (units)', graf.pa.pico.toFixed(1), graf.pb.pico.toFixed(1), graf.pb.pico < graf.pa.pico - 0.05 ? true : graf.pb.pico > graf.pa.pico + 0.05 ? false : null)}
                {metrica('Std. dev. (units/month)', graf.pa.desv.toFixed(1), graf.pb.desv.toFixed(1), graf.pb.desv < graf.pa.desv - 0.05 ? true : graf.pb.desv > graf.pa.desv + 0.05 ? false : null)}
                {metrica('Set finish', fCorta(res.d.antes.finConjunto), fCorta(res.prop.despues.finConjunto), res.prop.despues.finConjunto < res.d.antes.finConjunto ? true : res.prop.despues.finConjunto > res.d.antes.finConjunto ? false : null)}
                {(() => { const neg = (h: Map<number, number | null>) => [...h.values()].filter(v => v != null && v < -240).length; const a = neg(res.d.antes.holgura), b = neg(res.prop.despues.holgura); return metrica('Activities with TF < 0', String(a), String(b), b < a ? true : b > a ? false : null); })()}
                {metrica('Worst total float', tfTxt(peorHolgura(res.d.antes)), tfTxt(peorHolgura(res.prop.despues)), peorHolgura(res.prop.despues) > peorHolgura(res.d.antes) ? true : peorHolgura(res.prop.despues) < peorHolgura(res.d.antes) ? false : null)}
                {metrica('Project finish', fCorta(res.d.antes.finProyecto), fCorta(res.prop.despues.finProyecto), res.prop.despues.finProyecto < res.d.antes.finProyecto ? true : res.prop.despues.finProyecto > res.d.antes.finProyecto ? false : null)}
              </div>
              {res.d.limitantes.length > 0 && (
                <div className="bg-[#FFF8E6] border border-[#F0D48A] rounded p-2">
                  <div className="font-semibold mb-1">Cannot reach zero float just by resequencing (even with unlimited crews, starting the day the equipment arrives) — only a shorter duration or an earlier arrival would help:</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10.5px]">
                    {res.d.limitantes.map(l => (
                      <div key={l.i} className="cursor-pointer hover:underline" onClick={() => onIr(l.i)}>
                        <span className="font-mono">{cod(l.i)}</span> · limit <b className="text-red-600">{diasDe(l.i, l.holgura)}d</b>
                        {l.motivo != null && <span className="text-[#5A6A74]"> · waits for <span className="font-mono">{cod(l.motivo)}</span> {celda(t, t.filas[l.motivo], 'task_name').slice(0, 38)} (start {fCorta(l.inicio)})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Histograma */}
              <Histograma a={graf.a} b={graf.b} lim={lim} />
              {/* Cuadrillas */}
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(3, res.prop.secuencias.length)}, minmax(0, 1fr))` }}>
                {res.prop.secuencias.map((s, k) => (
                  <div key={k} className="bg-white border border-[#E2E6E9] rounded">
                    <div className="px-2 py-1 bg-[#EEF0FB] font-semibold border-b border-[#E2E6E9]">Crew {k + 1} · {s.length} activities · {fCorta(s[0]?.ini)} → {fCorta(s[s.length - 1]?.fin)}</div>
                    <table className="w-full text-[10.5px]">
                      <tbody>
                        {s.map((x, n) => {
                          const g = campo(x.i, f.grupo);
                          const nuevoGrupo = n === 0 || campo(s[n - 1].i, f.grupo) !== g;
                          return (
                            <React.Fragment key={x.i}>
                              {nuevoGrupo && <tr><td colSpan={4} className="px-2 pt-1 font-semibold text-[#312E81]">{g || '(no structure)'}</td></tr>}
                              <tr className="hover:bg-[#F5F8F9] cursor-pointer" onClick={() => onIr(x.i)} title={celda(t, t.filas[x.i], 'task_name')}>
                                <td className="pl-3 pr-1 whitespace-nowrap">{fCorta(x.ini)}</td>
                                <td className="px-1 font-mono">{cod(x.i)}</td>
                                <td className="px-1 truncate max-w-[120px]">{campo(x.i, f.tipo)}</td>
                                <td className="px-1 text-right whitespace-nowrap" title="Total float before → after (days)">{diasDe(x.i, res.d.antes.holgura.get(x.i))} → {diasDe(x.i, res.prop.despues.holgura.get(x.i))}</td>
                              </tr>
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
              {/* Enlaces */}
              <div className="bg-white border border-[#E2E6E9] rounded p-2">
                <button onClick={() => setVerEnlaces(v => !v)} className="font-semibold cursor-pointer underline decoration-dotted">
                  Logic changes: remove {res.prop.quitar.length} crew links · add {res.prop.agregar.filter(r => r.motivo === 'crew').length} ({res.prop.agregar.filter(r => r.lag > 0).length} with lag for leveling)
                  {res.prop.agregar.some(r => r.motivo === 'close') ? ` · close ${res.prop.agregar.filter(r => r.motivo === 'close').length} open ends` : ''}
                  {res.prop.omitidos.length ? ` · ${res.prop.omitidos.length} skipped (would create a loop)` : ''}
                </button>
                {res.prop.abiertas.length > 0 && <div className="text-red-600 mt-1">Still without successor: {res.prop.abiertas.map(cod).join(', ')}</div>}
                {verEnlaces && (
                  <div className="grid grid-cols-2 gap-3 mt-2 text-[10.5px] max-h-56 overflow-auto">
                    <div>
                      <div className="font-semibold text-red-700">Removed</div>
                      {res.prop.quitar.map(k => { const p = m.pred, fl = p.filas[k]; const a = m.porId.get(celda(p, fl, 'pred_task_id')), b = m.porId.get(celda(p, fl, 'task_id')); return <div key={k} className="font-mono">{a !== undefined ? cod(a) : '?'} → {b !== undefined ? cod(b) : '?'} {celda(p, fl, 'pred_type').replace('PR_', '')}{Number(celda(p, fl, 'lag_hr_cnt')) ? ` ${celda(p, fl, 'lag_hr_cnt')}h` : ''}</div>; })}
                    </div>
                    <div>
                      <div className="font-semibold text-[#2B7F52]">Added</div>
                      {res.prop.agregar.map((r, k) => <div key={k} className="font-mono">{cod(r.pred)} → {cod(r.succ)} {r.tipo}{r.lag ? ` +${diasDe(r.pred, r.lag)}d` : ''}{r.motivo === 'close' ? ' (close open end)' : ''}</div>)}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-[#C3C3C3] bg-[#ECECEC]">
          {res && !editable && <span className="text-[#5A6A74] mr-auto">Only the administrator can apply the new logic.</span>}
          {res && editable && <span className="text-[#5A6A74] mr-auto">Applying changes the relationships and reschedules (F9). Nothing is stored until you press Save.</span>}
          <button onClick={onCerrar} className="px-3 py-1 border border-[#B5B5B5] rounded bg-white hover:bg-[#F5F8F9] cursor-pointer">Close</button>
          {editable && (
            <button disabled={!res || ocupado || !res.vale} title={res && !res.vale ? 'Leveling would not finish earlier or would worsen float' : undefined} onClick={() => res && onAplicar(res.prop, `${res.prop.cuadrillas} crews · peak ${graf?.pa.pico.toFixed(1)} → ${graf?.pb.pico.toFixed(1)} units/month`)}
              className="px-3 py-1 rounded bg-[#2B7F52] text-white font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50">
              <Check className="w-3.5 h-3.5" /> Apply new logic
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/** Barras mensuales: actual (gris) y propuesta (índigo). */
const Histograma: React.FC<{ a: Float64Array; b: Float64Array; lim: number[] }> = ({ a, b, lim }) => {
  const n = a.length;
  const max = Math.max(1, ...a, ...b);
  const ancho = 1060, alto = 150, pie = 18, cab = 14;
  const w = (ancho - 30) / Math.max(1, n);
  const y = (v: number) => cab + (alto - pie - cab) * (1 - v / max);
  return (
    <div className="bg-white border border-[#E2E6E9] rounded p-2">
      <div className="flex items-center gap-3 mb-1">
        <span className="font-semibold">Remaining Units per month</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-[#B8C0C6]" /> Current logic</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-[#312E81]" /> Proposed</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${ancho} ${alto}`} className="block">
        {Array.from({ length: n }, (_, k) => {
          const x = 30 + k * w, bw = Math.min(26, (w - 6) / 2);
          const d = new Date(lim[k] * 60000);
          return (
            <g key={k}>
              <rect x={x + w / 2 - bw - 1} y={y(a[k])} width={bw} height={Math.max(0, alto - pie - y(a[k]))} fill="#B8C0C6" />
              <rect x={x + w / 2 + 1} y={y(b[k])} width={bw} height={Math.max(0, alto - pie - y(b[k]))} fill="#312E81" />
              {a[k] > 0.05 && <text x={x + w / 2 - bw / 2 - 1} y={y(a[k]) - 2} fontSize="9" textAnchor="middle" fill="#5A6A74">{a[k].toFixed(1)}</text>}
              {b[k] > 0.05 && <text x={x + w / 2 + bw / 2 + 1} y={y(b[k]) - 2} fontSize="9" textAnchor="middle" fill="#312E81" fontWeight="bold">{b[k].toFixed(1)}</text>}
              <text x={x + w / 2} y={alto - 4} fontSize="10" textAnchor="middle" fill="#14212A">{MES[d.getUTCMonth()]} {String(d.getUTCFullYear()).slice(2)}</text>
            </g>
          );
        })}
        <line x1={28} x2={ancho} y1={alto - pie} y2={alto - pie} stroke="#9AA6AD" />
      </svg>
    </div>
  );
};
