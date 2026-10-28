/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const CT_TIPO_COLORS = [
  {bg:'bg-blue-50',   border:'border-blue-300',   text:'text-blue-800',   bar:'bg-blue-500'   },
  {bg:'bg-purple-50', border:'border-purple-300', text:'text-purple-800', bar:'bg-purple-500' },
  {bg:'bg-yellow-50', border:'border-yellow-300', text:'text-yellow-800', bar:'bg-yellow-500' },
  {bg:'bg-green-50',  border:'border-green-300',  text:'text-green-800',  bar:'bg-green-500'  },
  {bg:'bg-red-50',    border:'border-red-300',    text:'text-red-800',    bar:'bg-red-500'    },
  {bg:'bg-indigo-50', border:'border-indigo-300', text:'text-indigo-800', bar:'bg-indigo-500' },
  {bg:'bg-pink-50',   border:'border-pink-300',   text:'text-pink-800',   bar:'bg-pink-500'   },
  {bg:'bg-orange-50', border:'border-orange-300', text:'text-orange-800', bar:'bg-orange-500' },
  {bg:'bg-teal-50',   border:'border-teal-300',   text:'text-teal-800',   bar:'bg-teal-500'   },
  {bg:'bg-cyan-50',   border:'border-cyan-300',   text:'text-cyan-800',   bar:'bg-cyan-500'   },
  {bg:'bg-lime-50',   border:'border-lime-300',   text:'text-lime-800',   bar:'bg-lime-500'   },
  {bg:'bg-violet-50', border:'border-violet-300', text:'text-violet-800', bar:'bg-violet-500' },
  {bg:'bg-rose-50',   border:'border-rose-300',   text:'text-rose-800',   bar:'bg-rose-500'   },
  {bg:'bg-gray-50',   border:'border-gray-200',   text:'text-gray-700',   bar:'bg-gray-400'   },
];

const _ctTipoColorCache: Record<string, typeof CT_TIPO_COLORS[number]> = {};
let _ctTipoColorIdx = 0;

export const ctTipoCfg = (tipo: string) => {
  if (!_ctTipoColorCache[tipo]) {
    _ctTipoColorCache[tipo] = CT_TIPO_COLORS[_ctTipoColorIdx % CT_TIPO_COLORS.length];
    _ctTipoColorIdx++;
  }
  return _ctTipoColorCache[tipo];
};

export const normalizeText = (text: any): string => {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // Elimina tildes y acentos
};

export const ctTipoLabel = (tipo: string): string => {
  return tipo ? tipo.replace(/^\d+\./, '').trim() : 'Sin match';
};

export const ctFmt = (v: any, d: number = 2): string => {
  return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};

export const ctFmtM = (v: any): string => {
  return `${(Number(v || 0) / 1e6).toFixed(2)}M`;
};

export const ctPf = (v: any): number => {
  return typeof v === 'number' ? v : parseFloat(v) || 0;
};

export const cleanDesc = (desc: string): string => {
  if (!desc) return '—';
  const prefixes = [
    /^Submittal\s+de[l]?\s+/i,
    /^Procura\s+de[l]?\s+/i,
    /^Compra\s+y\s+Fabricaci[oó]n\s+de[l]?\s+/i,
    /^Suministro\s+de[l]?\s+/i,
  ];
  let s = desc.trim();
  for (const rx of prefixes) {
    const m = s.match(rx);
    if (m) {
      s = s.slice(m[0].length).trim();
      break;
    }
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/**
 * Detects whether an activity finish date matches 30-abr-2027 (specifically 08:00 am / 30-abr-2027)
 * to exclude it from the GANTT chart schedule.
 */
export const isIgnoredFinishDate = (finish: any): boolean => {
  if (!finish) return false;
  if (finish instanceof Date && !isNaN(finish.getTime())) {
    const y = finish.getFullYear();
    const m = finish.getMonth(); // 3 = April (0-indexed)
    const d = finish.getDate();
    
    const uy = finish.getUTCFullYear();
    const um = finish.getUTCMonth();
    const ud = finish.getUTCDate();

    if ((y === 2027 && m === 3 && d === 30) || (uy === 2027 && um === 3 && ud === 30)) {
      return true;
    }
  }
  if (typeof finish === 'string') {
    const s = finish.toLowerCase().trim();
    if (
      s.includes('30-abr-2027') ||
      s.includes('30-apr-2027') ||
      s.includes('30/04/2027') ||
      s.includes('30-04-2027') ||
      s.includes('2027-04-30') ||
      s.includes('30-abr-27') ||
      s.includes('30-apr-27')
    ) {
      return true;
    }
    const pd = new Date(finish);
    if (!isNaN(pd.getTime())) {
      if (
        (pd.getFullYear() === 2027 && pd.getMonth() === 3 && pd.getDate() === 30) ||
        (pd.getUTCFullYear() === 2027 && pd.getUTCMonth() === 3 && pd.getUTCDate() === 30)
      ) {
        return true;
      }
    }
  }
  if (typeof finish === 'number') {
    if (finish >= 46506 && finish <= 46508.5) return true;
    const nd = new Date(finish);
    if (!isNaN(nd.getTime())) {
      if (
        (nd.getFullYear() === 2027 && nd.getMonth() === 3 && nd.getDate() === 30) ||
        (nd.getUTCFullYear() === 2027 && nd.getUTCMonth() === 3 && nd.getUTCDate() === 30)
      ) {
        return true;
      }
    }
  }
  return false;
};
