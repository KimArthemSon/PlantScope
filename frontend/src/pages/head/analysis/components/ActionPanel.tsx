// src/pages/multicriteria/components/ActionPanel.tsx
interface Props {
  siteStatus: string;
  isFinalizable: boolean;
  isFinalizing: boolean;
  consensusNote: string;
  onConsensusNoteChange: (note: string) => void;
  onFinalize: () => Promise<boolean>;
  onAccept: () => Promise<boolean>;
  onReject: () => Promise<boolean>;
}

export default function ActionPanel({
  siteStatus,
  isFinalizable,
  isFinalizing,
  consensusNote,
  onConsensusNoteChange,
  onFinalize,
  onAccept,
  onReject
}: Props) {
  const isLocked = siteStatus === 'official' || siteStatus === 'rejected';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 className="font-semibold text-gray-800 mb-4">Final Decision</h3>
      
      {/* Consensus Note (for Finalize) */}
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

      {/* Action Buttons */}
      <div className="space-y-3">
        {/* Finalize MCDA (calculates total score) */}
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
                <span>🔒</span> Finalize Assessment & Calculate Score
              </>
            )}
          </button>
        )}

        {/* Accept / Reject (only after finalization or for overrides) */}
        <div className="flex gap-3">
          <button
            onClick={onAccept}
            disabled={isLocked && siteStatus !== 'rejected'}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold transition-all ${
              siteStatus === 'official'
                ? 'bg-emerald-100 text-emerald-700 cursor-default'
                : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md hover:shadow-lg'
            }`}
          >
            <span>✅</span> {siteStatus === 'official' ? 'Approved' : 'Accept Site'}
          </button>
          
          <button
            onClick={onReject}
            disabled={isLocked && siteStatus !== 'official'}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold transition-all ${
              siteStatus === 'rejected'
                ? 'bg-rose-100 text-rose-700 cursor-default'
                : 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-md hover:shadow-lg'
            }`}
          >
            <span>❌</span> {siteStatus === 'rejected' ? 'Rejected' : 'Reject Site'}
          </button>
        </div>
      </div>

      {/* Status Legend */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">
          Status: <code className="bg-gray-100 px-2 py-0.5 rounded">{siteStatus}</code>
          {isFinalizable && !isLocked && (
            <span className="ml-2 text-emerald-600 font-medium">• Ready to finalize</span>
          )}
        </p>
      </div>
    </div>
  );
}