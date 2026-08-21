/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Upload, ChevronRight, ChevronDown, Download, Search, Filter, Lock, Unlock, User, FileSpreadsheet, AlertCircle, AlertTriangle, Check, Copy, Eye, EyeOff, Sparkles, Brain, RefreshCw, Globe, Server, FileText, ChevronsUpDown, ChevronsDownUp } from 'lucide-react';
import { useMasterPlan } from './hooks/useMasterPlan';
import { KPITab } from './components/KPITab';
import { CronogramaTab } from './components/CronogramaTab';
import { PlanillaTab } from './components/PlanillaTab';
import { TipologiaResumen } from './components/TipologiaResumen';
import { ResumenFinanciero } from './components/ResumenFinanciero';
import { ResumenTab } from './components/ResumenTab';
import { PersonalTab } from './components/PersonalTab';
import { AIReportModal } from './components/AIReportModal';
import { buildCronoReportData } from './utils/aiReportHelper';
import { saveAIReportToFirebase, loadAIReportFromFirebase, AIReportData } from './utils/firebaseSync';
import { auth } from './firebase';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const loadGooglePickerAPI = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.picker) {
      resolve((window as any).google);
      return;
    }

    const loadPickerLibrary = () => {
      (window as any).gapi.load('picker', {
        callback: () => {
          resolve((window as any).google);
        },
        onerror: (err: any) => {
          reject(new Error('No se pudo cargar la biblioteca Google Picker.'));
        }
      });
    };

    if (!(window as any).gapi) {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.type = 'text/javascript';
      script.onload = loadPickerLibrary;
      script.onerror = () => reject(new Error('No se pudo cargar el script de Google API (gapi).'));
      document.body.appendChild(script);
    } else {
      loadPickerLibrary();
    }
  });
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const pc = useMasterPlan(isLoggedIn);
  const [username, setUsername] = React.useState('admin');
  const [password, setPassword] = React.useState('control2026');
  const [showPassword, setShowPassword] = React.useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = React.useState(false);
  const [loginError, setLoginError] = React.useState('');
  const [dragOver, setDragOver] = React.useState(false);
  const [isGanttAIPanelOpen, setIsGanttAIPanelOpen] = React.useState(false);

  // Derived Admin state based on username
  const isAdmin = isLoggedIn && username.trim().toLowerCase() === 'admin';

  // States for Admin verification of Sincronizacion/Actualizacion Nube and Cargar Otro Archivo
  const [isAdminUnlocked, setIsAdminUnlocked] = React.useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = React.useState('');
  const [isAdminCapsLockOn, setIsAdminCapsLockOn] = React.useState(false);
  const [isSyncMenuOpen, setIsSyncMenuOpen] = React.useState(false);
  const [adminError, setAdminError] = React.useState('');

  // Estados y funciones de integración con Google Drive
  const [driveFiles, setDriveFiles] = React.useState<any[]>([]);
  const [isBrowsingDrive, setIsBrowsingDrive] = React.useState(false);
  const [driveListError, setDriveListError] = React.useState('');
  const [showDrivePicker, setShowDrivePicker] = React.useState(false);

  // States for AI Crono Report
  const [showAIReportMenu, setShowAIReportMenu] = React.useState(false);
  const [showAIReportModal, setShowAIReportModal] = React.useState(false);
  const [aiReportData, setAiReportData] = React.useState<AIReportData | null>(null);
  const [isGeneratingAIReport, setIsGeneratingAIReport] = React.useState(false);
  const aiMenuRef = React.useRef<HTMLDivElement>(null);

  // Load latest AI report on mount or when plan changes
  const currentPlanId = pc.firebasePlanData?.planMeta?.id || 'latest_report';

  React.useEffect(() => {
    async function fetchReport() {
      const data = await loadAIReportFromFirebase(currentPlanId);
      if (data) {
        setAiReportData(data);
      }
    }
    fetchReport();
  }, [currentPlanId]);

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

  const handleGenerateAIReport = async () => {
    if (!isAdmin) {
      alert('Solo el administrador de la obra está autorizado para generar o actualizar el reporte de Inteligencia Artificial.');
      return;
    }

    if (!pc.actividades || pc.actividades.length === 0) {
      alert('No hay datos de actividades cargados en el cronograma para analizar.');
      return;
    }

    setShowAIReportMenu(false);
    setShowAIReportModal(true);
    setIsGeneratingAIReport(true);

    try {
      const reportPayload = buildCronoReportData(pc.actividades, pc.fechaCorteState);
      const res = await fetch('/api/gemini/crono-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportPayload)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al comunicarse con el servicio de Inteligencia Gemini.');
      }

      const data = await res.json();
      const newReport: AIReportData = {
        markdown: data.markdown,
        updatedAt: data.generatedAt || new Date().toISOString(),
        updatedBy: username || 'Admin',
        summary: reportPayload.projectSummary
      };

      await saveAIReportToFirebase(currentPlanId, newReport);
      setAiReportData(newReport);
    } catch (err: any) {
      console.error('Error al generar el reporte AI:', err);
      alert(`Error al generar el reporte: ${err.message || err}`);
    } finally {
      setIsGeneratingAIReport(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!isAdmin) {
      alert('Acceso denegado: Solo el administrador está autorizado para conectar Google Drive.');
      return;
    }
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.readonly');
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential) {
        const token = credential.accessToken;
        if (token) {
          pc.setGoogleAccessToken(token);
          pc.setGoogleUser(result.user);
          // Al iniciar sesión, carga config guardada en Firebase y autodescarga si existe
          const docSnap = await pc.loadDriveConfig();
          if (docSnap && docSnap.fileId) {
            await pc.syncFileFromDrive(docSnap.fileId, docSnap.fileName);
          }
        }
      }
    } catch (error: any) {
      console.error('Error signing in with Google:', error);
      alert(`Error al iniciar sesión con Google: ${error.message || error}`);
    }
  };

  const handleGoogleSignOut = () => {
    signOut(auth);
    pc.setGoogleAccessToken(null);
    pc.setGoogleUser(null);
    setDriveFiles([]);
    setShowDrivePicker(false);
  };

  const handleBrowseDrive = async () => {
    setIsBrowsingDrive(true);
    setDriveListError('');
    try {
      if (!pc.googleAccessToken) {
        alert('Por favor, conecta Google Drive primero.');
        setIsBrowsingDrive(false);
        return;
      }

      const google = await loadGooglePickerAPI();
      const apiKey = firebaseConfig.apiKey;

      const docsView = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS)
        .setMimeTypes('application/vnd.google-apps.spreadsheet,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel')
        .setSelectFolderEnabled(false);

      const picker = new google.picker.PickerBuilder()
        .addView(docsView)
        .setOAuthToken(pc.googleAccessToken)
        .setDeveloperKey(apiKey)
        .setCallback(async (data: any) => {
          if (data.action === google.picker.Action.PICKED) {
            const doc = data.docs[0];
            const fileId = doc.id;
            const fileName = doc.name;
            
            await pc.saveDriveConfig(fileId, fileName);
            await pc.syncFileFromDrive(fileId, fileName);
          }
        })
        .setTitle('Selecciona tu archivo de Excel o Google Sheets')
        .build();

      picker.setVisible(true);
    } catch (e: any) {
      console.error('Error al abrir Google Picker:', e);
      setDriveListError(e.message || 'Error al conectar con Google Drive Picker.');
      alert(`Error al abrir Google Picker: ${e.message || e}`);
    } finally {
      setIsBrowsingDrive(false);
    }
  };

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPasswordInput === 'ADmin') {
      setIsAdminUnlocked(true);
      setAdminError('');
    } else {
      setAdminError('Contraseña incorrecta');
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
            setSmoothPhase('¡Sincronización completa con Firebase!');
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
            setSmoothPhase('Conectando con la base de datos Firebase...');
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
    tsvRows.push(["Código", "Descripción", "V. Contrato", "V. Plan", "V. Ejecutada", "Avance %", "Excedente", "% Excedente"].join("\t"));

    const htmlRowsArray: string[] = [];

    const addRowHtml = (
      code: string,
      desc: string,
      vContrato: number,
      vPlan: number,
      vEjec: number,
      avancePct: number,
      saldo: number,
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
      const saldoStr = saldo < 0 ? `($${formattedMoney(Math.abs(saldo))})` : `$${formattedMoney(saldo)}`;
      const saldoColor = saldo < 0 ? '#b91c1c' : '#15803d';

      tsvRows.push([
        code,
        desc,
        formattedMoney(vContrato),
        formattedMoney(vPlan),
        formattedMoney(vEjec),
        avanceStr,
        formattedMoney(saldo),
        '-'
      ].join("\t"));

      const indentSpaces = "&nbsp;".repeat(indentCount * 4);
      const paddingLeft = 8 + (indentCount * 14);

      htmlRowsArray.push(`
        <tr style="background-color: ${bg}; color: ${fg}; font-weight: ${fontWeight}; font-size: ${fontSize};">
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-family: monospace, Consolas, sans-serif; background-color: ${bg}; color: ${fg}; text-align: center; mso-number-format: '\\@';">${code}</td>
          <td style="padding: 6px 10px; padding-left: ${paddingLeft}px; border: 1px solid #cbd5e1; background-color: ${bg}; color: ${fg}; font-weight: ${fontWeight};">${indentSpaces}${desc}</td>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace, Consolas, sans-serif; background-color: ${bg}; color: ${fg}; font-weight: ${fontWeight}; mso-number-format: '\\$#,##0.00';">$${formattedMoney(vContrato)}</td>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace, Consolas, sans-serif; background-color: ${bg}; color: ${fg === '#334155' ? '#1d4ed8' : fg}; font-weight: ${fontWeight}; mso-number-format: '\\$#,##0.00';">$${formattedMoney(vPlan)}</td>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace, Consolas, sans-serif; background-color: ${bg}; color: ${fg === '#334155' ? '#15803d' : fg}; font-weight: ${fontWeight}; mso-number-format: '\\$#,##0.00';">$${formattedMoney(vEjec)}</td>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace, Consolas, sans-serif; background-color: ${bg}; color: ${fg}; font-weight: ${fontWeight}; mso-number-format: '0.00%';">${avanceStr}</td>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace, Consolas, sans-serif; background-color: ${bg}; color: ${saldoColor}; font-weight: bold; mso-number-format: '\\$#,##0.00';">${saldoStr}</td>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace, Consolas, sans-serif; background-color: ${bg}; color: ${fg};">-</td>
        </tr>
      `.trim());
    };

    const processItemNode = (item: any) => {
      const values = pc.calcularValoresReales(item);
      const avance = pc.calcularAvance(item);
      const indentCount = Math.max(0, item.nivel - 1);

      let bg = '#ffffff';
      let fg = '#334155';
      let fontWeight = 'normal';
      let fontSize = '10px';

      if (!item.esItemHoja) {
        const level = item.nivel;
        fontWeight = 'bold';
        if (level <= 1) { bg = '#e2e8f0'; fg = '#0f172a'; fontSize = '11.5px'; }
        else if (level === 2) { bg = '#dbeafe'; fg = '#1e40af'; fontSize = '11px'; }
        else if (level === 3) { bg = '#fef3c7'; fg = '#92400e'; fontSize = '10.5px'; }
        else if (level === 4) { bg = '#d1fae5'; fg = '#065f46'; fontSize = '10.5px'; }
        else if (level === 5) { bg = '#e0f2fe'; fg = '#075985'; fontSize = '10px'; }
        else if (level === 6) { bg = '#f3e8ff'; fg = '#6b21a8'; fontSize = '10px'; }
        else { bg = '#ffe4e6'; fg = '#9f1239'; fontSize = '10px'; }
      }

      addRowHtml(
        item.activityId || item.wbs || '',
        item.descripcion || '',
        values.venta || 0,
        values.ventaPlan || 0,
        values.ventaEjecutada || 0,
        avance,
        values.saldo || 0,
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
          .filter(a => !pc.tipologiaSeleccionada || a.tipo === pc.tipologiaSeleccionada);
        leafChildren.forEach(child => processItemNode(child));

        const nonLeafChildren = wbsHierarchyMaps.nonLeafChildrenMap.get(item.id) || [];
        nonLeafChildren.forEach(child => processItemNode(child));
      }
    };

    if (pc.filterLevel !== 'all') {
      const targetNivel = parseInt(pc.filterLevel, 10);
      pc.filteredActividades
        .filter(a => a.nivel === targetNivel && !a.esItemHoja)
        .forEach(item => processItemNode(item));
    } else {
      pc.filteredActividades
        .filter(a => !a.esItemHoja && (!wbsHierarchyMaps.parentMap || !wbsHierarchyMaps.parentMap.has(a.id)))
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

      addRowHtml(
        '-',
        'Total General',
        totalVenta,
        totalVentaPlan,
        totalVentaEjecutada,
        totalAvance,
        totalSaldo,
        '#1e1b4b',
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
              <th style="padding: 8px 10px; border: 1px solid #64748b; background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: right;">Avance %</th>
              <th style="padding: 8px 10px; border: 1px solid #64748b; background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: right;">Excedente</th>
              <th style="padding: 8px 10px; border: 1px solid #64748b; background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: center;">% Excedente</th>
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

  // Render a specific WBS activity row in the "Avance Partidas" (economico) tab
  const renderAvancePartidaRow = (item: any): React.ReactNode => {
    const hasChildren = !item.esItemHoja && (wbsHierarchyMaps.hasChildrenMap.get(item.id) || false);

    const isExpanded = pc.expandedItems.has(item.id);
    const avance = pc.calcularAvance(item);
    const indentLevel = (item.nivel - 1) * 4;
    const values = pc.calcularValoresReales(item);

    // Filter out rows/cards that have both Plan and Ejecutado as zero for the selected period
    const isPeriodSelected = pc.periodoSeleccionado && pc.periodoSeleccionado.anio !== 'TODOS';
    if (isPeriodSelected) {
      if ((values.ventaPlan || 0) <= 0 && (values.ventaEjecutada || 0) <= 0) {
        return null;
      }
    }
    
    let rowBg = '';
    if (!item.esItemHoja) {
      const level = item.nivel;
      if (level <= 1) {
        rowBg = 'bg-slate-200/90 border-l-[6px] border-slate-700 font-extrabold text-slate-900';
      } else if (level === 2) {
        rowBg = 'bg-blue-100/60 border-l-4 border-blue-600 font-bold text-blue-900';
      } else if (level === 3) {
        rowBg = 'bg-amber-50 border-l-4 border-amber-500 font-bold text-amber-900';
      } else if (level === 4) {
        rowBg = 'bg-emerald-50/70 border-l-4 border-emerald-500 font-bold text-emerald-950';
      } else if (level === 5) {
        rowBg = 'bg-sky-50 border-l-4 border-sky-500 font-semibold text-sky-900';
      } else if (level === 6) {
        rowBg = 'bg-purple-50 border-l-4 border-purple-400 font-semibold text-purple-900';
      } else {
        rowBg = 'bg-rose-50 border-l-4 border-rose-400 font-semibold text-rose-900';
      }
    } else {
      rowBg = 'bg-white hover:bg-slate-50/80';
    }

    return (
      <div key={item.id} className="border-b border-slate-100">
        <div
          className={`flex items-center py-1.5 px-3 cursor-pointer transition-colors ${rowBg}`}
          style={{ paddingLeft: `${8 + indentLevel}px` }}
          onClick={() => {
            if (hasChildren) pc.toggleExpand(item.id);
          }}
        >
          <div className="flex-shrink-0 w-5 md:w-6 flex justify-center">
            {hasChildren && (
              isExpanded ? 
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : 
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            )}
          </div>
          
          <div className="flex-1 grid gap-2 items-center" style={{ gridTemplateColumns: '80px 2fr 1.4fr 1.4fr 1.4fr 1.6fr 1.2fr 90px' }}>
            <div className="text-[11px] text-slate-550 font-mono text-center">{item.activityId || ''}</div>
            <div>
              <div className="flex items-center gap-1.5">
                {!item.esItemHoja && (
                  <div className="text-[10px] text-indigo-600 font-mono bg-indigo-50/80 px-1.5 py-0.5 rounded border border-indigo-100">{item.wbs}</div>
                )}
                <div className={`${!item.esItemHoja ? 'font-bold text-slate-800' : 'text-slate-600'} text-[12px] flex-1`}>{item.descripcion}</div>
              </div>
            </div>
            
            <div className="text-center font-semibold text-slate-700 text-[12px]">${formattedMoney(values.venta)}</div>
            <div className="text-center text-indigo-700 font-semibold text-[12px]">${formattedMoney(values.ventaPlan)}</div>
            <div className="text-center text-emerald-700 font-semibold text-[12px]">${formattedMoney(values.ventaEjecutada)}</div>
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <div className="text-[12px] font-semibold text-slate-900">{avance}%</div>
                <div className="w-10 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full ${avance >= 100 ? 'bg-emerald-500' : avance >= 75 ? 'bg-indigo-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(avance, 100)}%` }} />
                </div>
              </div>
            </div>
            
            <div className="text-center">
              <div className={`text-[12px] font-semibold ${values.saldo < 0 ? 'text-rose-500' : 'text-emerald-700'}`}>
                {values.saldo < 0 ? `($${Math.abs(values.saldo).toLocaleString('en-US', { minimumFractionDigits: 2 })})` : `$${values.saldo.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              </div>
            </div>
            <div className="text-center font-semibold text-slate-400 text-[12px]">-</div>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {(wbsHierarchyMaps.leafChildrenMap.get(item.id) || [])
              .filter(a => !pc.tipologiaSeleccionada || a.tipo === pc.tipologiaSeleccionada)
              .map(child => renderAvancePartidaRow(child))}

            {(wbsHierarchyMaps.nonLeafChildrenMap.get(item.id) || [])
              .map(child => renderAvancePartidaRow(child))}
          </div>
        )}
      </div>
    );
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim() === 'control2026') {
      setIsLoggedIn(true);
      setLoginError('');
    } else {
      setLoginError('Contraseña incorrecta. Ingrese la contraseña autorizada.');
    }
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

  // If not logged in, show custom elegant Landing login page.
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50/50 text-slate-800 flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden font-sans" 
           style={{ backgroundImage: 'radial-gradient(circle at top right, rgba(99, 102, 241, 0.05), transparent 50%), radial-gradient(circle at bottom left, rgba(79, 70, 229, 0.03), transparent 60%)' }}>
        
        <div className="max-w-4xl w-full flex flex-col gap-5">
          {/* Beautiful Explicit Landing Progress Bar justo arriba de la tarjeta */}
          {isVisualLoading && (
            <div id="loader-bar-landing-card" className="w-full bg-white border border-indigo-150 rounded-2xl p-5 shadow-lg shadow-indigo-100/40 animate-fade-in flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-600"></span>
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-700">
                    ☁️ {smoothPhase || 'Sincronizando con la nube de Firebase...'}
                  </span>
                </div>
                <span className="text-sm font-black text-indigo-650 bg-indigo-50/80 px-2 py-0.5 rounded-lg border border-indigo-100">
                  {Math.round(smoothProgress)}%
                </span>
              </div>
              
              <div className="w-full h-3 bg-neutral-50/80 rounded-full overflow-hidden border border-slate-200/50 p-0.5 animate-pulse">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-indigo-650 rounded-full transition-all duration-300 ease-out shadow-mini" 
                  style={{ width: `${smoothProgress}%` }} 
                />
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-400 font-extrabold px-1">
                <span className={smoothProgress >= 5 ? "text-indigo-650 transition-colors duration-200 font-black" : ""}>🔌 Conectando</span>
                <span className={smoothProgress >= 40 ? "text-indigo-650 transition-colors duration-200 font-black" : ""}>📥 Descargando</span>
                <span className={smoothProgress >= 75 ? "text-indigo-650 transition-colors duration-200 font-black" : ""}>⚡ Procesando</span>
                <span className={smoothProgress >= 98 || smoothProgress === 100 ? "text-emerald-600 transition-colors duration-200 font-black" : ""}>🎉 Finalizado</span>
              </div>
            </div>
          )}

          <div className="bg-white rounded-3xl border border-indigo-100/80 overflow-hidden shadow-[0_15px_40px_rgba(15,23,42,0.06)] grid md:grid-cols-12 min-h-[520px]">
          
          {/* Brand/Showcase column */}
          <div className="md:col-span-5 bg-gradient-to-br from-slate-50 to-indigo-50/40 p-8 md:p-12 flex flex-col justify-between items-center text-center border-r border-slate-100">
            <div className="my-auto space-y-4 flex flex-col items-center">
              <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/15 animate-fade-in">
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                  <div className="w-4 h-4 bg-indigo-600 rounded-full"></div>
                </div>
              </div>
              <span className="text-2xl font-extrabold tracking-tight text-slate-900 font-sans">Tracker v2.0</span>
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
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 select-none">
                    <User className="w-3.5 h-3.5 text-indigo-600" />
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
                      <Lock className="w-3.5 h-3.5 text-indigo-600" />
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
                className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 font-sans tracking-tight cursor-pointer"
              >
                Ingresar a la Plataforma
              </button>

              <p className="text-center text-slate-400 text-[11px] select-none hover:text-slate-500 transition-colors">
                Para administradores: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 font-mono text-[10px] font-semibold border border-slate-200/55">admin</code> / <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 font-mono text-[10px] font-semibold border border-slate-200/55">control2026</code>. Para consultores: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 font-mono text-[10px] font-semibold border border-slate-200/55">consultor</code> o cualquier otro usuario con la misma contraseña.
              </p>
            </form>
          </div>
        </div>

        </div>
      </div>
    );
  }

  return (
    <div id="master-app-root" className="min-h-screen bg-slate-50 text-slate-900 p-6">
      {isVisualLoading && pc.fileData && (
        <div id="loader-bar-floating" className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md border-b border-indigo-150 animate-fade-in">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-650"></span>
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-indigo-700">{smoothPhase || pc.loadingPhase || 'Cargando datos...'}</span>
              </div>
              <span className="text-sm font-black text-indigo-650 bg-indigo-50/80 px-2 py-0.5 rounded-lg border border-indigo-100">{Math.round(smoothProgress)}%</span>
            </div>
            <div className="w-full h-2.5 bg-neutral-50/80 rounded-full overflow-hidden border border-slate-200/50 p-0.5 animate-pulse">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-650 rounded-full transition-all duration-300 ease-out shadow-mini" style={{ width: `${smoothProgress}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6">
         {/* Navigation / Header */}
        <div className="flex justify-between items-center bg-white rounded-2xl shadow-sm border border-indigo-600 p-6 flex-wrap gap-4 font-sans font-sans">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md">
              <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></div>
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Tracker v2.0</h1>
              <div className="flex flex-col gap-1.5 mt-1">
                {pc.fileData && pc.fileData.isFirebase ? (
                  <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[11px] font-bold border border-indigo-150 inline-flex items-center gap-1.5 self-start animate-fade-in">
                    ☁️ Datos en la Nube Activos
                  </span>
                ) : pc.fileData && isAdmin ? (
                  <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 rounded-md text-[11px] font-bold border border-amber-200 inline-flex items-center gap-1.5 self-start animate-fade-in animate-pulse">
                    💻 Vista Preliminar (Local)
                  </span>
                ) : isAdmin ? (
                  <span className="px-2.5 py-0.5 bg-slate-50 text-slate-500 rounded-md text-[11px] font-bold border border-slate-200 inline-flex items-center gap-1.5 self-start animate-fade-in">
                    ☁️ Sin datos en la nube
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {pc.firebasePlanData && pc.localPlanData && isAdmin && (
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 animate-fade-in text-[10.5px]" title="Intercambiar origen de datos">
                <button
                  type="button"
                  id="btn-source-firebase"
                  onClick={() => pc.switchSource('firebase')}
                  className={`px-3 py-1 font-extrabold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    pc.sourceActive === 'firebase'
                      ? 'bg-indigo-600 text-white shadow-mini'
                      : 'text-slate-650 hover:text-slate-850'
                  }`}
                >
                  Cloud
                </button>
                <button
                  type="button"
                  id="btn-source-local"
                  onClick={() => pc.switchSource('local')}
                  className={`px-3 py-1 font-extrabold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    pc.sourceActive === 'local'
                      ? 'bg-indigo-600 text-white shadow-mini'
                      : 'text-slate-650 hover:text-slate-855'
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
                  className="px-3.5 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-750 active:bg-indigo-800 text-white font-extrabold rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer shadow-indigo-650/10 hover:shadow-indigo-650/20"
                  title="Panel de Sincronización Mundial"
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

                    {pc.fileData && pc.fileData.isFirebase && (
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
                            id="btn-publish-firebase"
                            onClick={async () => {
                              await pc.publishPlanToFirebase();
                              setIsSyncMenuOpen(false);
                            }}
                            className="w-full py-2 bg-[#5200ff] hover:bg-[#4300d6] active:bg-[#3400a3] text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                            title="Sincronizar y publicar este plan en la nube de Firebase para todos los usuarios"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                            Sincronizar Nube
                          </button>
                        )}

                        {pc.fileData && (
                          <div className="text-center py-1">
                            <span className="text-[10px] text-indigo-650 font-bold bg-indigo-50/70 border border-indigo-100/50 px-2.5 py-1.5 rounded-xl inline-block leading-none">
                              ⚡ Consumo est. de cuota Firestore: {(((Math.ceil(pc.actividades.length / 200) + Math.ceil(pc.planillaHojas.length / 200) + 1) / 50000) * 100).toFixed(4)}%
                            </span>
                          </div>
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
              onClick={() => {
                setIsLoggedIn(false);
              }}
              className="px-4 py-2 text-xs bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold border border-rose-200 rounded-xl transition-all hover:text-rose-800 cursor-pointer"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>

        {/* Visual Loading Screen during initial cloud data download */}
        {!pc.fileData && (isVisualLoading || pc.loadingProgress > 0) ? (
          <div className="bg-white rounded-3xl border border-indigo-100 p-8 md:p-14 shadow-[0_15px_40px_rgba(15,23,42,0.04)] text-center max-w-xl mx-auto space-y-6 animate-fade-in my-8">
            <div className="relative flex items-center justify-center mx-auto mb-2">
              <div className="w-20 h-20 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin shadow-md"></div>
              <Server className="w-8 h-8 text-indigo-600 absolute animate-pulse" />
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
                  className="h-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 rounded-full transition-all duration-300 ease-out shadow-sm"
                  style={{ width: `${Math.max(8, Math.round(smoothProgress || pc.loadingProgress))}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 px-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                  Conexión Firestore
                </span>
                <span className="text-indigo-600 font-extrabold text-xs">{Math.round(smoothProgress || pc.loadingProgress)}%</span>
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
                No se ha detectado ningún cronograma de control cargado previamente en la nube de Firebase.
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
              <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-2xl flex items-center justify-between gap-4 animate-fade-in shadow-xs mb-4">
                <div className="flex items-center gap-2.5 text-xs text-indigo-900 font-bold min-w-0">
                  <div className="w-4 h-4 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin shrink-0"></div>
                  <span className="truncate">{smoothPhase || pc.loadingPhase || 'Sincronizando con Firebase...'}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-32 h-2 bg-indigo-200/60 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-600 rounded-full transition-all duration-200"
                      style={{ width: `${Math.max(5, smoothProgress || pc.loadingProgress)}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-extrabold text-indigo-700">{Math.round(smoothProgress || pc.loadingProgress)}%</span>
                </div>
              </div>
            )}

            {pc.firebaseQuotaExceeded && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start justify-between gap-4 animate-fade-in shadow-xs mb-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl">⚠️</span>
                  <div className="text-xs text-amber-900 leading-relaxed">
                    <div className="font-bold text-amber-950 mb-0.5">Límite de cuota diaria de Firestore alcanzado</div>
                    <div>Se ha superado el límite de operaciones gratuitas del plan Spark de Firebase para el día de hoy. La aplicación continúa funcionando fluidamente con los datos guardados en el almacenamiento local y se sincronizará automáticamente cuando se restablezca la cuota diaria.</div>
                  </div>
                </div>
                <a
                  href="https://console.firebase.google.com/project/stoked-catbird-4km1r/firestore/databases/ai-studio-projecttracker-fa5248da-cc8b-432e-8571-4a2efa014a87/data?openUpgradeDialog=true"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-xl transition-all shadow-xs"
                >
                  Gestionar en Firebase
                </a>
              </div>
            )}

            {/* Tab Selection */}
            <div className="flex justify-center relative min-h-[46px] items-center">
          <div className="inline-flex bg-slate-100/80 rounded-2xl p-1 gap-1 border border-slate-200/60 shadow-sm">
            {[
              { id: 'resumen', label: '🏠 Resumen' },
              { id: 'economico', label: '📋 Avance Partidas' },
              { id: 'cronograma', label: '📅 Cronograma' },
              ...(pc.planillaInfo ? [{ id: 'planilla', label: '🧾 Certificación' }] : []),
              { id: 'graficas', label: '📊 KPIs' },
              { id: 'personal', label: '👷 Personal' },
            ].map(tab => (
              <button 
                key={tab.id} 
                id={`tab-selector-${tab.id}`}
                onClick={() => pc.setActiveTab(tab.id)}
                className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all ${
                  pc.activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {pc.activeTab === 'cronograma' && (
            <div className="md:absolute right-0 mt-4 md:mt-0 flex justify-end relative" ref={aiMenuRef}>
              <button
                id="btn-gemini-crono-intel"
                onClick={() => setShowAIReportMenu(!showAIReportMenu)}
                className="px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 border bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white border-indigo-500 shadow-sm transition-all hover:shadow-md active:scale-95"
                title="Generar y consultar reporte de inteligencia artificial por área"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-200 animate-pulse" />
                <span>Inteligencia</span>
                <ChevronDown className={`w-3.5 h-3.5 text-indigo-200 transition-transform ${showAIReportMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* DROPDOWN MENU WITH 2 OPTIONS */}
              {showAIReportMenu && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-fade-in space-y-1">
                  <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between text-slate-800 font-bold text-xs">
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      Reporte AI - Cronograma
                    </span>
                    {aiReportData && (
                      <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold border border-emerald-200">
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
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors flex items-start gap-2.5 group cursor-pointer"
                  >
                    <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors mt-0.5">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                        1. Reporte
                      </div>
                      <div className="text-[11px] text-slate-500 leading-tight">
                        Consultar análisis por área de retrasos y próximas 4 semanas.
                      </div>
                    </div>
                  </button>

                  {/* Option 2: Actualizar Reporte */}
                  <button
                    onClick={handleGenerateAIReport}
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors flex items-start gap-2.5 group cursor-pointer ${
                      isAdmin ? 'hover:bg-indigo-50/70' : 'hover:bg-slate-50 opacity-80'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg transition-colors mt-0.5 ${
                      isAdmin ? 'bg-indigo-100 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      <RefreshCw className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold transition-colors ${isAdmin ? 'text-slate-800 group-hover:text-indigo-600' : 'text-slate-600'}`}>
                          2. Actualizar
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          isAdmin ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          {isAdmin ? 'Admin' : 'Solo Admin'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                        {isAdmin
                          ? 'Generar actualización del análisis con Gemini AI.'
                          : 'Solo el administrador puede actualizar el reporte.'}
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ACTIVE TAB ROUTING */}
        <div id="active-tab-container" className="space-y-6">
          {pc.activeTab === 'resumen' && (
            <ResumenTab
              stats={pc.stats}
              baseVenta={pc.baseVenta}
              setBaseVenta={pc.setBaseVenta}
              periodoSeleccionado={pc.periodoSeleccionado}
              setPeriodoSeleccionado={pc.setPeriodoSeleccionado}
              mapaColumnasMes={pc.mapaColumnasMes}
              exportarAvancePeriodo={pc.exportarAvancePeriodo}
              tipologiaSeleccionada={pc.tipologiaSeleccionada}
              setTipologiaSeleccionada={pc.setTipologiaSeleccionada}
              planillaInfo={pc.planillaInfo}
              planillaTotales={pc.planillaTotales}
              planillaEnmiendas={pc.planillaEnmiendas}
              planillaTipRes={pc.planillaTipRes}
              planillaHojas={pc.planillaHojas}
            />
          )}

          {pc.activeTab === 'graficas' && (
            <KPITab
              stats={pc.stats}
              baseVenta={pc.baseVenta}
              setBaseVenta={pc.setBaseVenta}
              donutPG={pc.donutPG}
              setDonutPG={pc.setDonutPG}
              periodoSeleccionado={pc.periodoSeleccionado}
              setPeriodoSeleccionado={pc.setPeriodoSeleccionado}
              mapaColumnasMes={pc.mapaColumnasMes}
              tipologiaSeleccionada={pc.tipologiaSeleccionada}
              setTipologiaSeleccionada={pc.setTipologiaSeleccionada}
              exportarAvancePeriodo={pc.exportarAvancePeriodo}
              datosDona={pc.datosDona}
              donutDim={pc.donutDim}
              setDonutDim={pc.setDonutDim}
              donutAnio={pc.donutAnio}
              setDonutAnio={pc.setDonutAnio}
              donutMes={pc.donutMes}
              setDonutMes={pc.setDonutMes}
              donutSemana={pc.donutSemana}
              setDonutSemana={pc.setDonutSemana}
              donaAgregada={pc.donaAgregada}
              planFuturoAgregado={pc.planFuturoAgregado}
              tablaUnificada={pc.tablaUnificada}
              tablaSortCol={pc.tablaSortCol}
              setTablaSortCol={pc.setTablaSortCol}
              tablaSortDir={pc.tablaSortDir}
              setTablaSortDir={pc.setTablaSortDir}
              datosCurvaAvance={pc.datosCurvaAvance}
              expandedYears={pc.expandedYears}
              setExpandedYears={pc.setExpandedYears}
              barrasPlanVsReal={pc.barrasPlanVsReal}
              donutAcumulado={pc.donutAcumulado}
              setDonutAcumulado={pc.setDonutAcumulado}
              ultimaSemanaConAvance={pc.ultimaSemanaConAvance}
              actividades={pc.actividades}
              dataPlanificadoPG004={pc.dataPlanificadoPG004}
            />
          )}

          {pc.activeTab === 'personal' && (
            <PersonalTab />
          )}

          {pc.activeTab === 'economico' && (
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
              
              <TipologiaResumen 
                stats={pc.stats} 
                tipologiaSeleccionada={pc.tipologiaSeleccionada} 
                setTipologiaSeleccionada={pc.setTipologiaSeleccionada} 
              />
              
              <div className="bg-white rounded-2xl border border-indigo-600 shadow-sm p-4 sm:p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-4 flex-wrap gap-2">
                <h2 className="text-lg font-bold text-slate-800">📋 Avance de Partidas Estructurales</h2>
                <div className="flex gap-3 items-center text-xs">
                  <button
                    type="button"
                    onClick={copiarReporteJerarquico}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95 shrink-0"
                    title="Copiar reporte jerárquico de la vista actual (HTML con formato y colores para Excel/Word)"
                  >
                    {copiedJerarquico ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-indigo-200" />
                        <span>¡Copiado Jerárquico!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-indigo-150" />
                        <span>Copiar Reporte Jerárquico</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const allParentIds = pc.actividades.filter(a => !a.esItemHoja).map(a => a.id);
                      pc.setExpandedItems(new Set(allParentIds));
                    }}
                    className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-250 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95 shrink-0"
                    title="Expandir todas las partidas de la jerarquía"
                  >
                    <ChevronsUpDown className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Expandir todo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      pc.setExpandedItems(new Set());
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-250 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95 shrink-0"
                    title="Colapsar todas las partidas de la jerarquía"
                  >
                    <ChevronsDownUp className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Colapsar todo</span>
                  </button>

                  <span className="font-semibold text-slate-500">Nivel:</span>
                  <select 
                    value={pc.filterLevel} 
                    onChange={e => pc.setFilterLevel(e.target.value)} 
                    className="border border-slate-250 bg-white px-3 py-1.5 rounded-xl font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  >
                    <option value="all">Filtro Nivel: Todos</option>
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

              {/* Table headers */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-2">
                <div className="flex items-center font-bold text-[11px] text-slate-600 uppercase tracking-wider">
                  <div className="w-5 md:w-6"></div>
                  <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: '80px 2fr 1.4fr 1.4fr 1.4fr 1.6fr 1.2fr 90px' }}>
                    <div className="text-center">Código</div>
                    <div>Descripción</div>
                    <div className="text-center">V. Contrato</div>
                    <div className="text-center">V. Plan</div>
                    <div className="text-center">V. Ejecutada</div>
                    <div className="text-center">Avance %</div>
                    <div className="text-center">Excedente</div>
                    <div className="text-center">% Excedente</div>
                  </div>
                </div>
              </div>

              {/* Table rows list */}
              <div className="divide-y divide-slate-100">
                {(() => {
                  if (pc.filterLevel !== 'all') {
                    const targetNivel = parseInt(pc.filterLevel, 10);
                    return pc.filteredActividades
                      .filter(a => a.nivel === targetNivel && !a.esItemHoja)
                      .map(item => renderAvancePartidaRow(item));
                  }

                  return pc.filteredActividades
                    .filter(a => !a.esItemHoja && (!wbsHierarchyMaps.parentMap || !wbsHierarchyMaps.parentMap.has(a.id)))
                    .map(item => renderAvancePartidaRow(item));
                })()}
                
                {(() => {
                  const stats = pc.stats;
                  if (!stats) return null;

                  const contratoTotal = pc.actividades.filter(a => a.esItemHoja).reduce((sum, a) => sum + (a.ventaM || 0), 0);
                  const totalVenta = stats.totalVenta;
                  const totalVentaPlan = stats.totalVentaPlanPeriodo;
                  const totalVentaEjecutada = stats.totalVentaEjecutadaPeriodo;
                  const totalSaldo = stats.totalSaldoPeriodo;
                  const totalAvance = totalVenta > 0 ? Number(((totalVentaEjecutada / totalVenta) * 100).toFixed(2)) : 0;
                  const totalPctVar = contratoTotal > 0 ? Number(((totalSaldo / contratoTotal) * 100).toFixed(2)) : 0;

                  return (
                    <div className="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-900 sticky bottom-0 z-10 shadow-md">
                      <div
                        className="flex items-center py-2 px-3"
                        style={{ paddingLeft: "12px" }}
                      >
                        <div className="flex-shrink-0 font-extrabold text-slate-550 uppercase text-[9px] tracking-wider w-8">TOTAL</div>
                        
                        <div className="flex-1 grid gap-2 items-center" style={{ gridTemplateColumns: '80px 2fr 1.4fr 1.4fr 1.4fr 1.6fr 1.2fr 90px' }}>
                          <div className="text-xs text-slate-500 font-mono text-center">-</div>
                          <div>
                            <div className="font-extrabold text-slate-900 text-[12px] font-sans">Total General</div>
                            <div className="text-[10px] font-normal text-slate-550 font-sans">{pc.actividades.length.toLocaleString('es-ES')} líneas</div>
                          </div>
                          
                          <div className="text-center font-extrabold text-slate-950 text-[12px]">${totalVenta.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          <div className="text-center text-indigo-900 font-extrabold text-[12px]">${totalVentaPlan.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          <div className="text-center text-emerald-900 font-extrabold text-[12px]">${totalVentaEjecutada.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <div className="text-[12px] font-extrabold text-slate-900">{totalAvance.toFixed(2)}%</div>
                              <div className="w-10 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div className={`h-full ${pc.baseVenta === 'contrato' ? 'bg-indigo-600' : 'bg-amber-500'}`} style={{ width: `${Math.min(totalAvance, 100)}%` }} />
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-center font-mono">
                            <div className={`text-[12px] font-extrabold ${totalSaldo < 0 ? 'text-rose-600' : 'text-emerald-800'}`}>
                              {totalSaldo < 0 ? `($${Math.abs(totalSaldo).toLocaleString('en-US', { minimumFractionDigits: 2 })})` : `$${totalSaldo.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                            </div>
                          </div>
                          
                          <div className="text-center font-mono">
                            <div className={`text-[12px] font-extrabold ${totalPctVar < 0 ? 'text-rose-600' : 'text-emerald-800'}`}>
                              {totalPctVar < 0 ? `(${Math.abs(totalPctVar).toFixed(2)}%)` : `${totalPctVar.toFixed(2)}%`}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

          {pc.activeTab === 'cronograma' && (
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
          )}

          {pc.activeTab === 'planilla' && (
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
            />
          )}
        </div>
        </>
        )}
      </div>

      <AIReportModal
        isOpen={showAIReportModal}
        onClose={() => setShowAIReportModal(false)}
        report={aiReportData}
        isAdmin={isAdmin}
        onUpdateReport={handleGenerateAIReport}
        isGenerating={isGeneratingAIReport}
      />
    </div>
  );
}
