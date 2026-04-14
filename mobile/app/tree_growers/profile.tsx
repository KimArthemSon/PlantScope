import { useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Image, StatusBar } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ProfilePage() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1b5e20" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push('./dashboard')}>
          <MaterialCommunityIcons name="chevron-left" size={22} color="#ffffff" />
          <Text style={styles.backText}>Profile</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.avatarSection}>
          <Image
            source={require('../../assets/images/logo.jpg')}
            style={styles.avatar}
          />
          <Text style={styles.name}>User 101</Text>
          <Text style={styles.role}>Premium Member</Text>
          <Text style={styles.stats}>2,456 Trees planted</Text>
        </View>

        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push({ pathname: './dashboard' })}>
            <MaterialCommunityIcons name="account" size={20} color="#1b5e20" style={styles.menuIcon} />
            <Text style={styles.menuText}>Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push({ pathname: './notification' })}>
            <MaterialCommunityIcons name="bell-outline" size={20} color="#1b5e20" style={styles.menuIcon} />
            <Text style={styles.menuText}>Notifications</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.replace('/login')}>
            <MaterialCommunityIcons name="logout" size={20} color="#1b5e20" style={styles.menuIcon} />
            <Text style={styles.menuText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#1b5e20',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  backText: {
    color: '#ffffff',
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '600',
  },
  card: {
    margin: 20,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 6,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  role: {
    fontSize: 14,
    color: '#1b5e20',
    fontWeight: '700',
    marginBottom: 4,
  },
  stats: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
  menuSection: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 18,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  menuIcon: {
    marginRight: 14,
  },
  menuText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },
});