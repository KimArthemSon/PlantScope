import { useState, useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { api } from "@/constants/url_fixed";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Dimensions,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Animated,
  SafeAreaView,
} from "react-native";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Phone,
  MapPin,
  Building2,
  FileText,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Calendar,
  Check,
  Users,
  Image as LucideImage,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import DatePickerModal from "@/components/DatePickerModal";
import PrivacyPolicyModal from "@/components/PrivacyPolicyModal";
import TermsModal from "@/components/TermsModal";
import { useAlert } from "@/components/AlertContext";

const { width: windowWidth, height: windowHeight } = Dimensions.get("window");

const inputStyleOverride = {
  outlineStyle: "none",
  outlineWidth: 0,
  outlineColor: "transparent",
} as any;

const STEPS = [
  { label: "Account Information", title: "Create your\naccount." },
  { label: "Email Verification", title: "Verify your\nemail." },
  { label: "Personal Details", title: "Tell us about\nyourself." },
  { label: "Group & Project", title: "Your group\n& project." },
  { label: "Review & Submit", title: "Review your\napplication." },
];

const GROUP_TYPES = [
  { value: "formal_org", label: "Formal Organization" },
  { value: "community_group", label: "Community Group" },
  { value: "informal_group", label: "Informal Group" },
];

// ─── Sub-components ───
type FieldProps = {
  label: string;
  icon?: React.ReactNode;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  autoCapitalize?: any;
  secureTextEntry?: boolean;
  multiline?: boolean;
  required?: boolean;
};
function Field({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  autoCapitalize = "words",
  secureTextEntry = false,
  multiline = false,
  required = false,
}: FieldProps) {
  return (
    <View style={styles.formGroup}>
      <Text style={styles.label}>
        {label} {required && <Text style={{ color: "#ef4444" }}>*</Text>}
      </Text>
      <View
        style={[
          styles.inputContainer,
          multiline && { alignItems: "flex-start", minHeight: 90 },
        ]}
      >
        {icon && (
          <View style={[styles.inputIcon, multiline && { marginTop: 4 }]}>
            {icon}
          </View>
        )}
        <TextInput
          style={[
            styles.input,
            inputStyleOverride,
            multiline && { textAlignVertical: "top", paddingTop: 4 },
          ]}
          placeholder={placeholder ?? `Enter ${label.toLowerCase()}`}
          placeholderTextColor="#9CA3AF"
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
        />
      </View>
    </View>
  );
}

type FileButtonProps = {
  label: string;
  value: any;
  onPress: () => void;
  isImage?: boolean;
  required?: boolean;
};
function FileButton({
  label,
  value,
  onPress,
  isImage = false,
  required = false,
}: FileButtonProps) {
  return (
    <View style={styles.formGroup}>
      <Text style={styles.label}>
        {label} {required && <Text style={{ color: "#ef4444" }}>*</Text>}
      </Text>
      <TouchableOpacity
        style={styles.fileButton}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {isImage && value ? (
          <LucideImage size={18} color="#6B7280" />
        ) : (
          <FileText size={18} color="#6B7280" />
        )}
        <Text style={styles.fileButtonText} numberOfLines={1}>
          {value ? value.name : `Tap to upload ${label}`}
        </Text>
        {value && <CheckCircle size={16} color="#22C55E" />}
      </TouchableOpacity>
    </View>
  );
}

function GenderPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.formGroup}>
      <Text style={styles.label}>Gender</Text>
      <View style={styles.genderRow}>
        {["Male", "Female", "Other"].map((g) => (
          <TouchableOpacity
            key={g}
            style={[
              styles.genderChip,
              value === g.toLowerCase() && styles.genderChipActive,
            ]}
            onPress={() => onChange(g.toLowerCase())}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.genderChipText,
                value === g.toLowerCase() && styles.genderChipTextActive,
              ]}
            >
              {g}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function GroupTypePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.formGroup}>
      <Text style={styles.label}>
        Group Type <Text style={{ color: "#ef4444" }}>*</Text>
      </Text>
      <View style={styles.groupTypeRow}>
        {GROUP_TYPES.map((type) => (
          <TouchableOpacity
            key={type.value}
            style={[
              styles.groupTypeChip,
              value === type.value && styles.groupTypeChipActive,
            ]}
            onPress={() => onChange(type.value)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.groupTypeChipText,
                value === type.value && styles.groupTypeChipTextActive,
              ]}
            >
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function ReviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.reviewSection}>
      <Text style={styles.reviewSectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue} numberOfLines={2}>
        {value || "—"}
      </Text>
    </View>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function Signup() {
  const router = useRouter();
  const alert = useAlert();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showProposedDatePicker, setShowProposedDatePicker] = useState(false);

  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const [hasViewedPrivacy, setHasViewedPrivacy] = useState(false);
  const [hasViewedTerms, setHasViewedTerms] = useState(false);

  const [otp, setOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const cardSlideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headlineFade = useRef(new Animated.Value(0)).current;

  // Dynamic card height based on step (PRESERVED)
  const getCardMaxHeight = () => {
    switch (step) {
      case 0:
        return windowHeight * 0.52;
      case 1:
        return windowHeight * 0.42;
      case 2:
        return windowHeight * 0.72;
      case 3:
        return windowHeight * 0.72;
      case 4:
        return windowHeight * 0.72;
      default:
        return windowHeight * 0.55;
    }
  };

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => {
    Animated.timing(headlineFade, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
      delay: 100,
    }).start();

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
      delay: 200,
    }).start();

    Animated.spring(cardSlideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
      delay: 300,
    }).start();
  }, []);

  useEffect(() => {
    cardSlideAnim.setValue(30);
    Animated.spring(cardSlideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 60,
      friction: 8,
    }).start();

    // FIX: Reset scroll position to top when step changes
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, 100);
  }, [step]);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    first_name: "",
    middle_name: "",
    last_name: "",
    birthday: "",
    contact: "",
    address: "",
    gender: "",
    profile_img: null as any,
    group_name: "",
    group_type: "",
    group_address: "",
    group_contact: "",
    group_profile: null as any,
    title: "",
    total_treegrowers_will_participate: "",
    maintenance_plan: null as any,
    proposed_orientation_date: "",
  });

  const update = (key: string, value: any) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const pickImage = async (field: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      update(field, {
        uri: asset.uri,
        name: asset.fileName ?? `${field}.jpg`,
        type: asset.mimeType ?? "image/jpeg",
      });
    }
  };

 const pickDocument = async (field: string) => {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      "application/pdf", 
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ],
    copyToCacheDirectory: true,
  });
  if (!result.canceled && result.assets.length > 0) {
    const asset = result.assets[0];
    update(field, {
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType ?? "application/octet-stream",
    });
  }
};

  const validateStep = (): string | null => {
    if (step === 0) {
      if (!formData.email) return "Email is required.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
        return "Enter a valid email.";
      if (!formData.password) return "Password is required.";
      if (
        !/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(
          formData.password,
        )
      )
        return "Password needs uppercase, lowercase, number, special char and 8+ characters.";
      if (formData.password !== formData.confirmPassword)
        return "Passwords do not match.";
    }
    if (step === 2) {
      if (!formData.first_name) return "First name is required.";
      if (!formData.last_name) return "Last name is required.";
      if (!formData.contact) return "Contact number is required.";
      if (!formData.address) return "Address is required.";
      if (!formData.gender) return "Gender is required.";
    }
    if (step === 3) {
      if (!formData.group_name) return "Group name is required.";
      if (!formData.group_type) return "Group type is required.";
      if (!formData.group_address) return "Group address is required.";
      if (!formData.group_contact) return "Group contact is required.";
      if (!formData.title) return "Project title is required.";
      if (!formData.total_treegrowers_will_participate)
        return "Total tree growers is required.";
      const totalGrowers = parseInt(
        formData.total_treegrowers_will_participate,
      );
      if (isNaN(totalGrowers) || totalGrowers < 2) {
        return "Minimum of 2 tree growers required per group.";
      }
      if (!formData.maintenance_plan)
        return "Maintenance plan document is required.";
    }
    return null;
  };

  const sendOtp = async () => {
    setSendingOtp(true);
    try {
      const res = await fetch(api + "/api/send_otp/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert.error(
          "OTP Failed",
          json.error ?? "Failed to send verification code.",
        );
        return;
      }
      setOtp("");
      setResendCooldown(60);
      setStep(1);
      alert.info(
        "Code Sent",
        `Verification code sent to ${formData.email}`,
        3000,
      );
    } catch (e: any) {
      alert.error("Network Error", e.message ?? "Unable to connect to server.");
    } finally {
      setSendingOtp(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) {
      alert.warning(
        "Invalid Code",
        "Please enter the 6-digit code sent to your email.",
      );
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(api + "/api/verify_otp/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email, otp }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert.error("Verification Failed", json.error ?? "Incorrect code.");
        return;
      }
      alert.success(
        "Email Verified",
        "Your email has been successfully verified!",
      );
      setStep(2);
    } catch (e: any) {
      alert.error("Network Error", e.message ?? "Unable to connect to server.");
    } finally {
      setLoading(false);
    }
  };

  const goNext = () => {
    if (step === 0) {
      const err = validateStep();
      if (err) {
        alert.warning("Missing Information", err);
        return;
      }
      sendOtp();
      return;
    }
    if (step === 1) {
      verifyOtp();
      return;
    }
    const err = validateStep();
    if (err) {
      alert.warning("Missing Information", err);
      return;
    }
    setStep((s) => s + 1);
  };

  const goBack = () => {
    if (step === 1) setOtp("");
    setStep((s) => s - 1);
  };

  const handleAgreementToggle = () => {
    if (!hasViewedPrivacy || !hasViewedTerms) {
      alert.warning(
        "Documents Required",
        "Please read both the Privacy Policy and Terms & Conditions before agreeing.",
        4000,
      );
      return;
    }
    setAgreedToPrivacy(!agreedToPrivacy);
  };

  const handleSubmit = () => {
    if (!agreedToPrivacy) {
      alert.warning(
        "Agreement Required",
        "Please agree to the Privacy Policy and Terms & Conditions before submitting.",
      );
      return;
    }
    alert.confirm(
      "Submit Application?",
      "Are you sure you want to submit your tree grower application? Please ensure all information is accurate. Once submitted, your application will be reviewed by the administrator.",
      performSubmit,
      {
        confirmText: "Yes, Submit",
        cancelText: "Review Again",
        type: "warning",
      },
    );
  };

  const performSubmit = async () => {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("email", formData.email);
      fd.append("password", formData.password);
      fd.append("user_role", "treeGrowers");
      fd.append("first_name", formData.first_name);
      fd.append("last_name", formData.last_name);
      fd.append("middle_name", formData.middle_name);
      fd.append("contact", formData.contact);
      fd.append("address", formData.address);
      if (formData.birthday) fd.append("birthday", formData.birthday);
      let g = "O";
      if (formData.gender === "male") g = "M";
      else if (formData.gender === "female") g = "F";
      fd.append("gender", g);
      fd.append("is_active", "false");
      if (formData.profile_img) {
        fd.append("profile_img", {
          uri: formData.profile_img.uri,
          name: formData.profile_img.name,
          type: formData.profile_img.type,
        } as any);
      }
      fd.append("group_name", formData.group_name);
      fd.append("group_type", formData.group_type);
      fd.append("group_address", formData.group_address);
      fd.append("group_contact", formData.group_contact);
      if (formData.group_profile) {
        fd.append("group_profile", {
          uri: formData.group_profile.uri,
          name: formData.group_profile.name,
          type: formData.group_profile.type,
        } as any);
      }
      fd.append("title", formData.title);
      fd.append(
        "total_treegrowers_will_participate",
        formData.total_treegrowers_will_participate,
      );
      if (formData.proposed_orientation_date) {
        fd.append(
          "proposed_orientation_date",
          formData.proposed_orientation_date,
        );
      }
      if (formData.maintenance_plan) {
        fd.append("maintenance_plan", {
          uri: formData.maintenance_plan.uri,
          name: formData.maintenance_plan.name,
          type: formData.maintenance_plan.type,
        } as any);
      }
      const res = await fetch(api + "/api/register_tree_grower/", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        alert.error(
          "Registration Failed",
          json.error ?? "Something went wrong. Please try again.",
          5000,
        );
        return;
      }
      alert.success(
        "Application Submitted! 🌱",
        "Your application has been successfully sent and is now under evaluation. You will be notified via email once your application is accepted or rejected. Please check your email regularly for updates.",
        8000,
      );
      setTimeout(() => {
        router.push("/homepage");
      }, 2500);
    } catch (e: any) {
      alert.error(
        "Connection Error",
        e.message ??
          "Unable to reach the server. Please check your internet connection.",
        5000,
      );
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <>
            <Field
              label="Email Address"
              icon={<Mail size={18} color="#9CA3AF" />}
              value={formData.email}
              onChangeText={(v) => update("email", v)}
              keyboardType="email-address"
              autoCapitalize="none"
              required
            />
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Password <Text style={{ color: "#ef4444" }}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <View style={styles.inputIcon}>
                  <Lock size={18} color="#9CA3AF" />
                </View>
                <TextInput
                  style={[styles.input, inputStyleOverride]}
                  placeholder="Enter password"
                  placeholderTextColor="#9CA3AF"
                  value={formData.password}
                  onChangeText={(v) => update("password", v)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  {showPassword ? (
                    <EyeOff size={18} color="#9CA3AF" />
                  ) : (
                    <Eye size={18} color="#9CA3AF" />
                  )}
                </TouchableOpacity>
              </View>
              <Text style={styles.hint}>
                8+ chars · uppercase · lowercase · number · special char
              </Text>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Confirm Password <Text style={{ color: "#ef4444" }}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <View style={styles.inputIcon}>
                  <Lock size={18} color="#9CA3AF" />
                </View>
                <TextInput
                  style={[styles.input, inputStyleOverride]}
                  placeholder="Confirm password"
                  placeholderTextColor="#9CA3AF"
                  value={formData.confirmPassword}
                  onChangeText={(v) => update("confirmPassword", v)}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeButton}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} color="#9CA3AF" />
                  ) : (
                    <Eye size={18} color="#9CA3AF" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </>
        );
      case 1:
        return (
          <>
            <View style={styles.otpEmailBadge}>
              <Mail size={14} color="#22C55E" />
              <Text style={styles.otpEmailText} numberOfLines={1}>
                {formData.email}
              </Text>
            </View>
            <View style={styles.otpWrapper}>
              <TextInput
                ref={otpInputRef}
                style={[styles.otpHiddenInput, inputStyleOverride]}
                value={otp}
                onChangeText={(v) =>
                  setOtp(v.replace(/[^0-9]/g, "").slice(0, 6))
                }
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
              <TouchableOpacity
                style={styles.otpBoxRow}
                onPress={() => otpInputRef.current?.focus()}
                activeOpacity={1}
              >
                {Array(6)
                  .fill(null)
                  .map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.otpBox,
                        otp.length > i && styles.otpBoxFilled,
                        otp.length === i && styles.otpBoxCursor,
                      ]}
                    >
                      <Text style={styles.otpBoxText}>{otp[i] ?? ""}</Text>
                    </View>
                  ))}
              </TouchableOpacity>
            </View>
            <Text style={styles.otpNote}>
              Didn't receive the code? Check your spam folder or{" "}
            </Text>
            <TouchableOpacity
              onPress={sendOtp}
              disabled={resendCooldown > 0 || sendingOtp}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.otpResend,
                  (resendCooldown > 0 || sendingOtp) &&
                    styles.otpResendDisabled,
                ]}
              >
                {sendingOtp
                  ? "Sending…"
                  : resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : "Resend Code"}
              </Text>
            </TouchableOpacity>
          </>
        );
      case 2:
        return (
          <>
            <Field
              label="First Name"
              icon={<User size={18} color="#9CA3AF" />}
              value={formData.first_name}
              onChangeText={(v) => update("first_name", v)}
              required
            />
            <Field
              label="Middle Name"
              icon={<User size={18} color="#9CA3AF" />}
              value={formData.middle_name}
              onChangeText={(v) => update("middle_name", v)}
            />
            <Field
              label="Last Name"
              icon={<User size={18} color="#9CA3AF" />}
              value={formData.last_name}
              onChangeText={(v) => update("last_name", v)}
              required
            />
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Birthday{" "}
                <Text style={{ color: "#9CA3AF", fontSize: 10 }}>
                  (optional)
                </Text>
              </Text>
              <TouchableOpacity
                style={styles.inputContainer}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
              >
                <View style={styles.inputIcon}>
                  <Calendar size={18} color="#9CA3AF" />
                </View>
                <Text
                  style={[
                    styles.dateDisplay,
                    !formData.birthday && styles.dateDisplayPlaceholder,
                  ]}
                >
                  {formData.birthday || "Select your birthday"}
                </Text>
                <Calendar size={16} color="#22C55E" />
              </TouchableOpacity>
            </View>
            <Field
              label="Contact Number"
              icon={<Phone size={18} color="#9CA3AF" />}
              value={formData.contact}
              onChangeText={(v) => update("contact", v)}
              keyboardType="phone-pad"
              autoCapitalize="none"
              required
            />
            <Field
              label="Address"
              icon={<MapPin size={18} color="#9CA3AF" />}
              value={formData.address}
              onChangeText={(v) => update("address", v)}
              required
            />
            <GenderPicker
              value={formData.gender}
              onChange={(v) => update("gender", v)}
            />
            <FileButton
              label="Profile Image"
              value={formData.profile_img}
              onPress={() => pickImage("profile_img")}
              isImage
            />
          </>
        );
      case 3:
        return (
          <>
            <Text style={styles.sectionHeading}>Group Details</Text>
            <Field
              label="Group Name"
              icon={<Building2 size={18} color="#9CA3AF" />}
              value={formData.group_name}
              onChangeText={(v) => update("group_name", v)}
              required
            />
            <GroupTypePicker
              value={formData.group_type}
              onChange={(v) => update("group_type", v)}
            />
            <Field
              label="Group Address"
              icon={<MapPin size={18} color="#9CA3AF" />}
              value={formData.group_address}
              onChangeText={(v) => update("group_address", v)}
              required
            />
            <Field
              label="Group Contact"
              icon={<Phone size={18} color="#9CA3AF" />}
              value={formData.group_contact}
              onChangeText={(v) => update("group_contact", v)}
              keyboardType="phone-pad"
              autoCapitalize="none"
              required
            />
            <FileButton
              label="Group Logo"
              value={formData.group_profile}
              onPress={() => pickImage("group_profile")}
              isImage
            />

            <Text style={[styles.sectionHeading, { marginTop: 18 }]}>
              Project / Application
            </Text>
            <Field
              label="Project Title"
              icon={<FileText size={18} color="#9CA3AF" />}
              value={formData.title}
              onChangeText={(v) => update("title", v)}
              required
            />
            <Field
              label="Total Tree Growers"
              icon={<Users size={18} color="#9CA3AF" />}
              value={formData.total_treegrowers_will_participate}
              onChangeText={(v) =>
                update("total_treegrowers_will_participate", v)
              }
              keyboardType="numeric"
              autoCapitalize="none"
              required
            />
            <Text style={styles.hint}>
              Minimum 2 tree growers required per group
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Proposed Orientation Date{" "}
                <Text style={{ color: "#9CA3AF", fontSize: 10 }}>
                  (optional)
                </Text>
              </Text>
              <TouchableOpacity
                style={styles.inputContainer}
                onPress={() => setShowProposedDatePicker(true)}
                activeOpacity={0.7}
              >
                <View style={styles.inputIcon}>
                  <Calendar size={18} color="#9CA3AF" />
                </View>
                <Text
                  style={[
                    styles.dateDisplay,
                    !formData.proposed_orientation_date &&
                      styles.dateDisplayPlaceholder,
                  ]}
                >
                  {formData.proposed_orientation_date ||
                    "Select preferred date (optional)"}
                </Text>
                <Calendar size={16} color="#22C55E" />
              </TouchableOpacity>
            </View>

            <FileButton
              label="Maintenance Plan"
              value={formData.maintenance_plan}
              onPress={() => pickDocument("maintenance_plan")}
              required
            />

            <View style={styles.noteBox}>
              <Text style={styles.noteText}>
                🌱 <Text style={styles.noteBold}>Seedling Request:</Text> You
                can request seedlings after your application is accepted and you
                know your assigned site.
              </Text>
            </View>
          </>
        );
      case 4:
        return (
          <>
            <ReviewSection title="Account">
              <ReviewRow label="Email" value={formData.email} />
              <ReviewRow label="Password" value="••••••••" />
            </ReviewSection>

            <ReviewSection title="Personal">
              <ReviewRow
                label="Name"
                value={`${formData.first_name} ${formData.middle_name} ${formData.last_name}`.trim()}
              />
              <ReviewRow
                label="Birthday"
                value={formData.birthday || "Not provided"}
              />
              <ReviewRow label="Contact" value={formData.contact} />
              <ReviewRow label="Address" value={formData.address} />
              <ReviewRow label="Gender" value={formData.gender} />
              <ReviewRow
                label="Profile Image"
                value={formData.profile_img?.name ?? "Not provided"}
              />
            </ReviewSection>

            <ReviewSection title="Group">
              <ReviewRow label="Group Name" value={formData.group_name} />
              <ReviewRow
                label="Group Type"
                value={
                  GROUP_TYPES.find((t) => t.value === formData.group_type)
                    ?.label || "—"
                }
              />
              <ReviewRow label="Group Address" value={formData.group_address} />
              <ReviewRow label="Group Contact" value={formData.group_contact} />
              <ReviewRow
                label="Group Logo"
                value={formData.group_profile?.name ?? "Not provided"}
              />
            </ReviewSection>

            <ReviewSection title="Project">
              <ReviewRow label="Title" value={formData.title} />
              <ReviewRow
                label="Tree Growers"
                value={formData.total_treegrowers_will_participate}
              />
              <ReviewRow
                label="Proposed Orientation"
                value={formData.proposed_orientation_date || "Not specified"}
              />
              <ReviewRow
                label="Maintenance Plan"
                value={formData.maintenance_plan?.name ?? "—"}
              />
            </ReviewSection>

            <View style={styles.noteBox}>
              <Text style={styles.noteText}>
                ⚠️ Your account will be set as{" "}
                <Text style={styles.noteBold}>For Evaluation</Text> until
                approved by an administrator.
              </Text>
            </View>

            <View style={styles.privacyAgreementBox}>
              <View style={styles.legalInfoBox}>
                <Text style={styles.legalInfoText}>
                  Before submitting, please read our{" "}
                  <Text
                    style={[
                      styles.privacyLink,
                      hasViewedPrivacy && styles.privacyLinkViewed,
                    ]}
                    onPress={() => setShowPrivacyPolicy(true)}
                  >
                    {hasViewedPrivacy ? "✓ " : ""}Data Privacy Notice
                  </Text>{" "}
                  and{" "}
                  <Text
                    style={[
                      styles.privacyLink,
                      hasViewedTerms && styles.privacyLinkViewed,
                    ]}
                    onPress={() => setShowTerms(true)}
                  >
                    {hasViewedTerms ? "✓ " : ""}Terms & Conditions
                  </Text>
                  .
                </Text>
              </View>

              {(!hasViewedPrivacy || !hasViewedTerms) && (
                <View style={styles.viewStatusBox}>
                  <Text style={styles.viewStatusText}>
                    {!hasViewedPrivacy && !hasViewedTerms
                      ? "📖 Please read both documents before agreeing"
                      : !hasViewedPrivacy
                        ? " Please read the Privacy Policy first"
                        : "📖 Please read the Terms & Conditions first"}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.checkRow,
                  (!hasViewedPrivacy || !hasViewedTerms) &&
                    styles.checkRowDisabled,
                ]}
                onPress={handleAgreementToggle}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.checkbox,
                    agreedToPrivacy && styles.checkboxChecked,
                    (!hasViewedPrivacy || !hasViewedTerms) &&
                      styles.checkboxDisabled,
                  ]}
                >
                  {agreedToPrivacy && (
                    <Check size={11} color="#ffffff" strokeWidth={3} />
                  )}
                </View>
                <Text
                  style={[
                    styles.privacyText,
                    (!hasViewedPrivacy || !hasViewedTerms) &&
                      styles.privacyTextDisabled,
                  ]}
                >
                  I agree to the Privacy Notice and Terms & Conditions
                </Text>
              </TouchableOpacity>
            </View>
          </>
        );
      default:
        return null;
    }
  };

  const cardMaxHeight = getCardMaxHeight();

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ImageBackground
          source={{
            uri: "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=800&h=1200&fit=crop",
          }}
          style={styles.background}
          resizeMode="cover"
        >
          <View style={styles.overlay} />

          {/* Top Brand & Headline - Safe Area Aware */}
          <Animated.View
            style={[
              styles.topWrapper,
              { opacity: headlineFade, paddingTop: insets.top },
            ]}
          >
            <Text style={styles.brandText}>PlantScope</Text>

            <View style={{ marginTop: windowHeight * 0.12 }}>
              <Text style={styles.headline}>{STEPS[step].title}</Text>
              <Text style={styles.stepIndicator}>
                Step {step + 1} of {STEPS.length} · {STEPS[step].label}
              </Text>
            </View>

            <View style={[styles.dotsContainer, { marginTop: 24 }]}>
              {STEPS.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === step && styles.dotActive,
                    i < step && styles.dotDone,
                  ]}
                />
              ))}
            </View>
          </Animated.View>

          {/* Bottom Card - Dynamic Height */}
          <Animated.View
            style={[
              styles.card,
              {
                transform: [{ translateY: cardSlideAnim }],
                maxHeight: cardMaxHeight,
              },
            ]}
          >
            <ScrollView
              ref={scrollViewRef}
              contentContainerStyle={[
                styles.cardScrollContent,
                { paddingBottom: 16 + insets.bottom }, // FIX: Prevents nav bar overlap
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
              indicatorStyle="black"
              bounces={true}
              overScrollMode="always"
            >
              {renderStep()}

              {/* Navigation */}
              <View style={styles.navRow}>
                {step > 0 && (
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={goBack}
                    activeOpacity={0.7}
                  >
                    <ChevronLeft size={18} color="#6B7280" />
                    <Text style={styles.backButtonText}>Back</Text>
                  </TouchableOpacity>
                )}

                {step < 4 ? (
                  <TouchableOpacity
                    style={[
                      styles.nextButton,
                      step === 0 && styles.nextButtonFull,
                      (sendingOtp || loading) && styles.nextButtonDisabled,
                    ]}
                    onPress={goNext}
                    disabled={sendingOtp || loading}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.nextButtonText}>
                      {step === 0 && sendingOtp
                        ? "Sending Code…"
                        : step === 1 && loading
                          ? "Verifying…"
                          : step === 1
                            ? "Verify Email"
                            : "Continue"}
                    </Text>
                    {!(sendingOtp || loading) && (
                      <ChevronRight size={18} color="#fff" />
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.nextButton,
                      loading && styles.nextButtonDisabled,
                    ]}
                    onPress={handleSubmit}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.nextButtonText}>
                      {loading ? "Submitting…" : "Submit Application"}
                    </Text>
                    {!loading && <CheckCircle size={18} color="#fff" />}
                  </TouchableOpacity>
                )}
              </View>

              {/* Bottom link */}
              {step === 0 && (
                <View style={styles.bottomText}>
                  <Text style={styles.registerText}>
                    Already have an account?{" "}
                  </Text>
                  <TouchableOpacity onPress={() => router.push("/homepage")}>
                    <Text style={styles.registerLink}>Sign In</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </ImageBackground>

        <DatePickerModal
          visible={showDatePicker}
          value={formData.birthday}
          onConfirm={(d) => update("birthday", d)}
          onClose={() => setShowDatePicker(false)}
        />
        <DatePickerModal
          visible={showProposedDatePicker}
          value={formData.proposed_orientation_date}
          onConfirm={(d) => update("proposed_orientation_date", d)}
          onClose={() => setShowProposedDatePicker(false)}
        />

        <PrivacyPolicyModal
          visible={showPrivacyPolicy}
          onClose={() => setShowPrivacyPolicy(false)}
          onViewed={() => setHasViewedPrivacy(true)}
          hasViewed={hasViewedPrivacy}
        />
        <TermsModal
          visible={showTerms}
          onClose={() => setShowTerms(false)}
          onViewed={() => setHasViewedTerms(true)}
          hasViewed={hasViewedTerms}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0B0F0D",
  },
  root: {
    flex: 1,
    backgroundColor: "#0B0F0D",
  },
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11, 15, 13, 0.78)",
  },
  topWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingLeft: 24,
    paddingRight: 24,
  },
  brandText: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 15,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  headline: {
    fontSize: 30,
    fontWeight: "700",
    color: "#ffffff",
    lineHeight: 38,
    letterSpacing: -0.3,
  },
  stepIndicator: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.5)",
    marginTop: 8,
    fontWeight: "500",
  },
  dotsContainer: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  dotActive: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    width: 18,
    borderRadius: 3,
  },
  dotDone: {
    backgroundColor: "#22C55E",
  },
  card: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    zIndex: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 20,
  },
  cardScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16, // Base padding, overridden inline with insets.bottom
    flexGrow: 1,
  },
  formGroup: { marginBottom: 12 },
  label: {
    color: "#374151",
    fontSize: 12,
    marginBottom: 5,
    fontWeight: "600",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 4,
    minHeight: 46,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    color: "#1C1C1E",
    fontSize: 15,
    paddingVertical: 6,
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  dateDisplay: {
    flex: 1,
    color: "#1C1C1E",
    fontSize: 15,
    paddingVertical: 6,
  },
  dateDisplayPlaceholder: { color: "#9CA3AF" },
  eyeButton: { padding: 6 },
  hint: { fontSize: 10, color: "#9CA3AF", marginTop: 3 },
  genderRow: { flexDirection: "row", gap: 8 },
  genderChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    alignItems: "center",
  },
  genderChipActive: {
    borderColor: "#22C55E",
    backgroundColor: "#F0FDF4",
  },
  genderChipText: { color: "#6B7280", fontSize: 13, fontWeight: "600" },
  genderChipTextActive: { color: "#1C1C1E" },
  fileButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  fileButtonText: { flex: 1, color: "#6B7280", fontSize: 13 },
  sectionHeading: {
    fontSize: 11,
    color: "#22C55E",
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
    marginTop: 4,
  },
  reviewSection: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
  },
  reviewSectionTitle: {
    fontSize: 11,
    color: "#22C55E",
    fontWeight: "700",
    marginBottom: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.04)",
  },
  reviewLabel: { color: "#6B7280", fontSize: 12, flex: 1 },
  reviewValue: {
    color: "#1C1C1E",
    fontSize: 12,
    flex: 2,
    textAlign: "right",
    fontWeight: "600",
  },
  noteBox: {
    backgroundColor: "rgba(34, 197, 94, 0.06)",
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.15)",
  },
  noteText: { color: "#374151", fontSize: 12, lineHeight: 18 },
  noteBold: { color: "#22C55E", fontWeight: "700" },
  privacyAgreementBox: {
    marginTop: 12,
    padding: 14,
    backgroundColor: "rgba(34, 197, 94, 0.04)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.15)",
  },
  legalInfoBox: {
    backgroundColor: "rgba(0,0,0,0.02)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
  },
  legalInfoText: { color: "#6B7280", fontSize: 12, lineHeight: 19 },
  viewStatusBox: {
    backgroundColor: "rgba(245,158,11,0.06)",
    borderLeftWidth: 3,
    borderLeftColor: "#f59e0b",
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
  },
  viewStatusText: {
    color: "#D97706",
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 16,
  },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkRowDisabled: { opacity: 0.5 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  checkboxDisabled: { opacity: 0.5 },
  privacyText: { flex: 1, color: "#374151", fontSize: 12, lineHeight: 18 },
  privacyTextDisabled: { color: "#9CA3AF" },
  privacyLink: { color: "#22C55E", fontWeight: "700" },
  privacyLinkViewed: { color: "#16A34A", textDecorationLine: "underline" },
  otpEmailBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(34, 197, 94, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.2)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 22,
  },
  otpEmailText: { color: "#374151", fontSize: 13, flex: 1 },
  otpWrapper: { alignItems: "center", marginBottom: 20, height: 54 },
  otpHiddenInput: {
    position: "absolute",
    opacity: 0,
    width: "100%",
    height: 54,
    zIndex: 10,
  },
  otpBoxRow: { flexDirection: "row", gap: 8 },
  otpBox: {
    width: 44,
    height: 54,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
  },
  otpBoxFilled: { borderColor: "#22C55E", backgroundColor: "#F0FDF4" },
  otpBoxCursor: { borderColor: "#22C55E", borderWidth: 2 },
  otpBoxText: { color: "#1C1C1E", fontSize: 22, fontWeight: "700" },
  otpNote: {
    color: "#9CA3AF",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 4,
  },
  otpResend: {
    color: "#22C55E",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  otpResendDisabled: { color: "#9CA3AF" },
  navRow: { flexDirection: "row", marginTop: 16, gap: 10 },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 4,
    backgroundColor: "#F9FAFB",
  },
  backButtonText: { color: "#6B7280", fontSize: 14, fontWeight: "600" },
  nextButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#22C55E",
    borderRadius: 12,
    paddingVertical: 14,
    gap: 6,
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  nextButtonFull: { flex: 1 },
  nextButtonDisabled: { opacity: 0.5, shadowOpacity: 0, elevation: 0 },
  nextButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  bottomText: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 16,
  },
  registerText: { color: "#6B7280", fontSize: 13 },
  registerLink: { color: "#22C55E", fontWeight: "700", fontSize: 13 },
  groupTypeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  groupTypeChip: {
    flex: 1,
    minWidth: 100,
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    marginBottom: 8,
  },
  groupTypeChipActive: {
    borderColor: "#22C55E",
    backgroundColor: "#F0FDF4",
  },
  groupTypeChipText: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  groupTypeChipTextActive: {
    color: "#1C1C1E",
  },
});
