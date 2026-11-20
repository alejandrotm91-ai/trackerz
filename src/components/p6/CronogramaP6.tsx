/**
 * Cronograma P6: abre el XER de Primavera dentro de Trakciona, como un programa.
 * Tabla de actividades por WBS + Gantt, edición de fechas, avance, duraciones, restricciones y
 * relaciones, programación (F9) con el motor CPM, vista de recursos y exportación del XER.
 * Todos consultan; solo el administrador edita, programa y guarda.
 */
import React from 'react';
import { ChevronDown, ChevronRight, Download, Upload, Save, Play, X, Search, Calendar, Layers, BarChart3 } from 'lucide-react';
import { leerXer, escribirXer, codificarXer, decodificarXer, celda } from '../../utils/p6/xer';
import { crearModelo, type ModeloP6 } from '../../utils/p6/modelo';
import { aMinutos, aTexto } from '../../utils/p6/calendario';
import { programarYEscribir, editarActividad, agregarRelacion, editarRelacion, eliminarRelacion, ponerFechaDatos, type Cambio, type EdicionActividad } from '../../utils/p6/edicion';
import { guardarXerEnNube, leerXerDeNube, type MetaXer } from '../../utils/p6/xerNube';

const FILA = 22;
const ANCHO_IZQ = 760;
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
}
interface Nodo {
  id: string; padre: string; cod: string; nombre: string; seq: number;
  hijos: Nodo[]; tareas: Vt[]; nivel: number;
  ini: number | null; fin: number | null; n: number; criticas: number;
}
type Fila = { tipo: 'wbs'; nodo: Nodo; nivel: number } | { tipo: 'act'; vt: Vt; nivel: number };

export const CronogramaP6: React.FC<{ isAdmin: boolean; username?: string; onClose: () => void }> = ({ isAdmin, username, onClose }) => {
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
  const [abiertos, setAbiertos] = React.useState<Set<string>>(new Set());
  const [filtro, setFiltro] = React.useState('');
  const [filtroTmp, setFiltroTmp] = React.useState('');
  const [filtroEstado, setFiltroEstado] = React.useState<'todas' | 'pendientes' | 'criticas' | 'encurso'>('todas');
  const [vista, setVista] = React.useState<'actividades' | 'recursos'>('actividades');
  const [px, setPx] = React.useState(1);
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
      return {
        i, id: g('task_id'), cod: g('task_code'), nombre: g('task_name'), wbs: g('wbs_id'), estado, tipo: g('task_type'),
        durO: Number(g('target_drtn_hr_cnt')) || 0, durR: Number(g('remain_drtn_hr_cnt')) || 0, hd: cal?.horasDia || 8,
        ini: estado !== 'TK_NotStart' && as != null ? as : es,
        fin: estado === 'TK_Complete' && af != null ? af : ef,
        iniA: estado !== 'TK_NotStart' && as != null, finA: estado === 'TK_Complete' && af != null,
        resto: estado === 'TK_Active' ? es : null,
        tf: tf === '' || estado === 'TK_Complete' ? null : Number(tf),
        avance: Number(g('phys_complete_pct')) || 0, cstr: g('cstr_type'),
      };
    });
  }, [m, version]);

  const arbol = React.useMemo(() => {
    const nodos = new Map<string, Nodo>();
    if (!m) return { raices: [] as Nodo[], nodos };
    const w = m.xer.tablas.get('PROJWBS');
    for (const f of w?.filas || []) {
      const g = (c: string) => celda(w!, f, c);
      nodos.set(g('wbs_id'), { id: g('wbs_id'), padre: g('parent_wbs_id'), cod: g('wbs_short_name'), nombre: g('wbs_name'), seq: Number(g('seq_num')) || 0, hijos: [], tareas: [], nivel: 0, ini: null, fin: null, n: 0, criticas: 0 });
    }
    const raices: Nodo[] = [];
    for (const n of nodos.values()) {
      const p = nodos.get(n.padre);
      if (p) p.hijos.push(n); else raices.push(n);
    }
    for (const v of vts) nodos.get(v.wbs)?.tareas.push(v);
    const natural = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true });
    const resumir = (n: Nodo, nivel: number) => {
      n.nivel = nivel;
      n.hijos.sort((a, b) => a.seq - b.seq || natural(a.cod, b.cod));
      n.tareas.sort((a, b) => (a.ini ?? 0) - (b.ini ?? 0) || natural(a.cod, b.cod));
      let ini: number | null = null, fin: number | null = null, cnt = 0, crit = 0;
      const sumar = (i2: number | null, f2: number | null, c: number, k: number) => {
        if (i2 != null && (ini == null || i2 < ini)) ini = i2;
        if (f2 != null && (fin == null || f2 > fin)) fin = f2;
        cnt += c; crit += k;
      };
      for (const h of n.hijos) { resumir(h, nivel + 1); sumar(h.ini, h.fin, h.n, h.criticas); }
      for (const v of n.tareas) sumar(v.ini, v.fin, 1, v.tf != null && v.tf <= 0 ? 1 : 0);
      n.ini = ini; n.fin = fin; n.n = cnt; n.criticas = crit;
    };
    raices.sort((a, b) => a.seq - b.seq);
    raices.forEach(r => resumir(r, 0));
    return { raices, nodos };
  }, [m, vts]);

  const pasa = React.useCallback((v: Vt) => {
    if (filtroEstado === 'pendientes' && v.estado === 'TK_Complete') return false;
    if (filtroEstado === 'encurso' && v.estado !== 'TK_Active') return false;
    if (filtroEstado === 'criticas' && !(v.tf != null && v.tf <= 0)) return false;
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
      const r = n.tareas.some(pasa) || n.hijos.some(tiene);
      contiene.set(n.id, r);
      return r;
    };
    const recorrer = (n: Nodo) => {
      if (filtrando && !tiene(n)) return;
      out.push({ tipo: 'wbs', nodo: n, nivel: n.nivel });
      if (!filtrando && !abiertos.has(n.id)) return;
      for (const h of n.hijos) recorrer(h);
      for (const v of n.tareas) if (!filtrando || pasa(v)) out.push({ tipo: 'act', vt: v, nivel: n.nivel + 1 });
    };
    arbol.raices.forEach(recorrer);
    return out;
  }, [arbol, abiertos, filtro, filtroEstado, pasa]);

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
    const hasta = fin + 45 * 1440;
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
    mostrar(`Programado en ${Math.round(performance.now() - t0)} ms · fin del proyecto ${fCorta(r.finTemprano)} · ${r.criticas.toLocaleString('es-ES')} actividades críticas${r.ciclos.length ? ` · ${r.ciclos.length} en ciclos lógicos` : ''}`);
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

  const alternar = (id: string) => setAbiertos(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const expandirTodo = (abrir: boolean) => setAbiertos(abrir ? new Set(arbol.nodos.keys()) : new Set(arbol.raices.map(r => r.id)));

  // ── Filas visibles (virtualización) ──
  const desdeFila = Math.max(0, Math.floor(scrollTop / FILA) - 10);
  const hastaFila = Math.min(filas.length, Math.ceil((scrollTop + altoVista) / FILA) + 10);
  const xDatos = m ? xDe(m.fechaDatos) : 0;
  const criticas = vts.filter(v => v.tf != null && v.tf <= 0).length;

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
              {(['actividades', 'recursos'] as const).map(v => (
                <button key={v} onClick={() => setVista(v)} className={`px-3 py-1.5 flex items-center gap-1 cursor-pointer ${vista === v ? 'bg-[#312E81] text-white font-bold' : 'bg-white text-[#5A6A74] hover:text-[#14212A]'}`}>
                  {v === 'actividades' ? <Layers className="w-3.5 h-3.5" /> : <BarChart3 className="w-3.5 h-3.5" />}
                  {v === 'actividades' ? 'Actividades' : 'Recursos'}
                </button>
              ))}
            </div>
            {vista === 'actividades' && (
              <>
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
                </select>
                <button onClick={() => expandirTodo(true)} className="px-2 py-1.5 border border-[#D5DEE2] rounded-lg hover:bg-[#F5F8F9] cursor-pointer">Expandir todo</button>
                <button onClick={() => expandirTodo(false)} className="px-2 py-1.5 border border-[#D5DEE2] rounded-lg hover:bg-[#F5F8F9] cursor-pointer">Colapsar</button>
                <div className="ml-auto flex items-center gap-1 text-[#5A6A74]">
                  Escala
                  {[[0.4, 'Años'], [1, 'Trimestres'], [3, 'Meses'], [8, 'Semanas']].map(([v, l]) => (
                    <button key={String(v)} onClick={() => setPx(v as number)} className={`px-2 py-1 rounded cursor-pointer ${px === v ? 'bg-[#312E81] text-white' : 'hover:bg-[#F5F8F9]'}`}>{l}</button>
                  ))}
                </div>
              </>
            )}
          </div>

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
                      <div className="w-[78px] text-right px-1">Inicio</div>
                      <div className="w-[78px] text-right px-1">Fin</div>
                      <div className="w-[52px] text-right px-1">Holg. tot.</div>
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
                  {/* Línea de fecha de datos */}
                  <div className="absolute z-10 w-0.5 bg-[#CD0000]/70 pointer-events-none" style={{ left: ANCHO_IZQ + xDatos, top: 34, height: filas.length * FILA }} title="Fecha de datos" />
                  {/* Filas */}
                  {filas.slice(desdeFila, hastaFila).map((fl, k) => {
                    const idx = desdeFila + k;
                    const top = 34 + idx * FILA;
                    if (fl.tipo === 'wbs') {
                      const n = fl.nodo;
                      const abierto = abiertos.has(n.id) || !!filtro || filtroEstado !== 'todas';
                      const tono = ['#E8E7F7', '#EEF0FB', '#F3F4FB', '#F7F8FC'][Math.min(fl.nivel, 3)];
                      return (
                        <div key={`w${n.id}`} className="absolute flex text-[11px] font-semibold cursor-pointer" style={{ top, height: FILA, width: ANCHO_IZQ + anchoGantt, background: tono }} onClick={() => alternar(n.id)}>
                          <div className="sticky left-0 z-[5] flex items-center border-r border-[#D5DEE2]" style={{ width: ANCHO_IZQ, background: tono }}>
                            <div className="flex items-center gap-1 min-w-0" style={{ paddingLeft: 4 + fl.nivel * 10, width: 382 }}>
                              {abierto ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-[#312E81]" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[#312E81]" />}
                              <span className="truncate" title={`${n.cod} · ${n.nombre}`}><span className="text-[#5A6A74] font-normal">{n.cod}</span> {n.nombre}</span>
                              <span className="text-[9.5px] font-normal text-[#5A6A74] shrink-0">({n.n})</span>
                            </div>
                            <div className="w-[104px]" />
                            <div className="w-[78px] text-right px-1 font-normal">{fCorta(n.ini)}</div>
                            <div className="w-[78px] text-right px-1 font-normal">{fCorta(n.fin)}</div>
                            <div className="w-[108px] text-right px-2 text-[10px] font-normal text-red-700">{n.criticas ? `${n.criticas} críticas` : ''}</div>
                          </div>
                          {n.ini != null && n.fin != null && (
                            <div className="absolute h-1.5 bg-[#1E1B4B] rounded-sm" style={{ left: ANCHO_IZQ + xDe(n.ini), width: Math.max(2, xDe(n.fin) - xDe(n.ini)), top: 8 }} />
                          )}
                        </div>
                      );
                    }
                    const v = fl.vt;
                    const critica = v.tf != null && v.tf <= 0;
                    const esHito = v.tipo === 'TT_Mile' || v.tipo === 'TT_FinMile';
                    const seleccionada = sel === v.i;
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
                          <div className={`w-[52px] text-right px-1 ${critica ? 'text-red-600 font-semibold' : ''}`}>{v.tf == null ? '' : dias(v.tf, v.hd)}</div>
                          <div className="w-[56px] text-right px-2">{v.avance ? `${Math.round(v.avance * 10) / 10}%` : ''}</div>
                        </div>
                        {/* Barras */}
                        {esHito ? (
                          v.ini != null && <div className="absolute w-2.5 h-2.5 rotate-45" style={{ left: ANCHO_IZQ + xDe(v.ini) - 5, top: 6, background: v.estado === 'TK_Complete' ? '#2C67A6' : critica ? '#CD0000' : '#14212A' }} title={`${v.cod} · ${fCorta(v.ini)}`} />
                        ) : (
                          <>
                            {v.iniA && v.ini != null && (
                              <div className="absolute h-2.5 bg-[#2C67A6] rounded-sm" title="Real"
                                style={{ left: ANCHO_IZQ + xDe(v.ini), width: Math.max(2, xDe(v.estado === 'TK_Complete' ? v.fin ?? v.ini : m.fechaDatos) - xDe(v.ini)), top: 6 }} />
                            )}
                            {v.estado !== 'TK_Complete' && (v.resto ?? v.ini) != null && v.fin != null && (
                              <div className={`absolute h-2.5 rounded-sm ${critica ? 'bg-[#CD0000]' : 'bg-[#2B7F52]'}`} title="Restante"
                                style={{ left: ANCHO_IZQ + xDe((v.resto ?? v.ini)!), width: Math.max(2, xDe(v.fin) - xDe((v.resto ?? v.ini)!)), top: 6 }} />
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {sel != null && <PanelActividad m={m} i={sel} editable={editable} cambios={cambios} version={version} onCambio={marcarCambio} onCerrar={() => setSel(null)} />}
            </>
          ) : (
            <VistaRecursos m={m} version={version} />
          )}
        </>
      )}
    </div>
  );
};

/** Panel inferior con los detalles de la actividad (como el de P6). */
const PanelActividad: React.FC<{
  m: ModeloP6; i: number; editable: boolean; cambios: Cambio[]; version: number;
  onCambio: (log: Cambio[]) => void; onCerrar: () => void;
}> = ({ m, i, editable, cambios, version, onCambio, onCerrar }) => {
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
        <button onClick={onCerrar} className="ml-auto p-1 hover:bg-[#F5F8F9] rounded cursor-pointer"><X className="w-3.5 h-3.5" /></button>
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
