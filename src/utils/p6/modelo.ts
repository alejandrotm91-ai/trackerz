/**
 * Modelo de programación a partir de un XER: actividades, relaciones, calendarios y opciones.
 * Trabaja sobre las mismas filas del XER (TASK, TASKPRED), para poder editarlas y exportarlas.
 */
import { Calendario, aMinutos } from './calendario';
import { programar, type ActividadCpm, type Estado, type Rel, type TipoRel, type ResultadoCpm } from './cpm';
import { celda, type Xer, type TablaXer } from './xer';

export interface ModeloP6 {
  xer: Xer;
  task: TablaXer;
  pred: TablaXer;
  calendarios: Map<string, Calendario>;
  /** Índice de cada task_id en la tabla TASK. */
  porId: Map<string, number>;
  fechaDatos: number;
  finProyecto: number | null;
}

const ESTADO: Record<string, Estado> = { TK_NotStart: 'NoIniciada', TK_Active: 'EnCurso', TK_Complete: 'Terminada' };
const TIPO_REL: Record<string, TipoRel> = { PR_FS: 'FS', PR_SS: 'SS', PR_FF: 'FF', PR_SF: 'SF' };

export function crearModelo(xer: Xer): ModeloP6 {
  const task = xer.tablas.get('TASK');
  const pred = xer.tablas.get('TASKPRED');
  const proj = xer.tablas.get('PROJECT');
  if (!task || !pred || !proj) throw new Error('El XER no trae las tablas TASK, TASKPRED y PROJECT.');
  const calTab = xer.tablas.get('CALENDAR');
  const calendarios = new Map<string, Calendario>();
  for (const f of calTab?.filas || []) {
    const id = celda(calTab!, f, 'clndr_id');
    calendarios.set(id, new Calendario(id, celda(calTab!, f, 'clndr_name'), Number(celda(calTab!, f, 'day_hr_cnt')) || 8, celda(calTab!, f, 'clndr_data')));
  }
  const porId = new Map<string, number>();
  task.filas.forEach((f, i) => porId.set(celda(task, f, 'task_id'), i));
  const p = proj.filas[0];
  const fechaDatos = aMinutos(celda(proj, p, 'last_recalc_date')) ?? aMinutos(celda(proj, p, 'plan_start_date'))!;
  const finProyecto = aMinutos(celda(proj, p, 'plan_end_date'));
  return { xer, task, pred, calendarios, porId, fechaDatos, finProyecto };
}

/** Arma las entradas del motor desde las filas actuales del XER. */
export function entradasCpm(m: ModeloP6): { acts: ActividadCpm[]; rels: Rel[] } {
  const t = m.task;
  const porDefecto = m.calendarios.values().next().value as Calendario;
  const h = (v: string) => (Number(v) || 0) * 60;
  const acts: ActividadCpm[] = t.filas.map(f => {
    const estado = ESTADO[celda(t, f, 'status_code')] || 'NoIniciada';
    const cstr = celda(t, f, 'cstr_type');
    const rem = celda(t, f, 'remain_drtn_hr_cnt');
    return {
      cal: m.calendarios.get(celda(t, f, 'clndr_id')) || porDefecto,
      tipo: celda(t, f, 'task_type'),
      estado,
      durRest: estado === 'NoIniciada' ? h(rem !== '' ? rem : celda(t, f, 'target_drtn_hr_cnt')) : h(rem),
      inicioReal: aMinutos(celda(t, f, 'act_start_date')),
      finReal: aMinutos(celda(t, f, 'act_end_date')),
      restriccion: cstr ? { tipo: cstr, fecha: aMinutos(celda(t, f, 'cstr_date')) } : null,
      suspension: aMinutos(celda(t, f, 'suspend_date')),
      reanudacion: aMinutos(celda(t, f, 'resume_date')),
    };
  });
  const rels: Rel[] = [];
  const p = m.pred;
  for (const f of p.filas) {
    const a = m.porId.get(celda(p, f, 'pred_task_id'));
    const b = m.porId.get(celda(p, f, 'task_id'));
    if (a === undefined || b === undefined) continue;
    rels.push({ pred: a, succ: b, tipo: TIPO_REL[celda(p, f, 'pred_type')] || 'FS', lag: h(celda(p, f, 'lag_hr_cnt')) });
  }
  return { acts, rels };
}

export function programarModelo(m: ModeloP6): { acts: ActividadCpm[]; rels: Rel[]; res: ResultadoCpm } {
  const { acts, rels } = entradasCpm(m);
  const res = programar(acts, rels, { fechaDatos: m.fechaDatos, finProyecto: m.finProyecto, lagSsDesdeInicioTemprano: lagSsDesdeInicioTemprano(m) });
  return { acts, rels, res };
}

/** Opción de P6 «Calculate start-to-start lag from: Early Start» (SCHEDOPTIONS.sched_lag_early_start_flag). */
export function lagSsDesdeInicioTemprano(m: ModeloP6): boolean {
  const so = m.xer.tablas.get('SCHEDOPTIONS');
  return !!so?.filas[0] && celda(so, so.filas[0], 'sched_lag_early_start_flag') === 'Y';
}
