/**
 * Vista fija del reporte estándar de Inteligencia: las secciones, tablas e indicadores
 * son siempre los mismos; solo cambian las cifras y el análisis.
 */
import React from 'react';
import type { ReporteIA, KpisReporte, EstadoGeneral, Prioridad } from '../types/reporteIA';
import { fmtNum, fmtM } from '../utils/reporteTexto';

const ESTADO_CLS: Record<EstadoGeneral, string> = {
  'En control': 'bg-emerald-50 text-emerald-800 border-emerald-300',
  'Requiere atención': 'bg-amber-50 text-amber-800 border-amber-300',
  'Crítico': 'bg-red-50 text-red-700 border-red-300',
};

const PRIORIDAD_CLS: Record<Prioridad, string> = {
  Alta: 'bg-red-50 text-red-700 border-red-200',
  Media: 'bg-amber-50 text-amber-800 border-amber-200',
  Baja: 'bg-slate-100 text-slate-700 border-slate-300',
};

const signo = (v: number) => (v > 0 ? '+' : '');
const colorVar = (v: number) => (Math.abs(v) < 1 ? 'text-gray-500' : v > 0 ? 'text-emerald-700' : 'text-red-600');

/** Sección con barra de título clara (mismo estilo que las tarjetas de la app). */
const Seccion: React.FC<{ n: number; titulo: string; nota?: string; children: React.ReactNode }> = ({ n, titulo, nota, children }) => (
  <section data-pdf-bloque className="border border-[#D5DEE2] rounded-xl bg-white">
    <div className="px-4 py-2 bg-[#F5F8F9] border-b border-[#D5DEE2] rounded-t-xl flex items-baseline gap-2">
      <span className="text-[11px] font-['Barlow_Condensed'] font-semibold text-[#14212A] uppercase tracking-wider">{n}. {titulo}</span>
      {nota && <span className="text-[11px] text-[#5A6A74]">{nota}</span>}
    </div>
    <div className="p-4 space-y-3">{children}</div>
  </section>
);

const Parrafo: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[13px] leading-relaxed text-[#14212A]">{children}</p>
);

const Lista: React.FC<{ items: React.ReactNode[] }> = ({ items }) =>
  items.length ? (
    <ul className="list-disc pl-5 space-y-1 text-[13px] text-[#14212A]">
      {items.map((x, i) => <li key={i}>{x}</li>)}
    </ul>
  ) : null;

const Tabla: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="overflow-x-auto border border-[#e2e2e0] rounded-lg">
    <table className="min-w-full">{children}</table>
  </div>
);

/** Indicador con su cambio respecto del reporte anterior. `mejorSiSube` define el color del cambio. */
const Kpi: React.FC<{
  titulo: string; valor: string; detalle?: string;
  actual?: number; previo?: number; mejorSiSube?: boolean; neutro?: boolean; fmtDelta?: (v: number) => string;
}> = ({ titulo, valor, detalle, actual, previo, mejorSiSube = true, neutro = false, fmtDelta = v => fmtNum(v) }) => {
  const delta = actual !== undefined && previo !== undefined ? actual - previo : undefined;
  const bueno = delta !== undefined && (mejorSiSube ? delta > 0 : delta < 0);
  return (
    <div className="border border-[#D5DEE2] rounded-xl bg-white p-3">
      <div className="text-[11px] text-[#5A6A74]">{titulo}</div>
      <div className="text-xl font-semibold text-[#14212A] mt-0.5">{valor}</div>
      {detalle && <div className="text-[11px] text-[#5A6A74]">{detalle}</div>}
      {delta !== undefined && (
        <div className={`text-[11px] mt-1 ${Math.abs(delta) < 1e-9 || neutro ? 'text-gray-500' : bueno ? 'text-emerald-700' : 'text-red-600'}`}>
          {Math.abs(delta) < 1e-9 ? 'Sin cambio' : `${delta > 0 ? '▲' : '▼'} ${signo(delta)}${fmtDelta(delta)}`} vs. anterior
        </div>
      )}
    </div>
  );
};

const ETAPAS = [
  { k: 'fabricacion', label: 'Fabr.', color: '#A86B12' },
  { k: 'flete', label: 'Flete', color: '#2C67A6' },
  { k: 'instalacion', label: 'Inst.', color: '#2B7F52' },
] as const;

const Barra: React.FC<{ pct: number; color: string; alto?: string }> = ({ pct, color, alto = 'h-1.5' }) => (
  <div className={`${alto} bg-[#E3E8EB] rounded-full overflow-hidden`}>
    <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(pct, 100))}%`, background: color }} />
  </div>
);

/** Tarjeta del bloque ejecutivo: título, cifra grande, barra opcional y detalle. */
const Tarjeta: React.FC<{ titulo: string; valor: string; color?: string; pct?: number; barColor?: string; detalle?: React.ReactNode; extra?: React.ReactNode }> = ({
  titulo, valor, color = 'text-[#14212A]', pct, barColor = '#442dd7', detalle, extra,
}) => (
  <div className="border border-[#D5DEE2] rounded-xl bg-white p-3 flex flex-col gap-1">
    <div className="text-[10px] font-semibold text-[#5A6A74] uppercase tracking-wider">{titulo}</div>
    <div className={`text-[22px] leading-tight font-semibold ${color}`}>{valor}</div>
    {pct !== undefined && <Barra pct={pct} color={barColor} />}
    {detalle && <div className="text-[11px] text-[#5A6A74] leading-snug">{detalle}</div>}
    {extra}
  </div>
);

const deltaPts = (actual?: number, previo?: number) => {
  if (actual === undefined || previo === undefined) return null;
  const d = actual - previo;
  if (Math.abs(d) < 0.005) return <div className="text-[11px] text-gray-500">Sin cambio vs. anterior</div>;
  return <div className={`text-[11px] ${d > 0 ? 'text-emerald-700' : 'text-red-600'}`}>{d > 0 ? '▲ +' : '▼ '}{d.toFixed(2)} pts vs. anterior</div>;
};

/** "El proyecto de un vistazo": avance de obra y certificación, saldos, excedentes, componentes y equipos. */
const BloqueEjecutivo: React.FC<{ reporte: ReporteIA; paraPdf?: boolean }> = ({ reporte, paraPdf }) => {
  const e = reporte.datos.ejecutivo;
  if (!e) return null;
  const { obra, certificacion: c, equipos, componentes } = e;
  const ant = reporte.anterior;
  return (
    <section className="space-y-3">
      <div data-pdf-bloque className="space-y-3">
      <div className="text-[11px] font-['Barlow_Condensed'] font-semibold text-[#14212A] uppercase tracking-wider">El proyecto de un vistazo</div>
      <div className={`grid gap-2 ${paraPdf ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6'}`}>
        <Tarjeta titulo="Avance de obra" valor={`${obra.avance.toFixed(2)}%`} color="text-[#2B7F52]" pct={obra.avance} barColor="#2B7F52"
          detalle={<>{fmtM(obra.ejecutado)} ejecutado de {fmtM(obra.contrato)}</>} extra={deltaPts(obra.avance, ant?.obraAvance)} />
        {c && (
          <Tarjeta titulo="Avance de certificación" valor={`${c.avance.toFixed(2)}%`} color="text-[#442dd7]" pct={c.avance}
            detalle={<>{fmtM(c.certificado)} planillado de {fmtM(c.contrato)}</>} extra={deltaPts(c.avance, ant?.certificacionAvance)} />
        )}
        <Tarjeta titulo="Por ejecutar" valor={fmtM(obra.porEjecutar)} color="text-[#A86B12]"
          detalle={<>{obra.contrato > 0 ? ((obra.porEjecutar / obra.contrato) * 100).toFixed(1) : '0'}% del contrato</>} />
        {c && (
          <Tarjeta titulo="Por certificar" valor={fmtM(c.porCertificar)} color="text-[#A86B12]"
            detalle={<>{c.contrato > 0 ? ((c.porCertificar / c.contrato) * 100).toFixed(1) : '0'}% del contrato de la planilla
              {c.saldoPlanilla !== undefined && <><br />Saldo por planillar (Sabana, con excedentes): {fmtM(c.saldoPlanilla)}</>}</>} />
        )}
        <Tarjeta titulo="Excedentes" valor={`${signo(obra.excedentes)}${fmtM(obra.excedentes)}`}
          color={obra.excedentes < 0 ? 'text-[#442dd7]' : 'text-red-600'}
          detalle={<>Obra: {obra.excedentes < 0 ? 'ahorro frente al contrato' : 'sobreejecución'}{c ? <><br />Certificación: {signo(c.excedentes)}{fmtM(c.excedentes)}</> : null}</>} />
        {c && (
          <Tarjeta titulo="Última certificación" valor={fmtM(c.ultimaCertificacion)} detalle="monto de esta planilla" />
        )}
      </div>
      </div>

      <div className={`grid gap-2 ${paraPdf ? 'grid-cols-1' : 'lg:grid-cols-2'}`}>
        {equipos && (
          <div data-pdf-bloque className="border border-[#D5DEE2] rounded-xl bg-white p-3">
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <span className="text-[10px] font-semibold text-[#5A6A74] uppercase tracking-wider">Avance de equipos</span>
              <span className="text-[11px] text-[#5A6A74]">{fmtNum(equipos.total.equipos)} equipos · {fmtNum(equipos.total.partidas)} partidas</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              {ETAPAS.map(et => (
                <div key={et.k}>
                  <div className="flex justify-between text-[11px]"><span className="text-[#5A6A74]">{et.label === 'Fabr.' ? 'Fabricación' : et.label === 'Inst.' ? 'Instalación' : 'Flete'}</span><b className="text-[#14212A]">{equipos.total[et.k].toFixed(0)}%</b></div>
                  <Barra pct={equipos.total[et.k]} color={et.color} alto="h-2" />
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              {equipos.areas.map(a => (
                <div key={a.area} data-pdf-fila className="grid grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))] items-center gap-2 text-[11px]">
                  <span className="truncate font-semibold text-[#14212A]" title={`${a.area} · ${a.estructuras} estructuras · ${a.partidas} partidas · ${fmtNum(a.equipos)} equipos`}>{a.area}</span>
                  {ETAPAS.map(et => (
                    <div key={et.k} title={`${et.label} ${a[et.k].toFixed(1)}%`}>
                      <div className="flex justify-between text-[10px] text-[#5A6A74]"><span>{et.label}</span><b className="text-[#14212A]">{a[et.k].toFixed(0)}%</b></div>
                      <Barra pct={a[et.k]} color={et.color} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
        {componentes.length > 0 && (
          <div data-pdf-bloque className="border border-[#D5DEE2] rounded-xl bg-white p-3">
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <span className="text-[10px] font-semibold text-[#5A6A74] uppercase tracking-wider">Avance por componente</span>
              <span className="text-[11px] text-[#5A6A74]">ejecutado sobre contrato</span>
            </div>
            <div className="space-y-1.5">
              {componentes.map(cp => (
                <div key={cp.nombre} data-pdf-fila className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_52px_minmax(0,1fr)] items-center gap-2 text-[11px]">
                  <span className="truncate font-semibold text-[#14212A]" title={cp.nombre}>{cp.nombre}</span>
                  <Barra pct={cp.avance} color="#442dd7" alto="h-2" />
                  <b className="text-right text-[#14212A]">{cp.avance.toFixed(1)}%</b>
                  <span className="text-right text-[#5A6A74] whitespace-nowrap">{fmtM(cp.ejecutado)} / {fmtM(cp.contrato)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export const ReporteEstandar: React.FC<{ reporte: ReporteIA; paraPdf?: boolean }> = ({ reporte, paraPdf = false }) => {
  const { datos: d, analisis: a, anterior } = reporte;
  const k = d.kpis;
  const p: Partial<KpisReporte> = anterior?.kpis || {};
  const maxProx = Math.max(1, ...d.proximas.map(x => x.actividades));
  const pctEjec = k.ventaPlan > 0 ? (k.ventaEjecutada / k.ventaPlan) * 100 : 0;
  const [verTodosEquipos, setVerTodosEquipos] = React.useState(false);
  const equipos = verTodosEquipos || paraPdf ? d.equipamiento : d.equipamiento.slice(0, 15);
  const comentarioArea = new Map(a.retrasos.areasCriticas.map(x => [x.area.toLowerCase(), x.comentario]));

  return (
    <div className="ht-theme space-y-4">
      {/* Encabezado */}
      <div data-pdf-bloque className="flex flex-wrap items-center gap-3">
        <span className={`px-3 py-1 rounded-full border text-[12px] font-semibold ${ESTADO_CLS[a.estadoGeneral] || ESTADO_CLS['Requiere atención']}`}>
          Estado general: {a.estadoGeneral}
        </span>
        <span className="text-[12px] text-[#5A6A74]">Fecha de corte: <strong className="text-[#14212A]">{d.fechaCorte}</strong></span>
        {anterior && (
          <span className="text-[12px] text-[#5A6A74]">Comparado con el reporte del {anterior.fechaCorte}</span>
        )}
      </div>

      <BloqueEjecutivo reporte={reporte} paraPdf={paraPdf} />

      {/* Indicadores del cronograma */}
      <div data-pdf-bloque className="space-y-3">
      <div className="text-[11px] font-['Barlow_Condensed'] font-semibold text-[#14212A] uppercase tracking-wider pt-1">Indicadores del cronograma</div>
      <div className={`grid gap-2 ${paraPdf ? 'grid-cols-5' : 'grid-cols-2 lg:grid-cols-5'}`}>
        <Kpi titulo="Actividades retrasadas" valor={fmtNum(k.retrasadas)} detalle={`de ${fmtNum(k.totalActividades)} actividades`}
          actual={k.retrasadas} previo={p.retrasadas} mejorSiSube={false} />
        <Kpi titulo="Próximas 4 semanas" valor={fmtNum(k.proximas4Semanas)} detalle="actividades programadas"
          actual={k.proximas4Semanas} previo={p.proximas4Semanas} neutro />
        <Kpi titulo="Ejecutado vs. planificado" valor={`${pctEjec.toFixed(1)}%`}
          detalle={`${fmtM(k.ventaEjecutada)} de ${fmtM(k.ventaPlan)} · variación ${signo(k.variacion)}${fmtM(k.variacion)}`}
          actual={k.variacion} previo={p.variacion} fmtDelta={fmtM} />
        <Kpi titulo="Partidas con desvío > 10,000" valor={fmtNum(k.partidasCriticas)} detalle={`${fmtM(k.montoCritico)} de desvío`}
          actual={k.partidasCriticas} previo={p.partidasCriticas} mejorSiSube={false} />
        <Kpi titulo="Equipos por instalar" valor={fmtNum(k.equiposPendientes)} detalle={`en ${fmtNum(k.partidasEquipos)} partidas`}
          actual={k.equiposPendientes} previo={p.equiposPendientes} mejorSiSube={false} />
      </div>
      </div>

      <Seccion n={1} titulo="Resumen ejecutivo">
        <Parrafo>{a.resumenEjecutivo}</Parrafo>
        <Lista items={a.puntosClave} />
        <div className="text-[12px] text-[#5A6A74] border-t border-[#EEF2F3] pt-2">
          <strong className="text-[#14212A]">Evolución:</strong> {a.comparacionAnterior}
        </div>
      </Seccion>

      <Seccion n={2} titulo="Retraso económico por tipología" nota="venta planificada vs. ejecutada a la fecha de corte">
        <Tabla>
          <thead><tr>
            <th className="text-left">Tipología</th><th className="text-right">Venta plan</th><th className="text-right">Venta ejecutada</th>
            <th className="text-right">Variación</th><th className="text-right">% avance</th><th className="text-right">Partidas &gt; 10k</th>
          </tr></thead>
          <tbody>
            {d.tipologias.map(t => (
              <tr key={t.nombre}>
                <td>{t.nombre}</td>
                <td className="text-right">{fmtNum(t.ventaPlan)}</td>
                <td className="text-right">{fmtNum(t.ventaEjecutada)}</td>
                <td className={`text-right ${colorVar(t.variacion)}`}>{signo(t.variacion)}{fmtNum(t.variacion)}</td>
                <td className="text-right">{t.pctAvance.toFixed(1)}%</td>
                <td className="text-right">{t.criticas || '—'}</td>
              </tr>
            ))}
            <tr className="ht-g lv0">
              <td>TOTAL</td>
              <td className="text-right">{fmtNum(k.ventaPlan)}</td>
              <td className="text-right">{fmtNum(k.ventaEjecutada)}</td>
              <td className="text-right">{signo(k.variacion)}{fmtNum(k.variacion)}</td>
              <td className="text-right">{pctEjec.toFixed(1)}%</td>
              <td className="text-right">{k.partidasCriticas}</td>
            </tr>
          </tbody>
        </Tabla>
        {d.partidasCriticas.length > 0 && (
          <>
            <div className="text-[12px] font-semibold text-[#14212A]">Partidas con mayor desvío negativo</div>
            <Tabla>
              <thead><tr>
                <th className="text-left">Activity ID</th><th className="text-left">Descripción</th><th className="text-left">Tipología</th>
                <th className="text-right">Venta plan</th><th className="text-right">Ejecutada</th><th className="text-right">Variación</th><th className="text-left">Estado</th>
              </tr></thead>
              <tbody>
                {d.partidasCriticas.map((x, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap">{x.activityId}</td>
                    <td className="max-w-[280px] truncate" title={x.descripcion}>{x.descripcion}</td>
                    <td>{x.tipologia}</td>
                    <td className="text-right">{fmtNum(x.ventaPlan)}</td>
                    <td className="text-right">{fmtNum(x.ventaEjecutada)}</td>
                    <td className="text-right text-red-600">{fmtNum(x.variacion)}</td>
                    <td className="whitespace-nowrap">{x.estado}</td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          </>
        )}
        <Parrafo>{a.economico.analisis}</Parrafo>
        <Lista items={a.economico.hallazgos} />
      </Seccion>

      <Seccion n={3} titulo="Actividades retrasadas por área">
        <Tabla>
          <thead><tr>
            <th className="text-left">Área</th><th className="text-right">Retrasadas</th><th className="text-right">Máx. días de atraso</th><th className="text-left">Comentario</th>
          </tr></thead>
          <tbody>
            {d.retrasos.map(x => (
              <tr key={x.area}>
                <td className="whitespace-nowrap">{x.area}</td>
                <td className="text-right">{fmtNum(x.retrasadas)}</td>
                <td className="text-right">{fmtNum(x.maxDiasAtraso)}</td>
                <td className="text-[12px] text-[#5A6A74]">{comentarioArea.get(x.area.toLowerCase()) || ''}</td>
              </tr>
            ))}
            {d.retrasos.length === 0 && <tr><td colSpan={4} className="text-center text-gray-500">Sin actividades retrasadas.</td></tr>}
          </tbody>
        </Tabla>
        <Parrafo>{a.retrasos.analisis}</Parrafo>
        <Lista items={a.retrasos.areasCriticas
          .filter(x => !d.retrasos.some(r => r.area.toLowerCase() === x.area.toLowerCase()))
          .map(x => <><strong>{x.area}:</strong> {x.comentario}</>)} />
      </Seccion>

      <Seccion n={4} titulo="Próximas 4 semanas por área" nota="actividades programadas">
        <div className="space-y-1.5">
          {d.proximas.map(x => (
            <div key={x.area} data-pdf-fila className="grid grid-cols-[minmax(120px,220px)_1fr_48px] items-center gap-2 text-[12px]">
              <span className="truncate text-[#14212A]" title={x.area}>{x.area}</span>
              <div className="h-3.5 bg-[#EEF2F3] rounded">
                <div className="h-3.5 rounded bg-[#442dd7]" style={{ width: `${(x.actividades / maxProx) * 100}%` }} />
              </div>
              <span className="text-right font-semibold text-[#14212A]">{fmtNum(x.actividades)}</span>
            </div>
          ))}
        </div>
        <Parrafo>{a.proximas.analisis}</Parrafo>
        <Lista items={a.proximas.compromisos.map(x => <><strong>{x.area}:</strong> {x.compromiso}</>)} />
      </Seccion>

      <Seccion n={5} titulo="Equipos e instrumentos pendientes por SCAP" nota="actividades F no completadas, sin partida D">
        <Tabla>
          <thead><tr>
            <th className="text-left">Tipo</th><th className="text-left">SCAP</th><th className="text-right">Pendiente</th>
            <th className="text-right">Partidas</th><th className="text-right">Avance</th>
          </tr></thead>
          <tbody>
            {equipos.map((e, i) => (
              <tr key={i}>
                <td>{e.tipo}</td>
                <td>{e.scap}</td>
                <td className="text-right whitespace-nowrap">{fmtNum(e.pendiente, 2)} <span className="text-gray-500">{e.unidades}</span></td>
                <td className="text-right">{e.partidas}</td>
                <td className="text-right">{e.avance.toFixed(1)}%</td>
              </tr>
            ))}
            {d.equipamiento.length === 0 && <tr><td colSpan={5} className="text-center text-gray-500">Sin equipos pendientes.</td></tr>}
          </tbody>
        </Tabla>
        {d.equipamiento.length > 15 && !paraPdf && (
          <button type="button" onClick={() => setVerTodosEquipos(v => !v)}
            className="text-[12px] px-3 py-1 rounded-lg border border-[#D5DEE2] bg-white hover:bg-[#F5F8F9] cursor-pointer">
            {verTodosEquipos ? 'Ver solo los 15 primeros' : `Ver todos (${d.equipamiento.length})`}
          </button>
        )}
        <Parrafo>{a.equipamiento.analisis}</Parrafo>
      </Seccion>

      <Seccion n={6} titulo="Recomendaciones y plan de acción">
        <Tabla>
          <thead><tr>
            <th className="text-left">Prioridad</th><th className="text-left">Acción</th><th className="text-left">Área</th><th className="text-left">Plazo</th>
          </tr></thead>
          <tbody>
            {a.recomendaciones.map((x, i) => (
              <tr key={i}>
                <td><span className={`px-1.5 py-0.5 rounded border text-[11px] font-semibold ${PRIORIDAD_CLS[x.prioridad] || PRIORIDAD_CLS.Media}`}>{x.prioridad}</span></td>
                <td className="text-[13px]">{x.accion}</td>
                <td className="whitespace-nowrap">{x.area}</td>
                <td className="whitespace-nowrap">{x.plazo}</td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      </Seccion>

      <p data-pdf-bloque className="text-[11px] text-[#5A6A74]">
        Cifras calculadas por la aplicación a partir del cronograma cargado. Análisis redactado por Claude ({reporte.modelo}).
      </p>
    </div>
  );
};
