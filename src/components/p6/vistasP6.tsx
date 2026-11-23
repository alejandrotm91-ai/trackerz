/**
 * «Layouts» de T₃ (como los de Primavera): cada usuario guarda vistas con nombre —agrupación y niveles,
 * Group and Sort, colores, columnas, orden, filtros, ámbito, escala y paneles— y elige una
 * predeterminada que se aplica al abrir T₃. Se guardan en el servidor por usuario (`/api/prefs/p6_vistas`),
 * así que siguen al usuario en cualquier equipo.
 */
import React from 'react';
import { Check, Star, Trash2, X, Save } from 'lucide-react';
import { apiFetch } from '../../utils/api';

/** Lo que guarda una vista (todo opcional: lo que falte no se toca al aplicarla). */
export interface AjustesVista {
  agrupacion?: 'wbs' | 'ejecucion';
  niveles?: string[];
  ambito?: string;
  opcGrupo?: unknown;
  paletas?: unknown;
  columnas?: string[];
  orden?: { col: 'ini' | 'fin'; dir: 1 | -1 } | null;
  filtroEstado?: string;
  filtrosUdf?: unknown[];
  px?: number;
  verUso?: boolean;
  verRelaciones?: boolean;
  verLB?: boolean;
}
export interface VistaGuardada { nombre: string; ajustes: AjustesVista; guardada: string }
interface DocVistas { vistas: VistaGuardada[]; porDefecto: string | null }

const CLAVE = '/api/prefs/p6_vistas';
async function leer(): Promise<DocVistas> {
  const res = await apiFetch(CLAVE, { cache: 'no-store' }, [404]);
  if (res.status === 404) return { vistas: [], porDefecto: null };
  const d = await res.json().catch(() => null);
  return d && Array.isArray(d.vistas) ? { vistas: d.vistas, porDefecto: d.porDefecto ?? null } : { vistas: [], porDefecto: null };
}
async function escribir(doc: DocVistas) {
  await apiFetch(CLAVE, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doc) });
}

/** Resumen legible de una vista, para el menú. */
function resumen(a: AjustesVista): string {
  const partes: string[] = [];
  partes.push(a.agrupacion === 'ejecucion' ? 'Construction view' : 'T₃ WBS');
  if (a.agrupacion === 'ejecucion' && a.ambito && a.ambito !== 'todo') partes.push(a.ambito === 'construccion' ? 'Construction' : a.ambito === 'equipamiento' ? 'Equipment' : a.ambito === 'aereas' ? 'Obras Aéreas' : a.ambito);
  if (a.orden) partes.push(`sorted by ${a.orden.col === 'ini' ? 'Start' : 'Finish'} ${a.orden.dir === 1 ? '↑' : '↓'}`);
  const F: Record<string, string> = { pendientes: 'In Progress + Not Started', noiniciadas: 'Not Started', encurso: 'In Progress', terminadas: 'Completed', criticas: 'Critical', longest: 'Longest Path', soloMaster: 'Master Only' };
  if (a.filtroEstado && a.filtroEstado !== 'todas') partes.push(F[a.filtroEstado] ?? a.filtroEstado);
  if (a.filtrosUdf?.length) partes.push(`${a.filtrosUdf.length} UDF filter${a.filtrosUdf.length > 1 ? 's' : ''}`);
  return partes.join(' · ');
}

export const MenuVistas: React.FC<{
  actual: () => AjustesVista; onAplicar: (a: AjustesVista) => void; mostrar: (t: string) => void;
  /** Marca de la sesión de T₃: la predeterminada se aplica una sola vez aunque este menú se vuelva a montar. */
  inicio: React.MutableRefObject<{ aplicada: boolean; activa: string | null }>;
}> = ({ actual, onAplicar, mostrar, inicio }) => {
  const [doc, setDoc] = React.useState<DocVistas | null>(null);
  const [abierto, setAbierto] = React.useState(false);
  const [nombre, setNombre] = React.useState('');
  const [activa, setActivaEstado] = React.useState<string | null>(inicio.current.activa);
  const setActiva = (n: string | null) => { inicio.current.activa = n; setActivaEstado(n); };
  const [guardando, setGuardando] = React.useState(false);
  // Al abrir T₃: cargar las vistas del usuario y aplicar la predeterminada (una sola vez)
  React.useEffect(() => {
    leer().then(d => {
      setDoc(d);
      if (!inicio.current.aplicada && d.porDefecto) {
        const v = d.vistas.find(x => x.nombre === d.porDefecto);
        if (v) { onAplicar(v.ajustes); setActiva(v.nombre); mostrar(`Layout «${v.nombre}» applied (your default).`); }
      }
      inicio.current.aplicada = true;
    }).catch(() => setDoc({ vistas: [], porDefecto: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const persistir = async (nuevo: DocVistas, aviso: string) => {
    setGuardando(true);
    try { await escribir(nuevo); setDoc(nuevo); mostrar(aviso); }
    catch (e) { mostrar(`The layout could not be saved: ${(e as Error).message}`); }
    finally { setGuardando(false); }
  };
  const guardarComo = () => {
    const n = nombre.trim();
    if (!n || !doc) return;
    const v: VistaGuardada = { nombre: n, ajustes: actual(), guardada: new Date().toISOString() };
    const existe = doc.vistas.some(x => x.nombre === n);
    persistir({ ...doc, vistas: existe ? doc.vistas.map(x => (x.nombre === n ? v : x)) : [...doc.vistas, v] }, existe ? `Layout «${n}» updated.` : `Layout «${n}» saved.`);
    setActiva(n); setNombre('');
  };
  const actualizar = (n: string) => doc && persistir({ ...doc, vistas: doc.vistas.map(x => (x.nombre === n ? { ...x, ajustes: actual(), guardada: new Date().toISOString() } : x)) }, `Layout «${n}» updated with the current view.`);
  const borrar = (n: string) => doc && persistir({ vistas: doc.vistas.filter(x => x.nombre !== n), porDefecto: doc.porDefecto === n ? null : doc.porDefecto }, `Layout «${n}» deleted.`);
  const predeterminar = (n: string) => doc && persistir({ ...doc, porDefecto: doc.porDefecto === n ? null : n }, doc.porDefecto === n ? `«${n}» is no longer your default layout.` : `«${n}» will open by default.`);

  return (
    <div className="relative">
      <button onClick={() => setAbierto(v => !v)} title="Layouts: save the current view (grouping, Group and Sort, columns, sort, filters…) and choose the one that opens by default"
        className={`border rounded-lg px-2 py-1.5 font-semibold flex items-center gap-1.5 cursor-pointer ${activa ? 'bg-[#EEF0FB] border-[#312E81] text-[#312E81]' : 'bg-white border-[#D5DEE2]'}`}>
        <Save className="w-3.5 h-3.5" /> Layout{activa ? `: ${activa}` : ''}
      </button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setAbierto(false)} />
          <div className="absolute left-0 top-full mt-1.5 z-[61] w-[440px] bg-white border border-[#B5B5B5] rounded-lg shadow-xl text-[11.5px] text-[#14212A]">
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#F0F0F0] border-b border-[#D5D5D5] rounded-t-lg">
              <b>Layouts</b>
              <button onClick={() => setAbierto(false)} className="p-0.5 hover:bg-white rounded cursor-pointer"><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="p-2 flex flex-col gap-0.5 max-h-[320px] overflow-auto">
              {!doc && <div className="text-[#5A6A74] px-2 py-1.5">Loading…</div>}
              {doc && !doc.vistas.length && <div className="text-[#5A6A74] px-2 py-1.5">No saved layouts yet. Set the view as you like it and save it below.</div>}
              {doc?.vistas.map(v => (
                <div key={v.nombre} className={`flex items-center gap-1 px-2 py-1.5 rounded border ${activa === v.nombre ? 'border-[#8A8FC9] bg-[#EEF0FB]' : 'border-transparent hover:bg-[#F5F8F9]'}`}>
                  <button onClick={() => { onAplicar(v.ajustes); setActiva(v.nombre); setAbierto(false); mostrar(`Layout «${v.nombre}» applied.`); }} className="flex-1 min-w-0 text-left cursor-pointer" title="Apply this layout">
                    <div className="font-semibold truncate">{v.nombre}{doc.porDefecto === v.nombre && <span className="ml-1.5 text-[10px] font-normal text-[#7A5B00] bg-[#FFF3C4] rounded px-1">default</span>}</div>
                    <div className="text-[10.5px] text-[#5A6A74] truncate">{resumen(v.ajustes)}</div>
                  </button>
                  <button onClick={() => predeterminar(v.nombre)} disabled={guardando} title={doc.porDefecto === v.nombre ? 'Stop opening this layout by default' : 'Open this layout by default'} className="p-1 rounded hover:bg-white cursor-pointer">
                    <Star className={`w-3.5 h-3.5 ${doc.porDefecto === v.nombre ? 'fill-[#E3B505] text-[#C99F00]' : 'text-[#9AA6AD]'}`} />
                  </button>
                  <button onClick={() => actualizar(v.nombre)} disabled={guardando} title="Update this layout with the current view" className="p-1 rounded hover:bg-white cursor-pointer"><Check className="w-3.5 h-3.5 text-[#2B7F52]" /></button>
                  <button onClick={() => borrar(v.nombre)} disabled={guardando} title="Delete this layout" className="p-1 rounded hover:bg-white cursor-pointer"><Trash2 className="w-3.5 h-3.5 text-[#5A6A74] hover:text-red-600" /></button>
                </div>
              ))}
            </div>
            <div className="border-t border-[#E2E2E2] p-2 flex items-center gap-1.5">
              <input id="p6-vista-nombre" value={nombre} onChange={e => setNombre(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') guardarComo(); }}
                placeholder="Name for the current view…" className="flex-1 min-w-0 border border-[#D5DEE2] rounded px-2 py-1" />
              <button onClick={guardarComo} disabled={!nombre.trim() || guardando || !doc} className="px-2 py-1 rounded bg-[#312E81] text-white font-semibold cursor-pointer disabled:opacity-50">Save layout</button>
            </div>
            <div className="px-3 pb-2 text-[10.5px] text-[#5A6A74]">Saved for your user on the server: grouping and levels, Group and Sort, colors, columns, sort, status and User Defined filters, scope, timescale and the Usage / Relations / Baseline panels.</div>
          </div>
        </>
      )}
    </div>
  );
};
