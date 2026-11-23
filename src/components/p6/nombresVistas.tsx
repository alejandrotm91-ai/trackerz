/**
 * Nombres de las vistas de T₃ que cada usuario puede cambiar: las agrupaciones (T₃ WBS /
 * Construction) y los ámbitos de la Constructiva (Construction & Equipment, Construction,
 * Equipment, Obras Aéreas). Solo cambia el texto en pantalla; los valores internos siguen igual.
 * Se renombran en el propio desplegable (lápiz en cada opción).
 * Se guardan en el servidor por usuario (`/api/prefs/p6_nombres_vistas`) y, para mostrarlos al
 * instante al abrir, también en este navegador (localStorage `p6.nombresVistas`).
 */
import React from 'react';
import { Check, ChevronDown, Pencil, RotateCcw } from 'lucide-react';
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

/**
 * Desplegable de vistas que se renombra en el propio desplegable: cada opción tiene un lápiz; al
 * pulsarlo, su nombre se edita en el sitio (Enter o clic fuera guarda, Esc cancela, ↺ vuelve al
 * nombre por defecto). El nombre se guarda para el usuario.
 */
export const DesplegableVistas = <V extends ClaveVista>({
  id, valor, opciones, prefijo = '', onCambiar, nombre, propios, guardar, mostrar, title, disabled, activo,
}: {
  id: string;
  valor: V;
  opciones: V[];
  prefijo?: string;
  onCambiar: (v: V) => void;
  nombre: (k: ClaveVista) => string;
  propios: NombresVistas;
  guardar: (n: NombresVistas) => Promise<void>;
  mostrar: (t: string) => void;
  title?: string;
  disabled?: boolean;
  /** Clases del botón cuando la vista elegida está «activa» (resaltada). */
  activo?: string;
}) => {
  const [abierto, setAbierto] = React.useState(false);
  const [editando, setEditando] = React.useState<V | null>(null);
  const [texto, setTexto] = React.useState('');
  const caja = React.useRef<HTMLDivElement>(null);
  const cerrar = () => { setAbierto(false); setEditando(null); };
  const renombrar = async (k: V, nuevo: string) => {
    setEditando(null);
    const limpio = nuevo.trim();
    if ((propios[k] || '') === (limpio === NOMBRES_VISTA_DEF[k] ? '' : limpio)) return;
    try {
      await guardar({ ...propios, [k]: limpio });
      mostrar(limpio && limpio !== NOMBRES_VISTA_DEF[k] ? `View renamed to «${limpio}»` : `View name back to «${NOMBRES_VISTA_DEF[k]}»`);
    } catch (e) {
      mostrar(`Could not save the view name: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const editRef = React.useRef<{ k: V; texto: string } | null>(null);
  editRef.current = editando ? { k: editando, texto } : null;
  React.useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) {
        const ed = editRef.current;
        if (ed) renombrar(ed.k, ed.texto);
        cerrar();
      }
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto, propios]);
  return (
    <div className="relative" ref={caja} id={id}>
      <button type="button" disabled={disabled} title={title}
        onClick={() => (abierto ? cerrar() : setAbierto(true))}
        onKeyDown={e => { if (e.key === 'Escape') cerrar(); }}
        className={`border rounded-lg pl-2 pr-1.5 py-1.5 font-semibold flex items-center gap-1 disabled:opacity-50 ${activo || 'bg-white border-[#D5DEE2] text-[#14212A]'}`}>
        <span className="whitespace-nowrap">{prefijo}{nombre(valor)}</span>
        <ChevronDown size={14} className="shrink-0" />
      </button>
      {abierto && (
        <div role="listbox" className="absolute z-50 mt-1 left-0 min-w-full w-max max-w-[360px] bg-white border border-[#D5DEE2] rounded-lg shadow-xl py-1 text-xs text-[#14212A]">
          {opciones.map(k => (
            <div key={k} role="option" aria-selected={k === valor} data-vista={k}
              className={`group flex items-center gap-1 px-2 py-1 ${k === valor ? 'bg-[#EEF0FB]' : 'hover:bg-[#F4F6F8]'}`}>
              {editando === k ? (
                <>
                  <input autoFocus value={texto} maxLength={MAX} placeholder={NOMBRES_VISTA_DEF[k]}
                    onChange={e => setTexto(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') renombrar(k, texto);
                      if (e.key === 'Escape') { e.stopPropagation(); setEditando(null); }
                    }}
                    className="flex-1 min-w-[160px] border border-[#312E81] rounded px-1.5 py-0.5 focus:outline-none" />
                  <button type="button" title="Save name (Enter)" onMouseDown={e => e.preventDefault()} onClick={() => renombrar(k, texto)}
                    className="p-0.5 text-[#312E81] hover:bg-[#EEF0FB] rounded"><Check size={13} /></button>
                  <button type="button" title={`Back to the default name «${NOMBRES_VISTA_DEF[k]}»`} onMouseDown={e => e.preventDefault()} onClick={() => renombrar(k, '')}
                    className="p-0.5 text-[#5A6A74] hover:bg-[#F4F6F8] rounded"><RotateCcw size={12} /></button>
                </>
              ) : (
                <>
                  <button type="button" className="flex-1 text-left py-0.5 whitespace-nowrap font-medium"
                    onClick={() => { onCambiar(k); cerrar(); }}>
                    {prefijo}{nombre(k)}
                  </button>
                  <button type="button" title="Rename this view (only for you)"
                    onClick={() => { setTexto(propios[k] || nombre(k)); setEditando(k); }}
                    className="p-0.5 text-[#94A3AD] hover:text-[#312E81] hover:bg-[#EEF0FB] rounded"><Pencil size={12} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
