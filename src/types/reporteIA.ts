/**
 * Reporte estándar de Inteligencia (botón "Inteligencia" del Cronograma).
 *
 * Las cifras y tablas (`datos`) las calcula la app, así el formato es siempre el mismo.
 * Claude solo escribe el análisis (`analisis`), con un esquema fijo.
 */

export interface KpisReporte {
  totalActividades: number;
  retrasadas: number;
  proximas4Semanas: number;
  ventaPlan: number;
  ventaEjecutada: number;
  variacion: number;
  partidasCriticas: number;
  montoCritico: number;
  equiposPendientes: number;
  partidasEquipos: number;
}

export interface DatosReporte {
  fechaCorte: string;
  kpis: KpisReporte;
  tipologias: {
    nombre: string; ventaPlan: number; ventaEjecutada: number; variacion: number;
    pctAvance: number; partidas: number; criticas: number;
  }[];
  partidasCriticas: {
    activityId: string; descripcion: string; tipologia: string;
    ventaPlan: number; ventaEjecutada: number; variacion: number; estado: string;
  }[];
  retrasos: { area: string; retrasadas: number; maxDiasAtraso: number }[];
  proximas: { area: string; actividades: number }[];
  equipamiento: {
    tipo: string; scap: string; pendiente: number; unidades: string; partidas: number; avance: number;
  }[];
}

export type EstadoGeneral = 'En control' | 'Requiere atención' | 'Crítico';
export type Prioridad = 'Alta' | 'Media' | 'Baja';

export interface AnalisisReporte {
  estadoGeneral: EstadoGeneral;
  resumenEjecutivo: string;
  puntosClave: string[];
  comparacionAnterior: string;
  economico: { analisis: string; hallazgos: string[] };
  retrasos: { analisis: string; areasCriticas: { area: string; comentario: string }[] };
  proximas: { analisis: string; compromisos: { area: string; compromiso: string }[] };
  equipamiento: { analisis: string };
  recomendaciones: { prioridad: Prioridad; accion: string; area: string; plazo: string }[];
}

export interface ReporteIA {
  version: 2;
  datos: DatosReporte;
  analisis: AnalisisReporte;
  /** Indicadores del reporte anterior, para mostrar la evolución. */
  anterior?: { fechaCorte: string; generadoEn: string; estadoGeneral?: EstadoGeneral; kpis: KpisReporte };
  modelo: string;
}
