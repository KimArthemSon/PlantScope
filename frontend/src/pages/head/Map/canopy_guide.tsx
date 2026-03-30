// frontend/src/components/canopy_guide.tsx

import { X, Check, XCircle, Info } from "lucide-react";

interface CanopyGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CanopyGuideModal({
  isOpen,
  onClose,
}: CanopyGuideModalProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* ✅ FIXED: Reduced backdrop opacity to prevent black screen */}

      {/* ✅ Floating Panel - Left Middle Position */}
      <div className="fixed right-4 top-1/2 -translate-y-1/2 z-[2000] w-72 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-[#0f4a2f] text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info size={18} />
            <h2 className="font-bold text-sm">NDVI Canopy Guide</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
            aria-label="Close guide"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {/* Class 0 - Gray */}
          <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 border border-gray-200">
            <div
              className="w-10 h-10 rounded border border-gray-400 shadow-sm flex-shrink-0"
              style={{ backgroundColor: "#cccccc" }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-gray-900">Gray</span>
                <Check size={12} className="text-green-600" />
              </div>
              <p className="text-[10px] text-gray-600 truncate">
                Bare soil, concrete, rock
              </p>
              <p className="text-[9px] text-gray-500 font-mono">
                0.0 ≤ NDVI {"<"} 0.2
              </p>
            </div>
          </div>

          {/* Class 1 - Yellow */}
          <div className="flex items-center gap-3 p-2 rounded-lg bg-yellow-50 border border-yellow-200">
            <div
              className="w-10 h-10 rounded border border-yellow-400 shadow-sm flex-shrink-0"
              style={{ backgroundColor: "#f1c40f" }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-gray-900">Yellow</span>
                <Check size={12} className="text-green-600" />
              </div>
              <p className="text-[10px] text-gray-600 truncate">
                Sparse grass, shrubs
              </p>
              <p className="text-[9px] text-gray-500 font-mono">
                0.2 ≤ NDVI {"<"} 0.4
              </p>
            </div>
          </div>

          {/* Class 2 - Orange */}
          <div className="flex items-center gap-3 p-2 rounded-lg bg-orange-50 border border-orange-200 opacity-75">
            <div
              className="w-10 h-10 rounded border border-orange-400 shadow-sm flex-shrink-0"
              style={{ backgroundColor: "#e67e22" }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-gray-900">Orange</span>
                <XCircle size={12} className="text-red-600" />
              </div>
              <p className="text-[10px] text-gray-600 truncate">
                Moderate vegetation
              </p>
              <p className="text-[9px] text-gray-500 font-mono">
                0.4 ≤ NDVI {"<"} 0.6
              </p>
            </div>
          </div>

          {/* Class 3 - Green */}
          <div className="flex items-center gap-3 p-2 rounded-lg bg-green-50 border border-green-200 opacity-75">
            <div
              className="w-10 h-10 rounded border border-green-400 shadow-sm flex-shrink-0"
              style={{ backgroundColor: "#27ae60" }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-gray-900">Green</span>
                <XCircle size={12} className="text-red-600" />
              </div>
              <p className="text-[10px] text-gray-600 truncate">
                Forest, dense vegetation
              </p>
              <p className="text-[9px] text-gray-500 font-mono">NDVI ≥ 0.6</p>
            </div>
          </div>

          {/* Legend */}
          <div className="pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between text-[10px]">
              <span className="flex items-center gap-1 text-green-700">
                <Check size={12} /> Suitable for planting
              </span>
              <span className="flex items-center gap-1 text-red-700">
                <XCircle size={12} /> Not suitable
              </span>
            </div>
          </div>

          {/* Info Note */}
          <div className="bg-blue-50 border border-blue-200 rounded p-2">
            <p className="text-[9px] text-blue-800 leading-tight">
              <strong>💡 Tip:</strong> Gray & Yellow areas (NDVI {"<"} 0.4) are
              prioritized for reforestation.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
