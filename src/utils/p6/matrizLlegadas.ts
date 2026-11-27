/**
 * Lector de la matriz semanal «ESTADO IMPORTACION EQUIPOS PRINCIPALES» (memoria «Llegadas de equipos a obra»,
 * anexo A), con ExcelJS (se carga solo al leer el archivo).
 *
 * - Hoja: la primera visible cuya celda AW3 dice «LLEGADA» (o la que se elija).
 * - Encabezados en la fila 3, datos desde la 4; solo cuentan las filas con PARTIDA (columna G).
 * - Celdas combinadas: toman el valor de la maestra, salvo la CANTIDAD (J), que solo cuenta en la maestra.
 *   AR, AS y AU vacías se toman de la fila maestra del bloque de AW.
 * - Estado de importación: SOLO por el color de relleno de G (verde oscuro = ya zarpó, verde claro = por llegar,
 *   sin relleno = lejos de llegar, otro color = otro).
 */
export type EstadoImportacion = 'zarpado' | 'por_zarpar' | 'lejos' | 'otro';

export interface FilaMatriz {
  f: number;
  paq: string | null;
  imp: string | null;
  p: string;
  eq: string | null;
  q: number | null;
  fab: string | null;
  pais: string | null;
  env: string | null;
  bl: string | null;
  /** Fecha de embarque (AR). */
  emb: string | null;
  pto: string | null;
  /** Llegada a puerto (AU). */
  lp: string | null;
  /** Fecha estimada de llegada a obra (AW). */
  aw: string | null;
  grp: string | null;
  hex: string;
  cat: EstadoImportacion;
}

export interface MatrizLlegadas {
  archivo: string;
  hoja: string;
  hojas: string[];
  cargada: string;
  cargadaPor?: string;
  filas: FilaMatriz[];
}

const THEME = ['FFFFFF', '000000', 'E7E6E6', '44546A', '4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47', '0563C1', '954F72'];
const COLS = { C: 3, D: 4, G: 7, I: 9, J: 10, L: 12, S: 19, AE: 31, AG: 33, AR: 44, AS: 45, AU: 47, AW: 49 } as const;
type Col = keyof typeof COLS;

const hexToRgb = (h: string) => [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16));
function rgbToHsl([r, g, b]: number[]): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
  }
  return [h, s, l];
}
function hslToRgb([h, s, l]: number[]) {
  if (s === 0) return [l, l, l].map(v => Math.round(v * 255));
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => { t = ((t + 360) % 360) / 360; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 0.5) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  return [f(h + 120), f(h), f(h - 120)].map(v => Math.round(v * 255));
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fillHex(cell: any): string | null {
  const f = cell.fill;
  if (!f || f.type !== 'pattern' || !f.pattern || f.pattern === 'none' || !f.fgColor) return null;
  const c = f.fgColor;
  let hex: string;
  if (c.argb) hex = c.argb.slice(-6);
  else if (c.theme !== undefined) hex = THEME[c.theme] || 'FFFFFF';
  else if (c.indexed !== undefined) return c.indexed === 64 ? null : 'IDX' + c.indexed;
  else return null;
  if (c.tint) {
    const hsl = rgbToHsl(hexToRgb(hex));
    hsl[2] = c.tint < 0 ? hsl[2] * (1 + c.tint) : hsl[2] * (1 - c.tint) + c.tint;
    hex = hslToRgb(hsl).map(v => v.toString(16).padStart(2, '0')).join('');
  }
  return hex.toUpperCase();
}
export function clasificarColor(hex: string | null): EstadoImportacion {
  if (!hex || hex === 'FFFFFF') return 'lejos';
  if (hex.startsWith('IDX')) return 'otro';
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  if (h >= 70 && h <= 165 && s >= 0.2) return l < 0.68 ? 'zarpado' : 'por_zarpar';
  return 'otro';
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const iso = (y: number, m: number, d: number) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y > 1990 && y < 2100)
  ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function raw(v: any): any {
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if ('result' in v) return v.result;
    if (v.richText) return v.richText.map((t: { text: string }) => t.text).join('');
    if ('text' in v) return v.text;
    if ('formula' in v || 'sharedFormula' in v) return null;
    if (v.error) return null;
  }
  return v;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function txt(v: any): string | null { v = raw(v); if (v === null || v === undefined) return null; if (v instanceof Date) return v.toISOString().slice(0, 10); const s = String(v).trim(); return s === '' ? null : s; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dateISO(v: any, d1904: boolean): string | null {
  v = raw(v);
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Math.round((v - (d1904 ? -1462 : 0) - 25569) * 86400000)).toISOString().slice(0, 10);
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return iso(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
    if (m) return iso(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
    m = s.match(/^(\d{1,2})[\s/.-]+([a-zé]{3,})[\s/.-]+(\d{2,4})$/);
    if (m) { const mi = MESES.findIndex(x => m![2].startsWith(x)); if (mi >= 0) return iso(+m[3] < 100 ? 2000 + +m[3] : +m[3], (mi % 12) + 1, +m[1]); }
  }
  return null;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function num(v: any): number | null { v = raw(v); if (typeof v === 'number') return v; if (typeof v === 'string') { const n = parseFloat(v.replace(',', '.')); return isNaN(n) ? null : n; } return null; }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const esHojaSeguimiento = (ws: any) => /LLEGADA/i.test(txt(ws.getRow(3).getCell(COLS.AW).value) || '');

/** Lee la matriz (ArrayBuffer del .xlsx). `hoja`: nombre de la hoja; si no, la primera visible de seguimiento. */
export async function leerMatrizLlegadas(buf: ArrayBuffer, archivo: string, hoja?: string): Promise<MatrizLlegadas> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d1904 = !!(wb.properties as any)?.date1904;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const todas = wb.worksheets as any[];
  const visibles = todas.filter(w => w.state !== 'hidden' && w.state !== 'veryHidden');
  const ws = hoja ? wb.getWorksheet(hoja) : (visibles.find(esHojaSeguimiento) || todas.find(esHojaSeguimiento));
  if (!ws) throw new Error('No sheet with the AW column "FECHA ESTIMADA LLEGADA A OBRA" in row 3.');
  const filas: FilaMatriz[] = [];
  for (let r = 4; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const gCell = row.getCell(COLS.G);
    const partida = txt(gCell.value);
    if (!partida) continue;
    const awCell = row.getCell(COLS.AW);
    const master = awCell.isMerged ? awCell.master : awCell;
    const aw = dateISO(master.value, d1904);
    const hex = fillHex(gCell);
    const g = (c: Col) => {
      const cl = row.getCell(COLS[c]);
      const esclava = cl.isMerged && cl.master.address !== cl.address;
      if (!esclava) return cl.value;
      return c === 'J' ? null : cl.master.value;
    };
    const mrow = awCell.isMerged ? master.row : r;
    const blk = (c: Col) => {
      const v = g(c);
      if (raw(v) !== null && raw(v) !== undefined && txt(v) !== null) return v;
      if (mrow === r) return v;
      const c2 = ws.getRow(mrow).getCell(COLS[c]);
      return (c2.isMerged ? c2.master : c2).value;
    };
    const q = num(g('J'));
    filas.push({
      f: r, paq: txt(g('C')), imp: txt(g('D')), p: partida, eq: txt(g('I')), q: q === null ? null : Math.round(q * 10000) / 10000,
      fab: txt(g('L')), pais: txt(g('S')), env: txt(g('AE')), bl: txt(g('AG')),
      emb: dateISO(blk('AR'), d1904), pto: txt(blk('AS')), lp: dateISO(blk('AU'), d1904),
      aw, grp: awCell.isMerged ? master.address : null, hex: hex || '', cat: clasificarColor(hex),
    });
  }
  return {
    archivo, hoja: ws.name, hojas: todas.filter(esHojaSeguimiento).map(w => w.name),
    cargada: new Date().toISOString(), filas,
  };
}
