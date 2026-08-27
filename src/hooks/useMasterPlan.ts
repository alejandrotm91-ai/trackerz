/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Actividad, PlanillaItem } from '../types';
import { normalizeText, ctPf } from '../utils/helpers';
import { loadLatestPlanFromFirebase, savePlanToFirebase, testFirestoreConnection } from '../utils/firebaseSync';
import { savePlanToLocalStorage, loadPlanFromLocalStorage } from '../utils/localStorageBackup';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export function getLatestPeriodFromMap(mapa: any) {
  if (!mapa || Object.keys(mapa).length === 0) return null;
  const nombresMesEspanol = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  let maxVal = -1;
  let maxKey: string | null = null;
  
  Object.keys(mapa).forEach(k => {
    const parts = k.split('-');
    if (parts.length === 2) {
      const anio = parseInt(parts[0], 10);
      const mesIdx = nombresMesEspanol.indexOf(parts[1]);
      if (!isNaN(anio) && mesIdx !== -1) {
        const val = anio * 12 + mesIdx;
        if (val > maxVal) {
          maxVal = val;
          maxKey = k;
        }
      }
    }
  });
  
  if (maxKey) {
    const [anioStr, mesStr] = maxKey.split('-');
    return { anio: anioStr, mes: mesStr, semanas: [] };
  }
  return null;
}

export function parseFlexibleDate(val: any, wVal?: string): Date | null {
  const parseRaw = (): Date | null => {
    if (!val) {
      if (wVal) val = wVal;
      else return null;
    }

    // 1. If it's already a Date object
    if (val instanceof Date && !isNaN(val.getTime())) {
      return new Date(val.getFullYear(), val.getMonth(), val.getDate(), 12, 0, 0);
    }

    // 2. If it's a number (Excel serial date)
    if (typeof val === 'number') {
      const utc_days = Math.floor(val - 25569);
      const date = new Date(utc_days * 86400 * 1000);
      const tzOffset = date.getTimezoneOffset() * 60000;
      const localDate = new Date(date.getTime() + tzOffset);
      if (!isNaN(localDate.getTime())) {
        return new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate(), 12, 0, 0);
      }
      if (!isNaN(date.getTime())) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
      }
    }

    // 3. If it's a string
    let strVal = String(val).trim();
    if (!strVal) return null;

    // Remove leading 'V-' or 'v-' if present (from CDO headers like V-22-Feb-26 or V-22/02/2026)
    if (strVal.toUpperCase().startsWith('V-')) {
      strVal = strVal.substring(2).trim();
    }

    // Pattern A: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const regexNum = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/;
    const matchNum = strVal.match(regexNum);
    if (matchNum) {
      const day = parseInt(matchNum[1], 10);
      const monthIdx = parseInt(matchNum[2], 10) - 1;
      let year = parseInt(matchNum[3], 10);
      if (year < 100) year += year < 50 ? 2000 : 1900;
      
      if (monthIdx >= 0 && monthIdx <= 11 && day >= 1 && day <= 31) {
        return new Date(year, monthIdx, day, 12, 0, 0);
      }
    }

    // Pattern B: YYYY-MM-DD or YYYY/MM/DD
    const regexIso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/;
    const matchIso = strVal.match(regexIso);
    if (matchIso) {
      const year = parseInt(matchIso[1], 10);
      const monthIdx = parseInt(matchIso[2], 10) - 1;
      const day = parseInt(matchIso[3], 10);
      if (monthIdx >= 0 && monthIdx <= 11 && day >= 1 && day <= 31) {
        return new Date(year, monthIdx, day, 12, 0, 0);
      }
    }

    // Pattern C: DD-Month-YY (e.g. 30-May-26, 30-mayo-2026)
    const regexAlpha = /^(\d{1,2})[-/.\s]([a-zA-Z]{3,})[-/.\s](\d{2,4})/;
    const matchAlpha = strVal.match(regexAlpha);
    if (matchAlpha) {
      const day = parseInt(matchAlpha[1], 10);
      const monthStr = matchAlpha[2].toLowerCase();
      let year = parseInt(matchAlpha[3], 10);
      if (year < 100) year += year < 50 ? 2000 : 1900;

      const spanishMonths = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      const englishMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      let monthIdx = -1;

      for (let i = 0; i < 12; i++) {
        if (monthStr.startsWith(spanishMonths[i]) || monthStr.startsWith(englishMonths[i])) {
          monthIdx = i;
          break;
        }
      }

      if (monthIdx !== -1 && day >= 1 && day <= 31) {
        return new Date(year, monthIdx, day, 12, 0, 0);
      }
    }

    // Try standard parse as fallback
    const ts = Date.parse(strVal);
    if (!isNaN(ts)) {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
      }
    }

    return null;
  };

  const parsed = parseRaw();
  if (parsed && !isNaN(parsed.getTime())) {
    const yr = parsed.getFullYear();
    if (yr >= 2000 && yr <= 2050) {
      return parsed;
    }
  }
  return null;
}

export function rebuildAggregatedDates(actividadesProcesadas: Actividad[]): Actividad[] {
  // 1. Rehydrate date objects from string representation if needed
  actividadesProcesadas.forEach(a => {
    if (a.blStart && typeof a.blStart === 'string') {
      a.blStart = new Date(a.blStart);
      if (isNaN(a.blStart.getTime())) a.blStart = null;
    }
    if (a.blFinish && typeof a.blFinish === 'string') {
      a.blFinish = new Date(a.blFinish);
      if (isNaN(a.blFinish.getTime())) a.blFinish = null;
    }
    if (a.start && typeof a.start === 'string') {
      a.start = new Date(a.start);
      if (isNaN(a.start.getTime())) a.start = null;
    }
    if (a.finish && typeof a.finish === 'string') {
      a.finish = new Date(a.finish);
      if (isNaN(a.finish.getTime())) a.finish = null;
    }
  });

  // 2. Aggregate dates by WBS (bottom-up)
  try {
    const minNivel = Math.min(...actividadesProcesadas.map(a => a.nivel));
    const maxNivel = Math.max(...actividadesProcesadas.map(a => a.nivel));
    for (let nivelActual = maxNivel; nivelActual >= minNivel; nivelActual--) {
      const partidasEnNivel = actividadesProcesadas.filter(a => a.nivel === nivelActual && !a.esItemHoja);
      partidasEnNivel.forEach(actividad => {
        const sufijoPadre = (actividad.wbs || '').replace(/^p\d*\.?/, ''); 
        if (!sufijoPadre) return;
        const hijosDirectos = actividadesProcesadas.filter(item => {
          const sufijoHijo = (item.wbs || '').replace(/^p\d*\.?/, '');
          if (item.esItemHoja && sufijoHijo === sufijoPadre) return true;
          if (!sufijoHijo.startsWith(sufijoPadre)) return false;
          if (sufijoHijo === sufijoPadre) return false;
          if (sufijoHijo.length > sufijoPadre.length && sufijoHijo[sufijoPadre.length] !== '.') return false;
          const restoDelSufijo = sufijoHijo.substring(sufijoPadre.length + 1);
          return !restoDelSufijo.includes('.');
        });
        
        if (hijosDirectos.length > 0) {
          const fechasBlStart = hijosDirectos.map(i => i.blStart).filter(f => f) as Date[];
          const fechasStart = hijosDirectos.map(i => i.start).filter(f => f) as Date[];
          const fechasBlFinish = hijosDirectos.map(i => i.blFinish).filter(f => f) as Date[];
          const fechasFinish = hijosDirectos.map(i => i.finish).filter(f => f) as Date[];
          
          if (fechasBlStart.length > 0) actividad.blStart = new Date(Math.min(...fechasBlStart.map(f => f.getTime())));
          if (fechasStart.length > 0) actividad.start = new Date(Math.min(...fechasStart.map(f => f.getTime())));
          if (fechasBlFinish.length > 0) actividad.blFinish = new Date(Math.max(...fechasBlFinish.map(f => f.getTime())));
          if (fechasFinish.length > 0) actividad.finish = new Date(Math.max(...fechasFinish.map(f => f.getTime())));
          
          const calcAtraso = (fActual: Date | null, fBL: Date | null) => {
            if (!fActual || !fBL) return 0;
            const diff = Math.round((fActual.getTime() - fBL.getTime()) / 86400000);
            return diff > 0 ? diff : 0;
          };
          actividad.diasAtrasoInicio = calcAtraso(actividad.start, actividad.blStart);
          actividad.diasAtrasoFin = calcAtraso(actividad.finish, actividad.blFinish);
          actividad.diasAtrasoMaximo = Math.max(actividad.diasAtrasoInicio, actividad.diasAtrasoFin);
          actividad.estaAtrasadoCronograma = hijosDirectos.some(i => i.estaAtrasadoCronograma);
        }
      });
    }
  } catch (err) {
    console.error('Error re-calculando fechas WBS:', err);
  }

  // 3. Aggregate PROCESO/CAP/SCAP/UNIT dates
  try {
    const jerarquiaProceso: Record<string, any> = {};
    actividadesProcesadas.forEach(item => {
      if (!item.esItemHoja) return;
      const proceso = item.proceso || 'Sin PROCESO';
      const cap = item.cap || 'Sin CAP';
      const scap = item.scap || 'Sin SCAP';
      const unit = item.unit || 'Sin UNIT';
      
      if (!jerarquiaProceso[proceso]) jerarquiaProceso[proceso] = {};
      if (!jerarquiaProceso[proceso][cap]) jerarquiaProceso[proceso][cap] = {};
      if (!jerarquiaProceso[proceso][cap][scap]) jerarquiaProceso[proceso][cap][scap] = {};
      if (!jerarquiaProceso[proceso][cap][scap][unit]) jerarquiaProceso[proceso][cap][scap][unit] = [];
      jerarquiaProceso[proceso][cap][scap][unit].push(item);
    });

    const agregarFechas = (items: any[]) => {
      const fbls = items.map(i => i.blStart).filter(f => f).map(f => f.getTime());
      const fsts = items.map(i => i.start).filter(f => f).map(f => f.getTime());
      const fblfs = items.map(i => i.blFinish).filter(f => f).map(f => f.getTime());
      const ffns = items.map(i => i.finish).filter(f => f).map(f => f.getTime());
      return {
        blStart: fbls.length > 0 ? new Date(Math.min(...fbls)) : null,
        start: fsts.length > 0 ? new Date(Math.min(...fsts)) : null,
        blFinish: fblfs.length > 0 ? new Date(Math.max(...fblfs)) : null,
        finish: ffns.length > 0 ? new Date(Math.max(...ffns)) : null
      };
    };

    Object.entries(jerarquiaProceso).forEach(([proceso, caps]: any) => {
      Object.entries(caps).forEach(([cap, scaps]: any) => {
        Object.entries(scaps).forEach(([scap, units]: any) => {
          Object.entries(units).forEach(([unit, items]: any) => {
            const fechasUnit = agregarFechas(items);
            items.forEach((item: any) => {
              item.unitAgregado = { proceso, cap, scap, unit, ...fechasUnit };
            });
          });
          const todosLosItemsScap = Object.values(units).flat();
          const fechasScap = agregarFechas(todosLosItemsScap);
          todosLosItemsScap.forEach((item: any) => {
            item.scapAgregado = { proceso, cap, scap, ...fechasScap };
          });
        });
        const todosLosItemsCap = Object.values(scaps).flatMap((units: any) => Object.values(units).flat());
        const fechasCap = agregarFechas(todosLosItemsCap);
        todosLosItemsCap.forEach((item: any) => {
          item.capAgregado = { proceso, cap, ...fechasCap };
        });
      });
      const todosLosItemsProceso = Object.values(caps).flatMap((scaps: any) => 
        Object.values(scaps).flatMap((units: any) => Object.values(units).flat())
      );
      const fechasProceso = agregarFechas(todosLosItemsProceso);
      todosLosItemsProceso.forEach((item: any) => {
        item.procesoAgregado = { proceso, ...fechasProceso };
      });
    });
  } catch (err) {
    console.error('Error re-calculando fechas PROCESO/CAP:', err);
  }

  return actividadesProcesadas;
}

export function useMasterPlan(isLoggedIn = false) {
  const [fileData, setFileData] = useState<any>(null);
  const [firebasePlanData, setFirebasePlanData] = useState<any>(null);
  const [localPlanData, setLocalPlanData] = useState<any>(null);
  const [sourceActive, setSourceActive] = useState<string>('firebase');
  const [firebaseQuotaExceeded, setFirebaseQuotaExceeded] = useState<boolean>(false);

  const switchSource = (source: 'firebase' | 'local') => {
    if (source === 'firebase' && firebasePlanData) {
      setActividades(firebasePlanData.actividades);
      setPlanillaHojas(firebasePlanData.planillaHojas);
      setPlanillaPartidas(firebasePlanData.planillaPartidas);
      setPlanillaCDOvsS(firebasePlanData.planillaCDOvsS);
      setPlanillaTotales(firebasePlanData.planillaTotales);
      setPlanillaEnmiendas(firebasePlanData.planillaEnmiendas || []);
      setPlanillaTipRes(firebasePlanData.planillaTipRes || []);
      setPlanillaInfo(firebasePlanData.planillaInfo);
      setFileData(firebasePlanData.fileData);
      setDataPlanificado(firebasePlanData.dataPlanificado || null);
      setDataPlanificadoPG004(firebasePlanData.dataPlanificadoPG004 || null);
      setSourceActive('firebase');
    } else if (source === 'local' && localPlanData) {
      setActividades(localPlanData.actividades);
      setPlanillaHojas(localPlanData.planillaHojas);
      setPlanillaPartidas(localPlanData.planillaPartidas);
      setPlanillaCDOvsS(localPlanData.planillaCDOvsS);
      setPlanillaTotales(localPlanData.planillaTotales);
      setPlanillaEnmiendas(localPlanData.planillaEnmiendas || []);
      setPlanillaTipRes(localPlanData.planillaTipRes || []);
      setPlanillaInfo(localPlanData.planillaInfo);
      setFileData(localPlanData.fileData);
      setDataPlanificado(localPlanData.dataPlanificado || null);
      setDataPlanificadoPG004(localPlanData.dataPlanificadoPG004 || null);
      setSourceActive('local');
    }
  };

  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [loadingPhase, setLoadingPhase] = useState<string>('');
  const isUploadingRef = useRef<boolean>(false);
  const isPublishingRef = useRef<boolean>(false);

  // Google Drive integration states
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleDriveConfig, setGoogleDriveConfig] = useState<{ fileId: string; fileName: string } | null>(null);
  const [isDriveLoading, setIsDriveLoading] = useState<boolean>(false);

  const loadDriveConfig = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'config', 'google_drive'));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGoogleDriveConfig({ fileId: data.fileId, fileName: data.fileName });
        return data;
      }
    } catch (e) {
      console.warn('Error loading drive config:', e);
    }
    return null;
  };

  const saveDriveConfig = async (fileId: string, fileName: string) => {
    try {
      await setDoc(doc(db, 'config', 'google_drive'), {
        fileId,
        fileName,
        updatedAt: new Date().toISOString()
      });
      setGoogleDriveConfig({ fileId, fileName });
    } catch (e) {
      console.error('Error saving drive config:', e);
      alert('Error guardando configuración de Google Drive');
    }
  };

  const listDriveSpreadsheets = async (): Promise<any[]> => {
    if (!googleAccessToken) return [];
    try {
      const q = encodeURIComponent("(mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='application/vnd.ms-excel') and trashed=false");
      const url = `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime,size)`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${googleAccessToken}` }
      });
      if (!res.ok) {
        throw new Error('Error al listar archivos de Drive. Verifica que la sesión esté de verdad autorizada.');
      }
      const data = await res.json();
      return data.files || [];
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const syncFileFromDrive = async (fileId: string, fileName: string) => {
    if (!googleAccessToken) {
      alert('Debes iniciar sesión con Google para sincronizar desde Drive.');
      return false;
    }
    setIsDriveLoading(true);
    setLoadingProgress(1);
    setLoadingPhase(`Descargando "${fileName}" de Google Drive...`);
    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${googleAccessToken}` }
      });
      if (!response.ok) {
        throw new Error('Al descargar el archivo de Drive, el servidor respondió con un error.');
      }
      const arrayBuffer = await response.arrayBuffer();
      const sizeMB = (arrayBuffer.byteLength / 1024 / 1024).toFixed(1);
      
      await processFileArrayBuffer(arrayBuffer, fileName, sizeMB);
      setIsDriveLoading(false);
      return true;
    } catch (error: any) {
      console.error(error);
      alert(`Error al sincronizar con Google Drive: ${error.message || error}`);
      setLoadingProgress(0);
      setLoadingPhase('');
      setIsDriveLoading(false);
      return false;
    }
  };
  const [dataPlanificado, setDataPlanificado] = useState<any>(null); // Datos de pg-003
  const [dataPlanificadoPG004, setDataPlanificadoPG004] = useState<any>(null); // Datos de pg-004
  const [donutPG, setDonutPG] = useState<string>('contrato'); // default to 'contrato' (PG-003) for execution donut card
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState<string>(''); // Término aplicado actualmente
  const [searchInput, setSearchInput] = useState<string>(''); // Lo que el usuario escribe

  const [selectedActividad, setSelectedActividad] = useState<any>(null);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterTipologia, setFilterTipologia] = useState<string>('all');
  const [tipologiaSeleccionada, setTipologiaSeleccionada] = useState<string | null>(null); // Para ver detalle de items
  const [expandedRESPs, setExpandedRESPs] = useState<Set<string>>(new Set());
  const [expandedTipos, setExpandedTipos] = useState<Set<string>>(new Set());
  const [expandedSCAPs, setExpandedSCAPs] = useState<Set<string>>(new Set());
  const [expandedUNITs, setExpandedUNITs] = useState<Set<string>>(new Set());
  const [expandedSubPartidas, setExpandedSubPartidas] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<string>('desviacion'); // Columna por defecto
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc'); // Ascendente por defecto (más negativos primero)
  const [filterResp, setFilterResp] = useState<Set<string>>(new Set(['all'])); // Filtro por Resp (multi-select)
  const [baseVenta, setBaseVenta] = useState<string>('reformulada');
  const [filterTipologiaRetraso, setFilterTipologiaRetraso] = useState<string>('all'); // Filtro por Tipología en pestaña Retrasos
  const [fechaCorteState, setFechaCorteState] = useState<Date>(new Date('2026-04-12'));

  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<any>({
    anio: '2026',
    mes: 'Febrero',
    semanas: ['01', '08', '15', '22'] // Días de inicio de semana de Febrero 2026
  });

  const [mapaColumnasMes, setMapaColumnasMes] = useState<any>({});
  const [activeTab, setActiveTab] = useState<string>('caratula');
  const [donutAnio, setDonutAnio] = useState<string>('all');
  const [donutMes, setDonutMes] = useState<string>('all');
  const [donutSemana, setDonutSemana] = useState<string>('all');
  const [donutAcumulado, setDonutAcumulado] = useState<boolean>(false);
  const [donutDim, setDonutDim] = useState<string>('macro');
  const [tablaSortCol, setTablaSortCol] = useState<string>('plan'); // 'nombre' | 'plan' | 'ejecutado' | 'pct'
  const [tablaSortDir, setTablaSortDir] = useState<string>('desc'); // 'asc' | 'desc'

  // Estados para la pestaña Planilla
  const [planillaHojas, setPlanillaHojas] = useState<PlanillaItem[]>([]);
  const [planillaPartidas, setPlanillaPartidas] = useState<PlanillaItem[]>([]);
  const [planillaTotales, setPlanillaTotales] = useState<any>(null);
  const [planillaEnmiendas, setPlanillaEnmiendas] = useState<any[]>([]);
  const [planillaTipRes, setPlanillaTipRes] = useState<any[]>([]);
  const [planillaInfo, setPlanillaInfo] = useState<any>(null);
  const [planillaCDOvsS, setPlanillaCDOvsS] = useState<{ F: Record<string, any>; H: Record<string, any>; desalineados?: any[] }>({ F: {}, H: {} });
  const [enmExpanded, setEnmExpanded] = useState<Set<number>>(new Set());
  const [ctExpanded, setCtExpanded] = useState<Set<string>>(new Set());
  const [ctSearch, setCtSearch] = useState<string>('');
  const [ctFilterTipo, setCtFilterTipo] = useState<string>('');
  const [ctSoloCert, setCtSoloCert] = useState<boolean>(false);
  const [certOpen, setCertOpen] = useState<boolean>(false);
  const [ganttZoom, setGanttZoom] = useState<string>('quarter');
  const [ganttExp, setGanttExp] = useState<Set<string>>(new Set());
  const [ganttSearch, setGanttSearch] = useState<string>('');
  const [ganttStatus, setGanttStatus] = useState<string>('all');
  const [ganttFloat, setGanttFloat] = useState<string>('all');
  const [ganttMetricsOpen, setGanttMetricsOpen] = useState<boolean>(true);
  const [ganttTipoOpen, setGanttTipoOpen] = useState<boolean>(true);
  const [ganttTipo, setGanttTipo] = useState<string>('all');
  const [kpiSelected, setKpiSelected] = useState<string | null>(null);
  const [kpiExp, setKpiExp] = useState<Set<string>>(new Set());

  const [expandedYears, setExpandedYears] = useState<Set<any>>(new Set());
  const [partidaSeleccionada, setPartidaSeleccionada] = useState<string | null>(null); // Para filtrar por partida nivel 2
  const [tarjetasPartidasExpandidas, setTarjetasPartidasExpandidas] = useState<boolean>(false);
  const [tarjetasTipologiasExpandidas, setTarjetasTipologiasExpandidas] = useState<boolean>(false);
  const [procesosExpandidos, setProcesosExpandidos] = useState<Set<string>>(new Set()); 
  const [capsExpandidos, setCapsExpandidos] = useState<Set<string>>(new Set()); 
  const [scapsExpandidos, setScapsExpandidos] = useState<Set<string>>(new Set()); 
  const [unitsExpandidos, setUnitsExpandidos] = useState<Set<string>>(new Set()); 

  const isRespFilterActive = !filterResp.has('all');

  const matchesRespFilter = (item: any) => {
    if (filterResp.has('all')) return true;
    const resp = item.resp || '';
    if (filterResp.has('__EMPTY__')) {
      if (!resp.trim() && (item.ventaPlan > 0 || item.ventaEjecutada > 0)) return true;
    }
    return filterResp.has(resp);
  };

  // Limpiar estados de expansión cuando cambia la tipología
  useEffect(() => {
    setExpandedSCAPs(new Set());
    setExpandedUNITs(new Set());
    setExpandedSubPartidas(new Set());
    setSortColumn('desviacion');
    setSortDirection('asc');
  }, [tipologiaSeleccionada]);

  // Limpiar expandedItems cuando se muestra la tabla WBS de cronograma
  useEffect(() => {
    setExpandedItems(new Set()); // Iniciar 100% colapsado
  }, [partidaSeleccionada]);

  // Intentar cargar la última versión del plan desde Firebase al iniciar la app
  useEffect(() => {
    if (!isLoggedIn) return;
    async function loadInitialPlan() {
      setLoadingProgress(10);
      setLoadingPhase('Conectando con la base de datos de Firebase...');
      try {
        await testFirestoreConnection();
        // Cargar configuración de Google Drive
        try {
          const docSnap = await getDoc(doc(db, 'config', 'google_drive'));
          if (docSnap.exists()) {
            const dData = docSnap.data();
            setGoogleDriveConfig({ fileId: dData.fileId, fileName: dData.fileName });
          }
        } catch (eDrive) {
          console.warn('Error loading drive config on startup:', eDrive);
        }
        
        const data = await loadLatestPlanFromFirebase((pct, msg) => {
          setLoadingProgress(pct);
          setLoadingPhase(msg);
        });
        if (data) {
          setLoadingProgress(88);
          setLoadingPhase('Recalculando fechas y jerarquías WBS (Estructura de Desglose)...');
          
          const recomputedActividades = rebuildAggregatedDates(data.actividades);
          setActividades(recomputedActividades);
          const computedLatestPeriod = getLatestPeriodFromMap(data.planMeta.mapaColumnasMes);
          if (computedLatestPeriod) {
            setPeriodoSeleccionado(computedLatestPeriod);
          } else {
            setPeriodoSeleccionado(data.planMeta.periodoSeleccionado);
          }
          setFechaCorteState(new Date(data.planMeta.fechaCorteState));
          setMapaColumnasMes(data.planMeta.mapaColumnasMes);
          setPlanillaInfo(data.planMeta.planillaInfo);
          setPlanillaHojas(data.planillaHojas);
          setPlanillaPartidas(data.planillaPartidas);
          setPlanillaTotales(data.planMeta.planillaTotales);
          setPlanillaEnmiendas(data.planMeta.planillaEnmiendas || []);
          setPlanillaTipRes(data.planMeta.planillaTipRes || []);
          setPlanillaCDOvsS(data.planMeta.planillaCDOvsS || { F: {}, H: {} });
          
          const reconstructedPlan: Record<string, any> = {};
          const reconstructedPlanPG004: Record<string, any> = {};
          recomputedActividades.forEach(a => {
            if (a.activityId && a.planificadoPorFecha) {
              reconstructedPlan[a.activityId] = a.planificadoPorFecha;
            }
            if (a.activityId && a.planificadoPorFechaPG004) {
              reconstructedPlanPG004[a.activityId] = a.planificadoPorFechaPG004;
            }
          });
          setDataPlanificado(reconstructedPlan);
          setDataPlanificadoPG004(reconstructedPlanPG004);
          
          setLoadingProgress(94);
          setLoadingPhase('Configurando estructuras de costeo CDO y planillas...');
          
          const fMeta = { 
            fileName: data.planMeta.fileName, 
            rowCount: data.planMeta.rowCount,
            isFirebase: true,
            updatedAt: data.planMeta.updatedAt
          };
          setFileData(fMeta);

          setFirebasePlanData({
            actividades: recomputedActividades,
            planillaHojas: data.planillaHojas,
            planillaPartidas: data.planillaPartidas,
            planillaCDOvsS: data.planMeta.planillaCDOvsS || { F: {}, H: {} },
            planillaTotales: data.planMeta.planillaTotales,
            planillaEnmiendas: data.planMeta.planillaEnmiendas || [],
            planillaTipRes: data.planMeta.planillaTipRes || [],
            planillaInfo: data.planMeta.planillaInfo,
            fileData: fMeta,
            dataPlanificado: reconstructedPlan,
            dataPlanificadoPG004: reconstructedPlanPG004
          });
          setSourceActive('firebase');
          
          setLoadingProgress(98);
          setLoadingPhase('Guardando copia de seguridad de alto rendimiento local...');
          
          // Guardar una copia en el localStorage para fallbacks sin conexión o límite de cuota
          savePlanToLocalStorage({
            actividades: data.actividades,
            planillaHojas: data.planillaHojas,
            planillaPartidas: data.planillaPartidas,
            planillaCDOvsS: data.planMeta.planillaCDOvsS || { F: {}, H: {} },
            planillaTotales: data.planMeta.planillaTotales,
            planillaEnmiendas: data.planMeta.planillaEnmiendas || [],
            planillaTipRes: data.planMeta.planillaTipRes || [],
            planillaInfo: data.planMeta.planillaInfo,
            fileData: fMeta,
            periodoSeleccionado: data.planMeta.periodoSeleccionado,
            fechaCorteState: data.planMeta.fechaCorteState,
            mapaColumnasMes: data.planMeta.mapaColumnasMes,
            dataPlanificado: reconstructedPlan,
            dataPlanificadoPG004: reconstructedPlanPG004
          });

          await new Promise(resolve => setTimeout(resolve, 250));

          setLoadingProgress(100);
          setLoadingPhase('¡Plan de control pre-cargado desde Firebase!');
          setTimeout(() => {
            setLoadingProgress(0);
            setLoadingPhase('');
          }, 3500);
        } else {
          console.log('No se encontró ningún plan previo en Firebase.');
          setLoadingProgress(0);
          setLoadingPhase('');
        }
      } catch (err) {
        console.warn('Error cargando plan desde Firebase al iniciar, intentando copia de seguridad offline:', err);
        const errStr = String(err);
        if (errStr.toLowerCase().includes('quota') || errStr.toLowerCase().includes('exhausted') || errStr.toLowerCase().includes('limit') || errStr.toLowerCase().includes('database')) {
          setFirebaseQuotaExceeded(true);
        }
        
        // Cargar desde localStorage
        const backup = loadPlanFromLocalStorage();
        if (backup) {
          setLoadingProgress(20);
          setLoadingPhase('Recuperando copia de seguridad local (offline)...');
          await new Promise(resolve => setTimeout(resolve, 350));
          
          setLoadingProgress(55);
          setLoadingPhase('Procesando datos del respaldo local...');
          
          const recomputedActividades = rebuildAggregatedDates(backup.actividades);
          setActividades(recomputedActividades);
          const computedLatestBackupPeriod = getLatestPeriodFromMap(backup.mapaColumnasMes);
          if (computedLatestBackupPeriod) {
            setPeriodoSeleccionado(computedLatestBackupPeriod);
          } else {
            setPeriodoSeleccionado(backup.periodoSeleccionado);
          }
          setFechaCorteState(new Date(backup.fechaCorteState));
          setMapaColumnasMes(backup.mapaColumnasMes);
          setPlanillaInfo(backup.planillaInfo);
          setPlanillaHojas(backup.planillaHojas);
          setPlanillaPartidas(backup.planillaPartidas);
          setPlanillaTotales(backup.planillaTotales);
          setPlanillaEnmiendas(backup.planillaEnmiendas || []);
          setPlanillaTipRes(backup.planillaTipRes || []);
          setPlanillaCDOvsS(backup.planillaCDOvsS || { F: {}, H: {} });
          
           const reconstructedPlan: Record<string, any> = {};
           const reconstructedPlanPG004: Record<string, any> = {};
           if (backup.dataPlanificado) {
             Object.assign(reconstructedPlan, backup.dataPlanificado);
           }
           if (backup.dataPlanificadoPG004) {
             Object.assign(reconstructedPlanPG004, backup.dataPlanificadoPG004);
           }
           
           if (backup.actividades) {
             backup.actividades.forEach((a: any) => {
               if (a.activityId && a.planificadoPorFecha) {
                 reconstructedPlan[a.activityId] = a.planificadoPorFecha;
               }
               if (a.activityId && a.planificadoPorFechaPG004) {
                 reconstructedPlanPG004[a.activityId] = a.planificadoPorFechaPG004;
               }
             });
           }
           setDataPlanificado(reconstructedPlan);
           setDataPlanificadoPG004(reconstructedPlanPG004);
           
           await new Promise(resolve => setTimeout(resolve, 350));
           setLoadingProgress(80);
           setLoadingPhase('Configurando interfaz con caché de contingencia local...');
           
           const fMeta = { 
             fileName: backup.fileData.fileName, 
             rowCount: backup.fileData.rowCount,
             isFirebase: false,
             isBackup: true,
             updatedAt: backup.fileData.updatedAt
           };
           setFileData(fMeta);
 
           setFirebasePlanData({
             actividades: recomputedActividades,
             planillaHojas: backup.planillaHojas,
             planillaPartidas: backup.planillaPartidas,
             planillaCDOvsS: backup.planillaCDOvsS || { F: {}, H: {} },
             planillaTotales: backup.planillaTotales,
             planillaEnmiendas: backup.planillaEnmiendas || [],
             planillaTipRes: backup.planillaTipRes || [],
             planillaInfo: backup.planillaInfo,
             fileData: fMeta,
             dataPlanificado: reconstructedPlan,
             dataPlanificadoPG004: reconstructedPlanPG004
           });
          setSourceActive('firebase');
          
          await new Promise(resolve => setTimeout(resolve, 300));
          
          setLoadingProgress(100);
          setLoadingPhase('¡Copia de seguridad local cargada correctamente!');
          setTimeout(() => {
            setLoadingProgress(0);
            setLoadingPhase('');
          }, 3500);
        } else {
          setLoadingProgress(0);
          setLoadingPhase('');
        }
      }
    }
    loadInitialPlan();
  }, [isLoggedIn]);

  const publishPlanToFirebase = async () => {
    if (isPublishingRef.current) {
      alert('Ya hay un proceso de publicación en curso. Por favor espere a que finalice.');
      return;
    }
    if (loadingProgress > 0 || (loadingPhase && loadingPhase.trim() !== '')) {
      alert('Ya hay un proceso de carga o sincronización en curso. Por favor espere a que finalice.');
      return;
    }
    if (!fileData || actividades.length === 0) {
      alert('Primero cargue un archivo Excel local de Master Plan.');
      return;
    }
    
    isPublishingRef.current = true;
    setLoadingProgress(5);
    setLoadingPhase('Sincronizando y publicando en la nube (Firebase)...');
    
    try {
      await savePlanToFirebase(
        fileData.fileName,
        fileData.rowCount,
        periodoSeleccionado,
        fechaCorteState.toISOString(),
        mapaColumnasMes,
        planillaInfo,
        planillaTotales,
        planillaCDOvsS,
        actividades,
        planillaHojas,
        planillaPartidas,
        planillaEnmiendas,
        planillaTipRes,
        (pct, statusMsg) => {
          setLoadingProgress(pct);
          setLoadingPhase(statusMsg);
        }
      );
      
      setFileData((prev: any) => ({
        ...prev,
        isFirebase: true,
        updatedAt: new Date().toISOString()
      }));
      
      alert('¡El Master Plan se ha publicado en la nube correctamente! Ahora cualquier usuario que abra la plataforma verá esta información de forma predeterminada.');
    } catch (err) {
      console.error('Error al guardar en Firebase:', err);
      const errStr = String(err);
      if (errStr.toLowerCase().includes('quota') || errStr.toLowerCase().includes('exhausted') || errStr.toLowerCase().includes('limit') || errStr.toLowerCase().includes('database')) {
        setFirebaseQuotaExceeded(true);
        alert('Límite de cuota excedido: El límite diario gratuito de Firebase ha sido alcanzado. Los datos se han guardado de manera local offline en tu navegador, pero no se pudieron publicar en la nube.');
      } else {
        alert('Error publicando el proyecto en la base de datos de Firebase. Detalles en la consola.');
      }
    } finally {
      setLoadingProgress(0);
      setLoadingPhase('');
      isPublishingRef.current = false;
    }
  };

  const aplicarBusqueda = () => {
    setSearchTerm(searchInput.trim());
  };

  const limpiarBusqueda = () => {
    setSearchInput('');
    setSearchTerm('');
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      aplicarBusqueda();
    }
  };

  const updateProgress = (pct: number, phase: string) => {
    setLoadingProgress(pct);
    setLoadingPhase(phase);
    return new Promise<void>(resolve => setTimeout(resolve, 0));
  };

  // Clean and normalize activity IDs to prevent issues with formatting and numeric types (e.g., .0 suffix)
  const cleanId = (id: any): string => {
    if (id === null || id === undefined) return '';
    let s = String(id).trim();
    if (s.endsWith('.0')) {
      s = s.slice(0, -2);
    }
    return s;
  };

  const numericDataPlanCache = useMemo(() => new WeakMap<any, Map<number, string>>(), []);

  // Helper robusto para obtener plan de actividad de un plan seleccionado
  const obtenerPlanDeActividad = (actId: string | null, dataPlan: any) => {
    if (!dataPlan || !actId) return {};
    const trimmed = String(actId).trim();
    if (dataPlan[trimmed] !== undefined) {
      return dataPlan[trimmed];
    }
    if (dataPlan[actId] !== undefined) {
      return dataPlan[actId];
    }
    const cleaned = cleanId(actId);
    if (dataPlan[cleaned] !== undefined) {
      return dataPlan[cleaned];
    }
    const actIdNum = Number(trimmed);
    if (!isNaN(actIdNum)) {
      if (typeof dataPlan === 'object') {
        let numericMap = numericDataPlanCache.get(dataPlan);
        if (!numericMap) {
          numericMap = new Map<number, string>();
          for (const k of Object.keys(dataPlan)) {
            const num = Number(k.trim());
            if (!isNaN(num)) numericMap.set(num, k);
          }
          numericDataPlanCache.set(dataPlan, numericMap);
        }
        const matchingKey = numericMap.get(actIdNum);
        if (matchingKey) {
          return dataPlan[matchingKey];
        }
      }
    }
    return {};
  };

  // Dynamic scaling for PG-003 to match ventaM (Column M, which sums to 166M)
  const finalDataPlanificadoPG003 = useMemo(() => {
    return dataPlanificado;
  }, [dataPlanificado]);

  // Dynamic scaling for PG-004 to match venta (Column I, which sums to 228M)
  const finalDataPlanificadoPG004 = useMemo(() => {
    const sourceData = (dataPlanificadoPG004 && Object.keys(dataPlanificadoPG004).length > 0)
      ? dataPlanificadoPG004
      : dataPlanificado;
    return sourceData;
  }, [dataPlanificado, dataPlanificadoPG004]);

  const selectedPlanForGrid = useMemo(() => {
    return baseVenta === 'reformulada' ? finalDataPlanificadoPG004 : finalDataPlanificadoPG003;
  }, [baseVenta, finalDataPlanificadoPG003, finalDataPlanificadoPG004]);

  const selectedDataPlanificado = useMemo(() => {
    return donutPG === 'reformulada' ? finalDataPlanificadoPG004 : finalDataPlanificadoPG003;
  }, [donutPG, finalDataPlanificadoPG003, finalDataPlanificadoPG004]);

  // Selector de base de Venta según el toggle
  const getVB = (i: any) => baseVenta === 'contrato' ? (i.ventaM || 0) : (i.venta || 0);

  // Calcular valores reales de una partida/subpartida sumando sus items hoja
  const calcularValoresReales = (item: any) => {
    const filtrarPorPeriodo = periodoSeleccionado && periodoSeleccionado.anio !== 'TODOS';
    let anioFiltro: number | null = null, mesFiltro: number | null = null;
    if (filtrarPorPeriodo) {
      anioFiltro = parseInt(periodoSeleccionado.anio, 10);
      const nombresMesPer = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      mesFiltro = nombresMesPer.indexOf(periodoSeleccionado.mes) + 1; // 1..12
    }

    const getPlanPeriodo = (a: any) => {
      if (!filtrarPorPeriodo) return getVB(a);
      const plan = obtenerPlanDeActividad(a.activityId, selectedPlanForGrid);
      if (!plan || Object.keys(plan).length === 0) return 0;
      let suma = 0;
      Object.entries(plan).forEach(([fechaKey, valor]: any) => {
        const [yStr, mStr] = fechaKey.split('-');
        if (parseInt(yStr, 10) === anioFiltro && parseInt(mStr, 10) === mesFiltro) {
          suma += valor;
        }
      });
      return suma;
    };

    const getEjecPeriodo = (a: any) => {
      if (!filtrarPorPeriodo) return (a.ventaEjecutada || 0);
      if (!a.certificacionesPorFecha) return 0;
      let suma = 0;
      Object.entries(a.certificacionesPorFecha).forEach(([fechaKey, valor]: any) => {
        const [yStr, mStr] = fechaKey.split('-');
        if (parseInt(yStr, 10) === anioFiltro && parseInt(mStr, 10) === mesFiltro) {
          suma += valor;
        }
      });
      return suma;
    };

    if (!item) {
      return { venta: 0, ventaPlan: 0, ventaEjecutada: 0, saldo: 0 };
    }

    if (item.esItemHoja) {
      const v = getVB(item);
      const plan = getPlanPeriodo(item);
      const ejec = getEjecPeriodo(item);
      return {
        venta: v,
        ventaPlan: plan,
        ventaEjecutada: ejec,
        saldo: ejec - plan
      };
    }
    
    const cleanWbs = (w: string) => (w || '').replace(/^p\d*\.?/, '');
    const partidaPath = cleanWbs(item.wbs || '');
    
    if (!partidaPath) {
      let itemsHijos = actividades.filter(a => a.esItemHoja);
      if (tipologiaSeleccionada) {
        itemsHijos = itemsHijos.filter(a => a.tipo === tipologiaSeleccionada);
      }
      if (isRespFilterActive) {
        itemsHijos = itemsHijos.filter(a => matchesRespFilter(a));
      }
      const sumVenta = itemsHijos.reduce((sum, a) => sum + getVB(a), 0);
      const sumPlan  = itemsHijos.reduce((sum, a) => sum + getPlanPeriodo(a), 0);
      const sumEjec  = itemsHijos.reduce((sum, a) => sum + getEjecPeriodo(a), 0);
      return {
        venta: sumVenta,
        ventaPlan: sumPlan,
        ventaEjecutada: sumEjec,
        saldo: sumEjec - sumPlan
      };
    }
    
    const itemsHijos = actividades.filter(a => {
      if (!a.esItemHoja) return false;
      if (tipologiaSeleccionada && a.tipo !== tipologiaSeleccionada) return false;
      if (isRespFilterActive && !matchesRespFilter(a)) return false;
      
      const itemPath = cleanWbs(a.wbs || '');
      return itemPath === partidaPath || itemPath.startsWith(partidaPath + '.');
    });
    
    const sumVenta = itemsHijos.reduce((sum, a) => sum + getVB(a), 0);
    const sumPlan  = itemsHijos.reduce((sum, a) => sum + getPlanPeriodo(a), 0);
    const sumEjec  = itemsHijos.reduce((sum, a) => sum + getEjecPeriodo(a), 0);
    return {
      venta: sumVenta,
      ventaPlan: sumPlan,
      ventaEjecutada: sumEjec,
      saldo: sumEjec - sumPlan
    };
  };

  const calcularAvance = (item: any) => {
    if (item && item.avanceAT !== undefined && item.avanceAT !== null) {
      const parsed = Number(item.avanceAT);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const planTotalProyecto = useMemo(() => {
    return actividades.length
      ? actividades.filter(a => a.esItemHoja).reduce((s, a) => s + (a.ventaM || 0), 0)
      : 0;
  }, [actividades]);

  // Stats globales
  const stats = useMemo(() => {
    if (!actividades.length) return null;

    let itemsHoja = actividades.filter(a => a.esItemHoja);
    if (tipologiaSeleccionada) {
      itemsHoja = itemsHoja.filter(a => a.tipo === tipologiaSeleccionada);
    }
    if (isRespFilterActive) {
      itemsHoja = itemsHoja.filter(a => matchesRespFilter(a));
    }
    
    const totalVenta = itemsHoja.reduce((sum, a) => sum + getVB(a), 0);
    const totalVentaPlan = itemsHoja.reduce((sum, a) => sum + (a.ventaPlan || 0), 0);
    const totalVentaEjecutada = itemsHoja.reduce((sum, a) => sum + (a.ventaEjecutada || 0), 0);
    const totalSaldo = itemsHoja.reduce((sum, a) => sum + (getVB(a) - (a.ventaEjecutada || 0)), 0);

    const periodoFiltrado = periodoSeleccionado && periodoSeleccionado.anio !== 'TODOS';
    let _anioP: number | null = null, _mesP: number | null = null;
    if (periodoFiltrado) {
      _anioP = parseInt(periodoSeleccionado.anio, 10);
      const _nm = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      _mesP = _nm.indexOf(periodoSeleccionado.mes) + 1;
    }

    const getPlanItem = (a: any) => {
      if (!periodoFiltrado) return getVB(a);
      const plan = obtenerPlanDeActividad(a.activityId, selectedPlanForGrid);
      if (!plan || Object.keys(plan).length === 0) return 0;
      let s = 0;
      Object.entries(plan).forEach(([fk, v]: any) => {
        const [y, m] = fk.split('-');
        if (parseInt(y, 10) === _anioP && parseInt(m, 10) === _mesP) s += v;
      });
      return s;
    };

    const getEjecItem = (a: any) => {
      if (!periodoFiltrado) return (a.ventaEjecutada || 0);
      if (!a.certificacionesPorFecha) return 0;
      let s = 0;
      Object.entries(a.certificacionesPorFecha).forEach(([fk, v]: any) => {
        const [y, m] = fk.split('-');
        if (parseInt(y, 10) === _anioP && parseInt(m, 10) === _mesP) s += v;
      });
      return s;
    };

    const totalVentaPlanPeriodo = itemsHoja.reduce((sum, a) => sum + getPlanItem(a), 0);
    const totalVentaEjecutadaPeriodo = itemsHoja.reduce((sum, a) => sum + getEjecItem(a), 0);
    const totalSaldoPeriodo = totalVentaEjecutadaPeriodo - totalVentaPlanPeriodo;
    const totalVentaFebrero = itemsHoja.reduce((sum, a) => sum + (a.ventaFebrero || 0), 0);
    
    const esPeriodoTodos = periodoSeleccionado.anio === 'TODOS';
    const nombresMesAnio = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const mesIdxSeleccionado = nombresMesAnio.indexOf(periodoSeleccionado.mes);
    const anioSeleccionado = parseInt(periodoSeleccionado.anio, 10);

    const totalVentaPeriodo = esPeriodoTodos
      ? itemsHoja.reduce((sum, a) => sum + (a.ventaEjecutada || 0), 0)
      : itemsHoja.reduce((sum, a) => {
          if (!a.certificacionesPorFecha) return sum;
          let ventaPeriodo = 0;
          Object.entries(a.certificacionesPorFecha).forEach(([fechaKey, valor]) => {
            const [aStr, mStr] = fechaKey.split('-');
            if (parseInt(aStr, 10) === anioSeleccionado && parseInt(mStr, 10) - 1 === mesIdxSeleccionado) {
              ventaPeriodo += Number(valor) || 0;
            }
          });
          return sum + ventaPeriodo;
        }, 0);
    
    const totalExcedentes = itemsHoja
      .filter(a => a.ventaEjecutada > 0)
      .reduce((sum, a) => {
        const ventaMeta = baseVenta === 'contrato' ? (a.ventaM || 0) : (a.venta || 0);
        return sum + (a.ventaEjecutada - ventaMeta);
      }, 0);
    
    const tipologias: Record<string, any> = {};
    itemsHoja.forEach(item => {
      const tipo = item.tipo || 'Otros';
      if (!tipologias[tipo]) {
        tipologias[tipo] = {
          nombre: tipo,
          venta: 0,
          ventaEjecutada: 0,
          saldo: 0,
          items: 0
        };
      }
      const ventaBase = getVB(item);
      tipologias[tipo].venta += ventaBase;
      tipologias[tipo].ventaEjecutada += item.ventaEjecutada;
      tipologias[tipo].saldo += (ventaBase - (item.ventaEjecutada || 0));
      
      const isArtificial = item.totalFloat === null && !['Completed', 'In Progress', 'Not Started'].includes(item.p6Status);
      if (!isArtificial) {
        tipologias[tipo].items += 1;
      }
    });
    
    Object.values(tipologias).forEach(tip => {
      tip.avance = tip.venta > 0 ? ((tip.ventaEjecutada / tip.venta) * 100).toFixed(2) : 0;
    });

    const partidasPrincipales = actividades.filter(a => a.nivel === 2 && !a.esItemHoja);

    const nonArtificialItemsHojaCount = itemsHoja.filter(a => {
      const isArtificial = a.totalFloat === null && !['Completed', 'In Progress', 'Not Started'].includes(a.p6Status);
      return !isArtificial;
    }).length;

    return {
      totalActividades: actividades.filter(a => {
        if (a.esItemHoja) {
          const isArtificial = a.totalFloat === null && !['Completed', 'In Progress', 'Not Started'].includes(a.p6Status);
          return !isArtificial;
        }
        return true;
      }).length,
      itemsHoja: nonArtificialItemsHojaCount,
      actividadesPrincipales: partidasPrincipales.length,
      totalVenta,
      totalVentaPlan,
      totalVentaEjecutada,
      totalSaldo,
      totalExcedentes,
      totalVentaPlanPeriodo,
      totalVentaEjecutadaPeriodo,
      totalSaldoPeriodo,
      totalVentaFebrero,
      totalVentaPeriodo,
      avanceGeneral: totalVenta > 0 ? ((totalVentaEjecutada / totalVenta) * 100).toFixed(2) : 0,
      avancePeriodo: periodoFiltrado
        ? (totalVentaPlanPeriodo > 0 
            ? ((totalVentaEjecutadaPeriodo / totalVentaPlanPeriodo) * 100).toFixed(2) 
            : (totalVentaEjecutadaPeriodo > 0 ? '100.00' : '0.00'))
        : (totalVenta > 0 ? ((totalVentaEjecutada / totalVenta) * 100).toFixed(2) : '0.00'),
      tipologias: Object.values(tipologias).sort((a: any, b: any) => b.venta - a.venta)
    };
  }, [actividades, tipologiaSeleccionada, filterResp, periodoSeleccionado, baseVenta, selectedPlanForGrid]);

  // Stats de Cronograma
  const statsCronograma = useMemo(() => {
    if (!actividades.length) return null;

    let itemsHoja = actividades.filter(a => {
      if (!a.esItemHoja) return false;
      if (a.descripcion?.trim().toLowerCase().startsWith('procura')) return false;
      const rawWbs = a.wbs || '';
      const wbs = rawWbs.replace(/^p\d{4}\./, 'p.');
      // Excluir bloque p.D "Actividades pendientes de confirmar por el Ingeniero"
      if (wbs.startsWith('p.D')) return false;
      // Excluir actividades artificiales redundantes (sin Float y sin estado válido de Primavera)
      const isArtificial = a.totalFloat === null && !['Completed', 'In Progress', 'Not Started'].includes(a.p6Status);
      if (isArtificial) return false;
      return true;
    });
    if (tipologiaSeleccionada) {
      itemsHoja = itemsHoja.filter(a => a.tipo === tipologiaSeleccionada);
    }
    if (isRespFilterActive) {
      itemsHoja = itemsHoja.filter(a => matchesRespFilter(a));
    }
    
    const itemsAtrasados = itemsHoja.filter(a => a.estaAtrasadoCronograma);
    const itemsAtrasadosInicio = itemsHoja.filter(a => a.diasAtrasoInicio > 0);
    const itemsAtrasadosFin = itemsHoja.filter(a => a.diasAtrasoFin > 0);
    const itemsCriticos = itemsHoja.filter(a => a.diasAtrasoMaximo > 30);

    const promedioAtrasoInicio = itemsAtrasadosInicio.length > 0
      ? itemsAtrasadosInicio.reduce((sum, a) => sum + a.diasAtrasoInicio, 0) / itemsAtrasadosInicio.length : 0;
    const promedioAtrasoFin = itemsAtrasadosFin.length > 0
      ? itemsAtrasadosFin.reduce((sum, a) => sum + a.diasAtrasoFin, 0) / itemsAtrasadosFin.length : 0;

    const tipologias: Record<string, any> = {};
    itemsHoja.forEach(item => {
      const tipo = item.tipo || 'Otros';
      if (!tipologias[tipo]) {
        tipologias[tipo] = {
          nombre: tipo,
          items: 0,
          itemsAtrasados: 0,
          itemsAtrasadosInicio: 0,
          itemsAtrasadosFin: 0,
          itemsCriticos: 0,
          sumAtrasoInicio: 0,
          sumAtrasoFin: 0,
        };
      }
      const t = tipologias[tipo];
      t.items += 1;
      if (item.estaAtrasadoCronograma) t.itemsAtrasados += 1;
      if (item.diasAtrasoInicio > 0) { t.itemsAtrasadosInicio += 1; t.sumAtrasoInicio += item.diasAtrasoInicio; }
      if (item.diasAtrasoFin > 0) { t.itemsAtrasadosFin += 1; t.sumAtrasoFin += item.diasAtrasoFin; }
      if (item.diasAtrasoMaximo > 30) t.itemsCriticos += 1;
    });

    Object.values(tipologias).forEach(t => {
      t.porcentajeAtrasado = t.items > 0 ? ((t.itemsAtrasados / t.items) * 100).toFixed(1) : 0;
      t.promedioAtrasoInicio = t.itemsAtrasadosInicio > 0 ? Math.round(t.sumAtrasoInicio / t.itemsAtrasadosInicio) : 0;
      t.promedioAtrasoFin = t.itemsAtrasadosFin > 0 ? Math.round(t.sumAtrasoFin / t.itemsAtrasadosFin) : 0;
    });

    const partidas: Record<string, any> = {};
    itemsHoja.forEach(item => {
      const wbsParts = (item.wbs || '').split('.');
      const partida = wbsParts.length >= 2 ? wbsParts.slice(0, 2).join('.') : item.wbs;
      if (!partidas[partida]) {
        const padreAct = actividades.find(a => a.wbs === partida && !a.esItemHoja);
        partidas[partida] = {
          wbs: partida,
          desc: padreAct?.descripcion || partida,
          items: 0,
          itemsAtrasados: 0,
          itemsAtrasadosInicio: 0,
          itemsAtrasadosFin: 0,
          itemsCriticos: 0,
          sumAtrasoInicio: 0,
          sumAtrasoFin: 0,
        };
      }
      const p = partidas[partida];
      p.items += 1;
      if (item.estaAtrasadoCronograma) p.itemsAtrasados += 1;
      if (item.diasAtrasoInicio > 0) { p.itemsAtrasadosInicio += 1; p.sumAtrasoInicio += item.diasAtrasoInicio; }
      if (item.diasAtrasoFin > 0) { p.itemsAtrasadosFin += 1; p.sumAtrasoFin += item.diasAtrasoFin; }
      if (item.diasAtrasoMaximo > 30) p.itemsCriticos += 1;
    });

    Object.values(partidas).forEach(p => {
      p.porcentajeAtrasado = p.items > 0 ? ((p.itemsAtrasados / p.items) * 100).toFixed(1) : 0;
      p.promedioAtrasoInicio = p.itemsAtrasadosInicio > 0 ? Math.round(p.sumAtrasoInicio / p.itemsAtrasadosInicio) : 0;
      p.promedioAtrasoFin = p.itemsAtrasadosFin > 0 ? Math.round(p.sumAtrasoFin / p.itemsAtrasadosFin) : 0;
    });
    
    const acCriticasVal = itemsHoja.filter(a => a.totalFloat === 0 && (a.p6Status === 'In Progress' || a.p6Status === 'Not Started')).length;
    const acSubcriticasVal = Math.max(0, itemsHoja.filter(a => a.totalFloat !== null && a.totalFloat < 40).length - acCriticasVal);

    return {
      totalItems: itemsHoja.length,
      itemsAtrasados: itemsAtrasados.length,
      porcentajeAtrasado: itemsHoja.length > 0 ? ((itemsAtrasados.length / itemsHoja.length) * 100).toFixed(1) : 0,
      promedioAtrasoInicio: Math.round(promedioAtrasoInicio),
      promedioAtrasoFin: Math.round(promedioAtrasoFin),
      itemsCriticos: itemsCriticos.length,
      acTotal: itemsHoja.length,
      acCompletadas: itemsHoja.filter(a => a.p6Status === 'Completed').length,
      acEnCurso: itemsHoja.filter(a => a.p6Status === 'In Progress').length,
      acNoIniciadas: itemsHoja.filter(a => a.p6Status === 'Not Started').length,
      acCriticas: acCriticasVal,
      acSubcriticas: acSubcriticasVal,
      tipologias: Object.values(tipologias),
      partidas: Object.values(partidas).sort((a: any, b: any) => {
        const ka = a.wbs.replace('p.', ''), kb = b.wbs.replace('p.', '');
        const na = isNaN(Number(ka)) ? Infinity : Number(ka);
        const nb = isNaN(Number(kb)) ? Infinity : Number(kb);
        return na !== nb ? na - nb : ka.localeCompare(kb);
      }),
      actividadesPrincipales: actividades.filter(a => a.nivel === 2 && !a.esItemHoja).length,
      partidasPrincipales: actividades.filter(a => a.nivel === 1 && !a.esItemHoja).length
    };
  }, [actividades, tipologiaSeleccionada, filterResp]);

  // Curve and Donut calculations
  const datosCurvaAvance = useMemo(() => {
    if (!actividades.length || !selectedDataPlanificado) return null;

    // Solo los que tienen un Activity id (columna C) que inicia numericamente aportan avance economico
    const itemsHoja = actividades.filter(a => a.esItemHoja && a.activityId && /^\d/.test(String(a.activityId).trim()));
    const datosPorMes: Record<string, any> = {};
    const procesados = new Set();

    const acumularEnMes = (fechaKey: string, campo: string, valor: number) => {
      const partes = fechaKey.split('-');
      const yyyy = parseInt(partes[0], 10);
      const mm = parseInt(partes[1], 10) - 1; // 0-indexed
      const dd = parseInt(partes[2], 10);
      
      const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mesKey = `${shortMonths[mm]}-${yyyy.toString().slice(-2)}`;
      
      if (!datosPorMes[mesKey]) {
        datosPorMes[mesKey] = {
          mes: mesKey,
          fecha: new Date(yyyy, mm, 1),
          anio: yyyy,
          ejecutado: 0,
          planificado: 0
        };
      }
      datosPorMes[mesKey][campo] += valor;
    };

    const norm = (id: any) => String(id);
    itemsHoja.forEach(item => {
      const key = norm(item.activityId);
      if (procesados.has(key)) return;
      procesados.add(key);

      if (item.certificacionesPorFecha) {
        Object.entries(item.certificacionesPorFecha).forEach(([f, v]) => acumularEnMes(f, 'ejecutado', Number(v) || 0));
      }
      const planItem = (item.planificadoPorFechaPG004 && Object.keys(item.planificadoPorFechaPG004).length > 0)
        ? item.planificadoPorFechaPG004
        : obtenerPlanDeActividad(item.activityId, selectedDataPlanificado);
      Object.entries(planItem).forEach(([f, v]: any) => acumularEnMes(f, 'planificado', v));
    });

    let acumE = 0, acumP = 0;
    const meses = Object.values(datosPorMes)
      .sort((a: any, b: any) => a.fecha.getTime() - b.fecha.getTime())
      .map((m: any) => {
        acumE += m.ejecutado;
        acumP += m.planificado;
        return { ...m, acumEjecutado: acumE, acumPlanificado: acumP };
      });

    if (meses.length === 0) return null;

    const porAnio: Record<number, any> = {};
    meses.forEach((m: any) => {
      if (!porAnio[m.anio]) porAnio[m.anio] = { anio: m.anio, ejecutado: 0, planificado: 0, meses: [] };
      porAnio[m.anio].ejecutado += m.ejecutado;
      porAnio[m.anio].planificado += m.planificado;
      porAnio[m.anio].meses.push(m);
    });
    const aniosArr = Object.values(porAnio).sort((a: any, b: any) => a.anio - b.anio);

    return { meses, aniosArr };
  }, [actividades, selectedDataPlanificado]);



  const datosDona = useMemo(() => {
    if (!actividades.length) return null;

    // Solo los que tienen un Activity id (columna C) que inicia numericamente aportan avance economico
    const itemsHoja = actividades.filter(a => a.esItemHoja && a.activityId && /^\d/.test(String(a.activityId).trim()));
    const acumEjec: Record<string, any> = { tipo: {}, scap: {}, cap: {}, macro: {}, componente: {} };
    const acumEjecSem: Record<string, any> = { tipo: {}, scap: {}, cap: {}, macro: {}, componente: {} };
    const acumPlan: Record<string, any> = { tipo: {}, scap: {}, cap: {}, macro: {}, componente: {} };
    const acumPlanSem: Record<string, any> = { tipo: {}, scap: {}, cap: {}, macro: {}, componente: {} };
    const aniosSet = new Set<number>();
    const mesesPorAnio: Record<number, Set<number>> = {};
    const semanasPorAnioMes: Record<string, Set<string>> = {};

    const registrarMes = (anio: number, mes: number) => {
      aniosSet.add(anio);
      if (!mesesPorAnio[anio]) mesesPorAnio[anio] = new Set();
      mesesPorAnio[anio].add(mes);
    };

    itemsHoja.forEach(item => {
      const tipo = item.tipo || '(Sin Tipo)';
      const scap = item.scap || '(Sin SCAP)';
      const cap  = item.cap  || '(Sin CAP)';
      const componente = item.componente || '(Sin Componente)';

      if (item.certificacionesPorFecha) {
        Object.entries(item.certificacionesPorFecha).forEach(([fechaKey, valor]) => {
          if (!valor) return;
          const partes = fechaKey.split('-');
          const anio = parseInt(partes[0], 10);
          const mes = parseInt(partes[1], 10);
          const ymKey  = `${anio}-${String(mes).padStart(2, '0')}`;
          const ymdKey = fechaKey.slice(0, 10); 
          registrarMes(anio, mes);
          if (!semanasPorAnioMes[ymKey]) semanasPorAnioMes[ymKey] = new Set();
          semanasPorAnioMes[ymKey].add(ymdKey);
          [['tipo', tipo], ['scap', scap], ['cap', cap], ['macro', item.macro || '(Sin Macro)'], ['componente', componente]].forEach(([dim, key]) => {
            if (!acumEjec[dim][key]) acumEjec[dim][key] = {};
            acumEjec[dim][key][ymKey] = (acumEjec[dim][key][ymKey] || 0) + valor;
            if (!acumEjecSem[dim][key]) acumEjecSem[dim][key] = {};
            acumEjecSem[dim][key][ymdKey] = (acumEjecSem[dim][key][ymdKey] || 0) + valor;
          });
        });
      }

      const planItem = obtenerPlanDeActividad(item.activityId, selectedDataPlanificado);
      if (planItem && Object.keys(planItem).length > 0) {
        Object.entries(planItem).forEach(([fechaKey, valor]: any) => {
          if (!valor) return;
          const partes = fechaKey.split('-');
          const anio = parseInt(partes[0], 10);
          const mes = parseInt(partes[1], 10);
          if (isNaN(anio) || isNaN(mes)) return;
          const ymKey = `${anio}-${String(mes).padStart(2, '0')}`;
          const ymdKeyPlan = fechaKey.slice(0, 10);
          registrarMes(anio, mes);
          if (!semanasPorAnioMes[ymKey]) semanasPorAnioMes[ymKey] = new Set();
          semanasPorAnioMes[ymKey].add(ymdKeyPlan);
          [['tipo', tipo], ['scap', scap], ['cap', cap], ['macro', item.macro || '(Sin Macro)'], ['componente', componente]].forEach(([dim, key]) => {
            if (!acumPlan[dim][key]) acumPlan[dim][key] = {};
            acumPlan[dim][key][ymKey] = (acumPlan[dim][key][ymKey] || 0) + valor;
            if (!acumPlanSem[dim][key]) acumPlanSem[dim][key] = {};
            acumPlanSem[dim][key][ymdKeyPlan] = (acumPlanSem[dim][key][ymdKeyPlan] || 0) + valor;
          });
        });
      }
    });

    return {
      acumEjec,
      acumEjecSem,
      acumPlan,
      acumPlanSem,
      anios: Array.from(aniosSet).sort((a, b) => a - b),
      mesesPorAnio: Object.fromEntries(Object.entries(mesesPorAnio).map(([a, s]) => [a, Array.from(s).sort((x, y) => x - y)])),
      semanasPorAnioMes: Object.fromEntries(Object.entries(semanasPorAnioMes).map(([k, s]) => [k, Array.from(s).sort()]))
    };
  }, [actividades, selectedDataPlanificado]);

  const ultimaSemanaConAvance = useMemo(() => {
    if (!datosDona) return null;
    let latest = '';
    Object.values(datosDona.acumEjecSem).forEach((dimFuente: any) => {
      Object.values(dimFuente).forEach((porSemana: any) => {
        Object.entries(porSemana).forEach(([semKey, v]: any) => {
          if (v > 0 && semKey > latest) {
            latest = semKey;
          }
        });
      });
    });
    return latest || null;
  }, [datosDona]);

  const donaAgregada = useMemo(() => {
    if (!datosDona) return null;

    if (donutPG === 'reformulada') {
      const fuente: Record<string, number> = {};
      actividades.forEach(item => {
        if (!item.esItemHoja || !item.activityId) return;
        const eVal = item.ventaEjecutada || 0;
        if (eVal <= 0) return;
        
        let key = '';
        if (donutDim === 'tipo') key = item.tipo || '(Sin Tipo)';
        else if (donutDim === 'scap') key = item.scap || '(Sin SCAP)';
        else if (donutDim === 'cap') key = item.cap || '(Sin CAP)';
        else if (donutDim === 'macro') key = item.macro || '(Sin Macro)';
        else if (donutDim === 'componente') key = item.componente || '(Sin Componente)';
        
        fuente[key] = (fuente[key] || 0) + eVal;
      });
      
      const filas = Object.entries(fuente).map(([nombre, total]) => ({
        nombre,
        total
      })).filter(r => r.total > 0).sort((a, b) => b.total - a.total);
      
      const totalGlobal = filas.reduce((s, r) => s + r.total, 0);
      return { filas, totalGlobal };
    }

    if (donutAcumulado && ultimaSemanaConAvance) {
      const fuente = datosDona.acumEjecSem[donutDim] || {};
      const filas = Object.entries(fuente).map(([nombre, porKey]: any) => {
        let total = 0;
        Object.entries(porKey).forEach(([key, v]: any) => {
          if (key <= ultimaSemanaConAvance) {
            total += v;
          }
        });
        return { nombre, total };
      }).filter(r => r.total > 0).sort((a, b) => b.total - a.total);
      const totalGlobal = filas.reduce((s, r) => s + r.total, 0);
      return { filas, totalGlobal };
    }

    const selectedAnios = donutAnio === 'all' ? [] : donutAnio.split(',');
    const selectedMeses = donutMes === 'all' ? [] : donutMes.split(',').map(m => parseInt(m, 10));
    const selectedSemanas = donutSemana === 'all' ? [] : donutSemana.split(',');

    const usarSemana = selectedSemanas.length > 0;
    const fuente = usarSemana
      ? (datosDona.acumEjecSem[donutDim] || {})
      : (datosDona.acumEjec[donutDim] || {});

    const filas = Object.entries(fuente).map(([nombre, porKey]: any) => {
      let total = 0;
      Object.entries(porKey).forEach(([key, v]: any) => {
        if (usarSemana) {
          if (!selectedSemanas.includes(key)) return;
        } else {
          const [yStr, mStr] = key.split('-');
          const y = parseInt(yStr, 10);
          const m = parseInt(mStr, 10);
          if (selectedAnios.length > 0 && !selectedAnios.includes(yStr)) return;
          if (selectedMeses.length > 0 && !selectedMeses.includes(m)) return;
        }
        total += v;
      });
      return { nombre, total };
    }).filter(r => r.total > 0).sort((a, b) => b.total - a.total);

    const totalGlobal = filas.reduce((s, r) => s + r.total, 0);
    return { filas, totalGlobal };
  }, [datosDona, donutDim, donutAnio, donutMes, donutSemana, donutAcumulado, ultimaSemanaConAvance, donutPG, actividades]);

  const planFuturoAgregado = useMemo(() => {
    if (!datosDona) return null;

    if (donutPG === 'reformulada') {
      const fuente: Record<string, number> = {};
      actividades.forEach(item => {
        if (!item.esItemHoja || !item.activityId) return;
        const pVal = item.ventaPlanPG004 || 0;
        if (pVal <= 0) return;
        
        let key = '';
        if (donutDim === 'tipo') key = item.tipo || '(Sin Tipo)';
        else if (donutDim === 'scap') key = item.scap || '(Sin SCAP)';
        else if (donutDim === 'cap') key = item.cap || '(Sin CAP)';
        else if (donutDim === 'macro') key = item.macro || '(Sin Macro)';
        else if (donutDim === 'componente') key = item.componente || '(Sin Componente)';
        
        fuente[key] = (fuente[key] || 0) + pVal;
      });
      
      const filas = Object.entries(fuente).map(([nombre, total]) => ({
        nombre,
        total
      })).filter(r => r.total > 0).sort((a, b) => b.total - a.total);
      
      const totalGlobal = filas.reduce((s, r) => s + r.total, 0);
      return { filas, totalGlobal };
    }

    if (donutAcumulado && ultimaSemanaConAvance) {
      const fuente = datosDona.acumPlanSem[donutDim] || {};
      const filas = Object.entries(fuente).map(([nombre, porFecha]: any) => {
        let total = 0;
        Object.entries(porFecha).forEach(([key, v]: any) => {
          if (key <= ultimaSemanaConAvance) {
            total += v;
          }
        });
        return { nombre, total };
      }).filter(r => r.total > 0).sort((a, b) => b.total - a.total);
      const totalGlobal = filas.reduce((s, r) => s + r.total, 0);
      return { filas, totalGlobal };
    }

    const selectedAnios = donutAnio === 'all' ? [] : donutAnio.split(',');
    const selectedMeses = donutMes === 'all' ? [] : donutMes.split(',').map(m => parseInt(m, 10));
    const selectedSemanas = donutSemana === 'all' ? [] : donutSemana.split(',');

    const usarSemana = selectedSemanas.length > 0;

    if (usarSemana) {
      const fuente = datosDona.acumPlanSem[donutDim] || {};
      const filas = Object.entries(fuente).map(([nombre, porFecha]: any) => {
        let total = 0;
        selectedSemanas.forEach(sem => {
          total += porFecha[sem] || 0;
        });
        return { nombre, total };
      }).filter(r => r.total > 0).sort((a, b) => b.total - a.total);
      const totalGlobal = filas.reduce((s, r) => s + r.total, 0);
      return { filas, totalGlobal };
    }

    const fuente = datosDona.acumPlan[donutDim] || {};
    const filas = Object.entries(fuente).map(([nombre, porYM]: any) => {
      let total = 0;
      Object.entries(porYM).forEach(([ymKey, v]: any) => {
        const [yStr, mStr] = ymKey.split('-');
        const y = parseInt(yStr, 10);
        const m = parseInt(mStr, 10);
        if (selectedAnios.length > 0 && !selectedAnios.includes(yStr)) return;
        if (selectedMeses.length > 0 && !selectedMeses.includes(m)) return;
        total += v;
      });
      return { nombre, total };
    }).filter(r => r.total > 0).sort((a, b) => b.total - a.total);

    const totalGlobal = filas.reduce((s, r) => s + r.total, 0);
    return { filas, totalGlobal };
  }, [datosDona, donutDim, donutAnio, donutMes, donutSemana, donutAcumulado, ultimaSemanaConAvance, donutPG, actividades]);

  const tablaUnificada = useMemo(() => {
    if (!donaAgregada || !planFuturoAgregado) return null;
    const ejecMap = Object.fromEntries(donaAgregada.filas.map(r => [r.nombre, r.total]));
    const planMap = Object.fromEntries(planFuturoAgregado.filas.map(r => [r.nombre, r.total]));
    const nombres = new Set([...Object.keys(ejecMap), ...Object.keys(planMap)]);
    const filas = Array.from(nombres).map(nombre => {
      const ejecutado = ejecMap[nombre] || 0;
      const plan = planMap[nombre] || 0;
      const pctAvance = plan > 0 ? (ejecutado / plan) * 100 : null;
      return { nombre, plan, ejecutado, pctAvance };
    });
    filas.sort((a, b) => b.plan - a.plan || b.ejecutado - a.ejecutado);
    return filas;
  }, [donaAgregada, planFuturoAgregado]);

  const barrasPlanVsReal = useMemo(() => {
    if (!actividades.length) return null;
    const itemsHoja = actividades.filter(a => a.esItemHoja && a.activityId && /^\d/.test(String(a.activityId).trim()));
    const acum: Record<string, any> = {};
    itemsHoja.forEach(item => {
      const key = donutDim === 'tipo' ? (item.tipo || '(Sin Tipo)')
                : donutDim === 'scap' ? (item.scap || '(Sin SCAP)')
                : donutDim === 'componente' ? (item.componente || '(Sin Componente)')
                : donutDim === 'macro' ? (item.macro || '(Sin Macro)')
                : (item.cap || '(Sin CAP)');
      if (!acum[key]) acum[key] = { nombre: key, plan: 0, ejecutado: 0, items: 0 };
      
      const planItem = obtenerPlanDeActividad(item.activityId, selectedDataPlanificado);
      const planSuma = Object.values(planItem).reduce((s: number, v: any) => s + (v || 0), 0);
      
      acum[key].plan += planSuma;
      acum[key].ejecutado += (item.ventaEjecutada || 0);
      acum[key].items += 1;
    });
    const filas = Object.values(acum)
      .filter((r: any) => r.plan > 0 || r.ejecutado > 0)
      .map((r: any) => ({
        ...r,
        desviacion: r.ejecutado - r.plan,
        avance: r.plan > 0 ? (r.ejecutado / r.plan) * 100 : 0
      }))
      .sort((a: any, b: any) => a.desviacion - b.desviacion);
    const maxValor = Math.max(...filas.map((r: any) => Math.max(r.plan, r.ejecutado)), 1);
    return { filas, maxValor };
  }, [actividades, donutDim, selectedDataPlanificado]);

  const filteredActividades = useMemo(() => {
    let filtered = actividades;

    if (tipologiaSeleccionada) {
      const itemsDeTipologia = actividades.filter(a => a.esItemHoja && a.tipo === tipologiaSeleccionada);
      const partidasConItems = new Set<string>();
      
      itemsDeTipologia.forEach(item => {
        const itemWbs = item.wbs;
        if (itemWbs.startsWith('p') && itemWbs.includes('.')) {
          const parts = itemWbs.split('.');
          const itemPath = parts.slice(1).join('.'); 
          const pathParts = itemPath.split('.');
          for (let i = 1; i <= pathParts.length; i++) {
            const partidaPath = pathParts.slice(0, i).join('.');
            partidasConItems.add('p.' + partidaPath);
          }
        }
      });
      
      filtered = actividades.filter(a => {
        if (a.esItemHoja && a.tipo === tipologiaSeleccionada) return true;
        if (!a.esItemHoja && partidasConItems.has(a.wbs)) return true;
        return false;
      });
      
      return filtered;
    }

    if (filterLevel !== 'all') {
      filtered = filtered.filter(a => {
        if (searchTerm && !a.esItemHoja) {
          const tieneDescendientesEnNivel = actividades.some(desc => 
            desc.nivel === parseInt(filterLevel) &&
            desc.wbs.startsWith(a.wbs + '.') &&
            (desc.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
             desc.wbs.includes(searchTerm) ||
             (desc.activityId && String(desc.activityId).includes(searchTerm)))
          );
          return tieneDescendientesEnNivel;
        }
        return a.nivel === parseInt(filterLevel);
      });
    }
    
    if (filterTipologia !== 'all') {
      filtered = filtered.filter(a => {
        const itemsHijos = actividades.filter(hijo => 
          (hijo.wbs.startsWith(a.wbs + '.') || (hijo.wbs === a.wbs && hijo.esItemHoja)) &&
          hijo.esItemHoja
        );
        if (itemsHijos.length > 0) {
          return itemsHijos.some(hijo => hijo.tipo === filterTipologia);
        }
        if (a.esItemHoja) {
          return a.tipo === filterTipologia;
        }
        return false;
      });
    }

    if (searchTerm) {
      const searchNormalized = normalizeText(searchTerm);
      const itemsEncontrados = filtered.filter(a => 
        normalizeText(a.descripcion).includes(searchNormalized)
      );
      
      const partidasNecesarias = new Set<string>();
      itemsEncontrados.forEach(item => {
        partidasNecesarias.add(item.wbs);
        if (item.esItemHoja) {
          const itemWbs = item.wbs;
          if (itemWbs.startsWith('p') && itemWbs.includes('.')) {
            const parts = itemWbs.split('.');
            const itemPath = parts.slice(1).join('.');
            const pathParts = itemPath.split('.');
            for (let i = 1; i <= pathParts.length; i++) {
              partidasNecesarias.add('p.' + pathParts.slice(0, i).join('.'));
            }
          }
        }
      });
      filtered = filtered.filter(a => partidasNecesarias.has(a.wbs));
    }
    
    if (isRespFilterActive) {
      const itemsConResp = filtered.filter(a => a.esItemHoja && matchesRespFilter(a));
      const partidasNecesarias = new Set<string>();
      itemsConResp.forEach(item => {
        const itemWbs = item.wbs;
        if (itemWbs.startsWith('p') && itemWbs.includes('.')) {
          const parts = itemWbs.split('.');
          const itemPath = parts.slice(1).join('.');
          const pathParts = itemPath.split('.');
          for (let i = 1; i <= pathParts.length; i++) {
            partidasNecesarias.add('p.' + pathParts.slice(0, i).join('.'));
          }
        }
      });
      filtered = filtered.filter(a => {
        if (a.esItemHoja && matchesRespFilter(a)) return true;
        if (!a.esItemHoja && partidasNecesarias.has(a.wbs)) return true;
        return false;
      });
    }

    return filtered;
  }, [actividades, searchTerm, filterLevel, filterTipologia, tipologiaSeleccionada, filterResp]);

  // Auto-expandir partidas cuando hay búsqueda activa
  useEffect(() => {
    if (!actividades || actividades.length === 0 || !filteredActividades) return;
    
    if (searchTerm && searchTerm.trim().length > 0) {
      const partidasAExpandir = new Set<string>();
      filteredActividades.forEach(item => {
        if (item.esItemHoja) {
          const itemWbs = item.wbs;
          if (itemWbs && itemWbs.startsWith('p') && itemWbs.includes('.')) {
            const parts = itemWbs.split('.');
            const itemPath = parts.slice(1).join('.');
            const pathParts = itemPath.split('.');
            
            for (let i = 1; i <= pathParts.length; i++) {
              const partidaWbs = 'p.' + pathParts.slice(0, i).join('.');
              const partida = actividades.find(a => a.wbs === partidaWbs);
              if (partida && partida.id) {
                partidasAExpandir.add(partida.id);
              }
            }
          }
        }
      });
      if (partidasAExpandir.size > 0) {
        setExpandedItems(partidasAExpandir);
      }
    } else if (!tipologiaSeleccionada && expandedItems.size > 0) {
      setExpandedItems(new Set());
    }
  }, [searchTerm, actividades, tipologiaSeleccionada, filteredActividades]);

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const getFallbackCheckMapping = (code: string): string => {
    const trimmed = code.trim();
    if (trimmed === "12.8.1") return "13.1";
    return code;
  };

  const processFileArrayBuffer = async (arrayBuffer: any, fileName: string, sizeMB?: string) => {
    if (isUploadingRef.current) {
      alert('Ya hay una carga en curso. Por favor, espere a que finalice.');
      return;
    }
    isUploadingRef.current = true;

    let localHojas: any[] = [];
    let localPartidas: any[] = [];
    let localTotales: any = null;
    let localEnmiendas: any[] = [];
    let localTipRes: any[] = [];
    let localCDOvsS: any = { F: {}, H: {} };
    let localPlanillaInfo: any = null;
    let p6FechaCorte: Date | null = null;
    let localDataPlanificado: Record<string, any> = {};
    let localDataPlanificadoPG004: Record<string, any> = {};

    try {
      await updateProgress(10, 'Parseando workbook Excel...');
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });

      // Read Check/check tab mapping if present
      const checkSheetMapping = new Map<string, string>();
      try {
        const checkSheetName = workbook.SheetNames.find(name => name.toLowerCase() === 'check');
        if (checkSheetName) {
          const checkSheet = workbook.Sheets[checkSheetName];
          const checkData: any[][] = XLSX.utils.sheet_to_json(checkSheet, { header: 1, defval: null });
          for (let i = 1; i < checkData.length; i++) {
            const row = checkData[i];
            if (!row) continue;
            const pUnik = row[0] ? String(row[0]).trim() : '';
            const partida = row[1] ? String(row[1]).trim() : '';
            if (pUnik && partida) {
              checkSheetMapping.set(pUnik.trim().toLowerCase(), partida.trim());
            }
          }
          console.log(`Cargado mapeo dinámico de pestaña Check: ${checkSheetMapping.size} items.`);
        }
      } catch (eCheck) {
        console.warn('Error al leer pestaña Check del workbook:', eCheck);
      }

      const translateCdoToPlanilla = (cdoCode: string): string => {
        const cleanCode = cdoCode.trim();
        const lowerCode = cleanCode.toLowerCase();
        if (checkSheetMapping.has(lowerCode)) {
          return checkSheetMapping.get(lowerCode)!;
        }
        return getFallbackCheckMapping(cleanCode);
      };

      // Get cut-off date from 'p6' or 'P6' tab, cell K1
      try {
        const p6SheetName = workbook.SheetNames.find(name => name.toLowerCase() === 'p6');
        if (p6SheetName) {
          const p6Sheet = workbook.Sheets[p6SheetName];
          const cellK1 = p6Sheet['K1'] || p6Sheet['k1'];
          if (cellK1) {
            const rawValue = cellK1.v;
            const formattedValue = cellK1.w;
            const parsedDate = parseFlexibleDate(rawValue, formattedValue);

            if (parsedDate && !isNaN(parsedDate.getTime())) {
              p6FechaCorte = parsedDate;
              console.log('Fecha de corte cargada desde p6(K1):', p6FechaCorte);
            }
          }
        }
      } catch (err) {
        console.warn('Error reading K1 from sheet p6:', err);
      }

        await updateProgress(20, 'Buscando hoja CDO...');
        setFilterResp(new Set(['all']));
        setFilterTipologia('all');
        setFilterLevel('all');
        setTipologiaSeleccionada(null);
        setSearchTerm('');

        const sheetName = workbook.SheetNames.find(name => name.toLowerCase() === 'cdo');
        if (!sheetName) {
          alert('No se encontró la hoja "CDO" en el archivo');
          setLoadingProgress(0);
          setLoadingPhase('');
          return;
        }

        await updateProgress(28, 'Leyendo hoja CDO...');
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

        await updateProgress(35, 'Mapeando columnas de certificación...');
        const headers = jsonData[1] || [];
        const fechasPorColumnaCDO: Record<number, string> = {};
        const mapaColumnasMesLocal: Record<string, number[]> = {};
        const nombresMesEspanol = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

        const row1 = jsonData[0] || [];

        const maxCols = Math.max(
          headers.length,
          row1.length,
          ...jsonData.slice(0, 10).map(r => (r ? r.length : 0))
        );

        // Check if there are explicit V- / Venta headers in the time-phased section (col >= 48)
        let hasExplicitVHeaders = false;
        for (let col = 48; col < maxCols; col++) {
          const hStr = String(headers[col] || '').trim().toUpperCase();
          const r1Str = String(row1[col] || '').trim().toUpperCase();
          if (hStr.startsWith('V-') || hStr.startsWith('V_') || hStr === 'V' || hStr.includes('VENTA') ||
              r1Str.startsWith('V-') || r1Str.startsWith('V_') || r1Str === 'V' || r1Str.includes('VENTA')) {
            hasExplicitVHeaders = true;
            break;
          }
        }

        let lastDateFromRow0: Date | null = null;

        // Time-phased weekly execution columns in CDO start after fixed metadata columns (col >= 48)
        for (let col = 48; col < maxCols; col++) {
          const header = headers[col];
          const headerStr = header ? String(header).trim() : '';
          const r1Value = row1[col];
          const r1Str = r1Value ? String(r1Value).trim().toLowerCase() : '';
          const upperHeader = headerStr.toUpperCase();
          const upperR1 = r1Str.toUpperCase();

          // Skip total or summary columns if explicit
          if (r1Str.includes('total general') || headerStr.toLowerCase().includes('total general')) continue;

          // Skip non-Venta columns if explicit markers exist (e.g. Cost, Quantity, Plan)
          const isNonVenta = upperHeader.startsWith('C-') || upperHeader.startsWith('Q-') || upperHeader.startsWith('P-') ||
                             upperHeader.includes('CANT') || upperHeader.includes('COSTO') || upperHeader.includes('PRECIO') ||
                             upperR1.startsWith('C-') || upperR1.startsWith('Q-') || upperR1.startsWith('P-') ||
                             upperR1.includes('CANT') || upperR1.includes('COSTO') || upperR1.includes('PRECIO');
          if (isNonVenta) continue;

          if (hasExplicitVHeaders) {
            const isVHeader = upperHeader.startsWith('V-') || upperHeader.startsWith('V_') || upperHeader === 'V' || upperHeader.includes('VENTA') ||
                              upperR1.startsWith('V-') || upperR1.startsWith('V_') || upperR1 === 'V' || upperR1.includes('VENTA');
            if (!isVHeader) continue;
          }

          if (r1Value) {
            const d = parseFlexibleDate(r1Value);
            if (d && !isNaN(d.getTime())) {
              lastDateFromRow0 = d;
            }
          }

          try {
            let parsedDate: Date | null = parseFlexibleDate(headerStr);
            
            // If row 1 header didn't yield a date, try row 0 or last seen date from row 0 (for merged headers)
            if (!parsedDate && r1Value) {
              parsedDate = parseFlexibleDate(r1Value);
            }
            if (!parsedDate && lastDateFromRow0) {
              parsedDate = lastDateFromRow0;
            }

            if (parsedDate && !isNaN(parsedDate.getTime())) {
              const yyyy = parsedDate.getFullYear();
              const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
              const dd = String(parsedDate.getDate()).padStart(2, '0');
              const fechaKey = `${yyyy}-${mm}-${dd}`;
              fechasPorColumnaCDO[col] = fechaKey;
              const nombreMes = nombresMesEspanol[parsedDate.getMonth()];
              const claveMes = `${yyyy}-${nombreMes}`;
              if (!mapaColumnasMesLocal[claveMes]) mapaColumnasMesLocal[claveMes] = [];
              mapaColumnasMesLocal[claveMes].push(col);
            }
          } catch (e) {
            console.warn('Error parseando header CDO:', header, e);
          }
        }

        setMapaColumnasMes(mapaColumnasMesLocal);
        const actividadesProcesadas: Actividad[] = [];
        const totalFilas = jsonData.length - 2;
        await updateProgress(40, `Procesando ${totalFilas.toLocaleString()} filas de CDO...`);
        const intervaloUpdate = Math.max(1, Math.floor(totalFilas / 10));

        const excelDateToJSDate = (excelDate: any) => {
          if (!excelDate) return null;
          if (excelDate instanceof Date) {
            if (isNaN(excelDate.getTime())) return null;
            const year = excelDate.getUTCFullYear();
            const month = excelDate.getUTCMonth();
            const date = excelDate.getUTCDate();
            return new Date(year, month, date);
          }
          if (typeof excelDate === 'number') {
            const utc_days = excelDate - 25569;
            const d_utc = new Date(utc_days * 86400 * 1000);
            if (!isNaN(d_utc.getTime())) {
              const year = d_utc.getUTCFullYear();
              const month = d_utc.getUTCMonth();
              const date = d_utc.getUTCDate();
              return new Date(year, month, date);
            }
            return null;
          }
          if (typeof excelDate === 'string') {
            const valClean = excelDate.trim();
            if (!valClean) return null;

            let standardDate = new Date(valClean);
            if (!isNaN(standardDate.getTime())) {
              if (!valClean.includes(':') && !valClean.includes('t') && !valClean.toLowerCase().includes('z')) {
                const year = standardDate.getUTCFullYear();
                const month = standardDate.getUTCMonth();
                const date = standardDate.getUTCDate();
                return new Date(year, month, date);
              }
              return standardDate;
            }

            const mesesEspanol: Record<string, number> = {
              'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
              'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11,
              'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
              'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
            };

            try {
              const normalized = valClean.toLowerCase().replace(/[\/\s\._-]+/g, '-');
              const partes = normalized.split('-');
              if (partes.length >= 3) {
                let dia = parseInt(partes[0], 10);
                let mesStr = partes[1];
                let anioStr = partes[2];

                if (isNaN(dia)) {
                  const mesIdx = mesesEspanol[partes[0]];
                  if (mesIdx !== undefined) {
                    let d = parseInt(partes[1], 10);
                    let a = parseInt(partes[2], 10);
                    if (a < 100) a += a < 50 ? 2000 : 1900;
                    if (!isNaN(d) && !isNaN(a)) {
                      const computedDate = new Date(a, mesIdx, d);
                      if (!isNaN(computedDate.getTime())) return computedDate;
                    }
                  }
                } else {
                  const mesIdx = mesesEspanol[mesStr];
                  if (mesIdx !== undefined) {
                    let a = parseInt(anioStr, 10);
                    if (a < 100) a += a < 50 ? 2000 : 1900;
                    if (!isNaN(dia) && !isNaN(a)) {
                      const computedDate = new Date(a, mesIdx, dia);
                      if (!isNaN(computedDate.getTime())) return computedDate;
                    }
                  }
                }
              }
            } catch (err) {
              console.warn("Error parsing string as date:", valClean, err);
            }
          }
          return null;
        };

        const helperParseNum = (val: any): number => {
          if (typeof val === 'number') return isNaN(val) ? 0 : val;
          if (!val) return 0;
          const cleaned = String(val).replace(/[$,]/g, '').trim();
          const parsed = parseFloat(cleaned);
          return isNaN(parsed) ? 0 : parsed;
        };

        const sumAVByColA = new Map<string, number>();
        const sumASByColA = new Map<string, number>();
        const sumColIByColA = new Map<string, number>();
        const p6ExecutionByWbsColA = new Map<string, Record<string, number>>();

        for (let j = 2; j < jsonData.length; j++) {
          const r = jsonData[j];
          if (!r) continue;
          
          const colA = String(r[0] || '').trim().toLowerCase();
          const colC = String(r[2] || '').trim().toLowerCase();
          const codePart = colA.includes('  ') ? colA.split('  ')[0].trim() : colA;

          const isP6Row = colA.includes('p6') || colC.includes('p6');
          if (isP6Row) {
            const keysToRegister = new Set<string>();
            if (colA) {
              keysToRegister.add(colA);
              keysToRegister.add(colA.replace(/\.p6$/i, ''));
            }
            if (codePart && codePart !== colA) {
              keysToRegister.add(codePart);
              keysToRegister.add(codePart.replace(/\.p6$/i, ''));
            }
            if (colC) {
              keysToRegister.add(colC);
              keysToRegister.add(colC.replace(/\.p6$/i, ''));
            }

            const rowWeekly: Record<string, number> = {};
            let weeklySum = 0;
            Object.entries(fechasPorColumnaCDO).forEach(([colStr, fechaKey]) => {
              const col = parseInt(colStr);
              let valorRaw = r[col];
              let valor = 0;
              if (typeof valorRaw === 'number') valor = valorRaw;
              else if (typeof valorRaw === 'string') valor = parseFloat(valorRaw.replace(/[$,]/g, '')) || 0;
              if (valor > 0) {
                rowWeekly[fechaKey] = valor;
                weeklySum += valor;
              }
            });

            keysToRegister.forEach(k => {
              let recordMap = p6ExecutionByWbsColA.get(k);
              if (!recordMap) {
                recordMap = {};
                p6ExecutionByWbsColA.set(k, recordMap);
              }
              Object.entries(rowWeekly).forEach(([fechaKey, valor]) => {
                recordMap![fechaKey] = (recordMap![fechaKey] || 0) + valor;
              });
            });

            const valAV_col = helperParseNum(r[47]);
            const valAV = valAV_col > 0 ? valAV_col : weeklySum;
            const valAS = helperParseNum(r[44]);
            const valColI = helperParseNum(r[8]);

            keysToRegister.forEach(k => {
              sumAVByColA.set(k, (sumAVByColA.get(k) || 0) + valAV);
              sumASByColA.set(k, (sumASByColA.get(k) || 0) + valAS);
              sumColIByColA.set(k, (sumColIByColA.get(k) || 0) + valColI);
            });
          }
        }

        for (let i = 2; i < jsonData.length; i++) {
          if ((i - 2) % intervaloUpdate === 0 && i > 2) {
            const pctLoop = ((i - 2) / totalFilas) * 30; 
            await updateProgress(40 + pctLoop, `Procesando filas CDO... ${(i - 2).toLocaleString()}/${totalFilas.toLocaleString()}`);
          }
          const row = jsonData[i];
          if (!row) continue;
          const wbs = row[0];
          if (!wbs) continue;
          const wbsStr = String(wbs).trim();
          if (wbsStr.toLowerCase().includes('p6')) {
            continue;
          }

          const idOrig = row[1];
          const activityId = row[2];
          const activityName = row[3];
          const unidad = row[4];
          const rawCant = row[5];
          let cantidadCdoVal: number | null = null;
          if (rawCant !== null && rawCant !== undefined) {
            if (typeof rawCant === 'number') {
              cantidadCdoVal = rawCant;
            } else {
              const cleaned = String(rawCant).replace(/[$,]/g, '').trim();
              if (cleaned !== '') {
                const parsed = parseFloat(cleaned);
                if (!isNaN(parsed)) {
                  cantidadCdoVal = parsed;
                }
              }
            }
          }
          const rawPrecio = row[6];
          let precioVal: number | null = null;
          if (rawPrecio !== null && rawPrecio !== undefined) {
            if (typeof rawPrecio === 'number') {
              precioVal = rawPrecio;
            } else {
              const cleaned = String(rawPrecio).replace(/[$,]/g, '').trim();
              if (cleaned !== '') {
                const parsed = parseFloat(cleaned);
                if (!isNaN(parsed)) {
                  precioVal = parsed;
                }
              }
            }
          }

          const parseNum = (val: any): number => {
            if (typeof val === 'number') return isNaN(val) ? 0 : val;
            if (!val) return 0;
            const cleaned = String(val).replace(/[$,]/g, '').trim();
            const parsed = parseFloat(cleaned);
            return isNaN(parsed) ? 0 : parsed;
          };

          const venta = parseNum(row[8]);
          const ventaM = parseNum(row[12]);
          const ventaPlan = parseNum(row[44]);
          const ventaEx = parseNum(row[47]);
          const balance = parseNum(row[43]);
          const macro = row[28];
          const grupo = row[29];
          const partidas = row[32];
          const tipo = row[33];
          const subcontratista = row[13];
          const ubicacion = row[30];
          const proceso = row[31];
          const cap = row[34];
          const scap = row[35];
          const unit = row[36];
          const componente = row[39];
          const resp = row[40];
          const status = row[22];

          let wbsCode: string, wbsDescripcion: string | null;
          if (wbsStr.includes('  ')) {
            const parts = wbsStr.split('  ');
            wbsCode = parts[0].trim();
            wbsDescripcion = parts.slice(1).join('  ').trim();
          } else {
            wbsCode = wbsStr;
            wbsDescripcion = null;
          }

          const certificacionesPorFecha: Record<string, number> = {};
          
          const actIdCleanForP6 = String(activityId || '').trim().toLowerCase();
          const wbsCleanForP6 = String(wbsCode || '').trim().toLowerCase();
          const rawWbsCleanForP6 = String(wbs || '').trim().toLowerCase();

          // Criterios simultáneos para avance semanal ejecutado (Columnas V-):
          // Criterio 1: Si el Activity ID (Col C) o WBS contiene "p6", realizar sumar.si por WBS (Col A) en las semanas con "V-"
          // Criterio 2: Si el Activity ID (Col C) NO contiene "p6", tomar el valor directamente de la propia fila en las semanas con "V-"
          const isP6Activity = actIdCleanForP6.includes('p6') || wbsCleanForP6.includes('p6') || rawWbsCleanForP6.includes('p6');

          if (isP6Activity) {
            let p6Exec: Record<string, number> | null = null;
            if (actIdCleanForP6 && p6ExecutionByWbsColA.has(actIdCleanForP6)) {
              p6Exec = p6ExecutionByWbsColA.get(actIdCleanForP6)!;
            } else if (wbsCleanForP6 && p6ExecutionByWbsColA.has(wbsCleanForP6)) {
              p6Exec = p6ExecutionByWbsColA.get(wbsCleanForP6)!;
            } else if (rawWbsCleanForP6 && p6ExecutionByWbsColA.has(rawWbsCleanForP6)) {
              p6Exec = p6ExecutionByWbsColA.get(rawWbsCleanForP6)!;
            } else {
              const actIdWithoutP6 = actIdCleanForP6.replace(/\.p6$/i, '');
              const wbsWithoutP6 = wbsCleanForP6.replace(/\.p6$/i, '');
              if (actIdWithoutP6 && p6ExecutionByWbsColA.has(actIdWithoutP6)) {
                p6Exec = p6ExecutionByWbsColA.get(actIdWithoutP6)!;
              } else if (wbsWithoutP6 && p6ExecutionByWbsColA.has(wbsWithoutP6)) {
                p6Exec = p6ExecutionByWbsColA.get(wbsWithoutP6)!;
              }
            }

            if (p6Exec) {
              Object.entries(p6Exec).forEach(([fechaKey, valor]) => {
                if (valor > 0) certificacionesPorFecha[fechaKey] = valor;
              });
            }
          } else {
            // Actividad NO P6: leer directamente de las columnas V- de la propia fila
            Object.entries(fechasPorColumnaCDO).forEach(([colStr, fechaKey]) => {
              const col = parseInt(colStr);
              let valorRaw = row[col];
              let valor = 0;
              if (typeof valorRaw === 'number') valor = valorRaw;
              else if (typeof valorRaw === 'string') valor = parseFloat(valorRaw.replace(/[$,]/g, '')) || 0;
              if (valor > 0) certificacionesPorFecha[fechaKey] = valor;
            });
          }

          const certificaciones: Record<number, number> = {};
          for (let col = 356; col <= 455; col++) {
            const val = Number(row[col]) || 0;
            if (val > 0) {
              certificaciones[col] = val;
            }
          }

          const blStart = row[23];
          const blFinish = row[24];
          const start = row[25];
          const finish = row[26];

          const blStartDate  = excelDateToJSDate(blStart);
          const blFinishDate = excelDateToJSDate(blFinish);
          const startDate    = excelDateToJSDate(start);
          const finishDate   = excelDateToJSDate(finish);

          const today = new Date();
          today.setHours(23, 59, 59, 999);

          const isCompleted = status === 'Completed' || (typeof row[14] === 'number' && row[14] >= 1);
          const isStarted = status === 'In Progress' || status === 'Completed' || (typeof row[14] === 'number' && row[14] > 0);

          const targetStart = (blStartDate && !isNaN(blStartDate.getTime())) ? blStartDate : (startDate && !isNaN(startDate.getTime()) ? startDate : null);
          const targetFinish = (blFinishDate && !isNaN(blFinishDate.getTime())) ? blFinishDate : (finishDate && !isNaN(finishDate.getTime()) ? finishDate : null);

          // Debía haber iniciado hasta hoy y no ha iniciado
          const debiaHaberIniciado = !!(targetStart && targetStart <= today);
          const atrasadoInicio = debiaHaberIniciado && !isStarted;

          // Debía haber terminado hasta hoy y no ha terminado
          const debiaHaberTerminado = !!(targetFinish && targetFinish <= today);
          const atrasadoFin = debiaHaberTerminado && !isCompleted;

          const estaAtrasadoCronograma = atrasadoInicio || atrasadoFin;

          let diasAtrasoInicio = 0;
          if (atrasadoInicio && targetStart) {
            diasAtrasoInicio = Math.max(0, Math.round((today.getTime() - targetStart.getTime()) / 86400000));
          } else if (startDate && !isNaN(startDate.getTime()) && blStartDate && !isNaN(blStartDate.getTime()) && startDate > blStartDate) {
            diasAtrasoInicio = Math.max(0, Math.round((startDate.getTime() - blStartDate.getTime()) / 86400000));
          }

          let diasAtrasoFin = 0;
          if (atrasadoFin && targetFinish) {
            diasAtrasoFin = Math.max(0, Math.round((today.getTime() - targetFinish.getTime()) / 86400000));
          } else if (finishDate && !isNaN(finishDate.getTime()) && blFinishDate && !isNaN(blFinishDate.getTime()) && finishDate > blFinishDate) {
            diasAtrasoFin = Math.max(0, Math.round((finishDate.getTime() - blFinishDate.getTime()) / 86400000));
          }

          const diasAtrasoMaximo = estaAtrasadoCronograma ? Math.max(diasAtrasoInicio, diasAtrasoFin) : 0;
          
          const nivel = wbsCode.split('.').length;
          const esItemHoja = !!activityId;
          const totalFloatVal = typeof row[27] === 'number' ? row[27] : null;

          let avanceATVal: number | null = null;
          const rawAt = row[45];
          if (rawAt !== null && rawAt !== undefined && rawAt !== '') {
            if (typeof rawAt === 'number') {
              if (rawAt > 0 && rawAt <= 1.0) {
                avanceATVal = Math.round(rawAt * 100);
              } else {
                avanceATVal = Math.round(rawAt);
              }
            } else if (typeof rawAt === 'string') {
              const cleanStr = rawAt.replace(/%/g, '').trim();
              const parsed = parseFloat(cleanStr);
              if (!isNaN(parsed)) {
                if (rawAt.includes('%')) {
                  avanceATVal = Math.round(parsed);
                } else if (parsed > 0 && parsed <= 1.0) {
                  avanceATVal = Math.round(parsed * 100);
                } else {
                  avanceATVal = Math.round(parsed);
                }
              }
            }
          }


          let finalVenta = venta;
          let finalVentaEx = ventaEx;
          let finalVentaPlan = ventaPlan;

          if (esItemHoja && isP6Activity) {
            const possibleKeys = [
              actIdCleanForP6,
              actIdCleanForP6.replace(/\.p6$/i, ''),
              wbsCleanForP6,
              wbsCleanForP6.replace(/\.p6$/i, ''),
              rawWbsCleanForP6,
              rawWbsCleanForP6.replace(/\.p6$/i, '')
            ].filter(Boolean);

            for (const k of possibleKeys) {
              if (sumASByColA.has(k) && sumASByColA.get(k)! > 0) {
                finalVentaPlan = sumASByColA.get(k)!;
                break;
              }
            }

            for (const k of possibleKeys) {
              if (sumAVByColA.has(k) && sumAVByColA.get(k)! > 0) {
                finalVentaEx = sumAVByColA.get(k)!;
                break;
              }
            }

            for (const k of possibleKeys) {
              if (sumColIByColA.has(k) && sumColIByColA.get(k)! > 0) {
                finalVenta = sumColIByColA.get(k)!;
                break;
              }
            }

            // Si hay avance registrado por semanas y finalVentaEx es 0 o menor que la suma de semanas, asegurar coherencia con las semanas
            const sumWeeklyCerts = Object.values(certificacionesPorFecha).reduce((s, v) => s + v, 0);
            if (sumWeeklyCerts > 0 && (finalVentaEx === 0 || finalVentaEx < sumWeeklyCerts)) {
              finalVentaEx = sumWeeklyCerts;
            }
          }

          const descripcionFinal = esItemHoja 
            ? (activityName || wbsCode)
            : (wbsDescripcion || activityName || wbsCode);

          actividadesProcesadas.push({
            id: `row_${i}`,
            wbs: wbsCode,
            wbsRaw: wbsStr,
            activityId: activityId ? String(activityId) : null,
            descripcion: String(descripcionFinal),
            unidad: unidad ? String(unidad) : '',
            nivel,
            esItemHoja,
            venta: Number(finalVenta) || 0,
            ventaM: Number(ventaM) || 0,
            ventaPlan: Number(finalVentaPlan) || 0,
            ventaPlanPG004: Number(finalVenta) || 0,
            ventaEjecutada: Number(finalVentaEx) || 0,
            balance,
            saldo: (Number(finalVenta) || 0) - (Number(finalVentaEx) || 0),
            excedente: (finalVentaEx && Number(finalVentaEx) > 0) ? (Number(finalVentaEx) - (Number(ventaM) || 0)) : 0,
            partidas: partidas ? String(partidas) : '',
            tipo: tipo ? String(tipo) : 'Otros',
            subcontratista: subcontratista ? String(subcontratista) : '',
            ubicacion: ubicacion ? String(ubicacion) : '',
            proceso: proceso ? String(proceso) : '',
            cap: cap ? String(cap) : '',
            scap: scap ? String(scap) : '',
            macro: macro ? String(macro).trim() : '',
            componente: componente ? String(componente).trim() : '',
            unit: unit ? String(unit) : '',
            resp: resp ? String(resp) : '',
            grupo: grupo ? String(grupo).trim() : '',
            status: status ? String(status) : '',
            ventaFebrero: 0, 
            certificaciones,
            certificacionesPorFecha,
            blStart: blStartDate,
            blFinish: blFinishDate,
            start: startDate,
            finish: finishDate,
            diasAtrasoInicio,
            diasAtrasoFin,
            diasAtrasoMaximo,
            estaAtrasadoCronograma,
            totalFloat: totalFloatVal,
            p6Status: row[22] ? String(row[22]).trim() : '',
            avanceAT: avanceATVal,
            idOrig: idOrig ? String(idOrig).trim() : null,
            cantidadCdo: cantidadCdoVal,
            precio: precioVal
          });
        }

        // Resolve indirect WBS for leaf activities that point to an activity ID instead of a WBS path.
        // For example, if a leaf activity has WBS "12.6.2.39.p6", and another activity has activityId "12.6.2.39.p6",
        // then they are siblings and we can map the leaf activity's WBS to match the other activity's WBS.
        const activityIdToWbs = new Map<string, string>();
        actividadesProcesadas.forEach(a => {
          if (a.activityId) {
            activityIdToWbs.set(a.activityId.trim(), a.wbs);
          }
        });

        actividadesProcesadas.forEach(a => {
          if (a.esItemHoja && a.wbs) {
            let visited = new Set<string>();
            let currentWbs = a.wbs.trim();
            while (activityIdToWbs.has(currentWbs) && !visited.has(currentWbs)) {
              visited.add(currentWbs);
              const nextWbs = activityIdToWbs.get(currentWbs)!;
              if (nextWbs === currentWbs) break;
              currentWbs = nextWbs;
            }
            if (currentWbs !== a.wbs) {
              a.wbs = currentWbs;
              a.nivel = currentWbs.split('.').length;
            }
          }
        });

        setActividades(actividadesProcesadas);
        setFileData({ fileName: fileName, rowCount: actividadesProcesadas.length });

        try {
          let ultimaFechaConAvance: string | null = null;
          actividadesProcesadas.forEach(item => {
            if (item.certificacionesPorFecha) {
              Object.entries(item.certificacionesPorFecha).forEach(([fechaKey, valor]) => {
                if (valor > 0) {
                  if (!ultimaFechaConAvance || fechaKey > ultimaFechaConAvance) {
                    ultimaFechaConAvance = fechaKey;
                  }
                }
              });
            }
          });
          if (p6FechaCorte) {
            const anioStr = p6FechaCorte.getFullYear().toString();
            const nombresMes = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
            const nombreMes = nombresMes[p6FechaCorte.getMonth()];
            setPeriodoSeleccionado({ anio: anioStr, mes: nombreMes, semanas: [] });
            setFechaCorteState(p6FechaCorte);
          } else if (ultimaFechaConAvance) {
            const [anioStr, mesNumStr] = (ultimaFechaConAvance as string).split('-');
            const mesIdx = parseInt(mesNumStr, 10) - 1;
            const nombresMes = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
            const nombreMes = nombresMes[mesIdx];
            setPeriodoSeleccionado({ anio: anioStr, mes: nombreMes, semanas: [] });
            setFechaCorteState(new Date(ultimaFechaConAvance));
          }
        } catch (e) {
          console.warn('No se pudo detectar el último mes con avance:', e);
        }

        await updateProgress(72, 'CDO procesado. Cargando hoja pg-003...');
        
        try {
          const sheetPG003 = workbook.SheetNames.find(name => name.toLowerCase() === 'pg-003');
          if (sheetPG003) {
            const worksheetPG003 = workbook.Sheets[sheetPG003];
            const jsonDataPG003: any[][] = XLSX.utils.sheet_to_json(worksheetPG003, { header: 1, defval: null, raw: true });
            const headersPG003 = jsonDataPG003[0] || [];
            const planificadoPorActivity: Record<string, any> = {};
            
            for (let i = 1; i < jsonDataPG003.length; i++) {
              const row = jsonDataPG003[i];
              if (!row) continue;
              const activityId = row[0];
              if (!activityId) continue;
              const activityIdStr = activityId.toString().trim();
              if (!activityIdStr || activityIdStr.toLowerCase() === 'activity id' || activityIdStr.toLowerCase() === 'id') continue;
              const ventasPorFecha: Record<string, number> = {};
              
              for (let col = 8; col < row.length; col++) {
                const valor = parseFloat(row[col]) || 0;
                if (valor === 0) continue;
                const headerFecha = headersPG003[col];
                if (!headerFecha) continue;
                
                try {
                  const fecha = parseFlexibleDate(headerFecha);
                  
                  if (fecha && !isNaN(fecha.getTime())) {
                    const yyyy = fecha.getFullYear();
                    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
                    const dd = String(fecha.getDate()).padStart(2, '0');
                    const fechaKey = `${yyyy}-${mm}-${dd}`;
                    ventasPorFecha[fechaKey] = valor;
                  }
                } catch (e) {
                  console.warn('Error parseando fecha PG003:', headerFecha, e);
                }
              }
              
              if (Object.keys(ventasPorFecha).length > 0) {
                if (!planificadoPorActivity[activityIdStr]) {
                  planificadoPorActivity[activityIdStr] = {};
                }
                Object.entries(ventasPorFecha).forEach(([fKey, fVal]) => {
                  planificadoPorActivity[activityIdStr][fKey] = (planificadoPorActivity[activityIdStr][fKey] || 0) + fVal;
                });
                
                // Keep inside the activity itself so it saves/syncs properly via Firestore & backup
                const actIdUpper = activityIdStr.toUpperCase();
                const matchedAct = actividadesProcesadas.find(
                  a => a.activityId && (a.activityId.toString().trim().toUpperCase() === actIdUpper)
                );
                if (matchedAct) {
                  matchedAct.planificadoPorFecha = planificadoPorActivity[activityIdStr];
                }
              }
            }
            
            setDataPlanificado(planificadoPorActivity);
            localDataPlanificado = planificadoPorActivity;
            await updateProgress(84, 'Planificado PG-003 procesado. Buscando hoja pg-004...');
          }
        } catch (error) {
          console.error('Error procesando pg-003:', error);
        }

        try {
          const sheetPG004 = workbook.SheetNames.find(name => name.toLowerCase() === 'pg-004');
          if (sheetPG004) {
            await updateProgress(85, 'Cargando hoja pg-004...');
            const worksheetPG004 = workbook.Sheets[sheetPG004];
            const jsonDataPG004: any[][] = XLSX.utils.sheet_to_json(worksheetPG004, { header: 1, defval: null, raw: true });
            const headersPG004 = jsonDataPG004[0] || [];
            const planificadoPorActivityPG004: Record<string, any> = {};
            
            // Check if sheet PG-004 is a simple two-column format (or has no date headers from column 8 / Col I onwards)
            const isTwoColumnPG004 = (() => {
              if (headersPG004.length < 8) return true;
              for (let col = 8; col < headersPG004.length; col++) {
                const h = headersPG004[col];
                if (h && (typeof h === 'number' || parseFlexibleDate(h) !== null)) {
                  return false;
                }
              }
              return true;
            })();

            for (let i = 1; i < jsonDataPG004.length; i++) {
              const row = jsonDataPG004[i];
              if (!row) continue;
              const activityId = row[0];
              if (!activityId) continue;
              const activityIdStr = activityId.toString().trim();
              if (!activityIdStr || activityIdStr.toLowerCase() === 'activity id' || activityIdStr.toLowerCase() === 'id') continue;
              
              const ventasPorFechaPG004: Record<string, number> = {};

              if (isTwoColumnPG004) {
                // Two-column format: find the first numeric cell from column 1 onwards
                let valor = 0;
                for (let col = 1; col < row.length; col++) {
                  const cellStr = String(row[col] || '').replace(/[$,]/g, '').trim();
                  if (cellStr === '') continue;
                  const cellVal = parseFloat(cellStr);
                  if (!isNaN(cellVal) && cellVal > 0) {
                    valor = cellVal;
                    break;
                  }
                }
                if (valor > 0) {
                  ventasPorFechaPG004["total"] = valor;
                }
              } else {
                // Multi-column date format starting from Column I (index 8)
                for (let col = 8; col < row.length; col++) {
                  const valor = parseFloat(row[col]) || 0;
                  if (valor === 0) continue;
                  const headerFecha = headersPG004[col];
                  if (!headerFecha) continue;
                  
                  try {
                    const fecha = parseFlexibleDate(headerFecha);
                    
                    if (fecha && !isNaN(fecha.getTime())) {
                      const yyyy = fecha.getFullYear();
                      const mm = String(fecha.getMonth() + 1).padStart(2, '0');
                      const dd = String(fecha.getDate()).padStart(2, '0');
                      const fechaKey = `${yyyy}-${mm}-${dd}`;
                      ventasPorFechaPG004[fechaKey] = valor;
                    }
                  } catch (e) {
                    console.warn('Error parseando fecha PG004:', headerFecha, e);
                  }
                }
              }
              
              if (Object.keys(ventasPorFechaPG004).length > 0) {
                if (!planificadoPorActivityPG004[activityIdStr]) {
                  planificadoPorActivityPG004[activityIdStr] = {};
                }
                Object.entries(ventasPorFechaPG004).forEach(([fKey, fVal]) => {
                  planificadoPorActivityPG004[activityIdStr][fKey] = (planificadoPorActivityPG004[activityIdStr][fKey] || 0) + fVal;
                });
                
                const actIdUpper = activityIdStr.toUpperCase();
                const matchedAct = actividadesProcesadas.find(
                  a => a.activityId && (a.activityId.toString().trim().toUpperCase() === actIdUpper)
                );
                if (matchedAct) {
                  matchedAct.planificadoPorFechaPG004 = planificadoPorActivityPG004[activityIdStr];
                }
              }
            }
            
            setDataPlanificadoPG004(planificadoPorActivityPG004);
            localDataPlanificadoPG004 = planificadoPorActivityPG004;
            await updateProgress(90, 'Planificado PG-004 procesado.');
          }
        } catch (error) {
          console.error('Error procesando pg-004:', error);
        }
        
        // Re-calculate aggregations of dates
        await updateProgress(92, 'Agregando fechas por jerarquías WBS y PROCESO/CAP/SCAP/UNIT...');
        rebuildAggregatedDates(actividadesProcesadas);

        setExpandedItems(new Set());

        // Parsear "Sabana global" si existe
        const sabanaSheet = workbook.SheetNames.find(n => n.toLowerCase().includes('sabana'));
        if (sabanaSheet) {
          await updateProgress(95, 'Cargando hoja Planilla (Sabana)...');
          try {
            const rawSabana: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[sabanaSheet], { header: 1, defval: null, raw: true });
            const cdoLookup = new Map();
            const cdoLookupF = new Map();
            for (let i = 2; i < jsonData.length; i++) {
              const r = jsonData[i];
              if (!r) continue;
              const info = { macro: String(r[28] || '').trim(), tipo: String(r[33] || '').trim() };
              if (r[1]) cdoLookup.set(String(r[1]).trim().toLowerCase(), info);
              if (r[2]) cdoLookupF.set(String(r[2]).trim().toLowerCase(), info);
            }

            const CT_COL = { COD_PLAN: 5, CODIGO: 6, PARTIDA: 7, DESC: 8, UNIDAD: 9, TARIFA: 12, N_MONTO: 13, Q_MONTO: 16, S_MONTO: 18, U_MONTO: 20, W_MONTO: 22, Z_MONTO: 25, AC_MONTO: 28 };
            const _hojas: PlanillaItem[] = [];
            const _partidas: PlanillaItem[] = [];
            const _enmiendas: any[] = [];
            let _totales: any = null;

            for (let i = 11; i < rawSabana.length; i++) {
              const r = rawSabana[i];
              if (!r) continue;
              if (String(r[CT_COL.CODIGO] || '').trim().toUpperCase() === 'MONTO TOTAL') {
                _totales = {
                  contrato: ctPf(r[CT_COL.N_MONTO]), saldo: ctPf(r[CT_COL.Q_MONTO]),
                  acum: ctPf(r[CT_COL.S_MONTO]), anterior: ctPf(r[CT_COL.U_MONTO]),
                  cert: ctPf(r[CT_COL.W_MONTO]), exc: ctPf(r[CT_COL.Z_MONTO]), excE6: ctPf(r[CT_COL.AC_MONTO])
                };
                continue;
              }
              const cod = r[CT_COL.COD_PLAN] !== null && r[CT_COL.COD_PLAN] !== undefined ? String(r[CT_COL.COD_PLAN]).trim() : null;
              const desc = r[CT_COL.DESC];
              if (!cod || !desc) continue;
              const tarifa = ctPf(r[CT_COL.TARIFA]);
              const esHoja = r[CT_COL.TARIFA] !== null && r[CT_COL.TARIFA] !== undefined && r[CT_COL.TARIFA] !== '' && tarifa > 0;

              const partida = String(r[CT_COL.PARTIDA] || '').trim();
              const cdoData = cdoLookup.get(partida.toLowerCase()) || cdoLookupF.get(cod.toLowerCase()) || null;
              const tipoRawCDO = cdoData?.tipo || '';
              const tipoKey = !cdoData ? '' : tipoRawCDO === '03.Equipo Mecanico - Principal' ? '03.Equipo Mecanico' : tipoRawCDO;
              const macroKey = cdoData?.macro || '';

              const item: PlanillaItem = {
                id: `p${i}`, cod, nivel: cod.split('.').length, esHoja, tipo: tipoKey, macro: macroKey,
                tipoG: String(r[CT_COL.CODIGO] || '').trim().toUpperCase(),
                desc: String(desc), unidad: String(r[CT_COL.UNIDAD] || ''), tarifa,
                contrato: ctPf(r[CT_COL.N_MONTO]), saldo: ctPf(r[CT_COL.Q_MONTO]),
                acum: ctPf(r[CT_COL.S_MONTO]), anterior: ctPf(r[CT_COL.U_MONTO]),
                cert: ctPf(r[CT_COL.W_MONTO]), exc: ctPf(r[CT_COL.Z_MONTO]), excE6: ctPf(r[CT_COL.AC_MONTO])
              };
              if (esHoja) _hojas.push(item);
              else _partidas.push(item);
            }

            // Enmiendas
            for (let j = 0; j < rawSabana.length; j++) {
              const r = rawSabana[j];
              if (!r) continue;
              const sVal = String(r[52] || '').trim(); // column BA (52)
              
              // Se ubica la enmienda (la cabecera tiene 'Incremento' en BC/54)
              if (r[54] === 'Incremento') {
                const label = sVal || 'Contrato Original';
                const filas: any[] = [];
                let subtotal: any = null;
                for (let k = j + 1; k < rawSabana.length; k++) {
                  const rr = rawSabana[k];
                  if (!rr) continue;
                  const t2 = String(rr[52] || '').trim(); // BA (52)
                  if (t2 === 'Total') {
                    const ocRow = filas[0] || {};
                    subtotal = {
                      contratoAcum: ocRow.contratoAcum || 0, incremento: ocRow.incremento || 0,
                      monto: ctPf(rr[55]), planillado: ctPf(rr[56]), excedentes: ctPf(rr[57]), // BD, BE, BF
                      saldo: ocRow.saldo || 0, adicional: ocRow.adicional || 0
                    };
                    break;
                  }
                  if (!t2) continue;
                  filas.push({
                    tipo: t2, contratoAcum: ctPf(rr[53]), incremento: ctPf(rr[54]), // BB, BC
                    monto: ctPf(rr[55]), planillado: ctPf(rr[56]), excedentes: ctPf(rr[57]), // BD, BE, BF
                    saldo: ctPf(rr[58]), adicional: ctPf(rr[59]) // BG, BH
                  });
                }
                if (filas.length) _enmiendas.push({ label, filas, subtotal });
              }
              
              // Gran Total está en fila 52 (j = 51)
              if (sVal === 'Total' && j === 51) {
                _enmiendas.push({
                  label: 'GRAN TOTAL', isGranTotal: true, filas: [],
                  subtotal: {
                    incremento: ctPf(r[54]), monto: ctPf(r[55]), planillado: ctPf(r[56]), // BC, BD, BE
                    excedentes: ctPf(r[57]), saldo: ctPf(r[58]), adicional: ctPf(r[59]) // BF, BG, BH
                  }
                });
              }
            }

            const _tipMap: Record<string, any> = {
              OC: { label: 'Obra Civil', monto: 0, planillado: 0, excedentes: 0, saldo: 0 },
              EQ: { label: 'Equipamiento Mecánico', monto: 0, planillado: 0, excedentes: 0, saldo: 0 },
              EE: { label: 'Equipamiento Eléctrico', monto: 0, planillado: 0, excedentes: 0, saldo: 0 }
            };
            _hojas.forEach(h => {
              const g = h.tipoG;
              if (_tipMap[g]) {
                _tipMap[g].monto += h.contrato;
                _tipMap[g].planillado += h.acum;
                _tipMap[g].excedentes += h.exc;
              }
            });

            // Calculate saldo as mathematical difference of monto - planillado
            Object.keys(_tipMap).forEach(key => {
              _tipMap[key].saldo = _tipMap[key].monto - _tipMap[key].planillado;
            });

            const _tipResumenCalc = Object.entries(_tipMap)
              .filter(([, v]) => v.monto > 0 || v.planillado > 0)
              .map(([tipo, v]) => ({ tipo, label: v.label, monto: v.monto, planillado: v.planillado, excedentes: v.excedentes, saldo: v.saldo }));
            
            const _tipTotal = _tipResumenCalc.reduce((acc, t) => ({ 
              monto: acc.monto + t.monto, 
              planillado: acc.planillado + t.planillado, 
              excedentes: acc.excedentes + t.excedentes,
              saldo: acc.saldo + t.saldo
            }), { monto: 0, planillado: 0, excedentes: 0, saldo: 0 });
            _tipResumenCalc.push({ tipo: 'Total', label: 'Total', ..._tipTotal });

            setPlanillaHojas(_hojas);
            setPlanillaPartidas(_partidas);
            setPlanillaTotales(_totales);
            setPlanillaEnmiendas(_enmiendas);
            setPlanillaTipRes(_tipResumenCalc);
            setPlanillaInfo({ sheet: sabanaSheet, nHojas: _hojas.length, nPartidas: _partidas.length });

            // CDO vs Sabana comparison tree
            try {
              interface CdoRow {
                wbs: string;
                idOrig: string;
                actId: string;
                desc: string;
                val: number;
                partidaColAG: string;
                capColAI: string;
              }
              const allCdoRows: CdoRow[] = [];
              const _cdoAV = new Map();
              const _cdoAVByActId = new Map();
              const _cdoTipo = new Map();
              for (let i = 2; i < jsonData.length; i++) {
                const r = jsonData[i];
                if (!r || !r[1]) continue;
                const k = String(r[1]).trim().toLowerCase();
                const actId = r[2] ? String(r[2]).trim().toLowerCase() : '';
                const desc = r[3] ? String(r[3]).trim() : ''; // Description is in Column D (index 3)
                const wbs = r[0] ? String(r[0]).trim().toLowerCase() : '';
                const val = ctPf(r[47]);
                const partidaColAG = r[32] ? String(r[32]).trim() : 'Sin Partida';
                const capColAI = r[34] ? String(r[34]).trim() : 'Sin CAP';
                _cdoAV.set(k, (_cdoAV.get(k) || 0) + val);
                if (actId) {
                  _cdoAVByActId.set(actId, val);
                }
                if (!_cdoTipo.has(k) && r[33]) _cdoTipo.set(k, String(r[33]).trim());
                allCdoRows.push({ wbs, idOrig: k, actId, desc, val, partidaColAG, capColAI });
              }

              const _pDesc: Record<string, string> = {};
              for (let i = 11; i < rawSabana.length; i++) {
                const r = rawSabana[i];
                if (!r) continue;
                if (String(r[CT_COL.CODIGO] || '').trim().toUpperCase() === 'MONTO TOTAL') continue;
                const cod = r[CT_COL.COD_PLAN] !== null && r[CT_COL.COD_PLAN] !== undefined ? String(r[CT_COL.COD_PLAN]).trim() : '';
                const h = String(r[CT_COL.PARTIDA] || '').trim();
                const d = r[CT_COL.DESC] ? String(r[CT_COL.DESC]).trim() : '';
                if (d) {
                  if (cod && !_pDesc[cod]) {
                    _pDesc[cod] = d;
                  }
                  if (h && !_pDesc[h]) {
                    _pDesc[h] = d;
                  }
                }
              }

              // Pre-collect all Sabana leaf rows by Partida code
              interface SabanaLeaf {
                codPlan: string;
                partida: string;
                desc: string;
                sItem: number;
                nItem: number;
                index: number;
                isVirtual?: boolean;
                tarifa?: number;
                unidad?: string;
              }

              const sabanaInfoMap = new Map<string, { tarifa: number; unidad: string }>();
              for (let i = 11; i < rawSabana.length; i++) {
                const r = rawSabana[i];
                if (!r) continue;
                const h = String(r[CT_COL.PARTIDA] || '').trim().toLowerCase();
                if (h) {
                  const t = ctPf(r[CT_COL.TARIFA]);
                  const u = String(r[CT_COL.UNIDAD] || '').trim();
                  if (!sabanaInfoMap.has(h) || t > 0) {
                    sabanaInfoMap.set(h, { tarifa: t, unidad: u });
                  }
                }
              }

              const sabanaLeavesByPartida = new Map<string, SabanaLeaf[]>();
              for (let i = 11; i < rawSabana.length; i++) {
                const r = rawSabana[i];
                if (!r) continue;
                if (String(r[CT_COL.CODIGO] || '').trim().toUpperCase() === 'MONTO TOTAL') continue;
                if (!r[CT_COL.TARIFA] || ctPf(r[CT_COL.TARIFA]) <= 0) continue;
                const h = String(r[CT_COL.PARTIDA] || '').trim();
                const hk = h.toLowerCase();
                if (!hk) continue;

                const parsedCod = r[CT_COL.COD_PLAN] !== null && r[CT_COL.COD_PLAN] !== undefined ? String(r[CT_COL.COD_PLAN]).trim() : '';
                if (!parsedCod) continue;

                const sItem = ctPf(r[CT_COL.S_MONTO]);
                const nItem = ctPf(r[CT_COL.N_MONTO]);
                const dSabana = String(r[CT_COL.DESC] || '').trim();
                const tVal = ctPf(r[CT_COL.TARIFA]);
                const uVal = String(r[CT_COL.UNIDAD] || '').trim();

                const leaf: SabanaLeaf = {
                  codPlan: parsedCod,
                  partida: h,
                  desc: dSabana,
                  sItem,
                  nItem,
                  index: i,
                  tarifa: tVal,
                  unidad: uVal
                };
                if (!sabanaLeavesByPartida.has(hk)) {
                  sabanaLeavesByPartida.set(hk, []);
                }
                sabanaLeavesByPartida.get(hk)!.push(leaf);
              }

              // Identify and create virtual Sabana leaves for numeric ID CDO rows that do not exist under their respective chapter in Sabana
              const isNumericId = (id: string) => {
                const normalized = id.trim().toLowerCase();
                return /^[0-9.]*$/.test(normalized) && normalized !== '' && !normalized.includes('cp');
              };

              const getMajorChapter = (code: string) => {
                const clean = code.trim();
                if (!clean) return '';
                const firstDot = clean.indexOf('.');
                if (firstDot === -1) return clean;
                return clean.substring(0, firstDot);
              };

              const getCdoCodPlan = (cand: CdoRow) => {
                return cand.wbs.replace(/^p\d+\./, '').trim();
              };

              const virtualLeavesByIdx = new Map<number, SabanaLeaf>();
              const createdVirtualKeys = new Map<string, SabanaLeaf>();
              let virtualIdxCounter = -10000;

              for (let i = 0; i < allCdoRows.length; i++) {
                const cand = allCdoRows[i];
                if (cand.val === 0) continue;
                if (!isNumericId(cand.idOrig)) continue;

                const cdoCodPlan = getCdoCodPlan(cand);
                if (!cdoCodPlan) continue;

                const cdoChap = getMajorChapter(cdoCodPlan);
                if (!cdoChap) continue;

                const mappedId = translateCdoToPlanilla(cand.idOrig);
                const hk = mappedId.toLowerCase();
                const existingLeaves = sabanaLeavesByPartida.get(hk) || [];
                const matchedLeavesInSameChapter = existingLeaves.filter(l => getMajorChapter(l.codPlan) === cdoChap);

                if (matchedLeavesInSameChapter.length === 0) {
                  // Create a virtual unplanillado leaf under this CDO row's respective chapter and original ID
                  const virtualKey = `${cdoCodPlan}::${hk}`;
                  let vLeaf = createdVirtualKeys.get(virtualKey);
                  if (!vLeaf) {
                    const idx = virtualIdxCounter--;
                    const sInfo = sabanaInfoMap.get(hk) || { tarifa: 0, unidad: '' };
                    vLeaf = {
                      codPlan: cdoCodPlan,
                      partida: mappedId.trim(),
                      desc: cand.desc || `Partida ${cand.idOrig} (CDO Only)`,
                      sItem: 0,
                      nItem: 0,
                      index: idx,
                      isVirtual: true,
                      tarifa: sInfo.tarifa,
                      unidad: sInfo.unidad
                    };
                    createdVirtualKeys.set(virtualKey, vLeaf);
                    virtualLeavesByIdx.set(idx, vLeaf);

                    if (!sabanaLeavesByPartida.has(hk)) {
                      sabanaLeavesByPartida.set(hk, []);
                    }
                    sabanaLeavesByPartida.get(hk)!.push(vLeaf);
                  }
                }
              }

              // Compute exact mapping and distribution based STRICTLY on ID matching (Columns B and H) with Column C as helper
              const avBySabanaRowIndex = new Map<number, number>();

              // Initialize indices to 0 for all Sabana leaves (real and virtual)
              for (const leaves of sabanaLeavesByPartida.values()) {
                for (const leaf of leaves) {
                  avBySabanaRowIndex.set(leaf.index, 0);
                }
              }

              let totalCdoAvSum = 0;
              let totalMappedSum = 0;
              let unmatchedCount = 0;
              let unmatchedSum = 0;

              for (const cand of allCdoRows) {
                totalCdoAvSum += cand.val;
                if (cand.val === 0) continue;

                // Find candidate leaves in Sabana where leaf.partida matches translated CDO ID (case-insensitive)
                const mappedId = translateCdoToPlanilla(cand.idOrig);
                const allLeaves = sabanaLeavesByPartida.get(mappedId.toLowerCase()) || [];

                
                // If the ID is numeric, force strict chapter alignment to prevent cross-chapter matching
                let leaves = allLeaves;
                if (isNumericId(cand.idOrig)) {
                  const cdoCodPlan = getCdoCodPlan(cand);
                  const cdoChap = getMajorChapter(cdoCodPlan);
                  if (cdoChap) {
                    leaves = allLeaves.filter(l => getMajorChapter(l.codPlan) === cdoChap);
                  }
                }

                if (!leaves || leaves.length === 0) {
                  unmatchedCount++;
                  unmatchedSum += cand.val;
                  continue;
                }

                if (leaves.length === 1) {
                  // Exactly one Sabana leaf matches: it gets 100% of this CDO row's value
                  const leaf = leaves[0];
                  const currentVal = avBySabanaRowIndex.get(leaf.index) || 0;
                  avBySabanaRowIndex.set(leaf.index, currentVal + cand.val);
                  totalMappedSum += cand.val;
                  continue;
                }

                // Multiple leaves have the same partida ID in the same chapter:
                // Check if there is an exact match on codPlan === actId (aided by Column C!)
                const exactMatches = leaves.filter(leaf => {
                  const leafCodLower = leaf.codPlan.trim().toLowerCase();
                  const candActLower = cand.actId.trim().toLowerCase();
                  return leafCodLower === candActLower && candActLower !== '';
                });

                if (exactMatches.length > 0) {
                  // Distribute among the exact matches (usually 1)
                  const portion = cand.val / exactMatches.length;
                  for (const leaf of exactMatches) {
                    const currentVal = avBySabanaRowIndex.get(leaf.index) || 0;
                    avBySabanaRowIndex.set(leaf.index, currentVal + portion);
                    totalMappedSum += portion;
                  }
                } else {
                  // No exact match for actId: distribute proportionally.
                  const sTot = leaves.reduce((sum, l) => sum + l.sItem, 0);
                  const nTot = leaves.reduce((sum, l) => sum + l.nItem, 0);

                  for (const leaf of leaves) {
                    let portion = 0;
                    if (sTot > 0) {
                      portion = cand.val * (leaf.sItem / sTot);
                    } else if (nTot > 0) {
                      portion = cand.val * (leaf.nItem / nTot);
                    } else {
                      portion = cand.val / leaves.length;
                    }
                    const currentVal = avBySabanaRowIndex.get(leaf.index) || 0;
                    avBySabanaRowIndex.set(leaf.index, currentVal + portion);
                    totalMappedSum += portion;
                  }
                }
              }

              console.log(`[CDO vs Sabana Strict ID Matching Diagnostics]
                Total CDO AV sum: $${totalCdoAvSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                Total mapped sum: $${totalMappedSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                Unmatched CDO rows count with non-zero AV: ${unmatchedCount} (Summing $${unmatchedSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).
              `);

              const _F: Record<string, any> = {};

              const addLeafToF = (parsedCod: string, h: string, sItem: number, nItem: number, av: number, dSabana: string, tarifa?: number, unidad?: string) => {
                const hk = h.toLowerCase();
                let tipo = _cdoTipo.get(hk) || '';
                if (!tipo) {
                  if (parsedCod.startsWith('11') || parsedCod.startsWith('14') || h.startsWith('11') || h.startsWith('14')) {
                    tipo = 'Obra Civil';
                  }
                }
                const partes = parsedCod.split('.');
                for (let k = 1; k <= partes.length; k++) {
                  const anc = partes.slice(0, k).join('.');
                  if (!_F[anc]) _F[anc] = { plan: 0, ejec: 0, contrato: 0, desc: '', tipo: '', h: '' };
                  _F[anc].plan += sItem;
                  _F[anc].ejec += av;
                  _F[anc].contrato += nItem;
                  if (!_F[anc].desc) _F[anc].desc = _pDesc[anc] || (anc === parsedCod ? dSabana : '');
                  if (anc === parsedCod) {
                    if (!_F[anc].tipo) _F[anc].tipo = tipo;
                    if (!_F[anc].h) _F[anc].h = h;
                    if (tarifa !== undefined && _F[anc].tarifa === undefined) _F[anc].tarifa = tarifa;
                    if (unidad !== undefined && _F[anc].unidad === undefined) _F[anc].unidad = unidad;
                  }
                }
              };

              const addVirtualLeafToF = (parsedCod: string, h: string, sItem: number, nItem: number, av: number, dSabana: string, tarifa?: number, unidad?: string) => {
                const hk = h.toLowerCase();
                let tipo = _cdoTipo.get(hk) || '';
                if (!tipo) {
                  if (parsedCod.startsWith('11') || parsedCod.startsWith('14') || h.startsWith('11') || h.startsWith('14')) {
                    tipo = 'Obra Civil';
                  }
                }
                const partes = parsedCod.split('.');
                // Add parent categories first (without the leaf suffix)
                for (let k = 1; k < partes.length; k++) {
                  const anc = partes.slice(0, k).join('.');
                  if (!_F[anc]) _F[anc] = { plan: 0, ejec: 0, contrato: 0, desc: '', tipo: '', h: '' };
                  _F[anc].plan += sItem;
                  _F[anc].ejec += av;
                  _F[anc].contrato += nItem;
                  if (!_F[anc].desc) _F[anc].desc = _pDesc[anc] || '';
                }

                // Add the unique virtual leaf row with hyphen suffix
                const leafKey = `${parsedCod}-${hk.replace(/\./g, '_')}`;
                if (!_F[leafKey]) _F[leafKey] = { plan: 0, ejec: 0, contrato: 0, desc: '', tipo: '', h: '' };
                _F[leafKey].plan += sItem;
                _F[leafKey].ejec += av;
                _F[leafKey].contrato += nItem;
                _F[leafKey].desc = dSabana;
                _F[leafKey].tipo = tipo;
                _F[leafKey].h = h;
                if (tarifa !== undefined) _F[leafKey].tarifa = tarifa;
                if (unidad !== undefined) _F[leafKey].unidad = unidad;
              };

              // 1. Process all real Sabana leaves
              for (let i = 11; i < rawSabana.length; i++) {
                const r = rawSabana[i];
                if (!r) continue;
                if (String(r[CT_COL.CODIGO] || '').trim().toUpperCase() === 'MONTO TOTAL') continue;
                if (!r[CT_COL.TARIFA] || ctPf(r[CT_COL.TARIFA]) <= 0) continue;
                const parsedCod = r[CT_COL.COD_PLAN] !== null && r[CT_COL.COD_PLAN] !== undefined ? String(r[CT_COL.COD_PLAN]).trim() : '';
                if (!parsedCod) continue;
                const h = String(r[CT_COL.PARTIDA] || '').trim();
                const sItem = ctPf(r[CT_COL.S_MONTO]);
                const nItem = ctPf(r[CT_COL.N_MONTO]);
                const dSabana = String(r[CT_COL.DESC] || '').trim();
                const av = avBySabanaRowIndex.get(i) || 0;
                const tVal = ctPf(r[CT_COL.TARIFA]);
                const uVal = String(r[CT_COL.UNIDAD] || '').trim();
                addLeafToF(parsedCod, h, sItem, nItem, av, dSabana, tVal, uVal);
              }

              // 2. Process all virtual CDO-only leaves
              for (const vLeaf of virtualLeavesByIdx.values()) {
                addVirtualLeafToF(vLeaf.codPlan, vLeaf.partida, vLeaf.sItem, vLeaf.nItem, avBySabanaRowIndex.get(vLeaf.index) || 0, vLeaf.desc, vLeaf.tarifa, vLeaf.unidad);
              }

              const _H: Record<string, any> = {};

              const addLeafToH = (parsedCod: string, h: string, sItem: number, nItem: number, av: number, dSabana: string, tarifa?: number, unidad?: string) => {
                const hk = h.toLowerCase();
                let tipo = _cdoTipo.get(hk) || '';
                if (!tipo) {
                  if (parsedCod.startsWith('11') || parsedCod.startsWith('14') || h.startsWith('11') || h.startsWith('14')) {
                    tipo = 'Obra Civil';
                  }
                }
                const partes = h.split('.');
                for (let k = 1; k <= partes.length; k++) {
                  const anc = partes.slice(0, k).join('.');
                  if (!_H[anc]) _H[anc] = { plan: 0, ejec: 0, contrato: 0, desc: '', tipo: '' };
                  _H[anc].plan += sItem;
                  _H[anc].ejec += av;
                  _H[anc].contrato += nItem;
                  if (!_H[anc].desc) _H[anc].desc = _pDesc[anc] || (anc === h ? dSabana : '');
                  if (anc === h) {
                    if (!_H[anc].tipo) _H[anc].tipo = tipo;
                    if (tarifa !== undefined && _H[anc].tarifa === undefined) _H[anc].tarifa = tarifa;
                    if (unidad !== undefined && _H[anc].unidad === undefined) _H[anc].unidad = unidad;
                  }
                }
              };

              // 1. Process all real Sabana leaves
              for (let i = 11; i < rawSabana.length; i++) {
                const r = rawSabana[i];
                if (!r) continue;
                if (String(r[CT_COL.CODIGO] || '').trim().toUpperCase() === 'MONTO TOTAL') continue;
                if (!r[CT_COL.TARIFA] || ctPf(r[CT_COL.TARIFA]) <= 0) continue;
                const h = String(r[CT_COL.PARTIDA] || '').trim();
                if (!h) continue;
                const parsedCod = r[CT_COL.COD_PLAN] !== null && r[CT_COL.COD_PLAN] !== undefined ? String(r[CT_COL.COD_PLAN]).trim() : '';
                const sItem = ctPf(r[CT_COL.S_MONTO]);
                const nItem = ctPf(r[CT_COL.N_MONTO]);
                const dSabana = String(r[CT_COL.DESC] || '').trim();
                const av = avBySabanaRowIndex.get(i) || 0;
                const tVal = ctPf(r[CT_COL.TARIFA]);
                const uVal = String(r[CT_COL.UNIDAD] || '').trim();
                addLeafToH(parsedCod, h, sItem, nItem, av, dSabana, tVal, uVal);
              }

              // 2. Process all virtual CDO-only leaves
              for (const vLeaf of virtualLeavesByIdx.values()) {
                addLeafToH(vLeaf.codPlan, vLeaf.partida, vLeaf.sItem, vLeaf.nItem, avBySabanaRowIndex.get(vLeaf.index) || 0, vLeaf.desc, vLeaf.tarifa, vLeaf.unidad);
              }

              // Compile list of desalineados/unmigrated items grouped by partida (only numeric, excluding cp-s)
              const cdoWbsDesc = new Map<string, string>();
              for (let i = 2; i < jsonData.length; i++) {
                const r = jsonData[i];
                if (!r) continue;
                const rawWbs = r[0] ? String(r[0]).trim() : '';
                const cleanWbs = rawWbs.replace(/^p\d+\./, '').trim().toLowerCase();
                const rawDesc = r[3] ? String(r[3]).trim() : ''; // Description is in Column D (index 3)
                if (cleanWbs && rawDesc) {
                  if (!cdoWbsDesc.has(cleanWbs) || !cdoWbsDesc.get(cleanWbs)) {
                    cdoWbsDesc.set(cleanWbs, rawDesc);
                  }
                }
              }

              interface AlertOccurrence {
                wbs: string;
                partida: string;
                desc: string;
                valCdo: number;
                valPlanilla: number;
                status: 'No Existe' | 'Desalineada';
                capCdo: string;
                partidaColAG: string;
                capColAI: string;
              }

              const groups = new Map<string, Map<string, AlertOccurrence[]>>();

              for (const cand of allCdoRows) {
                if (cand.val === 0) continue;
                if (!isNumericId(cand.idOrig)) continue;

                const mappedId = translateCdoToPlanilla(cand.idOrig);
                const hk = mappedId.toLowerCase();
                const existingLeaves = sabanaLeavesByPartida.get(hk) || [];
                const realLeaves = existingLeaves.filter(l => !l.isVirtual);
                
                const cdoCodPlan = getCdoCodPlan(cand);
                const cdoChap = getMajorChapter(cdoCodPlan);

                let isUnmigrated = false;
                let isMisaligned = false;

                if (realLeaves.length === 0) {
                  isUnmigrated = true;
                } else {
                  const hasAlignedRealLeaf = realLeaves.some(l => getMajorChapter(l.codPlan) === cdoChap);
                  if (!hasAlignedRealLeaf) {
                    isMisaligned = true;
                  }
                }

                if (isUnmigrated || isMisaligned) {
                  const cleanWbs = cand.wbs.replace(/^p\d+\./, '').trim();
                  
                  let valPlanilla = 0;
                  if (isMisaligned) {
                    valPlanilla = realLeaves.reduce((sum, l) => sum + l.sItem, 0);
                  }

                  const originalDesc = cand.desc || 'Sin descripción';
                  const pAG = cand.partidaColAG || 'Sin Partida';
                  const cAI = cand.capColAI || 'Sin CAP';

                  const occ: AlertOccurrence = {
                    wbs: cleanWbs,
                    partida: cand.idOrig.trim(),
                    desc: originalDesc,
                    valCdo: cand.val,
                    valPlanilla: valPlanilla,
                    status: isUnmigrated ? 'No Existe' : 'Desalineada',
                    capCdo: cleanWbs,
                    partidaColAG: pAG,
                    capColAI: cAI
                  };

                  if (!groups.has(pAG)) {
                    groups.set(pAG, new Map<string, AlertOccurrence[]>());
                  }
                  const capMap = groups.get(pAG)!;
                  if (!capMap.has(cAI)) {
                    capMap.set(cAI, []);
                  }
                  capMap.get(cAI)!.push(occ);
                }
              }

              const _desalineados: any[] = [];

              // Sort Partidas alphabetically or numerically
              const sortedPartidas = Array.from(groups.keys()).sort((a, b) => 
                a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
              );

              for (const pAG of sortedPartidas) {
                const capMap = groups.get(pAG)!;
                
                // Calculate total valCdo for this Partida
                let totalCdoPartida = 0;
                for (const occurrences of capMap.values()) {
                  totalCdoPartida += occurrences.reduce((sum, occ) => sum + occ.valCdo, 0);
                }

                _desalineados.push({
                  isParent: true,
                  isLevel1: true,
                  wbs: pAG, // unique key value for collapse
                  desc: pAG,
                  valCdo: totalCdoPartida,
                  depth: 0
                });

                // Sort CAPs under this Partida
                const sortedCaps = Array.from(capMap.keys()).sort((a, b) => 
                  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
                );

                for (const cAI of sortedCaps) {
                  const occurrences = capMap.get(cAI)!;
                  const totalCdoCap = occurrences.reduce((sum, occ) => sum + occ.valCdo, 0);
                  const capUniqueId = `${pAG}::${cAI}`;

                  _desalineados.push({
                    isParent: true,
                    isLevel2: true,
                    wbs: capUniqueId, // unique key value for collapse
                    parentWbs: pAG,
                    desc: cAI,
                    valCdo: totalCdoCap,
                    depth: 1
                  });

                  // Sort occurrences inside this CAP
                  const sortedOccurrences = occurrences.sort((a, b) => 
                    a.partida.localeCompare(b.partida, undefined, { numeric: true, sensitivity: 'base' })
                  );

                  for (const occ of sortedOccurrences) {
                    _desalineados.push({
                      ...occ,
                      isParent: false,
                      parentWbs: capUniqueId,
                      depth: 2
                    });
                  }
                }
              }

              setPlanillaCDOvsS({ F: _F, H: _H, desalineados: _desalineados });

              const lMeta = {
                fileName: fileName,
                rowCount: actividadesProcesadas.length,
                isFirebase: false,
                updatedAt: new Date().toISOString()
              };
              setFileData(lMeta);

              const backupData = {
                actividades: actividadesProcesadas,
                planillaHojas: _hojas,
                planillaPartidas: _partidas,
                planillaCDOvsS: { F: _F, H: _H, desalineados: _desalineados },
                planillaTotales: _totales,
                planillaEnmiendas: _enmiendas,
                planillaTipRes: _tipResumenCalc,
                planillaInfo: { sheet: sabanaSheet, nHojas: _hojas.length, nPartidas: _partidas.length },
                fileData: lMeta,
                periodoSeleccionado,
                fechaCorteState: fechaCorteState.toISOString(),
                mapaColumnasMes,
                dataPlanificado: localDataPlanificado,
                dataPlanificadoPG004: localDataPlanificadoPG004
              };

              setLocalPlanData(backupData);
              setSourceActive('local');
              savePlanToLocalStorage(backupData);
            } catch (eCDO) {
              console.warn('CDO vs Sabana error:', eCDO);
            }
          } catch (errSabana) {
            console.warn('No se pudo cargar la hoja Sabana global:', errSabana);
          }
        }

        await updateProgress(100, '¡Carga completada!');
        setTimeout(() => {
          setLoadingProgress(0);
          setLoadingPhase('');
        }, 800);

      } catch (error) {
        console.error('Error procesando archivo:', error);
        alert('Error al procesar el archivo. Verifica que sea un archivo Excel válido.');
        setLoadingProgress(0);
        setLoadingPhase('');
      } finally {
        isUploadingRef.current = false;
      }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isUploadingRef.current) {
      alert('Ya hay una carga en curso. Por favor, espere a que finalice.');
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;

    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    setLoadingProgress(1);
    setLoadingPhase(`Iniciando carga de ${file.name} (${sizeMB} MB)...`);
    await new Promise(r => setTimeout(r, 16));

    const reader = new FileReader();

    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const pctLectura = (e.loaded / e.total) * 8; 
        setLoadingProgress(1 + pctLectura);
        setLoadingPhase(`Leyendo archivo... ${(e.loaded / 1024 / 1024).toFixed(1)} / ${sizeMB} MB`);
      }
    };

    reader.onload = async (e: any) => {
      await processFileArrayBuffer(e.target.result, file.name, sizeMB);
    };

    reader.readAsArrayBuffer(file);
  };

  const exportarAvancePeriodo = () => {
    const itemsHoja = actividades.filter(a => a.esItemHoja);
    const nombresMesAnio = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const mesIdxSeleccionado = nombresMesAnio.indexOf(periodoSeleccionado.mes);
    const anioSeleccionado = parseInt(periodoSeleccionado.anio, 10);
    const esPeriodoTodos = periodoSeleccionado.anio === 'TODOS';

    const periodItems = itemsHoja.filter(a => {
      if (esPeriodoTodos) return a.ventaEjecutada > 0;
      if (!a.certificacionesPorFecha) return false;
      return Object.entries(a.certificacionesPorFecha).some(([fechaKey, valor]) => {
        const [aStr, mStr] = fechaKey.split('-');
        return parseInt(aStr, 10) === anioSeleccionado && parseInt(mStr, 10) - 1 === mesIdxSeleccionado && (Number(valor) || 0) > 0;
      });
    });

    let csvContent = "\uFEFF";
    csvContent += "WBS,Activity ID,Descripcion,Unidad,Tipo,Excedente,Venta Contrato,Venta Plan,Venta Ejecutada,Avance %\n";

    periodItems.forEach(item => {
      const vals = calcularValoresReales(item);
      if (vals.ventaEjecutada <= 0) return;
      const row = [
        item.wbs,
        item.activityId || '',
        `"${(item.descripcion || '').replace(/"/g, '""')}"`,
        item.unidad || '',
        item.tipo || '',
        vals.saldo || 0,
        vals.venta || 0,
        vals.ventaPlan || 0,
        vals.ventaEjecutada || 0,
        vals.venta > 0 ? ((vals.ventaEjecutada / vals.venta) * 100).toFixed(1) : '0'
      ].join(",");
      csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Avance_Periodo_${periodoSeleccionado.mes}_${periodoSeleccionado.anio}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportarCronograma = () => {
    let csvContent = "\uFEFF";
    csvContent += "WBS,Activity ID,Descripcion,Nivel,Tipo,Unidad,Venta Contrato,Venta Plan,Venta Ejecutada,Avance %\n";

    actividades.forEach(item => {
      const vals = calcularValoresReales(item);
      
      // If a period is selected, only export those items that are planned or executed during that period
      if (periodoSeleccionado && periodoSeleccionado.anio !== 'TODOS') {
        const hasValue = (vals.ventaPlan || 0) > 0 || (vals.ventaEjecutada || 0) > 0;
        if (!hasValue) return;
      }

      const actId = item.activityId || (item.nivel > 1 ? `n.${item.nivel - 1}` : '');
      const row = [
        item.wbs,
        actId,
        `"${(item.descripcion || '').replace(/"/g, '""')}"`,
        item.nivel,
        item.tipo || '',
        item.unidad || '',
        vals.venta || 0,
        vals.ventaPlan || 0,
        vals.ventaEjecutada || 0,
        calcularAvance(item)
      ].join(",");
      csvContent += row + "\n";
    });

    const isPeriodSelected = periodoSeleccionado && periodoSeleccionado.anio !== 'TODOS';
    const filename = isPeriodSelected 
      ? `Cronograma_WBS_${periodoSeleccionado.mes}_${periodoSeleccionado.anio}.csv`
      : `Cronograma_WBS_Completo.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportarVersionMeltOptimizada = () => {
    // 1. Generate Metadata / Preliminary Calculations Sheet
    const totalActividades = actividades.length;
    const totalHojas = planillaHojas.length;
    const totalPartidas = planillaPartidas.length;
    
    // Chunking stats
    const chunkActCount = Math.ceil(totalActividades / 200);
    const chunkHojasCount = Math.ceil(totalHojas / 200);
    const chunkPartidasCount = Math.ceil(totalPartidas / 200);
    
    const fKeys = planillaCDOvsS?.F ? Object.keys(planillaCDOvsS.F) : [];
    const hKeys = planillaCDOvsS?.H ? Object.keys(planillaCDOvsS.H) : [];
    const chunkCDOFCount = Math.ceil(fKeys.length / 500);
    const chunkCDOHCount = Math.ceil(hKeys.length / 500);
    
    const docWrites = chunkActCount + chunkHojasCount + chunkPartidasCount + chunkCDOFCount + chunkCDOHCount + 1; // plus 1 meta document
    const totalBatchesNeeded = Math.ceil(docWrites / 5); // 5-by-5 chunks for stream stability
    
    const metaDashboard = [
      ["METRICA DE CARGA OPTIMIZADA (MELT DATABASE STRATEGY C)", "VALOR", "INFORMACIÓN / DETALLE"],
      ["Nombre del Archivo", fileData?.fileName || 'Sin nombre', "Archivo Master Plan cargado actual"],
      ["Registros de Filtro Activos (WBS)", fileData?.rowCount || 0, "Filas originales del cronograma"],
      ["Total de Actividades (P6/CDO)", totalActividades, "Subcolección 'actividades'"],
      ["Total Hojas de Sabana", totalHojas, "Subcolección 'planillaHojas'"],
      ["Total Partidas de Estructura", totalPartidas, "Subcolección 'planillaPartidas'"],
      ["Mapeos CDO vs Sabana (F)", fKeys.length, "Para alineación de costos por Formula"],
      ["Mapeos CDO vs Sabana (H)", hKeys.length, "Para alineación de costos por Hitos/Hojas"],
      ["", "", ""],
      ["--- OPTIMIZACIÓN DE FIREBASE (DISMINUCIÓN DE QUOTA) ---", "", ""],
      ["Tamaño de Chunk (Agrupación)", "200 items / doc (Actividades y Hojas)", "Previene realizar miles de escrituras individuales"],
      ["Tamaño de Chunk (CDO)", "500 items / doc (Mapeos CDO)", "Optimiza lectura e integraciones pesadas"],
      ["Documentos Actividades en Firestore", chunkActCount, `Genera solo ${chunkActCount} IDs de documento en vez de ${totalActividades}`],
      ["Documentos Hojas en Firestore", chunkHojasCount, `Genera solo ${chunkHojasCount} IDs en vez de ${totalHojas}`],
      ["Documentos Partidas en Firestore", chunkPartidasCount, `Genera solo ${chunkPartidasCount} IDs en vez de ${totalPartidas}`],
      ["Documentos Mapeos CDO (F) en Firestore", chunkCDOFCount, `Genera sólo ${chunkCDOFCount} IDs`],
      ["Documentos Mapeos CDO (H) en Firestore", chunkCDOHCount, `Genera sólo ${chunkCDOHCount} IDs`],
      ["Documento Metadatos Principal", 1, "Guarda estado del proyecto de manera atómica"],
      ["Total Escrituras Consolidadas", docWrites, `${docWrites} operaciones de escritura unitarias (Ahorro del 95% vs modelo tradicional de ${totalActividades + totalHojas + totalPartidas} escrituras)`],
      ["Lote batches (Batch size 5)", totalBatchesNeeded, `Se ejecutarán ${totalBatchesNeeded} commits transaccionales`],
    ];

    // 2. Melting Activities / Planificado (long format)
    const meltPlanificado: any[][] = [
      ["WBS", "Activity ID", "Descripción", "Nivel", "Tipo", "Unidad", "Venta Contrato Total", "Fecha (Periodo)", "Valor Planificado Mensual"]
    ];
    actividades.forEach(a => {
      const plan = (dataPlanificado && dataPlanificado[a.activityId]) || a.planificadoPorFecha || null;
      if (plan) {
        Object.entries(plan).forEach(([fechaKey, valor]: any) => {
          if (Number(valor) > 0) {
            meltPlanificado.push([
              a.wbs,
              a.activityId || '',
              a.descripcion || '',
              a.nivel || '',
              a.tipo || '',
              a.unidad || '',
              (a as any).ventaContrato || a.venta || 0,
              fechaKey,
              valor
            ]);
          }
        });
      }
    });

    // 3. Melting Activities / Ejecutado (long format)
    const meltEjecutado: any[][] = [
      ["WBS", "Activity ID", "Descripción", "Nivel", "Tipo", "Unidad", "Venta Contrato Total", "Fecha (Periodo)", "Valor Ejecutado Mensual"]
    ];
    actividades.forEach(a => {
      if (a.certificacionesPorFecha) {
        Object.entries(a.certificacionesPorFecha).forEach(([fechaKey, valor]: any) => {
          if (Number(valor) > 0) {
            meltEjecutado.push([
              a.wbs,
              a.activityId || '',
              a.descripcion || '',
              a.nivel || '',
              a.tipo || '',
              a.unidad || '',
              (a as any).ventaContrato || a.venta || 0,
              fechaKey,
              valor
            ]);
          }
        });
      }
    });

    // 4. CDO Mappings sheet
    const cdoMappings: any[][] = [
      ["Tipo Enlace", "Código/Partida", "Macro", "Tipo", "Valor Tarifa / Configuración"]
    ];
    if (planillaCDOvsS?.F) {
      Object.entries(planillaCDOvsS.F).forEach(([k, val]: any) => {
        cdoMappings.push(["Formula (F)", k, val.macro || '', val.tipo || '', JSON.stringify(val)]);
      });
    }
    if (planillaCDOvsS?.H) {
      Object.entries(planillaCDOvsS.H).forEach(([k, val]: any) => {
        cdoMappings.push(["Hito (H)", k, val.macro || '', val.tipo || '', JSON.stringify(val)]);
      });
    }

    // Build the workbook using SheetJS
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(metaDashboard), "Resumen Optimización Carga");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meltPlanificado), "Planificado Melt (Mensual)");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meltEjecutado), "Ejecutado Melt (Mensual)");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cdoMappings), "Alineación CDO-Melt");

    XLSX.writeFile(wb, `Plan_Optimizado_Database_Melt_${Date.now()}.xlsx`);
  };

  return {
    fileData, setFileData,
    loadingProgress, setLoadingProgress,
    loadingPhase, setLoadingPhase,
    dataPlanificado, setDataPlanificado,
    dataPlanificadoPG004, setDataPlanificadoPG004,
    donutPG, setDonutPG,
    actividades, setActividades,
    expandedItems, setExpandedItems,
    searchTerm, setSearchTerm,
    searchInput, setSearchInput,
    selectedActividad, setSelectedActividad,
    filterLevel, setFilterLevel,
    filterTipologia, setFilterTipologia,
    tipologiaSeleccionada, setTipologiaSeleccionada,
    expandedRESPs, setExpandedRESPs,
    expandedTipos, setExpandedTipos,
    expandedSCAPs, setExpandedSCAPs,
    expandedUNITs, setExpandedUNITs,
    expandedSubPartidas, setExpandedSubPartidas,
    sortColumn, setSortColumn,
    sortDirection, setSortDirection,
    filterResp, setFilterResp,
    baseVenta, setBaseVenta,
    filterTipologiaRetraso, setFilterTipologiaRetraso,
    fechaCorteState, setFechaCorteState,
    periodoSeleccionado, setPeriodoSeleccionado,
    mapaColumnasMes, setMapaColumnasMes,
    activeTab, setActiveTab,
    donutAnio, setDonutAnio,
    donutMes, setDonutMes,
    donutSemana, setDonutSemana,
    donutAcumulado, setDonutAcumulado,
    donutDim, setDonutDim,
    tablaSortCol, setTablaSortCol,
    tablaSortDir, setTablaSortDir,
    planillaHojas, setPlanillaHojas,
    planillaPartidas, setPlanillaPartidas,
    planillaTotales, setPlanillaTotales,
    planillaEnmiendas, setPlanillaEnmiendas,
    planillaTipRes, setPlanillaTipRes,
    planillaInfo, setPlanillaInfo,
    planillaCDOvsS, setPlanillaCDOvsS,
    enmExpanded, setEnmExpanded,
    ctExpanded, setCtExpanded,
    ctSearch, setCtSearch,
    ctFilterTipo, setCtFilterTipo,
    ctSoloCert, setCtSoloCert,
    certOpen, setCertOpen,
    ganttZoom, setGanttZoom,
    ganttExp, setGanttExp,
    ganttSearch, setGanttSearch,
    ganttStatus, setGanttStatus,
    ganttFloat, setGanttFloat,
    ganttMetricsOpen, setGanttMetricsOpen,
    ganttTipoOpen, setGanttTipoOpen,
    ganttTipo, setGanttTipo,
    kpiSelected, setKpiSelected,
    kpiExp, setKpiExp,
    expandedYears, setExpandedYears,
    partidaSeleccionada, setPartidaSeleccionada,
    tarjetasPartidasExpandidas, setTarjetasPartidasExpandidas,
    tarjetasTipologiasExpandidas, setTarjetasTipologiasExpandidas,
    procesosExpandidos, setProcesosExpandidos,
    capsExpandidos, setCapsExpandidos,
    scapsExpandidos, setScapsExpandidos,
    unitsExpandidos, setUnitsExpandidos,
    
    isRespFilterActive,
    matchesRespFilter,
    aplicarBusqueda,
    limpiarBusqueda,
    handleSearchKeyPress,
    updateProgress,
    
    getVB,
    calcularValoresReales,
    calcularAvance,
    planTotalProyecto,
    stats,
    statsCronograma,
    datosCurvaAvance,
    datosDona,
    donaAgregada,
    planFuturoAgregado,
    ultimaSemanaConAvance,
    tablaUnificada,
    barrasPlanVsReal,
    filteredActividades,
    toggleExpand,
    handleFileUpload,
    exportarAvancePeriodo,
    exportarCronograma,
    exportarVersionMeltOptimizada,
    publishPlanToFirebase,
    sourceActive,
    switchSource,
    firebasePlanData,
    localPlanData,
    setFirebasePlanData,
    setLocalPlanData,
    firebaseQuotaExceeded,
    setFirebaseQuotaExceeded,

    googleAccessToken, setGoogleAccessToken,
    googleUser, setGoogleUser,
    googleDriveConfig, setGoogleDriveConfig,
    isDriveLoading, setIsDriveLoading,
    loadDriveConfig,
    saveDriveConfig,
    listDriveSpreadsheets,
    syncFileFromDrive,
  };
}
