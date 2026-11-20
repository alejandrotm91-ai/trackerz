/**
 * Calendarios de P6 y aritmética de tiempo laborable.
 * Las fechas se manejan como minutos desde 1970 (hora local "ingenua", sin zona horaria),
 * igual que las guarda el XER ("YYYY-MM-DD HH:MM").
 * El tiempo laborable de cada calendario se mide en "minutos de trabajo" acumulados desde el
 * primer día del rango, lo que permite sumar y restar duraciones con búsquedas binarias.
 */

const DIA = 1440;
/** Rango de días cubierto por los calendarios. */
const DESDE = Date.UTC(2010, 0, 1) / 60000 / DIA;
const HASTA = Date.UTC(2050, 0, 1) / 60000 / DIA;

export type Minutos = number;
type Intervalo = [number, number]; // minutos dentro del día [inicio, fin)

export const aMinutos = (s: string): Minutos | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(s || '');
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) / 60000;
};

export const aTexto = (t: Minutos | null | undefined): string => {
  if (t == null || !isFinite(t)) return '';
  const d = new Date(t * 60000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
};

const hm = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** Lee los intervalos "(s|08:00|f|16:00)" de un trozo de clndr_data. */
function intervalos(txt: string): Intervalo[] {
  const out: Intervalo[] = [];
  const re = /s\|(\d{1,2}:\d{2})\|f\|(\d{1,2}:\d{2})|f\|(\d{1,2}:\d{2})\|s\|(\d{1,2}:\d{2})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(txt))) {
    const s = hm(m[1] ?? m[4]);
    let f = hm(m[2] ?? m[3]);
    if (f === 0) f = DIA; // "00:00" como fin = medianoche
    if (f > s) out.push([s, f]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

export class Calendario {
  readonly id: string;
  readonly nombre: string;
  /** Horas por día (para mostrar duraciones en días). */
  readonly horasDia: number;
  private dias: Intervalo[][] = [];
  private acum: Float64Array;

  constructor(id: string, nombre: string, horasDia: number, data: string) {
    this.id = id;
    this.nombre = nombre;
    this.horasDia = horasDia || 8;
    // Semana: días 1 (domingo) a 7 (sábado)
    const semana: Intervalo[][] = Array.from({ length: 8 }, () => []);
    const ini = data.indexOf('DaysOfWeek');
    const finSemana = data.indexOf('Exceptions');
    const bloqueSemana = data.slice(ini, finSemana > 0 ? finSemana : undefined);
    const reDia = /\(0\|\|([1-7])\(\)\(/g;
    const posiciones: { d: number; i: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = reDia.exec(bloqueSemana))) posiciones.push({ d: +m[1], i: m.index });
    posiciones.forEach((p, k) => {
      const trozo = bloqueSemana.slice(p.i, k + 1 < posiciones.length ? posiciones[k + 1].i : undefined);
      semana[p.d] = intervalos(trozo);
    });
    // Excepciones: "(d|40179)" sin intervalos = feriado; con intervalos = horario especial
    const excepciones = new Map<number, Intervalo[]>();
    if (finSemana > 0) {
      const bloque = data.slice(finSemana);
      const reEx = /\(0\|\|\d+\(d\|(\d+)\)\(/g;
      const pos: { serial: number; i: number }[] = [];
      while ((m = reEx.exec(bloque))) pos.push({ serial: +m[1], i: m.index });
      pos.forEach((p, k) => {
        const trozo = bloque.slice(p.i, k + 1 < pos.length ? pos[k + 1].i : undefined);
        // Serial de Excel: día 0 = 1899-12-30
        const dia = Date.UTC(1899, 11, 30) / 60000 / DIA + p.serial;
        excepciones.set(dia, intervalos(trozo.slice(trozo.indexOf(')') + 1)));
      });
    }
    const n = HASTA - DESDE;
    this.acum = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) {
      const dia = DESDE + i;
      const dow = new Date(dia * DIA * 60000).getUTCDay() + 1; // 1 = domingo
      const iv = excepciones.has(dia) ? excepciones.get(dia)! : semana[dow];
      this.dias.push(iv);
      this.acum[i + 1] = this.acum[i] + iv.reduce((s, [a, b]) => s + (b - a), 0);
    }
  }

  /** Minutos de trabajo acumulados hasta el instante t. */
  trabajo(t: Minutos): number {
    const d = Math.floor(t / DIA) - DESDE;
    if (d < 0) return 0;
    if (d >= this.dias.length) return this.acum[this.dias.length];
    const min = t - (d + DESDE) * DIA;
    let w = this.acum[d];
    for (const [a, b] of this.dias[d]) {
      if (min <= a) break;
      w += Math.min(min, b) - a;
    }
    return w;
  }

  /**
   * Instante que corresponde a w minutos de trabajo.
   * lado "inicio": si w cae justo en el fin de una jornada, salta al inicio de la siguiente.
   * lado "fin": se queda en el fin de la jornada.
   */
  instante(w: number, lado: 'inicio' | 'fin'): Minutos {
    const n = this.dias.length;
    if (w <= 0) {
      for (let d = 0; d < n; d++) if (this.dias[d].length) return (d + DESDE) * DIA + this.dias[d][0][0];
    }
    // Primer día d con acum[d+1] > w (inicio) o >= w (fin)
    let lo = 0, hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const ok = lado === 'inicio' ? this.acum[mid + 1] > w : this.acum[mid + 1] >= w;
      if (ok) hi = mid; else lo = mid + 1;
    }
    const d = lo;
    let resto = w - this.acum[d];
    for (const [a, b] of this.dias[d]) {
      const largo = b - a;
      if (lado === 'inicio' ? resto < largo : resto <= largo) return (d + DESDE) * DIA + a + resto;
      resto -= largo;
    }
    const iv = this.dias[d];
    return (d + DESDE) * DIA + (iv.length ? iv[iv.length - 1][1] : 0);
  }

  /** Lleva un instante al siguiente momento laborable (para inicios). */
  aInicio(t: Minutos): Minutos { return this.instante(this.trabajo(t), 'inicio'); }
  /** Lleva un instante al último fin laborable anterior o igual (para finales). */
  aFin(t: Minutos): Minutos { return this.instante(this.trabajo(t), 'fin'); }
  /** Suma minutos de trabajo a un instante. lado = cómo se ubica el resultado. */
  sumar(t: Minutos, minutos: number, lado: 'inicio' | 'fin'): Minutos {
    return this.instante(this.trabajo(t) + minutos, lado);
  }
  /** Minutos de trabajo entre dos instantes (b − a). */
  entre(a: Minutos, b: Minutos): number { return this.trabajo(b) - this.trabajo(a); }
}
