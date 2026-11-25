/**
 * Crear en T₃ las actividades «Master Only» (rubros del Master que aún no están en el XER), decisiones del
 * 25-nov-2026:
 *  - Solo los que tienen Venta Ex > 0 (los sin ejecución se listan, no se crean).
 *  - Fuera lo que está debajo de la fila «p.D Actividades Pendientes de confirmar…» (como el corte).
 *  - Ubicación: el WBS más profundo de T₃ que coincida con su código de WBS (el del Master sin su prefijo de
 *    proyecto, tras el código raíz del XER), igual que el filtro «Master Only».
 *  - Fechas con la regla del corte: Actual Start = 1ª semana con ejecución + 1 día 08:00 y, como son adicionales
 *    (Venta 0), Actual Finish = última semana + 4 días 16:00 → Completed (100 %). Ninguna fecha real después de
 *    la fecha de datos (si no, no se crea y se avisa).
 *  - Actual Cost = Venta Ex (asignación del recurso de venta «V»); Budgeted Cost = Venta; unidades = cantidad
 *    ejecutada de las semanas.
 *  - Se copian los campos de usuario de clasificación del Master y la llave «32. Variacion» (id.Orig).
 */
import type { Actividad } from '../../types';
import { celda } from './xer';
import type { ModeloP6 } from './modelo';
import { aMinutos } from './calendario';
import { masDias } from './corte';

const RE_CORTE = /Actividades Pendientes de confirmar por el Ingeniero/i;

/** Campo de usuario del XER ← campo del Master. */
export const UDF_DESDE_MASTER: [string, (a: Actividad) => string][] = [
  ['01.Grupos', a => a.grupo || ''],
  ['02.Ubicacion', a => a.ubicacion || ''],
  ['03.Proceso', a => a.proceso || ''],
  ['04.Partidas', a => a.partidas || ''],
  ['05.Tipo', a => a.tipo || ''],
  ['06.CAP', a => a.cap || ''],
  ['07.SCAP', a => a.scap || ''],
  ['08.Unit', a => a.unit || ''],
  ['10.Componente', a => a.componente || ''],
  ['11.SubC', a => a.subcontratista || ''],
  ['29. Resp', a => a.resp || ''],
  ['32. Variacion', a => String(a.idOrig ?? '')],
  ['36.P.Ac', a => a.pAc || ''],
];

export interface FilaSoloMaster {
  cod: string;
  nombre: string;
  subc: string;
  wbsId: string | null;
  wbsCodigo: string;
  wbsNombre: string;
  wbsMaster: string;
  ventaEx: number;
  venta: number;
  cantReal: number;
  primera: string | null;
  ultima: string | null;
  inicioReal: string | null;
  finReal: string | null;
  /** Duración original (h) = tiempo laborable entre el inicio y el fin real en el calendario de la plantilla. */
  durH: number;
  horasDia: number;
  udfs: { etiqueta: string; id: string; valor: string }[];
  ok: boolean;
  motivo: string;
}

export interface ResultadoSoloMaster {
  crear: FilaSoloMaster[];
  sinEjecucion: FilaSoloMaster[];
  bajoPD: number;
  fechaDatos: string;
}

const semanasCon = (a: Actividad) => {
  const c = (a as unknown as { certificacionesPorFecha?: Record<string, number> }).certificacionesPorFecha || {};
  return Object.keys(c).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k) && Math.abs(Number(c[k]) || 0) > 0).sort();
};

export function calcularSoloMaster(m: ModeloP6, master: Actividad[]): ResultadoSoloMaster {
  const t = m.task;
  const dd = new Date(m.fechaDatos * 60000).toISOString().slice(0, 16).replace('T', ' ');
  const codigos = new Set(t.filas.map(f => celda(t, f, 'task_code')));

  // Árbol WBS del XER con sus códigos completos (raíz.hijo.nieto…)
  const w = m.xer.tablas.get('PROJWBS');
  type N = { id: string; padre: string; cod: string; nombre: string; seq: number; hijos: N[]; completo: string };
  const nodos = new Map<string, N>();
  for (const f of w?.filas || []) nodos.set(celda(w!, f, 'wbs_id'), { id: celda(w!, f, 'wbs_id'), padre: celda(w!, f, 'parent_wbs_id'), cod: celda(w!, f, 'wbs_short_name'), nombre: celda(w!, f, 'wbs_name'), seq: Number(celda(w!, f, 'seq_num')) || 0, hijos: [], completo: '' });
  const raices: N[] = [];
  for (const n of nodos.values()) { const p = nodos.get(n.padre); if (p) p.hijos.push(n); else raices.push(n); }
  raices.sort((a, b) => a.seq - b.seq);
  const porCodigo = new Map<string, N>();
  const completar = (n: N, padre?: N) => { n.completo = padre ? `${padre.completo}.${n.cod}` : n.cod; porCodigo.set(n.completo, n); n.hijos.forEach(h => completar(h, n)); };
  raices.forEach(r => completar(r));
  const raizCod = raices[0]?.completo ?? '';

  // Calendario y horas/día de una actividad típica (la plantilla que usará crearActividad)
  const plantilla = t.filas.find(f => celda(t, f, 'task_type') === 'TT_Task') || t.filas[0];
  const cal = plantilla ? m.calendarios.get(celda(t, plantilla, 'clndr_id')) : undefined;
  const horasDia = cal?.horasDia || 8;

  // Campos de usuario por etiqueta
  const tipos = m.xer.tablas.get('UDFTYPE');
  const idUdf = new Map<string, string>();
  for (const f of tipos?.filas || []) if (celda(tipos!, f, 'table_name') === 'TASK') idUdf.set(celda(tipos!, f, 'udf_type_label'), celda(tipos!, f, 'udf_type_id'));

  const corte = master.findIndex(a => RE_CORTE.test(`${(a as unknown as { wbsRaw?: string }).wbsRaw ?? ''} ${a.descripcion ?? ''}`));
  const crear: FilaSoloMaster[] = [], sinEjecucion: FilaSoloMaster[] = [];
  let bajoPD = 0;
  master.forEach((a, k) => {
    if (!a.esItemHoja || !a.activityId) return;
    const cod = String(a.activityId).trim();
    if (!cod || codigos.has(cod)) return;
    if (corte >= 0 && k > corte) { bajoPD++; return; }
    const wbsMaster = String(a.wbs || (a as unknown as { wbsRaw?: string }).wbsRaw || '');
    const segs = wbsMaster.split('.').slice(1);
    let destino: N | undefined;
    for (let n = segs.length; n >= 0 && !destino; n--) destino = porCodigo.get([raizCod, ...segs.slice(0, n)].join('.'));
    const sem = semanasCon(a);
    const primera = sem[0] ?? null, ultima = sem[sem.length - 1] ?? null;
    const inicioReal = primera ? masDias(primera, 1, '08:00') : null;
    const finReal = ultima ? masDias(ultima, 4, '16:00') : null;
    const ai = inicioReal ? aMinutos(inicioReal) : null, af = finReal ? aMinutos(finReal) : null;
    const durH = cal && ai != null && af != null && af > ai ? Math.max(cal.entre(ai, af) / 60, horasDia) : horasDia;
    const cantReal = Object.values((a as unknown as { cantidadesPorFecha?: Record<string, number> }).cantidadesPorFecha || {}).reduce((s, x) => s + (Number(x) || 0), 0);
    const udfs = UDF_DESDE_MASTER
      .map(([etq, valor]) => ({ etiqueta: etq, id: idUdf.get(etq) || '', valor: valor(a).trim() }))
      .filter(u => u.id && u.valor && u.valor !== '0');
    let motivo = '';
    if (!destino) motivo = `No WBS in T₃ matches ${wbsMaster || '(empty WBS)'}`;
    else if (finReal && finReal > dd) motivo = `Last execution week ends after the Data Date (${finReal.slice(0, 10)}): run the Cut / move the Data Date first`;
    const fila: FilaSoloMaster = {
      cod, nombre: a.descripcion || cod, subc: a.subcontratista || '', wbsId: destino?.id ?? null, wbsCodigo: destino?.completo ?? '', wbsNombre: destino?.nombre ?? '',
      wbsMaster, ventaEx: a.ventaEjecutada || 0, venta: a.venta || 0, cantReal, primera, ultima, inicioReal, finReal, durH, horasDia, udfs,
      ok: !motivo, motivo,
    };
    if ((a.ventaEjecutada || 0) > 0) crear.push(fila); else sinEjecucion.push({ ...fila, ok: false, motivo: 'No execution yet (Venta Ex = 0): not created' });
  });
  const orden = (x: FilaSoloMaster, y: FilaSoloMaster) => Number(y.ok) - Number(x.ok) || x.wbsCodigo.localeCompare(y.wbsCodigo, 'es', { numeric: true }) || x.cod.localeCompare(y.cod, 'es', { numeric: true });
  crear.sort(orden); sinEjecucion.sort(orden);
  return { crear, sinEjecucion, bajoPD, fechaDatos: dd };
}
