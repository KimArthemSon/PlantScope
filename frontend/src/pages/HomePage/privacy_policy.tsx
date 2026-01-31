import { useState, useEffect, useRef } from "react";
import Navbar from "../../components/layout/nav.tsx";
import { useNavigate } from "react-router-dom";
export default function Privacy_policy() {
  const [menuActive, setMenuActive] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const loaderRef = useRef<HTMLDivElement>(null);

  const toggleMobileMenu = () => setMenuActive((prev) => !prev);
  const closeMobileMenu = () => setMenuActive(false);
  const navigate = useNavigate();
  // Preloader animation
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
      <div className="min-h-screen bg-[#0F4A2F] text-white">
        {/* Loader with wrapper ref — imports are unchanged */}

        {/* Navbar with correct prop names */}
        <Navbar
          menuActive={menuActive}
          toggleMobileMenu={toggleMobileMenu}
          closeMobileMenu={closeMobileMenu}
          activeSection={activeSection}
        />

        <main>
          <section id="privacy" className="privacy-container">
            <div className="max-w-6xl mx-auto pt-30 pb-16 px-4">
              {/* Header */}
              <div className="text-center mb-10">
                <h1 className="text-5xl md:text-6xl font-bold text-[#7CD56A] mb-4">
                  PlantScope Privacy Policy
                </h1>
                <p className="text-white/70 text-lg">
                  Effective Date: January 23, 2026
                </p>
              </div>

              {/* Content */}
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 md:p-12 border border-white/10 space-y-10 text-white/80 leading-relaxed">
                <p>
                  This Privacy Policy explains how the{" "}
                  <strong>PlantScope Project</strong>, managed by the{" "}
                  <strong>
                    College of ICT & Engineering at Western Leyte College of
                    Ormoc City
                  </strong>
                  , collects, uses, processes, stores, discloses, and protects
                  your personal data in compliance with the{" "}
                  <strong>
                    Philippine Data Privacy Act of 2012 (RA 10173)
                  </strong>
                  and other applicable laws.
                </p>

                {/* 1 */}
                <div>
                  <h2 className="text-2xl font-bold text-[#7CD56A] mb-3">
                    1. Information We Collect
                  </h2>

                  <h3 className="font-semibold text-white mb-2">
                    Personal Information You Provide
                  </h3>
                  <ul className="list-disc list-inside space-y-2 text-white/70 ml-2">
                    <li>
                      Full name, email address, mobile number, organization or
                      institutional affiliation
                    </li>
                    <li>
                      Username and encrypted password; optional profile details
                    </li>
                    <li>
                      Messages submitted through contact forms, surveys, or
                      support inquiries
                    </li>
                  </ul>

                  <h3 className="font-semibold text-white mt-4 mb-2">
                    Automatically Collected Data
                  </h3>
                  <ul className="list-disc list-inside space-y-2 text-white/70 ml-2">
                    <li>
                      IP address, browser type, operating system, device model
                    </li>
                    <li>
                      Pages visited, session duration, interaction patterns,
                      error logs
                    </li>
                    <li>Approximate location derived from IP address</li>
                    <li>
                      Session cookies, analytics identifiers, preference cookies
                    </li>
                  </ul>

                  <h3 className="font-semibold text-white mt-4 mb-2">
                    Environmental & GIS Data
                  </h3>
                  <ul className="list-disc list-inside space-y-2 text-white/70 ml-2">
                    <li>
                      GPS coordinates, map markers, drone imagery of
                      reforestation sites
                    </li>
                    <li>
                      Tree species, planting dates, survival metrics, soil
                      conditions
                    </li>
                  </ul>
                </div>

                {/* 2 */}
                <div>
                  <h2 className="text-2xl font-bold text-[#7CD56A] mb-3">
                    2. Purpose and Legal Basis for Processing
                  </h2>
                  <ul className="list-disc list-inside space-y-2 text-white/70 ml-2">
                    <li>
                      <strong>Consent</strong> – newsletters, optional tracking
                    </li>
                    <li>
                      <strong>Contract Performance</strong> – platform access
                      and services
                    </li>
                    <li>
                      <strong>Legal Obligation</strong> – compliance with
                      environmental and national laws
                    </li>
                    <li>
                      <strong>Legitimate Interest</strong> – security,
                      analytics, service improvement
                    </li>
                    <li>
                      <strong>Public Interest</strong> – reforestation
                      monitoring and ecological research
                    </li>
                  </ul>
                </div>

                {/* 3 */}
                <div>
                  <h2 className="text-2xl font-bold text-[#7CD56A] mb-3">
                    3. How We Use Your Data
                  </h2>
                  <ul className="list-disc list-inside space-y-2 text-white/70 ml-2">
                    <li>
                      Account access, mapping, data submission, dashboards
                    </li>
                    <li>
                      Responding to inquiries and coordinating with partners
                    </li>
                    <li>Usability improvements for LGU and academic users</li>
                    <li>Impact analysis of reforestation programs</li>
                    <li>Security monitoring and legal compliance</li>
                  </ul>
                </div>

                {/* 4 */}
                <div>
                  <h2 className="text-2xl font-bold text-[#7CD56A] mb-3">
                    4. Data Sharing and Disclosure
                  </h2>
                  <p className="text-white/70">
                    We do not sell personal data. Information may be shared only
                    with service providers, academic and government partners
                    (WLC, ENRO Ormoc, DENR, LGUs), or when legally required. All
                    sharing follows data minimization and purpose limitation.
                  </p>
                </div>

                {/* 5 */}
                <div>
                  <h2 className="text-2xl font-bold text-[#7CD56A] mb-3">
                    5. Data Retention
                  </h2>
                  <ul className="list-disc list-inside space-y-2 text-white/70 ml-2">
                    <li>
                      User accounts: deleted within 30 days of deactivation
                    </li>
                    <li>Contact records: retained for 2 years</li>
                    <li>
                      GIS data: retained for long-term environmental monitoring
                    </li>
                    <li>
                      Logs and analytics: anonymized or deleted after 90 days
                    </li>
                  </ul>
                </div>

                {/* 6 */}
                <div>
                  <h2 className="text-2xl font-bold text-[#7CD56A] mb-3">
                    6. Your Rights Under RA 10173
                  </h2>
                  <ul className="list-disc list-inside space-y-2 text-white/70 ml-2">
                    <li>Right to be informed</li>
                    <li>Right to access and correction</li>
                    <li>Right to erasure or blocking</li>
                    <li>Right to object to processing</li>
                    <li>Right to data portability</li>
                    <li>Right to lodge a complaint with the NPC</li>
                  </ul>
                </div>

                {/* 7 */}
                <div>
                  <h2 className="text-2xl font-bold text-[#7CD56A] mb-3">
                    7. Security Measures
                  </h2>
                  <ul className="list-disc list-inside space-y-2 text-white/70 ml-2">
                    <li>SSL/TLS encryption and encrypted storage</li>
                    <li>Role-based access and administrator MFA</li>
                    <li>Security audits and staff training</li>
                    <li>
                      Incident response compliant with NPC Circular No. 16-03
                    </li>
                  </ul>
                </div>

                {/* 8–11 */}
                <div>
                  <h2 className="text-2xl font-bold text-[#7CD56A] mb-3">
                    8–11. Cookies, Transfers, Children & Updates
                  </h2>
                  <p className="text-white/70">
                    PlantScope uses essential and analytics cookies, ensures
                    safeguards for international transfers, does not knowingly
                    collect data from minors, and may update this policy as laws
                    or operations change.
                  </p>
                </div>

                {/* 12 */}
                <div className="pt-6 border-t border-white/10">
                  <h2 className="text-2xl font-bold text-[#7CD56A] mb-4">
                    12. Contact Us
                  </h2>
                  <p className="text-white/70">
                    <strong>PlantScope Project Team</strong>
                    <br />
                    College of ICT & Engineering
                    <br />
                    Western Leyte College of Ormoc City
                    <br />
                    Email: plantscope@wlc.edu.ph
                  </p>

                  <p className="text-white/70 mt-4">
                    <strong>Data Protection Officer:</strong>
                    <br />
                    privacy@plantscope.ph
                  </p>

                  <p className="text-white/70 mt-4">
                    National Privacy Commission (NPC):
                    <br />
                    https://www.privacy.gov.ph
                  </p>
                </div>
              </div>
            </div>
          </section>
        </main>
        <footer className="bg-[#0F4A2F] py-12 border-t border-white/20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
              <div>
                <h3 className="font-bold text-lg mb-4 text-[#7CD56A]">
                  PlantScope
                </h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  A GIS-Based Site Suitability Assessment and Reforestation
                  Monitoring Systern with Geospatial Analytics for Ormoc City
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
                <h3 className="font-bold text-lg mb-4 text-[#7CD56A]">
                  Security
                </h3>
                <ul className="space-y-2 text-white/70 text-sm">
                  <li>
                    <a
                      href="#privacy"
                      className="hover:text-[#7CD56A] transition-colors"
                    >
                      Privacy Policy
                    </a>
                  </li>
                  <li>
                    <a
                      href="#security"
                      className="hover:text-[#7CD56A] transition-colors"
                    >
                      Security
                    </a>
                  </li>
                  <li>
                    <a
                      href="#terms"
                      className="hover:text-[#7CD56A] transition-colors"
                    >
                      Terms
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
                © 2025 PlantScope – All rights reserved. | Developed with 💚 for
                Ormoc City
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
