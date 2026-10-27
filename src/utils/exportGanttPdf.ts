/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';

export async function exportGanttToPdfA3(elementId: string = 'gantt-card-container'): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element #${elementId} not found`);
  }

  // A3 standard dimensions in mm (Landscape: 420mm x 297mm)
  const A3_WIDTH_MM = 420;
  const A3_HEIGHT_MM = 297;
  const MARGIN_MM = 10;
  const printableWidthMm = A3_WIDTH_MM - MARGIN_MM * 2; // 400 mm
  const printableHeightMm = A3_HEIGHT_MM - MARGIN_MM * 2; // 277 mm

  // Retrieve containers
  const viewportContainer = document.getElementById('gantt-viewport-container');
  const bodyScrollContainer = document.getElementById('gantt-body-scroll-container');
  const barsScrollContainer = document.getElementById('gantt-bars-scroll-container');
  const barsInner = document.getElementById('gantt-bars-inner-container');
  const bodyInner = bodyScrollContainer?.firstElementChild as HTMLElement | null;

  const toolbarEl = document.getElementById('gantt-controls-toolbar');
  const tableHdrEl = document.getElementById('gantt-table-header');

  const scrollLeft = Math.round(barsScrollContainer?.scrollLeft || 0);
  const scrollTop = Math.round(barsScrollContainer?.scrollTop || bodyScrollContainer?.scrollTop || 0);

  // Save original styles to restore in finally block
  const originalViewportMaxHeight = viewportContainer?.style.maxHeight || '';
  const originalViewportHeight = viewportContainer?.style.height || '';

  const originalBodyOverflow = bodyScrollContainer?.style.overflow || '';
  const originalBodyHeight = bodyScrollContainer?.style.height || '';
  const originalBodyMaxHeight = bodyScrollContainer?.style.maxHeight || '';

  const originalBarsOverflow = barsScrollContainer?.style.overflow || '';
  const originalBarsHeight = barsScrollContainer?.style.height || '';
  const originalBarsMaxHeight = barsScrollContainer?.style.maxHeight || '';

  const originalBarsTransform = barsInner?.style.transform || '';
  const originalBodyTransform = bodyInner?.style.transform || '';

  try {
    // 1. Temporarily expand all vertical constraints so EVERY row in the Gantt is visible in the DOM
    if (viewportContainer) {
      viewportContainer.style.maxHeight = 'none';
      viewportContainer.style.height = 'auto';
    }
    if (bodyScrollContainer) {
      bodyScrollContainer.style.overflow = 'visible';
      bodyScrollContainer.style.height = 'auto';
      bodyScrollContainer.style.maxHeight = 'none';
    }
    if (barsScrollContainer) {
      barsScrollContainer.style.overflow = 'hidden';
      barsScrollContainer.style.height = 'auto';
      barsScrollContainer.style.maxHeight = 'none';
    }

    // Preserve horizontal scroll position of timeline to align with time header
    if (barsInner) {
      barsInner.style.transform = `translateX(-${scrollLeft}px)`;
    }
    if (bodyInner) {
      bodyInner.style.transform = '';
    }

    // Ensure all web fonts are loaded and layout is fully stabilized
    if (document.fonts) {
      await document.fonts.ready;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Filter out elements marked for ignore (e.g. popups, tooltips)
    const filter = (node: HTMLElement) => {
      if (!node || !node.getAttribute) return true;
      const ignore =
        node.getAttribute('data-html2canvas-ignore') === 'true' ||
        node.getAttribute('data-pdf-ignore') === 'true';
      return !ignore;
    };

    // Calculate optimal high-DPI pixel ratio for A3 print clarity (target 3.0x, ~270 DPI)
    const totalScrollHeight = Math.max(element.scrollHeight || 1500, 1000);
    let highResPixelRatio = 3.0;
    // Guard against exceeding browser canvas texture limit (16,000px) on extremely long charts
    if (totalScrollHeight * highResPixelRatio > 15000) {
      highResPixelRatio = Math.max(2.2, Math.floor((15000 / totalScrollHeight) * 10) / 10);
    }

    // 2. Render entire unconstrained Gantt card into a high-res, razor-sharp canvas
    const canvas = await toCanvas(element, {
      pixelRatio: highResPixelRatio,
      backgroundColor: '#ffffff',
      filter: filter as any,
      cacheBust: true,
      style: {
        webkitFontSmoothing: 'antialiased',
        textRendering: 'geometricPrecision',
      } as any,
    });

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a3',
      compress: true,
    });

    const mmPerPx = printableWidthMm / canvas.width;
    const pxPerMm = canvas.width / printableWidthMm;
    const maxPageHeightPx = Math.floor(printableHeightMm * pxPerMm);
    const totalHeightMm = canvas.height * mmPerPx;

    // Check if entire Gantt fits comfortably on a single A3 sheet
    if (totalHeightMm <= printableHeightMm) {
      const yOffset = MARGIN_MM + Math.max(0, (printableHeightMm - totalHeightMm) / 2);
      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        MARGIN_MM,
        yOffset,
        printableWidthMm,
        totalHeightMm,
        undefined,
        'SLOW'
      );
    } else {
      // Multi-page pagination: slice cleanly between rows and repeat table/time headers
      const scaleRatio = canvas.width / (element.offsetWidth || 1);
      const toolbarH = toolbarEl ? toolbarEl.offsetHeight : 45;
      const tableHdrH = tableHdrEl ? tableHdrEl.offsetHeight : 24;
      const headerHeightPx = Math.round((toolbarH + tableHdrH) * scaleRatio);
      const colHeaderStartPx = Math.round(toolbarH * scaleRatio);
      const colHeaderHeightPx = Math.max(20, headerHeightPx - colHeaderStartPx);
      const rowHeightPx = Math.max(18, Math.round(24 * scaleRatio));

      // Page 1: Top toolbar + Column headers + First batch of complete rows
      const availableHeightPage1 = maxPageHeightPx - headerHeightPx;
      const rowsPage1 = Math.max(1, Math.floor(availableHeightPage1 / rowHeightPx));
      const page1RowsHeight = rowsPage1 * rowHeightPx;
      const page1TotalHeight = Math.min(canvas.height, headerHeightPx + page1RowsHeight);

      const p1Canvas = document.createElement('canvas');
      p1Canvas.width = canvas.width;
      p1Canvas.height = page1TotalHeight;
      const ctx1 = p1Canvas.getContext('2d', { alpha: false });
      if (ctx1) {
        ctx1.imageSmoothingEnabled = true;
        ctx1.imageSmoothingQuality = 'high';
        ctx1.fillStyle = '#ffffff';
        ctx1.fillRect(0, 0, p1Canvas.width, p1Canvas.height);
        ctx1.drawImage(canvas, 0, 0, canvas.width, page1TotalHeight, 0, 0, canvas.width, page1TotalHeight);
      }

      pdf.addImage(
        p1Canvas.toDataURL('image/png'),
        'PNG',
        MARGIN_MM,
        MARGIN_MM,
        printableWidthMm,
        page1TotalHeight * mmPerPx,
        undefined,
        'SLOW'
      );

      // Subsequent pages: Column headers + next batches of complete rows
      let currentSourceY = headerHeightPx + page1RowsHeight;

      while (currentSourceY < canvas.height) {
        const remainingRowsPx = canvas.height - currentSourceY;
        const availableHeightRows = maxPageHeightPx - colHeaderHeightPx;
        const numRowsThisPage = Math.max(1, Math.floor(availableHeightRows / rowHeightPx));
        const sliceRowsHeightPx = Math.min(numRowsThisPage * rowHeightPx, remainingRowsPx);

        const pageSliceCanvas = document.createElement('canvas');
        pageSliceCanvas.width = canvas.width;
        pageSliceCanvas.height = colHeaderHeightPx + sliceRowsHeightPx;
        const ctx = pageSliceCanvas.getContext('2d', { alpha: false });
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageSliceCanvas.width, pageSliceCanvas.height);
          // Repeat column headers at top of each page for clear column/timeline reference
          ctx.drawImage(
            canvas,
            0,
            colHeaderStartPx,
            canvas.width,
            colHeaderHeightPx,
            0,
            0,
            canvas.width,
            colHeaderHeightPx
          );
          // Draw next batch of rows
          ctx.drawImage(
            canvas,
            0,
            currentSourceY,
            canvas.width,
            sliceRowsHeightPx,
            0,
            colHeaderHeightPx,
            canvas.width,
            sliceRowsHeightPx
          );
        }

        pdf.addPage('a3', 'landscape');
        const pageHeightMm = (colHeaderHeightPx + sliceRowsHeightPx) * mmPerPx;
        pdf.addImage(
          pageSliceCanvas.toDataURL('image/png'),
          'PNG',
          MARGIN_MM,
          MARGIN_MM,
          printableWidthMm,
          pageHeightMm,
          undefined,
          'SLOW'
        );

        currentSourceY += sliceRowsHeightPx;
      }

      // Add page numbers at the footer of each page
      const totalPages = (pdf as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184);
        pdf.text(
          `Página ${i} de ${totalPages}`,
          A3_WIDTH_MM - MARGIN_MM,
          A3_HEIGHT_MM - 4,
          { align: 'right' }
        );
      }
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    pdf.save(`Gantt_Proyecto_A3_${dateStr}.pdf`);
  } finally {
    // 3. Restore all original styles and scroll positions seamlessly
    if (viewportContainer) {
      viewportContainer.style.maxHeight = originalViewportMaxHeight;
      viewportContainer.style.height = originalViewportHeight;
    }
    if (bodyScrollContainer) {
      bodyScrollContainer.style.overflow = originalBodyOverflow;
      bodyScrollContainer.style.height = originalBodyHeight;
      bodyScrollContainer.style.maxHeight = originalBodyMaxHeight;
    }
    if (barsScrollContainer) {
      barsScrollContainer.style.overflow = originalBarsOverflow;
      barsScrollContainer.style.height = originalBarsHeight;
      barsScrollContainer.style.maxHeight = originalBarsMaxHeight;
    }
    if (barsInner) {
      barsInner.style.transform = originalBarsTransform;
    }
    if (bodyInner) {
      bodyInner.style.transform = originalBodyTransform;
    }

    // Restore scroll positions
    if (barsScrollContainer) {
      barsScrollContainer.scrollLeft = scrollLeft;
      barsScrollContainer.scrollTop = scrollTop;
    }
    if (bodyScrollContainer) {
      bodyScrollContainer.scrollTop = scrollTop;
    }
  }
}
