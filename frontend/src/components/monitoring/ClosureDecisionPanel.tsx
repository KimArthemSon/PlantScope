import { useState } from "react";
import { CheckCircle2, XCircle, Undo2, Gavel } from "lucide-react";
import { api } from "@/constant/api";

// City ENRO Head's final decision on a Data Manager's closure recommendation.

export interface ClosureRequest {
  closure_request_id: number;
  status: "pending" | "approved" | "returned";
  recommendation: "completed" | "failed";
  recommendation_reason: string;
  requested_by: string | null;
  requested_at: string | null;
  final_outcome: "completed" | "failed" | null;
  head_notes: string | null;
  decided_by: string | null;
  decided_at: string | null;
  application: { application_id: number; title: string; status: string; group_name: string; created_at: string | null };
  site: {
    site_id: number;
    name: string;
    reforestation_area_name: string | null;
    barangay_name: string | null;
    total_area_hectares: number;
    monitoring_status: string;
  } | null;
}

export const formatClosureDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—";

export default function ClosureDecisionPanel({
  closure,
  onDone,
  onError,
}: {
  closure: ClosureRequest;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const token = localStorage.getItem("token");
  const [modal, setModal] = useState<null | { action: "approve" | "return"; outcome: "completed" | "failed" }>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const rec = closure.recommendation;
  const other = rec === "completed" ? "failed" : "completed";

  const submit = async () => {
    if (!modal) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${api}api/decide_program_closure/${closure.closure_request_id}/`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: modal.action, final_outcome: modal.outcome, notes: notes.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      setModal(null);
      setNotes("");
      onDone(data.message);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const needsNotes = modal?.action === "return" || (modal?.action === "approve" && modal.outcome !== rec);

  return (
    <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50">
      <p className="text-xs font-bold text-indigo-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <Gavel size={14} /> Final decision needed
      </p>
      <p className="text-xs text-indigo-900 leading-relaxed">
        <strong>{closure.requested_by ?? "The Data Manager"}</strong> recommends marking this program as{" "}
        <span className={`font-bold ${rec === "completed" ? "text-green-700" : "text-red-600"}`}>{rec.toUpperCase()}</span>
        {" "}({formatClosureDate(closure.requested_at)}).
      </p>
      <p className="text-xs text-gray-700 bg-white rounded-lg border border-indigo-100 p-2.5 mt-2">“{closure.recommendation_reason}”</p>

      <div className="space-y-2 mt-4">
        <button
          onClick={() => setModal({ action: "approve", outcome: rec })}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-bold transition-colors ${rec === "completed" ? "bg-green-600 hover:bg-green-700" : "bg-red-500 hover:bg-red-600"}`}
        >
          {rec === "completed" ? <CheckCircle2 size={16} /> : <XCircle size={16} />} Approve: Mark {rec === "completed" ? "Completed" : "Failed"}
        </button>
        <button
          onClick={() => setModal({ action: "approve", outcome: other })}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-gray-300 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors"
        >
          Decide differently: Mark {other === "completed" ? "Completed" : "Failed"}
        </button>
        <button
          onClick={() => setModal({ action: "return", outcome: rec })}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-amber-300 bg-white text-amber-700 text-xs font-semibold hover:bg-amber-50 transition-colors"
        >
          <Undo2 size={14} /> Return to Data Manager
        </button>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-center text-gray-800 mb-1">
              {modal.action === "return" ? "Return to Data Manager?" : `Mark program as ${modal.outcome}?`}
            </h3>
            <p className="text-sm text-center text-gray-500 mb-5">
              {modal.action === "return"
                ? "The program keeps running. The Data Manager sees your note and can recommend again."
                : `"${closure.application.title}" by ${closure.application.group_name} will end as ${modal.outcome}. The tree grower is notified. This is final.`}
            </p>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {needsNotes ? "Reason *" : "Note (optional)"}
            </label>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={modal.action === "return" ? "e.g. Wait for one more monitoring visit before closing." : "e.g. Survival rate and planted area meet the target."}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 resize-none focus:outline-none focus:border-[#0F4A2F] mb-5"
            />
            <div className="flex gap-3">
              <button onClick={() => { setModal(null); setNotes(""); }} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={submitting || (needsNotes && !notes.trim())}
                className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed ${
                  modal.action === "return" ? "bg-amber-500 hover:bg-amber-600" : modal.outcome === "completed" ? "bg-green-600 hover:bg-green-700" : "bg-red-500 hover:bg-red-600"
                }`}
              >
                {submitting ? "Processing…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
