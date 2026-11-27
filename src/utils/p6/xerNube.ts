/**
 * Guarda y lee el XER de Primavera P6 en la nube (almacén por trozos, tipo "p6").
 * El texto se comprime con gzip y se guarda en base64, en trozos de ~1 MB.
 */
import { apiFetch } from '../api';

const TROZO = 1_000_000;

export interface MetaXer {
  nombre: string;
  proyecto: string;
  fechaDatos: string;
  actividades: number;
  guardadoEn: string;
  guardadoPor: string;
  /** Cambios hechos en Trakciona desde que se cargó el XER original. */
  cambios: number;
  bytes: number;
}

async function comprimir(texto: string): Promise<string> {
  const flujo = new Blob([texto]).stream().pipeThrough(new CompressionStream('gzip'));
  const buf = new Uint8Array(await new Response(flujo).arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function descomprimir(b64: string): Promise<string> {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const flujo = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(flujo).text();
}

export async function guardarXerEnNube(texto: string, meta: Omit<MetaXer, 'guardadoEn' | 'bytes'>, onProgreso?: (pct: number) => void): Promise<MetaXer> {
  const b64 = await comprimir(texto);
  const planId = `p6_${Date.now()}`;
  const n = Math.ceil(b64.length / TROZO);
  for (let i = 0; i < n; i++) {
    await apiFetch(`/api/cloud/p6/${planId}/xer/${i}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(b64.slice(i * TROZO, (i + 1) * TROZO)),
    });
    onProgreso?.(Math.round(((i + 1) / n) * 100));
  }
  const completa: MetaXer = { ...meta, guardadoEn: new Date().toISOString(), bytes: texto.length };
  await apiFetch(`/api/cloud/p6/${planId}/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(completa),
  });
  return completa;
}

export async function leerXerDeNube(): Promise<{ texto: string; meta: MetaXer } | null> {
  const r = await apiFetch('/api/cloud/p6/active', undefined, [404]);
  if (r.status === 404) return null;
  const { id, meta } = await r.json();
  const trozos: string[] = await (await apiFetch(`/api/cloud/p6/${id}/xer`)).json();
  return { texto: await descomprimir(trozos.join('')), meta };
}
