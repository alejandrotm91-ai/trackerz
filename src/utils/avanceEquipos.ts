/**
 * Avance de equipos por área (fabricación, flete e instalación), con la misma lógica y la misma
 * fuente que la pestaña Proceso: el último estado de equipos cargado en el navegador o el incluido en la app.
 */
import snapData from '../data/estadoEquiposSnap.json';
import { LS_KEY, build, agg, isCable, eqU, natCmp } from './estadoEquiposDomain';
import type { RawSnapshot, Equipo } from '../types/estadoEquipos';
import type { AvanceEquipos } from '../types/reporteIA';

function leerEstado(): RawSnapshot {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.m) && parsed.m.length > 0) return parsed;
    }
  } catch { /* se usa el estado incluido en la app */ }
  return snapData as unknown as RawSnapshot;
}

const pct = (v: number | null) => Math.round((v || 0) * 1000) / 10;

function resumir(items: Equipo[]) {
  const a = agg(items);
  return {
    estructuras: new Set(items.map(i => i.cap)).size,
    partidas: a.n,
    equipos: items.reduce((t, it) => t + eqU(it), 0),
    fabricacion: pct(a.st.D.pv),
    flete: pct(a.st.E.pv),
    instalacion: pct(a.st.F.pv),
  };
}

export function calcularAvanceEquipos(): AvanceEquipos | undefined {
  try {
    // Mismo universo que Proceso: sin cables ni conductores, sin partida D y con cantidad
    const universo = build(leerEstado()).filter(it => !isCable(it) && !it.pend && it.qty > 0);
    if (universo.length === 0) return undefined;
    const porArea = new Map<string, Equipo[]>();
    for (const it of universo) {
      if (!porArea.has(it.proc)) porArea.set(it.proc, []);
      porArea.get(it.proc)!.push(it);
    }
    const { estructuras, partidas, equipos, fabricacion, flete, instalacion } = resumir(universo);
    return {
      total: { estructuras, partidas, equipos, fabricacion, flete, instalacion },
      areas: [...porArea.entries()]
        .sort((x, y) => natCmp(x[0], y[0]))
        .map(([area, items]) => ({ area, ...resumir(items) })),
    };
  } catch (e) {
    console.warn('No se pudo calcular el avance de equipos:', e);
    return undefined;
  }
}
