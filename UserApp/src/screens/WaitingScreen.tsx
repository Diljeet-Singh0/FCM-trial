import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchRequestDetails } from '../api';

type Props = {
  onBack: () => void;
  companyName: string;
  requestId: string;
  onDriverAccepted: (details: { name: string; phone: string; vehicle: string; price: string }) => void;
};

const WaitingScreen = ({ onBack, companyName, requestId, onDriverAccepted }: Props) => {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();

    // Polling logic to check request status reliably
    const interval = setInterval(async () => {
      if (!requestId) return;
      const res = await fetchRequestDetails(requestId);
      if (res.success && res.request && res.request.status !== 'pending') {
        clearInterval(interval);
        onDriverAccepted({
          name: res.request.driver_name || 'Driver',
          phone: res.request.driver_phone || '',
          vehicle: res.request.driver_vehicle || 'PB-10-AB-1234',
          price: res.request.accepted_price?.toString() || '0',
        });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [requestId, onDriverAccepted]);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A56DB" />
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Finding Drivers</Text>
        <View style={s.liveBadge}>
          <View style={s.liveDot} />
          <Text style={s.liveText}>LIVE</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={[s.spinnerSection, { opacity: fadeAnim }]}>
          <Animated.View style={[s.spinnerOuter, { transform: [{ scale: pulseAnim }] }]}>
            <Animated.View style={[s.spinnerRing, { transform: [{ rotate: spin }] }]}>
              <View style={s.spinnerDot} />
            </Animated.View>
            <View style={s.truckCircle}>
              <Text style={s.truckEmoji}>🚛</Text>
            </View>
          </Animated.View>
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
          <Text style={s.title}>Searching for Drivers...</Text>
          <Text style={s.subtitle}>Your booking has been sent to nearby drivers{'\n'}You'll be notified when one accepts</Text>
        </Animated.View>

        {/* Company info */}
        <View style={s.infoCard}>
          <View style={s.infoIconWrap}>
            <Text style={{ fontSize: 20 }}>🏢</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.infoLabel}>Transport Company</Text>
            <Text style={s.infoValue}>{companyName}</Text>
          </View>
        </View>

        {/* Auto Charges Pricing Card */}
        <View style={s.priceCard}>
          <View style={s.priceHeader}>
            <Text style={s.priceHeaderIcon}>🛺</Text>
            <Text style={s.priceTitle}>Auto Charges</Text>
          </View>

          <View style={s.priceRow}>
            <Text style={s.priceLabel}>Rate per km</Text>
            <Text style={s.priceValue}>₹45</Text>
          </View>

          <View style={s.priceRow}>
            <Text style={s.priceLabel}>Minimum Charge</Text>
            <Text style={[s.priceValue, { color: '#059669', fontWeight: '800' }]}>₹200</Text>
          </View>

          <View style={s.priceDivider} />

          <Text style={s.additionalTitle}>Additional Charges</Text>

          <View style={s.priceRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.priceLabel}>Waiting Charges</Text>
              <Text style={s.priceSublabel}>First 15 min free</Text>
            </View>
            <Text style={s.priceValue}>₹50 / 30 min</Text>
          </View>
        </View>

        <View style={s.tipsCard}>
          <Text style={s.tipsTitle}>💡 Did you know?</Text>
          <Text style={s.tipsText}>Drivers typically respond within 2-5 minutes. You'll receive a notification when a driver accepts.</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 52,
    backgroundColor: '#1A56DB',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
  backArrow: { fontSize: 22, color: '#FFFFFF', fontWeight: '400' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', letterSpacing: 0.3 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80', marginRight: 5 },
  liveText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  scrollContent: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

  // Spinner
  spinnerSection: { marginBottom: 24 },
  spinnerOuter: { width: 140, height: 140, justifyContent: 'center', alignItems: 'center' },
  spinnerRing: {
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 4, borderColor: '#E2E8F0',
    borderTopColor: '#1A56DB', borderRightColor: '#1A56DB',
    position: 'absolute',
  },
  spinnerDot: {
    position: 'absolute', top: -1, left: '50%', marginLeft: -7,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#1A56DB', borderWidth: 2, borderColor: '#FFFFFF',
  },
  truckCircle: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: '#EBF0FF', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#C7D7FE',
  },
  truckEmoji: { fontSize: 32 },

  title: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 8, letterSpacing: 0.1 },
  subtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 24, fontWeight: '500' },

  // Info card
  infoCard: {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4,
    borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 14,
  },
  infoIconWrap: {
    width: 42, height: 42, borderRadius: 12, backgroundColor: '#EBF0FF',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  infoLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginTop: 2 },

  // Price card
  priceCard: {
    width: '100%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4,
    borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 14,
  },
  priceHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  priceHeaderIcon: { fontSize: 20, marginRight: 8 },
  priceTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  priceLabel: { fontSize: 14, color: '#475569', fontWeight: '500' },
  priceSublabel: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  priceValue: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  priceDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 6 },
  additionalTitle: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },

  // Tips
  tipsCard: {
    width: '100%', backgroundColor: '#FFFBEB', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  tipsTitle: { fontSize: 14, fontWeight: '700', color: '#92400E', marginBottom: 6 },
  tipsText: { fontSize: 13, color: '#78350F', lineHeight: 20, fontWeight: '500' },
});

export default WaitingScreen;
