import { useState, useEffect, useRef, use } from "react";
import Loader from "../../components/layout/loader.tsx";
import Navbar from "../../components/layout/nav.tsx";
import background from "../../assets/background.jpg";
import logo from "../../assets/logo.png";
import "../../global css/homePage.css";
import profile1 from "../../assets/PROFILE1.jpg";
import profile2 from "../../assets/profile2.jpg";
import profile3 from "../../assets/profile3.jpg";
import { api } from "@/constant/api.ts";
import { useNavigate } from "react-router-dom";

export default function App() {
  const checkIfStillLogin = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      return;
    }
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
  }, []);
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
          } else if (sec.id === "download") {
            current = sections[4].id;
          } else if (sec.id === "team") {
            current = sections[5].id;
          } else if (sec.id === "Contact") {
            current = sections[6].id;
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
              <div className="max-w-5xl mx-auto space-y-6 md:space-y-8 px-4">
                <div className="mb-6 md:mb-8 fade-up">
                  <div className="logo-container">
                    <img src={logo} alt="PlantScope Logo" />
                  </div>
                </div>

                <h1 className="text-3xl md:text-4xl font-bold tracking-tight fade-up-delay">
                  PlantScope
                </h1>
                <p className="text-[#7CD56A] text-lg md:text-xl tracking-wider fade-up-delay"></p>

                <h2 className="text-base md:text-1xl font-bold leading-tight max-w-4xl mx-auto fade-up-delay-2">
                  A GIS-Based Site Suitability Assessment and{" "}
                  <br className="hidden md:block" />
                  Reforestation Monitoring System with Geospatial Analytics for{" "}
                  <br className="hidden md:block" />
                  Ormoc City
                </h2>
                <div className="flex flex-col sm:flex-row gap-4 md:gap-6 justify-center pt-4 md:pt-6 fade-up-delay-2">
                  <a
                    href="#service"
                    className="btn-primary text-base md:text-lg font-semibold"
                  >
                    Explore Dashboard
                  </a>

                  <a
                    href="#about"
                    className="btn-secondary text-base md:text-lg font-semibold"
                  >
                    Learn More
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="py-16 md:py-24 px-4 md:px-6 bg-linear-to-b from-[#0F4A2F] to-[#134F38]">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-12 md:mb-16">
                <h2 className="text-3xl md:text-5xl font-bold mb-3 md:mb-4">
                  Core Features
                </h2>
                <p className="text-white/70 text-base md:text-lg max-w-2xl mx-auto px-4">
                  Leveraging cutting-edge technology for environmental
                  restoration
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10">
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
                  <h3 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-[#7CD56A]">
                    GIS-Powered Mapping
                  </h3>
                  <p className="text-white/80 leading-relaxed text-sm md:text-base">
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
                  <h3 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-[#7CD56A]">
                    Data-Driven Prioritization
                  </h3>
                  <p className="text-white/80 leading-relaxed text-sm md:text-base">
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
                  <h3 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-[#7CD56A]">
                    Focused on Ormoc City
                  </h3>
                  <p className="text-white/80 leading-relaxed text-sm md:text-base">
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
          className="min-h-screen py-16 md:py-32 px-4 md:px-6 bg-linear-to-b from-[#0F4A2F] to-[#134F38]"
        >
          <div className="max-w-5xl mx-auto">
            <h1 className="text-4xl md:text-7xl font-bold text-center mb-10 md:mb-16 text-[#7CD56A] tracking-tight">
              About PlantScope
            </h1>

            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 md:p-10 lg:p-12 border border-white/20 mb-8 md:mb-12 shadow-2xl hover:bg-white/15 transition-all">
              <h2 className="text-2xl md:text-4xl font-bold mb-4 md:mb-6">
                Project Overview
              </h2>
              <p className="text-base md:text-lg leading-relaxed text-white/90 mb-4 md:mb-6">
                <strong>PlantScope</strong> is a capstone project developed by
                students of the
                <em className="text-[#7CD56A]">
                  {" "}
                  Western Leyte College of Ormoc City – College of Information
                  Communication Technology and Engineering
                </em>
                .
              </p>
              <p className="text-base md:text-lg leading-relaxed text-white/90 mb-4 md:mb-6">
                This innovative platform combines geographic information systems
                (GIS) with data analytics to identify and prioritize
                reforestation sites in Ormoc City, contributing to ecological
                restoration and climate resilience in post-disaster areas.
              </p>
              <p className="text-base md:text-lg leading-relaxed text-white/90">
                PlantScope serves as a decision-support platform that helps
                identify, evaluate, and prioritize potential reforestation sites
                based on ecological and spatial data. It enables local
                government units, environmental offices, and partner
                organizations to visualize areas most suitable for tree planting
                and restoration efforts.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 md:p-10 lg:p-12 border border-white/20 mb-8 md:mb-12 shadow-2xl hover:bg-white/15 transition-all">
              <h2 className="text-2xl md:text-4xl font-bold mb-4 md:mb-6">
                Addressing Deforestation in Ormoc City
              </h2>

              <div className="space-y-4 md:space-y-6 text-base md:text-lg leading-relaxed text-white/90">
                <p>
                  Ormoc City has faced significant environmental challenges,
                  particularly after Typhoon Yolanda (Haiyan) in 2013, which
                  devastated forest cover and left watersheds vulnerable to
                  erosion, landslides, and flooding. Deforestation has been a
                  persistent issue, threatening biodiversity, water security,
                  and community resilience.
                </p>

                <div className="bg-white/5 rounded-xl p-4 md:p-6 border border-white/10">
                  <h3 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-[#7CD56A]">
                    How PlantScope Helps:
                  </h3>
                  <ul className="space-y-3 md:space-y-4">
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

            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 md:p-10 lg:p-12 border border-white/10 shadow-xl">
              <h2 className="text-2xl md:text-4xl font-bold mb-4 md:mb-6">
                Our Mission
              </h2>
              <p className="text-base md:text-lg leading-relaxed text-white/90 mb-6 md:mb-8">
                To provide local government units, environmental organizations,
                and communities with scientific tools for strategic
                reforestation planning, ensuring maximum ecological impact and
                sustainable forest recovery.
              </p>

              <div className="text-center pt-6 md:pt-8 border-t border-white/20">
                <p className="text-xl md:text-2xl italic text-white/90 mb-4 md:mb-6">
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
          className="min-h-screen py-16 md:py-32 px-4 md:px-6 bg-linear-to-b from-[#0F4A2F] to-[#134F38]"
        >
          <div className="max-w-7xl mx-auto">
            <h1 className="text-4xl md:text-7xl font-bold text-center mb-6 md:mb-8 text-[#7CD56A] tracking-tight">
              Our Services
            </h1>
            <p className="text-center text-white/80 text-base md:text-lg mb-10 md:mb-16 max-w-3xl mx-auto px-4">
              PlantScope serves as a comprehensive decision-support platform for
              data-driven reforestation management and ecological restoration
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-12 md:mb-20">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 md:p-8 border border-white/20 shadow-xl hover:bg-white/15 transition-all">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-linear-to-br from-[#4BA74E] to-[#7CD56A] rounded-full flex items-center justify-center mb-4 md:mb-6">
                  <svg
                    className="w-7 h-7 md:w-8 md:h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                </div>
                <h3 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-[#7CD56A]">
                  Geospatial Site Analysis
                </h3>
                <p className="text-white/80 leading-relaxed mb-4 md:mb-6 text-sm md:text-base">
                  Comprehensive spatial analysis integrating multiple
                  environmental factors for optimal site selection.
                </p>

                <div className="space-y-2 md:space-y-3">
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1 text-sm md:text-base">
                      Elevation Mapping
                    </h4>
                    <p className="text-xs md:text-sm text-white/70">
                      Digital elevation model analysis for terrain assessment
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1 text-sm md:text-base">
                      Slope Analysis
                    </h4>
                    <p className="text-xs md:text-sm text-white/70">
                      Gradient calculations to determine erosion risk and
                      accessibility
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1 text-sm md:text-base">
                      Soil Type Classification
                    </h4>
                    <p className="text-xs md:text-sm text-white/70">
                      Soil composition mapping for species suitability
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1 text-sm md:text-base">
                      Land Cover Assessment
                    </h4>
                    <p className="text-xs md:text-sm text-white/70">
                      Current vegetation and land use pattern identification
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1 text-sm md:text-base">
                      Water Source Proximity
                    </h4>
                    <p className="text-xs md:text-sm text-white/70">
                      Distance analysis to rivers, streams, and watersheds
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 md:p-8 border border-white/20 shadow-xl hover:bg-white/15 transition-all">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-linear-to-br from-[#4BA74E] to-[#7CD56A] rounded-full flex items-center justify-center mb-4 md:mb-6">
                  <svg
                    className="w-7 h-7 md:w-8 md:h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-[#7CD56A]">
                  Environmental Factor Mapping
                </h3>
                <p className="text-white/80 leading-relaxed mb-4 md:mb-6 text-sm md:text-base">
                  Multi-layer visualization of ecological conditions crucial for
                  reforestation success.
                </p>

                <div className="space-y-2 md:space-y-3">
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1 text-sm md:text-base">
                      Climate Data Integration
                    </h4>
                    <p className="text-xs md:text-sm text-white/70">
                      Temperature, rainfall, and seasonal pattern analysis
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1 text-sm md:text-base">
                      Biodiversity Hotspots
                    </h4>
                    <p className="text-xs md:text-sm text-white/70">
                      Identification of areas with high ecological value
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1 text-sm md:text-base">
                      Erosion Risk Zones
                    </h4>
                    <p className="text-xs md:text-sm text-white/70">
                      Areas requiring urgent intervention to prevent degradation
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1 text-sm md:text-base">
                      Disaster-Prone Areas
                    </h4>
                    <p className="text-xs md:text-sm text-white/70">
                      Mapping of flood-prone and landslide-susceptible zones
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1 text-sm md:text-base">
                      Community Access Routes
                    </h4>
                    <p className="text-xs md:text-sm text-white/70">
                      Road networks and accessibility mapping for implementation
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 md:p-8 border border-white/20 shadow-xl hover:bg-white/15 transition-all">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-linear-to-br from-[#4BA74E] to-[#7CD56A] rounded-full flex items-center justify-center mb-4 md:mb-6">
                  <svg
                    className="w-7 h-7 md:w-8 md:h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-[#7CD56A]">
                  Prioritization Scoring System
                </h3>
                <p className="text-white/80 leading-relaxed mb-4 md:mb-6 text-sm md:text-base">
                  Scientific ranking methodology that evaluates and ranks
                  reforestation sites based on multiple criteria.
                </p>

                <div className="space-y-2 md:space-y-3">
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1 text-sm md:text-base">
                      Ecological Restoration Potential
                    </h4>
                    <p className="text-xs md:text-sm text-white/70">
                      Assessment of biodiversity recovery and ecosystem services
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1 text-sm md:text-base">
                      Climate Resilience Score
                    </h4>
                    <p className="text-xs md:text-sm text-white/70">
                      Evaluation of site's ability to withstand climate extremes
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1 text-sm md:text-base">
                      Strategic Importance Ranking
                    </h4>
                    <p className="text-xs md:text-sm text-white/70">
                      Priority based on watershed protection and community
                      impact
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1 text-sm md:text-base">
                      Implementation Feasibility
                    </h4>
                    <p className="text-xs md:text-sm text-white/70">
                      Cost-benefit analysis and accessibility considerations
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1 text-sm md:text-base">
                      Success Probability Index
                    </h4>
                    <p className="text-xs md:text-sm text-white/70">
                      Predicted seedling survival rate based on site conditions
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 md:p-8 border border-white/20 shadow-xl hover:bg-white/15 transition-all">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-linear-to-br from-[#4BA74E] to-[#7CD56A] rounded-full flex items-center justify-center mb-4 md:mb-6">
                  <svg
                    className="w-7 h-7 md:w-8 md:h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-[#7CD56A]">
                  Interactive Dashboard & Visualization
                </h3>
                <p className="text-white/80 leading-relaxed mb-4 md:mb-6 text-sm md:text-base">
                  User-friendly platform with advanced visualization tools for
                  efficient decision-making.
                </p>

                <div className="space-y-2 md:space-y-3">
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1 text-sm md:text-base">
                      Interactive Map Interface
                    </h4>
                    <p className="text-xs md:text-sm text-white/70">
                      Zoom, pan, and explore reforestation sites dynamically
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1 text-sm md:text-base">
                      Layer Toggle Controls
                    </h4>
                    <p className="text-xs md:text-sm text-white/70">
                      Show/hide different data layers for focused analysis
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1 text-sm md:text-base">
                      Data Charts & Graphs
                    </h4>
                    <p className="text-xs md:text-sm text-white/70">
                      Visual statistics on site characteristics and priorities
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1 text-sm md:text-base">
                      Report Generation
                    </h4>
                    <p className="text-xs md:text-sm text-white/70">
                      Export detailed reports and maps for stakeholders
                    </p>
                  </div>
                  <div className="service-feature-box">
                    <h4 className="font-semibold text-[#7CD56A] mb-1 text-sm md:text-base">
                      Real-Time Updates
                    </h4>
                    <p className="text-xs md:text-sm text-white/70">
                      Track progress and monitor reforestation activities
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Download App Section */}
        <section
          id="download"
          className="py-16 md:py-20 px-4 md:px-6 bg-gradient-to-b from-[#0F4A2F] to-[#134F38]"
        >
          <div className="max-w-7xl mx-auto">
            {/* Section Header */}
            <div className="text-center mb-10 md:mb-12">
              <h2 className="text-3xl md:text-5xl font-bold mb-3 md:mb-4 text-[#7CD56A] tracking-tight">
                Download Our Mobile App
              </h2>
              <p className="text-white/70 text-base md:text-lg max-w-3xl mx-auto px-4">
                Take PlantScope with you in the field. Our mobile application
                empowers field inspectors, tree growers, and community groups to
                participate in reforestation efforts.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-12 items-center">
              {/* Left Content - Download Info */}
              <div className="space-y-5 md:space-y-6 order-2 lg:order-1">
                <div>
                  <h3 className="text-xl md:text-3xl font-bold mb-2 md:mb-3 text-white">
                    For Everyone Involved in Reforestation
                  </h3>
                  <p className="text-white/70 text-sm md:text-base leading-relaxed mb-3 md:mb-4">
                    Whether you're monitoring sites or planting trees,
                    PlantScope connects all stakeholders in Ormoc City's
                    reforestation journey.
                  </p>
                </div>

                {/* User Types */}
                <div className="space-y-3 md:space-y-4">
                  <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 md:p-4 border border-white/10">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 md:w-10 md:h-10 bg-[#7CD56A]/20 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                        <svg
                          className="w-4 h-4 md:w-5 md:h-5 text-[#7CD56A]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-white mb-1 text-sm md:text-base">
                          Field Inspectors
                        </h4>
                        <p className="text-white/60 text-xs md:text-sm">
                          Conduct site assessments, submit GPS-tagged data, and
                          monitor reforestation progress in real-time.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 md:p-4 border border-white/10">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 md:w-10 md:h-10 bg-[#7CD56A]/20 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                        <svg
                          className="w-4 h-4 md:w-5 md:h-5 text-[#7CD56A]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-white mb-1 text-sm md:text-base">
                          Community Groups
                        </h4>
                        <p className="text-white/60 text-xs md:text-sm">
                          Apply for tree planting programs, track your
                          applications, and manage your reforestation projects.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 md:p-4 border border-white/10">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 md:w-10 md:h-10 bg-[#7CD56A]/20 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                        <svg
                          className="w-4 h-4 md:w-5 md:h-5 text-[#7CD56A]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                          />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-white mb-1 text-sm md:text-base">
                          Organizations
                        </h4>
                        <p className="text-white/60 text-xs md:text-sm">
                          Formal organizations and informal groups can register,
                          apply for programs, and report progress.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Download Section */}
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 md:p-5 border border-white/20">
                  <div className="flex items-center gap-3 mb-3 md:mb-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-[#7CD56A] rounded-xl flex items-center justify-center shrink-0">
                      <svg
                        className="w-5 h-5 md:w-6 md:h-6 text-[#0F4A2F]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-base md:text-lg font-bold text-white mb-0.5">
                        Download for Android
                      </h4>
                      <p className="text-white/60 text-xs">
                        Version 1.0.0 • 25MB • Requires Android 8.0+
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <a
                      href="https://github.com/KimArthemSon/PlantScope/releases/download/v1.0.0/application-9b7292bb-6098-460b-8331-afc2d3037204.apk"
                      download
                      className="flex-1 inline-flex items-center justify-center gap-2 bg-[#7CD56A] hover:bg-[#6BC45A] text-[#0F4A2F] px-4 md:px-5 py-2.5 rounded-xl font-bold transition-all transform hover:scale-[1.02] shadow-lg hover:shadow-[#7CD56A]/50 text-sm"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      Download APK
                    </a>

                    <button className="flex-1 inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 md:px-5 py-2.5 rounded-xl font-semibold transition-all border border-white/20 text-sm">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Learn More
                    </button>
                  </div>

                  <p className="text-white/50 text-xs mt-3 text-center sm:text-left">
                    By downloading, you agree to our Terms & Conditions and
                    Privacy Policy
                  </p>
                </div>
              </div>

              {/* Right Content - Phone Mockup */}
              <div className="flex justify-center order-1 lg:order-2">
                <div className="relative">
                  {/* Phone Frame */}
                  <div className="relative w-64 md:w-72 h-[500px] md:h-[560px] bg-[#1a1a1a] rounded-[2rem] md:rounded-[2.5rem] border-8 border-[#2a2a2a] shadow-2xl overflow-hidden">
                    {/* Screen Content */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[#0F4A2F] to-[#134F38]">
                      {/* Status Bar */}
                      <div className="h-6 bg-[#0F4A2F]/90 flex items-center justify-between px-4 text-white text-xs">
                        <span>9:41</span>
                        <div className="flex gap-1">
                          <div className="w-3 h-2 bg-white rounded-sm"></div>
                          <div className="w-3 h-2 bg-white rounded-sm"></div>
                        </div>
                      </div>

                      {/* App Header */}
                      <div className="p-3 md:p-4 pt-3">
                        <div className="flex items-center gap-2 mb-3 md:mb-4">
                          <div className="w-7 h-7 md:w-8 md:h-8 bg-[#7CD56A] rounded-full flex items-center justify-center">
                            <svg
                              className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#0F4A2F]"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                              />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-bold text-xs md:text-sm">
                              PlantScope
                            </p>
                            <p className="text-white/60 text-xs">
                              Community Portal
                            </p>
                          </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="grid grid-cols-2 gap-2 mb-3 md:mb-4">
                          <div className="bg-[#7CD56A]/20 backdrop-blur-sm rounded-lg p-2 md:p-3 border border-[#7CD56A]/30 text-center">
                            <p className="text-white text-base md:text-lg font-bold">
                              3
                            </p>
                            <p className="text-white/70 text-xs">
                              Active Projects
                            </p>
                          </div>
                          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-3 border border-white/20 text-center">
                            <p className="text-white text-base md:text-lg font-bold">
                              12
                            </p>
                            <p className="text-white/70 text-xs">
                              Trees Planted
                            </p>
                          </div>
                        </div>

                        {/* Menu Items */}
                        <div className="space-y-2">
                          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-3 border border-white/20 flex items-center gap-2 md:gap-3">
                            <div className="w-7 h-7 md:w-8 md:h-8 bg-[#7CD56A]/20 rounded-lg flex items-center justify-center">
                              <svg
                                className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#7CD56A]"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <p className="text-white text-xs md:text-sm font-semibold">
                                Apply for Program
                              </p>
                              <p className="text-white/50 text-xs">
                                Submit application
                              </p>
                            </div>
                          </div>

                          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-3 border border-white/20 flex items-center gap-2 md:gap-3">
                            <div className="w-7 h-7 md:w-8 md:h-8 bg-[#7CD56A]/20 rounded-lg flex items-center justify-center">
                              <svg
                                className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#7CD56A]"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                                />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <p className="text-white text-xs md:text-sm font-semibold">
                                My Applications
                              </p>
                              <p className="text-white/50 text-xs">
                                Track status
                              </p>
                            </div>
                          </div>

                          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-3 border border-white/20 flex items-center gap-2 md:gap-3">
                            <div className="w-7 h-7 md:w-8 md:h-8 bg-[#7CD56A]/20 rounded-lg flex items-center justify-center">
                              <svg
                                className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#7CD56A]"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <p className="text-white text-xs md:text-sm font-semibold">
                                Report Progress
                              </p>
                              <p className="text-white/50 text-xs">
                                Update planting status
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Action Button */}
                        <button className="w-full mt-2 md:mt-3 bg-[#7CD56A] hover:bg-[#6BC45A] text-[#0F4A2F] font-bold py-2 md:py-2.5 rounded-lg transition-colors text-xs md:text-sm">
                          View Dashboard
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Decorative Elements */}
                  <div className="absolute -z-10 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 md:w-80 h-72 md:h-80 bg-[#7CD56A]/20 rounded-full blur-3xl"></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="team"
          className="min-h-screen py-16 md:py-32 px-4 md:px-6 bg-linear-to-b from-[#0F4A2F] to-[#134F38]"
        >
          <div className="max-w-7xl mx-auto">
            <h1 className="text-4xl md:text-7xl font-bold text-center mb-6 md:mb-8 text-[#7CD56A] tracking-tight">
              Our Team
            </h1>
            <p className="text-center text-white/80 text-base md:text-lg mb-10 md:mb-16 max-w-3xl mx-auto px-4">
              Meet the dedicated researchers and developers behind PlantScope –
              combining passion for technology with environmental stewardship
            </p>

            <div className="mb-10 md:mb-16">
              <h2 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 text-center">
                Research & Development Team
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10">
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 md:p-8 border-2 border-white/20 shadow-2xl hover:border-[#7CD56A] transition-all text-center">
                  <div className="p-1 w-28 h-28 md:w-32 md:h-32 bg-linear-to-br from-[#4BA74E] to-[#7CD56A] rounded-full mx-auto mb-4 md:mb-6 flex items-center justify-center text-white text-3xl md:text-4xl font-bold shadow-xl">
                    <img
                      src={profile1}
                      alt=""
                      className="w-full rounded-full h-full"
                    />
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold mb-2 text-[#7CD56A]">
                    Kim Arthem Son
                  </h3>
                  <p className="text-white/70 mb-2 font-semibold text-sm md:text-base">
                    Project Leader
                  </p>
                  <p className="text-[#7CD56A] text-xs md:text-sm mb-3 md:mb-4">
                    Lead Developer & System Architect
                  </p>
                  <p className="text-white/80 text-xs md:text-sm leading-relaxed mb-3 md:mb-4">
                    4th Year BSIT Student
                    <br />
                    Western Leyte College of Ormoc City
                  </p>
                  <div className="bg-white/5 rounded-lg p-3 md:p-4 mt-3 md:mt-4">
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

                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 md:p-8 border border-white/20 shadow-2xl hover:border-[#7CD56A] transition-all text-center">
                  <div className="p-1 w-28 h-28 md:w-32 md:h-32 bg-linear-to-br from-[#4BA74E] to-[#7CD56A] rounded-full mx-auto mb-4 md:mb-6 flex items-center justify-center text-white text-3xl md:text-4xl font-bold shadow-xl">
                    <img
                      src={profile2}
                      alt=""
                      className="w-full rounded-full h-full"
                    />
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold mb-2">
                    Marc Xyver L. Gica
                  </h3>
                  <p className="text-white/70 mb-2 font-semibold text-sm md:text-base">
                    Lead Researcher
                  </p>
                  <p className="text-[#7CD56A] text-xs md:text-sm mb-3 md:mb-4">
                    GIS Specialist & Data Analyst
                  </p>
                  <p className="text-white/80 text-xs md:text-sm leading-relaxed mb-3 md:mb-4">
                    4th Year BSIT Student
                    <br />
                    Western Leyte College of Ormoc City
                  </p>
                  <div className="bg-white/5 rounded-lg p-2 md:p-3 mb-3 md:mb-4">
                    <div className="text-white/70 text-xs md:text-sm space-y-2">
                      <p className="flex items-center justify-center gap-2">
                        <svg
                          className="w-3.5 h-3.5 md:w-4 md:h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                          />
                        </svg>
                        0951 513 36268
                      </p>
                      <p className="flex items-center justify-center gap-2 text-xs break-all px-2">
                        <svg
                          className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                        marcxyver.gica@wlcormoc.edu.ph
                      </p>
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 md:p-4">
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

                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 md:p-8 border border-white/20 shadow-2xl hover:border-[#7CD56A] transition-all text-center">
                  <div className="w-28 h-28 md:w-32 md:h-32 bg-linear-to-br p-1 from-[#4BA74E] to-[#7CD56A] rounded-full mx-auto mb-4 md:mb-6 flex items-center justify-center text-white text-3xl md:text-4xl font-bold shadow-xl">
                    <img
                      src={profile3}
                      alt=""
                      className="w-full rounded-full h-full"
                    />
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold mb-2">
                    Charles Ken D. Perez
                  </h3>
                  <p className="text-white/70 mb-2 font-semibold text-sm md:text-base">
                    Researcher
                  </p>
                  <p className="text-[#7CD56A] text-xs md:text-sm mb-3 md:mb-4">
                    Frontend Developer & UI/UX Designer
                  </p>
                  <p className="text-white/80 text-xs md:text-sm leading-relaxed mb-3 md:mb-4">
                    4th Year BSIT Student
                    <br />
                    Western Leyte College of Ormoc City
                  </p>
                  <div className="bg-white/5 rounded-lg p-3 md:p-4 mt-3 md:mt-4">
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-10 md:mb-16">
              <div className="stat-box">
                <div className="text-3xl md:text-4xl font-bold text-[#7CD56A] mb-2">
                  2025-2026
                </div>
                <p className="text-white/70 text-sm md:text-base">
                  Development Period
                </p>
              </div>
              <div className="stat-box">
                <div className="text-3xl md:text-4xl font-bold text-[#7CD56A] mb-2">
                  3
                </div>
                <p className="text-white/70 text-sm md:text-base">
                  Dedicated Researchers
                </p>
              </div>
              <div className="stat-box">
                <div className="text-3xl md:text-4xl font-bold text-[#7CD56A] mb-2">
                  1
                </div>
                <p className="text-white/70 text-sm md:text-base">
                  Mission: Restore Ormoc
                </p>
              </div>
            </div>

            <div className="mt-10 md:mt-16 text-center bg-white/5 rounded-2xl p-6 md:p-10 border border-white/10">
              <h3 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-[#7CD56A]">
                Our Team Philosophy
              </h3>
              <p className="text-white/80 leading-relaxed max-w-3xl mx-auto mb-4 md:mb-6 text-sm md:text-base px-4">
                We believe that technology and environmental science can work
                hand-in-hand to create sustainable solutions. Our diverse skill
                sets in software development, GIS analysis, and environmental
                research allow us to approach reforestation from both technical
                and ecological perspectives.
              </p>
              <p className="text-white/70 italic text-sm md:text-base">
                "Together, we're not just building software – we're planting the
                seeds for Ormoc's greener future."
              </p>
            </div>
          </div>
        </section>

        <section
          id="contact"
          className="min-h-screen py-16 md:py-32 px-4 md:px-6 bg-linear-to-b from-[#0F4A2F] to-[#134F38]"
        >
          <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl md:text-7xl font-bold text-center mb-6 md:mb-8 text-[#7CD56A] tracking-tight">
              Contact Us
            </h1>
            <p className="text-center text-white/80 text-base md:text-lg mb-10 md:mb-16 max-w-3xl mx-auto px-4">
              Get in touch with the PlantScope team – We're here to answer your
              questions and explore collaboration opportunities
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-12">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 md:p-8 border border-white/20 shadow-xl">
                <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-[#7CD56A]">
                  Contact Information
                </h2>

                <div className="space-y-4">
                  <div className="contact-info-item">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-linear-to-br from-[#4BA74E] to-[#7CD56A] rounded-full flex items-center justify-center shrink-0">
                      <svg
                        className="w-5 h-5 md:w-6 md:h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold mb-1 text-sm md:text-base">
                        Phone
                      </h4>
                      <p className="text-white/80 text-sm md:text-base">
                        0951 513 36268
                      </p>
                      <p className="text-white/60 text-xs md:text-sm">
                        Marc Xyver L. Gica (Lead Researcher)
                      </p>
                    </div>
                  </div>

                  <div className="contact-info-item">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-linear-to-br from-[#4BA74E] to-[#7CD56A] rounded-full flex items-center justify-center shrink-0">
                      <svg
                        className="w-5 h-5 md:w-6 md:h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold mb-1 text-sm md:text-base">
                        Email
                      </h4>
                      <p className="text-white/80 break-all text-sm md:text-base">
                        marcxyver.gica@wlcormoc.edu.ph
                      </p>
                      <p className="text-white/60 text-xs md:text-sm">
                        Primary contact for inquiries
                      </p>
                    </div>
                  </div>

                  <div className="contact-info-item">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-linear-to-br from-[#4BA74E] to-[#7CD56A] rounded-full flex items-center justify-center shrink-0">
                      <svg
                        className="w-5 h-5 md:w-6 md:h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold mb-1 text-sm md:text-base">
                        Location
                      </h4>
                      <p className="text-white/80 text-sm md:text-base">
                        Western Leyte College of Ormoc City
                      </p>
                      <p className="text-white/60 text-xs md:text-sm">
                        College of Information Communication Technology and
                        Engineering
                      </p>
                      <p className="text-white/60 text-xs md:text-sm">
                        Ormoc City, Leyte, Philippines
                      </p>
                    </div>
                  </div>

                  <div className="contact-info-item">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-linear-to-br from-[#4BA74E] to-[#7CD56A] rounded-full flex items-center justify-center shrink-0">
                      <svg
                        className="w-5 h-5 md:w-6 md:h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold mb-1 text-sm md:text-base">
                        Office Hours
                      </h4>
                      <p className="text-white/80 text-sm md:text-base">
                        Monday - Friday
                      </p>
                      <p className="text-white/60 text-xs md:text-sm">
                        8:00 AM - 5:00 PM (Philippine Time)
                      </p>
                      <p className="text-white/60 text-xs md:text-sm">
                        Best time to reach us: 9:00 AM - 4:00 PM
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 md:p-8 border border-white/20 shadow-xl">
                <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-[#7CD56A]">
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
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-[#7CD56A] text-white placeholder-white/50 transition-all text-sm md:text-base"
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
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-[#7CD56A] text-white placeholder-white/50 transition-all text-sm md:text-base"
                      placeholder="your.email@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Organization/Affiliation
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-[#7CD56A] text-white placeholder-white/50 transition-all text-sm md:text-base"
                      placeholder="Your organization (optional)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Subject
                    </label>
                    <select className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-[#7CD56A] text-white transition-all text-sm md:text-base">
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
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-[#7CD56A] text-white placeholder-white/50 resize-none transition-all text-sm md:text-base"
                      placeholder="Tell us more about your inquiry..."
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-linear-to-r from-[#4BA74E] to-[#7CD56A] px-6 py-3 md:py-4 rounded-lg font-semibold hover:shadow-lg hover:shadow-[#4BA74E]/50 transition-all transform hover:-translate-y-1 text-sm md:text-base"
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

        <footer className="bg-[#0F4A2F] py-8 md:py-12 border-t border-white/20">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-5 mb-6 md:mb-8">
              <div>
                <h3 className="font-bold text-base md:text-lg mb-3 md:mb-4 text-[#7CD56A]">
                  PlantScope
                </h3>
                <p className="text-white/70 text-xs md:text-sm leading-relaxed">
                  A GIS-Based Site Suitability Assessment and Reforestation
                  Monitoring System with Geospatial Analytics for Ormoc City
                </p>
              </div>
              <div>
                <h3 className="font-bold text-base md:text-lg mb-3 md:mb-4 text-[#7CD56A]">
                  Pages
                </h3>
                <ul className="space-y-2 text-white/70 text-xs md:text-sm">
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
                <h3 className="font-bold text-base md:text-lg mb-3 md:mb-4 text-[#7CD56A]">
                  Security
                </h3>
                <ul className="space-y-2 text-white/70 text-xs md:text-sm">
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
                <h3 className="font-bold text-base md:text-lg mb-3 md:mb-4 text-[#7CD56A]">
                  Connect With Us
                </h3>
                <p className="text-white/70 text-xs md:text-sm mb-2">
                  Western Leyte College of Ormoc City
                </p>
                <p className="text-white/60 text-xs md:text-sm">
                  College of ICT & Engineering
                </p>
              </div>
            </div>
            <div className="text-center pt-6 md:pt-8 border-t border-white/10">
              <p className="text-white/60 text-xs md:text-sm">
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
