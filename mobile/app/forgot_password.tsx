import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  KeyRound,
  Check,
  Circle,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/constants/url_fixed";
import { useAlert } from "@/components/AlertContext";

type Step = "email" | "code" | "password";

const formatWait = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.ceil((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

async function postJson(path: string, body: object) {
  const res = await fetch(`${api}/api/password_reset/${path}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, platform: "mobile" }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export default function ForgotPassword() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const alert = useAlert();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [requestsLeft, setRequestsLeft] = useState<number | null>(null);
  const [limitWait, setLimitWait] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const rules = [
    { met: password.length >= 8, text: "At least 8 characters" },
    { met: /[A-Z]/.test(password), text: "One uppercase letter" },
    { met: /[a-z]/.test(password), text: "One lowercase letter" },
    { met: /\d/.test(password), text: "One number" },
    { met: /[^A-Za-z0-9]/.test(password), text: "One special character" },
  ];

  const run = async (fn: () => Promise<void>) => {
    setLoading(true);
    try {
      await fn();
    } catch {
      alert.error(
        "Connection Error",
        "Cannot reach the server. Please check your internet connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        alert.error("Invalid Email", "Please enter a valid email address.");
        return;
      }
      const { ok, data } = await postJson("request", { email: email.trim() });
      if (data.requests_left !== undefined) setRequestsLeft(data.requests_left);
      if (ok) {
        setCode("");
        setCooldown(data.cooldown ?? 60);
        setStep("code");
        alert.success("Code Sent", data.message);
      } else {
        if (data.limit_reached) setLimitWait(data.retry_after ?? 0);
        else if (data.retry_after) setCooldown(data.retry_after);
        alert.error("Request Failed", data.error || "Could not send the code.");
      }
    });

  const verifyCode = () =>
    run(async () => {
      if (code.length !== 6) {
        alert.error("Invalid Code", "Enter the 6-digit code from your email.");
        return;
      }
      const { ok, data } = await postJson("verify", { email: email.trim(), code });
      if (ok) {
        setResetToken(data.reset_token);
        setStep("password");
      } else {
        alert.error("Verification Failed", data.error || "Incorrect code.");
      }
    });

  const resetPassword = () =>
    run(async () => {
      if (!rules.every((r) => r.met)) {
        alert.error("Weak Password", "Your password doesn't meet all the requirements.");
        return;
      }
      if (password !== confirmPassword) {
        alert.error("Passwords Don't Match", "Please re-enter the same password.");
        return;
      }
      const { ok, data } = await postJson("confirm", {
        email: email.trim(),
        reset_token: resetToken,
        new_password: password,
      });
      if (ok) {
        alert.success("Password Reset", "You can now sign in with your new password.", 3000);
        router.replace("/homepage");
      } else {
        alert.error("Reset Failed", data.error || "Please try again.");
        if (/expired/i.test(data.error || "")) setStep("email");
      }
    });

  const heading = {
    email: {
      icon: <Mail size={26} color="#16A34A" />,
      title: "Forgot password?",
      text: "Enter your account email and we'll send you a 6-digit code.",
    },
    code: {
      icon: <ShieldCheck size={26} color="#16A34A" />,
      title: "Check your email",
      text: `We sent a code to ${email.trim()}. It expires in 10 minutes.`,
    },
    password: {
      icon: <KeyRound size={26} color="#16A34A" />,
      title: "Set a new password",
      text: "Choose a strong password you haven't used before.",
    },
  }[step];

  const stepNumber = step === "email" ? 1 : step === "code" ? 2 : 3;
  const submitDisabled = loading || (step === "email" && (limitWait > 0 || cooldown > 0));
  const submitLabel =
    step === "email"
      ? cooldown > 0 && limitWait === 0
        ? `Send Code (${cooldown}s)`
        : "Send Code"
      : step === "code"
        ? "Verify Code"
        : "Reset Password";

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => (step === "email" ? router.back() : setStep("email"))}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color="#1C1C1E" />
        </TouchableOpacity>

        <View style={styles.progress}>
          {[1, 2, 3].map((n) => (
            <View key={n} style={[styles.progressBar, n <= stepNumber && styles.progressBarActive]} />
          ))}
        </View>

        <View style={styles.iconCircle}>{heading.icon}</View>
        <Text style={styles.title}>{heading.title}</Text>
        <Text style={styles.subtitle}>{heading.text}</Text>

        {step === "email" && (
          <View style={styles.formGroup}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputContainer}>
              <Mail size={20} color="#8B8680" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#A8A39D"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setLimitWait(0);
                  setRequestsLeft(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoFocus
              />
            </View>
          </View>
        )}

        {step === "code" && (
          <View style={styles.formGroup}>
            <Text style={styles.label}>Verification Code</Text>
            <TextInput
              style={[styles.inputContainer, styles.codeInput]}
              placeholder="000000"
              placeholderTextColor="#C9C5C0"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              autoFocus
            />
          </View>
        )}

        {step === "password" && (
          <>
            <View style={styles.formGroup}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.inputContainer}>
                <Lock size={20} color="#8B8680" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter new password"
                  placeholderTextColor="#A8A39D"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoFocus
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {showPassword ? <EyeOff size={20} color="#8B8680" /> : <Eye size={20} color="#8B8680" />}
                </TouchableOpacity>
              </View>
              <View style={styles.rules}>
                {rules.map((r) => (
                  <View key={r.text} style={styles.ruleRow}>
                    {r.met ? <Check size={14} color="#22C55E" /> : <Circle size={14} color="#9CA3AF" />}
                    <Text style={[styles.ruleText, r.met && styles.ruleTextMet]}>{r.text}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Confirm New Password</Text>
              <View style={styles.inputContainer}>
                <Lock size={20} color="#8B8680" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter new password"
                  placeholderTextColor="#A8A39D"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
              </View>
            </View>
          </>
        )}

        {step === "email" && limitWait > 0 && (
          <View style={styles.limitBanner}>
            <Text style={styles.limitText}>
              Daily limit reached. You can request another code in about {formatWait(limitWait)}.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitButton, submitDisabled && styles.submitButtonDisabled]}
          onPress={step === "email" ? sendCode : step === "code" ? verifyCode : resetPassword}
          disabled={submitDisabled}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>{submitLabel}</Text>
          )}
        </TouchableOpacity>

        {step === "code" && (
          <View style={styles.resendBox}>
            <Text style={styles.mutedText}>
              Didn't get it?{" "}
              {requestsLeft === 0 ? (
                "No more codes left today."
              ) : cooldown > 0 ? (
                `Resend in ${cooldown}s`
              ) : (
                <Text style={styles.link} onPress={sendCode}>
                  Resend code
                </Text>
              )}
            </Text>
            {requestsLeft !== null && requestsLeft > 0 && (
              <Text style={styles.smallText}>
                {requestsLeft} {requestsLeft === 1 ? "request" : "requests"} left today
              </Text>
            )}
            <Text style={[styles.smallText, styles.link]} onPress={() => setStep("email")}>
              Use a different email
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scroll: { paddingHorizontal: 28 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.04)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  progress: { flexDirection: "row", gap: 6, marginBottom: 28 },
  progressBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.08)" },
  progressBarActive: { backgroundColor: "#22C55E" },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(74, 222, 128, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: "700", color: "#1C1C1E", marginBottom: 6 },
  subtitle: { fontSize: 14, color: "#8B8680", lineHeight: 20, marginBottom: 28 },
  formGroup: { marginBottom: 18 },
  label: { color: "#5C5C5E", fontSize: 13, marginBottom: 8, fontWeight: "500" },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.03)",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(0, 0, 0, 0.06)",
    paddingHorizontal: 16,
    height: 54,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, color: "#1C1C1E", fontSize: 15 },
  codeInput: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 10,
    textAlign: "center",
    color: "#1C1C1E",
  },
  rules: { marginTop: 10, gap: 4 },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ruleText: { fontSize: 12, color: "#9CA3AF" },
  ruleTextMet: { color: "#22C55E" },
  limitBanner: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  limitText: { color: "#DC2626", fontSize: 13, fontWeight: "500" },
  submitButton: {
    backgroundColor: "#22C55E",
    borderRadius: 14,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  resendBox: { alignItems: "center", marginTop: 20, gap: 8 },
  mutedText: { color: "#8B8680", fontSize: 14 },
  smallText: { color: "#A8A39D", fontSize: 12 },
  link: { color: "#22C55E", fontWeight: "600" },
});
