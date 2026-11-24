/**
 * Corte de obra (cierre de actividades) en T₃, según «Especificación Corte de Obra».
 *
 * Ciclo: se sincroniza el Master (pestaña cdo con sus semanas de ejecución) → corte en T₃ sobre el
 * XER → se exporta el XER a Primavera → Primavera actualiza la pestaña p6 del Master → se recarga
 * el Master y se repite.
 *
 * - Semanas: cada columna V- del cdo es la semana que empieza ese domingo (domingo a sábado). En el
 *   Master ya cargado están en `certificacionesPorFecha` (clave = domingo, AAAA-MM-DD); en las «p6» ya
 *   vienen sumadas por la columna A (sus filas). Semana con ejecución = valor ≠ 0.
 * - Fila de corte: todo lo que está por debajo de «p.D Actividades Pendientes de confirmar…» queda fuera.
 * - El estado de referencia es el del XER de T₃ (la columna p6 del Master va un ciclo por detrás).
 * - Iniciar (pestaña NotStarted): Venta Ex > 0, sin iniciar en el XER → inicio real = 1ª semana con
 *   ejecución + 1 día 08:00, sin tocar el % físico; duración restante = original − tiempo laborable
 *   entre el inicio real y la fecha de datos (calendario de la actividad), mínimo 1 día. Si la 1ª ejecución no es del año en
 *   curso, además fin real = última semana + 4 días 16:00 y % físico = % Ex.
 * - Cerrar (pestaña DEF_100): paquetes .D (compra y fabricación), .E (flete) y .F (instalación) en curso
 *   en el XER con % Ex ≥ 99,5 % (.D/.E) o ≥ 95 % (.F) → fin real = última semana + 4 días 16:00 y
 *   % físico = % Ex.
 * - Válvulas (SCAP Valvulas): el corte no las inicia ni las cierra (salen como excluidas).
 * - Ninguna fecha real puede quedar después de la nueva fecha de datos (por defecto, el sábado 16:00 de
 *   la última semana con ejecución del Master).
 */
import type { Actividad } from '../../types';
import { celda } from './xer';
import type { ModeloP6 } from './modelo';
import { aMinutos } from './calendario';
import { valorCampo, type Clasificacion } from './vistaEjecucion';

export type AccionCorte = 'iniciar' | 'cerrar';

export interface FilaCorte {
  accion: AccionCorte;
  /** Fila de TASK en el XER (undefined si no está en el XER). */
  i?: number;
  cod: string;
  nombre: string;
  wbs: string;
  subc: string;
  scap: string;
  paquete: string;
  /** Fila del Excel del Master (1 = primera fila). */
  filaExcel: number | null;
  estadoMaster: string;
  estadoXer: string;
  ventaEx: number;
  /** % Ex en fracción (1 = 100 %). */
  pctEx: number | null;
  startP6: string | null;
  finishP6: string | null;
  /** Domingo (AAAA-MM-DD) de la primera y la última semana con ejecución. */
  primera: string | null;
  ultima: string | null;
  /** Fechas a poner en el XER («AAAA-MM-DD HH:MM»). */
  inicioReal: string | null;
  finReal: string | null;
  /** % físico a poner (0–100), solo al cerrar. */
  avance: number | null;
  /** Duración restante a poner al iniciar (horas): original − tiempo laborable entre el inicio real y la fecha de datos, mínimo 1 día. */
  restanteH: number | null;
  /** Duración original y días por hora de su calendario (para mostrar). */
  originalH: number | null;
  horasDia: number;
  /** Se puede aplicar; si no, el motivo. */
  ok: boolean;
  motivo: string;
}

export interface Corte {
  iniciar: FilaCorte[];
  cerrar: FilaCorte[];
  /** Domingo de la última semana con ejecución en el Master. */
  ultimaSemana: string | null;
  /** Fecha de datos sugerida: sábado 16:00 de esa semana. */
  fechaDatosSugerida: string | null;
  /** Rubros que el Master da como «Not Started» con ejecución, pero en el XER ya están iniciados o terminados. */
  yaIniciadas: number;
  /** Paquetes con el umbral de cierre que en el XER ya están terminados. */
  yaCerradas: number;
}

const RE_CORTE = /Actividades Pendientes de confirmar por el Ingeniero/i;
const sinEsp = (s: unknown) => String(s ?? '').replace(/\s+/g, '').toLowerCase();

/** «AAAA-MM-DD» + días, con hora → «AAAA-MM-DD HH:MM». */
export function masDias(domingo: string, dias: number, hora: string): string {
  const [y, m, d] = domingo.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d + dias));
  return `${f.toISOString().slice(0, 10)} ${hora}`;
}

/** Semanas con ejecución (domingos ordenados). */
function semanasCon(a: Actividad): string[] {
  const c = (a as unknown as { certificacionesPorFecha?: Record<string, number> }).certificacionesPorFecha || {};
  return Object.keys(c).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k) && Math.abs(Number(c[k]) || 0) > 0).sort();
}

/** % Ex del Master; si el Master se cargó antes de guardarlo, Venta Ex ÷ Venta. */
function pctDe(a: Actividad): number | null {
  if (a.pctEx != null && isFinite(a.pctEx)) return a.pctEx;
  return a.venta > 0 ? (a.ventaEjecutada || 0) / a.venta : null;
}

const fechaCorta = (v: unknown): string | null => {
  if (!v) return null;
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

export function calcularCorte(m: ModeloP6, master: Actividad[], clasif: Map<string, Clasificacion>, fechaDatos?: string | null): Corte {
  const t = m.task;
  const porCod = new Map<string, number>();
  t.filas.forEach((f, i) => porCod.set(celda(t, f, 'task_code'), i));

  // Hasta la fila de corte «p.D …» (lo de abajo está pendiente de confirmar por el Ingeniero)
  const corte = master.findIndex(a => RE_CORTE.test(`${(a as unknown as { wbsRaw?: string }).wbsRaw ?? ''} ${a.descripcion ?? ''}`));
  const vivos = (corte >= 0 ? master.slice(0, corte) : master).filter(a => a.esItemHoja && a.activityId);

  // Última semana con ejecución de todo el Master → fecha de datos sugerida (sábado 16:00)
  let ultimaSemana: string | null = null;
  for (const a of vivos) { const s = semanasCon(a); const u = s[s.length - 1]; if (u && (!ultimaSemana || u > ultimaSemana)) ultimaSemana = u; }
  // Nunca antes de la fecha de datos actual del XER (con un Master antiguo, la del XER)
  const actual = new Date(m.fechaDatos * 60000).toISOString().slice(0, 16).replace('T', ' ');
  const semanaFin = ultimaSemana ? masDias(ultimaSemana, 6, '16:00') : null;
  const fechaDatosSugerida = !semanaFin || semanaFin < actual ? actual : semanaFin;
  const dd = fechaDatos || fechaDatosSugerida;
  const anio = dd ? Number(dd.slice(0, 4)) : new Date().getFullYear();

  const iniciar: FilaCorte[] = [], cerrar: FilaCorte[] = [];
  let yaIniciadas = 0, yaCerradas = 0;
  for (const a of vivos) {
    const cod = String(a.activityId).trim();
    const i = porCod.get(cod);
    const estadoXer = i === undefined ? '' : celda(t, t.filas[i], 'status_code');
    const udf = clasif.get(cod);
    const scap = valorCampo(a, 'scap', udf);
    const esValvula = /valvul/i.test(scap);
    const sem = semanasCon(a);
    const primera = sem[0] ?? null, ultima = sem[sem.length - 1] ?? null;
    const pct = pctDe(a);
    const fila = Number(String(a.id ?? '').replace(/^row_/, ''));
    const base = {
      i, cod, nombre: a.descripcion ?? '', wbs: (a as unknown as { wbsRaw?: string }).wbsRaw ?? a.wbs ?? '',
      subc: valorCampo(a, 'subcontratista', udf), scap,
      filaExcel: Number.isFinite(fila) ? fila + 1 : null,
      estadoMaster: a.p6Status ?? '', estadoXer, ventaEx: a.ventaEjecutada || 0, pctEx: pct,
      startP6: fechaCorta(a.start), finishP6: fechaCorta(a.finish), primera, ultima,
    };
    const paqueteDe = /\.D$/i.test(cod) ? 'Compra y Fabricación' : /\.E$/i.test(cod) ? 'Flete' : /\.F$/i.test(cod) ? 'Instalación' : '';
    const tarde = (f: string | null) => !!(f && dd && f > dd);

    // Iniciar: con Venta Ex y sin iniciar en el XER
    if ((a.ventaEjecutada || 0) > 0 && (estadoXer === 'TK_NotStart' || (i === undefined && sinEsp(a.p6Status) === 'notstarted'))) {
      const inicioReal = primera ? masDias(primera, 1, '08:00') : null;
      const cierraYa = !!(primera && Number(primera.slice(0, 4)) !== anio && ultima);
      const finReal = cierraYa && ultima ? masDias(ultima, 4, '16:00') : null;
      // Duración restante: original − tiempo laborable ya transcurrido (calendario de la actividad), mínimo 1 día
      let restanteH: number | null = null, originalH: number | null = null, horasDia = 8;
      if (i !== undefined && inicioReal && dd && !finReal) {
        const fl = t.filas[i];
        const cal = m.calendarios.get(celda(t, fl, 'clndr_id'));
        horasDia = cal?.horasDia || 8;
        originalH = Number(celda(t, fl, 'target_drtn_hr_cnt')) || 0;
        const a = aMinutos(inicioReal), b = aMinutos(dd);
        const transcurrido = cal && a != null && b != null && b > a ? cal.entre(a, b) / 60 : 0;
        restanteH = Math.max(originalH - transcurrido, horasDia);
      }
      let motivo = '';
      if (i === undefined) motivo = 'Not in the T₃ XER';
      else if (esValvula) motivo = 'Valves are not started by the cut';
      else if (!primera) motivo = 'No week with execution';
      else if (tarde(inicioReal) || tarde(finReal)) motivo = 'Date after the data date';
      iniciar.push({
        ...base, accion: 'iniciar', paquete: paqueteDe, inicioReal, finReal, restanteH, originalH, horasDia,
        avance: finReal && pct != null ? Math.min(100, Math.max(0, pct * 100)) : null, ok: !motivo, motivo,
      });
    } else if ((a.ventaEjecutada || 0) > 0 && sinEsp(a.p6Status) === 'notstarted' && (estadoXer === 'TK_Active' || estadoXer === 'TK_Complete')) {
      yaIniciadas++;
    }

    // Cerrar: paquetes .D/.E/.F en curso con % Ex sobre el umbral
    if (paqueteDe && pct != null && pct >= (paqueteDe === 'Instalación' ? 0.95 : 0.995)) {
      if (estadoXer === 'TK_Complete') { yaCerradas++; continue; }
      if (estadoXer !== 'TK_Active' && !(i === undefined && sinEsp(a.p6Status) === 'inprogress')) continue;
      const finReal = ultima ? masDias(ultima, 4, '16:00') : null;
      const iniXer = i === undefined ? '' : celda(t, t.filas[i], 'act_start_date');
      let motivo = '';
      if (i === undefined) motivo = 'Not in the T₃ XER';
      else if (esValvula) motivo = 'Valves are not closed by the cut';
      else if (!ultima) motivo = 'No week with execution';
      else if (tarde(finReal)) motivo = 'Date after the data date';
      else if (iniXer && finReal && finReal < iniXer.slice(0, 16)) motivo = `Finish before its actual start (${iniXer.slice(0, 10)})`;
      cerrar.push({
        ...base, accion: 'cerrar', paquete: paqueteDe, inicioReal: null, finReal, restanteH: null, originalH: null, horasDia: 8,
        avance: Math.min(100, Math.max(0, pct * 100)), ok: !motivo, motivo,
      });
    }
  }
  const orden = (x: FilaCorte, y: FilaCorte) => Number(y.ok) - Number(x.ok) || (x.filaExcel ?? 0) - (y.filaExcel ?? 0);
  iniciar.sort(orden); cerrar.sort(orden);
  return { iniciar, cerrar, ultimaSemana, fechaDatosSugerida, yaIniciadas, yaCerradas };
}
