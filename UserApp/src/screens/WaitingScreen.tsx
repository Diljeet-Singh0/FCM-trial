import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  onBack: () => void;
  companyName: string;
  totalPrice: number;
};

const WaitingScreen = ({ onBack, companyName, totalPrice }: Props) => {
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
  }, []);

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

      <View style={s.content}>
        <Animated.View style={[s.spinnerOuter, { transform: [{ scale: pulseAnim }] }]}>
          <Animated.View style={[s.spinnerRing, { transform: [{ rotate: spin }] }]}>
            <View style={s.spinnerDot} />
          </Animated.View>
          <Text style={s.truckEmoji}>🚛</Text>
        </Animated.View>

        <Text style={s.title}>Waiting for Drivers...</Text>
        <Text style={s.subtitle}>Your booking request has been sent to nearby drivers</Text>

        <View style={s.infoCard}>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Company</Text>
            <Text style={s.infoValue}>{companyName}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Amount</Text>
            <Text style={[s.infoValue, { color: '#16A34A' }]}>₹{totalPrice}</Text>
          </View>
        </View>

        <View style={s.tipsCard}>
          <Text style={s.tipsTitle}>💡 Did you know?</Text>
          <Text style={s.tipsText}>Drivers typically respond within 2-5 minutes. You'll receive a notification when a driver accepts.</Text>
        </View>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backArrow: { fontSize: 24, color: '#111827', fontWeight: '300' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 60 },
  spinnerOuter: { width: 140, height: 140, justifyContent: 'center', alignItems: 'center', marginBottom: 30 },
  spinnerRing: { width: 140, height: 140, borderRadius: 70, borderWidth: 4, borderColor: '#E5E7EB', borderTopColor: '#1A56DB', borderRightColor: '#1A56DB', position: 'absolute' },
  spinnerDot: { position: 'absolute', top: 0, left: '50%', marginLeft: -6, width: 12, height: 12, borderRadius: 6, backgroundColor: '#1A56DB' },
  truckEmoji: { fontSize: 48 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 30 },
  infoCard: { width: '100%', backgroundColor: '#FFF', borderRadius: 16, padding: 16, elevation: 2, borderWidth: 1, borderColor: '#F3F4F6', marginBottom: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  infoLabel: { fontSize: 14, color: '#6B7280' },
  infoValue: { fontSize: 15, fontWeight: '700', color: '#111827' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 4 },
  tipsCard: { width: '100%', backgroundColor: '#FFFBEB', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#FDE68A' },
  tipsTitle: { fontSize: 14, fontWeight: '700', color: '#92400E', marginBottom: 4 },
  tipsText: { fontSize: 13, color: '#78350F', lineHeight: 20 },
});

export default WaitingScreen;
