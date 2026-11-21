/**
 * «Activity Usage» como en P6: unidades o costos de las asignaciones de recursos de cada
 * actividad repartidos por períodos de la escala de tiempo.
 * Reparto uniforme en el TIEMPO LABORABLE del calendario de cada actividad (los días y horas
 * no laborables no reciben valor), sobre las fechas de cada valor:
 *  - Budgeted (planificado): entre el inicio y el fin planificados (target_start/end_date).
 *  - Actual: entre el inicio real y el fin real (o la fecha de datos si sigue en curso).
 *  - Remaining: entre el inicio del trabajo restante y el fin temprano.
 */
import { aMinutos } from './calendario';
import { celda } from './xer';
import type { ModeloP6 } from './modelo';
import type { Calendario } from './calendario';

export type MedidaUso = 'units' | 'cost';
export type SerieUso = 'b' | 'a' | 'r';

/** Valores por período de una actividad (solo el tramo con datos, para ahorrar memoria). */
export interface TramoUso { desde: number; vals: Float64Array }
export type UsoActividad = Partial<Record<SerieUso, TramoUso>>;

/** Límites de los períodos (minutos) según la escala del Gantt. */
export function periodosDeEscala(desde: number, hasta: number, px: number): { t: number; etq: string }[] {
  const out: { t: number; etq: string }[] = [];
  const MES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date(desde * 60000);
  if (px >= 8) {
    // Semanas (lunes)
    const dia = (d.getUTCDay() + 6) % 7;
    let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dia) / 60000;
    while (t <= hasta + 7 * 1440) {
      const x = new Date(t * 60000);
      out.push({ t, etq: `${String(x.getUTCDate()).padStart(2, '0')}-${MES[x.getUTCMonth()]}` });
      t += 7 * 1440;
    }
    return out;
  }
  const paso = px >= 3 ? 1 : px >= 1 ? 3 : 12;
  let y = d.getUTCFullYear(), mo = paso === 12 ? 0 : Math.floor(d.getUTCMonth() / paso) * paso;
  for (;;) {
    const t = Date.UTC(y, mo, 1) / 60000;
    out.push({ t, etq: paso === 12 ? String(y) : paso === 3 ? `Q${mo / 3 + 1} ${String(y).slice(2)}` : `${MES[mo]} ${String(y).slice(2)}` });
    if (t > hasta) break;
    mo += paso; while (mo > 11) { mo -= 12; y++; }
  }
  return out;
}

/**
 * Reparte `valor` entre [ini, fin] sobre los períodos `lim` (límites), en proporción al tiempo
 * laborable del calendario `cal` que cae en cada período (si no hay tiempo laborable, por tiempo natural).
 */
function repartir(valor: number, ini: number, fin: number, lim: number[], cal?: Calendario): TramoUso | undefined {
  if (!valor || !isFinite(ini) || !isFinite(fin)) return undefined;
  if (fin < ini) [ini, fin] = [fin, ini];
  // Período de un instante (búsqueda binaria)
  const per = (t: number) => {
    let a = 0, b = lim.length - 2;
    if (t < lim[0]) return 0;
    if (t >= lim[lim.length - 1]) return lim.length - 2;
    while (a < b) { const mid = (a + b + 1) >> 1; if (lim[mid] <= t) a = mid; else b = mid - 1; }
    return a;
  };
  const p0 = per(ini), p1 = per(Math.max(ini, fin - 1e-6));
  const vals = new Float64Array(p1 - p0 + 1);
  if (fin === ini) { vals[0] = valor; return { desde: p0, vals }; }
  const laborable = cal ? cal.entre(ini, fin) : 0;
  const peso = laborable > 0 ? (a: number, b: number) => cal!.entre(a, b) : (a: number, b: number) => b - a;
  const total = laborable > 0 ? laborable : fin - ini;
  for (let k = p0; k <= p1; k++) {
    const a = Math.max(ini, lim[k]), b = Math.min(fin, lim[k + 1]);
    if (b > a) vals[k - p0] = (valor * peso(a, b)) / total;
  }
  return { desde: p0, vals };
}

/** Uso por actividad (índice de fila de TASK) para la medida elegida. */
export function calcularUso(m: ModeloP6, lim: number[], medida: MedidaUso): Map<number, UsoActividad> {
  const out = new Map<number, UsoActividad>();
  const tr = m.xer.tablas.get('TASKRSRC');
  if (!tr) return out;
  const n = (f: string[], c: string) => Number(celda(tr, f, c)) || 0;
  // Totales por actividad
  const tot = new Map<string, { b: number; a: number; r: number }>();
  for (const f of tr.filas) {
    const id = celda(tr, f, 'task_id');
    const x = tot.get(id) ?? { b: 0, a: 0, r: 0 };
    if (medida === 'units') { x.b += n(f, 'target_qty'); x.a += n(f, 'act_reg_qty') + n(f, 'act_ot_qty'); x.r += n(f, 'remain_qty'); }
    else { x.b += n(f, 'target_cost'); x.a += n(f, 'act_reg_cost') + n(f, 'act_ot_cost'); x.r += n(f, 'remain_cost'); }
    tot.set(id, x);
  }
  const t = m.task;
  t.filas.forEach((f, i) => {
    const x = tot.get(celda(t, f, 'task_id'));
    if (!x) return;
    const g = (c: string) => aMinutos(celda(t, f, c));
    const estado = celda(t, f, 'status_code');
    const es = g('early_start_date'), ef = g('early_end_date');
    const as = g('act_start_date'), af = g('act_end_date');
    const ps = g('target_start_date') ?? es ?? as, pf = g('target_end_date') ?? ef ?? af;
    const cal = m.calendarios.get(celda(t, f, 'clndr_id'));
    const u: UsoActividad = {};
    if (ps != null && pf != null) u.b = repartir(x.b, ps, pf, lim, cal);
    if (as != null) u.a = repartir(x.a, as, estado === 'TK_Complete' && af != null ? af : Math.max(as, m.fechaDatos), lim, cal);
    const rs = estado === 'TK_Active' ? (es ?? m.fechaDatos) : (es ?? as);
    if (estado !== 'TK_Complete' && rs != null && ef != null) u.r = repartir(x.r, Math.max(rs, estado === 'TK_Active' ? m.fechaDatos : rs), ef, lim, cal);
    if (u.b || u.a || u.r) out.set(i, u);
  });
  return out;
}

/** Suma un tramo en un acumulador de todos los períodos. */
export function sumarTramo(acc: Float64Array, tramo: TramoUso | undefined) {
  if (!tramo) return;
  for (let k = 0; k < tramo.vals.length; k++) acc[tramo.desde + k] += tramo.vals[k];
}

/** Formato compacto para las celdas (1.2M, 3.9K, 12.5). */
export function compacto(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
  if (a >= 1e4) return `${(v / 1e3).toFixed(0)}K`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  if (a >= 100) return v.toFixed(0);
  return v.toFixed(a < 10 ? 2 : 1);
}
