/**
 * Filtros por columna de la hoja M₃, como los de Excel: de texto (es igual a, no es igual a, comienza por,
 * termina con, contiene, no contiene) y de número (es igual a, no es igual a, mayor que, mayor o igual que,
 * menor que, menor o igual que, entre, 10 mejores, 10 peores, por encima / por debajo del promedio), con dos
 * condiciones unidas por Y / O. Se evalúan sobre las partidas (hojas); los niveles superiores se muestran
 * si alguna partida suya pasa.
 */
import React from 'react';
import { Filter, X } from 'lucide-react';
import type { MasterHierarchyNode } from '../utils/masterCdoHierarchy';

export type OpTexto = 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'equals' | 'not_equals';
export type OpNumero = 'eq' | 'ne' | 'gt' | 'ge' | 'lt' | 'le' | 'between' | 'top' | 'bottom' | 'above_avg' | 'below_avg';
export type TipoColumna = 'texto' | 'numero';

export interface FiltroCol {
  op1: OpTexto | OpNumero;
  val1: string;
  logic: 'and' | 'or';
  op2: OpTexto | OpNumero | '';
  val2: string;
}

export interface ColumnaFiltrable {
  key: string;
  titulo: string;
  tipo: TipoColumna;
  valor: (n: MasterHierarchyNode) => string | number;
}

export const OPS_TEXTO: [OpTexto, string][] = [
  ['equals', 'es igual a'], ['not_equals', 'no es igual a'], ['starts_with', 'comienza por'],
  ['ends_with', 'termina con'], ['contains', 'contiene'], ['not_contains', 'no contiene'],
];
export const OPS_NUMERO: [OpNumero, string][] = [
  ['eq', 'es igual a'], ['ne', 'no es igual a'], ['gt', 'es mayor que'], ['ge', 'es mayor o igual que'],
  ['lt', 'es menor que'], ['le', 'es menor o igual que'], ['between', 'entre'], ['top', 'diez mejores'],
  ['bottom', 'diez peores'], ['above_avg', 'por encima del promedio'], ['below_avg', 'por debajo del promedio'],
];
const SIN_VALOR: OpNumero[] = ['above_avg', 'below_avg'];

/** Número escrito a la española (1.234,5) o con punto decimal (1234.5). */
export function leerNumero(s: string): number | null {
  const t = String(s ?? '').trim().replace(/\s/g, '').replace(/%$/, '');
  if (!t) return null;
  let x = t;
  if (x.includes(',')) x = x.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(x)) x = x.replace(/\./g, '');
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

const vacio = (f?: FiltroCol | null) => !f;
export const filtroActivo = (f?: FiltroCol | null): f is FiltroCol => {
  if (vacio(f)) return false;
  return SIN_VALOR.includes(f!.op1 as OpNumero) || f!.op1 === 'top' || f!.op1 === 'bottom' || f!.val1.trim() !== '';
};

/** Texto corto del filtro para las etiquetas de filtros activos. */
export function resumenFiltro(f: FiltroCol, tipo: TipoColumna): string {
  const nombre = (op: string) => (tipo === 'texto' ? OPS_TEXTO : OPS_NUMERO).find(([o]) => o === op)?.[1] || op;
  const cond = (op: string, v: string, v2?: string) =>
    op === 'between' ? `entre ${v || '−∞'} y ${v2 || '∞'}` : (op === 'top' || op === 'bottom') ? `${nombre(op).replace('diez', v || '10')}` : SIN_VALOR.includes(op as OpNumero) ? nombre(op) : `${nombre(op)} "${v}"`;
  const c1 = cond(f.op1, f.val1, f.val2);
  if (f.op1 === 'between' || !f.op2 || !f.val2.trim()) return c1;
  return `${c1} ${f.logic === 'and' ? 'y' : 'o'} ${cond(f.op2, f.val2)}`;
}

/**
 * Predicado sobre las partidas con todos los filtros de columna. Los «diez mejores» y los promedios
 * se calculan sobre todas las partidas (como Excel sobre la columna completa).
 */
export function construirPredicado(
  filtros: Record<string, FiltroCol>,
  columnas: ColumnaFiltrable[],
  hojas: MasterHierarchyNode[],
): ((n: MasterHierarchyNode) => boolean) | undefined {
  const activos = columnas.filter(c => filtroActivo(filtros[c.key]));
  if (!activos.length) return undefined;
  const pruebas = activos.map(c => {
    const f = filtros[c.key];
    if (c.tipo === 'texto') {
      const prueba = (op: string, v: string) => {
        const q = v.trim().toLowerCase();
        return (n: MasterHierarchyNode) => {
          const t = String(c.valor(n) ?? '').trim().toLowerCase();
          switch (op) {
            case 'equals': return t === q;
            case 'not_equals': return t !== q;
            case 'starts_with': return t.startsWith(q);
            case 'ends_with': return t.endsWith(q);
            case 'contains': return t.includes(q);
            case 'not_contains': return !t.includes(q);
            default: return true;
          }
        };
      };
      const p1 = prueba(f.op1, f.val1);
      const p2 = f.op2 && f.val2.trim() ? prueba(f.op2, f.val2) : null;
      return (n: MasterHierarchyNode) => (p2 ? (f.logic === 'and' ? p1(n) && p2(n) : p1(n) || p2(n)) : p1(n));
    }
    // Números: estadísticas de la columna para promedios y «diez mejores»
    const valores = hojas.map(h => Number(c.valor(h)) || 0);
    const promedio = valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;
    const ordenados = [...valores].sort((a, b) => b - a);
    const prueba = (op: string, v: string, v2?: string) => {
      const x = leerNumero(v);
      const y = v2 !== undefined ? leerNumero(v2) : null;
      const k = Math.max(1, Math.round(x ?? 10));
      const corteTop = ordenados[Math.min(k, ordenados.length) - 1];
      const corteBottom = ordenados[Math.max(0, ordenados.length - k)];
      return (n: MasterHierarchyNode) => {
        const a = Number(c.valor(n)) || 0;
        switch (op) {
          case 'eq': return x === null || Math.abs(a - x) < 1e-9;
          case 'ne': return x === null || Math.abs(a - x) >= 1e-9;
          case 'gt': return x === null || a > x;
          case 'ge': return x === null || a >= x;
          case 'lt': return x === null || a < x;
          case 'le': return x === null || a <= x;
          case 'between': {
            const lo = Math.min(x ?? -Infinity, y ?? Infinity), hi = Math.max(x ?? -Infinity, y ?? Infinity);
            return a >= (x === null ? -Infinity : lo) && a <= (y === null ? Infinity : hi);
          }
          case 'top': return ordenados.length > 0 && a >= corteTop;
          case 'bottom': return ordenados.length > 0 && a <= corteBottom;
          case 'above_avg': return a > promedio;
          case 'below_avg': return a < promedio;
          default: return true;
        }
      };
    };
    if (f.op1 === 'between') return prueba('between', f.val1, f.val2);
    const p1 = prueba(f.op1, f.val1);
    const p2 = f.op2 && (f.val2.trim() || SIN_VALOR.includes(f.op2 as OpNumero)) ? prueba(f.op2, f.val2) : null;
    return (n: MasterHierarchyNode) => (p2 ? (f.logic === 'and' ? p1(n) && p2(n) : p1(n) || p2(n)) : p1(n));
  });
  return (n: MasterHierarchyNode) => pruebas.every(p => p(n));
}

/** Botón del embudo en la cabecera + cuadro de filtro (posición fija, no lo recorta el scroll de la tabla). */
export const BotonFiltroColumna: React.FC<{
  columna: ColumnaFiltrable;
  filtro?: FiltroCol;
  abierto: boolean;
  onAbrir: (abrir: boolean) => void;
  onAplicar: (f: FiltroCol | null) => void;
}> = ({ columna, filtro, abierto, onAbrir, onAplicar }) => {
  const esNum = columna.tipo === 'numero';
  const base: FiltroCol = { op1: esNum ? 'eq' : 'contains', val1: '', logic: 'and', op2: '', val2: '' };
  const [borrador, setBorrador] = React.useState<FiltroCol>(filtro || base);
  const [pos, setPos] = React.useState({ top: 0, left: 0 });
  const boton = React.useRef<HTMLButtonElement>(null);
  const cuadro = React.useRef<HTMLDivElement>(null);
  const entrada = React.useRef<HTMLInputElement>(null);
  const activo = filtroActivo(filtro);

  React.useEffect(() => {
    if (!abierto) return;
    setBorrador(filtro || base);
    const r = boton.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left - 8, window.innerWidth - 290)) });
    const t = setTimeout(() => entrada.current?.focus(), 30);
    const fuera = (e: MouseEvent) => {
      if (cuadro.current?.contains(e.target as Node) || boton.current?.contains(e.target as Node)) return;
      onAbrir(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onAbrir(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const aplicar = () => {
    const f = { ...borrador, val1: borrador.val1.trim(), val2: borrador.val2.trim() };
    onAplicar(filtroActivo(f) ? f : null);
    onAbrir(false);
  };
  const ops = esNum ? OPS_NUMERO : OPS_TEXTO;
  const necesitaValor = (op: string) => !SIN_VALOR.includes(op as OpNumero);
  const placeholder = (op: string) =>
    op === 'top' || op === 'bottom' ? 'Cantidad de partidas (10)' : esNum ? 'Número (p. ej. 1.250,5)' : 'Texto…';
  const entre = borrador.op1 === 'between';
  const sel = 'w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-500';
  const inp = 'w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';
  const enter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); aplicar(); } };

  return (
    <>
      <button ref={boton} type="button" data-filtro-col={columna.key}
        onClick={e => { e.stopPropagation(); onAbrir(!abierto); }}
        className={`p-0.5 rounded transition-colors cursor-pointer shrink-0 ${activo ? 'text-white bg-indigo-600 hover:bg-indigo-700' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/60'}`}
        title={activo ? `Filtro: ${resumenFiltro(filtro!, columna.tipo)}` : `Filtrar ${columna.titulo}`}>
        <Filter className="w-3 h-3" />
      </button>
      {abierto && (
        <div ref={cuadro} onClick={e => e.stopPropagation()}
          className="fixed z-[90] w-[280px] bg-white rounded-xl shadow-2xl border border-slate-300 p-3 text-slate-800 font-sans normal-case tracking-normal text-left font-normal text-xs"
          style={{ top: pos.top, left: pos.left }}>
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100">
            <span className="font-bold text-xs">{esNum ? 'Filtros de número' : 'Filtros de texto'}: {columna.titulo}</span>
            <button type="button" onClick={() => onAbrir(false)} className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer" title="Cerrar (Esc)">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2.5">
            <div className="space-y-1">
              <label className="text-[10.5px] font-semibold text-slate-500 block">Mostrar las filas en las que «{columna.titulo}»</label>
              <select value={borrador.op1} className={sel}
                onChange={e => {
                  const op = e.target.value as OpNumero | OpTexto;
                  setBorrador(b => ({ ...b, op1: op, ...(op === 'between' ? { op2: '', logic: 'and' as const } : {}) }));
                }}>
                {ops.map(([o, t]) => <option key={o} value={o}>{t}</option>)}
              </select>
              {necesitaValor(borrador.op1) && (
                <input ref={entrada} type="text" value={borrador.val1} placeholder={entre ? 'Desde (≥)' : placeholder(borrador.op1)} className={inp}
                  onChange={e => setBorrador(b => ({ ...b, val1: e.target.value }))} onKeyDown={enter} />
              )}
              {entre && (
                <input type="text" value={borrador.val2} placeholder="Hasta (≤)" className={inp}
                  onChange={e => setBorrador(b => ({ ...b, val2: e.target.value }))} onKeyDown={enter} />
              )}
            </div>
            {!entre && (
              <>
                <div className="flex items-center gap-3">
                  {(['and', 'or'] as const).map(l => (
                    <label key={l} className="flex items-center gap-1 font-semibold cursor-pointer">
                      <input type="radio" checked={borrador.logic === l} onChange={() => setBorrador(b => ({ ...b, logic: l }))} className="accent-indigo-600" />
                      <span>{l === 'and' ? 'Y' : 'O'}</span>
                    </label>
                  ))}
                </div>
                <div className="space-y-1">
                  <select value={borrador.op2} className={sel}
                    onChange={e => setBorrador(b => ({ ...b, op2: e.target.value as OpNumero | OpTexto | '' }))}>
                    <option value="">(segunda condición)</option>
                    {ops.filter(([o]) => o !== 'between').map(([o, t]) => <option key={o} value={o}>{t}</option>)}
                  </select>
                  {borrador.op2 && necesitaValor(borrador.op2) && (
                    <input type="text" value={borrador.val2} placeholder={placeholder(borrador.op2)} className={inp}
                      onChange={e => setBorrador(b => ({ ...b, val2: e.target.value }))} onKeyDown={enter} />
                  )}
                </div>
              </>
            )}
            <div className="flex gap-2 pt-2 border-t border-slate-200">
              <button type="button" onClick={() => { onAplicar(null); onAbrir(false); }}
                className="flex-1 py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold cursor-pointer">
                Borrar filtro
              </button>
              <button type="button" onClick={aplicar}
                className="flex-1 py-1 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-sm cursor-pointer">
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
