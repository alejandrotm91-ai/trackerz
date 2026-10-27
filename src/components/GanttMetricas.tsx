/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { isIgnoredFinishDate } from '../utils/helpers';

interface GanttMetricasProps {
  actividades: any[];
  ganttStatus: string;
  setGanttStatus: (status: string) => void;
  ganttFloat: string;
  setGanttFloat: (floatVal: string) => void;
  setGanttTipo: (tipo: string) => void;
  setGanttExp: (val: any) => void;
  ganttMetricsOpen: boolean;
  setGanttMetricsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const GanttMetricas: React.FC<GanttMetricasProps> = ({
  actividades,
  ganttStatus,
  setGanttStatus,
  ganttFloat,
  setGanttFloat,
  setGanttTipo,
  setGanttExp,
  ganttMetricsOpen,
  setGanttMetricsOpen,
}) => {
  const normalize = (wbs: string) => wbs.replace(/^p\d{4}\./, 'p.');
  const hasPWbs = actividades.some(a => a.esItemHoja && (normalize(a.wbs || '').startsWith('p.') || normalize(a.wbs || '').startsWith('p.D')));
  const hojas = actividades.filter(a => {
    if (!a.esItemHoja) return false;
    if (hasPWbs) {
      const wbs = normalize(a.wbs || '');
      if (!(wbs.startsWith('p.') || wbs.startsWith('p.D'))) return false;
    }
    if (isIgnoredFinishDate(a.finish)) return false;
    return true;
  });
  const total = hojas.length;

  if (!total) return null;

  const getStatusCategory = (n: any): 'Completed' | 'In Progress' | 'Not Started' | 'other' => {
    const s = String(n.p6Status || n.status || n.p6 || '').trim().toLowerCase();
    if (s === 'completed' || s.includes('complet') || s.includes('finaliz')) return 'Completed';
    if (s === 'in progress' || s.includes('progress') || s.includes('progreso') || s.includes('curso')) return 'In Progress';
    if (s === 'not started' || s.includes('not start') || s.includes('no inic') || s.includes('no-inic') || s.includes('no iniciad')) return 'Not Started';
    return 'other';
  };

  const validFloats = hojas
    .map(n => n.totalFloat)
    .filter((f): f is number => f !== null && f !== undefined && !isNaN(Number(f)))
    .map(f => Number(f));
  const minFloat = validFloats.length > 0 ? Math.min(...validFloats) : 0;
  const hasNegativeFloat = minFloat < 0;

  // Críticas: las actividades con el float más bajo (Ruta Crítica)
  const isCritica = (tf: any) => {
    if (tf === null || tf === undefined || isNaN(Number(tf))) return false;
    const val = Number(tf);
    return hasNegativeFloat ? val === minFloat : val === 0;
  };

  // Subcríticas: las siguientes con float negativo (minFloat < tf < 0)
  const isSubcritica = (tf: any) => {
    if (tf === null || tf === undefined || isNaN(Number(tf))) return false;
    const val = Number(tf);
    return hasNegativeFloat ? (val > minFloat && val < 0) : false;
  };

  // Riesgosas: las que tengan float entre 0 y 20 (0 <= tf <= 20)
  const isRiesgosa = (tf: any) => {
    if (tf === null || tf === undefined || isNaN(Number(tf))) return false;
    const val = Number(tf);
    return val >= 0 && val <= 20;
  };

  const counts = {
    'Completed': hojas.filter(n => getStatusCategory(n) === 'Completed').length,
    'In Progress': hojas.filter(n => getStatusCategory(n) === 'In Progress').length,
    'Not Started': hojas.filter(n => getStatusCategory(n) === 'Not Started').length,
    'other': hojas.filter(n => getStatusCategory(n) === 'other').length,
  };
  const criticas = hojas.filter(n => isCritica(n.totalFloat)).length;
  const subcriticas = hojas.filter(n => isSubcritica(n.totalFloat)).length;
  const riesgosas = hojas.filter(n => isRiesgosa(n.totalFloat)).length;
  const atrasados = hojas.filter(n => n.estaAtrasadoCronograma).length;
  const riesgoCritico = hojas.filter(n => n.diasAtrasoMaximo > 30).length;

  const isStatusActive = (v: string) => {
    if (ganttStatus === 'all') return false;
    const activeStatuses = ganttStatus.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const checkVal = (v === 'other' ? '__other__' : v).toLowerCase();
    return activeStatuses.includes(checkVal);
  };
  const isFloatActive = (v: string) => {
    if (ganttFloat === 'all') return v === 'all';
    const activeFloats = ganttFloat.split(',').map(s => s.trim()).filter(Boolean);
    if (v === 'criticas') {
      return activeFloats.includes('criticas') || activeFloats.includes('0');
    }
    if (v === 'subcriticas') {
      return activeFloats.includes('subcriticas') || activeFloats.includes('negativos');
    }
    if (v === 'riesgosas') {
      return activeFloats.includes('riesgosas') || activeFloats.includes('lte20') || activeFloats.includes('lte20sub') || activeFloats.includes('lte40sub');
    }
    return activeFloats.includes(v);
  };

  const handleStatus = (v: string, e?: React.MouseEvent) => {
    setGanttExp(new Set());
    const isCtrl = e && (e.ctrlKey || e.metaKey);
    if (!isCtrl) {
      setGanttFloat('all');
    }
    
    const targetVal = v === 'other' ? '__other__' : v;
    let currentList = ganttStatus === 'all' ? [] : ganttStatus.split(',').map(s => s.trim()).filter(Boolean);
    
    if (isCtrl) {
      if (currentList.some(s => s.toLowerCase() === targetVal.toLowerCase())) {
        currentList = currentList.filter(x => x.toLowerCase() !== targetVal.toLowerCase());
      } else {
        currentList.push(targetVal);
      }
      setGanttStatus(currentList.length === 0 ? 'all' : currentList.join(','));
    } else {
      if (currentList.length > 1 && currentList.some(s => s.toLowerCase() === targetVal.toLowerCase())) {
        currentList = currentList.filter(x => x.toLowerCase() !== targetVal.toLowerCase());
        setGanttStatus(currentList.length === 0 ? 'all' : currentList.join(','));
      } else {
        const isActive = currentList.length === 1 && currentList[0].toLowerCase() === targetVal.toLowerCase();
        setGanttTipo('all');
        setGanttStatus(isActive ? 'all' : targetVal);
      }
    }
  };

  const handleFloat = (v: string, e?: React.MouseEvent) => {
    setGanttExp(new Set());
    const isCtrl = e && (e.ctrlKey || e.metaKey);
    if (!isCtrl) {
      setGanttTipo('all');
      setGanttStatus('all');
    }
    
    if (isCtrl) {
      let currentList = ganttFloat === 'all' ? [] : ganttFloat.split(',').filter(Boolean);
      if (currentList.includes(v)) {
        currentList = currentList.filter(x => x !== v);
      } else {
        currentList.push(v);
      }
      
      if (currentList.length === 0) {
        setGanttFloat('all');
      } else {
        setGanttFloat(currentList.join(','));
      }
    } else {
      const isActive = isFloatActive(v);
      setGanttFloat(isActive ? 'all' : v);
    }
  };

  const pct = (n: number) => total > 0 ? ((n / total) * 100).toFixed(1) : '0';

  const Card: React.FC<{
    id: string;
    label: string;
    cnt: number;
    tc: string;
    bc: string;
    border: string;
    color: string;
    active: boolean;
    onClick: (e: React.MouseEvent) => void;
  }> = ({ id, label, cnt, tc, bc, border, color, active, onClick }) => (
    <div 
      id={id}
      onClick={onClick} 
      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border cursor-pointer text-[9.5px] select-none shrink-0 transition-all ${active ? `${bc} ${border} ring-2 ring-offset-1 ring-[#442dd7] shadow-xs` : 'bg-white border-[#D5DEE2] hover:bg-[#F5F8F9]'}`}
      title={`${label}: ${cnt.toLocaleString()} (${pct(cnt)}%)`}
    >
      <span style={{ background: color, width: 8, height: 8, borderRadius: 2, flexShrink: 0, display: 'inline-block' }} />
      <span className={`font-semibold ${active ? tc : 'text-[#5A6A74]'} truncate`}>{label}</span>
      <span className={`font-bold font-mono ${active ? tc : 'text-[#14212A]'}`}>{cnt.toLocaleString()}</span>
      <span className={`px-1 py-0.5 rounded-full text-[8px] font-medium border ${active ? `${bc} ${tc} ${border}` : 'bg-[#F5F8F9] text-[#5A6A74] border-[#D5DEE2]'}`}>
        {pct(cnt)}%
      </span>
    </div>
  );

  return (
    <div className="mb-3 border border-[#D5DEE2] rounded-xl overflow-hidden bg-white shadow-xs">
      <div 
        id="gantt-metrics-toggle-bar"
        className="flex items-center justify-between px-4 py-2 bg-[#F5F8F9] cursor-pointer hover:bg-[#EEF2F3] border-b border-[#D5DEE2]" 
        onClick={() => setGanttMetricsOpen(o => !o)}
      >
        <span className="text-[11px] font-['Barlow_Condensed'] font-semibold text-[#14212A] uppercase tracking-wider">Estado de Actividades · <span className="text-[#5A6A74] font-mono normal-case">{total.toLocaleString()} actividades</span></span>
        <span className="text-[#5A6A74] text-xs">{ganttMetricsOpen ? '▲' : '▼'}</span>
      </div>
      {ganttMetricsOpen && (
        <div id="gantt-metrics-container" className="flex items-center justify-center gap-1.5 px-2 py-2 w-full overflow-x-auto flex-nowrap">
          <Card id="mcard-completed" label="Completado" cnt={counts['Completed']} tc="text-green-700" bc="bg-green-50" border="border-green-300" color="#2B7F52" active={isStatusActive('Completed')} onClick={(e) => handleStatus('Completed', e)} />
          <Card id="mcard-progress" label="En Curso" cnt={counts['In Progress']} tc="text-[#442dd7]" bc="bg-[#EEECFB]" border="border-[#442dd7]/30" color="#442dd7" active={isStatusActive('In Progress')} onClick={(e) => handleStatus('In Progress', e)} />
          <Card id="mcard-started" label="No inic." cnt={counts['Not Started']} tc="text-gray-600" bc="bg-gray-50" border="border-[#D5DEE2]" color="#6b7280" active={isStatusActive('Not Started')} onClick={(e) => handleStatus('Not Started', e)} />
          <Card id="mcard-delayed" label="Con Atraso" cnt={atrasados} tc="text-[#B83227]" bc="bg-rose-50" border="border-rose-300" color="#B83227" active={isFloatActive('atrasados')} onClick={(e) => handleFloat('atrasados', e)} />
          <Card id="mcard-critical" label={hasNegativeFloat ? `RC (${minFloat}d)` : "RC"} cnt={criticas} tc="text-[#B83227]" bc="bg-rose-50" border="border-rose-300" color="#B83227" active={isFloatActive('criticas')} onClick={(e) => handleFloat('criticas', e)} />
          <Card id="mcard-subcritical" label="SubCrit." cnt={subcriticas} tc="text-[#A86B12]" bc="bg-amber-50" border="border-amber-300" color="#A86B12" active={isFloatActive('subcriticas')} onClick={(e) => handleFloat('subcriticas', e)} />
          <Card id="mcard-riesgosas" label="Risk" cnt={riesgosas} tc="text-[#A86B12]" bc="bg-amber-50" border="border-amber-300" color="#A86B12" active={isFloatActive('riesgosas')} onClick={(e) => handleFloat('riesgosas', e)} />
          <Card id="mcard-criticos" label="R. Crítico" cnt={riesgoCritico} tc="text-purple-700" bc="bg-purple-50" border="border-purple-300" color="#7c3aed" active={isFloatActive('criticos')} onClick={(e) => handleFloat('criticos', e)} />
        </div>
      )}
    </div>
  );
};
