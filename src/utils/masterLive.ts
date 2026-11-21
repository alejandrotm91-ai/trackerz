/**
 * Filas del Master compartidas entre pestañas.
 *
 * La pestaña Master publica aquí sus filas cada vez que cambian, así otras vistas
 * (p. ej. la comparación CDO vs Planilla) usan lo mismo que se está editando.
 * Si el Master todavía no se abrió, se cargan en el mismo orden que usa la pestaña:
 * borrador del navegador → nube → Excel cargado.
 */
import { useEffect, useSyncExternalStore } from 'react';
import type { MasterCdoItem } from '../types/masterCdo';
import type { Actividad } from '../types';
import { loadLocalMasterDraft } from './masterCdoLocalDraft';
import { initializeMasterCdoFromActividades, loadLatestMasterCdoFromCloud } from './masterCdoSync';

export type FuenteMaster = 'master' | 'borrador' | 'nube' | 'excel';

export const FUENTE_LABEL: Record<FuenteMaster, string> = {
  master: 'Master (en edición)',
  borrador: 'Master · borrador del navegador',
  nube: 'Master · guardado en la nube',
  excel: 'Master · Excel cargado',
};

interface EstadoMaster {
  items: MasterCdoItem[];
  fuente: FuenteMaster | null;
  cargando: boolean;
}

let estado: EstadoMaster = { items: [], fuente: null, cargando: false };
let actividadesSemilla: Actividad[] | null = null;
const oyentes = new Set<() => void>();

function cambiar(nuevo: Partial<EstadoMaster>) {
  estado = { ...estado, ...nuevo };
  oyentes.forEach(o => o());
}

const suscribir = (o: () => void) => {
  oyentes.add(o);
  return () => { oyentes.delete(o); };
};

/** La pestaña Master llama a esto cada vez que cambian sus filas. */
export function publicarMasterVivo(items: MasterCdoItem[]) {
  if (items.length > 0) cambiar({ items, fuente: 'master', cargando: false });
}

async function cargar(actividades: Actividad[], mapaColumnasMes?: Record<string, number>) {
  cambiar({ cargando: true });
  try {
    const borrador = await loadLocalMasterDraft();
    if (estado.fuente === 'master') return;
    if (borrador?.items?.length) return cambiar({ items: borrador.items, fuente: 'borrador' });
  } catch { /* sin borrador */ }
  try {
    const nube = await loadLatestMasterCdoFromCloud(undefined, 25000);
    if (estado.fuente === 'master') return;
    if (nube?.items?.length) return cambiar({ items: nube.items, fuente: 'nube' });
  } catch { /* sin Master en la nube */ }
  if (estado.fuente === 'master') return;
  actividadesSemilla = actividades;
  const semilla = initializeMasterCdoFromActividades(actividades, mapaColumnasMes);
  cambiar({ items: semilla.items, fuente: 'excel' });
}

/**
 * Filas del Master para otras vistas. Solo carga cuando `activo` (p. ej. al abrir la tarjeta).
 */
export function useMasterVivo(
  actividades: Actividad[],
  mapaColumnasMes: Record<string, number> | undefined,
  activo: boolean
): EstadoMaster {
  const snap = useSyncExternalStore(suscribir, () => estado);
  useEffect(() => {
    if (!activo || estado.cargando || !actividades?.length) return;
    // Si se cargó un Excel nuevo y el Master venía del Excel anterior, se recalcula.
    const semillaVieja = estado.fuente === 'excel' && actividadesSemilla !== actividades;
    if (estado.items.length > 0 && !semillaVieja) return;
    cargar(actividades, mapaColumnasMes).finally(() => cambiar({ cargando: false }));
  }, [activo, actividades, mapaColumnasMes]);
  return snap;
}
