import {
  LayoutDashboard,
  BarChart3,
  ClipboardList,
  TreePine,
  FileText,
  LogOut,
  ChevronLeft,
  Map,
  Layers2,
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
  Home,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import logo from "../../assets/logo.png";
import { useState, useRef, useEffect } from "react";
import Logout from "./logout";
import { Outlet } from "react-router-dom";
import PlantScopeLoader from "../alert/PlantScopeLoader";
import NotFoundPage from "./NotFoundPage";
import { useAuthorize } from "../../hooks/authorization";
import { useNavigate } from "react-router-dom";
import "../../global css/sidebarScrollbar.css";

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserData {
  id: number;
  email: string;
  profile_img: string;
  full_name: string;
  user_role: string;
}

// ─── Mock Notifications ───────────────────────────────────────────────────────
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
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold text-sm">Notifications</span>
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
                  <p className="text-white/90 text-[13px] font-medium leading-tight">{n.title}</p>
                  <p className="text-white/45 text-[11.5px] mt-0.5 leading-snug">{n.desc}</p>
                  <span className="text-white/25 text-[11px] mt-1 block">{n.time}</span>
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
      className="absolute right-0 top-full mt-3 w-[280px] z-50
      bg-[#0a3320]/95 backdrop-blur-xl border border-white/10
      rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.6)] overflow-hidden
      animate-slideDown"
    >
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <UserAvatar user={user} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-white font-semibold text-[14px] truncate">{user?.full_name ?? "—"}</p>
            <p className="text-white/45 text-[11.5px] truncate" title={user?.email}>{user?.email ?? "—"}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400/80 text-[11px] font-medium">{user?.user_role ?? "—"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="py-2">
        {[
          { icon: <User size={14} />, label: "My Profile", sub: "View & edit info", path: "/GISS/my-profile" },
          
        ].map((item) => (
          <button
            key={item.label}
            onClick={() => item.path && onNavigate(item.path)}
            className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors text-left cursor-pointer group"
          >
            <span className="text-white/40 group-hover:text-emerald-400 transition-colors">{item.icon}</span>
            <div>
              <p className="text-white/80 text-[13px] group-hover:text-white transition-colors">{item.label}</p>
              <p className="text-white/30 text-[11px]">{item.sub}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="border-t border-white/10 p-2">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-red-500/10 transition-colors text-left cursor-pointer group"
        >
          <LogOut size={14} className="text-red-400/60 group-hover:text-red-400 transition-colors" />
          <span className="text-red-400/60 group-hover:text-red-400 text-[13px] transition-colors">Sign out</span>
        </button>
      </div>
    </div>
  );
}

// ─── Sidebar GIS Specialist ───────────────────────────────────────────────────
export default function SidebarGISS() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLogout, setIsLogout] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const notifRef: any = useRef<HTMLDivElement>(null);
  const profileRef: any = useRef<HTMLDivElement>(null);
  useOutsideClick(notifRef, () => setShowNotifs(false));
  useOutsideClick(profileRef, () => setShowProfile(false));

  const { isAuthorized, isLoading, user_data } = useAuthorize("GISSpecialist");

  if (isLoading) return <PlantScopeLoader />;
  if (!localStorage.getItem("token")) {
    navigate("/Login");
    return null;
  }
  if (!isAuthorized) return <NotFoundPage />;

  const unread = notifications.filter((n) => !n.read).length;

  const PAGE_TITLES: Record<string, string> = {
    "/dashboard/GISS": "Dashboard",
    "/GISS/map": "Map",
    "/GISS/reforestation-areas": "Reforestation Area",
    "/GISS/reforestation_area_site": "Analysis",
    "/GISS/official-reforestation": "Official Sites",
    "/GISS/reports": "Reports",
    "/GISS/maintenance/ormoc-city": "Ormoc City",
    "/GISS/maintenance/Classified_areas": "Classified Areas",
    "/GISS/maintenance/hazard_areas/": "Hazard Areas",
  };
  const pageTitle = PAGE_TITLES[location.pathname] ?? "PlantScope";

  const handleLogout = () => setIsLogout(true);

  // ── ✅ Grouped Navigation ────────────────────────────────────────────────────
  const navGroups = [
    {
      title: "Overview",
      items: [
        { to: "/dashboard/GISS", icon: <LayoutDashboard size={18} />, label: "Dashboard" },
        { to: "/GISS/map", icon: <Map size={18} />, label: "Map" },
      ],
    },
    {
      title: "Reforestation",
      items: [
        { to: "/GISS/reforestation-areas", icon: <ClipboardList size={18} />, label: "Reforestation Area" },
        { to: "/GISS/reforestation_area_site", icon: <Layers2 size={18} />, label: "Analysis" },
        { to: "/GISS/official-reforestation", icon: <TreePine size={18} />, label: "Official Sites" },
      ],
    },
    {
      title: "Maintenance",
      items: [
        { to: "/GISS/maintenance/ormoc-city", icon: <Home size={18} />, label: "Ormoc City" },
        { to: "/GISS/maintenance/Classified_areas", icon: <Map size={18} />, label: "Classified Areas" },
        { to: "/GISS/maintenance/hazard_areas/", icon: <AlertTriangle size={18} />, label: "Hazard Areas" },
      ],
    },
    {
      title: "Analytics",
      items: [
        { to: "/GISS/reports", icon: <BarChart3 size={18} />, label: "Reports" },
      ],
    },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
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

        .notif-scroll::-webkit-scrollbar       { width:4px; }
        .notif-scroll::-webkit-scrollbar-track { background:transparent; }
        .notif-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,.1); border-radius:99px; }

        .hdr-divider {
          width:1px; height:28px;
          background: linear-gradient(to bottom, transparent, rgba(255,255,255,.15), transparent);
        }

        .nav-item {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .nav-item:hover {
          transform: translateX(2px);
        }
      `}</style>

      <Logout setIsLogout={setIsLogout} isLogout={isLogout} />

      {/* ── Sidebar ── */}
      <aside
        className={` top-0 h-screen bg-gradient-to-b from-[#0F4A2F] via-[#0d4028] to-[#0a3320] text-white flex flex-col shadow-2xl transition-all duration-500 ease-out ${
          expanded ? "w-[260px] min-w-[260px]" : "w-[80px] min-w-[80px]"
        }`}
      >
        {/* Logo Section */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 p-0.5 shadow-lg shadow-emerald-500/20 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <img src={logo} alt="Logo" className="w-full h-full rounded-[10px] object-cover bg-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#0F4A2F] animate-pulse" />
            </div>
            
            {expanded && (
              <>
                <div className="flex-1 min-w-0">
                  <h1 className="text-base font-bold text-white tracking-tight truncate">PlantScope</h1>
                  <p className="text-[10px] text-emerald-300/70 uppercase tracking-wider font-semibold">GIS Specialist</p>
                </div>
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-all"
                >
                  <ChevronLeft size={16} className="text-white/60" />
                </button>
              </>
            )}
            {!expanded && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-all mx-auto"
              >
                <ChevronLeft size={16} className="text-white/60 rotate-180" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto sidebar-scrollbar p-3 space-y-5">
          {navGroups.map((group) => (
            <div key={group.title}>
              {expanded && (
                <div className="mb-2 px-3 flex items-center gap-2">
                  <p className="text-[10px] font-bold text-emerald-300/60 uppercase tracking-wider">
                    {group.title}
                  </p>
                  <div className="flex-1 h-px bg-gradient-to-r from-emerald-500/30 to-transparent" />
                </div>
              )}
              
              <div className="space-y-0.5">
                {group.items.map(({ to, icon, label }) => {
                  const isActive = location.pathname === to;
                  
                  return (
                    <Link
                      key={to}
                      to={to}
                      className={`nav-item group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer relative overflow-hidden ${
                        isActive
                          ? "bg-white/15 text-white shadow-lg border border-white/10"
                          : "text-white/70 hover:text-white hover:bg-white/5 border border-transparent"
                      } ${!expanded && 'justify-center'}`}
                    >
                      {/* Active indicator */}
                      {isActive && expanded && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-400 rounded-r-full shadow-lg shadow-emerald-400/50" />
                      )}
                      
                      {/* Icon */}
                      <span className={`relative shrink-0 ${isActive ? 'text-emerald-400' : 'text-white/60 group-hover:text-white'}`}>
                        {icon}
                      </span>
                      
                      {/* Label */}
                      {expanded && (
                        <span className="flex-1 text-sm font-medium truncate">{label}</span>
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
          <div className="p-3 border-t border-white/10">
            <div className="bg-gradient-to-r from-white/5 to-transparent rounded-xl p-3 border border-white/5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-lg shadow-emerald-400/50" />
                  <span className="text-[10px] font-semibold text-white/80">System Online</span>
                </div>
                <span className="text-[9px] text-white/40">v1.0</span>
              </div>
              <p className="text-[9px] text-white/40">ENRO Ormoc City • 2024</p>
            </div>
          </div>
        )}
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto overflow-x-auto bg-[#f5faf6]">
        {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
        <header
          className="ps-header bg-gradient-to-r from-[#0b3622] via-[#0d4028] to-[#0F4A2F]
          border-b border-white/[0.07] px-6 h-[68px] flex items-center gap-4
          shadow-[0_4px_40px_rgba(0,0,0,0.35)] z-10000"
        >
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
              <span className="text-emerald-400/80 text-[11px] font-semibold tracking-wide">LIVE</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden lg:flex items-center gap-2 glass-btn rounded-xl px-3.5 py-2">
              <Clock size={12} className="text-white/40" />
              <span className="text-white/50 text-[12px] font-medium">
                {new Date().toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>

            <div className="hdr-divider mx-1 hidden lg:block" />

            {/* Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setShowNotifs((v) => !v); setShowProfile(false); }}
                className="glass-btn relative w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer"
              >
                <Bell size={16} className="text-white/70" />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center notif-ring">
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

            <div className="hdr-divider mx-1" />

            {/* Profile */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => { setShowProfile((v) => !v); setShowNotifs(false); }}
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
                  onLogout={handleLogout}
                  onNavigate={(path) => { setShowProfile(false); navigate(path); }}
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