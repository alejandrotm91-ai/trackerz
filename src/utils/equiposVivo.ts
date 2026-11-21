/**
 * Estado de equipos (pestaña Proceso) siempre al día con el Master.
 *
 * - Al cargar el Master en la app se extraen sus equipos y se guardan en este navegador.
 * - Al publicar el Master en la nube (admin) también se publican, para que todos vean lo mismo.
 * - Proceso usa la versión más reciente entre la nube, la de este navegador y la incluida en la app.
 */
import { apiFetch } from './api';
import { LS_KEY } from './estadoEquiposDomain';
import type { RawSnapshot } from '../types/estadoEquipos';

const DOC = 'estado-equipos';
export const EVENTO_EQUIPOS = 'trakciona:equipos-actualizados';

/** Fecha de un snapshot para compararlo (carga exacta o, si no hay, el día en que se armó). */
const fecha = (s?: RawSnapshot | null) => (s?.meta?.cargado || s?.meta?.built || '');

/** El más reciente de los snapshots dados (los vacíos se ignoran). */
export function masReciente(...lista: (RawSnapshot | null | undefined)[]): RawSnapshot | null {
  let mejor: RawSnapshot | null = null;
  for (const s of lista) {
    if (!s || !Array.isArray(s.m) || s.m.length === 0) continue;
    if (!mejor || fecha(s) > fecha(mejor)) mejor = s;
  }
  return mejor;
}

export function leerLocal(): RawSnapshot | null {
  try {
    const t = localStorage.getItem(LS_KEY);
    return t ? (JSON.parse(t) as RawSnapshot) : null;
  } catch {
    return null;
  }
}

/** Guarda en este navegador y avisa a la pestaña Proceso si está abierta. */
export function guardarLocal(snap: RawSnapshot) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(snap));
  } catch (e) {
    console.warn('No se pudo guardar el estado de equipos en este navegador:', e);
  }
  window.dispatchEvent(new CustomEvent(EVENTO_EQUIPOS, { detail: snap }));
}

/** Publica en la nube (solo admin). */
export async function publicarEnNube(snap: RawSnapshot) {
  await apiFetch(`/api/docs/${DOC}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snap),
  });
}

export async function leerDeNube(): Promise<RawSnapshot | null> {
  try {
    const res = await apiFetch(`/api/docs/${DOC}`, { cache: 'no-store' }, [404]);
    if (!res.ok) return null;
    return (await res.json()) as RawSnapshot;
  } catch (e) {
    console.warn('No se pudo leer el estado de equipos de la nube:', e);
    return null;
  }
}
