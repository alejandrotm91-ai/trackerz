import React, { useState, useMemo, useEffect } from "react";
import { 
  Activity, 
  ActivityStatus, 
  ActivityPriority, 
  Member,
  WorkspaceType,
  DisciplineDefinition,
  WORKSPACES
} from "../types";
import { 
  Search, 
  Plus, 
  Calendar, 
  Clock, 
  Play, 
  Pause, 
  Trash2, 
  Download, 
  Filter, 
  CheckCircle2, 
  CheckSquare,
  AlertTriangle, 
  ArrowUpDown,
  Flame,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  RotateCcw,
  Layers
} from "lucide-react";
import confetti from "canvas-confetti";
import { generateNextActivityId, canUserEdit } from "../lib/activityUtils";

interface TableViewProps {
  activities: Activity[];
  members: Member[];
  currentMember: Member;
  currentWorkspace?: WorkspaceType;
  phases?: string[];
  disciplines?: DisciplineDefinition[];
  onUpdateActivity: (activity: Activity) => void;
  onDeleteActivity: (activityId: string) => void;
  onSelectActivity: (activity: Activity) => void;
  onOpenNewActivity: () => void;
  onToggleTimer: (activity: Activity) => void;
  activeTimerActivityId: string | null;
}

export const TableView: React.FC<TableViewProps> = ({
  activities,
  members,
  currentMember,
  currentWorkspace = 'equipos',
  phases: propPhases,
  disciplines: propDisciplines,
  onUpdateActivity,
  onDeleteActivity,
  onSelectActivity,
  onOpenNewActivity,
  onToggleTimer,
  activeTimerActivityId,
}) => {
  const canEdit = canUserEdit(currentMember);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterResponsible, setFilterResponsible] = useState<string>("all");
  const [filterPhase, setFilterPhase] = useState<string>("all");
  const [sortField, setSortField] = useState<keyof Activity>("dueDate");
  const [sortAsc, setSortAsc] = useState(true);

  const availableDisciplines = useMemo(() => {
    if (propDisciplines && propDisciplines.length > 0) return propDisciplines;
    return WORKSPACES[currentWorkspace]?.disciplines || WORKSPACES.equipos.disciplines;
  }, [propDisciplines, currentWorkspace]);

  // Quick inline row addition state
  const [newRowDesc, setNewRowDesc] = useState("");
  const [newRowRespId, setNewRowRespId] = useState(currentMember.id);
  const [newRowDate, setNewRowDate] = useState(new Date().toISOString().split("T")[0]);
  const [newRowPhase, setNewRowPhase] = useState("");
  const [newRowStatus, setNewRowStatus] = useState<ActivityStatus>(
    (availableDisciplines[0]?.id as ActivityStatus) || "electrico"
  );

  useEffect(() => {
    if (availableDisciplines.length > 0 && !availableDisciplines.some((d) => d.id === newRowStatus)) {
      setNewRowStatus(availableDisciplines[0].id as ActivityStatus);
    }
  }, [availableDisciplines, newRowStatus]);

  const todayStr = new Date().toISOString().split("T")[0];

  const [collapsedDisciplines, setCollapsedDisciplines] = useState<Record<string, boolean>>({});

  const toggleDisciplineCollapse = (disciplineId: string) => {
    setCollapsedDisciplines((prev) => ({
      ...prev,
      [disciplineId]: !prev[disciplineId],
    }));
  };

  const hasActiveFilters = useMemo(() => {
    return (
      searchTerm.trim() !== "" ||
      filterStatus !== "all" ||
      filterResponsible !== "all" ||
      filterPhase !== "all"
    );
  }, [searchTerm, filterStatus, filterResponsible, filterPhase]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
    setFilterResponsible("all");
    setFilterPhase("all");
  };

  const DISCIPLINE_META: Record<string, { label: string; icon: string; badgeClass: string; bgHeader: string; borderClass: string; accentColor: string }> = useMemo(() => {
    const map: Record<string, { label: string; icon: string; badgeClass: string; bgHeader: string; borderClass: string; accentColor: string }> = {
      // Equipos
      electrico: {
        label: "Eléctrico",
        icon: "⚡",
        badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
        bgHeader: "bg-amber-50/80 border-amber-200 text-amber-900",
        borderClass: "border-l-amber-500",
        accentColor: "text-amber-600",
      },
      mecanico: {
        label: "Mecánico",
        icon: "⚙️",
        badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
        bgHeader: "bg-blue-50/80 border-blue-200 text-blue-900",
        borderClass: "border-l-blue-500",
        accentColor: "text-blue-600",
      },
      instrumentacion: {
        label: "Instrumentación",
        icon: "📡",
        badgeClass: "bg-purple-100 text-purple-800 border-purple-300",
        bgHeader: "bg-purple-50/80 border-purple-200 text-purple-900",
        borderClass: "border-l-purple-500",
        accentColor: "text-purple-600",
      },
      civil: {
        label: "Civil",
        icon: "📐",
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
        bgHeader: "bg-emerald-50/80 border-emerald-200 text-emerald-900",
        borderClass: "border-l-emerald-500",
        accentColor: "text-emerald-600",
      },
      // Construcción
      obra_civil: {
        label: "Obra Civil",
        icon: "🏗️",
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
        bgHeader: "bg-emerald-50/80 border-emerald-200 text-emerald-900",
        borderClass: "border-l-emerald-600",
        accentColor: "text-emerald-700",
      },
      arquitectura: {
        label: "Arquitectura",
        icon: "📐",
        badgeClass: "bg-violet-100 text-violet-800 border-violet-300",
        bgHeader: "bg-violet-50/80 border-violet-200 text-violet-900",
        borderClass: "border-l-violet-600",
        accentColor: "text-violet-700",
      },
      montaje_mecanico: {
        label: "Montaje Mecánico",
        icon: "⚙️",
        badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
        bgHeader: "bg-blue-50/80 border-blue-200 text-blue-900",
        borderClass: "border-l-blue-600",
        accentColor: "text-blue-700",
      },
      instalacion_electrica: {
        label: "Instalación Eléctrica",
        icon: "⚡",
        badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
        bgHeader: "bg-amber-50/80 border-amber-200 text-amber-900",
        borderClass: "border-l-amber-600",
        accentColor: "text-amber-700",
      },
      hidraulica_piping: {
        label: "Piping & Hidráulica",
        icon: "💧",
        badgeClass: "bg-cyan-100 text-cyan-800 border-cyan-300",
        bgHeader: "bg-cyan-50/80 border-cyan-200 text-cyan-900",
        borderClass: "border-l-cyan-600",
        accentColor: "text-cyan-700",
      },
      hidraulica: {
        label: "Piping & Hidráulica",
        icon: "💧",
        badgeClass: "bg-cyan-100 text-cyan-800 border-cyan-300",
        bgHeader: "bg-cyan-50/80 border-cyan-200 text-cyan-900",
        borderClass: "border-l-cyan-600",
        accentColor: "text-cyan-700",
      },
      seguridad_calidad: {
        label: "HSE & Calidad",
        icon: "🛡️",
        badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
        bgHeader: "bg-rose-50/80 border-rose-200 text-rose-900",
        borderClass: "border-l-rose-600",
        accentColor: "text-rose-700",
      },
      seguridad: {
        label: "HSE & Calidad",
        icon: "🛡️",
        badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
        bgHeader: "bg-rose-50/80 border-rose-200 text-rose-900",
        borderClass: "border-l-rose-600",
        accentColor: "text-rose-700",
      },
    };

    // Incorporate availableDisciplines dynamically
    availableDisciplines.forEach((d) => {
      if (!map[d.id]) {
        map[d.id] = {
          label: d.label,
          icon: d.icon,
          badgeClass: `${d.bgClass || 'bg-slate-100'} ${d.textClass || 'text-slate-800'} ${d.borderClass || 'border-slate-300'}`,
          bgHeader: `${d.bgClass || 'bg-slate-50'} border-slate-200 text-slate-900`,
          borderClass: `border-l-${d.color || 'blue'}-500`,
          accentColor: `text-${d.color || 'blue'}-600`,
        };
      }
    });

    return map;
  }, [availableDisciplines]);

  const phases = useMemo(() => {
    const wsPhases = propPhases || WORKSPACES[currentWorkspace]?.phases || ["Ingenieria", "Compras", "Fabricacion", "Flete"];
    const set = new Set<string>(wsPhases);
    activities.forEach((a) => {
      if (a.phase) set.add(a.phase);
    });
    return Array.from(set);
  }, [propPhases, currentWorkspace, activities]);

  const sortedAndFilteredActivities = useMemo(() => {
    return activities
      .filter((act) => {
        if (searchTerm.trim()) {
          const q = (searchTerm || "").toLowerCase().trim();
          const matchId = (act.id || "").toLowerCase().includes(q);
          const matchDesc = (act.description || "").toLowerCase().includes(q);
          const matchResp = (act.responsibleName || "").toLowerCase().includes(q);
          const matchPhase = (act.phase || "").toLowerCase().includes(q);
          const matchDetails = (act.details || "").toLowerCase().includes(q);
          const matchChecklist = act.subtasks?.some((st) => 
            (st.title || "").toLowerCase().includes(q) ||
            (st.dueDate || "").toLowerCase().includes(q)
          ) || false;
          const matchTechChecklist = 
            (act.technicalChecklist?.procedimientoDetalle || "").toLowerCase().includes(q) ||
            (act.technicalChecklist?.montajeRealizadoPor || "").toLowerCase().includes(q) ||
            (act.technicalChecklist?.restriccionesCuales || "").toLowerCase().includes(q);

          if (!matchId && !matchDesc && !matchResp && !matchPhase && !matchDetails && !matchChecklist && !matchTechChecklist) return false;
        }

        if (filterStatus !== "all" && act.status !== filterStatus) return false;
        if (filterResponsible !== "all" && act.responsibleId !== filterResponsible) return false;
        if (filterPhase !== "all" && act.phase !== filterPhase) return false;

        return true;
      })
      .sort((a, b) => {
        const valA = a[sortField] ?? "";
        const valB = b[sortField] ?? "";
        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
  }, [activities, searchTerm, filterStatus, filterResponsible, filterPhase, sortField, sortAsc]);

  const groupedByDiscipline = useMemo(() => {
    const standardOrder = propDisciplines?.map((d) => d.id) ||
      WORKSPACES[currentWorkspace]?.disciplines.map((d) => d.id) ||
      ["electrico", "mecanico", "instrumentacion", "civil"];
    const orderSet = new Set<string>();

    if (filterStatus !== "all") {
      orderSet.add(filterStatus);
    } else {
      standardOrder.forEach((d) => orderSet.add(d));
      sortedAndFilteredActivities.forEach((act) => {
        if (act.status) orderSet.add(act.status);
      });
    }

    return Array.from(orderSet).map((discId) => {
      const items = sortedAndFilteredActivities.filter((a) => (a.status || "electrico") === discId);
      const meta = DISCIPLINE_META[discId] || {
        label: discId.charAt(0).toUpperCase() + discId.slice(1),
        icon: "📌",
        badgeClass: "bg-slate-100 text-slate-800 border-slate-300",
        bgHeader: "bg-slate-50 border-slate-200 text-slate-900",
        borderClass: "border-l-slate-400",
        accentColor: "text-slate-600",
      };

      return {
        disciplineId: discId,
        label: meta.label,
        icon: meta.icon,
        badgeClass: meta.badgeClass,
        bgHeader: meta.bgHeader,
        borderClass: meta.borderClass,
        accentColor: meta.accentColor,
        activities: items,
      };
    }).filter((group) => {
      // If filtering by search/resp/phase, hide empty groups to avoid clutter
      if (hasActiveFilters && group.activities.length === 0 && filterStatus === "all") {
        return false;
      }
      return true;
    });
  }, [sortedAndFilteredActivities, filterStatus, hasActiveFilters, propDisciplines, currentWorkspace, DISCIPLINE_META]);

  const handleExpandAll = () => {
    setCollapsedDisciplines({});
  };

  const handleCollapseAll = () => {
    const allCollapsed: Record<string, boolean> = {};
    groupedByDiscipline.forEach((g) => {
      allCollapsed[g.disciplineId] = true;
    });
    setCollapsedDisciplines(allCollapsed);
  };

  const handleSort = (field: keyof Activity) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleStatusChange = (activity: Activity, newStatus: ActivityStatus) => {
    if (newStatus === "completed") {
      try {
        confetti({ particleCount: 40, spread: 50 });
      } catch (e) {}
    }
    onUpdateActivity({
      ...activity,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleResponsibleChange = (activity: Activity, memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    if (!member) return;
    onUpdateActivity({
      ...activity,
      responsibleId: member.id,
      responsibleName: member.name,
      updatedAt: new Date().toISOString(),
    });
  };

  const handlePriorityChange = (activity: Activity, newPriority: ActivityPriority) => {
    onUpdateActivity({
      ...activity,
      priority: newPriority,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleDateChange = (activity: Activity, newDate: string) => {
    onUpdateActivity({
      ...activity,
      dueDate: newDate,
      updatedAt: new Date().toISOString(),
    });
  };

  // Inline Quick Add row
  const handleQuickAddRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !newRowDesc.trim()) return;

    const member = members.find((m) => m.id === newRowRespId) || members[0] || currentMember;
    
    // Auto-generate next unique ID with workspace prefix
    const prefix = WORKSPACES[currentWorkspace]?.codePrefix || "ACT";
    const nextId = generateNextActivityId(activities, prefix);

    const defaultPhase = phases[0] || "Ingenieria";
    const defaultStatus = (availableDisciplines[0]?.id as ActivityStatus) || "electrico";

    const newActivity: Activity = {
      id: nextId,
      projectId: "PROJ-OBRA-01",
      workspace: currentWorkspace as WorkspaceType,
      description: newRowDesc.trim(),
      dueDate: newRowDate || new Date(Date.now() + 86400000 * 5).toISOString().split("T")[0],
      startDate: todayStr,
      responsibleId: member?.id || currentMember?.id || "MEM-01",
      responsibleName: member?.name || currentMember?.name || "Responsable",
      status: newRowStatus || defaultStatus,
      priority: "medium",
      phase: newRowPhase || defaultPhase,
      subtasks: [],
      meetingNotes: "Añadida rápidamente desde tabla de reunión.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onUpdateActivity(newActivity);
    setNewRowDesc("");
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ["ID", "Descripción", "Responsable", "Fase", "Disciplina", "Prioridad", "Fecha Límite"];
    const rows = activities.map((a) => [
      a.id,
      `"${a.description.replace(/"/g, '""')}"`,
      `"${a.responsibleName}"`,
      `"${a.phase || ''}"`,
      a.status,
      a.priority,
      a.dueDate,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `plan_obra_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    const s = (status || "").toLowerCase();
    const matched = availableDisciplines.find((d) => d.id === status || d.id.toLowerCase() === s);
    if (matched) {
      return (
        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${matched.bgClass || 'bg-slate-100'} ${matched.textClass || 'text-slate-800'} border ${matched.borderClass || 'border-slate-200'}`}>
          {matched.icon} {matched.label}
        </span>
      );
    }
    const meta = DISCIPLINE_META[status] || DISCIPLINE_META[s];
    if (meta) {
      return (
        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${meta.badgeClass}`}>
          {meta.icon} {meta.label}
        </span>
      );
    }
    return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">{status}</span>;
  };

  return (
    <div className="flex flex-col space-y-3">
      {/* Top Filter & Action Bar */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por ID, descripción, responsable, checklist..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            aria-label="Filtrar por disciplina"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer text-xs font-medium"
          >
            <option value="all">▲ Todas las Disciplinas</option>
            {availableDisciplines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.icon} {d.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por responsable"
            value={filterResponsible}
            onChange={(e) => setFilterResponsible(e.target.value)}
            className="bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer text-xs"
          >
            <option value="all">👤 Todos los Responsables</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por fase"
            value={filterPhase}
            onChange={(e) => setFilterPhase(e.target.value)}
            className="bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer text-xs"
          >
            <option value="all">🏗️ Todas las Fases</option>
            {phases.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          {/* Expand / Collapse All Disciplines */}
          <div className="flex items-center border border-slate-200 rounded-md bg-white overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={handleExpandAll}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors border-r border-slate-200 cursor-pointer"
              title="Expandir todas las disciplinas"
            >
              <ChevronsDown className="w-3.5 h-3.5 text-blue-600" />
              <span>Expandir</span>
            </button>
            <button
              type="button"
              onClick={handleCollapseAll}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              title="Colapsar todas las disciplinas"
            >
              <ChevronsUp className="w-3.5 h-3.5 text-slate-600" />
              <span>Colapsar</span>
            </button>
          </div>

          {/* Limpiar Filtros Button */}
          <button
            type="button"
            onClick={handleClearFilters}
            disabled={!hasActiveFilters}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium transition-colors border cursor-pointer text-xs ${
              hasActiveFilters
                ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 font-semibold"
                : "bg-white border-slate-200 text-slate-400 opacity-60 cursor-not-allowed"
            }`}
            title="Limpiar filtros y búsqueda"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${hasActiveFilters ? "text-slate-600" : "text-slate-400"}`} />
            <span>Limpiar filtros</span>
          </button>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md font-medium transition-colors cursor-pointer text-xs shadow-2xs"
            title="Exportar listado a Excel / CSV"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Main Table View with minimalist vertical scroll & hierarchical grouping by Disciplina */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
        <div className="max-h-[calc(100vh-290px)] min-h-[380px] overflow-y-auto overflow-x-auto custom-scrollbar no-scrollbar-x">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-20 bg-slate-50 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]">
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <th 
                  onClick={() => handleSort("description")}
                  className="py-2.5 px-4 cursor-pointer hover:text-slate-900 min-w-[280px] bg-slate-50"
                >
                  <div className="flex items-center gap-1">
                    <span>Descripción de la Actividad</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3 min-w-[170px] bg-slate-50">Responsable</th>
                <th className="py-2.5 px-3 min-w-[130px] bg-slate-50">Fase</th>
                <th className="py-2.5 px-3 min-w-[130px] bg-slate-50">Disciplina</th>
                <th className="py-2.5 px-3 min-w-[110px] bg-slate-50">Prioridad</th>
                <th 
                  onClick={() => handleSort("dueDate")}
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-900 min-w-[130px] bg-slate-50"
                >
                  <div className="flex items-center gap-1">
                    <span>Fecha Límite</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3 text-center w-24 bg-slate-50">Eliminar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groupedByDiscipline.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <p>No se encontraron actividades con los filtros actuales.</p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={handleClearFilters}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium underline cursor-pointer"
                        >
                          Restablecer todos los filtros
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                groupedByDiscipline.map((group) => {
                  const isCollapsed = !!collapsedDisciplines[group.disciplineId];

                  return (
                    <React.Fragment key={group.disciplineId}>
                      {/* Hierarchical Group Header: Level 1 - Disciplina */}
                      <tr className={`border-y border-slate-200 ${group.bgHeader} select-none`}>
                        <td colSpan={7} className="py-2 px-4">
                          <div className="flex items-center justify-between">
                            <div 
                              onClick={() => toggleDisciplineCollapse(group.disciplineId)}
                              className="flex items-center gap-2 cursor-pointer hover:opacity-85 transition-opacity"
                            >
                              <button
                                type="button"
                                aria-label={isCollapsed ? `Expandir ${group.label}` : `Colapsar ${group.label}`}
                                className="p-0.5 rounded hover:bg-black/5 text-slate-600 transition-colors"
                              >
                                {isCollapsed ? (
                                  <ChevronRight className="w-4 h-4 text-slate-600" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-slate-600" />
                                )}
                              </button>
                              <span className="text-base">{group.icon}</span>
                              <span className="text-xs font-bold text-slate-900 tracking-tight">
                                {group.label}
                              </span>
                              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-white/90 border border-slate-200 text-slate-700 shadow-2xs">
                                {group.activities.length} {group.activities.length === 1 ? "actividad" : "actividades"}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Activities under this Discipline */}
                      {!isCollapsed && group.activities.length === 0 && (
                        <tr className="bg-slate-50/50 text-slate-400 text-xs italic">
                          <td colSpan={7} className="py-3 px-8 text-center">
                            No hay actividades registradas en la disciplina {group.label}.
                          </td>
                        </tr>
                      )}

                      {!isCollapsed && group.activities.map((act) => {
                        const isOverdue = act.dueDate && act.dueDate < todayStr && act.status !== "completed";
                        const isTimerActive = activeTimerActivityId === act.id;
                        const assignedMember = members.find((m) => m.id === act.responsibleId) || {
                          name: act.responsibleName || "Sin Asignar",
                          avatarColor: "bg-slate-600",
                          initials: "??",
                        };

                        return (
                          <tr 
                            key={act.id} 
                            className={`hover:bg-blue-50/20 transition-colors border-l-4 ${group.borderClass} ${
                              isTimerActive ? "bg-blue-50/40" : "bg-white"
                            }`}
                          >
                            {/* Description with Tree Hierarchy Indent & Subtasks badge */}
                            <td className="py-2.5 px-4 pl-7">
                              <div 
                                onClick={() => onSelectActivity(act)}
                                className="cursor-pointer group flex items-start gap-2"
                              >
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0 group-hover:bg-blue-500 transition-colors" />
                                <div>
                                  <p className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors text-xs leading-snug">
                                    {act.description}
                                  </p>
                                  {act.meetingNotes && (
                                    <p className="text-[11px] text-slate-500 italic line-clamp-1 mt-0.5">
                                      📝 {act.meetingNotes}
                                    </p>
                                  )}
                                  {act.subtasks && act.subtasks.length > 0 && (
                                    <div className="flex items-center gap-1.5 mt-1">
                                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 bg-slate-100/90 px-1.5 py-0.5 rounded border border-slate-200">
                                        <CheckSquare className="w-2.5 h-2.5 text-blue-600" />
                                        <span>{act.subtasks.filter((s) => s.completed).length}/{act.subtasks.length} checklist</span>
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Responsible Selector */}
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-1.5">
                                <div className={`w-4 h-4 rounded-full ${assignedMember.avatarColor} text-white text-[8px] font-bold flex items-center justify-center shrink-0`}>
                                  {assignedMember.initials}
                                </div>
                                <select
                                  aria-label={`Asignar responsable para ${act.id}`}
                                  value={act.responsibleId}
                                  disabled={!canEdit}
                                  onChange={(e) => handleResponsibleChange(act, e.target.value)}
                                  className={`bg-transparent text-slate-700 rounded px-1.5 py-1 text-xs focus:outline-none border ${
                                    canEdit 
                                      ? "hover:bg-slate-100 cursor-pointer border-transparent hover:border-slate-200" 
                                      : "cursor-not-allowed opacity-75 border-transparent"
                                  }`}
                                  title={canEdit ? "Cambiar responsable" : "Solo lectura (Se requiere usuario Alejandro Tejeda)"}
                                >
                                  {members.map((m) => (
                                    <option key={m.id} value={m.id} className="text-slate-800">
                                      {m.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </td>

                            {/* Phase */}
                            <td className="py-2 px-3">
                              <span className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded truncate block max-w-[140px]">
                                {act.phase || "General"}
                              </span>
                            </td>

                            {/* Status / Disciplina Dropdown */}
                            <td className="py-2 px-3">
                              <select
                                aria-label={`Cambiar disciplina de ${act.id}`}
                                value={act.status}
                                disabled={!canEdit}
                                onChange={(e) => handleStatusChange(act, e.target.value as ActivityStatus)}
                                className={`text-slate-700 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 font-medium ${
                                  canEdit ? "bg-white cursor-pointer" : "bg-slate-100 cursor-not-allowed text-slate-500 opacity-75"
                                }`}
                                title={canEdit ? "Cambiar disciplina" : "Solo lectura (Se requiere usuario Alejandro Tejeda)"}
                              >
                                {availableDisciplines.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.icon} {d.label}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Priority */}
                            <td className="py-2 px-3">
                              <select
                                aria-label={`Cambiar prioridad de ${act.id}`}
                                value={act.priority}
                                disabled={!canEdit}
                                onChange={(e) => handlePriorityChange(act, e.target.value as ActivityPriority)}
                                className={`text-slate-700 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 font-medium ${
                                  canEdit ? "bg-white cursor-pointer" : "bg-slate-100 cursor-not-allowed text-slate-500 opacity-75"
                                }`}
                                title={canEdit ? "Cambiar prioridad" : "Solo lectura (Se requiere usuario Alejandro Tejeda)"}
                              >
                                <option value="urgent">Urgente</option>
                                <option value="high">Alta</option>
                                <option value="medium">Media</option>
                                <option value="low">Baja</option>
                              </select>
                            </td>

                            {/* Due Date Picker */}
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-1.5">
                                <input
                                  aria-label={`Fecha límite para ${act.id}`}
                                  type="date"
                                  value={act.dueDate || ""}
                                  disabled={!canEdit}
                                  onChange={(e) => handleDateChange(act, e.target.value)}
                                  className={`border rounded px-1.5 py-0.5 text-xs focus:outline-none ${
                                    !canEdit
                                      ? "bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200 opacity-75"
                                      : isOverdue
                                      ? "border-rose-400 text-rose-700 font-bold bg-rose-50 cursor-pointer"
                                      : "border-slate-200 text-slate-700 bg-white cursor-pointer"
                                  }`}
                                  title={canEdit ? "Cambiar fecha límite" : "Solo lectura (Se requiere usuario Alejandro Tejeda)"}
                                />
                              </div>
                            </td>

                            {/* Delete Column / Consultation Action */}
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                disabled={!canEdit}
                                onClick={() => canEdit && onDeleteActivity(act.id)}
                                className={`px-2 py-1 rounded border transition-colors inline-flex items-center gap-1 text-[11px] font-medium shadow-2xs ${
                                  canEdit
                                    ? "text-slate-500 hover:text-rose-600 hover:bg-rose-50 border-slate-200 hover:border-rose-200 cursor-pointer"
                                    : "text-slate-300 border-slate-200 cursor-not-allowed opacity-40"
                                }`}
                                title={canEdit ? `Eliminar actividad ${act.id}` : "Solo lectura (Se requiere usuario Alejandro Tejeda)"}
                              >
                                <Trash2 className={`w-3.5 h-3.5 ${canEdit ? "text-rose-500" : "text-slate-400"}`} />
                                <span>Eliminar</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Quick Inline Add Row Form */}
        <form onSubmit={handleQuickAddRow} className="bg-slate-50 p-2.5 border-t border-slate-200 flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1">
            <span className="text-slate-600 font-mono font-bold text-xs bg-slate-200/80 px-2 py-0.5 rounded border border-slate-300">
              + {generateNextActivityId(activities, WORKSPACES[currentWorkspace]?.codePrefix || "ACT")}
            </span>
          </div>

          <input
            type="text"
            disabled={!canEdit}
            placeholder={canEdit ? "Añadir nueva actividad de obra rápidamente..." : "Modo solo lectura (Acceso exclusivo de edición para Alejandro Tejeda)"}
            value={newRowDesc}
            onChange={(e) => setNewRowDesc(e.target.value)}
            className={`flex-1 min-w-[220px] border rounded-md px-3 py-1.5 text-xs focus:outline-none ${
              canEdit 
                ? "bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-blue-500" 
                : "bg-slate-100 border-slate-200 text-slate-400 placeholder-slate-400 cursor-not-allowed"
            }`}
          />

          <select
            aria-label="Seleccionar responsable para nueva actividad"
            value={newRowRespId}
            disabled={!canEdit}
            onChange={(e) => setNewRowRespId(e.target.value)}
            className={`border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none ${
              canEdit ? "bg-white focus:border-blue-500 cursor-pointer" : "bg-slate-100 cursor-not-allowed text-slate-400"
            }`}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Seleccionar fase para nueva actividad"
            value={newRowPhase}
            disabled={!canEdit}
            onChange={(e) => setNewRowPhase(e.target.value)}
            className={`border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none ${
              canEdit ? "bg-white focus:border-blue-500 cursor-pointer" : "bg-slate-100 cursor-not-allowed text-slate-400"
            }`}
          >
            {phases.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            aria-label="Seleccionar disciplina para nueva actividad"
            value={newRowStatus}
            disabled={!canEdit}
            onChange={(e) => setNewRowStatus(e.target.value as ActivityStatus)}
            className={`border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none ${
              canEdit ? "bg-white focus:border-blue-500 cursor-pointer" : "bg-slate-100 cursor-not-allowed text-slate-400"
            }`}
          >
            {availableDisciplines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.icon} {d.label}
              </option>
            ))}
          </select>

          <input
            aria-label="Fecha límite para nueva actividad"
            type="date"
            value={newRowDate}
            disabled={!canEdit}
            onChange={(e) => setNewRowDate(e.target.value)}
            className={`border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none ${
              canEdit ? "bg-white focus:border-blue-500 cursor-pointer" : "bg-slate-100 cursor-not-allowed text-slate-400"
            }`}
          />

          <button
            type="submit"
            disabled={!canEdit}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-semibold rounded-md text-xs transition-colors shadow-2xs ${
              canEdit
                ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                : "bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed opacity-60"
            }`}
            title={canEdit ? "Agregar Fila" : "Solo lectura (Se requiere usuario Alejandro Tejeda)"}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar Fila</span>
          </button>
        </form>
      </div>
    </div>
  );
};
