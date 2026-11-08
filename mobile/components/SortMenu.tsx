import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PRIMARY = "#0F4A2F";
const INK = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";

export type SortOption<K extends string> = {
  key: K;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

/**
 * Compact "Sort: …" button that opens a bottom sheet of sort options.
 * Shared by the inspector's area, site and delivery lists.
 */
export function SortMenu<K extends string>({
  value,
  options,
  onChange,
  title = "Sort by",
}: {
  value: K;
  options: SortOption<K>[];
  onChange: (key: K) => void;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const current = options.find((o) => o.key === value) ?? options[0];

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Sort by ${current.label}`}
      >
        <Ionicons name="swap-vertical" size={14} color={PRIMARY} />
        <Text style={styles.triggerText} numberOfLines={1}>
          {current.label}
        </Text>
        <Ionicons name="chevron-down" size={14} color={MUTED} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{title}</Text>
            {options.map((o) => {
              const active = o.key === value;
              return (
                <TouchableOpacity
                  key={o.key}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => {
                    onChange(o.key);
                    setOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name={o.icon ?? "reorder-three-outline"} size={18} color={active ? PRIMARY : MUTED} />
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>{o.label}</Text>
                  {active && <Ionicons name="checkmark" size={18} color={PRIMARY} />}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/** Newest first; empty or invalid dates go last. */
export function byDateDesc(a?: string | null, b?: string | null) {
  const ta = a ? Date.parse(a) : NaN;
  const tb = b ? Date.parse(b) : NaN;
  if (isNaN(ta) && isNaN(tb)) return 0;
  if (isNaN(ta)) return 1;
  if (isNaN(tb)) return -1;
  return tb - ta;
}

/** Oldest first; empty or invalid dates go last. */
export function byDateAsc(a?: string | null, b?: string | null) {
  const ta = a ? Date.parse(a) : NaN;
  const tb = b ? Date.parse(b) : NaN;
  if (isNaN(ta) && isNaN(tb)) return 0;
  if (isNaN(ta)) return 1;
  if (isNaN(tb)) return -1;
  return ta - tb;
}

export const byText = (a?: string | null, b?: string | null) =>
  (a || "").localeCompare(b || "", undefined, { sensitivity: "base", numeric: true });

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    maxWidth: 220,
  },
  triggerText: { fontSize: 12.5, fontWeight: "700", color: INK, flexShrink: 1 },
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB", marginBottom: 12 },
  sheetTitle: { fontSize: 13, fontWeight: "800", color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6, marginLeft: 4 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12 },
  optionActive: { backgroundColor: "#ECFDF5" },
  optionText: { flex: 1, fontSize: 15, color: INK, fontWeight: "500" },
  optionTextActive: { color: PRIMARY, fontWeight: "700" },
});
