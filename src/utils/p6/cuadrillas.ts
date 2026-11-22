/**
 * Tamaño de cuadrilla (personas) por subcontratista, estimado con la matriz de personal:
 *
 *   personas por actividad en curso = personal DIRECTO diario medio de la empresa en la matriz
 *                                   ÷ actividades suyas en curso a la vez según las fechas reales del XER,
 *
 * Puede ser menor que 1 cuando la empresa tiene muchas actividades abiertas para poca gente (una
 * cuadrilla repartida entre varios frentes); así el personal calculado cuadra con el real.
 *
 * en las últimas `semanas` antes de la fecha de datos (solo los días con registro de la empresa).
 * El campo SubC del XER/Master no se escribe igual que la empresa de la matriz (CDCONS / CDECONS,
 * Zigman / SIGMAN, Acerser / ACERSERV…): se emparejan por parecido.
 */
import { celda } from './xer';
import { aMinutos } from './calendario';
import type { ModeloP6 } from './modelo';

export interface RegistroPersonal { fechaIso: string; empresa: string; total: number; tipo?: string }

export interface EstimacionCuadrilla {
  subc: string;
  empresa: string | null;
  /** Personal directo diario medio en la ventana. */
  personal: number | null;
  /** Actividades del subcontratista trabajando a la vez (media de esos días). */
  simultaneas: number | null;
  /** Personas por cuadrilla estimadas (null si no hay datos suficientes). */
  estimado: number | null;
  dias: number;
}

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\b(s\.?a\.?|cia|ltda)\b/g, '').replace(/\.\d+$/, '').replace(/[^a-z0-9]/g, '');

function distancia(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Empresa de la matriz que corresponde a un SubC (o null). */
export function emparejar(subc: string, empresas: string[]): string | null {
  const s = normal(subc);
  if (s.length < 3) return null;
  let mejor: { e: string; p: number } | null = null;
  for (const e of empresas) {
    const n = normal(e);
    if (!n) continue;
    let p = -1;
    if (n === s) p = 100;
    else if ((n.startsWith(s) || s.startsWith(n)) && Math.min(n.length, s.length) >= 3) p = 80 - Math.abs(n.length - s.length);
    else {
      const dd = distancia(s, n), largo = Math.min(s.length, n.length);
      if ((largo >= 5 && dd <= 1) || (largo >= 7 && dd <= 2)) p = 60 - dd;
    }
    if (p > (mejor?.p ?? -1)) mejor = { e, p };
  }
  return mejor && mejor.p >= 0 ? mejor.e : null;
}

/** Estimación por subcontratista con la matriz de personal. */
export function estimarCuadrillas(
  m: ModeloP6, subcDe: (i: number) => string, incluir: (i: number) => boolean,
  registros: RegistroPersonal[], semanas = 8,
): Map<string, EstimacionCuadrilla> {
  const out = new Map<string, EstimacionCuadrilla>();
  const t = m.task;
  // Actividades con fechas reales por subcontratista
  const porSubc = new Map<string, { ini: number; fin: number }[]>();
  t.filas.forEach((f, i) => {
    if (!incluir(i)) return;
    const s = subcDe(i);
    if (!s) return;
    const lista = porSubc.get(s) ?? [];
    porSubc.set(s, lista);
    const as = aMinutos(celda(t, f, 'act_start_date'));
    if (as == null) return;
    const af = celda(t, f, 'status_code') === 'TK_Complete' ? aMinutos(celda(t, f, 'act_end_date')) : m.fechaDatos;
    lista.push({ ini: as, fin: af ?? m.fechaDatos });
  });
  // Personal directo diario por empresa, en la ventana
  const hasta = new Date(m.fechaDatos * 60000).toISOString().slice(0, 10);
  const desde = new Date((m.fechaDatos - semanas * 7 * 1440) * 60000).toISOString().slice(0, 10);
  const diario = new Map<string, Map<string, number>>();
  for (const r of registros) {
    if (!r.fechaIso || r.fechaIso < desde || r.fechaIso > hasta) continue;
    if (r.tipo && r.tipo !== 'Directo') continue;
    const e = r.empresa;
    const d = diario.get(e) ?? new Map<string, number>();
    d.set(r.fechaIso, (d.get(r.fechaIso) ?? 0) + (Number(r.total) || 0));
    diario.set(e, d);
  }
  const empresas = [...diario.keys()];
  // Varios SubC pueden ser la misma empresa (INTEC / Intec): se calibran juntos para no contarla dos veces
  const empresaDe = new Map<string, string | null>();
  const actsEmpresa = new Map<string, { ini: number; fin: number }[]>();
  for (const [subc, acts] of porSubc) {
    const e = emparejar(subc, empresas);
    empresaDe.set(subc, e);
    if (e) actsEmpresa.set(e, [...(actsEmpresa.get(e) ?? []), ...acts]);
  }
  const calib = new Map<string, { personal: number; simultaneas: number; dias: number }>();
  for (const [e, acts] of actsEmpresa) {
    const dias = diario.get(e)!;
    let sumP = 0, sumA = 0, n = 0;
    for (const [fecha, p] of dias) {
      if (p <= 0) continue;
      const t0 = Date.parse(`${fecha}T12:00:00Z`) / 60000;
      sumP += p; n++;
      sumA += acts.reduce((a, x) => a + (x.ini <= t0 && t0 <= x.fin + 1440 ? 1 : 0), 0);
    }
    if (n) calib.set(e, { personal: sumP / n, simultaneas: sumA / n, dias: n });
  }
  for (const subc of porSubc.keys()) {
    const empresa = empresaDe.get(subc) ?? null;
    const c = empresa ? calib.get(empresa) : undefined;
    const est: EstimacionCuadrilla = { subc, empresa, personal: c?.personal ?? null, simultaneas: c?.simultaneas ?? null, estimado: null, dias: c?.dias ?? 0 };
    // Personas por actividad en curso (puede ser < 1: una cuadrilla repartida entre varios frentes)
    if (c && c.simultaneas >= 0.5) est.estimado = Math.max(0.1, Math.round((c.personal / c.simultaneas) * 10) / 10);
    out.set(subc, est);
  }
  return out;
}

/** Personas por cuadrilla para los SubC sin datos en la matriz (editable en el panel). */
export const POR_DEFECTO = 4;
