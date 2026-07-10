import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { fetchUserProfile } from '../api';

type Language = 'en' | 'hi' | 'pa';

type Props = {
  onBack: () => void;
  onLogout: () => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: any; // translation object
  driverId: string;
};

const DriverSettingsScreen: React.FC<Props> = ({ onBack, onLogout, language, setLanguage, t, driverId }) => {
  const [autoAccept, setAutoAccept] = useState(false);
  const [soundsEnabled, setSoundsEnabled] = useState(true);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ name: string; phone: string; vehicle?: string } | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetchUserProfile(driverId);
        if (res.success && res.user) {
          setProfile({
            name: res.user.name,
            phone: res.user.phone,
            vehicle: res.user.factory_name, // Transporter's vehicle is stored in factory_name column in DB
          });
        }
      } catch (err) {
        console.error('Error loading driver profile:', err);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [driverId]);

  const handleLogout = () => {
    Alert.alert(t.logout, t.logoutConfirm, [
      { text: 'Cancel', style: 'cancel' },
      { text: t.logout, style: 'destructive', onPress: onLogout }
    ]);
  };

  const getInitials = (fullName: string) => {
    if (!fullName) return 'D';
    const parts = fullName.trim().split(/\s+/);
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
        <Text style={s.headerTitle}>{t.settings}</Text>
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
                {profile.vehicle ? (
                  <Text style={s.vehicleName}>🚛 {profile.vehicle}</Text>
                ) : null}
              </View>
            </>
          ) : (
            <View style={s.profileInfo}>
              <Text style={s.profileName}>{t.driverAccount}</Text>
              <Text style={s.profilePhone}>ID: {driverId.slice(0, 8)}...</Text>
            </View>
          )}
        </View>

        {/* Language Section */}
        <Text style={s.sectionTitle}>Language / भाषा / ਭਾਸ਼ਾ</Text>
        <View style={s.sectionCard}>
          <View style={s.languageRow}>
            <TouchableOpacity 
              style={[s.langBtn, language === 'en' && s.langBtnActive]} 
              onPress={() => setLanguage('en')}
            >
              <Text style={[s.langBtnText, language === 'en' && s.langBtnTextActive]}>English</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[s.langBtn, language === 'hi' && s.langBtnActive]} 
              onPress={() => setLanguage('hi')}
            >
              <Text style={[s.langBtnText, language === 'hi' && s.langBtnTextActive]}>हिन्दी</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[s.langBtn, language === 'pa' && s.langBtnActive]} 
              onPress={() => setLanguage('pa')}
            >
              <Text style={[s.langBtnText, language === 'pa' && s.langBtnTextActive]}>ਪੰਜਾਬੀ</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Preferences Section */}
        <Text style={s.sectionTitle}>{t.driverPreferences}</Text>
        <View style={s.sectionCard}>
          <View style={s.settingRow}>
            <View style={[s.settingIconBox, { backgroundColor: '#334155' }]}>
              <Text style={{ fontSize: 18 }}>⚡</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.settingLabel}>{t.autoAcceptRides}</Text>
              <Text style={s.settingSub}>{t.autoAcceptDesc}</Text>
            </View>
            <Switch
              value={autoAccept}
              onValueChange={setAutoAccept}
              trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
              thumbColor={autoAccept ? '#16A34A' : '#F9FAFB'}
            />
          </View>
          <View style={s.divider} />
          <View style={s.settingRow}>
            <View style={[s.settingIconBox, { backgroundColor: '#334155' }]}>
              <Text style={{ fontSize: 18 }}>🔊</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.settingLabel}>{t.appSounds}</Text>
              <Text style={s.settingSub}>{t.appSoundsDesc}</Text>
            </View>
            <Switch
              value={soundsEnabled}
              onValueChange={setSoundsEnabled}
              trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
              thumbColor={soundsEnabled ? '#16A34A' : '#F9FAFB'}
            />
          </View>
        </View>

        {/* Support & Legal */}
        <Text style={s.sectionTitle}>{t.supportAndLegal}</Text>
        <View style={s.sectionCard}>
          <TouchableOpacity style={s.settingRow}>
            <View style={[s.settingIconBox, { backgroundColor: '#334155' }]}>
              <Text style={{ fontSize: 18 }}>🎧</Text>
            </View>
            <Text style={[s.settingLabel, { flex: 1, marginLeft: 12 }]}>{t.helpCenter}</Text>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={{ fontSize: 20, marginRight: 8 }}>🚪</Text>
          <Text style={s.logoutBtnText}>{t.logout}</Text>
        </TouchableOpacity>
        
        <Text style={s.versionText}>GoZo Driver App v1.0.0</Text>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', paddingHorizontal: 16, paddingVertical: 14, zIndex: 10, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 20 },
  backArrow: { fontSize: 20, color: '#F8FAFC', fontWeight: '600' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#F8FAFC', textAlign: 'center' },
  scrollView: { flex: 1 },
  
  profileCard: { backgroundColor: '#064E3B', margin: 16, borderRadius: 24, padding: 24, alignItems: 'center', elevation: 8, shadowColor: '#10B981', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16 },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#D1FAE5', justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 4, borderColor: 'rgba(255,255,255,0.2)' },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#064E3B' },
  profileInfo: { alignItems: 'center' },
  profileName: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  profilePhone: { fontSize: 14, color: '#A7F3D0', fontWeight: '600', marginBottom: 4 },
  vehicleName: { fontSize: 13, color: '#D1FAE5', fontWeight: '600', opacity: 0.9 },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginLeft: 24, marginTop: 10 },
  sectionCard: { backgroundColor: '#0F172A', marginHorizontal: 16, borderRadius: 24, paddingVertical: 8, marginBottom: 24, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, borderWidth: 1, borderColor: '#1E293B' },
  
  languageRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  langBtn: { flex: 1, paddingVertical: 14, borderRadius: 16, backgroundColor: '#1E293B', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  langBtnActive: { backgroundColor: '#064E3B', borderColor: '#10B981' },
  langBtnText: { fontSize: 14, fontWeight: '600', color: '#94A3B8' },
  langBtnTextActive: { color: '#10B981', fontWeight: '800' },

  settingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  settingIconBox: { width: 44, height: 44, borderRadius: 16, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' },
  settingLabel: { fontSize: 16, fontWeight: '700', color: '#F8FAFC' },
  settingSub: { fontSize: 13, color: '#94A3B8', marginTop: 2, fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#1E293B', marginLeft: 76 },
  chevron: { fontSize: 24, color: '#64748B', fontWeight: '400' },

  logoutBtn: { flexDirection: 'row', backgroundColor: '#450a0a', marginHorizontal: 16, borderRadius: 20, paddingVertical: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#7f1d1d', marginTop: 12, elevation: 2, shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  logoutBtnText: { color: '#fca5a5', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  
  versionText: { textAlign: 'center', color: '#64748B', fontSize: 13, marginTop: 32, marginBottom: 40, fontWeight: '600' }
});

export default DriverSettingsScreen;
