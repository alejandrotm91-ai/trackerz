/**
 * Ubica las columnas de la tabla principal de la hoja Sabana leyendo sus encabezados
 * (dos filas: grupo arriba —"Contrato", "Saldo por planillar", "Total Acumulado"…— y
 * subtítulo abajo —"Cantidad", "Tarifa", "Monto"—). Así, quitar o añadir columnas en el
 * Excel no rompe la carga. Si no encuentra los encabezados, usa las posiciones históricas.
 */

export interface ColumnasSabana {
  COD_PLAN: number; CODIGO: number; PARTIDA: number; DESC: number; UNIDAD: number;
  Q_CONTRATO: number; TARIFA: number; N_MONTO: number;
  Q_MONTO: number; Q_ACUM: number; S_MONTO: number; U_MONTO: number; W_MONTO: number;
  Z_MONTO: number; AC_MONTO: number;
  /** Primera fila de datos (índice 0). */
  INICIO: number;
}

/** Posiciones del Master con columnas de "Cantidad (Enmienda 6)" (hasta oct-2026). */
export const COLUMNAS_SABANA_HISTORICAS: ColumnasSabana = {
  COD_PLAN: 5, CODIGO: 6, PARTIDA: 7, DESC: 8, UNIDAD: 9,
  Q_CONTRATO: 11, TARIFA: 12, N_MONTO: 13,
  Q_MONTO: 16, Q_ACUM: 17, S_MONTO: 18, U_MONTO: 20, W_MONTO: 22,
  Z_MONTO: 25, AC_MONTO: 28,
  INICIO: 11,
};

const norm = (v: unknown) =>
  String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export function columnasSabana(raw: any[][]): ColumnasSabana {
  // Fila de grupos: la que tiene "COD. PLANEAMIENTO"
  let h = -1;
  for (let i = 0; i < Math.min(raw.length, 40) && h < 0; i++) {
    if ((raw[i] || []).some(v => norm(v).startsWith('cod. planeamiento'))) h = i;
  }
  if (h < 0) return COLUMNAS_SABANA_HISTORICAS;
  const g = raw[h] || [];
  const sub = raw[h + 1] || [];
  const ancho = Math.max(g.length, sub.length);

  const enFila = (fila: any[], pred: (t: string) => boolean) => {
    for (let c = 0; c < ancho; c++) if (pred(norm(fila[c]))) return c;
    return -1;
  };

  // Tramos de cada grupo: desde su título hasta el siguiente título
  const inicios: number[] = [];
  for (let c = 0; c < ancho; c++) if (norm(g[c])) inicios.push(c);
  const tramo = (pred: (t: string) => boolean): [number, number] | null => {
    const k = inicios.findIndex(c => pred(norm(g[c])));
    if (k < 0) return null;
    return [inicios[k], (inicios[k + 1] ?? ancho) - 1];
  };
  const subEn = (t: [number, number] | null, pred: (s: string) => boolean) => {
    if (!t) return -1;
    for (let c = t[0]; c <= t[1]; c++) if (pred(norm(sub[c]))) return c;
    return -1;
  };
  const esMonto = (s: string) => s === 'monto';
  // "Cantidad" a secas; las de "(Enmienda 6)" son históricas y no se usan
  const esCantidad = (s: string) => s.startsWith('cantidad') && !s.includes('enmienda');

  const contrato = tramo(t => t === 'contrato');
  const saldo = tramo(t => t.startsWith('saldo por planillar'));
  const acum = tramo(t => t.startsWith('total acumulado'));
  const anterior = tramo(t => t.startsWith('acumulado anterior'));
  const cert = tramo(t => t.startsWith('esta certificacion'));
  const exc = tramo(t => t.startsWith('diferencia contratado'));
  const excE6 = tramo(t => t.startsWith('excedentes no considerados'));

  const col: ColumnasSabana = {
    COD_PLAN: enFila(g, t => t.startsWith('cod. planeamiento')),
    CODIGO: enFila(g, t => t === 'codigo'),
    PARTIDA: enFila(g, t => t === 'partida'),
    DESC: enFila(g, t => t.startsWith('descripcion')),
    UNIDAD: enFila(g, t => t === 'unidad'),
    Q_CONTRATO: subEn(contrato, esCantidad),
    TARIFA: subEn(contrato, s => s === 'tarifa'),
    N_MONTO: subEn(contrato, esMonto),
    Q_MONTO: subEn(saldo, esMonto),
    Q_ACUM: subEn(acum, esCantidad),
    S_MONTO: subEn(acum, esMonto),
    U_MONTO: subEn(anterior, esMonto),
    W_MONTO: subEn(cert, esMonto),
    Z_MONTO: subEn(exc, esMonto),
    AC_MONTO: subEn(excE6, esMonto), // -1 si ya no existe en el Excel
    INICIO: h + 2,
  };

  // Lo imprescindible tiene que aparecer; si no, mejor las posiciones históricas
  const imprescindibles: (keyof ColumnasSabana)[] = ['COD_PLAN', 'CODIGO', 'PARTIDA', 'DESC', 'TARIFA', 'N_MONTO', 'S_MONTO'];
  if (imprescindibles.some(k => col[k] < 0)) return COLUMNAS_SABANA_HISTORICAS;
  return col;
}
