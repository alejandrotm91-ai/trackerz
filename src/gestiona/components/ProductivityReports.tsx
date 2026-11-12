import React, { useState, useMemo } from "react";
import { 
  Activity, 
  Member, 
  Project, 
  TimeLog, 
  AIProductivityReport,
  WorkspaceType,
  WORKSPACES
} from "../types";
import { 
  BarChart3, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Sparkles, 
  Download, 
  Printer, 
  ShieldAlert, 
  Lightbulb, 
  Users, 
  Layers, 
  Wrench, 
  Copy, 
  Check 
} from "lucide-react";

interface ProductivityReportsProps {
  project: Project;
  activities: Activity[];
  members: Member[];
  timeLogs: TimeLog[];
  currentWorkspace?: WorkspaceType;
  isLoading?: boolean;
}

export const ProductivityReports: React.FC<ProductivityReportsProps> = ({
  project,
  activities,
  members,
  timeLogs,
  currentWorkspace = 'equipos',
  isLoading = false,
}) => {
  const [aiReport, setAiReport] = useState<AIProductivityReport | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);

  const activeWsConfig = WORKSPACES[currentWorkspace] || WORKSPACES.equipos;
  const todayStr = new Date().toISOString().split("T")[0];

  // Mathematical metrics calculation
  const totalActivities = activities.length;
  const electricoCount = activities.filter((a) => (a.status || "").toLowerCase().includes("elec")).length;
  const mecanicoCount = activities.filter((a) => (a.status || "").toLowerCase().includes("mecan") || (a.status || "").toLowerCase().includes("mec")).length;
  const instrumentacionCount = activities.filter((a) => (a.status || "").toLowerCase().includes("inst")).length;
  const civilCount = activities.filter((a) => (a.status || "").toLowerCase().includes("civ")).length;

  const overdueActivities = activities.filter(
    (a) => a.dueDate && a.dueDate < todayStr
  ).length;

  const urgentActivitiesCount = activities.filter(
    (a) => a.priority === "urgent"
  ).length;

  const onTimeRate = totalActivities > 0 ? Math.round(((totalActivities - overdueActivities) / totalActivities) * 100) : 100;

  // Phase Progress - strictly filtered by the active workspace toggle
  const phaseMetrics = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const wsPhases = activeWsConfig.phases || [];
    const map: Record<string, { total: number; completed: number; urgent: number }> = {};
    
    // Initialize only the phases belonging to this workspace toggle
    wsPhases.forEach((p) => {
      map[p] = { total: 0, completed: 0, urgent: 0 };
    });

    activities.forEach((act) => {
      const actPhase = (act.phase || "").trim();
      const matchedPhase = wsPhases.find(
        (p) => p.toLowerCase().trim() === actPhase.toLowerCase()
      );
      if (matchedPhase) {
        map[matchedPhase].total += 1;
        if (act.status === "completed") {
          map[matchedPhase].completed += 1;
        } else {
          const isOverdue = act.dueDate && act.dueDate < today;
          if (isOverdue || act.priority === "urgent") {
            map[matchedPhase].urgent += 1;
          }
        }
      }
    });

    const list = Object.entries(map).map(([phase, data]) => {
      const phaseIdx = wsPhases.indexOf(phase);
      return {
        phase,
        index: phaseIdx >= 0 ? phaseIdx + 1 : 1,
        total: data.total,
        completed: data.completed,
        pendingOrActive: data.total - data.completed,
        urgent: data.urgent,
        percent: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      };
    });

    // Sort descending by total tasks (mayor a menor), matching workload card format
    return list.sort((a, b) => b.total - a.total);
  }, [activities, activeWsConfig.phases]);

  // Workload by Member - sorted by total assigned tasks descending (mayor a menor)
  const memberWorkload = useMemo(() => {
    const list = members.map((m) => {
      const memberActs = activities.filter((a) => a.responsibleId === m.id);
      const completed = memberActs.filter((a) => a.status === "completed").length;
      const pendingOrActive = memberActs.filter((a) => a.status !== "completed").length;
      const urgent = memberActs.filter((a) => a.priority === "urgent" && a.status !== "completed").length;

      return {
        member: m,
        total: memberActs.length,
        completed,
        pendingOrActive,
        urgent,
        completionPercent: memberActs.length > 0 ? Math.round((completed / memberActs.length) * 100) : 0,
      };
    });

    // Sort descending by total assigned tasks
    return list.sort((a, b) => b.total - a.total);
  }, [members, activities]);

  // Discipline Distribution Metrics - sorted by total assigned tasks descending
  const disciplineMetrics = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const defs = activeWsConfig.disciplines.map((d) => ({
      id: d.id,
      name: d.label,
      icon: d.icon,
      colorClass: d.color,
      barColor: d.color.includes("blue") 
        ? "bg-blue-600" 
        : d.color.includes("amber") 
        ? "bg-amber-500" 
        : d.color.includes("violet")
        ? "bg-violet-600"
        : d.color.includes("purple") 
        ? "bg-purple-600" 
        : d.color.includes("cyan")
        ? "bg-cyan-600"
        : d.color.includes("rose")
        ? "bg-rose-600"
        : "bg-emerald-600",
      match: (st: string) => st === d.id || (st || "").toLowerCase().includes(d.id.replace("_", "")),
    }));

    const list = defs.map((d) => {
      const discActs = activities.filter((a) => a.status === d.id || d.match((a.status || "").toLowerCase()));
      const urgent = discActs.filter(
        (a) => a.priority === "urgent" || (a.dueDate && a.dueDate < today)
      ).length;
      const completed = discActs.filter((a) => a.status === "completed").length;
      const percentOfTotal = totalActivities > 0 ? Math.round((discActs.length / totalActivities) * 100) : 0;

      return {
        id: d.id,
        name: d.name,
        icon: d.icon,
        colorClass: d.colorClass,
        barColor: d.barColor,
        total: discActs.length,
        completed,
        pendingOrActive: discActs.length - completed,
        urgent,
        percentOfTotal,
      };
    });

    return list.sort((a, b) => b.total - a.total);
  }, [activities, totalActivities, activeWsConfig]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyReport = () => {
    if (!aiReport) return;
    const text = `📊 *INFORME EJECUTIVO DE PRODUCTIVIDAD - OBRA*
🏗️ *Proyecto:* ${project.name}
🗓️ *Fecha:* ${aiReport.generatedAt || new Date().toLocaleDateString('es-ES')}
📈 *Índice de Salud del Proyecto:* ${aiReport.healthScore}/100

📋 *RESUMEN EJECUTIVO:*
${aiReport.summary}

🏆 *LOGROS PRINCIPALES:*
${aiReport.keyAchievements?.map((a) => `• ${a}`).join("\n")}

⚠️ *RIESGOS IDENTIFICADOS:*
${aiReport.risks?.map((r) => `• ${r}`).join("\n")}

💡 *RECOMENDACIONES PARA LA PRÓXIMA REUNIÓN:*
${aiReport.recommendations?.map((rec) => `• ${rec}`).join("\n")}
`;
    navigator.clipboard.writeText(text);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 3000);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto print:p-0 pb-16">
        {/* Header Actions Skeleton */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 p-4 rounded-lg shadow-2xs">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              Reportes Automatizados de Productividad & Avance
            </h2>
            <div className="mt-1 flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
              <p className="text-xs text-slate-500 animate-pulse">
                Cargando información y métricas del proyecto...
              </p>
            </div>
          </div>
        </div>

        {/* Primary KPI Cards Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-slate-200 p-3.5 rounded-lg shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-28 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 w-4 bg-slate-200 rounded-full animate-pulse" />
              </div>
              <div className="h-7 w-20 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-36 bg-slate-100 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Detailed Analysis Breakdown Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {/* Left Column: Avance por Fase & Disciplina */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3">
              <div className="h-4 w-44 bg-slate-200 rounded animate-pulse" />
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-slate-50 border border-slate-200 rounded-md p-2.5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-32 bg-slate-200 rounded animate-pulse" />
                      <div className="h-2 w-24 bg-slate-200 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3">
              <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-14 bg-slate-50 border border-slate-200 rounded-md p-2.5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-36 bg-slate-200 rounded animate-pulse" />
                      <div className="h-2 w-28 bg-slate-200 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Workload Skeleton - absolutely NO names, NO roles */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3">
            <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-slate-50 border border-slate-200 rounded-md p-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse shrink-0" />
                    <div className="space-y-1.5">
                      <div className="h-3.5 w-28 bg-slate-200 rounded animate-pulse" />
                      <div className="h-2.5 w-36 bg-slate-200 rounded animate-pulse" />
                    </div>
                  </div>
                  <div className="h-6 w-16 bg-slate-200 rounded-full animate-pulse shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto print:p-0 pb-16">
      {/* Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 p-4 rounded-lg shadow-2xs">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            Reportes Automatizados de Productividad & Avance
          </h2>
          <p className="text-xs text-slate-500">
            Métricas consolidadas en tiempo real, balance de cargas y estado general del proyecto
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-md text-xs font-semibold transition-colors cursor-pointer"
            title="Imprimir o Guardar como PDF"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 p-3.5 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total de Actividades</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">{totalActivities}</span>
            <span className="text-[11px] text-slate-500">registradas en obra</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Divididas en <span className="font-semibold text-slate-700">{phaseMetrics.length} fases</span>
          </p>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Puntualidad en Entregas</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">{onTimeRate}%</span>
            <span className="text-[11px] text-slate-500">a tiempo</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            {overdueActivities > 0 ? (
              <span className="text-rose-600 font-semibold">⚠️ {overdueActivities} con fecha vencida</span>
            ) : (
              <span className="text-emerald-700">Sin desfases en fechas</span>
            )}
          </p>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Prioridad Urgente</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">{urgentActivitiesCount}</span>
            <span className="text-[11px] text-slate-500">actividades críticas</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            {urgentActivitiesCount > 0 ? (
              <span className="text-amber-700 font-semibold">Requieren atención prioritaria</span>
            ) : (
              <span className="text-emerald-700">Sin urgencias críticas</span>
            )}
          </p>
        </div>
      </div>

      {/* AI Executive Report Section (if generated) */}
      {aiReport && (
        <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-4 shadow-2xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-200 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-blue-950 flex items-center gap-1.5">
                  Informe Ejecutivo de Productividad con IA
                </h3>
                <p className="text-[11px] text-blue-700">Generado el {aiReport.generatedAt}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Health Score Pill */}
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-blue-200">
                <span className="text-xs text-slate-600">Salud del Proyecto:</span>
                <span className="font-mono text-sm font-black text-blue-700">
                  {aiReport.healthScore}/100
                </span>
              </div>

              <button
                onClick={handleCopyReport}
                className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-800 border border-blue-200 rounded-md text-xs font-semibold transition-colors cursor-pointer"
              >
                {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedReport ? "Copiado" : "Copiar"}</span>
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white p-3 rounded-md border border-blue-200 text-xs text-slate-700 leading-relaxed">
            <span className="font-bold text-blue-900 uppercase tracking-wider block mb-1">
              Evaluación Global:
            </span>
            {aiReport.summary}
          </div>

          {/* Achievements & Risks Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="bg-white border border-emerald-200 rounded-md p-3 space-y-1.5">
              <h4 className="font-bold text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Logros y Puntos Fuertes
              </h4>
              <ul className="space-y-1 text-slate-600 list-disc list-inside">
                {aiReport.keyAchievements?.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="bg-white border border-rose-200 rounded-md p-3 space-y-1.5">
              <h4 className="font-bold text-rose-800 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                Riesgos & Puntos de Atención
              </h4>
              <ul className="space-y-1 text-slate-600 list-disc list-inside">
                {aiReport.risks?.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Strategic Recommendations */}
          <div className="bg-white border border-blue-200 rounded-md p-3 space-y-1.5 text-xs">
            <h4 className="font-bold text-blue-900 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              Recomendaciones para la Siguiente Reunión de Obra
            </h4>
            <ul className="space-y-1 text-slate-600 list-disc list-inside">
              {aiReport.recommendations?.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Detailed Analysis Breakdown: Phases & Disciplines in left column, Workload in right column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Left Column: Avance por Fase de Obra + Distribución por Disciplina */}
        <div className="space-y-4">
          {/* Phase Progress Card */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-600" />
                Avance por Fase • {activeWsConfig.name}
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">
                Ordenado de mayor a menor
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {phaseMetrics.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  No hay fases registradas para {activeWsConfig.name}
                </div>
              ) : (
                phaseMetrics.map(({ phase, index, total, completed, pendingOrActive, urgent, percent }) => (
                <div
                  key={phase}
                  className="bg-slate-50 hover:bg-slate-100/80 transition-colors border border-slate-200 p-2.5 rounded-md flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                      F{index}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900 truncate text-xs">{phase}</p>
                        <span className="inline-flex items-center font-bold px-2 py-0.5 rounded-full text-[11px] bg-blue-100 text-blue-800 border border-blue-200">
                          {total} {total === 1 ? "tarea" : "tareas"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-24 sm:w-32 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-blue-600 h-full rounded-full transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono font-medium">{percent}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 text-right shrink-0">
                    {urgent > 0 ? (
                      <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-md font-bold">
                        {urgent} urgentes
                      </span>
                    ) : percent === 100 ? (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md font-bold">
                        Completada
                      </span>
                    ) : (
                      <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md font-medium">
                        En curso
                      </span>
                    )}
                  </div>
                </div>
              )))}
            </div>
          </div>

          {/* Discipline Distribution Card */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-blue-600" />
                Distribución por Disciplina
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">
                Ordenado de mayor a menor
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {disciplineMetrics.map(({ id, name, icon, barColor, total, completed, pendingOrActive, urgent, percentOfTotal }) => (
                <div
                  key={id}
                  className="bg-slate-50 hover:bg-slate-100/80 transition-colors border border-slate-200 p-2.5 rounded-md flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-white border border-slate-200 text-base flex items-center justify-center shrink-0 shadow-2xs">
                      {icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900 truncate text-xs">{name}</p>
                        <span className="inline-flex items-center font-bold px-2 py-0.5 rounded-full text-[11px] bg-blue-100 text-blue-800 border border-blue-200">
                          {total} {total === 1 ? "tarea" : "tareas"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-24 sm:w-32 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`${barColor} h-full rounded-full transition-all`}
                            style={{ width: `${percentOfTotal}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono font-medium">{percentOfTotal}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 text-right shrink-0">
                    <div>
                      <span className="font-mono font-bold text-slate-800 text-xs block">{percentOfTotal}% del total</span>
                      <span className="text-[10px] text-slate-500">{completed} completadas • {pendingOrActive} en curso</span>
                    </div>

                    {urgent > 0 ? (
                      <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-md font-bold">
                        {urgent} urgentes
                      </span>
                    ) : (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md font-medium">
                        Al día
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Workload by Member Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-600" />
              Balance de Carga del Equipo
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">
              Ordenado de mayor a menor
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {memberWorkload.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs bg-slate-50 rounded-md border border-dashed border-slate-200">
                No hay miembros registrados en este espacio de trabajo
              </div>
            ) : (
              memberWorkload.map(({ member, total }) => (
                <div
                  key={member.id}
                  className="bg-slate-50 hover:bg-slate-100/80 transition-colors border border-slate-200 p-2.5 rounded-md flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-full ${member.avatarColor} text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs`}>
                      {member.initials}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate text-xs">{member.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{member.role}</p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <span className="inline-flex items-center font-bold px-2.5 py-1 rounded-full text-xs bg-blue-100 text-blue-800 border border-blue-200">
                      {total} {total === 1 ? "tarea" : "tareas"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
