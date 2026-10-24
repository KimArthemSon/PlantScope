import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Mail, ShieldCheck, KeyRound, Check, Circle } from "lucide-react";

import "@/global css/login.css";
import "@/assets/homepage/homepage.css";
import logoImg from "@/assets/homepage/logo.jpg";
import heroVideo from "@/assets/homepage/hero.mp4";
import { api } from "@/constant/api.ts";
import PlantScopeAlert from "../../components/alert/PlantScopeAlert";
import PlantScopeLoader from "../../components/alert/PlantScopeLoader";

type Step = "email" | "code" | "password";
type AlertState = { type: "success" | "failed" | "error"; title: string; message: string } | null;

const formatWait = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.ceil((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

async function postJson(path: string, body: object) {
  const res = await fetch(api + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, platform: "web" }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState>(null);
  const [cooldown, setCooldown] = useState(0);
  const [requestsLeft, setRequestsLeft] = useState<number | null>(null);
  const [limitWait, setLimitWait] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const rules = [
    { met: password.length >= 8, text: "At least 8 characters" },
    { met: /[A-Z]/.test(password), text: "One uppercase letter" },
    { met: /[a-z]/.test(password), text: "One lowercase letter" },
    { met: /\d/.test(password), text: "One number" },
    { met: /[^A-Za-z0-9]/.test(password), text: "One special character" },
  ];

  const sendCode = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setAlert({ type: "failed", title: "Invalid Email", message: "Please enter a valid email address." });
      return;
    }
    setIsLoading(true);
    try {
      const { ok, data } = await postJson("api/password_reset/request/", { email: email.trim() });
      if (data.requests_left !== undefined) setRequestsLeft(data.requests_left);
      if (ok) {
        setCode("");
        setCooldown(data.cooldown ?? 60);
        setStep("code");
        setAlert({ type: "success", title: "Code Sent", message: data.message });
      } else {
        if (data.limit_reached) setLimitWait(data.retry_after ?? 0);
        else if (data.retry_after) setCooldown(data.retry_after);
        setAlert({ type: "failed", title: "Request Failed", message: data.error || "Could not send the code." });
      }
    } catch {
      setAlert({ type: "error", title: "Error", message: "Cannot reach the server. Please try again later." });
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = async () => {
    if (code.length !== 6) {
      setAlert({ type: "failed", title: "Invalid Code", message: "Enter the 6-digit code from your email." });
      return;
    }
    setIsLoading(true);
    try {
      const { ok, data } = await postJson("api/password_reset/verify/", { email: email.trim(), code });
      if (ok) {
        setResetToken(data.reset_token);
        setStep("password");
      } else {
        setAlert({ type: "failed", title: "Verification Failed", message: data.error || "Incorrect code." });
      }
    } catch {
      setAlert({ type: "error", title: "Error", message: "Cannot reach the server. Please try again later." });
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!rules.every((r) => r.met)) {
      setAlert({ type: "failed", title: "Weak Password", message: "Your password doesn't meet all the requirements." });
      return;
    }
    if (password !== confirmPassword) {
      setAlert({ type: "failed", title: "Passwords Don't Match", message: "Please re-enter the same password." });
      return;
    }
    setIsLoading(true);
    try {
      const { ok, data } = await postJson("api/password_reset/confirm/", {
        email: email.trim(),
        reset_token: resetToken,
        new_password: password,
      });
      if (ok) {
        setAlert({ type: "success", title: "Password Reset", message: "Redirecting to login..." });
        setTimeout(() => navigate("/Login"), 2000);
      } else {
        setAlert({ type: "failed", title: "Reset Failed", message: data.error || "Please try again." });
        if (/expired/i.test(data.error || "")) setStep("email");
      }
    } catch {
      setAlert({ type: "error", title: "Error", message: "Cannot reach the server. Please try again later." });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (step === "email") sendCode();
    else if (step === "code") verifyCode();
    else resetPassword();
  };

  const labelStyle = { color: "rgba(255,255,255,0.8)" };
  const mutedStyle = { color: "rgba(255,255,255,0.55)", fontSize: "0.9rem" };
  const heading = {
    email: { icon: <Mail size={22} color="#8FE07C" />, title: "Forgot your password?", text: "Enter your account email and we'll send you a 6-digit code." },
    code: { icon: <ShieldCheck size={22} color="#8FE07C" />, title: "Check your email", text: `We sent a code to ${email.trim()}. It expires in 10 minutes.` },
    password: { icon: <KeyRound size={22} color="#8FE07C" />, title: "Set a new password", text: "Choose a strong password you haven't used before." },
  }[step];

  const submitDisabled = step === "email" && (limitWait > 0 || cooldown > 0);

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: "#0A0F0D" }}>
      {isLoading && <PlantScopeLoader />}
      {alert && <PlantScopeAlert {...alert} onClose={() => setAlert(null)} />}

      <div className="absolute inset-0 overflow-hidden">
        <video autoPlay muted loop playsInline className="hero-video">
          <source src={heroVideo} type="video/mp4" />
        </video>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to right, rgba(10,15,13,0.88) 0%, rgba(10,15,13,0.72) 50%, rgba(10,15,13,0.62) 100%)",
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="w-full">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
            <button type="button" onClick={() => navigate("/")} className="flex items-center gap-3 cursor-pointer">
              <span className="w-10 h-10 rounded-full overflow-hidden border flex-shrink-0 block" style={{ borderColor: "rgba(255,255,255,0.4)" }}>
                <img src={logoImg} className="w-full h-full object-cover" alt="PlantScope Logo" />
              </span>
              <span className="font-bold text-lg text-white leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                PlantScope
              </span>
            </button>
            <a
              href="/Login"
              className="back-link"
              onClick={(e) => {
                e.preventDefault();
                navigate("/Login");
              }}
            >
              <ArrowLeft size={16} /> Back to Login
            </a>
          </div>
        </header>

        <main className="flex-1 flex items-center">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-10">
            <div className="glass-card p-8 md:p-10 w-full max-w-md mx-auto">
              <span className="eyebrow" style={{ color: "#8FE07C" }}>
                Step {step === "email" ? 1 : step === "code" ? 2 : 3} of 3
              </span>
              <div className="flex items-center gap-2 mb-1">
                {heading.icon}
                <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#fff", fontSize: "1.5rem", fontWeight: 600 }}>
                  {heading.title}
                </h2>
              </div>
              <p style={{ ...mutedStyle, marginBottom: "1.75rem" }}>{heading.text}</p>

              <form onSubmit={onSubmit} className="space-y-5">
                {step === "email" && (
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-1.5" style={labelStyle}>
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setLimitWait(0);
                        setRequestsLeft(null);
                      }}
                      className="form-input glass"
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                )}

                {step === "code" && (
                  <div>
                    <label htmlFor="code" className="block text-sm font-medium mb-1.5" style={labelStyle}>
                      Verification code
                    </label>
                    <input
                      id="code"
                      inputMode="numeric"
                      placeholder="000000"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      className="form-input glass text-center tracking-[0.5em] text-lg"
                      autoComplete="one-time-code"
                      autoFocus
                    />
                  </div>
                )}

                {step === "password" && (
                  <>
                    <div>
                      <label htmlFor="new-password" className="block text-sm font-medium mb-1.5" style={labelStyle}>
                        New password
                      </label>
                      <div className="relative">
                        <input
                          id="new-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter new password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="form-input glass pr-12"
                          autoComplete="new-password"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="text-black" size={20} /> : <Eye className="text-black" size={20} />}
                        </button>
                      </div>
                      <ul className="mt-3 space-y-1">
                        {rules.map((r) => (
                          <li key={r.text} className="flex items-center gap-2 text-xs" style={{ color: r.met ? "#8FE07C" : "rgba(255,255,255,0.5)" }}>
                            {r.met ? <Check size={14} /> : <Circle size={14} />} {r.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <label htmlFor="confirm-password" className="block text-sm font-medium mb-1.5" style={labelStyle}>
                        Confirm new password
                      </label>
                      <input
                        id="confirm-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Re-enter new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="form-input glass"
                        autoComplete="new-password"
                      />
                    </div>
                  </>
                )}

                {step === "email" && limitWait > 0 && (
                  <div
                    className="text-sm px-4 py-3 rounded-lg"
                    style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", color: "#fca5a5" }}
                  >
                    Daily limit reached. You can request another code in about {formatWait(limitWait)}.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitDisabled}
                  className="btn-minimal-primary w-full"
                  style={{
                    justifyContent: "center",
                    padding: "0.9rem 2rem",
                    fontSize: "1rem",
                    opacity: submitDisabled ? 0.5 : 1,
                    cursor: submitDisabled ? "not-allowed" : "pointer",
                  }}
                >
                  {step === "email"
                    ? cooldown > 0 && limitWait === 0
                      ? `Send code (${cooldown}s)`
                      : "Send code"
                    : step === "code"
                      ? "Verify code"
                      : "Reset password"}
                </button>
              </form>

              {step === "code" && (
                <div className="mt-5 text-center text-sm" style={mutedStyle}>
                  Didn't get it?{" "}
                  {requestsLeft === 0 ? (
                    <span>No more codes left today.</span>
                  ) : cooldown > 0 ? (
                    <span>Resend in {cooldown}s</span>
                  ) : (
                    <button type="button" onClick={sendCode} className="font-semibold hover:underline" style={{ color: "#8FE07C" }}>
                      Resend code
                    </button>
                  )}
                  {requestsLeft !== null && requestsLeft > 0 && (
                    <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {requestsLeft} {requestsLeft === 1 ? "request" : "requests"} left today
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setStep("email")}
                    className="block mx-auto mt-3 text-xs hover:underline"
                    style={{ color: "rgba(255,255,255,0.6)" }}
                  >
                    Use a different email
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>

        <footer className="pb-6 pt-2 text-center text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
          © 2026 PlantScope – Developed with 💚 for Ormoc City
        </footer>
      </div>
    </div>
  );
}
