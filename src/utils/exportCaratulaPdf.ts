/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

export async function exportCaratulaToPdfA3(elementId: string = 'caratula-container'): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element #${elementId} not found`);
  }

  // A3 dimensions in mm (Landscape: 420mm x 297mm, Portrait: 297mm x 420mm)
  const A3_WIDTH_MM = 420;
  const A3_HEIGHT_MM = 297;
  const MARGIN_MM = 10;

  // Filter out elements with data-html2canvas-ignore="true" or pdf ignore
  const filter = (node: HTMLElement) => {
    if (!node || !node.getAttribute) return true;
    const ignore = node.getAttribute('data-html2canvas-ignore') === 'true' || node.getAttribute('data-pdf-ignore') === 'true';
    return !ignore;
  };

  // Convert DOM to high-res image using browser native SVG foreignObject (fully supports oklch, gradients, svgs)
  const imgData = await toPng(element, {
    pixelRatio: 2.2,
    backgroundColor: '#f8fafc',
    filter: filter as any,
    cacheBust: true,
  });

  // Create temporary image to obtain exact dimensions
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => reject(e);
    img.src = imgData;
  });

  const imgWidthPx = img.naturalWidth || img.width;
  const imgHeightPx = img.naturalHeight || img.height;
  const aspectRatio = imgWidthPx / imgHeightPx;

  // Choose orientation based on aspect ratio
  const isLandscape = aspectRatio >= 1;
  const orientation = isLandscape ? 'landscape' : 'portrait';
  const pageWidthMm = isLandscape ? A3_WIDTH_MM : A3_HEIGHT_MM;
  const pageHeightMm = isLandscape ? A3_HEIGHT_MM : A3_WIDTH_MM;

  const printableWidthMm = pageWidthMm - (MARGIN_MM * 2);
  const printableHeightMm = pageHeightMm - (MARGIN_MM * 2);

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a3',
    compress: true
  });

  // Calculate scaled dimensions to fit or paginate nicely
  const scaledImgHeightMm = (printableWidthMm / imgWidthPx) * imgHeightPx;

  if (scaledImgHeightMm <= printableHeightMm) {
    // Single page fit with centered vertical layout
    const yOffset = MARGIN_MM + Math.max(0, (printableHeightMm - scaledImgHeightMm) / 4);
    pdf.addImage(imgData, 'PNG', MARGIN_MM, yOffset, printableWidthMm, scaledImgHeightMm, undefined, 'FAST');
  } else {
    // If it exceeds single page, paginate cleanly
    let heightLeftMm = scaledImgHeightMm;
    let positionMm = MARGIN_MM;

    pdf.addImage(imgData, 'PNG', MARGIN_MM, positionMm, printableWidthMm, scaledImgHeightMm, undefined, 'FAST');
    heightLeftMm -= printableHeightMm;

    while (heightLeftMm > 0) {
      positionMm = heightLeftMm - scaledImgHeightMm + MARGIN_MM;
      pdf.addPage('a3', orientation);
      pdf.addImage(imgData, 'PNG', MARGIN_MM, positionMm, printableWidthMm, scaledImgHeightMm, undefined, 'FAST');
      heightLeftMm -= printableHeightMm;
    }
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  pdf.save(`Resumen_Proyecto_A3_${dateStr}.pdf`);
}
