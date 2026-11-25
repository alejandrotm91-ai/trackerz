/**
 * Ventana «Arrivals» de T₃: llegadas de equipos a obra de la matriz semanal de importación frente a las
 * actividades de flete (.E) del XER (ver `utils/p6/llegadas.ts` y `utils/p6/matrizLlegadas.ts`).
 * La matriz la sube el admin y queda en la nube para todos (documento `p6_matriz_llegadas`). El admin aplica
 * los cambios propuestos (duraciones de la procura .D y del flete .E) como cambios sin guardar + F9.
 */
import React from 'react';
import * as XLSX from 'xlsx';
import { ChevronDown, ChevronRight, Download, Ship, Upload, X } from 'lucide-react';
import type { ModeloP6 } from '../../utils/p6/modelo';
import { calcularLlegadas, type CambioLlegada, type FilaLlegada, type TipoLlegada } from '../../utils/p6/llegadas';
import { leerMatrizLlegadas, type MatrizLlegadas, type EstadoImportacion } from '../../utils/p6/matrizLlegadas';
import { apiFetch } from '../../utils/api';

const DOC = '/api/docs/p6_matriz_llegadas';
const MES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fP6 = (s: string | null | undefined) => (s ? `${s.slice(8, 10)}-${MES[Number(s.slice(5, 7)) - 1]}-${s.slice(2, 4)}` : '—');
const ESTADO: Record<string, string> = { TK_NotStart: 'Not Started', TK_Active: 'In Progress', TK_Complete: 'Completed' };
const CAT: Record<EstadoImportacion, { t: string; bg: string; fg: string; borde?: string }> = {
  zarpado: { t: 'Shipped', bg: '#2F7D32', fg: '#FFFFFF' },
  por_zarpar: { t: 'Arriving soon', bg: '#A9D89A', fg: '#14212A' },
  lejos: { t: 'Far from arriving', bg: '#FFFFFF', fg: '#14212A', borde: '#B8C0C6' },
  otro: { t: 'Other colour', bg: '#B8B0C9', fg: '#14212A' },
};
const CLASE_COLOR: Record<string, string> = { Gap: 'text-red-700', Review: 'text-[#C9701E]', Close: 'text-emerald-700' };
const dias = (h: number, hd: number) => +(h / hd).toFixed(1);
const textoCambio = (c: CambioLlegada) => `${c.cod} ${c.campo === 'durOriginal' ? 'Orig' : 'Rem'} ${dias(c.antesH, c.horasDia)} → ${dias(c.nuevoH, c.horasDia)} d`;

function libro(filas: FilaLlegada[], sinPareja: { lado: string; partida: string; detalle: string; aw: string | null }[]): Uint8Array {
  const wb = XLSX.utils.book_new();
  const cab = ['SubC (T₃)', 'Partida', 'Freight (.E)', 'Supplier (matrix)', 'Package', 'Matrix status', 'T₃ status', 'Shipments', 'First AW', 'Last AW', 'Shipment (AR)', 'Finish T₃', 'Δ days', 'Class', 'TF (d)', 'Proposed changes', 'Notes', 'Type'];
  const tipo: Record<TipoLlegada, string> = { cambio: 'Change', cercana: 'Close', llegada: 'Arrived – confirm', completada: 'Completed' };
  const datos = [...filas].sort((x, y) => (x.subc || '~').localeCompare(y.subc || '~', 'es')).map(f => [
    f.subc || '', f.partida, f.acts.map(a => a.cod).join(', '), f.fab, f.paq, CAT[f.cat].t, [...new Set(f.acts.map(a => ESTADO[a.estado] || a.estado))].join(', '),
    f.envios, f.awPrimera, f.aw, f.ar || '', f.finT3, f.delta, f.clase,
    Math.min(...f.acts.map(a => a.tfDias ?? Infinity)) === Infinity ? '' : +Math.min(...f.acts.map(a => a.tfDias ?? Infinity)).toFixed(1),
    f.cambios.map(textoCambio).join(' · '), f.avisos.join(' · '), tipo[f.tipo],
  ]);
  const ws = XLSX.utils.aoa_to_sheet([cab, ...datos]);
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: datos.length, c: cab.length - 1 } }) };
  ws['!cols'] = cab.map(h => ({ wch: Math.max(10, Math.min(50, h.length + 6)) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Arrivals');
  const ws2 = XLSX.utils.aoa_to_sheet([['Side', 'Key', 'Detail', 'Last AW'], ...sinPareja.map(s => [s.lado === 'matrix' ? 'Matrix only' : 'T₃ only', s.partida, s.detalle, s.aw || ''])]);
  XLSX.utils.book_append_sheet(wb, ws2, 'Unmatched');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
}

export const DialogoLlegadas: React.FC<{
  m: ModeloP6;
  editable: boolean;
  version: number;
  onIr: (i: number) => void;
  onCerrar: () => void;
  onAplicar: (cambios: CambioLlegada[], partidas: number) => void;
}> = ({ m, editable, version, onIr, onCerrar, onAplicar }) => {
  const [matriz, setMatriz] = React.useState<MatrizLlegadas | null>(null);
  const [estado, setEstado] = React.useState<string>('Loading the matrix from the cloud…');
  const [archivo, setArchivo] = React.useState<{ buf: ArrayBuffer; nombre: string } | null>(null);
  React.useEffect(() => {
    let vivo = true;
    apiFetch(DOC, { cache: 'no-store' }, [404]).then(async r => {
      if (!vivo) return;
      if (r.status === 404) { setEstado('No matrix in the cloud yet.'); return; }
      setMatriz(await r.json()); setEstado('');
    }).catch(e => vivo && setEstado(`Could not read the matrix: ${e?.message || e}`));
    return () => { vivo = false; };
  }, []);

  const cargar = async (buf: ArrayBuffer, nombre: string, hoja?: string) => {
    setEstado('Reading the matrix…');
    try {
      const mz = await leerMatrizLlegadas(buf, nombre, hoja);
      setArchivo({ buf, nombre });
      setMatriz(mz);
      setEstado('Saving the matrix in the cloud…');
      await apiFetch(DOC, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mz) });
      setEstado('');
    } catch (e) {
      setEstado(`Error: ${(e as Error)?.message || e}`);
    }
  };

  const res = React.useMemo(() => (matriz ? calcularLlegadas(m, matriz.filas) : null), [m, matriz, version]);
  type Pestana = 'gap' | 'review' | TipoLlegada | 'sinPareja';
  const [tab, setTab] = React.useState<Pestana>('gap');
  const [quitadas, setQuitadas] = React.useState<Set<string>>(new Set());
  const [plegados, setPlegados] = React.useState<Set<string>>(new Set());
  const filasDe = (k: Pestana): FilaLlegada[] => {
    if (!res || k === 'sinPareja') return [];
    if (k === 'gap') return res.filas.filter(f => f.tipo === 'cambio' && f.clase === 'Gap');
    if (k === 'review') return res.filas.filter(f => f.tipo === 'cambio' && f.clase === 'Review');
    return res.filas.filter(f => f.tipo === k);
  };
  const conCambiosDe = (k: Pestana) => filasDe(k).filter(f => f.cambios.length);
  const elegidasDe = (k: Pestana) => conCambiosDe(k).filter(f => !quitadas.has(f.clave));
  const deCambios = tab === 'gap' || tab === 'review';
  const lista = filasDe(tab);
  const conCambios = conCambiosDe(tab);
  const elegidas = elegidasDe(tab);
  // Agrupación por el subcontratista del cronograma (11.SubC de la .E)
  const SIN_SUBC = '(no SubC)';
  const grupos = React.useMemo(() => {
    const g = new Map<string, FilaLlegada[]>();
    for (const f of lista) { const k = f.subc || SIN_SUBC; if (!g.has(k)) g.set(k, []); g.get(k)!.push(f); }
    return [...g.entries()].sort(([a], [b]) => (a === SIN_SUBC ? 1 : b === SIN_SUBC ? -1 : a.localeCompare(b, 'es')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res, tab]);
  const alternarSel = (fs: FilaLlegada[], marcar: boolean) => setQuitadas(q => { const n = new Set(q); fs.filter(f => f.cambios.length).forEach(f => (marcar ? n.delete(f.clave) : n.add(f.clave))); return n; });
  const exportar = () => {
    if (!res) return;
    const url = URL.createObjectURL(new Blob([libro(res.filas, res.sinPareja)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a'); a.href = url; a.download = `Arrivals_vs_T3_${new Date().toISOString().slice(0, 10)}.xlsx`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const th = 'px-2 py-1 text-left font-semibold text-[#5A6A74] bg-[#F5F8F9] sticky top-0 border-b border-[#D5DEE2] whitespace-nowrap';
  const td = 'px-2 py-1 border-b border-[#EEF2F3] whitespace-nowrap align-top';
  const tabs: [Pestana, string][] = [
    ['gap', `Gap > 30 d · ${elegidasDe('gap').length}/${conCambiosDe('gap').length}`],
    ['review', `Review 8–30 d · ${elegidasDe('review').length}/${conCambiosDe('review').length}`],
    ['cercana', `Close (|Δ| ≤ 7) · ${filasDe('cercana').length}`],
    ['llegada', `Arrived – confirm · ${filasDe('llegada').length}`],
    ['completada', `Completed · ${filasDe('completada').length}`],
    ['sinPareja', `Unmatched · matrix ${res?.sinPareja.filter(x => x.lado === 'matrix').length ?? 0} · T₃ ${res?.sinPareja.filter(x => x.lado === 'T3').length ?? 0}`],
  ];
  const ayudaCambio = 'Pending freight with |Δ| > 7 days: the procurement .D (In Progress) ends on the shipment date (AR) and the freight .E lasts from the shipment (or the Data Date) to the end of the arrival day (AW), in its calendar. At least 1 day. Not-started .D are not changed.';
  const ayuda: Record<string, string> = {
    gap: `${ayudaCambio} Each tab is applied on its own.`,
    review: `${ayudaCambio} Each tab is applied on its own.`,
    cercana: 'Finish of the freight in T₃ within 7 days of the matrix arrival: nothing to change.',
    llegada: 'The matrix arrival (AW) is on or before the Data Date and the freight is not finished in T₃: confirm on site and update it with the Cut. Not changed here.',
    completada: 'Freight already finished in T₃: never changed. Flagged if the matrix still shows it as not arrived.',
    sinPareja: 'Keys without a pair: matrix items with no .E whose «32. Variacion» matches, and pending .E in T₃ that are not in the matrix. Fix the coding at the source.',
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/30 flex items-center justify-center p-4" onClick={onCerrar}>
      <div id="p6-llegadas-dialogo" className="bg-white rounded-xl shadow-2xl w-full max-w-[1350px] max-h-[90vh] flex flex-col text-xs text-[#14212A]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#D5DEE2]">
          <Ship className="w-4 h-4 text-[#312E81]" />
          <b className="text-sm">Equipment Arrivals</b>
          <span className="text-[#5A6A74]">Weekly import matrix (arrival on site, column AW) against the freight activities (.E) of T₃ · key: Partida (G) = «32. Variacion»</span>
          <button onClick={onCerrar} className="ml-auto p-1 hover:bg-[#F5F8F9] rounded cursor-pointer" title="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-4 py-2 flex items-center gap-3 flex-wrap border-b border-[#EEF2F3]">
          {matriz ? (
            <span>
              <b>{matriz.archivo}</b> · sheet <b>{matriz.hoja}</b> · loaded {fP6(matriz.cargada.slice(0, 10))} {matriz.cargada.slice(11, 16)}
              {res && <> · Data Date {fP6(res.fechaDatos)} · excluded: pipes/sheet piles {res.excluidas.tuberias}, valves {res.excluidas.valvulas}, no AW {res.excluidas.sinAw}</>}
            </span>
          ) : <span className="text-[#5A6A74]">No matrix loaded.</span>}
          {archivo && matriz && matriz.hojas.length > 1 && (
            <select value={matriz.hoja} onChange={e => cargar(archivo.buf, archivo.nombre, e.target.value)} className="border border-[#D5DEE2] rounded px-1.5 py-1">
              {matriz.hojas.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          )}
          {editable && (
            <label id="p6-llegadas-cargar" className="ml-auto px-3 py-1.5 border border-[#D5DEE2] rounded-lg hover:bg-[#F5F8F9] cursor-pointer flex items-center gap-1"
              title="Load the weekly matrix (.xlsx). It is saved in the cloud for everyone.">
              <Upload className="w-3.5 h-3.5" /> Load matrix (.xlsx)
              <input type="file" accept=".xlsx" className="hidden" onChange={async e => {
                const f = e.target.files?.[0]; e.target.value = '';
                if (f) await cargar(await f.arrayBuffer(), f.name);
              }} />
            </label>
          )}
          {estado && <span className="text-[#C9701E] font-semibold">{estado}</span>}
        </div>
        {res && (
          <>
            <div className="px-4 pt-2 flex items-end gap-1 flex-wrap">
              {tabs.map(([k, etq]) => (
                <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-t-lg border border-b-0 font-semibold cursor-pointer ${tab === k ? 'bg-white border-[#D5DEE2] text-[#312E81]' : 'bg-[#F5F8F9] border-transparent text-[#5A6A74]'}`}>{etq}</button>
              ))}
              <span className="ml-3 mb-1 text-[#5A6A74] max-w-[620px]">{ayuda[tab]}</span>
            </div>
            <div className="mx-4 border border-[#D5DEE2] rounded-b-lg rounded-tr-lg overflow-auto flex-1 min-h-[220px]">
              {tab === 'sinPareja' ? (
                <table className="w-full border-collapse">
                  <thead><tr><th className={th}>Side</th><th className={th}>Key</th><th className={th}>Detail</th><th className={th}>Last AW</th></tr></thead>
                  <tbody>
                    {res.sinPareja.map(s => (
                      <tr key={`${s.lado}:${s.clave}`}><td className={td}>{s.lado === 'matrix' ? 'Matrix only' : 'T₃ only'}</td><td className={`${td} font-mono`}>{s.partida}</td><td className={td}>{s.detalle}</td><td className={td}>{fP6(s.aw)}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full border-collapse">
                  <thead><tr>
                    {deCambios && <th className={th}><input type="checkbox" checked={conCambios.length > 0 && conCambios.every(f => !quitadas.has(f.clave))}
                      onChange={e => alternarSel(conCambios, e.target.checked)} /></th>}
                    <th className={th}>Partida</th><th className={th}>Freight (.E)</th><th className={th}>Supplier (matrix)</th><th className={th}>Matrix</th><th className={th}>T₃</th>
                    <th className={th} title="Number of shipments of the item in the matrix; the last one is compared">Ship.</th>
                    <th className={th}>Shipment (AR)</th><th className={th}>Arrival (AW)</th><th className={th}>Finish T₃</th>
                    <th className={`${th} text-right`} title="Finish in T₃ − last AW (calendar days; negative = T₃ earlier than the matrix)">Δ d</th><th className={th}>Class</th>
                    <th className={`${th} text-right`}>TF (d)</th>
                    {deCambios && <th className={th}>Proposed changes</th>}
                    <th className={th}>Notes</th>
                  </tr></thead>
                  <tbody>
                    {grupos.map(([sub, fs]) => { const abierto = !plegados.has(sub); const cc = fs.filter(f => f.cambios.length); return (<React.Fragment key={sub}>
                      <tr className="bg-[#E8EAF6] cursor-pointer select-none" onClick={() => setPlegados(p => { const n = new Set(p); if (n.has(sub)) n.delete(sub); else n.add(sub); return n; })}>
                        {deCambios && <td className={td} onClick={e => e.stopPropagation()}><input type="checkbox" disabled={!cc.length} checked={cc.length > 0 && cc.every(f => !quitadas.has(f.clave))} onChange={e => alternarSel(cc, e.target.checked)} title="Select the whole subcontractor" /></td>}
                        <td colSpan={deCambios ? 14 : 13} className="px-2 py-1 border-b border-[#D5DEE2] font-bold text-[#312E81]">
                          {abierto ? <ChevronDown className="inline w-3.5 h-3.5 mr-1" /> : <ChevronRight className="inline w-3.5 h-3.5 mr-1" />}
                          SubC: {sub} <span className="font-normal text-[#5A6A74]">· {fs.length} item{fs.length === 1 ? '' : 's'}{deCambios ? ` · ${cc.filter(f => !quitadas.has(f.clave)).length} selected` : ''}</span>
                        </td>
                      </tr>
                      {abierto && fs.map(f => {
                      const tf = Math.min(...f.acts.map(a => a.tfDias ?? Infinity));
                      const c = CAT[f.cat];
                      const sinCambios = deCambios && !f.cambios.length;
                      return (
                        <tr key={f.clave} className={sinCambios ? 'text-[#9AA6AD] bg-[#FAFBFB]' : ''}>
                          {deCambios && <td className={td}><input type="checkbox" disabled={sinCambios} checked={!sinCambios && !quitadas.has(f.clave)}
                            onChange={() => setQuitadas(q => { const n = new Set(q); if (n.has(f.clave)) n.delete(f.clave); else n.add(f.clave); return n; })} /></td>}
                          <td className={`${td} font-mono`} title={f.eq}>{f.partida}</td>
                          <td className={`${td} font-mono`}>{f.acts.map(a => (
                            <button key={a.cod} onClick={() => onIr(a.i)} className="block text-[#312E81] hover:underline cursor-pointer" title={a.nombre}>{a.cod}</button>
                          ))}</td>
                          <td className={`${td} max-w-[150px] truncate`} title={`${f.fab} · ${f.paq}`}>{f.fab || '—'}</td>
                          <td className={td}><span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: c.bg, color: c.fg, border: `1px solid ${c.borde || c.bg}` }}>{c.t}</span></td>
                          <td className={td}>{[...new Set(f.acts.map(a => ESTADO[a.estado] || a.estado))].join(', ')}</td>
                          <td className={td} title={f.envios > 1 ? `First arrival ${fP6(f.awPrimera)}` : ''}>{f.envios}</td>
                          <td className={td}>{fP6(f.ar)}</td>
                          <td className={`${td} font-semibold`}>{fP6(f.aw)}</td>
                          <td className={td}>{fP6(f.finT3)}</td>
                          <td className={`${td} text-right font-semibold ${CLASE_COLOR[f.clase]}`}>{f.delta > 0 ? `+${f.delta}` : f.delta}</td>
                          <td className={`${td} ${CLASE_COLOR[f.clase]}`}>{f.clase}</td>
                          <td className={`${td} text-right ${tf <= 0 ? 'text-red-700 font-semibold' : ''}`}>{tf === Infinity ? '—' : tf.toFixed(0)}</td>
                          {deCambios && <td className={td}>{f.cambios.map(x => (
                            <div key={`${x.cod}:${x.campo}`} title={x.nota}><span className="font-mono">{x.cod}</span> {x.campo === 'durOriginal' ? 'Orig' : 'Rem'} {dias(x.antesH, x.horasDia)} → <b>{dias(x.nuevoH, x.horasDia)} d</b> <span className="text-[#5A6A74]">({x.nota})</span></div>
                          ))}{!f.cambios.length && 'Nothing to change'}</td>}
                          <td className={`${td} text-[#C9701E] whitespace-normal min-w-[180px]`}>{f.avisos.join(' · ')}</td>
                        </tr>
                      );
                    })}
                    </React.Fragment>); })}
                    {!lista.length && <tr><td colSpan={16} className="px-3 py-6 text-center text-[#5A6A74]">Nothing here.</td></tr>}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
        <div className="px-4 py-2.5 flex items-center gap-2 border-t border-[#D5DEE2] mt-2">
          <span className="text-[#5A6A74]">Valves, pipes and sheet piles are left out. After applying: review, Save → Export XER → Primavera.</span>
          <button onClick={exportar} disabled={!res} className="ml-auto px-3 py-1.5 border border-[#D5DEE2] rounded-lg hover:bg-[#F5F8F9] cursor-pointer flex items-center gap-1 disabled:opacity-50"
            title="Excel with every compared item and the unmatched keys"><Download className="w-3.5 h-3.5" /> Export Excel</button>
          {editable && (
            <button id="p6-llegadas-aplicar" disabled={!deCambios || !elegidas.length} onClick={() => onAplicar(elegidas.flatMap(f => f.cambios), elegidas.length)}
              className="px-3 py-1.5 rounded-lg bg-[#312E81] text-white font-bold cursor-pointer disabled:opacity-50"
              title="Set the new durations as unsaved changes, then reschedule (F9). Review and press Save.">
              Apply {elegidas.length} items of this tab + F9
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
