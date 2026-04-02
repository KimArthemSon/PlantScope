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

const API_BASE_URL = api + "/api";

type Assessment = {
  field_assessment_id: number;
  title: string;
  description: string;
  is_sent: boolean;
  created_at: string;
  data: any;
};

export default function Pre_assessment() {
  // Get areaId from the previous screen (Sites.tsx)
  const { areaId, areaName } = useLocalSearchParams<{
    areaId: string;
    areaName: string;
  }>();

  const router = useRouter();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAssessments = async () => {
    try {
      const token = await SecureStore.getItemAsync("token");

      // UPDATED URL: Pass reforestation_area_id and type=pre_assessment
      const url = `${API_BASE_URL}/get_field_assessments/pre_assessment/?reforestation_area_id=${areaId}`;

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
  }, [areaId]); // Re-fetch if areaId changes

  const handleDelete = async (id: number) => {
    Alert.alert("Confirm Delete", "Are you sure? This cannot be undone.", [
      { text: "Cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await SecureStore.getItemAsync("token");
            await fetch(`${API_BASE_URL}/delete_field_assessment/${id}/`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            fetchAssessments(); // Refresh list
          } catch (e) {
            Alert.alert("Error", "Failed to delete");
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Assessment }) => (
    <View style={[styles.card, item.is_sent && styles.sentCard]}>
      <View style={styles.cardHeader}>
        <Text style={styles.title}>{item.title}</Text>
        <View
          style={[
            styles.badge,
            { backgroundColor: item.is_sent ? "#d4edda" : "#fff3cd" },
          ]}
        >
          <Text style={{ color: item.is_sent ? "#155724" : "#856404" }}>
            {item.is_sent ? "SUBMITTED" : "DRAFT"}
          </Text>
        </View>
      </View>
      <Text style={styles.desc}>{item.description}</Text>
      <Text style={styles.date}>
        {new Date(item.created_at).toLocaleDateString()}
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.btnEdit}
          onPress={() =>
            router.push(
              `/feedbacks/pre_assessment_form?id=${item.field_assessment_id}&areaId=${areaId}`,
            )
          }
        >
          <Text style={styles.btnTextEdit}>
            {item.is_sent ? "View" : "Edit"}
          </Text>
        </TouchableOpacity>

        {!item.is_sent && (
          <TouchableOpacity
            style={styles.btnDelete}
            onPress={() => handleDelete(item.field_assessment_id)}
          >
            <Text style={styles.btnDeleteText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const drafts = assessments.filter((i) => !i.is_sent);
  const submitted = assessments.filter((i) => i.is_sent);

  if (loading)
    return <ActivityIndicator size="large" style={{ marginTop: 50 }} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pre-Assessment: {areaName}</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() =>
            router.push(`/feedbacks/pre_assessment_form?areaId=${areaId}`)
          }
        >
          <Text style={styles.createBtnText}>+ New Assessment</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={[...drafts, ...submitted]}
        keyExtractor={(item) => item.field_assessment_id.toString()}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            {drafts.length > 0 && (
              <Text style={styles.sectionTitle}>Drafts</Text>
            )}
            {submitted.length > 0 && drafts.length > 0 && (
              <View style={styles.divider} />
            )}
            {submitted.length > 0 && (
              <Text style={styles.sectionTitle}>Submitted History</Text>
            )}
          </>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={fetchAssessments}
          />
        }
      />
    </View>
  );
}

// ... (Styles remain the same as previous example)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5", padding: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: { fontSize: 18, fontWeight: "bold", flex: 1 },
  createBtn: {
    backgroundColor: "#0F4A2F",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  createBtnText: { color: "#fff", fontWeight: "bold" },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
    marginTop: 10,
    marginBottom: 8,
  },
  divider: { height: 1, backgroundColor: "#ddd", marginVertical: 10 },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    elevation: 2,
  },
  sentCard: { opacity: 0.8, borderLeftWidth: 4, borderLeftColor: "#28a745" },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: { fontSize: 16, fontWeight: "bold", flex: 1 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  desc: { color: "#555", marginTop: 4, fontSize: 14 },
  date: { color: "#999", fontSize: 12, marginTop: 8 },
  actions: { flexDirection: "row", marginTop: 12, justifyContent: "flex-end" },
  btnEdit: {
    backgroundColor: "#e9ecef",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginRight: 8,
  },
  btnTextEdit: { color: "#0F4A2F", fontWeight: "600" },
  btnDelete: {
    backgroundColor: "#f8d7da",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  btnDeleteText: { color: "#721c24", fontWeight: "600" },
});
