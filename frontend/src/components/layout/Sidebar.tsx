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

// ─── Mock Notifications (replace with real API) ───────────────────────────────
const INITIAL_NOTIFICATIONS = [
  {
    id: 1,
    type: "alert",
    title: "New Application Submitted",
    desc: "Reforestation permit #2024-089 awaiting review.",
    time: "2 min ago",
    read: false,
  },
  {
    id: 2,
    type: "success",
    title: "Monitoring Report Ready",
    desc: "Site BNY-03 monthly report has been generated.",
    time: "1 hr ago",
    read: false,
  },
  {
    id: 3,
    type: "warning",
    title: "Calendar Reminder",
    desc: "Field inspection scheduled for tomorrow, 8:00 AM.",
    time: "3 hr ago",
    read: false,
  },
  {
    id: 4,
    type: "info",
    title: "Account Updated",
    desc: "Ranger Cruz's access level was modified by admin.",
    time: "Yesterday",
    read: true,
  },
  {
    id: 5,
    type: "success",
    title: "Tree Planting Logged",
    desc: "480 seedlings recorded in Area MNL-07.",
    time: "2 days ago",
    read: true,
  },
];

const NOTIF_TYPE_CONFIG: Record<
  string,
  { icon: React.ReactNode; color: string; bg: string; dot: string }
> = {
  alert: {
    icon: <AlertTriangle size={13} />,
    color: "text-red-400",
    bg: "bg-red-500/10",
    dot: "bg-red-400",
  },
  success: {
    icon: <Check size={13} />,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    dot: "bg-emerald-400",
  },
  warning: {
    icon: <Clock size={13} />,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    dot: "bg-amber-400",
  },
  info: {
    icon: <Shield size={13} />,
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    dot: "bg-sky-400",
  },
};

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
        className={`${dim} object-cover bg-gradient-to-br from-emerald-400 to-teal-600 shadow-md`}
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

// ─── Notification Panel ───────────────────────────────────────────────────────
interface NotifPanelProps {
  notes: typeof INITIAL_NOTIFICATIONS;
  onMarkAll: () => void;
  onDismiss: (id: number) => void;
  onClose: () => void;
}

function NotificationPanel({
  notes,
  onMarkAll,
  onDismiss,
  onClose,
}: NotifPanelProps) {
  const unread = notes.filter((n) => !n.read).length;
  return (
    <div
      className="absolute right-0 top-full mt-3 w-[360px] z-50
      bg-[#0a3320]/95 backdrop-blur-xl border border-white/10
      rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.6)] overflow-hidden
      animate-slideDown"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold text-sm">
            Notifications
          </span>
          {unread > 0 && (
            <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {unread} NEW
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button
              onClick={onMarkAll}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 transition-colors p-1 rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-[380px] overflow-y-auto notif-scroll">
        {notes.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-3 text-white/30">
            <Bell size={26} />
            <span className="text-sm">No notifications</span>
          </div>
        ) : (
          notes.map((n) => {
            const cfg = NOTIF_TYPE_CONFIG[n.type];
            return (
              <div
                key={n.id}
                className={`relative flex gap-3 px-5 py-3.5 border-b border-white/[0.05] transition-colors group
                ${n.read ? "opacity-50" : "hover:bg-white/[0.04]"}`}
              >
                {!n.read && (
                  <span
                    className={`absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${cfg.dot}`}
                  />
                )}
                <div
                  className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${cfg.bg} ${cfg.color} mt-0.5`}
                >
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/90 text-[13px] font-medium leading-tight">
                    {n.title}
                  </p>
                  <p className="text-white/45 text-[11.5px] mt-0.5 leading-snug">
                    {n.desc}
                  </p>
                  <span className="text-white/25 text-[11px] mt-1 block">
                    {n.time}
                  </span>
                </div>
                <button
                  onClick={() => onDismiss(n.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-white/70 shrink-0 cursor-pointer mt-1"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/10 text-center">
        <button className="text-[12px] text-emerald-400/70 hover:text-emerald-300 transition-colors cursor-pointer">
          View all notifications →
        </button>
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
          {
            icon: <Mail size={14} />,
            label: "Inbox",
            sub: "3 unread messages",
            path: null,
          },
          {
            icon: <Settings size={14} />,
            label: "Settings",
            sub: "Preferences & security",
            path: null,
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

// ─── Sidebar ──────────────────────────────────────────────────────────────────
export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLogout, setIsLogout] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [pendingHeadCount, setPendingHeadCount] = useState(0);

  const notifRef: any = useRef<HTMLDivElement>(null);
  const profileRef: any = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);
  
  useOutsideClick(notifRef, () => setShowNotifs(false));
  useOutsideClick(profileRef, () => setShowProfile(false));

  const { isAuthorized, isLoading, user_data } = useAuthorize("CityENROHead");

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

  if (isLoading) return <PlantScopeLoader />;
  if (!localStorage.getItem("token")) {
    navigate("/Login");
    return null;
  }
  if (!isAuthorized) return <NotFoundPage />;

  const unread = notifications.filter((n) => !n.read).length;

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
  };
  const pageTitle = PAGE_TITLES[location.pathname] ?? "PlantScope";

  const navGroups = [
    {
      title: "Main",
      items: [
        { to: "/dashboard", icon: <LayoutDashboard size={20} />, label: "Dashboard", badge: null },
        { to: "/map", icon: <Map size={20} />, label: "Map", badge: null },
      ],
    },
    {
      title: "Management",
      items: [
        { to: "/applications", icon: <ListCheck size={20} />, label: "Applications", badge: pendingHeadCount > 0 ? pendingHeadCount : null },
        { to: "/calendar", icon: <Calendar size={20} />, label: "Calendar", badge: null },
        { to: "/monitoring", icon: <MonitorDot size={20} />, label: "Monitoring", badge: null },
      ],
    },
    {
      title: "Analytics",
      items: [
        { to: "/reports", icon: <BarChart3 size={20} />, label: "Report", badge: null },
        { to: "/Log-trail", icon: <Satellite size={20} />, label: "Audit Trail", badge: null },
      ],
    },
    {
      title: "Administration",
      items: [
        { to: "/account-management", icon: <Users size={20} />, label: "Accounts", badge: null },
        { to: "/tree-growers", icon: <Leaf size={20} />, label: "Tree Growers", badge: null },
      ],
    },
  ];

  return (
    <div className="flex">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
        .ps-header * { font-family: 'Inter', sans-serif; }
        .ps-title { font-family: 'Syne', sans-serif; }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-slideDown { animation: slideDown 0.2s ease forwards; }

        @keyframes badgePulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }
        .badge-pulse { animation: badgePulse 2s ease-in-out infinite; }

        .sidebar-scrollbar::-webkit-scrollbar { width: 4px; }
        .sidebar-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .sidebar-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }

        .nav-item {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .nav-item:hover {
          transform: translateX(4px);
        }
        .nav-item.active {
          background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%);
        }
      `}</style>

      <Logout setIsLogout={setIsLogout} isLogout={isLogout} />

      {/* ── Modern Sidebar ─────────────────────────────────────────────────── */}
      <aside
        className={`sticky top-0 h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col shadow-2xl transition-all duration-500 ease-out ${
          expanded ? "w-72" : "w-20"
        }`}
      >
        {/* Logo Section */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 p-0.5 shadow-lg shadow-emerald-500/20">
                <img src={logo} alt="Logo" className="w-full h-full rounded-[10px] object-cover bg-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-800" />
            </div>
            
            {expanded && (
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-white tracking-tight truncate">
                  PlantScope
                </h1>
                <p className="text-xs text-emerald-400/80 font-medium truncate">
                  ENRO Ormoc City
                </p>
              </div>
            )}
            
            <button
              onClick={() => setExpanded(!expanded)}
              className={`p-2 rounded-lg hover:bg-white/10 transition-all duration-200 ${!expanded && 'mx-auto'}`}
            >
              {expanded ? (
                <ChevronLeft size={18} className="text-white/60" />
              ) : (
                <ChevronLeft size={18} className="text-white/60 rotate-180" />
              )}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto sidebar-scrollbar p-4 space-y-6">
          {navGroups.map((group) => (
            <div key={group.title}>
              {expanded && (
                <div className="mb-3 px-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-semibold">
                    {group.title}
                  </p>
                </div>
              )}
              
              <div className="space-y-1">
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
                      className={`nav-item group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer relative overflow-hidden ${
                        isActive
                          ? "active bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                      } ${!expanded && 'justify-center'}`}
                    >
                      {/* Active indicator */}
                      {isActive && expanded && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-emerald-500 rounded-r-full" />
                      )}
                      
                      {/* Icon */}
                      <span className={`relative shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-white'}`}>
                        {icon}
                        {isActive && (
                          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/20" />
                        )}
                      </span>
                      
                      {/* Label */}
                      {expanded && (
                        <span className="flex-1 text-sm font-medium truncate">
                          {label}
                        </span>
                      )}
                      
                      {/* Badge */}
                      {expanded && hasBadge && (
                        <span className="relative shrink-0">
                          <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-gradient-to-r from-red-500 to-rose-500 text-white text-[10px] font-bold rounded-full badge-pulse shadow-lg shadow-red-500/30">
                            {badge > 9 ? '9+' : badge}
                          </span>
                        </span>
                      )}
                      
                      {/* Collapsed badge dot */}
                      {!expanded && hasBadge && (
                        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        {expanded && (
          <div className="p-4 border-t border-white/10">
            <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 rounded-xl p-3 border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-500/50" />
                  <span className="text-xs font-semibold text-white">System Online</span>
                </div>
                <span className="text-[10px] text-slate-400">v1.0.0</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>ENRO Ormoc</span>
                <span>2024</span>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden bg-gradient-to-br from-slate-50 to-slate-100">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-8 h-[72px] flex items-center gap-6 sticky top-0 z-50 shadow-sm">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-1.5 h-10 rounded-full bg-gradient-to-b from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30" />
            <div className="min-w-0 flex-1">
              <h1 className="ps-title text-slate-800 text-2xl font-bold tracking-tight leading-none">
                {pageTitle}
              </h1>
              <p className="text-slate-500 text-xs mt-0.5 font-medium uppercase tracking-wide">
                City Environment & Natural Resources Office
              </p>
            </div>
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-700 text-xs font-bold tracking-wide">
                LIVE
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 border border-slate-200">
              <Clock size={14} className="text-slate-400" />
              <span className="text-slate-600 text-sm font-semibold">
                {new Date().toLocaleDateString("en-PH", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>

            <div className="w-px h-8 bg-slate-200 hidden lg:block" />

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setShowNotifs((v) => !v); setShowProfile(false); }}
                className="relative w-10 h-10 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center transition-all duration-200 hover:scale-105"
              >
                <Bell size={18} className="text-slate-600" />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1.5 bg-gradient-to-r from-red-500 to-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-red-500/30 animate-pulse">
                    {unread}
                  </span>
                )}
              </button>
              {showNotifs && (
                <NotificationPanel
                  notes={notifications}
                  onMarkAll={() => setNotifications((p) => p.map((n) => ({ ...n, read: true })))}
                  onDismiss={(id) => setNotifications((p) => p.filter((n) => n.id !== id))}
                  onClose={() => setShowNotifs(false)}
                />
              )}
            </div>

            <div className="w-px h-8 bg-slate-200" />

            {/* Profile */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => { setShowProfile((v) => !v); setShowNotifs(false); }}
                className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all duration-200 hover:scale-[1.02]"
              >
                <UserAvatar user={user_data ?? null} size="sm" />
                <div className="hidden lg:block text-left min-w-0">
                  <p className="text-slate-800 text-sm font-semibold leading-tight truncate max-w-[120px]">
                    {user_data?.full_name ?? "—"}
                  </p>
                  <p className="text-slate-500 text-[11px] truncate max-w-[120px]">
                    {user_data?.user_role ?? "—"}
                  </p>
                </div>
                <ChevronDown size={14} className={`text-slate-400 hidden lg:block transition-transform duration-200 ${showProfile ? "rotate-180" : ""}`} />
              </button>

              {showProfile && (
                <ProfileDropdown
                  user={user_data ?? null}
                  onLogout={() => setIsLogout(true)}
                  onNavigate={(path) => { setShowProfile(false); navigate(path); }}
                />
              )}
            </div>
          </div>
        </header>

        <Outlet />
      </main>
    </div>
  );
}


