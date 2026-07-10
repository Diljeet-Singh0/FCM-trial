import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchUserProfile } from '../api';

type Props = {
  onBack: () => void;
  onLogout: () => void;
  ownerId: string;
};

const SettingsScreen: React.FC<Props> = ({ onBack, onLogout, ownerId }) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);
  
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ name: string; phone: string; factory_name?: string } | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetchUserProfile(ownerId);
        if (res.success && res.user) {
          setProfile({
            name: res.user.name,
            phone: res.user.phone,
            factory_name: res.user.factory_name,
          });
        }
      } catch (err) {
        console.error('Error loading settings profile:', err);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [ownerId]);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: onLogout }
    ]);
  };

  const getInitials = (fullName: string) => {
    if (!fullName) return 'U';
    const parts = fullName.split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={onBack}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Account Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={s.profileCard}>
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : profile ? (
            <>
              <View style={s.avatarCircle}>
                <Text style={s.avatarText}>{getInitials(profile.name)}</Text>
              </View>
              <View style={s.profileInfo}>
                <Text style={s.profileName}>{profile.name}</Text>
                <Text style={s.profilePhone}>📞 {profile.phone}</Text>
                {profile.factory_name ? (
                  <Text style={s.factoryName}>🏭 {profile.factory_name}</Text>
                ) : null}
              </View>
            </>
          ) : (
            <View style={s.profileInfo}>
              <Text style={s.profileName}>User Account</Text>
              <Text style={s.profilePhone}>ID: {ownerId.slice(0, 8)}...</Text>
            </View>
          )}
        </View>

        {/* Preferences Section */}
        <Text style={s.sectionTitle}>Preferences</Text>
        <View style={s.sectionCard}>
          <View style={s.settingRow}>
            <View style={s.settingIconBox}>
              <Text style={{ fontSize: 18 }}>🔔</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.settingLabel}>Push Notifications</Text>
              <Text style={s.settingSub}>Receive updates on orders</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#E2E8F0', true: '#A7F3D0' }}
              thumbColor={notificationsEnabled ? '#10B981' : '#F5F5F5'}
            />
          </View>
          <View style={s.divider} />
          <View style={s.settingRow}>
            <View style={[s.settingIconBox, { backgroundColor: '#E6F7F0' }]}>
              <Text style={{ fontSize: 18 }}>💬</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.settingLabel}>SMS Alerts</Text>
              <Text style={s.settingSub}>Important updates via SMS</Text>
            </View>
            <Switch
              value={smsEnabled}
              onValueChange={setSmsEnabled}
              trackColor={{ false: '#E2E8F0', true: '#A7F3D0' }}
              thumbColor={smsEnabled ? '#10B981' : '#F5F5F5'}
            />
          </View>
        </View>

        {/* Support & Legal */}
        <Text style={s.sectionTitle}>Support & Legal</Text>
        <View style={s.sectionCard}>
          <TouchableOpacity style={s.settingRow} activeOpacity={0.7}>
            <View style={[s.settingIconBox, { backgroundColor: '#FFF7ED' }]}>
              <Text style={{ fontSize: 18 }}>🎧</Text>
            </View>
            <Text style={[s.settingLabel, { flex: 1, marginLeft: 12 }]}>Help Center</Text>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity style={s.settingRow} activeOpacity={0.7}>
            <View style={[s.settingIconBox, { backgroundColor: '#F5F5F5' }]}>
              <Text style={{ fontSize: 18 }}>📜</Text>
            </View>
            <Text style={[s.settingLabel, { flex: 1, marginLeft: 12 }]}>Terms & Conditions</Text>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={{ fontSize: 20, marginRight: 8 }}>🚪</Text>
          <Text style={s.logoutBtnText}>Secure Logout</Text>
        </TouchableOpacity>
        
        <Text style={s.versionText}>GoZo User App v1.0.0</Text>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 14, zIndex: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 20 },
  backArrow: { fontSize: 20, color: '#1A1A1A', fontWeight: '600' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#1A1A1A', textAlign: 'center' },
  scrollView: { flex: 1 },
  
  profileCard: { backgroundColor: '#10B981', margin: 16, borderRadius: 12, padding: 24, alignItems: 'center', elevation: 4, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 4, borderColor: 'rgba(255,255,255,0.2)' },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#10B981' },
  profileInfo: { alignItems: 'center' },
  profileName: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  profilePhone: { fontSize: 14, color: '#E6F7F0', fontWeight: '600', marginBottom: 4 },
  factoryName: { fontSize: 13, color: '#FFFFFF', fontWeight: '600', opacity: 0.9 },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginLeft: 24, marginTop: 10 },
  sectionCard: { backgroundColor: '#FFFFFF', marginHorizontal: 16, borderRadius: 12, paddingVertical: 8, marginBottom: 24, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  settingIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#E6F7F0', justifyContent: 'center', alignItems: 'center' },
  settingLabel: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  settingSub: { fontSize: 13, color: '#6B6B6B', marginTop: 2, fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginLeft: 76 },
  chevron: { fontSize: 24, color: '#6B6B6B', fontWeight: '400' },

  logoutBtn: { flexDirection: 'row', backgroundColor: '#FEF2F2', marginHorizontal: 16, borderRadius: 28, paddingVertical: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#FCA5A5', marginTop: 12, elevation: 2, shadowColor: '#E53935', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  logoutBtnText: { color: '#E53935', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  
  versionText: { textAlign: 'center', color: '#6B6B6B', fontSize: 13, marginTop: 32, marginBottom: 40, fontWeight: '600' }
});

export default SettingsScreen;
