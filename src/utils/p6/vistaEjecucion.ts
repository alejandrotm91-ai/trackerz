/**
 * Vista de ejecución del cronograma P6: en lugar de la WBS de Primavera, agrupa las actividades
 * según la clasificación del Master (grupo/fase, componente, SCAP, …). La llave entre ambos es
 * el Activity ID (task_code en el XER = activityId en el Master).
 */
import type { Actividad } from '../../types';
import { celda, type Xer } from './xer';

export type CampoAgrupacion = 'grupo' | 'componente' | 'tipo' | 'proceso' | 'cap' | 'scap' | 'unit' | 'subcontratista' | 'ubicacion' | 'macro';

export const CAMPOS_AGRUPACION: { k: CampoAgrupacion; etq: string }[] = [
  { k: 'grupo', etq: 'Group (phase)' },
  { k: 'componente', etq: 'Component' },
  { k: 'tipo', etq: 'Type' },
  { k: 'scap', etq: 'SCAP' },
  { k: 'cap', etq: 'CAP' },
  { k: 'proceso', etq: 'Process' },
  { k: 'unit', etq: 'Unit' },
  { k: 'macro', etq: 'Macro' },
  { k: 'subcontratista', etq: 'Subcontractor' },
  { k: 'ubicacion', etq: 'Location' },
];

export const NIVELES_POR_DEFECTO: CampoAgrupacion[] = ['grupo', 'componente', 'scap'];

export const SIN_MASTER = '(No Master data)';

export const etiquetaCampo = (k: CampoAgrupacion) => CAMPOS_AGRUPACION.find(c => c.k === k)?.etq ?? k;

/** Activity ID → actividad del Master. */
export function indiceMaster(acts: Actividad[] | undefined | null): Map<string, Actividad> {
  const m = new Map<string, Actividad>();
  for (const a of acts || []) {
    const id = a.activityId ? String(a.activityId).trim() : '';
    if (id && !m.has(id)) m.set(id, a);
  }
  return m;
}

/** Clasificación de una actividad: lo que dice el XER (campos de usuario) y, si no, el Master. */
export type Clasificacion = Partial<Record<CampoAgrupacion, string>>;

/** Valor de un campo de agrupación: primero el campo de usuario del XER (editable en Trakciona), si no el Master. */
export function valorCampo(a: Actividad | undefined, k: CampoAgrupacion, udf?: Clasificacion): string {
  const u = udf?.[k];
  if (u) return u;
  const v = a ? (a as unknown as Record<string, unknown>)[k] : undefined;
  return v == null ? '' : String(v).trim();
}

/** Ruta de grupos de una actividad según los niveles elegidos. */
export function rutaDe(a: Actividad | undefined, niveles: CampoAgrupacion[], udf?: Clasificacion): string[] {
  return niveles.map(k => valorCampo(a, k, udf) || `(no ${etiquetaCampo(k)})`);
}

/** Campos de usuario del XER que equivalen a los campos de agrupación del Master (por su etiqueta, sin el «NN.»). */
const UDF_A_CAMPO: Record<string, CampoAgrupacion> = {
  grupos: 'grupo', grupo: 'grupo', componente: 'componente', tipo: 'tipo', scap: 'scap', cap: 'cap',
  proceso: 'proceso', unit: 'unit', subc: 'subcontratista', subcontratista: 'subcontratista', ubicacion: 'ubicacion',
};
/** Valores que en el XER significan «sin dato». */
const VACIO_UDF = new Set(['', '0', '-', 'hito']);

/** task_code → clasificación según los campos de usuario del XER. */
export function clasificacionXer(xer: Xer): Map<string, Clasificacion> {
  const out = new Map<string, Clasificacion>();
  const tipos = xer.tablas.get('UDFTYPE'), valores = xer.tablas.get('UDFVALUE'), t = xer.tablas.get('TASK');
  if (!tipos || !valores || !t) return out;
  const campoDe = new Map<string, CampoAgrupacion>();
  for (const f of tipos.filas) {
    if (celda(tipos, f, 'table_name') !== 'TASK') continue;
    const etq = celda(tipos, f, 'udf_type_label').trim().toLowerCase().replace(/^\d+\.\s*/, '');
    const k = UDF_A_CAMPO[etq];
    if (k) campoDe.set(celda(tipos, f, 'udf_type_id'), k);
  }
  if (!campoDe.size) return out;
  const codigo = new Map<string, string>();
  for (const f of t.filas) codigo.set(celda(t, f, 'task_id'), celda(t, f, 'task_code'));
  for (const f of valores.filas) {
    const k = campoDe.get(celda(valores, f, 'udf_type_id'));
    if (!k) continue;
    const v = celda(valores, f, 'udf_text').trim();
    if (VACIO_UDF.has(v.toLowerCase())) continue;
    const cod = codigo.get(celda(valores, f, 'fk_id'));
    if (!cod) continue;
    const c = out.get(cod) ?? {};
    c[k] = v;
    out.set(cod, c);
  }
  return out;
}

/** Fecha del Master (Date o texto) → minutos UTC del día, como las fechas del XER. */
export function minutosDeFecha(d: Date | string | null | undefined): number | null {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  if (isNaN(x.getTime())) return null;
  return Date.UTC(x.getFullYear(), x.getMonth(), x.getDate(), 8, 0) / 60000;
}

/** Ámbito de la vista de ejecución: construcción (grupos con «Construccion»/«Constr.») o equipamiento (el resto). */
export type Ambito = 'todo' | 'construccion' | 'equipamiento' | 'aereas';

/** SCAP de la vista «Obras Aéreas» (tubería aérea, sus soportes y las válvulas, en todas sus fases). */
export const SCAP_OBRAS_AEREAS = ['Soport.Tub.Aerea', 'Tub.Aerea', 'Valvulas'];
const normScap = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const SCAP_AEREAS_N = new Set(SCAP_OBRAS_AEREAS.map(normScap));
export const esObraAerea = (scap: string | null | undefined) => SCAP_AEREAS_N.has(normScap(String(scap ?? '')));

export const esConstruccion = (grupo: string | null | undefined) => /constr/i.test(String(grupo ?? ''));

/** ¿La actividad entra en el ámbito elegido? (grupo según el XER o el Master; sin datos del Master → equipamiento) */
export function enAmbito(a: Actividad | undefined, ambito: Ambito, udf?: Clasificacion): boolean {
  if (ambito === 'todo') return true;
  if (ambito === 'aereas') return !!a && esObraAerea(valorCampo(a, 'scap', udf));
  const constr = !!a && esConstruccion(valorCampo(a, 'grupo', udf));
  return ambito === 'construccion' ? constr : !constr;
}

/**
 * Activity ID que no se muestran en la vista de ejecución (base + variantes .A/.D/.E/.F).
 * Válvulas de guillotina 16.8.4.8 a 16.8.4.11.
 */
const BASES_OCULTAS = new Set(['16.8.4.8', '16.8.4.9', '16.8.4.10', '16.8.4.11']);
export function ocultoEnEjecucion(cod: string): boolean {
  const m = /^(.*)\.([ADEF])$/i.exec(String(cod).trim());
  return !!m && BASES_OCULTAS.has(m[1]);
}

/**
 * Ámbito de un hito sin datos en el Master por su nombre. Primero se mira si habla de equipos
 * (p. ej. «Fin Equipamiento Tanque de Agua de Servicio» es de equipamiento); si no, si habla de obra.
 */
export const RE_HITO_EQUIPAMIENTO = /equipamiento|\bequipos?\b|montaje de equipos|instalaci[oó]n de equipos|motorizad/i;
export const RE_HITO_CONSTRUCCION = /\bobras?\b|civil|arquitect[oó]nic|tuber[ií]a|agua(s)? lluvia|pluvial|agua de servicio|sanitari|hormig[oó]n|estructura|urbaniz|vial(idad)?\b|cubierta|mamposter|enlucid|pintura|cimentaci|relleno|excavaci|movimiento de tierras|alcantarill|drenaje/i;

/** Nombre de la ubicación (02.Ubicacion) en la vista constructiva y su orden. */
const UBICACIONES: [RegExp, string][] = [[/merinos/i, 'PTAR Merinos'], [/progreso/i, 'EBAR Progreso'], [/guayacanes/i, 'Guayacanes']];
export function etiquetaUbicacion(v: string): string {
  const u = UBICACIONES.find(([re]) => re.test(v));
  return u ? u[1] : v || '(no Location)';
}
export function ordenUbicacion(etq: string): number {
  const k = UBICACIONES.findIndex(([, e]) => e === etq);
  return k >= 0 ? k + 1 : 9;
}
