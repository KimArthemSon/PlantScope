// src/pages/multicriteria/components/ActionPanel.tsx
import type { SiteStatus } from '../types/mcda';

interface Props {
  siteStatus: SiteStatus;
  isFinalizable: boolean;
  isFinalizing: boolean;
  consensusNote: string;
  finalStatus: "accepted" | "rejected" | "completed";
  onConsensusNoteChange: (note: string) => void;
  onFinalStatusChange: (status: "accepted" | "rejected" | "completed") => void;
  onFinalize: () => Promise<boolean>;
}

export default function ActionPanel({
  siteStatus,
  isFinalizable,
  isFinalizing,
  consensusNote,
  finalStatus,
  onConsensusNoteChange,
  onFinalStatusChange,
  onFinalize,
}: Props) {
  const isLocked = siteStatus === 'accepted' || siteStatus === 'rejected' || siteStatus === 'completed';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 className="font-semibold text-gray-800 mb-4">Final Decision</h3>
      
      {/* Consensus Note (for Finalization) */}
      {!isLocked && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Consensus Notes (Required for Finalization)
          </label>
          <textarea
            value={consensusNote}
            onChange={(e) => onConsensusNoteChange(e.target.value)}
            placeholder="Document the team's decision rationale, key considerations, and any conditions..."
            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
            rows={3}
          />
        </div>
      )}

      {/* Final Status Selection */}
      {!isLocked && isFinalizable && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Final Site Status
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: "accepted", label: "✅ Accepted", desc: "Proceed to planting" },
              { value: "rejected", label: "❌ Rejected", desc: "Return for revision" },
              { value: "completed", label: "🎯 Completed", desc: "Monitoring phase" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onFinalStatusChange(option.value as any)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  finalStatus === option.value
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="font-medium text-gray-800 block">{option.label}</span>
                <span className="text-xs text-gray-500">{option.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        {/* Finalize MCDA (v2.0: locks version, no scoring) */}
        {!isLocked && (
          <button
            onClick={onFinalize}
            disabled={!isFinalizable || isFinalizing || !consensusNote.trim()}
            className={`w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold transition-all ${
              isFinalizable && consensusNote.trim() && !isFinalizing
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md hover:shadow-lg'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isFinalizing ? (
              <>
                <span className="animate-spin">⏳</span> Finalizing...
              </>
            ) : (
              <>
                <span>🔒</span> Finalize Assessment & Lock Record
              </>
            )}
          </button>
        )}

        {/* Status Update Buttons (if already finalized) */}
        {isLocked && (
          <div className="p-4 bg-gray-50 rounded-xl text-center">
            <p className="text-sm text-gray-600">
              Assessment finalized • Status:{" "}
              <code className="bg-white px-2 py-0.5 rounded border">{siteStatus}</code>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              To modify, create a new assessment version (re-analysis)
            </p>
          </div>
        )}
      </div>

      {/* Validation Checklist */}
      {!isLocked && (
        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">
            {isFinalizable 
              ? "✅ All 8 layers validated • Ready to finalize" 
              : `⏳ ${8 - (isFinalizable ? 8 : 0)} layers pending validation`}
          </p>
        </div>
      )}
    </div>
  );
}