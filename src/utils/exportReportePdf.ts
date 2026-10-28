/**
 * Exporta el reporte de Inteligencia a PDF A4 vertical.
 *
 * Cada bloque marcado con `data-pdf-bloque` se convierte en imagen (html-to-image entiende los
 * colores de Tailwind 4) y se coloca en la página; si no cabe, pasa a la siguiente. Los bloques
 * más altos que una página se cortan entre filas (`tr`, `li` o `data-pdf-fila`), nunca a mitad de una.
 */
import { toCanvas, getFontEmbedCSS } from 'html-to-image';
import { jsPDF } from 'jspdf';

const PAG_ANCHO = 210;
const PAG_ALTO = 297;
const MARGEN = 12;
const ANCHO = PAG_ANCHO - MARGEN * 2;
const Y_INICIO = 22; // debajo del encabezado
const Y_FIN = PAG_ALTO - 14; // encima del pie
const SEPARACION = 4;

export async function exportarReportePdf(
  contenedor: HTMLElement,
  opciones: { archivo: string; titulo: string; subtitulo: string }
): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const fontEmbedCSS = await getFontEmbedCSS(contenedor).catch(() => undefined);

  const encabezado = () => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(20, 33, 42);
    pdf.text(opciones.titulo, MARGEN, 13);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(90, 106, 116);
    pdf.text(opciones.subtitulo, PAG_ANCHO - MARGEN, 13, { align: 'right' });
    pdf.setDrawColor(68, 45, 215);
    pdf.setLineWidth(0.4);
    pdf.line(MARGEN, 16, PAG_ANCHO - MARGEN, 16);
  };

  let y = Y_INICIO;
  encabezado();
  const nuevaPagina = () => {
    pdf.addPage('a4', 'portrait');
    encabezado();
    y = Y_INICIO;
  };

  const bloques = Array.from(contenedor.querySelectorAll<HTMLElement>('[data-pdf-bloque]'));
  for (const bloque of bloques) {
    const rect = bloque.getBoundingClientRect();
    const anchoPx = rect.width;
    const altoPx = rect.height;
    if (!anchoPx || !altoPx) continue;
    const mmPorPx = ANCHO / anchoPx;

    // Puntos de corte permitidos: el final de cada fila
    const cortes = Array.from(bloque.querySelectorAll<HTMLElement>('tr, li, [data-pdf-fila]'))
      .map(el => el.getBoundingClientRect().bottom - rect.top)
      .filter(v => v > 0 && v < altoPx)
      .sort((a, b) => a - b);
    cortes.push(altoPx);

    const canvas = await toCanvas(bloque, { pixelRatio: 2, backgroundColor: '#ffffff', fontEmbedCSS, cacheBust: true });
    const pxCanvas = canvas.width / anchoPx;

    // Un bloque que cabe en una página no se parte: si no cabe aquí, va a la siguiente
    const altoMm = altoPx * mmPorPx;
    if (altoMm <= Y_FIN - Y_INICIO && y + altoMm > Y_FIN) nuevaPagina();
    // Si es más alto que una página y queda poco espacio, también empieza en página nueva
    if (altoMm > Y_FIN - Y_INICIO && Y_FIN - y < 50) nuevaPagina();

    let inicio = 0;
    while (inicio < altoPx - 0.5) {
      const disponiblePx = (Y_FIN - y) / mmPorPx;
      let fin: number;
      if (altoPx - inicio <= disponiblePx) {
        fin = altoPx;
      } else {
        const posibles = cortes.filter(c => c > inicio + 1 && c - inicio <= disponiblePx);
        fin = posibles.length ? posibles[posibles.length - 1] : inicio + disponiblePx;
      }

      const tramo = document.createElement('canvas');
      tramo.width = canvas.width;
      tramo.height = Math.max(1, Math.round((fin - inicio) * pxCanvas));
      const ctx = tramo.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, tramo.width, tramo.height);
      ctx.drawImage(canvas, 0, Math.round(inicio * pxCanvas), canvas.width, tramo.height, 0, 0, tramo.width, tramo.height);
      const altoTramoMm = (fin - inicio) * mmPorPx;
      pdf.addImage(tramo.toDataURL('image/jpeg', 0.92), 'JPEG', MARGEN, y, ANCHO, altoTramoMm, undefined, 'FAST');

      y += altoTramoMm;
      inicio = fin;
      if (inicio < altoPx - 0.5) nuevaPagina();
    }
    y += SEPARACION;
  }

  // Pie con número de página
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(90, 106, 116);
    pdf.text('Trackerz · Reporte de Inteligencia', MARGEN, PAG_ALTO - 7);
    pdf.text(`Página ${i} de ${total}`, PAG_ANCHO - MARGEN, PAG_ALTO - 7, { align: 'right' });
  }

  pdf.save(opciones.archivo);
}
