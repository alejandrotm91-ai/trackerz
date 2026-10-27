/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface TipologiaResumenProps {
  stats: any;
  componenteSeleccionado?: string | null;
  setComponenteSeleccionado?: (v: string | null) => void;
  tipologiaSeleccionada?: string | null;
  setTipologiaSeleccionada?: (v: string | null) => void;
}

interface ComponenteDef {
  key: string;
  name: string;
  icon: string;
  barColor: string;
  match: (name: string) => boolean;
}

export const TipologiaResumen: React.FC<TipologiaResumenProps> = ({
  stats,
  componenteSeleccionado,
  setComponenteSeleccionado,
  tipologiaSeleccionada,
  setTipologiaSeleccionada
}) => {
  if (!stats) return null;

  const isComponenteMode = componenteSeleccionado !== undefined || (stats.componentes && stats.componentes.length > 0 && !tipologiaSeleccionada);
  const rawItems: any[] = isComponenteMode 
    ? (stats.componentes || []) 
    : (stats.tipologias || []);

  const activeFilter = isComponenteMode ? componenteSeleccionado : tipologiaSeleccionada;

  // Definitions for Card 1 (Left): Civil, Tuberias, Urbanismo, PMA
  const grupo1Defs: ComponenteDef[] = [
    {
      key: 'civil',
      name: 'Civil',
      icon: '🏗️',
      barColor: 'bg-blue-600',
      match: (n) => {
        const s = n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return s.includes('civil') || s.startsWith('01.');
      }
    },
    {
      key: 'tuberias',
      name: 'Tuberías',
      icon: '🚰',
      barColor: 'bg-teal-600',
      match: (n) => {
        const s = n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return s.includes('tuberia') || s.includes('piping') || s.includes('ducto');
      }
    },
    {
      key: 'urbanismo',
      name: 'Urbanismo',
      icon: '🏘️',
      barColor: 'bg-emerald-600',
      match: (n) => {
        const s = n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return s.includes('urbanis') || s.includes('vial') || s.includes('movimiento de tierra') || s.includes('plataforma');
      }
    },
    {
      key: 'pma',
      name: 'PMA',
      icon: '🌿',
      barColor: 'bg-green-600',
      match: (n) => {
        const s = n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return s.includes('pma') || s.includes('medio ambiente') || s.includes('ambiental') || s.includes('social');
      }
    }
  ];

  // Definitions for Card 2 (Right): Mecanico, Electrico, I&C, Ingenieria, Puesta en Marcha
  const grupo2Defs: ComponenteDef[] = [
    {
      key: 'mecanico',
      name: 'Mecánico',
      icon: '⚙️',
      barColor: 'bg-purple-600',
      match: (n) => {
        const s = n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return s.includes('mecanic') || s.startsWith('03.');
      }
    },
    {
      key: 'electrico',
      name: 'Eléctrico',
      icon: '⚡',
      barColor: 'bg-amber-500',
      match: (n) => {
        const s = n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return s.includes('electric') || s.startsWith('04.');
      }
    },
    {
      key: 'ic',
      name: 'I&C',
      icon: '📡',
      barColor: 'bg-cyan-600',
      match: (n) => {
        const s = n.toLowerCase();
        return s.includes('i&c') || s.includes('instrumentaci') || s.includes('control') || s.startsWith('05.');
      }
    },
    {
      key: 'ingenieria',
      name: 'Ingeniería',
      icon: '📐',
      barColor: 'bg-indigo-600',
      match: (n) => {
        const s = n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return s.includes('ingenier') || s.includes('engineering') || s.startsWith('00.');
      }
    },
    {
      key: 'puesta_en_marcha',
      name: 'Puesta en Marcha',
      icon: '🚀',
      barColor: 'bg-rose-600',
      match: (n) => {
        const s = n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return s.includes('puesta en marcha') || s.includes('marcha') || s.includes('comision') || s.includes('commissioning') || s.startsWith('08.');
      }
    }
  ];

  // Helper to map and aggregate rows for each definition group
  const matchedItemNames = new Set<string>();

  const buildGroupRows = (defs: ComponenteDef[]) => {
    return defs.map(def => {
      const matchingItems = rawItems.filter(item => {
        const name = (item.nombre || '').trim();
        return def.match(name);
      });

      matchingItems.forEach(item => matchedItemNames.add(item.nombre));

      const itemsCount = matchingItems.reduce((acc, it) => acc + (Number(it.items) || 0), 0);
      const venta = matchingItems.reduce((acc, it) => acc + (Number(it.venta) || 0), 0);
      const ventaEjecutada = matchingItems.reduce((acc, it) => acc + (Number(it.ventaEjecutada) || 0), 0);
      const saldo = matchingItems.reduce((acc, it) => acc + (Number(it.saldo) || 0), 0);
      const avanceNum = venta > 0 ? (ventaEjecutada / venta) * 100 : 0;
      const avance = avanceNum.toFixed(2);

      // Best label: use exact real name if single match, else fallback to standard def name
      const displayName = matchingItems.length === 1 ? matchingItems[0].nombre : def.name;
      const primaryKey = matchingItems.length > 0 ? matchingItems[0].nombre : def.name;
      const filterKeys = matchingItems.map(it => it.nombre);

      return {
        def,
        displayName,
        primaryKey,
        filterKeys,
        itemsCount,
        venta,
        ventaEjecutada,
        saldo,
        avance,
        avanceNum
      };
    });
  };

  const rowsGrupo1 = buildGroupRows(grupo1Defs);
  const rowsGrupo2 = buildGroupRows(grupo2Defs);

  // Unmatched items from project dataset (if any) to ensure 100% financial fidelity
  const unmatchedItems = rawItems.filter(item => !matchedItemNames.has(item.nombre));

  // Compute subtotals for each card
  const computeSubtotal = (rows: any[], extraItems: any[] = []) => {
    const totalItems = rows.reduce((a, r) => a + r.itemsCount, 0) +
      extraItems.reduce((a, it) => a + (Number(it.items) || 0), 0);
    const totalVenta = rows.reduce((a, r) => a + r.venta, 0) +
      extraItems.reduce((a, it) => a + (Number(it.venta) || 0), 0);
    const totalEjecutada = rows.reduce((a, r) => a + r.ventaEjecutada, 0) +
      extraItems.reduce((a, it) => a + (Number(it.ventaEjecutada) || 0), 0);
    const totalSaldo = rows.reduce((a, r) => a + r.saldo, 0) +
      extraItems.reduce((a, it) => a + (Number(it.saldo) || 0), 0);
    const avanceNum = totalVenta > 0 ? (totalEjecutada / totalVenta) * 100 : 0;
    const avance = avanceNum.toFixed(2);

    return {
      totalItems,
      totalVenta,
      totalEjecutada,
      totalSaldo,
      avance,
      avanceNum
    };
  };

  const subtotal1 = computeSubtotal(rowsGrupo1);
  const subtotal2 = computeSubtotal(rowsGrupo2, unmatchedItems);

  const formatInM = (num: number) => {
    if (!num && num !== 0) return '$0.00M';
    return `$${(num / 1000000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
  };

  const handleRowClick = (primaryKey: string, filterKeys: string[]) => {
    if (isComponenteMode && setComponenteSeleccionado) {
      if (activeFilter && (activeFilter === primaryKey || filterKeys.includes(activeFilter))) {
        setComponenteSeleccionado(null);
      } else {
        setComponenteSeleccionado(primaryKey);
      }
    } else if (setTipologiaSeleccionada) {
      if (activeFilter && (activeFilter === primaryKey || filterKeys.includes(activeFilter))) {
        setTipologiaSeleccionada(null);
      } else {
        setTipologiaSeleccionada(primaryKey);
      }
    }
  };

  const handleClearFilter = () => {
    if (isComponenteMode && setComponenteSeleccionado) {
      setComponenteSeleccionado(null);
    } else if (setTipologiaSeleccionada) {
      setTipologiaSeleccionada(null);
    }
  };

  const isRowActive = (primaryKey: string, filterKeys: string[]) => {
    if (!activeFilter) return false;
    return activeFilter === primaryKey || filterKeys.includes(activeFilter);
  };

  return (
    <div id="tipologia-resumen-box" className="bg-white p-2 mb-4">
      {/* Top Banner with Clear Filter action if active */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <h3 className="text-xs font-black text-indigo-950 uppercase tracking-wider">
            ANÁLISIS DE AVANCE POR COMPONENTES
          </h3>
          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
            Vista en 2 Tablas Unificadas
          </span>
        </div>
        {activeFilter && (
          <button
            type="button"
            onClick={handleClearFilter}
            className="text-[10.5px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1 rounded-lg border border-rose-200 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <span>✕ Quitar filtro:</span>
            <span className="font-extrabold max-w-[200px] truncate">{activeFilter}</span>
          </button>
        )}
      </div>

      {/* Grid: Exactly 2 Cards with Unified Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ========================================================= */}
        {/* TARJETA 1 (IZQUIERDA): Civil, Tuberías, Urbanismo, PMA */}
        {/* ========================================================= */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            {/* Card Header */}
            <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-base">🏗️</span>
                <div>
                  <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wide">
                    Civil • Tuberías • Urbanismo • PMA
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Infraestructura, movimiento de tierras y entorno
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[11px] font-mono font-black text-indigo-900 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md">
                  Avance {subtotal1.avance}%
                </span>
              </div>
            </div>

            {/* Unified Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Componente</th>
                    <th className="py-2.5 px-2 text-center">Acts</th>
                    <th className="py-2.5 px-2.5 text-right">Plan</th>
                    <th className="py-2.5 px-2.5 text-right">Ejecutado</th>
                    <th className="py-2.5 px-2.5 text-right">Saldo</th>
                    <th className="py-2.5 px-3 text-right">% Avance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rowsGrupo1.map((row) => {
                    const active = isRowActive(row.primaryKey, row.filterKeys);
                    return (
                      <tr
                        key={row.def.key}
                        onClick={() => handleRowClick(row.primaryKey, row.filterKeys)}
                        className={`transition-colors cursor-pointer select-none ${
                          active
                            ? 'bg-blue-50/90 text-blue-950 font-semibold'
                            : 'hover:bg-slate-50/90 text-slate-700'
                        }`}
                      >
                        {/* Componente Name & Emoji */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm shrink-0">{row.def.icon}</span>
                            <span className="font-semibold text-slate-900 truncate max-w-[140px] sm:max-w-[170px]" title={row.displayName}>
                              {row.displayName}
                            </span>
                            {active && (
                              <span className="text-[9px] font-bold text-blue-700 bg-blue-100 border border-blue-200 px-1.5 py-0.2 rounded shrink-0">
                                Activo
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Acts count */}
                        <td className="py-2.5 px-2 text-center">
                          <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                            {row.itemsCount}
                          </span>
                        </td>

                        {/* Plan */}
                        <td className="py-2.5 px-2.5 text-right font-mono text-[11px] text-slate-700 font-medium">
                          {formatInM(row.venta)}
                        </td>

                        {/* Ejecutado */}
                        <td className="py-2.5 px-2.5 text-right font-mono text-[11px] text-emerald-600 font-bold">
                          {formatInM(row.ventaEjecutada)}
                        </td>

                        {/* Saldo */}
                        <td className="py-2.5 px-2.5 text-right font-mono text-[11px] text-indigo-950 font-medium">
                          {formatInM(row.saldo)}
                        </td>

                        {/* % Avance & Progress Bar */}
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-mono font-bold text-[11px] text-slate-800 w-11 text-right">
                              {row.avance}%
                            </span>
                            <div className="w-14 sm:w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0 border border-slate-200/40">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${row.def.barColor}`}
                                style={{ width: `${Math.min(row.avanceNum, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Subtotal Row / Footer inside table for exact column alignment */}
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50/95 font-bold text-slate-800">
                    <td className="py-2.5 px-3">
                      <span className="text-[10.5px] uppercase tracking-wider text-slate-600 font-extrabold">
                        Subtotal Grupo 1
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className="text-[10px] font-mono text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200 font-bold">
                        {subtotal1.totalItems}
                      </span>
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono text-[11px] text-slate-800 font-bold">
                      {formatInM(subtotal1.totalVenta)}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono text-[11px] text-emerald-700 font-bold">
                      {formatInM(subtotal1.totalEjecutada)}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono text-[11px] text-indigo-950 font-bold">
                      {formatInM(subtotal1.totalSaldo)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-mono font-black text-[11px] text-blue-700 w-11 text-right">
                          {subtotal1.avance}%
                        </span>
                        <div className="w-14 sm:w-16 h-1.5 bg-slate-200/80 rounded-full overflow-hidden shrink-0 border border-slate-300/50">
                          <div
                            className="h-full rounded-full transition-all duration-300 bg-blue-600"
                            style={{ width: `${Math.min(subtotal1.avanceNum, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TARJETA 2 (DERECHA): Mecánico, Eléctrico, I&C, Ingeniería, Puesta en Marcha */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            {/* Card Header */}
            <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-base">⚙️</span>
                <div>
                  <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wide">
                    Mecánico • Eléctrico • I&C • Ing. • P. Marcha
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Montaje electromecánico, control y comisionamiento
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[11px] font-mono font-black text-indigo-900 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md">
                  Avance {subtotal2.avance}%
                </span>
              </div>
            </div>

            {/* Unified Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Componente</th>
                    <th className="py-2.5 px-2 text-center">Acts</th>
                    <th className="py-2.5 px-2.5 text-right">Plan</th>
                    <th className="py-2.5 px-2.5 text-right">Ejecutado</th>
                    <th className="py-2.5 px-2.5 text-right">Saldo</th>
                    <th className="py-2.5 px-3 text-right">% Avance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rowsGrupo2.map((row) => {
                    const active = isRowActive(row.primaryKey, row.filterKeys);
                    return (
                      <tr
                        key={row.def.key}
                        onClick={() => handleRowClick(row.primaryKey, row.filterKeys)}
                        className={`transition-colors cursor-pointer select-none ${
                          active
                            ? 'bg-purple-50/90 text-purple-950 font-semibold'
                            : 'hover:bg-slate-50/90 text-slate-700'
                        }`}
                      >
                        {/* Componente Name & Emoji */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm shrink-0">{row.def.icon}</span>
                            <span className="font-semibold text-slate-900 truncate max-w-[140px] sm:max-w-[170px]" title={row.displayName}>
                              {row.displayName}
                            </span>
                            {active && (
                              <span className="text-[9px] font-bold text-purple-700 bg-purple-100 border border-purple-200 px-1.5 py-0.2 rounded shrink-0">
                                Activo
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Acts count */}
                        <td className="py-2.5 px-2 text-center">
                          <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                            {row.itemsCount}
                          </span>
                        </td>

                        {/* Plan */}
                        <td className="py-2.5 px-2.5 text-right font-mono text-[11px] text-slate-700 font-medium">
                          {formatInM(row.venta)}
                        </td>

                        {/* Ejecutado */}
                        <td className="py-2.5 px-2.5 text-right font-mono text-[11px] text-emerald-600 font-bold">
                          {formatInM(row.ventaEjecutada)}
                        </td>

                        {/* Saldo */}
                        <td className="py-2.5 px-2.5 text-right font-mono text-[11px] text-indigo-950 font-medium">
                          {formatInM(row.saldo)}
                        </td>

                        {/* % Avance & Progress Bar */}
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-mono font-bold text-[11px] text-slate-800 w-11 text-right">
                              {row.avance}%
                            </span>
                            <div className="w-14 sm:w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0 border border-slate-200/40">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${row.def.barColor}`}
                                style={{ width: `${Math.min(row.avanceNum, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Optional: Unmatched items if present in project */}
                  {unmatchedItems.length > 0 && unmatchedItems.map((item, idx) => {
                    const active = activeFilter === item.nombre;
                    return (
                      <tr
                        key={`unmatched-${idx}`}
                        onClick={() => handleRowClick(item.nombre, [item.nombre])}
                        className={`transition-colors cursor-pointer select-none ${
                          active
                            ? 'bg-slate-100/90 text-slate-900 font-semibold'
                            : 'hover:bg-slate-50/90 text-slate-600'
                        }`}
                      >
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm shrink-0">📦</span>
                            <span className="font-medium text-slate-700 truncate max-w-[140px]" title={item.nombre}>
                              {item.nombre}
                            </span>
                            {active && (
                              <span className="text-[9px] font-bold text-slate-700 bg-slate-200 px-1 rounded shrink-0">
                                Activo
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-[10px] text-slate-500">
                          {item.items}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-[11px] text-slate-700">
                          {formatInM(item.venta)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-[11px] text-emerald-600 font-bold">
                          {formatInM(item.ventaEjecutada)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-[11px] text-indigo-950">
                          {formatInM(item.saldo)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-mono font-bold text-[11px] text-slate-800 w-11 text-right">
                              {item.avance}%
                            </span>
                            <div className="w-14 sm:w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0 border border-slate-200/40">
                              <div
                                className="h-full rounded-full transition-all duration-300 bg-slate-500"
                                style={{ width: `${Math.min(Number(item.avance) || 0, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Subtotal Row / Footer inside table for exact column alignment */}
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50/95 font-bold text-slate-800">
                    <td className="py-2.5 px-3">
                      <span className="text-[10.5px] uppercase tracking-wider text-slate-600 font-extrabold">
                        Subtotal Grupo 2
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className="text-[10px] font-mono text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200 font-bold">
                        {subtotal2.totalItems}
                      </span>
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono text-[11px] text-slate-800 font-bold">
                      {formatInM(subtotal2.totalVenta)}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono text-[11px] text-emerald-700 font-bold">
                      {formatInM(subtotal2.totalEjecutada)}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono text-[11px] text-indigo-950 font-bold">
                      {formatInM(subtotal2.totalSaldo)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-mono font-black text-[11px] text-purple-700 w-11 text-right">
                          {subtotal2.avance}%
                        </span>
                        <div className="w-14 sm:w-16 h-1.5 bg-slate-200/80 rounded-full overflow-hidden shrink-0 border border-slate-300/50">
                          <div
                            className="h-full rounded-full transition-all duration-300 bg-purple-600"
                            style={{ width: `${Math.min(subtotal2.avanceNum, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ComponenteResumen = TipologiaResumen;
