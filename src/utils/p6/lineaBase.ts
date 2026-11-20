/**
 * Línea base del cronograma P6: una foto de las fechas de inicio y fin de cada actividad
 * (por ID de actividad) para compararla con la programación actual en el Gantt.
 * Se guarda en la nube como documento suelto (`p6_linea_base`).
 */
import { apiFetch } from '../api';
import { aMinutos } from './calendario';
import { celda, leerXer, type Xer } from './xer';

const DOC = 'p6_linea_base';

export interface LineaBase {
  nombre: string;
  /** Cómo se creó: con la programación de Trakciona o desde otro XER. */
  origen: 'programacion' | 'xer';
  creadaEn: string;
  creadaPor: string;
  /** Fecha de datos de la programación que se fotografió (texto P6). */
  fechaDatos: string;
  /** ID de actividad → [inicio, fin] en minutos. */
  act: Record<string, [number | null, number | null]>;
}

/** Inicio y fin vigentes de cada actividad (reales si los hay, si no tempranos). */
function fotografiar(xer: Xer): { act: LineaBase['act']; fechaDatos: string } {
  const t = xer.tablas.get('TASK');
  const act: LineaBase['act'] = {};
  if (t) {
    for (const f of t.filas) {
      const g = (c: string) => celda(t, f, c);
      const estado = g('status_code');
      const ini = estado !== 'TK_NotStart' && g('act_start_date') ? g('act_start_date') : g('early_start_date') || g('target_start_date');
      const fin = estado === 'TK_Complete' && g('act_end_date') ? g('act_end_date') : g('early_end_date') || g('target_end_date');
      act[g('task_code')] = [aMinutos(ini), aMinutos(fin)];
    }
  }
  const p = xer.tablas.get('PROJECT');
  return { act, fechaDatos: p?.filas[0] ? celda(p, p.filas[0], 'last_recalc_date') : '' };
}

export function lineaBaseDeXer(xer: Xer, nombre: string, usuario: string, origen: LineaBase['origen']): LineaBase {
  const { act, fechaDatos } = fotografiar(xer);
  return { nombre, origen, creadaEn: new Date().toISOString(), creadaPor: usuario, fechaDatos, act };
}

export function lineaBaseDeTexto(texto: string, nombre: string, usuario: string): LineaBase {
  return lineaBaseDeXer(leerXer(texto), nombre, usuario, 'xer');
}

/** Fechas planificadas del propio XER (target_start/end), la «línea base del proyecto» de P6 si no hay otra. */
export function lineaBasePlanificada(xer: Xer): LineaBase['act'] {
  const t = xer.tablas.get('TASK');
  const act: LineaBase['act'] = {};
  if (t) for (const f of t.filas) act[celda(t, f, 'task_code')] = [aMinutos(celda(t, f, 'target_start_date')), aMinutos(celda(t, f, 'target_end_date'))];
  return act;
}

/**
 * Línea base desde los campos de usuario del XER: «21. blStartP6» y «20. blFinishP6»
 * (fechas de inicio y fin de la línea base de P6). Devuelve null si el XER no los tiene.
 */
export function lineaBaseUdf(xer: Xer): { act: LineaBase['act']; n: number } | null {
  const tipos = xer.tablas.get('UDFTYPE');
  const valores = xer.tablas.get('UDFVALUE');
  const t = xer.tablas.get('TASK');
  if (!tipos || !valores || !t) return null;
  const buscar = (re: RegExp) => {
    const f = tipos.filas.find(x => celda(tipos, x, 'table_name') === 'TASK' && re.test(celda(tipos, x, 'udf_type_label').trim()));
    return f ? celda(tipos, f, 'udf_type_id') : null;
  };
  const idIni = buscar(/^(\d+\.\s*)?blStartP6$/i);
  const idFin = buscar(/^(\d+\.\s*)?blFinishP6$/i);
  if (!idIni && !idFin) return null;
  const codigo = new Map<string, string>();
  for (const f of t.filas) codigo.set(celda(t, f, 'task_id'), celda(t, f, 'task_code'));
  const act: LineaBase['act'] = {};
  let n = 0;
  for (const f of valores.filas) {
    const tipo = celda(valores, f, 'udf_type_id');
    if (tipo !== idIni && tipo !== idFin) continue;
    const cod = codigo.get(celda(valores, f, 'fk_id'));
    if (!cod) continue;
    const fecha = aMinutos(celda(valores, f, 'udf_date'));
    const par = act[cod] ?? (n++, (act[cod] = [null, null]));
    par[tipo === idIni ? 0 : 1] = fecha;
  }
  return n ? { act, n } : null;
}

export async function guardarLineaBase(lb: LineaBase): Promise<void> {
  await apiFetch(`/api/docs/${DOC}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lb),
  });
}

export async function leerLineaBase(): Promise<LineaBase | null> {
  try {
    const res = await apiFetch(`/api/docs/${DOC}`, { cache: 'no-store' }, [404]);
    if (!res.ok) return null;
    return (await res.json()) as LineaBase;
  } catch (e) {
    console.warn('No se pudo leer la línea base:', e);
    return null;
  }
}
