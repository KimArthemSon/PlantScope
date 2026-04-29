import { useState, useEffect, useRef } from "react";
import Navbar from "../../components/layout/nav.tsx";
import "../../global css/homePage.css";
import { useNavigate } from "react-router-dom";

export default function Privacy_policy() {
  const [menuActive, setMenuActive] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const loaderRef = useRef<HTMLDivElement>(null);

  const toggleMobileMenu = () => setMenuActive((prev) => !prev);
  const closeMobileMenu = () => setMenuActive(false);
  const navigate = useNavigate();

  // Preloader animation
  const checkIfStillLogin = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      return;
    }
    try {
      const response = await fetch("http://127.0.0.1:8000/api/get_me/", {
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
  }, []);

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

  // Active button during scroll
  useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll("section");
      let current = "";

      sections.forEach((sec) => {
        const top = sec.offsetTop;
        if (window.scrollY >= top - 100) {
          if (window.scrollY === 0) {
            current = sections[0].id;
          } else if (sec.id === "home") {
            current = sections[1].id;
          } else if (sec.id === "about") {
            current = sections[2].id;
          } else if (sec.id === "service") {
            current = sections[3].id;
          } else if (sec.id === "team") {
            current = sections[4].id;
          } else if (sec.id === "Contact") {
            current = sections[5].id;
          }
        }
      });

      setActiveSection(current || "home");
    };
    setActiveSection("home");
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen">
      <div className="min-h-screen bg-[#0F4A2F] text-white homeContainer">
        {/* Navbar */}
        <Navbar
          menuActive={menuActive}
          toggleMobileMenu={toggleMobileMenu}
          closeMobileMenu={closeMobileMenu}
          activeSection={activeSection}
        />

        <main>
          <section id="privacy" className="privacy-container">
            <div className="max-w-6xl mx-auto pt-20 pb-16 px-4">
              {/* Header */}
              <div className="text-center mb-10">
                <h1 className="text-4xl md:text-5xl font-bold text-[#7CD56A] mb-4">
                  Data Privacy Notice
                </h1>
                <p className="text-white/70 text-lg">
                  Issued pursuant to Republic Act No. 10173 (Data Privacy Act of
                  2012)
                </p>
              </div>

              {/* Content Container */}
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 md:p-10 border border-white/10 space-y-8 text-white/80 leading-relaxed">
                {/* PREAMBLE */}
                <div className="space-y-4">
                  <h2 className="text-xl md:text-2xl font-bold text-[#7CD56A] mb-3">
                    PREAMBLE
                  </h2>
                  <p>
                    <strong className="text-white">PLANTSCOPE</strong> is a
                    GIS-based reforestation monitoring and site suitability
                    assessment platform developed by students of the{" "}
                    <strong className="text-white">
                      College of ICT and Engineering, Western Leyte College of
                      Ormoc City
                    </strong>
                    , in collaboration with the{" "}
                    <strong className="text-white">
                      City Environment and Natural Resources Office (City ENRO)
                    </strong>{" "}
                    and the{" "}
                    <strong className="text-white">
                      City Planning and Development Office (CPDO)
                    </strong>{" "}
                    of Ormoc City.
                  </p>
                  <p>
                    This Data Privacy Notice is issued pursuant to{" "}
                    <strong className="text-white">
                      Republic Act No. 10173
                    </strong>
                    , known as the{" "}
                    <strong className="text-white">
                      Data Privacy Act of 2012 (DPA)
                    </strong>
                    , and its Implementing Rules and Regulations (IRR). It
                    explains how PLANTSCOPE collects, uses, stores, protects,
                    and disposes of personal data from its users, and informs
                    all data subjects of their rights under Philippine law.
                  </p>
                  <div className="bg-[#7CD56A]/10 border-l-4 border-[#7CD56A] pl-4 py-3 rounded-r-lg">
                    <p className="text-white/90 italic">
                      By registering an account or accessing any feature of
                      PLANTSCOPE, users acknowledge that they have read and
                      understood this notice.
                    </p>
                  </div>
                </div>

                {/* SECTION 1 */}
                <div className="space-y-4">
                  <h2 className="text-xl md:text-2xl font-bold text-[#7CD56A]">
                    SECTION 1: PERSONAL INFORMATION CONTROLLER
                  </h2>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong className="text-white">Entity:</strong> City
                      Environment and Natural Resources Office (City ENRO),
                      Ormoc City LGU, in coordination with the College of ICT
                      and Engineering, Western Leyte College of Ormoc City
                    </div>
                    <div>
                      <strong className="text-white">Address:</strong> A.
                      Bonifacio St., Ormoc City, Leyte, Philippines
                    </div>
                    <div>
                      <strong className="text-white">DPO / Contact:</strong>{" "}
                      Designated Data Protection Officer (DPO) of Ormoc City LGU
                      or the PLANTSCOPE Data Manager (System Administrator)
                    </div>
                    <div>
                      <strong className="text-white">Email:</strong>{" "}
                      system.admin@plantscope.gov.ph{" "}
                      <span className="text-white/50">
                        (to be assigned upon deployment)
                      </span>
                    </div>
                    <div>
                      <strong className="text-white">Phone:</strong>{" "}
                      +63-XXX-XXX-XXXX{" "}
                      <span className="text-white/50">
                        (to be assigned upon deployment)
                      </span>
                    </div>
                  </div>
                </div>

                {/* SECTION 2 */}
                <div className="space-y-4">
                  <h2 className="text-xl md:text-2xl font-bold text-[#7CD56A]">
                    SECTION 2: PERSONAL DATA COLLECTED
                  </h2>
                  <p className="text-white/70">
                    PLANTSCOPE collects the following categories of personal
                    data from its registered users, depending on their assigned
                    system role:
                  </p>

                  <div className="space-y-3 ml-2">
                    <div>
                      <h3 className="font-semibold text-white">
                        2.1 City ENRO Head
                      </h3>
                      <ul className="list-disc list-inside text-white/70 text-sm space-y-1">
                        <li>
                          Full name, official email address, contact number
                        </li>
                        <li>Gender, birthday, address</li>
                        <li>Username and encrypted password</li>
                        <li>
                          Login timestamps, session logs, and audit trail
                          records
                        </li>
                        <li>
                          High-level actions performed within the system
                          (approvals, staff account authorization)
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">
                        2.2 Data Manager (System Administrator)
                      </h3>
                      <ul className="list-disc list-inside text-white/70 text-sm space-y-1">
                        <li>
                          Full name, official email address, contact number
                        </li>
                        <li>Username and encrypted password</li>
                        <li>Gender, birthday, address</li>
                        <li>Session logs and immutable audit trail records</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">
                        2.3 GIS Specialist
                      </h3>
                      <ul className="list-disc list-inside text-white/70 text-sm space-y-1">
                        <li>
                          Full name, official email address, contact number
                        </li>
                        <li>Username and encrypted password</li>
                        <li>Gender, birthday, address</li>
                        <li>
                          Records of Onsite Inspector assignments (identity,
                          target site, date)
                        </li>
                        <li>
                          Audit trail logs of finalized site_data records with
                          version history
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">
                        2.4 Onsite Inspector (Mobile Application Users)
                      </h3>
                      <ul className="list-disc list-inside text-white/70 text-sm space-y-1">
                        <li>
                          Full name, designation, assigned barangay or area
                        </li>
                        <li>Gender, birthday, address, contact details</li>
                        <li>Username and encrypted password</li>
                        <li>
                          Field assessment submissions: safety indicators,
                          boundary markers, soil data
                        </li>
                        <li>
                          GPS coordinates (optional, when voluntarily submitted)
                        </li>
                        <li>Geotagged photographs and device metadata</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">
                        2.5 Community User / Tree Growers
                      </h3>
                      <ul className="list-disc list-inside text-white/70 text-sm space-y-1">
                        <li>Full name and affiliated organization/group</li>
                        <li>Gender, birthday, address, contact details</li>
                        <li>Username and encrypted password</li>
                        <li>Registration details and program preferences</li>
                        <li>
                          Tree planting progress updates and assigned site
                          records
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* SECTION 3 */}
                <div className="space-y-4">
                  <h2 className="text-xl md:text-2xl font-bold text-[#7CD56A]">
                    SECTION 3: SENSITIVE PERSONAL INFORMATION
                  </h2>
                  <p className="text-white/70">
                    The following data may qualify as sensitive or privileged
                    under Section 3(l) of RA 10173:
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="bg-white/5 p-3 rounded-lg">
                      <strong className="text-white">
                        Precise GPS Coordinates:
                      </strong>{" "}
                      Location data tied to a person's presence at a field site
                      may reveal movement patterns or physical location of
                      government personnel.
                    </div>
                    <div className="bg-white/5 p-3 rounded-lg">
                      <strong className="text-white">
                        Geotagged Photographs:
                      </strong>{" "}
                      Photographs with embedded EXIF data contain both visual
                      and locational sensitive information.
                    </div>
                    <div className="bg-white/5 p-3 rounded-lg">
                      <strong className="text-white">
                        Community Group Affiliation:
                      </strong>{" "}
                      Affiliation with schools or civic organizations may
                      intersect with sensitive community information.
                    </div>
                  </div>
                  <p className="text-[#7CD56A] text-sm italic">
                    * GPS coordinate submission by Onsite Inspectors is optional
                    and voluntary.
                  </p>
                </div>

                {/* SECTION 4 */}
                <div className="space-y-4">
                  <h2 className="text-xl md:text-2xl font-bold text-[#7CD56A]">
                    SECTION 4: PURPOSE AND LEGAL BASIS FOR DATA PROCESSING
                  </h2>
                  <p className="text-white/70">
                    Processing is conducted on the basis of:
                  </p>
                  <ul className="list-disc list-inside text-white/70 text-sm space-y-1 ml-2">
                    <li>
                      Consent of the data subject (for community users, upon
                      registration)
                    </li>
                    <li>
                      Fulfillment of a contract or quasi-contract (for LGU
                      personnel)
                    </li>
                    <li>
                      Compliance with legal obligations (RA 10173, RA 7160,
                      environmental laws)
                    </li>
                    <li>
                      Exercise of official authority or performance of a task in
                      the public interest
                    </li>
                  </ul>

                  <div className="grid md:grid-cols-2 gap-3 text-sm mt-3">
                    <div className="bg-white/5 p-3 rounded">
                      <strong className="text-white">
                        Account Management:
                      </strong>{" "}
                      Create, maintain, and secure user accounts; enforce
                      role-based access.
                    </div>
                    <div className="bg-white/5 p-3 rounded">
                      <strong className="text-white">Site Assessment:</strong>{" "}
                      Process field observations, spatial data, and MCDA
                      validation decisions.
                    </div>
                    <div className="bg-white/5 p-3 rounded">
                      <strong className="text-white">
                        Field Data Collection:
                      </strong>{" "}
                      Enable submission of safety indicators, GPS data, and
                      geotagged photos.
                    </div>
                    <div className="bg-white/5 p-3 rounded">
                      <strong className="text-white">GIS Monitoring:</strong>{" "}
                      Map, track, and visualize reforestation site status and
                      ecological progress.
                    </div>
                    <div className="bg-white/5 p-3 rounded">
                      <strong className="text-white">
                        Community Programs:
                      </strong>{" "}
                      Manage Public Tree Planting Program registration and
                      reporting.
                    </div>
                    <div className="bg-white/5 p-3 rounded">
                      <strong className="text-white">
                        Audit & Compliance:
                      </strong>{" "}
                      Maintain immutable, versioned records for accountability.
                    </div>
                  </div>
                </div>

                {/* SECTION 5 */}
                <div className="space-y-4">
                  <h2 className="text-xl md:text-2xl font-bold text-[#7CD56A]">
                    SECTION 5: HOW DATA IS USED AND PROCESSED
                  </h2>
                  <ul className="list-disc list-inside text-white/70 text-sm space-y-2 ml-2">
                    <li>
                      <strong className="text-white">Collection:</strong> Data
                      is gathered through the web platform, mobile field
                      application, and community registration portal.
                    </li>
                    <li>
                      <strong className="text-white">Storage:</strong> All data
                      is stored in a PostgreSQL 13+ database deployed on Ormoc
                      City LGU infrastructure.
                    </li>
                    <li>
                      <strong className="text-white">Processing:</strong> Data
                      is accessed by authorized personnel based on assigned
                      roles. GIS Specialists review field data alongside
                      satellite/drone imagery.
                    </li>
                    <li>
                      <strong className="text-white">Sharing:</strong> Personal
                      data is shared only among authorized PLANTSCOPE users for
                      official duties. Data is{" "}
                      <strong className="text-[#7CD56A]">NOT</strong> sold,
                      traded, or shared with unauthorized third parties.
                    </li>
                    <li>
                      <strong className="text-white">
                        Archiving & Disposal:
                      </strong>{" "}
                      Inactive records are managed through the Archive Data
                      Management module. Data subject to deletion is
                      irreversibly removed per retention schedules.
                    </li>
                  </ul>
                </div>

                {/* SECTION 6 */}
                <div className="space-y-4">
                  <h2 className="text-xl md:text-2xl font-bold text-[#7CD56A]">
                    SECTION 6: DATA RETENTION PERIOD
                  </h2>
                  <div className="grid md:grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between border-b border-white/10 pb-1">
                      <span>User Account Data (LGU Staff)</span>
                      <span className="text-[#7CD56A]">
                        Employment + 5 years
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-white/10 pb-1">
                      <span>User Account Data (Community Users)</span>
                      <span className="text-[#7CD56A]">
                        Active participation + 2 years
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-white/10 pb-1">
                      <span>Field Assessment Records</span>
                      <span className="text-[#7CD56A]">Minimum 10 years</span>
                    </div>
                    <div className="flex justify-between border-b border-white/10 pb-1">
                      <span>Finalized Site Records (site_data)</span>
                      <span className="text-[#7CD56A]">
                        Permanent or until superseded
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-white/10 pb-1">
                      <span>Audit Trail & Version History</span>
                      <span className="text-[#7CD56A]">Permanent</span>
                    </div>
                    <div className="flex justify-between border-b border-white/10 pb-1">
                      <span>GPS Coordinates & Geotagged Photos</span>
                      <span className="text-[#7CD56A]">
                        Monitoring program + 5 years
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-white/10 pb-1">
                      <span>Community Program Records</span>
                      <span className="text-[#7CD56A]">
                        Program duration + 5 years
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-white/10 pb-1">
                      <span>System & Session Logs</span>
                      <span className="text-[#7CD56A]">
                        1 year from record date
                      </span>
                    </div>
                  </div>
                  <p className="text-white/70 text-sm">
                    After the applicable retention period, personal data shall
                    be securely disposed of through data erasure or other
                    methods ensuring data cannot be reconstructed.
                  </p>
                </div>

                {/* SECTION 7 */}
                <div className="space-y-4">
                  <h2 className="text-xl md:text-2xl font-bold text-[#7CD56A]">
                    SECTION 7: SECURITY MEASURES
                  </h2>
                  <p className="text-white/70">
                    PLANTSCOPE implements appropriate organizational, technical,
                    and physical security measures in accordance with Section 20
                    of RA 10173 and NPC Circular No. 16-01.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <h3 className="font-semibold text-white">
                        7.1 Technical Security Measures
                      </h3>
                      <ul className="list-disc list-inside text-white/70 text-sm space-y-1 ml-2">
                        <li>
                          Password hashing & encryption using industry-standard
                          cryptographic methods; TLS/SSL for data in transit
                        </li>
                        <li>
                          Role-Based Access Control (RBAC) with minimum
                          necessary permissions per role
                        </li>
                        <li>
                          Token-based authentication with session expiration and
                          automatic logout
                        </li>
                        <li>
                          Audit trails with timestamps; finalized site_data
                          records are versioned and immutable
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">
                        7.2 Organizational Security Measures
                      </h3>
                      <ul className="list-disc list-inside text-white/70 text-sm space-y-1 ml-2">
                        <li>
                          Access limited to authorized LGU personnel and
                          registered users
                        </li>
                        <li>
                          Data minimization: only necessary data collected;
                          optional fields clearly indicated
                        </li>
                        <li>
                          Privacy by Design: data protection principles
                          integrated from earliest development stages
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* SECTION 8 */}
                <div className="space-y-4">
                  <h2 className="text-xl md:text-2xl font-bold text-[#7CD56A]">
                    SECTION 8: RIGHTS OF DATA SUBJECTS
                  </h2>
                  <p className="text-white/70">
                    In accordance with Chapter IV of RA 10173, all users are
                    entitled to the following rights:
                  </p>

                  <div className="space-y-2 text-sm">
                    <div className="bg-white/5 p-3 rounded-lg">
                      <strong className="text-white">
                        Right to be Informed:
                      </strong>{" "}
                      You have the right to know whether your personal data is
                      being processed. This Notice fulfills that right.
                    </div>
                    <div className="bg-white/5 p-3 rounded-lg">
                      <strong className="text-white">Right to Access:</strong>{" "}
                      Request access to your personal data held by PLANTSCOPE,
                      including copies and usage details.
                    </div>
                    <div className="bg-white/5 p-3 rounded-lg">
                      <strong className="text-white">
                        Right to Correction:
                      </strong>{" "}
                      Dispute inaccuracies and have them corrected without
                      unreasonable delay.
                    </div>
                    <div className="bg-white/5 p-3 rounded-lg">
                      <strong className="text-white">
                        Right to Erasure or Blocking:
                      </strong>{" "}
                      Request deletion/blocking when data is incomplete,
                      outdated, false, or unnecessary (subject to legal
                      retention requirements).
                    </div>
                    <div className="bg-white/5 p-3 rounded-lg">
                      <strong className="text-white">Right to Object:</strong>{" "}
                      Object to processing in certain circumstances via written
                      submission.
                    </div>
                    <div className="bg-white/5 p-3 rounded-lg">
                      <strong className="text-white">
                        Right to Data Portability:
                      </strong>{" "}
                      Obtain your data in a structured, machine-readable format
                      where technically feasible.
                    </div>
                    <div className="bg-white/5 p-3 rounded-lg">
                      <strong className="text-white">
                        Right to Lodge a Complaint:
                      </strong>{" "}
                      File a complaint with the National Privacy Commission
                      (NPC) if you believe your rights under RA 10173 have been
                      violated.
                    </div>
                  </div>
                  <p className="text-white/70 text-sm">
                    Requests will be acknowledged within five (5) business days
                    and acted upon within thirty (30) days.
                  </p>
                </div>

                {/* SECTION 9 */}
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <h2 className="text-xl md:text-2xl font-bold text-[#7CD56A]">
                    SECTION 9: CONTACT INFORMATION
                  </h2>
                  <div className="space-y-3 text-sm">
                    <div className="bg-[#7CD56A]/10 p-4 rounded-lg">
                      <p className="text-white">
                        <strong>PRIMARY:</strong> PLANTSCOPE Data Manager
                        (System Administrator)
                      </p>
                      <p className="text-white/80">
                        City Environment and Natural Resources Office (City
                        ENRO), Ormoc City LGU
                      </p>
                      <p className="text-white/80">
                        Email:{" "}
                        <span className="text-[#7CD56A]">
                          system.admin@plantscope.gov.ph
                        </span>
                      </p>
                      <p className="text-white/80">Phone: +63-XXX-XXX-XXXX</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-lg">
                      <p className="text-white">
                        <strong>SECONDARY:</strong> Ormoc City LGU Data
                        Protection Officer (DPO)
                      </p>
                      <p className="text-white/80">
                        Email:{" "}
                        <span className="text-[#7CD56A]">
                          dpo@ormoccity.gov.ph
                        </span>
                      </p>
                      <p className="text-white/80">
                        Office: Ormoc City Hall, A. Bonifacio St., Ormoc City
                      </p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-lg">
                      <p className="text-white">
                        <strong>REGULATORY AUTHORITY:</strong> National Privacy
                        Commission (NPC)
                      </p>
                      <p className="text-white/80">
                        3F Core G Building, GSIS Complex, Roxas Blvd., Pasay
                        City
                      </p>
                      <p className="text-white/80">
                        Email:{" "}
                        <span className="text-[#7CD56A]">
                          info@privacy.gov.ph
                        </span>{" "}
                        | Website:{" "}
                        <span className="text-[#7CD56A]">
                          www.privacy.gov.ph
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* ACKNOWLEDGMENT */}
                <div className="bg-[#7CD56A]/10 border border-[#7CD56A] p-4 rounded-lg text-center">
                  <p className="text-white/90">
                    <strong>ACKNOWLEDGMENT:</strong> By accessing or using
                    PLANTSCOPE, you confirm that you have read, understood, and
                    agreed to this Data Privacy Notice.
                  </p>
                  <p className="text-white/60 text-xs mt-2">
                    PLANTSCOPE | Western Leyte College of Ormoc City | College
                    of ICT and Engineering | RA 10173 Compliant
                  </p>
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="bg-[#0F4A2F] py-12 border-t border-white/20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
              <div>
                <h3 className="font-bold text-lg mb-4 text-[#7CD56A]">
                  PlantScope
                </h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  A GIS-Based Site Suitability Assessment and Reforestation
                  Monitoring System with Geospatial Analytics for Ormoc City
                </p>
              </div>
              <div>
                <h3 className="font-bold text-lg mb-4 text-[#7CD56A]">Pages</h3>
                <ul className="space-y-2 text-white/70 text-sm">
                  <li>
                    <a
                      onClick={() => navigate("/")}
                      className="hover:text-[#7CD56A] transition-colors cursor-pointer"
                    >
                      Home
                    </a>
                  </li>
                  <li>
                    <a
                      onClick={() => navigate("/Login")}
                      className="hover:text-[#7CD56A] transition-colors cursor-pointer"
                    >
                      Login
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-lg mb-4 text-[#7CD56A]">Legal</h3>
                <ul className="space-y-2 text-white/70 text-sm">
                  <li>
                    <a
                      href="/privacy-policy"
                      className="hover:text-[#7CD56A] transition-colors"
                    >
                      Privacy Notice
                    </a>
                  </li>
                  <li>
                    <a
                      href="/terms"
                      className="hover:text-[#7CD56A] transition-colors"
                    >
                      Terms & Conditions
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-lg mb-4 text-[#7CD56A]">
                  Connect With Us
                </h3>
                <p className="text-white/70 text-sm mb-2">
                  Western Leyte College of Ormoc City
                </p>
                <p className="text-white/60 text-sm">
                  College of ICT & Engineering
                </p>
              </div>
            </div>
            <div className="text-center pt-8 border-t border-white/10">
              <p className="text-white/60 text-sm">
                © 2026 PlantScope – All rights reserved. | Developed with 💚 for
                Ormoc City
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
