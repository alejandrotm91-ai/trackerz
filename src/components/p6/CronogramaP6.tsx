/**
 * Cronograma P6: abre el XER de Primavera dentro de Trakciona, como un programa.
 * Tabla de actividades por WBS + Gantt, edición de fechas, avance, duraciones, restricciones y
 * relaciones, programación (F9) con el motor CPM, vista de recursos y exportación del XER.
 * Todos consultan; solo el administrador edita, programa y guarda.
 */
import React from 'react';
import { ChevronDown, ChevronRight, Download, Upload, Save, Play, X, Search, Calendar, Layers, BarChart3, Plus, Trash2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Network } from 'lucide-react';
import { leerXer, escribirXer, codificarXer, decodificarXer, celda } from '../../utils/p6/xer';
import { CAMPOS_AGRUPACION, NIVELES_POR_DEFECTO, SIN_MASTER, etiquetaCampo, indiceMaster, minutosDeFecha, rutaDe, type CampoAgrupacion } from '../../utils/p6/vistaEjecucion';
import type { Actividad } from '../../types';
import { guardarLineaBase, leerLineaBase, lineaBaseDeTexto, lineaBaseDeXer, lineaBasePlanificada, lineaBaseUdf, type LineaBase } from '../../utils/p6/lineaBase';
import { crearModelo, type ModeloP6 } from '../../utils/p6/modelo';
import { aMinutos, aTexto } from '../../utils/p6/calendario';
import { programarYEscribir, editarActividad, agregarRelacion, editarRelacion, eliminarRelacion, ponerFechaDatos, crearActividad, eliminarActividad, crearWbs, editarWbs, eliminarWbs, moverWbs, subarbolWbs, type Cambio, type EdicionActividad } from '../../utils/p6/edicion';
import { guardarXerEnNube, leerXerDeNube, type MetaXer } from '../../utils/p6/xerNube';

const FILA = 22;
const ANCHO_IZQ = 870;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const ESTADO_TXT: Record<string, string> = { TK_NotStart: 'No iniciada', TK_Active: 'En curso', TK_Complete: 'Terminada' };
const RESTRICCIONES: [string, string][] = [
  ['', 'Sin restricción'],
  ['CS_MSOA', 'Comenzar en o después de'],
  ['CS_MSO', 'Comenzar en'],
  ['CS_MEO', 'Terminar en'],
  ['CS_MEOB', 'Terminar en o antes de'],
  ['CS_ALAP', 'Lo más tarde posible'],
];

/** Colores de los niveles del WBS, como las bandas de Primavera P6 (fondo, texto). */
const BANDAS_WBS: [string, string][] = [
  ['#1F7CC4', '#FFFFFF'], // proyecto: azul
  ['#7CF27C', '#14212A'], // nivel 1: verde
  ['#FFFF66', '#14212A'], // nivel 2: amarillo
  ['#2B2BD9', '#FFFFFF'], // nivel 3: azul intenso
  ['#9FE7FF', '#14212A'], // nivel 4: cian
  ['#FFB8E1', '#14212A'], // nivel 5: rosa
  ['#D9C8FF', '#14212A'], // nivel 6: lavanda
];
const bandaWbs = (nivel: number) => (nivel < BANDAS_WBS.length ? BANDAS_WBS[nivel] : BANDAS_WBS[4 + ((nivel - 4) % 3)]);

const esHitoFinTipo = (tipo: string) => tipo === 'TT_FinMile';
const fCorta = (t: number | null | undefined) => {
  if (t == null || !isFinite(t)) return '';
  const d = new Date(t * 60000);
  return `${String(d.getUTCDate()).padStart(2, '0')}-${MESES[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(2)}`;
};
const dias = (h: number, hd: number) => (Math.round((h / hd) * 10) / 10).toLocaleString('es-ES');
const dinero = (v: number) => Math.round(v).toLocaleString('en-US');

interface Vt {
  i: number; id: string; cod: string; nombre: string; wbs: string; estado: string; tipo: string;
  durO: number; durR: number; hd: number;
  ini: number | null; fin: number | null; iniA: boolean; finA: boolean;
  /** Inicio del trabajo restante (en curso) para el Gantt. */
  resto: number | null;
  tf: number | null; avance: number; cstr: string;
  /** Holgura libre en horas. */
  ff: number | null;
  /** En la ruta más larga (driving_path_flag de P6). */
  lp: boolean;
}
interface Nodo {
  id: string; padre: string; cod: string; codCompleto: string; nombre: string; seq: number;
  hijos: Nodo[]; tareas: Vt[]; nivel: number;
  ini: number | null; fin: number | null; n: number; criticas: number;
  /** Vista de ejecución: rubros del Master que aún no existen en el XER. */
  soloMaster?: Actividad[];
  /** Nº de rubros solo del Master en el nodo y sus hijos. */
  nSolo?: number;
}
type Fila = { tipo: 'wbs'; nodo: Nodo; nivel: number } | { tipo: 'act'; vt: Vt; nivel: number } | { tipo: 'master'; a: Actividad; nivel: number };

export const CronogramaP6: React.FC<{ isAdmin: boolean; username?: string; actividadesMaster?: Actividad[]; onClose: () => void }> = ({ isAdmin, username, actividadesMaster, onClose }) => {
  const modelo = React.useRef<ModeloP6 | null>(null);
  const [version, setVersion] = React.useState(0);
  const [estadoCarga, setEstadoCarga] = React.useState<'cargando' | 'vacio' | 'listo' | 'error'>('cargando');
  const [meta, setMeta] = React.useState<MetaXer | null>(null);
  const [nombreArchivo, setNombreArchivo] = React.useState('');
  const [cambios, setCambios] = React.useState<Cambio[]>([]);
  const [sinGuardar, setSinGuardar] = React.useState(false);
  const [pendienteF9, setPendienteF9] = React.useState(false);
  const [aviso, setAviso] = React.useState('');
  const [ocupado, setOcupado] = React.useState('');
  const [sel, setSel] = React.useState<number | null>(null);
  const [wbsSel, setWbsSel] = React.useState<string | null>(null);
  const [creando, setCreando] = React.useState(false);
  const [abiertos, setAbiertos] = React.useState<Set<string>>(new Set());
  // Con un filtro activo todo se muestra desplegado salvo los WBS que el usuario contraiga.
  const [cerradosF, setCerradosF] = React.useState<Set<string>>(new Set());
  const [filtro, setFiltro] = React.useState('');
  const [filtroTmp, setFiltroTmp] = React.useState('');
  const [filtroEstado, setFiltroEstado] = React.useState<'todas' | 'pendientes' | 'criticas' | 'longest' | 'encurso' | 'soloMaster'>('todas');
  const [vista, setVista] = React.useState<'actividades' | 'wbs' | 'recursos'>('actividades');
  // Orden de las actividades dentro de cada grupo (clic en el encabezado Inicio / Fin)
  const [orden, setOrden] = React.useState<{ col: 'ini' | 'fin'; dir: 1 | -1 } | null>(null);
  const alternarOrden = (col: 'ini' | 'fin') => setOrden(o => (!o || o.col !== col ? { col, dir: 1 } : o.dir === 1 ? { col, dir: -1 } : null));
  const [px, setPx] = React.useState(1);
  const [verRelaciones, setVerRelaciones] = React.useState<boolean>(() => {
    try { return localStorage.getItem('p6.relaciones') === '1'; } catch { return false; }
  });
  React.useEffect(() => { try { localStorage.setItem('p6.relaciones', verRelaciones ? '1' : '0'); } catch { /* sin almacenamiento */ } }, [verRelaciones]);
  // Línea base
  const [verLB, setVerLB] = React.useState<boolean>(() => {
    try { return localStorage.getItem('p6.lineaBase') === '1'; } catch { return false; }
  });
  React.useEffect(() => { try { localStorage.setItem('p6.lineaBase', verLB ? '1' : '0'); } catch { /* sin almacenamiento */ } }, [verLB]);
  const [lbGuardada, setLbGuardada] = React.useState<LineaBase | null>(null);
  const [fuenteLB, setFuenteLB] = React.useState<'udf' | 'guardada' | 'planificada'>('udf');
  const lbFileRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { leerLineaBase().then(lb => setLbGuardada(lb)); }, []);
  // Agrupación: WBS de P6 o vista de ejecución (clasificación del Master)
  const leerLS = <T,>(k: string, def: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : def; } catch { return def; } };
  const [agrupacion, setAgrupacion] = React.useState<'wbs' | 'ejecucion'>(() => leerLS('p6.agrupacion', 'wbs'));
  const [niveles, setNiveles] = React.useState<CampoAgrupacion[]>(() => leerLS('p6.niveles', NIVELES_POR_DEFECTO));
  React.useEffect(() => { try { localStorage.setItem('p6.agrupacion', JSON.stringify(agrupacion)); localStorage.setItem('p6.niveles', JSON.stringify(niveles)); } catch { /* sin almacenamiento */ } }, [agrupacion, niveles]);
  const idxMaster = React.useMemo(() => indiceMaster(actividadesMaster), [actividadesMaster]);
  const hayMaster = idxMaster.size > 0;
  const [scrollTop, setScrollTop] = React.useState(0);
  const [altoVista, setAltoVista] = React.useState(600);
  const scroller = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const editable = isAdmin;
  const refrescar = () => setVersion(v => v + 1);
  const mostrar = (txt: string) => { setAviso(txt); window.setTimeout(() => setAviso(a => (a === txt ? '' : a)), 4500); };

  const abrirTexto = React.useCallback((texto: string) => {
    const x = leerXer(texto);
    const m = crearModelo(x);
    modelo.current = m;
    // Abre el primer nivel del WBS
    const w = x.tablas.get('PROJWBS');
    const raiz = w?.filas.find(f => celda(w, f, 'proj_node_flag') === 'Y');
    setAbiertos(new Set(raiz ? [celda(w!, raiz, 'wbs_id')] : []));
    setSel(null);
    setCambios([]);
    setPendienteF9(false);
    setEstadoCarga('listo');
    refrescar();
  }, []);

  // Carga la versión guardada en la nube
  React.useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const r = await leerXerDeNube();
        if (cancelado) return;
        if (!r) { setEstadoCarga('vacio'); return; }
        setMeta(r.meta);
        setNombreArchivo(r.meta.nombre);
        abrirTexto(r.texto);
      } catch (e: any) {
        if (!cancelado) { setEstadoCarga('error'); setAviso(e?.message || String(e)); }
      }
    })();
    return () => { cancelado = true; };
  }, [abrirTexto]);

  React.useEffect(() => {
    const medir = () => setAltoVista(scroller.current?.clientHeight || 600);
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [estadoCarga, vista]);

  const m = modelo.current;

  const calBase = m ? (m.calendarios.values().next().value ?? null) : null;
  // ── Línea base por actividad (por ID de actividad) ──
  // Campos de usuario «21. blStartP6» / «20. blFinishP6» del XER (línea base de P6)
  const lbUdf = React.useMemo(() => (m ? lineaBaseUdf(m.xer) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m, estadoCarga]);
  // Fuente efectiva: la elegida si existe; si no, la primera disponible
  const fuenteEf: 'udf' | 'guardada' | 'planificada' =
    fuenteLB === 'udf' && lbUdf ? 'udf' : fuenteLB === 'guardada' && lbGuardada ? 'guardada' : fuenteLB === 'planificada' ? 'planificada' : lbUdf ? 'udf' : lbGuardada ? 'guardada' : 'planificada';
  // La variación se calcula siempre; el botón solo muestra u oculta las barras
  const lbPorAct = React.useMemo(() => {
    if (!m) return null;
    const fuente = fuenteEf === 'udf' ? lbUdf!.act : fuenteEf === 'guardada' ? lbGuardada!.act : lineaBasePlanificada(m.xer);
    return m.task.filas.map(f => fuente[celda(m.task, f, 'task_code')] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, fuenteEf, lbUdf, lbGuardada, version, estadoCarga]);
  /** Variación de fin (P6: fin de línea base − fin actual), en horas laborables; negativa = atraso. */
  const variacionFin = (lbFin: number | null | undefined, fin: number | null | undefined) => {
    if (lbFin == null || fin == null || !calBase) return null;
    return (lbFin >= fin ? calBase.entre(fin, lbFin) : -calBase.entre(lbFin, fin)) / 60;
  };

  // ── Vista de actividades ──
  const vts = React.useMemo<Vt[]>(() => {
    if (!m) return [];
    const t = m.task;
    return t.filas.map((f, i) => {
      const g = (c: string) => celda(t, f, c);
      const cal = m.calendarios.get(g('clndr_id'));
      const estado = g('status_code');
      const as = aMinutos(g('act_start_date'));
      const af = aMinutos(g('act_end_date'));
      const es = aMinutos(g('early_start_date'));
      const ef = aMinutos(g('early_end_date'));
      const tf = g('total_float_hr_cnt');
      const ff = g('free_float_hr_cnt');
      return {
        i, id: g('task_id'), cod: g('task_code'), nombre: g('task_name'), wbs: g('wbs_id'), estado, tipo: g('task_type'),
        durO: Number(g('target_drtn_hr_cnt')) || 0, durR: Number(g('remain_drtn_hr_cnt')) || 0, hd: cal?.horasDia || 8,
        ini: estado !== 'TK_NotStart' && as != null ? as : es,
        fin: estado === 'TK_Complete' && af != null ? af : ef,
        iniA: estado !== 'TK_NotStart' && as != null, finA: estado === 'TK_Complete' && af != null,
        resto: estado === 'TK_Active' ? es : null,
        tf: tf === '' || estado === 'TK_Complete' ? null : Number(tf),
        ff: ff === '' || estado === 'TK_Complete' ? null : Number(ff),
        avance: Number(g('phys_complete_pct')) || 0, cstr: g('cstr_type'),
        lp: g('driving_path_flag') === 'Y',
      };
    });
  }, [m, version]);

  const arbolWbs = React.useMemo(() => {
    const nodos = new Map<string, Nodo>();
    if (!m) return { raices: [] as Nodo[], nodos };
    const w = m.xer.tablas.get('PROJWBS');
    for (const f of w?.filas || []) {
      const g = (c: string) => celda(w!, f, c);
      nodos.set(g('wbs_id'), { id: g('wbs_id'), padre: g('parent_wbs_id'), cod: g('wbs_short_name'), codCompleto: g('wbs_short_name'), nombre: g('wbs_name'), seq: Number(g('seq_num')) || 0, hijos: [], tareas: [], nivel: 0, ini: null, fin: null, n: 0, criticas: 0 });
    }
    const raices: Nodo[] = [];
    for (const n of nodos.values()) {
      const p = nodos.get(n.padre);
      if (p) p.hijos.push(n); else raices.push(n);
    }
    for (const v of vts) nodos.get(v.wbs)?.tareas.push(v);
    raices.sort((a, b) => a.seq - b.seq);
    raices.forEach(r => resumirNodo(r, 0, undefined, true));
    return { raices, nodos };
  }, [m, vts]);

  // Vista de ejecución: misma programación, agrupada con la clasificación del Master
  const arbolEjec = React.useMemo(() => {
    const nodos = new Map<string, Nodo>();
    const raices: Nodo[] = [];
    if (!m || !hayMaster) return { raices, nodos, enMaster: 0, sinMaster: 0, soloMaster: 0, excluidas: 0 };
    // Fuera de la vista de ejecución: el WBS «.D» del proyecto (actividades pendientes de confirmar
    // por el Ingeniero, con fechas provisionales) y todo lo que cuelga de él.
    const wbsExcluidos = new Set<string>();
    for (const raiz of arbolWbs.raices) {
      const d = raiz.hijos.find(h => h.cod.toUpperCase() === 'D');
      if (!d) continue;
      const pila = [d];
      while (pila.length) { const x = pila.pop()!; wbsExcluidos.add(x.id); pila.push(...x.hijos); }
    }
    let excluidas = 0;
    const nodoDe = (ruta: string[]): Nodo => {
      let padre: Nodo | undefined;
      for (let j = 0; j < ruta.length; j++) {
        const id = `g:${ruta.slice(0, j + 1).join('\u241f')}`;
        let n = nodos.get(id);
        if (!n) {
          n = { id, padre: padre?.id ?? '', cod: '', codCompleto: '', nombre: ruta[j], seq: 0, hijos: [], tareas: [], nivel: j, ini: null, fin: null, n: 0, criticas: 0 };
          nodos.set(id, n);
          if (padre) padre.hijos.push(n); else raices.push(n);
        }
        padre = n;
      }
      return padre!;
    };
    let enMaster = 0, sinMaster = 0;
    const codigos = new Set<string>();
    for (const v of vts) {
      codigos.add(v.cod);
      if (wbsExcluidos.has(v.wbs)) { excluidas++; continue; }
      const a = idxMaster.get(v.cod);
      if (a) { enMaster++; nodoDe(rutaDe(a, niveles)).tareas.push(v); } else { sinMaster++; nodoDe([SIN_MASTER]).tareas.push(v); }
    }
    let soloMaster = 0;
    for (const [id, a] of idxMaster) {
      if (codigos.has(id)) continue;
      soloMaster++;
      const n = nodoDe(rutaDe(a, niveles));
      (n.soloMaster ??= []).push(a);
    }
    const natural = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true });
    const orden = (a: Nodo, b: Nodo) => (a.nombre === SIN_MASTER ? 1 : b.nombre === SIN_MASTER ? -1 : natural(a.nombre, b.nombre));
    raices.sort(orden);
    raices.forEach(r => resumirNodo(r, 0, undefined, false, orden));
    return { raices, nodos, enMaster, sinMaster, soloMaster, excluidas };
  }, [m, vts, idxMaster, hayMaster, niveles, arbolWbs]);

  const enEjecucion = agrupacion === 'ejecucion' && hayMaster;
  React.useEffect(() => { if (!enEjecucion) setFiltroEstado(f => (f === 'soloMaster' ? 'todas' : f)); }, [enEjecucion]);
  const arbol: { raices: Nodo[]; nodos: Map<string, Nodo> } = enEjecucion ? arbolEjec : arbolWbs;

  const pasa = React.useCallback((v: Vt) => {
    if (filtroEstado === 'pendientes' && v.estado === 'TK_Complete') return false;
    if (filtroEstado === 'encurso' && v.estado !== 'TK_Active') return false;
    if (filtroEstado === 'criticas' && !(v.tf != null && v.tf <= 0)) return false;
    if (filtroEstado === 'longest' && !v.lp) return false;
    if (filtroEstado === 'soloMaster') return false; // solo los rubros del Master que aún no están en P6
    if (filtro) {
      const q = filtro.toLowerCase();
      if (!v.cod.toLowerCase().includes(q) && !v.nombre.toLowerCase().includes(q)) return false;
    }
    return true;
  }, [filtro, filtroEstado]);

  const filas = React.useMemo<Fila[]>(() => {
    const out: Fila[] = [];
    const filtrando = !!filtro || filtroEstado !== 'todas';
    const contiene = new Map<string, boolean>();
    const tiene = (n: Nodo): boolean => {
      if (contiene.has(n.id)) return contiene.get(n.id)!;
      const q = filtro.toLowerCase();
      const r = n.tareas.some(pasa) || n.hijos.some(tiene)
        || (!!n.soloMaster?.some(a => String(a.activityId).toLowerCase().includes(q) || a.descripcion.toLowerCase().includes(q)));
      contiene.set(n.id, r);
      return r;
    };
    const recorrer = (n: Nodo) => {
      if (filtrando && !tiene(n)) return;
      out.push({ tipo: 'wbs', nodo: n, nivel: n.nivel });
      if (filtrando ? cerradosF.has(n.id) : !abiertos.has(n.id)) return;
      // Primero las actividades propias del WBS y después los sub-WBS.
      const tareas = orden ? [...n.tareas].sort((a, b) => {
        const x = a[orden.col], y = b[orden.col];
        if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1; // sin fecha, al final
        return (x - y) * orden.dir || a.cod.localeCompare(b.cod, 'es', { numeric: true });
      }) : n.tareas;
      for (const v of tareas) if (!filtrando || pasa(v)) out.push({ tipo: 'act', vt: v, nivel: n.nivel + 1 });
      // Rubros del Master que todavía no están en Primavera (sin programación): se muestran
      // también con filtros de estado; la búsqueda por texto sí los filtra.
      if (n.soloMaster) {
        const q = filtro.toLowerCase();
        const fechaM = (a: Actividad) => minutosDeFecha(orden?.col === 'fin' ? a.finish ?? a.blFinish : a.start ?? a.blStart);
        const solo = orden ? [...n.soloMaster].sort((a, b) => {
          const x = fechaM(a), y = fechaM(b);
          if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
          return (x - y) * orden.dir;
        }) : n.soloMaster;
        for (const a of solo) if (!q || String(a.activityId).toLowerCase().includes(q) || a.descripcion.toLowerCase().includes(q)) out.push({ tipo: 'master', a, nivel: n.nivel + 1 });
      }
      for (const h of n.hijos) recorrer(h);
    };
    arbol.raices.forEach(recorrer);
    return out;
  }, [arbol, abiertos, cerradosF, filtro, filtroEstado, pasa, orden]);

  // ── Escala del Gantt ──
  const rango = React.useMemo(() => {
    let ini = Infinity, fin = -Infinity;
    for (const v of vts) {
      if (v.ini != null && v.ini < ini) ini = v.ini;
      if (v.fin != null && v.fin > fin) fin = v.fin;
    }
    if (!isFinite(ini)) { ini = Date.UTC(2024, 0, 1) / 60000; fin = ini + 365 * 1440; }
    const d0 = new Date(ini * 60000);
    const desde = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), 1) / 60000;
    const hasta = fin + 200 * 1440; // margen para las etiquetas de las barras resumen
    return { desde, hasta };
  }, [vts]);
  const xDe = (t: number) => ((t - rango.desde) / 1440) * px;
  // Desplaza el Gantt para que se vea una fecha (deja un margen a la izquierda)
  const verFecha = React.useCallback((t: number | null | undefined) => {
    const el = scroller.current;
    if (!el || t == null) return;
    const x = ANCHO_IZQ + ((t - rango.desde) / 1440) * px;
    if (x < el.scrollLeft + ANCHO_IZQ + 40 || x > el.scrollLeft + el.clientWidth - 60) el.scrollLeft = Math.max(0, x - ANCHO_IZQ - 120);
  }, [rango, px]);
  // Al abrir (y al cambiar la escala), mostrar la zona de la fecha de datos
  React.useEffect(() => {
    if (estadoCarga === 'listo' && vista === 'actividades' && modelo.current) {
      const id = window.setTimeout(() => verFecha(modelo.current!.fechaDatos - 60 * 1440), 50);
      return () => window.clearTimeout(id);
    }
  }, [estadoCarga, vista, px, verFecha]);
  const anchoGantt = Math.max(400, xDe(rango.hasta));
  const meses = React.useMemo(() => {
    const out: { t: number; etq: string; anio: number; mes: number }[] = [];
    const d = new Date(rango.desde * 60000);
    let y = d.getUTCFullYear(), mo = d.getUTCMonth();
    for (;;) {
      const t = Date.UTC(y, mo, 1) / 60000;
      if (t > rango.hasta) break;
      out.push({ t, etq: MESES[mo], anio: y, mes: mo });
      mo++; if (mo > 11) { mo = 0; y++; }
    }
    return out;
  }, [rango]);

  // ── Acciones ──
  const marcarCambio = (log: Cambio[]) => {
    setCambios([...log]);
    setSinGuardar(true);
    setPendienteF9(true);
    refrescar();
  };
  const programar = React.useCallback(() => {
    const mm = modelo.current;
    if (!mm || !editable) return;
    const t0 = performance.now();
    const r = programarYEscribir(mm);
    setPendienteF9(false);
    setSinGuardar(true);
    refrescar();
    mostrar(`Programado en ${Math.round(performance.now() - t0)} ms · fin del proyecto ${fCorta(r.finTemprano)} · ${r.criticas.toLocaleString('es-ES')} actividades críticas · ${r.rutaLarga.toLocaleString('es-ES')} en el longest path${r.ciclos.length ? ` · ${r.ciclos.length} en ciclos lógicos` : ''}`);
  }, [editable]);

  React.useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'F9') { e.preventDefault(); programar(); } };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [programar]);

  const proyecto = m ? celda(m.xer.tablas.get('PROJECT')!, m.xer.tablas.get('PROJECT')!.filas[0], 'proj_short_name') : '';
  const finProyecto = m ? aMinutos(celda(m.xer.tablas.get('PROJECT')!, m.xer.tablas.get('PROJECT')!.filas[0], 'scd_end_date')) : null;
  const finLimite = m ? m.finProyecto : null;

  const exportar = () => {
    if (!m) return;
    const bytes = codificarXer(escribirXer(m.xer));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${proyecto || 'cronograma'}_trakciona_${new Date().toISOString().slice(0, 10)}.xer`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const guardar = async () => {
    if (!m || !editable) return;
    setOcupado('Guardando en la nube…');
    try {
      const nueva = await guardarXerEnNube(escribirXer(m.xer), {
        nombre: nombreArchivo || `${proyecto}.xer`,
        proyecto,
        fechaDatos: aTexto(m.fechaDatos),
        actividades: m.task.filas.length,
        guardadoPor: username || 'admin',
        cambios: (meta?.cambios || 0) + cambios.length,
      }, pct => setOcupado(`Guardando en la nube… ${pct} %`));
      setMeta(nueva);
      setCambios([]);
      setSinGuardar(false);
      mostrar('Cronograma guardado en la nube.');
    } catch (e: any) {
      mostrar(`No se pudo guardar: ${e?.message || e}`);
    } finally {
      setOcupado('');
    }
  };

  const cargarArchivo = async (file: File) => {
    setOcupado('Leyendo el XER…');
    try {
      const texto = decodificarXer(new Uint8Array(await file.arrayBuffer()));
      if (!texto.startsWith('ERMHDR')) throw new Error('El archivo no parece un XER de Primavera P6.');
      setNombreArchivo(file.name);
      abrirTexto(texto);
      setSinGuardar(true);
      mostrar(`${file.name} abierto. Pulsa «Guardar» para publicarlo en la nube.`);
    } catch (e: any) {
      mostrar(`No se pudo abrir: ${e?.message || e}`);
    } finally {
      setOcupado('');
    }
  };

  const cerrar = () => {
    if (sinGuardar && editable && !window.confirm('Hay cambios sin guardar en la nube. ¿Cerrar de todos modos?')) return;
    onClose();
  };

  // ── Línea base: fijar con la programación actual o desde otro XER ──
  const guardarLB = async (lb: LineaBase, msg: string) => {
    if (lbGuardada && !window.confirm(`Ya hay una línea base («${lbGuardada.nombre}», ${new Date(lbGuardada.creadaEn).toLocaleDateString('es-ES')}). ¿Reemplazarla?`)) return;
    setOcupado('Guardando la línea base…');
    try {
      await guardarLineaBase(lb);
      setLbGuardada(lb);
      setFuenteLB('guardada');
      setVerLB(true);
      mostrar(msg);
    } catch (e) {
      mostrar(`No se pudo guardar la línea base: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setOcupado(''); }
  };
  const fijarLineaBase = () => {
    if (!m) return;
    if (pendienteF9 && !window.confirm('Hay cambios sin programar (F9). ¿Fijar igualmente la línea base con las fechas actuales?')) return;
    const nombre = `Programación al ${fCorta(m.fechaDatos)}`;
    void guardarLB(lineaBaseDeXer(m.xer, nombre, username || 'admin', 'programacion'), `Línea base fijada: ${nombre}.`);
  };
  const cargarLineaBase = async (file: File) => {
    if (!m) return;
    try {
      const lb = lineaBaseDeTexto(decodificarXer(new Uint8Array(await file.arrayBuffer())), file.name.replace(/\.xer$/i, ''), username || 'admin');
      const codigos = new Set(m.task.filas.map(f => celda(m.task, f, 'task_code')));
      const comunes = Object.keys(lb.act).filter(c => codigos.has(c)).length;
      if (!comunes) { mostrar('Ese XER no tiene ninguna actividad con los mismos ID que el cronograma.'); return; }
      await guardarLB(lb, `Línea base cargada de ${file.name}: ${comunes.toLocaleString('es-ES')} de ${codigos.size.toLocaleString('es-ES')} actividades con el mismo ID.`);
    } catch (e) {
      mostrar(`No se pudo leer el XER de línea base: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const filtrando = !!filtro || filtroEstado !== 'todas';
  // Cada filtro nuevo empieza desplegado
  React.useEffect(() => { setCerradosF(new Set()); }, [filtro, filtroEstado]);
  const alternarEn = (set: React.Dispatch<React.SetStateAction<Set<string>>>) => (id: string) =>
    set(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const alternar = (id: string) => (filtrando ? alternarEn(setCerradosF) : alternarEn(setAbiertos))(id);
  const expandirTodo = (abrir: boolean) => {
    if (filtrando) {
      const raices = new Set(arbol.raices.map(r => r.id));
      setCerradosF(abrir ? new Set() : new Set([...arbol.nodos.keys()].filter(id => !raices.has(id))));
    } else setAbiertos(abrir ? new Set(arbol.nodos.keys()) : new Set(arbol.raices.map(r => r.id)));
  };
  /** Despliega un WBS y sus padres (con y sin filtro). */
  const abrirRama = (id: string) => {
    const cadena: string[] = [];
    let w: string | undefined = id;
    while (w && arbolWbs.nodos.has(w)) { cadena.push(w); w = arbolWbs.nodos.get(w)!.padre; }
    setAbiertos(prev => new Set([...prev, ...cadena]));
    setCerradosF(prev => { const n = new Set(prev); cadena.forEach(c => n.delete(c)); return n; });
  };

  // ── Filas visibles (virtualización) ──
  const desdeFila = Math.max(0, Math.floor(scrollTop / FILA) - 10);
  const hastaFila = Math.min(filas.length, Math.ceil((scrollTop + altoVista) / FILA) + 10);
  const xDatos = m ? xDe(m.fechaDatos) : 0;
  const criticas = vts.filter(v => v.tf != null && v.tf <= 0).length;
  const rutaLarga = vts.filter(v => v.lp).length;

  // ── Relaciones para el Gantt ──
  const relsGantt = React.useMemo(() => {
    const preds: { p: number; tipo: string }[][] = vts.map(() => []);
    const succs: { s: number; tipo: string }[][] = vts.map(() => []);
    if (!m) return { preds, succs };
    const pt = m.pred;
    for (const f of pt.filas) {
      const a = m.porId.get(celda(pt, f, 'pred_task_id'));
      const b = m.porId.get(celda(pt, f, 'task_id'));
      if (a === undefined || b === undefined) continue;
      const tipo = celda(pt, f, 'pred_type').replace('PR_', '') || 'FS';
      preds[b].push({ p: a, tipo });
      succs[a].push({ s: b, tipo });
    }
    return { preds, succs };
  }, [m, vts]);
  const filaDeActividad = React.useMemo(() => {
    const mapa = new Map<number, number>();
    filas.forEach((fl, k) => { if (fl.tipo === 'act') mapa.set(fl.vt.i, k); });
    return mapa;
  }, [filas]);
  const enRojo = React.useCallback((v: Vt) => (filtroEstado === 'longest' ? v.lp && v.estado !== 'TK_Complete' : v.tf != null && v.tf <= 0), [filtroEstado]);
  // Resumen de cada WBS para su barra (solo las actividades que pasan el filtro)
  const resumenWbs = React.useMemo(() => {
    type R = { ini: number | null; fin: number | null; realIni: number | null; realFin: number | null; restIni: number | null; restFin: number | null; roja: boolean; lbIni: number | null; lbFin: number | null };
    const out = new Map<string, R>();
    if (!m) return out;
    const filtrandoR = !!filtro || filtroEstado !== 'todas';
    const mn = (a: number | null, b: number | null) => (a == null ? b : b == null ? a : Math.min(a, b));
    const mx = (a: number | null, b: number | null) => (a == null ? b : b == null ? a : Math.max(a, b));
    const ver = (n: Nodo): R => {
      const r: R = { ini: null, fin: null, realIni: null, realFin: null, restIni: null, restFin: null, roja: false, lbIni: null, lbFin: null };
      const juntar = (o: R) => {
        r.ini = mn(r.ini, o.ini); r.fin = mx(r.fin, o.fin);
        r.realIni = mn(r.realIni, o.realIni); r.realFin = mx(r.realFin, o.realFin);
        r.restIni = mn(r.restIni, o.restIni); r.restFin = mx(r.restFin, o.restFin);
        r.roja ||= o.roja;
        r.lbIni = mn(r.lbIni, o.lbIni); r.lbFin = mx(r.lbFin, o.lbFin);
      };
      for (const h of n.hijos) juntar(ver(h));
      // Con el filtro «Solo en Master», el grupo resume las fechas del Master de esos rubros
      if (filtroEstado === 'soloMaster') for (const a of n.soloMaster ?? []) {
        r.ini = mn(r.ini, minutosDeFecha(a.start ?? a.blStart)); r.fin = mx(r.fin, minutosDeFecha(a.finish ?? a.blFinish));
      }
      for (const v of n.tareas) {
        if (filtrandoR && !pasa(v)) continue;
        r.ini = mn(r.ini, v.ini); r.fin = mx(r.fin, v.fin);
        const lb = lbPorAct?.[v.i];
        if (lb) { r.lbIni = mn(r.lbIni, lb[0]); r.lbFin = mx(r.lbFin, lb[1]); }
        // Las barras de trabajo resumen solo tareas (no hitos ni LOE), como P6
        if (v.tipo === 'TT_Mile' || v.tipo === 'TT_FinMile' || v.tipo === 'TT_LOE' || v.tipo === 'TT_WBS') continue;
        if (v.iniA && v.ini != null) {
          r.realIni = mn(r.realIni, v.ini);
          r.realFin = mx(r.realFin, v.estado === 'TK_Complete' ? v.fin : m.fechaDatos);
        }
        if (v.estado !== 'TK_Complete') {
          r.restIni = mn(r.restIni, v.resto ?? v.ini);
          r.restFin = mx(r.restFin, v.fin);
          if (enRojo(v)) r.roja = true;
        }
      }
      out.set(n.id, r);
      return r;
    };
    arbol.raices.forEach(ver);
    return out;
  }, [m, arbol, filtro, filtroEstado, pasa, enRojo, lbPorAct]);
  const barrasLB = verLB ? lbPorAct : null;

  const lineasRelacion = React.useMemo(() => {
    if (!verRelaciones || vista !== 'actividades') return [] as { d: string; critica: boolean; k: string }[];
    const out: { d: string; critica: boolean; k: string }[] = [];
    const yDe = (fila: number) => fila * FILA + 11;
    const xIni = (v: Vt) => xDe(v.ini ?? v.fin ?? 0);
    const xFin = (v: Vt) => xDe(v.fin ?? v.ini ?? 0);
    const linea = (a: number, b: number, tipo: string) => {
      const fa = filaDeActividad.get(a), fb = filaDeActividad.get(b);
      if (fa === undefined || fb === undefined) return;
      const va = vts[a], vb = vts[b];
      if ((va.ini == null && va.fin == null) || (vb.ini == null && vb.fin == null)) return;
      const desdeInicio = tipo === 'SS' || tipo === 'SF';
      const haciaFin = tipo === 'FF' || tipo === 'SF';
      const x1 = desdeInicio ? xIni(va) : xFin(va);
      const x2 = haciaFin ? xFin(vb) : xIni(vb);
      const y1 = yDe(fa), y2 = yDe(fb);
      const sube = y2 < y1 ? -1 : 1;
      let d: string;
      if (haciaFin) {
        // Entra por el final: rodea por la derecha
        const xr = Math.max(x1, x2) + 6;
        d = `M${x1},${y1} H${xr} V${y2} H${x2 + 1}`;
      } else {
        const xs = desdeInicio ? x1 - 5 : x1 + 5;
        if (x2 - 6 >= xs) d = `M${x1},${y1} H${xs} V${y2} H${x2 - 1}`;
        else d = `M${x1},${y1} H${xs} V${y2 - sube * 6} H${x2 - 6} V${y2} H${x2 - 1}`;
      }
      const ca = enRojo(va), cb = enRojo(vb);
      out.push({ d, critica: ca && cb, k: `${a}-${b}-${tipo}` });
    };
    for (let k = desdeFila; k < hastaFila; k++) {
      const fl = filas[k];
      if (!fl || fl.tipo !== 'act') continue;
      const i = fl.vt.i;
      for (const r of relsGantt.preds[i]) linea(r.p, i, r.tipo);
      // Sucesoras fuera de la ventana (las de dentro se dibujan desde su propia fila)
      for (const r of relsGantt.succs[i]) {
        const fs = filaDeActividad.get(r.s);
        if (fs !== undefined && (fs < desdeFila || fs >= hastaFila)) linea(i, r.s, r.tipo);
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verRelaciones, enRojo, vista, desdeFila, hastaFila, filas, filaDeActividad, relsGantt, vts, px, rango]);

  return (
    <div className="fixed inset-0 z-[120] bg-[#EEF2F3] flex flex-col text-[#14212A]" id="cronograma-p6">
      {/* Barra superior */}
      <div className="bg-[#1E1B4B] text-white px-4 py-2.5 flex items-center gap-3 flex-wrap shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-indigo-200 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-bold leading-tight truncate">Cronograma P6 {proyecto && <span className="text-indigo-200 font-normal">· {proyecto}</span>}</div>
            <div className="text-[10.5px] text-indigo-200 truncate">
              {nombreArchivo || 'Sin archivo'}{meta && ` · guardado ${new Date(meta.guardadoEn).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} por ${meta.guardadoPor}`}
            </div>
          </div>
        </div>
        {m && (
          <div className="flex items-center gap-1.5 text-[11px] bg-white/10 rounded-lg px-2 py-1">
            <Calendar className="w-3.5 h-3.5 text-indigo-200" />
            <span className="text-indigo-200">Fecha de datos</span>
            <input
              type="date"
              disabled={!editable}
              value={aTexto(m.fechaDatos).slice(0, 10)}
              onChange={e => {
                if (!e.target.value) return;
                const log = [...cambios];
                ponerFechaDatos(m, `${e.target.value} ${aTexto(m.fechaDatos).slice(11) || '16:00'}`, log);
                marcarCambio(log);
              }}
              className="bg-transparent text-white text-[11px] outline-none [color-scheme:dark] disabled:opacity-80"
            />
          </div>
        )}
        {m && (
          <div className="text-[11px] text-indigo-100 flex items-center gap-3">
            <span>Fin: <b className="text-white">{fCorta(finProyecto)}</b></span>
            {finLimite && <span>Límite: <b className="text-white">{fCorta(finLimite)}</b></span>}
            <span>Críticas: <b className="text-red-300">{criticas.toLocaleString('es-ES')}</b></span>
            <span title="Actividades en la ruta más larga (Longest Path): la cadena que fija el fin del proyecto">Longest path: <b className="text-red-300">{rutaLarga.toLocaleString('es-ES')}</b></span>
            <span>{vts.length.toLocaleString('es-ES')} actividades</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {editable && m && (
            <button onClick={programar} title="Programar el cronograma (F9)"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${pendienteF9 ? 'bg-amber-400 text-[#1E1B4B] animate-pulse' : 'bg-white/15 hover:bg-white/25'}`}>
              <Play className="w-3.5 h-3.5" /> Programar (F9)
            </button>
          )}
          {editable && (
            <>
              <input ref={fileRef} type="file" accept=".xer" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) cargarArchivo(f); e.target.value = ''; }} />
              <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/15 hover:bg-white/25 flex items-center gap-1.5 cursor-pointer" title="Abrir un XER exportado desde Primavera P6">
                <Upload className="w-3.5 h-3.5" /> Cargar XER
              </button>
            </>
          )}
          {editable && m && (
            <button onClick={guardar} disabled={!sinGuardar || !!ocupado}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${sinGuardar ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-white/15'}`}>
              <Save className="w-3.5 h-3.5" /> Guardar{cambios.length ? ` (${cambios.length})` : ''}
            </button>
          )}
          {m && (
            <button onClick={exportar} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-[#1E1B4B] hover:bg-indigo-50 flex items-center gap-1.5 cursor-pointer" title="Descargar el XER para importarlo en Primavera P6">
              <Download className="w-3.5 h-3.5" /> Exportar XER
            </button>
          )}
          <button onClick={cerrar} className="p-1.5 rounded-lg hover:bg-white/15 cursor-pointer" title="Cerrar"><X className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Avisos */}
      {(aviso || ocupado || pendienteF9) && (
        <div className={`px-4 py-1.5 text-[11.5px] shrink-0 ${ocupado ? 'bg-indigo-50 text-indigo-900' : pendienteF9 ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900'}`}>
          {ocupado || aviso || 'Hay cambios sin programar: pulsa «Programar (F9)» para recalcular las fechas.'}
        </div>
      )}

      {estadoCarga === 'cargando' && <div className="flex-1 flex items-center justify-center text-sm text-[#5A6A74]">Cargando el cronograma…</div>}
      {estadoCarga === 'error' && <div className="flex-1 flex items-center justify-center text-sm text-red-700">No se pudo cargar el cronograma.</div>}
      {estadoCarga === 'vacio' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white border border-[#D5DEE2] rounded-2xl p-8 text-center max-w-md space-y-3">
            <Layers className="w-8 h-8 mx-auto text-[#312E81]" />
            <h3 className="font-bold">Aún no hay un cronograma de P6</h3>
            <p className="text-xs text-[#5A6A74]">
              {editable ? 'Exporta el proyecto desde Primavera P6 en formato XER y cárgalo aquí.' : 'El administrador todavía no ha cargado el XER de Primavera P6.'}
            </p>
            {editable && (
              <button onClick={() => fileRef.current?.click()} className="px-4 py-2 rounded-xl bg-[#312E81] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> Cargar XER
              </button>
            )}
          </div>
        </div>
      )}

      {estadoCarga === 'listo' && m && (
        <>
          {/* Herramientas */}
          <div className="px-4 py-2 bg-white border-b border-[#D5DEE2] flex items-center gap-2 flex-wrap shrink-0 text-xs">
            <div className="inline-flex border border-[#D5DEE2] rounded-lg overflow-hidden">
              {(['actividades', 'wbs', 'recursos'] as const).map(v => (
                <button key={v} onClick={() => setVista(v)} className={`px-3 py-1.5 flex items-center gap-1 cursor-pointer ${vista === v ? 'bg-[#312E81] text-white font-bold' : 'bg-white text-[#5A6A74] hover:text-[#14212A]'}`}>
                  {v === 'actividades' ? <Layers className="w-3.5 h-3.5" /> : v === 'wbs' ? <Network className="w-3.5 h-3.5" /> : <BarChart3 className="w-3.5 h-3.5" />}
                  {v === 'actividades' ? 'Actividades' : v === 'wbs' ? 'WBS' : 'Recursos'}
                </button>
              ))}
            </div>
            {vista === 'actividades' && (
              <>
                <select value={enEjecucion ? 'ejecucion' : 'wbs'} onChange={e => { setAgrupacion(e.target.value as 'wbs' | 'ejecucion'); setAbiertos(new Set()); }}
                  disabled={!hayMaster} title={hayMaster ? 'Cómo se agrupan las actividades' : 'Carga el Master para usar la vista de ejecución'}
                  className={`border rounded-lg px-2 py-1.5 font-semibold ${enEjecucion ? 'bg-[#312E81] border-[#312E81] text-white' : 'bg-white border-[#D5DEE2]'}`}>
                  <option value="wbs">Agrupar: WBS de P6</option>
                  <option value="ejecucion">Agrupar: Ejecución (Master)</option>
                </select>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-[#5A6A74]" />
                  <input value={filtroTmp} onChange={e => setFiltroTmp(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') setFiltro(filtroTmp.trim()); }}
                    placeholder="Buscar ID o nombre (Enter)" className="pl-7 pr-2 py-1.5 border border-[#D5DEE2] rounded-lg w-56 outline-none focus:border-[#312E81]" />
                </div>
                {filtro && <button onClick={() => { setFiltro(''); setFiltroTmp(''); }} className="text-[#5A6A74] hover:text-red-600 cursor-pointer">Quitar búsqueda ✕</button>}
                <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as any)} className="border border-[#D5DEE2] rounded-lg px-2 py-1.5 bg-white">
                  <option value="todas">Todas las actividades</option>
                  <option value="pendientes">No terminadas</option>
                  <option value="encurso">En curso</option>
                  <option value="criticas">Críticas (holgura ≤ 0)</option>
                  <option value="longest">Longest path (ruta más larga)</option>
                  {enEjecucion && <option value="soloMaster">Solo en Master (aún no en P6)</option>}
                </select>
                {([['criticas', 'Ruta crítica', 'Solo las actividades críticas (holgura total ≤ 0)'], ['longest', 'Longest path', 'Solo la ruta más larga: la cadena de actividades que fija el fin del proyecto']] as const).map(([k, etq, tt]) => (
                  <button key={k} onClick={() => { setFiltroEstado(f => (f === k ? 'todas' : k)); setVerRelaciones(true); }} title={tt}
                    className={`px-2 py-1.5 border rounded-lg cursor-pointer flex items-center gap-1 ${filtroEstado === k ? 'bg-[#CD0000] border-[#CD0000] text-white font-bold' : 'border-[#D5DEE2] hover:bg-[#F5F8F9] text-[#B30000]'}`}>
                    <span className={`w-2.5 h-2.5 rounded-sm ${filtroEstado === k ? 'bg-white' : 'bg-[#CD0000]'}`} />
                    {etq}
                  </button>
                ))}
                <button onClick={() => expandirTodo(true)} className="px-2 py-1.5 border border-[#D5DEE2] rounded-lg hover:bg-[#F5F8F9] cursor-pointer">Expandir todo</button>
                <button onClick={() => expandirTodo(false)} className="px-2 py-1.5 border border-[#D5DEE2] rounded-lg hover:bg-[#F5F8F9] cursor-pointer">Colapsar</button>
                <button onClick={() => setVerRelaciones(v => !v)} title="Mostrar u ocultar las líneas de relación en el Gantt"
                  className={`px-2 py-1.5 border rounded-lg cursor-pointer flex items-center gap-1 ${verRelaciones ? 'bg-[#312E81] border-[#312E81] text-white font-bold' : 'border-[#D5DEE2] hover:bg-[#F5F8F9]'}`}>
                  <svg width="14" height="10" viewBox="0 0 14 10" className="shrink-0"><path d="M1 2 H5 V8 H12" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M10 6 L13 8 L10 10" fill="currentColor" /></svg>
                  Relaciones
                </button>
                <button onClick={() => setVerLB(v => !v)} title="Mostrar u ocultar la línea base (barra amarilla bajo cada actividad)"
                  className={`px-2 py-1.5 border rounded-lg cursor-pointer flex items-center gap-1 ${verLB ? 'bg-[#E3B505] border-[#C99F00] text-[#14212A] font-bold' : 'border-[#D5DEE2] hover:bg-[#F5F8F9]'}`}>
                  <svg width="14" height="10" viewBox="0 0 14 10" className="shrink-0"><rect x="1" y="1" width="12" height="4" rx="1" fill="currentColor" opacity=".55" /><rect x="1" y="7" width="9" height="2.5" rx="1" fill={verLB ? '#14212A' : '#E3B505'} /></svg>
                  Línea base
                </button>
                {verLB && (
                  <>
                    <select value={fuenteEf} onChange={e => setFuenteLB(e.target.value as 'udf' | 'guardada' | 'planificada')} className="border border-[#D5DEE2] rounded-lg px-2 py-1.5 bg-white max-w-[260px]"
                      title="Qué fechas se usan como línea base">
                      {lbUdf && <option value="udf">LB de P6 (blStartP6 / blFinishP6)</option>}
                      {lbGuardada && <option value="guardada">LB: {lbGuardada.nombre} ({new Date(lbGuardada.creadaEn).toLocaleDateString('es-ES')})</option>}
                      <option value="planificada">Fechas planificadas del XER</option>
                    </select>
                    {editable && (
                      <>
                        <button onClick={fijarLineaBase} className="px-2 py-1.5 border border-[#D5DEE2] rounded-lg hover:bg-[#F5F8F9] cursor-pointer" title="Guardar la programación actual como línea base">Fijar actual</button>
                        <button onClick={() => lbFileRef.current?.click()} className="px-2 py-1.5 border border-[#D5DEE2] rounded-lg hover:bg-[#F5F8F9] cursor-pointer flex items-center gap-1" title="Usar otro XER (por ejemplo, el programa contractual) como línea base">
                          <Upload className="w-3.5 h-3.5" /> XER base
                        </button>
                        <input ref={lbFileRef} type="file" accept=".xer" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) cargarLineaBase(f); e.target.value = ''; }} />
                      </>
                    )}
                  </>
                )}
                {editable && (
                  <button onClick={() => setCreando(true)} className="px-2 py-1.5 rounded-lg bg-[#312E81] text-white font-bold flex items-center gap-1 cursor-pointer" title="Crear una actividad en el WBS seleccionado">
                    <Plus className="w-3.5 h-3.5" /> Nueva actividad
                  </button>
                )}
                <div className="ml-auto flex items-center gap-1 text-[#5A6A74]">
                  Escala
                  {[[0.4, 'Años'], [1, 'Trimestres'], [3, 'Meses'], [8, 'Semanas']].map(([v, l]) => (
                    <button key={String(v)} onClick={() => setPx(v as number)} className={`px-2 py-1 rounded cursor-pointer ${px === v ? 'bg-[#312E81] text-white' : 'hover:bg-[#F5F8F9]'}`}>{l}</button>
                  ))}
                </div>
              </>
            )}
          </div>

          {vista === 'actividades' && enEjecucion && (
            <div className="px-4 py-1.5 border-b border-[#D5DEE2] bg-[#EEF0FB] flex items-center gap-1.5 flex-wrap text-[11px]">
              <span className="font-bold text-[#312E81]">Vista de ejecución · niveles:</span>
              {niveles.map((k, j) => (
                <React.Fragment key={k}>
                  {j > 0 && <ChevronRight className="w-3 h-3 text-[#5A6A74]" />}
                  <span className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-white border border-[#C9CDEB]">
                    {etiquetaCampo(k)}
                    {j > 0 && <button title="Subir este nivel" onClick={() => setNiveles(nv => { const c = [...nv]; [c[j - 1], c[j]] = [c[j], c[j - 1]]; return c; })} className="text-[#5A6A74] hover:text-[#312E81] cursor-pointer"><ArrowLeft className="w-3 h-3" /></button>}
                    {niveles.length > 1 && <button title="Quitar este nivel" onClick={() => setNiveles(nv => nv.filter(x => x !== k))} className="text-[#5A6A74] hover:text-red-600 cursor-pointer"><X className="w-3 h-3" /></button>}
                  </span>
                </React.Fragment>
              ))}
              {niveles.length < 5 && (
                <select value="" onChange={e => { const k = e.target.value as CampoAgrupacion; if (k) setNiveles(nv => [...nv, k]); }} className="border border-[#C9CDEB] rounded-full px-2 py-0.5 bg-white cursor-pointer">
                  <option value="">+ nivel</option>
                  {CAMPOS_AGRUPACION.filter(c => !niveles.includes(c.k)).map(c => <option key={c.k} value={c.k}>{c.etq}</option>)}
                </select>
              )}
              <button onClick={() => setNiveles(NIVELES_POR_DEFECTO)} className="text-[#312E81] underline cursor-pointer ml-1">Restablecer</button>
              <span className="ml-auto text-[#5A6A74]">
                {arbolEjec.enMaster.toLocaleString('es-ES')} actividades enlazadas por Activity ID
                {arbolEjec.sinMaster ? ` · ${arbolEjec.sinMaster.toLocaleString('es-ES')} del XER sin datos en el Master` : ''}
                {arbolEjec.soloMaster ? ` · ${arbolEjec.soloMaster.toLocaleString('es-ES')} rubros solo en el Master (aún no en P6)` : ''}
                {arbolEjec.excluidas ? ` · ${arbolEjec.excluidas.toLocaleString('es-ES')} del WBS «Pendientes de confirmar» (.D) excluidas` : ''}
              </span>
            </div>
          )}
          {vista === 'actividades' ? (
            <>
              {/* Tabla + Gantt (virtualizada) */}
              <div ref={scroller} onScroll={e => setScrollTop((e.target as HTMLDivElement).scrollTop)} className="flex-1 overflow-auto bg-white relative">
                <div style={{ width: ANCHO_IZQ + anchoGantt, height: filas.length * FILA + 34, position: 'relative' }}>
                  {/* Encabezado */}
                  <div className="sticky top-0 z-20 flex bg-[#F5F8F9] border-b border-[#D5DEE2] text-[10px] font-semibold text-[#5A6A74]" style={{ height: 34 }}>
                    <div className="sticky left-0 z-30 bg-[#F5F8F9] flex items-end pb-1 border-r border-[#D5DEE2]" style={{ width: ANCHO_IZQ }}>
                      <div className="w-[120px] px-2">ID de actividad</div>
                      <div className="w-[262px] px-1">Nombre</div>
                      <div className="w-[52px] text-right px-1">Dur. orig.</div>
                      <div className="w-[52px] text-right px-1">Dur. rest.</div>
                      {(['ini', 'fin'] as const).map(col => (
                        <button key={col} onClick={() => alternarOrden(col)} title="Ordenar las actividades de cada grupo (ascendente → descendente → original)"
                          className={`w-[78px] text-right px-1 cursor-pointer hover:text-[#312E81] ${orden?.col === col ? 'text-[#312E81]' : ''}`}>
                          {col === 'ini' ? 'Inicio' : 'Fin'}{orden?.col === col ? (orden.dir === 1 ? ' ▲' : ' ▼') : ' ↕'}
                        </button>
                      ))}
                      <div className="w-[58px] text-right px-1 leading-tight" title="Variación de fin respecto a la línea base (fin LB − fin actual, días laborables; negativo = atraso)">Var. fin LB</div>
                      <div className="w-[52px] text-right px-1">Holg. tot.</div>
                      <div className="w-[52px] text-right px-1">Holg. libre</div>
                      <div className="w-[56px] text-right px-2">% avance</div>
                    </div>
                    <div className="relative" style={{ width: anchoGantt }}>
                      {meses.map(mo => (mo.mes === 0 || mo === meses[0]) && (
                        <div key={`a${mo.t}`} className="absolute top-0.5 text-[10px] font-bold text-[#14212A]" style={{ left: xDe(mo.t) + 2 }}>{mo.anio}</div>
                      ))}
                      {meses.map(mo => (
                        <div key={mo.t} className="absolute bottom-0 h-3.5 border-l border-[#D5DEE2] text-[9px] pl-0.5 text-[#5A6A74]" style={{ left: xDe(mo.t) }}>
                          {px >= 3 || (px >= 1 && mo.mes % 3 === 0) ? mo.etq : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Líneas de relación (solo las de las filas visibles) */}
                  {verRelaciones && lineasRelacion.length > 0 && (
                    <svg className="absolute pointer-events-none" style={{ left: ANCHO_IZQ, top: 34, width: anchoGantt, height: filas.length * FILA, overflow: 'visible', zIndex: 4 }}>
                      <defs>
                        <marker id="p6-flecha" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#5A6A74" /></marker>
                        <marker id="p6-flecha-r" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#CD0000" /></marker>
                      </defs>
                      {lineasRelacion.map(l => (
                        <path key={l.k} d={l.d} fill="none" stroke={l.critica ? '#CD0000' : '#7A868D'} strokeWidth={l.critica ? 1.1 : 0.9}
                          markerEnd={`url(#${l.critica ? 'p6-flecha-r' : 'p6-flecha'})`} />
                      ))}
                    </svg>
                  )}
                  {/* Línea de fecha de datos */}
                  <div className="absolute z-10 w-0.5 bg-[#CD0000]/70 pointer-events-none" style={{ left: ANCHO_IZQ + xDatos, top: 34, height: filas.length * FILA }} title="Fecha de datos" />
                  {/* Filas */}
                  {filas.slice(desdeFila, hastaFila).map((fl, k) => {
                    const idx = desdeFila + k;
                    const top = 34 + idx * FILA;
                    if (fl.tipo === 'wbs') {
                      const n = fl.nodo;
                      const abierto = filtrando ? !cerradosF.has(n.id) : abiertos.has(n.id);
                      const [fondo, texto] = bandaWbs(fl.nivel);
                      const claro = texto !== '#FFFFFF';
                      return (
                        <div key={`w${n.id}`} className="absolute flex text-[11px] font-bold cursor-pointer bg-white border-b border-[#E6EAEC]" style={{ top, height: FILA, width: ANCHO_IZQ + anchoGantt, outline: wbsSel === n.id ? '2px solid #CD0000' : undefined, outlineOffset: -2 }} onClick={() => { alternar(n.id); setWbsSel(n.id); }}>
                          <div className="sticky left-0 z-[5] flex items-center border-r border-[#9AA6AD]" style={{ width: ANCHO_IZQ, background: fondo, color: texto }}>
                            <div className="flex items-center gap-1 min-w-0" style={{ paddingLeft: 4 + fl.nivel * 10, width: 382 }}>
                              {abierto ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                              <span className="truncate" title={`${n.codCompleto} · ${n.nombre}`}><span className={claro ? 'opacity-70' : 'opacity-80'}>{n.codCompleto}</span>&nbsp; {n.nombre}</span>
                              <span className={`text-[9.5px] font-normal shrink-0 ${claro ? 'opacity-70' : 'opacity-80'}`}>({filtroEstado === 'soloMaster' ? `${n.nSolo ?? 0} solo en Master` : n.n})</span>
                            </div>
                            <div className="w-[104px]" />
                            <div className="w-[78px] text-right px-1">{fCorta(resumenWbs.get(n.id)?.ini ?? n.ini)}</div>
                            <div className="w-[78px] text-right px-1">{fCorta(resumenWbs.get(n.id)?.fin ?? n.fin)}</div>
                            {(() => { const rs = resumenWbs.get(n.id); const vf = variacionFin(rs?.lbFin, rs?.fin ?? n.fin); return <div className="w-[58px] text-right px-1">{vf == null ? '' : dias(vf, 8)}</div>; })()}
                            <div className={`w-[160px] text-right px-2 text-[10px] font-semibold ${claro ? 'text-[#B30000]' : 'text-[#FFD2D2]'}`}>{n.criticas && filtroEstado !== 'soloMaster' ? `${n.criticas} críticas` : ''}</div>
                          </div>
                          {(() => {
                            const rs = resumenWbs.get(n.id);
                            if (!rs || rs.ini == null || rs.fin == null) return null;
                            const x0 = ANCHO_IZQ + xDe(rs.ini), x1 = ANCHO_IZQ + xDe(rs.fin);
                            const tri = (x: number) => <div className="absolute" style={{ left: x - 4, top: 9, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '6px solid #14212A' }} />;
                            const xFinBarra = Math.max(x1, rs.restFin != null ? ANCHO_IZQ + xDe(rs.restFin) : x1);
                            return (
                              <>
                                {barrasLB && rs.lbIni != null && rs.lbFin != null && (
                                  <div className="absolute h-[3px] bg-[#E3B505]" style={{ left: ANCHO_IZQ + xDe(rs.lbIni), width: Math.max(2, xDe(rs.lbFin) - xDe(rs.lbIni)), top: 17 }}
                                    title={`Línea base: ${fCorta(rs.lbIni)} → ${fCorta(rs.lbFin)}`} />
                                )}
                                {/* Barra resumen del WBS (negra, con puntas) */}
                                <div className="absolute h-1 bg-[#14212A]" style={{ left: x0, width: Math.max(2, x1 - x0), top: 7 }} />
                                {tri(x0)}{tri(x1)}
                                {/* Contraído: trabajo real (azul) y restante (rojo si es crítico o del longest path) */}
                                {!abierto && rs.realIni != null && rs.realFin != null && (
                                  <div className="absolute h-2.5 bg-[#1F4FE0]" style={{ left: ANCHO_IZQ + xDe(rs.realIni), width: Math.max(2, xDe(rs.realFin) - xDe(rs.realIni)), top: 6 }} />
                                )}
                                {!abierto && rs.restIni != null && rs.restFin != null && (
                                  <div className={`absolute h-2.5 ${rs.roja ? 'bg-[#E8211B]' : 'bg-[#2B7F52]'}`} style={{ left: ANCHO_IZQ + xDe(rs.restIni), width: Math.max(2, xDe(rs.restFin) - xDe(rs.restIni)), top: 6 }} />
                                )}
                                {!abierto && (
                                  <div className="absolute whitespace-nowrap text-[10.5px] font-normal text-[#14212A] pointer-events-none" style={{ left: xFinBarra + 8, top: 3 }}>
                                    {fNum(rs.fin)}, {n.codCompleto ? <>{n.codCompleto}&nbsp;&nbsp;</> : null}{n.nombre}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      );
                    }
                    if (fl.tipo === 'master') {
                      // Rubro del Master que aún no existe en Primavera: solo informativo
                      const a = fl.a;
                      const ini = minutosDeFecha(a.start ?? a.blStart), fin = minutosDeFecha(a.finish ?? a.blFinish);
                      return (
                        <div key={`m${a.activityId}`} className="absolute flex text-[11px] border-b border-[#F0F2F4] bg-[#FAFAF7] text-[#7A868D] italic"
                          style={{ top, height: FILA, width: ANCHO_IZQ + anchoGantt }} title="Rubro creado en el Master que todavía no existe en el XER de Primavera">
                          <div className="sticky left-0 z-[5] flex items-center border-r border-[#D5DEE2] bg-[#FAFAF7]" style={{ width: ANCHO_IZQ }}>
                            <div className="w-[120px] px-2 font-mono text-[10px] truncate not-italic" style={{ paddingLeft: 4 + fl.nivel * 10 }}>{a.activityId}</div>
                            <div className="w-[262px] px-1 truncate" title={a.descripcion}>{a.descripcion}</div>
                            <div className="w-[104px]" />
                            <div className="w-[78px] text-right px-1">{fCorta(ini)}</div>
                            <div className="w-[78px] text-right px-1">{fCorta(fin)}</div>
                            <div className="w-[218px] px-2 text-[10px] not-italic"><span className="px-1.5 py-0.5 rounded bg-[#FFF3C4] text-[#7A5B00] font-semibold">Solo en Master · no está en P6</span></div>
                          </div>
                          {ini != null && fin != null && (
                            <div className="absolute h-2.5 rounded-sm border border-dashed border-[#9AA6AD] bg-[#E6EAEC]/60" style={{ left: ANCHO_IZQ + xDe(ini), width: Math.max(4, xDe(fin) - xDe(ini)), top: 6 }} />
                          )}
                        </div>
                      );
                    }
                    const v = fl.vt;
                    const critica = enRojo(v);
                    const esHito = v.tipo === 'TT_Mile' || v.tipo === 'TT_FinMile';
                    const seleccionada = sel === v.i;
                    const lbDatos = lbPorAct?.[v.i] ?? null;
                    const lb = verLB ? lbDatos : null;
                    const yB = verLB ? 3 : 6; // con línea base, la barra actual sube para dejarle sitio
                    const varFin = variacionFin(lbDatos?.[1], v.fin);
                    const tituloLB = lb ? ` · Línea base ${fCorta(lb[0])} → ${fCorta(lb[1])}${varFin != null ? ` (variación de fin ${varFin > 0 ? '+' : ''}${dias(varFin, v.hd)} d)` : ''}` : '';
                    return (
                      <div key={`a${v.i}`} onClick={() => { setSel(v.i); verFecha(v.resto ?? v.ini); }}
                        className={`absolute flex text-[11px] cursor-pointer border-b border-[#F0F2F4] ${seleccionada ? 'bg-[#FFF7D6]' : 'bg-white hover:bg-[#F7F9FA]'}`}
                        style={{ top, height: FILA, width: ANCHO_IZQ + anchoGantt }}>
                        <div className={`sticky left-0 z-[5] flex items-center border-r border-[#D5DEE2] ${seleccionada ? 'bg-[#FFF7D6]' : 'bg-white'}`} style={{ width: ANCHO_IZQ }}>
                          <div className="w-[120px] px-2 font-mono text-[10px] truncate" style={{ paddingLeft: 4 + fl.nivel * 10 }} title={v.cod}>{v.cod}</div>
                          <div className="w-[262px] px-1 truncate" title={v.nombre}>{v.nombre}</div>
                          <div className="w-[52px] text-right px-1">{dias(v.durO, v.hd)}</div>
                          <div className="w-[52px] text-right px-1">{dias(v.durR, v.hd)}</div>
                          <div className="w-[78px] text-right px-1">{fCorta(v.ini)}{v.iniA ? ' A' : ''}</div>
                          <div className="w-[78px] text-right px-1">{fCorta(v.fin)}{v.finA ? ' A' : ''}</div>
                          <div className={`w-[58px] text-right px-1 ${varFin != null && varFin < 0 ? 'text-red-600' : varFin ? 'text-[#2B7F52]' : ''}`} title={lbDatos ? `Línea base ${fCorta(lbDatos[0])} → ${fCorta(lbDatos[1])}` : 'Sin línea base'}>{varFin == null ? '' : dias(varFin, v.hd)}</div>
                          <div className={`w-[52px] text-right px-1 ${critica ? 'text-red-600 font-semibold' : ''}`}>{v.tf == null ? '' : dias(v.tf, v.hd)}</div>
                          <div className="w-[52px] text-right px-1">{v.ff == null ? '' : dias(v.ff, v.hd)}</div>
                          <div className="w-[56px] text-right px-2">{v.avance ? `${Math.round(v.avance * 10) / 10}%` : ''}</div>
                        </div>
                        {/* Barras */}
                        {lb && lb[0] != null && lb[1] != null && (esHito ? (
                          <div className="absolute w-2 h-2 rotate-45 bg-[#E3B505] border border-[#9C7C00]" style={{ left: ANCHO_IZQ + xDe(esHitoFinTipo(v.tipo) ? lb[1] : lb[0]) - 4, top: 13 }} title={`Línea base ${fCorta(lb[1])}`} />
                        ) : (
                          <div className="absolute h-[5px] bg-[#E3B505] rounded-sm" style={{ left: ANCHO_IZQ + xDe(lb[0]), width: Math.max(2, xDe(lb[1]) - xDe(lb[0])), top: 15 }}
                            title={`Línea base ${fCorta(lb[0])} → ${fCorta(lb[1])}`} />
                        ))}
                        {esHito ? (
                          v.ini != null && <div className="absolute w-2.5 h-2.5 rotate-45" style={{ left: ANCHO_IZQ + xDe(v.ini) - 5, top: yB, background: v.estado === 'TK_Complete' ? '#2C67A6' : critica ? '#CD0000' : '#14212A' }} title={`${v.cod} · ${fCorta(v.ini)}${tituloLB}`} />
                        ) : (
                          <>
                            {v.iniA && v.ini != null && (
                              <div className="absolute h-2.5 bg-[#2C67A6] rounded-sm" title={`Real${tituloLB}`}
                                style={{ left: ANCHO_IZQ + xDe(v.ini), width: Math.max(2, xDe(v.estado === 'TK_Complete' ? v.fin ?? v.ini : m.fechaDatos) - xDe(v.ini)), top: yB }} />
                            )}
                            {v.estado !== 'TK_Complete' && (v.resto ?? v.ini) != null && v.fin != null && (
                              <div className={`absolute h-2.5 rounded-sm ${critica ? 'bg-[#CD0000]' : 'bg-[#2B7F52]'}`} title={`Restante${tituloLB}`}
                                style={{ left: ANCHO_IZQ + xDe((v.resto ?? v.ini)!), width: Math.max(2, xDe(v.fin) - xDe((v.resto ?? v.ini)!)), top: yB }} />
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {sel != null && sel < vts.length && (
                <PanelActividad m={m} i={sel} editable={editable} cambios={cambios} version={version} onCambio={marcarCambio} onCerrar={() => setSel(null)}
                  onEliminar={() => {
                    const t = m.task, f = t.filas[sel];
                    const cod = celda(t, f, 'task_code');
                    const id = celda(t, f, 'task_id');
                    const nRel = m.pred.filas.filter(fr => celda(m.pred, fr, 'task_id') === id || celda(m.pred, fr, 'pred_task_id') === id).length;
                    if (!window.confirm(`¿Eliminar la actividad ${cod} · ${celda(t, f, 'task_name')}?\n\nTambién se quitan sus ${nRel} relaciones, sus asignaciones de recursos, códigos y campos personalizados.`)) return;
                    const log = [...cambios];
                    eliminarActividad(m, sel, log);
                    setSel(null);
                    marcarCambio(log);
                    mostrar(`Actividad ${cod} eliminada. Pulsa «Programar (F9)» para recalcular.`);
                  }} />
              )}
              {creando && (
                <NuevaActividadDialog m={m} nodos={arbolWbs.nodos} wbsInicial={(wbsSel && arbolWbs.nodos.has(wbsSel) ? wbsSel : null) ?? (sel != null ? vts[sel]?.wbs : null) ?? arbolWbs.raices[0]?.id ?? ''}
                  codigoBase={sel != null ? vts[sel]?.cod : ''}
                  onCancelar={() => setCreando(false)}
                  onCrear={(datos) => {
                    const log = [...cambios];
                    const r = crearActividad(m, { ...datos, usuario: username }, log);
                    if (typeof r === 'string') return r;
                    for (const rel of datos.relaciones) {
                      const err = rel.rol === 'pred'
                        ? agregarRelacion(m, rel.codigo, r, rel.tipo, 0, log)
                        : (() => { const otra = m.task.filas.findIndex(fr => celda(m.task, fr, 'task_code').toLowerCase() === rel.codigo.toLowerCase()); return otra < 0 ? `No existe ${rel.codigo}` : agregarRelacion(m, datos.codigo, otra, rel.tipo, 0, log); })();
                      if (err) mostrar(`Actividad creada, pero no la relación con ${rel.codigo}: ${err}`);
                    }
                    // Abrir el WBS donde quedó
                    abrirRama(datos.wbsId);
                    setCreando(false);
                    marcarCambio(log);
                    setSel(r);
                    mostrar(`Actividad ${datos.codigo} creada. Pulsa «Programar (F9)» para calcular sus fechas.`);
                    return null;
                  }} />
              )}
            </>
          ) : vista === 'wbs' ? (
            <VistaWbs m={m} raices={arbolWbs.raices} nodos={arbolWbs.nodos} editable={editable} cambios={cambios} version={version}
              onCambio={marcarCambio} mostrar={mostrar}
              onVerActividades={id => {
                abrirRama(id);
                setWbsSel(id);
                setAgrupacion('wbs');
                setVista('actividades');
              }} />
          ) : (
            <VistaRecursos m={m} version={version} />
          )}
        </>
      )}
    </div>
  );
};

/** Calcula nivel, código completo, orden y totales (fechas, nº de actividades, críticas) de un nodo y sus hijos. */
function resumirNodo(n: Nodo, nivel: number, padre: Nodo | undefined, esWbs: boolean, ordenHijos?: (a: Nodo, b: Nodo) => number) {
  const natural = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true });
  n.nivel = nivel;
  if (esWbs) n.codCompleto = padre ? `${padre.codCompleto}.${n.cod}` : n.cod;
  n.hijos.sort(ordenHijos ?? ((a, b) => a.seq - b.seq || natural(a.cod, b.cod)));
  n.tareas.sort((a, b) => (a.ini ?? 0) - (b.ini ?? 0) || natural(a.cod, b.cod));
  n.soloMaster?.sort((a, b) => natural(String(a.activityId), String(b.activityId)));
  let ini: number | null = null, fin: number | null = null, cnt = 0, crit = 0;
  const sumar = (i2: number | null, f2: number | null, c: number, k: number) => {
    if (i2 != null && (ini == null || i2 < ini)) ini = i2;
    if (f2 != null && (fin == null || f2 > fin)) fin = f2;
    cnt += c; crit += k;
  };
  let solo = n.soloMaster?.length ?? 0;
  for (const h of n.hijos) { resumirNodo(h, nivel + 1, n, esWbs, ordenHijos); sumar(h.ini, h.fin, h.n, h.criticas); solo += h.nSolo ?? 0; }
  n.nSolo = solo;
  for (const v of n.tareas) sumar(v.ini, v.fin, 1, v.tf != null && v.tf <= 0 ? 1 : 0);
  n.ini = ini; n.fin = fin; n.n = cnt; n.criticas = crit;
}

/** Ventana WBS (como la de P6): crear, renombrar, mover y eliminar nodos del WBS. */
const VistaWbs: React.FC<{
  m: ModeloP6; raices: Nodo[]; nodos: Map<string, Nodo>; editable: boolean; cambios: Cambio[]; version: number;
  onCambio: (log: Cambio[]) => void; mostrar: (t: string) => void; onVerActividades: (id: string) => void;
}> = ({ m, raices, nodos, editable, cambios, version, onCambio, mostrar, onVerActividades }) => {
  const [abiertosW, setAbiertosW] = React.useState<Set<string>>(() => new Set(raices.map(r => r.id)));
  const [selW, setSelW] = React.useState<string | null>(null);
  const [nuevo, setNuevo] = React.useState<{ modo: 'hijo' | 'hermano'; corto: string; nombre: string } | null>(null);
  const nodoSel = selW ? nodos.get(selW) : undefined;
  const esRaiz = !!nodoSel && raices.some(r => r.id === nodoSel.id);
  const alternarW = (id: string) => setAbiertosW(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  // El seleccionado siempre visible: tras crearlo o moverlo se abren sus padres.
  React.useEffect(() => {
    if (!selW) return;
    setAbiertosW(prev => {
      let w: string | undefined = nodos.get(selW)?.padre;
      const n = new Set(prev); let cambia = false;
      while (w && nodos.has(w)) { if (!n.has(w)) { n.add(w); cambia = true; } w = nodos.get(w)!.padre; }
      return cambia ? n : prev;
    });
  }, [selW, nodos]);

  // Filas visibles con lo necesario para dibujar las guías punteadas del árbol.
  const filasW: { n: Nodo; guias: boolean[]; ultimo: boolean }[] = [];
  const recorrer = (n: Nodo, guias: boolean[], ultimo: boolean) => {
    filasW.push({ n, guias, ultimo });
    if (!abiertosW.has(n.id)) return;
    const sig = n.nivel === 0 ? [] : [...guias, !ultimo];
    n.hijos.forEach((h, k) => recorrer(h, sig, k === n.hijos.length - 1));
  };
  raices.forEach((r, k) => recorrer(r, [], k === raices.length - 1));

  // Inicio real («A») si alguna actividad empezó; fin real solo si todas terminaron.
  const reales = React.useMemo(() => {
    const out = new Map<string, { iniA: boolean; finA: boolean }>();
    const ver = (n: Nodo): { iniA: boolean; finA: boolean; total: number } => {
      let iniA = n.tareas.some(t => t.iniA), finA = n.tareas.every(t => t.finA), total = n.tareas.length;
      for (const h of n.hijos) { const x = ver(h); iniA ||= x.iniA; if (x.total) finA &&= x.finA; total += x.total; }
      const res = { iniA, finA: finA && total > 0 };
      out.set(n.id, res);
      return { ...res, total };
    };
    raices.forEach(ver);
    return out;
  }, [raices]);

  const accion = (fn: (log: Cambio[]) => string | null, ok?: string) => {
    const log = [...cambios];
    const err = fn(log);
    if (err) { mostrar(err); return false; }
    onCambio(log);
    if (ok) mostrar(ok);
    return true;
  };
  const sugerirCodigo = (padreId: string) => {
    const hs = nodos.get(padreId)?.hijos || [];
    const nums = hs.map(h => Number(h.cod)).filter(x => Number.isFinite(x));
    let c = String(nums.length ? Math.max(...nums) + 1 : hs.length + 1);
    while (hs.some(h => h.cod.toLowerCase() === c.toLowerCase())) c = `${c}A`;
    return c;
  };
  const padreNuevo = () => (nuevo?.modo === 'hijo' || esRaiz ? nodoSel?.id : nodoSel?.padre) || '';
  const btn = 'px-2 py-1.5 border border-[#D5DEE2] rounded-lg hover:bg-[#F5F8F9] cursor-pointer flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      <div className="px-4 py-2 border-b border-[#D5DEE2] flex items-center gap-1.5 flex-wrap text-xs">
        {editable ? (
          <>
            <button className={btn} disabled={!nodoSel} onClick={() => nodoSel && setNuevo({ modo: 'hijo', corto: sugerirCodigo(nodoSel.id), nombre: '' })} title="Crear un WBS dentro del seleccionado"><Plus className="w-3.5 h-3.5" /> WBS hijo</button>
            <button className={btn} disabled={!nodoSel || esRaiz} onClick={() => nodoSel && setNuevo({ modo: 'hermano', corto: sugerirCodigo(nodoSel.padre), nombre: '' })} title="Crear un WBS al mismo nivel, debajo del seleccionado"><Plus className="w-3.5 h-3.5" /> Mismo nivel</button>
            <span className="w-px h-5 bg-[#D5DEE2] mx-1" />
            {([['arriba', ArrowUp, 'Subir'], ['abajo', ArrowDown, 'Bajar'], ['izquierda', ArrowLeft, 'Subir de nivel (quitar sangría)'], ['derecha', ArrowRight, 'Bajar de nivel (colgar del WBS anterior)']] as const).map(([a, Ic, tt]) => (
              <button key={a} className={btn} disabled={!nodoSel || esRaiz} title={tt}
                onClick={() => nodoSel && accion(log => moverWbs(m, nodoSel.id, a, log))}>
                <Ic className="w-3.5 h-3.5" />
              </button>
            ))}
            <span className="w-px h-5 bg-[#D5DEE2] mx-1" />
            <button className={`${btn} text-red-700`} disabled={!nodoSel || esRaiz} onClick={() => {
              if (!nodoSel) return;
              const ids = subarbolWbs(m, nodoSel.id);
              if (!window.confirm(`¿Eliminar el WBS ${nodoSel.codCompleto} · ${nodoSel.nombre}${ids.size > 1 ? ` y sus ${ids.size - 1} sub-WBS` : ''}?\n\nSus ${nodoSel.n} actividades no se borran: pasan al WBS padre.`)) return;
              const padre = nodoSel.padre;
              if (accion(log => eliminarWbs(m, nodoSel.id, log), `WBS ${nodoSel.codCompleto} eliminado; sus actividades pasaron al WBS padre.`)) setSelW(padre);
            }}><Trash2 className="w-3.5 h-3.5" /> Eliminar</button>
          </>
        ) : <span className="text-[#5A6A74]">Solo el administrador puede modificar el WBS.</span>}
        {nodoSel && (
          <button className={`${btn} ml-auto`} onClick={() => onVerActividades(nodoSel.id)} title="Ir a las actividades de este WBS"><Layers className="w-3.5 h-3.5" /> Ver actividades</button>
        )}
      </div>
      {/* Edición del seleccionado o alta de uno nuevo */}
      {editable && (nuevo || nodoSel) && (
        <div className="px-4 py-2 border-b border-[#D5DEE2] bg-[#F5F8F9] flex items-center gap-2 flex-wrap text-xs">
          {nuevo ? (
            <form className="flex items-center gap-2 flex-wrap" onSubmit={e => {
              e.preventDefault();
              const padre = padreNuevo();
              let creado = '';
              const ok = accion(log => {
                const r = crearWbs(m, padre, nuevo.corto, nuevo.nombre, log, nuevo.modo === 'hermano' ? nodoSel?.id : undefined);
                if (/^\d+$/.test(r)) { creado = r; return null; }
                return r;
              }, 'WBS creado.');
              if (ok) { setNuevo(null); setAbiertosW(prev => new Set([...prev, padre])); setSelW(creado || null); }
            }}>
              <b>Nuevo WBS {nuevo.modo === 'hijo' ? `dentro de ${nodoSel?.codCompleto}` : `al nivel de ${nodoSel?.codCompleto}`}</b>
              <input value={nuevo.corto} onChange={e => setNuevo({ ...nuevo, corto: e.target.value })} placeholder="Código" className="border border-[#D5DEE2] rounded px-2 py-1 w-24" autoFocus required />
              <input value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Nombre del WBS" className="border border-[#D5DEE2] rounded px-2 py-1 w-80" required />
              <button type="submit" className="px-3 py-1 rounded bg-[#312E81] text-white font-bold cursor-pointer">Crear</button>
              <button type="button" onClick={() => setNuevo(null)} className="px-2 py-1 rounded hover:bg-white cursor-pointer">Cancelar</button>
            </form>
          ) : nodoSel && !esRaiz ? (
            <div className="flex items-center gap-2 flex-wrap" key={`${nodoSel.id}-${version}`}>
              <b>Seleccionado:</b>
              <label className="flex items-center gap-1">Código
                <input defaultValue={nodoSel.cod} className="border border-[#D5DEE2] rounded px-2 py-1 w-24"
                  onBlur={e => e.target.value !== nodoSel.cod && accion(log => editarWbs(m, nodoSel.id, { corto: e.target.value }, log))}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
              </label>
              <label className="flex items-center gap-1">Nombre
                <input defaultValue={nodoSel.nombre} className="border border-[#D5DEE2] rounded px-2 py-1 w-96"
                  onBlur={e => e.target.value !== nodoSel.nombre && accion(log => editarWbs(m, nodoSel.id, { nombre: e.target.value }, log))}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
              </label>
              <span className="text-[#5A6A74]">{nodoSel.n} actividades</span>
            </div>
          ) : <span className="text-[#5A6A74]">El nodo del proyecto no se edita aquí. Elige un WBS para modificarlo.</span>}
        </div>
      )}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[12px] border-collapse text-[#1A1A1A] select-none">
          <thead className="sticky top-0 z-10 bg-[#F0F0F0] text-[11.5px] font-normal">
            <tr className="text-left">
              <th className="px-2 py-1 font-normal border border-[#C8C8C8] w-[340px]">Código WBS</th>
              <th className="px-2 font-normal border border-[#C8C8C8]">Nombre WBS</th>
              <th className="px-2 font-normal border border-[#C8C8C8] text-right w-28">Total actividades</th>
              <th className="px-2 font-normal border border-[#C8C8C8] w-28">Inicio</th>
              <th className="px-2 font-normal border border-[#C8C8C8] w-28">Fin real</th>
            </tr>
          </thead>
          <tbody>
            {filasW.map(({ n, guias, ultimo }) => {
              const elegido = selW === n.id;
              const abierto = abiertosW.has(n.id) && n.hijos.length > 0;
              const re = reales.get(n.id);
              const linea = elegido ? '#FFFFFF' : '#6E6E6E';
              const vert = (top: string, bottom: string) => <span className="absolute" style={{ left: 8, top, bottom, borderLeft: `1px dotted ${linea}` }} />;
              const horiz = <span className="absolute" style={{ left: 8, right: 0, top: '50%', borderTop: `1px dotted ${linea}` }} />;
              return (
                <tr key={n.id} onClick={() => setSelW(n.id)} onDoubleClick={() => alternarW(n.id)}
                  className={`cursor-pointer ${elegido ? 'bg-[#0A64C8] text-white' : 'hover:bg-[#EAF2FB]'}`}>
                  <td className="p-0 border-r border-[#E2E2E2]">
                    <div className="flex items-stretch h-[21px] pr-2" style={{ paddingLeft: 4 }}>
                      {/* Guías de los niveles superiores */}
                      {guias.map((g, k) => <span key={k} className="relative w-4 shrink-0">{g && vert('0', '0')}</span>)}
                      {/* Conector hacia el padre */}
                      {n.nivel > 0 && <span className="relative w-4 shrink-0">{vert('0', ultimo ? '50%' : '0')}{horiz}</span>}
                      {/* Caja +/− (o tramo horizontal si no tiene hijos) */}
                      <span className="relative w-4 shrink-0 flex items-center justify-center">
                        {abierto && vert('50%', '0')}
                        {n.hijos.length ? (
                          <button onClick={e => { e.stopPropagation(); alternarW(n.id); }} title={abierto ? 'Contraer' : 'Desplegar'}
                            className="relative z-[1] w-[11px] h-[11px] border border-[#8C8C8C] bg-white text-[#1A1A1A] flex items-center justify-center leading-none text-[10px] font-bold cursor-pointer">
                            {abierto ? '−' : '+'}
                          </button>
                        ) : n.nivel > 0 ? <span className="absolute" style={{ left: 0, right: 0, top: '50%', borderTop: `1px dotted ${linea}` }} /> : null}
                      </span>
                      <span className="flex items-center gap-1.5 pl-1 whitespace-nowrap">
                        <IconoWbs />
                        <span className={elegido ? 'outline outline-1 outline-[#F7A000] px-0.5' : 'px-0.5'}>{n.codCompleto}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-2 truncate max-w-[560px] border-r border-[#E2E2E2]" title={n.nombre}>{n.nombre}</td>
                  <td className="px-2 text-right border-r border-[#E2E2E2]">{n.n}</td>
                  <td className="px-2 whitespace-nowrap border-r border-[#E2E2E2]">{fNum(n.ini)}{re?.iniA && n.ini != null ? ' A' : ''}</td>
                  <td className="px-2 whitespace-nowrap">{re?.finA ? fNum(n.fin) : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/** Icono de nodo WBS como el de P6 (dos carpetas azules superpuestas). */
const IconoWbs = () => (
  <svg width="16" height="14" viewBox="0 0 16 14" className="shrink-0">
    <rect x="0.5" y="0.5" width="10" height="8" fill="#2B5FD9" stroke="#1B3E91" />
    <rect x="5.5" y="5.5" width="10" height="8" fill="#3D7CF0" stroke="#1B3E91" />
  </svg>
);

/** Fecha corta numérica como en P6: 25-05-22. */
const fNum = (t: number | null | undefined) => {
  if (t == null || !isFinite(t)) return '';
  const d = new Date(t * 60000);
  return `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCFullYear()).slice(2)}`;
};

/** Siguiente ID libre a partir de otro (13.1.5 → 13.1.6; ABC → ABC.1). */
function siguienteCodigo(base: string, existe: (c: string) => boolean): string {
  if (!base) return '';
  const m = /^(.*?)(\d+)$/.exec(base);
  let c = m ? `${m[1]}${Number(m[2]) + 1}` : `${base}.1`;
  for (let k = 0; k < 500 && existe(c); k++) {
    const mm = /^(.*?)(\d+)$/.exec(c);
    c = mm ? `${mm[1]}${Number(mm[2]) + 1}` : `${c}.1`;
  }
  return c;
}

/** Diálogo para crear una actividad. */
const NuevaActividadDialog: React.FC<{
  m: ModeloP6; nodos: Map<string, Nodo>; wbsInicial: string; codigoBase: string;
  onCancelar: () => void;
  onCrear: (d: { wbsId: string; codigo: string; nombre: string; tipo: string; durHoras: number; relaciones: { rol: 'pred' | 'succ'; codigo: string; tipo: string }[] }) => string | null;
}> = ({ m, nodos, wbsInicial, codigoBase, onCancelar, onCrear }) => {
  const t = m.task;
  const codigos = React.useMemo(() => new Set(t.filas.map(f => celda(t, f, 'task_code').toLowerCase())), [t]);
  const [wbsId, setWbsId] = React.useState(wbsInicial);
  const [codigo, setCodigo] = React.useState(() => siguienteCodigo(codigoBase, c => codigos.has(c.toLowerCase())));
  const [nombre, setNombre] = React.useState('');
  const [tipo, setTipo] = React.useState('TT_Task');
  const [diasDur, setDiasDur] = React.useState('5');
  const [pred, setPred] = React.useState(codigoBase || '');
  const [succ, setSucc] = React.useState('');
  const [error, setError] = React.useState('');
  const opciones = React.useMemo(() => [...nodos.values()].sort((a, b) => a.codCompleto.localeCompare(b.codCompleto, 'es', { numeric: true })), [nodos]);
  const hd = 8;
  const inp = 'border border-[#D5DEE2] rounded-lg px-2 py-1.5 text-xs w-full';
  return (
    <div className="fixed inset-0 z-[130] bg-slate-900/40 flex items-center justify-center p-4" onMouseDown={onCancelar}>
      <form onMouseDown={e => e.stopPropagation()} onSubmit={e => {
        e.preventDefault();
        const rels: { rol: 'pred' | 'succ'; codigo: string; tipo: string }[] = [];
        if (pred.trim()) rels.push({ rol: 'pred', codigo: pred.trim(), tipo: 'FS' });
        if (succ.trim()) rels.push({ rol: 'succ', codigo: succ.trim(), tipo: 'FS' });
        const err = onCrear({ wbsId, codigo: codigo.trim(), nombre: nombre.trim(), tipo, durHoras: (Number(diasDur) || 0) * hd, relaciones: rels });
        if (err) setError(err);
      }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-3 text-xs">
        <div className="flex items-center gap-2"><Plus className="w-4 h-4 text-[#312E81]" /><h3 className="text-sm font-bold">Nueva actividad</h3></div>
        <label className="block space-y-1"><span className="text-[#5A6A74]">WBS</span>
          <select value={wbsId} onChange={e => setWbsId(e.target.value)} className={inp}>
            {opciones.map(n => <option key={n.id} value={n.id}>{n.codCompleto} · {n.nombre}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="block space-y-1 col-span-1"><span className="text-[#5A6A74]">ID de actividad</span>
            <input value={codigo} onChange={e => setCodigo(e.target.value)} className={inp} autoFocus required />
          </label>
          <label className="block space-y-1 col-span-2"><span className="text-[#5A6A74]">Nombre</span>
            <input value={nombre} onChange={e => setNombre(e.target.value)} className={inp} required />
          </label>
          <label className="block space-y-1"><span className="text-[#5A6A74]">Tipo</span>
            <select value={tipo} onChange={e => setTipo(e.target.value)} className={inp}>
              <option value="TT_Task">Tarea</option>
              <option value="TT_Mile">Hito de inicio</option>
              <option value="TT_FinMile">Hito de fin</option>
            </select>
          </label>
          <label className="block space-y-1"><span className="text-[#5A6A74]">Duración (días)</span>
            <input type="number" min="0" step="0.5" value={tipo === 'TT_Task' ? diasDur : '0'} disabled={tipo !== 'TT_Task'} onChange={e => setDiasDur(e.target.value)} className={inp} />
          </label>
          <div />
          <label className="block space-y-1 col-span-3 sm:col-span-1"><span className="text-[#5A6A74]">Predecesora (FS, opcional)</span>
            <input value={pred} onChange={e => setPred(e.target.value)} placeholder="ID" className={inp} />
          </label>
          <label className="block space-y-1 col-span-3 sm:col-span-1"><span className="text-[#5A6A74]">Sucesora (FS, opcional)</span>
            <input value={succ} onChange={e => setSucc(e.target.value)} placeholder="ID" className={inp} />
          </label>
        </div>
        <p className="text-[11px] text-[#5A6A74]">Nace como «No iniciada» con el calendario de su WBS. Las fechas se calculan al pulsar «Programar (F9)». Las relaciones se pueden ajustar luego en su pestaña.</p>
        {error && <p className="text-[11.5px] text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancelar} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 cursor-pointer">Cancelar</button>
          <button type="submit" className="px-3 py-1.5 rounded-lg bg-[#312E81] text-white font-bold cursor-pointer">Crear actividad</button>
        </div>
      </form>
    </div>
  );
};

/** Panel inferior con los detalles de la actividad (como el de P6). */
const PanelActividad: React.FC<{
  m: ModeloP6; i: number; editable: boolean; cambios: Cambio[]; version: number;
  onCambio: (log: Cambio[]) => void; onCerrar: () => void; onEliminar: () => void;
}> = ({ m, i, editable, cambios, version, onCambio, onCerrar, onEliminar }) => {
  const [pest, setPest] = React.useState<'estado' | 'relaciones' | 'recursos' | 'cambios'>('estado');
  const [nuevoCod, setNuevoCod] = React.useState('');
  const [nuevoTipo, setNuevoTipo] = React.useState('FS');
  const [nuevoLag, setNuevoLag] = React.useState('0');
  const [nuevoRol, setNuevoRol] = React.useState<'pred' | 'succ'>('pred');
  const t = m.task;
  const f = t.filas[i];
  const g = (c: string) => celda(t, f, c);
  const cal = m.calendarios.get(g('clndr_id'));
  const hd = cal?.horasDia || 8;
  const estado = g('status_code');
  const log = () => [...cambios];
  const editar = (e: EdicionActividad) => { const l = log(); editarActividad(m, i, e, l); onCambio(l); };
  const fechaInput = (s: string) => s.slice(0, 10);

  const rels = React.useMemo(() => {
    const p = m.pred;
    const id = g('task_id');
    const out: { fila: number; otra: number; tipo: string; lag: number; rol: 'pred' | 'succ' }[] = [];
    p.filas.forEach((fr, k) => {
      const a = celda(p, fr, 'pred_task_id'), b = celda(p, fr, 'task_id');
      if (b === id) { const o = m.porId.get(a); if (o !== undefined) out.push({ fila: k, otra: o, tipo: celda(p, fr, 'pred_type').replace('PR_', ''), lag: Number(celda(p, fr, 'lag_hr_cnt')) || 0, rol: 'pred' }); }
      if (a === id) { const o = m.porId.get(b); if (o !== undefined) out.push({ fila: k, otra: o, tipo: celda(p, fr, 'pred_type').replace('PR_', ''), lag: Number(celda(p, fr, 'lag_hr_cnt')) || 0, rol: 'succ' }); }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, i, version]);

  const asignaciones = React.useMemo(() => {
    const tr = m.xer.tablas.get('TASKRSRC');
    const rs = m.xer.tablas.get('RSRC');
    const nombres = new Map((rs?.filas || []).map(fr => [celda(rs!, fr, 'rsrc_id'), celda(rs!, fr, 'rsrc_name')]));
    return (tr?.filas || []).filter(fr => celda(tr!, fr, 'task_id') === g('task_id')).map(fr => {
      const n = (c: string) => Number(celda(tr!, fr, c)) || 0;
      return { recurso: nombres.get(celda(tr!, fr, 'rsrc_id')) || celda(tr!, fr, 'rsrc_id'), qP: n('target_qty'), qR: n('act_reg_qty'), qF: n('remain_qty'), cP: n('target_cost'), cR: n('act_reg_cost'), cF: n('remain_cost') };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, i, version]);

  const Campo: React.FC<{ etq: string; children: React.ReactNode }> = ({ etq, children }) => (
    <label className="flex flex-col gap-0.5 text-[10.5px] text-[#5A6A74]"><span>{etq}</span>{children}</label>
  );
  const inp = 'border border-[#D5DEE2] rounded px-1.5 py-1 text-[11.5px] text-[#14212A] bg-white disabled:bg-[#F5F8F9] disabled:text-[#5A6A74]';

  return (
    <div className="h-[260px] shrink-0 bg-white border-t-2 border-[#312E81] flex flex-col">
      <div className="flex items-center gap-1 px-3 pt-1.5 border-b border-[#D5DEE2] text-[11.5px]">
        <span className="font-bold mr-2 truncate max-w-[420px]" title={g('task_name')}><span className="font-mono text-[#5A6A74]">{g('task_code')}</span> · {g('task_name')}</span>
        {(['estado', 'relaciones', 'recursos', 'cambios'] as const).map(p => (
          <button key={p} onClick={() => setPest(p)} className={`px-2.5 py-1 rounded-t cursor-pointer ${pest === p ? 'bg-[#312E81] text-white font-bold' : 'text-[#5A6A74] hover:text-[#14212A]'}`}>
            {p === 'estado' ? 'General y avance' : p === 'relaciones' ? `Relaciones (${rels.length})` : p === 'recursos' ? `Recursos (${asignaciones.length})` : `Cambios (${cambios.length})`}
          </button>
        ))}
        {editable && (
          <button onClick={onEliminar} className="ml-auto px-2 py-1 rounded text-red-700 hover:bg-red-50 flex items-center gap-1 cursor-pointer" title="Eliminar esta actividad">
            <Trash2 className="w-3.5 h-3.5" /> Eliminar
          </button>
        )}
        <button onClick={onCerrar} className={`${editable ? '' : 'ml-auto '}p-1 hover:bg-[#F5F8F9] rounded cursor-pointer`}><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="flex-1 overflow-auto p-3">
        {pest === 'estado' && (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3" key={`${i}-${version}`}>
            <Campo etq="Nombre">
              <input className={inp} disabled={!editable} defaultValue={g('task_name')} onBlur={e => e.target.value !== g('task_name') && editar({ nombre: e.target.value })} />
            </Campo>
            <Campo etq="Estado"><div className="py-1 text-[11.5px] text-[#14212A] font-semibold">{ESTADO_TXT[estado] || estado}</div></Campo>
            <Campo etq={`Duración original (días de ${hd} h)`}>
              <input type="number" step="0.5" min="0" className={inp} disabled={!editable || estado === 'TK_Complete'} defaultValue={(Number(g('target_drtn_hr_cnt')) || 0) / hd}
                onBlur={e => { const v = Number(e.target.value) * hd; if (v !== Number(g('target_drtn_hr_cnt'))) editar({ durOriginal: v }); }} />
            </Campo>
            <Campo etq="Duración restante (días)">
              <input type="number" step="0.5" min="0" className={inp} disabled={!editable || estado === 'TK_Complete'} defaultValue={(Number(g('remain_drtn_hr_cnt')) || 0) / hd}
                onBlur={e => { const v = Number(e.target.value) * hd; if (v !== Number(g('remain_drtn_hr_cnt'))) editar({ durRestante: v }); }} />
            </Campo>
            <Campo etq="% de avance físico">
              <input type="number" min="0" max="100" step="1" className={inp} disabled={!editable} defaultValue={Math.round((Number(g('phys_complete_pct')) || 0) * 10) / 10}
                onBlur={e => { const v = Number(e.target.value); if (v !== Number(g('phys_complete_pct'))) editar({ avance: v }); }} />
            </Campo>
            <Campo etq="Calendario"><div className="py-1 text-[11.5px] text-[#14212A] truncate">{cal?.nombre || '—'}</div></Campo>
            <Campo etq="Inicio real">
              <input type="date" className={inp} disabled={!editable} defaultValue={fechaInput(g('act_start_date'))}
                onChange={e => editar({ inicioReal: e.target.value ? `${e.target.value} 08:00` : null })} />
            </Campo>
            <Campo etq="Fin real">
              <input type="date" className={inp} disabled={!editable || estado === 'TK_NotStart' && !g('act_start_date')} defaultValue={fechaInput(g('act_end_date'))}
                onChange={e => editar({ finReal: e.target.value ? `${e.target.value} 16:00` : null })} />
            </Campo>
            <Campo etq="Restricción">
              <select className={inp} disabled={!editable} defaultValue={g('cstr_type')}
                onChange={e => editar({ restriccion: e.target.value ? { tipo: e.target.value, fecha: g('cstr_date') || aTexto(m.fechaDatos) } : null })}>
                {RESTRICCIONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Campo>
            <Campo etq="Fecha de restricción">
              <input type="date" className={inp} disabled={!editable || !g('cstr_type') || g('cstr_type') === 'CS_ALAP'} defaultValue={fechaInput(g('cstr_date'))}
                onChange={e => e.target.value && editar({ restriccion: { tipo: g('cstr_type'), fecha: `${e.target.value} ${g('cstr_type').startsWith('CS_ME') ? '16:00' : '08:00'}` } })} />
            </Campo>
            <Campo etq="Inicio / fin temprano"><div className="py-1 text-[11.5px] text-[#14212A]">{fCorta(aMinutos(g('early_start_date')))} → {fCorta(aMinutos(g('early_end_date')))}</div></Campo>
            <Campo etq="Inicio / fin tardío"><div className="py-1 text-[11.5px] text-[#14212A]">{fCorta(aMinutos(g('late_start_date')))} → {fCorta(aMinutos(g('late_end_date')))}</div></Campo>
            <Campo etq="Holgura total / libre (días)"><div className="py-1 text-[11.5px] text-[#14212A]">{g('total_float_hr_cnt') === '' ? '—' : dias(Number(g('total_float_hr_cnt')), hd)} / {g('free_float_hr_cnt') === '' ? '—' : dias(Number(g('free_float_hr_cnt')), hd)}</div></Campo>
          </div>
        )}
        {pest === 'relaciones' && (
          <div className="grid md:grid-cols-2 gap-4 text-[11.5px]">
            {(['pred', 'succ'] as const).map(rol => (
              <div key={rol}>
                <div className="font-bold text-[#312E81] mb-1">{rol === 'pred' ? 'Predecesoras' : 'Sucesoras'}</div>
                <table className="w-full">
                  <thead><tr className="text-[10px] text-[#5A6A74] text-left"><th>ID</th><th>Nombre</th><th>Tipo</th><th>Desfase (d)</th><th></th></tr></thead>
                  <tbody>
                    {rels.filter(r => r.rol === rol).map(r => (
                      <tr key={`${r.fila}-${version}`} className="border-t border-[#F0F2F4]">
                        <td className="font-mono text-[10px] pr-2">{celda(t, t.filas[r.otra], 'task_code')}</td>
                        <td className="truncate max-w-[220px] pr-2" title={celda(t, t.filas[r.otra], 'task_name')}>{celda(t, t.filas[r.otra], 'task_name')}</td>
                        <td>
                          <select disabled={!editable} defaultValue={r.tipo} className="border border-[#D5DEE2] rounded px-1 text-[11px]"
                            onChange={e => { const l = log(); editarRelacion(m, r.fila, e.target.value, r.lag, l); onCambio(l); }}>
                            {['FS', 'SS', 'FF', 'SF'].map(x => <option key={x}>{x}</option>)}
                          </select>
                        </td>
                        <td>
                          <input type="number" step="0.5" disabled={!editable} defaultValue={r.lag / hd} className="w-16 border border-[#D5DEE2] rounded px-1 text-[11px]"
                            onBlur={e => { const v = Number(e.target.value) * hd; if (v !== r.lag) { const l = log(); editarRelacion(m, r.fila, r.tipo, v, l); onCambio(l); } }} />
                        </td>
                        <td>{editable && <button className="text-red-600 hover:underline cursor-pointer" onClick={() => { const l = log(); eliminarRelacion(m, r.fila, l); onCambio(l); }}>Quitar</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {editable && (
              <div className="md:col-span-2 flex items-center gap-2 flex-wrap bg-[#F5F8F9] rounded-lg p-2">
                <span className="font-semibold">Agregar</span>
                <select value={nuevoRol} onChange={e => setNuevoRol(e.target.value as any)} className="border border-[#D5DEE2] rounded px-1 py-0.5">
                  <option value="pred">predecesora</option><option value="succ">sucesora</option>
                </select>
                <input value={nuevoCod} onChange={e => setNuevoCod(e.target.value)} placeholder="ID de actividad" className="border border-[#D5DEE2] rounded px-1.5 py-0.5 w-40" />
                <select value={nuevoTipo} onChange={e => setNuevoTipo(e.target.value)} className="border border-[#D5DEE2] rounded px-1 py-0.5">
                  {['FS', 'SS', 'FF', 'SF'].map(x => <option key={x}>{x}</option>)}
                </select>
                <input type="number" step="0.5" value={nuevoLag} onChange={e => setNuevoLag(e.target.value)} className="border border-[#D5DEE2] rounded px-1.5 py-0.5 w-20" title="Desfase en días" />
                <span className="text-[#5A6A74]">días</span>
                <button className="px-2.5 py-1 rounded bg-[#312E81] text-white font-bold cursor-pointer" onClick={() => {
                  const l = log();
                  let err: string | null;
                  if (nuevoRol === 'pred') err = agregarRelacion(m, nuevoCod, i, nuevoTipo, Number(nuevoLag) * hd, l);
                  else {
                    const otra = t.filas.findIndex(fr => celda(t, fr, 'task_code').toLowerCase() === nuevoCod.trim().toLowerCase());
                    err = otra < 0 ? `No existe la actividad ${nuevoCod}.` : agregarRelacion(m, g('task_code'), otra, nuevoTipo, Number(nuevoLag) * hd, l);
                  }
                  if (err) window.alert(err); else { setNuevoCod(''); onCambio(l); }
                }}>Agregar</button>
              </div>
            )}
          </div>
        )}
        {pest === 'recursos' && (
          <table className="w-full text-[11.5px]">
            <thead><tr className="text-[10px] text-[#5A6A74] text-right"><th className="text-left">Recurso</th><th>Cant. presup.</th><th>Cant. real</th><th>Cant. restante</th><th>Costo presup.</th><th>Costo real</th><th>Costo restante</th></tr></thead>
            <tbody>
              {asignaciones.map((a, k) => (
                <tr key={k} className="border-t border-[#F0F2F4] text-right">
                  <td className="text-left font-semibold">{a.recurso}</td>
                  <td>{a.qP.toLocaleString('es-ES', { maximumFractionDigits: 2 })}</td><td>{a.qR.toLocaleString('es-ES', { maximumFractionDigits: 2 })}</td><td>{a.qF.toLocaleString('es-ES', { maximumFractionDigits: 2 })}</td>
                  <td>{dinero(a.cP)}</td><td className="text-[#2B7F52]">{dinero(a.cR)}</td><td>{dinero(a.cF)}</td>
                </tr>
              ))}
              {!asignaciones.length && <tr><td colSpan={7} className="text-center text-[#5A6A74] py-4">Sin recursos asignados.</td></tr>}
            </tbody>
          </table>
        )}
        {pest === 'cambios' && (
          <table className="w-full text-[11px]">
            <thead><tr className="text-[10px] text-[#5A6A74] text-left"><th>Actividad</th><th>Campo</th><th>Antes</th><th>Después</th></tr></thead>
            <tbody>
              {[...cambios].reverse().map((c, k) => (
                <tr key={k} className="border-t border-[#F0F2F4]"><td className="font-mono">{c.actividad}</td><td>{c.campo}</td><td className="text-[#5A6A74]">{c.antes}</td><td className="font-semibold">{c.despues}</td></tr>
              ))}
              {!cambios.length && <tr><td colSpan={4} className="text-center text-[#5A6A74] py-4">Sin cambios desde que se guardó.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

/** Costos por mes de cada recurso: real, restante (según la programación) y presupuestado. */
const VistaRecursos: React.FC<{ m: ModeloP6; version: number }> = ({ m, version }) => {
  const datos = React.useMemo(() => {
    const tr = m.xer.tablas.get('TASKRSRC');
    const rs = m.xer.tablas.get('RSRC');
    const t = m.task;
    const nombres = new Map((rs?.filas || []).map(fr => [celda(rs!, fr, 'rsrc_id'), celda(rs!, fr, 'rsrc_name')]));
    const porRec = new Map<string, Map<string, { real: number; rest: number; pres: number }>>();
    const repartir = (mapa: Map<string, { real: number; rest: number; pres: number }>, a: number | null, b: number | null, monto: number, k: 'real' | 'rest' | 'pres') => {
      if (!monto || a == null) return;
      const ini = a, fin = Math.max(b ?? a, a + 1);
      const total = fin - ini;
      let cur = ini;
      while (cur < fin) {
        const d = new Date(cur * 60000);
        const sig = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 60000;
        const tramo = Math.min(fin, sig) - cur;
        const clave = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        const e = mapa.get(clave) || { real: 0, rest: 0, pres: 0 };
        e[k] += monto * (tramo / total);
        mapa.set(clave, e);
        cur = sig;
      }
    };
    for (const fr of tr?.filas || []) {
      const i = m.porId.get(celda(tr!, fr, 'task_id'));
      if (i === undefined) continue;
      const ft = t.filas[i];
      const rec = nombres.get(celda(tr!, fr, 'rsrc_id')) || celda(tr!, fr, 'rsrc_id');
      const mapa = porRec.get(rec) || new Map();
      porRec.set(rec, mapa);
      const n = (c: string) => Number(celda(tr!, fr, c)) || 0;
      repartir(mapa, aMinutos(celda(tr!, fr, 'target_start_date')), aMinutos(celda(tr!, fr, 'target_end_date')), n('target_cost'), 'pres');
      const as = aMinutos(celda(t, ft, 'act_start_date'));
      const af = aMinutos(celda(t, ft, 'act_end_date'));
      // Sin inicio real (costo real cargado sin fechas): se usa el inicio planificado de la asignación
      const asP = as ?? aMinutos(celda(tr!, fr, 'act_start_date')) ?? aMinutos(celda(tr!, fr, 'target_start_date'));
      // Lo real nunca va después de la fecha de datos
      const asR = asP == null ? null : Math.min(asP, m.fechaDatos - 1440);
      repartir(mapa, asR, af ?? aMinutos(celda(tr!, fr, 'act_end_date')) ?? Math.max(asR ?? m.fechaDatos, Math.min(m.fechaDatos, aMinutos(celda(tr!, fr, 'target_end_date')) ?? m.fechaDatos)), n('act_reg_cost'), 'real');
      repartir(mapa, aMinutos(celda(t, ft, 'early_start_date')), aMinutos(celda(t, ft, 'early_end_date')), n('remain_cost'), 'rest');
    }
    return [...porRec.entries()].map(([rec, mapa]) => {
      const meses = [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      return { rec, meses };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, version]);
  const [recSel, setRecSel] = React.useState(0);
  const d = datos[recSel];
  if (!d) return <div className="flex-1 flex items-center justify-center text-sm text-[#5A6A74]">El XER no trae asignaciones de recursos.</div>;
  const max = Math.max(1, ...d.meses.map(([, v]) => Math.max(v.real + v.rest, v.pres)));
  let acR = 0, acP = 0;
  const acum = d.meses.map(([k, v]) => { acR += v.real + v.rest; acP += v.pres; return { k, acR, acP }; });
  const maxAc = Math.max(1, acR, acP);
  const W = Math.max(800, d.meses.length * 14), H = 260;
  const bw = W / d.meses.length;
  const tot = d.meses.reduce((s, [, v]) => ({ real: s.real + v.real, rest: s.rest + v.rest, pres: s.pres + v.pres }), { real: 0, rest: 0, pres: 0 });
  const hoy = `${aTexto(m.fechaDatos).slice(0, 7)}`;
  return (
    <div className="flex-1 overflow-auto p-4 bg-white">
      <div className="flex items-center gap-2 mb-3 flex-wrap text-xs">
        {datos.map((r, k) => (
          <button key={r.rec} onClick={() => setRecSel(k)} className={`px-3 py-1.5 rounded-lg border cursor-pointer ${k === recSel ? 'bg-[#312E81] text-white border-[#312E81] font-bold' : 'border-[#D5DEE2] text-[#5A6A74]'}`}>{r.rec}</button>
        ))}
        <div className="ml-auto flex gap-4 text-[11.5px]">
          <span>Presupuestado: <b>{dinero(tot.pres)}</b></span>
          <span>Real: <b className="text-[#2C67A6]">{dinero(tot.real)}</b></span>
          <span>Restante: <b className="text-[#2B7F52]">{dinero(tot.rest)}</b></span>
          <span>Al terminar: <b>{dinero(tot.real + tot.rest)}</b></span>
        </div>
      </div>
      <div className="overflow-x-auto border border-[#D5DEE2] rounded-lg">
        <svg width={W} height={H + 40} className="block">
          {d.meses.map(([k, v], j) => {
            const x = j * bw;
            const hR = (v.real / max) * H, hF = (v.rest / max) * H;
            return (
              <g key={k}>
                <rect x={x + 1} y={H - hR} width={Math.max(1, bw - 2)} height={hR} fill="#2C67A6"><title>{`${k} · real ${dinero(v.real)}`}</title></rect>
                <rect x={x + 1} y={H - hR - hF} width={Math.max(1, bw - 2)} height={hF} fill="#2B7F52"><title>{`${k} · restante ${dinero(v.rest)}`}</title></rect>
                {k.endsWith('-01') && <text x={x + 2} y={H + 14} fontSize="10" fill="#5A6A74">{k.slice(0, 4)}</text>}
                {k === hoy && <line x1={x} x2={x} y1={0} y2={H} stroke="#CD0000" strokeDasharray="3 3" />}
              </g>
            );
          })}
          <polyline fill="none" stroke="#14212A" strokeWidth="1.5" points={acum.map((a, j) => `${j * bw + bw / 2},${H - (a.acR / maxAc) * H}`).join(' ')} />
          <polyline fill="none" stroke="#A86B12" strokeWidth="1.5" strokeDasharray="4 3" points={acum.map((a, j) => `${j * bw + bw / 2},${H - (a.acP / maxAc) * H}`).join(' ')} />
          <g fontSize="10" fill="#5A6A74">
            <rect x={8} y={H + 22} width={10} height={8} fill="#2C67A6" /><text x={22} y={H + 30}>Real por mes</text>
            <rect x={110} y={H + 22} width={10} height={8} fill="#2B7F52" /><text x={124} y={H + 30}>Restante por mes (según la programación)</text>
            <line x1={345} x2={365} y1={H + 26} y2={H + 26} stroke="#14212A" strokeWidth="1.5" /><text x={370} y={H + 30}>Acumulado real + restante</text>
            <line x1={520} x2={540} y1={H + 26} y2={H + 26} stroke="#A86B12" strokeDasharray="4 3" /><text x={545} y={H + 30}>Acumulado presupuestado</text>
          </g>
        </svg>
      </div>
      <p className="text-[11px] text-[#5A6A74] mt-2">
        Cada asignación se reparte de forma uniforme entre sus fechas: el presupuesto entre sus fechas planificadas, lo real entre el inicio real y el fin real (o la fecha de datos) y lo restante entre las fechas tempranas de la actividad. Tras reprogramar (F9), la curva restante muestra el nuevo flujo.
      </p>
    </div>
  );
};
