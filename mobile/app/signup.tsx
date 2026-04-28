import { useState, useEffect } from 'react';
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
  Modal,
} from 'react-native';
import {
  Mail, Lock, Eye, EyeOff, User, Phone, MapPin,
  Building2, FileText, ChevronRight, ChevronLeft,
  CheckCircle, Calendar, Clock, Leaf, Shield, Check, Users,
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

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STEPS = [
  { label: 'Account', icon: '🔐' },
  { label: 'Personal', icon: '👤' },
  { label: 'Organization', icon: '🌿' },
  { label: 'Review', icon: '✅' },
];

// ─── Date Picker Modal ─────────────────────────────────────────────────────
type DatePickerModalProps = {
  visible: boolean;
  value: string;
  onConfirm: (date: string) => void;
  onClose: () => void;
};

function DatePickerModal({ visible, value, onConfirm, onClose }: DatePickerModalProps) {
  const [year, setYear] = useState(2000);
  const [month, setMonth] = useState(0);
  const [selectedDay, setSelectedDay] = useState(0);

  useEffect(() => {
    if (visible) {
      if (value) {
        const p = value.split('-');
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
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    setSelectedDay(0);
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const confirmDate = () => {
    if (!day) return;
    onConfirm(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={dpStyles.overlay}>
        <View style={dpStyles.container}>
          <Text style={dpStyles.title}>Select Birthday</Text>

          <View style={dpStyles.navRow}>
            <TouchableOpacity onPress={() => { setYear(y => y - 1); setSelectedDay(0); }} style={dpStyles.navBtn}>
              <ChevronLeft size={15} color="#4caf72" />
            </TouchableOpacity>
            <Text style={dpStyles.yearLabel}>{year}</Text>
            <TouchableOpacity onPress={() => { setYear(y => y + 1); setSelectedDay(0); }} style={dpStyles.navBtn}>
              <ChevronRight size={15} color="#4caf72" />
            </TouchableOpacity>

            <View style={dpStyles.divider} />

            <TouchableOpacity onPress={prevMonth} style={dpStyles.navBtn}>
              <ChevronLeft size={15} color="#4caf72" />
            </TouchableOpacity>
            <Text style={dpStyles.monthLabel}>{MONTHS[month]}</Text>
            <TouchableOpacity onPress={nextMonth} style={dpStyles.navBtn}>
              <ChevronRight size={15} color="#4caf72" />
            </TouchableOpacity>
          </View>

          <View style={dpStyles.weekRow}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <View key={d} style={dpStyles.cell}>
                <Text style={dpStyles.weekDay}>{d}</Text>
              </View>
            ))}
          </View>

          <View style={dpStyles.grid}>
            {cells.map((d, i) => (
              <TouchableOpacity
                key={i}
                style={[dpStyles.cell, d !== null && d === day && dpStyles.cellSelected]}
                onPress={() => d !== null && setSelectedDay(d)}
                disabled={d === null}
                activeOpacity={d === null ? 1 : 0.7}
              >
                <Text style={[
                  dpStyles.cellText,
                  d === null && { opacity: 0 },
                  d !== null && d === day && dpStyles.cellTextSelected,
                ]}>
                  {d ?? '·'}
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
}

// ─── Privacy Policy Modal ──────────────────────────────────────────────────
type PrivacyPolicyModalProps = {
  visible: boolean;
  onClose: () => void;
};

function PrivacyPolicyModal({ visible, onClose }: PrivacyPolicyModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ppStyles.overlay}>
        <View style={ppStyles.container}>
          <View style={ppStyles.header}>
            <Shield size={18} color="#4caf72" />
            <Text style={ppStyles.title}>PlantScope Privacy Policy</Text>
          </View>
          <Text style={ppStyles.effective}>Effective: January 23, 2026 · Philippine RA 10173</Text>
          <ScrollView style={ppStyles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={ppStyles.body}>
              This Privacy Policy explains how the <Text style={ppStyles.bold}>PlantScope Project</Text>, managed
              by the <Text style={ppStyles.bold}>College of ICT & Engineering at Western Leyte College of Ormoc
              City</Text>, collects, uses, and protects your personal data.
            </Text>

            <Text style={ppStyles.sectionTitle}>1. Information We Collect</Text>
            <Text style={ppStyles.body}>
              {'• Full name, email address, mobile number, organizational affiliation\n'}
              {'• Username and encrypted password; optional profile details\n'}
              {'• IP address, browser type, operating system, device model\n'}
              {'• GPS coordinates, map markers, drone imagery of reforestation sites\n'}
              {'• Tree species, planting dates, survival metrics, soil conditions'}
            </Text>

            <Text style={ppStyles.sectionTitle}>2. Purpose and Legal Basis</Text>
            <Text style={ppStyles.body}>
              {'• Consent – newsletters, optional tracking\n'}
              {'• Contract Performance – platform access and services\n'}
              {'• Legal Obligation – environmental and national law compliance\n'}
              {'• Legitimate Interest – security, analytics, service improvement\n'}
              {'• Public Interest – reforestation monitoring and ecological research'}
            </Text>

            <Text style={ppStyles.sectionTitle}>3. How We Use Your Data</Text>
            <Text style={ppStyles.body}>
              {'• Account access, mapping, data submission, dashboards\n'}
              {'• Responding to inquiries and coordinating with partners\n'}
              {'• Impact analysis of reforestation programs\n'}
              {'• Security monitoring and legal compliance'}
            </Text>

            <Text style={ppStyles.sectionTitle}>4. Data Sharing</Text>
            <Text style={ppStyles.body}>
              We do not sell personal data. Information may be shared only with service providers and
              government partners (WLC, ENRO Ormoc, DENR, LGUs), or when legally required.
            </Text>

            <Text style={ppStyles.sectionTitle}>5. Data Retention</Text>
            <Text style={ppStyles.body}>
              {'• User accounts: deleted within 30 days of deactivation\n'}
              {'• Contact records: retained for 2 years\n'}
              {'• GIS data: retained for long-term environmental monitoring\n'}
              {'• Logs and analytics: anonymized or deleted after 90 days'}
            </Text>

            <Text style={ppStyles.sectionTitle}>6. Your Rights (RA 10173)</Text>
            <Text style={ppStyles.body}>
              Right to be informed, access and correction, erasure or blocking, object to processing,
              data portability, and lodge a complaint with the NPC (privacy.gov.ph).
            </Text>

            <Text style={ppStyles.sectionTitle}>7. Security</Text>
            <Text style={ppStyles.body}>
              SSL/TLS encryption, role-based access, administrator MFA, security audits, and incident
              response compliant with NPC Circular No. 16-03.
            </Text>

            <Text style={ppStyles.sectionTitle}>Contact</Text>
            <Text style={ppStyles.body}>
              {'PlantScope Project Team · College of ICT & Engineering\n'}
              {'Western Leyte College of Ormoc City\n'}
              {'Email: plantscope@wlc.edu.ph · DPO: privacy@plantscope.ph'}
            </Text>
          </ScrollView>
          <TouchableOpacity style={ppStyles.closeBtn} onPress={onClose}>
            <Text style={ppStyles.closeText}>I Understand</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────
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
  label, icon, value, onChangeText, placeholder,
  keyboardType = 'default', autoCapitalize = 'words',
  secureTextEntry = false, multiline = false,
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
  isImage?: boolean;
};

function FileButton({ label, value, onPress, isImage = false }: FileButtonProps) {
  return (
    <View style={styles.formGroup}>
      <Text style={styles.label}>{label}</Text>
      {isImage && value?.uri ? (
        <TouchableOpacity style={styles.imagePreviewBtn} onPress={onPress} activeOpacity={0.8}>
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

type GenderPickerProps = { value: string; onChange: (v: string) => void; };

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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

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

  const pickImage = async (field: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      update(field, { uri: asset.uri, name: asset.fileName ?? `${field}.jpg`, type: asset.mimeType ?? 'image/jpeg' });
    }
  };

  const pickDocument = async (field: string) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      update(field, { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream' });
    }
  };

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
      if (!formData.maintenance_plan) return 'Maintenance plan document is required.';
    }
    return null;
  };

  const goNext = () => {
    const err = validateStep();
    if (err) { Alert.alert('Missing Info', err); return; }
    setStep((s) => s + 1);
  };

  const goBack = () => setStep((s) => s - 1);

  const handleSubmit = async () => {
    if (!agreedToPrivacy) {
      Alert.alert('Privacy Policy', 'Please read and agree to the Privacy Policy before submitting.');
      return;
    }
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
      let g = 'O';
      if (formData.gender === 'male') g = 'M';
      else if (formData.gender === 'female') g = 'F';
      fd.append('gender', g);
      fd.append('is_active', 'false');

      if (formData.profile_img) {
        fd.append('profile_img', { uri: formData.profile_img.uri, name: formData.profile_img.name, type: formData.profile_img.type } as any);
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
        fd.append('org_profile', { uri: formData.org_profile.uri, name: formData.org_profile.name, type: formData.org_profile.type } as any);
      }
      if (formData.maintenance_plan) {
        fd.append('maintenance_plan', { uri: formData.maintenance_plan.uri, name: formData.maintenance_plan.name, type: formData.maintenance_plan.type } as any);
      }

      const res = await fetch(api + '/api/register/', { method: 'POST', body: fd });
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
              onChangeText={(v) => update('email', v)}
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

            <Field label="First Name" icon={<User size={18} color="#5a8a6a" />} value={formData.first_name} onChangeText={(v) => update('first_name', v)} />
            <Field label="Middle Name (optional)" icon={<User size={18} color="#5a8a6a" />} value={formData.middle_name} onChangeText={(v) => update('middle_name', v)} />
            <Field label="Last Name" icon={<User size={18} color="#5a8a6a" />} value={formData.last_name} onChangeText={(v) => update('last_name', v)} />

            <View style={styles.formGroup}>
              <Text style={styles.label}>Birthday</Text>
              <TouchableOpacity style={styles.inputContainer} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
                <View style={styles.inputIcon}><Calendar size={18} color="#5a8a6a" /></View>
                <Text style={[styles.dateDisplay, !formData.birthday && styles.dateDisplayPlaceholder]}>
                  {formData.birthday || 'Select your birthday'}
                </Text>
                <Calendar size={16} color="#2d5f3c" />
              </TouchableOpacity>
            </View>

            <Field label="Contact Number" icon={<Phone size={18} color="#5a8a6a" />} value={formData.contact} onChangeText={(v) => update('contact', v)} keyboardType="phone-pad" autoCapitalize="none" />
            <Field label="Address" icon={<MapPin size={18} color="#5a8a6a" />} value={formData.address} onChangeText={(v) => update('address', v)} />
            <GenderPicker value={formData.gender} onChange={(v) => update('gender', v)} />
            <FileButton label="Profile Image" value={formData.profile_img} onPress={() => pickImage('profile_img')} isImage />
          </>
        );

      case 2:
        return (
          <>
            <Text style={styles.stepTitle}>Organization & Project</Text>
            <Text style={styles.stepSubtitle}>Details about your organization and maintenance plan</Text>

            <Text style={styles.sectionHeading}>Organization Details</Text>
            <Field label="Organization Name" icon={<Building2 size={18} color="#5a8a6a" />} value={formData.organization_name} onChangeText={(v) => update('organization_name', v)} />
            <Field label="Organization Email" icon={<Mail size={18} color="#5a8a6a" />} value={formData.org_email} onChangeText={(v) => update('org_email', v)} keyboardType="email-address" autoCapitalize="none" />
            <Field label="Organization Address" icon={<MapPin size={18} color="#5a8a6a" />} value={formData.org_address} onChangeText={(v) => update('org_address', v)} />
            <Field label="Organization Contact" icon={<Phone size={18} color="#5a8a6a" />} value={formData.org_contact} onChangeText={(v) => update('org_contact', v)} keyboardType="phone-pad" autoCapitalize="none" />
            <FileButton label="Organization Logo (optional)" value={formData.org_profile} onPress={() => pickImage('org_profile')} isImage />

            <Text style={[styles.sectionHeading, { marginTop: 18 }]}>Project / Application</Text>
            <Field label="Project Title" icon={<FileText size={18} color="#5a8a6a" />} value={formData.title} onChangeText={(v) => update('title', v)} />
            <Field label="Total Members" icon={<Users size={18} color="#5a8a6a" />} value={formData.total_members} onChangeText={(v) => update('total_members', v)} keyboardType="numeric" autoCapitalize="none" />
            <Field label="Description" icon={<FileText size={18} color="#5a8a6a" />} value={formData.description} onChangeText={(v) => update('description', v)} multiline />
            <Field label="Project Duration (months)" icon={<Clock size={18} color="#5a8a6a" />} value={formData.project_duration} onChangeText={(v) => update('project_duration', v)} keyboardType="numeric" autoCapitalize="none" />
            <Field label="Total Seedling Request" icon={<Leaf size={18} color="#5a8a6a" />} value={formData.total_request_seedling} onChangeText={(v) => update('total_request_seedling', v)} keyboardType="numeric" autoCapitalize="none" />
            <FileButton label="Maintenance Plan" value={formData.maintenance_plan} onPress={() => pickDocument('maintenance_plan')} />
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
              <ReviewRow label="Maintenance Plan" value={formData.maintenance_plan?.name ?? '—'} />
            </ReviewSection>

            <View style={styles.noteBox}>
              <Text style={styles.noteText}>
                ⚠️ Your account will be set as <Text style={styles.noteBold}>For Evaluation</Text> until approved by an administrator.
              </Text>
            </View>

            <View style={styles.privacyAgreementBox}>
              <TouchableOpacity style={styles.checkRow} onPress={() => setAgreedToPrivacy(!agreedToPrivacy)} activeOpacity={0.7}>
                <View style={[styles.checkbox, agreedToPrivacy && styles.checkboxChecked]}>
                  {agreedToPrivacy && <Check size={11} color="#ffffff" strokeWidth={3} />}
                </View>
                <Text style={styles.privacyText}>
                  I have read and agree to the{' '}
                  <Text style={styles.privacyLink} onPress={() => setShowPrivacyPolicy(true)}>
                    Privacy Policy
                  </Text>
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
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.container, { maxWidth: Math.min(MAX_CARD_WIDTH, windowWidth - HORIZONTAL_PADDING * 2) }]}>
          <View style={styles.authContainer}>

            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Image source={require('../assets/images/logo.jpg')} style={styles.logo} />
              </View>
              <Text style={styles.brandTitle}>PlantScope</Text>
              <Text style={styles.brandSubtitle}>Nature's Digital System for TreeGrowers</Text>
            </View>

            {/* Step Indicator */}
            <View style={styles.stepsRow}>
              {STEPS.flatMap((s, i) => {
                const items: React.ReactElement[] = [
                  <View key={`step-${i}`} style={styles.stepItem}>
                    <View style={[styles.stepDot, i <= step && styles.stepDotActive, i < step && styles.stepDotDone]}>
                      {i < step
                        ? <Check size={14} color="#ffffff" strokeWidth={2.5} />
                        : <Text style={styles.stepDotText}>{s.icon}</Text>
                      }
                    </View>
                    <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]}>{s.label}</Text>
                  </View>,
                ];
                if (i < STEPS.length - 1) {
                  items.push(
                    <View key={`line-${i}`} style={[styles.stepConnector, i < step && styles.stepConnectorDone]} />
                  );
                }
                return items;
              })}
            </View>

            <View style={styles.authCard}>
              {renderStep()}

              <View style={styles.navRow}>
                {step > 0 && (
                  <TouchableOpacity style={styles.backButton} onPress={goBack} activeOpacity={0.7}>
                    <ChevronLeft size={18} color="#a8c5b3" />
                    <Text style={styles.backButtonText}>Back</Text>
                  </TouchableOpacity>
                )}

                {step < 3 ? (
                  <TouchableOpacity style={[styles.nextButton, step === 0 && styles.nextButtonFull]} onPress={goNext} activeOpacity={0.8}>
                    <Text style={styles.nextButtonText}>Continue</Text>
                    <ChevronRight size={18} color="#fff" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.nextButton, loading && styles.nextButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={loading}
                    activeOpacity={0.8}
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

      <DatePickerModal
        visible={showDatePicker}
        value={formData.birthday}
        onConfirm={(d) => update('birthday', d)}
        onClose={() => setShowDatePicker(false)}
      />
      <PrivacyPolicyModal
        visible={showPrivacyPolicy}
        onClose={() => setShowPrivacyPolicy(false)}
      />
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

  logoContainer: { alignItems: 'center', marginBottom: 22 },
  logoCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(76,175,114,0.35)',
  },
  logo: { width: 66, height: 66, borderRadius: 33 },
  brandTitle: { fontSize: 28, fontWeight: '800', color: '#ffffff', letterSpacing: 0.6 },
  brandSubtitle: { fontSize: 12, color: '#a8c5b3', marginTop: 4, textAlign: 'center' },

  stepsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    width: '100%',
  },
  stepItem: { alignItems: 'center', width: 52 },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: '#2d5f3c',
    marginTop: 19,
  },
  stepConnectorDone: { backgroundColor: '#4caf72' },
  stepDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#122b1a',
    borderWidth: 2,
    borderColor: '#2d5f3c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: { borderColor: '#4caf72', backgroundColor: '#1a4228' },
  stepDotDone: { backgroundColor: '#2d5f3c', borderColor: '#4caf72' },
  stepDotText: { fontSize: 14 },
  stepLabel: { fontSize: 10, color: '#5a8a6a', marginTop: 4, textAlign: 'center' },
  stepLabelActive: { color: '#a8c5b3', fontWeight: '700' },

  authCard: {
    width: '100%',
    backgroundColor: '#183d23',
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderTopColor: 'rgba(76,175,114,0.45)',
    borderTopWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 14,
  },

  stepTitle: { fontSize: 20, color: '#ffffff', fontWeight: '700', marginBottom: 4 },
  stepSubtitle: { fontSize: 12, color: '#5a8a6a', marginBottom: 18 },
  sectionHeading: {
    fontSize: 11,
    color: '#4caf72',
    fontWeight: '700',
    letterSpacing: 1,
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
    borderColor: 'rgba(255,255,255,0.1)',
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
  dateDisplay: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    paddingVertical: 6,
  },
  dateDisplayPlaceholder: { color: '#5a8a6a' },
  eyeButton: { padding: 6 },
  hint: { fontSize: 10, color: '#5a8a6a', marginTop: 4 },

  genderRow: { flexDirection: 'row', gap: 8 },
  genderChip: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#0b2211',
    alignItems: 'center',
  },
  genderChipActive: { borderColor: '#4caf72', backgroundColor: '#1a4228' },
  genderChipText: { color: '#5a8a6a', fontSize: 13, fontWeight: '600' },
  genderChipTextActive: { color: '#ffffff' },

  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b2211',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  fileButtonText: { flex: 1, color: '#a8c5b3', fontSize: 13 },
  imagePreviewBtn: {
    borderRadius: 10,
    overflow: 'hidden',
    height: 110,
    borderWidth: 1,
    borderColor: 'rgba(76,175,114,0.3)',
  },
  imagePreview: { width: '100%', height: '100%' },
  imagePreviewOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 6,
    alignItems: 'center',
  },
  imagePreviewText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },

  reviewSection: {
    backgroundColor: '#0b2211',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  reviewSectionTitle: {
    fontSize: 11,
    color: '#4caf72',
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  reviewLabel: { color: '#5a8a6a', fontSize: 12, flex: 1 },
  reviewValue: { color: '#e0ece4', fontSize: 12, flex: 2, textAlign: 'right', fontWeight: '600' },

  noteBox: {
    backgroundColor: 'rgba(76,175,114,0.08)',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(76,175,114,0.2)',
  },
  noteText: { color: '#a8c5b3', fontSize: 12, lineHeight: 18 },
  noteBold: { color: '#4caf72', fontWeight: '700' },

  privacyAgreementBox: {
    marginTop: 12,
    padding: 14,
    backgroundColor: 'rgba(76,175,114,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(76,175,114,0.2)',
  },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: '#0b2211',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: '#4caf72', borderColor: '#4caf72' },
  privacyText: { flex: 1, color: '#a8c5b3', fontSize: 12, lineHeight: 18 },
  privacyLink: { color: '#4caf72', fontWeight: '700' },

  navRow: { flexDirection: 'row', marginTop: 20, gap: 10 },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
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
    paddingVertical: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(76,175,114,0.3)',
  },
  nextButtonFull: { flex: 1 },
  nextButtonDisabled: { opacity: 0.5 },
  nextButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },

  bottomText: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 18 },
  registerText: { color: '#a8c5b3', fontSize: 14 },
  registerLink: { color: '#4caf72', fontWeight: '700', fontSize: 14 },
  footer: { color: '#5a8a6a', fontSize: 11, marginTop: 16, textAlign: 'center' },
});

// ─── Date Picker Styles ────────────────────────────────────────────────────
const dpStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#183d23',
    borderRadius: 20,
    padding: 20,
    width: Math.min(320, windowWidth - 48),
    borderWidth: 1,
    borderColor: 'rgba(76,175,114,0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 16,
  },
  title: { fontSize: 15, color: '#ffffff', fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 14,
  },
  navBtn: { padding: 6, borderRadius: 8, backgroundColor: 'rgba(76,175,114,0.12)' },
  yearLabel: { color: '#ffffff', fontSize: 14, fontWeight: '700', minWidth: 46, textAlign: 'center' },
  monthLabel: { color: '#ffffff', fontSize: 14, fontWeight: '700', minWidth: 82, textAlign: 'center' },
  divider: { width: 1, height: 18, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 4 },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  cell: {
    width: `${100 / 7}%` as any,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 999,
  },
  cellSelected: { backgroundColor: '#4caf72' },
  weekDay: { color: '#4caf72', fontSize: 11, fontWeight: '700' },
  cellText: { color: '#a8c5b3', fontSize: 13, fontWeight: '500' },
  cellTextSelected: { color: '#ffffff', fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
  },
  cancelText: { color: '#a8c5b3', fontSize: 14, fontWeight: '600' },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2d5f3c',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(76,175,114,0.3)',
  },
  confirmText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
});

// ─── Privacy Policy Styles ─────────────────────────────────────────────────
const ppStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#183d23',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    maxHeight: '82%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(76,175,114,0.4)',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { fontSize: 16, color: '#ffffff', fontWeight: '700' },
  effective: { fontSize: 11, color: '#5a8a6a', marginBottom: 14 },
  scroll: { flexGrow: 0 },
  sectionTitle: {
    fontSize: 11,
    color: '#4caf72',
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  body: { fontSize: 12, color: '#a8c5b3', lineHeight: 19 },
  bold: { fontWeight: '700', color: '#e0ece4' },
  closeBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#2d5f3c',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(76,175,114,0.3)',
  },
  closeText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
});
