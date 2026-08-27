/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Download, ChevronRight, ChevronDown, FileSpreadsheet, Check, ChevronsUpDown, ChevronsDownUp, Calendar, Filter, Search, Minus, ArrowUp, ArrowDown, Layers, BarChart3, TrendingUp, TrendingDown, ArrowUpDown, Copy, FileText, CheckCircle2 } from 'lucide-react';

interface ResumenComponenteRow {
  componente: string;
  numActividades: number;     // CONTAR.SI(AN:AN, componente)
  presupuesto: number;        // SUMAR.SI(AN:AN, componente, I:I) - Venta Base / Presupuestado
  planificado: number;        // SUMAR.SI(AN:AN, componente, AS:AS) - Avance Planificado
  ejecutado: number;          // SUMAR.SI(AN:AN, componente, AV:AV) - Avance Ejecutado
  desviacion: number;         // ejecutado - planificado
  saldoPresupuesto: number;   // presupuesto - ejecutado
  saldoPlan: number;          // planificado - ejecutado
  porcentaje: number;         // (ejecutado / planificado) * 100
  porcentajePresupuesto: number; // (ejecutado / presupuesto) * 100
  pesoPresupuesto: number;    // % sobre total presupuestado
  pesoPlan: number;           // % sobre total planificado
  pesoEjec: number;           // % sobre total ejecutado
  actividades: any[];         // Detalle de todas las actividades que componen esta jerarquía
}

interface ComponenteDetalleActividadesProps {
  componente: string;
  actividades: any[];
  onExportIndividualCSV: () => void;
  fmtMoney: (n: number) => string;
}

const ComponenteDetalleActividades: React.FC<ComponenteDetalleActividadesProps> = ({
  componente,
  actividades,
  onExportIndividualCSV,
  fmtMoney
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [copiedAll, setCopiedAll] = React.useState(false);
  const [subSortCol, setSubSortCol] = React.useState<string>('activityId');
  const [subSortDir, setSubSortDir] = React.useState<'asc' | 'desc'>('asc');

  const filteredActividades = React.useMemo(() => {
    let list = [...actividades];
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(a => 
        (a.activityId && String(a.activityId).toLowerCase().includes(q)) ||
        (a.wbs && String(a.wbs).toLowerCase().includes(q)) ||
        (a.descripcion && String(a.descripcion).toLowerCase().includes(q)) ||
        (a.subcontratista && String(a.subcontratista).toLowerCase().includes(q)) ||
        (a.ubicacion && String(a.ubicacion).toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;
      if (subSortCol === 'activityId') {
        valA = String(a.activityId || a.wbs || '');
        valB = String(b.activityId || b.wbs || '');
      } else if (subSortCol === 'wbs') {
        valA = String(a.wbs || '');
        valB = String(b.wbs || '');
      } else if (subSortCol === 'descripcion') {
        valA = String(a.descripcion || '');
        valB = String(b.descripcion || '');
      } else if (subSortCol === 'venta') {
        valA = Number(a.venta) || 0;
        valB = Number(b.venta) || 0;
      } else if (subSortCol === 'ventaPlan') {
        valA = Number(a.ventaPlan) || 0;
        valB = Number(b.ventaPlan) || 0;
      } else if (subSortCol === 'ventaEjecutada') {
        valA = Number(a.ventaEjecutada) || 0;
        valB = Number(b.ventaEjecutada) || 0;
      } else if (subSortCol === 'desviacion') {
        valA = (Number(a.ventaEjecutada) || 0) - (Number(a.ventaPlan) || 0);
        valB = (Number(b.ventaEjecutada) || 0) - (Number(b.ventaPlan) || 0);
      } else if (subSortCol === 'porcentaje') {
        const planA = Number(a.ventaPlan) || 0;
        const planB = Number(b.ventaPlan) || 0;
        const ejecA = Number(a.ventaEjecutada) || 0;
        const ejecB = Number(b.ventaEjecutada) || 0;
        valA = planA > 0 ? (ejecA / planA) * 100 : (ejecA > 0 ? 100 : 0);
        valB = planB > 0 ? (ejecB / planB) * 100 : (ejecB > 0 ? 100 : 0);
      }

      if (typeof valA === 'string') {
        const comp = valA.localeCompare(valB, 'es', { numeric: true });
        return subSortDir === 'asc' ? comp : -comp;
      }
      return subSortDir === 'asc' ? (valA - valB) : (valB - valA);
    });

    return list;
  }, [actividades, searchTerm, subSortCol, subSortDir]);

  const totalPages = Math.ceil(filteredActividades.length / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);
  const pagedItems = filteredActividades.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleCopySingle = (idStr: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(idStr);
    setCopiedId(idStr);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    const ids = actividades.map(a => a.activityId || a.wbs).filter(Boolean);
    navigator.clipboard.writeText(ids.join('\n'));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  const handleSubSort = (col: string) => {
    if (subSortCol === col) {
      setSubSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSubSortCol(col);
      setSubSortDir(col === 'descripcion' || col === 'activityId' || col === 'wbs' ? 'asc' : 'desc');
    }
  };

  return (
    <div className="bg-slate-50/90 border-y border-indigo-100 p-4 space-y-3 rounded-b-xl shadow-inner">
      {/* Sub-header de herramientas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block"></span>
            Actividades que componen <span className="text-indigo-700 font-extrabold">{componente}</span>
          </span>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            {actividades.length.toLocaleString()} actividades
          </span>
          {searchTerm && (
            <span className="text-[11px] font-semibold text-slate-500">
              ({filteredActividades.length} encontradas)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Barra de búsqueda interna */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar ID, WBS o descripción..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 placeholder-slate-400"
            />
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(''); setPage(1); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Botón copiar todos los Activity IDs */}
          <button
            onClick={handleCopyAll}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all shadow-2xs active:scale-95 cursor-pointer ${
              copiedAll 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-250'
            }`}
            title="Copiar lista de Activity IDs al portapapeles"
          >
            {copiedAll ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>¡Copiados {actividades.length}!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copiar IDs ({actividades.length})</span>
              </>
            )}
          </button>

          {/* Botón exportar CSV de este componente */}
          <button
            onClick={onExportIndividualCSV}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-all shadow-2xs active:scale-95 cursor-pointer"
            title={`Descargar CSV con las ${actividades.length} actividades de ${componente}`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
            <span>Exportar CSV ({actividades.length})</span>
          </button>
        </div>
      </div>

      {/* Tabla detallada de actividades */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-100/90 text-slate-600 text-[11px] font-bold sticky top-0 z-10 border-b border-slate-200 select-none">
              <tr>
                <th className="py-2 px-2.5 w-10 text-center text-slate-400">#</th>
                
                <th 
                  onClick={() => handleSubSort('activityId')}
                  className="py-2 px-3 cursor-pointer hover:bg-slate-200/70 transition-colors font-bold text-indigo-900"
                >
                  <div className="flex items-center gap-1">
                    <span>Activity ID (P6)</span>
                    {subSortCol === 'activityId' && (
                      subSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    )}
                  </div>
                </th>

                <th 
                  onClick={() => handleSubSort('wbs')}
                  className="py-2 px-3 cursor-pointer hover:bg-slate-200/70 transition-colors font-bold"
                >
                  <div className="flex items-center gap-1">
                    <span>WBS</span>
                    {subSortCol === 'wbs' && (
                      subSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    )}
                  </div>
                </th>

                <th 
                  onClick={() => handleSubSort('descripcion')}
                  className="py-2 px-3 cursor-pointer hover:bg-slate-200/70 transition-colors font-bold min-w-[200px]"
                >
                  <div className="flex items-center gap-1">
                    <span>Descripción</span>
                    {subSortCol === 'descripcion' && (
                      subSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    )}
                  </div>
                </th>

                <th 
                  onClick={() => handleSubSort('venta')}
                  className="py-2 px-3 text-right cursor-pointer hover:bg-slate-200/70 transition-colors font-bold text-slate-700"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Presupuesto (Col. I)</span>
                    {subSortCol === 'venta' && (
                      subSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    )}
                  </div>
                </th>

                <th 
                  onClick={() => handleSubSort('ventaPlan')}
                  className="py-2 px-3 text-right cursor-pointer hover:bg-slate-200/70 transition-colors font-bold text-indigo-900"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Planificado (Col. AS)</span>
                    {subSortCol === 'ventaPlan' && (
                      subSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    )}
                  </div>
                </th>

                <th 
                  onClick={() => handleSubSort('ventaEjecutada')}
                  className="py-2 px-3 text-right cursor-pointer hover:bg-slate-200/70 transition-colors font-bold text-rose-900"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Ejecutado (Col. AV)</span>
                    {subSortCol === 'ventaEjecutada' && (
                      subSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    )}
                  </div>
                </th>

                <th 
                  onClick={() => handleSubSort('desviacion')}
                  className="py-2 px-3 text-right cursor-pointer hover:bg-slate-200/70 transition-colors font-bold"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Desviación ($)</span>
                    {subSortCol === 'desviacion' && (
                      subSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    )}
                  </div>
                </th>

                <th 
                  onClick={() => handleSubSort('porcentaje')}
                  className="py-2 px-3 text-center cursor-pointer hover:bg-slate-200/70 transition-colors font-bold w-24"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>% Cumpl.</span>
                    {subSortCol === 'porcentaje' && (
                      subSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    )}
                  </div>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
              {pagedItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No se encontraron actividades con el criterio de búsqueda.
                  </td>
                </tr>
              ) : (
                pagedItems.map((act, index) => {
                  const globalIdx = (currentPage - 1) * pageSize + index + 1;
                  const actIdStr = String(act.activityId || act.wbs || 'S/ID');
                  const vBase = Number(act.venta) || 0;
                  const plan = Number(act.ventaPlan) || 0;
                  const ejec = Number(act.ventaEjecutada) || 0;
                  const desv = ejec - plan;
                  const pct = plan > 0 ? (ejec / plan) * 100 : (ejec > 0 ? 100 : 0);
                  const isCopied = copiedId === actIdStr;

                  return (
                    <tr key={act.id || `${actIdStr}_${index}`} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="py-2 px-2.5 text-center text-slate-400 text-[10px] font-mono">
                        {globalIdx}
                      </td>

                      <td className="py-2 px-3 font-mono text-[11px]">
                        <button
                          onClick={(e) => handleCopySingle(actIdStr, e)}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold transition-all text-left group cursor-pointer ${
                            isCopied 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200/70'
                          }`}
                          title="Clic para copiar Activity ID"
                        >
                          <span>{actIdStr}</span>
                          {isCopied ? (
                            <Check className="w-2.5 h-2.5 text-emerald-600 inline" />
                          ) : (
                            <Copy className="w-2.5 h-2.5 text-indigo-400 opacity-0 group-hover:opacity-100 inline" />
                          )}
                        </button>
                      </td>

                      <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">
                        {act.wbs || '-'}
                      </td>

                      <td className="py-2 px-3 text-slate-800 font-medium max-w-[260px] truncate" title={act.descripcion}>
                        {act.descripcion || '-'}
                      </td>

                      <td className="py-2 px-3 text-right font-semibold text-slate-700">
                        ${fmtMoney(vBase)}
                      </td>

                      <td className="py-2 px-3 text-right font-bold text-indigo-700">
                        ${fmtMoney(plan)}
                      </td>

                      <td className="py-2 px-3 text-right font-bold text-rose-700">
                        ${fmtMoney(ejec)}
                      </td>

                      <td className={`py-2 px-3 text-right font-semibold ${desv >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {desv >= 0 ? '+' : ''}${fmtMoney(desv)}
                      </td>

                      <td className="py-2 px-3 text-center">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                          pct >= 100 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : pct >= 75 
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                            : pct < 50 
                            ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {pct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {filteredActividades.length > pageSize && (
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>Mostrando {((currentPage - 1) * pageSize + 1).toLocaleString()} - {Math.min(currentPage * pageSize, filteredActividades.length).toLocaleString()} de {filteredActividades.length.toLocaleString()}</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 font-medium"
              >
                <option value={25}>25 por pág.</option>
                <option value={50}>50 por pág.</option>
                <option value={100}>100 por pág.</option>
                <option value={250}>250 por pág.</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-0.5 rounded bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                ««
              </button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-0.5 rounded bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                « Anterior
              </button>
              <span className="px-2 py-0.5 font-bold text-slate-800">
                Pág. {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-0.5 rounded bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                Siguiente »
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-0.5 rounded bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                »»
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface KPITabProps {
  stats: any;
  baseVenta: string;
  setBaseVenta: (v: string) => void;
  donutPG: string;
  setDonutPG: (v: string) => void;
  periodoSeleccionado: any;
  setPeriodoSeleccionado: (v: any) => void;
  mapaColumnasMes: any;
  tipologiaSeleccionada: string | null;
  setTipologiaSeleccionada: (v: string | null) => void;
  exportarAvancePeriodo: () => void;
  datosDona: any;
  donutDim: string;
  setDonutDim: (v: string) => void;
  donutAnio: string;
  setDonutAnio: (v: string) => void;
  donutMes: string;
  setDonutMes: (v: string) => void;
  donutSemana: string;
  setDonutSemana: (v: string) => void;
  donaAgregada: any;
  planFuturoAgregado: any;
  tablaUnificada: any;
  tablaSortCol: string;
  setTablaSortCol: (v: string) => void;
  tablaSortDir: string;
  setTablaSortDir: (v: string) => void;
  datosCurvaAvance: any;
  expandedYears: Set<any>;
  setExpandedYears: React.Dispatch<React.SetStateAction<Set<any>>>;
  barrasPlanVsReal: any;
  donutAcumulado?: boolean;
  setDonutAcumulado?: (v: boolean) => void;
  ultimaSemanaConAvance?: string | null;
  actividades?: any[];
  dataPlanificadoPG004?: any;
}

export const KPITab: React.FC<KPITabProps> = ({
  stats,
  baseVenta,
  setBaseVenta,
  donutPG,
  setDonutPG,
  periodoSeleccionado,
  setPeriodoSeleccionado,
  mapaColumnasMes,
  tipologiaSeleccionada,
  setTipologiaSeleccionada,
  exportarAvancePeriodo,
  datosDona,
  donutDim,
  setDonutDim,
  donutAnio,
  setDonutAnio,
  donutMes,
  setDonutMes,
  donutSemana,
  setDonutSemana,
  donaAgregada,
  planFuturoAgregado,
  tablaUnificada,
  tablaSortCol,
  setTablaSortCol,
  tablaSortDir,
  setTablaSortDir,
  datosCurvaAvance,
  expandedYears,
  setExpandedYears,
  barrasPlanVsReal,
  donutAcumulado = false,
  setDonutAcumulado,
  ultimaSemanaConAvance,
  actividades,
  dataPlanificadoPG004,
}) => {
  if (!stats) return null;

  const [openAnio, setOpenAnio] = React.useState<boolean>(false);
  const [openMes, setOpenMes] = React.useState<boolean>(false);
  const [openSemana, setOpenSemana] = React.useState<boolean>(false);

  // Estados para tabla resumen por Componente (Col AN: Planificado Col AS vs Ejecutado Col AV)
  const [compSortCol, setCompSortCol] = React.useState<keyof ResumenComponenteRow>('planificado');
  const [compSortDir, setCompSortDir] = React.useState<'asc' | 'desc'>('desc');
  const [compSearch, setCompSearch] = React.useState<string>('');
  const [expandedComponentes, setExpandedComponentes] = React.useState<Set<string>>(new Set());

  const toggleExpandComponente = (comp: string) => {
    setExpandedComponentes(prev => {
      const next = new Set(prev);
      if (next.has(comp)) next.delete(comp);
      else next.add(comp);
      return next;
    });
  };

  const toggleExpandAll = () => {
    if (expandedComponentes.size === sortedComponentes.length) {
      setExpandedComponentes(new Set());
    } else {
      setExpandedComponentes(new Set(sortedComponentes.map(r => r.componente)));
    }
  };

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.multiselect-dropdown')) {
        setOpenAnio(false);
        setOpenMes(false);
        setOpenSemana(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fmtMoney = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt0 = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // Curva de avance económico calculada dinámicamente con V.Plan (PG-004) y V.Ejec. (CDO V-)
  const datosCurvaAvanceCalculados = React.useMemo(() => {
    if (!actividades || actividades.length === 0) return datosCurvaAvance;

    const itemsHoja = actividades.filter(a => a.esItemHoja);
    if (itemsHoja.length === 0) return datosCurvaAvance;

    const datosPorMes: Record<string, { mes: string; yyyy: number; mm: number; ejecutado: number; planificado: number }> = {};
    const processedPlanActivityIds = new Set<string>();

    const MONTH_NAMES = [
      'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
    ];

    const getYearMonth = (fechaStr: any): { yyyy: number; mm: number } | null => {
      if (!fechaStr) return null;
      const str = String(fechaStr).trim();
      const parts = str.split('-');
      if (parts.length >= 2) {
        const yyyy = parseInt(parts[0], 10);
        const mm = parseInt(parts[1], 10);
        if (!isNaN(yyyy) && !isNaN(mm) && yyyy >= 2015 && yyyy <= 2035 && mm >= 1 && mm <= 12) {
          return { yyyy, mm };
        }
      }
      return null;
    };

    const addVal = (fechaKey: any, field: 'planificado' | 'ejecutado', val: number) => {
      const numVal = Number(val) || 0;
      if (numVal === 0) return;

      const ym = getYearMonth(fechaKey);
      if (!ym) return;

      const { yyyy, mm } = ym;
      const ymKey = `${yyyy}-${String(mm).padStart(2, '0')}`;
      if (!datosPorMes[ymKey]) {
        datosPorMes[ymKey] = {
          mes: `${MONTH_NAMES[mm - 1]} ${yyyy}`,
          yyyy,
          mm,
          ejecutado: 0,
          planificado: 0,
        };
      }
      datosPorMes[ymKey][field] += numVal;
    };

    itemsHoja.forEach(item => {
      // 1. Planificado PG-004 por semana
      let planDict = (item.planificadoPorFechaPG004 && Object.keys(item.planificadoPorFechaPG004).length > 0)
        ? item.planificadoPorFechaPG004
        : null;

      if (!planDict && dataPlanificadoPG004 && item.activityId && dataPlanificadoPG004[item.activityId]) {
        const actIdStr = String(item.activityId).trim();
        if (!processedPlanActivityIds.has(actIdStr)) {
          processedPlanActivityIds.add(actIdStr);
          planDict = dataPlanificadoPG004[item.activityId];
        }
      }

      if (planDict) {
        Object.entries(planDict).forEach(([f, v]) => {
          addVal(f, 'planificado', Number(v) || 0);
        });
      }

      // 2. Ejecutado CDO V- por semana
      if (item.certificacionesPorFecha && Object.keys(item.certificacionesPorFecha).length > 0) {
        Object.entries(item.certificacionesPorFecha).forEach(([f, v]) => {
          addVal(f, 'ejecutado', Number(v) || 0);
        });
      }
    });

    const sortedYmKeys = Object.keys(datosPorMes).sort();
    if (sortedYmKeys.length === 0) return datosCurvaAvance;

    let acumE = 0;
    let acumP = 0;
    const meses = sortedYmKeys.map(k => {
      const m = datosPorMes[k];
      acumE += m.ejecutado;
      acumP += m.planificado;
      return {
        mes: m.mes,
        anio: m.yyyy,
        ejecutado: m.ejecutado,
        planificado: m.planificado,
        acumEjecutado: acumE,
        acumPlanificado: acumP,
      };
    });

    const porAnio: Record<number, any> = {};
    meses.forEach(m => {
      if (!porAnio[m.anio]) {
        porAnio[m.anio] = { anio: m.anio, ejecutado: 0, planificado: 0, meses: [] };
      }
      porAnio[m.anio].ejecutado += m.ejecutado;
      porAnio[m.anio].planificado += m.planificado;
      porAnio[m.anio].meses.push(m);
    });

    const aniosArr = Object.values(porAnio).sort((a: any, b: any) => a.anio - b.anio);

    return { meses, aniosArr };
  }, [actividades, dataPlanificadoPG004, datosCurvaAvance]);

  const datosCurvaFinal = datosCurvaAvanceCalculados || datosCurvaAvance;

  // Recálculo estilo Excel (SUMAR.SI) por Componente (Columna AN):
  // 1. Obtener únicos de Columna AN (Componente)
  // 2. Para cada único, ejecutar SUMAR.SI para:
  //    - Columna I: Presupuesto base (item.venta)
  //    - Columna AS: Avance Planificado (item.ventaPlan)
  //    - Columna AV: Avance Ejecutado (item.ventaEjecutada)
  const resumenComponentes = React.useMemo(() => {
    if (!actividades || actividades.length === 0) return [];

    const itemsHoja = actividades.filter(a => a.esItemHoja);
    if (itemsHoja.length === 0) return [];

    // 1. Obtener los valores únicos de la Columna AN (Componente)
    const componentesUnicosSet = new Set<string>();
    itemsHoja.forEach(item => {
      const comp = (item.componente && String(item.componente).trim() !== '') 
        ? String(item.componente).trim() 
        : '(Sin Componente)';
      componentesUnicosSet.add(comp);
    });

    const componentesUnicos = Array.from(componentesUnicosSet).sort((a, b) => 
      a.localeCompare(b, 'es', { numeric: true })
    );

    // Totales globales para cálculo de pesos relativos
    let totalPresupuestoGlobal = 0;
    let totalPlanGlobal = 0;
    let totalEjecGlobal = 0;

    itemsHoja.forEach(item => {
      totalPresupuestoGlobal += Number(item.venta) || 0;
      totalPlanGlobal += Number(item.ventaPlan) || 0;
      totalEjecGlobal += Number(item.ventaEjecutada) || 0;
    });

    // 2. Realizar el equivalente a SUMAR.SI y CONTAR.SI para cada único de Columna AN
    const filas: ResumenComponenteRow[] = componentesUnicos.map(compNombre => {
      // Filtrar actividades que pertenecen a este componente específico (Criterio del SUMAR.SI)
      const actividadesComp = itemsHoja.filter(item => {
        const itemComp = (item.componente && String(item.componente).trim() !== '') 
          ? String(item.componente).trim() 
          : '(Sin Componente)';
        return itemComp === compNombre;
      });

      // SUMAR.SI(Columna AN, compNombre, Columna I) -> Presupuesto
      const presupuesto = actividadesComp.reduce((sum, item) => sum + (Number(item.venta) || 0), 0);

      // SUMAR.SI(Columna AN, compNombre, Columna AS) -> Planificado
      const planificado = actividadesComp.reduce((sum, item) => sum + (Number(item.ventaPlan) || 0), 0);

      // SUMAR.SI(Columna AN, compNombre, Columna AV) -> Ejecutado
      const ejecutado = actividadesComp.reduce((sum, item) => sum + (Number(item.ventaEjecutada) || 0), 0);

      // CONTAR.SI(Columna AN, compNombre) -> Número de Actividades
      const numActividades = actividadesComp.length;

      const desviacion = ejecutado - planificado;
      const saldoPresupuesto = presupuesto - ejecutado;
      const saldoPlan = planificado - ejecutado;
      const porcentaje = planificado > 0 ? (ejecutado / planificado) * 100 : (ejecutado > 0 ? 100 : 0);
      const porcentajePresupuesto = presupuesto > 0 ? (ejecutado / presupuesto) * 100 : (ejecutado > 0 ? 100 : 0);
      const pesoPresupuesto = totalPresupuestoGlobal > 0 ? (presupuesto / totalPresupuestoGlobal) * 100 : 0;
      const pesoPlan = totalPlanGlobal > 0 ? (planificado / totalPlanGlobal) * 100 : 0;
      const pesoEjec = totalEjecGlobal > 0 ? (ejecutado / totalEjecGlobal) * 100 : 0;

      return {
        componente: compNombre,
        numActividades,
        presupuesto,
        planificado,
        ejecutado,
        desviacion,
        saldoPresupuesto,
        saldoPlan,
        porcentaje,
        porcentajePresupuesto,
        pesoPresupuesto,
        pesoPlan,
        pesoEjec,
        actividades: actividadesComp
      };
    });

    return filas;
  }, [actividades]);

  const handleCompSort = (col: keyof ResumenComponenteRow) => {
    if (compSortCol === col) {
      setCompSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setCompSortCol(col);
      setCompSortDir(col === 'componente' ? 'asc' : 'desc');
    }
  };

  const sortedComponentes = React.useMemo(() => {
    let list = [...resumenComponentes];

    if (compSearch.trim()) {
      const term = compSearch.trim().toLowerCase();
      list = list.filter(r => r.componente.toLowerCase().includes(term));
    }

    list.sort((a, b) => {
      let valA = a[compSortCol];
      let valB = b[compSortCol];

      if (typeof valA === 'string') {
        const comp = (valA as string).localeCompare(valB as string, 'es', { numeric: true });
        return compSortDir === 'asc' ? comp : -comp;
      } else {
        const numA = (valA as number) || 0;
        const numB = (valB as number) || 0;
        return compSortDir === 'asc' ? numA - numB : numB - numA;
      }
    });

    return list;
  }, [resumenComponentes, compSearch, compSortCol, compSortDir]);

  const totalesComponentes = React.useMemo(() => {
    const totalActividades = resumenComponentes.reduce((acc, r) => acc + r.numActividades, 0);
    const totalPresupuesto = resumenComponentes.reduce((acc, r) => acc + r.presupuesto, 0);
    const totalPlan = resumenComponentes.reduce((acc, r) => acc + r.planificado, 0);
    const totalEjec = resumenComponentes.reduce((acc, r) => acc + r.ejecutado, 0);
    const totalDesv = totalEjec - totalPlan;
    const totalPct = totalPlan > 0 ? (totalEjec / totalPlan) * 100 : (totalEjec > 0 ? 100 : 0);
    const totalPctPresupuesto = totalPresupuesto > 0 ? (totalEjec / totalPresupuesto) * 100 : (totalEjec > 0 ? 100 : 0);
    return {
      numComponentes: resumenComponentes.length,
      totalActividades,
      totalPresupuesto,
      totalPlan,
      totalEjec,
      totalDesv,
      totalPct,
      totalPctPresupuesto
    };
  }, [resumenComponentes]);

  const exportarComponentesCSV = () => {
    if (sortedComponentes.length === 0) return;
    const headers = [
      'Componente (Col AN)',
      'N° Actividades',
      'Presupuesto Base (Col I)',
      'Avance Planificado (Col AS)',
      'Avance Ejecutado (Col AV)',
      'Desviación ($)',
      '% Cumplimiento (Plan)',
      'Peso en Presupuesto (%)',
      'Peso en Plan (%)',
      'Peso en Ejecución (%)'
    ];
    const rows = sortedComponentes.map(r => [
      `"${r.componente.replace(/"/g, '""')}"`,
      r.numActividades,
      r.presupuesto.toFixed(2),
      r.planificado.toFixed(2),
      r.ejecutado.toFixed(2),
      r.desviacion.toFixed(2),
      r.porcentaje.toFixed(2) + '%',
      r.pesoPresupuesto.toFixed(2) + '%',
      r.pesoPlan.toFixed(2) + '%',
      r.pesoEjec.toFixed(2) + '%'
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Resumen_Componentes_AN_I_AS_AV_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportarDetalleCompletoCSV = () => {
    if (sortedComponentes.length === 0) return;

    const headers = [
      'Componente (Col AN)',
      'Activity ID',
      'WBS',
      'Descripción de Actividad',
      'Presupuestado (Col I)',
      'Planificado (Col AS)',
      'Ejecutado (Col AV)',
      'Desviación ($)',
      '% Cumplimiento',
      'Partidas',
      'Subcontratista',
      'Ubicación',
      'Proceso'
    ];

    const rows: string[][] = [];
    sortedComponentes.forEach(comp => {
      comp.actividades.forEach(act => {
        const vBase = Number(act.venta) || 0;
        const plan = Number(act.ventaPlan) || 0;
        const ejec = Number(act.ventaEjecutada) || 0;
        const desv = ejec - plan;
        const pct = plan > 0 ? ((ejec / plan) * 100).toFixed(2) + '%' : (ejec > 0 ? '100.00%' : '0.00%');

        rows.push([
          `"${(comp.componente || '').replace(/"/g, '""')}"`,
          `"${(act.activityId || act.wbs || '').replace(/"/g, '""')}"`,
          `"${(act.wbs || '').replace(/"/g, '""')}"`,
          `"${(act.descripcion || '').replace(/"/g, '""')}"`,
          vBase.toFixed(2),
          plan.toFixed(2),
          ejec.toFixed(2),
          desv.toFixed(2),
          pct,
          `"${(act.partidas || '').replace(/"/g, '""')}"`,
          `"${(act.subcontratista || '').replace(/"/g, '""')}"`,
          `"${(act.ubicacion || '').replace(/"/g, '""')}"`,
          `"${(act.proceso || '').replace(/"/g, '""')}"`
        ]);
      });
    });

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Detalle_Completo_Activity_IDs_Por_Componente_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportarComponenteIndividualCSV = (compRow: ResumenComponenteRow) => {
    if (!compRow.actividades || compRow.actividades.length === 0) return;

    const headers = [
      'Componente (Col AN)',
      'Activity ID',
      'WBS',
      'Descripción de Actividad',
      'Presupuestado (Col I)',
      'Planificado (Col AS)',
      'Ejecutado (Col AV)',
      'Desviación ($)',
      '% Cumplimiento',
      'Partidas',
      'Subcontratista',
      'Ubicación',
      'Proceso'
    ];

    const rows = compRow.actividades.map(act => {
      const vBase = Number(act.venta) || 0;
      const plan = Number(act.ventaPlan) || 0;
      const ejec = Number(act.ventaEjecutada) || 0;
      const desv = ejec - plan;
      const pct = plan > 0 ? ((ejec / plan) * 100).toFixed(2) + '%' : (ejec > 0 ? '100.00%' : '0.00%');

      return [
        `"${(compRow.componente || '').replace(/"/g, '""')}"`,
        `"${(act.activityId || act.wbs || '').replace(/"/g, '""')}"`,
        `"${(act.wbs || '').replace(/"/g, '""')}"`,
        `"${(act.descripcion || '').replace(/"/g, '""')}"`,
        vBase.toFixed(2),
        plan.toFixed(2),
        ejec.toFixed(2),
        desv.toFixed(2),
        pct,
        `"${(act.partidas || '').replace(/"/g, '""')}"`,
        `"${(act.subcontratista || '').replace(/"/g, '""')}"`,
        `"${(act.ubicacion || '').replace(/"/g, '""')}"`,
        `"${(act.proceso || '').replace(/"/g, '""')}"`
      ];
    });

    const cleanCompName = compRow.componente.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Actividades_${cleanCompName}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="kpi-tab-panel" className="space-y-6">
      {/* Cuadro Resumen por Componente (Columna AN): Presupuestado (Col. I) vs. Planificado (Col. AS) vs. Ejecutado (Col. AV) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden" id="card-resumen-componentes">
        {/* Header de la tarjeta */}
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/20">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    Resumen por Componente (Columna AN)
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                      {totalesComponentes.numComponentes} componentes únicos
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Recálculo SUMAR.SI: Presupuestado (<strong className="text-slate-700 font-semibold">Columna I</strong>), Planificado (<strong className="text-indigo-600 font-semibold">Columna AS</strong>) y Ejecutado (<strong className="text-rose-600 font-semibold">Columna AV</strong>)
                  </p>
                </div>
              </div>
            </div>

            {/* Acciones: Búsqueda y Exportación */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar componente..."
                  value={compSearch}
                  onChange={(e) => setCompSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-250 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 placeholder-slate-400 shadow-2xs"
                />
                {compSearch && (
                  <button
                    onClick={() => setCompSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                onClick={toggleExpandAll}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all active:scale-[0.98] cursor-pointer shadow-2xs ${
                  expandedComponentes.size === sortedComponentes.length && sortedComponentes.length > 0
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                    : 'bg-white text-slate-700 border-slate-250 hover:bg-slate-50'
                }`}
                title={expandedComponentes.size === sortedComponentes.length ? "Colapsar todas las jerarquías" : "Expandir todas las jerarquías para ver sus Activity IDs"}
              >
                {expandedComponentes.size === sortedComponentes.length && sortedComponentes.length > 0 ? (
                  <>
                    <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Colapsar Todo</span>
                  </>
                ) : (
                  <>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    <span>Expandir Todo ({totalesComponentes.totalActividades} IDs)</span>
                  </>
                )}
              </button>

              <button
                onClick={exportarComponentesCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-250 rounded-xl shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
                title="Exportar resumen a archivo CSV"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Resumen CSV</span>
              </button>

              <button
                onClick={exportarDetalleCompletoCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 border border-indigo-600 rounded-xl shadow-xs transition-all active:scale-[0.98] cursor-pointer"
                title="Exportar archivo CSV con TODOS los Activity IDs detallados de cada componente"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-100" />
                <span>Exportar Todos los IDs (CSV)</span>
              </button>
            </div>
          </div>

          {/* Mini KPI summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5">
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Presupuestado (Col. I)</span>
              <span className="text-base font-black text-slate-800 mt-0.5 block">
                ${fmtMoney(totalesComponentes.totalPresupuesto)}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Venta contractual base</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Planificado (Col. AS)</span>
              <span className="text-base font-black text-indigo-700 mt-0.5 block">
                ${fmtMoney(totalesComponentes.totalPlan)}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Meta programada</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Ejecutado (Col. AV)</span>
              <span className="text-base font-black text-rose-700 mt-0.5 block">
                ${fmtMoney(totalesComponentes.totalEjec)}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Avance real certificado</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Desviación (AV - AS)</span>
              <span className={`text-base font-black mt-0.5 block ${totalesComponentes.totalDesv >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {totalesComponentes.totalDesv >= 0 ? '+' : ''}${fmtMoney(totalesComponentes.totalDesv)}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {totalesComponentes.totalDesv >= 0 ? 'Superávit vs meta' : 'Brecha vs meta'}
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">% Cumpl. Plan / Presup.</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-base font-black text-slate-900">
                  {totalesComponentes.totalPct.toFixed(1)}%
                </span>
                <div className="flex-1 bg-slate-150 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${totalesComponentes.totalPct >= 100 ? 'bg-emerald-500' : totalesComponentes.totalPct >= 75 ? 'bg-indigo-600' : 'bg-rose-500'}`}
                    style={{ width: `${Math.min(totalesComponentes.totalPct, 100)}%` }}
                  />
                </div>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                {totalesComponentes.totalPctPresupuesto.toFixed(1)}% del presupuesto
              </span>
            </div>
          </div>
        </div>

        {/* Tabla Sortable con Nivel Adicional Expandible de Activity IDs */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse" id="tabla-resumen-componentes">
            <thead className="bg-slate-50/90 text-slate-600 border-b border-slate-200 text-[11px] font-bold select-none sticky top-0 z-10">
              <tr>
                <th className="py-3 px-3 w-10 text-center text-slate-400">#</th>
                
                {/* Columna AN */}
                <th 
                  onClick={() => handleCompSort('componente')}
                  className="py-3 px-4 font-bold cursor-pointer hover:bg-slate-150/70 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Componente (Col. AN) / Desglose</span>
                    {compSortCol === 'componente' ? (
                      compSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-350" />
                    )}
                  </div>
                </th>

                {/* Actividades */}
                <th 
                  onClick={() => handleCompSort('numActividades')}
                  className="py-3 px-3 font-bold text-center cursor-pointer hover:bg-slate-150/70 transition-colors w-28"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Actividades</span>
                    {compSortCol === 'numActividades' ? (
                      compSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-350" />
                    )}
                  </div>
                </th>

                {/* Columna I - Presupuestado */}
                <th 
                  onClick={() => handleCompSort('presupuesto')}
                  className="py-3 px-4 font-bold text-right cursor-pointer hover:bg-slate-150/70 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Presupuestado (Col. I)</span>
                    {compSortCol === 'presupuesto' ? (
                      compSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-350" />
                    )}
                  </div>
                </th>

                {/* Columna AS - Planificado */}
                <th 
                  onClick={() => handleCompSort('planificado')}
                  className="py-3 px-4 font-bold text-right cursor-pointer hover:bg-slate-150/70 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Planificado (Col. AS)</span>
                    {compSortCol === 'planificado' ? (
                      compSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-350" />
                    )}
                  </div>
                </th>

                {/* Columna AV - Ejecutado */}
                <th 
                  onClick={() => handleCompSort('ejecutado')}
                  className="py-3 px-4 font-bold text-right cursor-pointer hover:bg-slate-150/70 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Ejecutado (Col. AV)</span>
                    {compSortCol === 'ejecutado' ? (
                      compSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-350" />
                    )}
                  </div>
                </th>

                {/* Desviación */}
                <th 
                  onClick={() => handleCompSort('desviacion')}
                  className="py-3 px-4 font-bold text-right cursor-pointer hover:bg-slate-150/70 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Desviación ($)</span>
                    {compSortCol === 'desviacion' ? (
                      compSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-350" />
                    )}
                  </div>
                </th>

                {/* % Avance / Cumplimiento */}
                <th 
                  onClick={() => handleCompSort('porcentaje')}
                  className="py-3 px-4 font-bold text-left cursor-pointer hover:bg-slate-150/70 transition-colors min-w-[170px]"
                >
                  <div className="flex items-center gap-1.5">
                    <span>% Cumplimiento</span>
                    {compSortCol === 'porcentaje' ? (
                      compSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-350" />
                    )}
                  </div>
                </th>

                {/* Peso en Plan */}
                <th 
                  onClick={() => handleCompSort('pesoPlan')}
                  className="py-3 px-3 font-bold text-right cursor-pointer hover:bg-slate-150/70 transition-colors w-24"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Peso Plan</span>
                    {compSortCol === 'pesoPlan' ? (
                      compSortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-350" />
                    )}
                  </div>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {sortedComponentes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <p className="font-semibold text-sm">No se encontraron componentes</p>
                    <p className="text-xs text-slate-400 mt-1">Prueba ajustando el término de búsqueda.</p>
                  </td>
                </tr>
              ) : (
                sortedComponentes.map((row, idx) => {
                  const isExpanded = expandedComponentes.has(row.componente);
                  const isPositive = row.desviacion >= 0;
                  const pctFormatted = row.porcentaje.toFixed(1);
                  const isFinished = row.porcentaje >= 100;
                  const isGood = row.porcentaje >= 75;
                  const isLow = row.porcentaje < 50;

                  return (
                    <React.Fragment key={row.componente}>
                      <tr 
                        className={`transition-colors group ${isExpanded ? 'bg-indigo-50/40 border-l-4 border-l-indigo-600' : 'hover:bg-slate-50/80'}`}
                      >
                        <td className="py-2.5 px-3 text-center text-slate-400 text-[11px] font-mono">
                          {idx + 1}
                        </td>
                        
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleExpandComponente(row.componente)}
                              className={`p-1 rounded-lg transition-all cursor-pointer ${
                                isExpanded 
                                   ? 'bg-indigo-600 text-white shadow-2xs' 
                                  : 'bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700'
                              }`}
                              title={isExpanded ? "Ocultar lista de Activity IDs" : "Ver todos los Activity IDs que componen este elemento"}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <button
                              onClick={() => toggleExpandComponente(row.componente)}
                              className="text-left font-bold text-slate-800 text-xs hover:text-indigo-600 transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              <span>{row.componente}</span>
                              <span className="text-[10px] font-normal text-slate-400 group-hover:text-indigo-500">
                                ({isExpanded ? 'Ocultar IDs' : 'Ver IDs'})
                              </span>
                            </button>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => toggleExpandComponente(row.componente)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700 text-[11px] font-semibold transition-colors cursor-pointer"
                            title="Click para ver/ocultar actividades"
                          >
                            <span>{row.numActividades}</span>
                            <span className="text-[9px] text-slate-400">acts</span>
                          </button>
                        </td>

                        <td className="py-2.5 px-4 text-right font-semibold text-slate-700">
                          ${fmtMoney(row.presupuesto)}
                        </td>

                        <td className="py-2.5 px-4 text-right font-bold text-indigo-700">
                          ${fmtMoney(row.planificado)}
                        </td>

                        <td className="py-2.5 px-4 text-right font-bold text-rose-700">
                          ${fmtMoney(row.ejecutado)}
                        </td>

                        <td className="py-2.5 px-4 text-right">
                          <span className={`font-semibold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isPositive ? '+' : ''}${fmtMoney(row.desviacion)}
                          </span>
                        </td>

                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex-1 bg-slate-150 h-2 rounded-full overflow-hidden min-w-[70px]">
                              <div 
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isFinished ? 'bg-emerald-500' : isGood ? 'bg-indigo-600' : isLow ? 'bg-rose-500' : 'bg-amber-500'
                                }`}
                                style={{ width: `${Math.min(row.porcentaje, 100)}%` }}
                              />
                            </div>
                            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md text-right min-w-[48px] ${
                              isFinished 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : isGood 
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                                : isLow 
                                ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {pctFormatted}%
                            </span>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-right text-slate-500 text-[11px] font-semibold">
                          {row.pesoPlan.toFixed(1)}%
                        </td>
                      </tr>

                      {/* Nivel Adicional Expandible: Tabla con todos los Activity IDs que componen la jerarquía */}
                      {isExpanded && (
                        <tr key={`${row.componente}-detail`} className="bg-slate-50/50">
                          <td colSpan={9} className="p-0 border-b border-indigo-100">
                            <ComponenteDetalleActividades
                              componente={row.componente}
                              actividades={row.actividades}
                              onExportIndividualCSV={() => exportarComponenteIndividualCSV(row)}
                              fmtMoney={fmtMoney}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>

            {/* Footer con Totales Generales */}
            {sortedComponentes.length > 0 && (
              <tfoot className="bg-slate-100/90 font-bold border-t-2 border-slate-300 text-slate-900">
                <tr id="total-resumen-componentes-row">
                  <td className="py-3 px-3 text-center text-slate-400">∑</td>
                  <td className="py-3 px-4 font-black uppercase tracking-wide text-slate-800">
                    TOTAL GENERAL ({totalesComponentes.numComponentes} COMPONENTES)
                  </td>
                  <td className="py-3 px-3 text-center font-extrabold text-slate-700">
                    {totalesComponentes.totalActividades}
                  </td>
                  <td className="py-3 px-4 text-right font-black text-slate-800">
                    ${fmtMoney(totalesComponentes.totalPresupuesto)}
                  </td>
                  <td className="py-3 px-4 text-right font-black text-indigo-700">
                    ${fmtMoney(totalesComponentes.totalPlan)}
                  </td>
                  <td className="py-3 px-4 text-right font-black text-rose-700">
                    ${fmtMoney(totalesComponentes.totalEjec)}
                  </td>
                  <td className="py-3 px-4 text-right font-black">
                    <span className={totalesComponentes.totalDesv >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                      {totalesComponentes.totalDesv >= 0 ? '+' : ''}${fmtMoney(totalesComponentes.totalDesv)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-250 h-2 rounded-full overflow-hidden min-w-[70px]">
                        <div 
                          className={`h-full rounded-full ${totalesComponentes.totalPct >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                          style={{ width: `${Math.min(totalesComponentes.totalPct, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-black px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 border border-indigo-200">
                        {totalesComponentes.totalPct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-black text-slate-700 text-[11px]">
                    100.0%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Curva de Avance */}
      {datosCurvaFinal && (() => {
        const meses = datosCurvaFinal.meses;
        const aniosArr = datosCurvaFinal.aniosArr;
        const maxBarra = Math.max(...meses.map((d: any) => Math.max(d.ejecutado, d.planificado)), 1);
        const maxAcum  = Math.max(...meses.map((d: any) => Math.max(d.acumEjecutado, d.acumPlanificado)), 1);
        const idxCorte = meses.reduce((acc: number, m: any, i: number) => m.ejecutado > 0 ? i : acc, -1);

        return (
          <div className="bg-white rounded-2xl shadow-sm border border-indigo-600 p-6">
            <h3 className="text-lg font-bold text-slate-800 tracking-tight mb-1">Curva de Avance Económico</h3>
            <p className="text-xs text-slate-500 mb-4 font-medium">Mensualización por certificación semanal · Plan total: ${(meses[meses.length-1]?.acumPlanificado / 1e6).toFixed(1)}M · Ejecutado: ${(meses[meses.length-1]?.acumEjecutado / 1e6).toFixed(1)}M</p>

            <div className="flex flex-wrap gap-4 mb-4 text-xs font-semibold">
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-rose-500 rounded-md shadow-sm"/><span>Ejecutado mensual</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-indigo-500 rounded-md shadow-sm"/><span>Planificado mensual</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-1 bg-emerald-500 rounded-full"/><span>Acum. Ejecutado</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-1 bg-indigo-600 rounded-full"/><span>Acum. Planificado</span></div>
              {idxCorte >= 0 && (
                <div className="flex items-center gap-2"><div className="w-0.5 h-3 bg-amber-500"/><span>Fecha de corte</span></div>
              )}
            </div>

            <div className="border border-slate-150 rounded-2xl p-4 bg-slate-50/70 overflow-x-auto shadow-mini">
              <svg width="100%" height="450" viewBox="0 0 1200 450" preserveAspectRatio="xMidYMid meet" className="min-w-[1000px] block mx-auto">
                <line x1="80" y1="380" x2="1150" y2="380" stroke="#cbd5e1" strokeWidth="2" />
                <line x1="80" y1="20" x2="80" y2="380" stroke="#cbd5e1" strokeWidth="2" />
                <line x1="1150" y1="20" x2="1150" y2="380" stroke="#cbd5e1" strokeWidth="2" />
                
                {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
                  const y = 380 - (f * 360);
                  return (
                    <g key={`l${i}`}>
                      <line x1="75" y1={y} x2="80" y2={y} stroke="#94a3b8" strokeWidth="1.5" />
                      <line x1="80" y1={y} x2="1150" y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4,4" />
                      <text x="70" y={y + 4} fontSize="10" fill="#475569" fontWeight="600" textAnchor="end">{(maxBarra * f / 1e6).toFixed(1)}M</text>
                    </g>
                  );
                })}

                {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
                  const y = 380 - (f * 360);
                  return (
                    <g key={`r${i}`}>
                      <line x1="1150" y1={y} x2="1155" y2={y} stroke="#94a3b8" strokeWidth="1.5" />
                      <text x="1160" y={y + 4} fontSize="10" fill="#475569" fontWeight="600">{(maxAcum * f / 1e6).toFixed(1)}M</text>
                    </g>
                  );
                })}

                {idxCorte >= 0 && (() => {
                  const xc = 100 + (idxCorte * (1000 / meses.length)) + (1000 / meses.length / 2);
                  return <line x1={xc} y1="20" x2={xc} y2="380" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4,3" />;
                })()}

                {meses.map((d: any, i: number) => {
                  const x = 100 + (i * (1000 / meses.length));
                  const ancho = (1000 / meses.length) * 0.35;
                  const aE = (d.ejecutado / maxBarra) * 360;
                  const aP = (d.planificado / maxBarra) * 360;
                  const yAE = 380 - ((d.acumEjecutado / maxAcum) * 360);
                  const yAP = 380 - ((d.acumPlanificado / maxAcum) * 360);
                  const xPrev = 100 + ((i - 1) * (1000 / meses.length));
                  const yAEPrev = i > 0 ? 380 - ((meses[i-1].acumEjecutado / maxAcum) * 360) : yAE;
                  const yAPPrev = i > 0 ? 380 - ((meses[i-1].acumPlanificado / maxAcum) * 360) : yAP;
                  return (
                    <g key={i}>
                      <rect x={x - ancho} y={380 - aP} width={ancho} height={aP} fill="#6366f1" opacity="0.9" rx="2" />
                      <rect x={x} y={380 - aE} width={ancho} height={aE} fill="#f43f5e" opacity="0.9" rx="2" />
                      {i > 0 && <line x1={xPrev} y1={yAEPrev} x2={x} y2={yAE} stroke="#10b981" strokeWidth="3" />}
                      <circle cx={x} cy={yAE} r="4.5" fill="#10b981" stroke="white" strokeWidth="1.5" />
                      {i > 0 && <line x1={xPrev} y1={yAPPrev} x2={x} y2={yAP} stroke="#4f46e5" strokeWidth="3" />}
                      <circle cx={x} cy={yAP} r="4.5" fill="#4f46e5" stroke="white" strokeWidth="1.5" />
                      <text x={x} y="405" fontSize="10" fill="#475569" fontWeight="600" textAnchor="middle" transform={`rotate(-45 ${x} 405)`}>{d.mes}</text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Subtotales anuales */}
            <div className="mt-6">
              <h4 className="text-sm font-bold text-slate-800 mb-2.5 flex items-center gap-1.5" id="tabla-distribucion-temporal-montos">
                📋 Distribución Temporal de Montos y Avance por Período
              </h4>
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-3 w-8"></th>
                      <th className="px-3 py-3 text-left font-bold text-slate-550 uppercase tracking-wider">Período</th>
                      <th className="px-3 py-3 text-right font-bold text-slate-550 uppercase tracking-wider">Planificado</th>
                      <th className="px-3 py-3 text-right font-bold text-slate-550 uppercase tracking-wider">Ejecutado</th>
                      <th className="px-3 py-3 text-right font-bold text-slate-550 uppercase tracking-wider">Acum. Plan.</th>
                      <th className="px-3 py-3 text-right font-bold text-slate-550 uppercase tracking-wider">Acum. Ejec.</th>
                      <th className="px-3 py-3 text-right font-bold text-slate-550 uppercase tracking-wider">% Ejec.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {aniosArr.map((grupo: any) => {
                      const isExp = expandedYears.has(grupo.anio);
                      const ultimoMes = grupo.meses[grupo.meses.length - 1];
                      const pctAnio = grupo.planificado > 0 ? ((grupo.ejecutado / grupo.planificado) * 100).toFixed(1) : '0.0';
                      return (
                        <React.Fragment key={grupo.anio}>
                          <tr className="bg-indigo-50/20 font-semibold cursor-pointer border-t border-slate-200" onClick={() => setExpandedYears(p => { const n = new Set(p); if (n.has(grupo.anio)) n.delete(grupo.anio); else n.add(grupo.anio); return n; })}>
                            <td className="px-3 py-3">{isExp ? <ChevronDown className="w-4 h-4 text-indigo-600"/> : <ChevronRight className="w-4 h-4 text-indigo-600"/>}</td>
                            <td className="px-3 py-3 font-bold text-slate-800">📅 {grupo.anio}</td>
                            <td className="px-3 py-3 text-right text-indigo-700 font-bold">${fmt0(grupo.planificado)}</td>
                            <td className="px-3 py-3 text-right text-rose-700 font-bold">${fmt0(grupo.ejecutado)}</td>
                            <td className="px-3 py-3 text-right text-indigo-800 font-bold">${fmt0(ultimoMes.acumPlanificado)}</td>
                            <td className="px-3 py-3 text-right text-emerald-700 font-bold">${fmt0(ultimoMes.acumEjecutado)}</td>
                            <td className="px-3 py-3 text-right text-slate-900 font-bold"><span className="px-2 py-0.5 rounded bg-white border border-slate-200">{pctAnio}%</span></td>
                          </tr>
                          {isExp && grupo.meses.map((m: any, idx: number) => {
                            const pctMes = m.planificado > 0 ? ((m.ejecutado / m.planificado) * 100).toFixed(1) : '0.0';
                            return (
                              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                <td></td>
                                <td className="px-3 py-2 pl-6 text-slate-600 font-medium">{m.mes}</td>
                                <td className="px-3 py-2 text-right text-indigo-600 font-medium">${fmt0(m.planificado)}</td>
                                <td className="px-3 py-2 text-right text-rose-600 font-medium">${fmt0(m.ejecutado)}</td>
                                <td className="px-3 py-2 text-right text-indigo-750 font-medium">${fmt0(m.acumPlanificado)}</td>
                                <td className="px-3 py-2 text-right text-emerald-600 font-medium">${fmt0(m.acumEjecutado)}</td>
                                <td className="px-3 py-2 text-right text-slate-700 font-semibold">{pctMes}%</td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  {/* Total general de la distribución temporal */}
                  {(() => {
                    const totalEjecutado = aniosArr.reduce((acc: number, g: any) => acc + (g.ejecutado || 0), 0);
                    const totalPlanificado = aniosArr.reduce((acc: number, g: any) => acc + (g.planificado || 0), 0);
                    const ultimoGrupo = aniosArr[aniosArr.length - 1];
                    const ultMesUltGrupo = ultimoGrupo?.meses[ultimoGrupo.meses.length - 1];
                    const totalAcumEjec = ultMesUltGrupo?.acumEjecutado || 0;
                    const totalAcumPlan = ultMesUltGrupo?.acumPlanificado || 0;
                    const totalPct = totalPlanificado > 0 ? ((totalEjecutado / totalPlanificado) * 100).toFixed(1) : '0.0';
                    return (
                      <tfoot className="bg-slate-100/90 font-bold border-t-2 border-slate-300">
                        <tr id="total-general-distribucion-row">
                          <td className="px-3 py-3"></td>
                          <td className="px-3 py-3 text-slate-800 font-extrabold uppercase tracking-wide">Total General</td>
                          <td className="px-3 py-3 text-right text-indigo-700 font-extrabold">${fmt0(totalPlanificado)}</td>
                          <td className="px-3 py-3 text-right text-rose-700 font-extrabold">${fmt0(totalEjecutado)}</td>
                          <td className="px-3 py-3 text-right text-indigo-800 font-extrabold">${fmt0(totalAcumPlan)}</td>
                          <td className="px-3 py-3 text-right text-emerald-700 font-extrabold">${fmt0(totalAcumEjec)}</td>
                          <td className="px-3 py-3 text-right text-slate-900 font-extrabold">
                            <span className="px-2.5 py-0.5 rounded bg-indigo-100 border border-indigo-200 text-indigo-800">
                              {totalPct}%
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    );
                  })()}
                </table>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
