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
}
