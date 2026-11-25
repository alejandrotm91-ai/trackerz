/**
 * Hoja «r.» del Master en M₃: el mismo resumen que la pestaña «r.» del Excel, calculado con lo que se
 * ve en M₃ (avance de las semanas) y con el Master de la app (plan, balance y status de cada actividad).
 *
 * Fórmulas del Excel (pestaña «r.»):
 *  - Por partida (columna AC del cdo) y por gran partida (columna Z «Grupos»):
 *      Presupuesto = SUMAR.SI(…, Venta I) · Plan = SUMAR.SI(…, Venta_Plan AO) · Avance = SUMAR.SI(…, Venta Ex AR)
 *      % Plan = Plan / presupuesto total · % Avance = Avance / presupuesto total · % Variación = % Avance − % Plan
 *  - Por ubicación: Merinos = P01…P14 + P17, Progreso = P16, Guayacanes = P15 (y su % sobre su presupuesto).
 *  - Status (columna AI): SUMAR.SI(Status, Balance AN) para Fin_Shortage, Fin_Overrun, Ahead, Delayed, Not Started.
 *  - Mes: venta de cada semana del mes (fila de totales del cdo) y su suma.
 *  - Avance acumulado, avance de la semana actual y acumulado anterior.
 *  - Desviación total = Avance − Plan; desviación real = desviación total + ajustes que se escriben a mano.
 *
 * En M₃ las actividades p6 valen la suma de sus partidas: su propia fila no suma venta ni avance (como en el
 * Excel, donde la fila .p6 no tiene Venta ni Venta Ex), pero sí aporta su plan, balance y status.
 */
import type { MasterCdoItem, MasterCdoWeek } from '../types/masterCdo';
import type { Actividad } from '../types';
import { ventaDeFila } from './masterCdoHierarchy';

export interface FilaR {
  nombre: string;
  presupuesto: number;
  plan: number;
  avance: number;
  pctPlan: number;
  pctAvance: number;
  pctVariacion: number;
}

export interface ResumenR {
  partidas: FilaR[];
  totalPartidas: FilaR;
  grandes: FilaR[];
  totalGrandes: FilaR;
  ubicaciones: FilaR[]; // % sobre el presupuesto de cada ubicación
  totalUbicaciones: FilaR;
  status: { nombre: string; avance: number; pct: number }[];
  totalStatus: { avance: number; pct: number };
  mes: { semanas: { id: string; etiqueta: string; venta: number }[]; total: number };
  acumulado: number;
  actual: { etiqueta: string; venta: number } | null;
  anterior: { etiqueta: string; venta: number } | null;
  diferencias: number;
  desviacionTotal: number;
}

export const STATUS_R = ['Fin_Shortage', 'Fin_Overrun', 'Ahead', 'Delayed', 'Not Started'];
const SIN_DATO = '(sin dato)';
const fechaDe = (w: MasterCdoWeek) => (w.fecha || w.id || '').slice(0, 10);
const MES_CORTO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** «V-04-Oct-26», como las cabeceras de venta del cdo. */
export function etiquetaV(w: MasterCdoWeek): string {
  const f = fechaDe(w);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return w.label || w.id;
  return `V-${f.slice(8, 10)}-${MES_CORTO[Number(f.slice(5, 7)) - 1]}-${f.slice(2, 4)}`;
}

const fila = (nombre: string, presupuesto: number, plan: number, avance: number, base: number): FilaR => {
  const pctPlan = base ? plan / base : 0, pctAvance = base ? avance / base : 0;
  return { nombre, presupuesto, plan, avance, pctPlan, pctAvance, pctVariacion: pctAvance - pctPlan };
};

export function calcularResumenR(
  items: MasterCdoItem[],
  semanas: MasterCdoWeek[],
  actividades: Actividad[],
  mes: string, // 'AAAA-MM'
): ResumenR {
  const actPorId = new Map<string, Actividad>();
  for (const a of actividades) if (a.activityId) actPorId.set(String(a.activityId).trim().toLowerCase(), a);
  const idsP6 = new Set(items.map(i => String(i.parentActivityId || '').trim().toLowerCase()).filter(Boolean));

  type Acum = { presupuesto: number; plan: number; avance: number };
  const porPartida = new Map<string, Acum>(), porGrupo = new Map<string, Acum>();
  const porStatus = new Map<string, number>();
  const ventaSemana = new Map<string, number>();
  const sumar = (m: Map<string, Acum>, k: string, campo: keyof Acum, v: number) => {
    if (!v) return;
    if (!m.has(k)) m.set(k, { presupuesto: 0, plan: 0, avance: 0 });
    m.get(k)![campo] += v;
  };

  for (const it of items) {
    if (it.esItemHoja === false) continue;
    const aid = String(it.activityId || '').trim().toLowerCase();
    const padre = it.parentActivityId ? actPorId.get(String(it.parentActivityId).trim().toLowerCase()) : undefined;
    const act = aid ? actPorId.get(aid) : undefined;
    const partida = String(it.partidas || act?.partidas || padre?.partidas || '').trim() || SIN_DATO;
    const grupo = String(it.grupo || act?.grupo || padre?.grupo || '').trim() || SIN_DATO;
    const esFilaP6 = !it.parentActivityId && aid && idsP6.has(aid);

    // Venta y avance: las partidas (las p6 por sus rubros)
    if (!esFilaP6) {
      const venta = ventaDeFila(it);
      sumar(porPartida, partida, 'presupuesto', venta);
      sumar(porGrupo, grupo, 'presupuesto', venta);
      let avance = 0;
      for (const [w, v] of Object.entries(it.ventasSemanales || {})) {
        const n = Number(v) || 0;
        avance += n;
        ventaSemana.set(w, (ventaSemana.get(w) || 0) + n);
      }
      sumar(porPartida, partida, 'avance', avance);
      sumar(porGrupo, grupo, 'avance', avance);
    }
    // Plan, balance y status: por actividad (las filas normales y las .p6, no sus rubros)
    if (!it.parentActivityId && act) {
      const plan = Number(act.ventaPlan) || 0;
      sumar(porPartida, partida, 'plan', plan);
      sumar(porGrupo, grupo, 'plan', plan);
    }
  }
  // Status: SUMAR.SI(Status AI, Balance AN) sobre todas las filas del cdo (actividades y rubros de las p6)
  const sumarStatus = (st: unknown, bal: unknown) => {
    const k = String(st || '').trim();
    if (k) porStatus.set(k, (porStatus.get(k) || 0) + (Number(bal) || 0));
  };
  for (const a of actividades) {
    if (!a.esItemHoja) continue;
    sumarStatus(a.statusPlazo, a.balance);
    for (const h of a.hijosP6 || []) sumarStatus(h.statusPlazo, h.balance);
  }

  const total = (m: Map<string, Acum>) => [...m.values()].reduce((s, a) => ({
    presupuesto: s.presupuesto + a.presupuesto, plan: s.plan + a.plan, avance: s.avance + a.avance,
  }), { presupuesto: 0, plan: 0, avance: 0 });
  const tP = total(porPartida);
  const base = tP.presupuesto; // como 'pg-004'!F2: el presupuesto total del contrato
  const ordenar = (m: Map<string, Acum>) => [...m.entries()]
    .sort(([a], [b]) => (a === SIN_DATO ? 1 : b === SIN_DATO ? -1 : a.localeCompare(b, 'es', { numeric: true })))
    .map(([k, a]) => fila(k, a.presupuesto, a.plan, a.avance, base));
  const tG = total(porGrupo);

  // Ubicaciones por código de partida
  const ubic = { Merinos: { presupuesto: 0, plan: 0, avance: 0 }, Progreso: { presupuesto: 0, plan: 0, avance: 0 }, Guayacanes: { presupuesto: 0, plan: 0, avance: 0 } };
  for (const [k, a] of porPartida) {
    const cod = (k.match(/^P(\d+)/i) || [])[1];
    const u = cod === '16' ? ubic.Progreso : cod === '15' ? ubic.Guayacanes : ubic.Merinos;
    u.presupuesto += a.presupuesto; u.plan += a.plan; u.avance += a.avance;
  }
  const ubicaciones = (Object.keys(ubic) as (keyof typeof ubic)[]).map(n => fila(n, ubic[n].presupuesto, ubic[n].plan, ubic[n].avance, ubic[n].presupuesto));

  // Status
  const status = STATUS_R.map(n => ({ nombre: n, avance: porStatus.get(n) || 0, pct: base ? (porStatus.get(n) || 0) / base : 0 }));
  const otros = [...porStatus.entries()].filter(([k]) => !STATUS_R.includes(k));
  for (const [k, v] of otros) status.push({ nombre: k, avance: v, pct: base ? v / base : 0 });
  const totStatus = status.reduce((s, x) => s + x.avance, 0);

  // Mes y avance actual / anterior
  const ordenadas = [...semanas].sort((a, b) => fechaDe(a).localeCompare(fechaDe(b)));
  const delMes = ordenadas.filter(w => fechaDe(w).startsWith(mes));
  const semanasMes = delMes.map(w => ({ id: w.id, etiqueta: etiquetaV(w), venta: ventaSemana.get(w.id) || 0 }));
  const conVenta = semanasMes.filter(s => s.venta !== 0);
  const actualW = conVenta.length ? conVenta[conVenta.length - 1] : null;
  const acumulado = tP.avance;
  let anterior: { etiqueta: string; venta: number } | null = null;
  if (actualW) {
    const i = ordenadas.findIndex(w => w.id === actualW.id);
    const previa = i > 0 ? ordenadas[i - 1] : null;
    const hastaPrevia = ordenadas.slice(0, Math.max(0, i)).reduce((s, w) => s + (ventaSemana.get(w.id) || 0), 0);
    anterior = { etiqueta: previa ? etiquetaV(previa) : '—', venta: hastaPrevia };
  }
  const diferencias = acumulado - (actualW?.venta || 0) - (anterior?.venta || 0);

  return {
    partidas: ordenar(porPartida),
    totalPartidas: fila('Total', tP.presupuesto, tP.plan, tP.avance, base),
    grandes: ordenar(porGrupo),
    totalGrandes: fila('Total', tG.presupuesto, tG.plan, tG.avance, base),
    ubicaciones,
    totalUbicaciones: fila('Total', tP.presupuesto, tP.plan, tP.avance, tP.presupuesto),
    status,
    totalStatus: { avance: totStatus, pct: base ? totStatus / base : 0 },
    mes: { semanas: semanasMes, total: semanasMes.reduce((s, x) => s + x.venta, 0) },
    acumulado,
    actual: actualW ? { etiqueta: actualW.etiqueta, venta: actualW.venta } : null,
    anterior,
    diferencias,
    desviacionTotal: tP.avance - tP.plan,
  };
}
