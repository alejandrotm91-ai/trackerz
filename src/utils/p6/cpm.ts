/**
 * Programación por ruta crítica (CPM) compatible con Primavera P6.
 * Pasada hacia adelante (fechas tempranas) y hacia atrás (fechas tardías) con:
 *  - fecha de datos y avance (actividades terminadas, en curso y no iniciadas)
 *  - lógica retenida (el trabajo restante respeta las predecesoras no terminadas)
 *  - relaciones FS, SS, FF y SF con desfase en el calendario de la predecesora
 *  - restricciones: comenzar en / comenzar en o después, terminar en, lo más tarde posible
 *  - hitos de inicio y de fin, suspensión y reanudación
 *  - holgura total como holgura de fin (fin tardío − fin temprano), en horas
 *  - fecha límite del proyecto ("Must finish by") para las fechas tardías
 */
import { Calendario, type Minutos } from './calendario';

export type TipoRel = 'FS' | 'SS' | 'FF' | 'SF';
export type Estado = 'NoIniciada' | 'EnCurso' | 'Terminada';

export interface Rel {
  pred: number;
  succ: number;
  tipo: TipoRel;
  /** Desfase en minutos de trabajo (calendario de la predecesora). */
  lag: number;
}

export interface ActividadCpm {
  cal: Calendario;
  /** TT_Task, TT_Mile (hito de inicio), TT_FinMile (hito de fin), TT_LOE, … */
  tipo: string;
  estado: Estado;
  /** Duración restante en minutos de trabajo (la original si no ha empezado). */
  durRest: number;
  inicioReal: Minutos | null;
  finReal: Minutos | null;
  restriccion: { tipo: string; fecha: Minutos | null } | null;
  suspension: Minutos | null;
  reanudacion: Minutos | null;
  // Resultado
  ES?: Minutos; EF?: Minutos; LS?: Minutos; LF?: Minutos;
  /** Holgura total en minutos de trabajo (null en terminadas). */
  TF?: number | null;
  /** Holgura libre en minutos de trabajo. */
  FFl?: number | null;
}

export interface OpcionesCpm {
  fechaDatos: Minutos;
  /** Fecha límite del proyecto (Must finish by). Si no hay, el fin temprano del proyecto. */
  finProyecto: Minutos | null;
}

export interface ResultadoCpm {
  orden: number[];
  ciclos: number[];
  finTemprano: Minutos;
}

const esHitoInicio = (a: ActividadCpm) => a.tipo === 'TT_Mile';
const esHitoFin = (a: ActividadCpm) => a.tipo === 'TT_FinMile';
const durDe = (a: ActividadCpm) => (esHitoInicio(a) || esHitoFin(a) ? 0 : Math.max(0, a.durRest));

/** Orden topológico (Kahn). Las actividades en ciclos se agregan al final. */
function ordenar(n: number, preds: Rel[][], succs: Rel[][]): { orden: number[]; ciclos: number[] } {
  const grado = new Int32Array(n);
  for (let i = 0; i < n; i++) grado[i] = preds[i].length;
  const cola: number[] = [];
  for (let i = 0; i < n; i++) if (grado[i] === 0) cola.push(i);
  const orden: number[] = [];
  for (let k = 0; k < cola.length; k++) {
    const i = cola[k];
    orden.push(i);
    for (const r of succs[i]) if (--grado[r.succ] === 0) cola.push(r.succ);
  }
  const ciclos: number[] = [];
  if (orden.length < n) {
    const visto = new Uint8Array(n);
    orden.forEach(i => { visto[i] = 1; });
    for (let i = 0; i < n; i++) if (!visto[i]) { ciclos.push(i); orden.push(i); }
  }
  return { orden, ciclos };
}

export function programar(acts: ActividadCpm[], rels: Rel[], op: OpcionesCpm): ResultadoCpm {
  const n = acts.length;
  const preds: Rel[][] = Array.from({ length: n }, () => []);
  const succs: Rel[][] = Array.from({ length: n }, () => []);
  for (const r of rels) {
    if (r.pred === r.succ) continue;
    preds[r.succ].push(r);
    succs[r.pred].push(r);
  }
  const { orden, ciclos } = ordenar(n, preds, succs);
  const DD = op.fechaDatos;

  // Inicio efectivo de una predecesora (real si ya empezó)
  const inicioDe = (p: ActividadCpm) => (p.estado !== 'NoIniciada' && p.inicioReal != null ? p.inicioReal : p.ES!);

  // ── Pasada hacia adelante ──
  let finTemprano = DD;
  for (const i of orden) {
    const a = acts[i];
    const cal = a.cal;
    if (a.estado === 'Terminada') {
      a.ES = a.inicioReal ?? a.finReal ?? DD;
      a.EF = a.finReal ?? a.ES;
      a.TF = null; a.FFl = null;
      continue;
    }
    const dur = durDe(a);
    const enCurso = a.estado === 'EnCurso';
    // Inicio mínimo (lado inicio) y fin mínimo (lado fin)
    let ini = DD;
    let fin = -Infinity;
    for (const r of preds[i]) {
      const p = acts[r.pred];
      if (p.EF == null) continue;
      const pc = p.cal;
      if (enCurso && (r.tipo === 'SS' || r.tipo === 'SF')) continue; // ya empezó
      if (p.estado === 'Terminada' && enCurso) continue;
      switch (r.tipo) {
        case 'FS': ini = Math.max(ini, pc.sumar(p.EF, r.lag, 'fin')); break;
        case 'SS': ini = Math.max(ini, pc.sumar(inicioDe(p), r.lag, 'inicio')); break;
        case 'FF': fin = Math.max(fin, pc.sumar(p.EF, r.lag, 'fin')); break;
        case 'SF': fin = Math.max(fin, pc.sumar(inicioDe(p), r.lag, 'fin')); break;
      }
    }
    // Restricciones
    const rs = a.restriccion;
    if (!enCurso && rs && rs.fecha != null) {
      if (rs.tipo === 'CS_MSO' || rs.tipo === 'CS_MSOA') ini = Math.max(ini, rs.fecha);
      if (rs.tipo === 'CS_MEO' || rs.tipo === 'CS_MEOA') fin = Math.max(fin, rs.fecha);
    }
    if (enCurso && a.reanudacion != null) ini = Math.max(ini, a.reanudacion);

    let ES: Minutos, EF: Minutos;
    if (esHitoFin(a)) {
      EF = cal.aFin(Math.max(ini, fin === -Infinity ? ini : fin));
      ES = EF;
    } else {
      ES = cal.aInicio(ini);
      if (fin !== -Infinity) ES = Math.max(ES, cal.sumar(fin, -dur, 'inicio'));
      EF = dur > 0 ? cal.sumar(ES, dur, 'fin') : ES;
    }
    a.ES = ES;
    a.EF = EF;
    if (EF > finTemprano) finTemprano = EF;
  }

  // ── Pasada hacia atrás ──
  const finProy = op.finProyecto ?? finTemprano;
  for (let k = orden.length - 1; k >= 0; k--) {
    const i = orden[k];
    const a = acts[i];
    if (a.estado === 'Terminada') continue;
    const cal = a.cal;
    const dur = durDe(a);
    let lf = finProy;
    let ls = Infinity;
    for (const r of succs[i]) {
      const s = acts[r.succ];
      if (s.estado === 'Terminada' || s.LF == null) continue;
      if (s.estado === 'EnCurso' && (r.tipo === 'SS' || r.tipo === 'SF')) continue;
      switch (r.tipo) {
        case 'FS': lf = Math.min(lf, cal.sumar(s.LS!, -r.lag, 'fin')); break;
        case 'SS': ls = Math.min(ls, cal.sumar(s.LS!, -r.lag, 'inicio')); break;
        case 'FF': lf = Math.min(lf, cal.sumar(s.LF, -r.lag, 'fin')); break;
        case 'SF': ls = Math.min(ls, cal.sumar(s.LF, -r.lag, 'inicio')); break;
      }
    }
    const rs = a.restriccion;
    if (a.estado === 'NoIniciada' && rs && rs.fecha != null) {
      if (rs.tipo === 'CS_MEO' || rs.tipo === 'CS_MEOB') lf = Math.min(lf, rs.fecha);
      if (rs.tipo === 'CS_MSO' || rs.tipo === 'CS_MSOB') ls = Math.min(ls, rs.fecha);
    }
    if (ls !== Infinity) lf = Math.min(lf, dur > 0 ? cal.sumar(ls, dur, 'fin') : ls);
    let LF = esHitoInicio(a) ? lf : cal.aFin(lf);
    let LS = dur > 0 ? cal.sumar(LF, -dur, 'inicio') : LF;
    a.LF = LF;
    a.LS = LS;
    a.TF = cal.entre(a.EF!, LF);
  }

  // ── Lo más tarde posible: sin holgura libre ──
  for (let k = orden.length - 1; k >= 0; k--) {
    const i = orden[k];
    const a = acts[i];
    if (a.estado !== 'NoIniciada' || a.restriccion?.tipo !== 'CS_ALAP') continue;
    const cal = a.cal;
    const dur = durDe(a);
    let ef = a.LF!;
    for (const r of succs[i]) {
      const s = acts[r.succ];
      if (s.estado === 'Terminada') continue;
      if (r.tipo === 'FS') ef = Math.min(ef, cal.sumar(s.ES!, -r.lag, 'fin'));
      if (r.tipo === 'FF') ef = Math.min(ef, cal.sumar(s.EF!, -r.lag, 'fin'));
    }
    ef = Math.max(ef, a.EF!);
    a.EF = esHitoInicio(a) ? ef : cal.aFin(ef);
    a.ES = dur > 0 ? cal.sumar(a.EF, -dur, 'inicio') : a.EF;
    a.TF = cal.entre(a.EF, a.LF!);
  }

  // ── Holgura libre ──
  for (let i = 0; i < n; i++) {
    const a = acts[i];
    if (a.estado === 'Terminada') continue;
    let ff = Infinity;
    for (const r of succs[i]) {
      const s = acts[r.succ];
      if (s.estado === 'Terminada' || s.ES == null) continue;
      const lim = r.tipo === 'FS' ? a.cal.sumar(s.ES, -r.lag, 'fin')
        : r.tipo === 'FF' ? a.cal.sumar(s.EF!, -r.lag, 'fin')
        : null;
      if (lim != null) ff = Math.min(ff, a.cal.entre(a.EF!, lim));
    }
    a.FFl = ff === Infinity ? a.TF ?? null : Math.max(0, ff);
  }

  return { orden, ciclos, finTemprano };
}
