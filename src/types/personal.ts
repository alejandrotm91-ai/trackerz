/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TipoPersonal = 'Directo' | 'Indirecto';

export interface PersonalRegistro {
  id: string;
  rawId?: string | number;
  fecha: string; // Visual format e.g. "17-ago-26" or "17/08/2026"
  fechaIso: string; // "YYYY-MM-DD" for chronological sorting and filtering
  fechaDate?: Date;
  semanaKey: string; // e.g. "Semana 34 (17-ago-26)" or "2026-W34"
  semanaLabel: string; // e.g. "Sem 34 (17/08 - 23/08)"
  mesKey: string; // "2026-08"
  mesLabel: string; // "Agosto 2026"
  empresa: string;
  frente: string;
  actividad: string;
  tipo: TipoPersonal; // 'Indirecto' if frente contains campamento, bodega, puerta norte, puerta sur; else 'Directo'
  hd: number; // Hombres diurno
  md: number; // Mujeres diurno
  hn: number; // Hombres noche
  mn: number; // Mujeres noche
  h: number;  // Total hombres
  m: number;  // Total mujeres
  total: number; // Total personal (H + M)
  ubicacion: string; // "Merinos" | "Progreso" | etc.
}

export interface MesDetalleEmpresa {
  mesKey: string;
  mesLabel: string;
  total: number;
  promDiario: number;
  directoTotal: number;
  indirectoTotal: number;
  directoPromedio: number;
  indirectoPromedio: number;
  hombresTotal: number;
  mujeresTotal: number;
  diurnoTotal: number;
  nocheTotal: number;
  numDias: number;
}

export interface PersonalResumenEmpresa {
  empresa: string;
  directoTotal: number;
  indirectoTotal: number;
  hombresTotal: number;
  mujeresTotal: number;
  diurnoTotal: number;
  nocheTotal: number;
  total: number;
  porcentaje: number;
  registros: number;
  frentes: string[];
  ubicaciones: string[];
  // Métricas de Promedio Diario del Mes Corriente / Seleccionado
  promedioDiarioMesCorriente: number;
  directoPromedioMesCorriente: number;
  indirectoPromedioMesCorriente: number;
  hombresPromedioMesCorriente: number;
  mujeresPromedioMesCorriente: number;
  diurnoPromedioMesCorriente: number;
  nochePromedioMesCorriente: number;
  desgloseMensual: Record<string, MesDetalleEmpresa>;
}

export interface PersonalFilterState {
  ubicacion: string; // 'all' | 'merinos' | 'progreso'
  mes: string; // 'all' | 'YYYY-MM'
  semana: string; // 'all' | 'semanaKey'
  fecha: string; // 'all' | 'YYYY-MM-DD'
  tipo: 'all' | 'Directo' | 'Indirecto';
  empresa: string; // 'all' | empresa name
  frente: string; // 'all' | frente name
  turno: 'all' | 'diurno' | 'noche';
  genero: 'all' | 'hombres' | 'mujeres';
  search: string;
}
