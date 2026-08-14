import { useState, useEffect, useRef } from "react";
import "@/assets/homepage/homepage.css";
import { useNavigate } from "react-router-dom";
import { api } from "@/constant/api.ts";
import logoImg from "@/assets/homepage/logo.jpg";
import {
  Shield,
  User,
  Database,
  MapPin,
  FileText,
  AlertTriangle,
  Scale,
  CheckCircle2,
  AlertCircle,
  Lock,
  BookOpen,
} from "lucide-react";

const TOC_ITEMS = [
  { id: "preamble", label: "Preamble" },
  { id: "section-1", label: "1. Scope & Purpose" },
  { id: "section-2", label: "2. Responsibilities" },
  { id: "section-3", label: "3. Prohibited" },
  { id: "section-4", label: "4. Data Ownership" },
  { id: "section-5", label: "5. Accounts" },
  { id: "section-6", label: "6. Liability" },
  { id: "section-7", label: "7. Privacy Compliance" },
  { id: "section-8", label: "8. Acceptance" },
  { id: "section-9", label: "9. Governing Law" },
];

export default function Terms_and_Conditions() {
  const [navScrolled, setNavScrolled] = useState(false);
  const [activeToc, setActiveToc] = useState("preamble");
  const loaderRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const navigate = useNavigate();

  /* ─── Auth check (unchanged) ─── */
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
        if (data.token) localStorage.setItem("token", data.token);
        if (data.user_role === "CityENROHead") navigate("/dashboard");
        else if (data.user_role === "DataManager")
          navigate("/dashboard-data-manager");
        else if (data.user_role === "GISSpecialist")
          navigate("/dashboard/GISS");
        else if (data.user_role === "AFA") navigate("/dashboard/AFA");
      }
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  useEffect(() => {
    checkIfStillLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Loader (unchanged) ─── */
  useEffect(() => {
    const loader = loaderRef.current;
    if (!loader) return;
    const timer = setTimeout(() => {
      loader.style.opacity = "0";
      setTimeout(() => {
        loader.style.display = "none";
      }, 600);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  /* ─── Nav: transparent → white on scroll ─── */
  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ─── TOC scroll-spy ─── */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveToc(entry.target.id);
        });
      },
      { rootMargin: "-120px 0px -65% 0px" },
    );
    Object.values(sectionRefs.current).forEach((ref) => {
      if (ref) observer.observe(ref);
    });
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 120;
    window.scrollTo({ top, behavior: "smooth" });
  };

  const setSectionRef = (id: string) => (el: HTMLElement | null) => {
    sectionRefs.current[id] = el;
  };

  const goToLogin = () => navigate("/Login");

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)]">
      {/* ═══ LOADER ═══ */}
      <div ref={loaderRef}>
        <div id="loader">
          <div className="loader-container">
            <div className="loader-ring-outer" />
            <div className="loader-ring-middle" />
            <div className="loader-ring-inner" />
            <div className="loader-logo">
              <img src={logoImg} alt="PlantScope Logo" />
            </div>
          </div>
          <div className="loader-text">PLANTSCOPE</div>
          <div className="loader-subtitle">Loading Terms & Conditions</div>
        </div>
      </div>

      {/* ═══ MINIMAL NAVBAR: brand left + Log In right ═══ */}
      <nav id="siteNav" className={navScrolled ? "nav-scrolled" : ""}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex items-center gap-2 sm:gap-3 flex-shrink-0 cursor-pointer"
              aria-label="PlantScope — go to home"
            >
              <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border nav-logo-ring flex-shrink-0 block">
                <img
                  src={logoImg}
                  className="w-full h-full object-cover"
                  alt="PlantScope Logo"
                />
              </span>
              <span
                className="font-bold text-base sm:text-lg nav-logo-text leading-none"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                PlantScope
              </span>
            </button>

            <button
              type="button"
              className="btn-login"
              style={{ padding: "0.5rem 1.25rem", fontSize: "0.85rem" }}
              onClick={goToLogin}
            >
              Log In
            </button>
          </div>
        </div>
      </nav>

      {/* ═══ HERO ══ */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            "radial-gradient(circle at 15% 10%, #163826 0%, #0D2318 45%, #0A1C13 100%)",
          paddingTop: "7rem",
          paddingBottom: "4rem",
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
        <div className="max-w-4xl mx-auto px-4 relative z-10 text-center">
          <span
            className="eyebrow"
            style={{
              color: "#8FE07C",
              marginBottom: "1.5rem",
              display: "inline-block",
            }}
          >
            Legal Agreement
          </span>
          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "clamp(2.25rem, 6vw, 3.75rem)",
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              marginBottom: "1.25rem",
            }}
          >
            Terms and Conditions
          </h1>
          <p
            style={{
              color: "rgba(255,255,255,0.65)",
              fontSize: "clamp(1rem, 1.5vw, 1.15rem)",
              maxWidth: "640px",
              margin: "0 auto",
              lineHeight: 1.7,
            }}
          >
            Governing access, registration, and use of the PLANTSCOPE System.
          </p>
        </div>
      </section>

      {/* ═══ MOBILE TOC (horizontal chips) ═══ */}
      <div className="lg:hidden sticky top-16 sm:top-20 z-40 bg-[var(--bg-primary)] border-b border-[var(--border)] px-4 py-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TOC_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className="whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors"
              style={
                activeToc === item.id
                  ? { background: "var(--accent)", color: "#fff" }
                  : {
                      background: "var(--bg-secondary)",
                      color: "var(--text-secondary)",
                    }
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-10 lg:gap-16">
          {/* Desktop TOC sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <span className="eyebrow">Contents</span>
              <nav className="mt-4 space-y-1">
                {TOC_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className="block w-full text-left px-3.5 py-2.5 text-sm rounded-lg transition-colors"
                    style={
                      activeToc === item.id
                        ? {
                            background: "var(--accent)",
                            color: "#fff",
                            fontWeight: 600,
                          }
                        : { color: "var(--text-secondary)" }
                    }
                  >
                    {item.label}
                  </button>
                ))}
              </nav>

              <div
                className="mt-8 p-4 rounded-xl"
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  className="text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: "var(--accent)" }}
                >
                  Need Help?
                </div>
                <p
                  className="text-xs"
                  style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}
                >
                  Questions about your account or these terms? Contact the Data
                  Manager.
                </p>
                <button
                  onClick={() => navigate("/privacy-policy#section-9")}
                  className="mt-3 text-xs font-semibold"
                  style={{ color: "var(--accent)" }}
                >
                  View Contacts →
                </button>
              </div>
            </div>
          </aside>

          {/* Content plates */}
          <div className="space-y-6">
            {/* PREAMBLE */}
            <div
              id="preamble"
              ref={setSectionRef("preamble")}
              className="plate"
            >
              <span className="eyebrow">Preamble</span>
              <h2 className="section-title">About These Terms</h2>
              <p className="text-[var(--text-secondary)] leading-relaxed mb-6">
                These Terms and Conditions govern the access, registration, and
                use of{" "}
                <strong className="text-[var(--text-primary)]">
                  PLANTSCOPE
                </strong>{" "}
                — a GIS-Based Site Suitability Assessment and Reforestation
                Monitoring System developed by students of the{" "}
                <strong className="text-[var(--text-primary)]">
                  College of ICT and Engineering, Western Leyte College of Ormoc
                  City
                </strong>
                , in collaboration with the{" "}
                <strong className="text-[var(--text-primary)]">
                  City ENRO
                </strong>{" "}
                and <strong className="text-[var(--text-primary)]">CPDO</strong>{" "}
                of Ormoc City.
              </p>

              {/* Red Warning Callout */}
              <div
                className="p-4 rounded-lg"
                style={{
                  background: "rgba(239, 68, 68, 0.04)",
                  borderLeft: "4px solid #ef4444",
                }}
              >
                <p
                  className="font-medium mb-1 flex items-center gap-2"
                  style={{ color: "var(--text-primary)" }}
                >
                  <AlertTriangle size={18} color="#ef4444" /> ⚠️ IMPORTANT –
                  PLEASE READ CAREFULLY
                </p>
                <p
                  className="text-sm"
                  style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}
                >
                  By registering an account, logging in, or otherwise accessing
                  PLANTSCOPE, you acknowledge that you have read, understood,
                  and agree to be legally bound by these Terms and Conditions in
                  their entirety. If you do not agree, you must immediately
                  discontinue use and request account deactivation from the Data
                  Manager.
                </p>
              </div>
            </div>

            {/* SECTION 1 */}
            <div
              id="section-1"
              ref={setSectionRef("section-1")}
              className="plate"
            >
              <span className="eyebrow">Section 1</span>
              <h2 className="section-title">Scope and Purpose of System Use</h2>

              <div className="space-y-4">
                <h3 className="font-semibold text-[var(--text-primary)] text-lg">
                  1.1 Scope
                </h3>
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                  These Terms and Conditions apply to all individuals who
                  access, register, or use PLANTSCOPE in any capacity,
                  including:
                </p>
                <ul className="list-disc list-inside text-[var(--text-secondary)] text-sm space-y-2 ml-2">
                  <li>
                    <strong className="text-[var(--text-primary)]">
                      City ENRO Head (The Head)
                    </strong>{" "}
                    — primary authority for reforestation program oversight and
                    LGU staff account authorization and audit trails
                  </li>
                  <li>
                    <strong className="text-[var(--text-primary)]">
                      Data Manager (System Administrator)
                    </strong>{" "}
                    — maintains technical and data integrity, oversees archive
                    management
                  </li>
                  <li>
                    <strong className="text-[var(--text-primary)]">
                      GIS Specialists
                    </strong>{" "}
                    — perform technical site suitability validation and manage
                    spatial data
                  </li>
                  <li>
                    <strong className="text-[var(--text-primary)]">
                      Onsite Inspectors
                    </strong>{" "}
                    — collect and submit field assessment data through the
                    mobile application
                  </li>
                  <li>
                    <strong className="text-[var(--text-primary)]">
                      Community Users (Tree Growers)
                    </strong>{" "}
                    — register for the Public Tree Planting Program and submit
                    planting progress updates
                  </li>
                </ul>
              </div>

              <div className="space-y-4 mt-8">
                <h3 className="font-semibold text-[var(--text-primary)] text-lg">
                  1.2 Purpose
                </h3>
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                  PLANTSCOPE is designed exclusively to support the following
                  government functions of Ormoc City:
                </p>
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  {[
                    {
                      title: "Reforestation Site Assessment",
                      desc: "Identify, evaluate, and validate suitable tree planting locations through NDVI pre-screening and MCDA.",
                    },
                    {
                      title: "Field Data Collection",
                      desc: "Enable Onsite Inspectors to collect structured field observations, safety indicators, soil data, GPS coordinates, and geotagged photographs via the mobile application.",
                    },
                    {
                      title: "Reforestation Monitoring",
                      desc: "Track post-planting progress, tree survival rates, and maintenance activities for validated reforestation sites.",
                    },
                    {
                      title: "Community Engagement",
                      desc: "Facilitate participation of schools, organizations, and groups in the Public Tree Planting Program.",
                    },
                    {
                      title: "Archive Data Management",
                      desc: "Oversee storage, restoration, and permanent deletion of records in accordance with government retention policies.",
                    },
                    {
                      title: "Compliance & Audit",
                      desc: "Maintain immutable audit trails and versioned site_data records for accountability and evidence-based environmental governance.",
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-lg"
                      style={{
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div
                        className="font-semibold mb-1"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {item.title}
                      </div>
                      <p
                        className="text-xs"
                        style={{
                          color: "var(--text-secondary)",
                          lineHeight: 1.5,
                        }}
                      >
                        {item.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 mt-8">
                <h3 className="font-semibold text-[var(--text-primary)] text-lg">
                  1.3 Non-Commercial Use
                </h3>
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                  PLANTSCOPE is a non-commercial, government-deployed
                  environmental management system developed as an academic
                  capstone project. It shall not be used for commercial gain,
                  private business operations, or activities outside the
                  environmental mandate of the Ormoc City LGU.
                </p>
              </div>
            </div>

            {/* SECTION 2 */}
            <div
              id="section-2"
              ref={setSectionRef("section-2")}
              className="plate"
            >
              <span className="eyebrow">Section 2</span>
              <h2 className="section-title">
                User Responsibilities and Acceptable Use
              </h2>

              <div className="space-y-4">
                <h3 className="font-semibold text-[var(--text-primary)] text-lg">
                  2.1 General Responsibilities of All Users
                </h3>
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                  All registered users of PLANTSCOPE, regardless of role, are
                  responsible for the following:
                </p>
                <ul className="space-y-2 ml-1">
                  {[
                    {
                      title: "Account Security:",
                      desc: "Users are solely responsible for maintaining the confidentiality of their login credentials. Unauthorized use of a user account must be reported immediately to the Data Manager.",
                    },
                    {
                      title: "Accuracy of Information:",
                      desc: "All data, records, and submissions must be accurate, truthful, and complete. Submission of false, fabricated, or misleading information is strictly prohibited.",
                    },
                    {
                      title: "Role Compliance:",
                      desc: "Users must access and use only the features and data authorized for their assigned role.",
                    },
                    {
                      title: "System Integrity:",
                      desc: "Users must not perform any action that compromises the integrity, availability, or security of the PLANTSCOPE system.",
                    },
                    {
                      title: "Compliance with Laws:",
                      desc: "Users must comply with all applicable Philippine laws, including RA 10173, RA 7160, environmental protection laws, and civil service regulations.",
                    },
                  ].map((item, i) => (
                    <li
                      key={i}
                      className="flex gap-3 text-sm"
                      style={{
                        color: "var(--text-secondary)",
                        lineHeight: 1.6,
                      }}
                    >
                      <span style={{ color: "var(--accent)", flexShrink: 0 }}>
                        •
                      </span>
                      <span>
                        <strong style={{ color: "var(--text-primary)" }}>
                          {item.title}
                        </strong>{" "}
                        {item.desc}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-4 mt-8">
                <h3 className="font-semibold text-[var(--text-primary)] text-lg">
                  2.2 Role-Specific Responsibilities
                </h3>
                <div className="space-y-6">
                  {[
                    {
                      role: "City ENRO Head (The Head)",
                      icon: <Shield size={18} />,
                      items: [
                        "Acts as the primary authority for the reforestation program and system oversight",
                        "Authorizes the creation of LGU staff accounts for the system",
                        "Reviews high-level descriptive analytics reports on program performance and site status",
                        "Serves as a primary contact for legal and privacy concerns related to the system",
                        "Ensures that system operations remain aligned with the environmental mandate of the Ormoc City LGU",
                      ],
                    },
                    {
                      role: "Data Manager (System Administrator)",
                      icon: <Database size={18} />,
                      items: [
                        "Maintains technical and data integrity consistent throughout the system cycle",
                        "Oversees Archive Data Management — ensuring records are stored or disposed of according to government retention policies",
                        "Serves as the primary system contact for data privacy concerns, security incidents, and technical issues",
                      ],
                    },
                    {
                      role: "GIS Specialist",
                      icon: <MapPin size={18} />,
                      items: [
                        "Reviews all inspector-submitted field_assessment_data with professional objectivity before finalizing site records",
                        "Performs MCDA validation decisions (ACCEPT / REJECT / ACCEPT_WITH_CONDITIONS) only after thorough evaluation",
                        "Provides accurate justification notes for every validation decision to preserve the integrity of the audit trail",
                        "Ensures that finalized site_data records are complete and correct before setting is_current = true",
                        "Treats all site data, spatial records, and related information as confidential government information",
                        "Ensures assignments to Onsite Inspectors are made only to authorized and properly registered inspectors",
                      ],
                    },
                    {
                      role: "Onsite Inspector (Mobile Application)",
                      icon: <User size={18} />,
                      items: [
                        "Submits field assessment data based on direct, first-hand observation at the assigned site",
                        "Do not fabricate, estimate without basis, or copy data from other submissions",
                        "Ensures that geotagged photographs are taken at the actual field site",
                        "GPS coordinates, when submitted, must reflect the actual location of the assessment site",
                        "Mobile devices issued for field data gathering must be used solely for PLANTSCOPE-related field activities",
                        "Reports any technical issues with the mobile application or data synchronization to the Data Manager promptly",
                        "Must only conduct field assessments at the specific site they have been officially assigned to",
                      ],
                    },
                    {
                      role: "Community User / Tree Grower",
                      icon: <FileText size={18} />,
                      items: [
                        "Provides accurate registration information including full name, contact details, and organizational affiliation",
                        "Submits genuine and timely progress updates for assigned tree planting sites",
                        "Complies with the assigned schedule and site allocation provided by the Data Manager",
                        "Notifies the Data Manager of any change in contact information or organizational status",
                        "Responsible for ensuring that participants they represent are aware of these Terms and Conditions",
                      ],
                    },
                  ].map((role, i) => (
                    <div
                      key={i}
                      className="rounded-xl p-5"
                      style={{
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          style={{
                            width: "2rem",
                            height: "2rem",
                            borderRadius: "8px",
                            background: "var(--accent)",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {role.icon}
                        </div>
                        <h4
                          className="font-semibold"
                          style={{
                            color: "var(--text-primary)",
                            fontSize: "1rem",
                          }}
                        >
                          {role.role}
                        </h4>
                      </div>
                      <ul className="space-y-1.5 ml-11">
                        {role.items.map((item, j) => (
                          <li
                            key={j}
                            className="flex gap-2 text-sm"
                            style={{
                              color: "var(--text-secondary)",
                              lineHeight: 1.6,
                            }}
                          >
                            <span
                              style={{ color: "var(--accent)", flexShrink: 0 }}
                            >
                              •
                            </span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* SECTION 3 */}
            <div
              id="section-3"
              ref={setSectionRef("section-3")}
              className="plate"
            >
              <span className="eyebrow">Section 3</span>
              <h2 className="section-title">Prohibited Activities</h2>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-6">
                The following activities are strictly prohibited on PLANTSCOPE.
                Violation may result in immediate account suspension, referral
                to appropriate authorities, and legal action under applicable
                Philippine laws.
              </p>

              <div className="grid md:grid-cols-2 gap-3 text-sm">
                {[
                  {
                    num: "01",
                    title: "Unauthorized Access",
                    desc: "Accessing, attempting to access, or gaining entry to any account, data record, GIS layer, or system feature not authorized for your assigned role.",
                  },
                  {
                    num: "02",
                    title: "Credential Sharing & Impersonation",
                    desc: "Sharing or transferring your login credentials to any other person. Logging into the system using another user's credentials.",
                  },
                  {
                    num: "03",
                    title: "Submission of False Data",
                    desc: "Entering or submitting data that is knowingly false, fabricated, or deliberately misleading — including falsified field observations, fake GPS coordinates, or manipulated photographs.",
                  },
                  {
                    num: "04",
                    title: "Unauthorized Data Extraction",
                    desc: "Copying, exporting, or transmitting personal data, spatial records, or government maps to unauthorized individuals or external platforms.",
                  },
                  {
                    num: "05",
                    title: "System Tampering",
                    desc: "Introducing malicious code, performing denial-of-service attacks, SQL injection, or any form of technical interference that disrupts the system.",
                  },
                  {
                    num: "06",
                    title: "Unauthorized Modification/Deletion",
                    desc: "Modifying, overwriting, or deleting any system record without proper authority. The Data Manager may only archive or delete records per approved retention policies.",
                  },
                  {
                    num: "07",
                    title: "Misuse of Personal Data",
                    desc: "Using personal data accessed through PLANTSCOPE for any purpose other than those explicitly stated in these Terms and the Data Privacy Notice.",
                  },
                  {
                    num: "08",
                    title: "Use Outside Authorized Scope",
                    desc: "Using PLANTSCOPE for activities beyond its stated environmental management and reforestation functions.",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-lg"
                    style={{
                      background: "rgba(239, 68, 68, 0.03)",
                      border: "1px solid rgba(239, 68, 68, 0.15)",
                    }}
                  >
                    <div
                      className="font-semibold mb-1"
                      style={{ color: "var(--text-primary)" }}
                    >
                      <span style={{ color: "#ef4444" }}>{item.num}.</span>{" "}
                      {item.title}
                    </div>
                    <p
                      className="text-xs"
                      style={{
                        color: "var(--text-secondary)",
                        lineHeight: 1.5,
                      }}
                    >
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>

              {/* Legal Warning */}
              <div
                className="p-4 rounded-lg mt-6"
                style={{
                  background: "rgba(239, 68, 68, 0.04)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                }}
              >
                <p
                  className="font-medium flex items-center gap-2"
                  style={{ color: "var(--text-primary)" }}
                >
                  <Scale size={18} color="#ef4444" /> ⚖️ Legal Warning
                </p>
                <p
                  className="text-sm mt-1"
                  style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}
                >
                  Violations may constitute criminal offenses under RA 10173
                  (Data Privacy Act), RA 10175 (Cybercrime Prevention Act), RA
                  3019 (Anti-Graft), and other applicable Philippine laws. The
                  Ormoc City LGU reserves the right to refer violations to the
                  National Privacy Commission, law enforcement, or other
                  competent bodies.
                </p>
              </div>
            </div>

            {/* SECTION 4 */}
            <div
              id="section-4"
              ref={setSectionRef("section-4")}
              className="plate"
            >
              <span className="eyebrow">Section 4</span>
              <h2 className="section-title">
                Data Ownership and Handling Responsibilities
              </h2>

              <div className="space-y-4">
                <h3 className="font-semibold text-[var(--text-primary)] text-lg">
                  4.1 Ownership of System Data
                </h3>
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                  All data submitted to, processed by, or generated within
                  PLANTSCOPE is the property of the{" "}
                  <strong className="text-[var(--text-primary)]">
                    Ormoc City Local Government Unit
                  </strong>
                  , acting through City ENRO and CPDO. Personal data submitted
                  by individual users remains subject to the rights of the data
                  subject under RA 10173.
                </p>
              </div>

              <div className="space-y-4 mt-8">
                <h3 className="font-semibold text-[var(--text-primary)] text-lg">
                  4.2 Data Handling Responsibilities by Role
                </h3>
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  {[
                    {
                      role: "City ENRO Head",
                      desc: "Responsible for overall governance of user data, authorization of staff account creation, and oversight of system operations in compliance with RA 10173.",
                    },
                    {
                      role: "Data Manager",
                      desc: "Responsible for maintaining technical integrity of all system data and overseeing Archive Data Management per government retention policies.",
                    },
                    {
                      role: "GIS Specialist",
                      desc: "Responsible for accuracy and integrity of all spatial data and site validation records they finalize.",
                    },
                    {
                      role: "Onsite Inspector",
                      desc: "Responsible for truthfulness and completeness of all field_assessment_data submitted via the mobile application.",
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-lg"
                      style={{
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div
                        className="font-semibold mb-1"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {item.role}
                      </div>
                      <p
                        className="text-xs"
                        style={{
                          color: "var(--text-secondary)",
                          lineHeight: 1.5,
                        }}
                      >
                        {item.desc}
                      </p>
                    </div>
                  ))}
                  <div
                    className="p-4 rounded-lg md:col-span-2"
                    style={{
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      className="font-semibold mb-1"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Community User (Tree Grower)
                    </div>
                    <p
                      className="text-xs"
                      style={{
                        color: "var(--text-secondary)",
                        lineHeight: 1.5,
                      }}
                    >
                      Responsible for accuracy of registration details and
                      progress reports submitted to the system. Must report any
                      errors promptly to the Data Manager.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mt-8">
                <h3 className="font-semibold text-[var(--text-primary)] text-lg">
                  4.3 Data Sharing Restrictions
                </h3>
                <ul className="space-y-2 ml-1">
                  {[
                    "Personal data shall not be disclosed to private companies, commercial entities, or individuals not affiliated with the system's official mandate.",
                    "Spatial data, GIS maps, and site records derived from PLANTSCOPE shall not be published or commercialized without prior written approval of the CPDO and City ENRO.",
                    "Aggregate, de-identified data may be used for academic research with LGU approval, provided that individual users cannot be identified.",
                  ].map((item, i) => (
                    <li
                      key={i}
                      className="flex gap-3 text-sm"
                      style={{
                        color: "var(--text-secondary)",
                        lineHeight: 1.6,
                      }}
                    >
                      <span style={{ color: "var(--accent)", flexShrink: 0 }}>
                        •
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* SECTION 5 */}
            <div
              id="section-5"
              ref={setSectionRef("section-5")}
              className="plate"
            >
              <span className="eyebrow">Section 5</span>
              <h2 className="section-title">
                Account Management and Access Control
              </h2>

              <div className="space-y-4">
                <h3 className="font-semibold text-[var(--text-primary)] text-lg">
                  5.1 Account Registration
                </h3>
                <ul className="space-y-2 ml-1">
                  {[
                    "LGU staff accounts (Head, Data Manager, GIS Specialists, Onsite Inspectors) are created by the Head.",
                    "Community user accounts require submission of a registration request through the community portal, subject to review from the Data Manager with final approval by the Head.",
                    "Providing false registration information is grounds for immediate account rejection or termination.",
                  ].map((item, i) => (
                    <li
                      key={i}
                      className="flex gap-3 text-sm"
                      style={{
                        color: "var(--text-secondary)",
                        lineHeight: 1.6,
                      }}
                    >
                      <span style={{ color: "var(--accent)", flexShrink: 0 }}>
                        •
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-4 mt-8">
                <h3 className="font-semibold text-[var(--text-primary)] text-lg">
                  5.2 Account Suspension and Termination
                </h3>
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-3">
                  The Data Manager, upon direction from the Head, reserves the
                  right to suspend or permanently deactivate any user account
                  under the following circumstances:
                </p>
                <ul className="space-y-2 ml-1">
                  {[
                    "Violation of any provision of these Terms and Conditions",
                    "Submission of false or fraudulent information",
                    "Unauthorized access or security breach originating from the user account",
                    "Separation, reassignment, or resignation of LGU personnel from their relevant duties",
                    "Completion or withdrawal from the Public Tree Planting Program (for community users)",
                    "Receipt of a lawful order requiring account termination from a competent authority",
                  ].map((item, i) => (
                    <li
                      key={i}
                      className="flex gap-3 text-sm"
                      style={{
                        color: "var(--text-secondary)",
                        lineHeight: 1.6,
                      }}
                    >
                      <span style={{ color: "var(--accent)", flexShrink: 0 }}>
                        •
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* SECTION 6 */}
            <div
              id="section-6"
              ref={setSectionRef("section-6")}
              className="plate"
            >
              <span className="eyebrow">Section 6</span>
              <h2 className="section-title">Limitation of Liability</h2>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-6">
                PLANTSCOPE is an academic capstone project developed by students
                of Western Leyte College of Ormoc City. The following
                limitations of liability apply:
              </p>

              <div className="space-y-3 text-sm">
                {[
                  {
                    title: "6.1 No Warranty of Uninterrupted Service",
                    desc: 'PLANTSCOPE is provided on an "as-is" and "as-available" basis. The development team and Western Leyte College of Ormoc City make no warranty that the system will operate without interruption, error, or defect at all times.',
                  },
                  {
                    title: "6.2 No Liability for User-Submitted Data",
                    desc: "The system does not automatically verify the accuracy of user-submitted data. The PLANTSCOPE development team shall not be liable for decisions made based on inaccurate, incomplete, or false data submitted by users.",
                  },
                  {
                    title: "6.3 Data Manager Accountability",
                    desc: "The Data Manager bears institutional responsibility for the proper administration of system records and audit trails. Unauthorized manipulation of records by the Data Manager constitutes a serious violation of these Terms and applicable law.",
                  },
                  {
                    title: "6.4 LGU Operational Liability",
                    desc: "The Ormoc City LGU, acting through City ENRO and CPDO, assumes operational responsibility for the deployed PLANTSCOPE system and for decisions made based on its outputs.",
                  },
                  {
                    title: "6.5 Force Majeure",
                    desc: "Neither the system developer nor the LGU shall be held liable for any failure to perform obligations caused by circumstances beyond reasonable control, including natural disasters, acts of war, or government-mandated system shutdowns.",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-lg"
                    style={{
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      className="font-semibold mb-1"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {item.title}
                    </div>
                    <p
                      className="text-xs"
                      style={{
                        color: "var(--text-secondary)",
                        lineHeight: 1.5,
                      }}
                    >
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 7 */}
            <div
              id="section-7"
              ref={setSectionRef("section-7")}
              className="plate"
            >
              <span className="eyebrow">Section 7</span>
              <h2 className="section-title">
                Compliance with RA 10173 – Data Privacy Act of 2012
              </h2>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-6">
                PLANTSCOPE is designed and operated in full compliance with
                Republic Act No. 10173 and its IRR, as enforced by the National
                Privacy Commission (NPC) of the Philippines.
              </p>

              <div className="grid md:grid-cols-2 gap-3 text-sm">
                {[
                  {
                    title: "Transparency",
                    desc: "Users are informed of all data collection and processing through the PLANTSCOPE Data Privacy Notice, issued alongside these Terms.",
                  },
                  {
                    title: "Legitimate Purpose",
                    desc: "Personal data is collected exclusively for reforestation management, field monitoring, community engagement, and audit functions of the Ormoc City LGU.",
                  },
                  {
                    title: "Proportionality",
                    desc: "Only the minimum personal data necessary for each role's functions is collected. GPS coordinates are optional.",
                  },
                  {
                    title: "Data Security",
                    desc: "Technical and organizational security measures are implemented including encryption, RBAC, and immutable audit trails managed by the Data Manager.",
                  },
                  {
                    title: "Data Subject Rights",
                    desc: "All registered users retain their rights under Chapter IV of RA 10173, exercisable through the Data Manager or the LGU DPO.",
                  },
                  {
                    title: "Data Retention & Disposal",
                    desc: "Data is retained per the schedules in the PLANTSCOPE Data Privacy Notice and disposed of securely by the Data Manager upon expiration.",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-lg"
                    style={{
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      className="font-semibold mb-1"
                      style={{ color: "var(--accent)" }}
                    >
                      {item.title}
                    </div>
                    <p
                      className="text-xs"
                      style={{
                        color: "var(--text-secondary)",
                        lineHeight: 1.5,
                      }}
                    >
                      {item.desc}
                    </p>
                  </div>
                ))}
                <div
                  className="p-4 rounded-lg md:col-span-2"
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    className="font-semibold mb-1"
                    style={{ color: "var(--accent)" }}
                  >
                    Breach Notification
                  </div>
                  <p
                    className="text-xs"
                    style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}
                  >
                    In the event of a data breach, the Data Manager and Ormoc
                    City LGU DPO shall follow NPC mandatory breach notification
                    procedures under NPC Circular No. 16-03.
                  </p>
                </div>
              </div>

              <p
                className="text-sm italic mt-6"
                style={{ color: "var(--accent)" }}
              >
                These Terms and Conditions must be read in conjunction with the
                PLANTSCOPE Data Privacy Notice. In matters of data privacy, the
                Data Privacy Notice shall prevail.
              </p>
            </div>

            {/* SECTION 8 */}
            <div
              id="section-8"
              ref={setSectionRef("section-8")}
              className="plate"
            >
              <span className="eyebrow">Section 8</span>
              <h2 className="section-title">
                Acceptance of Terms and Conditions
              </h2>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-6">
                By accessing or using PLANTSCOPE, you expressly confirm and
                agree to the following:
              </p>

              <div
                className="p-6 rounded-xl"
                style={{
                  background: "rgba(22, 101, 52, 0.04)",
                  border: "1px solid rgba(22, 101, 52, 0.15)",
                }}
              >
                <div className="space-y-4">
                  {[
                    "I have read, understood, and voluntarily agree to comply with all provisions of these Terms and Conditions.",
                    "I have read and understood the PLANTSCOPE Data Privacy Notice and consent to the collection, processing, and use of my personal data as described therein.",
                    "I understand that continued use of PLANTSCOPE after any amendment to these Terms and Conditions is effective shall constitute my acceptance of the updated Terms.",
                    "I understand that violation of these Terms and Conditions may result in account suspension, termination, and legal consequences under applicable Philippine law.",
                    "I affirm that all information I provide to the system is accurate, truthful, and complete, and I accept full responsibility for the data I submit.",
                    "I acknowledge that PLANTSCOPE is a government-deployed environmental management system and commit to using it exclusively for its stated purposes.",
                  ].map((text, i) => (
                    <div
                      key={i}
                      className="flex gap-3 text-sm"
                      style={{
                        color: "var(--text-secondary)",
                        lineHeight: 1.6,
                      }}
                    >
                      <CheckCircle2
                        size={18}
                        color="var(--accent)"
                        className="flex-shrink-0 mt-0.5"
                      />
                      <p>
                        {i + 1}. {text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* SECTION 9 */}
            <div
              id="section-9"
              ref={setSectionRef("section-9")}
              className="plate"
            >
              <span className="eyebrow">Section 9</span>
              <h2 className="section-title">Governing Law and Jurisdiction</h2>
              <div className="flex gap-4 items-start">
                <div
                  style={{
                    width: "2.5rem",
                    height: "2.5rem",
                    borderRadius: "10px",
                    background: "var(--accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <BookOpen size={18} color="#fff" />
                </div>
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                  These Terms and Conditions shall be governed by the laws of
                  the Republic of the Philippines, including RA 10173, RA 10175,
                  RA 7160, RA 3019, and NPC Circulars. Any dispute shall be
                  subject to the jurisdiction of the appropriate government
                  agencies and courts, with venue in{" "}
                  <strong className="text-[var(--text-primary)]">
                    Ormoc City, Leyte
                  </strong>
                  .
                </p>
              </div>
            </div>

            {/* DOCUMENT FOOTER / ACKNOWLEDGMENT */}
            <div
              className="dark-plate"
              style={{
                padding: "2rem",
                borderRadius: "var(--radius)",
                textAlign: "center",
              }}
            >
              <h3 className="font-bold text-lg mb-2" style={{ color: "#fff" }}>
                TERMS AND CONDITIONS – END OF DOCUMENT
              </h3>
              <p
                className="text-sm mb-3"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                This document is to be read together with the PLANTSCOPE Data
                Privacy Notice.
              </p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                PLANTSCOPE | Western Leyte College of Ormoc City | College of
                ICT and Engineering | RA 10173 Compliant
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ FOOTER — homepage theme (near-black, white headings) ═══ */}
      <footer
        className="site-footer py-12"
        style={{ borderTop: "1px solid rgba(255,255,255,.1)" }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
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
                  <a
                    onClick={() => navigate("/")}
                    className="footer-link cursor-pointer"
                  >
                    Home
                  </a>
                </li>
                <li>
                  <a
                    onClick={() => navigate("/Login")}
                    className="footer-link cursor-pointer"
                  >
                    Login
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-sm mb-3" style={{ color: "#fff" }}>
                Legal
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
            © 2026 PlantScope – All rights reserved. | Developed with 💚 for
            Ormoc City
          </div>
        </div>
      </footer>
    </div>
  );
}
