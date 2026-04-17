import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { api } from "@/constants/url_fixed";
import {
  Edit3,
  Trash2,
  Eye,
  PlusCircle,
  CheckCircle,
  AlertCircle,
  Database, // ✅ Icon for Meta Data
} from "lucide-react-native";

const API_BASE = api;

type Assessment = {
  field_assessment_id: number;
  reforestation_area_id: number;
  reforestation_area_name: string;
  // ✅ Updated: Added "meta_data" to union type
  layer: "safety" | "boundary_verification" | "survivability" | "meta_data";
  layer_display: string;
  assessment_date: string | null;
  location: {
    latitude: number;
    longitude: number;
    gps_accuracy_meters?: number;
  } | null;
  is_submitted: boolean;
  image_count: number;
  created_at: string;
  updated_at: string;
};

// ✅ Helper: Get correct form path based on layer
const getFormPath = (layerId: string) => {
  // console.log("asdas");
  if (layerId === "meta_data") {
    return "/feedbacks/meta_data_form"; // ✅ Dedicated Meta Data form
  }
  return "/feedbacks/multicriteria_layer_form"; // ✅ MCDA forms for other layers
};

export default function LayerAssessmentList() {
  const { areaId, areaName, layerId, layerName } = useLocalSearchParams<{
    areaId: string;
    areaName: string;
    // ✅ Updated: Added "meta_data" to type-safe layer IDs
    layerId: "safety" | "boundary_verification" | "survivability" | "meta_data";
    layerName: string;
  }>();

  const router = useRouter();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAssessments = async () => {
    try {
      const token = await SecureStore.getItemAsync("token");
      const url = `${API_BASE}/api/field_assessments/?reforestation_area_id=${areaId}&layer=${layerId}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setAssessments(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error("Fetch assessments error:", error);
      Alert.alert("Error", error.message || "Could not load assessments");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAssessments();
  }, [areaId, layerId]);

  const handleDelete = async (id: number) => {
    Alert.alert("Confirm Delete", "Delete this draft? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await SecureStore.getItemAsync("token");
            const res = await fetch(
              `${API_BASE}/api/field_assessments/${id}/delete/`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              },
            );
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.error || `HTTP ${res.status}`);
            }
            Alert.alert("Success", "Assessment deleted");
            fetchAssessments();
          } catch (e: any) {
            console.error("Delete error:", e);
            Alert.alert("Error", e.message || "Failed to delete");
          }
        },
      },
    ]);
  };

  const handleCreateNew = () => {
    const formPath = getFormPath(layerId); // ✅ Dynamic routing

    // ✅ Meta Data form doesn't need layer params in same way
    if (layerId === "meta_data") {
      router.push({
        pathname: formPath,
        params: {
          areaId,
          isEdit: "false",
          assessmentId: undefined,
        },
      });
    } else {
      // ✅ MCDA layers keep existing param structure
      router.push({
        pathname: formPath,
        params: {
          areaId,
          layerId,
          layerName,
          isEdit: "false",
          assessmentId: undefined,
        },
      });
    }
  };

  const handleEdit = (assessment: Assessment) => {
    const formPath = getFormPath(assessment.layer);

    if (assessment.layer === "meta_data") {
      router.push({
        pathname: formPath,
        params: {
          areaId,
          id: assessment.field_assessment_id.toString(), // ✅ Meta Data form uses 'id'
          isEdit: "true",
        },
      });
    } else {
      router.push({
        pathname: formPath,
        params: {
          areaId,
          layerId: assessment.layer,
          layerName: assessment.layer_display,
          assessmentId: assessment.field_assessment_id.toString(),
          isEdit: "true",
        },
      });
    }
  };

  const handleView = (assessment: Assessment) => {
    const formPath = getFormPath(assessment.layer);

    if (assessment.layer === "meta_data") {
      router.push({
        pathname: formPath,
        params: {
          areaId,
          id: assessment.field_assessment_id.toString(),
          isEdit: "false",
        },
      });
    } else {
      router.push({
        pathname: formPath,
        params: {
          areaId,
          layerId: assessment.layer,
          layerName: assessment.layer_display,
          assessmentId: assessment.field_assessment_id.toString(),
          isEdit: "false",
        },
      });
    }
  };

  const renderItem = ({ item }: { item: Assessment }) => {
    const isSubmitted = item.is_submitted;
    const hasLocation =
      item.location && item.location.latitude && item.location.longitude;

    return (
      <View
        style={[
          styles.card,
          isSubmitted ? styles.submittedCard : styles.draftCard,
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.badge,
                { backgroundColor: isSubmitted ? "#dcfce7" : "#fef3c7" },
              ]}
            >
              {isSubmitted ? (
                <CheckCircle size={12} color="#155724" />
              ) : (
                <Edit3 size={12} color="#856404" />
              )}
              <Text
                style={[
                  styles.badgeText,
                  { color: isSubmitted ? "#155724" : "#856404" },
                ]}
              >
                {isSubmitted ? "SUBMITTED" : "DRAFT"}
              </Text>
            </View>
          </View>
          <Text style={styles.dateText}>
            {item.assessment_date
              ? new Date(item.assessment_date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : "Date not set"}
          </Text>
        </View>

        {hasLocation ? (
          <Text style={styles.locationText}>
            📍 {item.location!.latitude.toFixed(4)},{" "}
            {item.location!.longitude.toFixed(4)}
            {item.location!.gps_accuracy_meters
              ? ` (±${item.location!.gps_accuracy_meters}m)`
              : ""}
          </Text>
        ) : (
          <Text style={styles.noLocationText}>
            📍 No GPS — GIS Specialist will assign location
          </Text>
        )}

        {item.image_count > 0 && (
          <Text style={styles.imageCountText}>
            🖼 {item.image_count} photo{item.image_count > 1 ? "s" : ""}{" "}
            attached
          </Text>
        )}

        <Text style={styles.metaText}>
          {`Created: ${new Date(item.created_at).toLocaleDateString()}${
            isSubmitted
              ? `  •  Submitted: ${new Date(item.updated_at).toLocaleDateString()}`
              : ""
          }`}
        </Text>

        <View style={styles.actions}>
          {isSubmitted ? (
            <TouchableOpacity
              style={styles.btnView}
              onPress={() => handleView(item)}
            >
              <Eye size={16} color="#0F4A2F" />
              <Text style={styles.btnViewText}>View</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={styles.btnEdit}
                onPress={() => handleEdit(item)}
              >
                <Edit3 size={16} color="#0F4A2F" />
                <Text style={styles.btnEditText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnDelete}
                onPress={() => handleDelete(item.field_assessment_id)}
              >
                <Trash2 size={16} color="#721c24" />
                <Text style={styles.btnDeleteText}>Delete</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  const drafts = assessments.filter((a) => !a.is_submitted);
  const submitted = assessments.filter((a) => a.is_submitted);

  if (loading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color="#0F4A2F" />
        <Text style={styles.loadingText}>
          Loading {layerName} assessments...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.areaName}>{areaName}</Text>
          <Text style={styles.layerName}>
            {layerName} Layer
            <Text style={styles.layerIdBadge}>[{layerId}]</Text>
          </Text>
        </View>
        <TouchableOpacity style={styles.createBtn} onPress={handleCreateNew}>
          <PlusCircle size={18} color="#fff" />
          <Text style={styles.createBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{drafts.length}</Text>
          <Text style={styles.statLabel}>Drafts</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{submitted.length}</Text>
          <Text style={styles.statLabel}>Submitted</Text>
        </View>
      </View>

      <FlatList
        data={[...drafts, ...submitted]}
        keyExtractor={(item) => item.field_assessment_id.toString()}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchAssessments();
            }}
            tintColor="#0F4A2F"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {/* ✅ Show Meta Data icon for meta_data layer */}
            {layerId === "meta_data" ? (
              <Database
                size={48}
                color="#8b5cf6"
                style={{ marginBottom: 12 }}
              />
            ) : (
              <AlertCircle
                size={48}
                color="#94a3b8"
                style={{ marginBottom: 12 }}
              />
            )}
            <Text style={styles.emptyText}>No {layerName} assessments yet</Text>
            <Text style={styles.emptySubtext}>
              Tap "New" to start your first {layerName.toLowerCase()} assessment
              for this site.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={handleCreateNew}>
              <PlusCircle size={18} color="#fff" />
              <Text style={styles.emptyBtnText}>Create First Assessment</Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={<View style={{ height: 20 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, color: "#64748b" },
  header: {
    backgroundColor: "#fff",
    padding: 16,
    paddingTop: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerLeft: { flex: 1 },
  areaName: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  layerName: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  layerIdBadge: {
    fontSize: 10,
    color: "#94a3b8",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: "600",
  },
  createBtn: {
    backgroundColor: "#0F4A2F",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  createBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  statsBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    margin: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  stat: { alignItems: "center", flex: 1 },
  statNumber: { fontSize: 24, fontWeight: "bold", color: "#0F4A2F" },
  statLabel: { fontSize: 12, color: "#64748b", marginTop: 2 },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#e2e8f0",
    marginHorizontal: 16,
  },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  draftCard: { borderLeftWidth: 4, borderLeftColor: "#fbbf24" },
  submittedCard: { borderLeftWidth: 4, borderLeftColor: "#22c55e" },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  badgeRow: { flexDirection: "row", gap: 6 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  badgeText: { fontWeight: "700", fontSize: 10 },
  dateText: { fontSize: 12, color: "#64748b" },
  locationText: { fontSize: 12, color: "#0F4A2F", marginBottom: 4 },
  noLocationText: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 4,
    fontStyle: "italic",
  },
  imageCountText: { fontSize: 12, color: "#64748b", marginBottom: 4 },
  metaText: { fontSize: 11, color: "#94a3b8", marginBottom: 12 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  btnView: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  btnViewText: { color: "#0F4A2F", fontWeight: "600", fontSize: 13 },
  btnEdit: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  btnEditText: { color: "#0F4A2F", fontWeight: "600", fontSize: 13 },
  btnDelete: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  btnDeleteText: { color: "#721c24", fontWeight: "600", fontSize: 13 },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    backgroundColor: "#f8fafc",
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    borderStyle: "dashed",
  },
  emptyText: {
    color: "#334155",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubtext: {
    color: "#64748b",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F4A2F",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  emptyBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
});
