/**
 * Llegadas de equipos a obra → cronograma de T₃ (memoria «Llegadas de equipos a obra», sección 9).
 *
 * Cruce: la PARTIDA de la matriz (columna G) con el campo de usuario «32. Variacion» de las actividades de flete
 * (Activity ID terminado en «.E»), normalizando las dos llaves (mayúsculas, sin espacios; - . _ / equivalentes;
 * sin ceros a la izquierda en los tramos numéricos).
 *
 * Fuera del análisis: tuberías y tablestacas (paquete o descripción, regla 5.1 de la memoria) y válvulas
 * (paquete «VÁLVULAS…» en la matriz o SCAP «Valvulas» en T₃).
 *
 * Por partida: la llegada que manda es la ÚLTIMA AW (cuando la partida queda completa en obra) y su embarque
 * (AR); si hay varias .E con la misma llave se compara con el fin más tardío. Δ = fin de la .E en T₃ − AW
 * (días calendario; negativo = T₃ llega antes que la matriz). Cercana |Δ| ≤ 7 · Revisar 8–30 · Desfase > 30.
 *
 * Cambios que se proponen (decididos con el usuario el 25-nov-2026), solo si |Δ| > 7 y la .E no está terminada:
 *  - Procura .D en curso: Remaining Duration para que termine el día del embarque (AR), contado desde la fecha
 *    de datos en su calendario. Si el embarque ya pasó y la .D sigue en curso, solo se avisa (se cierra con Cut).
 *  - Flete .E sin iniciar: Original Duration = tiempo laborable desde el embarque (o la fecha de datos, si es
 *    posterior) hasta el fin del día de llegada (AW), en su calendario; así su fin cae en la AW.
 *  - Flete .E en curso: Remaining Duration = tiempo laborable desde la fecha de datos hasta el fin del día AW.
 *  - Mínimo 1 día de su calendario. Las .D sin iniciar no se tocan (se avisa: revisar su lógica).
 *  - Si la AW ya pasó (≤ fecha de datos) y la .E no está terminada: solo aviso para confirmar en obra.
 *  - Las .E terminadas no se tocan; si la matriz las da «Por llegar» o «Lejos de llegar», se marca la inconsistencia.
 */
import { celda } from './xer';
import type { ModeloP6 } from './modelo';
import { aMinutos } from './calendario';
import type { FilaMatriz, EstadoImportacion } from './matrizLlegadas';

export type ClaseDelta = 'Close' | 'Review' | 'Gap';
export type TipoLlegada = 'cambio' | 'cercana' | 'llegada' | 'completada';

export interface CambioLlegada {
  i: number;
  cod: string;
  campo: 'durOriginal' | 'durRestante';
  antesH: number;
  nuevoH: number;
  horasDia: number;
  nota: string;
}

export interface ActE {
  i: number;
  cod: string;
  nombre: string;
  estado: string;
  fin: string; // AAAA-MM-DD
  tfDias: number | null;
}

export interface FilaLlegada {
  tipo: TipoLlegada;
  clave: string;
  partida: string;
  /** Subcontratista del cronograma (campo de usuario «11.SubC» de la .E, o de su .D). */
  subc: string;
  paq: string;
  fab: string;
  eq: string;
  cat: EstadoImportacion;
  envios: number;
  awPrimera: string;
  aw: string;
  ar: string | null;
  acts: ActE[];
  finT3: string;
  delta: number;
  clase: ClaseDelta;
  cambios: CambioLlegada[];
  avisos: string[];
}

export interface SinPareja { lado: 'matrix' | 'T3'; clave: string; partida: string; detalle: string; aw: string | null; /** SubC del cronograma (solo lado T₃: la matriz sin .E no tiene actividad de la que tomarlo). */ subc: string }

export interface ResultadoLlegadas {
  filas: FilaLlegada[];
  sinPareja: SinPareja[];
  excluidas: { tuberias: number; valvulas: number; sinAw: number };
  fechaDatos: string;
}

export const normLlave = (k: unknown) => String(k ?? '').toUpperCase().replace(/\s+/g, '')
  .split(/[.\-_/]/).filter(Boolean).map(t => (/^\d+$/.test(t) ? String(parseInt(t, 10)) : t)).join('.');

const RE_TUB_PAQ = /^(TUBER[IÍ]A|TABLESTACA)/i;
const RE_TUB_EQ = /^(suministro[^,]*,?\s*(transporte e instalaci[oó]n )?de tuber[ií]as|tuber[ií]a\s|sum\.?\s*ins\.?\s*y\s*trans\.?\s*tuber|tablestaca)/i;
const RE_VALV = /V[AÁ]LVULA/i;
export const esTuberia = (r: FilaMatriz) => RE_TUB_PAQ.test(r.paq || '') || RE_TUB_EQ.test(r.eq || '');
export const esValvulaMatriz = (r: FilaMatriz) => RE_VALV.test(r.paq || '');

const dias = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);
const diaSiguiente = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
export const claseDe = (d: number): ClaseDelta => (Math.abs(d) <= 7 ? 'Close' : Math.abs(d) <= 30 ? 'Review' : 'Gap');

export function calcularLlegadas(m: ModeloP6, filasMatriz: FilaMatriz[]): ResultadoLlegadas {
  const t = m.task;
  const dd = new Date(m.fechaDatos * 60000).toISOString().slice(0, 16).replace('T', ' ');
  const ddDia = dd.slice(0, 10);

  // Campos de usuario «32. Variacion» y «07.SCAP» de cada actividad (por task_id)
  const tipos = m.xer.tablas.get('UDFTYPE'), valores = m.xer.tablas.get('UDFVALUE');
  const idTipo = (etq: string) => tipos?.filas.find(f => celda(tipos, f, 'table_name') === 'TASK' && celda(tipos, f, 'udf_type_label') === etq);
  const tVar = idTipo('32. Variacion'), tScap = idTipo('07.SCAP'), tSubc = idTipo('11.SubC');
  const variacion = new Map<string, string>(), scap = new Map<string, string>(), subcs = new Map<string, string>();
  const idVar = tVar ? celda(tipos!, tVar, 'udf_type_id') : null, idScap = tScap ? celda(tipos!, tScap, 'udf_type_id') : null;
  const idSubc = tSubc ? celda(tipos!, tSubc, 'udf_type_id') : null;
  for (const f of valores?.filas || []) {
    const tipo = celda(valores!, f, 'udf_type_id');
    const destino = tipo === idVar ? variacion : tipo === idScap ? scap : tipo === idSubc ? subcs : null;
    if (!destino) continue;
    destino.set(celda(valores!, f, 'fk_id'), celda(valores!, f, 'udf_text') || celda(valores!, f, 'udf_number'));
  }
  const subcDe = (i: number | undefined) => {
    if (i === undefined) return '';
    const v = String(subcs.get(celda(t, t.filas[i], 'task_id')) || '').trim();
    return v && v !== '0' ? v : '';
  };

  const porCod = new Map<string, number>();
  t.filas.forEach((f, i) => porCod.set(celda(t, f, 'task_code'), i));
  const horasDiaDe = (i: number) => m.calendarios.get(celda(t, t.filas[i], 'clndr_id'))?.horasDia || 8;
  const finDe = (i: number) => {
    const f = t.filas[i];
    return (celda(t, f, 'act_end_date') || celda(t, f, 'early_end_date') || celda(t, f, 'target_end_date')).slice(0, 10);
  };
  /** Horas laborables (calendario de la actividad) entre dos instantes «AAAA-MM-DD HH:MM». */
  const horas = (i: number, desde: string, hasta: string) => {
    const cal = m.calendarios.get(celda(t, t.filas[i], 'clndr_id'));
    const a = aMinutos(desde), b = aMinutos(hasta);
    if (!cal || a == null || b == null || b <= a) return 0;
    return cal.entre(a, b) / 60;
  };

  // Actividades de flete .E por llave (sin válvulas)
  const fletes = new Map<string, number[]>();
  t.filas.forEach((f, i) => {
    const cod = celda(t, f, 'task_code');
    if (!/\.E$/i.test(cod)) return;
    const id = celda(t, f, 'task_id');
    if (/valvul/i.test(scap.get(id) || '')) return;
    const k = normLlave(variacion.get(id));
    if (!k) return;
    if (!fletes.has(k)) fletes.set(k, []);
    fletes.get(k)!.push(i);
  });

  // Matriz: exclusiones y agrupación por partida
  let tuberias = 0, valvulas = 0, sinAw = 0;
  const porPartida = new Map<string, FilaMatriz[]>();
  for (const r of filasMatriz) {
    if (esTuberia(r)) { tuberias++; continue; }
    if (esValvulaMatriz(r)) { valvulas++; continue; }
    if (!r.aw) { sinAw++; continue; }
    const k = normLlave(r.p);
    if (!porPartida.has(k)) porPartida.set(k, []);
    porPartida.get(k)!.push(r);
  }

  const filas: FilaLlegada[] = [];
  const sinPareja: SinPareja[] = [];
  for (const [k, rs] of porPartida) {
    const idxs = fletes.get(k);
    const ult = rs.reduce((a, b) => (b.aw! > a.aw! ? b : a));
    const aw = ult.aw!, awPrimera = rs.reduce((a, b) => (b.aw! < a.aw! ? b : a)).aw!;
    // Embarque del último envío (si hay varias filas con esa AW, el más tardío)
    const ar = rs.filter(r => r.aw === aw && r.emb).map(r => r.emb!).sort().pop() || null;
    if (!idxs) { sinPareja.push({ lado: 'matrix', clave: k, partida: rs[0].p, detalle: `${rs[0].paq || ''} · ${rs[0].fab || ''}`, aw, subc: '' }); continue; }
    const acts: ActE[] = idxs.map(i => {
      const f = t.filas[i];
      const tf = celda(t, f, 'total_float_hr_cnt');
      return { i, cod: celda(t, f, 'task_code'), nombre: celda(t, f, 'task_name'), estado: celda(t, f, 'status_code'), fin: finDe(i), tfDias: tf === '' ? null : Number(tf) / horasDiaDe(i) };
    });
    const finT3 = acts.map(a => a.fin).sort().pop() || '';
    const delta = finT3 ? dias(finT3, aw) : 0;
    const clase = claseDe(delta);
    const subc = acts.map(a => subcDe(a.i)).find(Boolean) || acts.map(a => subcDe(porCod.get(a.cod.replace(/\.E$/i, '.D')))).find(Boolean) || '';
    const base = {
      clave: k, partida: ult.p, subc, paq: ult.paq || '', fab: ult.fab || '', eq: ult.eq || '', cat: ult.cat, envios: rs.length,
      awPrimera, aw, ar, acts, finT3, delta, clase, cambios: [] as CambioLlegada[], avisos: [] as string[],
    };
    const pendientes = acts.filter(a => a.estado !== 'TK_Complete');
    if (!pendientes.length) {
      if (ult.cat === 'por_zarpar' || ult.cat === 'lejos') base.avisos.push('Completed in T₃ but the matrix still shows it as not arrived');
      filas.push({ ...base, tipo: 'completada' });
      continue;
    }
    if (aw <= ddDia) {
      base.avisos.push(`Arrived per the matrix (${aw}) and the freight is not finished in T₃: confirm on site`);
      filas.push({ ...base, tipo: 'llegada' });
      continue;
    }
    if (clase === 'Close') { filas.push({ ...base, tipo: 'cercana' }); continue; }

    // Cambios: procura .D hasta el embarque y flete .E del embarque a la llegada
    const finAw = `${diaSiguiente(aw)} 00:00`;
    for (const e of pendientes) {
      const hdE = horasDiaDe(e.i);
      const codD = e.cod.replace(/\.E$/i, '.D');
      const iD = porCod.get(codD);
      if (iD !== undefined) {
        const estD = celda(t, t.filas[iD], 'status_code');
        if (estD === 'TK_Active') {
          if (ar && ar >= ddDia) {
            const nuevo = Math.max(horas(iD, dd, `${diaSiguiente(ar)} 00:00`), horasDiaDe(iD));
            const antes = Number(celda(t, t.filas[iD], 'remain_drtn_hr_cnt')) || 0;
            if (Math.abs(nuevo - antes) > 0.01) base.cambios.push({ i: iD, cod: codD, campo: 'durRestante', antesH: antes, nuevoH: nuevo, horasDia: horasDiaDe(iD), nota: `finish on the shipment date ${ar}` });
          } else if (ar) base.avisos.push(`${codD} still In Progress but shipped on ${ar}: close it with the Cut`);
        } else if (estD === 'TK_NotStart') base.avisos.push(`${codD} (procurement) not started: review its logic; only the freight is adjusted`);
      }
      if (e.estado === 'TK_NotStart') {
        if (!ar) { base.avisos.push(`${e.cod}: no shipment date (AR) in the matrix`); continue; }
        const inicio = ar >= ddDia ? `${diaSiguiente(ar)} 00:00` : dd;
        const nuevo = Math.max(horas(e.i, inicio, finAw), hdE);
        const antes = Number(celda(t, t.filas[e.i], 'target_drtn_hr_cnt')) || 0;
        if (Math.abs(nuevo - antes) > 0.01) base.cambios.push({ i: e.i, cod: e.cod, campo: 'durOriginal', antesH: antes, nuevoH: nuevo, horasDia: hdE, nota: `transit ${ar >= ddDia ? ar : 'data date'} → ${aw}` });
      } else {
        const nuevo = Math.max(horas(e.i, dd, finAw), hdE);
        const antes = Number(celda(t, t.filas[e.i], 'remain_drtn_hr_cnt')) || 0;
        if (Math.abs(nuevo - antes) > 0.01) base.cambios.push({ i: e.i, cod: e.cod, campo: 'durRestante', antesH: antes, nuevoH: nuevo, horasDia: hdE, nota: `finish on the arrival ${aw}` });
      }
    }
    filas.push({ ...base, tipo: 'cambio' });
  }

  // T₃ sin pareja: fletes pendientes con «32. Variacion» que no están en la matriz
  const enMatriz = new Set(porPartida.keys());
  for (const [k, idxs] of fletes) {
    if (enMatriz.has(k)) continue;
    const pend = idxs.filter(i => celda(t, t.filas[i], 'status_code') !== 'TK_Complete');
    if (!pend.length) continue;
    sinPareja.push({ lado: 'T3', clave: k, partida: variacion.get(celda(t, t.filas[pend[0]], 'task_id')) || k, detalle: pend.map(i => celda(t, t.filas[i], 'task_code')).join(', '), aw: null, subc: pend.map(i => subcDe(i)).find(Boolean) || subcDe(porCod.get(celda(t, t.filas[pend[0]], 'task_code').replace(/\.E$/i, '.D'))) || '' });
  }

  const orden: Record<ClaseDelta, number> = { Gap: 0, Review: 1, Close: 2 };
  filas.sort((a, b) => orden[a.clase] - orden[b.clase] || Math.abs(b.delta) - Math.abs(a.delta));
  return { filas, sinPareja, excluidas: { tuberias, valvulas, sinAw }, fechaDatos: dd };
}

/**
 * Compra y fabricación (.D) de los equipos cuyo flete (.E) NO se puede seguir con la matriz de importación
 * (decisión del 27-nov-2026): sin «32. Variacion», con una llave que no está en la matriz, o que está pero sin
 * llegada (AW) o como tubería/válvula (excluidas del cruce). Sin una fecha de llegada que la ajuste, su compra se
 * queda con el remaining que tenga (a veces 1–3 días) y el flete arranca enseguida; se propone subirle la
 * Remaining Duration (o la Original, si no ha empezado) a un mínimo (por defecto 30 días de su calendario).
 * Alcance: familias .D + .E de equipo (grupo Procura_Eq o nombre «Compra…»), sin válvulas (SCAP Valvulas) ni el
 * WBS «.D» del proyecto (pendientes de confirmar por el Ingeniero, con fechas provisionales); .D sin terminar.
 */
export type MotivoSinMatriz = 'sin_llave' | 'no_en_matriz' | 'sin_aw' | 'tuberia' | 'valvula';
export const TEXTO_MOTIVO: Record<MotivoSinMatriz, string> = {
  sin_llave: 'No «32. Variacion» key',
  no_en_matriz: 'Not in the matrix',
  sin_aw: 'In the matrix without arrival (AW)',
  tuberia: 'In the matrix as pipe (excluded)',
  valvula: 'In the matrix as valve (excluded)',
};
export interface FilaSinMatriz {
  clave: string;
  iD: number;
  codD: string;
  nombre: string;
  subc: string;
  partida: string;
  motivo: MotivoSinMatriz;
  estadoD: string;
  codE: string;
  estadoE: string;
  /** Días (calendario de la .D) que le quedan y su fin temprano. */
  remDias: number;
  finD: string;
  horasDia: number;
  cambio: CambioLlegada | null;
}

export function procuraSinMatriz(m: ModeloP6, filasMatriz: FilaMatriz[], minDias = 30): FilaSinMatriz[] {
  const t = m.task;
  const tipos = m.xer.tablas.get('UDFTYPE'), valores = m.xer.tablas.get('UDFVALUE');
  const idDe = (etq: string) => { const f = tipos?.filas.find(x => celda(tipos, x, 'table_name') === 'TASK' && celda(tipos, x, 'udf_type_label') === etq); return f ? celda(tipos!, f, 'udf_type_id') : null; };
  const ids: Record<string, string | null> = { v: idDe('32. Variacion'), s: idDe('07.SCAP'), c: idDe('11.SubC'), g: idDe('01.Grupos') };
  const udf: Record<string, Map<string, string>> = { v: new Map(), s: new Map(), c: new Map(), g: new Map() };
  for (const f of valores?.filas || []) {
    const tipo = celda(valores!, f, 'udf_type_id');
    for (const k of Object.keys(ids)) if (ids[k] && tipo === ids[k]) udf[k].set(celda(valores!, f, 'fk_id'), celda(valores!, f, 'udf_text') || celda(valores!, f, 'udf_number'));
  }
  const u = (k: string, i: number) => { const v = String(udf[k].get(celda(t, t.filas[i], 'task_id')) || '').trim(); return v && v !== '0' ? v : ''; };

  // Llaves de la matriz: «ok» si alguna fila de la partida tiene AW y no es tubería ni válvula
  const llaves = new Map<string, 'ok' | MotivoSinMatriz>();
  for (const r of filasMatriz) {
    const k = normLlave(r.p);
    if (!k) continue;
    const tipo = esTuberia(r) ? 'tuberia' : esValvulaMatriz(r) ? 'valvula' : !r.aw ? 'sin_aw' : 'ok';
    if (llaves.get(k) !== 'ok') llaves.set(k, tipo);
  }
  // WBS de primer nivel bajo la raíz (para dejar fuera «.D», pendientes de confirmar)
  const w = m.xer.tablas.get('PROJWBS');
  const nodo = new Map((w?.filas || []).map(f => [celda(w!, f, 'wbs_id'), { padre: celda(w!, f, 'parent_wbs_id'), cod: celda(w!, f, 'wbs_short_name') }]));
  const primerNivel = (id: string) => { const r: string[] = []; for (let x = nodo.get(id); x; x = nodo.get(x.padre)) r.unshift(x.cod); return r[1] || ''; };

  const porCod = new Map<string, number>();
  t.filas.forEach((f, i) => porCod.set(celda(t, f, 'task_code'), i));
  const out: FilaSinMatriz[] = [];
  t.filas.forEach((f, iD) => {
    const codD = celda(t, f, 'task_code');
    if (!/\.D$/.test(codD)) return;
    const codE = codD.replace(/\.D$/, '.E');
    const iE = porCod.get(codE);
    if (iE === undefined) return;
    const estadoD = celda(t, f, 'status_code');
    if (estadoD === 'TK_Complete') return;
    if (!/procura_eq/i.test(u('g', iD)) && !/^compr/i.test(celda(t, f, 'task_name').trim())) return;
    if (/valvul/i.test(u('s', iD)) || /valvul/i.test(u('s', iE))) return;
    if (primerNivel(celda(t, f, 'wbs_id')) === 'D') return;
    const partida = u('v', iE);
    const k = normLlave(partida);
    const enM = k ? llaves.get(k) : undefined;
    if (enM === 'ok') return;
    const motivo: MotivoSinMatriz = !k ? 'sin_llave' : enM ?? 'no_en_matriz';
    const hd = m.calendarios.get(celda(t, f, 'clndr_id'))?.horasDia || 8;
    const remH = Number(celda(t, f, 'remain_drtn_hr_cnt')) || 0;
    const minH = minDias * hd;
    let cambio: CambioLlegada | null = null;
    if (estadoD === 'TK_Active' && remH < minH - 0.01) {
      cambio = { i: iD, cod: codD, campo: 'durRestante', antesH: remH, nuevoH: minH, horasDia: hd, nota: `at least ${minDias} d of procurement left (freight not in the import matrix)` };
    } else if (estadoD === 'TK_NotStart') {
      const origH = Number(celda(t, f, 'target_drtn_hr_cnt')) || 0;
      if (origH < minH - 0.01) cambio = { i: iD, cod: codD, campo: 'durOriginal', antesH: origH, nuevoH: minH, horasDia: hd, nota: `at least ${minDias} d of procurement (freight not in the import matrix)` };
    }
    out.push({
      clave: `sm:${codD}`, iD, codD, nombre: celda(t, f, 'task_name'), subc: u('c', iD) || u('c', iE), partida, motivo, estadoD,
      codE, estadoE: celda(t, t.filas[iE], 'status_code'), remDias: remH / hd,
      finD: (celda(t, f, 'early_end_date') || celda(t, f, 'act_end_date')).slice(0, 10), horasDia: hd, cambio,
    });
  });
  return out.sort((a, b) => Number(!a.subc) - Number(!b.subc) || a.subc.localeCompare(b.subc, 'es') || a.remDias - b.remDias);
}
