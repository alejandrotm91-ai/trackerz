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
  const hojas = actividades.filter(a => {
    const wbs = normalize(a.wbs || '');
    if (!a.esItemHoja) return false;
    if (!(wbs.startsWith('p.') || wbs.startsWith('p.D'))) return false;
    if (a.totalFloat === null || a.totalFloat === undefined) return false;
    if (a.descripcion && a.descripcion.trim().toLowerCase().startsWith('procura')) return false;
    if (isIgnoredFinishDate(a.finish)) return false;
    return true;
  });
  const total = hojas.length;

  if (!total) return null;

  const counts = {
    'Completed': hojas.filter(n => n.p6Status === 'Completed').length,
    'In Progress': hojas.filter(n => n.p6Status === 'In Progress').length,
    'Not Started': hojas.filter(n => n.p6Status === 'Not Started').length,
    'other': hojas.filter(n => !['Completed', 'In Progress', 'Not Started'].includes(n.p6Status)).length,
  };
  const criticas = hojas.filter(n => n.totalFloat === 0 && (n.p6Status === 'In Progress' || n.p6Status === 'Not Started')).length;
  const subcriticas = hojas.filter(n => n.totalFloat !== null && n.totalFloat > 0 && n.totalFloat < 40).length;
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
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all select-none ${active ? `${bc} ${border} ring-2 ring-offset-1 ring-blue-400 shadow-sm` : 'bg-white border-gray-200 hover:shadow-md'}`}
    >
      <span style={{ background: color, width: 10, height: 10, borderRadius: 2, flexShrink: 0, display: 'inline-block' }} />
      <span className={`text-[10px] font-semibold ${active ? tc : 'text-gray-600'}`}>{label}</span>
      <span className={`text-xs font-bold ${active ? tc : 'text-gray-700'}`}>{cnt.toLocaleString()}</span>
      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${active ? `${bc} ${tc} ${border}` : 'bg-gray-50 text-gray-500 border-gray-200'}`}>{pct(cnt)}%</span>
    </div>
  );

  return (
    <div className="mb-3 border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      <div 
        id="gantt-metrics-toggle-bar"
        className="flex items-center justify-between px-4 py-2 bg-gray-50 cursor-pointer hover:bg-gray-100" 
        onClick={() => setGanttMetricsOpen(o => !o)}
      >
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Estado de Actividades · {total.toLocaleString()} actividades</span>
        <span className="text-gray-400 text-xs">{ganttMetricsOpen ? '▲' : '▼'}</span>
      </div>
      {ganttMetricsOpen && (
        <div id="gantt-metrics-container" className="flex flex-wrap justify-center gap-2 px-4 py-3">
          <Card id="mcard-completed" label="Completado" cnt={counts['Completed']} tc="text-green-700" bc="bg-green-50" border="border-green-300" color="#16a34a" active={isStatusActive('Completed')} onClick={(e) => handleStatus('Completed', e)} />
          <Card id="mcard-progress" label="En Curso" cnt={counts['In Progress']} tc="text-blue-700" bc="bg-blue-50" border="border-blue-300" color="#2563eb" active={isStatusActive('In Progress')} onClick={(e) => handleStatus('In Progress', e)} />
          <Card id="mcard-started" label="No inic." cnt={counts['Not Started']} tc="text-gray-600" bc="bg-gray-50" border="border-gray-300" color="#6b7280" active={isStatusActive('Not Started')} onClick={(e) => handleStatus('Not Started', e)} />
          <div className="w-px bg-gray-200 self-stretch mx-1" />
          <Card id="mcard-delayed" label="Con Atraso" cnt={atrasados} tc="text-rose-700" bc="bg-rose-50" border="border-rose-300" color="#ef4444" active={isFloatActive('atrasados')} onClick={(e) => handleFloat('atrasados', e)} />
          <Card id="mcard-critical" label="Críticas" cnt={criticas} tc="text-red-700" bc="bg-red-50" border="border-red-300" color="#dc2626" active={isFloatActive('0')} onClick={(e) => handleFloat('0', e)} />
          <Card id="mcard-subcritical" label="Subcríticas" cnt={subcriticas} tc="text-amber-700" bc="bg-amber-50" border="border-amber-300" color="#d97706" active={isFloatActive('lte40sub')} onClick={(e) => handleFloat('lte40sub', e)} />
          <Card id="mcard-criticos" label="Riesgo Crítico" cnt={riesgoCritico} tc="text-purple-700" bc="bg-purple-50" border="border-purple-300" color="#a855f7" active={isFloatActive('criticos')} onClick={(e) => handleFloat('criticos', e)} />
        </div>
      )}
    </div>
  );
};
