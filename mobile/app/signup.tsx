import { useState } from 'react';
import { useRouter } from 'expo-router';
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
} from 'react-native';
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react-native';

const { width: windowWidth } = Dimensions.get('window');
const MAX_CARD_WIDTH = 420;
const HORIZONTAL_PADDING = 16;

export default function Signup() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const inputStyleOverride = { outlineStyle: 'none', outlineWidth: 0, outlineColor: 'transparent' } as any;
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleSubmit = () => {
    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    console.log('Signup submitted:', formData);
    router.push('/login');
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
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Image
                  source={require('../assets/images/logo.jpg')}
                  style={styles.logo}
                />
              </View>
              <Text style={styles.brandTitle}>PlantScope</Text>
              <Text style={styles.brandSubtitle}>Nature's Digital System for TreeGrowers</Text>
            </View>

            <View style={styles.authCard}>
              <Text style={styles.title}>Create Account</Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Full Name</Text>
                <View style={styles.inputContainer}>
                  <User size={20} color="#a8c5b3" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, inputStyleOverride]}
                    placeholder="Enter your name"
                    placeholderTextColor="#a8c5b3"
                    value={formData.name}
                    onChangeText={(text) => setFormData({ ...formData, name: text })}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Email Address</Text>
                <View style={styles.inputContainer}>
                  <Mail size={20} color="#a8c5b3" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, inputStyleOverride]}
                    placeholder="Enter your email"
                    placeholderTextColor="#a8c5b3"
                    value={formData.email}
                    onChangeText={(text) => setFormData({ ...formData, email: text })}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputContainer}>
                  <Lock size={20} color="#a8c5b3" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, inputStyleOverride]}
                    placeholder="Enter your password"
                    placeholderTextColor="#a8c5b3"
                    value={formData.password}
                    onChangeText={(text) => setFormData({ ...formData, password: text })}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                  >
                    {showPassword ? (
                      <EyeOff size={20} color="#a8c5b3" />
                    ) : (
                      <Eye size={20} color="#a8c5b3" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.inputContainer}>
                  <Lock size={20} color="#a8c5b3" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, inputStyleOverride]}
                    placeholder="Confirm your password"
                    placeholderTextColor="#a8c5b3"
                    value={formData.confirmPassword}
                    onChangeText={(text) =>
                      setFormData({ ...formData, confirmPassword: text })
                    }
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeButton}
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={20} color="#a8c5b3" />
                    ) : (
                      <Eye size={20} color="#a8c5b3" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                <Text style={styles.submitButtonText}>Create Account</Text>
              </TouchableOpacity>

              <View style={styles.bottomText}>
                <Text style={styles.registerText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => router.push('/login')}>
                  <Text style={styles.registerLink}>Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.footer}>Protected by nature's encryption</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0d2a17',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  container: {
    width: '100%',
  },
  authContainer: {
    width: '100%',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: 'rgba(255,255,255,0.16)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  brandTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.8,
  },
  brandSubtitle: {
    fontSize: 13,
    color: '#a8c5b3',
    marginTop: 4,
    textAlign: 'center',
  },
  authCard: {
    width: '100%',
    backgroundColor: '#183d23',
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '700',
    marginBottom: 22,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 14,
  },
  label: {
    color: '#a8c5b3',
    fontSize: 13,
    marginBottom: 8,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b2211',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    minHeight: 48,
    color: '#ffffff',
    fontSize: 18,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  eyeButton: {
    padding: 8,
  },
  submitButton: {
    backgroundColor: '#2d5f3c',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  bottomText: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 18,
  },
  registerText: {
    color: '#a8c5b3',
    fontSize: 14,
  },
  registerLink: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  footer: {
    color: '#a8c5b3',
    fontSize: 12,
    marginTop: 22,
    textAlign: 'center',
  },
});
