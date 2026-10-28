import type { ReporteIA } from '../types/reporteIA';

export const fmtNum = (v: number, dec = 0) =>
  (v || 0).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const fmtM = (v: number) => `${((v || 0) / 1e6).toFixed(2)}M`;
const signo = (v: number) => (v > 0 ? '+' : '');

/** Versión en texto (Markdown) del reporte estándar, para copiar y pegar. */
export function reporteATexto(r: ReporteIA): string {
  const { datos: d, analisis: a } = r;
  const k = d.kpis;
  const L: string[] = [];
  L.push(`# Reporte de Inteligencia · Cronograma`);
  L.push(`Fecha de corte: ${d.fechaCorte} · Estado general: ${a.estadoGeneral}`);
  L.push('');
  L.push('## Indicadores');
  L.push(`- Actividades retrasadas: ${fmtNum(k.retrasadas)} de ${fmtNum(k.totalActividades)}`);
  L.push(`- Próximas 4 semanas: ${fmtNum(k.proximas4Semanas)}`);
  L.push(`- Venta planificada ${fmtM(k.ventaPlan)} · ejecutada ${fmtM(k.ventaEjecutada)} · variación ${signo(k.variacion)}${fmtM(k.variacion)}`);
  L.push(`- Partidas con desvío mayor a 10,000: ${k.partidasCriticas} (${fmtM(k.montoCritico)})`);
  L.push(`- Equipos e instrumentos por instalar: ${fmtNum(k.equiposPendientes)} en ${k.partidasEquipos} partidas`);
  L.push('');
  L.push('## 1. Resumen ejecutivo');
  L.push(a.resumenEjecutivo);
  a.puntosClave.forEach(p => L.push(`- ${p}`));
  L.push('', `Comparación con el reporte anterior: ${a.comparacionAnterior}`, '');
  L.push('## 2. Retraso económico por tipología');
  L.push('| Tipología | Venta plan | Venta ejecutada | Variación | % avance | Partidas > 10k |');
  L.push('| :--- | ---: | ---: | ---: | ---: | ---: |');
  d.tipologias.forEach(t => L.push(`| ${t.nombre} | ${fmtNum(t.ventaPlan)} | ${fmtNum(t.ventaEjecutada)} | ${signo(t.variacion)}${fmtNum(t.variacion)} | ${t.pctAvance.toFixed(1)}% | ${t.criticas} |`));
  L.push('', a.economico.analisis);
  a.economico.hallazgos.forEach(h => L.push(`- ${h}`));
  L.push('', '## 3. Actividades retrasadas por área');
  L.push('| Área | Retrasadas | Máx. días de atraso |', '| :--- | ---: | ---: |');
  d.retrasos.forEach(x => L.push(`| ${x.area} | ${x.retrasadas} | ${x.maxDiasAtraso} |`));
  L.push('', a.retrasos.analisis);
  a.retrasos.areasCriticas.forEach(x => L.push(`- ${x.area}: ${x.comentario}`));
  L.push('', '## 4. Próximas 4 semanas por área');
  L.push('| Área | Actividades |', '| :--- | ---: |');
  d.proximas.forEach(x => L.push(`| ${x.area} | ${x.actividades} |`));
  L.push('', a.proximas.analisis);
  a.proximas.compromisos.forEach(x => L.push(`- ${x.area}: ${x.compromiso}`));
  L.push('', '## 5. Equipos e instrumentos pendientes por SCAP');
  L.push('| Tipo | SCAP | Pendiente | Partidas | Avance |', '| :--- | :--- | ---: | ---: | ---: |');
  d.equipamiento.forEach(e => L.push(`| ${e.tipo} | ${e.scap} | ${fmtNum(e.pendiente, 2)} ${e.unidades} | ${e.partidas} | ${e.avance.toFixed(1)}% |`));
  L.push('', a.equipamiento.analisis, '');
  L.push('## 6. Recomendaciones');
  L.push('| Prioridad | Acción | Área | Plazo |', '| :--- | :--- | :--- | :--- |');
  a.recomendaciones.forEach(x => L.push(`| ${x.prioridad} | ${x.accion} | ${x.area} | ${x.plazo} |`));
  return L.join('\n');
}
