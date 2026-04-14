import { useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function NotificationPage() {
  const router = useRouter();

  const notifications = [
    { title: 'New Message', description: 'Your tree report is ready.', time: '2h ago' },
    { title: 'Watering Alert', description: 'Zone B needs watering today.', time: '5h ago' },
    { title: 'Growth Update', description: 'New saplings reached 80cm.', time: '1d ago' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1b5e20" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push('./dashboard')}>
          <MaterialCommunityIcons name="chevron-left" size={22} color="#ffffff" />
          <Text style={styles.backText}>Notification</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {notifications.map((item, index) => (
          <View key={index} style={styles.notificationCard}>
            <MaterialCommunityIcons name="bell" size={22} color="#1b5e20" style={styles.notificationIcon} />
            <View style={styles.notificationText}>
              <Text style={styles.notificationTitle}>{item.title}</Text>
              <Text style={styles.notificationDescription}>{item.description}</Text>
            </View>
            <Text style={styles.notificationTime}>{item.time}</Text>
          </View>
        ))}
      </ScrollView>
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
  },
  backText: {
    color: '#ffffff',
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 20,
  },
  content: {
    padding: 20,
  },
  notificationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  notificationIcon: {
    marginRight: 14,
    marginTop: 2,
  },
  notificationText: {
    flex: 1,
  },
  notificationTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  notificationDescription: {
    color: '#6b7280',
    fontSize: 14,
    lineHeight: 20,
  },
  notificationTime: {
    color: '#9ca3af',
    fontSize: 12,
    marginLeft: 10,
  },
});
