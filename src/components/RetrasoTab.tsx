/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Download, ChevronDown, ChevronRight, FileSpreadsheet, Check, ChevronsUpDown, ChevronsDownUp } from 'lucide-react';

interface RetrasoTabProps {
  actividades: any[];
  filterResp: Set<string>;
  setFilterResp: (resp: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  filterTipologiaRetraso: string;
  setFilterTipologiaRetraso: React.Dispatch<React.SetStateAction<string>>;
  expandedRESPs: Set<string>;
  setExpandedRESPs: (resps: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  expandedTipos: Set<string>;
  setExpandedTipos: (tipos: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  expandedSCAPs: Set<string>;
  setExpandedSCAPs: (scaps: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  expandedSubPartidas: Set<string>;
  setExpandedSubPartidas: (subpartidas: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  baseVenta: string;
}

export const RetrasoTab: React.FC<RetrasoTabProps> = ({
  actividades,
  filterResp,
  setFilterResp,
  filterTipologiaRetraso,
  setFilterTipologiaRetraso,
  expandedRESPs,
  setExpandedRESPs,
  expandedTipos,
  setExpandedTipos,
  expandedSCAPs,
  setExpandedSCAPs,
  expandedSubPartidas,
  setExpandedSubPartidas,
  baseVenta,
}) => {
  const getVB = (i: any) => baseVenta === 'contrato' ? (i.ventaM || 0) : (i.venta || 0);
  const [respDropdownOpen, setRespDropdownOpen] = React.useState<boolean>(false);
  const [isCardCollapsed, setIsCardCollapsed] = React.useState<boolean>(false);
  const [filterVariacion, setFilterVariacion] = React.useState<'all' | 'pos' | 'neg'>('neg');
  const [sortVariacionDir, setSortVariacionDir] = React.useState<'desc' | 'asc'>('desc');
  const [expandedSubCs, setExpandedSubCs] = React.useState<Set<string>>(new Set());
  const [copiedRetraso, setCopiedRetraso] = React.useState<boolean>(false);
  const [isExpandMenuOpen, setIsExpandMenuOpen] = React.useState<boolean>(false);
  
  const isStatusFilterActive = !filterResp.has('all');

  const matchStatus = (item: any) => {
    if (!isStatusFilterActive) return true;
    const st = item.p6Status || item.p6 || item.status || '(Sin Status)';
    if (filterResp.has('__EMPTY__') && !st.trim() && (item.ventaPlan > 0 || item.ventaEjecutada > 0)) return true;
    return filterResp.has(st);
  };

  const isP6Item = (item: any) => {
    const wbsRawStr = String(item.wbsRaw || '').toLowerCase();
    const wbsStr = String(item.wbs || '').toLowerCase();
    return wbsRawStr.includes('p6') || wbsStr.includes('p6');
  };

  const itemsConRetraso = actividades.filter(item =>
    item.esItemHoja &&
    ((item.ventaPlan || 0) > 0 || (item.ventaEjecutada || 0) > 0)
  );

  const fmt = (v: any) => (v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  const fmtD = (d: number) => d < 0 
    ? `($${Math.abs(d).toLocaleString('en-US', { minimumFractionDigits: 2 })})` 
    : `$${(d || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  const fmtDateVal = (d: Date | string | null | undefined): string => {
    if (!d) return '—';
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return '—';
    const day = String(dt.getDate()).padStart(2, '0');
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const year = dt.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const planTotalProyecto = actividades
    .filter(a => a.esItemHoja)
    .reduce((s, a) => s + (a.ventaM || 0), 0);

  const retrasoPct = (desviacion: number) => {
    if (!planTotalProyecto || planTotalProyecto === 0) return '0.0';
    return (Math.abs(desviacion || 0) / planTotalProyecto * 100).toFixed(2);
  };

  const renderPctVar = (desviacion: number) => {
    if (!planTotalProyecto || planTotalProyecto === 0) return <span className="text-gray-400" style={{ fontSize: '11px' }}>0.00%</span>;
    const pct = (desviacion / planTotalProyecto * 100);
    const abs = Math.abs(pct).toFixed(2);
    return pct < 0
      ? <span className="font-semibold text-red-600" style={{ fontSize: '11px' }}>({abs}%)</span>
      : <span className="font-semibold text-green-700" style={{ fontSize: '11px' }}>{abs}%</span>;
  };

  if (actividades.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 bg-white m-4 rounded-lg shadow">
        Carga el Master Plan para ver los retrasos.
      </div>
    );
  }

  if (itemsConRetraso.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 bg-white m-4 rounded-lg shadow">
        ✅ No hay subpartidas retrasadas PG-003. (items hoja: {actividades.filter(a => a.esItemHoja).length})
      </div>
    );
  }

  const filteredItems = itemsConRetraso.filter(item => {
    if (isStatusFilterActive && !matchStatus(item)) return false;
    if (filterTipologiaRetraso !== 'all' && item.tipo !== filterTipologiaRetraso) {
      return false;
    }
    const variacion = (item.ventaEjecutada || 0) - (item.ventaPlan || 0);
    if (filterVariacion === 'pos' && variacion <= 0) return false;
    if (filterVariacion === 'neg' && variacion >= 0) return false;
    return true;
  });

  const tipologiasRetraso: Record<string, any> = {};
  itemsConRetraso.forEach(item => {
    if (isStatusFilterActive && !matchStatus(item)) return;
    const variacion = (item.ventaEjecutada || 0) - (item.ventaPlan || 0);
    if (filterVariacion === 'pos' && variacion <= 0) return;
    if (filterVariacion === 'neg' && variacion >= 0) return;
    const tipo = item.tipo || '(Sin Tipo)';
    if (!tipologiasRetraso[tipo]) {
      tipologiasRetraso[tipo] = { nombre: tipo, ventaPlan: 0, ventaEjecutada: 0, desviacion: 0, items: 0 };
    }
    tipologiasRetraso[tipo].ventaPlan += (item.ventaPlan || 0);
    tipologiasRetraso[tipo].ventaEjecutada += (item.ventaEjecutada || 0);
    tipologiasRetraso[tipo].items += 1;
  });

  Object.values(tipologiasRetraso).forEach(t => {
    t.desviacion = t.ventaEjecutada - t.ventaPlan;
    t.avance = t.ventaPlan > 0 ? ((t.ventaEjecutada / t.ventaPlan) * 100).toFixed(2) : '0.00';
  });

  const tipologiasArr = Object.values(tipologiasRetraso)
    .filter((t: any) => t.items > 0 && Math.abs(t.desviacion) > 0.001)
    .sort((a: any, b: any) => Math.abs(b.desviacion) - Math.abs(a.desviacion));

  // Primary grouping by Tipo (Columna H de CDO Master), then by Grupo (Columna AD), SCAP, SubC (Columna N), CAP
  const byTipo: Record<string, any> = {};
  filteredItems.forEach(item => {
    const t = item.tipo || '(Sin Tipo)';
    const g = item.grupo || '(Sin Grupo)';
    const s = item.scap || '(Sin SCAP)';
    const subC = (item.subcontratista || item.subC || '').trim() || '(Sin SubC)';
    const c = item.cap || '(Sin CAP)';
    if (!byTipo[t]) byTipo[t] = {};
    if (!byTipo[t][g]) byTipo[t][g] = {};
    if (!byTipo[t][g][s]) byTipo[t][g][s] = {};
    if (!byTipo[t][g][s][subC]) byTipo[t][g][s][subC] = {};
    if (!byTipo[t][g][s][subC][c]) byTipo[t][g][s][subC][c] = [];
    byTipo[t][g][s][subC][c].push(item);
  });

  const tot = (items: any[]) => {
    const p = items.reduce((s, i) => s + (i.ventaPlan || 0), 0);
    const e = items.reduce((s, i) => s + (i.ventaEjecutada || 0), 0);
    const v = items.reduce((s, i) => s + getVB(i), 0);

    let maxBlFinish: Date | null = null;
    let maxFinish: Date | null = null;

    items.forEach(i => {
      if (i.blFinish) {
        const dt = i.blFinish instanceof Date ? i.blFinish : new Date(i.blFinish);
        if (!isNaN(dt.getTime())) {
          if (!maxBlFinish || dt.getTime() > maxBlFinish.getTime()) {
            maxBlFinish = dt;
          }
        }
      }
      if (i.finish) {
        const dt = i.finish instanceof Date ? i.finish : new Date(i.finish);
        if (!isNaN(dt.getTime())) {
          if (!maxFinish || dt.getTime() > maxFinish.getTime()) {
            maxFinish = dt;
          }
        }
      }
    });

    return { 
      venta: v, 
      plan: p, 
      ejec: e, 
      desv: e - p, 
      count: items.length,
      maxBlFinish,
      maxFinish
    };
  };

  const sortedTipos = Object.entries(byTipo).sort((a: any, b: any) => {
    const gruposA = a[1];
    const gruposB = b[1];
    const calcSumDesv = (o: any): number => {
      let sVal = 0;
      if (!o) return 0;
      for (const gKey in o) {
        const g = o[gKey];
        for (const sKey in g) {
          const s = g[sKey];
          for (const subKey in s) {
            const sub = s[subKey];
            for (const cKey in sub) {
              const arr = sub[cKey];
              if (Array.isArray(arr)) {
                for (const item of arr) {
                  sVal += (item.ventaEjecutada || 0) - (item.ventaPlan || 0);
                }
              }
            }
          }
        }
      }
      return sVal;
    };
    const desvA = calcSumDesv(gruposA);
    const desvB = calcSumDesv(gruposB);
    return sortVariacionDir === 'asc' ? desvA - desvB : desvB - desvA;
  });

  const globalTot = tot(filteredItems);
  const statusDisponibles = [...new Set(itemsConRetraso.map(i => i.p6Status || i.p6 || i.status || '(Sin Status)').filter(Boolean))].sort();

  const handleExportVisible = () => {
    const tsvRows: string[] = [];
    tsvRows.push(["WBS / Nivel", "Activity ID", "Descripción", "BL Finish (Y)", "V. Contrato", "V. Plan", "V. Ejecutada", "Variación", "% Variación"].join("\t"));

    const htmlRowsArray: string[] = [];

    const fmtNum = (v: number) => (v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtDNum = (d: number) => d < 0 ? `($${Math.abs(d).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : `$${(d || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const addRowHtml = (
      wbsText: string,
      actId: string,
      desc: string,
      blFinishStr: string,
      vContrato: number,
      vPlan: number,
      vEjec: number,
      desv: number,
      bg: string,
      fg: string,
      fontWeight: string,
      fontSize: string,
      indentPx: number = 0
    ) => {
      const pctVar = planTotalProyecto > 0 ? (desv / planTotalProyecto * 100) : 0;
      const pctStr = `${pctVar >= 0 ? '+' : ''}${pctVar.toFixed(4)}%`;
      const desvColor = desv < 0 ? '#b91c1c' : '#15803d';

      tsvRows.push([
        wbsText,
        actId,
        desc,
        blFinishStr,
        fmtNum(vContrato),
        fmtNum(vPlan),
        fmtNum(vEjec),
        fmtNum(desv),
        pctStr
      ].join("\t"));

      const indentHtml = indentPx > 0 ? `<span style="display:inline-block; width:${indentPx}px;"></span>` : '';

      htmlRowsArray.push(`
        <tr style="background-color: ${bg}; color: ${fg}; font-weight: ${fontWeight}; font-size: ${fontSize};">
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; font-family: monospace;">${indentHtml}${wbsText}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; font-family: monospace;">${actId}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1;">${desc}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace;">${blFinishStr}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace;">$${fmtNum(vContrato)}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; color: #1d4ed8;">$${fmtNum(vPlan)}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; color: #15803d;">$${fmtNum(vEjec)}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; color: ${desvColor};">${fmtDNum(desv)}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; color: ${desvColor};">${pctStr}</td>
        </tr>
      `.trim());
    };

    sortedTipos.forEach(([tipo, grupos]) => {
      const tipoKey = tipo;
      const isTipoExp = expandedTipos.has(tipoKey);
      const allItemsInTipo = Object.values(grupos).flatMap((g: any) => Object.values(g).flatMap((s: any) => Object.values(s).flatMap((sub: any) => Object.values(sub).flat())));
      if (allItemsInTipo.length === 0) return;
      const tT = tot(allItemsInTipo);
      if (tT.count === 0) return;

      addRowHtml(
        `🏷️ ${tipo}`,
        '',
        `(${tT.count} items)`,
        fmtDateVal(tT.maxBlFinish),
        tT.venta,
        tT.plan,
        tT.ejec,
        tT.desv,
        '#e0e7ff',
        '#1e1b4b',
        'bold',
        '11px',
        0
      );

      if (isTipoExp) {
        const sortedGrupos = Object.entries(grupos).sort((a: any, b: any) => {
          const getDesv = (o: any): number => {
            let sVal = 0;
            if (!o) return 0;
            for (const sKey in o) {
              for (const subKey in o[sKey]) {
                for (const cKey in o[sKey][subKey]) {
                  const arr = o[sKey][subKey][cKey];
                  if (Array.isArray(arr)) {
                    for (const item of arr) {
                      sVal += (item.ventaEjecutada || 0) - (item.ventaPlan || 0);
                    }
                  }
                }
              }
            }
            return sVal;
          };
          const dA = getDesv(a[1]);
          const dB = getDesv(b[1]);
          return sortVariacionDir === 'asc' ? dA - dB : dB - dA;
        });

        sortedGrupos.forEach(([grupo, scaps]: any) => {
          const grupoKey = `${tipo}__${grupo}`;
          const isGrupoExp = expandedRESPs.has(grupoKey);
          const allG = Object.values(scaps).flatMap((s: any) => Object.values(s).flatMap((sub: any) => Object.values(sub).flat()));
          if (allG.length === 0) return;
          const gT = tot(allG);
          if (gT.count === 0) return;

          addRowHtml(
            `📁 ${grupo}`,
            '',
            `(${gT.count} items)`,
            fmtDateVal(gT.maxBlFinish),
            gT.venta,
            gT.plan,
            gT.ejec,
            gT.desv,
            '#f3e8ff',
            '#581c87',
            'bold',
            '11px',
            12
          );

          if (isGrupoExp) {
            const sortedScaps = Object.entries(scaps).sort((a: any, b: any) => {
              const getDesv = (o: any): number => {
                let sVal = 0;
                if (!o) return 0;
                for (const subKey in o) {
                  for (const cKey in o[subKey]) {
                    const arr = o[subKey][cKey];
                    if (Array.isArray(arr)) {
                      for (const item of arr) {
                        sVal += (item.ventaEjecutada || 0) - (item.ventaPlan || 0);
                      }
                    }
                  }
                }
                return sVal;
              };
              const dA = getDesv(a[1]);
              const dB = getDesv(b[1]);
              return sortVariacionDir === 'asc' ? dA - dB : dB - dA;
            });

            sortedScaps.forEach(([scap, subCs]: any) => {
              const scapKey = `${grupoKey}__${scap}`;
              const isScapExp = expandedSCAPs.has(scapKey);
              const allS = Object.values(subCs).flatMap((sub: any) => Object.values(sub).flat());
              if (allS.length === 0) return;
              const sT = tot(allS);
              if (sT.count === 0) return;

              addRowHtml(
                `📦 ${scap}`,
                '',
                `(${sT.count} items)`,
                fmtDateVal(sT.maxBlFinish),
                sT.venta,
                sT.plan,
                sT.ejec,
                sT.desv,
                '#dbeafe',
                '#1e40af',
                'semibold',
                '10.5px',
                24
              );

              if (isScapExp) {
                const sortedSubCs = Object.entries(subCs).sort((a: any, b: any) => {
                  const getDesv = (o: any): number => {
                    let sVal = 0;
                    if (!o) return 0;
                    for (const cKey in o) {
                      const arr = o[cKey];
                      if (Array.isArray(arr)) {
                        for (const item of arr) {
                          sVal += (item.ventaEjecutada || 0) - (item.ventaPlan || 0);
                        }
                      }
                    }
                    return sVal;
                  };
                  const dA = getDesv(a[1]);
                  const dB = getDesv(b[1]);
                  return sortVariacionDir === 'asc' ? dA - dB : dB - dA;
                });

                sortedSubCs.forEach(([subC, caps]: any) => {
                  const subCKey = `${scapKey}__${subC}`;
                  const isSubCExp = expandedSubCs.has(subCKey);
                  const allSubC = Object.values(caps).flat();
                  if (allSubC.length === 0) return;
                  const subCTot = tot(allSubC);
                  if (subCTot.count === 0) return;

                  addRowHtml(
                    `🏗️ SubC: ${subC}`,
                    '',
                    `(${subCTot.count} items)`,
                    fmtDateVal(subCTot.maxBlFinish),
                    subCTot.venta,
                    subCTot.plan,
                    subCTot.ejec,
                    subCTot.desv,
                    '#fef3c7',
                    '#78350f',
                    'semibold',
                    '10.5px',
                    36
                  );

                  if (isSubCExp) {
                    const sortedCaps = Object.entries(caps).sort((a: any, b: any) => {
                      const getDesv = (arr: any): number => {
                        if (!Array.isArray(arr)) return 0;
                        return arr.reduce((s, item) => s + ((item.ventaEjecutada || 0) - (item.ventaPlan || 0)), 0);
                      };
                      const dA = getDesv(a[1]);
                      const dB = getDesv(b[1]);
                      return sortVariacionDir === 'asc' ? dA - dB : dB - dA;
                    });

                    sortedCaps.forEach(([cap, items]: any) => {
                      const capKey = `${subCKey}__${cap}`;
                      const isCapExp = expandedSubPartidas.has(capKey);
                      if (!Array.isArray(items) || items.length === 0) return;
                      const cT = tot(items);
                      if (cT.count === 0) return;

                      addRowHtml(
                        `📄 ${cap}`,
                        '',
                        `(${cT.count} items)`,
                        fmtDateVal(cT.maxBlFinish),
                        cT.venta,
                        cT.plan,
                        cT.ejec,
                        cT.desv,
                        '#f1f5f9',
                        '#334155',
                        'medium',
                        '10px',
                        48
                      );

                      if (isCapExp && Array.isArray(items)) {
                        items.forEach((item: any) => {
                          const iP = item.ventaPlan || 0;
                          const iE = item.ventaEjecutada || 0;
                          const iV = getVB(item);
                          const iD = iE - iP;

                          addRowHtml(
                            String(item.wbs || '').trim(),
                            item.activityId || '',
                            item.descripcion || '',
                            fmtDateVal(item.blFinish),
                            iV,
                            iP,
                            iE,
                            iD,
                            '#ffffff',
                            '#475569',
                            'normal',
                            '9.5px',
                            60
                          );
                        });
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }
    });

    // TOTAL PROYECTO ROW
    addRowHtml(
      'TOTAL PROYECTO',
      '',
      `(${filteredItems.length.toLocaleString()} items con desviación)`,
      fmtDateVal(globalTot.maxBlFinish),
      globalTot.venta,
      globalTot.plan,
      globalTot.ejec,
      globalTot.desv,
      '#c7d2fe',
      '#0f172a',
      'bold',
      '11.5px',
      0
    );

    const tsvContent = tsvRows.join("\n");
    const htmlRows = htmlRowsArray.join("\n");

    const htmlContent = `
      <table style="border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; width: 100%;">
        <thead>
          <tr style="background-color: #312e81; color: #ffffff; font-weight: bold; text-align: left;">
            <th style="padding: 8px 10px; border: 1px solid #94a3b8; font-weight: bold;">WBS / Nivel</th>
            <th style="padding: 8px 10px; border: 1px solid #94a3b8; font-weight: bold;">Activity ID</th>
            <th style="padding: 8px 10px; border: 1px solid #94a3b8; font-weight: bold;">Descripción</th>
            <th style="padding: 8px 10px; border: 1px solid #94a3b8; font-weight: bold; text-align: center;">BL Finish (Y)</th>
            <th style="padding: 8px 10px; border: 1px solid #94a3b8; font-weight: bold; text-align: right;">V. Contrato</th>
            <th style="padding: 8px 10px; border: 1px solid #94a3b8; font-weight: bold; text-align: right;">V. Plan</th>
            <th style="padding: 8px 10px; border: 1px solid #94a3b8; font-weight: bold; text-align: right;">V. Ejecutada</th>
            <th style="padding: 8px 10px; border: 1px solid #94a3b8; font-weight: bold; text-align: right;">Variación</th>
            <th style="padding: 8px 10px; border: 1px solid #94a3b8; font-weight: bold; text-align: right;">% Variación</th>
          </tr>
        </thead>
        <tbody>
          ${htmlRows}
        </tbody>
      </table>
    `.trim();

    try {
      const clipboardItem = new ClipboardItem({
        "text/plain": new Blob([tsvContent], { type: "text/plain" }),
        "text/html": new Blob([htmlContent], { type: "text/html" })
      });
      navigator.clipboard.write([clipboardItem]).then(() => {
        setCopiedRetraso(true);
        setTimeout(() => setCopiedRetraso(false), 2000);
      }).catch((err) => {
        console.error("Rich copy failed, falling back to plain text:", err);
        navigator.clipboard.writeText(tsvContent).then(() => {
          setCopiedRetraso(true);
          setTimeout(() => setCopiedRetraso(false), 2000);
        });
      });
    } catch (e) {
      console.error("ClipboardItem not supported, falling back to plain text:", e);
      navigator.clipboard.writeText(tsvContent).then(() => {
        setCopiedRetraso(true);
        setTimeout(() => setCopiedRetraso(false), 2000);
      });
    }
  };

  const handleExpandToLevel = (targetLevel: number) => {
    const allTipos = new Set<string>();
    const allGrupos = new Set<string>();
    const allScaps = new Set<string>();
    const allSubCs = new Set<string>();
    const allCaps = new Set<string>();

    sortedTipos.forEach(([tipo, grupos]) => {
      allTipos.add(tipo);
      if (targetLevel >= 2) {
        Object.entries(grupos).forEach(([grupo, scaps]: any) => {
          const gKey = `${tipo}__${grupo}`;
          allGrupos.add(gKey);
          if (targetLevel >= 3) {
            Object.entries(scaps).forEach(([scap, subCs]: any) => {
              const sKey = `${gKey}__${scap}`;
              allScaps.add(sKey);
              if (targetLevel >= 4) {
                Object.entries(subCs).forEach(([subC, caps]: any) => {
                  const subCKey = `${sKey}__${subC}`;
                  allSubCs.add(subCKey);
                  if (targetLevel >= 5) {
                    Object.entries(caps).forEach(([cap]: any) => {
                      allCaps.add(`${subCKey}__${cap}`);
                    });
                  }
                });
              }
            });
          }
        });
      }
    });

    setExpandedTipos(targetLevel >= 1 ? allTipos : new Set());
    setExpandedRESPs(targetLevel >= 2 ? allGrupos : new Set());
    setExpandedSCAPs(targetLevel >= 3 ? allScaps : new Set());
    setExpandedSubCs(targetLevel >= 4 ? allSubCs : new Set());
    setExpandedSubPartidas(targetLevel >= 5 ? allCaps : new Set());
  };

  const handleCollapseAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTipos(new Set());
    setExpandedRESPs(new Set());
    setExpandedSCAPs(new Set());
    setExpandedSubCs(new Set());
    setExpandedSubPartidas(new Set());
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-indigo-200 overflow-hidden animate-fade-in mt-4" id="retrasos-tab-container">
      <style>{`.hide-scrollbar::-webkit-scrollbar{display:none}`}</style>
      
      {/* Header */}
      <div 
        onClick={() => setIsCardCollapsed(!isCardCollapsed)}
        className="bg-gradient-to-r from-indigo-50/50 to-purple-50/50 px-3 py-1.5 border-b border-indigo-100 flex items-center justify-between flex-wrap gap-2 cursor-pointer select-none hover:bg-indigo-100/30 transition-all"
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center text-indigo-950">
            {isCardCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
          <span className="text-indigo-950 font-bold text-xs flex items-center gap-1.5">
            ⚠️ Retraso Económico por Tipología (Columna H CDO): {
              filterTipologiaRetraso !== 'all'
                ? (filterTipologiaRetraso.includes('.') ? filterTipologiaRetraso.split('.')[1] : filterTipologiaRetraso)
                : (isStatusFilterActive ? [...filterResp].filter(x => x !== 'all').join(', ') : 'Todas las Tipologías')
            }
          </span>
          <span className="text-[9px] bg-indigo-100/80 text-indigo-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">{filteredItems.length.toLocaleString()} items con desviación</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
          {/* Botón Exportar Visible con formato (estilo Gantt) */}
          <button
            id="btn-export-retrasos-visible"
            onClick={handleExportVisible}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-all text-[10px] font-bold shadow-mini shrink-0 cursor-pointer active:scale-95 ${
              copiedRetraso
                ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 shadow-emerald-500/15'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-950'
            }`}
            title="Copiar datos visibles estructurados con formato (colores e indentación) para pegar en Excel"
          >
            {copiedRetraso ? (
              <>
                <Check className="w-3.5 h-3.5 text-white animate-scale-up" />
                <span>¡Copiado!</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export</span>
              </>
            )}
          </button>

          {/* Menu Dropdown Expandir por Nivel */}
          <div className="relative">
            <button
              id="btn-expand-retrasos-level"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpandMenuOpen(!isExpandMenuOpen);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-950 transition-all text-[10px] font-bold shadow-mini shrink-0 cursor-pointer active:scale-95"
              title="Seleccionar el nivel jerárquico hasta el que desea expandir la vista"
            >
              <ChevronsUpDown className="w-3.5 h-3.5 text-indigo-600" />
              <span>Exp. Nivel</span>
              <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
            </button>

            {isExpandMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={(e) => { e.stopPropagation(); setIsExpandMenuOpen(false); }} 
                />
                <div className="absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1 text-[11px] animate-fade-in select-none">
                  <div className="px-3 py-1 font-semibold text-slate-400 text-[9px] uppercase tracking-wider border-b border-slate-100">
                    Expandir hasta Nivel
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleExpandToLevel(1); setIsExpandMenuOpen(false); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 hover:text-indigo-900 text-slate-700 font-medium flex items-center justify-between"
                  >
                    <span>Nivel 1: Tipologías</span>
                    <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-mono font-bold">N1</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleExpandToLevel(2); setIsExpandMenuOpen(false); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-purple-50 hover:text-purple-900 text-slate-700 font-medium flex items-center justify-between"
                  >
                    <span>Nivel 2: Grupos</span>
                    <span className="text-[9px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-mono font-bold">N2</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleExpandToLevel(3); setIsExpandMenuOpen(false); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-50 hover:text-blue-900 text-slate-700 font-medium flex items-center justify-between"
                  >
                    <span>Nivel 3: SCAPs</span>
                    <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono font-bold">N3</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleExpandToLevel(4); setIsExpandMenuOpen(false); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-amber-50 hover:text-amber-900 text-slate-700 font-medium flex items-center justify-between"
                  >
                    <span>Nivel 4: Subcontratistas</span>
                    <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-mono font-bold">N4</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleExpandToLevel(5); setIsExpandMenuOpen(false); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100 hover:text-slate-900 text-slate-700 font-medium flex items-center justify-between"
                  >
                    <span>Nivel 5: Subpartidas (CAP)</span>
                    <span className="text-[9px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-mono font-bold">N5</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleExpandToLevel(6); setIsExpandMenuOpen(false); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-emerald-50 hover:text-emerald-900 text-slate-700 font-semibold flex items-center justify-between border-t border-slate-100"
                  >
                    <span>Nivel 6: Actividades (Todo)</span>
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">Todo</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Colapsar Todo */}
          <button
            id="btn-collapse-retrasos-all"
            onClick={handleCollapseAll}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-950 transition-all text-[10px] font-bold shadow-mini shrink-0 cursor-pointer active:scale-95"
            title="Colapsar toda la jerarquía"
          >
            <ChevronsDownUp className="w-3.5 h-3.5 text-slate-500" />
            <span>Colapsar todo</span>
          </button>

          {/* Exportar CSV plano */}
          <button 
            id="btn-export-retrasos-csv"
            onClick={(e) => {
              e.stopPropagation();
              const rows = [['Tipo (Col H)', 'Grupo (Col AD)', 'Status (Col W)', 'SCAP', 'SubC (Col N)', 'CAP', 'WBS', 'Activity ID', 'Descripcion', 'BL Finish (Col Y)', 'V.Contrato', 'V.Plan', 'V.Ejecutada', 'Variación', '% Variación']];
              const fmtNum = (v: number) => (v || 0).toFixed(2);
              const esc = (v: any) => { 
                const s = String(v == null ? '' : v); 
                return s.includes(';') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s; 
              };
              filteredItems.forEach(item => {
                const variacion = (item.ventaEjecutada || 0) - (item.ventaPlan || 0);
                const pctVar = planTotalProyecto > 0 ? (variacion / planTotalProyecto * 100) : 0;
                const subCVal = (item.subcontratista || item.subC || '').trim();
                rows.push([
                  item.tipo || '', item.grupo || '', item.p6Status || item.p6 || item.status || '', item.scap || '', subCVal, item.cap || '',
                  String(item.wbs || ''), String(item.activityId || ''), item.descripcion || '',
                  fmtDateVal(item.blFinish),
                  fmtNum(getVB(item)), fmtNum(item.ventaPlan), fmtNum(item.ventaEjecutada),
                  fmtNum(variacion), pctVar.toFixed(4)
                ]);
              });
              const csv = rows.map(r => r.map(esc).join(';')).join('\r\n');
              const b64 = btoa(unescape(encodeURIComponent('﻿' + csv)));
              const a = document.createElement('a'); 
              a.href = `data:text/csv;charset=utf-8;base64,${b64}`; 
              a.download = 'Retrasos_Economicos_Tipologia.csv'; 
              document.body.appendChild(a); 
              a.click(); 
              document.body.removeChild(a);
            }} 
            className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-1 rounded-xl border border-slate-200 transition-all shrink-0 cursor-pointer active:scale-95"
            title="Descargar listado completo en formato CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" /> CSV
          </button>
        </div>
      </div>

      {isCardCollapsed ? null : (
        <>
          {/* Filtro Status (Columna W p6) — Multi-Select */}
      <div className="px-3 py-1.5 border-b bg-gray-50 flex items-center gap-2 flex-wrap">
        <label className="text-xs font-medium text-gray-700">Filtrar por status:</label>
        <div className="relative">
          <button
            id="btn-filter-status-dropdown"
            onClick={() => setRespDropdownOpen(o => !o)}
            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white flex items-center gap-1.5 min-w-[160px] justify-between"
          >
            <span className="truncate">
              {filterResp.has('all') ? 'Todos los Status' : [...filterResp].join(', ')}
            </span>
            <ChevronDown className="w-3 h-3 flex-shrink-0 text-gray-500" />
          </button>
          {respDropdownOpen && (
            <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded shadow-md min-w-[200px] max-h-56 overflow-y-auto">
              <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 cursor-pointer border-b">
                <input 
                  type="checkbox" 
                  checked={filterResp.has('all')}
                  onChange={() => setFilterResp(new Set(['all']))}
                  className="rounded" 
                />
                <span className="text-xs font-medium">Todos</span>
              </label>
              {statusDisponibles.map(st => (
                <label key={st} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={filterResp.has(st)}
                    onChange={() => {
                      setFilterResp(prev => {
                        const next = new Set(prev);
                        next.delete('all');
                        if (next.has(st)) { 
                          next.delete(st); 
                        } else { 
                          next.add(st); 
                        }
                        if (next.size === 0) next.add('all');
                        return next;
                      });
                    }}
                    className="rounded" 
                  />
                  <span className="text-xs">{st}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        {isStatusFilterActive && (
          <button 
            id="btn-clear-status-filter"
            onClick={() => { setFilterResp(new Set(['all'])); setRespDropdownOpen(false); }}
            className="text-[11px] text-blue-600 hover:text-blue-800"
          >
            Limpiar ✕
          </button>
        )}

        {/* Botones de Variación (+ / -) */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs font-medium text-gray-700">Variación:</span>
          <button
            id="btn-filter-variacion-pos"
            onClick={() => {
              setFilterVariacion(prev => {
                if (prev === 'pos') return 'all';
                setSortVariacionDir('desc');
                return 'pos';
              });
            }}
            className={`text-xs font-bold px-2.5 py-1 rounded transition-all shadow-sm flex items-center gap-1 border ${
              filterVariacion === 'pos'
                ? 'bg-emerald-700 text-white border-emerald-800 ring-2 ring-emerald-400'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'
            }`}
          >
            Variacion (+)
          </button>
          <button
            id="btn-filter-variacion-neg"
            onClick={() => {
              setFilterVariacion(prev => {
                if (prev === 'neg') return 'all';
                setSortVariacionDir('asc');
                return 'neg';
              });
            }}
            className={`text-xs font-bold px-2.5 py-1 rounded transition-all shadow-sm flex items-center gap-1 border ${
              filterVariacion === 'neg'
                ? 'bg-red-700 text-white border-red-800 ring-2 ring-red-400'
                : 'bg-red-600 hover:bg-red-700 text-white border-red-700'
            }`}
          >
            Variacion (-)
          </button>
          {filterVariacion !== 'all' && (
            <button
              id="btn-clear-variacion-filter"
              onClick={() => setFilterVariacion('all')}
              className="text-[11px] text-gray-600 hover:text-gray-900 bg-gray-200 hover:bg-gray-300 px-2 py-0.5 rounded font-medium"
            >
              Mostrar Todos ✕
            </button>
          )}
        </div>
      </div>

      {/* Tarjetas de Análisis por Tipología (Columna H) */}
      {tipologiasArr.length > 0 && (
        <div className="px-3 py-2 border-b bg-slate-50/50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span>🏷️ Retraso Económico por Tipología (Columna H CDO)</span>
            </h3>
            {filterTipologiaRetraso !== 'all' && (
              <button
                id="btn-clear-tip-retraso-filter"
                onClick={() => setFilterTipologiaRetraso('all')}
                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                Limpiar filtro: {filterTipologiaRetraso.split('.')[1] || filterTipologiaRetraso} ✕
              </button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {tipologiasArr.slice(0, 8).map((tip: any, index) => {
              const colorClasses: Record<string, string> = {
                '01.Preliminares': 'bg-gray-50 border-gray-300 hover:bg-gray-100',
                '02.Obra Civil': 'bg-blue-50 border-blue-300 hover:bg-blue-100',
                '03.Equipo Mecanico': 'bg-purple-50 border-purple-300 hover:bg-purple-100',
                '04.Equipo Electrico': 'bg-yellow-50 border-yellow-300 hover:bg-yellow-100',
                '07.Tuberia': 'bg-cyan-50 border-cyan-300 hover:bg-cyan-100',
                '09.Obra Arquitectonica': 'bg-pink-50 border-pink-300 hover:bg-pink-100'
              };
              const textColorClasses: Record<string, string> = {
                '01.Preliminares': 'text-gray-800',
                '02.Obra Civil': 'text-blue-900',
                '03.Equipo Mecanico': 'text-purple-900',
                '04.Equipo Electrico': 'text-amber-900',
                '07.Tuberia': 'text-cyan-900',
                '09.Obra Arquitectonica': 'text-pink-900'
              };
              const barColorClasses: Record<string, string> = {
                '01.Preliminares': 'bg-gray-500',
                '02.Obra Civil': 'bg-blue-500',
                '03.Equipo Mecanico': 'bg-purple-500',
                '04.Equipo Electrico': 'bg-amber-500',
                '07.Tuberia': 'bg-cyan-500',
                '09.Obra Arquitectonica': 'bg-pink-500'
              };
              const colorClass = colorClasses[tip.nombre] || 'bg-slate-50 border-slate-300 hover:bg-slate-100';
              const textColor = textColorClasses[tip.nombre] || 'text-slate-800';
              const barColor = barColorClasses[tip.nombre] || 'bg-slate-500';
              const isSelected = filterTipologiaRetraso === tip.nombre;
              const desvAbs = Math.abs(tip.desviacion);
              const desvFmt = desvAbs >= 1000000
                ? `$${(desvAbs / 1000000).toFixed(2)}M`
                : `$${(desvAbs / 1000).toFixed(1)}K`;
              return (
                <div
                  key={index}
                  id={`card-retraso-${tip.nombre.replace(/[^a-zA-Z0-9]/g, '-')}`}
                  className={`flex-1 min-w-[130px] max-w-[160px] border rounded-lg p-2 cursor-pointer transition-all flex flex-col justify-between shadow-xs ${isSelected ? 'ring-2 ring-indigo-600 ring-offset-1 bg-indigo-50/70 border-indigo-400' : colorClass}`}
                  onClick={() => setFilterTipologiaRetraso(isSelected ? 'all' : tip.nombre)}
                >
                  <div className="flex justify-between items-start gap-1 mb-1">
                    <h4 className={`font-bold text-[11px] ${textColor} leading-tight truncate`} title={tip.nombre}>
                      {tip.nombre.includes('.') ? tip.nombre.split('.')[1] : tip.nombre}
                    </h4>
                    <span className="text-[9px] px-1 py-0.2 bg-white/80 rounded font-semibold text-slate-600 flex-shrink-0">{tip.items}</span>
                  </div>
                  <div>
                    <div className="flex justify-between items-baseline leading-none mb-1">
                      <span className="text-[9px] font-medium text-slate-500 uppercase tracking-tight">Variación $</span>
                      <p className={`text-xs font-black ${tip.desviacion >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {tip.desviacion >= 0 ? desvFmt : `(${desvFmt})`}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex justify-between items-center text-[9px] leading-none">
                        <span className={`opacity-75 ${textColor}`}>Ejecutado</span>
                        <span className={`font-bold ${textColor}`}>{tip.avance}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/80 rounded-full overflow-hidden border border-black/5">
                        <div className={`h-full ${barColor}`} style={{ width: `${Math.min(parseFloat(tip.avance), 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Encabezados de Tabla */}
      <div className="px-3 py-1 bg-slate-100 border-b text-[10px] font-bold text-slate-600 grid gap-2" style={{ gridTemplateColumns: '1fr 90px 2fr 85px 1.4fr 1.4fr 1.4fr 1.4fr 0.9fr' }}>
        <div>WBS</div>
        <div>Activity ID</div>
        <div>Descripción</div>
        <div className="text-center font-semibold text-slate-700" title="BL Finish (Columna Y de pestaña CDO)">BL Finish (Y)</div>
        <div className="text-right">V. Contrato</div>
        <div className="text-right">V. Plan</div>
        <div className="text-right">V. Ejecutada</div>
        <div 
          id="th-header-variacion"
          className="text-right cursor-pointer hover:bg-indigo-100/80 px-1 py-0.5 rounded flex items-center justify-end gap-1 select-none text-indigo-700 font-extrabold transition-colors"
          onClick={() => setSortVariacionDir(prev => prev === 'desc' ? 'asc' : 'desc')}
          title="Haz clic para ordenar de mayor a menor o viceversa"
        >
          <span>Variación</span>
          <span className="text-[10px] px-1 py-0.2 bg-indigo-200 text-indigo-900 rounded font-extrabold shadow-xs">
            {sortVariacionDir === 'desc' ? '▼' : '▲'}
          </span>
        </div>
        <div className="text-right">% Variación</div>
      </div>

      {/* Tabla Agrupada Principalmente por Tipología (Columna H CDO) */}
      <div className="w-full">
        {sortedTipos.map(([tipo, grupos]) => {
          const tipoKey = tipo;
          const isTipoExp = expandedTipos.has(tipoKey);
          const allItemsInTipo = Object.values(grupos).flatMap((g: any) => Object.values(g).flatMap((s: any) => Object.values(s).flatMap((sub: any) => Object.values(sub).flat())));
          if (allItemsInTipo.length === 0) return null;
          const tT = tot(allItemsInTipo);
          if (tT.count === 0) return null;
          return (
            <div key={tipo} className="border-b border-slate-200">
              {/* Nivel 1: Tipología (Columna H CDO) */}
              <div 
                className="grid gap-2 px-3 py-2 bg-indigo-50/90 hover:bg-indigo-100/80 cursor-pointer border-b border-indigo-200" 
                style={{ gridTemplateColumns: '1fr 90px 2fr 85px 1.4fr 1.4fr 1.4fr 1.4fr 0.9fr' }}
                onClick={() => setExpandedTipos(prev => {
                  const n = new Set(prev);
                  if (n.has(tipoKey)) n.delete(tipoKey);
                  else n.add(tipoKey);
                  return n;
                })}
              >
                <div className="flex items-center gap-1 col-span-3 min-w-0 overflow-hidden whitespace-nowrap flex-nowrap">
                  {isTipoExp ? <ChevronDown className="w-4 h-4 text-indigo-700 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-indigo-700 flex-shrink-0" />}
                  <span className="font-bold text-indigo-950 text-xs truncate">🏷️ {tipo}</span>
                  <span className="text-[10px] text-indigo-700 font-medium flex-shrink-0">({tT.count} items)</span>
                </div>
                <div className="text-center font-bold text-indigo-950 text-[10px] font-mono self-center truncate" title={`BL Finish Máx: ${fmtDateVal(tT.maxBlFinish)}`}>
                  {fmtDateVal(tT.maxBlFinish)}
                </div>
                <div className="text-right font-bold text-slate-800 text-xs">${fmt(tT.venta)}</div>
                <div className="text-right font-bold text-blue-700 text-xs">${fmt(tT.plan)}</div>
                <div className="text-right font-bold text-green-700 text-xs">${fmt(tT.ejec)}</div>
                <div className={`text-right font-bold text-xs ${tT.desv < 0 ? 'text-red-700' : 'text-green-700'}`}>{fmtD(tT.desv)}</div>
                <div className="text-right">{renderPctVar(tT.desv)}</div>
              </div>
              
              {/* Nivel 2: Grupos (Columna AD) dentro de esta Tipología */}
              {isTipoExp && Object.entries(grupos).sort((a: any, b: any) => {
                const sA = a[1];
                const sB = b[1];
                const getDesv = (o: any): number => {
                  let sVal = 0;
                  if (!o) return 0;
                  for (const sKey in o) {
                    const s = o[sKey];
                    for (const subKey in s) {
                      const sub = s[subKey];
                      for (const cKey in sub) {
                        const arr = sub[cKey];
                        if (Array.isArray(arr)) {
                          for (const item of arr) {
                            sVal += (item.ventaEjecutada || 0) - (item.ventaPlan || 0);
                          }
                        }
                      }
                    }
                  }
                  return sVal;
                };
                const dA = getDesv(sA);
                const dB = getDesv(sB);
                return sortVariacionDir === 'asc' ? dA - dB : dB - dA;
              }).map(([grupo, scaps]: any) => {
                const grupoKey = `${tipo}__${grupo}`;
                const isGrupoExp = expandedRESPs.has(grupoKey);
                const allG = Object.values(scaps).flatMap((s: any) => Object.values(s).flatMap((sub: any) => Object.values(sub).flat()));
                if (allG.length === 0) return null;
                const gT = tot(allG);
                if (gT.count === 0) return null;
                return (
                  <div key={grupo} className="border-b border-purple-100/60">
                    <div 
                      className="grid gap-2 px-3 py-1.5 bg-purple-50/70 hover:bg-purple-100/60 cursor-pointer border-b border-purple-100" 
                      style={{ gridTemplateColumns: '1fr 90px 2fr 85px 1.4fr 1.4fr 1.4fr 1.4fr 0.9fr' }}
                      onClick={() => setExpandedRESPs(prev => {
                        const n = new Set(prev);
                        if (n.has(grupoKey)) n.delete(grupoKey);
                        else n.add(grupoKey);
                        return n;
                      })}
                    >
                      <div className="flex items-center gap-1 col-span-3 min-w-0 overflow-hidden whitespace-nowrap flex-nowrap pl-2">
                        {isGrupoExp ? <ChevronDown className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />}
                        <span className="font-semibold text-purple-900 text-[11px] truncate">📁 {grupo}</span>
                        <span className="text-[9px] text-purple-600 font-normal flex-shrink-0">({gT.count} items)</span>
                      </div>
                      <div className="text-center font-semibold text-purple-900 text-[9px] font-mono self-center truncate" title={`BL Finish Máx: ${fmtDateVal(gT.maxBlFinish)}`}>
                        {fmtDateVal(gT.maxBlFinish)}
                      </div>
                      <div className="text-right text-[11px] text-slate-800">${fmt(gT.venta)}</div>
                      <div className="text-right text-[11px] text-blue-700">${fmt(gT.plan)}</div>
                      <div className="text-right text-[11px] text-green-700">${fmt(gT.ejec)}</div>
                      <div className={`text-right text-[11px] font-semibold ${gT.desv < 0 ? 'text-red-700' : 'text-green-700'}`}>{fmtD(gT.desv)}</div>
                      <div className="text-right">{renderPctVar(gT.desv)}</div>
                    </div>
                    
                    {/* Nivel 3: SCAP (Sub-Capítulo / Partida) */}
                    {isGrupoExp && Object.entries(scaps).sort((a: any, b: any) => {
                      const sA = a[1];
                      const sB = b[1];
                      const getDesv = (o: any): number => {
                        let sVal = 0;
                        if (!o) return 0;
                        for (const subKey in o) {
                          const sub = o[subKey];
                          for (const cKey in sub) {
                            const arr = sub[cKey];
                            if (Array.isArray(arr)) {
                              for (const item of arr) {
                                sVal += (item.ventaEjecutada || 0) - (item.ventaPlan || 0);
                              }
                            }
                          }
                        }
                        return sVal;
                      };
                      const dA = getDesv(sA);
                      const dB = getDesv(sB);
                      return sortVariacionDir === 'asc' ? dA - dB : dB - dA;
                    }).map(([scap, subCs]: any) => {
                      const scapKey = `${tipo}__${grupo}__${scap}`;
                      const isScapExp = expandedSCAPs.has(scapKey);
                      const allS = Object.values(subCs).flatMap((sub: any) => Object.values(sub).flat());
                      if (allS.length === 0) return null;
                      const sT = tot(allS);
                      if (sT.count === 0) return null;
                      return (
                        <div key={scap} className="border-b border-slate-100">
                          <div 
                            className="grid gap-2 px-3 py-1 bg-blue-50/40 hover:bg-blue-100/40 cursor-pointer" 
                            style={{ gridTemplateColumns: '1fr 90px 2fr 85px 1.4fr 1.4fr 1.4fr 1.4fr 0.9fr' }}
                            onClick={() => setExpandedSCAPs(prev => {
                              const n = new Set(prev);
                              if (n.has(scapKey)) n.delete(scapKey);
                              else n.add(scapKey);
                              return n;
                            })}
                          >
                            <div className="flex items-center gap-1 col-span-3 min-w-0 overflow-hidden whitespace-nowrap flex-nowrap pl-4">
                              {isScapExp ? <ChevronDown className="w-3 h-3 text-blue-500 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-blue-500 flex-shrink-0" />}
                              <span className="font-semibold text-blue-800 text-[11px] truncate">{scap}</span>
                              <span className="text-[9px] text-blue-500 flex-shrink-0">({sT.count} items)</span>
                            </div>
                            <div className="text-center font-semibold text-blue-800 text-[9px] font-mono self-center truncate" title={`BL Finish Máx: ${fmtDateVal(sT.maxBlFinish)}`}>
                              {fmtDateVal(sT.maxBlFinish)}
                            </div>
                            <div className="text-right text-[11px] text-slate-700">${fmt(sT.venta)}</div>
                            <div className="text-right text-[11px] text-blue-600">${fmt(sT.plan)}</div>
                            <div className="text-right text-[11px] text-green-600">${fmt(sT.ejec)}</div>
                            <div className={`text-right text-[11px] font-semibold ${sT.desv < 0 ? 'text-red-600' : 'text-green-600'}`}>{fmtD(sT.desv)}</div>
                            <div className="text-right">{renderPctVar(sT.desv)}</div>
                          </div>
                          
                          {/* Nivel 4: SubC (Columna N CDO) - Nivel Antes de CAP */}
                          {isScapExp && Object.entries(subCs).sort((a: any, b: any) => {
                            const cA = a[1];
                            const cB = b[1];
                            const getDesv = (o: any): number => {
                              let sVal = 0;
                              if (!o) return 0;
                              for (const cKey in o) {
                                const arr = o[cKey];
                                if (Array.isArray(arr)) {
                                  for (const item of arr) {
                                    sVal += (item.ventaEjecutada || 0) - (item.ventaPlan || 0);
                                  }
                                }
                              }
                              return sVal;
                            };
                            const dA = getDesv(cA);
                            const dB = getDesv(cB);
                            return sortVariacionDir === 'asc' ? dA - dB : dB - dA;
                          }).map(([subC, caps]: any) => {
                            const subCKey = `${tipo}__${grupo}__${scap}__${subC}`;
                            const isSubCExp = expandedSubCs.has(subCKey);
                            const allSubC = Object.values(caps).flat();
                            if (allSubC.length === 0) return null;
                            const subCTot = tot(allSubC);
                            if (subCTot.count === 0) return null;
                            return (
                              <div key={subC} className="border-b border-amber-100/60">
                                <div 
                                  className="grid gap-2 px-3 py-1 bg-amber-50/40 hover:bg-amber-100/50 cursor-pointer border-b border-amber-100/50" 
                                  style={{ gridTemplateColumns: '1fr 90px 2fr 85px 1.4fr 1.4fr 1.4fr 1.4fr 0.9fr' }}
                                  onClick={() => setExpandedSubCs(prev => {
                                    const n = new Set(prev);
                                    if (n.has(subCKey)) n.delete(subCKey);
                                    else n.add(subCKey);
                                    return n;
                                  })}
                                >
                                  <div className="flex items-center gap-1 col-span-3 min-w-0 overflow-hidden whitespace-nowrap flex-nowrap pl-6">
                                    {isSubCExp ? <ChevronDown className="w-3 h-3 text-amber-700 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-amber-700 flex-shrink-0" />}
                                    <span className="font-semibold text-amber-900 text-[11px] truncate">🏗️ SubC: {subC}</span>
                                    <span className="text-[9px] text-amber-700 font-normal flex-shrink-0">({subCTot.count} items)</span>
                                  </div>
                                  <div className="text-center font-semibold text-amber-900 text-[9px] font-mono self-center truncate" title={`BL Finish Máx: ${fmtDateVal(subCTot.maxBlFinish)}`}>
                                    {fmtDateVal(subCTot.maxBlFinish)}
                                  </div>
                                  <div className="text-right text-[11px] text-slate-700">${fmt(subCTot.venta)}</div>
                                  <div className="text-right text-[11px] text-blue-600">${fmt(subCTot.plan)}</div>
                                  <div className="text-right text-[11px] text-green-600">${fmt(subCTot.ejec)}</div>
                                  <div className={`text-right text-[11px] font-semibold ${subCTot.desv < 0 ? 'text-red-600' : 'text-green-600'}`}>{fmtD(subCTot.desv)}</div>
                                  <div className="text-right">{renderPctVar(subCTot.desv)}</div>
                                </div>

                                {/* Nivel 5: CAP (Capítulo / Subpartida) */}
                                {isSubCExp && Object.entries(caps).sort((a: any, b: any) => {
                                  const iA = a[1];
                                  const iB = b[1];
                                  const getDesv = (arr: any[]): number => arr.reduce((s, i) => s + ((i.ventaEjecutada || 0) - (i.ventaPlan || 0)), 0);
                                  const dA = getDesv(iA);
                                  const dB = getDesv(iB);
                                  return sortVariacionDir === 'asc' ? dA - dB : dB - dA;
                                }).map(([cap, capItems]: any) => {
                                  const capKey = `${tipo}__${grupo}__${scap}__${subC}__${cap}`;
                                  const isCapExp = expandedSubPartidas.has(capKey);
                                  if (!Array.isArray(capItems) || capItems.length === 0) return null;
                                  const cT = tot(capItems as any[]);
                                  if (cT.count === 0) return null;
                                  return (
                                    <div key={cap} className="border-b border-slate-50">
                                      <div 
                                        className="grid gap-2 px-3 py-1 bg-slate-50/50 hover:bg-slate-100/40 cursor-pointer" 
                                        style={{ gridTemplateColumns: '1fr 90px 2fr 85px 1.4fr 1.4fr 1.4fr 1.4fr 0.9fr' }}
                                        onClick={() => setExpandedSubPartidas(prev => {
                                          const n = new Set(prev);
                                          if (n.has(capKey)) n.delete(capKey);
                                          else n.add(capKey);
                                          return n;
                                        })}
                                      >
                                        <div className="flex items-center gap-1 border-l-2 border-slate-300 pl-8 col-span-3 min-w-0 overflow-hidden whitespace-nowrap flex-nowrap">
                                          {isCapExp ? <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />}
                                          <span className="text-[10px] text-slate-700 font-medium truncate">{cap}</span>
                                          <span className="text-[9px] text-slate-400 font-normal flex-shrink-0">({cT.count})</span>
                                        </div>
                                        <div className="text-center text-slate-700 text-[9px] font-mono self-center truncate" title={`BL Finish Máx: ${fmtDateVal(cT.maxBlFinish)}`}>
                                          {fmtDateVal(cT.maxBlFinish)}
                                        </div>
                                        <div className="text-right text-[10px] text-slate-600">${fmt(cT.venta)}</div>
                                        <div className="text-right text-[10px] text-blue-500">${fmt(cT.plan)}</div>
                                        <div className="text-right text-[10px] text-green-500">${fmt(cT.ejec)}</div>
                                        <div className={`text-right text-[10px] ${cT.desv < 0 ? 'text-red-500' : 'text-green-500'}`}>{fmtD(cT.desv)}</div>
                                        <div className="text-right">{renderPctVar(cT.desv)}</div>
                                      </div>

                                      {/* Nivel 6: Items Hoja */}
                                      {isCapExp && [...(capItems as any[])].sort((a, b) => {
                                        const dA = (a.ventaEjecutada || 0) - (a.ventaPlan || 0);
                                        const dB = (b.ventaEjecutada || 0) - (b.ventaPlan || 0);
                                        return sortVariacionDir === 'asc' ? dA - dB : dB - dA;
                                      }).map((item, idx) => {
                                        const iP = item.ventaPlan || 0;
                                        const iE = item.ventaEjecutada || 0;
                                        const iV = getVB(item);
                                        const iD = iE - iP;
                                        return (
                                          <div key={idx} className="grid gap-2 px-3 py-0.5 bg-white hover:bg-slate-50 border-b border-slate-100 text-[10px]" style={{ gridTemplateColumns: '1fr 90px 2fr 85px 1.4fr 1.4fr 1.4fr 1.4fr 0.9fr' }}>
                                            <div className="text-slate-400 truncate pl-3 font-mono" title={String(item.wbs || '').trim()}>{String(item.wbs || '').trim()}</div>
                                            <div className="text-slate-500 truncate font-mono text-[9px]" title={item.activityId}>{item.activityId}</div>
                                            <div className="text-slate-700 truncate font-sans text-[10px]" title={item.descripcion}>{item.descripcion}</div>
                                            <div className="text-center text-slate-600 font-mono text-[9px] self-center truncate" title={`BL Finish (Col Y): ${fmtDateVal(item.blFinish)}`}>{fmtDateVal(item.blFinish)}</div>
                                            <div className="text-right text-slate-500 font-mono">${fmt(iV)}</div>
                                            <div className="text-right text-blue-500 font-mono">${fmt(iP)}</div>
                                            <div className="text-right text-green-500 font-mono">${fmt(iE)}</div>
                                            <div className={`text-right font-mono font-semibold ${iD < 0 ? 'text-red-500' : 'text-green-500'}`}>{fmtD(iD)}</div>
                                            <div className="text-right font-mono">{renderPctVar(iD)}</div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Pie de Tabla Total */}
      <div className="px-3 py-1.5 bg-indigo-100 border-t-2 border-indigo-300 grid gap-2 sticky bottom-0 text-[11px]" style={{ gridTemplateColumns: '1fr 90px 2fr 85px 1.4fr 1.4fr 1.4fr 1.4fr 0.9fr' }}>
        <div className="col-span-3 font-bold text-slate-900 leading-none flex items-center gap-2">
          <span>TOTAL PROYECTO</span>
          <span className="text-[9px] font-normal text-slate-600">({filteredItems.length.toLocaleString()} items con desviación)</span>
        </div>
        <div className="text-center font-bold text-slate-900 text-[9px] font-mono self-center truncate" title={`BL Finish Máx: ${fmtDateVal(globalTot.maxBlFinish)}`}>
          {fmtDateVal(globalTot.maxBlFinish)}
        </div>
        <div className="text-right font-bold text-slate-900">${fmt(globalTot.venta)}</div>
        <div className="text-right font-bold text-blue-800">${fmt(globalTot.plan)}</div>
        <div className="text-right font-bold text-green-800">${fmt(globalTot.ejec)}</div>
        <div className={`text-right font-bold ${globalTot.desv < 0 ? 'text-red-700' : 'text-green-700'}`}>{fmtD(globalTot.desv)}</div>
        <div className="text-right">{renderPctVar(globalTot.desv)}</div>
      </div>
      </>
      )}
    </div>
  );
};
