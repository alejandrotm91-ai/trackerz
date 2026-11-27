/**
 * Ventana «Cut» de T₃: corte de obra / cierre de actividades (ver `utils/p6/corte.ts`).
 * Muestra lo que se inicia (pestaña NotStarted) y lo que se cierra (DEF_100) con la ejecución semanal
 * del Master y el estado del XER; exporta el Excel de la especificación y el admin lo aplica como
 * cambios sin guardar (nueva fecha de datos + fechas reales + F9), que luego se guardan con Save y se
 * exportan a Primavera.
 */
import React from 'react';
import * as XLSX from 'xlsx';
import { Download, Scissors, X } from 'lucide-react';
import type { Actividad } from '../../types';
import type { ModeloP6 } from '../../utils/p6/modelo';
import type { Clasificacion } from '../../utils/p6/vistaEjecucion';
import { calcularCorte, type FilaCorte } from '../../utils/p6/corte';
import { calcularCostos, type FilaCosto } from '../../utils/p6/costoReal';
import type { MasterCdoItem } from '../../types/masterCdo';

const MES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** «AAAA-MM-DD[ HH:MM]» → «dd-MMM-yy[ HH:MM]» (formato de P6). */
const fP6 = (s: string | null) => (s ? `${s.slice(8, 10)}-${MES[Number(s.slice(5, 7)) - 1]}-${s.slice(2, 4)}${s.length > 10 ? ` ${s.slice(11, 16)}` : ''}` : '—');
const ESTADO: Record<string, string> = { TK_NotStart: 'Not Started', TK_Active: 'In Progress', TK_Complete: 'Completed' };

/** Serie de Excel (base 30/12/1899) de «AAAA-MM-DD[ HH:MM]», sin zona horaria. */
function serie(s: string | null): number | null {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  const h = s.length > 10 ? Number(s.slice(11, 13)) : 0, mi = s.length > 10 ? Number(s.slice(14, 16)) : 0;
  return (Date.UTC(y, m - 1, d, h, mi) - Date.UTC(1899, 11, 30)) / 86400000;
}
const letra = (c: number) => XLSX.utils.encode_col(c);

/** Libro con las pestañas NotStarted y DEF_100 de la especificación (cabecera con filtros y fila 1 inmovilizada). */
function libroCorte(iniciar: FilaCorte[], cerrar: FilaCorte[], semana0: string | null): Uint8Array {
  // Columna V- de una semana: las semanas van en pares C-/V- desde AU (V- de la primera en AV), una por semana
  const colV = (dom: string | null) => {
    if (!dom || !semana0) return '';
    const k = Math.round((serie(dom)! - serie(semana0)!) / 7);
    return k >= 0 ? letra(47 + 2 * k) : '';
  };
  const cabSemana = (dom: string | null) => (dom ? `V-${dom.slice(8, 10)}-${MES[Number(dom.slice(5, 7)) - 1].toLowerCase()}-${dom.slice(2, 4)}` : '');
  const FECHA = 'dd/mm/yyyy', FECHA_HORA = 'dd/mm/yyyy hh:mm AM/PM';
  type Celda = string | number | null | { n: number | null; z: string };
  const hoja = (cab: string[], filas: Celda[][]) => {
    const ws = XLSX.utils.aoa_to_sheet([cab]);
    filas.forEach((fila, r) => fila.forEach((v, c) => {
      const ref = XLSX.utils.encode_cell({ r: r + 1, c });
      if (v == null || v === '') return;
      if (typeof v === 'object') { if (v.n != null) ws[ref] = { t: 'n', v: v.n, z: v.z }; return; }
      ws[ref] = typeof v === 'number' ? { t: 'n', v } : { t: 's', v };
    }));
    const rango = { s: { r: 0, c: 0 }, e: { r: filas.length, c: cab.length - 1 } };
    ws['!ref'] = XLSX.utils.encode_range(rango);
    ws['!autofilter'] = { ref: XLSX.utils.encode_range(rango) };
    ws['!cols'] = cab.map(h => ({ wch: Math.max(10, Math.min(48, h.length + 4)) }));
    return ws;
  };
  const d = (s: string | null, z = FECHA) => ({ n: serie(s), z });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, hoja(
    ['Fila', 'WBS', 'Activity ID', 'Activity Name', 'Status P6', 'Start P6', 'Venta Ex', 'Columna 1ª ejec.', 'Semana (fila 2)', 'Fecha semana', 'Fecha inicio (+1 día)', 'Fecha Fin +4d'],
    iniciar.map(f => [f.filaExcel, f.wbs, f.cod, f.nombre, f.estadoMaster, d(f.startP6), { n: f.ventaEx, z: '#,##0.00' }, colV(f.primera), cabSemana(f.primera), d(f.primera), d(f.inicioReal, FECHA_HORA), d(f.finReal, FECHA_HORA)]),
  ), 'NotStarted');
  XLSX.utils.book_append_sheet(wb, hoja(
    ['Fila', 'WBS', 'Activity ID', 'Paquete', 'Activity Name', 'SubC', 'Status P6', '% Ex (AP)', 'Venta Ex', 'Start P6', 'Finish P6', 'Última semana ejec.', 'Fecha Fin +4d'],
    cerrar.map(f => [f.filaExcel, f.wbs, f.cod, f.paquete, f.nombre, f.subc, f.estadoMaster, { n: f.pctEx, z: '0.0%' }, { n: f.ventaEx, z: '#,##0.00' }, d(f.startP6), d(f.finishP6), d(f.ultima), d(f.finReal, FECHA_HORA)]),
  ), 'DEF_100');
  // SheetJS no inmoviliza paneles: se añade el panel congelado (fila 1) al XML de cada hoja
  const zip = XLSX.CFB.read(new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })), { type: 'array' });
  const panel = '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>';
  zip.FullPaths.forEach((p, k) => {
    if (!/worksheets\/sheet\d+\.xml$/.test(p)) return;
    const xml = new TextDecoder().decode(zip.FileIndex[k].content as Uint8Array);
    const nuevo = /<sheetViews>[\s\S]*?<\/sheetViews>/.test(xml) ? xml.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/, panel) : xml.replace(/(<dimension[^>]*\/>)/, `$1${panel}`);
    zip.FileIndex[k].content = new TextEncoder().encode(nuevo);
  });
  return XLSX.CFB.write(zip, { fileType: 'zip', type: 'array' }) as Uint8Array;
}

export const DialogoCorte: React.FC<{
  m: ModeloP6; master: Actividad[]; clasif: Map<string, Clasificacion>; editable: boolean; version: number;
  /** Proyecto y fecha del corte para el nombre del archivo (p1126). */
  proyecto: string;
  onAplicar: (filas: FilaCorte[], fechaDatos: string) => void; onIr: (i: number) => void; onCerrar: () => void;
  /** Partidas de M₃ (Avance = Venta Ex por semana) y de dónde salen, para la pestaña «Actual Cost». */
  itemsM3: MasterCdoItem[]; fuenteM3: string; cargandoM3: boolean;
  onAplicarCostos: (filas: FilaCosto[]) => void;
}> = ({ m, master, clasif, editable, version, proyecto, onAplicar, onIr, onCerrar, itemsM3, fuenteM3, cargandoM3, onAplicarCostos }) => {
  const sugerida = React.useMemo(() => calcularCorte(m, master, clasif).fechaDatosSugerida, [m, master, clasif, version]);
  const [fecha, setFecha] = React.useState<string>(() => (sugerida ?? '').replace(' ', 'T'));
  const fechaDatos = fecha ? fecha.replace('T', ' ').slice(0, 16) : null;
  const corte = React.useMemo(() => calcularCorte(m, master, clasif, fechaDatos), [m, master, clasif, fechaDatos, version]);
  const [tab, setTab] = React.useState<'iniciar' | 'cerrar' | 'costo'>('iniciar');
  const costos = React.useMemo(() => calcularCostos(m, itemsM3), [m, itemsM3, version]);
  const [quitadosCosto, setQuitadosCosto] = React.useState<Set<string>>(new Set());
  const costosOk = costos.cambios.filter(f => f.ok);
  const costosElegidos = costosOk.filter(f => !quitadosCosto.has(f.cod));
  const dinero = (v: number | null) => (v == null ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const [quitadas, setQuitadas] = React.useState<Set<string>>(new Set());
  const clave = (f: FilaCorte) => `${f.accion}:${f.cod}`;
  const elegidas = [...corte.iniciar, ...corte.cerrar].filter(f => f.ok && !quitadas.has(clave(f)));
  const lista = tab === 'iniciar' ? corte.iniciar : tab === 'cerrar' ? corte.cerrar : [];
  const nOk = (l: FilaCorte[]) => l.filter(f => f.ok && !quitadas.has(clave(f))).length;
  const dd = new Date(m.fechaDatos * 60000).toISOString().slice(0, 16).replace('T', ' ');
  const atras = !!fechaDatos && fechaDatos < dd;
  const semana0 = React.useMemo(() => {
    let s: string | null = null;
    for (const a of master) for (const k of Object.keys((a as unknown as { certificacionesPorFecha?: Record<string, number> }).certificacionesPorFecha || {})) if (/^\d{4}-\d{2}-\d{2}$/.test(k) && (!s || k < s)) s = k;
    return s;
  }, [master]);
  const exportar = () => {
    const mmyy = fechaDatos ? `${fechaDatos.slice(5, 7)}${fechaDatos.slice(2, 4)}` : '';
    const nombre = `${/^p\d{4}$/i.test(proyecto) ? proyecto : `p${mmyy}`}_NotStarted_con_ejecucion.xlsx`;
    const datos = libroCorte(corte.iniciar, corte.cerrar, semana0);
    const url = URL.createObjectURL(new Blob([datos], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a'); a.href = url; a.download = nombre; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const th = 'px-2 py-1 text-left font-semibold text-[#5A6A74] bg-[#F5F8F9] sticky top-0 border-b border-[#D5DEE2] whitespace-nowrap';
  const td = 'px-2 py-1 border-b border-[#EEF2F3] whitespace-nowrap';
  return (
    <div className="fixed inset-0 z-[70] bg-black/30 flex items-center justify-center p-4" onClick={onCerrar}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[1250px] max-h-[90vh] flex flex-col text-xs text-[#14212A]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#D5DEE2]">
          <Scissors className="w-4 h-4 text-[#312E81]" />
          <b className="text-sm">Progress Cut</b>
          <span className="text-[#5A6A74]">Master weekly execution (Sunday–Saturday weeks) against the T₃ XER status</span>
          <button onClick={onCerrar} className="ml-auto p-1 hover:bg-[#F5F8F9] rounded cursor-pointer" title="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-4 py-2 flex items-center gap-3 flex-wrap border-b border-[#EEF2F3]">
          <label className="flex items-center gap-1.5">
            <span className="font-semibold">New Data Date</span>
            <input type="datetime-local" value={fecha} onChange={e => setFecha(e.target.value)} className="border border-[#D5DEE2] rounded px-1.5 py-1" />
          </label>
          <span className="text-[#5A6A74]">current {fP6(dd)} · last week with execution {fP6(corte.ultimaSemana)} (suggested: its Saturday 16:00, never before the current one)</span>
          {atras && <span className="text-red-600 font-semibold">Earlier than the current Data Date: choose a later one.</span>}
          <span className="text-[#5A6A74]">· already started in T₃: {corte.yaIniciadas} · already completed: {corte.yaCerradas}</span>
        </div>
        <div className="px-4 pt-2 flex items-center gap-1">
          {([['iniciar', `Start (NotStarted) · ${nOk(corte.iniciar)}/${corte.iniciar.length}`], ['cerrar', `Finish (DEF_100) · ${nOk(corte.cerrar)}/${corte.cerrar.length}`], ['costo', `Actual Cost · ${costosElegidos.length}/${costos.cambios.length}`]] as const).map(([k, etq]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-t-lg border border-b-0 font-semibold cursor-pointer ${tab === k ? 'bg-white border-[#D5DEE2] text-[#312E81]' : 'bg-[#F5F8F9] border-transparent text-[#5A6A74]'}`}>{etq}</button>
          ))}
          <span className="ml-3 text-[#5A6A74]">
            {tab === 'costo'
              ? `Actual Cost of the sales resource (V) ← Avance (Venta Ex) of M₃ by Activity ID; «p6» activities = SUMIF by column A (sum of their items). Source: ${cargandoM3 ? 'loading M₃…' : fuenteM3 || '—'} · M₃ total ${dinero(costos.totalM3)} · T₃ total ${dinero(costos.totalT3)} · equal ${costos.iguales} · not in M₃ ${costos.noEnM3} (untouched). Does not move the Data Date.`
              : tab === 'iniciar'
              ? 'Venta Ex > 0 and Not Started in T₃ → Actual Start = 1st week with execution + 1 day 08:00 (Physical % untouched); Remaining Duration = Original − working time from the Actual Start to the new Data Date (at least 1 day). If the 1st execution is not this year, also Actual Finish = last week + 4 days 16:00 with % = % Ex.'
              : '.D / .E with % Ex ≥ 99.5 % and .F with % Ex ≥ 95 %, In Progress in T₃ → Actual Finish = last week with execution + 4 days 16:00 and Physical % = % Ex.'}
          </span>
        </div>
        {tab === 'costo' ? (
        <div className="mx-4 border border-[#D5DEE2] rounded-b-lg rounded-tr-lg overflow-auto flex-1 min-h-[200px]">
          <table className="w-full border-collapse">
            <thead><tr>
              <th className={th}><input type="checkbox" checked={costosOk.length > 0 && costosOk.every(f => !quitadosCosto.has(f.cod))}
                onChange={e => setQuitadosCosto(q => { const n = new Set(q); costosOk.forEach(f => (e.target.checked ? n.delete(f.cod) : n.add(f.cod))); return n; })} /></th>
              <th className={th}>Activity ID</th><th className={th}>Activity Name</th><th className={th}>T₃</th>
              <th className={`${th} text-right`}>Actual Cost T₃</th><th className={`${th} text-right`}>Avance M₃ (Venta Ex)</th><th className={`${th} text-right`}>Δ</th>
              <th className={th} title="«p6» activities: SUMIF by column A over their items">p6 items</th><th className={th}>Note</th>
            </tr></thead>
            <tbody>
              {costos.cambios.map(f => (
                <tr key={f.cod} className={f.ok ? '' : 'text-[#9AA6AD] bg-[#FAFBFB]'}>
                  <td className={td}><input type="checkbox" disabled={!f.ok} checked={f.ok && !quitadosCosto.has(f.cod)}
                    onChange={() => setQuitadosCosto(q => { const n = new Set(q); if (n.has(f.cod)) n.delete(f.cod); else n.add(f.cod); return n; })} /></td>
                  <td className={`${td} font-mono`}><button onClick={() => onIr(f.i)} className="text-[#312E81] hover:underline cursor-pointer" title="Go to the activity">{f.cod}</button></td>
                  <td className={`${td} max-w-[300px] truncate`} title={f.nombre}>{f.nombre}</td>
                  <td className={td}>{ESTADO[f.estado] ?? f.estado}</td>
                  <td className={`${td} text-right`}>{dinero(f.actualT3)}</td>
                  <td className={`${td} text-right font-semibold`}>{dinero(f.avanceM3)}</td>
                  <td className={`${td} text-right font-semibold ${f.delta < 0 ? 'text-red-700' : 'text-[#2B7F52]'}`}>{f.delta > 0 ? '+' : ''}{dinero(f.delta)}</td>
                  <td className={td}>{f.rubros ? `${f.rubros} items` : ''}</td>
                  <td className={`${td} text-[#C9701E] whitespace-normal min-w-[200px]`}>{f.nota}</td>
                </tr>
              ))}
              {!costos.cambios.length && <tr><td colSpan={9} className="px-3 py-6 text-center text-[#5A6A74]">{cargandoM3 ? 'Loading M₃…' : 'Every Actual Cost already matches M₃.'}</td></tr>}
            </tbody>
          </table>
        </div>
        ) : (
        <div className="mx-4 border border-[#D5DEE2] rounded-b-lg rounded-tr-lg overflow-auto flex-1 min-h-[200px]">
          <table className="w-full border-collapse">
            <thead><tr>
              <th className={th}><input type="checkbox" checked={lista.some(f => f.ok) && lista.filter(f => f.ok).every(f => !quitadas.has(clave(f)))}
                onChange={e => setQuitadas(q => { const n = new Set(q); lista.filter(f => f.ok).forEach(f => (e.target.checked ? n.delete(clave(f)) : n.add(clave(f)))); return n; })} /></th>
              <th className={th}>Activity ID</th><th className={th}>Activity Name</th>
              {tab === 'cerrar' && <th className={th}>Package</th>}
              <th className={th}>SubC</th><th className={th}>Master p6</th><th className={th}>T₃</th>
              <th className={`${th} text-right`}>Venta Ex</th><th className={`${th} text-right`}>% Ex</th>
              <th className={th}>1st week</th><th className={th}>Last week</th>
              <th className={th}>{tab === 'iniciar' ? 'Actual Start' : 'Actual Finish'}</th>
              {tab === 'iniciar' && <th className={`${th} text-right`} title="Original Duration → Remaining Duration: original − working time between the Actual Start and the new Data Date (activity calendar), at least 1 day">Orig → Rem (d)</th>}
              {tab === 'iniciar' && <th className={th}>Actual Finish</th>}
              {tab === 'cerrar' && <th className={`${th} text-right`}>Physical %</th>}
              <th className={th}>Note</th>
            </tr></thead>
            <tbody>
              {lista.map(f => (
                <tr key={clave(f)} className={f.ok ? '' : 'text-[#9AA6AD] bg-[#FAFBFB]'}>
                  <td className={td}><input type="checkbox" disabled={!f.ok} checked={f.ok && !quitadas.has(clave(f))}
                    onChange={() => setQuitadas(q => { const n = new Set(q); if (n.has(clave(f))) n.delete(clave(f)); else n.add(clave(f)); return n; })} /></td>
                  <td className={`${td} font-mono`}>{f.i !== undefined ? <button onClick={() => onIr(f.i!)} className="text-[#312E81] hover:underline cursor-pointer" title="Go to the activity">{f.cod}</button> : f.cod}</td>
                  <td className={`${td} max-w-[300px] truncate`} title={f.nombre}>{f.nombre}</td>
                  {tab === 'cerrar' && <td className={td}>{f.paquete}</td>}
                  <td className={td}>{f.subc || '—'}</td>
                  <td className={td}>{f.estadoMaster || '—'}</td>
                  <td className={td}>{ESTADO[f.estadoXer] ?? '—'}</td>
                  <td className={`${td} text-right`}>{f.ventaEx.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                  <td className={`${td} text-right`}>{f.pctEx == null ? '—' : `${(f.pctEx * 100).toFixed(1)} %`}</td>
                  <td className={td}>{fP6(f.primera)}</td><td className={td}>{fP6(f.ultima)}</td>
                  <td className={`${td} font-semibold`}>{fP6(tab === 'iniciar' ? f.inicioReal : f.finReal)}</td>
                  {tab === 'iniciar' && <td className={`${td} text-right`}>{f.originalH != null && f.restanteH != null ? `${+(f.originalH / f.horasDia).toFixed(1)} → ${+(f.restanteH / f.horasDia).toFixed(1)}` : ''}</td>}
                  {tab === 'iniciar' && <td className={td}>{f.finReal ? fP6(f.finReal) : ''}</td>}
                  {tab === 'cerrar' && <td className={`${td} text-right`}>{f.avance == null ? '' : `${f.avance.toFixed(1)} %`}</td>}
                  <td className={`${td} ${f.ok ? '' : 'text-[#C9701E]'}`}>{f.motivo}</td>
                </tr>
              ))}
              {!lista.length && <tr><td colSpan={15} className="px-3 py-6 text-center text-[#5A6A74]">Nothing to {tab === 'iniciar' ? 'start' : 'finish'}.</td></tr>}
            </tbody>
          </table>
        </div>
        )}
        <div className="px-4 py-2.5 flex items-center gap-2 border-t border-[#D5DEE2] mt-2">
          <span className="text-[#5A6A74]">Then: Save → Export XER → Primavera → «p6» tab of the Master → reload the Master.</span>
          <button onClick={exportar} className="ml-auto px-3 py-1.5 border border-[#D5DEE2] rounded-lg hover:bg-[#F5F8F9] cursor-pointer flex items-center gap-1"
            title="Excel with the NotStarted and DEF_100 sheets of the specification"><Download className="w-3.5 h-3.5" /> Export Excel</button>
          {editable && tab === 'costo' && (
            <button id="p6-corte-costos" disabled={!costosElegidos.length} onClick={() => onAplicarCostos(costosElegidos)}
              className="px-3 py-1.5 rounded-lg bg-[#312E81] text-white font-bold cursor-pointer disabled:opacity-50"
              title="Set the Actual Cost of the selected activities as unsaved changes (the Data Date does not move). Review and press Save.">
              Update {costosElegidos.length} Actual Costs
            </button>
          )}
          {editable && tab !== 'costo' && (
            <button disabled={!elegidas.length || !fechaDatos || atras} onClick={() => fechaDatos && !atras && onAplicar(elegidas, fechaDatos)}
              className="px-3 py-1.5 rounded-lg bg-[#312E81] text-white font-bold cursor-pointer disabled:opacity-50"
              title="Set the new Data Date and the actual dates as unsaved changes, then reschedule (F9). Review and press Save.">
              Apply {elegidas.length} changes + F9
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
