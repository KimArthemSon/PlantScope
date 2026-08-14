import { useState, useEffect, useRef, useCallback, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import "@/assets/homepage/homepage.css";
import logoImg from "@/assets/homepage/logo.jpg";
import heroVideo from "@/assets/homepage/hero.mp4";
import { api } from "@/constant/api";

import {
  ArrowRight,
  Download,
  Map,
  MapPin,
  Link as LinkIcon,
  Users,
  FileText,
  Leaf,
  Minus,
  Check,
  Signal,
  Wifi,
  BatteryMedium,
  Send,
  Smartphone,
  Lock,
} from "lucide-react";

interface NavLink {
  id: string;
  label: string;
}

const NAV_LINKS: NavLink[] = [
  { id: "home", label: "Home" },
  { id: "features", label: "System" },
  { id: "problem", label: "Need" },
  { id: "how-it-works", label: "Workflow" },
  { id: "team-section", label: "Team" },
  { id: "why-plantscope", label: "Why Us" },
  { id: "contact-section", label: "Contact" },
];

const MOBILE_NAV_LINKS: NavLink[] = [
  { id: "home", label: "Home" },
  { id: "features", label: "System" },
  { id: "problem", label: "The Need" },
  { id: "how-it-works", label: "Workflow" },
  { id: "team-section", label: "Team" },
  { id: "why-plantscope", label: "Why PlantScope" },
  { id: "mobile", label: "Mobile App" },
  { id: "contact-section", label: "Contact" },
];

export default function Homepage() {
  const [loaderVisible, setLoaderVisible] = useState(true);
  const [loaderFading, setLoaderFading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("home");

  const navRef = useRef<HTMLElement>(null);
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();

  /* ─── Auth: port of old checkIfStillLogin ─── */
  const checkIfStillLogin = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await fetch(api + "api/get_me/", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (response.ok) {
        if (data.token) {
          localStorage.setItem("token", data.token);
        }

        if (data.user_role === "CityENROHead") {
          navigate("/dashboard");
        } else if (data.user_role === "DataManager") {
          navigate("/dashboard-data-manager");
        } else if (data.user_role === "GISSpecialist") {
          navigate("/dashboard/GISS");
        } else if (data.user_role === "AFA") {
          navigate("/dashboard/AFA");
        }
      }
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  useEffect(() => {
    checkIfStillLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── APK download: port of old handleDownload ─── */
  const handleDownload = () => {
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );

    if (isMobile) {
      alert(
        'The APK will download. After it finishes, open your Downloads folder and tap the file to install. You may need to enable "Install from unknown sources" in settings.',
      );
    }

    window.open(
      "https://github.com/KimArthemSon/PlantScope/releases/download/v1.0.0/pantscope-v2.0.0.apk",
      "_blank",
    );
  };

  const getNavOffset = useCallback(
    () => (navRef.current ? navRef.current.offsetHeight + 20 : 100),
    [],
  );

  const scrollToSection = useCallback(
    (targetId: string, smooth = true) => {
      const target = document.getElementById(targetId);
      if (!target) return;
      const navOffset = getNavOffset();
      const targetTop = target.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: Math.max(0, targetTop - navOffset - 8),
        behavior: smooth ? "smooth" : "auto",
      });
      if (history.pushState) history.pushState(null, "", `#${targetId}`);
    },
    [getNavOffset],
  );

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    id: string,
  ) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    scrollToSection(id);
    setActiveSection(id);
  };

  const goToLogin = () => {
    setMobileMenuOpen(false);
    navigate("/Login");
  };

  const goToHome = () => navigate("/");

  const getCurrentSection = useCallback(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("section[id]"),
    );
    if (!sections.length) return "home";
    if (window.scrollY <= 30) return "home";
    const scrollPos = window.scrollY + getNavOffset() + 15;
    for (const section of sections) {
      if (
        scrollPos >= section.offsetTop &&
        scrollPos < section.offsetTop + section.offsetHeight
      )
        return section.id;
    }
    return sections[0].id;
  }, [getNavOffset]);

  /* ─── Core Effects ─── */
  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setLoaderFading(true);
      setTimeout(() => setLoaderVisible(false), 600);
    }, 1500);
    return () => clearTimeout(fadeTimer);
  }, []);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const handleScroll = () => {
      setNavScrolled(window.scrollY > 40);
      setActiveSection(getCurrentSection());
      if (heroVideoRef.current && !prefersReducedMotion) {
        heroVideoRef.current.style.transform = `translateY(${Math.min(window.scrollY * 0.25, 150)}px) scale(1.08)`;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [getCurrentSection]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [loaderVisible]);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash)
      setTimeout(
        () => scrollToSection(decodeURIComponent(hash.substring(1)), false),
        100,
      );
  }, [scrollToSection]);

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    alert("Thank you for your interest! We will contact you soon.");
  };

  return (
    <>
      {loaderVisible && (
        <div
          id="loader"
          style={{
            opacity: loaderFading ? 0 : 1,
            pointerEvents: loaderFading ? "none" : "auto",
          }}
        >
          <div className="loader-container">
            <div className="loader-ring-outer" />
            <div className="loader-ring-middle" />
            <div className="loader-ring-inner" />
            <div className="loader-logo">
              <img src={logoImg} alt="PlantScope Logo" />
            </div>
            {[0, 1, 2, 3].map((i) => (
              <div className="tree-orbit" key={i}>
                <svg
                  className="tree-icon"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2L9 9H3l6 4.5L7 22l5-3.5 5 3.5-2-8.5L21 9h-6l-3-7z" />
                  <path d="M12 22v-8" />
                </svg>
              </div>
            ))}
            {[0, 1, 2, 3].map((i) => (
              <svg
                key={i}
                className="growing-tree"
                width="60"
                height="60"
                viewBox="0 0 24 24"
                fill="#4BA74E"
              >
                <path d="M12 2L9 9H3l6 4.5L7 22l5-3.5 5 3.5-2-8.5L21 9h-6l-3-7z" />
              </svg>
            ))}
          </div>
          <div className="loader-text">PLANTSCOPE</div>
          <div className="loader-subtitle">
            Growing Forests Through Data &amp; Technology
          </div>
        </div>
      )}

      {/* ═══ NAV ═══ */}
      {/* ═══ NAV ═══ */}
      <nav
        id="siteNav"
        ref={navRef}
        className={navScrolled ? "nav-scrolled" : ""}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Brand */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border nav-logo-ring flex-shrink-0">
                <img
                  src={logoImg}
                  className="w-full h-full object-cover"
                  alt="PlantScope Logo"
                />
              </div>
              <span
                className="font-bold text-base sm:text-lg nav-logo-text leading-none"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                PlantScope
              </span>
            </div>

            {/* Desktop pill links */}
            <ul
              id="navLinksContainer"
              className="hidden lg:flex items-center gap-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-full px-2 py-1.5"
            >
              {NAV_LINKS.map((link) => (
                <li key={link.id}>
                  <a
                    href={`#${link.id}`}
                    className={`nav-link ${activeSection === link.id ? "active" : ""}`}
                    onClick={(e) => handleNavClick(e, link.id)}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>

            {/* Right actions */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {/* APK button — visible on md+ (768px+) */}
              <a
                href="#mobile"
                className="btn-apk-outline hidden md:inline-flex items-center gap-2"
                onClick={(e) => {
                  e.preventDefault();
                  handleDownload();
                }}
              >
                <Download size={16} /> <span>Download APK</span>
              </a>

              {/* Login button — visible on lg+ (1024px+) */}
              <button
                type="button"
                className="btn-login hidden lg:inline-flex items-center gap-2"
                onClick={goToLogin}
              >
                Log In
              </button>

              {/* Hamburger — visible below lg (1024px), guaranteed not to shrink */}
              <button
                type="button"
                id="mobileMenuBtn"
                className="lg:hidden p-2 rounded-md flex-shrink-0"
                onClick={() => setMobileMenuOpen((o) => !o)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div
          id="mobileMenu"
          className={`mobile-menu lg:hidden ${mobileMenuOpen ? "active" : ""}`}
        >
          <div className="px-4 py-6 space-y-4 max-w-7xl mx-auto">
            {MOBILE_NAV_LINKS.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                className={`nav-link block ${activeSection === link.id ? "active" : ""}`}
                onClick={(e) => handleNavClick(e, link.id)}
              >
                {link.label}
              </a>
            ))}
            <div className="pt-4 border-t border-gray-200 flex flex-col gap-3">
              <button
                type="button"
                className="btn-login inline-flex items-center justify-center gap-2 w-full"
                style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
                onClick={goToLogin}
              >
                Log In
              </button>
              <button
                type="button"
                className="btn-apk-outline inline-flex items-center justify-center gap-2 w-full"
                style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleDownload();
                }}
              >
                <Download size={16} /> <span>Download APK</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section id="home" className="hero-section">
        <div className="hero-bg">
          <video
            ref={heroVideoRef}
            autoPlay
            muted
            loop
            playsInline
            className="hero-video"
          >
            <source src={heroVideo} type="video/mp4" />
          </video>
          <div className="hero-overlay" />
        </div>
        <div className="hero-content">
          <div
            className="hero-badge"
            style={{
              borderLeft: "2px solid #7CD56A",
              paddingLeft: "1rem",
              color: "rgba(255,255,255,0.55)",
              fontSize: "0.7rem",
              letterSpacing: "0.18em",
            }}
          >
            <span>GIS-Enabled Reforestation System</span>
          </div>
          <h1 className="hero-title">PlantScope</h1>
          <p className="hero-kicker">
            GIS-powered site assessment and reforestation monitoring for Ormoc
            City. Identify suitable areas, validate sites in the field, and
            track restoration progress in one platform.
          </p>
          <div className="hero-cta">
            <a
              href="#features"
              className="btn-minimal-primary"
              onClick={(e) => handleNavClick(e, "features")}
            >
              Explore the System
            </a>
            <a
              href="#how-it-works"
              className="btn-minimal-secondary"
              onClick={(e) => handleNavClick(e, "how-it-works")}
            >
              See How It Works <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section
        id="features"
        className="section-pad"
        style={{ background: "var(--bg-primary)" }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="eyebrow">Core Capabilities</span>
            <h2 className="section-title mt-4">
              From Site Selection to Reforestation Monitoring
            </h2>
            <p className="section-subtitle mt-4">
              PlantScope connects GIS analysis, field validation, planting
              records, and monitoring so environmental teams can manage the
              reforestation process in one place.
            </p>
          </div>

          <div className="bento-grid">
            <div className="bento-tile bento-lead fade-up">
              <div>
                <div className="bento-num">01</div>
                <div className="card-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold mb-3">
                  Site Suitability Mapping
                </h3>
                <p>
                  Combine spatial information such as slope, land cover, land
                  classification, water, and hazard considerations to identify
                  areas that should be prioritized for further assessment.
                </p>
                <div
                  className="map-preview"
                  aria-label="PlantScope GIS map preview"
                >
                  <div className="map-river" />
                  <div className="map-zone z1" />
                  <div className="map-zone z2" />
                  <div className="map-pin p1" />
                  <div className="map-pin p2" />
                  <div className="map-pin p3" />
                  <div className="map-label l1">SUITABILITY AREA</div>
                  <div className="map-label l2">PLANTING SITE</div>
                  <div className="map-label l3">FIELD CHECK</div>
                  <div className="map-legend">
                    <span>
                      <b /> Potential site
                    </span>
                    <span>
                      <b className="water" /> Water
                    </span>
                    <span>
                      <b className="risk" /> Risk area
                    </span>
                  </div>
                </div>
              </div>
              <div className="metric-row">
                <div>
                  <div className="m-val">GIS</div>
                  <div className="m-label">Spatial analysis</div>
                </div>
                <div>
                  <div className="m-val">Multi-criteria</div>
                  <div className="m-label">Site assessment</div>
                </div>
              </div>
            </div>

            <div className="bento-tile fade-up-delay">
              <div className="bento-num">02</div>
              <div className="card-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 21s8-4.5 8-11a8 8 0 10-16 0c0 6.5 8 11 8 11z"
                  />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
              </div>
              <h3
                className="text-lg font-bold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                Field Site Assessment
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                Verify potential sites in the field using GPS location, photos,
                site observations, boundaries, and relevant land information.
              </p>
            </div>

            <div className="bento-small-row">
              <div className="bento-tile fade-up-delay-2">
                <div className="bento-num">03</div>
                <div className="card-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 3v18h18M7 16l4-5 3 3 5-7"
                    />
                  </svg>
                </div>
                <h3
                  className="text-lg font-bold mb-2"
                  style={{ color: "var(--text-primary)" }}
                >
                  Reforestation Monitoring
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Track planting activities, monitoring records, site progress,
                  and vegetation observations over time.
                </p>
              </div>
              <div className="bento-tile fade-up-delay-3">
                <div className="bento-num">04</div>
                <div className="card-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 17v-2a4 4 0 014-4h4M7 7h10M7 11h3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h3
                  className="text-lg font-bold mb-2"
                  style={{ color: "var(--text-primary)" }}
                >
                  Management &amp; Reports
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Keep applications, sites, tree growers, planting records,
                  monitoring data, and reports connected.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="plate fade-up">
              <div
                className="text-xs font-semibold uppercase tracking-widest mb-2"
                style={{ color: "var(--accent)" }}
              >
                Remote sensing
              </div>
              <h3 className="font-bold mb-1">Satellite observations</h3>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Use vegetation information such as NDVI as part of the wider
                assessment and monitoring process.
              </p>
            </div>
            <div className="plate fade-up-delay">
              <div
                className="text-xs font-semibold uppercase tracking-widest mb-2"
                style={{ color: "var(--accent)" }}
              >
                Field data
              </div>
              <h3 className="font-bold mb-1">Ground verification</h3>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Connect mapped areas with observations collected directly from
                the planting site.
              </p>
            </div>
            <div className="plate fade-up-delay-2">
              <div
                className="text-xs font-semibold uppercase tracking-widest mb-2"
                style={{ color: "var(--accent)" }}
              >
                Decision support
              </div>
              <h3 className="font-bold mb-1">Connected records</h3>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Keep assessment, planting, and monitoring information linked for
                easier review and reporting.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ PROBLEM / SOLUTION ═══ */}
      <section
        id="problem"
        className="section-pad"
        style={{ background: "var(--bg-secondary)" }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="eyebrow">The Need</span>
            <h2 className="section-title mt-4">
              Turn Scattered Information Into One Reforestation Workflow
            </h2>
            <p className="section-subtitle mt-4">
              PlantScope is designed to connect the information used before,
              during, and after a planting activity.
            </p>
          </div>
          <div className="problem-grid">
            <div className="problem-panel">
              <span
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: "var(--text-secondary)" }}
              >
                Without a connected workflow
              </span>
              <h3 className="text-xl font-bold mt-3">
                Information can become fragmented
              </h3>
              <ul className="problem-list">
                <li>
                  <Minus size={16} />
                  <span>
                    Site information may be stored across different records and
                    maps.
                  </span>
                </li>
                <li>
                  <Minus size={16} />
                  <span>
                    Potential sites still need field verification before
                    planting decisions.
                  </span>
                </li>
                <li>
                  <Minus size={16} />
                  <span>
                    Planting and monitoring records can be difficult to connect
                    back to a site.
                  </span>
                </li>
              </ul>
            </div>
            <div className="problem-panel solution">
              <span
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: "#8FE07C" }}
              >
                With PlantScope
              </span>
              <h3 className="text-xl font-bold mt-3">
                A connected path from map to monitoring
              </h3>
              <ul className="problem-list">
                <li>
                  <Check size={16} />
                  <span>
                    Map and assess potential areas using multiple spatial
                    criteria.
                  </span>
                </li>
                <li>
                  <Check size={16} />
                  <span>
                    Validate sites in the field and keep the evidence with the
                    site record.
                  </span>
                </li>
                <li>
                  <Check size={16} />
                  <span>
                    Continue with planting, monitoring, and reporting using
                    connected records.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section
        id="how-it-works"
        className="section-pad"
        style={{ background: "var(--bg-secondary)" }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="eyebrow">Workflow</span>
            <h2 className="section-title mt-4">
              From Spatial Analysis to Restoration Monitoring
            </h2>
            <p className="section-subtitle mt-4">
              A connected process: discover potential areas, assess suitability,
              verify conditions, then monitor restoration.
            </p>
          </div>
          <div className="flow-timeline">
            {[
              {
                tag: "Discover",
                title: "Identify potential areas",
                desc: "Bring together available GIS layers and satellite observations to locate areas that may need further assessment.",
              },
              {
                tag: "Assess",
                title: "Analyze site suitability",
                desc: "Evaluate multiple criteria such as slope, land information, water, vegetation, and hazards to prioritize sites for field checking.",
              },
              {
                tag: "Verify",
                title: "Validate the site in the field",
                desc: "Inspectors collect GPS position, photos, site observations, boundaries, and relevant land information using the field workflow.",
              },
              {
                tag: "Monitor",
                title: "Track planting and restoration",
                desc: "Keep planting and monitoring records connected to the site so progress can be reviewed and reported over time.",
              },
            ].map((step, i) => (
              <div className="flow-item" key={i}>
                <div className="flow-dot">{String(i + 1).padStart(2, "0")}</div>
                <div className="flow-body">
                  <span className="flow-tag">{step.tag}</span>
                  <h3>{step.title}</h3>
                  <p>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TEAM ═══ */}
      <section
        id="team-section"
        className="section-pad"
        style={{ background: "var(--bg-primary)" }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-4">
            <span className="eyebrow">The People Behind It</span>
          </div>
          <h1 className="section-title text-center mb-4">Our Team</h1>
          <p className="section-subtitle text-center mb-14">
            Meet the dedicated researchers and developers behind PlantScope –
            combining passion for technology with environmental stewardship
          </p>
          <h2
            className="text-xl font-bold mb-8 text-center"
            style={{ color: "var(--accent)" }}
          >
            Research &amp; Development Team
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-14">
            <div className="team-card highlight">
              <div className="team-avatar">KAS</div>
              <h3
                className="text-lg font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                Kim Arthem Son
              </h3>
              <p
                className="font-semibold text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                Project Leader
              </p>
              <p
                className="text-xs mb-3"
                style={{ color: "var(--accent)", fontWeight: 600 }}
              >
                Lead Developer &amp; System Architect
              </p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                BSIT Student
                <br />
                Western Leyte College of Ormoc City
              </p>
              <div
                className="mt-4 pt-4"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <p
                  className="text-xs font-semibold mb-2"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Key Responsibilities:
                </p>
                <ul
                  className="text-xs text-left space-y-1 max-w-[200px] mx-auto"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <li>• Project management &amp; coordination</li>
                  <li>• System architecture design</li>
                  <li>• Database development</li>
                  <li>• Team leadership</li>
                </ul>
              </div>
            </div>
            <div className="team-card">
              <div className="team-avatar">MXG</div>
              <h3
                className="text-lg font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                Marc Xyver L. Gica
              </h3>
              <p
                className="font-semibold text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                Lead Researcher
              </p>
              <p
                className="text-xs mb-3"
                style={{ color: "var(--accent)", fontWeight: 600 }}
              >
                GIS Specialist &amp; Data Analyst
              </p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                BSIT Student
                <br />
                Western Leyte College of Ormoc City
              </p>
              <div
                className="mt-4 pt-4"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <p
                  className="text-xs font-semibold mb-2"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Contact:
                </p>
                <p
                  className="text-xs flex items-center justify-center gap-2"
                  style={{ color: "var(--text-secondary)" }}
                >
                  0951 513 36268
                </p>
                <p
                  className="text-xs flex items-center justify-center gap-2 break-all"
                  style={{ color: "var(--text-secondary)" }}
                >
                  marcxyver.gica@wlcormoc.edu.ph
                </p>
              </div>
              <div
                className="mt-3 pt-3"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <p
                  className="text-xs font-semibold mb-2"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Key Responsibilities:
                </p>
                <ul
                  className="text-xs text-left space-y-1 max-w-[200px] mx-auto"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <li>• Research documentation</li>
                  <li>• UI designer</li>
                </ul>
              </div>
            </div>
            <div className="team-card">
              <div className="team-avatar">CKP</div>
              <h3
                className="text-lg font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                Charles Ken D. Perez
              </h3>
              <p
                className="font-semibold text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                Researcher
              </p>
              <p
                className="text-xs mb-3"
                style={{ color: "var(--accent)", fontWeight: 600 }}
              >
                Frontend Developer &amp; UI/UX Designer
              </p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                BSIT Student
                <br />
                Western Leyte College of Ormoc City
              </p>
              <div
                className="mt-4 pt-4"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <p
                  className="text-xs font-semibold mb-2"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Key Responsibilities:
                </p>
                <ul
                  className="text-xs text-left space-y-1 max-w-[200px] mx-auto"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <li>• User interface design</li>
                  <li>• Frontend development</li>
                  <li>• Visualization tools</li>
                  <li>• User testing</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mb-14">
            <h2
              className="text-xl font-bold mb-6"
              style={{ color: "var(--accent)" }}
            >
              Faculty &amp; Administration
            </h2>
            <div className="faculty-list">
              <div className="faculty-list-item">
                <div className="f-avatar">RD</div>
                <div>
                  <h4
                    className="text-base font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Roel C. Daniot{" "}
                    <span
                      className="font-normal text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      — Faculty Adviser, College of ICT &amp; Engineering
                    </span>
                  </h4>
                  <p
                    className="text-sm mt-1"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Providing technical guidance, research methodology
                    supervision, and academic oversight throughout the
                    development of PlantScope.
                  </p>
                </div>
              </div>
              <div className="faculty-list-item">
                <div className="f-avatar">CT</div>
                <div>
                  <h4
                    className="text-base font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Cheryl M. Tarre{" "}
                    <span
                      className="font-normal text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      — Dean, College of ICT &amp; Engineering · DBA (cand),
                      MST-CS, MSCS
                    </span>
                  </h4>
                  <p
                    className="text-sm mt-1"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Supporting academic excellence and fostering innovation in
                    ICT education, enabling students to create impactful
                    technological solutions.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="stat-box">
              <div
                className="text-2xl font-bold mb-2"
                style={{ color: "var(--accent)" }}
              >
                2024-2026
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                Development Period
              </p>
            </div>
            <div className="stat-box">
              <div
                className="text-2xl font-bold mb-2"
                style={{ color: "var(--accent)" }}
              >
                3
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                Dedicated Researchers
              </p>
            </div>
            <div className="stat-box">
              <div
                className="text-2xl font-bold mb-2"
                style={{ color: "var(--accent)" }}
              >
                1
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                Mission: Restore Ormoc
              </p>
            </div>
          </div>

          <div className="mt-12 text-center plate">
            <h3
              className="text-lg font-bold mb-3"
              style={{ color: "var(--accent)" }}
            >
              Our Team Philosophy
            </h3>
            <p
              className="leading-relaxed max-w-3xl mx-auto text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              We believe that technology and environmental science can work
              hand-in-hand to create sustainable solutions. Our diverse skill
              sets in software development, GIS analysis, and environmental
              research allow us to approach reforestation from both technical
              and ecological perspectives.
            </p>
            <p
              className="italic mt-4 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              "Together, we're not just building software – we're planting the
              seeds for Ormoc's greener future."
            </p>
          </div>
        </div>
      </section>

      {/* ═══ MOBILE APP ═══ */}
      <section
        id="mobile"
        className="section-pad"
        style={{
          background:
            "radial-gradient(circle at 15% 10%, #163826 0%, #0D2318 45%, #0A1C13 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(rgba(124,213,106,0.08) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            opacity: 0.6,
            pointerEvents: "none",
          }}
        />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-6 reveal">
            <span className="eyebrow" style={{ color: "#8FE07C" }}>
              Mobile App
            </span>
            <h2
              className="section-title mt-4"
              style={{
                color: "#7CD56A",
                fontSize: "clamp(2.2rem, 5vw, 3.5rem)",
                fontWeight: 700,
              }}
            >
              Take Field Assessment With You
            </h2>
            <p
              className="section-subtitle mt-4"
              style={{
                color: "rgba(255,255,255,0.65)",
                maxWidth: 720,
                margin: "0 auto",
              }}
            >
              PlantScope brings site assessment and monitoring into the field.
              Capture location, photos, observations, and planting updates
              closer to where the work happens.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">
            <div className="reveal">
              <h3
                className="text-2xl font-bold mb-3"
                style={{
                  color: "#fff",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Built for Field Work
              </h3>
              <p
                className="mb-8"
                style={{
                  color: "rgba(255,255,255,0.6)",
                  fontSize: "0.95rem",
                  lineHeight: 1.7,
                }}
              >
                A field workflow for inspectors and participating tree growers,
                with records that can be reviewed by the management team.
              </p>
              <div className="space-y-4">
                {[
                  {
                    icon: <Check size={18} />,
                    title: "Field Inspectors",
                    desc: "Conduct site assessments, submit GPS-tagged data, and monitor reforestation progress in real-time.",
                  },
                  {
                    icon: <Users size={18} />,
                    title: "Community Groups",
                    desc: "Apply for tree planting programs, track your applications, and manage your reforestation projects.",
                  },
                  {
                    icon: <FileText size={18} />,
                    title: "Organizations",
                    desc: "Formal organizations and informal groups can register, apply for programs, and report progress.",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="info-card glass"
                    style={{
                      padding: "1.25rem 1.5rem",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "1rem",
                      borderRadius: 14,
                    }}
                  >
                    <div
                      style={{
                        width: "2.5rem",
                        height: "2.5rem",
                        borderRadius: 10,
                        background: "rgba(124,213,106,0.12)",
                        border: "1px solid rgba(124,213,106,0.25)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        color: "#7CD56A",
                      }}
                    >
                      {item.icon}
                    </div>
                    <div>
                      <h4
                        style={{
                          color: "#fff",
                          fontWeight: 600,
                          fontSize: "1rem",
                          marginBottom: "0.2rem",
                          fontFamily: "'Space Grotesk', sans-serif",
                        }}
                      >
                        {item.title}
                      </h4>
                      <p
                        style={{
                          color: "rgba(255,255,255,0.55)",
                          fontSize: "0.88rem",
                          lineHeight: 1.5,
                        }}
                      >
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center reveal">
              <div
                className="phone-mockup"
                style={{
                  maxWidth: 290,
                  borderColor: "#2a3a32",
                  background: "#0f1f17",
                  boxShadow: "0 30px 60px -15px rgba(0,0,0,0.6)",
                }}
              >
                <div className="notch-area">
                  <span className="time">9:41</span>
                  <div className="icons">
                    <Signal size={10} />
                    <Wifi size={10} />
                    <BatteryMedium size={10} />
                  </div>
                </div>
                <div
                  className="screen"
                  style={{
                    background: "#0D2318",
                    minHeight: 480,
                    justifyContent: "flex-start",
                    gap: "0.6rem",
                    padding: "1rem 0.9rem 1.25rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.6rem",
                      marginBottom: "0.4rem",
                    }}
                  >
                    <div
                      style={{
                        width: "2.2rem",
                        height: "2.2rem",
                        borderRadius: "50%",
                        background: "rgba(124,213,106,0.15)",
                        border: "1px solid rgba(124,213,106,0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#7CD56A"
                        strokeWidth={2.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "0.9rem",
                          fontWeight: 700,
                          color: "#fff",
                          fontFamily: "'Space Grotesk', sans-serif",
                        }}
                      >
                        PlantScope
                      </div>
                      <div
                        style={{
                          fontSize: "0.6rem",
                          color: "#7CD56A",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          fontWeight: 600,
                        }}
                      >
                        Community Portal
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "0.6rem",
                      marginBottom: "0.6rem",
                    }}
                  >
                    <div
                      style={{
                        background: "rgba(124,213,106,0.08)",
                        border: "1px solid rgba(124,213,106,0.18)",
                        borderRadius: 12,
                        padding: "0.9rem 0.5rem",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "1.4rem",
                          fontWeight: 700,
                          color: "#fff",
                          fontFamily: "'Space Grotesk', sans-serif",
                        }}
                      >
                        3
                      </div>
                      <div
                        style={{
                          fontSize: "0.58rem",
                          color: "rgba(255,255,255,0.55)",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          marginTop: "0.15rem",
                          fontWeight: 500,
                        }}
                      >
                        Active Projects
                      </div>
                    </div>
                    <div
                      style={{
                        background: "rgba(124,213,106,0.08)",
                        border: "1px solid rgba(124,213,106,0.18)",
                        borderRadius: 12,
                        padding: "0.9rem 0.5rem",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "1.4rem",
                          fontWeight: 700,
                          color: "#fff",
                          fontFamily: "'Space Grotesk', sans-serif",
                        }}
                      >
                        12
                      </div>
                      <div
                        style={{
                          fontSize: "0.58rem",
                          color: "rgba(255,255,255,0.55)",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          marginTop: "0.15rem",
                          fontWeight: 500,
                        }}
                      >
                        Trees Planted
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    {[
                      {
                        icon: <FileText size={12} />,
                        title: "Apply for Program",
                        sub: "Submit application",
                      },
                      {
                        icon: <Check size={12} />,
                        title: "My Applications",
                        sub: "Track status",
                      },
                      {
                        icon: <MapPin size={12} />,
                        title: "Report Progress",
                        sub: "Update planting status",
                      },
                    ].map((item, i) => (
                      <div
                        key={i}
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 10,
                          padding: "0.7rem 0.8rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.7rem",
                        }}
                      >
                        <div
                          style={{
                            width: "1.8rem",
                            height: "1.8rem",
                            borderRadius: 8,
                            background: "rgba(124,213,106,0.12)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            color: "#7CD56A",
                          }}
                        >
                          {item.icon}
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              color: "#fff",
                            }}
                          >
                            {item.title}
                          </div>
                          <div
                            style={{
                              fontSize: "0.6rem",
                              color: "rgba(255,255,255,0.45)",
                            }}
                          >
                            {item.sub}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      background: "#7CD56A",
                      color: "#0A1C13",
                      border: "none",
                      borderRadius: 10,
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      marginTop: "auto",
                      cursor: "pointer",
                      fontFamily: "'Space Grotesk', sans-serif",
                      letterSpacing: "0.02em",
                    }}
                  >
                    View Dashboard
                  </button>
                  <div className="bottom-dots">
                    <span className="active" />
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-2xl mx-auto reveal">
            <div
              className="dark-plate"
              style={{
                padding: "1.5rem 2rem",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1.25rem",
                borderRadius: 14,
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "1rem" }}
              >
                <div
                  style={{
                    width: "3.2rem",
                    height: "3.2rem",
                    borderRadius: 12,
                    background: "rgba(124,213,106,0.12)",
                    border: "1px solid rgba(124,213,106,0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Download size={22} color="#7CD56A" />
                </div>
                <div>
                  <h4
                    style={{
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: "1.05rem",
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    Download for Android
                  </h4>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      color: "rgba(255,255,255,0.5)",
                      fontSize: "0.75rem",
                      marginTop: "0.15rem",
                    }}
                  >
                    <span>Version 1.0.0</span>
                    <span
                      style={{
                        width: 3,
                        height: 3,
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.3)",
                      }}
                    />
                    <span>25MB</span>
                    <span
                      style={{
                        width: 3,
                        height: 3,
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.3)",
                      }}
                    />
                    <span>Requires Android 8.0+</span>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{
                    background: "#7CD56A",
                    color: "#0A1C13",
                    fontSize: "0.88rem",
                    padding: "0.65rem 1.4rem",
                    borderRadius: 999,
                    fontWeight: 700,
                  }}
                  onClick={handleDownload}
                >
                  <Download size={14} style={{ marginRight: "0.35rem" }} />{" "}
                  Download APK
                </button>
                <button
                  type="button"
                  className="btn-secondary on-dark"
                  style={{
                    fontSize: "0.88rem",
                    padding: "0.65rem 1.4rem",
                    borderRadius: 999,
                    fontWeight: 600,
                  }}
                >
                  <Lock size={14} style={{ marginRight: "0.35rem" }} /> Learn
                  More
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ WHY PLANTSCOPE ═══ */}
      <section
        id="why-plantscope"
        className="section-pad"
        style={{ background: "var(--bg-primary)" }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="eyebrow">Why PlantScope</span>
            <h2 className="section-title mt-4">
              Built Around the Reforestation Decision Process
            </h2>
            <p className="section-subtitle mt-4">
              PlantScope combines spatial analysis, field evidence, and
              monitoring into a workflow that supports environmental management.
            </p>
          </div>
          <div className="compare-list">
            {[
              {
                icon: <Map size={16} />,
                title: "GIS-based",
                desc: "View planting areas, sites, boundaries, and assessment information in a spatial context instead of treating records as isolated data.",
              },
              {
                icon: <MapPin size={16} />,
                title: "Field-validated",
                desc: "Connect mapped candidate areas with GPS locations, photos, observations, and other information collected on site.",
              },
              {
                icon: <LinkIcon size={16} />,
                title: "Traceable records",
                desc: "Keep site assessment, planting activity, and monitoring information connected so progress can be reviewed later.",
              },
              {
                icon: <Users size={16} />,
                title: "Community participation",
                desc: "Support tree growers and participating organizations through applications, site assignments, and planting progress updates.",
              },
              {
                icon: <FileText size={16} />,
                title: "Reporting-ready",
                desc: "Bring operational records together so environmental management teams can review activities and prepare reports more efficiently.",
              },
              {
                icon: <Leaf size={16} />,
                title: "Local focus",
                desc: "Designed around the reforestation context of Ormoc City and the roles involved in managing planting sites and growers.",
              },
            ].map((row, i) => (
              <div className="compare-row" key={i}>
                <div className="c-title">
                  <span className="c-icon">{row.icon}</span>
                  {row.title}
                </div>
                <p>{row.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section
        id="cta"
        className="section-pad"
        style={{ background: "var(--bg-secondary)" }}
      >
        <div
          className="max-w-4xl mx-auto text-center rounded-lg p-12 lg:p-16"
          style={{ background: "var(--text-primary)" }}
        >
          <h2
            className="text-2xl md:text-4xl font-bold mb-4"
            style={{ color: "#fff" }}
          >
            Ready to Explore PlantScope?
          </h2>
          <p className="text-white/80 text-base max-w-2xl mx-auto mb-8">
            Explore how PlantScope connects site assessment, field validation,
            planting, and monitoring for more organized reforestation
            management.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#features"
              className="btn-primary text-sm px-6"
              style={{ background: "#fff", color: "var(--text-primary)" }}
              onClick={(e) => handleNavClick(e, "features")}
            >
              <Map size={16} style={{ marginRight: "0.5rem" }} /> Explore the
              System
            </a>
            <button
              type="button"
              className="btn-secondary text-sm px-6"
              style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}
              onClick={handleDownload}
            >
              <Smartphone size={16} style={{ marginRight: "0.5rem" }} />{" "}
              Download App
            </button>
          </div>
          <p className="text-white/50 text-xs mt-6 flex items-center justify-center gap-1">
            <Lock size={14} /> Authorized users: ENRO staff, GIS specialists,
            inspectors, community growers
          </p>
        </div>
      </section>

      {/* ═══ CONTACT ═══ */}
      <section
        id="contact-section"
        className="section-pad"
        style={{ background: "var(--bg-primary)" }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-4">
            <span className="eyebrow">Get in Touch</span>
          </div>
          <h1 className="section-title text-center mb-4">Contact Us</h1>
          <p className="section-subtitle text-center mb-12">
            Questions about the project, research, or collaboration? Reach the
            PlantScope development team.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            <div className="plate">
              <h2
                className="text-lg font-bold mb-6"
                style={{ color: "var(--accent)" }}
              >
                Contact Information
              </h2>
              <div className="space-y-3">
                <div className="contact-info-item">
                  <div className="icon-wrap">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4
                      className="font-semibold text-sm mb-0.5"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Phone
                    </h4>
                    <p
                      className="text-sm"
                      style={{ color: "var(--text-primary)" }}
                    >
                      0951 513 36268
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Marc Xyver L. Gica (Lead Researcher)
                    </p>
                  </div>
                </div>
                <div className="contact-info-item">
                  <div className="icon-wrap">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4
                      className="font-semibold text-sm mb-0.5"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Email
                    </h4>
                    <p
                      className="text-sm break-all"
                      style={{ color: "var(--text-primary)" }}
                    >
                      marcxyver.gica@wlcormoc.edu.ph
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Primary contact for inquiries
                    </p>
                  </div>
                </div>
                <div className="contact-info-item">
                  <div className="icon-wrap">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4
                      className="font-semibold text-sm mb-0.5"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Location
                    </h4>
                    <p
                      className="text-sm"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Western Leyte College of Ormoc City
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      College of Information Communication Technology and
                      Engineering
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Ormoc City, Leyte, Philippines
                    </p>
                  </div>
                </div>
                <div className="contact-info-item">
                  <div className="icon-wrap">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4
                      className="font-semibold text-sm mb-0.5"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Office Hours
                    </h4>
                    <p
                      className="text-sm"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Monday - Friday
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      8:00 AM - 5:00 PM (Philippine Time)
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Best time to reach us: 9:00 AM - 4:00 PM
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="plate">
              <h2
                className="text-lg font-bold mb-2"
                style={{ color: "var(--accent)" }}
              >
                Project Inquiry
              </h2>
              <p
                className="text-sm mb-6"
                style={{ color: "var(--text-secondary)" }}
              >
                This showcase form is for project inquiries. Connect it to your
                preferred email service or backend before production use.
              </p>
              <form className="space-y-4" onSubmit={handleFormSubmit}>
                <div>
                  <label
                    htmlFor="contact-name"
                    className="block text-sm font-medium mb-1.5"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Full Name *
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    className="form-input"
                    placeholder="Juan Dela Cruz"
                  />
                </div>
                <div>
                  <label
                    htmlFor="contact-email"
                    className="block text-sm font-medium mb-1.5"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Email Address *
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    className="form-input"
                    placeholder="your.email@example.com"
                  />
                </div>
                <div>
                  <label
                    htmlFor="contact-org"
                    className="block text-sm font-medium mb-1.5"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Organization/Affiliation
                  </label>
                  <input
                    id="contact-org"
                    type="text"
                    className="form-input"
                    placeholder="Your organization (optional)"
                  />
                </div>
                <div>
                  <label
                    htmlFor="contact-subject"
                    className="block text-sm font-medium mb-1.5"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Subject
                  </label>
                  <select
                    id="contact-subject"
                    className="form-input"
                    defaultValue=""
                  >
                    <option value="">Select a subject</option>
                    <option value="partnership">Partnership Inquiry</option>
                    <option value="technical">Technical Questions</option>
                    <option value="collaboration">
                      Collaboration Opportunity
                    </option>
                    <option value="data">Data Request</option>
                    <option value="general">General Inquiry</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="contact-message"
                    className="block text-sm font-medium mb-1.5"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Message *
                  </label>
                  <textarea
                    id="contact-message"
                    required
                    rows={4}
                    className="form-input resize-none"
                    placeholder="Tell us more about your inquiry..."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full btn-primary justify-center text-sm"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  <Send size={14} style={{ marginRight: "0.5rem" }} /> Send
                  Message
                </button>
                <p
                  className="text-xs text-center"
                  style={{ color: "var(--text-secondary)" }}
                >
                  We typically respond within 24-48 hours during business days
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER (matches old page routes) ═══ */}
      <footer
        className="site-footer py-12"
        style={{ borderTop: "1px solid rgba(255,255,255,.1)" }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-lg mb-3" style={{ color: "#fff" }}>
                PlantScope
              </h3>
              <p className="text-white/70 text-xs leading-relaxed">
                A GIS-Based Site Suitability Assessment and Reforestation
                Monitoring System with Geospatial Analytics for Ormoc City.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-sm mb-3" style={{ color: "#fff" }}>
                Pages
              </h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <a onClick={goToHome} className="footer-link cursor-pointer">
                    Home
                  </a>
                </li>
                <li>
                  <a onClick={goToLogin} className="footer-link cursor-pointer">
                    Login
                  </a>
                </li>
                <li>
                  <a
                    href="#mobile"
                    className="footer-link"
                    onClick={(e) => handleNavClick(e, "mobile")}
                  >
                    Mobile App
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-sm mb-3" style={{ color: "#fff" }}>
                Security
              </h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="/privacy-policy" className="footer-link">
                    Privacy Notice
                  </a>
                </li>
                <li>
                  <a href="/terms" className="footer-link">
                    Terms &amp; Conditions
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-sm mb-3" style={{ color: "#fff" }}>
                Connect With Us
              </h3>
              <p className="text-white/70 text-xs mb-2">
                <strong>Western Leyte College of Ormoc City</strong>
              </p>
              <p className="text-white/60 text-xs">
                College of ICT &amp; Engineering
              </p>
              <p className="text-white/60 text-xs">
                Ormoc City, Leyte, Philippines
              </p>
            </div>
          </div>
          <div
            className="text-center pt-6 text-xs"
            style={{
              borderTop: "1px solid rgba(255,255,255,.1)",
              color: "rgba(255,255,255,.5)",
            }}
          >
            © 2025 PlantScope – All rights reserved. | Developed with 💚 for
            Ormoc City
          </div>
        </div>
      </footer>
    </>
  );
}
