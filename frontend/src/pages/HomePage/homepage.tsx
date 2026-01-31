import { useState, useEffect, useRef } from "react";
import Loader from "../../components/layout/loader.tsx";
import Navbar from "../../components/layout/nav.tsx";
import background from "../../assets/background.jpg";
import logo from "../../assets/logo.png";
import "../../global css/homePage.css";
import profile1 from "../../assets/PROFILE1.jpg";
import profile2 from "../../assets/profile2.jpg";
import profile3 from "../../assets/profile3.jpg";
import profile4 from "../../assets/profile4.jpg";
import { useNavigate } from "react-router-dom";
export default function App() {
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
    <div>
      <div className="min-h-screen bg-[#0F4A2F] text-white homeContainer">
        {/* Loader with wrapper ref — imports are unchanged */}
        <div ref={loaderRef}>
          <Loader />
        </div>

        {/* Navbar with correct prop names */}
        <Navbar
          menuActive={menuActive}
          toggleMobileMenu={toggleMobileMenu}
          closeMobileMenu={closeMobileMenu}
          activeSection={activeSection}
        />

        <section id="home">
          <div className="hero-section">
            <div className="hero-bg">
              <img src={background} alt="Forest Background" />
              <div className="hero-overlay"></div>
            </div>

            <div className="hero-content">
              <div className="max-w-5xl mx-auto space-y-8">
                <div className="mb-8 fade-up">
                  <div className="logo-container">
                    <img src={logo} alt="PlantScope Logo" />
                  </div>
                </div>

                <h1 className="text-5xl md:text-3xl font-bold tracking-tight fade-up-delay">
                  PlantScope
                </h1>
                <p className="text-[#7CD56A] text-xl md:text-1xl tracking-wider fade-up-delay"></p>

                <h2 className="text-1xl md:text-1xl font-bold leading-tight max-w-4xl mx-auto fade-up-delay-2">
                  A GIS-Based Site Suitability Assessment and Reforestation
                  Monitoring System <br />
                  with Geospatial Analytics for Ormoc City
                </h2>
                <div className="flex flex-col sm:flex-row gap-6 justify-center pt-6 fade-up-delay-2">
                  <a
                    href="#service"
                    className="btn-primary text-lg font-semibold"
                  >
                    Explore Dashboard
                  </a>

                  <a
                    href="#about"
                    className="btn-secondary text-lg font-semibold"
                  >
                    Learn More
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="py-24 px-6 bg-linear-to-b from-[#0F4A2F] to-[#134F38]">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-4xl md:text-5xl font-bold mb-4">
                  Core Features
                </h2>
                <p className="text-white/70 text-lg max-w-2xl mx-auto">
                  Leveraging cutting-edge technology for environmental
                  restoration
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                <div className="card fade-up">
                  <div className="card-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7"
                      />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold mb-4 text-[#7CD56A]">
                    GIS-Powered Mapping
                  </h3>
                  <p className="text-white/80 leading-relaxed">
                    Multi-layer spatial analysis integrating elevation, slope,
                    soil type, land cover, and water sources.
                  </p>
                </div>

                <div className="card fade-up-delay">
                  <div className="card-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7"
                      />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold mb-4 text-[#7CD56A]">
                    Data-Driven Prioritization
                  </h3>
                  <p className="text-white/80 leading-relaxed">
                    Scientific scoring system based on ecological restoration
                    potential and climate resilience.
                  </p>
                </div>

                <div className="card fade-up-delay-2">
                  <div className="card-icon">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold mb-4 text-[#7CD56A]">
                    Focused on Ormoc City
                  </h3>
                  <p className="text-white/80 leading-relaxed">
                    Tailored for post-Yolanda recovery zones and degraded
                    watersheds in Leyte.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="about"
          className="min-h-screen py-32 px-6 bg-linear-to-b from-[#0F4A2F] to-[#134F38]"
        >
          <div className="max-w-5xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold text-center mb-16 text-[#7CD56A] tracking-tight">
              About PlantScope
            </h1>

            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-10 lg:p-12 border border-white/20 mb-12 shadow-2xl hover:bg-white/15 transition-all">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Project Overview
              </h2>
              <p className="text-lg leading-relaxed text-white/90 mb-6">
                <strong>PlantScope</strong> is a capstone project developed by
                students of the
                <em className="text-[#7CD56A]">
                  {" "}
                  Western Leyte College of Ormoc City – College of Information
                  Communication Technology and Engineering
                </em>
                .
              </p>
              <p className="text-lg leading-relaxed text-white/90 mb-6">
                This innovative platform combines geographic information systems
                (GIS) with data analytics to identify and prioritize
                reforestation sites in Ormoc City, contributing to ecological
                restoration and climate resilience in post-disaster areas.
              </p>
              <p className="text-lg leading-relaxed text-white/90">
                PlantScope serves as a decision-support platform that helps
                identify, evaluate, and prioritize potential reforestation sites
                based on ecological and spatial data. It enables local
                government units, environmental offices, and partner
                organizations to visualize areas most suitable for tree planting
                and restoration efforts.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-10 lg:p-12 border border-white/20 mb-12 shadow-2xl hover:bg-white/15 transition-all">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Addressing Deforestation in Ormoc City
              </h2>

              <div className="space-y-6 text-lg leading-relaxed text-white/90">
                <p>
                  Ormoc City has faced significant environmental challenges,
                  particularly after Typhoon Yolanda (Haiyan) in 2013, which
                  devastated forest cover and left watersheds vulnerable to
                  erosion, landslides, and flooding. Deforestation has been a
                  persistent issue, threatening biodiversity, water security,
                  and community resilience.
                </p>

                <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                  <h3 className="text-2xl font-bold mb-4 text-[#7CD56A]">
                    How PlantScope Helps:
                  </h3>
                  <ul className="space-y-4">
                    <li className="flex gap-3">
                      <span className="text-[#7CD56A] font-bold shrink-0">
                        •
                      </span>
                      <span>
                        <strong>Scientific Site Selection:</strong> Instead of
                        random tree planting, PlantScope uses geospatial
                        analysis to identify areas where reforestation will have
                        the greatest ecological impact and survival rate.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-[#7CD56A] font-bold shrink-0">
                        •
                      </span>
                      <span>
                        <strong>Resource Optimization:</strong> By prioritizing
                        sites based on restoration potential, limited resources
                        (seedlings, labor, funding) can be allocated more
                        effectively.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-[#7CD56A] font-bold shrink-0">
                        •
                      </span>
                      <span>
                        <strong>Watershed Protection:</strong> The system
                        identifies critical watershed areas that require urgent
                        reforestation to prevent soil erosion and protect water
                        sources.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-[#7CD56A] font-bold shrink-0">
                        •
                      </span>
                      <span>
                        <strong>Climate Resilience:</strong> PlantScope
                        evaluates sites for their capacity to withstand climate
                        impacts, helping build forests that can survive future
                        storms and disasters.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-[#7CD56A] font-bold shrink-0">
                        •
                      </span>
                      <span>
                        <strong>Transparent Planning:</strong> Interactive maps
                        and data visualization allow stakeholders to understand
                        why certain areas are prioritized, fostering community
                        buy-in and collaborative action.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-[#7CD56A] font-bold shrink-0">
                        •
                      </span>
                      <span>
                        <strong>Monitoring Progress:</strong> The platform
                        supports tracking reforestation efforts over time,
                        ensuring accountability and adaptive management.
                      </span>
                    </li>
                  </ul>
                </div>

                <p>
                  Through data-driven insights, PlantScope empowers local
                  government units, environmental organizations, and communities
                  to reverse deforestation trends and restore Ormoc's green
                  cover. The system aligns with the National Greening Program
                  (NGP) and Enhanced NGP, providing a technological backbone for
                  sustainable forest management.
                </p>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur rounded-2xl p-10 lg:p-12 border border-white/10 shadow-xl">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Our Mission
              </h2>
              <p className="text-lg leading-relaxed text-white/90 mb-8">
                To provide local government units, environmental organizations,
                and communities with scientific tools for strategic
                reforestation planning, ensuring maximum ecological impact and
                sustainable forest recovery.
              </p>

              <div className="text-center pt-8 border-t border-white/20">
                <p className="text-2xl italic text-white/90 mb-6">
                  "Restoring Ormoc's forests one data-driven decision at a
                  time."
                </p>
                <p className="text-[#7CD56A] font-semibold tracking-wide">
                  Western Leyte College of Ormoc City | Batch 2025
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          id="service"
          className="min-h-screen py-32 px-6 bg-linear-to-b from-[#0F4A2F] to-[#134F38]"
        >
          <div className="max-w-7xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold text-center mb-8 text-[#7CD56A] tracking-tight">
              Our Services
            </h1>
            <p className="text-center text-white/80 text-lg mb-16 max-w-3xl mx-auto">
              PlantScope serves as a comprehensive decision-support platform for
              data-driven reforestation management and ecological restoration
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-xl hover:bg-white/15 transition-all">
                <div className="w-16 h-16 bg-linear-to-br from-[#4BA74E] to-[#7CD56A] rounded-full flex items-center justify-center mb-6">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-[#7CD56A]">
                  Geospatial Site Analysis
                </h3>
                <p className="text-white/80 leading-relaxed mb-6">
                  Comprehensive spatial analysis integrating multiple
                  environmental factors for optimal site selection.
                </p>

                <div className="space-y-3">
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1">
                      Elevation Mapping
                    </h4>
                    <p className="text-sm text-white/70">
                      Digital elevation model analysis for terrain assessment
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1">
                      Slope Analysis
                    </h4>
                    <p className="text-sm text-white/70">
                      Gradient calculations to determine erosion risk and
                      accessibility
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1">
                      Soil Type classNameification
                    </h4>
                    <p className="text-sm text-white/70">
                      Soil composition mapping for species suitability
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1">
                      Land Cover Assessment
                    </h4>
                    <p className="text-sm text-white/70">
                      Current vegetation and land use pattern identification
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1">
                      Water Source Proximity
                    </h4>
                    <p className="text-sm text-white/70">
                      Distance analysis to rivers, streams, and watersheds
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-xl hover:bg-white/15 transition-all">
                <div className="w-16 h-16 bg-linear-to-br from-[#4BA74E] to-[#7CD56A] rounded-full flex items-center justify-center mb-6">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-[#7CD56A]">
                  Environmental Factor Mapping
                </h3>
                <p className="text-white/80 leading-relaxed mb-6">
                  Multi-layer visualization of ecological conditions crucial for
                  reforestation success.
                </p>

                <div className="space-y-3">
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1">
                      Climate Data Integration
                    </h4>
                    <p className="text-sm text-white/70">
                      Temperature, rainfall, and seasonal pattern analysis
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1">
                      Biodiversity Hotspots
                    </h4>
                    <p className="text-sm text-white/70">
                      Identification of areas with high ecological value
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1">
                      Erosion Risk Zones
                    </h4>
                    <p className="text-sm text-white/70">
                      Areas requiring urgent intervention to prevent degradation
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1">
                      Disaster-Prone Areas
                    </h4>
                    <p className="text-sm text-white/70">
                      Mapping of flood-prone and landslide-susceptible zones
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1">
                      Community Access Routes
                    </h4>
                    <p className="text-sm text-white/70">
                      Road networks and accessibility mapping for implementation
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-xl hover:bg-white/15 transition-all">
                <div className="w-16 h-16 bg-linear-to-br from-[#4BA74E] to-[#7CD56A] rounded-full flex items-center justify-center mb-6">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-[#7CD56A]">
                  Prioritization Scoring System
                </h3>
                <p className="text-white/80 leading-relaxed mb-6">
                  Scientific ranking methodology that evaluates and ranks
                  reforestation sites based on multiple criteria.
                </p>

                <div className="space-y-3">
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1">
                      Ecological Restoration Potential
                    </h4>
                    <p className="text-sm text-white/70">
                      Assessment of biodiversity recovery and ecosystem services
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1">
                      Climate Resilience Score
                    </h4>
                    <p className="text-sm text-white/70">
                      Evaluation of site's ability to withstand climate extremes
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1">
                      Strategic Importance Ranking
                    </h4>
                    <p className="text-sm text-white/70">
                      Priority based on watershed protection and community
                      impact
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1">
                      Implementation Feasibility
                    </h4>
                    <p className="text-sm text-white/70">
                      Cost-benefit analysis and accessibility considerations
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1">
                      Success Probability Index
                    </h4>
                    <p className="text-sm text-white/70">
                      Predicted seedling survival rate based on site conditions
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-xl hover:bg-white/15 transition-all">
                <div className="w-16 h-16 bg-linear-to-br from-[#4BA74E] to-[#7CD56A] rounded-full flex items-center justify-center mb-6">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-[#7CD56A]">
                  Interactive Dashboard & Visualization
                </h3>
                <p className="text-white/80 leading-relaxed mb-6">
                  User-friendly platform with advanced visualization tools for
                  efficient decision-making.
                </p>

                <div className="space-y-3">
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1">
                      Interactive Map Interface
                    </h4>
                    <p className="text-sm text-white/70">
                      Zoom, pan, and explore reforestation sites dynamically
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1">
                      Layer Toggle Controls
                    </h4>
                    <p className="text-sm text-white/70">
                      Show/hide different data layers for focused analysis
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1">
                      Data Charts & Graphs
                    </h4>
                    <p className="text-sm text-white/70">
                      Visual statistics on site characteristics and priorities
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1">
                      Report Generation
                    </h4>
                    <p className="text-sm text-white/70">
                      Export detailed reports and maps for stakeholders
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1">
                      Real-Time Updates
                    </h4>
                    <p className="text-sm text-white/70">
                      Track progress and monitor reforestation activities
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="team"
          className="min-h-screen py-32 px-6 bg-linear-to-b from-[#0F4A2F] to-[#134F38]"
        >
          <div className="max-w-7xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold text-center mb-8 text-[#7CD56A] tracking-tight">
              Our Team
            </h1>
            <p className="text-center text-white/80 text-lg mb-16 max-w-3xl mx-auto">
              Meet the dedicated researchers and developers behind PlantScope –
              combining passion for technology with environmental stewardship
            </p>

            <div className="mb-16">
              <h2 className="text-3xl font-bold mb-8 text-center">
                Research & Development Team
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border-2 border-white/20 shadow-2xl hover:border-[#7CD56A] transition-all text-center">
                  <div className="p-1 w-32 h-32 bg-linear-to-br from-[#4BA74E] to-[#7CD56A] rounded-full mx-auto mb-6 flex items-center justify-center text-white text-4xl font-bold shadow-xl">
                    <img
                      src={profile1}
                      alt=""
                      className="w-full rounded-full h-full"
                    />
                  </div>
                  <h3 className="text-2xl font-bold mb-2 text-[#7CD56A]">
                    Kim Arthem Son
                  </h3>
                  <p className="text-white/70 mb-2 font-semibold">
                    Project Leader
                  </p>
                  <p className="text-[#7CD56A] text-sm mb-4">
                    Lead Developer & System Architect
                  </p>
                  <p className="text-white/80 text-sm leading-relaxed mb-4">
                    3rd Year BSIT Student
                    <br />
                    Western Leyte College of Ormoc City
                  </p>
                  <div className="bg-white/5 rounded-lg p-4 mt-4">
                    <p className="text-xs text-white/60 mb-2">
                      Key Responsibilities:
                    </p>
                    <ul className="text-xs text-white/70 text-left space-y-1">
                      <li>• Project management & coordination</li>
                      <li>• System architecture design</li>
                      <li>• Database development</li>
                      <li>• Team leadership</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-2xl hover:border-[#7CD56A] transition-all text-center">
                  <div className="p-1 w-32 h-32 bg-linear-to-br from-[#4BA74E] to-[#7CD56A] rounded-full mx-auto mb-6 flex items-center justify-center text-white text-4xl font-bold shadow-xl">
                    <img
                      src={profile2}
                      alt=""
                      className="w-full rounded-full h-full"
                    />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">
                    Marc Xyver L. Gica
                  </h3>
                  <p className="text-white/70 mb-2 font-semibold">
                    Lead Researcher
                  </p>
                  <p className="text-[#7CD56A] text-sm mb-4">
                    GIS Specialist & Data Analyst
                  </p>
                  <p className="text-white/80 text-sm leading-relaxed mb-4">
                    3rd Year BSIT Student
                    <br />
                    Western Leyte College of Ormoc City
                  </p>
                  <div className="bg-white/5 rounded-lg p-3 mb-4">
                    <div className="text-white/70 text-sm space-y-2">
                      <p className="flex items-center justify-center gap-2">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                          />
                        </svg>
                        0951 513 36268
                      </p>
                      <p className="flex items-center justify-center gap-2 text-xs break-all px-2">
                        <svg
                          className="w-4 h-4 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                        marcxyver.gica@wlcormoc.edu.ph
                      </p>
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4">
                    <p className="text-xs text-white/60 mb-2">
                      Key Responsibilities:
                    </p>
                    <ul className="text-xs text-white/70 text-left space-y-1">
                      <li>• GIS data processing</li>
                      <li>• Spatial analysis</li>
                      <li>• Research documentation</li>
                      <li>• Field validation</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-2xl hover:border-[#7CD56A] transition-all text-center">
                  <div className="w-32 h-32 bg-linear-to-br p-1 from-[#4BA74E] to-[#7CD56A] rounded-full mx-auto mb-6 flex items-center justify-center text-white text-4xl font-bold shadow-xl">
                    <img
                      src={profile3}
                      alt=""
                      className="w-full rounded-full h-full"
                    />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">
                    Charles Ken D. Perez
                  </h3>
                  <p className="text-white/70 mb-2 font-semibold">Researcher</p>
                  <p className="text-[#7CD56A] text-sm mb-4">
                    Frontend Developer & UI/UX Designer
                  </p>
                  <p className="text-white/80 text-sm leading-relaxed mb-4">
                    3rd Year BSIT Student
                    <br />
                    Western Leyte College of Ormoc City
                  </p>
                  <div className="bg-white/5 rounded-lg p-4 mt-4">
                    <p className="text-xs text-white/60 mb-2">
                      Key Responsibilities:
                    </p>
                    <ul className="text-xs text-white/70 text-left space-y-1">
                      <li>• User interface design</li>
                      <li>• Frontend development</li>
                      <li>• Visualization tools</li>
                      <li>• User testing</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur rounded-2xl p-10 border border-white/10 shadow-xl mb-16">
              <h2 className="text-3xl font-bold mb-8 text-center">
                Faculty & Administration
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="text-center p-8 bg-white/5 rounded-xl border border-white/10 hover:border-[#7CD56A] transition-all">
                  <div className="w-24 h-24 p-1 bg-[#4BA74E] rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                    <img
                      src={profile4}
                      alt=""
                      className="w-full rounded-full h-full"
                    />
                  </div>
                  <h4 className="text-xl font-bold mb-1">Roel C. Daniot</h4>
                  <p className="text-[#7CD56A] mb-2 font-semibold">
                    Faculty Adviser
                  </p>
                  <p className="text-white/70 text-sm mb-4">
                    College of ICT & Engineering
                  </p>
                  <div className="bg-white/5 rounded-lg p-4 mt-4">
                    <p className="text-xs text-white/70 leading-relaxed">
                      Providing technical guidance, research methodology
                      supervision, and academic oversight throughout the
                      development of PlantScope.
                    </p>
                  </div>
                </div>

                <div className="text-center p-8 bg-white/5 rounded-xl border border-white/10 hover:border-[#7CD56A] transition-all">
                  <div className="w-24 h-24 bg-[#4BA74E] rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                    CT
                  </div>
                  <h4 className="text-xl font-bold mb-1">Cheryl M. Tarre</h4>
                  <p className="text-[#7CD56A] mb-2 font-semibold">Dean</p>
                  <p className="text-white/70 text-sm mb-2">
                    College of ICT & Engineering
                  </p>
                  <p className="text-white/60 text-xs mb-4">
                    DBA (cand), MST-CS, MSCS
                  </p>
                  <div className="bg-white/5 rounded-lg p-4 mt-4">
                    <p className="text-xs text-white/70 leading-relaxed">
                      Supporting academic excellence and fostering innovation in
                      ICT education, enabling students to create impactful
                      technological solutions.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
              <div className="stat-box">
                <div className="text-4xl font-bold text-[#7CD56A] mb-2">
                  2025-2026
                </div>
                <p className="text-white/70">Development Period</p>
              </div>
              <div className="stat-box">
                <div className="text-4xl font-bold text-[#7CD56A] mb-2">3</div>
                <p className="text-white/70">Dedicated Researchers</p>
              </div>
              <div className="stat-box">
                <div className="text-4xl font-bold text-[#7CD56A] mb-2">1</div>
                <p className="text-white/70">Mission: Restore Ormoc</p>
              </div>
            </div>

            <div className="mt-16 text-center bg-white/5 rounded-2xl p-10 border border-white/10">
              <h3 className="text-2xl font-bold mb-4 text-[#7CD56A]">
                Our Team Philosophy
              </h3>
              <p className="text-white/80 leading-relaxed max-w-3xl mx-auto mb-6">
                We believe that technology and environmental science can work
                hand-in-hand to create sustainable solutions. Our diverse skill
                sets in software development, GIS analysis, and environmental
                research allow us to approach reforestation from both technical
                and ecological perspectives.
              </p>
              <p className="text-white/70 italic">
                "Together, we're not just building software – we're planting the
                seeds for Ormoc's greener future."
              </p>
            </div>
          </div>
        </section>

        <section
          id="contact"
          className="min-h-screen py-32 px-6 bg-linear-to-b from-[#0F4A2F] to-[#134F38]"
        >
          <div className="max-w-6xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold text-center mb-8 text-[#7CD56A] tracking-tight">
              Contact Us
            </h1>
            <p className="text-center text-white/80 text-lg mb-16 max-w-3xl mx-auto">
              Get in touch with the PlantScope team – We're here to answer your
              questions and explore collaboration opportunities
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-xl">
                <h2 className="text-2xl font-bold mb-6 text-[#7CD56A]">
                  Contact Information
                </h2>

                <div className="space-y-4">
                  <div className="contact-info-item">
                    <div className="w-12 h-12 bg-linear-to-br from-[#4BA74E] to-[#7CD56A] rounded-full flex items-center justify-center shrink-0">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold mb-1">Phone</h4>
                      <p className="text-white/80">0951 513 36268</p>
                      <p className="text-white/60 text-sm">
                        Marc Xyver L. Gica (Lead Researcher)
                      </p>
                    </div>
                  </div>

                  <div className="contact-info-item">
                    <div className="w-12 h-12 bg-linear-to-br from-[#4BA74E] to-[#7CD56A] rounded-full flex items-center justify-center shrink-0">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold mb-1">Email</h4>
                      <p className="text-white/80 break-all">
                        marcxyver.gica@wlcormoc.edu.ph
                      </p>
                      <p className="text-white/60 text-sm">
                        Primary contact for inquiries
                      </p>
                    </div>
                  </div>

                  <div className="contact-info-item">
                    <div className="w-12 h-12 bg-linear-to-br from-[#4BA74E] to-[#7CD56A] rounded-full flex items-center justify-center shrink-0">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold mb-1">Location</h4>
                      <p className="text-white/80">
                        Western Leyte College of Ormoc City
                      </p>
                      <p className="text-white/60 text-sm">
                        College of Information Communication Technology and
                        Engineering
                      </p>
                      <p className="text-white/60 text-sm">
                        Ormoc City, Leyte, Philippines
                      </p>
                    </div>
                  </div>

                  <div className="contact-info-item">
                    <div className="w-12 h-12 bg-linear-to-br from-[#4BA74E] to-[#7CD56A] rounded-full flex items-center justify-center shrink-0">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold mb-1">Office Hours</h4>
                      <p className="text-white/80">Monday - Friday</p>
                      <p className="text-white/60 text-sm">
                        8:00 AM - 5:00 PM (Philippine Time)
                      </p>
                      <p className="text-white/60 text-sm">
                        Best time to reach us: 9:00 AM - 4:00 PM
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-xl">
                <h2 className="text-2xl font-bold mb-6 text-[#7CD56A]">
                  Send a Message
                </h2>

                <form className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-[#7CD56A] text-white placeholder-white/50 transition-all"
                      placeholder="Juan Dela Cruz"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-[#7CD56A] text-white placeholder-white/50 transition-all"
                      placeholder="your.email@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Organization/Affiliation
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-[#7CD56A] text-white placeholder-white/50 transition-all"
                      placeholder="Your organization (optional)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Subject
                    </label>
                    <select className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-[#7CD56A] text-white transition-all">
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
                    <label className="block text-sm font-medium mb-2">
                      Message *
                    </label>
                    <textarea
                      required
                      rows={5}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-[#7CD56A] text-white placeholder-white/50 resize-none transition-all"
                      placeholder="Tell us more about your inquiry..."
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-linear-to-r from-[#4BA74E] to-[#7CD56A] px-6 py-4 rounded-lg font-semibold hover:shadow-lg hover:shadow-[#4BA74E]/50 transition-all transform hover:-translate-y-1"
                  >
                    Send Message
                  </button>

                  <p className="text-xs text-white/60 text-center">
                    We typically respond within 24-48 hours during business days
                  </p>
                </form>
              </div>
            </div>
          </div>
        </section>

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
                      onClick={() => navigate("/privacy-policy")}
                      className="hover:text-[#7CD56A] transition-colors cursor-pointer"
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
