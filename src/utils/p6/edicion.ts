/**
 * Ediciones sobre el XER con las reglas de P6, y escritura de los resultados de la programación.
 * Todas las funciones modifican las filas del XER en memoria; luego se puede exportar o guardar.
 */
import { aMinutos, aTexto } from './calendario';
import { programarModelo, type ModeloP6 } from './modelo';
import type { ResultadoCpm } from './cpm';
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
export function programarYEscribir(m: ModeloP6): ResultadoCpm & { criticas: number } {
  const { acts, res } = programarModelo(m);
  const t = m.task;
  let criticas = 0;
  acts.forEach((a, i) => {
    const f = t.filas[i];
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
  return { ...res, criticas };
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
