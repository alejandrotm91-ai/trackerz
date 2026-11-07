/**
 * Colores de los niveles de jerarquía compartidos por las tablas de árbol
 * (Control de Ejecución y Avance Partidas).
 */
// Niveles de la jerarquía: el superior en gris claro (como el encabezado de las tablas)
// y cada nivel siguiente con su propio tono claro y una barra de color a la izquierda.
export const LEVEL_STYLES = [
  // gris claro
  {
    bg: 'bg-[#F5F8F9] hover:bg-[#EEF2F3] text-[#14212A] font-bold border-b border-[#D5DEE2]',
    accent: 'shadow-[inset_3px_0_0_#5A6A74]',
    text: 'text-[#14212A]',
    badge: 'bg-white text-[#5A6A74] border border-[#D5DEE2]',
    subText: 'text-[#5A6A74]',
    chevron: 'text-[#5A6A74]',
    dateText: 'text-[#5A6A74]',
    vContrato: 'text-[#14212A] font-semibold',
    vPlan: 'text-slate-700',
    vEjec: 'text-green-700',
    vSobre: 'text-amber-700',
    /** Color de la barra de avance del nivel. */
    bar: '#5A6A74'
  },
  // verde claro
  {
    bg: 'bg-[#EAF6EE] hover:bg-[#DDF0E4] text-[#14212A] font-semibold border-b border-[#CFE8D7]',
    accent: 'shadow-[inset_3px_0_0_#2B7F52]',
    text: 'text-[#14212A]',
    badge: 'bg-white text-[#2B7F52] border border-[#CFE8D7]',
    subText: 'text-[#5A6A74]',
    chevron: 'text-[#2B7F52]',
    dateText: 'text-[#5A6A74]',
    vContrato: 'text-[#14212A] font-semibold',
    vPlan: 'text-slate-700',
    vEjec: 'text-green-700',
    vSobre: 'text-amber-700',
    /** Color de la barra de avance del nivel. */
    bar: '#2B7F52'
  },
  // azul claro
  {
    bg: 'bg-[#EAF2FB] hover:bg-[#DCE9F7] text-[#14212A] font-semibold border-b border-[#CCDDF1]',
    accent: 'shadow-[inset_3px_0_0_#2C67A6]',
    text: 'text-[#14212A]',
    badge: 'bg-white text-[#2C67A6] border border-[#CCDDF1]',
    subText: 'text-[#5A6A74]',
    chevron: 'text-[#2C67A6]',
    dateText: 'text-[#5A6A74]',
    vContrato: 'text-[#14212A] font-semibold',
    vPlan: 'text-slate-700',
    vEjec: 'text-green-700',
    vSobre: 'text-amber-700',
    /** Color de la barra de avance del nivel. */
    bar: '#2C67A6'
  },
  // arena
  {
    bg: 'bg-[#FBF4E6] hover:bg-[#F6EBD3] text-[#14212A] font-semibold border-b border-[#EEDDBA]',
    accent: 'shadow-[inset_3px_0_0_#A86B12]',
    text: 'text-[#14212A]',
    badge: 'bg-white text-[#A86B12] border border-[#EEDDBA]',
    subText: 'text-[#5A6A74]',
    chevron: 'text-[#A86B12]',
    dateText: 'text-[#5A6A74]',
    vContrato: 'text-[#14212A] font-semibold',
    vPlan: 'text-slate-700',
    vEjec: 'text-green-700',
    vSobre: 'text-amber-700',
    /** Color de la barra de avance del nivel. */
    bar: '#A86B12'
  },
  // rosa claro
  {
    bg: 'bg-[#FBEFF2] hover:bg-[#F6E1E7] text-[#14212A] font-semibold border-b border-[#EDCDD7]',
    accent: 'shadow-[inset_3px_0_0_#B4235A]',
    text: 'text-[#14212A]',
    badge: 'bg-white text-[#B4235A] border border-[#EDCDD7]',
    subText: 'text-[#5A6A74]',
    chevron: 'text-[#B4235A]',
    dateText: 'text-[#5A6A74]',
    vContrato: 'text-[#14212A] font-semibold',
    vPlan: 'text-slate-700',
    vEjec: 'text-green-700',
    vSobre: 'text-amber-700',
    /** Color de la barra de avance del nivel. */
    bar: '#B4235A'
  },
  // amarillo claro
  {
    bg: 'bg-[#FEF8D8] hover:bg-[#FCF1BC] text-[#14212A] font-semibold border-b border-[#F2E39A]',
    accent: 'shadow-[inset_3px_0_0_#9A7B00]',
    text: 'text-[#14212A]',
    badge: 'bg-white text-[#9A7B00] border border-[#F2E39A]',
    subText: 'text-[#5A6A74]',
    chevron: 'text-[#9A7B00]',
    dateText: 'text-[#5A6A74]',
    vContrato: 'text-[#14212A] font-semibold',
    vPlan: 'text-slate-700',
    vEjec: 'text-green-700',
    vSobre: 'text-amber-700',
    /** Color de la barra de avance del nivel. */
    bar: '#9A7B00'
  },
  // coral claro
  {
    bg: 'bg-[#FDEEE8] hover:bg-[#FBE0D5] text-[#14212A] font-semibold border-b border-[#F4CBBB]',
    accent: 'shadow-[inset_3px_0_0_#C2410C]',
    text: 'text-[#14212A]',
    badge: 'bg-white text-[#C2410C] border border-[#F4CBBB]',
    subText: 'text-[#5A6A74]',
    chevron: 'text-[#C2410C]',
    dateText: 'text-[#5A6A74]',
    vContrato: 'text-[#14212A] font-semibold',
    vPlan: 'text-slate-700',
    vEjec: 'text-green-700',
    vSobre: 'text-amber-700',
    /** Color de la barra de avance del nivel. */
    bar: '#C2410C'
  }
];
