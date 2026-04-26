import React, { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Calendar as CalendarIcon,
  Clock,
  X,
} from "lucide-react";

interface OrientationDate {
  application_id: number;
  title: string;
  orientation_date: string;
  status: string;
}

const STATUS_CONFIG: Record<
  string,
  { bg: string; text: string; dot: string; border: string }
> = {
  accepted: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    border: "border-emerald-200",
  },
  pending: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-400",
    border: "border-amber-200",
  },
  rejected: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    dot: "bg-rose-500",
    border: "border-rose-200",
  },
};

const MOCK_DATA: OrientationDate[] = [
  {
    application_id: 7,
    title: "OrgansProject",
    orientation_date: "2026-04-29",
    status: "accepted",
  },
];

// ── KEY FIX: build YYYY-MM-DD from LOCAL time, NOT UTC ───────────────────────
// date.toISOString() converts to UTC first — in timezones UTC+1 or later,
// midnight local time becomes the previous day in UTC, so "2026-04-29" never
// matches. This helper uses local getFullYear/getMonth/getDate instead.
const toLocalDateStr = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export default function Calendar() {
  const [data, setData] = useState<OrientationDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const token = localStorage.getItem("token");

  async function fetchOrientationDates() {
    try {
      const res = await fetch(
        "http://127.0.0.1:8000/api/get_orientation_dates/",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      console.log("Raw API response:", data);
      setData(data);
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch orientation dates, using mock data");
      setData(MOCK_DATA);
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    fetchOrientationDates();
  }, []);

  useEffect(() => {
    console.log("Fetched orientation dates:", data);
  }, [data]);
  const filteredData = data.filter((item) => {
    const matchStatus = filterStatus === "all" || item.status === filterStatus;
    const matchSearch = item.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  // ── helpers ──────────────────────────────────────────────────────────────
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];
    const startPad = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    for (let i = startPad; i > 0; i--) days.push(new Date(year, month, 1 - i));
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1))
      days.push(new Date(d));
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++)
      days.push(new Date(year, month + 1, i));
    return days;
  };

  const getWeekDays = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay();
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  };

  // Uses toLocalDateStr — the fix
  const getItemsForDate = (date: Date) =>
    filteredData.filter(
      (item) => item.orientation_date === toLocalDateStr(date),
    );

  const navigate = (dir: "prev" | "next") => {
    const d = new Date(currentDate);
    const delta = dir === "next" ? 1 : -1;
    if (view === "month") d.setMonth(d.getMonth() + delta);
    else if (view === "week") d.setDate(d.getDate() + delta * 7);
    else d.setDate(d.getDate() + delta);
    setCurrentDate(d);
  };

  const headerLabel = () => {
    if (view === "month")
      return currentDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    if (view === "week") {
      const days = getWeekDays(currentDate);
      const s = days[0].toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const e = days[6].toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      return `${s} – ${e}`;
    }
    return currentDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const agendaItems = (() => {
    const allDates =
      view === "month"
        ? getDaysInMonth(currentDate)
        : view === "week"
          ? getWeekDays(currentDate)
          : [currentDate];
    return allDates
      .flatMap((d) => getItemsForDate(d).map((item) => ({ ...item, date: d })))
      .sort((a, b) => a.orientation_date.localeCompare(b.orientation_date));
  })();

  // ── Month grid ────────────────────────────────────────────────────────────
  const renderMonthView = () => {
    const days = getDaysInMonth(currentDate);
    const todayStr = toLocalDateStr(new Date());
    const headers = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return (
      <div className="flex flex-col h-full">
        <div className="grid grid-cols-7 border-b border-gray-100">
          {headers.map((h) => (
            <div
              key={h}
              className="py-3 text-center text-xs font-semibold text-gray-400 tracking-widest uppercase"
            >
              {h}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 flex-1">
          {days.map((day, idx) => {
            const items = getItemsForDate(day);
            const isToday = toLocalDateStr(day) === todayStr;
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const isSelected = selectedDate
              ? toLocalDateStr(selectedDate) === toLocalDateStr(day)
              : false;
            return (
              <div
                key={idx}
                onClick={() => setSelectedDate(day)}
                className={`relative p-2 border-b border-r border-gray-100 cursor-pointer transition-all duration-150
                  ${idx % 7 === 6 ? "border-r-0" : ""}
                  ${isCurrentMonth ? "bg-white hover:bg-gray-50" : "bg-gray-50/60"}`}
                style={
                  isSelected ? { boxShadow: "inset 0 0 0 2px #0f4a2f" } : {}
                }
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full transition-colors
                      ${!isToday && isCurrentMonth ? "text-gray-700" : ""}
                      ${!isToday && !isCurrentMonth ? "text-gray-300" : ""}`}
                    style={
                      isToday
                        ? { backgroundColor: "#0f4a2f", color: "white" }
                        : {}
                    }
                  >
                    {day.getDate()}
                  </span>
                </div>
                <div className="space-y-1">
                  {items.slice(0, 2).map((item) => {
                    const cfg =
                      STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                    return (
                      <div
                        key={item.application_id}
                        className={`text-xs px-2 py-0.5 rounded-md font-medium truncate ${cfg.bg} ${cfg.text} ${cfg.border} border`}
                      >
                        {item.title}
                      </div>
                    );
                  })}
                  {items.length > 2 && (
                    <div className="text-xs text-gray-400 px-1">
                      +{items.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Week grid ─────────────────────────────────────────────────────────────
  const renderWeekView = () => {
    const days = getWeekDays(currentDate);
    const todayStr = toLocalDateStr(new Date());
    return (
      <div className="flex flex-col h-full">
        <div className="grid grid-cols-7 border-b border-gray-100">
          {days.map((day, idx) => {
            const isToday = toLocalDateStr(day) === todayStr;
            return (
              <div
                key={idx}
                onClick={() => setSelectedDate(day)}
                className={`py-4 text-center cursor-pointer transition hover:bg-gray-50 ${idx < 6 ? "border-r border-gray-100" : ""}`}
              >
                <div className="text-xs font-semibold text-gray-400 tracking-widest uppercase mb-1">
                  {day.toLocaleDateString("en-US", { weekday: "short" })}
                </div>
                <div
                  className={`w-9 h-9 mx-auto flex items-center justify-center rounded-full text-sm font-bold transition ${!isToday ? "text-gray-700" : ""}`}
                  style={
                    isToday
                      ? { backgroundColor: "#0f4a2f", color: "white" }
                      : {}
                  }
                >
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-7 flex-1 overflow-y-auto">
          {days.map((day, idx) => {
            const items = getItemsForDate(day);
            return (
              <div
                key={idx}
                className={`p-3 space-y-2 ${idx < 6 ? "border-r border-gray-100" : ""}`}
              >
                {items.map((item) => {
                  const cfg =
                    STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                  return (
                    <div
                      key={item.application_id}
                      className={`p-3 rounded-xl border ${cfg.bg} ${cfg.border} cursor-pointer hover:shadow-sm transition`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                        <span
                          className={`text-xs font-semibold uppercase tracking-wide ${cfg.text}`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-gray-800 truncate">
                        {item.title}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Day view ──────────────────────────────────────────────────────────────
  const renderDayView = () => {
    const items = getItemsForDate(currentDate);
    return (
      <div className="p-6 space-y-3">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-300">
            <CalendarIcon size={48} strokeWidth={1} />
            <p className="mt-4 text-base font-medium">
              No orientations scheduled
            </p>
          </div>
        ) : (
          items.map((item) => {
            const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
            return (
              <div
                key={item.application_id}
                className={`flex items-center gap-4 p-4 rounded-2xl border ${cfg.bg} ${cfg.border}`}
              >
                <div className={`w-1 self-stretch rounded-full ${cfg.dot}`} />
                <div className="flex-1">
                  <div className="font-semibold text-gray-800 text-base">
                    {item.title}
                  </div>
                  <div className={`text-xs font-medium mt-0.5 ${cfg.text}`}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  {item.orientation_date}
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex"
      style={{
        fontFamily: "'DM Sans', 'Instrument Sans', system-ui, sans-serif",
        background: "#f4f5f7",
      }}
    >
      {/* ── Left Sidebar ── */}
      <aside className="w-72 shrink-0 bg-white border-r border-gray-100 flex flex-col p-5 gap-6">
        <div className="flex items-center gap-2 px-1 pt-1">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "#0f4a2f" }}
          >
            <CalendarIcon size={16} className="text-white" />
          </div>
          <span className="font-bold text-gray-900 tracking-tight text-lg">
            OrientCal
          </span>
        </div>

        {/* Mini month navigator */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700">
              {currentDate.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </span>
            <div className="flex gap-0.5">
              <button
                onClick={() => navigate("prev")}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => navigate("next")}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <div key={i} className="text-xs text-gray-300 font-semibold py-1">
                {d}
              </div>
            ))}
            {getDaysInMonth(currentDate).map((day, idx) => {
              const todayStr = toLocalDateStr(new Date());
              const isToday = toLocalDateStr(day) === todayStr;
              const isCurrent = day.getMonth() === currentDate.getMonth();
              const hasEvents = getItemsForDate(day).length > 0;
              return (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedDate(day);
                    setCurrentDate(day);
                  }}
                  className={`text-xs w-7 h-7 mx-auto flex items-center justify-center rounded-full transition font-medium relative
                    ${!isToday && isCurrent ? "text-gray-700 hover:bg-gray-100" : ""}
                    ${!isToday && !isCurrent ? "text-gray-300" : ""}`}
                  style={
                    isToday
                      ? { backgroundColor: "#0f4a2f", color: "white" }
                      : {}
                  }
                >
                  {day.getDate()}
                  {hasEvents && !isToday && (
                    <span
                      className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                      style={{ backgroundColor: "#0f4a2f" }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Status filter */}
        <div>
          <p className="text-xs font-semibold text-gray-400 tracking-widest uppercase mb-3">
            Filter by Status
          </p>
          <div className="space-y-1">
            {["all", "accepted", "pending", "rejected"].map((s) => {
              const cfg = s !== "all" ? STATUS_CONFIG[s] : null;
              const isActive = filterStatus === s;
              return (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition hover:opacity-90"
                  style={
                    isActive
                      ? { backgroundColor: "#0f4a2f", color: "white" }
                      : { color: "#4b5563" }
                  }
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${cfg ? cfg.dot : "bg-gray-300"}`}
                  />
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                  <span className="ml-auto text-xs opacity-60">
                    {s === "all"
                      ? data.length
                      : data.filter((i) => i.status === s).length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Upcoming agenda */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <p className="text-xs font-semibold text-gray-400 tracking-widest uppercase mb-3">
            Upcoming
          </p>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 rounded-xl bg-gray-100 animate-pulse"
                />
              ))}
            </div>
          ) : agendaItems.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              Nothing scheduled
            </p>
          ) : (
            <div className="space-y-2">
              {agendaItems.map((item) => {
                const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                // Parse date parts directly to avoid UTC shift in display
                const [yr, mo, dy] = item.orientation_date
                  .split("-")
                  .map(Number);
                const displayDate = new Date(yr, mo - 1, dy).toLocaleDateString(
                  "en-US",
                  {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  },
                );
                return (
                  <div
                    key={item.application_id}
                    className={`p-3 rounded-xl border ${cfg.bg} ${cfg.border} cursor-pointer hover:shadow-sm transition`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      <span className={`text-xs font-semibold ${cfg.text}`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-gray-800 truncate">
                      {item.title}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
                      <Clock size={10} />
                      {displayDate}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Calendar ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
              Calendar
            </h1>
            <p className="text-sm text-gray-400">
              View and manage your orientation schedule
            </p>
          </div>

          {/* Search */}
          <div
            className={`relative transition-all duration-300 ${showSearch ? "w-56" : "w-9"}`}
          >
            {showSearch ? (
              <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 gap-2">
                <Search size={14} className="text-gray-400 shrink-0" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search events…"
                  className="flex-1 bg-transparent py-2 text-sm outline-none text-gray-700 placeholder-gray-400"
                />
                <button
                  onClick={() => {
                    setShowSearch(false);
                    setSearchQuery("");
                  }}
                >
                  <X size={14} className="text-gray-400 hover:text-gray-600" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSearch(true)}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 transition"
              >
                <Search size={16} />
              </button>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-1.5 py-1">
            <button
              onClick={() => navigate("prev")}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm transition text-gray-500"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1 text-sm font-semibold text-gray-600 transition"
              onMouseEnter={(e) => (e.currentTarget.style.color = "#0f4a2f")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "")}
            >
              Today
            </button>
            <button
              onClick={() => navigate("next")}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm transition text-gray-500"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <span className="text-sm font-semibold text-gray-700 min-w-max">
            {headerLabel()}
          </span>

          {/* View switcher */}
          <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
            {(["month", "week", "day"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition
                  ${view === v ? "bg-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                style={view === v ? { color: "#0f4a2f" } : {}}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </header>

        {/* Calendar body */}
        <div className="flex-1 overflow-auto bg-white m-4 rounded-2xl border border-gray-100 shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                  style={{
                    borderColor: "#0f4a2f",
                    borderTopColor: "transparent",
                  }}
                />
                <span className="text-sm">Loading schedule…</span>
              </div>
            </div>
          ) : (
            <>
              {view === "month" && renderMonthView()}
              {view === "week" && renderWeekView()}
              {view === "day" && renderDayView()}
            </>
          )}
        </div>

        {/* Selected day detail panel */}
        {selectedDate && view === "month" && (
          <div className="mx-4 mb-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">
                {selectedDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h3>
              <button
                onClick={() => setSelectedDate(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
            {getItemsForDate(selectedDate).length === 0 ? (
              <p className="text-sm text-gray-400">
                No orientations on this day.
              </p>
            ) : (
              <div className="flex gap-3 flex-wrap">
                {getItemsForDate(selectedDate).map((item) => {
                  const cfg =
                    STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                  return (
                    <div
                      key={item.application_id}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${cfg.bg} ${cfg.border}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      <div>
                        <div className="font-semibold text-gray-800 text-sm">
                          {item.title}
                        </div>
                        <div className={`text-xs font-medium ${cfg.text}`}>
                          {item.status}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
