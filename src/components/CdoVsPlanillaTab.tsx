/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { ctTipoCfg, ctFmt, cleanDesc } from '../utils/helpers';

const normalizeStr = (str: string) => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

const matchSearch = (key: string, item: any, query: string, mode: 'contiene' | 'comienza' = 'contiene') => {
  if (!query) return true;
  
  const keyLower = normalizeStr(key);
  const descLower = normalizeStr(item.desc || '');
  const hLower = normalizeStr(item.h || '');
  const tipoLower = normalizeStr(item.tipo || '');

  if (mode === 'comienza') {
    const qClean = normalizeStr(query.trim());
    return keyLower.startsWith(qClean) || 
           descLower.startsWith(qClean) || 
           hLower.startsWith(qClean) ||
           tipoLower.startsWith(qClean);
  } else {
    const parts = query.split('+').map(p => normalizeStr(p.trim())).filter(p => p.length > 0);
    if (parts.length === 0) return true;
    
    return parts.every(part => {
      return keyLower.includes(part) || 
             descLower.includes(part) || 
             hLower.includes(part) ||
             tipoLower.includes(part);
    });
  }
};

interface CdoVsPlanillaTabProps {
  cdoVsS: {
    F?: Record<string, any>;
    H?: Record<string, any>;
    desalineados?: any[];
  };
}

export const CdoVsPlanillaTab: React.FC<CdoVsPlanillaTabProps> = ({ cdoVsS }) => {
  const [cvsExpanded, setCvsExpanded] = React.useState<Set<string>>(new Set());
  const [vista, setVista] = React.useState<'jerarquica' | 'plana' | 'tipo'>('jerarquica');
  const [mostrarDesalineados, setMostrarDesalineados] = React.useState<boolean>(false);
  const [alertsExpanded, setAlertsExpanded] = React.useState<Set<string>>(new Set());

  const expandirTodoAlerts = () => {
    if (!cdoVsS.desalineados) return;
    const allParents = new Set<string>();
    cdoVsS.desalineados.forEach((item: any) => {
      if (item.isParent && item.wbs) {
        allParents.add(item.wbs.toLowerCase());
      }
    });
    setAlertsExpanded(allParents);
  };

  const colapsarTodoAlerts = () => {
    setAlertsExpanded(new Set<string>());
  };

  const toggleAlert = (wbs: string) => {
    setAlertsExpanded(prev => {
      const next = new Set(prev);
      const wbsLower = wbs.toLowerCase();
      if (next.has(wbsLower)) {
        next.delete(wbsLower);
      } else {
        next.add(wbsLower);
      }
      return next;
    });
  };

  const isAlertItemVisible = (item: any) => {
    if (item.isLevel1) {
      return true;
    }
    if (item.isLevel2) {
      const parentKey = item.parentWbs ? item.parentWbs.toLowerCase() : '';
      return alertsExpanded.has(parentKey);
    }
    if (item.parentWbs) {
      const parentKey = item.parentWbs.toLowerCase();
      if (!alertsExpanded.has(parentKey)) return false;
      const grandParentKey = parentKey.split('::')[0];
      return grandParentKey ? alertsExpanded.has(grandParentKey) : true;
    }
    return true;
  };

  const [sortCol, setSortCol] = React.useState<string>('contrato');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const [filterTipo, setFilterTipo] = React.useState<string>('');
  const [filterTipoJer, setFilterTipoJer] = React.useState<string>('');
  const [filterTipoPlana, setFilterTipoPlana] = React.useState<string>('');
  const [open, setOpen] = React.useState<boolean>(false);
  const [page, setPage] = React.useState<number>(1);
  const itemsPerPage = 100;

  const [filterDiff, setFilterDiff] = React.useState<'all' | 'positive' | 'negative'>('all');
  const [tempSearchInputValue, setTempSearchInputValue] = React.useState<string>('');
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [tempSearchMode, setTempSearchMode] = React.useState<'contiene' | 'comienza'>('contiene');
  const [searchMode, setSearchMode] = React.useState<'contiene' | 'comienza'>('contiene');
  const [showMapeoInfo, setShowMapeoInfo] = React.useState<boolean>(false);

  const handleSearchTrigger = () => {
    setSearchQuery(tempSearchInputValue);
    setSearchMode(tempSearchMode);
  };

  const handleSearchClear = () => {
    setTempSearchInputValue('');
    setSearchQuery('');
  };

  const [activeCell, setActiveCell] = React.useState<{
    cod: string;
    colName: 'contrato' | 'plan' | 'ejec' | 'diff';
    val: number;
    tarifa: number;
    unidad: string;
    desc: string;
    rect: { left: number; top: number; width: number; height: number };
    plan: number;
    ejec: number;
    contrato: number;
    diff: number;
    isSticky?: boolean;
  } | null>(null);

  const handleCellHover = (
    e: React.MouseEvent,
    cod: string,
    colName: 'contrato' | 'plan' | 'ejec' | 'diff',
    val: number,
    tarifa: number,
    unidad: string,
    desc: string,
    dVals: { contrato: number; plan: number; ejec: number }
  ) => {
    const domRect = e.currentTarget.getBoundingClientRect();
    const rect = {
      left: domRect.left,
      top: domRect.top,
      width: domRect.width,
      height: domRect.height
    };
    const diff = dVals.ejec - dVals.plan;
    
    setActiveCell(prev => {
      if (prev?.isSticky) return prev;
      return {
        cod,
        colName,
        val,
        tarifa,
        unidad,
        desc,
        rect,
        plan: dVals.plan,
        ejec: dVals.ejec,
        contrato: dVals.contrato,
        diff,
        isSticky: false
      };
    });
  };

  const handleCellLeave = () => {
    setActiveCell(prev => {
      if (prev?.isSticky) return prev;
      return null;
    });
  };

  const handleCellClick = (
    e: React.MouseEvent,
    cod: string,
    colName: 'contrato' | 'plan' | 'ejec' | 'diff',
    val: number,
    tarifa: number,
    unidad: string,
    desc: string,
    dVals: { contrato: number; plan: number; ejec: number }
  ) => {
    e.stopPropagation(); // Avoid triggering row toggle expandable collapse
    
    const domRect = e.currentTarget.getBoundingClientRect();
    const rect = {
      left: domRect.left,
      top: domRect.top,
      width: domRect.width,
      height: domRect.height
    };
    const diff = dVals.ejec - dVals.plan;

    setActiveCell(prev => {
      const isThisAlreadySticky = prev?.isSticky && prev.cod === cod && prev.colName === colName;
      if (isThisAlreadySticky) {
        return null;
      }
      return {
        cod,
        colName,
        val,
        tarifa,
        unidad,
        desc,
        rect,
        plan: dVals.plan,
        ejec: dVals.ejec,
        contrato: dVals.contrato,
        diff,
        isSticky: true
      };
    });
  };

  React.useEffect(() => {
    setPage(1);
  }, [vista, filterTipo, filterTipoPlana, sortCol, sortDir, filterDiff, searchQuery]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveCell(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const data = vista === 'jerarquica' ? (cdoVsS.F || {}) : (cdoVsS.H || {});
  
  const toggleCvs = (cod: string) => {
    setCvsExpanded(p => {
      const n = new Set(p);
      if (n.has(cod)) n.delete(cod);
      else n.add(cod);
      return n;
    });
  };

  const dc = (diff: number) => {
    return Math.abs(diff) < 500 ? 'text-gray-400' : diff > 0 ? 'text-green-700' : 'text-red-600';
  };

  const onSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  const sortItems = (arr: string[]) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...arr].sort((a, b) => {
      const da = data[a] || {};
      const db = data[b] || {};
      if (sortCol === 'cod') return dir * a.localeCompare(b);
      if (sortCol === 'desc') return dir * (da.desc || '').localeCompare(db.desc || '');
      if (sortCol === 'plan') return dir * ((da.plan || 0) - (db.plan || 0));
      if (sortCol === 'ejec') return dir * ((da.ejec || 0) - (db.ejec || 0));
      if (sortCol === 'diff') return dir * (((da.ejec || 0) - (da.plan || 0)) - ((db.ejec || 0) - (db.plan || 0)));
      return dir * ((da.contrato || 0) - (db.contrato || 0));
    });
  };

  const SortTh: React.FC<{ col: string; children: React.ReactNode; right?: boolean }> = ({ col, children, right }) => (
    <th 
      id={`th-sort-${col}`}
      className={`px-3 py-2 cursor-pointer select-none hover:bg-gray-200 whitespace-nowrap font-semibold ${right ? 'text-right' : 'text-left'}`} 
      onClick={() => onSort(col)}
    >
      {children}
      {sortCol === col ? (
        <span className="ml-1 text-[9px]">{sortDir === 'desc' ? '▼' : '▲'}</span>
      ) : (
        <span className="ml-1 text-[9px] text-gray-300">⇅</span>
      )}
    </th>
  );

  // Pre-calculate leaves and hierarchical metadata for high performance
  const fLeaves = React.useMemo(() => {
    const F = cdoVsS.F || {};
    const keys = Object.keys(F);
    const parentSet = new Set<string>();
    keys.forEach(k => {
      const parts = k.split('.');
      if (parts.length > 1) {
        parentSet.add(parts.slice(0, -1).join('.'));
      }
    });
    return keys.filter(k => !parentSet.has(k));
  }, [cdoVsS.F]);

  const itemsHoja = React.useMemo(() => {
    const H = cdoVsS.H || {};
    const keys = Object.keys(H);
    const parentSet = new Set<string>();
    keys.forEach(k => {
      const parts = k.split('.');
      if (parts.length > 1) {
        parentSet.add(parts.slice(0, -1).join('.'));
      }
    });
    return keys.filter(k => !parentSet.has(k));
  }, [cdoVsS.H]);

  const parentKeysSet = React.useMemo(() => {
    const set = new Set<string>();
    const F = cdoVsS.F || {};
    Object.keys(F).forEach(k => {
      const parts = k.split('.');
      if (parts.length > 1) {
        set.add(parts.slice(0, -1).join('.'));
      }
    });
    return set;
  }, [cdoVsS.F]);

  // Pre-compiled searchMatchedKeys for rapid hierarchical mapping
  const searchMatchedKeys = React.useMemo(() => {
    const set = new Set<string>();
    if (!searchQuery) return set;
    const F = cdoVsS.F || {};
    const keys = Object.keys(F);
    
    // First, find direct matches
    const directSet = new Set<string>();
    keys.forEach(k => {
      if (matchSearch(k, F[k], searchQuery, searchMode)) {
        directSet.add(k);
      }
    });

    // Bubble down ancestor matched statuses and bubble up descendant matched statuses
    keys.forEach(k => {
      if (directSet.has(k)) {
        set.add(k);
        return;
      }
      const parts = k.split('.');
      for (let len = 1; len < parts.length; len++) {
        const ancestor = parts.slice(0, len).join('.');
        if (directSet.has(ancestor)) {
          set.add(k);
          return;
        }
      }
    });

    directSet.forEach(dk => {
      const parts = dk.split('.');
      for (let len = 1; len < parts.length; len++) {
        const ancestor = parts.slice(0, len).join('.');
        set.add(ancestor);
      }
    });

    return set;
  }, [cdoVsS.F, searchQuery, searchMode]);

  const totals = React.useMemo(() => {
    let positiveDiffTotal = 0;
    let negativeDiffTotal = 0;

    if (vista === 'jerarquica') {
      const F = cdoVsS.F || {};
      fLeaves.forEach(k => {
        const current = F[k] || {};
        const matchesTipo = !filterTipoJer || current.tipo === filterTipoJer;
        const matchesSearch = !searchQuery || searchMatchedKeys.has(k);

        if (matchesTipo && matchesSearch) {
          const diff = (current.ejec || 0) - (current.plan || 0);
          if (diff > 0) {
            positiveDiffTotal += diff;
          } else if (diff < 0) {
            negativeDiffTotal += diff;
          }
        }
      });
    } else {
      const H = cdoVsS.H || {};
      const targetFilterTipo = vista === 'plana' ? filterTipoPlana : filterTipo;
      itemsHoja.forEach(cod => {
        const current = H[cod] || {};
        const matchesTipo = !targetFilterTipo || current.tipo === targetFilterTipo;
        const matchesSearch = !searchQuery || matchSearch(cod, current, searchQuery, searchMode);

        if (matchesTipo && matchesSearch) {
          const diff = (current.ejec || 0) - (current.plan || 0);
          if (diff > 0) {
            positiveDiffTotal += diff;
          } else if (diff < 0) {
            negativeDiffTotal += diff;
          }
        }
      });
    }

    return { positiveDiffTotal, negativeDiffTotal };
  }, [cdoVsS.F, cdoVsS.H, fLeaves, itemsHoja, filterTipo, filterTipoJer, filterTipoPlana, vista, searchQuery, searchMode, searchMatchedKeys]);

  const buildTipoCards = (map: Record<string, any>) => {
    const all = Object.keys(map);
    const parentSet = new Set<string>();
    all.forEach(k => {
      const parts = k.split('.');
      if (parts.length > 1) {
        parentSet.add(parts.slice(0, -1).join('.'));
      }
    });
    const hojas = all.filter(c => !parentSet.has(c));
    const g: Record<string, any> = {};

    hojas.forEach(cod => {
      const d = map[cod];
      if (!d) return;
      const t = d.tipo || '';
      if (!g[t]) {
        g[t] = { tipo: t, items: 0, plan: 0, ejec: 0, contrato: 0, diffPos: 0, diffNeg: 0 };
      }
      const diff = d.ejec - d.plan;
      g[t].items++;
      g[t].plan += d.plan;
      g[t].ejec += d.ejec;
      g[t].contrato += d.contrato;
      if (diff >= 0) g[t].diffPos += diff;
      else g[t].diffNeg += diff;
    });

    return Object.values(g).sort((a: any, b: any) => b.contrato - a.contrato);
  };

  const tipoCardJer = React.useMemo(() => buildTipoCards(cdoVsS.F || {}), [cdoVsS]);
  const tipoCardPlana = React.useMemo(() => buildTipoCards(cdoVsS.H || {}), [cdoVsS]);

  const porTipo = React.useMemo(() => {
    const H = cdoVsS.H || {};
    const g: Record<string, any> = {};

    itemsHoja.forEach(cod => {
      const d = H[cod];
      if (!d) return;
      const t = d.tipo || 'Sin tipo';
      if (!g[t]) {
        g[t] = { tipo: t, items: [] as string[], plan: 0, ejec: 0, contrato: 0, diffPos: 0, diffNeg: 0 };
      }
      const diff = d.ejec - d.plan;
      g[t].items.push(cod);
      g[t].plan += d.plan;
      g[t].ejec += d.ejec;
      g[t].contrato += d.contrato;
      if (diff >= 0) g[t].diffPos += diff;
      else g[t].diffNeg += diff;
    });

    const vals = Object.values(g);
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortCol === 'plan') vals.sort((a: any, b: any) => dir * (a.plan - b.plan));
    else if (sortCol === 'ejec') vals.sort((a: any, b: any) => dir * (a.ejec - b.ejec));
    else if (sortCol === 'diff') vals.sort((a: any, b: any) => dir * ((a.ejec - a.plan) - (b.ejec - b.plan)));
    else vals.sort((a: any, b: any) => dir * (a.contrato - b.contrato));
    return vals;
  }, [itemsHoja, cdoVsS, sortCol, sortDir]);

  const rootCods = Object.keys(cdoVsS.F || {}).filter(k => k.split('.').length === 1).sort((a, b) => {
    const nA = Number(a);
    const nB = Number(b);
    if (isNaN(nA) || isNaN(nB)) {
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    }
    return nA - nB;
  });

  // Pre-compiled childrenMap for immediate child lookups in constant O(1) time
  const childrenMap = React.useMemo(() => {
    const map: Record<string, string[]> = {};
    const F = cdoVsS.F || {};
    const keys = Object.keys(F);
    keys.forEach(k => {
      const parts = k.split('.');
      if (parts.length > 1) {
        const parent = parts.slice(0, -1).join('.');
        if (!map[parent]) map[parent] = [];
        map[parent].push(k);
      }
    });

    // Sort each parent's children numerically by WBS code parts
    Object.keys(map).forEach(parent => {
      map[parent].sort((a, b) => {
        const pa = a.split('.');
        const pb = b.split('.');
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
          const sA = pa[i] || '';
          const sB = pb[i] || '';
          const nA = Number(sA);
          const nB = Number(sB);
          
          if (isNaN(nA) || isNaN(nB)) {
            const cmp = sA.localeCompare(sB, undefined, { numeric: true, sensitivity: 'base' });
            if (cmp !== 0) return cmp;
          } else {
            const dv = nA - nB;
            if (dv !== 0) return dv;
          }
        }
        return 0;
      });
    });
    return map;
  }, [cdoVsS.F]);

  // Pre-compiled leafCountsMap for immediate count of leaves under any subpartida
  const leafCountsMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    const F = cdoVsS.F || {};
    const keys = Object.keys(F);
    
    // Determine terminal leaf keys in the WBS tree (keys with no children)
    const parentSet = new Set<string>();
    keys.forEach(k => {
      const parts = k.split('.');
      if (parts.length > 1) {
        parentSet.add(parts.slice(0, -1).join('.'));
      }
    });

    const terminalKeys = keys.filter(k => !parentSet.has(k));

    keys.forEach(cod => {
      // Any terminal key that equals cod, or is a descendant of cod, is counted
      const count = terminalKeys.filter(tk => tk === cod || tk.startsWith(cod + '.')).length;
      map[cod] = count;
    });

    return map;
  }, [cdoVsS.F]);

  // Pre-computed dValsMap and matchesFilter map using bottom-up cache structure
  const dValsMapResult = React.useMemo(() => {
    const F = cdoVsS.F || {};
    const keys = Object.keys(F);
    
    // Step 1: build children map for F
    const fParents = new Set<string>();
    const fChildren: Record<string, string[]> = {};
    keys.forEach(k => {
      const parts = k.split('.');
      if (parts.length > 1) {
        const parent = parts.slice(0, -1).join('.');
        fParents.add(parent);
        if (!fChildren[parent]) fChildren[parent] = [];
        fChildren[parent].push(k);
      }
    });

    const isLeaf = (k: string) => !fParents.has(k);

    const memo: Record<string, { plan: number; ejec: number; contrato: number; tarifa?: number; unidad?: string }> = {};
    const matchesFilter = new Set<string>();

    function getValues(k: string): { plan: number; ejec: number; contrato: number; tarifa?: number; unidad?: string } {
      if (memo[k]) return memo[k];
      const current = F[k] || {};
      
      if (isLeaf(k)) {
        const matchesTipo = !filterTipoJer || current.tipo === filterTipoJer;
        let matchesDiff = true;
        const diff = (current.ejec || 0) - (current.plan || 0);
        if (filterDiff === 'positive' && diff <= 0) {
          matchesDiff = false;
        }
        if (filterDiff === 'negative' && diff >= 0) {
          matchesDiff = false;
        }

        const matchesSearch = !searchQuery || searchMatchedKeys.has(k);

        const isMatched = matchesTipo && matchesDiff && matchesSearch;
        if (isMatched) {
          matchesFilter.add(k);
          memo[k] = {
            plan: current.plan || 0,
            ejec: current.ejec || 0,
            contrato: current.contrato || 0,
            tarifa: current.tarifa,
            unidad: current.unidad
          };
        } else {
          memo[k] = { plan: 0, ejec: 0, contrato: 0 };
        }
        return memo[k];
      }

      // It is a parent, sum the values of its children
      const children = fChildren[k] || [];
      const sum = { plan: 0, ejec: 0, contrato: 0 };
      let anyChildMatches = false;
      children.forEach(child => {
        const childVal = getValues(child);
        if (matchesFilter.has(child)) {
          anyChildMatches = true;
        }
        sum.plan += childVal.plan;
        sum.ejec += childVal.ejec;
        sum.contrato += childVal.contrato;
      });
      
      if (anyChildMatches) {
        matchesFilter.add(k);
      }
      
      memo[k] = sum;
      return sum;
    }

    // Initialize all keys
    keys.forEach(k => {
      getValues(k);
    });

    return { memo, matchesFilter };
  }, [cdoVsS.F, filterTipoJer, filterDiff, searchQuery, searchMode, searchMatchedKeys]);

  const sortedRootCods = React.useMemo(() => {
    const list = Object.keys(cdoVsS.F || {}).filter(k => k.split('.').length === 1);
    return [...list].sort((a, b) => {
      const nA = Number(a);
      const nB = Number(b);
      if (isNaN(nA) || isNaN(nB)) {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
      }
      return nA - nB;
    });
  }, [cdoVsS.F]);

  const sortedPlanaList = React.useMemo(() => {
    const H = cdoVsS.H || {};
    let filtered = filterTipoPlana ? itemsHoja.filter(cod => H[cod]?.tipo === filterTipoPlana) : itemsHoja;
    
    if (searchQuery) {
      filtered = filtered.filter(cod => matchSearch(cod, H[cod] || {}, searchQuery, searchMode));
    }

    if (filterDiff === 'positive') {
      filtered = filtered.filter(cod => {
        const item = H[cod] || {};
        return (item.ejec || 0) - (item.plan || 0) > 0;
      });
    }
    if (filterDiff === 'negative') {
      filtered = filtered.filter(cod => {
        const item = H[cod] || {};
        return (item.ejec || 0) - (item.plan || 0) < 0;
      });
    }

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const da = H[a] || {};
      const db = H[b] || {};
      if (sortCol === 'cod') return dir * a.localeCompare(b);
      if (sortCol === 'desc') return dir * (da.desc || '').localeCompare(db.desc || '');
      if (sortCol === 'plan') return dir * ((da.plan || 0) - (db.plan || 0));
      if (sortCol === 'ejec') return dir * ((da.ejec || 0) - (db.ejec || 0));
      if (sortCol === 'diff') return dir * (((da.ejec || 0) - (da.plan || 0)) - ((db.ejec || 0) - (db.plan || 0)));
      return dir * ((da.contrato || 0) - (db.contrato || 0));
    });
  }, [itemsHoja, filterTipoPlana, cdoVsS.H, sortCol, sortDir, filterDiff, searchQuery, searchMode]);

  const paginatedPlanaList = React.useMemo(() => {
    const endIndex = page * itemsPerPage;
    return sortedPlanaList.slice(0, endIndex);
  }, [sortedPlanaList, page]);

  const sortedTipoList = React.useMemo(() => {
    const H = cdoVsS.H || {};
    let targetGroup = filterTipo ? (porTipo.find((g: any) => g.tipo === filterTipo)?.items || []) : itemsHoja;

    if (searchQuery) {
      targetGroup = targetGroup.filter(cod => matchSearch(cod, H[cod] || {}, searchQuery, searchMode));
    }

    if (filterDiff === 'positive') {
      targetGroup = targetGroup.filter(cod => {
        const item = H[cod] || {};
        return (item.ejec || 0) - (item.plan || 0) > 0;
      });
    }
    if (filterDiff === 'negative') {
      targetGroup = targetGroup.filter(cod => {
        const item = H[cod] || {};
        return (item.ejec || 0) - (item.plan || 0) < 0;
      });
    }

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...targetGroup].sort((a, b) => {
      const da = H[a] || {};
      const db = H[b] || {};
      if (sortCol === 'cod') return dir * a.localeCompare(b);
      if (sortCol === 'desc') return dir * (da.desc || '').localeCompare(db.desc || '');
      if (sortCol === 'plan') return dir * ((da.plan || 0) - (db.plan || 0));
      if (sortCol === 'ejec') return dir * ((da.ejec || 0) - (db.ejec || 0));
      if (sortCol === 'diff') return dir * (((da.ejec || 0) - (da.plan || 0)) - ((db.ejec || 0) - (db.plan || 0)));
      return dir * ((da.contrato || 0) - (db.contrato || 0));
    });
  }, [itemsHoja, filterTipo, porTipo, cdoVsS.H, sortCol, sortDir, filterDiff, searchQuery, searchMode]);

  const paginatedTipoList = React.useMemo(() => {
    const endIndex = page * itemsPerPage;
    return sortedTipoList.slice(0, endIndex);
  }, [sortedTipoList, page]);

  const TotRow: React.FC<{ ch?: boolean }> = ({ ch }) => {
    let totP = 0, totE = 0, totC = 0;

    if (vista === 'jerarquica') {
      const F = cdoVsS.F || {};
      fLeaves.forEach(k => {
        const current = F[k] || {};
        const matchesTipo = !filterTipoJer || current.tipo === filterTipoJer;
        let matchesDiff = true;
        const diff = (current.ejec || 0) - (current.plan || 0);
        if (filterDiff === 'positive' && diff <= 0) matchesDiff = false;
        if (filterDiff === 'negative' && diff >= 0) matchesDiff = false;
        
        const matchesSearch = !searchQuery || searchMatchedKeys.has(k);

        if (matchesTipo && matchesDiff && matchesSearch) {
          totP += current.plan || 0;
          totE += current.ejec || 0;
          totC += current.contrato || 0;
        }
      });
    } else if (vista === 'plana') {
      const H = cdoVsS.H || {};
      itemsHoja.forEach(cod => {
        const current = H[cod] || {};
        const matchesTipo = !filterTipoPlana || current.tipo === filterTipoPlana;
        let matchesDiff = true;
        const diff = (current.ejec || 0) - (current.plan || 0);
        if (filterDiff === 'positive' && diff <= 0) matchesDiff = false;
        if (filterDiff === 'negative' && diff >= 0) matchesDiff = false;
        
        const matchesSearch = !searchQuery || matchSearch(cod, current, searchQuery, searchMode);

        if (matchesTipo && matchesDiff && matchesSearch) {
          totP += current.plan || 0;
          totE += current.ejec || 0;
          totC += current.contrato || 0;
        }
      });
    } else {
      // vista === 'tipo'
      const H = cdoVsS.H || {};
      const targetGroup = filterTipo ? (porTipo.find((g: any) => g.tipo === filterTipo)?.items || []) : itemsHoja;
      targetGroup.forEach(cod => {
        const current = H[cod] || {};
        let matchesDiff = true;
        const diff = (current.ejec || 0) - (current.plan || 0);
        if (filterDiff === 'positive' && diff <= 0) matchesDiff = false;
        if (filterDiff === 'negative' && diff >= 0) matchesDiff = false;
        
        const matchesSearch = !searchQuery || matchSearch(cod, current, searchQuery);

        if (matchesDiff && matchesSearch) {
          totP += current.plan || 0;
          totE += current.ejec || 0;
          totC += current.contrato || 0;
        }
      });
    }

    const diff = totE - totP;
    return (
      <tr className="border-t-2 border-blue-400 bg-blue-50 font-bold text-xs">
        {ch && <td></td>}
        <td className="px-2 py-2 text-blue-900" colSpan={2}>
          {filterTipoJer && vista === 'jerarquica' ? filterTipoJer.replace(/^\d+\./, '').trim() : filterTipoPlana && vista === 'plana' ? filterTipoPlana.replace(/^\d+\./, '').trim() : filterTipo && vista === 'tipo' ? filterTipo.replace(/^\d+\./, '').trim() : 'TOTAL'}
        </td>
        <td className="px-3 py-2 text-right">{ctFmt(totC)}</td>
        <td className="px-3 py-2 text-right text-green-700">{ctFmt(totP)}</td>
        <td className="px-3 py-2 text-right text-blue-700">{ctFmt(totE)}</td>
        <td className={`px-3 py-2 text-right ${dc(diff)}`}>{diff >= 0 ? '+' : ''}{ctFmt(diff)}</td>
      </tr>
    );
  };

  const Thead: React.FC<{ ch?: boolean }> = ({ ch }) => (
    <tr className="bg-gray-100 text-gray-600 text-xs">
      {ch && <th className="w-5"></th>}
      <SortTh col="cod">Código</SortTh>
      <SortTh col="desc">Descripción</SortTh>
      <SortTh col="contrato" right>Contrato</SortTh>
      <SortTh col="plan" right>Planillado (S)</SortTh>
      <SortTh col="ejec" right>Ejec. CDO (AV)</SortTh>
      <SortTh col="diff" right>Diferencia</SortTh>
    </tr>
  );

  const DataRow: React.FC<{ cod: string; depth?: number; ch?: boolean }> = ({ cod, depth = 0, ch }) => {
    const d = data[cod];
    if (!d) return null;
    const nivel = cod.split('.').length;

    if ((filterTipoJer || filterDiff !== 'all' || searchQuery) && vista === 'jerarquica') {
      if (!dValsMapResult.matchesFilter.has(cod)) return null;
    }

    const dVals = ((filterTipoJer || filterDiff !== 'all' || searchQuery) && vista === 'jerarquica')
      ? (dValsMapResult.memo[cod] || { plan: 0, ejec: 0, contrato: 0 })
      : d;

    const rTarifa = dVals.tarifa !== undefined ? dVals.tarifa : d.tarifa;
    const rUnidad = dVals.unidad !== undefined ? dVals.unidad : d.unidad;

    const hijosF = childrenMap[cod] || [];

    const hijosPorH: Record<string, any> = {};
    hijosF.forEach(hcod => {
      if ((filterTipoJer || filterDiff !== 'all' || searchQuery) && vista === 'jerarquica') {
        if (!dValsMapResult.matchesFilter.has(hcod)) return;
      }
      const hd = data[hcod];
      if (!hd) return;
      const val = ((filterTipoJer || filterDiff !== 'all' || searchQuery) && vista === 'jerarquica')
        ? (dValsMapResult.memo[hcod] || { plan: 0, ejec: 0, contrato: 0 })
        : hd;

      const tieneHijosF = !!(childrenMap[hcod] && childrenMap[hcod].length > 0);
      const hKey = tieneHijosF ? hcod : (hd.h || hcod);
      if (!hijosPorH[hKey]) {
        hijosPorH[hKey] = { 
          cods: [], 
          plan: 0, 
          ejec: 0, 
          contrato: 0, 
          desc: hd.desc, 
          tipo: hd.tipo, 
          h: hKey, 
          tieneHijosF,
          tarifa: val.tarifa !== undefined ? val.tarifa : hd.tarifa,
          unidad: val.unidad !== undefined ? val.unidad : hd.unidad
        };
      }
      hijosPorH[hKey].plan += val.plan || 0;
      hijosPorH[hKey].ejec += val.ejec || 0;
      hijosPorH[hKey].contrato += val.contrato || 0;
      hijosPorH[hKey].cods.push(hcod);
    });

    const hijosAgrupados = Object.values(hijosPorH);
    const dir = sortDir === 'asc' ? 1 : -1;
    hijosAgrupados.sort((a: any, b: any) => {
      const isFolderA = a.tieneHijosF;
      const isFolderB = b.tieneHijosF;

      if (isFolderA || isFolderB) {
        const pa = a.h.split('.').map(Number);
        const pb = b.h.split('.').map(Number);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
          const dv = (pa[i] || 0) - (pb[i] || 0);
          if (dv !== 0) return dv; // Folders stay in numerical order
        }
        return 0;
      }

      if (sortCol === 'cod') {
        const pa = a.h.split('.').map(Number);
        const pb = b.h.split('.').map(Number);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
          const dv = (pa[i] || 0) - (pb[i] || 0);
          if (dv !== 0) return dir * dv;
        }
        return 0;
      }
      if (sortCol === 'desc') {
        return dir * (a.desc || '').localeCompare(b.desc || '');
      }
      if (sortCol === 'plan') {
        return dir * ((a.plan || 0) - (b.plan || 0));
      }
      if (sortCol === 'ejec') {
        return dir * ((a.ejec || 0) - (b.ejec || 0));
      }
      if (sortCol === 'diff') {
        const diffA = (a.ejec || 0) - (a.plan || 0);
        const diffB = (b.ejec || 0) - (b.plan || 0);
        return dir * (diffA - diffB);
      }
      return dir * ((a.contrato || 0) - (b.contrato || 0));
    });

    let tieneHijos = hijosAgrupados.length > 0;
    if (tieneHijos && hijosAgrupados.length === 1) {
      const g = hijosAgrupados[0];
      if (!g.tieneHijosF) {
        const parentCodVisible = d.h || cod;
        const parentDescClean = cleanDesc(d.desc);
        const childDescClean = cleanDesc(g.desc);
        if (g.h === parentCodVisible || g.h === cod || childDescClean === parentDescClean) {
          tieneHijos = false;
        }
      }
    }
    const isExp = searchQuery ? true : cvsExpanded.has(cod);
    const codVisible = d.h || cod;
    const diff = dVals.ejec - dVals.plan;
    const isLeafRow = !ch || !tieneHijos;
    let rowBg = 'bg-white font-normal';
    let textClass = 'text-gray-700';
    if (!isLeafRow) {
      if (nivel === 1) {
        rowBg = 'bg-blue-50/85 border-l-4 border-l-blue-600';
        textClass = 'text-blue-950 font-extrabold';
      } else if (nivel === 2) {
        rowBg = 'bg-emerald-50/75 border-l-2 border-l-emerald-500';
        textClass = 'text-emerald-900 font-bold';
      } else if (nivel === 3) {
        rowBg = 'bg-purple-50/75 border-l-2 border-l-purple-500';
        textClass = 'text-purple-900 font-bold';
      } else if (nivel === 4) {
        rowBg = 'bg-amber-50/75 border-l-2 border-l-amber-500';
        textClass = 'text-amber-900 font-semibold';
      } else if (nivel === 5) {
        rowBg = 'bg-rose-50/75 border-l-2 border-l-rose-450';
        textClass = 'text-rose-900 font-semibold';
      } else {
        rowBg = 'bg-slate-100/70 border-l-2 border-l-slate-400';
        textClass = 'text-slate-800 font-medium';
      }
    }

    return (
      <React.Fragment>
        <tr className={`border-t hover:bg-amber-50/60 ${ch && tieneHijos ? 'cursor-pointer' : ''} ${rowBg}`} onClick={() => ch && tieneHijos && toggleCvs(cod)}>
          {ch && (
            <td className="w-5 text-gray-400" style={{ paddingLeft: 4 + depth * 14 }}>
              {tieneHijos && (isExp ? <ChevronDown className="w-3.5 h-3.5 inline" /> : <ChevronRight className="w-3.5 h-3.5 inline" />)}
            </td>
          )}
          <td className="px-2 py-1.5 font-mono text-[10px] text-gray-400 whitespace-nowrap">{codVisible}</td>
          <td className={`px-3 py-1.5 truncate max-w-xs ${textClass}`} title={d.desc}>
            <div className="flex items-center gap-1.5 inline-flex max-w-full">
              <span className="truncate">{cleanDesc(d.desc)}</span>
              {tieneHijos && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-bold leading-none text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full shrink-0" title={`${leafCountsMap[cod] || 0} items`}>
                  {leafCountsMap[cod] || 0}
                </span>
              )}
            </div>
          </td>
          <td 
            className={`px-3 py-1.5 text-right transition-all duration-150 font-mono text-[12.5px] ${
              rTarifa > 0 
                ? 'cursor-help relative hover:bg-slate-100' 
                : ''
            } ${
              activeCell?.isSticky && activeCell.cod === cod && activeCell.colName === 'contrato'
                ? 'bg-amber-100 ring-2 ring-amber-500/85 ring-inset font-bold text-amber-950 z-10' 
                : ''
            }`}
            onMouseEnter={rTarifa > 0 ? (e) => handleCellHover(e, cod, 'contrato', dVals.contrato, rTarifa, rUnidad || 'u', d.desc, dVals) : undefined}
            onMouseLeave={rTarifa > 0 ? handleCellLeave : undefined}
            onClick={rTarifa > 0 ? (e) => handleCellClick(e, cod, 'contrato', dVals.contrato, rTarifa, rUnidad || 'u', d.desc, dVals) : undefined}
          >
            {ctFmt(dVals.contrato)}
          </td>
          <td 
            className={`px-3 py-1.5 text-right text-green-700 transition-all duration-150 font-mono text-[12.5px] ${
              rTarifa > 0 
                ? 'cursor-help relative hover:bg-green-50' 
                : ''
            } ${
              activeCell?.isSticky && activeCell.cod === cod && activeCell.colName === 'plan'
                ? 'bg-green-100 ring-2 ring-green-600/85 ring-inset font-bold text-green-950 z-10' 
                : ''
            }`}
            onMouseEnter={rTarifa > 0 ? (e) => handleCellHover(e, cod, 'plan', dVals.plan, rTarifa, rUnidad || 'u', d.desc, dVals) : undefined}
            onMouseLeave={rTarifa > 0 ? handleCellLeave : undefined}
            onClick={rTarifa > 0 ? (e) => handleCellClick(e, cod, 'plan', dVals.plan, rTarifa, rUnidad || 'u', d.desc, dVals) : undefined}
          >
            {ctFmt(dVals.plan)}
          </td>
          <td 
            className={`px-3 py-1.5 text-right text-blue-700 transition-all duration-150 font-mono text-[12.5px] ${
              rTarifa > 0 
                ? 'cursor-help relative hover:bg-blue-50' 
                : ''
            } ${
              activeCell?.isSticky && activeCell.cod === cod && activeCell.colName === 'ejec'
                ? 'bg-blue-100 ring-2 ring-blue-600/85 ring-inset font-bold text-blue-950 z-10' 
                : ''
            }`}
            onMouseEnter={rTarifa > 0 ? (e) => handleCellHover(e, cod, 'ejec', dVals.ejec, rTarifa, rUnidad || 'u', d.desc, dVals) : undefined}
            onMouseLeave={rTarifa > 0 ? handleCellLeave : undefined}
            onClick={rTarifa > 0 ? (e) => handleCellClick(e, cod, 'ejec', dVals.ejec, rTarifa, rUnidad || 'u', d.desc, dVals) : undefined}
          >
            {ctFmt(dVals.ejec)}
          </td>
          <td 
            className={`px-3 py-1.5 text-right font-semibold ${dc(diff)} transition-all duration-150 font-mono text-[12.5px] ${
              rTarifa > 0 
                ? 'cursor-help relative hover:bg-amber-100/10' 
                : ''
            } ${
              activeCell?.isSticky && activeCell.cod === cod && activeCell.colName === 'diff'
                ? 'bg-amber-100 ring-2 ring-amber-500 ring-inset font-bold text-amber-950 z-10' 
                : ''
            }`}
            onMouseEnter={rTarifa > 0 ? (e) => handleCellHover(e, cod, 'diff', diff, rTarifa, rUnidad || 'u', d.desc, dVals) : undefined}
            onMouseLeave={rTarifa > 0 ? handleCellLeave : undefined}
            onClick={rTarifa > 0 ? (e) => handleCellClick(e, cod, 'diff', diff, rTarifa, rUnidad || 'u', d.desc, dVals) : undefined}
          >
            {diff >= 0 ? '+' : ''}{ctFmt(diff)}
          </td>
        </tr>
        {ch && isExp && hijosAgrupados.map((g: any) => {
          if (g.tieneHijosF || g.cods.length === 1) {
            return <DataRow key={g.cods[0]} cod={g.cods[0]} depth={depth + 1} ch />;
          }
          const diff2 = g.ejec - g.plan;
          const rTarifaG = g.tarifa;
          const rUnidadG = g.unidad;
          return (
            <tr key={g.h} className="border-t hover:bg-amber-50 bg-white">
              <td className="w-5" style={{ paddingLeft: 4 + (depth + 1) * 14 }}></td>
              <td className="px-2 py-1.5 font-mono text-[10px] text-gray-400 whitespace-nowrap">{g.h}</td>
              <td className="px-3 py-1.5 text-gray-700 truncate max-w-xs" title={g.desc}>{cleanDesc(g.desc)}</td>
              <td 
                className={`px-3 py-1.5 text-right transition-all duration-150 font-mono text-[12.5px] ${
                  rTarifaG > 0 
                    ? 'cursor-help relative hover:bg-slate-100' 
                    : ''
                } ${
                  activeCell?.isSticky && activeCell?.cod === g.h && activeCell?.colName === 'contrato'
                    ? 'bg-amber-100 ring-2 ring-amber-500/85 ring-inset font-bold text-amber-955 z-10' 
                    : ''
                }`}
                onMouseEnter={rTarifaG > 0 ? (e) => handleCellHover(e, g.h, 'contrato', g.contrato, rTarifaG, rUnidadG || 'u', g.desc, g) : undefined}
                onMouseLeave={rTarifaG > 0 ? handleCellLeave : undefined}
                onClick={rTarifaG > 0 ? (e) => handleCellClick(e, g.h, 'contrato', g.contrato, rTarifaG, rUnidadG || 'u', g.desc, g) : undefined}
              >
                {ctFmt(g.contrato)}
              </td>
              <td 
                className={`px-3 py-1.5 text-right text-green-700 transition-all duration-150 font-mono text-[12.5px] ${
                  rTarifaG > 0 
                    ? 'cursor-help relative hover:bg-green-50' 
                    : ''
                } ${
                  activeCell?.isSticky && activeCell?.cod === g.h && activeCell?.colName === 'plan'
                    ? 'bg-green-100 ring-2 ring-green-600/85 ring-inset font-bold text-green-955 z-10' 
                    : ''
                }`}
                onMouseEnter={rTarifaG > 0 ? (e) => handleCellHover(e, g.h, 'plan', g.plan, rTarifaG, rUnidadG || 'u', g.desc, g) : undefined}
                onMouseLeave={rTarifaG > 0 ? handleCellLeave : undefined}
                onClick={rTarifaG > 0 ? (e) => handleCellClick(e, g.h, 'plan', g.plan, rTarifaG, rUnidadG || 'u', g.desc, g) : undefined}
              >
                {ctFmt(g.plan)}
              </td>
              <td 
                className={`px-3 py-1.5 text-right text-blue-700 transition-all duration-150 font-mono text-[12.5px] ${
                  rTarifaG > 0 
                    ? 'cursor-help relative hover:bg-blue-50' 
                    : ''
                } ${
                  activeCell?.isSticky && activeCell?.cod === g.h && activeCell?.colName === 'ejec'
                    ? 'bg-blue-100 ring-2 ring-blue-605/85 ring-inset font-bold text-blue-955 z-10' 
                    : ''
                }`}
                onMouseEnter={rTarifaG > 0 ? (e) => handleCellHover(e, g.h, 'ejec', g.ejec, rTarifaG, rUnidadG || 'u', g.desc, g) : undefined}
                onMouseLeave={rTarifaG > 0 ? handleCellLeave : undefined}
                onClick={rTarifaG > 0 ? (e) => handleCellClick(e, g.h, 'ejec', g.ejec, rTarifaG, rUnidadG || 'u', g.desc, g) : undefined}
              >
                {ctFmt(g.ejec)}
              </td>
              <td 
                className={`px-3 py-1.5 text-right font-semibold ${dc(diff2)} transition-all duration-150 font-mono text-[12.5px] ${
                  rTarifaG > 0 
                    ? 'cursor-help relative hover:bg-amber-100/10' 
                    : ''
                } ${
                  activeCell?.isSticky && activeCell?.cod === g.h && activeCell?.colName === 'diff'
                    ? 'bg-amber-100 ring-2 ring-amber-500 ring-inset font-bold text-amber-955 z-10' 
                    : ''
                }`}
                onMouseEnter={rTarifaG > 0 ? (e) => handleCellHover(e, g.h, 'diff', diff2, rTarifaG, rUnidadG || 'u', g.desc, g) : undefined}
                onMouseLeave={rTarifaG > 0 ? handleCellLeave : undefined}
                onClick={rTarifaG > 0 ? (e) => handleCellClick(e, g.h, 'diff', diff2, rTarifaG, rUnidadG || 'u', g.desc, g) : undefined}
              >
                {diff2 >= 0 ? '+' : ''}{ctFmt(diff2)}
              </td>
            </tr>
          );
        })}
      </React.Fragment>
    );
  };

  const TarjetasTipo: React.FC<{ cards: any[]; filterActive: string; setFilter: (s: string) => void }> = ({ cards, filterActive, setFilter }) => (
    <div className="grid grid-cols-7 gap-1.5 mb-3">
      {cards.map(g => {
        const lbl = g.tipo.replace(/^\d+\./, '').trim() || 'Sin match';
        const isActive = filterActive === g.tipo;
        const cfg = ctTipoCfg(g.tipo);
        return (
          <div 
            key={g.tipo || 'none'} 
            id={`card-${g.tipo || 'none'}`}
            className={`border-2 rounded-lg p-2 cursor-pointer transition-all ${cfg.bg} ${cfg.border} ${isActive ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`} 
            onClick={() => setFilter(filterActive === g.tipo ? '' : g.tipo)}
          >
            <div className="flex justify-between items-start gap-0.5">
              <span className={`text-[9px] font-bold ${cfg.text} leading-tight truncate`}>{lbl}</span>
              <span className={`text-[9px] ${cfg.text} opacity-60 flex-shrink-0`}>{g.items}</span>
            </div>
            <div className={`text-xs font-bold ${cfg.text} mt-0.5`}>{(g.plan / 1e6).toFixed(2)}M</div>
            <div className="flex gap-1 mt-0.5 flex-wrap">
              {g.diffPos > 0 && <span className="text-[8px] font-semibold text-green-600">+{(g.diffPos / 1e6).toFixed(2)}M</span>}
              {g.diffNeg < 0 && <span className="text-[8px] font-semibold text-red-500">{(g.diffNeg / 1e6).toFixed(2)}M</span>}
            </div>
            <div className="w-full h-1 bg-white/60 rounded-full mt-1 overflow-hidden">
              <div className={cfg.bar} style={{ width: `${Math.min(g.contrato > 0 ? (g.plan / g.contrato) * 100 : 0, 100)}%`, height: '100%' }} />
            </div>
            <div className={`text-[8px] ${cfg.text} opacity-70`}>{g.contrato > 0 ? ((g.plan / g.contrato) * 100).toFixed(1) : 0}%</div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div id="cdo-vs-planilla-container" className="ht-card bg-white rounded-xl shadow-sm border border-indigo-600">
      <div 
        id="cdo-vs-planilla-header"
        className="ht-head flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-gray-50 rounded-xl" 
        onClick={() => setOpen(o => !o)}
      >
        <h2 className="text-base font-bold text-gray-800 flex items-center gap-3 flex-wrap">
          <span className="ht-title">Comparación CDO vs Planilla</span>
          <span className="ht-sub hidden lg:inline">AV ejecutado CDO vs Acumulado planillado Sabana</span>
          
          <div className="flex gap-2 text-xs">
            <span className="bg-green-50 border border-green-200 text-green-700 px-2 py-0.5 rounded font-bold flex items-center gap-1" title="Diferencia Positiva Total">
              Diff (+): <span className="text-green-850">{ctFmt(totals.positiveDiffTotal)}</span>
            </span>
            <span className="bg-red-50 border border-red-200 text-red-600 px-2 py-0.5 rounded font-bold flex items-center gap-1" title="Diferencia Negativa Total">
              Diff (−): <span className="text-red-750">{ctFmt(totals.negativeDiffTotal)}</span>
            </span>
            <button
              type="button"
              id="btn-toggle-mapeo-info"
              onClick={(e) => {
                e.stopPropagation();
                setShowMapeoInfo(prev => !prev);
              }}
              className="w-5.5 h-5.5 flex items-center justify-center rounded-md bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-[11px] text-slate-500 hover:text-indigo-600 transition-all cursor-pointer font-bold"
              title="Información del mapeo"
            >
              ℹ️
            </button>
          </div>
        </h2>
        <button 
          id="btn-toggle-cdo-vs-planilla"
          className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600 transition-colors text-lg font-bold leading-none"
        >
          {open ? '−' : '+'}
        </button>
      </div>

      {open && (
        <div className="px-5 pb-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-[11px] font-medium shadow-sm">
              {(['jerarquica', 'plana'] as const).map(v => (
                <button 
                  key={v} 
                  id={`btn-view-${v}`}
                  onClick={() => setVista(v)} 
                  className={`px-3 py-1.5 transition-colors cursor-pointer ${vista === v ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  {v === 'jerarquica' ? '🌲 Jerárquica' : '📋 Plana'}
                </button>
              ))}
            </div>
          </div>
          
          {/* Mapped codes status info card */}
          {showMapeoInfo && (
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-lg p-3.5 mb-4 shadow-sm flex items-start gap-3">
              <span className="text-xl">✨</span>
              <div>
                <h4 className="text-xs font-bold text-emerald-900">Alineación de Códigos Especiales Activa (Mapeo p.unik ➔ Partida)</h4>
                <p className="text-[10px] text-emerald-800 leading-relaxed mt-0.5">
                  Para resolver las discrepancias debidas a códigos repetidos en planilla, el sistema aplica un diccionario de traducción inteligente de <strong>97 códigos</strong> (p.ej. <em>16.3.3.3.2.12</em> se vincula correctamente con <em>16.3.2.3.2.12</em>). Esto sincroniza el avance físico con la estructura de la planilla, eliminando las falsas diferencias y logrando un balance 100% exacto.
                </p>
              </div>
            </div>
          )}
          
          {/* Alerta de Desalineaciones de CDO y Planilla (No Migradas / Capítulo Movido) */}
          {cdoVsS.desalineados && cdoVsS.desalineados.length > 0 && (
            <div className="bg-amber-50/75 border border-amber-300 rounded-lg p-3.5 mb-4 shadow-sm">
              {(() => {
                const totalAlerts = cdoVsS.desalineados.filter((item: any) => !item.isParent).length;
                return (
                  <>
                    <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => setMostrarDesalineados(!mostrarDesalineados)}>
                      <div className="flex items-center gap-3">
                        <span className="text-xl">⚠️</span>
                        <div>
                          <h4 className="text-xs font-bold text-amber-900">Alerta: Partidas CDO No Migradas o Desalineadas de Capítulo ({totalAlerts})</h4>
                          <p className="text-[10px] text-amber-800">Partidas numéricas con montos en CDO que no existen o pertenecen a capítulos distintos en la Planilla, organizadas por su jerarquía de origen WBS.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded text-[10px] font-bold transition-all cursor-pointer"
                      >
                        {mostrarDesalineados ? 'Ocultar detalles ▲' : 'Ver listado ▼'}
                      </button>
                    </div>

                    {mostrarDesalineados && (
                      <div className="mt-3 text-[10.5px] overflow-x-auto border-t border-amber-200 pt-2.5">
                        <div className="flex justify-end gap-2 mb-2">
                          <button
                            type="button"
                            onClick={expandirTodoAlerts}
                            className="px-2.5 py-1 bg-amber-150 hover:bg-amber-200 text-amber-950 rounded text-[9px] font-bold transition-all cursor-pointer border border-amber-300"
                          >
                            Expandir todo
                          </button>
                          <button
                            type="button"
                            onClick={colapsarTodoAlerts}
                            className="px-2.5 py-1 bg-amber-150 hover:bg-amber-200 text-amber-950 rounded text-[9px] font-bold transition-all cursor-pointer border border-amber-300"
                          >
                            Colapsar todo
                          </button>
                        </div>
                        <table className="min-w-full text-left">
                          <thead>
                            <tr className="text-amber-800 font-bold border-b border-amber-200">
                              <th className="pb-1.5 pl-3 w-[240px]">Estructura / ID Partida</th>
                              <th className="pb-1.5">Descripción</th>
                              <th className="pb-1.5 text-center w-[130px]">WBS CDO (Real)</th>
                              <th className="pb-1.5 text-right pr-3 w-[130px]">Ejec. CDO (AV)</th>
                              <th className="pb-1.5 text-center w-[120px]">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-100">
                            {cdoVsS.desalineados
                              .filter(isAlertItemVisible)
                              .map((item, idx) => {
                                const indentValue = (item.depth || 0) * 12 + 10;
                                const indentStyle = { paddingLeft: `${indentValue}px` };
                                if (item.isParent) {
                                  const isExpanded = alertsExpanded.has(item.wbs.toLowerCase());
                                  const isL1 = item.isLevel1;
                                  return (
                                    <tr 
                                      key={idx} 
                                      className={`cursor-pointer select-none transition-colors border-l-2 ${
                                        isL1 
                                          ? "bg-amber-100/50 hover:bg-amber-100/70 border-l-amber-600 text-amber-950 font-bold text-[10.5px]" 
                                          : "bg-orange-50/40 hover:bg-orange-100/30 border-l-orange-400 text-orange-950 font-semibold text-[9.5px]"
                                      }`}
                                      onClick={() => toggleAlert(item.wbs)}
                                    >
                                      <td className="py-2 pl-3 font-mono w-[240px]" style={indentStyle}>
                                        <span className="inline-flex items-center gap-1.5 text-amber-950">
                                          {isExpanded ? (
                                            <ChevronDown className="w-3.5 h-3.5 text-amber-900 shrink-0 inline" />
                                          ) : (
                                            <ChevronRight className="w-3.5 h-3.5 text-amber-900 shrink-0 inline" />
                                          )}
                                          <span>📁 {isL1 ? `Partida: ${item.desc}` : `CAP: ${item.desc}`}</span>
                                        </span>
                                      </td>
                                      {/* Column D description is empty for parent level rows as requested */}
                                      <td className="py-2"></td>
                                      <td className="py-2 text-center text-amber-400 font-mono text-[9px] w-[130px]">-</td>
                                      <td className="py-2 text-right font-bold text-amber-950 pr-3 w-[130px]">
                                        {ctFmt(item.valCdo)}
                                      </td>
                                      <td className="py-2 text-center w-[120px]">
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                          isL1 ? "bg-amber-100 text-amber-850" : "bg-orange-100 text-orange-850"
                                        }`}>
                                          {isL1 ? "Nivel Partida" : "Nivel CAP"}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                } else {
                                  return (
                                    <tr key={idx} className="hover:bg-amber-150/40 text-amber-900 transition-colors">
                                      <td className="py-2 pl-3 font-mono text-[10px] text-amber-900 font-bold select-all w-[240px]" style={indentStyle}>
                                        📄 {item.partida}
                                      </td>
                                      <td className="py-2 max-w-[400px] truncate text-amber-900 font-medium" title={item.desc}>
                                        {cleanDesc(item.desc)}
                                      </td>
                                      <td className="py-2 text-center text-blue-800 font-bold font-mono text-[10px] w-[130px]" title="Ubicación WBS real de CDO">
                                        {item.capCdo}
                                      </td>
                                      <td className="py-2 text-right font-bold text-blue-755 pr-3 w-[130px]">
                                        {ctFmt(item.valCdo)}
                                      </td>
                                      <td className="py-2 text-center w-[120px]">
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                          item.status === 'No Existe' 
                                            ? 'bg-red-100 text-red-700' 
                                            : 'bg-orange-100 text-orange-700'
                                        }`}>
                                          {item.status === 'No Existe' ? 'Falta en Planilla' : 'Capítulo Movido'}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                }
                              })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
          
          {vista === 'jerarquica' && <TarjetasTipo cards={tipoCardJer} filterActive={filterTipoJer} setFilter={setFilterTipoJer} />}
          {vista === 'plana' && <TarjetasTipo cards={tipoCardPlana} filterActive={filterTipoPlana} setFilter={setFilterTipoPlana} />}
          
          {/* Filtro de Diferencias consolidado alineado espacialmente arriba de las columnas de la derecha de la tabla */}
          <div className="flex justify-end items-center gap-3 mb-2.5 flex-wrap mt-4">
            {/* Buscador */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1.5 hover:bg-slate-100/70 transition-all shadow-sm flex-wrap sm:flex-nowrap">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                🔍 Buscador
              </span>
              
              <div className="relative flex items-center min-w-[160px] w-full sm:w-56">
                <input
                  type="text"
                  id="cdo-vs-planilla-search"
                  placeholder="Ej: enmienda + 16.3"
                  value={tempSearchInputValue}
                  onChange={(e) => setTempSearchInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearchTrigger();
                    }
                  }}
                  className="w-full bg-white pl-2.5 pr-8 py-1 text-xs border border-slate-250 rounded outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 font-medium text-slate-700 placeholder-gray-400"
                />
                {(tempSearchInputValue || searchQuery) && (
                  <button
                    type="button"
                    id="btn-clear-search-excel"
                    onClick={handleSearchClear}
                    className="absolute right-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    title="Limpiar búsqueda"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="button"
                id="btn-submit-search-excel"
                onClick={handleSearchTrigger}
                className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-[11px] font-bold px-3 py-1 rounded transition-colors shadow-sm flex items-center gap-1 cursor-pointer"
              >
                <Search className="w-3 h-3" />
                Buscar
              </button>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1.5 hover:bg-slate-100/70 transition-all shadow-sm">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Filtrar por Diferencia</span>
              <select
                id="select-filter-diff"
                value={filterDiff}
                onChange={(e) => setFilterDiff(e.target.value as 'all' | 'positive' | 'negative')}
                className={`bg-transparent text-xs font-bold outline-none cursor-pointer ${
                  filterDiff === 'positive' 
                    ? 'text-green-700' 
                    : filterDiff === 'negative' 
                    ? 'text-red-600' 
                    : 'text-slate-700'
                }`}
              >
                <option value="all" className="text-slate-700 font-normal">Todas las partidas</option>
                <option value="positive" className="text-green-700 font-semibold">diferencias positivas</option>
                <option value="negative" className="text-red-600 font-semibold">diferencias negativas</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              {vista === 'jerarquica' && (
                <>
                  <thead>
                    <Thead ch />
                  </thead>
                  <tbody>
                    {(() => {
                      const filtered = (filterTipoJer || filterDiff !== 'all' || searchQuery)
                        ? sortedRootCods.filter(rc => dValsMapResult.matchesFilter.has(rc)) 
                        : sortedRootCods;
                      console.log('[CDO_VS_PLANILLA_DIAG]', {
                        searchQuery,
                        filterTipoJer,
                        sortedRootCods,
                        filtered,
                        matchesFilterKeys: Array.from(dValsMapResult.matchesFilter as Set<string>).filter(k => k.split('.').length === 1),
                        allFKeys: Object.keys(cdoVsS.F || {})
                      });
                      return filtered.map(cod => <DataRow key={cod} cod={cod} ch />);
                    })()}
                    <TotRow ch />
                  </tbody>
                </>
              )}
              {vista === 'plana' && (
                <>
                  <thead>
                    <Thead />
                  </thead>
                  <tbody>
                    {paginatedPlanaList.map(cod => (
                      <DataRow key={cod} cod={cod} />
                    ))}
                    {sortedPlanaList.length > paginatedPlanaList.length && (
                      <tr>
                        <td colSpan={6} className="px-3 py-4 text-center bg-gray-50 border-t">
                          <div className="flex flex-col items-center justify-center gap-1.5">
                            <span className="text-gray-500 font-medium select-none">
                              Mostrando {paginatedPlanaList.length} de {sortedPlanaList.length} partidas flat
                            </span>
                            <div className="flex justify-center items-center gap-2">
                              <button 
                                type="button"
                                onClick={() => setPage(p => p + 1)}
                                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-all cursor-pointer text-[11px]"
                              >
                                📥 Cargar más (+{itemsPerPage})
                              </button>
                              <button 
                                type="button"
                                onClick={() => setPage(Math.ceil(sortedPlanaList.length / itemsPerPage))}
                                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition-all cursor-pointer text-[11px]"
                              >
                                ⚡️ Ver todas
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    <TotRow />
                  </tbody>
                </>
              )}
              {vista === 'tipo' && (
                <React.Fragment>
                  <tbody>
                    <tr>
                      <td colSpan={7} className="pb-0 pt-0 px-0">
                        <div className="grid grid-cols-7 gap-1.5 mb-3 mt-1">
                          {porTipo.map((g: any) => {
                            const lbl = g.tipo.replace(/^\d+\./, '').trim() || g.tipo;
                            const isActive = filterTipo === g.tipo;
                            const cfg = ctTipoCfg(g.tipo);
                            return (
                              <div 
                                key={g.tipo || 'none'} 
                                className={`border-2 rounded-lg p-2 cursor-pointer transition-all ${cfg.bg} ${cfg.border} ${isActive ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`} 
                                onClick={() => setFilterTipo(filterTipo === g.tipo ? '' : g.tipo)}
                              >
                                <div className="flex justify-between items-start gap-0.5">
                                  <span className={`text-[9px] font-bold ${cfg.text} leading-tight truncate`}>{lbl}</span>
                                  <span className={`text-[9px] ${cfg.text} opacity-60 flex-shrink-0`}>{g.items.length}</span>
                                </div>
                                <div className={`text-xs font-bold ${cfg.text} mt-0.5`}>{(g.plan / 1e6).toFixed(2)}M</div>
                                <div className="flex gap-1 mt-0.5 flex-wrap">
                                  {g.diffPos > 0 && <span className="text-[8px] font-semibold text-green-600">+{(g.diffPos / 1e6).toFixed(2)}M</span>}
                                  {g.diffNeg < 0 && <span className="text-[8px] font-semibold text-red-500">{(g.diffNeg / 1e6).toFixed(2)}M</span>}
                                </div>
                                <div className="w-full h-1 bg-white/60 rounded-full mt-1 overflow-hidden">
                                  <div className={cfg.bar} style={{ width: `${Math.min(g.contrato > 0 ? (g.plan / g.contrato) * 100 : 0, 100)}%`, height: '100%' }} />
                                </div>
                                <div className={`text-[8px] ${cfg.text} opacity-70`}>{g.contrato > 0 ? ((g.plan / g.contrato) * 100).toFixed(1) : 0}%</div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                  <thead>
                    <Thead />
                  </thead>
                  <tbody>
                    {paginatedTipoList.map(cod => (
                      <DataRow key={cod} cod={cod} />
                    ))}
                    {sortedTipoList.length > paginatedTipoList.length && (
                      <tr>
                        <td colSpan={6} className="px-3 py-4 text-center bg-gray-50 border-t">
                          <div className="flex flex-col items-center justify-center gap-1.5">
                            <span className="text-gray-500 font-medium select-none">
                              Mostrando {paginatedTipoList.length} de {sortedTipoList.length} partidas filtradas
                            </span>
                            <div className="flex justify-center items-center gap-2">
                              <button 
                                type="button"
                                onClick={() => setPage(p => p + 1)}
                                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-all cursor-pointer text-[11px]"
                              >
                                📥 Cargar más (+{itemsPerPage})
                              </button>
                              <button 
                                type="button"
                                onClick={() => setPage(Math.ceil(sortedTipoList.length / itemsPerPage))}
                                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition-all cursor-pointer text-[11px]"
                              >
                                ⚡️ Ver todas
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    <TotRow />
                  </tbody>
                </React.Fragment>
              )}
            </table>
          </div>
        </div>
      )}

      {activeCell && (
        <div 
          className={`fixed z-50 bg-slate-900 border border-slate-700/80 text-white rounded-xl shadow-2xl p-4 max-w-sm text-xs transition-all duration-150 animate-fade-in ${
            activeCell.isSticky ? 'pointer-events-auto ring-1 ring-amber-500/55' : 'pointer-events-none'
          }`}
          style={{
            left: `${activeCell.rect.left - 12}px`,
            top: `${activeCell.rect.top + activeCell.rect.height / 2}px`,
            transform: 'translate(-100%, -50%)'
          }}
        >
          {activeCell.isSticky && (
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveCell(null);
              }}
              className="absolute top-3 right-3 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-colors text-xs font-bold font-sans"
              title="Cerrar detalle"
            >
              ×
            </button>
          )}

          <div className="font-semibold text-amber-400 mb-1 flex items-center gap-1.5 pr-6">
            <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
              activeCell.isSticky ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 'bg-amber-900/60 text-amber-300'
            }`}>
              {activeCell.isSticky ? 'Detalle Fijado' : 'Cálculo de Cantidad'}
            </span>
            <span className="font-mono text-[11px] text-slate-300 select-all font-bold">
              #{activeCell.cod}
            </span>
          </div>
          <div className="font-medium text-slate-100 mb-2.5 truncate max-w-[270px]" title={activeCell.desc}>
            {cleanDesc(activeCell.desc)}
          </div>

          <div className="space-y-2 border-t border-slate-800 pt-2.5">
            <div className="flex justify-between gap-10 items-baseline">
              <span className="text-slate-400 font-medium font-sans">Precio unitario:</span>
              <span className="font-mono font-bold text-amber-200 text-sm">
                {activeCell.tarifa.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {activeCell.unidad}
              </span>
            </div>
            
            <div className="my-2.5 p-2 bg-slate-950 border border-amber-500/25 rounded-lg">
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-1">
                Cantidad según columna {activeCell.colName === 'plan' ? 'Planilla' : activeCell.colName === 'ejec' ? 'Ejecutado' : activeCell.colName === 'contrato' ? 'Contrato' : 'Desviación'}:
              </div>
              <div className="flex justify-between items-baseline gap-4">
                <span className="text-slate-300 text-[10.5px]">
                  Valor: {activeCell.val.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-amber-400 font-mono font-extrabold text-sm border-b border-dashed border-amber-500/50 pb-0.5 select-all">
                  {(activeCell.val / activeCell.tarifa).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {activeCell.unidad}
                </span>
              </div>
            </div>

            <div className="text-[9px] font-bold text-slate-400 mt-2.5 uppercase tracking-wider">
              Desglose Completo de Obra (Cantidad / Valor)
            </div>
            <div className="grid grid-cols-3 gap-y-2 gap-x-3 text-[11px] font-mono mt-1.5 border-t border-slate-800/60 pt-2 border-dashed">
              <span className="text-slate-400 font-sans">Contrato:</span>
              <span className="text-right text-slate-200">
                {activeCell.contrato.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
              </span>
              <span className="text-right text-slate-100 font-bold select-all">
                {(activeCell.contrato / activeCell.tarifa).toLocaleString('es-CO', { maximumFractionDigits: 2 })} {activeCell.unidad}
              </span>

              <span className="text-slate-400 font-sans">Planilla:</span>
              <span className="text-right text-green-400">
                {activeCell.plan.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
              </span>
              <span className="text-right text-green-300 font-bold select-all">
                {(activeCell.plan / activeCell.tarifa).toLocaleString('es-CO', { maximumFractionDigits: 2 })} {activeCell.unidad}
              </span>

              <span className="text-slate-400 font-sans">Ejecutado:</span>
              <span className="text-right text-blue-400">
                {activeCell.ejec.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
              </span>
              <span className="text-right text-blue-300 font-bold select-all">
                {(activeCell.ejec / activeCell.tarifa).toLocaleString('es-CO', { maximumFractionDigits: 2 })} {activeCell.unidad}
              </span>

              <span className="text-slate-400 font-sans border-t border-slate-850 pt-1.5">Desviación:</span>
              <span className={`text-right border-t border-slate-850 pt-1.5 font-bold ${activeCell.diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {activeCell.diff >= 0 ? '+' : ''}{activeCell.diff.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
              </span>
              <span className={`text-right border-t border-slate-850 pt-1.5 font-bold select-all ${activeCell.diff >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                {activeCell.diff >= 0 ? '+' : ''}{(activeCell.diff / activeCell.tarifa).toLocaleString('es-CO', { maximumFractionDigits: 2 })} {activeCell.unidad}
              </span>
            </div>
            {activeCell.isSticky && (
              <div className="text-[10px] text-center text-slate-400 pt-2 border-t border-slate-800/40 font-sans">
                Haga clic en otra celda o pulse × arriba para cerrar
              </div>
            )}
          </div>
          
          {/* Triángulo indicador abajo */}
          <div 
            className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-900"
          />
        </div>
      )}
    </div>
  );
};
