import React, { useState, useEffect } from "react";
import { 
  Activity, 
  Member, 
  Project, 
  MeetingSession,
  ActivityPriority,
  ActivityStatus
} from "../types";
import { 
  Mic, 
  Play, 
  Pause, 
  RotateCcw, 
  Plus, 
  CheckCircle2, 
  Sparkles, 
  Copy, 
  Send, 
  FileText, 
  Calendar, 
  User, 
  Clock, 
  AlertCircle,
  Share2,
  Check
} from "lucide-react";
import confetti from "canvas-confetti";
import { generateNextActivityId, canUserEdit } from "../lib/activityUtils";

interface LiveMeetingModeProps {
  project: Project;
  members: Member[];
  currentMember: Member;
  activities: Activity[];
  phases?: string[];
  disciplines?: { id: string; label: string; icon?: string }[];
  onAddActivity: (activity: Activity) => void;
  onSaveMeetingSession: (session: MeetingSession) => void;
}

export const LiveMeetingMode: React.FC<LiveMeetingModeProps> = ({
  project,
  members,
  currentMember,
  activities,
  phases: propPhases,
  disciplines: propDisciplines,
  onAddActivity,
  onSaveMeetingSession,
}) => {
  const canEdit = canUserEdit(currentMember);

  // Meeting live timer
  const [meetingSeconds, setMeetingSeconds] = useState(0);
  const [isMeetingRunning, setIsMeetingRunning] = useState(true);
  const [meetingTitle, setMeetingTitle] = useState(`Reunión de Obra - ${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`);
  
  // Attendance
  const [attendees, setAttendees] = useState<string[]>(members.map((m) => m.id));

  const availablePhases = propPhases && propPhases.length > 0 
    ? propPhases 
    : Array.from(new Set(["Ingenieria", "Compras", "Fabricacion", "Flete", ...(project.phases || [])]));

  const availableDisciplines = propDisciplines && propDisciplines.length > 0
    ? propDisciplines
    : [
        { id: "electrico", label: "Eléctrico", icon: "⚡" },
        { id: "mecanico", label: "Mecánico", icon: "⚙️" },
        { id: "instrumentacion", label: "Instrumentación", icon: "📡" },
        { id: "civil", label: "Civil", icon: "🏗️" },
      ];

  // Activity Quick Entry form
  const [newDesc, setNewDesc] = useState("");
  const [newRespId, setNewRespId] = useState(members[0]?.id || "");
  const [newDueDate, setNewDueDate] = useState(() => {
    // Default to next week
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split("T")[0];
  });
  const [newPhase, setNewPhase] = useState(availablePhases[0] || "Ingenieria");
  const [newStatus, setNewStatus] = useState<ActivityStatus>((availableDisciplines[0]?.id as ActivityStatus) || "electrico");
  const [newPriority, setNewPriority] = useState<ActivityPriority>("high");
  const [newNotes, setNewNotes] = useState("");

  // Session activity list
  const [sessionCreatedIds, setSessionCreatedIds] = useState<string[]>([]);
  const [rawNotes, setRawNotes] = useState("");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiSummary, setAiSummary] = useState<any | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  // Meeting Timer tick
  useEffect(() => {
    let interval: any = null;
    if (isMeetingRunning) {
      interval = setInterval(() => {
        setMeetingSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isMeetingRunning]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const toggleAttendee = (memberId: string) => {
    setAttendees((prev) => 
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  // Quick Date presets
  const setDatePreset = (daysFromNow: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    setNewDueDate(d.toISOString().split("T")[0]);
  };

  // Add activity during meeting
  const handleCreateActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !newDesc.trim()) return;

    const responsible = members.find((m) => m.id === newRespId) || members[0];
    
    // Generate next consecutive code safely
    const code = generateNextActivityId(activities);

    const newAct: Activity = {
      id: code,
      projectId: project.id,
      description: newDesc.trim(),
      dueDate: newDueDate,
      startDate: new Date().toISOString().split("T")[0],
      responsibleId: responsible.id,
      responsibleName: responsible.name,
      status: newStatus || "electrico",
      priority: newPriority,
      phase: newPhase || "Ingenieria",
      subtasks: [],
      meetingNotes: newNotes.trim() ? `Acuerdo de reunión: ${newNotes.trim()}` : "Registrado durante reunión de obra en vivo.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onAddActivity(newAct);
    setSessionCreatedIds((prev) => [newAct.id, ...prev]);
    
    // Reset quick form
    setNewDesc("");
    setNewNotes("");
    
    try {
      confetti({ particleCount: 30, spread: 45, origin: { y: 0.8 } });
    } catch (err) {}
  };

  // Guardar la minuta (notas y asistentes tal cual; sin IA)
  const handleGuardarMinuta = async () => {
    if (!canEdit) return;
    setIsGeneratingAI(true);
    try {
      const session: MeetingSession = {
        id: `MEET-${Date.now()}`,
        projectId: project.id,
        title: meetingTitle,
        date: new Date().toISOString().split("T")[0],
        startedAt: new Date(Date.now() - meetingSeconds * 1000).toISOString(),
        endedAt: new Date().toISOString(),
        attendeeIds: attendees,
        rawNotes,
        criticalAgreements: [],
        createdActivityIds: sessionCreatedIds,
        status: "completed",
      };
      await onSaveMeetingSession(session);
      alert("Minuta guardada.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Copy structured text for WhatsApp / Email
  const handleCopySummary = () => {
    const attendeeNames = members
      .filter((m) => attendees.includes(m.id))
      .map((m) => `• ${m.name} (${m.role})`)
      .join("\n");

    const sessionActivities = activities.filter((a) => sessionCreatedIds.includes(a.id));
    
    const actList = sessionActivities.length > 0 
      ? sessionActivities.map((a) => `📌 *[${a.id}]* ${a.description}\n   👤 Responsable: ${a.responsibleName}\n   📅 Entrega: ${a.dueDate}\n   ⚡ Prioridad: ${a.priority.toUpperCase()}`).join("\n\n")
      : "• Se revisaron avances de las actividades preexistentes.";

    const text = `📋 *MINUTA DE REUNIÓN DE OBRA*
🏗️ *Proyecto:* ${project.name} (${project.code})
🗓️ *Fecha:* ${new Date().toLocaleDateString('es-ES')}
⏱️ *Duración:* ${formatTimer(meetingSeconds)}

👥 *ASISTENCIA:*
${attendeeNames}

📝 *NOTAS & RESUMEN:*
${aiSummary?.executiveSummary || rawNotes || "Revisión general de avances y compromisos."}

🎯 *COMPROMISOS & ACTIVIDADES REGISTRADAS:*
${actList}

${aiSummary?.criticalAgreements?.length ? `⚠️ *ACUERDOS CRÍTICOS:*\n${aiSummary.criticalAgreements.map((a: string) => `• ${a}`).join("\n")}` : ""}
`;

    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 3000);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Live Meeting Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-2xs">
              <Mic className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  className="text-base font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
              <p className="text-xs text-slate-500">
                Modo directo para minutar acuerdos y crear actividades con ID en tiempo real
              </p>
            </div>
          </div>

          {/* Meeting Stopwatch Controls */}
          <div className="flex items-center gap-3 bg-slate-900 text-white px-3.5 py-1.5 rounded-md shadow-2xs">
            <div className="flex flex-col items-end">
              <span className="text-[9px] uppercase font-semibold text-slate-400">Duración</span>
              <span className="font-mono text-base font-black text-emerald-400">
                {formatTimer(meetingSeconds)}
              </span>
            </div>

            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => setIsMeetingRunning(!isMeetingRunning)}
                className={`p-1.5 rounded text-white font-bold transition-all cursor-pointer ${
                  isMeetingRunning ? "bg-amber-600 hover:bg-amber-500" : "bg-emerald-600 hover:bg-emerald-500"
                }`}
                title={isMeetingRunning ? "Pausar reunión" : "Reanudar reunión"}
              >
                {isMeetingRunning ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              </button>

              <button
                onClick={() => setMeetingSeconds(0)}
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Reiniciar cronómetro"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Attendance Bar */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-700 mr-2 flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-blue-600" />
            Asistencia en Obra:
          </span>
          {members.map((member) => {
            const isPresent = attendees.includes(member.id);
            return (
              <button
                key={member.id}
                onClick={() => toggleAttendee(member.id)}
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                  isPresent
                    ? "bg-blue-50 text-blue-900 border-blue-300 font-semibold"
                    : "bg-slate-100 text-slate-400 border-slate-200 line-through opacity-70"
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full ${member.avatarColor} text-white text-[8px] font-bold flex items-center justify-center`}>
                  {member.initials}
                </div>
                <span>{member.name.split(" ")[0]}</span>
                {isPresent && <Check className="w-3 h-3 text-blue-600" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (7 cols): Rapid Activity Recorder Form */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-blue-600" />
                Registrar Nuevo Compromiso / Actividad
              </h3>
              <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                Próximo ID: {generateNextActivityId(activities)}
              </span>
            </div>

            <form onSubmit={handleCreateActivity} className="space-y-3">
              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descripción del Trabajo o Compromiso *
                </label>
                <textarea
                  required
                  rows={2}
                  disabled={!canEdit}
                  placeholder={canEdit ? "Ej: Resane y empaste de pretiles en azotea, coordinar entrega de impermeabilizante..." : "Modo solo lectura (Se requiere usuario Alejandro Tejeda)"}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className={`w-full border rounded-md px-3 py-1.5 text-xs focus:outline-none ${
                    canEdit 
                      ? "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-500" 
                      : "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                  }`}
                />
              </div>

              {/* Responsible Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Responsable Asignado *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {members.map((m) => {
                    const isSelected = newRespId === m.id;
                    return (
                      <button
                        type="button"
                        key={m.id}
                        disabled={!canEdit}
                        onClick={() => setNewRespId(m.id)}
                        className={`flex items-center gap-2 p-2 rounded-md text-left transition-all border ${
                          isSelected
                            ? "bg-blue-50 border-blue-400 text-blue-900 ring-1 ring-blue-400 font-semibold"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        } ${!canEdit ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                      >
                        <div className={`w-5 h-5 rounded-full ${m.avatarColor} text-white text-[9px] font-bold flex items-center justify-center shrink-0`}>
                          {m.initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs truncate">{m.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">{m.role.split(" ")[0]}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Due Date & Presets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fecha Límite Pactada *
                  </label>
                  <input
                    type="date"
                    required
                    disabled={!canEdit}
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className={`w-full border rounded-md px-3 py-1.5 text-xs focus:outline-none ${
                      canEdit 
                        ? "bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-blue-500" 
                        : "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                    }`}
                  />
                  {/* Presets */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setDatePreset(2)}
                      className={`text-[10px] px-2 py-0.5 rounded border ${
                        canEdit 
                          ? "bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200 cursor-pointer" 
                          : "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"
                      }`}
                    >
                      En 2 días
                    </button>
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setDatePreset(5)}
                      className={`text-[10px] px-2 py-0.5 rounded border ${
                        canEdit 
                          ? "bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200 cursor-pointer" 
                          : "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"
                      }`}
                    >
                      En 5 días
                    </button>
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setDatePreset(7)}
                      className={`text-[10px] px-2 py-0.5 rounded border ${
                        canEdit 
                          ? "bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200 cursor-pointer" 
                          : "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"
                      }`}
                    >
                      Próx. Reunión (7d)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fase & Disciplina
                  </label>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        aria-label="Fase de la actividad"
                        value={newPhase}
                        disabled={!canEdit}
                        onChange={(e) => setNewPhase(e.target.value)}
                        className={`w-full border rounded-md px-2.5 py-1 text-xs font-medium focus:outline-none ${
                          canEdit 
                            ? "bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-blue-500 cursor-pointer" 
                            : "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                        }`}
                      >
                        {availablePhases.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>

                      <select
                        aria-label="Disciplina de la actividad"
                        value={newStatus}
                        disabled={!canEdit}
                        onChange={(e) => setNewStatus(e.target.value as ActivityStatus)}
                        className={`w-full border rounded-md px-2.5 py-1 text-xs font-medium focus:outline-none ${
                          canEdit 
                            ? "bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-blue-500 cursor-pointer" 
                            : "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                        }`}
                      >
                        {availableDisciplines.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.icon} {d.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1">
                      {(["urgent", "high", "medium", "low"] as ActivityPriority[]).map((p) => (
                        <button
                          type="button"
                          key={p}
                          disabled={!canEdit}
                          onClick={() => setNewPriority(p)}
                          className={`flex-1 py-1 rounded text-[10px] font-bold uppercase transition-all border ${
                            newPriority === p
                              ? p === "urgent"
                                ? "bg-rose-50 text-rose-700 border-rose-300"
                                : p === "high"
                                ? "bg-blue-50 text-blue-700 border-blue-300"
                                : "bg-slate-100 text-slate-700 border-slate-300"
                              : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                          } ${!canEdit ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes / Special conditions */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notas / Observación del Acuerdo
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  placeholder={canEdit ? "Ej: Contratista se compromete a ingresar 4 oficiales extras el viernes." : "Sin notas"}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className={`w-full border rounded-md px-3 py-1.5 text-xs focus:outline-none ${
                    canEdit 
                      ? "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-500" 
                      : "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                  }`}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!canEdit}
                className={`w-full py-2 font-semibold rounded-md text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all ${
                  canEdit 
                    ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer" 
                    : "bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed opacity-75"
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>{canEdit ? "Guardar Actividad y Sincronizar en la Nube" : "Solo Lectura (Se requiere usuario Alejandro Tejeda)"}</span>
              </button>
            </form>
          </div>

          {/* Activities created in this session */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
            <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-2.5">
              Actividades Creadas en Esta Sesión ({sessionCreatedIds.length})
            </h4>

            {sessionCreatedIds.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">
                Aún no has registrado actividades en esta sesión. Llena el formulario arriba.
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                {activities
                  .filter((a) => sessionCreatedIds.includes(a.id))
                  .map((act) => (
                    <div
                      key={act.id}
                      className="bg-slate-50 border border-slate-200 p-2.5 rounded-md flex items-center justify-between gap-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-bold text-slate-700 bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[11px]">
                          {act.id}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{act.description}</p>
                          <p className="text-[10px] text-slate-500">
                            👤 {act.responsibleName} • 📅 {act.dueDate}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                        En la Nube
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Meeting Minutes Notes & AI Assistant */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-600" />
                Notas de la Reunión
              </h3>
              <button
                type="button"
                onClick={handleGuardarMinuta}
                disabled={isGeneratingAI || !canEdit}
                title={canEdit ? "Guardar la minuta de esta reunión" : "Solo el administrador puede guardar minutas"}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold rounded-md text-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>{isGeneratingAI ? "Guardando..." : "Guardar minuta"}</span>
              </button>
            </div>

            <textarea
              rows={8}
              placeholder="Apunta aquí temas tratados, reclamos de contratistas, retrasos por clima, autorizaciones de compras o acuerdos verbales..."
              value={rawNotes}
              onChange={(e) => setRawNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 leading-relaxed font-sans"
            />

            {/* AI Summary Card if generated */}
            {aiSummary && (
              <div className="bg-blue-50/50 border border-blue-200 rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-800 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    Resumen Ejecutivo Generado
                  </span>
                  <button
                    onClick={handleCopySummary}
                    className="flex items-center gap-1 text-[11px] text-blue-700 hover:text-blue-900 bg-white border border-blue-200 px-2 py-0.5 rounded cursor-pointer"
                  >
                    {copiedText ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedText ? "Copiado!" : "Copiar"}</span>
                  </button>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">
                  {aiSummary.executiveSummary}
                </p>

                {aiSummary.criticalAgreements?.length > 0 && (
                  <div className="pt-2 border-t border-blue-200">
                    <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block mb-1">
                      Acuerdos Críticos:
                    </span>
                    <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside">
                      {aiSummary.criticalAgreements.map((agr: string, idx: number) => (
                        <li key={idx}>{agr}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Quick Share to WhatsApp / Email */}
            <button
              onClick={handleCopySummary}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-semibold rounded-md text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedText ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">¡Copiado al Portapapeles!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 text-blue-600" />
                  <span>Copiar Minuta Completa para Compartir</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
