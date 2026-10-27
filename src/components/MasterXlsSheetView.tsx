/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  FileSpreadsheet,
  Minimize2,
  Download,
  Upload,
  Cloud,
  Plus,
  Trash2,
  Search,
  Layers,
  ListTree,
  Table as TableIcon,
  ChevronsUpDown,
  ChevronsDownUp,
  ChevronRight,
  ChevronDown,
  SlidersHorizontal,
  Tag,
  Check,
  Save,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Calculator,
  Filter,
  X,
  CheckCircle2,
  HardDrive,
  Pencil,
  Copy,
  ClipboardPaste,
  ChevronUp
} from 'lucide-react';
import { MasterCdoItem, MasterCdoWeek, MasterCdoTotals } from '../types/masterCdo';
import { Actividad } from '../types';
import {
  MasterHierarchyMode,
  MasterHierarchyNode,
  getHierarchyRowStyles,
  extractWeekYear,
  calculateMasterTableSummary,
  MasterTableSummaryTotals,
  HierarchyTextFilter,
  TextFilterOperator,
  getVisibleHierarchyNodes,
  getMatchingLeafNodes
} from '../utils/masterCdoHierarchy';

interface MasterXlsSheetViewProps {
  isOpen: boolean;
  onBack?: () => void;
  nodes: MasterHierarchyNode[];
  nodeMap?: Map<string, MasterHierarchyNode>;
  rootKeys?: string[];
  semanas: MasterCdoWeek[];
  items: MasterCdoItem[];
  actividades: Actividad[];
  totals: MasterCdoTotals;
  viewMode: 'qty' | 'econ' | 'dual';
  setViewMode: (mode: 'qty' | 'econ' | 'dual') => void;
  hierarchyMode: MasterHierarchyMode;
  setHierarchyMode: (mode: MasterHierarchyMode) => void;
  hierarchyLevel: string;
  onHierarchyLevelChange: (lvl: string) => void;
  expandedKeys: Set<string>;
  toggleNodeExpand: (key: string) => void;
  expandAllNodes: () => void;
  collapseAllNodes: () => void;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  filterSubc: string;
  setFilterSubc: (s: string) => void;
  subcontratistasList: string[];
  filterAvance: 'all' | 'con_avance' | 'sin_avance' | 'saldo_pendiente';
  setFilterAvance: (a: any) => void;
  onOpenAttributesModal: (item: MasterCdoItem, activityId: string) => void;
  onAddWeek: () => void;
  onRemoveWeek: (weekId: string, label: string) => void;
  onSaveCloud: () => void;
  isSavingCloud: boolean;
  hasUnsavedCloudChanges: boolean;
  onExportExcel: () => void;
  onLoadExcel?: () => void;
  onUpdateItemQuantity: (itemId: string, weekId: string, qty: number) => void;
  onUpdateItemProperty: (itemId: string, field: 'precio' | 'step' | 'cantPres', val: number) => void;
  onUpdateItemStringProperty?: (itemId: string, field: string, val: string) => void;
  // Year filter props
  availableYears: string[];
  selectedYear: string;
  setSelectedYear: (yr: string) => void;
  latestYear: string;
  displayedWeeks: MasterCdoWeek[];
  showAttributeCols?: boolean;
  setShowAttributeCols?: (val: boolean) => void;
  tableSummaryTotals?: MasterTableSummaryTotals;
  onOpenWbsEditor?: () => void;
  onSaveLocal?: () => void;
}

interface ColumnFilterPopoverProps {
  title: string;
  isOpen: boolean;
  filter: HierarchyTextFilter;
  onClose: () => void;
  onApply: (appliedFilter: HierarchyTextFilter) => void;
  onClear: () => void;
}

/**
 * Isolated popover for column text filters.
 * Maintains an internal draft state so typing does NOT trigger
 * expensive re-renders or searches across the entire dataset.
 * The filter only applies when the user clicks 'Aplicar' or presses Enter.
 */
const ColumnFilterPopover: React.FC<ColumnFilterPopoverProps> = ({
  title,
  isOpen,
  filter,
  onClose,
  onApply,
  onClear,
}) => {
  const [draft, setDraft] = useState<HierarchyTextFilter>(filter);
  const popoverRef = useRef<HTMLDivElement>(null);
  const input1Ref = useRef<HTMLInputElement>(null);

  // Sync draft state with external filter whenever the popover is opened
  useEffect(() => {
    if (isOpen) {
      setDraft(filter);
      const timer = setTimeout(() => {
        input1Ref.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, filter]);

  // Handle click outside and Escape key to close without applying uncommitted changes
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleApply = () => {
    const val1Clean = draft.val1?.trim() || '';
    const val2Clean = draft.val2?.trim() || '';
    const hasValue = Boolean(val1Clean || val2Clean);
    onApply({
      ...draft,
      val1: val1Clean,
      val2: val2Clean,
      active: hasValue,
    });
    onClose();
  };

  const handleClear = () => {
    onClear();
    onClose();
  };

  const handleKeyDownInInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApply();
    }
  };

  return (
    <div
      ref={popoverRef}
      className="ht-dd absolute top-full left-0 mt-1 w-64 bg-white rounded-xl shadow-2xl border border-slate-300 p-3 z-50 text-slate-800 font-sans normal-case tracking-normal text-left select-text"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100">
        <span className="font-bold text-xs text-slate-800">{title}</span>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer transition-colors"
          title="Cerrar (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3">
        {/* Condition 1 */}
        <div className="space-y-1">
          <label className="text-[10.5px] font-semibold text-slate-500 block">Condición 1</label>
          <select
            value={draft.op1}
            onChange={(e) => setDraft((prev) => ({ ...prev, op1: e.target.value as TextFilterOperator }))}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-500 focus:bg-white transition-colors"
          >
            <option value="contains">contiene</option>
            <option value="not_contains">no contiene</option>
            <option value="starts_with">comienza por</option>
            <option value="ends_with">termina con</option>
            <option value="equals">es igual a</option>
            <option value="not_equals">no es igual a</option>
          </select>
          <input
            ref={input1Ref}
            type="text"
            value={draft.val1}
            placeholder="Escribe texto a buscar..."
            onChange={(e) => setDraft((prev) => ({ ...prev, val1: e.target.value }))}
            onKeyDown={handleKeyDownInInput}
            className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
        </div>

        {/* Logic Operator */}
        <div className="flex items-center gap-3 py-0.5">
          <span className="text-[10.5px] font-semibold text-slate-400">Operador:</span>
          <label className="flex items-center gap-1 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="radio"
              name={`logic_${title}`}
              checked={draft.logic === 'and'}
              onChange={() => setDraft((prev) => ({ ...prev, logic: 'and' }))}
              className="accent-indigo-600 cursor-pointer"
            />
            <span>Y</span>
          </label>
          <label className="flex items-center gap-1 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="radio"
              name={`logic_${title}`}
              checked={draft.logic === 'or'}
              onChange={() => setDraft((prev) => ({ ...prev, logic: 'or' }))}
              className="accent-indigo-600 cursor-pointer"
            />
            <span>O</span>
          </label>
        </div>

        {/* Condition 2 */}
        <div className="space-y-1">
          <label className="text-[10.5px] font-semibold text-slate-500 block">Condición 2 (opcional)</label>
          <select
            value={draft.op2}
            onChange={(e) => setDraft((prev) => ({ ...prev, op2: e.target.value as TextFilterOperator }))}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-500 focus:bg-white transition-colors"
          >
            <option value="contains">contiene</option>
            <option value="not_contains">no contiene</option>
            <option value="starts_with">comienza por</option>
            <option value="ends_with">termina con</option>
            <option value="equals">es igual a</option>
            <option value="not_equals">no es igual a</option>
          </select>
          <input
            type="text"
            value={draft.val2}
            placeholder="Segunda condición..."
            onChange={(e) => setDraft((prev) => ({ ...prev, val2: e.target.value }))}
            onKeyDown={handleKeyDownInInput}
            className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={handleClear}
            className="flex-1 py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            Borrar Filtro
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 py-1 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer"
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
};

export function MasterXlsSheetView({
  isOpen,
  onBack,
  nodes,
  nodeMap,
  rootKeys,
  semanas,
  items,
  actividades,
  totals,
  viewMode,
  setViewMode,
  hierarchyMode,
  setHierarchyMode,
  hierarchyLevel,
  onHierarchyLevelChange,
  expandedKeys,
  toggleNodeExpand,
  expandAllNodes,
  collapseAllNodes,
  searchTerm,
  setSearchTerm,
  filterSubc,
  setFilterSubc,
  subcontratistasList,
  filterAvance,
  setFilterAvance,
  onOpenAttributesModal,
  onAddWeek,
  onRemoveWeek,
  onSaveCloud,
  isSavingCloud,
  hasUnsavedCloudChanges,
  onExportExcel,
  onLoadExcel,
  onUpdateItemQuantity,
  onUpdateItemProperty,
  onUpdateItemStringProperty,
  availableYears,
  selectedYear,
  setSelectedYear,
  latestYear,
  displayedWeeks,
  showAttributeCols: propShowAttributeCols,
  setShowAttributeCols: propSetShowAttributeCols,
  tableSummaryTotals,
  onOpenWbsEditor,
  onSaveLocal
}: MasterXlsSheetViewProps) {
  // XLS View-specific layout states
  const [density, setDensity] = useState<'compact' | 'normal'>('compact');
  const [internalShowAttributeCols, setInternalShowAttributeCols] = useState<boolean>(false);
  const showAttributeCols = propShowAttributeCols !== undefined ? propShowAttributeCols : internalShowAttributeCols;
  const setShowAttributeCols = propSetShowAttributeCols || setInternalShowAttributeCols;
  const [activeCell, setActiveCell] = useState<{
    nodeKey: string;
    field: string;
    weekId?: string;
  } | null>(null);

  // Excel Formula Bar States
  const [formulaBarValue, setFormulaBarValue] = useState<string>('');
  const [initialFormulaBarValue, setInitialFormulaBarValue] = useState<string>('');
  const [isFormulaBarFocused, setIsFormulaBarFocused] = useState<boolean>(false);
  const [isFormulaBarExpanded, setIsFormulaBarExpanded] = useState<boolean>(false);
  const formulaBarInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Excel Clipboard and Marquee
  const [copiedCell, setCopiedCell] = useState<{
    nodeKey: string;
    field: string;
    weekId?: string;
    val: string | number;
  } | null>(null);

  // User notification toasts for copy & paste
  const [copyToast, setCopyToast] = useState<{ message: string; type: 'copy' | 'paste' | 'info' } | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const showToast = useCallback((message: string, type: 'copy' | 'paste' | 'info' = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setCopyToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setCopyToast(null);
    }, 2500);
  }, []);

  const [idOrigFilter, setIdOrigFilter] = useState<HierarchyTextFilter>({
    op1: 'contains',
    val1: '',
    logic: 'and',
    op2: 'contains',
    val2: '',
    active: false
  });
  const [isIdOrigFilterOpen, setIsIdOrigFilterOpen] = useState(false);

  const [activityIdFilter, setActivityIdFilter] = useState<HierarchyTextFilter>({
    op1: 'contains',
    val1: '',
    logic: 'and',
    op2: 'contains',
    val2: '',
    active: false
  });
  const [isActivityIdFilterOpen, setIsActivityIdFilterOpen] = useState(false);

  // Computes visible nodes across the full tree hierarchy,
  // working seamlessly whether the tree was collapsed or expanded.
  const filteredNodes = useMemo(() => {
    if (nodeMap && rootKeys) {
      return getVisibleHierarchyNodes(
        nodeMap,
        rootKeys,
        expandedKeys,
        filterSubc,
        filterAvance,
        searchTerm,
        { idOrigFilter, activityIdFilter }
      );
    }
    
    // Fallback if nodeMap is not provided
    let result = nodes;
    const checkOp = (cellValue: string, op: TextFilterOperator, val: string) => {
      if (!val) return true;
      const lowerVal = val.toLowerCase();
      switch (op) {
        case 'contains': return cellValue.includes(lowerVal);
        case 'not_contains': return !cellValue.includes(lowerVal);
        case 'starts_with': return cellValue.startsWith(lowerVal);
        case 'ends_with': return cellValue.endsWith(lowerVal);
        case 'equals': return cellValue === lowerVal;
        case 'not_equals': return cellValue !== lowerVal;
        default: return true;
      }
    };

    if (idOrigFilter.active && (idOrigFilter.val1 || idOrigFilter.val2)) {
      result = result.filter(n => {
        const cellValue = String(n.idOrig || n.itemRef?.idOrig || '').toLowerCase();
        const match1 = idOrigFilter.val1 ? checkOp(cellValue, idOrigFilter.op1, idOrigFilter.val1) : true;
        const match2 = idOrigFilter.val2 ? checkOp(cellValue, idOrigFilter.op2, idOrigFilter.val2) : true;
        if (!idOrigFilter.val1 && !idOrigFilter.val2) return true;
        if (!idOrigFilter.val2) return match1;
        if (!idOrigFilter.val1) return match2;
        return idOrigFilter.logic === 'and' ? (match1 && match2) : (match1 || match2);
      });
    }

    if (activityIdFilter.active && (activityIdFilter.val1 || activityIdFilter.val2)) {
      result = result.filter(n => {
        const cellValue = String(n.activityId || n.itemRef?.activityId || '').toLowerCase();
        const match1 = activityIdFilter.val1 ? checkOp(cellValue, activityIdFilter.op1, activityIdFilter.val1) : true;
        const match2 = activityIdFilter.val2 ? checkOp(cellValue, activityIdFilter.op2, activityIdFilter.val2) : true;
        if (!activityIdFilter.val1 && !activityIdFilter.val2) return true;
        if (!activityIdFilter.val2) return match1;
        if (!activityIdFilter.val1) return match2;
        return activityIdFilter.logic === 'and' ? (match1 && match2) : (match1 || match2);
      });
    }
    return result;
  }, [nodeMap, rootKeys, expandedKeys, filterSubc, filterAvance, searchTerm, idOrigFilter, activityIdFilter, nodes]);

  // High performance infinite scrolling in XLS view
  const [renderLimit, setRenderLimit] = useState<number>(100);

  // Reset limit when filters or expansion changes
  useEffect(() => {
    setRenderLimit(100);
  }, [searchTerm, filterSubc, filterAvance, hierarchyMode, filteredNodes.length, expandedKeys]);

  const paginatedNodes = useMemo(() => {
    return filteredNodes.slice(0, renderLimit);
  }, [filteredNodes, renderLimit]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 500) {
      if (renderLimit < filteredNodes.length) {
        setRenderLimit(prev => Math.min(prev + 100, filteredNodes.length));
      }
    }
  };

  // General summary totals for the first row of table (Venta $, Avance Económico $, Semanales)
  // Calculates real totals across all matching leaves in the dataset
  const summaryTotals = useMemo(() => {
    if (nodeMap && rootKeys) {
      const matchingLeaves = getMatchingLeafNodes(
        nodeMap,
        rootKeys,
        filterSubc,
        filterAvance,
        searchTerm,
        { idOrigFilter, activityIdFilter }
      );
      return calculateMasterTableSummary(matchingLeaves, semanas, items);
    }
    const leafNodes = filteredNodes.filter(n => n.esHoja);
    return calculateMasterTableSummary(leafNodes, semanas, items);
  }, [nodeMap, rootKeys, filterSubc, filterAvance, searchTerm, idOrigFilter, activityIdFilter, semanas, items, filteredNodes]);

  // In-cell editing
  const [editingCell, setEditingCell] = useState<{
    itemId: string;
    field: string;
    weekId?: string;
    nodeKey: string;
  } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const isSwitchingCellRef = useRef<boolean>(false);

  // Focus input automatically
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // Commit current editing cell without clearing editingCell
  const commitCurrentEdit = () => {
    if (!editingCell) return;

    const { itemId, field, weekId } = editingCell;
    const isNumberField = ['qty', 'precio', 'step', 'cantPres'].includes(field);
    const cleanNum = isNumberField ? (parseFloat(editValue.replace(/[$,]/g, '').trim()) || 0) : 0;
    
    const curItem = items.find(it => it.id === itemId);
    if (field === 'qty' && weekId) {
      const prevQty = curItem?.cantidadesSemanales?.[weekId] || 0;
      if (cleanNum !== prevQty) {
        onUpdateItemQuantity(itemId, weekId, cleanNum);
      }
    } else if (['precio', 'step', 'cantPres'].includes(field)) {
      const prevVal = Number((curItem as any)?.[field]) || 0;
      if (cleanNum !== prevVal) {
        onUpdateItemProperty(itemId, field as any, cleanNum);
      }
    } else if (onUpdateItemStringProperty) {
      const prevStr = String((curItem as any)?.[field] ?? '').trim();
      const newStr = editValue.trim();
      if (newStr !== prevStr) {
        onUpdateItemStringProperty(itemId, field, newStr);
      }
    }
  };

  // Generalized value committer for Formula Bar, Paste, and In-cell
  const commitValueToCell = useCallback((nodeKey: string, field: string, valueStr: string, weekId?: string) => {
    const node = nodes.find(n => n.key === nodeKey);
    if (!node || !node.esHoja || !node.itemRef) return false;

    const itemId = node.itemRef.id;
    const isNumberField = ['qty', 'precio', 'step', 'cantPres'].includes(field);
    const cleanNum = isNumberField ? (parseFloat(valueStr.replace(/[$,]/g, '').trim()) || 0) : 0;

    const curItem = items.find(it => it.id === itemId);
    if (field === 'qty' && weekId) {
      const prevQty = curItem?.cantidadesSemanales?.[weekId] || 0;
      if (cleanNum !== prevQty) {
        onUpdateItemQuantity(itemId, weekId, cleanNum);
      }
      return true;
    } else if (['precio', 'step', 'cantPres'].includes(field)) {
      const prevVal = Number((curItem as any)?.[field]) || 0;
      if (cleanNum !== prevVal) {
        onUpdateItemProperty(itemId, field as any, cleanNum);
      }
      return true;
    } else if (onUpdateItemStringProperty) {
      const prevStr = String((curItem as any)?.[field] ?? '').trim();
      const newStr = valueStr.trim();
      if (newStr !== prevStr) {
        onUpdateItemStringProperty(itemId, field, newStr);
      }
      return true;
    }
    return false;
  }, [nodes, items, onUpdateItemQuantity, onUpdateItemProperty, onUpdateItemStringProperty]);

  // Extracts the raw unformatted string value of any cell
  const getCellRawValue = useCallback((nodeKey: string, field: string, weekId?: string): string => {
    const node = nodes.find(n => n.key === nodeKey);
    if (!node) return '';
    if (field === 'qty' && weekId) {
      const q = node.cantidadesSemanales?.[weekId];
      return q !== undefined && q !== null ? String(q) : '0';
    }
    const item = node.itemRef;
    if (field === 'cantPres') {
      const val = node.cantidadPresupuesto ?? item?.cantidadPresupuesto ?? (item as any)?.cantPres;
      return val !== undefined && val !== null ? String(val) : '0';
    }
    if (field === 'precio') {
      const val = node.precio ?? item?.precio;
      return val !== undefined && val !== null ? String(val) : '0';
    }
    if (field === 'step') {
      const val = node.step ?? item?.step;
      return val !== undefined && val !== null ? String(val) : '0';
    }
    if (field === 'wbs') return String(node.wbs || '');
    if (field === 'idOrig') return String(node.idOrig || item?.idOrig || '');
    if (field === 'activityId') return String(node.activityId || item?.activityId || '');
    if (field === 'descripcion') return String(node.descripcion || '');
    if (field === 'venta') return String(node.venta ?? 0);
    if (field === 'subcontratista') return String(node.subcontratista || '');
    if (field === 'cantAcum') return String(node.cantAcum ?? 0);
    if (field === 'avanceEcon') return String(node.avanceEcon ?? 0);
    if (field === 'saldoEcon') return String(node.saldoEcon ?? 0);
    if (field === 'pctAvance') return String(node.pctAvance !== undefined ? node.pctAvance.toFixed(1) : '0');
    
    return String((node.itemRef as any)?.[field] ?? (node as any)[field] ?? '');
  }, [nodes]);

  // Select cell: sets selection, populates Formula Bar, but does NOT enter in-cell edit
  const selectCell = useCallback((nodeKey: string, field: string, weekId?: string) => {
    setActiveCell({ nodeKey, field, weekId });
    const raw = getCellRawValue(nodeKey, field, weekId);
    setFormulaBarValue(raw);
    setInitialFormulaBarValue(raw);
    if (editingCell) {
      commitCurrentEdit();
      setEditingCell(null);
    }
  }, [getCellRawValue, editingCell]);

  const startCellEdit = (
    nodeKey: string,
    itemId: string,
    field: string,
    currentVal: number | string,
    weekId?: string
  ) => {
    setActiveCell({ nodeKey, field, weekId });
    setEditingCell({ itemId, field, weekId, nodeKey });
    setEditValue(currentVal === 0 ? '' : (currentVal == null ? '' : String(currentVal)));
  };

  // Synchronize formulaBarValue when activeCell or underlying item changes
  useEffect(() => {
    if (!activeCell) {
      setFormulaBarValue('');
      setInitialFormulaBarValue('');
      return;
    }
    const raw = getCellRawValue(activeCell.nodeKey, activeCell.field, activeCell.weekId);
    setFormulaBarValue(raw);
    setInitialFormulaBarValue(raw);
  }, [activeCell, getCellRawValue]);

  // List of fields in horizontal order for ArrowLeft / ArrowRight / Tab navigation
  const getAvailableFields = useCallback(() => {
    const base = ['wbs', 'idOrig', 'activityId', 'descripcion'];
    const attrs = showAttributeCols
      ? ['macro', 'grupo', 'tipo', 'partidas', 'cap', 'scap', 'unit', 'componente', 'ubicacion', 'proceso', 'resp']
      : [];
    const metrics = ['cantPres', 'precio', 'step', 'venta', 'subcontratista', 'cantAcum', 'avanceEcon', 'saldoEcon', 'pctAvance'];
    const weeks = !showAttributeCols ? displayedWeeks.map(w => `week_${w.id}`) : [];
    return [...base, ...attrs, ...metrics, ...weeks];
  }, [showAttributeCols, displayedWeeks]);

  // Smooth keyboard navigation across the entire grid
  const navigateActiveCell = useCallback((direction: 'down' | 'up' | 'right' | 'left') => {
    if (!activeCell) {
      const first = paginatedNodes[0];
      if (first) selectCell(first.key, 'wbs');
      return;
    }

    const allFields = getAvailableFields();
    const curFieldKey = activeCell.field === 'qty' && activeCell.weekId ? `week_${activeCell.weekId}` : activeCell.field;
    const curFieldIdx = allFields.indexOf(curFieldKey);

    const curRowIdx = paginatedNodes.findIndex(n => n.key === activeCell.nodeKey);
    if (curRowIdx === -1) return;

    if (direction === 'down') {
      if (curRowIdx < paginatedNodes.length - 1) {
        const nextNode = paginatedNodes[curRowIdx + 1];
        selectCell(nextNode.key, activeCell.field, activeCell.weekId);
      }
    } else if (direction === 'up') {
      if (curRowIdx > 0) {
        const prevNode = paginatedNodes[curRowIdx - 1];
        selectCell(prevNode.key, activeCell.field, activeCell.weekId);
      }
    } else if (direction === 'right') {
      if (curFieldIdx >= 0 && curFieldIdx < allFields.length - 1) {
        const nextFieldKey = allFields[curFieldIdx + 1];
        if (nextFieldKey.startsWith('week_')) {
          const weekId = nextFieldKey.replace('week_', '');
          selectCell(activeCell.nodeKey, 'qty', weekId);
        } else {
          selectCell(activeCell.nodeKey, nextFieldKey);
        }
      }
    } else if (direction === 'left') {
      if (curFieldIdx > 0) {
        const prevFieldKey = allFields[curFieldIdx - 1];
        if (prevFieldKey.startsWith('week_')) {
          const weekId = prevFieldKey.replace('week_', '');
          selectCell(activeCell.nodeKey, 'qty', weekId);
        } else {
          selectCell(activeCell.nodeKey, prevFieldKey);
        }
      }
    }
  }, [activeCell, paginatedNodes, getAvailableFields, selectCell]);

  // Is the currently active cell editable?
  const isCellEditable = useMemo(() => {
    if (!activeCell) return false;
    const node = nodes.find(n => n.key === activeCell.nodeKey);
    if (!node || !node.esHoja || !node.itemRef) return false;
    const editableFields = [
      'macro', 'grupo', 'tipo', 'partidas', 'cap', 'scap', 'unit',
      'componente', 'ubicacion', 'proceso', 'resp', 'cantPres', 'precio', 'step', 'qty'
    ];
    return editableFields.includes(activeCell.field);
  }, [activeCell, nodes]);

  const isFormulaBarDirty = formulaBarValue !== initialFormulaBarValue;

  const handleCancelFormulaBar = useCallback(() => {
    setFormulaBarValue(initialFormulaBarValue);
    formulaBarInputRef.current?.blur();
  }, [initialFormulaBarValue]);

  const handleCommitFormulaBar = useCallback((navigateDirection?: 'down' | 'right') => {
    if (!activeCell) return;
    const success = commitValueToCell(activeCell.nodeKey, activeCell.field, formulaBarValue, activeCell.weekId);
    if (success) {
      setInitialFormulaBarValue(formulaBarValue);
      showToast(`Guardado: "${formulaBarValue}"`, 'info');
    }
    if (navigateDirection === 'down') {
      navigateActiveCell('down');
    } else if (navigateDirection === 'right') {
      navigateActiveCell('right');
    }
  }, [activeCell, formulaBarValue, commitValueToCell, showToast, navigateActiveCell]);

  // Excel Copy Cell Action
  const handleCopyCell = useCallback(() => {
    if (!activeCell) return;
    const rawVal = getCellRawValue(activeCell.nodeKey, activeCell.field, activeCell.weekId);
    setCopiedCell({
      nodeKey: activeCell.nodeKey,
      field: activeCell.field,
      weekId: activeCell.weekId,
      val: rawVal,
    });

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(String(rawVal)).catch(() => {});
    }
    showToast(`Copiado: "${rawVal}" (Ctrl+V para pegar en otra celda)`, 'copy');
  }, [activeCell, getCellRawValue, showToast]);

  // Excel Paste Cell Action
  const handlePasteCell = useCallback(async (textOverride?: string) => {
    if (!activeCell) return;
    const node = nodes.find(n => n.key === activeCell.nodeKey);
    if (!node || !node.esHoja || !node.itemRef) {
      showToast('Esta celda es de solo lectura (no se puede editar)', 'info');
      return;
    }

    const editableFields = [
      'macro', 'grupo', 'tipo', 'partidas', 'cap', 'scap', 'unit',
      'componente', 'ubicacion', 'proceso', 'resp', 'cantPres', 'precio', 'step', 'qty'
    ];
    if (!editableFields.includes(activeCell.field)) {
      showToast('La columna seleccionada es de solo lectura', 'info');
      return;
    }

    let textToPaste = textOverride;
    if (textToPaste === undefined) {
      if (copiedCell && copiedCell.val !== undefined) {
        textToPaste = String(copiedCell.val);
      } else if (navigator.clipboard && navigator.clipboard.readText) {
        try {
          textToPaste = await navigator.clipboard.readText();
        } catch {
          textToPaste = '';
        }
      }
    }

    if (textToPaste === undefined || textToPaste === null || textToPaste === '') {
      showToast('No hay datos copiados para pegar', 'info');
      return;
    }

    const cleanPaste = textToPaste.trim();
    const success = commitValueToCell(activeCell.nodeKey, activeCell.field, cleanPaste, activeCell.weekId);
    if (success) {
      setFormulaBarValue(cleanPaste);
      setInitialFormulaBarValue(cleanPaste);
      showToast(`Pegado en celda: "${cleanPaste}"`, 'paste');
    }
  }, [activeCell, nodes, copiedCell, commitValueToCell, showToast]);

  // Global Excel Keyboard Shortcuts & Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      const isInputFocused =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA';

      // When user is typing inside an input/textarea
      if (isInputFocused) {
        if (e.key === 'Escape') {
          if (editingCell) {
            setEditingCell(null);
          } else {
            handleCancelFormulaBar();
          }
        }
        return;
      }

      // When grid has selection focus (Excel mode)
      if (e.key === 'Escape') {
        if (copiedCell) {
          setCopiedCell(null); // Clear copy marching ants
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        handleCopyCell();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        handlePasteCell();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        handleCopyCell();
        if (isCellEditable && activeCell) {
          commitValueToCell(activeCell.nodeKey, activeCell.field, '', activeCell.weekId);
          setFormulaBarValue('');
          setInitialFormulaBarValue('');
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isCellEditable && activeCell) {
          e.preventDefault();
          commitValueToCell(activeCell.nodeKey, activeCell.field, '', activeCell.weekId);
          setFormulaBarValue('');
          setInitialFormulaBarValue('');
          showToast('Contenido borrado', 'info');
        }
      } else if (e.key === 'F2') {
        e.preventDefault();
        formulaBarInputRef.current?.focus();
        formulaBarInputRef.current?.select();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        navigateActiveCell(e.shiftKey ? 'up' : 'down');
      } else if (e.key === 'Tab') {
        e.preventDefault();
        navigateActiveCell(e.shiftKey ? 'left' : 'right');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateActiveCell('down');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateActiveCell('up');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateActiveCell('right');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateActiveCell('left');
      } else if (
        isCellEditable &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        // Alphanumeric typing on selected cell redirects to Formula Bar like Excel
        setFormulaBarValue(e.key);
        formulaBarInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    isOpen,
    editingCell,
    copiedCell,
    activeCell,
    isCellEditable,
    handleCopyCell,
    handlePasteCell,
    navigateActiveCell,
    commitValueToCell,
    handleCancelFormulaBar,
    showToast
  ]);

  // Intercept native browser paste on grid
  useEffect(() => {
    const handleNativePaste = (e: ClipboardEvent) => {
      if (!isOpen) return;
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      const text = e.clipboardData?.getData('text');
      if (text !== undefined && activeCell) {
        e.preventDefault();
        handlePasteCell(text);
      }
    };

    window.addEventListener('paste', handleNativePaste);
    return () => window.removeEventListener('paste', handleNativePaste);
  }, [isOpen, activeCell, handlePasteCell]);

  // Commit editing and navigate to next/prev cell (in-cell)
  const commitEditAndNavigate = (direction?: 'down' | 'up' | 'right' | 'left') => {
    if (!editingCell) return;
    commitCurrentEdit();
    setEditingCell(null);
    if (direction) {
      navigateActiveCell(direction);
    }
  };

  const handleKeyDownInCell = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEditAndNavigate(e.shiftKey ? 'up' : 'down');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitEditAndNavigate(e.shiftKey ? 'left' : 'right');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingCell(null);
    }
  };

  // Selected item information for the Formula Bar
  const selectedNode = useMemo(() => {
    if (!activeCell) return nodes[0] || null;
    return nodes.find(n => n.key === activeCell.nodeKey) || null;
  }, [activeCell, nodes]);

  const selectedWeek = useMemo(() => {
    if (!activeCell?.weekId) return null;
    return semanas.find(s => s.id === activeCell.weekId) || null;
  }, [activeCell, semanas]);

  const activeFieldLabel = useMemo(() => {
    if (!activeCell) return 'FX';
    if (activeCell.weekId) {
      const sem = semanas.find(s => s.id === activeCell.weekId);
      return sem?.label || activeCell.weekId;
    }
    const fieldMap: Record<string, string> = {
      row: 'FILA',
      wbs: 'WBS',
      idOrig: 'ID.ORIG',
      activityId: 'ACT.ID',
      descripcion: 'DESCRIPCIÓN',
      macro: 'MACRO',
      grupo: 'GRUPO',
      tipo: 'TIPO',
      partidas: 'PARTIDAS',
      cap: 'CAP',
      scap: 'SCAP',
      unit: 'UNIT',
      componente: 'COMPONENTE',
      ubicacion: 'UBICACIÓN',
      proceso: 'PROCESO',
      resp: 'RESPONSABLE',
      cantPres: 'CANT.PRES',
      precio: 'PRECIO',
      step: 'STEP',
      venta: 'VENTA',
      subcontratista: 'SUBCONTRATISTA',
      cantAcum: 'CANT.ACUM',
      avanceEcon: 'AVANCE $',
      saldoEcon: 'SALDO $',
      pctAvance: '% AVANCE',
      qty: 'CANT.SEMANAL'
    };
    return fieldMap[activeCell.field] || activeCell.field.toUpperCase();
  }, [activeCell, semanas]);

  const activeCellValue = useMemo(() => {
    if (!activeCell || !selectedNode) return '';
    const field = activeCell.field;
    if (field === 'qty' && activeCell.weekId) {
      return selectedNode.cantidadesSemanales?.[activeCell.weekId] ?? 0;
    }
    const item = selectedNode.itemRef;
    if (field === 'wbs') return selectedNode.wbs;
    if (field === 'idOrig') return selectedNode.idOrig || item?.idOrig || '';
    if (field === 'activityId') return selectedNode.activityId || item?.activityId || '';
    if (field === 'descripcion') return selectedNode.descripcion;
    if (field === 'cantPres') return selectedNode.cantidadPresupuesto;
    if (field === 'precio') return `$${selectedNode.precio}`;
    if (field === 'step') return selectedNode.step;
    if (field === 'venta') return `$${selectedNode.venta.toLocaleString('es-ES')}`;
    if (field === 'subcontratista') return selectedNode.subcontratista || '';
    if (field === 'cantAcum') return selectedNode.cantAcum;
    if (field === 'avanceEcon') return `$${selectedNode.avanceEcon.toLocaleString('es-ES')}`;
    if (field === 'saldoEcon') return `$${selectedNode.saldoEcon.toLocaleString('es-ES')}`;
    if (field === 'pctAvance') return `${selectedNode.pctAvance.toFixed(1)}%`;
    return (selectedNode as any)[field] ?? (item as any)?.[field] ?? '';
  }, [activeCell, selectedNode]);

  if (!isOpen) return null;

  return (
    <div
      id="master-xls-sheet-overlay"
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex flex-col h-screen w-screen overflow-hidden select-none animate-in fade-in duration-100"
    >
      <div className="flex flex-col h-full w-full bg-[#f8fafc] text-slate-800 shadow-2xl">
        {/* 1. EXCEL TOP HEADER (Dark Green Ribbon) */}
        <div className="bg-[#F5F8F9] text-[#14212A] px-4 py-2 flex flex-wrap items-center justify-between gap-3 border-b border-[#D5DEE2] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="hidden">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[11px] font-['Barlow_Condensed'] font-semibold tracking-wider uppercase text-[#14212A]">
                  Master CDO — Hoja Excel
                </h2>
                <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-white text-[#5A6A74] border border-[#D5DEE2]">
                  Pantalla Completa
                </span>
                {hasUnsavedCloudChanges && (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-amber-950">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-950 animate-pulse" />
                    Cambios sin sincronizar
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#5A6A74] font-mono">
                Vista de alta productividad para avanzar cantidades físicas, calibrar precios y editar atributos de Activity ID.
              </p>
            </div>
          </div>

          {/* Quick Metrics in Header */}
          <div className="hidden lg:flex items-center gap-4 text-xs font-mono">
            <div className="bg-white border border-[#D5DEE2] rounded-lg px-2.5 py-1">
              <span className="text-[10px] text-[#5A6A74] uppercase block font-sans">Presupuesto</span>
              <span className="font-bold text-[#14212A]">${totals.totalVentaPresupuesto.toLocaleString('es-ES', { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="bg-white border border-[#D5DEE2] rounded-lg px-2.5 py-1">
              <span className="text-[10px] text-[#5A6A74] uppercase block font-sans">Avance Econ.</span>
              <span className="font-bold text-green-700">${totals.totalAvanceEconomico.toLocaleString('es-ES', { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="bg-white border border-[#D5DEE2] rounded-lg px-2.5 py-1">
              <span className="text-[10px] text-[#5A6A74] uppercase block font-sans">% Avance</span>
              <span className="font-bold text-[#442dd7]">{totals.pctAvanceEconomico.toFixed(1)}%</span>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2">
            {hasUnsavedCloudChanges ? (
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs shadow-xs transition-all cursor-pointer"
                title="Borrador Protegido (Guardado Local)"
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>Borrador: Protegido</span>
              </button>
            ) : (
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 font-bold text-xs shadow-xs transition-all cursor-pointer"
                title="Nube al día"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Nube al día</span>
              </button>
            )}

            <button
              type="button"
              onClick={onSaveLocal}
              className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs shadow-xs transition-all cursor-pointer"
              title="Guardar localmente"
            >
              <Save className="w-4 h-4" />
            </button>
            
            <button
              type="button"
              onClick={onSaveCloud}
              disabled={isSavingCloud}
              className={`flex items-center justify-center w-8 h-8 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer border ${
                hasUnsavedCloudChanges
                  ? 'bg-amber-400 hover:bg-amber-300 text-amber-950 border-amber-500'
                  : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-900'
              }`}
              title="Sincronizar con la nube (Cloudflare)"
            >
              <Cloud className={`w-4 h-4 ${isSavingCloud ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={onLoadExcel}
              className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs shadow-xs transition-all cursor-pointer"
              title="Cargar el master"
            >
              <Upload className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onExportExcel}
              className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs shadow-xs transition-all cursor-pointer"
              title="Descargar archivo Excel"
            >
              <Download className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-[#D5DEE2] mx-1"></div>

            <button
              type="button"
              onClick={onOpenWbsEditor}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs shadow-xs transition-all cursor-pointer"
              title="Editor WBS"
            >
              <ListTree className="w-3.5 h-3.5" />
              <span>WBS</span>
            </button>

            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-black text-xs shadow-md transition-all cursor-pointer border border-slate-200"
              title="Volver a la pestaña Resumen"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-indigo-700" />
              <span>Volver</span>
            </button>
          </div>
        </div>

        {/* 2. EXCEL COMMAND TOOLBAR (Ribbon Controls) */}
        <div className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center gap-2 text-xs shrink-0 shadow-2xs">
            {/* View Mode (Q / $ / Dual) */}
            <div className="inline-flex bg-[#F5F8F9] rounded-lg p-0.5 border border-[#D5DEE2] text-xs font-bold text-[#5A6A74] shadow-xs">
              <button
                type="button"
                onClick={() => setViewMode('qty')}
                className={`px-3 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer select-none ${
                  viewMode === 'qty'
                    ? 'bg-[#442dd7] text-white shadow-xs font-bold'
                    : 'text-[#5A6A74] hover:text-[#14212A] hover:bg-[#EEF2F3]'
                }`}
                title="Mostrar cantidades físicas de obra"
              >
                Q
              </button>
              <button
                type="button"
                onClick={() => setViewMode('econ')}
                className={`px-3 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer select-none ${
                  viewMode === 'econ'
                    ? 'bg-[#442dd7] text-white shadow-xs font-bold'
                    : 'text-[#5A6A74] hover:text-[#14212A] hover:bg-[#EEF2F3]'
                }`}
                title="Mostrar avance económico / Venta ($)"
              >
                $
              </button>
              <button
                type="button"
                onClick={() => setViewMode('dual')}
                className={`px-3 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer select-none ${
                  viewMode === 'dual'
                    ? 'bg-[#442dd7] text-white shadow-xs font-bold'
                    : 'text-[#5A6A74] hover:text-[#14212A] hover:bg-[#EEF2F3]'
                }`}
                title="Dual: Cantidad física y monto económico ($)"
              >
                Q & $
              </button>
            </div>

            {/* Hierarchy Levels */}
            {hierarchyMode !== 'flat' && (
              <div className="flex items-center gap-1">
                <select
                  value={hierarchyLevel}
                  onChange={e => onHierarchyLevelChange(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-xs font-bold text-slate-700 outline-none"
                >
                  <option value="0">0. Colapsado</option>
                  <option value="1">1. Capítulos</option>
                  <option value="2">2. Subcapítulos</option>
                  <option value="3">3. Paquetes</option>
                  <option value="all">Todos los Niveles</option>
                </select>
                <button
                  type="button"
                  onClick={expandAllNodes}
                  className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                  title="Expandir Todo"
                >
                  <ChevronsUpDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={collapseAllNodes}
                  className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                  title="Colapsar Todo"
                >
                  <ChevronsDownUp className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Toggle Attribute View (Unit, Componente, Macro, Grupo, Tipo, CAP, SCAP) - hides execution weeks */}
            <button
              id="btn-xls-toggle-attributes"
              type="button"
              onClick={() => setShowAttributeCols(!showAttributeCols)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none ${
                showAttributeCols
                  ? 'bg-indigo-600 border-indigo-700 text-white shadow-sm font-black ring-2 ring-indigo-400/40'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400'
              }`}
              title="Visión de Atributos: incluye Unit, Componente, Macro, Grupo, etc. y oculta las semanas de ejecución para facilitar la edición"
            >
              <SlidersHorizontal className={`w-3.5 h-3.5 ${showAttributeCols ? 'text-white' : 'text-indigo-600'}`} />
              <span>Atributos</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-black ${
                showAttributeCols ? 'bg-white/25 text-white' : 'bg-indigo-100 text-indigo-800'
              }`}>
                {showAttributeCols ? 'Semanas Ocultas' : 'Normal'}
              </span>
            </button>

            {/* Density toggle */}
            <button
              type="button"
              onClick={() => setDensity(d => d === 'compact' ? 'normal' : 'compact')}
              className="px-2 py-1 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs cursor-pointer"
              title="Alternar densidad visual de filas"
            >
              {density === 'compact' ? '📏 Modo Compacto' : '📐 Modo Normal'}
            </button>

            {/* P6 Items Indicator */}
            {items.some(it => (it.activityId || '').toLowerCase().includes('p6')) && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-orange-100 border border-orange-300 text-orange-950 font-bold text-xs shadow-2xs select-none"
                title="Las partidas cuyo Activity ID contiene 'P6' se destacan automáticamente en naranja claro en todas las columnas"
              >
                <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0"></span>
                <span>P6: Naranja claro ({items.filter(it => (it.activityId || '').toLowerCase().includes('p6')).length})</span>
              </div>
            )}

            {/* Year Selector Tabs (hidden when in attribute view) */}
            {!showAttributeCols && availableYears.length > 0 && (
              <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                  <span className="text-[10px] uppercase font-black text-slate-500 px-1.5">Año:</span>
                  {availableYears.map(yr => {
                    const currentCalendarYear = String(new Date().getFullYear());
                    const isCurrent = yr === currentCalendarYear;
                    const isLatest = yr === latestYear;
                    const isSelected = (selectedYear === 'latest' && isLatest) || selectedYear === yr;
                    return (
                      <button
                        key={yr}
                        id={`btn-year-tab-${yr}`}
                        type="button"
                        onClick={() => setSelectedYear(yr)}
                        className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-700 text-white shadow-2xs font-black'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                        }`}
                        title={`Mostrar semanas del año ${yr}${isCurrent ? ' (Año en curso)' : ''}`}
                      >
                        {yr} {isCurrent ? (
                          <span className="text-[9px] opacity-90 font-normal ml-0.5">• Actual</span>
                        ) : (
                          isLatest && <span className="text-[9px] opacity-85 font-normal ml-0.5">• Último</span>
                        )}
                      </button>
                    );
                  })}
                  {availableYears.length > 1 && (
                    <button
                      id="btn-year-tab-all"
                      type="button"
                      onClick={() => setSelectedYear('all')}
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        selectedYear === 'all'
                          ? 'bg-emerald-700 text-white shadow-2xs font-black'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                      }`}
                      title="Mostrar todas las semanas de todos los años"
                    >
                      Todos ({semanas.length})
                    </button>
                  )}
                </div>
            )}

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Filtrar partida / WBS..."
                className="pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 w-44"
              />
            </div>

            {/* Subcontractor Filter */}
            {subcontratistasList.length > 0 && (
              <select
                value={filterSubc}
                onChange={e => setFilterSubc(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="all">👷 Todos SubC</option>
                {subcontratistasList.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}

            {/* Avance Filter */}
            <select
              value={filterAvance}
              onChange={e => setFilterAvance(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-xs font-semibold text-slate-700 outline-none"
            >
              <option value="all">📊 Todas</option>
              <option value="con_avance">✅ Con avance</option>
              <option value="sin_avance">⏳ Sin avance</option>
              <option value="saldo_pendiente">📉 Con saldo</option>
            </select>

            {/* Active Column Filters Badges */}
            {idOrigFilter.active && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-bold">
                <span>id.Orig: &quot;{idOrigFilter.val1 || idOrigFilter.val2}&quot;</span>
                <button
                  type="button"
                  onClick={() => setIdOrigFilter(prev => ({ ...prev, active: false, val1: '', val2: '' }))}
                  className="text-indigo-400 hover:text-indigo-800 p-0.5 rounded cursor-pointer"
                  title="Quitar filtro de id.Orig"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {activityIdFilter.active && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-bold">
                <span>Act.ID: &quot;{activityIdFilter.val1 || activityIdFilter.val2}&quot;</span>
                <button
                  type="button"
                  onClick={() => setActivityIdFilter(prev => ({ ...prev, active: false, val1: '', val2: '' }))}
                  className="text-indigo-400 hover:text-indigo-800 p-0.5 rounded cursor-pointer"
                  title="Quitar filtro de Activity ID"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Add week button */}
            <button
              type="button"
              onClick={onAddWeek}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-black text-xs transition-colors cursor-pointer"
              title="Añadir una nueva semana de corte"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Semana</span>
            </button>
        </div>

        {/* 3. EXCEL FORMULA BAR (Authentic Excel Formula Input & Copy/Paste Controls) */}
        <div className="bg-[#f8fafc] border-b border-slate-300 px-3 py-1 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0 font-sans shadow-2xs">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {/* Name Box (Cuadro de nombres) */}
            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded px-2 py-0.5 text-slate-800 font-mono font-bold text-[11px] min-w-[120px] max-w-[160px] justify-between shadow-inner shrink-0" title="Celda seleccionada">
              <span className="truncate text-emerald-800">
                {activeCell
                  ? `${selectedNode?.wbs || 'A1'}:${activeFieldLabel}`
                  : 'A1'}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
            </div>

            {/* Formula Bar Cancel & Enter Buttons */}
            <div className="flex items-center border border-slate-300 rounded bg-slate-100 divide-x divide-slate-300 shrink-0">
              <button
                type="button"
                onClick={handleCancelFormulaBar}
                disabled={!isFormulaBarDirty}
                className={`p-1 transition-colors ${
                  isFormulaBarDirty
                    ? 'text-rose-600 hover:bg-rose-50 cursor-pointer font-bold'
                    : 'text-slate-300 cursor-not-allowed'
                }`}
                title="Cancelar cambios (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleCommitFormulaBar('down')}
                disabled={!isFormulaBarDirty && !isCellEditable}
                className={`p-1 transition-colors ${
                  isFormulaBarDirty
                    ? 'text-emerald-700 hover:bg-emerald-50 cursor-pointer font-bold'
                    : 'text-slate-400 hover:bg-slate-200 cursor-pointer'
                }`}
                title="Aceptar y guardar valor en la celda (Enter)"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* fx icon */}
            <span className="font-serif italic font-black text-slate-500 text-sm px-1 shrink-0 select-none">fx</span>

            {/* Formula Input Box */}
            <div className="flex-1 flex items-center bg-white border border-slate-300 rounded shadow-inner min-w-[200px] focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600 transition-all">
              <input
                ref={formulaBarInputRef as any}
                type="text"
                value={formulaBarValue}
                onChange={(e) => {
                  if (isCellEditable) {
                    setFormulaBarValue(e.target.value);
                  }
                }}
                onFocus={() => setIsFormulaBarFocused(true)}
                onBlur={() => {
                  setIsFormulaBarFocused(false);
                  if (isFormulaBarDirty && isCellEditable) {
                    handleCommitFormulaBar();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCommitFormulaBar(e.shiftKey ? undefined : 'down');
                  } else if (e.key === 'Tab') {
                    e.preventDefault();
                    handleCommitFormulaBar('right');
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    handleCancelFormulaBar();
                  }
                }}
                disabled={!activeCell || !isCellEditable}
                placeholder={
                  !activeCell
                    ? 'Selecciona una celda de la cuadrícula'
                    : isCellEditable
                    ? 'Escribe un valor o fórmula aquí...'
                    : `[Solo Lectura] ${activeCellValue}`
                }
                className={`w-full px-2.5 py-1 text-xs font-mono font-medium outline-none bg-transparent ${
                  !isCellEditable ? 'text-slate-500 italic bg-slate-50/50' : 'text-slate-900'
                }`}
              />

              {isFormulaBarDirty && (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded mr-1 shrink-0">
                  Modificado
                </span>
              )}
            </div>

            {/* Excel Copy & Paste Buttons */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleCopyCell}
                disabled={!activeCell}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-300 shadow-2xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Copiar celda (Ctrl+C)"
              >
                <Copy className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">Copiar</span>
              </button>

              <button
                type="button"
                onClick={() => handlePasteCell()}
                disabled={!activeCell || !isCellEditable}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-emerald-50 text-emerald-800 font-semibold text-xs border border-emerald-300 shadow-2xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Pegar en la celda activa (Ctrl+V)"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Pegar</span>
              </button>
            </div>
          </div>

          {/* Quick Edit Attributes Modal Button */}
          {selectedNode?.esHoja && selectedNode.itemRef && (
            <button
              type="button"
              onClick={() => onOpenAttributesModal(selectedNode.itemRef!, selectedNode.activityId || selectedNode.itemRef!.id)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer shrink-0"
              title="Abrir modal para editar todos los atributos del Activity ID seleccionado"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Atributos ({selectedNode.activityId || 'Partida'})</span>
              <span className="md:hidden">Atributos</span>
            </button>
          )}
        </div>

        {/* 4. SPREADSHEET TABLE GRID (Excel High-Density Matrix) */}
        <div className="flex-1 overflow-auto relative bg-white" onScroll={handleScroll}>
          <table className="w-full border-collapse text-left text-xs font-mono">
            {/* Table Header Row */}
            <thead className="sticky top-0 z-30 bg-[#e2e8f0] text-slate-700 font-bold text-[11px] border-b-2 border-slate-300 select-none shadow-2xs font-sans">
              <tr>
                {/* Excel Row Index Header */}
                <th className="py-1.5 px-2 text-center w-10 sticky left-0 z-40 bg-[#cbd5e1] border-r border-b border-slate-300 font-mono text-[10px] text-slate-600">
                  #
                </th>

                {/* Col B: WBS */}
                <th className="py-1.5 px-2.5 sticky left-10 z-40 bg-[#e2e8f0] border-r border-b border-slate-300 min-w-[130px]">
                  WBS / Jerarquía
                </th>

                {/* Col C: id.Orig */}
                <th className="py-1.5 px-2 sticky left-[170px] z-40 bg-[#e2e8f0] border-r border-b border-slate-300 min-w-[85px]">
                  <div className="flex items-center justify-between gap-1 relative">
                    <span>id.Orig</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsIdOrigFilterOpen((prev) => !prev);
                        setIsActivityIdFilterOpen(false);
                      }}
                      className={`p-0.5 rounded transition-colors cursor-pointer ${
                        idOrigFilter.active
                          ? 'text-indigo-700 bg-indigo-100/50 hover:bg-indigo-200/50'
                          : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/50'
                      }`}
                      title="Filtrar por id.Orig"
                    >
                      <Filter className="w-3.5 h-3.5" />
                    </button>

                    <ColumnFilterPopover
                      title="Filtro: id.Orig"
                      isOpen={isIdOrigFilterOpen}
                      filter={idOrigFilter}
                      onClose={() => setIsIdOrigFilterOpen(false)}
                      onApply={(applied) => setIdOrigFilter(applied)}
                      onClear={() =>
                        setIdOrigFilter({
                          op1: 'contains',
                          val1: '',
                          logic: 'and',
                          op2: 'contains',
                          val2: '',
                          active: false,
                        })
                      }
                    />
                  </div>
                </th>

                {/* Col D: Activity ID */}
                <th className="py-1.5 px-2 sticky left-[255px] z-40 bg-[#e2e8f0] border-r border-b border-slate-300 min-w-[90px]">
                  <div className="flex items-center justify-between gap-1 relative">
                    <span>Activity ID</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsActivityIdFilterOpen((prev) => !prev);
                        setIsIdOrigFilterOpen(false);
                      }}
                      className={`p-0.5 rounded transition-colors cursor-pointer ${
                        activityIdFilter.active
                          ? 'text-indigo-700 bg-indigo-100/50 hover:bg-indigo-200/50'
                          : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/50'
                      }`}
                      title="Filtrar por Activity ID"
                    >
                      <Filter className="w-3.5 h-3.5" />
                    </button>

                    <ColumnFilterPopover
                      title="Filtro: Activity ID"
                      isOpen={isActivityIdFilterOpen}
                      filter={activityIdFilter}
                      onClose={() => setIsActivityIdFilterOpen(false)}
                      onApply={(applied) => setActivityIdFilter(applied)}
                      onClear={() =>
                        setActivityIdFilter({
                          op1: 'contains',
                          val1: '',
                          logic: 'and',
                          op2: 'contains',
                          val2: '',
                          active: false,
                        })
                      }
                    />
                  </div>
                </th>

                {/* Col E: Descripción */}
                <th className="py-1.5 px-3 sticky left-[345px] z-40 bg-[#e2e8f0] border-r border-b border-slate-300 min-w-[240px] max-w-[340px]">
                  Descripción Partida
                </th>

                {/* Optional Attribute Columns (Macro, Grupo, Tipo, Partidas, CAP, SCAP, Unit, Componente, Ubicación, Proceso, Resp, Editar) */}
                {showAttributeCols && (
                  <>
                    <th className="py-1.5 px-2 border-r border-b border-slate-300 min-w-[95px] bg-blue-50 text-blue-900">
                      Macro
                    </th>
                    <th className="py-1.5 px-2 border-r border-b border-slate-300 min-w-[95px] bg-indigo-50 text-indigo-900">
                      Grupo
                    </th>
                    <th className="py-1.5 px-2 border-r border-b border-slate-300 min-w-[90px] bg-purple-50 text-purple-900">
                      Tipo
                    </th>
                    <th className="py-1.5 px-2 border-r border-b border-slate-300 min-w-[95px] bg-slate-50 text-slate-900">
                      Partidas
                    </th>
                    <th className="py-1.5 px-2 border-r border-b border-slate-300 min-w-[70px] bg-amber-50 text-amber-900 text-center">
                      CAP
                    </th>
                    <th className="py-1.5 px-2 border-r border-b border-slate-300 min-w-[80px] bg-emerald-50 text-emerald-900 text-center">
                      SCAP
                    </th>
                    <th className="py-1.5 px-2 border-r border-b border-slate-300 min-w-[85px] bg-teal-50 text-teal-900 text-center font-black">
                      Unit
                    </th>
                    <th className="py-1.5 px-2 border-r border-b border-slate-300 min-w-[110px] bg-cyan-50 text-cyan-900 font-black">
                      Componente
                    </th>
                    <th className="py-1.5 px-2 border-r border-b border-slate-300 min-w-[85px] bg-slate-100 text-slate-800">
                      Ubicación
                    </th>
                    <th className="py-1.5 px-2 border-r border-b border-slate-300 min-w-[85px] bg-slate-100 text-slate-800">
                      Proceso
                    </th>
                    <th className="py-1.5 px-2 border-r border-b border-slate-300 min-w-[85px] bg-slate-100 text-slate-800">
                      Resp
                    </th>
                    <th className="py-1.5 px-2 border-r border-b border-slate-300 min-w-[80px] bg-indigo-100/90 text-indigo-950 text-center">
                      Editar
                    </th>
                  </>
                )}

                {/* Standard Data Columns */}
                <th className="py-1.5 px-2 border-r border-b border-slate-300 text-center w-14">
                  UND
                </th>
                <th className="py-1.5 px-2.5 border-r border-b border-slate-300 text-right min-w-[80px]">
                  Cant. Presup.
                </th>
                <th className="py-1.5 px-2 border-r border-b border-slate-300 text-right min-w-[75px]">
                  Precio ($)
                </th>
                <th className="py-1.5 px-1.5 border-r border-b border-slate-300 text-center w-12">
                  Step
                </th>
                <th className="py-1.5 px-2.5 border-r border-b border-slate-300 text-right min-w-[90px]">
                  Venta ($)
                </th>
                <th className="py-1.5 px-2 border-r border-b border-slate-300 min-w-[95px]">
                  Subcontratista
                </th>
                <th className="py-1.5 px-2.5 border-r border-b border-slate-300 text-right min-w-[85px] bg-indigo-50/70 text-indigo-900">
                  Cant. Acum.
                </th>
                <th className="py-1.5 px-2.5 border-r border-b border-slate-300 text-right min-w-[95px] bg-indigo-50/70 text-indigo-900">
                  Avance ($)
                </th>
                <th className="py-1.5 px-2.5 border-r border-b border-slate-300 text-right min-w-[85px] text-slate-600">
                  Saldo ($)
                </th>
                <th className="py-1.5 px-1.5 border-r border-b border-slate-300 text-center w-14">
                  % Av.
                </th>

                {/* DYNAMIC WEEKLY COLUMNS (Hidden when in attribute view) */}
                {!showAttributeCols && displayedWeeks.map((sem, sIdx) => (
                  <th
                    key={sem.id}
                    className={`py-1.5 px-2 border-r border-b border-slate-300 text-center group bg-[#f1f5f9] hover:bg-emerald-50 transition-colors ${
                      viewMode === 'dual' ? 'min-w-[150px]' : 'min-w-[95px]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-black text-slate-800 truncate" title={sem.label}>
                        {sem.label}
                      </span>
                      {displayedWeeks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onRemoveWeek(sem.id, sem.label)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-0.5 rounded transition-opacity cursor-pointer"
                          title="Eliminar semana"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="text-[9px] text-slate-400 font-normal lowercase tracking-normal flex justify-around mt-0.5">
                      {viewMode === 'qty' && <span>Cant. Obra</span>}
                      {viewMode === 'econ' && <span>Avance ($)</span>}
                      {viewMode === 'dual' && (
                        <>
                          <span>Cant.</span>
                          <span>Monto ($)</span>
                        </>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body Grid */}
            <tbody className="divide-y divide-slate-200">
              {filteredNodes.length === 0 ? (
                <tr>
                  <td colSpan={5 + 10 + (showAttributeCols ? 12 : displayedWeeks.length)} className="py-16 text-center text-slate-400 font-sans">
                    <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-600 text-sm">No hay partidas que coincidan con los filtros.</p>
                  </td>
                </tr>
              ) : (
                <>
                  {/* Fila adicional de Totales Generales (Primera fila solicitada) */}
                  <tr
                    id="row-xls-table-totals"
                    className="bg-indigo-50/95 hover:bg-indigo-100/80 border-b-2 border-indigo-400 text-slate-900 font-bold transition-colors select-text shadow-2xs"
                  >
                    {/* Excel Row Index Header */}
                    <td className="py-1 px-1 text-center sticky left-0 z-20 bg-indigo-100/95 border-r border-indigo-300 font-mono text-[10px] text-indigo-700 font-black select-none">
                      Σ
                    </td>

                    {/* Col B: WBS / Jerarquía */}
                    <td className="py-1 px-2 sticky left-10 z-20 bg-indigo-100/95 border-r border-indigo-300">
                      <div className="flex items-center gap-1.5 font-sans">
                        <Calculator className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                        <span className="font-mono text-[9.5px] px-1.5 py-0.5 rounded bg-indigo-700 text-white font-black uppercase">
                          TOTAL
                        </span>
                      </div>
                    </td>

                    {/* Col C: id.Orig */}
                    <td className="py-1 px-2 sticky left-[170px] z-20 bg-indigo-100/95 border-r border-indigo-300 font-mono text-[10.5px] text-center text-indigo-400">
                      —
                    </td>

                    {/* Col D: Activity ID */}
                    <td className="py-1 px-2 sticky left-[255px] z-20 bg-indigo-100/95 border-r border-indigo-300 font-mono text-[10.5px]">
                      <span className="px-1.5 py-0.5 rounded bg-white/90 border border-indigo-200 text-indigo-800 text-[10px] font-bold">
                        {summaryTotals.count} {summaryTotals.count === 1 ? 'partida' : 'partidas'}
                      </span>
                    </td>

                    {/* Col E: Descripción */}
                    <td className="py-1 px-2.5 sticky left-[345px] z-20 bg-indigo-100/95 border-r border-indigo-300 font-sans max-w-[340px]">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8.5px] px-1 py-0.2 rounded border uppercase font-black bg-indigo-600 text-white border-indigo-700 shrink-0">
                          CONSOLIDADO
                        </span>
                        <span className="truncate text-xs font-black text-indigo-950" title="Total General Consolidado de Partidas">
                          Total Económico y Semanal
                        </span>
                      </div>
                    </td>

                    {/* Attribute Columns if showAttributeCols (12 cols) */}
                    {showAttributeCols && (
                      <>
                        <td className="py-1 px-2 border-r border-indigo-200 text-center text-slate-400 font-sans text-[11px] bg-indigo-50/95">—</td>
                        <td className="py-1 px-2 border-r border-indigo-200 text-center text-slate-400 font-sans text-[11px] bg-indigo-50/95">—</td>
                        <td className="py-1 px-2 border-r border-indigo-200 text-center text-slate-400 font-sans text-[11px] bg-indigo-50/95">—</td>
                        <td className="py-1 px-2 border-r border-indigo-200 text-center text-slate-400 font-sans text-[11px] bg-indigo-50/95">—</td>
                        <td className="py-1 px-2 border-r border-indigo-200 text-center text-slate-400 font-sans text-[11px] bg-indigo-50/95">—</td>
                        <td className="py-1 px-2 border-r border-indigo-200 text-center text-slate-400 font-sans text-[11px] bg-indigo-50/95">—</td>
                        <td className="py-1 px-2 border-r border-indigo-200 text-center text-slate-400 font-sans text-[11px] bg-indigo-50/95">—</td>
                        <td className="py-1 px-2 border-r border-indigo-200 text-center text-slate-400 font-sans text-[11px] bg-indigo-50/95">—</td>
                        <td className="py-1 px-2 border-r border-indigo-200 text-center text-slate-400 font-sans text-[11px] bg-indigo-50/95">—</td>
                        <td className="py-1 px-2 border-r border-indigo-200 text-center text-slate-400 font-sans text-[11px] bg-indigo-50/95">—</td>
                        <td className="py-1 px-2 border-r border-indigo-200 text-center text-slate-400 font-sans text-[11px] bg-indigo-50/95">—</td>
                        <td className="py-1 px-2 border-r border-indigo-200 text-center text-slate-400 font-sans text-[11px] bg-indigo-50/95">—</td>
                      </>
                    )}

                    {/* Col E: UND */}
                    <td className="py-1 px-2 text-center border-r border-indigo-200 text-slate-400 text-[10px] font-sans bg-indigo-50/95">—</td>

                    {/* Col F: Cant. Presupuesto */}
                    <td className="py-1 px-2 text-right border-r border-indigo-200 font-black text-slate-800 bg-indigo-50/95" title="Total Cantidad Presupuestada">
                      {summaryTotals.totalCantPresupuesto.toLocaleString('es-ES', { maximumFractionDigits: 1 })}
                    </td>

                    {/* Col G: Precio */}
                    <td className="py-1 px-2 text-right border-r border-indigo-200 text-slate-400 bg-indigo-50/95">—</td>

                    {/* Col H: Step */}
                    <td className="py-1 px-1.5 text-center border-r border-indigo-200 text-slate-400 bg-indigo-50/95">—</td>

                    {/* Col I: Venta ($) - TOTALIZADO */}
                    <td
                      className="py-1 px-2 text-right border-r border-indigo-200 font-black text-slate-950 bg-emerald-100/90 border-b-2 border-b-emerald-600 text-[11.5px] shadow-2xs"
                      title={`Total Venta Contratada: $${summaryTotals.totalVentaPresupuesto.toLocaleString('es-ES', { maximumFractionDigits: 2 })}`}
                    >
                      ${summaryTotals.totalVentaPresupuesto.toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                    </td>

                    {/* Col J: Subcontratista */}
                    <td className="py-1 px-2 border-r border-indigo-200 text-center text-slate-400 text-[10px] font-sans bg-indigo-50/95">—</td>

                    {/* Col K: Cant. Acum. */}
                    <td
                      className="py-1 px-2 text-right border-r border-indigo-200 font-black text-slate-800 bg-indigo-50/95"
                      title="Total Cantidad Física Acumulada"
                    >
                      {summaryTotals.totalCantAcumulada > 0 ? summaryTotals.totalCantAcumulada.toLocaleString('es-ES', { maximumFractionDigits: 1 }) : '—'}
                    </td>

                    {/* Col L: Avance Econ. ($) - TOTALIZADO */}
                    <td
                      className="py-1 px-2 text-right border-r border-indigo-200 font-black text-indigo-950 bg-indigo-200/90 border-b-2 border-b-indigo-700 text-[11.5px] shadow-2xs"
                      title={`Total Avance Económico Acumulado: $${summaryTotals.totalAvanceEconomico.toLocaleString('es-ES', { maximumFractionDigits: 2 })}`}
                    >
                      ${summaryTotals.totalAvanceEconomico.toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                    </td>

                    {/* Col M: Saldo ($) */}
                    <td
                      className="py-1 px-2 text-right border-r border-indigo-200 font-black text-slate-800 bg-indigo-50/95"
                      title={`Total Saldo Económico Pendiente: $${summaryTotals.totalSaldoEconomico.toLocaleString('es-ES', { maximumFractionDigits: 2 })}`}
                    >
                      ${summaryTotals.totalSaldoEconomico.toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                    </td>

                    {/* Col N: % Avance */}
                    <td className="py-1 px-1.5 text-center border-r border-indigo-200 font-sans bg-indigo-50/95">
                      <span
                        className="inline-block px-1.5 py-0.2 rounded text-[9.5px] font-black bg-indigo-600 text-white"
                        title={`Porcentaje de Avance Económico Total: ${summaryTotals.pctAvanceEconomico.toFixed(2)}%`}
                      >
                        {summaryTotals.pctAvanceEconomico.toFixed(1)}%
                      </span>
                    </td>

                    {/* Dynamic Weekly Columns: VALORES ECONÓMICOS SEMANALES TOTALIZADOS */}
                    {!showAttributeCols && displayedWeeks.map(sem => {
                      const wEcon = summaryTotals.weeklyEconomicTotals[sem.id] || 0;
                      const wQty = summaryTotals.weeklyQtyTotals[sem.id] || 0;

                      return (
                        <td
                          key={`xls-total-week-${sem.id}`}
                          className={`py-1 px-2 text-right border-r border-indigo-200 transition-colors ${
                            viewMode === 'qty'
                              ? 'bg-emerald-100/60'
                              : viewMode === 'econ'
                              ? 'bg-indigo-100/70'
                              : 'bg-indigo-50/80'
                          }`}
                          title={`Total Semana ${sem.label}:\n• Avance Económico ($): $${wEcon.toLocaleString('es-ES', { maximumFractionDigits: 2 })}\n• Cantidad Física (Q): ${wQty.toLocaleString('es-ES', { maximumFractionDigits: 2 })}`}
                        >
                          {viewMode === 'econ' && (
                            <span className="text-[11px] font-black text-indigo-950">
                              {wEcon > 0 ? `$${wEcon.toLocaleString('es-ES', { maximumFractionDigits: 0 })}` : '$0'}
                            </span>
                          )}
                          {viewMode === 'qty' && (
                            <div className="flex flex-col items-end leading-tight">
                              <span className="text-[11px] font-black text-indigo-950">
                                {wEcon > 0 ? `$${wEcon.toLocaleString('es-ES', { maximumFractionDigits: 0 })}` : '$0'}
                              </span>
                              {wQty > 0 && (
                                <span className="text-[8.5px] font-bold text-emerald-800 font-sans">
                                  ({wQty.toLocaleString('es-ES', { maximumFractionDigits: 1 })} Q)
                                </span>
                              )}
                            </div>
                          )}
                          {viewMode === 'dual' && (
                            <div className="flex items-center justify-between w-full px-0.5 text-xs font-mono">
                              <span className="text-emerald-800 font-bold text-[9.5px]">
                                {wQty > 0 ? wQty.toLocaleString('es-ES', { maximumFractionDigits: 0 }) : '0'}
                              </span>
                              <span className="text-indigo-950 font-black text-[11px]">
                                ${wEcon.toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                              </span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* XLS Rows */}
                  {paginatedNodes.map((node, localIdx) => {
                  const rowIdx = localIdx;
                  const isLeaf = node.esHoja;
                  const item = node.itemRef;
                  const isExpanded = expandedKeys.has(node.key);
                  const styles = getHierarchyRowStyles(node.nivel, isLeaf);
                  const cantPres = node.cantidadPresupuesto;
                  const precio = node.precio;
                  const step = node.step;
                  const venta = node.venta;
                  const cantAcum = node.cantAcum;
                  const avanceEcon = node.avanceEcon;
                  const saldoEcon = node.saldoEcon;
                  const pctAvance = node.pctAvance;

                  // P6 highlighting condition: Activity ID contains 'p6' (case-insensitive)
                  const actIdStr = String(node.activityId || item?.activityId || '').trim();
                  const isP6 = actIdStr.toLowerCase().includes('p6');

                  const isRowActive = activeCell?.nodeKey === node.key;
                  const rowPaddingCls = density === 'compact' ? 'py-1' : 'py-2';

                  const renderEditableAttrCell = (
                    field: string,
                    val: string,
                    titlePrefix: string,
                    maxWidthCls = 'max-w-[100px]'
                  ) => {
                    const isEditing = isLeaf && item && editingCell?.itemId === item.id && editingCell?.field === field;
                    const isActive = activeCell?.nodeKey === node.key && activeCell?.field === field;
                    const isCopied = copiedCell?.nodeKey === node.key && copiedCell?.field === field;

                    return (
                      <td
                        key={field}
                        className={`${rowPaddingCls} px-2 border-r text-[10.5px] truncate ${maxWidthCls} cursor-pointer transition-colors relative ${
                          isEditing
                            ? 'bg-white ring-2 ring-[#107c41] ring-inset z-30 p-0'
                            : isCopied
                            ? 'bg-emerald-50 ring-2 ring-emerald-500 outline-2 outline-dashed outline-emerald-600 font-bold text-slate-950 z-25 animate-pulse'
                            : isActive
                            ? 'bg-emerald-100/90 ring-2 ring-[#107c41] ring-inset font-bold text-slate-950 z-20 shadow-xs'
                            : isP6
                            ? 'bg-[#ffedd5] border-orange-200 text-orange-950 hover:bg-[#fed7aa]/80'
                            : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectCell(node.key, field);
                        }}
                        onDoubleClick={isLeaf && item ? (e) => {
                          e.stopPropagation();
                          startCellEdit(node.key, item.id, field, val || '');
                        } : undefined}
                        title={val ? `${titlePrefix}: ${val} (Clic para seleccionar, Ctrl+C / Ctrl+V, doble clic para editar)` : `Clic para seleccionar ${titlePrefix}`}
                      >
                        {isEditing ? (
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => {
                              if (isSwitchingCellRef.current) return;
                              commitEditAndNavigate();
                            }}
                            onKeyDown={handleKeyDownInCell}
                            className="w-full h-full text-[10.5px] px-1.5 py-0.5 outline-none font-bold text-slate-900 bg-white"
                          />
                        ) : (
                          <>
                            {val || (isLeaf ? <span className="text-slate-300 italic">—</span> : '—')}
                            {isActive && (
                              <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-[#107c41] pointer-events-none z-30" />
                            )}
                          </>
                        )}
                      </td>
                    );
                  };

                  return (
                    <tr
                      key={node.key}
                      onClick={() => setActiveCell({ nodeKey: node.key, field: 'view' })}
                      className={`border-b ${isP6 ? 'border-orange-200 bg-[#ffedd5] hover:bg-[#fed7aa]/80 text-orange-950' : `border-slate-200 ${styles.rowBg} ${styles.hoverBg}`} transition-colors ${
                        isRowActive ? 'ring-1 ring-emerald-500 ring-inset bg-emerald-50/40' : ''
                      } ${!isLeaf ? 'cursor-pointer select-none font-bold' : ''}`}
                    >
                      {/* Excel Row Index Header */}
                      <td
                        onClick={(e) => { e.stopPropagation(); setActiveCell({ nodeKey: node.key, field: 'row' }); }}
                        className={`${rowPaddingCls} px-1 text-center sticky left-0 z-20 ${
                          activeCell?.nodeKey === node.key && activeCell?.field === 'row'
                            ? 'bg-emerald-100 text-[#107c41] ring-2 ring-[#107c41] ring-inset font-bold'
                            : isP6 ? 'bg-[#ffedd5] text-orange-950 border-orange-200 font-bold' : 'bg-[#f8fafc] text-slate-400 border-slate-300'
                        } border-r font-mono text-[10px] select-none cursor-pointer`}
                      >
                        {rowIdx + 1}
                      </td>

                      {/* Col B: WBS / Jerarquía */}
                      <td
                        onClick={(e) => { e.stopPropagation(); setActiveCell({ nodeKey: node.key, field: 'wbs' }); }}
                        className={`${rowPaddingCls} px-2 sticky left-10 z-20 ${
                          activeCell?.nodeKey === node.key && activeCell?.field === 'wbs'
                            ? 'bg-emerald-50 ring-2 ring-[#107c41] ring-inset'
                            : isP6 ? 'bg-[#ffedd5] border-orange-200' : 'bg-inherit border-slate-300'
                        } border-r cursor-pointer`}
                      >
                        <div
                          className="flex items-center gap-1.5"
                          style={{ paddingLeft: `${Math.min(node.depth, 6) * 12}px` }}
                        >
                          {!isLeaf ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleNodeExpand(node.key);
                              }}
                              className="w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-black/10 text-slate-700 transition-colors shrink-0"
                            >
                              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            </button>
                          ) : (
                            <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                              <span className={`w-1 h-1 rounded-full ${isP6 ? 'bg-orange-600' : 'bg-slate-400'}`} />
                            </span>
                          )}
                          <span
                            className={`font-mono text-[9.5px] px-1 py-0.2 rounded border truncate font-extrabold ${isP6 ? 'bg-orange-200/90 text-orange-950 border-orange-300' : styles.wbsCls}`}
                            title={node.wbs}
                          >
                            {node.wbs || '—'}
                          </span>
                        </div>
                      </td>

                      {/* Col C: id.Orig */}
                      <td
                        onClick={(e) => { e.stopPropagation(); setActiveCell({ nodeKey: node.key, field: 'idOrig' }); }}
                        className={`${rowPaddingCls} px-2 sticky left-[170px] z-20 ${
                          activeCell?.nodeKey === node.key && activeCell?.field === 'idOrig'
                            ? 'bg-emerald-50 ring-2 ring-[#107c41] ring-inset'
                            : isP6 ? 'bg-[#ffedd5] border-orange-200 text-orange-950' : 'bg-inherit border-slate-300'
                        } border-r font-mono text-[10.5px] cursor-pointer`}
                      >
                        {isLeaf ? (
                          <span
                            className="font-semibold text-slate-700 truncate block select-text"
                            title={node.idOrig || item?.idOrig || ''}
                          >
                            {node.idOrig || item?.idOrig || '—'}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Col D: Activity ID */}
                      <td
                        onClick={(e) => { e.stopPropagation(); setActiveCell({ nodeKey: node.key, field: 'activityId' }); }}
                        className={`${rowPaddingCls} px-2 sticky left-[255px] z-20 ${
                          activeCell?.nodeKey === node.key && activeCell?.field === 'activityId'
                            ? 'bg-emerald-50 ring-2 ring-[#107c41] ring-inset'
                            : isP6 ? 'bg-[#ffedd5] border-orange-200' : 'bg-inherit border-slate-300'
                        } border-r font-mono text-[10.5px] cursor-pointer`}
                      >
                        {isLeaf && item ? (
                          <div className="flex items-center justify-between gap-1 group">
                            <span
                              className={`font-bold ${isP6 ? 'text-orange-950 font-black' : 'text-indigo-700'} hover:underline cursor-pointer truncate select-text`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenAttributesModal(item, node.activityId || item.id);
                              }}
                              title="Clic para editar atributos de este Activity ID (Macros, Grupos, Tipo, CAP, SCAP...)"
                            >
                              {node.activityId || item.activityId || '—'}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenAttributesModal(item, node.activityId || item.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 p-0.5 rounded cursor-pointer transition-opacity"
                              title="Editar atributos de este Activity ID"
                            >
                              <SlidersHorizontal className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Col E: Descripción */}
                      <td
                        onClick={(e) => { e.stopPropagation(); setActiveCell({ nodeKey: node.key, field: 'descripcion' }); }}
                        className={`${rowPaddingCls} px-2.5 sticky left-[345px] z-20 ${
                          activeCell?.nodeKey === node.key && activeCell?.field === 'descripcion'
                            ? 'bg-emerald-50 ring-2 ring-[#107c41] ring-inset'
                            : isP6 ? 'bg-[#ffedd5] border-orange-200 text-orange-950' : 'bg-inherit border-slate-300'
                        } border-r font-sans max-w-[340px] cursor-pointer`}
                      >
                        <div className="flex items-center gap-1.5">
                          {!isLeaf && (
                            <span className={`text-[8.5px] px-1 py-0.2 rounded border uppercase font-black shrink-0 ${styles.levelBadgeBg}`}>
                              {styles.levelName}
                            </span>
                          )}
                          <span className={`truncate text-xs ${isP6 ? 'font-semibold text-orange-950' : styles.textCls}`} title={node.descripcion}>
                            {node.descripcion}
                          </span>
                          {!isLeaf && (
                            <span className="ml-auto text-[9px] px-1 rounded bg-white/80 border border-slate-200 text-slate-500 font-bold shrink-0">
                              {node.totalLeavesCount}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Optional Attribute Columns */}
                      {showAttributeCols && (
                        <>
                          {renderEditableAttrCell('macro', node.macro || '', 'Macro')}
                          {renderEditableAttrCell('grupo', node.grupo || '', 'Grupo')}
                          {renderEditableAttrCell('tipo', node.tipo || '', 'Tipo')}
                          {renderEditableAttrCell('partidas', node.partidas || '', 'Partidas', 'max-w-[120px]')}
                          {renderEditableAttrCell('cap', node.cap || '', 'CAP')}
                          {renderEditableAttrCell('scap', node.scap || '', 'SCAP')}
                          {renderEditableAttrCell('unit', node.unit || '', 'Unit')}
                          {renderEditableAttrCell('componente', node.componente || '', 'Componente')}
                          {renderEditableAttrCell('ubicacion', node.ubicacion || '', 'Ubicación')}
                          {renderEditableAttrCell('proceso', node.proceso || '', 'Proceso')}
                          {renderEditableAttrCell('resp', node.resp || '', 'Responsable')}

                          {/* Col Acción Editar */}
                          <td className={`${rowPaddingCls} px-1.5 border-r ${isP6 ? 'bg-[#ffedd5] border-orange-200' : 'border-slate-300'} text-center`}>
                            {isLeaf && item ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenAttributesModal(item, node.activityId || item.id);
                                }}
                                className="px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 font-bold text-[10px] border border-indigo-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                title="Editar atributos de este Activity ID"
                              >
                                <SlidersHorizontal className="w-2.5 h-2.5" />
                                <span>Editar</span>
                              </button>
                            ) : (
                              <span className="text-slate-300 text-[10px]">—</span>
                            )}
                          </td>
                        </>
                      )}

                      {/* Col E: UND */}
                      <td
                        onClick={(e) => { e.stopPropagation(); setActiveCell({ nodeKey: node.key, field: 'unidad' }); }}
                        className={`${rowPaddingCls} px-2 border-r text-center text-[10px] uppercase cursor-pointer relative transition-colors ${
                          activeCell?.nodeKey === node.key && activeCell?.field === 'unidad'
                            ? 'bg-emerald-100/90 ring-2 ring-[#107c41] ring-inset font-bold text-slate-950 z-20 shadow-xs'
                            : isP6 ? 'bg-[#ffedd5] border-orange-200 text-orange-900' : 'border-slate-300 text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        {node.unidad || (isLeaf ? 'UND' : '—')}
                        {activeCell?.nodeKey === node.key && activeCell?.field === 'unidad' && (
                          <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-[#107c41] pointer-events-none z-30" />
                        )}
                      </td>

                      {/* Col F: Cant. Presupuesto */}
                      <td
                        onClick={(e) => {
                          e.stopPropagation();
                          selectCell(node.key, 'cantPres');
                        }}
                        onDoubleClick={
                          isLeaf && item
                            ? (e) => {
                                e.stopPropagation();
                                startCellEdit(node.key, item.id, 'cantPres', cantPres);
                              }
                            : undefined
                        }
                        className={`${rowPaddingCls} px-2.5 border-r text-right relative transition-colors ${
                          isLeaf && item && editingCell?.itemId === item.id && editingCell?.field === 'cantPres'
                            ? 'bg-white ring-2 ring-[#107c41] ring-inset z-30 p-0'
                            : copiedCell?.nodeKey === node.key && copiedCell?.field === 'cantPres'
                            ? 'bg-emerald-50 ring-2 ring-emerald-500 outline-2 outline-dashed outline-emerald-600 font-bold text-slate-950 z-25 animate-pulse'
                            : activeCell?.nodeKey === node.key && activeCell?.field === 'cantPres'
                            ? 'bg-emerald-100/90 ring-2 ring-[#107c41] ring-inset font-bold text-slate-950 z-20 shadow-xs'
                            : isP6
                            ? 'bg-[#ffedd5] border-orange-200 text-orange-950 font-semibold hover:bg-[#fed7aa]/80'
                            : `border-slate-300 ${isLeaf ? 'cursor-pointer hover:bg-slate-100' : 'font-black bg-black/5'}`
                        }`}
                        title="Clic para seleccionar (Ctrl+C / Ctrl+V) • Doble clic para editar"
                      >
                        {isLeaf && item && editingCell?.itemId === item.id && editingCell?.field === 'cantPres' ? (
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => {
                              if (isSwitchingCellRef.current) return;
                              commitEditAndNavigate();
                            }}
                            onKeyDown={handleKeyDownInCell}
                            className="w-full text-right bg-white border border-emerald-600 rounded px-1 py-0.2 text-xs font-mono font-bold outline-none"
                          />
                        ) : (
                          <>
                            {cantPres.toLocaleString('es-ES', { maximumFractionDigits: 3 })}
                            {activeCell?.nodeKey === node.key && activeCell?.field === 'cantPres' && (
                              <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-[#107c41] pointer-events-none z-30" />
                            )}
                          </>
                        )}
                      </td>

                      {/* Col G: Precio */}
                      <td
                        onClick={(e) => {
                          e.stopPropagation();
                          selectCell(node.key, 'precio');
                        }}
                        onDoubleClick={
                          isLeaf && item
                            ? (e) => {
                                e.stopPropagation();
                                startCellEdit(node.key, item.id, 'precio', precio);
                              }
                            : undefined
                        }
                        className={`${rowPaddingCls} px-2 border-r text-right relative transition-colors ${
                          isLeaf && item && editingCell?.itemId === item.id && editingCell?.field === 'precio'
                            ? 'bg-white ring-2 ring-[#107c41] ring-inset z-30 p-0'
                            : copiedCell?.nodeKey === node.key && copiedCell?.field === 'precio'
                            ? 'bg-emerald-50 ring-2 ring-emerald-500 outline-2 outline-dashed outline-emerald-600 font-bold text-slate-950 z-25 animate-pulse'
                            : activeCell?.nodeKey === node.key && activeCell?.field === 'precio'
                            ? 'bg-emerald-100/90 ring-2 ring-[#107c41] ring-inset font-bold text-slate-950 z-20 shadow-xs'
                            : isP6
                            ? 'bg-[#ffedd5] border-orange-200 text-orange-950 hover:bg-[#fed7aa]/80'
                            : `border-slate-300 ${isLeaf ? 'cursor-pointer hover:bg-slate-100' : 'text-slate-400 bg-black/5'}`
                        }`}
                        title="Clic para seleccionar (Ctrl+C / Ctrl+V) • Doble clic para editar"
                      >
                        {isLeaf && item && editingCell?.itemId === item.id && editingCell?.field === 'precio' ? (
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => {
                              if (isSwitchingCellRef.current) return;
                              commitEditAndNavigate();
                            }}
                            onKeyDown={handleKeyDownInCell}
                            className="w-full text-right bg-white border border-emerald-600 rounded px-1 py-0.2 text-xs font-mono font-bold outline-none"
                          />
                        ) : (
                          <>
                            {isLeaf ? `$${precio.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                            {activeCell?.nodeKey === node.key && activeCell?.field === 'precio' && (
                              <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-[#107c41] pointer-events-none z-30" />
                            )}
                          </>
                        )}
                      </td>

                      {/* Col H: Step */}
                      <td
                        onClick={(e) => {
                          e.stopPropagation();
                          selectCell(node.key, 'step');
                        }}
                        onDoubleClick={
                          isLeaf && item
                            ? (e) => {
                                e.stopPropagation();
                                startCellEdit(node.key, item.id, 'step', step);
                              }
                            : undefined
                        }
                        className={`${rowPaddingCls} px-1.5 border-r text-center relative transition-colors ${
                          isLeaf && item && editingCell?.itemId === item.id && editingCell?.field === 'step'
                            ? 'bg-white ring-2 ring-[#107c41] ring-inset z-30 p-0'
                            : copiedCell?.nodeKey === node.key && copiedCell?.field === 'step'
                            ? 'bg-emerald-50 ring-2 ring-emerald-500 outline-2 outline-dashed outline-emerald-600 font-bold text-slate-950 z-25 animate-pulse'
                            : activeCell?.nodeKey === node.key && activeCell?.field === 'step'
                            ? 'bg-emerald-100/90 ring-2 ring-[#107c41] ring-inset font-bold text-slate-950 z-20 shadow-xs'
                            : isP6
                            ? 'bg-[#ffedd5] border-orange-200 text-orange-950 hover:bg-[#fed7aa]/80'
                            : `border-slate-300 ${isLeaf ? 'cursor-pointer hover:bg-slate-100' : 'text-slate-400 bg-black/5'}`
                        }`}
                        title="Clic para seleccionar (Ctrl+C / Ctrl+V) • Doble clic para editar"
                      >
                        {isLeaf && item && editingCell?.itemId === item.id && editingCell?.field === 'step' ? (
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => {
                              if (isSwitchingCellRef.current) return;
                              commitEditAndNavigate();
                            }}
                            onKeyDown={handleKeyDownInCell}
                            className="w-full text-center bg-white border border-emerald-600 rounded px-1 py-0.2 text-xs font-mono font-bold outline-none"
                          />
                        ) : (
                          <>
                            {isLeaf ? step.toLocaleString('es-ES', { maximumFractionDigits: 2 }) : '—'}
                            {activeCell?.nodeKey === node.key && activeCell?.field === 'step' && (
                              <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-[#107c41] pointer-events-none z-30" />
                            )}
                          </>
                        )}
                      </td>

                      {/* Col I: Venta */}
                      <td
                        onClick={(e) => { e.stopPropagation(); selectCell(node.key, 'venta'); }}
                        className={`${rowPaddingCls} px-2.5 border-r text-right font-bold relative transition-colors cursor-pointer ${
                          activeCell?.nodeKey === node.key && activeCell?.field === 'venta'
                            ? 'bg-emerald-100/90 ring-2 ring-[#107c41] ring-inset font-bold text-slate-950 z-20 shadow-xs'
                            : isP6 ? 'bg-[#ffedd5] border-orange-200 text-orange-950' : 'border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        ${venta.toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                        {activeCell?.nodeKey === node.key && activeCell?.field === 'venta' && (
                          <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-[#107c41] pointer-events-none z-30" />
                        )}
                      </td>

                      {/* Col J: Subcontratista */}
                      <td
                        onClick={(e) => { e.stopPropagation(); selectCell(node.key, 'subcontratista'); }}
                        className={`${rowPaddingCls} px-2 border-r text-[11px] truncate max-w-[105px] relative transition-colors cursor-pointer ${
                          activeCell?.nodeKey === node.key && activeCell?.field === 'subcontratista'
                            ? 'bg-emerald-100/90 ring-2 ring-[#107c41] ring-inset font-bold text-slate-950 z-20 shadow-xs'
                            : isP6 ? 'bg-[#ffedd5] border-orange-200 text-orange-950' : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {node.subcontratista || (isLeaf ? '—' : '')}
                        {activeCell?.nodeKey === node.key && activeCell?.field === 'subcontratista' && (
                          <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-[#107c41] pointer-events-none z-30" />
                        )}
                      </td>

                      {/* Col K: Cant. Acumulada */}
                      <td
                        onClick={(e) => { e.stopPropagation(); selectCell(node.key, 'cantAcum'); }}
                        className={`${rowPaddingCls} px-2.5 border-r text-right font-black relative transition-colors cursor-pointer ${
                          activeCell?.nodeKey === node.key && activeCell?.field === 'cantAcum'
                            ? 'bg-emerald-100/90 ring-2 ring-[#107c41] ring-inset font-bold text-slate-950 z-20 shadow-xs'
                            : isP6 ? 'bg-[#ffedd5] border-orange-200 text-orange-950 font-black' : 'border-slate-300 text-indigo-900 bg-indigo-50/30 hover:bg-indigo-50/60'
                        }`}
                      >
                        {cantAcum > 0 ? cantAcum.toLocaleString('es-ES', { maximumFractionDigits: 3 }) : '—'}
                        {activeCell?.nodeKey === node.key && activeCell?.field === 'cantAcum' && (
                          <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-[#107c41] pointer-events-none z-30" />
                        )}
                      </td>

                      {/* Col L: Avance Económico */}
                      <td
                        onClick={(e) => { e.stopPropagation(); selectCell(node.key, 'avanceEcon'); }}
                        className={`${rowPaddingCls} px-2.5 border-r text-right font-black relative transition-colors cursor-pointer ${
                          activeCell?.nodeKey === node.key && activeCell?.field === 'avanceEcon'
                            ? 'bg-emerald-100/90 ring-2 ring-[#107c41] ring-inset font-bold text-slate-950 z-20 shadow-xs'
                            : isP6 ? 'bg-[#ffedd5] border-orange-200 text-orange-950 font-black' : 'border-slate-300 text-indigo-950 bg-indigo-50/30 hover:bg-indigo-50/60'
                        }`}
                      >
                        {avanceEcon > 0 ? `$${avanceEcon.toLocaleString('es-ES', { maximumFractionDigits: 0 })}` : '—'}
                        {activeCell?.nodeKey === node.key && activeCell?.field === 'avanceEcon' && (
                          <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-[#107c41] pointer-events-none z-30" />
                        )}
                      </td>

                      {/* Col M: Saldo */}
                      <td
                        onClick={(e) => { e.stopPropagation(); selectCell(node.key, 'saldoEcon'); }}
                        className={`${rowPaddingCls} px-2.5 border-r text-right font-medium relative transition-colors cursor-pointer ${
                          activeCell?.nodeKey === node.key && activeCell?.field === 'saldoEcon'
                            ? 'bg-emerald-100/90 ring-2 ring-[#107c41] ring-inset font-bold text-slate-950 z-20 shadow-xs'
                            : isP6 ? 'bg-[#ffedd5] border-orange-200 text-orange-950' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        ${saldoEcon.toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                        {activeCell?.nodeKey === node.key && activeCell?.field === 'saldoEcon' && (
                          <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-[#107c41] pointer-events-none z-30" />
                        )}
                      </td>

                      {/* Col N: % Avance */}
                      <td
                        onClick={(e) => { e.stopPropagation(); selectCell(node.key, 'pctAvance'); }}
                        className={`${rowPaddingCls} px-1.5 border-r text-center font-sans font-bold text-[10px] relative transition-colors cursor-pointer ${
                          activeCell?.nodeKey === node.key && activeCell?.field === 'pctAvance'
                            ? 'bg-emerald-100/90 ring-2 ring-[#107c41] ring-inset font-bold text-slate-950 z-20 shadow-xs'
                            : isP6 ? 'bg-[#ffedd5] border-orange-200 text-orange-950 font-bold' : 'border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <span
                          className={`inline-block px-1 py-0.2 rounded ${
                            pctAvance >= 100
                              ? 'bg-emerald-100 text-emerald-800'
                              : pctAvance > 0
                              ? (isP6 ? 'bg-orange-200 text-orange-950 font-extrabold border border-orange-300' : 'bg-indigo-100 text-indigo-800')
                              : (isP6 ? 'bg-orange-200/50 text-orange-800' : 'bg-slate-100 text-slate-400')
                          }`}
                        >
                          {pctAvance.toFixed(1)}%
                        </span>
                        {activeCell?.nodeKey === node.key && activeCell?.field === 'pctAvance' && (
                          <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-[#107c41] pointer-events-none z-30" />
                        )}
                      </td>

                      {/* DYNAMIC WEEKLY CELLS (Hidden when in attribute view) */}
                      {!showAttributeCols && displayedWeeks.map(sem => {
                        const qVal = node.cantidadesSemanales?.[sem.id] || 0;
                        const vVal = node.avanceEconSemanales?.[sem.id] || 0;
                        const isEditingThis =
                          isLeaf &&
                          item &&
                          editingCell?.itemId === item.id &&
                          editingCell?.field === 'qty' &&
                          editingCell?.weekId === sem.id;
                        const isWeeklyCellActive =
                          activeCell?.nodeKey === node.key &&
                          activeCell?.field === 'qty' &&
                          activeCell?.weekId === sem.id;
                        const isWeeklyCellCopied =
                          copiedCell?.nodeKey === node.key &&
                          copiedCell?.field === 'qty' &&
                          copiedCell?.weekId === sem.id;

                        return (
                          <td
                            key={sem.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              selectCell(node.key, 'qty', sem.id);
                            }}
                            onDoubleClick={
                              isLeaf && item
                                ? (e) => {
                                    e.stopPropagation();
                                    startCellEdit(node.key, item.id, 'qty', qVal, sem.id);
                                  }
                                : undefined
                            }
                            className={`${rowPaddingCls} px-2 border-r ${isP6 ? 'border-orange-200' : 'border-slate-300'} text-right transition-colors relative ${
                              isEditingThis
                                ? 'bg-white ring-2 ring-[#107c41] ring-inset z-30 p-0.5'
                                : isWeeklyCellCopied
                                ? 'bg-emerald-50 ring-2 ring-emerald-500 outline-2 outline-dashed outline-emerald-600 font-bold text-slate-950 z-25 animate-pulse'
                                : isWeeklyCellActive
                                ? 'bg-emerald-100/90 ring-2 ring-[#107c41] ring-inset font-bold text-slate-950 z-20 shadow-xs'
                                : !isLeaf
                                ? 'bg-black/5 font-bold'
                                : qVal > 0
                                ? (isP6 ? 'bg-[#fed7aa] hover:bg-orange-300 cursor-pointer font-bold text-orange-950' : 'bg-emerald-50/70 hover:bg-emerald-100/80 cursor-pointer font-bold')
                                : (isP6 ? 'bg-[#ffedd5] hover:bg-[#fed7aa]/80 cursor-pointer text-orange-900' : 'hover:bg-slate-100 cursor-pointer')
                            }`}
                            title={
                              isLeaf
                                ? `Clic para seleccionar (Ctrl+C / Ctrl+V) • Doble clic para editar • [Enter] fila sig. • [Tab] sem. sig.`
                                : undefined
                            }
                          >
                            {isEditingThis ? (
                              <input
                                ref={editInputRef}
                                type="text"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={() => {
                                  if (isSwitchingCellRef.current) return;
                                  commitEditAndNavigate();
                                }}
                                onKeyDown={handleKeyDownInCell}
                                placeholder="0"
                                className="w-full text-right bg-white border-2 border-emerald-600 rounded px-1.5 py-0.5 text-xs font-mono font-black text-slate-900 shadow-sm outline-none"
                              />
                            ) : (
                              <>
                                {viewMode === 'qty' ? (
                                  <span className={qVal > 0 ? (isP6 ? 'text-orange-950 font-black' : 'text-emerald-800 font-bold') : (isP6 ? 'text-orange-300' : 'text-slate-300')}>
                                    {qVal > 0 ? qVal.toLocaleString('es-ES', { maximumFractionDigits: 3 }) : '—'}
                                  </span>
                                ) : viewMode === 'econ' ? (
                                  <span className={vVal > 0 ? (isP6 ? 'text-orange-950 font-black' : 'text-indigo-900 font-bold') : (isP6 ? 'text-orange-300' : 'text-slate-300')}>
                                    {vVal > 0 ? `$${vVal.toLocaleString('es-ES', { maximumFractionDigits: 0 })}` : '—'}
                                  </span>
                                ) : (
                                  <div className="flex flex-col text-[10px] leading-tight">
                                    <span className={qVal > 0 ? (isP6 ? 'text-orange-950 font-black' : 'text-emerald-800 font-bold') : (isP6 ? 'text-orange-300' : 'text-slate-300')}>
                                      {qVal > 0 ? qVal.toLocaleString('es-ES', { maximumFractionDigits: 2 }) : '0'}
                                    </span>
                                    <span className={vVal > 0 ? (isP6 ? 'text-orange-900 font-bold text-[9px]' : 'text-indigo-800 text-[9px]') : (isP6 ? 'text-orange-300 text-[9px]' : 'text-slate-300 text-[9px]')}>
                                      {vVal > 0 ? `$${vVal.toLocaleString('es-ES', { maximumFractionDigits: 0 })}` : '$0'}
                                    </span>
                                  </div>
                                )}
                                {isWeeklyCellActive && (
                                  <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-[#107c41] pointer-events-none z-30" />
                                )}
                              </>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* 4.5. EXCEL SLICING BAR */}
        <div className="bg-slate-50 border-t border-slate-300 px-4 py-1.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 select-none font-sans">
          <div className="flex items-center gap-2 text-slate-600">
            <span className="font-semibold text-slate-800">
              Mostrando {Math.min(renderLimit, filteredNodes.length)} de {filteredNodes.length} filas
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500 font-medium text-[11px]">
              {expandedKeys.size === 0
                ? '⚡ Por defecto todo está colapsado para máxima velocidad. Haz clic en ▶ en cualquier capítulo para desplegar partidas.'
                : `${expandedKeys.size} niveles desplegados.`}
            </span>
          </div>
        </div>

        {/* 5. EXCEL STATUS BAR */}
        <div className="bg-[#F5F8F9] text-[#14212A] px-4 py-1.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 select-none border-t border-[#D5DEE2] font-sans">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 bg-white text-[#5A6A74] rounded border border-[#D5DEE2]">
              LISTO
            </span>
            <span className="text-[11px] text-[#5A6A74] hidden sm:inline">
              ⚡ Teclas rápidas: <strong>[Enter]</strong> siguiente fila • <strong>[Tab]</strong> siguiente semana • <strong>[Esc]</strong> salir del modo XLS
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-[#5A6A74]">
            <span>FILAS VISIBLES: <strong>{filteredNodes.length}</strong></span>
            <span>SUMA AVANCE: <strong>${totals.totalAvanceEconomico.toLocaleString('es-ES', { maximumFractionDigits: 0 })}</strong></span>
            <span>% AVANCE PROMEDIO: <strong>{totals.pctAvanceEconomico.toFixed(1)}%</strong></span>
          </div>
        </div>

        {/* 6. FLOATING EXCEL CLIPBOARD TOAST */}
        {copyToast && (
          <div className="fixed bottom-12 right-6 z-50 flex items-center gap-2.5 bg-slate-900/95 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-slate-700 text-xs font-sans backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200">
            {copyToast.type === 'copy' ? (
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <Copy className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <ClipboardPaste className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            )}
            <span className="font-semibold text-slate-100">{copyToast.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
