/**
 * Registros de personal compartidos entre pestañas.
 *
 * La pestaña Personal publica aquí lo que tiene cargado (de la nube o de un Excel nuevo)
 * cada vez que cambia, y el Resumen lo usa para su curva de tendencia. Si Personal todavía
 * no se abrió, el Resumen carga los datos de la nube por su cuenta.
 */
import { useSyncExternalStore } from 'react';
import type { PersonalRegistro } from '../types/personal';

export interface PersonalVivo {
  registros: PersonalRegistro[];
  fileName: string;
  enNube: boolean;
}

let estado: PersonalVivo | null = null;
const oyentes = new Set<() => void>();

export function publicarPersonalVivo(nuevo: PersonalVivo) {
  estado = nuevo;
  oyentes.forEach(f => f());
}

function suscribir(f: () => void) {
  oyentes.add(f);
  return () => { oyentes.delete(f); };
}

export function usePersonalVivo(): PersonalVivo | null {
  return useSyncExternalStore(suscribir, () => estado, () => estado);
}
