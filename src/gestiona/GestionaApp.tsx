import React, { useState, useEffect, useRef } from "react";
import { 
  COLLECTIONS, 
  cargarTodo,
  alCambiar,
  setPuedeEscribir,
  saveActivityToCloud, 
  deleteActivityFromCloud, 
  saveMemberToCloud, 
  deleteMemberFromCloud, 
  permanentlyPurgeMembersFromCloud,
  saveProjectToCloud, 
  saveTimeLogToCloud, 
  saveNotificationToCloud, 
  saveMeetingToCloud,
  markNotificationAsRead,
  deleteNotificationFromCloud,
  clearAllNotificationsFromCloud,
  type DatosGestiona
} from "./lib/nube";
import { 
  Activity, 
  Member, 
  Project, 
  TimeLog, 
  NotificationItem, 
  MeetingSession, 
  ActivityStatus,
  WorkspaceType,
  WORKSPACES
} from "./types";
import { 
  INITIAL_PROJECT, 
  INITIAL_MEMBERS, 
  INITIAL_ACTIVITIES,
  NO_USER_MEMBER 
} from "./lib/initialData";
import { generateNextActivityId, canUserEdit, filterMembersByWorkspace, isTomasOrCarlosMember, isSpecialistMember } from "./lib/activityUtils";
import { 
  dispatchCustomNotification, 
  requestPushNotificationPermission, 
  playNotificationChime 
} from "./lib/notifications";
import { Header } from "./components/Header";
import { KanbanBoard } from "./components/KanbanBoard";
import { TableView } from "./components/TableView";
import { LiveMeetingMode } from "./components/LiveMeetingMode";
import { TimeTrackingView } from "./components/TimeTrackingView";
import { ProductivityReports } from "./components/ProductivityReports";
import { CalendarTimelineView } from "./components/CalendarTimelineView";
import { ActivityDetailModal } from "./components/ActivityDetailModal";
import { MemberManagementModal } from "./components/MemberManagementModal";
import { NotificationsCenter } from "./components/NotificationsCenter";
import { SendEmailModal } from "./components/SendEmailModal";

const DELETED_MEMBERS_STORAGE_KEY = "obraplan_deleted_member_ids_v1";

const KNOWN_PURGED_MEMBERS: { id: string; name: string }[] = [
  { id: "MEM-02", name: "Ing. Carlos Mendoza" },
  { id: "MEM-03", name: "Arq. Laura Peña" },
  { id: "MEM-04", name: "Mtro. Javier Ruiz" },
  { id: "MEM-05", name: "Ing. Sofia Valenzuela" },
  { id: "MEM-C02", name: "Ing. Carlos Mendoza" },
  { id: "MEM-C03", name: "Arq. Laura Peña" },
  { id: "MEM-C04", name: "Especialista" },
  { id: "MEM-C05", name: "Mtro. Javier Ruiz" },
  { id: "MEM-C06", name: "Ing. Sofia Valenzuela" },
];

const KNOWN_PURGED_NAMES_SET = new Set([
  "ing. carlos mendoza",
  "carlos mendoza",
  "arq. laura peña",
  "laura peña",
  "laura pena",
  "mtro. javier ruiz",
  "javier ruiz",
  "ing. sofia valenzuela",
  "sofia valenzuela",
]);

function getDeletedMemberIds(): Set<string> {
  const set = new Set<string>([
    "MEM-02", "MEM-03", "MEM-04", "MEM-05",
    "MEM-C02", "MEM-C03", "MEM-C04", "MEM-C05", "MEM-C06"
  ]);
  try {
    const raw = localStorage.getItem(DELETED_MEMBERS_STORAGE_KEY);
    if (raw) {
      const parsed: string[] = JSON.parse(raw);
      parsed.forEach((id) => set.add(id));
    }
  } catch {
    // ignore
  }
  return set;
}

function recordDeletedMemberId(id: string) {
  try {
    const set = getDeletedMemberIds();
    set.add(id);
    localStorage.setItem(DELETED_MEMBERS_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

function isMemberPurged(member: { id?: string; name?: string }, extraDeletedIds?: Set<string>): boolean {
  if (member.id && (extraDeletedIds?.has(member.id) || getDeletedMemberIds().has(member.id))) {
    return true;
  }
  if (member.name) {
    const norm = member.name.toLowerCase().trim();
    if (KNOWN_PURGED_NAMES_SET.has(norm)) {
      return true;
    }
  }
  return false;
}

export default function GestionaApp({ esAdmin }: { esAdmin: boolean }) {
  // En Trakciona solo el admin escribe; se fija antes de que las vistas consulten canUserEdit
  setPuedeEscribir(esAdmin);

  // State
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceType>('equipos');
  const [currentView, setCurrentView] = useState<'kanban' | 'table' | 'meeting' | 'time' | 'reports' | 'calendar'>('kanban');
  const [project, setProject] = useState<Project>(INITIAL_PROJECT);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentMember, setCurrentMember] = useState<Member>(() => {
    try {
      const savedId = localStorage.getItem("obraplan_active_user_id");
      if (savedId && savedId !== "no-user") {
        const found = INITIAL_MEMBERS.find((m) => m.id === savedId);
        if (found) return found;
      } else if (savedId === "no-user") {
        return NO_USER_MEMBER;
      }
    } catch (e) {
      console.warn("Could not read saved user:", e);
    }
    return NO_USER_MEMBER;
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isActivitiesLoaded, setIsActivitiesLoaded] = useState<boolean>(false);
  const [isMembersLoaded, setIsMembersLoaded] = useState<boolean>(false);
  
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(() => {
    return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default";
  });

  // Modal states
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  // Active Timer state
  const [activeTimerActivityId, setActiveTimerActivityId] = useState<string | null>(null);
  const [timerElapsedSeconds, setTimerElapsedSeconds] = useState(0);
  const timerRef = useRef<any>(null);

  // 1. Datos desde Trakciona (D1): se leen al abrir, cada 15 s y después de cada cambio
  const [datosVacios, setDatosVacios] = useState(false);
  const [ultimaLectura, setUltimaLectura] = useState<Date | null>(null);
  const purgaHecha = useRef(false);

  const aplicarDatos = React.useCallback((d: DatosGestiona) => {
    // Bajas registradas (equivalen a deleted_members de Firestore)
    (d.deleted_members || []).forEach((data: any) => {
      if (data?.id) recordDeletedMemberId(data.id);
      if (data?.name) KNOWN_PURGED_NAMES_SET.add(String(data.name).toLowerCase().trim());
    });

    // Proyecto
    const proj = (d.projects || [])[0] as Project | undefined;
    if (proj) {
      const fases = proj.phases || [];
      if (!fases.includes("Flete")) {
        const updated = { ...proj, phases: [...fases, "Flete"] };
        saveProjectToCloud(updated);
        setProject(updated);
      } else {
        setProject(proj);
      }
    }

    // Actividades
    const list: Activity[] = (d.activities || []).map((a: Activity) => ({ ...a }));
    list.sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
      if (a.order !== undefined) return -1;
      if (b.order !== undefined) return 1;
      return a.id.localeCompare(b.id);
    });
    const memberMapping: Record<string, { id: string; name: string }> = {
      "MEM-C02": { id: "MEM-02", name: "Ing. Carlos Mendoza" },
      "MEM-C03": { id: "MEM-03", name: "Arq. Laura Peña" },
      "MEM-C04": { id: "MEM-01", name: "Alejandro Tejeda" },
      "MEM-C05": { id: "MEM-04", name: "Mtro. Javier Ruiz" },
      "MEM-C06": { id: "MEM-05", name: "Ing. Sofia Valenzuela" },
    };
    list.forEach((act) => {
      let changed = false;
      if (act.phase === "Obras Preliminares" || act.phase === "Obras preliminares") { act.phase = "Obras Enterradas"; changed = true; }
      else if (act.phase === "Montaje e Instalación" || act.phase === "Montaje e Instalacion") { act.phase = "Tuberias Principales"; changed = true; }
      else if (act.phase === "Pruebas y Puesta en Marcha" || act.phase === "Pruebas y puesta en marcha") { act.phase = "Montajes & Equipos"; changed = true; }
      else if (act.phase === "Cimentaciones y Estructura" || act.phase === "Cimentaciones y estructura" || act.phase === "Cimentaciones") { act.phase = "Hormigonados"; changed = true; }
      if ((act.workspace === 'construccion' || (act.id && act.id.startsWith('CST-'))) && act.workspace !== 'construccion') {
        act.workspace = 'construccion'; changed = true;
      }
      if (act.workspace === 'construccion') {
        const legacy: Record<string, ActivityStatus> = {
          civil: 'obra_civil', mecanico: 'montaje_mecanico', electrico: 'instalacion_electrica',
          hidraulica: 'hidraulica_piping', seguridad: 'seguridad_calidad',
        };
        if (legacy[act.status]) { act.status = legacy[act.status]; changed = true; }
      }
      if (act.responsibleId && memberMapping[act.responsibleId]) {
        const mapped = memberMapping[act.responsibleId];
        act.responsibleId = mapped.id; act.responsibleName = mapped.name; changed = true;
      }
      if (changed) saveActivityToCloud(act);
    });
    setActivities(list);

    // Miembros (sin los dados de baja)
    const deletedIds = getDeletedMemberIds();
    const mems: Member[] = (d.members || []).filter((m: Member) => m && !isMemberPurged(m, deletedIds) && !(m.id || '').startsWith("MEM-C"));
    setMembers(mems);
    const savedId = localStorage.getItem("obraplan_active_user_id");
    if (savedId && savedId !== "no-user") {
      const matched = mems.find((m) => m.id === savedId);
      if (matched) setCurrentMember(matched);
    } else if (!savedId && mems.length > 0) {
      setCurrentMember(mems.find((m) => m.email === "alejandrotm91@gmail.com") || mems[0]);
    }

    // Notificaciones y tiempos
    const notifs: NotificationItem[] = [...(d.notifications || [])];
    notifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setNotifications(notifs);
    const logs: TimeLog[] = [...(d.time_logs || [])];
    logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setTimeLogs(logs);

    setDatosVacios(list.length === 0 && mems.length === 0);
    setIsActivitiesLoaded(true);
    setIsMembersLoaded(true);
    setIsCloudSynced(true);
    setUltimaLectura(new Date());

    if (!purgaHecha.current) {
      purgaHecha.current = true;
      permanentlyPurgeMembersFromCloud(KNOWN_PURGED_MEMBERS);
    }
  }, []);

  const recargar = React.useCallback(async () => {
    try {
      aplicarDatos(await cargarTodo());
    } catch (e) {
      console.warn("Gestiona: no se pudieron leer los datos:", e);
      setIsCloudSynced(false);
      setIsActivitiesLoaded(true);
      setIsMembersLoaded(true);
    }
  }, [aplicarDatos]);

  useEffect(() => {
    recargar();
    const quitar = alCambiar(recargar);
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === 'visible') recargar();
    }, 15000);
    return () => { quitar(); window.clearInterval(intervalo); };
  }, [recargar]);

  // 2. Active Stopwatch Timer tick
  useEffect(() => {
    if (activeTimerActivityId) {
      timerRef.current = setInterval(() => {
        setTimerElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeTimerActivityId]);

  // Push Permission Handler
  const handleRequestPushPermission = async () => {
    const perm = await requestPushNotificationPermission();
    setPushPermission(perm);
    if (perm === "granted") {
      dispatchCustomNotification(
        "🔔 Notificaciones Habilitadas",
        "Recibirás alertas personalizadas de actividades y reuniones de obra.",
        "Sistema ObraPlan",
        "general",
        currentMember.id
      );
    }
  };

  // Toggle Timer on an Activity
  const handleToggleTimer = (activity: Activity) => {
    if (!canUserEdit(currentMember)) return;
    if (activeTimerActivityId === activity.id) {
      // Pause timer
      const updatedActivity: Activity = {
        ...activity,
        isTimerRunning: false,
        timerStartedAt: null,
        activeTimerUserId: null,
        updatedAt: new Date().toISOString(),
      };

      // Create a time log entry
      if (timerElapsedSeconds > 5) {
        const newTimeLog: TimeLog = {
          id: `TLOG-${Date.now()}`,
          activityId: activity.id,
          activityCode: activity.id,
          activityDescription: activity.description,
          memberId: currentMember.id,
          memberName: currentMember.name,
          durationSeconds: timerElapsedSeconds,
          date: new Date().toISOString().split("T")[0],
          notes: `Sesión de cronómetro en vivo (${Math.round(timerElapsedSeconds / 60)} min)`,
          createdAt: new Date().toISOString(),
        };
        saveTimeLogToCloud(newTimeLog);
      }

      saveActivityToCloud(updatedActivity);
      setActiveTimerActivityId(null);
      setTimerElapsedSeconds(0);
      playNotificationChime();
    } else {
      // If another timer was running, flush it first
      if (activeTimerActivityId) {
        const prevAct = activities.find((a) => a.id === activeTimerActivityId);
        if (prevAct) {
          const hoursToAdd = timerElapsedSeconds / 3600;
          const updatedLogged = Number(((prevAct.loggedHours || 0) + hoursToAdd).toFixed(2));
          saveActivityToCloud({
            ...prevAct,
            loggedHours: updatedLogged,
            isTimerRunning: false,
            timerStartedAt: null,
            activeTimerUserId: null,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      // Start new timer
      setActiveTimerActivityId(activity.id);
      setTimerElapsedSeconds(0);
      saveActivityToCloud({
        ...activity,
        isTimerRunning: true,
        timerStartedAt: Date.now(),
        activeTimerUserId: currentMember.id,
        updatedAt: new Date().toISOString(),
      });
      playNotificationChime();
    }
  };

  // Activity Updates (Save to Firestore & Local)
  const handleUpdateActivity = async (updated: Activity) => {
    if (!canUserEdit(currentMember)) return;

    // Check if status changed
    const previous = activities.find((a) => a.id === updated.id);
    if (previous && previous.status !== updated.status) {
      try {
        dispatchCustomNotification(
          `Disciplina Actualizada: ${updated.id}`,
          `${currentMember.name} cambió la disciplina a "${updated.status}" en "${updated.description}"`,
          currentMember.name,
          "status_change",
          updated.responsibleId,
          updated.id,
          updated.id
        );
      } catch (e) {
        console.warn("Could not dispatch notification:", e);
      }
    }

    setActivities((prev) =>
      prev.some((a) => a.id === updated.id)
        ? prev.map((a) => (a.id === updated.id ? updated : a))
        : [...prev, updated]
    );

    try {
      await saveActivityToCloud(updated);
    } catch (err) {
      console.warn("Could not sync activity to cloud immediately, saved locally:", err);
    }
  };

  // Reorder Activities (Move within same container or across containers)
  const handleReorderActivities = async (reorderedWorkspaceActivities: Activity[]) => {
    if (!canUserEdit(currentMember)) return;

    // Assign sequential order indices to workspace activities
    const updatedWithOrder = reorderedWorkspaceActivities.map((act, index) => ({
      ...act,
      order: index,
    }));

    setActivities((prev) => {
      const otherWsActivities = prev.filter(
        (a) => (a.workspace || "equipos") !== currentWorkspace
      );
      return [...otherWsActivities, ...updatedWithOrder];
    });

    // Save modified activities to Firestore
    for (const act of updatedWithOrder) {
      const prevAct = activities.find((a) => a.id === act.id);
      if (!prevAct || prevAct.order !== act.order || prevAct.phase !== act.phase) {
        saveActivityToCloud(act);
      }
    }
  };

  // Delete Activity
  const handleDeleteActivity = async (activityId: string) => {
    if (!canUserEdit(currentMember)) return;
    setActivities((prev) => prev.filter((a) => a.id !== activityId));
    if (activeTimerActivityId === activityId) {
      setActiveTimerActivityId(null);
      setTimerElapsedSeconds(0);
    }
    await deleteActivityFromCloud(activityId);
  };

  // Open New Activity Modal
  const handleOpenNewActivity = (initialStatus?: ActivityStatus, initialPhase?: string) => {
    if (!canUserEdit(currentMember)) return;

    const activeWsConfig = WORKSPACES[currentWorkspace] || WORKSPACES.equipos;
    const prefix = activeWsConfig.codePrefix || "ACT";
    const nextCode = generateNextActivityId(activities, prefix);
    const today = new Date().toISOString().split("T")[0];
    const defaultDue = new Date(Date.now() + 86400000 * 5).toISOString().split("T")[0];

    const defaultStatus = initialStatus || (activeWsConfig.disciplines[0]?.id as ActivityStatus) || 'electrico';
    const defaultPhase = initialPhase || activeWsConfig.phases[0] || "Ingenieria";

    const wsMembers = filterMembersByWorkspace(members, currentWorkspace);
    const defaultResponsible = 
      wsMembers.find((m) => m.id === currentMember.id) || 
      wsMembers[0] || 
      currentMember;

    const newAct: Activity = {
      id: nextCode,
      projectId: project.id,
      workspace: currentWorkspace,
      description: "",
      dueDate: defaultDue,
      startDate: today,
      responsibleId: defaultResponsible.id,
      responsibleName: defaultResponsible.name,
      status: defaultStatus,
      priority: "high",
      phase: defaultPhase,
      subtasks: [],
      meetingNotes: `Registrado en reunión de ${(activeWsConfig.shortLabel || activeWsConfig.name || "obra").toLowerCase()}.`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSelectedActivity(newAct);
    setIsDetailModalOpen(true);
  };

  // Select activity to view details
  const handleSelectActivity = (activity: Activity) => {
    setSelectedActivity(activity);
    setIsDetailModalOpen(true);
  };

  // Add Member
  const handleAddMember = async (newMember: Member) => {
    setMembers((prev) => [...prev, newMember]);
    await saveMemberToCloud(newMember);
  };

  // Update Member
  const handleUpdateMember = async (updatedMember: Member) => {
    setMembers((prev) => prev.map((m) => (m.id === updatedMember.id ? updatedMember : m)));
    if (currentMember.id === updatedMember.id) {
      setCurrentMember(updatedMember);
    }
    setActivities((prev) =>
      prev.map((a) =>
        a.responsibleId === updatedMember.id
          ? { ...a, responsibleName: updatedMember.name }
          : a
      )
    );
    await saveMemberToCloud(updatedMember);
    dispatchCustomNotification(
      "👤 Miembro Actualizado",
      `Se actualizaron los datos de ${updatedMember.name} (${updatedMember.email || updatedMember.role}).`,
      currentMember.name,
      "general"
    );
  };

  // Delete Member
  const handleDeleteMember = async (memberId: string) => {
    recordDeletedMemberId(memberId);
    const deletedMember = members.find((m) => m.id === memberId);

    // Unassign tasks assigned to this member both in local state and Firestore
    setActivities((prev) => {
      const updated = prev.map((a) => {
        if (a.responsibleId === memberId) {
          const unassigned: Activity = {
            ...a,
            responsibleId: "",
            responsibleName: "Sin asignar",
          };
          saveActivityToCloud(unassigned);
          return unassigned;
        }
        return a;
      });
      return updated;
    });

    setMembers((prev) => {
      const remaining = prev.filter((m) => m.id !== memberId);
      if (currentMember.id === memberId) {
        setCurrentMember(remaining.length > 0 ? remaining[0] : NO_USER_MEMBER);
      }
      return remaining;
    });

    if (deletedMember) {
      dispatchCustomNotification(
        "👤 Miembro Eliminado",
        `Se eliminó a ${deletedMember.name} (${deletedMember.role}) del equipo de obra.`,
        "Sistema ObraPlan",
        "general"
      );
    }

    try {
      await deleteMemberFromCloud(memberId, deletedMember?.name);
    } catch (err) {
      console.warn("Error deleting member from Firestore:", err);
    }
  };

  // Send Direct Alert to Member
  const handleSendMemberAlert = (member: Member, activity: Activity) => {
    dispatchCustomNotification(
      `⚠️ Recordatorio de Actividad [${activity.id}]`,
      `Estimado ${member.name}, tienes asignada la entrega de "${activity.description}" para el ${activity.dueDate}.`,
      currentMember.name,
      "due_alert",
      member.id,
      activity.id,
      activity.id
    );
  };

  // Send Custom Notification
  const handleSendCustomNotification = async (
    title: string, 
    message: string, 
    targetMemberId?: string,
    type: NotificationItem['type'] = 'general'
  ) => {
    await dispatchCustomNotification(
      title,
      message,
      currentMember.name,
      type,
      targetMemberId
    );
  };

  // Add Manual Time Log
  const handleAddManualTimeLog = async (log: TimeLog) => {
    setTimeLogs((prev) => [log, ...prev]);
    await saveTimeLogToCloud(log);

    // Also update activity logged hours
    const act = activities.find((a) => a.id === log.activityId);
    if (act) {
      const addedHours = Number((log.durationSeconds / 3600).toFixed(2));
      const updatedAct: Activity = {
        ...act,
        loggedHours: Number(((act.loggedHours || 0) + addedHours).toFixed(2)),
        updatedAt: new Date().toISOString(),
      };
      await saveActivityToCloud(updatedAct);
    }
  };

  // Save Meeting Session
  const handleSaveMeetingSession = async (session: MeetingSession) => {
    await saveMeetingToCloud(session);
    dispatchCustomNotification(
      `📋 Nueva Minuta: ${session.title}`,
      `Se registraron ${session.createdActivityIds.length} actividades y acuerdos de reunión.`,
      currentMember.name,
      "meeting"
    );
  };

  // Mark notification read
  const handleMarkNotifRead = async (notifId: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === notifId ? { ...n, read: true } : n)));
    try {
      await markNotificationAsRead(notifId);
    } catch (err) {
      console.warn("Error marking notification as read:", err);
    }
  };

  // Mark all notifications as read
  const handleMarkAllNotifsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await Promise.all(unreadIds.map((id) => markNotificationAsRead(id)));
    } catch (err) {
      console.warn("Error marking all notifications as read:", err);
    }
  };

  // Delete individual notification
  const handleDeleteNotification = async (notifId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    try {
      await deleteNotificationFromCloud(notifId);
    } catch (err) {
      console.warn("Error deleting notification:", err);
    }
  };

  // Clear all notifications or a specific subset (e.g. read ones)
  const handleClearAllNotifications = async (idsToDelete?: string[]) => {
    const ids = idsToDelete && idsToDelete.length > 0 ? idsToDelete : notifications.map((n) => n.id);
    if (ids.length === 0) return;
    const idsSet = new Set(ids);
    setNotifications((prev) => prev.filter((n) => !idsSet.has(n.id)));
    try {
      await clearAllNotificationsFromCloud(ids);
    } catch (err) {
      console.warn("Error clearing notifications:", err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const activeTimerActivity = activities.find((a) => a.id === activeTimerActivityId) || null;

  // Workspace-filtered activities and members
  const workspaceActivities = React.useMemo(() => {
    return activities.filter((a) => (a.workspace || 'equipos') === currentWorkspace);
  }, [activities, currentWorkspace]);

  const workspaceMembers = React.useMemo(() => {
    return filterMembersByWorkspace(members, currentWorkspace);
  }, [members, currentWorkspace]);

  const activeWorkspaceConfig = WORKSPACES[currentWorkspace] || WORKSPACES.equipos;

  const equiposCount = React.useMemo(() => {
    return activities.filter((a) => (a.workspace || 'equipos') === 'equipos').length;
  }, [activities]);

  const construccionCount = React.useMemo(() => {
    return activities.filter((a) => a.workspace === 'construccion').length;
  }, [activities]);

  const handleSelectCurrentMember = (member: Member) => {
    setCurrentMember(member);
    try {
      localStorage.setItem("obraplan_active_user_id", member.id);
    } catch (e) {
      console.warn("Could not persist active user:", e);
    }
  };

  return (
    <div className="gestiona-app bg-slate-100 text-slate-900 flex flex-col font-sans rounded-xl border border-[#D5DEE2] overflow-hidden">
      {/* Barra de Trakciona: estado de sincronización, permisos e importación */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-1.5 bg-white border-b border-[#D5DEE2] text-[11px] text-[#5A6A74]">
        <span>
          {esAdmin ? 'Edición habilitada (admin)' : 'Modo consulta: solo el admin puede modificar'}
          {ultimaLectura && <> · actualizado {ultimaLectura.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</>}
        </span>
      </div>
      {datosVacios && (
        <div className="m-4 p-4 rounded-xl border border-dashed border-[#C7CBEF] bg-white text-sm text-[#14212A]">
          Gestiona todavía no tiene actividades.
        </div>
      )}
      {/* Top Application Header */}
      <Header
        currentView={currentView}
        onSelectView={setCurrentView}
        currentWorkspace={currentWorkspace}
        onSelectWorkspace={setCurrentWorkspace}
        equiposCount={equiposCount}
        construccionCount={construccionCount}
        project={project}
        members={workspaceMembers}
        allMembers={members}
        currentMember={currentMember}
        onSelectCurrentMember={handleSelectCurrentMember}
        onOpenNewActivity={() => handleOpenNewActivity()}
        onOpenMembersModal={() => setIsMembersModalOpen(true)}
        onOpenNotifications={() => setIsNotificationsModalOpen(true)}
        onOpenEmailModal={() => setIsEmailModalOpen(true)}
        unreadNotificationsCount={unreadCount}
        activeTimerActivity={activeTimerActivity}
        timerElapsedSeconds={timerElapsedSeconds}
        onStopTimer={() => activeTimerActivity && handleToggleTimer(activeTimerActivity)}
        isCloudSynced={isCloudSynced}
        pushPermission={pushPermission}
        onRequestPushPermission={handleRequestPushPermission}
      />

      {/* Main Workspace Canvas */}
      <main className={`flex-1 p-3 sm:p-4 lg:p-6 w-full mx-auto overflow-x-auto no-scrollbar-x bg-slate-100 transition-all duration-200 ${
        currentWorkspace === 'construccion'
          ? "max-w-[1850px]"
          : "max-w-7xl"
      }`}>
        {currentView === 'kanban' && (
          <KanbanBoard
            activities={workspaceActivities}
            members={workspaceMembers}
            currentMember={currentMember}
            project={project}
            currentWorkspace={currentWorkspace}
            phases={activeWorkspaceConfig.phases}
            disciplines={activeWorkspaceConfig.disciplines}
            onUpdateActivity={handleUpdateActivity}
            onReorderActivities={handleReorderActivities}
            onSelectActivity={handleSelectActivity}
            onOpenNewActivityWithPhase={(phase) => handleOpenNewActivity(undefined, phase)}
            onOpenNewActivityWithStatus={(status) => handleOpenNewActivity(status)}
            onToggleTimer={handleToggleTimer}
            activeTimerActivityId={activeTimerActivityId}
          />
        )}

        {currentView === 'table' && (
          <TableView
            activities={workspaceActivities}
            members={workspaceMembers}
            currentMember={currentMember}
            currentWorkspace={currentWorkspace}
            phases={activeWorkspaceConfig.phases}
            disciplines={activeWorkspaceConfig.disciplines}
            onUpdateActivity={handleUpdateActivity}
            onDeleteActivity={handleDeleteActivity}
            onSelectActivity={handleSelectActivity}
            onOpenNewActivity={() => handleOpenNewActivity()}
            onToggleTimer={handleToggleTimer}
            activeTimerActivityId={activeTimerActivityId}
          />
        )}

        {currentView === 'meeting' && (
          <LiveMeetingMode
            project={project}
            members={workspaceMembers}
            currentMember={currentMember}
            activities={workspaceActivities}
            phases={activeWorkspaceConfig.phases}
            disciplines={activeWorkspaceConfig.disciplines}
            onAddActivity={handleUpdateActivity}
            onSaveMeetingSession={handleSaveMeetingSession}
          />
        )}

        {currentView === 'time' && (
          <TimeTrackingView
            activities={workspaceActivities}
            members={workspaceMembers}
            currentMember={currentMember}
            timeLogs={timeLogs}
            activeTimerActivity={activeTimerActivity}
            timerElapsedSeconds={timerElapsedSeconds}
            onToggleTimer={handleToggleTimer}
            onAddManualTimeLog={handleAddManualTimeLog}
          />
        )}

        {currentView === 'reports' && (
          <ProductivityReports
            project={project}
            activities={workspaceActivities}
            members={workspaceMembers}
            timeLogs={timeLogs}
            currentWorkspace={currentWorkspace}
            isLoading={!isActivitiesLoaded || !isMembersLoaded}
          />
        )}

        {currentView === 'calendar' && (
          <CalendarTimelineView
            activities={workspaceActivities}
            members={workspaceMembers}
            onSelectActivity={handleSelectActivity}
          />
        )}
      </main>

      {/* Modals & Drawers */}
      <ActivityDetailModal
        activity={selectedActivity}
        activities={activities}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedActivity(null);
        }}
        onSave={handleUpdateActivity}
        onDelete={handleDeleteActivity}
        members={workspaceMembers}
        allMembers={members}
        project={project}
        currentWorkspace={currentWorkspace}
        phases={activeWorkspaceConfig.phases}
        disciplines={activeWorkspaceConfig.disciplines}
        currentMember={currentMember}
        onSendMemberAlert={handleSendMemberAlert}
      />

      <MemberManagementModal
        isOpen={isMembersModalOpen}
        onClose={() => setIsMembersModalOpen(false)}
        members={workspaceMembers}
        allMembers={members}
        activities={activities}
        currentWorkspace={currentWorkspace}
        onAddMember={handleAddMember}
        onUpdateMember={handleUpdateMember}
        onDeleteMember={handleDeleteMember}
        onSendTestNotification={(member) => {
          dispatchCustomNotification(
            `🔔 Notificación de Prueba para ${member.name}`,
            `Las notificaciones push para ${member.role} están configuradas correctamente.`,
            currentMember.name,
            "general",
            member.id
          );
        }}
      />

      <NotificationsCenter
        isOpen={isNotificationsModalOpen}
        onClose={() => setIsNotificationsModalOpen(false)}
        notifications={notifications}
        currentMember={currentMember}
        members={members}
        onMarkAsRead={handleMarkNotifRead}
        onMarkAllAsRead={handleMarkAllNotifsRead}
        onDeleteNotification={handleDeleteNotification}
        onClearAllNotifications={handleClearAllNotifications}
        onSendCustomNotification={handleSendCustomNotification}
        pushPermission={pushPermission}
        onRequestPushPermission={handleRequestPushPermission}
      />

      <SendEmailModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        members={members}
        activities={activities}
        project={project}
        currentMember={currentMember}
        currentWorkspace={currentWorkspace}
        onSendInAppNotification={handleSendCustomNotification}
      />
    </div>
  );
}
