import { useRouter } from "expo-router";
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from "react-native";

export default function Profile() {
  const navigate = useRouter();
  function handleLogout() {
    navigate.push("../index");
  }
  return (
    <ScrollView style={styles.container}>
      {/* Profile Header Card */}
      <View style={styles.card}>
        <Image
          source={{ uri: "https://i.pravatar.cc/150" }}
          style={styles.avatar}
        />
        <Text style={styles.name}>Juan Dela Cruz</Text>
        <Text style={styles.role}>Onsite Inspector</Text>
      </View>

      {/* Cardboard Information */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Cardboard Information</Text>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Employee ID</Text>
          <Text style={styles.value}>OSI-0241</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Assigned Area</Text>
          <Text style={styles.value}>Ormoc City</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>Active</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.card}>
        <TouchableOpacity style={styles.actionBtn}>
          <Text style={styles.actionText}>View Notifications</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.logoutBtn]}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  card: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2, // Android shadow
    shadowColor: "#000", // iOS shadow
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },

  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignSelf: "center",
    marginBottom: 12,
  },

  name: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
    textAlign: "center",
  },

  role: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
    marginTop: 4,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 12,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },

  label: {
    color: "#555",
    fontSize: 14,
  },

  value: {
    color: "#000",
    fontSize: 14,
    fontWeight: "500",
  },

  actionBtn: {
    backgroundColor: "#0F4A2F",
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
  },

  actionText: {
    color: "#FFF",
    textAlign: "center",
    fontSize: 15,
    fontWeight: "600",
  },

  logoutBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#0F4A2F",
  },

  logoutText: {
    color: "#0F4A2F",
    textAlign: "center",
    fontSize: 15,
    fontWeight: "600",
  },
});
