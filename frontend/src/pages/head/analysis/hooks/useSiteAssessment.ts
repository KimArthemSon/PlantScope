// src/pages/multicriteria/hooks/useSiteAssessment.ts
import { useState, useCallback } from "react";
import type { LayerKey, LayerData, SiteData, Notification } from "../types/mcda";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export function useSiteAssessment(siteId: number | undefined) {
  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingLayer, setSubmittingLayer] = useState<LayerKey | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);

  // Show toast notification
  const showNotification = useCallback(
    (message: string, type: Notification["type"], duration = 3000) => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), duration);
    },
    [],
  );

  // Fetch site data with MCDA info
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

  // Submit finalized layer data (Leader input)
  const submitLayer = useCallback(
    async (
      layer: LayerKey,
      finalAgreedData: Record<string, any>,
      leaderComment?: string,
    ) => {
      if (!siteId) return false;
      try {
        setSubmittingLayer(layer);
        const response = await fetch(
          `${API_BASE}/submit_mcda_layer/${siteId}/${layer}/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({
              final_agreed_data: finalAgreedData,
              leader_comment: leaderComment || "",
            }),
          },
        );
        const json = await response.json();
        if (response.ok) {
          // Refresh site data to get updated results
          await fetchSiteData();
          showNotification(
            `✅ ${layer.replace("_", " ").toUpperCase()} submitted`,
            "success",
          );
          return true;
        } else {
          showNotification(json.error || "Submission failed", "error");
          return false;
        }
      } catch (error) {
        showNotification("Network error during submission", "error");
        console.error(error);
        return false;
      } finally {
        setSubmittingLayer(null);
      }
    },
    [siteId, fetchSiteData, showNotification],
  );

  // Finalize entire site MCDA
  const finalizeSite = useCallback(
    async (consensusNote: string) => {
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
            body: JSON.stringify({ consensus_note: consensusNote }),
          },
        );
        const json = await response.json();
        if (response.ok) {
          await fetchSiteData();
          showNotification("🎉 Site MCDA finalized!", "success", 5000);
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

  // Update site status (Accept/Reject)
  const updateSiteStatus = useCallback(
    async (newStatus: "official" | "rejected" | "pending_approval") => {
      if (!siteId) return false;
      try {
        const response = await fetch(
          `${API_BASE}/update_site_status/${siteId}/`,
          {
            method: "PUT",
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

  // Helper: Get layer status badge info
  const getLayerStatus = useCallback(
    (layer: LayerKey): { label: string; className: string } => {
      if (!siteData?.mcda_data?.layers?.[layer]) {
        return {
          label: "Not Started",
          className: "bg-gray-100 text-gray-600 border-gray-200",
        };
      }
      const verdict = siteData.mcda_data.layers[layer]?.result?.verdict;
      const critical = siteData.mcda_data.layers[layer]?.result?.critical_flag;

      if (critical)
        return {
          label: "⚠️ Veto",
          className: "bg-red-100 text-red-700 border-red-200",
        };

      switch (verdict) {
        case "PASS":
        case "HIGHLY_SUITABLE":
        case "OPTIMIZED":
          return {
            label: "✅ Pass",
            className: "bg-emerald-100 text-emerald-700 border-emerald-200",
          };
        case "PASS_WITH_MITIGATION":
          return {
            label: "⚡ Mitigation",
            className: "bg-amber-100 text-amber-700 border-amber-200",
          };
        case "WARNING":
          return {
            label: "⚠️ Warning",
            className: "bg-orange-100 text-orange-700 border-orange-200",
          };
        case "FAIL":
        case "AUTO_REJECT":
          return {
            label: "❌ Fail",
            className: "bg-rose-100 text-rose-700 border-rose-200",
          };
        default:
          return {
            label: "📝 Submitted",
            className: "bg-blue-100 text-blue-700 border-blue-200",
          };
      }
    },
    [siteData],
  );

  // Auto-fetch on mount
  useState(() => {
    if (siteId) fetchSiteData();
  });

  return {
    siteData,
    loading,
    submittingLayer,
    finalizing,
    notification,
    fetchSiteData,
    submitLayer,
    finalizeSite,
    updateSiteStatus,
    getLayerStatus,
  };
}
