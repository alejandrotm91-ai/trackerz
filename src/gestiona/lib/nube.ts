/**
 * Almacén de Gestiona en Trakciona (D1 vía /api/gestiona). Sustituye a Firebase con las
 * mismas funciones, para que el resto del código de Gestiona no cambie.
 *
 * - Consultar: cualquier usuario con sesión.
 * - Guardar o borrar: solo el admin. Para el resto, las funciones de escritura no hacen nada.
 * - "Tiempo real": la pestaña vuelve a leer todo cada pocos segundos y después de cada cambio.
 */
import { apiFetch } from "../../utils/api";
import type { Activity, Member, Project, TimeLog, NotificationItem, MeetingSession } from "../types";

export const COLLECTIONS = {
  PROJECTS: "projects",
  ACTIVITIES: "activities",
  MEMBERS: "members",
  TIME_LOGS: "time_logs",
  NOTIFICATIONS: "notifications",
  MEETINGS: "meetings",
  DELETED_MEMBERS: "deleted_members",
} as const;

export type Coleccion = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
export type DatosGestiona = Record<Coleccion, any[]>;

// ── Permiso de escritura (lo fija la pestaña según el rol de Trakciona) ──
let puedeEscribir = false;
export function setPuedeEscribir(v: boolean) { puedeEscribir = v; }
export function getPuedeEscribir() { return puedeEscribir; }

// ── Aviso de cambios: la pestaña se suscribe para recargar enseguida ──
const oyentes = new Set<() => void>();
export function alCambiar(fn: () => void) { oyentes.add(fn); return () => { oyentes.delete(fn); }; }
let aviso: number | undefined;
function avisarCambio() {
  window.clearTimeout(aviso);
  aviso = window.setTimeout(() => oyentes.forEach(f => f()), 400);
}

// Última copia leída, para operaciones que modifican un solo campo (marcar como leída)
let cache: DatosGestiona | null = null;

export async function cargarTodo(): Promise<DatosGestiona> {
  const res = await apiFetch("/api/gestiona", { cache: "no-store" });
  cache = await res.json();
  return cache!;
}

/** Quita los `undefined` (igual que hacía Gestiona con Firestore). */
export function sanitizeForFirestore<T>(data: T): T {
  return JSON.parse(JSON.stringify(data ?? null));
}

async function guardar(col: Coleccion, id: string, datos: unknown) {
  if (!puedeEscribir || !id) return;
  try {
    await apiFetch(`/api/gestiona/${col}/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
    avisarCambio();
  } catch (e) {
    console.warn(`No se pudo guardar ${col}/${id}:`, e);
  }
}

async function borrar(col: Coleccion, id: string) {
  if (!puedeEscribir || !id) return;
  try {
    await apiFetch(`/api/gestiona/${col}/${encodeURIComponent(id)}`, { method: "DELETE" });
    avisarCambio();
  } catch (e) {
    console.warn(`No se pudo borrar ${col}/${id}:`, e);
  }
}

export async function saveActivityToCloud(activity: Activity): Promise<void> {
  await guardar(COLLECTIONS.ACTIVITIES, activity.id, { ...activity, updatedAt: new Date().toISOString() });
}

export async function deleteActivityFromCloud(activityId: string): Promise<void> {
  await borrar(COLLECTIONS.ACTIVITIES, activityId);
}

export async function saveMemberToCloud(member: Member): Promise<void> {
  await guardar(COLLECTIONS.MEMBERS, member.id, member);
}

export async function deleteMemberFromCloud(memberId: string, memberName?: string): Promise<void> {
  if (!puedeEscribir) return;
  await borrar(COLLECTIONS.MEMBERS, memberId);
  // Registros duplicados con el mismo nombre
  if (memberName && cache) {
    for (const m of cache.members || []) {
      if (m?.id && m.id !== memberId && m.name === memberName) await borrar(COLLECTIONS.MEMBERS, m.id);
    }
  }
  await guardar(COLLECTIONS.DELETED_MEMBERS, memberId, { id: memberId, name: memberName || "", deletedAt: new Date().toISOString() });
}

/** Borra miembros de ejemplo antiguos, solo si todavía existen. */
export async function permanentlyPurgeMembersFromCloud(items: { id?: string; name?: string }[]): Promise<void> {
  if (!puedeEscribir || !cache) return;
  const actuales: any[] = cache.members || [];
  for (const it of items) {
    const restos = actuales.filter(m => (it.id && m.id === it.id) || (it.name && m.name === it.name));
    for (const m of restos) await deleteMemberFromCloud(m.id, m.name);
  }
}

export async function saveProjectToCloud(project: Project): Promise<void> {
  await guardar(COLLECTIONS.PROJECTS, project.id, project);
}

export async function saveTimeLogToCloud(timeLog: TimeLog): Promise<void> {
  await guardar(COLLECTIONS.TIME_LOGS, timeLog.id, timeLog);
}

export async function saveNotificationToCloud(notification: NotificationItem): Promise<void> {
  await guardar(COLLECTIONS.NOTIFICATIONS, notification.id, notification);
}

export async function saveMeetingToCloud(meeting: MeetingSession): Promise<void> {
  await guardar(COLLECTIONS.MEETINGS, meeting.id, meeting);
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const actual = cache?.notifications?.find((n: any) => n.id === notificationId);
  if (actual) await guardar(COLLECTIONS.NOTIFICATIONS, notificationId, { ...actual, read: true });
}

export async function deleteNotificationFromCloud(notificationId: string): Promise<void> {
  await borrar(COLLECTIONS.NOTIFICATIONS, notificationId);
}

export async function clearAllNotificationsFromCloud(notificationIds: string[]): Promise<void> {
  for (const id of notificationIds || []) await borrar(COLLECTIONS.NOTIFICATIONS, id);
}
