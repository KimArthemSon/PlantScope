import {
  LayoutDashboard,
  BarChart3,
  ClipboardList,
  TreePine,
  LogOut,
  ChevronLeft,
  Map,
  Layers2,
  ChevronDown,
  User,
  Clock,
  AlertTriangle,
  Home,
  MapPinned,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import logo from "../../assets/logo2.png";
import { useState, useRef, useEffect, type ReactElement } from "react";
import Logout from "./logout";
import { Outlet } from "react-router-dom";
import PlantScopeLoader from "../alert/PlantScopeLoader";
import NotFoundPage from "./NotFoundPage";
import { useAuthorize } from "../../hooks/authorization";
import { useNavigate } from "react-router-dom";
import { api } from "@/constant/api";
import "../../global css/sidebarScrollbar.css";

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserData {
  id: number;
  email: string;
  profile_img: string;
  full_name: string;
  user_role: string;
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

// ─── Profile Dropdown ─────────────────────────────────────────────────────────
interface ProfileDropdownProps {
  user: UserData | null;
  onLogout: () => void;
  onNavigate: (path: string) => void;
}

function ProfileDropdown({ user, onLogout, onNavigate }: ProfileDropdownProps) {
  return (
    <div
      className="absolute right-0 top-full mt-3 w-[280px] z-19999
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
            path: "/GISS/my-profile",
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

// ─── Sidebar GIS Specialist ───────────────────────────────────────────────────
export default function SidebarGISS() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLogout, setIsLogout] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showProfile, setShowProfile] = useState(false);

  const profileRef: any = useRef<HTMLDivElement>(null);

  useOutsideClick(profileRef, () => setShowProfile(false));

  const { isAuthorized, isLoading, user_data } = useAuthorize("GISSpecialist");

  // Planted-area reports waiting for GIS review (sidebar badge)
  const [pendingReviews, setPendingReviews] = useState(0);
  useEffect(() => {
    if (!isAuthorized) return;
    const load = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`${api}api/gis_pending_review_count/`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        if (res.ok) setPendingReviews((await res.json()).pending_count || 0);
      } catch {
        /* badge is optional */
      }
    };
    load();
    const timer = setInterval(load, 60000);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [isAuthorized, location.pathname]);

  if (isLoading) return <PlantScopeLoader />;
  if (!localStorage.getItem("token")) {
    navigate("/Login");
    return null;
  }
  if (!isAuthorized) return <NotFoundPage />;

  const PAGE_TITLES: Record<string, string> = {
    "/dashboard/GISS": "Dashboard",
    "/GISS/map": "Map",
    "/GISS/reforestation-areas": "Reforestation Area",
    "/GISS/reforestation_area_site": "Analysis",
    "/GISS/official-reforestation": "Official Sites",
    "/GISS/reports": "Reports",
    "/GISS/planting-area-reviews": "Planted Area Reviews",
    "/GISS/maintenance/ormoc-city": "Ormoc City",
    "/GISS/maintenance/Classified_areas": "Classified Areas",
    "/GISS/maintenance/hazard_areas/": "Hazard Areas",
    "/GISS/notification": "Notifications",
  };
  const pageTitle = PAGE_TITLES[location.pathname] ?? "PlantScope";

  // ── Grouped Navigation ────────────────────────────────────────────────────
  const navGroups: {
    title: string;
    items: { to: string; icon: ReactElement; label: string; badge?: number }[];
  }[] = [
    {
      title: "Overview",
      items: [
        {
          to: "/dashboard/GISS",
          icon: <LayoutDashboard size={18} />,
          label: "Dashboard",
        },
        { to: "/GISS/map", icon: <Map size={18} />, label: "Map" },
      ],
    },
    {
      title: "Reforestation",
      items: [
        {
          to: "/GISS/reforestation-areas",
          icon: <ClipboardList size={18} />,
          label: "Reforestation Area",
        },
        {
          to: "/GISS/reforestation_area_site",
          icon: <Layers2 size={18} />,
          label: "Analysis",
        },
        {
          to: "/GISS/official-reforestation",
          icon: <TreePine size={18} />,
          label: "Official Sites",
        },
      ],
    },
    {
      title: "Monitoring",
      items: [
        {
          to: "/GISS/planting-area-reviews",
          icon: <MapPinned size={18} />,
          label: "Planted Area Reviews",
          badge: pendingReviews,
        },
      ],
    },
    {
      title: "Maintenance",
      items: [
        {
          to: "/GISS/maintenance/ormoc-city",
          icon: <Home size={18} />,
          label: "Ormoc City",
        },
        {
          to: "/GISS/maintenance/Classified_areas",
          icon: <Map size={18} />,
          label: "Classified Areas",
        },
        {
          to: "/GISS/maintenance/hazard_areas/",
          icon: <AlertTriangle size={18} />,
          label: "Hazard Areas",
        },
      ],
    },
    {
      title: "Analytics",
      items: [
        {
          to: "/GISS/reports",
          icon: <BarChart3 size={18} />,
          label: "Reports",
        },
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

        @keyframes badge-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.9; }
        }
        .badge-pulse { animation: badge-pulse 2s ease-in-out infinite; }

        .notif-scroll::-webkit-scrollbar       { width:4px; }
        .notif-scroll::-webkit-scrollbar-track { background:transparent; }
        .notif-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,.1); border-radius:99px; }
        .notif-scroll::-webkit-scrollbar-thumb:hover { background:rgba(255,255,255,.2); }

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

        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>

      <Logout setIsLogout={setIsLogout} isLogout={isLogout} />

      {/* ── Sidebar ── */}
      <aside
        className={`sticky top-0 h-screen bg-gradient-to-b from-[#0F4A2F] via-[#0d4028] to-[#0a3320] text-white flex flex-col shadow-2xl transition-all duration-500 ease-out ${
          expanded ? "w-[260px] min-w-[260px]" : "w-[80px] min-w-[80px]"
        }`}
      >
        {/* Logo Section */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className={`relative shrink-0 ${!expanded ? "mx-auto" : ""}`}>
              <div
                className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 p-0.5 shadow-lg shadow-emerald-500/20 cursor-pointer"
                onClick={() => setExpanded(!expanded)}
                title={expanded ? "Collapse sidebar" : "Expand sidebar"}
              >
                <img
                  src={logo}
                  alt="Logo"
                  className="w-full h-full rounded-[10px] object-cover bg-white"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#0F4A2F] animate-pulse" />
            </div>

            {expanded && (
              <>
                <div className="flex-1 min-w-0">
                  <h1 className="text-base font-bold text-white tracking-tight truncate">
                    PlantScope
                  </h1>
                  <p className="text-[10px] text-emerald-300/70 uppercase tracking-wider font-semibold">
                    GIS Specialist
                  </p>
                </div>
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
                >
                  <ChevronLeft size={16} className="text-white/60" />
                </button>
              </>
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
                {group.items.map(({ to, icon, label, badge }) => {
                  const isActive = location.pathname === to;
                  const hasBadge = !!badge && badge > 0;

                  return (
                    <Link
                      key={to}
                      to={to}
                      className={`nav-item group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer relative overflow-hidden ${
                        isActive
                          ? "bg-white/15 text-white shadow-lg border border-white/10"
                          : "text-white/70 hover:text-white hover:bg-white/5 border border-transparent"
                      } ${!expanded && "justify-center"}`}
                    >
                      {isActive && expanded && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-400 rounded-r-full shadow-lg shadow-emerald-400/50" />
                      )}

                      <span
                        className={`relative shrink-0 ${isActive ? "text-emerald-400" : "text-white/60 group-hover:text-white"}`}
                      >
                        {icon}
                      </span>

                      {expanded && (
                        <span className="flex-1 text-sm font-medium truncate">
                          {label}
                        </span>
                      )}

                      {expanded && hasBadge && (
                        <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-gradient-to-r from-red-500 to-rose-500 text-white text-[9px] font-bold rounded-full badge-pulse shadow-lg shadow-red-500/30">
                          {badge! > 99 ? "99+" : badge}
                        </span>
                      )}
                      {!expanded && hasBadge && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
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
                  <span className="text-[10px] font-semibold text-white/80">
                    System Online
                  </span>
                </div>
                <span className="text-[9px] text-white/40">*</span>
              </div>
              <p className="text-[9px] text-white/40">ENRO Ormoc City</p>
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
          shadow-[0_4px_40px_rgba(0,0,0,0.35)] z-9998"
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
              <span className="text-emerald-400/80 text-[11px] font-semibold tracking-wide">
                LIVE
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
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

            {/* Profile */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => {
                  setShowProfile((v) => !v);
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
