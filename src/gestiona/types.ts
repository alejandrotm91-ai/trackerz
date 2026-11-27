export type ActivityStatus = 
  | 'electrico' 
  | 'mecanico' 
  | 'instrumentacion' 
  | 'civil' 
  | 'obra_civil' 
  | 'arquitectura'
  | 'montaje_mecanico' 
  | 'instalacion_electrica' 
  | 'hidraulica_piping' 
  | 'seguridad_calidad' 
  | string;

export type ActivityPriority = 'low' | 'medium' | 'high' | 'urgent';

export type WorkspaceType = 'equipos' | 'construccion';

export interface DisciplineDefinition {
  id: string;
  label: string;
  icon: string;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

export interface WorkspaceConfig {
  id: WorkspaceType;
  name: string;
  shortLabel: string;
  subtitle: string;
  codePrefix: string;
  phases: string[];
  disciplines: DisciplineDefinition[];
}

export const WORKSPACES: Record<WorkspaceType, WorkspaceConfig> = {
  equipos: {
    id: 'equipos',
    name: 'Equipamiento',
    shortLabel: 'Equipamiento',
    subtitle: 'Suministro, ingeniería, adquisiciones y fabricación de equipos',
    codePrefix: 'ACT',
    phases: ['Ingenieria', 'Compras', 'Fabricacion', 'Flete'],
    disciplines: [
      { id: 'electrico', label: 'Eléctrico', icon: '⚡', color: 'amber', bgClass: 'bg-amber-50', textClass: 'text-amber-800', borderClass: 'border-amber-200' },
      { id: 'mecanico', label: 'Mecánico', icon: '⚙️', color: 'blue', bgClass: 'bg-blue-50', textClass: 'text-blue-800', borderClass: 'border-blue-200' },
      { id: 'instrumentacion', label: 'Instrumentación', icon: '📡', color: 'purple', bgClass: 'bg-purple-50', textClass: 'text-purple-800', borderClass: 'border-purple-200' },
      { id: 'civil', label: 'Civil', icon: '📐', color: 'emerald', bgClass: 'bg-emerald-50', textClass: 'text-emerald-800', borderClass: 'border-emerald-200' },
    ],
  },
  construccion: {
    id: 'construccion',
    name: 'Construcción',
    shortLabel: 'Construcción',
    subtitle: 'Obras civiles, montaje electromecánico y puesta en marcha en sitio',
    codePrefix: 'CST',
    phases: [
      'Obras Enterradas',
      'Tuberias Principales',
      'Hormigonados',
      'Arquitectura',
      'Montajes en Curso',
      'Montajes & Equipos',
    ],
    disciplines: [
      { id: 'obra_civil', label: 'Obra Civil', icon: '🏗️', color: 'emerald', bgClass: 'bg-emerald-50', textClass: 'text-emerald-800', borderClass: 'border-emerald-200' },
      { id: 'arquitectura', label: 'Arquitectura', icon: '📐', color: 'violet', bgClass: 'bg-violet-50', textClass: 'text-violet-800', borderClass: 'border-violet-200' },
      { id: 'montaje_mecanico', label: 'Montaje Mecánico', icon: '⚙️', color: 'blue', bgClass: 'bg-blue-50', textClass: 'text-blue-800', borderClass: 'border-blue-200' },
      { id: 'instalacion_electrica', label: 'Instalación Eléctrica', icon: '⚡', color: 'amber', bgClass: 'bg-amber-50', textClass: 'text-amber-800', borderClass: 'border-amber-200' },
      { id: 'instrumentacion', label: 'Instrumentación', icon: '📡', color: 'purple', bgClass: 'bg-purple-50', textClass: 'text-purple-800', borderClass: 'border-purple-200' },
      { id: 'hidraulica_piping', label: 'Piping & Hidráulica', icon: '💧', color: 'cyan', bgClass: 'bg-cyan-50', textClass: 'text-cyan-800', borderClass: 'border-cyan-200' },
      { id: 'seguridad_calidad', label: 'HSE & Calidad', icon: '🛡️', color: 'rose', bgClass: 'bg-rose-50', textClass: 'text-rose-800', borderClass: 'border-rose-200' },
    ],
  },
};

export const DEFAULT_PHASES = WORKSPACES.equipos.phases;

export const DEFAULT_STATUSES: { id: string; label: string; icon?: string }[] = WORKSPACES.equipos.disciplines;

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string; // YYYY-MM-DD
}

export const DEVELOPER_EMAIL = "alejandrotm91@gmail.com";

export function isDeveloperUser(member?: Member | null): boolean {
  if (!member || !member.email) return false;
  return member.email.toLowerCase().trim() === DEVELOPER_EMAIL.toLowerCase().trim();
}

export interface TechnicalChecklist {
  procedimientoChecked: boolean;
  procedimientoDetalle?: string;
  montajeChecked: boolean;
  montajeRealizadoPor?: string;
  restriccionesChecked: boolean;
  restriccionesCuales?: string;
}

export interface Activity {
  id: string; // e.g. "ACT-001" or "CST-001"
  firestoreId?: string; // Document ID in Firestore
  projectId: string;
  workspace?: WorkspaceType; // 'equipos' | 'construccion'
  description: string;
  details?: string;
  technicalChecklist?: TechnicalChecklist;
  dueDate: string; // YYYY-MM-DD
  startDate?: string; // YYYY-MM-DD
  responsibleId: string; // Member ID
  responsibleName: string;
  status: ActivityStatus;
  priority: ActivityPriority;
  phase: string; // e.g. "Ingenieria", "Compras", "Fabricacion", "Flete", "Obras Enterradas", etc.
  subtasks: Subtask[];
  meetingNotes?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  isTimerRunning?: boolean;
  timerStartedAt?: number | null; // timestamp
  activeTimerUserId?: string | null;
  order?: number;
  /** Horas registradas y estimadas (usadas por la vista de Tiempo). */
  loggedHours?: number;
  estimatedHours?: number;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: string; // e.g. "Director de Obra", "Residente de Obra", "Arquitecto Supervisor", "Contratista Eléctrico", "Especialista Estructuras"
  phone?: string;
  avatarColor: string;
  initials: string;
  isOnline?: boolean;
  lastActive?: string;
  workspace?: WorkspaceType;
  workspaces?: WorkspaceType[]; // ['equipos'], ['construccion'] or ['equipos', 'construccion']
}

export interface Project {
  id: string;
  name: string;
  code: string;
  location: string;
  description: string;
  startDate: string;
  targetEndDate: string;
  phases: string[];
  clientName?: string;
  budgetHours?: number;
}

export interface TimeLog {
  id: string;
  activityId: string;
  activityCode: string;
  activityDescription: string;
  memberId: string;
  memberName: string;
  durationSeconds: number;
  date: string;
  notes?: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  targetMemberId?: string; // if null/empty, for all members
  senderName: string;
  activityId?: string;
  activityCode?: string;
  read: boolean;
  type: 'assignment' | 'status_change' | 'due_alert' | 'timer' | 'meeting' | 'general';
}

export interface MeetingSession {
  id: string;
  projectId: string;
  title: string;
  date: string;
  startedAt: string;
  endedAt?: string;
  attendeeIds: string[];
  rawNotes: string;
  summary?: string;
  criticalAgreements: string[];
  createdActivityIds: string[];
  status: 'in_progress' | 'completed';
}

export interface AIProductivityReport {
  summary: string;
  healthScore: number;
  keyAchievements: string[];
  risks: string[];
  memberWorkloads: {
    name: string;
    role: string;
    status: 'Sobrecargado' | 'Óptimo' | 'Disponible' | string;
    recommendation: string;
  }[];
  phaseAnalysis?: {
    phase: string;
    status: 'En Tiempo' | 'En Riesgo' | 'Retrasado' | string;
    progressPercent: number;
    notes: string;
  }[];
  recommendations: string[];
  generatedAt?: string;
}
