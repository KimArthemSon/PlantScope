import { useState, useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { api } from "@/constants/url_fixed";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
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
  Shield,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

// ✅ Import extracted components
import DatePickerModal from "@/components/DatePickerModal";
import PrivacyPolicyModal from "@/components/PrivacyPolicyModal";
import TermsModal from "@/components/TermsModal";

// ✅ Import custom alert
import { useAlert } from "@/components/AlertContext";

const { width: windowWidth } = Dimensions.get("window");
const MAX_CARD_WIDTH = 480;
const HORIZONTAL_PADDING = 16;

const inputStyleOverride = {
  outlineStyle: "none",
  outlineWidth: 0,
  outlineColor: "transparent",
} as any;

const STEPS = [
  { label: "Account", icon: "🔐", Icon: Lock },
  { label: "Verify", icon: "📧", Icon: Mail },
  { label: "Personal", icon: "👤", Icon: User },
  { label: "Group", icon: "🌿", Icon: Building2 },
  { label: "Review", icon: "✅", Icon: CheckCircle },
];

const GROUP_TYPES = [
  { value: "formal_org", label: "Formal Organization" },
  { value: "community_group", label: "Community Group" },
  { value: "informal_group", label: "Informal Group" },
];

// ─── Sub-components (Field, FileButton, GenderPicker, GroupTypePicker, ReviewSection, ReviewRow) ───
// [Keep these exactly as they were in your original file - no changes needed]

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
  label, icon, value, onChangeText, placeholder,
  keyboardType = "default", autoCapitalize = "words",
  secureTextEntry = false, multiline = false, required = false,
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
          placeholderTextColor="#5a8a6a"
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
function FileButton({ label, value, onPress, isImage = false, required = false }: FileButtonProps) {
  return (
    <View style={styles.formGroup}>
      <Text style={styles.label}>
        {label} {required && <Text style={{ color: "#ef4444" }}>*</Text>}
      </Text>
      {isImage && value?.uri ? (
        <TouchableOpacity
          style={styles.imagePreviewBtn}
          onPress={onPress}
          activeOpacity={0.8}
        >
          <Image source={{ uri: value.uri }} style={styles.imagePreview} resizeMode="cover" />
          <View style={styles.imagePreviewOverlay}>
            <Text style={styles.imagePreviewText}>Tap to change</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.fileButton} onPress={onPress} activeOpacity={0.7}>
          <FileText size={18} color="#a8c5b3" />
          <Text style={styles.fileButtonText} numberOfLines={1}>
            {value ? value.name : `Tap to upload ${label}`}
          </Text>
          {value && <CheckCircle size={16} color="#4caf72" />}
        </TouchableOpacity>
      )}
    </View>
  );
}

function GenderPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.formGroup}>
      <Text style={styles.label}>Gender</Text>
      <View style={styles.genderRow}>
        {["Male", "Female", "Other"].map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.genderChip, value === g.toLowerCase() && styles.genderChipActive]}
            onPress={() => onChange(g.toLowerCase())}
            activeOpacity={0.7}
          >
            <Text style={[styles.genderChipText, value === g.toLowerCase() && styles.genderChipTextActive]}>
              {g}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function GroupTypePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.formGroup}>
      <Text style={styles.label}>
        Group Type <Text style={{ color: "#ef4444" }}>*</Text>
      </Text>
      <View style={styles.groupTypeRow}>
        {GROUP_TYPES.map((type) => (
          <TouchableOpacity
            key={type.value}
            style={[styles.groupTypeChip, value === type.value && styles.groupTypeChipActive]}
            onPress={() => onChange(type.value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.groupTypeChipText, value === type.value && styles.groupTypeChipTextActive]}>
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
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
  const alert = useAlert(); // ✅ Custom alert hook
  
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showProposedDatePicker, setShowProposedDatePicker] = useState(false);

  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // ✅ Track whether user has actually viewed the documents
  const [hasViewedPrivacy, setHasViewedPrivacy] = useState(false);
  const [hasViewedTerms, setHasViewedTerms] = useState(false);

  const [otp, setOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

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
      type: ["application/pdf", "image/*"],
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
      if (!/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(formData.password))
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

      const totalGrowers = parseInt(formData.total_treegrowers_will_participate);
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
        alert.error("OTP Failed", json.error ?? "Failed to send verification code.");
        return;
      }
      setOtp("");
      setResendCooldown(60);
      setStep(1);
      alert.info("Code Sent", `Verification code sent to ${formData.email}`, 3000);
    } catch (e: any) {
      alert.error("Network Error", e.message ?? "Unable to connect to server.");
    } finally {
      setSendingOtp(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) {
      alert.warning("Invalid Code", "Please enter the 6-digit code sent to your email.");
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
      alert.success("Email Verified", "Your email has been successfully verified!");
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
    if (step === 1) {
      setOtp("");
    }
    setStep((s) => s - 1);
  };

  // ✅ Handle agreement checkbox - must have viewed both documents
  const handleAgreementToggle = () => {
    if (!hasViewedPrivacy || !hasViewedTerms) {
      alert.warning(
        "Documents Required",
        "Please read both the Privacy Policy and Terms & Conditions before agreeing.",
        4000
      );
      return;
    }
    setAgreedToPrivacy(!agreedToPrivacy);
  };

  // ✅ Submit with confirmation dialog
  const handleSubmit = () => {
    if (!agreedToPrivacy) {
      alert.warning(
        "Agreement Required",
        "Please agree to the Privacy Policy and Terms & Conditions before submitting."
      );
      return;
    }

    // Show confirmation dialog before submitting
    alert.confirm(
      "Submit Application?",
      "Are you sure you want to submit your tree grower application? Please ensure all information is accurate. Once submitted, your application will be reviewed by the administrator.",
      performSubmit,
      {
        confirmText: "Yes, Submit",
        cancelText: "Review Again",
        type: "warning",
      }
    );
  };

  // ✅ Actual submission logic
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

      if (formData.birthday) {
        fd.append("birthday", formData.birthday);
      }

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
      fd.append("total_treegrowers_will_participate", formData.total_treegrowers_will_participate);

      if (formData.proposed_orientation_date) {
        fd.append("proposed_orientation_date", formData.proposed_orientation_date);
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
          5000
        );
        return;
      }

      // ✅ Success - show informative alert with button to go to homepage
      alert.success(
        "Application Submitted! 🌱",
        "Your application has been successfully sent and is now under evaluation. You will be notified via email once your application is accepted or rejected. Please check your email regularly for updates.",
        8000
      );

      // Navigate to homepage after a short delay
      setTimeout(() => {
        router.push("/homepage");
      }, 2500);
    } catch (e: any) {
      alert.error(
        "Connection Error",
        e.message ?? "Unable to reach the server. Please check your internet connection.",
        5000
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
            <Text style={styles.stepTitle}>Account Information</Text>
            <Text style={styles.stepSubtitle}>Set up your login credentials</Text>
            <Field
              label="Email Address"
              icon={<Mail size={18} color="#5a8a6a" />}
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
                  <Lock size={18} color="#5a8a6a" />
                </View>
                <TextInput
                  style={[styles.input, inputStyleOverride]}
                  placeholder="Enter password"
                  placeholderTextColor="#5a8a6a"
                  value={formData.password}
                  onChangeText={(v) => update("password", v)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  {showPassword ? <EyeOff size={18} color="#5a8a6a" /> : <Eye size={18} color="#5a8a6a" />}
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
                  <Lock size={18} color="#5a8a6a" />
                </View>
                <TextInput
                  style={[styles.input, inputStyleOverride]}
                  placeholder="Confirm password"
                  placeholderTextColor="#5a8a6a"
                  value={formData.confirmPassword}
                  onChangeText={(v) => update("confirmPassword", v)}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeButton}
                >
                  {showConfirmPassword ? <EyeOff size={18} color="#5a8a6a" /> : <Eye size={18} color="#5a8a6a" />}
                </TouchableOpacity>
              </View>
            </View>
          </>
        );
      case 1:
        return (
          <>
            <Text style={styles.stepTitle}>Verify Your Email</Text>
            <Text style={styles.stepSubtitle}>
              Enter the 6-digit code sent to your email
            </Text>
            <View style={styles.otpEmailBadge}>
              <Mail size={14} color="#4caf72" />
              <Text style={styles.otpEmailText} numberOfLines={1}>
                {formData.email}
              </Text>
            </View>
            <View style={styles.otpWrapper}>
              <TextInput
                ref={otpInputRef}
                style={[styles.otpHiddenInput, inputStyleOverride]}
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, "").slice(0, 6))}
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
                  (resendCooldown > 0 || sendingOtp) && styles.otpResendDisabled,
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
            <Text style={styles.stepTitle}>Personal Information</Text>
            <Text style={styles.stepSubtitle}>Tell us a little about yourself</Text>
            <Field
              label="First Name"
              icon={<User size={18} color="#5a8a6a" />}
              value={formData.first_name}
              onChangeText={(v) => update("first_name", v)}
              required
            />
            <Field
              label="Middle Name"
              icon={<User size={18} color="#5a8a6a" />}
              value={formData.middle_name}
              onChangeText={(v) => update("middle_name", v)}
            />
            <Field
              label="Last Name"
              icon={<User size={18} color="#5a8a6a" />}
              value={formData.last_name}
              onChangeText={(v) => update("last_name", v)}
              required
            />
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Birthday{" "}
                <Text style={{ color: "#5a8a6a", fontSize: 10 }}>(optional)</Text>
              </Text>
              <TouchableOpacity
                style={styles.inputContainer}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
              >
                <View style={styles.inputIcon}>
                  <Calendar size={18} color="#5a8a6a" />
                </View>
                <Text
                  style={[
                    styles.dateDisplay,
                    !formData.birthday && styles.dateDisplayPlaceholder,
                  ]}
                >
                  {formData.birthday || "Select your birthday"}
                </Text>
                <Calendar size={16} color="#2d5f3c" />
              </TouchableOpacity>
            </View>
            <Field
              label="Contact Number"
              icon={<Phone size={18} color="#5a8a6a" />}
              value={formData.contact}
              onChangeText={(v) => update("contact", v)}
              keyboardType="phone-pad"
              autoCapitalize="none"
              required
            />
            <Field
              label="Address"
              icon={<MapPin size={18} color="#5a8a6a" />}
              value={formData.address}
              onChangeText={(v) => update("address", v)}
              required
            />
            <GenderPicker value={formData.gender} onChange={(v) => update("gender", v)} />
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
            <Text style={styles.stepTitle}>Group & Project</Text>
            <Text style={styles.stepSubtitle}>
              Details about your group and maintenance plan
            </Text>

            <Text style={styles.sectionHeading}>Group Details</Text>
            <Field
              label="Group Name"
              icon={<Building2 size={18} color="#5a8a6a" />}
              value={formData.group_name}
              onChangeText={(v) => update("group_name", v)}
              required
            />
            <GroupTypePicker value={formData.group_type} onChange={(v) => update("group_type", v)} />
            <Field
              label="Group Address"
              icon={<MapPin size={18} color="#5a8a6a" />}
              value={formData.group_address}
              onChangeText={(v) => update("group_address", v)}
              required
            />
            <Field
              label="Group Contact"
              icon={<Phone size={18} color="#5a8a6a" />}
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
              icon={<FileText size={18} color="#5a8a6a" />}
              value={formData.title}
              onChangeText={(v) => update("title", v)}
              required
            />
            <Field
              label="Total Tree Growers"
              icon={<Users size={18} color="#5a8a6a" />}
              value={formData.total_treegrowers_will_participate}
              onChangeText={(v) => update("total_treegrowers_will_participate", v)}
              keyboardType="numeric"
              autoCapitalize="none"
              required
            />
            <Text style={styles.hint}>Minimum 2 tree growers required per group</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Proposed Orientation Date{" "}
                <Text style={{ color: "#5a8a6a", fontSize: 10 }}>(optional)</Text>
              </Text>
              <TouchableOpacity
                style={styles.inputContainer}
                onPress={() => setShowProposedDatePicker(true)}
                activeOpacity={0.7}
              >
                <View style={styles.inputIcon}>
                  <Calendar size={18} color="#5a8a6a" />
                </View>
                <Text
                  style={[
                    styles.dateDisplay,
                    !formData.proposed_orientation_date && styles.dateDisplayPlaceholder,
                  ]}
                >
                  {formData.proposed_orientation_date || "Select preferred date (optional)"}
                </Text>
                <Calendar size={16} color="#2d5f3c" />
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
            <Text style={styles.stepTitle}>Review Your Application</Text>
            <Text style={styles.stepSubtitle}>
              Please confirm your details before submitting
            </Text>

            <ReviewSection title="🔐 Account">
              <ReviewRow label="Email" value={formData.email} />
              <ReviewRow label="Password" value="••••••••" />
            </ReviewSection>

            <ReviewSection title="👤 Personal">
              <ReviewRow
                label="Name"
                value={`${formData.first_name} ${formData.middle_name} ${formData.last_name}`.trim()}
              />
              <ReviewRow label="Birthday" value={formData.birthday || "Not provided"} />
              <ReviewRow label="Contact" value={formData.contact} />
              <ReviewRow label="Address" value={formData.address} />
              <ReviewRow label="Gender" value={formData.gender} />
              <ReviewRow label="Profile Image" value={formData.profile_img?.name ?? "Not provided"} />
            </ReviewSection>

            <ReviewSection title="🌿 Group">
              <ReviewRow label="Group Name" value={formData.group_name} />
              <ReviewRow
                label="Group Type"
                value={GROUP_TYPES.find((t) => t.value === formData.group_type)?.label || "—"}
              />
              <ReviewRow label="Group Address" value={formData.group_address} />
              <ReviewRow label="Group Contact" value={formData.group_contact} />
              <ReviewRow label="Group Logo" value={formData.group_profile?.name ?? "Not provided"} />
            </ReviewSection>

            <ReviewSection title="📋 Project">
              <ReviewRow label="Title" value={formData.title} />
              <ReviewRow label="Tree Growers" value={formData.total_treegrowers_will_participate} />
              <ReviewRow label="Proposed Orientation" value={formData.proposed_orientation_date || "Not specified"} />
              <ReviewRow label="Maintenance Plan" value={formData.maintenance_plan?.name ?? "—"} />
            </ReviewSection>

            <View style={styles.noteBox}>
              <Text style={styles.noteText}>
                ⚠️ Your account will be set as{" "}
                <Text style={styles.noteBold}>For Evaluation</Text> until
                approved by an administrator. Seedling requests can be made
                after acceptance.
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
                  . Your field data, GPS coordinates, and photos are collected
                  as part of the reforestation monitoring program.
                </Text>
              </View>

              {/* ✅ Show status if not yet viewed */}
              {(!hasViewedPrivacy || !hasViewedTerms) && (
                <View style={styles.viewStatusBox}>
                  <Text style={styles.viewStatusText}>
                    {!hasViewedPrivacy && !hasViewedTerms
                      ? "📖 Please read both documents before agreeing"
                      : !hasViewedPrivacy
                      ? "📖 Please read the Privacy Policy first"
                      : "📖 Please read the Terms & Conditions first"}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.checkRow,
                  (!hasViewedPrivacy || !hasViewedTerms) && styles.checkRowDisabled,
                ]}
                onPress={handleAgreementToggle}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.checkbox,
                    agreedToPrivacy && styles.checkboxChecked,
                    (!hasViewedPrivacy || !hasViewedTerms) && styles.checkboxDisabled,
                  ]}
                >
                  {agreedToPrivacy && <Check size={11} color="#ffffff" strokeWidth={3} />}
                </View>
                <Text style={[
                  styles.privacyText,
                  (!hasViewedPrivacy || !hasViewedTerms) && styles.privacyTextDisabled,
                ]}>
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

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.container,
            {
              maxWidth: Math.min(MAX_CARD_WIDTH, windowWidth - HORIZONTAL_PADDING * 2),
            },
          ]}
        >
          <View style={styles.authContainer}>
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Image
                  source={require("../assets/images/logo.jpg")}
                  style={styles.logo}
                />
              </View>
              <Text style={styles.brandTitle}>PlantScope</Text>
              <Text style={styles.brandSubtitle}>
                Nature's Digital System for TreeGrowers
              </Text>
            </View>

            <View style={styles.stepsRow}>
              {STEPS.flatMap((s, i) => {
                const IconComponent = s.Icon;
                const items: React.ReactElement[] = [
                  <View key={`step-${i}`} style={styles.stepItem}>
                    <View
                      style={[
                        styles.stepDot,
                        i <= step && styles.stepDotActive,
                        i < step && styles.stepDotDone,
                      ]}
                    >
                      {i < step ? (
                        <Check size={14} color="#ffffff" strokeWidth={2.5} />
                      ) : (
                        <IconComponent size={16} color={i === step ? "#4caf72" : "#5a8a6a"} />
                      )}
                    </View>
                    <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]}>
                      {s.label}
                    </Text>
                  </View>,
                ];
                if (i < STEPS.length - 1) {
                  items.push(
                    <View
                      key={`line-${i}`}
                      style={[styles.stepConnector, i < step && styles.stepConnectorDone]}
                    />,
                  );
                }
                return items;
              })}
            </View>

            <View style={styles.authCard}>
              {renderStep()}

              <View style={styles.navRow}>
                {step > 0 && (
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={goBack}
                    activeOpacity={0.7}
                  >
                    <ChevronLeft size={18} color="#a8c5b3" />
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
                    activeOpacity={0.8}
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
                    {!(sendingOtp || loading) && <ChevronRight size={18} color="#fff" />}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.nextButton, loading && styles.nextButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.nextButtonText}>
                      {loading ? "Submitting…" : "Submit Application"}
                    </Text>
                    {!loading && <CheckCircle size={18} color="#fff" />}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.bottomText}>
              <Text style={styles.registerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push("/homepage")}>
                <Text style={styles.registerLink}>Sign In</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.footer}>Protected by nature's encryption</Text>
          </View>
        </View>
      </ScrollView>

      {/* ✅ Extracted Modals */}
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
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0d2a17" },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  container: { width: "100%" },
  authContainer: { width: "100%", alignItems: "center" },
  logoContainer: { alignItems: "center", marginBottom: 22 },
  logoCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "rgba(76,175,114,0.35)",
  },
  logo: { width: 66, height: 66, borderRadius: 33 },
  brandTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 0.6,
  },
  brandSubtitle: {
    fontSize: 12,
    color: "#a8c5b3",
    marginTop: 4,
    textAlign: "center",
  },
  stepsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
    width: "100%",
  },
  stepItem: { alignItems: "center", width: 46 },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: "#2d5f3c",
    marginTop: 19,
  },
  stepConnectorDone: { backgroundColor: "#4caf72" },
  stepDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#122b1a",
    borderWidth: 2,
    borderColor: "#2d5f3c",
    justifyContent: "center",
    alignItems: "center",
  },
  stepDotActive: { borderColor: "#4caf72", backgroundColor: "#1a4228" },
  stepDotDone: { backgroundColor: "#2d5f3c", borderColor: "#4caf72" },
  stepLabel: {
    fontSize: 10,
    color: "#5a8a6a",
    marginTop: 4,
    textAlign: "center",
  },
  stepLabelActive: { color: "#a8c5b3", fontWeight: "700" },
  authCard: {
    width: "100%",
    backgroundColor: "#183d23",
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderTopColor: "rgba(76,175,114,0.45)",
    borderTopWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 14,
  },
  stepTitle: {
    fontSize: 20,
    color: "#ffffff",
    fontWeight: "700",
    marginBottom: 4,
  },
  stepSubtitle: { fontSize: 12, color: "#5a8a6a", marginBottom: 18 },
  sectionHeading: {
    fontSize: 11,
    color: "#4caf72",
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
    marginTop: 4,
  },
  formGroup: { marginBottom: 12 },
  label: { color: "#a8c5b3", fontSize: 12, marginBottom: 6, fontWeight: "600" },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0b2211",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 46,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    color: "#ffffff",
    fontSize: 15,
    paddingVertical: 6,
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  dateDisplay: { flex: 1, color: "#ffffff", fontSize: 15, paddingVertical: 6 },
  dateDisplayPlaceholder: { color: "#5a8a6a" },
  eyeButton: { padding: 6 },
  hint: { fontSize: 10, color: "#5a8a6a", marginTop: 4 },
  genderRow: { flexDirection: "row", gap: 8 },
  genderChip: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#0b2211",
    alignItems: "center",
  },
  genderChipActive: { borderColor: "#4caf72", backgroundColor: "#1a4228" },
  genderChipText: { color: "#5a8a6a", fontSize: 13, fontWeight: "600" },
  genderChipTextActive: { color: "#ffffff" },
  fileButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0b2211",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderStyle: "dashed",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  fileButtonText: { flex: 1, color: "#a8c5b3", fontSize: 13 },
  imagePreviewBtn: {
    borderRadius: 10,
    overflow: "hidden",
    height: 110,
    borderWidth: 1,
    borderColor: "rgba(76,175,114,0.3)",
  },
  imagePreview: { width: "100%", height: "100%" },
  imagePreviewOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingVertical: 6,
    alignItems: "center",
  },
  imagePreviewText: { color: "#ffffff", fontSize: 12, fontWeight: "600" },
  reviewSection: {
    backgroundColor: "#0b2211",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  reviewSectionTitle: {
    fontSize: 11,
    color: "#4caf72",
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
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  reviewLabel: { color: "#5a8a6a", fontSize: 12, flex: 1 },
  reviewValue: {
    color: "#e0ece4",
    fontSize: 12,
    flex: 2,
    textAlign: "right",
    fontWeight: "600",
  },
  noteBox: {
    backgroundColor: "rgba(76,175,114,0.08)",
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(76,175,114,0.2)",
  },
  noteText: { color: "#a8c5b3", fontSize: 12, lineHeight: 18 },
  noteBold: { color: "#4caf72", fontWeight: "700" },
  privacyAgreementBox: {
    marginTop: 12,
    padding: 14,
    backgroundColor: "rgba(76,175,114,0.06)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(76,175,114,0.2)",
  },
  legalInfoBox: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  legalInfoText: { color: "#a8c5b3", fontSize: 12, lineHeight: 19 },
  // ✅ New styles for document viewing status
  viewStatusBox: {
    backgroundColor: "rgba(245,158,11,0.08)",
    borderLeftWidth: 3,
    borderLeftColor: "#f59e0b",
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
  },
  viewStatusText: {
    color: "#fbbf24",
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
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "#0b2211",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: "#4caf72", borderColor: "#4caf72" },
  checkboxDisabled: { opacity: 0.5 },
  privacyText: { flex: 1, color: "#a8c5b3", fontSize: 12, lineHeight: 18 },
  privacyTextDisabled: { color: "#5a8a6a" },
  privacyLink: { color: "#4caf72", fontWeight: "700" },
  privacyLinkViewed: { color: "#10b981", textDecorationLine: "underline" },
  otpEmailBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(76,175,114,0.1)",
    borderWidth: 1,
    borderColor: "rgba(76,175,114,0.25)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 22,
  },
  otpEmailText: { color: "#a8c5b3", fontSize: 13, flex: 1 },
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
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#0b2211",
    justifyContent: "center",
    alignItems: "center",
  },
  otpBoxFilled: { borderColor: "#4caf72", backgroundColor: "#122b1a" },
  otpBoxCursor: { borderColor: "#4caf72", borderWidth: 2 },
  otpBoxText: { color: "#ffffff", fontSize: 22, fontWeight: "700" },
  otpNote: {
    color: "#5a8a6a",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 4,
  },
  otpResend: {
    color: "#4caf72",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  otpResendDisabled: { color: "#5a8a6a" },
  navRow: { flexDirection: "row", marginTop: 20, gap: 10 },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    gap: 4,
  },
  backButtonText: { color: "#a8c5b3", fontSize: 14, fontWeight: "600" },
  nextButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2d5f3c",
    borderRadius: 10,
    paddingVertical: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(76,175,114,0.3)",
  },
  nextButtonFull: { flex: 1 },
  nextButtonDisabled: { opacity: 0.5 },
  nextButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  bottomText: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 18,
  },
  registerText: { color: "#a8c5b3", fontSize: 14 },
  registerLink: { color: "#4caf72", fontWeight: "700", fontSize: 14 },
  footer: {
    color: "#5a8a6a",
    fontSize: 11,
    marginTop: 16,
    textAlign: "center",
  },
  groupTypeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  groupTypeChip: {
    flex: 1,
    minWidth: 100,
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#0b2211",
    alignItems: "center",
    marginBottom: 8,
  },
  groupTypeChipActive: {
    borderColor: "#4caf72",
    backgroundColor: "#1a4228",
  },
  groupTypeChipText: {
    color: "#5a8a6a",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  groupTypeChipTextActive: {
    color: "#ffffff",
  },
});