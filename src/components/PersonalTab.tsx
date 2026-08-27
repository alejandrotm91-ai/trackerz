/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Users,
  Building2,
  HardHat,
  ShieldAlert,
  Sun,
  Moon,
  Filter,
  Upload,
  Download,
  Copy,
  Check,
  Search,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  FileSpreadsheet,
  Layers,
  MapPin,
  Calendar,
  Sparkles,
  ArrowUpDown,
  FileText,
  AlertCircle,
  Eye,
  Info,
  UserCheck,
  X,
  Cloud,
  CloudUpload,
  Database,
  Briefcase
} from 'lucide-react';
import { PersonalRegistro, PersonalResumenEmpresa } from '../types/personal';
import {
  clasificarTipoPersonal,
  parsePersonalWorkbook,
  parsePersonalCsv,
  parsePersonalDate,
  agruparPorEmpresa,
  standardizeFrente,
  standardizeActividad,
  cleanEmpresaName
} from '../utils/personalParser';
import { getInitialPersonalData, RAW_SAMPLE_PERSONAL_MERINOS } from '../data/samplePersonalData';
import {
  savePersonalPlanToFirebase,
  loadLatestPersonalPlanFromFirebase
} from '../utils/firebaseSync';
import { PersonalTrendChart } from './PersonalTrendChart';
import { CollapsibleHierarchyDropdown } from './CollapsibleHierarchyDropdown';

export function PersonalTab() {
  // State: Loaded personal data from Firestore or sample demonstration data
  const [registros, setRegistros] = useState<PersonalRegistro[]>([]);
  const [currentFileName, setCurrentFileName] = useState<string>('');
  const [isSyncingWithCloud, setIsSyncingWithCloud] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<{ pct: number; message: string } | null>(null);
  const [isCloudLoaded, setIsCloudLoaded] = useState<boolean>(false);
  const [isLoadingCloud, setIsLoadingCloud] = useState<boolean>(true);

  // On mount: Load latest personal data from Firestore.
  // If no cloud data exists, show demo sample data without failing.
  useEffect(() => {
    let isMounted = true;
    async function loadCloudData() {
      setIsLoadingCloud(true);
      try {
        const cloudData = await loadLatestPersonalPlanFromFirebase();
        if (!isMounted) return;

        if (cloudData && cloudData.registros && cloudData.registros.length > 0) {
          // Re-hydrate any dates if needed
          const hydrated = cloudData.registros.map(r => ({
            ...r,
            fechaDate: r.fechaIso ? new Date(`${r.fechaIso}T00:00:00`) : undefined
          }));
          setRegistros(hydrated);
          setCurrentFileName(cloudData.planMeta?.fileName || 'Matriz_Personal_Nube.xlsx');
          setIsCloudLoaded(true);
        } else {
          // No cloud data -> Default to demonstration sample data
          const initial = getInitialPersonalData();
          setRegistros(initial);
          setCurrentFileName('Datos_Demostracion.xlsx');
          setIsCloudLoaded(false);
        }
      } catch (err) {
        console.warn('Could not load remote personal plan, loading sample demo data:', err);
        if (isMounted) {
          const initial = getInitialPersonalData();
          setRegistros(initial);
          setCurrentFileName('Datos_Demostracion.xlsx');
          setIsCloudLoaded(false);
        }
      } finally {
        if (isMounted) {
          setIsLoadingCloud(false);
        }
      }
    }

    loadCloudData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Sub-view: 'resumen' | 'detalle' | 'graficos' (Default: 'graficos')
  const [activeSubView, setActiveSubView] = useState<'resumen' | 'detalle' | 'graficos'>('graficos');

  // Filters State
  const [ubicacionFilter, setUbicacionFilter] = useState<string>('all'); // 'all' | 'Merinos' | 'Progreso' | etc.
  const [mesFilter, setMesFilter] = useState<string>('all');
  const [semanaFilter, setSemanaFilter] = useState<string>('all');
  const [fechaFilter, setFechaFilter] = useState<string>('all');
  const [tipoFilter, setTipoFilter] = useState<'all' | 'Directo' | 'Indirecto'>('all');
  const [empresaFilter, setEmpresaFilter] = useState<string>('all');
  const [frenteFilter, setFrenteFilter] = useState<string>('all');
  const [turnoFilter, setTurnoFilter] = useState<'all' | 'diurno' | 'noche'>('all');
  const [generoFilter, setGeneroFilter] = useState<'all' | 'hombres' | 'mujeres'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sorting & Pagination in Detailed Table
  const [sortField, setSortField] = useState<keyof PersonalRegistro>('total');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(50);

  // Modals & Notifications
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isEmpresaDropdownOpen, setIsEmpresaDropdownOpen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [uploadFeedback, setUploadFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Collapsible cards state
  const [isTopFrentesCollapsed, setIsTopFrentesCollapsed] = useState<boolean>(true);
  const [isTopActividadesCollapsed, setIsTopActividadesCollapsed] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isSyncingRef = useRef<boolean>(false);

  // Normalizar registros garantizando las reglas de clasificación y estandarización:
  // 1. Estandarización de Empresa: "ACCIONA AGUA" y variantes se consolidan en "ACCIONA"
  // 2. Estandarización de Frente: Si contiene "campamento" -> "Campamento" (unificando "de oficinas", "de oficinas y campo", etc.)
  // 3. Estandarización de Actividad:
  //    - Si contiene "tecnico" y "administrativo" -> "Técnico Administrativo"
  //    - Si contiene "instalacion" y "electrica/electricas" -> "Instalación Eléctrica"
  // 4. Empresa contiene "Acciona" o "Conrayo" (Columna C) -> Personal Indirecto
  // 5. Frente contiene "campamento", "bodega", "puerta norte", "puerta sur" (Columna D) -> Personal Indirecto
  // 6. Actividad contiene "Mediciones de Topografia" / "Topografia" (Columna E) -> Directo si es Licosa, Indirecto para las demás empresas
  // 7. Demás casos -> Personal Directo
  const normalizedRegistros = useMemo(() => {
    return registros.map(r => {
      const empresaEstandarizada = cleanEmpresaName(r.empresa);
      const frenteEstandarizado = standardizeFrente(r.frente);
      const actividadEstandarizada = standardizeActividad(r.actividad);
      const tipoCalculado = clasificarTipoPersonal(frenteEstandarizado, empresaEstandarizada, actividadEstandarizada);
      if (
        r.empresa !== empresaEstandarizada ||
        r.frente !== frenteEstandarizado ||
        r.actividad !== actividadEstandarizada ||
        r.tipo !== tipoCalculado
      ) {
        return {
          ...r,
          empresa: empresaEstandarizada,
          frente: frenteEstandarizado,
          actividad: actividadEstandarizada,
          tipo: tipoCalculado
        };
      }
      return r;
    });
  }, [registros]);

  // Available options for filters
  const availableUbicaciones = useMemo(() => {
    const set = new Set<string>();
    normalizedRegistros.forEach(r => {
      if (r.ubicacion) set.add(r.ubicacion);
    });
    return Array.from(set).sort();
  }, [normalizedRegistros]);

  const availableMeses = useMemo(() => {
    const map = new Map<string, string>();
    normalizedRegistros.forEach(r => {
      if (r.mesKey && r.mesLabel) map.set(r.mesKey, r.mesLabel);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [normalizedRegistros]);

  // Jerarquía de Años y Meses (De enero en adelante para cada año)
  const mesesJerarquia = useMemo(() => {
    const yearsMap = new Map<string, Map<string, { key: string; label: string; monthNum: number }>>();

    normalizedRegistros.forEach(r => {
      if (r.mesKey) {
        const parts = r.mesKey.split('-');
        const year = parts[0] || '2026';
        const monthNum = parseInt(parts[1], 10) || 1;

        if (!yearsMap.has(year)) {
          yearsMap.set(year, new Map());
        }
        const mLabel = r.mesLabel || `${monthNum} - ${year}`;
        yearsMap.get(year)!.set(r.mesKey, {
          key: r.mesKey,
          label: mLabel,
          monthNum
        });
      }
    });

    // Años ordenados (descendente: año más reciente primero)
    const sortedYears = Array.from(yearsMap.keys()).sort((a, b) => b.localeCompare(a));

    return sortedYears.map(year => {
      const mesesMap = yearsMap.get(year)!;
      // Meses de ese año ordenados de Enero en adelante (1..12)
      const mesesSorted = Array.from(mesesMap.values()).sort((a, b) => a.monthNum - b.monthNum);
      return {
        year,
        meses: mesesSorted
      };
    });
  }, [normalizedRegistros]);

  const availableSemanas = useMemo(() => {
    const map = new Map<string, string>();
    normalizedRegistros.forEach(r => {
      if (r.semanaKey && r.semanaLabel) map.set(r.semanaKey, r.semanaLabel);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [normalizedRegistros]);

  // Jerarquía de Semanas por Año, Mes y Semana
  const semanasJerarquia = useMemo(() => {
    const MES_NOMBRES = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    // Map: Year -> Map: MonthKey -> { monthKey, monthNum, monthName, semanasMap: Map<semanaKey, { key, label, weekNum }> }
    const yearsMap = new Map<
      string,
      Map<
        string,
        {
          monthKey: string;
          monthNum: number;
          monthName: string;
          semanasMap: Map<string, { key: string; label: string; weekNum: number }>;
        }
      >
    >();

    normalizedRegistros.forEach(r => {
      if (!r.semanaKey || !r.semanaLabel) return;

      let year = '2026';
      let monthNum = 1;

      if (r.mesKey && r.mesKey.includes('-')) {
        const parts = r.mesKey.split('-');
        year = parts[0] || '2026';
        monthNum = parseInt(parts[1], 10) || 1;
      } else if (r.fechaIso && r.fechaIso.includes('-')) {
        const parts = r.fechaIso.split('-');
        year = parts[0] || '2026';
        monthNum = parseInt(parts[1], 10) || 1;
      } else {
        const parsed = parsePersonalDate(r.fecha);
        if (parsed.mesKey && parsed.mesKey.includes('-')) {
          const parts = parsed.mesKey.split('-');
          year = parts[0] || '2026';
          monthNum = parseInt(parts[1], 10) || 1;
        }
      }

      let weekNum = 1;
      if (r.semanaKey.includes('-W')) {
        weekNum = parseInt(r.semanaKey.split('-W')[1], 10) || 1;
      } else {
        const match = r.semanaKey.match(/\d+/g);
        if (match && match.length > 0) {
          weekNum = parseInt(match[match.length - 1], 10) || 1;
        }
      }

      const monthKey = `${year}-${String(monthNum).padStart(2, '0')}`;
      const monthName = MES_NOMBRES[monthNum - 1] || `Mes ${monthNum}`;

      if (!yearsMap.has(year)) {
        yearsMap.set(year, new Map());
      }
      const mesesMap = yearsMap.get(year)!;

      if (!mesesMap.has(monthKey)) {
        mesesMap.set(monthKey, {
          monthKey,
          monthNum,
          monthName,
          semanasMap: new Map()
        });
      }

      const mesEntry = mesesMap.get(monthKey)!;
      if (!mesEntry.semanasMap.has(r.semanaKey)) {
        mesEntry.semanasMap.set(r.semanaKey, {
          key: r.semanaKey,
          label: r.semanaLabel,
          weekNum
        });
      }
    });

    // Ordenar años (descendente: año más reciente primero)
    const sortedYears = Array.from(yearsMap.keys()).sort((a, b) => b.localeCompare(a));

    return sortedYears.map(year => {
      const mesesMap = yearsMap.get(year)!;
      // Meses ordenados de Enero a Diciembre (1..12)
      const mesesSorted = Array.from(mesesMap.values())
        .sort((a, b) => a.monthNum - b.monthNum)
        .map(m => {
          // Semanas ordenadas cronológicamente por número de semana (1..53)
          const semanasSorted = Array.from(m.semanasMap.values()).sort((a, b) => a.weekNum - b.weekNum);
          return {
            monthKey: m.monthKey,
            monthNum: m.monthNum,
            monthName: m.monthName,
            monthLabel: `${m.monthName} ${year}`,
            semanas: semanasSorted
          };
        });

      return {
        year,
        meses: mesesSorted
      };
    });
  }, [normalizedRegistros]);

  const availableFechas = useMemo(() => {
    const set = new Set<string>();
    normalizedRegistros.forEach(r => {
      if (r.fecha) set.add(r.fecha);
    });
    return Array.from(set).sort();
  }, [normalizedRegistros]);

  // Jerarquía de Fechas por Año, Mes y Día
  const fechasJerarquia = useMemo(() => {
    const MES_NOMBRES = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    // Map: Year -> Map: MonthKey -> { monthKey, monthNum, monthName, diasMap: Map<fechaValue, { value, label, dayNum, iso }> }
    const yearsMap = new Map<
      string,
      Map<
        string,
        {
          monthKey: string;
          monthNum: number;
          monthName: string;
          diasMap: Map<string, { value: string; label: string; dayNum: number; iso: string }>;
        }
      >
    >();

    normalizedRegistros.forEach(r => {
      if (!r.fecha) return;

      let year = '2026';
      let monthNum = 1;
      let dayNum = 1;
      let iso = r.fechaIso || '';

      if (r.fechaIso && r.fechaIso.includes('-')) {
        const parts = r.fechaIso.split('-');
        year = parts[0] || '2026';
        monthNum = parseInt(parts[1], 10) || 1;
        dayNum = parseInt(parts[2], 10) || 1;
      } else if (r.mesKey && r.mesKey.includes('-')) {
        const parts = r.mesKey.split('-');
        year = parts[0] || '2026';
        monthNum = parseInt(parts[1], 10) || 1;
      } else {
        const parsed = parsePersonalDate(r.fecha);
        if (parsed.fechaIso && parsed.fechaIso.includes('-')) {
          const parts = parsed.fechaIso.split('-');
          year = parts[0] || '2026';
          monthNum = parseInt(parts[1], 10) || 1;
          dayNum = parseInt(parts[2], 10) || 1;
          iso = parsed.fechaIso;
        }
      }

      const monthKey = `${year}-${String(monthNum).padStart(2, '0')}`;
      const monthName = MES_NOMBRES[monthNum - 1] || `Mes ${monthNum}`;

      if (!yearsMap.has(year)) {
        yearsMap.set(year, new Map());
      }
      const mesesMap = yearsMap.get(year)!;

      if (!mesesMap.has(monthKey)) {
        mesesMap.set(monthKey, {
          monthKey,
          monthNum,
          monthName,
          diasMap: new Map()
        });
      }

      const mesEntry = mesesMap.get(monthKey)!;
      if (!mesEntry.diasMap.has(r.fecha)) {
        const padDay = String(dayNum).padStart(2, '0');
        const displayLabel = `Día ${padDay} (${r.fecha})`;
        mesEntry.diasMap.set(r.fecha, {
          value: r.fecha,
          label: displayLabel,
          dayNum,
          iso
        });
      }
    });

    // Ordenar años (descendente: año más reciente primero)
    const sortedYears = Array.from(yearsMap.keys()).sort((a, b) => b.localeCompare(a));

    return sortedYears.map(year => {
      const mesesMap = yearsMap.get(year)!;
      // Meses ordenados de Enero a Diciembre (1..12)
      const mesesSorted = Array.from(mesesMap.values())
        .sort((a, b) => a.monthNum - b.monthNum)
        .map(m => {
          // Días ordenados cronológicamente por número de día (1..31)
          const diasSorted = Array.from(m.diasMap.values()).sort((a, b) => a.dayNum - b.dayNum || a.iso.localeCompare(b.iso));
          return {
            monthKey: m.monthKey,
            monthNum: m.monthNum,
            monthName: m.monthName,
            monthLabel: `${m.monthName} ${year}`,
            dias: diasSorted
          };
        });

      return {
        year,
        meses: mesesSorted
      };
    });
  }, [normalizedRegistros]);

  // Formato para Dropdowns colapsables jerárquicos
  const semanasDropdownGroups = useMemo(() => {
    return semanasJerarquia.map(y => ({
      year: y.year,
      meses: y.meses.map(m => ({
        monthKey: m.monthKey,
        monthName: m.monthName,
        monthNum: m.monthNum,
        monthLabel: m.monthLabel,
        items: m.semanas.map(sem => ({
          value: sem.key,
          label: sem.label
        }))
      }))
    }));
  }, [semanasJerarquia]);

  const fechasDropdownGroups = useMemo(() => {
    return fechasJerarquia.map(y => ({
      year: y.year,
      meses: y.meses.map(m => ({
        monthKey: m.monthKey,
        monthName: m.monthName,
        monthNum: m.monthNum,
        monthLabel: m.monthLabel,
        items: m.dias.map(d => ({
          value: d.value,
          label: d.label
        }))
      }))
    }));
  }, [fechasJerarquia]);

  const availableEmpresas = useMemo(() => {
    const set = new Set<string>();
    normalizedRegistros.forEach(r => {
      if (r.empresa) set.add(r.empresa);
    });
    return Array.from(set).sort();
  }, [normalizedRegistros]);

  const availableFrentes = useMemo(() => {
    const set = new Set<string>();
    normalizedRegistros.forEach(r => {
      if (r.frente) set.add(r.frente);
    });
    return Array.from(set).sort();
  }, [normalizedRegistros]);

  // Filtered dataset
  const filteredRegistros = useMemo(() => {
    return normalizedRegistros.filter(r => {
      // Ubicacion
      if (ubicacionFilter !== 'all' && r.ubicacion !== ubicacionFilter) return false;
      // Mes
      if (mesFilter !== 'all' && r.mesKey !== mesFilter) return false;
      // Semana
      if (semanaFilter !== 'all' && r.semanaKey !== semanaFilter) return false;
      // Fecha
      if (fechaFilter !== 'all' && r.fecha !== fechaFilter) return false;
      // Tipo (Directo / Indirecto)
      if (tipoFilter !== 'all' && r.tipo !== tipoFilter) return false;
      // Empresa
      if (empresaFilter !== 'all' && r.empresa !== empresaFilter) return false;
      // Frente
      if (frenteFilter !== 'all' && r.frente !== frenteFilter) return false;
      // Turno
      if (turnoFilter === 'diurno' && (r.hd + r.md) === 0) return false;
      if (turnoFilter === 'noche' && (r.hn + r.mn) === 0) return false;
      // Genero
      if (generoFilter === 'hombres' && r.h === 0) return false;
      if (generoFilter === 'mujeres' && r.m === 0) return false;
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const emp = (r.empresa || '').toLowerCase();
        const f = (r.frente || '').toLowerCase();
        const act = (r.actividad || '').toLowerCase();
        const u = (r.ubicacion || '').toLowerCase();
        if (!emp.includes(q) && !f.includes(q) && !act.includes(q) && !u.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [
    normalizedRegistros,
    ubicacionFilter,
    mesFilter,
    semanaFilter,
    fechaFilter,
    tipoFilter,
    empresaFilter,
    frenteFilter,
    turnoFilter,
    generoFilter,
    searchQuery
  ]);

  // Sorted and Paginated detailed records
  const sortedRegistros = useMemo(() => {
    return [...filteredRegistros].sort((a, b) => {
      let vA = a[sortField];
      let vB = b[sortField];

      if (typeof vA === 'string' && typeof vB === 'string') {
        return sortAsc ? vA.localeCompare(vB) : vB.localeCompare(vA);
      }
      const numA = Number(vA) || 0;
      const numB = Number(vB) || 0;
      return sortAsc ? numA - numB : numB - numA;
    });
  }, [filteredRegistros, sortField, sortAsc]);

  const paginatedRegistros = useMemo(() => {
    if (rowsPerPage === -1) return sortedRegistros;
    const start = (page - 1) * rowsPerPage;
    return sortedRegistros.slice(start, start + rowsPerPage);
  }, [sortedRegistros, page, rowsPerPage]);

  const totalPages = rowsPerPage === -1 ? 1 : Math.ceil(sortedRegistros.length / rowsPerPage);

  // Identificar el Mes Corriente (o mes seleccionado si hay filtro de mes activo)
  const mesCorrienteKey = useMemo(() => {
    if (mesFilter !== 'all') return mesFilter;
    if (availableMeses.length > 0) return availableMeses[0][0];
    return '';
  }, [mesFilter, availableMeses]);

  const mesCorrienteLabel = useMemo(() => {
    if (mesFilter !== 'all') {
      const found = availableMeses.find(([k]) => k === mesFilter);
      return found ? found[1] : mesFilter;
    }
    if (availableMeses.length > 0) return availableMeses[0][1];
    return 'Mes Corriente';
  }, [mesFilter, availableMeses]);

  // Grouped by company (calculates both global totals and active month daily averages)
  const resumenPorEmpresa = useMemo(() => {
    return agruparPorEmpresa(filteredRegistros, mesCorrienteKey);
  }, [filteredRegistros, mesCorrienteKey]);

  // Global & Monthly Average KPI Calculations (El foco principal es el Promedio Diario del Mes Corriente)
  const stats = useMemo(() => {
    // 1. Acumulados de todos los registros filtrados
    let totalPersonal = 0;
    let directoTotal = 0;
    let indirectoTotal = 0;
    let hdTotal = 0;
    let mdTotal = 0;
    let hnTotal = 0;
    let mnTotal = 0;
    let hTotal = 0;
    let mTotal = 0;

    const empresasSet = new Set<string>();
    const frentesSet = new Set<string>();
    const fechasSet = new Set<string>();

    filteredRegistros.forEach(r => {
      totalPersonal += r.total;
      if (r.tipo === 'Directo') {
        directoTotal += r.total;
      } else {
        indirectoTotal += r.total;
      }
      hdTotal += r.hd;
      mdTotal += r.md;
      hnTotal += r.hn;
      mnTotal += r.mn;
      hTotal += r.h;
      mTotal += r.m;

      if (r.empresa) empresasSet.add(r.empresa);
      if (r.frente) frentesSet.add(r.frente);
      if (r.fecha) fechasSet.add(r.fecha);
    });

    const numDiasTotal = Math.max(1, fechasSet.size);

    // 2. Registros específicos del Mes Corriente / Seleccionado para calcular los Promedios
    const registrosMesCorriente = mesFilter !== 'all'
      ? filteredRegistros
      : (mesCorrienteKey ? filteredRegistros.filter(r => r.mesKey === mesCorrienteKey) : filteredRegistros);

    const targetRegistros = registrosMesCorriente.length > 0 ? registrosMesCorriente : filteredRegistros;

    let mesTotal = 0;
    let mesDirecto = 0;
    let mesIndirecto = 0;
    let mesHd = 0;
    let mesMd = 0;
    let mesHn = 0;
    let mesMn = 0;
    let mesH = 0;
    let mesM = 0;
    const fechasMesSet = new Set<string>();
    const empresasMesSet = new Set<string>();

    targetRegistros.forEach(r => {
      mesTotal += r.total;
      if (r.tipo === 'Directo') {
        mesDirecto += r.total;
      } else {
        mesIndirecto += r.total;
      }
      mesHd += r.hd;
      mesMd += r.md;
      mesHn += r.hn;
      mesMn += r.mn;
      mesH += r.h;
      mesM += r.m;

      if (r.fecha) fechasMesSet.add(r.fecha);
      if (r.empresa) empresasMesSet.add(r.empresa);
    });

    const numDiasMes = Math.max(1, fechasMesSet.size);

    // Promedios diarios del mes corriente
    const promDiario = mesTotal / numDiasMes;
    const promDirecto = mesDirecto / numDiasMes;
    const promIndirecto = mesIndirecto / numDiasMes;
    const promHd = mesHd / numDiasMes;
    const promMd = mesMd / numDiasMes;
    const promHn = mesHn / numDiasMes;
    const promMn = mesMn / numDiasMes;
    const promHombres = mesH / numDiasMes;
    const promMujeres = mesM / numDiasMes;
    const promDiurno = (mesHd + mesMd) / numDiasMes;
    const promNoche = (mesHn + mesMn) / numDiasMes;

    // Participaciones porcentuales basadas en los promedios del mes corriente
    const pctDirecto = promDiario > 0 ? (promDirecto / promDiario) * 100 : 0;
    const pctIndirecto = promDiario > 0 ? (promIndirecto / promDiario) * 100 : 0;
    const pctHombres = promDiario > 0 ? (promHombres / promDiario) * 100 : 0;
    const pctMujeres = promDiario > 0 ? (promMujeres / promDiario) * 100 : 0;
    const pctDiurno = promDiario > 0 ? (promDiurno / promDiario) * 100 : 0;
    const pctNoche = promDiario > 0 ? (promNoche / promDiario) * 100 : 0;

    // Top contractor
    const topEmpresa = resumenPorEmpresa.length > 0 ? resumenPorEmpresa[0] : null;

    return {
      // Mes corriente info
      mesCorrienteKey,
      mesCorrienteLabel,
      numDiasMes,
      numDiasTotal,
      // Promedios diarios del mes corriente (MÉTRICAS PRINCIPALES)
      promDiario,
      promDirecto,
      promIndirecto,
      promHd,
      promMd,
      promHn,
      promMn,
      promHombres,
      promMujeres,
      promDiurno,
      promNoche,
      // Porcentajes del mes corriente
      pctDirecto,
      pctIndirecto,
      pctHombres,
      pctMujeres,
      pctDiurno,
      pctNoche,
      // Totales acumulados
      totalPersonal,
      directoTotal,
      indirectoTotal,
      hdTotal,
      mdTotal,
      hnTotal,
      mnTotal,
      hTotal,
      mTotal,
      diurnoTotal: hdTotal + mdTotal,
      nocheTotal: hnTotal + mnTotal,
      mesTotal,
      mesDirecto,
      mesIndirecto,
      totalEmpresas: empresasMesSet.size || empresasSet.size,
      totalFrentes: frentesSet.size,
      topEmpresa
    };
  }, [filteredRegistros, resumenPorEmpresa, mesFilter, mesCorrienteKey, mesCorrienteLabel]);

  // Evolution by date for charts
  const evolucionPorFecha = useMemo(() => {
    const map = new Map<string, { fecha: string; directo: number; indirecto: number; total: number; hombres: number; mujeres: number }>();
    filteredRegistros.forEach(r => {
      const k = r.fecha || 'Sin Fecha';
      let e = map.get(k);
      if (!e) {
        e = { fecha: k, directo: 0, indirecto: 0, total: 0, hombres: 0, mujeres: 0 };
        map.set(k, e);
      }
      if (r.tipo === 'Directo') {
        e.directo += r.total;
      } else {
        e.indirecto += r.total;
      }
      e.total += r.total;
      e.hombres += r.h;
      e.mujeres += r.m;
    });
    return Array.from(map.values());
  }, [filteredRegistros]);

  // Top Frentes for charts (calculates monthly daily average and total)
  const frentesDistribucion = useMemo(() => {
    const numDiasMes = stats.numDiasMes || 1;
    
    // Registros del mes corriente para promedios
    const registrosMes = mesFilter !== 'all'
      ? filteredRegistros
      : (mesCorrienteKey ? filteredRegistros.filter(r => r.mesKey === mesCorrienteKey) : filteredRegistros);
    const targetRegistros = registrosMes.length > 0 ? registrosMes : filteredRegistros;

    const map = new Map<string, {
      frente: string;
      totalAcumulado: number;
      totalMes: number;
      promedioDiarioMes: number;
      directoMes: number;
      indirectoMes: number;
    }>();

    filteredRegistros.forEach(r => {
      const f = r.frente || 'Sin Frente';
      let entry = map.get(f);
      if (!entry) {
        entry = {
          frente: f,
          totalAcumulado: 0,
          totalMes: 0,
          promedioDiarioMes: 0,
          directoMes: 0,
          indirectoMes: 0
        };
        map.set(f, entry);
      }
      entry.totalAcumulado += r.total;
    });

    targetRegistros.forEach(r => {
      const f = r.frente || 'Sin Frente';
      const entry = map.get(f);
      if (entry) {
        entry.totalMes += r.total;
        if (r.tipo === 'Directo') entry.directoMes += r.total;
        else entry.indirectoMes += r.total;
      }
    });

    map.forEach(entry => {
      entry.promedioDiarioMes = entry.totalMes / numDiasMes;
    });

    return Array.from(map.values())
      .sort((a, b) => b.promedioDiarioMes - a.promedioDiarioMes || b.totalAcumulado - a.totalAcumulado)
      .slice(0, 10);
  }, [filteredRegistros, stats.numDiasMes, mesFilter, mesCorrienteKey]);

  // Top Actividades for charts (calculates monthly daily average and total)
  const actividadesDistribucion = useMemo(() => {
    const numDiasMes = stats.numDiasMes || 1;

    // Registros del mes corriente para promedios
    const registrosMes = mesFilter !== 'all'
      ? filteredRegistros
      : (mesCorrienteKey ? filteredRegistros.filter(r => r.mesKey === mesCorrienteKey) : filteredRegistros);
    const targetRegistros = registrosMes.length > 0 ? registrosMes : filteredRegistros;

    const map = new Map<string, {
      actividad: string;
      totalAcumulado: number;
      totalMes: number;
      promedioDiarioMes: number;
      directoMes: number;
      indirectoMes: number;
    }>();

    filteredRegistros.forEach(r => {
      const a = standardizeActividad(r.actividad);
      let entry = map.get(a);
      if (!entry) {
        entry = {
          actividad: a,
          totalAcumulado: 0,
          totalMes: 0,
          promedioDiarioMes: 0,
          directoMes: 0,
          indirectoMes: 0
        };
        map.set(a, entry);
      }
      entry.totalAcumulado += r.total;
    });

    targetRegistros.forEach(r => {
      const a = standardizeActividad(r.actividad);
      const entry = map.get(a);
      if (entry) {
        entry.totalMes += r.total;
        if (r.tipo === 'Directo') entry.directoMes += r.total;
        else entry.indirectoMes += r.total;
      }
    });

    map.forEach(entry => {
      entry.promedioDiarioMes = entry.totalMes / numDiasMes;
    });

    return Array.from(map.values())
      .sort((a, b) => b.promedioDiarioMes - a.promedioDiarioMes || b.totalAcumulado - a.totalAcumulado)
      .slice(0, 20);
  }, [filteredRegistros, stats.numDiasMes, mesFilter, mesCorrienteKey]);

  // Upload currently loaded records to Firebase
  const handleSyncToCloud = async () => {
    if (isSyncingRef.current || registros.length === 0) {
      setUploadFeedback({ type: 'error', message: 'No hay datos para sincronizar o ya hay una carga en curso.' });
      return;
    }
    isSyncingRef.current = true;
    try {
      setIsSyncingWithCloud(true);
      setSyncProgress({ pct: 20, message: 'Iniciando sincronización con la nube...' });
      setIsUploadModalOpen(true); // Open modal to show progress

      await savePersonalPlanToFirebase(currentFileName || 'Matriz_Personal.xlsx', registros, (pct, statusMsg) => {
        setSyncProgress({ pct, message: statusMsg });
      });
      setIsCloudLoaded(true);
      setUploadFeedback({
        type: 'success',
        message: `¡Se sincronizaron exitosamente ${registros.length} registros en la nube!`
      });
    } catch (syncErr) {
      console.warn('Error sincronizando con Firebase:', syncErr);
      setUploadFeedback({
        type: 'error',
        message: 'Ocurrió un error al intentar sincronizar con la nube. Intenta nuevamente.'
      });
    } finally {
      setIsSyncingWithCloud(false);
      setSyncProgress(null);
      setTimeout(() => {
        setIsUploadModalOpen(false);
        setUploadFeedback(null);
      }, 1800);
      isSyncingRef.current = false;
    }
  };

  // Process uploaded Excel / CSV File
  const processFile = async (file: File) => {
    if (isSyncingRef.current) {
      setUploadFeedback({ type: 'error', message: 'Ya hay una carga en curso. Espera a que termine.' });
      return;
    }
    isSyncingRef.current = true;
    try {
      setUploadFeedback({
        type: 'success',
        message: `Procesando archivo "${file.name}"...`
      });

      const buffer = await file.arrayBuffer();
      let nuevosRegistros: PersonalRegistro[] = [];
      const fileNameLower = file.name.toLowerCase();

      if (fileNameLower.endsWith('.csv') || fileNameLower.endsWith('.txt') || fileNameLower.endsWith('.tsv')) {
        let text = new TextDecoder('utf-8').decode(buffer);
        // Si hay caracteres extraños de codificación Windows-1252 / ISO-8859-1
        if (text.includes('\uFFFD')) {
          try {
            text = new TextDecoder('iso-8859-1').decode(buffer);
          } catch {
            // keep utf-8
          }
        }
        nuevosRegistros = parsePersonalCsv(text, 'Merinos');
      } else {
        // Excel (.xlsx, .xls, etc.)
        try {
          const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
          nuevosRegistros = parsePersonalWorkbook(workbook);
        } catch (wbErr) {
          console.warn('Fallback XLSX parsing with raw mode:', wbErr);
          const workbook = XLSX.read(buffer, { type: 'array', raw: true });
          nuevosRegistros = parsePersonalWorkbook(workbook);
        }

        // Si falló y no extrajo registros, intentar como CSV
        if (nuevosRegistros.length === 0) {
          try {
            const text = new TextDecoder('utf-8').decode(buffer);
            nuevosRegistros = parsePersonalCsv(text, 'Merinos');
          } catch {
            // ignore
          }
        }
      }

      if (!nuevosRegistros || nuevosRegistros.length === 0) {
        setUploadFeedback({
          type: 'error',
          message: 'No se pudieron extraer registros válidos. Verifica que las columnas coincidan con la matriz (Fecha, Empresa, Frente, Actividad, Hd, Md, Hn, Mn, H, M, Total).'
        });
        return;
      }

      setRegistros(nuevosRegistros);
      setCurrentFileName(file.name);
      setIsCloudLoaded(false);

      setUploadFeedback({
        type: 'success',
        message: `¡Se cargaron exitosamente ${nuevosRegistros.length} registros desde "${file.name}" para esta sesión! Para guardarlo en Firebase usa el botón "Guardar en Nube".`
      });

      setTimeout(() => {
        setIsUploadModalOpen(false);
        setUploadFeedback(null);
      }, 1800);

      // Reset page & filters
      setPage(1);
    } catch (err: any) {
      console.error('Error procesando archivo de personal:', err);
      setUploadFeedback({
        type: 'error',
        message: `Error al procesar el archivo: ${err.message || 'Formato no soportado'}`
      });
      setIsSyncingWithCloud(false);
      setSyncProgress(null);
    } finally {
      isSyncingRef.current = false;
    }
  };

  // Handle File Input Change
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Drag & Drop Handlers
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isSyncingWithCloud) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Reset to default sample dataset
  const handleResetSampleData = () => {
    const initial = getInitialPersonalData();
    setRegistros(initial);
    setCurrentFileName('Datos_Demostracion.xlsx');
    setUploadFeedback({
      type: 'success',
      message: 'Se han cargado los datos iniciales de muestra (96 registros del 17 y 18 de agosto).'
    });
    setTimeout(() => {
      setIsUploadModalOpen(false);
      setUploadFeedback(null);
    }, 1500);
  };

  // Reset filters
  const handleResetFilters = () => {
    setUbicacionFilter('all');
    setMesFilter('all');
    setSemanaFilter('all');
    setFechaFilter('all');
    setTipoFilter('all');
    setEmpresaFilter('all');
    setFrenteFilter('all');
    setTurnoFilter('all');
    setGeneroFilter('all');
    setSearchQuery('');
    setPage(1);
  };

  const hasActiveFilters =
    ubicacionFilter !== 'all' ||
    mesFilter !== 'all' ||
    semanaFilter !== 'all' ||
    fechaFilter !== 'all' ||
    tipoFilter !== 'all' ||
    empresaFilter !== 'all' ||
    frenteFilter !== 'all' ||
    turnoFilter !== 'all' ||
    generoFilter !== 'all' ||
    searchQuery.trim() !== '';

  // Copy to Excel with Rich Colors & Formatting
  const handleCopyTable = async () => {
    try {
      if (activeSubView === 'resumen') {
        // Copy summary by company table
        let tsv = 'EMPRESA\tDIRECTO\tINDIRECTO\tHOMBRES\tMUJERES\tDIURNO\tNOCHE\tTOTAL PERSONAL\t% DOTACIÓN\tREGISTROS\tFRENTES PRINCIPALES\n';
        let html = `
          <table border="1" style="border-collapse: collapse; font-family: Calibri, sans-serif; font-size: 11pt;">
            <thead>
              <tr style="background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: center;">
                <th style="padding: 6px 12px;">EMPRESA</th>
                <th style="padding: 6px 10px; background-color: #065f46;">DIRECTO</th>
                <th style="padding: 6px 10px; background-color: #92400e;">INDIRECTO</th>
                <th style="padding: 6px 8px;">HOMBRES</th>
                <th style="padding: 6px 8px;">MUJERES</th>
                <th style="padding: 6px 8px;">DIURNO</th>
                <th style="padding: 6px 8px;">NOCHE</th>
                <th style="padding: 6px 10px; background-color: #312e81;">TOTAL PERSONAL</th>
                <th style="padding: 6px 8px;">% DOTACIÓN</th>
                <th style="padding: 6px 8px;">REGISTROS</th>
                <th style="padding: 6px 12px;">FRENTES PRINCIPALES</th>
              </tr>
            </thead>
            <tbody>
        `;

        resumenPorEmpresa.forEach((r, idx) => {
          const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
          tsv += `${r.empresa}\t${r.directoTotal}\t${r.indirectoTotal}\t${r.hombresTotal}\t${r.mujeresTotal}\t${r.diurnoTotal}\t${r.nocheTotal}\t${r.total}\t${r.porcentaje.toFixed(1)}%\t${r.registros}\t${r.frentes.slice(0, 3).join(', ')}\n`;

          html += `
            <tr style="background-color: ${bg};">
              <td style="padding: 4px 8px; font-weight: bold;">${r.empresa}</td>
              <td style="padding: 4px 8px; text-align: right; font-weight: bold; color: #047857;">${r.directoTotal}</td>
              <td style="padding: 4px 8px; text-align: right; font-weight: bold; color: #b45309;">${r.indirectoTotal}</td>
              <td style="padding: 4px 8px; text-align: right;">${r.hombresTotal}</td>
              <td style="padding: 4px 8px; text-align: right;">${r.mujeresTotal}</td>
              <td style="padding: 4px 8px; text-align: right;">${r.diurnoTotal}</td>
              <td style="padding: 4px 8px; text-align: right;">${r.nocheTotal}</td>
              <td style="padding: 4px 8px; text-align: right; font-weight: bold; background-color: #e0e7ff;">${r.total}</td>
              <td style="padding: 4px 8px; text-align: right; mso-number-format: '0.0%';">${r.porcentaje.toFixed(1)}%</td>
              <td style="padding: 4px 8px; text-align: right;">${r.registros}</td>
              <td style="padding: 4px 8px; font-size: 9pt; color: #475569;">${r.frentes.slice(0, 4).join('; ')}</td>
            </tr>
          `;
        });

        // Totals row
        tsv += `TOTALES\t${stats.directoTotal}\t${stats.indirectoTotal}\t${stats.hTotal}\t${stats.mTotal}\t${stats.diurnoTotal}\t${stats.nocheTotal}\t${stats.totalPersonal}\t100.0%\t${filteredRegistros.length}\t-\n`;
        html += `
            <tr style="background-color: #1e1b4b; color: #ffffff; font-weight: bold;">
              <td style="padding: 6px 8px;">TOTALES GENERALES</td>
              <td style="padding: 6px 8px; text-align: right; color: #34d399;">${stats.directoTotal}</td>
              <td style="padding: 6px 8px; text-align: right; color: #fcd34d;">${stats.indirectoTotal}</td>
              <td style="padding: 6px 8px; text-align: right;">${stats.hTotal}</td>
              <td style="padding: 6px 8px; text-align: right;">${stats.mTotal}</td>
              <td style="padding: 6px 8px; text-align: right;">${stats.diurnoTotal}</td>
              <td style="padding: 6px 8px; text-align: right;">${stats.nocheTotal}</td>
              <td style="padding: 6px 8px; text-align: right; font-size: 12pt;">${stats.totalPersonal}</td>
              <td style="padding: 6px 8px; text-align: right;">100.0%</td>
              <td style="padding: 6px 8px; text-align: right;">${filteredRegistros.length}</td>
              <td style="padding: 6px 8px;">-</td>
            </tr>
          </tbody></table>
        `;

        if (navigator.clipboard && navigator.clipboard.write) {
          const blobHtml = new Blob([html], { type: 'text/html' });
          const blobPlain = new Blob([tsv], { type: 'text/plain' });
          await navigator.clipboard.write([new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobPlain })]);
        } else {
          await navigator.clipboard.writeText(tsv);
        }
      } else {
        // Detailed raw records table
        let tsv = 'Fecha\tUbicación\tID\tEmpresa\tFrente\tTipo\tActividad\tHd\tMd\tHn\tMn\tH\tM\tTotal\n';
        let html = `
          <table border="1" style="border-collapse: collapse; font-family: Calibri, sans-serif; font-size: 10pt;">
            <thead>
              <tr style="background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: center;">
                <th style="padding: 5px 8px;">Fecha</th>
                <th style="padding: 5px 8px;">Ubicación</th>
                <th style="padding: 5px 6px;">ID</th>
                <th style="padding: 5px 12px;">Empresa</th>
                <th style="padding: 5px 12px;">Frente</th>
                <th style="padding: 5px 8px;">Tipo</th>
                <th style="padding: 5px 14px;">Actividad</th>
                <th style="padding: 5px 6px;">Hd</th>
                <th style="padding: 5px 6px;">Md</th>
                <th style="padding: 5px 6px;">Hn</th>
                <th style="padding: 5px 6px;">Mn</th>
                <th style="padding: 5px 6px;">H</th>
                <th style="padding: 5px 6px;">M</th>
                <th style="padding: 5px 8px; background-color: #312e81;">Total</th>
              </tr>
            </thead>
            <tbody>
        `;

        filteredRegistros.forEach((r, idx) => {
          const isDirecto = r.tipo === 'Directo';
          const tipoColor = isDirecto ? '#047857' : '#b45309';
          const tipoBg = isDirecto ? '#ecfdf5' : '#fffbeb';
          const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

          tsv += `${r.fecha}\t${r.ubicacion}\t${r.rawId || ''}\t${r.empresa}\t${r.frente}\t${r.tipo}\t${r.actividad}\t${r.hd}\t${r.md}\t${r.hn}\t${r.mn}\t${r.h}\t${r.m}\t${r.total}\n`;

          html += `
            <tr style="background-color: ${rowBg};">
              <td style="padding: 3px 6px; text-align: center;">${r.fecha}</td>
              <td style="padding: 3px 6px; text-align: center;">${r.ubicacion}</td>
              <td style="padding: 3px 6px; text-align: center;">${r.rawId || ''}</td>
              <td style="padding: 3px 8px; font-weight: bold;">${r.empresa}</td>
              <td style="padding: 3px 8px;">${r.frente}</td>
              <td style="padding: 3px 6px; text-align: center; font-weight: bold; background-color: ${tipoBg}; color: ${tipoColor};">${r.tipo}</td>
              <td style="padding: 3px 8px;">${r.actividad}</td>
              <td style="padding: 3px 6px; text-align: right;">${r.hd || ''}</td>
              <td style="padding: 3px 6px; text-align: right;">${r.md || ''}</td>
              <td style="padding: 3px 6px; text-align: right;">${r.hn || ''}</td>
              <td style="padding: 3px 6px; text-align: right;">${r.mn || ''}</td>
              <td style="padding: 3px 6px; text-align: right; font-weight: bold;">${r.h}</td>
              <td style="padding: 3px 6px; text-align: right; font-weight: bold;">${r.m}</td>
              <td style="padding: 3px 8px; text-align: right; font-weight: bold; background-color: #e0e7ff;">${r.total}</td>
            </tr>
          `;
        });

        html += `</tbody></table>`;

        if (navigator.clipboard && navigator.clipboard.write) {
          const blobHtml = new Blob([html], { type: 'text/html' });
          const blobPlain = new Blob([tsv], { type: 'text/plain' });
          await navigator.clipboard.write([new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobPlain })]);
        } else {
          await navigator.clipboard.writeText(tsv);
        }
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Error al copiar al portapapeles:', err);
    }
  };

  // Download template Excel
  const handleDownloadTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();
      
      // Hoja Merinos
      const merinosData = [
        ['Fecha', 'id', 'EMPRESAS', 'Frente', 'ACTIVIDAD', 'Hd', 'Md', 'Hn', 'Mn', 'H', 'M', 'Total'],
        ['17-ago-26', 1, 'ACCIONA', 'Campamento de oficinas', 'Supervision', 2, 0, 0, 0, 2, 0, 2],
        ['17-ago-26', 2, 'CDECONS', 'Campo', 'Apoyo en obra', 10, 0, 0, 0, 10, 0, 10],
        ['17-ago-26', 3, 'ACCIONA AGUA', 'Bodega', 'Bodeguero', 2, 0, 0, 0, 2, 0, 2],
        ['17-ago-26', 4, 'MOSS SECURITY', 'Puerta Sur', 'Vigilancia', 2, 0, 2, 0, 4, 0, 4],
        ['17-ago-26', 5, 'JUANA VALLEJO', 'Calle 5', 'Adoquinado', 11, 0, 0, 0, 11, 0, 11]
      ];
      const wsMerinos = XLSX.utils.aoa_to_sheet(merinosData);
      XLSX.utils.book_append_sheet(wb, wsMerinos, 'merinos');

      // Hoja Progreso
      const progresoData = [
        ['Fecha', 'id', 'EMPRESAS', 'Frente', 'ACTIVIDAD', 'Hd', 'Md', 'Hn', 'Mn', 'H', 'M', 'Total'],
        ['17-ago-26', 1, 'ACCIONA', 'Campamento de oficinas', 'Supervision', 2, 0, 0, 0, 2, 0, 2],
        ['17-ago-26', 2, 'CDECONS', 'Edificio Principal', 'Obra Civil', 8, 2, 0, 0, 8, 2, 10]
      ];
      const wsProgreso = XLSX.utils.aoa_to_sheet(progresoData);
      XLSX.utils.book_append_sheet(wb, wsProgreso, 'progreso');

      XLSX.writeFile(wb, 'Plantilla_Control_Personal_Obra.xlsx');
    } catch (e) {
      console.error('Error al generar plantilla Excel:', e);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id="personal-tab-root">
      {/* Hidden File Input - Permanently Mounted in DOM */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx, .xls, .csv, .txt, .tsv"
        className="hidden"
        onChange={handleFileUpload}
        disabled={isSyncingWithCloud}
      />

      {/* Top Banner Card (Ultra-compact) */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl px-4 py-2.5 sm:px-5 sm:py-3 text-white shadow-md border border-indigo-500/20 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-40 top-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-amber-400 flex items-center justify-center shrink-0">
              <HardHat className="w-4 h-4" />
            </div>
            <h1 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2 flex-wrap">
              <span>Análisis de Personal de Obra</span>
              {isLoadingCloud ? (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-indigo-200 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Cargando datos...</span>
                </span>
              ) : registros.length > 0 ? (
                <>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                    {registros.length} Registros
                  </span>
                  {currentFileName && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-900/60 border border-indigo-400/30 text-indigo-200 truncate max-w-[200px]" title={currentFileName}>
                      📄 {currentFileName}
                    </span>
                  )}
                  {isCloudLoaded ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-300 flex items-center gap-1" title="Sincronizado en Firebase Firestore">
                      <Cloud className="w-3 h-3 text-sky-300" />
                      <span>Nube</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center gap-1" title="Datos de muestra locales">
                      <span>Muestra</span>
                    </span>
                  )}
                </>
              ) : (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300">
                  Carga requerida
                </span>
              )}
            </h1>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all active:scale-95 cursor-pointer border border-indigo-400/40"
              id="btn-abrir-carga-excel-personal"
              title="Cargar archivo Excel o CSV con matriz de personal de obra"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-200" />
              <span>{registros.length > 0 ? 'Cargar otro Excel' : 'Cargar Excel'}</span>
            </button>

            {!isCloudLoaded && registros.length > 0 && currentFileName !== 'Datos_Demostracion.xlsx' && (
              <button
                onClick={handleSyncToCloud}
                disabled={isSyncingWithCloud}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 bg-sky-600/90 hover:bg-sky-500 text-white border border-sky-400/40 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                title="Guardar archivo actual en Firebase para todos los usuarios"
              >
                <CloudUpload className="w-3.5 h-3.5 text-sky-200" />
                <span>Guardar en Nube</span>
              </button>
            )}

            {registros.length > 0 && (
              <button
                onClick={() => {
                  setRegistros([]);
                  setCurrentFileName('');
                }}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 bg-slate-800/90 hover:bg-rose-950/60 hover:text-rose-200 text-slate-300 border border-slate-700 transition-all cursor-pointer"
                title="Cerrar archivo de personal cargado"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cerrar Archivo</span>
              </button>
            )}

            <button
              onClick={handleCopyTable}
              disabled={registros.length === 0}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer border disabled:opacity-40 disabled:cursor-not-allowed ${
                copied
                  ? 'bg-emerald-600 border-emerald-400 text-white shadow-emerald-900/40'
                  : 'bg-slate-800/90 hover:bg-slate-700 text-white border-slate-700'
              }`}
              id="btn-copiar-reporte-personal"
              title="Copiar reporte al portapapeles con formato y colores para Excel"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-200" />
                  <span>¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-300" />
                  <span>Copiar Tabla</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadTemplate}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
              title="Descargar plantilla base de Excel (.xlsx) con hojas Merinos y Progreso"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Plantilla</span>
            </button>
          </div>
        </div>

        {/* Location Selector Pills */}
        <div className="mt-4 pt-3 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-400" />
              <span>Ubicación / Sede:</span>
            </span>

            <div className="inline-flex bg-slate-950/60 rounded-xl p-1 border border-slate-700/80">
              <button
                onClick={() => setUbicacionFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  ubicacionFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🏢 Consolidado (Todas)
              </button>

              {availableUbicaciones.map(ub => (
                <button
                  key={ub}
                  onClick={() => setUbicacionFilter(ub)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    ubicacionFilter === ub
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  📍 {ub}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {registros.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 text-center max-w-3xl mx-auto my-6 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center mx-auto mb-4">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">
            Cargar Matriz de Personal de Obra
          </h2>
          <p className="text-sm text-slate-600 max-w-lg mx-auto mb-6 leading-relaxed">
            Para visualizar los análisis de cuadrillas, comparativas directas vs indirectas, gráficos de tendencias y resúmenes por empresa, carga el archivo Excel o CSV de la matriz de personal.
          </p>

          {uploadFeedback && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-semibold mb-6 max-w-md mx-auto flex items-start gap-2.5 ${
                uploadFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {uploadFeedback.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{uploadFeedback.message}</span>
            </div>
          )}

          <div
            onClick={() => {
              if (isSyncingWithCloud) return;
              fileInputRef.current?.click();
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed transition-all rounded-2xl p-8 text-center cursor-pointer group mb-6 max-w-md mx-auto ${
              isDragging
                ? 'border-indigo-600 bg-indigo-100/80 scale-[1.02]'
                : 'border-indigo-300 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50/70'
            }`}
          >
            <Upload className={`w-8 h-8 text-indigo-500 mx-auto mb-2 transition-transform ${isDragging ? 'scale-125' : 'group-hover:scale-110'}`} />
            <div className="text-sm font-bold text-slate-800">
              {isDragging ? '¡Suelta el archivo aquí!' : 'Haz clic o arrastra tu archivo Excel / CSV aquí'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Formatos compatibles: .xlsx, .xls, .csv, .txt
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isSyncingWithCloud}
              className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Upload className="w-4 h-4" />
              <span>Seleccionar Archivo Excel</span>
            </button>
            <button
              onClick={handleResetSampleData}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <RefreshCw className="w-4 h-4 text-slate-500" />
              <span>Cargar datos de demostración</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Filter Control Bar - Placed BEFORE KPI Cards */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs" id="filtros-analisis-container">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-2.5">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-800">Filtros de Análisis</span>
            {hasActiveFilters && (
              <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                Filtros Activos
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Limpiar Filtros</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Filter by Mes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Mes:</label>
            <select
              value={mesFilter}
              onChange={(e) => {
                setMesFilter(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs bg-white border border-slate-300 rounded-xl px-2.5 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="all">Todos los Meses</option>
              {mesesJerarquia.map(grupo => (
                <optgroup key={grupo.year} label={`Año ${grupo.year}`}>
                  {grupo.meses.map(m => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Filter by Semana (Jerarquizado por Año -> Mes -> Semana con acordeón colapsable) */}
          <CollapsibleHierarchyDropdown
            id="filter-semana-dropdown"
            label="Semana:"
            value={semanaFilter}
            onChange={(val) => {
              setSemanaFilter(val);
              setPage(1);
            }}
            allOptionLabel="Todas las Semanas"
            groups={semanasDropdownGroups}
          />

          {/* Filter by Fecha (Jerarquizado por Año -> Mes -> Día con acordeón colapsable) */}
          <CollapsibleHierarchyDropdown
            id="filter-fecha-dropdown"
            label="Día Específico:"
            value={fechaFilter}
            onChange={(val) => {
              setFechaFilter(val);
              setPage(1);
            }}
            allOptionLabel="Todas las Fechas (Días)"
            groups={fechasDropdownGroups}
          />

          {/* Filter by Tipo (Directo / Indirecto) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Tipo de Personal:</label>
            <select
              value={tipoFilter}
              onChange={(e) => {
                setTipoFilter(e.target.value as any);
                setPage(1);
              }}
              className="w-full text-xs bg-white border border-slate-300 rounded-xl px-2.5 py-2 font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="all">Todos los Tipos</option>
              <option value="Directo">🟢 Directo (Campo/Obra)</option>
              <option value="Indirecto">🟡 Indirecto (Campamento/Bodega/Puertas)</option>
            </select>
          </div>

          {/* Filter by Empresa */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Empresa:</label>
            <select
              value={empresaFilter}
              onChange={(e) => {
                setEmpresaFilter(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs bg-white border border-slate-300 rounded-xl px-2.5 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="all">Todas las Empresas ({availableEmpresas.length})</option>
              {availableEmpresas.map(emp => (
                <option key={emp} value={emp}>{emp}</option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Buscar:</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Frente, actividad, etc..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs bg-white border border-slate-300 rounded-xl pl-8 pr-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>
        </div>
      </div>

      {/* Active Card Filters Chip Bar */}
      {(tipoFilter !== 'all' || turnoFilter !== 'all' || generoFilter !== 'all' || empresaFilter !== 'all' || frenteFilter !== 'all') && (
        <div className="bg-indigo-50/80 border border-indigo-200/90 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs animate-fade-in shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-extrabold text-indigo-900 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-indigo-600" />
              <span>Filtrando por tarjeta:</span>
            </span>

            {tipoFilter !== 'all' && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold ${
                tipoFilter === 'Directo' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-900 border border-amber-300'
              }`}>
                <span>{tipoFilter === 'Directo' ? '🟢 Personal Directo' : '🟡 Personal Indirecto'}</span>
                <button
                  onClick={() => { setTipoFilter('all'); setPage(1); }}
                  className="hover:bg-black/10 rounded-full w-4 h-4 inline-flex items-center justify-center font-black cursor-pointer ml-1"
                  title="Quitar filtro de tipo"
                >
                  ✕
                </button>
              </span>
            )}

            {generoFilter !== 'all' && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold ${
                generoFilter === 'hombres' ? 'bg-indigo-100 text-indigo-800 border border-indigo-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}>
                <span>{generoFilter === 'hombres' ? '👤 Solo Hombres' : '👩 Solo Mujeres'}</span>
                <button
                  onClick={() => { setGeneroFilter('all'); setPage(1); }}
                  className="hover:bg-black/10 rounded-full w-4 h-4 inline-flex items-center justify-center font-black cursor-pointer ml-1"
                  title="Quitar filtro de género"
                >
                  ✕
                </button>
              </span>
            )}

            {turnoFilter !== 'all' && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold ${
                turnoFilter === 'diurno' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-indigo-100 text-indigo-800 border border-indigo-300'
              }`}>
                <span>{turnoFilter === 'diurno' ? '☀️ Turno Diurno' : '🌙 Turno Noche'}</span>
                <button
                  onClick={() => { setTurnoFilter('all'); setPage(1); }}
                  className="hover:bg-black/10 rounded-full w-4 h-4 inline-flex items-center justify-center font-black cursor-pointer ml-1"
                  title="Quitar filtro de turno"
                >
                  ✕
                </button>
              </span>
            )}

            {empresaFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold bg-indigo-100 text-indigo-900 border border-indigo-300">
                <Building2 className="w-3 h-3" />
                <span>Empresa: {empresaFilter}</span>
                <button
                  onClick={() => { setEmpresaFilter('all'); setPage(1); }}
                  className="hover:bg-black/10 rounded-full w-4 h-4 inline-flex items-center justify-center font-black cursor-pointer ml-1"
                  title="Quitar filtro de empresa"
                >
                  ✕
                </button>
              </span>
            )}

            {frenteFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold bg-slate-200 text-slate-800 border border-slate-300">
                <span>Frente: {frenteFilter}</span>
                <button
                  onClick={() => { setFrenteFilter('all'); setPage(1); }}
                  className="hover:bg-black/10 rounded-full w-4 h-4 inline-flex items-center justify-center font-black cursor-pointer ml-1"
                  title="Quitar filtro de frente"
                >
                  ✕
                </button>
              </span>
            )}
          </div>

          <button
            onClick={() => {
              setTipoFilter('all');
              setTurnoFilter('all');
              setGeneroFilter('all');
              setEmpresaFilter('all');
              setFrenteFilter('all');
              setPage(1);
            }}
            className="text-indigo-700 hover:text-indigo-950 font-bold underline cursor-pointer text-xs shrink-0"
          >
            Quitar todos los filtros de tarjetas
          </button>
        </div>
      )}

      {/* KPI Cards Grid - Interactive Filters & Monthly Averages */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5" id="kpi-cards-summary-grid">
        {/* Total Personal (Promedio Diario) */}
        <div
          id="kpi-card-total-personal"
          role="button"
          tabIndex={0}
          onClick={() => {
            if (tipoFilter !== 'all' || turnoFilter !== 'all' || generoFilter !== 'all' || empresaFilter !== 'all' || frenteFilter !== 'all') {
              setTipoFilter('all');
              setTurnoFilter('all');
              setGeneroFilter('all');
              setEmpresaFilter('all');
              setFrenteFilter('all');
              setPage(1);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setTipoFilter('all');
              setTurnoFilter('all');
              setGeneroFilter('all');
              setEmpresaFilter('all');
              setFrenteFilter('all');
              setPage(1);
            }
          }}
          className={`bg-white border rounded-2xl p-4 shadow-xs hover:shadow-md transition-all select-none cursor-pointer relative overflow-hidden group ${
            tipoFilter === 'all' && turnoFilter === 'all' && generoFilter === 'all' && empresaFilter === 'all' && frenteFilter === 'all'
              ? 'border-slate-200/90 hover:border-indigo-300'
              : 'border-indigo-400 bg-indigo-50/30 ring-2 ring-indigo-200'
          }`}
          title="Haz clic para ver el total general y limpiar filtros de tarjetas"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600">Total Prom. / Día</span>
            <Users className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">
            {stats.promDiario.toFixed(1)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between font-medium">
            <span className="truncate font-semibold text-indigo-700">{stats.mesCorrienteLabel}</span>
            <span className="text-slate-400 font-mono text-[9px]">{stats.numDiasMes}d</span>
          </div>
          {tipoFilter !== 'all' || turnoFilter !== 'all' || generoFilter !== 'all' || empresaFilter !== 'all' ? (
            <div className="mt-1.5 pt-1 border-t border-indigo-100 flex items-center justify-between text-[10px] font-bold text-indigo-600">
              <span>Filtros activos</span>
              <span className="underline">Limpiar ✕</span>
            </div>
          ) : (
            <div className="mt-1.5 pt-1 border-t border-slate-100 text-[10px] font-medium text-slate-500 group-hover:text-indigo-600 flex items-center justify-between">
              <span>Acum: {stats.totalPersonal.toLocaleString('en-US')}</span>
              <span>•</span>
            </div>
          )}
        </div>

        {/* Personal Directo (Promedio Diario) */}
        <div
          id="kpi-card-personal-directo"
          role="button"
          tabIndex={0}
          onClick={() => {
            setTipoFilter(prev => prev === 'Directo' ? 'all' : 'Directo');
            setPage(1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setTipoFilter(prev => prev === 'Directo' ? 'all' : 'Directo');
              setPage(1);
            }
          }}
          className={`rounded-2xl p-4 shadow-xs hover:shadow-md transition-all select-none cursor-pointer relative overflow-hidden group ${
            tipoFilter === 'Directo'
              ? 'bg-emerald-100/90 border-2 border-emerald-500 ring-2 ring-emerald-300 shadow-md scale-[1.02]'
              : 'bg-emerald-50/50 border border-emerald-200/90 hover:border-emerald-400 hover:bg-emerald-50'
          }`}
          title={tipoFilter === 'Directo' ? 'Filtro ACTIVO. Haz clic para quitar filtro y ver todo' : 'Haz clic para filtrar gráficos y tablas solo por Personal Directo'}
        >
          <div className="flex items-center justify-between text-emerald-800 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Directo (Prom.)</span>
            <HardHat className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-emerald-950 tracking-tight font-mono">
            {stats.promDirecto.toFixed(1)}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1 flex items-center justify-between font-semibold">
            <span>Participación:</span>
            <span className="bg-emerald-200/80 text-emerald-900 px-1.5 py-0.2 rounded font-bold">{stats.pctDirecto.toFixed(1)}%</span>
          </div>
          <div className="mt-1.5 pt-1 border-t border-emerald-200/60 text-[10px] font-bold flex items-center justify-between">
            {tipoFilter === 'Directo' ? (
              <span className="text-emerald-800 flex items-center gap-1 font-extrabold">
                <span>✓ Filtrando Directo</span>
                <span className="text-emerald-600 font-normal underline">(✕)</span>
              </span>
            ) : (
              <span className="text-emerald-700 group-hover:underline text-[9px]">
                Acum: {stats.directoTotal.toLocaleString('en-US')} ➔
              </span>
            )}
          </div>
        </div>

        {/* Personal Indirecto (Promedio Diario) */}
        <div
          id="kpi-card-personal-indirecto"
          role="button"
          tabIndex={0}
          onClick={() => {
            setTipoFilter(prev => prev === 'Indirecto' ? 'all' : 'Indirecto');
            setPage(1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setTipoFilter(prev => prev === 'Indirecto' ? 'all' : 'Indirecto');
              setPage(1);
            }
          }}
          className={`rounded-2xl p-4 shadow-xs hover:shadow-md transition-all select-none cursor-pointer relative overflow-hidden group ${
            tipoFilter === 'Indirecto'
              ? 'bg-amber-100/90 border-2 border-amber-500 ring-2 ring-amber-300 shadow-md scale-[1.02]'
              : 'bg-amber-50/50 border border-amber-200/90 hover:border-amber-400 hover:bg-amber-50'
          }`}
          title={tipoFilter === 'Indirecto' ? 'Filtro ACTIVO. Haz clic para quitar filtro y ver todo' : 'Haz clic para filtrar gráficos y tablas solo por Personal Indirecto (Empresas Acciona o Frentes: Campamento, Bodega, Puertas)'}
        >
          <div className="flex items-center justify-between text-amber-800 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">Indirecto (Prom.)</span>
            <ShieldAlert className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-amber-950 tracking-tight font-mono">
            {stats.promIndirecto.toFixed(1)}
          </div>
          <div className="text-[11px] text-amber-700 mt-1 flex items-center justify-between font-semibold">
            <span className="truncate" title="Camp., Bodega, Pts">Participación:</span>
            <span className="bg-amber-200/80 text-amber-900 px-1.5 py-0.2 rounded font-bold shrink-0">{stats.pctIndirecto.toFixed(1)}%</span>
          </div>
          <div className="mt-1.5 pt-1 border-t border-amber-200/60 text-[10px] font-bold flex items-center justify-between">
            {tipoFilter === 'Indirecto' ? (
              <span className="text-amber-900 flex items-center gap-1 font-extrabold">
                <span>✓ Filtrando Indirecto</span>
                <span className="text-amber-700 font-normal underline">(✕)</span>
              </span>
            ) : (
              <span className="text-amber-700 group-hover:underline text-[9px]">
                Acum: {stats.indirectoTotal.toLocaleString('en-US')} ➔
              </span>
            )}
          </div>
        </div>

        {/* Género (Promedio Diario Hombres vs Mujeres) */}
        <div
          id="kpi-card-genero"
          className={`border rounded-2xl p-4 shadow-xs hover:shadow-md transition-all select-none relative overflow-hidden group ${
            generoFilter !== 'all'
              ? 'bg-slate-50 border-indigo-400 ring-2 ring-indigo-200 shadow-md'
              : 'bg-white border-slate-200/90 hover:border-slate-300'
          }`}
          title="Haz clic en Hombres o Mujeres para filtrar gráficos y tablas por género"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Género (Prom. Día)</span>
            <UserCheck className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
          </div>
          
          <div className="flex items-center gap-1.5 font-mono my-0.5">
            {/* Hombres Button Pill */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setGeneroFilter(prev => prev === 'hombres' ? 'all' : 'hombres');
                setPage(1);
              }}
              className={`flex-1 py-1 px-1.5 rounded-lg text-center transition-all cursor-pointer border ${
                generoFilter === 'hombres'
                  ? 'bg-indigo-600 text-white font-black border-indigo-700 shadow-xs'
                  : 'bg-slate-50 hover:bg-indigo-50 text-slate-900 border-slate-200 hover:border-indigo-300'
              }`}
              title="Filtrar solo registros de Hombres"
            >
              <div className="text-lg font-black leading-tight">{stats.promHombres.toFixed(1)}</div>
              <div className={`text-[9px] font-extrabold uppercase ${generoFilter === 'hombres' ? 'text-indigo-100' : 'text-indigo-600'}`}>
                Hombres
              </div>
            </button>

            {/* Mujeres Button Pill */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setGeneroFilter(prev => prev === 'mujeres' ? 'all' : 'mujeres');
                setPage(1);
              }}
              className={`flex-1 py-1 px-1.5 rounded-lg text-center transition-all cursor-pointer border ${
                generoFilter === 'mujeres'
                  ? 'bg-rose-600 text-white font-black border-rose-700 shadow-xs'
                  : 'bg-slate-50 hover:bg-rose-50 text-slate-900 border-slate-200 hover:border-rose-300'
              }`}
              title="Filtrar solo registros de Mujeres"
            >
              <div className="text-lg font-black leading-tight text-rose-600 group-hover:text-rose-700">{stats.promMujeres.toFixed(1)}</div>
              <div className={`text-[9px] font-extrabold uppercase ${generoFilter === 'mujeres' ? 'text-rose-100' : 'text-rose-600'}`}>
                Mujeres
              </div>
            </button>
          </div>

          <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between font-semibold">
            <span className="text-indigo-700">{stats.pctHombres.toFixed(0)}% H</span>
            <span className="text-rose-600">{stats.pctMujeres.toFixed(0)}% M</span>
          </div>
          {generoFilter !== 'all' && (
            <div className="mt-1 pt-1 border-t border-slate-200 flex items-center justify-between text-[10px] font-bold text-indigo-700">
              <span>✓ Solo {generoFilter === 'hombres' ? 'Hombres' : 'Mujeres'}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setGeneroFilter('all');
                  setPage(1);
                }}
                className="underline text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Quitar ✕
              </button>
            </div>
          )}
        </div>

        {/* Turnos (Promedio Diario Diurno vs Noche) */}
        <div
          id="kpi-card-turnos"
          className={`border rounded-2xl p-4 shadow-xs hover:shadow-md transition-all select-none relative overflow-hidden group ${
            turnoFilter !== 'all'
              ? 'bg-slate-50 border-indigo-400 ring-2 ring-indigo-200 shadow-md'
              : 'bg-white border-slate-200/90 hover:border-slate-300'
          }`}
          title="Haz clic en Diurno o Noche para filtrar gráficos y tablas por turno"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Turnos (Prom. Día)</span>
            <div className="flex items-center gap-1">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <Moon className="w-3.5 h-3.5 text-indigo-500" />
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 font-mono my-0.5">
            {/* Diurno Button Pill */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setTurnoFilter(prev => prev === 'diurno' ? 'all' : 'diurno');
                setPage(1);
              }}
              className={`flex-1 py-1 px-1.5 rounded-lg text-center transition-all cursor-pointer border ${
                turnoFilter === 'diurno'
                  ? 'bg-amber-500 text-white font-black border-amber-600 shadow-xs'
                  : 'bg-slate-50 hover:bg-amber-50 text-slate-900 border-slate-200 hover:border-amber-300'
              }`}
              title="Filtrar solo registros de Turno Diurno"
            >
              <div className="text-lg font-black leading-tight text-slate-900">{stats.promDiurno.toFixed(1)}</div>
              <div className={`text-[9px] font-extrabold uppercase ${turnoFilter === 'diurno' ? 'text-amber-100' : 'text-amber-700'}`}>
                Día
              </div>
            </button>

            {/* Noche Button Pill */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setTurnoFilter(prev => prev === 'noche' ? 'all' : 'noche');
                setPage(1);
              }}
              className={`flex-1 py-1 px-1.5 rounded-lg text-center transition-all cursor-pointer border ${
                turnoFilter === 'noche'
                  ? 'bg-indigo-600 text-white font-black border-indigo-700 shadow-xs'
                  : 'bg-slate-50 hover:bg-indigo-50 text-slate-900 border-slate-200 hover:border-indigo-300'
              }`}
              title="Filtrar solo registros de Turno Noche"
            >
              <div className="text-lg font-black leading-tight text-indigo-600">{stats.promNoche.toFixed(1)}</div>
              <div className={`text-[9px] font-extrabold uppercase ${turnoFilter === 'noche' ? 'text-indigo-100' : 'text-indigo-600'}`}>
                Noche
              </div>
            </button>
          </div>

          <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between font-semibold">
            <span className="text-amber-700">{stats.pctDiurno.toFixed(0)}% Día</span>
            <span className="text-indigo-700">{stats.pctNoche.toFixed(0)}% Noche</span>
          </div>
          {turnoFilter !== 'all' && (
            <div className="mt-1 pt-1 border-t border-slate-200 flex items-center justify-between text-[10px] font-bold text-indigo-700">
              <span>✓ Solo {turnoFilter === 'diurno' ? 'Diurno' : 'Noche'}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setTurnoFilter('all');
                  setPage(1);
                }}
                className="underline text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Quitar ✕
              </button>
            </div>
          )}
        </div>

        {/* Empresas Activas / Top Contratista */}
        <div
          id="kpi-card-contratistas"
          role="button"
          tabIndex={0}
          onClick={() => {
            if (empresaFilter !== 'all') {
              setEmpresaFilter('all');
            } else if (stats.topEmpresa) {
              setEmpresaFilter(stats.topEmpresa.empresa);
            }
            setPage(1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              if (empresaFilter !== 'all') {
                setEmpresaFilter('all');
              } else if (stats.topEmpresa) {
                setEmpresaFilter(stats.topEmpresa.empresa);
              }
              setPage(1);
            }
          }}
          className={`rounded-2xl p-4 shadow-xs hover:shadow-md transition-all select-none cursor-pointer relative overflow-hidden group ${
            empresaFilter !== 'all'
              ? 'bg-indigo-100/90 border-2 border-indigo-500 ring-2 ring-indigo-300 shadow-md scale-[1.02]'
              : 'bg-indigo-50/50 border border-indigo-200/90 hover:border-indigo-400 hover:bg-indigo-50'
          }`}
          title={
            empresaFilter !== 'all'
              ? `Filtro ACTIVO: ${empresaFilter}. Haz clic para quitar filtro y ver todas`
              : stats.topEmpresa
              ? `Haz clic para filtrar por la empresa líder: ${stats.topEmpresa.empresa}`
              : 'Empresas contratistas activas'
          }
        >
          <div className="flex items-center justify-between text-indigo-800 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">Contratistas</span>
            <Building2 className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-indigo-950 tracking-tight font-mono">
            {stats.totalEmpresas}
          </div>
          <div className="text-[10px] text-indigo-700 mt-1 truncate font-medium" title={stats.topEmpresa?.empresa || ''}>
            Top: <strong>{stats.topEmpresa ? stats.topEmpresa.empresa.substring(0, 14) : 'N/A'}</strong>
          </div>
          <div className="mt-1.5 pt-1 border-t border-indigo-200/60 text-[10px] font-bold flex items-center justify-between">
            {empresaFilter !== 'all' ? (
              <span className="text-indigo-900 flex items-center gap-1 font-extrabold truncate">
                <span>✓ {empresaFilter.substring(0, 10)}</span>
                <span className="text-indigo-600 font-normal underline shrink-0">(✕)</span>
              </span>
            ) : stats.topEmpresa ? (
              <span className="text-indigo-700 group-hover:underline truncate text-[9px]">
                Prom: {stats.topEmpresa.promedioDiarioMesCorriente.toFixed(1)}/día ➔
              </span>
            ) : (
              <span className="text-indigo-400">Sin datos</span>
            )}
          </div>
        </div>
      </div>

      {/* Sub-view Navigation Bar / Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs" id="personal-subview-bar">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-black text-slate-900 block">Modo de Visualización de Personal</span>
            <span className="text-[11px] text-slate-500 font-medium">Selecciona el tipo de informe o análisis operativo</span>
          </div>
        </div>

        {/* Quick Sub-view Switcher Toggle */}
        <div className="inline-flex bg-slate-100/90 rounded-xl p-1 border border-slate-200" id="personal-subview-toggle">
          <button
            id="subview-toggle-graficos"
            onClick={() => setActiveSubView('graficos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubView === 'graficos'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gráficos y Distribución</span>
          </button>
          <button
            id="subview-toggle-resumen"
            onClick={() => setActiveSubView('resumen')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubView === 'resumen'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Resumen por Empresa</span>
          </button>
          <button
            id="subview-toggle-detalle"
            onClick={() => setActiveSubView('detalle')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubView === 'detalle'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Matriz Detallada de Asistencia y Actividades</span>
          </button>
        </div>
      </div>

      {/* VIEW CONTENT BASED ON ACTIVE SUBVIEW */}

      {/* SUBVIEW 1: RESUMEN POR EMPRESA */}
      {activeSubView === 'resumen' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-fade-in">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>Dotación Agrupada por Empresa Contratista</span>
              </h2>
              <p className="text-xs text-slate-500">
                Mostrando {resumenPorEmpresa.length} empresas contratistas. Los promedios corresponden a <strong className="text-indigo-900">{stats.mesCorrienteLabel}</strong> ({stats.numDiasMes} días activos).
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold px-3 py-1 rounded-xl">
                Prom. Diario Mes: <strong className="text-indigo-950 font-mono text-sm">{stats.promDiario.toFixed(1)}</strong>/día
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Total Acumulado: <strong className="text-slate-900 font-mono">{stats.totalPersonal.toLocaleString('en-US')}</strong>
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-extrabold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Empresa</th>
                  <th className="py-3 px-3 text-right bg-emerald-950 text-emerald-200" title="Promedio diario directo en el mes corriente">Prom. Directo</th>
                  <th className="py-3 px-3 text-right bg-amber-950 text-amber-200" title="Promedio diario indirecto en el mes corriente">Prom. Indirecto</th>
                  <th className="py-3 px-3 text-right" title="Promedio diario de hombres en el mes corriente">Prom. H</th>
                  <th className="py-3 px-3 text-right" title="Promedio diario de mujeres en el mes corriente">Prom. M</th>
                  <th className="py-3 px-3 text-right" title="Promedio diario turno diurno en el mes corriente">Prom. Día</th>
                  <th className="py-3 px-3 text-right" title="Promedio diario turno nocturno en el mes corriente">Prom. Noche</th>
                  <th className="py-3 px-4 text-right bg-indigo-950 text-indigo-100 font-black" title="Promedio Diario del Mes Corriente">Prom. Diario Mes</th>
                  <th className="py-3 px-3 text-right text-slate-300" title="Total Acumulado de todos los meses">Total Acum.</th>
                  <th className="py-3 px-4 text-right">% Dotación</th>
                  <th className="py-3 px-4">Frentes Principales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resumenPorEmpresa.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-slate-400 italic">
                      No se encontraron registros con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  resumenPorEmpresa.map((r, idx) => (
                    <tr
                      key={r.empresa}
                      className="hover:bg-indigo-50/40 transition-colors group cursor-default"
                    >
                      <td className="py-3 px-4 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{r.empresa}</span>
                          {r.ubicaciones.length > 1 && (
                            <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono">
                              {r.ubicaciones.join(', ')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-emerald-700 font-mono bg-emerald-50/30">
                        {r.directoPromedioMesCorriente > 0 ? r.directoPromedioMesCorriente.toFixed(1) : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-amber-700 font-mono bg-amber-50/30">
                        {r.indirectoPromedioMesCorriente > 0 ? r.indirectoPromedioMesCorriente.toFixed(1) : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-slate-700 font-mono">
                        {r.hombresPromedioMesCorriente > 0 ? r.hombresPromedioMesCorriente.toFixed(1) : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-rose-700 font-mono">
                        {r.mujeresPromedioMesCorriente > 0 ? r.mujeresPromedioMesCorriente.toFixed(1) : '-'}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600 font-mono">
                        {r.diurnoPromedioMesCorriente > 0 ? r.diurnoPromedioMesCorriente.toFixed(1) : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-indigo-700 font-semibold">
                        {r.nochePromedioMesCorriente > 0 ? r.nochePromedioMesCorriente.toFixed(1) : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-indigo-950 font-mono bg-indigo-50/60 text-sm">
                        {r.promedioDiarioMesCorriente.toFixed(1)}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-600 font-mono text-xs">
                        {r.total.toLocaleString('en-US')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden shrink-0">
                            <div
                              className="bg-indigo-600 h-full rounded-full"
                              style={{ width: `${Math.min(100, r.porcentaje * 2.5)}%` }}
                            />
                          </div>
                          <span className="font-bold text-slate-800 font-mono text-xs w-12 text-right">
                            {r.porcentaje.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-500 max-w-xs truncate" title={r.frentes.join(', ')}>
                        {r.frentes.slice(0, 3).join(', ')}
                        {r.frentes.length > 3 && <span className="text-slate-400"> +{r.frentes.length - 3}</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {resumenPorEmpresa.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-900 text-white font-extrabold text-xs">
                    <td colSpan={2} className="py-3 px-4">TOTAL GENERAL ({stats.mesCorrienteLabel})</td>
                    <td className="py-3 px-3 text-right text-emerald-300 font-mono font-black">{stats.promDirecto.toFixed(1)}</td>
                    <td className="py-3 px-3 text-right text-amber-300 font-mono font-black">{stats.promIndirecto.toFixed(1)}</td>
                    <td className="py-3 px-3 text-right font-mono">{stats.promHombres.toFixed(1)}</td>
                    <td className="py-3 px-3 text-right font-mono">{stats.promMujeres.toFixed(1)}</td>
                    <td className="py-3 px-3 text-right font-mono">{stats.promDiurno.toFixed(1)}</td>
                    <td className="py-3 px-3 text-right font-mono">{stats.promNoche.toFixed(1)}</td>
                    <td className="py-3 px-4 text-right font-black font-mono text-base text-white bg-indigo-900">{stats.promDiario.toFixed(1)}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-300">{stats.totalPersonal.toLocaleString('en-US')}</td>
                    <td className="py-3 px-4 text-right font-mono">100.0%</td>
                    <td className="py-3 px-4 text-[11px] text-slate-300">{filteredRegistros.length} registros</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* SUBVIEW 2: GRAFICOS Y DISTRIBUCION */}
      {activeSubView === 'graficos' && (
        <div className="space-y-6 animate-fade-in">
          {/* 3 Donut Cards Grid - Clasificacion Operativa / Distribucion por Genero / Turnos Operativos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="donut-cards-summary-grid">
            {/* Donut 1: Directo vs Indirecto */}
            <div
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm text-center hover:border-emerald-300 transition-all cursor-pointer group"
              onClick={() => {
                setTipoFilter(prev => prev === 'all' ? 'Directo' : prev === 'Directo' ? 'Indirecto' : 'all');
                setPage(1);
              }}
              title="Haz clic para alternar filtro entre Directo, Indirecto o Todos"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider group-hover:text-emerald-700 transition-colors">
                  Clasificación Operativa
                </h4>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">
                  {stats.mesCorrienteLabel}
                </span>
              </div>

              <div className="relative w-40 h-40 mx-auto my-2 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="18" />
                  {stats.promDiario > 0 && (
                    <>
                      {/* Directo Arc */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="18"
                        strokeDasharray={`${stats.pctDirecto * 2.387} 238.7`}
                      />
                      {/* Indirecto Arc */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="18"
                        strokeDasharray={`${stats.pctIndirecto * 2.387} 238.7`}
                        strokeDashoffset={`-${stats.pctDirecto * 2.387}`}
                      />
                    </>
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-black text-slate-900 font-mono">{stats.promDiario.toFixed(1)}</span>
                  <span className="text-[9px] text-slate-400 font-extrabold uppercase">Prom. / Día</span>
                </div>
              </div>

              <div className="flex justify-around text-xs mt-3 pt-3 border-t border-slate-100">
                <div className="text-left">
                  <span className="flex items-center gap-1.5 text-slate-600 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Directo</span>
                  </span>
                  <span className="text-sm font-black text-emerald-700 font-mono block pl-4">
                    {stats.promDirecto.toFixed(1)} <span className="text-xs font-medium text-emerald-600">({stats.pctDirecto.toFixed(1)}%)</span>
                  </span>
                </div>

                <div className="text-left">
                  <span className="flex items-center gap-1.5 text-slate-600 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span>Indirecto</span>
                  </span>
                  <span className="text-sm font-black text-amber-700 font-mono block pl-4">
                    {stats.promIndirecto.toFixed(1)} <span className="text-xs font-medium text-amber-600">({stats.pctIndirecto.toFixed(1)}%)</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Donut 2: Género Hombres vs Mujeres */}
            <div
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm text-center hover:border-indigo-300 transition-all cursor-pointer group"
              onClick={() => {
                setGeneroFilter(prev => prev === 'all' ? 'hombres' : prev === 'hombres' ? 'mujeres' : 'all');
                setPage(1);
              }}
              title="Haz clic para alternar filtro entre Hombres, Mujeres o Todos"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider group-hover:text-indigo-700 transition-colors">
                  Distribución por Género
                </h4>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">
                  {stats.mesCorrienteLabel}
                </span>
              </div>

              <div className="relative w-40 h-40 mx-auto my-2 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="18" />
                  {stats.promDiario > 0 && (
                    <>
                      {/* Hombres Arc */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="none"
                        stroke="#6366f1"
                        strokeWidth="18"
                        strokeDasharray={`${stats.pctHombres * 2.387} 238.7`}
                      />
                      {/* Mujeres Arc */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="none"
                        stroke="#ec4899"
                        strokeWidth="18"
                        strokeDasharray={`${stats.pctMujeres * 2.387} 238.7`}
                        strokeDashoffset={`-${stats.pctHombres * 2.387}`}
                      />
                    </>
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-black text-slate-900 font-mono">{stats.promDiario.toFixed(1)}</span>
                  <span className="text-[9px] text-slate-400 font-extrabold uppercase">Prom. / Día</span>
                </div>
              </div>

              <div className="flex justify-around text-xs mt-3 pt-3 border-t border-slate-100">
                <div className="text-left">
                  <span className="flex items-center gap-1.5 text-slate-600 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    <span>Hombres</span>
                  </span>
                  <span className="text-sm font-black text-indigo-700 font-mono block pl-4">
                    {stats.promHombres.toFixed(1)} <span className="text-xs font-medium text-indigo-600">({stats.pctHombres.toFixed(1)}%)</span>
                  </span>
                </div>

                <div className="text-left">
                  <span className="flex items-center gap-1.5 text-slate-600 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-pink-500" />
                    <span>Mujeres</span>
                  </span>
                  <span className="text-sm font-black text-pink-700 font-mono block pl-4">
                    {stats.promMujeres.toFixed(1)} <span className="text-xs font-medium text-pink-600">({stats.pctMujeres.toFixed(1)}%)</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Donut 3: Turnos Diurno vs Noche */}
            <div
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm text-center hover:border-amber-300 transition-all cursor-pointer group"
              onClick={() => {
                setTurnoFilter(prev => prev === 'all' ? 'diurno' : prev === 'diurno' ? 'noche' : 'all');
                setPage(1);
              }}
              title="Haz clic para alternar filtro entre Diurno, Noche o Todos"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider group-hover:text-amber-700 transition-colors">
                  Turnos Operativos
                </h4>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">
                  {stats.mesCorrienteLabel}
                </span>
              </div>

              <div className="relative w-40 h-40 mx-auto my-2 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="18" />
                  {stats.promDiario > 0 && (
                    <>
                      {/* Diurno Arc */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="18"
                        strokeDasharray={`${stats.pctDiurno * 2.387} 238.7`}
                      />
                      {/* Noche Arc */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="18"
                        strokeDasharray={`${stats.pctNoche * 2.387} 238.7`}
                        strokeDashoffset={`-${stats.pctDiurno * 2.387}`}
                      />
                    </>
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-black text-slate-900 font-mono">{stats.promDiario.toFixed(1)}</span>
                  <span className="text-[9px] text-slate-400 font-extrabold uppercase">Prom. / Día</span>
                </div>
              </div>

              <div className="flex justify-around text-xs mt-3 pt-3 border-t border-slate-100">
                <div className="text-left">
                  <span className="flex items-center gap-1.5 text-slate-600 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span>Diurno</span>
                  </span>
                  <span className="text-sm font-black text-amber-700 font-mono block pl-4">
                    {stats.promDiurno.toFixed(1)} <span className="text-xs font-medium text-amber-600">({stats.pctDiurno.toFixed(1)}%)</span>
                  </span>
                </div>

                <div className="text-left">
                  <span className="flex items-center gap-1.5 text-slate-600 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span>Nocturno</span>
                  </span>
                  <span className="text-sm font-black text-blue-700 font-mono block pl-4">
                    {stats.promNoche.toFixed(1)} <span className="text-xs font-medium text-blue-600">({stats.pctNoche.toFixed(1)}%)</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Top Frentes de Trabajo */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm transition-all overflow-hidden" id="top-frentes-personal-card">
            <div
              onClick={() => setIsTopFrentesCollapsed(prev => !prev)}
              className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-2 cursor-pointer select-none hover:bg-slate-50/70 transition-colors border-b border-transparent data-[open=true]:border-slate-100"
              data-open={!isTopFrentesCollapsed}
              role="button"
              tabIndex={0}
              title={isTopFrentesCollapsed ? "Haz clic para expandir frentes" : "Haz clic para colapsar frentes"}
            >
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <HardHat className="w-4 h-4 text-indigo-600" />
                  <span>Top 10 Frentes con Mayor Concentración de Personal</span>
                  <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-full ml-1 font-mono">
                    {frentesDistribucion.length}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Promedio diario por frente de trabajo en <strong className="text-indigo-900">{stats.mesCorrienteLabel}</strong> ({stats.numDiasMes} {stats.numDiasMes === 1 ? 'día activo' : 'días activos'}).
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold px-3 py-1 rounded-xl">
                  Prom. Obra: <strong className="text-indigo-950 font-mono text-sm">{stats.promDiario.toFixed(1)}</strong>/día
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsTopFrentesCollapsed(prev => !prev);
                  }}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                  aria-label={isTopFrentesCollapsed ? "Expandir" : "Colapsar"}
                >
                  {isTopFrentesCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {!isTopFrentesCollapsed && (
              <div className="p-4 sm:p-5 pt-1 sm:pt-2 border-t border-slate-100 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                  {frentesDistribucion.map((f, i) => {
                    const isIndirecto = clasificarTipoPersonal(f.frente) === 'Indirecto';
                    const isSelected = frenteFilter === f.frente;
                    const pctDelMes = stats.promDiario > 0 ? (f.promedioDiarioMes / stats.promDiario) * 100 : 0;

                    return (
                      <div
                        key={f.frente}
                        onClick={() => {
                          setFrenteFilter(prev => prev === f.frente ? 'all' : f.frente);
                          setPage(1);
                        }}
                        role="button"
                        tabIndex={0}
                        title={`Haz clic para filtrar por el frente: ${f.frente} (Promedio: ${f.promedioDiarioMes.toFixed(1)} personas/día en ${stats.mesCorrienteLabel})`}
                        className={`p-3 rounded-xl border transition-all cursor-pointer select-none hover:shadow-md hover:scale-[1.02] ${
                          isSelected
                            ? 'bg-indigo-100 border-2 border-indigo-500 ring-2 ring-indigo-300 shadow-md'
                            : isIndirecto
                            ? 'bg-amber-50/50 border-amber-200 text-amber-950 hover:bg-amber-100/60'
                            : 'bg-emerald-50/50 border-emerald-200 text-emerald-950 hover:bg-emerald-100/60'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                            #{i + 1}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                              isSelected
                                ? 'bg-indigo-600 text-white'
                                : isIndirecto
                                ? 'bg-amber-200 text-amber-900'
                                : 'bg-emerald-200 text-emerald-900'
                            }`}
                          >
                            {isIndirecto ? 'Indirecto' : 'Directo'}
                          </span>
                        </div>
                        <div className="text-xs font-bold truncate" title={f.frente}>
                          {f.frente}
                        </div>
                        <div className="text-lg font-black font-mono mt-1 text-slate-900">
                          {f.promedioDiarioMes.toFixed(1)} <span className="text-[11px] font-medium text-slate-500">prom/día</span>
                        </div>
                        <div className="mt-1.5 pt-1 border-t border-slate-200/60 text-[10px] text-slate-500 flex items-center justify-between font-mono">
                          <span className="font-bold text-slate-700">{pctDelMes.toFixed(1)}% mes</span>
                          <span title="Total acumulado multimes" className="text-slate-400">Acum: {f.totalAcumulado}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Top Actividades de Trabajo */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm transition-all overflow-hidden" id="top-actividades-personal-card">
            <div
              onClick={() => setIsTopActividadesCollapsed(prev => !prev)}
              className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-2 cursor-pointer select-none hover:bg-slate-50/70 transition-colors border-b border-transparent data-[open=true]:border-slate-100"
              data-open={!isTopActividadesCollapsed}
              role="button"
              tabIndex={0}
              title={isTopActividadesCollapsed ? "Haz clic para expandir actividades" : "Haz clic para colapsar actividades"}
            >
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-indigo-600" />
                  <span>Top 20 Actividades con Mayor Concentración de Personal</span>
                  <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-full ml-1 font-mono">
                    {actividadesDistribucion.length}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Promedio diario por actividad en <strong className="text-indigo-900">{stats.mesCorrienteLabel}</strong> ({stats.numDiasMes} {stats.numDiasMes === 1 ? 'día activo' : 'días activos'}).
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold px-3 py-1 rounded-xl">
                  Prom. Obra: <strong className="text-indigo-950 font-mono text-sm">{stats.promDiario.toFixed(1)}</strong>/día
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsTopActividadesCollapsed(prev => !prev);
                  }}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                  aria-label={isTopActividadesCollapsed ? "Expandir" : "Colapsar"}
                >
                  {isTopActividadesCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {!isTopActividadesCollapsed && (
              <div className="p-4 sm:p-5 pt-1 sm:pt-2 border-t border-slate-100 animate-fade-in">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                  {actividadesDistribucion.map((a, i) => {
                    const isIndirecto = a.indirectoMes > a.directoMes;
                    const isSelected = searchQuery.toLowerCase() === a.actividad.toLowerCase();
                    const pctDelMes = stats.promDiario > 0 ? (a.promedioDiarioMes / stats.promDiario) * 100 : 0;

                    return (
                      <div
                        key={a.actividad}
                        onClick={() => {
                          setSearchQuery(prev => prev.toLowerCase() === a.actividad.toLowerCase() ? '' : a.actividad);
                          setPage(1);
                        }}
                        role="button"
                        tabIndex={0}
                        title={`Haz clic para filtrar por la actividad: ${a.actividad} (Promedio: ${a.promedioDiarioMes.toFixed(1)} personas/día en ${stats.mesCorrienteLabel})`}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer select-none hover:shadow-md hover:scale-[1.01] ${
                          isSelected
                            ? 'bg-indigo-100 border-2 border-indigo-500 ring-2 ring-indigo-300 shadow-md'
                            : isIndirecto
                            ? 'bg-amber-50/50 border-amber-200 text-amber-950 hover:bg-amber-100/60'
                            : 'bg-emerald-50/50 border-emerald-200 text-emerald-950 hover:bg-emerald-100/60'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                            #{i + 1}
                          </span>
                          <span
                            className={`text-[8px] font-bold px-1.5 py-0.5 rounded font-mono ${
                              isSelected
                                ? 'bg-indigo-600 text-white'
                                : isIndirecto
                                ? 'bg-amber-200 text-amber-900'
                                : 'bg-emerald-200 text-emerald-900'
                            }`}
                          >
                            {isIndirecto ? 'Indirecto' : 'Directo'}
                          </span>
                        </div>
                        <div className="text-[11px] font-bold truncate leading-tight text-slate-900" title={a.actividad}>
                          {a.actividad}
                        </div>
                        <div className="text-base font-black font-mono mt-0.5 text-slate-900 leading-tight flex items-baseline gap-1">
                          {a.promedioDiarioMes.toFixed(1)} <span className="text-[10px] font-normal text-slate-500">prom/d</span>
                        </div>
                        <div className="mt-1 pt-1 border-t border-slate-200/60 text-[9px] text-slate-500 flex items-center justify-between font-mono">
                          <span className="font-bold text-slate-700">{pctDelMes.toFixed(1)}% mes</span>
                          <span title="Total acumulado multimes" className="text-slate-400">Acum: {a.totalAcumulado}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Gráfico de Líneas de Tendencia Mensual y Semanal (Directo vs Indirecto vs Total) */}
          <PersonalTrendChart
            allRegistros={normalizedRegistros}
            filteredRegistros={filteredRegistros}
            ubicacionFilter={ubicacionFilter}
            mesFilter={mesFilter}
            setMesFilter={(m) => {
              setMesFilter(m);
              setPage(1);
            }}
            semanaFilter={semanaFilter}
            setSemanaFilter={(s) => {
              setSemanaFilter(s);
              setPage(1);
            }}
            fechaFilter={fechaFilter}
            tipoFilter={tipoFilter}
            setTipoFilter={(t) => {
              setTipoFilter(t);
              setPage(1);
            }}
            empresaFilter={empresaFilter}
            setEmpresaFilter={(emp) => {
              setEmpresaFilter(emp);
              setPage(1);
            }}
            frenteFilter={frenteFilter}
            turnoFilter={turnoFilter}
            generoFilter={generoFilter}
            searchQuery={searchQuery}
            availableMeses={availableMeses}
            availableSemanas={availableSemanas}
          />

          {/* Top 12 Empresas: Stacked Bar Chart */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  <span>Top 12 Contratistas por Cantidad de Personal (Directo vs Indirecto)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Promedio diario y dotación por empresa en <strong className="text-indigo-900">{stats.mesCorrienteLabel}</strong> clasificada por tipo.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-500" />
                  <span className="text-slate-700">Directo</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-amber-500" />
                  <span className="text-slate-700">Indirecto</span>
                </span>
              </div>
            </div>

            {/* Horizontal Stacked Bars */}
            <div className="space-y-2.5">
              {resumenPorEmpresa.slice(0, 12).map(r => {
                const maxAvg = resumenPorEmpresa[0]?.promedioDiarioMesCorriente || 1;
                const pctDirectoBar = (r.directoPromedioMesCorriente / maxAvg) * 100;
                const pctIndirectoBar = (r.indirectoPromedioMesCorriente / maxAvg) * 100;

                return (
                  <div key={r.empresa} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 truncate max-w-sm">{r.empresa}</span>
                      <div className="flex items-center gap-2 font-mono text-xs">
                        {r.directoPromedioMesCorriente > 0 && (
                          <span className="text-emerald-700 font-bold" title={`Directo mes: ${r.directoPromedioMesCorriente.toFixed(1)}/día`}>
                            {r.directoPromedioMesCorriente.toFixed(1)} dir
                          </span>
                        )}
                        {r.indirectoPromedioMesCorriente > 0 && (
                          <span className="text-amber-700 font-bold" title={`Indirecto mes: ${r.indirectoPromedioMesCorriente.toFixed(1)}/día`}>
                            {r.indirectoPromedioMesCorriente.toFixed(1)} ind
                          </span>
                        )}
                        <span className="font-black text-indigo-950 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-[11px]">
                          Prom: {r.promedioDiarioMesCorriente.toFixed(1)}/día ({r.porcentaje.toFixed(1)}%)
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal hidden sm:inline" title="Total Acumulado Multimes">
                          (Acum: {r.total})
                        </span>
                      </div>
                    </div>

                    <div className="w-full bg-slate-100 h-5.5 rounded-lg overflow-hidden flex shadow-inner">
                      {pctDirectoBar > 0 && (
                        <div
                          className="bg-emerald-500 hover:bg-emerald-600 transition-all flex items-center justify-center text-[10px] text-white font-black shrink-0 px-1 leading-none select-none"
                          style={{
                            width: `${pctDirectoBar}%`,
                            minWidth: r.directoPromedioMesCorriente > 0 ? '22px' : '0px'
                          }}
                          title={`${r.empresa} - Promedio Directo: ${r.directoPromedioMesCorriente.toFixed(1)}/día`}
                        >
                          {r.directoPromedioMesCorriente.toFixed(1)}
                        </div>
                      )}
                      {pctIndirectoBar > 0 && (
                        <div
                          className="bg-amber-500 hover:bg-amber-600 transition-all flex items-center justify-center text-[10px] text-white font-black shrink-0 px-1 leading-none select-none"
                          style={{
                            width: `${pctIndirectoBar}%`,
                            minWidth: r.indirectoPromedioMesCorriente > 0 ? '22px' : '0px'
                          }}
                          title={`${r.empresa} - Promedio Indirecto: ${r.indirectoPromedioMesCorriente.toFixed(1)}/día`}
                        >
                          {r.indirectoPromedioMesCorriente.toFixed(1)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUBVIEW 3: MATRIZ DIARIA DETALLADA */}
      {activeSubView === 'detalle' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-fade-in">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Matriz Detallada de Asistencia y Actividades</span>
              </h2>
              <p className="text-xs text-slate-500">
                Mostrando {paginatedRegistros.length} de {filteredRegistros.length} registros filtrados.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <span>Filas:</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium cursor-pointer"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={-1}>Todos</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-extrabold text-[11px] uppercase tracking-wider select-none">
                  <th
                    className="py-3 px-3 cursor-pointer hover:bg-slate-800"
                    onClick={() => {
                      if (sortField === 'fecha') setSortAsc(!sortAsc);
                      else { setSortField('fecha'); setSortAsc(true); }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span>Fecha</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3 px-3">Ubicación</th>
                  <th className="py-3 px-2 text-center">ID</th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:bg-slate-800"
                    onClick={() => {
                      if (sortField === 'empresa') setSortAsc(!sortAsc);
                      else { setSortField('empresa'); setSortAsc(true); }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span>Empresa</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:bg-slate-800"
                    onClick={() => {
                      if (sortField === 'frente') setSortAsc(!sortAsc);
                      else { setSortField('frente'); setSortAsc(true); }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span>Frente</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center">Tipo</th>
                  <th className="py-3 px-4">Actividad</th>
                  <th className="py-3 px-2 text-right bg-slate-800 text-slate-300">Hd</th>
                  <th className="py-3 px-2 text-right bg-slate-800 text-slate-300">Md</th>
                  <th className="py-3 px-2 text-right bg-slate-800 text-slate-300">Hn</th>
                  <th className="py-3 px-2 text-right bg-slate-800 text-slate-300">Mn</th>
                  <th className="py-3 px-2.5 text-right font-bold">H</th>
                  <th className="py-3 px-2.5 text-right font-bold text-rose-300">M</th>
                  <th
                    className="py-3 px-3.5 text-right bg-indigo-950 text-white cursor-pointer hover:bg-indigo-900"
                    onClick={() => {
                      if (sortField === 'total') setSortAsc(!sortAsc);
                      else { setSortField('total'); setSortAsc(false); }
                    }}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Total</span>
                      <ArrowUpDown className="w-3 h-3 text-indigo-300" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRegistros.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="py-8 text-center text-slate-400 italic">
                      No se encontraron actividades registradas con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  paginatedRegistros.map((r, idx) => {
                    const isDirecto = r.tipo === 'Directo';
                    return (
                      <tr
                        key={r.id || idx}
                        className="hover:bg-indigo-50/30 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                          {r.fecha}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                            {r.ubicacion}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center text-slate-400 font-mono text-[10px]">
                          {r.rawId || idx + 1}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                          {r.empresa}
                        </td>
                        <td className="py-2.5 px-4 text-slate-800 font-medium">
                          {r.frente}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full inline-block ${
                              isDirecto
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-900 border border-amber-200'
                            }`}
                          >
                            {r.tipo}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 text-[11px] max-w-xs truncate" title={r.actividad}>
                          {r.actividad || '-'}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-500">
                          {r.hd > 0 ? r.hd : ''}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-500">
                          {r.md > 0 ? r.md : ''}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-500">
                          {r.hn > 0 ? r.hn : ''}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-500">
                          {r.mn > 0 ? r.mn : ''}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono font-bold text-slate-800">
                          {r.h}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono font-bold text-rose-700">
                          {r.m > 0 ? r.m : '-'}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono font-black text-indigo-950 bg-indigo-50/50">
                          {r.total}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar */}
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Página <strong>{page}</strong> de <strong>{totalPages}</strong> ({filteredRegistros.length} registros totales)
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Anterior
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      </>
      )}

      {/* UPLOAD MODAL */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 relative">
            <button
              onClick={() => {
                setIsUploadModalOpen(false);
                setUploadFeedback(null);
              }}
              className="absolute right-5 top-5 text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Cargar Matriz de Personal</h3>
                <p className="text-xs text-slate-500">Soporta libros Excel (.xlsx, .xls) con hojas <em>merinos</em> y <em>progreso</em> o archivos .csv</p>
              </div>
            </div>

            {syncProgress && (
              <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs font-semibold mb-4 space-y-2">
                <div className="flex items-center justify-between text-indigo-900">
                  <div className="flex items-center gap-2">
                    <CloudUpload className="w-4 h-4 text-indigo-600 animate-pulse shrink-0" />
                    <span>{syncProgress.message}</span>
                  </div>
                  <span className="font-mono text-indigo-700">{syncProgress.pct}%</span>
                </div>
                <div className="w-full bg-indigo-200/70 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${syncProgress.pct}%` }}
                  />
                </div>
              </div>
            )}

            {uploadFeedback && !syncProgress && (
              <div
                className={`p-3.5 rounded-2xl text-xs font-semibold mb-4 flex items-start gap-2.5 ${
                  uploadFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {uploadFeedback.type === 'success' ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span>{uploadFeedback.message}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Drag and Drop Box */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed transition-all rounded-2xl p-8 text-center cursor-pointer group ${
                  isDragging
                    ? 'border-indigo-600 bg-indigo-100/80 scale-[1.02]'
                    : 'border-indigo-300 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50/70'
                }`}
              >
                <FileSpreadsheet className={`w-10 h-10 text-indigo-500 mx-auto mb-2 transition-transform ${isDragging ? 'scale-125' : 'group-hover:scale-110'}`} />
                <div className="text-sm font-bold text-slate-800">
                  {isDragging ? '¡Suelta el archivo aquí!' : 'Haz clic o arrastra tu archivo Excel / CSV aquí'}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Formatos compatibles: .xlsx, .xls, .csv, .txt (separado por comas, punto y coma o tabulaciones)
                </div>
              </div>

              {/* Instructions Callout */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 text-xs text-slate-600 space-y-1.5">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Estructura esperada de la matriz:</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed font-mono">
                  Fecha | id | EMPRESAS | Frente | ACTIVIDAD | Hd | Md | Hn | Mn | H | M | Total
                </p>
                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200 space-y-1">
                  <div>
                    💡 <strong>Clasificación automática:</strong> Los frentes que contengan <em>campamento</em>, <em>bodega</em>, <em>puerta norte</em> o <em>puerta sur</em> se etiquetan automáticamente como <strong>Personal Indirecto</strong>.
                  </div>
                  <div className="text-slate-600 font-medium">
                    ⚡ <strong>Procesamiento local inmediato:</strong> Los datos se procesan en tu sesión para visualización instantánea y cálculos en tiempo real.
                  </div>
                </div>
              </div>

              {/* Reset to sample button */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleResetSampleData}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Restaurar datos de muestra (Guayaquil)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    setUploadFeedback(null);
                  }}
                  className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
