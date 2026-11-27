/**
 * Comparación Master (CDO) vs Planilla (hoja Sabana), partida por partida.
 *
 * Sigue el criterio de la hoja "e.14" del Excel: se cruza el id.orig del Master (Col B del CDO)
 * con la Partida de la Planilla (Col H de la Sabana) y se comparan Cantidad, Precio y Monto.
 * Además se compara el avance: planillado acumulado (Sabana) contra ejecutado en el Master.
 */
import type { MasterCdoItem } from '../types/masterCdo';
import type { PlanillaItem } from '../types';
import { stepDeFila, ventaDeFila } from './masterCdoHierarchy';

/** Cómo quedó cruzada la partida. */
export type Cruce = 'ambos' | 'soloMaster' | 'soloPlanilla' | 'capitulo';

/** Qué se compara: presupuesto (Contrato vs Master) o avance (Planillado vs Ejecutado). */
export type ModoComparacion = 'presupuesto' | 'avance';

export interface CvsMasterRef {
  id: string;
  activityId: string;
  wbs: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precio: number;
  step: number;
  venta: number;
  cantEjec: number;
  ventaEjec: number;
  /** Parte de la fila asignada a esta hoja de la Planilla (1 = toda). */
  peso: number;
}

export interface CvsPlanillaRef {
  cod: string;
  partida: string;
  cantidad: number;
  tarifa: number;
  monto: number;
  cantPlan: number;
  montoPlan: number;
}

export interface CvsLeaf {
  key: string;
  /** Código de planeamiento (Sabana) o WBS del Master si la partida no está en la Planilla. */
  cod: string;
  /** Grupo del árbol donde va la fila ('' = raíz). */
  grupo: string;
  partida: string;
  desc: string;
  unidad: string;
  tipo: string;
  cruce: Cruce;
  /** Tarifa del contrato (0 si la partida no está en la Planilla). */
  tarifa: number;
  /** Precio unitario del Master (0 si no hay filas del Master). */
  precioM: number;
  /** Contrato: cantidad y monto. */
  qC: number; vC: number;
  /** Planillado acumulado: cantidad y monto. */
  qP: number; vP: number;
  /** Master: cantidad equivalente (Σ cantidad × step) y venta (Col I). */
  qM: number; vM: number;
  /** Ejecutado en el Master: cantidad equivalente y monto. */
  qE: number; vE: number;
  master: CvsMasterRef[];
  planilla: CvsPlanillaRef[];
  /** Código parecido del otro lado (posible error de digitación). */
  sugerencia?: string;
  /** Unidad distinta en contrato y Master: no se puede separar cantidad y precio. */
  unidadDistinta?: boolean;
  /** El id.orig del Master coincidió con el código de planeamiento (no con la partida). */
  porCodigoPlan?: boolean;
  /** Códigos de planeamiento de la Sabana unidos en esta fila (partida repetida con Reajuste C1). */
  codsUnidos?: string[];
  /** CAP de la fila de la Sabana (Col E). */
  capSabana?: string;
  /** Fila del Master de una estructura (CAP) que no está en la Sabana para esta partida. */
  capNoPlanilla?: string;
}

export interface CvsResultado {
  leaves: CvsLeaf[];
  /** Descripción de cada código de planeamiento (grupos del árbol). */
  groupDesc: Record<string, string>;
  /** Filas del Master con importe pero sin id.orig (no se pueden cruzar). */
  sinIdOrig: { filas: number; venta: number; ejec: number };
}

export interface CvsDeltas {
  qA: number; vA: number; qB: number; vB: number;
  dQ: number; dV: number;
  /** Parte de la diferencia que viene de la cantidad: ΔQ × tarifa. */
  porCantidad: number;
  /** Resto de la diferencia: viene del precio. */
  porPrecio: number;
  /** false si las unidades no coinciden (la diferencia no se puede separar). */
  separable: boolean;
}

/** Traducciones fijas de códigos del CDO a la Planilla. */
const TRADUCCION_CODIGOS: Record<string, string> = { '12.8.1': '13.1' };

export const traducirCodigo = (code: string): string => {
  const c = code.trim();
  return TRADUCCION_CODIGOS[c] || c;
};

const esNumerico = (id: string) => {
  const n = id.trim().toLowerCase();
  return n !== '' && /^[0-9.]*$/.test(n);
};

const capituloMayor = (code: string) => code.trim().split('.')[0] || '';

/** WBS del Master sin el prefijo del proyecto ("p0926." o "p."). */
export const wbsSinProyecto = (w: string) => String(w || '').trim().replace(/^p\d*\./i, '');

const normalizar = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Diferencias entre los dos lados según el modo. */
export function calcularDeltas(l: CvsLeaf, modo: ModoComparacion): CvsDeltas {
  const qA = modo === 'presupuesto' ? l.qC : l.qP;
  const vA = modo === 'presupuesto' ? l.vC : l.vP;
  const qB = modo === 'presupuesto' ? l.qM : l.qE;
  const vB = modo === 'presupuesto' ? l.vM : l.vE;
  const dQ = qB - qA;
  const dV = vB - vA;
  if (l.unidadDistinta) return { qA, vA, qB, vB, dQ, dV, porCantidad: 0, porPrecio: 0, separable: false };
  const t = l.tarifa || l.precioM;
  const porCantidad = t ? dQ * t : dV;
  return { qA, vA, qB, vB, dQ, dV, porCantidad, porPrecio: dV - porCantidad, separable: true };
}

const UNIDADES: Record<string, string> = {
  u: 'u', und: 'u', un: 'u', unid: 'u', unidad: 'u', unidades: 'u', pza: 'u', pieza: 'u',
  gl: 'glb', glb: 'glb', global: 'glb',
  m: 'm', ml: 'm', mts: 'm', metro: 'm',
  kg: 'kg', kgs: 'kg', t: 'ton', ton: 'ton', tn: 'ton',
};
/** Unidad normalizada ("Und", "u", "U." → "u"). */
export const normalizarUnidad = (u: string) => {
  const k = String(u || '').toLowerCase().replace(/[\s.]/g, '').replace('³', '3').replace('²', '2');
  return UNIDADES[k] || k;
};

/** Diferencias menores a 1 son redondeo. */
export const TOLERANCIA = 1;

export type Estado = 'ok' | 'dif' | Exclude<Cruce, 'ambos'>;

export function estadoDe(l: CvsLeaf, modo: ModoComparacion): Estado {
  if (l.cruce !== 'ambos') return l.cruce;
  return Math.abs(calcularDeltas(l, modo).dV) <= TOLERANCIA ? 'ok' : 'dif';
}

export const ESTADO_LABEL: Record<Estado, string> = {
  ok: 'OK',
  dif: 'Diferencia',
  soloMaster: 'Solo Master',
  soloPlanilla: 'Solo Planilla',
  capitulo: 'Otro capítulo',
};

/** ¿La Planilla trae los datos necesarios? (se agregaron al cargar el Excel desde esta versión) */
export const planillaTieneCruce = (hojas: PlanillaItem[]) => hojas.some(h => !!h.partida);

/** Capítulo (primer segmento numérico) de una fila del Master. */
function capituloDeItem(it: MasterCdoItem): string {
  for (const w of [it.wbs, it.wbsRaw]) {
    const s = wbsSinProyecto(w || '');
    if (/^\d/.test(s)) return capituloMayor(s);
  }
  return '';
}

/** Código del árbol para una partida que solo existe en el Master: su WBS sin prefijo. */
function codDeItem(it: MasterCdoItem): string {
  for (const w of [it.wbs, it.wbsRaw]) {
    const s = wbsSinProyecto(w || '');
    if (s && !/p6$/i.test(s)) return s;
  }
  return 'Sin WBS';
}

export function construirComparacion(
  items: MasterCdoItem[],
  hojas: PlanillaItem[],
  gruposPlanilla: PlanillaItem[]
): CvsResultado {
  // Códigos que en la Sabana son grupos (filas sin tarifa). Una hoja cuyo código no es grupo
  // va junto a sus hermanas, en el grupo padre (no crea una carpeta propia).
  const gruposSabana = new Set(gruposPlanilla.map(g => String(g.cod || '').trim()).filter(Boolean));
  const padre = (cod: string) => cod.split('.').slice(0, -1).join('.');
  const grupoDeHoja = (cod: string) => (gruposSabana.has(cod) ? cod : padre(cod));

  // ── Planilla: hojas con partida ──
  const leaves: CvsLeaf[] = [];
  const porPartida = new Map<string, CvsLeaf[]>();
  const porCodPlan = new Map<string, CvsLeaf[]>();
  for (const h of hojas) {
    const partida = String(h.partida || '').trim();
    const cod = String(h.cod || '').trim();
    if (!partida || !cod || !(h.tarifa > 0)) continue;
    const leaf: CvsLeaf = {
      key: `s:${h.id}`,
      cod,
      grupo: grupoDeHoja(cod),
      partida,
      desc: h.desc || '',
      unidad: h.unidad || '',
      tipo: '',
      cruce: 'soloPlanilla',
      tarifa: h.tarifa || 0,
      precioM: 0,
      qC: h.qContrato || 0, vC: h.contrato || 0,
      qP: h.qAcum || 0, vP: h.acum || 0,
      qM: 0, vM: 0, qE: 0, vE: 0,
      master: [],
      planilla: [{ cod, partida, cantidad: h.qContrato || 0, tarifa: h.tarifa || 0, monto: h.contrato || 0, cantPlan: h.qAcum || 0, montoPlan: h.acum || 0 }],
      capSabana: String(h.cap || '').trim(),
    };
    leaves.push(leaf);
    const k = partida.toLowerCase();
    if (!porPartida.has(k)) porPartida.set(k, []);
    porPartida.get(k)!.push(leaf);
    const kc = cod.toLowerCase();
    if (kc !== k) {
      if (!porCodPlan.has(kc)) porCodPlan.set(kc, []);
      porCodPlan.get(kc)!.push(leaf);
    }
  }

  // ── Master: una actividad P6 vale la suma de sus partidas; su propia fila no tiene id.orig ──
  const virtuales = new Map<string, CvsLeaf>();
  const tipoPorPartida = new Map<string, string>();
  const sinIdOrig = { filas: 0, venta: 0, ejec: 0 };
  // La fila de una actividad P6 suma sus partidas: solo se usan las partidas.
  const actividadesP6 = new Set(
    items.map(i => String(i.parentActivityId || '').trim().toLowerCase()).filter(Boolean)
  );

  const sumar = (leaf: CvsLeaf, it: MasterCdoItem, ref: Omit<CvsMasterRef, 'peso'>, peso: number) => {
    leaf.qM += ref.cantidad * ref.step * peso;
    leaf.vM += ref.venta * peso;
    leaf.qE += ref.cantEjec * ref.step * peso;
    leaf.vE += ref.ventaEjec * peso;
    if (!leaf.precioM && ref.precio > 0) leaf.precioM = ref.precio;
    if (!leaf.tipo && it.tipo) leaf.tipo = it.tipo;
    leaf.master.push({ ...ref, peso });
  };

  for (const it of items) {
    if (!it.parentActivityId && actividadesP6.has(String(it.activityId || '').trim().toLowerCase())) continue;
    const venta = ventaDeFila(it);
    const ventaEjec = Object.values(it.ventasSemanales || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    const cantEjec = Object.values(it.cantidadesSemanales || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    const cantidad = Number(it.cantidadPresupuesto) || 0;
    if (!venta && !ventaEjec && !cantidad) continue;

    const idOrig = String(it.idOrig || '').trim();
    if (!idOrig) {
      sinIdOrig.filas++;
      sinIdOrig.venta += venta;
      sinIdOrig.ejec += ventaEjec;
      continue;
    }

    const ref = {
      id: it.id,
      activityId: it.activityId || '',
      wbs: it.wbs || '',
      descripcion: it.descripcion || '',
      unidad: it.unidad || '',
      cantidad,
      precio: Number(it.precio) || 0,
      step: stepDeFila(it.step),
      venta,
      cantEjec,
      ventaEjec,
    };

    const partida = traducirCodigo(idOrig);
    const k = partida.toLowerCase();
    if (it.tipo && !tipoPorPartida.has(k)) tipoPorPartida.set(k, it.tipo);

    let todas = porPartida.get(k) || [];
    let porCodigo = false;
    if (todas.length === 0 && porCodPlan.has(k)) {
      // El Master usó el código de planeamiento de la Sabana en vez de la partida.
      todas = porCodPlan.get(k)!;
      porCodigo = true;
    }
    let candidatas = todas;
    let cruce: Cruce = 'soloMaster';
    // Partidas numéricas: deben estar en el mismo capítulo de la Planilla.
    if (esNumerico(idOrig) && todas.length > 0) {
      const cap = capituloDeItem(it);
      if (cap) {
        candidatas = todas.filter(l => capituloMayor(l.cod) === cap);
        if (candidatas.length === 0) cruce = 'capitulo';
      }
    }

    if (candidatas.length === 0) {
      const cod = codDeItem(it);
      const vk = `m:${cod}::${k}`;
      let v = virtuales.get(vk);
      if (!v) {
        v = {
          key: vk, cod, grupo: cod, partida, desc: it.descripcion || '', unidad: it.unidad || '', tipo: '',
          cruce, tarifa: 0, precioM: 0,
          qC: 0, vC: 0, qP: 0, vP: 0, qM: 0, vM: 0, qE: 0, vE: 0,
          master: [], planilla: [],
        };
        if (cruce === 'capitulo') {
          v.planilla = todas.flatMap(l => l.planilla);
          v.tarifa = todas[0]?.tarifa || 0;
        }
        virtuales.set(vk, v);
      }
      sumar(v, it, ref, 1);
      continue;
    }

    // Cada fila del Master va completa a UNA fila de la Sabana: la de su misma estructura.
    // Nunca se reparte en porcentajes. Criterios, en orden:
    //   1) Activity ID igual al código de planeamiento
    //   2) mismo CAP (Col E de la Sabana)
    //   3) código de planeamiento más parecido al WBS del Master (mín. 2 niveles; la cantidad desempata)
    //   4) misma cantidad: contrato del Master = contrato de la Sabana, o ejecutado = planillado
    // Si ninguno decide y hay una sola fila (precios nuevos), va a esa fila. Si no, va a una fila
    // propia "estructura no planillada" junto a la partida.
    let elegidas: CvsLeaf[] = [];
    {
      const act = ref.activityId.toLowerCase();
      if (act) elegidas = candidatas.filter(l => l.cod.toLowerCase() === act);
    }
    const capM = it.cap ? normalizar(it.cap) : '';
    // Varias filas del mismo CAP: se sigue decidiendo entre ellas por estructura y cantidad
    let pool = candidatas;
    if (!elegidas.length && capM) {
      const mismoCap = candidatas.filter(l => l.capSabana && normalizar(l.capSabana) === capM);
      if (mismoCap.length === 1) elegidas = mismoCap;
      else if (mismoCap.length > 1) pool = mismoCap;
    }
    const igual = (a: number, b: number) => a > 0 && b > 0 && Math.abs(a - b) <= Math.max(0.01, b * 0.002);
    const qCm = ref.cantidad * ref.step;
    const qEm = ref.cantEjec * ref.step;
    const porCantidad = (lista: CvsLeaf[]) => {
      const c = lista.filter(l => igual(l.qC, qCm));
      if (c.length === 1) return c;
      const e = lista.filter(l => igual(l.qP, qEm) || igual(l.qC, qEm));
      return e.length === 1 ? e : [];
    };
    // 3) Estructura: código de planeamiento con más niveles en común con el WBS del Master (mín. 2)
    if (!elegidas.length) {
      const w = codDeItem(it).toLowerCase().split('.');
      const comun = (c: string) => {
        const a = c.toLowerCase().split('.');
        let n = 0;
        while (n < a.length && n < w.length && a[n] === w[n]) n++;
        return n;
      };
      const max = pool.reduce((m, l) => Math.max(m, comun(l.cod)), 0);
      if (max >= 2) {
        elegidas = pool.filter(l => comun(l.cod) === max);
        if (elegidas.length > 1) {
          const q = porCantidad(elegidas);
          if (q.length) elegidas = q;
        }
      }
    }
    // 4) Cantidad igual, solo si la estructura no decidió
    if (!elegidas.length) elegidas = porCantidad(pool);
    if (!elegidas.length && pool !== candidatas) elegidas = pool; // mismo CAP: la de mayor contrato
    // Varias igual de buenas: la de mayor contrato (o planillado); nunca un reparto
    if (elegidas.length > 1) {
      elegidas = [elegidas.reduce((a, b) => ((b.vC || b.vP) > (a.vC || a.vP) ? b : a))];
    }
    // Precio nuevo (no numérico) con una sola fila en la Sabana: va a esa fila
    if (!elegidas.length && candidatas.length === 1 && !esNumerico(idOrig)) elegidas = candidatas;

    if (elegidas.length === 1) {
      if (porCodigo) elegidas[0].porCodigoPlan = true;
      sumar(elegidas[0], it, ref, 1);
      continue;
    }

    // Sin fila de su estructura en la Sabana: fila propia, junto a la partida
    {
      const base = candidatas[0];
      const etiqueta = String(it.cap || '').trim() || codDeItem(it);
      const vk = `c:${k}::${normalizar(etiqueta)}`;
      let v = virtuales.get(vk);
      if (!v) {
        v = {
          key: vk, cod: base.cod, grupo: base.grupo, partida, desc: it.descripcion || base.desc, unidad: it.unidad || base.unidad,
          tipo: '', cruce: 'soloMaster', tarifa: 0, precioM: 0,
          qC: 0, vC: 0, qP: 0, vP: 0, qM: 0, vM: 0, qE: 0, vE: 0,
          master: [], planilla: [], capNoPlanilla: etiqueta,
        };
        virtuales.set(vk, v);
      }
      sumar(v, it, ref, 1);
    }
  }

  for (const l of leaves) if (l.master.length > 0) l.cruce = 'ambos';
  leaves.push(...virtuales.values());

  for (const l of leaves) {
    if (!l.master.length || !l.planilla.length) continue;
    const uC = normalizarUnidad(l.unidad);
    l.unidadDistinta = l.master.some(m => {
      const uM = normalizarUnidad(m.unidad);
      return !!uC && !!uM && uM !== uC;
    });
  }

  // Tipo de las partidas sin filas del Master asignadas
  const tipoObraCivil = [...new Set(items.map(i => i.tipo || ''))].find(t => /^(\d+\.)?\s*obra civil$/i.test(t.trim())) || 'Obra Civil';
  for (const l of leaves) {
    if (l.tipo) continue;
    l.tipo = tipoPorPartida.get(l.partida.toLowerCase()) || '';
    if (!l.tipo && (/^(11|14)(\.|$)/.test(l.cod) || /^(11|14)(\.|$)/.test(l.partida))) l.tipo = tipoObraCivil;
  }

  // Sugerencias: código casi igual del otro lado (un segmento distinto, misma descripción)
  const comodines = (code: string) => {
    const segs = code.toLowerCase().split('.');
    return segs.length < 3 ? [] : segs.map((_, i) => segs.map((x, j) => (j === i ? '*' : x)).join('.'));
  };
  const indexar = (ls: CvsLeaf[]) => {
    const idx = new Map<string, CvsLeaf[]>();
    for (const l of ls) for (const k of comodines(l.partida)) {
      if (!idx.has(k)) idx.set(k, []);
      idx.get(k)!.push(l);
    }
    return idx;
  };
  const sugerir = (desde: CvsLeaf[], hacia: CvsLeaf[]) => {
    const idx = indexar(hacia);
    for (const a of desde) {
      const da = normalizar(a.desc).slice(0, 25);
      for (const k of comodines(a.partida)) {
        const b = (idx.get(k) || []).find(x => {
          if (x.partida.toLowerCase() === a.partida.toLowerCase()) return false;
          const db = normalizar(x.desc).slice(0, 25);
          return !da || !db || da === db;
        });
        if (b) { a.sugerencia = b.partida; break; }
      }
    }
  };
  const soloP = leaves.filter(l => l.cruce === 'soloPlanilla');
  const soloM = leaves.filter(l => l.cruce === 'soloMaster');
  sugerir(soloM, soloP);
  sugerir(soloP, soloM);

  // Descripciones de los grupos (códigos de planeamiento)
  const groupDesc: Record<string, string> = {};
  for (const g of gruposPlanilla) {
    const cod = String(g.cod || '').trim();
    if (cod && g.desc && !groupDesc[cod]) groupDesc[cod] = String(g.desc);
  }
  // Grupos que no están en la Sabana (p. ej. "A1" o "8.4.3.4"): nombre de su fila de grupo en el Master
  for (const it of items) {
    if (it.esItemHoja !== false || !it.descripcion) continue;
    const cod = wbsSinProyecto(it.wbs || it.wbsRaw || '');
    if (cod && !groupDesc[cod]) groupDesc[cod] = it.descripcion;
  }

  return { leaves, groupDesc, sinIdOrig };
}
