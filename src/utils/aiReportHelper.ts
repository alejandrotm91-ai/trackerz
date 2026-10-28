import { Actividad } from '../types';
import type { DatosReporte } from '../types/reporteIA';

export interface AreaReportData {
  areaName: string;
  totalRetrasadas: number;
  maxDiasAtraso: number;
  actividadesRetrasadas: {
    wbs: string;
    descripcion: string;
    diasAtraso: number;
    fechaInicoProgramada: string;
    fechaFinProgramada: string;
    estado: string;
  }[];
  totalProximas4Semanas: number;
  actividadesProximas4Semanas: {
    wbs: string;
    descripcion: string;
    fechaInicio: string;
    fechaFin: string;
    avance: string;
    estado: string;
  }[];
}

export function buildCronoReportData(actividades: Actividad[], fechaCorteState?: Date) {
  const today = fechaCorteState ? new Date(fechaCorteState) : new Date();
  today.setHours(23, 59, 59, 999);

  const next4Weeks = new Date(today.getTime() + 28 * 24 * 60 * 60 * 1000);

  const leafItems = (actividades || []).filter(a => a.esItemHoja);

  const delayedActivities: Actividad[] = [];
  const upcoming4WeeksActivities: Actividad[] = [];

  leafItems.forEach(a => {
    const p6Status = a.p6Status || a.status || '';
    const isCompleted = p6Status === 'Completed' || a.avanceAT === 100;
    const isStarted = p6Status === 'In Progress' || p6Status === 'Completed' || (a.avanceAT !== undefined && a.avanceAT > 0);

    const start = a.start instanceof Date && !isNaN(a.start.getTime()) ? a.start : null;
    const finish = a.finish instanceof Date && !isNaN(a.finish.getTime()) ? a.finish : null;
    const blStart = a.blStart instanceof Date && !isNaN(a.blStart.getTime()) ? a.blStart : null;
    const blFinish = a.blFinish instanceof Date && !isNaN(a.blFinish.getTime()) ? a.blFinish : null;

    const targetStart = blStart || start;
    const targetFinish = blFinish || finish;

    // 1. Check if delayed
    const debiaHaberIniciado = !!(targetStart && targetStart <= today);
    const atrasadoInicio = debiaHaberIniciado && !isStarted;

    const debiaHaberTerminado = !!(targetFinish && targetFinish <= today);
    const atrasadoFin = debiaHaberTerminado && !isCompleted;

    const isDelayed = a.estaAtrasadoCronograma || atrasadoInicio || atrasadoFin;

    if (isDelayed) {
      delayedActivities.push(a);
    }

    // 2. Check if scheduled for next 4 weeks
    if (!isCompleted) {
      const activeStart = start || blStart;
      const activeFinish = finish || blFinish;

      if (activeStart && activeFinish) {
        // Overlaps with [today, next4Weeks] window
        if (activeStart <= next4Weeks && activeFinish >= today) {
          upcoming4WeeksActivities.push(a);
        }
      }
    }
  });

  // Group by Area (tipo, ubicacion, macro, or WBS root)
  const areasMap: Record<string, {
    delayed: Actividad[];
    upcoming: Actividad[];
  }> = {};

  const getAreaName = (a: Actividad) => {
    return (a.tipo && a.tipo.trim()) || (a.ubicacion && a.ubicacion.trim()) || (a.macro && a.macro.trim()) || (a.wbs ? `Sector ${a.wbs.split('.')[0]}` : 'Área General');
  };

  delayedActivities.forEach(a => {
    const area = getAreaName(a);
    if (!areasMap[area]) areasMap[area] = { delayed: [], upcoming: [] };
    areasMap[area].delayed.push(a);
  });

  upcoming4WeeksActivities.forEach(a => {
    const area = getAreaName(a);
    if (!areasMap[area]) areasMap[area] = { delayed: [], upcoming: [] };
    areasMap[area].upcoming.push(a);
  });

  const areaData: AreaReportData[] = Object.keys(areasMap).map(areaName => {
    const group = areasMap[areaName];
    return {
      areaName,
      totalRetrasadas: group.delayed.length,
      maxDiasAtraso: group.delayed.reduce((m, a) => Math.max(m, a.diasAtrasoMaximo || 0), 0),
      // Las más atrasadas primero
      actividadesRetrasadas: [...group.delayed].sort((x, y) => (y.diasAtrasoMaximo || 0) - (x.diasAtrasoMaximo || 0)).slice(0, 20).map(a => ({
        wbs: a.wbs || 'N/A',
        descripcion: a.descripcion || 'Sin descripción',
        diasAtraso: a.diasAtrasoMaximo || 0,
        fechaInicoProgramada: a.blStart ? a.blStart.toLocaleDateString('es-ES') : (a.start ? a.start.toLocaleDateString('es-ES') : 'N/A'),
        fechaFinProgramada: a.blFinish ? a.blFinish.toLocaleDateString('es-ES') : (a.finish ? a.finish.toLocaleDateString('es-ES') : 'N/A'),
        estado: a.p6Status || a.status || 'No Iniciado'
      })),
      totalProximas4Semanas: group.upcoming.length,
      actividadesProximas4Semanas: group.upcoming.slice(0, 20).map(a => ({
        wbs: a.wbs || 'N/A',
        descripcion: a.descripcion || 'Sin descripción',
        fechaInicio: a.start ? a.start.toLocaleDateString('es-ES') : 'N/A',
        fechaFin: a.finish ? a.finish.toLocaleDateString('es-ES') : 'N/A',
        avance: `${a.avanceAT ?? 0}%`,
        estado: a.p6Status || a.status || 'Programada'
      }))
    };
  });

  // Sort areas with most delayed activities first
  areaData.sort((a, b) => b.totalRetrasadas - a.totalRetrasadas);

  // 3. Calculate Retraso Económico por Tipología (Tarjeta Retraso Económico)
  const isP6Item = (item: any) => {
    const wbsRawStr = String(item.wbsRaw || '').toLowerCase();
    const wbsStr = String(item.wbs || '').toLowerCase();
    return wbsRawStr.includes('p6') || wbsStr.includes('p6');
  };

  const itemsEconomicos = leafItems.filter(item =>
    ((item.ventaPlan || 0) > 0 || (item.ventaEjecutada || 0) > 0)
  );

  const tipologiasEconomicasMap: Record<string, {
    nombre: string;
    ventaPlan: number;
    ventaEjecutada: number;
    variacionEconomica: number;
    itemsCount: number;
    itemsDesviacionNegativaCritica10k: {
      wbs: string;
      activityId: string;
      descripcion: string;
      grupo: string;
      ventaPlan: number;
      ventaEjecutada: number;
      variacionNegativaUSD: number;
      status: string;
    }[];
  }> = {};

  itemsEconomicos.forEach(item => {
    const tipo = item.tipo || '(Sin Tipo)';
    if (!tipologiasEconomicasMap[tipo]) {
      tipologiasEconomicasMap[tipo] = {
        nombre: tipo,
        ventaPlan: 0,
        ventaEjecutada: 0,
        variacionEconomica: 0,
        itemsCount: 0,
        itemsDesviacionNegativaCritica10k: []
      };
    }

    const vp = item.ventaPlan || 0;
    const ve = item.ventaEjecutada || 0;
    const varEcon = ve - vp;

    tipologiasEconomicasMap[tipo].ventaPlan += vp;
    tipologiasEconomicasMap[tipo].ventaEjecutada += ve;
    tipologiasEconomicasMap[tipo].variacionEconomica += varEcon;
    tipologiasEconomicasMap[tipo].itemsCount += 1;

    // Filter items with negative variation superior to 10,000 USD (varEcon <= -10000)
    if (varEcon <= -10000) {
      tipologiasEconomicasMap[tipo].itemsDesviacionNegativaCritica10k.push({
        wbs: item.wbs || 'N/A',
        activityId: item.activityId || '',
        descripcion: item.descripcion || 'Sin descripción',
        grupo: item.grupo || '',
        ventaPlan: vp,
        ventaEjecutada: ve,
        variacionNegativaUSD: Math.abs(varEcon),
        status: item.p6Status || item.status || 'No Iniciado'
      });
    }
  });

  let totalItemsCriticos10kCount = 0;
  let totalMontoMontoCritico10k = 0;

  const retrasoEconomicoTipologia = Object.values(tipologiasEconomicasMap).map(t => {
    const pctAvance = t.ventaPlan > 0 ? ((t.ventaEjecutada / t.ventaPlan) * 100).toFixed(2) : '0.00';
    t.itemsDesviacionNegativaCritica10k.sort((a, b) => b.variacionNegativaUSD - a.variacionNegativaUSD);
    
    totalItemsCriticos10kCount += t.itemsDesviacionNegativaCritica10k.length;
    totalMontoMontoCritico10k += t.itemsDesviacionNegativaCritica10k.reduce((sum, x) => sum + x.variacionNegativaUSD, 0);

    return {
      nombre: t.nombre,
      ventaPlanUSD: Math.round(t.ventaPlan * 100) / 100,
      ventaEjecutadaUSD: Math.round(t.ventaEjecutada * 100) / 100,
      variacionEconomicaUSD: Math.round(t.variacionEconomica * 100) / 100,
      pctAvance: `${pctAvance}%`,
      itemsTotales: t.itemsCount,
      itemsCriticosMayor10kCount: t.itemsDesviacionNegativaCritica10k.length,
      partidasCriticasMayor10k: t.itemsDesviacionNegativaCritica10k.slice(0, 15)
    };
  }).sort((a, b) => a.variacionEconomicaUSD - b.variacionEconomicaUSD); // Sort worst negative variation first

  const formattedDataDate = today.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // 4. Calculate Equipment and Instrumentation Analysis by SCAP
  // Filter leaf items where 'tipo' contains 'equipo' or 'instrumenta', excluding Partida D
  const getTipoCategory = (tipoStr?: string): 'Equipo' | 'Instrumentación' | null => {
    if (!tipoStr) return null;
    const t = tipoStr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (t.includes('instrumenta')) return 'Instrumentación';
    if (t.includes('equipo')) return 'Equipo';
    return null;
  };

  const isPartidaD = (item: any): boolean => {
    if (!item) return false;
    const rawWbs = String(item.wbs || item.wbsPath || '').trim();
    if (rawWbs) {
      const normWbs = rawWbs.replace(/^p\d{4}\./i, 'p.').toLowerCase();
      if (normWbs === 'p.d' || normWbs.startsWith('p.d.')) return true;
      const lowerRaw = rawWbs.toLowerCase();
      if (lowerRaw === 'd' || lowerRaw.startsWith('d.') || lowerRaw.startsWith('p.d')) return true;
    }
    const partidaStr = String(item.partida || item.partidas || '').trim().toLowerCase();
    if (partidaStr) {
      if (partidaStr === 'd' || partidaStr.startsWith('p.d') || partidaStr.startsWith('d.')) return true;
    }
    return false;
  };

  const equipamientoMap: Record<string, {
    tipo: 'Equipo' | 'Instrumentación';
    scap: string;
    itemsF: Actividad[];
    allItems: Actividad[];
  }> = {};

  leafItems.forEach(item => {
    if (isPartidaD(item)) return; // Excluir rubros en Partida D

    const tipoCat = getTipoCategory(item.tipo);
    if (tipoCat) {
      const scap = (item.scap && item.scap.trim()) ? item.scap.trim() : 'Sin SCAP';
      const key = `${tipoCat}___${scap}`;
      if (!equipamientoMap[key]) {
        equipamientoMap[key] = { tipo: tipoCat, scap, itemsF: [], allItems: [] };
      }
      equipamientoMap[key].allItems.push(item);

      const actIdStr = String(item.activityId || item.idOrig || item.wbs || '').toUpperCase();
      const st = String(item.p6Status || item.status || '').trim().toLowerCase();
      const isCompleted = st === 'completed' || item.avanceAT === 100;

      if (actIdStr.includes('F') && !isCompleted) {
        equipamientoMap[key].itemsF.push(item);
      }
    }
  });

  let totalEquiposFSum = 0;
  let totalActividadesFSum = 0;

  const equipamientoPorSCAP = Object.values(equipamientoMap)
    .map(e => {
      let sumCantF = 0;
      const unitSet = new Set<string>();

      e.itemsF.forEach(it => {
        const qty = (it.cantidadCdo !== undefined && it.cantidadCdo !== null && !isNaN(it.cantidadCdo)) ? it.cantidadCdo : 1;
        sumCantF += qty;
        const u = (it.unidad || it.unit || '').trim();
        if (u) unitSet.add(u);
      });

      const totalCantidadEquiposF = sumCantF;
      totalEquiposFSum += totalCantidadEquiposF;
      totalActividadesFSum += e.itemsF.length;

      const avancePromedio = e.itemsF.length
        ? e.itemsF.reduce((s, it) => s + (Number(it.avanceAT) || 0), 0) / e.itemsF.length
        : 0;

      return {
        tipo: e.tipo,
        scap: e.scap,
        avancePromedio: Math.round(avancePromedio * 10) / 10,
        totalCantidadEquiposF,
        totalActividadesF: e.itemsF.length,
        totalActividadesSCAP: e.allItems.length,
        unidades: Array.from(unitSet).join(', ') || 'u',
        actividadesF: e.itemsF.map(it => ({
          activityId: it.activityId || it.idOrig || 'N/A',
          wbs: it.wbs || 'N/A',
          descripcion: it.descripcion || 'Sin descripción',
          cantidad: (it.cantidadCdo !== undefined && it.cantidadCdo !== null) ? it.cantidadCdo : 1,
          unidad: it.unidad || it.unit || 'u',
          estado: it.p6Status || it.status || 'No Iniciado',
          avance: `${it.avanceAT ?? 0}%`
        }))
      };
    })
    .filter(e => e.totalActividadesF > 0)
    .sort((a, b) => {
      if (a.tipo !== b.tipo) {
        return a.tipo.localeCompare(b.tipo);
      }
      return b.totalCantidadEquiposF - a.totalCantidadEquiposF;
    });

  return {
    dataDate: formattedDataDate,
    projectSummary: {
      total: leafItems.length,
      totalDelayed: delayedActivities.length,
      totalUpcoming: upcoming4WeeksActivities.length,
      totalItemsCriticos10k: totalItemsCriticos10kCount,
      totalMontoCritico10kUSD: Math.round(totalMontoMontoCritico10k * 100) / 100,
      totalEquiposAInstalarF: totalEquiposFSum,
      totalActividadesEquiposF: totalActividadesFSum
    },
    areaData,
    retrasoEconomicoTipologia,
    equipamientoPorSCAP
  };
}

/**
 * Datos del reporte estándar: las cifras y tablas que la app calcula (siempre con el mismo formato)
 * y el detalle que se le pasa a Claude como contexto para escribir el análisis.
 */
export function construirDatosReporte(actividades: Actividad[], fechaCorteState?: Date) {
  const base = buildCronoReportData(actividades, fechaCorteState);
  const leafItems = (actividades || []).filter(a => a.esItemHoja);
  const ventaPlan = leafItems.reduce((s, a) => s + (a.ventaPlan || 0), 0);
  const ventaEjecutada = leafItems.reduce((s, a) => s + (a.ventaEjecutada || 0), 0);
  const r2 = (n: number) => Math.round(n * 100) / 100;

  const partidasCriticas = base.retrasoEconomicoTipologia
    .flatMap(t => t.partidasCriticasMayor10k.map(p => ({ ...p, tipologia: t.nombre })))
    .sort((a, b) => b.variacionNegativaUSD - a.variacionNegativaUSD)
    .slice(0, 10)
    .map(p => ({
      activityId: p.activityId || p.wbs,
      descripcion: p.descripcion,
      tipologia: p.tipologia,
      ventaPlan: r2(p.ventaPlan),
      ventaEjecutada: r2(p.ventaEjecutada),
      variacion: r2(-p.variacionNegativaUSD),
      estado: p.status,
    }));

  const datos: DatosReporte = {
    fechaCorte: base.dataDate,
    kpis: {
      totalActividades: base.projectSummary.total,
      retrasadas: base.projectSummary.totalDelayed,
      proximas4Semanas: base.projectSummary.totalUpcoming,
      ventaPlan: r2(ventaPlan),
      ventaEjecutada: r2(ventaEjecutada),
      variacion: r2(ventaEjecutada - ventaPlan),
      partidasCriticas: base.projectSummary.totalItemsCriticos10k,
      montoCritico: base.projectSummary.totalMontoCritico10kUSD,
      equiposPendientes: r2(base.projectSummary.totalEquiposAInstalarF),
      partidasEquipos: base.projectSummary.totalActividadesEquiposF,
    },
    tipologias: base.retrasoEconomicoTipologia.map(t => ({
      nombre: t.nombre,
      ventaPlan: t.ventaPlanUSD,
      ventaEjecutada: t.ventaEjecutadaUSD,
      variacion: t.variacionEconomicaUSD,
      pctAvance: Number(String(t.pctAvance).replace('%', '')) || 0,
      partidas: t.itemsTotales,
      criticas: t.itemsCriticosMayor10kCount,
    })),
    partidasCriticas,
    retrasos: base.areaData
      .filter(a => a.totalRetrasadas > 0)
      .map(a => ({
        area: a.areaName,
        retrasadas: a.totalRetrasadas,
        maxDiasAtraso: a.maxDiasAtraso,
      }))
      .sort((a, b) => b.retrasadas - a.retrasadas),
    proximas: base.areaData
      .filter(a => a.totalProximas4Semanas > 0)
      .map(a => ({ area: a.areaName, actividades: a.totalProximas4Semanas }))
      .sort((a, b) => b.actividades - a.actividades),
    equipamiento: base.equipamientoPorSCAP.map(e => ({
      tipo: e.tipo,
      scap: e.scap,
      pendiente: r2(e.totalCantidadEquiposF),
      unidades: e.unidades,
      partidas: e.totalActividadesF,
      avance: e.avancePromedio,
    })),
  };

  // Detalle para que Claude explique las cifras (no se muestra tal cual)
  const contexto = {
    retrasadasPorArea: base.areaData
      .filter(a => a.totalRetrasadas > 0)
      .map(a => ({
        area: a.areaName,
        masAtrasadas: a.actividadesRetrasadas.slice(0, 8),
      })),
    proximasPorArea: base.areaData
      .filter(a => a.totalProximas4Semanas > 0)
      .map(a => ({ area: a.areaName, actividades: a.actividadesProximas4Semanas.slice(0, 8) })),
    equiposPorSCAP: base.equipamientoPorSCAP.slice(0, 25).map(e => ({
      tipo: e.tipo,
      scap: e.scap,
      ejemplos: e.actividadesF.slice(0, 4).map(x => `${x.activityId} ${x.descripcion} (${x.cantidad} ${x.unidad}, ${x.estado})`),
    })),
  };

  return { datos, contexto };
}
