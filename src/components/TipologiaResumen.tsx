/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface TipologiaResumenProps {
  stats: any;
  tipologiaSeleccionada: string | null;
  setTipologiaSeleccionada: (v: string | null) => void;
}

export const TipologiaResumen: React.FC<TipologiaResumenProps> = ({
  stats,
  tipologiaSeleccionada,
  setTipologiaSeleccionada
}) => {
  if (!stats) return null;

  // Color mapper to match the exact look of the old cards in the screenshot
  const getCardColors = (index: number) => {
    const palettes = [
      // OBRA CIVIL - Blue
      {
        border: 'border-blue-200 hover:border-blue-400',
        borderSelected: 'border-blue-600 ring-2 ring-blue-600 ring-offset-1',
        bg: 'bg-blue-50/10',
        text: 'text-blue-800',
        barBg: 'bg-blue-100',
        barFill: 'bg-blue-600',
        shadow: 'shadow-[0_2px_8px_-3px_rgba(59,130,246,0.12)]'
      },
      // EQUIPO MECANIC - Purple
      {
        border: 'border-purple-200 hover:border-purple-400',
        borderSelected: 'border-purple-600 ring-2 ring-purple-600 ring-offset-1',
        bg: 'bg-purple-50/10',
        text: 'text-purple-800',
        barBg: 'bg-purple-100',
        barFill: 'bg-purple-600',
        shadow: 'shadow-[0_2px_8px_-3px_rgba(147,51,234,0.12)]'
      },
      // EQUIPO ELECTRIC - Orange/Amber
      {
        border: 'border-amber-200 hover:border-amber-400',
        borderSelected: 'border-amber-600 ring-2 ring-amber-600 ring-offset-1',
        bg: 'bg-amber-50/10',
        text: 'text-amber-700',
        barBg: 'bg-amber-100',
        barFill: 'bg-amber-600',
        shadow: 'shadow-[0_2px_8px_-3px_rgba(245,158,11,0.12)]'
      },
      // EQUIPO MECANI... - Yellow
      {
        border: 'border-yellow-200 hover:border-yellow-400',
        borderSelected: 'border-yellow-600 ring-2 ring-yellow-600 ring-offset-1',
        bg: 'bg-yellow-50/10',
        text: 'text-yellow-700',
        barBg: 'bg-yellow-100',
        barFill: 'bg-yellow-600',
        shadow: 'shadow-[0_2px_8px_-3px_rgba(234,179,8,0.12)]'
      },
      // TUBERIA PATIO - Teal/Cyan
      {
        border: 'border-cyan-200 hover:border-cyan-400',
        borderSelected: 'border-cyan-600 ring-2 ring-cyan-600 ring-offset-1',
        bg: 'bg-cyan-50/10',
        text: 'text-cyan-800',
        barBg: 'bg-cyan-100',
        barFill: 'bg-cyan-600',
        shadow: 'shadow-[0_2px_8px_-3px_rgba(6,182,212,0.12)]'
      },
      // INSTRUMEN Y... - Pink/Rose
      {
        border: 'border-pink-200 hover:border-pink-400',
        borderSelected: 'border-pink-600 ring-2 ring-pink-600 ring-offset-1',
        bg: 'bg-pink-50/10',
        text: 'text-pink-850',
        barBg: 'bg-pink-100',
        barFill: 'bg-pink-600',
        shadow: 'shadow-[0_2px_8px_-3px_rgba(236,72,153,0.12)]'
      },
      // PRELIMIN... - Slate
      {
        border: 'border-slate-300 hover:border-slate-500',
        borderSelected: 'border-slate-700 ring-2 ring-slate-700 ring-offset-1',
        bg: 'bg-slate-50/10',
        text: 'text-slate-800',
        barBg: 'bg-slate-200',
        barFill: 'bg-slate-600',
        shadow: 'shadow-[0_2px_8px_-3px_rgba(100,116,139,0.12)]'
      },
      // TUBERIA 1890 - Teal/Emerald
      {
        border: 'border-teal-200 hover:border-teal-400',
        borderSelected: 'border-teal-600 ring-2 ring-teal-600 ring-offset-1',
        bg: 'bg-teal-50/10',
        text: 'text-teal-800',
        barBg: 'bg-teal-100',
        barFill: 'bg-teal-600',
        shadow: 'shadow-[0_2px_8px_-3px_rgba(20,184,166,0.12)]'
      },
      // OBRA ARQUITEC... - Red/Rose
      {
        border: 'border-rose-200 hover:border-rose-400',
        borderSelected: 'border-rose-600 ring-2 ring-rose-600 ring-offset-1',
        bg: 'bg-rose-50/10',
        text: 'text-rose-800',
        barBg: 'bg-rose-100',
        barFill: 'bg-rose-600',
        shadow: 'shadow-[0_2px_8px_-3px_rgba(244,63,94,0.12)]'
      }
    ];
    return palettes[index % palettes.length];
  };

  const formatInM = (num: number) => {
    return `$${(num / 1000000).toFixed(2)}M`;
  };

  return (
    <div id="tipologia-resumen-box" className="bg-white p-2 mb-4">
      {/* Header Title */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
          📊 ANÁLISIS POR TIPOLOGÍA
        </h3>
        {tipologiaSeleccionada && (
          <button
            onClick={() => setTipologiaSeleccionada(null)}
            className="text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200 transition-all cursor-pointer"
          >
            ✕ Quitar filtro: {tipologiaSeleccionada.split('.')[1] || tipologiaSeleccionada}
          </button>
        )}
      </div>

      {/* Grid of 2-row Compact Cards - Full Width */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-9 gap-2">
        {stats.tipologias.map((tip: any, index: number) => {
          const isSelected = tipologiaSeleccionada === tip.nombre;
          const cleanName = (tip.nombre.split('.')[1] || tip.nombre).replace(/_/g, ' ');
          const colors = getCardColors(index);

          const cardStyle = isSelected ? colors.borderSelected : `${colors.border} ${colors.shadow}`;

          return (
            <div
              key={index}
              onClick={() => {
                if (isSelected) {
                  setTipologiaSeleccionada(null);
                } else {
                  setTipologiaSeleccionada(tip.nombre);
                }
              }}
              className={`border rounded-2xl p-3 cursor-pointer transition-all flex flex-col justify-between h-[115px] select-none ${colors.bg} ${cardStyle}`}
            >
              {/* Top Row: Name + Items Count */}
              <div className="flex items-start justify-between gap-1">
                <span 
                  className={`text-[10px] font-black uppercase tracking-wider truncate leading-tight ${colors.text}`}
                  title={cleanName}
                >
                  {cleanName}
                </span>
                <span className="text-[9px] font-mono text-slate-400 font-bold ml-1 shrink-0">
                  {tip.items}
                </span>
              </div>

              {/* Middle Row: Compact Breakdown Metrics */}
              <div className="my-1 font-mono text-[9.5px] leading-snug flex flex-col gap-0.5 border-y border-slate-100/60 py-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Previsto:</span>
                  <span className="font-bold text-slate-700">{formatInM(tip.venta)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-emerald-500 font-medium">Avance:</span>
                  <span className="font-bold text-emerald-700">{formatInM(tip.ventaEjecutada)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-indigo-400 font-medium">Saldo:</span>
                  <span className="font-bold text-indigo-950">{formatInM(tip.saldo)}</span>
                </div>
              </div>

              {/* Bottom Row: Avance + Progress Bar */}
              <div>
                <div className="flex items-center justify-between text-[9px] font-semibold text-slate-500 mb-0.5">
                  <span>Avance</span>
                  <span className="font-bold">{tip.avance}%</span>
                </div>
                <div className={`w-full h-1 rounded-full overflow-hidden ${colors.barBg}`}>
                  <div 
                    className={`h-full rounded-full ${colors.barFill}`}
                    style={{ width: `${Math.min(Number(tip.avance), 100)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
