/**
 * Cronograma P6: abre el XER de Primavera dentro de Trakciona, como un programa.
 * Tabla de actividades por WBS + Gantt, edición de fechas, avance, duraciones, restricciones y
 * relaciones, programación (F9) con el motor CPM, vista de recursos y exportación del XER.
 * Todos consultan; solo el administrador edita, programa y guarda.
 */
import React from 'react';
import { ChevronDown, ChevronRight, Download, Upload, Save, Play, X, Search, Calendar, Layers, BarChart3, Plus, Trash2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Network, ShoppingCart, Truck, Wrench, HardHat } from 'lucide-react';
import { leerXer, escribirXer, codificarXer, decodificarXer, celda } from '../../utils/p6/xer';
import { CAMPOS_AGRUPACION, NIVELES_POR_DEFECTO, SIN_MASTER, clasificacionXer, etiquetaUbicacion, ordenUbicacion, type Clasificacion, enAmbito, esConstruccion, valorCampo, RE_HITO_CONSTRUCCION, RE_HITO_EQUIPAMIENTO, ocultoEnEjecucion, etiquetaCampo, type Ambito, indiceMaster, minutosDeFecha, rutaDe, type CampoAgrupacion } from '../../utils/p6/vistaEjecucion';
import type { Actividad } from '../../types';
import { guardarLineaBase, leerLineaBase, lineaBaseDeTexto, lineaBaseDeXer, lineaBasePlanificada, lineaBaseUdf, type LineaBase } from '../../utils/p6/lineaBase';
import { crearModelo, entradasCpm, lagSsDesdeInicioTemprano, type ModeloP6 } from '../../utils/p6/modelo';
import { holguraRelacion, type TipoRel } from '../../utils/p6/cpm';
import { aMinutos, aTexto } from '../../utils/p6/calendario';
import { programarYEscribir, editarActividad, agregarRelacion, editarRelacion, eliminarRelacion, ponerFechaDatos, crearActividad, eliminarActividad, crearWbs, editarWbs, eliminarWbs, moverWbs, subarbolWbs, udfsDeActividad, ponerUdf, cargarUnidadesMaster, type Cambio, type EdicionActividad } from '../../utils/p6/edicion';
import { guardarXerEnNube, leerXerDeNube, type MetaXer } from '../../utils/p6/xerNube';
import { calcularUso, compacto, faseDe, periodosDeEscala, sumarTramo, type FaseUso, type LineaBaseFilas, type MedidaUso, type SerieUso } from '../../utils/p6/uso';
import { DialogoNivelacion } from './nivelacionP6';
import { MenuVistas, type AjustesVista } from './vistasP6';
import { DialogoCuadrillas, useMatrizPersonal } from './cuadrillasP6';
import { estimarCuadrillas, POR_DEFECTO } from '../../utils/p6/cuadrillas';
import { CUADRILLA_DISCIPLINA, FACTOR_LOCAL, esPrecomEq, rendimientoDe, type Disciplina } from '../../utils/p6/rendimientos';
import { aplicarNivelacion } from '../../utils/p6/nivelacion';
import { COLUMNAS_DEF, DialogoColumnas, NOMBRE_ESTADO, NOMBRE_RESTR, NOMBRE_TIPO, catalogoColumnas, valoresUdf, type ColumnaP6 } from './columnasP6';

const FILA = 22;
const ANCHO_IZQ = 870;
const MESES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FILTROS_ESTADO = [
  ['todas', 'All Activities'],
  ['noiniciadas', 'Not Started'],
  ['encurso', 'In Progress'],
  ['terminadas', 'Completed'],
  ['pendientes', 'In Progress + Not Started'],
  ['soloMaster', 'Master Only (not yet in T₃)'],
] as const;
/** Nombre de cada filtro (incluidos Critical y Longest Path, que van en sus botones de la barra lateral). */
const NOMBRE_FILTRO: Record<string, string> = { ...Object.fromEntries(FILTROS_ESTADO), criticas: 'Critical (Total Float ≤ 0)', longest: 'Longest Path' };
const TIPOS_UDF: Record<string, string> = {
  FT_TEXT: 'Text', FT_START_DATE: 'Start Date', FT_END_DATE: 'Finish Date', FT_FLOAT_2_DECIMALS: 'Number',
  FT_INT: 'Integer', FT_MONEY: 'Cost', FT_STATICTYPE: 'Indicator',
};
const INDICADORES_UDF: Record<string, string> = { UDF_G0: 'Indicator 0 (UDF_G0)', UDF_G1: 'Indicator 1 (UDF_G1)', UDF_G2: 'Indicator 2 (UDF_G2)', UDF_G3: 'Indicator 3 (UDF_G3)', UDF_G4: 'Indicator 4 (UDF_G4)' };
const ESTADO_TXT: Record<string, string> = { TK_NotStart: 'Not Started', TK_Active: 'In Progress', TK_Complete: 'Completed' };
const RESTRICCIONES: [string, string][] = [
  ['', '<None>'],
  ['CS_MSOA', 'Start On or After'],
  ['CS_MSO', 'Start On'],
  ['CS_MEO', 'Finish On'],
  ['CS_MEOB', 'Finish On or Before'],
  ['CS_ALAP', 'As Late As Possible'],
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
/** Condición de filtro sobre un campo de usuario de actividades. */
interface FiltroUdf { campo: string; op: 'igual' | 'distinto' | 'contiene' | 'vacio'; valor: string }
const OPS_UDF: [FiltroUdf['op'], string][] = [['igual', 'equals'], ['distinto', 'is not'], ['contiene', 'contains'], ['vacio', 'is empty']];

/** Opciones de Group & Sort. */
interface OpcionesGrupo {
  /** Oculta las bandas sin actividades (Hide if empty). */
  ocultarVacios: boolean;
  /** Fechas, variación y críticas en las bandas (Show Group Totals). */
  totales: boolean;
  /** Mostrar código e/o nombre en las bandas. */
  codigo: boolean;
  nombre: boolean;
  /** Ordenar las bandas alfabéticamente (vista WBS). */
  alfabetico: boolean;
}
const OPC_GRUPO_DEF: OpcionesGrupo = { ocultarVacios: true, totales: true, codigo: true, nombre: true, alfabetico: false };
/** Colores [fondo, texto] por nivel de banda, uno para cada vista. */
interface Paletas { wbs: [string, string][]; constr: [string, string][] }
const PALETAS_DEF: Paletas = { wbs: BANDAS_WBS_DEF(), constr: [['#FFE14D', '#14212A'], ...BANDAS_WBS_DEF().slice(1)] };
function BANDAS_WBS_DEF(): [string, string][] {
  return [['#1F7CC4', '#FFFFFF'], ['#7CF27C', '#14212A'], ['#FFFF66', '#14212A'], ['#2B2BD9', '#FFFFFF'], ['#9FE7FF', '#14212A'], ['#FFB8E1', '#14212A'], ['#D9C8FF', '#14212A'], ['#FFD8A8', '#14212A']];
}
/** ¿Fondo oscuro? (para elegir tonos legibles sobre la banda) */
const esOscuro = (hex: string) => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(k => parseInt(h.slice(k, k + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.5;
};

/** Nodo superior (el proyecto) de la vista constructiva. */
const RAIZ_CONSTRUCTIVA = 'g:__proyecto';
const bandaWbs = (nivel: number) => (nivel < BANDAS_WBS.length ? BANDAS_WBS[nivel] : BANDAS_WBS[4 + ((nivel - 4) % 3)]);

const esHitoFinTipo = (tipo: string) => tipo === 'TT_FinMile';
const fCorta = (t: number | null | undefined) => {
  if (t == null || !isFinite(t)) return '';
  const d = new Date(t * 60000);
  return `${String(d.getUTCDate()).padStart(2, '0')}-${MESES[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(2)}`;
};
const dias = (h: number, hd: number) => (Math.round((h / hd) * 10) / 10).toLocaleString('en-US');
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
  /** Vista de ejecución: grupo copiado de la WBS de P6 (hitos del proyecto); va siempre primero. */
  fijo?: boolean;
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
  // Filtros por campos de usuario (User Defined): condiciones que se combinan con AND
  const [filtrosUdf, setFiltrosUdf] = React.useState<FiltroUdf[]>([]);
  const [filtroEstado, setFiltroEstado] = React.useState<'todas' | 'pendientes' | 'noiniciadas' | 'terminadas' | 'criticas' | 'longest' | 'encurso' | 'soloMaster'>('todas');
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
  const [menuLB, setMenuLB] = React.useState(false);
  const [menuFiltro, setMenuFiltro] = React.useState(false);
  React.useEffect(() => { leerLineaBase().then(lb => setLbGuardada(lb)); }, []);
  // Agrupación: WBS de P6 o vista de ejecución (clasificación del Master)
  const leerLS = <T,>(k: string, def: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : def; } catch { return def; } };
  const [agrupacion, setAgrupacion] = React.useState<'wbs' | 'ejecucion'>(() => leerLS('p6.agrupacion', 'wbs'));
  const [niveles, setNiveles] = React.useState<CampoAgrupacion[]>(() => leerLS('p6.niveles', NIVELES_POR_DEFECTO));
  // Group & Sort (como en P6): opciones de presentación de las bandas y colores por nivel
  const [opcGrupo, setOpcGrupo] = React.useState<OpcionesGrupo>(() => ({ ...OPC_GRUPO_DEF, ...leerLS<Partial<OpcionesGrupo>>('p6.grupo', {}) }));
  const [paletas, setPaletas] = React.useState<Paletas>(() => ({ ...PALETAS_DEF, ...leerLS<Partial<Paletas>>('p6.paletas', {}) }));
  React.useEffect(() => { try { localStorage.setItem('p6.grupo', JSON.stringify(opcGrupo)); localStorage.setItem('p6.paletas', JSON.stringify(paletas)); } catch { /* sin almacenamiento */ } }, [opcGrupo, paletas]);
  const [verGrupo, setVerGrupo] = React.useState(false);
  // Columnas de la tabla (como «Columns» de P6)
  const [columnasSel, setColumnasSel] = React.useState<string[]>(() => leerLS('p6.columnas', COLUMNAS_DEF));
  React.useEffect(() => { try { localStorage.setItem('p6.columnas', JSON.stringify(columnasSel)); } catch { /* sin almacenamiento */ } }, [columnasSel]);
  const [verColumnas, setVerColumnas] = React.useState(false);
  const [verNivel, setVerNivel] = React.useState(false);
  const [verUso, setVerUso] = React.useState(true); // el panel Activity Usage se abre por defecto
  // Layouts guardados por el usuario (vistasP6): la predeterminada se aplica una vez al abrir T₃
  const inicioVistas = React.useRef<{ aplicada: boolean; activa: string | null }>({ aplicada: false, activa: null });
  const usoRef = React.useRef<HTMLDivElement | null>(null);
  const [ambito, setAmbito] = React.useState<Ambito>(() => leerLS('p6.ambito', 'todo'));
  React.useEffect(() => { try { localStorage.setItem('p6.ambito', JSON.stringify(ambito)); } catch { /* sin almacenamiento */ } }, [ambito]);
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
  const catalogo = React.useMemo(() => catalogoColumnas(m),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m, estadoCarga]);
  const cols: ColumnaP6[] = React.useMemo(() => {
    const porId = new Map(catalogo.map(c => [c.id, c]));
    const v = columnasSel.map(id => porId.get(id)).filter((c): c is ColumnaP6 => !!c);
    return v.length ? v : COLUMNAS_DEF.map(id => porId.get(id)!).filter(Boolean);
  }, [catalogo, columnasSel]);
  // Ancho de la parte de tabla (sustituye al ancho fijo)
  const ANCHO_IZQ = cols.reduce((a, c) => a + c.ancho, 0) + 2;
  // Unidades de las asignaciones de recursos por actividad (Budgeted / Actual / Remaining)
  const unidadesRsrc = React.useMemo(() => {
    const out = new Map<string, { b: number; a: number; r: number }>();
    const tr = m?.xer.tablas.get('TASKRSRC');
    if (!tr || !cols.some(c => c.id.startsWith('q'))) return out;
    for (const f of tr.filas) {
      const id = celda(tr, f, 'task_id');
      const x = out.get(id) ?? { b: 0, a: 0, r: 0 };
      x.b += Number(celda(tr, f, 'target_qty')) || 0;
      x.a += (Number(celda(tr, f, 'act_reg_qty')) || 0) + (Number(celda(tr, f, 'act_ot_qty')) || 0);
      x.r += Number(celda(tr, f, 'remain_qty')) || 0;
      out.set(id, x);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, cols, version]);
  const udfVals = React.useMemo(() => valoresUdf(m, cols.map(c => c.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m, cols, version]);

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
    // Rubros del Master que aún no están en T₃: al WBS más profundo que coincida con su código de WBS
    // (el del Master sin su prefijo de proyecto, con el del XER delante). Se ven con el filtro «Master Only».
    if (idxMaster.size) {
      const porCodigo = new Map<string, Nodo>();
      const completar = (n: Nodo, padre?: Nodo) => { const c = padre ? `${padre.codCompleto}.${n.cod}` : n.cod; n.codCompleto = c; porCodigo.set(c, n); n.hijos.forEach(h => completar(h, n)); };
      raices.forEach(r => completar(r));
      const raizCod = raices[0]?.codCompleto ?? '';
      const codigos = new Set(vts.map(v => v.cod));
      for (const [id, a] of idxMaster) {
        if (codigos.has(id)) continue;
        const segs = String(a.wbs || a.wbsRaw || '').split('.').slice(1);
        let destino: Nodo | undefined;
        for (let k = segs.length; k >= 0 && !destino; k--) destino = porCodigo.get([raizCod, ...segs.slice(0, k)].join('.'));
        if (destino) (destino.soloMaster ??= []).push(a);
      }
    }
    raices.forEach(r => resumirNodo(r, 0, undefined, true));
    return { raices, nodos };
  }, [m, vts, idxMaster]);

  // Clasificación que trae el propio XER en sus campos de usuario (se actualiza al editarlos)
  const clasifXer = React.useMemo(() => (m ? clasificacionXer(m.xer) : new Map()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m, version]);
  // Campo de clasificación de una actividad (XER y, si no, Master), para el panel de uso
  const campoActividad = React.useCallback((i: number, k: CampoAgrupacion) => {
    const c = m ? celda(m.task, m.task.filas[i], 'task_code') : '';
    return valorCampo(idxMaster.get(c), k, clasifXer.get(c));
  }, [m, idxMaster, clasifXer]);

  // Vista de ejecución: misma programación, agrupada con la clasificación del XER/Master
  const arbolEjec = React.useMemo(() => {
    const nodos = new Map<string, Nodo>();
    const raices: Nodo[] = [];
    if (!m || !hayMaster) return { raices, nodos, enMaster: 0, sinMaster: 0, soloMaster: 0, excluidas: 0, grupoDeAct: new Map<number, string>(), hitosUbicados: 0 };
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
    // Hitos del proyecto (WBS «.A» Eventos clave y «.B» Hitos contractuales, con sus sub-WBS):
    // en la vista de ejecución se muestran con la misma jerarquía que en la WBS de P6, al principio.
    const wbsEspejo = new Set<string>();
    for (const raiz of arbolWbs.raices) {
      for (const h of raiz.hijos.filter(x => ['A', 'B'].includes(x.cod.toUpperCase()))) {
        const pila = [h];
        while (pila.length) { const x = pila.pop()!; wbsEspejo.add(x.id); pila.push(...x.hijos); }
      }
    }
    const nodoEspejo = (wbsId: string): Nodo => {
      const id = `w:${wbsId}`;
      const ya = nodos.get(id);
      if (ya) return ya;
      const w = arbolWbs.nodos.get(wbsId)!;
      const padre = wbsEspejo.has(w.padre) ? nodoEspejo(w.padre) : undefined;
      const n: Nodo = { id, padre: padre?.id ?? '', cod: w.cod, codCompleto: w.codCompleto, nombre: w.nombre, seq: w.seq, hijos: [], tareas: [], nivel: 0, ini: null, fin: null, n: 0, criticas: 0, fijo: true };
      nodos.set(id, n);
      if (padre) padre.hijos.push(n); else raices.push(n);
      return n;
    };
    // Primer nivel bajo el proyecto: la ubicación (02.Ubicacion) → PTAR Merinos, EBAR Progreso, Guayacanes
    const nivelesSinUbic = niveles.filter(k => k !== 'ubicacion');
    const rutaConstructiva = (a: Actividad, udf?: Clasificacion) => [etiquetaUbicacion(valorCampo(a, 'ubicacion', udf)), ...rutaDe(a, nivelesSinUbic, udf)];
    const nodoDe = (ruta: string[]): Nodo => {
      let padre: Nodo | undefined;
      for (let j = 0; j < ruta.length; j++) {
        const id = `g:${ruta.slice(0, j + 1).join('\u241f')}`;
        let n = nodos.get(id);
        if (!n) {
          n = { id, padre: padre?.id ?? '', cod: '', codCompleto: '', nombre: ruta[j], seq: j === 0 ? ordenUbicacion(ruta[0]) : 0, hijos: [], tareas: [], nivel: j, ini: null, fin: null, n: 0, criticas: 0 };
          nodos.set(id, n);
          if (padre) padre.hijos.push(n); else raices.push(n);
        }
        padre = n;
      }
      return padre!;
    };
    let enMaster = 0, sinMaster = 0;
    const codigos = new Set<string>();
    const grupoDeAct = new Map<number, string>();
    const hitosSinMaster: Vt[] = [];
    for (const v of vts) {
      codigos.add(v.cod);
      if (wbsExcluidos.has(v.wbs)) { excluidas++; continue; }
      if (ocultoEnEjecucion(v.cod)) continue;
      if (wbsEspejo.has(v.wbs)) { if (ambito === 'aereas') continue; const n = nodoEspejo(v.wbs); n.tareas.push(v); grupoDeAct.set(v.i, n.id); continue; }
      const a = idxMaster.get(v.cod);
      const udf = clasifXer.get(v.cod);
      // Las actividades del XER sin datos en el Master no tienen grupo propio; los hitos se ubican abajo
      if (!a) { sinMaster++; if (v.tipo === 'TT_Mile' || v.tipo === 'TT_FinMile') hitosSinMaster.push(v); continue; }
      if (!enAmbito(a, ambito, udf)) continue;
      enMaster++;
      const nodo = nodoDe(rutaConstructiva(a, udf));
      nodo.tareas.push(v);
      grupoDeAct.set(v.i, nodo.id);
    }
    // Hitos sin datos en el Master: se muestran en el grupo de las actividades con que se relacionan.
    // 1) Su ámbito (construcción / equipamiento) se decide con TODO el proyecto, no solo con lo visible:
    //    por el nombre del hito y, si no lo dice, por la mayoría de sus relacionadas.
    // 2) Si no es del ámbito elegido, no se muestra; si lo es, va al grupo más repetido entre sus
    //    relacionadas de ese mismo ámbito. Se repite para cadenas de hitos (hito → hito → actividad).
    let hitosUbicados = 0;
    if (hitosSinMaster.length) {
      const suc = new Map<number, number[]>(), pre = new Map<number, number[]>();
      for (const fr of m.pred.filas) {
        const s0 = m.porId.get(celda(m.pred, fr, 'task_id')), p0 = m.porId.get(celda(m.pred, fr, 'pred_task_id'));
        if (s0 === undefined || p0 === undefined) continue;
        (suc.get(p0) ?? suc.set(p0, []).get(p0)!).push(s0);
        (pre.get(s0) ?? pre.set(s0, []).get(s0)!).push(p0);
      }
      // Ámbito de cada actividad con datos (true = construcción), sin importar el ámbito elegido
      const esConstr = new Map<number, boolean>();
      for (const v of vts) {
        const a = idxMaster.get(v.cod);
        if (a) esConstr.set(v.i, esConstruccion(valorCampo(a, 'grupo', clasifXer.get(v.cod))));
      }
      const ambitoPorNombre = (nombre: string): boolean | undefined =>
        RE_HITO_EQUIPAMIENTO.test(nombre) ? false : RE_HITO_CONSTRUCCION.test(nombre) ? true : undefined;
      const mayoria = (vecinas: number[] | undefined): boolean | undefined => {
        let c = 0, e = 0;
        for (const j of vecinas ?? []) { const x = esConstr.get(j); if (x === true) c++; else if (x === false) e++; }
        return c + e === 0 ? undefined : c >= e;
      };
      // El grupo más repetido entre las vecinas ya ubicadas del mismo ámbito
      const grupoMasComun = (vecinas: number[] | undefined, constr: boolean | null) => {
        const cuenta = new Map<string, number>();
        // (los grupos copiados de la WBS de hitos no reciben otros hitos)
        for (const j of vecinas ?? []) {
          const g = grupoDeAct.get(j);
          if (g && !g.startsWith('w:') && (constr === null || esConstr.get(j) === constr)) cuenta.set(g, (cuenta.get(g) ?? 0) + 1);
        }
        let mejor: string | undefined, n = 0;
        for (const [g, c] of cuenta) if (c > n) { mejor = g; n = c; }
        return mejor;
      };
      let pendientes = hitosSinMaster;
      for (let vuelta = 0; vuelta < 8 && pendientes.length; vuelta++) {
        const quedan: Vt[] = [];
        for (const v of pendientes) {
          // Hito de inicio → con lo que arranca (sucesoras); hito de fin → con lo que cierra (predecesoras)
          const [prim, seg] = v.tipo === 'TT_FinMile' ? [pre.get(v.i), suc.get(v.i)] : [suc.get(v.i), pre.get(v.i)];
          let constr = esConstr.get(v.i);
          if (constr === undefined) constr = ambitoPorNombre(v.nombre) ?? mayoria(prim) ?? mayoria(seg);
          if (constr === undefined) { quedan.push(v); continue; }
          esConstr.set(v.i, constr);
          if (ambito === 'aereas') continue; // Obras Aéreas: solo sus SCAP, sin hitos sueltos
          if (ambito !== 'todo' && constr !== (ambito === 'construccion')) continue; // de otro ámbito: no se muestra
          // En la vista combinada, si no hay relacionadas de su ámbito, va con cualquiera de ellas
          const g = grupoMasComun(prim, constr) ?? grupoMasComun(seg, constr)
            ?? (ambito === 'todo' && vuelta >= 2 ? grupoMasComun(prim, null) ?? grupoMasComun(seg, null) : undefined);
          if (g) { grupoDeAct.set(v.i, g); nodos.get(g)!.tareas.push(v); hitosUbicados++; } else quedan.push(v);
        }
        if (quedan.length === pendientes.length) break;
        pendientes = quedan;
      }
    }
    let soloMaster = 0;
    for (const [id, a] of idxMaster) {
      if (codigos.has(id) || ocultoEnEjecucion(id) || !enAmbito(a, ambito)) continue;
      soloMaster++;
      const n = nodoDe(rutaConstructiva(a));
      (n.soloMaster ??= []).push(a);
    }
    const natural = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true });
    const orden = (a: Nodo, b: Nodo) => (a.fijo || b.fijo ? (a.fijo && b.fijo ? a.seq - b.seq || natural(a.cod, b.cod) : a.fijo ? -1 : 1)
      : a.nombre === SIN_MASTER ? 1 : b.nombre === SIN_MASTER ? -1 : (a.seq - b.seq) || natural(a.nombre, b.nombre));
    // Nivel superior: el proyecto (p. ej. «PTAR Merinos & EB Progreso»), con los totales de todo
    const raiz: Nodo = { id: RAIZ_CONSTRUCTIVA, padre: '', cod: '', codCompleto: '', nombre: arbolWbs.raices[0]?.nombre || 'Project', seq: 0, hijos: raices, tareas: [], nivel: 0, ini: null, fin: null, n: 0, criticas: 0 };
    raices.forEach(h => { h.padre = RAIZ_CONSTRUCTIVA; });
    nodos.set(RAIZ_CONSTRUCTIVA, raiz);
    resumirNodo(raiz, 0, undefined, false, orden);
    return { raices: [raiz], nodos, enMaster, sinMaster, soloMaster, excluidas, grupoDeAct, hitosUbicados };
  }, [m, vts, idxMaster, hayMaster, niveles, arbolWbs, ambito, clasifXer]);

  const enEjecucion = agrupacion === 'ejecucion' && hayMaster;
  /** Sangría del Activity ID: mínima en todas las vistas (los niveles ya los marcan las bandas) para ver el código entero. */
  const sangriaId = (_nivel: number) => 4;
  /** Sangría de la etiqueta de una banda (WBS o grupo): poca por nivel, para que el nombre se lea entero. */
  const sangriaBanda = (nivel: number) => 4 + nivel * 4;
  // Al entrar en la vista constructiva, el proyecto (nivel superior) se ve abierto
  React.useEffect(() => { if (enEjecucion) setAbiertos(prev => (prev.has(RAIZ_CONSTRUCTIVA) ? prev : new Set([...prev, RAIZ_CONSTRUCTIVA]))); }, [enEjecucion]);
  const arbol: { raices: Nodo[]; nodos: Map<string, Nodo> } = enEjecucion ? arbolEjec : arbolWbs;

  const condUdf = React.useMemo(() => filtrosUdf.filter(f => f.campo && (f.op === 'vacio' || f.valor.trim())), [filtrosUdf]);
  const hayFiltroUdf = condUdf.length > 0;
  const camposFiltroUdf = filtrosUdf.map(f => f.campo).filter(Boolean).join('|');
  const udfFiltroVals = React.useMemo(() => valoresUdf(m, camposFiltroUdf ? camposFiltroUdf.split('|').map(c => `udf:${c}`) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m, camposFiltroUdf, version]);
  const pasaUdf = React.useCallback((v: Vt) => condUdf.every(f => {
    const val = (udfFiltroVals.get(f.campo)?.get(v.id) ?? '').trim().toLowerCase();
    const q = f.valor.trim().toLowerCase();
    switch (f.op) {
      case 'igual': return val === q || (/^\d{4}-\d{2}-\d{2}/.test(val) && val.startsWith(q));
      case 'distinto': return val !== q;
      case 'contiene': return val.includes(q);
      case 'vacio': return val === '' || val === '0';
    }
    return true;
  }), [condUdf, udfFiltroVals]);
  const pasa = React.useCallback((v: Vt) => {
    if (hayFiltroUdf && !pasaUdf(v)) return false;
    if (filtroEstado === 'pendientes' && v.estado === 'TK_Complete') return false;
    if (filtroEstado === 'encurso' && v.estado !== 'TK_Active') return false;
    if (filtroEstado === 'noiniciadas' && v.estado !== 'TK_NotStart') return false;
    if (filtroEstado === 'terminadas' && v.estado !== 'TK_Complete') return false;
    if (filtroEstado === 'criticas' && !(v.tf != null && v.tf <= 0)) return false;
    if (filtroEstado === 'longest' && !v.lp) return false;
    if (filtroEstado === 'soloMaster') return false; // solo los rubros del Master que aún no están en P6
    if (filtro) {
      const q = filtro.toLowerCase();
      if (!v.cod.toLowerCase().includes(q) && !v.nombre.toLowerCase().includes(q)) return false;
    }
    return true;
  }, [filtro, filtroEstado, hayFiltroUdf, pasaUdf]);

  const filas = React.useMemo<Fila[]>(() => {
    const out: Fila[] = [];
    // En la vista de ejecución el orden por fecha se aplica también a los grupos de todos los niveles
    // (por el inicio o fin de cada grupo); en la WBS de P6 los WBS conservan su orden.
    const natural = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true });
    const ordenarGrupos = (lista: Nodo[]) => (!orden || !enEjecucion ? (!enEjecucion && opcGrupo.alfabetico
      ? [...lista].sort((a, b) => natural(opcGrupo.codigo ? a.codCompleto : a.nombre, opcGrupo.codigo ? b.codCompleto : b.nombre))
      : lista) : [...lista].sort((a, b) => {
      if (a.fijo || b.fijo) return a.fijo && b.fijo ? 0 : a.fijo ? -1 : 1; // los hitos del proyecto, siempre arriba
      if (a.nombre === SIN_MASTER || b.nombre === SIN_MASTER) return a.nombre === SIN_MASTER ? 1 : -1;
      const x = a[orden.col], y = b[orden.col];
      if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
      return (x - y) * orden.dir || a.nombre.localeCompare(b.nombre, 'es', { numeric: true });
    }));
    const filtrando = !!filtro || filtroEstado !== 'todas' || hayFiltroUdf;
    const contiene = new Map<string, boolean>();
    const tiene = (n: Nodo): boolean => {
      if (contiene.has(n.id)) return contiene.get(n.id)!;
      const q = filtro.toLowerCase();
      const r = n.tareas.some(pasa) || n.hijos.some(tiene)
        || (!hayFiltroUdf && (enEjecucion || filtroEstado === 'soloMaster') && !!n.soloMaster?.some(a => String(a.activityId).toLowerCase().includes(q) || a.descripcion.toLowerCase().includes(q)));
      contiene.set(n.id, r);
      return r;
    };
    const recorrer = (n: Nodo) => {
      if (filtrando && !tiene(n)) return;
      // Hide if empty: bandas sin actividades (ni rubros solo del Master)
      if (opcGrupo.ocultarVacios && !filtrando && n.n === 0 && (!n.nSolo || !enEjecucion) && n.nivel > 0) return;
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
      if (n.soloMaster && !hayFiltroUdf && (enEjecucion || filtroEstado === 'soloMaster')) {
        const q = filtro.toLowerCase();
        const fechaM = (a: Actividad) => minutosDeFecha(orden?.col === 'fin' ? a.finish ?? a.blFinish : a.start ?? a.blStart);
        const solo = orden ? [...n.soloMaster].sort((a, b) => {
          const x = fechaM(a), y = fechaM(b);
          if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
          return (x - y) * orden.dir;
        }) : n.soloMaster;
        for (const a of solo) if (!q || String(a.activityId).toLowerCase().includes(q) || a.descripcion.toLowerCase().includes(q)) out.push({ tipo: 'master', a, nivel: n.nivel + 1 });
      }
      ordenarGrupos(n.hijos).forEach(recorrer);
    };
    ordenarGrupos(arbol.raices).forEach(recorrer);
    return out;
  }, [arbol, abiertos, cerradosF, filtro, filtroEstado, pasa, orden, enEjecucion, opcGrupo]);

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
    mostrar(`Scheduled in ${Math.round(performance.now() - t0)} ms · project finish ${fCorta(r.finTemprano)} · ${r.criticas.toLocaleString('en-US')} critical activities · ${r.rutaLarga.toLocaleString('en-US')} on the longest path${r.ciclos.length ? ` · ${r.ciclos.length} in logic loops` : ''}`);
  }, [editable]);

  React.useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'F9') { e.preventDefault(); programar(); } };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [programar]);

  // Contenido de cada celda de una actividad según su columna
  const celdaAct = (c: ColumnaP6, v: Vt, nivel: number, critica: boolean, lbDatos: [number | null, number | null] | null, varFin: number | null): React.ReactNode => {
    const t = m!.task, f = t.filas[v.i];
    const g = (k: string) => celda(t, f, k);
    const fecha = (k: string) => fCorta(aMinutos(g(k)));
    const num = (k: string) => (g(k) === '' ? '' : (Number(g(k)) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }));
    let txt: React.ReactNode = '';
    let clase = '';
    let title: string | undefined;
    switch (c.id) {
      case 'id': return <div key={c.id} className="px-2 font-mono text-[10px] truncate shrink-0" style={{ width: c.ancho, paddingLeft: sangriaId(nivel) }} title={v.cod}>{v.cod}</div>;
      case 'nombre': txt = v.nombre; title = v.nombre; break;
      case 'tipo': txt = NOMBRE_TIPO[v.tipo] ?? v.tipo; break;
      case 'estado': txt = NOMBRE_ESTADO[v.estado] ?? v.estado; break;
      case 'calendario': txt = m!.calendarios.get(g('clndr_id'))?.nombre ?? ''; break;
      case 'wbs': txt = arbolWbs.nodos.get(v.wbs)?.codCompleto ?? ''; break;
      case 'wbsNombre': txt = arbolWbs.nodos.get(v.wbs)?.nombre ?? ''; title = String(txt); break;
      case 'restr': txt = v.cstr ? NOMBRE_RESTR[v.cstr] ?? v.cstr : ''; break;
      case 'restrFecha': txt = fecha('cstr_date'); break;
      case 'lp': txt = v.lp ? 'Yes' : ''; clase = v.lp ? 'text-red-600 font-semibold' : ''; break;
      case 'critica': txt = v.tf != null && v.tf <= 0 ? 'Yes' : ''; clase = 'text-red-600'; break;
      case 'ini': txt = <>{fCorta(v.ini)}{v.iniA ? ' A' : ''}</>; break;
      case 'fin': txt = <>{fCorta(v.fin)}{v.finA ? ' A' : ''}</>; break;
      case 'es': txt = fecha('early_start_date'); break;
      case 'ef': txt = fecha('early_end_date'); break;
      case 'ls': txt = fecha('late_start_date'); break;
      case 'lf': txt = fecha('late_end_date'); break;
      case 'as': txt = fecha('act_start_date'); break;
      case 'af': txt = fecha('act_end_date'); break;
      case 'ps': txt = fecha('target_start_date'); break;
      case 'pf': txt = fecha('target_end_date'); break;
      case 'bls': txt = fCorta(lbDatos?.[0]); break;
      case 'blf': txt = fCorta(lbDatos?.[1]); break;
      case 'expf': txt = fecha('expect_end_date'); break;
      case 'durO': txt = dias(v.durO, v.hd); break;
      case 'durR': txt = dias(v.durR, v.hd); break;
      case 'durA': {
        const ini = aMinutos(g('act_start_date')), fin = aMinutos(g('act_end_date'));
        const cal = m!.calendarios.get(g('clndr_id'));
        txt = ini != null && cal ? dias(cal.entre(ini, v.estado === 'TK_Complete' && fin != null ? fin : Math.max(ini, m!.fechaDatos)) / 60, v.hd) : '';
        break;
      }
      case 'durC': {
        const ini = aMinutos(g('act_start_date'));
        const cal = m!.calendarios.get(g('clndr_id'));
        const real = ini != null && cal ? cal.entre(ini, v.estado === 'TK_Complete' ? aMinutos(g('act_end_date')) ?? ini : Math.max(ini, m!.fechaDatos)) / 60 : 0;
        txt = dias(real + (v.estado === 'TK_Complete' ? 0 : v.durR), v.hd);
        break;
      }
      case 'tf': txt = v.tf == null ? '' : dias(v.tf, v.hd); clase = critica ? 'text-red-600 font-semibold' : ''; break;
      case 'ff': txt = v.ff == null ? '' : dias(v.ff, v.hd); break;
      case 'avance': txt = v.avance ? `${Math.round(v.avance * 10) / 10}%` : ''; break;
      case 'varFin': txt = varFin == null ? '' : dias(varFin, v.hd); clase = varFin != null && varFin < 0 ? 'text-red-600' : varFin ? 'text-[#2B7F52]' : ''; title = lbDatos ? `Baseline ${fCorta(lbDatos[0])} → ${fCorta(lbDatos[1])}` : 'No baseline'; break;
      case 'varIni': { const vi = variacionFin(lbDatos?.[0], v.ini); txt = vi == null ? '' : dias(vi, v.hd); clase = vi != null && vi < 0 ? 'text-red-600' : vi ? 'text-[#2B7F52]' : ''; break; }
      case 'qBud': case 'qAct': case 'qRem': case 'qAtC': {
        const u = unidadesRsrc.get(v.id);
        const val = !u ? null : c.id === 'qBud' ? u.b : c.id === 'qAct' ? u.a : c.id === 'qRem' ? u.r : u.a + u.r;
        txt = val == null ? '' : val.toLocaleString('en-US', { maximumFractionDigits: 2 });
        break;
      }
      case 'uP': txt = num('target_work_qty'); break;
      case 'uA': txt = num('act_work_qty'); break;
      case 'uR': txt = num('remain_work_qty'); break;
      default:
        if (c.id.startsWith('udf:')) {
          const val = udfVals.get(c.id.slice(4))?.get(v.id) ?? '';
          txt = /^\d{4}-\d{2}-\d{2}/.test(val) ? fCorta(aMinutos(val)) : val && c.der ? (Number(val) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }) : val;
          title = val;
        }
    }
    return <div key={c.id} className={`px-1 truncate shrink-0 ${c.der ? 'text-right' : ''} ${clase}`} style={{ width: c.ancho }} title={title}>{txt}</div>;
  };

  const proyecto = m ? celda(m.xer.tablas.get('PROJECT')!, m.xer.tablas.get('PROJECT')!.filas[0], 'proj_short_name') : '';

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
    setOcupado('Saving to the cloud…');
    try {
      const nueva = await guardarXerEnNube(escribirXer(m.xer), {
        nombre: nombreArchivo || `${proyecto}.xer`,
        proyecto,
        fechaDatos: aTexto(m.fechaDatos),
        actividades: m.task.filas.length,
        guardadoPor: username || 'admin',
        cambios: (meta?.cambios || 0) + cambios.length,
      }, pct => setOcupado(`Saving to the cloud… ${pct} %`));
      setMeta(nueva);
      setCambios([]);
      setSinGuardar(false);
      mostrar('Schedule saved to the cloud.');
    } catch (e: any) {
      mostrar(`Could not save: ${e?.message || e}`);
    } finally {
      setOcupado('');
    }
  };

  const cargarArchivo = async (file: File) => {
    setOcupado('Reading the XER…');
    try {
      const texto = decodificarXer(new Uint8Array(await file.arrayBuffer()));
      if (!texto.startsWith('ERMHDR')) throw new Error('The file does not look like a Trakciona T₃ XER.');
      setNombreArchivo(file.name);
      abrirTexto(texto);
      setSinGuardar(true);
      mostrar(`${file.name} opened. Click «Save» to publish it to the cloud.`);
    } catch (e: any) {
      mostrar(`Could not open: ${e?.message || e}`);
    } finally {
      setOcupado('');
    }
  };

  const cerrar = () => {
    if (sinGuardar && editable && !window.confirm('There are unsaved changes. Close anyway?')) return;
    onClose();
  };

  // ── Línea base: fijar con la programación actual o desde otro XER ──
  const guardarLB = async (lb: LineaBase, msg: string) => {
    if (lbGuardada && !window.confirm(`A baseline already exists («${lbGuardada.nombre}», ${new Date(lbGuardada.creadaEn).toLocaleDateString('en-US')}). Replace it?`)) return;
    setOcupado('Saving the baseline…');
    try {
      await guardarLineaBase(lb);
      setLbGuardada(lb);
      setFuenteLB('guardada');
      setVerLB(true);
      mostrar(msg);
    } catch (e) {
      mostrar(`Could not save the baseline: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setOcupado(''); }
  };
  const fijarLineaBase = () => {
    if (!m) return;
    if (pendienteF9 && !window.confirm('There are unscheduled changes (F9). Set the baseline with the current dates anyway?')) return;
    const nombre = `Schedule as of ${fCorta(m.fechaDatos)}`;
    void guardarLB(lineaBaseDeXer(m.xer, nombre, username || 'admin', 'programacion'), `Baseline set: ${nombre}.`);
  };
  const cargarLineaBase = async (file: File) => {
    if (!m) return;
    try {
      const lb = lineaBaseDeTexto(decodificarXer(new Uint8Array(await file.arrayBuffer())), file.name.replace(/\.xer$/i, ''), username || 'admin');
      const codigos = new Set(m.task.filas.map(f => celda(m.task, f, 'task_code')));
      const comunes = Object.keys(lb.act).filter(c => codigos.has(c)).length;
      if (!comunes) { mostrar('That XER has no activities with the same IDs as this schedule.'); return; }
      await guardarLB(lb, `Baseline loaded from ${file.name}: ${comunes.toLocaleString('en-US')} of ${codigos.size.toLocaleString('en-US')} activities with the same ID.`);
    } catch (e) {
      mostrar(`Could not read the baseline XER: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // Budgeted Units desde la cantidad del Master (enlazando por Activity ID; sin los «p6»)
  const cargarUnidades = () => {
    if (!m) return;
    const cantidad = new Map<string, number | null>();
    for (const [id, a] of idxMaster) cantidad.set(id, a.cantidadCdo ?? null);
    const prev = cargarUnidadesMaster(m, cantidad, false, []);
    if (!prev.cambian) { mostrar(`Budgeted Units already match the Master (${prev.iguales.toLocaleString('en-US')} activities). Nothing to load.`); return; }
    const est = (k: string) => (prev.porEstado[k] ?? 0).toLocaleString('en-US');
    if (!window.confirm(`Load Budgeted Units from the Master «Cantidad» column?\n\n`
      + `• ${prev.cambian.toLocaleString('en-US')} activities will change (Not Started ${est('TK_NotStart')} · In Progress ${est('TK_Active')} · Completed ${est('TK_Complete')})\n`
      + `• ${prev.iguales.toLocaleString('en-US')} already match\n`
      + `• ${prev.conP6.toLocaleString('en-US')} Activity IDs with «p6» are left out\n`
      + `• ${prev.sinMaster.toLocaleString('en-US')} not in the Master · ${prev.sinCantidad.toLocaleString('en-US')} without quantity · ${prev.sinAsignacion.toLocaleString('en-US')} without resource assignment\n\n`
      + `Not started activities also get Remaining Units = Budgeted Units. Actual units and costs are not changed.`)) return;
    const log = [...cambios];
    const res = cargarUnidadesMaster(m, cantidad, true, log);
    marcarCambio(log);
    mostrar(`Budgeted Units loaded from the Master in ${res.cambian.toLocaleString('en-US')} activities (${res.conP6.toLocaleString('en-US')} «p6» left out). Press «Save» to keep them.`);
  };

  // El botón Filter se resalta solo con los filtros de su menú (Critical y Longest tienen sus botones)
  const filtroMenuActivo = (filtroEstado !== 'todas' && filtroEstado !== 'criticas' && filtroEstado !== 'longest') || hayFiltroUdf;
  const filtrando = !!filtro || filtroEstado !== 'todas' || hayFiltroUdf;
  // Cada filtro nuevo empieza desplegado
  React.useEffect(() => { setCerradosF(new Set()); }, [filtro, filtroEstado, condUdf]);
  const alternarEn = (set: React.Dispatch<React.SetStateAction<Set<string>>>) => (id: string) =>
    set(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const alternar = (id: string) => (filtrando ? alternarEn(setCerradosF) : alternarEn(setAbiertos))(id);
  const expandirTodo = (abrir: boolean) => {
    if (filtrando) {
      const raices = new Set(arbol.raices.map(r => r.id));
      setCerradosF(abrir ? new Set() : new Set([...arbol.nodos.keys()].filter(id => !raices.has(id))));
    } else setAbiertos(abrir ? new Set(arbol.nodos.keys()) : new Set(arbol.raices.map(r => r.id)));
  };
  // Atajos: Ctrl + expande todo, Ctrl − colapsa todo (en la vista de actividades; reemplaza el zoom del navegador)
  const expandirRef = React.useRef(expandirTodo);
  expandirRef.current = expandirTodo;
  React.useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || vista !== 'actividades') return;
      const mas = e.key === '+' || e.key === '=' || e.code === 'NumpadAdd';
      const menos = e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract';
      if (!mas && !menos) return;
      e.preventDefault();
      expandirRef.current(mas);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [vista]);

  /** Despliega un WBS y sus padres (con y sin filtro). */
  const abrirRama = (id: string) => {
    const cadena: string[] = [];
    let w: string | undefined = id;
    while (w && arbolWbs.nodos.has(w)) { cadena.push(w); w = arbolWbs.nodos.get(w)!.padre; }
    setAbiertos(prev => new Set([...prev, ...cadena]));
    setCerradosF(prev => { const n = new Set(prev); cadena.forEach(c => n.delete(c)); return n; });
  };

  // «Ir a» una actividad (desde sus relaciones): la selecciona, abre su grupo y la deja a la vista.
  const [irPendiente, setIrPendiente] = React.useState<number | null>(null);
  const irAActividad = (i: number) => {
    const v = vts[i];
    if (!v) return;
    // Si el filtro la oculta, se quita el filtro
    if ((filtro || filtroEstado !== 'todas' || hayFiltroUdf) && !pasa(v)) {
      setFiltro(''); setFiltroTmp(''); setFiltroEstado('todas'); setFiltrosUdf([]);
      mostrar(`Filter cleared to show ${v.cod}.`);
    }
    let grupo: string | undefined = v.wbs;
    if (enEjecucion) {
      grupo = arbolEjec.grupoDeAct.get(i);
      if (!grupo) { setAgrupacion('wbs'); grupo = v.wbs; mostrar(`${v.cod} is not in the Construction view (no Master data, WBS «.D» or outside the scope): showing it in the T₃ WBS.`); }
    }
    const arb = enEjecucion && arbolEjec.grupoDeAct.has(i) ? arbolEjec : arbolWbs;
    const cadena: string[] = [];
    for (let w: string | undefined = grupo; w && arb.nodos.has(w); w = arb.nodos.get(w)!.padre) cadena.push(w);
    setAbiertos(prev => new Set([...prev, ...cadena]));
    setCerradosF(prev => { const n = new Set(prev); cadena.forEach(c => n.delete(c)); return n; });
    setSel(i);
    setIrPendiente(i);
  };

  // ── Filas visibles (virtualización) ──
  const desdeFila = Math.max(0, Math.floor(scrollTop / FILA) - 10);
  const hastaFila = Math.min(filas.length, Math.ceil((scrollTop + altoVista) / FILA) + 10);
  const xDatos = m ? xDe(m.fechaDatos) : 0;

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
  // Tras «Ir a», cuando ya está la fila, centrarla en la tabla
  React.useEffect(() => {
    if (irPendiente == null) return;
    const k = filaDeActividad.get(irPendiente);
    const sc = scroller.current;
    if (k === undefined || !sc) return;
    sc.scrollTop = Math.max(0, 34 + k * FILA - sc.clientHeight / 2);
    const v = vts[irPendiente];
    if (v) verFecha(v.resto ?? v.ini);
    setIrPendiente(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [irPendiente, filaDeActividad]);
  const enRojo = React.useCallback((v: Vt) => (filtroEstado === 'longest' ? v.lp && v.estado !== 'TK_Complete' : v.tf != null && v.tf <= 0), [filtroEstado]);
  // Resumen de cada WBS para su barra (solo las actividades que pasan el filtro)
  const resumenWbs = React.useMemo(() => {
    type R = { ini: number | null; fin: number | null; realIni: number | null; realFin: number | null; restIni: number | null; restFin: number | null; roja: boolean; lbIni: number | null; lbFin: number | null; qb: number; qa: number; qr: number; hayQ: boolean };
    const out = new Map<string, R>();
    if (!m) return out;
    const filtrandoR = !!filtro || filtroEstado !== 'todas' || hayFiltroUdf;
    const mn = (a: number | null, b: number | null) => (a == null ? b : b == null ? a : Math.min(a, b));
    const mx = (a: number | null, b: number | null) => (a == null ? b : b == null ? a : Math.max(a, b));
    const ver = (n: Nodo): R => {
      const r: R = { ini: null, fin: null, realIni: null, realFin: null, restIni: null, restFin: null, roja: false, lbIni: null, lbFin: null, qb: 0, qa: 0, qr: 0, hayQ: false };
      const juntar = (o: R) => {
        r.ini = mn(r.ini, o.ini); r.fin = mx(r.fin, o.fin);
        r.realIni = mn(r.realIni, o.realIni); r.realFin = mx(r.realFin, o.realFin);
        r.restIni = mn(r.restIni, o.restIni); r.restFin = mx(r.restFin, o.restFin);
        r.roja ||= o.roja;
        r.lbIni = mn(r.lbIni, o.lbIni); r.lbFin = mx(r.lbFin, o.lbFin);
        r.qb += o.qb; r.qa += o.qa; r.qr += o.qr; r.hayQ ||= o.hayQ;
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
        // Subtotales de unidades (asignaciones de recursos)
        const q = unidadesRsrc.get(v.id);
        if (q) { r.qb += q.b; r.qa += q.a; r.qr += q.r; r.hayQ = true; }
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
  }, [m, arbol, filtro, filtroEstado, pasa, enRojo, lbPorAct, unidadesRsrc]);
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
            <div className="text-sm font-bold leading-tight truncate">T<sub className="text-[0.75em]">3</sub> Schedule {proyecto && <span className="text-indigo-200 font-normal">· {proyecto}</span>}</div>
            <div className="text-[10.5px] text-indigo-200 truncate">
              {nombreArchivo || 'No file'}{meta && ` · saved ${new Date(meta.guardadoEn).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} by ${meta.guardadoPor}`}
            </div>
          </div>
        </div>
        {m && (
          <div className="flex items-center gap-1.5 text-[11px] bg-white/10 rounded-lg px-2 py-1">
            <Calendar className="w-3.5 h-3.5 text-indigo-200" />
            <span className="text-indigo-200">Data Date</span>
            <CampoFecha
              disabled={!editable}
              valor={aTexto(m.fechaDatos).slice(0, 10)}
              onConfirmar={v => {
                const log = [...cambios];
                ponerFechaDatos(m, `${v} ${aTexto(m.fechaDatos).slice(11) || '16:00'}`, log);
                marcarCambio(log);
              }}
              className="bg-transparent text-white text-[11px] outline-none [color-scheme:dark] disabled:opacity-80"
            />
          </div>
        )}
        {m && (
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <button onClick={() => { setVista('actividades'); setMenuFiltro(v => !v); }} title={`Status filter: ${NOMBRE_FILTRO[filtroEstado] ?? ''}${hayFiltroUdf ? ` · ${condUdf.length} User Defined condition${condUdf.length > 1 ? 's' : ''}` : ''}`}
                className={`px-1.5 pt-1 pb-0.5 rounded-lg flex flex-col items-center gap-0.5 cursor-pointer ${filtroMenuActivo ? 'bg-white text-[#1E1B4B]' : 'bg-white/15 hover:bg-white/25 text-white'}`}>
                <span className="bg-white rounded px-0.5 flex"><svg width="20" height="15" viewBox="0 0 22 16"><path d="M3 2 H19 L13 8.5 V14 L9 12.5 V8.5 Z" fill={filtroMenuActivo ? '#312E81' : '#9AA6AD'} stroke="#3A3A3A" strokeWidth="0.8" /></svg></span>
                <span className="text-[8.5px] leading-none">Filter</span>
              </button>
              {menuFiltro && (
                <>
                  <div className="fixed inset-0 z-[60]" onClick={() => setMenuFiltro(false)} />
                  <div className="absolute left-0 top-full mt-1.5 z-[61] w-[470px] bg-white border border-[#B5B5B5] rounded-lg shadow-xl text-[11.5px] text-[#14212A]">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-[#F0F0F0] border-b border-[#D5D5D5] rounded-t-lg">
                      <b>Status Filter</b>
                      <button onClick={() => setMenuFiltro(false)} className="p-0.5 hover:bg-white rounded cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="p-2 flex flex-col gap-0.5">
                      {FILTROS_ESTADO.map(([k, etq]) => (
                        <label key={k} className={`flex items-center gap-2 px-2 py-1.5 rounded border cursor-pointer ${filtroEstado === k ? 'border-[#8A8FC9] bg-[#EEF0FB] font-semibold' : 'border-transparent hover:bg-[#F5F8F9]'}`}>
                          <input type="radio" name="filtroEstado" checked={filtroEstado === k} onChange={() => setFiltroEstado(k)} />
                          {etq}
                        </label>
                      ))}
                    </div>
                    {/* Filtros por campos de usuario */}
                    <div className="border-t border-[#E2E2E2] p-2">
                      <div className="flex items-center gap-2 mb-1.5">
                        <b>User Defined</b>
                        <span className="text-[10.5px] text-[#5A6A74]">all conditions must be met (AND)</span>
                        {filtrosUdf.length > 0 && <button onClick={() => setFiltrosUdf([])} className="ml-auto text-[#312E81] underline cursor-pointer">Clear</button>}
                      </div>
                      {filtrosUdf.map((f, k) => {
                        const vals = udfFiltroVals.get(f.campo);
                        const distintos = vals ? [...[...vals.values()].reduce((mm, x) => mm.set(x, (mm.get(x) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 300) : [];
                        const poner = (cambio: Partial<FiltroUdf>) => setFiltrosUdf(fs => fs.map((x, y) => (y === k ? { ...x, ...cambio } : x)));
                        return (
                          <div key={k} className="flex items-center gap-1 mb-1">
                            <select value={f.campo} onChange={e => poner({ campo: e.target.value, valor: '' })} className="border border-[#D5DEE2] rounded px-1 py-1 w-[150px] bg-white">
                              <option value="">Field…</option>
                              {catalogo.filter(c => c.id.startsWith('udf:')).map(c => <option key={c.id} value={c.id.slice(4)}>{c.titulo}</option>)}
                            </select>
                            <select value={f.op} onChange={e => poner({ op: e.target.value as FiltroUdf['op'] })} className="border border-[#D5DEE2] rounded px-1 py-1 bg-white">
                              {OPS_UDF.map(([o, etq]) => <option key={o} value={o}>{etq}</option>)}
                            </select>
                            {f.op !== 'vacio' && (
                              <>
                                <input list={`udf-vals-${k}`} value={f.valor} onChange={e => poner({ valor: e.target.value })} placeholder={f.campo ? 'Value…' : ''} disabled={!f.campo}
                                  className="border border-[#D5DEE2] rounded px-1.5 py-1 flex-1 min-w-0" />
                                <datalist id={`udf-vals-${k}`}>
                                  {distintos.map(([x, c]) => <option key={x} value={x}>{`${c} activities`}</option>)}
                                </datalist>
                              </>
                            )}
                            <button onClick={() => setFiltrosUdf(fs => fs.filter((_, y) => y !== k))} title="Remove condition" className="p-1 text-[#5A6A74] hover:text-red-600 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        );
                      })}
                      <button onClick={() => setFiltrosUdf(fs => [...fs, { campo: '', op: 'igual', valor: '' }])} className="mt-0.5 px-2 py-1 border border-[#D5DEE2] rounded hover:bg-[#F5F8F9] cursor-pointer flex items-center gap-1">
                        <Plus className="w-3.5 h-3.5" /> Add condition
                      </button>
                      {hayFiltroUdf && <div className="mt-1.5 text-[10.5px] text-[#5A6A74]">Master-only items are hidden while a User Defined filter is active.</div>}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {editable && m && (
            <button onClick={programar} title="Schedule the project (F9)"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${pendienteF9 ? 'bg-amber-400 text-[#1E1B4B] animate-pulse' : 'bg-white/15 hover:bg-white/25'}`}>
              <Play className="w-3.5 h-3.5" /> Schedule (F9)
            </button>
          )}
          {editable && (
            <>
              <input ref={fileRef} type="file" accept=".xer" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) cargarArchivo(f); e.target.value = ''; }} />
            </>
          )}
          {editable && m && (
            <button onClick={guardar} disabled={!sinGuardar || !!ocupado}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${sinGuardar ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-white/15'}`}>
              <Save className="w-3.5 h-3.5" /> Save{cambios.length ? ` (${cambios.length})` : ''}
            </button>
          )}
          <button onClick={cerrar} className="p-1.5 rounded-lg hover:bg-white/15 cursor-pointer" title="Close"><X className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Avisos */}
      {(aviso || ocupado || pendienteF9) && (
        <div className={`px-4 py-1.5 text-[11.5px] shrink-0 ${ocupado ? 'bg-indigo-50 text-indigo-900' : pendienteF9 ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900'}`}>
          {ocupado || aviso || 'There are unscheduled changes: press «Schedule (F9)» to recalculate the dates.'}
        </div>
      )}

      {estadoCarga === 'cargando' && <div className="flex-1 flex items-center justify-center text-sm text-[#5A6A74]">Loading the schedule…</div>}
      {estadoCarga === 'error' && <div className="flex-1 flex items-center justify-center text-sm text-red-700">The schedule could not be loaded.</div>}
      {estadoCarga === 'vacio' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white border border-[#D5DEE2] rounded-2xl p-8 text-center max-w-md space-y-3">
            <Layers className="w-8 h-8 mx-auto text-[#312E81]" />
            <h3 className="font-bold">There is no T<sub className="text-[0.75em]">3</sub> schedule yet</h3>
            <p className="text-xs text-[#5A6A74]">
              {editable ? 'Export the project from Trakciona T₃ as XER and import it here.' : 'The administrator has not loaded the Trakciona T₃ XER yet.'}
            </p>
            {editable && (
              <button onClick={() => fileRef.current?.click()} className="px-4 py-2 rounded-xl bg-[#312E81] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> Import XER
              </button>
            )}
          </div>
        </div>
      )}

      {verNivel && m && (
        <DialogoNivelacion m={m} clasif={clasifXer} master={idxMaster} editable={editable} version={version}
          onIr={i => { setVerNivel(false); setVista('actividades'); irAActividad(i); }}
          onCerrar={() => setVerNivel(false)}
          onAplicar={(prop, resumen) => {
            const mm = modelo.current;
            if (!mm || !editable) return;
            const log = [...cambios];
            aplicarNivelacion(mm, prop, log);
            marcarCambio(log);
            programar();
            setVerNivel(false);
            mostrar(`New crew logic applied (${resumen}) and rescheduled. Review it and press Save to keep it.`);
          }} />
      )}
      {verColumnas && m && (
        <DialogoColumnas catalogo={catalogo} elegidas={cols.map(c => c.id)} onAplicar={ids => setColumnasSel(ids)} onCerrar={() => setVerColumnas(false)} />
      )}
      {verGrupo && m && (
        <DialogoGrupo
          constructiva={enEjecucion} niveles={niveles} opciones={opcGrupo} paleta={enEjecucion ? paletas.constr : paletas.wbs}
          nombreRaiz={arbolWbs.raices[0]?.codCompleto || 'Project'}
          info={enEjecucion ? [
            `${arbolEjec.enMaster.toLocaleString('en-US')} activities linked by Activity ID`,
            arbolEjec.sinMaster ? `${arbolEjec.sinMaster.toLocaleString('en-US')} XER activities without Master data (${arbolEjec.hitosUbicados.toLocaleString('en-US')} milestones placed with their related activities; the rest hidden)` : '',
            arbolEjec.soloMaster ? `${arbolEjec.soloMaster.toLocaleString('en-US')} Master-only items (not yet in T₃)` : '',
            arbolEjec.excluidas ? `${arbolEjec.excluidas.toLocaleString('en-US')} activities from WBS «Pending confirmation» (.D) excluded` : '',
          ].filter(Boolean) : []}
          onAplicar={(nv, op, pal) => {
            if (enEjecucion) { setNiveles(nv); setPaletas(p => ({ ...p, constr: pal })); } else setPaletas(p => ({ ...p, wbs: pal }));
            setOpcGrupo(op);
          }}
          onCerrar={() => setVerGrupo(false)} />
      )}
      {estadoCarga === 'listo' && m && (
        <>
        <div className="flex-1 flex min-h-0">
          {/* Barra lateral vertical (como la de P6): vistas y rutas */}
          <div className="w-[46px] shrink-0 bg-[#ECECEC] border-r border-[#C3C3C3] flex flex-col items-center py-2 gap-1 overflow-y-auto">
            {(['actividades', 'wbs', 'recursos'] as const).map(v => {
              const etq = v === 'actividades' ? 'Activities' : v === 'wbs' ? 'WBS' : 'Resources';
              return (
                <button key={v} onClick={() => setVista(v)} title={etq}
                  className={`w-[38px] py-1 rounded flex flex-col items-center gap-0.5 cursor-pointer border ${vista === v ? 'bg-white border-[#8A8FC9] text-[#312E81] shadow-sm' : 'border-transparent text-[#4A4A4A] hover:bg-white/70'}`}>
                  {v === 'actividades' ? <IconoBarras /> : v === 'wbs' ? <IconoWbsLateral /> : <IconoRecursos />}
                  <span className="text-[8.5px] leading-none">{v === 'actividades' ? 'Activities' : etq}</span>
                </button>
              );
            })}
            <div className="w-7 h-px bg-[#C3C3C3] my-1" />
            <button onClick={() => { setVista('actividades'); setVerUso(v => !v); }} title="Activity Usage: budgeted, actual and remaining units or cost per period"
              className={`w-[38px] py-1 rounded flex flex-col items-center gap-0.5 cursor-pointer border ${verUso ? 'bg-white border-[#8A8FC9] text-[#312E81] shadow-sm' : 'border-transparent text-[#4A4A4A] hover:bg-white/70'}`}>
              <svg width="22" height="16" viewBox="0 0 22 16"><rect x="1" y="1" width="20" height="14" fill="#FFFFFF" stroke="#5A6A74" /><path d="M1 6 H21 M1 10.5 H21 M8 1 V15 M14.5 1 V15" stroke="#9AA6AD" strokeWidth="1" /><rect x="9" y="7" width="4.5" height="2.5" fill="#2B7F52" /><rect x="15.5" y="11.5" width="4.5" height="2.5" fill="#CD0000" /></svg>
              <span className="text-[8.5px] leading-none">Usage</span>
            </button>
            {([['criticas', 'Critical Path', 'Critical', 'Only critical activities (Total Float ≤ 0)'], ['longest', 'Longest Path', 'Longest', 'Only the longest path: the chain of activities that drives the project finish']] as const).map(([k, etq, corto, tt]) => (
              <button key={k} onClick={() => { setVista('actividades'); setFiltroEstado(f => (f === k ? 'todas' : k)); setVerRelaciones(true); }} title={`${etq}: ${tt}`}
                className={`w-[38px] py-1 rounded flex flex-col items-center gap-0.5 cursor-pointer border ${filtroEstado === k && vista === 'actividades' ? 'bg-[#CD0000] border-[#CD0000] text-white shadow-sm' : 'border-transparent text-[#B30000] hover:bg-white/70'}`}>
                {k === 'criticas' ? <IconoCritica activo={filtroEstado === k && vista === 'actividades'} /> : <IconoLongest activo={filtroEstado === k && vista === 'actividades'} />}
                <span className="text-[8.5px] leading-none">{corto}</span>
              </button>
            ))}
            <div className="w-7 h-px bg-[#C3C3C3] my-1" />
            <button onClick={() => { setVista('actividades'); setVerRelaciones(v => !v); }} title="Relationships: show or hide the relationship lines in the Gantt chart"
              className={`w-[38px] py-1 rounded flex flex-col items-center gap-0.5 cursor-pointer border ${verRelaciones ? 'bg-white border-[#8A8FC9] text-[#312E81] shadow-sm' : 'border-transparent text-[#4A4A4A] hover:bg-white/70'}`}>
              <svg width="22" height="16" viewBox="0 0 22 16"><rect x="1" y="2" width="8" height="4" rx="1" fill="#2E9E3A" stroke="#1C6B25" /><rect x="13" y="10" width="8" height="4" rx="1" fill="#2E9E3A" stroke="#1C6B25" /><path d="M9 4 H11 V12 H12.5" fill="none" stroke="#14212A" strokeWidth="1.2" /><path d="M11 10 L13 12 L11 14" fill="#14212A" /></svg>
              <span className="text-[8.5px] leading-none">Relations</span>
            </button>
            <div className="relative">
              <button onClick={() => { setVista('actividades'); if (menuLB) setMenuLB(false); else { setVerLB(true); setMenuLB(true); } }} title="Baseline: show it and choose which one to use"
                className={`w-[38px] py-1 rounded flex flex-col items-center gap-0.5 cursor-pointer border ${verLB ? 'bg-[#FFF3C4] border-[#C99F00] text-[#7A5B00] shadow-sm' : 'border-transparent text-[#4A4A4A] hover:bg-white/70'}`}>
                <svg width="22" height="16" viewBox="0 0 22 16"><rect x="2" y="3" width="16" height="5" rx="1.5" fill="#2E9E3A" stroke="#1C6B25" /><rect x="2" y="10" width="13" height="3" rx="1" fill="#E3B505" stroke="#9C7C00" /></svg>
                <span className="text-[8.5px] leading-none">Baseline</span>
              </button>
              {menuLB && (
                <>
                  <div className="fixed inset-0 z-[60]" onClick={() => setMenuLB(false)} />
                  <div className="absolute left-[44px] top-0 z-[61] w-[330px] bg-white border border-[#B5B5B5] rounded-lg shadow-xl text-[11.5px] text-[#14212A]">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-[#F0F0F0] border-b border-[#D5D5D5] rounded-t-lg">
                      <b>Baseline</b>
                      <button onClick={() => setMenuLB(false)} className="p-0.5 hover:bg-white rounded cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="p-3 flex flex-col gap-2">
                      <label className="flex items-center gap-2 cursor-pointer font-semibold">
                        <input type="checkbox" checked={verLB} onChange={e => setVerLB(e.target.checked)} /> Show baseline bars in the Gantt chart
                      </label>
                      <div className="text-[10.5px] text-[#5A6A74] mt-1">Baseline to use (also for the «BL Finish Var.» column):</div>
                      {([
                        ['udf', lbUdf ? `T₃ baseline (blStartP6 / blFinishP6)` : '', lbUdf?.provisionales ? `${lbUdf.provisionales.toLocaleString('en-US')} activities with finish 30-Apr-27 have no baseline` : ''],
                        ['guardada', lbGuardada ? `Saved: ${lbGuardada.nombre}` : '', lbGuardada ? `set on ${new Date(lbGuardada.creadaEn).toLocaleDateString('en-US')} by ${lbGuardada.creadaPor}` : ''],
                        ['planificada', 'XER planned dates', 'planned start and finish of each activity'],
                      ] as const).filter(([, etq]) => etq).map(([k, etq, det]) => (
                        <label key={k} className={`flex items-start gap-2 px-2 py-1.5 rounded border cursor-pointer ${fuenteEf === k ? 'border-[#C99F00] bg-[#FFF8DC]' : 'border-transparent hover:bg-[#F5F8F9]'}`}>
                          <input type="radio" name="fuenteLB" className="mt-0.5" checked={fuenteEf === k} onChange={() => { setFuenteLB(k); setVerLB(true); }} />
                          <span><span className="font-semibold">{etq}</span>{det && <span className="block text-[10px] text-[#5A6A74]">{det}</span>}</span>
                        </label>
                      ))}
                      {editable && (
                        <div className="flex items-center gap-2 pt-2 mt-1 border-t border-[#ECECEC]">
                          <button onClick={() => { setMenuLB(false); fijarLineaBase(); }} className="px-2 py-1 border border-[#D5DEE2] rounded hover:bg-[#F5F8F9] cursor-pointer" title="Save the current schedule as the baseline">Set Current</button>
                          <button onClick={() => { setMenuLB(false); lbFileRef.current?.click(); }} className="px-2 py-1 border border-[#D5DEE2] rounded hover:bg-[#F5F8F9] cursor-pointer flex items-center gap-1" title="Use another XER (e.g. the contract schedule) as the baseline">
                            <Upload className="w-3.5 h-3.5" /> From Another XER
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
              <input ref={lbFileRef} type="file" accept=".xer" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) cargarLineaBase(f); e.target.value = ''; }} />
            </div>
            <div className="w-7 h-px bg-[#C3C3C3] my-1" />
            {([[true, '+', 'Expand All (Ctrl +)'], [false, '−', 'Collapse All (Ctrl −)']] as const).map(([abrir, signo, tt]) => (
              <button key={signo} onClick={() => { setVista('actividades'); expandirTodo(abrir); }} title={tt}
                className="w-[38px] py-1 rounded flex flex-col items-center gap-0.5 cursor-pointer border border-transparent text-[#4A4A4A] hover:bg-white/70">
                <span className="w-[18px] h-[18px] border border-[#8C8C8C] bg-white flex items-center justify-center text-[14px] font-bold leading-none text-[#1A1A1A]">{signo}</span>
                <span className="text-[8.5px] leading-none">{abrir ? 'Expand' : 'Collapse'}</span>
              </button>
            ))}
            <div className="w-7 h-px bg-[#C3C3C3] my-1" />
            <button onClick={() => { setVista('actividades'); setVerGrupo(true); }} title="Group & Sort: bands, colors and grouping levels"
              className={`w-[38px] py-1 rounded flex flex-col items-center gap-0.5 cursor-pointer border ${verGrupo ? 'bg-white border-[#8A8FC9] text-[#312E81] shadow-sm' : 'border-transparent text-[#4A4A4A] hover:bg-white/70'}`}>
              <svg width="22" height="16" viewBox="0 0 22 16"><rect x="1" y="1" width="14" height="3.5" fill="#1F7CC4" /><rect x="4" y="6" width="11" height="3.5" fill="#7CF27C" stroke="#4FA94F" strokeWidth="0.5" /><rect x="7" y="11" width="8" height="3.5" fill="#FFFF66" stroke="#C9C94A" strokeWidth="0.5" /><path d="M18 2 V14 M16 12 L18 14.5 L20 12" fill="none" stroke="#3A3A3A" strokeWidth="1.2" /></svg>
              <span className="text-[8.5px] leading-none">Group</span>
            </button>
            <button onClick={() => { setVista('actividades'); setVerColumnas(true); }} title="Columns: choose and order the table columns"
              className={`w-[38px] py-1 rounded flex flex-col items-center gap-0.5 cursor-pointer border ${verColumnas ? 'bg-white border-[#8A8FC9] text-[#312E81] shadow-sm' : 'border-transparent text-[#4A4A4A] hover:bg-white/70'}`}>
              <svg width="22" height="16" viewBox="0 0 22 16"><rect x="1" y="1" width="20" height="14" fill="#FFFFFF" stroke="#5A6A74" /><rect x="1" y="1" width="20" height="3.5" fill="#9AA6AD" /><path d="M7 1 V15 M13 1 V15" stroke="#5A6A74" strokeWidth="1" /></svg>
              <span className="text-[8.5px] leading-none">Columns</span>
            </button>
          </div>
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Herramientas (solo en la vista de actividades) */}
          <div className={`px-4 py-2 bg-white border-b border-[#D5DEE2] flex items-center gap-2 flex-wrap shrink-0 text-xs ${vista === 'actividades' ? '' : 'hidden'}`}>
            {vista === 'actividades' && (
              <>
                <select value={enEjecucion ? 'ejecucion' : 'wbs'} onChange={e => { setAgrupacion(e.target.value as 'wbs' | 'ejecucion'); setAbiertos(new Set([RAIZ_CONSTRUCTIVA, ...arbolWbs.raices.map(x => x.id)])); }}
                  disabled={!hayMaster} title={hayMaster ? 'How activities are grouped' : 'Load the Master to use the Construction view'}
                  className={`border rounded-lg px-2 py-1.5 font-semibold ${enEjecucion ? 'bg-[#312E81] border-[#312E81] text-white' : 'bg-white border-[#D5DEE2]'}`}>
                  <option value="wbs">Group by: T₃ WBS</option>
                  <option value="ejecucion">Group by: Construction</option>
                </select>
                {enEjecucion && (
                  <select value={ambito} onChange={e => { setAmbito(e.target.value as Ambito); setAbiertos(new Set([RAIZ_CONSTRUCTIVA])); }}
                    title="Construction: Master groups with «Construccion» or «Constr.»; Equipment: the rest; Obras Aéreas: SCAP Soport.Tub.Aerea, Tub.Aerea and Valvulas"
                    className={`border rounded-lg px-2 py-1.5 font-semibold ${ambito !== 'todo' ? 'bg-[#EEF0FB] border-[#312E81] text-[#312E81]' : 'bg-white border-[#D5DEE2]'}`}>
                    <option value="todo">Construction & Equipment</option>
                    <option value="construccion">Construction</option>
                    <option value="equipamiento">Equipment</option>
                    <option value="aereas">Obras Aéreas</option>
                  </select>
                )}
                <MenuVistas inicio={inicioVistas} mostrar={mostrar} esAdmin={editable}
                  actual={(): AjustesVista => ({ agrupacion, niveles, ambito, opcGrupo, paletas, columnas: columnasSel, orden, filtroEstado, filtrosUdf, px, verUso, verRelaciones, verLB })}
                  onAplicar={a => {
                    if (a.agrupacion === 'wbs' || a.agrupacion === 'ejecucion') {
                      setAgrupacion(a.agrupacion);
                      setAbiertos(new Set([RAIZ_CONSTRUCTIVA, ...arbolWbs.raices.map(x => x.id)]));
                    }
                    if (Array.isArray(a.niveles) && a.niveles.length) setNiveles(a.niveles as CampoAgrupacion[]);
                    if (a.ambito === 'todo' || a.ambito === 'construccion' || a.ambito === 'equipamiento' || a.ambito === 'aereas') setAmbito(a.ambito);
                    if (a.opcGrupo && typeof a.opcGrupo === 'object') setOpcGrupo({ ...OPC_GRUPO_DEF, ...(a.opcGrupo as Partial<OpcionesGrupo>) });
                    if (a.paletas && typeof a.paletas === 'object') setPaletas({ ...PALETAS_DEF, ...(a.paletas as Partial<Paletas>) });
                    if (Array.isArray(a.columnas) && a.columnas.length) setColumnasSel(a.columnas);
                    if (a.orden !== undefined) setOrden(a.orden);
                    if (typeof a.filtroEstado === 'string' && (a.filtroEstado in NOMBRE_FILTRO || a.filtroEstado === 'todas')) setFiltroEstado(a.filtroEstado as typeof filtroEstado);
                    if (Array.isArray(a.filtrosUdf)) setFiltrosUdf(a.filtrosUdf as FiltroUdf[]);
                    if (typeof a.px === 'number' && a.px > 0) setPx(a.px);
                    if (typeof a.verUso === 'boolean') setVerUso(a.verUso);
                    if (typeof a.verRelaciones === 'boolean') setVerRelaciones(a.verRelaciones);
                    if (typeof a.verLB === 'boolean') setVerLB(a.verLB);
                  }} />
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-[#5A6A74]" />
                  <input value={filtroTmp} onChange={e => setFiltroTmp(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') setFiltro(filtroTmp.trim()); }}
                    placeholder="Find Activity ID or Name (Enter)" className="pl-7 pr-2 py-1.5 border border-[#D5DEE2] rounded-lg w-56 outline-none focus:border-[#312E81]" />
                </div>
                {filtro && <button onClick={() => { setFiltro(''); setFiltroTmp(''); }} className="text-[#5A6A74] hover:text-red-600 cursor-pointer">Clear search ✕</button>}
                {editable && hayMaster && (
                  <button onClick={cargarUnidades} className="px-2 py-1.5 border border-[#D5DEE2] rounded-lg hover:bg-[#F5F8F9] cursor-pointer flex items-center gap-1"
                    title="Load the Budgeted Units of each activity's material resource («Venta») from the Master «Cantidad» column, linked by Activity ID (IDs with «p6» are left out)">
                    <Download className="w-3.5 h-3.5" /> Units ← Master
                  </button>
                )}
                {editable && (
                  <button onClick={() => setCreando(true)} className="px-2 py-1.5 rounded-lg bg-[#312E81] text-white font-bold flex items-center gap-1 cursor-pointer" title="Add an activity to the selected WBS">
                    <Plus className="w-3.5 h-3.5" /> Add Activity
                  </button>
                )}
                <div className="ml-auto flex items-center gap-1 text-[#5A6A74]">
                  Timescale
                  {[[0.4, 'Years'], [1, 'Quarters'], [3, 'Months'], [8, 'Weeks']].map(([v, l]) => (
                    <button key={String(v)} onClick={() => setPx(v as number)} className={`px-2 py-1 rounded cursor-pointer ${px === v ? 'bg-[#312E81] text-white' : 'hover:bg-[#F5F8F9]'}`}>{l}</button>
                  ))}
                </div>
              </>
            )}
          </div>

          {vista === 'actividades' ? (
            <>
              {/* Tabla + Gantt (virtualizada) */}
              <div ref={scroller} onScroll={e => {
                const el = e.target as HTMLDivElement;
                setScrollTop(el.scrollTop);
                // Desplazamiento horizontal sincronizado con el panel Activity Usage
                if (usoRef.current && Math.abs(usoRef.current.scrollLeft - el.scrollLeft) > 1) usoRef.current.scrollLeft = el.scrollLeft;
              }} className="flex-1 overflow-auto bg-white relative">
                <div style={{ width: ANCHO_IZQ + anchoGantt, height: filas.length * FILA + 34, position: 'relative' }}>
                  {/* Encabezado */}
                  <div className="sticky top-0 z-20 flex bg-[#F5F8F9] border-b border-[#D5DEE2] text-[10px] font-semibold text-[#5A6A74]" style={{ height: 34 }}>
                    <div className="sticky left-0 z-30 bg-[#F5F8F9] flex items-end pb-1 border-r border-[#D5DEE2]" style={{ width: ANCHO_IZQ }}>
                      {cols.map(c => (c.id === 'ini' || c.id === 'fin') ? (
                        <button key={c.id} onClick={() => alternarOrden(c.id as 'ini' | 'fin')} title="Sort the activities of each group (ascending → descending → original)"
                          className={`text-right px-1 cursor-pointer hover:text-[#312E81] shrink-0 ${orden?.col === c.id ? 'text-[#312E81]' : ''}`} style={{ width: c.ancho }}>
                          {c.titulo}{orden?.col === c.id ? (orden.dir === 1 ? ' ▲' : ' ▼') : ' ↕'}
                        </button>
                      ) : (
                        <div key={c.id} className={`px-1 leading-tight shrink-0 ${c.der ? 'text-right' : ''} ${c.id === 'id' ? 'pl-2' : ''}`} style={{ width: c.ancho }} title={c.titulo}>{c.titulo}</div>
                      ))}
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
                  <div className="absolute z-10 w-0.5 bg-[#CD0000]/70 pointer-events-none" style={{ left: ANCHO_IZQ + xDatos, top: 34, height: filas.length * FILA }} title="Data Date" />
                  {/* Filas */}
                  {filas.slice(desdeFila, hastaFila).map((fl, k) => {
                    const idx = desdeFila + k;
                    const top = 34 + idx * FILA;
                    if (fl.tipo === 'wbs') {
                      const n = fl.nodo;
                      const abierto = filtrando ? !cerradosF.has(n.id) : abiertos.has(n.id);
                      // Colores de la banda según Group & Sort (cada vista con su paleta)
                      const paleta = enEjecucion ? paletas.constr : paletas.wbs;
                      const [fondo, texto] = paleta[fl.nivel] ?? bandaWbs(fl.nivel);
                      const claro = !esOscuro(fondo);
                      return (
                        <div key={`w${n.id}`} className="absolute flex text-[11px] font-bold cursor-pointer bg-white border-b border-[#E6EAEC]" style={{ top, height: FILA, width: ANCHO_IZQ + anchoGantt, outline: wbsSel === n.id && !enEjecucion ? '2px solid #CD0000' : undefined, outlineOffset: -2 }} onClick={() => { alternar(n.id); setWbsSel(n.id); }}>
                          <div className="sticky left-0 z-[5] flex items-center border-r border-[#9AA6AD]" style={{ width: ANCHO_IZQ, background: fondo, color: texto }}>
                            {(() => {
                              // La etiqueta ocupa las columnas iniciales sin total; el resto muestra el total de la banda
                              const conTotal = (id: string) => ['ini', 'fin', 'es', 'ef', 'bls', 'blf', 'varFin', 'durO', 'tf', 'qBud', 'qAct', 'qRem', 'qAtC'].includes(id);
                              let k = 0;
                              while (k < cols.length - 1 && !conTotal(cols[k].id)) k++;
                              if (k === 0) k = Math.min(2, cols.length);
                              const anchoEtq = cols.slice(0, k).reduce((a, c) => a + c.ancho, 0);
                              const rs = resumenWbs.get(n.id);
                              const vfDe = (x: Nodo) => { const r2 = resumenWbs.get(x.id); return variacionFin(r2?.lbFin, r2?.fin ?? x.fin); };
                              const total = (id: string): React.ReactNode => {
                                if (!opcGrupo.totales) return '';
                                switch (id) {
                                  case 'ini': case 'es': return fCorta(rs?.ini ?? n.ini);
                                  case 'fin': case 'ef': return fCorta(rs?.fin ?? n.fin);
                                  case 'bls': return fCorta(rs?.lbIni);
                                  case 'blf': return fCorta(rs?.lbFin);
                                  case 'varFin': {
                                    // En el proyecto de la vista constructiva: la variación más negativa de sus grupos
                                    const vf = n.id === RAIZ_CONSTRUCTIVA
                                      ? n.hijos.map(vfDe).filter((x): x is number => x != null).reduce<number | null>((a, b) => (a == null || b < a ? b : a), null)
                                      : vfDe(n);
                                    return vf == null ? '' : dias(vf, 8);
                                  }
                                  case 'qBud': case 'qAct': case 'qRem': case 'qAtC': {
                                    if (!rs?.hayQ) return '';
                                    const q = id === 'qBud' ? rs.qb : id === 'qAct' ? rs.qa : id === 'qRem' ? rs.qr : rs.qa + rs.qr;
                                    return q.toLocaleString('en-US', { maximumFractionDigits: Math.abs(q) >= 1000 ? 0 : 2 });
                                  }
                                  default: return '';
                                }
                              };
                              return (
                                <>
                                  <div className="flex items-center gap-1 min-w-0 shrink-0 pr-1" style={{ paddingLeft: sangriaBanda(fl.nivel), width: anchoEtq }}>
                                    {abierto ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                                    <span className="truncate" title={`${n.codCompleto} · ${n.nombre}`}>{opcGrupo.codigo && n.codCompleto && <><span className={claro ? 'opacity-70' : 'opacity-80'}>{n.codCompleto}</span>&nbsp; </>}{(opcGrupo.nombre || !n.codCompleto) && n.nombre}</span>
                                    <span className={`text-[9.5px] font-normal shrink-0 ${claro ? 'opacity-70' : 'opacity-80'}`}>({filtroEstado === 'soloMaster' ? `${n.nSolo ?? 0} Master only` : n.n})</span>
                                    {opcGrupo.totales && n.criticas > 0 && filtroEstado !== 'soloMaster' && (
                                      <span className={`ml-auto shrink-0 text-[10px] font-semibold ${claro ? 'text-[#B30000]' : 'text-[#FFD2D2]'}`}>{n.criticas} critical</span>
                                    )}
                                  </div>
                                  {cols.slice(k).map(c => (
                                    <div key={c.id} className={`px-1 shrink-0 truncate ${c.der ? 'text-right' : ''}`} style={{ width: c.ancho }}
                                      title={c.id === 'varFin' && n.id === RAIZ_CONSTRUCTIVA ? 'The most negative finish variance of its groups' : undefined}>{total(c.id)}</div>
                                  ))}
                                </>
                              );
                            })()}
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
                                    title={`Baseline: ${fCorta(rs.lbIni)} → ${fCorta(rs.lbFin)}`} />
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
                          style={{ top, height: FILA, width: ANCHO_IZQ + anchoGantt }} title="Item created in the Master that does not exist in the Trakciona T₃ XER yet">
                          <div className="sticky left-0 z-[5] flex items-center border-r border-[#D5DEE2] bg-[#FAFAF7]" style={{ width: ANCHO_IZQ }}>
                            {cols.map(c => {
                              const base = `px-1 truncate shrink-0 ${c.der ? 'text-right' : ''}`;
                              if (c.id === 'id') return <div key={c.id} className="px-2 font-mono text-[10px] truncate not-italic shrink-0" style={{ width: c.ancho, paddingLeft: sangriaId(fl.nivel) }} title={String(a.activityId ?? '')}>{a.activityId}</div>;
                              if (c.id === 'nombre') return (
                                <div key={c.id} className={`${base} flex items-center gap-1`} style={{ width: c.ancho }} title={a.descripcion}>
                                  <span className="truncate">{a.descripcion}</span>
                                  <span className="shrink-0 px-1 rounded bg-[#FFF3C4] text-[#7A5B00] text-[9.5px] font-semibold not-italic">Master only · not in T₃</span>
                                </div>
                              );
                              const txt = c.id === 'ini' || c.id === 'es' ? fCorta(ini) : c.id === 'fin' || c.id === 'ef' ? fCorta(fin) : '';
                              return <div key={c.id} className={base} style={{ width: c.ancho }}>{txt}</div>;
                            })}
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
                    const tituloLB = lb ? ` · Baseline ${fCorta(lb[0])} → ${fCorta(lb[1])}${varFin != null ? ` (finish variance ${varFin > 0 ? '+' : ''}${dias(varFin, v.hd)} d)` : ''}` : '';
                    return (
                      <div key={`a${v.i}`} onClick={() => { setSel(v.i); verFecha(v.resto ?? v.ini); }}
                        className={`absolute flex text-[11px] cursor-pointer border-b border-[#F0F2F4] ${seleccionada ? 'bg-[#FFF7D6]' : 'bg-white hover:bg-[#F7F9FA]'}`}
                        style={{ top, height: FILA, width: ANCHO_IZQ + anchoGantt }}>
                        <div className={`sticky left-0 z-[5] flex items-center border-r border-[#D5DEE2] ${seleccionada ? 'bg-[#FFF7D6]' : 'bg-white'}`} style={{ width: ANCHO_IZQ }}>
                          {cols.map(c => celdaAct(c, v, fl.nivel, critica, lbDatos, varFin))}
                        </div>
                        {/* Barras */}
                        {lb && lb[0] != null && lb[1] != null && (esHito ? (
                          <div className="absolute w-2 h-2 rotate-45 bg-[#E3B505] border border-[#9C7C00]" style={{ left: ANCHO_IZQ + xDe(esHitoFinTipo(v.tipo) ? lb[1] : lb[0]) - 4, top: 13 }} title={`Baseline ${fCorta(lb[1])}`} />
                        ) : (
                          <div className="absolute h-[5px] bg-[#E3B505] rounded-sm" style={{ left: ANCHO_IZQ + xDe(lb[0]), width: Math.max(2, xDe(lb[1]) - xDe(lb[0])), top: 15 }}
                            title={`Baseline ${fCorta(lb[0])} → ${fCorta(lb[1])}`} />
                        ))}
                        {esHito ? (
                          v.ini != null && <div className="absolute w-2.5 h-2.5 rotate-45" style={{ left: ANCHO_IZQ + xDe(v.ini) - 5, top: yB, background: v.estado === 'TK_Complete' ? '#2C67A6' : critica ? '#CD0000' : '#14212A' }} title={`${v.cod} · ${fCorta(v.ini)}${tituloLB}`} />
                        ) : (
                          <>
                            {v.iniA && v.ini != null && (
                              <div className="absolute h-2.5 bg-[#2C67A6] rounded-sm" title={`Actual${tituloLB}`}
                                style={{ left: ANCHO_IZQ + xDe(v.ini), width: Math.max(2, xDe(v.estado === 'TK_Complete' ? v.fin ?? v.ini : m.fechaDatos) - xDe(v.ini)), top: yB }} />
                            )}
                            {v.estado !== 'TK_Complete' && (v.resto ?? v.ini) != null && v.fin != null && (
                              <div className={`absolute h-2.5 rounded-sm ${critica ? 'bg-[#CD0000]' : 'bg-[#2B7F52]'}`} title={`Remaining${tituloLB}`}
                                style={{ left: ANCHO_IZQ + xDe((v.resto ?? v.ini)!), width: Math.max(2, xDe(v.fin) - xDe((v.resto ?? v.ini)!)), top: yB }} />
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {verUso && m && (
                <PanelUso m={m} filas={filas} ancho={ANCHO_IZQ} anchoGantt={anchoGantt} xDe={xDe} xDatos={xDatos}
                  desde={rango.desde} hasta={rango.hasta} px={px} version={version} pasa={pasa} filtrando={filtrando}
                  colorBanda={nivel => (enEjecucion ? paletas.constr : paletas.wbs)[nivel] ?? bandaWbs(nivel)}
                  usoRef={usoRef} onCerrar={() => setVerUso(false)}
                  campoAct={campoActividad}
                  masterDe={i => idxMaster.get(celda(m.task, m.task.filas[i], 'task_code'))}
                  lineaBase={lbPorAct} nombreLB={fuenteEf === 'udf' ? 'T₃ baseline (blStartP6 / blFinishP6)' : fuenteEf === 'guardada' ? `saved baseline${lbGuardada ? ` «${lbGuardada.nombre}»` : ''}` : 'XER planned dates'}
                  onScrollX={x => { const el = scroller.current; if (el && Math.abs(el.scrollLeft - x) > 1) el.scrollLeft = x; }} />
              )}
              {sel != null && sel < vts.length && (
                <PanelActividad m={m} i={sel} editable={editable} cambios={cambios} version={version} onCambio={marcarCambio} onCerrar={() => setSel(null)}
                  nombreWbs={(() => { const n = arbolWbs.nodos.get(vts[sel]?.wbs ?? ''); return n ? `${n.codCompleto} · ${n.nombre}` : ''; })()}
                  onIr={irAActividad}
                  onNavegar={dir => {
                    // ▲▼ como en P6: pasa a la actividad anterior/siguiente de la tabla y la deja a la vista
                    const k0 = filaDeActividad.get(sel);
                    if (k0 === undefined) return;
                    for (let k = k0 + dir; k >= 0 && k < filas.length; k += dir) {
                      const fl = filas[k];
                      if (fl.tipo !== 'act') continue;
                      setSel(fl.vt.i);
                      const sc = scroller.current;
                      if (sc) {
                        const y = 34 + k * FILA;
                        if (y < sc.scrollTop + 34) sc.scrollTop = y - 34;
                        else if (y + FILA > sc.scrollTop + sc.clientHeight) sc.scrollTop = y + FILA - sc.clientHeight;
                      }
                      break;
                    }
                  }}
                  onEliminar={() => {
                    const t = m.task, f = t.filas[sel];
                    const cod = celda(t, f, 'task_code');
                    const id = celda(t, f, 'task_id');
                    const nRel = m.pred.filas.filter(fr => celda(m.pred, fr, 'task_id') === id || celda(m.pred, fr, 'pred_task_id') === id).length;
                    if (!window.confirm(`Delete activity ${cod} · ${celda(t, f, 'task_name')}?\n\nIts ${nRel} relationships, resource assignments, codes and user defined fields will also be removed.`)) return;
                    const log = [...cambios];
                    eliminarActividad(m, sel, log);
                    setSel(null);
                    marcarCambio(log);
                    mostrar(`Activity ${cod} deleted. Press «Schedule (F9)» to recalculate.`);
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
                        : (() => { const otra = m.task.filas.findIndex(fr => celda(m.task, fr, 'task_code').toLowerCase() === rel.codigo.toLowerCase()); return otra < 0 ? `${rel.codigo} does not exist` : agregarRelacion(m, datos.codigo, otra, rel.tipo, 0, log); })();
                      if (err) mostrar(`Activity created, but not the relationship with ${rel.codigo}: ${err}`);
                    }
                    // Abrir el WBS donde quedó
                    abrirRama(datos.wbsId);
                    setCreando(false);
                    marcarCambio(log);
                    setSel(r);
                    mostrar(`Activity ${datos.codigo} added. Press «Schedule (F9)» to calculate its dates.`);
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
          </div>
          {/* Barra lateral derecha: importar y exportar el XER, y nivelar cuadrillas */}
          <div className="w-[46px] shrink-0 bg-[#ECECEC] border-l border-[#C3C3C3] flex flex-col items-center py-2 gap-1">
            {editable && (
              <button onClick={() => fileRef.current?.click()} title="Import XER: open an XER exported from Trakciona T₃"
                className="w-[38px] py-1 rounded flex flex-col items-center gap-0.5 cursor-pointer border border-transparent text-[#312E81] hover:bg-white hover:border-[#8A8FC9]">
                <Upload className="w-5 h-5" />
                <span className="text-[8.5px] leading-none text-[#4A4A4A]">Import</span>
              </button>
            )}
            <button onClick={exportar} title="Export XER: download the XER to import it into Trakciona T₃"
              className="w-[38px] py-1 rounded flex flex-col items-center gap-0.5 cursor-pointer border border-transparent text-[#312E81] hover:bg-white hover:border-[#8A8FC9]">
              <Download className="w-5 h-5" />
              <span className="text-[8.5px] leading-none text-[#4A4A4A]">Export</span>
            </button>
            <div className="w-7 h-px bg-[#C3C3C3] my-1" />
            <button onClick={() => { setVista('actividades'); setVerNivel(true); }} title="Level Crews: rebuild the crew logic of a set of activities (subcontractor / SCAP / phase) to level the monthly workload"
              className={`w-[38px] py-1 rounded flex flex-col items-center gap-0.5 cursor-pointer border ${verNivel ? 'bg-white border-[#8A8FC9] text-[#312E81] shadow-sm' : 'border-transparent text-[#4A4A4A] hover:bg-white/70'}`}>
              <svg width="22" height="16" viewBox="0 0 22 16"><rect x="1" y="9" width="4" height="6" fill="#B8C0C6" /><rect x="6" y="3" width="4" height="12" fill="#B8C0C6" /><rect x="11" y="7" width="4" height="8" fill="#B8C0C6" /><rect x="16" y="1" width="4" height="14" fill="#B8C0C6" /><path d="M1 6.5 H21" stroke="#312E81" strokeWidth="1.6" strokeDasharray="2 1.2" /></svg>
              <span className="text-[8.5px] leading-none">Level</span>
            </button>
          </div>
        </div>
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
            <button className={btn} disabled={!nodoSel} onClick={() => nodoSel && setNuevo({ modo: 'hijo', corto: sugerirCodigo(nodoSel.id), nombre: '' })} title="Add a WBS under the selected one"><Plus className="w-3.5 h-3.5" /> Add Child</button>
            <button className={btn} disabled={!nodoSel || esRaiz} onClick={() => nodoSel && setNuevo({ modo: 'hermano', corto: sugerirCodigo(nodoSel.padre), nombre: '' })} title="Add a WBS at the same level, below the selected one"><Plus className="w-3.5 h-3.5" /> Add Sibling</button>
            <span className="w-px h-5 bg-[#D5DEE2] mx-1" />
            {([['arriba', ArrowUp, 'Move Up'], ['abajo', ArrowDown, 'Move Down'], ['izquierda', ArrowLeft, 'Move Left (outdent)'], ['derecha', ArrowRight, 'Move Right (indent under the previous WBS)']] as const).map(([a, Ic, tt]) => (
              <button key={a} className={btn} disabled={!nodoSel || esRaiz} title={tt}
                onClick={() => nodoSel && accion(log => moverWbs(m, nodoSel.id, a, log))}>
                <Ic className="w-3.5 h-3.5" />
              </button>
            ))}
            <span className="w-px h-5 bg-[#D5DEE2] mx-1" />
            <button className={`${btn} text-red-700`} disabled={!nodoSel || esRaiz} onClick={() => {
              if (!nodoSel) return;
              const ids = subarbolWbs(m, nodoSel.id);
              if (!window.confirm(`Delete WBS ${nodoSel.codCompleto} · ${nodoSel.nombre}${ids.size > 1 ? ` and its ${ids.size - 1} child WBS` : ''}?\n\nIts ${nodoSel.n} activities are not deleted: they move to the parent WBS.`)) return;
              const padre = nodoSel.padre;
              if (accion(log => eliminarWbs(m, nodoSel.id, log), `WBS ${nodoSel.codCompleto} deleted; its activities moved to the parent WBS.`)) setSelW(padre);
            }}><Trash2 className="w-3.5 h-3.5" /> Delete</button>
          </>
        ) : <span className="text-[#5A6A74]">Only the administrator can modify the WBS.</span>}
        {nodoSel && (
          <button className={`${btn} ml-auto`} onClick={() => onVerActividades(nodoSel.id)} title="Go to the activities of this WBS"><Layers className="w-3.5 h-3.5" /> View Activities</button>
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
              }, 'WBS added.');
              if (ok) { setNuevo(null); setAbiertosW(prev => new Set([...prev, padre])); setSelW(creado || null); }
            }}>
              <b>New WBS {nuevo.modo === 'hijo' ? `under ${nodoSel?.codCompleto}` : `at the level of ${nodoSel?.codCompleto}`}</b>
              <input value={nuevo.corto} onChange={e => setNuevo({ ...nuevo, corto: e.target.value })} placeholder="Code" className="border border-[#D5DEE2] rounded px-2 py-1 w-24" autoFocus required />
              <input value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="WBS Name" className="border border-[#D5DEE2] rounded px-2 py-1 w-80" required />
              <button type="submit" className="px-3 py-1 rounded bg-[#312E81] text-white font-bold cursor-pointer">Add</button>
              <button type="button" onClick={() => setNuevo(null)} className="px-2 py-1 rounded hover:bg-white cursor-pointer">Cancel</button>
            </form>
          ) : nodoSel && !esRaiz ? (
            <div className="flex items-center gap-2 flex-wrap" key={`${nodoSel.id}-${version}`}>
              <b>Selected:</b>
              <label className="flex items-center gap-1">Code
                <input defaultValue={nodoSel.cod} className="border border-[#D5DEE2] rounded px-2 py-1 w-24"
                  onBlur={e => e.target.value !== nodoSel.cod && accion(log => editarWbs(m, nodoSel.id, { corto: e.target.value }, log))}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
              </label>
              <label className="flex items-center gap-1">Name
                <input defaultValue={nodoSel.nombre} className="border border-[#D5DEE2] rounded px-2 py-1 w-96"
                  onBlur={e => e.target.value !== nodoSel.nombre && accion(log => editarWbs(m, nodoSel.id, { nombre: e.target.value }, log))}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
              </label>
              <span className="text-[#5A6A74]">{nodoSel.n} activities</span>
            </div>
          ) : <span className="text-[#5A6A74]">The project node cannot be edited here. Select a WBS to modify it.</span>}
        </div>
      )}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[12px] border-collapse text-[#1A1A1A] select-none">
          <thead className="sticky top-0 z-10 bg-[#F0F0F0] text-[11.5px] font-normal">
            <tr className="text-left">
              <th className="px-2 py-1 font-normal border border-[#C8C8C8] w-[340px]">WBS Code</th>
              <th className="px-2 font-normal border border-[#C8C8C8]">WBS Name</th>
              <th className="px-2 font-normal border border-[#C8C8C8] text-right w-28">Total Activities</th>
              <th className="px-2 font-normal border border-[#C8C8C8] w-28">Start</th>
              <th className="px-2 font-normal border border-[#C8C8C8] w-28">Actual Finish</th>
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
                          <button onClick={e => { e.stopPropagation(); alternarW(n.id); }} title={abierto ? 'Collapse' : 'Expand'}
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

/** Panel inferior «Activity Usage» (como el Usage Spreadsheet de P6): valores por período de cada fila. */
const leerLocal = <T,>(k: string, def: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : def; } catch { return def; } };

const PanelUso: React.FC<{
  m: ModeloP6; filas: Fila[]; ancho: number; anchoGantt: number; xDe: (t: number) => number; xDatos: number;
  desde: number; hasta: number; px: number; version: number; pasa: (v: Vt) => boolean; filtrando: boolean;
  colorBanda: (nivel: number) => [string, string]; usoRef: React.RefObject<HTMLDivElement | null>; onScrollX: (x: number) => void; onCerrar: () => void;
  campoAct: (i: number, k: CampoAgrupacion) => string;
  masterDe: (i: number) => Actividad | undefined;
  /** Línea base en uso (la del botón Baseline) por fila de TASK: fechas del Budgeted. */
  lineaBase: LineaBaseFilas; nombreLB: string;
}> = ({ m, filas, ancho, anchoGantt, xDe, xDatos, desde, hasta, px, version, pasa, filtrando, colorBanda, usoRef, onScrollX, onCerrar, campoAct, masterDe, lineaBase, nombreLB }) => {
  const [medida, setMedida] = React.useState<MedidaUso>('cost');
  // Resources: personal (cuadrillas × personas por cuadrilla de su SubC) o número de cuadrillas
  const [vistaRec, setVistaRec] = React.useState<'personnel' | 'crews'>('personnel');
  const [tamManual, setTamManual] = React.useState<Record<string, number>>(() => leerLocal('p6.cuadrillas', {}));
  const [tamDefecto, setTamDefecto] = React.useState<number>(() => leerLocal('p6.cuadrillaDefecto', POR_DEFECTO));
  React.useEffect(() => { try { localStorage.setItem('p6.cuadrillas', JSON.stringify(tamManual)); localStorage.setItem('p6.cuadrillaDefecto', JSON.stringify(tamDefecto)); } catch { /* sin almacenamiento */ } }, [tamManual, tamDefecto]);
  const [verTam, setVerTam] = React.useState(false);
  // Instalación de equipos (04.Precom_Eq): personas desde horas-hombre (rendimientos × cantidad del Master)
  const [tamDisc, setTamDisc] = React.useState<Record<Disciplina, number>>(() => ({ ...CUADRILLA_DISCIPLINA, ...leerLocal('p6.cuadrillaDisc', {}) }));
  const [factorLocal, setFactorLocal] = React.useState<number>(() => leerLocal('p6.factorLocal', FACTOR_LOCAL));
  React.useEffect(() => { try { localStorage.setItem('p6.cuadrillaDisc', JSON.stringify(tamDisc)); localStorage.setItem('p6.factorLocal', JSON.stringify(factorLocal)); } catch { /* sin almacenamiento */ } }, [tamDisc, factorLocal]);
  const hhAct = React.useMemo(() => {
    const out = new Map<number, { H: number; disc: Disciplina }>();
    if (medida !== 'resources') return out;
    m.task.filas.forEach((f, i) => {
      if (!esPrecomEq(campoAct(i, 'grupo'))) return;
      const a = masterDe(i);
      const cant = Number(a?.cantidadCdo) || 0;
      if (!a || cant <= 0) return;
      const rd = rendimientoDe({ componente: campoAct(i, 'componente'), scap: campoAct(i, 'scap'), unit: campoAct(i, 'unit'), descripcion: a.descripcion || celda(m.task, f, 'task_name'), unidad: a.unidad });
      out.set(i, { H: cant * rd.hh[1] * factorLocal, disc: rd.disciplina });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medida, m, campoAct, masterDe, factorLocal, version]);
  const matriz = useMatrizPersonal(medida === 'resources');
  // Ocupan cuadrilla en obra: Installation y Construction (no compra, flete ni ingeniería)
  const incluirRec = React.useCallback((i: number) => {
    const f = faseDe(celda(m.task, m.task.filas[i], 'task_name'));
    return (f === 'montaje' || f === 'construccion') && !/ingenier/i.test(campoAct(i, 'grupo'));
  }, [m, campoAct]);
  const subcDe = React.useCallback((i: number) => campoAct(i, 'subcontratista'), [campoAct]);
  const SEMANAS = 8;
  const estCuad = React.useMemo(() => (medida === 'resources' && matriz.registros ? estimarCuadrillas(m, subcDe, incluirRec, matriz.registros, SEMANAS) : new Map()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [medida, matriz.registros, m, subcDe, incluirRec, version]);
  const usadosSubc = React.useMemo(() => {
    const out = new Map<string, number>();
    if (medida !== 'resources') return out;
    m.task.filas.forEach((f, i) => {
      if (celda(m.task, f, 'status_code') === 'TK_Complete' || !incluirRec(i) || hhAct.has(i)) return;
      const tt = celda(m.task, f, 'task_type');
      if (tt === 'TT_Mile' || tt === 'TT_FinMile' || tt === 'TT_LOE' || tt === 'TT_WBS') return;
      const s2 = subcDe(i); out.set(s2, (out.get(s2) ?? 0) + 1);
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medida, m, incluirRec, subcDe, version, hhAct]);
  const personasDe = React.useCallback((i: number) => {
    if (vistaRec === 'crews') return 1;
    const s2 = subcDe(i);
    return tamManual[s2] ?? estCuad.get(s2)?.estimado ?? tamDefecto;
  }, [vistaRec, subcDe, tamManual, estCuad, tamDefecto]);
  const [series, setSeries] = React.useState<SerieUso[]>(['b', 'r', 'a']);
  const [acumulado, setAcumulado] = React.useState(false);
  // Botones de fase (como en el Gantt del Master): ninguno activo = todas; varios = cualquiera de ellos
  const [fases, setFases] = React.useState<Set<FaseUso>>(new Set());
  const faseDeAct = React.useMemo(() => new Map<number, FaseUso>(), [m, version]);
  const pasaFase = React.useCallback((v: Vt) => {
    if (!fases.size) return true;
    let f = faseDeAct.get(v.i);
    if (!f) { f = faseDe(v.nombre); faseDeAct.set(v.i, f); }
    return fases.has(f);
  }, [fases, faseDeAct]);
  const [alto, setAlto] = React.useState(280);
  const [scrollTop, setScrollTop] = React.useState(0);
  const periodos = React.useMemo(() => periodosDeEscala(desde, hasta, px), [desde, hasta, px]);
  const lim = React.useMemo(() => periodos.map(p => p.t), [periodos]);
  const uso = React.useMemo(() => calcularUso(m, lim, medida, medida === 'resources' ? {
    incluir: i => incluirRec(i) || hhAct.has(i), personas: personasDe,
    hh: i => hhAct.get(i)?.H ?? null, porCuadrilla: i => tamDisc[hhAct.get(i)?.disc ?? 'Mecánica'], cuadrillas: vistaRec === 'crews',
  } : undefined, lineaBase),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m, lim, medida, version, incluirRec, personasDe, hhAct, tamDisc, vistaRec, lineaBase]);
  const nPer = Math.max(0, lim.length - 1);
  // Totales de una banda: suma de sus actividades (las que pasan el filtro si lo hay)
  const totalNodo = React.useMemo(() => {
    const cache = new Map<string, Record<SerieUso, Float64Array>>();
    const calc = (n: Nodo): Record<SerieUso, Float64Array> => {
      const ya = cache.get(n.id);
      if (ya) return ya;
      const r = { b: new Float64Array(nPer), a: new Float64Array(nPer), r: new Float64Array(nPer) };
      for (const v of n.tareas) {
        if (filtrando && !pasa(v)) continue;
        if (!pasaFase(v)) continue;
        const u = uso.get(v.i);
        if (!u) continue;
        sumarTramo(r.b, u.b); sumarTramo(r.a, u.a); sumarTramo(r.r, u.r);
      }
      for (const h of n.hijos) { const x = calc(h); for (const k of ['b', 'a', 'r'] as SerieUso[]) for (let j = 0; j < nPer; j++) r[k][j] += x[k][j]; }
      cache.set(n.id, r);
      return r;
    };
    return calc;
  }, [uso, nPer, filtrando, pasa, pasaFase]);
  const serieDeAct = (i: number, k: SerieUso): Float64Array => {
    const acc = new Float64Array(nPer);
    sumarTramo(acc, uso.get(i)?.[k]);
    return acc;
  };
  const NOMBRE_SERIE: Record<SerieUso, string> = { b: 'Budgeted Total', a: 'Actual Total', r: 'Remaining Total' };
  const SUB = 15;
  const altoFila = Math.max(22, series.length * SUB + 4);
  const desdeF = Math.max(0, Math.floor(scrollTop / altoFila) - 5);
  const hastaF = Math.min(filas.length, Math.ceil((scrollTop + alto) / altoFila) + 5);
  // Arrastrar el borde superior para cambiar la altura
  const arrastrar = (e: React.MouseEvent) => {
    const y0 = e.clientY, h0 = alto;
    const mover = (ev: MouseEvent) => setAlto(Math.max(120, Math.min(640, h0 + (y0 - ev.clientY))));
    const soltar = () => { window.removeEventListener('mousemove', mover); window.removeEventListener('mouseup', soltar); };
    window.addEventListener('mousemove', mover); window.addEventListener('mouseup', soltar);
  };
  const celdas = (vals: Float64Array, y: number, k: string) => {
    let acum = 0;
    const out: React.ReactNode[] = [];
    for (let j = 0; j < nPer; j++) {
      acum += vals[j];
      const v = acumulado ? acum : vals[j];
      if (Math.abs(v) < 0.005) continue;
      const x0 = xDe(lim[j]), x1 = xDe(lim[j + 1]);
      out.push(<div key={`${k}-${j}`} className="absolute text-right pr-1 overflow-hidden whitespace-nowrap" style={{ left: ancho + x0, width: Math.max(0, x1 - x0), top: y, height: SUB, lineHeight: `${SUB}px` }}>{compacto(v)}</div>);
    }
    return out;
  };
  return (
    <div className="shrink-0 bg-white border-t-2 border-[#9A9A9A] flex flex-col relative" style={{ height: alto }}>
      {verTam && (
        <DialogoCuadrillas est={estCuad} usados={usadosSubc} manual={tamManual} defecto={tamDefecto} origen={matriz.origen} semanas={SEMANAS}
          tamDisc={tamDisc} factor={factorLocal} equipos={(() => {
            const out = new Map<Disciplina, { n: number; hh: number }>();
            for (const [i, x] of hhAct) {
              const pct = Math.min(1, (Number(celda(m.task, m.task.filas[i], 'phys_complete_pct')) || 0) / 100);
              if (celda(m.task, m.task.filas[i], 'status_code') === 'TK_Complete') continue;
              const v = out.get(x.disc) ?? { n: 0, hh: 0 }; v.n++; v.hh += x.H * (1 - pct); out.set(x.disc, v);
            }
            return out;
          })()}
          onAplicar={(mm, d, td, fl) => { setTamManual(mm); setTamDefecto(d); setTamDisc(td); setFactorLocal(fl); }} onCerrar={() => setVerTam(false)} />
      )}
      <div onMouseDown={arrastrar} className="absolute -top-1.5 left-0 right-0 h-2 cursor-ns-resize z-30" title="Drag to resize" />
      <div className="flex items-center gap-3 px-3 py-1 bg-[#ECECEC] border-b border-[#C3C3C3] text-[11px] shrink-0">
        <b>Activity Usage</b>
        <div className="inline-flex border border-[#B5B5B5] rounded overflow-hidden">
          {(['units', 'cost', 'resources'] as const).map(x => (
            <button key={x} onClick={() => setMedida(x)} className={`px-2 py-0.5 cursor-pointer ${medida === x ? 'bg-[#312E81] text-white font-bold' : 'bg-white'}`}
              title={x === 'resources' ? 'Crews and personnel: each Installation / Construction activity in progress is one crew' : undefined}>{x === 'units' ? 'Units' : x === 'cost' ? 'Cost' : 'Resources'}</button>
          ))}
        </div>
        {medida === 'resources' && (
          <>
            <div className="inline-flex border border-[#B5B5B5] rounded overflow-hidden">
              {(['personnel', 'crews'] as const).map(x => (
                <button key={x} onClick={() => setVistaRec(x)} className={`px-2 py-0.5 cursor-pointer ${vistaRec === x ? 'bg-[#2B7F52] text-white font-bold' : 'bg-white'}`}>{x === 'personnel' ? 'Personnel' : 'Crews'}</button>
              ))}
            </div>
            <button onClick={() => setVerTam(true)} className="px-2 py-0.5 border border-[#B5B5B5] rounded bg-white hover:bg-[#F5F8F9] cursor-pointer"
              title="Persons per crew for each subcontractor (estimated from the personnel matrix; editable)">
              Crew size{matriz.cargando ? ' (loading staff…)' : Object.keys(tamManual).length ? ` · ${Object.keys(tamManual).length} edited` : ''}
            </button>
          </>
        )}
        {(['b', 'r', 'a'] as SerieUso[]).map(k => (
          <label key={k} className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={series.includes(k)} onChange={e => setSeries(sx => (e.target.checked ? (['b', 'r', 'a'] as SerieUso[]).filter(z => sx.includes(z) || z === k) : sx.filter(z => z !== k)))} />
            <span title={k === 'b' ? `Spread over the baseline dates in use: ${nombreLB} (activities without baseline: their planned dates)` : undefined}>{NOMBRE_SERIE[k]}</span>
          </label>
        ))}
        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={acumulado} onChange={e => setAcumulado(e.target.checked)} /> Cumulative</label>
        <div className="flex items-center gap-1">
          {([
            ['procura', 'Procurement', ShoppingCart, 'bg-blue-600 border-blue-600', 'bg-blue-50 text-blue-900 border-blue-300', 'Activities whose name starts with "compr"'],
            ['flete', 'Freight', Truck, 'bg-purple-600 border-purple-600', 'bg-purple-50 text-purple-900 border-purple-300', 'Activities whose name starts with "flete"'],
            ['montaje', 'Installation', Wrench, 'bg-amber-600 border-amber-600', 'bg-amber-50 text-amber-900 border-amber-300', 'Activities whose name starts with "inst"'],
            ['construccion', 'Construction', HardHat, 'bg-emerald-600 border-emerald-600', 'bg-emerald-50 text-emerald-900 border-emerald-300', 'All other activities (not Procurement, Freight or Installation)'],
          ] as const).map(([k, etq, Icono, on, off, tt]) => {
            const activo = fases.has(k);
            return (
              <button key={k} title={tt} onClick={() => setFases(fs => { const n = new Set(fs); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
                className={`px-2 py-0.5 rounded border font-semibold flex items-center gap-1 cursor-pointer ${activo ? `${on} text-white` : off}`}>
                <Icono className="w-3 h-3" />{etq}
              </button>
            );
          })}
        </div>
        <span className="text-[#5A6A74] truncate min-w-0" title="Spread over the working time of each activity's calendar · periods follow the Gantt timescale">Spread over each activity&apos;s working calendar</span>
        <button onClick={onCerrar} className="ml-auto p-0.5 hover:bg-white rounded cursor-pointer" title="Close"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div ref={usoRef} className="flex-1 overflow-auto relative" onScroll={e => { const el = e.target as HTMLDivElement; setScrollTop(el.scrollTop); onScrollX(el.scrollLeft); }}>
        <div style={{ width: ancho + anchoGantt, height: filas.length * altoFila + 22, position: 'relative' }}>
          {/* Encabezado de períodos */}
          <div className="sticky top-0 z-20 flex bg-[#F5F8F9] border-b border-[#D5DEE2] text-[10px] font-semibold text-[#5A6A74]" style={{ height: 22 }}>
            <div className="sticky left-0 z-30 bg-[#F5F8F9] border-r border-[#D5DEE2] px-2 flex items-center" style={{ width: ancho }}>{medida === 'units' ? 'Units' : medida === 'cost' ? 'Cost' : vistaRec === 'crews' ? 'Crews (activities in progress)' : 'Personnel (persons/day)'}</div>
            <div className="relative" style={{ width: anchoGantt }}>
              {periodos.slice(0, -1).map((p, j) => (
                <div key={p.t} className="absolute top-0 bottom-0 border-l border-[#D5DEE2] pl-1 flex items-center overflow-hidden whitespace-nowrap" style={{ left: xDe(p.t), width: xDe(lim[j + 1]) - xDe(p.t) }}>{p.etq}</div>
              ))}
            </div>
          </div>
          <div className="absolute z-10 w-0.5 bg-[#CD0000]/60 pointer-events-none" style={{ left: ancho + xDatos, top: 22, height: filas.length * altoFila }} />
          {filas.slice(desdeF, hastaF).map((fl, k) => {
            const idx = desdeF + k;
            const top = 22 + idx * altoFila;
            let etq: React.ReactNode, fondo = '#FFFFFF', texto = '#14212A', datos: Record<SerieUso, Float64Array> | null = null;
            if (fl.tipo === 'wbs') {
              [fondo, texto] = colorBanda(fl.nivel);
              etq = <span className="font-bold truncate">{fl.nodo.codCompleto ? `${fl.nodo.codCompleto}  ` : ''}{fl.nodo.nombre}</span>;
              datos = totalNodo(fl.nodo);
            } else if (fl.tipo === 'act') {
              etq = <span className="truncate"><span className="font-mono text-[10px] mr-2">{fl.vt.cod}</span>{fl.vt.nombre}</span>;
              // Las actividades de otra fase se dejan en gris y sin valores
              if (pasaFase(fl.vt)) datos = { b: serieDeAct(fl.vt.i, 'b'), a: serieDeAct(fl.vt.i, 'a'), r: serieDeAct(fl.vt.i, 'r') };
              else texto = '#A3ADB3';
            } else {
              etq = <span className="truncate italic text-[#7A868D]"><span className="font-mono text-[10px] mr-2">{fl.a.activityId}</span>{fl.a.descripcion}</span>;
            }
            return (
              <div key={idx} className="absolute border-b border-[#E6EAEC] text-[10.5px]" style={{ top, height: altoFila, width: ancho + anchoGantt, background: fl.tipo === 'wbs' ? `${fondo}33` : undefined }}>
                <div className="sticky left-0 z-[5] h-full flex border-r border-[#D5DEE2]" style={{ width: ancho, background: fondo, color: texto }}>
                  <div className="flex-1 min-w-0 flex items-start pt-0.5 overflow-hidden" style={{ paddingLeft: 4 + fl.nivel * 10 }}>{etq}</div>
                  {datos && (
                    <div className="w-[104px] shrink-0 border-l border-black/10">
                      {series.map(sr => <div key={sr} className="px-1 whitespace-nowrap" style={{ height: SUB, lineHeight: `${SUB}px` }}>{NOMBRE_SERIE[sr]}</div>)}
                    </div>
                  )}
                </div>
                {datos && series.map((sr, j) => celdas(datos![sr], 2 + j * SUB, sr))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/** Sección con título de la ventana Group & Sort. */
const Seccion: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <div className="border border-[#C3C3C3] bg-white">
    <div className="px-2 py-1 font-bold bg-[#E8E8E8] border-b border-[#C3C3C3]">{titulo}</div>
    <div className="p-2">{children}</div>
  </div>
);

/** Ventana «Group & Sort» al estilo de P6: opciones de bandas, niveles de agrupación y colores. */
const DialogoGrupo: React.FC<{
  constructiva: boolean; niveles: CampoAgrupacion[]; opciones: OpcionesGrupo; paleta: [string, string][]; nombreRaiz: string; info: string[];
  onAplicar: (niveles: CampoAgrupacion[], opciones: OpcionesGrupo, paleta: [string, string][]) => void; onCerrar: () => void;
}> = ({ constructiva, niveles, opciones, paleta, nombreRaiz, info, onAplicar, onCerrar }) => {
  const [nv, setNv] = React.useState<CampoAgrupacion[]>(niveles);
  const [op, setOp] = React.useState<OpcionesGrupo>(opciones);
  const [pal, setPal] = React.useState<[string, string][]>(paleta);
  // Filas de la tabla Group By
  const filas: { etq: React.ReactNode; k?: CampoAgrupacion; j?: number }[] = constructiva
    ? [{ etq: 'Project' }, { etq: 'Location (02.Ubicacion)' }, ...nv.map((k, j) => ({ etq: etiquetaCampo(k), k, j }))]
    : [{ etq: `Project (${nombreRaiz})` }, ...Array.from({ length: 7 }, (_, j) => ({ etq: `WBS level ${j + 1}` }))];
  const color = (i: number) => pal[i] ?? bandaWbs(i);
  const ponerColor = (i: number, c: 0 | 1, v: string) => setPal(p => { const q = [...p]; while (q.length <= i) q.push(bandaWbs(q.length)); q[i] = c === 0 ? [v, q[i][1]] : [q[i][0], v]; return q; });
  const def = constructiva ? PALETAS_DEF.constr : PALETAS_DEF.wbs;
  const casilla = (k: keyof OpcionesGrupo, etq: string, sangria = false) => (
    <label className={`flex items-center gap-2 cursor-pointer ${sangria ? 'pl-6' : ''}`}>
      <input type="checkbox" checked={op[k]} onChange={e => setOp({ ...op, [k]: e.target.checked })} /> {etq}
    </label>
  );
  const botonP6 = 'w-full px-3 py-1.5 border border-[#B5B5B5] bg-[#F5F5F5] hover:bg-white rounded-sm flex items-center gap-2 cursor-pointer';
  return (
    <div className="fixed inset-0 z-[90] bg-black/30 flex items-center justify-center p-4" onClick={onCerrar}>
      <div className="w-[860px] max-w-full max-h-[90vh] overflow-auto bg-[#F0F0F0] border border-[#9A9A9A] shadow-2xl text-[11.5px] text-[#1A1A1A]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-3 py-1.5 bg-white border-b border-[#C3C3C3]">
          <b>Group and Sort{constructiva ? ' · Construction view' : ' · T₃ WBS'}</b>
          <button onClick={onCerrar} className="p-1 hover:bg-[#F0F0F0] rounded cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex gap-3 p-3">
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            <Seccion titulo="Display Options">
              <div className="flex flex-col gap-1.5">
                {casilla('totales', 'Show Group Totals (dates, BL finish variance and critical count on each band)')}
              </div>
            </Seccion>
            <Seccion titulo="Group By">
              <table className="w-full border-collapse">
                <thead><tr className="text-left text-[10.5px] text-[#3A3A3A] bg-[#F5F5F5]">
                  <th className="px-2 py-1 border border-[#D5D5D5]">Group By</th>
                  <th className="px-2 border border-[#D5D5D5] w-[220px]">Font &amp; Color</th>
                  {constructiva && <th className="px-2 border border-[#D5D5D5] w-[90px]"></th>}
                </tr></thead>
                <tbody>
                  {filas.map((f, i) => {
                    const [bg, tx] = color(i);
                    return (
                      <tr key={i}>
                        <td className="px-2 py-1 border border-[#D5D5D5]">
                          {f.k != null && f.j != null ? (
                            <select value={f.k} onChange={e => { const k = e.target.value as CampoAgrupacion; setNv(v => v.map((x, y) => (y === f.j ? k : x))); }} className="border border-[#B5B5B5] px-1 py-0.5 bg-white">
                              {CAMPOS_AGRUPACION.filter(c => c.k !== 'ubicacion' && (c.k === f.k || !nv.includes(c.k))).map(c => <option key={c.k} value={c.k}>{c.etq}</option>)}
                            </select>
                          ) : <span className="text-[#5A5A5A]">{f.etq}</span>}
                        </td>
                        <td className="px-2 py-1 border border-[#D5D5D5]">
                          <div className="flex items-center gap-1.5">
                            <span className="flex-1 px-2 py-0.5 font-bold truncate" style={{ background: bg, color: tx }}>{typeof f.etq === 'string' ? f.etq : 'Band'}</span>
                            <label title="Background color" className="cursor-pointer"><input type="color" value={bg} onChange={e => ponerColor(i, 0, e.target.value)} className="w-6 h-5 p-0 border-0 cursor-pointer" /></label>
                            <label title="Text color" className="cursor-pointer flex items-center"><span className="text-[10px] font-bold mr-0.5">A</span><input type="color" value={tx} onChange={e => ponerColor(i, 1, e.target.value)} className="w-6 h-5 p-0 border-0 cursor-pointer" /></label>
                          </div>
                        </td>
                        {constructiva && (
                          <td className="px-1 border border-[#D5D5D5] text-center whitespace-nowrap">
                            {f.j != null && <>
                              <button disabled={f.j === 0} title="Move up" onClick={() => setNv(v => { const c = [...v]; [c[f.j! - 1], c[f.j!]] = [c[f.j!], c[f.j! - 1]]; return c; })} className="px-1 disabled:opacity-30 cursor-pointer"><ArrowUp className="w-3.5 h-3.5 inline" /></button>
                              <button disabled={f.j === nv.length - 1} title="Move down" onClick={() => setNv(v => { const c = [...v]; [c[f.j!], c[f.j! + 1]] = [c[f.j! + 1], c[f.j!]]; return c; })} className="px-1 disabled:opacity-30 cursor-pointer"><ArrowDown className="w-3.5 h-3.5 inline" /></button>
                              <button disabled={nv.length <= 1} title="Remove level" onClick={() => setNv(v => v.filter((_, y) => y !== f.j))} className="px-1 text-red-600 disabled:opacity-30 cursor-pointer"><X className="w-3.5 h-3.5 inline" /></button>
                            </>}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {constructiva && nv.length < 6 && (
                <select value="" onChange={e => { const k = e.target.value as CampoAgrupacion; if (k) setNv(v => [...v, k]); }} className="mt-2 border border-[#B5B5B5] px-1 py-0.5 bg-white cursor-pointer">
                  <option value="">+ Add grouping level</option>
                  {CAMPOS_AGRUPACION.filter(c => c.k !== 'ubicacion' && !nv.includes(c.k)).map(c => <option key={c.k} value={c.k}>{c.etq}</option>)}
                </select>
              )}
            </Seccion>
            <Seccion titulo="Group By Options">
              <div className="flex flex-col gap-1.5">
                {casilla('ocultarVacios', 'Hide if empty (bands without activities)')}
                {!constructiva && casilla('alfabetico', 'Sort bands alphabetically')}
                <div className="text-[#5A5A5A] mt-1">Show:</div>
                {casilla('codigo', 'ID / Code', true)}
                {casilla('nombre', 'Name / Description', true)}
              </div>
            </Seccion>
            {!!info.length && <div className="text-[10.5px] text-[#5A6A74] leading-snug">{info.join(' · ')}</div>}
          </div>
          <div className="w-[120px] shrink-0 flex flex-col gap-1.5">
            <button className={botonP6} onClick={() => { onAplicar(nv, op, pal); onCerrar(); }}><span className="text-emerald-600 font-bold">✓</span> OK</button>
            <button className={botonP6} onClick={onCerrar}><span className="text-red-600 font-bold">⊘</span> Cancel</button>
            <div className="h-2" />
            <button className={botonP6} onClick={() => onAplicar(nv, op, pal)}><span className="text-[#312E81] font-bold">↻</span> Apply</button>
            <button className={botonP6} onClick={() => { setOp(OPC_GRUPO_DEF); setPal(def); if (constructiva) setNv(NIVELES_POR_DEFECTO); }}><span className="text-emerald-700 font-bold">▶</span> Default</button>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Cajas y filas del panel de actividad al estilo de P6. */
const Caja: React.FC<{ titulo: string; children: React.ReactNode; className?: string }> = ({ titulo, children, className }) => (
  <div className={`border border-[#C3C3C3] bg-[#F4F4F4] ${className ?? ''}`}>
    <div className="px-2 py-[3px] text-[11px] text-[#1A1A1A] border-b border-[#C3C3C3] bg-[#EAEAEA]">{titulo}</div>
    <div className="px-3 py-1.5 grid gap-[5px]">{children}</div>
  </div>
);
const Fila: React.FC<{ etq: React.ReactNode; children: React.ReactNode }> = ({ etq, children }) => (
  <div className="grid grid-cols-[112px_1fr] items-center gap-2 text-[11px] text-[#1A1A1A]"><span>{etq}</span>{children}</div>
);

/**
 * Campo de fecha que NO aplica el cambio mientras se navega por el calendario (las flechas de mes
 * cambian el valor): se aplica al salir del campo o con Enter. Escape lo deshace. Mientras hay una
 * fecha sin aplicar, el campo se ve en amarillo.
 */
const CampoFecha: React.FC<{ valor: string; disabled?: boolean; className?: string; permitirVacio?: boolean; onConfirmar: (v: string) => void }> = ({ valor, disabled, className, permitirVacio, onConfirmar }) => {
  const [v, setV] = React.useState(valor);
  React.useEffect(() => { setV(valor); }, [valor]);
  const pendiente = v !== valor;
  const confirmar = () => {
    if (v === valor) return;
    if (!v && !permitirVacio) { setV(valor); return; }
    onConfirmar(v);
  };
  return (
    <input type="date" value={v} disabled={disabled} onChange={e => setV(e.target.value)} onBlur={confirmar}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmar(); } if (e.key === 'Escape') setV(valor); }}
      title={pendiente ? 'Press Enter or leave the field to apply the date (Esc to undo)' : undefined}
      className={`${className ?? ''} ${pendiente ? '!border-[#E3A008] !bg-[#FFF8E1] !text-[#14212A]' : ''}`} />
  );
};

/** Iconos de la barra lateral (al estilo de P6). */
const IconoBarras = () => (
  <svg width="22" height="16" viewBox="0 0 22 16"><rect x="1" y="2" width="14" height="4" rx="1.5" fill="#2E9E3A" stroke="#1C6B25" /><rect x="6" y="9" width="15" height="4" rx="1.5" fill="#2E9E3A" stroke="#1C6B25" /></svg>
);
const IconoWbsLateral = () => (
  <svg width="22" height="16" viewBox="0 0 22 16"><rect x="2" y="1" width="11" height="8" fill="#2B5FD9" stroke="#1B3E91" /><rect x="8" y="6" width="11" height="8" fill="#3D7CF0" stroke="#1B3E91" /></svg>
);
const IconoRecursos = () => (
  <svg width="22" height="16" viewBox="0 0 22 16"><circle cx="8" cy="5" r="3.2" fill="#E8A33D" stroke="#9A6516" /><path d="M2 15 C2 10 14 10 14 15 Z" fill="#2E9E3A" stroke="#1C6B25" /><rect x="14" y="7" width="6" height="8" fill="#9FB8D9" stroke="#4A6A94" /></svg>
);
const IconoCritica: React.FC<{ activo: boolean }> = ({ activo }) => (
  <svg width="22" height="16" viewBox="0 0 22 16"><rect x="1" y="2" width="10" height="4" rx="1" fill={activo ? '#FFFFFF' : '#CD0000'} /><rect x="9" y="10" width="12" height="4" rx="1" fill={activo ? '#FFFFFF' : '#CD0000'} /><path d="M11 4 H13 V12 H9" fill="none" stroke={activo ? '#FFFFFF' : '#CD0000'} strokeWidth="1.2" /></svg>
);
const IconoLongest: React.FC<{ activo: boolean }> = ({ activo }) => (
  <svg width="22" height="16" viewBox="0 0 22 16"><path d="M2 8 H20" stroke={activo ? '#FFFFFF' : '#CD0000'} strokeWidth="3" strokeLinecap="round" /><path d="M16 4 L20 8 L16 12" fill="none" stroke={activo ? '#FFFFFF' : '#CD0000'} strokeWidth="2" /><circle cx="3" cy="8" r="2" fill={activo ? '#FFFFFF' : '#CD0000'} /></svg>
);

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
        <div className="flex items-center gap-2"><Plus className="w-4 h-4 text-[#312E81]" /><h3 className="text-sm font-bold">Add Activity</h3></div>
        <label className="block space-y-1"><span className="text-[#5A6A74]">WBS</span>
          <select value={wbsId} onChange={e => setWbsId(e.target.value)} className={inp}>
            {opciones.map(n => <option key={n.id} value={n.id}>{n.codCompleto} · {n.nombre}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="block space-y-1 col-span-1"><span className="text-[#5A6A74]">Activity ID</span>
            <input value={codigo} onChange={e => setCodigo(e.target.value)} className={inp} autoFocus required />
          </label>
          <label className="block space-y-1 col-span-2"><span className="text-[#5A6A74]">Activity Name</span>
            <input value={nombre} onChange={e => setNombre(e.target.value)} className={inp} required />
          </label>
          <label className="block space-y-1"><span className="text-[#5A6A74]">Activity Type</span>
            <select value={tipo} onChange={e => setTipo(e.target.value)} className={inp}>
              <option value="TT_Task">Task Dependent</option>
              <option value="TT_Mile">Start Milestone</option>
              <option value="TT_FinMile">Finish Milestone</option>
            </select>
          </label>
          <label className="block space-y-1"><span className="text-[#5A6A74]">Original Duration (d)</span>
            <input type="number" min="0" step="0.5" value={tipo === 'TT_Task' ? diasDur : '0'} disabled={tipo !== 'TT_Task'} onChange={e => setDiasDur(e.target.value)} className={inp} />
          </label>
          <div />
          <label className="block space-y-1 col-span-3 sm:col-span-1"><span className="text-[#5A6A74]">Predecessor (FS, optional)</span>
            <input value={pred} onChange={e => setPred(e.target.value)} placeholder="ID" className={inp} />
          </label>
          <label className="block space-y-1 col-span-3 sm:col-span-1"><span className="text-[#5A6A74]">Successor (FS, optional)</span>
            <input value={succ} onChange={e => setSucc(e.target.value)} placeholder="ID" className={inp} />
          </label>
        </div>
        <p className="text-[11px] text-[#5A6A74]">It is added as «Not Started» with the calendar of its WBS. Dates are calculated when you press «Schedule (F9)». Relationships can be adjusted later in its tab.</p>
        {error && <p className="text-[11.5px] text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancelar} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 cursor-pointer">Cancel</button>
          <button type="submit" className="px-3 py-1.5 rounded-lg bg-[#312E81] text-white font-bold cursor-pointer">Add Activity</button>
        </div>
      </form>
    </div>
  );
};

/** Panel inferior con los detalles de la actividad (como el de P6). */
const PanelActividad: React.FC<{
  m: ModeloP6; i: number; editable: boolean; cambios: Cambio[]; version: number;
  onCambio: (log: Cambio[]) => void; onCerrar: () => void; onEliminar: () => void; onNavegar: (dir: 1 | -1) => void;
  nombreWbs: string; onIr: (i: number) => void;
}> = ({ m, i, editable, cambios, version, onCambio, onCerrar, onEliminar, onNavegar, nombreWbs, onIr }) => {
  const [pest, setPest] = React.useState<'general' | 'estado' | 'recursos' | 'relaciones' | 'notas' | 'cambios' | 'udf'>('estado');
  const [udfBusca, setUdfBusca] = React.useState('');
  const [udfSoloConValor, setUdfSoloConValor] = React.useState(false);
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

  // Relaciones conductoras («Driving» de P6) y holgura de cada relación, con las fechas que muestra el cronograma
  const holgurasRel = React.useMemo(() => {
    const out = new Map<number, number | null>(); // fila de TASKPRED → holgura en horas (≤ 0 = conductora)
    if (pest !== 'relaciones' || !rels.length) return out;
    const { acts } = entradasCpm(m);
    const ssTemprano = lagSsDesdeInicioTemprano(m);
    const fecha = (k: number, c: string) => aMinutos(celda(t, t.filas[k], c)) ?? undefined;
    const usar = new Set<number>([i, ...rels.map(x => x.otra)]);
    for (const k of usar) {
      const a = acts[k];
      if (a.estado === 'Terminada') { a.ES = fecha(k, 'act_start_date') ?? fecha(k, 'early_start_date'); a.EF = fecha(k, 'act_end_date') ?? fecha(k, 'early_end_date'); }
      else { a.ES = fecha(k, 'early_start_date'); a.EF = fecha(k, 'early_end_date'); }
      // Base de los SS/SF como en el motor (P6: «SS lag from Early Start» en actividades en curso)
      if (a.estado === 'EnCurso' && ssTemprano && a.inicioReal != null) { a.inicioSS = a.ES; a.lagConsumido = a.cal.entre(a.inicioReal, Math.max(a.inicioReal, m.fechaDatos)); }
    }
    for (const x of rels) {
      const rel = { pred: x.rol === 'pred' ? x.otra : i, succ: x.rol === 'pred' ? i : x.otra, tipo: x.tipo as TipoRel, lag: x.lag * 60 };
      const h = holguraRelacion(acts, rel);
      out.set(x.fila, h == null ? null : h / 60);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, i, version, pest, rels]);

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

  // Valores al estilo de la pestaña «Status» de P6
  const num = (c: string) => Number(g(c)) || 0;
  const d = (h: number) => dias(h, hd);
  const actIni = aMinutos(g('act_start_date')), actFin = aMinutos(g('act_end_date'));
  const durReal = actIni != null && cal ? cal.entre(actIni, estado === 'TK_Complete' && actFin != null ? actFin : Math.max(actIni, m.fechaDatos)) / 60 : 0;
  const durRest = estado === 'TK_Complete' ? 0 : num('remain_drtn_hr_cnt');
  const proyecto = (() => { const pj = m.xer.tablas.get('PROJECT'); return pj?.filas[0] ? celda(pj, pj.filas[0], 'proj_short_name') : ''; })();
  const memos = React.useMemo(() => {
    const tm = m.xer.tablas.get('TASKMEMO');
    const mt = m.xer.tablas.get('MEMOTYPE');
    const tipos = new Map((mt?.filas || []).map(fr => [celda(mt!, fr, 'memo_type_id'), celda(mt!, fr, 'memo_type')]));
    const limpiar = (h: string) => h.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\x7f\x7f/g, '\n').trim();
    return (tm?.filas || []).filter(fr => celda(tm!, fr, 'task_id') === g('task_id')).map(fr => ({ tipo: tipos.get(celda(tm!, fr, 'memo_type_id')) || 'Note', texto: limpiar(celda(tm!, fr, 'task_memo')) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, i, version]);
  const udfs = React.useMemo(() => udfsDeActividad(m, i),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m, i, version]);
  const fechaPorDefecto = (campoTemprano: string, hora: string) => {
    // Al marcar «Comenzada/Terminada», P6 propone la fecha temprana (sin pasar de la fecha de datos)
    const t0 = aMinutos(g(campoTemprano));
    const v = t0 != null && t0 <= m.fechaDatos ? t0 : m.fechaDatos;
    return `${aTexto(v).slice(0, 10)} ${hora}`;
  };

  // Estilo P6: cajas grises con título y campos blancos
  const caja = 'h-[22px] w-full border border-[#A9A9A9] bg-white px-1.5 text-[11px] text-[#1A1A1A] outline-none focus:border-[#3C7DE0] disabled:bg-[#F3F3F3] disabled:text-[#6B6B6B]';
  const soloLectura = 'h-[22px] w-full border border-[#BDBDBD] bg-[#EFEFEF] px-1.5 text-[11px] text-[#1A1A1A] flex items-center truncate';
  const tabsP6: [typeof pest, string][] = [['general', 'General'], ['estado', 'Status'], ['recursos', `Resources (${asignaciones.length})`], ['relaciones', `Relationships (${rels.length})`], ['notas', `Notebook (${memos.length})`], ['cambios', `Changes (${cambios.length})`], ['udf', `User Defined (${udfs.filter(u => u.valor !== '').length})`]];

  return (
    <div className="h-[318px] shrink-0 bg-[#F0F0F0] border-t-2 border-[#9A9A9A] flex flex-col">
      {/* Pestañas como en P6 */}
      <div className="flex items-end gap-0 px-1 pt-1 border-b border-[#B5B5B5] bg-[#E1E1E1] text-[11px]">
        {tabsP6.map(([k, etq]) => (
          <button key={k} onClick={() => setPest(k)}
            className={`px-2.5 py-[3px] border border-b-0 -mb-px cursor-pointer ${pest === k ? 'bg-[#F0F0F0] border-[#B5B5B5] text-[#1A1A1A] font-semibold' : 'bg-[#E1E1E1] border-transparent text-[#3A3A3A] hover:bg-[#EBEBEB]'}`}>{etq}</button>
        ))}
        <div className="ml-auto flex items-center gap-1 pb-0.5">
          {editable && (
            <button onClick={onEliminar} className="px-2 py-0.5 rounded text-red-700 hover:bg-red-50 flex items-center gap-1 cursor-pointer" title="Delete this activity">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
          <button onClick={onCerrar} className="p-1 hover:bg-white rounded cursor-pointer" title="Close"><X className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {/* Cabecera: actividad, nombre y proyecto */}
      <div className="flex items-center gap-3 px-2 py-1.5 text-[11px] text-[#1A1A1A]" key={`cab-${i}-${version}`}>
        <div className="flex flex-col border border-[#A9A9A9] bg-[#F7F7F7]">
          <button onClick={() => onNavegar(-1)} title="Previous activity" className="px-3 leading-[10px] text-[9px] hover:bg-white cursor-pointer">▲</button>
          <button onClick={() => onNavegar(1)} title="Next activity" className="px-3 leading-[10px] text-[9px] hover:bg-white cursor-pointer border-t border-[#D0D0D0]">▼</button>
        </div>
        <span>Activity</span>
        <div className={`${soloLectura} !w-[230px] font-mono`}>{g('task_code')}</div>
        <input className={`${caja} !w-auto flex-1 min-w-[200px]`} disabled={!editable} defaultValue={g('task_name')} title="Activity name"
          onBlur={e => e.target.value !== g('task_name') && editar({ nombre: e.target.value })}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
        <span className="ml-4">Project</span>
        <div className={`${soloLectura} !w-[260px]`}>{proyecto}</div>
      </div>
      <div className="flex-1 overflow-auto px-2 pb-2">
        {pest === 'estado' && (
          <div className="grid grid-cols-[minmax(260px,1fr)_minmax(560px,2.2fr)_minmax(260px,1fr)] gap-2 h-full" key={`${i}-${version}`}>
            <div className="flex flex-col gap-2">
              <Caja titulo={`Duration (days of ${hd} h)`}>
                <Fila etq="Original">
                  <input type="number" step="0.5" min="0" className={`${caja} text-right`} disabled={!editable || estado === 'TK_Complete'} defaultValue={num('target_drtn_hr_cnt') / hd}
                    onBlur={e => { const v = Number(e.target.value) * hd; if (v !== num('target_drtn_hr_cnt')) editar({ durOriginal: v }); }} />
                </Fila>
                <Fila etq="Actual"><div className={`${soloLectura} justify-end`}>{d(durReal)}</div></Fila>
                <Fila etq="Remaining">
                  <input type="number" step="0.5" min="0" className={`${caja} text-right`} disabled={!editable || estado === 'TK_Complete'} defaultValue={durRest / hd}
                    onBlur={e => { const v = Number(e.target.value) * hd; if (v !== num('remain_drtn_hr_cnt')) editar({ durRestante: v }); }} />
                </Fila>
                <Fila etq="At Complete"><div className={`${soloLectura} justify-end`}>{d(durReal + durRest)}</div></Fila>
              </Caja>
              <Caja titulo="Float (days)">
                <Fila etq="Total Float"><div className={`${soloLectura} justify-end`}>{g('total_float_hr_cnt') === '' || estado === 'TK_Complete' ? '' : d(num('total_float_hr_cnt'))}</div></Fila>
                <Fila etq="Free Float"><div className={`${soloLectura} justify-end`}>{g('free_float_hr_cnt') === '' || estado === 'TK_Complete' ? '' : d(num('free_float_hr_cnt'))}</div></Fila>
              </Caja>
            </div>
            <div className="flex flex-col gap-2">
              <Caja titulo={`Status · ${ESTADO_TXT[estado] || estado}`}>
                <div className="grid grid-cols-2 gap-x-6 gap-y-[5px]">
                  <Fila etq={<label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" disabled={!editable} checked={!!g('act_start_date')}
                    onChange={e => editar({ inicioReal: e.target.checked ? fechaPorDefecto('early_start_date', '08:00') : null, ...(e.target.checked ? {} : { finReal: null }) })} /> Started</label>}>
                    <CampoFecha className={caja} disabled={!editable || !g('act_start_date')} valor={fechaInput(g('act_start_date'))}
                      onConfirmar={v => editar({ inicioReal: `${v} 08:00` })} />
                  </Fila>
                  <Fila etq="Physical %">
                    <input type="number" min="0" max="100" step="1" className={`${caja} text-right`} disabled={!editable} defaultValue={Math.round(num('phys_complete_pct') * 10) / 10}
                      onBlur={e => { const v = Number(e.target.value); if (v !== num('phys_complete_pct')) editar({ avance: v }); }} />
                  </Fila>
                  <Fila etq={<label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" disabled={!editable || !g('act_start_date')} checked={!!g('act_end_date')}
                    onChange={e => editar({ finReal: e.target.checked ? fechaPorDefecto('early_end_date', '16:00') : null })} /> Finished</label>}>
                    <CampoFecha className={caja} disabled={!editable || !g('act_end_date')} valor={fechaInput(g('act_end_date'))}
                      onConfirmar={v => editar({ finReal: `${v} 16:00` })} />
                  </Fila>
                  <Fila etq="Suspend"><div className={soloLectura}>{fNum(aMinutos(g('suspend_date')))}</div></Fila>
                  <Fila etq="Exp Finish"><div className={soloLectura}>{fNum(aMinutos(g('expect_end_date')))}</div></Fila>
                  <Fila etq="Resume"><div className={soloLectura}>{fNum(aMinutos(g('resume_date')))}</div></Fila>
                </div>
              </Caja>
              <Caja titulo="Constraints">
                <div className="grid grid-cols-2 gap-x-6 gap-y-[5px]">
                  <Fila etq="Primary">
                    <select className={caja} disabled={!editable} defaultValue={g('cstr_type')}
                      onChange={e => editar({ restriccion: e.target.value ? { tipo: e.target.value, fecha: g('cstr_date') || aTexto(m.fechaDatos) } : null })}>
                      {RESTRICCIONES.map(([v, l]) => <option key={v} value={v}>{v ? l : '< None >'}</option>)}
                    </select>
                  </Fila>
                  <Fila etq="Secondary">
                    <select className={caja} disabled defaultValue={g('cstr_type2')}>
                      <option value="">{'< None >'}</option>
                      {RESTRICCIONES.filter(([v]) => v).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      {g('cstr_type2') && !RESTRICCIONES.some(([v]) => v === g('cstr_type2')) && <option value={g('cstr_type2')}>{g('cstr_type2')}</option>}
                    </select>
                  </Fila>
                  <Fila etq="Date">
                    <CampoFecha className={caja} disabled={!editable || !g('cstr_type') || g('cstr_type') === 'CS_ALAP'} valor={fechaInput(g('cstr_date'))}
                      onConfirmar={v => editar({ restriccion: { tipo: g('cstr_type'), fecha: `${v} ${g('cstr_type').startsWith('CS_ME') ? '16:00' : '08:00'}` } })} />
                  </Fila>
                  <Fila etq="Date"><div className={soloLectura}>{fNum(aMinutos(g('cstr_date2')))}</div></Fila>
                </div>
              </Caja>
            </div>
            <Caja titulo="Labor Units (h)" className="self-start">
              {[['Budgeted', num('target_work_qty')], ['Actual', num('act_work_qty')], ['Remaining', num('remain_work_qty')], ['At Complete', num('act_work_qty') + num('remain_work_qty')]].map(([etq, v]) => (
                <Fila key={etq as string} etq={etq}><div className={`${soloLectura} justify-end`}>{(v as number).toLocaleString('en-US', { maximumFractionDigits: 2 })}</div></Fila>
              ))}
            </Caja>
          </div>
        )}
        {pest === 'general' && (
          <div className="grid grid-cols-3 gap-2" key={`g-${i}-${version}`}>
            <Caja titulo="Activity">
              <Fila etq="Activity Type">{<div className={soloLectura}>{({ TT_Task: 'Task Dependent', TT_Rsrc: 'Resource Dependent', TT_Mile: 'Start Milestone', TT_FinMile: 'Finish Milestone', TT_LOE: 'Level of Effort', TT_WBS: 'WBS Summary' } as Record<string, string>)[g('task_type')] || g('task_type')}</div>}</Fila>
              <Fila etq="Duration Type"><div className={soloLectura}>{({ DT_FixedDUR2: 'Fixed Duration and Units', DT_FixedDrtn: 'Fixed Duration and Units/Time', DT_FixedQty: 'Fixed Units', DT_FixedRate: 'Fixed Units/Time' } as Record<string, string>)[g('duration_type')] || g('duration_type')}</div></Fila>
              <Fila etq="% Complete Type"><div className={soloLectura}>{({ CP_Phys: 'Physical', CP_Drtn: 'Duration', CP_Units: 'Units' } as Record<string, string>)[g('complete_pct_type')] || g('complete_pct_type')}</div></Fila>
              <Fila etq="Calendar"><div className={soloLectura} title={cal?.nombre}>{cal?.nombre || '—'}</div></Fila>
            </Caja>
            <Caja titulo="WBS">
              <Fila etq="WBS"><div className={soloLectura} title={nombreWbs}>{nombreWbs}</div></Fila>
              <Fila etq="Critical"><div className={soloLectura}>{g('driving_path_flag') === 'Y' ? 'On the Longest Path' : (g('total_float_hr_cnt') !== '' && num('total_float_hr_cnt') <= 0 && estado !== 'TK_Complete') ? 'Critical (Total Float ≤ 0)' : 'Not critical'}</div></Fila>
              <Fila etq="Added"><div className={soloLectura}>{fNum(aMinutos(g('create_date')))}{g('create_user') ? ` · ${g('create_user')}` : ''}</div></Fila>
              <Fila etq="Last Modified"><div className={soloLectura}>{fNum(aMinutos(g('update_date')))}{g('update_user') ? ` · ${g('update_user')}` : ''}</div></Fila>
            </Caja>
            <Caja titulo="Dates">
              <Fila etq="Early Start / Finish"><div className={soloLectura}>{fNum(aMinutos(g('early_start_date')))} → {fNum(aMinutos(g('early_end_date')))}</div></Fila>
              <Fila etq="Late Start / Finish"><div className={soloLectura}>{fNum(aMinutos(g('late_start_date')))} → {fNum(aMinutos(g('late_end_date')))}</div></Fila>
              <Fila etq="Planned"><div className={soloLectura}>{fNum(aMinutos(g('target_start_date')))} → {fNum(aMinutos(g('target_end_date')))}</div></Fila>
              <Fila etq="Actual"><div className={soloLectura}>{fNum(actIni)}{actFin != null ? ` → ${fNum(actFin)}` : ''}</div></Fila>
            </Caja>
          </div>
        )}
        {pest === 'udf' && (
          <div className="flex flex-col gap-1.5 text-[11px]" key={`udf-${i}-${version}`}>
            <div className="flex items-center gap-3">
              <input value={udfBusca} onChange={e => setUdfBusca(e.target.value)} placeholder="Find field…" className={`${caja} !w-56`} />
              <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={udfSoloConValor} onChange={e => setUdfSoloConValor(e.target.checked)} /> With value only</label>
              <span className="text-[#5A6A74]">{udfs.length} activity user defined fields{editable ? ' · saved when you leave the field' : ''}</span>
            </div>
            <table className="w-full border-collapse bg-white border border-[#C3C3C3]">
              <thead className="bg-[#EAEAEA] text-[10.5px] text-[#3A3A3A] text-left sticky top-0">
                <tr><th className="px-2 py-1 border-b border-[#C3C3C3] w-[38%]">Field</th><th className="px-2 border-b border-[#C3C3C3] w-[14%]">Type</th><th className="px-2 border-b border-[#C3C3C3]">Value</th></tr>
              </thead>
              <tbody>
                {udfs.filter(u => (!udfSoloConValor || u.valor !== '') && (!udfBusca || u.etiqueta.toLowerCase().includes(udfBusca.toLowerCase()))).map(u => {
                  const guardar = (nuevo: string) => {
                    if (nuevo === u.valor) return;
                    const l = log();
                    const err = ponerUdf(m, i, u.id, nuevo, l);
                    if (err) window.alert(err); else onCambio(l);
                  };
                  const esFecha = u.tipo === 'FT_START_DATE' || u.tipo === 'FT_END_DATE';
                  const esNum = u.tipo === 'FT_FLOAT_2_DECIMALS' || u.tipo === 'FT_INT' || u.tipo === 'FT_MONEY';
                  return (
                    <tr key={u.id} className="border-t border-[#ECECEC] hover:bg-[#F7F9FA]">
                      <td className="px-2 py-0.5">{u.etiqueta}</td>
                      <td className="px-2 text-[#5A6A74]">{TIPOS_UDF[u.tipo] || u.tipo}</td>
                      <td className="px-2 py-0.5">
                        {u.tipo === 'FT_STATICTYPE' ? (
                          <select className={`${caja} !w-48`} disabled={!editable} defaultValue={u.valor} onChange={e => guardar(e.target.value)}>
                            <option value="">—</option>
                            {Object.entries(INDICADORES_UDF).map(([k, etq]) => <option key={k} value={k}>{etq}</option>)}
                          </select>
                        ) : esFecha ? (
                          <CampoFecha className={`${caja} !w-48`} disabled={!editable} valor={u.valor.slice(0, 10)} permitirVacio
                            onConfirmar={v => guardar(v ? `${v} ${u.tipo === 'FT_END_DATE' ? '16:00' : '08:00'}` : '')} />
                        ) : (
                          <input className={`${caja} ${esNum ? '!w-48 text-right' : ''}`} disabled={!editable} defaultValue={u.valor} inputMode={esNum ? 'decimal' : undefined}
                            onBlur={e => guardar(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!udfs.length && <tr><td colSpan={3} className="text-center text-[#5A6A74] py-4">This XER has no activity user defined fields.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {pest === 'notas' && (
          <div className="grid gap-2 text-[11.5px]">
            {memos.map((mm, k) => (
              <Caja key={k} titulo={mm.tipo}><div className="whitespace-pre-wrap text-[#1A1A1A]">{mm.texto || '(empty)'}</div></Caja>
            ))}
            {!memos.length && <div className="text-center text-[#5A6A74] py-6">This activity has no notebook topics in the XER.</div>}
          </div>
        )}
        {pest === 'relaciones' && (
          <div className="grid md:grid-cols-2 gap-4 text-[11.5px]">
            {(['pred', 'succ'] as const).map(rol => (
              <div key={rol}>
                <div className="font-bold text-[#312E81] mb-1">{rol === 'pred' ? 'Predecessors' : 'Successors'}</div>
                <table className="w-full">
                  <thead><tr className="text-[10px] text-[#5A6A74] text-left"><th>Activity ID</th><th>Activity Name</th><th>Type</th><th>Lag (d)</th>
                    <th className="text-center" title="Driving: the relationship that sets the successor's date">Driving</th>
                    <th className="text-right pr-2" title="Relationship free float: how many days the predecessor could slip without moving the successor">Rel. Float (d)</th><th></th></tr></thead>
                  <tbody>
                    {rels.filter(r => r.rol === rol).map(r => {
                      const h = holgurasRel.get(r.fila);
                      const conduce = h != null && h <= 0.01;
                      return (
                      <tr key={`${r.fila}-${version}`} className={`border-t border-[#F0F2F4] ${conduce ? 'bg-[#FDECEC]' : ''}`}>
                        <td className="font-mono text-[10px] pr-2 whitespace-nowrap">
                          <button onClick={() => onIr(r.otra)} title={`Go to ${celda(t, t.filas[r.otra], 'task_code')}`}
                            className="inline-flex items-center justify-center w-4 h-4 mr-1 rounded border border-[#C9CDEB] text-[#312E81] hover:bg-[#312E81] hover:text-white cursor-pointer align-middle">
                            <ArrowRight className="w-2.5 h-2.5" />
                          </button>
                          {celda(t, t.filas[r.otra], 'task_code')}
                        </td>
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
                        <td className="text-center">{conduce ? <span className="inline-flex items-center gap-1 px-1.5 rounded bg-[#CD0000] text-white text-[10px] font-bold" title="This relationship drives the date">✓ Yes</span> : h == null ? <span className="text-[#9AA6AD]" title="Not applicable (completed activity, LOE or relationship without effect)">—</span> : ''}</td>
                        <td className={`text-right pr-2 ${conduce ? 'text-[#CD0000] font-bold' : ''}`}>{h == null ? '' : dias(Math.max(0, h), hd)}</td>
                        <td>{editable && <button className="text-red-600 hover:underline cursor-pointer" onClick={() => { const l = log(); eliminarRelacion(m, r.fila, l); onCambio(l); }}>Remove</button>}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
            {editable && (
              <div className="md:col-span-2 flex items-center gap-2 flex-wrap bg-[#F5F8F9] rounded-lg p-2">
                <span className="font-semibold">Assign</span>
                <select value={nuevoRol} onChange={e => setNuevoRol(e.target.value as any)} className="border border-[#D5DEE2] rounded px-1 py-0.5">
                  <option value="pred">predecessor</option><option value="succ">successor</option>
                </select>
                <input value={nuevoCod} onChange={e => setNuevoCod(e.target.value)} placeholder="Activity ID" className="border border-[#D5DEE2] rounded px-1.5 py-0.5 w-40" />
                <select value={nuevoTipo} onChange={e => setNuevoTipo(e.target.value)} className="border border-[#D5DEE2] rounded px-1 py-0.5">
                  {['FS', 'SS', 'FF', 'SF'].map(x => <option key={x}>{x}</option>)}
                </select>
                <input type="number" step="0.5" value={nuevoLag} onChange={e => setNuevoLag(e.target.value)} className="border border-[#D5DEE2] rounded px-1.5 py-0.5 w-20" title="Lag in days" />
                <span className="text-[#5A6A74]">days</span>
                <button className="px-2.5 py-1 rounded bg-[#312E81] text-white font-bold cursor-pointer" onClick={() => {
                  const l = log();
                  let err: string | null;
                  if (nuevoRol === 'pred') err = agregarRelacion(m, nuevoCod, i, nuevoTipo, Number(nuevoLag) * hd, l);
                  else {
                    const otra = t.filas.findIndex(fr => celda(t, fr, 'task_code').toLowerCase() === nuevoCod.trim().toLowerCase());
                    err = otra < 0 ? `Activity ${nuevoCod} does not exist.` : agregarRelacion(m, g('task_code'), otra, nuevoTipo, Number(nuevoLag) * hd, l);
                  }
                  if (err) window.alert(err); else { setNuevoCod(''); onCambio(l); }
                }}>Assign</button>
              </div>
            )}
          </div>
        )}
        {pest === 'recursos' && (
          <table className="w-full text-[11.5px]">
            <thead><tr className="text-[10px] text-[#5A6A74] text-right"><th className="text-left">Resource</th><th>Budgeted Units</th><th>Actual Units</th><th>Remaining Units</th><th>Budgeted Cost</th><th>Actual Cost</th><th>Remaining Cost</th></tr></thead>
            <tbody>
              {asignaciones.map((a, k) => (
                <tr key={k} className="border-t border-[#F0F2F4] text-right">
                  <td className="text-left font-semibold">{a.recurso}</td>
                  <td>{a.qP.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td><td>{a.qR.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td><td>{a.qF.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                  <td>{dinero(a.cP)}</td><td className="text-[#2B7F52]">{dinero(a.cR)}</td><td>{dinero(a.cF)}</td>
                </tr>
              ))}
              {!asignaciones.length && <tr><td colSpan={7} className="text-center text-[#5A6A74] py-4">No resources assigned.</td></tr>}
            </tbody>
          </table>
        )}
        {pest === 'cambios' && (
          <table className="w-full text-[11px]">
            <thead><tr className="text-[10px] text-[#5A6A74] text-left"><th>Activity</th><th>Field</th><th>Before</th><th>After</th></tr></thead>
            <tbody>
              {[...cambios].reverse().map((c, k) => (
                <tr key={k} className="border-t border-[#F0F2F4]"><td className="font-mono">{c.actividad}</td><td>{c.campo}</td><td className="text-[#5A6A74]">{c.antes}</td><td className="font-semibold">{c.despues}</td></tr>
              ))}
              {!cambios.length && <tr><td colSpan={4} className="text-center text-[#5A6A74] py-4">No changes since the last save.</td></tr>}
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
  if (!d) return <div className="flex-1 flex items-center justify-center text-sm text-[#5A6A74]">The XER has no resource assignments.</div>;
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
          <span>Budgeted: <b>{dinero(tot.pres)}</b></span>
          <span>Actual: <b className="text-[#2C67A6]">{dinero(tot.real)}</b></span>
          <span>Remaining: <b className="text-[#2B7F52]">{dinero(tot.rest)}</b></span>
          <span>At Completion: <b>{dinero(tot.real + tot.rest)}</b></span>
        </div>
      </div>
      <div className="overflow-x-auto border border-[#D5DEE2] rounded-lg">
        <svg width={W} height={H + 40} className="block">
          {d.meses.map(([k, v], j) => {
            const x = j * bw;
            const hR = (v.real / max) * H, hF = (v.rest / max) * H;
            return (
              <g key={k}>
                <rect x={x + 1} y={H - hR} width={Math.max(1, bw - 2)} height={hR} fill="#2C67A6"><title>{`${k} · actual ${dinero(v.real)}`}</title></rect>
                <rect x={x + 1} y={H - hR - hF} width={Math.max(1, bw - 2)} height={hF} fill="#2B7F52"><title>{`${k} · remaining ${dinero(v.rest)}`}</title></rect>
                {k.endsWith('-01') && <text x={x + 2} y={H + 14} fontSize="10" fill="#5A6A74">{k.slice(0, 4)}</text>}
                {k === hoy && <line x1={x} x2={x} y1={0} y2={H} stroke="#CD0000" strokeDasharray="3 3" />}
              </g>
            );
          })}
          <polyline fill="none" stroke="#14212A" strokeWidth="1.5" points={acum.map((a, j) => `${j * bw + bw / 2},${H - (a.acR / maxAc) * H}`).join(' ')} />
          <polyline fill="none" stroke="#A86B12" strokeWidth="1.5" strokeDasharray="4 3" points={acum.map((a, j) => `${j * bw + bw / 2},${H - (a.acP / maxAc) * H}`).join(' ')} />
          <g fontSize="10" fill="#5A6A74">
            <rect x={8} y={H + 22} width={10} height={8} fill="#2C67A6" /><text x={22} y={H + 30}>Actual per month</text>
            <rect x={110} y={H + 22} width={10} height={8} fill="#2B7F52" /><text x={124} y={H + 30}>Remaining per month (per schedule)</text>
            <line x1={345} x2={365} y1={H + 26} y2={H + 26} stroke="#14212A" strokeWidth="1.5" /><text x={370} y={H + 30}>Cumulative actual + remaining</text>
            <line x1={520} x2={540} y1={H + 26} y2={H + 26} stroke="#A86B12" strokeDasharray="4 3" /><text x={545} y={H + 30}>Cumulative budgeted</text>
          </g>
        </svg>
      </div>
      <p className="text-[11px] text-[#5A6A74] mt-2">
        Each assignment is spread evenly over its dates: budgeted over its planned dates, actual between the actual start and actual finish (or the data date), and remaining over the activity's early dates. After rescheduling (F9), the remaining curve shows the new cash flow.
      </p>
    </div>
  );
};
