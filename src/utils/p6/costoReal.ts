/**
 * Actual Cost de T₃ ← Avance (Venta Ex) de M₃, por Activity ID (pestaña «Actual Cost» del Cut).
 *
 * - Avance de una partida en M₃ = suma de su venta semanal (columna «Total» de cada semana del cdo).
 * - Actividades «p6» (agrupan rubros): como en Control de Ejecución, SUMAR.SI por la columna A = suma del avance
 *   de los rubros cuya columna A es ese Activity ID (su propia fila no suma).
 * - Se compara con el Actual Cost de la asignación del recurso de venta «V» de la actividad en el XER y se
 *   proponen las diferencias (> 0,01). Las actividades del XER que no están en M₃ no se tocan.
 */
import type { MasterCdoItem } from '../../types/masterCdo';
import { celda } from './xer';
import type { ModeloP6 } from './modelo';
import { rsrcVentaId } from './edicion';

export interface FilaCosto {
  i: number;
  cod: string;
  nombre: string;
  estado: string;
  /** Actual Cost actual en T₃ (null si no tiene asignación de venta). */
  actualT3: number | null;
  avanceM3: number;
  delta: number;
  /** Activity ID «p6»: suma de sus rubros (número de rubros). */
  rubros: number;
  nota: string;
  ok: boolean;
}

export interface ResultadoCostos {
  cambios: FilaCosto[];
  iguales: number;
  noEnM3: number;
  totalT3: number;
  totalM3: number;
}

const avanceDe = (it: MasterCdoItem) => Object.values(it.ventasSemanales || {}).reduce((s, v) => s + (Number(v) || 0), 0);

export function calcularCostos(m: ModeloP6, items: MasterCdoItem[]): ResultadoCostos {
  // Avance por Activity ID: partidas directas y, para las p6, la suma de sus rubros (columna A)
  const propio = new Map<string, number>();
  const porPadre = new Map<string, { suma: number; n: number }>();
  for (const it of items) {
    if (it.esItemHoja === false) continue;
    const v = avanceDe(it);
    const padre = String(it.parentActivityId || '').trim().toLowerCase();
    if (padre) {
      const p = porPadre.get(padre) || { suma: 0, n: 0 };
      p.suma += v; p.n++;
      porPadre.set(padre, p);
    } else if (it.activityId) {
      const k = String(it.activityId).trim().toLowerCase();
      propio.set(k, (propio.get(k) || 0) + v);
    }
  }

  const t = m.task;
  const tr = m.xer.tablas.get('TASKRSRC');
  const rid = rsrcVentaId(m);
  const costoT3 = new Map<string, number>();
  for (const f of tr?.filas || []) {
    if (celda(tr!, f, 'rsrc_id') !== rid) continue;
    const id = celda(tr!, f, 'task_id');
    costoT3.set(id, (costoT3.get(id) || 0) + (Number(celda(tr!, f, 'act_reg_cost')) || 0));
  }

  const cambios: FilaCosto[] = [];
  let iguales = 0, noEnM3 = 0, totalT3 = 0, totalM3 = 0;
  t.filas.forEach((f, i) => {
    const cod = celda(t, f, 'task_code');
    const k = cod.trim().toLowerCase();
    const hijos = porPadre.get(k);
    const enM3 = hijos || propio.has(k);
    if (!enM3) { noEnM3++; return; }
    const avanceM3 = Math.round((hijos ? hijos.suma : propio.get(k)!) * 100) / 100;
    const id = celda(t, f, 'task_id');
    const actualT3 = costoT3.has(id) ? Math.round(costoT3.get(id)! * 100) / 100 : null;
    totalM3 += avanceM3; totalT3 += actualT3 ?? 0;
    const delta = Math.round((avanceM3 - (actualT3 ?? 0)) * 100) / 100;
    if (actualT3 != null && Math.abs(delta) <= 0.01) { iguales++; return; }
    if (actualT3 == null && avanceM3 === 0) { iguales++; return; }
    const estado = celda(t, f, 'status_code');
    let nota = '';
    if (actualT3 == null) nota = 'No sales resource (V) assignment in T₃: create it (e.g. with Master Only) or in Primavera';
    else if (estado === 'TK_NotStart' && avanceM3 > 0) nota = 'Not Started in T₃ with Venta Ex: start it in the Start tab';
    cambios.push({ i, cod, nombre: celda(t, f, 'task_name'), estado, actualT3, avanceM3, delta, rubros: hijos?.n ?? 0, nota, ok: actualT3 != null });
  });
  cambios.sort((a, b) => Number(b.ok) - Number(a.ok) || Math.abs(b.delta) - Math.abs(a.delta));
  return { cambios, iguales, noEnM3, totalT3, totalM3 };
}
