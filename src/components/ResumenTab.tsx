/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { Layers } from 'lucide-react';
import { ResumenFinanciero } from './ResumenFinanciero';
import { TipologiaResumen } from './TipologiaResumen';
import { CertificacionCard } from './CertificacionCard';

interface ResumenTabProps {
  // Avance de Obra
  stats: any;
  baseVenta: string;
  setBaseVenta: (v: string) => void;
  periodoSeleccionado: any;
  setPeriodoSeleccionado: (v: any) => void;
  mapaColumnasMes: any;
  exportarAvancePeriodo: () => void;
  tipologiaSeleccionada: string | null;
  setTipologiaSeleccionada: (v: string | null) => void;

  // Certificación
  planillaInfo: any;
  planillaTotales: any;
  planillaEnmiendas: any[];
  planillaTipRes: any[];
  planillaHojas: any[];
}

export const ResumenTab: React.FC<ResumenTabProps> = ({
  stats,
  baseVenta,
  setBaseVenta,
  periodoSeleccionado,
  setPeriodoSeleccionado,
  mapaColumnasMes,
  exportarAvancePeriodo,
  tipologiaSeleccionada,
  setTipologiaSeleccionada,

  planillaInfo,
  planillaTotales,
  planillaEnmiendas,
  planillaTipRes,
  planillaHojas,
}) => {
  // Enforce PG-004 (reformulada) as the exclusive baseline for Resumen tab
  useEffect(() => {
    if (baseVenta !== 'reformulada') {
      setBaseVenta('reformulada');
    }
  }, [baseVenta, setBaseVenta]);

  return (
    <div id="resumen-tab-content" className="space-y-8 animate-fade-in">
      
      {/* 1. SECCIÓN: AVANCE DE OBRA */}
      <div id="avance-obra-container" className="bg-white rounded-3xl border border-indigo-600 shadow-md p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-indigo-50 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-550/10 rounded-xl flex items-center justify-center text-indigo-700">
              <Layers className="w-5 h-5 font-black text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Avance de Obra</h2>
              <p className="text-xs text-slate-400 font-medium">Control físico y avance financiero general por partidas</p>
            </div>
          </div>
          
          <div id="badge-header-base-pg004" className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs shadow-xs shrink-0 self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
            <span className="font-mono tracking-tight font-extrabold">PG-004</span>
          </div>
        </div>

        <div className="space-y-4">
          <ResumenFinanciero
            stats={stats}
            baseVenta={baseVenta}
            setBaseVenta={setBaseVenta}
            periodoSeleccionado={periodoSeleccionado}
            setPeriodoSeleccionado={setPeriodoSeleccionado}
            mapaColumnasMes={mapaColumnasMes}
            exportarAvancePeriodo={exportarAvancePeriodo}
          />

          <TipologiaResumen
            stats={stats}
            tipologiaSeleccionada={tipologiaSeleccionada}
            setTipologiaSeleccionada={setTipologiaSeleccionada}
          />
        </div>
      </div>

      {/* 2. SECCIÓN: CERTIFICACIÓN */}
      <CertificacionCard
        planillaInfo={planillaInfo}
        planillaTotales={planillaTotales}
        planillaEnmiendas={planillaEnmiendas}
        planillaTipRes={planillaTipRes}
        planillaHojas={planillaHojas}
        idPrefix="certificacion-resumen"
      />

    </div>
  );
};
