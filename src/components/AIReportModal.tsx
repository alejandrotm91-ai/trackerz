import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, X, RefreshCw, Copy, Check, Clock, UserCheck, AlertTriangle, ShieldAlert, Calendar, BarChart2, LayoutGrid, Package, ChevronDown, ChevronUp } from 'lucide-react';
import { AIReportData } from '../utils/firebaseSync';

interface AIReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: AIReportData | null;
  isAdmin: boolean;
  onUpdateReport: () => void;
  isGenerating: boolean;
}

// Helper to fix malformed single-line markdown tables with "||" or missing row linebreaks
function preprocessMarkdownText(markdown?: string): string {
  if (!markdown) return '';
  let text = markdown;

  // 1. Convert inline double pipes '||' into newlines starting with '| '
  text = text.replace(/\s*\|\|\s*/g, '\n| ');

  // 2. Fix cases where header alignment row is glued to the first data row
  text = text.replace(/(\|\s*:?-+:?\s*\|)\s*(\|\s*[*_a-zA-Z0-9])/g, '$1\n$2');

  const rawLines = text.split('\n');
  const resultLines: string[] = [];
  let inTable = false;

  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i].trim();
    if (!line) {
      if (inTable) {
        resultLines.push('');
        inTable = false;
      }
      continue;
    }

    // Check if line looks like a markdown table row (starts/ends with pipe or has multiple columns without bullet points)
    const isBullet = /^[*\-#•]\s+/.test(line);
    const pipeMatches = line.match(/\|/g);
    const pipeCount = pipeMatches ? pipeMatches.length : 0;

    if (pipeCount >= 2 && !isBullet) {
      if (!line.startsWith('|')) line = '| ' + line;
      if (!line.endsWith('|')) line = line + ' |';

      if (!inTable) {
        if (resultLines.length > 0 && resultLines[resultLines.length - 1] !== '') {
          resultLines.push('');
        }
        inTable = true;
      }
    } else {
      if (inTable) {
        resultLines.push('');
        inTable = false;
      }
    }

    resultLines.push(line);
  }

  return resultLines.join('\n');
}

function extractText(node: any): string {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node.props && node.props.children) return extractText(node.props.children);
  return '';
}

function extractTableData(children: any): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let headers: string[] = [];

  React.Children.forEach(children, (section) => {
    if (!section || !section.props) return;

    const isHead = section.type === 'thead' || section.type?.name === 'thead';
    const trs = section.props.children;

    React.Children.forEach(trs, (tr) => {
      if (!tr || !tr.props) return;
      const rowCells: string[] = [];
      React.Children.forEach(tr.props.children, (cell) => {
        if (!cell) return;
        const text = cell.props ? extractText(cell.props.children) : extractText(cell);
        rowCells.push(text.trim());
      });
      if (rowCells.length > 0) {
        if (isHead) {
          headers = rowCells;
        } else {
          rows.push(rowCells);
        }
      }
    });
  });

  return { headers, rows };
}

function parseRawPipeText(text: string): { headers: string[]; rows: string[][] } | null {
  if (!text || (!text.includes('|') && !text.includes('||'))) return null;

  const tokens = text.split(/\|\|\s*|\n+/).map(t => t.trim()).filter(Boolean);
  const rawRows: string[][] = [];

  for (const token of tokens) {
    if (token.startsWith(':---') || token.startsWith('---') || token.replace(/[\s\:\|-]/g, '') === '') {
      continue;
    }
    const cells = token.split('|').map(c => c.trim()).filter(c => c !== '');
    if (cells.length >= 2) {
      rawRows.push(cells);
    }
  }

  if (rawRows.length === 0) return null;

  const headers = rawRows[0];
  const rows = rawRows.slice(1);
  return { headers, rows };
}

function cleanLabel(str: string): string {
  if (!str) return '';
  return str
    .replace(/[\u2580-\u259F\u25A0-\u25FF\u2200-\u22FF\u2600-\u26FF█■▉▊▋▌▍▎▏░▒▓▪▫▬▰▱]+/g, '')
    .replace(/\s*\.{2,}\s*$/g, '')
    .replace(/\s*…\s*$/g, '')
    .replace(/^[0-9]+\.\s*/, '')
    .replace(/^[#\-*\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function CompactTipologiaCards({ headers, rows }: { headers: string[]; rows: string[][] }) {
  if (!rows || rows.length === 0) return null;

  // Identify column indices dynamically
  let varIdx = headers ? headers.findIndex(h => /variaci[oó]n|var/i.test(h)) : -1;
  if (varIdx === -1) varIdx = 3;

  let critIdx = headers ? headers.findIndex(h => /partida|critica|crítica|rubro|item/i.test(h)) : -1;
  if (critIdx === -1) critIdx = rows[0]?.length > 5 ? 5 : rows[0]?.length - 1;

  return (
    <div className="my-3 space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold px-1 text-indigo-900 border-b border-indigo-100 pb-1">
        <span className="flex items-center gap-1.5 font-bold">
          <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />
          Resumen Financiero
        </span>
        <span className="text-[10px] text-slate-500 font-normal">{rows.length} categorías</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
        {rows.map((row, idx) => {
          const rawName = row[0] || `Categoría ${idx + 1}`;
          const name = cleanLabel(rawName) || rawName;
          const varEcon = row[varIdx] || row[3] || '';
          const criticas = row[critIdx] || row[5] || '';

          const isNegative = varEcon.includes('-') || (varEcon.startsWith('(') && varEcon.endsWith(')'));
          const isPositive = varEcon.includes('+');

          return (
            <div
              key={idx}
              className={`rounded-lg px-2.5 py-1.5 border transition-all flex flex-col justify-between ${
                isNegative
                  ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                  : isPositive
                  ? 'bg-emerald-50/30 border-emerald-200 hover:border-emerald-300'
                  : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Header: Name + Rubros badge */}
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="font-bold text-slate-800 text-[11px] truncate leading-tight" title={name}>
                  {name}
                </span>
                {criticas && criticas !== '-' && (
                  <span className="text-[9px] font-semibold bg-white/90 text-amber-800 border border-amber-200/90 px-1.5 py-0.2 rounded-full shrink-0 flex items-center gap-0.5">
                    <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                    {criticas} {parseInt(criticas, 10) === 1 ? 'rubro' : 'rubros'}
                  </span>
                )}
              </div>

              {/* Footer: Variación */}
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/50">
                <span className="text-[9.5px] uppercase font-bold text-slate-400">Var:</span>
                <span
                  className={`font-black tracking-tight text-[11px] ${
                    isNegative
                      ? 'text-rose-700'
                      : isPositive
                      ? 'text-emerald-700'
                      : 'text-slate-700'
                  }`}
                >
                  {varEcon || '$0.00'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function isScapEquipmentCard(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    (lower.includes('scap') || text.includes('📦')) &&
    (lower.includes('pendiente') || lower.includes('partida') || lower.includes('avance') || lower.includes('f') || lower.includes('instal') || lower.includes('unidad') || lower.includes('cant'))
  );
}

function parseScapCardLine(text: string): {
  scapName: string;
  cantidad: string;
  partidas: string;
  avance: string;
  estado: string;
} | null {
  if (!text) return null;

  const clean = text.replace(/^[*#\-\s📦]+/, '').trim();
  const parts = clean.split(/\|+/).map(p => p.trim()).filter(Boolean);

  let scapName = '';
  let cantidad = '';
  let partidas = '';
  let avance = '';
  let estado = '';

  const scapMatch = clean.match(/(?:scap\s*[:-]?\s*)?([a-záéíóúñ0-9\s/&,.\-_]+?)(?::|\b\d+\s*(?:u|pcs|pzas|unid|glb|m|kg|ton|equipos|pendientes)\b|\||$)/i);
  if (scapMatch && scapMatch[1]) {
    scapName = scapMatch[1].replace(/[*_#]/g, '').replace(/^scap\s*[:-]?\s*/i, '').trim();
  }

  const cantMatch = clean.match(/(\d+(?:[\.,]\d+)?\s*(?:u|pcs|pzas|unid|unidades|glb|m|m2|m3|kg|ton|equipos|instrumentos)?)(?:\s*(?:pendientes|por instalar))?/i);
  if (cantMatch) {
    cantidad = cantMatch[1].replace(/[*_]/g, '').trim();
  }

  const partMatch = clean.match(/(\d+\s*(?:partidas|actividades|\bF\b))/i);
  if (partMatch) {
    partidas = partMatch[1].replace(/[*_]/g, '').trim();
  }

  const avanceMatch = clean.match(/(\d+(?:[\.,]\d+)?\s*%)/);
  if (avanceMatch) {
    avance = avanceMatch[1].trim();
  }

  if (/en curso/i.test(clean)) estado = 'En Curso';
  else if (/no iniciado/i.test(clean)) estado = 'No Iniciado';
  else if (/completad/i.test(clean)) estado = 'Completado';
  else {
    const stMatch = clean.match(/estado\s*:\s*([a-záéíóúñ\s]+)/i);
    if (stMatch) estado = stMatch[1].replace(/[*_]/g, '').trim();
  }

  if (!scapName && parts.length > 0) {
    scapName = parts[0].replace(/[*_]/g, '').split(':')[0].trim();
  }

  const finalName = cleanLabel(scapName) || scapName;
  const lowerName = (finalName || '').toLowerCase();

  // If no real quantity or partidas and name is generic or empty, return null
  if ((!cantidad || cantidad === '—') && (!partidas || partidas === '—')) {
    if (!finalName || lowerName === 'scap / equipo' || lowerName === 'scap' || lowerName === 'sin scap') {
      return null;
    }
  }

  return {
    scapName: finalName || 'SCAP / Equipo',
    cantidad: cantidad || '—',
    partidas: partidas || '—',
    avance: avance || '0%',
    estado: estado || 'Pendiente'
  };
}

function parseProgressPct(str?: string): number {
  if (!str) return 0;
  const match = str.match(/([\d.,]+)\s*%/);
  if (match) {
    const val = parseFloat(match[1].replace(',', '.'));
    return isNaN(val) ? 0 : Math.min(100, Math.max(0, val));
  }
  return 0;
}

function EquipmentScapTable({
  items
}: {
  items: Array<{
    tipo?: string;
    scapName: string;
    cantidad: string;
    partidas: string;
    avance: string;
    estado?: string;
  }>;
}) {
  if (!items || items.length === 0) return null;

  // Filter out empty or dummy rows (e.g. SCAP/Equipo with —, 0, or no data)
  const validItems = items.filter(item => {
    const name = (item.scapName || '').trim();
    const cant = (item.cantidad || '').trim();
    const part = (item.partidas || '').trim();
    const lowerName = name.toLowerCase();

    // If both quantity and partidas are empty or dashes, skip
    if ((cant === '—' || cant === '0' || !cant) && (part === '—' || part === '0' || !part)) {
      return false;
    }
    // If generic name with no real data
    if ((lowerName === 'scap / equipo' || lowerName === 'scap' || lowerName === 'sin scap' || !name) && (cant === '—' || cant === '0' || !cant)) {
      return false;
    }
    return true;
  });

  if (validItems.length === 0) return null;

  const hasTipo = validItems.some(i => Boolean(i.tipo));

  return (
    <div className="my-4 rounded-xl border border-indigo-200/80 shadow-md bg-white overflow-hidden font-sans">
      {/* Executive Header Banner */}
      <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-500/20 text-indigo-300 rounded-lg border border-indigo-400/30">
            <Package className="w-4 h-4 text-indigo-300" />
          </div>
          <div>
            <h4 className="font-extrabold text-xs tracking-wide text-white uppercase">
              Volumetría de Equipamiento e Instrumentación por SCAP
            </h4>
            <p className="text-[10px] text-slate-400 font-medium">
              Detalle de equipos y partidas F pendientes por instalar (Excluye Partida D)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasTipo && (
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30">
              Agrupado por Tipo
            </span>
          )}
          <span className="text-[10px] font-extrabold px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
            {validItems.length} {validItems.length === 1 ? 'SCAP' : 'SCAPs'}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse min-w-[620px]">
          <thead className="bg-slate-100/90 text-slate-800 font-extrabold text-[11px] uppercase tracking-wider border-b border-slate-200">
            <tr>
              {hasTipo && (
                <th className="px-4 py-3 text-slate-800 font-extrabold text-left w-36">
                  Tipo
                </th>
              )}
              <th className="px-4 py-3 text-slate-800 font-extrabold text-left">
                SCAP / Sub-sistema
              </th>
              <th className="px-4 py-3 text-amber-700 font-extrabold text-right">
                Pendiente de Instalar
              </th>
              <th className="px-4 py-3 text-indigo-800 font-extrabold text-center">
                Partidas (F)
              </th>
              <th className="px-4 py-3 text-emerald-800 font-extrabold text-center">
                Avance Acumulado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {validItems.map((item, idx) => {
              const isEnCurso = /en curso/i.test(item.estado || '');
              const isNoIniciado = /no iniciado/i.test(item.estado || '');
              const pct = parseProgressPct(item.avance);
              const isInstrumentacion = /instrument/i.test(item.tipo || '');

              return (
                <tr key={idx} className="hover:bg-indigo-50/50 transition-colors odd:bg-white even:bg-slate-50/40">
                  {hasTipo && (
                    <td className="px-4 py-3 font-bold text-xs whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-extrabold border ${
                        isInstrumentacion
                          ? 'bg-purple-50 text-purple-800 border-purple-200'
                          : 'bg-blue-50 text-blue-800 border-blue-200'
                      }`}>
                        {isInstrumentacion ? '🎛️ Instrumentación' : '⚙️ Equipo'}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3 font-bold text-slate-900 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                      <span className="font-extrabold text-slate-900" title={item.scapName}>
                        {item.scapName}
                      </span>
                      {item.estado && (
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                          isEnCurso
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : isNoIniciado
                            ? 'bg-slate-100 text-slate-600 border-slate-200'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}>
                          {item.estado}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-black text-amber-700 text-right text-xs">
                    <span className="bg-amber-50 text-amber-900 font-black border border-amber-200 px-2.5 py-1 rounded-md inline-block">
                      {item.cantidad || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700 text-center text-xs">
                    <span className="bg-indigo-50/80 text-indigo-900 border border-indigo-100 px-2.5 py-0.5 rounded text-[11px] font-bold inline-block">
                      {item.partidas || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-xs min-w-[130px]">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span className="font-extrabold text-emerald-700 text-[11px]">
                        {item.avance || '0%'}
                      </span>
                      <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
                        <div
                          className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function splitScapSection(markdown: string): { mainMarkdown: string; scapMarkdown: string | null; scapTitle: string } {
  if (!markdown) return { mainMarkdown: '', scapMarkdown: null, scapTitle: '' };

  const scapHeaderRegex = /(?:^|\n)(#{1,3}\s*(?:[36][\.\)]?|⚙️)?\s*(?:\*\*)?.*?(?:Análisis de Cantidad de Equipamiento|Equipamiento e Instrumentación|volumetría de equipos|SCAP \(Pendientes).*?)(?=\n|$)/i;

  const match = markdown.match(scapHeaderRegex);
  if (!match || match.index === undefined) {
    return { mainMarkdown: markdown, scapMarkdown: null, scapTitle: '' };
  }

  const splitIndex = match.index === 0 ? 0 : match.index + 1;
  const mainMarkdown = markdown.substring(0, splitIndex).trim();
  const rawScapContent = markdown.substring(splitIndex).trim();

  const scapLines = rawScapContent.split('\n');
  const titleLine = scapLines[0] || '';
  const cleanTitle = titleLine.replace(/^#{1,3}\s*/, '').replace(/[*_]/g, '').trim();
  const bodyMarkdown = scapLines.slice(1).join('\n').trim();

  return {
    mainMarkdown,
    scapMarkdown: bodyMarkdown || rawScapContent,
    scapTitle: cleanTitle || '6. ⚙️ Análisis de Cantidad de Equipamiento e Instrumentación por SCAP (Pendientes por Instalar)'
  };
}

function CollapsibleScapSection({
  title,
  markdown,
  components
}: {
  title: string;
  markdown: string;
  components: any;
}) {
  const [isOpen, setIsOpen] = React.useState(false);

  const displayTitle = title.replace(/^#{1,3}\s*/, '').replace(/[*_]/g, '').trim() ||
    '6. ⚙️ Análisis de Cantidad de Equipamiento e Instrumentación por SCAP (Pendientes por Instalar)';

  return (
    <div className="my-6 rounded-2xl border border-indigo-200/90 bg-slate-50/80 shadow-md overflow-hidden transition-all">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between gap-3 text-left transition-all hover:brightness-110 cursor-pointer group"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-400/30 text-indigo-300 shrink-0 group-hover:bg-indigo-500/30 transition-colors">
            <Package className="w-5 h-5 text-indigo-300" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-white truncate flex items-center gap-2">
              {displayTitle}
            </h3>
            <p className="text-[11px] text-indigo-200/80 font-medium">
              Volumetría de equipos e instrumentación por SCAP ({isOpen ? 'Haz clic para ocultar' : 'Haz clic para desplegar'})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full border transition-all ${
            isOpen 
              ? 'bg-indigo-500/30 text-indigo-200 border-indigo-400/40' 
              : 'bg-amber-500/20 text-amber-300 border-amber-400/40 animate-pulse'
          }`}>
            {isOpen ? 'Ocultar Sección' : 'Desplegar Sección (Plegado)'}
          </span>
          <div className="p-1.5 rounded-lg bg-white/10 text-white group-hover:bg-white/20 transition-colors">
            {isOpen ? <ChevronUp className="w-4 h-4 text-indigo-200" /> : <ChevronDown className="w-4 h-4 text-indigo-200" />}
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="p-5 bg-white border-t border-indigo-100/80 animate-fade-in space-y-3">
          <ReactMarkdown components={components}>
            {markdown}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

interface PowerBIBarItem {
  label: string;
  value: number;
  formattedValue?: string;
  criticas?: string;
  isNegative?: boolean;
}

function PowerBIHorizontalBarChart({
  title = 'Análisis por Áreas (Power BI)',
  subtitle,
  items
}: {
  title?: string;
  subtitle?: string;
  items: PowerBIBarItem[];
}) {
  if (!items || items.length === 0) return null;

  // Max absolute value for bar length scaling
  const maxAbs = Math.max(...items.map(i => Math.abs(i.value)), 1);

  return (
    <div className="my-4 p-5 bg-white rounded-xl border border-slate-200 shadow-sm font-sans space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div>
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4 text-[#118DFF]" />
            {title}
          </h4>
          {subtitle && <p className="text-[10px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3 text-[10px] font-bold">
          {items.some(i => i.isNegative || i.value < 0) ? (
            <>
              <span className="flex items-center gap-1.5 text-rose-600">
                <span className="w-2.5 h-2.5 bg-[#D64554] inline-block" /> (-) Negativo
              </span>
              <span className="flex items-center gap-1.5 text-[#118DFF]">
                <span className="w-2.5 h-2.5 bg-[#118DFF] inline-block" /> (+) Positivo
              </span>
            </>
          ) : (
            <span className="flex items-center gap-1.5 text-[#118DFF] bg-blue-50/80 border border-blue-200/90 px-2.5 py-0.5 rounded-full">
              <span className="w-2.5 h-2.5 bg-[#118DFF] rounded-xs inline-block" /> Actividades Programadas (Power BI)
            </span>
          )}
        </div>
      </div>

      {/* Bars Canvas */}
      <div className="relative space-y-2 pt-2 pb-1">
        {/* Power BI Dotted Vertical Gridlines in background */}
        <div className="absolute inset-y-0 left-36 right-4 flex justify-between pointer-events-none z-0">
          <div className="border-r border-dotted border-slate-300/80 h-full" />
          <div className="border-r border-dotted border-slate-300/80 h-full" />
          <div className="border-r border-dotted border-slate-300/80 h-full" />
          <div className="border-r border-dotted border-slate-300/80 h-full" />
          <div className="border-r border-dotted border-slate-300/80 h-full" />
          <div className="border-r border-dotted border-slate-300/80 h-full" />
        </div>

        {items.map((item, idx) => {
          const cleanItemLabel = cleanLabel(item.label) || item.label;
          const absVal = Math.abs(item.value);
          const pct = Math.max(Math.min((absVal / maxAbs) * 100, 100), 2);
          const isNeg = item.isNegative || item.value < 0;

          return (
            <div key={idx} className="flex items-center text-xs group relative z-10 my-1">
              {/* Category Label (Y-Axis) */}
              <div
                className="w-36 shrink-0 text-left pr-3 font-normal text-slate-700 text-[11px] truncate"
                title={cleanItemLabel}
              >
                {cleanItemLabel}
              </div>

              {/* Horizontal Bar Track */}
              <div className="flex-1 flex items-center h-6 relative">
                <div
                  className={`h-5 transition-all duration-300 flex items-center px-2 justify-end overflow-hidden ${
                    isNeg
                      ? 'bg-[#D64554] hover:brightness-110'
                      : 'bg-[#118DFF] hover:bg-[#0070DA]'
                  }`}
                  style={{ width: `${pct}%`, minWidth: '4px' }}
                >
                  {pct > 22 && (
                    <span className="text-white font-sans font-bold text-[10px] tracking-tight whitespace-nowrap pr-1">
                      {item.formattedValue || (isNeg ? `-$${absVal.toLocaleString()}` : `$${item.value.toLocaleString()}`)}
                    </span>
                  )}
                </div>

                {pct <= 22 && (
                  <span className="ml-2 font-sans font-bold text-[10px] text-slate-700 whitespace-nowrap">
                    {item.formattedValue || (isNeg ? `-$${absVal.toLocaleString()}` : `$${item.value.toLocaleString()}`)}
                  </span>
                )}

                {/* Rubros badge if present outside bar */}
                {item.criticas && item.criticas !== '-' && item.criticas !== '0' && (
                  <span className="ml-2.5 text-[9px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0">
                    <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                    {item.criticas} {parseInt(item.criticas, 10) === 1 ? 'rubro' : 'rubros'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function parseTextToChartData(text: string): PowerBIBarItem[] | null {
  if (!text) return null;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const items: PowerBIBarItem[] = [];

  for (const line of lines) {
    const match = line.match(/^([^:|#\-[\]\d]+(?:[\.\s]\w+)*)\s*[:|#\-=\t\s\[\]]+\s*([+\-–—]?\s*\$?[\d\.,]+(?:\s*USD)?)/i)
      || line.match(/^(.+?)\s+([+\-–—]?\$?[\d\.,]+(?:\s*USD)?)$/i);

    if (match) {
      const rawLabel = match[1];
      const label = cleanLabel(rawLabel) || rawLabel.trim();
      const valStr = match[2].trim();
      const isNegative = valStr.includes('-') || valStr.includes('–') || valStr.includes('—');
      let numVal = parseFloat(valStr.replace(/[\$\s,USD]/gi, '').replace('–', '-').replace('—', '-'));
      if (isNaN(numVal)) numVal = isNegative ? -1 : 1;

      if (label.length > 0 && label.toLowerCase() !== 'total' && label.toLowerCase() !== 'concepto') {
        items.push({
          label,
          value: numVal,
          formattedValue: valStr,
          isNegative
        });
      }
    }
  }

  return items.length >= 2 ? items : null;
}

function parseUpcomingToChartData(data: any): PowerBIBarItem[] | null {
  if (!data) return null;

  // Case 1: Array of row arrays from table extractor
  if (Array.isArray(data)) {
    const items: PowerBIBarItem[] = [];
    for (const row of data) {
      if (!row || row.length < 2) continue;
      const rawLabel = cleanLabel(row[0]) || row[0];
      if (!rawLabel || /^total$/i.test(rawLabel) || /^área/i.test(rawLabel) || /^sector/i.test(rawLabel) || /^concepto/i.test(rawLabel)) continue;

      const valStr = String(row[1] || '').trim();
      const numMatch = valStr.match(/(\d+[\d\.,]*)/);
      if (numMatch) {
        const numVal = parseFloat(numMatch[1].replace(',', '.'));
        if (!isNaN(numVal) && numVal > 0) {
          items.push({
            label: rawLabel,
            value: numVal,
            formattedValue: /\d+\s*(actividad|partida|item|u)/i.test(valStr) ? valStr : `${numVal} actividades`,
            isNegative: false
          });
        }
      }
    }
    return items.length >= 1 ? items : null;
  }

  // Case 2: String containing list items or raw pipe table
  if (typeof data === 'string') {
    const lines = data.split('\n').map(l => l.trim()).filter(Boolean);
    const items: PowerBIBarItem[] = [];
    for (const line of lines) {
      if (line.includes('|')) {
        const parts = line.split('|').map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          const rawLabel = cleanLabel(parts[0]) || parts[0];
          if (/^área/i.test(rawLabel) || /^sector/i.test(rawLabel) || /^:-/i.test(rawLabel) || /^total/i.test(rawLabel)) continue;
          const valStr = parts[1];
          const numMatch = valStr.match(/(\d+[\d\.,]*)/);
          if (numMatch) {
            const numVal = parseFloat(numMatch[1].replace(',', '.'));
            if (!isNaN(numVal) && numVal > 0) {
              items.push({
                label: rawLabel,
                value: numVal,
                formattedValue: /\d+\s*(actividad|partida|item|u)/i.test(valStr) ? valStr : `${numVal} actividades`,
                isNegative: false
              });
            }
          }
        }
      } else {
        const match = line.match(/^[*_#\-\s]*([^:|#\-[\]\d]+(?:[\.\s]\w+)*)[*_#\-\s]*[:|\-=\t]+\s*(\d+[\d\.,]*\s*(?:actividades|partidas|items)?)/i);
        if (match) {
          const rawLabel = cleanLabel(match[1]) || match[1].trim();
          if (/^total/i.test(rawLabel) || /^área/i.test(rawLabel) || /^sector/i.test(rawLabel)) continue;
          const valStr = match[2].trim();
          const numMatch = valStr.match(/(\d+[\d\.,]*)/);
          if (numMatch) {
            const numVal = parseFloat(numMatch[1].replace(',', '.'));
            if (!isNaN(numVal) && numVal > 0) {
              items.push({
                label: rawLabel,
                value: numVal,
                formattedValue: /\d+\s*(actividad|partida|item|u)/i.test(valStr) ? valStr : `${numVal} actividades`,
                isNegative: false
              });
            }
          }
        }
      }
    }
    return items.length >= 1 ? items : null;
  }

  return null;
}

function renderCurrencyBadge(valStr: string, key: string | number) {
  const isNegative = valStr.includes('-') || valStr.includes('–') || valStr.includes('—');
  const isPositive = valStr.includes('+');

  return (
    <span
      key={key}
      data-currency-badge="true"
      className={`inline-block px-1.5 py-0.5 rounded font-mono font-bold text-[11px] border leading-none mx-0.5 whitespace-nowrap align-baseline ${
        isNegative
          ? 'bg-rose-50 text-rose-700 border-rose-200/90'
          : isPositive
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/90'
          : 'bg-slate-100/80 text-slate-800 border-slate-200/90'
      }`}
    >
      {valStr}
    </span>
  );
}

function processTextContent(text: string): React.ReactNode {
  if (!text) return text;

  // Clean block characters from raw markdown text
  const cleanedText = text.replace(/[\u2580-\u259F\u25A0-\u25FF\u2200-\u22FF\u2600-\u26FF█■▉▊▋▌▍▎▏░▒▓▪▫▬▰▱]+/g, '');

  // Regex to match currency amounts like -$1,877,207.31, +$833,129.09, $97,750,571.57, -$10,000 USD, 10.000 USD
  const CURRENCY_REGEX = /((?:[-+–—]\s*)?\$[\d\.,]+(?:\s*USD)?|(?:[-+–—]\s*)?[\d\.,]+\s*USD)/gi;

  if (!CURRENCY_REGEX.test(cleanedText)) {
    return cleanedText;
  }

  CURRENCY_REGEX.lastIndex = 0;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = CURRENCY_REGEX.exec(cleanedText)) !== null) {
    if (match.index > lastIndex) {
      parts.push(cleanedText.substring(lastIndex, match.index));
    }
    const valStr = match[0];
    parts.push(renderCurrencyBadge(valStr, `curr-${match.index}`));
    lastIndex = CURRENCY_REGEX.lastIndex;
  }

  if (lastIndex < cleanedText.length) {
    parts.push(cleanedText.substring(lastIndex));
  }

  return parts;
}

function processFormattedNode(node: React.ReactNode): React.ReactNode {
  if (typeof node === 'string') {
    return processTextContent(node);
  }
  if (typeof node === 'number' || node === null || node === undefined || typeof node === 'boolean') {
    return node;
  }
  if (Array.isArray(node)) {
    return React.Children.map(node, child => processFormattedNode(child));
  }
  if (React.isValidElement(node)) {
    const element = node as React.ReactElement<{ children?: React.ReactNode; 'data-currency-badge'?: boolean; [key: string]: any }>;
    if (element.props && (element.props['data-currency-badge'] || element.key?.toString().startsWith('curr-'))) {
      return node; // Already a single currency badge! Do not wrap or process again.
    }
    if (element.props && element.props.children) {
      return React.cloneElement(element, {
        children: processFormattedNode(element.props.children)
      });
    }
  }
  return node;
}

const markdownComponents = {
  table: ({ children }: any) => {
    const { headers, rows } = extractTableData(children);
    if (!rows || rows.length === 0) {
      return (
        <div className="my-3 overflow-x-auto rounded-xl border border-slate-200/90 shadow-md bg-white">
          <table className="w-full text-xs text-left border-collapse min-w-[720px]">
            {children}
          </table>
        </div>
      );
    }

    const headersStr = (headers || []).join(' ').toLowerCase();
    const isScapTable = headersStr.includes('scap') || headersStr.includes('pendiente') || (headersStr.includes('partida') && headersStr.includes('avance'));
    const isTipologiaTable = headersStr.includes('tipolog') || headersStr.includes('variaci') || headersStr.includes('financiero') || headersStr.includes('desviaci');
    const isUpcomingTable = headersStr.includes('programad') || headersStr.includes('próxima') || headersStr.includes('semanas') || (headersStr.includes('área') && (headersStr.includes('actividad') || headersStr.includes('partida')));

    if (isUpcomingTable && !isScapTable && !isTipologiaTable) {
      const upcomingItems = parseUpcomingToChartData(rows);
      if (upcomingItems && upcomingItems.length > 0) {
        return (
          <PowerBIHorizontalBarChart
            title="4. Actividades Programadas para las Próximas 4 Semanas por Área (Power BI)"
            subtitle="Volumetría de actividades a ejecutar en los próximos 28 días"
            items={upcomingItems}
          />
        );
      }
    }

    if (isScapTable) {
      const hasTipoCol = headers.some(h => /tipo/i.test(h)) || rows.some(r => r.length >= 5);
      const scapItems = rows.map(r => {
        if (hasTipoCol && r.length >= 5) {
          return {
            tipo: cleanLabel(r[0]) || 'Equipo',
            scapName: cleanLabel(r[1]) || r[1] || 'SCAP',
            cantidad: r[2] || '—',
            partidas: r[3] || '—',
            avance: r[4] || '0%',
            estado: r[5] || ''
          };
        }
        return {
          scapName: cleanLabel(r[0]) || r[0] || 'SCAP',
          cantidad: r[1] || '—',
          partidas: r[2] || '—',
          avance: r[3] || '0%',
          estado: r[4] || ''
        };
      });
      return <EquipmentScapTable items={scapItems} />;
    }

    if (isTipologiaTable) {
      return <CompactTipologiaCards headers={headers} rows={rows} />;
    }

    return (
      <div className="my-3 overflow-x-auto rounded-xl border border-slate-200/90 shadow-md bg-white">
        <table className="w-full text-xs text-left border-collapse min-w-[720px]">
          {children}
        </table>
      </div>
    );
  },
  p: ({ children }: any) => {
    const text = extractText(children);
    if ((text.includes('Tipología') || text.includes('Venta Plan') || text.includes('Variación')) && (text.includes('|') || text.includes('||'))) {
      const parsed = parseRawPipeText(text);
      if (parsed && parsed.rows.length > 0) {
        return <CompactTipologiaCards headers={parsed.headers} rows={parsed.rows} />;
      }
    }
    if ((text.includes('SCAP') || text.includes('Pendiente') || text.includes('Partidas')) && (text.includes('|') || text.includes('||'))) {
      const parsed = parseRawPipeText(text);
      if (parsed && parsed.rows.length > 0) {
        const hasTipoCol = parsed.headers.some(h => /tipo/i.test(h)) || parsed.rows.some(r => r.length >= 5);
        const scapItems = parsed.rows.map(r => {
          if (hasTipoCol && r.length >= 5) {
            return {
              tipo: cleanLabel(r[0]) || 'Equipo',
              scapName: cleanLabel(r[1]) || r[1] || 'SCAP',
              cantidad: r[2] || '—',
              partidas: r[3] || '—',
              avance: r[4] || '0%',
              estado: r[5] || ''
            };
          }
          return {
            scapName: cleanLabel(r[0]) || r[0] || 'SCAP',
            cantidad: r[1] || '—',
            partidas: r[2] || '—',
            avance: r[3] || '0%',
            estado: r[4] || ''
          };
        });
        return <EquipmentScapTable items={scapItems} />;
      }
    }
    if (isScapEquipmentCard(text)) {
      const parsed = parseScapCardLine(text);
      if (parsed) {
        return <EquipmentScapTable items={[parsed]} />;
      }
    }
    return (
      <p className="my-2 text-xs leading-relaxed text-slate-700">
        {processFormattedNode(children)}
      </p>
    );
  },
  strong: ({ children }: any) => {
    const text = extractText(children).trim();
    const isTipologiaTitle = /^(?:\d+\.\s*)?tipolog[ií]a/i.test(text);

    if (isTipologiaTitle) {
      return (
        <strong className="font-extrabold text-indigo-950 bg-indigo-100/90 border border-indigo-200 px-2 py-0.5 rounded shadow-2xs inline text-xs mr-1">
          {processFormattedNode(children)}
        </strong>
      );
    }

    const isPureCurrency = /^(?:[-+–—]\s*)?\$?[\d\.,]+(?:\s*USD)?$/i.test(text);
    if (isPureCurrency) {
      return <>{processFormattedNode(children)}</>;
    }

    return (
      <strong className="font-extrabold text-slate-900 text-[13px] mr-1">
        {processFormattedNode(children)}
      </strong>
    );
  },
  thead: ({ children }: any) => (
    <thead className="bg-slate-900 text-slate-100 font-bold text-[11px] uppercase tracking-wider">
      {children}
    </thead>
  ),
  tbody: ({ children }: any) => (
    <tbody className="divide-y divide-slate-200/80 bg-white">
      {children}
    </tbody>
  ),
  tr: ({ children }: any) => (
    <tr className="hover:bg-indigo-50/70 transition-colors odd:bg-white even:bg-slate-50/50">
      {children}
    </tr>
  ),
  th: ({ children }: any) => (
    <th className="px-4 py-3.5 font-bold border-b border-slate-800 text-slate-200 whitespace-nowrap text-xs">
      {children}
    </th>
  ),
  td: ({ children }: any) => (
    <td className="px-4 py-2.5 whitespace-nowrap border-b border-slate-100 text-slate-800 font-medium text-xs">
      {processFormattedNode(children)}
    </td>
  ),
  h1: ({ children }: any) => (
    <h1 className="text-lg font-bold text-slate-900 mt-6 mb-3 pb-2 border-b border-slate-200 flex items-center gap-2">
      {children}
    </h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="text-base font-extrabold text-indigo-900 mt-5 mb-2.5 flex items-center gap-2">
      {children}
    </h2>
  ),
  h3: ({ children }: any) => {
    const text = extractText(children).trim();
    const isTipologiaTitle = /tipolog[ií]a/i.test(text) || /^\d+\.\s+[0-9]{2}\./i.test(text);

    if (isTipologiaTitle) {
      return (
        <h3 className="text-xs font-extrabold text-indigo-950 bg-indigo-100/90 border border-indigo-200 px-3 py-1.5 rounded-lg shadow-2xs mt-4 mb-2 flex items-center gap-2">
          {processFormattedNode(children)}
        </h3>
      );
    }

    return (
      <h3 className="text-sm font-extrabold text-slate-900 mt-4 mb-2">
        {processFormattedNode(children)}
      </h3>
    );
  },
  h4: ({ children }: any) => {
    const text = extractText(children).trim();
    const cleanText = text.replace(/tipolog[ií]a/gi, '').trim();
    if (!cleanText || /^[\d\.\s:-]+$/.test(cleanText)) {
      return null;
    }
    return (
      <h4 className="text-[13px] font-bold text-indigo-900 mt-3 mb-1.5">
        {processFormattedNode(children)}
      </h4>
    );
  },
  ul: ({ children }: any) => {
    const childrenArray = React.Children.toArray(children);
    const isScapGroup = childrenArray.length > 0 && childrenArray.some(child => {
      const text = extractText(child);
      return isScapEquipmentCard(text);
    });

    if (isScapGroup) {
      const scapItems: Array<{ scapName: string; cantidad: string; partidas: string; avance: string; estado?: string }> = [];
      childrenArray.forEach(child => {
        const text = extractText(child);
        const parsed = parseScapCardLine(text);
        if (parsed) {
          scapItems.push(parsed);
        }
      });
      if (scapItems.length > 0) {
        return <EquipmentScapTable items={scapItems} />;
      }
    }

    const upcomingListText = childrenArray.map(child => extractText(child)).join('\n');
    const upcomingItems = parseUpcomingToChartData(upcomingListText);
    if (upcomingItems && upcomingItems.length >= 2) {
      return (
        <PowerBIHorizontalBarChart
          title="4. Actividades Programadas para las Próximas 4 Semanas por Área (Power BI)"
          subtitle="Volumetría de actividades a ejecutar en los próximos 28 días"
          items={upcomingItems}
        />
      );
    }

    return (
      <ul className="list-disc pl-5 space-y-1.5 my-2 text-slate-600 text-[11px]">
        {children}
      </ul>
    );
  },
  ol: ({ children }: any) => (
    <ol className="list-decimal pl-5 space-y-1.5 my-2 text-slate-600 text-[11px]">
      {children}
    </ol>
  ),
  li: ({ children }: any) => {
    const text = extractText(children);
    if (isScapEquipmentCard(text)) {
      const parsed = parseScapCardLine(text);
      if (parsed) {
        return <EquipmentScapTable items={[parsed]} />;
      }
    }

    return (
      <li className="text-[11px] leading-relaxed text-slate-600 my-1 [&_p]:inline [&_p]:m-0 [&_p]:mr-1.5 [&_h4]:inline [&_h4]:m-0 [&_h4]:mr-1.5 [&_h3]:inline [&_h3]:m-0 [&_h3]:mr-1.5 [&_h2]:inline [&_h2]:m-0 [&_h2]:mr-1.5 [&_div]:inline [&_div]:m-0 [&_code]:inline [&_code]:m-0 [&_strong]:inline [&_strong]:m-0 [&_pre]:inline">
        {processFormattedNode(children)}
      </li>
    );
  },
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-4 border-indigo-500 bg-indigo-50/60 pl-4 py-2 my-3 rounded-r-lg text-slate-800 italic text-xs">
      {children}
    </blockquote>
  ),
  pre: ({ children }: any) => {
    const rawText = extractText(children);
    const chartItems = parseTextToChartData(rawText);

    if (chartItems) {
      return (
        <PowerBIHorizontalBarChart
          title="Gráfico de Barras Horizontales (Power BI)"
          subtitle="Representación de variaciones por categoría"
          items={chartItems}
        />
      );
    }

    return (
      <div className="my-3 rounded-xl border border-slate-200 bg-slate-900 text-slate-100 p-3.5 text-xs font-mono overflow-x-auto shadow-sm">
        <pre className="m-0 leading-relaxed whitespace-pre-wrap">{children}</pre>
      </div>
    );
  },
  code: ({ children, inline }: any) => {
    const rawText = extractText(children);
    const chartItems = parseTextToChartData(rawText);
    if (chartItems) {
      return (
        <PowerBIHorizontalBarChart
          title="Gráfico de Barras Horizontales (Power BI)"
          subtitle="Representación de variaciones por categoría"
          items={chartItems}
        />
      );
    }
    const isMultiLine = rawText.includes('\n');
    if (inline || !isMultiLine) {
      return (
        <code className="px-1 py-0.5 rounded bg-slate-100 text-black font-mono text-[13px] font-bold border border-slate-200/80 inline mr-1" style={{ color: '#000000', fontSize: '13px' }}>
          {children}
        </code>
      );
    }
    return (
      <code className="block font-mono text-xs leading-relaxed text-slate-100 bg-slate-900 p-2.5 rounded-md overflow-x-auto" style={{ color: '#ffffff', fontSize: '12px' }}>
        {children}
      </code>
    );
  },
};

export const AIReportModal: React.FC<AIReportModalProps> = ({
  isOpen,
  onClose,
  report,
  isAdmin,
  onUpdateReport,
  isGenerating
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (report?.markdown) {
      navigator.clipboard.writeText(report.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Sin fecha';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* HEADER */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
              <Sparkles className="w-5 h-5 text-indigo-300 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Reporte de Inteligencia Artificial - Cronograma
                <span className="text-[10px] bg-indigo-500/30 text-indigo-200 font-semibold px-2 py-0.5 rounded-full border border-indigo-400/20">
                  Gemini 3.6 Flash
                </span>
              </h2>
              <p className="text-xs text-indigo-200/80">
                Análisis por áreas, retraso económico por tipología (variación {'>'} $10k USD) y proyección
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-indigo-200 hover:text-white hover:bg-white/10 transition-colors"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* METADATA BAR */}
        {report && (
          <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2 shrink-0">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1.5 font-medium">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                Actualizado: <strong className="text-slate-800">{formatDate(report.updatedAt)}</strong>
              </span>
            </div>

            {report.summary && (
              <div className="flex items-center gap-2 text-[11px] font-semibold">
                {report.summary.totalItemsCriticos10k !== undefined && report.summary.totalItemsCriticos10k > 0 && (
                  <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md border border-amber-300 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    {report.summary.totalItemsCriticos10k} Partidas Desv. {'>'} $10k USD
                  </span>
                )}
                <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded-md border border-rose-200 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                  {report.summary.totalDelayed} Retrasadas
                </span>
                <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-indigo-600" />
                  {report.summary.totalUpcoming} Próximas (4S)
                </span>
              </div>
            )}
          </div>
        )}

        {/* BODY CONTENT */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-slate-800">
          {isGenerating ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-4 text-center">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                <Sparkles className="w-6 h-6 text-indigo-600 absolute inset-0 m-auto" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-800">Analizando Cronograma de Obra por Áreas...</h3>
                <p className="text-xs text-slate-500 max-w-md">
                  Gemini AI está procesando las actividades retrasadas, evaluando holguras y consolidando las tareas de las próximas 4 semanas.
                </p>
              </div>
            </div>
          ) : report ? (() => {
            const processed = preprocessMarkdownText(report.markdown);
            const { mainMarkdown, scapMarkdown, scapTitle } = splitScapSection(processed);
            return (
              <div className="prose prose-slate max-w-none text-sm leading-relaxed space-y-4">
                <ReactMarkdown components={markdownComponents}>
                  {mainMarkdown}
                </ReactMarkdown>
                {scapMarkdown && (
                  <CollapsibleScapSection
                    title={scapTitle}
                    markdown={scapMarkdown}
                    components={markdownComponents}
                  />
                )}
              </div>
            );
          })() : (
            <div className="py-12 px-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center text-center space-y-3">
              <div className="p-4 bg-indigo-50 rounded-full text-indigo-600">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Sin Reporte Generado Aún</h3>
              <p className="text-xs text-slate-500 max-w-md">
                {isAdmin
                  ? 'Aún no se ha creado un reporte de Inteligencia Artificial para este cronograma. Haz clic en el botón inferior para realizar el primer análisis por área con Gemini AI.'
                  : 'El administrador de la obra aún no ha generado el reporte de Inteligencia Artificial. Cuando sea actualizado por el administrador, podrás consultar la información en esta pantalla.'}
              </p>
              {isAdmin && (
                <button
                  onClick={onUpdateReport}
                  className="mt-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Generar Primer Reporte AI
                </button>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {report && (
              <button
                onClick={handleCopy}
                disabled={isGenerating}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{copied ? '¡Copiado!' : 'Copiar Texto'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isAdmin ? (
              <button
                onClick={onUpdateReport}
                disabled={isGenerating}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                <span>{isGenerating ? 'Generando...' : 'Actualizar Reporte AI'}</span>
              </button>
            ) : (
              <div
                className="px-3 py-1.5 bg-slate-200 text-slate-500 font-semibold text-xs rounded-xl flex items-center gap-1.5 cursor-not-allowed"
                title="Solo el administrador está autorizado para actualizar el reporte."
              >
                <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                <span>Actualización Solo Admin</span>
              </div>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
