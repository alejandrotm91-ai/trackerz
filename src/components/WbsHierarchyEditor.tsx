import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ChevronDown, ChevronRight, Folder, FolderOpen, FileText, Plus, Trash2, X, Save, Edit2, 
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ChevronsUpDown, ChevronsDownUp, 
  Search, Copy, Check, FileSpreadsheet, Layers
} from 'lucide-react';
import { Actividad } from '../types';
import { compareWbs } from '../utils/masterCdoHierarchy';

interface WbsHierarchyEditorProps {
  isOpen: boolean;
  onClose: () => void;
  actividades: Actividad[];
  onUpdateActividad?: (id: string, updates: Partial<Actividad>) => void;
  onAddActividad?: (newActividad: Actividad) => void;
  onDeleteActividad?: (id: string) => void;
}

// Helper to determine depth of a WBS string
function getWbsDepth(wbs: string): number {
  if (!wbs) return 0;
  const parts = wbs.trim().split('.');
  if (/^[pP]\d+/.test(parts[0])) {
    return Math.max(0, parts.length - 2);
  }
  return Math.max(0, parts.length - 1);
}

export function WbsHierarchyEditor({ 
  isOpen, 
  onClose, 
  actividades, 
  onUpdateActividad, 
  onAddActividad, 
  onDeleteActividad 
}: WbsHierarchyEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [displayLimit, setDisplayLimit] = useState<number>(120);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  // Edit Form state
  const [editWbs, setEditWbs] = useState<string>('');
  const [editDesc, setEditDesc] = useState<string>('');
  const [editStart, setEditStart] = useState<string>('');
  const [editFinish, setEditFinish] = useState<string>('');

  // 1. Sort actividades cleanly by WBS
  const sortedActividades = useMemo(() => {
    return [...actividades].sort((a, b) => compareWbs(a.wbs || '', b.wbs || ''));
  }, [actividades]);

  // 2. Build full parent set covering ALL ancestor levels (not just immediate parents)
  const parentWbsSet = useMemo(() => {
    const set = new Set<string>();
    sortedActividades.forEach(a => {
      const parts = (a.wbs || '').trim().split('.');
      for (let i = 1; i < parts.length; i++) {
        set.add(parts.slice(0, i).join('.'));
      }
    });
    return set;
  }, [sortedActividades]);

  // 3. Compact by default: initialize collapsed state collapsing all parents at depth >= 1
  const [collapsedWbs, setCollapsedWbs] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    actividades.forEach(a => {
      const parts = (a.wbs || '').trim().split('.');
      for (let i = 1; i < parts.length; i++) {
        const prefix = parts.slice(0, i).join('.');
        const depth = getWbsDepth(prefix);
        if (depth >= 1) {
          initial.add(prefix);
        }
      }
    });
    return initial;
  });

  // Reset display limit and ensure initial compact selection whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setDisplayLimit(120);
      if (sortedActividades.length > 0 && !selectedId) {
        setSelectedId(sortedActividades[0].id);
      }
    }
  }, [isOpen, sortedActividades, selectedId]);

  // 4. Determine visible rows according to collapsed parents & search filter
  const visibleActividades = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    
    // If search is active, match search and expand all ancestors
    if (term) {
      return sortedActividades.filter(act => {
        const wbs = (act.wbs || '').toLowerCase();
        const desc = (act.descripcion || '').toLowerCase();
        return wbs.includes(term) || desc.includes(term);
      });
    }

    // Normal hierarchical tree filtering
    return sortedActividades.filter(act => {
      const wbs = (act.wbs || '').trim();
      let isHidden = false;
      let current = wbs;
      while (current.includes('.')) {
        current = current.substring(0, current.lastIndexOf('.'));
        if (collapsedWbs.has(current)) {
          isHidden = true;
          break;
        }
      }
      return !isHidden;
    });
  }, [sortedActividades, collapsedWbs, searchTerm]);

  // Limited slice for fast rendering, avoiding main-thread lockups
  const renderedActividades = useMemo(() => {
    return visibleActividades.slice(0, displayLimit);
  }, [visibleActividades, displayLimit]);

  // Infinite scroll trigger
  const handleScroll = () => {
    if (!tableContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = tableContainerRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 200) {
      if (displayLimit < visibleActividades.length) {
        setDisplayLimit(prev => Math.min(prev + 100, visibleActividades.length));
      }
    }
  };

  // 5. Hierarchy Level Selection (Excel Outline levels: 1, 2, 3, 4, All, Collapse)
  const applyHierarchyLevel = (level: number | 'all') => {
    if (level === 'all') {
      setCollapsedWbs(new Set());
      return;
    }

    const newCollapsed = new Set<string>();
    parentWbsSet.forEach(pWbs => {
      const depth = getWbsDepth(pWbs);
      // If parent depth is greater or equal to level, collapse it so only up to 'level' is visible
      if (depth >= level) {
        newCollapsed.add(pWbs);
      }
    });
    setCollapsedWbs(newCollapsed);
  };

  const collapseAll = () => {
    const allParents = new Set<string>(parentWbsSet);
    setCollapsedWbs(allParents);
  };

  const expandAll = () => {
    setCollapsedWbs(new Set());
  };

  // Toggle single parent
  const toggleCollapse = (wbs: string) => {
    setCollapsedWbs(prev => {
      const next = new Set(prev);
      if (next.has(wbs)) {
        next.delete(wbs);
      } else {
        next.add(wbs);
      }
      return next;
    });
  };

  // Currently selected item for formula bar
  const selectedActividad = useMemo(() => {
    return sortedActividades.find(a => a.id === selectedId) || null;
  }, [sortedActividades, selectedId]);

  // Editing helpers
  const startEdit = (act: Actividad) => {
    setEditingId(act.id);
    setSelectedId(act.id);
    setEditWbs(act.wbs || '');
    setEditDesc(act.descripcion || '');
    setEditStart(act.start ? new Date(act.start).toISOString().split('T')[0] : '');
    setEditFinish(act.finish ? new Date(act.finish).toISOString().split('T')[0] : '');
  };

  const saveEdit = (id: string) => {
    if (onUpdateActividad) {
      onUpdateActividad(id, {
        wbs: editWbs,
        descripcion: editDesc,
        start: editStart ? new Date(editStart + 'T00:00:00') : null,
        finish: editFinish ? new Date(editFinish + 'T00:00:00') : null,
      });
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  // Add new child activity
  const handleAdd = (parentWbs: string) => {
    if (!onAddActividad) return;
    const newId = 'new-' + Date.now();
    
    const children = sortedActividades.filter(a => {
      const parts = (a.wbs || '').split('.');
      return parts.length > 1 && parts.slice(0, -1).join('.') === parentWbs;
    });
    
    let nextNum = 1;
    if (children.length > 0) {
      const lastChildParts = (children[children.length - 1].wbs || '').split('.');
      const lastSeg = lastChildParts[lastChildParts.length - 1];
      if (!isNaN(Number(lastSeg))) {
        nextNum = Number(lastSeg) + 1;
      } else {
        nextNum = children.length + 1;
      }
    }

    const newWbs = `${parentWbs}.${nextNum}`;

    onAddActividad({
      id: newId,
      wbs: newWbs,
      activityId: newId,
      descripcion: 'Nueva Partida WBS',
      unidad: 'UND',
      nivel: newWbs.split('.').length,
      esItemHoja: true,
      venta: 0, ventaM: 0, ventaPlan: 0, ventaEjecutada: 0, balance: 0, saldo: 0, excedente: 0,
      partidas: '', tipo: '', subcontratista: '', ubicacion: '', proceso: '', cap: '', scap: '', macro: '', componente: '', unit: '', resp: '', status: '', ventaFebrero: 0,
      certificaciones: {}, certificacionesPorFecha: {}, blStart: null, blFinish: null, start: null, finish: null,
      diasAtrasoInicio: 0, diasAtrasoFin: 0, diasAtrasoMaximo: 0, estaAtrasadoCronograma: false, totalFloat: 0, p6Status: ''
    });

    // Ensure the parent is expanded so the user sees the new child immediately
    setCollapsedWbs(prev => {
      const next = new Set(prev);
      next.delete(parentWbs);
      return next;
    });
    setSelectedId(newId);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Deseas eliminar esta partida de la estructura WBS?')) {
      if (onDeleteActividad) onDeleteActividad(id);
      if (selectedId === id) setSelectedId(null);
    }
  };

  // Reordering & Indentation
  const getSiblings = (wbs: string) => {
    const parts = wbs.split('.');
    const parentWbs = parts.length > 1 ? parts.slice(0, -1).join('.') : null;
    return sortedActividades.filter(a => {
      const aParts = (a.wbs || '').split('.');
      const aParent = aParts.length > 1 ? aParts.slice(0, -1).join('.') : null;
      return aParent === parentWbs;
    });
  };

  const moveUp = () => {
    if (!selectedId || !onUpdateActividad) return;
    const act = sortedActividades.find(a => a.id === selectedId);
    if (!act || !act.wbs) return;
    
    const siblings = getSiblings(act.wbs);
    const idx = siblings.findIndex(s => s.id === selectedId);
    if (idx > 0) {
      const prev = siblings[idx - 1];
      const actParts = act.wbs.split('.');
      const prevParts = (prev.wbs || '').split('.');
      
      const actLast = actParts.pop()!;
      const prevLast = prevParts.pop()!;
      
      const actNewWbs = [...actParts, prevLast].join('.');
      const prevNewWbs = [...prevParts, actLast].join('.');

      onUpdateActividad(act.id, { wbs: actNewWbs });
      onUpdateActividad(prev.id, { wbs: prevNewWbs });
      
      sortedActividades.forEach(desc => {
        if (desc.wbs?.startsWith(act.wbs + '.')) {
          onUpdateActividad(desc.id, { wbs: desc.wbs.replace(act.wbs!, actNewWbs) });
        } else if (desc.wbs?.startsWith(prev.wbs + '.')) {
          onUpdateActividad(desc.id, { wbs: desc.wbs.replace(prev.wbs!, prevNewWbs) });
        }
      });
    }
  };

  const moveDown = () => {
    if (!selectedId || !onUpdateActividad) return;
    const act = sortedActividades.find(a => a.id === selectedId);
    if (!act || !act.wbs) return;
    
    const siblings = getSiblings(act.wbs);
    const idx = siblings.findIndex(s => s.id === selectedId);
    if (idx !== -1 && idx < siblings.length - 1) {
      const next = siblings[idx + 1];
      const actParts = act.wbs.split('.');
      const nextParts = (next.wbs || '').split('.');
      
      const actLast = actParts.pop()!;
      const nextLast = nextParts.pop()!;
      
      const actNewWbs = [...actParts, nextLast].join('.');
      const nextNewWbs = [...nextParts, actLast].join('.');

      onUpdateActividad(act.id, { wbs: actNewWbs });
      onUpdateActividad(next.id, { wbs: nextNewWbs });
      
      sortedActividades.forEach(desc => {
        if (desc.wbs?.startsWith(act.wbs + '.')) {
          onUpdateActividad(desc.id, { wbs: desc.wbs.replace(act.wbs!, actNewWbs) });
        } else if (desc.wbs?.startsWith(next.wbs + '.')) {
          onUpdateActividad(desc.id, { wbs: desc.wbs.replace(next.wbs!, nextNewWbs) });
        }
      });
    }
  };

  const moveLeft = () => {
    if (!selectedId || !onUpdateActividad) return;
    const act = sortedActividades.find(a => a.id === selectedId);
    if (!act || !act.wbs) return;
    
    const parts = act.wbs.split('.');
    if (parts.length <= 1) return;

    const grandparentWbs = parts.length > 2 ? parts.slice(0, -2).join('.') : null;
    
    const uncleSiblings = grandparentWbs 
      ? sortedActividades.filter(a => {
          const p = (a.wbs || '').split('.');
          return p.length > 1 && p.slice(0, -1).join('.') === grandparentWbs;
        })
      : sortedActividades.filter(a => !a.wbs?.includes('.'));
      
    let nextNum = 1;
    if (uncleSiblings.length > 0) {
      const lastUncleParts = (uncleSiblings[uncleSiblings.length - 1].wbs || '').split('.');
      const lastSeg = lastUncleParts[lastUncleParts.length - 1];
      if (!isNaN(Number(lastSeg))) nextNum = Number(lastSeg) + 1;
      else nextNum = uncleSiblings.length + 1;
    }
    
    const newWbs = grandparentWbs ? `${grandparentWbs}.${nextNum}` : `p0${nextNum}26`;
    
    onUpdateActividad(act.id, { wbs: newWbs, nivel: newWbs.split('.').length });
    
    sortedActividades.forEach(desc => {
      if (desc.wbs?.startsWith(act.wbs + '.')) {
        const descNewWbs = desc.wbs.replace(act.wbs!, newWbs);
        onUpdateActividad(desc.id, { wbs: descNewWbs, nivel: descNewWbs.split('.').length });
      }
    });
  };

  const moveRight = () => {
    if (!selectedId || !onUpdateActividad) return;
    const act = sortedActividades.find(a => a.id === selectedId);
    if (!act || !act.wbs) return;
    
    const siblings = getSiblings(act.wbs);
    const idx = siblings.findIndex(s => s.id === selectedId);
    if (idx > 0) {
      const prevSibling = siblings[idx - 1];
      const prevWbs = prevSibling.wbs || '';
      
      const nephews = sortedActividades.filter(a => {
        const p = (a.wbs || '').split('.');
        return p.length > 1 && p.slice(0, -1).join('.') === prevWbs;
      });
      
      let nextNum = 1;
      if (nephews.length > 0) {
        const lastNephewParts = (nephews[nephews.length - 1].wbs || '').split('.');
        const lastSeg = lastNephewParts[lastNephewParts.length - 1];
        if (!isNaN(Number(lastSeg))) nextNum = Number(lastSeg) + 1;
        else nextNum = nephews.length + 1;
      }
      
      const newWbs = `${prevWbs}.${nextNum}`;
      
      onUpdateActividad(act.id, { wbs: newWbs, nivel: newWbs.split('.').length });
      
      sortedActividades.forEach(desc => {
        if (desc.wbs?.startsWith(act.wbs + '.')) {
          const descNewWbs = desc.wbs.replace(act.wbs!, newWbs);
          onUpdateActividad(desc.id, { wbs: descNewWbs, nivel: descNewWbs.split('.').length });
        }
      });
      
      // Ensure the new parent is expanded
      setCollapsedWbs(prev => {
        const next = new Set(prev);
        next.delete(prevWbs);
        return next;
      });
    }
  };

  // Copy visible items to clipboard in Excel-ready TSV format
  const copyToExcel = () => {
    const headers = ['Nivel', 'WBS', 'Descripción', 'Unidad', 'Inicio', 'Fin', 'Tipo'];
    const rows = visibleActividades.map(act => {
      const depth = getWbsDepth(act.wbs || '');
      const startStr = act.start ? new Date(act.start).toISOString().split('T')[0] : '';
      const finishStr = act.finish ? new Date(act.finish).toISOString().split('T')[0] : '';
      const isParent = parentWbsSet.has(act.wbs || '') || !act.esItemHoja;
      return [
        depth + 1,
        act.wbs || '',
        act.descripcion || '',
        act.unidad || 'UND',
        startStr,
        finishStr,
        isParent ? 'Resumen / Capítulo' : 'Partida Hoja'
      ].join('\t');
    });

    const tsv = [headers.join('\t'), ...rows].join('\n');
    navigator.clipboard.writeText(tsv).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex flex-col font-sans select-none animate-fade-in">
      {/* ── 1. EXCEL GREEN MAIN RIBBON HEADER ──────────────────────────── */}
      <header className="bg-[#107c41] text-white shrink-0 shadow-md border-b border-[#0d6535]">
        <div className="h-12 px-4 flex items-center justify-between gap-3">
          {/* Title & Excel Branding */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-sm bg-white/10 border border-white/20 flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-sm text-white tracking-tight leading-none">
                  Estructura WBS • Microsoft Excel-Like
                </h1>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/20 text-white tracking-wider uppercase">
                  v2.0
                </span>
              </div>
              <p className="text-[11px] text-emerald-100/90 leading-tight mt-0.5">
                Work Breakdown Structure & Jerarquía de Partidas CDO
              </p>
            </div>
          </div>

          {/* Quick Search */}
          <div className="relative w-64 md:w-80">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por WBS o descripción..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white text-slate-800 text-xs rounded pl-8 pr-7 py-1.5 outline-none placeholder:text-slate-400 border border-emerald-300 shadow-inner focus:ring-2 focus:ring-white/40"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyToExcel}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors cursor-pointer border border-white/20"
              title="Copiar tabla visible al portapapeles en formato TSV / Excel"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado' : 'Copiar Excel'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Cerrar ventana WBS"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── 2. EXCEL COMMAND TOOLBAR (Outline Levels & Tree Navigation) ── */}
        <div className="bg-[#f3f4f6] text-slate-700 border-t border-slate-200 px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Left: Outline Level Grouping (Excel Outline 1, 2, 3, 4, All) */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-slate-600" />
              Nivel:
            </span>
            <div className="inline-flex bg-white rounded border border-slate-300 p-0.5 shadow-2xs font-mono">
              <button
                type="button"
                onClick={() => applyHierarchyLevel(0)}
                className="px-2 py-0.5 rounded text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
                title="Nivel 0: Totalmente compactado a raíces"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => applyHierarchyLevel(1)}
                className="px-2 py-0.5 rounded text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
                title="Nivel 1: Capítulos principales"
              >
                1
              </button>
              <button
                type="button"
                onClick={() => applyHierarchyLevel(2)}
                className="px-2 py-0.5 rounded text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
                title="Nivel 2: Subcapítulos"
              >
                2
              </button>
              <button
                type="button"
                onClick={() => applyHierarchyLevel(3)}
                className="px-2 py-0.5 rounded text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
                title="Nivel 3: Paquetes"
              >
                3
              </button>
              <button
                type="button"
                onClick={() => applyHierarchyLevel('all')}
                className="px-2.5 py-0.5 rounded text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
                title="Mostrar todos los niveles (Desplegado completo)"
              >
                Todo
              </button>
            </div>

            <div className="h-4 w-px bg-slate-300 mx-1"></div>

            <button
              type="button"
              onClick={expandAll}
              className="flex items-center gap-1 px-2 py-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-medium text-xs shadow-2xs cursor-pointer"
              title="Expandir todos los nodos"
            >
              <ChevronsUpDown className="w-3.5 h-3.5 text-slate-600" />
              <span>Expandir</span>
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="flex items-center gap-1 px-2 py-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-medium text-xs shadow-2xs cursor-pointer"
              title="Colapsar todos los nodos"
            >
              <ChevronsDownUp className="w-3.5 h-3.5 text-slate-600" />
              <span>Colapsar</span>
            </button>
          </div>

          {/* Right: Structure Reordering & Outdent / Indent */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Estructura:
            </span>
            <div className="flex items-center bg-white border border-slate-300 rounded shadow-2xs p-0.5">
              <button 
                type="button"
                onClick={moveUp} 
                disabled={!selectedId} 
                className="p-1 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed rounded text-slate-700 transition-colors cursor-pointer" 
                title="Subir (Mismo nivel WBS)"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button 
                type="button"
                onClick={moveDown} 
                disabled={!selectedId} 
                className="p-1 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed rounded text-slate-700 transition-colors cursor-pointer" 
                title="Bajar (Mismo nivel WBS)"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <div className="h-4 w-px bg-slate-200 mx-0.5"></div>
              <button 
                type="button"
                onClick={moveLeft} 
                disabled={!selectedId} 
                className="p-1 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed rounded text-slate-700 transition-colors cursor-pointer" 
                title="Reducir sangría (Promover a nivel superior)"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <button 
                type="button"
                onClick={moveRight} 
                disabled={!selectedId} 
                className="p-1 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed rounded text-slate-700 transition-colors cursor-pointer" 
                title="Aumentar sangría (Hacer sub-partida de la anterior)"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {selectedActividad && (
              <button
                type="button"
                onClick={() => handleAdd(selectedActividad.wbs || '')}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#107c41] hover:bg-[#0d6535] text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                title="Crear nueva partida hija bajo la selección"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Sub-Partida</span>
              </button>
            )}
          </div>
        </div>

        {/* ── 3. EXCEL FORMULA BAR & STATUS STRIP ────────────────────────── */}
        <div className="bg-white border-t border-slate-300 px-4 py-1.5 flex items-center gap-3 text-xs">
          {/* Name Box (Excel A1 coordinate style) */}
          <div className="w-28 shrink-0 flex items-center justify-center bg-slate-100 border border-slate-300 rounded px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700 select-all">
            {selectedActividad ? selectedActividad.wbs || 'WBS' : 'A1'}
          </div>

          <div className="h-4 w-px bg-slate-300"></div>

          {/* fx Formula Icon */}
          <span className="font-serif italic font-bold text-slate-400 text-sm select-none">
            fx
          </span>

          {/* Formula content / Active item description */}
          <div className="flex-1 truncate font-mono text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded px-2.5 py-0.5">
            {selectedActividad ? (
              <span>
                <strong className="text-emerald-700">{selectedActividad.wbs}</strong> • {selectedActividad.descripcion}
                {selectedActividad.unidad ? ` [${selectedActividad.unidad}]` : ''}
              </span>
            ) : (
              <span className="text-slate-400 italic">Seleccione una fila para inspeccionar o editar</span>
            )}
          </div>

          {/* Status Counter */}
          <div className="shrink-0 text-[11px] text-slate-500 font-medium">
            Mostrando <strong className="text-slate-800">{renderedActividades.length}</strong> de <strong className="text-slate-800">{visibleActividades.length}</strong> visibles ({sortedActividades.length} totales)
          </div>
        </div>
      </header>

      {/* ── 4. EXCEL SHEET GRID ────────────────────────────────────────── */}
      <main 
        ref={tableContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto bg-[#e5e7eb] p-2"
      >
        <div className="bg-white border border-slate-300 shadow-sm min-w-max inline-block w-full">
          <table className="w-full text-left border-collapse text-xs font-sans">
            {/* Excel Header with column letters */}
            <thead className="sticky top-0 z-10 bg-[#f3f4f6] text-slate-700 shadow-xs select-none">
              {/* Excel Letters row */}
              <tr className="border-b border-slate-300 text-[10px] font-mono text-slate-500 text-center uppercase">
                <th className="w-12 border-r border-slate-300 py-1 bg-slate-200">#</th>
                <th className="w-10 border-r border-slate-300 py-1 bg-slate-200">A</th>
                <th className="w-64 border-r border-slate-300 py-1 bg-slate-200">B</th>
                <th className="border-r border-slate-300 py-1 bg-slate-200">C</th>
                <th className="w-16 border-r border-slate-300 py-1 bg-slate-200">D</th>
                <th className="w-24 border-r border-slate-300 py-1 bg-slate-200">E</th>
                <th className="w-24 border-r border-slate-300 py-1 bg-slate-200">F</th>
                <th className="w-28 border-r border-slate-300 py-1 bg-slate-200">G</th>
                <th className="w-24 py-1 bg-slate-200">H</th>
              </tr>
              {/* Real Descriptive Column Headers */}
              <tr className="border-b border-slate-300 text-slate-800 font-bold bg-[#f8fafc]">
                <th className="w-12 border-r border-slate-300 py-2 px-1 text-center font-mono text-slate-400">
                  Fila
                </th>
                <th className="w-10 border-r border-slate-300 py-2 text-center">
                  Exp
                </th>
                <th className="w-64 border-r border-slate-300 py-2 px-3">
                  Código WBS
                </th>
                <th className="border-r border-slate-300 py-2 px-3">
                  Descripción de Partida / Entregable
                </th>
                <th className="w-16 border-r border-slate-300 py-2 px-2 text-center">
                  UND
                </th>
                <th className="w-24 border-r border-slate-300 py-2 px-2 text-center">
                  Inicio
                </th>
                <th className="w-24 border-r border-slate-300 py-2 px-2 text-center">
                  Fin
                </th>
                <th className="w-28 border-r border-slate-300 py-2 px-2 text-center">
                  Tipo WBS
                </th>
                <th className="w-24 py-2 px-2 text-center">
                  Acciones
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {renderedActividades.map((act, index) => {
                const wbs = (act.wbs || '').trim();
                const depth = getWbsDepth(wbs);
                const isParent = parentWbsSet.has(wbs) || !act.esItemHoja;
                const isCollapsed = collapsedWbs.has(wbs);
                const isEditing = editingId === act.id;
                const isSelected = selectedId === act.id;

                // Hierarchy row style depending on depth
                const isRoot = depth === 0;
                const isSubChapter = depth === 1;

                return (
                  <tr
                    key={act.id}
                    onClick={() => {
                      if (!isEditing) setSelectedId(act.id);
                    }}
                    onDoubleClick={() => {
                      if (isParent) {
                        toggleCollapse(wbs);
                      } else {
                        startEdit(act);
                      }
                    }}
                    className={`border-b border-slate-300 h-8 transition-colors group cursor-pointer ${
                      isSelected 
                        ? 'bg-emerald-50/70 outline outline-2 outline-[#107c41] -outline-offset-1 z-5 relative'
                        : isRoot
                          ? 'bg-slate-100/90 font-bold hover:bg-slate-200/70'
                          : isSubChapter
                            ? 'bg-slate-50/80 font-semibold hover:bg-slate-100'
                            : index % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-[#fafafa] hover:bg-slate-100/60'
                    }`}
                  >
                    {/* Row Index (Excel Line Number) */}
                    <td className={`border-r border-slate-300 text-center font-mono text-[11px] select-none ${
                      isSelected ? 'bg-emerald-100 text-emerald-900 font-bold' : 'bg-[#f8fafc] text-slate-500'
                    }`}>
                      {index + 1}
                    </td>

                    {/* Expand / Collapse Button */}
                    <td 
                      className="border-r border-slate-300 text-center p-0"
                      onClick={e => {
                        e.stopPropagation();
                        if (isParent) toggleCollapse(wbs);
                      }}
                    >
                      {isParent ? (
                        <button
                          type="button"
                          className="w-full h-full flex items-center justify-center text-slate-600 hover:text-emerald-700 hover:bg-emerald-100/50 transition-colors cursor-pointer"
                          title={isCollapsed ? 'Expandir nivel' : 'Colapsar nivel'}
                        >
                          {isCollapsed ? (
                            <ChevronRight className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      ) : (
                        <span className="text-slate-300 text-[10px]">•</span>
                      )}
                    </td>

                    {/* WBS Code with Tree Indentation */}
                    <td className="border-r border-slate-300 py-1 px-3">
                      <div 
                        className="flex items-center gap-1.5 font-mono text-xs"
                        style={{ paddingLeft: `${Math.min(depth * 18, 120)}px` }}
                      >
                        {isParent ? (
                          isCollapsed ? (
                            <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          ) : (
                            <FolderOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          )
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}

                        {isEditing ? (
                          <input
                            type="text"
                            value={editWbs}
                            onChange={e => setEditWbs(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            className="border border-[#107c41] bg-white rounded px-1.5 py-0.5 text-xs font-mono font-bold w-full outline-none ring-1 ring-[#107c41]"
                          />
                        ) : (
                          <span className={`tracking-tight ${
                            isRoot ? 'font-black text-slate-900' : isSubChapter ? 'font-bold text-slate-800' : 'text-slate-700'
                          }`}>
                            {wbs || '-'}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Description */}
                    <td className="border-r border-slate-300 py-1 px-3">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editDesc}
                          onChange={e => setEditDesc(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="border border-[#107c41] bg-white rounded px-1.5 py-0.5 text-xs w-full outline-none ring-1 ring-[#107c41]"
                        />
                      ) : (
                        <span className={`truncate block ${
                          isRoot ? 'font-black text-slate-900' : isSubChapter ? 'font-bold text-slate-800' : 'text-slate-700'
                        }`} title={act.descripcion}>
                          {act.descripcion || 'Sin descripción'}
                        </span>
                      )}
                    </td>

                    {/* Unit */}
                    <td className="border-r border-slate-300 py-1 px-2 text-center font-mono text-[11px] text-slate-600">
                      {act.unidad || 'UND'}
                    </td>

                    {/* Start Date */}
                    <td className="border-r border-slate-300 py-1 px-2 text-center font-mono text-[11px]">
                      {isEditing ? (
                        <input
                          type="date"
                          value={editStart}
                          onChange={e => setEditStart(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="border border-[#107c41] bg-white rounded px-1 py-0.5 text-[10px] w-full outline-none"
                        />
                      ) : (
                        <span className="text-slate-600">
                          {act.start ? new Date(act.start).toISOString().split('T')[0] : '-'}
                        </span>
                      )}
                    </td>

                    {/* Finish Date */}
                    <td className="border-r border-slate-300 py-1 px-2 text-center font-mono text-[11px]">
                      {isEditing ? (
                        <input
                          type="date"
                          value={editFinish}
                          onChange={e => setEditFinish(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="border border-[#107c41] bg-white rounded px-1 py-0.5 text-[10px] w-full outline-none"
                        />
                      ) : (
                        <span className="text-slate-600">
                          {act.finish ? new Date(act.finish).toISOString().split('T')[0] : '-'}
                        </span>
                      )}
                    </td>

                    {/* WBS Node Type Badge */}
                    <td className="border-r border-slate-300 py-1 px-2 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        isRoot
                          ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          : isSubChapter
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : isParent
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {isRoot ? 'Capítulo' : isSubChapter ? 'Subcapítulo' : isParent ? 'Paquete' : 'Partida'}
                      </span>
                    </td>

                    {/* Row Action Buttons */}
                    <td className="py-1 px-2 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveEdit(act.id)}
                              className="p-1 bg-emerald-600 text-white hover:bg-emerald-700 rounded transition-colors cursor-pointer"
                              title="Guardar cambios"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="p-1 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded transition-colors cursor-pointer"
                              title="Cancelar edición"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(act)}
                              className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                              title="Editar fila"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdd(wbs)}
                              className="p-1 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                              title="Agregar sub-partida"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(act.id)}
                              className="p-1 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors cursor-pointer"
                              title="Eliminar partida"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {visibleActividades.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 bg-white">
                    <p className="font-semibold text-sm">No se encontraron partidas con los filtros actuales.</p>
                    <p className="text-xs text-slate-400 mt-1">Pruebe limpiando la barra de búsqueda o expandiendo niveles WBS.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Load More Banner when there are remaining rows */}
          {displayLimit < visibleActividades.length && (
            <div className="p-3 bg-[#f8fafc] border-t border-slate-300 flex items-center justify-between text-xs text-slate-600">
              <span>
                Mostrando las primeras <strong>{displayLimit}</strong> de <strong>{visibleActividades.length}</strong> partidas visibles para rendimiento ultra-fluido.
              </span>
              <button
                type="button"
                onClick={() => setDisplayLimit(prev => Math.min(prev + 150, visibleActividades.length))}
                className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded font-semibold text-slate-700 shadow-2xs cursor-pointer transition-colors"
              >
                Cargar más (+150 partidas)
              </button>
            </div>
          )}
        </div>
      </main>

      {/* ── 5. EXCEL STATUS BAR (Footer) ───────────────────────────────── */}
      <footer className="h-7 bg-[#107c41] text-white px-4 flex items-center justify-between text-[11px] shrink-0 font-mono shadow-inner">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-300"></span>
            Listo • Vista WBS Compacta
          </span>
          <span className="text-emerald-200">|</span>
          <span>Niveles WBS: {Math.max(...sortedActividades.map(a => getWbsDepth(a.wbs || '') + 1), 1)}</span>
          <span className="text-emerald-200">|</span>
          <span>Partidas Raíz: {sortedActividades.filter(a => getWbsDepth(a.wbs || '') === 0).length}</span>
        </div>

        <div className="flex items-center gap-3">
          <span>Doble clic en fila para expandir/editar</span>
          <span className="text-emerald-200">•</span>
          <span>Microsoft Excel Grid Mode</span>
        </div>
      </footer>
    </div>
  );
}
