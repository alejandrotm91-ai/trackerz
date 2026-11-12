/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MasterCdoWeek {
  id: string; // Typically 'YYYY-MM-DD'
  fecha: string; // ISO string 'YYYY-MM-DD'
  label: string; // e.g. "Sem 06-Feb", "06/02/2026"
  cerrada?: boolean;
}

export interface MasterCdoItem {
  id: string;
  wbs: string;
  idOrig: string;
  activityId: string;
  descripcion: string;
  unidad: string;
  cantidadPresupuesto: number; // Cantidad total contratada / presupuestada
  precio: number; // Precio unitario
  step: number; // Step factor (ej. 1, 0.5, etc.)
  venta: number; // Venta contratada o calculada (cantidadPresupuesto * precio * step)
  subcontratista: string;
  pAc?: string;
  cap?: string;
  scap?: string;
  proceso?: string;
  status?: string;
  esItemHoja?: boolean;
  wbsRaw?: string;
  wbsDesc?: string;
  // Attributes for Activity ID
  macro?: string;
  grupo?: string;
  tipo?: string;
  partidas?: string;
  componente?: string;
  unit?: string;
  ubicacion?: string;
  resp?: string;
  // Cantidades de obra ejecutadas por semana (clave: week.id, valor: cantidad física de avance)
  cantidadesSemanales: Record<string, number>;
  // Avance económico ejecutado por semana (clave: week.id, valor: monto en venta/dólares)
  ventasSemanales?: Record<string, number>;
  notas?: string;
  // Partida dentro de una actividad P6: Activity ID de su actividad (Col A del CDO, p. ej. "AC111.p6")
  parentActivityId?: string;
}

export interface MasterCdoTotals {
  totalVentaPresupuesto: number;
  totalAvanceEconomico: number;
  totalSaldoEconomico: number;
  pctAvanceEconomico: number;
  totalCantidadPresupuesto: number;
  totalCantidadEjecutada: number;
  pctAvanceFisico: number;
}

export interface MasterCdoPlanDoc {
  id: string;
  fileName: string;
  totalRows: number;
  semanas: MasterCdoWeek[];
  updatedAt: string;
  updatedBy?: string;
  totales?: MasterCdoTotals;
}
