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

interface CollapsibleHierarchyDropdownProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  allOptionLabel: string;
  groups: HierarchyYearGroup[];
  icon?: React.ReactNode;
  placeholder?: string;
}

export const CollapsibleHierarchyDropdown: React.FC<CollapsibleHierarchyDropdownProps> = ({
  id,
  label,
  value,
  onChange,
  allOptionLabel,
  groups,
  icon
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputSearchRef = useRef<HTMLInputElement>(null);

  // Find currently selected item label
  const selectedLabel = useMemo(() => {
    if (!value || value === 'all') return allOptionLabel;
    for (const yearGroup of groups) {
      for (const monthGroup of yearGroup.meses) {
        const found = monthGroup.items.find(item => item.value === value);
        if (found) return found.label;
      }
    }
    return value;
  }, [value, allOptionLabel, groups]);

  // Which month groups are expanded.
  // By default, months are collapsed (unless containing current selection).
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    groups.forEach(y => {
      y.meses.forEach(m => {
        const key = `${y.year}-${m.monthKey}`;
        const hasSelected = value && value !== 'all' && m.items.some(item => item.value === value);
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
            const hasSelected = value && value !== 'all' && m.items.some(item => item.value === value);
            next[key] = !!hasSelected;
          }
        });
      });
      return next;
    });
  }, [groups, value]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Auto-focus search box
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

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery('');
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

  const hasActiveSelection = value && value !== 'all';

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
            onClick={(e) => {
              e.stopPropagation();
              handleSelect('all');
            }}
            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
          >
            Limpiar
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
            ? 'border-indigo-300 text-indigo-950 font-bold bg-indigo-50/40'
            : 'border-slate-300 text-slate-800 hover:border-slate-400'
        }`}
      >
        <span className="truncate pr-2">{selectedLabel}</span>
        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-indigo-600' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 min-w-[240px]">
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

            {/* Quick Actions (Collapse / Expand all months) */}
            <div className="flex items-center justify-between px-1 text-[10px] text-slate-500 font-medium">
              <span>Jerarquía por Año y Mes</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={expandAll}
                  className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                >
                  Expandir
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
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
                onClick={() => handleSelect('all')}
                className={`w-full px-2.5 py-1.5 rounded-lg text-left font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                  value === 'all' || !value
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>{allOptionLabel}</span>
                {(value === 'all' || !value) && <Check className="w-3.5 h-3.5 text-indigo-600" />}
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
                    const hasSelectedInside = monthGroup.items.some(it => it.value === value);

                    return (
                      <div
                        key={monthKey}
                        className={`rounded-lg border transition-all ${
                          hasSelectedInside
                            ? 'border-indigo-200 bg-indigo-50/30'
                            : 'border-slate-100 bg-slate-50/50'
                        }`}
                      >
                        {/* Collapsible Month Header Button */}
                        <button
                          type="button"
                          onClick={(e) => toggleMonth(monthKey, e)}
                          className="w-full px-2 py-1.5 flex items-center justify-between text-left hover:bg-slate-100/80 rounded-lg transition-colors cursor-pointer"
                          title="Clic para colapsar o expandir este mes"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )}
                            <span className="font-bold text-slate-800 text-[11px] truncate">
                              {monthGroup.monthName} {yearGroup.year}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200/70 text-slate-600 font-semibold">
                              {monthGroup.items.length}
                            </span>
                          </div>
                        </button>

                        {/* Collapsible Items List (Semanas o Días) */}
                        {isExpanded && (
                          <div className="pl-4 pr-1 pb-1 pt-0.5 space-y-0.5 border-t border-slate-100/60">
                            {monthGroup.items.map(item => {
                              const isSelected = item.value === value;
                              return (
                                <button
                                  key={item.value}
                                  type="button"
                                  onClick={() => handleSelect(item.value)}
                                  className={`w-full px-2 py-1 rounded-md text-left text-[11px] font-medium flex items-center justify-between transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                                      : 'text-slate-700 hover:bg-slate-200/70'
                                  }`}
                                >
                                  <span className="truncate pr-1.5">{item.label}</span>
                                  {isSelected && <Check className="w-3 h-3 text-white shrink-0" />}
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
        </div>
      )}
    </div>
  );
};
