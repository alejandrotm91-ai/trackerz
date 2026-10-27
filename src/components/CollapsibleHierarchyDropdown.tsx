import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, Check, X, Calendar, Search } from 'lucide-react';

export interface HierarchyItem {
  value: string;
  label: string;
}

export interface HierarchyMonthGroup {
  monthKey: string;
  monthName: string;
  monthNum: number;
  monthLabel?: string;
  items: HierarchyItem[];
}

export interface HierarchyYearGroup {
  year: string;
  meses: HierarchyMonthGroup[];
}

export interface CollapsibleHierarchyDropdownProps {
  id?: string;
  label: string;
  // Multi-select props
  isMultiSelect?: boolean;
  selectedValues?: Set<string>;
  isAllSelected?: boolean;
  onMultiChange?: (values: Set<string>, isAll: boolean) => void;
  // Single-select legacy props
  value?: string;
  onChange?: (value: string) => void;
  allOptionLabel: string;
  groups: HierarchyYearGroup[];
  icon?: React.ReactNode;
  placeholder?: string;
}

export const CollapsibleHierarchyDropdown: React.FC<CollapsibleHierarchyDropdownProps> = ({
  id,
  label,
  isMultiSelect = false,
  selectedValues = new Set(),
  isAllSelected = true,
  onMultiChange,
  value = 'all',
  onChange,
  allOptionLabel,
  groups,
  icon
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputSearchRef = useRef<HTMLInputElement>(null);

  // All item values across all groups
  const allItemValues = useMemo(() => {
    const set = new Set<string>();
    groups.forEach(y => {
      y.meses.forEach(m => {
        m.items.forEach(it => set.add(it.value));
      });
    });
    return set;
  }, [groups]);

  // Find currently selected item label for trigger button
  const selectedLabel = useMemo(() => {
    if (isMultiSelect) {
      if (isAllSelected || selectedValues.size === 0 || selectedValues.size === allItemValues.size) {
        return allOptionLabel;
      }
      if (selectedValues.size === 1) {
        const singleVal = Array.from(selectedValues)[0];
        for (const yearGroup of groups) {
          for (const monthGroup of yearGroup.meses) {
            const found = monthGroup.items.find(item => item.value === singleVal);
            if (found) return found.label;
          }
        }
        return singleVal;
      }
      const isSemana = label.toLowerCase().includes('semana');
      return `${selectedValues.size} ${isSemana ? 'semanas' : 'días'} seleccionados`;
    }

    if (!value || value === 'all') return allOptionLabel;
    for (const yearGroup of groups) {
      for (const monthGroup of yearGroup.meses) {
        const found = monthGroup.items.find(item => item.value === value);
        if (found) return found.label;
      }
    }
    return value;
  }, [isMultiSelect, isAllSelected, selectedValues, allItemValues.size, allOptionLabel, groups, label, value]);

  const hasActiveSelection = isMultiSelect
    ? !isAllSelected && selectedValues.size > 0 && selectedValues.size < allItemValues.size
    : value && value !== 'all';

  // Which month groups are expanded
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    groups.forEach(y => {
      y.meses.forEach(m => {
        const key = `${y.year}-${m.monthKey}`;
        const hasSelected = isMultiSelect
          ? !isAllSelected && m.items.some(item => selectedValues.has(item.value))
          : value && value !== 'all' && m.items.some(item => item.value === value);
        initial[key] = !!hasSelected;
      });
    });
    return initial;
  });

  // Keep months updated when groups change
  useEffect(() => {
    setExpandedMonths(prev => {
      const next = { ...prev };
      groups.forEach(y => {
        y.meses.forEach(m => {
          const key = `${y.year}-${m.monthKey}`;
          if (next[key] === undefined) {
            const hasSelected = isMultiSelect
              ? !isAllSelected && m.items.some(item => selectedValues.has(item.value))
              : value && value !== 'all' && m.items.some(item => item.value === value);
            next[key] = !!hasSelected;
          }
        });
      });
      return next;
    });
  }, [groups, isMultiSelect, isAllSelected, selectedValues, value]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => inputSearchRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleMonth = (monthIdentifier: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setExpandedMonths(prev => ({
      ...prev,
      [monthIdentifier]: !prev[monthIdentifier]
    }));
  };

  const handleSelectAll = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (isMultiSelect && onMultiChange) {
      onMultiChange(new Set(allItemValues), true);
    } else if (onChange) {
      onChange('all');
      setIsOpen(false);
    }
  };

  const handleClearAll = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (isMultiSelect && onMultiChange) {
      onMultiChange(new Set(), false);
    } else if (onChange) {
      onChange('all');
    }
  };

  const handleItemClick = (itemVal: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isMultiSelect) {
      if (onChange) onChange(itemVal);
      setIsOpen(false);
      setSearchQuery('');
      return;
    }

    if (!onMultiChange) return;
    const next = new Set(selectedValues);
    if (isAllSelected) {
      // In all-selected state, unchecking one creates a set with all others
      allItemValues.forEach(v => next.add(v));
      next.delete(itemVal);
      onMultiChange(next, false);
    } else {
      if (next.has(itemVal)) {
        next.delete(itemVal);
      } else {
        next.add(itemVal);
      }
      const isAllNow = next.size === allItemValues.size;
      onMultiChange(next, isAllNow);
    }
  };

  const handleToggleWholeMonth = (monthGroup: HierarchyMonthGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isMultiSelect || !onMultiChange) return;

    const monthVals = monthGroup.items.map(it => it.value);
    const allInMonthSelected = monthVals.length > 0 && monthVals.every(v => isAllSelected || selectedValues.has(v));
    const next = new Set(selectedValues);

    if (isAllSelected) {
      // Deselect all items of this month from all-selected state
      allItemValues.forEach(v => next.add(v));
      monthVals.forEach(v => next.delete(v));
      onMultiChange(next, false);
    } else if (allInMonthSelected) {
      monthVals.forEach(v => next.delete(v));
      onMultiChange(next, false);
    } else {
      monthVals.forEach(v => next.add(v));
      const isAllNow = next.size === allItemValues.size;
      onMultiChange(next, isAllNow);
    }
  };

  const expandAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next: Record<string, boolean> = {};
    groups.forEach(y => {
      y.meses.forEach(m => {
        next[`${y.year}-${m.monthKey}`] = true;
      });
    });
    setExpandedMonths(next);
  };

  const collapseAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next: Record<string, boolean> = {};
    groups.forEach(y => {
      y.meses.forEach(m => {
        next[`${y.year}-${m.monthKey}`] = false;
      });
    });
    setExpandedMonths(next);
  };

  // Filter groups when search is typed
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase().trim();

    return groups
      .map(y => {
        const matchingMeses = y.meses
          .map(m => {
            const matchesMonth =
              m.monthName.toLowerCase().includes(q) ||
              (m.monthLabel && m.monthLabel.toLowerCase().includes(q)) ||
              y.year.includes(q);

            const filteredItems = m.items.filter(
              item =>
                item.label.toLowerCase().includes(q) ||
                item.value.toLowerCase().includes(q) ||
                matchesMonth
            );

            if (filteredItems.length > 0) {
              return {
                ...m,
                items: filteredItems
              };
            }
            return null;
          })
          .filter(Boolean) as HierarchyMonthGroup[];

        if (matchingMeses.length > 0) {
          return {
            ...y,
            meses: matchingMeses
          };
        }
        return null;
      })
      .filter(Boolean) as HierarchyYearGroup[];
  }, [groups, searchQuery]);

  return (
    <div className="relative" ref={dropdownRef} id={id}>
      <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1">
          {icon}
          {label}
        </span>
        {hasActiveSelection && (
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
          >
            Limpiar ({isMultiSelect ? selectedValues.size : 1})
          </button>
        )}
      </label>

      {/* Dropdown Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full text-xs bg-white border rounded-xl px-2.5 py-2 font-medium text-left flex items-center justify-between transition-all cursor-pointer ${
          isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 text-indigo-900 bg-indigo-50/20'
            : hasActiveSelection
            ? 'border-indigo-400 text-indigo-950 font-bold bg-indigo-50/50 ring-1 ring-indigo-300'
            : 'border-slate-300 text-slate-800 hover:border-slate-400'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate pr-1">
          <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span className="truncate">{selectedLabel}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {hasActiveSelection && isMultiSelect && (
            <span className="bg-indigo-600 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
              {selectedValues.size}
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-indigo-600' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 min-w-[260px]">
          {/* Header & Quick Search */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/80 space-y-1.5">
            <div className="relative">
              <input
                ref={inputSearchRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar mes, semana o día..."
                className="w-full text-[11px] bg-white border border-slate-200 rounded-lg pl-7 pr-6 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Quick Actions (Select all / Clear / Expand all) */}
            <div className="flex items-center justify-between px-1 text-[10px] text-slate-500 font-medium">
              <div className="flex items-center gap-1.5">
                {isMultiSelect ? (
                  <>
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="px-1.5 py-0.5 text-[9.5px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded transition-colors cursor-pointer"
                    >
                      ✓ Todo
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="px-1.5 py-0.5 text-[9.5px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors cursor-pointer"
                    >
                      ✗ Limpiar
                    </button>
                  </>
                ) : (
                  <span>Jerarquía Año/Mes</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={expandAll}
                  className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer text-[10px]"
                >
                  Expandir
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="text-slate-500 hover:text-slate-800 hover:underline cursor-pointer text-[10px]"
                >
                  Colapsar
                </button>
              </div>
            </div>
          </div>

          {/* List Content */}
          <div className="max-h-72 overflow-y-auto p-1.5 space-y-1 text-xs divide-y divide-slate-100">
            {/* Option "Todos" */}
            <div className="pb-1">
              <button
                type="button"
                onClick={handleSelectAll}
                className={`w-full px-2.5 py-1.5 rounded-lg text-left font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                  (isMultiSelect && (isAllSelected || selectedValues.size === allItemValues.size)) || (!isMultiSelect && (value === 'all' || !value))
                    ? 'bg-indigo-50 text-indigo-900 border border-indigo-200 font-bold'
                    : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                    (isMultiSelect && (isAllSelected || selectedValues.size === allItemValues.size)) || (!isMultiSelect && (value === 'all' || !value))
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-slate-300 bg-white'
                  }`}>
                    {((isMultiSelect && (isAllSelected || selectedValues.size === allItemValues.size)) || (!isMultiSelect && (value === 'all' || !value))) && (
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    )}
                  </div>
                  <span>{allOptionLabel}</span>
                </div>
              </button>
            </div>

            {/* Groups by Year & Month */}
            {filteredGroups.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400">
                No se encontraron opciones coincidentes
              </div>
            ) : (
              filteredGroups.map(yearGroup => (
                <div key={yearGroup.year} className="pt-1.5 space-y-1">
                  {/* Year Header (if multiple years) */}
                  {groups.length > 1 && (
                    <div className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Año {yearGroup.year}
                    </div>
                  )}

                  {/* Month Accordions */}
                  {yearGroup.meses.map(monthGroup => {
                    const monthKey = `${yearGroup.year}-${monthGroup.monthKey}`;
                    const isExpanded = searchQuery.trim() ? true : !!expandedMonths[monthKey];
                    const monthVals = monthGroup.items.map(it => it.value);
                    const selectedCountInMonth = monthVals.filter(v => isAllSelected || selectedValues.has(v)).length;
                    const allInMonthSelected = monthVals.length > 0 && selectedCountInMonth === monthVals.length;
                    const hasSelectedInside = isMultiSelect
                      ? selectedCountInMonth > 0
                      : monthGroup.items.some(it => it.value === value);

                    return (
                      <div
                        key={monthKey}
                        className={`rounded-lg border transition-all ${
                          hasSelectedInside
                            ? 'border-indigo-200 bg-indigo-50/30'
                            : 'border-slate-100 bg-slate-50/50'
                        }`}
                      >
                        {/* Collapsible Month Header */}
                        <div className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-100/80 transition-colors">
                          <button
                            type="button"
                            onClick={(e) => toggleMonth(monthKey, e)}
                            className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
                            title="Clic para colapsar o expandir este mes"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )}
                            <span className="font-bold text-slate-800 text-[11px] truncate">
                              {monthGroup.monthName} {yearGroup.year}
                            </span>
                          </button>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isMultiSelect ? (
                              <button
                                type="button"
                                onClick={(e) => handleToggleWholeMonth(monthGroup, e)}
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                                  allInMonthSelected
                                    ? 'bg-indigo-600 text-white'
                                    : selectedCountInMonth > 0
                                    ? 'bg-indigo-100 text-indigo-800 font-extrabold'
                                    : 'bg-slate-200/80 text-slate-600 hover:bg-slate-300'
                                }`}
                                title={allInMonthSelected ? 'Deseleccionar todo este mes' : 'Seleccionar todo este mes'}
                              >
                                {selectedCountInMonth}/{monthGroup.items.length}
                              </button>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200/70 text-slate-600 font-semibold">
                                {monthGroup.items.length}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Collapsible Items List (Semanas o Días) */}
                        {isExpanded && (
                          <div className="pl-3 pr-1 pb-1 pt-0.5 space-y-0.5 border-t border-slate-100/60">
                            {monthGroup.items.map(item => {
                              const isSelected = isMultiSelect
                                ? isAllSelected || selectedValues.has(item.value)
                                : item.value === value;

                              return (
                                <button
                                  key={item.value}
                                  type="button"
                                  onClick={(e) => handleItemClick(item.value, e)}
                                  className={`w-full px-2 py-1 rounded-md text-left text-[11px] font-medium flex items-center justify-between transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-indigo-50 text-indigo-950 font-bold border border-indigo-200/60'
                                      : 'text-slate-700 hover:bg-slate-100 border border-transparent'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 truncate pr-1">
                                    {isMultiSelect && (
                                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                                        isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                                      }`}>
                                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                      </div>
                                    )}
                                    <span className="truncate">{item.label}</span>
                                  </div>
                                  {!isMultiSelect && isSelected && (
                                    <Check className="w-3 h-3 text-indigo-600 shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer for Multi-Select */}
          {isMultiSelect && (
            <div className="p-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-600 font-medium">
                {isAllSelected ? 'Todas activas' : `${selectedValues.size} seleccionadas`}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors cursor-pointer text-xs shadow-xs"
              >
                Listo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
