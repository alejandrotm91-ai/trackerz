export type StageKey = 'D' | 'E' | 'F';

export interface Stage {
  id: string;            // Activity ID completo (.D / .E / .F)
  name: string;
  qty: number;           // Cantidad
  venta: number;         // Venta
  vex: number;           // Venta Ex
  pex: number | null;    // % Ex
  ex: number;            // Cantidad ejecutada
  done: boolean;         // true si terminada
  status: string | null; // columna p6
  subc: string;
  start: string | null;
  startA: boolean;       // fecha real iniciada
  fin: string | null;
  finA: boolean;         // fecha real terminada
  blf: string | null;    // blFinish
  tf: number | null;     // Float
  missing?: boolean;     // la etapa no existe en el Master
}

export interface Equipo {
  base: string;          // Activity ID sin .D/.E/.F
  proc: string;
  cap: string;
  scap: string;
  ubic: string;
  fam: string;           // Unit || SCAP || '(sin tipo)'
  und: string;           // Unidad ('u' por defecto)
  qty: number;           // Cantidad base (de la etapa D si existe)
  contrato: string;
  comp: string;          // Componente (tipo de equipo: Civil, Tuberias, Mecanico, Electrico, I&C)
  desc: string;          // Descripción limpia
  prov: string;          // Proveedor principal (SubC D -> E -> F)
  inst: string;          // Instalador (SubC de F si difiere de prov)
  pend: boolean;         // Pendiente de regularizar (WBS D)
  s: Record<StageKey, Stage>;
  valv?: string;         // (new v32) rubro .p6 de válvulas
  nv?: number;           // (new v32) cantidad de partidas de válvulas
  provs?: string;        // (new v32) desglose de proveedores por unidades
}

export interface StageAgg {
  v: number;
  vx: number;
  ex: Record<string, number>;
  dn: Record<string, number>;
  pv: number | null;
}

export interface Agg {
  n: number;
  q: Record<string, number>;
  st: Record<StageKey, StageAgg>;
  tf: number | null;
  fin: string | null;
  blf: string | null;
  maxLate?: number | null;
  units: string[];
}

export interface UIState {
  proc: string;
  group: 'cap' | 'prov';
  mode: 'ex' | 'done' | 'open';
  q: string;
  prov: string;
  pend: boolean;
  agua: boolean;
  aSel: string[];
  aCCM: boolean;
  comp: string[];
  scap: string[];
  subc: string[];
}

export interface RawSnapshot {
  meta: {
    master: string;
    masterWeek: string | null;
    built?: string;
  };
  m: any[][];
}

export interface AguaSection {
  g: string;
  d: string;
  on: boolean;
  c: [string, string][];
}
