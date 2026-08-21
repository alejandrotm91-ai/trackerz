/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import { PersonalRegistro, TipoPersonal, PersonalResumenEmpresa } from '../types/personal';

const MESES_ES: Record<string, number> = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
  jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
};

const MESES_NOMBRES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/**
 * Clasifica si una actividad / frente / empresa corresponde a personal Directo o Indirecto
 * REGLAS DE NEGOCIO:
 * 1. Si la empresa (Columna C) contiene "ACCIONA" o "CONRAYO" (ej. "ACCIONA", "ACCIONA AGUA", "CONRAYO", etc.)
 *    se clasifica automáticamente como Personal Indirecto.
 * 2. Si la columna Frente (Columna D) contiene algo relacionado con:
 *    - campamento
 *    - bodega
 *    - puerta norte
 *    - puerta sur
 *    se clasifica como Personal Indirecto.
 * 3. Si la columna Actividad (Columna E) incluye "Mediciones de Topografia" / "Topografia":
 *    - Si corresponde a la empresa LICOSA -> Personal Directo
 *    - Para cualquier otra empresa -> Personal Indirecto
 * 4. De lo contrario, se clasifica como Personal Directo.
 */
export function clasificarTipoPersonal(frente: string, empresa?: string, actividad?: string): TipoPersonal {
  // 1. Regla de Empresa: Si en la columna C de empresas contiene "Acciona" o "Conrayo" -> Indirecto
  if (empresa) {
    const empLower = empresa
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
    if (empLower.includes('acciona') || empLower.includes('conrayo')) {
      return 'Indirecto';
    }
  }

  // 2. Regla de Frente: Si contiene campamento, bodega, puerta norte, puerta sur -> Indirecto
  if (frente) {
    const fLower = frente
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

    if (
      fLower.includes('campamento') ||
      fLower.includes('bodega') ||
      fLower.includes('puerta norte') ||
      fLower.includes('puerta sur')
    ) {
      return 'Indirecto';
    }
  }

  // 3. Regla de Actividad: Mediciones de Topografía
  // Si corresponde a Licosa es personal directo; todo lo demás es indirecto
  if (actividad) {
    const actLower = actividad
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

    const isTopografia =
      actLower.includes('mediciones de topografia') ||
      actLower.includes('medicion de topografia') ||
      actLower.includes('topografia') ||
      (actLower.includes('medicion') && actLower.includes('topograf'));

    if (isTopografia) {
      const empLower = empresa
        ? empresa.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
        : '';
      
      if (empLower.includes('licosa')) {
        return 'Directo';
      }
      return 'Indirecto';
    }
  }

  return 'Directo';
}

/**
 * Parsea una fecha en diversos formatos (17-ago-26, 17/08/2026, 2026-08-17, número de serie Excel, Date)
 */
export function parsePersonalDate(val: any): { fechaIso: string; fechaVisual: string; dateObj: Date; semanaKey: string; semanaLabel: string; mesKey: string; mesLabel: string } {
  let d: Date | null = null;
  let rawStr = '';

  if (val instanceof Date && !isNaN(val.getTime())) {
    d = val;
  } else if (typeof val === 'number') {
    // Número serial de Excel
    const utc_days = Math.floor(val - 25569);
    const d_utc = new Date(utc_days * 86400 * 1000);
    d = new Date(d_utc.getUTCFullYear(), d_utc.getUTCMonth(), d_utc.getUTCDate(), 12, 0, 0);
  } else if (typeof val === 'string') {
    rawStr = val.trim();
    const strLower = rawStr.toLowerCase();

    // Formato tipo "17-ago-26" o "17-ago-2026"
    const matchEspanol = strLower.match(/^(\d{1,2})[-/ ]([a-z]{3,10})[-/ ](\d{2,4})$/);
    if (matchEspanol) {
      const dia = parseInt(matchEspanol[1], 10);
      const mesTxt = matchEspanol[2];
      let anio = parseInt(matchEspanol[3], 10);
      if (anio < 100) anio += anio < 50 ? 2000 : 1900;
      
      const mesNum = MESES_ES[mesTxt.substring(0, 3)] ?? MESES_ES[mesTxt];
      if (mesNum !== undefined) {
        d = new Date(anio, mesNum, dia, 12, 0, 0);
      }
    }

    if (!d) {
      // Formato "DD/MM/YYYY" o "DD/MM/YY"
      const matchSlash = rawStr.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
      if (matchSlash) {
        const dia = parseInt(matchSlash[1], 10);
        const mes = parseInt(matchSlash[2], 10) - 1;
        let anio = parseInt(matchSlash[3], 10);
        if (anio < 100) anio += anio < 50 ? 2000 : 1900;
        d = new Date(anio, mes, dia, 12, 0, 0);
      }
    }

    if (!d) {
      // Formato ISO "YYYY-MM-DD"
      const matchIso = rawStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
      if (matchIso) {
        d = new Date(parseInt(matchIso[1], 10), parseInt(matchIso[2], 10) - 1, parseInt(matchIso[3], 10), 12, 0, 0);
      }
    }
  }

  if (!d || isNaN(d.getTime())) {
    d = new Date(); // fallback
  }

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const fechaIso = `${yyyy}-${mm}-${dd}`;

  // Formato visual amigable "17-ago-26"
  const mesCorto = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getMonth()];
  const anioCorto = String(yyyy).slice(-2);
  const fechaVisual = `${dd}-${mesCorto}-${anioCorto}`;

  // Calcular número de semana ISO
  const dCopy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = dCopy.getUTCDay() || 7;
  dCopy.setUTCDate(dCopy.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dCopy.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((dCopy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  // Inicio de la semana (Lunes)
  const monday = new Date(d);
  const currentDay = d.getDay();
  const diffToMonday = d.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
  monday.setDate(diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const monDd = String(monday.getDate()).padStart(2, '0');
  const monMm = String(monday.getMonth() + 1).padStart(2, '0');
  const sunDd = String(sunday.getDate()).padStart(2, '0');
  const sunMm = String(sunday.getMonth() + 1).padStart(2, '0');

  const semanaKey = `${yyyy}-W${String(weekNo).padStart(2, '0')}`;
  const semanaLabel = `Sem ${weekNo} (${monDd}/${monMm} - ${sunDd}/${sunMm})`;

  const mesKey = `${yyyy}-${mm}`;
  const mesLabel = `${MESES_NOMBRES[d.getMonth()]} ${yyyy}`;

  return {
    fechaIso,
    fechaVisual: rawStr || fechaVisual,
    dateObj: d,
    semanaKey,
    semanaLabel,
    mesKey,
    mesLabel
  };
}

/**
 * Normaliza nombres de empresas (elimina saltos de línea internos y dobles espacios)
 * Reglas de negocio:
 * 1. "ACCIONA" y "ACCIONA AGUA" (o cualquier variante de Acciona) se consolidan en una única empresa: "ACCIONA".
 */
export function cleanEmpresaName(raw: any): string {
  if (!raw) return 'SIN EMPRESA';
  const clean = String(raw).replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();

  const normalized = clean
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Consolidar Acciona y Acciona Agua en ACCIONA
  if (normalized.startsWith('acciona') || normalized.includes('acciona')) {
    return 'ACCIONA';
  }

  return clean;
}

/**
 * Estandariza los nombres de frentes de trabajo para evitar duplicidades
 * y variaciones de redacción del analista.
 * Regla de negocio: Si el frente contiene "campamento" (independientemente de que
 * indique "de oficinas", "de oficinas y campo", etc.), se unifica en un solo frente: "Campamento".
 */
export function standardizeFrente(raw: any): string {
  if (!raw) return 'Sin Frente';
  const str = String(raw).replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
  if (!str) return 'Sin Frente';

  const normalized = str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Regla: Si contiene "campamento" -> "Campamento"
  if (normalized.includes('campamento')) {
    return 'Campamento';
  }

  return str;
}

/**
 * Estandariza los nombres de actividades para evitar duplicidades
 * y variaciones de redacción del analista.
 * Reglas de negocio:
 * 1. Si contiene "tecnico" y "administrativo" -> "Técnico Administrativo"
 * 2. Si contiene "instalacion" y ("electrica" o "electricas" o "electrico") -> "Instalación Eléctrica"
 */
export function standardizeActividad(raw: any): string {
  if (!raw) return 'Sin Actividad';
  const str = String(raw).replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
  if (!str) return 'Sin Actividad';

  const normalized = str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // 1. Técnico + Administrativo
  if (normalized.includes('tecnico') && normalized.includes('administrativ')) {
    return 'Técnico Administrativo';
  }

  // 2. Instalación + Eléctrica / Eléctricas
  if (
    normalized.includes('instalacion') &&
    (normalized.includes('electrica') || normalized.includes('electricas') || normalized.includes('electrico') || normalized.includes('electricos'))
  ) {
    return 'Instalación Eléctrica';
  }

  return str;
}

/**
 * Parsea un archivo de texto separado por punto y coma (;) o comas
 */
export function parsePersonalCsv(csvContent: string, defaultUbicacion = 'Merinos'): PersonalRegistro[] {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

  // Detectar delimitador (';', ',', o '\t')
  const firstLine = lines[0];
  const sep = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';

  const registros: PersonalRegistro[] = [];
  let headerIndex = -1;

  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const lLower = lines[i].toLowerCase();
    if (lLower.includes('fecha') && (lLower.includes('empresa') || lLower.includes('actividad') || lLower.includes('frente'))) {
      headerIndex = i;
      break;
    }
  }

  const startIndex = headerIndex >= 0 ? headerIndex + 1 : 1;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Manejar comillas si es necesario
    const cols = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 5) continue;

    const fechaRaw = cols[0];
    const rawId = cols[1];
    const empresaRaw = cleanEmpresaName(cols[2]);
    const frenteRaw = cols[3] || '';
    const actividadRaw = cols[4] || '';

    const hd = parseFloat(cols[5]) || 0;
    const md = parseFloat(cols[6]) || 0;
    const hn = parseFloat(cols[7]) || 0;
    const mn = parseFloat(cols[8]) || 0;
    
    let h = parseFloat(cols[9]);
    if (isNaN(h)) h = hd + hn;

    let m = parseFloat(cols[10]);
    if (isNaN(m)) m = md + mn;

    let total = parseFloat(cols[11]);
    if (isNaN(total) || total === 0) total = h + m;

    if (!fechaRaw && !empresaRaw && total === 0) continue;

    const parsedDate = parsePersonalDate(fechaRaw);
    const frenteClean = standardizeFrente(frenteRaw);
    const actividadClean = standardizeActividad(actividadRaw);
    const tipo = clasificarTipoPersonal(frenteClean, empresaRaw, actividadClean);

    registros.push({
      id: `per-${i}-${Math.random().toString(36).substring(2, 7)}`,
      rawId,
      fecha: parsedDate.fechaVisual,
      fechaIso: parsedDate.fechaIso,
      fechaDate: parsedDate.dateObj,
      semanaKey: parsedDate.semanaKey,
      semanaLabel: parsedDate.semanaLabel,
      mesKey: parsedDate.mesKey,
      mesLabel: parsedDate.mesLabel,
      empresa: empresaRaw,
      frente: frenteClean,
      actividad: actividadClean,
      tipo,
      hd,
      md,
      hn,
      mn,
      h,
      m,
      total,
      ubicacion: defaultUbicacion
    });
  }

  return registros;
}

/**
 * Parsea un libro Excel XLSX con múltiples hojas (e.g. 'merinos', 'progreso', etc.)
 */
export function parsePersonalWorkbook(workbook: XLSX.WorkBook): PersonalRegistro[] {
  const allRegistros: PersonalRegistro[] = [];

  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) return;

    // Normalizar nombre de ubicación
    let ubicacion = sheetName.trim();
    const sheetLower = sheetName.toLowerCase();
    if (sheetLower.includes('merino')) ubicacion = 'Merinos';
    else if (sheetLower.includes('progreso')) ubicacion = 'Progreso';

    const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: true });
    if (!rawData || rawData.length < 2) return;

    // Encontrar fila de encabezados
    let headerRowIdx = -1;
    let colMap: Record<string, number> = {};

    for (let r = 0; r < Math.min(10, rawData.length); r++) {
      const row = rawData[r];
      if (!row || !Array.isArray(row)) continue;

      const rowStr = row.map(cell => String(cell || '').toLowerCase()).join(' ');
      if (rowStr.includes('fecha') && (rowStr.includes('empresa') || rowStr.includes('frente') || rowStr.includes('actividad'))) {
        headerRowIdx = r;
        row.forEach((cell, cIdx) => {
          const c = String(cell || '').toLowerCase().trim();
          if (c.includes('fecha')) colMap['fecha'] = cIdx;
          else if (c === 'id' || c.includes('id')) colMap['id'] = cIdx;
          else if (c.includes('empresa')) colMap['empresa'] = cIdx;
          else if (c.includes('frente')) colMap['frente'] = cIdx;
          else if (c.includes('actividad')) colMap['actividad'] = cIdx;
          else if (c === 'hd' || c.includes('hombres diurno') || c.includes('h diurno')) colMap['hd'] = cIdx;
          else if (c === 'md' || c.includes('mujeres diurno') || c.includes('m diurno')) colMap['md'] = cIdx;
          else if (c === 'hn' || c.includes('hombres noche') || c.includes('h noche')) colMap['hn'] = cIdx;
          else if (c === 'mn' || c.includes('mujeres noche') || c.includes('m noche')) colMap['mn'] = cIdx;
          else if (c === 'h' || c === 'hombres' || c.includes('total h')) colMap['h'] = cIdx;
          else if (c === 'm' || c === 'mujeres' || c.includes('total m')) colMap['m'] = cIdx;
          else if (c === 'total' || c.includes('total')) colMap['total'] = cIdx;
        });
        break;
      }
    }

    const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 1;

    for (let r = startRow; r < rawData.length; r++) {
      const row = rawData[r];
      if (!row || row.length === 0) continue;

      const fechaVal = colMap['fecha'] !== undefined ? row[colMap['fecha']] : row[0];
      const idVal = colMap['id'] !== undefined ? row[colMap['id']] : row[1];
      const empresaVal = colMap['empresa'] !== undefined ? row[colMap['empresa']] : row[2];
      const frenteVal = colMap['frente'] !== undefined ? row[colMap['frente']] : row[3];
      const actividadVal = colMap['actividad'] !== undefined ? row[colMap['actividad']] : row[4];

      const hdVal = colMap['hd'] !== undefined ? parseFloat(row[colMap['hd']]) || 0 : parseFloat(row[5]) || 0;
      const mdVal = colMap['md'] !== undefined ? parseFloat(row[colMap['md']]) || 0 : parseFloat(row[6]) || 0;
      const hnVal = colMap['hn'] !== undefined ? parseFloat(row[colMap['hn']]) || 0 : parseFloat(row[7]) || 0;
      const mnVal = colMap['mn'] !== undefined ? parseFloat(row[colMap['mn']]) || 0 : parseFloat(row[8]) || 0;

      let hVal = colMap['h'] !== undefined ? parseFloat(row[colMap['h']]) : parseFloat(row[9]);
      if (isNaN(hVal)) hVal = hdVal + hnVal;

      let mVal = colMap['m'] !== undefined ? parseFloat(row[colMap['m']]) : parseFloat(row[10]);
      if (isNaN(mVal)) mVal = mdVal + mnVal;

      let totalVal = colMap['total'] !== undefined ? parseFloat(row[colMap['total']]) : parseFloat(row[11]);
      if (isNaN(totalVal) || totalVal === 0) totalVal = hVal + mVal;

      const empresaClean = cleanEmpresaName(empresaVal);
      const frenteStr = standardizeFrente(frenteVal);
      const actividadStr = standardizeActividad(actividadVal);

      if (!fechaVal && !empresaClean && totalVal === 0) continue;

      const parsedDate = parsePersonalDate(fechaVal);
      const tipo = clasificarTipoPersonal(frenteStr, empresaClean, actividadStr);

      allRegistros.push({
        id: `per-${ubicacion}-${r}-${Math.random().toString(36).substring(2, 7)}`,
        rawId: idVal,
        fecha: parsedDate.fechaVisual,
        fechaIso: parsedDate.fechaIso,
        fechaDate: parsedDate.dateObj,
        semanaKey: parsedDate.semanaKey,
        semanaLabel: parsedDate.semanaLabel,
        mesKey: parsedDate.mesKey,
        mesLabel: parsedDate.mesLabel,
        empresa: empresaClean,
        frente: frenteStr,
        actividad: actividadStr,
        tipo,
        hd: hdVal,
        md: mdVal,
        hn: hnVal,
        mn: mnVal,
        h: hVal,
        m: mVal,
        total: totalVal,
        ubicacion
      });
    }
  });

  return allRegistros;
}

/**
 * Agrupa registros de personal por Empresa para resúmenes, calculando
 * tanto el acumulado general como el desglose por mes y el Promedio Diario del Mes Corriente.
 */
export function agruparPorEmpresa(registros: PersonalRegistro[], mesCorrienteKey?: string): PersonalResumenEmpresa[] {
  // Encontrar el mes corriente si no se especifica: el mes más reciente presente en los registros
  const mesesDisponibles = new Map<string, { label: string; fechas: Set<string> }>();
  registros.forEach(r => {
    if (r.mesKey) {
      let m = mesesDisponibles.get(r.mesKey);
      if (!m) {
        m = { label: r.mesLabel || r.mesKey, fechas: new Set() };
        mesesDisponibles.set(r.mesKey, m);
      }
      if (r.fecha) m.fechas.add(r.fecha);
    }
  });

  const sortedMesKeys = Array.from(mesesDisponibles.keys()).sort((a, b) => b.localeCompare(a));
  const activeMonthKey = mesCorrienteKey && mesCorrienteKey !== 'all' ? mesCorrienteKey : sortedMesKeys[0] || '';
  const numDiasMesCorriente = Math.max(1, mesesDisponibles.get(activeMonthKey)?.fechas.size || 1);

  const map = new Map<string, {
    directoTotal: number;
    indirectoTotal: number;
    hombresTotal: number;
    mujeresTotal: number;
    diurnoTotal: number;
    nocheTotal: number;
    total: number;
    registros: number;
    frentes: Set<string>;
    ubicaciones: Set<string>;
    // Mes corriente
    mesCorrienteTotal: number;
    mesCorrienteDirecto: number;
    mesCorrienteIndirecto: number;
    mesCorrienteHombres: number;
    mesCorrienteMujeres: number;
    mesCorrienteDiurno: number;
    mesCorrienteNoche: number;
    // Desglose por todos los meses
    mesesMap: Map<string, {
      mesKey: string;
      mesLabel: string;
      total: number;
      directo: number;
      indirecto: number;
      hombres: number;
      mujeres: number;
      diurno: number;
      noche: number;
      fechas: Set<string>;
    }>;
  }>();

  let globalTotal = 0;

  registros.forEach(r => {
    const emp = r.empresa || 'SIN EMPRESA';
    globalTotal += r.total;

    let entry = map.get(emp);
    if (!entry) {
      entry = {
        directoTotal: 0,
        indirectoTotal: 0,
        hombresTotal: 0,
        mujeresTotal: 0,
        diurnoTotal: 0,
        nocheTotal: 0,
        total: 0,
        registros: 0,
        frentes: new Set(),
        ubicaciones: new Set(),
        mesCorrienteTotal: 0,
        mesCorrienteDirecto: 0,
        mesCorrienteIndirecto: 0,
        mesCorrienteHombres: 0,
        mesCorrienteMujeres: 0,
        mesCorrienteDiurno: 0,
        mesCorrienteNoche: 0,
        mesesMap: new Map()
      };
      map.set(emp, entry);
    }

    const frenteClean = standardizeFrente(r.frente);
    const tipoCalculado = clasificarTipoPersonal(frenteClean, r.empresa);
    if (tipoCalculado === 'Directo') {
      entry.directoTotal += r.total;
    } else {
      entry.indirectoTotal += r.total;
    }

    entry.hombresTotal += r.h;
    entry.mujeresTotal += r.m;
    entry.diurnoTotal += (r.hd + r.md);
    entry.nocheTotal += (r.hn + r.mn);
    entry.total += r.total;
    entry.registros += 1;

    if (frenteClean) entry.frentes.add(frenteClean);
    if (r.ubicacion) entry.ubicaciones.add(r.ubicacion);

    // Acumular si pertenece al mes corriente
    if (!activeMonthKey || r.mesKey === activeMonthKey) {
      entry.mesCorrienteTotal += r.total;
      if (tipoCalculado === 'Directo') entry.mesCorrienteDirecto += r.total;
      else entry.mesCorrienteIndirecto += r.total;
      entry.mesCorrienteHombres += r.h;
      entry.mesCorrienteMujeres += r.m;
      entry.mesCorrienteDiurno += (r.hd + r.md);
      entry.mesCorrienteNoche += (r.hn + r.mn);
    }

    // Desglose mensual
    if (r.mesKey) {
      let mEntry = entry.mesesMap.get(r.mesKey);
      if (!mEntry) {
        mEntry = {
          mesKey: r.mesKey,
          mesLabel: r.mesLabel || r.mesKey,
          total: 0,
          directo: 0,
          indirecto: 0,
          hombres: 0,
          mujeres: 0,
          diurno: 0,
          noche: 0,
          fechas: new Set()
        };
        entry.mesesMap.set(r.mesKey, mEntry);
      }
      mEntry.total += r.total;
      if (tipoCalculado === 'Directo') mEntry.directo += r.total;
      else mEntry.indirecto += r.total;
      mEntry.hombres += r.h;
      mEntry.mujeres += r.m;
      mEntry.diurno += (r.hd + r.md);
      mEntry.noche += (r.hn + r.mn);
      if (r.fecha) mEntry.fechas.add(r.fecha);
    }
  });

  const list: PersonalResumenEmpresa[] = [];
  map.forEach((val, emp) => {
    const desgloseMensual: Record<string, any> = {};
    val.mesesMap.forEach((mVal, mKey) => {
      const diasMesGlobal = Math.max(1, mesesDisponibles.get(mKey)?.fechas.size || 1);
      desgloseMensual[mKey] = {
        mesKey: mKey,
        mesLabel: mVal.mesLabel,
        total: mVal.total,
        promDiario: mVal.total / diasMesGlobal,
        directoTotal: mVal.directo,
        indirectoTotal: mVal.indirecto,
        directoPromedio: mVal.directo / diasMesGlobal,
        indirectoPromedio: mVal.indirecto / diasMesGlobal,
        hombresTotal: mVal.hombres,
        mujeresTotal: mVal.mujeres,
        diurnoTotal: mVal.diurno,
        nocheTotal: mVal.noche,
        numDias: diasMesGlobal
      };
    });

    list.push({
      empresa: emp,
      directoTotal: val.directoTotal,
      indirectoTotal: val.indirectoTotal,
      hombresTotal: val.hombresTotal,
      mujeresTotal: val.mujeresTotal,
      diurnoTotal: val.diurnoTotal,
      nocheTotal: val.nocheTotal,
      total: val.total,
      porcentaje: globalTotal > 0 ? (val.total / globalTotal) * 100 : 0,
      registros: val.registros,
      frentes: Array.from(val.frentes),
      ubicaciones: Array.from(val.ubicaciones),
      // Métricas promedio diario del mes corriente
      promedioDiarioMesCorriente: val.mesCorrienteTotal / numDiasMesCorriente,
      directoPromedioMesCorriente: val.mesCorrienteDirecto / numDiasMesCorriente,
      indirectoPromedioMesCorriente: val.mesCorrienteIndirecto / numDiasMesCorriente,
      hombresPromedioMesCorriente: val.mesCorrienteHombres / numDiasMesCorriente,
      mujeresPromedioMesCorriente: val.mesCorrienteMujeres / numDiasMesCorriente,
      diurnoPromedioMesCorriente: val.mesCorrienteDiurno / numDiasMesCorriente,
      nochePromedioMesCorriente: val.mesCorrienteNoche / numDiasMesCorriente,
      desgloseMensual
    });
  });

  return list.sort((a, b) => b.promedioDiarioMesCorriente - a.promedioDiarioMesCorriente || b.total - a.total);
}
