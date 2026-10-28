/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Upload, ChevronRight, ChevronDown, Building2, Download, Search, Filter, Lock, Unlock, User, FileSpreadsheet, AlertCircle, AlertTriangle, Check, Copy, Eye, EyeOff, Sparkles, Brain, RefreshCw, Globe, Server, FileText, ChevronsUpDown, ChevronsDownUp, Layers, X } from 'lucide-react';
import { useMasterPlan } from './hooks/useMasterPlan';
import { CronogramaTab } from './components/CronogramaTab';
import { PlanillaTab } from './components/PlanillaTab';
import { ComponenteResumen } from './components/ComponenteResumen';
import { ResumenFinanciero } from './components/ResumenFinanciero';
import { CaratulaTab } from './components/CaratulaTab';
import { PersonalTab } from './components/PersonalTab';
import { ProcesoTab } from './components/ProcesoTab';
import { MasterTab } from './components/MasterTab';
import { AIReportModal } from './components/AIReportModal';
import { LogoHoja } from './components/LogoHoja';
import { ClaveAdminDialog } from './components/ClaveAdminDialog';
import { construirDatosReporte, construirEjecutivo } from './utils/aiReportHelper';
import { reporteATexto } from './utils/reporteTexto';
import type { ReporteIA } from './types/reporteIA';
import { saveAIReportToCloud, loadAIReportFromCloud, AIReportData } from './utils/cloudSync';
import { apiFetch } from './utils/api';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const pc = useMasterPlan(isLoggedIn);
  const [username, setUsername] = React.useState('');
  // Proyecto de la pantalla de inicio (por ahora solo Los Merinos)
  const [proyecto, setProyecto] = React.useState('los-merinos');
  const [password, setPassword] = React.useState('');
  const [role, setRole] = React.useState<'admin' | 'viewer' | null>(null);
  const [isCheckingSession, setIsCheckingSession] = React.useState(true);
  const [showPassword, setShowPassword] = React.useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = React.useState(false);
  const [loginError, setLoginError] = React.useState('');
  const [dragOver, setDragOver] = React.useState(false);
  const [isGanttAIPanelOpen, setIsGanttAIPanelOpen] = React.useState(false);

  // El rol lo decide el servidor al iniciar sesión
  const isAdmin = isLoggedIn && role === 'admin';

  // Al abrir la app, recuperar la sesión si la cookie sigue vigente
  React.useEffect(() => {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(res => (res.ok ? res.json() : null))
      .then(user => {
        if (user) {
          setUsername(user.username);
          setRole(user.role);
          setIsLoggedIn(true);
        }
      })
      .catch(() => {})
      .finally(() => setIsCheckingSession(false));

    const onExpired = () => {
      setIsLoggedIn(false);
      setRole(null);
      setLoginError('Su sesión venció. Vuelva a iniciar sesión.');
    };
    window.addEventListener('trackerz:session-expired', onExpired);
    return () => window.removeEventListener('trackerz:session-expired', onExpired);
  }, []);

  // States for Admin verification of Sincronizacion/Actualizacion Nube and Cargar Otro Archivo
  const [isAdminUnlocked, setIsAdminUnlocked] = React.useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = React.useState('');
  const [isAdminCapsLockOn, setIsAdminCapsLockOn] = React.useState(false);
  const [isSyncMenuOpen, setIsSyncMenuOpen] = React.useState(false);
  const [adminError, setAdminError] = React.useState('');

  // States for AI Crono Report
  const [showAIReportMenu, setShowAIReportMenu] = React.useState(false);
  const [showAIReportModal, setShowAIReportModal] = React.useState(false);
  const [aiReportData, setAiReportData] = React.useState<AIReportData | null>(null);
  const [isGeneratingAIReport, setIsGeneratingAIReport] = React.useState(false);
  const aiMenuRef = React.useRef<HTMLDivElement>(null);

  // Optimization: Keep-Alive cache of visited tabs to eliminate render freeze when navigating
  const [visitedTabs, setVisitedTabs] = React.useState<Set<string>>(() => new Set(['caratula']));

  React.useEffect(() => {
    if (pc.activeTab) {
      setVisitedTabs(prev => {
        if (prev.has(pc.activeTab)) return prev;
        const next = new Set(prev);
        next.add(pc.activeTab);
        return next;
      });
    }
  }, [pc.activeTab]);

  // State for Avance Partidas Modal & Buscador WBS
  const [showAvancePartidasModal, setShowAvancePartidasModal] = React.useState(false);
  const [wbsSearchInput, setWbsSearchInput] = React.useState<string>('');
  const [wbsSearchTerm, setWbsSearchTerm] = React.useState<string>('');
  const [wbsSearchField, setWbsSearchField] = React.useState<'all' | 'name' | 'idOrig' | 'subc'>('all');

  const handleWbsSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setWbsSearchTerm(wbsSearchInput.trim());
  };

  const handleWbsSearchClear = () => {
    setWbsSearchInput('');
    setWbsSearchTerm('');
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showAvancePartidasModal) {
        setShowAvancePartidasModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAvancePartidasModal]);

  // Load latest AI report on mount or when plan changes
  const currentPlanId = pc.cloudPlanData?.planMeta?.id || 'latest_report';

  React.useEffect(() => {
    if (!isLoggedIn) return;
    async function fetchReport() {
      const data = await loadAIReportFromCloud(currentPlanId);
      if (data) {
        setAiReportData(data);
      }
    }
    fetchReport();
  }, [currentPlanId, isLoggedIn]);

  // Close AI menu on click outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (aiMenuRef.current && !aiMenuRef.current.contains(event.target as Node)) {
        setShowAIReportMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Generar o actualizar el reporte pide la contraseña del administrador
  const [claveReporte, setClaveReporte] = React.useState<{ abierto: boolean; error: string; verificando: boolean }>({ abierto: false, error: '', verificando: false });

  const handleGenerateAIReport = () => {
    if (!isAdmin) {
      alert('Solo el administrador de la obra está autorizado para generar o actualizar el reporte de Inteligencia Artificial.');
      return;
    }

    if (!pc.actividades || pc.actividades.length === 0) {
      alert('No hay datos de actividades cargados en el cronograma para analizar.');
      return;
    }

    setShowAIReportMenu(false);
    setClaveReporte({ abierto: true, error: '', verificando: false });
  };

  const confirmarClaveReporte = async (password: string) => {
    setClaveReporte(c => ({ ...c, verificando: true, error: '' }));
    try {
      await apiFetch('/api/auth/verify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
    } catch (err: any) {
      setClaveReporte({ abierto: true, verificando: false, error: err?.message || 'Contraseña incorrecta' });
      return;
    }
    setClaveReporte({ abierto: false, error: '', verificando: false });
    await generarReporteIA(password);
  };

  const generarReporteIA = async (password: string) => {
    setShowAIReportModal(true);
    setIsGeneratingAIReport(true);

    try {
      const { datos, contexto } = construirDatosReporte(pc.actividades, pc.fechaCorteState);
      datos.ejecutivo = construirEjecutivo(pc.stats, pc.planillaTotales);
      // El reporte anterior sirve para medir la evolución
      const previo = aiReportData?.reporte;
      const anterior = previo
        ? {
            fechaCorte: previo.datos.fechaCorte,
            generadoEn: aiReportData!.updatedAt,
            estadoGeneral: previo.analisis.estadoGeneral,
            kpis: previo.datos.kpis,
            obraAvance: previo.datos.ejecutivo?.obra.avance,
            certificacionAvance: previo.datos.ejecutivo?.certificacion?.avance,
          }
        : undefined;

      const res = await fetch('/api/ai/crono-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datos, contexto, anterior, password })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al comunicarse con el servicio de Inteligencia Artificial.');
      }

      const data = await res.json();
      const reporte: ReporteIA = { version: 2, datos, analisis: data.analisis, anterior, modelo: data.modelo };
      const newReport: AIReportData = {
        markdown: reporteATexto(reporte),
        updatedAt: data.generatedAt || new Date().toISOString(),
        updatedBy: username || 'Admin',
        summary: {
          total: datos.kpis.totalActividades,
          totalDelayed: datos.kpis.retrasadas,
          totalUpcoming: datos.kpis.proximas4Semanas,
          totalItemsCriticos10k: datos.kpis.partidasCriticas,
          totalMontoCritico10kUSD: datos.kpis.montoCritico,
        },
        reporte,
      };

      await saveAIReportToCloud(currentPlanId, newReport);
      setAiReportData(newReport);
    } catch (err: any) {
      console.error('Error al generar el reporte AI:', err);
      alert(`Error al generar el reporte: ${err.message || err}`);
    } finally {
      setIsGeneratingAIReport(false);
    }
  };

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/auth/verify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPasswordInput }),
      });
      setIsAdminUnlocked(true);
      setAdminError('');
    } catch (err: any) {
      setAdminError(err?.message || 'Contraseña incorrecta');
    }
  };


  const [smoothProgress, setSmoothProgress] = React.useState(0);
  const [isVisualLoading, setIsVisualLoading] = React.useState(false);
  const [smoothPhase, setSmoothPhase] = React.useState('');

  React.useEffect(() => {
    if (pc.loadingProgress > 0) {
      setIsVisualLoading(true);
    }
  }, [pc.loadingProgress]);

  React.useEffect(() => {
    if (!isVisualLoading) {
      setSmoothProgress(0);
      return;
    }

    let completionTimeout: any = null;

    const interval = setInterval(() => {
      setSmoothProgress((prev) => {
        const target = pc.loadingProgress;
        
        if (target === 0) {
          setIsVisualLoading(false);
          return 0;
        }

        if (prev < target) {
          let increment = 1;
          const distance = target - prev;
          
          if (distance > 50) {
            increment = 3;
          } else if (distance > 20) {
            increment = 1.8;
          } else {
            increment = 0.8;
          }

          const nextValue = Math.min(target, prev + increment);
          
          if (nextValue >= 100) {
            setSmoothPhase('¡Sincronización completa con la nube!');
            if (!completionTimeout) {
              completionTimeout = setTimeout(() => {
                setIsVisualLoading(false);
              }, 1200);
            }
          } else if (nextValue >= 75) {
            setSmoothPhase('Procesando y estructurando base de datos...');
          } else if (nextValue >= 40) {
            setSmoothPhase('Descargando e integrando última versión de nube...');
          } else if (nextValue >= 5) {
            setSmoothPhase('Conectando con la base de datos en la nube...');
          } else {
            setSmoothPhase('Iniciando proceso de carga...');
          }

          return nextValue;
        }

        if (prev >= 100) {
          setIsVisualLoading(false);
          return 100;
        }

        if (prev === target && target < 100) {
          return Math.min(target + 3, prev + 0.1); 
        }

        return prev;
      });
    }, 25);

    return () => {
      clearInterval(interval);
      if (completionTimeout) clearTimeout(completionTimeout);
    };
  }, [isVisualLoading, pc.loadingProgress]);

  const handleSearchKeyPressLocal = (e: React.KeyboardEvent<HTMLInputElement>) => {
    pc.handleSearchKeyPress(e);
  };

  const formattedMoney = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const [copiedJerarquico, setCopiedJerarquico] = React.useState<boolean>(false);

  const copiarReporteJerarquico = () => {
    const tsvRows: string[] = [];
    tsvRows.push(["Código", "Descripción", "V. Contrato", "V. Plan", "V. Ejecutada", "% Avance", "Saldo", "% Var"].join("\t"));

    const htmlRowsArray: string[] = [];

    const addRowHtml = (
      code: string,
      desc: string,
      vContrato: number,
      vPlan: number,
      vEjec: number,
      avancePct: number,
      saldo: number,
      pctVar: number,
      bg: string,
      fg: string,
      fontWeight: string = 'bold',
      fontSize: string = '11px',
      indentCount: number = 0
    ) => {
      const isPeriodSelected = pc.periodoSeleccionado && pc.periodoSeleccionado.anio !== 'TODOS';
      if (isPeriodSelected && vPlan <= 0 && vEjec <= 0) {
        return;
      }

      const avanceStr = `${avancePct.toFixed(2)}%`;
      const saldoStr = saldo < 0 ? `(${formattedMoney(Math.abs(saldo))})` : `${formattedMoney(saldo)}`;
      const saldoColor = saldo < 0 ? '#b91c1c' : '#15803d';
      const pctVarStr = pctVar < 0 ? `(${Math.abs(pctVar).toFixed(2)}%)` : (pctVar > 0 ? `+${pctVar.toFixed(2)}%` : '0.00%');
      const pctVarColor = pctVar < 0 ? '#b91c1c' : (pctVar > 0 ? '#15803d' : '#64748b');

      tsvRows.push([
        code,
        desc,
        formattedMoney(vContrato),
        formattedMoney(vPlan),
        formattedMoney(vEjec),
        avanceStr,
        formattedMoney(saldo),
        pctVarStr
      ].join("\t"));

      const indentSpaces = "&nbsp;".repeat(indentCount * 4);
      const paddingLeft = 8 + (indentCount * 14);

      htmlRowsArray.push(`
        <tr style="background-color: ${bg}; color: ${fg}; font-weight: ${fontWeight}; font-size: ${fontSize};">
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-family: monospace, Consolas, sans-serif; background-color: ${bg}; color: ${fg}; text-align: center; mso-number-format: '\\@';">${code}</td>
          <td style="padding: 6px 10px; padding-left: ${paddingLeft}px; border: 1px solid #cbd5e1; background-color: ${bg}; color: ${fg}; font-weight: ${fontWeight};">${indentSpaces}${desc}</td>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace, Consolas, sans-serif; background-color: ${bg}; color: ${fg}; font-weight: ${fontWeight}; mso-number-format: '\\$#,##0.00';">${formattedMoney(vContrato)}</td>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace, Consolas, sans-serif; background-color: ${bg}; color: ${fg === '#334155' ? '#1d4ed8' : fg}; font-weight: ${fontWeight}; mso-number-format: '\\$#,##0.00';">${formattedMoney(vPlan)}</td>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace, Consolas, sans-serif; background-color: ${bg}; color: ${fg === '#334155' ? '#15803d' : fg}; font-weight: ${fontWeight}; mso-number-format: '\\$#,##0.00';">${formattedMoney(vEjec)}</td>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace, Consolas, sans-serif; background-color: ${bg}; color: ${fg}; font-weight: ${fontWeight}; mso-number-format: '0.00%';">${avanceStr}</td>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace, Consolas, sans-serif; background-color: ${bg}; color: ${saldoColor}; font-weight: bold; mso-number-format: '\\$#,##0.00';">${saldoStr}</td>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace, Consolas, sans-serif; background-color: ${bg}; color: ${pctVarColor}; font-weight: bold; mso-number-format: '0.00%';">${pctVarStr}</td>
        </tr>
      `.trim());
    };

    const processItemNode = (item: any) => {
      if (wbsSearchResults.isActive && !wbsSearchResults.visibleItemIds.has(item.id)) {
        return;
      }

      const values = pc.calcularValoresReales(item);
      const avance = pc.calcularAvance(item);
      const baseParaVar = values.ventaPlan > 0 ? values.ventaPlan : values.venta;
      const pctVar = baseParaVar > 0 ? Number(((values.saldo / baseParaVar) * 100).toFixed(2)) : 0;
      const indentCount = Math.max(0, item.nivel - 1);

      let bg = '#ffffff';
      let fg = '#334155';
      let fontWeight = 'normal';
      let fontSize = '10px';

      if (!item.esItemHoja) {
        const level = item.nivel;
        fontWeight = 'bold';
        if (level <= 1) { bg = '#FBE5E5'; fg = '#7A0000'; fontSize = '11.5px'; } // Indigo
        else if (level === 2) { bg = '#e0f2fe'; fg = '#0369a1'; fontSize = '11px'; } // Sky
        else if (level === 3) { bg = '#d1fae5'; fg = '#065f46'; fontSize = '10.5px'; } // Emerald
        else if (level === 4) { bg = '#fef3c7'; fg = '#92400e'; fontSize = '10.5px'; } // Amber
        else if (level === 5) { bg = '#f3e8ff'; fg = '#6b21a8'; fontSize = '10px'; } // Purple
        else { bg = '#ffe4e6'; fg = '#9f1239'; fontSize = '10px'; } // Rose
      }

      addRowHtml(
        item.activityId || item.wbs || '',
        item.descripcion || '',
        values.venta || 0,
        values.ventaPlan || 0,
        values.ventaEjecutada || 0,
        avance,
        values.saldo || 0,
        pctVar,
        bg,
        fg,
        fontWeight,
        fontSize,
        indentCount
      );

      const hasChildren = !item.esItemHoja && (wbsHierarchyMaps.hasChildrenMap.get(item.id) || false);
      const isExpanded = pc.expandedItems.has(item.id) || pc.filterLevel !== 'all';

      if (hasChildren && isExpanded) {
        const leafChildren = (wbsHierarchyMaps.leafChildrenMap.get(item.id) || [])
          .filter(a => (!pc.tipologiaSeleccionada || a.tipo === pc.tipologiaSeleccionada) &&
                       (!pc.componenteSeleccionado || ((a.componente || '').trim() || 'Sin Componente') === pc.componenteSeleccionado) &&
                       (!wbsSearchResults.isActive || wbsSearchResults.visibleItemIds.has(a.id)));
        leafChildren.forEach(child => processItemNode(child));

        const nonLeafChildren = (wbsHierarchyMaps.nonLeafChildrenMap.get(item.id) || [])
          .filter(child => !wbsSearchResults.isActive || wbsSearchResults.visibleItemIds.has(child.id));
        nonLeafChildren.forEach(child => processItemNode(child));
      }
    };

    if (pc.filterLevel !== 'all') {
      const targetNivel = parseInt(pc.filterLevel, 10);
      pc.filteredActividades
        .filter(a => a.nivel === targetNivel && !a.esItemHoja && (!wbsSearchResults.isActive || wbsSearchResults.visibleItemIds.has(a.id)))
        .forEach(item => processItemNode(item));
    } else {
      pc.filteredActividades
        .filter(a => !a.esItemHoja && (!wbsHierarchyMaps.parentMap || !wbsHierarchyMaps.parentMap.has(a.id)) && (!wbsSearchResults.isActive || wbsSearchResults.visibleItemIds.has(a.id)))
        .forEach(item => processItemNode(item));
    }

    // TOTAL ROW
    if (pc.stats) {
      const stats = pc.stats;
      const totalVenta = stats.totalVenta;
      const totalVentaPlan = stats.totalVentaPlanPeriodo;
      const totalVentaEjecutada = stats.totalVentaEjecutadaPeriodo;
      const totalSaldo = stats.totalSaldoPeriodo;
      const totalAvance = totalVenta > 0 ? Number(((totalVentaEjecutada / totalVenta) * 100).toFixed(2)) : 0;
      const baseTotalVar = totalVentaPlan > 0 ? totalVentaPlan : totalVenta;
      const totalPctVar = baseTotalVar > 0 ? Number(((totalSaldo / baseTotalVar) * 100).toFixed(2)) : 0;

      addRowHtml(
        '-',
        'Total General',
        totalVenta,
        totalVentaPlan,
        totalVentaEjecutada,
        totalAvance,
        totalSaldo,
        totalPctVar,
        '#0f172a',
        '#ffffff',
        'bold',
        '11.5px',
        0
      );
    }

    const tsvContent = tsvRows.join("\n");
    const htmlRows = htmlRowsArray.join("\n");

    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <style>
          table { border-collapse: collapse; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1e293b; width: 100%; }
          th { background-color: #1e1b4b; color: #ffffff; font-weight: bold; padding: 8px 10px; border: 1px solid #64748b; text-align: left; }
          td { padding: 6px 10px; border: 1px solid #cbd5e1; vertical-align: middle; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr style="background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: left;">
              <th style="padding: 8px 10px; border: 1px solid #64748b; background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: center;">Código</th>
              <th style="padding: 8px 10px; border: 1px solid #64748b; background-color: #1e1b4b; color: #ffffff; font-weight: bold;">Descripción</th>
              <th style="padding: 8px 10px; border: 1px solid #64748b; background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: right;">V. Contrato</th>
              <th style="padding: 8px 10px; border: 1px solid #64748b; background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: right;">V. Plan</th>
              <th style="padding: 8px 10px; border: 1px solid #64748b; background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: right;">V. Ejecutada</th>
              <th style="padding: 8px 10px; border: 1px solid #64748b; background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: right;">% Avance</th>
              <th style="padding: 8px 10px; border: 1px solid #64748b; background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: right;">Saldo</th>
              <th style="padding: 8px 10px; border: 1px solid #64748b; background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: center;">% Var</th>
            </tr>
          </thead>
          <tbody>
            ${htmlRows}
          </tbody>
        </table>
      </body>
      </html>
    `.trim();

    try {
      const clipboardItem = new ClipboardItem({
        "text/plain": new Blob([tsvContent], { type: "text/plain" }),
        "text/html": new Blob([htmlContent], { type: "text/html" })
      });
      navigator.clipboard.write([clipboardItem]).then(() => {
        setCopiedJerarquico(true);
        setTimeout(() => setCopiedJerarquico(false), 2500);
      }).catch(() => {
        navigator.clipboard.writeText(tsvContent).then(() => {
          setCopiedJerarquico(true);
          setTimeout(() => setCopiedJerarquico(false), 2500);
        });
      });
    } catch (e) {
      navigator.clipboard.writeText(tsvContent).then(() => {
        setCopiedJerarquico(true);
        setTimeout(() => setCopiedJerarquico(false), 2500);
      });
    }
  };

  const cleanWbsStr = React.useCallback((w: string) => (w || '').replace(/^p\d*\.?/, ''), []);

  // Pre-calculate WBS parent-child relationships in O(N) using useMemo
  const wbsHierarchyMaps = React.useMemo(() => {
    const activities = pc.filteredActividades || pc.actividades || [];
    const hasChildrenMap = new Map<string, boolean>();
    const leafChildrenMap = new Map<string, any[]>();
    const nonLeafChildrenMap = new Map<string, any[]>();
    const parentMap = new Map<string, string>();

    if (activities.length === 0) {
      return { hasChildrenMap, leafChildrenMap, nonLeafChildrenMap, parentMap };
    }

    const nonLeaves = activities.filter(a => !a.esItemHoja);
    const nonLeafCleanMap = new Map<string, string>();
    nonLeaves.forEach(nl => {
      nonLeafCleanMap.set(nl.id, cleanWbsStr(nl.wbs));
    });

    activities.forEach(a => {
      const childWbsClean = cleanWbsStr(a.wbs);
      if (!childWbsClean) return;

      let bestParent: any = null;
      let maxParentLen = -1;

      for (let i = 0; i < nonLeaves.length; i++) {
        const p = nonLeaves[i];
        if (p.id === a.id) continue;
        const parentWbsClean = nonLeafCleanMap.get(p.id) || '';
        if (!parentWbsClean) continue;

        const isMatch = a.esItemHoja
          ? (childWbsClean === parentWbsClean || childWbsClean.startsWith(parentWbsClean + '.'))
          : (childWbsClean.startsWith(parentWbsClean + '.'));

        if (isMatch) {
          if (parentWbsClean.length > maxParentLen) {
            maxParentLen = parentWbsClean.length;
            bestParent = p;
          }
        }
      }

      if (bestParent) {
        hasChildrenMap.set(bestParent.id, true);
        parentMap.set(a.id, bestParent.id);

        if (a.esItemHoja) {
          if (!leafChildrenMap.has(bestParent.id)) leafChildrenMap.set(bestParent.id, []);
          leafChildrenMap.get(bestParent.id)!.push(a);
        } else {
          if (!nonLeafChildrenMap.has(bestParent.id)) nonLeafChildrenMap.set(bestParent.id, []);
          nonLeafChildrenMap.get(bestParent.id)!.push(a);
        }
      }
    });

    return { hasChildrenMap, leafChildrenMap, nonLeafChildrenMap, parentMap };
  }, [pc.filteredActividades, pc.actividades, cleanWbsStr]);

  const normalizeSearchText = (str: any) =>
    String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  // Memoized search filtering for Avance Partidas WBS hierarchy (Activity name, id.Orig, SubC)
  const wbsSearchResults = React.useMemo(() => {
    const q = normalizeSearchText(wbsSearchTerm);
    if (!q) {
      return {
        isActive: false,
        matchingItemIds: new Set<string>(),
        visibleItemIds: new Set<string>(),
        matchCount: 0,
      };
    }

    const activities = pc.filteredActividades || pc.actividades || [];
    const matchingItemIds = new Set<string>();
    const visibleItemIds = new Set<string>();

    const matchesFilter = (a: any): boolean => {
      const name = normalizeSearchText(a.descripcion);
      const actId = normalizeSearchText(a.activityId);
      const idOrig = normalizeSearchText(a.idOrig);
      const subc = normalizeSearchText(a.subcontratista);
      const wbs = normalizeSearchText(a.wbs);

      if (wbsSearchField === 'name') {
        return name.includes(q) || actId.includes(q);
      }
      if (wbsSearchField === 'idOrig') {
        return idOrig.includes(q);
      }
      if (wbsSearchField === 'subc') {
        return subc.includes(q);
      }
      // 'all': matches Activity name, id.Orig, or SubC (and WBS code)
      return (
        name.includes(q) ||
        actId.includes(q) ||
        idOrig.includes(q) ||
        subc.includes(q) ||
        wbs.includes(q)
      );
    };

    // 1. Identify directly matching items
    activities.forEach(a => {
      if (matchesFilter(a)) {
        matchingItemIds.add(a.id);
        visibleItemIds.add(a.id);
      }
    });

    // 2. Trace up the hierarchy to include all parent/ancestor nodes
    matchingItemIds.forEach(id => {
      let curr = id;
      while (wbsHierarchyMaps.parentMap.has(curr)) {
        const parentId = wbsHierarchyMaps.parentMap.get(curr)!;
        visibleItemIds.add(parentId);
        curr = parentId;
      }
    });

    // 3. If a non-leaf parent matches directly, also include its direct children
    activities.forEach(a => {
      if (!a.esItemHoja && matchingItemIds.has(a.id)) {
        const leafChildren = wbsHierarchyMaps.leafChildrenMap.get(a.id) || [];
        const nonLeafChildren = wbsHierarchyMaps.nonLeafChildrenMap.get(a.id) || [];
        leafChildren.forEach(c => visibleItemIds.add(c.id));
        nonLeafChildren.forEach(c => visibleItemIds.add(c.id));
      }
    });

    const leafMatchCount = activities.filter(a => a.esItemHoja && matchingItemIds.has(a.id)).length;
    const totalMatchCount = matchingItemIds.size;

    return {
      isActive: true,
      matchingItemIds,
      visibleItemIds,
      matchCount: leafMatchCount > 0 ? leafMatchCount : totalMatchCount,
    };
  }, [wbsSearchTerm, wbsSearchField, pc.filteredActividades, pc.actividades, wbsHierarchyMaps]);

  // Count of matching descendant items per non-leaf WBS node
  const descendantMatchCountMap = React.useMemo(() => {
    if (!wbsSearchResults.isActive) return new Map<string, number>();
    const map = new Map<string, number>();
    wbsSearchResults.matchingItemIds.forEach(id => {
      let curr = id;
      while (wbsHierarchyMaps.parentMap.has(curr)) {
        const pId = wbsHierarchyMaps.parentMap.get(curr)!;
        map.set(pId, (map.get(pId) || 0) + 1);
        curr = pId;
      }
    });
    return map;
  }, [wbsSearchResults, wbsHierarchyMaps.parentMap]);

  // Automatically unfold ancestors when user searches so matching items are immediately visible
  React.useEffect(() => {
    if (wbsSearchResults.isActive && wbsSearchResults.visibleItemIds.size > 0) {
      pc.setExpandedItems(prev => {
        const next = new Set(prev);
        wbsSearchResults.visibleItemIds.forEach(id => next.add(id));
        return next;
      });
    }
  }, [wbsSearchTerm, wbsSearchField, wbsSearchResults.isActive]);

  // Render a specific WBS activity row in the "Avance Partidas" (economico) tab
  const renderAvancePartidaRow = (item: any): React.ReactNode => {
    if (wbsSearchResults.isActive && !wbsSearchResults.visibleItemIds.has(item.id)) {
      return null;
    }

    const hasChildren = !item.esItemHoja && (wbsHierarchyMaps.hasChildrenMap.get(item.id) || false);

    const isExpanded = pc.expandedItems.has(item.id);
    const values = pc.calcularValoresReales(item);
    const avance = pc.calcularAvance(item);
    const baseParaVar = values.ventaPlan > 0 ? values.ventaPlan : values.venta;
    const pctVar = baseParaVar > 0 ? Number(((values.saldo / baseParaVar) * 100).toFixed(2)) : 0;

    // Filter out rows/cards that have both Plan and Ejecutado as zero for the selected period
    const isPeriodSelected = pc.periodoSeleccionado && pc.periodoSeleccionado.anio !== 'TODOS';
    if (isPeriodSelected) {
      if ((values.ventaPlan || 0) <= 0 && (values.ventaEjecutada || 0) <= 0) {
        return null;
      }
    }
    
    const isLeaf = item.esItemHoja;
    const level = item.nivel || 1;
    
    // Corporate Fun hierarchical color palettes and styling
    let rowBg = '';
    let textStyle = '';
    let badgeStyle = '';
    let chevronStyle = '';
    let progressBarColor = '';
    let leftAccent = '';
    
    if (!isLeaf) {
      if (level <= 1) {
        // Nivel 1: Deep Royal Indigo
        rowBg = 'bg-gradient-to-r from-indigo-100/85 via-indigo-50/50 to-white hover:from-indigo-100 hover:to-indigo-50/80 border-b border-indigo-200/90';
        leftAccent = 'border-l-[5px] border-indigo-600';
        textStyle = 'font-black text-indigo-950 text-[12.5px] tracking-tight';
        badgeStyle = 'bg-indigo-600 text-white shadow-xs font-black text-[10px]';
        chevronStyle = 'bg-indigo-200/70 text-indigo-800 hover:bg-indigo-300';
        progressBarColor = 'bg-indigo-600';
      } else if (level === 2) {
        // Nivel 2: Ocean Sky Blue
        rowBg = 'bg-gradient-to-r from-sky-100/75 via-sky-50/40 to-white hover:from-sky-100 hover:to-sky-50/70 border-b border-sky-200/80';
        leftAccent = 'border-l-[4px] border-sky-500';
        textStyle = 'font-bold text-sky-950 text-[12px]';
        badgeStyle = 'bg-sky-500 text-white shadow-xs font-bold text-[9.5px]';
        chevronStyle = 'bg-sky-200/70 text-sky-800 hover:bg-sky-300';
        progressBarColor = 'bg-sky-500';
      } else if (level === 3) {
        // Nivel 3: Fresh Mint / Emerald
        rowBg = 'bg-gradient-to-r from-emerald-100/70 via-emerald-50/40 to-white hover:from-emerald-100 hover:to-emerald-50/60 border-b border-emerald-200/70';
        leftAccent = 'border-l-[4px] border-emerald-500';
        textStyle = 'font-bold text-emerald-950 text-[11.5px]';
        badgeStyle = 'bg-emerald-600 text-white shadow-xs font-bold text-[9px]';
        chevronStyle = 'bg-emerald-200/70 text-emerald-800 hover:bg-emerald-300';
        progressBarColor = 'bg-emerald-500';
      } else if (level === 4) {
        // Nivel 4: Warm Tangerine / Amber
        rowBg = 'bg-gradient-to-r from-amber-100/70 via-amber-50/40 to-white hover:from-amber-100 hover:to-amber-50/60 border-b border-amber-200/70';
        leftAccent = 'border-l-[4px] border-amber-500';
        textStyle = 'font-semibold text-amber-950 text-[11.5px]';
        badgeStyle = 'bg-amber-500 text-white shadow-xs font-bold text-[9px]';
        chevronStyle = 'bg-amber-200/70 text-amber-900 hover:bg-amber-300';
        progressBarColor = 'bg-amber-500';
      } else if (level === 5) {
        // Nivel 5: Playful Violet / Purple
        rowBg = 'bg-gradient-to-r from-purple-100/65 via-purple-50/35 to-white hover:from-purple-100 hover:to-purple-50/50 border-b border-purple-200/60';
        leftAccent = 'border-l-[4px] border-purple-500';
        textStyle = 'font-semibold text-purple-950 text-[11px]';
        badgeStyle = 'bg-purple-600 text-white shadow-xs font-bold text-[9px]';
        chevronStyle = 'bg-purple-200/70 text-purple-900 hover:bg-purple-300';
        progressBarColor = 'bg-purple-500';
      } else {
        // Nivel 6+: Berry Rose / Coral
        rowBg = 'bg-gradient-to-r from-rose-100/60 via-rose-50/30 to-white hover:from-rose-100 hover:to-rose-50/40 border-b border-rose-200/60';
        leftAccent = 'border-l-[4px] border-rose-500';
        textStyle = 'font-semibold text-rose-950 text-[11px]';
        badgeStyle = 'bg-rose-500 text-white shadow-xs font-bold text-[9px]';
        chevronStyle = 'bg-rose-200/70 text-rose-900 hover:bg-rose-300';
        progressBarColor = 'bg-rose-500';
      }
    } else {
      rowBg = 'bg-white hover:bg-slate-50/90 border-b border-slate-100/80';
      leftAccent = 'border-l-[3px] border-slate-200/70';
      textStyle = 'text-slate-700 text-[11.5px] font-medium';
      badgeStyle = '';
      chevronStyle = '';
      progressBarColor = 'bg-emerald-500';
    }

    const indentPadding = 8 + (level - 1) * 16;
    const isDirectMatch = wbsSearchResults.isActive && wbsSearchResults.matchingItemIds.has(item.id);

    return (
      <div key={item.id} className={`transition-colors group ${isDirectMatch && isLeaf ? 'ring-1 ring-inset ring-indigo-400/50 bg-indigo-50/20' : ''}`}>
        <div
          className={`flex items-center py-2 px-3 cursor-pointer transition-colors ${rowBg} ${leftAccent}`}
          style={{ paddingLeft: `${indentPadding}px` }}
          onClick={() => {
            if (hasChildren) pc.toggleExpand(item.id);
          }}
        >
          {/* Expander Chevron or Leaf Bullet */}
          <div className="flex-shrink-0 w-6 flex justify-center items-center">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  pc.toggleExpand(item.id);
                }}
                className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors cursor-pointer ${chevronStyle}`}
                title={isExpanded ? 'Colapsar partida' : 'Expandir partida'}
              >
                <ChevronRight
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isExpanded ? 'rotate-90' : ''
                  }`}
                />
              </button>
            ) : isLeaf ? (
              <div className="w-5 h-5 flex items-center justify-center">
                <span className={`w-1.5 h-1.5 rounded-full transition-colors ${isDirectMatch ? 'bg-indigo-600 scale-125' : 'bg-slate-300 group-hover:bg-indigo-500'}`} />
              </div>
            ) : (
              <div className="w-5 h-5" />
            )}
          </div>
          
          <div className="flex-1 grid gap-2 items-center" style={{ gridTemplateColumns: '85px minmax(240px, 2fr) 1.2fr 1.2fr 1.2fr 1.4fr 1.2fr 80px' }}>
            {/* Código / ID */}
            <div className="text-center font-mono text-[10.5px]">
              {isLeaf ? (
                <span className="bg-slate-100 text-slate-700 font-mono font-bold px-1.5 py-0.5 rounded border border-slate-200/80 text-[10px]">
                  {item.activityId || '-'}
                </span>
              ) : (
                <span className="text-slate-500 font-medium font-mono text-[10px]">{item.wbs || '-'}</span>
              )}
            </div>

            {/* Descripción WBS / Partida */}
            <div className="min-w-0 pr-2">
              <div className="flex items-center gap-1.5 overflow-hidden">
                {!isLeaf && (
                  <span className={`font-mono px-1.5 py-0.5 rounded-md shrink-0 ${badgeStyle}`}>
                    {item.wbs}
                  </span>
                )}
                <span 
                  className={`truncate ${textStyle}`} 
                  title={[item.descripcion, item.idOrig ? `id.Orig: ${item.idOrig}` : '', item.subcontratista ? `SubC: ${item.subcontratista}` : '', item.componente ? `Componente: ${item.componente}` : ''].filter(Boolean).join(' | ')}
                >
                  {item.descripcion}
                </span>
                {!isLeaf && wbsSearchResults.isActive && descendantMatchCountMap.has(item.id) && (
                  <span className="text-[9px] font-bold text-indigo-700 bg-indigo-100/90 border border-indigo-200 px-1.5 py-0.2 rounded-full shrink-0 shadow-2xs">
                    {descendantMatchCountMap.get(item.id)} {descendantMatchCountMap.get(item.id) === 1 ? 'partida' : 'partidas'}
                  </span>
                )}
                {isDirectMatch && isLeaf && (
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full shrink-0 shadow-2xs">
                    Coincidencia
                  </span>
                )}
              </div>
            </div>
            
            {/* V. Contrato */}
            <div className="text-right font-mono text-[11.5px] text-slate-700 font-medium">
              {formattedMoney(values.venta)}
            </div>

            {/* V. Plan */}
            <div className="text-right font-mono text-[11.5px] text-indigo-700 font-semibold">
              {formattedMoney(values.ventaPlan)}
            </div>

            {/* V. Ejecutada */}
            <div className="text-right font-mono text-[11.5px] text-emerald-700 font-bold">
              {formattedMoney(values.ventaEjecutada)}
            </div>
            
            {/* % Avance */}
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5">
                <span className={`font-mono font-bold text-[11px] w-12 text-right ${
                  avance >= 100 ? 'text-emerald-700' : avance >= 50 ? 'text-indigo-700' : avance > 0 ? 'text-amber-700' : 'text-slate-400'
                }`}>
                  {avance.toFixed(2)}%
                </span>
                <div className="w-12 sm:w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0 border border-slate-200/60">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      avance >= 100 ? 'bg-emerald-500' : isLeaf ? (avance >= 50 ? 'bg-indigo-500' : avance > 0 ? 'bg-amber-500' : 'bg-slate-300') : progressBarColor
                    }`}
                    style={{ width: `${Math.min(avance, 100)}%` }}
                  />
                </div>
              </div>
            </div>
            
            {/* Saldo / Excedente */}
            <div className="text-right font-mono text-[11.5px]">
              {values.saldo < 0 ? (
                <span className="text-rose-600 font-bold">
                  ({formattedMoney(Math.abs(values.saldo))})
                </span>
              ) : (
                <span className="text-indigo-950 font-semibold">
                  {formattedMoney(values.saldo)}
                </span>
              )}
            </div>

            {/* % Var */}
            <div className="text-right font-mono text-[11px]">
              {pctVar < 0 ? (
                <span className="text-rose-600 font-bold" title={`Variación negativa: ${pctVar.toFixed(2)}%`}>
                  ({Math.abs(pctVar).toFixed(2)}%)
                </span>
              ) : pctVar > 0 ? (
                <span className="text-emerald-700 font-bold" title={`Variación positiva: +${pctVar.toFixed(2)}%`}>
                  +{pctVar.toFixed(2)}%
                </span>
              ) : (
                <span className="text-slate-400 font-medium">0.00%</span>
              )}
            </div>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {(wbsHierarchyMaps.leafChildrenMap.get(item.id) || [])
              .filter(a => (!pc.tipologiaSeleccionada || a.tipo === pc.tipologiaSeleccionada) &&
                           (!pc.componenteSeleccionado || ((a.componente || '').trim() || 'Sin Componente') === pc.componenteSeleccionado) &&
                           (!wbsSearchResults.isActive || wbsSearchResults.visibleItemIds.has(a.id)))
              .map(child => renderAvancePartidaRow(child))}

            {(wbsHierarchyMaps.nonLeafChildrenMap.get(item.id) || [])
              .filter(child => !wbsSearchResults.isActive || wbsSearchResults.visibleItemIds.has(child.id))
              .map(child => renderAvancePartidaRow(child))}
          </div>
        )}
      </div>
    );
  };

  const [isLoggingIn, setIsLoggingIn] = React.useState(false);
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setLoginError(data.error || 'No se pudo iniciar sesión.');
        return;
      }
      setUsername(data.username);
      setRole(data.role);
      setPassword('');
      setLoginError('');
      setIsLoggedIn(true);
    } catch {
      setLoginError('No se pudo conectar con el servidor.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    setIsLoggedIn(false);
    setRole(null);
    setIsAdminUnlocked(false);
    setAdminPasswordInput('');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const fakeEvent = {
          target: {
            files: [file]
          }
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        pc.handleFileUpload(fakeEvent);
      }
    }
  };

  // Mientras se comprueba si hay una sesión abierta, no mostrar nada.
  if (isCheckingSession) {
    return <div className="min-h-screen bg-slate-50/50" />;
  }

  // If not logged in, show custom elegant Landing login page.
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50/50 text-slate-800 flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden font-sans" 
           style={{ backgroundImage: 'radial-gradient(circle at top right, rgba(99, 102, 241, 0.05), transparent 50%), radial-gradient(circle at bottom left, rgba(79, 70, 229, 0.03), transparent 60%)' }}>
        
        <div className="max-w-4xl w-full flex flex-col gap-5">
          {/* Beautiful Explicit Landing Progress Bar justo arriba de la tarjeta */}
          {isVisualLoading && (
            <div id="loader-bar-landing-card" className="w-full bg-white border border-[#F3D6D6] rounded-2xl p-5 shadow-lg shadow-[#CD0000]/5 animate-fade-in flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#CD0000]/50 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#CD0000]"></span>
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider text-[#CD0000]">
                    ☁️ {smoothPhase || 'Sincronizando con la nube...'}
                  </span>
                </div>
                <span className="text-sm font-black text-[#CD0000] bg-[#FDF0F0] px-2 py-0.5 rounded-lg border border-[#F3D6D6]">
                  {Math.round(smoothProgress)}%
                </span>
              </div>
              
              <div className="w-full h-3 bg-neutral-50/80 rounded-full overflow-hidden border border-slate-200/50 p-0.5 animate-pulse">
                <div 
                  className="h-full bg-gradient-to-r from-[#E53935] to-[#CD0000] rounded-full transition-all duration-300 ease-out shadow-mini" 
                  style={{ width: `${smoothProgress}%` }} 
                />
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-400 font-extrabold px-1">
                <span className={smoothProgress >= 5 ? "text-[#CD0000] transition-colors duration-200 font-black" : ""}>🔌 Conectando</span>
                <span className={smoothProgress >= 40 ? "text-[#CD0000] transition-colors duration-200 font-black" : ""}>📥 Descargando</span>
                <span className={smoothProgress >= 75 ? "text-[#CD0000] transition-colors duration-200 font-black" : ""}>⚡ Procesando</span>
                <span className={smoothProgress >= 98 || smoothProgress === 100 ? "text-emerald-600 transition-colors duration-200 font-black" : ""}>🎉 Finalizado</span>
              </div>
            </div>
          )}

          <div className="bg-white rounded-3xl border border-indigo-100/80 overflow-hidden shadow-[0_15px_40px_rgba(15,23,42,0.06)] grid md:grid-cols-12 min-h-[520px]">
          
          {/* Brand/Showcase column */}
          <div className="md:col-span-5 bg-white p-8 md:p-12 flex flex-col justify-between items-center text-center border-r border-slate-100">
            <div className="my-auto space-y-4 flex flex-col items-center">
              <LogoHoja className="h-24 animate-fade-in" />
              <span className="block text-[32px] leading-none font-extrabold tracking-tight text-slate-900 font-sans">Trakciona</span>
            </div>

            <div className="pt-6 border-t border-slate-100 w-full">
              <p className="text-slate-400 text-[10px] font-mono uppercase tracking-wider">
                May.2026
              </p>
            </div>
          </div>

          {/* Form column */}
          <div className="md:col-span-7 p-8 md:p-12 flex flex-col justify-center bg-white">
            <form onSubmit={handleLoginSubmit} className="space-y-6">
              <div className="space-y-1.5">
                <p className="text-sm text-slate-800 font-extrabold tracking-tight">Acceso de Control</p>
                <p className="text-xs text-slate-500 font-medium leading-normal">Por favor, inicie sesión para acceder a las herramientas de control.</p>
              </div>

              {loginError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs animate-shake">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                  <span>{loginError}</span>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="login-proyecto" className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 select-none">
                    <Building2 className="w-3.5 h-3.5 text-[#CD0000]" />
                    Proyecto
                  </label>
                  <div className="relative">
                    <select
                      id="login-proyecto"
                      value={proyecto}
                      onChange={(e) => setProyecto(e.target.value)}
                      className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-11 py-3.5 text-sm font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all cursor-pointer"
                    >
                      <option value="los-merinos">Los Merinos</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 select-none">
                    <User className="w-3.5 h-3.5 text-[#CD0000]" />
                    Usuario
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                      placeholder="Ej. admin"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 select-none">
                      <Lock className="w-3.5 h-3.5 text-[#CD0000]" />
                      Contraseña
                    </label>
                    {isCapsLockOn && (
                      <span className="text-[10px] text-amber-700 bg-amber-50 font-extrabold px-2 py-0.5 rounded-md border border-amber-200/80 flex items-center gap-1 animate-pulse">
                        <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                        BLOQ MAYÚS ACTIVADO
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => setIsCapsLockOn(e.getModifierState('CapsLock'))}
                      onKeyUp={(e) => setIsCapsLockOn(e.getModifierState('CapsLock'))}
                      onClick={(e) => setIsCapsLockOn(e.getModifierState('CapsLock'))}
                      onFocus={(e) => { if ('getModifierState' in e) setIsCapsLockOn((e as any).getModifierState('CapsLock')); }}
                      onBlur={() => setIsCapsLockOn(false)}
                      className={`w-full bg-slate-50 border ${isCapsLockOn ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200'} rounded-xl pl-4 pr-12 py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all`}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg transition-colors focus:outline-none"
                      title={showPassword ? "Ocultar Contraseña" : "Mostrar Contraseña"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {isCapsLockOn && (
                    <div className="flex items-center gap-1.5 text-amber-800 bg-amber-50/90 border border-amber-200/90 px-3 py-1.5 rounded-xl text-[11px] font-semibold animate-fade-in shadow-xs">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Mayúsculas activadas. Verifique la contraseña antes de ingresar.</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full disabled:opacity-60 bg-[#CD0000] hover:bg-[#B30000] active:bg-[#990000] text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-[#CD0000]/15 hover:shadow-[#CD0000]/25 font-sans tracking-tight cursor-pointer"
              >
                {isLoggingIn ? 'Ingresando...' : 'Ingresar a la Plataforma'}
              </button>

            </form>
          </div>
        </div>

        </div>
      </div>
    );
  }

  const renderAvancePartidasContent = () => (
    <div id="avance-partidas-tab" className="space-y-4 animate-fade-in">
      <ResumenFinanciero
        stats={pc.stats}
        baseVenta={pc.baseVenta}
        setBaseVenta={pc.setBaseVenta}
        periodoSeleccionado={pc.periodoSeleccionado}
        setPeriodoSeleccionado={pc.setPeriodoSeleccionado}
        mapaColumnasMes={pc.mapaColumnasMes}
        exportarAvancePeriodo={pc.exportarAvancePeriodo}
      />
      
      <ComponenteResumen 
        stats={pc.stats} 
        componenteSeleccionado={pc.componenteSeleccionado} 
        setComponenteSeleccionado={pc.setComponenteSeleccionado} 
      />
      
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 space-y-4">
        {/* Header Toolbar */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3.5 flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shadow-2xs shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                  Avance de Partidas Estructurales
                </h2>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-full">
                  Jerarquía WBS
                </span>
                {pc.componenteSeleccionado && (
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-2xs">
                    <span>Filtro:</span>
                    <span className="font-extrabold max-w-[150px] truncate">{pc.componenteSeleccionado}</span>
                    <button
                      type="button"
                      onClick={() => pc.setComponenteSeleccionado(null)}
                      className="text-blue-500 hover:text-rose-600 font-black cursor-pointer ml-0.5"
                      title="Quitar filtro de componente"
                    >
                      ✕
                    </button>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Consolidación jerárquica acumulada por niveles WBS y control de avance económico
              </p>
            </div>
          </div>

          {/* Actions toolbar */}
          <div className="flex gap-2 items-center text-xs flex-wrap">
            <button
              type="button"
              onClick={copiarReporteJerarquico}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95 shrink-0"
              title="Copiar reporte jerárquico de la vista actual (HTML con formato y colores para Excel/Word)"
            >
              {copiedJerarquico ? (
                <>
                  <Check className="w-3.5 h-3.5 text-indigo-200" />
                  <span>¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-indigo-150" />
                  <span>Copiar Reporte</span>
                </>
              )}
            </button>

            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50/70 p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  const allParentIds = pc.actividades.filter(a => !a.esItemHoja).map(a => a.id);
                  pc.setExpandedItems(new Set(allParentIds));
                }}
                className="px-2.5 py-1 text-slate-700 hover:bg-white hover:text-indigo-700 font-semibold text-[11px] rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                title="Expandir todas las partidas de la jerarquía"
              >
                <ChevronsUpDown className="w-3.5 h-3.5 text-indigo-600" />
                <span>Expandir</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  pc.setExpandedItems(new Set());
                }}
                className="px-2.5 py-1 text-slate-700 hover:bg-white hover:text-indigo-700 font-semibold text-[11px] rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                title="Colapsar todas las partidas de la jerarquía"
              >
                <ChevronsDownUp className="w-3.5 h-3.5 text-indigo-600" />
                <span>Colapsar</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500">Nivel:</span>
              <select 
                value={pc.filterLevel} 
                onChange={e => pc.setFilterLevel(e.target.value)} 
                className="border border-slate-200 bg-white px-2.5 py-1.5 rounded-xl font-medium text-slate-700 text-xs outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer"
              >
                <option value="all">Todos los Niveles</option>
                {Array.from(new Set(pc.actividades.filter(a => !a.esItemHoja).map(a => a.nivel)))
                  .filter(n => typeof n === 'number' && !isNaN(n) && n >= 2)
                  .sort((a, b) => Number(a) - Number(b))
                  .map(lvl => (
                    <option key={lvl} value={String(lvl)}>Nivel {lvl}</option>
                  ))
                }
              </select>
            </div>
          </div>
        </div>

        {/* Buscador de Partidas Estructurales (Activity name, id.Orig, SubC) - Búsqueda por Enter */}
        <div className="flex items-center justify-between gap-2.5 flex-wrap bg-slate-50/90 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 shadow-2xs">
          <form onSubmit={handleWbsSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                id="wbs-search-input"
                type="text"
                value={wbsSearchInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setWbsSearchInput(val);
                  if (val === '' && wbsSearchTerm !== '') {
                    setWbsSearchTerm('');
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleWbsSearchSubmit();
                  }
                }}
                placeholder="Buscar por Activity name, id.Orig, SubC (Presiona Enter ↵)..."
                className="w-full pl-9 pr-14 py-1.5 text-xs bg-white border border-slate-200 rounded-xl font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-2xs transition-all"
              />
              <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
                {wbsSearchInput && (
                  <button
                    id="wbs-search-clear-btn"
                    type="button"
                    onClick={handleWbsSearchClear}
                    className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                    title="Limpiar búsqueda"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <kbd className="hidden sm:inline-block text-[10px] text-slate-400 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded font-mono select-none" title="Presiona Enter para buscar">
                  ↵
                </kbd>
              </div>
            </div>

            {/* Botón Buscar */}
            <button
              type="submit"
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer shrink-0 active:scale-95 flex items-center gap-1.5"
              title="Buscar (o presiona Enter)"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Buscar</span>
            </button>

            {/* Selector de campo de búsqueda */}
            <div className="flex items-center gap-1 shrink-0">
              <select
                id="wbs-search-field-select"
                value={wbsSearchField}
                onChange={(e) => {
                  const newField = e.target.value as any;
                  setWbsSearchField(newField);
                  if (wbsSearchInput.trim()) {
                    setWbsSearchTerm(wbsSearchInput.trim());
                  }
                }}
                className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer"
                title="Filtrar por campo específico"
              >
                <option value="all">🔍 Todos (Nombre, id.Orig, SubC)</option>
                <option value="name">📝 Activity name / Descripción</option>
                <option value="idOrig">🔢 id.Orig</option>
                <option value="subc">👷 SubC (Subcontratista)</option>
              </select>
            </div>
          </form>

          {/* Contador y estado */}
          <div className="flex items-center gap-2">
            {wbsSearchResults.isActive ? (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs">
                  <span>{wbsSearchResults.matchCount.toLocaleString()}</span>
                  <span>{wbsSearchResults.matchCount === 1 ? 'partida encontrada' : 'partidas encontradas'}</span>
                </span>
                <button
                  type="button"
                  onClick={handleWbsSearchClear}
                  className="px-2 py-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  Limpiar
                </button>
              </div>
            ) : (
              <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                Escribe y presiona <strong className="text-slate-600 font-bold">Enter ↵</strong> para buscar
              </span>
            )}
          </div>
        </div>

        {/* Table Container with Horizontal Scroll */}
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-2xs">
          <div className="min-w-[940px]">
            {/* Table headers */}
            <div className="bg-slate-50/90 border-b border-slate-200 px-3 py-2.5">
              <div className="flex items-center text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                <div className="w-6 flex-shrink-0"></div>
                <div className="flex-1 grid gap-2 items-center" style={{ gridTemplateColumns: '85px minmax(240px, 2fr) 1.2fr 1.2fr 1.2fr 1.4fr 1.2fr 80px' }}>
                  <div className="text-center font-bold">Código</div>
                  <div className="text-left font-bold">Descripción WBS / Partida</div>
                  <div className="text-right font-bold">V. Contrato</div>
                  <div className="text-right font-bold">V. Plan</div>
                  <div className="text-right font-bold">V. Ejecutada</div>
                  <div className="text-right font-bold">% Avance</div>
                  <div className="text-right font-bold">Saldo</div>
                  <div className="text-right font-bold">% Var</div>
                </div>
              </div>
            </div>

            {/* Table rows list */}
            <div className="divide-y divide-slate-100/80">
              {(() => {
                let roots: any[] = [];
                if (pc.filterLevel !== 'all') {
                  const targetNivel = parseInt(pc.filterLevel, 10);
                  roots = pc.filteredActividades.filter(a => a.nivel === targetNivel && !a.esItemHoja);
                } else {
                  roots = pc.filteredActividades.filter(a => !a.esItemHoja && (!wbsHierarchyMaps.parentMap || !wbsHierarchyMaps.parentMap.has(a.id)));
                }

                if (wbsSearchResults.isActive) {
                  roots = roots.filter(a => wbsSearchResults.visibleItemIds.has(a.id));
                }

                if (roots.length === 0) {
                  return (
                    <div className="py-12 px-4 text-center text-slate-500">
                      <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <Search className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-bold text-slate-700">No se encontraron partidas</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                        No hay coincidencias para "{wbsSearchTerm}" en {
                          wbsSearchField === 'all' ? 'Activity name, id.Orig o SubC' :
                          wbsSearchField === 'name' ? 'Activity name / Descripción' :
                          wbsSearchField === 'idOrig' ? 'id.Orig' : 'SubC (Subcontratista)'
                        }.
                      </p>
                      <button
                        type="button"
                        onClick={handleWbsSearchClear}
                        className="mt-3 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200/80 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Limpiar búsqueda</span>
                      </button>
                    </div>
                  );
                }

                return roots.map(item => renderAvancePartidaRow(item));
              })()}
            </div>

            {/* Sticky Table Footer (Total General) */}
            {(() => {
              const stats = pc.stats;
              if (!stats) return null;

              const contratoTotal = pc.actividades.filter(a => a.esItemHoja).reduce((sum, a) => sum + (a.ventaM || 0), 0);
              const totalVenta = stats.totalVenta;
              const totalVentaPlan = stats.totalVentaPlanPeriodo;
              const totalVentaEjecutada = stats.totalVentaEjecutadaPeriodo;
              const totalSaldo = stats.totalSaldoPeriodo;
              const totalAvance = totalVenta > 0 ? Number(((totalVentaEjecutada / totalVenta) * 100).toFixed(2)) : 0;
              const baseTotalVar = totalVentaPlan > 0 ? totalVentaPlan : (totalVenta > 0 ? totalVenta : contratoTotal);
              const totalPctVar = baseTotalVar > 0 ? Number(((totalSaldo / baseTotalVar) * 100).toFixed(2)) : 0;

              return (
                <div className="border-t-2 border-slate-300 bg-slate-900 text-white font-bold sticky bottom-0 z-10 shadow-lg">
                  <div className="flex items-center py-2.5 px-3">
                    <div className="flex-shrink-0 font-black text-indigo-400 uppercase text-[10px] tracking-wider w-6 text-center">
                      Σ
                    </div>
                    
                    <div className="flex-1 grid gap-2 items-center" style={{ gridTemplateColumns: '85px minmax(240px, 2fr) 1.2fr 1.2fr 1.2fr 1.4fr 1.2fr 80px' }}>
                      <div className="text-center font-mono text-slate-400 text-xs">-</div>
                      <div>
                        <div className="font-extrabold text-white text-[12px] tracking-tight">Total Consolidado</div>
                        <div className="text-[10px] text-slate-400 font-normal">{pc.actividades.length.toLocaleString('es-ES')} líneas en catálogo</div>
                      </div>
                      
                      <div className="text-right font-mono font-bold text-slate-200 text-[11.5px]">
                        {totalVenta.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-right font-mono font-bold text-indigo-300 text-[11.5px]">
                        {totalVentaPlan.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-right font-mono font-black text-emerald-400 text-[11.5px]">
                        {totalVentaEjecutada.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-mono font-black text-white text-[11.5px] w-12 text-right">{totalAvance.toFixed(2)}%</span>
                          <div className="w-12 sm:w-14 h-1.5 bg-slate-800 rounded-full overflow-hidden shrink-0 border border-slate-700">
                            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.min(totalAvance, 100)}%` }} />
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right font-mono font-bold text-[11.5px]">
                        {totalSaldo < 0 ? (
                          <span className="text-rose-400">
                            ({Math.abs(totalSaldo).toLocaleString('en-US', { minimumFractionDigits: 2 })})
                          </span>
                        ) : (
                          <span className="text-emerald-300">
                            {totalSaldo.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                      
                      <div className="text-right font-mono font-bold text-[11.5px]">
                        {totalPctVar < 0 ? (
                          <span className="text-rose-400">({Math.abs(totalPctVar).toFixed(2)}%)</span>
                        ) : totalPctVar > 0 ? (
                          <span className="text-emerald-300">+{totalPctVar.toFixed(2)}%</span>
                        ) : (
                          <span className="text-slate-400">0.00%</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div id="master-app-root" className="min-h-screen bg-[#EEF2F3] text-[#14212A] p-4 sm:p-6 font-['IBM_Plex_Sans',sans-serif]">
      {isVisualLoading && pc.fileData && (
        <div id="loader-bar-floating" className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md border-b border-[#D5DEE2] animate-fade-in">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#CD0000]/50 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#CD0000]"></span>
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-[#CD0000]">{smoothPhase || pc.loadingPhase || 'Cargando datos...'}</span>
              </div>
              <span className="text-sm font-bold text-[#CD0000] bg-[#FDF0F0] px-2 py-0.5 rounded-lg border border-[#F3D6D6]">{Math.round(smoothProgress)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-[#D5DEE2] p-0.5 animate-pulse">
              <div className="h-full bg-gradient-to-r from-[#E53935] to-[#CD0000] rounded-full transition-all duration-300 ease-out" style={{ width: `${smoothProgress}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-5">
         {/* Navigation / Header */}
        <div className="flex justify-between items-center bg-white rounded-xl shadow-2xs border border-[#D5DEE2] p-4 sm:p-5 flex-wrap gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center shadow-xs ring-1 ring-[#F3D6D6]">
              <LogoHoja className="h-8" />
            </div>
            <div>
              <h1 className="font-['Barlow_Condensed'] text-2xl sm:text-[26px] font-bold text-[#14212A] tracking-tight leading-none">
                Trakciona
                <span className="ml-2 font-sans text-[13px] font-medium text-[#5A6A74] tracking-normal align-middle">Los Merinos</span>
              </h1>
              <div className="flex flex-col gap-1.5 mt-1">
                {pc.fileData && pc.fileData.isCloud ? (
                  <span className="px-2.5 py-0.5 bg-[#FBE9E9] text-[#CD0000] rounded text-[11px] font-semibold border border-[#CD0000]/30 inline-flex items-center gap-1.5 self-start animate-fade-in">
                    ☁️ Datos en la Nube Activos
                  </span>
                ) : pc.fileData && isAdmin ? (
                  <span className="px-2.5 py-0.5 bg-[#F6E9D3] text-[#A86B12] rounded text-[11px] font-semibold border border-[#A86B12]/30 inline-flex items-center gap-1.5 self-start animate-fade-in">
                    💻 Vista Preliminar (Local)
                  </span>
                ) : isAdmin ? (
                  <span className="px-2.5 py-0.5 bg-[#F5F8F9] text-[#5A6A74] rounded text-[11px] font-semibold border border-[#D5DEE2] inline-flex items-center gap-1.5 self-start animate-fade-in">
                    ☁️ Sin datos en la nube
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {pc.cloudPlanData && pc.localPlanData && isAdmin && (
              <div className="flex items-center bg-[#F5F8F9] p-1 rounded-xl border border-[#D5DEE2] text-[10.5px]" title="Intercambiar origen de datos">
                <button
                  type="button"
                  id="btn-source-cloud"
                  onClick={() => pc.switchSource('cloud')}
                  className={`px-3 py-1 font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    pc.sourceActive === 'cloud'
                      ? 'bg-[#312E81] text-white shadow-xs'
                      : 'text-[#5A6A74] hover:text-[#14212A]'
                  }`}
                >
                  Cloud
                </button>
                <button
                  type="button"
                  id="btn-source-local"
                  onClick={() => pc.switchSource('local')}
                  className={`px-3 py-1 font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    pc.sourceActive === 'local'
                      ? 'bg-[#312E81] text-white shadow-xs'
                      : 'text-[#5A6A74] hover:text-[#14212A]'
                  }`}
                >
                  Local
                </button>
              </div>
            )}
            <div className="relative">
              {isAdmin && (
                <button
                  id="btn-admin-sync"
                  onClick={() => setIsSyncMenuOpen(!isSyncMenuOpen)}
                  className="px-3.5 py-1.5 text-xs bg-[#312E81] hover:bg-[#26236B] text-white font-semibold rounded-lg transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                  title="Panel de Sincronización"
                >
                  <span>Cloud {isAdminUnlocked ? '🔓' : '🔒'}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              )}

              {isSyncMenuOpen && (
                <div 
                  className="absolute right-0 mt-2.5 w-80 bg-white border border-indigo-100 rounded-2xl shadow-xl z-50 p-4 animate-fade-in text-left space-y-3.5"
                  style={{ minWidth: '290px' }}
                >
                  <div className="border-b border-indigo-50/80 pb-2">
                    <p className="text-xs font-black text-slate-800 tracking-tight">⚙️ Componentes de Control & Nube</p>
                    <p className="text-[10px] text-slate-400 font-bold leading-normal mt-0.5">Acciones de base de datos protegidas</p>
                  </div>

                  {/* Status indicators */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between p-1.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px]">
                      <span className="text-slate-400 font-extrabold">Estado de Conexión:</span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold flex items-center border border-emerald-200">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></span>
                        Sistema Listo
                      </span>
                    </div>

                    {pc.fileData && pc.fileData.isCloud && (
                      <div className="flex items-center justify-between p-1.5 bg-indigo-50/30 rounded-xl border border-indigo-100/50 text-[11px]">
                        <span className="text-slate-400 font-extrabold">Estado de Datos:</span>
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-bold flex items-center border border-indigo-150">
                          ☁️ Nube Activa
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Password access or controls */}
                  {!isAdminUnlocked ? (
                    <form onSubmit={handleAdminAuth} className="space-y-2.5 pt-1">
                      <div className="text-center bg-amber-50/55 border border-amber-100 rounded-xl p-2.5">
                        <p className="text-[10.5px] font-extrabold text-amber-800 flex items-center justify-center gap-1 leading-none">
                          <Lock className="w-3 h-3 text-amber-600" /> Contenido Restringido
                        </p>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <input
                          type="password"
                          placeholder="Introduce contraseña..."
                          value={adminPasswordInput}
                          onChange={(e) => setAdminPasswordInput(e.target.value)}
                          onKeyDown={(e) => setIsAdminCapsLockOn(e.getModifierState('CapsLock'))}
                          onKeyUp={(e) => setIsAdminCapsLockOn(e.getModifierState('CapsLock'))}
                          onClick={(e) => setIsAdminCapsLockOn(e.getModifierState('CapsLock'))}
                          onFocus={(e) => { if ('getModifierState' in e) setIsAdminCapsLockOn((e as any).getModifierState('CapsLock')); }}
                          onBlur={() => setIsAdminCapsLockOn(false)}
                          className={`w-full px-3 py-1.5 text-xs border ${isAdminCapsLockOn ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200'} rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/80 text-slate-800 font-bold`}
                          autoFocus
                        />
                        {isAdminCapsLockOn && (
                          <div className="flex items-center gap-1.5 text-amber-800 bg-amber-50 border border-amber-200/90 px-2.5 py-1 rounded-md text-[10px] font-bold animate-fade-in">
                            <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>Bloq Mayús Activado</span>
                          </div>
                        )}
                        {adminError && (
                          <p className="text-[10px] text-rose-500 font-bold text-center leading-none mt-0.5 animate-pulse">
                            ❌ {adminError}
                          </p>
                        )}
                        <button
                          type="submit"
                          className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer shadow-mini"
                        >
                          Confirmar Acceso
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-3 pt-1 animate-fade-in text-xs">
                      <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl p-2">
                        <p className="text-[10.5px] font-black text-emerald-800 flex items-center gap-1.5 leading-none">
                          <Unlock className="w-3.5 h-3.5 text-emerald-600" /> Admin Autorizado
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAdminUnlocked(false);
                            setAdminPasswordInput('');
                          }}
                          className="text-[10px] text-rose-600 hover:text-rose-800 font-extrabold hover:underline cursor-pointer"
                        >
                          Cerrar Sesión Admin
                        </button>
                      </div>

                      <div className="flex flex-col gap-2 pt-0.5">
                        {pc.fileData && (
                          <button
                            id="btn-publish-cloud"
                            disabled={pc.loadingProgress > 0}
                            onClick={async () => {
                              if (pc.loadingProgress > 0) return;
                              await pc.publishPlanToCloud();
                              setIsSyncMenuOpen(false);
                            }}
                            className={`w-full py-2 bg-[#CD0000] hover:bg-[#B30000] active:bg-[#990000] text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 ${pc.loadingProgress > 0 ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}`}
                            title="Sincronizar y publicar este plan en la nube para todos los usuarios"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                            Sincronizar Nube
                          </button>
                        )}


                        <label className={`w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold border border-slate-200 rounded-xl transition-all hover:text-slate-900 text-center block text-xs ${isVisualLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          📁 Cargar Nuevo Archivo Excel
                          <input
                            type="file"
                            accept=".xlsx,.xls"
                            disabled={isVisualLoading}
                            onChange={(e) => {
                              if (isVisualLoading) return;
                              pc.handleFileUpload(e);
                              setIsSyncMenuOpen(false);
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              id="btn-logout"
              onClick={handleLogout}
              className="px-4 py-2 text-xs bg-[#EEF0FB] hover:bg-[#E0E3F7] text-[#312E81] font-bold border border-[#C7CBEF] rounded-xl transition-all hover:text-[#1E1B4B] cursor-pointer"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>

        {/* Visual Loading Screen during initial cloud data download */}
        {!pc.fileData && (isVisualLoading || pc.loadingProgress > 0) ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 md:p-14 shadow-[0_15px_40px_rgba(15,23,42,0.04)] text-center max-w-xl mx-auto space-y-6 animate-fade-in my-8">
            <div className="relative flex items-center justify-center mx-auto mb-2">
              <div className="w-20 h-20 rounded-full border-4 border-[#F6D5D5] border-t-[#CD0000] animate-spin shadow-md"></div>
              <Server className="w-8 h-8 text-[#CD0000] absolute animate-pulse" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                {smoothPhase || pc.loadingPhase || 'Sincronizando información de la obra...'}
              </h3>
              <p className="text-xs text-slate-500 font-medium max-w-md mx-auto leading-relaxed">
                Descargando e integrando la última versión del cronograma de control, avance de partidas, certificaciones y personal desde la nube...
              </p>
            </div>

            <div className="w-full max-w-md mx-auto space-y-2.5 pt-2">
              <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5 shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-[#E53935] via-[#CD0000] to-[#A80000] rounded-full transition-all duration-300 ease-out shadow-sm"
                  style={{ width: `${Math.max(8, Math.round(smoothProgress || pc.loadingProgress))}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 px-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#CD0000] animate-pulse"></span>
                  Conexión a la nube
                </span>
                <span className="text-[#CD0000] font-extrabold text-xs">{Math.round(smoothProgress || pc.loadingProgress)}%</span>
              </div>
            </div>
          </div>
        ) : !pc.fileData ? (
          <div 
            onDragOver={(e) => {
              e.preventDefault();
              if (isAdmin && !isVisualLoading) {
                setDragOver(true);
              }
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (isVisualLoading) return;
              if (!isAdmin) return;
              const files = e.dataTransfer.files;
              if (files && files.length > 0) {
                const syntheticEvent = {
                  target: { files }
                } as unknown as React.ChangeEvent<HTMLInputElement>;
                pc.handleFileUpload(syntheticEvent);
              }
            }}
            className={`bg-white rounded-3xl border ${dragOver ? 'border-indigo-500 ring-4 ring-indigo-100 bg-indigo-50/30' : 'border-indigo-100'} p-8 md:p-14 text-center max-w-xl mx-auto space-y-6 animate-fade-in my-8 shadow-sm transition-all`}
          >
            <div className="w-16 h-16 bg-indigo-50 border border-indigo-150 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 shadow-mini">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Sin Datos en la Nube</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                No se ha detectado ningún cronograma de control cargado previamente en la nube.
                {isAdmin ? ' Puedes cargar o arrastrar un archivo Excel (.xlsx) para inicializar y publicar el Master Plan.' : ' Por favor, contacta al administrador para que realice la carga inicial.'}
              </p>
            </div>
            {isAdmin && (
              <label className={`inline-block ${isVisualLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                <div className={`bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-md text-xs ${isVisualLoading ? 'pointer-events-none' : 'cursor-pointer'}`}>
                  📁 Cargar Archivo Excel (.xlsx)
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  disabled={isVisualLoading}
                  onChange={pc.handleFileUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        ) : (
          <>
            {/* Background syncing notification banner if data is already populated and syncing updates */}
            {isVisualLoading && (
              <div className="p-3 bg-[#FDF0F0] border border-[#F3D6D6] rounded-2xl flex items-center justify-between gap-4 animate-fade-in shadow-xs mb-4">
                <div className="flex items-center gap-2.5 text-xs text-[#7A0000] font-bold min-w-0">
                  <div className="w-4 h-4 rounded-full border-2 border-[#F6D5D5] border-t-[#CD0000] animate-spin shrink-0"></div>
                  <span className="truncate">{smoothPhase || pc.loadingPhase || 'Sincronizando con la nube...'}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-32 h-2 bg-[#F6D5D5] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#CD0000] rounded-full transition-all duration-200"
                      style={{ width: `${Math.max(5, smoothProgress || pc.loadingProgress)}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-extrabold text-[#CD0000]">{Math.round(smoothProgress || pc.loadingProgress)}%</span>
                </div>
              </div>
            )}

            {pc.cloudQuotaExceeded && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs mb-4 text-xs animate-fade-in">
                <div className="flex items-center gap-2.5 text-amber-900 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
                  <span>
                    <strong>Límite diario de la base de datos alcanzado.</strong> El aplicativo está funcionando con los datos locales guardados.
                  </span>
                </div>
              </div>
            )}


            {/* Tab Selection */}
            <div className="flex flex-col md:flex-row justify-center relative min-h-[46px] items-center gap-3">
              {/* Botones a la izquierda: en línea con el toggle y debajo del título Trakciona */}
              <div className="md:absolute left-0 mt-3 md:mt-0 flex items-center gap-2 justify-start">
                {pc.activeTab === 'cronograma' && (
                  <div className="flex items-center gap-2 relative" ref={aiMenuRef}>
                    <button
                      id="btn-crono-avance-partidas"
                      onClick={() => setShowAvancePartidasModal(true)}
                      className="px-4 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 border bg-[#5A6A74] hover:bg-[#45535C] text-white border-[#5A6A74] shadow-xs transition-all active:scale-95 cursor-pointer"
                      title="Abrir panel de Avance de Partidas Estructurales y Resumen Económico"
                    >
                      <Layers className="w-3.5 h-3.5 text-[#E2E8EC]" />
                      <span>Avance Partidas</span>
                    </button>

                    <div className="relative">
                      <button
                        id="btn-gemini-crono-intel"
                        onClick={() => setShowAIReportMenu(!showAIReportMenu)}
                        className="px-4 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 border bg-[#5B21B6] hover:bg-[#4C1D95] text-white border-[#5B21B6] shadow-xs transition-all active:scale-95 cursor-pointer"
                        title="Generar y consultar reporte de inteligencia artificial por área"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                        <span>Inteligencia</span>
                        <ChevronDown className={`w-3.5 h-3.5 text-[#E9D5FF] transition-transform ${showAIReportMenu ? 'rotate-180' : ''}`} />
                      </button>

                      {/* DROPDOWN MENU WITH 2 OPTIONS */}
                      {showAIReportMenu && (
                        <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-[#D5DEE2] p-2 z-50 animate-fade-in space-y-1">
                          <div className="px-3 py-2 border-b border-[#D5DEE2] flex items-center justify-between text-[#14212A] font-bold text-xs">
                            <span className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-[#CD0000]" />
                              Reporte AI - Cronograma
                            </span>
                            {aiReportData && (
                              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold border border-emerald-200">
                                Disponible
                              </span>
                            )}
                          </div>

                          {/* Option 1: Consultar Reporte */}
                          <button
                            onClick={() => {
                              setShowAIReportMenu(false);
                              setShowAIReportModal(true);
                            }}
                            className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#F5F8F9] transition-colors flex items-start gap-2.5 group cursor-pointer"
                          >
                            <div className="p-1.5 bg-[#FBE9E9] rounded-lg text-[#CD0000] group-hover:bg-[#CD0000] group-hover:text-white transition-colors mt-0.5">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-[#14212A] group-hover:text-[#CD0000] transition-colors">
                                1. Reporte
                              </div>
                              <div className="text-[11px] text-[#5A6A74] leading-tight">
                                Consultar el reporte estándar más reciente.
                              </div>
                            </div>
                          </button>

                          {/* Option 2: Actualizar Reporte */}
                          <button
                            onClick={handleGenerateAIReport}
                            className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors flex items-start gap-2.5 group cursor-pointer ${
                              isAdmin ? 'hover:bg-[#FBE9E9]/50' : 'hover:bg-[#F5F8F9] opacity-80'
                            }`}
                          >
                            <div className={`p-1.5 rounded-lg transition-colors mt-0.5 ${
                              isAdmin ? 'bg-[#FBE9E9] text-[#CD0000] group-hover:bg-[#CD0000] group-hover:text-white' : 'bg-slate-100 text-slate-400'
                            }`}>
                              <RefreshCw className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className={`text-xs font-bold transition-colors ${isAdmin ? 'text-[#14212A] group-hover:text-[#CD0000]' : 'text-[#5A6A74]'}`}>
                                  2. Actualizar
                                </span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                  isAdmin ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                                }`}>
                                  {isAdmin ? 'Admin' : 'Solo Admin'}
                                </span>
                              </div>
                              <div className="text-[11px] text-[#5A6A74] leading-tight mt-0.5">
                                {isAdmin
                                  ? 'Generar actualización del análisis con IA.'
                                  : 'Solo el administrador puede actualizar el reporte.'}
                              </div>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Selector de Pestañas / Toggle */}
              <div className="inline-flex bg-white rounded-xl p-1 gap-1 border border-[#D5DEE2] shadow-xs">
                {[
                  { id: 'caratula', label: '📑 Resumen' },
                  { id: 'cronograma', label: '📅 Cronograma' },
                  ...(pc.planillaInfo ? [{ id: 'planilla', label: '🧾 Certificación' }] : []),
                  { id: 'personal', label: '👷 Personal' },
                  { id: 'proceso', label: '⚙️ Proceso' },
                ].map(tab => (
                  <button 
                    key={tab.id} 
                    id={`tab-selector-${tab.id}`}
                    onClick={() => pc.setActiveTab(tab.id)}
                    className={`px-4 sm:px-5 py-2 text-xs rounded-lg transition-all font-semibold ${
                      pc.activeTab === tab.id
                        ? 'bg-[#312E81] text-white shadow-xs font-bold'
                        : 'text-[#5A6A74] hover:text-[#14212A] hover:bg-[#EEF2F3]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Controles a la derecha: debajo de Cerrar Sesión */}
              <div className="md:absolute right-0 mt-3 md:mt-0 flex items-center gap-2 justify-end">
                {/* Botón separado de Master ubicado a la derecha del toggle, en línea y debajo de Cerrar Sesión */}
                <button
                  id="tab-selector-master"
                  onClick={() => pc.setActiveTab('master')}
                  className={`px-4 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 border transition-all cursor-pointer shadow-xs active:scale-95 ${
                    pc.activeTab === 'master'
                      ? 'bg-[#312E81] text-white border-[#312E81] shadow-xs ring-2 ring-[#C7CBEF]'
                      : 'bg-white text-[#5A6A74] border-[#D5DEE2] hover:bg-[#F5F8F9] hover:text-[#14212A]'
                  }`}
                  title="Abrir panel CDO Master Plan"
                >
                  <span className="text-sm leading-none">📊</span>
                  <span>Master</span>
                </button>
              </div>
            </div>

        {/* ACTIVE TAB ROUTING (KEEP-ALIVE CACHING FOR ZERO-LAG TAB SWITCHING) */}
        <div id="active-tab-container" className="space-y-6">
          {visitedTabs.has('caratula') && (
            <div id="tab-resumen-wrapper" className="ht-theme" style={{ display: pc.activeTab === 'caratula' ? 'block' : 'none' }}>
              <CaratulaTab
                actividades={pc.actividades}
                stats={pc.stats}
                baseVenta={pc.baseVenta}
                periodoSeleccionado={pc.periodoSeleccionado}
                datosCurvaAvance={pc.datosCurvaAvance}
                datosDona={pc.datosDona}
                dataPlanificadoPG004={pc.dataPlanificadoPG004}
                planillaInfo={pc.planillaInfo}
                planillaTotales={pc.planillaTotales}
                planillaEnmiendas={pc.planillaEnmiendas}
                planillaTipRes={pc.planillaTipRes}
                planillaHojas={pc.planillaHojas}
              />
            </div>
          )}

          {visitedTabs.has('personal') && (
            <div className="ht-theme" style={{ display: pc.activeTab === 'personal' ? 'block' : 'none' }}>
              <PersonalTab />
            </div>
          )}

          {visitedTabs.has('proceso') && (
            <div className="ht-theme" style={{ display: pc.activeTab === 'proceso' ? 'block' : 'none' }}>
              <ProcesoTab />
            </div>
          )}

          {visitedTabs.has('master') && (
            <div className="ht-theme" style={{ display: pc.activeTab === 'master' ? 'block' : 'none' }}>
              <MasterTab
                actividades={pc.actividades}
                mapaColumnasMes={pc.mapaColumnasMes}
                userName={username}
                isAdmin={true}
                onBack={() => {
                  setTimeout(() => pc.setActiveTab('resumen'), 0);
                }}
                onUpdateActividad={(activityIdOrId, updates) => {
                  setTimeout(() => {
                    pc.setActividades(prev =>
                      prev.map(act => {
                        const match =
                          (act.activityId && act.activityId === activityIdOrId) ||
                          act.id === activityIdOrId ||
                          (act.idOrig && act.idOrig === activityIdOrId);
                        if (match) {
                          return { ...act, ...updates };
                        }
                        return act;
                      })
                    );
                  }, 0);
                }}
                onAddActividad={(newAct) => {
                  setTimeout(() => {
                    pc.setActividades(prev => [...prev, newAct]);
                  }, 0);
                }}
                onDeleteActividad={(id) => {
                  setTimeout(() => {
                    pc.setActividades(prev => prev.filter(act => act.id !== id && act.activityId !== id && act.idOrig !== id));
                  }, 0);
                }}
              />
            </div>
          )}

          {visitedTabs.has('economico') && (
            <div className="ht-theme" style={{ display: pc.activeTab === 'economico' ? 'block' : 'none' }}>
              {renderAvancePartidasContent()}
            </div>
          )}

          {visitedTabs.has('cronograma') && (
            <div id="tab-cronograma-wrapper" className="ht-theme" style={{ display: pc.activeTab === 'cronograma' ? 'block' : 'none' }}>
              <CronogramaTab
                actividades={pc.actividades}
                statsCronograma={pc.statsCronograma}
                kpiSelected={pc.kpiSelected}
                setKpiSelected={pc.setKpiSelected}
                kpiExp={pc.kpiExp}
                setKpiExp={pc.setKpiExp}
                ganttStatus={pc.ganttStatus}
                setGanttStatus={pc.setGanttStatus}
                ganttFloat={pc.ganttFloat}
                setGanttFloat={pc.setGanttFloat}
                ganttPAc={pc.ganttPAc}
                setGanttPAc={pc.setGanttPAc}
                ganttTipo={pc.ganttTipo}
                setGanttTipo={pc.setGanttTipo}
                ganttExp={pc.ganttExp}
                setGanttExp={pc.setGanttExp}
                ganttMetricsOpen={pc.ganttMetricsOpen}
                setGanttMetricsOpen={pc.setGanttMetricsOpen}
                ganttTipoOpen={pc.ganttTipoOpen}
                setGanttTipoOpen={pc.setGanttTipoOpen}
                ganttZoom={pc.ganttZoom}
                setGanttZoom={pc.setGanttZoom}
                ganttSearch={pc.ganttSearch}
                setGanttSearch={pc.setGanttSearch}
                partidaSeleccionada={pc.partidaSeleccionada}
                setPartidaSeleccionada={pc.setPartidaSeleccionada}
                tarjetasPartidasExpandidas={pc.tarjetasPartidasExpandidas}
                setTarjetasPartidasExpandidas={pc.setTarjetasPartidasExpandidas}
                tarjetasTipologiasExpandidas={pc.tarjetasTipologiasExpandidas}
                setTarjetasTipologiasExpandidas={pc.setTarjetasTipologiasExpandidas}
                filteredActividades={pc.filteredActividades}
                filterLevel={pc.filterLevel}
                setFilterLevel={pc.setFilterLevel}
                filterTipologia={pc.filterTipologia}
                setFilterTipologia={pc.setFilterTipologia}
                filterResp={pc.filterResp}
                setFilterResp={pc.setFilterResp}
                expandedItems={pc.expandedItems}
                setExpandedItems={pc.setExpandedItems}
                tipologiaSeleccionada={pc.tipologiaSeleccionada}
                setTipologiaSeleccionada={pc.setTipologiaSeleccionada}
                procesosExpandidos={pc.procesosExpandidos}
                setProcesosExpandidos={pc.setProcesosExpandidos}
                capsExpandidos={pc.capsExpandidos}
                setCapsExpandidos={pc.setCapsExpandidos}
                scapsExpandidos={pc.scapsExpandidos}
                setScapsExpandidos={pc.setScapsExpandidos}
                unitsExpandidos={pc.unitsExpandidos}
                setUnitsExpandidos={pc.setUnitsExpandidos}
                isRespFilterActive={pc.isRespFilterActive}
                matchesRespFilter={pc.matchesRespFilter}
                calcularAvance={pc.calcularAvance}
                calcularValoresReales={pc.calcularValoresReales}
                toggleExpand={pc.toggleExpand}
                exportarCronograma={pc.exportarCronograma}
                searchTerm={pc.searchTerm}

                filterTipologiaRetraso={pc.filterTipologiaRetraso}
                setFilterTipologiaRetraso={pc.setFilterTipologiaRetraso}
                expandedRESPs={pc.expandedRESPs}
                setExpandedRESPs={pc.setExpandedRESPs}
                expandedTipos={pc.expandedTipos}
                setExpandedTipos={pc.setExpandedTipos}
                expandedSCAPs={pc.expandedSCAPs}
                setExpandedSCAPs={pc.setExpandedSCAPs}
                expandedSubPartidas={pc.expandedSubPartidas}
                setExpandedSubPartidas={pc.setExpandedSubPartidas}
                baseVenta={pc.baseVenta}
                dataPlanificadoPG004={pc.dataPlanificadoPG004}
                isGanttAIPanelOpen={isGanttAIPanelOpen}
                setIsGanttAIPanelOpen={setIsGanttAIPanelOpen}
                fechaCorteState={pc.fechaCorteState}
                setFechaCorteState={pc.setFechaCorteState}
                isLoggedIn={isLoggedIn}
              />
            </div>
          )}

          {visitedTabs.has('planilla') && (
            <div className="ht-theme" style={{ display: pc.activeTab === 'planilla' ? 'block' : 'none' }}>
              <PlanillaTab
                planillaInfo={pc.planillaInfo}
                planillaCDOvsS={pc.planillaCDOvsS}
                planillaTotales={pc.planillaTotales}
                planillaEnmiendas={pc.planillaEnmiendas}
                planillaTipRes={pc.planillaTipRes}
                planillaHojas={pc.planillaHojas}
                planillaPartidas={pc.planillaPartidas}
                enmExpanded={pc.enmExpanded}
                setEnmExpanded={pc.setEnmExpanded}
                ctExpanded={pc.ctExpanded}
                setCtExpanded={pc.setCtExpanded}
                ctSearch={pc.ctSearch}
                setCtSearch={pc.setCtSearch}
                ctFilterTipo={pc.ctFilterTipo}
                setCtFilterTipo={pc.setCtFilterTipo}
                ctSoloCert={pc.ctSoloCert}
                setCtSoloCert={pc.setCtSoloCert}
                certOpen={pc.certOpen}
                setCertOpen={pc.setCertOpen}
                actividades={pc.actividades}
                mapaColumnasMes={pc.mapaColumnasMes}
                dataPlanificadoPG004={pc.dataPlanificadoPG004}
                datosCurvaAvance={pc.datosCurvaAvance}
                expandedYears={pc.expandedYears}
                setExpandedYears={pc.setExpandedYears}
              />
            </div>
          )}
        </div>
        </>
        )}
      </div>

      <ClaveAdminDialog
        abierto={claveReporte.abierto}
        error={claveReporte.error}
        verificando={claveReporte.verificando}
        onConfirmar={confirmarClaveReporte}
        onCancelar={() => setClaveReporte({ abierto: false, error: '', verificando: false })}
      />
      <AIReportModal
        isOpen={showAIReportModal}
        onClose={() => setShowAIReportModal(false)}
        report={aiReportData}
        isAdmin={isAdmin}
        onUpdateReport={handleGenerateAIReport}
        isGenerating={isGeneratingAIReport}
      />

      {/* Modal Avance de Partidas */}
      {showAvancePartidasModal && (
        <div 
          id="modal-avance-partidas-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center px-[6.5px] sm:px-[14.5px] md:px-[22.5px] py-2 sm:py-4 md:py-6 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAvancePartidasModal(false);
            }
          }}
        >
          <div className="bg-slate-50 rounded-2xl shadow-2xl border border-slate-200 w-full max-w-[calc(98vw+3px)] xl:max-w-[calc(80rem+3px)] max-h-[94vh] flex flex-col overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-indigo-900/40">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-400/30 text-indigo-300 shadow-2xs">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    Avance de Partidas Estructurales
                    <span className="text-[10px] bg-indigo-500/30 text-indigo-200 font-semibold px-2 py-0.5 rounded-full border border-indigo-400/20">
                      Control Económico
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-300">
                    Consolidación jerárquica WBS, tipologías y control de avance del cronograma
                  </p>
                </div>
              </div>

              <button
                id="btn-close-avance-partidas-modal"
                onClick={() => setShowAvancePartidasModal(false)}
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Cerrar y volver al Cronograma"
              >
                <X className="w-4 h-4" />
                <span>Cerrar</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-4 sm:p-6 space-y-4 flex-1">
              {renderAvancePartidasContent()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
