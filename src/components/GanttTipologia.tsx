/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ctTipoCfg, isIgnoredFinishDate } from '../utils/helpers';

interface GanttTipologiaProps {
  actividades: any[];
  ganttTipo: string;
  setGanttTipo: (tipo: string) => void;
  setGanttStatus: (status: string) => void;
  ganttStatus?: string;
  setGanttFloat: (floatVal: string) => void;
  ganttFloat?: string;
  setGanttExp: (val: any) => void;
  ganttTipoOpen: boolean;
  setGanttTipoOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const GanttTipologia: React.FC<GanttTipologiaProps> = ({
  actividades,
  ganttTipo,
  setGanttTipo,
  setGanttStatus,
  ganttStatus = 'all',
  setGanttFloat,
  ganttFloat = 'all',
  setGanttExp,
  ganttTipoOpen,
  setGanttTipoOpen,
}) => {
  const normalize = (wbs: string) => wbs.replace(/^p\d{4}\./, 'p.');
  const hojas = React.useMemo(() => {
    return actividades.filter(a => {
      const wbs = normalize(a.wbs || '');
      if (!a.esItemHoja) return false;
      if (!(wbs.startsWith('p.') || wbs.startsWith('p.D'))) return false;
      if (a.totalFloat === null || a.totalFloat === undefined) return false;
      if (a.descripcion && a.descripcion.trim().toLowerCase().startsWith('procura')) return false;
      if (isIgnoredFinishDate(a.finish)) return false;
      return true;
    });
  }, [actividades]);

  const filteredHojas = React.useMemo(() => {
    let list = hojas;

    if (ganttStatus !== 'all') {
      const allowedStatuses = ganttStatus.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      list = list.filter(n => {
        const p = (n.p6Status || '').trim().toLowerCase();
        const isKnown = ['completed', 'in progress', 'not started'].includes(p);
        const matchKnown = allowedStatuses.includes(p);
        const matchOther = allowedStatuses.includes('__other__') && !isKnown;
        return matchKnown || matchOther;
      });
    }

    if (ganttFloat !== 'all') {
      const allowedFloats = ganttFloat.split(',');
      list = list.filter(n => {
        const tf = n.totalFloat;
        return allowedFloats.some(fVal => {
          if (fVal === 'atrasados') {
            return !!n.estaAtrasadoCronograma;
          } else if (fVal === 'criticos') {
            return !!(n.diasAtrasoMaximo > 30);
          } else if (fVal === '0') {
            return tf === 0 && (n.p6Status === 'In Progress' || n.p6Status === 'Not Started');
          } else if (fVal === 'lte10') {
            return tf !== null && tf >= 0 && tf <= 10;
          } else if (fVal === 'lte20') {
            return tf !== null && tf >= 0 && tf <= 20;
          } else if (fVal === 'lte50' || fVal === 'lte45') {
            return tf !== null && tf >= 0 && tf <= 50;
          } else if (fVal === 'lte40sub') {
            return tf !== null && tf > 0 && tf < 40;
          } else if (fVal === 'gt50') {
            return tf !== null && tf > 50;
          } else if (fVal === 'sd') {
            return tf === null;
          }
          return false;
        });
      });
    }

    return list;
  }, [hojas, ganttStatus, ganttFloat]);

  const total = filteredHojas.length;

  if (!hojas.length) return null;

  const TIPO_ORDER = [
    '01.Preliminares',
    '02.Obra Civil',
    '09.Obra Arquitectonica',
    '07.Tuberia',
    '07.Tuberia_Int.',
    '07.Tuberia_Patio',
    '07.Tuberia_Ext.',
    '06.Climatizacion',
    '03.Equipo Mecanico',
    '03.Equipo Mecanico - Principal',
    '04.Equipo Electrico',
    '05.Instrumentacion y Control',
    '10.PMA',
    '11.Puesta en Marcha'
  ];

  const tipoCounts: Record<string, number> = {};
  filteredHojas.forEach(n => {
    const t = n.tipo || '(Sin tipo)';
    tipoCounts[t] = (tipoCounts[t] || 0) + 1;
  });

  const baseTipos = Array.from(new Set(hojas.map((n: any) => n.tipo || '(Sin tipo)'))) as string[];

  const tipoList = baseTipos
    .sort((a, b) => {
      const ia = TIPO_ORDER.indexOf(a);
      const ib = TIPO_ORDER.indexOf(b);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a.localeCompare(b);
    })
    .map(tipo => ({
      tipo,
      cnt: tipoCounts[tipo] || 0,
      cfg: ctTipoCfg(tipo)
    }));

  const isTipoActive = (v: string) => {
    if (v === 'all') return ganttTipo === 'all';
    return ganttTipo.split(',').includes(v);
  };
  
  const handleTipo = (v: string, e?: React.MouseEvent) => {
    setGanttExp(new Set());
    const isCtrl = e && (e.ctrlKey || e.metaKey);
    
    if (!isCtrl) {
      setGanttFloat('all');
      setGanttStatus('all');
    }
    
    if (v === 'all') {
      setGanttTipo('all');
      return;
    }
    
    if (isCtrl) {
      let currentList = ganttTipo === 'all' ? [] : ganttTipo.split(',').filter(Boolean);
      if (currentList.includes(v)) {
        currentList = currentList.filter(x => x !== v);
      } else {
        currentList.push(v);
      }
      
      if (currentList.length === 0) {
        setGanttTipo('all');
      } else {
        setGanttTipo(currentList.join(','));
      }
    } else {
      // Normal single selection
      const isActive = isTipoActive(v);
      setGanttTipo(isActive ? 'all' : v);
    }
  };

  return (
    <div className="mb-3 border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      <div 
        id="gantt-tipologia-toggle-bar"
        className="flex items-center justify-between px-4 py-2 bg-gray-50 cursor-pointer hover:bg-gray-100" 
        onClick={() => setGanttTipoOpen(o => !o)}
      >
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Tipología · {tipoList.length} tipos</span>
        <span className="text-gray-400 text-xs">{ganttTipoOpen ? '▲' : '▼'}</span>
      </div>
      {ganttTipoOpen && (
        <div id="gantt-tipologia-container" className="flex flex-wrap justify-center gap-1.5 px-1.5 py-2.5">
          <div 
            id="gantt-tip-all"
            onClick={(e) => handleTipo('all', e)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border cursor-pointer text-[9px] select-none ${ganttTipo === 'all' ? 'bg-gray-200 border-gray-400 ring-2 ring-offset-1 ring-blue-400' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
          >
            <span className="font-semibold text-gray-700">Todos</span>
            <span className="font-bold text-gray-800">{total.toLocaleString()}</span>
          </div>
          {tipoList.map(({ tipo, cnt, cfg }) => {
            const active = isTipoActive(tipo);
            const lbl = tipo.replace(/^\d+\./, '').trim();
            return (
              <div 
                key={tipo} 
                id={`gantt-tip-${tipo.replace(/[^a-zA-Z0-9]/g, '-')}`}
                onClick={(e) => handleTipo(tipo, e)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg border cursor-pointer text-[9px] select-none ${active ? `${cfg.bg} ${cfg.border} ring-2 ring-offset-1 ring-blue-400 shadow-sm` : 'bg-white border-gray-200 hover:bg-gray-50'}`}
              >
                <span className={`w-2 h-2 rounded-sm flex-shrink-0 ${cfg.bar}`} />
                <span className={`font-semibold ${active ? cfg.text : 'text-gray-600'} truncate max-w-24`}>{lbl}</span>
                <span className={`font-bold ${active ? cfg.text : 'text-gray-700'}`}>{cnt}</span>
                <span className={`px-1 py-0.5 rounded-full text-[8px] border ${active ? `${cfg.bg} ${cfg.text} ${cfg.border}` : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                  {total > 0 ? ((cnt / total) * 100).toFixed(0) : 0}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
