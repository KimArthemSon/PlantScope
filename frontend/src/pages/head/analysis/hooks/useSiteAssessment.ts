// src/pages/multicriteria/hooks/useSiteAssessment.ts
import { useState, useCallback, useEffect } from "react";
import type { 
  LayerKey, 
  LeaderDecision, 
  SiteData, 
  Notification,
  LayerValidation,
} from "../types/mcda";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

export function useSiteAssessment(siteId: number | undefined) {
  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingLayer, setSubmittingLayer] = useState<LayerKey | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);

  const showNotification = useCallback(
    (message: string, type: Notification["type"], duration = 3000) => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), duration);
    },
    [],
  );

  const fetchSiteData = useCallback(async () => {
    if (!siteId) return;
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/get_site/${siteId}/`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const json = await response.json();
      if (response.ok) {
        setSiteData(json.data);
      } else {
        showNotification(json.error || "Failed to load site", "error");
      }
    } catch (error) {
      showNotification("Network error while loading site", "error");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [siteId, showNotification]);

  // ✅ LEADER ONLY: Validate layer with ACCEPT/REJECT
  const submitLeaderValidation = useCallback(
    async (
      layer: LayerKey,
      finalAgreedData: Record<string, any>,
      leaderDecision: LeaderDecision,
      leaderComment?: string,
      additionalNote?: string,
    ) => {
      if (!siteId) return false;
      try {
        setSubmittingLayer(layer);
        const response = await fetch(
          `${API_BASE}/submit_leader_validation/${siteId}/${layer}/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({
              final_agreed: finalAgreedData,
              leader_decision: leaderDecision,
              leader_comment: leaderComment || "",
              additional_documentation_note: additionalNote || "",
            }),
          },
        );
        const json = await response.json();
        if (response.ok) {
          await fetchSiteData();
          showNotification(
            `✅ ${layer.replace("_", " ").toUpperCase()} validated as ${leaderDecision}`,
            "success",
          );
          return true;
        } else {
          showNotification(json.error || "Validation failed", "error");
          return false;
        }
      } catch (error) {
        showNotification("Network error during validation", "error");
        console.error(error);
        return false;
      } finally {
        setSubmittingLayer(null);
      }
    },
    [siteId, fetchSiteData, showNotification],
  );

  const finalizeSite = useCallback(
    async (consensusNote: string, finalStatus: "accepted" | "rejected" | "completed") => {
      if (!siteId) return false;
      try {
        setFinalizing(true);
        const response = await fetch(
          `${API_BASE}/finalize_site_mcda/${siteId}/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({ 
              consensus_note: consensusNote,
              final_status: finalStatus,
              validated_by: "Project Leader",
            }),
          },
        );
        const json = await response.json();
        if (response.ok) {
          await fetchSiteData();
          showNotification("🎉 Site assessment finalized and locked!", "success", 5000);
          return true;
        } else {
          showNotification(json.error || "Finalization failed", "error");
          return false;
        }
      } catch (error) {
        showNotification("Network error during finalization", "error");
        console.error(error);
        return false;
      } finally {
        setFinalizing(false);
      }
    },
    [siteId, fetchSiteData, showNotification],
  );

  const updateSiteStatus = useCallback(
    async (newStatus: "accepted" | "rejected" | "completed" | "under_review") => {
      if (!siteId) return false;
      try {
        const response = await fetch(
          `${API_BASE}/update_site/${siteId}/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({ status: newStatus }),
          },
        );
        const json = await response.json();
        if (response.ok) {
          if (siteData) {
            setSiteData({ ...siteData, status: newStatus });
          }
          showNotification(`Site status updated to ${newStatus}`, "success");
          return true;
        } else {
          showNotification(json.error || "Status update failed", "error");
          return false;
        }
      } catch (error) {
        showNotification("Network error updating status", "error");
        return false;
      }
    },
    [siteId, siteData, showNotification],
  );

  const isLayerValidated = useCallback(
    (layer: LayerKey): boolean => {
      return !!(siteData?.validated_mcda_data?.[layer]?.leader_decision);
    },
    [siteData],
  );

  const getLayerStatus = useCallback(
    (layer: LayerKey): { label: string; className: string } => {
      const validated = siteData?.validated_mcda_data?.[layer];
      
      if (!validated) {
        const hasRaw = siteData?.raw_field_assessment?.[layer];
        return hasRaw 
          ? { label: "📝 Inspector Submitted", className: "bg-blue-100 text-blue-700 border-blue-200" }
          : { label: "⏳ Not Started", className: "bg-gray-100 text-gray-600 border-gray-200" };
      }

      if (validated.leader_decision === "ACCEPT") {
        return { label: "✅ Accepted", className: "bg-emerald-100 text-emerald-700 border-emerald-200" };
      }
      if (validated.leader_decision === "REJECT") {
        return { label: "❌ Rejected", className: "bg-rose-100 text-rose-700 border-rose-200" };
      }
      return { label: "📋 Pending Review", className: "bg-amber-100 text-amber-700 border-amber-200" };
    },
    [siteData],
  );

  const getValidationProgress = useCallback(() => {
    if (!siteData?.validated_mcda_data) return { validated: 0, total: 8, rejected: 0 };
    
    const layers = Object.keys(siteData.validated_mcda_data) as LayerKey[];
    const validated = layers.filter(l => siteData.validated_mcda_data?.[l]?.leader_decision).length;
    const rejected = layers.filter(l => siteData.validated_mcda_data?.[l]?.leader_decision === "REJECT").length;
    
    return { validated, total: 8, rejected };
  }, [siteData]);

  useEffect(() => {
    if (siteId) fetchSiteData();
  }, [siteId, fetchSiteData]);

  return {
    siteData,
    loading,
    submittingLayer,
    finalizing,
    notification,
    fetchSiteData,
    submitLeaderValidation,   // ✅ LEADER ONLY
    finalizeSite,
    updateSiteStatus,
    isLayerValidated,
    getLayerStatus,
    getValidationProgress,
  };
}