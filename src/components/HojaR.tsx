/**
 * Hoja «r.» de M₃: el resumen de la pestaña «r.» del Master (por partida, gran partida, ubicación y status,
 * venta del mes por semana, avance acumulado/actual/anterior y desviación). Cálculo en `utils/resumenR.ts`.
 * Los dos ajustes que en el Excel se escriben a mano (actividades completadas retrasadas y planificadas que
 * no se ejecutarán) se guardan por usuario en el servidor (`/api/prefs/m3_r_ajustes`).
 */
import React from 'react';
import type { MasterCdoItem, MasterCdoWeek } from '../types/masterCdo';
import type { Actividad } from '../types';
import { calcularResumenR, FilaR } from '../utils/resumenR';
import { apiFetch } from '../utils/api';

const CLAVE = '/api/prefs/m3_r_ajustes';
const num = (v: number, dec = 0) => (Number.isFinite(v) ? v : 0).toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const pct = (v: number) => `${((Number.isFinite(v) ? v : 0) * 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const colorVar = (v: number) => (v < -0.00005 ? 'text-rose-700' : v > 0.00005 ? 'text-emerald-700' : 'text-slate-500');

const Th: React.FC<{ children: React.ReactNode; der?: boolean }> = ({ children, der }) => (
  <th className={`px-2 py-1 border border-slate-300 bg-[#1F4E78] text-white font-bold text-[11px] whitespace-nowrap ${der ? 'text-right' : 'text-left'}`}>{children}</th>
);
const Td: React.FC<{ children: React.ReactNode; der?: boolean; cls?: string; title?: string }> = ({ children, der, cls = '', title }) => (
  <td title={title} className={`px-2 py-0.5 border border-slate-200 font-mono text-[11px] whitespace-nowrap ${der ? 'text-right' : 'text-left'} ${cls}`}>{children}</td>
);

const TablaR: React.FC<{ titulo: string; filas: FilaR[]; total: FilaR; id: string }> = ({ titulo, filas, total, id }) => (
  <table id={id} className="border-collapse">
    <thead>
      <tr>
        <Th>{titulo}</Th><Th der>Presupuesto</Th><Th der>Plan</Th><Th der>Avance</Th><Th der>% Plan</Th><Th der>% Avance</Th><Th der>% Variación</Th>
      </tr>
    </thead>
    <tbody>
      {filas.map(f => (
        <tr key={f.nombre} className="hover:bg-emerald-50/50">
          <Td cls="font-sans font-semibold text-slate-800">{f.nombre}</Td>
          <Td der title={num(f.presupuesto, 2)}>{num(f.presupuesto)}</Td>
          <Td der title={num(f.plan, 2)}>{num(f.plan)}</Td>
          <Td der title={num(f.avance, 2)}>{num(f.avance)}</Td>
          <Td der>{pct(f.pctPlan)}</Td>
          <Td der>{pct(f.pctAvance)}</Td>
          <Td der cls={colorVar(f.pctVariacion)}>{pct(f.pctVariacion)}</Td>
        </tr>
      ))}
      <tr className="bg-slate-100 font-bold">
        <Td cls="font-sans font-black">{total.nombre}</Td>
        <Td der cls="font-bold">{num(total.presupuesto)}</Td>
        <Td der cls="font-bold">{num(total.plan)}</Td>
        <Td der cls="font-bold">{num(total.avance)}</Td>
        <Td der cls="font-bold">{pct(total.pctPlan)}</Td>
        <Td der cls="font-bold">{pct(total.pctAvance)}</Td>
        <Td der cls={`font-bold ${colorVar(total.pctVariacion)}`}>{pct(total.pctVariacion)}</Td>
      </tr>
    </tbody>
  </table>
);

export const HojaR: React.FC<{
  items: MasterCdoItem[];
  semanas: MasterCdoWeek[];
  actividades: Actividad[];
}> = ({ items, semanas, actividades }) => {
  // Mes por defecto: el de la última semana con avance, sin pasar del mes en curso
  const mesPorDefecto = React.useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 7);
    const conVenta = new Set<string>();
    for (const it of items) for (const [w, v] of Object.entries(it.ventasSemanales || {})) if (Number(v)) conVenta.add(w);
    const f = [...semanas].filter(w => conVenta.has(w.id)).map(w => (w.fecha || w.id).slice(0, 7)).filter(m => m <= hoy).sort().pop();
    return f || hoy;
  }, [items, semanas]);
  const [mes, setMes] = React.useState<string>('');
  const mesUsado = mes || mesPorDefecto;
  const r = React.useMemo(() => calcularResumenR(items, semanas, actividades, mesUsado), [items, semanas, actividades, mesUsado]);

  const [ajustes, setAjustes] = React.useState<{ completadasRetrasadas: number; noSeEjecutaran: number }>({ completadasRetrasadas: 0, noSeEjecutaran: 0 });
  React.useEffect(() => {
    let vivo = true;
    apiFetch(CLAVE, { cache: 'no-store' }, [404]).then(async res => {
      if (!vivo || res.status === 404) return;
      const d = await res.json().catch(() => null);
      if (d && typeof d === 'object') setAjustes({ completadasRetrasadas: Number(d.completadasRetrasadas) || 0, noSeEjecutaran: Number(d.noSeEjecutaran) || 0 });
    }).catch(() => { /* sin conexión: se queda en 0 */ });
    return () => { vivo = false; };
  }, []);
  const guardarAjuste = (k: 'completadasRetrasadas' | 'noSeEjecutaran', texto: string) => {
    const t = texto.trim().replace(/\s/g, '');
    const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t) || 0;
    const nuevo = { ...ajustes, [k]: n };
    setAjustes(nuevo);
    apiFetch(CLAVE, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nuevo) }).catch(() => { /* se reintenta al volver a editar */ });
  };
  const desviacionReal = r.desviacionTotal + ajustes.completadasRetrasadas + ajustes.noSeEjecutaran;
  const base = r.totalPartidas.presupuesto;
  const finMes = (() => { const [y, m] = mesUsado.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); })();

  return (
    <div id="hoja-r" className="flex-1 overflow-auto bg-white p-4 text-slate-800 font-sans">
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="text-base font-black text-[#1F4E78]">Porcentaje de Avance por Partidas</h2>
        <span className="text-[11px] text-slate-500">Avance de M₃ · plan, balance y status del Master · % sobre el presupuesto total ({num(base)})</span>
      </div>
      <div className="flex flex-wrap gap-6 items-start">
        {/* Izquierda: partidas, grandes partidas y status */}
        <div className="flex flex-col gap-5">
          <TablaR id="r-partidas" titulo="Partidas" filas={r.partidas} total={r.totalPartidas} />
          <TablaR id="r-grandes" titulo="Grandes Partidas" filas={r.grandes} total={r.totalGrandes} />
          <table id="r-status" className="border-collapse">
            <thead><tr><Th>Status</Th><Th der>Avance (Balance)</Th><Th der>% Avance</Th></tr></thead>
            <tbody>
              {r.status.map(s => (
                <tr key={s.nombre}><Td cls="font-sans font-semibold">{s.nombre}</Td><Td der cls={colorVar(s.avance)}>{num(s.avance)}</Td><Td der cls={colorVar(s.pct)}>{pct(s.pct)}</Td></tr>
              ))}
              <tr className="bg-slate-100"><Td cls="font-sans font-black">Total</Td><Td der cls={`font-bold ${colorVar(r.totalStatus.avance)}`}>{num(r.totalStatus.avance)}</Td><Td der cls={`font-bold ${colorVar(r.totalStatus.pct)}`}>{pct(r.totalStatus.pct)}</Td></tr>
            </tbody>
          </table>
          {!actividades.some(a => a.statusPlazo) && (
            <p className="text-[11px] text-amber-700 max-w-md">El Master cargado no trae la columna «Status» del cdo (Ahead, Delayed…). Se verá al volver a cargar el Master.</p>
          )}
        </div>

        {/* Derecha: mes, ubicaciones, conciliación y desviación */}
        <div className="flex flex-col gap-5">
          <table id="r-mes" className="border-collapse">
            <thead>
              <tr>
                <Th>
                  <span className="mr-2">Mes</span>
                  <input id="r-mes-input" type="month" value={mesUsado} onChange={e => setMes(e.target.value)}
                    className="text-slate-800 bg-white rounded px-1 py-0 text-[11px] font-mono" />
                </Th>
                <Th der>al {finMes.split('-').reverse().join('/')}</Th>
              </tr>
            </thead>
            <tbody>
              {r.mes.semanas.map(s => (<tr key={s.id}><Td>{s.etiqueta}</Td><Td der title={num(s.venta, 2)}>{num(s.venta)}</Td></tr>))}
              {!r.mes.semanas.length && <tr><Td>Sin semanas en el mes</Td><Td der>—</Td></tr>}
              <tr className="bg-slate-100"><Td cls="font-sans font-black">Total mes</Td><Td der cls="font-bold">{num(r.mes.total)}</Td></tr>
            </tbody>
          </table>

          <table id="r-ubicaciones" className="border-collapse">
            <thead><tr><Th>Partida</Th><Th der>Presupuesto</Th><Th der>Plan</Th><Th der>Avance</Th><Th der>% Plan</Th><Th der>% Avance</Th><Th der>% Var.</Th></tr></thead>
            <tbody>
              {[...r.ubicaciones, r.totalUbicaciones].map(f => (
                <tr key={f.nombre} className={f.nombre === 'Total' ? 'bg-slate-100 font-bold' : ''}>
                  <Td cls="font-sans font-semibold">{f.nombre}</Td><Td der>{num(f.presupuesto)}</Td><Td der>{num(f.plan)}</Td><Td der>{num(f.avance)}</Td>
                  <Td der>{pct(f.pctPlan)}</Td><Td der>{pct(f.pctAvance)}</Td><Td der cls={colorVar(f.pctVariacion)}>{pct(f.pctVariacion)}</Td>
                </tr>
              ))}
            </tbody>
          </table>

          <table id="r-conciliacion" className="border-collapse">
            <tbody>
              <tr><Td cls="font-sans font-bold">AVANCE ACUMULADO</Td><Td der cls="font-bold">{num(r.acumulado, 2)}</Td></tr>
              <tr><Td cls="font-sans font-bold">AVANCE ACTUAL ({r.actual ? r.actual.etiqueta.slice(2).toUpperCase() : '—'})</Td><Td der>{num(r.actual?.venta || 0, 2)}</Td></tr>
              <tr><Td cls="font-sans font-bold">AVANCE ANTERIOR ({r.anterior ? r.anterior.etiqueta.slice(2).toUpperCase() : '—'})</Td><Td der>{num(r.anterior?.venta || 0, 2)}</Td></tr>
              <tr><Td cls="font-sans font-bold">DIFERENCIAS</Td><Td der cls={colorVar(r.diferencias)}>{num(r.diferencias, 2)}</Td></tr>
            </tbody>
          </table>

          <table id="r-desviacion" className="border-collapse">
            <tbody>
              <tr><Td cls="font-sans font-bold">Desviación total</Td><Td der cls={colorVar(r.desviacionTotal)}>{num(r.desviacionTotal, 2)}</Td><Td der cls={colorVar(r.desviacionTotal)}>{pct(base ? r.desviacionTotal / base : 0)}</Td></tr>
              {([['completadasRetrasadas', 'Actividades completadas retrasadas'], ['noSeEjecutaran', 'Actividades planificadas que no se ejecutarán']] as const).map(([k, t]) => (
                <tr key={k}>
                  <Td cls="font-sans">{t}</Td>
                  <Td der>
                    <input key={`${k}-${ajustes[k]}`} defaultValue={num(ajustes[k], 2)} id={`r-${k}`}
                      onBlur={e => guardarAjuste(k, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      className="w-32 text-right font-mono text-[11px] bg-amber-50 border border-amber-200 rounded px-1" title="Se escribe a mano, como en el Excel" />
                  </Td>
                  <Td der>{pct(base ? ajustes[k] / base : 0)}</Td>
                </tr>
              ))}
              <tr className="bg-slate-100"><Td cls="font-sans font-black">Desviación real</Td><Td der cls={`font-bold ${colorVar(desviacionReal)}`}>{num(desviacionReal, 2)}</Td><Td der cls={`font-bold ${colorVar(desviacionReal)}`}>{pct(base ? desviacionReal / base : 0)}</Td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
