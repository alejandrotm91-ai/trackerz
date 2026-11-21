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
  /**
   * Base de los desfases SS/SF cuando esta actividad es predecesora, y parte del desfase ya
   * consumida (minutos). Con la opción de P6 «SS lag from Early Start», en una actividad en curso
   * la base es su inicio restante y se descuenta lo ya trabajado desde su inicio real.
   */
  inicioSS?: Minutos;
  lagConsumido?: number;
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
  /** P6 «Calculate start-to-start lag from: Early Start» (SCHEDOPTIONS.sched_lag_early_start_flag). */
  lagSsDesdeInicioTemprano?: boolean;
}

/** Inicio desde el que corre un SS/SF y el desfase efectivo de una relación desde la predecesora p. */
export function baseSs(p: ActividadCpm, lag: number): { base: Minutos; lag: number } {
  // Solo se consume un desfase positivo; los negativos (adelantos) se mantienen
  if (p.inicioSS != null) return { base: p.inicioSS, lag: lag > 0 ? Math.max(0, lag - (p.lagConsumido ?? 0)) : lag };
  return { base: p.estado !== 'NoIniciada' && p.inicioReal != null ? p.inicioReal : p.ES!, lag };
}

export interface ResultadoCpm {
  orden: number[];
  ciclos: number[];
  finTemprano: Minutos;
}

const esHitoInicio = (a: ActividadCpm) => a.tipo === 'TT_Mile';
const esHitoFin = (a: ActividadCpm) => a.tipo === 'TT_FinMile';
/** Nivel de esfuerzo (LOE): sus fechas las fijan sus relaciones; nunca conduce a otras. */
export const esLoe = (a: ActividadCpm) => a.tipo === 'TT_LOE';
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
  // ── Pasada hacia adelante ──
  let finTemprano = DD;
  for (const i of orden) {
    const a = acts[i];
    const cal = a.cal;
    if (a.estado === 'Terminada') {
      a.ES = a.inicioReal ?? a.finReal ?? DD;
      a.EF = a.finReal ?? a.ES;
      a.TF = null; a.FFl = null;
      a.inicioSS = a.ES; a.lagConsumido = 0;
      continue;
    }
    const dur = durDe(a);
    const enCurso = a.estado === 'EnCurso';
    // Inicio mínimo (lado inicio) y fin mínimo (lado fin)
    let ini = DD;
    let fin = -Infinity;
    for (const r of preds[i]) {
      const p = acts[r.pred];
      if (p.EF == null || esLoe(p)) continue;
      const pc = p.cal;
      // Sucesora en curso: un SS/SF ya se cumplió al empezar, salvo que la predecesora también esté en
      // curso; entonces (lógica retenida, como P6) el trabajo restante espera al restante de la predecesora.
      if (p.estado === 'Terminada' && enCurso) continue;
      const ss = baseSs(p, r.lag);
      switch (r.tipo) {
        case 'FS': ini = Math.max(ini, pc.sumar(p.EF, r.lag, 'fin')); break;
        case 'SS': ini = Math.max(ini, pc.sumar(ss.base, ss.lag, 'inicio')); break;
        case 'FF': fin = Math.max(fin, pc.sumar(p.EF, r.lag, 'fin')); break;
        case 'SF': fin = Math.max(fin, pc.sumar(ss.base, ss.lag, 'fin')); break;
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
    // Base de los SS/SF que salen de esta actividad
    if (enCurso && op.lagSsDesdeInicioTemprano) {
      a.inicioSS = ES;
      a.lagConsumido = a.inicioReal != null ? cal.entre(a.inicioReal, Math.max(a.inicioReal, DD)) : 0;
    } else {
      a.inicioSS = enCurso && a.inicioReal != null ? a.inicioReal : ES;
      a.lagConsumido = 0;
    }
  }

  // ── Nivel de esfuerzo: termina cuando lo piden sus sucesoras ──
  for (const i of orden) {
    const a = acts[i];
    if (!esLoe(a) || a.estado === 'Terminada') continue;
    let fin = -Infinity;
    for (const r of succs[i]) {
      const s = acts[r.succ];
      if (s.ES == null) continue;
      const sIni = s.estado !== 'NoIniciada' && s.inicioReal != null ? s.inicioReal : s.ES;
      if (r.tipo === 'FS') fin = Math.max(fin, a.cal.sumar(sIni, -r.lag, 'fin'));
      if (r.tipo === 'FF') fin = Math.max(fin, a.cal.sumar(s.EF!, -r.lag, 'fin'));
    }
    if (fin !== -Infinity) {
      a.EF = Math.max(a.ES!, a.cal.aFin(fin));
      if (a.EF > finTemprano) finTemprano = a.EF;
    }
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
      if (s.estado === 'Terminada' || s.LF == null || esLoe(s)) continue;

      switch (r.tipo) {
        case 'FS': lf = Math.min(lf, cal.sumar(s.LS!, -r.lag, 'fin')); break;
        case 'SS': ls = Math.min(ls, cal.sumar(s.LS!, -baseSs(a, r.lag).lag, 'inicio')); break;
        case 'FF': lf = Math.min(lf, cal.sumar(s.LF, -r.lag, 'fin')); break;
        case 'SF': ls = Math.min(ls, cal.sumar(s.LF, -baseSs(a, r.lag).lag, 'inicio')); break;
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
    if (esLoe(a)) { const d = cal.entre(a.ES!, a.EF!); LS = d > 0 ? cal.sumar(LF, -d, 'inicio') : LF; }
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
      const sIni = s.estado !== 'NoIniciada' && s.inicioReal != null ? s.inicioReal : s.ES;
      if (s.estado === 'EnCurso' && (r.tipo === 'SS' || r.tipo === 'SF')) {
        const ss = baseSs(a, r.lag);
        const lim = r.tipo === 'SS' ? a.cal.sumar(s.ES, -ss.lag, 'inicio') : a.cal.sumar(s.EF!, -ss.lag, 'inicio');
        ff = Math.min(ff, a.cal.entre(ss.base, lim));
        continue;
      }
      // Holgura libre: cuánto puede moverse sin retrasar a ninguna sucesora (según el tipo de relación)
      if (r.tipo === 'FS') ff = Math.min(ff, a.cal.entre(a.EF!, a.cal.sumar(sIni, -r.lag, 'fin')));
      else if (r.tipo === 'FF') ff = Math.min(ff, a.cal.entre(a.EF!, a.cal.sumar(s.EF!, -r.lag, 'fin')));
      else if (a.estado === 'NoIniciada') {
        const lim = r.tipo === 'SS' ? a.cal.sumar(sIni, -r.lag, 'inicio') : a.cal.sumar(s.EF!, -r.lag, 'inicio');
        ff = Math.min(ff, a.cal.entre(a.ES!, lim));
      }
    }
    // Sin sucesoras: hasta el fin temprano del proyecto
    if (ff === Infinity) ff = a.cal.entre(a.EF!, finTemprano);
    a.FFl = Math.max(0, ff);
  }

  return { orden, ciclos, finTemprano };
}

/**
 * Relaciones conductoras: las que fijan las fechas tempranas de la sucesora
 * (su restricción coincide con el inicio o el fin temprano calculado).
 * Se llama después de `programar`.
 */
export function relacionesConductoras(acts: ActividadCpm[], rels: Rel[]): Set<Rel> {
  const out = new Set<Rel>();
  for (const r of rels) { const h = holguraRelacion(acts, r); if (h != null && h <= 0) out.add(r); }
  return out;
}

/**
 * Holgura de una relación (minutos de trabajo en el calendario de la sucesora): cuánto podría
 * retrasarse la predecesora sin mover a la sucesora por esta relación. 0 (o menos) = conductora.
 * null si la relación no aplica (sucesora terminada, predecesora LOE, etc.).
 */
export function holguraRelacion(acts: ActividadCpm[], r: Rel): number | null {
  if (r.pred === r.succ) return null;
  const p = acts[r.pred], s = acts[r.succ];
  if (s.estado === 'Terminada' || p.EF == null || s.ES == null || s.EF == null || esLoe(p)) return null;
  const enCurso = s.estado === 'EnCurso';
  if (enCurso && p.estado === 'Terminada') return null;
  const ss = baseSs(p, r.lag);
  const pc = p.cal, sc = s.cal;
  const dif = (a: Minutos, b: Minutos) => (a <= b ? sc.entre(a, b) : -sc.entre(b, a));
  switch (r.tipo) {
    case 'FS': case 'SS': {
      const v = r.tipo === 'FS' ? pc.sumar(p.EF, r.lag, 'fin') : pc.sumar(ss.base, ss.lag, 'inicio');
      return esHitoFin(s) ? dif(sc.aFin(v), s.EF) : dif(sc.aInicio(v), s.ES);
    }
    case 'FF': case 'SF': {
      const v = r.tipo === 'FF' ? pc.sumar(p.EF, r.lag, 'fin') : pc.sumar(ss.base, ss.lag, 'fin');
      return esHitoInicio(s) ? dif(v, s.EF) : dif(sc.aFin(v), s.EF);
    }
  }
  return null;
}

/**
 * Ruta más larga (Longest Path de P6): la cadena de actividades no terminadas que,
 * por relaciones conductoras, lleva al fin temprano del proyecto.
 */
export function rutaMasLarga(acts: ActividadCpm[], rels: Rel[], finTemprano: Minutos): Set<number> {
  const conductoras = relacionesConductoras(acts, rels);
  const predsConduc: Rel[][] = acts.map(() => []);
  for (const r of conductoras) predsConduc[r.succ].push(r);
  const en = new Set<number>();
  const pila: number[] = [];
  acts.forEach((a, i) => { if (a.estado !== 'Terminada' && a.EF === finTemprano) { en.add(i); pila.push(i); } });
  while (pila.length) {
    const i = pila.pop()!;
    for (const r of predsConduc[i]) {
      if (acts[r.pred].estado === 'Terminada' || en.has(r.pred)) continue;
      en.add(r.pred);
      pila.push(r.pred);
    }
  }
  // Los LOE que acaban en una actividad de la ruta también se marcan
  for (const r of rels) if (en.has(r.succ) && esLoe(acts[r.pred]) && acts[r.pred].estado !== 'Terminada') en.add(r.pred);
  return en;
}
