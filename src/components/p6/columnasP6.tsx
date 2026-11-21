/**
 * Columnas de la tabla de actividades del cronograma P6 (como «Columns» de Primavera):
 * catálogo por categorías, valores de cada celda y la ventana para elegirlas y ordenarlas.
 */
import React from 'react';
import { X, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react';
import { celda } from '../../utils/p6/xer';
import { aMinutos } from '../../utils/p6/calendario';
import type { ModeloP6 } from '../../utils/p6/modelo';

export interface ColumnaP6 {
  id: string;
  titulo: string;
  grupo: string;
  ancho: number;
  /** Alineación del contenido. */
  der?: boolean;
}

const COLUMNAS_BASE: ColumnaP6[] = [
  // General
  { id: 'id', titulo: 'Activity ID', grupo: 'General', ancho: 120 },
  { id: 'nombre', titulo: 'Activity Name', grupo: 'General', ancho: 262 },
  { id: 'tipo', titulo: 'Activity Type', grupo: 'General', ancho: 110 },
  { id: 'estado', titulo: 'Activity Status', grupo: 'General', ancho: 84 },
  { id: 'calendario', titulo: 'Calendar', grupo: 'General', ancho: 120 },
  { id: 'wbs', titulo: 'WBS Code', grupo: 'General', ancho: 140 },
  { id: 'wbsNombre', titulo: 'WBS Name', grupo: 'General', ancho: 180 },
  { id: 'restr', titulo: 'Primary Constraint', grupo: 'General', ancho: 120 },
  { id: 'restrFecha', titulo: 'Primary Constraint Date', grupo: 'General', ancho: 80, der: true },
  { id: 'lp', titulo: 'Longest Path', grupo: 'General', ancho: 58 },
  { id: 'critica', titulo: 'Critical', grupo: 'General', ancho: 54 },
  // Dates
  { id: 'ini', titulo: 'Start', grupo: 'Dates', ancho: 78, der: true },
  { id: 'fin', titulo: 'Finish', grupo: 'Dates', ancho: 78, der: true },
  { id: 'es', titulo: 'Early Start', grupo: 'Dates', ancho: 78, der: true },
  { id: 'ef', titulo: 'Early Finish', grupo: 'Dates', ancho: 78, der: true },
  { id: 'ls', titulo: 'Late Start', grupo: 'Dates', ancho: 78, der: true },
  { id: 'lf', titulo: 'Late Finish', grupo: 'Dates', ancho: 78, der: true },
  { id: 'as', titulo: 'Actual Start', grupo: 'Dates', ancho: 78, der: true },
  { id: 'af', titulo: 'Actual Finish', grupo: 'Dates', ancho: 78, der: true },
  { id: 'ps', titulo: 'Planned Start', grupo: 'Dates', ancho: 78, der: true },
  { id: 'pf', titulo: 'Planned Finish', grupo: 'Dates', ancho: 78, der: true },
  { id: 'bls', titulo: 'BL Start', grupo: 'Dates', ancho: 78, der: true },
  { id: 'blf', titulo: 'BL Finish', grupo: 'Dates', ancho: 78, der: true },
  { id: 'expf', titulo: 'Expected Finish', grupo: 'Dates', ancho: 78, der: true },
  // Durations
  { id: 'durO', titulo: 'Original Duration', grupo: 'Durations', ancho: 56, der: true },
  { id: 'durR', titulo: 'Remaining Duration', grupo: 'Durations', ancho: 60, der: true },
  { id: 'durA', titulo: 'Actual Duration', grupo: 'Durations', ancho: 56, der: true },
  { id: 'durC', titulo: 'At Completion Duration', grupo: 'Durations', ancho: 66, der: true },
  // Float
  { id: 'tf', titulo: 'Total Float', grupo: 'Float', ancho: 54, der: true },
  { id: 'ff', titulo: 'Free Float', grupo: 'Float', ancho: 54, der: true },
  // Percent Completes
  { id: 'avance', titulo: 'Physical % Complete', grupo: 'Percent Completes', ancho: 62, der: true },
  // Variance
  { id: 'varFin', titulo: 'BL Finish Var.', grupo: 'Variance', ancho: 60, der: true },
  { id: 'varIni', titulo: 'BL Start Var.', grupo: 'Variance', ancho: 60, der: true },
  // Units
  { id: 'qBud', titulo: 'Budgeted Units', grupo: 'Units', ancho: 90, der: true },
  { id: 'qAct', titulo: 'Actual Units', grupo: 'Units', ancho: 90, der: true },
  { id: 'qRem', titulo: 'Remaining Units', grupo: 'Units', ancho: 90, der: true },
  { id: 'qAtC', titulo: 'At Completion Units', grupo: 'Units', ancho: 90, der: true },
  { id: 'uP', titulo: 'Budgeted Labor Units', grupo: 'Units', ancho: 70, der: true },
  { id: 'uA', titulo: 'Actual Labor Units', grupo: 'Units', ancho: 70, der: true },
  { id: 'uR', titulo: 'Remaining Labor Units', grupo: 'Units', ancho: 70, der: true },
];

export const COLUMNAS_DEF = ['id', 'nombre', 'durO', 'durR', 'ini', 'fin', 'varFin', 'tf', 'ff', 'avance'];
export const GRUPOS_COLUMNAS = ['General', 'Dates', 'Durations', 'Float', 'Percent Completes', 'Variance', 'Units', 'User Defined'];

/** Catálogo completo: las columnas fijas más una por cada campo de usuario de actividades del XER. */
export function catalogoColumnas(m: ModeloP6 | null): ColumnaP6[] {
  const out = [...COLUMNAS_BASE];
  const tipos = m?.xer.tablas.get('UDFTYPE');
  if (tipos) {
    for (const f of tipos.filas) {
      if (celda(tipos, f, 'table_name') !== 'TASK') continue;
      const tipo = celda(tipos, f, 'logical_data_type');
      out.push({
        id: `udf:${celda(tipos, f, 'udf_type_id')}`,
        titulo: celda(tipos, f, 'udf_type_label') || celda(tipos, f, 'udf_type_name'),
        grupo: 'User Defined',
        ancho: tipo === 'FT_TEXT' ? 130 : 78,
        der: tipo !== 'FT_TEXT',
      });
    }
    out.sort((a, b) => (a.grupo === 'User Defined' && b.grupo === 'User Defined' ? a.titulo.localeCompare(b.titulo, 'es', { numeric: true }) : 0));
  }
  return out;
}

/** Valores de los campos de usuario por actividad, solo para las columnas elegidas (udf_type_id → task_id → valor). */
export function valoresUdf(m: ModeloP6 | null, ids: string[]): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>();
  const quiero = new Set(ids.filter(x => x.startsWith('udf:')).map(x => x.slice(4)));
  if (!m || !quiero.size) return out;
  const tipos = m.xer.tablas.get('UDFTYPE'), valores = m.xer.tablas.get('UDFVALUE');
  if (!tipos || !valores) return out;
  const tipoDe = new Map(tipos.filas.map(f => [celda(tipos, f, 'udf_type_id'), celda(tipos, f, 'logical_data_type')]));
  for (const id of quiero) out.set(id, new Map());
  for (const f of valores.filas) {
    const id = celda(valores, f, 'udf_type_id');
    const mapa = out.get(id);
    if (!mapa) continue;
    const t = tipoDe.get(id) || '';
    const v = t.includes('DATE') ? celda(valores, f, 'udf_date') : t === 'FT_TEXT' || t === 'FT_STATICTYPE' ? celda(valores, f, 'udf_text') : celda(valores, f, 'udf_number');
    mapa.set(celda(valores, f, 'fk_id'), v);
  }
  return out;
}

export const NOMBRE_TIPO: Record<string, string> = { TT_Task: 'Task Dependent', TT_Rsrc: 'Resource Dependent', TT_Mile: 'Start Milestone', TT_FinMile: 'Finish Milestone', TT_LOE: 'Level of Effort', TT_WBS: 'WBS Summary' };
export const NOMBRE_ESTADO: Record<string, string> = { TK_NotStart: 'Not Started', TK_Active: 'In Progress', TK_Complete: 'Completed' };
export const NOMBRE_RESTR: Record<string, string> = { CS_MSOA: 'Start On or After', CS_MSO: 'Start On', CS_MEO: 'Finish On', CS_MEOB: 'Finish On or Before', CS_ALAP: 'As Late As Possible', CS_MSOB: 'Start On or Before', CS_MEOA: 'Finish On or After', CS_MANDSTART: 'Mandatory Start', CS_MANDFIN: 'Mandatory Finish' };
export { aMinutos };

/** Ventana «Columns» al estilo de P6: opciones disponibles por categoría y columnas elegidas en orden. */
export const DialogoColumnas: React.FC<{
  catalogo: ColumnaP6[]; elegidas: string[]; onAplicar: (ids: string[]) => void; onCerrar: () => void;
}> = ({ catalogo, elegidas, onAplicar, onCerrar }) => {
  const [sel, setSel] = React.useState<string[]>(elegidas.filter(id => catalogo.some(c => c.id === id)));
  const [marcaDisp, setMarcaDisp] = React.useState<string | null>(null);
  const [marcaSel, setMarcaSel] = React.useState<string | null>(null);
  const [abiertos, setAbiertos] = React.useState<Set<string>>(new Set(['General', 'Dates']));
  const [busca, setBusca] = React.useState('');
  const porId = new Map(catalogo.map(c => [c.id, c]));
  const disponibles = catalogo.filter(c => !sel.includes(c.id) && (!busca || c.titulo.toLowerCase().includes(busca.toLowerCase())));
  const agregar = (id: string | null) => { if (id && !sel.includes(id)) { setSel(s => [...s, id]); setMarcaSel(id); setMarcaDisp(null); } };
  const quitar = (id: string | null) => { if (id && sel.length > 1) { setSel(s => s.filter(x => x !== id)); setMarcaSel(null); } };
  const mover = (dir: -1 | 1) => {
    if (!marcaSel) return;
    setSel(s => { const k = s.indexOf(marcaSel); const j = k + dir; if (k < 0 || j < 0 || j >= s.length) return s; const c = [...s]; [c[k], c[j]] = [c[j], c[k]]; return c; });
  };
  const flecha = 'w-9 h-8 border border-[#B5B5B5] bg-[#F5F5F5] hover:bg-white rounded-sm flex items-center justify-center cursor-pointer disabled:opacity-40 text-[#1A1A1A] font-bold';
  const botonP6 = 'w-full px-3 py-1.5 border border-[#B5B5B5] bg-[#F5F5F5] hover:bg-white rounded-sm flex items-center gap-2 cursor-pointer';
  return (
    <div className="fixed inset-0 z-[90] bg-black/30 flex items-center justify-center p-4" onClick={onCerrar}>
      <div className="w-[820px] max-w-full bg-[#F0F0F0] border border-[#9A9A9A] shadow-2xl text-[11.5px] text-[#1A1A1A]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-3 py-1.5 bg-white border-b border-[#C3C3C3]">
          <b>Columns</b>
          <button onClick={onCerrar} className="p-1 hover:bg-[#F0F0F0] rounded cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex gap-3 p-3">
          {/* Disponibles */}
          <div className="flex-1 min-w-0 flex flex-col border border-[#C3C3C3] bg-white">
            <div className="px-2 py-1 font-bold bg-[#E8E8E8] border-b border-[#C3C3C3] flex items-center gap-2">
              Available Options
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Find…" className="ml-auto font-normal border border-[#C3C3C3] px-1.5 py-0.5 w-32" />
            </div>
            <div className="h-[340px] overflow-auto">
              {GRUPOS_COLUMNAS.map(g => {
                const items = disponibles.filter(c => c.grupo === g);
                if (!items.length) return null;
                const abierto = abiertos.has(g) || !!busca;
                return (
                  <div key={g}>
                    <button onClick={() => setAbiertos(a => { const n = new Set(a); if (n.has(g)) n.delete(g); else n.add(g); return n; })}
                      className="w-full flex items-center gap-1 px-1 py-0.5 bg-[#E6F7E6] border-b border-white text-left font-semibold cursor-pointer">
                      {abierto ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />} {g} <span className="font-normal text-[#5A6A74]">({items.length})</span>
                    </button>
                    {abierto && items.map(c => (
                      <div key={c.id} onClick={() => setMarcaDisp(c.id)} onDoubleClick={() => agregar(c.id)}
                        className={`pl-6 pr-2 py-0.5 cursor-pointer truncate ${marcaDisp === c.id ? 'bg-[#0A64C8] text-white' : 'hover:bg-[#EAF2FB]'}`}>{c.titulo}</div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Flechas */}
          <div className="flex flex-col justify-center gap-2">
            <button className={flecha} title="Add" disabled={!marcaDisp} onClick={() => agregar(marcaDisp)}>›</button>
            <button className={flecha} title="Add all" onClick={() => setSel(s => [...s, ...disponibles.map(c => c.id)])}>»</button>
            <div className="h-3" />
            <button className={flecha} title="Remove" disabled={!marcaSel || sel.length <= 1} onClick={() => quitar(marcaSel)}>‹</button>
            <button className={flecha} title="Remove all (keeps Activity ID)" onClick={() => { setSel(['id']); setMarcaSel(null); }}>«</button>
          </div>
          {/* Elegidas */}
          <div className="w-[230px] flex flex-col border border-[#C3C3C3] bg-white">
            <div className="px-2 py-1 font-bold bg-[#E8E8E8] border-b border-[#C3C3C3]">Selected Options</div>
            <div className="h-[340px] overflow-auto">
              {sel.map(id => (
                <div key={id} onClick={() => setMarcaSel(id)} onDoubleClick={() => quitar(id)}
                  className={`px-2 py-0.5 cursor-pointer truncate ${marcaSel === id ? 'bg-[#0A64C8] text-white' : 'hover:bg-[#EAF2FB]'}`}>{porId.get(id)?.titulo ?? id}</div>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-center gap-2">
            <button className={flecha} title="Move up" disabled={!marcaSel || sel.indexOf(marcaSel) <= 0} onClick={() => mover(-1)}><ArrowUp className="w-4 h-4" /></button>
            <button className={flecha} title="Move down" disabled={!marcaSel || sel.indexOf(marcaSel) >= sel.length - 1} onClick={() => mover(1)}><ArrowDown className="w-4 h-4" /></button>
          </div>
          {/* Botones */}
          <div className="w-[110px] shrink-0 flex flex-col gap-1.5">
            <button className={botonP6} onClick={() => { onAplicar(sel); onCerrar(); }}><span className="text-emerald-600 font-bold">✓</span> OK</button>
            <button className={botonP6} onClick={onCerrar}><span className="text-red-600 font-bold">⊘</span> Cancel</button>
            <div className="h-2" />
            <button className={botonP6} onClick={() => onAplicar(sel)}><span className="text-[#312E81] font-bold">↻</span> Apply</button>
            <button className={botonP6} onClick={() => { setSel(COLUMNAS_DEF); setMarcaSel(null); }}><span className="text-emerald-700 font-bold">▶</span> Default</button>
          </div>
        </div>
        <div className="px-3 pb-2 text-[10.5px] text-[#5A6A74]">Double-click an option to add or remove it. The Activity ID column keeps the tree indentation.</div>
      </div>
    </div>
  );
};
