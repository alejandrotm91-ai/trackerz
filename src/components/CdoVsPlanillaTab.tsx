/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Comparación CDO vs Planilla, partida por partida (criterio de la hoja "e.14" del Excel).
 * Toma las filas del Master en vivo: lo que se edita en la pestaña Master se ve aquí.
 */
import React from 'react';
import * as XLSX from 'xlsx';
import { ChevronDown, ChevronRight, Download, Search } from 'lucide-react';
import { ctTipoCfg } from '../utils/helpers';
import type { Actividad, PlanillaItem } from '../types';
import { useMasterVivo, FUENTE_LABEL } from '../utils/masterLive';
import {
  construirComparacion, calcularDeltas, estadoDe, planillaTieneCruce,
  ESTADO_LABEL, TOLERANCIA,
  type CvsLeaf, type Estado, type ModoComparacion,
} from '../utils/cdoVsPlanilla';

interface CdoVsPlanillaTabProps {
  hojas: PlanillaItem[];
  /** Filtro externo (tipología de contrato): solo partidas con alguna de estas hojas de la Planilla. */
  codigosPlanilla?: Set<string> | null;
  /** Aviso del filtro externo para mostrar en la cabecera. */
  filtroEtiqueta?: React.ReactNode;
  grupos: PlanillaItem[];
  actividades: Actividad[];
  mapaColumnasMes?: Record<string, number>;
}

type Vista = 'jerarquica' | 'plana';
type FiltroEstado = 'todas' | 'conDif' | 'pos' | 'neg' | Estado;
type ColOrden = 'cod' | 'desc' | 'vA' | 'vB' | 'porQ' | 'porP' | 'dV';

const MODO_TXT: Record<ModoComparacion, { a: string; b: string; qa: string; qb: string; titulo: string }> = {
  presupuesto: { a: 'Contrato', b: 'Master', qa: 'Q contrato', qb: 'Q Master', titulo: 'Presupuesto · Contrato vs Master' },
  avance: { a: 'Planillado', b: 'Ejecutado', qa: 'Q planillada', qb: 'Q ejecutada', titulo: 'Avance · Planillado vs Ejecutado Master' },
};

const ESTADO_CLS: Record<Estado, string> = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  dif: 'bg-amber-50 text-amber-800 border-amber-200',
  soloMaster: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  soloPlanilla: 'bg-slate-100 text-slate-700 border-slate-300',
  capitulo: 'bg-orange-50 text-orange-700 border-orange-200',
};

const fmt0 = (v: number) => Math.round(v || 0).toLocaleString('en-US');
const fmt2 = (v: number) => (v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtQ = (v: number) => (v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const fmtM = (v: number) => `${(v / 1e6).toFixed(2)}M`;
const signo = (v: number) => (v >= 0.5 ? '+' : '');
/** Diferencia con signo; lo que redondea a 0 se muestra como 0. */
const fmtDif = (v: number) => (Math.abs(v) < 0.5 ? '0' : `${signo(v)}${fmt0(v)}`);
const colorDif = (v: number) =>
  Math.abs(v) <= TOLERANCIA ? 'text-gray-400' : v > 0 ? 'text-emerald-700' : 'text-red-600';

const normalizar = (s: string) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const compararCodigo = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

const esPrecioNuevo = (partida: string) => /^c[pn]-/i.test(partida);

/** Une las hojas de una misma partida en una sola fila (vista plana, como la hoja e.14). */
function unirPorPartida(leaves: CvsLeaf[]): CvsLeaf[] {
  const mapa = new Map<string, CvsLeaf>();
  for (const l of leaves) {
    const k = l.partida.toLowerCase();
    const u = mapa.get(k);
    if (!u) {
      mapa.set(k, { ...l, key: `p:${k}`, master: [...l.master], planilla: [...l.planilla] });
      continue;
    }
    u.qC += l.qC; u.vC += l.vC; u.qP += l.qP; u.vP += l.vP;
    u.qM += l.qM; u.vM += l.vM; u.qE += l.qE; u.vE += l.vE;
    u.master.push(...l.master);
    if (l.cruce !== 'capitulo') u.planilla.push(...l.planilla);
    if (!u.tarifa) u.tarifa = l.tarifa;
    if (!u.precioM) u.precioM = l.precioM;
    if (!u.sugerencia) u.sugerencia = l.sugerencia;
    u.unidadDistinta = u.unidadDistinta || l.unidadDistinta;
    u.porCodigoPlan = u.porCodigoPlan || l.porCodigoPlan;
    if (u.cruce !== l.cruce) {
      const tieneP = u.vC + u.vP > 0 || u.planilla.length > 0;
      u.cruce = u.master.length > 0 && tieneP ? 'ambos' : u.master.length > 0 ? 'soloMaster' : 'soloPlanilla';
    }
    if (u.cruce !== 'ambos' && u.cruce !== 'capitulo' && u.master.length > 0 && u.vC + u.vP > 0) u.cruce = 'ambos';
  }
  return [...mapa.values()];
}

/** Colores por nivel, iguales a la tabla Control de Ejecución (Cronograma). */
const NIVELES = [
  { fila: 'bg-[#F5F8F9] hover:bg-[#EEF2F3] font-bold', borde: 'shadow-[inset_3px_0_0_#5A6A74]', chevron: 'text-[#5A6A74]', badge: 'bg-white text-[#5A6A74] border border-[#D5DEE2]' },
  { fila: 'bg-[#EAF6EE] hover:bg-[#DDF0E4] font-semibold', borde: 'shadow-[inset_3px_0_0_#2B7F52]', chevron: 'text-[#2B7F52]', badge: 'bg-white text-[#2B7F52] border border-[#CFE8D7]' },
  { fila: 'bg-[#EAF2FB] hover:bg-[#DCE9F7] font-semibold', borde: 'shadow-[inset_3px_0_0_#2C67A6]', chevron: 'text-[#2C67A6]', badge: 'bg-white text-[#2C67A6] border border-[#CCDDF1]' },
  { fila: 'bg-[#FBF4E6] hover:bg-[#F6EBD3] font-semibold', borde: 'shadow-[inset_3px_0_0_#A86B12]', chevron: 'text-[#A86B12]', badge: 'bg-white text-[#A86B12] border border-[#EEDDBA]' },
  { fila: 'bg-[#FDF1F1] hover:bg-[#F9E3E3] font-semibold', borde: 'shadow-[inset_3px_0_0_#CD0000]', chevron: 'text-[#CD0000]', badge: 'bg-white text-[#CD0000] border border-[#F3D2D2]' },
  { fila: 'bg-[#E8F6F5] hover:bg-[#D9EFEE] font-semibold', borde: 'shadow-[inset_3px_0_0_#0F766E]', chevron: 'text-[#0F766E]', badge: 'bg-white text-[#0F766E] border border-[#C6E4E2]' },
  { fila: 'bg-[#FBEFF2] hover:bg-[#F6E1E7] font-semibold', borde: 'shadow-[inset_3px_0_0_#B4235A]', chevron: 'text-[#B4235A]', badge: 'bg-white text-[#B4235A] border border-[#EDCDD7]' },
];

interface Grupo {
  cod: string;
  hijos: string[];
  hojas: CvsLeaf[];
}

interface Suma {
  n: number; vA: number; vB: number; porQ: number; porP: number; dV: number;
}

const sumaVacia = (): Suma => ({ n: 0, vA: 0, vB: 0, porQ: 0, porP: 0, dV: 0 });

export const CdoVsPlanillaTab: React.FC<CdoVsPlanillaTabProps> = ({ hojas, grupos, actividades, mapaColumnasMes, codigosPlanilla, filtroEtiqueta }) => {
  const [open, setOpen] = React.useState(false);
  const [modo, setModo] = React.useState<ModoComparacion>('presupuesto');
  const [vista, setVista] = React.useState<Vista>('jerarquica');
  const [filtroEstado, setFiltroEstado] = React.useState<FiltroEstado>('todas');
  const [filtroTipo, setFiltroTipo] = React.useState('');
  const [busquedaTmp, setBusquedaTmp] = React.useState('');
  const [busqueda, setBusqueda] = React.useState('');
  const [orden, setOrden] = React.useState<{ col: ColOrden; dir: 1 | -1 }>({ col: 'cod', dir: 1 });
  const [expandidos, setExpandidos] = React.useState<Set<string>>(new Set());
  const [detalle, setDetalle] = React.useState<string | null>(null);
  const [pagina, setPagina] = React.useState(1);
  const [verAlertas, setVerAlertas] = React.useState(false);
  const [alertaTab, setAlertaTab] = React.useState<'soloMaster' | 'soloPlanilla' | 'capitulo'>('soloMaster');
  const [alertasN, setAlertasN] = React.useState(50);
  const POR_PAGINA = 100;

  const tieneCruce = React.useMemo(() => planillaTieneCruce(hojas), [hojas]);
  const master = useMasterVivo(actividades, mapaColumnasMes, open && tieneCruce);

  const resultadoTodo = React.useMemo(() => {
    if (!tieneCruce || master.items.length === 0) return null;
    return construirComparacion(master.items, hojas, grupos);
  }, [tieneCruce, master.items, hojas, grupos]);

  // Filtro por tipología de contrato (viene de la tarjeta "Resumen por Tipología")
  const resultado = React.useMemo(() => {
    if (!resultadoTodo || !codigosPlanilla) return resultadoTodo;
    return { ...resultadoTodo, leaves: resultadoTodo.leaves.filter(l => l.planilla.some(p => codigosPlanilla.has(p.cod))) };
  }, [resultadoTodo, codigosPlanilla]);

  const txt = MODO_TXT[modo];

  // ── Totales generales (cabecera) ──
  const totales = React.useMemo(() => {
    if (!resultado) return null;
    const t = { presupuesto: sumaVacia(), avance: sumaVacia() };
    for (const l of resultado.leaves) {
      for (const m of ['presupuesto', 'avance'] as const) {
        const d = calcularDeltas(l, m);
        const s = t[m];
        s.n++; s.vA += d.vA; s.vB += d.vB; s.dV += d.dV; s.porQ += d.porCantidad; s.porP += d.porPrecio;
      }
    }
    return t;
  }, [resultado]);

  // ── Filas base según la vista ──
  const filasBase = React.useMemo(() => {
    if (!resultado) return [] as CvsLeaf[];
    return vista === 'plana' ? unirPorPartida(resultado.leaves) : resultado.leaves;
  }, [resultado, vista]);

  const coincideBusqueda = React.useCallback((l: CvsLeaf) => {
    if (!busqueda.trim()) return true;
    const texto = normalizar([l.partida, l.cod, l.desc, l.tipo, ...l.master.map(m => m.activityId)].join(' '));
    return busqueda.split('+').map(p => normalizar(p.trim())).filter(Boolean).every(p => texto.includes(p));
  }, [busqueda]);

  const pasaEstado = React.useCallback((l: CvsLeaf) => {
    if (filtroEstado === 'todas') return true;
    const e = estadoDe(l, modo);
    const d = calcularDeltas(l, modo).dV;
    if (filtroEstado === 'conDif') return e !== 'ok';
    if (filtroEstado === 'pos') return d > TOLERANCIA;
    if (filtroEstado === 'neg') return d < -TOLERANCIA;
    return e === filtroEstado;
  }, [filtroEstado, modo]);

  // Filas que pasan búsqueda y estado (las tarjetas por tipo se calculan sobre estas)
  const filasSinTipo = React.useMemo(
    () => filasBase.filter(l => coincideBusqueda(l) && pasaEstado(l)),
    [filasBase, coincideBusqueda, pasaEstado]
  );
  const filas = React.useMemo(
    () => (filtroTipo ? filasSinTipo.filter(l => (l.tipo || '') === filtroTipo) : filasSinTipo),
    [filasSinTipo, filtroTipo]
  );

  // ── Tarjetas por tipo ──
  const tarjetasTipo = React.useMemo(() => {
    const g = new Map<string, Suma & { pos: number; neg: number }>();
    for (const l of filasSinTipo) {
      const t = l.tipo || '';
      if (!g.has(t)) g.set(t, { ...sumaVacia(), pos: 0, neg: 0 });
      const s = g.get(t)!;
      const d = calcularDeltas(l, modo);
      s.n++; s.vA += d.vA; s.vB += d.vB; s.dV += d.dV;
      if (d.dV > TOLERANCIA) s.pos += d.dV; else if (d.dV < -TOLERANCIA) s.neg += d.dV;
    }
    return [...g.entries()].map(([tipo, s]) => ({ tipo, ...s })).sort((a, b) => Math.max(b.vA, b.vB) - Math.max(a.vA, a.vB));
  }, [filasSinTipo, modo]);

  // ── Conteo por estado (botones de filtro) ──
  const conteoEstado = React.useMemo(() => {
    const c: Record<Estado, { n: number; v: number }> = {
      ok: { n: 0, v: 0 }, dif: { n: 0, v: 0 }, soloMaster: { n: 0, v: 0 }, soloPlanilla: { n: 0, v: 0 }, capitulo: { n: 0, v: 0 },
    };
    for (const l of filasBase) {
      const e = estadoDe(l, modo);
      const d = calcularDeltas(l, modo);
      c[e].n++;
      c[e].v += d.dV;
    }
    return c;
  }, [filasBase, modo]);

  // ── Orden ──
  const valorOrden = React.useCallback((l: CvsLeaf): number | string => {
    const d = calcularDeltas(l, modo);
    switch (orden.col) {
      case 'cod': return vista === 'plana' ? l.partida : l.cod;
      case 'desc': return l.desc;
      case 'vA': return d.vA;
      case 'vB': return d.vB;
      case 'porQ': return d.porCantidad;
      case 'porP': return d.porPrecio;
      default: return d.dV;
    }
  }, [orden.col, modo, vista]);

  const ordenar = React.useCallback((ls: CvsLeaf[]) => {
    return [...ls].sort((a, b) => {
      const va = valorOrden(a), vb = valorOrden(b);
      const r = typeof va === 'string' ? compararCodigo(va, String(vb)) : (va as number) - (vb as number);
      return r * orden.dir;
    });
  }, [valorOrden, orden.dir]);

  // ── Árbol por código de planeamiento ──
  const arbol = React.useMemo(() => {
    const g = new Map<string, Grupo>();
    const sumas = new Map<string, Suma>();
    const raices: string[] = [];
    const hojasRaiz: CvsLeaf[] = [];
    const asegurar = (cod: string) => {
      if (g.has(cod)) return;
      g.set(cod, { cod, hijos: [], hojas: [] });
      const segs = cod.split('.');
      if (segs.length === 1) raices.push(cod);
      else {
        const padre = segs.slice(0, -1).join('.');
        asegurar(padre);
        g.get(padre)!.hijos.push(cod);
      }
    };
    for (const l of filas) {
      const d = calcularDeltas(l, modo);
      if (!l.grupo) { hojasRaiz.push(l); continue; }
      asegurar(l.grupo);
      g.get(l.grupo)!.hojas.push(l);
      const segs = l.grupo.split('.');
      for (let i = 1; i <= segs.length; i++) {
        const k = segs.slice(0, i).join('.');
        if (!sumas.has(k)) sumas.set(k, sumaVacia());
        const s = sumas.get(k)!;
        s.n++; s.vA += d.vA; s.vB += d.vB; s.dV += d.dV; s.porQ += d.porCantidad; s.porP += d.porPrecio;
      }
    }
    g.forEach(x => x.hijos.sort(compararCodigo));
    raices.sort(compararCodigo);
    return { g, sumas, raices, hojasRaiz };
  }, [filas, modo]);

  /** Subgrupos y partidas de un nivel. Por código: todo intercalado; por otra columna: grupos y luego partidas. */
  const contenido = (hijos: string[], hojas: CvsLeaf[]): { k: string; code: string; cod?: string; l?: CvsLeaf }[] => {
    type Item = { k: string; code: string; cod?: string; l?: CvsLeaf };
    const gs: Item[] = hijos.map(h => ({ k: `g:${h}`, code: h, cod: h }));
    if (orden.col !== 'cod') return [...gs, ...ordenar(hojas).map((l): Item => ({ k: l.key, code: l.cod, l }))];
    const hs: Item[] = hojas.map(l => ({ k: l.key, code: `${l.cod}`, l }));
    // Con el mismo código, la partida va antes que la carpeta
    return [...gs, ...hs].sort((a, b) =>
      (compararCodigo(a.code, b.code) || (a.l ? 0 : 1) - (b.l ? 0 : 1) || compararCodigo(a.l?.partida || '', b.l?.partida || '')) * orden.dir);
  };

  const totalFiltrado = React.useMemo(() => {
    const s = sumaVacia();
    for (const l of filas) {
      const d = calcularDeltas(l, modo);
      s.n++; s.vA += d.vA; s.vB += d.vB; s.dV += d.dV; s.porQ += d.porCantidad; s.porP += d.porPrecio;
    }
    return s;
  }, [filas, modo]);

  const filasPlanas = React.useMemo(() => (vista === 'plana' ? ordenar(filas) : []), [vista, filas, ordenar]);

  React.useEffect(() => { setPagina(1); }, [vista, modo, filtroEstado, filtroTipo, busqueda, orden]);

  const autoExpandir = !!busqueda.trim();
  const estaExpandido = (cod: string) => autoExpandir || expandidos.has(cod);
  const alternar = (cod: string) => setExpandidos(prev => {
    const n = new Set(prev);
    if (n.has(cod)) n.delete(cod); else n.add(cod);
    return n;
  });

  const ordenarPor = (col: ColOrden) =>
    setOrden(o => (o.col === col ? { col, dir: (o.dir * -1) as 1 | -1 } : { col, dir: col === 'cod' || col === 'desc' ? 1 : -1 }));

  // ── Exportar a Excel (una fila por partida, como la hoja e.14) ──
  const exportar = () => {
    if (!resultado) return;
    const filasX = unirPorPartida(resultado.leaves).filter(l => coincideBusqueda(l) && pasaEstado(l) && (!filtroTipo || l.tipo === filtroTipo));
    const datos = ordenar(filasX).map(l => {
      const p = calcularDeltas(l, 'presupuesto');
      const a = calcularDeltas(l, 'avance');
      return {
        'Partida': l.partida, 'Cód. planeamiento': l.cod, 'Descripción': l.desc, 'Unidad': l.unidad, 'Tipo': l.tipo,
        'Estado (presupuesto)': ESTADO_LABEL[estadoDe(l, 'presupuesto')],
        'Q contrato': l.qC, 'Tarifa': l.tarifa, 'Monto contrato': l.vC,
        'Q Master': l.qM, 'Precio Master': l.precioM, 'Venta Master': l.vM,
        'Δ Q': p.dQ, 'Δ Precio': l.tarifa && l.precioM ? l.precioM - l.tarifa : 0, 'Δ Venta': p.dV,
        'Δ por cantidad': p.separable ? p.porCantidad : '', 'Δ por precio': p.separable ? p.porPrecio : '',
        'Q planillada': l.qP, 'Planillado': l.vP, 'Q ejecutada': l.qE, 'Ejecutado Master': l.vE, 'Δ Avance': a.dV,
        'Nota': [l.unidadDistinta ? 'Unidad distinta' : '', l.porCodigoPlan ? 'Cruzada por código de planeamiento' : '', l.sugerencia ? `¿Será ${l.sugerencia}?` : ''].filter(Boolean).join(' · '),
      };
    });
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CDO vs Planilla');
    XLSX.writeFile(wb, `CDO_vs_Planilla_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ── Celdas ──
  const NCOLS = 14;

  const Th: React.FC<{ col?: ColOrden; right?: boolean; children: React.ReactNode; title?: string }> = ({ col, right, children, title }) => (
    <th
      title={title}
      onClick={col ? () => ordenarPor(col) : undefined}
      className={`whitespace-nowrap select-none ${col ? 'cursor-pointer' : ''} ${right ? 'text-right' : 'text-left'}`}
    >
      {children}
      {col && <span className={`ml-1 text-[9px] ${orden.col === col ? '' : 'text-gray-300'}`}>{orden.col === col ? (orden.dir === -1 ? '▼' : '▲') : '⇅'}</span>}
    </th>
  );

  const Encabezado = () => (
    <tr>
      <th className="w-6"></th>
      <Th col="cod">{vista === 'plana' ? 'Partida' : 'Código'}</Th>
      <Th col="desc">Descripción</Th>
      <Th>Und</Th>
      <Th right title={modo === 'presupuesto' ? 'Cantidad del contrato (Sabana, Col L)' : 'Cantidad planillada acumulada (Sabana, Col R)'}>{txt.qa}</Th>
      <Th right title="Cantidad del Master × Step (Col F × Col H)">{txt.qb}</Th>
      <Th right title="Tarifa del contrato (Sabana, Col M)">Tarifa</Th>
      <Th right title="Precio unitario del Master (Col G)">P. Master</Th>
      <Th col="vA" right>{txt.a}</Th>
      <Th col="vB" right>{txt.b}</Th>
      <Th col="porQ" right title="Diferencia de cantidad × tarifa">Δ por cantidad</Th>
      <Th col="porP" right title="Resto de la diferencia: viene del precio">Δ por precio</Th>
      <Th col="dV" right>Δ total</Th>
      <Th>Estado</Th>
    </tr>
  );

  const Badge: React.FC<{ e: Estado }> = ({ e }) => (
    <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-semibold whitespace-nowrap ${ESTADO_CLS[e]}`}>{ESTADO_LABEL[e]}</span>
  );

  const FilaDetalle: React.FC<{ l: CvsLeaf }> = ({ l }) => (
    <tr>
      <td colSpan={NCOLS} className="!bg-slate-50 !p-3">
        <div className="grid gap-3 lg:grid-cols-2 text-[11px]">
          <div>
            <div className="font-semibold text-slate-700 mb-1">Planilla (Sabana) · {l.planilla.length} fila(s)</div>
            {l.planilla.length === 0 ? (
              <div className="text-slate-500">La partida no está en la Planilla{l.sugerencia ? ` · ¿será ${l.sugerencia}?` : ''}.</div>
            ) : (
              <table className="!text-[11px]">
                <thead><tr><th>Cód. plan</th><th>Partida</th><th className="text-right">Q contrato</th><th className="text-right">Tarifa</th><th className="text-right">Monto</th><th className="text-right">Q planillada</th><th className="text-right">Planillado</th></tr></thead>
                <tbody>
                  {l.planilla.map((p, i) => (
                    <tr key={i}>
                      <td>{p.cod}</td><td>{p.partida}</td>
                      <td className="text-right">{fmtQ(p.cantidad)}</td><td className="text-right">{fmt2(p.tarifa)}</td><td className="text-right">{fmt0(p.monto)}</td>
                      <td className="text-right">{fmtQ(p.cantPlan)}</td><td className="text-right">{fmt0(p.montoPlan)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div>
            <div className="font-semibold text-slate-700 mb-1">Master · {l.master.length} fila(s)</div>
            {l.master.length === 0 ? (
              <div className="text-slate-500">Ninguna fila del Master tiene este id.orig{l.sugerencia ? ` · ¿será ${l.sugerencia}?` : ''}.</div>
            ) : (
              <table className="!text-[11px]">
                <thead><tr><th>Activity ID</th><th>WBS</th><th>Und</th><th className="text-right">Q</th><th className="text-right">Precio</th><th className="text-right">Step</th><th className="text-right">Venta</th><th className="text-right">Q ejec.</th><th className="text-right">Ejecutado</th><th className="text-right">Asignado</th></tr></thead>
                <tbody>
                  {l.master.map((m, i) => (
                    <tr key={i} title={m.descripcion}>
                      <td>{m.activityId || '—'}</td><td>{m.wbs}</td><td>{m.unidad}</td>
                      <td className="text-right">{fmtQ(m.cantidad)}</td><td className="text-right">{fmt2(m.precio)}</td><td className="text-right">{m.step}</td>
                      <td className="text-right">{fmt0(m.venta)}</td><td className="text-right">{fmtQ(m.cantEjec)}</td><td className="text-right">{fmt0(m.ventaEjec)}</td>
                      <td className="text-right">{m.peso === 1 ? '100%' : `${(m.peso * 100).toFixed(1)}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </td>
    </tr>
  );

  const FilaHoja: React.FC<{ l: CvsLeaf; depth: number }> = ({ l, depth }) => {
    const d = calcularDeltas(l, modo);
    const e = estadoDe(l, modo);
    const abierta = detalle === l.key;
    const codigo = vista === 'plana' ? l.partida : l.partida;
    return (
      <>
        <tr className={`cursor-pointer ${abierta ? '!bg-amber-50' : ''}`} onClick={() => setDetalle(abierta ? null : l.key)}>
          <td style={{ paddingLeft: 4 + depth * 14 }} className="text-gray-400">
            {abierta ? <ChevronDown className="w-3 h-3 inline" /> : <ChevronRight className="w-3 h-3 inline opacity-40" />}
          </td>
          <td className="whitespace-nowrap text-[11px]" title={`Cód. planeamiento ${l.cod}`}>
            {codigo}
            {vista === 'jerarquica' && l.planilla.length > 0 && /^[\d.]+$/.test(l.partida) && l.partida !== l.cod && (
              <span className="ml-1 text-[9px] text-gray-400">(plan {l.cod})</span>
            )}
          </td>
          <td className="max-w-[205px] truncate" title={l.desc}>
            {l.desc}
            {l.unidadDistinta && <span className="ml-1 text-[9px] px-1 rounded bg-rose-50 text-rose-700 border border-rose-200" title="La unidad del contrato y la del Master no coinciden: no se puede separar cantidad y precio">Und ≠</span>}
            {l.porCodigoPlan && <span className="ml-1 text-[9px] px-1 rounded bg-sky-50 text-sky-700 border border-sky-200" title="El id.orig del Master coincide con el código de planeamiento de la Sabana, no con su partida">Cód. plan</span>}
            {esPrecioNuevo(l.partida) && l.cruce === 'soloMaster' && <span className="ml-1 text-[9px] px-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200" title="Precio nuevo (CP/CN) que aún no está en la Planilla">Precio nuevo</span>}
          </td>
          <td className="text-[11px] text-gray-500">{l.unidad}</td>
          <td className="text-right">{d.qA ? fmtQ(d.qA) : '—'}</td>
          <td className="text-right">{d.qB ? fmtQ(d.qB) : '—'}</td>
          <td className="text-right">{l.tarifa ? fmt2(l.tarifa) : '—'}</td>
          <td className={`text-right ${l.tarifa && l.precioM && Math.abs(l.precioM - l.tarifa) > 0.005 ? 'text-amber-700 font-semibold' : ''}`}>{l.precioM ? fmt2(l.precioM) : '—'}</td>
          <td className="text-right">{fmt0(d.vA)}</td>
          <td className="text-right">{fmt0(d.vB)}</td>
          <td className={`text-right ${d.separable ? colorDif(d.porCantidad) : 'text-gray-300'}`}>{d.separable ? fmtDif(d.porCantidad) : '—'}</td>
          <td className={`text-right ${d.separable ? colorDif(d.porPrecio) : 'text-gray-300'}`}>{d.separable ? fmtDif(d.porPrecio) : '—'}</td>
          <td className={`text-right font-semibold ${colorDif(d.dV)}`}>{fmtDif(d.dV)}</td>
          <td><Badge e={e} /></td>
        </tr>
        {abierta && <FilaDetalle l={l} />}
      </>
    );
  };

  const FilaGrupo: React.FC<{ cod: string; depth: number }> = ({ cod, depth }) => {
    const g = arbol.g.get(cod);
    const s = arbol.sumas.get(cod);
    if (!g || !s || s.n === 0) return null;
    // Un código con una sola partida y sin subgrupos se muestra como la partida
    if (g.hijos.length === 0 && g.hojas.length === 1 && g.hojas[0].cod === cod) return <FilaHoja l={g.hojas[0]} depth={depth} />;
    const abierto = estaExpandido(cod);
    const desc = resultado?.groupDesc[cod] || g.hojas[0]?.desc || '';
    const nv = NIVELES[Math.min(depth, NIVELES.length - 1)];
    return (
      <>
        <tr className={`cvs-grupo ${nv.fila} text-[#14212A] cursor-pointer`} onClick={() => alternar(cod)}>
          <td className={nv.borde} style={{ paddingLeft: 4 + depth * 14 }}>
            {abierto ? <ChevronDown className={`w-3.5 h-3.5 inline ${nv.chevron}`} /> : <ChevronRight className={`w-3.5 h-3.5 inline ${nv.chevron}`} />}
          </td>
          <td className="whitespace-nowrap">
            {cod} <span className={`ml-1 text-[9px] font-normal px-1.5 rounded-full ${nv.badge}`} title={`${s.n} partidas`}>{s.n}</span>
          </td>
          <td className="max-w-[205px] truncate" title={desc}>{desc || '—'}</td>
          <td></td><td></td><td></td><td></td><td></td>
          <td className="text-right">{fmt0(s.vA)}</td>
          <td className="text-right">{fmt0(s.vB)}</td>
          <td className={`text-right ${colorDif(s.porQ)}`}>{fmtDif(s.porQ)}</td>
          <td className={`text-right ${colorDif(s.porP)}`}>{fmtDif(s.porP)}</td>
          <td className={`text-right ${colorDif(s.dV)}`}>{fmtDif(s.dV)}</td>
          <td></td>
        </tr>
        {abierto && (
          <>
            {contenido(g.hijos, g.hojas).map(it => it.l
              ? <FilaHoja key={it.k} l={it.l} depth={depth + 1} />
              : <FilaGrupo key={it.k} cod={it.cod!} depth={depth + 1} />)}
          </>
        )}
      </>
    );
  };

  const FilaTotal: React.FC<{ s: Suma; etiqueta: string }> = ({ s, etiqueta }) => (
    <tr className="ht-g lv0">
      <td></td>
      <td colSpan={7}>{etiqueta} · {s.n.toLocaleString('en-US')} partidas</td>
      <td className="text-right">{fmt0(s.vA)}</td>
      <td className="text-right">{fmt0(s.vB)}</td>
      <td className="text-right">{fmtDif(s.porQ)}</td>
      <td className="text-right">{fmtDif(s.porP)}</td>
      <td className="text-right">{fmtDif(s.dV)}</td>
      <td></td>
    </tr>
  );

  // ── Alertas: partidas sin cruce ──
  const alertas = React.useMemo(() => {
    if (!resultado) return { soloMaster: [], soloPlanilla: [], capitulo: [] } as Record<'soloMaster' | 'soloPlanilla' | 'capitulo', CvsLeaf[]>;
    const ls = unirPorPartida(resultado.leaves.filter(l => l.cruce !== 'ambos'));
    const importe = (l: CvsLeaf) => Math.max(Math.abs(l.vM), Math.abs(l.vC), Math.abs(l.vE), Math.abs(l.vP));
    const por = (c: CvsLeaf['cruce']) => ls.filter(l => l.cruce === c).sort((a, b) => importe(b) - importe(a));
    return { soloMaster: por('soloMaster'), soloPlanilla: por('soloPlanilla'), capitulo: por('capitulo') };
  }, [resultado]);

  const ALERTA_TXT = {
    soloMaster: 'Partidas del Master que no están en la Planilla (en su mayoría precios nuevos CP/CN).',
    soloPlanilla: 'Partidas de la Planilla sin filas en el Master.',
    capitulo: 'Partidas numéricas del Master que en la Planilla están en otro capítulo.',
  };

  const tp = totales;

  return (
    <div id="cdo-vs-planilla-container" className="ht-card bg-white rounded-xl shadow-sm border border-gray-200">
      <div
        id="cdo-vs-planilla-header"
        className="ht-head flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-gray-50 rounded-xl"
        onClick={() => setOpen(o => !o)}
      >
        <h2 className="text-base font-bold text-gray-800 flex items-center gap-3 flex-wrap">
          <span className="ht-title">Comparación CDO vs Planilla</span>
          <span className="ht-sub hidden lg:inline">Master vs Planilla (Sabana) por partida · cantidad, precio y monto</span>
          {filtroEtiqueta && <span onClick={e => e.stopPropagation()}>{filtroEtiqueta}</span>}
          {tp && (
            <span className="flex gap-2 text-xs font-normal">
              <span className={`px-2 py-0.5 rounded border bg-white ${colorDif(tp.presupuesto.dV)}`} title="Venta Master − Monto contrato">
                Master − Contrato: {signo(tp.presupuesto.dV)}{fmtM(tp.presupuesto.dV)}
              </span>
              <span className={`px-2 py-0.5 rounded border bg-white ${colorDif(tp.avance.dV)}`} title="Ejecutado Master − Planillado acumulado">
                Ejecutado − Planillado: {signo(tp.avance.dV)}{fmtM(tp.avance.dV)}
              </span>
            </span>
          )}
        </h2>
        <button
          id="btn-toggle-cdo-vs-planilla"
          className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:bg-blue-50 transition-colors text-lg font-bold leading-none"
        >
          {open ? '−' : '+'}
        </button>
      </div>

      {open && (
        <div className="px-5 pb-5 pt-3">
          {!tieneCruce ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
              Para comparar por partida hay que volver a cargar el Excel una vez:{' '}
              <strong>Cloud → Cargar Nuevo Archivo Excel → Sincronizar Nube</strong>.
              La Planilla guardada no trae todavía la partida ni las cantidades.
            </div>
          ) : !resultado ? (
            <div className="py-10 text-center text-sm text-gray-500">Cargando el Master…</div>
          ) : (
            <>
              {/* Controles */}
              <div className="flex items-center gap-3 flex-wrap mb-3">
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-[12px]">
                  {(['presupuesto', 'avance'] as const).map(m => (
                    <button key={m} type="button" onClick={() => setModo(m)}
                      className={`px-3 py-1.5 cursor-pointer ${modo === m ? 'bg-[#CD0000] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
                      {MODO_TXT[m].titulo}
                    </button>
                  ))}
                </div>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-[12px]">
                  {(['jerarquica', 'plana'] as const).map(v => (
                    <button key={v} type="button" onClick={() => setVista(v)}
                      className={`px-3 py-1.5 cursor-pointer ${vista === v ? 'bg-slate-800 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
                      {v === 'jerarquica' ? 'Jerárquica' : 'Plana (por partida)'}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-gray-500">
                  Fuente: {master.fuente ? FUENTE_LABEL[master.fuente] : '—'}
                </span>
                <button type="button" onClick={exportar}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[12px] text-gray-700 hover:bg-gray-50 cursor-pointer">
                  <Download className="w-3.5 h-3.5" /> Exportar Excel
                </button>
              </div>

              {/* Resumen del modo */}
              {tp && (() => {
                const s = tp[modo];
                const sinSeparar = s.dV - s.porQ - s.porP;
                return (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
                    <div className="border border-gray-200 rounded-lg p-2.5">
                      <div className="text-[11px] text-gray-500">{txt.a}</div>
                      <div className="text-lg font-semibold">{fmt0(s.vA)}</div>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-2.5">
                      <div className="text-[11px] text-gray-500">{txt.b}</div>
                      <div className="text-lg font-semibold">{fmt0(s.vB)}</div>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-2.5">
                      <div className="text-[11px] text-gray-500">Diferencia ({txt.b} − {txt.a})</div>
                      <div className={`text-lg font-semibold ${colorDif(s.dV)}`}>{fmtDif(s.dV)}</div>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-2.5 text-[12px] leading-5">
                      <div className="flex justify-between"><span className="text-gray-500">Por cantidad</span><span className={colorDif(s.porQ)}>{fmtDif(s.porQ)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Por precio</span><span className={colorDif(s.porP)}>{fmtDif(s.porP)}</span></div>
                      {Math.abs(sinSeparar) > TOLERANCIA && (
                        <div className="flex justify-between" title="Partidas con unidad distinta en contrato y Master"><span className="text-gray-500">Unidad distinta</span><span className={colorDif(sinSeparar)}>{fmtDif(sinSeparar)}</span></div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Filtros por estado */}
              <div className="flex flex-wrap gap-1.5 mb-3 text-[11px]">
                <button type="button" onClick={() => setFiltroEstado('todas')}
                  className={`px-2 py-1 rounded border cursor-pointer ${filtroEstado === 'todas' ? 'border-slate-700 bg-slate-800 text-white' : 'border-gray-200 bg-white'}`}>
                  Todas · {filasBase.length.toLocaleString('en-US')}
                </button>
                {(['ok', 'dif', 'soloMaster', 'soloPlanilla', 'capitulo'] as Estado[]).map(e => (
                  <button key={e} type="button" onClick={() => setFiltroEstado(filtroEstado === e ? 'todas' : e)}
                    className={`px-2 py-1 rounded border cursor-pointer ${ESTADO_CLS[e]} ${filtroEstado === e ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}>
                    {ESTADO_LABEL[e]} · {conteoEstado[e].n.toLocaleString('en-US')}
                    {e !== 'ok' && <span className="ml-1 opacity-80">({signo(conteoEstado[e].v)}{fmtM(conteoEstado[e].v)})</span>}
                  </button>
                ))}
              </div>

              {/* Alertas: partidas sin cruce */}
              <div className="border border-amber-200 bg-amber-50/60 rounded-lg mb-3">
                <button type="button" onClick={() => setVerAlertas(v => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left cursor-pointer">
                  <span className="text-[12px] text-amber-900">
                    <strong>Partidas sin cruce</strong> (códigos únicos) · Solo Master {alertas.soloMaster.length} · Solo Planilla {alertas.soloPlanilla.length} · Otro capítulo {alertas.capitulo.length}
                    {resultado.sinIdOrig.filas > 0 && <> · {resultado.sinIdOrig.filas} filas del Master sin id.orig</>}
                  </span>
                  <span className="text-[11px] text-amber-900">{verAlertas ? 'Ocultar ▲' : 'Ver listado ▼'}</span>
                </button>
                {verAlertas && (
                  <div className="px-3 pb-3">
                    <div className="flex gap-1.5 mb-2 text-[11px]">
                      {(['soloMaster', 'soloPlanilla', 'capitulo'] as const).map(k => (
                        <button key={k} type="button" onClick={() => { setAlertaTab(k); setAlertasN(50); }}
                          className={`px-2 py-1 rounded border cursor-pointer ${ESTADO_CLS[k]} ${alertaTab === k ? 'ring-2 ring-offset-1 ring-amber-400' : ''}`}>
                          {ESTADO_LABEL[k]} · {alertas[k].length}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-amber-900 mb-2">{ALERTA_TXT[alertaTab]}</p>
                    <div className="overflow-auto max-h-[28rem] border border-amber-200 rounded bg-white">
                      <table>
                        <thead>
                          <tr>
                            <th>Partida</th><th>Descripción</th><th>Código</th>
                            <th className="text-right">Venta Master</th><th className="text-right">Ejecutado</th>
                            <th className="text-right">Contrato</th><th className="text-right">Planillado</th><th>Nota</th>
                          </tr>
                        </thead>
                        <tbody>
                          {alertas[alertaTab].slice(0, alertasN).map(l => (
                            <tr key={l.key}>
                              <td className="whitespace-nowrap">{l.partida}</td>
                              <td className="max-w-[360px] truncate" title={l.desc}>{l.desc}</td>
                              <td className="whitespace-nowrap text-gray-500">{l.cod}</td>
                              <td className="text-right">{fmt0(l.vM)}</td>
                              <td className="text-right">{fmt0(l.vE)}</td>
                              <td className="text-right">{fmt0(l.vC)}</td>
                              <td className="text-right">{fmt0(l.vP)}</td>
                              <td className="text-[11px] text-gray-600">
                                {l.sugerencia ? `¿Será ${l.sugerencia}?` : esPrecioNuevo(l.partida) && l.cruce === 'soloMaster' ? 'Precio nuevo (CP/CN)' : ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {alertas[alertaTab].length > alertasN && (
                      <button type="button" onClick={() => setAlertasN(n => n + 200)}
                        className="mt-2 text-[11px] px-3 py-1 rounded border border-amber-300 bg-white cursor-pointer">
                        Ver más ({alertas[alertaTab].length - alertasN} restantes)
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Tarjetas por tipo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 mb-3">
                {tarjetasTipo.map(g => {
                  const cfg = ctTipoCfg(g.tipo);
                  const activo = filtroTipo === g.tipo;
                  const pct = g.vA > 0 ? (g.vB / g.vA) * 100 : 0;
                  return (
                    <button key={g.tipo || 'sin-tipo'} type="button" onClick={() => setFiltroTipo(activo ? '' : g.tipo)}
                      className={`text-left border-2 rounded-lg p-2 cursor-pointer transition-all ${cfg.bg} ${cfg.border} ${activo ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}>
                      <div className="flex justify-between gap-1">
                        <span className={`text-[10px] font-bold ${cfg.text} truncate`}>{g.tipo.replace(/^\d+\./, '').trim() || 'Sin tipo'}</span>
                        <span className={`text-[10px] ${cfg.text} opacity-60`}>{g.n}</span>
                      </div>
                      <div className={`text-[10px] ${cfg.text} mt-0.5`}>{txt.a} {fmtM(g.vA)}</div>
                      <div className={`text-xs font-bold ${cfg.text}`}>{txt.b} {fmtM(g.vB)}</div>
                      <div className="flex gap-1 flex-wrap">
                        {g.pos > 0 && <span className="text-[9px] font-semibold text-emerald-700">+{fmtM(g.pos)}</span>}
                        {g.neg < 0 && <span className="text-[9px] font-semibold text-red-600">{fmtM(g.neg)}</span>}
                      </div>
                      <div className="w-full h-1 bg-white/60 rounded-full mt-1 overflow-hidden">
                        <div className={cfg.bar} style={{ width: `${Math.min(pct, 100)}%`, height: '100%' }} />
                      </div>
                      <div className={`text-[9px] ${cfg.text} opacity-70`}>{pct.toFixed(1)}%</div>
                    </button>
                  );
                })}
              </div>

              {/* Buscador y filtro */}
              <div className="flex justify-end items-center gap-2 flex-wrap mb-2">
                <div className="flex items-center gap-1.5">
                  <div className="relative">
                    <input
                      type="text"
                      id="cdo-vs-planilla-search"
                      placeholder="Partida, código, descripción… (use + para combinar)"
                      value={busquedaTmp}
                      onChange={e => setBusquedaTmp(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') setBusqueda(busquedaTmp); }}
                      className="w-80 bg-white pl-2.5 pr-7 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-indigo-400"
                    />
                    {(busquedaTmp || busqueda) && (
                      <button type="button" onClick={() => { setBusquedaTmp(''); setBusqueda(''); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 hover:text-gray-600 cursor-pointer">✕</button>
                    )}
                  </div>
                  <button type="button" onClick={() => setBusqueda(busquedaTmp)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#CD0000] text-white text-[12px] cursor-pointer">
                    <Search className="w-3.5 h-3.5" /> Buscar
                  </button>
                </div>
                <select
                  value={filtroEstado}
                  onChange={e => setFiltroEstado(e.target.value as FiltroEstado)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                >
                  <option value="todas">Todas las partidas</option>
                  <option value="conDif">Con diferencia o sin cruce</option>
                  <option value="pos">Diferencias positivas</option>
                  <option value="neg">Diferencias negativas</option>
                  {(['ok', 'dif', 'soloMaster', 'soloPlanilla', 'capitulo'] as Estado[]).map(e => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
                </select>
                {vista === 'jerarquica' && (
                  <>
                    <button type="button" onClick={() => setExpandidos(new Set(arbol.g.keys()))}
                      className="px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-[12px] cursor-pointer">Expandir todo</button>
                    <button type="button" onClick={() => setExpandidos(new Set())}
                      className="px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-[12px] cursor-pointer">Colapsar</button>
                  </>
                )}
              </div>

              {/* Tabla */}
              <div className="overflow-auto max-h-[44rem] border border-gray-200 rounded-lg">
                <table className="min-w-full cvs-tabla">
                  <thead className="sticky top-0 z-10"><Encabezado /></thead>
                  <tbody>
                    {vista === 'jerarquica' ? (
                      contenido(arbol.raices, arbol.hojasRaiz).map(it => it.l
                        ? <FilaHoja key={it.k} l={it.l} depth={0} />
                        : <FilaGrupo key={it.k} cod={it.cod!} depth={0} />)
                    ) : (
                      <>
                        {filasPlanas.slice(0, pagina * POR_PAGINA).map(l => <FilaHoja key={l.key} l={l} depth={0} />)}
                        {filasPlanas.length > pagina * POR_PAGINA && (
                          <tr>
                            <td colSpan={NCOLS} className="text-center !py-3">
                              <span className="text-gray-500 mr-3">Mostrando {pagina * POR_PAGINA} de {filasPlanas.length} partidas</span>
                              <button type="button" onClick={() => setPagina(p => p + 1)} className="px-3 py-1 rounded bg-[#CD0000] text-white text-[11px] cursor-pointer mr-2">Cargar más</button>
                              <button type="button" onClick={() => setPagina(Math.ceil(filasPlanas.length / POR_PAGINA))} className="px-3 py-1 rounded border border-gray-300 text-[11px] cursor-pointer">Ver todas</button>
                            </td>
                          </tr>
                        )}
                      </>
                    )}
                    {filas.length === 0 && (
                      <tr><td colSpan={NCOLS} className="text-center text-gray-500 !py-6">No hay partidas con estos filtros.</td></tr>
                    )}
                  </tbody>
                  <tfoot className="sticky bottom-0 z-10">
                    <FilaTotal s={totalFiltrado} etiqueta={filtroTipo ? (filtroTipo.replace(/^\d+\./, '').trim() || 'Sin tipo') : 'TOTAL'} />
                  </tfoot>
                </table>
              </div>
              <p className="text-[11px] text-gray-500 mt-2">
                Cruce por id.orig del Master (Col B) = Partida de la Sabana (Col H); si no coincide, por código de planeamiento (Col F).
                Q Master = cantidad × step. Δ por cantidad = (Q {txt.b} − Q {txt.a}) × tarifa; Δ por precio = el resto.
                Clic en una partida para ver sus filas de Planilla y Master.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};
