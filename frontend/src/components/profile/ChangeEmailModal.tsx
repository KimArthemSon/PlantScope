import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Mail, ShieldCheck, X } from "lucide-react";
import { api } from "@/constant/api";

/**
 * Two-step email change: send a 6-digit code to the new address, then confirm it.
 * The account email only changes after the code is verified on the server.
 */
export default function ChangeEmailModal({
  currentEmail,
  onClose,
  onChanged,
}: {
  currentEmail: string;
  onClose: () => void;
  onChanged: (newEmail: string) => void;
}) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const call = async (path: string, body: object) => {
    const res = await fetch(`${api}api/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
    return data;
  };

  const sendCode = async () => {
    setError(null);
    setInfo(null);
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Enter a valid email address.");
      return;
    }
    if (value === currentEmail.toLowerCase()) {
      setError("This is already your email address.");
      return;
    }
    setBusy(true);
    try {
      const data = await call("email_change/request/", { email: value });
      setEmail(value);
      setInfo(data.message);
      setResendIn(data.resend_in ?? 60);
      setCode("");
      setStep("code");
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    setBusy(true);
    try {
      const data = await call("email_change/confirm/", { email, otp: code });
      onChanged(data.email);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              {step === "email" ? <Mail size={17} /> : <ShieldCheck size={17} />}
            </div>
            <div>
              <h3 className="font-bold text-stone-800 text-[15px]">{step === "email" ? "Change email" : "Verify your new email"}</h3>
              <p className="text-[11.5px] text-stone-400">Step {step === "email" ? 1 : 2} of 2</p>
            </div>
          </div>
          <button onClick={onClose} disabled={busy} className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {step === "email" ? (
            <>
              <p className="text-[13px] text-stone-600">
                Current email: <b className="text-stone-800">{currentEmail}</b>
              </p>
              <div>
                <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider">New email address</label>
                <input
                  type="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendCode()}
                  placeholder="name@example.com"
                  className="mt-1.5 w-full border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <p className="text-[12px] text-stone-400">We'll send a 6-digit code to the new address. Your email only changes after you enter it.</p>
            </>
          ) : (
            <>
              <p className="text-[13px] text-stone-600">
                Enter the 6-digit code sent to <b className="text-stone-800">{email}</b>. It expires in 10 minutes.
              </p>
              <input
                ref={codeRef}
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && confirm()}
                placeholder="••••••"
                className="w-full text-center tracking-[0.6em] text-2xl font-bold border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              <div className="flex items-center justify-between text-[12.5px]">
                <button
                  onClick={() => {
                    setStep("email");
                    setError(null);
                    setInfo(null);
                  }}
                  disabled={busy}
                  className="flex items-center gap-1 text-stone-500 hover:text-stone-700"
                >
                  <ArrowLeft size={13} /> Use a different email
                </button>
                <button onClick={sendCode} disabled={busy || resendIn > 0} className="font-semibold text-emerald-700 disabled:text-stone-400">
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
                </button>
              </div>
            </>
          )}

          {info && !error && <p className="text-[12.5px] text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{info}</p>}
          {error && <p className="text-[12.5px] text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 bg-stone-50 border-t border-stone-100">
          <button onClick={onClose} disabled={busy} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-stone-600 hover:bg-stone-100">
            Cancel
          </button>
          <button
            onClick={step === "email" ? sendCode : confirm}
            disabled={busy}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F4A2F] text-white text-sm font-semibold hover:bg-[#1a6b44] disabled:opacity-60"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            {step === "email" ? "Send code" : "Verify & update"}
          </button>
        </div>
      </div>
    </div>
  );
}
