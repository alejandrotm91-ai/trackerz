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
  const hasPWbs = React.useMemo(() => {
    return actividades.some(a => a.esItemHoja && (normalize(a.wbs || '').startsWith('p.') || normalize(a.wbs || '').startsWith('p.D')));
  }, [actividades]);

  const hojas = React.useMemo(() => {
    return actividades.filter(a => {
      if (!a.esItemHoja) return false;
      if (hasPWbs) {
        const wbs = normalize(a.wbs || '');
        if (!(wbs.startsWith('p.') || wbs.startsWith('p.D'))) return false;
      }
      if (isIgnoredFinishDate(a.finish)) return false;
      return true;
    });
  }, [actividades, hasPWbs]);

  const filteredHojas = React.useMemo(() => {
    let list = hojas;

    if (ganttStatus !== 'all') {
      const allowedStatuses = ganttStatus.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      list = list.filter(n => {
        const rawP = String(n.p6Status || n.status || n.p6 || '').trim().toLowerCase();
        let cat = 'other';
        if (rawP === 'completed' || rawP.includes('complet') || rawP.includes('finaliz')) cat = 'completed';
        else if (rawP === 'in progress' || rawP.includes('progress') || rawP.includes('progreso') || rawP.includes('curso')) cat = 'in progress';
        else if (rawP === 'not started' || rawP.includes('not start') || rawP.includes('no inic') || rawP.includes('no-inic')) cat = 'not started';

        const matchCat = allowedStatuses.includes(cat);
        const matchRaw = allowedStatuses.includes(rawP);
        const matchOther = allowedStatuses.includes('__other__') && cat === 'other';
        return matchCat || matchRaw || matchOther;
      });
    }

    if (ganttFloat !== 'all') {
      const validFloats = hojas
        .map(n => n.totalFloat)
        .filter((f): f is number => f !== null && f !== undefined && !isNaN(Number(f)))
        .map(f => Number(f));
      const minFloat = validFloats.length > 0 ? Math.min(...validFloats) : 0;
      const hasNegativeFloat = minFloat < 0;

      const allowedFloats = ganttFloat.split(',');
      list = list.filter(n => {
        const tf = n.totalFloat;
        return allowedFloats.some(fVal => {
          if (fVal === 'atrasados') {
            return !!n.estaAtrasadoCronograma;
          } else if (fVal === 'criticos') {
            return !!(n.diasAtrasoMaximo > 30);
          } else if (fVal === 'criticas' || fVal === '0') {
            if (tf === null || tf === undefined || isNaN(Number(tf))) return false;
            const val = Number(tf);
            return hasNegativeFloat ? val === minFloat : val === 0;
          } else if (fVal === 'subcriticas' || fVal === 'negativos') {
            if (tf === null || tf === undefined || isNaN(Number(tf))) return false;
            const val = Number(tf);
            return hasNegativeFloat ? (val > minFloat && val < 0) : false;
          } else if (fVal === 'riesgosas' || fVal === 'lte20' || fVal === 'lte20sub' || fVal === 'lte40sub') {
            if (tf === null || tf === undefined || isNaN(Number(tf))) return false;
            const val = Number(tf);
            return val >= 0 && val <= 20;
          } else if (fVal === 'lte10') {
            return tf !== null && tf >= 0 && tf <= 10;
          } else if (fVal === 'lte50' || fVal === 'lte45') {
            return tf !== null && tf <= 50;
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
    <div className="mb-3 border border-[#D5DEE2] rounded-xl overflow-hidden bg-white shadow-xs">
      <div 
        id="gantt-tipologia-toggle-bar"
        className="flex items-center justify-between px-4 py-2 bg-[#F5F8F9] cursor-pointer hover:bg-[#EEF2F3] border-b border-[#D5DEE2]" 
        onClick={() => setGanttTipoOpen(o => !o)}
      >
        <span className="text-[11px] font-['Barlow_Condensed'] font-semibold text-[#14212A] uppercase tracking-wider">Tipología · <span className="text-[#5A6A74] font-mono normal-case">{tipoList.length} tipos</span></span>
        <span className="text-[#5A6A74] text-xs">{ganttTipoOpen ? '▲' : '▼'}</span>
      </div>
      {ganttTipoOpen && (
        <div id="gantt-tipologia-container" className="flex flex-wrap justify-center gap-1.5 px-1.5 py-2.5">
          <div 
            id="gantt-tip-all"
            onClick={(e) => handleTipo('all', e)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border cursor-pointer text-[9px] select-none ${ganttTipo === 'all' ? 'bg-[#FBE9E9] border-[#CD0000]/40 text-[#CD0000] ring-2 ring-offset-1 ring-[#CD0000]' : 'bg-[#F5F8F9] border-[#D5DEE2] hover:bg-[#EEF2F3]'}`}
          >
            <span className="font-semibold text-[#14212A]">Todos</span>
            <span className="font-bold font-mono text-[#14212A]">{total.toLocaleString()}</span>
          </div>
          {tipoList.map(({ tipo, cnt, cfg }) => {
            const active = isTipoActive(tipo);
            const lbl = tipo.replace(/^\d+\./, '').trim();
            return (
              <div 
                key={tipo} 
                id={`gantt-tip-${tipo.replace(/[^a-zA-Z0-9]/g, '-')}`}
                onClick={(e) => handleTipo(tipo, e)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg border cursor-pointer text-[9px] select-none ${active ? `${cfg.bg} ${cfg.border} ring-2 ring-offset-1 ring-[#CD0000] shadow-xs` : 'bg-white border-[#D5DEE2] hover:bg-[#F5F8F9]'}`}
              >
                <span className={`w-2 h-2 rounded-sm flex-shrink-0 ${cfg.bar}`} />
                <span className={`font-semibold ${active ? cfg.text : 'text-[#5A6A74]'} truncate max-w-24`}>{lbl}</span>
                <span className={`font-bold font-mono ${active ? cfg.text : 'text-[#14212A]'}`}>{cnt}</span>
                <span className={`px-1 py-0.5 rounded-full text-[8px] border ${active ? `${cfg.bg} ${cfg.text} ${cfg.border}` : 'bg-[#F5F8F9] text-[#5A6A74] border-[#D5DEE2]'}`}>
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
