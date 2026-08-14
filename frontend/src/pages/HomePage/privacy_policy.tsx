import { useState, useEffect, useRef } from "react";
import "@/assets/homepage/homepage.css";
import { useNavigate } from "react-router-dom";
import { api } from "@/constant/api.ts";
import logoImg from "@/assets/homepage/logo.jpg";
import {
  Shield, User, Database, Lock, FileText, MapPin, Building2,
  CheckCircle2, AlertCircle,
} from "lucide-react";

const TOC_ITEMS = [
  { id: "preamble", label: "Preamble" },
  { id: "section-1", label: "1. Controller" },
  { id: "section-2", label: "2. Data Collected" },
  { id: "section-3", label: "3. Sensitive Data" },
  { id: "section-4", label: "4. Legal Basis" },
  { id: "section-5", label: "5. Processing" },
  { id: "section-6", label: "6. Retention" },
  { id: "section-7", label: "7. Security" },
  { id: "section-8", label: "8. Your Rights" },
  { id: "section-9", label: "9. Contact" },
];

export default function Privacy_policy() {
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
        else if (data.user_role === "DataManager") navigate("/dashboard-data-manager");
        else if (data.user_role === "GISSpecialist") navigate("/dashboard/GISS");
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
      setTimeout(() => { loader.style.display = "none"; }, 600);
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
      { rootMargin: "-120px 0px -65% 0px" }
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
          <div className="loader-subtitle">Loading Privacy Notice</div>
        </div>
      </div>

      {/* ═══ MINIMAL NAVBAR: brand left + Log In right ═══ */}
      <nav id="siteNav" className={navScrolled ? "nav-scrolled" : ""}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Brand (left) → home */}
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex items-center gap-2 sm:gap-3 flex-shrink-0 cursor-pointer"
              aria-label="PlantScope — go to home"
            >
              <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border nav-logo-ring flex-shrink-0 block">
                <img src={logoImg} className="w-full h-full object-cover" alt="PlantScope Logo" />
              </span>
              <span
                className="font-bold text-base sm:text-lg nav-logo-text leading-none"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                PlantScope
              </span>
            </button>

            {/* Log In (right) — always visible, mobile-friendly */}
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
          background: "radial-gradient(circle at 15% 10%, #163826 0%, #0D2318 45%, #0A1C13 100%)",
          paddingTop: "7rem",
          paddingBottom: "4rem",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(rgba(124,213,106,0.08) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            opacity: 0.6,
            pointerEvents: "none",
          }}
        />
        <div className="max-w-4xl mx-auto px-4 relative z-10 text-center">
          <span className="eyebrow" style={{ color: "#8FE07C", marginBottom: "1.5rem", display: "inline-block" }}>
            Republic Act No. 10173
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
            Data Privacy Notice
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
            Issued pursuant to the Data Privacy Act of 2012 and its Implementing Rules and Regulations.
            Learn how PLANTSCOPE collects, uses, and protects your personal information.
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
                  : { background: "var(--bg-secondary)", color: "var(--text-secondary)" }
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
                        ? { background: "var(--accent)", color: "#fff", fontWeight: 600 }
                        : { color: "var(--text-secondary)" }
                    }
                  >
                    {item.label}
                  </button>
                ))}
              </nav>

              <div className="mt-8 p-4 rounded-xl" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--accent)" }}>
                  Need Help?
                </div>
                <p className="text-xs" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  Questions about your data? Contact our Data Protection Officer directly.
                </p>
                <button
                  onClick={() => scrollToSection("section-9")}
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
            <div id="preamble" ref={setSectionRef("preamble")} className="plate">
              <span className="eyebrow">Preamble</span>
              <h2 className="section-title">About This Notice</h2>
              <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
                <strong className="text-[var(--text-primary)]">PLANTSCOPE</strong> is a
                GIS-based reforestation monitoring and site suitability assessment platform
                developed by students of the{" "}
                <strong className="text-[var(--text-primary)]">
                  College of ICT and Engineering, Western Leyte College of Ormoc City
                </strong>
                , in collaboration with the{" "}
                <strong className="text-[var(--text-primary)]">
                  City Environment and Natural Resources Office (City ENRO)
                </strong>{" "}
                and the{" "}
                <strong className="text-[var(--text-primary)]">
                  City Planning and Development Office (CPDO)
                </strong>{" "}
                of Ormoc City.
              </p>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                This Data Privacy Notice is issued pursuant to{" "}
                <strong className="text-[var(--text-primary)]">Republic Act No. 10173</strong>,
                known as the{" "}
                <strong className="text-[var(--text-primary)]">
                  Data Privacy Act of 2012 (DPA)
                </strong>
                , and its Implementing Rules and Regulations (IRR). It explains how PLANTSCOPE
                collects, uses, stores, protects, and disposes of personal data from its users,
                and informs all data subjects of their rights under Philippine law.
              </p>

              <div className="info-card glass mt-6" style={{ padding: "1.25rem 1.5rem", borderRadius: "14px" }}>
                <div className="flex gap-3">
                  <div
                    style={{
                      width: "2.5rem", height: "2.5rem", borderRadius: "10px",
                      background: "rgba(124,213,106,0.12)", border: "1px solid rgba(124,213,106,0.25)",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}
                  >
                    <AlertCircle size={18} color="#7CD56A" />
                  </div>
                  <p className="italic" style={{ color: "var(--text-secondary)", fontSize: "0.92rem", lineHeight: 1.6 }}>
                    By registering an account or accessing any feature of PLANTSCOPE, users
                    acknowledge that they have read and understood this notice.
                  </p>
                </div>
              </div>
            </div>

            {/* SECTION 1 */}
            <div id="section-1" ref={setSectionRef("section-1")} className="plate">
              <span className="eyebrow">Section 1</span>
              <h2 className="section-title">Personal Information Controller</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {[
                  { label: "Entity", value: "City Environment and Natural Resources Office (City ENRO), Ormoc City LGU, in coordination with the College of ICT and Engineering, Western Leyte College of Ormoc City" },
                  { label: "Address", value: "A. Bonifacio St., Ormoc City, Leyte, Philippines" },
                  { label: "DPO / Contact", value: "Designated Data Protection Officer (DPO) of Ormoc City LGU or the PLANTSCOPE Data Manager (System Administrator)" },
                  { label: "Email", value: <>system.admin@plantscope.gov.ph <span className="text-[var(--text-secondary)] text-xs">(to be assigned upon deployment)</span></> },
                  { label: "Phone", value: <>+63-XXX-XXX-XXXX <span className="text-[var(--text-secondary)] text-xs">(to be assigned upon deployment)</span></> },
                ].map((row, i) => (
                  <div key={i} className="p-4 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
                    <div className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--accent)" }}>
                      {row.label}
                    </div>
                    <div className="text-sm" style={{ color: "var(--text-primary)", lineHeight: 1.6 }}>
                      {row.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 2 */}
            <div id="section-2" ref={setSectionRef("section-2")} className="plate">
              <span className="eyebrow">Section 2</span>
              <h2 className="section-title">Personal Data Collected</h2>
              <p className="text-[var(--text-secondary)] leading-relaxed mb-6">
                PLANTSCOPE collects the following categories of personal data from its registered
                users, depending on their assigned system role:
              </p>
              <div className="space-y-6">
                {[
                  {
                    role: "2.1 City ENRO Head", icon: <Shield size={18} />,
                    items: [
                      "Full name, official email address, contact number",
                      "Gender, birthday, address",
                      "Username and encrypted password",
                      "Login timestamps, session logs, and audit trail records",
                      "High-level actions performed within the system (approvals, staff account authorization)",
                    ],
                  },
                  {
                    role: "2.2 Data Manager (System Administrator)", icon: <Database size={18} />,
                    items: [
                      "Full name, official email address, contact number",
                      "Username and encrypted password",
                      "Gender, birthday, address",
                      "Session logs and immutable audit trail records",
                    ],
                  },
                  {
                    role: "2.3 GIS Specialist", icon: <MapPin size={18} />,
                    items: [
                      "Full name, official email address, contact number",
                      "Username and encrypted password",
                      "Gender, birthday, address",
                      "Records of Onsite Inspector assignments (identity, target site, date)",
                      "Audit trail logs of finalized site_data records with version history",
                    ],
                  },
                  {
                    role: "2.4 Onsite Inspector (Mobile Application Users)", icon: <User size={18} />,
                    items: [
                      "Full name, designation, assigned barangay or area",
                      "Gender, birthday, address, contact details",
                      "Username and encrypted password",
                      "Field assessment submissions: safety indicators, boundary markers, soil data",
                      "GPS coordinates (optional, when voluntarily submitted)",
                      "Geotagged photographs and device metadata",
                    ],
                  },
                  {
                    role: "2.5 Community User / Tree Growers", icon: <FileText size={18} />,
                    items: [
                      "Full name and affiliated organization/group",
                      "Gender, birthday, address, contact details",
                      "Username and encrypted password",
                      "Registration details and program preferences",
                      "Tree planting progress updates and assigned site records",
                    ],
                  },
                ].map((role, i) => (
                  <div key={i} className="rounded-xl p-5" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        style={{
                          width: "2rem", height: "2rem", borderRadius: "8px", background: "var(--accent)",
                          color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}
                      >
                        {role.icon}
                      </div>
                      <h3 className="font-semibold" style={{ color: "var(--text-primary)", fontSize: "1rem" }}>
                        {role.role}
                      </h3>
                    </div>
                    <ul className="space-y-1.5 ml-11">
                      {role.items.map((item, j) => (
                        <li key={j} className="flex gap-2 text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                          <span style={{ color: "var(--accent)", flexShrink: 0 }}>•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 3 */}
            <div id="section-3" ref={setSectionRef("section-3")} className="plate">
              <span className="eyebrow">Section 3</span>
              <h2 className="section-title">Sensitive Personal Information</h2>
              <p className="text-[var(--text-secondary)] leading-relaxed mb-6">
                The following data may qualify as sensitive or privileged under Section 3(l) of RA 10173:
              </p>
              <div className="space-y-3">
                {[
                  { title: "Precise GPS Coordinates", desc: "Location data tied to a person's presence at a field site may reveal movement patterns or physical location of government personnel." },
                  { title: "Geotagged Photographs", desc: "Photographs with embedded EXIF data contain both visual and locational sensitive information." },
                  { title: "Community Group Affiliation", desc: "Affiliation with schools or civic organizations may intersect with sensitive community information." },
                ].map((item, i) => (
                  <div key={i} className="rounded-lg p-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                    <div className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{item.title}</div>
                    <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>{item.desc}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm italic mt-4" style={{ color: "var(--accent)" }}>
                * GPS coordinate submission by Onsite Inspectors is optional and voluntary.
              </p>
            </div>

            {/* SECTION 4 */}
            <div id="section-4" ref={setSectionRef("section-4")} className="plate">
              <span className="eyebrow">Section 4</span>
              <h2 className="section-title">Purpose and Legal Basis for Data Processing</h2>
              <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
                Processing is conducted on the basis of:
              </p>
              <ul className="space-y-2 mb-8 ml-1">
                {[
                  "Consent of the data subject (for community users, upon registration)",
                  "Fulfillment of a contract or quasi-contract (for LGU personnel)",
                  "Compliance with legal obligations (RA 10173, RA 7160, environmental laws)",
                  "Exercise of official authority or performance of a task in the public interest",
                ].map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    <CheckCircle2 size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: "3px" }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { title: "Account Management", desc: "Create, maintain, and secure user accounts; enforce role-based access." },
                  { title: "Site Assessment", desc: "Process field observations, spatial data, and MCDA validation decisions." },
                  { title: "Field Data Collection", desc: "Enable submission of safety indicators, GPS data, and geotagged photos." },
                  { title: "GIS Monitoring", desc: "Map, track, and visualize reforestation site status and ecological progress." },
                  { title: "Community Programs", desc: "Manage Public Tree Planting Program registration and reporting." },
                  { title: "Audit & Compliance", desc: "Maintain immutable, versioned records for accountability." },
                ].map((item, i) => (
                  <div key={i} className="rounded-lg p-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                    <div className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{item.title}</div>
                    <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 5 */}
            <div id="section-5" ref={setSectionRef("section-5")} className="plate">
              <span className="eyebrow">Section 5</span>
              <h2 className="section-title">How Data is Used and Processed</h2>
              <ul className="space-y-3 ml-1">
                {[
                  { title: "Collection", desc: "Data is gathered through the web platform, mobile field application, and community registration portal." },
                  { title: "Storage", desc: "All data is stored in a PostgreSQL 13+ database deployed on Ormoc City LGU infrastructure." },
                  { title: "Processing", desc: "Data is accessed by authorized personnel based on assigned roles. GIS Specialists review field data alongside satellite/drone imagery." },
                  { title: "Sharing", desc: <>Personal data is shared only among authorized PLANTSCOPE users for official duties. Data is <strong style={{ color: "var(--accent)" }}>NOT</strong> sold, traded, or shared with unauthorized third parties.</> },
                  { title: "Archiving & Disposal", desc: "Inactive records are managed through the Archive Data Management module. Data subject to deletion is irreversibly removed per retention schedules." },
                ].map((item, i) => (
                  <li key={i} className="flex gap-3 text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    <span style={{ color: "var(--accent)", flexShrink: 0 }}>•</span>
                    <span>
                      <strong style={{ color: "var(--text-primary)" }}>{item.title}:</strong>{" "}
                      {item.desc}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* SECTION 6 */}
            <div id="section-6" ref={setSectionRef("section-6")} className="plate">
              <span className="eyebrow">Section 6</span>
              <h2 className="section-title">Data Retention Period</h2>
              <div className="mt-6 border-t border-[var(--border)]">
                {[
                  { type: "User Account Data (LGU Staff)", period: "Employment + 5 years" },
                  { type: "User Account Data (Community Users)", period: "Active participation + 2 years" },
                  { type: "Field Assessment Records", period: "Minimum 10 years" },
                  { type: "Finalized Site Records (site_data)", period: "Permanent or until superseded" },
                  { type: "Audit Trail & Version History", period: "Permanent" },
                  { type: "GPS Coordinates & Geotagged Photos", period: "Monitoring program + 5 years" },
                  { type: "Community Program Records", period: "Program duration + 5 years" },
                  { type: "System & Session Logs", period: "1 year from record date" },
                ].map((row, i) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-4 border-b border-[var(--border)]">
                    <span className="text-sm" style={{ color: "var(--text-primary)" }}>{row.type}</span>
                    <span className="text-sm font-semibold" style={{ color: "var(--accent)", fontFamily: "'IBM Plex Mono', monospace" }}>
                      {row.period}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-sm mt-6" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
                After the applicable retention period, personal data shall be securely disposed
                of through data erasure or other methods ensuring data cannot be reconstructed.
              </p>
            </div>

            {/* SECTION 7 */}
            <div id="section-7" ref={setSectionRef("section-7")} className="plate">
              <span className="eyebrow">Section 7</span>
              <h2 className="section-title">Security Measures</h2>
              <p className="text-[var(--text-secondary)] leading-relaxed mb-6">
                PLANTSCOPE implements appropriate organizational, technical, and physical security
                measures in accordance with Section 20 of RA 10173 and NPC Circular No. 16-01.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl p-5" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Lock size={18} color="var(--accent)" />
                    <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>7.1 Technical Security Measures</h3>
                  </div>
                  <ul className="space-y-2 ml-1">
                    {[
                      "Password hashing & encryption using industry-standard cryptographic methods; TLS/SSL for data in transit",
                      "Role-Based Access Control (RBAC) with minimum necessary permissions per role",
                      "Token-based authentication with session expiration and automatic logout",
                      "Audit trails with timestamps; finalized site_data records are versioned and immutable",
                    ].map((item, i) => (
                      <li key={i} className="flex gap-2 text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                        <span style={{ color: "var(--accent)", flexShrink: 0 }}>•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl p-5" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 size={18} color="var(--accent)" />
                    <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>7.2 Organizational Security Measures</h3>
                  </div>
                  <ul className="space-y-2 ml-1">
                    {[
                      "Access limited to authorized LGU personnel and registered users",
                      "Data minimization: only necessary data collected; optional fields clearly indicated",
                      "Privacy by Design: data protection principles integrated from earliest development stages",
                    ].map((item, i) => (
                      <li key={i} className="flex gap-2 text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                        <span style={{ color: "var(--accent)", flexShrink: 0 }}>•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* SECTION 8 */}
            <div id="section-8" ref={setSectionRef("section-8")} className="plate">
              <span className="eyebrow">Section 8</span>
              <h2 className="section-title">Rights of Data Subjects</h2>
              <p className="text-[var(--text-secondary)] leading-relaxed mb-6">
                In accordance with Chapter IV of RA 10173, all users are entitled to the following rights:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { title: "Right to be Informed", desc: "You have the right to know whether your personal data is being processed. This Notice fulfills that right." },
                  { title: "Right to Access", desc: "Request access to your personal data held by PLANTSCOPE, including copies and usage details." },
                  { title: "Right to Correction", desc: "Dispute inaccuracies and have them corrected without unreasonable delay." },
                  { title: "Right to Erasure or Blocking", desc: "Request deletion/blocking when data is incomplete, outdated, false, or unnecessary (subject to legal retention requirements)." },
                  { title: "Right to Object", desc: "Object to processing in certain circumstances via written submission." },
                  { title: "Right to Data Portability", desc: "Obtain your data in a structured, machine-readable format where technically feasible." },
                  { title: "Right to Lodge a Complaint", desc: "File a complaint with the National Privacy Commission (NPC) if you believe your rights under RA 10173 have been violated." },
                ].map((right, i) => (
                  <div key={i} className="rounded-lg p-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                    <div className="text-sm font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>{right.title}</div>
                    <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>{right.desc}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm mt-6" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
                Requests will be acknowledged within five (5) business days and acted upon
                within thirty (30) days.
              </p>
            </div>

            {/* SECTION 9 */}
            <div id="section-9" ref={setSectionRef("section-9")} className="plate">
              <span className="eyebrow">Section 9</span>
              <h2 className="section-title">Contact Information</h2>
              <p className="text-[var(--text-secondary)] leading-relaxed mb-6">
                For any questions, concerns, or requests regarding your personal data, please contact:
              </p>
              <div className="space-y-3">
                <div className="contact-info-item">
                  <div className="icon-wrap"><Shield size={18} color="#fff" /></div>
                  <div>
                    <h4 className="font-semibold text-sm mb-0.5" style={{ color: "var(--text-primary)" }}>
                      PRIMARY: PLANTSCOPE Data Manager
                    </h4>
                    <p className="text-sm" style={{ color: "var(--text-primary)" }}>System Administrator</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                      City Environment and Natural Resources Office (City ENRO), Ormoc City LGU
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--accent)" }}>system.admin@plantscope.gov.ph</p>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Phone: +63-XXX-XXX-XXXX</p>
                  </div>
                </div>
                <div className="contact-info-item">
                  <div className="icon-wrap"><Building2 size={18} color="#fff" /></div>
                  <div>
                    <h4 className="font-semibold text-sm mb-0.5" style={{ color: "var(--text-primary)" }}>
                      SECONDARY: Ormoc City LGU DPO
                    </h4>
                    <p className="text-sm" style={{ color: "var(--text-primary)" }}>Data Protection Officer</p>
                    <p className="text-xs mt-1" style={{ color: "var(--accent)" }}>dpo@ormoccity.gov.ph</p>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Ormoc City Hall, A. Bonifacio St., Ormoc City
                    </p>
                  </div>
                </div>
                <div className="contact-info-item">
                  <div className="icon-wrap"><FileText size={18} color="#fff" /></div>
                  <div>
                    <h4 className="font-semibold text-sm mb-0.5" style={{ color: "var(--text-primary)" }}>
                      REGULATORY: National Privacy Commission
                    </h4>
                    <p className="text-sm" style={{ color: "var(--text-primary)" }}>NPC</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                      3F Core G Building, GSIS Complex, Roxas Blvd., Pasay City
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--accent)" }}>info@privacy.gov.ph</p>
                    <p className="text-xs" style={{ color: "var(--accent)" }}>www.privacy.gov.ph</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ACKNOWLEDGMENT */}
            <div className="dark-plate" style={{ padding: "2rem", borderRadius: "var(--radius)", textAlign: "center" }}>
              <div className="eyebrow" style={{ color: "#8FE07C" }}>Acknowledgment</div>
              <h3
                className="mt-3 mb-3"
                style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "1.25rem", fontWeight: 600, color: "#000000" }}
              >
                By accessing or using PLANTSCOPE, you confirm that you have read, understood,
                and agreed to this Data Privacy Notice.
              </h3>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
                PLANTSCOPE | Western Leyte College of Ormoc City | College of ICT and
                Engineering | RA 10173 Compliant
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ FOOTER — homepage theme (near-black, white headings) ═══ */}
      <footer className="site-footer py-12" style={{ borderTop: "1px solid rgba(255,255,255,.1)" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-lg mb-3" style={{ color: "#fff" }}>PlantScope</h3>
              <p className="text-white/70 text-xs leading-relaxed">
                A GIS-Based Site Suitability Assessment and Reforestation Monitoring System
                with Geospatial Analytics for Ormoc City.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-sm mb-3" style={{ color: "#fff" }}>Pages</h3>
              <ul className="space-y-2 text-sm">
                <li><a onClick={() => navigate("/")} className="footer-link cursor-pointer">Home</a></li>
                <li><a onClick={() => navigate("/Login")} className="footer-link cursor-pointer">Login</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-sm mb-3" style={{ color: "#fff" }}>Legal</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="/privacy-policy" className="footer-link">Privacy Notice</a></li>
                <li><a href="/terms" className="footer-link">Terms &amp; Conditions</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-sm mb-3" style={{ color: "#fff" }}>Connect With Us</h3>
              <p className="text-white/70 text-xs mb-2"><strong>Western Leyte College of Ormoc City</strong></p>
              <p className="text-white/60 text-xs">College of ICT &amp; Engineering</p>
              <p className="text-white/60 text-xs">Ormoc City, Leyte, Philippines</p>
            </div>
          </div>
          <div className="text-center pt-6 text-xs" style={{ borderTop: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.5)" }}>
            © 2026 PlantScope – All rights reserved. | Developed with 💚 for Ormoc City
          </div>
        </div>
      </footer>
    </div>
  );
}