import * as XLSX from 'xlsx';
import { StageKey, Stage, Equipo, Agg, StageAgg, RawSnapshot, AguaSection } from '../types/estadoEquipos';

export const STG: StageKey[] = ['D', 'E', 'F'];

export const STN: Record<StageKey, string> = {
  D: 'Compra y fabricación',
  E: 'Flete a obra',
  F: 'Instalación y pruebas'
};

export const VERB: Record<StageKey, string> = {
  D: 'fabricadas',
  E: 'fleteadas',
  F: 'instaladas'
};

export const GRMAP: Record<string, StageKey> = {
  '02': 'D',
  '03': 'E',
  '04': 'F'
};

export const LS_KEY = 'eqStatusMerinos.raw.v6';
export const UI_LS_KEY = 'eqStatusMerinos.ui';

const nf1 = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 0 });

export const isN = (v: any): v is number => typeof v === 'number' && isFinite(v);

export const fq = (v: number | null | undefined): string => {
  if (!isN(v)) return '0';
  const r = Math.round(v * 10) / 10;
  return Math.abs(r - Math.round(r)) < 1e-9 ? nf0.format(r) : nf1.format(r);
};

export const pc = (v: number | null | undefined): string => {
  return isN(v) ? nf0.format(Math.round(v * 100)) + ' %' : '—';
};

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const fd = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  const monthIdx = parseInt(m, 10) - 1;
  return `${d}-${MES[monthIdx] || m}-${y.slice(2)}`;
};

export const dd = (a: string | null | undefined, b: string | null | undefined): number | null => {
  if (!a || !b) return null;
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  if (!ay || !by) return null;
  const msA = Date.UTC(ay, am - 1, ad);
  const msB = Date.UTC(by, bm - 1, bd);
  return Math.round((msA - msB) / 864e5);
};

export function natCmp(a: string, b: string): number {
  const A = String(a).split(/[.\-]/);
  const B = String(b).split(/[.\-]/);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const x = A[i] ?? '';
    const y = B[i] ?? '';
    const nx = +x;
    const ny = +y;
    if (!isNaN(nx) && !isNaN(ny) && x !== '' && y !== '') {
      if (nx !== ny) return nx - ny;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

export function riskOf(tf: number | null | undefined): [string, string] {
  if (!isN(tf)) return ['text-slate-400 font-normal', '—'];
  if (tf <= 0) return ['text-[#B83227] font-bold', 'Crítico'];
  if (tf <= 20) return ['text-[#C9701E] font-bold', 'Alto'];
  if (tf <= 30) return ['text-[#A88A12] font-semibold', 'Moderado'];
  return ['text-[#4F7F57] font-medium', 'Moderado-Bajo'];
}

export const KFS = [
  ['done', 'Terminados'],
  ['cur', 'En curso'],
  ['none', 'Sin iniciar']
] as const;

export function stSt(it: Equipo, k: StageKey): 'done' | 'cur' | 'none' {
  const s = it.s[k];
  return s.done ? 'done' : ((s.ex || 0) > 0 || s.status === 'In Progress') ? 'cur' : 'none';
}

export function isCrit(it: Equipo): boolean {
  return STG.some(k => !it.s[k].done && isN(it.s[k].tf) && it.s[k].tf <= 0);
}

export function kfPass(it: Equipo, kf: Record<string, string[]>, skip?: string): boolean {
  for (const k in kf) {
    if (k === skip) continue;
    const v = kf[k];
    if (!v || !v.length) continue;
    if (k === 'crit') {
      if (!isCrit(it)) return false;
    } else {
      const sKey = k as StageKey;
      if (!v.includes(stSt(it, sKey))) return false;
    }
  }
  return true;
}

export function kfAny(kf: Record<string, string[]>): boolean {
  return Object.values(kf).some(v => v && v.length > 0);
}

// (new v18) cables y conductores no son equipos: quedan fuera del aplicativo
export const CABLE_RE = /^\s*(?:conductor|cables?\b|alimentador de cable|enlace de fibra|fibra [oó]ptica|punto de (?:datos cable|fibra)|patch cord|pigtail|fusi[oó]n de pigtail)/i;
export const isCable = (it: Equipo): boolean => /^conductor aislado$/i.test(it.fam) || CABLE_RE.test(it.desc || '');

export const eqU = (it: Equipo): number => it.und === 'u' ? it.qty : it.und === 'glb' ? 1 : 0;

export const COMPN: Record<string, string> = {
  civil: 'Civil',
  tuberias: 'Tuberías',
  mecanico: 'Mecánico',
  electrico: 'Eléctrico',
  'i&c': 'I&C'
};

export const compLab = (c: string): string => {
  if (!c) return '(sin tipo)';
  const t = c.replace(/^\s*\d+\s*\.\s*/, '').trim();
  return COMPN[t.toLowerCase()] || t;
};

/* ------------------- Reglas Agua ------------------- */
export const P1 = '01.Pretratamiento & Clarif.';
export const P2 = '02.Area Norte & Lodos';
export const P3 = '03.Canal 16';
export const P4 = '04.Area O&M';
export const P5 = '05.Progreso';
export const P7 = '07.Guayacanes';

export const AGUA: AguaSection[] = [
  {
    g: 'Afluente e ingreso',
    d: 'Bombeo y conducción del agua cruda hasta la planta. Los medidores electromagnéticos van en línea: sin ellos la tubería de ingreso queda abierta.',
    on: true,
    c: [
      [P5, 'EB Afluente'],
      [P5, 'Nueva Estructura De Ingreso y Colector Afluente'],
      [P5, 'Trabajos De Afluente y Bypass'],
      [P3, 'Canal 16'],
      [P3, 'Control De Caudales A Proceso Lagunas'],
      [P1, 'Estacion de Bombeo del Afluente'],
      [P1, 'Tub.Patio Impulsion_EB Ingreso_Afluente'],
      [P1, 'Tub.Patio Afluente_Progreso Ingreso_Afluente'],
      [P1, 'Tub.Patio Garzota Ingreso_Afluente'],
      [P1, 'Tub.Patio Mucho_Lote Ingreso_Afluente'],
      [P1, 'Tub.Patio Vergeles Ingreso_Afluente'],
      [P1, 'Tub.Patio Impulsion_EB Guayacanes']
    ]
  },
  {
    g: 'Pretratamiento',
    d: 'Retención de sólidos gruesos, finos y arenas antes de los tanques; compuertas para aislar canales.',
    on: true,
    c: [
      [P1, 'Estructura De Entrada - Pretratamiento'],
      [P1, 'Cribado - Rejillas'],
      [P1, 'Desarenadores y Control Hidraulico'],
      [P1, 'Clasificador De Arenas']
    ]
  },
  {
    g: 'Tratamiento primario',
    d: 'Floculación, cámara de distribución (CADICAS) y clarificación primaria: el agua no pasa sin sus compuertas, agitadores y barredores.',
    on: true,
    c: [
      [P1, 'Tanques De Floculacion'],
      [P1, 'CADICAS'],
      [P1, 'Tanques De Clarificacion Primaria']
    ]
  },
  {
    g: 'Energía',
    d: 'Acometidas de 69 kV, transformadores, celdas, tableros y CCM que alimentan las estructuras anteriores.',
    on: true,
    c: [
      [P5, 'Acometida y Subestacion Electrica 69 Kv'],
      [P2, 'Subestacion Principal 69Kv y Transformadores'],
      [P2, 'Sistema De Distribucion En Media y Baja Tension']
    ]
  },
  {
    g: 'Opcionales',
    d: 'Fuera de la selección por defecto: hacen falta para la operación continua, la dosificación química o el control remoto, pero no para que el agua ingrese.',
    on: false,
    c: [
      [P1, 'Tanque De Almacenamiento De Agua De Servicio'],
      [P4, 'E.B Cloruro Ferrico'],
      [P1, 'Edificio De Polimeros-CCM2'],
      [P1, 'Edificio De Sopladores-CCM3'],
      [P4, 'Edificio de Hipoclorito de Sodio, SubE N2-CCM4'],
      [P1, 'Control de Olores y CCM'],
      [P4, 'Centro De Control'],
      [P4, 'Instrumentacion y Control'],
      [P5, 'Centro De Control'],
      [P5, 'Instrumentacion y Seguridad'],
      [P5, 'Tanque De Almacenamiento De Combustible'],
      [P7, 'Linea De Impulsion Guayacanes y Repotenciacion Ebar Guayacanes']
    ]
  }
];

export const akey = (p: string, c: string): string => `${String(p).trim()}¦${String(c).trim()}`.toLowerCase();

export const AORDER = new Map<string, number>();
export const ATRAMO = new Map<string, string>();

AGUA.forEach((G, gi) => {
  G.c.forEach(([p, c], ci) => {
    AORDER.set(akey(p, c), gi * 100 + ci);
    ATRAMO.set(akey(p, c), G.g);
  });
});

export const ADEF = (): Set<string> => {
  const set = new Set<string>();
  AGUA.filter(G => G.on).forEach(G => {
    G.c.forEach(([p, c]) => set.add(akey(p, c)));
  });
  return set;
};

export const DIST = akey(P2, 'Sistema De Distribucion En Media y Baja Tension');
export const SLUDGE_EL = /\b(?:CCM|Mcc)\s*-?\s*(?:8|8A|8B|12|13)\b|\bPD-(?:GAS|FoG|UTB)\b|CCM13/i;

export function sludgeElec(it: Equipo): boolean {
  return akey(it.proc, it.cap) === DIST && SLUDGE_EL.test(it.desc || '');
}

export const VALV_RE = /v[aá]lvula/i;

export const isValvulaScap = (scap: string | null | undefined): boolean => {
  if (!scap) return false;
  return VALV_RE.test(String(scap));
};

/* ------------------- (new v32) Válvulas sin desglose .p6 ------------------- */
export function buildValves(raw: RawSnapshot, items: Map<string, Equipo>) {
  const par = new Map<string, { r: any[]; q: number; ex: number; v: number; vx: number; n: number; sub: Map<string, number> }>();
  const T = (v: any) => v == null ? '' : String(v).trim();

  for (const r of raw.m) {
    if (r[14] === 'VP') {
      par.set(T(r[0]), { r, q: 0, ex: 0, v: 0, vx: 0, n: 0, sub: new Map() });
    }
  }

  for (const r of raw.m) {
    if (r[14] !== 'V') continue;
    const P = par.get(T(r[23]));
    if (!P) continue;
    if (T(r[2]).toLowerCase() !== 'u') continue;
    const q = isN(r[3]) ? r[3] : 0;
    if (!(q > 0)) continue;
    const st = r[7] && r[7] !== 'p6' ? T(r[7]) : null;
    let ex = isN(r[16]) ? r[16] : (isN(r[15]) ? r[15] * q : 0);
    if (st === 'Completed' || ex > q) ex = q;
    P.q += q;
    P.ex += ex;
    P.v += isN(r[4]) ? r[4] : 0;
    P.vx += isN(r[17]) ? r[17] : 0;
    P.n++;
    const sc = T(r[5]) || '(sin proveedor)';
    P.sub.set(sc, (P.sub.get(sc) || 0) + q);
  }

  for (const [pid, P] of par) {
    const r = P.r;
    let [id, name, und, qty, venta, subc, contrato, p6m, ubic, proc, cap, scap, unit, obs, gr, pex, cex, vex, ms, mf, mbl, mtf, comp] = r;
    const status = p6m && p6m !== 'p6' ? T(p6m) : null;
    const q = isN(qty) && qty > 0 ? qty : P.q;
    let ex = isN(cex) ? cex : P.ex;
    if (ex > q) ex = q;
    const done = status === 'Completed' || (q > 0 && ex >= q * 0.999);
    const S: Stage = {
      id: pid,
      name,
      qty: q,
      venta: isN(venta) && venta > 0 ? venta : P.v,
      vex: isN(vex) && vex > 0 ? vex : P.vx,
      pex: isN(pex) ? pex : null,
      ex,
      done,
      status,
      subc: '',
      start: ms || null,
      startA: status === 'Completed' || status === 'In Progress',
      fin: mf || null,
      finA: status === 'Completed',
      blf: mbl || null,
      tf: isN(mtf) ? mtf : null
    };
    const subs = [...P.sub.entries()].sort((a, b) => b[1] - a[1]);
    const it: Equipo = {
      base: pid,
      s: { D: { ...S }, E: { ...S }, F: { ...S } },
      valv: pid,
      nv: P.n,
      proc: T(proc) || '(sin proceso)',
      cap: T(cap) || '(sin CAP)',
      ubic: T(ubic),
      scap: T(scap),
      fam: T(scap) || 'Valvulas',
      und: 'u',
      qty: q,
      contrato: T(contrato),
      comp: T(comp),
      pend: false,
      desc: String(name || '').replace(/^\s*suministro\s+e\s+instalaci[oó]n\s+de\s+/i, '').trim() || String(name || ''),
      prov: T(subc) || (subs.length ? subs[0][0] : '(sin proveedor)'),
      inst: '',
      provs: subs.map(([k, v]) => `${k} ${fq(v)}`).join(' · ')
    };
    items.set(it.base, it);
  }
}

/* ------------------- Construcción Modelo ------------------- */
export function build(raw: RawSnapshot): Equipo[] {
  const items = new Map<string, Equipo>();

  for (const r of raw.m) {
    if (r[14] === 'V' || r[14] === 'VP') continue;
    let [id, name, und, qty, venta, subc, contrato, p6m, ubic, proc, cap, scap, unit, obs, gr, pex, cex, vex, ms, mf, mbl, mtf, comp] = r;
    comp = comp == null ? '' : String(comp).trim();
    const T = (v: any) => v == null ? '' : String(v).trim();
    const [undS, subcS, procS, capS, scapS, unitS, ubicS, contratoS] = [und, subc, proc, cap, scap, unit, ubic, contrato].map(T);

    const m = String(id).match(/^(.*)\.([DEF])$/i);
    if (!m) continue;

    const st = (GRMAP[String(gr).slice(0, 2)] || m[2].toUpperCase()) as StageKey;
    const base = m[1];

    let it = items.get(base);
    if (!it) {
      it = {
        base,
        s: {} as Record<StageKey, Stage>,
        proc: procS || '(sin proceso)',
        cap: capS || '(sin CAP)',
        ubic: ubicS || '',
        scap: scapS || '',
        fam: unitS || scapS || '(sin tipo)',
        und: undS || '',
        qty: isN(qty) ? qty : 0,
        contrato: contratoS || '',
        comp: comp || '',
        desc: '',
        prov: '',
        inst: '',
        pend: /^p\d+\.D(\.|$)/i.test(String(obs || ''))
      };
      items.set(base, it);
    }

    const status = p6m && p6m !== 'p6' ? String(p6m).trim() : null;
    const q = isN(qty) ? qty : 0;
    const pexN = isN(pex) ? pex : null;
    const ex = isN(cex) ? cex : (pexN !== null ? pexN * q : 0);
    const done = status === 'Completed' || (pexN !== null && pexN >= 0.999) || (q > 0 && ex >= q * 0.999);

    it.s[st] = {
      id: String(id).trim(),
      name: String(name || ''),
      qty: q,
      venta: isN(venta) ? venta : 0,
      vex: isN(vex) ? vex : 0,
      pex: pexN,
      ex,
      done,
      status,
      subc: subcS || '',
      start: ms || null,
      startA: status === 'Completed' || status === 'In Progress',
      fin: mf || null,
      finA: status === 'Completed',
      blf: mbl || null,
      tf: isN(mtf) ? mtf : null
    };

    if (st === 'D' && comp) {
      it.comp = comp;
    } else if (!it.comp && comp) {
      it.comp = comp;
    }

    if (st === 'D') {
      it.qty = q;
      it.und = undS || it.und;
      it.desc = String(name || '').replace(/^\s*compra\s+y\s+fabricaci[oó]n\s+(de\s+)?/i, '').trim();
      it.scap = scapS || it.scap;
      it.fam = unitS || scapS || it.fam;
      it.cap = capS || it.cap;
      it.proc = procS || it.proc;
    }
  }

  for (const it of items.values()) {
    for (const k of STG) {
      if (!it.s[k]) {
        it.s[k] = {
          id: `${it.base}.${k}`,
          name: '',
          ex: 0,
          qty: it.qty,
          venta: 0,
          vex: 0,
          pex: 0,
          done: false,
          status: null,
          subc: '',
          start: null,
          startA: false,
          fin: null,
          finA: false,
          blf: null,
          tf: null,
          missing: true
        };
      }
    }

    if (!it.desc) {
      const any = it.s.F?.name || it.s.E?.name || '';
      it.desc = String(any).replace(/^\s*(?:flete\s+de\s+equipo\s+a\s+obra\s+de\s+|instalaci[oó]n\s+y\s+pruebas?\s+de\s+)/i, '').trim();
    }
    it.prov = it.s.D?.subc || it.s.E?.subc || it.s.F?.subc || '(sin proveedor)';
    it.inst = it.s.F?.subc && it.s.F?.subc !== it.prov ? it.s.F.subc : '';
    if (!it.und) it.und = 'u';
  }

  buildValves(raw, items);
  return [...items.values()].sort((a, b) => natCmp(a.base, b.base));
}

/* ------------------- Agregación ------------------- */
export function agg(list: Equipo[]): Agg {
  const a: Agg = {
    n: list.length,
    q: {},
    st: {
      D: { v: 0, vx: 0, ex: {}, dn: {}, pv: null },
      E: { v: 0, vx: 0, ex: {}, dn: {}, pv: null },
      F: { v: 0, vx: 0, ex: {}, dn: {}, pv: null }
    },
    tf: null,
    fin: null,
    blf: null,
    maxLate: null,
    units: []
  };

  for (const it of list) {
    const u = it.und;
    a.q[u] = (a.q[u] || 0) + it.qty;

    for (const k of STG) {
      const s = it.s[k];
      const A = a.st[k];
      A.v += s.venta;
      A.vx += s.vex;
      A.ex[u] = (A.ex[u] || 0) + (s.ex || 0);
      A.dn[u] = (A.dn[u] || 0) + (s.done ? it.qty : 0);

      if (!s.done && isN(s.tf) && s.tf < 400) {
        a.tf = a.tf === null ? s.tf : Math.min(a.tf, s.tf);
      }
    }

    const F = it.s.F;
    if (F.fin && (!a.fin || F.fin > a.fin)) a.fin = F.fin;
    if (F.blf && (!a.blf || F.blf > a.blf)) a.blf = F.blf;

    if (!F.done) {
      const d = dd(F.fin, F.blf);
      if (d !== null) {
        a.maxLate = a.maxLate === null ? d : Math.max(a.maxLate, d);
      }
    }
  }

  a.units = Object.keys(a.q).sort((x, y) => (y === 'u' ? 1 : 0) - (x === 'u' ? 1 : 0) || a.q[y] - a.q[x]);

  for (const k of STG) {
    const A = a.st[k];
    A.pv = A.v > 0 ? A.vx / A.v : null;
  }

  return a;
}

export function fracs(a: Agg, mode: 'ex' | 'done' | 'open'): Record<StageKey, number> {
  const u = a.units[0];
  const Q = a.q[u] || 0;
  const r: Record<StageKey, number> = { D: 0, E: 0, F: 0 };
  for (const k of STG) {
    const e = mode === 'done' ? a.st[k].dn[u] : a.st[k].ex[u];
    r[k] = Q > 0 ? (e || 0) / Q : (a.st[k].pv ?? 0);
  }
  return r;
}

export function stateOf(a: Agg, mode: 'ex' | 'done' | 'open'): [string, string, string] {
  const f = fracs(a, mode);
  if (f.F >= 0.999) return ['st-F', 'text-[#2B7F52] bg-[#DCEFE3] border-transparent', 'Instalado'];
  if (f.F > 0) return ['st-F', 'text-[#2B7F52] bg-[#DCEFE3] border-transparent', 'En instalación'];
  if (f.E >= 0.999) return ['st-E', 'text-[#2C67A6] bg-[#DDE8F4] border-transparent', 'En obra'];
  if (f.E > 0) return ['st-E', 'text-[#2C67A6] bg-[#DDE8F4] border-transparent', 'Flete en curso'];
  if (f.D >= 0.999) return ['st-D', 'text-[#A86B12] bg-[#F6E9D3] border-transparent', 'Fabricado'];
  if (f.D > 0) return ['st-D', 'text-[#A86B12] bg-[#F6E9D3] border-transparent', 'En fabricación'];
  return ['st-0', 'text-slate-500 bg-slate-100 border-slate-200', 'Sin iniciar'];
}

export function sentence(a: Agg, label: string, mode: 'ex' | 'done' | 'open'): string {
  const parts = a.units.map(u => {
    const Q = fq(a.q[u]);
    const e = (k: StageKey) => fq((mode === 'done' ? a.st[k].dn[u] : a.st[k].ex[u]) || 0);
    return `${e('D')} ${VERB.D}, ${e('E')} ${VERB.E} y ${e('F')} ${VERB.F} de un total de ${Q} ${u}`;
  });
  return `${label}: ${parts.join('; ')}.`;
}

/* ------------------- Lector Excel Master ------------------- */
function sIso(v: any): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const m = String(v).match(/(\d{2})-(\d{2})-(\d{2,4})/);
  if (!m) return null;
  const y = m[3].length === 2 ? '20' + m[3] : m[3];
  return `${y}-${m[2]}-${m[1]}`;
}

function cellV(ws: XLSX.WorkSheet, r: number, c: number): any {
  const x = ws[XLSX.utils.encode_cell({ r, c })];
  return x ? x.v : null;
}

function findHdr(ws: XLSX.WorkSheet, names: string[], maxR = 8) {
  if (!ws['!ref']) return null;
  const rg = XLSX.utils.decode_range(ws['!ref']);
  for (let r = rg.s.r; r <= Math.min(rg.e.r, rg.s.r + maxR); r++) {
    const map: Record<string, number> = {};
    for (let c = rg.s.c; c <= rg.e.c; c++) {
      const v = cellV(ws, r, c);
      if (v != null) map[String(v).trim()] = c;
    }
    if (names.every(n => n in map)) return { r, map, rg };
  }
  return null;
}

export async function readMaster(file: File): Promise<{ rows: any[][]; wk: string | null; name: string }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, {
    type: 'array',
    sheets: ['cdo', 'CDO'],
    cellFormula: false,
    cellHTML: false,
    cellText: false,
    cellStyles: false
  });
  const ws = wb.Sheets.cdo || wb.Sheets.CDO || wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('No se encontró la pestaña cdo en el archivo.');

  const need = [
    'Activity ID', 'Activity Name', 'Unidad', 'Cantidad', 'Venta', 'SubC', 'Contrato', 'p6',
    'Ubicacion', 'Proceso', 'CAP', 'SCAP', 'Unit', 'Obs', 'Grupos', '% Ex', 'Cantidad Ex',
    'Venta Ex', 'Start', 'Finish', 'blFinish', 'Float', 'Componente'
  ];

  const h = findHdr(ws, need);
  if (!h) {
    throw new Error('En 2. Master no encontré la pestaña cdo con las columnas requeridas.');
  }

  const C = need.map(n => h.map[n]);
  const gi = h.map['Grupos'];
  const wi = h.map['WBS'];

  const vcols = Object.entries(h.map)
    .filter(([k]) => /^V-/.test(k))
    .map(([k, c]) => [k, c] as [string, number])
    .sort((a, b) => a[1] - b[1])
    .slice(-12);
  const vs = vcols.map(() => 0);

  const rows: any[][] = [];
  for (let r = h.r + 1; r <= h.rg.e.r; r++) {
    vcols.forEach(([_, c], i) => {
      const v = cellV(ws, r, c);
      if (typeof v === 'number') vs[i] += Math.abs(v);
    });

    const aid = String(cellV(ws, r, C[0]) ?? '').trim();
    const wbs = wi == null ? '' : String(cellV(ws, r, wi) ?? '').trim();
    const g = cellV(ws, r, gi);
    let gk: string | null = null;

    /* (new v31-v32) válvulas: filas .p6 con SCAP Válvulas (VP) y sus partidas, enlazadas por la columna WBS (V) */
    if (VALV_RE.test(String(cellV(ws, r, C[11]) ?? '')) && !/^0[1234]\./.test(String(g || ''))) {
      if (/\.p6$/.test(aid)) gk = 'VP';
      else if (/\.p6$/.test(wbs)) gk = 'V';
      else continue;
    } else {
      if (!/^0[234]\./.test(String(g || ''))) continue;
      if (!/(Procura_Eq|Flete_Eq|Precom_Eq)/.test(String(g || ''))) continue;
      gk = String(g).slice(0, 2);
    }

    const v = C.map(c => cellV(ws, r, c));
    const num = (x: any) => typeof x === 'number' ? x : null;

    const row: any[] = [
      String(v[0] || '').trim(),
      v[1],
      v[2],
      num(v[3]),
      num(v[4]),
      v[5],
      v[6],
      v[7],
      v[8],
      v[9],
      v[10],
      v[11],
      v[12],
      v[13],
      gk,
      typeof v[15] === 'number' ? v[15] : (v[15] != null ? String(v[15]) : null),
      num(v[16]),
      num(v[17]),
      sIso(v[18]),
      sIso(v[19]),
      sIso(v[20]),
      num(v[21]),
      v[22] == null ? null : String(v[22]).trim()
    ];
    if (gk === 'V') row.push(wbs);
    rows.push(row);
  }

  if (!rows.length) {
    throw new Error('El Master no tiene partidas en 02.Procura_Eq., 03.Flete_Eq. o 04.Precom_Eq. en la columna Grupos.');
  }

  let wk: string | null = null;
  vcols.forEach(([k], i) => {
    if (vs[i] > 1000) wk = k.slice(2);
  });

  return { rows, wk, name: file.name };
}
