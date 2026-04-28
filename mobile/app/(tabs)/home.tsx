import React from "react";
import { View, Text, StyleSheet, ScrollView, Dimensions } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";

const screenWidth = Dimensions.get("window").width;

/* ---------- TYPES ---------- */

type StatCardProps = {
  icon: string;
  title: string;
  value: string;
  tint: string;
};

type FeedbackItemProps = {
  site: string;
  message: string;
  status: "good" | "warning" | "alert";
};

const STATUS_COLOR = {
  good: "#22C55E",
  warning: "#F59E0B",
  alert: "#EF4444",
};

/* ---------- SCREEN ---------- */

const Home: React.FC = () => {
  const progress = Math.round((72 / 120) * 100); // 60%

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Greeting */}
      <View style={styles.greeting}>
        <View>
          <Text style={styles.greetTitle}>Good day, Inspector</Text>
          <Text style={styles.greetSub}>April 28, 2026</Text>
        </View>
        <View style={styles.badge}>
          <Ionicons name="shield-checkmark" size={13} color="#0F4A2F" />
          <Text style={styles.badgeText}>On-Site</Text>
        </View>
      </View>

      {/* Progress Banner */}
      <View style={styles.progressCard}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Overall Reforestation</Text>
          <Text style={styles.progressPct}>{progress}%</Text>
        </View>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${progress}%` as any }]} />
        </View>
        <Text style={styles.progressSub}>72 ha planted · 120 ha assigned</Text>
      </View>

      {/* Stats Grid */}
      <View style={styles.grid}>
        <StatCard icon="leaf" title="Assigned Area" value="120 ha" tint="#0F4A2F" />
        <StatCard icon="tree" title="Reforested" value="95 ha" tint="#1B6B3A" />
        <StatCard icon="map-marker-multiple" title="Total Sites" value="18" tint="#2E7D52" />
        <StatCard icon="sprout" title="Seedlings" value="4,560" tint="#3A9E64" />
      </View>

      {/* Chart */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Progress Over Time</Text>
        <LineChart
          data={{
            labels: ["Jan", "Feb", "Mar", "Apr", "May"],
            datasets: [{ data: [10, 22, 35, 55, 72] }],
          }}
          width={screenWidth - 80}
          height={175}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
          withInnerLines={false}
          withOuterLines={false}
        />
      </View>

      {/* Field Reports */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Latest Field Reports</Text>
        <FeedbackItem
          site="Site 03 – Brgy. Alta Vista"
          message="Seedlings are healthy and growing well."
          status="good"
        />
        <FeedbackItem
          site="Site 11 – Brgy. San Jose"
          message="Some seedlings need replanting due to soil erosion."
          status="warning"
        />
        <FeedbackItem
          site="Site 07 – Brgy. Naungan"
          message="Area requires additional watering."
          status="alert"
        />
      </View>
    </ScrollView>
  );
};

export default Home;

/* ---------- COMPONENTS ---------- */

const StatCard: React.FC<StatCardProps> = ({ icon, title, value, tint }) => (
  <View style={styles.statCard}>
    <View style={[styles.statIcon, { backgroundColor: tint + "18" }]}>
      <MaterialCommunityIcons name={icon as any} size={22} color={tint} />
    </View>
    <Text style={[styles.statValue, { color: tint }]}>{value}</Text>
    <Text style={styles.statTitle}>{title}</Text>
  </View>
);

const FeedbackItem: React.FC<FeedbackItemProps> = ({ site, message, status }) => (
  <View style={styles.feedbackItem}>
    <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[status] }]} />
    <View style={styles.feedbackBody}>
      <Text style={styles.feedbackSite}>{site}</Text>
      <Text style={styles.feedbackMsg}>{message}</Text>
    </View>
  </View>
);

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F7F5",
  },
  content: {
    paddingBottom: 32,
  },

  /* Greeting */
  greeting: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
  },
  greetTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F2D1C",
  },
  greetSub: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E6F4EC",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0F4A2F",
  },

  /* Progress Banner */
  progressCard: {
    backgroundColor: "#0F4A2F",
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 13,
    color: "#B7D3C6",
    fontWeight: "500",
  },
  progressPct: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  progressBg: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#5FD08A",
    borderRadius: 4,
  },
  progressSub: {
    fontSize: 12,
    color: "#B7D3C6",
  },

  /* Stats Grid */
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: 14,
    marginBottom: 4,
  },
  statCard: {
    width: "46%",
    backgroundColor: "#FFFFFF",
    margin: 6,
    padding: 16,
    borderRadius: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 2,
  },
  statTitle: {
    fontSize: 12,
    color: "#6B7280",
  },

  /* Cards */
  card: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginTop: 12,
    padding: 18,
    borderRadius: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F2D1C",
    marginBottom: 14,
  },
  chart: {
    borderRadius: 10,
    marginLeft: -8,
  },

  /* Feedback */
  feedbackItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    marginRight: 12,
  },
  feedbackBody: {
    flex: 1,
  },
  feedbackSite: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F2D1C",
  },
  feedbackMsg: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
});

/* ---------- CHART CONFIG ---------- */

const chartConfig = {
  backgroundGradientFrom: "#FFFFFF",
  backgroundGradientTo: "#FFFFFF",
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(15, 74, 47, ${opacity})`,
  labelColor: () => "#9CA3AF",
  propsForDots: {
    r: "4",
    strokeWidth: "2",
    stroke: "#0F4A2F",
    fill: "#0F4A2F",
  },
  propsForBackgroundLines: {
    stroke: "transparent",
  },
};
