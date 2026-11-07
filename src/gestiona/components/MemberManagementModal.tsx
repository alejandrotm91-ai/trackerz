import React, { useState, useEffect, useRef } from "react";
import { Member, Activity, WorkspaceType } from "../types";
import { 
  X, 
  UserPlus, 
  Trash2, 
  Mail, 
  Phone, 
  Bell, 
  Check, 
  Pencil, 
  RotateCcw, 
  Save, 
  HardHat,
  Building2,
  Info
} from "lucide-react";
import { filterMembersByWorkspace, isTomasOrCarlosMember, isSpecialistMember } from "../lib/activityUtils";

interface MemberManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  allMembers?: Member[];
  activities: Activity[];
  currentWorkspace?: WorkspaceType;
  onAddMember: (member: Member) => void;
  onUpdateMember: (member: Member) => void;
  onDeleteMember: (memberId: string) => void;
  onSendTestNotification: (member: Member) => void;
}

const AVATAR_COLORS = [
  "bg-amber-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-purple-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-blue-500",
  "bg-orange-500",
];

export const MemberManagementModal: React.FC<MemberManagementModalProps> = ({
  isOpen,
  onClose,
  members,
  allMembers,
  activities,
  currentWorkspace = 'equipos',
  onAddMember,
  onUpdateMember,
  onDeleteMember,
  onSendTestNotification,
}) => {
  const [activeTabWorkspace, setActiveTabWorkspace] = useState<WorkspaceType>(currentWorkspace || 'equipos');
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<WorkspaceType[]>([currentWorkspace || 'equipos']);
  
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Director de Obra / Residente");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  const [sentMemberId, setSentMemberId] = useState<string | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  const [isConfirmingDeleteInEdit, setIsConfirmingDeleteInEdit] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const formContainerRef = useRef<HTMLDivElement>(null);

  // Synchronize active tab when modal is opened or currentWorkspace changes
  useEffect(() => {
    if (isOpen) {
      const initialWs = currentWorkspace || 'equipos';
      setActiveTabWorkspace(initialWs);
      setSelectedWorkspaces([initialWs]);
    }
  }, [isOpen, currentWorkspace]);

  if (!isOpen) return null;

  // Complete pool of members to filter from
  const allList = allMembers && allMembers.length > 0 ? allMembers : members;
  const equiposMembers = filterMembersByWorkspace(allList, 'equipos');
  const construccionMembers = filterMembersByWorkspace(allList, 'construccion');
  const currentTabMembers = activeTabWorkspace === 'construccion' ? construccionMembers : equiposMembers;

  const handleTabChange = (ws: WorkspaceType) => {
    setActiveTabWorkspace(ws);
    if (!editingMemberId) {
      setSelectedWorkspaces([ws]);
    }
  };

  const handleToggleWorkspaceSelection = (ws: WorkspaceType) => {
    setSelectedWorkspaces((prev) => {
      if (prev.includes(ws)) {
        if (prev.length <= 1) return prev; // Keep at least one workspace active
        return prev.filter((w) => w !== ws);
      } else {
        return [...prev, ws];
      }
    });
  };

  const handleQuickToggleConstruccion = (m: Member) => {
    const currentWs = Array.isArray(m.workspaces) && m.workspaces.length > 0
      ? [...m.workspaces]
      : [m.workspace || (isTomasOrCarlosMember(m) ? 'construccion' : 'equipos')];

    let updatedWs: WorkspaceType[];
    if (currentWs.includes('construccion')) {
      updatedWs = currentWs.filter((w) => w !== 'construccion');
      if (updatedWs.length === 0) updatedWs = ['equipos'];
    } else {
      updatedWs = Array.from(new Set([...currentWs, 'construccion']));
    }

    const updated: Member = {
      ...m,
      workspace: updatedWs[0] || 'equipos',
      workspaces: updatedWs,
    };

    onUpdateMember(updated);
    const hasCst = updatedWs.includes('construccion');
    setFeedbackMessage(`✓ Toggle Construcción ${hasCst ? 'ACTIVADO' : 'DESACTIVADO'} para ${m.name}`);
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  const handleStartEdit = (m: Member) => {
    setEditingMemberId(m.id);
    setName(m.name);
    setRole(m.role);
    setEmail(m.email || "");
    setPhone(m.phone || "");
    setSelectedColor(m.avatarColor || AVATAR_COLORS[0]);
    setIsConfirmingDeleteInEdit(false);

    // Determine member workspaces
    let wsList: WorkspaceType[] = [];
    if (m.workspaces && m.workspaces.length > 0) {
      wsList = [...m.workspaces];
    } else if (m.workspace) {
      wsList = [m.workspace];
    } else {
      wsList = [isTomasOrCarlosMember(m) ? 'construccion' : 'equipos'];
    }

    // Pedro, Olga and Mauricio: ensure both are enabled by default
    if (isSpecialistMember(m)) {
      if (!wsList.includes('equipos')) wsList.push('equipos');
      if (!wsList.includes('construccion')) wsList.push('construccion');
    }

    setSelectedWorkspaces(Array.from(new Set(wsList)));

    setTimeout(() => {
      formContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      emailInputRef.current?.focus();
      emailInputRef.current?.select();
    }, 60);
  };

  const handleCancelEdit = () => {
    setEditingMemberId(null);
    setName("");
    setRole("Director de Obra / Residente");
    setEmail("");
    setPhone("");
    setSelectedColor(AVATAR_COLORS[0]);
    setMemberToDelete(null);
    setIsConfirmingDeleteInEdit(false);
    setSelectedWorkspaces([activeTabWorkspace]);
  };

  const handleConfirmDeleteInEdit = () => {
    if (!editingMemberId) return;
    const targetId = editingMemberId;
    const targetName = name;
    setIsConfirmingDeleteInEdit(false);
    handleCancelEdit();
    onDeleteMember(targetId);
    setFeedbackMessage(`✓ Se eliminó a "${targetName}" del equipo`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const parts = name.trim().split(" ");
    const initials =
      parts.length > 1
        ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
        : name.substring(0, 2).toUpperCase();

    const finalWorkspaces: WorkspaceType[] = selectedWorkspaces.length > 0 ? selectedWorkspaces : ['equipos'];
    const primaryWorkspace: WorkspaceType = finalWorkspaces[0];

    if (editingMemberId) {
      const original = allList.find((m) => m.id === editingMemberId);
      if (!original) return;

      const updated: Member = {
        ...original,
        name: name.trim(),
        role: role.trim(),
        email: email.trim() || `${name.toLowerCase().replace(/\s+/g, ".")}@obra.com`,
        phone: phone.trim(),
        avatarColor: selectedColor,
        initials,
        workspace: primaryWorkspace,
        workspaces: finalWorkspaces,
      };

      onUpdateMember(updated);
      const wsLabels = finalWorkspaces.map(w => w === 'construccion' ? 'Construcción' : 'Equipamiento').join(' y ');
      setFeedbackMessage(`✓ Se actualizaron los datos de "${updated.name}" (${wsLabels})`);
      handleCancelEdit();
    } else {
      const newMember: Member = {
        id: `MEM-${Date.now()}`,
        name: name.trim(),
        role: role.trim(),
        email: email.trim() || `${name.toLowerCase().replace(/\s+/g, ".")}@obra.com`,
        phone: phone.trim(),
        avatarColor: selectedColor,
        initials,
        workspace: primaryWorkspace,
        workspaces: finalWorkspaces,
        isOnline: true,
        lastActive: new Date().toISOString(),
      };

      onAddMember(newMember);
      const wsLabels = finalWorkspaces.map(w => w === 'construccion' ? 'Construcción' : 'Equipamiento').join(' y ');
      setFeedbackMessage(`✓ "${newMember.name}" añadido al equipo (${wsLabels})`);
      handleCancelEdit();
    }

    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const handleNotify = (m: Member) => {
    onSendTestNotification(m);
    setSentMemberId(m.id);
    setTimeout(() => setSentMemberId(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden my-8">
        {/* Header */}
        <div className="bg-white px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Gestión de Equipos por Especialidad
            </h3>
            <p className="text-xs text-slate-500">
              Administra los integrantes de <span className="font-semibold text-slate-700">Equipos</span> y <span className="font-semibold text-slate-700">Construcción</span>
            </p>
          </div>
          <button
            onClick={() => {
              handleCancelEdit();
              onClose();
            }}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Workspace Team Selector Tabs */}
        <div className="flex items-center gap-2 px-5 pt-3 pb-0 border-b border-slate-200 bg-slate-50/70">
          <button
            type="button"
            onClick={() => handleTabChange('equipos')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTabWorkspace === 'equipos'
                ? 'border-blue-600 text-blue-700 bg-white shadow-2xs rounded-t-md -mb-px'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Equipo de Equipos</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTabWorkspace === 'equipos' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'
            }`}>
              {equiposMembers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('construccion')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTabWorkspace === 'construccion'
                ? 'border-amber-600 text-amber-800 bg-white shadow-2xs rounded-t-md -mb-px'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <HardHat className="w-3.5 h-3.5 text-amber-600" />
            <span>Equipo de Construcción</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTabWorkspace === 'construccion' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
            }`}>
              {construccionMembers.length}
            </span>
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {/* Feedback banner */}
          {feedbackMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-2 rounded-md font-semibold flex items-center gap-2 animate-fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{feedbackMessage}</span>
            </div>
          )}

          {/* Contextual notice for Construcción */}
          {activeTabWorkspace === 'construccion' && (
            <div className="bg-amber-50/80 border border-amber-200 text-amber-900 px-3.5 py-2 rounded-md flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold">Equipo de Construcción:</span> Actualmente asignado a <span className="font-semibold">Tomás Suárez</span> y <span className="font-semibold">Carlos Torres</span>. Puedes agregar más personas a este equipo utilizando el formulario a continuación.
              </div>
            </div>
          )}

          {/* Form: Add or Edit Member */}
          <div ref={formContainerRef}>
            <form
              onSubmit={handleSubmit}
              className={`border rounded-md p-3.5 space-y-3 transition-colors ${
                editingMemberId
                  ? "bg-blue-50/50 border-blue-300 ring-1 ring-blue-200"
                  : activeTabWorkspace === 'construccion'
                  ? "bg-amber-50/30 border-amber-200"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  {editingMemberId ? (
                    <>
                      <Pencil className="w-4 h-4 text-blue-600" />
                      <span>
                        Editar Responsable:{" "}
                        <span className="text-blue-900 underline font-semibold">
                          {name || "Miembro"}
                        </span>
                      </span>
                      <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded border border-blue-200 ml-1">
                        Modo Edición
                      </span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 text-blue-600" />
                      <span>
                        Añadir Nuevo Miembro a{" "}
                        <span className="text-blue-700 font-bold">
                          {selectedWorkspaces.map(w => w === 'construccion' ? 'Construcción' : 'Equipos').join(' + ')}
                        </span>
                      </span>
                    </>
                  )}
                </h4>

                {editingMemberId && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDeleteInEdit(true)}
                      className="text-[11px] text-rose-600 hover:text-rose-800 flex items-center gap-1 hover:underline cursor-pointer font-medium"
                      title="Eliminar este miembro del equipo"
                    >
                      <Trash2 className="w-3 h-3 text-rose-500" />
                      <span>Eliminar miembro</span>
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="text-[11px] text-slate-600 hover:text-slate-900 flex items-center gap-1 hover:underline cursor-pointer font-medium"
                      title="Cancelar edición"
                    >
                      <RotateCcw className="w-3 h-3 text-slate-500" />
                      <span>Cancelar edición</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Workspace assignment toggles for this member */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700 text-xs">
                    Espacios de Trabajo Asignados:
                  </label>
                  <span className="text-[10px] text-slate-500">
                    Habilita o deshabilita los espacios donde colabora este integrante
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Toggle Equipamiento */}
                  <button
                    type="button"
                    onClick={() => handleToggleWorkspaceSelection('equipos')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
                      selectedWorkspaces.includes('equipos')
                        ? 'bg-blue-50 text-blue-900 border-blue-400 shadow-2xs ring-1 ring-blue-400/30'
                        : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Building2 className={`w-3.5 h-3.5 ${selectedWorkspaces.includes('equipos') ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span>Equipamiento</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                      selectedWorkspaces.includes('equipos') ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {selectedWorkspaces.includes('equipos') ? 'Activo' : 'Inactivo'}
                    </span>
                  </button>

                  {/* Toggle Construcción */}
                  <button
                    type="button"
                    id="toggle-construccion-member-form"
                    onClick={() => handleToggleWorkspaceSelection('construccion')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
                      selectedWorkspaces.includes('construccion')
                        ? 'bg-amber-50 text-amber-900 border-amber-400 shadow-2xs ring-1 ring-amber-400/30'
                        : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'
                    }`}
                    title="Toggle Construcción: Permite a este integrante tener tareas y colaborar en el espacio de Construcción"
                  >
                    <HardHat className={`w-3.5 h-3.5 ${selectedWorkspaces.includes('construccion') ? 'text-amber-600' : 'text-slate-400'}`} />
                    <span>Construcción</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                      selectedWorkspaces.includes('construccion') ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {selectedWorkspaces.includes('construccion') ? 'Activo' : 'Inactivo'}
                    </span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>El personal especialista (Pedro, Olga, Mauricio) puede tener el toggle de Construcción activo junto con Equipamiento.</span>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nombre Completo *
                  </label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    required
                    placeholder="Ej: Ing. Roberto Garza"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Rol / Especialidad *
                  </label>
                  <input
                    type="text"
                    required
                    list="team-roles-list"
                    placeholder="Ej: Residente de Construcción, Supervisor de Obra..."
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                  <datalist id="team-roles-list">
                    <option value="Director de Obra / Residente" />
                    <option value="Residente de Construcción" />
                    <option value="Supervisor de Montaje y Construcción" />
                    <option value="Especialista Estructuras" />
                    <option value="Supervisora de Acabados y Calidad" />
                    <option value="Contratista Instalaciones Eléctricas" />
                    <option value="Supervisora HSE & Protocolos" />
                    <option value="Comprador / Adquisiciones" />
                    <option value="Jefe de Compras" />
                    <option value="Topógrafo y Control de Calidad" />
                  </datalist>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <input
                      ref={emailInputRef}
                      type="email"
                      placeholder="nombre@obra.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-md pl-8 pr-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    />
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Teléfono / WhatsApp
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="+52 55 1234 5678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-md pl-8 pr-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    />
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Avatar Color Picker & Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 text-[11px] mr-1">Color de perfil:</span>
                  {AVATAR_COLORS.map((color) => (
                    <button
                      type="button"
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`w-4 h-4 rounded-full ${color} transition-transform cursor-pointer ${
                        selectedColor === color
                          ? "scale-125 ring-2 ring-slate-800"
                          : "opacity-80 hover:opacity-100"
                      }`}
                      title={color}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {editingMemberId ? (
                    <>
                      {isConfirmingDeleteInEdit ? (
                        <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-md">
                          <span className="text-xs text-rose-700 font-bold">¿Eliminar a {name || "este miembro"}?</span>
                          <button
                            type="button"
                            onClick={handleConfirmDeleteInEdit}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded transition-colors cursor-pointer"
                          >
                            Sí, eliminar
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsConfirmingDeleteInEdit(false)}
                            className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium rounded transition-colors cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsConfirmingDeleteInEdit(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-md border border-rose-200 transition-colors cursor-pointer text-xs"
                          title="Eliminar este miembro del equipo"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>Eliminar Miembro</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-md border border-slate-300 transition-colors cursor-pointer text-xs"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md shadow-2xs transition-colors cursor-pointer text-xs"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Guardar Cambios</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md shadow-2xs transition-colors cursor-pointer text-xs"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Guardar Integrante ({selectedWorkspaces.map(w => w === 'construccion' ? 'Construcción' : 'Equipamiento').join(' + ')})</span>
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>

          {/* Members List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-1.5">
                {activeTabWorkspace === 'construccion' ? (
                  <>
                    <HardHat className="w-3.5 h-3.5 text-amber-600" />
                    <span>Integrantes de Construcción ({currentTabMembers.length})</span>
                  </>
                ) : (
                  <>
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Integrantes de Equipos ({currentTabMembers.length})</span>
                  </>
                )}
              </h4>
              <span className="text-[11px] text-slate-500">
                Haga clic en <span className="font-semibold text-slate-700">Editar</span> para modificar datos o rol
              </span>
            </div>

            {currentTabMembers.length === 0 ? (
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-md text-center text-slate-500 text-xs">
                No hay miembros registrados en este equipo aún. Utiliza el formulario superior para añadir integrantes.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                {[...currentTabMembers]
                  .sort((a, b) => {
                    const countA = activities.filter((act) => act.responsibleId === a.id).length;
                    const countB = activities.filter((act) => act.responsibleId === b.id).length;
                    return countB - countA;
                  })
                  .map((m) => {
                    const assignedCount = activities.filter((a) => a.responsibleId === m.id).length;
                    const isNotified = sentMemberId === m.id;
                    const isCurrentlyEditing = editingMemberId === m.id;

                    return (
                      <div
                        key={m.id}
                        className={`p-2.5 rounded-md flex items-center justify-between gap-3 shadow-2xs transition-all ${
                          isCurrentlyEditing
                            ? "bg-blue-50/60 border-2 border-blue-500 ring-2 ring-blue-100"
                            : "bg-white border border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-full ${m.avatarColor} text-white font-bold flex items-center justify-center text-[10px] shrink-0`}
                          >
                            {m.initials}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-slate-900 truncate">{m.name}</p>
                              <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                                {assignedCount} {assignedCount === 1 ? "tarea" : "tareas"}
                              </span>
                              {(() => {
                                const wsArr = Array.isArray(m.workspaces) && m.workspaces.length > 0
                                  ? m.workspaces
                                  : [m.workspace || (isTomasOrCarlosMember(m) ? 'construccion' : 'equipos')];
                                return (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {wsArr.includes('equipos') && (
                                      <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded font-semibold flex items-center gap-0.5">
                                        <Building2 className="w-2.5 h-2.5" /> Equipos
                                      </span>
                                    )}
                                    {(wsArr.includes('construccion') || isSpecialistMember(m) || isTomasOrCarlosMember(m)) && (
                                      <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded font-semibold flex items-center gap-0.5">
                                        <HardHat className="w-2.5 h-2.5 text-amber-700" /> Construcción
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                              {isCurrentlyEditing && (
                                <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-bold">
                                  Editando
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-blue-700 font-medium truncate">{m.role}</p>
                            <p className="text-[11px] text-slate-600 truncate flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="font-mono text-slate-700">{m.email || "Sin correo"}</span>
                              {m.phone && <span className="text-slate-400">• {m.phone}</span>}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {memberToDelete === m.id ? (
                            <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 px-2 py-1 rounded-md">
                              <span className="text-[10px] text-rose-700 font-bold">¿Eliminar?</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const targetId = m.id;
                                  const targetName = m.name;
                                  setMemberToDelete(null);
                                  if (editingMemberId === targetId) handleCancelEdit();
                                  onDeleteMember(targetId);
                                  setFeedbackMessage(`✓ Se eliminó a "${targetName}" del equipo`);
                                }}
                                className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded cursor-pointer transition-colors"
                                title="Confirmar eliminación"
                              >
                                Sí
                              </button>
                              <button
                                type="button"
                                onClick={() => setMemberToDelete(null)}
                                className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-[10px] rounded cursor-pointer transition-colors"
                                title="Cancelar"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <>
                              {/* Quick Toggle Construcción Button */}
                              <button
                                type="button"
                                id={`quick-toggle-cst-${m.id}`}
                                onClick={() => handleQuickToggleConstruccion(m)}
                                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border transition-all cursor-pointer ${
                                  (m.workspaces?.includes('construccion') || m.workspace === 'construccion' || isSpecialistMember(m) || isTomasOrCarlosMember(m))
                                    ? "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 shadow-2xs"
                                    : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                                }`}
                                title={
                                  (m.workspaces?.includes('construccion') || m.workspace === 'construccion')
                                    ? "Construcción ACTIVO para este integrante. Clic para alternar toggle de Construcción."
                                    : "Construcción INACTIVO. Clic para activar toggle de Construcción."
                                }
                              >
                                <HardHat className={`w-3 h-3 ${
                                  (m.workspaces?.includes('construccion') || m.workspace === 'construccion' || isSpecialistMember(m) || isTomasOrCarlosMember(m))
                                    ? "text-amber-600"
                                    : "text-slate-400"
                                }`} />
                                <span className="hidden sm:inline">Construcción:</span>
                                <span className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase ${
                                  (m.workspaces?.includes('construccion') || m.workspace === 'construccion' || isSpecialistMember(m) || isTomasOrCarlosMember(m))
                                    ? "bg-amber-600 text-white"
                                    : "bg-slate-200 text-slate-600"
                                }`}>
                                  {(m.workspaces?.includes('construccion') || m.workspace === 'construccion' || isSpecialistMember(m) || isTomasOrCarlosMember(m)) ? "ON" : "OFF"}
                                </span>
                              </button>

                              {/* Edit Member Button */}
                              <button
                                type="button"
                                onClick={() => handleStartEdit(m)}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                                  isCurrentlyEditing
                                    ? "bg-blue-600 text-white shadow-xs"
                                    : "bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300"
                                }`}
                                title={`Editar correo o datos de ${m.name}`}
                              >
                                <Pencil className="w-3 h-3" />
                                <span>{isCurrentlyEditing ? "Editando" : "Editar"}</span>
                              </button>

                              {/* Send Push Notification Alert */}
                              <button
                                type="button"
                                onClick={() => handleNotify(m)}
                                className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-semibold transition-colors cursor-pointer"
                                title="Enviar alerta push de prueba a este miembro"
                              >
                                {isNotified ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Bell className="w-3 h-3" />
                                )}
                                <span>{isNotified ? "Enviada" : "Alerta"}</span>
                              </button>

                              {/* Delete Member Button */}
                              <button
                                type="button"
                                onClick={() => setMemberToDelete(m.id)}
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title={`Eliminar ${m.name} del equipo`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
