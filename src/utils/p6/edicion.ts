/**
 * Ediciones sobre el XER con las reglas de P6, y escritura de los resultados de la programación.
 * Todas las funciones modifican las filas del XER en memoria; luego se puede exportar o guardar.
 */
import { aMinutos, aTexto } from './calendario';
import { programarModelo, type ModeloP6 } from './modelo';
import { rutaMasLarga, type ResultadoCpm } from './cpm';
import { celda, ponerCelda } from './xer';

export interface Cambio {
  cuando: string;
  actividad: string;
  campo: string;
  antes: string;
  despues: string;
}

/** Número como lo escribe P6 (sin decimales si es entero). */
const num = (v: number) => (Math.round(v * 100) / 100).toString();

function registrar(log: Cambio[], actividad: string, campo: string, antes: string, despues: string) {
  if (antes === despues) return;
  log.push({ cuando: new Date().toISOString(), actividad, campo, antes, despues });
}

export function ponerFechaDatos(m: ModeloP6, fecha: string, log: Cambio[]) {
  const proj = m.xer.tablas.get('PROJECT')!;
  const f = proj.filas[0];
  const antes = celda(proj, f, 'last_recalc_date');
  ponerCelda(proj, f, 'last_recalc_date', fecha);
  m.fechaDatos = aMinutos(fecha)!;
  registrar(log, 'Proyecto', 'Fecha de datos', antes, fecha);
}

export interface EdicionActividad {
  nombre?: string;
  /** Duración original en horas. */
  durOriginal?: number;
  /** Duración restante en horas. */
  durRestante?: number;
  inicioReal?: string | null;
  finReal?: string | null;
  /** % de avance físico (0–100). */
  avance?: number;
  restriccion?: { tipo: string; fecha: string } | null;
}

export function editarActividad(m: ModeloP6, i: number, e: EdicionActividad, log: Cambio[]) {
  const t = m.task;
  const f = t.filas[i];
  const cod = celda(t, f, 'task_code');
  const set = (campo: string, valor: string, etiqueta: string) => {
    const antes = celda(t, f, campo);
    ponerCelda(t, f, campo, valor);
    registrar(log, cod, etiqueta, antes, valor);
  };
  if (e.nombre !== undefined) set('task_name', e.nombre, 'Nombre');
  const estado = () => celda(t, f, 'status_code');

  if (e.durOriginal !== undefined) {
    set('target_drtn_hr_cnt', num(e.durOriginal), 'Duración original (h)');
    if (estado() === 'TK_NotStart') set('remain_drtn_hr_cnt', num(e.durOriginal), 'Duración restante (h)');
  }
  if (e.durRestante !== undefined && estado() !== 'TK_Complete') set('remain_drtn_hr_cnt', num(e.durRestante), 'Duración restante (h)');

  if (e.inicioReal !== undefined) {
    if (e.inicioReal) {
      set('act_start_date', e.inicioReal, 'Inicio real');
      if (estado() === 'TK_NotStart') set('status_code', 'TK_Active', 'Estado');
    } else {
      set('act_start_date', '', 'Inicio real');
      set('act_end_date', '', 'Fin real');
      set('status_code', 'TK_NotStart', 'Estado');
      set('remain_drtn_hr_cnt', celda(t, f, 'target_drtn_hr_cnt'), 'Duración restante (h)');
      set('phys_complete_pct', '0', '% avance');
    }
  }
  if (e.finReal !== undefined) {
    if (e.finReal) {
      if (!celda(t, f, 'act_start_date')) set('act_start_date', e.finReal, 'Inicio real');
      set('act_end_date', e.finReal, 'Fin real');
      set('status_code', 'TK_Complete', 'Estado');
      set('remain_drtn_hr_cnt', '0', 'Duración restante (h)');
      set('phys_complete_pct', '100', '% avance');
    } else if (estado() === 'TK_Complete') {
      set('act_end_date', '', 'Fin real');
      set('status_code', 'TK_Active', 'Estado');
    }
  }
  if (e.avance !== undefined) set('phys_complete_pct', num(Math.max(0, Math.min(100, e.avance))), '% avance');
  if (e.restriccion !== undefined) {
    set('cstr_type', e.restriccion?.tipo || '', 'Restricción');
    set('cstr_date', e.restriccion?.tipo ? e.restriccion.fecha : '', 'Fecha de restricción');
  }
}

/** Agrega una relación lógica. Devuelve un mensaje de error si no se puede. */
export function agregarRelacion(m: ModeloP6, predCodigo: string, succIdx: number, tipo: string, lagHoras: number, log: Cambio[]): string | null {
  const t = m.task, p = m.pred;
  const predIdx = t.filas.findIndex(f => celda(t, f, 'task_code').toLowerCase() === predCodigo.trim().toLowerCase());
  if (predIdx < 0) return `No existe la actividad ${predCodigo}.`;
  if (predIdx === succIdx) return 'Una actividad no puede ser predecesora de sí misma.';
  const predId = celda(t, t.filas[predIdx], 'task_id');
  const succId = celda(t, t.filas[succIdx], 'task_id');
  if (p.filas.some(f => celda(p, f, 'pred_task_id') === predId && celda(p, f, 'task_id') === succId)) return 'Esa relación ya existe.';
  const maxId = p.filas.reduce((mx, f) => Math.max(mx, Number(celda(p, f, 'task_pred_id')) || 0), 0);
  const proj = celda(t, t.filas[succIdx], 'proj_id');
  const fila = p.campos.map(() => '');
  const put = (c: string, v: string) => { const k = p.idx[c]; if (k !== undefined) fila[k] = v; };
  put('task_pred_id', String(maxId + 1));
  put('task_id', succId);
  put('pred_task_id', predId);
  put('proj_id', proj);
  put('pred_proj_id', celda(t, t.filas[predIdx], 'proj_id'));
  put('pred_type', `PR_${tipo}`);
  put('lag_hr_cnt', num(lagHoras));
  p.filas.push(fila);
  registrar(log, celda(t, t.filas[succIdx], 'task_code'), 'Relación agregada', '', `${celda(t, t.filas[predIdx], 'task_code')} ${tipo} ${num(lagHoras)}h`);
  return null;
}

export function editarRelacion(m: ModeloP6, filaRel: number, tipo: string, lagHoras: number, log: Cambio[]) {
  const p = m.pred, t = m.task;
  const f = p.filas[filaRel];
  const antes = `${celda(p, f, 'pred_type').replace('PR_', '')} ${celda(p, f, 'lag_hr_cnt')}h`;
  ponerCelda(p, f, 'pred_type', `PR_${tipo}`);
  ponerCelda(p, f, 'lag_hr_cnt', num(lagHoras));
  const succ = m.porId.get(celda(p, f, 'task_id'));
  registrar(log, succ !== undefined ? celda(t, t.filas[succ], 'task_code') : '?', 'Relación', antes, `${tipo} ${num(lagHoras)}h`);
}

export function eliminarRelacion(m: ModeloP6, filaRel: number, log: Cambio[]) {
  const p = m.pred, t = m.task;
  const f = p.filas[filaRel];
  const a = m.porId.get(celda(p, f, 'pred_task_id'));
  const b = m.porId.get(celda(p, f, 'task_id'));
  p.filas.splice(filaRel, 1);
  registrar(log, b !== undefined ? celda(t, t.filas[b], 'task_code') : '?', 'Relación eliminada',
    `${a !== undefined ? celda(t, t.filas[a], 'task_code') : '?'} ${celda(p, f, 'pred_type').replace('PR_', '')} ${celda(p, f, 'lag_hr_cnt')}h`, '');
}

/**
 * Programa (F9) y escribe los resultados en el XER, como P6: fechas tempranas y tardías,
 * fechas del trabajo restante, holguras, fin del proyecto y fechas de las asignaciones.
 */
export function programarYEscribir(m: ModeloP6): ResultadoCpm & { criticas: number; rutaLarga: number } {
  const { acts, rels, res } = programarModelo(m);
  const t = m.task;
  let criticas = 0;
  // Ruta más larga (Longest Path): se guarda en driving_path_flag, como hace P6
  const lp = rutaMasLarga(acts, rels, res.finTemprano);
  acts.forEach((a, i) => {
    const f = t.filas[i];
    ponerCelda(t, f, 'driving_path_flag', lp.has(i) ? 'Y' : 'N');
    const horas = (min: number | null | undefined) => (min == null ? '' : num(min / 60));
    ponerCelda(t, f, 'early_start_date', aTexto(a.ES));
    ponerCelda(t, f, 'early_end_date', aTexto(a.EF));
    if (a.estado === 'Terminada') {
      ponerCelda(t, f, 'total_float_hr_cnt', '');
      ponerCelda(t, f, 'free_float_hr_cnt', '');
      ponerCelda(t, f, 'restart_date', '');
      ponerCelda(t, f, 'reend_date', '');
      return;
    }
    if (a.tipo === 'TT_LOE' && a.ES != null && a.EF != null) {
      // El nivel de esfuerzo dura lo que dicen sus relaciones
      const d = horas(a.cal.entre(a.ES, a.EF));
      ponerCelda(t, f, 'remain_drtn_hr_cnt', d);
      if (a.estado === 'NoIniciada') ponerCelda(t, f, 'target_drtn_hr_cnt', d);
    }
    ponerCelda(t, f, 'late_start_date', aTexto(a.LS));
    ponerCelda(t, f, 'late_end_date', aTexto(a.LF));
    ponerCelda(t, f, 'total_float_hr_cnt', horas(a.TF));
    ponerCelda(t, f, 'free_float_hr_cnt', horas(a.FFl));
    ponerCelda(t, f, 'restart_date', aTexto(a.ES));
    ponerCelda(t, f, 'reend_date', aTexto(a.EF));
    ponerCelda(t, f, 'rem_late_start_date', aTexto(a.LS));
    ponerCelda(t, f, 'rem_late_end_date', aTexto(a.LF));
    if ((a.TF ?? 1) <= 0) criticas++;
  });
  const proj = m.xer.tablas.get('PROJECT')!;
  ponerCelda(proj, proj.filas[0], 'scd_end_date', aTexto(res.finTemprano));
  // Asignaciones de recursos: el trabajo restante sigue las fechas de su actividad
  const tr = m.xer.tablas.get('TASKRSRC');
  if (tr) {
    for (const fr of tr.filas) {
      const i = m.porId.get(celda(tr, fr, 'task_id'));
      if (i === undefined) continue;
      const a = acts[i];
      if (a.estado === 'Terminada') continue;
      ponerCelda(tr, fr, 'restart_date', aTexto(a.ES));
      ponerCelda(tr, fr, 'reend_date', aTexto(a.EF));
      ponerCelda(tr, fr, 'rem_late_start_date', aTexto(a.LS));
      ponerCelda(tr, fr, 'rem_late_end_date', aTexto(a.LF));
    }
  }
  return { ...res, criticas, rutaLarga: lp.size };
}

/** GUID al estilo de P6: 16 bytes aleatorios en base64 (22 caracteres). */
function nuevoGuid(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/=+$/, '');
}

/** Vuelve a indexar task_id → fila tras agregar o quitar actividades. */
export function reindexar(m: ModeloP6) {
  m.porId.clear();
  m.task.filas.forEach((f, i) => m.porId.set(celda(m.task, f, 'task_id'), i));
}

export interface NuevaActividad {
  wbsId: string;
  codigo: string;
  nombre: string;
  /** TT_Task, TT_Mile (hito de inicio) o TT_FinMile (hito de fin). */
  tipo: string;
  durHoras: number;
  usuario?: string;
}

/** Crea una actividad no iniciada. Devuelve su índice o un mensaje de error. */
export function crearActividad(m: ModeloP6, n: NuevaActividad, log: Cambio[]): number | string {
  const t = m.task;
  const codigo = n.codigo.trim();
  if (!codigo) return 'Falta el ID de la actividad.';
  if (!n.nombre.trim()) return 'Falta el nombre.';
  if (t.filas.some(f => celda(t, f, 'task_code').toLowerCase() === codigo.toLowerCase())) return `Ya existe una actividad con el ID ${codigo}.`;
  const w = m.xer.tablas.get('PROJWBS');
  if (!w?.filas.some(f => celda(w, f, 'wbs_id') === n.wbsId)) return 'Elige un WBS válido.';
  // Plantilla: una actividad del mismo WBS (o cualquiera del proyecto)
  const plantilla = t.filas.find(f => celda(t, f, 'wbs_id') === n.wbsId && celda(t, f, 'task_type') === 'TT_Task') || t.filas.find(f => celda(t, f, 'task_type') === 'TT_Task') || t.filas[0];
  const fila = plantilla ? [...plantilla] : t.campos.map(() => '');
  const put = (c: string, v: string) => ponerCelda(t, fila, c, v);
  // Todo lo calculado o propio de la otra actividad se limpia
  for (const c of t.campos) {
    if (/(_date|_date2)$/.test(c) || /float|_qty$|qty_|cnt$/.test(c) || ['cstr_type', 'cstr_type2', 'rsrc_id', 'float_path', 'float_path_order', 'tmpl_guid', 'location_id', 'crt_path_num'].includes(c)) put(c, '');
  }
  const maxId = t.filas.reduce((mx, f) => Math.max(mx, Number(celda(t, f, 'task_id')) || 0), 0);
  const ahora = aTexto(Math.floor(Date.now() / 60000) - new Date().getTimezoneOffset());
  const esHito = n.tipo === 'TT_Mile' || n.tipo === 'TT_FinMile';
  const dur = esHito ? 0 : Math.max(0, n.durHoras);
  put('task_id', String(maxId + 1));
  put('wbs_id', n.wbsId);
  put('task_code', codigo);
  put('task_name', n.nombre.trim());
  put('task_type', n.tipo);
  put('status_code', 'TK_NotStart');
  put('phys_complete_pct', '0');
  put('target_drtn_hr_cnt', num(dur));
  put('remain_drtn_hr_cnt', num(dur));
  for (const c of ['act_work_qty', 'remain_work_qty', 'target_work_qty', 'target_equip_qty', 'act_equip_qty', 'remain_equip_qty', 'act_this_per_work_qty', 'act_this_per_equip_qty']) put(c, '0');
  put('driving_path_flag', 'N');
  put('lock_plan_flag', 'N');
  put('rev_fdbk_flag', 'N');
  put('guid', nuevoGuid());
  put('create_date', ahora);
  put('update_date', ahora);
  put('create_user', n.usuario || 'Trakciona');
  put('update_user', n.usuario || 'Trakciona');
  // Fechas planificadas en la fecha de datos (se recalculan al programar)
  const cal = m.calendarios.get(celda(t, fila, 'clndr_id'));
  const ini = cal ? cal.aInicio(m.fechaDatos) : m.fechaDatos;
  const fin = cal && dur > 0 ? cal.sumar(ini, dur * 60, 'fin') : ini;
  for (const c of ['target_start_date', 'early_start_date', 'restart_date']) put(c, aTexto(ini));
  for (const c of ['target_end_date', 'early_end_date', 'reend_date']) put(c, aTexto(fin));
  t.filas.push(fila);
  reindexar(m);
  registrar(log, codigo, 'Actividad creada', '', `${n.nombre.trim()} · ${esHito ? 'hito' : `${num(dur)} h`}`);
  return t.filas.length - 1;
}

/** Elimina una actividad y todo lo que depende de ella (relaciones, recursos, códigos, notas, UDF). */
export function eliminarActividad(m: ModeloP6, i: number, log: Cambio[]) {
  const t = m.task;
  const f = t.filas[i];
  const id = celda(t, f, 'task_id');
  const cod = celda(t, f, 'task_code');
  let rels = 0;
  const quitar = (nombre: string, pred: (tb: NonNullable<ReturnType<typeof m.xer.tablas.get>>, fila: string[]) => boolean) => {
    const tb = m.xer.tablas.get(nombre);
    if (!tb) return 0;
    const antes = tb.filas.length;
    tb.filas = tb.filas.filter(fila => !pred(tb, fila));
    return antes - tb.filas.length;
  };
  rels = quitar('TASKPRED', (tb, fila) => celda(tb, fila, 'task_id') === id || celda(tb, fila, 'pred_task_id') === id);
  const recursos = quitar('TASKRSRC', (tb, fila) => celda(tb, fila, 'task_id') === id);
  quitar('TASKACTV', (tb, fila) => celda(tb, fila, 'task_id') === id);
  quitar('TASKMEMO', (tb, fila) => celda(tb, fila, 'task_id') === id);
  // Campos personalizados de actividades
  const udfTipos = m.xer.tablas.get('UDFTYPE');
  const deTask = new Set((udfTipos?.filas || []).filter(fu => celda(udfTipos!, fu, 'table_name') === 'TASK').map(fu => celda(udfTipos!, fu, 'udf_type_id')));
  quitar('UDFVALUE', (tb, fila) => celda(tb, fila, 'fk_id') === id && deTask.has(celda(tb, fila, 'udf_type_id')));
  t.filas.splice(i, 1);
  reindexar(m);
  registrar(log, cod, 'Actividad eliminada', `${celda(t, f, 'task_name')} · ${rels} relaciones · ${recursos} asignaciones`, '');
}

/* ───────────────────────── WBS ───────────────────────── */

const wbsTabla = (m: ModeloP6) => {
  const w = m.xer.tablas.get('PROJWBS');
  if (!w) throw new Error('El XER no trae la tabla PROJWBS.');
  return w;
};
const filaWbs = (m: ModeloP6, id: string) => {
  const w = wbsTabla(m);
  return w.filas.find(f => celda(w, f, 'wbs_id') === id);
};
/** Hijos de un WBS ordenados por su posición (seq_num). */
function hijosWbs(m: ModeloP6, padre: string): string[][] {
  const w = wbsTabla(m);
  return w.filas.filter(f => celda(w, f, 'parent_wbs_id') === padre && celda(w, f, 'proj_node_flag') !== 'Y')
    .sort((a, b) => (Number(celda(w, a, 'seq_num')) || 0) - (Number(celda(w, b, 'seq_num')) || 0));
}
/** Vuelve a numerar las posiciones de unos hermanos (10, 20, 30…). */
function renumerar(m: ModeloP6, hermanos: string[][]) {
  const w = wbsTabla(m);
  hermanos.forEach((f, k) => ponerCelda(w, f, 'seq_num', String((k + 1) * 10)));
}
const nombreWbs = (m: ModeloP6, f: string[]) => { const w = wbsTabla(m); return `${celda(w, f, 'wbs_short_name')} · ${celda(w, f, 'wbs_name')}`; };
const esNodoProyecto = (m: ModeloP6, f: string[] | undefined) => !!f && celda(wbsTabla(m), f, 'proj_node_flag') === 'Y';

/** Crea un WBS dentro de `padreId` (al final, o justo después de `despuesDe`). Devuelve su id o un error. */
export function crearWbs(m: ModeloP6, padreId: string, corto: string, nombre: string, log: Cambio[], despuesDe?: string): string {
  const w = wbsTabla(m);
  const padre = filaWbs(m, padreId);
  if (!padre) return 'Elige un WBS padre.';
  const c = corto.trim();
  if (!c) return 'Falta el código del WBS.';
  if (!nombre.trim()) return 'Falta el nombre del WBS.';
  const hermanos = hijosWbs(m, padreId);
  if (hermanos.some(f => celda(w, f, 'wbs_short_name').toLowerCase() === c.toLowerCase())) return `Ya hay un WBS ${c} en ese nivel.`;
  const fila = [...padre];
  const put = (campo: string, v: string) => ponerCelda(w, fila, campo, v);
  for (const campo of w.campos) if (/_date$/.test(campo)) put(campo, '');
  const maxId = w.filas.reduce((mx, f) => Math.max(mx, Number(celda(w, f, 'wbs_id')) || 0), 0);
  const id = String(maxId + 1);
  put('wbs_id', id);
  put('parent_wbs_id', padreId);
  put('proj_node_flag', 'N');
  put('wbs_short_name', c);
  put('wbs_name', nombre.trim());
  put('guid', nuevoGuid());
  put('tmpl_guid', '');
  for (const campo of ['orig_cost', 'indep_remain_total_cost', 'indep_remain_work_qty', 'ev_user_pct', 'ev_etc_user_value']) if (w.idx[campo] !== undefined) put(campo, '0');
  w.filas.push(fila);
  // Posición: después de `despuesDe` o al final
  const orden = [...hermanos];
  const k = despuesDe ? orden.findIndex(f => celda(w, f, 'wbs_id') === despuesDe) : -1;
  orden.splice(k >= 0 ? k + 1 : orden.length, 0, fila);
  renumerar(m, orden);
  registrar(log, `WBS ${c}`, 'WBS creado', '', `${nombre.trim()} (en ${nombreWbs(m, padre)})`);
  return id;
}

export function editarWbs(m: ModeloP6, id: string, cambios: { corto?: string; nombre?: string }, log: Cambio[]): string | null {
  const w = wbsTabla(m);
  const f = filaWbs(m, id);
  if (!f) return 'No existe ese WBS.';
  if (cambios.corto !== undefined) {
    const c = cambios.corto.trim();
    if (!c) return 'El código no puede quedar vacío.';
    const hermanos = hijosWbs(m, celda(w, f, 'parent_wbs_id'));
    if (hermanos.some(h => h !== f && celda(w, h, 'wbs_short_name').toLowerCase() === c.toLowerCase())) return `Ya hay un WBS ${c} en ese nivel.`;
    registrar(log, `WBS ${celda(w, f, 'wbs_short_name')}`, 'Código WBS', celda(w, f, 'wbs_short_name'), c);
    ponerCelda(w, f, 'wbs_short_name', c);
  }
  if (cambios.nombre !== undefined && cambios.nombre.trim()) {
    registrar(log, `WBS ${celda(w, f, 'wbs_short_name')}`, 'Nombre WBS', celda(w, f, 'wbs_name'), cambios.nombre.trim());
    ponerCelda(w, f, 'wbs_name', cambios.nombre.trim());
  }
  return null;
}

/** Ids de un WBS y de todos sus descendientes. */
export function subarbolWbs(m: ModeloP6, id: string): Set<string> {
  const w = wbsTabla(m);
  const hijos = new Map<string, string[]>();
  for (const f of w.filas) {
    const p = celda(w, f, 'parent_wbs_id');
    (hijos.get(p) || hijos.set(p, []).get(p)!).push(celda(w, f, 'wbs_id'));
  }
  const out = new Set<string>();
  const pila = [id];
  while (pila.length) { const x = pila.pop()!; if (out.has(x)) continue; out.add(x); pila.push(...(hijos.get(x) || [])); }
  return out;
}

/** Elimina un WBS y sus sub-WBS; sus actividades pasan al WBS padre. */
export function eliminarWbs(m: ModeloP6, id: string, log: Cambio[]): string | null {
  const w = wbsTabla(m);
  const f = filaWbs(m, id);
  if (!f) return 'No existe ese WBS.';
  if (esNodoProyecto(m, f)) return 'El nodo del proyecto no se puede eliminar.';
  const padre = celda(w, f, 'parent_wbs_id');
  const ids = subarbolWbs(m, id);
  const t = m.task;
  let movidas = 0;
  for (const ft of t.filas) if (ids.has(celda(t, ft, 'wbs_id'))) { ponerCelda(t, ft, 'wbs_id', padre); movidas++; }
  w.filas = w.filas.filter(fw => !ids.has(celda(w, fw, 'wbs_id')));
  // Otras tablas que apuntan al WBS (códigos de actividad con alcance WBS)
  const at = m.xer.tablas.get('ACTVTYPE');
  if (at) for (const fa of at.filas) if (ids.has(celda(at, fa, 'wbs_id'))) ponerCelda(at, fa, 'wbs_id', padre);
  renumerar(m, hijosWbs(m, padre));
  const pf = filaWbs(m, padre);
  registrar(log, `WBS ${celda(w, f, 'wbs_short_name')}`, 'WBS eliminado', `${celda(w, f, 'wbs_name')} · ${ids.size - 1} sub-WBS`, `${movidas} actividades pasan a ${pf ? nombreWbs(m, pf) : 'su padre'}`);
  return null;
}

/** Mueve un WBS: arriba/abajo entre sus hermanos, derecha (sangrar) o izquierda (quitar sangría). */
export function moverWbs(m: ModeloP6, id: string, accion: 'arriba' | 'abajo' | 'derecha' | 'izquierda', log: Cambio[]): string | null {
  const w = wbsTabla(m);
  const f = filaWbs(m, id);
  if (!f) return 'No existe ese WBS.';
  if (esNodoProyecto(m, f)) return 'El nodo del proyecto no se puede mover.';
  const padreId = celda(w, f, 'parent_wbs_id');
  const hermanos = hijosWbs(m, padreId);
  const k = hermanos.indexOf(f);
  const etq = `WBS ${celda(w, f, 'wbs_short_name')}`;
  if (accion === 'arriba' || accion === 'abajo') {
    const j = accion === 'arriba' ? k - 1 : k + 1;
    if (j < 0 || j >= hermanos.length) return null;
    [hermanos[k], hermanos[j]] = [hermanos[j], hermanos[k]];
    renumerar(m, hermanos);
    registrar(log, etq, 'Posición', String(k + 1), String(j + 1));
    return null;
  }
  if (accion === 'derecha') {
    if (k <= 0) return 'No hay un WBS anterior en el mismo nivel para colgarlo.';
    const nuevoPadre = hermanos[k - 1];
    const nuevoPadreId = celda(w, nuevoPadre, 'wbs_id');
    const destino = hijosWbs(m, nuevoPadreId);
    if (destino.some(h => celda(w, h, 'wbs_short_name').toLowerCase() === celda(w, f, 'wbs_short_name').toLowerCase())) return 'Ya existe un WBS con ese código en el nivel de destino.';
    ponerCelda(w, f, 'parent_wbs_id', nuevoPadreId);
    renumerar(m, [...destino, f]);
    renumerar(m, hijosWbs(m, padreId));
    registrar(log, etq, 'Nivel', nombreWbs(m, filaWbs(m, padreId)!), nombreWbs(m, nuevoPadre));
    return null;
  }
  // izquierda: pasa a ser hermano de su padre, justo después de él
  const padre = filaWbs(m, padreId);
  if (!padre || esNodoProyecto(m, padre)) return 'Ya está en el primer nivel del proyecto.';
  const abueloId = celda(w, padre, 'parent_wbs_id');
  const tios = hijosWbs(m, abueloId);
  if (tios.some(h => h !== f && celda(w, h, 'wbs_short_name').toLowerCase() === celda(w, f, 'wbs_short_name').toLowerCase())) return 'Ya existe un WBS con ese código en el nivel de destino.';
  ponerCelda(w, f, 'parent_wbs_id', abueloId);
  const pos = tios.indexOf(padre);
  tios.splice(pos + 1, 0, f);
  renumerar(m, tios);
  renumerar(m, hijosWbs(m, padreId));
  const abuelo = filaWbs(m, abueloId);
  registrar(log, etq, 'Nivel', nombreWbs(m, padre), abuelo ? nombreWbs(m, abuelo) : 'proyecto');
  return null;
}

// ── Campos definidos por el usuario (User Defined Fields) de las actividades ──

export interface CampoUdf {
  id: string;
  etiqueta: string;
  /** FT_TEXT, FT_START_DATE, FT_END_DATE, FT_FLOAT_2_DECIMALS, FT_INT, FT_MONEY, FT_STATICTYPE (indicador) */
  tipo: string;
  valor: string;
}

/** Columna de UDFVALUE donde se guarda cada tipo de dato. */
export function columnaUdf(tipo: string): 'udf_date' | 'udf_number' | 'udf_text' {
  if (tipo === 'FT_START_DATE' || tipo === 'FT_END_DATE') return 'udf_date';
  if (tipo === 'FT_TEXT' || tipo === 'FT_STATICTYPE') return 'udf_text';
  return 'udf_number';
}

/** Todos los campos de usuario de actividades, con el valor de la actividad i (vacío si no tiene). */
export function udfsDeActividad(m: ModeloP6, i: number): CampoUdf[] {
  const tipos = m.xer.tablas.get('UDFTYPE');
  const valores = m.xer.tablas.get('UDFVALUE');
  if (!tipos) return [];
  const taskId = celda(m.task, m.task.filas[i], 'task_id');
  const porTipo = new Map<string, string[]>();
  for (const f of valores?.filas || []) if (celda(valores!, f, 'fk_id') === taskId) porTipo.set(celda(valores!, f, 'udf_type_id'), f);
  return tipos.filas
    .filter(f => celda(tipos, f, 'table_name') === 'TASK')
    .map(f => {
      const id = celda(tipos, f, 'udf_type_id');
      const tipo = celda(tipos, f, 'logical_data_type');
      const fv = porTipo.get(id);
      return { id, etiqueta: celda(tipos, f, 'udf_type_label') || celda(tipos, f, 'udf_type_name'), tipo, valor: fv ? celda(valores!, fv, columnaUdf(tipo)) : '' };
    })
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es', { numeric: true }));
}

/** Pone (o borra, si el valor queda vacío) un campo de usuario de la actividad i. */
export function ponerUdf(m: ModeloP6, i: number, udfTypeId: string, valor: string, log: Cambio[]): string | null {
  const tipos = m.xer.tablas.get('UDFTYPE');
  const valores = m.xer.tablas.get('UDFVALUE');
  if (!tipos || !valores) return 'Este XER no tiene campos de usuario.';
  const ft = tipos.filas.find(f => celda(tipos, f, 'udf_type_id') === udfTypeId);
  if (!ft) return 'No existe ese campo de usuario.';
  const tipo = celda(tipos, ft, 'logical_data_type');
  const col = columnaUdf(tipo);
  const etq = celda(tipos, ft, 'udf_type_label') || celda(tipos, ft, 'udf_type_name');
  const t = m.task, fa = t.filas[i];
  const taskId = celda(t, fa, 'task_id');
  let v = valor.trim();
  if (col === 'udf_number' && v !== '') {
    const n = Number(v.replace(',', '.'));
    if (!Number.isFinite(n)) return `«${valor}» no es un número.`;
    v = String(tipo === 'FT_INT' ? Math.round(n) : n);
  }
  const k = valores.filas.findIndex(f => celda(valores, f, 'fk_id') === taskId && celda(valores, f, 'udf_type_id') === udfTypeId);
  const antes = k >= 0 ? celda(valores, valores.filas[k], col) : '';
  if (antes === v) return null;
  if (v === '') {
    if (k >= 0) valores.filas.splice(k, 1);
  } else if (k >= 0) {
    ponerCelda(valores, valores.filas[k], col, v);
  } else {
    const fila = valores.campos.map(() => '');
    ponerCelda(valores, fila, 'udf_type_id', udfTypeId);
    ponerCelda(valores, fila, 'fk_id', taskId);
    ponerCelda(valores, fila, 'proj_id', celda(t, fa, 'proj_id'));
    ponerCelda(valores, fila, col, v);
    valores.filas.push(fila);
  }
  registrar(log, celda(t, fa, 'task_code'), `UDF ${etq}`, antes, v);
  return null;
}
