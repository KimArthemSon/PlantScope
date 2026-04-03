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
} from "lucide-react-native";

const API_BASE_URL = api + "/api";

type Assessment = {
  field_assessment_id: number;
  site_id: number | null;
  site_name: string;
  title: string;
  description: string;
  is_sent: boolean;
  created_at: string;
  updated_at: string;
  data: any;
};

export default function LayerAssessmentList() {
  const { areaId, areaName, layerId, layerName } = useLocalSearchParams<{
    areaId: string;
    areaName: string;
    layerId: string;
    layerName: string;
  }>();

  const router = useRouter();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAssessments = async () => {
    try {
      const token = await SecureStore.getItemAsync("token");
      const url = `${API_BASE_URL}/get_field_assessments/${layerId}/?reforestation_area_id=${areaId}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) throw new Error("Failed to fetch assessments");

      const data = await res.json();
      setAssessments(data);
    } catch (error: any) {
      console.error(error);
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
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this draft? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await SecureStore.getItemAsync("token");
              const res = await fetch(
                `${API_BASE_URL}/delete_field_assessment/${id}/`,
                {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${token}` },
                },
              );

              if (!res.ok) throw new Error("Failed to delete");

              Alert.alert("Success", "Assessment deleted successfully");
              fetchAssessments();
            } catch (e: any) {
              Alert.alert("Error", e.message || "Failed to delete");
            }
          },
        },
      ],
    );
  };

  const handleCreateNew = () => {
    router.push({
      pathname: "/feedbacks/multicriteria_layer_form",
      params: {
        areaId,
        layerId,
        isEdit: "false",
        siteId: "", // Empty for new general assessment
      },
    });
  };

  const handleEdit = (assessment: Assessment) => {
    router.push({
      pathname: "/feedbacks/multicriteria_layer_form",
      params: {
        areaId,
        layerId,
        assessmentId: assessment.field_assessment_id.toString(),
        siteId: assessment.site_id?.toString() || "",
        isEdit: "true",
      },
    });
  };

  const handleView = (assessment: Assessment) => {
    router.push({
      pathname: "/feedbacks/multicriteria_layer_form",
      params: {
        areaId,
        layerId,
        assessmentId: assessment.field_assessment_id.toString(),
        siteId: assessment.site_id?.toString() || "",
        isEdit: "false", // View mode
      },
    });
  };

  const renderItem = ({ item }: { item: Assessment }) => (
    <View
      style={[
        styles.card,
        item.is_sent && styles.sentCard,
        !item.is_sent && styles.draftCard,
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{item.title}</Text>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: item.is_sent ? "#dcfce7" : "#fef3c7",
              },
            ]}
          >
            {item.is_sent ? (
              <CheckCircle size={12} color="#155724" />
            ) : (
              <Edit3 size={12} color="#856404" />
            )}
            <Text
              style={{
                color: item.is_sent ? "#155724" : "#856404",
                fontWeight: "700",
                fontSize: 10,
                marginLeft: 4,
              }}
            >
              {item.is_sent ? "SUBMITTED" : "DRAFT"}
            </Text>
          </View>
        </View>
      </View>

      {item.site_name && item.site_name !== "New Site Proposal" && (
        <View style={styles.siteInfo}>
          <Text style={styles.siteLabel}>Site:</Text>
          <Text style={styles.siteName}>{item.site_name}</Text>
        </View>
      )}

      <Text style={styles.desc} numberOfLines={2}>
        {item.description || "No description provided"}
      </Text>

      <View style={styles.footer}>
        <Text style={styles.date}>
          {new Date(item.created_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </Text>
        {item.is_sent && (
          <Text style={styles.updatedDate}>
            Updated: {new Date(item.updated_at).toLocaleDateString()}
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        {item.is_sent ? (
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

  const drafts = assessments.filter((i) => !i.is_sent);
  const submitted = assessments.filter((i) => i.is_sent);

  if (loading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color="#0F4A2F" />
        <Text style={styles.loadingText}>Loading assessments...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.areaName}>{areaName}</Text>
          <Text style={styles.layerName}>{layerName}</Text>
        </View>
        <TouchableOpacity style={styles.createBtn} onPress={handleCreateNew}>
          <PlusCircle size={18} color="#fff" />
          <Text style={styles.createBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Bar */}
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
        ListHeaderComponent={
          <>
            {drafts.length > 0 && (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Drafts</Text>
                <Text style={styles.sectionSubtitle}>
                  Incomplete assessments
                </Text>
              </View>
            )}
            {submitted.length > 0 && drafts.length > 0 && (
              <View style={styles.divider} />
            )}
            {submitted.length > 0 && (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Submitted History</Text>
                <Text style={styles.sectionSubtitle}>
                  Finalized assessments
                </Text>
              </View>
            )}
            {assessments.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  No assessments yet for this layer
                </Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={handleCreateNew}
                >
                  <PlusCircle size={18} color="#fff" />
                  <Text style={styles.emptyBtnText}>
                    Create First Assessment
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        }
        ListFooterComponent={<View style={{ height: 20 }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={fetchAssessments}
            tintColor="#0F4A2F"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#64748b",
    fontSize: 14,
  },
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
  headerLeft: {
    flex: 1,
  },
  areaName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  layerName: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
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
  createBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
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
  stat: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0F4A2F",
  },
  statLabel: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#e2e8f0",
    marginHorizontal: 16,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginHorizontal: 16,
    marginVertical: 8,
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
  draftCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#fbbf24",
  },
  sentCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#22c55e",
    opacity: 0.95,
  },
  cardHeader: {
    marginBottom: 8,
  },
  titleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
    marginRight: 8,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  siteInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    backgroundColor: "#f1f5f9",
    padding: 8,
    borderRadius: 6,
  },
  siteLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
    marginRight: 6,
  },
  siteName: {
    fontSize: 12,
    color: "#0f172a",
    fontWeight: "600",
  },
  desc: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  date: {
    fontSize: 11,
    color: "#94a3b8",
  },
  updatedDate: {
    fontSize: 11,
    color: "#94a3b8",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  btnView: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  btnViewText: {
    color: "#0F4A2F",
    fontWeight: "600",
    fontSize: 13,
  },
  btnEdit: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  btnEditText: {
    color: "#0F4A2F",
    fontWeight: "600",
    fontSize: 13,
  },
  btnDelete: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  btnDeleteText: {
    color: "#721c24",
    fontWeight: "600",
    fontSize: 13,
  },
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
    color: "#94a3b8",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
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
  emptyBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
});
