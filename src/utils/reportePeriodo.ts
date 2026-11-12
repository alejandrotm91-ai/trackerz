/**
 * Cifras del reporte de avance de obra por período (botón Inteligencia → Reporte por período).
 * Usa la misma lógica que la tabla Control de Ejecución con el filtro "Período / Semana":
 * V. Plan = PG-004 por semana y V. Ejec = CDO (columnas V-) por semana, sumados en las
 * semanas elegidas. El avance acumulado suma todas las semanas hasta el cierre del período.
 */
import type { Actividad } from '../types';
import type { ReportePeriodoDatos, ResumenPeriodo, PartidaPeriodo } from '../types/reportePeriodo';

const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const fechaRazonable = (k: string) => {
  if (!ES_FECHA.test(k)) return false;
  const y = parseInt(k.slice(0, 4), 10);
  return y >= 2020 && y <= 2040;
};

type DictPG004 = Record<string, Record<string, number>> | null | undefined;

/** Índice del PG-004 en minúsculas (para cruzar por Activity ID o WBS sin importar mayúsculas). */
function indicePG004(pg004: DictPG004): Record<string, Record<string, number>> {
  const idx: Record<string, Record<string, number>> = {};
  if (pg004) Object.keys(pg004).forEach(k => { idx[k.toLowerCase().trim()] = pg004[k]; });
  return idx;
}

function planDe(item: Actividad, pg004: DictPG004, idx: Record<string, Record<string, number>>) {
  if (item.planificadoPorFechaPG004 && Object.keys(item.planificadoPorFechaPG004).length > 0) return item.planificadoPorFechaPG004;
  if (!pg004) return null;
  const act = item.activityId ? String(item.activityId).trim() : '';
  const wbs = item.wbs ? String(item.wbs).trim() : '';
  return (item.activityId && pg004[item.activityId]) || (act && pg004[act]) || (act && idx[act.toLowerCase()])
    || (wbs && pg004[wbs]) || (wbs && idx[wbs.toLowerCase()]) || null;
}

function isoDe(d: any): string | null {
  if (!d) return null;
  if (typeof d === 'string') {
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** V. Plan y V. Ejec de una partida en un conjunto de semanas (igual que Control de Ejecución). */
function valores(item: Actividad, semanas: Set<string>, plan: Record<string, number> | null) {
  let vPlan = 0;
  let vEjec = 0;
  const conFechasPlan = !!(plan && Object.keys(plan).some(k => ES_FECHA.test(k)));
  const ejecDict = item.certificacionesPorFecha && Object.keys(item.certificacionesPorFecha).length > 0 ? item.certificacionesPorFecha : null;
  const conFechasEjec = !!(ejecDict && Object.keys(ejecDict).some(k => ES_FECHA.test(k)));
  if (conFechasPlan) {
    for (const [k, v] of Object.entries(plan!)) if (semanas.has(k)) vPlan += Number(v) || 0;
  } else {
    const f = isoDe(item.blFinish || (item as any).finish || (item as any).blStart || (item as any).start);
    if (f && semanas.has(f)) vPlan = item.ventaPlan || 0;
  }
  if (conFechasEjec) {
    for (const [k, v] of Object.entries(ejecDict!)) if (semanas.has(k)) vEjec += Number(v) || 0;
  } else {
    const f = isoDe((item as any).actualFinish || (item as any).finish || item.blFinish || (item as any).blStart || (item as any).start);
    if (f && semanas.has(f)) vEjec = item.ventaEjecutada || 0;
  }
  return { vPlan, vEjec };
}

/** Semanas con datos de plan (PG-004) o ejecución (CDO), ordenadas. Las mismas del filtro de Control de Ejecución. */
export function semanasDisponibles(actividades: Actividad[] | null | undefined, pg004: DictPG004): string[] {
  const set = new Set<string>();
  (actividades || []).forEach(item => {
    if (!item.esItemHoja) return;
    Object.keys(item.certificacionesPorFecha || {}).forEach(k => { if (fechaRazonable(k)) set.add(k); });
    Object.keys(item.planificadoPorFechaPG004 || {}).forEach(k => { if (fechaRazonable(k)) set.add(k); });
    if (pg004 && item.activityId && pg004[item.activityId]) Object.keys(pg004[item.activityId]).forEach(k => { if (fechaRazonable(k)) set.add(k); });
  });
  return [...set].sort();
}

/** Última semana con avance ejecutado en el CDO (columnas V-). */
export function ultimaSemanaEjecutada(actividades: Actividad[] | null | undefined): string {
  let max = '';
  (actividades || []).forEach(item => {
    if (!item.esItemHoja) return;
    for (const [k, v] of Object.entries(item.certificacionesPorFecha || {})) {
      if (fechaRazonable(k) && Math.abs(Number(v) || 0) > 0.001 && k > max) max = k;
    }
  });
  return max;
}

const vacio = (): ResumenPeriodo => ({
  contrato: 0, plan: 0, ejec: 0, variacion: 0, cumplimiento: null,
  acumPlan: 0, acumEjec: 0, avance: 0, avancePlan: 0, avancePeriodo: 0, partidas: 0,
});

function cerrar(r: ResumenPeriodo): ResumenPeriodo {
  r.variacion = r.ejec - r.plan;
  r.cumplimiento = r.plan > 0.5 ? (r.ejec / r.plan) * 100 : null;
  r.avance = r.contrato > 0 ? (r.acumEjec / r.contrato) * 100 : 0;
  r.avancePlan = r.contrato > 0 ? (r.acumPlan / r.contrato) * 100 : 0;
  r.avancePeriodo = r.contrato > 0 ? (r.ejec / r.contrato) * 100 : 0;
  return r;
}

const sumar = (r: ResumenPeriodo, contrato: number, p: { vPlan: number; vEjec: number }, a: { vPlan: number; vEjec: number }) => {
  r.contrato += contrato;
  r.plan += p.vPlan;
  r.ejec += p.vEjec;
  r.acumPlan += a.vPlan;
  r.acumEjec += a.vEjec;
  if (Math.abs(p.vPlan) > 0.5 || Math.abs(p.vEjec) > 0.5) r.partidas++;
};

const limpio = (s: any, porDefecto: string) => String(s || '').trim() || porDefecto;
const ordenNatural = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true });

/**
 * Arma las cifras del reporte para las semanas entre `desde` y `hasta` (ambas incluidas).
 * `semanas` es la lista completa de semanas disponibles.
 */
export function construirDatosPeriodo(
  actividades: Actividad[],
  pg004: DictPG004,
  semanas: string[],
  desde: string,
  hasta: string,
): ReportePeriodoDatos {
  const enPeriodo = semanas.filter(s => s >= desde && s <= hasta);
  const setPeriodo = new Set(enPeriodo);
  const setAcum = new Set(semanas.filter(s => s <= hasta));
  const idx = indicePG004(pg004);

  const total = vacio();
  const comps = new Map<string, { r: ResumenPeriodo; caps: Map<string, { plan: number; ejec: number }> }>();
  const porSemana = new Map<string, { plan: number; ejec: number }>(enPeriodo.map(s => [s, { plan: 0, ejec: 0 }]));
  const partidas: PartidaPeriodo[] = [];

  for (const item of actividades || []) {
    if (!item.esItemHoja) continue;
    const plan = planDe(item, pg004, idx);
    const p = valores(item, setPeriodo, plan);
    const a = valores(item, setAcum, plan);
    const contrato = Number(item.venta) || 0;
    const comp = limpio(item.componente, 'Sin componente');
    const cap = limpio(item.cap, 'Sin CAP');

    sumar(total, contrato, p, a);
    let c = comps.get(comp);
    if (!c) { c = { r: vacio(), caps: new Map() }; comps.set(comp, c); }
    sumar(c.r, contrato, p, a);
    if (Math.abs(p.vPlan) > 0.5 || Math.abs(p.vEjec) > 0.5) {
      const k = c.caps.get(cap) || { plan: 0, ejec: 0 };
      k.plan += p.vPlan; k.ejec += p.vEjec;
      c.caps.set(cap, k);
      partidas.push({
        codigo: limpio(item.activityId || item.wbs, '—'),
        descripcion: limpio(item.descripcion, '—'),
        componente: comp,
        cap,
        plan: p.vPlan,
        ejec: p.vEjec,
        variacion: p.vEjec - p.vPlan,
      });
    }

    // Evolución semanal (solo partidas con valores por semana)
    const ejecDict = item.certificacionesPorFecha || {};
    for (const s of enPeriodo) {
      const w = porSemana.get(s)!;
      if (plan && plan[s] !== undefined) w.plan += Number(plan[s]) || 0;
      if (ejecDict[s] !== undefined) w.ejec += Number(ejecDict[s]) || 0;
    }
  }

  const componentes = [...comps.entries()]
    .sort((x, y) => ordenNatural(x[0], y[0]))
    .map(([nombre, c]) => {
      const caps = [...c.caps.entries()].map(([n, v]) => ({ nombre: n, plan: v.plan, ejec: v.ejec, variacion: v.ejec - v.plan }));
      return {
        nombre,
        ...cerrar(c.r),
        capsDestacados: [...caps].filter(k => k.ejec > 0.5).sort((x, y) => y.ejec - x.ejec).slice(0, 4),
        capsAtrasados: [...caps].filter(k => k.variacion < -1).sort((x, y) => x.variacion - y.variacion).slice(0, 3),
      };
    })
    .filter(c => c.contrato > 0.5 || c.partidas > 0);

  return {
    version: 1,
    desde,
    hasta,
    semanas: enPeriodo,
    ultimaSemanaEjecutada: ultimaSemanaEjecutada(actividades),
    total: cerrar(total),
    componentes,
    porSemana: enPeriodo.map(s => ({ semana: s, ...porSemana.get(s)! })),
    destacadas: partidas.filter(x => x.ejec > 0.5).sort((x, y) => y.ejec - x.ejec).slice(0, 10),
    atrasadas: partidas.filter(x => x.variacion < -1).sort((x, y) => x.variacion - y.variacion).slice(0, 10),
  };
}

/** Fecha corta en español (lun. 3 nov. 2026 → "3 nov. 2026"). */
export const fechaCorta = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Texto del período: "3 nov. 2026 → 24 nov. 2026 (4 semanas)". */
export const textoPeriodo = (desde: string, hasta: string, n: number) =>
  desde === hasta ? `Semana del ${fechaCorta(desde)}` : `${fechaCorta(desde)} → ${fechaCorta(hasta)} (${n} semanas)`;

/** Copia con los montos redondeados, para enviar a la IA sin decimales innecesarios. */
export function datosParaIA(d: ReportePeriodoDatos) {
  const r0 = (v: number) => Math.round(v);
  const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
  const res = (r: ResumenPeriodo) => ({
    contrato: r0(r.contrato), planPeriodo: r0(r.plan), ejecPeriodo: r0(r.ejec), variacion: r0(r.variacion),
    cumplimientoPct: r1(r.cumplimiento), avanceAcumPct: r1(r.avance), avancePlanAcumPct: r1(r.avancePlan),
    avanceDelPeriodoPct: r1(r.avancePeriodo), partidasConMovimiento: r.partidas,
  });
  const cap = (k: { nombre: string; plan: number; ejec: number; variacion: number }) => ({ cap: k.nombre, plan: r0(k.plan), ejec: r0(k.ejec), variacion: r0(k.variacion) });
  const par = (p: PartidaPeriodo) => ({ ...p, plan: r0(p.plan), ejec: r0(p.ejec), variacion: r0(p.variacion) });
  return {
    periodo: { desde: d.desde, hasta: d.hasta, semanas: d.semanas.length, ultimaSemanaEjecutada: d.ultimaSemanaEjecutada },
    total: res(d.total),
    componentes: d.componentes.map(c => ({ componente: c.nombre, ...res(c), capsQueMasAvanzaron: c.capsDestacados.map(cap), capsMasAtrasados: c.capsAtrasados.map(cap) })),
    porSemana: d.porSemana.map(w => ({ semana: w.semana, plan: r0(w.plan), ejec: r0(w.ejec) })),
    partidasQueMasAvanzaron: d.destacadas.map(par),
    partidasMasAtrasadas: d.atrasadas.map(par),
  };
}
