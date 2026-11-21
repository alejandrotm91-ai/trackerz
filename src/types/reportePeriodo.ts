/** Reporte de avance de obra por período (botón Inteligencia del Cronograma). */
import type { EstadoGeneral, Prioridad } from './reporteIA';

/** Cifras de un componente o del total en el período. Montos en la moneda del Master. */
export interface ResumenPeriodo {
  /** V. Contrato (columna Venta del Master). */
  contrato: number;
  /** V. Plan del período (PG-004 por semana). */
  plan: number;
  /** V. Ejec del período (CDO, columnas V-). */
  ejec: number;
  /** V. Ejec − V. Plan del período. */
  variacion: number;
  /** V. Ejec / V. Plan del período, en %. Null si no había nada planificado. */
  cumplimiento: number | null;
  /** Plan y ejecutado acumulados desde el inicio hasta el cierre del período. */
  acumPlan: number;
  acumEjec: number;
  /** Ejecutado acumulado / contrato, en %. */
  avance: number;
  /** Planificado acumulado / contrato, en %. */
  avancePlan: number;
  /** Ejecutado del período / contrato, en puntos de %. */
  avancePeriodo: number;
  /** Partidas con plan o ejecución en el período. */
  partidas: number;
}

export interface CapPeriodo { nombre: string; plan: number; ejec: number; variacion: number }

export interface ComponentePeriodo extends ResumenPeriodo {
  nombre: string;
  capsDestacados: CapPeriodo[];
  capsAtrasados: CapPeriodo[];
}

export interface PartidaPeriodo {
  codigo: string;
  descripcion: string;
  componente: string;
  cap: string;
  plan: number;
  ejec: number;
  variacion: number;
}

export interface ReportePeriodoDatos {
  version: 1;
  /** Primera y última semana del período (fechas ISO, como en Control de Ejecución). */
  desde: string;
  hasta: string;
  semanas: string[];
  ultimaSemanaEjecutada: string;
  total: ResumenPeriodo;
  componentes: ComponentePeriodo[];
  porSemana: { semana: string; plan: number; ejec: number }[];
  destacadas: PartidaPeriodo[];
  atrasadas: PartidaPeriodo[];
}

export type EstadoComponente = 'Adelantado' | 'Según plan' | 'Atrasado' | 'Sin actividad';

/** Lo que escribe Claude (salida estructurada). */
export interface ReportePeriodoAnalisis {
  estadoGeneral: EstadoGeneral;
  titular: string;
  resumenEjecutivo: string;
  puntosClave: string[];
  componentes: { componente: string; estado: EstadoComponente; analisis: string }[];
  tendencia: string;
  frentes: string;
  atrasos: string;
  recomendaciones: { prioridad: Prioridad; accion: string; area: string; plazo: string }[];
}

export interface ReportePeriodoGuardado {
  datos: ReportePeriodoDatos;
  analisis: ReportePeriodoAnalisis;
  modelo?: string;
  generadoEn: string;
  generadoPor?: string;
}
