import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ImageBackground,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin, BarChart3, Globe, Mail, Phone, ChevronRight } from 'lucide-react-native';

export default function HomePage() {
  const router = useRouter();

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoCircle}>
            <Image
              source={require('../assets/images/logo.jpg')}
              style={styles.logoImage}
            />
          </View>
          <Text style={styles.brandTitle}>  PlantScope</Text>
        </View>
        <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/login')}>
          <Text style={styles.loginButtonText}>Login</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ImageBackground
          source={{
            uri: 'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=1200&h=800&fit=crop',
          }}
          style={styles.heroBackground}
          resizeMode="cover"
        >
          <View style={styles.heroOverlay} />

          <View style={styles.heroContent}>
            <View style={styles.heroCard}>
              <View style={styles.heroLogoCircle}>
                <Image
                  source={require('../assets/images/logo.jpg')}
                  style={styles.heroLogoImage}
                />
              </View>
              <Text style={styles.heroTagline}>Data-Driven Reforestation Platform</Text>
              <Text style={styles.heroDescription}>
                GIS-enabled site identification system for strategic reforestation in Ormoc City, Leyte.
              </Text>
              <TouchableOpacity style={styles.ctaButton} onPress={() => router.push('/login')}>
                <Text style={styles.ctaButtonText}>Explore Dashboard</Text>
                <ChevronRight size={18} color="#0f4a2f" style={styles.ctaIcon} />
              </TouchableOpacity>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Core Features</Text>
          <View style={styles.featureCard}>
            <View style={styles.featureIconBackground}>
              <MapPin size={24} color="#7cd56a" />
            </View>
            <Text style={styles.featureTitle}>GIS-Powered Mapping</Text>
            <Text style={styles.featureText}>
              Multi-layer spatial analysis integrating elevation, slope, soil type, and water sources.
            </Text>
          </View>

          <View style={styles.featureCard}>
            <View style={styles.featureIconBackground}>
              <BarChart3 size={24} color="#7cd56a" />
            </View>
            <Text style={styles.featureTitle}>Data-Driven Prioritization</Text>
            <Text style={styles.featureText}>
              Scientific scoring system based on ecological restoration potential and climate resilience.
            </Text>
          </View>

          <View style={styles.featureCard}>
            <View style={styles.featureIconBackground}>
              <Globe size={24} color="#7cd56a" />
            </View>
            <Text style={styles.featureTitle}>Focused on Ormoc City</Text>
            <Text style={styles.featureText}>
              Tailored for post-Yolanda recovery zones and degraded watersheds in Leyte.
            </Text>
          </View>
        </View>

        <View style={[styles.section, styles.aboutSection]}>
          <Text style={styles.aboutTitle}>About PlantScope</Text>
          <Text style={styles.aboutText}>
            A capstone project by students of Western Leyte College of Ormoc City, combining GIS with data analytics to identify and prioritize reforestation sites.
          </Text>
          <View style={styles.aboutNote}>
            <Text style={styles.aboutNoteText}>
              Our mission: Provide scientific tools for strategic reforestation planning, ensuring maximum ecological impact and sustainable forest recovery.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <View style={styles.contactCard}>
            <View style={styles.contactIconBackground}>
              <Phone size={20} color="#7cd56a" />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Phone</Text>
              <Text style={styles.contactText}>0951 513 36268</Text>
            </View>
          </View>
          <View style={styles.contactCard}>
            <View style={styles.contactIconBackground}>
              <Mail size={20} color="#7cd56a" />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Email</Text>
              <Text style={styles.contactText}>marcxyver.gica@wlcormoc.edu.ph</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Western Leyte College of Ormoc City</Text>
          <Text style={styles.footerText}>College of ICT & Engineering</Text>
          <Text style={styles.footerSmall}>© 2025 PlantScope. All rights reserved.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    width: '100%',
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  heroBackground: {
    width: '100%',
    minHeight: 680,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 74, 47, 0.8)',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(45, 82, 65, 0.85)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: 'transparent',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  loginButton: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    color: '#0f4a2f',
    fontWeight: '700',
    fontSize: 14,
  },
  heroContent: {
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: 160,
    paddingBottom: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 0,
    maxWidth: 640,
    alignSelf: 'center',
    borderWidth: 0,
  },
  heroLogoCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: 'transparent',
    alignSelf: 'center',
    marginBottom: 18,
  },
  heroLogoImage: {
    width: '100%',
    height: '100%',
  },
  heroTagline: {
    fontSize: 18,
    color: '#bcbcbc',
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  heroDescription: {
    color: 'rgb(230, 230, 230)',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 22,
    textAlign: 'center',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#cad0c9',
    paddingVertical: 16,
    borderRadius: 999,
  },
  ctaButtonText: {
    color: '#055502',
    fontWeight: '700',
    fontSize: 16,
  },
  section: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: '#ffffff',
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f4a2f',
    textAlign: 'center',
    marginBottom: 24,
  },
  featureCard: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: 'rgba(15, 74, 47, 0.12)',
    borderRadius: 24,
    padding: 22,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 4,
  },
  featureIconBackground: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0f4a2f',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f4a2f',
    marginBottom: 10,
  },
  featureText: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
  },
  aboutSection: {
    backgroundColor: '#0f4a2f',
  },
  aboutTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#c9a961',
    textAlign: 'center',
    marginBottom: 16,
  },
  aboutText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 18,
  },
  aboutNote: {
    borderLeftWidth: 4,
    borderLeftColor: '#c9a961',
    paddingLeft: 16,
  },
  aboutNoteText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    lineHeight: 24,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(15, 74, 47, 0.1)',
    marginBottom: 14,
  },
  contactIconBackground: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0f4a2f',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    color: '#0f4a2f',
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 4,
  },
  contactText: {
    color: '#475569',
    fontSize: 14,
  },
  footer: {
    width: '100%',
    paddingHorizontal: 24,
    paddingVertical: 28,
    backgroundColor: '#0f4a2f',
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    marginBottom: 6,
  },
  ctaIcon: {
    marginLeft: 10,
  },
  footerSmall: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
  },
});
