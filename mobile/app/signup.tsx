import { useState } from 'react';
import { useRouter } from 'expo-router';
import { api } from '@/constants/url_fixed';
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
  Alert,
} from 'react-native';
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
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

const { width: windowWidth } = Dimensions.get('window');
const MAX_CARD_WIDTH = 480;
const HORIZONTAL_PADDING = 16;

const inputStyleOverride = {
  outlineStyle: 'none',
  outlineWidth: 0,
  outlineColor: 'transparent',
} as any;

const STEPS = [
  { label: 'Account', icon: '🔐' },
  { label: 'Personal', icon: '👤' },
  { label: 'Organization', icon: '🌿' },
  { label: 'Review', icon: '✅' },
];

// ─── Sub-components OUTSIDE the main component ────────────────────────────
// IMPORTANT: Never define components inside another component.
// Doing so causes React to treat them as a new type on every render,
// which unmounts + remounts the input → focus is lost after every keystroke.

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
};

function Field({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'words',
  secureTextEntry = false,
  multiline = false,
}: FieldProps) {
  return (
    <View style={styles.formGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputContainer, multiline && { alignItems: 'flex-start', minHeight: 90 }]}>
        {icon && <View style={[styles.inputIcon, multiline && { marginTop: 4 }]}>{icon}</View>}
        <TextInput
          style={[styles.input, inputStyleOverride, multiline && { textAlignVertical: 'top', paddingTop: 4 }]}
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
};

function FileButton({ label, value, onPress }: FileButtonProps) {
  return (
    <View style={styles.formGroup}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.fileButton} onPress={onPress}>
        <FileText size={18} color="#a8c5b3" />
        <Text style={styles.fileButtonText} numberOfLines={1}>
          {value ? value.name : `Tap to upload ${label}`}
        </Text>
        {value && <CheckCircle size={16} color="#4caf72" />}
      </TouchableOpacity>
    </View>
  );
}

type GenderPickerProps = {
  value: string;
  onChange: (v: string) => void;
};

function GenderPicker({ value, onChange }: GenderPickerProps) {
  return (
    <View style={styles.formGroup}>
      <Text style={styles.label}>Gender</Text>
      <View style={styles.genderRow}>
        {['Male', 'Female', 'Other'].map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.genderChip, value === g.toLowerCase() && styles.genderChipActive]}
            onPress={() => onChange(g.toLowerCase())}
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
      <Text style={styles.reviewValue} numberOfLines={2}>{value || '—'}</Text>
    </View>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function Signup() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    birthday: '',
    contact: '',
    address: '',
    gender: '',
    profile_img: null as any,
    organization_name: '',
    org_email: '',
    org_address: '',
    org_contact: '',
    org_profile: null as any,
    title: '',
    total_members: '',
    description: '',
    project_duration: '',
    maintenance_plan: null as any,
    total_request_seedling: '',
  });

  const update = (key: string, value: any) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  // ─── Pickers ─────────────────────────────────────────────────────────
  const pickImage = async (field: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      update(field, {
        uri: asset.uri,
        name: asset.fileName ?? `${field}.jpg`,
        type: asset.mimeType ?? 'image/jpeg',
      });
    }
  };

  const pickDocument = async (field: string) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      update(field, {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType ?? 'application/octet-stream',
      });
    }
  };

  // ─── Validation ───────────────────────────────────────────────────────
  const validateStep = (): string | null => {
    if (step === 0) {
      if (!formData.email) return 'Email is required.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return 'Enter a valid email.';
      if (!formData.password) return 'Password is required.';
      if (!/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(formData.password))
        return 'Password needs uppercase, lowercase, number, special char and 8+ characters.';
      if (formData.password !== formData.confirmPassword) return 'Passwords do not match.';
    }
    if (step === 1) {
      if (!formData.first_name) return 'First name is required.';
      if (!formData.last_name) return 'Last name is required.';
      if (!formData.birthday) return 'Birthday is required.';
      if (!formData.contact) return 'Contact number is required.';
      if (!formData.address) return 'Address is required.';
      if (!formData.gender) return 'Gender is required.';
      if (!formData.profile_img) return 'Profile image is required.';
    }
    if (step === 2) {
      if (!formData.organization_name) return 'Organization name is required.';
      if (!formData.org_email) return 'Organization email is required.';
      if (!formData.org_address) return 'Organization address is required.';
      if (!formData.org_contact) return 'Organization contact is required.';
      if (!formData.title) return 'Project title is required.';
      if (!formData.total_members) return 'Total members is required.';
      if (!formData.description) return 'Description is required.';
      if (!formData.project_duration) return 'Project duration is required.';
      if (!formData.total_request_seedling) return 'Total seedling request is required.';
    }
    return null;
  };

  const goNext = () => {
    const err = validateStep();
    if (err) { Alert.alert('Missing Info', err); return; }
    setStep((s) => s + 1);
  };

  const goBack = () => setStep((s) => s - 1);

  // ─── Submit ───────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('email', formData.email);
      fd.append('password', formData.password);
      fd.append('user_role', 'treeGrowers');
      fd.append('first_name', formData.first_name);
      fd.append('last_name', formData.last_name);
      fd.append('middle_name', formData.middle_name);
      fd.append('birthday', formData.birthday);
      fd.append('contact', formData.contact);
      fd.append('address', formData.address);
      let g = "O"
      if(formData.gender === 'Male'){
        g = "M"
      }else if(formData.gender === 'Female'){
         g = "F"
      }
      fd.append('gender', g);
      fd.append('is_active', 'false');

      if (formData.profile_img) {
        fd.append('profile_img', {
          uri: formData.profile_img.uri,
          name: formData.profile_img.name,
          type: formData.profile_img.type,
        } as any);
      }

      fd.append('organization_name', formData.organization_name);
      fd.append('org_email', formData.org_email);
      fd.append('org_address', formData.org_address);
      fd.append('org_contact', formData.org_contact);
      fd.append('title', formData.title);
      fd.append('total_members', formData.total_members);
      fd.append('description', formData.description);
      fd.append('project_duration', formData.project_duration);
      fd.append('total_request_seedling', formData.total_request_seedling);

      if (formData.org_profile) {
        fd.append('org_profile', {
          uri: formData.org_profile.uri,
          name: formData.org_profile.name,
          type: formData.org_profile.type,
        } as any);
      }
      if (formData.maintenance_plan) {
        fd.append('maintenance_plan', {
          uri: formData.maintenance_plan.uri,
          name: formData.maintenance_plan.name,
          type: formData.maintenance_plan.type,
        } as any);
      }

      const res = await fetch(api+'/api/register/', {
        method: 'POST',
        body: fd,
      });

      const json = await res.json();

      if (!res.ok) {
        Alert.alert('Registration Failed', json.error ?? 'Something went wrong.');
        return;
      }

      Alert.alert('Success 🌱', 'Account created! Your application is under evaluation.', [
        { text: 'Sign In', onPress: () => router.push('/login') },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Step content ─────────────────────────────────────────────────────
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
              onChangeText={(v: string) => update('email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={styles.formGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputContainer}>
                <View style={styles.inputIcon}><Lock size={18} color="#5a8a6a" /></View>
                <TextInput
                  style={[styles.input, inputStyleOverride]}
                  placeholder="Enter password"
                  placeholderTextColor="#5a8a6a"
                  value={formData.password}
                  onChangeText={(v) => update('password', v)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                  {showPassword ? <EyeOff size={18} color="#5a8a6a" /> : <Eye size={18} color="#5a8a6a" />}
                </TouchableOpacity>
              </View>
              <Text style={styles.hint}>8+ chars · uppercase · lowercase · number · special char</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.inputContainer}>
                <View style={styles.inputIcon}><Lock size={18} color="#5a8a6a" /></View>
                <TextInput
                  style={[styles.input, inputStyleOverride]}
                  placeholder="Confirm password"
                  placeholderTextColor="#5a8a6a"
                  value={formData.confirmPassword}
                  onChangeText={(v) => update('confirmPassword', v)}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeButton}>
                  {showConfirmPassword ? <EyeOff size={18} color="#5a8a6a" /> : <Eye size={18} color="#5a8a6a" />}
                </TouchableOpacity>
              </View>
            </View>
          </>
        );

      case 1:
        return (
          <>
            <Text style={styles.stepTitle}>Personal Information</Text>
            <Text style={styles.stepSubtitle}>Tell us a little about yourself</Text>

            <Field label="First Name" icon={<User size={18} color="#5a8a6a" />} value={formData.first_name} onChangeText={(v: string) => update('first_name', v)} />
            <Field label="Middle Name (optional)" icon={<User size={18} color="#5a8a6a" />} value={formData.middle_name} onChangeText={(v: string) => update('middle_name', v)} />
            <Field label="Last Name" icon={<User size={18} color="#5a8a6a" />} value={formData.last_name} onChangeText={(v: string) => update('last_name', v)} />
            <Field label="Birthday" icon={<Text style={{ fontSize: 16 }}>🎂</Text>} value={formData.birthday} onChangeText={(v: string) => update('birthday', v)} placeholder="YYYY-MM-DD" autoCapitalize="none" />
            <Field label="Contact Number" icon={<Phone size={18} color="#5a8a6a" />} value={formData.contact} onChangeText={(v: string) => update('contact', v)} keyboardType="phone-pad" autoCapitalize="none" />
            <Field label="Address" icon={<MapPin size={18} color="#5a8a6a" />} value={formData.address} onChangeText={(v: string) => update('address', v)} />
            <GenderPicker value={formData.gender} onChange={(v) => update('gender', v)} />
            <FileButton label="Profile Image" value={formData.profile_img} onPress={() => pickImage('profile_img')} />
          </>
        );

      case 2:
        return (
          <>
            <Text style={styles.stepTitle}>Organization & Maintenance Plan</Text>
            <Text style={styles.stepSubtitle}>Details about your organization and project</Text>

            <Text style={styles.sectionHeading}>Organization Details</Text>
            <Field label="Organization Name" icon={<Building2 size={18} color="#5a8a6a" />} value={formData.organization_name} onChangeText={(v: string) => update('organization_name', v)} />
            <Field label="Organization Email" icon={<Mail size={18} color="#5a8a6a" />} value={formData.org_email} onChangeText={(v: string) => update('org_email', v)} keyboardType="email-address" autoCapitalize="none" />
            <Field label="Organization Address" icon={<MapPin size={18} color="#5a8a6a" />} value={formData.org_address} onChangeText={(v: string) => update('org_address', v)} />
            <Field label="Organization Contact" icon={<Phone size={18} color="#5a8a6a" />} value={formData.org_contact} onChangeText={(v: string) => update('org_contact', v)} keyboardType="phone-pad" autoCapitalize="none" />
            <FileButton label="Organization Logo (optional)" value={formData.org_profile} onPress={() => pickImage('org_profile')} />

            <Text style={[styles.sectionHeading, { marginTop: 18 }]}>Project / Application</Text>
            <Field label="Project Title" icon={<FileText size={18} color="#5a8a6a" />} value={formData.title} onChangeText={(v: string) => update('title', v)} />
            <Field label="Total Members" icon={<User size={18} color="#5a8a6a" />} value={formData.total_members} onChangeText={(v: string) => update('total_members', v)} keyboardType="numeric" autoCapitalize="none" />
            <Field label="Description" icon={<FileText size={18} color="#5a8a6a" />} value={formData.description} onChangeText={(v: string) => update('description', v)} multiline />
            <Field label="Project Duration (months)" icon={<Text style={{ fontSize: 16 }}>📅</Text>} value={formData.project_duration} onChangeText={(v: string) => update('project_duration', v)} keyboardType="numeric" autoCapitalize="none" />
            <Field label="Total Seedling Request" icon={<Text style={{ fontSize: 16 }}>🌱</Text>} value={formData.total_request_seedling} onChangeText={(v: string) => update('total_request_seedling', v)} keyboardType="numeric" autoCapitalize="none" />
            <FileButton label="Maintenance Plan (optional)" value={formData.maintenance_plan} onPress={() => pickDocument('maintenance_plan')} />
          </>
        );

      case 3:
        return (
          <>
            <Text style={styles.stepTitle}>Review Your Application</Text>
            <Text style={styles.stepSubtitle}>Please confirm your details before submitting</Text>

            <ReviewSection title="🔐 Account">
              <ReviewRow label="Email" value={formData.email} />
              <ReviewRow label="Password" value="••••••••" />
            </ReviewSection>

            <ReviewSection title="👤 Personal">
              <ReviewRow label="Name" value={`${formData.first_name} ${formData.middle_name} ${formData.last_name}`.trim()} />
              <ReviewRow label="Birthday" value={formData.birthday} />
              <ReviewRow label="Contact" value={formData.contact} />
              <ReviewRow label="Address" value={formData.address} />
              <ReviewRow label="Gender" value={formData.gender} />
              <ReviewRow label="Profile Image" value={formData.profile_img?.name ?? '—'} />
            </ReviewSection>

            <ReviewSection title="🌿 Organization">
              <ReviewRow label="Organization" value={formData.organization_name} />
              <ReviewRow label="Org Email" value={formData.org_email} />
              <ReviewRow label="Org Address" value={formData.org_address} />
              <ReviewRow label="Org Contact" value={formData.org_contact} />
            </ReviewSection>

            <ReviewSection title="📋 Project">
              <ReviewRow label="Title" value={formData.title} />
              <ReviewRow label="Members" value={formData.total_members} />
              <ReviewRow label="Duration" value={`${formData.project_duration} month(s)`} />
              <ReviewRow label="Seedlings" value={formData.total_request_seedling} />
              <ReviewRow label="Maintenance Plan" value={formData.maintenance_plan?.name ?? 'Not uploaded'} />
            </ReviewSection>

            <View style={styles.noteBox}>
              <Text style={styles.noteText}>
                ⚠️ Your account will be set as <Text style={styles.noteBold}>For Evaluation</Text> until approved by an administrator.
              </Text>
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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.container, { maxWidth: Math.min(MAX_CARD_WIDTH, windowWidth - HORIZONTAL_PADDING * 2) }]}>
          <View style={styles.authContainer}>

            {/* Logo */}
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Image source={require('../assets/images/logo.jpg')} style={styles.logo} />
              </View>
              <Text style={styles.brandTitle}>PlantScope</Text>
              <Text style={styles.brandSubtitle}>Nature's Digital System for TreeGrowers</Text>
            </View>

            {/* Step Indicator */}
            <View style={styles.stepsRow}>
              {STEPS.map((s, i) => (
                <View key={i} style={styles.stepItem}>
                  <View style={[styles.stepDot, i <= step && styles.stepDotActive, i < step && styles.stepDotDone]}>
                    <Text style={styles.stepDotText}>{i < step ? '✓' : s.icon}</Text>
                  </View>
                  <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]}>{s.label}</Text>
                  {i < STEPS.length - 1 && (
                    <View style={[styles.stepLine, i < step && styles.stepLineDone]} />
                  )}
                </View>
              ))}
            </View>

            {/* Card */}
            <View style={styles.authCard}>
              {renderStep()}

              <View style={styles.navRow}>
                {step > 0 && (
                  <TouchableOpacity style={styles.backButton} onPress={goBack}>
                    <ChevronLeft size={18} color="#a8c5b3" />
                    <Text style={styles.backButtonText}>Back</Text>
                  </TouchableOpacity>
                )}

                {step < 3 ? (
                  <TouchableOpacity style={[styles.nextButton, step === 0 && styles.nextButtonFull]} onPress={goNext}>
                    <Text style={styles.nextButtonText}>Continue</Text>
                    <ChevronRight size={18} color="#fff" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.nextButton, loading && styles.nextButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={loading}
                  >
                    <Text style={styles.nextButtonText}>{loading ? 'Submitting…' : 'Submit Application'}</Text>
                    {!loading && <CheckCircle size={18} color="#fff" />}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.bottomText}>
              <Text style={styles.registerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/login')}>
                <Text style={styles.registerLink}>Sign In</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.footer}>Protected by nature's encryption</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d2a17' },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  container: { width: '100%' },
  authContainer: { width: '100%', alignItems: 'center' },
  logoContainer: { alignItems: 'center', marginBottom: 20 },
  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logo: { width: 60, height: 60, borderRadius: 30 },
  brandTitle: { fontSize: 28, fontWeight: '800', color: '#ffffff', letterSpacing: 0.6 },
  brandSubtitle: { fontSize: 12, color: '#a8c5b3', marginTop: 4, textAlign: 'center' },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    width: '100%',
    justifyContent: 'center',
  },
  stepItem: { alignItems: 'center', flex: 1, position: 'relative' },
  stepDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#183d23',
    borderWidth: 2,
    borderColor: '#2d5f3c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: { borderColor: '#4caf72', backgroundColor: '#1e4d2b' },
  stepDotDone: { backgroundColor: '#2d5f3c', borderColor: '#4caf72' },
  stepDotText: { fontSize: 14 },
  stepLabel: { fontSize: 10, color: '#5a8a6a', marginTop: 4, textAlign: 'center' },
  stepLabelActive: { color: '#a8c5b3', fontWeight: '700' },
  stepLine: {
    position: 'absolute',
    top: 19,
    right: -('50%' as any),
    width: '100%',
    height: 2,
    backgroundColor: '#2d5f3c',
    zIndex: -1,
  },
  stepLineDone: { backgroundColor: '#4caf72' },
  authCard: {
    width: '100%',
    backgroundColor: '#183d23',
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
  },
  stepTitle: { fontSize: 20, color: '#ffffff', fontWeight: '700', marginBottom: 4 },
  stepSubtitle: { fontSize: 12, color: '#5a8a6a', marginBottom: 18 },
  sectionHeading: {
    fontSize: 13,
    color: '#4caf72',
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 4,
  },
  formGroup: { marginBottom: 12 },
  label: { color: '#a8c5b3', fontSize: 12, marginBottom: 6, fontWeight: '600' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b2211',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 46,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    paddingVertical: 6,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  eyeButton: { padding: 6 },
  hint: { fontSize: 10, color: '#5a8a6a', marginTop: 4 },
  genderRow: { flexDirection: 'row', gap: 8 },
  genderChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: '#0b2211',
    alignItems: 'center',
  },
  genderChipActive: { borderColor: '#4caf72', backgroundColor: '#1e4d2b' },
  genderChipText: { color: '#5a8a6a', fontSize: 13, fontWeight: '600' },
  genderChipTextActive: { color: '#ffffff' },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b2211',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderStyle: 'dashed',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  fileButtonText: { flex: 1, color: '#a8c5b3', fontSize: 13 },
  reviewSection: {
    backgroundColor: '#0b2211',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  reviewSectionTitle: {
    fontSize: 13,
    color: '#4caf72',
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 0.4,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  reviewLabel: { color: '#5a8a6a', fontSize: 12, flex: 1 },
  reviewValue: { color: '#e0ece4', fontSize: 12, flex: 2, textAlign: 'right', fontWeight: '600' },
  noteBox: {
    backgroundColor: 'rgba(76,175,114,0.10)',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(76,175,114,0.25)',
  },
  noteText: { color: '#a8c5b3', fontSize: 12, lineHeight: 18 },
  noteBold: { color: '#4caf72', fontWeight: '700' },
  navRow: { flexDirection: 'row', marginTop: 20, gap: 10 },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    gap: 4,
  },
  backButtonText: { color: '#a8c5b3', fontSize: 14, fontWeight: '600' },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2d5f3c',
    borderRadius: 10,
    paddingVertical: 13,
    gap: 6,
  },
  nextButtonFull: { flex: 1 },
  nextButtonDisabled: { opacity: 0.5 },
  nextButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  bottomText: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 18,
  },
  registerText: { color: '#a8c5b3', fontSize: 14 },
  registerLink: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  footer: { color: '#5a8a6a', fontSize: 11, marginTop: 16, textAlign: 'center' },
});