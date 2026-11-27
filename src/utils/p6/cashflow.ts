/**
 * Venta y cashflow de T₃ (vista «Resources»): el costo de las asignaciones (venta, recurso «V») repartido
 * por períodos como en Activity Usage, pero con la regla de cobro del equipamiento:
 *
 *  - Cada equipo es una familia .D (compra y fabricación, 60 %) · .E (flete, 20 %) · .F (instalación, 20 %).
 *    El equipamiento solo se certifica con el flete: la compra (.D) no se cobra cuando se ejecuta, sino junto
 *    con el flete (.E) → el 80 % (D + E) se cobra ENTERO EL DÍA QUE EMPIEZA EL FLETE (decisión del 26-nov-2026).
 *  - Budgeted: la venta de la .D y de la .E, el día de inicio de la línea base de la .E.
 *  - Actual: si el flete ya empezó (Actual Start de la .E), el Actual Cost de la .D y de la .E el día del inicio real
 *    de la .E. Si no ha empezado, el Actual Cost de la .D está «ejecutado sin certificar» (pendiente de flete) y
 *    pasa a Remaining.
 *  - Remaining: lo que falta de la .D (y lo ejecutado sin certificar) y de la .E, el día de inicio restante de la .E
 *    (su inicio temprano; si está en curso, la fecha de datos); si la .E ya terminó, el de la propia .D.
 *  - Fletes nacionales (decisión del 28-nov-2026): los fletes .E que no están en la matriz de importación de Arrivals
 *    (`fletesImportados`; sin «32. Variacion» o con una llave que no aparece en la matriz) cobran su 80 % (compra +
 *    flete) el día que TERMINA el flete: Budgeted en el fin de su línea base; terminado, Actual en su fin real; sin
 *    terminar, todo como Remaining en su fin temprano (lo ejecutado queda «sin certificar»). Los importados, al inicio.
 *  - Corte de cobro de los fletes (decisión del 27-nov-2026): el cobro del flete (80 %) fechado después del día 22
 *    pasa al día 1 del mes siguiente (`aplicarCorte`; día configurable, 0 = sin corte). Solo hacia adelante: a los
 *    cobros fechados desde la fecha de datos (los meses cerrados no se tocan). No afecta a la instalación ni a lo demás.
 *  - WBS «D» (pendientes de confirmar por el Ingeniero, fechas provisionales): todo su Remaining se cobra en un solo
 *    pago el día 1 del mes siguiente a la fecha comodín `FIN_LB_PROVISIONAL` (30-abr-2027 → 1-may-2027).
 *  - Ajustes de remaining (`factorRestante`): a las actividades que cumplen una regla (p. ej. adoquinado de Juana 60 %,
 *    cableado de EECOL 75 %) se les deja cada período de Remaining en ese % y lo descontado va a su último período
 *    con Remaining (el total no cambia).
 *  - Instalación (.F, 20 %; grupo Precom_Eq o con flete .E del mismo prefijo): no se prorratea, se cobra en dos
 *    hitos: 5 % el día que empieza y 95 % el día que termina (`PCT_INICIO_INSTALACION`; 10/90 el 27-nov-2026, 5/95
 *    desde el 28-nov-2026). Budgeted en el inicio y el fin de su línea base; terminada: Actual en el inicio y el fin
 *    reales; en curso: 5 % Actual en el inicio real y 95 % Remaining en el fin temprano (lo ejecutado por encima del
 *    5 % es «ejecutado sin certificar»); sin iniciar: 5 % / 95 % en el inicio y el fin tempranos. Importe = Actual + Remaining Cost.
 *  - Todo lo que se cobra de la .D se MUESTRA EN LA FILA DE SU .E (flete): lo certificable del mes está en el flete;
 *    la .D (Procura_Eq) solo conserva lo «ejecutado sin certificar».
 *  - Lo demás (construcción, .D sin .E…) se cobra cuando se ejecuta, igual que su costo. Un costo real sin inicio
 *    real (Not Started con Venta Ex) se cuenta en la fecha de datos.
 */
import { celda } from './xer';
import type { ModeloP6 } from './modelo';
import { FIN_LB_PROVISIONAL } from './lineaBase';
import { repartir, totalesCosto, ventanasCosto, type LineaBaseFilas, type TramoUso, type UsoActividad } from './uso';

export interface FlujoActividad extends UsoActividad {
  /** Actual Cost ejecutado que aún no se puede certificar (compra .D cuyo flete no ha empezado). */
  pendiente?: number;
}

export interface ResultadoFlujo {
  porAct: Map<number, FlujoActividad>;
  /** Actividades .D que se cobran con su flete (índice .D → índice .E). */
  familias: Map<number, number>;
  /** Instalaciones de equipo (.F) que se cobran en dos hitos: PCT_INICIO_INSTALACION al inicio y el resto al fin. */
  instalaciones: Set<number>;
  /** Fletes nacionales (.E fuera de la matriz de importación): su 80 % se cobra al terminar el flete. */
  nacionales: Set<number>;
  /** Totales de cada actividad (b, a, r) por índice de fila. */
  totales: Map<number, { b: number; a: number; r: number }>;
}

/** ¿Es del grupo de equipamiento (01.Grupos: Ingeniería, Procura_Eq, Flete_Eq, Precom_Eq)? */
/** Parte del importe de una instalación de equipo (.F) que se cobra el día que empieza; el resto, el día que termina. */
export const PCT_INICIO_INSTALACION = 0.05;

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

/** Suma de dos tramos (sobre los mismos períodos). */
function sumarTramos(x?: TramoUso, y?: TramoUso): TramoUso | undefined {
  if (!x) return y;
  if (!y) return x;
  const desde = Math.min(x.desde, y.desde), hasta = Math.max(x.desde + x.vals.length, y.desde + y.vals.length);
  const vals = new Float64Array(hasta - desde);
  for (const t of [x, y]) for (let k = 0; k < t.vals.length; k++) vals[t.desde - desde + k] += t.vals[k];
  return { desde, vals };
}

/**
 * Corte de cobro de los fletes: un cobro de flete (el 80 % de compra + flete) fechado después del día `dia` del mes
 * pasa al día 1 del mes siguiente (decisión del 27-nov-2026: corte el 22). `dia` vacío o 0 = sin corte.
 */
export function aplicarCorte(min: number, dia: number | null | undefined): number {
  if (!dia) return min;
  const d = new Date(min * 60000);
  if (d.getUTCDate() <= dia) return min;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 60000;
}

export function calcularFlujo(m: ModeloP6, lim: number[], lb: LineaBaseFilas, grupo: (i: number) => string, reglaCobro: boolean, corteFlete: number | null = 22, factorRestante?: (i: number) => number | null, fleteNacional?: (iE: number) => boolean): ResultadoFlujo {
  const t = m.task;
  const tot = totalesCosto(m, 'cost');
  const totales = new Map<number, { b: number; a: number; r: number }>();
  t.filas.forEach((f, i) => { const x = tot.get(celda(t, f, 'task_id')); if (x) totales.set(i, x); });
  const familias = reglaCobro ? familiasEquipo(m, grupo) : new Map<number, number>();
  const porAct = new Map<number, FlujoActividad>();
  const put = (i: number, u: FlujoActividad) => { if (u.b || u.a || u.r || u.pendiente) porAct.set(i, u); };
  const rep = (v: number, w: [number, number] | null, cal: Parameters<typeof repartir>[4]): TramoUso | undefined =>
    w ? repartir(v, w[0], w[1], lim, cal) : undefined;

  // Un importe entero en un instante: el inicio de la ventana (o la fecha de datos si no la hay)
  const dd: [number, number] = [m.fechaDatos, m.fechaDatos];
  const pt = (v: number, ...ws: ([number, number] | null)[]): TramoUso | undefined => {
    const w = ws.find(x => x) ?? (v ? dd : null);
    return w ? repartir(v, w[0], w[0], lim) : undefined;
  };
  // Cobro de flete en un instante, con el corte del día `corteFlete` (después de ese día → día 1 del mes siguiente)
  const ptFlete = (v: number, ...ws: ([number, number] | null)[]): TramoUso | undefined => {
    const w = ws.find(x => x) ?? (v ? dd : null);
    if (!w) return undefined;
    // Solo hacia adelante (decisión del 27-nov-2026): lo fechado antes de la fecha de datos no se mueve
    const x = w[0] >= m.fechaDatos ? aplicarCorte(w[0], corteFlete) : w[0];
    return repartir(v, x, x, lim);
  };
  const aFlete: [number, FlujoActividad][] = [];
  const fletes = new Map<number, number>();
  for (const [d, e] of familias) fletes.set(e, d);
  // Fletes nacionales (fuera de la matriz de importación): el cobro va al FIN del flete, no al inicio
  const nacionales = new Set<number>(fleteNacional ? [...fletes.keys()].filter(e => fleteNacional(e)) : []);
  const fin = (w: [number, number] | null | undefined): [number, number] | null => (w ? [w[1], w[1]] : null);
  // Instalación de equipo (.F): grupo Precom_Eq o con un flete de equipo (.E) del mismo prefijo
  const instalaciones = new Set<number>();
  if (reglaCobro) {
    const codE = new Set([...fletes.keys()].map(e => celda(t, t.filas[e], 'task_code').replace(/\.E$/, '')));
    t.filas.forEach((f, i) => {
      const cod = celda(t, f, 'task_code');
      if (/\.F$/.test(cod) && (/precom_eq/i.test(grupo(i)) || codE.has(cod.replace(/\.F$/, '')))) instalaciones.add(i);
    });
  }
  // PCT_INICIO_INSTALACION en el instante a y el resto en el instante b
  const dosHitos = (v: number, a: number | null | undefined, b: number | null | undefined): TramoUso | undefined =>
    sumarTramos(pt(PCT_INICIO_INSTALACION * v, a != null ? [a, a] : null), pt((1 - PCT_INICIO_INSTALACION) * v, b != null ? [b, b] : null));

  for (const [i, x] of totales) {
    const w = ventanasCosto(m, i, lb);
    // Costo real sin inicio real (p. ej. Not Started con Venta Ex): se cobra en la fecha de datos
    if (!w.a && x.a) w.a = dd;
    if (fletes.has(i)) {
      if (nacionales.has(i)) {
        // Flete nacional: su 20 % se cobra entero el día que TERMINA (lo ejecutado antes queda sin certificar)
        const u: FlujoActividad = { b: ptFlete(x.b, fin(w.b)) };
        if (w.estado === 'TK_Complete') u.a = ptFlete(x.a, fin(w.a));
        else {
          u.r = ptFlete(x.a + x.r, fin(w.r), fin(w.a));
          if (x.a > 0.005) u.pendiente = x.a;
        }
        put(i, u);
        continue;
      }
      // Flete importado: su 20 % se cobra entero el día que empieza
      put(i, { b: ptFlete(x.b, w.b), a: ptFlete(x.a, w.a), r: ptFlete(x.r, w.r) });
      continue;
    }
    if (instalaciones.has(i)) {
      // Instalación de equipo: 5 % el día que empieza y 95 % el día que termina (no se prorratea)
      const T = x.a + x.r;
      const real = w.estado !== 'TK_NotStart' && w.a;
      const u: FlujoActividad = { b: w.b ? dosHitos(x.b, w.b[0], w.b[1]) : pt(x.b, w.b) };
      if (w.estado === 'TK_Complete' && w.a) {
        u.a = dosHitos(T, w.a[0], w.a[1]);
      } else if (real) {
        u.a = pt(PCT_INICIO_INSTALACION * T, w.a);
        u.r = pt((1 - PCT_INICIO_INSTALACION) * T, w.r ? [w.r[1], w.r[1]] : null);
        if (x.a - PCT_INICIO_INSTALACION * T > 0.005) u.pendiente = x.a - PCT_INICIO_INSTALACION * T;
      } else {
        u.r = w.r ? dosHitos(T, w.r[0], w.r[1]) : pt(T, null);
        if (x.a > 0.005) u.pendiente = x.a;
      }
      put(i, u);
      continue;
    }
    const j = familias.get(i);
    if (j == null || !reglaCobro) {
      put(i, { b: rep(x.b, w.b, w.cal), a: rep(x.a, w.a, w.cal), r: rep(x.r, w.r, w.cal) });
      continue;
    }
    // Compra de equipo: su 60 % se cobra entero el día que empieza su flete y se muestra en la fila del flete
    // (lo certificable del mes está en el flete); la compra solo conserva lo ejecutado sin certificar.
    const we = ventanasCosto(m, j, lb);
    if (nacionales.has(j)) {
      // Flete nacional: el 60 % de la compra se cobra el día que TERMINA su flete
      const u: FlujoActividad = { b: ptFlete(x.b, fin(we.b), fin(w.b)) };
      if (we.estado === 'TK_Complete') {
        u.a = ptFlete(x.a, fin(we.a));
        u.r = ptFlete(x.r, fin(w.r));
      } else {
        u.r = ptFlete(x.a + x.r, fin(we.r), fin(w.r));
        if (x.a) put(i, { pendiente: x.a });
      }
      aFlete.push([j, u]);
      continue;
    }
    const u: FlujoActividad = { b: ptFlete(x.b, we.b, w.b) };
    if (we.a) {
      u.a = ptFlete(x.a, we.a);
      u.r = ptFlete(x.r, we.r, w.r);
    } else {
      u.r = ptFlete(x.a + x.r, we.r, w.r);
      if (x.a) put(i, { pendiente: x.a });
    }
    aFlete.push([j, u]);
  }
  for (const [j, u] of aFlete) {
    const e = porAct.get(j) ?? {};
    put(j, { ...e, b: sumarTramos(e.b, u.b), a: sumarTramos(e.a, u.a), r: sumarTramos(e.r, u.r) });
  }
  // WBS «D» (pendientes de confirmar por el Ingeniero, fechas provisionales 30-abr-27): todo su Remaining se cobra
  // en un solo pago el día 1 del mes siguiente a la fecha comodín FIN_LB_PROVISIONAL (1-may-2027). Decisión del 27-nov-2026.
  const w = m.xer.tablas.get('PROJWBS');
  const nodo = new Map((w?.filas || []).map(f => [celda(w!, f, 'wbs_id'), { padre: celda(w!, f, 'parent_wbs_id'), cod: celda(w!, f, 'wbs_short_name') }]));
  const enD = new Map<string, boolean>();
  const esWbsD = (id: string): boolean => {
    if (enD.has(id)) return enD.get(id)!;
    const ruta: string[] = [];
    for (let x = nodo.get(id); x; x = nodo.get(x.padre)) ruta.unshift(x.cod);
    const r = ruta[1] === 'D';
    enD.set(id, r);
    return r;
  };
  const pendientesD: number[] = [];
  for (const i of porAct.keys()) if (esWbsD(celda(t, t.filas[i], 'wbs_id'))) pendientesD.push(i);
  if (pendientesD.length) {
    // Mes siguiente a la fecha comodín de las partidas provisionales (30-abr-2027 → 1-may-2027)
    const d = new Date(`${FIN_LB_PROVISIONAL}T00:00:00Z`);
    const cobro = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 60000;
    for (const i of pendientesD) {
      const u = porAct.get(i)!;
      if (!u.r) continue;
      const tot = u.r.vals.reduce((a, b) => a + b, 0);
      porAct.set(i, { ...u, r: tot ? repartir(tot, cobro, cobro, lim) : undefined });
    }
  }

  // Ajustes de remaining: cada período al factor y el saldo al último período con Remaining
  if (factorRestante) {
    for (const [i, u] of porAct) {
      const f = factorRestante(i);
      if (f == null || f >= 1 || !u.r) continue;
      const vals = u.r.vals.slice();
      let ult = -1, saldo = 0;
      for (let k = 0; k < vals.length; k++) if (Math.abs(vals[k]) > 1e-9) { ult = k; saldo += vals[k] * (1 - f); vals[k] *= f; }
      if (ult < 0) continue;
      vals[ult] += saldo;
      porAct.set(i, { ...u, r: { desde: u.r.desde, vals } });
    }
  }
  return { porAct, familias, totales, instalaciones, nacionales };
}
