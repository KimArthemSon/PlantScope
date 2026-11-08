import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "@/constants/url_fixed";

const PRIMARY = "#0F4A2F";
const INK = "#111827";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";
const BORDER = "#E5E7EB";

/**
 * Two-step email change: send a 6-digit code to the new address, then confirm it.
 * The account email only changes after the server verifies the code.
 */
export default function ChangeEmailModal({
  visible,
  currentEmail,
  onClose,
  onChanged,
}: {
  visible: boolean;
  currentEmail: string;
  onClose: () => void;
  onChanged: (newEmail: string) => void;
}) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<TextInput>(null);

  // Start fresh every time the dialog opens
  useEffect(() => {
    if (visible) {
      setStep("email");
      setEmail("");
      setCode("");
      setError(null);
      setInfo(null);
    }
  }, [visible]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const call = async (path: string, body: object) => {
    const token = await SecureStore.getItemAsync("token");
    const res = await fetch(`${api}/api/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
    return data;
  };

  const sendCode = async () => {
    setError(null);
    setInfo(null);
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return setError("Enter a valid email address.");
    if (value === currentEmail.toLowerCase()) return setError("This is already your email address.");
    setBusy(true);
    try {
      const data = await call("email_change/request/", { email: value });
      setEmail(value);
      setInfo(data.message);
      setResendIn(data.resend_in ?? 60);
      setCode("");
      setStep("code");
      setTimeout(() => codeRef.current?.focus(), 150);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setError(null);
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code from the email.");
    setBusy(true);
    try {
      const data = await call("email_change/confirm/", { email, otp: code });
      onChanged(data.email);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !busy && onClose()}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={styles.backdrop} onPress={() => !busy && onClose()}>
          <Pressable style={styles.card} onPress={() => {}}>
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <MaterialCommunityIcons name={step === "email" ? "email-edit-outline" : "shield-check-outline"} size={18} color={PRIMARY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{step === "email" ? "Change email" : "Verify your new email"}</Text>
                <Text style={styles.step}>Step {step === "email" ? 1 : 2} of 2</Text>
              </View>
              <TouchableOpacity onPress={onClose} disabled={busy} hitSlop={10}>
                <Ionicons name="close" size={22} color={FAINT} />
              </TouchableOpacity>
            </View>

            {step === "email" ? (
              <>
                <Text style={styles.text}>
                  Current email: <Text style={styles.bold}>{currentEmail}</Text>
                </Text>
                <Text style={styles.label}>NEW EMAIL ADDRESS</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  placeholderTextColor={FAINT}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoFocus
                  onSubmitEditing={sendCode}
                />
                <Text style={styles.hint}>We'll send a 6-digit code to the new address. Your email only changes after you enter it.</Text>
              </>
            ) : (
              <>
                <Text style={styles.text}>
                  Enter the 6-digit code sent to <Text style={styles.bold}>{email}</Text>. It expires in 10 minutes.
                </Text>
                <TextInput
                  ref={codeRef}
                  style={[styles.input, styles.codeInput]}
                  value={code}
                  onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••••"
                  placeholderTextColor={FAINT}
                  keyboardType="number-pad"
                  maxLength={6}
                  onSubmitEditing={confirm}
                />
                <View style={styles.linksRow}>
                  <TouchableOpacity
                    onPress={() => {
                      setStep("email");
                      setError(null);
                      setInfo(null);
                    }}
                    disabled={busy}
                  >
                    <Text style={styles.linkMuted}>← Different email</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={sendCode} disabled={busy || resendIn > 0}>
                    <Text style={[styles.link, resendIn > 0 && { color: FAINT }]}>
                      {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {!!info && !error && <Text style={styles.info}>{info}</Text>}
            {!!error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.btnGhost} onPress={onClose} disabled={busy}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnPrimary, busy && { opacity: 0.6 }]}
                onPress={step === "email" ? sendCode : confirm}
                disabled={busy}
              >
                {busy && <ActivityIndicator size="small" color="#FFF" />}
                <Text style={styles.btnPrimaryText}>{step === "email" ? "Send code" : "Verify & update"}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "center", padding: 20 },
  card: { backgroundColor: "#FFF", borderRadius: 20, padding: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  headerIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "800", color: INK },
  step: { fontSize: 11.5, color: FAINT },
  text: { fontSize: 13.5, color: MUTED, lineHeight: 20, marginBottom: 12 },
  bold: { fontWeight: "700", color: INK },
  label: { fontSize: 11, fontWeight: "700", color: MUTED, letterSpacing: 0.6, marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: INK,
  },
  codeInput: { textAlign: "center", fontSize: 24, fontWeight: "800", letterSpacing: 10 },
  hint: { fontSize: 12, color: FAINT, marginTop: 8 },
  linksRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  link: { fontSize: 13, fontWeight: "700", color: PRIMARY },
  linkMuted: { fontSize: 13, color: MUTED },
  info: { fontSize: 12.5, color: "#047857", backgroundColor: "#ECFDF5", borderRadius: 10, padding: 10, marginTop: 12 },
  error: { fontSize: 12.5, color: "#DC2626", backgroundColor: "#FEF2F2", borderRadius: 10, padding: 10, marginTop: 12 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 18 },
  btnGhost: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  btnGhostText: { fontSize: 14, fontWeight: "700", color: MUTED },
  btnPrimary: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: PRIMARY, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
  btnPrimaryText: { fontSize: 14, fontWeight: "700", color: "#FFF" },
});
