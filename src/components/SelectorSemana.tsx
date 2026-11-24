/**
 * Selector de la semana a avanzar en la hoja del Master (M₃). Menú propio (un <select> nativo no deja
 * plegar grupos): las semanas del año elegido se agrupan por mes —y por año si se muestran varios—,
 * todo plegado al abrir; el usuario despliega el mes que quiere y elige la semana (domingo a sábado).
 */
import React from 'react';
import { CalendarDays, ChevronDown, ChevronRight, Check } from 'lucide-react';
import type { MasterCdoWeek } from '../types/masterCdo';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaDe = (w: MasterCdoWeek) => (w.fecha || w.id || '').slice(0, 10);

/** «Sem. 08-nov → 14-nov» (la semana va de domingo a sábado). */
export function etiquetaSemana(w: MasterCdoWeek): string {
  const f = fechaDe(w);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return w.label || w.id;
  const [y, m, d] = f.split('-').map(Number);
  const ini = new Date(Date.UTC(y, m - 1, d));
  const fin = new Date(Date.UTC(y, m - 1, d + 6));
  const dd = (x: Date) => `${String(x.getUTCDate()).padStart(2, '0')}-${MES_CORTO[x.getUTCMonth()]}`;
  // Solo las columnas que empiezan en domingo son semanas de domingo a sábado; las demás, con su fecha
  const rango = ini.getUTCDay() === 0 ? `${dd(ini)} → ${dd(fin)}` : dd(ini);
  return `Sem. ${rango}${w.cerrada ? ' · cerrada' : ''}`;
}

export const SelectorSemana: React.FC<{
  /** Semanas disponibles (las del año elegido en las pestañas de año). */
  semanas: MasterCdoWeek[];
  valor: string;
  onCambiar: (id: string) => void;
}> = ({ semanas, valor, onCambiar }) => {
  const [abierto, setAbierto] = React.useState(false);
  const [desplegados, setDesplegados] = React.useState<Set<string>>(new Set());
  const [pos, setPos] = React.useState({ top: 0, left: 0 });
  const boton = React.useRef<HTMLButtonElement>(null);
  const menu = React.useRef<HTMLDivElement>(null);

  // Año › mes › semanas, de lo más reciente a lo más antiguo
  const anios = React.useMemo(() => {
    const porAnio = new Map<string, Map<string, MasterCdoWeek[]>>();
    for (const w of [...semanas].sort((a, b) => fechaDe(b).localeCompare(fechaDe(a)))) {
      const f = fechaDe(w);
      const anio = /^\d{4}/.test(f) ? f.slice(0, 4) : 'Otras';
      const mes = /^\d{4}-\d{2}/.test(f) ? f.slice(0, 7) : 'otras';
      if (!porAnio.has(anio)) porAnio.set(anio, new Map());
      const meses = porAnio.get(anio)!;
      if (!meses.has(mes)) meses.set(mes, []);
      meses.get(mes)!.push(w);
    }
    return [...porAnio.entries()];
  }, [semanas]);
  const variosAnios = anios.length > 1;
  const elegida = semanas.find(w => w.id === valor);

  const abrir = () => {
    const r = boton.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left });
    setDesplegados(new Set()); // siempre se abre plegado
    setAbierto(true);
  };
  React.useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (menu.current?.contains(e.target as Node) || boton.current?.contains(e.target as Node)) return;
      setAbierto(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc); };
  }, [abierto]);
  const alternar = (k: string) => setDesplegados(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const elegir = (id: string) => { onCambiar(id); setAbierto(false); };

  const fila = 'w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-left cursor-pointer';
  const grupoMes = (mes: string, lista: MasterCdoWeek[], sangria: number) => {
    const k = `m:${mes}`;
    const abiertoMes = desplegados.has(k);
    const tieneElegida = lista.some(w => w.id === valor);
    return (
      <div key={k}>
        <button type="button" onClick={() => alternar(k)} className={`${fila} hover:bg-slate-100 font-semibold text-slate-700`} style={{ paddingLeft: 8 + sangria }}>
          {abiertoMes ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
          <span>{mes === 'otras' ? 'Otras' : MESES[Number(mes.slice(5, 7)) - 1]}</span>
          <span className="text-[10px] font-normal text-slate-400">{lista.length} sem.</span>
          {tieneElegida && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-600" />}
        </button>
        {abiertoMes && lista.map(w => (
          <button key={w.id} type="button" onClick={() => elegir(w.id)}
            className={`${fila} ${w.id === valor ? 'bg-emerald-50 text-emerald-800 font-semibold' : 'hover:bg-slate-50 text-slate-700'}`} style={{ paddingLeft: 30 + sangria }}>
            <span className="font-mono text-[11px]">{etiquetaSemana(w)}</span>
            {w.id === valor && <Check className="w-3.5 h-3.5 ml-auto text-emerald-700" />}
          </button>
        ))}
      </div>
    );
  };

  return (
    <>
      <button ref={boton} id="m3-semana" type="button" onClick={() => (abierto ? setAbierto(false) : abrir())}
        title="Semana a avanzar: deja visible solo esa semana (domingo a sábado)"
        className="flex items-center gap-1.5 border rounded-xl px-2 py-1 text-xs font-semibold cursor-pointer"
        style={elegida
          ? { backgroundColor: '#047857', borderColor: '#065F46', color: '#FFFFFF' }
          : { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', color: '#334155' }}>
        <CalendarDays className="w-3.5 h-3.5" />
        <span>{elegida ? etiquetaSemana(elegida) : 'Todas las semanas'}</span>
        <ChevronDown className="w-3 h-3 opacity-70" />
      </button>
      {abierto && (
        <div ref={menu} className="fixed z-[80] w-[260px] max-h-[60vh] overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl p-1 text-xs"
          style={{ top: pos.top, left: pos.left }}>
          <button type="button" onClick={() => elegir('all')}
            className={`${fila} ${valor === 'all' || !elegida ? 'bg-emerald-50 text-emerald-800 font-semibold' : 'hover:bg-slate-50 text-slate-700'}`}>
            <span>Todas las semanas</span>
            <span className="text-[10px] font-normal text-slate-400">({semanas.length})</span>
          </button>
          <div className="h-px bg-slate-100 my-1" />
          {anios.map(([anio, meses]) => variosAnios ? (
            <div key={anio}>
              <button type="button" onClick={() => alternar(`a:${anio}`)} className={`${fila} hover:bg-slate-100 font-bold text-slate-800`}>
                {desplegados.has(`a:${anio}`) ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                <span>{anio}</span>
              </button>
              {desplegados.has(`a:${anio}`) && [...meses.entries()].map(([mes, lista]) => grupoMes(mes, lista, 14))}
            </div>
          ) : [...meses.entries()].map(([mes, lista]) => grupoMes(mes, lista, 0)))}
          {!semanas.length && <div className="px-2 py-2 text-slate-400">No hay semanas en este año.</div>}
        </div>
      )}
    </>
  );
};
