import { useState, useEffect, useRef } from "react";
import Navbar from "../../components/layout/nav.tsx";
import "../../global css/homePage.css";
import { useNavigate } from "react-router-dom";

export default function Terms_and_Conditions() {
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
          <section id="terms" className="terms-container">
            <div className="max-w-6xl mx-auto pt-20 pb-16 px-4">
              {/* Header */}
              <div className="text-center mb-10">
                <h1 className="text-4xl md:text-5xl font-bold text-[#7CD56A] mb-4">
                  Terms and Conditions
                </h1>
                <p className="text-white/70 text-lg">
                  Governing access, registration, and use of the PLANTSCOPE
                  System
                </p>
              </div>

              {/* Content Container */}
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 md:p-10 border border-white/10 space-y-8 text-white/80 leading-relaxed">
                {/* PREAMBLE */}
                <div className="space-y-4">
                  <h2 className="text-xl md:text-2xl font-bold text-[#7CD56A]">
                    PREAMBLE
                  </h2>
                  <p>
                    These Terms and Conditions govern the access, registration,
                    and use of{" "}
                    <strong className="text-white">PLANTSCOPE</strong> — a
                    GIS-Based Site Suitability Assessment and Reforestation
                    Monitoring System developed by students of the{" "}
                    <strong className="text-white">
                      College of ICT and Engineering, Western Leyte College of
                      Ormoc City
                    </strong>
                    , in collaboration with the{" "}
                    <strong className="text-white">City ENRO</strong> and{" "}
                    <strong className="text-white">CPDO</strong> of Ormoc City.
                  </p>
                  <div className="bg-red-500/10 border-l-4 border-red-500 pl-4 py-3 rounded-r-lg">
                    <p className="text-white/90 font-medium">
                      ⚠️ IMPORTANT – PLEASE READ CAREFULLY
                    </p>
                    <p className="text-white/70 text-sm mt-1">
                      By registering an account, logging in, or otherwise
                      accessing PLANTSCOPE, you acknowledge that you have read,
                      understood, and agree to be legally bound by these Terms
                      and Conditions in their entirety. If you do not agree, you
                      must immediately discontinue use and request account
                      deactivation from the Data Manager.
                    </p>
                  </div>
                </div>

                {/* SECTION 1 */}
                <div className="space-y-4">
                  <h2 className="text-xl md:text-2xl font-bold text-[#7CD56A]">
                    SECTION 1: SCOPE AND PURPOSE OF SYSTEM USE
                  </h2>

                  <div className="space-y-3">
                    <h3 className="font-semibold text-white">1.1 Scope</h3>
                    <p className="text-white/70 text-sm">
                      These Terms and Conditions apply to all individuals who
                      access, register, or use PLANTSCOPE in any capacity,
                      including:
                    </p>
                    <ul className="list-disc list-inside text-white/70 text-sm space-y-1 ml-2">
                      <li>
                        <strong className="text-white">
                          City ENRO Head (The Head)
                        </strong>{" "}
                        — primary authority for reforestation program oversight
                        and LGU staff account authorization and audit trails
                      </li>
                      <li>
                        <strong className="text-white">
                          Data Manager (System Administrator)
                        </strong>{" "}
                        — maintains technical and data integrity, oversees
                        archive management
                      </li>
                      <li>
                        <strong className="text-white">GIS Specialists</strong>{" "}
                        — perform technical site suitability validation and
                        manage spatial data
                      </li>
                      <li>
                        <strong className="text-white">
                          Onsite Inspectors
                        </strong>{" "}
                        — collect and submit field assessment data through the
                        mobile application
                      </li>
                      <li>
                        <strong className="text-white">
                          Community Users (Tree Growers)
                        </strong>{" "}
                        — register for the Public Tree Planting Program and
                        submit planting progress updates
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-3 mt-4">
                    <h3 className="font-semibold text-white">1.2 Purpose</h3>
                    <p className="text-white/70 text-sm">
                      PLANTSCOPE is designed exclusively to support the
                      following government functions of Ormoc City:
                    </p>
                    <div className="grid md:grid-cols-2 gap-3 text-sm">
                      <div className="bg-white/5 p-3 rounded">
                        <strong className="text-white">
                          Reforestation Site Assessment
                        </strong>
                        <p className="text-white/60 text-xs mt-1">
                          Identify, evaluate, and validate suitable tree
                          planting locations through NDVI pre-screening and
                          MCDA.
                        </p>
                      </div>
                      <div className="bg-white/5 p-3 rounded">
                        <strong className="text-white">
                          Field Data Collection
                        </strong>
                        <p className="text-white/60 text-xs mt-1">
                          Enable Onsite Inspectors to collect structured field
                          observations, safety indicators, soil data, GPS
                          coordinates, and geotagged photographs via the mobile
                          application.
                        </p>
                      </div>
                      <div className="bg-white/5 p-3 rounded">
                        <strong className="text-white">
                          Reforestation Monitoring
                        </strong>
                        <p className="text-white/60 text-xs mt-1">
                          Track post-planting progress, tree survival rates, and
                          maintenance activities for validated reforestation
                          sites.
                        </p>
                      </div>
                      <div className="bg-white/5 p-3 rounded">
                        <strong className="text-white">
                          Community Engagement
                        </strong>
                        <p className="text-white/60 text-xs mt-1">
                          Facilitate participation of schools, organizations,
                          and groups in the Public Tree Planting Program.
                        </p>
                      </div>
                      <div className="bg-white/5 p-3 rounded">
                        <strong className="text-white">
                          Archive Data Management
                        </strong>
                        <p className="text-white/60 text-xs mt-1">
                          Oversee storage, restoration, and permanent deletion
                          of records in accordance with government retention
                          policies.
                        </p>
                      </div>
                      <div className="bg-white/5 p-3 rounded">
                        <strong className="text-white">
                          Compliance & Audit
                        </strong>
                        <p className="text-white/60 text-xs mt-1">
                          Maintain immutable audit trails and versioned
                          site_data records for accountability and
                          evidence-based environmental governance.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mt-4">
                    <h3 className="font-semibold text-white">
                      1.3 Non-Commercial Use
                    </h3>
                    <p className="text-white/70 text-sm">
                      PLANTSCOPE is a non-commercial, government-deployed
                      environmental management system developed as an academic
                      capstone project. It shall not be used for commercial
                      gain, private business operations, or activities outside
                      the environmental mandate of the Ormoc City LGU.
                    </p>
                  </div>
                </div>

                {/* SECTION 2 */}
                <div className="space-y-4">
                  <h2 className="text-xl md:text-2xl font-bold text-[#7CD56A]">
                    SECTION 2: USER RESPONSIBILITIES AND ACCEPTABLE USE
                  </h2>

                  <div className="space-y-3">
                    <h3 className="font-semibold text-white">
                      2.1 General Responsibilities of All Users
                    </h3>
                    <p className="text-white/70 text-sm">
                      All registered users of PLANTSCOPE, regardless of role,
                      are responsible for the following:
                    </p>
                    <ul className="list-disc list-inside text-white/70 text-sm space-y-1 ml-2">
                      <li>
                        <strong className="text-white">
                          Account Security:
                        </strong>{" "}
                        Users are solely responsible for maintaining the
                        confidentiality of their login credentials. Unauthorized
                        use of a user account must be reported immediately to
                        the Data Manager.
                      </li>
                      <li>
                        <strong className="text-white">
                          Accuracy of Information:
                        </strong>{" "}
                        All data, records, and submissions must be accurate,
                        truthful, and complete. Submission of false, fabricated,
                        or misleading information is strictly prohibited.
                      </li>
                      <li>
                        <strong className="text-white">Role Compliance:</strong>{" "}
                        Users must access and use only the features and data
                        authorized for their assigned role.
                      </li>
                      <li>
                        <strong className="text-white">
                          System Integrity:
                        </strong>{" "}
                        Users must not perform any action that compromises the
                        integrity, availability, or security of the PLANTSCOPE
                        system.
                      </li>
                      <li>
                        <strong className="text-white">
                          Compliance with Laws:
                        </strong>{" "}
                        Users must comply with all applicable Philippine laws,
                        including RA 10173, RA 7160, environmental protection
                        laws, and civil service regulations.
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-3 mt-4">
                    <h3 className="font-semibold text-white">
                      2.2 Role-Specific Responsibilities
                    </h3>

                    <div className="space-y-3 text-sm">
                      <div className="bg-white/5 p-4 rounded-lg border-l-4 border-[#7CD56A]">
                        <strong className="text-white">
                          City ENRO Head (The Head)
                        </strong>
                        <ul className="list-disc list-inside text-white/70 mt-2 space-y-1">
                          <li>
                            Acts as the primary authority for the reforestation
                            program and system oversight
                          </li>
                          <li>
                            Authorizes the creation of LGU staff accounts for
                            the system
                          </li>
                          <li>
                            Reviews high-level descriptive analytics reports on
                            program performance and site status
                          </li>
                          <li>
                            Serves as a primary contact for legal and privacy
                            concerns related to the system
                          </li>
                          <li>
                            Ensures that system operations remain aligned with
                            the environmental mandate of the Ormoc City LGU
                          </li>
                        </ul>
                      </div>

                      <div className="bg-white/5 p-4 rounded-lg border-l-4 border-[#7CD56A]">
                        <strong className="text-white">
                          Data Manager (System Administrator)
                        </strong>
                        <ul className="list-disc list-inside text-white/70 mt-2 space-y-1">
                          <li>
                            Maintains technical and data integrity consistent
                            throughout the system cycle
                          </li>
                          <li>
                            Oversees Archive Data Management — ensuring records
                            are stored or disposed of according to government
                            retention policies
                          </li>
                          <li>
                            Serves as the primary system contact for data
                            privacy concerns, security incidents, and technical
                            issues
                          </li>
                        </ul>
                      </div>

                      <div className="bg-white/5 p-4 rounded-lg border-l-4 border-[#7CD56A]">
                        <strong className="text-white">GIS Specialist</strong>
                        <ul className="list-disc list-inside text-white/70 mt-2 space-y-1">
                          <li>
                            Reviews all inspector-submitted
                            field_assessment_data with professional objectivity
                            before finalizing site records
                          </li>
                          <li>
                            Performs MCDA validation decisions (ACCEPT / REJECT
                            / ACCEPT_WITH_CONDITIONS) only after thorough
                            evaluation
                          </li>
                          <li>
                            Provides accurate justification notes for every
                            validation decision to preserve the integrity of the
                            audit trail
                          </li>
                          <li>
                            Ensures that finalized site_data records are
                            complete and correct before setting is_current =
                            true
                          </li>
                          <li>
                            Treats all site data, spatial records, and related
                            information as confidential government information
                          </li>
                          <li>
                            Ensures assignments to Onsite Inspectors are made
                            only to authorized and properly registered
                            inspectors
                          </li>
                        </ul>
                      </div>

                      <div className="bg-white/5 p-4 rounded-lg border-l-4 border-[#7CD56A]">
                        <strong className="text-white">
                          Onsite Inspector (Mobile Application)
                        </strong>
                        <ul className="list-disc list-inside text-white/70 mt-2 space-y-1">
                          <li>
                            Submits field assessment data based on direct,
                            first-hand observation at the assigned site
                          </li>
                          <li>
                            Do not fabricate, estimate without basis, or copy
                            data from other submissions
                          </li>
                          <li>
                            Ensures that geotagged photographs are taken at the
                            actual field site
                          </li>
                          <li>
                            GPS coordinates, when submitted, must reflect the
                            actual location of the assessment site
                          </li>
                          <li>
                            Mobile devices issued for field data gathering must
                            be used solely for PLANTSCOPE-related field
                            activities
                          </li>
                          <li>
                            Reports any technical issues with the mobile
                            application or data synchronization to the Data
                            Manager promptly
                          </li>
                          <li>
                            Must only conduct field assessments at the specific
                            site they have been officially assigned to
                          </li>
                        </ul>
                      </div>

                      <div className="bg-white/5 p-4 rounded-lg border-l-4 border-[#7CD56A]">
                        <strong className="text-white">
                          Community User / Tree Grower
                        </strong>
                        <ul className="list-disc list-inside text-white/70 mt-2 space-y-1">
                          <li>
                            Provides accurate registration information including
                            full name, contact details, and organizational
                            affiliation
                          </li>
                          <li>
                            Submits genuine and timely progress updates for
                            assigned tree planting sites
                          </li>
                          <li>
                            Complies with the assigned schedule and site
                            allocation provided by the Data Manager
                          </li>
                          <li>
                            Notifies the Data Manager of any change in contact
                            information or organizational status
                          </li>
                          <li>
                            Responsible for ensuring that participants they
                            represent are aware of these Terms and Conditions
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 3 */}
                <div className="space-y-4">
                  <h2 className="text-xl md:text-2xl font-bold text-[#7CD56A]">
                    SECTION 3: PROHIBITED ACTIVITIES
                  </h2>
                  <p className="text-white/70 text-sm">
                    The following activities are strictly prohibited on
                    PLANTSCOPE. Violation may result in immediate account
                    suspension, referral to appropriate authorities, and legal
                    action under applicable Philippine laws.
                  </p>

                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div className="bg-red-500/10 p-3 rounded border border-red-500/30">
                      <strong className="text-white">
                        01. Unauthorized Access
                      </strong>
                      <p className="text-white/70 text-xs mt-1">
                        Accessing, attempting to access, or gaining entry to any
                        account, data record, GIS layer, or system feature not
                        authorized for your assigned role.
                      </p>
                    </div>
                    <div className="bg-red-500/10 p-3 rounded border border-red-500/30">
                      <strong className="text-white">
                        02. Credential Sharing & Impersonation
                      </strong>
                      <p className="text-white/70 text-xs mt-1">
                        Sharing or transferring your login credentials to any
                        other person. Logging into the system using another
                        user's credentials.
                      </p>
                    </div>
                    <div className="bg-red-500/10 p-3 rounded border border-red-500/30">
                      <strong className="text-white">
                        03. Submission of False Data
                      </strong>
                      <p className="text-white/70 text-xs mt-1">
                        Entering or submitting data that is knowingly false,
                        fabricated, or deliberately misleading — including
                        falsified field observations, fake GPS coordinates, or
                        manipulated photographs.
                      </p>
                    </div>
                    <div className="bg-red-500/10 p-3 rounded border border-red-500/30">
                      <strong className="text-white">
                        04. Unauthorized Data Extraction
                      </strong>
                      <p className="text-white/70 text-xs mt-1">
                        Copying, exporting, or transmitting personal data,
                        spatial records, or government maps to unauthorized
                        individuals or external platforms.
                      </p>
                    </div>
                    <div className="bg-red-500/10 p-3 rounded border border-red-500/30">
                      <strong className="text-white">
                        05. System Tampering
                      </strong>
                      <p className="text-white/70 text-xs mt-1">
                        Introducing malicious code, performing denial-of-service
                        attacks, SQL injection, or any form of technical
                        interference that disrupts the system.
                      </p>
                    </div>
                    <div className="bg-red-500/10 p-3 rounded border border-red-500/30">
                      <strong className="text-white">
                        06. Unauthorized Modification/Deletion
                      </strong>
                      <p className="text-white/70 text-xs mt-1">
                        Modifying, overwriting, or deleting any system record
                        without proper authority. The Data Manager may only
                        archive or delete records per approved retention
                        policies.
                      </p>
                    </div>
                    <div className="bg-red-500/10 p-3 rounded border border-red-500/30">
                      <strong className="text-white">
                        07. Misuse of Personal Data
                      </strong>
                      <p className="text-white/70 text-xs mt-1">
                        Using personal data accessed through PLANTSCOPE for any
                        purpose other than those explicitly stated in these
                        Terms and the Data Privacy Notice.
                      </p>
                    </div>
                    <div className="bg-red-500/10 p-3 rounded border border-red-500/30">
                      <strong className="text-white">
                        08. Use Outside Authorized Scope
                      </strong>
                      <p className="text-white/70 text-xs mt-1">
                        Using PLANTSCOPE for activities beyond its stated
                        environmental management and reforestation functions.
                      </p>
                    </div>
                  </div>

                  <div className="bg-red-500/10 border border-red-500 p-4 rounded-lg mt-4">
                    <p className="text-white font-medium">⚖️ Legal Warning</p>
                    <p className="text-white/70 text-sm mt-1">
                      Violations may constitute criminal offenses under RA 10173
                      (Data Privacy Act), RA 10175 (Cybercrime Prevention Act),
                      RA 3019 (Anti-Graft), and other applicable Philippine
                      laws. The Ormoc City LGU reserves the right to refer
                      violations to the National Privacy Commission, law
                      enforcement, or other competent bodies.
                    </p>
                  </div>
                </div>

                {/* SECTION 4 */}
                <div className="space-y-4">
                  <h2 className="text-xl md:text-2xl font-bold text-[#7CD56A]">
                    SECTION 4: DATA OWNERSHIP AND HANDLING RESPONSIBILITIES
                  </h2>

                  <div className="space-y-3">
                    <h3 className="font-semibold text-white">
                      4.1 Ownership of System Data
                    </h3>
                    <p className="text-white/70 text-sm">
                      All data submitted to, processed by, or generated within
                      PLANTSCOPE is the property of the{" "}
                      <strong className="text-white">
                        Ormoc City Local Government Unit
                      </strong>
                      , acting through City ENRO and CPDO. Personal data
                      submitted by individual users remains subject to the
                      rights of the data subject under RA 10173.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-semibold text-white">
                      4.2 Data Handling Responsibilities by Role
                    </h3>
                    <div className="grid md:grid-cols-2 gap-3 text-sm">
                      <div className="bg-white/5 p-3 rounded">
                        <strong className="text-white">City ENRO Head</strong>
                        <p className="text-white/60 text-xs mt-1">
                          Responsible for overall governance of user data,
                          authorization of staff account creation, and oversight
                          of system operations in compliance with RA 10173.
                        </p>
                      </div>
                      <div className="bg-white/5 p-3 rounded">
                        <strong className="text-white">Data Manager</strong>
                        <p className="text-white/60 text-xs mt-1">
                          Responsible for maintaining technical integrity of all
                          system data and overseeing Archive Data Management per
                          government retention policies.
                        </p>
                      </div>
                      <div className="bg-white/5 p-3 rounded">
                        <strong className="text-white">GIS Specialist</strong>
                        <p className="text-white/60 text-xs mt-1">
                          Responsible for accuracy and integrity of all spatial
                          data and site validation records they finalize.
                        </p>
                      </div>
                      <div className="bg-white/5 p-3 rounded">
                        <strong className="text-white">Onsite Inspector</strong>
                        <p className="text-white/60 text-xs mt-1">
                          Responsible for truthfulness and completeness of all
                          field_assessment_data submitted via the mobile
                          application.
                        </p>
                      </div>
                      <div className="bg-white/5 p-3 rounded md:col-span-2">
                        <strong className="text-white">
                          Community User (Tree Grower)
                        </strong>
                        <p className="text-white/60 text-xs mt-1">
                          Responsible for accuracy of registration details and
                          progress reports submitted to the system. Must report
                          any errors promptly to the Data Manager.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold text-white">
                      4.3 Data Sharing Restrictions
                    </h3>
                    <ul className="list-disc list-inside text-white/70 text-sm space-y-1 ml-2">
                      <li>
                        Personal data shall not be disclosed to private
                        companies, commercial entities, or individuals not
                        affiliated with the system's official mandate.
                      </li>
                      <li>
                        Spatial data, GIS maps, and site records derived from
                        PLANTSCOPE shall not be published or commercialized
                        without prior written approval of the CPDO and City
                        ENRO.
                      </li>
                      <li>
                        Aggregate, de-identified data may be used for academic
                        research with LGU approval, provided that individual
                        users cannot be identified.
                      </li>
                    </ul>
                  </div>
                </div>

                {/* SECTION 5 */}
                <div className="space-y-4">
                  <h2 className="text-xl md:text-2xl font-bold text-[#7CD56A]">
                    SECTION 5: ACCOUNT MANAGEMENT AND ACCESS CONTROL
                  </h2>

                  <div className="space-y-3">
                    <h3 className="font-semibold text-white">
                      5.1 Account Registration
                    </h3>
                    <ul className="list-disc list-inside text-white/70 text-sm space-y-1 ml-2">
                      <li>
                        LGU staff accounts (Head, Data Manager, GIS Specialists,
                        Onsite Inspectors) are created by the Head.
                      </li>
                      <li>
                        Community user accounts require submission of a
                        registration request through the community portal,
                        subject to review from the Data Manager with final
                        approval by the Head.
                      </li>
                      <li>
                        Providing false registration information is grounds for
                        immediate account rejection or termination.
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-semibold text-white">
                      5.2 Account Suspension and Termination
                    </h3>
                    <p className="text-white/70 text-sm">
                      The Data Manager, upon direction from the Head, reserves
                      the right to suspend or permanently deactivate any user
                      account under the following circumstances:
                    </p>
                    <ul className="list-disc list-inside text-white/70 text-sm space-y-1 ml-2">
                      <li>
                        Violation of any provision of these Terms and Conditions
                      </li>
                      <li>Submission of false or fraudulent information</li>
                      <li>
                        Unauthorized access or security breach originating from
                        the user account
                      </li>
                      <li>
                        Separation, reassignment, or resignation of LGU
                        personnel from their relevant duties
                      </li>
                      <li>
                        Completion or withdrawal from the Public Tree Planting
                        Program (for community users)
                      </li>
                      <li>
                        Receipt of a lawful order requiring account termination
                        from a competent authority
                      </li>
                    </ul>
                  </div>
                </div>

                {/* SECTION 6 */}
                <div className="space-y-4">
                  <h2 className="text-xl md:text-2xl font-bold text-[#7CD56A]">
                    SECTION 6: LIMITATION OF LIABILITY
                  </h2>
                  <p className="text-white/70 text-sm">
                    PLANTSCOPE is an academic capstone project developed by
                    students of Western Leyte College of Ormoc City. The
                    following limitations of liability apply:
                  </p>

                  <div className="space-y-3 text-sm">
                    <div className="bg-white/5 p-4 rounded-lg">
                      <strong className="text-white">
                        6.1 No Warranty of Uninterrupted Service
                      </strong>
                      <p className="text-white/70 text-xs mt-1">
                        PLANTSCOPE is provided on an "as-is" and "as-available"
                        basis. The development team and Western Leyte College of
                        Ormoc City make no warranty that the system will operate
                        without interruption, error, or defect at all times.
                      </p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-lg">
                      <strong className="text-white">
                        6.2 No Liability for User-Submitted Data
                      </strong>
                      <p className="text-white/70 text-xs mt-1">
                        The system does not automatically verify the accuracy of
                        user-submitted data. The PLANTSCOPE development team
                        shall not be liable for decisions made based on
                        inaccurate, incomplete, or false data submitted by
                        users.
                      </p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-lg">
                      <strong className="text-white">
                        6.3 Data Manager Accountability
                      </strong>
                      <p className="text-white/70 text-xs mt-1">
                        The Data Manager bears institutional responsibility for
                        the proper administration of system records and audit
                        trails. Unauthorized manipulation of records by the Data
                        Manager constitutes a serious violation of these Terms
                        and applicable law.
                      </p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-lg">
                      <strong className="text-white">
                        6.4 LGU Operational Liability
                      </strong>
                      <p className="text-white/70 text-xs mt-1">
                        The Ormoc City LGU, acting through City ENRO and CPDO,
                        assumes operational responsibility for the deployed
                        PLANTSCOPE system and for decisions made based on its
                        outputs.
                      </p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-lg">
                      <strong className="text-white">6.5 Force Majeure</strong>
                      <p className="text-white/70 text-xs mt-1">
                        Neither the system developer nor the LGU shall be held
                        liable for any failure to perform obligations caused by
                        circumstances beyond reasonable control, including
                        natural disasters, acts of war, or government-mandated
                        system shutdowns.
                      </p>
                    </div>
                  </div>
                </div>

                {/* SECTION 7 */}
                <div className="space-y-4">
                  <h2 className="text-xl md:text-2xl font-bold text-[#7CD56A]">
                    SECTION 7: COMPLIANCE WITH RA 10173 – DATA PRIVACY ACT OF
                    2012
                  </h2>
                  <p className="text-white/70 text-sm">
                    PLANTSCOPE is designed and operated in full compliance with
                    Republic Act No. 10173 and its IRR, as enforced by the
                    National Privacy Commission (NPC) of the Philippines.
                  </p>

                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div className="bg-white/5 p-3 rounded">
                      <strong className="text-[#7CD56A]">Transparency</strong>
                      <p className="text-white/70 text-xs mt-1">
                        Users are informed of all data collection and processing
                        through the PLANTSCOPE Data Privacy Notice, issued
                        alongside these Terms.
                      </p>
                    </div>
                    <div className="bg-white/5 p-3 rounded">
                      <strong className="text-[#7CD56A]">
                        Legitimate Purpose
                      </strong>
                      <p className="text-white/70 text-xs mt-1">
                        Personal data is collected exclusively for reforestation
                        management, field monitoring, community engagement, and
                        audit functions of the Ormoc City LGU.
                      </p>
                    </div>
                    <div className="bg-white/5 p-3 rounded">
                      <strong className="text-[#7CD56A]">
                        Proportionality
                      </strong>
                      <p className="text-white/70 text-xs mt-1">
                        Only the minimum personal data necessary for each role's
                        functions is collected. GPS coordinates are optional.
                      </p>
                    </div>
                    <div className="bg-white/5 p-3 rounded">
                      <strong className="text-[#7CD56A]">Data Security</strong>
                      <p className="text-white/70 text-xs mt-1">
                        Technical and organizational security measures are
                        implemented including encryption, RBAC, and immutable
                        audit trails managed by the Data Manager.
                      </p>
                    </div>
                    <div className="bg-white/5 p-3 rounded">
                      <strong className="text-[#7CD56A]">
                        Data Subject Rights
                      </strong>
                      <p className="text-white/70 text-xs mt-1">
                        All registered users retain their rights under Chapter
                        IV of RA 10173, exercisable through the Data Manager or
                        the LGU DPO.
                      </p>
                    </div>
                    <div className="bg-white/5 p-3 rounded">
                      <strong className="text-[#7CD56A]">
                        Data Retention & Disposal
                      </strong>
                      <p className="text-white/70 text-xs mt-1">
                        Data is retained per the schedules in the PLANTSCOPE
                        Data Privacy Notice and disposed of securely by the Data
                        Manager upon expiration.
                      </p>
                    </div>
                    <div className="bg-white/5 p-3 rounded md:col-span-2">
                      <strong className="text-[#7CD56A]">
                        Breach Notification
                      </strong>
                      <p className="text-white/70 text-xs mt-1">
                        In the event of a data breach, the Data Manager and
                        Ormoc City LGU DPO shall follow NPC mandatory breach
                        notification procedures under NPC Circular No. 16-03.
                      </p>
                    </div>
                  </div>

                  <p className="text-[#7CD56A] text-sm italic mt-3">
                    These Terms and Conditions must be read in conjunction with
                    the PLANTSCOPE Data Privacy Notice. In matters of data
                    privacy, the Data Privacy Notice shall prevail.
                  </p>
                </div>

                {/* SECTION 8 */}
                <div className="space-y-4">
                  <h2 className="text-xl md:text-2xl font-bold text-[#7CD56A]">
                    SECTION 8: ACCEPTANCE OF TERMS AND CONDITIONS
                  </h2>
                  <p className="text-white/70 text-sm">
                    By accessing or using PLANTSCOPE, you expressly confirm and
                    agree to the following:
                  </p>

                  <div className="bg-[#7CD56A]/10 border border-[#7CD56A] p-4 rounded-lg space-y-2 text-sm">
                    <p className="text-white/90">
                      1. I have read, understood, and voluntarily agree to
                      comply with all provisions of these Terms and Conditions.
                    </p>
                    <p className="text-white/90">
                      2. I have read and understood the PLANTSCOPE Data Privacy
                      Notice and consent to the collection, processing, and use
                      of my personal data as described therein.
                    </p>
                    <p className="text-white/90">
                      3. I understand that continued use of PLANTSCOPE after any
                      amendment to these Terms and Conditions is effective shall
                      constitute my acceptance of the updated Terms.
                    </p>
                    <p className="text-white/90">
                      4. I understand that violation of these Terms and
                      Conditions may result in account suspension, termination,
                      and legal consequences under applicable Philippine law.
                    </p>
                    <p className="text-white/90">
                      5. I affirm that all information I provide to the system
                      is accurate, truthful, and complete, and I accept full
                      responsibility for the data I submit.
                    </p>
                    <p className="text-white/90">
                      6. I acknowledge that PLANTSCOPE is a government-deployed
                      environmental management system and commit to using it
                      exclusively for its stated purposes.
                    </p>
                  </div>
                </div>

                {/* SECTION 9 */}
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <h2 className="text-xl md:text-2xl font-bold text-[#7CD56A]">
                    SECTION 9: GOVERNING LAW AND JURISDICTION
                  </h2>
                  <p className="text-white/70 text-sm">
                    These Terms and Conditions shall be governed by the laws of
                    the Republic of the Philippines, including RA 10173, RA
                    10175, RA 7160, RA 3019, and NPC Circulars. Any dispute
                    shall be subject to the jurisdiction of the appropriate
                    government agencies and courts, with venue in{" "}
                    <strong className="text-white">Ormoc City, Leyte</strong>.
                  </p>
                </div>

                {/* DOCUMENT FOOTER */}
                <div className="bg-[#7CD56A]/10 border border-[#7CD56A] p-4 rounded-lg text-center">
                  <p className="text-white/90 font-medium">
                    TERMS AND CONDITIONS – END OF DOCUMENT
                  </p>
                  <p className="text-white/70 text-sm mt-1">
                    This document is to be read together with the PLANTSCOPE
                    Data Privacy Notice.
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
