import React, { useState, useMemo } from "react";
import { Activity, Member } from "../types";
import { Calendar, ChevronLeft, ChevronRight, Clock, User, CheckCircle2 } from "lucide-react";

interface CalendarTimelineViewProps {
  activities: Activity[];
  members: Member[];
  onSelectActivity: (activity: Activity) => void;
}

export const CalendarTimelineView: React.FC<CalendarTimelineViewProps> = ({
  activities,
  members,
  onSelectActivity,
}) => {
  // Current month reference
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const daysOfWeek = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  // Navigate months
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const todayStr = new Date().toISOString().split("T")[0];

  // Calendar cells matrix
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startDayOfWeek = firstDay.getDay() - 1; // 0 = Mon, 6 = Sun
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const totalDays = lastDay.getDate();
    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Preceding month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const m = month === 0 ? 12 : month;
      const y = month === 0 ? year - 1 : year;
      days.push({
        dateStr: `${y}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`,
        dayNum: d,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const m = month + 1;
      days.push({
        dateStr: `${year}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`,
        dayNum: d,
        isCurrentMonth: true,
      });
    }

    // Trailing padding to make 35 or 42 cells
    const remaining = 35 - days.length;
    if (remaining > 0) {
      for (let d = 1; d <= remaining; d++) {
        const m = month + 2 > 12 ? 1 : month + 2;
        const y = month + 2 > 12 ? year + 1 : year;
        days.push({
          dateStr: `${y}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`,
          dayNum: d,
          isCurrentMonth: false,
        });
      }
    }

    return days;
  }, [year, month]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Calendar Header */}
      <div className="bg-white border border-slate-200 p-3.5 rounded-lg shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-bold">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Cronograma de Entregas & Fechas Límite
            </h2>
            <p className="text-xs text-slate-500">
              Visualización mensual de compromisos de obra por fecha de vencimiento
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={prevMonth}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md border border-slate-200 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-slate-900 min-w-[130px] text-center">
            {monthNames[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md border border-slate-200 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
        {/* Days of week header */}
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-center py-2 text-xs font-bold text-slate-600 uppercase tracking-wider">
          {daysOfWeek.map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-200 text-xs">
          {calendarDays.map((calDay) => {
            const dayActs = activities.filter((a) => a.dueDate === calDay.dateStr);
            const isToday = calDay.dateStr === todayStr;

            return (
              <div
                key={calDay.dateStr}
                className={`min-h-[105px] p-2 flex flex-col transition-colors ${
                  !calDay.isCurrentMonth
                    ? "bg-slate-50/60 text-slate-400"
                    : isToday
                    ? "bg-blue-50/40 text-slate-900"
                    : "bg-white text-slate-800"
                }`}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`font-mono text-xs font-bold ${
                      isToday
                        ? "w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-xs"
                        : "text-slate-700"
                    }`}
                  >
                    {calDay.dayNum}
                  </span>
                  {dayActs.length > 0 && (
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1 rounded">
                      {dayActs.length}
                    </span>
                  )}
                </div>

                {/* Day activities list */}
                <div className="flex-1 space-y-1 overflow-y-auto max-h-24 pr-0.5 custom-scrollbar">
                  {dayActs.map((act) => {
                    const isCompleted = act.status === "completed";
                    const isOverdue = act.dueDate && act.dueDate < todayStr && !isCompleted;

                    return (
                      <div
                        key={act.id}
                        onClick={() => onSelectActivity(act)}
                        className={`p-1 rounded text-[10px] font-semibold truncate cursor-pointer transition-all border ${
                          isCompleted
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700 line-through opacity-75"
                            : isOverdue
                            ? "bg-rose-50 border-rose-200 text-rose-700"
                            : "bg-slate-50 hover:bg-blue-50 border-slate-200 text-slate-800 hover:border-blue-300"
                        }`}
                        title={`[${act.id}] ${act.description} (${act.responsibleName})`}
                      >
                        <span className="font-mono text-slate-700 font-bold mr-1">[{act.id}]</span>
                        {act.description}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
