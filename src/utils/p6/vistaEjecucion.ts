/**
 * Vista de ejecución del cronograma P6: en lugar de la WBS de Primavera, agrupa las actividades
 * según la clasificación del Master (grupo/fase, componente, SCAP, …). La llave entre ambos es
 * el Activity ID (task_code en el XER = activityId en el Master).
 */
import type { Actividad } from '../../types';

export type CampoAgrupacion = 'grupo' | 'componente' | 'tipo' | 'proceso' | 'cap' | 'scap' | 'unit' | 'subcontratista' | 'ubicacion' | 'macro';

export const CAMPOS_AGRUPACION: { k: CampoAgrupacion; etq: string }[] = [
  { k: 'grupo', etq: 'Grupo (fase)' },
  { k: 'componente', etq: 'Componente' },
  { k: 'tipo', etq: 'Tipo' },
  { k: 'scap', etq: 'SCAP' },
  { k: 'cap', etq: 'CAP' },
  { k: 'proceso', etq: 'Proceso' },
  { k: 'unit', etq: 'Unit' },
  { k: 'macro', etq: 'Macro' },
  { k: 'subcontratista', etq: 'Subcontratista' },
  { k: 'ubicacion', etq: 'Ubicación' },
];

export const NIVELES_POR_DEFECTO: CampoAgrupacion[] = ['grupo', 'componente', 'scap'];

export const SIN_MASTER = '(Sin datos en el Master)';

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

/** Ruta de grupos de una actividad del Master según los niveles elegidos. */
export function rutaDe(a: Actividad, niveles: CampoAgrupacion[]): string[] {
  return niveles.map(k => {
    const v = (a as unknown as Record<string, unknown>)[k];
    const s = v == null ? '' : String(v).trim();
    return s || `(sin ${etiquetaCampo(k)})`;
  });
}

/** Fecha del Master (Date o texto) → minutos UTC del día, como las fechas del XER. */
export function minutosDeFecha(d: Date | string | null | undefined): number | null {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  if (isNaN(x.getTime())) return null;
  return Date.UTC(x.getFullYear(), x.getMonth(), x.getDate(), 8, 0) / 60000;
}

/** Ámbito de la vista de ejecución: construcción (grupos con «Construccion»/«Constr.») o equipamiento (el resto). */
export type Ambito = 'todo' | 'construccion' | 'equipamiento';

export const esConstruccion = (grupo: string | null | undefined) => /constr/i.test(String(grupo ?? ''));

/** ¿La actividad (con su fila del Master, o sin ella) entra en el ámbito elegido? */
export function enAmbito(a: Actividad | undefined, ambito: Ambito): boolean {
  if (ambito === 'todo') return true;
  const constr = !!a && esConstruccion(a.grupo);
  return ambito === 'construccion' ? constr : !constr;
}
