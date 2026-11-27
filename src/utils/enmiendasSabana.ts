/**
 * Lee el bloque "Contrato + Enmiendas" de la hoja Sabana (zona BA:BI aprox.).
 *
 * Cada enmienda empieza con una fila de encabezado (etiqueta, "Incremento", "Monto",
 * "Planillado", "Excedentes", "Saldo", "Adicional"), sigue con sus filas (OC, EQ…) y
 * cierra con una fila "Total". Después de la última enmienda viene el Gran Total.
 *
 * Las columnas se ubican por el texto del encabezado, no por posición, para que
 * insertar o mover columnas en el Excel no rompa la lectura.
 */
import { ctPf } from './helpers';

type Columnas = {
  etiqueta: number;
  contratoAcum: number;
  incremento: number;
  monto: number;
  planillado: number;
  excedentes: number;
  saldo: number;
  adicional: number;
};

const norm = (v: unknown) =>
  String(v ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Columna cuyo encabezado coincide con `nombre` (exacto, o que empiece por él). */
function buscar(fila: any[], nombre: string, desde: number, hasta: number): number {
  for (let c = desde; c <= hasta; c++) if (norm(fila[c]) === nombre) return c;
  for (let c = desde; c <= hasta; c++) if (norm(fila[c]).startsWith(nombre)) return c;
  return -1;
}

/** Si la fila es un encabezado de enmienda, devuelve sus columnas. `siguiente` es la primera fila de datos. */
function columnasDeEncabezado(fila: any[], siguiente?: any[]): Columnas | null {
  if (!fila) return null;
  let incremento = -1;
  for (let c = 0; c < fila.length; c++) {
    if (norm(fila[c]) === 'incremento') { incremento = c; break; }
  }
  if (incremento < 0) return null;
  const hasta = incremento + 10;
  const monto = buscar(fila, 'monto', incremento + 1, hasta);
  const planillado = buscar(fila, 'planillado', incremento + 1, hasta);
  if (monto < 0 || planillado < 0) return null;

  // Columna de la etiqueta ("Contrato Original", "E.3"…): el texto más a la izquierda cerca del bloque
  let etiqueta = -1;
  for (let c = Math.max(0, incremento - 4); c < incremento; c++) {
    if (norm(fila[c])) { etiqueta = c; break; }
  }
  if (etiqueta < 0) etiqueta = incremento - 2;

  // Contrato acumulado (no suele tener título): la que diga "contrato…" entre la etiqueta y el
  // incremento; si no, la más cercana al incremento que traiga una cifra en la primera fila de datos
  let contratoAcum = -1;
  for (let c = etiqueta + 1; c < incremento; c++) if (norm(fila[c]).startsWith('contrato')) contratoAcum = c;
  if (contratoAcum < 0 && siguiente) {
    for (let c = incremento - 1; c > etiqueta; c--) if (typeof siguiente[c] === 'number') { contratoAcum = c; break; }
  }
  if (contratoAcum < 0) contratoAcum = incremento - 1;

  return {
    etiqueta,
    contratoAcum,
    incremento,
    monto,
    planillado,
    excedentes: buscar(fila, 'excedente', incremento + 1, hasta),
    saldo: buscar(fila, 'saldo', incremento + 1, hasta),
    adicional: buscar(fila, 'adicional', incremento + 1, hasta),
  };
}

const num = (fila: any[], c: number) => (c >= 0 ? ctPf(fila[c]) : 0);

export function leerEnmiendasSabana(raw: any[][]): any[] {
  const enmiendas: any[] = [];
  let ultimas: Columnas | null = null; // columnas de la última enmienda (las usa el Gran Total)
  let finUltima = -1; // fila del "Total" que cierra la última enmienda

  for (let j = 0; j < raw.length; j++) {
    const cols = columnasDeEncabezado(raw[j], raw[j + 1]);
    if (!cols) continue;

    // Las columnas de saldo/adicional pueden no tener título en todas las enmiendas: se heredan
    if (ultimas) {
      if (cols.excedentes < 0) cols.excedentes = ultimas.excedentes;
      if (cols.saldo < 0) cols.saldo = ultimas.saldo;
      if (cols.adicional < 0) cols.adicional = ultimas.adicional;
    }

    const label = String(raw[j][cols.etiqueta] ?? '').trim() || 'Contrato Original';
    const filas: any[] = [];
    let subtotal: any = null;
    let k = j + 1;
    for (; k < raw.length; k++) {
      const rr = raw[k];
      if (!rr) continue;
      if (columnasDeEncabezado(rr)) { k--; break; } // empieza otra enmienda sin "Total"
      const t2 = String(rr[cols.etiqueta] ?? '').trim();
      if (norm(t2) === 'total') {
        const oc = filas[0] || {};
        subtotal = {
          contratoAcum: oc.contratoAcum || 0, incremento: oc.incremento || 0,
          monto: num(rr, cols.monto), planillado: num(rr, cols.planillado), excedentes: num(rr, cols.excedentes),
          saldo: oc.saldo || 0, adicional: oc.adicional || 0,
        };
        break;
      }
      if (!t2) continue;
      filas.push({
        tipo: t2,
        contratoAcum: num(rr, cols.contratoAcum), incremento: num(rr, cols.incremento),
        monto: num(rr, cols.monto), planillado: num(rr, cols.planillado), excedentes: num(rr, cols.excedentes),
        saldo: num(rr, cols.saldo), adicional: num(rr, cols.adicional),
      });
    }
    if (filas.length) enmiendas.push({ label, filas, subtotal });
    ultimas = cols;
    finUltima = k;
    j = Math.max(j, k);
  }

  // Gran Total: primera fila "Total" poco después de la última enmienda
  if (ultimas) {
    for (let j = finUltima + 1; j < Math.min(raw.length, finUltima + 8); j++) {
      const r = raw[j];
      if (!r) continue;
      if (norm(r[ultimas.etiqueta]) !== 'total') continue;
      enmiendas.push({
        label: 'GRAN TOTAL', isGranTotal: true, filas: [],
        subtotal: {
          incremento: num(r, ultimas.incremento), monto: num(r, ultimas.monto), planillado: num(r, ultimas.planillado),
          excedentes: num(r, ultimas.excedentes), saldo: num(r, ultimas.saldo), adicional: num(r, ultimas.adicional),
        },
      });
      break;
    }
  }
  return enmiendas;
}
