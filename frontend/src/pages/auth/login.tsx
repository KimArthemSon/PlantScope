import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from "lucide-react";

import "@/global css/login.css";
import "@/assets/homepage/homepage.css";
import logoImg from "@/assets/homepage/logo.jpg";
import heroVideo from "@/assets/homepage/hero.mp4";
import { api } from "@/constant/api.ts";
import PlantScopeAlert from "../../components/alert/PlantScopeAlert";
import PlantScopeLoader from "../../components/alert/PlantScopeLoader";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);

  const navigate = useNavigate();

  /* ─── Auth check (unchanged) ─── */
  useEffect(() => {
    checkIfStillLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setTimeout(() => {
      setLockoutSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [lockoutSeconds]);

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
        setIsLoading(false);
        setPSAlert({
          type: "success",
          title: "Login Successful",
          message: `Redirecting to dashboard...`,
        });
        if (data.token) localStorage.setItem("token", data.token);
        setTimeout(() => {
          if (data.user_role === "CityENROHead") navigate("/dashboard");
          else if (data.user_role === "DataManager") navigate("/dashboard-data-manager");
          else if (data.user_role === "GISSpecialist") navigate("/dashboard/GISS");
          else if (data.user_role === "AFA") navigate("/dashboard/AFA");
        }, 2000);
      }
    } catch (error) {
      setIsLoading(false);
      console.error("Login error:", error);
    }
  };

  /* ─── Login handler (logic unchanged) ─── */
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!username || !password) {
      setIsLoading(false);
      setPSAlert({
        type: "failed",
        title: "Login Failed",
        message: `"Invalid input. Please enter username and password."`,
      });
      return;
    }

    try {
      const response = await fetch(api + "api/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: username, password: password }),
      });
      const data = await response.json();

      if (response.ok) {
        setIsLoading(false);
        setAttemptsLeft(null);
        setPSAlert({
          type: "success",
          title: "Login Successful",
          message: `Redirecting to dashboard...`,
        });
        if (data.token) localStorage.setItem("token", data.token);
        setTimeout(() => {
          if (data.user_role === "DataManager") navigate("/dashboard-data-manager");
          else if (data.user_role === "CityENROHead") navigate("/dashboard");
          else if (data.user_role === "GISSpecialist") navigate("/dashboard/GISS");
        }, 3000);
      } else if (response.status === 403) {
        setIsLoading(false);
        setAttemptsLeft(0);
        setLockoutSeconds(data.remaining_seconds ?? 120);
        setPSAlert({
          type: "failed",
          title: "Account Locked",
          message: `Too many failed attempts. Try again in ${data.remaining_seconds ?? 120} seconds.`,
        });
      } else {
        setIsLoading(false);
        setAttemptsLeft(data.attempts_left ?? null);
        setPSAlert({
          type: "failed",
          title: "Login Failed",
          message: `${data.error || "Login failed. Please check your credentials."}`,
        });
      }
    } catch (error) {
      setIsLoading(false);
      console.error("Login error:", error);
      setPSAlert({
        type: "error",
        title: "Error",
        message: `An error occurred. Please try again later.`,
      });
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: "#0A0F0D" }}>
      {isLoading && <PlantScopeLoader />}
      {PSalert && (
        <PlantScopeAlert
          type={PSalert.type}
          title={PSalert.title}
          message={PSalert.message}
          onClose={() => setPSAlert(null)}
        />
      )}

      {/* ═══ VIDEO BACKGROUND (same as homepage hero) ═══ */}
      <div className="absolute inset-0 overflow-hidden">
        <video autoPlay muted loop playsInline className="hero-video">
          <source src={heroVideo} type="video/mp4" />
        </video>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to right, rgba(10,15,13,0.88) 0%, rgba(10,15,13,0.72) 50%, rgba(10,15,13,0.62) 100%)",
          }}
        />
      </div>

      {/* ═══ CONTENT ═══ */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* ─── Minimal top bar: brand left, quiet back link right ─── */}
        <header className="w-full">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex items-center gap-3 cursor-pointer"
              aria-label="PlantScope — go to home"
            >
              <span
                className="w-10 h-10 rounded-full overflow-hidden border flex-shrink-0 block"
                style={{ borderColor: "rgba(255,255,255,0.4)" }}
              >
                <img src={logoImg} className="w-full h-full object-cover" alt="PlantScope Logo" />
              </span>
              <span
                className="font-bold text-lg text-white leading-none"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                PlantScope
              </span>
            </button>

            <a
              href="/"
              className="back-link"
              onClick={(e) => {
                e.preventDefault();
                navigate("/");
              }}
            >
              <ArrowLeft size={16} /> Back to Home
            </a>
          </div>
        </header>

        {/* ─── Split: info left, floating glass form right ─── */}
        <main className="flex-1 flex items-center">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-10 lg:py-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* LEFT — brand narrative (hero rhythm) */}
              <div className="text-center lg:text-left">
                <div
                  className="inline-flex items-center gap-2 mb-6"
                  style={{
                    borderLeft: "2px solid #7CD56A",
                    paddingLeft: "1rem",
                    color: "rgba(255,255,255,0.55)",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                  }}
                >
                  <span>GIS-Enabled Reforestation System</span>
                </div>

                <h1
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    color: "#fff",
                    fontSize: "clamp(2.5rem, 6vw, 4.25rem)",
                    fontWeight: 400,
                    letterSpacing: "-0.03em",
                    lineHeight: 1.05,
                    marginBottom: "1.25rem",
                  }}
                >
                  Welcome Back.
                </h1>

                <p
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    fontSize: "clamp(1rem, 1.4vw, 1.15rem)",
                    lineHeight: 1.7,
                    maxWidth: "480px",
                    margin: "0 auto",
                  }}
                  className="lg:!mx-0"
                >
                  Sign in to manage reforestation data across Ormoc City — site
                  assessments, planting records, and monitoring in one platform.
                </p>

                <ul className="space-y-3 mt-8 inline-block text-left">
                  {[
                    "Scientific site prioritization with MCDA scoring",
                    "Field-validated GIS workflows for inspectors",
                    "Community tree planting program management",
                  ].map((text, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-3 text-sm"
                      style={{ color: "rgba(255,255,255,0.8)" }}
                    >
                      <CheckCircle2 size={18} color="#7CD56A" className="flex-shrink-0" />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* RIGHT — floating glass login card */}
              <div className="glass-card p-8 md:p-10 w-full max-w-md mx-auto">
                <span className="eyebrow" style={{ color: "#8FE07C" }}>
                  Sign In
                </span>
                <h2
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    color: "#fff",
                    fontSize: "1.5rem",
                    fontWeight: 600,
                    marginBottom: "0.25rem",
                  }}
                >
                  Access your dashboard
                </h2>
                <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.9rem", marginBottom: "1.75rem" }}>
                  Authorized personnel only.
                </p>

                <form onSubmit={handleLogin} className="space-y-5">
                  {/* Email */}
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium mb-1.5"
                      style={{ color: "rgba(255,255,255,0.8)" }}
                    >
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="form-input glass"
                      autoComplete="email"
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium mb-1.5"
                      style={{ color: "rgba(255,255,255,0.8)" }}
                    >
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="form-input glass pr-12"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 transition-colors"
                        style={{ color: "rgba(255,255,255,0.6)" }}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="text-black" size={20} /> : <Eye className="text-black" size={20} />}
                      </button>
                    </div>
                  </div>

                  {/* Lockout feedback */}
                  {lockoutSeconds > 0 && (
                    <div
                      className="flex items-center gap-2.5 px-4 py-3 rounded-lg"
                      style={{
                        background: "rgba(239, 68, 68, 0.12)",
                        border: "1px solid rgba(239, 68, 68, 0.35)",
                      }}
                    >
                      <Lock size={18} color="#fca5a5" className="flex-shrink-0" />
                      <span className="text-sm" style={{ color: "#fca5a5" }}>
                        Account locked — try again in{" "}
                        <strong className="tabular-nums">{lockoutSeconds}s</strong>
                      </span>
                    </div>
                  )}

                  {/* Attempts remaining feedback */}
                  {!lockoutSeconds && attemptsLeft !== null && attemptsLeft > 0 && (
                    <div
                      className="flex items-center gap-2.5 px-4 py-3 rounded-lg"
                      style={{
                        background: "rgba(245, 158, 11, 0.12)",
                        border: "1px solid rgba(245, 158, 11, 0.35)",
                      }}
                    >
                      <AlertTriangle size={18} color="#fcd34d" className="flex-shrink-0" />
                      <span className="text-sm" style={{ color: "#fcd34d" }}>
                        <strong>{attemptsLeft}</strong>{" "}
                        {attemptsLeft === 1 ? "attempt" : "attempts"} remaining before lockout
                      </span>
                    </div>
                  )}

                  {/* Primary CTA — hero button style */}
                  <button
                    type="submit"
                    disabled={lockoutSeconds > 0}
                    className="btn-minimal-primary w-full"
                    style={{
                      justifyContent: "center",
                      padding: "0.9rem 2rem",
                      fontSize: "1rem",
                      opacity: lockoutSeconds > 0 ? 0.5 : 1,
                      cursor: lockoutSeconds > 0 ? "not-allowed" : "pointer",
                      transform: lockoutSeconds > 0 ? "none" : undefined,
                    }}
                  >
                    Log In
                  </button>
                </form>

                {/* Legal micro-links */}
                <div
                  className="mt-6 pt-5 flex items-center justify-center gap-3 text-xs"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)" }}
                >
                  <a href="/privacy-policy" className="hover:text-white transition-colors">
                    Privacy Notice
                  </a>
                  <span>·</span>
                  <a href="/terms" className="hover:text-white transition-colors">
                    Terms &amp; Conditions
                  </a>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* ─── Bottom micro line ─── */}
        <footer className="pb-6 pt-2 text-center text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
          © 2026 PlantScope – Developed with 💚 for Ormoc City
        </footer>
      </div>
    </div>
  );
}