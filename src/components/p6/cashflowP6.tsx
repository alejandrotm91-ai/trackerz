/**
 * Vista «Cashflow» de T₃ (antes «Resources»): análisis de la venta y el cashflow (`utils/p6/cashflow.ts`).
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
import { periodosDeEscala, type LineaBaseFilas } from '../../utils/p6/uso';
import { calcularFlujo, esGrupoEquipo, familiasEquipo, PCT_INICIO_INSTALACION } from '../../utils/p6/cashflow';
import { fletesImportados } from '../../utils/p6/llegadas';
import type { FilaMatriz } from '../../utils/p6/matrizLlegadas';
import { etiquetaUbicacion, type CampoAgrupacion } from '../../utils/p6/vistaEjecucion';
import type { PlanillaItem } from '../../types';
import { apiFetch } from '../../utils/api';

/** Regla de ajuste del Remaining (compartida en la nube, la edita el admin). */
interface ReglaRestante { activa: boolean; subc: string; texto: string; pct: number }
const DOC_REGLAS = '/api/docs/p6_cashflow_ajustes';
const REGLAS_DEF: ReglaRestante[] = [
  { activa: true, subc: 'Juana', texto: 'adoqu', pct: 60 },
  { activa: true, subc: 'Juana', texto: 'canaleta', pct: 60 },
  { activa: true, subc: 'EECOL', texto: 'cablead', pct: 75 },
];
const PI = Math.round(PCT_INICIO_INSTALACION * 100), PF = 100 - PI;
/** Grupo de la partida D (WBS «D», pendientes de confirmar por el Ingeniero): aislado y siempre al final. */
const CLAVE_D = '__partidaD__';
const ETQ_D = 'Partida D – Pendientes de confirmar por el Ingeniero';
const normTxt = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

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
  /** Corte de cobro de los fletes: después de este día del mes, al mes siguiente (0 = sin corte). */
  corteFlete: number;
}
const AJUSTES_DEF: Ajustes = { agrupar: 'tipo', nivelesWbs: 3, escala: 'months', series: ['b', 'a', 'r'], acumulado: false, regla: true, ambito: 'todo', subcEquipo: true, corteFlete: 22 };
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
const CW = 104, ANCHO_NOMBRE = 300, ANCHO_SERIE = 66, ANCHO_TOT = 118, ANCHO_PEND = 108;
const ANCHO_IZQ = ANCHO_NOMBRE + ANCHO_SERIE + ANCHO_TOT + ANCHO_PEND;
const FILA = 20;

const fmt = (v: number, dec = 2) => v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });

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
  /** El admin puede editar las reglas de ajuste del Remaining. */
  editable?: boolean;
}> = ({ m, version, lineaBase, nombreLB, campo, incluir, hayFiltroGlobal, hojasPlanilla, editable }) => {
  const [aj, setAj] = React.useState<Ajustes>(leer);
  React.useEffect(() => { try { localStorage.setItem(LS, JSON.stringify(aj)); } catch { /* sin almacenamiento */ } }, [aj]);
  const set = <K extends keyof Ajustes>(k: K, v: Ajustes[K]) => setAj(a => ({ ...a, [k]: v }));
  const [abiertos, setAbiertos] = React.useState<Set<string>>(new Set());
  const grupo = React.useCallback((i: number) => campo(i, 'grupo'), [campo]);

  // Reglas de ajuste del Remaining: cada período al % y el saldo al último período con Remaining
  const [reglas, setReglas] = React.useState<ReglaRestante[]>(REGLAS_DEF);
  const [verReglas, setVerReglas] = React.useState(false);
  const [estadoReglas, setEstadoReglas] = React.useState('');
  React.useEffect(() => {
    let vivo = true;
    apiFetch(DOC_REGLAS, { cache: 'no-store' }, [404]).then(async r => {
      if (vivo && r.status !== 404) { const v = await r.json(); if (Array.isArray(v)) setReglas(v); }
    }).catch(() => { /* sin red: reglas por defecto */ });
    return () => { vivo = false; };
  }, []);
  const guardarReglas = async (rs: ReglaRestante[]) => {
    setReglas(rs);
    if (!editable) return;
    setEstadoReglas('Saving…');
    try {
      await apiFetch(DOC_REGLAS, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rs) });
      setEstadoReglas('Saved for everyone');
    } catch (e) { setEstadoReglas(`Not saved: ${(e as Error)?.message || e}`); }
  };
  const reglaDe = React.useCallback((i: number): ReglaRestante | null => {
    const sc = normTxt(campo(i, 'subcontratista'));
    if (!sc) return null;
    for (const r of reglas) {
      if (!r.activa || !r.subc.trim() || normTxt(r.subc) !== sc) continue;
      const q = normTxt(r.texto);
      if (q && !normTxt(`${celda(m.task, m.task.filas[i], 'task_name')} ${campo(i, 'scap')}`).includes(q)) continue;
      return r;
    }
    return null;
  }, [reglas, campo, m]);
  const [borrador, setBorrador] = React.useState<ReglaRestante[]>(REGLAS_DEF);
  React.useEffect(() => { if (verReglas) setBorrador(reglas.map(r => ({ ...r }))); }, [verReglas, reglas]);
  const statsReglas = React.useMemo(() => {
    if (!verReglas) return [];
    const tot = new Map<string, number>();
    const tr = m.xer.tablas.get('TASKRSRC');
    for (const f of tr?.filas || []) { const id = celda(tr!, f, 'task_id'); tot.set(id, (tot.get(id) || 0) + (Number(celda(tr!, f, 'remain_cost')) || 0)); }
    return borrador.map(r => {
      let n = 0, rem = 0;
      const sc = normTxt(r.subc), q = normTxt(r.texto);
      if (!sc) return { n, rem };
      m.task.filas.forEach((f, i) => {
        if (normTxt(campo(i, 'subcontratista')) !== sc) return;
        if (q && !normTxt(`${celda(m.task, f, 'task_name')} ${campo(i, 'scap')}`).includes(q)) return;
        const x = tot.get(celda(m.task, f, 'task_id')) || 0;
        if (x > 0.005) { n++; rem += x; }
      });
      return { n, rem };
    });
  }, [verReglas, borrador, m, campo]);
  const subcs = React.useMemo(() => {
    if (!verReglas) return [] as string[];
    const s = new Set<string>();
    m.task.filas.forEach((_, i) => { const v = campo(i, 'subcontratista'); if (v) s.add(v); });
    return [...s].sort((a, b) => a.localeCompare(b, 'es'));
  }, [verReglas, m, campo]);
  // Matriz de importación (Arrivals): los fletes que no están en ella son nacionales y se cobran al terminar
  const [filasMatriz, setFilasMatriz] = React.useState<FilaMatriz[] | null>(null);
  React.useEffect(() => {
    let vivo = true;
    apiFetch('/api/docs/p6_matriz_llegadas', { cache: 'no-store' }, [404]).then(async r => {
      if (vivo && r.status !== 404) { const v = await r.json(); if (Array.isArray(v?.filas)) setFilasMatriz(v.filas); }
    }).catch(() => { /* sin matriz: todos los fletes al inicio */ });
    return () => { vivo = false; };
  }, []);
  const importados = React.useMemo(() => (filasMatriz ? fletesImportados(m, filasMatriz) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m, version, filasMatriz]);
  const fleteNacional = React.useMemo(() => (importados ? (iE: number) => !importados.has(iE) : undefined), [importados]);
  const factorRestante = React.useCallback((i: number) => { const r = reglaDe(i); return r ? Math.min(100, Math.max(0, r.pct)) / 100 : null; }, [reglaDe]);

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

  const flujo = React.useMemo(() => (nP ? calcularFlujo(m, lim.t, lineaBase, grupo, aj.regla, aj.corteFlete || null, factorRestante, fleteNacional) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m, version, lim, lineaBase, grupo, aj.regla, aj.corteFlete, factorRestante, fleteNacional]);

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
  // Partida D: WBS de primer nivel «D» (pendientes de confirmar por el Ingeniero)
  const esPartidaD = React.useMemo(() => {
    const w = m.xer.tablas.get('PROJWBS');
    const nodos = new Map<string, { padre: string; cod: string }>();
    for (const f of w?.filas || []) nodos.set(celda(w!, f, 'wbs_id'), { padre: celda(w!, f, 'parent_wbs_id'), cod: celda(w!, f, 'wbs_short_name') });
    const cache = new Map<string, boolean>();
    const enD = (id: string): boolean => {
      if (cache.has(id)) return cache.get(id)!;
      const r: string[] = [];
      for (let x = nodos.get(id); x; x = nodos.get(x.padre)) r.unshift(x.cod);
      const v = r[1] === 'D';
      cache.set(id, v);
      return v;
    };
    return (i: number) => enD(celda(m.task, m.task.filas[i], 'wbs_id'));
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
    const d = esPartidaD(i);
    switch (aj.agrupar) {
      case 'wbs': {
        r = rutaWbs(i).slice(0, aj.nivelesWbs);
        if (d && r.length) r[0] = { k: CLAVE_D, l: r[0].l };
        return r;
      }
      case 'tipo': r = [v('tipo', '(no Discipline)'), v('grupo', '(no Group)')].map(l => ({ k: l, l })); break;
      case 'grupo': r = [v('grupo', '(no Group)'), v('tipo', '(no Discipline)')].map(l => ({ k: l, l })); break;
      case 'ubicacion': r = [etiquetaUbicacion(campo(i, 'ubicacion')), v('grupo', '(no Group)')].map(l => ({ k: l, l })); break;
      case 'subcontratista': r = [v('subcontratista', '(no SubC)'), v('grupo', '(no Group)')].map(l => ({ k: l, l })); break;
    }
    // Equipamiento: un nivel más por subcontratista (CMO, Prominent…)
    if (aj.agrupar !== 'subcontratista' && aj.subcEquipo && esGrupoEquipo(grupo(i))) {
      const d = compraDe.get(i);
      const sc = campo(i, 'subcontratista') || (d != null ? campo(d, 'subcontratista') : '');
      r.push({ k: `subc:${sc}`, l: sc ? `SubC ${sc}` : '(no SubC assigned)' });
    }
    // Partida D: aislada en su propio grupo de primer nivel, siempre al final
    return d ? [{ k: CLAVE_D, l: ETQ_D }, ...r] : r;
  }, [aj.agrupar, aj.nivelesWbs, aj.subcEquipo, campo, rutaWbs, grupo, compraDe, esPartidaD]);

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
    // La partida D lleva el número siguiente al último de los grupos numerados (p. ej. «12.»)
    const gD = r.hijos.get(CLAVE_D);
    if (gD && aj.agrupar !== 'wbs') {
      const nums = [...r.hijos.values()].filter(h => h !== gD).map(h => /^(\d+)\s*\./.exec(h.label)?.[1]).filter(Boolean).map(Number);
      if (nums.length) gD.label = `${String(Math.max(...nums) + 1).padStart(2, '0')}. ${ETQ_D}`;
    }
    return r;
  }, [flujo, nP, incluir, enAmbito, ruta, aj.agrupar]);

  const esD = (n: Nodo) => n.key.endsWith(`/${CLAVE_D}`);
  const orden = (a: Nodo, b: Nodo) => Number(esD(a)) - Number(esD(b)) || a.label.localeCompare(b.label, 'es', { numeric: true });
  const etqAct = (i: number) => `${celda(m.task, m.task.filas[i], 'task_code')} · ${celda(m.task, m.task.filas[i], 'task_name')}`;

  const datosAct = React.useCallback((i: number) => {
    const u = flujo?.porAct.get(i);
    const per = { b: new Float64Array(nP), a: new Float64Array(nP), r: new Float64Array(nP) };
    const tot = { b: 0, a: 0, r: 0, p: u?.pendiente || 0 };
    for (const s of ['b', 'a', 'r'] as const) { const tr = u?.[s]; if (tr) for (let k = 0; k < tr.vals.length; k++) { per[s][tr.desde + k] += tr.vals[k]; tot[s] += tr.vals[k]; } }
    return { per, tot };
  }, [flujo, nP]);

  // Orden por un período (clic en la cabecera del mes o de Total): mayor → menor → menor → mayor → normal
  const [ordenCol, setOrdenCol] = React.useState<{ col: number | 'tot'; dir: 1 | -1 } | null>(null);
  React.useEffect(() => setOrdenCol(null), [aj.escala]);
  const serieOrden: Serie = aj.series[0] ?? 'b';
  const valorOrden = React.useCallback((x: { per: Record<'b' | 'a' | 'r', Float64Array>; tot: { b: number; a: number; r: number } }) => {
    if (!ordenCol) return 0;
    const s = serieOrden;
    if (ordenCol.col === 'tot') return s === 'f' ? x.tot.a + x.tot.r : x.tot[s];
    const v = (k: number) => (s === 'f' ? x.per.a[k] + x.per.r[k] : x.per[s][k]);
    if (!aj.acumulado) return v(ordenCol.col);
    let acc = 0; for (let k = 0; k <= ordenCol.col; k++) acc += v(k);
    return acc;
  }, [ordenCol, serieOrden, aj.acumulado]);
  const clicOrden = (col: number | 'tot') => setOrdenCol(o => (!o || o.col !== col ? { col, dir: -1 } : o.dir === -1 ? { col, dir: 1 } : null));
  const flechaOrden = (col: number | 'tot') => (ordenCol?.col === col ? (ordenCol.dir === -1 ? ' ▼' : ' ▲') : '');
  const nombreSerieOrden = SERIES.find(x => x[0] === serieOrden)![1];

  // Filtro por período: clic en una barra del gráfico (otra vez o ✕ para quitarlo). Solo filas con importe en ese
  // período (series visibles, valor del período —no acumulado—) y solo esa columna con valores.
  const [perSel, setPerSel] = React.useState<number | null>(null);
  React.useEffect(() => setPerSel(null), [aj.escala]);
  const tieneEnPer = React.useCallback((x: { per: Record<'b' | 'a' | 'r', Float64Array> }) => {
    if (perSel == null) return true;
    return aj.series.some(sr => Math.abs(sr === 'f' ? x.per.a[perSel] + x.per.r[perSel] : x.per[sr][perSel]) >= 0.005);
  }, [perSel, aj.series]);

  // Filas visibles
  type Fila = { tipo: 'nodo'; n: Nodo } | { tipo: 'act'; i: number; nivel: number };
  const filas = React.useMemo<Fila[]>(() => {
    const out: Fila[] = [];
    if (!raiz) return out;
    const rec = (n: Nodo) => {
      out.push({ tipo: 'nodo', n });
      if (n.nivel >= 0 && !abiertos.has(n.key)) return;
      const hijos = [...n.hijos.values()];
      if (ordenCol) hijos.sort((a, b) => Number(esD(a)) - Number(esD(b)) || ordenCol.dir * (valorOrden(a) - valorOrden(b)) || orden(a, b)); else hijos.sort(orden);
      hijos.filter(h => tieneEnPer(h)).forEach(rec);
      if (n.nivel >= 0) {
        const acts = perSel == null ? [...n.acts] : n.acts.filter(i => tieneEnPer(datosAct(i)));
        const porNombre = (a: number, b: number) => etqAct(a).localeCompare(etqAct(b), 'es', { numeric: true });
        if (ordenCol) { const val = new Map(acts.map(i => [i, valorOrden(datosAct(i))])); acts.sort((a, b) => ordenCol.dir * (val.get(a)! - val.get(b)!) || porNombre(a, b)); } else acts.sort(porNombre);
        acts.forEach(i => out.push({ tipo: 'act', i, nivel: n.nivel + 1 }));
      }
    };
    rec(raiz);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raiz, abiertos, ordenCol, valorOrden, datosAct, perSel, tieneEnPer]);

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
    // Una columna por nivel de la jerarquía y otra para el SubC (nivel adicional del equipamiento)
    const nivelesCab = aj.agrupar === 'wbs' ? Array.from({ length: aj.nivelesWbs }, (_, k) => `WBS ${k + 1}`)
      : aj.agrupar === 'tipo' ? ['Discipline (05.Tipo)', 'Group (01.Grupos)']
      : aj.agrupar === 'grupo' ? ['Group (01.Grupos)', 'Discipline (05.Tipo)']
      : aj.agrupar === 'ubicacion' ? ['Location', 'Group (01.Grupos)']
      : ['SubC', 'Group (01.Grupos)'];
    const conSubc = aj.agrupar !== 'subcontratista' && aj.subcEquipo;
    const perExp = perSel == null ? lim.etq.map((_, k) => k) : [perSel];
    const cab = ['Level', ...nivelesCab, ...(conSubc ? ['SubC'] : []), 'Series', 'Total', 'Executed not billable', ...perExp.map(k => lim.etq[k])];
    const nNum = 2 + perExp.length; // Total, Executed not billable y los períodos
    const datos: (string | number)[][] = [];
    const r2 = (x: number) => Math.round(x * 100) / 100;
    const rec = (n: Nodo, camino: string[], subc: string) => {
      aj.series.forEach((s, si) => {
        const v = valores(n, s);
        const tot = s === 'f' ? n.tot.a + n.tot.r : n.tot[s];
        const niveles = nivelesCab.map((_, k) => (n.nivel < 0 ? (k === 0 ? 'Total' : '') : camino[k] ?? ''));
        datos.push([n.nivel + 1, ...niveles, ...(conSubc ? [subc] : []), SERIES.find(x => x[0] === s)![1], r2(tot), si === 0 ? r2(n.tot.p) : 0, ...perExp.map(k => r2(v[k]))]);
      });
      [...n.hijos.values()].sort(orden).filter(h => tieneEnPer(h)).forEach(h => {
        const esSubc = (h.key.split('/').pop() || '').startsWith('subc:');
        if (esSubc) rec(h, camino, (h.key.split('/').pop() || '').slice(5) || '(no SubC assigned)');
        else rec(h, [...camino, h.label], subc);
      });
    };
    rec(raiz, [], '');
    const ws = XLSX.utils.aoa_to_sheet([cab, ...datos]);
    // Importes con miles y 2 decimales
    const c0 = cab.length - nNum;
    for (let r = 1; r <= datos.length; r++) {
      for (let c = c0; c < cab.length; c++) {
        const cel = ws[XLSX.utils.encode_cell({ r, c })];
        if (cel && cel.t === 'n') cel.z = '#,##0.00';
      }
    }
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: datos.length, c: cab.length - 1 } }) };
    ws['!cols'] = [{ wch: 6 }, ...nivelesCab.map(() => ({ wch: 32 })), ...(conSubc ? [{ wch: 18 }] : []), { wch: 11 }, { wch: 17 }, { wch: 17 }, ...perExp.map(() => ({ wch: 15 }))];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cashflow');
    XLSX.writeFile(wb, `T3_cashflow_${aj.escala}${perSel != null ? `_${lim.etq[perSel].replace(/\s+/g, '')}` : ''}${aj.acumulado ? '_cum' : ''}.xlsx`);
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
        <span className="font-semibold text-[12px]">Cashflow</span>
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
        <label className="flex items-center gap-1 cursor-pointer" title={`Equipment billing rule: the purchase (.D, 60 %) is certified together with the freight (.E, 20 %) — the whole 80 % on the day the freight starts (imported, in the Arrivals matrix) or finishes (national freights, not in the matrix${importados ? '' : ' — matrix not loaded: all at the start'}); the installation (.F, 20 %) in two milestones: ${PI} % on its start day and ${PF} % on its finish day. Off = cost as executed.`}>
          <input id="p6-cf-regla" type="checkbox" checked={aj.regla} onChange={e => set('regla', e.target.checked)} />Equipment billing (80 % freight · {PI}/{PF} installation)
        </label>
        <div className="relative">
          <button id="p6-cf-reglas" onClick={() => setVerReglas(v => !v)}
            title="Remaining adjustments: for the activities of a SubC (and text in the name or SCAP) each period of Remaining is kept at a % and the rest goes to their last period"
            className={`px-2 py-0.5 rounded border text-[11px] cursor-pointer ${reglas.some(r => r.activa) ? 'bg-[#FFF2C2] border-[#E3B505] text-[#6B5200]' : 'bg-white border-[#C3C3C3]'}`}>
            Remaining adj. ({reglas.filter(r => r.activa).length})
          </button>
          {verReglas && (
            <div id="p6-cf-reglas-panel" className="absolute right-0 top-full mt-1 z-[30] bg-white border border-[#C3C3C3] rounded-lg shadow-xl p-3 w-[640px] text-[11px]" onClick={e => e.stopPropagation()}>
              <div className="font-semibold text-[12px] mb-1">Remaining adjustments</div>
              <div className="text-[#5A6A74] mb-2">For each activity of the SubC whose name or SCAP contains the text, every period of its <b>Remaining</b> is kept at the % and the rest is moved to its last period with Remaining (the total does not change). Budgeted and Actual are not touched. Shared with everyone{editable ? '' : ' · only the admin can change them'}.</div>
              <table className="w-full border-collapse">
                <thead><tr className="text-[#5A6A74] text-left">
                  <th className="py-1 pr-1">On</th><th className="py-1 pr-1">SubC</th><th className="py-1 pr-1">Name / SCAP contains</th><th className="py-1 pr-1 text-right">% per period</th><th className="py-1 pr-1 text-right">Activities</th><th className="py-1 pr-1 text-right">Remaining</th><th />
                </tr></thead>
                <tbody>
                  {borrador.map((r, k) => (
                    <tr key={k} className="border-t border-[#EEF0F2]">
                      <td className="py-1 pr-1"><input type="checkbox" disabled={!editable} checked={r.activa} onChange={e => setBorrador(b => b.map((x, j) => (j === k ? { ...x, activa: e.target.checked } : x)))} /></td>
                      <td className="py-1 pr-1"><input list="p6-cf-subcs" disabled={!editable} value={r.subc} onChange={e => setBorrador(b => b.map((x, j) => (j === k ? { ...x, subc: e.target.value } : x)))} className="w-32 border border-[#C3C3C3] rounded px-1 py-0.5" /></td>
                      <td className="py-1 pr-1"><input disabled={!editable} value={r.texto} placeholder="(all)" onChange={e => setBorrador(b => b.map((x, j) => (j === k ? { ...x, texto: e.target.value } : x)))} className="w-36 border border-[#C3C3C3] rounded px-1 py-0.5" /></td>
                      <td className="py-1 pr-1 text-right"><input type="number" min={0} max={100} disabled={!editable} value={r.pct} onChange={e => setBorrador(b => b.map((x, j) => (j === k ? { ...x, pct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) } : x)))} className="w-14 border border-[#C3C3C3] rounded px-1 py-0.5 text-right" /> %</td>
                      <td className="py-1 pr-1 text-right">{statsReglas[k]?.n ?? 0}</td>
                      <td className="py-1 pr-1 text-right">{fmt(statsReglas[k]?.rem ?? 0)}</td>
                      <td className="py-1">{editable && <button className="text-[#B30000] cursor-pointer px-1" title="Remove rule" onClick={() => setBorrador(b => b.filter((_, j) => j !== k))}>✕</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <datalist id="p6-cf-subcs">{subcs.map(x => <option key={x} value={x} />)}</datalist>
              <div className="flex items-center gap-2 mt-2">
                {editable && <button className={boton(false)} onClick={() => setBorrador(b => [...b, { activa: true, subc: '', texto: '', pct: 100 }])}>+ Add rule</button>}
                <span className="text-[#8A6D00]">{estadoReglas}</span>
                <button className={`${boton(false)} ml-auto`} onClick={() => setVerReglas(false)}>Close</button>
                {editable && <button id="p6-cf-reglas-guardar" className={boton(true)} onClick={() => { guardarReglas(borrador); setVerReglas(false); }}>Apply &amp; save</button>}
              </div>
            </div>
          )}
        </div>
        {aj.regla && (
          <label className="flex items-center gap-1" title="Freight billing cut-off: a freight billing (80 %) dated after this day of the month moves to the 1st of the next month. 0 = no cut-off.">
            Freight cut-off day
            <input id="p6-cf-corte" type="number" min={0} max={31} value={aj.corteFlete}
              onChange={e => set('corteFlete', Math.min(31, Math.max(0, Math.round(Number(e.target.value) || 0))))}
              className="w-12 border border-[#C3C3C3] rounded px-1 py-0.5 bg-white text-right" />
          </label>
        )}
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
          <div id="p6-cf-pendiente" title={`Executed but not yet billable: actual cost of equipment purchases (.D) whose freight (.E) has not started (billed on the day the freight starts) and of equipment installations (.F) in progress above the ${PI} % billed at their start (the ${PF} % is billed on their finish day). Included in Remaining.`}
            className="border border-[#F2C94C] bg-[#FFFBEA] rounded-lg px-2.5 py-1 min-w-[150px]">
            <div className="text-[10px] uppercase tracking-wide text-[#8A6D00] font-semibold">Executed not billable</div>
            <div className="text-[15px] font-semibold text-[#8A6D00]">{fmt(tot.tot.p)}</div>
            <div className="text-[10px] text-[#8A6D00]">{(() => {
              const pend = flujo ? [...flujo.porAct].filter(([i, u]) => u.pendiente && incluir(i) && enAmbito(i)) : [];
              const inst = pend.filter(([i]) => flujo!.instalaciones.has(i));
              const sumInst = inst.reduce((acc, [, u]) => acc + (u.pendiente || 0), 0);
              return `purchase without freight · ${pend.length - inst.length} items${inst.length ? ` | installation in progress · ${inst.length} items (${fmt(sumInst)})` : ''}`;
            })()}</div>
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
              <div className="font-semibold text-[#14212A] flex items-center gap-2">Period ({ESCALAS.find(e => e[0] === aj.escala)![1].toLowerCase()}) and cumulative
                {perSel != null ? (
                  <span id="p6-cf-periodo-sel" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#312E81] text-white font-semibold text-[10px]"
                    title="The table shows only the rows with an amount in this period. Click the bar again or ✕ to clear">
                    Filtered: {lim.etq[perSel]}
                    <button className="cursor-pointer hover:text-[#FFB4B4]" onClick={() => setPerSel(null)} title="Clear period filter">✕</button>
                  </span>
                ) : <span className="font-normal text-[#9AA6AD]">· click a bar to filter its period</span>}
              </div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-2.5 bg-[#2B7F52]" />Actual (billed) per period</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-2.5 bg-[#F59E52]" />Remaining (forecast) per period</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-0 border-t-2 border-[#1F4E79]" />Cumulative Budgeted · {fmt(cumB[nP - 1] || 0)}</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-0 border-t-2 border-[#CD0000]" />Cumulative Actual + Remaining · {fmt(cumF[nP - 1] || 0)}</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-0 border-t-2 border-dashed border-[#14212A]" />Data Date</div>
              <div className="text-[9.5px] text-[#9AA6AD] mt-auto">Bars: max {fmt(maxBar)} / period · lines: max {fmt(maxCum)}</div>
            </div>
            <svg width={nP * CW} height={AG} className="block">
              {Array.from({ length: nP }, (_, k) => {
                const a = tot.per.a[k], r = tot.per.r[k];
                const x = k * CW + 14, w = CW - 28;
                return (
                  <g key={k} data-cf-barra={k} className="cursor-pointer" opacity={perSel != null && perSel !== k ? 0.35 : 1}
                    onClick={() => setPerSel(p => (p === k ? null : k))}>
                    <title>{`${lim.etq[k]} · click to filter this period\nBudgeted ${fmt(tot.per.b[k], 2)}\nActual ${fmt(a, 2)}\nRemaining ${fmt(r, 2)}\nCumulative Budgeted ${fmt(cumB[k], 2)}\nCumulative Act+Rem ${fmt(cumF[k], 2)}`}</title>
                    <rect x={k * CW} y={0} width={CW} height={AG} fill={k === perSel ? '#E0E3F5' : k === perDD ? '#FFF7D6' : 'transparent'}
                      stroke={k === perSel ? '#312E81' : 'none'} strokeWidth={k === perSel ? 1.5 : 0} />
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
              <div id="p6-cf-orden-tot" className={`px-1 flex items-center justify-end cursor-pointer hover:bg-white/70 ${ordenCol?.col === 'tot' ? 'text-[#312E81]' : ''}`} style={{ width: ANCHO_TOT }}
                onClick={() => clicOrden('tot')} title={`Sort by Total (${nombreSerieOrden}): highest first, lowest first, original order`}>Total{flechaOrden('tot')}</div>
              <div className="px-1 flex items-center justify-end" style={{ width: ANCHO_PEND }} title={`Executed not billable: actual cost of equipment purchases whose freight has not started and of installations in progress above the ${PI} % billed at their start`}>Not billable</div>
            </div>
            {lim.etq.map((e, k) => (
              <div key={k} data-cf-periodo={k} onClick={() => clicOrden(k)} title={`Sort by ${e} (${nombreSerieOrden}${aj.acumulado ? ', cumulative' : ''}): highest first, lowest first, original order`}
                className={`flex items-center justify-center border-r border-[#D5DEE2] cursor-pointer hover:bg-white/70 ${perSel === k ? 'bg-[#312E81] text-white' : k === perDD ? 'bg-[#FFE9A8]' : ''} ${perSel != null && perSel !== k ? 'text-[#9AA6AD]' : ''} ${ordenCol?.col === k && perSel !== k ? 'text-[#312E81] bg-[#E0E3F5]' : ''}`} style={{ width: CW, minWidth: CW }}>{e}{flechaOrden(k)}</div>
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
                              {!esNodo && aj.regla && fletesFam.has(fl.i) && (flujo?.nacionales.has(fl.i)
                                ? <span className="ml-1 text-[9px] px-1 rounded bg-[#FDE2CF] text-[#9A3412] shrink-0" title="National freight (not in the import matrix): bills its own 20 % plus the purchase (.D) 60 % on the day the freight FINISHES">80 % · national @ finish</span>
                                : <span className="ml-1 text-[9px] px-1 rounded bg-[#FFF2C2] text-[#8A6D00] shrink-0" title="Imported freight (in the import matrix): bills its own 20 % plus the purchase (.D) 60 % on the day the freight starts">80 %</span>)}
                              {!esNodo && aj.regla && flujo?.instalaciones.has(fl.i) && <span className="ml-1 text-[9px] px-1 rounded bg-[#E3F1EA] text-[#2B7F52] shrink-0" title={`Equipment installation: ${PI} % billed on the start day, ${PF} % on the finish day`}>{PI}/{PF}</span>}
                              {!esNodo && aj.regla && flujo?.familias.has(fl.i) && <span className="ml-1 text-[9px] px-1 rounded bg-[#EEF0F2] text-[#5A6A74] shrink-0" title="Purchase: billed in its freight (.E) row">→ freight</span>}
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1 px-1" style={{ width: ANCHO_SERIE }}><span className="w-2 h-2 rounded-sm shrink-0" style={{ background: col }} />{l}</div>
                        <div className="flex items-center justify-end px-1 font-semibold" style={{ width: ANCHO_TOT }} title={fmt(total, 2)}>{fmt(total)}</div>
                        <div className="flex items-center justify-end px-1 text-[#8A6D00]" style={{ width: ANCHO_PEND }} title={datos.tot.p ? fmt(datos.tot.p, 2) : ''}>{si === 0 && Math.abs(datos.tot.p) >= 0.005 ? fmt(datos.tot.p) : ''}</div>
                      </div>
                      {Array.from(v, (x0, k) => { const x = perSel == null || perSel === k ? x0 : 0; return (
                        <div key={k} className={`flex items-center justify-end px-1 border-r border-[#EEF0F2] ${perSel === k ? 'bg-[#E0E3F5]/70 font-semibold' : perSel != null ? 'bg-[#F4F5F7]/60' : k === perDD ? 'bg-[#FFF7D6]/60' : ''} ${nivel < 0 && esNodo ? 'text-white' : ''}`}
                          style={{ width: CW, minWidth: CW, color: nivel < 0 && esNodo ? undefined : Math.abs(x) >= 0.005 ? col : '#C3C3C3' }} title={`${lim.etq[k]} · ${l}: ${fmt(x, 2)}`}>
                          {Math.abs(x) >= 0.005 ? fmt(x) : ''}
                        </div>
                      ); })}
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
