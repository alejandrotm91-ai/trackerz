/**
 * Lectura y escritura de archivos XER de Primavera P6.
 * Un XER es texto separado por tabuladores: "ERMHDR" (cabecera), y por cada tabla
 * "%T" (nombre), "%F" (campos) y "%R" (filas); termina en "%E". Se conserva todo tal cual
 * para poder volver a escribirlo: solo cambian las celdas que se editan.
 */

export interface TablaXer {
  nombre: string;
  campos: string[];
  filas: string[][];
  /** Posición de cada campo en la fila. */
  idx: Record<string, number>;
}

export interface Xer {
  cabecera: string[];
  tablas: Map<string, TablaXer>;
  /** Orden original de las tablas, para escribirlas igual. */
  orden: string[];
}

/** Decodifica bytes Windows-1252 (codificación habitual de los XER). */
export function decodificarXer(bytes: Uint8Array): string {
  try {
    return new TextDecoder('windows-1252').decode(bytes);
  } catch {
    return new TextDecoder('latin1').decode(bytes);
  }
}

export function leerXer(texto: string): Xer {
  const tablas = new Map<string, TablaXer>();
  const orden: string[] = [];
  let cabecera: string[] = [];
  let actual: TablaXer | null = null;
  const lineas = texto.split(/\r?\n/);
  for (const linea of lineas) {
    if (!linea) continue;
    const tab = linea.indexOf('\t');
    const tag = tab < 0 ? linea : linea.slice(0, tab);
    const resto = tab < 0 ? '' : linea.slice(tab + 1);
    if (tag === 'ERMHDR') cabecera = resto.split('\t');
    else if (tag === '%T') {
      actual = { nombre: resto, campos: [], filas: [], idx: {} };
      tablas.set(resto, actual);
      orden.push(resto);
    } else if (tag === '%F' && actual) {
      actual.campos = resto.split('\t');
      actual.campos.forEach((c, i) => { actual!.idx[c] = i; });
    } else if (tag === '%R' && actual) {
      const fila = resto.split('\t');
      while (fila.length < actual.campos.length) fila.push('');
      actual.filas.push(fila);
    }
  }
  return { cabecera, tablas, orden };
}

/** Vuelve a escribir el XER (CRLF, como lo exporta P6). */
export function escribirXer(x: Xer): string {
  const out: string[] = ['ERMHDR\t' + x.cabecera.join('\t')];
  for (const n of x.orden) {
    const t = x.tablas.get(n)!;
    out.push('%T\t' + t.nombre);
    out.push('%F\t' + t.campos.join('\t'));
    for (const f of t.filas) out.push('%R\t' + f.join('\t'));
  }
  out.push('%E');
  return out.join('\r\n') + '\r\n';
}

/** Codifica texto a Windows-1252 para descargar el XER (los caracteres fuera de la tabla van como "?"). */
export function codificarXer(texto: string): Uint8Array {
  const especiales: Record<number, number> = {
    0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
    0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
    0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
    0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
  };
  const out = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    out[i] = c < 0x80 || (c >= 0xa0 && c <= 0xff) ? c : especiales[c] ?? 0x3f;
  }
  return out;
}

/** Filas de una tabla como objetos (solo lectura, para consultas). */
export function objetos(t: TablaXer | undefined): Record<string, string>[] {
  if (!t) return [];
  return t.filas.map(f => {
    const o: Record<string, string> = {};
    t.campos.forEach((c, i) => { o[c] = f[i] ?? ''; });
    return o;
  });
}

/** Lee una celda por nombre de campo. */
export const celda = (t: TablaXer, fila: string[], campo: string) => fila[t.idx[campo]] ?? '';

/** Escribe una celda por nombre de campo (si el campo existe). */
export function ponerCelda(t: TablaXer, fila: string[], campo: string, valor: string) {
  const i = t.idx[campo];
  if (i !== undefined) fila[i] = valor;
}
