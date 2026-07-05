import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/constant/api.ts";
import {
  Bell,
  Check,
  X,
  AlertTriangle,
  Clock,
  Info,
  Trash2,
  CheckCheck,
  Filter,
  Search,
  Sparkles,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Mail,
  MailOpen,
  Calendar,
  Shield,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Notification {
  notification_id: number;
  type: 'alert' | 'success' | 'warning' | 'info';
  title: string;
  description: string;
  link: string | null;
  is_read: boolean;
  is_general: boolean;
  target_role: string | null;
  created_at: string;
}

interface TypeCounts {
  all: number;
  alert: number;
  success: number;
  warning: number;
  info: number;
}

// ─── Notification Type Config ─────────────────────────────────────────────────
const NOTIF_TYPE_CONFIG: Record<
  string,
  { icon: React.ReactNode; color: string; bg: string; border: string; gradient: string; label: string }
> = {
  alert: {
    icon: <AlertTriangle size={18} />,
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    gradient: "from-red-500 to-rose-500",
    label: "Alerts",
  },
  success: {
    icon: <Check size={18} />,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    gradient: "from-emerald-500 to-teal-500",
    label: "Success",
  },
  warning: {
    icon: <Clock size={18} />,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    gradient: "from-amber-500 to-orange-500",
    label: "Warnings",
  },
  info: {
    icon: <Info size={18} />,
    color: "text-sky-600",
    bg: "bg-sky-50",
    border: "border-sky-200",
    gradient: "from-sky-500 to-blue-500",
    label: "Info",
  },
};

// ─── Time Ago Helper ──────────────────────────────────────────────────────────
function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [typeCounts, setTypeCounts] = useState<TypeCounts>({ all: 0, alert: 0, success: 0, warning: 0, info: 0 });
  
  // Filters
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPage, setTotalPage] = useState(1);
  const [total, setTotal] = useState(0);
  const entries = 15;

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const params = new URLSearchParams({
        page: page.toString(),
        entries: entries.toString(),
      });
      
      if (readFilter === 'unread') params.append('unread_only', 'true');
      if (readFilter === 'read') params.append('read_only', 'true');
      if (typeFilter !== 'all') params.append('type', typeFilter);

      const res = await fetch(`${api}api/notifications/?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setNotifications(data.data || []);
        setUnreadCount(data.unread_count || 0);
        setTypeCounts(data.type_counts || { all: 0, alert: 0, success: 0, warning: 0, info: 0 });
        setTotalPage(data.total_page || 1);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [page, readFilter, typeFilter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [readFilter, typeFilter]);

  // Mark as read
  const handleMarkRead = async (id: number) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`${api}api/notifications/${id}/read/`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => n.notification_id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${api}api/notifications/mark-all-read/`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  // Dismiss notification
  const handleDismiss = async (id: number) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`${api}api/notifications/${id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const notif = notifications.find(n => n.notification_id === id);
      setNotifications(prev => prev.filter(n => n.notification_id !== id));
      if (notif && !notif.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("Failed to dismiss:", err);
    }
  };

  // Navigate to notification link
  const handleNavigate = (link: string | null) => {
    if (link) navigate(link);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50/30" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Barlow+Condensed:wght@600;700;800&display=swap');
        .page-title { font-family: 'Barlow Condensed', sans-serif; letter-spacing: -0.01em; }
        
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeInUp { animation: fadeInUp 0.5s ease forwards; }
        
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slideIn { animation: slideIn 0.3s ease forwards; }
        
        .notif-card {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .notif-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 40px rgba(5, 120, 0, 0.1);
        }
      `}</style>

      <div className="max-w-6xl mx-auto p-6">
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="mb-6 animate-fadeInUp">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
            >
              <ChevronLeft size={18} className="text-gray-600" />
            </button>
            <div className="flex-1">
              <h1 className="page-title text-3xl font-bold text-gray-800 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <Bell size={20} className="text-white" />
                </div>
                Notifications
                {unreadCount > 0 && (
                  <span className="bg-gradient-to-r from-red-500 to-rose-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg shadow-red-500/30">
                    {unreadCount} new
                  </span>
                )}
              </h1>
              <p className="text-sm text-gray-500 mt-1 ml-[52px]">
                Stay updated with your system activities and important alerts
              </p>
            </div>
          </div>
        </div>

        {/* ── Stats Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-fadeInUp" style={{ animationDelay: "0.1s" }}>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Bell size={18} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Total</p>
                <p className="text-2xl font-bold text-gray-800 page-title">{typeCounts.all}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center shadow-lg shadow-red-500/20">
                <Mail size={18} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Unread</p>
                <p className="text-2xl font-bold text-gray-800 page-title">{unreadCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-500 flex items-center justify-center shadow-lg shadow-sky-500/20">
                <AlertTriangle size={18} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Alerts</p>
                <p className="text-2xl font-bold text-gray-800 page-title">{typeCounts.alert}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Check size={18} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Success</p>
                <p className="text-2xl font-bold text-gray-800 page-title">{typeCounts.success}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Filter Bar ───────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm mb-6 animate-fadeInUp" style={{ animationDelay: "0.2s" }}>
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Read Status Tabs */}
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-400" />
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'unread', label: 'Unread' },
                  { key: 'read', label: 'Read' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setReadFilter(tab.key as any)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      readFilter === tab.key
                        ? "bg-white text-emerald-700 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Type Filter Chips */}
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                  typeFilter === 'all'
                    ? "bg-gray-800 text-white border-gray-800"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}
              >
                All Types ({typeCounts.all})
              </button>
              {(['alert', 'success', 'warning', 'info'] as const).map((type) => {
                const cfg = NOTIF_TYPE_CONFIG[type];
                return (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                      typeFilter === type
                        ? `bg-gradient-to-r ${cfg.gradient} text-white border-transparent shadow-md`
                        : `bg-white ${cfg.color} ${cfg.border} hover:shadow-sm`
                    }`}
                  >
                    {cfg.icon}
                    {cfg.label} ({typeCounts[type]})
                  </button>
                );
              })}
            </div>

            {/* Mark All Read */}
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors shadow-sm shadow-emerald-500/30 shrink-0"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>
        </div>

        {/* ── Notifications List ───────────────────────────────────────────── */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100">
              <Loader2 size={40} className="animate-spin text-emerald-600 mb-4" />
              <p className="text-gray-500 font-medium">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 animate-fadeInUp">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center mb-4 border border-emerald-100">
                <Sparkles size={40} className="text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2 page-title">All caught up!</h3>
              <p className="text-sm text-gray-500 text-center max-w-sm">
                {readFilter === 'unread' 
                  ? "You've read all your notifications. Great job staying updated!"
                  : "No notifications to display. Check back later for updates."}
              </p>
              {readFilter !== 'all' && (
                <button
                  onClick={() => { setReadFilter('all'); setTypeFilter('all'); }}
                  className="mt-4 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors"
                >
                  View all notifications
                </button>
              )}
            </div>
          ) : (
            <>
              {notifications.map((n, i) => {
                const cfg = NOTIF_TYPE_CONFIG[n.type] || NOTIF_TYPE_CONFIG.info;
                return (
                  <div
                    key={n.notification_id}
                    className={`notif-card bg-white rounded-2xl border p-5 cursor-pointer relative overflow-hidden animate-slideIn ${
                      n.is_read ? "border-gray-100 opacity-75" : `${cfg.border} shadow-sm`
                    }`}
                    style={{ animationDelay: `${i * 0.03}s` }}
                    onClick={() => {
                      if (!n.is_read) handleMarkRead(n.notification_id);
                      if (n.link) handleNavigate(n.link);
                    }}
                  >
                    {/* Unread indicator bar */}
                    {!n.is_read && (
                      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${cfg.gradient}`} />
                    )}

                    <div className="flex gap-4 items-start">
                      {/* Icon */}
                      <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                        {cfg.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className={`text-base font-bold ${n.is_read ? "text-gray-700" : "text-gray-900"}`}>
                              {n.title}
                            </h3>
                            {n.is_general && (
                              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200">
                                Announcement
                              </span>
                            )}
                            {!n.is_read && (
                              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r ${cfg.gradient} text-white`}>
                                New
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-gray-400 shrink-0">
                            <Calendar size={12} />
                            <span className="text-[11px] font-medium">{timeAgo(n.created_at)}</span>
                          </div>
                        </div>

                        {n.description && (
                          <p className="text-sm text-gray-600 leading-relaxed mb-2">
                            {n.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-3 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <Clock size={11} />
                              {formatDate(n.created_at)}
                            </span>
                            {n.link && (
                              <span className={`flex items-center gap-1 font-semibold ${cfg.color}`}>
                                Click to view details →
                              </span>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {!n.is_read && (
                              <button
                                onClick={() => handleMarkRead(n.notification_id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold transition-colors border border-emerald-200"
                                title="Mark as read"
                              >
                                <MailOpen size={12} />
                                Mark read
                              </button>
                            )}
                            <button
                              onClick={() => handleDismiss(n.notification_id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition-colors border border-red-200"
                              title="Dismiss"
                            >
                              <Trash2 size={12} />
                              Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* ── Pagination ───────────────────────────────────────────────────── */}
        {totalPage > 1 && !loading && notifications.length > 0 && (
          <div className="mt-6 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center justify-between animate-fadeInUp">
            <p className="text-sm text-gray-500">
              Showing <span className="font-semibold text-gray-700">{(page - 1) * entries + 1}</span> to{' '}
              <span className="font-semibold text-gray-700">{Math.min(page * entries, total)}</span> of{' '}
              <span className="font-semibold text-gray-700">{total}</span> notifications
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm font-medium"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              {Array.from({ length: Math.min(5, totalPage) }, (_, i) => {
                let pageNum = totalPage <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPage - 2 ? totalPage - 4 + i : page - 2 + i;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-9 h-9 rounded-lg border text-sm font-semibold transition-all ${
                      pageNum === page
                        ? "bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/30"
                        : "text-gray-700 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                disabled={page >= totalPage}
                onClick={() => setPage(p => Math.min(totalPage, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm font-medium"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}