import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, ChevronDown, Check, X, Search } from 'lucide-react';

export interface MonthItem {
  key: string;
  label: string;
  monthNum: number;
}

export interface MonthYearGroup {
  year: string;
  meses: MonthItem[];
}

export interface MultiSelectMonthDropdownProps {
  id?: string;
  label?: string;
  selectedMeses: Set<string>;
  isAllMesesSelected: boolean;
  onMultiChange: (selected: Set<string>, isAll: boolean) => void;
  groups: MonthYearGroup[];
  allOptionLabel?: string;
  icon?: React.ReactNode;
}

export const MultiSelectMonthDropdown: React.FC<MultiSelectMonthDropdownProps> = ({
  id,
  label = 'Mes:',
  selectedMeses,
  isAllMesesSelected,
  onMultiChange,
  groups,
  allOptionLabel = 'Todos los Meses',
  icon
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputSearchRef = useRef<HTMLInputElement>(null);

  // All available month keys
  const allMonthKeys = useMemo(() => {
    const set = new Set<string>();
    groups.forEach(y => {
      y.meses.forEach(m => set.add(m.key));
    });
    return set;
  }, [groups]);

  // Find label for trigger button
  const selectedLabel = useMemo(() => {
    if (isAllMesesSelected || selectedMeses.size === 0 || selectedMeses.size === allMonthKeys.size) {
      return allOptionLabel;
    }
    if (selectedMeses.size === 1) {
      const singleKey = Array.from(selectedMeses)[0];
      for (const y of groups) {
        const found = y.meses.find(m => m.key === singleKey);
        if (found) return found.label;
      }
      return singleKey;
    }
    return `${selectedMeses.size} meses seleccionados`;
  }, [isAllMesesSelected, selectedMeses, allMonthKeys.size, allOptionLabel, groups]);

  const hasActiveSelection = !isAllMesesSelected && selectedMeses.size > 0 && selectedMeses.size < allMonthKeys.size;

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

  const handleSelectAll = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    onMultiChange(new Set(allMonthKeys), true);
  };

  const handleClearAll = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    onMultiChange(new Set(), false);
  };

  const toggleMonth = (monthKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const next = new Set(selectedMeses);
    if (isAllMesesSelected) {
      // In all-selected state, unchecking one selects all the others
      allMonthKeys.forEach(k => next.add(k));
      next.delete(monthKey);
      onMultiChange(next, false);
    } else {
      if (next.has(monthKey)) {
        next.delete(monthKey);
      } else {
        next.add(monthKey);
      }
      const isAllNow = next.size === allMonthKeys.size;
      onMultiChange(next, isAllNow);
    }
  };

  const toggleYear = (yearGroup: MonthYearGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const yearMonthKeys = yearGroup.meses.map(m => m.key);
    const allYearSelected = yearMonthKeys.length > 0 && yearMonthKeys.every(k => selectedMeses.has(k) && !isAllMesesSelected);
    const next = new Set(selectedMeses);

    if (isAllMesesSelected) {
      // Deselecting whole year from all-selected state
      allMonthKeys.forEach(k => next.add(k));
      yearMonthKeys.forEach(k => next.delete(k));
      onMultiChange(next, false);
    } else if (allYearSelected) {
      yearMonthKeys.forEach(k => next.delete(k));
      onMultiChange(next, false);
    } else {
      yearMonthKeys.forEach(k => next.add(k));
      const isAllNow = next.size === allMonthKeys.size;
      onMultiChange(next, isAllNow);
    }
  };

  // Filter groups by search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase().trim();

    return groups
      .map(y => {
        const matchingMeses = y.meses.filter(
          m => m.label.toLowerCase().includes(q) || m.key.toLowerCase().includes(q) || y.year.includes(q)
        );
        if (matchingMeses.length > 0) {
          return {
            ...y,
            meses: matchingMeses
          };
        }
        return null;
      })
      .filter(Boolean) as MonthYearGroup[];
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
            Limpiar ({selectedMeses.size})
          </button>
        )}
      </label>

      {/* Trigger Button */}
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
          {hasActiveSelection && (
            <span className="bg-indigo-600 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
              {selectedMeses.size}
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-indigo-600' : ''
            }`}
          />
        </div>
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 min-w-[250px]">
          {/* Header & Quick Search */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/80 space-y-1.5">
            <div className="relative">
              <input
                ref={inputSearchRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar mes o año..."
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

            {/* Quick Actions (Select all / Clear) */}
            <div className="flex items-center justify-between px-1 text-[10px]">
              <span className="text-slate-400 font-bold uppercase tracking-wider">
                {isAllMesesSelected ? 'Todos seleccionados' : `${selectedMeses.size} de ${allMonthKeys.size} seleccionados`}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md transition-all cursor-pointer"
                >
                  ✓ Todo
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-all cursor-pointer"
                >
                  ✗ Limpiar
                </button>
              </div>
            </div>
          </div>

          {/* List Content */}
          <div className="max-h-72 overflow-y-auto p-1.5 space-y-1 text-xs">
            {/* Option "Todos los Meses" */}
            <button
              type="button"
              onClick={handleSelectAll}
              className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                isAllMesesSelected || selectedMeses.size === allMonthKeys.size
                  ? 'bg-indigo-50 text-indigo-900 border border-indigo-200 font-bold'
                  : 'text-slate-700 hover:bg-slate-50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                  isAllMesesSelected || selectedMeses.size === allMonthKeys.size
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-slate-300 bg-white'
                }`}>
                  {(isAllMesesSelected || selectedMeses.size === allMonthKeys.size) && (
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  )}
                </div>
                <span>{allOptionLabel}</span>
              </div>
            </button>

            {/* Groups by Year */}
            {filteredGroups.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400">
                No se encontraron meses coincidentes
              </div>
            ) : (
              filteredGroups.map(yearGroup => {
                const yearMonthKeys = yearGroup.meses.map(m => m.key);
                const allInYear = yearMonthKeys.length > 0 && yearMonthKeys.every(k => isAllMesesSelected || selectedMeses.has(k));
                const countInYear = yearGroup.meses.filter(m => isAllMesesSelected || selectedMeses.has(m.key)).length;

                return (
                  <div key={yearGroup.year} className="pt-1 space-y-0.5">
                    {/* Year Header */}
                    <div className="flex items-center justify-between px-2 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                      <span>Año {yearGroup.year}</span>
                      <button
                        type="button"
                        onClick={(e) => toggleYear(yearGroup, e)}
                        className="text-[9.5px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer lowercase"
                      >
                        {allInYear ? 'deseleccionar año' : 'seleccionar año'} ({countInYear}/{yearGroup.meses.length})
                      </button>
                    </div>

                    {/* Months in this Year */}
                    <div className="space-y-0.5 pt-0.5">
                      {yearGroup.meses.map(m => {
                        const isSelected = isAllMesesSelected || selectedMeses.has(m.key);
                        return (
                          <button
                            key={m.key}
                            type="button"
                            onClick={(e) => toggleMonth(m.key, e)}
                            className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-50/80 text-indigo-950 font-bold border border-indigo-200/60'
                                : 'text-slate-700 hover:bg-slate-100 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                                isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                              }`}>
                                {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </div>
                              <span className="truncate">{m.label}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              m.{m.monthNum}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer with Close Button */}
          <div className="p-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-600 font-medium">
              {isAllMesesSelected ? 'Todos activos' : `${selectedMeses.size} seleccionados`}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors cursor-pointer text-xs shadow-xs"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
