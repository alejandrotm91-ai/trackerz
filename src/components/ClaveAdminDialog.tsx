import React from 'react';
import { Lock } from 'lucide-react';

interface ClaveAdminDialogProps {
  abierto: boolean;
  error: string;
  verificando: boolean;
  onConfirmar: (password: string) => void;
  onCancelar: () => void;
}

/** Pide la contraseña del administrador antes de generar o actualizar el reporte de Inteligencia. */
export const ClaveAdminDialog: React.FC<ClaveAdminDialogProps> = ({ abierto, error, verificando, onConfirmar, onCancelar }) => {
  const [clave, setClave] = React.useState('');
  React.useEffect(() => { if (abierto) setClave(''); }, [abierto]);
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50" onMouseDown={onCancelar}>
      <form
        onMouseDown={e => e.stopPropagation()}
        onSubmit={e => { e.preventDefault(); if (clave && !verificando) onConfirmar(clave); }}
        className="w-full max-w-sm bg-white rounded-2xl border border-[#D5DEE2] shadow-2xl p-5 space-y-3"
      >
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-[#FBE9E9] text-[#CD0000]"><Lock className="w-4 h-4" /></div>
          <div>
            <h3 className="text-sm font-semibold text-[#14212A]">Confirmar contraseña</h3>
            <p className="text-[12px] text-[#5A6A74]">Para generar o actualizar el reporte de Inteligencia.</p>
          </div>
        </div>
        <input
          type="password"
          autoFocus
          value={clave}
          onChange={e => setClave(e.target.value)}
          placeholder="Contraseña del administrador"
          autoComplete="current-password"
          className="w-full px-3 py-2 text-sm border border-[#D5DEE2] rounded-xl outline-none focus:border-[#CD0000]"
        />
        {error && <p className="text-[12px] text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancelar} className="px-3 py-1.5 text-xs rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer">Cancelar</button>
          <button type="submit" disabled={!clave || verificando} className="px-3 py-1.5 text-xs rounded-xl bg-[#CD0000] hover:bg-[#A80000] text-white disabled:opacity-50 cursor-pointer">
            {verificando ? 'Verificando…' : 'Generar reporte'}
          </button>
        </div>
      </form>
    </div>
  );
};
