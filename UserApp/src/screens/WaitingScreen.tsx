import React, { useEffect, useRef } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
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
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Finding Drivers</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={[s.spinnerOuter, { transform: [{ scale: pulseAnim }] }]}>
          <Animated.View style={[s.spinnerRing, { transform: [{ rotate: spin }] }]}>
            <View style={s.spinnerDot} />
          </Animated.View>
          <Text style={s.truckEmoji}>🚛</Text>
        </Animated.View>

        <Text style={s.title}>Waiting for Drivers...</Text>
        <Text style={s.subtitle}>Your booking request has been sent to nearby drivers</Text>

        {/* Company info */}
        <View style={s.infoCard}>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Company</Text>
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
            <Text style={[s.priceValue, { color: '#16A34A', fontWeight: '800' }]}>₹200</Text>
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
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backArrow: { fontSize: 24, color: '#111827', fontWeight: '300' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  scrollContent: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 30, paddingBottom: 40 },
  spinnerOuter: { width: 140, height: 140, justifyContent: 'center', alignItems: 'center', marginBottom: 30 },
  spinnerRing: { width: 140, height: 140, borderRadius: 70, borderWidth: 4, borderColor: '#E5E7EB', borderTopColor: '#1A56DB', borderRightColor: '#1A56DB', position: 'absolute' },
  spinnerDot: { position: 'absolute', top: 0, left: '50%', marginLeft: -6, width: 12, height: 12, borderRadius: 6, backgroundColor: '#1A56DB' },
  truckEmoji: { fontSize: 48 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  infoCard: { width: '100%', backgroundColor: '#FFF', borderRadius: 16, padding: 16, elevation: 2, borderWidth: 1, borderColor: '#F3F4F6', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  infoLabel: { fontSize: 14, color: '#6B7280' },
  infoValue: { fontSize: 15, fontWeight: '700', color: '#111827' },
  priceCard: { width: '100%', backgroundColor: '#FFF', borderRadius: 16, padding: 16, elevation: 2, borderWidth: 1.5, borderColor: '#E0F2FE', marginBottom: 12 },
  priceHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  priceHeaderIcon: { fontSize: 22, marginRight: 8 },
  priceTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  priceLabel: { fontSize: 14, color: '#374151' },
  priceSublabel: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  priceValue: { fontSize: 15, fontWeight: '700', color: '#111827' },
  priceDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 8 },
  additionalTitle: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  tipsCard: { width: '100%', backgroundColor: '#FFFBEB', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#FDE68A' },
  tipsTitle: { fontSize: 14, fontWeight: '700', color: '#92400E', marginBottom: 4 },
  tipsText: { fontSize: 13, color: '#78350F', lineHeight: 20 },
});

export default WaitingScreen;
