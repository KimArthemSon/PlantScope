"use client";

import { useEffect, useState } from "react";
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
  duration = 5000,
  onClose,
}: PlantScopeAlertProps) {
  const [isVisible, setIsVisible] = useState(true);

  // Auto-dismiss
  useEffect(() => {
    if (duration === 0) return;
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose?.(), 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  // Base classes shared by all variants
  const baseClasses =
    "fixed top-3 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl border p-5 flex gap-4 shadow-lg transition-all duration-300";

  // Variant-specific styles
  const variant = {
    success: {
      container: "border-green-200 bg-green-50 text-green-800",
      iconBg: "bg-green-100 text-green-600",
      animation: "animate-slideDown",
    },
    failed: {
      container: "border-amber-200 bg-amber-50 text-amber-900",
      iconBg: "bg-amber-100 text-amber-600",
      animation: "animate-shake",
    },
    error: {
      container: "border-red-200 bg-red-50 text-red-800",
      iconBg: "bg-red-100 text-red-600",
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
        ${!isVisible ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0 z-1000"}
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
      <div className="flex-1">
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="text-sm opacity-90 mt-1">{message}</p>
      </div>

      {/* Close button */}
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(() => onClose?.(), 300);
        }}
        className="absolute top-4 right-4 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
