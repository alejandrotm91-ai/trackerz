/**
 * Venta y cashflow de T₃ (vista «Resources»): el costo de las asignaciones (venta, recurso «V») repartido
 * por períodos como en Activity Usage, pero con la regla de cobro del equipamiento:
 *
 *  - Cada equipo es una familia .D (compra y fabricación, 60 %) · .E (flete, 20 %) · .F (instalación, 20 %).
 *    El equipamiento solo se certifica con el flete: la compra (.D) no se cobra cuando se ejecuta, sino junto
 *    con el flete (.E) → el 80 % (D + E) se cobra en el tiempo del flete. La instalación (.F) se cobra cuando se ejecuta.
 *  - Budgeted: la venta de la .D se reparte en la ventana de línea base de su .E.
 *  - Actual: si el flete ya empezó (Actual Start de la .E), el Actual Cost de la .D se cobra en la ventana real
 *    de la .E (inicio real → fin real o fecha de datos). Si no ha empezado, ese Actual Cost está «ejecutado sin
 *    certificar» (pendiente de flete) y pasa a Remaining.
 *  - Remaining: lo que falta de la .D (y lo ejecutado sin certificar) se cobra en la ventana restante de la .E
 *    (inicio restante → fin temprano); si la .E ya terminó, en la propia ventana restante de la .D.
 *  - Lo demás (construcción, .D sin .E…) se cobra cuando se ejecuta, igual que su costo. Un costo real sin inicio
 *    real (Not Started con Venta Ex) se cuenta en la fecha de datos.
 */
import { celda } from './xer';
import type { ModeloP6 } from './modelo';
import { repartir, totalesCosto, ventanasCosto, type LineaBaseFilas, type TramoUso, type UsoActividad } from './uso';

export interface FlujoActividad extends UsoActividad {
  /** Actual Cost ejecutado que aún no se puede certificar (compra .D cuyo flete no ha empezado). */
  pendiente?: number;
}

export interface ResultadoFlujo {
  porAct: Map<number, FlujoActividad>;
  /** Actividades .D que se cobran con su flete (índice .D → índice .E). */
  familias: Map<number, number>;
  /** Totales de cada actividad (b, a, r) por índice de fila. */
  totales: Map<number, { b: number; a: number; r: number }>;
}

/** ¿Es del grupo de equipamiento (01.Grupos: Ingeniería, Procura_Eq, Flete_Eq, Precom_Eq)? */
export const esGrupoEquipo = (g: string) => /_eq\.?$|ingenier/i.test((g || '').trim());

/**
 * Familias .D → .E de equipos: mismo prefijo de Activity ID, la .D de compra (grupo Procura_Eq o nombre «Compra…»)
 * y la .E de flete (grupo Flete_Eq o nombre «Flete…»).
 */
export function familiasEquipo(m: ModeloP6, grupo: (i: number) => string): Map<number, number> {
  const t = m.task;
  const porCod = new Map<string, number>();
  t.filas.forEach((f, i) => porCod.set(celda(t, f, 'task_code'), i));
  const out = new Map<number, number>();
  for (const [cod, i] of porCod) {
    const mm = /^(.*)\.D$/.exec(cod);
    if (!mm) continue;
    const j = porCod.get(`${mm[1]}.E`);
    if (j == null) continue;
    const nd = celda(t, t.filas[i], 'task_name').trim(), ne = celda(t, t.filas[j], 'task_name').trim();
    const esCompra = /procura_eq/i.test(grupo(i)) || /^compr/i.test(nd);
    const esFlete = /flete_eq/i.test(grupo(j)) || /^flete/i.test(ne);
    if (esCompra && esFlete) out.set(i, j);
  }
  return out;
}

export function calcularFlujo(m: ModeloP6, lim: number[], lb: LineaBaseFilas, grupo: (i: number) => string, reglaCobro: boolean): ResultadoFlujo {
  const t = m.task;
  const tot = totalesCosto(m, 'cost');
  const totales = new Map<number, { b: number; a: number; r: number }>();
  t.filas.forEach((f, i) => { const x = tot.get(celda(t, f, 'task_id')); if (x) totales.set(i, x); });
  const familias = reglaCobro ? familiasEquipo(m, grupo) : new Map<number, number>();
  const porAct = new Map<number, FlujoActividad>();
  const put = (i: number, u: FlujoActividad) => { if (u.b || u.a || u.r || u.pendiente) porAct.set(i, u); };
  const rep = (v: number, w: [number, number] | null, cal: Parameters<typeof repartir>[4]): TramoUso | undefined =>
    w ? repartir(v, w[0], w[1], lim, cal) : undefined;

  for (const [i, x] of totales) {
    const w = ventanasCosto(m, i, lb);
    // Costo real sin inicio real (p. ej. Not Started con Venta Ex): se cobra en la fecha de datos
    if (!w.a && x.a) w.a = [m.fechaDatos, m.fechaDatos];
    const j = familias.get(i);
    if (j == null) {
      put(i, { b: rep(x.b, w.b, w.cal), a: rep(x.a, w.a, w.cal), r: rep(x.r, w.r, w.cal) });
      continue;
    }
    // Compra de equipo: se cobra con su flete
    const we = ventanasCosto(m, j, lb);
    const fleteIniciado = we.a != null;
    const u: FlujoActividad = { b: we.b ? rep(x.b, we.b, we.cal) : rep(x.b, w.b, w.cal) };
    if (fleteIniciado) {
      u.a = rep(x.a, we.a, we.cal);
      u.r = we.r ? rep(x.r, we.r, we.cal) : rep(x.r, w.r, w.cal);
    } else {
      u.pendiente = x.a;
      const resto = x.a + x.r;
      // Sin ventana restante del flete (raro): en la fecha de datos
      u.r = we.r ? rep(resto, we.r, we.cal) : w.r ? rep(resto, w.r, w.cal) : rep(resto, [m.fechaDatos, m.fechaDatos], w.cal);
    }
    put(i, u);
  }
  return { porAct, familias, totales };
}
