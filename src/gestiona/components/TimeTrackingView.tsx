import React, { useState, useMemo } from "react";
import { 
  Activity, 
  Member, 
  TimeLog, 
  Project 
} from "../types";
import { 
  Clock, 
  Play, 
  Pause, 
  Plus, 
  Calendar, 
  User, 
  Trash2, 
  BarChart2, 
  Timer, 
  CheckCircle2,
  FileText
} from "lucide-react";
import { canUserEdit } from "../lib/activityUtils";

interface TimeTrackingViewProps {
  activities: Activity[];
  members: Member[];
  currentMember: Member;
  timeLogs: TimeLog[];
  activeTimerActivity: Activity | null;
  timerElapsedSeconds: number;
  onToggleTimer: (activity: Activity) => void;
  onAddManualTimeLog: (log: TimeLog) => void;
}

export const TimeTrackingView: React.FC<TimeTrackingViewProps> = ({
  activities,
  members,
  currentMember,
  timeLogs,
  activeTimerActivity,
  timerElapsedSeconds,
  onToggleTimer,
  onAddManualTimeLog,
}) => {
  const canEdit = canUserEdit(currentMember);

  // Manual Log Form State
  const [selectedActId, setSelectedActId] = useState(activities[0]?.id || "");
  const [selectedMemberId, setSelectedMemberId] = useState(currentMember.id);
  const [hoursInput, setHoursInput] = useState("2.5");
  const [dateInput, setDateInput] = useState(new Date().toISOString().split("T")[0]);
  const [notesInput, setNotesInput] = useState("");

  const formatSeconds = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Stats
  const totalLoggedHours = useMemo(() => {
    const fromLogs = timeLogs.reduce((acc, log) => acc + (log.durationSeconds / 3600), 0);
    const fromActivities = activities.reduce((acc, act) => acc + (act.loggedHours || 0), 0);
    return Math.max(fromLogs, fromActivities);
  }, [timeLogs, activities]);

  const totalEstimatedHours = useMemo(() => {
    return activities.reduce((acc, act) => acc + (act.estimatedHours || 0), 0);
  }, [activities]);

  // Hours per member
  const hoursByMember = useMemo(() => {
    const map: Record<string, number> = {};
    members.forEach((m) => {
      map[m.name] = 0;
    });
    activities.forEach((act) => {
      const name = act.responsibleName || "Sin Asignar";
      map[name] = (map[name] || 0) + (act.loggedHours || 0);
    });
    return Object.entries(map).map(([name, hours]) => ({ name, hours: Number(hours.toFixed(1)) }));
  }, [activities, members]);

  // Handle Manual Log Submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    const act = activities.find((a) => a.id === selectedActId);
    const member = members.find((m) => m.id === selectedMemberId) || currentMember;
    const hours = parseFloat(hoursInput) || 0;

    if (!act || hours <= 0) return;

    const newLog: TimeLog = {
      id: `TLOG-${Date.now()}`,
      activityId: act.id,
      activityCode: act.id,
      activityDescription: act.description,
      memberId: member.id,
      memberName: member.name,
      durationSeconds: Math.round(hours * 3600),
      date: dateInput,
      notes: notesInput.trim() || "Registro manual de horas en obra.",
      createdAt: new Date().toISOString(),
    };

    onAddManualTimeLog(newLog);
    setNotesInput("");
    setHoursInput("1");
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 p-3.5 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Horas Registradas</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono mt-1.5">
            {totalLoggedHours.toFixed(1)}h
          </p>
          <span className="text-[11px] text-slate-500">Acumulado en actividades</span>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Horas Presupuestadas</span>
            <Timer className="w-4 h-4 text-slate-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono mt-1.5">
            {totalEstimatedHours.toFixed(1)}h
          </p>
          <span className="text-[11px] text-slate-500">Estimación de obra</span>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Ejecución del Tiempo</span>
            <BarChart2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-700 font-mono mt-1.5">
            {totalEstimatedHours > 0 ? ((totalLoggedHours / totalEstimatedHours) * 100).toFixed(0) : 0}%
          </p>
          <span className="text-[11px] text-slate-500">Ratio real vs planificado</span>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Cronómetro en Vivo</span>
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${activeTimerActivity ? 'bg-amber-400' : 'bg-slate-300'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${activeTimerActivity ? 'bg-amber-500' : 'bg-slate-400'}`}></span>
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono mt-1.5">
            {formatSeconds(timerElapsedSeconds)}
          </p>
          <span className="text-[11px] text-slate-500 truncate block">
            {activeTimerActivity ? `Activa: ${activeTimerActivity.id}` : "Sin temporizador activo"}
          </span>
        </div>
      </div>

      {/* Main 2 Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Col (7 cols): Active Live Timer & Activity Quick Start */}
        <div className="lg:col-span-7 space-y-4">
          {/* Active Live Stopwatch Box */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Timer className="w-4 h-4 text-blue-600" />
                Cronómetro en Tiempo Real para Obra
              </h3>
              {activeTimerActivity && (
                <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full animate-pulse">
                  Grabando en Vivo
                </span>
              )}
            </div>

            {activeTimerActivity ? (
              <div className="bg-amber-50/40 border border-amber-200 rounded-md p-4 text-center space-y-3">
                <span className="font-mono text-xs font-bold text-amber-900 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded">
                  {activeTimerActivity.id}
                </span>
                <h4 className="text-xs font-semibold text-slate-800">
                  {activeTimerActivity.description}
                </h4>
                <div className="font-mono text-3xl font-black text-slate-900 tracking-wider">
                  {formatSeconds(timerElapsedSeconds)}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => canEdit && onToggleTimer(activeTimerActivity)}
                    disabled={!canEdit}
                    className={`flex items-center gap-1.5 px-4 py-2 font-bold rounded-md text-xs transition-colors shadow-xs ${
                      canEdit 
                        ? "bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer" 
                        : "bg-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                    }`}
                  >
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>{canEdit ? "Pausar y Registrar Horas" : "Cronómetro Bloqueado (Solo Lectura)"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-md p-5 text-center space-y-2">
                <Clock className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-500">
                  {canEdit ? "No hay cronómetro activo. Inicia el tiempo en cualquier actividad de la lista abajo." : "Modo solo lectura. Se requiere el usuario Alejandro Tejeda para registrar tiempos."}
                </p>
              </div>
            )}

            {/* Quick Timer Selector from list */}
            <div className="mt-4 space-y-1.5">
              <h4 className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                Iniciar Tiempo en Actividades
              </h4>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                {activities
                  .map((act) => {
                    const isCurrent = activeTimerActivity?.id === act.id;
                    return (
                      <div
                        key={act.id}
                        className={`flex items-center justify-between p-2 rounded-md border text-xs transition-all ${
                          isCurrent
                            ? "bg-amber-50/60 border-amber-300"
                            : "bg-slate-50 hover:bg-white border-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono font-bold text-slate-800 bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[11px]">
                            {act.id}
                          </span>
                          <span className="font-medium text-slate-700 truncate max-w-[240px]">
                            {act.description}
                          </span>
                        </div>

                        <button
                          onClick={() => canEdit && onToggleTimer(act)}
                          disabled={!canEdit}
                          title={canEdit ? (isCurrent ? "Detener" : "Iniciar") : "Solo lectura (Se requiere usuario Alejandro Tejeda)"}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-all border ${
                            isCurrent
                              ? canEdit 
                                ? "bg-amber-500 border-amber-600 text-slate-950 shadow-xs cursor-pointer" 
                                : "bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed"
                              : canEdit 
                                ? "bg-white hover:bg-slate-100 border-slate-200 text-slate-700 cursor-pointer" 
                                : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                          }`}
                        >
                          {isCurrent ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 text-blue-600" />}
                          <span>{isCurrent ? "Detener" : "Iniciar"}</span>
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Col (5 cols): Manual Log Form & Hours by Member */}
        <div className="lg:col-span-5 space-y-4">
          {/* Manual Entry Form */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-3">
              <Plus className="w-4 h-4 text-blue-600" />
              Cargar Horas Manualmente
            </h3>

            <form onSubmit={handleManualSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Actividad de Obra *
                </label>
                <select
                  value={selectedActId}
                  disabled={!canEdit}
                  onChange={(e) => setSelectedActId(e.target.value)}
                  className={`w-full border rounded-md px-2.5 py-1.5 focus:outline-none ${
                    canEdit 
                      ? "bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-blue-500 cursor-pointer" 
                      : "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  {activities.map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.id}] {a.description.substring(0, 40)}...
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Responsable
                  </label>
                  <select
                    value={selectedMemberId}
                    disabled={!canEdit}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    className={`w-full border rounded-md px-2.5 py-1.5 focus:outline-none ${
                      canEdit 
                        ? "bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-blue-500 cursor-pointer" 
                        : "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                    }`}
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Horas Dedicadas (h)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.1"
                    disabled={!canEdit}
                    value={hoursInput}
                    onChange={(e) => setHoursInput(e.target.value)}
                    className={`w-full border rounded-md px-2.5 py-1.5 font-mono focus:outline-none ${
                      canEdit 
                        ? "bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-blue-500" 
                        : "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Fecha del Trabajo
                </label>
                <input
                  type="date"
                  disabled={!canEdit}
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  className={`w-full border rounded-md px-2.5 py-1.5 focus:outline-none ${
                    canEdit 
                      ? "bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-blue-500 cursor-pointer" 
                      : "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                  }`}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Detalle / Nota del Trabajo
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  placeholder={canEdit ? "Ej: Supervisión de colado de losa y prueba de revenimiento." : "Sin notas"}
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  className={`w-full border rounded-md px-2.5 py-1.5 focus:outline-none ${
                    canEdit 
                      ? "bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500" 
                      : "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                  }`}
                />
              </div>

              <button
                type="submit"
                disabled={!canEdit}
                className={`w-full py-2 font-bold rounded-md text-xs transition-colors shadow-xs ${
                  canEdit 
                    ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer" 
                    : "bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed opacity-75"
                }`}
              >
                {canEdit ? "Registrar Horas en Firestore" : "Solo Lectura (Se requiere usuario Alejandro Tejeda)"}
              </button>
            </form>
          </div>

          {/* Hours by Member List */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
            <h4 className="text-[11px] font-bold uppercase text-slate-500 tracking-wider mb-2.5">
              Distribución de Horas por Responsable
            </h4>
            <div className="space-y-2.5 text-xs">
              {hoursByMember.map(({ name, hours }) => {
                const percent = totalLoggedHours > 0 ? (hours / totalLoggedHours) * 100 : 0;
                return (
                  <div key={name} className="space-y-1">
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="font-semibold">{name}</span>
                      <span className="font-mono font-bold text-slate-900">{hours}h ({percent.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, percent)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
