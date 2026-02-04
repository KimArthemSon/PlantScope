import React from "react";
import { View, Text, StyleSheet, ScrollView, Dimensions } from "react-native";
import { LineChart } from "react-native-chart-kit";

const screenWidth = Dimensions.get("window").width;

/* ---------- TYPES ---------- */

type StatCardProps = {
  title: string;
  value: string;
};

type FeedbackItemProps = {
  site: string;
  message: string;
};

/* ---------- SCREEN ---------- */

const Home: React.FC = () => {
  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <Text style={styles.header}>Dashboard</Text>

      {/* Stat Cards */}
      <View style={styles.row}>
        <StatCard title="Assigned Area (ha)" value="120" />
        <StatCard title="Total Reforested Area (ha)" value="95" />
      </View>

      <View style={styles.row}>
        <StatCard title="Total Sites" value="18" />
        <StatCard title="Seedlings Planted" value="4,560" />
      </View>

      <View style={styles.row}>
        <StatCard title="Area Planted (ha)" value="72" />
      </View>

      {/* Progress Chart */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          Reforestation Progress Over Time
        </Text>

        <LineChart
          data={{
            labels: ["Jan", "Feb", "Mar", "Apr", "May"],
            datasets: [
              {
                data: [10, 22, 35, 55, 72],
              },
            ],
          }}
          width={screenWidth - 32}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />
      </View>

      {/* Latest Feedback */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Latest Feedback</Text>

        <FeedbackItem
          site="Site 03 – Brgy. Alta Vista"
          message="Seedlings are healthy and growing well."
        />

        <FeedbackItem
          site="Site 11 – Brgy. San Jose"
          message="Some seedlings need replanting due to soil erosion."
        />

        <FeedbackItem
          site="Site 07 – Brgy. Naungan"
          message="Area requires additional watering."
        />
      </View>
    </ScrollView>
  );
};

export default Home;

/* ---------- COMPONENTS ---------- */

const StatCard: React.FC<StatCardProps> = ({ title, value }) => {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );
};

const FeedbackItem: React.FC<FeedbackItemProps> = ({ site, message }) => {
  return (
    <View style={styles.feedbackItem}>
      <Text style={styles.feedbackSite}>{site}</Text>
      <Text style={styles.feedbackText}>{message}</Text>
    </View>
  );
};

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  header: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#000",
    margin: 16,
  },

  row: {
    flexDirection: "row",
    marginHorizontal: 16,
  },

  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    margin: 6,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },

  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0F4A2F",
  },

  statTitle: {
    fontSize: 13,
    color: "#555",
    marginTop: 4,
  },

  card: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 12,
  },

  chart: {
    borderRadius: 12,
  },

  feedbackItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
    paddingVertical: 10,
  },

  feedbackSite: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },

  feedbackText: {
    fontSize: 13,
    color: "#555",
    marginTop: 2,
  },
});

/* ---------- CHART CONFIG ---------- */

const chartConfig = {
  backgroundGradientFrom: "#FFFFFF",
  backgroundGradientTo: "#FFFFFF",
  decimalPlaces: 0,
  color: (opacity: number = 1) => `rgba(15, 74, 47, ${opacity})`,
  labelColor: () => "#555",
  propsForDots: {
    r: "4",
    strokeWidth: "2",
    stroke: "#0F4A2F",
  },
};
