/**
 * «Layouts» de T₃ (como los de Primavera): cada usuario guarda vistas con nombre —agrupación y niveles,
 * Group and Sort, colores, columnas, orden, filtros, ámbito, escala y paneles— y elige una
 * predeterminada que se aplica al abrir T₃. Se guardan en el servidor por usuario (`/api/prefs/p6_vistas`),
 * así que siguen al usuario en cualquier equipo.
 */
import React from 'react';
import { Check, Star, Trash2, X, Save, Share2, Users } from 'lucide-react';
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

/** Layouts que el admin comparte con todos (documento común: todos lo leen, solo el admin lo escribe). */
const CLAVE_COMP = '/api/docs/p6_vistas_compartidas';
/** Prefijo con que se guarda como predeterminada una vista compartida en las preferencias del usuario. */
const PREF_COMP = 'shared:';
async function leerCompartidas(): Promise<VistaGuardada[]> {
  const res = await apiFetch(CLAVE_COMP, { cache: 'no-store' }, [404]);
  if (res.status === 404) return [];
  const d = await res.json().catch(() => null);
  return d && Array.isArray(d.vistas) ? d.vistas : [];
}
async function escribirCompartidas(vistas: VistaGuardada[]) {
  await apiFetch(CLAVE_COMP, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vistas }) });
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
  /** El admin puede compartir sus layouts; los demás los ven en «Shared by admin». */
  esAdmin: boolean;
}> = ({ actual, onAplicar, mostrar, inicio, esAdmin }) => {
  const [doc, setDoc] = React.useState<DocVistas | null>(null);
  const [compartidas, setCompartidas] = React.useState<VistaGuardada[]>([]);
  const compartida = (n: string) => compartidas.some(x => x.nombre === n);
  const [abierto, setAbierto] = React.useState(false);
  const [nombre, setNombre] = React.useState('');
  const [activa, setActivaEstado] = React.useState<string | null>(inicio.current.activa);
  const setActiva = (n: string | null) => { inicio.current.activa = n; setActivaEstado(n); };
  const [guardando, setGuardando] = React.useState(false);
  // Al abrir T₃: cargar las vistas del usuario y aplicar la predeterminada (una sola vez)
  React.useEffect(() => {
    Promise.all([leer(), leerCompartidas().catch(() => [] as VistaGuardada[])]).then(([d, comp]) => {
      setDoc(d);
      setCompartidas(comp);
      if (!inicio.current.aplicada && d.porDefecto) {
        const v = d.porDefecto.startsWith(PREF_COMP)
          ? comp.find(x => x.nombre === d.porDefecto!.slice(PREF_COMP.length))
          : d.vistas.find(x => x.nombre === d.porDefecto);
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
  const cambiarCompartidas = async (nuevas: VistaGuardada[], aviso?: string) => {
    setGuardando(true);
    try { await escribirCompartidas(nuevas); setCompartidas(nuevas); if (aviso) mostrar(aviso); }
    catch (e) { mostrar(`Sharing could not be updated: ${(e as Error).message}`); }
    finally { setGuardando(false); }
  };
  const actualizar = async (n: string) => {
    if (!doc) return;
    const v = { ...doc.vistas.find(x => x.nombre === n)!, ajustes: actual(), guardada: new Date().toISOString() };
    await persistir({ ...doc, vistas: doc.vistas.map(x => (x.nombre === n ? v : x)) }, `Layout «${n}» updated with the current view.`);
    if (esAdmin && compartida(n)) await cambiarCompartidas(compartidas.map(x => (x.nombre === n ? v : x)));
  };
  const borrar = async (n: string) => {
    if (!doc) return;
    await persistir({ vistas: doc.vistas.filter(x => x.nombre !== n), porDefecto: doc.porDefecto === n ? null : doc.porDefecto }, `Layout «${n}» deleted.`);
    if (esAdmin && compartida(n)) await cambiarCompartidas(compartidas.filter(x => x.nombre !== n));
  };
  /** `clave` = nombre de una vista propia o PREF_COMP + nombre de una compartida. */
  const predeterminar = (clave: string, n: string) => doc && persistir({ ...doc, porDefecto: doc.porDefecto === clave ? null : clave }, doc.porDefecto === clave ? `«${n}» is no longer your default layout.` : `«${n}» will open by default.`);
  const alternarCompartir = (n: string) => {
    const v = doc?.vistas.find(x => x.nombre === n);
    if (!v) return;
    cambiarCompartidas(compartida(n) ? compartidas.filter(x => x.nombre !== n) : [...compartidas, v],
      compartida(n) ? `«${n}» is no longer shared.` : `«${n}» is now shared with everyone (they see it under «Shared by admin»).`);
  };
  const aplicar = (v: VistaGuardada) => { onAplicar(v.ajustes); setActiva(v.nombre); setAbierto(false); mostrar(`Layout «${v.nombre}» applied.`); };
  // Vistas que comparte el admin y que este usuario no tiene como propias (para el admin, ninguna: ya son suyas)
  const deOtros = esAdmin ? [] : compartidas;

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
                  <button onClick={() => aplicar(v)} className="flex-1 min-w-0 text-left cursor-pointer" title="Apply this layout">
                    <div className="font-semibold truncate">{v.nombre}{doc.porDefecto === v.nombre && <span className="ml-1.5 text-[10px] font-normal text-[#7A5B00] bg-[#FFF3C4] rounded px-1">default</span>}{esAdmin && compartida(v.nombre) && <span className="ml-1.5 text-[10px] font-normal text-[#2B7F52] bg-[#E3F4EA] rounded px-1">shared</span>}</div>
                    <div className="text-[10.5px] text-[#5A6A74] truncate">{resumen(v.ajustes)}</div>
                  </button>
                  {esAdmin && (
                    <button onClick={() => alternarCompartir(v.nombre)} disabled={guardando} title={compartida(v.nombre) ? 'Stop sharing this layout' : 'Share this layout with the visitor (and everyone)'} className="p-1 rounded hover:bg-white cursor-pointer">
                      <Share2 className={`w-3.5 h-3.5 ${compartida(v.nombre) ? 'text-[#2B7F52]' : 'text-[#9AA6AD]'}`} />
                    </button>
                  )}
                  <button onClick={() => predeterminar(v.nombre, v.nombre)} disabled={guardando} title={doc.porDefecto === v.nombre ? 'Stop opening this layout by default' : 'Open this layout by default'} className="p-1 rounded hover:bg-white cursor-pointer">
                    <Star className={`w-3.5 h-3.5 ${doc.porDefecto === v.nombre ? 'fill-[#E3B505] text-[#C99F00]' : 'text-[#9AA6AD]'}`} />
                  </button>
                  <button onClick={() => actualizar(v.nombre)} disabled={guardando} title="Update this layout with the current view" className="p-1 rounded hover:bg-white cursor-pointer"><Check className="w-3.5 h-3.5 text-[#2B7F52]" /></button>
                  <button onClick={() => borrar(v.nombre)} disabled={guardando} title="Delete this layout" className="p-1 rounded hover:bg-white cursor-pointer"><Trash2 className="w-3.5 h-3.5 text-[#5A6A74] hover:text-red-600" /></button>
                </div>
              ))}
              {doc && deOtros.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 px-2 pt-2 pb-0.5 text-[10.5px] font-semibold text-[#5A6A74] uppercase tracking-wide"><Users className="w-3.5 h-3.5" /> Shared by admin</div>
                  {deOtros.map(v => {
                    const clave = PREF_COMP + v.nombre;
                    return (
                      <div key={clave} className={`flex items-center gap-1 px-2 py-1.5 rounded border ${activa === v.nombre ? 'border-[#8A8FC9] bg-[#EEF0FB]' : 'border-transparent hover:bg-[#F5F8F9]'}`}>
                        <button onClick={() => aplicar(v)} className="flex-1 min-w-0 text-left cursor-pointer" title="Apply this layout (shared by the admin; read-only)">
                          <div className="font-semibold truncate">{v.nombre}{doc.porDefecto === clave && <span className="ml-1.5 text-[10px] font-normal text-[#7A5B00] bg-[#FFF3C4] rounded px-1">default</span>}</div>
                          <div className="text-[10.5px] text-[#5A6A74] truncate">{resumen(v.ajustes)}</div>
                        </button>
                        <button onClick={() => predeterminar(clave, v.nombre)} disabled={guardando} title={doc.porDefecto === clave ? 'Stop opening this layout by default' : 'Open this layout by default'} className="p-1 rounded hover:bg-white cursor-pointer">
                          <Star className={`w-3.5 h-3.5 ${doc.porDefecto === clave ? 'fill-[#E3B505] text-[#C99F00]' : 'text-[#9AA6AD]'}`} />
                        </button>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
            <div className="border-t border-[#E2E2E2] p-2 flex items-center gap-1.5">
              <input id="p6-vista-nombre" value={nombre} onChange={e => setNombre(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') guardarComo(); }}
                placeholder="Name for the current view…" className="flex-1 min-w-0 border border-[#D5DEE2] rounded px-2 py-1" />
              <button onClick={guardarComo} disabled={!nombre.trim() || guardando || !doc} className="px-2 py-1 rounded bg-[#312E81] text-white font-semibold cursor-pointer disabled:opacity-50">Save layout</button>
            </div>
            <div className="px-3 pb-2 text-[10.5px] text-[#5A6A74]">Saved for your user on the server: grouping and levels, Group and Sort, colors, columns, sort, status and User Defined filters, scope, timescale and the Usage / Relations / Baseline panels.{esAdmin ? ' Use the share icon to make a layout available to the visitor.' : ''}</div>
          </div>
        </>
      )}
    </div>
  );
};
