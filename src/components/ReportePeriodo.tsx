/**
 * Vista del reporte de avance de obra por período: cifras calculadas por la app
 * (como Control de Ejecución con el filtro de semanas) y, si existe, el análisis de Claude.
 */
import React from 'react';
import type { ReportePeriodoDatos, ReportePeriodoAnalisis, EstadoComponente, ResumenPeriodo } from '../types/reportePeriodo';
import type { EstadoGeneral, Prioridad } from '../types/reporteIA';
import { fmtM } from '../utils/reporteTexto';
import { fechaCorta, textoPeriodo } from '../utils/reportePeriodo';

const ESTADO_CLS: Record<EstadoGeneral, string> = {
  'En control': 'bg-emerald-50 text-emerald-800 border-emerald-300',
  'Requiere atención': 'bg-amber-50 text-amber-800 border-amber-300',
  'Crítico': 'bg-red-50 text-red-700 border-red-300',
};
const COMP_CLS: Record<EstadoComponente, string> = {
  'Adelantado': 'bg-emerald-50 text-emerald-800 border-emerald-200',
  'Según plan': 'bg-sky-50 text-sky-800 border-sky-200',
  'Atrasado': 'bg-red-50 text-red-700 border-red-200',
  'Sin actividad': 'bg-slate-100 text-slate-600 border-slate-200',
};
const PRIORIDAD_CLS: Record<Prioridad, string> = {
  Alta: 'bg-red-50 text-red-700 border-red-200',
  Media: 'bg-amber-50 text-amber-800 border-amber-200',
  Baja: 'bg-slate-100 text-slate-700 border-slate-300',
};

const miles = (v: number) => Math.round(v || 0).toLocaleString('en-US');
// Bajo 5.000 se muestra 0.00M sin signo (evita "−0.00M")
const conSigno = (v: number) => (Math.abs(v) < 5000 ? fmtM(0) : `${v > 0 ? '+' : '−'}${fmtM(Math.abs(v))}`);
const colorVar = (v: number, umbral = 5000) => (Math.abs(v) < umbral ? 'text-gray-500' : v > 0 ? 'text-emerald-700' : 'text-red-600');
const pct = (v: number | null) => (v === null ? '—' : `${v.toFixed(1)}%`);
const colorCumpl = (v: number | null) => (v === null ? 'text-gray-500' : v >= 95 ? 'text-emerald-700' : v >= 80 ? 'text-amber-700' : 'text-red-600');

const Seccion: React.FC<{ n: number; titulo: string; nota?: string; children: React.ReactNode }> = ({ n, titulo, nota, children }) => (
  <section data-pdf-bloque className="border border-[#D5DEE2] rounded-xl bg-white">
    <div className="px-4 py-2 bg-[#F5F8F9] border-b border-[#D5DEE2] rounded-t-xl flex items-baseline gap-2 flex-wrap">
      <span className="text-[11px] font-['Barlow_Condensed'] font-semibold text-[#14212A] uppercase tracking-wider">{n}. {titulo}</span>
      {nota && <span className="text-[11px] text-[#5A6A74]">{nota}</span>}
    </div>
    <div className="p-4 space-y-3">{children}</div>
  </section>
);

const Parrafo: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[13px] leading-relaxed text-[#14212A]">{children}</p>
);

const SinAnalisis: React.FC = () => (
  <p className="text-[12px] text-[#5A6A74] italic">El análisis con IA de este período aún no se ha generado.</p>
);

const Barra: React.FC<{ pct: number; color: string; marca?: number }> = ({ pct: p, color, marca }) => (
  <div className="relative h-1.5 bg-[#E3E8EB] rounded-full">
    <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(p, 100))}%`, background: color }} />
    {marca !== undefined && (
      <div className="absolute -top-0.5 w-0.5 h-2.5 bg-[#14212A]" style={{ left: `${Math.max(0, Math.min(marca, 100))}%` }} title={`Planificado acumulado: ${marca.toFixed(1)}%`} />
    )}
  </div>
);

const Tarjeta: React.FC<{ titulo: string; valor: string; color?: string; detalle?: React.ReactNode; children?: React.ReactNode }> = ({ titulo, valor, color = 'text-[#14212A]', detalle, children }) => (
  <div className="border border-[#D5DEE2] rounded-xl bg-white p-3 flex flex-col gap-1">
    <div className="text-[10px] font-semibold text-[#5A6A74] uppercase tracking-wider">{titulo}</div>
    <div className={`text-[22px] leading-tight font-['Barlow_Condensed'] font-semibold ${color}`}>{valor}</div>
    {children}
    {detalle && <div className="text-[11px] text-[#5A6A74] leading-snug">{detalle}</div>}
  </div>
);

const Indicadores: React.FC<{ t: ResumenPeriodo; paraPdf?: boolean }> = ({ t, paraPdf }) => (
  <div data-pdf-bloque className={`grid gap-2 ${paraPdf ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6'}`}>
    <Tarjeta titulo="Planificado del período" valor={fmtM(t.plan)} detalle={`${t.partidas} partidas con movimiento`} />
    <Tarjeta titulo="Ejecutado del período" valor={fmtM(t.ejec)} color="text-[#2B7F52]" detalle={`${t.avancePeriodo.toFixed(2)} pts del contrato`} />
    <Tarjeta titulo="Variación" valor={conSigno(t.variacion)} color={colorVar(t.variacion)} detalle="Ejecutado − planificado" />
    <Tarjeta titulo="Cumplimiento" valor={pct(t.cumplimiento)} color={colorCumpl(t.cumplimiento)} detalle="Ejecutado / planificado">
      {t.cumplimiento !== null && <Barra pct={t.cumplimiento} color={t.cumplimiento >= 95 ? '#2B7F52' : t.cumplimiento >= 80 ? '#A86B12' : '#CD0000'} />}
    </Tarjeta>
    <Tarjeta titulo="Avance acumulado" valor={`${t.avance.toFixed(2)}%`} color="text-[#312E81]" detalle={<>Plan acumulado {t.avancePlan.toFixed(2)}% · {fmtM(t.acumEjec)} de {fmtM(t.contrato)}</>}>
      <Barra pct={t.avance} color="#312E81" marca={t.avancePlan} />
    </Tarjeta>
    <Tarjeta titulo="Brecha acumulada" valor={conSigno(t.acumEjec - t.acumPlan)} color={colorVar(t.acumEjec - t.acumPlan)} detalle={`${(t.avance - t.avancePlan).toFixed(2)} pts frente al plan acumulado`} />
  </div>
);

/** Barras semanales: planificado (gris) y ejecutado (verde) por semana. */
const Semanal: React.FC<{ semanas: ReportePeriodoDatos['porSemana'] }> = ({ semanas }) => {
  const max = Math.max(1, ...semanas.map(s => Math.max(s.plan, s.ejec)));
  const ALTO = 120;
  const pocas = semanas.length <= 12;
  return (
    <div>
      <div className="flex items-end gap-1.5 border-b border-[#D5DEE2] px-1" style={{ height: ALTO + 16 }}>
        {semanas.map(s => (
          <div key={s.semana} className="flex-1 min-w-0 flex items-end justify-center gap-0.5 h-full" title={`Semana del ${fechaCorta(s.semana)}\nPlanificado: ${miles(s.plan)}\nEjecutado: ${miles(s.ejec)}`}>
            <div className="w-1/2 max-w-[22px] bg-[#B8C4CB] rounded-t-sm" style={{ height: Math.max(1, (s.plan / max) * ALTO) }} />
            <div className="w-1/2 max-w-[22px] bg-[#2B7F52] rounded-t-sm" style={{ height: Math.max(1, (s.ejec / max) * ALTO) }} />
          </div>
        ))}
      </div>
      {pocas && (
        <div className="flex gap-1.5 px-1 pt-1">
          {semanas.map(s => (
            <div key={s.semana} className="flex-1 min-w-0 text-center text-[10px] text-[#5A6A74] truncate">{fechaCorta(s.semana).replace(/ \d{4}$/, '')}</div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-4 text-[11px] text-[#5A6A74] mt-2">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#B8C4CB]" />Planificado</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#2B7F52]" />Ejecutado</span>
        {!pocas && <span>{fechaCorta(semanas[0].semana)} → {fechaCorta(semanas[semanas.length - 1].semana)}</span>}
      </div>
    </div>
  );
};

const TablaPartidas: React.FC<{ filas: ReportePeriodoDatos['destacadas'] }> = ({ filas }) => (
  <div className="overflow-x-auto border border-[#e2e2e0] rounded-lg">
    <table className="min-w-full cvs-tabla">
      <thead>
        <tr>
          <th className="text-left">Partida</th>
          <th className="text-left">Descripción</th>
          <th className="text-left">Componente</th>
          <th className="text-right">Planificado</th>
          <th className="text-right">Ejecutado</th>
          <th className="text-right">Variación</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((p, i) => (
          <tr key={i}>
            <td className="text-[11px] text-gray-500">{p.codigo}</td>
            <td className="max-w-[320px] truncate" title={p.descripcion}>{p.descripcion}</td>
            <td className="text-[11px]">{p.componente}</td>
            <td className="text-right">{miles(p.plan)}</td>
            <td className="text-right text-green-700">{miles(p.ejec)}</td>
            <td className={`text-right font-semibold ${colorVar(p.variacion, 1)}`}>{p.variacion > 0 ? '+' : ''}{miles(p.variacion)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const ReportePeriodo: React.FC<{
  datos: ReportePeriodoDatos;
  analisis?: ReportePeriodoAnalisis | null;
  paraPdf?: boolean;
}> = ({ datos, analisis, paraPdf }) => {
  const t = datos.total;
  const porComp = new Map((analisis?.componentes || []).map(c => [c.componente, c]));
  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div data-pdf-bloque className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-['Barlow_Condensed'] font-semibold text-[#5A6A74] uppercase tracking-wider">Avance de obra del período</div>
          <div className="text-[16px] font-semibold text-[#14212A]">{textoPeriodo(datos.desde, datos.hasta, datos.semanas.length)}</div>
          {analisis?.titular && <div className="text-[13px] text-[#14212A] mt-0.5">{analisis.titular}</div>}
        </div>
        {analisis && (
          <span className={`px-2.5 py-1 rounded-full border text-[12px] font-semibold ${ESTADO_CLS[analisis.estadoGeneral]}`}>{analisis.estadoGeneral}</span>
        )}
      </div>

      <Indicadores t={t} paraPdf={paraPdf} />

      <Seccion n={1} titulo="Resumen ejecutivo">
        {analisis ? (
          <>
            <Parrafo>{analisis.resumenEjecutivo}</Parrafo>
            {analisis.puntosClave.length > 0 && (
              <ul className="list-disc pl-5 space-y-1 text-[13px] text-[#14212A]">
                {analisis.puntosClave.map((x, i) => <li key={i}>{x}</li>)}
              </ul>
            )}
          </>
        ) : <SinAnalisis />}
      </Seccion>

      <Seccion n={2} titulo="Avance por componente" nota="Plan y ejecutado del período; avance acumulado al cierre sobre el V. Contrato">
        <div className="overflow-x-auto border border-[#e2e2e0] rounded-lg">
          <table className="min-w-full cvs-tabla">
            <thead>
              <tr>
                <th className="text-left">Componente</th>
                <th className="text-right">V. Contrato</th>
                <th className="text-right">Planificado</th>
                <th className="text-right">Ejecutado</th>
                <th className="text-right">Variación</th>
                <th className="text-right">Cumpl.</th>
                <th className="text-left min-w-[150px]">Avance acumulado</th>
                {analisis && <th className="text-left">Estado</th>}
              </tr>
            </thead>
            <tbody>
              {datos.componentes.map(c => {
                const a = porComp.get(c.nombre);
                return (
                  <tr key={c.nombre}>
                    <td className="font-semibold">{c.nombre}</td>
                    <td className="text-right">{fmtM(c.contrato)}</td>
                    <td className="text-right">{fmtM(c.plan)}</td>
                    <td className="text-right text-green-700">{fmtM(c.ejec)}</td>
                    <td className={`text-right font-semibold ${colorVar(c.variacion)}`}>{conSigno(c.variacion)}</td>
                    <td className={`text-right font-semibold ${colorCumpl(c.cumplimiento)}`}>{pct(c.cumplimiento)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-[70px]"><Barra pct={c.avance} color="#312E81" marca={c.avancePlan} /></div>
                        <span className="w-12 text-right">{c.avance.toFixed(1)}%</span>
                      </div>
                    </td>
                    {analisis && <td>{a && <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-semibold ${COMP_CLS[a.estado]}`}>{a.estado}</span>}</td>}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="ht-g lv0">
                <td>TOTAL</td>
                <td className="text-right">{fmtM(t.contrato)}</td>
                <td className="text-right">{fmtM(t.plan)}</td>
                <td className="text-right">{fmtM(t.ejec)}</td>
                <td className="text-right">{conSigno(t.variacion)}</td>
                <td className="text-right">{pct(t.cumplimiento)}</td>
                <td>{t.avance.toFixed(1)}% <span className="opacity-70">(plan {t.avancePlan.toFixed(1)}%)</span></td>
                {analisis && <td></td>}
              </tr>
            </tfoot>
          </table>
        </div>
        {analisis ? (
          <div className="space-y-2">
            {datos.componentes.map(c => {
              const a = porComp.get(c.nombre);
              if (!a) return null;
              return (
                <div key={c.nombre} className="text-[13px] leading-relaxed text-[#14212A]">
                  <span className="font-semibold">{c.nombre}.</span> {a.analisis}
                </div>
              );
            })}
          </div>
        ) : <SinAnalisis />}
      </Seccion>

      {datos.porSemana.length > 0 && (
        <Seccion n={3} titulo="Evolución semanal" nota="Planificado y ejecutado de cada semana del período">
          <Semanal semanas={datos.porSemana} />
          {analisis ? <Parrafo>{analisis.tendencia}</Parrafo> : <SinAnalisis />}
        </Seccion>
      )}

      <Seccion n={4} titulo="Frentes que más avanzaron" nota="Partidas con mayor ejecutado en el período">
        {analisis ? <Parrafo>{analisis.frentes}</Parrafo> : <SinAnalisis />}
        {datos.destacadas.length > 0
          ? <TablaPartidas filas={datos.destacadas} />
          : <p className="text-[12px] text-[#5A6A74]">No hubo ejecución registrada en el período.</p>}
      </Seccion>

      <Seccion n={5} titulo="Partidas con mayor atraso" nota="Mayor diferencia negativa entre ejecutado y planificado en el período">
        {analisis ? <Parrafo>{analisis.atrasos}</Parrafo> : <SinAnalisis />}
        {datos.atrasadas.length > 0
          ? <TablaPartidas filas={datos.atrasadas} />
          : <p className="text-[12px] text-[#5A6A74]">Ninguna partida quedó por debajo de lo planificado en el período.</p>}
      </Seccion>

      <Seccion n={6} titulo="Recomendaciones">
        {analisis ? (
          <div className="space-y-2">
            {analisis.recomendaciones.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-[13px] text-[#14212A]">
                <span className={`shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${PRIORIDAD_CLS[r.prioridad]}`}>{r.prioridad}</span>
                <div>
                  {r.accion}
                  <div className="text-[11px] text-[#5A6A74]">{r.area} · {r.plazo}</div>
                </div>
              </div>
            ))}
          </div>
        ) : <SinAnalisis />}
      </Seccion>
    </div>
  );
};
