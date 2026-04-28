import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Image, Alert, ActivityIndicator, Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/constants/url_fixed";

const API = api + "/api";

/* ---------- TYPES ---------- */

type Profile = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  birthday: string;
  gender: string;
  address: string;
  contact: string;
  user_role: string;
  is_active: string;
  preview_profile: string;
  password: string;
  confirm_pass: string;
};

type PwdCheck = {
  length: boolean; lower: boolean;
  upper: boolean; number: boolean; symbol: boolean;
};

const EMPTY: Profile = {
  id: 0, email: "", first_name: "", last_name: "", middle_name: "",
  birthday: "", gender: "M", address: "", contact: "", user_role: "",
  is_active: "true", preview_profile: "", password: "", confirm_pass: "",
};

/* ---------- HELPERS ---------- */

function initials(first: string, last: string) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
}

function checkPwd(p: string): PwdCheck {
  return {
    length: p.length >= 8,
    lower:  /[a-z]/.test(p),
    upper:  /[A-Z]/.test(p),
    number: /\d/.test(p),
    symbol: /[^A-Za-z0-9]/.test(p),
  };
}

const PWD_RULES = [
  { key: "length", label: "At least 8 characters" },
  { key: "lower",  label: "One lowercase letter"  },
  { key: "upper",  label: "One uppercase letter"  },
  { key: "number", label: "One number"             },
  { key: "symbol", label: "One symbol"             },
] as const;

/* ---------- SCREEN ---------- */

export default function EditProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [userId, setUserId]   = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showCfm, setShowCfm] = useState(false);

  const pwd      = profile.password;
  const pwdCheck = checkPwd(pwd);
  const pwdMet   = Object.values(pwdCheck).filter(Boolean).length;
  const allMet   = Object.values(pwdCheck).every(Boolean);

  const strengthColor = allMet ? "#22C55E" : pwdMet >= 3 ? "#F59E0B" : "#EF4444";

  /* ---- Load ---- */
  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync("token");
        if (!token) { router.replace("/login"); return; }

        const meRes = await fetch(`${API}/get_me/`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!meRes.ok) { router.replace("/login"); return; }
        const me = await meRes.json();
        setUserId(me.id);

        const pRes = await fetch(`${API}/get_user/${me.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!pRes.ok) throw new Error("Could not load profile.");
        const data = await pRes.json();

        setProfile({
          ...EMPTY, ...data,
          password: "",
          confirm_pass: "",
          preview_profile: data.profile_img ? `${api}${data.profile_img}` : "",
        });
      } catch (e: any) {
        Alert.alert("Error", e.message ?? "Failed to load profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ---- Save ---- */
  const handleSave = async () => {
    if (!userId) return;

    if (pwd.length > 0) {
      if (!allMet) {
        Alert.alert("Weak Password", "Password does not meet all requirements."); return;
      }
      if (pwd !== profile.confirm_pass) {
        Alert.alert("Mismatch", "Passwords do not match."); return;
      }
    }

    setSaving(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const fd = new FormData();
      fd.append("email",       profile.email);
      fd.append("first_name",  profile.first_name);
      fd.append("last_name",   profile.last_name);
      fd.append("middle_name", profile.middle_name);
      fd.append("contact",     profile.contact);
      fd.append("gender",      profile.gender);
      fd.append("birthday",    profile.birthday);
      fd.append("address",     profile.address);
      fd.append("user_role",   profile.user_role);
      fd.append("is_active",   profile.is_active);
      if (pwd.length > 0) fd.append("password", pwd);

      const res = await fetch(`${API}/update_user/${userId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed.");

      setProfile((p) => ({ ...p, password: "", confirm_pass: "" }));
      Alert.alert("Saved", "Profile updated successfully.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Server error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof Profile) => (val: string) =>
    setProfile((p) => ({ ...p, [key]: val }));

  /* ---- UI ---- */
  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#0F4A2F" />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </View>
    );
  }

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "My Profile";

  return (
    <View style={styles.root}>
      {/* ── Custom Header ── */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Avatar Hero ── */}
        <View style={styles.hero}>
          {profile.preview_profile ? (
            <Image source={{ uri: profile.preview_profile }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitials}>
                {initials(profile.first_name, profile.last_name)}
              </Text>
            </View>
          )}
          <Text style={styles.heroName}>{fullName}</Text>
          {profile.user_role ? (
            <View style={styles.roleBadge}>
              <Ionicons name="shield-checkmark" size={12} color="#0F4A2F" />
              <Text style={styles.roleText}>
                {profile.user_role.replace(/([A-Z])/g, " $1").trim()}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Personal Information ── */}
        <SectionCard icon="account-outline" title="Personal Information" subtitle="Name, contact and location">
          <Row>
            <Field label="First Name" icon="account-outline"
              value={profile.first_name} onChangeText={set("first_name")} placeholder="First name" />
            <Field label="Middle Name" icon="account-outline"
              value={profile.middle_name} onChangeText={set("middle_name")} placeholder="Middle name" />
          </Row>
          <Field label="Last Name" icon="account-outline"
            value={profile.last_name} onChangeText={set("last_name")} placeholder="Last name" />
          <Field label="Contact Number" icon="phone-outline"
            value={profile.contact} onChangeText={set("contact")}
            placeholder="+63 912 345 6789" keyboardType="phone-pad" />
          <Row>
            <PickerField
              label="Gender"
              icon="gender-male-female"
              value={profile.gender}
              onSelect={set("gender")}
              options={[{ label: "Male", value: "M" }, { label: "Female", value: "F" }, { label: "Other", value: "O" }]}
            />
            <Field label="Birthday" icon="cake-variant-outline"
              value={profile.birthday} onChangeText={set("birthday")}
              placeholder="YYYY-MM-DD" keyboardType="numeric" />
          </Row>
          <Field label="Address" icon="map-marker-outline"
            value={profile.address} onChangeText={set("address")}
            placeholder="Brgy., City, Province" />
        </SectionCard>

        {/* ── Account & Security ── */}
        <SectionCard icon="shield-lock-outline" title="Account & Security" subtitle="Email and password settings">
          {/* Email read-only */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Email Address</Text>
            <View style={[styles.inputRow, styles.inputReadonly]}>
              <MaterialCommunityIcons name="email-outline" size={16} color="#9CA3AF" style={styles.inputIcon} />
              <Text style={styles.readonlyText}>{profile.email}</Text>
              <View style={styles.readonlyTag}>
                <Text style={styles.readonlyTagText}>Read-only</Text>
              </View>
            </View>
          </View>

          {/* New Password */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>
              New Password{" "}
              <Text style={styles.labelHint}>(leave blank to keep current)</Text>
            </Text>
            <View style={styles.inputRow}>
              <MaterialCommunityIcons name="lock-outline" size={16} color="#0F4A2F" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                secureTextEntry={!showPwd}
                placeholder="New password"
                placeholderTextColor="#9CA3AF"
                value={pwd}
                onChangeText={set("password")}
              />
              <TouchableOpacity onPress={() => setShowPwd(!showPwd)}>
                <Ionicons name={showPwd ? "eye-off-outline" : "eye-outline"} size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Strength bar + rules */}
            {pwd.length > 0 && (
              <>
                <View style={styles.strengthBg}>
                  <View style={[
                    styles.strengthFill,
                    { width: `${(pwdMet / 5) * 100}%` as any, backgroundColor: strengthColor },
                  ]} />
                </View>
                <View style={styles.ruleList}>
                  {PWD_RULES.map(({ key, label }) => (
                    <View key={key} style={styles.ruleRow}>
                      <Ionicons
                        name={pwdCheck[key] ? "checkmark-circle" : "ellipse-outline"}
                        size={13}
                        color={pwdCheck[key] ? "#22C55E" : "#D1D5DB"}
                      />
                      <Text style={[styles.ruleText, { color: pwdCheck[key] ? "#22C55E" : "#9CA3AF" }]}>
                        {label}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>

          {/* Confirm Password */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={[
              styles.inputRow,
              profile.confirm_pass.length > 0 && (
                pwd === profile.confirm_pass
                  ? styles.inputMatch
                  : styles.inputMismatch
              ),
            ]}>
              <MaterialCommunityIcons name="lock-check-outline" size={16} color="#0F4A2F" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                secureTextEntry={!showCfm}
                placeholder="Re-enter new password"
                placeholderTextColor="#9CA3AF"
                value={profile.confirm_pass}
                onChangeText={set("confirm_pass")}
              />
              <TouchableOpacity onPress={() => setShowCfm(!showCfm)}>
                <Ionicons name={showCfm ? "eye-off-outline" : "eye-outline"} size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            {profile.confirm_pass.length > 0 && (
              <Text style={[styles.matchHint, { color: pwd === profile.confirm_pass ? "#22C55E" : "#EF4444" }]}>
                {pwd === profile.confirm_pass ? "✓ Passwords match" : "Passwords do not match"}
              </Text>
            )}
          </View>
        </SectionCard>

        {/* ── Actions ── */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} activeOpacity={0.75}>
            <Ionicons name="chevron-back" size={16} color="#6B7280" />
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={16} color="#FFF" />
                <Text style={styles.saveText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

/* ---------- SUB-COMPONENTS ---------- */

const SectionCard: React.FC<{
  icon: string; title: string; subtitle: string; children: React.ReactNode;
}> = ({ icon, title, subtitle, children }) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <View style={styles.cardIconWrap}>
        <MaterialCommunityIcons name={icon as any} size={17} color="#0F4A2F" />
      </View>
      <View>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSub}>{subtitle}</Text>
      </View>
    </View>
    <View style={styles.cardBody}>{children}</View>
  </View>
);

const Row: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.twoCol}>{children}</View>
);

const Field: React.FC<{
  label: string; icon: string; value: string;
  onChangeText: (v: string) => void; placeholder?: string;
  keyboardType?: "default" | "phone-pad" | "numeric";
  half?: boolean;
}> = ({ label, icon, value, onChangeText, placeholder, keyboardType = "default" }) => (
  <View style={styles.fieldWrap}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.inputRow}>
      <MaterialCommunityIcons name={icon as any} size={16} color="#0F4A2F" style={styles.inputIcon} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType}
      />
    </View>
  </View>
);

const PickerField: React.FC<{
  label: string; icon: string; value: string;
  onSelect: (v: string) => void;
  options: { label: string; value: string }[];
}> = ({ label, icon, value, onSelect, options }) => {
  const current = options.find((o) => o.value === value)?.label ?? value;
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <MaterialCommunityIcons name={icon as any} size={16} color="#0F4A2F" style={styles.inputIcon} />
        <Pressable
          style={styles.pickerBtn}
          onPress={() =>
            Alert.alert(label, "", options.map((o) => ({
              text: o.label,
              onPress: () => onSelect(o.value),
            })))
          }
        >
          <Text style={styles.pickerText}>{current}</Text>
          <Ionicons name="chevron-down" size={14} color="#9CA3AF" />
        </Pressable>
      </View>
    </View>
  );
};

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F4F7F5" },

  /* Loading */
  loadingScreen: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText:   { color: "#6B7280", fontSize: 14 },

  /* Header */
  headerBar: {
    backgroundColor: "#0F4A2F",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  backBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16, fontWeight: "700", color: "#FFFFFF",
  },

  /* Scroll */
  scroll:   { flex: 1 },
  content:  { },

  /* Hero */
  hero: {
    backgroundColor: "#0F4A2F",
    alignItems: "center",
    paddingBottom: 28,
    paddingTop: 8,
  },
  avatar: {
    width: 84, height: 84, borderRadius: 42,
    borderWidth: 3, borderColor: "rgba(255,255,255,0.35)",
    marginBottom: 12,
  },
  avatarFallback: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center", alignItems: "center",
    borderWidth: 3, borderColor: "rgba(255,255,255,0.35)",
    marginBottom: 12,
  },
  avatarInitials: { fontSize: 28, fontWeight: "800", color: "#FFFFFF" },
  heroName: { fontSize: 18, fontWeight: "700", color: "#FFFFFF", marginBottom: 8 },
  roleBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  roleText: { fontSize: 11, fontWeight: "700", color: "#0F4A2F" },

  /* Card */
  card: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16, marginTop: 16,
    borderRadius: 18,
    elevation: 2,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  cardIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: "#E6F4EC",
    justifyContent: "center", alignItems: "center",
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#0F2D1C" },
  cardSub:   { fontSize: 11, color: "#9CA3AF", marginTop: 1 },
  cardBody:  { padding: 16, gap: 4 },

  /* Two-col row */
  twoCol: { flexDirection: "row", gap: 10 },

  /* Field */
  fieldWrap: { flex: 1, marginBottom: 12 },
  label: { fontSize: 11, fontWeight: "600", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  labelHint: { fontSize: 10, fontWeight: "400", color: "#9CA3AF", textTransform: "none", letterSpacing: 0 },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1, borderColor: "#E5E7EB",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  inputIcon:    { marginRight: 8 },
  input:        { flex: 1, fontSize: 13, color: "#0F2D1C" },
  inputReadonly:{ backgroundColor: "#F3F4F6" },
  readonlyText: { flex: 1, fontSize: 13, color: "#9CA3AF" },
  readonlyTag:  {
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
  },
  readonlyTagText: { fontSize: 9, color: "#9CA3AF", fontWeight: "600" },
  inputMatch:   { borderColor: "#22C55E", backgroundColor: "#F0FDF4" },
  inputMismatch:{ borderColor: "#EF4444", backgroundColor: "#FEF2F2" },
  matchHint:    { fontSize: 11, marginTop: 4 },

  /* Picker */
  pickerBtn: {
    flex: 1, flexDirection: "row",
    alignItems: "center", justifyContent: "space-between",
  },
  pickerText: { fontSize: 13, color: "#0F2D1C" },

  /* Password strength */
  strengthBg: {
    height: 4, backgroundColor: "#E5E7EB",
    borderRadius: 2, overflow: "hidden", marginTop: 8,
  },
  strengthFill: { height: "100%", borderRadius: 2 },
  ruleList:  { marginTop: 8, gap: 4 },
  ruleRow:   { flexDirection: "row", alignItems: "center", gap: 6 },
  ruleText:  { fontSize: 11 },

  /* Actions */
  actions: {
    flexDirection: "row", gap: 10,
    marginHorizontal: 16, marginTop: 20,
  },
  cancelBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1, borderColor: "#E5E7EB",
    borderRadius: 12, paddingVertical: 13,
  },
  cancelText: { fontSize: 14, fontWeight: "600", color: "#6B7280" },
  saveBtn: {
    flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#0F4A2F",
    borderRadius: 12, paddingVertical: 13,
    elevation: 3,
    shadowColor: "#0F4A2F", shadowOpacity: 0.3, shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  saveText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
});
