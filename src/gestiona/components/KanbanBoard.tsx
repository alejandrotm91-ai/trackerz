import React, { useState, useMemo } from "react";
import { 
  Activity, 
  ActivityStatus, 
  ActivityPriority, 
  Member,
  Project,
  DEFAULT_PHASES,
  WorkspaceType,
  DisciplineDefinition,
  WORKSPACES
} from "../types";
import { 
  Search, 
  Clock, 
  Calendar, 
  CheckSquare, 
  AlertTriangle, 
  Play, 
  Pause, 
  Plus, 
  Flame, 
  Layers, 
  Wrench, 
  ShoppingBag, 
  Cpu, 
  RotateCcw
} from "lucide-react";
import confetti from "canvas-confetti";
import { canUserEdit } from "../lib/activityUtils";

interface KanbanBoardProps {
  activities: Activity[];
  members: Member[];
  currentMember: Member;
  project?: Project;
  phases?: string[];
  disciplines?: DisciplineDefinition[];
  currentWorkspace?: WorkspaceType;
  onUpdateActivity: (activity: Activity) => void;
  onReorderActivities?: (activities: Activity[]) => void;
  onSelectActivity: (activity: Activity) => void;
  onOpenNewActivityWithPhase?: (phase: string) => void;
  onOpenNewActivityWithStatus?: (status: ActivityStatus) => void;
  onToggleTimer: (activity: Activity) => void;
  activeTimerActivityId: string | null;
}

interface PhaseColumnConfig {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  color: string;
  badgeBg: string;
  borderTop: string;
  accentBg: string;
}

const getPhaseConfig = (phaseName: string): PhaseColumnConfig => {
  const norm = (phaseName || "").toLowerCase().trim();
  if (norm.includes("enterrad") || norm.includes("preliminar") || norm.includes("trazo") || norm.includes("despalme")) {
    return {
      id: phaseName,
      title: phaseName,
      subtitle: "Zanjas & Mov. Tierras",
      icon: "🚜",
      color: "text-amber-800",
      badgeBg: "bg-amber-100 text-amber-800 border-amber-200",
      borderTop: "border-t-amber-500",
      accentBg: "bg-amber-50/50"
    };
  }
  if (norm.includes("hormigon") || norm.includes("cimentaci") || norm.includes("estructur") || norm.includes("concreto")) {
    return {
      id: phaseName,
      title: phaseName,
      subtitle: "Acero & Concreto",
      icon: "🏛️",
      color: "text-emerald-800",
      badgeBg: "bg-emerald-100 text-emerald-800 border-emerald-200",
      borderTop: "border-t-emerald-600",
      accentBg: "bg-emerald-50/50"
    };
  }
  if (norm.includes("arquitect") || norm.includes("arqui")) {
    return {
      id: phaseName,
      title: phaseName,
      subtitle: "Planos, Fachadas & Acabados",
      icon: "📐",
      color: "text-violet-800",
      badgeBg: "bg-violet-100 text-violet-800 border-violet-200",
      borderTop: "border-t-violet-600",
      accentBg: "bg-violet-50/50"
    };
  }
  if (norm.includes("tuberia") || norm.includes("tubería") || norm.includes("piping")) {
    return {
      id: phaseName,
      title: phaseName,
      subtitle: "Líneas & Colectores",
      icon: "🔩",
      color: "text-blue-800",
      badgeBg: "bg-blue-100 text-blue-800 border-blue-200",
      borderTop: "border-t-blue-600",
      accentBg: "bg-blue-50/50"
    };
  }
  if (norm.includes("curso") || norm.includes("montajes en curso")) {
    return {
      id: phaseName,
      title: phaseName,
      subtitle: "Instalación & Avance",
      icon: "🏗️",
      color: "text-blue-800",
      badgeBg: "bg-blue-100 text-blue-800 border-blue-200",
      borderTop: "border-t-blue-600",
      accentBg: "bg-blue-50/50"
    };
  }
  if (norm.includes("montaje") || norm.includes("equipo") || norm.includes("prueba") || norm.includes("marcha") || norm.includes("comision")) {
    return {
      id: phaseName,
      title: phaseName,
      subtitle: "Equipos & Electromecánica",
      icon: "⚙️",
      color: "text-teal-800",
      badgeBg: "bg-teal-100 text-teal-800 border-teal-200",
      borderTop: "border-t-teal-600",
      accentBg: "bg-teal-50/50"
    };
  }
  if (norm.includes("ingenier") || norm.includes("ing")) {
    return {
      id: phaseName,
      title: phaseName,
      subtitle: "Diseño & Planos",
      icon: "📐",
      color: "text-blue-800",
      badgeBg: "bg-blue-100 text-blue-800 border-blue-200",
      borderTop: "border-t-blue-600",
      accentBg: "bg-blue-50/50"
    };
  }
  if (norm.includes("compra") || norm.includes("adquis")) {
    return {
      id: phaseName,
      title: phaseName,
      subtitle: "Suministros & Materiales",
      icon: "📦",
      color: "text-amber-800",
      badgeBg: "bg-amber-100 text-amber-800 border-amber-200",
      borderTop: "border-t-amber-500",
      accentBg: "bg-amber-50/50"
    };
  }
  if (norm.includes("fabric") || norm.includes("taller")) {
    return {
      id: phaseName,
      title: phaseName,
      subtitle: "Taller & Ensamble",
      icon: "⚙️",
      color: "text-purple-800",
      badgeBg: "bg-purple-100 text-purple-800 border-purple-200",
      borderTop: "border-t-purple-600",
      accentBg: "bg-purple-50/50"
    };
  }
  if (norm.includes("flet") || norm.includes("transport") || norm.includes("envio") || norm.includes("logist")) {
    return {
      id: phaseName,
      title: phaseName,
      subtitle: "Transporte & Envíos",
      icon: "🚛",
      color: "text-cyan-800",
      badgeBg: "bg-cyan-100 text-cyan-800 border-cyan-200",
      borderTop: "border-t-cyan-600",
      accentBg: "bg-cyan-50/50"
    };
  }
  return {
    id: phaseName,
    title: phaseName,
    subtitle: "Fase de Obra",
    icon: "🏗️",
    color: "text-emerald-800",
    badgeBg: "bg-emerald-100 text-emerald-800 border-emerald-200",
    borderTop: "border-t-emerald-600",
    accentBg: "bg-emerald-50/50"
  };
};

const normalizePhaseName = (phase: string | undefined): string => {
  const p = (phase || "").trim();
  if (!p) return "Ingenieria";
  return p;
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  activities,
  members,
  currentMember,
  project,
  phases: propPhases,
  disciplines: propDisciplines,
  currentWorkspace = 'equipos',
  onUpdateActivity,
  onReorderActivities,
  onSelectActivity,
  onOpenNewActivityWithPhase,
  onOpenNewActivityWithStatus,
  onToggleTimer,
  activeTimerActivityId,
}) => {
  const canEdit = canUserEdit(currentMember);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedResponsible, setSelectedResponsible] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [filterOnlyMine, setFilterOnlyMine] = useState(false);
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [filterDueSoon, setFilterDueSoon] = useState(false);
  const [draggedActivityId, setDraggedActivityId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{
    phase: string;
    cardId: string;
    position: "before" | "after";
  } | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const hasActiveFilters = useMemo(() => {
    return (
      searchTerm.trim() !== "" ||
      selectedResponsible !== "all" ||
      selectedStatus !== "all" ||
      selectedPriority !== "all" ||
      filterOnlyMine ||
      filterOverdue ||
      filterDueSoon
    );
  }, [searchTerm, selectedResponsible, selectedStatus, selectedPriority, filterOnlyMine, filterOverdue, filterDueSoon]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedResponsible("all");
    setSelectedStatus("all");
    setSelectedPriority("all");
    setFilterOnlyMine(false);
    setFilterOverdue(false);
    setFilterDueSoon(false);
  };

  // Determine available phases: from propPhases or WORKSPACES config + activity phases
  const phaseList = useMemo(() => {
    const wsPhases = propPhases || WORKSPACES[currentWorkspace]?.phases || DEFAULT_PHASES;
    const fromActivities = activities.map((a) => a.phase).filter(Boolean) as string[];
    const combined = Array.from(new Set([...wsPhases, ...fromActivities]));
    const ordered: string[] = [];
    wsPhases.forEach((p) => {
      if (combined.includes(p) && !ordered.includes(p)) ordered.push(p);
    });
    combined.forEach((c) => {
      if (!ordered.includes(c)) ordered.push(c);
    });
    return ordered;
  }, [propPhases, currentWorkspace, activities]);

  const availableDisciplines = useMemo(() => {
    if (propDisciplines && propDisciplines.length > 0) return propDisciplines;
    return WORKSPACES[currentWorkspace]?.disciplines || WORKSPACES.equipos.disciplines;
  }, [propDisciplines, currentWorkspace]);

  const columns = useMemo(() => {
    return phaseList.map(getPhaseConfig);
  }, [phaseList]);

  const todayStr = new Date().toISOString().split("T")[0];
  const nextWeekStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  }, []);

  // Filter activities
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      // Search
      if (searchTerm.trim()) {
        const query = (searchTerm || "").toLowerCase().trim();
        const matchesId = (act.id || "").toLowerCase().includes(query);
        const matchesDesc = (act.description || "").toLowerCase().includes(query);
        const matchesResp = (act.responsibleName || "").toLowerCase().includes(query);
        const matchesPhase = (act.phase || "").toLowerCase().includes(query);
        const matchesStatus = (act.status || "").toLowerCase().includes(query);
        const matchesDetails = (act.details || "").toLowerCase().includes(query);

        // Checklist de Verificación (subtareas / puntos de verificación)
        const matchesChecklist = act.subtasks?.some((st) => 
          (st.title || "").toLowerCase().includes(query) ||
          (st.dueDate || "").toLowerCase().includes(query)
        ) || false;

        // Especificaciones técnicas / procedimiento / restricciones
        const matchesTechChecklist = 
          (act.technicalChecklist?.procedimientoDetalle || "").toLowerCase().includes(query) ||
          (act.technicalChecklist?.montajeRealizadoPor || "").toLowerCase().includes(query) ||
          (act.technicalChecklist?.restriccionesCuales || "").toLowerCase().includes(query);

        if (!matchesId && !matchesDesc && !matchesResp && !matchesPhase && !matchesStatus && !matchesDetails && !matchesChecklist && !matchesTechChecklist) {
          return false;
        }
      }

      // Responsible
      if (selectedResponsible !== "all" && act.responsibleId !== selectedResponsible) {
        return false;
      }

      // Filter only mine
      if (filterOnlyMine && act.responsibleId !== currentMember.id) {
        return false;
      }

      // Status / Disciplina Filter
      if (selectedStatus !== "all") {
        const actSt = (act.status || "").toLowerCase();
        if (!actSt.includes((selectedStatus || "").toLowerCase())) {
          return false;
        }
      }

      // Priority
      if (selectedPriority !== "all" && act.priority !== selectedPriority) {
        return false;
      }

      // Overdue
      if (filterOverdue) {
        const isPast = act.dueDate && act.dueDate < todayStr;
        if (!isPast) return false;
      }

      // Prox. Vencer (a 1 semana de vencer: hoy <= fecha <= dentro de 7 días)
      if (filterDueSoon) {
        const isDueSoon = act.dueDate && act.dueDate >= todayStr && act.dueDate <= nextWeekStr;
        if (!isDueSoon) return false;
      }

      return true;
    });
  }, [activities, searchTerm, selectedResponsible, selectedStatus, selectedPriority, filterOnlyMine, filterOverdue, filterDueSoon, currentMember, todayStr, nextWeekStr]);

  // Group by Phase and sort by user order
  const activitiesByPhase = useMemo(() => {
    const grouped: Record<string, Activity[]> = {};
    phaseList.forEach((p) => {
      grouped[p] = [];
    });

    filteredActivities.forEach((act) => {
      const norm = normalizePhaseName(act.phase);
      const targetCol = phaseList.find((p) => normalizePhaseName(p) === norm) || phaseList[0] || "Ingenieria";
      if (!grouped[targetCol]) {
        grouped[targetCol] = [];
      }
      grouped[targetCol].push(act);
    });

    // In each group, sort by defined order
    Object.keys(grouped).forEach((colKey) => {
      grouped[colKey].sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        if (a.order !== undefined) return -1;
        if (b.order !== undefined) return 1;
        return 0;
      });
    });

    return grouped;
  }, [filteredActivities, phaseList]);

  // Execute Move Card (within same container or across containers with specific position)
  const executeMoveCard = (
    sourceId: string,
    targetPhase: string,
    targetCardId: string | null,
    position: "before" | "after" | "end"
  ) => {
    if (!canEdit) return;
    const sourceAct = activities.find((a) => a.id === sourceId);
    if (!sourceAct) return;

    const normTargetPhase = normalizePhaseName(targetPhase);
    const isPhaseChange = normalizePhaseName(sourceAct.phase) !== normTargetPhase;

    // Confetti if moving to final phase
    if (isPhaseChange) {
      if (
        (targetPhase || "").toLowerCase().includes("fabric") ||
        (targetPhase || "").toLowerCase().includes("obra") ||
        targetPhase === phaseList[phaseList.length - 1]
      ) {
        try {
          confetti({
            particleCount: 40,
            spread: 50,
            origin: { y: 0.7 },
          });
        } catch (e) {
          // silent
        }
      }
    }

    // Get current items in target phase excluding the moved card
    const currentTargetPhaseActs = (activitiesByPhase[targetPhase] || []).filter((a) => a.id !== sourceId);

    const updatedSourceAct: Activity = {
      ...sourceAct,
      phase: targetPhase,
      updatedAt: new Date().toISOString(),
    };

    let reorderedTargetList: Activity[] = [];

    if (!targetCardId || position === "end") {
      reorderedTargetList = [...currentTargetPhaseActs, updatedSourceAct];
    } else {
      const targetIdx = currentTargetPhaseActs.findIndex((a) => a.id === targetCardId);
      if (targetIdx === -1) {
        reorderedTargetList = [...currentTargetPhaseActs, updatedSourceAct];
      } else {
        const insertIdx = position === "before" ? targetIdx : targetIdx + 1;
        const copy = [...currentTargetPhaseActs];
        copy.splice(insertIdx, 0, updatedSourceAct);
        reorderedTargetList = copy;
      }
    }

    // Build the new unified activity list for this workspace with explicit order values
    const finalActivities: Activity[] = [];
    phaseList.forEach((phase) => {
      if (normalizePhaseName(phase) === normTargetPhase) {
        finalActivities.push(
          ...reorderedTargetList.map((a, idx) => ({
            ...a,
            phase: targetPhase,
            order: idx,
            updatedAt: a.id === sourceId ? new Date().toISOString() : a.updatedAt,
          }))
        );
      } else {
        const otherPhaseActs = (activitiesByPhase[phase] || [])
          .filter((a) => a.id !== sourceId)
          .map((a, idx) => ({ ...a, order: idx }));
        finalActivities.push(...otherPhaseActs);
      }
    });

    // Retain any activities that might have custom phases not currently in phaseList
    const handledIds = new Set(finalActivities.map((a) => a.id));
    activities.forEach((act) => {
      if (!handledIds.has(act.id) && act.id !== sourceId) {
        finalActivities.push(act);
      }
    });

    if (onReorderActivities) {
      onReorderActivities(finalActivities);
    } else {
      const updatedSource = finalActivities.find((a) => a.id === sourceId);
      if (updatedSource) {
        onUpdateActivity(updatedSource);
      }
    }
  };

  // Quick move activity to phase
  const handleMovePhase = (activity: Activity, newPhase: string) => {
    if (!canEdit || activity.phase === newPhase) return;
    executeMoveCard(activity.id, newPhase, null, "end");
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (!canEdit) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setDraggedActivityId(id);
  };

  const handleDragEnd = () => {
    setDraggedActivityId(null);
    setDragOverTarget(null);
    setDragOverColumn(null);
  };

  const handleColumnDragOver = (e: React.DragEvent, phaseName: string) => {
    if (!canEdit || !draggedActivityId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(phaseName);
  };

  const handleColumnDragLeave = (e: React.DragEvent, phaseName: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (
      e.clientX <= rect.left ||
      e.clientX >= rect.right ||
      e.clientY <= rect.top ||
      e.clientY >= rect.bottom
    ) {
      if (dragOverColumn === phaseName) {
        setDragOverColumn(null);
      }
    }
  };

  const handleColumnDrop = (e: React.DragEvent, phaseName: string) => {
    e.preventDefault();
    if (!canEdit) return;
    const sourceId = e.dataTransfer.getData("text/plain") || draggedActivityId;
    if (sourceId) {
      executeMoveCard(sourceId, phaseName, null, "end");
    }
    handleDragEnd();
  };

  const handleCardDragOver = (e: React.DragEvent, cardId: string, phaseName: string) => {
    if (!canEdit || !draggedActivityId || draggedActivityId === cardId) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position: "before" | "after" = e.clientY > midY ? "after" : "before";

    setDragOverTarget({
      phase: phaseName,
      cardId,
      position,
    });
  };

  const handleCardDragLeave = (e: React.DragEvent, cardId: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (
      e.clientX <= rect.left ||
      e.clientX >= rect.right ||
      e.clientY <= rect.top ||
      e.clientY >= rect.bottom
    ) {
      if (dragOverTarget?.cardId === cardId) {
        setDragOverTarget(null);
      }
    }
  };

  const handleCardDrop = (e: React.DragEvent, cardId: string, phaseName: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canEdit) return;

    const sourceId = e.dataTransfer.getData("text/plain") || draggedActivityId;
    if (!sourceId || sourceId === cardId) {
      handleDragEnd();
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position: "before" | "after" = e.clientY > midY ? "after" : "before";

    executeMoveCard(sourceId, phaseName, cardId, position);
    handleDragEnd();
  };

  // Priority badge helper
  const getPriorityBadge = (priority: ActivityPriority) => {
    switch (priority) {
      case "urgent":
        return <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200"><Flame className="w-3 h-3 text-rose-600" /> Urgente</span>;
      case "high":
        return <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">Alta</span>;
      case "medium":
        return <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">Media</span>;
      case "low":
        return <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-50 text-slate-500 border border-slate-200">Baja</span>;
    }
  };

  // Status / Disciplina badge helper
  const getStatusBadge = (status: string | undefined) => {
    const s = (status || "").toLowerCase();
    if (s.includes("arquitect") || s.includes("arqui")) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-50 text-violet-800 border border-violet-200">
          📐 Arquitectura
        </span>
      );
    }
    if (s.includes("obra_civil") || (s.includes("civil") && !s.includes("elec"))) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
          🏗️ Obra Civil
        </span>
      );
    }
    if (s.includes("montaje_mecanico")) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
          ⚙️ Montaje Mecánico
        </span>
      );
    }
    if (s.includes("instalacion_electrica")) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
          ⚡ Instalación Eléctrica
        </span>
      );
    }
    if (s.includes("hidraulica") || s.includes("piping") || s.includes("tuber")) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-800 border border-cyan-200">
          💧 Piping & Hidráulica
        </span>
      );
    }
    if (s.includes("seguridad") || s.includes("hse") || s.includes("calidad")) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
          🛡️ HSE & Calidad
        </span>
      );
    }
    if (s.includes("elec")) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
          ⚡ Eléctrico
        </span>
      );
    }
    if (s.includes("mecan") || s.includes("mec")) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
          ⚙️ Mecánico
        </span>
      );
    }
    if (s.includes("inst")) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200">
          📡 Instrumentación
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
        {status || "General"}
      </span>
    );
  };

  const handleAddNewToPhase = (phaseName: string) => {
    if (!canEdit) return;
    if (onOpenNewActivityWithPhase) {
      onOpenNewActivityWithPhase(phaseName);
    } else if (onOpenNewActivityWithStatus) {
      const defaultStatus = availableDisciplines[0]?.id as ActivityStatus || "electrico";
      onOpenNewActivityWithStatus(defaultStatus);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        {/* Search input */}
        <div className="relative flex-1 min-w-[220px] max-w-md xl:max-w-lg">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            id="kanban-search-input"
            type="text"
            placeholder="Buscar por ID, descripción, responsable, checklist de verificación..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Responsible Filter */}
          <select
            aria-label="Filtrar por responsable"
            value={selectedResponsible}
            onChange={(e) => setSelectedResponsible(e.target.value)}
            className="bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer text-xs"
          >
            <option value="all">👤 Todos los Responsables</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.role.split(" ")[0]})
              </option>
            ))}
          </select>

          {/* Status / Disciplina Filter */}
          <select
            aria-label="Filtrar por disciplina o estado"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer text-xs"
          >
            <option value="all">▲ Todas las Disciplinas</option>
            {availableDisciplines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.icon} {d.label}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            aria-label="Filtrar por prioridad"
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer text-xs"
          >
            <option value="all">⚠️ Prioridad</option>
            <option value="urgent">Urgente</option>
            <option value="high">Alta</option>
            <option value="medium">Media</option>
            <option value="low">Baja</option>
          </select>

          {/* Toggle "Solo mis tareas" */}
          <button
            onClick={() => setFilterOnlyMine(!filterOnlyMine)}
            className={`px-2.5 py-1.5 rounded-md font-medium transition-colors border cursor-pointer text-xs ${
              filterOnlyMine
                ? "bg-blue-50 border-blue-300 text-blue-700 font-semibold"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Solo mis tareas
          </button>

          {/* Toggle "Vencidas" */}
          <button
            onClick={() => {
              const next = !filterOverdue;
              setFilterOverdue(next);
              if (next) setFilterDueSoon(false);
            }}
            className={`px-2.5 py-1.5 rounded-md font-medium transition-colors border cursor-pointer flex items-center gap-1 text-xs ${
              filterOverdue
                ? "bg-rose-50 border-rose-300 text-rose-700 font-semibold"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            Vencidas
          </button>

          {/* Toggle "Prox.Vencer" */}
          <button
            onClick={() => {
              const next = !filterDueSoon;
              setFilterDueSoon(next);
              if (next) setFilterOverdue(false);
            }}
            className={`px-2.5 py-1.5 rounded-md font-medium transition-colors border cursor-pointer flex items-center gap-1 text-xs ${
              filterDueSoon
                ? "bg-amber-50 border-amber-300 text-amber-700 font-semibold"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
            title="Actividades a 1 semana de vencer"
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            Prox.Vencer
          </button>

          {/* Limpiar Filtros Button */}
          <button
            type="button"
            onClick={handleClearFilters}
            disabled={!hasActiveFilters}
            className={`px-2.5 py-1.5 rounded-md font-medium transition-colors border cursor-pointer flex items-center gap-1.5 text-xs ${
              hasActiveFilters
                ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 font-semibold"
                : "bg-white border-slate-200 text-slate-400 opacity-60 cursor-not-allowed"
            }`}
            title="Limpiar todos los filtros y búsqueda"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${hasActiveFilters ? "text-slate-600" : "text-slate-400"}`} />
            <span>Limpiar filtros</span>
          </button>
        </div>
      </div>

      {/* Kanban Board Columns Grid (Phases) */}
      <div 
        className={`grid grid-cols-1 md:grid-cols-2 ${
          columns.length === 3
            ? "lg:grid-cols-3"
            : columns.length === 4
            ? "lg:grid-cols-2 xl:grid-cols-4"
            : columns.length === 5
            ? "lg:grid-cols-3 xl:grid-cols-5"
            : columns.length >= 6
            ? "lg:grid-cols-3 xl:grid-cols-6"
            : "lg:grid-cols-3"
        } gap-3 flex-1 items-start`}
      >
        {columns.map((col, colIdx) => {
          const colActivities = activitiesByPhase[col.id] || [];
          return (
            <div
              key={col.id}
              onDragOver={(e) => handleColumnDragOver(e, col.id)}
              onDragLeave={(e) => handleColumnDragLeave(e, col.id)}
              onDrop={(e) => handleColumnDrop(e, col.id)}
              className={`bg-slate-100/70 border rounded-lg p-3 flex flex-col min-h-[520px] max-h-[calc(100vh-200px)] shadow-2xs border-t-3 transition-colors min-w-[220px] ${
                dragOverColumn === col.id ? "border-blue-400 bg-blue-50/20" : "border-slate-200"
              } ${col.borderTop}`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{col.icon}</span>
                  <div>
                    <h3 className={`font-bold text-xs uppercase tracking-wider ${col.color}`}>
                      {col.title}
                    </h3>
                    {col.subtitle && (
                      <span className="text-[10px] text-slate-400 block -mt-0.5">
                        {col.subtitle}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ml-1 ${col.badgeBg}`}>
                    {colActivities.length}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => canEdit && handleAddNewToPhase(col.id)}
                  className={`p-1 rounded transition-colors border ${
                    canEdit
                      ? "text-slate-500 hover:text-blue-600 hover:bg-white cursor-pointer border-transparent hover:border-slate-200"
                      : "text-slate-300 border-transparent cursor-not-allowed opacity-50"
                  }`}
                  title={canEdit ? `Añadir nueva actividad en la fase ${col.title}` : "Solo lectura (Se requiere usuario Alejandro Tejeda)"}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Column Cards List with minimalist vertical scroll matching Table view */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
                {colActivities.length === 0 ? (
                  <div className="h-32 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 text-xs text-center p-3">
                    <p className="font-semibold text-slate-600">Sin actividades en esta fase</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {canEdit ? "Arrastra una actividad aquí o crea una con (+)" : "Modo solo lectura"}
                    </p>
                  </div>
                ) : (
                  colActivities.map((activity, cardIndex) => {
                    const assignedMember = members.find((m) => m.id === activity.responsibleId) || {
                      name: activity.responsibleName || "Sin Asignar",
                      role: "Responsable",
                      avatarColor: "bg-slate-600",
                      initials: "??",
                    };

                    const isFirst = cardIndex === 0;
                    const isLast = cardIndex === colActivities.length - 1;
                    const isBeingDragged = draggedActivityId === activity.id;
                    const isDropTargetBefore = dragOverTarget?.cardId === activity.id && dragOverTarget.position === "before";
                    const isDropTargetAfter = dragOverTarget?.cardId === activity.id && dragOverTarget.position === "after";

                    return (
                      <React.Fragment key={activity.id}>
                        {/* Insertion indicator before card */}
                        {isDropTargetBefore && (
                          <div className="relative py-1 flex items-center justify-center my-0.5 pointer-events-none">
                            <div className="h-1 w-full bg-blue-500 rounded-full shadow-xs animate-pulse" />
                            <span className="absolute -left-1 w-2.5 h-2.5 rounded-full bg-blue-600 border-2 border-white shadow-xs" />
                            <span className="absolute -right-1 w-2.5 h-2.5 rounded-full bg-blue-600 border-2 border-white shadow-xs" />
                          </div>
                        )}

                        <div
                          id={`kanban-card-${activity.id}`}
                          draggable={canEdit}
                          onDragStart={(e) => handleDragStart(e, activity.id)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleCardDragOver(e, activity.id, col.id)}
                          onDragLeave={(e) => handleCardDragLeave(e, activity.id)}
                          onDrop={(e) => handleCardDrop(e, activity.id, col.id)}
                          onClick={() => onSelectActivity(activity)}
                          className={`group relative bg-white hover:bg-slate-50/90 border transition-all rounded-md p-2 cursor-pointer shadow-2xs hover:shadow-xs space-y-1.5 ${
                            isBeingDragged
                              ? "opacity-35 scale-[0.98] border-dashed border-blue-400 bg-blue-50/40 ring-2 ring-blue-300 ring-offset-1"
                              : "border-slate-200 hover:border-slate-300"
                          } ${canEdit ? "cursor-grab active:cursor-grabbing" : "select-none"}`}
                        >
                          {/* 1. Descripción & Indicador de Prioridad Urgente */}
                          <div className="flex items-start justify-between gap-1.5">
                            <h4 className="text-xs font-semibold text-slate-800 line-clamp-2 leading-snug group-hover:text-blue-700 transition-colors flex-1">
                              {activity.description || "(Sin descripción)"}
                            </h4>
                            {(activity.priority || "").toLowerCase() === "urgent" && (
                              <span
                                className="shrink-0 p-0.5 rounded text-rose-600 bg-rose-50 border border-rose-200/80 shadow-2xs"
                                title="Prioridad: Urgente"
                              >
                                <Flame className="w-3.5 h-3.5 fill-rose-500 text-rose-600" />
                              </span>
                            )}
                          </div>

                          {/* 2. Disciplina & Subtasks */}
                          <div className="flex items-center justify-between gap-1.5 flex-wrap">
                            {getStatusBadge(activity.status)}
                            {activity.subtasks && activity.subtasks.length > 0 && (
                              <span 
                                className="flex items-center gap-1 text-[10px] text-slate-600 font-semibold bg-slate-50 border border-slate-200/80 px-1.5 py-0.5 rounded shadow-2xs"
                                title={`Puntos de verificación: ${activity.subtasks.filter((s) => s.completed).length} completados de ${activity.subtasks.length}`}
                              >
                                <CheckSquare className="w-2.5 h-2.5 text-blue-600" />
                                <span>{activity.subtasks.filter((s) => s.completed).length}/{activity.subtasks.length}</span>
                              </span>
                            )}
                          </div>

                          {/* Matching checklist preview if searched by checklist query */}
                          {searchTerm.trim() && (() => {
                            const q = searchTerm.toLowerCase().trim();
                            const matchedSt = activity.subtasks?.find((s) => 
                              (s.title || "").toLowerCase().includes(q) ||
                              (s.dueDate || "").toLowerCase().includes(q)
                            );
                            if (matchedSt) {
                              return (
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-50/90 border border-blue-200 text-[10px] text-blue-900">
                                  <CheckSquare className="w-3 h-3 text-blue-600 shrink-0" />
                                  <span className="truncate">
                                    <span className="font-semibold text-blue-700">Checklist: </span>
                                    {matchedSt.title}
                                    {matchedSt.dueDate ? ` (${matchedSt.dueDate})` : ""}
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          })()}

                          {/* 3 & 4. Responsable y Fecha */}
                          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-xs">
                            {/* Responsable */}
                            <div 
                              className="flex items-center gap-1.5 min-w-0"
                              title={`${assignedMember.name} - ${assignedMember.role}`}
                            >
                              <div className={`w-4 h-4 rounded-full ${assignedMember.avatarColor} text-white text-[8px] font-bold flex items-center justify-center shrink-0`}>
                                {assignedMember.initials}
                              </div>
                              <span className="text-[11px] text-slate-700 font-medium truncate max-w-[110px] xl:max-w-[150px]">
                                {assignedMember.name}
                              </span>
                            </div>

                            {/* Fecha */}
                            <div
                              className={`flex items-center gap-1 shrink-0 ${
                                activity.dueDate && activity.dueDate < todayStr
                                  ? "text-rose-600 font-bold"
                                  : activity.dueDate && activity.dueDate <= nextWeekStr
                                  ? "text-amber-700 font-semibold"
                                  : "text-slate-500"
                              }`}
                              title={
                                activity.dueDate && activity.dueDate < todayStr
                                  ? "Actividad vencida"
                                  : activity.dueDate && activity.dueDate <= nextWeekStr
                                  ? "Próxima a vencer (< 1 semana)"
                                  : undefined
                              }
                            >
                              <Calendar
                                className={`w-3 h-3 ${
                                  activity.dueDate && activity.dueDate < todayStr
                                    ? "text-rose-500"
                                    : activity.dueDate && activity.dueDate <= nextWeekStr
                                    ? "text-amber-500"
                                    : "text-slate-400"
                                }`}
                              />
                              <span className="text-[11px]">
                                {activity.dueDate || "Sin fecha"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Insertion indicator after card */}
                        {isDropTargetAfter && (
                          <div className="relative py-1 flex items-center justify-center my-0.5 pointer-events-none">
                            <div className="h-1 w-full bg-blue-500 rounded-full shadow-xs animate-pulse" />
                            <span className="absolute -left-1 w-2.5 h-2.5 rounded-full bg-blue-600 border-2 border-white shadow-xs" />
                            <span className="absolute -right-1 w-2.5 h-2.5 rounded-full bg-blue-600 border-2 border-white shadow-xs" />
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })
                )}

                {/* Dropzone at bottom of column when dragging */}
                {canEdit && draggedActivityId && (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverColumn(col.id);
                    }}
                    onDragLeave={() => setDragOverColumn(null)}
                    onDrop={(e) => {
                      e.stopPropagation();
                      handleColumnDrop(e, col.id);
                    }}
                    className={`py-2 px-3 rounded border border-dashed text-center text-[10px] font-medium transition-all ${
                      dragOverColumn === col.id
                        ? "border-blue-500 bg-blue-50 text-blue-700 shadow-2xs"
                        : "border-slate-200 hover:border-slate-300 text-slate-400"
                    }`}
                  >
                    Soltar aquí para colocar al final del contenedor
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
