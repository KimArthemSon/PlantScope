import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
} from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

const { width: windowWidth } = Dimensions.get("window");

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type DatePickerModalProps = {
  visible: boolean;
  value: string;
  onConfirm: (date: string) => void;
  onClose: () => void;
};

export default function DatePickerModal({
  visible,
  value,
  onConfirm,
  onClose,
}: DatePickerModalProps) {
  const [year, setYear] = useState(2000);
  const [month, setMonth] = useState(0);
  const [selectedDay, setSelectedDay] = useState(0);

  useEffect(() => {
    if (visible) {
      if (value) {
        const p = value.split("-");
        setYear(parseInt(p[0]) || 2000);
        setMonth((parseInt(p[1]) || 1) - 1);
        setSelectedDay(parseInt(p[2]) || 0);
      } else {
        setYear(2000);
        setMonth(0);
        setSelectedDay(0);
      }
    }
  }, [visible]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const day = Math.min(selectedDay, daysInMonth);
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    setSelectedDay(0);
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    setSelectedDay(0);
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  const confirmDate = () => {
    if (!day) return;
    onConfirm(
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    );
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Select Date</Text>
          <View style={styles.navRow}>
            <TouchableOpacity
              onPress={() => {
                setYear((y) => y - 1);
                setSelectedDay(0);
              }}
              style={styles.navBtn}
            >
              <ChevronLeft size={15} color="#4caf72" />
            </TouchableOpacity>
            <Text style={styles.yearLabel}>{year}</Text>
            <TouchableOpacity
              onPress={() => {
                setYear((y) => y + 1);
                setSelectedDay(0);
              }}
              style={styles.navBtn}
            >
              <ChevronRight size={15} color="#4caf72" />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
              <ChevronLeft size={15} color="#4caf72" />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{MONTHS[month]}</Text>
            <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
              <ChevronRight size={15} color="#4caf72" />
            </TouchableOpacity>
          </View>
          <View style={styles.weekRow}>
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <View key={d} style={styles.cell}>
                <Text style={styles.weekDay}>{d}</Text>
              </View>
            ))}
          </View>
          <View style={styles.grid}>
            {cells.map((d, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.cell,
                  d !== null && d === day && styles.cellSelected,
                ]}
                onPress={() => d !== null && setSelectedDay(d)}
                disabled={d === null}
                activeOpacity={d === null ? 1 : 0.7}
              >
                <Text
                  style={[
                    styles.cellText,
                    d === null && { opacity: 0 },
                    d !== null && d === day && styles.cellTextSelected,
                  ]}
                >
                  {d ?? "·"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, !day && { opacity: 0.4 }]}
              onPress={confirmDate}
              disabled={!day}
            >
              <Text style={styles.confirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    backgroundColor: "#183d23",
    borderRadius: 20,
    padding: 20,
    width: Math.min(320, windowWidth - 48),
    borderWidth: 1,
    borderColor: "rgba(76,175,114,0.35)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 16,
  },
  title: {
    fontSize: 15,
    color: "#ffffff",
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginBottom: 14,
  },
  navBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(76,175,114,0.12)",
  },
  yearLabel: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    minWidth: 46,
    textAlign: "center",
  },
  monthLabel: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    minWidth: 82,
    textAlign: "center",
  },
  divider: {
    width: 1,
    height: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginHorizontal: 4,
  },
  weekRow: { flexDirection: "row", marginBottom: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 16 },
  cell: {
    width: `${100 / 7}%` as any,
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 999,
  },
  cellSelected: { backgroundColor: "#4caf72" },
  weekDay: { color: "#4caf72", fontSize: 11, fontWeight: "700" },
  cellText: { color: "#a8c5b3", fontSize: 13, fontWeight: "500" },
  cellTextSelected: { color: "#ffffff", fontWeight: "700" },
  actions: { flexDirection: "row", gap: 10 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
  },
  cancelText: { color: "#a8c5b3", fontSize: 14, fontWeight: "600" },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#2d5f3c",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(76,175,114,0.3)",
  },
  confirmText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
});