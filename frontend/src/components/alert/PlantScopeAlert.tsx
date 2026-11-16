"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, XCircle, X } from "lucide-react";
import "../../global css/alert.css";
type AlertType = "success" | "failed" | "error";

interface PlantScopeAlertProps {
  type: AlertType;
  title: string;
  message: string;
  duration?: number; // ms, set 0 to disable auto-dismiss
  onClose?: () => void;
}

export default function PlantScopeAlert({
  type,
  title,
  message,
  duration = 3000, // app-wide default: every alert closes after 3 seconds
  onClose,
}: PlantScopeAlertProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [remaining, setRemaining] = useState(duration);

  // Keep the latest onClose without restarting the timer on every re-render
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // A new alert (different content) restarts the countdown
  useEffect(() => {
    setRemaining(duration);
    setIsVisible(true);
  }, [type, title, message, duration]);

  // Countdown, then auto-dismiss
  useEffect(() => {
    if (duration === 0 || !isVisible) return;
    if (remaining <= 0) {
      setIsVisible(false);
      const t = setTimeout(() => onCloseRef.current?.(), 300);
      return () => clearTimeout(t);
    }
    const step = 100;
    const t = setTimeout(() => setRemaining((r) => r - step), step);
    return () => clearTimeout(t);
  }, [remaining, duration, isVisible]);

  if (!isVisible) return null;

  // Base classes shared by all variants
  const baseClasses =
    "fixed top-3 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl border p-6 flex gap-4 shadow-lg transition-all duration-300";

  // Variant-specific styles
  const variant = {
    success: {
      container: "border-green-200 bg-green-50 text-green-800",
      iconBg: "bg-green-100 text-green-600",
      bar: "bg-green-500",
      animation: "animate-slideDown",
    },
    failed: {
      container: "border-amber-200 bg-amber-50 text-amber-900",
      iconBg: "bg-amber-100 text-amber-600",
      bar: "bg-amber-500",
      animation: "animate-shake",
    },
    error: {
      container: "border-red-200 bg-red-50 text-red-800",
      iconBg: "bg-red-100 text-red-600",
      bar: "bg-red-500",
      animation: "animate-shake",
    },
  }[type];

  const Icon = {
    success: CheckCircle2,
    failed: AlertCircle,
    error: XCircle,
  }[type];

  return (
    <div
      className={`
        ${baseClasses}
        ${variant.container}
        ${variant.animation}
        ${!isVisible ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0 z-1000000"}
      `
        .trim()
        .replace(/\s+/g, " ")}
    >
      {/* Icon */}
      <div
        className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${variant.iconBg}`}
      >
        <Icon className="w-7 h-7" />
      </div>

      {/* Text */}
      <div className="flex-1 pr-8">
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="text-sm opacity-90 mt-1">{message}</p>
      </div>

      {/* Countdown timer */}
      {duration > 0 && (
        <>
          <span className="absolute bottom-2.5 right-4 text-[11px] font-semibold tabular-nums opacity-60">
            {Math.max(0, Math.ceil(remaining / 1000))}s
          </span>
          <div className="absolute left-0 bottom-0 h-1 w-full overflow-hidden rounded-b-xl bg-black/5">
            <div
              className={`h-full transition-[width] duration-100 ease-linear ${variant.bar}`}
              style={{ width: `${Math.max(0, (remaining / duration) * 100)}%` }}
            />
          </div>
        </>
      )}

      {/* Close button */}
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(() => onCloseRef.current?.(), 300);
        }}
        className="absolute top-3 right-3 p-1.5 opacity-60 hover:opacity-100 hover:bg-black/5 rounded-lg transition-all"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}