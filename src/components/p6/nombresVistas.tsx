/**
 * Nombres de las vistas de T₃ que cada usuario puede cambiar: las agrupaciones (T₃ WBS /
 * Construction) y los ámbitos de la Constructiva (Construction & Equipment, Construction,
 * Equipment, Obras Aéreas). Solo cambia el texto en pantalla; los valores internos siguen igual.
 * Se guardan en el servidor por usuario (`/api/prefs/p6_nombres_vistas`) y, para mostrarlos al
 * instante al abrir, también en este navegador (localStorage `p6.nombresVistas`).
 */
import React from 'react';
import { Pencil, RotateCcw, X } from 'lucide-react';
import { apiFetch } from '../../utils/api';

export type ClaveVista = 'wbs' | 'ejecucion' | 'todo' | 'construccion' | 'equipamiento' | 'aereas';
export type NombresVistas = Partial<Record<ClaveVista, string>>;

export const NOMBRES_VISTA_DEF: Record<ClaveVista, string> = {
  wbs: 'T₃ WBS',
  ejecucion: 'Construction',
  todo: 'Construction & Equipment',
  construccion: 'Construction',
  equipamiento: 'Equipment',
  aereas: 'Obras Aéreas',
};

const FILAS: [ClaveVista, string][] = [
  ['wbs', 'Group by: WBS'],
  ['ejecucion', 'Group by: Constructive view'],
  ['todo', 'Scope: all'],
  ['construccion', 'Scope: construction'],
  ['equipamiento', 'Scope: equipment'],
  ['aereas', 'Scope: aerial works (Soport.Tub.Aerea, Tub.Aerea, Valvulas)'],
];

const CLAVE = '/api/prefs/p6_nombres_vistas';
const LS = 'p6.nombresVistas';
const MAX = 40;

function limpiar(n: unknown): NombresVistas {
  const r: NombresVistas = {};
  if (!n || typeof n !== 'object') return r;
  for (const [k] of FILAS) {
    const v = (n as Record<string, unknown>)[k];
    if (typeof v === 'string' && v.trim() && v.trim() !== NOMBRES_VISTA_DEF[k]) r[k] = v.trim().slice(0, MAX);
  }
  return r;
}

/** Nombres del usuario (con los de por defecto donde no cambió nada) y cómo guardarlos. */
export function useNombresVistas() {
  const [propios, setPropios] = React.useState<NombresVistas>(() => {
    try { return limpiar(JSON.parse(localStorage.getItem(LS) || '{}')); } catch { return {}; }
  });
  React.useEffect(() => {
    let vivo = true;
    apiFetch(CLAVE, { cache: 'no-store' }, [404])
      .then(async res => {
        if (!vivo || res.status === 404) return;
        const d = limpiar(await res.json().catch(() => null));
        setPropios(d);
        try { localStorage.setItem(LS, JSON.stringify(d)); } catch { /* sin almacenamiento local */ }
      })
      .catch(() => { /* se quedan los del navegador */ });
    return () => { vivo = false; };
  }, []);
  const nombre = React.useCallback((k: ClaveVista) => propios[k] || NOMBRES_VISTA_DEF[k], [propios]);
  const guardar = React.useCallback(async (n: NombresVistas) => {
    const d = limpiar(n);
    setPropios(d);
    try { localStorage.setItem(LS, JSON.stringify(d)); } catch { /* sin almacenamiento local */ }
    await apiFetch(CLAVE, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
  }, []);
  return { nombre, propios, guardar };
}

/** Botón de lápiz con la ventana para renombrar las vistas. */
export const BotonNombresVistas: React.FC<{
  propios: NombresVistas;
  guardar: (n: NombresVistas) => Promise<void>;
  mostrar: (t: string) => void;
}> = ({ propios, guardar, mostrar }) => {
  const [abierto, setAbierto] = React.useState(false);
  const [borrador, setBorrador] = React.useState<NombresVistas>({});
  const [guardando, setGuardando] = React.useState(false);
  const caja = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc); };
  }, [abierto]);
  const ok = async () => {
    setGuardando(true);
    try {
      await guardar(borrador);
      mostrar('View names saved');
      setAbierto(false);
    } catch (e) {
      mostrar(`Could not save the view names: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setGuardando(false);
    }
  };
  return (
    <div className="relative" ref={caja}>
      <button type="button" title="Rename views (only the names you see; saved for your user)"
        onClick={() => { setBorrador({ ...propios }); setAbierto(v => !v); }}
        className={`border rounded-lg p-1.5 ${abierto ? 'bg-[#EEF0FB] border-[#312E81] text-[#312E81]' : 'bg-white border-[#D5DEE2] text-[#5A6A74] hover:text-[#312E81]'}`}>
        <Pencil size={14} />
      </button>
      {abierto && (
        <div className="absolute z-50 mt-1 left-0 w-[340px] bg-white border border-[#D5DEE2] rounded-xl shadow-xl p-3 text-xs">
          <div className="flex items-center justify-between mb-2">
            <b className="text-[#14212A]">Rename views</b>
            <button type="button" title="Close" onClick={() => setAbierto(false)} className="text-[#5A6A74] hover:text-[#14212A]"><X size={14} /></button>
          </div>
          <div className="space-y-2">
            {FILAS.map(([k, desc]) => (
              <label key={k} className="block">
                <span className="text-[10.5px] text-[#5A6A74]">{desc}</span>
                <input id={`p6-nombre-vista-${k}`} value={borrador[k] ?? ''} maxLength={MAX} placeholder={NOMBRES_VISTA_DEF[k]}
                  onChange={e => setBorrador(b => ({ ...b, [k]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') ok(); }}
                  className="mt-0.5 w-full border border-[#D5DEE2] rounded-md px-2 py-1 focus:outline-none focus:border-[#312E81]" />
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3">
            <button type="button" onClick={() => setBorrador({})} title="Back to the default names"
              className="flex items-center gap-1 text-[#5A6A74] hover:text-[#14212A]"><RotateCcw size={12} /> Default names</button>
            <button type="button" disabled={guardando} onClick={ok}
              className="bg-[#312E81] text-white font-semibold rounded-lg px-3 py-1.5 disabled:opacity-50">Save</button>
          </div>
        </div>
      )}
    </div>
  );
};
