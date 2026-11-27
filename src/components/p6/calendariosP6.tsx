/**
 * Ventana «Calendars» de T₃: los calendarios del XER (tabla CALENDAR) con su tipo, horas por día,
 * semana laboral, feriados y días especiales, y cuántas actividades usa cada uno.
 */
import React from 'react';
import { CalendarDays, X } from 'lucide-react';
import type { ModeloP6 } from '../../utils/p6/modelo';
import { celda } from '../../utils/p6/xer';

const DIAS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TIPO: Record<string, string> = { CA_Base: 'Global', CA_Project: 'Project', CA_Rsrc: 'Resource' };
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const horas = (iv: [number, number][]) => iv.reduce((s, [a, b]) => s + (b - a), 0) / 60;
const tramos = (iv: [number, number][]) => (iv.length ? iv.map(([a, b]) => `${hhmm(a)}–${hhmm(b)}`).join(', ') : 'Non-work');
const fechaDia = (dia: number) => { const d = new Date(dia * 86400000); return `${DIAS[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, '0')}-${MES[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(2)}`; };

export const DialogoCalendarios: React.FC<{ m: ModeloP6; onCerrar: () => void }> = ({ m, onCerrar }) => {
  const tab = m.xer.tablas.get('CALENDAR');
  const filas = React.useMemo(() => {
    const uso = new Map<string, number>();
    for (const f of m.task.filas) { const c = celda(m.task, f, 'clndr_id'); uso.set(c, (uso.get(c) ?? 0) + 1); }
    return (tab?.filas ?? []).map(f => {
      const id = celda(tab!, f, 'clndr_id');
      return { id, nombre: celda(tab!, f, 'clndr_name'), tipo: TIPO[celda(tab!, f, 'clndr_type')] ?? celda(tab!, f, 'clndr_type'), defecto: celda(tab!, f, 'default_flag') === 'Y', usos: uso.get(id) ?? 0, cal: m.calendarios.get(id) };
    }).sort((a, b) => b.usos - a.usos || a.nombre.localeCompare(b.nombre));
  }, [m, tab]);
  const [sel, setSel] = React.useState<string>(() => filas[0]?.id ?? '');
  const elegido = filas.find(x => x.id === sel);
  const cal = elegido?.cal;
  // Excepciones del año elegido (por defecto, el de la fecha de datos)
  const anioDatos = new Date(m.fechaDatos * 60000).getUTCFullYear();
  const anios = React.useMemo(() => {
    const s = new Set<number>();
    cal?.excepciones.forEach((_, dia) => s.add(new Date(dia * 86400000).getUTCFullYear()));
    return [...s].sort();
  }, [cal]);
  const [anio, setAnio] = React.useState(anioDatos);
  const exc = React.useMemo(() => [...(cal?.excepciones ?? new Map())].filter(([dia]) => new Date(dia * 86400000).getUTCFullYear() === anio).sort((a, b) => a[0] - b[0]), [cal, anio]);
  const semanaH = cal ? cal.semana.slice(1, 8).reduce((s, iv) => s + horas(iv), 0) : 0;
  const th = 'px-2 py-1 text-left font-semibold text-[#5A6A74] bg-[#F5F8F9] border-b border-[#D5DEE2] whitespace-nowrap';
  const td = 'px-2 py-1 border-b border-[#EEF2F3] whitespace-nowrap';
  return (
    <div className="fixed inset-0 z-[70] bg-black/30 flex items-center justify-center p-4" onClick={onCerrar}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[1050px] max-h-[88vh] flex flex-col text-xs text-[#14212A]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#D5DEE2]">
          <CalendarDays className="w-4 h-4 text-[#312E81]" />
          <b className="text-sm">Calendars</b>
          <span className="text-[#5A6A74]">{filas.length} calendars in the XER · {filas.filter(x => x.usos).length} used by activities</span>
          <button onClick={onCerrar} className="ml-auto p-1 hover:bg-[#F5F8F9] rounded cursor-pointer" title="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="w-[400px] shrink-0 overflow-auto border-r border-[#D5DEE2]">
            <table className="w-full border-collapse">
              <thead><tr><th className={th}>Calendar</th><th className={th}>Type</th><th className={`${th} text-right`}>h/day</th><th className={`${th} text-right`}>Activities</th></tr></thead>
              <tbody>
                {filas.map(x => (
                  <tr key={x.id} onClick={() => { setSel(x.id); setAnio(anioDatos); }} className={`cursor-pointer ${sel === x.id ? 'bg-[#EEF0FB]' : 'hover:bg-[#F5F8F9]'}`}>
                    <td className={`${td} max-w-[210px] truncate`} title={x.nombre}>{x.nombre}{x.defecto && <span className="ml-1 text-[10px] text-[#2B7F52] font-semibold">default</span>}</td>
                    <td className={td}>{x.tipo}</td>
                    <td className={`${td} text-right`}>{x.cal?.horasDia ?? '—'}</td>
                    <td className={`${td} text-right ${x.usos ? 'font-semibold' : 'text-[#9AA6AD]'}`}>{x.usos.toLocaleString('en-US')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex-1 min-w-0 overflow-auto p-4 flex flex-col gap-3">
            {cal && elegido ? (
              <>
                <div>
                  <div className="text-sm font-bold">{elegido.nombre}</div>
                  <div className="text-[#5A6A74]">{elegido.tipo} calendar{elegido.defecto ? ' · default' : ''} · {cal.horasDia} h/day · {semanaH} h/week · {elegido.usos.toLocaleString('en-US')} activities</div>
                </div>
                <div>
                  <b>Standard work week</b>
                  <table className="mt-1 border-collapse">
                    <tbody>
                      {DIAS.map((d, k) => {
                        const iv = cal.semana[k + 1];
                        return (
                          <tr key={d}>
                            <td className={`${td} font-semibold w-12`}>{d}</td>
                            <td className={`${td} ${iv.length ? '' : 'text-[#9AA6AD]'}`}>{tramos(iv)}</td>
                            <td className={`${td} text-right text-[#5A6A74]`}>{horas(iv) ? `${horas(iv)} h` : ''}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-col min-h-0">
                  <div className="flex items-center gap-2">
                    <b>Exceptions</b>
                    <select value={anio} onChange={e => setAnio(Number(e.target.value))} className="border border-[#D5DEE2] rounded px-1.5 py-0.5">
                      {[...new Set([...anios, anioDatos])].sort().map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <span className="text-[#5A6A74]">{exc.filter(([, iv]) => !iv.length).length} holidays (non-work) · {exc.filter(([, iv]) => iv.length).length} days with special hours · {cal.excepciones.size} in total</span>
                  </div>
                  <table className="mt-1 border-collapse">
                    <tbody>
                      {exc.map(([dia, iv]) => (
                        <tr key={dia}>
                          <td className={`${td} w-32`}>{fechaDia(dia)}</td>
                          <td className={`${td} ${iv.length ? 'text-[#312E81]' : 'text-[#B30000]'}`}>{iv.length ? `Work ${tramos(iv)} (${horas(iv)} h)` : 'Non-work'}</td>
                        </tr>
                      ))}
                      {!exc.length && <tr><td className={`${td} text-[#5A6A74]`}>No exceptions in {anio}.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </>
            ) : <div className="text-[#5A6A74]">Choose a calendar.</div>}
          </div>
        </div>
      </div>
    </div>
  );
};
