/**
 * Recursos del panel «Activity Usage»: carga diferida de la matriz de personal (solo al elegir
 * Resources) y la ventana «Crew size» para revisar/editar las personas por cuadrilla de cada SubC.
 */
import React from 'react';
import { X } from 'lucide-react';
import { usePersonalVivo } from '../../utils/personalVivo';
import { loadLatestPersonalPlanFromCloud } from '../../utils/cloudSync';
import { cleanEmpresaName, standardizeFrente, standardizeActividad, clasificarTipoPersonal } from '../../utils/personalParser';
import type { EstimacionCuadrilla, RegistroPersonal } from '../../utils/p6/cuadrillas';

let cache: RegistroPersonal[] | null = null;
let pedido: Promise<RegistroPersonal[]> | null = null;

const normalizar = (rs: { fechaIso: string; empresa: string; frente: string; actividad: string; total: number }[]): RegistroPersonal[] =>
  rs.map(r => {
    const empresa = cleanEmpresaName(r.empresa);
    return { fechaIso: r.fechaIso, empresa, total: Number(r.total) || 0, tipo: clasificarTipoPersonal(standardizeFrente(r.frente), empresa, standardizeActividad(r.actividad)) };
  });

/** Registros de la matriz de personal: los de la pestaña Personal si ya están, si no, de la nube. */
export function useMatrizPersonal(activo: boolean): { registros: RegistroPersonal[] | null; cargando: boolean; origen: string } {
  const vivo = usePersonalVivo();
  const [regs, setRegs] = React.useState<RegistroPersonal[] | null>(cache);
  const [cargando, setCargando] = React.useState(false);
  const deVivo = React.useMemo(() => (vivo?.registros?.length ? normalizar(vivo.registros) : null), [vivo]);
  React.useEffect(() => {
    if (!activo || deVivo || regs) return;
    setCargando(true);
    pedido ??= loadLatestPersonalPlanFromCloud().then(d => (cache = d ? normalizar(d.registros) : []));
    pedido.then(r => setRegs(r)).catch(() => setRegs([])).finally(() => setCargando(false));
  }, [activo, deVivo, regs]);
  return { registros: deVivo ?? regs, cargando, origen: deVivo ? (vivo?.fileName || 'Personal tab') : 'personnel matrix (cloud)' };
}

export const DialogoCuadrillas: React.FC<{
  est: Map<string, EstimacionCuadrilla>; usados: Map<string, number>; manual: Record<string, number>; defecto: number;
  origen: string; semanas: number;
  onAplicar: (manual: Record<string, number>, defecto: number) => void; onCerrar: () => void;
}> = ({ est, usados, manual, defecto, origen, semanas, onAplicar, onCerrar }) => {
  const [mm, setMm] = React.useState<Record<string, string>>(() => Object.fromEntries(Object.entries(manual).map(([k, v]) => [k, String(v)])));
  const [def, setDef] = React.useState(String(defecto));
  const filas = [...usados.keys()].sort((a, b) => (usados.get(b)! - usados.get(a)!) || a.localeCompare(b));
  const valor = (s: string) => (mm[s] !== undefined && mm[s] !== '' ? Number(mm[s]) : est.get(s)?.estimado ?? (Number(def) || 0));
  return (
    <div className="fixed inset-0 z-[70] bg-black/30 flex items-center justify-center p-4" onClick={onCerrar}>
      <div className="bg-[#F4F4F4] border border-[#9A9A9A] shadow-2xl w-[820px] max-w-full max-h-[90vh] flex flex-col text-[11.5px] text-[#14212A]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#E2E2E2] border-b border-[#B5B5B5]">
          <b>Crew size (persons per activity in progress)</b>
          <button onClick={onCerrar} className="p-0.5 hover:bg-white rounded cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-3 py-2 text-[#5A6A74] leading-relaxed">
          Each Installation / Construction activity in progress is one crew. Persons per crew are estimated for each subcontractor
          from the {origen}: average DIRECT staff per day ÷ its activities in progress at the same time (actual dates), over the last {semanas} weeks
          before the Data Date. A value below 1 means the subcontractor spreads one crew over several open activities. Type a value to override it.
        </div>
        <div className="overflow-auto px-3">
          <table className="w-full">
            <thead className="sticky top-0 bg-[#F4F4F4]">
              <tr className="text-left text-[10.5px] text-[#5A6A74] border-b border-[#D5DEE2]">
                <th className="py-1 pr-2">SubC</th><th className="pr-2">Company in matrix</th><th className="pr-2 text-right">Staff/day</th>
                <th className="pr-2 text-right">In progress</th><th className="pr-2 text-right">Estimated</th><th className="pr-2 text-right">Activities</th><th className="text-right">Persons / crew</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(s => {
                const e = est.get(s);
                return (
                  <tr key={s} className="border-b border-[#ECECEC]">
                    <td className="py-0.5 pr-2 font-semibold">{s || '(no SubC)'}</td>
                    <td className="pr-2">{e?.empresa ?? <span className="text-[#A3ADB3]">not found</span>}</td>
                    <td className="pr-2 text-right">{e?.personal != null ? e.personal.toFixed(1) : '—'}</td>
                    <td className="pr-2 text-right">{e?.simultaneas != null ? e.simultaneas.toFixed(1) : '—'}</td>
                    <td className="pr-2 text-right">{e?.estimado ?? <span className="text-[#A3ADB3]">default</span>}</td>
                    <td className="pr-2 text-right">{usados.get(s)}</td>
                    <td className="text-right py-0.5">
                      <input type="number" min={0} step={0.1} value={mm[s] ?? ''} placeholder={String(valor(s))}
                        onChange={ev => setMm(x => ({ ...x, [s]: ev.target.value }))}
                        className={`w-20 border rounded px-1 py-0.5 text-right ${mm[s] ? 'border-[#312E81] bg-[#EEF0FB] font-semibold' : 'border-[#D5DEE2] bg-white'}`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 border-t border-[#C3C3C3] bg-[#ECECEC]">
          <span>Default for subcontractors without data:</span>
          <input type="number" min={0} step={0.5} value={def} onChange={e => setDef(e.target.value)} className="w-16 border border-[#D5DEE2] rounded px-1 py-0.5 text-right bg-white" />
          <span className="text-[#5A6A74]">persons</span>
          <button onClick={() => setMm({})} className="ml-auto px-2 py-1 border border-[#B5B5B5] rounded bg-white hover:bg-[#F5F8F9] cursor-pointer">Reset to estimates</button>
          <button onClick={onCerrar} className="px-3 py-1 border border-[#B5B5B5] rounded bg-white hover:bg-[#F5F8F9] cursor-pointer">Cancel</button>
          <button onClick={() => {
            const out: Record<string, number> = {};
            for (const [k, v] of Object.entries(mm)) if (v !== '' && isFinite(Number(v))) out[k] = Number(v);
            onAplicar(out, Number(def) || 0); onCerrar();
          }} className="px-3 py-1 rounded bg-[#312E81] text-white font-semibold cursor-pointer">OK</button>
        </div>
      </div>
    </div>
  );
};
