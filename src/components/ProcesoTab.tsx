import React, { useState, useMemo, useEffect, useRef } from 'react';
import snapData from '../data/estadoEquiposSnap.json';
import {
  STG,
  STN,
  VERB,
  LS_KEY,
  UI_LS_KEY,
  isN,
  fq,
  pc,
  fd,
  dd,
  natCmp,
  riskOf,
  AGUA,
  akey,
  AORDER,
  ATRAMO,
  ADEF,
  sludgeElec,
  build,
  agg,
  fracs,
  stateOf,
  sentence,
  readMaster,
  P5,
  KFS,
  stSt,
  isCrit,
  kfPass,
  kfAny,
  isCable,
  eqU,
  compLab,
  isValvulaScap
} from '../utils/estadoEquiposDomain';
import { Equipo, RawSnapshot, StageKey } from '../types/estadoEquipos';

export const ProcesoTab: React.FC = () => {
  // Raw snapshot data state (loads from localStorage or embedded SNAP)
  const [raw, setRaw] = useState<RawSnapshot>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.m) && parsed.m.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading raw snapshot from localStorage', e);
    }
    return snapData as unknown as RawSnapshot;
  });

  // Built domain model (869 equipments from Master)
  const model = useMemo(() => build(raw), [raw]);

  // UI state (Default to 'Todos los procesos' upon entering the tab)
  const [proc, setProc] = useState<string>('*');
  const [group, setGroup] = useState<'cap' | 'prov'>('cap');
  const [mode, setMode] = useState<'ex' | 'done' | 'open'>('ex');
  const [q, setQ] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const [prov, setProv] = useState<string>('');
  const [pend, setPend] = useState<boolean>(false);
  const [agua, setAgua] = useState<boolean>(false);
  const [aSel, setASel] = useState<Set<string>>(() => ADEF());
  const [aCCM, setACCM] = useState<boolean>(true);

  // New filters: Tipo de equipo (Componente), Subtipo (SCAP), Subcontratista (SubC)
  const [comp, setComp] = useState<string[]>([]);
  const [scap, setScap] = useState<string[]>([]);
  const [scapAll, setScapAll] = useState<boolean>(false);
  const [subc, setSubc] = useState<string[]>([]);
  const [subcAll, setSubcAll] = useState<boolean>(false);

  // Card filters: kf = { D?: string[], E?: string[], F?: string[], crit?: ['crit'] }
  const [kf, setKf] = useState<Record<string, string[]>>({});

  // Expanded cards / rows / bands (start collapsed per specification)
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());
  const [secCards, setSecCards] = useState<Set<string>>(new Set());
  const [pcolBands, setPcolBands] = useState<Set<string>>(new Set());

  // Upload panel state
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [uploadMsg, setUploadMsg] = useState<{ text: string; type: 'ok' | 'err' | 'info' } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast notification state
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const showToast = (text: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMsg(text);
    toastTimeoutRef.current = setTimeout(() => setToastMsg(null), 2000);
  };

  // Restore saved UI prefs on mount
  useEffect(() => {
    try {
      const savedUi = localStorage.getItem(UI_LS_KEY);
      if (savedUi) {
        const parsed = JSON.parse(savedUi);
        // Maintain default '*' for proc upon entering the tab unless explicitly configured in current session
        if (parsed.group) setGroup(parsed.group);
        if (parsed.mode) setMode(parsed.mode);
        if (typeof parsed.pend === 'boolean') setPend(parsed.pend);
        if (typeof parsed.agua === 'boolean') setAgua(parsed.agua);
        if (Array.isArray(parsed.aSel)) setASel(new Set(parsed.aSel));
        if (typeof parsed.aCCM === 'boolean') setACCM(parsed.aCCM);
        if (Array.isArray(parsed.comp)) setComp(parsed.comp);
        if (Array.isArray(parsed.scap)) setScap(parsed.scap);
        if (Array.isArray(parsed.subc)) setSubc(parsed.subc);
      }
    } catch (e) {
      console.warn('Error reading UI state from localStorage', e);
    }
  }, []);

  // Save persistent UI preferences
  useEffect(() => {
    try {
      localStorage.setItem(
        UI_LS_KEY,
        JSON.stringify({
          proc,
          group,
          mode,
          pend,
          agua,
          aSel: Array.from(aSel),
          aCCM,
          comp,
          scap,
          subc
        })
      );
    } catch (e) {
      // ignore
    }
  }, [proc, group, mode, pend, agua, aSel, aCCM, comp, scap, subc]);

  // Universe (v18, v32): No cables or conductors; unless pend is true, exclude WBS D and qty <= 0
  const universe = useMemo(() => {
    return model.filter(it => !isCable(it) && (pend || (!it.pend && it.qty > 0)));
  }, [model, pend]);

  // Available processes
  const availableProcs = useMemo(() => {
    return Array.from(new Set(universe.map(i => i.proc))).sort();
  }, [universe]);

  // Ensure selected proc exists
  useEffect(() => {
    if (proc !== '*' && availableProcs.length > 0 && !availableProcs.includes(proc)) {
      setProc(availableProcs[0] || '*');
    }
  }, [availableProcs, proc]);

  // Available providers for currently active process
  const availableProviders = useMemo(() => {
    const list = universe.filter(it => proc === '*' || it.proc === proc);
    return Array.from(new Set(list.map(i => i.prov))).sort((a, b) => a.localeCompare(b, 'es'));
  }, [universe, proc]);

  // Ensure selected provider exists
  useEffect(() => {
    if (prov && !availableProviders.includes(prov)) {
      setProv('');
    }
  }, [availableProviders, prov]);

  // Check if any filter is active (v20)
  const anyFilter = useMemo(() => {
    return (
      proc !== '*' ||
      comp.length > 0 ||
      scap.length > 0 ||
      subc.length > 0 ||
      kfAny(kf) ||
      agua ||
      q.trim().length > 0 ||
      searchInput.trim().length > 0 ||
      prov !== '' ||
      pend ||
      mode !== 'ex'
    );
  }, [proc, comp, scap, subc, kf, agua, q, searchInput, prov, pend, mode]);

  // Other filters flag to limit SCAP & SubC buttons to max 7 (v23-v27, v30)
  // Per specification: mode === 'open' does NOT count as a filter for this limit!
  const otherFiltersActive = useMemo(() => {
    return (
      comp.length > 0 ||
      scap.length > 0 ||
      subc.length > 0 ||
      kfAny(kf) ||
      agua ||
      q.trim().length > 0 ||
      prov !== '' ||
      pend ||
      mode === 'done'
    );
  }, [comp, scap, subc, kf, agua, q, prov, pend, mode]);

  // Base filtered list builder (with optional skip for cross-filtering rows)
  const getFilteredList = (skip?: 'comp' | 'scap' | 'subc' | boolean) => {
    const skipComp = skip === true || skip === 'comp';
    const skipScap = skip === 'scap';
    const skipSubc = skip === 'subc';
    const qClean = q.trim().toLowerCase();

    return universe.filter(it => {
      if (!skipComp && comp.length > 0 && !comp.includes(it.comp || '')) return false;
      if (!skipScap && scap.length > 0 && !scap.includes(it.scap || '')) return false;
      if (!skipSubc && subc.length > 0 && !subc.includes(it.prov || '')) return false;
      if (agua) {
        if (!aSel.has(akey(it.proc, it.cap))) return false;
        if (aCCM && sludgeElec(it)) return false;
      }
      if (mode === 'done') {
        if (!STG.some(k => it.s[k].done)) return false;
      } else if (mode === 'open') {
        if (!STG.some(k => !it.s[k].done)) return false;
      }
      if (proc !== '*' && it.proc !== proc) return false;
      if (prov && it.prov !== prov) return false;
      if (qClean) {
        const stageMatches = STG.some(k => {
          const s = it.s[k];
          return s && (
            (s.id && s.id.toLowerCase().includes(qClean)) ||
            (s.name && s.name.toLowerCase().includes(qClean)) ||
            (s.subc && s.subc.toLowerCase().includes(qClean))
          );
        });
        const matches = stageMatches || [it.base, it.desc, it.prov, it.inst, it.cap, it.fam, it.scap, it.proc].some(x =>
          String(x || '').toLowerCase().includes(qClean)
        );
        if (!matches) return false;
      }
      return true;
    });
  };

  // Base list without card filters (for cross-card calculations)
  const baseFiltered = useMemo(() => getFilteredList(), [universe, comp, scap, subc, agua, aSel, aCCM, mode, proc, prov, q]);

  // Final filtered list with card filters applied (for the cards and tables below)
  const finalFiltered = useMemo(() => baseFiltered.filter(it => kfPass(it, kf)), [baseFiltered, kf]);

  // Cross-card calculations for Stage cards (D, E, F) and 4th card
  const exU = (it: Equipo, k: StageKey) => {
    const s = it.s[k];
    const U = eqU(it);
    if (mode === 'done') return s.done ? U : 0;
    if (s.done) return U;
    return it.qty > 0 ? Math.min(U, (U * (s.ex || 0)) / it.qty) : 0;
  };

  // Data for stage cards (each skips its own filter per spec!)
  const stageCardData = useMemo(() => {
    return STG.map(k => {
      const list = baseFiltered.filter(it => kfPass(it, kf, k));
      const a = agg(list);
      const eqL = list.filter(it => eqU(it) > 0);
      const N = eqL.reduce((t, it) => t + eqU(it), 0);
      const ex = eqL.reduce((t, it) => t + exU(it, k), 0);
      const diff = Math.max(0, N - ex);
      const cnt = { done: 0, cur: 0, none: 0 };
      for (const it of list) {
        cnt[stSt(it, k)] += eqU(it);
      }
      const sel = kf[k] || [];
      return { k, a, N, ex, diff, cnt, sel };
    });
  }, [baseFiltered, kf, mode]);

  // Data for 4th card (Equipos en la selección)
  const fourthCardData = useMemo(() => {
    const a = agg(finalFiltered);
    const eqF = finalFiltered.filter(it => eqU(it) > 0);
    const NF = eqF.reduce((t, it) => t + eqU(it), 0);
    const materialPartidas = finalFiltered.length - eqF.length;
    const critList = baseFiltered.filter(it => kfPass(it, kf, 'crit') && isCrit(it));
    const isCritActive = Boolean(kf.crit && kf.crit.length > 0);
    return { a, NF, materialPartidas, critCount: critList.length, isCritActive };
  }, [baseFiltered, finalFiltered, kf]);

  // Handle toggling filter chips in the 4 KPI cards (v22)
  const handleToggleKf = (key: string, sv: string, multi: boolean) => {
    setKf(prev => {
      const cur = prev[key] || [];
      if (multi) {
        const next = cur.includes(sv) ? cur.filter(x => x !== sv) : [...cur, sv];
        return { ...prev, [key]: next };
      }
      // Single selection: if it was the only active button in the entire kf, clear it
      const isOnlyActive =
        kfAny(prev) &&
        Object.keys(prev).every(x => x === key || !(prev[x] && prev[x].length > 0)) &&
        cur.length === 1 &&
        cur[0] === sv;

      return isOnlyActive ? {} : { [key]: [sv] };
    });
    setOpenRows(new Set());
  };

  // Label for active card filter banner (kfb)
  const kfbLabel = useMemo(() => {
    const activeKeys = Object.keys(kf).filter(k => kf[k] && kf[k].length > 0);
    if (!activeKeys.length) return '';
    const order = ['D', 'E', 'F', 'crit'];
    return activeKeys
      .sort((x, y) => order.indexOf(x) - order.indexOf(y))
      .map(k => {
        if (k === 'crit') return 'Total Float ≤ 0';
        const sKey = k as StageKey;
        const stateLabels = kf[k].map(sv => {
          const match = KFS.find(x => x[0] === sv);
          return match ? match[1].toLowerCase() : sv;
        });
        return `${STN[sKey]}: ${stateLabels.join(' o ')}`;
      })
      .join(' y ');
  }, [kf]);

  // Clear all filters handler (v20)
  const handleClearFilters = () => {
    if (!anyFilter) return;
    setProc('*');
    setComp([]);
    setScap([]);
    setScapAll(false);
    setSubc([]);
    setSubcAll(false);
    setKf({});
    setAgua(false);
    setSearchInput('');
    setQ('');
    setProv('');
    setPend(false);
    setMode('ex');
    setOpenRows(new Set());
    setSecCards(new Set());
    setPcolBands(new Set());
    showToast('Filtros limpiados');
  };

  // Grouping of finalFiltered list
  const supOn = group === 'cap' && proc === '*';
  const getSupKey = (gl: Equipo[]) => (agua ? (ATRAMO.get(akey(gl[0].proc, gl[0].cap)) || 'Otras') : gl[0].proc);
  const getOrd = (g: Equipo[]) => Math.min(...g.map(i => AORDER.get(akey(i.proc, i.cap)) ?? 9999));

  const groupedCards = useMemo(() => {
    const outerKeyFn = group === 'cap' ? (i: Equipo) => `${i.proc}¦${i.cap}` : (i: Equipo) => i.prov;
    const map = new Map<string, Equipo[]>();
    for (const it of finalFiltered) {
      const k = outerKeyFn(it);
      const arr = map.get(k);
      if (!arr) map.set(k, [it]);
      else arr.push(it);
    }

    const entries = Array.from(map.entries());
    entries.sort((x, y) => {
      if (group === 'cap') {
        if (agua) {
          const diff = getOrd(x[1]) - getOrd(y[1]);
          if (diff !== 0) return diff;
        } else if (supOn) {
          const pDiff = x[1][0].proc.localeCompare(y[1][0].proc, 'es');
          if (pDiff !== 0) return pDiff;
        }
        return natCmp(x[1][0].base, y[1][0].base);
      }
      return x[0].localeCompare(y[0], 'es');
    });

    return entries;
  }, [finalFiltered, group, agua, supOn]);

  // Process / Tramo Bands
  const bandsMap = useMemo(() => {
    if (!supOn) return null;
    const map = new Map<string, { key: string; items: Equipo[]; capsCount: number }>();
    for (const [_, gl] of groupedCards) {
      const sk = getSupKey(gl);
      if (!map.has(sk)) {
        map.set(sk, { key: sk, items: [...gl], capsCount: 1 });
      } else {
        const b = map.get(sk)!;
        b.items.push(...gl);
        b.capsCount++;
      }
    }
    return map;
  }, [groupedCards, supOn, agua]);

  // Toggle all cards and bands
  const allCardKeys = useMemo(() => groupedCards.map(g => g[0]), [groupedCards]);
  const allBandKeys = useMemo(() => (bandsMap ? Array.from(bandsMap.keys()) : []), [bandsMap]);
  const isAnyExpanded = useMemo(() => {
    return allCardKeys.some(k => secCards.has(k)) || allBandKeys.some(k => pcolBands.has(k));
  }, [allCardKeys, allBandKeys, secCards, pcolBands]);

  const handleToggleExpandAll = () => {
    if (isAnyExpanded) {
      setSecCards(new Set());
      setPcolBands(new Set());
    } else {
      setSecCards(new Set(allCardKeys));
      setPcolBands(new Set(allBandKeys));
    }
  };

  const handleToggleCard = (cardKey: string) => {
    setSecCards(prev => {
      const next = new Set(prev);
      if (next.has(cardKey)) next.delete(cardKey);
      else next.add(cardKey);
      return next;
    });
  };

  const handleToggleBand = (bandKey: string) => {
    setPcolBands(prev => {
      const next = new Set(prev);
      if (next.has(bandKey)) next.delete(bandKey);
      else next.add(bandKey);
      return next;
    });
  };

  const handleToggleRow = (rowKey: string) => {
    setOpenRows(prev => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  };

  // Copy summary of a card
  const handleCopySummary = (cardTitle: string, rows: [string, Equipo[]][]) => {
    const lines = rows.map(([rk, rl]) => {
      const [p1, fam] = rk.split('¦');
      const rAgg = agg(rl);
      const label = group === 'cap' ? `${p1} — ${fam}` : `${fam} en ${p1}`;
      return '- ' + sentence(rAgg, label, mode);
    });
    const txt = `En ${cardTitle}:\n${lines.join('\n')}`;
    try {
      navigator.clipboard.writeText(txt).then(
        () => showToast('Resumen copiado al portapapeles'),
        () => showToast('No se pudo copiar en este navegador')
      );
    } catch (e) {
      showToast('No se pudo copiar en este navegador');
    }
  };

  // Upload & Process 2. Master.xlsx
  const handleProcessMaster = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setUploadMsg({ text: 'Por favor selecciona el archivo 2. Master.xlsx', type: 'err' });
      return;
    }
    setIsProcessing(true);
    setUploadMsg({ text: 'Leyendo el Master… puede tardar unos segundos.', type: 'info' });
    try {
      const { rows, wk, name } = await readMaster(file);
      const newSnapshot: RawSnapshot = {
        meta: {
          master: name,
          masterWeek: wk || 'S/F',
          built: new Date().toISOString().slice(0, 10)
        },
        m: rows
      };
      setRaw(newSnapshot);
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(newSnapshot));
      } catch (err) {
        console.warn('Could not save raw master snapshot to localStorage', err);
      }
      setUploadMsg({ text: `Listo: ${rows.length} actividades procesadas (${name}).`, type: 'ok' });
      showToast('Master actualizado correctamente');
      setTimeout(() => setIsUploadOpen(false), 1200);
    } catch (e: any) {
      setUploadMsg({ text: e.message || 'Error al procesar el archivo Excel', type: 'err' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetOriginalMaster = () => {
    try {
      localStorage.removeItem(LS_KEY);
    } catch (e) {}
    const orig = snapData as unknown as RawSnapshot;
    setRaw(orig);
    setUploadMsg({
      text: `Se restauró la carga original (${orig.meta.master}, ${orig.meta.masterWeek}).`,
      type: 'ok'
    });
    showToast('Carga original restaurada');
  };

  return (
    <div className="w-full bg-[#EEF2F3] text-[#14212A] min-h-[calc(100vh-140px)] rounded-2xl pb-16 font-['IBM_Plex_Sans',system-ui,sans-serif]">
      {/* 1. Header Bar */}
      <header className="sticky top-0 z-30 bg-[#F5F8F9] border border-[#D5DEE2] rounded-t-2xl">
        <div className="max-w-[1360px] mx-auto px-4 py-2 flex flex-wrap gap-3 items-center justify-between">
          <div>
            <h1 className="text-[11px] font-['Barlow_Condensed'] font-semibold text-[#14212A] uppercase tracking-wider">
              Estado de Equipos PTAR Merinos · <span className="text-[#5A6A74] font-mono normal-case font-normal">Compra y fabricación · Flete · Instalación — por proceso y estructura (CAP)</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Actions */}
            <button
              type="button"
              onClick={handleToggleExpandAll}
              className="px-2 py-0.5 text-xs font-normal rounded-lg border border-[#D5DEE2] bg-white text-[#14212A] hover:bg-[#EEF2F3] transition-colors cursor-pointer"
            >
              {isAnyExpanded ? 'Colapsar tarjetas' : 'Expandir tarjetas'}
            </button>

            {/* (new v20) Botón Limpiar filtros */}
            <button
              type="button"
              id="bClr"
              onClick={handleClearFilters}
              disabled={!anyFilter}
              className="px-2 py-0.5 text-xs font-normal rounded-lg border border-[#D5DEE2] bg-white text-[#14212A] hover:bg-[#EEF2F3] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Quita proceso, tipo de equipo, subtipo, subcontratista, filtro de tarjetas, Agua, búsqueda, proveedor, pendientes y modo terminadas"
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Content Container */}
      <main className="max-w-[1360px] mx-auto px-4 sm:px-6 pt-4 space-y-3.5">
        {/* Upload Panel */}
        {isUploadOpen && (
          <div className="bg-white border border-[#D5DEE2] rounded-xl p-4 shadow-sm space-y-3 animate-fadeIn">
            <div className="text-xs font-bold text-[#14212A] uppercase tracking-wider">
              Cargar y procesar 2. Master.xlsx
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-xs text-[#5A6A74] border border-dashed border-[#D5DEE2] rounded-lg p-3 bg-[#F5F8F9] cursor-pointer hover:border-[#442dd7]">
                <span className="font-bold text-[#14212A] text-sm">2. Master.xlsx</span>
                <span>
                  Pestaña cdo: Proceso, CAP, SubC, Cantidad, % Ex, Cantidad Ex, p6, Start, Finish, blFinish, Float, Componente
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xlsm,.xls"
                  className="mt-1 text-xs text-slate-700 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border file:border-slate-300 file:text-xs file:font-semibold file:bg-white file:text-slate-700 hover:file:bg-slate-50 cursor-pointer"
                />
              </label>

              <div className="flex flex-col justify-between py-1">
                <div className="space-y-1">
                  <p className="text-xs text-[#5A6A74]">
                    El archivo se lee completamente en tu navegador y los datos procesados quedan guardados en este equipo.
                  </p>
                  {uploadMsg && (
                    <div
                      className={`text-xs font-medium p-2 rounded-md ${
                        uploadMsg.type === 'err'
                          ? 'bg-rose-50 text-[#B83227] border border-rose-200'
                          : uploadMsg.type === 'ok'
                          ? 'bg-emerald-50 text-[#2B7F52] border border-emerald-200'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      }`}
                    >
                      {uploadMsg.text}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleProcessMaster}
                    className="px-4 py-2 bg-[#442dd7] hover:bg-[#3722b5] text-white font-semibold text-xs rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isProcessing ? 'Procesando…' : 'Procesar'}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetOriginalMaster}
                    className="px-3.5 py-2 border border-[#D5DEE2] hover:bg-slate-100 text-[#14212A] font-semibold text-xs rounded-md transition-colors cursor-pointer"
                  >
                    Volver a la carga original
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. Process Tabs (Grid layout) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {/* Tab Todos los Procesos */}
          {(() => {
            const allAgg = agg(universe);
            const isSelected = proc === '*';
            return (
              <button
                type="button"
                onClick={() => {
                  setProc('*');
                  setOpenRows(new Set());
                }}
                className={`p-2 sm:p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#EEECFB] border-[#442dd7] shadow-xs ring-1 ring-[#442dd7]'
                    : 'bg-white border-[#D5DEE2] hover:border-slate-400'
                }`}
              >
                <div className="font-bold text-[12.5px] leading-tight text-[#14212A] truncate">
                  Todos los procesos
                </div>
                <div className="font-['IBM_Plex_Mono'] text-[10.5px] text-[#5A6A74] mt-1 leading-snug">
                  {allAgg.n} partidas · {new Set(universe.map(i => i.cap)).size} estruct.
                </div>
                <div className="grid grid-cols-3 gap-1 mt-1.5">
                  <div className="h-1.5 bg-[#D5DEE2] rounded-xs overflow-hidden relative" title={`Fabr. ${pc(allAgg.st.D.pv)}`}>
                    <div className="h-full bg-[#A86B12]" style={{ width: `${(allAgg.st.D.pv || 0) * 100}%` }} />
                  </div>
                  <div className="h-1.5 bg-[#D5DEE2] rounded-xs overflow-hidden relative" title={`Flete ${pc(allAgg.st.E.pv)}`}>
                    <div className="h-full bg-[#2C67A6]" style={{ width: `${(allAgg.st.E.pv || 0) * 100}%` }} />
                  </div>
                  <div className="h-1.5 bg-[#D5DEE2] rounded-xs overflow-hidden relative" title={`Instalación ${pc(allAgg.st.F.pv)}`}>
                    <div className="h-full bg-[#2B7F52]" style={{ width: `${(allAgg.st.F.pv || 0) * 100}%` }} />
                  </div>
                </div>
              </button>
            );
          })()}

          {/* Tabs por cada Proceso */}
          {availableProcs.map(pName => {
            const pItems = universe.filter(i => i.proc === pName);
            const pAgg = agg(pItems);
            const isSelected = proc === pName;
            return (
              <button
                key={pName}
                type="button"
                onClick={() => {
                  setProc(pName);
                  setOpenRows(new Set());
                }}
                className={`p-2 sm:p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#EEECFB] border-[#442dd7] shadow-xs ring-1 ring-[#442dd7]'
                    : 'bg-white border-[#D5DEE2] hover:border-slate-400'
                }`}
              >
                <div className="font-bold text-[12.5px] leading-tight text-[#14212A] truncate" title={pName}>
                  {pName}
                </div>
                <div className="font-['IBM_Plex_Mono'] text-[10.5px] text-[#5A6A74] mt-1 leading-snug">
                  {pAgg.n} partidas · {new Set(pItems.map(i => i.cap)).size} estruct.
                </div>
                <div className="grid grid-cols-3 gap-1 mt-1.5">
                  <div className="h-1.5 bg-[#D5DEE2] rounded-xs overflow-hidden relative" title={`Fabr. ${pc(pAgg.st.D.pv)}`}>
                    <div className="h-full bg-[#A86B12]" style={{ width: `${(pAgg.st.D.pv || 0) * 100}%` }} />
                  </div>
                  <div className="h-1.5 bg-[#D5DEE2] rounded-xs overflow-hidden relative" title={`Flete ${pc(pAgg.st.E.pv)}`}>
                    <div className="h-full bg-[#2C67A6]" style={{ width: `${(pAgg.st.E.pv || 0) * 100}%` }} />
                  </div>
                  <div className="h-1.5 bg-[#D5DEE2] rounded-xs overflow-hidden relative" title={`Instalación ${pc(pAgg.st.F.pv)}`}>
                    <div className="h-full bg-[#2B7F52]" style={{ width: `${(pAgg.st.F.pv || 0) * 100}%` }} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* 3b. (new v19) Tipo de equipo (columna Componente) */}
        {(() => {
          const L = getFilteredList('comp').filter(it => kfPass(it, kf));
          const m = new Map<string, { p: number; e: number }>();
          for (const it of L) {
            const c = it.comp || '';
            if (!m.has(c)) m.set(c, { p: 0, e: 0 });
            const o = m.get(c)!;
            o.p++;
            o.e += eqU(it);
          }
          for (const c of comp) {
            if (!m.has(c)) m.set(c, { p: 0, e: 0 });
          }
          const ks = Array.from(m.keys()).sort((a, b) => (a || '99').localeCompare(b || '99', 'es', { numeric: true }));
          const tot = L.reduce((t, it) => t + eqU(it), 0);

          const handleCompClick = (c: string, isMulti: boolean) => {
            if (c === '*') {
              setComp([]);
            } else if (isMulti) {
              setComp(prev => (prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]));
            } else {
              setComp(prev => (prev.length === 1 && prev[0] === c ? [] : [c]));
            }
            setOpenRows(new Set());
          };

          return (
            <div className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="Tipo de equipo">
              <span className="font-bold text-[11px] uppercase tracking-wider text-[#5A6A74] min-w-[125px]">
                Tipo de equipo
              </span>
              <button
                type="button"
                onClick={() => handleCompClick('*', false)}
                className={`inline-flex items-baseline gap-1.5 px-2.5 py-1 rounded-md border font-sans text-xs transition-colors cursor-pointer ${
                  comp.length === 0
                    ? 'bg-[#442dd7] border-[#442dd7] text-white font-bold'
                    : 'bg-white border-[#D5DEE2] text-[#14212A] hover:border-[#442dd7]'
                }`}
              >
                <span>Todos</span>
                <b className={`text-[11px] font-mono ${comp.length === 0 ? 'text-white' : 'text-[#5A6A74]'}`}>{fq(tot)}</b>
              </button>
              {ks.map(c => {
                const o = m.get(c)!;
                const isPressed = comp.includes(c);
                return (
                  <button
                    key={c || 'sin-tipo'}
                    type="button"
                    onClick={e => handleCompClick(c, e.ctrlKey || e.metaKey)}
                    className={`inline-flex items-baseline gap-1.5 px-2.5 py-1 rounded-md border font-sans text-xs transition-colors cursor-pointer ${
                      isPressed
                        ? 'bg-[#442dd7] border-[#442dd7] text-white font-bold'
                        : 'bg-white border-[#D5DEE2] text-[#14212A] hover:border-[#442dd7]'
                    }`}
                    title={`${o.p} partidas · ${fq(o.e)} equipos. Ctrl + clic (⌘ en Mac) para combinar tipos.`}
                  >
                    <span>{compLab(c)}</span>
                    <b className={`text-[11px] font-mono ${isPressed ? 'text-white' : 'text-[#5A6A74]'}`}>{fq(o.e)}</b>
                  </button>
                );
              })}
              <span className="text-[11px] text-[#5A6A74] ml-2 hidden sm:inline">Ctrl + clic para combinar</span>
            </div>
          );
        })()}

        {/* 3c. (new v23-v27) Subtipo de equipo (columna SCAP) */}
        {(() => {
          const L = getFilteredList('scap').filter(it => kfPass(it, kf));
          const m = new Map<string, { p: number; e: number }>();
          for (const it of L) {
            const c = it.scap || '';
            if (!m.has(c)) m.set(c, { p: 0, e: 0 });
            const o = m.get(c)!;
            o.p++;
            o.e += eqU(it);
          }
          for (const c of scap) {
            if (!m.has(c)) m.set(c, { p: 0, e: 0 });
          }
          const ks = Array.from(m.keys()).sort(
            (a, b) => m.get(b)!.e - m.get(a)!.e || m.get(b)!.p - m.get(a)!.p || String(a).localeCompare(String(b), 'es')
          );
          const SLIM = 7;
          const lim = !otherFiltersActive && !scapAll && ks.length > SLIM;
          const vis = lim ? ks.slice(0, SLIM) : ks;
          const tot = L.reduce((t, it) => t + eqU(it), 0);

          const handleScapClick = (c: string, isMulti: boolean) => {
            if (c === '*') {
              setScap([]);
            } else if (isMulti) {
              setScap(prev => (prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]));
            } else {
              setScap(prev => (prev.length === 1 && prev[0] === c ? [] : [c]));
            }
            setOpenRows(new Set());
          };

          return (
            <div className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="Subtipo de equipo (SCAP)">
              <span className="font-bold text-[11px] uppercase tracking-wider text-[#5A6A74] min-w-[125px] shrink-0">
                Subtipo (SCAP)
              </span>
              <button
                type="button"
                onClick={() => handleScapClick('*', false)}
                className={`inline-flex items-baseline gap-1.5 px-2.5 py-1 rounded-md border font-sans text-xs transition-colors cursor-pointer shrink-0 ${
                  scap.length === 0
                    ? 'bg-[#442dd7] border-[#442dd7] text-white font-bold'
                    : 'bg-white border-[#D5DEE2] text-[#14212A] hover:border-[#442dd7]'
                }`}
              >
                <span>Todos</span>
                <b className={`text-[11px] font-mono ${scap.length === 0 ? 'text-white' : 'text-[#5A6A74]'}`}>{fq(tot)}</b>
              </button>
              {vis.map(c => {
                const o = m.get(c)!;
                const isPressed = scap.includes(c);
                return (
                  <button
                    key={c || 'sin-scap'}
                    type="button"
                    onClick={e => handleScapClick(c, e.ctrlKey || e.metaKey)}
                    className={`inline-flex items-baseline gap-1.5 px-2.5 py-1 rounded-md border font-sans text-xs transition-colors cursor-pointer shrink-0 ${
                      isPressed
                        ? 'bg-[#442dd7] border-[#442dd7] text-white font-bold'
                        : 'bg-white border-[#D5DEE2] text-[#14212A] hover:border-[#442dd7]'
                    }`}
                    title={`${o.p} partidas · ${fq(o.e)} equipos. Ctrl + clic (⌘ en Mac) para combinar subtipos.`}
                  >
                    <span>{c || '(sin SCAP)'}</span>
                    <b className={`text-[11px] font-mono ${isPressed ? 'text-white' : 'text-[#5A6A74]'}`}>{fq(o.e)}</b>
                  </button>
                );
              })}
              {lim && (
                <button
                  type="button"
                  onClick={() => setScapAll(true)}
                  className="px-2.5 py-1 rounded-md border border-dashed border-[#442dd7] text-[#442dd7] font-semibold text-xs hover:bg-[#EEECFB]/60 transition-colors cursor-pointer shrink-0"
                >
                  +{ks.length - SLIM} más
                </button>
              )}
              {scapAll && !otherFiltersActive && ks.length > SLIM && (
                <button
                  type="button"
                  onClick={() => setScapAll(false)}
                  className="px-2.5 py-1 rounded-md border border-dashed border-[#442dd7] text-[#442dd7] font-semibold text-xs hover:bg-[#EEECFB]/60 transition-colors cursor-pointer shrink-0"
                >
                  Ver menos
                </button>
              )}
            </div>
          );
        })()}

        {/* 3d. (new v30) Subcontratista (SubC) */}
        {(() => {
          const L = getFilteredList('subc').filter(it => kfPass(it, kf));
          const m = new Map<string, { p: number; e: number }>();
          for (const it of L) {
            const c = it.prov || '';
            if (!m.has(c)) m.set(c, { p: 0, e: 0 });
            const o = m.get(c)!;
            o.p++;
            o.e += eqU(it);
          }
          for (const c of subc) {
            if (!m.has(c)) m.set(c, { p: 0, e: 0 });
          }
          const ks = Array.from(m.keys()).sort(
            (a, b) => m.get(b)!.e - m.get(a)!.e || m.get(b)!.p - m.get(a)!.p || String(a).localeCompare(String(b), 'es')
          );
          const SLIM = 7;
          const lim = !otherFiltersActive && !subcAll && ks.length > SLIM;
          const vis = lim ? ks.slice(0, SLIM) : ks;
          const tot = L.reduce((t, it) => t + eqU(it), 0);

          const handleSubcClick = (c: string, isMulti: boolean) => {
            if (c === '*') {
              setSubc([]);
            } else if (isMulti) {
              setSubc(prev => (prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]));
            } else {
              setSubc(prev => (prev.length === 1 && prev[0] === c ? [] : [c]));
            }
            setOpenRows(new Set());
          };

          return (
            <div className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="Subcontratista (SubC)">
              <span className="font-bold text-[11px] uppercase tracking-wider text-[#5A6A74] min-w-[125px] shrink-0">
                Subcontratista
              </span>
              <button
                type="button"
                onClick={() => handleSubcClick('*', false)}
                className={`inline-flex items-baseline gap-1.5 px-2.5 py-1 rounded-md border font-sans text-xs transition-colors cursor-pointer shrink-0 ${
                  subc.length === 0
                    ? 'bg-[#442dd7] border-[#442dd7] text-white font-bold'
                    : 'bg-white border-[#D5DEE2] text-[#14212A] hover:border-[#442dd7]'
                }`}
              >
                <span>Todos</span>
                <b className={`text-[11px] font-mono ${subc.length === 0 ? 'text-white' : 'text-[#5A6A74]'}`}>{fq(tot)}</b>
              </button>
              {vis.map(c => {
                const o = m.get(c)!;
                const isPressed = subc.includes(c);
                return (
                  <button
                    key={c || 'sin-prov'}
                    type="button"
                    onClick={e => handleSubcClick(c, e.ctrlKey || e.metaKey)}
                    className={`inline-flex items-baseline gap-1.5 px-2.5 py-1 rounded-md border font-sans text-xs transition-colors cursor-pointer shrink-0 ${
                      isPressed
                        ? 'bg-[#442dd7] border-[#442dd7] text-white font-bold'
                        : 'bg-white border-[#D5DEE2] text-[#14212A] hover:border-[#442dd7]'
                    }`}
                    title={`${o.p} partidas · ${fq(o.e)} equipos. Ctrl + clic (⌘ en Mac) para combinar subcontratistas.`}
                  >
                    <span>{c || '(sin proveedor)'}</span>
                    <b className={`text-[11px] font-mono ${isPressed ? 'text-white' : 'text-[#5A6A74]'}`}>{fq(o.e)}</b>
                  </button>
                );
              })}
              {lim && (
                <button
                  type="button"
                  onClick={() => setSubcAll(true)}
                  className="px-2.5 py-1 rounded-md border border-dashed border-[#442dd7] text-[#442dd7] font-semibold text-xs hover:bg-[#EEECFB]/60 transition-colors cursor-pointer shrink-0"
                >
                  +{ks.length - SLIM} más
                </button>
              )}
              {subcAll && !otherFiltersActive && ks.length > SLIM && (
                <button
                  type="button"
                  onClick={() => setSubcAll(false)}
                  className="px-2.5 py-1 rounded-md border border-dashed border-[#442dd7] text-[#442dd7] font-semibold text-xs hover:bg-[#EEECFB]/60 transition-colors cursor-pointer shrink-0"
                >
                  Ver menos
                </button>
              )}
            </div>
          );
        })()}

        {/* 4. KPI Cards Grid (4 cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {stageCardData.map(({ k, a, N, ex, diff, cnt, sel }) => {
            const isStageOn = sel.length > 0;
            const stageColor = k === 'D' ? '#A86B12' : k === 'E' ? '#2C67A6' : '#2B7F52';
            return (
              <div
                key={k}
                className={`bg-white border rounded-xl p-3.5 flex flex-col justify-between shadow-xs transition-all ${
                  isStageOn ? 'border-[#442dd7] ring-1 ring-[#442dd7]' : 'border-[#D5DEE2]'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#5A6A74] tracking-wider uppercase">
                    <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: stageColor }} />
                    <span>{STN[k]}</span>
                  </div>

                  {/* (new v28-v29) Número grande con diferencia positiva en rojo */}
                  <div className="font-['Barlow_Condensed'] font-semibold text-3xl sm:text-[32px] text-[#14212A] leading-tight mt-1 flex items-baseline flex-wrap gap-1">
                    <span>{fq(ex)}</span>
                    <small className="text-lg text-[#5A6A74] font-medium">/ {fq(N)} equipos</small>
                    {diff > 0 && (
                      <small
                        className="text-sm font-bold text-[#B83227] ml-2 font-mono whitespace-nowrap"
                        title={`Faltan ${fq(diff)} equipos en esta etapa (${fq(N)} − ${fq(ex)})`}
                      >
                        {fq(diff)}
                      </small>
                    )}
                  </div>

                  <div className="h-1.5 bg-[#D5DEE2] rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        backgroundColor: stageColor,
                        width: `${N ? Math.min(100, (ex / N) * 100) : 0}%`
                      }}
                    />
                  </div>
                </div>

                <div className="mt-2.5 space-y-2">
                  <div className="text-xs text-[#5A6A74] leading-tight">
                    {pc(N ? ex / N : null)} de los equipos · {pc(a.st[k].pv)} de avance en valor
                  </div>

                  {/* Botones de estado de tarjeta: Terminados, En curso, Sin iniciar */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {KFS.map(([sv, lab]) => {
                      const isPressed = sel.includes(sv);
                      return (
                        <button
                          key={sv}
                          type="button"
                          onClick={e => handleToggleKf(k, sv, e.ctrlKey || e.metaKey)}
                          className={`inline-flex items-baseline gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                            isPressed
                              ? 'bg-[#442dd7] border-[#442dd7] text-white font-semibold'
                              : 'bg-[#F5F8F9] border-[#D5DEE2] text-[#5A6A74] hover:border-[#442dd7] hover:text-[#14212A]'
                          }`}
                          title={`${STN[k]} ${lab.toLowerCase()}: filtra las tarjetas de abajo y las otras tarjetas. Ctrl + clic (⌘ en Mac) para combinar con otros botones.`}
                        >
                          <span>{lab}</span>
                          <b className={`font-mono ${isPressed ? 'text-white' : 'text-[#14212A]'}`}>
                            {fq(cnt[sv as keyof typeof cnt])}
                          </b>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Card 4: Equipos en la Selección */}
          <div
            className={`bg-white border rounded-xl p-3.5 flex flex-col justify-between shadow-xs transition-all ${
              fourthCardData.isCritActive ? 'border-[#442dd7] ring-1 ring-[#442dd7]' : 'border-[#D5DEE2]'
            }`}
          >
            <div>
              <div className="text-[11px] font-bold text-[#5A6A74] tracking-wider uppercase">
                Equipos en la Selección
              </div>
              <div className="font-['Barlow_Condensed'] font-semibold text-3xl sm:text-[32px] text-[#442dd7] leading-tight mt-1">
                {fq(fourthCardData.NF)} <small className="text-lg text-[#5A6A74] font-medium">equipos</small>
              </div>
            </div>

            <div className="mt-2.5 space-y-2">
              <div className="text-xs text-[#5A6A74] leading-tight">
                <div>
                  {fourthCardData.a.n} partidas · {new Set(finalFiltered.map(i => i.cap)).size} estructuras ·{' '}
                  {new Set(finalFiltered.map(i => i.prov)).size} proveedores
                </div>
                {fourthCardData.materialPartidas > 0 && (
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    No incluye {fourthCardData.materialPartidas} partidas de material (m, kg, ton, m²)
                  </div>
                )}
              </div>

              {/* Botón Total Float <= 0 */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={e => handleToggleKf('crit', 'crit', e.ctrlKey || e.metaKey)}
                  className={`inline-flex items-baseline gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                    fourthCardData.isCritActive
                      ? 'bg-[#B83227] border-[#B83227] text-white font-semibold'
                      : 'bg-[#F5F8F9] border-[#D5DEE2] text-[#B83227] hover:border-[#B83227]'
                  }`}
                  title="Partidas con alguna etapa pendiente en Total Float ≤ 0. Ctrl + clic (⌘ en Mac) para combinar con otros botones."
                >
                  <span>Total Float ≤ 0</span>
                  <b className={`font-mono ${fourthCardData.isCritActive ? 'text-white' : 'text-[#B83227]'}`}>
                    {fourthCardData.critCount} partidas
                  </b>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Controls Bar */}
        <div className="bg-white border border-[#D5DEE2] rounded-xl p-2.5 sm:p-3 flex flex-wrap items-center gap-3 shadow-xs">
          {/* Botón Agua */}
          <button
            type="button"
            id="bAgua"
            onClick={() => {
              const nextAgua = !agua;
              setAgua(nextAgua);
              if (nextAgua) {
                setProc('*');
                setProv('');
              }
              setOpenRows(new Set());
              setSecCards(new Set());
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-xs transition-colors cursor-pointer border ${
              agua
                ? 'bg-[#2C67A6] text-white border-[#2C67A6] shadow-xs'
                : 'bg-white text-[#2C67A6] border-[#2C67A6] hover:bg-[#DDE8F4]/50'
            }`}
            title="Estructuras indispensables para ingresar agua a la PTAR y su alimentación eléctrica"
          >
            <svg viewBox="0 0 12 14" className="w-3 h-3.5 fill-current" aria-hidden="true">
              <path d="M6 0C6 0 0 6.6 0 9.2A6 6 0 0 0 12 9.2C12 6.6 6 0 6 0Z" />
            </svg>
            <span>Agua</span>
          </button>

          {/* Agrupar por */}
          <div className="flex items-center gap-1.5 text-xs text-[#5A6A74]">
            <span>Agrupar por</span>
            <div className="inline-flex border border-[#D5DEE2] rounded-md overflow-hidden p-0.5 bg-[#F5F8F9]">
              <button
                type="button"
                onClick={() => {
                  setGroup('cap');
                  setOpenRows(new Set());
                }}
                className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer ${
                  group === 'cap' ? 'bg-[#442dd7] text-white font-semibold' : 'text-[#5A6A74] hover:text-[#14212A]'
                }`}
              >
                Estructura
              </button>
              <button
                type="button"
                onClick={() => {
                  setGroup('prov');
                  setOpenRows(new Set());
                }}
                className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer ${
                  group === 'prov' ? 'bg-[#442dd7] text-white font-semibold' : 'text-[#5A6A74] hover:text-[#14212A]'
                }`}
              >
                Proveedor
              </button>
            </div>
          </div>

          {/* Cantidad (v21: incluye modo open) */}
          <div className="flex items-center gap-1.5 text-xs text-[#5A6A74]">
            <span>Cantidad</span>
            <div className="inline-flex border border-[#D5DEE2] rounded-md overflow-hidden p-0.5 bg-[#F5F8F9]">
              <button
                type="button"
                onClick={() => setMode('ex')}
                className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer ${
                  mode === 'ex' ? 'bg-[#442dd7] text-white font-semibold' : 'text-[#5A6A74] hover:text-[#14212A]'
                }`}
              >
                Cantidad Ex
              </button>
              <button
                type="button"
                onClick={() => setMode('done')}
                className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer ${
                  mode === 'done' ? 'bg-[#442dd7] text-white font-semibold' : 'text-[#5A6A74] hover:text-[#14212A]'
                }`}
              >
                Partidas terminadas
              </button>
              <button
                type="button"
                onClick={() => setMode('open')}
                className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer ${
                  mode === 'open' ? 'bg-[#442dd7] text-white font-semibold' : 'text-[#5A6A74] hover:text-[#14212A]'
                }`}
                title="Partidas con alguna etapa en curso o sin iniciar; las cantidades se muestran con Cantidad Ex"
              >
                Partidas no terminadas
              </button>
            </div>
          </div>

          {/* Search box (only searches on Enter key) */}
          <div className="flex-1 min-w-[220px] max-w-md relative flex items-center">
            <div className="absolute left-2.5 text-[#5A6A74] pointer-events-none flex items-center">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchInput}
              onChange={e => {
                const val = e.target.value;
                setSearchInput(val);
                if (val === '' && q !== '') {
                  setQ('');
                }
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setQ(searchInput.trim());
                } else if (e.key === 'Escape') {
                  setSearchInput('');
                  setQ('');
                }
              }}
              placeholder="Buscar actividad, equipo, proveedor o ID (Enter ↵)"
              className="w-full text-xs pl-8 pr-18 py-1.5 rounded-md border border-[#D5DEE2] bg-[#F5F8F9] focus:outline-none focus:ring-1 focus:ring-[#442dd7] focus:bg-white text-[#14212A] transition-colors"
            />
            <div className="absolute right-1.5 flex items-center gap-1">
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setQ('');
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
                  title="Borrar búsqueda"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={() => setQ(searchInput.trim())}
                className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-colors cursor-pointer ${
                  searchInput.trim() !== q && searchInput.trim().length > 0
                    ? 'bg-[#442dd7] text-white hover:bg-[#3722b5] shadow-xs'
                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                }`}
                title="Presione Enter o haga clic para buscar"
              >
                ↵ Enter
              </button>
            </div>
          </div>

          {/* Provider Select */}
          <select
            value={prov}
            onChange={e => setProv(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-md border border-[#D5DEE2] bg-[#F5F8F9] text-[#14212A] focus:outline-none focus:ring-1 focus:ring-[#442dd7] cursor-pointer max-w-[200px]"
          >
            <option value="">Todos los proveedores</option>
            {availableProviders.map(p => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          {/* Checkbox WBS D */}
          <label className="flex items-center gap-1.5 text-xs text-[#14212A] cursor-pointer ml-auto select-none">
            <input
              type="checkbox"
              checked={pend}
              onChange={e => setPend(e.target.checked)}
              className="rounded text-[#442dd7] focus:ring-[#442dd7] cursor-pointer"
            />
            <span>Incluir pendientes de regularizar (WBS D)</span>
          </label>
        </div>

        {/* 6. Panel Ruta del Agua */}
        {agua && (
          <div className="bg-white border border-[#2C67A6] rounded-xl p-4 shadow-sm space-y-3 animate-fadeIn">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#D5DEE2] pb-2">
              <span className="font-['Barlow_Condensed'] text-xl font-bold text-[#14212A]">
                Ruta del agua
              </span>
              <span className="text-xs text-[#5A6A74]">
                {Array.from(aSel).length} estructuras seleccionadas · toca una para quitarla o agregarla
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 pt-1">
              {AGUA.map(G => (
                <div key={G.g} className="space-y-1.5">
                  <h3 className="text-[11px] font-bold text-[#2C67A6] uppercase tracking-wider">
                    {G.g}
                  </h3>
                  <p className="text-[11px] text-[#5A6A74] leading-snug">
                    {G.d}
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {G.c.map(([p, c]) => {
                      const k = akey(p, c);
                      const isSel = aSel.has(k);
                      const count = universe.filter(i => akey(i.proc, i.cap) === k).length;
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => {
                            setASel(prev => {
                              const next = new Set(prev);
                              if (next.has(k)) next.delete(k);
                              else next.add(k);
                              return next;
                            });
                          }}
                          className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer text-left ${
                            isSel
                              ? 'bg-[#DDE8F4] border-[#2C67A6] text-[#14212A] font-medium'
                              : 'bg-[#F5F8F9] border-[#D5DEE2] text-[#5A6A74] hover:text-[#14212A]'
                          }`}
                        >
                          <span>{c}</span>
                          {p === P5 && <span className="ml-1 text-[9.5px] text-[#2C67A6]">Progreso</span>}
                          <small className="ml-1 text-[10px] text-slate-400">({count})</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#D5DEE2] text-xs">
              <label className="flex items-center gap-1.5 text-[#14212A] cursor-pointer">
                <input
                  type="checkbox"
                  checked={aCCM}
                  onChange={e => setACCM(e.target.checked)}
                  className="rounded text-[#442dd7] focus:ring-[#442dd7]"
                />
                <span>
                  Excluir los CCM y tableros de las áreas de lodos (CCM 8, 12, 13; PD-GAS, PD-FoG, PD-UTB)
                </span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setASel(ADEF());
                  setACCM(true);
                }}
                className="px-2.5 py-1 text-xs font-semibold border border-[#2C67A6] text-[#2C67A6] rounded hover:bg-[#DDE8F4]/50 transition-colors cursor-pointer"
              >
                Restablecer selección
              </button>
            </div>
          </div>
        )}

        {/* 6b. Active Card Filter Banner (kfb) */}
        {kfbLabel && (
          <div className="bg-[#EEECFB] border border-[#442dd7] rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#14212A] shadow-xs animate-fadeIn">
            <div className="flex items-center gap-2 flex-wrap">
              <span>
                Filtro de tarjetas: <strong>{kfbLabel}</strong> · {finalFiltered.length} de {baseFiltered.length} partidas
              </span>
              <span className="text-[11px] text-[#5A6A74]">Ctrl + clic para combinar</span>
            </div>
            <button
              type="button"
              onClick={() => setKf({})}
              className="px-2.5 py-1 text-xs font-semibold rounded border border-[#442dd7] text-[#442dd7] hover:bg-[#442dd7] hover:text-white transition-colors cursor-pointer"
            >
              Quitar filtro
            </button>
          </div>
        )}

        {/* 7. Groups and Cards List */}
        {finalFiltered.length === 0 ? (
          <div className="bg-white border border-dashed border-[#D5DEE2] rounded-xl p-8 text-center text-[#5A6A74] text-sm">
            {kfAny(kf)
              ? 'Ningún paquete cumple el filtro de las tarjetas en esta selección. Quita el filtro o cambia de proceso.'
              : 'No hay paquetes ni equipos con estos filtros. Prueba con otro proceso o borra la búsqueda.'}
          </div>
        ) : (
          <div className="space-y-3">
            {(() => {
              let curSup: string | null = null;
              const renderedElements: React.ReactNode[] = [];

              groupedCards.forEach(([gk, gl]) => {
                // If banded grouping is active:
                if (supOn) {
                  const sk = getSupKey(gl);
                  if (sk !== curSup) {
                    curSup = sk;
                    const bInfo = bandsMap?.get(sk);
                    const bAgg = bInfo ? agg(bInfo.items) : agg(gl);
                    const isBandOpen = pcolBands.has(sk);

                    renderedElements.push(
                      <div
                        key={`band-${sk}`}
                        onClick={() => handleToggleBand(sk)}
                        className="bg-[#ddd9f8] border border-[#c7c0f3] rounded-xl px-4 py-2 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-[#d2cdf6] transition-colors mt-3 first:mt-0 select-none"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button
                            type="button"
                            className="w-5 h-5 rounded border border-[#c7c0f3] bg-white flex items-center justify-center text-[#5A6A74] text-xs shrink-0"
                          >
                            {isBandOpen ? '▾' : '▸'}
                          </button>
                          <div className="min-w-0">
                            <h2 className="font-['Barlow_Condensed'] font-semibold text-[15px] uppercase tracking-wider text-[#14212A] leading-tight truncate">
                              {sk}
                            </h2>
                            <div className="text-[11px] font-mono text-[#5A6A74]">
                              {bInfo?.capsCount || 1} estructuras · {bAgg.n} partidas · {fq((bInfo?.items ?? gl).reduce((t, it) => t + eqU(it), 0))} equipos
                            </div>
                          </div>
                        </div>

                        {/* 3 stage % bars in band */}
                        <div className="grid grid-cols-3 gap-2 w-full sm:w-[280px] text-[11px] text-[#5A6A74]">
                          <div>
                            <div className="flex justify-between items-baseline mb-0.5">
                              <span>Fabr.</span>
                              <b className="text-[#14212A]">{pc(bAgg.st.D.pv)}</b>
                            </div>
                            <div className="h-1 bg-[#D5DEE2] rounded-full overflow-hidden">
                              <div className="h-full bg-[#A86B12]" style={{ width: `${(bAgg.st.D.pv || 0) * 100}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between items-baseline mb-0.5">
                              <span>Flete</span>
                              <b className="text-[#14212A]">{pc(bAgg.st.E.pv)}</b>
                            </div>
                            <div className="h-1 bg-[#D5DEE2] rounded-full overflow-hidden">
                              <div className="h-full bg-[#2C67A6]" style={{ width: `${(bAgg.st.E.pv || 0) * 100}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between items-baseline mb-0.5">
                              <span>Inst.</span>
                              <b className="text-[#14212A]">{pc(bAgg.st.F.pv)}</b>
                            </div>
                            <div className="h-1 bg-[#D5DEE2] rounded-full overflow-hidden">
                              <div className="h-full bg-[#2B7F52]" style={{ width: `${(bAgg.st.F.pv || 0) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                }

                // If band is collapsed, hide cards within this band
                if (supOn && curSup && !pcolBands.has(curSup)) {
                  return;
                }

                // Render Card
                const isCardOpen = secCards.has(gk);
                const cAgg = agg(gl);
                const cardTitle = group === 'cap' ? gl[0].cap : gk;
                const innerKeyFn =
                  group === 'cap'
                    ? (i: Equipo) => `${i.prov}¦${i.fam}¦${i.und}`
                    : (i: Equipo) => `${i.cap}¦${i.fam}¦${i.und}`;

                // group inner rows
                const rowMap = new Map<string, Equipo[]>();
                for (const it of gl) {
                  const rk = innerKeyFn(it);
                  const arr = rowMap.get(rk);
                  if (!arr) rowMap.set(rk, [it]);
                  else arr.push(it);
                }
                const innerRows = Array.from(rowMap.entries()).sort((a, b) => a[0].localeCompare(b[0], 'es'));

                renderedElements.push(
                  <div
                    key={`card-${gk}`}
                    className={`bg-white border border-[#D5DEE2] rounded-xl overflow-hidden shadow-xs transition-all ${
                      supOn ? 'ml-3 sm:ml-4 border-l-2 border-l-[#442dd7]' : ''
                    }`}
                  >
                    {/* Card Header (clickable) */}
                    <div
                      onClick={() => handleToggleCard(gk)}
                      className={`p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-colors select-none ${
                        isCardOpen ? 'border-b border-[#D5DEE2]' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          type="button"
                          className="w-7 h-7 rounded border border-[#D5DEE2] bg-white flex items-center justify-center text-[#5A6A74] text-xs font-bold shrink-0"
                        >
                          {isCardOpen ? '▾' : '▸'}
                        </button>
                        <div className="min-w-0">
                          <h2 className="font-['Barlow_Condensed'] font-semibold text-lg sm:text-xl text-[#14212A] leading-tight truncate">
                            {cardTitle}
                          </h2>
                          <div className="text-xs text-[#5A6A74] mt-0.5">
                            {group === 'cap' && !supOn && `${Array.from(new Set(gl.map(i => i.proc))).join(' · ')} · `}
                            {cAgg.n} partidas ·{' '}
                            {group === 'cap'
                              ? `${new Set(gl.map(i => i.prov)).size} proveedores`
                              : `${new Set(gl.map(i => i.cap)).size} estructuras`} ·{' '}
                            {fq(gl.reduce((t, it) => t + eqU(it), 0))} equipos
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                        {/* 3 stage % bars in card */}
                        <div className="grid grid-cols-3 gap-2 w-[240px] text-[11px] text-[#5A6A74]">
                          <div>
                            <div className="flex justify-between items-baseline mb-0.5">
                              <span>Fabr.</span>
                              <b className="text-[#14212A]">{pc(cAgg.st.D.pv)}</b>
                            </div>
                            <div className="h-1 bg-[#D5DEE2] rounded-full overflow-hidden">
                              <div className="h-full bg-[#A86B12]" style={{ width: `${(cAgg.st.D.pv || 0) * 100}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between items-baseline mb-0.5">
                              <span>Flete</span>
                              <b className="text-[#14212A]">{pc(cAgg.st.E.pv)}</b>
                            </div>
                            <div className="h-1 bg-[#D5DEE2] rounded-full overflow-hidden">
                              <div className="h-full bg-[#2C67A6]" style={{ width: `${(cAgg.st.E.pv || 0) * 100}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between items-baseline mb-0.5">
                              <span>Inst.</span>
                              <b className="text-[#14212A]">{pc(cAgg.st.F.pv)}</b>
                            </div>
                            <div className="h-1 bg-[#D5DEE2] rounded-full overflow-hidden">
                              <div className="h-full bg-[#2B7F52]" style={{ width: `${(cAgg.st.F.pv || 0) * 100}%` }} />
                            </div>
                          </div>
                        </div>

                        {/* Copiar resumen button */}
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleCopySummary(cardTitle, innerRows);
                          }}
                          className="px-2.5 py-1 text-xs border border-[#D5DEE2] rounded hover:border-[#442dd7] hover:text-[#442dd7] text-[#5A6A74] transition-colors cursor-pointer shrink-0"
                        >
                          Copiar resumen
                        </button>
                      </div>
                    </div>

                    {/* Card Content Table (if expanded) */}
                    {isCardOpen && (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[940px] text-xs text-left border-collapse">
                          <thead className="bg-[#F5F8F9] text-[#5A6A74] uppercase text-[10.5px] font-semibold border-b border-[#D5DEE2]">
                            <tr>
                              <th className="py-2.5 px-3 pl-8">
                                {group === 'cap' ? 'Proveedor · paquete / equipo' : 'Estructura · paquete / equipo'}
                              </th>
                              <th className="py-2.5 px-3 text-right">Partidas</th>
                              <th className="py-2.5 px-3 min-w-[115px]">{STN.D}</th>
                              <th className="py-2.5 px-3 min-w-[115px]">{STN.E}</th>
                              <th className="py-2.5 px-3 min-w-[115px]">{STN.F}</th>
                              <th className="py-2.5 px-3">Fin instalación</th>
                              <th className="py-2.5 px-3">Total Float</th>
                              <th className="py-2.5 px-3">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#D5DEE2]">
                            {innerRows.map(([rk, rl]) => {
                              const rAgg = agg(rl);
                              const [p1, fam] = rk.split('¦');
                              const rowKey = `${gk}¦${rk}`;
                              const isRowOpen = openRows.has(rowKey);
                              const [chipClass, chipBg, chipText] = stateOf(rAgg, mode);
                              const [riskClass, riskText] = riskOf(rAgg.tf);
                              const late = rAgg.maxLate;
                              const subInst =
                                group === 'cap'
                                  ? Array.from(new Set(rl.map(i => i.inst).filter(Boolean)))
                                      .map(x => 'Instala: ' + x)
                                      .join(', ')
                                  : '';

                              return (
                                <React.Fragment key={rowKey}>
                                  <tr
                                    onClick={() => handleToggleRow(rowKey)}
                                    className="hover:bg-[#F5F8F9] cursor-pointer transition-colors"
                                  >
                                    <td className="py-2.5 px-3 pl-8 relative">
                                      <span className="absolute left-3 top-3 text-[#5A6A74] text-[11px]">
                                        {isRowOpen ? '▾' : '▸'}
                                      </span>
                                      <div className="font-semibold text-[#14212A]">
                                        {p1} <span className="font-normal text-[#5A6A74]">·</span> {fam}
                                      </div>
                                      <small className="block text-[#5A6A74] text-[11px] font-normal">
                                        {subInst || Array.from(new Set(rl.map(i => i.scap))).join(', ')}
                                      </small>
                                    </td>

                                    <td className="py-2.5 px-3 text-right font-['IBM_Plex_Mono'] font-medium">
                                      {rl.length}
                                    </td>

                                    {/* Stages D, E, F Cells */}
                                    {STG.map(k => {
                                      const u = rAgg.units[0];
                                      const exQty = (mode === 'done' ? rAgg.st[k].dn[u] : rAgg.st[k].ex[u]) || 0;
                                      const totQty = rAgg.q[u] || 0;
                                      const fracVal = fracs(rAgg, mode)[k];
                                      const colorClass = k === 'D' ? 'bg-[#A86B12]' : k === 'E' ? 'bg-[#2C67A6]' : 'bg-[#2B7F52]';

                                      return (
                                        <td key={k} className="py-2.5 px-3">
                                          <div className="whitespace-nowrap font-['IBM_Plex_Mono'] text-[11.5px]">
                                            <b>{fq(exQty)}</b>
                                            <span className="text-[#5A6A74]"> / {fq(totQty)} {u}</span>
                                          </div>
                                          <div className="h-1 bg-[#D5DEE2] rounded-full overflow-hidden mt-1 max-w-[100px]">
                                            <div
                                              className={`h-full ${colorClass}`}
                                              style={{ width: `${Math.min(100, Math.max(0, fracVal * 100))}%` }}
                                            />
                                          </div>
                                        </td>
                                      );
                                    })}

                                    {/* Fin instalación */}
                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                      <div className="font-['IBM_Plex_Mono'] text-[11.5px] font-medium">
                                        {fd(rAgg.fin)}
                                      </div>
                                      <span className="block text-[10.5px] text-[#5A6A74]">
                                        LB {fd(rAgg.blf)}
                                        {late != null && late !== 0 && (
                                          <>
                                            {' '}·{' '}
                                            <b className={late > 0 ? 'text-[#B83227] font-semibold' : 'text-[#2B7F52] font-semibold'}>
                                              {late > 0 ? `+${late}` : late} d
                                            </b>
                                          </>
                                        )}
                                      </span>
                                    </td>

                                    {/* Total Float */}
                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                      <span className={`text-xs font-semibold ${riskClass}`}>
                                        {isN(rAgg.tf) ? `${rAgg.tf} d · ` : ''}
                                        {riskText}
                                      </span>
                                    </td>

                                    {/* Estado */}
                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                      <span
                                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${chipBg}`}
                                      >
                                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                        <span>{chipText}</span>
                                      </span>
                                    </td>
                                  </tr>

                                  {/* Row Detail Table (items in this row) */}
                                  {isRowOpen && (
                                    <tr className="bg-[#F5F8F9]">
                                      <td colSpan={8} className="p-3 pl-8">
                                        <div className="bg-white border border-[#D5DEE2] rounded-lg overflow-x-auto shadow-xs">
                                          <table className="w-full min-w-[920px] text-xs text-left border-collapse">
                                            <thead className="bg-[#EEF2F3] text-[#5A6A74] text-[10.5px] font-semibold border-b border-[#D5DEE2]">
                                              <tr>
                                                <th className="py-2 px-3">Activity ID</th>
                                                <th className="py-2 px-3">Paquete / Equipo</th>
                                                <th className="py-2 px-3 text-right">Cant.</th>
                                                <th className="py-2 px-3">Fabricación (.D)</th>
                                                <th className="py-2 px-3">Flete (.E)</th>
                                                <th className="py-2 px-3">Instalación (.F)</th>
                                                <th className="py-2 px-3">Fin esperado .F</th>
                                                <th className="py-2 px-3">LB .F</th>
                                                <th className="py-2 px-3 text-right">Retraso</th>
                                                <th className="py-2 px-3 text-right">TF pend.</th>
                                                <th className="py-2 px-3">Contrato</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#D5DEE2]">
                                              {rl.map(it => {
                                                const F = it.s.F;
                                                const tfs = STG.filter(k => !it.s[k].done && isN(it.s[k].tf) && it.s[k].tf < 400).map(
                                                  k => it.s[k].tf as number
                                                );
                                                const minTf = tfs.length ? Math.min(...tfs) : null;
                                                const [rCls] = riskOf(minTf);
                                                const itemLate = F.done ? null : dd(F.fin, F.blf);

                                                return (
                                                  <tr key={it.base} className="hover:bg-slate-50 transition-colors">
                                                    <td className="py-2 px-3 font-['IBM_Plex_Mono'] text-[11.5px] text-[#442dd7] font-semibold">
                                                      {it.base}
                                                    </td>
                                                    <td className="py-2 px-3 max-w-[260px]">
                                                      <span className="font-medium text-[#14212A] block leading-snug">
                                                        {it.desc}
                                                      </span>
                                                      {it.pend && (
                                                        <span className="inline-block mt-0.5 text-[10px] font-bold text-[#C9701E] border border-[#C9701E] px-1 py-0.2 rounded-xs">
                                                          WBS D
                                                        </span>
                                                      )}
                                                      {it.valv && (
                                                        <span
                                                          className="inline-block mt-0.5 ml-1 text-[10.5px] font-semibold text-[#C9701E] border border-[#C9701E] px-1 py-0.5 rounded whitespace-nowrap"
                                                          title="Rubro .p6 de válvulas sin desglose D/E/F: suministro e instalación en una sola actividad; su avance se aplica igual a las 3 etapas"
                                                        >
                                                          S+I · {it.nv} partidas
                                                        </span>
                                                      )}
                                                      {it.valv && it.provs && (
                                                        <div className="text-[11.5px] text-[#5A6A74] mt-0.5">
                                                          {it.provs}
                                                        </div>
                                                      )}
                                                      {it.inst && (
                                                        <div className="text-[10.5px] text-[#5A6A74]">
                                                          Instala: {it.inst}
                                                        </div>
                                                      )}
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-['IBM_Plex_Mono']">
                                                      {fq(it.qty)} {it.und}
                                                    </td>

                                                    {/* Stages D, E, F Dots and Status */}
                                                    {STG.map(k => {
                                                      const s = it.s[k];
                                                      const dotFilled = s.done;
                                                      const dotHalf = (s.ex || 0) > 0 || s.status === 'In Progress';
                                                      const dotColor =
                                                        k === 'D' ? 'text-[#A86B12]' : k === 'E' ? 'text-[#2C67A6]' : 'text-[#2B7F52]';

                                                      return (
                                                        <td key={k} className="py-2 px-3 whitespace-nowrap">
                                                          <div className={`flex items-center gap-1.5 ${dotColor} text-[11px]`}>
                                                            <span
                                                              className={`w-2 h-2 rounded-full border border-current shrink-0 ${
                                                                dotFilled ? 'bg-current' : dotHalf ? 'bg-current/40' : 'bg-transparent'
                                                              }`}
                                                            />
                                                            <span className="font-['IBM_Plex_Mono'] text-[#14212A]">
                                                              {s.missing ? '—' : `${fq(s.ex)}/${fq(it.qty)}`}
                                                            </span>
                                                            <small className="text-[#5A6A74] text-[10px]">
                                                              {s.status ? `· ${s.status}` : ''}
                                                            </small>
                                                          </div>
                                                        </td>
                                                      );
                                                    })}

                                                    <td className="py-2 px-3 whitespace-nowrap font-['IBM_Plex_Mono'] text-[11px]">
                                                      {fd(F.fin)}
                                                      {F.finA ? ' A' : ''}
                                                    </td>
                                                    <td className="py-2 px-3 whitespace-nowrap font-['IBM_Plex_Mono'] text-[11px] text-[#5A6A74]">
                                                      {fd(F.blf)}
                                                    </td>
                                                    <td
                                                      className={`py-2 px-3 text-right font-['IBM_Plex_Mono'] font-semibold ${
                                                        itemLate == null
                                                          ? 'text-[#5A6A74]'
                                                          : itemLate > 0
                                                          ? 'text-[#B83227]'
                                                          : 'text-[#2B7F52]'
                                                      }`}
                                                    >
                                                      {itemLate == null ? '—' : `${itemLate > 0 ? '+' : ''}${itemLate} d`}
                                                    </td>
                                                    <td className="py-2 px-3 text-right whitespace-nowrap">
                                                      <span className={`text-[11px] font-['IBM_Plex_Mono'] font-semibold ${rCls}`}>
                                                        {minTf == null ? '—' : `${minTf} d`}
                                                      </span>
                                                    </td>
                                                    <td className="py-2 px-3 font-['IBM_Plex_Mono'] text-[11px] text-[#5A6A74]">
                                                      {it.contrato || 'Original'}
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              });

              return renderedElements;
            })()}
          </div>
        )}

        {/* 8. (new) Desplegable Cambios Recientes */}
        <details className="bg-white border border-[#D5DEE2] rounded-xl p-3.5 text-xs text-[#14212A] shadow-xs">
          <summary className="font-bold cursor-pointer flex items-center gap-1.5 select-none text-sm text-[#14212A]">
            <span>Cambios recientes</span>
            <span className="font-['IBM_Plex_Mono'] text-[11px] font-bold text-[#C9701E] bg-[#F6E9D3] px-1.5 py-0.2 rounded">
              (new)
            </span>
          </summary>
          <ul className="mt-2.5 pl-4 list-disc space-y-1 text-[#5A6A74] text-xs">
            <li>
              <strong className="text-[#C9701E] font-['IBM_Plex_Mono']">(new) v18</strong>: Sin cables ni conductores: las partidas de cable, conductor, fibra óptica, patch cord y pigtail quedan fuera, estén en m o en u.
            </li>
            <li>
              <strong className="text-[#C9701E] font-['IBM_Plex_Mono']">(new) v19</strong>: Filtro Tipo de equipo (columna Componente) entre las pestañas y las tarjetas; Ctrl + clic combina.
            </li>
            <li>
              <strong className="text-[#C9701E] font-['IBM_Plex_Mono']">(new) v20</strong>: Botón Limpiar filtros junto a Actualizar Master.
            </li>
            <li>
              <strong className="text-[#C9701E] font-['IBM_Plex_Mono']">(new) v21</strong>: Modo Partidas no terminadas, lo opuesto a Partidas terminadas.
            </li>
            <li>
              <strong className="text-[#C9701E] font-['IBM_Plex_Mono']">(new) v22</strong>: Los botones de las 4 tarjetas también filtran los conteos de Tipo de equipo, Subtipo y Subcontratista.
            </li>
            <li>
              <strong className="text-[#C9701E] font-['IBM_Plex_Mono']">(new) v23–v27</strong>: Fila Subtipo (SCAP) debajo de Tipo de equipo, con el mismo formato: máximo 7 botones sin filtros y en una sola línea, "+N más" pegado al último visible, y Partidas no terminadas no cuenta como filtro para ese límite.
            </li>
            <li>
              <strong className="text-[#C9701E] font-['IBM_Plex_Mono']">(new) v32</strong>: Válvulas: solo entran los rubros con &quot;.p6&quot; en el Activity ID y SCAP Válvulas (40 rubros con cantidad). Cada rubro es una partida; sus equipos = Cantidad del rubro o, si viene vacía, la suma de las partidas en u con SCAP Válvulas cuyo WBS (columna A) es ese .p6 (por ejemplo 3.2.8.p6 = 146). Estado, fechas y Float del rubro; el avance se aplica igual a las 3 etapas. Reemplaza a v31, que listaba cada partida de válvula.
            </li>
            <li>
              <strong className="text-[#C9701E] font-['IBM_Plex_Mono']">(new) v30</strong>: Fila Subcontratista (SubC, columna SubC del Master) debajo de Subtipo (SCAP), con el mismo formato (máx. 7, una línea, "+N más") y filtro cruzado con las demás filas y tarjetas.
            </li>
            <li>
              <strong className="text-[#C9701E] font-['IBM_Plex_Mono']">(new) v28–v29</strong>: Diferencia en positivo junto al total de equipos en las 3 tarjetas de etapa (por ejemplo 1.543,9 / 3.291 equipos 1.747,1).
            </li>
          </ul>
        </details>

        {/* 9. Desplegable Cómo se calcula */}
        <details className="bg-white border border-[#D5DEE2] rounded-xl p-3.5 text-xs text-[#14212A] shadow-xs">
          <summary className="font-bold cursor-pointer text-sm text-[#14212A] select-none">
            Cómo se calcula
          </summary>
          <ul className="mt-2.5 pl-4 list-disc space-y-1.5 text-[#5A6A74] text-xs">
            <li>
              <strong>Universo:</strong> partidas del Master (pestaña cdo) con Grupos 02.Procura_Eq., 03.Flete_Eq. y 04.Precom_Eq.; cada paquete/equipo es un Activity ID base con sus tres actividades .D (compra y fabricación), .E (flete a obra) y .F (instalación y pruebas).
            </li>
            <li>
              <strong>Total =</strong> columna Cantidad. Ejecutado por etapa = Cantidad Ex (si falta, % Ex × Cantidad). En compra y fabricación la Cantidad Ex refleja el avance por hitos de pago: 3 u al 90 % se leen como 2,7 u. El modo "Partidas terminadas" muestra solo los paquetes con al menos una etapa terminada (Completed en P6 o % Ex de 100 %) y cuenta únicamente la cantidad de las etapas terminadas.
            </li>
            <li>
              Todo sale del Master (pestaña cdo): estado = columna p6; fechas = Start y Finish (reales si el estado es Completed, o el inicio si es In Progress); línea base = blFinish; holgura = Float.
            </li>
            <li>
              <strong>Válvulas sin desglose (v32):</strong> además de los equipos .D/.E/.F, se incluyen los rubros con &quot;.p6&quot; en el Activity ID y SCAP Válvulas (suministro e instalación en una sola actividad). Equipos del rubro = su Cantidad o, si está vacía, la suma de las partidas en u con SCAP Válvulas cuyo WBS (columna A) es ese .p6; lo mismo para Cantidad Ex. El estado (columna p6), las fechas y el Float son los del rubro, y su avance cuenta igual en las 3 etapas. El proveedor es el SubC con más unidades dentro del rubro.
            </li>
            <li>
              <strong>Cables y conductores</strong> no son equipos y quedan fuera de todo el aplicativo, estén en m o en u: conductores aislados, cables de cobre, alimentadores, fibra óptica, patch cords, pigtails y puntos de cableado.
            </li>
            <li>
              <strong>Tipo de equipo:</strong> los botones bajo las pestañas filtran por la columna Componente del Master (Civil, Tuberías, Mecánico, Eléctrico, I&amp;C). Se toma el de la actividad .D. Un clic deja un solo tipo y Ctrl + clic combina varios. El filtro afecta a las tarjetas y a la lista, no a las pestañas.
            </li>
            <li>
              <strong>Modo "Partidas no terminadas":</strong> es lo opuesto a "Partidas terminadas". Muestra solo las partidas con alguna etapa en curso o sin iniciar (no Completed y % Ex menor a 100 %) y deja fuera los paquetes ya terminados en las tres etapas. Las cantidades se muestran con Cantidad Ex, igual que en el modo Cantidad Ex.
            </li>
            <li>
              <strong>Subtipo (SCAP):</strong> debajo de Tipo de equipo, un botón por valor de la columna SCAP (el de la actividad .D), ordenados por número de equipos. Sin otros filtros activos se ven como máximo 7 botones, con "+N más" para ver el resto.
            </li>
            <li>
              <strong>Tarjetas superiores:</strong> cuentan equipos físicos. Una partida en u aporta su Cantidad (6 partidas de compuertas = 18 compuertas); una en glb aporta 1 conjunto; las partidas de material en m, kg, ton o m² no se cuentan.
            </li>
            <li>
              <strong>Filtro de tarjetas:</strong> los botones Terminados, En curso y Sin iniciar de cada etapa, y Total Float ≤ 0, filtran las tarjetas de abajo y también las otras tarjetas superiores. Cada tarjeta se calcula con los filtros de las demás, así que sus propios botones siguen mostrando su distribución completa.
            </li>
            <li>
              <strong>Riesgo por Total Float</strong> de la etapa pendiente más próxima: ≤ 0 Crítico, 1 a 20 Alto, 21 a 30 Moderado, más de 30 Moderado-Bajo. Retraso = fin esperado − fin de línea base de la instalación.
            </li>
            <li>
              <strong>Botón Agua:</strong> filtra las estructuras de la ruta hidráulica (afluente e ingreso, pretratamiento, tratamiento primario) y la energía que las alimenta, sin las áreas de lodos.
            </li>
          </ul>
        </details>
      </main>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-4 right-4 z-50 bg-[#14212A] text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-lg animate-fadeIn">
          {toastMsg}
        </div>
      )}
    </div>
  );
};
