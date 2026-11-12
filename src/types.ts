/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Actividad {
  id: string;
  wbs: string;
  wbsRaw?: string;
  activityId: string | null;
  descripcion: string;
  unidad: string;
  nivel: number;
  esItemHoja: boolean;
  venta: number;
  ventaM: number;
  ventaPlan: number;
  ventaPlanPG004?: number;
  ventaEjecutada: number;
  balance: number;
  saldo: number;
  excedente: number;
  partidas: string;
  tipo: string;
  subcontratista: string;
  ubicacion: string;
  proceso: string;
  cap: string;
  scap: string;
  macro: string;
  componente: string;
  unit: string;
  resp: string;
  pAc?: string;
  grupo?: string;
  status: string;
  ventaFebrero: number;
  certificaciones: Record<number, number>;
  certificacionesPorFecha: Record<string, number>;
  cantidadesPorFecha?: Record<string, number>;
  planificadoPorFecha?: Record<string, number>;
  planificadoPorFechaPG003?: Record<string, number>;
  planificadoPorFechaPG004?: Record<string, number>;
  blStart: Date | null;
  blFinish: Date | null;
  start: Date | null;
  finish: Date | null;
  diasAtrasoInicio: number;
  diasAtrasoFin: number;
  diasAtrasoMaximo: number;
  estaAtrasadoCronograma: boolean;
  totalFloat: number | null;
  p6Status: string;
  avanceAT?: number | null;
  idOrig?: string | null;
  cantidadCdo?: number | null;
  precio?: number | null;
  step?: number | null;
  unitAgregado?: any;
  scapAgregado?: any;
  capAgregado?: any;
  procesoAgregado?: any;
  // Solo en actividades P6: sus partidas (filas cuya Col A es el Activity ID de esta actividad).
  // Las usa la pestaña Master; el resto de la app trabaja con la actividad ya consolidada.
  hijosP6?: HijoP6[];
}

export interface PlanillaItem {
  id: string;
  cod: string;
  nivel: number;
  esHoja: boolean;
  tipo: string;
  macro: string;
  tipoG: string;
  desc: string;
  unidad: string;
  tarifa: number;
  contrato: number;
  saldo: number;
  acum: number;
  anterior: number;
  cert: number;
  exc: number;
  excE6: number;
  /** Partida (Col H de la Sabana): se cruza con el id.orig del Master. */
  partida?: string;
  /** Cantidad del contrato (Col L) y cantidad planillada acumulada (Col R). */
  qContrato?: number;
  qAcum?: number;
}

/** Partida dentro de una actividad P6 (fila del CDO cuya Col A es el Activity ID ".p6"). */
export interface HijoP6 {
  id: string;
  activityId: string;
  idOrig: string;
  descripcion: string;
  unidad: string;
  cantidadCdo: number;
  precio: number;
  step: number;
  venta: number;
  subcontratista?: string;
  cap?: string;
  scap?: string;
  tipo?: string;
  macro?: string;
  grupo?: string;
  partidas?: string;
  unit?: string;
  componente?: string;
  ubicacion?: string;
  proceso?: string;
  resp?: string;
  pAc?: string;
  status?: string;
  certificacionesPorFecha?: Record<string, number>;
}
