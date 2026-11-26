/**
 * Vista «Resources» de T₃: análisis de la venta y el cashflow (`utils/p6/cashflow.ts`).
 * Por períodos (Weeks / Months / Quarters / Years), agrupado como elija el usuario (WBS, disciplina —05.Tipo—,
 * grupo —01.Grupos—, ubicación o subcontratista), con Budgeted / Actual / Remaining y su acumulado.
 * Regla de cobro del equipamiento (opcional): la compra (.D) se certifica con el flete (.E) → el 80 % en el flete.
 * Arriba: curva del período y acumulada y el cruce con lo planillado de equipamiento (pestaña Certificación).
 */
import React from 'react';
import * as XLSX from 'xlsx';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import type { ModeloP6 } from '../../utils/p6/modelo';
import { celda } from '../../utils/p6/xer';
import { compacto, periodosDeEscala, type LineaBaseFilas } from '../../utils/p6/uso';
import { calcularFlujo, esGrupoEquipo, familiasEquipo } from '../../utils/p6/cashflow';
import { etiquetaUbicacion, type CampoAgrupacion } from '../../utils/p6/vistaEjecucion';
import type { PlanillaItem } from '../../types';

type Agrupar = 'wbs' | 'tipo' | 'grupo' | 'ubicacion' | 'subcontratista';
type Escala = 'weeks' | 'months' | 'quarters' | 'years';
type Ambito = 'todo' | 'equipo' | 'construccion';
type Serie = 'b' | 'a' | 'r' | 'f';

interface Ajustes {
  agrupar: Agrupar;
  nivelesWbs: number;
  escala: Escala;
  series: Serie[];
  acumulado: boolean;
  regla: boolean;
  ambito: Ambito;
  /** Nivel adicional por SubC (11.SubC) bajo los grupos de equipamiento. */
  subcEquipo: boolean;
}
const AJUSTES_DEF: Ajustes = { agrupar: 'tipo', nivelesWbs: 3, escala: 'months', series: ['b', 'a', 'r'], acumulado: false, regla: true, ambito: 'todo', subcEquipo: true };
const LS = 'p6.cashflow';
const leer = (): Ajustes => { try { return { ...AJUSTES_DEF, ...JSON.parse(localStorage.getItem(LS) || '{}') }; } catch { return AJUSTES_DEF; } };

const AGRUPAR: [Agrupar, string][] = [['wbs', 'WBS'], ['tipo', 'Discipline (05.Tipo)'], ['grupo', 'Group (01.Grupos)'], ['ubicacion', 'Location'], ['subcontratista', 'SubC']];
const ESCALAS: [Escala, string, number][] = [['weeks', 'Weeks', 8], ['months', 'Months', 3], ['quarters', 'Quarters', 1], ['years', 'Years', 0.5]];
const SERIES: [Serie, string, string, string][] = [
  ['b', 'Budgeted', 'Planned billing (baseline dates)', '#1F4E79'],
  ['a', 'Actual', 'Billed to date (actual cost, equipment purchase only once its freight has started)', '#2B7F52'],
  ['r', 'Remaining', 'Forecast billing (remaining cost on the remaining dates)', '#C2410C'],
  ['f', 'Act + Rem', 'Actual + Remaining (forecast at completion)', '#CD0000'],
];
const AMBITOS: [Ambito, string][] = [['todo', 'All'], ['equipo', 'Equipment'], ['construccion', 'Construction']];
const CW = 76, ANCHO_NOMBRE = 300, ANCHO_SERIE = 66, ANCHO_TOT = 104, ANCHO_PEND = 96;
const ANCHO_IZQ = ANCHO_NOMBRE + ANCHO_SERIE + ANCHO_TOT + ANCHO_PEND;
const FILA = 20;

const fmt = (v: number, dec = 0) => v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });

interface Nodo {
  key: string;
  label: string;
  nivel: number;
  hijos: Map<string, Nodo>;
  acts: number[];
  per: Record<'b' | 'a' | 'r', Float64Array>;
  tot: { b: number; a: number; r: number; p: number };
}

export const VistaCashflow: React.FC<{
  m: ModeloP6;
  version: number;
  lineaBase: LineaBaseFilas;
  nombreLB: string;
  campo: (i: number, k: CampoAgrupacion) => string;
  /** Filtros globales de la barra superior (fase y ubicación). */
  incluir: (i: number) => boolean;
  hayFiltroGlobal: boolean;
  hojasPlanilla?: PlanillaItem[];
}> = ({ m, version, lineaBase, nombreLB, campo, incluir, hayFiltroGlobal, hojasPlanilla }) => {
  const [aj, setAj] = React.useState<Ajustes>(leer);
  React.useEffect(() => { try { localStorage.setItem(LS, JSON.stringify(aj)); } catch { /* sin almacenamiento */ } }, [aj]);
  const set = <K extends keyof Ajustes>(k: K, v: Ajustes[K]) => setAj(a => ({ ...a, [k]: v }));
  const [abiertos, setAbiertos] = React.useState<Set<string>>(new Set());
  const grupo = React.useCallback((i: number) => campo(i, 'grupo'), [campo]);

  // Períodos: del primer al último valor de cualquier actividad
  const lim = React.useMemo(() => {
    const t = m.task;
    let lo = Infinity, hi = -Infinity;
    const g = (f: string[], c: string) => { const s = celda(t, f, c); if (!s) return null; const d = Date.parse(s.replace(' ', 'T') + 'Z'); return isNaN(d) ? null : d / 60000; };
    for (const f of t.filas) {
      for (const c of ['act_start_date', 'target_start_date', 'early_start_date']) { const v = g(f, c); if (v != null && v < lo) lo = v; }
      for (const c of ['act_end_date', 'target_end_date', 'early_end_date']) { const v = g(f, c); if (v != null && v > hi) hi = v; }
    }
    for (const p of lineaBase || []) { if (p?.[0] != null && p[0] < lo) lo = p[0]; if (p?.[1] != null && p[1] > hi) hi = p[1]; }
    if (!isFinite(lo) || !isFinite(hi)) return { t: [] as number[], etq: [] as string[] };
    const px = ESCALAS.find(e => e[0] === aj.escala)![2];
    const ps = periodosDeEscala(lo, hi, px);
    return { t: ps.map(p => p.t), etq: ps.slice(0, -1).map(p => p.etq) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, version, aj.escala, lineaBase]);
  const nP = Math.max(0, lim.t.length - 1);

  const flujo = React.useMemo(() => (nP ? calcularFlujo(m, lim.t, lineaBase, grupo, aj.regla) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m, version, lim, lineaBase, grupo, aj.regla]);

  // Rutas WBS (código + nombre) de cada actividad
  const rutaWbs = React.useMemo(() => {
    const w = m.xer.tablas.get('PROJWBS');
    const nodos = new Map<string, { padre: string; cod: string; nombre: string }>();
    for (const f of w?.filas || []) nodos.set(celda(w!, f, 'wbs_id'), { padre: celda(w!, f, 'parent_wbs_id'), cod: celda(w!, f, 'wbs_short_name'), nombre: celda(w!, f, 'wbs_name') });
    const cache = new Map<string, { k: string; l: string }[]>();
    const ruta = (id: string): { k: string; l: string }[] => {
      if (cache.has(id)) return cache.get(id)!;
      const n = nodos.get(id);
      if (!n) return [];
      const p = nodos.has(n.padre) ? ruta(n.padre) : [];
      const r = [...p, { k: id, l: `${n.cod} ${n.nombre}` }];
      cache.set(id, r);
      return r;
    };
    return (i: number) => ruta(celda(m.task, m.task.filas[i], 'wbs_id')).slice(1); // sin la raíz del proyecto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, version]);

  // Flete (.E) → su compra (.D), para tomar el SubC de la compra si el flete no lo tiene (como en Arrivals)
  const compraDe = React.useMemo(() => {
    const r = new Map<number, number>();
    for (const [d, e] of familiasEquipo(m, grupo)) r.set(e, d);
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, version, grupo]);
  const ruta = React.useCallback((i: number): { k: string; l: string }[] => {
    const v = (k: CampoAgrupacion, vacio: string) => campo(i, k) || vacio;
    let r: { k: string; l: string }[];
    switch (aj.agrupar) {
      case 'wbs': r = rutaWbs(i).slice(0, aj.nivelesWbs); break;
      case 'tipo': r = [v('tipo', '(no Discipline)'), v('grupo', '(no Group)')].map(l => ({ k: l, l })); break;
      case 'grupo': r = [v('grupo', '(no Group)'), v('tipo', '(no Discipline)')].map(l => ({ k: l, l })); break;
      case 'ubicacion': r = [etiquetaUbicacion(campo(i, 'ubicacion')), v('grupo', '(no Group)')].map(l => ({ k: l, l })); break;
      case 'subcontratista': return [v('subcontratista', '(no SubC)'), v('grupo', '(no Group)')].map(l => ({ k: l, l }));
    }
    // Equipamiento: un nivel más por subcontratista (CMO, Prominent…)
    if (aj.subcEquipo && esGrupoEquipo(grupo(i))) {
      const d = compraDe.get(i);
      const sc = campo(i, 'subcontratista') || (d != null ? campo(d, 'subcontratista') : '');
      r.push({ k: `subc:${sc}`, l: sc ? `SubC ${sc}` : '(no SubC assigned)' });
    }
    return r;
  }, [aj.agrupar, aj.nivelesWbs, aj.subcEquipo, campo, rutaWbs, grupo, compraDe]);

  const enAmbito = React.useCallback((i: number) => {
    if (aj.ambito === 'todo') return true;
    return esGrupoEquipo(grupo(i)) === (aj.ambito === 'equipo');
  }, [aj.ambito, grupo]);

  // Árbol con los valores por período de cada nivel
  const raiz = React.useMemo<Nodo | null>(() => {
    if (!flujo) return null;
    const nuevo = (key: string, label: string, nivel: number): Nodo => ({
      key, label, nivel, hijos: new Map(), acts: [],
      per: { b: new Float64Array(nP), a: new Float64Array(nP), r: new Float64Array(nP) }, tot: { b: 0, a: 0, r: 0, p: 0 },
    });
    const r = nuevo('', 'Total', -1);
    for (const [i, u] of flujo.porAct) {
      if (!incluir(i) || !enAmbito(i)) continue;
      const camino = [r];
      let n = r;
      for (const seg of ruta(i)) {
        let h = n.hijos.get(seg.k);
        if (!h) { h = nuevo(`${n.key}/${seg.k}`, seg.l, n.nivel + 1); n.hijos.set(seg.k, h); }
        camino.push(h); n = h;
      }
      n.acts.push(i);
      for (const nd of camino) {
        for (const s of ['b', 'a', 'r'] as const) {
          const tr = u[s];
          if (!tr) continue;
          for (let k = 0; k < tr.vals.length; k++) { nd.per[s][tr.desde + k] += tr.vals[k]; nd.tot[s] += tr.vals[k]; }
        }
        nd.tot.p += u.pendiente || 0;
      }
    }
    return r;
  }, [flujo, nP, incluir, enAmbito, ruta]);

  const orden = (a: Nodo, b: Nodo) => a.label.localeCompare(b.label, 'es', { numeric: true });
  const etqAct = (i: number) => `${celda(m.task, m.task.filas[i], 'task_code')} · ${celda(m.task, m.task.filas[i], 'task_name')}`;

  // Filas visibles
  type Fila = { tipo: 'nodo'; n: Nodo } | { tipo: 'act'; i: number; nivel: number };
  const filas = React.useMemo<Fila[]>(() => {
    const out: Fila[] = [];
    if (!raiz) return out;
    const rec = (n: Nodo) => {
      out.push({ tipo: 'nodo', n });
      if (n.nivel >= 0 && !abiertos.has(n.key)) return;
      [...n.hijos.values()].sort(orden).forEach(rec);
      if (n.nivel >= 0) [...n.acts].sort((a, b) => etqAct(a).localeCompare(etqAct(b), 'es', { numeric: true })).forEach(i => out.push({ tipo: 'act', i, nivel: n.nivel + 1 }));
    };
    rec(raiz);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raiz, abiertos]);

  const fletesFam = React.useMemo(() => new Set(flujo ? flujo.familias.values() : []), [flujo]);
  const perDD = React.useMemo(() => { let k = -1; lim.t.forEach((t, j) => { if (t <= m.fechaDatos && j < nP) k = j; }); return k; }, [lim, nP, m.fechaDatos]);
  // Al abrir o cambiar de escala, el período de la fecha de datos a la vista
  const scroller = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = scroller.current;
    if (el && perDD >= 0) el.scrollLeft = Math.max(0, perDD * CW - (el.clientWidth - ANCHO_IZQ) / 2);
  }, [perDD, aj.escala]);

  // Valores de una serie para un nodo o actividad
  const valores = React.useCallback((x: { per: Record<'b' | 'a' | 'r', Float64Array> }, s: Serie) => {
    const v = s === 'f' ? x.per.a.map((a, k) => a + x.per.r[k]) : x.per[s];
    if (!aj.acumulado) return v;
    const c = new Float64Array(v.length); let acc = 0;
    for (let k = 0; k < v.length; k++) { acc += v[k]; c[k] = acc; }
    return c;
  }, [aj.acumulado]);
  const datosAct = React.useCallback((i: number) => {
    const u = flujo?.porAct.get(i);
    const per = { b: new Float64Array(nP), a: new Float64Array(nP), r: new Float64Array(nP) };
    const tot = { b: 0, a: 0, r: 0, p: u?.pendiente || 0 };
    for (const s of ['b', 'a', 'r'] as const) { const tr = u?.[s]; if (tr) for (let k = 0; k < tr.vals.length; k++) { per[s][tr.desde + k] += tr.vals[k]; tot[s] += tr.vals[k]; } }
    return { per, tot };
  }, [flujo, nP]);

  // Cruce con la Certificación (planillas): solo equipamiento (EQ + EE de la Sábana) frente al equipamiento de T₃
  const planilla = React.useMemo(() => {
    const hojas = (hojasPlanilla || []).filter(h => h.tipoG === 'EQ' || h.tipoG === 'EE');
    if (!hojas.length) return null;
    const suma = (k: 'contrato' | 'acum' | 'anterior' | 'cert' | 'exc') => hojas.reduce((s, h) => s + (h[k] || 0), 0);
    const por = (g: string) => hojas.filter(h => h.tipoG === g).reduce((s, h) => s + (h.acum || 0), 0);
    return { contrato: suma('contrato'), acum: suma('acum'), anterior: suma('anterior'), cert: suma('cert'), exc: suma('exc'), eq: por('EQ'), ee: por('EE') };
  }, [hojasPlanilla]);
  const equipoT3 = React.useMemo(() => {
    if (!flujo) return null;
    let b = 0, a = 0, r = 0, p = 0, costoReal = 0, nPend = 0;
    for (const [i, x] of flujo.totales) {
      if (!esGrupoEquipo(grupo(i))) continue;
      costoReal += x.a; b += x.b;
    }
    for (const [i, u] of flujo.porAct) {
      if (!esGrupoEquipo(grupo(i))) continue;
      for (const s of ['a', 'r'] as const) { const tr = u[s]; if (tr) for (const v of tr.vals) { if (s === 'a') a += v; else r += v; } }
      if (u.pendiente) { p += u.pendiente; nPend++; }
    }
    return { b, a, r, p, costoReal, nPend };
  }, [flujo, grupo]);

  const exportar = () => {
    if (!raiz) return;
    const cab = ['Level', 'Name', 'Series', 'Total', 'Executed not billable', ...lim.etq];
    const datos: (string | number)[][] = [];
    const rec = (n: Nodo) => {
      for (const s of aj.series) {
        const v = valores(n, s);
        const tot = s === 'f' ? n.tot.a + n.tot.r : n.tot[s];
        datos.push([n.nivel + 1, n.nivel < 0 ? 'Total' : n.label, SERIES.find(x => x[0] === s)![1], Math.round(tot * 100) / 100, Math.round(n.tot.p * 100) / 100, ...Array.from(v, x => Math.round(x * 100) / 100)]);
      }
      [...n.hijos.values()].sort(orden).forEach(rec);
    };
    rec(raiz);
    const ws = XLSX.utils.aoa_to_sheet([cab, ...datos]);
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: datos.length, c: cab.length - 1 } }) };
    ws['!cols'] = [{ wch: 6 }, { wch: 44 }, { wch: 11 }, { wch: 15 }, { wch: 15 }, ...lim.etq.map(() => ({ wch: 13 }))];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cashflow');
    XLSX.writeFile(wb, `T3_cashflow_${aj.escala}${aj.acumulado ? '_cum' : ''}.xlsx`);
  };

  if (!raiz || !nP) {
    return <div id="p6-vista-recursos" className="flex-1 flex items-center justify-center bg-white text-[#5A6A74] text-xs">No cost assignments to analyse.</div>;
  }

  // Gráfico: período (barras Actual + Remaining) y acumulados (Budgeted y Actual + Remaining)
  const tot = raiz;
  const perAR = Array.from(tot.per.a, (a, k) => a + tot.per.r[k]);
  const cumB: number[] = [], cumF: number[] = [];
  { let x = 0, y = 0; for (let k = 0; k < nP; k++) { x += tot.per.b[k]; y += perAR[k]; cumB.push(x); cumF.push(y); } }
  const maxBar = Math.max(1, ...perAR, ...Array.from(tot.per.b));
  const maxCum = Math.max(1, cumB[nP - 1] || 0, cumF[nP - 1] || 0);
  const AG = 150, PAD = 14;
  const yBar = (v: number) => AG - PAD - (v / maxBar) * (AG - 2 * PAD);
  const yCum = (v: number) => AG - PAD - (v / maxCum) * (AG - 2 * PAD);
  const linea = (vals: number[], desde = 0, hasta = nP - 1) => vals.slice(desde, hasta + 1).map((v, k) => `${k ? 'L' : 'M'}${(desde + k + 1) * CW} ${yCum(v)}`).join(' ');
  const series = SERIES.filter(s => aj.series.includes(s[0]));
  const toggleSerie = (s: Serie) => set('series', aj.series.includes(s) ? aj.series.filter(x => x !== s) : SERIES.map(x => x[0]).filter(x => x === s || aj.series.includes(x)));
  const abrirNivel = (nivel: number) => {
    const ks = new Set<string>();
    const rec = (n: Nodo) => { if (n.nivel >= 0 && n.nivel < nivel) ks.add(n.key); n.hijos.forEach(rec); };
    rec(raiz);
    setAbiertos(ks);
  };
  const boton = (activo: boolean) => `px-2 py-0.5 rounded border text-[11px] cursor-pointer ${activo ? 'bg-[#312E81] border-[#312E81] text-white' : 'bg-white border-[#C3C3C3] text-[#14212A] hover:bg-[#F2F4F7]'}`;
  const anchoTotal = ANCHO_IZQ + nP * CW;

  return (
    <div id="p6-vista-recursos" className="flex-1 flex flex-col min-h-0 bg-white">
      {/* Barra de opciones */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 border-b border-[#D5DEE2] bg-[#F7F8FA] text-[11px] text-[#14212A]">
        <span className="font-semibold text-[12px]">Sales &amp; Cash Flow</span>
        <label className="flex items-center gap-1">Group by
          <select id="p6-cf-agrupar" value={aj.agrupar} onChange={e => { set('agrupar', e.target.value as Agrupar); setAbiertos(new Set()); }} className="border border-[#C3C3C3] rounded px-1 py-0.5 bg-white">
            {AGRUPAR.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        {aj.agrupar === 'wbs' && (
          <label className="flex items-center gap-1">Levels
            <select id="p6-cf-niveles" value={aj.nivelesWbs} onChange={e => set('nivelesWbs', Number(e.target.value))} className="border border-[#C3C3C3] rounded px-1 py-0.5 bg-white">
              {[1, 2, 3, 4, 5, 6, 8].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
        <div className="flex items-center gap-1">
          {AMBITOS.map(([k, l]) => <button key={k} id={`p6-cf-ambito-${k}`} className={boton(aj.ambito === k)} onClick={() => set('ambito', k)}>{l}</button>)}
        </div>
        <div className="flex items-center gap-1">
          {ESCALAS.map(([k, l]) => <button key={k} id={`p6-cf-escala-${k}`} className={boton(aj.escala === k)} onClick={() => set('escala', k)}>{l}</button>)}
        </div>
        <div className="flex items-center gap-1">
          {SERIES.map(([k, l, tt, col]) => (
            <button key={k} id={`p6-cf-serie-${k}`} title={tt} onClick={() => toggleSerie(k)}
              className={`px-2 py-0.5 rounded border text-[11px] cursor-pointer flex items-center gap-1 ${aj.series.includes(k) ? 'bg-white border-[#8A8FC9] shadow-sm' : 'bg-white/50 border-[#D5DEE2] text-[#9AA6AD]'}`}>
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: aj.series.includes(k) ? col : '#D5DEE2' }} />{l}
            </button>
          ))}
        </div>
        {aj.agrupar !== 'subcontratista' && (
          <label className="flex items-center gap-1 cursor-pointer" title="Equipment (Ingeniería, Procura_Eq, Flete_Eq, Precom_Eq): one more level by subcontractor (11.SubC)">
            <input id="p6-cf-subc" type="checkbox" checked={aj.subcEquipo} onChange={e => set('subcEquipo', e.target.checked)} />SubC level (Equipment)
          </label>
        )}
        <label className="flex items-center gap-1 cursor-pointer"><input id="p6-cf-acumulado" type="checkbox" checked={aj.acumulado} onChange={e => set('acumulado', e.target.checked)} />Cumulative</label>
        <label className="flex items-center gap-1 cursor-pointer" title="Equipment is billed only with its freight: the purchase (.D, 60 %) is certified together with the freight (.E, 20 %) — the whole 80 % on the day the freight starts. Off = cost as executed.">
          <input id="p6-cf-regla" type="checkbox" checked={aj.regla} onChange={e => set('regla', e.target.checked)} />Equipment billed at freight (80 %)
        </label>
        <div className="flex items-center gap-1 ml-auto">
          <button className={boton(false)} onClick={() => abrirNivel(1)}>Collapse</button>
          <button className={boton(false)} onClick={() => abrirNivel(9)}>Expand groups</button>
          <button id="p6-cf-exportar" className={`${boton(false)} flex items-center gap-1`} onClick={exportar}><Download className="w-3 h-3" />Export Excel</button>
        </div>
      </div>

      {/* Resumen y cruce con las planillas */}
      <div className="flex flex-wrap gap-2 px-3 py-2 border-b border-[#D5DEE2] text-[11px]">
        {([
          ['Budgeted', tot.tot.b, `Planned billing on the «${nombreLB}» dates`, '#1F4E79'],
          ['Actual (billed)', tot.tot.a, aj.regla ? 'Actual cost billable to the Data Date: equipment purchases only once their freight has started' : 'Actual cost as executed', '#2B7F52'],
          ['Remaining (forecast)', tot.tot.r, 'Remaining cost on the remaining dates (equipment purchase + freight: 80 % on the freight start)', '#C2410C'],
          ['Act + Rem', tot.tot.a + tot.tot.r, 'Forecast at completion', '#CD0000'],
        ] as const).map(([l, v, tt, col]) => (
          <div key={l} title={tt} className="border border-[#D5DEE2] rounded-lg px-2.5 py-1 min-w-[130px]">
            <div className="text-[10px] uppercase tracking-wide text-[#5A6A74] font-semibold">{l}</div>
            <div className="text-[15px] font-semibold" style={{ color: col }}>{fmt(v)}</div>
          </div>
        ))}
        {aj.regla && (
          <div id="p6-cf-pendiente" title="Actual cost of equipment purchases (.D) whose freight (.E) has not started: executed but not yet billable. It is billed on the day the freight starts (included in Remaining)."
            className="border border-[#F2C94C] bg-[#FFFBEA] rounded-lg px-2.5 py-1 min-w-[150px]">
            <div className="text-[10px] uppercase tracking-wide text-[#8A6D00] font-semibold">Executed not billable</div>
            <div className="text-[15px] font-semibold text-[#8A6D00]">{fmt(tot.tot.p)}</div>
            <div className="text-[10px] text-[#8A6D00]">purchase without freight · {flujo ? [...flujo.porAct].filter(([i, u]) => u.pendiente && incluir(i) && enAmbito(i)).length : 0} items</div>
          </div>
        )}
        <div id="p6-cf-planillas" className="border border-[#D5DEE2] rounded-lg px-2.5 py-1 ml-auto">
          <div className="text-[10px] uppercase tracking-wide text-[#5A6A74] font-semibold">Certification (Planillas) vs T₃ · Equipment</div>
          {planilla && equipoT3 ? (
            <table className="text-[11px] mt-0.5">
              <thead><tr className="text-[#5A6A74]"><th /><th className="px-2 text-right font-medium">Planillas</th><th className="px-2 text-right font-medium">T₃</th><th className="px-2 text-right font-medium">Diff.</th></tr></thead>
              <tbody>
                <tr><td className="pr-2" title="Planilla: contract amount of Equipamiento Mecánico + Eléctrico. T₃: budgeted cost of the equipment groups (Ingeniería, Procura_Eq, Flete_Eq, Precom_Eq)">Contract / Budget</td>
                  <td className="px-2 text-right">{fmt(planilla.contrato)}</td><td className="px-2 text-right">{fmt(equipoT3.b)}</td><td className="px-2 text-right">{fmt(equipoT3.b - planilla.contrato)}</td></tr>
                <tr><td className="pr-2" title={`Planilla: certified to date (EQ ${fmt(planilla.eq)} + EE ${fmt(planilla.ee)}; previous ${fmt(planilla.anterior)}, this period ${fmt(planilla.cert)}). T₃: billable actual with the freight rule (whole project, no filters)`}>Certified / Billable</td>
                  <td className="px-2 text-right font-semibold">{fmt(planilla.acum)}</td><td className="px-2 text-right font-semibold">{fmt(equipoT3.a)}</td>
                  <td className={`px-2 text-right font-semibold ${equipoT3.a - planilla.acum < 0 ? 'text-red-600' : 'text-[#2B7F52]'}`}>{fmt(equipoT3.a - planilla.acum)}</td></tr>
                <tr className="text-[#5A6A74]"><td className="pr-2" title="T₃ actual cost of the equipment groups as executed and the part not yet billable (purchases without freight)">Executed (T₃)</td>
                  <td /><td className="px-2 text-right">{fmt(equipoT3.costoReal)}</td><td className="px-2 text-right text-[#8A6D00]" title="Executed not billable">{fmt(equipoT3.p)}</td></tr>
              </tbody>
            </table>
          ) : <div className="text-[#9AA6AD] mt-1">Load the Master with its «Sabana» sheet to compare with the Certification.</div>}
        </div>
        {hayFiltroGlobal && <div className="text-[10px] text-[#8A6D00] self-end">Phase / location filters of the top bar applied</div>}
      </div>

      {/* Tabla con gráfico, scroll horizontal común */}
      <div ref={scroller} className="flex-1 min-h-0 overflow-auto relative" id="p6-cf-tabla">
        <div style={{ width: anchoTotal }}>
          {/* Gráfico */}
          <div className="flex border-b border-[#D5DEE2]" style={{ height: AG }}>
            <div className="sticky left-0 z-[6] bg-white border-r border-[#D5DEE2] px-3 py-2 text-[10.5px] text-[#5A6A74] flex flex-col gap-1" style={{ width: ANCHO_IZQ, minWidth: ANCHO_IZQ }}>
              <div className="font-semibold text-[#14212A]">Period ({ESCALAS.find(e => e[0] === aj.escala)![1].toLowerCase()}) and cumulative</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-2.5 bg-[#2B7F52]" />Actual (billed) per period</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-2.5 bg-[#F59E52]" />Remaining (forecast) per period</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-0 border-t-2 border-[#1F4E79]" />Cumulative Budgeted · {compacto(cumB[nP - 1] || 0)}</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-0 border-t-2 border-[#CD0000]" />Cumulative Actual + Remaining · {compacto(cumF[nP - 1] || 0)}</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-0 border-t-2 border-dashed border-[#14212A]" />Data Date</div>
              <div className="text-[9.5px] text-[#9AA6AD] mt-auto">Bars: max {compacto(maxBar)} / period · lines: max {compacto(maxCum)}</div>
            </div>
            <svg width={nP * CW} height={AG} className="block">
              {Array.from({ length: nP }, (_, k) => {
                const a = tot.per.a[k], r = tot.per.r[k];
                const x = k * CW + 14, w = CW - 28;
                return (
                  <g key={k}>
                    <title>{`${lim.etq[k]}\nBudgeted ${fmt(tot.per.b[k], 2)}\nActual ${fmt(a, 2)}\nRemaining ${fmt(r, 2)}\nCumulative Budgeted ${fmt(cumB[k], 2)}\nCumulative Act+Rem ${fmt(cumF[k], 2)}`}</title>
                    <rect x={k * CW} y={0} width={CW} height={AG} fill={k === perDD ? '#FFF7D6' : 'transparent'} />
                    {a > 0 && <rect x={x} y={yBar(a)} width={w} height={AG - PAD - yBar(a)} fill="#2B7F52" />}
                    {r > 0 && <rect x={x} y={yBar(a + r)} width={w} height={yBar(a) - yBar(a + r)} fill="#F59E52" />}
                  </g>
                );
              })}
              <path d={linea(cumB)} fill="none" stroke="#1F4E79" strokeWidth={2} />
              <path d={linea(cumF)} fill="none" stroke="#CD0000" strokeWidth={2} />
              {perDD >= 0 && (() => {
                const x = perDD * CW + ((m.fechaDatos - lim.t[perDD]) / (lim.t[perDD + 1] - lim.t[perDD])) * CW;
                return <line x1={x} x2={x} y1={0} y2={AG} stroke="#14212A" strokeDasharray="4 3" />;
              })()}
            </svg>
          </div>
          {/* Cabecera */}
          <div className="flex sticky top-0 z-[7] bg-[#ECECEC] border-b border-[#C3C3C3] text-[10.5px] font-semibold text-[#14212A]" style={{ height: 22 }}>
            <div className="sticky left-0 z-[8] flex bg-[#ECECEC] border-r border-[#C3C3C3]" style={{ width: ANCHO_IZQ }}>
              <div className="px-2 flex items-center" style={{ width: ANCHO_NOMBRE }}>{AGRUPAR.find(a => a[0] === aj.agrupar)![1]}</div>
              <div className="px-1 flex items-center" style={{ width: ANCHO_SERIE }}>Series</div>
              <div className="px-1 flex items-center justify-end" style={{ width: ANCHO_TOT }}>Total</div>
              <div className="px-1 flex items-center justify-end" style={{ width: ANCHO_PEND }} title="Executed not billable: actual cost of equipment purchases whose freight has not started">Not billable</div>
            </div>
            {lim.etq.map((e, k) => (
              <div key={k} className={`flex items-center justify-center border-r border-[#D5DEE2] ${k === perDD ? 'bg-[#FFE9A8]' : ''}`} style={{ width: CW, minWidth: CW }}>{e}</div>
            ))}
          </div>
          {/* Filas */}
          {filas.map(fl => {
            const esNodo = fl.tipo === 'nodo';
            const n = esNodo ? fl.n : null;
            const datos = esNodo ? n! : datosAct(fl.i);
            const nivel = esNodo ? n!.nivel : fl.nivel;
            const key = esNodo ? `n${n!.key}` : `a${fl.i}`;
            const abierto = esNodo && abiertos.has(n!.key);
            const tieneHijos = esNodo && nivel >= 0 && (n!.hijos.size > 0 || n!.acts.length > 0);
            const fondo = !esNodo ? 'bg-white' : nivel < 0 ? 'bg-[#14212A] text-white' : nivel === 0 ? 'bg-[#DCE6F0]' : nivel === 1 ? 'bg-[#EEF3F8]' : 'bg-[#F7F9FB]';
            const etiqueta = esNodo ? n!.label : etqAct(fl.i);
            return (
              <div key={key} data-cf-fila={esNodo ? (nivel < 0 ? 'total' : 'grupo') : 'act'} className={`border-b border-[#E3E8EB] ${fondo}`}>
                {series.map(([s, l, , col], si) => {
                  const v = valores(datos, s);
                  const total = s === 'f' ? datos.tot.a + datos.tot.r : datos.tot[s as 'b' | 'a' | 'r'];
                  return (
                    <div key={s} className="flex text-[10.5px]" style={{ height: FILA }}>
                      <div className={`sticky left-0 z-[5] flex border-r border-[#D5DEE2] ${fondo}`} style={{ width: ANCHO_IZQ }}>
                        <div className="flex items-center overflow-hidden" style={{ width: ANCHO_NOMBRE, paddingLeft: 4 + Math.max(0, nivel) * 10 }}>
                          {si === 0 && (
                            <>
                              {tieneHijos ? (
                                <button className="w-4 h-4 flex items-center justify-center cursor-pointer shrink-0"
                                  onClick={() => setAbiertos(a => { const x = new Set(a); if (x.has(n!.key)) x.delete(n!.key); else x.add(n!.key); return x; })}>
                                  {abierto ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                </button>
                              ) : <span className="w-4 shrink-0" />}
                              <span className={`truncate ${esNodo ? 'font-semibold' : ''}`} title={etiqueta}>{etiqueta}</span>
                              {!esNodo && aj.regla && fletesFam.has(fl.i) && <span className="ml-1 text-[9px] px-1 rounded bg-[#FFF2C2] text-[#8A6D00] shrink-0" title="Freight row: bills its own 20 % plus the purchase (.D) 60 % on the day the freight starts">80 %</span>}
                              {!esNodo && aj.regla && flujo?.familias.has(fl.i) && <span className="ml-1 text-[9px] px-1 rounded bg-[#EEF0F2] text-[#5A6A74] shrink-0" title="Purchase: billed in its freight (.E) row">→ freight</span>}
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1 px-1" style={{ width: ANCHO_SERIE }}><span className="w-2 h-2 rounded-sm shrink-0" style={{ background: col }} />{l}</div>
                        <div className="flex items-center justify-end px-1 font-semibold" style={{ width: ANCHO_TOT }} title={fmt(total, 2)}>{fmt(total)}</div>
                        <div className="flex items-center justify-end px-1 text-[#8A6D00]" style={{ width: ANCHO_PEND }} title={datos.tot.p ? fmt(datos.tot.p, 2) : ''}>{si === 0 && datos.tot.p ? fmt(datos.tot.p) : ''}</div>
                      </div>
                      {Array.from(v, (x, k) => (
                        <div key={k} className={`flex items-center justify-end px-1 border-r border-[#EEF0F2] ${k === perDD ? 'bg-[#FFF7D6]/60' : ''} ${nivel < 0 && esNodo ? 'text-white' : ''}`}
                          style={{ width: CW, minWidth: CW, color: nivel < 0 && esNodo ? undefined : x ? col : '#C3C3C3' }} title={`${lim.etq[k]} · ${l}: ${fmt(x, 2)}`}>
                          {x ? compacto(x) : ''}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
