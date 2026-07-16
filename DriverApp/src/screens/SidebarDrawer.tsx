import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.75;

type Language = 'en' | 'hi' | 'pa';

type Props = {
  visible: boolean;
  onClose: () => void;
  onNavigate: (screen: 'history' | 'settings' | 'earnings' | 'terms' | 'profile' | 'language' | 'scheduled_rides') => void;
  onLogout: () => void;
  isOnline: boolean;
  driverName?: string;
  language: Language;
  t: any;
};

const SidebarDrawer: React.FC<Props> = ({
  visible,
  onClose,
  onNavigate,
  onLogout,
  isOnline,
  driverName = 'Driver',
  language,
  t,
}) => {
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 200,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const getInitials = (name: string) => {
    if (!name) return 'D';
    const parts = name.trim().split(/\s+/);
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  };

  const menuItems = [
    { key: 'profile' as const, icon: '👤', label: 'My Profile', labelHi: 'मेरी प्रोफ़ाइल', labelPa: 'ਮੇਰੀ ਪ੍ਰੋਫਾਈਲ' },
    { key: 'scheduled_rides' as const, icon: '📅', label: 'Scheduled Rides', labelHi: 'निर्धारित सवारी', labelPa: 'ਨਿਰਧਾਰਤ ਸਵਾਰੀਆਂ' },
    { key: 'history' as const, icon: '📋', label: 'History', labelHi: 'इतिहास', labelPa: 'ਇਤਿਹਾਸ' },
    { key: 'earnings' as const, icon: '💰', label: 'My Earnings Analysis', labelHi: 'मेरी कमाई विश्लेषण', labelPa: 'ਮੇਰੀ ਕਮਾਈ ਵਿਸ਼ਲੇਸ਼ਣ' },
    { key: 'language' as const, icon: '🌐', label: 'Language', labelHi: 'भाषा', labelPa: 'ਭਾਸ਼ਾ' },
    { key: 'terms' as const, icon: '📄', label: 'Terms & Conditions', labelHi: 'नियम और शर्तें', labelPa: 'ਨਿਯम और शर्तें' },
  ];

  const getLabel = (item: typeof menuItems[0]) => {
    if (language === 'hi') return item.labelHi;
    if (language === 'pa') return item.labelPa;
    return item.label;
  };

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.5)" />
      
      {/* Dimmed overlay */}
      <Animated.View
        style={[
          styles.overlay,
          { opacity: overlayAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }) },
        ]}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Sidebar */}
      <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
        {/* Profile header */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(driverName)}</Text>
          </View>
          <Text style={styles.driverName}>{driverName}</Text>
          <View style={[styles.statusBadge, isOnline ? styles.statusOnline : styles.statusOffline]}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? '#22C55E' : '#9CA3AF' }]} />
            <Text style={[styles.statusText, { color: isOnline ? '#16A34A' : '#6B7280' }]}>
              {isOnline ? t.online : t.offline}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Menu items */}
        <View style={styles.menuSection}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.menuItem}
              onPress={() => {
                onClose();
                setTimeout(() => onNavigate(item.key), 300);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={styles.menuLabel}>{getLabel(item)}</Text>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.divider} />

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutItem}
          onPress={() => {
            onClose();
            setTimeout(onLogout, 300);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.menuIcon}>🚪</Text>
          <Text style={styles.logoutLabel}>{t.logout}</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.version}>GoZo Driver v1.0.0</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#020617',
    zIndex: 998,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#0F172A',
    zIndex: 999,
    elevation: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 8, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  profileSection: {
    paddingTop: Platform.OS === 'android' ? 60 : 70,
    paddingBottom: 28,
    paddingHorizontal: 24,
    backgroundColor: '#1E1B4B',
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.12)',
    elevation: 6,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  driverName: {
    fontSize: 21,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderWidth: 1,
  },
  statusOnline: {
    backgroundColor: '#10B981',
    borderColor: '#34D399',
  },
  statusOffline: {
    backgroundColor: '#334155',
    borderColor: '#475569',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  divider: {
    height: 1.5,
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    marginVertical: 6,
  },
  menuSection: {
    paddingVertical: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginHorizontal: 10,
    marginVertical: 2,
  },
  menuIcon: {
    fontSize: 20,
    width: 32,
    color: '#818CF8',
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
    marginLeft: 8,
    letterSpacing: 0.1,
  },
  menuChevron: {
    fontSize: 20,
    color: '#475569',
    fontWeight: '800',
  },
  logoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginHorizontal: 10,
    marginTop: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
  },
  logoutLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#FCA5A5',
    marginLeft: 8,
    letterSpacing: 0.2,
  },
  version: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default SidebarDrawer;
