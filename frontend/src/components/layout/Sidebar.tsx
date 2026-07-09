import {
  LayoutDashboard,
  Satellite,
  BarChart3,
  Users,
  LogOut,
  ChevronLeft,
  Map,
  ListCheck,
  MonitorDot,
  Calendar,
  Bell,
  ChevronDown,
  Mail,
  User,
  Settings,
  Check,
  X,
  Shield,
  Clock,
  AlertTriangle,
  Leaf,
  Info,
  Sparkles,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import logo from "../../assets/logo.png";
import { useState, useRef, useEffect, useCallback } from "react";
import Logout from "./logout";
import { Outlet } from "react-router-dom";
import PlantScopeLoader from "../alert/PlantScopeLoader";
import NotFoundPage from "./NotFoundPage";
import { useAuthorize } from "../../hooks/authorization";
import { useNavigate } from "react-router-dom";
import { api } from "@/constant/api.ts";
import "../../global css/sidebarScrollbar.css";

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserData {
  id: number;
  email: string;
  profile_img: string;
  full_name: string;
  user_role: string;
}

interface Notification {
  notification_id: number;
  type: 'alert' | 'success' | 'warning' | 'info';
  title: string;
  description: string;
  link: string | null;
  is_read: boolean;
  is_general: boolean;
  created_at: string;
}

// ─── Notification Type Config ─────────────────────────────────────────────────
const NOTIF_TYPE_CONFIG: Record<
  string,
  { icon: React.ReactNode; color: string; bg: string; dot: string; border: string }
> = {
  alert: {
    icon: <AlertTriangle size={14} />,
    color: "text-red-400",
    bg: "bg-red-500/10",
    dot: "bg-red-400",
    border: "border-red-500/20",
  },
  success: {
    icon: <Check size={14} />,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    dot: "bg-emerald-400",
    border: "border-emerald-500/20",
  },
  warning: {
    icon: <Clock size={14} />,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    dot: "bg-amber-400",
    border: "border-amber-500/20",
  },
  info: {
    icon: <Info size={14} />,
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    dot: "bg-sky-400",
    border: "border-sky-500/20",
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
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function initials(name: string): string {
  return (name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function useOutsideClick(ref: React.RefObject<HTMLDivElement>, cb: () => void) {
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [ref, cb]);
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function UserAvatar({
  user,
  size = "sm",
}: {
  user: UserData | null;
  size?: "sm" | "lg";
}) {
  const dim =
    size === "lg"
      ? "w-12 h-12 text-base rounded-xl"
      : "w-8 h-8 text-[12px] rounded-lg";

  if (user?.profile_img) {
    return (
      <img
        src={user.profile_img}
        alt={user.full_name ?? "avatar"}
        className={`${dim} object-cover bg-gradient-to-br from-emerald-400 to-teal-600 shadow-md shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${dim} bg-gradient-to-br from-emerald-400 to-teal-600
      flex items-center justify-center text-white font-bold shadow-md shrink-0`}
    >
      {initials(user?.full_name ?? "")}
    </div>
  );
}

// ─── Modern Notification Panel ────────────────────────────────────────────────
interface NotifPanelProps {
  notes: Notification[];
  unreadCount: number;
  loading: boolean;
  onMarkAll: () => void;
  onMarkRead: (id: number) => void;
  onDismiss: (id: number) => void;
  onClose: () => void;
  onNavigate: (link: string) => void;
  onViewAll: () => void;
}

function NotificationPanel({
  notes,
  unreadCount,
  loading,
  onMarkAll,
  onMarkRead,
  onDismiss,
  onClose,
  onNavigate,
  onViewAll,
}: NotifPanelProps) {
  return (
    <div
      className="absolute right-0 top-full mt-3 w-[400px] z-50
      bg-gradient-to-b from-[#0a3320]/98 to-[#082818]/98 backdrop-blur-2xl 
      border border-white/10 rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.7)] 
      overflow-hidden animate-slideDown"
    >
      {/* Header */}
      <div className="relative px-5 py-4 border-b border-white/10 bg-gradient-to-r from-emerald-500/10 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Bell size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">Notifications</h3>
              <p className="text-white/40 text-[10px]">Stay updated with your activity</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <>
                <span className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg shadow-emerald-500/30">
                  {unreadCount} NEW
                </span>
                <button
                  onClick={onMarkAll}
                  className="text-[11px] text-emerald-300 hover:text-emerald-200 transition-colors cursor-pointer font-semibold px-2 py-1 rounded-lg hover:bg-white/5"
                >
                  Mark all
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white/80 transition-colors p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Notification List */}
      <div className="max-h-[440px] overflow-y-auto notif-scroll">
        {loading ? (
          <div className="py-16 flex flex-col items-center gap-3 text-white/30">
            <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            <span className="text-xs">Loading notifications...</span>
          </div>
        ) : notes.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-white/30">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
              <Sparkles size={28} className="text-white/20" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-white/50">All caught up!</p>
              <p className="text-[11px] text-white/30 mt-1">No new notifications</p>
            </div>
          </div>
        ) : (
          <div className="py-2">
            {notes.map((n) => {
              const cfg = NOTIF_TYPE_CONFIG[n.type] || NOTIF_TYPE_CONFIG.info;
              return (
                <div
                  key={n.notification_id}
                  className={`relative group flex gap-3 px-5 py-3.5 border-b border-white/[0.04] 
                    transition-all duration-200 cursor-pointer
                    ${n.is_read ? "opacity-60" : "hover:bg-white/[0.04]"}
                    ${!n.is_read ? "bg-white/[0.02]" : ""}
                  `}
                  onClick={() => {
                    if (!n.is_read) onMarkRead(n.notification_id);
                    if (n.link) onNavigate(n.link);
                  }}
                >
                  {!n.is_read && (
                    <span className={`absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${cfg.dot} shadow-lg shadow-current`} />
                  )}

                  <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${cfg.bg} ${cfg.color} mt-0.5 border ${cfg.border}`}>
                    {cfg.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-[13px] font-semibold leading-tight ${n.is_read ? "text-white/70" : "text-white"}`}>
                        {n.title}
                      </p>
                      <span className="text-white/25 text-[10px] shrink-0 mt-0.5">
                        {timeAgo(n.created_at)}
                      </span>
                    </div>
                    {n.description && (
                      <p className="text-white/45 text-[11.5px] mt-1 leading-snug line-clamp-2">
                        {n.description}
                      </p>
                    )}
                    {n.link && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <span className="text-emerald-400/70 text-[10px] font-semibold">
                          Open →
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismiss(n.notification_id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-white/70 shrink-0 cursor-pointer p-1 rounded-lg hover:bg-white/10 mt-0.5"
                    title="Dismiss"
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/10 bg-gradient-to-r from-transparent to-emerald-500/5">
        <div className="flex items-center gap-2">
          <button 
            onClick={onViewAll}
            className="flex-1 text-center text-[12px] text-emerald-300/80 hover:text-emerald-200 transition-colors cursor-pointer font-semibold py-1.5 rounded-lg hover:bg-white/5 flex items-center justify-center gap-1.5"
          >
            View all notifications →
          </button>
          <button 
            onClick={onClose}
            className="text-[12px] text-white/50 hover:text-white/80 transition-colors cursor-pointer font-semibold py-1.5 px-3 rounded-lg hover:bg-white/5"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Profile Dropdown ─────────────────────────────────────────────────────────
interface ProfileDropdownProps {
  user: UserData | null;
  onLogout: () => void;
  onNavigate: (path: string) => void;
}

function ProfileDropdown({ user, onLogout, onNavigate }: ProfileDropdownProps) {
  return (
    <div
      className="absolute right-0 top-full mt-3 w-[280px] z-9999
      bg-[#0a3320]/95 backdrop-blur-xl border border-white/10
      rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.6)] overflow-hidden
      animate-slideDown"
    >
      {/* User card */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <UserAvatar user={user} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-white font-semibold text-[14px] truncate">
              {user?.full_name ?? "—"}
            </p>
            <p
              className="text-white/45 text-[11.5px] truncate"
              title={user?.email}
            >
              {user?.email ?? "—"}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400/80 text-[11px] font-medium">
                {user?.user_role ?? "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Menu items */}
      <div className="py-2">
        {[
          {
            icon: <User size={14} />,
            label: "My Profile",
            sub: "View & edit info",
            path: "/my-profile",
          },
        
        ].map((item) => (
          <button
            key={item.label}
            onClick={() => item.path && onNavigate(item.path)}
            className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors text-left cursor-pointer group"
          >
            <span className="text-white/40 group-hover:text-emerald-400 transition-colors">
              {item.icon}
            </span>
            <div>
              <p className="text-white/80 text-[13px] group-hover:text-white transition-colors">
                {item.label}
              </p>
              <p className="text-white/30 text-[11px]">{item.sub}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Sign out */}
      <div className="border-t border-white/10 p-2">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-red-500/10 transition-colors text-left cursor-pointer group"
        >
          <LogOut
            size={14}
            className="text-red-400/60 group-hover:text-red-400 transition-colors"
          />
          <span className="text-red-400/60 group-hover:text-red-400 text-[13px] transition-colors">
            Sign out
          </span>
        </button>
      </div>
    </div>
  );
}

// ─── Sidebar City ENRO Head ───────────────────────────────────────────────────
export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLogout, setIsLogout] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  
  // Badge counts
  const [pendingHeadCount, setPendingHeadCount] = useState(0);
  
  // Notification state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);

  const notifRef: any = useRef<HTMLDivElement>(null);
  const profileRef: any = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const notifIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);
  
  useOutsideClick(notifRef, () => setShowNotifs(false));
  useOutsideClick(profileRef, () => setShowProfile(false));

  // ── Auth + real user data ──────────────────────────────────────────────────
  const { isAuthorized, isLoading, user_data } = useAuthorize("CityENROHead");

  // ── Fetch pending count function ───────────────────────────────────────────
  const fetchPendingCount = useCallback(async () => {
    if (isFetchingRef.current) return;
    if (document.hidden) return;
    if (!isAuthorized) return;

    isFetchingRef.current = true;
    
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`${api}api/get_pending_head_count/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setPendingHeadCount(data.pending_count || 0);
      }
    } catch (err) {
      console.error("Failed to fetch pending count:", err);
    } finally {
      isFetchingRef.current = false;
    }
  }, [isAuthorized]);

  // ── Fetch notifications (full list) ────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    if (document.hidden) return;
    if (!isAuthorized) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`${api}api/notifications/?entries=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setNotifications(data.data || []);
        setUnreadNotifCount(data.unread_count || 0);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  }, [isAuthorized]);

  // ── Fetch unread count only (lightweight for polling) ──────────────────────
  const fetchUnreadCount = useCallback(async () => {
    if (document.hidden) return;
    if (!isAuthorized) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`${api}api/notifications/unread-count/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setUnreadNotifCount(data.unread_count || 0);
      }
    } catch (err) {
      console.error("Failed to fetch unread count:", err);
    }
  }, [isAuthorized]);

  // ── Mark notification as read ──────────────────────────────────────────────
  const handleMarkRead = async (id: number) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`${api}api/notifications/${id}/read/`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => n.notification_id === id ? { ...n, is_read: true } : n));
      setUnreadNotifCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  // ── Mark all as read ───────────────────────────────────────────────────────
  const handleMarkAllRead = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${api}api/notifications/mark-all-read/`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadNotifCount(0);
      }
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  // ── Dismiss notification ───────────────────────────────────────────────────
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
        setUnreadNotifCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("Failed to dismiss notification:", err);
    }
  };

  // ── Navigate from notification ─────────────────────────────────────────────
  const handleNotifNavigate = (link: string) => {
    setShowNotifs(false);
    navigate(link);
  };

  // ── View all notifications ─────────────────────────────────────────────────
  const handleViewAll = () => {
    setShowNotifs(false);
    navigate('/notification');
  };

  // ── Smart polling for pending counts ───────────────────────────────────────
  useEffect(() => {
    if (!isAuthorized) {
      setPendingHeadCount(0);
      return;
    }

    fetchPendingCount();
    intervalRef.current = setInterval(() => fetchPendingCount(), 60000);

    const handleVisibilityChange = () => { if (!document.hidden) fetchPendingCount(); };
    const handleFocus = () => fetchPendingCount();
    const handleNavigation = () => fetchPendingCount();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('popstate', handleNavigation);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('popstate', handleNavigation);
    };
  }, [isAuthorized, fetchPendingCount]);

  // ── Smart polling for notifications ────────────────────────────────────────
  useEffect(() => {
    if (!isAuthorized) {
      setNotifications([]);
      setUnreadNotifCount(0);
      return;
    }

    // Initial full fetch
    setNotifLoading(true);
    fetchNotifications().finally(() => setNotifLoading(false));

    // Poll unread count every 60s (lightweight)
    notifIntervalRef.current = setInterval(() => fetchUnreadCount(), 60000);

    const handleVisibilityChange = () => { 
      if (!document.hidden) {
        fetchUnreadCount();
        fetchNotifications();
      }
    };
    const handleFocus = () => {
      fetchUnreadCount();
      fetchNotifications();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      if (notifIntervalRef.current) clearInterval(notifIntervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isAuthorized, fetchNotifications, fetchUnreadCount]);

  if (isLoading) return <PlantScopeLoader />;
  if (!localStorage.getItem("token")) {
    navigate("/Login");
    return null;
  }
  if (!isAuthorized) return <NotFoundPage />;

  const PAGE_TITLES: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/map": "Map",
    "/applications": "Applications",
    "/calendar": "Calendar",
    "/monitoring": "Monitoring",
    "/reports": "Report",
    "/Log-trail": "Audit Trail",
    "/account-management": "Accounts",
    "/tree-growers": "Tree Growers",
    "/notification": "Notifications",
  };
  const pageTitle = PAGE_TITLES[location.pathname] ?? "PlantScope";

  // ── Grouped Navigation Items ───────────────────────────────────────────────
  const navGroups = [
    {
      title: "Main",
      items: [
        { to: "/dashboard", icon: <LayoutDashboard size={18} />, label: "Dashboard", badge: null },
        { to: "/map", icon: <Map size={18} />, label: "Map", badge: null },
      ],
    },
    {
      title: "Management",
      items: [
        { 
          to: "/applications", 
          icon: <ListCheck size={18} />, 
          label: "Applications", 
          badge: pendingHeadCount > 0 ? pendingHeadCount : null 
        },
        { to: "/calendar", icon: <Calendar size={18} />, label: "Calendar", badge: null },
        { to: "/monitoring", icon: <MonitorDot size={18} />, label: "Monitoring", badge: null },
      ],
    },
    {
      title: "Analytics",
      items: [
        { to: "/reports", icon: <BarChart3 size={18} />, label: "Report", badge: null },
        { to: "/Log-trail", icon: <Satellite size={18} />, label: "Audit Trail", badge: null },
      ],
    },
    {
      title: "Administration",
      items: [
        { to: "/account-management", icon: <Users size={18} />, label: "Accounts", badge: null },
        { to: "/tree-growers", icon: <Leaf size={18} />, label: "Tree Growers", badge: null },
      ],
    },
  ];

  return (
    <div className="flex">
      {/* ── Global styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
        .ps-header * { font-family: 'DM Sans', sans-serif; }
        .ps-title    { font-family: 'Syne', sans-serif; }

        @keyframes ps-slideDown {
          from { opacity:0; transform:translateY(-8px) scale(0.98); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        .animate-slideDown { animation: ps-slideDown 0.18s ease forwards; }

        .glass-btn {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.09);
          backdrop-filter: blur(12px);
          transition: background .2s, border-color .2s, transform .15s;
        }
        .glass-btn:hover {
          background: rgba(255,255,255,0.11);
          border-color: rgba(255,255,255,0.18);
          transform: translateY(-1px);
        }
        .glass-btn:active { transform: translateY(0); }

        @keyframes notif-pulse {
          0%  { box-shadow: 0 0 0 0   rgba(74,222,128,.6); }
          60% { box-shadow: 0 0 0 7px rgba(74,222,128,0);  }
          100%{ box-shadow: 0 0 0 0   rgba(74,222,128,0);  }
        }
        .notif-ring { animation: notif-pulse 2.2s ease infinite; }

        @keyframes badge-pulse {
          0%  { box-shadow: 0 0 0 0   rgba(239,68,68,.5); }
          60% { box-shadow: 0 0 0 4px rgba(239,68,68,0);  }
          100%{ box-shadow: 0 0 0 0   rgba(239,68,68,0);  }
        }
        .badge-pulse { animation: badge-pulse 2s ease infinite; }

        .notif-scroll::-webkit-scrollbar       { width:4px; }
        .notif-scroll::-webkit-scrollbar-track { background:transparent; }
        .notif-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,.1); border-radius:99px; }
        .notif-scroll::-webkit-scrollbar-thumb:hover { background:rgba(255,255,255,.2); }

        .hdr-divider {
          width:1px; height:28px;
          background: linear-gradient(to bottom, transparent, rgba(255,255,255,.15), transparent);
        }

        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>

      <Logout setIsLogout={setIsLogout} isLogout={isLogout} />

      {/* ── Sidebar ── */}
      <div
        className={`sticky top-0 pt-0 pb-0 h-screen bg-gradient-to-b from-[#0F4A2F] to-[#0a3a24] text-white flex flex-col justify-between shadow-2xl transition-all duration-500 ease-in-out ${
          expanded ? "p-3 w-[260px] min-w-[260px]" : "p-2 w-[80px] min-w-[80px]"
        }`}
      >
        {/* Logo / brand */}
        <div className="p-3 mb-3 flex flex-row items-center border-b border-white/10">
          <img
            src={logo}
            alt="Logo"
            className="w-10 h-10 object-cover rounded-xl border-2 border-white/30 cursor-pointer shrink-0 shadow-lg"
            onClick={() => setExpanded(!expanded)}
          />
          {expanded && (
            <>
              <div className="ml-3 flex-1">
                <h1 className="text-lg font-bold tracking-wide leading-tight text-white">
                  PlantScope
                </h1>
                <p className="text-[9px] text-emerald-300/70 uppercase tracking-wider">
                  ENRO Ormoc City
                </p>
              </div>
              <button
                className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer transition-all"
                onClick={() => setExpanded(!expanded)}
              >
                <ChevronLeft size={16} />
              </button>
            </>
          )}
        </div>

        {/* Nav groups */}
        <div className="flex-1 overflow-y-auto sidebar-scrollbar">
          <nav className="flex flex-col gap-4">
            {navGroups.map((group) => (
              <div key={group.title} className="flex flex-col">
                {expanded && (
                  <div className="mb-2 px-3">
                    <p className="text-[10px] font-bold text-emerald-300/60 uppercase tracking-wider">
                      {group.title}
                    </p>
                    <div className="mt-1 h-px bg-gradient-to-r from-emerald-500/30 to-transparent" />
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  {group.items.map(({ to, icon, label, badge }) => {
                    const isActive = location.pathname === to;
                    const hasBadge = badge !== null && badge > 0;
                    
                    return (
                      <Link
                        key={to}
                        to={to}
                        onClick={() => {
                          if (to === "/applications") fetchPendingCount();
                        }}
                        className={`flex items-center transition-all duration-200 rounded-xl px-3 py-2.5 relative group
                          ${location.pathname === to
                            ? "bg-white/20 text-white shadow-lg"
                            : "text-white/70 hover:bg-white/10 hover:text-white"
                          }`}
                      >
                        <span className="shrink-0">{icon}</span>
                        {expanded && (
                          <>
                            <span className="ml-3 text-sm font-medium flex-1">
                              {label}
                            </span>
                            {hasBadge && (
                              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md min-w-[18px] h-[18px] flex items-center justify-center badge-pulse shadow-md">
                                {badge > 9 ? '9+' : badge}
                              </span>
                            )}
                          </>
                        )}
                        {!expanded && hasBadge && (
                          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Footer version tag */}
        {expanded && (
          <div className="border-t border-white/10 pt-3 mt-3">
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-white/60">v1.0.0</span>
              </div>
              <span className="text-[10px] text-white/40">ENRO</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden bg-[#f5faf6]">
        {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
        <header
          className="ps-header bg-gradient-to-r from-[#0b3622] via-[#0d4028] to-[#0F4A2F]
          border-b border-white/[0.07] px-6 h-[68px] flex items-center gap-4
          shadow-[0_4px_40px_rgba(0,0,0,0.35)] z-9998"
        >
          {/* Left — page title */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-1 h-8 rounded-full bg-gradient-to-b from-emerald-400 to-teal-500 shrink-0" />
            <div className="min-w-0">
              <h1 className="ps-title text-white text-[21px] font-extrabold tracking-tight leading-none">
                {pageTitle}
              </h1>
              <p className="text-white/30 text-[10.5px] mt-0.5 tracking-widest uppercase font-medium">
                City Environment &amp; Natural Resources Office
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 glass-btn rounded-full px-3 py-1.5 ml-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400/80 text-[11px] font-semibold tracking-wide">
                LIVE
              </span>
            </div>
          </div>

          {/* Right — actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Date */}
            <div className="hidden lg:flex items-center gap-2 glass-btn rounded-xl px-3.5 py-2">
              <Clock size={12} className="text-white/40" />
              <span className="text-white/50 text-[12px] font-medium">
                {new Date().toLocaleDateString("en-PH", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>

            <div className="hdr-divider mx-1 hidden lg:block" />

            {/* Bell - Real Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => {
                  setShowNotifs((v) => !v);
                  setShowProfile(false);
                }}
                className="glass-btn relative w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer"
              >
                <Bell size={16} className="text-white/70" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-gradient-to-r from-red-500 to-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center notif-ring shadow-lg shadow-red-500/30">
                    {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                  </span>
                )}
              </button>
              {showNotifs && (
                <NotificationPanel
                  notes={notifications}
                  unreadCount={unreadNotifCount}
                  loading={notifLoading}
                  onMarkAll={handleMarkAllRead}
                  onMarkRead={handleMarkRead}
                  onDismiss={handleDismiss}
                  onClose={() => setShowNotifs(false)}
                  onNavigate={handleNotifNavigate}
                  onViewAll={handleViewAll}
                />
              )}
            </div>

            <div className="hdr-divider mx-1" />

            {/* Profile button */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => {
                  setShowProfile((v) => !v);
                  setShowNotifs(false);
                }}
                className="glass-btn flex items-center gap-2.5 rounded-xl pl-1.5 pr-3 py-1.5 cursor-pointer"
              >
                <UserAvatar user={user_data ?? null} size="sm" />
                <div className="hidden sm:block text-left min-w-0">
                  <p className="text-white/90 text-[12px] font-semibold leading-tight truncate max-w-[110px]">
                    {user_data?.full_name ?? "—"}
                  </p>
                  <p className="text-white/35 text-[10.5px] truncate max-w-[110px]">
                    {user_data?.email ?? "—"}
                  </p>
                </div>
                <ChevronDown
                  size={12}
                  className={`text-white/35 hidden sm:block transition-transform duration-200 ${showProfile ? "rotate-180" : ""}`}
                />
              </button>

              {showProfile && (
                <ProfileDropdown
                  user={user_data ?? null}
                  onLogout={() => setIsLogout(true)}
                  onNavigate={(path) => {
                    setShowProfile(false);
                    navigate(path);
                  }}
                />
              )}
            </div>
          </div>
        </header>
        {/* ══ END HEADER ══════════════════════════════════════════════════════ */}

        <Outlet />
      </main>
    </div>
  );
}