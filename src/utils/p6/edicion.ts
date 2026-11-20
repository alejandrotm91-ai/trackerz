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
