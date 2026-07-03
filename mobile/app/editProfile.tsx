import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Pressable,
  Platform,
  Animated,
  Alert,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/constants/url_fixed";
import { useAlert } from "@/components/AlertContext";
import CustomPicker from "@/components/CustomPicker";

const API = api + "/api";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

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

  // Tree Grower specific fields
  group_name: string;
  group_type: string;
  group_address: string;
  group_contact: string;
  preview_group_profile: string;
};

type PwdCheck = {
  length: boolean;
  lower: boolean;
  upper: boolean;
  number: boolean;
  symbol: boolean;
};

const EMPTY: Profile = {
  id: 0,
  email: "",
  first_name: "",
  last_name: "",
  middle_name: "",
  birthday: "",
  gender: "M",
  address: "",
  contact: "",
  user_role: "",
  is_active: "true",
  preview_profile: "",
  password: "",
  confirm_pass: "",
  group_name: "",
  group_type: "informal_group",
  group_address: "",
  group_contact: "",
  preview_group_profile: "",
};

// Map backend display names back to raw DB values
const groupTypeMap: Record<string, string> = {
  "Formal Organization": "formal_org",
  "Community Group": "community_group",
  "Informal Group": "informal_group",
};

/* ---------- DATE PICKER MODAL ---------- */
const DatePickerModal: React.FC<{
  visible: boolean;
  value: string;
  onConfirm: (date: string) => void;
  onClose: () => void;
}> = ({ visible, value, onConfirm, onClose }) => {
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
  }, [visible, value]);

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
      <View style={dpStyles.overlay}>
        <View style={dpStyles.container}>
          <Text style={dpStyles.title}>Select Date</Text>
          <View style={dpStyles.navRow}>
            <TouchableOpacity
              onPress={() => {
                setYear((y) => y - 1);
                setSelectedDay(0);
              }}
              style={dpStyles.navBtn}
            >
              <Ionicons name="chevron-back" size={15} color="#4caf72" />
            </TouchableOpacity>
            <Text style={dpStyles.yearLabel}>{year}</Text>
            <TouchableOpacity
              onPress={() => {
                setYear((y) => y + 1);
                setSelectedDay(0);
              }}
              style={dpStyles.navBtn}
            >
              <Ionicons name="chevron-forward" size={15} color="#4caf72" />
            </TouchableOpacity>
            <View style={dpStyles.divider} />
            <TouchableOpacity onPress={prevMonth} style={dpStyles.navBtn}>
              <Ionicons name="chevron-back" size={15} color="#4caf72" />
            </TouchableOpacity>
            <Text style={dpStyles.monthLabel}>{MONTHS[month]}</Text>
            <TouchableOpacity onPress={nextMonth} style={dpStyles.navBtn}>
              <Ionicons name="chevron-forward" size={15} color="#4caf72" />
            </TouchableOpacity>
          </View>
          <View style={dpStyles.weekRow}>
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <View key={d} style={dpStyles.cell}>
                <Text style={dpStyles.weekDay}>{d}</Text>
              </View>
            ))}
          </View>
          <View style={dpStyles.grid}>
            {cells.map((d, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  dpStyles.cell,
                  d !== null && d === day && dpStyles.cellSelected,
                ]}
                onPress={() => d !== null && setSelectedDay(d)}
                disabled={d === null}
                activeOpacity={d === null ? 1 : 0.7}
              >
                <Text
                  style={[
                    dpStyles.cellText,
                    d === null && { opacity: 0 },
                    d !== null && d === day && dpStyles.cellTextSelected,
                  ]}
                >
                  {d ?? "·"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={dpStyles.actions}>
            <TouchableOpacity style={dpStyles.cancelBtn} onPress={onClose}>
              <Text style={dpStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[dpStyles.confirmBtn, !day && { opacity: 0.4 }]}
              onPress={confirmDate}
              disabled={!day}
            >
              <Text style={dpStyles.confirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/* ---------- HELPERS ---------- */
function initials(first: string, last: string) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
}

function checkPwd(p: string): PwdCheck {
  return {
    length: p.length >= 8,
    lower: /[a-z]/.test(p),
    upper: /[A-Z]/.test(p),
    number: /\d/.test(p),
    symbol: /[^A-Za-z0-9]/.test(p),
  };
}

const PWD_RULES = [
  { key: "length", label: "At least 8 characters" },
  { key: "lower", label: "One lowercase letter" },
  { key: "upper", label: "One uppercase letter" },
  { key: "number", label: "One number" },
  { key: "symbol", label: "One symbol" },
] as const;

/* ---------- SCREEN ---------- */
export default function EditProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const alert = useAlert();

  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showCfm, setShowCfm] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [profileImgFile, setProfileImgFile] = useState<any>(null);
  const [groupImgFile, setGroupImgFile] = useState<any>(null);

  // Animation for success feedback
  const successScale = useRef(new Animated.Value(1)).current;

  const pwd = profile.password;
  const pwdCheck = checkPwd(pwd);
  const pwdMet = Object.values(pwdCheck).filter(Boolean).length;
  const allMet = Object.values(pwdCheck).every(Boolean);

  const strengthColor = allMet
    ? "#22C55E"
    : pwdMet >= 3
      ? "#F59E0B"
      : "#EF4444";

  const pickImage = async (type: "profile" | "group_profile") => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const fileObj = {
        uri: asset.uri,
        name: asset.fileName ?? `${type}.jpg`,
        type: asset.mimeType ?? "image/jpeg",
      };

      if (type === "profile") {
        setProfileImgFile(fileObj);
        setProfile((p) => ({ ...p, preview_profile: asset.uri }));
      } else {
        setGroupImgFile(fileObj);
        setProfile((p) => ({ ...p, preview_group_profile: asset.uri }));
      }
      setHasUnsavedChanges(true);
    }
  };

  /* ---- Load ---- */
  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync("token");
        if (!token) {
          router.replace("/homepage");
          return;
        }

        const meRes = await fetch(`${API}/get_me/`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!meRes.ok) {
          console.error("Get me failed:", meRes.status);
          router.replace("/homepage");
          return;
        }

        const me = await meRes.json();
        setUserId(me.id);

        if (me.user_role === "treeGrowers") {
          const tgRes = await fetch(`${API}/get_tree_grower_detail/${me.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!tgRes.ok) {
            console.error("Get tree grower detail failed:", tgRes.status);
            throw new Error("Could not load tree grower profile.");
          }

          const tgData = await tgRes.json();

          const rawGroupType = tgData.group?.group_type || "informal_group";
          const mappedGroupType = groupTypeMap[rawGroupType] || rawGroupType;

          setProfile({
            ...EMPTY,
            id: tgData.id,
            email: tgData.email,
            user_role: "treeGrowers",
            is_active: tgData.is_active ? "true" : "false",

            first_name: tgData.profile?.first_name || "",
            middle_name: tgData.profile?.middle_name || "",
            last_name: tgData.profile?.last_name || "",
            birthday: tgData.profile?.birthday || "",
            gender: tgData.profile?.gender || "O",
            contact: tgData.profile?.contact || "",
            address: tgData.profile?.address || "",
            preview_profile: tgData.profile?.profile_img || "",

            group_name: tgData.group?.group_name || "",
            group_type: mappedGroupType,
            group_address: tgData.group?.address || "",
            group_contact: tgData.group?.contact || "",
            preview_group_profile: tgData.group?.profile_img || "",
          });
        } else {
          // Onsite Inspectors and other roles
          const pRes = await fetch(`${API}/get_user/${me.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!pRes.ok) {
            console.error("Get user failed:", pRes.status);
            throw new Error("Could not load profile.");
          }

          const data = await pRes.json();

          setProfile({
            ...EMPTY,
            ...data,
            user_role: me.user_role,
            password: "",
            confirm_pass: "",
            preview_profile: data.profile_img ? `${data.profile_img}` : "",
          });
        }
      } catch (e: any) {
        console.error("Load profile error:", e);
        alert.error("Error", e.message ?? "Failed to load profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Track unsaved changes
  useEffect(() => {
    if (!loading) {
      setHasUnsavedChanges(true);
    }
  }, [profile, profileImgFile, groupImgFile]);

  /* ---- Save ---- */
  const handleSave = async () => {
    if (!userId) return;

    // Validate password if provided
    if (pwd.length > 0) {
      if (!allMet) {
        alert.warning(
          "Weak Password",
          "Password does not meet all requirements.",
        );
        return;
      }
      if (pwd !== profile.confirm_pass) {
        alert.error("Mismatch", "Passwords do not match.");
        return;
      }
    }

    // Validate tree grower specific fields
    if (profile.user_role === "treeGrowers") {
      if (!profile.group_name.trim()) {
        alert.warning("Missing Info", "Group name is required.");
        return;
      }
      if (!profile.group_contact.trim()) {
        alert.warning("Missing Info", "Group contact is required.");
        return;
      }
    }

    // Show confirmation dialog
    alert.confirm(
      "Save Changes?",
      "Are you sure you want to save these changes to your profile?",
      performSave,
      {
        confirmText: "Yes, Save",
        cancelText: "Cancel",
        type: "info",
      },
    );
  };

  // Extracted save logic
  const performSave = async () => {
    setSaving(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      const fd = new FormData();

      // Common fields
      fd.append("email", profile.email);
      fd.append("first_name", profile.first_name);
      fd.append("last_name", profile.last_name);
      fd.append("middle_name", profile.middle_name);
      fd.append("contact", profile.contact);
      fd.append("gender", profile.gender);
      if (profile.birthday) fd.append("birthday", profile.birthday);
      fd.append("address", profile.address);
      fd.append("user_role", profile.user_role);
      fd.append("is_active", profile.is_active);

      if (pwd.length > 0) fd.append("password", pwd);

      if (profileImgFile) {
        fd.append("profile_img", {
          uri: profileImgFile.uri,
          name: profileImgFile.name,
          type: profileImgFile.type,
        } as any);
      }

      let endpoint = `${API}/update_user/${userId}`;

      if (profile.user_role === "treeGrowers") {
        fd.append("group_name", profile.group_name);
        fd.append("group_type", profile.group_type);
        fd.append("group_address", profile.group_address);
        fd.append("group_contact", profile.group_contact);

        if (groupImgFile) {
          fd.append("group_profile_img", {
            uri: groupImgFile.uri,
            name: groupImgFile.name,
            type: groupImgFile.type,
          } as any);
        }
        endpoint = `${API}/update_tree_grower/${userId}/`;
      }

      console.log("Saving to endpoint:", endpoint);
      console.log("User role:", profile.user_role);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}` },
        body: fd,
      });

      // ✅ BETTER ERROR HANDLING - Check if response is JSON
      const contentType = res.headers.get("content-type");
      let data;

      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        // Server returned non-JSON (likely HTML error page)
        const errorText = await res.text();
        console.error("Non-JSON response:", errorText.substring(0, 500));
        throw new Error("Server error. Please try again or contact support.");
      }

      console.log("Response status:", res.status);
      console.log("Response data:", data);

      if (!res.ok) {
        // ✅ Better error messages for backend validation
        const errorMsg = data.error || "Update failed.";

        if (data.fields && Array.isArray(data.fields)) {
          alert.error(
            "Validation Error",
            `Missing required fields: ${data.fields.join(", ")}`,
            5000,
          );
        } else {
          alert.error("Update Failed", errorMsg, 5000);
        }
        return;
      }

      // ✅ Success animation
      Animated.sequence([
        Animated.timing(successScale, {
          toValue: 1.1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(successScale, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();

      setProfile((p) => ({ ...p, password: "", confirm_pass: "" }));
      setProfileImgFile(null);
      setGroupImgFile(null);
      setHasUnsavedChanges(false);

      alert.success("Saved", "Profile updated successfully.");
      setTimeout(() => router.back(), 1500);
    } catch (e: any) {
      console.error("Save error:", e);
      alert.error("Error", e.message ?? "Server error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ✅ Handle back button with unsaved changes warning
  const handleBack = () => {
    if (hasUnsavedChanges) {
      alert.confirm(
        "Discard Changes?",
        "You have unsaved changes. Are you sure you want to leave?",
        () => router.back(),
        {
          confirmText: "Discard",
          cancelText: "Keep Editing",
          type: "warning",
        },
      );
    } else {
      router.back();
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

  const fullName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    "My Profile";

  return (
    <View style={styles.root}>
      {/* ── Custom Header ── */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Avatar Hero ── */}
        <View style={styles.hero}>
          <View style={styles.avatarContainer}>
            {profile.preview_profile ? (
              <Image
                source={{ uri: profile.preview_profile }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>
                  {initials(profile.first_name, profile.last_name)}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.editAvatarBtn}
              onPress={() => pickImage("profile")}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="pencil" size={14} color="#FFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.heroName}>{fullName}</Text>
          {profile.user_role ? (
            <View style={styles.roleBadge}>
              <Ionicons name="shield-checkmark" size={12} color="#0F4A2F" />
              <Text style={styles.roleText}>
                {profile.user_role === "treeGrowers"
                  ? "Tree Grower"
                  : profile.user_role.replace(/([A-Z])/g, " $1").trim()}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Personal Information ── */}
        <SectionCard
          icon="account-outline"
          title="Personal Information"
          subtitle="Name, contact and location"
        >
          <Row>
            <Field
              label="First Name"
              icon="account-outline"
              value={profile.first_name}
              onChangeText={set("first_name")}
              placeholder="First name"
            />
            <Field
              label="Middle Name"
              icon="account-outline"
              value={profile.middle_name}
              onChangeText={set("middle_name")}
              placeholder="Middle name"
            />
          </Row>
          <Field
            label="Last Name"
            icon="account-outline"
            value={profile.last_name}
            onChangeText={set("last_name")}
            placeholder="Last name"
          />
          <Field
            label="Contact Number"
            icon="phone-outline"
            value={profile.contact}
            onChangeText={set("contact")}
            placeholder="+63 912 345 6789"
            keyboardType="phone-pad"
          />
          <Row>
            <PickerField
              label="Gender"
              icon="gender-male-female"
              value={profile.gender}
              onSelect={set("gender")}
              options={[
                { label: "Male", value: "M" },
                { label: "Female", value: "F" },
                { label: "Other", value: "O" },
              ]}
            />
            {/* Birthday with Date Picker */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Birthday</Text>
              <TouchableOpacity
                style={styles.inputRow}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name="cake-variant-outline"
                  size={16}
                  color="#0F4A2F"
                  style={styles.inputIcon}
                />
                <Text
                  style={[
                    styles.input,
                    !profile.birthday && styles.placeholderText,
                  ]}
                >
                  {profile.birthday || "Select date"}
                </Text>
                <Ionicons name="calendar-outline" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </Row>
          <Field
            label="Address"
            icon="map-marker-outline"
            value={profile.address}
            onChangeText={set("address")}
            placeholder="Brgy., City, Province"
          />
        </SectionCard>

        {/* ── Organization Information (Tree Growers Only) ── */}
        {profile.user_role === "treeGrowers" && (
          <SectionCard
            icon="account-group-outline"
            title="Organization Information"
            subtitle="Group and project details"
          >
            <View style={styles.groupAvatarRow}>
              <View style={styles.groupAvatarContainer}>
                {profile.preview_group_profile ? (
                  <Image
                    source={{ uri: profile.preview_group_profile }}
                    style={styles.groupAvatar}
                  />
                ) : (
                  <View style={styles.groupAvatarFallback}>
                    <MaterialCommunityIcons
                      name="leaf"
                      size={32}
                      color="#9CA3AF"
                    />
                  </View>
                )}
                <TouchableOpacity
                  style={styles.editAvatarBtn}
                  onPress={() => pickImage("group_profile")}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name="pencil"
                    size={14}
                    color="#FFF"
                  />
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.groupAvatarLabel}>Group Logo</Text>
                <Text style={styles.groupAvatarHint}>
                  Tap the icon to change
                </Text>
              </View>
            </View>

            <Field
              label="Group Name"
              icon="account-group-outline"
              value={profile.group_name}
              onChangeText={set("group_name")}
              placeholder="Enter group name"
            />

            <PickerField
              label="Group Type"
              icon="domain"
              value={profile.group_type}
              onSelect={set("group_type")}
              options={[
                { label: "Formal Organization", value: "formal_org" },
                { label: "Community Group", value: "community_group" },
                { label: "Informal Group", value: "informal_group" },
              ]}
            />

            <Field
              label="Group Contact"
              icon="phone-outline"
              value={profile.group_contact}
              onChangeText={set("group_contact")}
              placeholder="+63 912 345 6789"
              keyboardType="phone-pad"
            />

            <Field
              label="Group Address"
              icon="map-marker-outline"
              value={profile.group_address}
              onChangeText={set("group_address")}
              placeholder="Brgy., City, Province"
            />
          </SectionCard>
        )}

        {/* ── Account & Security ── */}
        <SectionCard
          icon="shield-lock-outline"
          title="Account & Security"
          subtitle="Email and password settings"
        >
          {/* Email read-only */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Email Address</Text>
            <View style={[styles.inputRow, styles.inputReadonly]}>
              <MaterialCommunityIcons
                name="email-outline"
                size={16}
                color="#9CA3AF"
                style={styles.inputIcon}
              />
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
              <Text style={styles.labelHint}>
                (leave blank to keep current)
              </Text>
            </Text>
            <View style={styles.inputRow}>
              <MaterialCommunityIcons
                name="lock-outline"
                size={16}
                color="#0F4A2F"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                secureTextEntry={!showPwd}
                placeholder="New password"
                placeholderTextColor="#9CA3AF"
                value={pwd}
                onChangeText={set("password")}
              />
              <TouchableOpacity onPress={() => setShowPwd(!showPwd)}>
                <Ionicons
                  name={showPwd ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color="#9CA3AF"
                />
              </TouchableOpacity>
            </View>

            {/* Strength bar + rules */}
            {pwd.length > 0 && (
              <>
                <View style={styles.strengthBg}>
                  <View
                    style={[
                      styles.strengthFill,
                      {
                        width: `${(pwdMet / 5) * 100}%` as any,
                        backgroundColor: strengthColor,
                      },
                    ]}
                  />
                </View>
                <View style={styles.ruleList}>
                  {PWD_RULES.map(({ key, label }) => (
                    <View key={key} style={styles.ruleRow}>
                      <Ionicons
                        name={
                          pwdCheck[key] ? "checkmark-circle" : "ellipse-outline"
                        }
                        size={13}
                        color={pwdCheck[key] ? "#22C55E" : "#D1D5DB"}
                      />
                      <Text
                        style={[
                          styles.ruleText,
                          { color: pwdCheck[key] ? "#22C55E" : "#9CA3AF" },
                        ]}
                      >
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
            <View
              style={[
                styles.inputRow,
                profile.confirm_pass.length > 0 &&
                  (pwd === profile.confirm_pass
                    ? styles.inputMatch
                    : styles.inputMismatch),
              ]}
            >
              <MaterialCommunityIcons
                name="lock-check-outline"
                size={16}
                color="#0F4A2F"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                secureTextEntry={!showCfm}
                placeholder="Re-enter new password"
                placeholderTextColor="#9CA3AF"
                value={profile.confirm_pass}
                onChangeText={set("confirm_pass")}
              />
              <TouchableOpacity onPress={() => setShowCfm(!showCfm)}>
                <Ionicons
                  name={showCfm ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color="#9CA3AF"
                />
              </TouchableOpacity>
            </View>
            {profile.confirm_pass.length > 0 && (
              <Text
                style={[
                  styles.matchHint,
                  {
                    color: pwd === profile.confirm_pass ? "#22C55E" : "#EF4444",
                  },
                ]}
              >
                {pwd === profile.confirm_pass
                  ? "✓ Passwords match"
                  : "Passwords do not match"}
              </Text>
            )}
          </View>
        </SectionCard>

        {/* ── Actions ── */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleBack}
            activeOpacity={0.75}
          >
            <Ionicons name="chevron-back" size={16} color="#6B7280" />
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Animated.View
            style={{ flex: 2, transform: [{ scale: successScale }] }}
          >
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              activeOpacity={0.85}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={16} color="#FFF" />
                  <Text style={styles.saveText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </ScrollView>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={showDatePicker}
        value={profile.birthday}
        onConfirm={(date) => {
          setProfile((p) => ({ ...p, birthday: date }));
          setHasUnsavedChanges(true);
        }}
        onClose={() => setShowDatePicker(false)}
      />
    </View>
  );
}

/* ---------- SUB-COMPONENTS ---------- */
const SectionCard: React.FC<{
  icon: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
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
  label: string;
  icon: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "phone-pad" | "numeric";
  half?: boolean;
}> = ({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
}) => (
  <View style={styles.fieldWrap}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.inputRow}>
      <MaterialCommunityIcons
        name={icon as any}
        size={16}
        color="#0F4A2F"
        style={styles.inputIcon}
      />
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
  label: string;
  icon: string;
  value: string;
  onSelect: (v: string) => void;
  options: { label: string; value: string }[];
}> = ({ label, icon, value, onSelect, options }) => {
  const [pickerVisible, setPickerVisible] = useState(false);

  const current = options.find((o) => o.value === value)?.label ?? value;

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <MaterialCommunityIcons
          name={icon as any}
          size={16}
          color="#0F4A2F"
          style={styles.inputIcon}
        />
        <Pressable
          style={styles.pickerBtn}
          onPress={() => setPickerVisible(true)}
        >
          <Text style={styles.pickerText}>{current}</Text>
          <Ionicons name="chevron-down" size={14} color="#9CA3AF" />
        </Pressable>
      </View>

      {/* Custom Picker Modal */}
      <CustomPicker
        visible={pickerVisible}
        title={label}
        options={options}
        currentValue={value}
        onSelect={(v) => {
          onSelect(v);
          setPickerVisible(false);
        }}
        onClose={() => setPickerVisible(false)}
      />
    </View>
  );
};

/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F4F7F5" },
  loadingScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: { color: "#6B7280", fontSize: 14 },
  headerBar: {
    backgroundColor: "#0F4A2F",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  scroll: { flex: 1 },
  content: {},
  hero: {
    backgroundColor: "#0F4A2F",
    alignItems: "center",
    paddingBottom: 28,
    paddingTop: 8,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 12,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.35)",
  },
  avatarFallback: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.35)",
  },
  avatarInitials: { fontSize: 28, fontWeight: "800", color: "#FFFFFF" },
  editAvatarBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#22C55E",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  heroName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  roleText: { fontSize: 11, fontWeight: "700", color: "#0F4A2F" },
  card: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 18,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  cardIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#E6F4EC",
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#0F2D1C" },
  cardSub: { fontSize: 11, color: "#9CA3AF", marginTop: 1 },
  cardBody: { padding: 16, gap: 4 },
  twoCol: { flexDirection: "row", gap: 10 },
  fieldWrap: { flex: 1, marginBottom: 12 },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  labelHint: {
    fontSize: 10,
    fontWeight: "400",
    color: "#9CA3AF",
    textTransform: "none",
    letterSpacing: 0,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 13, color: "#0F2D1C" },
  placeholderText: { color: "#9CA3AF" },
  inputReadonly: { backgroundColor: "#F3F4F6" },
  readonlyText: { flex: 1, fontSize: 13, color: "#9CA3AF" },
  readonlyTag: {
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  readonlyTagText: { fontSize: 9, color: "#9CA3AF", fontWeight: "600" },
  inputMatch: { borderColor: "#22C55E", backgroundColor: "#F0FDF4" },
  inputMismatch: { borderColor: "#EF4444", backgroundColor: "#FEF2F2" },
  matchHint: { fontSize: 11, marginTop: 4 },
  pickerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerText: { fontSize: 13, color: "#0F2D1C" },
  strengthBg: {
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 8,
  },
  strengthFill: { height: "100%", borderRadius: 2 },
  ruleList: { marginTop: 8, gap: 4 },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ruleText: { fontSize: 11 },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingVertical: 13,
  },
  cancelText: { fontSize: 14, fontWeight: "600", color: "#6B7280" },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#0F4A2F",
    borderRadius: 12,
    paddingVertical: 13,
    elevation: 3,
    shadowColor: "#0F4A2F",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  saveText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },

  /* Group Avatar Styles */
  groupAvatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  groupAvatarContainer: {
    position: "relative",
  },
  groupAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  groupAvatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  groupAvatarLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F2D1C",
  },
  groupAvatarHint: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },
});

/* ---------- DATE PICKER STYLES ---------- */
const dpStyles = StyleSheet.create({
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
    width: 320,
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
