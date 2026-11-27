/**
 * Reporte de avance de obra por período (botón Inteligencia → Reporte por período).
 * Se eligen las semanas como en "Filtrar por Período / Semana" de Control de Ejecución;
 * las cifras se calculan al momento y el administrador puede pedir a Claude el informe ejecutivo.
 * Los informes generados se guardan en la nube (uno por período) para que todos los consulten.
 */
import React from 'react';
import { CalendarRange, Download, FileText, RefreshCw, ShieldAlert, Sparkles, X } from 'lucide-react';
import type { Actividad } from '../types';
import type { ReportePeriodoGuardado } from '../types/reportePeriodo';
import { construirDatosPeriodo, datosParaIA, fechaCorta, semanasDisponibles, textoPeriodo, ultimaSemanaEjecutada } from '../utils/reportePeriodo';
import { apiFetch, ApiError } from '../utils/api';
import { exportarReportePdf } from '../utils/exportReportePdf';
import { ReportePeriodo } from './ReportePeriodo';
import { ClaveAdminDialog } from './ClaveAdminDialog';

const DOC = 'ai_reporte_periodo';
const MAX_GUARDADOS = 24;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  actividades: Actividad[];
  dataPlanificadoPG004: Record<string, Record<string, number>> | null | undefined;
  isAdmin: boolean;
  username?: string;
}

export const ReportePeriodoModal: React.FC<Props> = ({ isOpen, onClose, actividades, dataPlanificadoPG004, isAdmin, username }) => {
  const semanas = React.useMemo(() => semanasDisponibles(actividades, dataPlanificadoPG004), [actividades, dataPlanificadoPG004]);
  const ultima = React.useMemo(() => ultimaSemanaEjecutada(actividades), [actividades]);
  const finPorDefecto = ultima && semanas.includes(ultima) ? ultima : semanas[semanas.length - 1] || '';

  const [desde, setDesde] = React.useState('');
  const [hasta, setHasta] = React.useState('');
  const [guardados, setGuardados] = React.useState<ReportePeriodoGuardado[]>([]);
  const [generando, setGenerando] = React.useState(false);
  const [clave, setClave] = React.useState<{ abierto: boolean; error: string }>({ abierto: false, error: '' });
  const [exportando, setExportando] = React.useState(false);
  const pdfRef = React.useRef<HTMLDivElement>(null);

  // Período por defecto: las últimas 4 semanas hasta la última semana con ejecución
  const elegirUltimas = React.useCallback((n: number) => {
    if (!finPorDefecto) return;
    const i = semanas.indexOf(finPorDefecto);
    setDesde(semanas[Math.max(0, i - (n - 1))]);
    setHasta(finPorDefecto);
  }, [semanas, finPorDefecto]);

  React.useEffect(() => {
    if (isOpen && (!desde || !hasta || !semanas.includes(desde) || !semanas.includes(hasta))) elegirUltimas(4);
  }, [isOpen, semanas, desde, hasta, elegirUltimas]);

  // Informes guardados en la nube
  React.useEffect(() => {
    if (!isOpen) return;
    let cancelado = false;
    (async () => {
      try {
        const r = await apiFetch(`/api/docs/${DOC}`, undefined, [404]);
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelado && Array.isArray(j?.items)) setGuardados(j.items);
      } catch (e) {
        console.warn('No se pudieron leer los reportes por período guardados:', e);
      }
    })();
    return () => { cancelado = true; };
  }, [isOpen]);

  const guardado = guardados.find(g => g.datos.desde === desde && g.datos.hasta === hasta) || null;
  const datosVivos = React.useMemo(
    () => (desde && hasta ? construirDatosPeriodo(actividades, dataPlanificadoPG004, semanas, desde, hasta) : null),
    [actividades, dataPlanificadoPG004, semanas, desde, hasta],
  );
  // Con informe guardado se muestran las cifras con las que se escribió, para que texto y números coincidan
  const datos = guardado ? guardado.datos : datosVivos;

  const generar = async (password: string) => {
    if (!datosVivos) return;
    setClave({ abierto: false, error: '' });
    setGenerando(true);
    try {
      const res = await fetch('/api/ai/periodo-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datos: datosParaIA(datosVivos), password }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 403) { setClave({ abierto: true, error: j.message || 'Contraseña incorrecta.' }); return; }
      if (!res.ok) throw new Error(j.message || 'Error al comunicarse con el servicio de Inteligencia Artificial.');
      const nuevo: ReportePeriodoGuardado = {
        datos: datosVivos,
        analisis: j.analisis,
        modelo: j.modelo,
        generadoEn: j.generatedAt || new Date().toISOString(),
        generadoPor: username || 'Admin',
      };
      const lista = [nuevo, ...guardados.filter(g => !(g.datos.desde === desde && g.datos.hasta === hasta))].slice(0, MAX_GUARDADOS);
      setGuardados(lista);
      try {
        await apiFetch(`/api/docs/${DOC}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: lista }) });
      } catch (e) {
        alert(`El informe se generó pero no se pudo guardar en la nube: ${e instanceof ApiError ? e.message : e}`);
      }
    } catch (e: any) {
      alert(`Error al generar el informe: ${e?.message || e}`);
    } finally {
      setGenerando(false);
    }
  };

  // PDF desde una copia oculta con ancho fijo (A4)
  React.useEffect(() => {
    if (!exportando || !datos) return;
    let cancelado = false;
    (async () => {
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (cancelado || !pdfRef.current) return;
      try {
        await exportarReportePdf(pdfRef.current, {
          archivo: `Avance_Obra_${datos.desde}_a_${datos.hasta}.pdf`,
          titulo: 'Reporte de avance de obra por período',
          subtitulo: `${textoPeriodo(datos.desde, datos.hasta, datos.semanas.length).replace(" → ", " a ")}${guardado ? ` · Generado: ${new Date(guardado.generadoEn).toLocaleDateString('es-ES')}` : ''}`,
        });
      } catch (e: any) {
        alert(`No se pudo exportar el PDF: ${e?.message || e}`);
      } finally {
        if (!cancelado) setExportando(false);
      }
    })();
    return () => { cancelado = true; };
  }, [exportando, datos, guardado]);

  if (!isOpen) return null;

  const idxDesde = semanas.indexOf(desde);
  const idxHasta = semanas.indexOf(hasta);
  const atajos: { label: string; accion: () => void; activo: boolean }[] = finPorDefecto ? [
    { label: 'Última semana', accion: () => elegirUltimas(1), activo: desde === finPorDefecto && hasta === finPorDefecto },
    { label: 'Últimas 4 semanas', accion: () => elegirUltimas(4), activo: hasta === finPorDefecto && idxHasta - idxDesde === 3 },
    {
      label: `Mes de ${new Date(Number(finPorDefecto.slice(0, 4)), Number(finPorDefecto.slice(5, 7)) - 1, 1).toLocaleDateString('es-ES', { month: 'long' })}`,
      accion: () => {
        const mes = finPorDefecto.slice(0, 7);
        setDesde(semanas.find(s => s.startsWith(mes)) || finPorDefecto);
        setHasta(finPorDefecto);
      },
      activo: hasta === finPorDefecto && desde === (semanas.find(s => s.startsWith(finPorDefecto.slice(0, 7))) || ''),
    },
    { label: 'Desde el inicio', accion: () => { setDesde(semanas[0]); setHasta(finPorDefecto); }, activo: desde === semanas[0] && hasta === finPorDefecto },
  ] : [];

  const opcion = (s: string) => <option key={s} value={s}>{fechaCorta(s)}{s === ultima ? ' · última con ejecución' : ''}</option>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Cabecera */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
              <CalendarRange className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Reporte de avance de obra por período</h2>
              <p className="text-xs text-indigo-200/80">Lectura ejecutiva de Control de Ejecución: avance ejecutado por componente en las semanas elegidas</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-indigo-200 hover:text-white hover:bg-white/10 transition-colors" title="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector de período */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-end gap-3 shrink-0 text-xs">
          <label className="flex flex-col gap-1">
            <span className="font-bold text-slate-700">Desde la semana</span>
            <select value={desde} onChange={e => { setDesde(e.target.value); if (e.target.value > hasta) setHasta(e.target.value); }}
              className="border border-slate-300 rounded-lg px-2 py-1.5 bg-white min-w-[170px]">
              {semanas.map(opcion)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold text-slate-700">Hasta la semana</span>
            <select value={hasta} onChange={e => { setHasta(e.target.value); if (e.target.value < desde) setDesde(e.target.value); }}
              className="border border-slate-300 rounded-lg px-2 py-1.5 bg-white min-w-[170px]">
              {semanas.map(opcion)}
            </select>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {atajos.map(a => (
              <button key={a.label} type="button" onClick={a.accion}
                className={`px-2.5 py-1.5 rounded-lg border font-semibold cursor-pointer ${a.activo ? 'bg-[#312E81] border-[#312E81] text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-[#312E81]'}`}>
                {a.label}
              </button>
            ))}
          </div>
          {guardados.length > 0 && (
            <label className="flex flex-col gap-1 ml-auto">
              <span className="font-bold text-slate-700">Informes guardados ({guardados.length})</span>
              <select
                value={guardado ? `${guardado.datos.desde}|${guardado.datos.hasta}` : ''}
                onChange={e => { const [d, h] = e.target.value.split('|'); if (d && h) { setDesde(d); setHasta(h); } }}
                className="border border-slate-300 rounded-lg px-2 py-1.5 bg-white min-w-[220px]">
                <option value="">Elegir un informe…</option>
                {guardados.map(g => (
                  <option key={`${g.datos.desde}|${g.datos.hasta}`} value={`${g.datos.desde}|${g.datos.hasta}`}>
                    {textoPeriodo(g.datos.desde, g.datos.hasta, g.datos.semanas.length)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {/* Estado del análisis */}
        <div className="px-6 py-2 border-b border-slate-200 text-[11px] text-slate-600 flex flex-wrap items-center gap-2 shrink-0">
          {guardado ? (
            <>
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              <span>Análisis con IA generado el <strong>{new Date(guardado.generadoEn).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>{guardado.generadoPor ? ` por ${guardado.generadoPor}` : ''}. Las cifras son las de ese momento.</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Cifras calculadas ahora con los datos cargados. {isAdmin ? 'Genera el análisis con IA para obtener el informe ejecutivo.' : 'El análisis con IA de este período lo genera el administrador.'}</span>
            </>
          )}
        </div>

        {/* Cuerpo */}
        <div className="ht-theme p-6 overflow-y-auto flex-1 text-slate-800">
          {generando ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-4 text-center">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                <Sparkles className="w-6 h-6 text-indigo-600 absolute inset-0 m-auto" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-800">Generando el informe del período…</h3>
                <p className="text-xs text-slate-500 max-w-md">La app ya calculó las cifras. Claude está escribiendo el análisis por componente; puede tardar uno o dos minutos.</p>
              </div>
            </div>
          ) : !semanas.length ? (
            <div className="py-12 text-center text-sm text-slate-500">No hay semanas con plan o ejecución en el cronograma cargado.</div>
          ) : datos ? (
            <ReportePeriodo datos={datos} analisis={guardado?.analisis} />
          ) : null}
        </div>

        {exportando && datos && (
          <div aria-hidden style={{ position: 'fixed', left: -12000, top: 0, width: 900, background: '#ffffff', pointerEvents: 'none' }}>
            <div ref={pdfRef} className="reporte-pdf ht-theme" style={{ width: 900, padding: 0, background: '#ffffff' }}>
              <ReportePeriodo datos={datos} analisis={guardado?.analisis} paraPdf />
            </div>
          </div>
        )}

        {/* Pie */}
        <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            onClick={() => setExportando(true)}
            disabled={!datos || generando || exportando}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download className={`w-3.5 h-3.5 text-slate-500 ${exportando ? 'animate-pulse' : ''}`} />
            <span>{exportando ? 'Generando PDF…' : 'Exportar PDF (A4)'}</span>
          </button>
          <div className="flex items-center gap-3">
            {isAdmin ? (
              <button
                onClick={() => setClave({ abierto: true, error: '' })}
                disabled={!datosVivos || generando}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {guardado ? <RefreshCw className={`w-3.5 h-3.5 ${generando ? 'animate-spin' : ''}`} /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>{generando ? 'Generando…' : guardado ? 'Actualizar análisis IA' : 'Generar análisis IA'}</span>
              </button>
            ) : (
              <div className="px-3 py-1.5 bg-slate-200 text-slate-500 font-semibold text-xs rounded-xl flex items-center gap-1.5" title="Solo el administrador genera el análisis con IA.">
                <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                <span>Análisis IA solo admin</span>
              </div>
            )}
            <button onClick={onClose} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all">
              Cerrar
            </button>
          </div>
        </div>
      </div>

      <ClaveAdminDialog
        abierto={clave.abierto}
        error={clave.error}
        verificando={generando}
        onConfirmar={generar}
        onCancelar={() => setClave({ abierto: false, error: '' })}
      />
    </div>
  );
};
