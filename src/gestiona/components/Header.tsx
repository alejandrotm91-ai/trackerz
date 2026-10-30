import React, { useState, useRef, useEffect } from "react";
import { 
  Building2, 
  Plus, 
  Users, 
  Bell, 
  Clock, 
  LayoutGrid, 
  ListOrdered, 
  BarChart3, 
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Mail,
  Lock,
  KeyRound,
  ChevronDown,
  Check,
  X,
  Eye,
  EyeOff,
  ArrowBigUp,
  Boxes,
  HardHat
} from "lucide-react";
import { Member, Project, Activity, WorkspaceType } from "../types";
import { NO_USER_MEMBER } from "../lib/initialData";
import { canUserEdit, isAlejandroTejeda } from "../lib/activityUtils";

interface HeaderProps {
  currentView: 'kanban' | 'table' | 'meeting' | 'time' | 'reports' | 'calendar';
  onSelectView: (view: 'kanban' | 'table' | 'meeting' | 'time' | 'reports' | 'calendar') => void;
  currentWorkspace: WorkspaceType;
  onSelectWorkspace: (workspace: WorkspaceType) => void;
  equiposCount?: number;
  construccionCount?: number;
  project: Project;
  members: Member[];
  allMembers?: Member[];
  currentMember: Member;
  onSelectCurrentMember: (member: Member) => void;
  onOpenNewActivity: () => void;
  onOpenMembersModal: () => void;
  onOpenNotifications: () => void;
  onOpenEmailModal: () => void;
  unreadNotificationsCount: number;
  activeTimerActivity: Activity | null;
  timerElapsedSeconds: number;
  onStopTimer: () => void;
  isCloudSynced: boolean;
  pushPermission: NotificationPermission;
  onRequestPushPermission: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onSelectView,
  currentWorkspace,
  onSelectWorkspace,
  equiposCount = 0,
  construccionCount = 0,
  project,
  members,
  allMembers,
  currentMember,
  onSelectCurrentMember,
  onOpenNewActivity,
  onOpenMembersModal,
  onOpenNotifications,
  onOpenEmailModal,
  unreadNotificationsCount,
  activeTimerActivity,
  timerElapsedSeconds,
  onStopTimer,
  isCloudSynced,
  pushPermission,
  onRequestPushPermission,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const dropdownContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownContainerRef.current &&
        !dropdownContainerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const canEdit = canUserEdit(currentMember);

  const handleTriggerClick = () => {
    if (isDropdownOpen) {
      setIsDropdownOpen(false);
    } else {
      // If already an authenticated member (in edit mode), open dropdown directly
      if (canEdit) {
        setIsDropdownOpen(true);
      } else {
        setPasswordError(null);
        setPasswordInput("");
        setIsCapsLockOn(false);
        setIsPasswordModalOpen(true);
      }
    }
  };

  const handleVerifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = passwordInput.trim().toLowerCase();
    if (clean === "admin") {
      setIsPasswordModalOpen(false);
      setPasswordInput("");
      setPasswordError(null);
      setIsCapsLockOn(false);
      setIsDropdownOpen(true);
    } else {
      setPasswordError("Clave incorrecta. Por favor intente de nuevo.");
    }
  };

  const handleClosePasswordModal = () => {
    setIsPasswordModalOpen(false);
    setPasswordInput("");
    setPasswordError(null);
    setIsCapsLockOn(false);
  };

  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? `${h}h ` : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
      {/* Top Banner: Project details & Quick Cloud status */}
      <div className="px-4 lg:px-6 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 text-xs bg-slate-50/80">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium text-[11px]">
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-semibold">{project.name}</span>
            <span className="text-blue-600/80 font-mono">({project.code})</span>
          </div>

          <div className="hidden md:flex items-center gap-2 text-slate-500 text-[11px]">
            <span>📍 {project.location}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Cloud Sync Indicator */}
          <div 
            id="cloud-sync-status"
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 shadow-2xs"
            title="Conectado a Google Cloud Firestore con sincronización en tiempo real para todos los dispositivos"
          >
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isCloudSynced ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isCloudSynced ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
            <span className="text-[11px] font-medium">
              {isCloudSynced ? "Nube Sincronizada" : "Conectando..."}
            </span>
          </div>

          {/* Active Timer Indicator if any */}
          {activeTimerActivity && (
            <div className="flex items-center gap-2 bg-slate-900 text-white px-2.5 py-0.5 rounded-md shadow-xs animate-pulse">
              <Clock className="w-3 h-3 text-emerald-400 animate-spin" />
              <span className="font-mono text-xs font-bold text-emerald-300">{formatTimer(timerElapsedSeconds)}</span>
              <span className="hidden sm:inline text-[10px] text-slate-300 truncate max-w-[100px]">
                {activeTimerActivity.id}
              </span>
              <button
                onClick={onStopTimer}
                className="ml-1 bg-rose-600 hover:bg-rose-500 text-white px-1.5 py-0.2 rounded text-[10px] font-bold transition-colors cursor-pointer"
                title="Pausar y guardar tiempo"
              >
                Pausar
              </button>
            </div>
          )}

          {/* Enviar Correo & Notificaciones a Miembros Indexados */}
          <button
            id="open-email-modal-btn"
            onClick={onOpenEmailModal}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all shadow-2xs cursor-pointer active:scale-95"
            title="Enviar correo personalizado con actividades a los miembros del equipo (correos indexados)"
          >
            <Mail className="w-3.5 h-3.5 text-white" />
            <span>Enviar Correo</span>
          </button>

          {/* Push Notification Permission Button */}
          {pushPermission !== "granted" && (
            <button
              onClick={onRequestPushPermission}
              className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer font-medium"
              title="Habilitar notificaciones push del navegador"
            >
              <Bell className="w-3 h-3 text-amber-600" />
              <span className="hidden sm:inline">Activar Push</span>
            </button>
          )}

          {/* Profile Switcher protected by password (ADmin) */}
          <div ref={dropdownContainerRef} className="relative flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
            <span className="text-slate-500 text-[10px] hidden sm:inline font-medium">Usuario:</span>
            
            <button
              id="user-profile-switcher-btn"
              type="button"
              onClick={handleTriggerClick}
              className="flex items-center gap-1.5 bg-transparent hover:bg-slate-50 px-1 py-0.5 rounded text-left transition-colors cursor-pointer"
              title="Cambiar usuario activo"
            >
              <div className={`w-4 h-4 rounded-full ${currentMember.avatarColor} text-white flex items-center justify-center text-[9px] font-bold shrink-0`}>
                {currentMember.initials}
              </div>
              <span className="text-slate-800 text-[11px] font-semibold max-w-[100px] sm:max-w-[130px] truncate">
                {currentMember.name}
              </span>
              <Lock className="w-2.5 h-2.5 text-slate-400" />
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {canEdit ? (
              <span 
                className="hidden md:inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded" 
                title="Alejandro Tejeda: Permisos de edición y creación activos"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Edición
              </span>
            ) : (
              <span 
                className="hidden md:inline-flex items-center gap-1 text-[9px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded" 
                title="Modo solo lectura. Seleccione Alejandro Tejeda para habilitar edición y creación."
              >
                <Eye className="w-2.5 h-2.5 text-amber-600" />
                Solo Lectura
              </span>
            )}

            {/* Dropdown list of team members */}
            {isDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-40 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[11px] font-bold text-slate-700">Cambiar Usuario</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(false)}
                    className="p-0.5 text-slate-400 hover:text-slate-600 rounded transition-colors cursor-pointer"
                    title="Cerrar y bloquear"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 py-0.5">
                  {[NO_USER_MEMBER, ...members.filter((m) => m.id !== NO_USER_MEMBER.id)].map((m) => {
                    const isSelected = m.id === currentMember.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          onSelectCurrentMember(m);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                          isSelected ? "bg-blue-50/80 text-blue-900" : "hover:bg-slate-50 text-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-5 h-5 rounded-full ${m.avatarColor} text-white flex items-center justify-center text-[9px] font-bold shrink-0`}>
                            {m.initials}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-xs truncate ${isSelected ? "font-bold text-blue-900" : "font-medium"}`}>
                              {m.name}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {m.role}
                            </p>
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        )}
                      </button>
                    );
                  })}

                  {/* If in Construcción and Director Alejandro is not in members list, allow admin selection */}
                  {allMembers && allMembers.length > 0 && currentWorkspace === 'construccion' && (
                    (() => {
                      const director = allMembers.find(
                        (m) => isAlejandroTejeda(m) || m.name.toLowerCase().includes("alejandro")
                      );
                      if (!director || members.some((m) => m.id === director.id)) return null;
                      const isSelected = director.id === currentMember.id;
                      return (
                        <div className="border-t border-slate-200 mt-1 pt-1 bg-slate-50/60">
                          <div className="px-3 py-0.5 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                            ADMIN
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectCurrentMember(director);
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                              isSelected ? "bg-blue-50/80 text-blue-900" : "hover:bg-slate-50 text-slate-800"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`w-5 h-5 rounded-full ${director.avatarColor} text-white flex items-center justify-center text-[9px] font-bold shrink-0`}>
                                {director.initials}
                              </div>
                              <div className="min-w-0">
                                <p className={`text-xs truncate ${isSelected ? "font-bold text-blue-900" : "font-medium"}`}>
                                  {director.name}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate">
                                  {director.role}
                                </p>
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            )}
                          </button>
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Bar: Navigation & Primary Actions */}
      <div className="px-4 lg:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Project Name & Desktop Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-xs transition-colors ${
              currentWorkspace === 'construccion' ? 'bg-amber-600' : 'bg-blue-600'
            }`}>
              {currentWorkspace === 'construccion' ? 'CST' : 'EQP'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  {project.name}
                </h1>
              </div>
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                  currentWorkspace === 'construccion' ? 'bg-amber-500' : 'bg-blue-500'
                }`} />
                <span className="font-medium text-slate-700">
                  {currentWorkspace === 'construccion' ? 'Construcción en Sitio' : 'Equipamiento'}
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-500 hidden sm:inline">
                  {currentWorkspace === 'construccion'
                    ? 'Obras civiles, montaje y pruebas'
                    : 'Ingeniería, compras y taller'}
                </span>
              </p>
            </div>
          </div>

          {/* Selector de Escritorio (Desktop Switcher) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-300 shadow-2xs">
            <button
              id="btn-desktop-equipos"
              type="button"
              onClick={() => onSelectWorkspace('equipos')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                currentWorkspace === 'equipos'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200 ring-1 ring-blue-500/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
              title="Escritorio Equipamiento: Fases de Ingeniería, Compras, Fabricación y Flete"
            >
              <Boxes className="w-3.5 h-3.5 text-blue-600" />
              <span>Equipamiento</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                currentWorkspace === 'equipos' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'
              }`}>
                {equiposCount}
              </span>
            </button>

            <button
              id="btn-desktop-construccion"
              type="button"
              onClick={() => onSelectWorkspace('construccion')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                currentWorkspace === 'construccion'
                  ? 'bg-amber-500 text-white shadow-xs font-bold ring-1 ring-amber-600/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
              title="Escritorio Construcción: Obras Enterradas, Tuberías Principales, Hormigonados, Arquitectura y Montajes"
            >
              <HardHat className="w-3.5 h-3.5 text-white" />
              <span>Construcción</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                currentWorkspace === 'construccion' ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {construccionCount}
              </span>
            </button>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <nav className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 overflow-x-auto no-scrollbar-x max-w-full">
          <button
            id="nav-reports"
            onClick={() => onSelectView('reports')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              currentView === 'reports'
                ? 'bg-white text-blue-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Resumen</span>
          </button>

          <button
            id="nav-table"
            onClick={() => onSelectView('table')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              currentView === 'table'
                ? 'bg-white text-blue-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Tabla</span>
          </button>

          <button
            id="nav-kanban"
            onClick={() => onSelectView('kanban')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              currentView === 'kanban'
                ? 'bg-white text-blue-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Kanban</span>
          </button>
        </nav>

        {/* Right Tools: Notification Bell, Members, New Activity */}
        <div className="flex items-center gap-2">
          {/* Notifications Center */}
          <button
            id="open-notifications-btn"
            onClick={onOpenNotifications}
            className="relative p-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
            title="Centro de Notificaciones"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-xs">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* Members Management */}
          <button
            id="open-members-btn"
            onClick={onOpenMembersModal}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium transition-colors cursor-pointer shadow-2xs"
            title={`Gestionar Equipo de ${currentWorkspace === 'construccion' ? 'Construcción' : 'Equipos'}`}
          >
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Equipo {currentWorkspace === 'construccion' ? 'Construcción' : 'Equipos'} ({members.length})</span>
          </button>

          {/* Create Activity Button */}
          <button
            id="create-activity-btn"
            disabled={!canEdit}
            onClick={canEdit ? onOpenNewActivity : undefined}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold shadow-xs transition-all ${
              canEdit
                ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transform active:scale-95"
                : "bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed opacity-60"
            }`}
            title={canEdit ? "Crear nueva tarea en la obra" : "Solo lectura (Se requiere usuario Alejandro Tejeda para crear o modificar)"}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Nueva Tarea</span>
          </button>
        </div>
      </div>

      {/* Password Prompt Modal for User Dropdown */}
      {isPasswordModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClosePasswordModal();
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xs overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-400/30">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold leading-tight">Acceso con Clave</h4>
                  <p className="text-[10px] text-slate-400">Selector de usuarios protegido</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClosePasswordModal}
                className="text-slate-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleVerifyPassword} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Ingrese la clave para abrir el menú de usuarios:
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoFocus
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (passwordError) setPasswordError(null);
                    }}
                    onKeyDown={(e) => {
                      setIsCapsLockOn(e.getModifierState("CapsLock"));
                    }}
                    onKeyUp={(e) => {
                      setIsCapsLockOn(e.getModifierState("CapsLock"));
                    }}
                    placeholder="Ingrese la clave de acceso..."
                    className={`w-full bg-slate-50 border rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white font-mono transition-colors ${
                      isCapsLockOn 
                        ? "border-amber-400 focus:border-amber-500 pr-20 bg-amber-50/20" 
                        : "border-slate-300 focus:border-blue-500 pr-8"
                    }`}
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    {isCapsLockOn && (
                      <span 
                        id="caps-lock-indicator-badge"
                        title="Bloqueo de mayúsculas activado (Bloq Mayús / CAPS ON)"
                        className="flex items-center gap-0.5 text-[9px] font-bold text-amber-900 bg-amber-200 border border-amber-300/90 px-1.5 py-0.5 rounded shadow-2xs select-none"
                      >
                        <ArrowBigUp className="w-3 h-3 fill-amber-700 text-amber-700 shrink-0" />
                        <span>CAPS</span>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                      title={showPassword ? "Ocultar clave" : "Ver clave"}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                {isCapsLockOn && (
                  <div 
                    id="caps-lock-alert-info"
                    className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 mt-1.5 font-medium flex items-center gap-1.5 animate-in fade-in duration-100"
                  >
                    <ArrowBigUp className="w-3.5 h-3.5 fill-amber-600 text-amber-600 shrink-0" />
                    <span>Bloq Mayús está <strong>activado</strong> (CAPS ON)</span>
                  </div>
                )}
                {passwordError && (
                  <p className="text-[11px] text-rose-600 mt-1.5 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{passwordError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleClosePasswordModal}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-sm transition-all cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Abrir Menú</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
