import React, { useState, useEffect, useMemo } from "react";
import { 
  Activity, 
  Member, 
  Project, 
  ActivityStatus, 
  ActivityPriority,
  Subtask,
  WorkspaceType,
  DisciplineDefinition,
  WORKSPACES
} from "../types";
import { 
  X, 
  Save, 
  Trash2, 
  Plus, 
  Check, 
  Clock, 
  Calendar, 
  User, 
  Bell, 
  FileText, 
  Flame,
  CheckSquare,
  AlertTriangle,
  Pencil,
  ClipboardList,
  Wrench,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  GripVertical
} from "lucide-react";
import confetti from "canvas-confetti";
import { isActivityIdTaken, canUserEdit } from "../lib/activityUtils";

interface ActivityDetailModalProps {
  activity: Activity | null;
  activities?: Activity[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (activity: Activity) => void;
  onDelete: (activityId: string) => void;
  members: Member[];
  allMembers?: Member[];
  project: Project;
  currentWorkspace?: WorkspaceType;
  phases?: string[];
  disciplines?: DisciplineDefinition[];
  currentMember?: Member;
  onSendMemberAlert: (member: Member, activity: Activity) => void;
}

export const ActivityDetailModal: React.FC<ActivityDetailModalProps> = ({
  activity,
  activities = [],
  isOpen,
  onClose,
  onSave,
  onDelete,
  members,
  allMembers,
  project,
  currentWorkspace = 'equipos',
  phases: propPhases,
  disciplines: propDisciplines,
  currentMember,
  onSendMemberAlert,
}) => {
  const [id, setId] = useState(activity?.id || "");
  const [description, setDescription] = useState(activity?.description || "");
  const [details, setDetails] = useState(activity?.details || "");
  const [procChecked, setProcChecked] = useState(false);
  const [procDetalle, setProcDetalle] = useState("");
  const [montajeChecked, setMontajeChecked] = useState(false);
  const [montajeRealizadoPor, setMontajeRealizadoPor] = useState("");
  const [restrChecked, setRestrChecked] = useState(false);
  const [restrCuales, setRestrCuales] = useState("");
  const [isSpecsCollapsed, setIsSpecsCollapsed] = useState(true);
  const [dueDate, setDueDate] = useState(activity?.dueDate || "");
  const [startDate, setStartDate] = useState(activity?.startDate || "");
  const [responsibleId, setResponsibleId] = useState(activity?.responsibleId || "");
  const [status, setStatus] = useState<ActivityStatus>(activity?.status || "electrico");
  const [priority, setPriority] = useState<ActivityPriority>(activity?.priority || "high");
  const [phase, setPhase] = useState(activity?.phase || project.phases[0] || "General");
  const [meetingNotes, setMeetingNotes] = useState(activity?.meetingNotes || "");
  const [subtasks, setSubtasks] = useState<Subtask[]>(activity?.subtasks || []);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskDueDate, setNewSubtaskDueDate] = useState(activity?.dueDate || "");
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [alertSent, setAlertSent] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Sync state whenever activity or modal opens
  useEffect(() => {
    if (activity && isOpen) {
      setId(activity.id || "");
      setDescription(activity.description || "");
      setDetails(activity.details || "");

      if (activity.technicalChecklist) {
        setProcChecked(Boolean(activity.technicalChecklist.procedimientoChecked));
        setProcDetalle(activity.technicalChecklist.procedimientoDetalle || "");
        setMontajeChecked(Boolean(activity.technicalChecklist.montajeChecked));
        setMontajeRealizadoPor(activity.technicalChecklist.montajeRealizadoPor || "");
        setRestrChecked(Boolean(activity.technicalChecklist.restriccionesChecked));
        setRestrCuales(activity.technicalChecklist.restriccionesCuales || "");
      } else if (activity.details && activity.details.trim()) {
        // Parse legacy details text into procedure details or populate smartly
        setProcChecked(true);
        setProcDetalle(activity.details.trim());
        setMontajeChecked(false);
        setMontajeRealizadoPor("");
        setRestrChecked(false);
        setRestrCuales("");
      } else {
        setProcChecked(false);
        setProcDetalle("");
        setMontajeChecked(false);
        setMontajeRealizadoPor("");
        setRestrChecked(false);
        setRestrCuales("");
      }

      setDueDate(activity.dueDate || "");
      setStartDate(activity.startDate || "");
      const initialRespId = 
        activity.responsibleId || 
        (members.length > 0 ? members[0].id : (allMembers && allMembers.length > 0 ? allMembers[0].id : currentMember?.id || "MEM-01"));
      setResponsibleId(initialRespId);
      let initialStatus = activity.status || "electrico";
      const currentWs = activity.workspace || currentWorkspace || 'equipos';
      if (currentWs === 'construccion') {
        const legacyMap: Record<string, ActivityStatus> = {
          civil: "obra_civil",
          mecanico: "montaje_mecanico",
          electrico: "instalacion_electrica",
          hidraulica: "hidraulica_piping",
          seguridad: "seguridad_calidad",
        };
        if (legacyMap[initialStatus]) {
          initialStatus = legacyMap[initialStatus];
        }
      }
      setStatus(initialStatus);
      setPriority(activity.priority || "high");
      setPhase(activity.phase || project.phases[0] || "General");
      setMeetingNotes(activity.meetingNotes || "");
      setSubtasks(activity.subtasks || []);
      setNewSubtaskTitle("");
      setNewSubtaskDueDate(activity.dueDate || "");
      setEditingSubtaskId(null);
      setEditingSubtaskTitle("");
      setDraggedIndex(null);
      setDragOverIndex(null);
      setAlertSent(false);
      setIsConfirmingDelete(false);
      setIsSpecsCollapsed(true);
    }
  }, [activity, isOpen, project.phases, members]);

  const activeWorkspace: WorkspaceType = activity?.workspace || currentWorkspace || 'equipos';

  const availableDisciplines = useMemo(() => {
    if (propDisciplines && propDisciplines.length > 0) return propDisciplines;
    return WORKSPACES[activeWorkspace]?.disciplines || WORKSPACES.equipos.disciplines;
  }, [propDisciplines, activeWorkspace]);

  const availablePhases = useMemo(() => {
    const wsPhases = propPhases || WORKSPACES[activeWorkspace]?.phases || ["Ingenieria", "Compras", "Fabricacion", "Flete"];
    const all = new Set([...wsPhases, ...(project.phases || [])]);
    if (activity?.phase) all.add(activity.phase);
    return Array.from(all);
  }, [propPhases, activeWorkspace, activity?.phase, project.phases]);

  if (!isOpen || !activity) return null;

  const canEdit = canUserEdit(currentMember);
  const isDuplicateId = isActivityIdTaken(id.trim(), activities, activity.id);

  // Toggle subtask completion
  const handleToggleSubtask = (subtaskId: string) => {
    if (!canEdit) return;
    setSubtasks((prev) =>
      prev.map((s) => (s.id === subtaskId ? { ...s, completed: !s.completed } : s))
    );
  };

  // Add custom subtask with title and date
  const handleAddSubtask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canEdit || !newSubtaskTitle.trim()) return;
    const newSt: Subtask = {
      id: `st-${Date.now()}`,
      title: newSubtaskTitle.trim(),
      completed: false,
      dueDate: newSubtaskDueDate ? newSubtaskDueDate : undefined,
    };
    setSubtasks((prev) => [...prev, newSt]);
    setNewSubtaskTitle("");
    setNewSubtaskDueDate(dueDate || "");
  };

  // Update subtask due date
  const handleUpdateSubtaskDueDate = (subtaskId: string, newDate: string) => {
    if (!canEdit) return;
    setSubtasks((prev) =>
      prev.map((s) => (s.id === subtaskId ? { ...s, dueDate: newDate || undefined } : s))
    );
  };

  // Subtask title edit handlers
  const handleStartEditSubtask = (st: Subtask) => {
    if (!canEdit) return;
    setEditingSubtaskId(st.id);
    setEditingSubtaskTitle(st.title);
  };

  const handleSaveEditSubtask = (subtaskId: string) => {
    if (!canEdit) return;
    const trimmed = editingSubtaskTitle.trim();
    if (trimmed) {
      setSubtasks((prev) =>
        prev.map((s) => (s.id === subtaskId ? { ...s, title: trimmed } : s))
      );
    }
    setEditingSubtaskId(null);
    setEditingSubtaskTitle("");
  };

  const handleCancelEditSubtask = () => {
    setEditingSubtaskId(null);
    setEditingSubtaskTitle("");
  };

  const handleRemoveSubtask = (subtaskId: string) => {
    if (!canEdit) return;
    setSubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
    if (editingSubtaskId === subtaskId) {
      setEditingSubtaskId(null);
      setEditingSubtaskTitle("");
    }
  };

  // Move subtask up in checklist
  const handleMoveSubtaskUp = (index: number) => {
    if (!canEdit || index <= 0) return;
    setSubtasks((prev) => {
      if (index <= 0 || index >= prev.length) return prev;
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  // Move subtask down in checklist
  const handleMoveSubtaskDown = (index: number) => {
    if (!canEdit) return;
    setSubtasks((prev) => {
      if (index < 0 || index >= prev.length - 1) return prev;
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  // Drag & drop reordering handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (!canEdit) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", index.toString());
    } catch {
      // ignore
    }
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (!canEdit || draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (!canEdit || draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    setSubtasks((prev) => {
      if (draggedIndex < 0 || draggedIndex >= prev.length || targetIndex < 0 || targetIndex >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(draggedIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Save changes
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDuplicateId) {
      alert("El ID especificado ya pertenece a otra actividad. Por favor use un ID único.");
      return;
    }

    if (!description.trim()) {
      alert("Por favor ingrese la descripción de la tarea.");
      return;
    }

    const assignedMember = 
      members.find((m) => m.id === responsibleId) || 
      allMembers?.find((m) => m.id === responsibleId) || 
      members[0] || 
      currentMember;

    const finalRespId = assignedMember?.id || responsibleId || currentMember?.id || "MEM-01";
    const finalRespName = assignedMember?.name || currentMember?.name || "Responsable";

    if (status === "completed" && activity.status !== "completed") {
      try {
        confetti({ particleCount: 50, spread: 60 });
      } catch (err) {}
    }

    const technicalChecklist = {
      procedimientoChecked: procChecked,
      procedimientoDetalle: procDetalle.trim(),
      montajeChecked: montajeChecked,
      montajeRealizadoPor: montajeRealizadoPor.trim(),
      restriccionesChecked: restrChecked,
      restriccionesCuales: restrCuales.trim(),
    };

    const summaryParts: string[] = [];
    if (procChecked) {
      summaryParts.push(`Procedimiento: ${procDetalle.trim() || 'Verificado'}`);
    }
    if (montajeChecked) {
      summaryParts.push(`Montaje: ${montajeRealizadoPor.trim() ? `Realizado por ${montajeRealizadoPor.trim()}` : 'Verificado'}`);
    }
    if (restrChecked) {
      summaryParts.push(`Restricciones: ${restrCuales.trim() || 'Identificadas'}`);
    }

    const generatedDetails = summaryParts.length > 0 ? summaryParts.join(' | ') : (procDetalle.trim() || details.trim());

    const updated: Activity = {
      ...activity,
      id: id.trim() || activity.id,
      description: description.trim(),
      details: generatedDetails,
      technicalChecklist,
      dueDate: dueDate || new Date(Date.now() + 86400000 * 5).toISOString().split("T")[0],
      startDate: startDate || new Date().toISOString().split("T")[0],
      responsibleId: finalRespId,
      responsibleName: finalRespName,
      status,
      priority,
      phase,
      workspace: activity.workspace || currentWorkspace || 'equipos',
      subtasks,
      meetingNotes: meetingNotes.trim(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await onSave(updated);
      onClose();
    } catch (err) {
      console.error("Error saving activity:", err);
      onClose();
    }
  };

  const handleSendAlert = () => {
    const member = members.find((m) => m.id === responsibleId);
    if (member) {
      onSendMemberAlert(member, {
        ...activity,
        id,
        description,
        dueDate,
      });
      setAlertSent(true);
      setTimeout(() => setAlertSent(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="bg-white px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={id}
              disabled={!canEdit}
              onChange={(e) => setId(e.target.value)}
              className={`font-mono text-xs font-bold border px-2 py-0.5 rounded w-24 focus:outline-none ${
                isDuplicateId
                  ? "text-rose-700 bg-rose-50 border-rose-300 focus:border-rose-500"
                  : canEdit 
                    ? "text-slate-800 bg-slate-100 border-slate-200 focus:border-blue-500" 
                    : "text-slate-500 bg-slate-50 border-slate-200 cursor-not-allowed"
              }`}
              title="Identificador único de la actividad"
            />
            <span className="text-xs font-semibold text-slate-600">Detalles de la Actividad de Obra</span>
            {isDuplicateId && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                ID ya en uso (elija uno diferente)
              </span>
            )}
            {!canEdit && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 rounded">
                Solo Lectura
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSendAlert}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md text-xs font-semibold transition-colors cursor-pointer"
              title="Enviar alerta push inmediata al responsable asignado"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{alertSent ? "¡Alerta Enviada!" : "Notificar"}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
          {/* Description */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 text-xs">
              Descripción de la Actividad *
            </label>
            <input
              type="text"
              required
              disabled={!canEdit}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`w-full border rounded-md px-3 py-1.5 text-xs font-semibold focus:outline-none ${
                canEdit 
                  ? "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-500" 
                  : "bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed"
              }`}
            />
          </div>

          {/* Technical Specs & Details (Checklist) */}
          <div id="technical-specs-checklist-section" className="space-y-1.5">
            <div className="flex items-center justify-between bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1.5 transition-colors">
              <button
                type="button"
                id="toggle-technical-specs-button"
                onClick={() => setIsSpecsCollapsed(prev => !prev)}
                className="flex items-center gap-1.5 font-semibold text-slate-700 text-xs hover:text-blue-600 transition-colors cursor-pointer text-left select-none group"
              >
                {isSpecsCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-transform" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-transform" />
                )}
                <ClipboardList className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Especificaciones Técnicas / Detalle Constructivo</span>
              </button>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                  {[procChecked, montajeChecked, restrChecked].filter(Boolean).length}/3 activos
                </span>
                <button
                  type="button"
                  id="btn-specs-collapse-action"
                  onClick={() => setIsSpecsCollapsed(prev => !prev)}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-medium hover:underline cursor-pointer"
                >
                  {isSpecsCollapsed ? "Expandir" : "Colapsar"}
                </button>
              </div>
            </div>

            {/* Collapsed summary preview */}
            {isSpecsCollapsed && (
              <div 
                id="technical-specs-collapsed-preview"
                onClick={() => setIsSpecsCollapsed(false)}
                className="text-[11px] text-slate-600 bg-white border border-slate-200 rounded-md px-2.5 py-1.5 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors flex items-center justify-between gap-2"
              >
                <span className="truncate">
                  {[
                    procChecked ? (procDetalle ? `Procedimiento: ${procDetalle}` : "Procedimiento activo") : null,
                    montajeChecked ? (montajeRealizadoPor ? `Montaje: ${montajeRealizadoPor}` : "Montaje activo") : null,
                    restrChecked ? (restrCuales ? `Restricciones: ${restrCuales}` : "Restricciones activas") : null,
                  ].filter(Boolean).join(" • ") || "Sin especificaciones marcadas (clic para abrir y editar)"}
                </span>
                <span className="text-[10px] text-blue-600 font-semibold shrink-0">Ver detalles</span>
              </div>
            )}

            {/* Collapsible Card Body */}
            <div 
              id="technical-specs-checklist-card"
              className={`${isSpecsCollapsed ? "hidden" : "block"} bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-2 transition-all duration-200`}
            >
              {/* Item 1: Procedimiento */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white p-2 rounded-md border border-slate-200/80 shadow-2xs">
                <label className="flex items-center gap-2 cursor-pointer select-none shrink-0 sm:w-36">
                  <input
                    id="checklist-procedimiento"
                    type="checkbox"
                    disabled={!canEdit}
                    checked={procChecked}
                    onChange={(e) => setProcChecked(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <span className={`text-xs font-semibold ${procChecked ? "text-slate-900" : "text-slate-600"}`}>
                    Procedimiento
                  </span>
                </label>
                <input
                  id="checklist-procedimiento-input"
                  type="text"
                  disabled={!canEdit}
                  value={procDetalle}
                  onChange={(e) => {
                    setProcDetalle(e.target.value);
                    if (e.target.value.trim() && !procChecked) {
                      setProcChecked(true);
                    }
                  }}
                  placeholder={canEdit ? "Detalle de procedimiento técnico, protocolo o plano..." : "Sin detalles especificados"}
                  className={`flex-1 border rounded px-2.5 py-1 text-xs focus:outline-none transition-colors ${
                    canEdit
                      ? "bg-slate-50/50 border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500"
                      : "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                  }`}
                />
              </div>

              {/* Item 2: Montaje + Quién lo realiza */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white p-2 rounded-md border border-slate-200/80 shadow-2xs">
                <label className="flex items-center gap-2 cursor-pointer select-none shrink-0 sm:w-36">
                  <input
                    id="checklist-montaje"
                    type="checkbox"
                    disabled={!canEdit}
                    checked={montajeChecked}
                    onChange={(e) => setMontajeChecked(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <span className={`text-xs font-semibold flex items-center gap-1.5 ${montajeChecked ? "text-slate-900" : "text-slate-600"}`}>
                    <Wrench className="w-3.5 h-3.5 text-slate-500" />
                    <span>Montaje</span>
                  </span>
                </label>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 font-medium shrink-0 whitespace-nowrap">
                    Quién lo realiza:
                  </span>
                  <input
                    id="checklist-montaje-realizado-por"
                    type="text"
                    disabled={!canEdit}
                    value={montajeRealizadoPor}
                    onChange={(e) => {
                      setMontajeRealizadoPor(e.target.value);
                      if (e.target.value.trim() && !montajeChecked) {
                        setMontajeChecked(true);
                      }
                    }}
                    placeholder={canEdit ? "Especialista, cuadrilla o contratista que lo realiza..." : "No asignado"}
                    className={`w-full border rounded px-2.5 py-1 text-xs focus:outline-none transition-colors ${
                      canEdit
                        ? "bg-slate-50/50 border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500"
                        : "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                    }`}
                  />
                </div>
              </div>

              {/* Item 3: Restricciones + Cuáles */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white p-2 rounded-md border border-slate-200/80 shadow-2xs">
                <label className="flex items-center gap-2 cursor-pointer select-none shrink-0 sm:w-36">
                  <input
                    id="checklist-restricciones"
                    type="checkbox"
                    disabled={!canEdit}
                    checked={restrChecked}
                    onChange={(e) => setRestrChecked(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <span className={`text-xs font-semibold flex items-center gap-1.5 ${restrChecked ? "text-amber-800" : "text-slate-600"}`}>
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                    <span>Restricciones</span>
                  </span>
                </label>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 font-medium shrink-0 whitespace-nowrap">
                    Cuáles:
                  </span>
                  <input
                    id="checklist-restricciones-cuales"
                    type="text"
                    disabled={!canEdit}
                    value={restrCuales}
                    onChange={(e) => {
                      setRestrCuales(e.target.value);
                      if (e.target.value.trim() && !restrChecked) {
                        setRestrChecked(true);
                      }
                    }}
                    placeholder={canEdit ? "Indique restricciones activas (permisos, clima, interferencias, etc.)..." : "Sin restricciones reportadas"}
                    className={`w-full border rounded px-2.5 py-1 text-xs focus:outline-none transition-colors ${
                      canEdit
                        ? "bg-slate-50/50 border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white focus:border-amber-500"
                        : "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Grid: Responsible, Status, Priority, Phase */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Responsible */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Responsable *
              </label>
              <select
                value={responsibleId}
                disabled={!canEdit}
                onChange={(e) => setResponsibleId(e.target.value)}
                className={`w-full border rounded-md px-2.5 py-1.5 text-slate-800 focus:outline-none ${
                  canEdit ? "bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 cursor-pointer" : "bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed"
                }`}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role.split(" ")[0]})
                  </option>
                ))}
                {allMembers && allMembers.filter((am) => !members.some((m) => m.id === am.id)).map((am) => (
                  <option key={am.id} value={am.id}>
                    {am.name} ({am.role.split(" ")[0]}) - General
                  </option>
                ))}
              </select>
            </div>

            {/* Status / Disciplina */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Disciplina *
              </label>
              <select
                value={status}
                disabled={!canEdit}
                onChange={(e) => setStatus(e.target.value as ActivityStatus)}
                className={`w-full border rounded-md px-2.5 py-1.5 text-slate-800 font-semibold focus:outline-none ${
                  canEdit ? "bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 cursor-pointer" : "bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed"
                }`}
              >
                {availableDisciplines.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.icon} {d.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Prioridad *
              </label>
              <select
                value={priority}
                disabled={!canEdit}
                onChange={(e) => setPriority(e.target.value as ActivityPriority)}
                className={`w-full border rounded-md px-2.5 py-1.5 text-slate-800 focus:outline-none ${
                  canEdit ? "bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 cursor-pointer" : "bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed"
                }`}
              >
                <option value="urgent">Urgente</option>
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
            </div>

            {/* Phase */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Fase de Obra *
              </label>
              <select
                value={phase}
                disabled={!canEdit}
                onChange={(e) => setPhase(e.target.value)}
                className={`w-full border rounded-md px-2.5 py-1.5 text-slate-800 focus:outline-none ${
                  canEdit ? "bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 cursor-pointer" : "bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed"
                }`}
              >
                {availablePhases.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Fecha Límite Pactada *
              </label>
              <input
                type="date"
                required
                disabled={!canEdit}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`w-full border rounded-md px-3 py-1.5 focus:outline-none ${
                  canEdit ? "bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-blue-500" : "bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed"
                }`}
              >
              </input>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Fecha de Inicio
              </label>
              <input
                type="date"
                disabled={!canEdit}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`w-full border rounded-md px-3 py-1.5 focus:outline-none ${
                  canEdit ? "bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-blue-500" : "bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed"
                }`}
              />
            </div>
          </div>

          {/* Meeting Notes / Acuerdos de Reunión */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Acuerdos y Compromisos de Reunión de Obra
            </label>
            <input
              type="text"
              disabled={!canEdit}
              value={meetingNotes}
              onChange={(e) => setMeetingNotes(e.target.value)}
              placeholder="Ej: Acordado en reunión: se libera frente de trabajo para colocación de losetas."
              className={`w-full border rounded-md px-3 py-1.5 text-xs focus:outline-none ${
                canEdit ? "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-500" : "bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed"
              }`}
            />
          </div>

          {/* Checklist / Subtasks Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-md p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-blue-600" />
                Checklist de Verificación ({subtasks.filter((s) => s.completed).length}/{subtasks.length})
              </span>
              {canEdit && subtasks.length > 1 && (
                <span className="text-[11px] text-slate-400 font-normal hidden sm:inline-flex items-center gap-1">
                  <span>Reordenar: botones ↑↓ o arrastrar</span>
                </span>
              )}
            </div>

            {/* Subtask list */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {subtasks.length === 0 ? (
                <p className="text-slate-400 text-[11px] italic">
                  {canEdit ? "No hay subtareas registradas. Añade una con su fecha a continuación." : "No hay subtareas registradas para esta actividad."}
                </p>
              ) : (
                subtasks.map((st, idx) => {
                  const isEditing = editingSubtaskId === st.id;
                  const isFirst = idx === 0;
                  const isLast = idx === subtasks.length - 1;

                  return (
                    <div
                      key={st.id}
                      draggable={canEdit && !isEditing}
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      onDrop={(e) => handleDrop(e, idx)}
                      className={`flex items-center justify-between bg-white border rounded px-2.5 py-1.5 gap-2 transition-all ${
                        draggedIndex === idx
                          ? "opacity-50 border-blue-400 border-dashed bg-blue-50/50"
                          : dragOverIndex === idx
                            ? "border-blue-500 ring-2 ring-blue-300 bg-blue-50/30 scale-[1.01]"
                            : isEditing 
                              ? "border-blue-400 ring-1 ring-blue-400/30 bg-blue-50/20"
                              : st.completed 
                                ? "border-slate-200 bg-slate-50/70" 
                                : "border-slate-200 hover:border-slate-300 shadow-2xs"
                      }`}
                    >
                      {/* Controls to move up / down or drag when in edit mode */}
                      {canEdit && !isEditing && (
                        <div className="flex items-center gap-0.5 shrink-0 select-none">
                          <div 
                            className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-600 p-0.5 rounded hover:bg-slate-100 transition-colors"
                            title="Arrastra para reordenar este elemento"
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </div>

                          <div className="flex flex-col -space-y-1">
                            <button
                              type="button"
                              disabled={isFirst}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveSubtaskUp(idx);
                              }}
                              className={`p-0.5 rounded transition-colors ${
                                isFirst
                                  ? "text-slate-200 cursor-not-allowed opacity-30"
                                  : "text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                              }`}
                              title={isFirst ? "Primer elemento (no puede subir más)" : "Mover arriba"}
                              aria-label={`Mover "${st.title}" hacia arriba`}
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isLast}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveSubtaskDown(idx);
                              }}
                              className={`p-0.5 rounded transition-colors ${
                                isLast
                                  ? "text-slate-200 cursor-not-allowed opacity-30"
                                  : "text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                              }`}
                              title={isLast ? "Último elemento (no puede bajar más)" : "Mover abajo"}
                              aria-label={`Mover "${st.title}" hacia abajo`}
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <input
                            type="text"
                            value={editingSubtaskTitle}
                            onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleSaveEditSubtask(st.id);
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                handleCancelEditSubtask();
                              }
                            }}
                            autoFocus
                            placeholder="Descripción del punto de verificación..."
                            className="w-full bg-white border border-blue-500 rounded px-2 py-1 text-xs text-slate-900 font-medium focus:outline-none ring-1 ring-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEditSubtask(st.id)}
                            className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer shrink-0 transition-colors"
                            title="Guardar cambios (Enter)"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEditSubtask}
                            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded cursor-pointer shrink-0 transition-colors"
                            title="Cancelar (Esc)"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={st.completed}
                            disabled={!canEdit}
                            onChange={() => handleToggleSubtask(st.id)}
                            className={`w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 shrink-0 ${!canEdit ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                          />
                          <span 
                            onClick={() => {
                              if (canEdit) handleStartEditSubtask(st);
                            }}
                            className={`text-xs break-words flex-1 select-none ${
                              st.completed ? "line-through text-slate-400" : "text-slate-700 font-medium"
                            } ${canEdit ? "cursor-pointer hover:text-blue-600 transition-colors" : ""}`}
                            title={canEdit ? "Haz clic para editar la descripción" : undefined}
                          >
                            {st.title}
                          </span>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleStartEditSubtask(st)}
                              className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50 cursor-pointer transition-colors shrink-0"
                              title="Editar descripción del punto de verificación"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Fecha del checklist con posibilidad de modificar */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {canEdit ? (
                          <div 
                            className="flex items-center gap-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 focus-within:border-blue-500 focus-within:bg-white transition-colors"
                            title="Establecer o modificar fecha de este punto de verificación"
                          >
                            <Calendar className="w-3 h-3 text-slate-400 shrink-0 pointer-events-none" />
                            <input
                              type="date"
                              aria-label={`Fecha para checklist ${st.title}`}
                              value={st.dueDate || ""}
                              onChange={(e) => handleUpdateSubtaskDueDate(st.id, e.target.value)}
                              className="bg-transparent text-[11px] text-slate-700 font-medium focus:outline-none cursor-pointer"
                            />
                            {st.dueDate && (
                              <button
                                type="button"
                                onClick={() => handleUpdateSubtaskDueDate(st.id, "")}
                                className="text-slate-300 hover:text-slate-600 p-0.5 cursor-pointer"
                                title="Quitar fecha"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          st.dueDate && (
                            <span className="flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>{st.dueDate}</span>
                            </span>
                          )
                        )}

                        {canEdit && !isEditing && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSubtask(st.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 cursor-pointer transition-colors"
                            title="Eliminar este punto de verificación"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add Subtask Input */}
            {canEdit && (
              <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      placeholder="Añadir punto de verificación técnico..."
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddSubtask(e);
                        }
                      }}
                      className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors shadow-2xs"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Date picker for checklist item */}
                    <div 
                      className="flex items-center gap-1 bg-white border border-slate-200 rounded-md px-2 py-1.5 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 shadow-2xs transition-colors"
                      title="Establecer fecha para este punto de verificación"
                    >
                      <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0 pointer-events-none" />
                      <input
                        type="date"
                        aria-label="Fecha del punto de verificación"
                        value={newSubtaskDueDate}
                        onChange={(e) => setNewSubtaskDueDate(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddSubtask(e);
                          }
                        }}
                        className="bg-transparent text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
                      />
                      {newSubtaskDueDate && (
                        <button
                          type="button"
                          onClick={() => setNewSubtaskDueDate("")}
                          className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                          title="Limpiar fecha"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddSubtask()}
                      disabled={!newSubtaskTitle.trim()}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-md text-xs transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0 shadow-2xs flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Añadir</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            {canEdit ? (
              isConfirmingDelete ? (
                <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2 py-1 rounded-md">
                  <span className="text-[11px] font-bold text-rose-700">¿Eliminar {activity.id}?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(activity.id);
                      onClose();
                    }}
                    className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded cursor-pointer transition-colors shadow-2xs"
                  >
                    Sí, eliminar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(false)}
                    className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-xs rounded cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-md font-semibold transition-colors cursor-pointer text-xs"
                  title="Eliminar actividad"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar</span>
                </button>
              )
            ) : (
              <span className="text-[11px] text-slate-400 italic">
                Modo lectura (Se requiere usuario Alejandro Tejeda para editar)
              </span>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium rounded-md transition-colors cursor-pointer text-xs"
              >
                {canEdit ? "Cancelar" : "Cerrar"}
              </button>

              {canEdit && (
                <button
                  type="submit"
                  disabled={isDuplicateId}
                  className={`flex items-center gap-1.5 px-4 py-1.5 font-semibold rounded-md shadow-2xs transition-all text-xs ${
                    isDuplicateId
                      ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                  }`}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar Cambios</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
