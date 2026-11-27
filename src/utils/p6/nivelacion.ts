/**
 * Nivelación de un conjunto de actividades (p. ej. la instalación de compuertas de un subcontratista)
 * reorganizando su lógica de cuadrillas, como se haría a mano en P6:
 *
 *  1. Los enlaces INTERNOS del conjunto (de una actividad del conjunto a otra) son la secuencia de
 *     cuadrilla actual: se quitan. Los EXTERNOS (flete, inicio de montaje, hitos de fin…) se respetan.
 *  2. Sin esos enlaces, el CPM dice cuándo puede empezar cada actividad (su disponibilidad: llegada
 *     del equipo, frente liberado…) y su inicio tardío (urgencia).
 *  3. Se reparten las actividades entre N cuadrillas (programación en serie): cada cuadrilla toma una
 *     estructura completa (CAP) y la instala de continuo; solo la deja si lo que falta no llega pronto.
 *     Dentro de una estructura, primero lo que llega antes y del mismo tipo (Unit) seguido.
 *  4. Cada cuadrilla queda como una cadena FS. Se evita crear ciclos y se marcan los extremos abiertos.
 *
 * Todo se calcula sin tocar el modelo (vista previa); `aplicarNivelacion` escribe los cambios.
 */
import { celda } from './xer';
import { entradasCpm, lagSsDesdeInicioTemprano, type ModeloP6 } from './modelo';
import { programar, type ActividadCpm, type Rel } from './cpm';
import { agregarRelacion, eliminarRelacion, type Cambio } from './edicion';
import { repartir } from './uso';

export interface ElementoNivel {
  i: number;           // fila de TASK
  cod: string;
  nombre: string;
  grupo: string;       // estructura (CAP)
  tipo: string;        // tipo de equipo (Unit)
  dur: number;         // duración restante (minutos de trabajo)
  cant: number;        // unidades restantes (Remaining Units)
}

export interface NuevaRel { pred: number; succ: number; tipo: Rel['tipo']; lag: number; motivo: 'crew' | 'close' }

export interface Propuesta {
  cuadrillas: number;
  tope: number;
  /** Secuencia de cada cuadrilla (índices de TASK) con sus fechas simuladas. */
  secuencias: { i: number; ini: number; fin: number }[][];
  /** Filas de TASKPRED internas que se quitan. */
  quitar: number[];
  /** Enlaces nuevos (índices de TASK; desfase en minutos de trabajo del calendario de la predecesora). */
  agregar: NuevaRel[];
  /** Enlaces que no se crean porque cerrarían un ciclo con la lógica externa. */
  omitidos: [number, number][];
  /** Actividades que quedarían sin sucesora (extremo abierto). */
  abiertas: number[];
  /** Resultado del CPM con la nueva lógica. */
  despues: Resultado;
  /** Enlaces de cuadrilla no creados hacia actividades que llegan tarde (no conducen y arrastrarían su holgura). */
  sinArrastre: number;
  /** Actividades por debajo de su holgura objetivo (0, o su límite si llegan tarde). */
  deficit: number[];
}

/**
 * Actividades que quedan por debajo de su holgura objetivo: 0, o su propio límite si ni con cuadrillas
 * ilimitadas llega a 0 (equipo que llega tarde). Tolerancia: media jornada.
 */
export function deficitHolgura(d: Diagnostico, r: Resultado): number[] {
  const out: number[] = [];
  for (const [i, h] of r.holgura) {
    if (h == null) continue;
    const lib = d.libre.holgura.get(i);
    const objetivo = Math.min(0, lib ?? 0);
    if (h < objetivo - 240) out.push(i);
  }
  return out;
}

export interface Resultado {
  ini: Map<number, number>;
  fin: Map<number, number>;
  finConjunto: number;
  finProyecto: number;
  holgura: Map<number, number | null>;
}

export interface Diagnostico {
  elementos: ElementoNivel[];
  antes: Resultado;
  /** Fila TASKPRED de cada enlace interno actual. */
  internos: number[];
  /** Disponibilidad (inicio temprano sin enlaces internos) y urgencia (inicio tardío). */
  disp: Map<number, number>;
  tarde: Map<number, number>;
  /** Hallazgos legibles. */
  hallazgos: string[];
  /** Programación con cuadrillas ilimitadas (sin enlaces internos): el mejor caso posible solo con secuencias. */
  libre: Resultado;
  /**
   * Holgura objetivo de la nivelación: 0 o, si algo llega tan tarde que ni con cuadrillas ilimitadas
   * se alcanza 0, la mejor posible (la peor holgura del caso ilimitado). En minutos de trabajo.
   */
  objetivo: number;
  /** Actividades que no pueden llegar a holgura 0 solo con secuencias, con lo que las retiene. */
  limitantes: { i: number; holgura: number; motivo: number | null; inicio: number }[];
  /** Enlaces que cierran las actividades sin ninguna sucesora externa (a la sucesora común de su estructura). */
  cierres: Rel[];
}

/** Cierra las actividades del conjunto sin sucesora externa con la sucesora externa más común de su estructura. */
function cerrarExtremos(acts: ActividadCpm[], externas: Rel[], elementos: ElementoNivel[], set: Set<number>): Rel[] {
  const grupo = new Map(elementos.map(e => [e.i, e.grupo]));
  const conSucc = new Set(externas.map(r => r.pred));
  const succs: number[][] = acts.map(() => []);
  for (const r of externas) succs[r.pred].push(r.succ);
  const alcanza = (desde: number, hasta: number) => {
    const visto = new Uint8Array(acts.length), pila = [desde];
    while (pila.length) { const x = pila.pop()!; if (x === hasta) return true; if (visto[x]) continue; visto[x] = 1; for (const y of succs[x]) if (!visto[y]) pila.push(y); }
    return false;
  };
  const out: Rel[] = [];
  for (const e of elementos) {
    if (!ACTIVA(acts[e.i]) || conSucc.has(e.i)) continue;
    const votos = new Map<string, { succ: number; tipo: Rel['tipo']; n: number }>();
    for (const r of externas) {
      if (set.has(r.succ) || !set.has(r.pred) || grupo.get(r.pred) !== e.grupo) continue;
      const k = `${r.succ}|${r.tipo}`;
      const v = votos.get(k) ?? { succ: r.succ, tipo: r.tipo, n: 0 };
      v.n++; votos.set(k, v);
    }
    const mejor = [...votos.values()].sort((a, b) => b.n - a.n)[0];
    if (mejor && !alcanza(mejor.succ, e.i)) { out.push({ pred: e.i, succ: mejor.succ, tipo: mejor.tipo, lag: 0 }); succs[e.i].push(mejor.succ); }
  }
  return out;
}

const ACTIVA = (a: ActividadCpm) => a.estado !== 'Terminada';
/** Pendiente y con trabajo (duración restante > 0): las de duración 0 son comodines (p. ej. fechas provisionales). */
const conDuracion = (a: ActividadCpm) => ACTIVA(a) && a.durRest > 0;

/** Programa el modelo con la lista de relaciones dada (sin escribir nada). */
function simular(m: ModeloP6, acts: ActividadCpm[], rels: Rel[], conjunto: number[]): Resultado {
  const copia = acts.map(a => ({ ...a, ES: undefined, EF: undefined, LS: undefined, LF: undefined, TF: undefined, FFl: undefined, inicioSS: undefined, lagConsumido: undefined }));
  const res = programar(copia, rels, { fechaDatos: m.fechaDatos, finProyecto: m.finProyecto, lagSsDesdeInicioTemprano: lagSsDesdeInicioTemprano(m) });
  const ini = new Map<number, number>(), fin = new Map<number, number>(), holgura = new Map<number, number | null>();
  let finConjunto = -Infinity;
  for (const i of conjunto) {
    const a = copia[i];
    ini.set(i, a.ES ?? a.inicioReal ?? 0);
    fin.set(i, a.EF ?? a.finReal ?? 0);
    // Las actividades sin duración (fechas provisionales, comodines) no cuentan en fin ni holgura
    if (!conDuracion(acts[i])) continue;
    holgura.set(i, a.TF ?? null);
    finConjunto = Math.max(finConjunto, a.EF ?? 0);
  }
  return { ini, fin, finConjunto, finProyecto: res.finTemprano, holgura };
}

/** Diagnóstico del conjunto: lógica actual, disponibilidad real y hallazgos. */
export function diagnosticar(m: ModeloP6, conjunto: number[], grupoDe: (i: number) => string, tipoDe: (i: number) => string): Diagnostico {
  const t = m.task, p = m.pred;
  const { acts, rels } = entradasCpm(m);
  const set = new Set(conjunto);
  const tr = m.xer.tablas.get('TASKRSRC');
  const cant = new Map<string, number>();
  for (const f of tr?.filas || []) cant.set(celda(tr!, f, 'task_id'), (cant.get(celda(tr!, f, 'task_id')) ?? 0) + (Number(celda(tr!, f, 'remain_qty')) || 0));
  const elementos: ElementoNivel[] = conjunto.map(i => {
    const f = t.filas[i];
    return { i, cod: celda(t, f, 'task_code'), nombre: celda(t, f, 'task_name'), grupo: grupoDe(i) || '(no CAP)', tipo: tipoDe(i) || '(no Unit)', dur: acts[i].durRest, cant: cant.get(celda(t, f, 'task_id')) ?? 0 };
  });
  // Enlaces internos actuales (por fila de TASKPRED)
  const internos: number[] = [];
  p.filas.forEach((f, k) => {
    const a = m.porId.get(celda(p, f, 'pred_task_id')), b = m.porId.get(celda(p, f, 'task_id'));
    if (a !== undefined && b !== undefined && set.has(a) && set.has(b)) internos.push(k);
  });
  const antes = simular(m, acts, rels, conjunto);
  const externasOrig = rels.filter(r => !(set.has(r.pred) && set.has(r.succ)));
  // Las que no tienen ninguna sucesora fuera del conjunto se cierran ya (antes de calcular el mejor caso)
  // con la sucesora externa más común de su estructura: si no, su holgura no significa nada
  const cierres = cerrarExtremos(acts, externasOrig, elementos, set);
  const externas = [...externasOrig, ...cierres];
  const libre = simular(m, acts, externas, conjunto);
  const disp = libre.ini;
  const tarde = new Map<number, number>();
  const limitantes: Diagnostico['limitantes'] = [];
  {
    const copia = acts.map(a => ({ ...a }));
    programar(copia, externas, { fechaDatos: m.fechaDatos, finProyecto: m.finProyecto, lagSsDesdeInicioTemprano: lagSsDesdeInicioTemprano(m) });
    for (const i of conjunto) tarde.set(i, copia[i].LS ?? copia[i].ES ?? 0);
    // Las que aun con cuadrillas ilimitadas quedan con holgura negativa, y qué las retiene (la predecesora conductora)
    for (const i of conjunto) {
      const h = copia[i].TF;
      if (!conDuracion(acts[i]) || h == null || h >= 0) continue;
      let motivo: number | null = null, mejor = -Infinity;
      for (const r of externas) {
        if (r.succ !== i) continue;
        const pr = copia[r.pred];
        const base = r.tipo === 'SS' || r.tipo === 'SF' ? pr.ES : pr.EF;
        if (base == null) continue;
        const v = base + r.lag;
        if (v > mejor) { mejor = v; motivo = r.pred; }
      }
      limitantes.push({ i, holgura: h, motivo, inicio: copia[i].ES ?? m.fechaDatos });
    }
    limitantes.sort((a, b) => a.holgura - b.holgura);
  }
  const peorLibre = Math.min(...[...libre.holgura.entries()].filter(([i, v]) => v != null && ACTIVA(acts[i])).map(([, v]) => v as number));
  const objetivo = Math.min(0, isFinite(peorLibre) ? peorLibre : 0);

  // Hallazgos
  const hallazgos: string[] = [];
  const espera = (i: number) => acts[i].cal.entre(disp.get(i)!, antes.ini.get(i)!);
  const diasCal = (i: number, min: number) => Math.round(min / (acts[i].cal.horasDia * 60));
  const nom = (i: number) => celda(t, t.filas[i], 'task_code');
  // a) Esperas por la secuencia de cuadrilla: la actividad ya podría empezar y la cadena la retrasa
  const esperas = conjunto.filter(i => ACTIVA(acts[i]) && diasCal(i, espera(i)) >= 5).sort((a, b) => espera(b) - espera(a));
  if (esperas.length) hallazgos.push(`${esperas.length} activities could start earlier (their equipment is already on site) but wait for the crew chain: ${esperas.slice(0, 6).map(i => `${nom(i)} +${diasCal(i, espera(i))}d`).join(', ')}${esperas.length > 6 ? '…' : ''}`);
  // b) Cadenas que saltan de estructura dejando otra a medias
  let saltos = 0;
  const grupoI = new Map(elementos.map(e => [e.i, e.grupo]));
  for (const k of internos) {
    const f = p.filas[k];
    const a = m.porId.get(celda(p, f, 'pred_task_id'))!, b = m.porId.get(celda(p, f, 'task_id'))!;
    if (grupoI.get(a) !== grupoI.get(b)) saltos++;
  }
  if (saltos) hallazgos.push(`${saltos} crew links jump from one structure (CAP) to another while work remains in the first one.`);
  // c) Enlaces SS internos: dos frentes a la vez en la misma estructura
  const ss = internos.filter(k => celda(p, p.filas[k], 'pred_type') === 'PR_SS').length;
  if (ss) hallazgos.push(`${ss} internal SS links run two gates of the same structure in parallel (a second crew that appears and disappears).`);
  // d) Sin enlace de cuadrilla (aisladas) y extremos abiertos
  const conInterno = new Set<number>();
  for (const k of internos) { const f = p.filas[k]; conInterno.add(m.porId.get(celda(p, f, 'pred_task_id'))!); conInterno.add(m.porId.get(celda(p, f, 'task_id'))!); }
  const aisladas = conjunto.filter(i => !conInterno.has(i) && ACTIVA(acts[i]));
  if (aisladas.length) hallazgos.push(`${aisladas.length} activities are not in any crew sequence (an extra crew in parallel): ${aisladas.map(nom).join(', ')}`);
  const sinSucc = conjunto.filter(i => ACTIVA(acts[i]) && !rels.some(r => r.pred === i));
  if (sinSucc.length) hallazgos.push(`Open ends (no successor, so their float is meaningless): ${sinSucc.map(i => `${nom(i)} (TF ${antes.holgura.get(i) != null ? diasCal(i, antes.holgura.get(i)!) : '—'}d)`).join(', ')}`);
  const sinDur = elementos.filter(e => ACTIVA(acts[e.i]) && acts[e.i].durRest <= 0);
  if (sinDur.length) hallazgos.push(`${sinDur.length} activities have no remaining duration (provisional dates): they are left out of the crews and of the finish, float and histogram figures: ${sinDur.slice(0, 8).map(e => e.cod).join(', ')}${sinDur.length > 8 ? '…' : ''}`);
  const sinCant = elementos.filter(e => !e.cant && ACTIVA(acts[e.i]));
  if (sinCant.length) hallazgos.push(`Without units (Remaining Units = 0), they do not count in the histogram: ${sinCant.map(e => e.cod).join(', ')}`);
  if (limitantes.length) hallazgos.push(`${limitantes.length} activities cannot reach zero float just by resequencing (even with unlimited crews, starting as soon as their equipment arrives): ${limitantes.slice(0, 5).map(l => `${nom(l.i)} ${diasCal(l.i, l.holgura)}d${l.motivo != null ? ` (waits for ${nom(l.motivo)})` : ''}`).join(', ')}${limitantes.length > 5 ? '…' : ''}`);
  return { elementos, antes, internos, disp, tarde, hallazgos, libre, objetivo, limitantes, cierres };
}

/** Límites mensuales (minutos) desde el mes de la fecha de datos, para el tope de carga y el histograma. */
export function meses(desde: number, n = 36): number[] {
  const d = new Date(desde * 60000);
  const out: number[] = [];
  for (let k = 0; k <= n; k++) out.push(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, 1) / 60000);
  return out;
}

export interface OpcionesPropuesta {
  cuadrillas: number;
  /** Tope de unidades por mes para las actividades CON holgura (las urgentes nunca esperan). */
  tope?: number;
  /** Días que una cuadrilla espera en su estructura a que llegue lo que falta antes de irse a otra. */
  toleranciaDias?: number;
  /** Días de urgencia que se ceden para no dejar una estructura a medias. */
  continuidadDias?: number;
}

/**
 * Programación en serie con N cuadrillas («nivelar dentro de la holgura», como el nivelador de P6):
 * - una cuadrilla libre toma, de lo que ya está en obra, lo más urgente (inicio tardío más temprano),
 *   pero sigue en su estructura si lo de su estructura no es mucho menos urgente (continuidad);
 * - una actividad con holgura no empieza si con ella algún mes supera el tope: espera (como mucho
 *   hasta su inicio tardío); las que ya no tienen holgura empiezan siempre que haya cuadrilla.
 */
export function proponer(m: ModeloP6, d: Diagnostico, op: OpcionesPropuesta): Propuesta {
  const { acts, rels } = entradasCpm(m);
  const cuadrillas = Math.max(1, Math.round(op.cuadrillas));
  const tope = op.tope ?? Infinity;
  const set = new Set(d.elementos.map(e => e.i));
  const porI = new Map(d.elementos.map(e => [e.i, e]));
  const cal = (i: number) => acts[i].cal;
  const diaDe = (i: number) => cal(i).horasDia * 60;
  const tolDias = op.toleranciaDias ?? 5, contDias = op.continuidadDias ?? 10;
  const pendientes = new Set(d.elementos.filter(e => conDuracion(acts[e.i])).map(e => e.i));
  const urg = (i: number) => d.tarde.get(i) ?? Infinity;
  const disp = (i: number) => d.disp.get(i) ?? m.fechaDatos;
  const lim = meses(m.fechaDatos);
  const carga = new Float64Array(lim.length - 1);
  const libreDesde: number[] = Array.from({ length: cuadrillas }, () => m.fechaDatos);
  const grupoActual: (string | null)[] = Array.from({ length: cuadrillas }, () => null);
  const ultimoTipo: (string | null)[] = Array.from({ length: cuadrillas }, () => null);
  const secuencias: { i: number; ini: number; fin: number }[][] = Array.from({ length: cuadrillas }, () => []);
  const fechas = (i: number, desde: number) => {
    const ini = cal(i).aInicio(Math.max(desde, disp(i)));
    return { ini, fin: porI.get(i)!.dur > 0 ? cal(i).sumar(ini, porI.get(i)!.dur, 'fin') : ini };
  };
  const tramoDe = (i: number, ini: number, fin: number) => repartir(porI.get(i)!.cant, ini, Math.max(ini, fin), lim, cal(i));
  const cabe = (i: number, ini: number, fin: number) => {
    if (!isFinite(tope) || !porI.get(i)!.cant) return true;
    const tr = tramoDe(i, ini, fin);
    if (!tr) return true;
    // Si la actividad sola supera el tope de un mes, basta con que ese mes esté vacío
    for (let k = 0; k < tr.vals.length; k++) { const c = carga[tr.desde + k]; if (c + tr.vals[k] > tope + 1e-6 && c > 1e-6) return false; }
    return true;
  };
  const asignar = (i: number, k: number, ini: number, fin: number) => {
    secuencias[k].push({ i, ini, fin });
    libreDesde[k] = fin;
    grupoActual[k] = porI.get(i)!.grupo;
    ultimoTipo[k] = porI.get(i)!.tipo;
    pendientes.delete(i);
    const tr = tramoDe(i, ini, fin);
    if (tr) for (let x = 0; x < tr.vals.length; x++) carga[tr.desde + x] += tr.vals[x];
  };
  // Las actividades en curso van primero dentro de su estructura, pero si tienen holgura también respetan
  // el tope (su trabajo restante puede esperar, como con la lógica retenida de P6)
  const enCurso = (i: number) => acts[i].estado === 'EnCurso';

  let vueltas = 0;
  const pend = () => [...pendientes];
  while (pendientes.size && vueltas++ < 100000) {
    let k = 0;
    for (let x = 1; x < cuadrillas; x++) if (libreDesde[x] < libreDesde[k]) k = x;
    const T = libreDesde[k];
    const g = grupoActual[k];
    // 1) Continuidad: la cuadrilla sigue en su estructura con lo que ya está en obra o llega pronto
    //    (el tope no corta una estructura empezada)
    if (g) {
      const prox = pend().filter(i => porI.get(i)!.grupo === g && (disp(i) <= T || cal(i).entre(T, disp(i)) <= tolDias * diaDe(i)));
      if (prox.length) {
        prox.sort((a, b) => Math.max(disp(a), T) - Math.max(disp(b), T)
          || (porI.get(a)!.tipo === ultimoTipo[k] ? 0 : 1) - (porI.get(b)!.tipo === ultimoTipo[k] ? 0 : 1)
          || porI.get(a)!.tipo.localeCompare(porI.get(b)!.tipo) || urg(a) - urg(b));
        const f = fechas(prox[0], T);
        asignar(prox[0], k, f.ini, f.fin);
        continue;
      }
    }
    // 2) Otra estructura
    const listas = pend().filter(i => disp(i) <= T);
    if (!listas.length) { libreDesde[k] = Math.min(...pend().map(disp)); grupoActual[k] = null; continue; }
    const grupos = new Map<string, number[]>();
    for (const i of listas) { const gg = porI.get(i)!.grupo; (grupos.get(gg) ?? grupos.set(gg, []).get(gg)!).push(i); }
    // Una estructura que ya tiene cuadrilla solo recibe otra si es bastante más urgente que las libres
    const ocupada = (gg: string) => grupoActual.some((x, y) => y !== k && x === gg);
    const rango = [...grupos].map(([gg, lista]) => {
      lista.sort((a, b) => (enCurso(a) ? 0 : 1) - (enCurso(b) ? 0 : 1) || porI.get(a)!.tipo.localeCompare(porI.get(b)!.tipo) || urg(a) - urg(b));
      const u = Math.min(...lista.map(urg));
      return { gg, lista, u, clave: u + (ocupada(gg) ? contDias * diaDe(lista[0]) : 0) };
    }).sort((a, b) => a.clave - b.clave || a.gg.localeCompare(b.gg));
    let hecho = false;
    for (const { lista } of rango) {
      // Se comprueba el tope con el bloque de lo que ya está en obra de esa estructura, seguido
      const primero = fechas(lista[0], T);
      let ok = primero.ini >= urg(lista[0]) || !isFinite(tope);
      if (!ok) {
        const extra = new Float64Array(carga.length);
        let t0 = T, cabeTodo = true;
        for (const i of lista) {
          const f = fechas(i, t0); t0 = f.fin;
          const tr = porI.get(i)!.cant ? tramoDe(i, f.ini, f.fin) : undefined;
          if (tr) for (let x = 0; x < tr.vals.length; x++) {
            const c = carga[tr.desde + x] + extra[tr.desde + x];
            if (c + tr.vals[x] > tope + 1e-6 && c > 1e-6) cabeTodo = false;
            extra[tr.desde + x] += tr.vals[x];
          }
          if (!cabeTodo) break;
        }
        ok = cabeTodo;
      }
      if (ok) { asignar(lista[0], k, primero.ini, primero.fin); hecho = true; break; }
    }
    if (hecho) continue;
    // Nada cabe: la cuadrilla espera al mes siguiente (o al inicio tardío de lo más urgente)
    grupoActual[k] = null;
    const sig = lim.find(x => x > T) ?? T + 1440;
    libreDesde[k] = Math.max(T + 1, Math.min(sig, ...listas.map(urg).filter(u => u > T)));
  }

  // Enlaces: cadena FS por cuadrilla (con desfase si la nivelación la hace esperar), evitando ciclos
  const externas = [...rels.filter(r => !(set.has(r.pred) && set.has(r.succ))), ...d.cierres];
  const succs: number[][] = acts.map(() => []);
  for (const r of externas) succs[r.pred].push(r.succ);
  const alcanza = (desde: number, hasta: number) => {
    const visto = new Uint8Array(acts.length), pila = [desde];
    while (pila.length) { const x = pila.pop()!; if (x === hasta) return true; if (visto[x]) continue; visto[x] = 1; for (const y of succs[x]) if (!visto[y]) pila.push(y); }
    return false;
  };
  const agregar: NuevaRel[] = [], omitidos: [number, number][] = [];
  const limitada = new Set(d.limitantes.map(l => l.i));
  let sinArrastre = 0;
  for (const sec of secuencias) for (let n = 1; n < sec.length; n++) {
    const a = sec[n - 1], b = sec[n];
    if (alcanza(b.i, a.i)) { omitidos.push([a.i, b.i]); continue; }
    // Una actividad que llega tarde (holgura negativa ni con cuadrillas ilimitadas) y empieza en cuanto
    // llega su equipo no depende de la cuadrilla: el enlace solo arrastraría su holgura negativa hacia atrás
    if (limitada.has(b.i) && b.ini <= cal(b.i).aInicio(disp(b.i)) + 1 && a.fin <= b.ini) { sinArrastre++; continue; }
    // Espera impuesta por la nivelación (no por la llegada del equipo): se guarda como desfase
    const libre = Math.max(cal(b.i).aInicio(a.fin), cal(b.i).aInicio(disp(b.i)));
    const lag = b.ini > libre + 1 ? cal(a.i).entre(a.fin, b.ini) : 0;
    agregar.push({ pred: a.i, succ: b.i, tipo: 'FS', lag, motivo: 'crew' });
    succs[a.i].push(b.i);
  }
  // Extremos abiertos: la última de cada cuadrilla va al mismo hito/sucesora que las demás de su estructura
  const conSucc = new Set<number>([...externas.map(r => r.pred), ...agregar.map(r => r.pred)]);
  for (const e of d.elementos) {
    if (!ACTIVA(acts[e.i]) || conSucc.has(e.i)) continue;
    const votos = new Map<string, { succ: number; tipo: Rel['tipo']; n: number }>();
    for (const r of externas) {
      if (set.has(r.succ) || !set.has(r.pred) || porI.get(r.pred)!.grupo !== e.grupo) continue;
      const k = `${r.succ}|${r.tipo}`;
      const v = votos.get(k) ?? { succ: r.succ, tipo: r.tipo, n: 0 };
      v.n++; votos.set(k, v);
    }
    const mejor = [...votos.values()].sort((a, b) => b.n - a.n)[0];
    if (mejor && !alcanza(mejor.succ, e.i)) { agregar.push({ pred: e.i, succ: mejor.succ, tipo: mejor.tipo, lag: 0, motivo: 'close' }); succs[e.i].push(mejor.succ); conSucc.add(e.i); }
  }
  for (const c of d.cierres) agregar.push({ pred: c.pred, succ: c.succ, tipo: c.tipo, lag: 0, motivo: 'close' });
  const todas: Rel[] = [...externas, ...agregar.filter(r => r.motivo !== 'close').map(r => ({ pred: r.pred, succ: r.succ, tipo: r.tipo, lag: r.lag }))];
  const despues = simular(m, acts, todas, d.elementos.map(e => e.i));
  const abiertas = d.elementos.map(e => e.i).filter(i => ACTIVA(acts[i]) && !conSucc.has(i));
  return { cuadrillas, tope, secuencias, quitar: d.internos, agregar, omitidos, abiertas, despues, sinArrastre, deficit: deficitHolgura(d, despues) };
}

/** Peor holgura total (en minutos de trabajo) de las actividades pendientes del conjunto. */
export function peorHolgura(r: Resultado): number {
  let x = Infinity;
  for (const v of r.holgura.values()) if (v != null && v < x) x = v;
  return x;
}

export interface Evaluacion { op: OpcionesPropuesta; prop: Propuesta; hist: Float64Array; pico: number; desv: number; viable: boolean; holgura: number }

/** Pico y desviación de los meses con carga. */
export function picoYDesv(h: Float64Array): { pico: number; desv: number } {
  const v = [...h].filter(x => x > 0.01);
  if (!v.length) return { pico: 0, desv: 0 };
  const mu = v.reduce((a, b) => a + b, 0) / v.length;
  return { pico: Math.max(...v), desv: Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / v.length) };
}

/** Actividades con holgura total negativa (más de media jornada). */
export function negativas(r: Resultado): number {
  let n = 0;
  for (const v of r.holgura.values()) if (v != null && v < -240) n++;
  return n;
}

/**
 * Busca la mejor nivelación (solo cambia secuencias, nunca duraciones). Una opción solo vale si:
 *  - el conjunto termina ANTES (o como mucho igual) que con la lógica actual y el proyecto no se retrasa;
 *  - no empeora la holgura: ni más actividades con holgura negativa ni una peor holgura mínima;
 *  - nivela de verdad: pico mensual ≥ 5 % menor o desviación ≥ 10 % menor.
 * Si ninguna lo cumple, no merece la pena nivelar (`mejor` = null).
 * Entre las que valen: 1) holgura de cada actividad ≥ 0 o ≥ su límite (`deficitHolgura`; si no se
 * puede, el mínimo alcanzable); 2) el histograma más plano; 3) antes, menos cuadrillas y más continuidad.
 */
export function buscarMejor(m: ModeloP6, d: Diagnostico, maxCuadrillas?: number): { mejor: Evaluacion | null; probadas: Evaluacion[]; objetivoAlcanzado: boolean } {
  const { acts } = entradasCpm(m);
  // Hasta cuántas cuadrillas probar: las actividades que la lógica actual tiene a la vez (+2), mínimo 8
  const pend = d.elementos.filter(e => conDuracion(acts[e.i])).map(e => e.i);
  const eventos: [number, number][] = [];
  for (const i of pend) { eventos.push([d.antes.ini.get(i) ?? 0, 1]); eventos.push([d.antes.fin.get(i) ?? 0, -1]); }
  eventos.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let sim = 0, maxSim = 0;
  for (const [, v] of eventos) { sim += v; maxSim = Math.max(maxSim, sim); }
  const maxN = maxCuadrillas ?? Math.min(40, Math.max(8, maxSim + 2));
  const lim = meses(m.fechaDatos);
  const total = d.elementos.filter(e => conDuracion(acts[e.i])).reduce((a, e) => a + e.cant, 0);
  const finBase = d.antes.finConjunto, proyBase = d.antes.finProyecto;
  const negBase = negativas(d.antes), holgBase = peorHolgura(d.antes);
  const tol = 4 * 60; // media jornada
  const nMeses = Math.max(1, lim.filter(x => x < finBase).length);
  const base = total / nMeses;
  const topes = [Infinity, ...[1, 1.1, 1.2, 1.35, 1.5, 1.75, 2, 2.5].map(f => Math.ceil(base * f))];
  // Continuidad: de más (la estructura completa) a menos (lo más urgente primero)
  const variantes = [{ continuidadDias: 10, toleranciaDias: 5 }, { continuidadDias: 5, toleranciaDias: 3 }, { continuidadDias: 0, toleranciaDias: 0 }];
  const probadas: Evaluacion[] = [];
  const evaluar = (op: OpcionesPropuesta): Evaluacion => {
    const prop = proponer(m, d, op);
    const hist = histograma(m, d, prop.despues, lim);
    const { pico, desv } = picoYDesv(hist);
    const ev = { op, prop, hist, pico, desv, viable: false, holgura: peorHolgura(prop.despues) };
    probadas.push(ev);
    return ev;
  };
  // Condición para que valga la pena: termina antes (o igual), no retrasa el proyecto y no empeora la holgura
  const noPeor = (e: Evaluacion) => e.prop.despues.finConjunto <= finBase + 1 && e.prop.despues.finProyecto <= proyBase + 1
    && negativas(e.prop.despues) <= negBase && e.holgura >= holgBase - tol;
  // Fase 1: sin tope (lo más rápido posible) con 1…N cuadrillas
  const rapidas: Evaluacion[] = [];
  for (let n = 1; n <= maxN; n++) for (const v of variantes) rapidas.push(evaluar({ cuadrillas: n, tope: Infinity, ...v }));
  const validas = rapidas.filter(noPeor);
  if (!validas.length) return { mejor: null, probadas, objetivoAlcanzado: false };
  // Holgura alcanzable entre las válidas: déficit 0 si se puede, si no el mínimo
  const minDef = Math.min(...validas.map(e => e.prop.deficit.length));
  const mejorHolg = Math.max(...validas.filter(e => e.prop.deficit.length === minDef).map(e => e.holgura));
  const cumple = (e: Evaluacion) => noPeor(e) && e.prop.deficit.length <= minDef && e.holgura >= mejorHolg - tol;
  // Fase 2: con las combinaciones que cumplen, probar topes mensuales para aplanar el histograma
  for (const e of rapidas.filter(cumple)) for (const tope of topes.slice(1)) evaluar({ ...e.op, tope });
  // Y tiene que nivelar de verdad: pico al menos un 5 % menor o una desviación mensual claramente menor
  const hb = picoYDesv(histograma(m, d, d.antes, lim));
  const masPlano = (e: Evaluacion) => e.pico <= hb.pico - Math.max(1, 0.05 * hb.pico) || e.desv <= hb.desv - Math.max(1, 0.1 * hb.desv);
  for (const e of probadas) e.viable = cumple(e) && masPlano(e);
  if (!probadas.some(e => e.viable)) return { mejor: null, probadas, objetivoAlcanzado: false };
  const mejorDe = (a: Evaluacion, b: Evaluacion) => {
    // Diferencias pequeñas (≤ 5 % del pico) se consideran empate
    const tp = Math.max(1, 0.05 * Math.max(a.pico, b.pico));
    if (a.pico < b.pico - tp) return a;
    if (b.pico < a.pico - tp) return b;
    if (a.desv < b.desv - 1) return a;
    if (b.desv < a.desv - 1) return b;
    // A igualdad, la que termina antes (al menos un día)
    if (a.prop.despues.finConjunto < b.prop.despues.finConjunto - 1440) return a;
    if (b.prop.despues.finConjunto < a.prop.despues.finConjunto - 1440) return b;
    if (a.op.cuadrillas !== b.op.cuadrillas) return a.op.cuadrillas < b.op.cuadrillas ? a : b;
    return (a.op.continuidadDias ?? 10) >= (b.op.continuidadDias ?? 10) ? a : b;
  };
  const mejor = probadas.filter(e => e.viable).reduce(mejorDe);
  return { mejor, probadas, objetivoAlcanzado: minDef === 0 };
}

/** Escribe la propuesta en el modelo: quita los enlaces internos y crea las cadenas de cuadrilla. */
export function aplicarNivelacion(m: ModeloP6, prop: Propuesta, log: Cambio[]) {
  const t = m.task;
  const cod = (i: number) => celda(t, t.filas[i], 'task_code');
  for (const k of [...prop.quitar].sort((a, b) => b - a)) eliminarRelacion(m, k, log);
  for (const r of prop.agregar) agregarRelacion(m, cod(r.pred), r.succ, r.tipo, Math.round(r.lag / 60 * 100) / 100, log);
}

/** Unidades restantes por período según las fechas dadas (reparto en el calendario de cada actividad). */
export function histograma(m: ModeloP6, d: Diagnostico, r: Resultado, lim: number[]): Float64Array {
  const { acts } = entradasCpm(m);
  const out = new Float64Array(Math.max(0, lim.length - 1));
  for (const e of d.elementos) {
    if (!conDuracion(acts[e.i]) || !e.cant) continue;
    const ini = Math.max(r.ini.get(e.i) ?? 0, m.fechaDatos), fin = r.fin.get(e.i) ?? ini;
    const tramo = repartir(e.cant, ini, Math.max(ini, fin), lim, acts[e.i].cal);
    if (tramo) for (let k = 0; k < tramo.vals.length; k++) out[tramo.desde + k] += tramo.vals[k];
  }
  return out;
}
