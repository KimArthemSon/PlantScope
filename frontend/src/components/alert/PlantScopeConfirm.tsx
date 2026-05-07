import { AlertTriangle, Trash2, RotateCcw, X } from "lucide-react";

type ConfirmVariant = "danger" | "warning";

interface PlantScopeConfirmProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

export default function PlantScopeConfirm({
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
}: PlantScopeConfirmProps) {
  const styles: Record<ConfirmVariant, { icon: any; iconBg: string; iconColor: string; confirmBtn: string }> = {
    danger: {
      icon: Trash2,
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      confirmBtn: "bg-red-600 hover:bg-red-700 text-white",
    },
    warning: {
      icon: RotateCcw,
      iconBg: "bg-yellow-100",
      iconColor: "text-yellow-600",
      confirmBtn: "bg-yellow-500 hover:bg-yellow-600 text-white",
    },
  };

  const { icon: Icon, iconBg, iconColor, confirmBtn } = styles[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-sm mx-4 overflow-hidden animate-slideDown">
        {/* Header */}
        <div className="flex items-center gap-4 p-6 pb-4">
          <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${iconBg}`}>
            <Icon className={`w-6 h-6 ${iconColor}`} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 text-base">{title}</h3>
            <p className="text-sm text-gray-500 mt-0.5">{message}</p>
          </div>
          <button
            onClick={onCancel}
            className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100" />

        {/* Actions */}
        <div className="flex gap-3 p-4">
          <button
            onClick={onCancel}
            className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-colors shadow-sm ${confirmBtn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
