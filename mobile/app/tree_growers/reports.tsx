import { useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, StatusBar, Dimensions, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const { width } = Dimensions.get('window');
const CARD_MARGIN = 16;

export default function TreeGrowersApp() {
  const router = useRouter();
  const segments = useSegments();
  const currentRoute = segments[segments.length - 1] ?? 'dashboard';
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState<'profile' | 'notification' | 'logout' | null>(null);
  const isProfileActive = selectedMenu === 'profile' || currentRoute === 'profile';
  const isNotificationActive = selectedMenu === 'notification' || currentRoute === 'notification';
  const isLogoutActive = selectedMenu === 'logout';

  const actions: { icon: IconName; label: string; gradient: string[] }[] = [
    { icon: 'sprout', label: 'Plant Trees', gradient: ['#1b5e20', '#2e7d32'] },
    { icon: 'white-balance-sunny', label: 'Monitor', gradient: ['#e65100', '#f57c00'] },
    { icon: 'chart-line', label: 'Growth', gradient: ['#1b5e20', '#2e7d32'] },
  ];

  const activities: { icon: IconName; title: string; description: string; time: string; iconColor: string; bgColor: string }[] = [
    {
      icon: 'check-circle',
      title: 'Planting Complete',
      description: '50 Oak saplings successfully planted in Section A',
      time: '2 hours ago',
      iconColor: '#2e7d32',
      bgColor: '#e8f5e9',
    },
    {
      icon: 'water',
      title: 'Watering Reminder',
      description: 'Zone B needs watering - optimal time is now',
      time: '5 hours ago',
      iconColor: '#1976d2',
      bgColor: '#e3f2fd',
    },
    {
      icon: 'alert-circle',
      title: 'Care Required',
      description: 'Pine trees in Section C show signs of nutrient deficiency',
      time: '1 day ago',
      iconColor: '#f57c00',
      bgColor: '#fff3e0',
    },
    {
      icon: 'check-circle',
      title: 'Growth Milestone',
      description: 'Maple trees reached 2m height - ready for transplant',
      time: '2 days ago',
      iconColor: '#2e7d32',
      bgColor: '#e8f5e9',
    },
  ];

  const stats: { icon: IconName; label: string; value: string; change: string }[] = [
    { label: 'Trees Planted', value: '2,456', change: '+12.5%', icon: 'pine-tree' },
    { label: 'Growing', value: '1,824', change: '+8.2%', icon: 'sprout' },
    { label: 'Need Care', value: '47', change: '-3.1%', icon: 'water' },
    { label: 'Harvested', value: '632', change: '+15.3%', icon: 'leaf' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1b5e20" />

      {/* Header
      <View style={styles.header}>
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <View style={styles.logoContainer}>
              <View style={styles.headerProfileCard}>
                <Image
                  source={require('../../assets/images/logo.jpg')}
                  style={styles.headerProfileAvatar}
                />
              </View>
              <Text style={styles.logoText}>Plantscope</Text>
            </View>
          </View>

          <View style={styles.topBarRight}>
            <TouchableOpacity style={styles.headerIconButton}>
              <MaterialCommunityIcons name="magnify" size={22} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => setProfileMenuOpen(!profileMenuOpen)}
            >
              <MaterialCommunityIcons name="account-circle" size={22} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

      </View> */}

      {profileMenuOpen && (
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.overlayBackdrop}
            onPress={() => {
              setSelectedMenu(null);
              setProfileMenuOpen(false);
            }}
          />
          <View style={styles.profileDropdownOverlay}>
            <Text style={styles.profileDropdownTitle}>Account menu</Text>
                <TouchableOpacity
              style={[styles.profileMenuItem, isProfileActive && styles.profileMenuItemSelected]}
              onPress={() => {
                setSelectedMenu('profile');
                setTimeout(() => {
                  setProfileMenuOpen(false);
                  router.push({ pathname: '/profile' });
                }, 180);
              }}
            >
              <MaterialCommunityIcons
                name="account"
                size={20}
                color={isProfileActive ? '#1b5e20' : '#1b5e20'}
                style={styles.profileMenuIcon}
              />
              <Text style={[styles.profileMenuText, isProfileActive && styles.profileMenuTextActive]}>Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.profileMenuItem, isNotificationActive && styles.profileMenuItemSelected]}
              onPressIn={() => setSelectedMenu('notification')}
              onPress={() => {
                setTimeout(() => {
                  setProfileMenuOpen(false);
                  router.push({ pathname: './notification' });
                }, 180);
              }}
            >
              <MaterialCommunityIcons
                name="bell-outline"
                size={20}
                color={isNotificationActive ? '#1b5e20' : '#1b5e20'}
                style={styles.profileMenuIcon}
              />
              <Text style={[styles.profileMenuText, isNotificationActive && styles.profileMenuTextActive]}>Notifications</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.profileMenuItem, isLogoutActive && styles.profileMenuItemSelected]}
              onPressIn={() => setSelectedMenu('logout')}
              onPress={() => {
                setTimeout(() => {
                  setProfileMenuOpen(false);
                  router.replace('/login');
                }, 180);
              }}
            >
              <MaterialCommunityIcons name="logout" size={20} color={isLogoutActive ? '#1b5e20' : '#1b5e20'} style={styles.profileMenuIcon} />
              <Text style={[styles.profileMenuText, isLogoutActive && styles.profileMenuTextActive]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main Content */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Quick Actions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tree Care Actions</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.actionsGrid}>
            {actions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.actionCard}
                activeOpacity={0.8}
              >
                <View
                  style={[styles.actionIconContainer, { backgroundColor: action.gradient[0] }]}
                >
                  <MaterialCommunityIcons name={action.icon} size={26} color="#ffffff" />
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Garden Stats */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Garden Statistics</Text>
            <TouchableOpacity style={styles.filterButton}>
              <Text style={styles.filterText}>This Month</Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <View style={styles.statsGrid}>
            {stats.map((stat, index) => (
              <View key={index} style={styles.statCard}>
                <View style={styles.statHeader}>
                  <View style={styles.statIconContainer}>
                    <MaterialCommunityIcons name={stat.icon} size={20} color="#1b5e20" />
                  </View>
                  <View style={styles.statBadge}>
                    <MaterialCommunityIcons name="trending-up" size={12} color="#2e7d32" />
                    <Text style={styles.statBadgeText}>{stat.change}</Text>
                  </View>
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Activity Feed */}
        <View style={[styles.section, styles.lastSection]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.activitiesList}>
            {activities.map((activity, index) => (
              <TouchableOpacity
                key={index}
                style={styles.activityCard}
                activeOpacity={0.7}
              >
                <View
                  style={[styles.activityIconContainer, { backgroundColor: activity.bgColor }]}
                >
                  <MaterialCommunityIcons name={activity.icon} size={24} color={activity.iconColor} />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>{activity.title}</Text>
                  <Text
                    style={styles.activityDescription}
                    numberOfLines={2}
                  >
                    {activity.description}
                  </Text>
                  <View style={styles.activityFooter}>
                    <MaterialCommunityIcons name="clock-outline" size={14} color="#9ca3af" />
                    <Text style={styles.activityTime}>{activity.time}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
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
    paddingTop: 0,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuButton: {
    padding: 4,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  headerProfileCard: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginRight: 10,
  },
  headerProfileAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#1b5e20',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  profileDropdownOverlay: {
    width: 210,
    marginTop: 82,
    marginRight: 16,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  profileDropdownTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1b5e20',
    marginBottom: 12,
  },
  profileMenuItem: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    marginBottom: 10,
    backgroundColor: '#f8fafc',
  },
  profileMenuItemSelected: {
    borderWidth: 2,
    borderColor: '#2e7d32',
    backgroundColor: '#e8f5e9',
  },
  menuItemGradient: {
    display: 'none',
  },
  profileMenuIcon: {
    marginRight: 10,
    zIndex: 1,
  },
  profileMenuText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    zIndex: 1,
  },
  profileMenuTextActive: {
    color: '#1b5e20',
  },
  profileMenuTextOnGradient: {
    color: '#ffffff',
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    position: 'relative',
  },
  navButtonActive: {},
  navIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  navIconContainerActive: {
    backgroundColor: '#2e7d32',
    transform: [{ scale: 1.05 }],
  },
  navBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  navBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  navLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
    fontWeight: '600',
  },
  navLabelActive: {
    color: '#1b5e20',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    marginHorizontal: CARD_MARGIN,
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 4,
    shadowColor: '#1b5e20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileAvatarContainer: {
    position: 'relative',
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: '#e8f5e9',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10b981',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  profileInfo: {
    marginLeft: 14,
    flex: 1,
  },
  profileGreeting: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 2,
  },
  profileX: {
    fontSize: 25,
    color: '#6b7280',
    marginBottom: 2,
  },
  profileNameImage: {
    width: 100,
    height: 40,
    resizeMode: 'contain',
    marginBottom: 2,
  },
  profileSubtitle: {
    fontSize: 12,
    color: '#2e7d32',
    fontWeight: '600',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    paddingHorizontal: CARD_MARGIN,
    marginTop: 24,
  },
  lastSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111827',
  },
  seeAllText: {
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: '600',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  filterText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: (width - CARD_MARGIN * 2 - 24) / 3,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  actionLabel: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: (width - CARD_MARGIN * 2 - 12) / 2,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#f0fdf4',
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 2,
  },
  statBadgeText: {
    fontSize: 11,
    color: '#2e7d32',
    fontWeight: '700',
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  activitiesList: {
    gap: 12,
  },
  activityCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  activityIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityContent: {
    flex: 1,
    marginLeft: 14,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  activityDescription: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
    marginBottom: 8,
  },
  activityFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activityTime: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
});
