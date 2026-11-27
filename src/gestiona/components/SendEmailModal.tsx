import React, { useState, useEffect } from "react";
import {
  X,
  Mail,
  Send,
  Sparkles,
  Check,
  Copy,
  Users,
  AlertCircle,
  CheckCircle2,
  FileText,
  Clock,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  BellRing
} from "lucide-react";
import { Member, Activity, Project, NotificationItem, WorkspaceType } from "../types";

interface SendEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  activities: Activity[];
  project: Project;
  currentMember: Member;
  currentWorkspace?: WorkspaceType;
  onSendInAppNotification?: (
    title: string,
    message: string,
    targetMemberId?: string,
    type?: NotificationItem["type"]
  ) => void;
}

// Helper to format the verification checklist for an activity
export function formatActivityChecklist(act: Activity): string {
  const items: string[] = [];

  // 1. Subtasks (Checklist de Verificación)
  if (act.subtasks && act.subtasks.length > 0) {
    act.subtasks.forEach((st) => {
      const mark = st.completed ? "[✓]" : "[ ]";
      const due = st.dueDate ? ` (Límite: ${st.dueDate})` : "";
      const statusSuffix = st.completed ? " (Completado)" : "";
      items.push(`           ${mark} ${st.title}${due}${statusSuffix}`);
    });
  }

  // 2. Technical checklist items (Procedimiento, Montaje, Restricciones)
  const tc = act.technicalChecklist;
  if (tc) {
    if (tc.procedimientoChecked || (tc.procedimientoDetalle && tc.procedimientoDetalle.trim())) {
      const detail = tc.procedimientoDetalle?.trim() ? `: ${tc.procedimientoDetalle.trim()}` : "";
      items.push(`           ${tc.procedimientoChecked ? "[✓]" : "[ ]"} Procedimiento Técnico${detail}`);
    }
    if (tc.montajeChecked || (tc.montajeRealizadoPor && tc.montajeRealizadoPor.trim())) {
      const detail = tc.montajeRealizadoPor?.trim() ? ` (Por: ${tc.montajeRealizadoPor.trim()})` : "";
      items.push(`           ${tc.montajeChecked ? "[✓]" : "[ ]"} Montaje${detail}`);
    }
    if (tc.restriccionesChecked || (tc.restriccionesCuales && tc.restriccionesCuales.trim())) {
      const detail = tc.restriccionesCuales?.trim() ? `: ${tc.restriccionesCuales.trim()}` : "";
      items.push(`           ⚠️ Restricción reportada${detail}`);
    }
  }

  if (items.length === 0) return "";
  return `         • Checklist de Verificación:\n${items.join("\n")}\n`;
}

// Group activities by workspace and canonical phases for clear engineer identification
export function formatActivitiesGroupedByPhase(userActs: Activity[]): string {
  if (!userActs || userActs.length === 0) {
    return "   • Sin actividades pendientes asignadas actualmente.\n\n";
  }

  const isConstruccion = (a: Activity) =>
    a.workspace === "construccion" || (a.id && a.id.startsWith("CST"));

  // Canonical phases for Equipamiento
  const eqPhases = [
    { key: "ingenieria", label: "Fase: Ingeniería", badge: "🔹" },
    { key: "compras", label: "Fase: Compras", badge: "🔹" },
    { key: "fabricacion", label: "Fase: Fabricación", badge: "🔹" },
    { key: "flete", label: "Fase: Flete", badge: "🔹" },
  ];

  // Canonical phases for Construcción
  const cstPhases = [
    { key: "obras enterradas", label: "Fase: Obras Enterradas", badge: "🏗️" },
    { key: "tuberias principales", label: "Fase: Tuberías Principales", badge: "🏗️" },
    { key: "hormigonados", label: "Fase: Hormigonados", badge: "🏗️" },
    { key: "arquitectura", label: "Fase: Arquitectura", badge: "🏗️" },
    { key: "montajes en curso", label: "Fase: Montajes en Curso", badge: "🏗️" },
    { key: "montajes & equipos", label: "Fase: Montajes & Equipos", badge: "🏗️" },
  ];

  const eqActs = userActs.filter((a) => !isConstruccion(a));
  const cstActs = userActs.filter((a) => isConstruccion(a));
  const hasMultiple = eqActs.length > 0 && cstActs.length > 0;

  const renderGroup = (
    acts: Activity[],
    phases: { key: string; label: string; badge: string }[],
    defaultBadge: string
  ) => {
    let block = "";
    const map = new Map<string, Activity[]>();
    const otherMap = new Map<string, Activity[]>();

    acts.forEach((a) => {
      const pNorm = (a.phase || "").toLowerCase().trim();
      let matchedKey: string | null = null;
      for (const def of phases) {
        if (def.key === "ingenieria" && (pNorm.includes("ing") || pNorm.includes("diseñ"))) {
          matchedKey = def.key;
          break;
        }
        if (def.key === "compras" && (pNorm.includes("compra") || pNorm.includes("adquis"))) {
          matchedKey = def.key;
          break;
        }
        if (def.key === "fabricacion" && (pNorm.includes("fabric") || pNorm.includes("taller") || pNorm.includes("ensamble"))) {
          matchedKey = def.key;
          break;
        }
        if (def.key === "flete" && (pNorm.includes("flet") || pNorm.includes("transport") || pNorm.includes("envio") || pNorm.includes("envío") || pNorm.includes("logist"))) {
          matchedKey = def.key;
          break;
        }
        if (def.key === "obras enterradas" && (pNorm.includes("enterrad") || pNorm.includes("preliminar") || pNorm.includes("trazo") || pNorm.includes("zanja") || pNorm.includes("excavaci"))) {
          matchedKey = def.key;
          break;
        }
        if (def.key === "tuberias principales" && (pNorm.includes("tuberia") || pNorm.includes("tubería") || pNorm.includes("piping") || pNorm.includes("colector"))) {
          matchedKey = def.key;
          break;
        }
        if (def.key === "hormigonados" && (pNorm.includes("hormigon") || pNorm.includes("hormigón") || pNorm.includes("concreto") || pNorm.includes("cimentaci") || pNorm.includes("losa") || pNorm.includes("colado"))) {
          matchedKey = def.key;
          break;
        }
        if (def.key === "arquitectura" && (pNorm.includes("arquitect") || pNorm.includes("acabado") || pNorm.includes("mamposteria") || pNorm.includes("fachada"))) {
          matchedKey = def.key;
          break;
        }
        if (def.key === "montajes en curso" && (pNorm.includes("curso") || pNorm.includes("montaje en curso"))) {
          matchedKey = def.key;
          break;
        }
        if (def.key === "montajes & equipos" && (pNorm.includes("montaje") || pNorm.includes("equipo") || pNorm.includes("electromec") || pNorm.includes("comision") || pNorm.includes("puesta en marcha"))) {
          matchedKey = def.key;
          break;
        }
      }

      if (matchedKey) {
        if (!map.has(matchedKey)) map.set(matchedKey, []);
        map.get(matchedKey)!.push(a);
      } else {
        const title = a.phase ? `Fase: ${a.phase}` : "Fase: General";
        if (!otherMap.has(title)) otherMap.set(title, []);
        otherMap.get(title)!.push(a);
      }
    });

    phases.forEach((def) => {
      const list = map.get(def.key);
      if (list && list.length > 0) {
        block += `   ${def.badge} ${def.label.toUpperCase()} (${list.length}):\n`;
        list.forEach((a, idx) => {
          block += `      ${idx + 1}. [${a.id}] ${a.description}\n`;
          const cl = formatActivityChecklist(a);
          if (cl) {
            block += `${cl}`;
          }
        });
        block += "\n";
      }
    });

    otherMap.forEach((list, title) => {
      block += `   ${defaultBadge} ${title.toUpperCase()} (${list.length}):\n`;
      list.forEach((a, idx) => {
        block += `      ${idx + 1}. [${a.id}] ${a.description}\n`;
        const cl = formatActivityChecklist(a);
        if (cl) {
          block += `${cl}`;
        }
      });
      block += "\n";
    });

    return block;
  };

  let out = "";
  if (eqActs.length > 0) {
    if (hasMultiple) {
      out += `   📦 ESPACIO: EQUIPAMIENTO (${eqActs.length} actividades)\n`;
    }
    out += renderGroup(eqActs, eqPhases, "🔹");
  }

  if (cstActs.length > 0) {
    if (hasMultiple) {
      out += `   🏗️ ESPACIO: CONSTRUCCIÓN (${cstActs.length} actividades)\n`;
    }
    out += renderGroup(cstActs, cstPhases, "🏗️");
  }

  return out;
}

export const SendEmailModal: React.FC<SendEmailModalProps> = ({
  isOpen,
  onClose,
  members,
  activities,
  project,
  currentMember,
  currentWorkspace = "equipos",
  onSendInAppNotification,
}) => {
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [workspaceFilter, setWorkspaceFilter] = useState<WorkspaceType | "all">(currentWorkspace || "all");
  const [emailType, setEmailType] = useState<"assigned_tasks" | "project_summary" | "urgent_call" | "custom">("assigned_tasks");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [customNote, setCustomNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [sentInApp, setSentInApp] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Keep workspace filter aligned with current workspace
  useEffect(() => {
    if (isOpen && currentWorkspace) {
      setWorkspaceFilter(currentWorkspace);
    }
  }, [isOpen, currentWorkspace]);

  // Filter activities according to workspace selection
  const relevantActivities = React.useMemo(() => {
    if (workspaceFilter === "all") return activities;
    return activities.filter((a) => {
      const isConstruccion = a.workspace === "construccion" || (a.id && a.id.startsWith("CST"));
      return workspaceFilter === "construccion" ? isConstruccion : !isConstruccion;
    });
  }, [activities, workspaceFilter]);

  // Initialize selected members when opening modal
  useEffect(() => {
    if (isOpen) {
      const validMemberIds = members.filter((m) => m.email && m.email.includes("@")).map((m) => m.id);
      setSelectedMemberIds(validMemberIds);
      setSentInApp(false);
      setCopied(false);
    }
  }, [isOpen, members]);

  const selectedMembers = members.filter((m) => selectedMemberIds.includes(m.id));

  // Helper to construct greeting
  const getGreeting = (selected: Member[], allMembers: Member[]) => {
    if (selected.length === 0) return "Hola Equipo,";
    if (selected.length === allMembers.length) {
      return "Hola Equipo,";
    }
    if (selected.length === 1) {
      const firstName = selected[0].name.trim().split(/\s+/)[0];
      return `Hola ${firstName},`;
    }
    const firstNames = selected.map((m) => m.name.trim().split(/\s+/)[0]);
    if (firstNames.length === 2) {
      return `Hola ${firstNames[0]} y ${firstNames[1]},`;
    }
    const last = firstNames.pop();
    return `Hola ${firstNames.join(", ")} y ${last},`;
  };

  // Auto-generate draft when selected members, workspace, or emailType changes
  useEffect(() => {
    if (!isOpen || selectedMembers.length === 0) return;

    const greeting = getGreeting(selectedMembers, members);
    const isSingleRecipient = selectedMembers.length === 1;

    if (emailType === "assigned_tasks") {
      const wsSuffix = workspaceFilter === "equipos" ? " - Equipamiento" : workspaceFilter === "construccion" ? " - Construcción" : "";
      const subj = `[${project.name}] Asignación de Actividades por Fase${wsSuffix} - ${new Date().toLocaleDateString("es-ES")}`;
      const intro = isSingleRecipient
        ? `Te comparto el desglose de actividades asignadas y compromisos vigentes para el proyecto ${project.name} (${project.code}), agrupadas según su respectiva fase.`
        : `Les comparto el desglose de actividades asignadas y compromisos vigentes para el proyecto ${project.name} (${project.code}), agrupadas según su respectiva fase.`;
      
      let text = `${greeting}\n\n${intro}\n\n`;

      selectedMembers.forEach((m) => {
        const userActs = relevantActivities.filter((a) => a.responsibleId === m.id);
        text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        text += `👤 ${m.name} | ${m.role}\n`;
        text += `📧 Correo: ${m.email}\n`;
        const wsTag = workspaceFilter === "equipos" ? " [Equipamiento]" : workspaceFilter === "construccion" ? " [Construcción]" : "";
        text += `📋 Actividades Asignadas (${userActs.length})${wsTag}:\n\n`;

        if (userActs.length === 0) {
          text += `   • Sin actividades pendientes asignadas actualmente.\n\n`;
        } else {
          text += formatActivitiesGroupedByPhase(userActs);
        }
      });

      if (customNote.trim()) {
        text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📌 NOTA DE DIRECCIÓN DE OBRA:\n${customNote}\n\n`;
      }

      text += `Ingresa a la plataforma gestionando.ai.studio para revisar el estado de tus entregables.`;
      setSubject(subj);
      setBody(text);
    } else if (emailType === "project_summary") {
      const subj = `[${project.name}] Minuta y Resumen Ejecutivo de Avance de Obra`;
      const totalActs = relevantActivities.length;

      let text = `${greeting}\n\nSe presenta el resumen ejecutivo de estado actual del proyecto ${project.name}:\n\n`;
      text += `📍 Ubicación: ${project.location}\n`;
      text += `📊 Total de Actividades en Seguimiento: ${totalActs}\n\n`;

      // Breakdown by phases
      text += `Desglose de Actividades por Fase:\n`;
      const isConstruccion = (a: Activity) =>
        a.workspace === "construccion" || (a.id && a.id.startsWith("CST"));
      const eqActs = relevantActivities.filter((a) => !isConstruccion(a));
      const cstActs = relevantActivities.filter((a) => isConstruccion(a));

      if (eqActs.length > 0) {
        text += ` 📦 Equipamiento (${eqActs.length} actividades):\n`;
        const eqPhasesList = ["Ingenieria", "Compras", "Fabricacion", "Flete"];
        eqPhasesList.forEach((ph) => {
          const count = eqActs.filter((a) => (a.phase || "").toLowerCase().includes(ph.toLowerCase().slice(0, 4))).length;
          const displayLabel = ph === "Ingenieria" ? "Ingeniería" : ph === "Fabricacion" ? "Fabricación" : ph;
          if (count > 0) {
            text += `    • Fase ${displayLabel}: ${count} actividades\n`;
          }
        });
      }

      if (cstActs.length > 0) {
        text += ` 🏗️ Construcción (${cstActs.length} actividades):\n`;
        const cstPhasesList = ["Obras Enterradas", "Tuberias Principales", "Hormigonados", "Arquitectura", "Montajes en Curso", "Montajes & Equipos"];
        cstPhasesList.forEach((ph) => {
          const count = cstActs.filter((a) => (a.phase || "").toLowerCase().includes(ph.toLowerCase().slice(0, 5))).length;
          const displayLabel = ph === "Tuberias Principales" ? "Tuberías Principales" : ph;
          if (count > 0) {
            text += `    • Fase ${displayLabel}: ${count} actividades\n`;
          }
        });
      }
      text += `\n`;

      text += `Desglose por Disciplina:\n`;
      const discMap: Record<string, number> = {};
      relevantActivities.forEach((a) => {
        const st = a.status || "General";
        discMap[st] = (discMap[st] || 0) + 1;
      });
      Object.entries(discMap).forEach(([d, count]) => {
        const label = d.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
        text += ` • ${label}: ${count} actividades activas\n`;
      });

      if (customNote.trim()) {
        text += `\n📌 Acuerdos y directrices:\n${customNote}\n`;
      }

      const hasValidSender = currentMember && currentMember.name && currentMember.name !== "Sin usuario";
      if (hasValidSender) {
        text += `\nQuedamos a su disposición para cualquier duda sobre el cronograma.\n\nAtentamente,\n${currentMember.name}\n${project.name}`;
      } else {
        text += `\nQuedamos a su disposición para cualquier duda sobre el cronograma.\n\n${project.name}`;
      }
      setSubject(subj);
      setBody(text);
    } else if (emailType === "urgent_call") {
      const subj = `🚨 [URGENTE - ${project.name}] Convocatoria y Revisión de Puntos Críticos`;
      const urgentIntro = isSingleRecipient
        ? `Se solicita tu atención prioritaria para la revisión y resolución de puntos críticos en el proyecto ${project.name}.`
        : `Se solicita su atención prioritaria para la revisión y resolución de puntos críticos en el proyecto ${project.name}.`;
      
      let text = `${greeting}\n\n${urgentIntro}\n\n`;
      if (customNote.trim()) {
        text += `Asunto prioritario a tratar:\n${customNote}\n\n`;
      } else {
        text += `Favor de reportarse a la brevedad para coordinar actividades en campo y liberar frentes de trabajo.\n\n`;
      }
      text += `Destinatarios convocados:\n` + selectedMembers.map((m) => ` • ${m.name} (${m.email}) - ${m.role}`).join("\n");
      const hasValidSender = currentMember && currentMember.name && currentMember.name !== "Sin usuario";
      if (hasValidSender) {
        text += `\n\nAtentamente,\n${currentMember.name}\n${currentMember.role}`;
      }
      setSubject(subj);
      setBody(text);
    }
  }, [isOpen, selectedMemberIds, workspaceFilter, emailType, customNote, project.name, relevantActivities, members]);

  const handleToggleMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const all = members.filter((m) => m.email && m.email.includes("@")).map((m) => m.id);
    setSelectedMemberIds(all);
  };

  const handleDeselectAll = () => {
    setSelectedMemberIds([]);
  };

  // Open native Mail client (mailto:)
  const handleOpenMailClient = () => {
    if (selectedMembers.length === 0) return;

    const emails = selectedMembers.map((m) => m.email).filter(Boolean);
    const toField = emails.join(",");
    const mailtoUrl = `mailto:${encodeURIComponent(toField)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    window.open(mailtoUrl, "_blank");
  };

  // Copy to clipboard
  const handleCopyToClipboard = async () => {
    try {
      const fullText = `Destinatarios: ${selectedMembers.map((m) => `${m.name} <${m.email}>`).join(", ")}\nAsunto: ${subject}\n\n${body}`;
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error("Error al copiar texto:", e);
    }
  };

  // Send in-app notification to selected members
  const handleDispatchInAppAlert = () => {
    if (!onSendInAppNotification || selectedMembers.length === 0) return;

    selectedMembers.forEach((m) => {
      onSendInAppNotification(
        `📧 Correo / Alerta: ${subject}`,
        `Se emitió una comunicación para tu atención sobre actividades de "${project.name}".`,
        m.id,
        emailType === "urgent_call" ? "due_alert" : "general"
      );
    });

    setSentInApp(true);
    setTimeout(() => setSentInApp(false), 3000);
  };

  if (!isOpen) return null;

  const filteredMembers = members.filter((m) => {
    const term = (searchTerm || "").toLowerCase();
    return (
      (m.name || "").toLowerCase().includes(term) ||
      (m.email || "").toLowerCase().includes(term) ||
      (m.role || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-900 to-blue-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <Mail className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Enviar Correo & Alertas al Equipo</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30">
                  {selectedMembers.length} indexados
                </span>
              </div>
              <p className="text-xs text-blue-200/80">
                {project.name} • Envío personalizado a los correos indexados del equipo
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Grid: Left Recipients / Right Email Composer */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden">
          
          {/* Left Column: Index of Members / Recipients (5 cols) */}
          <div className="md:col-span-5 border-r border-slate-200 bg-slate-50/70 p-4 flex flex-col overflow-y-auto max-h-[75vh]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Destinatarios ({selectedMembers.length}/{members.length})</span>
              </div>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-blue-600 hover:text-blue-800 font-semibold hover:underline cursor-pointer"
                >
                  Todos
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                >
                  Ninguno
                </button>
              </div>
            </div>

            {/* Workspace Filter Segment */}
            <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg mb-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setWorkspaceFilter("equipos")}
                className={`flex-1 py-1 px-1.5 rounded-md transition-all text-center cursor-pointer text-[11px] ${
                  workspaceFilter === "equipos"
                    ? "bg-white text-blue-900 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Filtrar actividades de Equipamiento (Ingeniería, Compras, Fabricación, Flete)"
              >
                ⚙️ Equipamiento
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceFilter("construccion")}
                className={`flex-1 py-1 px-1.5 rounded-md transition-all text-center cursor-pointer text-[11px] ${
                  workspaceFilter === "construccion"
                    ? "bg-white text-blue-900 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Filtrar actividades de Construcción (Obras Enterradas, Tuberías, Hormigonados, etc.)"
              >
                🏗️ Construcción
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceFilter("all")}
                className={`py-1 px-2 rounded-md transition-all text-center cursor-pointer text-[11px] ${
                  workspaceFilter === "all"
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Mostrar todas las actividades"
              >
                Todas
              </button>
            </div>

            {/* Quick Search */}
            <input
              type="text"
              placeholder="Buscar por nombre, correo o rol..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-md px-3 py-1.5 text-xs mb-3 focus:outline-none focus:border-blue-500"
            />

            {/* Members List */}
            <div className="space-y-2 flex-1 overflow-y-auto pr-1">
              {filteredMembers.map((member) => {
                const isSelected = selectedMemberIds.includes(member.id);
                const userActs = relevantActivities.filter((a) => a.responsibleId === member.id);
                const urgentCount = userActs.filter((a) => a.priority === "urgent").length;

                return (
                  <div
                    key={member.id}
                    onClick={() => handleToggleMember(member.id)}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-start gap-2.5 select-none ${
                      isSelected
                        ? "bg-white border-blue-400 shadow-2xs ring-1 ring-blue-400/30"
                        : "bg-white/60 border-slate-200 opacity-75 hover:opacity-100 hover:bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // Handled by parent div
                      className="mt-1 rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300 cursor-pointer"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className={`w-5 h-5 rounded-full ${member.avatarColor} text-white text-[9px] font-bold flex items-center justify-center shrink-0`}>
                            {member.initials}
                          </div>
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {member.name}
                          </p>
                        </div>
                        {userActs.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-slate-100 text-slate-700 shrink-0">
                            {userActs.length} {userActs.length === 1 ? "actividad" : "actividades"}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-blue-700 font-mono truncate mt-0.5">
                        ✉️ {member.email}
                      </p>
                      
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                        <span className="truncate max-w-[170px]">{member.role}</span>
                        {urgentCount > 0 && (
                          <span className="text-rose-600 font-bold bg-rose-50 px-1 rounded border border-rose-200">
                            🔥 {urgentCount} urgente
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredMembers.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-xs">
                  No se encontraron miembros coincidentes.
                </div>
              )}
            </div>

            {/* Recipient summary bar */}
            <div className="mt-3 pt-2.5 border-t border-slate-200 text-[11px] text-slate-600">
              <span className="font-semibold text-slate-800">Indexados listos: </span>
              <span>{selectedMembers.map((m) => m.email).filter(Boolean).join(", ") || "Ninguno seleccionado"}</span>
            </div>
          </div>

          {/* Right Column: Email Composer & Options (7 cols) */}
          <div className="md:col-span-7 p-5 flex flex-col overflow-y-auto max-h-[75vh] bg-white">
            
            {/* Template Selector Bar */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Tipo de Correo / Plantilla
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setEmailType("assigned_tasks")}
                  className={`p-2 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                    emailType === "assigned_tasks"
                      ? "bg-blue-50 border-blue-500 text-blue-900 font-bold shadow-2xs"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <p className="flex items-center gap-1 font-semibold">
                    <span>📋 Tareas Asignadas</span>
                  </p>
                  <p className="text-[10px] font-normal text-slate-500 mt-0.5 line-clamp-1">
                    Desglose por responsable
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setEmailType("project_summary")}
                  className={`p-2 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                    emailType === "project_summary"
                      ? "bg-blue-50 border-blue-500 text-blue-900 font-bold shadow-2xs"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <p className="flex items-center gap-1 font-semibold">
                    <span>🏗️ Resumen de Obra</span>
                  </p>
                  <p className="text-[10px] font-normal text-slate-500 mt-0.5 line-clamp-1">
                    Avance por disciplina
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setEmailType("urgent_call")}
                  className={`p-2 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                    emailType === "urgent_call"
                      ? "bg-rose-50 border-rose-500 text-rose-900 font-bold shadow-2xs"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <p className="flex items-center gap-1 font-semibold">
                    <span>🚨 Aviso Urgente</span>
                  </p>
                  <p className="text-[10px] font-normal text-slate-500 mt-0.5 line-clamp-1">
                    Convocatoria inmediata
                  </p>
                </button>
              </div>
            </div>

            {/* Special direction note input */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Nota / Instrucción Adicional de Dirección:
                </label>
              </div>
              <input
                type="text"
                placeholder="Ej. Revisar entregas para la inspección de este viernes..."
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>

            {/* Subject Field */}
            <div className="mb-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Asunto del Correo:
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500 shadow-2xs"
              />
            </div>

            {/* Body Field */}
            <div className="mb-3 flex-1 flex flex-col min-h-[180px]">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  Cuerpo del Mensaje (Editable):
                </label>
                <span className="text-[11px] text-slate-400">
                  Formato compatible con Gmail / Outlook
                </span>
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                className="w-full flex-1 bg-white border border-slate-300 rounded-md p-3 text-xs font-mono text-slate-800 leading-relaxed focus:outline-none focus:border-blue-500 shadow-2xs resize-none"
              />
            </div>

            {/* Actions Bar */}
            <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              
              <div className="flex items-center gap-2">
                {/* Copy content button */}
                <button
                  type="button"
                  onClick={handleCopyToClipboard}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors cursor-pointer shadow-2xs"
                  title="Copiar contenido formateado al portapapeles"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-semibold">¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-600" />
                      <span>Copiar Texto</span>
                    </>
                  )}
                </button>

                {/* In-app notification alert */}
                {onSendInAppNotification && (
                  <button
                    type="button"
                    onClick={handleDispatchInAppAlert}
                    disabled={selectedMembers.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                    title="Emitir alerta en la campana de notificaciones de los seleccionados"
                  >
                    {sentInApp ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-semibold">Notificación Enviada</span>
                      </>
                    ) : (
                      <>
                        <BellRing className="w-3.5 h-3.5 text-blue-600" />
                        <span>Alerta In-App</span>
                      </>
                    )}
                  </button>
                )}
              </div>

                {/* Primary: Open Email Client (mailto) */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  Cerrar
                </button>

                <button
                  type="button"
                  onClick={handleOpenMailClient}
                  disabled={selectedMembers.length === 0}
                  className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-md shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
                >
                  <Send className="w-3.5 h-3.5 text-white" />
                  <span>Abrir en Correo ({selectedMembers.length})</span>
                </button>
              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
