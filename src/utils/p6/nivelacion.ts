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
}

const ACTIVA = (a: ActividadCpm) => a.estado !== 'Terminada';

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
  const externas = rels.filter(r => !(set.has(r.pred) && set.has(r.succ)));
  const libre = simular(m, acts, externas, conjunto);
  const disp = libre.ini;
  const tarde = new Map<number, number>();
  {
    const copia = acts.map(a => ({ ...a }));
    programar(copia, externas, { fechaDatos: m.fechaDatos, finProyecto: m.finProyecto, lagSsDesdeInicioTemprano: lagSsDesdeInicioTemprano(m) });
    for (const i of conjunto) tarde.set(i, copia[i].LS ?? copia[i].ES ?? 0);
  }

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
  const sinCant = elementos.filter(e => !e.cant && ACTIVA(acts[e.i]));
  if (sinCant.length) hallazgos.push(`Without units (Remaining Units = 0), they do not count in the histogram: ${sinCant.map(e => e.cod).join(', ')}`);
  return { elementos, antes, internos, disp, tarde, hallazgos };
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
  const pendientes = new Set(d.elementos.filter(e => ACTIVA(acts[e.i])).map(e => e.i));
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
  // Las actividades en curso siguen con su cuadrilla desde ya (las más urgentes primero)
  [...pendientes].filter(i => acts[i].estado === 'EnCurso').sort((a, b) => urg(a) - urg(b)).forEach((i, n) => {
    if (n < cuadrillas) { const f = fechas(i, m.fechaDatos); asignar(i, n, f.ini, f.fin); }
  });

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
      lista.sort((a, b) => porI.get(a)!.tipo.localeCompare(porI.get(b)!.tipo) || urg(a) - urg(b));
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
  const externas = rels.filter(r => !(set.has(r.pred) && set.has(r.succ)));
  const succs: number[][] = acts.map(() => []);
  for (const r of externas) succs[r.pred].push(r.succ);
  const alcanza = (desde: number, hasta: number) => {
    const visto = new Uint8Array(acts.length), pila = [desde];
    while (pila.length) { const x = pila.pop()!; if (x === hasta) return true; if (visto[x]) continue; visto[x] = 1; for (const y of succs[x]) if (!visto[y]) pila.push(y); }
    return false;
  };
  const agregar: NuevaRel[] = [], omitidos: [number, number][] = [];
  for (const sec of secuencias) for (let n = 1; n < sec.length; n++) {
    const a = sec[n - 1], b = sec[n];
    if (alcanza(b.i, a.i)) { omitidos.push([a.i, b.i]); continue; }
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
  const todas: Rel[] = [...externas, ...agregar.map(r => ({ pred: r.pred, succ: r.succ, tipo: r.tipo, lag: r.lag }))];
  const despues = simular(m, acts, todas, d.elementos.map(e => e.i));
  const abiertas = d.elementos.map(e => e.i).filter(i => ACTIVA(acts[i]) && !conSucc.has(i));
  return { cuadrillas, tope, secuencias, quitar: d.internos, agregar, omitidos, abiertas, despues };
}

/** Peor holgura total (en minutos de trabajo) de las actividades pendientes del conjunto. */
export function peorHolgura(r: Resultado): number {
  let x = Infinity;
  for (const v of r.holgura.values()) if (v != null && v < x) x = v;
  return x;
}

export interface Evaluacion { op: OpcionesPropuesta; prop: Propuesta; hist: Float64Array; pico: number; desv: number; viable: boolean }

/** Pico y desviación de los meses con carga. */
export function picoYDesv(h: Float64Array): { pico: number; desv: number } {
  const v = [...h].filter(x => x > 0.01);
  if (!v.length) return { pico: 0, desv: 0 };
  const mu = v.reduce((a, b) => a + b, 0) / v.length;
  return { pico: Math.max(...v), desv: Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / v.length) };
}

/**
 * Busca cuántas cuadrillas y qué tope mensual dan el histograma más plano SIN empeorar:
 * el fin del conjunto, el fin del proyecto ni la peor holgura del conjunto.
 */
export function buscarMejor(m: ModeloP6, d: Diagnostico, maxCuadrillas = 6): { mejor: Evaluacion | null; probadas: Evaluacion[] } {
  const lim = meses(m.fechaDatos);
  const total = d.elementos.reduce((a, e) => a + e.cant, 0);
  const finBase = d.antes.finConjunto, proyBase = d.antes.finProyecto, holgBase = peorHolgura(d.antes);
  const nMeses = Math.max(1, lim.filter(x => x < finBase).length);
  const base = total / nMeses;
  const topes = [Infinity, ...[1, 1.1, 1.2, 1.35, 1.5, 1.75, 2, 2.5].map(f => Math.ceil(base * f))];
  const probadas: Evaluacion[] = [];
  let mejor: Evaluacion | null = null;
  for (let n = 1; n <= maxCuadrillas; n++) for (const tope of topes) {
    const op = { cuadrillas: n, tope };
    const prop = proponer(m, d, op);
    const hist = histograma(m, d, prop.despues, lim);
    const { pico, desv } = picoYDesv(hist);
    const viable = prop.despues.finConjunto <= finBase && prop.despues.finProyecto <= proyBase && peorHolgura(prop.despues) >= holgBase;
    const ev = { op, prop, hist, pico, desv, viable };
    probadas.push(ev);
    if (viable && (!mejor || pico < mejor.pico - 0.5 || (Math.abs(pico - mejor.pico) <= 0.5 && (desv < mejor.desv - 0.5 || (Math.abs(desv - mejor.desv) <= 0.5 && n < mejor.op.cuadrillas))))) mejor = ev;
  }
  return { mejor, probadas };
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
    if (!ACTIVA(acts[e.i]) || !e.cant) continue;
    const ini = Math.max(r.ini.get(e.i) ?? 0, m.fechaDatos), fin = r.fin.get(e.i) ?? ini;
    const tramo = repartir(e.cant, ini, Math.max(ini, fin), lim, acts[e.i].cal);
    if (tramo) for (let k = 0; k < tramo.vals.length; k++) out[tramo.desde + k] += tramo.vals[k];
  }
  return out;
}
