/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FileSpreadsheet } from 'lucide-react';

interface GanttPorContratarProps {
  actividades: any[];
  onOpenReport: () => void;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const GanttPorContratar: React.FC<GanttPorContratarProps> = ({
  actividades,
  onOpenReport,
  isOpen,
  setIsOpen,
}) => {
  // Memoized stats calculation for accurate, up-to-date counts
  const stats = React.useMemo(() => {
    const cleanWbs = (wbs: string) => {
      if (!wbs) return '';
      let clean = wbs.trim();
      const match = clean.match(/^p(?:0326)?\.(.+)$/i);
      if (match) {
        clean = match[1];
      }
      return clean;
    };

    const isEquipmentActivity = (a: any) => {
      if (!a.esItemHoja) return false;

      // Excluir equipos/paquetes con activityId conteniendo 'p6'
      const actId = (a.activityId || '').toLowerCase();
      const pId = (a.id || '').toLowerCase();
      if (actId.includes('p6') || pId.includes('p6')) {
        return false;
      }

      // Excluir bloque p.D "Actividades pendientes de confirmar por el Ingeniero"
      const rawWbs = a.wbs || '';
      const wbs = rawWbs.replace(/^p\d{4}\./, 'p.');
      if (wbs.startsWith('p.D') || wbs.toLowerCase().startsWith('pd')) return false;

      // Excluir actividades de procura (procura, procurement) pero mantener las de "compra" o "adquisición"
      const descLower = (a.descripcion || '').toLowerCase();
      if (
        descLower.startsWith('procura') || 
        descLower.includes('procura') || 
        descLower.includes('procurement')
      ) {
        return false;
      }

      const tipoName = (a.tipo || '').toLowerCase();
      const isElectrico = tipoName.includes('electrico') || tipoName.includes('eléctrico') || tipoName.includes('electrica') || tipoName.includes('eléctrica');
      const isMecanico = tipoName.includes('mecanico') || tipoName.includes('mecánico');
      const isInstrumentacion = tipoName.includes('instrumentacion') || tipoName.includes('instrumentación') || tipoName.includes('control');
      
      if (!isElectrico && !isMecanico && !isInstrumentacion) return false;
      
      const status = (a.p6Status || a.status || '').toLowerCase();
      const isEnCurso = status === 'in progress' || status.includes('curso') || status.includes('progreso');
      const isNoInecido = status === 'not started' || status.includes('iniciado') || status.includes('inicio');
      
      return isEnCurso || isNoInecido;
    };

    const getUniqueEquipmentsList = (actList: any[]) => {
      const map: Record<string, {
        key: string;
        tipo: string;
        subcontratista: string;
      }> = {};

      actList.forEach(it => {
        const cw = cleanWbs(it.wbs);
        const key = cw.toLowerCase();
        if (!key) return;

        if (!map[key]) {
          map[key] = {
            key,
            tipo: it.tipo || 'Otros',
            subcontratista: (it.subcontratista || '').trim(),
          };
        }

        const itemSub = (it.subcontratista || '').trim();
        if (itemSub && !map[key].subcontratista) {
          map[key].subcontratista = itemSub;
        }

        const itemTipo = it.tipo || '';
        if (itemTipo && (!map[key].tipo || map[key].tipo === 'Otros')) {
          map[key].tipo = itemTipo;
        }
      });

      return Object.values(map);
    };

    const rawList = actividades.filter(isEquipmentActivity);
    const uniqueEquipments = getUniqueEquipmentsList(rawList);

    const pendingMecanico = uniqueEquipments.filter(eq => {
      if (eq.subcontratista) return false;
      const t = eq.tipo.toLowerCase();
      return t.includes('mecanico') || t.includes('mecánico');
    }).length;

    const pendingElectrico = uniqueEquipments.filter(eq => {
      if (eq.subcontratista) return false;
      const t = eq.tipo.toLowerCase();
      return t.includes('electrico') || t.includes('eléctrico') || t.includes('electrica') || t.includes('eléctrica');
    }).length;

    const pendingIandC = uniqueEquipments.filter(eq => {
      if (eq.subcontratista) return false;
      const t = eq.tipo.toLowerCase();
      return t.includes('instrumentacion') || t.includes('instrumentación') || t.includes('control');
    }).length;

    const totalEquip = uniqueEquipments.length;
    const countContratados = uniqueEquipments.filter(eq => eq.subcontratista).length;
    const countPorContratar = uniqueEquipments.filter(eq => !eq.subcontratista).length;

    return {
      pendingMecanico,
      pendingElectrico,
      pendingIandC,
      totalPending: pendingMecanico + pendingElectrico + pendingIandC,
      totalEquip,
      countContratados,
      countPorContratar,
    };
  }, [actividades]);

  return (
    <div className="mb-3 border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      <div 
        id="gantt-por-contratar-toggle-bar"
        className="flex items-center justify-between px-4 py-2 bg-gray-50 cursor-pointer hover:bg-gray-100" 
        onClick={() => setIsOpen(o => !o)}
      >
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
          Estado de Procura de Equipos
        </span>
        <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
      </div>
      {isOpen && (
        <div id="gantt-por-contratar-container" className="px-3 py-2.5 flex flex-col md:flex-row items-center justify-center gap-4 bg-slate-50/50">
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {/* Total Paquetes */}
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-[9px] select-none shadow-sm">
              <span className="w-2 h-2 rounded-sm bg-slate-400 flex-shrink-0" />
              <span className="font-semibold text-gray-600 uppercase tracking-wide">Total Paquetes</span>
              <span className="font-bold text-gray-800">{stats.totalEquip}</span>
              <span className="px-1 py-0.5 rounded-full text-[8px] bg-gray-50 text-gray-400 border border-gray-100">
                100%
              </span>
            </div>

            {/* Adjudicados */}
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-[9px] select-none shadow-sm">
              <span className="w-2 h-2 rounded-sm bg-indigo-500 flex-shrink-0" />
              <span className="font-semibold text-gray-600 uppercase tracking-wide">Adjudicados</span>
              <span className="font-bold text-gray-800">{stats.countContratados}</span>
              <span className="px-1 py-0.5 rounded-full text-[8px] bg-indigo-50 text-indigo-600 border border-indigo-100">
                {stats.totalEquip > 0 ? ((stats.countContratados / stats.totalEquip) * 100).toFixed(0) : 0}%
              </span>
            </div>

            {/* Por Contratar */}
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-[9px] select-none shadow-sm">
              <span className="w-2 h-2 rounded-sm bg-amber-500 flex-shrink-0" />
              <span className="font-semibold text-gray-600 uppercase tracking-wide">Por Contratar</span>
              <span className="font-bold text-gray-800">{stats.countPorContratar}</span>
              <span className="px-1 py-0.5 rounded-full text-[8px] bg-amber-50 text-amber-600 border border-amber-100">
                {stats.totalEquip > 0 ? ((stats.countPorContratar / stats.totalEquip) * 100).toFixed(0) : 0}%
              </span>
            </div>

            {/* Mecánica */}
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-[9px] select-none shadow-sm">
              <span className="w-2 h-2 rounded-sm bg-amber-500 flex-shrink-0" />
              <span className="font-semibold text-gray-600 uppercase tracking-wide">Mecánica</span>
              <span className="font-bold text-gray-800">{stats.pendingMecanico}</span>
              <span className="px-1 py-0.5 rounded-full text-[8px] bg-amber-50 text-amber-600 border border-amber-100">
                paquetes
              </span>
            </div>

            {/* Eléctrica */}
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-[9px] select-none shadow-sm">
              <span className="w-2 h-2 rounded-sm bg-amber-500 flex-shrink-0" />
              <span className="font-semibold text-gray-600 uppercase tracking-wide">Eléctrica</span>
              <span className="font-bold text-gray-800">{stats.pendingElectrico}</span>
              <span className="px-1 py-0.5 rounded-full text-[8px] bg-amber-50 text-amber-600 border border-amber-100">
                paquetes
              </span>
            </div>

            {/* I&C */}
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-[9px] select-none shadow-sm">
              <span className="w-2 h-2 rounded-sm bg-amber-500 flex-shrink-0" />
              <span className="font-semibold text-gray-600 uppercase tracking-wide">I&C</span>
              <span className="font-bold text-gray-800">{stats.pendingIandC}</span>
              <span className="px-1 py-0.5 rounded-full text-[8px] bg-amber-50 text-amber-600 border border-amber-100">
                paquetes
              </span>
            </div>
          </div>

          {/* Reporte Eq. Button inside card as requested */}
          <button
            type="button"
            onClick={onOpenReport}
            className="self-start md:self-auto px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-all font-black text-[9px] uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5 cursor-pointer shrink-0 hover:scale-[1.01] active:scale-[0.99]"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-100 shrink-0" />
            <span>Reporte Eq.</span>
          </button>
        </div>
      )}
    </div>
  );
};
