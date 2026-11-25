/**
 * Ventana «Master Only» de T₃: crea en el XER los rubros del Master que aún no están en T₃ (ver
 * `utils/p6/soloMaster.ts`), en el WBS que les corresponde, con sus fechas reales por la regla del corte,
 * el Actual Cost = Venta Ex y los campos de usuario del Master. El admin los crea como cambios sin guardar + F9.
 */
import React from 'react';
import * as XLSX from 'xlsx';
import { ChevronDown, ChevronRight, Download, FilePlus2, X } from 'lucide-react';
import type { Actividad } from '../../types';
import type { ModeloP6 } from '../../utils/p6/modelo';
import { calcularSoloMaster, type FilaSoloMaster } from '../../utils/p6/soloMaster';

const MES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fP6 = (s: string | null | undefined) => (s ? `${s.slice(8, 10)}-${MES[Number(s.slice(5, 7)) - 1]}-${s.slice(2, 4)}${s.length > 10 ? ` ${s.slice(11, 16)}` : ''}` : '—');
const dinero = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const SIN_SUBC = '(no SubC)';

function libro(crear: FilaSoloMaster[], sinEjec: FilaSoloMaster[]): Uint8Array {
  const cab = ['SubC', 'Activity ID', 'Activity Name', 'WBS (T₃)', 'WBS Name', 'WBS in the Master', '1st week', 'Last week', 'Actual Start', 'Actual Finish', 'Original Duration (d)', 'Actual Cost (Venta Ex)', 'Budgeted Cost (Venta)', 'User Defined fields', 'Note'];
  const filas = (l: FilaSoloMaster[]) => l.map(f => [f.subc, f.cod, f.nombre, f.wbsCodigo, f.wbsNombre, f.wbsMaster, f.primera || '', f.ultima || '', f.inicioReal || '', f.finReal || '',
    Math.round(f.durH / f.horasDia), f.ventaEx, f.venta, f.udfs.map(u => `${u.etiqueta}=${u.valor}`).join(' · '), f.motivo]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cab, ...filas(crear)]), 'To create');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cab, ...filas(sinEjec)]), 'No execution');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
}

export const DialogoSoloMaster: React.FC<{
  m: ModeloP6;
  master: Actividad[];
  editable: boolean;
  version: number;
  onCerrar: () => void;
  onAplicar: (filas: FilaSoloMaster[]) => void;
}> = ({ m, master, editable, version, onCerrar, onAplicar }) => {
  const res = React.useMemo(() => calcularSoloMaster(m, master), [m, master, version]);
  const [tab, setTab] = React.useState<'crear' | 'sinEjecucion'>('crear');
  // «To create»: todas marcadas salvo las que se quiten; «No execution»: ninguna salvo las que se elijan
  const [quitadas, setQuitadas] = React.useState<Set<string>>(new Set());
  const [elegidasSE, setElegidasSE] = React.useState<Set<string>>(new Set());
  const [plegados, setPlegados] = React.useState<Set<string>>(new Set());
  const lista = tab === 'crear' ? res.crear : res.sinEjecucion;
  const posibles = res.crear.filter(f => f.ok);
  const posiblesSE = res.sinEjecucion.filter(f => f.ok);
  const marcada = (f: FilaSoloMaster) => f.ok && (f.sinEjecucion ? elegidasSE.has(f.cod) : !quitadas.has(f.cod));
  const elegidasCrear = posibles.filter(marcada);
  const elegidasSinEj = posiblesSE.filter(marcada);
  const elegidas = [...elegidasCrear, ...elegidasSinEj];
  const grupos = React.useMemo(() => {
    const g = new Map<string, FilaSoloMaster[]>();
    for (const f of lista) { const k = f.subc || SIN_SUBC; if (!g.has(k)) g.set(k, []); g.get(k)!.push(f); }
    return [...g.entries()].sort(([a], [b]) => (a === SIN_SUBC ? 1 : b === SIN_SUBC ? -1 : a.localeCompare(b, 'es')));
  }, [lista]);
  const alternarSel = (fs: FilaSoloMaster[], marcar: boolean) => {
    const ok = fs.filter(f => f.ok);
    setQuitadas(q => { const n = new Set(q); ok.filter(f => !f.sinEjecucion).forEach(f => (marcar ? n.delete(f.cod) : n.add(f.cod))); return n; });
    setElegidasSE(q => { const n = new Set(q); ok.filter(f => f.sinEjecucion).forEach(f => (marcar ? n.add(f.cod) : n.delete(f.cod))); return n; });
  };
  const alternarUna = (f: FilaSoloMaster) => alternarSel([f], !marcada(f));
  const total = (l: FilaSoloMaster[]) => l.reduce((s, f) => s + f.ventaEx, 0);
  const exportar = () => {
    const url = URL.createObjectURL(new Blob([libro(res.crear, res.sinEjecucion)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a'); a.href = url; a.download = `Master_only_${new Date().toISOString().slice(0, 10)}.xlsx`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const th = 'px-2 py-1 text-left font-semibold text-[#5A6A74] bg-[#F5F8F9] sticky top-0 border-b border-[#D5DEE2] whitespace-nowrap';
  const td = 'px-2 py-1 border-b border-[#EEF2F3] whitespace-nowrap align-top';
  const deCrear = true; // las dos pestañas permiten elegir
  const posiblesTab = tab === 'crear' ? posibles : posiblesSE;

  return (
    <div className="fixed inset-0 z-[70] bg-black/30 flex items-center justify-center p-4" onClick={onCerrar}>
      <div id="p6-solo-master-dialogo" className="bg-white rounded-xl shadow-2xl w-full max-w-[1350px] max-h-[90vh] flex flex-col text-xs text-[#14212A]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#D5DEE2]">
          <FilePlus2 className="w-4 h-4 text-[#312E81]" />
          <b className="text-sm">Create Master Only activities</b>
          <span className="text-[#5A6A74]">Master items not yet in T₃, placed in their WBS · Actual Cost = Venta Ex</span>
          <button onClick={onCerrar} className="ml-auto p-1 hover:bg-[#F5F8F9] rounded cursor-pointer" title="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-4 py-2 border-b border-[#EEF2F3] text-[#5A6A74]">
          Data Date {fP6(res.fechaDatos)} · with execution {res.crear.length} (Actual Cost {dinero(total(res.crear))}) · no execution {res.sinEjecucion.length} (created only if ticked) · below «p.D Pendientes» {res.bajoPD} (left out)
        </div>
        <div className="px-4 pt-2 flex items-end gap-1 flex-wrap">
          {([['crear', `To create · ${elegidasCrear.length}/${posibles.length}`], ['sinEjecucion', `No execution · ${elegidasSinEj.length}/${res.sinEjecucion.length}`]] as const).map(([k, etq]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-t-lg border border-b-0 font-semibold cursor-pointer ${tab === k ? 'bg-white border-[#D5DEE2] text-[#312E81]' : 'bg-[#F5F8F9] border-transparent text-[#5A6A74]'}`}>{etq}</button>
          ))}
          <span className="ml-3 mb-1 text-[#5A6A74] max-w-[700px]">
            {tab === 'crear'
              ? 'Task Dependent activity in the deepest WBS of T₃ matching its Master WBS. Cut rule: Actual Start = 1st week with execution + 1 day 08:00, Actual Finish = last week + 4 days 16:00 (Completed, 100 %). Resource V: Actual Cost = Venta Ex, Budgeted Cost = Venta. Master classification and «32. Variacion» copied to the User Defined fields.'
              : 'Master Only items without execution (Venta Ex = 0): none selected by default; tick the ones to create. They are created Not Started, 1 day at the Data Date, no actual dates, Actual Cost 0 (resource V), same WBS rule and User Defined fields.'}
          </span>
        </div>
        <div className="mx-4 border border-[#D5DEE2] rounded-b-lg rounded-tr-lg overflow-auto flex-1 min-h-[220px]">
          <table className="w-full border-collapse">
            <thead><tr>
              {deCrear && <th className={th}><input type="checkbox" checked={posiblesTab.length > 0 && posiblesTab.every(marcada)} onChange={e => alternarSel(posiblesTab, e.target.checked)} /></th>}
              <th className={th}>Activity ID (new)</th><th className={th}>Activity Name</th><th className={th}>WBS (T₃)</th><th className={th}>WBS in the Master</th>
              <th className={th}>Actual Start</th><th className={th}>Actual Finish</th><th className={`${th} text-right`}>Orig. Dur. (d)</th>
              <th className={`${th} text-right`}>Actual Cost (Venta Ex)</th><th className={th}>User Defined</th><th className={th}>Note</th>
            </tr></thead>
            <tbody>
              {grupos.map(([sub, fs]) => {
                const abierto = !plegados.has(sub);
                const ok = fs.filter(f => f.ok);
                return (
                  <React.Fragment key={sub}>
                    <tr className="bg-[#E8EAF6] cursor-pointer select-none" onClick={() => setPlegados(p => { const n = new Set(p); if (n.has(sub)) n.delete(sub); else n.add(sub); return n; })}>
                      {deCrear && <td className={td} onClick={e => e.stopPropagation()}><input type="checkbox" disabled={!ok.length} checked={ok.length > 0 && ok.every(marcada)} onChange={e => alternarSel(ok, e.target.checked)} title="Select the whole subcontractor" /></td>}
                      <td colSpan={7} className="px-2 py-1 border-b border-[#D5DEE2] font-bold text-[#312E81]">
                        {abierto ? <ChevronDown className="inline w-3.5 h-3.5 mr-1" /> : <ChevronRight className="inline w-3.5 h-3.5 mr-1" />}
                        SubC: {sub} <span className="font-normal text-[#5A6A74]">· {fs.length} item{fs.length === 1 ? '' : 's'}{` · ${ok.filter(marcada).length} selected`}</span>
                      </td>
                      <td className="px-2 py-1 border-b border-[#D5DEE2] text-right font-bold text-[#312E81]">{dinero(total(fs))}</td>
                      <td colSpan={2} className="border-b border-[#D5DEE2]" />
                    </tr>
                    {abierto && fs.map(f => (
                      <tr key={f.cod} className={f.ok ? '' : 'text-[#9AA6AD] bg-[#FAFBFB]'}>
                        {deCrear && <td className={td}><input type="checkbox" disabled={!f.ok} checked={marcada(f)} onChange={() => alternarUna(f)} /></td>}
                        <td className={`${td} font-mono font-semibold`}>{f.cod}</td>
                        <td className={`${td} max-w-[260px] truncate`} title={f.nombre}>{f.nombre}</td>
                        <td className={td} title={f.wbsNombre}><span className="font-mono">{f.wbsCodigo || '—'}</span> <span className="text-[#5A6A74]">{f.wbsNombre}</span></td>
                        <td className={`${td} font-mono text-[#5A6A74]`}>{f.wbsMaster}</td>
                        <td className={td}>{f.sinEjecucion ? 'Not Started' : fP6(f.inicioReal)}</td>
                        <td className={td}>{f.sinEjecucion ? '' : fP6(f.finReal)}</td>
                        <td className={`${td} text-right`}>{Math.round(f.durH / f.horasDia)}</td>
                        <td className={`${td} text-right font-semibold`}>{dinero(f.ventaEx)}</td>
                        <td className={`${td} max-w-[220px] truncate text-[#5A6A74]`} title={f.udfs.map(u => `${u.etiqueta} = ${u.valor}`).join('\n')}>{f.udfs.length} fields</td>
                        <td className={`${td} text-[#C9701E] whitespace-normal min-w-[160px]`}>{f.motivo}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
              {!lista.length && <tr><td colSpan={11} className="px-3 py-6 text-center text-[#5A6A74]">Nothing here.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 flex items-center gap-2 border-t border-[#D5DEE2] mt-2">
          <span className="text-[#5A6A74]">They are created without relationships. After creating: review, Save → Export XER → Primavera.</span>
          <button onClick={exportar} className="ml-auto px-3 py-1.5 border border-[#D5DEE2] rounded-lg hover:bg-[#F5F8F9] cursor-pointer flex items-center gap-1"
            title="Excel with the activities to create and those without execution"><Download className="w-3.5 h-3.5" /> Export Excel</button>
          {editable && (
            <button id="p6-solo-master-crear" disabled={!elegidas.length} onClick={() => onAplicar(elegidas)}
              className="px-3 py-1.5 rounded-lg bg-[#312E81] text-white font-bold cursor-pointer disabled:opacity-50"
              title="Create the selected activities as unsaved changes, then reschedule (F9). Review and press Save.">
              Create {elegidas.length} activities + F9{elegidasSinEj.length ? ` (${elegidasSinEj.length} without execution)` : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
