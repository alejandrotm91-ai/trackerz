import React, { useState } from "react";
import { NotificationItem, Member } from "../types";
import { X, Bell, Check, Send, Sparkles, AlertCircle, Clock, CheckCheck, Trash2 } from "lucide-react";

interface NotificationsCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  currentMember: Member;
  members: Member[];
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead?: () => void;
  onDeleteNotification: (notificationId: string) => void;
  onClearAllNotifications: (idsToDelete?: string[]) => void;
  onSendCustomNotification: (
    title: string, 
    message: string, 
    targetMemberId?: string,
    type?: NotificationItem['type']
  ) => void;
  pushPermission: NotificationPermission;
  onRequestPushPermission: () => void;
}

export const NotificationsCenter: React.FC<NotificationsCenterProps> = ({
  isOpen,
  onClose,
  notifications,
  currentMember,
  members,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  onClearAllNotifications,
  onSendCustomNotification,
  pushPermission,
  onRequestPushPermission,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'mine' | 'unread'>('all');
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [targetMemberId, setTargetMemberId] = useState<string>("all");
  const [sentSuccess, setSentSuccess] = useState(false);
  const [isConfirmingClearAll, setIsConfirmingClearAll] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  const handleDeleteSingle = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    onDeleteNotification(id);
    showFeedback("✓ Notificación eliminada");
  };

  const handleClearSelected = (ids: string[]) => {
    setIsConfirmingClearAll(false);
    onClearAllNotifications(ids);
    showFeedback(`✓ Se eliminaron ${ids.length} ${ids.length === 1 ? 'notificación' : 'notificaciones'}`);
  };

  const filteredNotifications = notifications.filter((notif) => {
    if (filterType === 'unread' && notif.read) return false;
    if (filterType === 'mine') {
      // personal notifications targeted to current member or broadcast to all
      if (notif.targetMemberId && notif.targetMemberId !== currentMember.id) return false;
    }
    return true;
  });

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;

    onSendCustomNotification(
      broadcastTitle.trim(),
      broadcastMessage.trim(),
      targetMemberId === "all" ? undefined : targetMemberId,
      "general"
    );

    setBroadcastTitle("");
    setBroadcastMessage("");
    setSentSuccess(true);
    setTimeout(() => setSentSuccess(false), 3000);
  };

  const getTypeIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case "assignment":
        return <span className="p-1 rounded bg-blue-100 text-blue-700 text-xs">👤</span>;
      case "due_alert":
        return <span className="p-1 rounded bg-rose-100 text-rose-700 text-xs">⚠️</span>;
      case "status_change":
        return <span className="p-1 rounded bg-emerald-100 text-emerald-700 text-xs">✅</span>;
      case "meeting":
        return <span className="p-1 rounded bg-amber-100 text-amber-700 text-xs">📝</span>;
      default:
        return <span className="p-1 rounded bg-slate-100 text-slate-700 text-xs">📢</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden my-8">
        {/* Header */}
        <div className="bg-white px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-blue-50 border border-blue-200 text-blue-600">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Centro de Notificaciones & Alertas Push
              </h3>
              <p className="text-xs text-slate-500">
                Sincronizadas en tiempo real en la nube para todos los dispositivos
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {/* Push Permission status banner */}
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-md flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${pushPermission === 'granted' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="text-slate-700 text-xs">
                Notificaciones Push del Navegador:{" "}
                <strong className="text-slate-900 font-semibold">
                  {pushPermission === "granted" ? "Activas en este equipo" : "Desactivadas / Pendientes"}
                </strong>
              </span>
            </div>

            {pushPermission !== "granted" && (
              <button
                onClick={onRequestPushPermission}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md transition-colors cursor-pointer text-xs"
              >
                Habilitar
              </button>
            )}
          </div>

          {/* Action Feedback Banner */}
          {feedbackMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-md text-xs font-medium flex items-center justify-between">
              <span>{feedbackMessage}</span>
              <button
                type="button"
                onClick={() => setFeedbackMessage(null)}
                className="text-emerald-600 hover:text-emerald-900 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Send Broadcast or Direct Alert */}
          <form onSubmit={handleSendBroadcast} className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-2.5">
            <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-blue-600" />
              Enviar Notificación Inmediata
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  required
                  placeholder="Título de la alerta (ej: Atención Urgente Colado Nivel 4)..."
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <select
                  value={targetMemberId}
                  onChange={(e) => setTargetMemberId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="all">📢 Todo el Equipo</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      👤 {m.name} ({m.role.split(" ")[0]})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                required
                placeholder="Mensaje detallado para enviar a los dispositivos..."
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-md px-2.5 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />

              <button
                type="submit"
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md shadow-2xs transition-colors cursor-pointer shrink-0 text-xs"
              >
                {sentSuccess ? "¡Enviada!" : "Enviar Push"}
              </button>
            </div>
          </form>

          {/* Filter tabs and Bulk Actions */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                  filterType === 'all'
                    ? "bg-slate-200 text-slate-900 font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Todas ({notifications.length})
              </button>

              <button
                type="button"
                onClick={() => setFilterType('mine')}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                  filterType === 'mine'
                    ? "bg-slate-200 text-slate-900 font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Para mí ({currentMember.id === "MEM-NONE" ? "Sin asignar" : currentMember.name.split(" ")[0]})
              </button>

              <button
                type="button"
                onClick={() => setFilterType('unread')}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                  filterType === 'unread'
                    ? "bg-slate-200 text-slate-900 font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                No leídas ({notifications.filter((n) => !n.read).length})
              </button>
            </div>

            {/* Bulk actions */}
            <div className="flex items-center gap-2">
              {isConfirmingClearAll ? (
                <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-xs">
                  <span className="text-[11px] font-semibold text-rose-700">
                    ¿Eliminar {filteredNotifications.length} {filteredNotifications.length === 1 ? 'notificación' : 'notificaciones'}?
                  </span>
                  <button
                    type="button"
                    onClick={() => handleClearSelected(filteredNotifications.map((n) => n.id))}
                    className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded cursor-pointer transition-colors"
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingClearAll(false)}
                    className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] rounded cursor-pointer transition-colors"
                  >
                    No
                  </button>
                </div>
              ) : (
                notifications.length > 0 && (
                  <div className="flex items-center gap-2">
                    {onMarkAllAsRead && notifications.some((n) => !n.read) && (
                      <button
                        type="button"
                        onClick={onMarkAllAsRead}
                        className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium cursor-pointer hover:underline"
                        title="Marcar todas las notificaciones como leídas"
                      >
                        <CheckCheck className="w-3 h-3" />
                        <span>Marcar leídas</span>
                      </button>
                    )}

                    {notifications.some((n) => n.read) && (
                      <button
                        type="button"
                        onClick={() => {
                          const readIds = notifications.filter((n) => n.read).map((n) => n.id);
                          handleClearSelected(readIds);
                        }}
                        className="text-[11px] text-slate-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer hover:underline"
                        title="Eliminar únicamente las notificaciones ya leídas"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Limpiar leídas</span>
                      </button>
                    )}

                    {filteredNotifications.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsConfirmingClearAll(true)}
                        className="text-[11px] text-rose-600 hover:text-rose-800 flex items-center gap-1 font-medium cursor-pointer hover:underline"
                        title="Eliminar todas las notificaciones visibles"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Eliminar {filterType !== 'all' ? 'estas' : 'todas'}</span>
                      </button>
                    )}
                  </div>
                )
              )}
            </div>
          </div>

          {/* Notification List */}
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
            {filteredNotifications.length === 0 ? (
              <p className="text-slate-400 text-center py-6 text-xs">
                No hay notificaciones en este filtro.
              </p>
            ) : (
              filteredNotifications.map((notif) => {
                const isTargetMe = notif.targetMemberId === currentMember.id;
                return (
                  <div
                    key={notif.id}
                    onClick={() => !notif.read && onMarkAsRead(notif.id)}
                    className={`p-2.5 rounded-md border transition-all flex items-start justify-between gap-2.5 cursor-pointer shadow-2xs ${
                      !notif.read
                        ? "bg-blue-50/60 border-blue-200"
                        : "bg-white border-slate-200 opacity-80"
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="mt-0.5">{getTypeIcon(notif.type)}</div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h5 className="font-bold text-slate-900 text-xs">{notif.title}</h5>
                          {isTargetMe && (
                            <span className="text-[9px] bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded font-semibold">
                              Directa para ti
                            </span>
                          )}
                          {notif.activityCode && (
                            <span className="font-mono text-[10px] text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded font-semibold">
                              {notif.activityCode}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-700 mt-0.5">{notif.message}</p>

                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1.5">
                          <span>👤 Enviado por: {notif.senderName}</span>
                          <span>•</span>
                          <span>{new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {!notif.read && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMarkAsRead(notif.id);
                          }}
                          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100/60 rounded transition-colors cursor-pointer"
                          title="Marcar como leída"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSingle(notif.id, e)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                        title="Eliminar notificación"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
