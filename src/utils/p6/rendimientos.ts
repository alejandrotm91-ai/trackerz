/**
 * Rendimientos de montaje y pruebas (horas-hombre por unidad) para las partidas de instalación de
 * equipos (grupo 04.Precom_Eq). Rangos habituales de los manuales de estimación de montaje (Page,
 * Richardson/Compass, RSMeans, NAVFAC P-405) y de la experiencia en plantas de agua; antes del factor
 * de productividad local. Es la misma tabla del informe «Recursos para instalar el equipamiento».
 */
export type Disciplina = 'Mecánica' | 'Eléctrica' | 'I&C' | 'Tubería' | 'Civil';
export const DISCIPLINAS: Disciplina[] = ['Mecánica', 'Eléctrica', 'I&C', 'Tubería', 'Civil'];

/** Personas por cuadrilla tipo de cada disciplina (las del informe). */
export const CUADRILLA_DISCIPLINA: Record<Disciplina, number> = { 'Mecánica': 5, 'Eléctrica': 4, 'I&C': 3, 'Tubería': 5, 'Civil': 4 };
/** Composición de cada cuadrilla tipo, para mostrarla. */
export const COMPOSICION: Record<Disciplina, string> = {
  'Mecánica': 'lead fitter, 2 fitters, fitter/welder, helper',
  'Eléctrica': 'lead electrician, 2 electricians, helper',
  'I&C': 'instrument tech, loop-check tech, helper',
  'Tubería': 'lead pipefitter, welder, fitter, 2 helpers',
  'Civil': 'lead, 2 workers, helper',
};
/** Factor de productividad local frente a los manuales (clima de la costa, logística, aprendizaje). */
export const FACTOR_LOCAL = 1.3;

export const DISCIPLINA_DE_COMPONENTE: Record<string, Disciplina> = {
  '03. mecanico': 'Mecánica', '02. tuberias': 'Tubería', '04. electrico': 'Eléctrica', '05. i&c': 'I&C', '01. civil': 'Civil',
};

type Regla = [Disciplina, string, RegExp, string | null, [number, number, number]];
const r = (d: Disciplina, cat: string, rx: string, ud: string | null, hh: [number, number, number]): Regla => [d, cat, new RegExp(rx, 'i'), ud, hh];

const REGLAS: Regla[] = [
  // Mecánica
  r('Mecánica', 'Compuertas de tablones', 'tablon', 'u', [8, 12, 18]),
  r('Mecánica', 'Compuertas vertedero', 'compuert.*vertedero|vertedero', 'u', [16, 24, 32]),
  r('Mecánica', 'Compuertas grandes / motorizadas', 'compuert.*(1800|motoriz|control automatico|canal 16)', 'u', [40, 60, 80]),
  r('Mecánica', 'Compuertas deslizantes / otras', 'compuert|esclusa|charnela', 'u', [24, 32, 48]),
  r('Mecánica', 'Bombas grandes (≥ 100 kW)', '250 ?hp|bombas principales|booster de \\d{3} ?kw|bombas sumergibles de la estacion|estacion de bombeo n', 'u', [60, 100, 140]),
  r('Mecánica', 'Bombas de cavidad progresiva', 'cavidad progresiva', 'u', [32, 40, 60]),
  r('Mecánica', 'Bombas sumergibles y pequeñas', 'sumergible|sumidero|autocebante|trituradora|engranaje|riego|1\\.5 ?kw|3/4 ?hp|espuma|presuriz', 'u', [12, 16, 24]),
  r('Mecánica', 'Bombas centrífugas horizontales', 'centrifug|booster|agua.q|transferencia|mezcla de|calentamiento|alimentacion|bomba', 'u', [24, 32, 48]),
  r('Mecánica', 'Rejas y cribado', 'rejas principales|rejilla|reja|cribado', 'u', [80, 120, 160]),
  r('Mecánica', 'Puentes grúa', 'puente grua', null, [120, 160, 240]),
  r('Mecánica', 'Polipastos, monorrieles y grúas', 'polipasto|monorriel|grua|cuchara|izaje', null, [16, 32, 48]),
  r('Mecánica', 'Polímero y dosificación', 'polimero|dosificacion|fecl3|desinfeccion|hipoclorito|prensa banda', null, [32, 48, 80]),
  r('Mecánica', 'Agitadores y mezcladores', 'agitador|mezcla|mezclador', null, [16, 48, 80]),
  r('Mecánica', 'Sopladores', 'soplador', 'u', [60, 100, 140]),
  r('Mecánica', 'Generadores a biogás 650 kW', 'generador con motor a gas|650 ?kw', 'u', [300, 400, 600]),
  r('Mecánica', 'Bandas transportadoras', 'banda transportadora', 'u', [80, 120, 200]),
  r('Mecánica', 'Sistemas de control de olores', 'control de olores|olores', null, [150, 240, 360]),
  r('Mecánica', 'Cubiertas y domos', 'cubierta|domo', null, [200, 320, 480]),
  r('Mecánica', 'Barredores de lodos / pilar central', 'barrelodos|barrido|pilar central', null, [400, 600, 900]),
  r('Mecánica', 'Válvulas y medidores grandes', 'valvula|venturi|flow meter', null, [12, 24, 40]),
  r('Mecánica', 'Gasómetro, tea y limpieza de biogás', 'gasometro|\\btea\\b|limpieza de biogas|h2s', null, [100, 200, 320]),
  r('Mecánica', 'Calderas e intercambiadores', 'caldera|intercambiador', null, [40, 60, 100]),
  r('Mecánica', 'Tanques y depósitos', 'tanque|tk\\.', null, [24, 40, 64]),
  r('Mecánica', 'Trituradores, FOG y grasas', 'triturador|fog|grasas', null, [24, 40, 64]),
  r('Mecánica', 'Ventilación y climatización', 'ventilador|ventilacion|climatiz|silenciador|louver', null, [12, 20, 32]),
  r('Mecánica', 'Difusores y pantallas', 'difusor|deflector', 'u', [3, 6, 10]),
  r('Mecánica', 'Escotillas y tapas', 'escotilla', 'm2', [2, 4, 6]),
  r('Mecánica', 'Misceláneos mecánicos', '.', null, [16, 32, 60]),
  // Tubería
  r('Tubería', 'Tubería GRP/HD DN ≥ 1000 mm', '(grp|hd|hierro).*(2400|1500|1400|1000|900)|dn 2400|dn 1500|1000 mm', 'm', [2.5, 3.5, 5]),
  r('Tubería', 'Tubería GRP/HD DN 300–600 mm', 'tuberia', 'm', [0.8, 1.4, 2]),
  r('Tubería', 'Tubería y accesorios (global)', 'tuberia|accesorios|montaje del plano', null, [80, 160, 300]),
  // Eléctrica
  r('Eléctrica', 'Subestación: disyuntores 69 kV', 'disyuntor|interruptor sf6|interruptor de potencia de 69', null, [40, 60, 90]),
  r('Eléctrica', 'Subestación: seccionadores', 'seccionador', null, [16, 24, 40]),
  r('Eléctrica', 'Subestación: transformadores de medida', '(transformador(es)?|trans\\.) de (corriente|potencial)', null, [8, 12, 20]),
  r('Eléctrica', 'Subestación: pararrayos, aisladores y acometida', 'pararrayos|ensambles|acometida a 138', null, [4, 6, 10]),
  r('Eléctrica', 'Subestación: estructuras metálicas', 'estructura', 'ton', [24, 40, 60]),
  r('Eléctrica', 'Subestación: casa de control, barras y circuitos', '69 ?kv|138 ?kv|barraje|apantallamiento|casa control|cargador y banco|circuitos|llegada', null, [24, 40, 80]),
  r('Eléctrica', 'Celdas de media tensión', 'celda|switchgear|metal clad', 'u', [16, 24, 40]),
  r('Eléctrica', 'CCM (centros de control de motores)', '\\bmcc\\b|centro de control de motores', null, [60, 100, 160]),
  r('Eléctrica', 'Transformadores de potencia/distribución', 'transfo', 'u', [24, 48, 80]),
  r('Eléctrica', 'Generadores diésel / transferencia', 'generador|transferencia|insonoriz', null, [40, 100, 160]),
  r('Eléctrica', 'Variadores de frecuencia', 'variador', 'u', [12, 24, 60]),
  r('Eléctrica', 'UPS', '\\bups\\b', 'u', [8, 16, 24]),
  r('Eléctrica', 'Tableros de distribución y protección', 'tablero|tvss|centro de carga|interruptor|\\bpd-|\\btds-|\\btd-|\\btcl|\\btdp', 'u', [8, 16, 24]),
  r('Eléctrica', 'Alumbrado exterior (postes)', 'poste|mastil', 'u', [4, 6, 10]),
  r('Eléctrica', 'Alimentadores y conductores', 'alimentador|conductor', 'm', [0.08, 0.12, 0.2]),
  r('Eléctrica', 'Bandejas portacables', 'bandeja', null, [0.4, 0.6, 1]),
  r('Eléctrica', 'Puntos y luminarias interiores', 'puntos de|lampara|avisos|luminaria|reflector', 'u', [1, 1.5, 2.5]),
  r('Eléctrica', 'Puesta a tierra y pararrayos', 'equipotencial|pararrayo|contador de descargas|tierra', null, [2, 4, 8]),
  r('Eléctrica', 'SCADA eléctrico y comunicaciones', 'scada|router|switch|uplink|fibra', null, [1, 3, 6]),
  r('Eléctrica', 'Sensores de flujo (eléctrico)', 'flujo|sensor', 'u', [8, 16, 24]),
  r('Eléctrica', 'Misceláneos eléctricos', '.', null, [8, 16, 32]),
  // Instrumentación y control
  r('I&C', 'Programación PLC/HMI y SCADA', 'programa de desarrollo|licencia|cuaderno|estacion de trabajo|servicio de datos|software de integracion', null, [300, 500, 800]),
  r('I&C', 'Fibra óptica exterior', 'fibra optica exterior|enlace de fibra', 'm', [0.04, 0.06, 0.1]),
  r('I&C', 'Fusiones y conectorizado FO', 'pigtail|fusion|patch|tranceiver|organizador|bandeja de fibra', 'u', [0.3, 0.5, 1]),
  r('I&C', 'Indicadores locales (manómetros, etc.)', 'indicador de presion|indicador de temperatura|indicador de flujo|temporizador|indicacion visual', 'u', [1.5, 2.5, 4]),
  r('I&C', 'Interruptores de proceso', 'interruptor|flotador', 'u', [4, 6, 10]),
  r('I&C', 'Centro de control y servidores', 'switch industrial|servidor|rack|firewall|thin client|videowall|impresora|almacenamiento|piso falso|rampa|malla|paneles perforados|puerta de seguridad|cerradura|extincion|exticion|configuracion|uplink', null, [2, 6, 16]),
  r('I&C', 'Tableros PLC, RIO e interlock', 'panel de control|tablero de control|tablero de interlock|gabinete|\\brio\\b|tableros - control|panel', 'u', [32, 48, 80]),
  r('I&C', 'Botoneras y soportes', 'botonera|caja de control local|soporte de la caja', 'u', [2, 4, 6]),
  r('I&C', 'Medidores de caudal grandes', 'medidor de flujo electromagnetico f|medidor magnetico|medidor de caudal', null, [24, 40, 60]),
  r('I&C', 'Analizadores, detectores y muestreadores', 'automuestr|muestreo|soporte metalico|ph/orp|cloro|tss|oxigeno|h2s|ch4|metano|sulfuro|gas|calidad|analitic', null, [12, 16, 24]),
  r('I&C', 'Caudalímetros en línea', 'flujo electromag|electromag|dispersion termica', 'u', [12, 16, 24]),
  r('I&C', 'Transmisores y sensores', 'transmisor|sensor|radar|ultrason|nivel', 'u', [6, 10, 16]),
  r('I&C', 'Seguridad electrónica', 'seguridad electronica', null, [300, 500, 800]),
  r('I&C', 'Misceláneos I&C', '.', null, [4, 8, 16]),
  // Civil menor
  r('Civil', 'Estructuras metálicas, escaleras y accesos', 'escalera|plataforma|persiana|puerta|cortina|escotilla|tapas', null, [2, 40, 120]),
];

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

export interface Rendimiento { disciplina: Disciplina; categoria: string; hh: [number, number, number] }

/** Categoría y HH por unidad de una partida de instalación (por su componente, SCAP, Unit, descripción y unidad). */
export function rendimientoDe(p: { componente: string; scap: string; unit: string; descripcion: string; unidad: string }): Rendimiento {
  const disc = DISCIPLINA_DE_COMPONENTE[sinTildes(p.componente || '').trim().toLowerCase()] ?? 'Mecánica';
  const texto = sinTildes(`${p.scap}|${p.unit}|${p.descripcion}`);
  let ud = (p.unidad || '').trim().toLowerCase();
  // Kilos: se usan los rendimientos por tonelada (HH por kg = HH por t ÷ 1000)
  const escala = ud === 'kg' ? 1 / 1000 : 1;
  if (ud === 'kg') ud = 'ton';
  for (const [d, cat, rx, u, hh] of REGLAS) {
    if (d !== disc) continue;
    if (u && ud !== u && !(u === 'u' && (ud === 'u' || ud === 'glb'))) continue;
    if (rx.test(texto)) return { disciplina: d, categoria: cat, hh: hh.map(x => x * escala) as [number, number, number] };
  }
  const misc = REGLAS.find(x => x[0] === disc && x[1].startsWith('Misc'));
  return { disciplina: disc, categoria: misc?.[1] ?? 'Misceláneos', hh: misc?.[4] ?? [8, 16, 32] };
}

/** ¿Es una partida de instalación de equipos (grupo 04.Precom_Eq)? */
export const esPrecomEq = (grupo: string) => /^04/.test((grupo || '').trim());
