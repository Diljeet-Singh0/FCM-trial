import React, { useState, useRef, useEffect } from 'react';
import { Alert, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { rateTrip } from '../api';

type Props = { requestId: string; driverName: string; onDone: () => void };

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent!'];
const COLORS = ['', '#EF4444', '#F59E0B', '#F59E0B', '#22C55E', '#059669'];

const RateDriverScreen = ({ requestId, driverName, onDone }: Props) => {
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }, []);

  const submitRating = async () => {
    if (rating === 0) { Alert.alert('Select Rating', 'Please tap a star.'); return; }
    setSubmitting(true);
    const res = await rateTrip(requestId, rating);
    setSubmitting(false);
    if (res.success) setSubmitted(true);
    else Alert.alert('Error', res.error ?? 'Could not submit rating');
  };

  if (submitted) {
    return (
      <View style={s.container}>
        <View style={s.center}>
          <View style={s.successCircle}><Text style={{ fontSize: 48 }}>🎉</Text></View>
          <Text style={s.thankTitle}>Thank You!</Text>
          <Text style={s.thankSub}>Your rating has been submitted</Text>
          <View style={s.starsDisplayRow}>
            {[1,2,3,4,5].map(i => (
              <Text key={i} style={[s.starLg, i <= rating ? {color:'#F59E0B'} : {color:'#E2E8F0'}]}>★</Text>
            ))}
          </View>
          <TouchableOpacity style={s.doneBtn} onPress={onDone} activeOpacity={0.8}>
            <Text style={s.doneBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.center}>
        <View style={s.completedBadge}>
          <Text style={{ fontSize: 20 }}>✅</Text>
          <Text style={s.completedText}>Delivery Completed!</Text>
        </View>
        <Animated.View style={[s.rateCard, { transform: [{ scale: scaleAnim }] }]}>
          <View style={s.avatar}><Text style={s.avatarText}>{driverName.charAt(0)}</Text></View>
          <Text style={s.rateTitle}>Rate {driverName}</Text>
          <Text style={s.rateSub}>How was your delivery experience?</Text>
          <View style={s.starsRow}>
            {[1,2,3,4,5].map(star => (
              <TouchableOpacity key={star} onPress={() => setRating(star)} style={s.starBtn}>
                <Text style={[s.starText, star <= rating && s.starActive]}>{star <= rating ? '★' : '☆'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {rating > 0 && (
            <View style={[s.labelBadge, { backgroundColor: COLORS[rating] + '18' }]}>
              <Text style={[s.labelText, { color: COLORS[rating] }]}>{LABELS[rating]}</Text>
            </View>
          )}
          <TouchableOpacity style={[s.submitBtn, submitting && { opacity: 0.6 }]} onPress={submitRating} disabled={submitting} activeOpacity={0.8}>
            <Text style={s.submitBtnText}>{submitting ? 'Submitting...' : 'Submit Rating'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDone} style={{ paddingVertical: 10 }}>
            <Text style={s.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  completedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', borderRadius: 30, paddingHorizontal: 22, paddingVertical: 12, marginBottom: 28, borderWidth: 1, borderColor: '#A7F3D0' },
  completedText: { marginLeft: 8, fontSize: 16, fontWeight: '700', color: '#065F46' },
  rateCard: { width: '100%', backgroundColor: '#FFF', borderRadius: 24, padding: 32, alignItems: 'center', elevation: 6, shadowColor: '#1A3B6D', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  avatar: { width: 72, height: 72, borderRadius: 22, backgroundColor: '#1A56DB', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  avatarText: { color: '#FFF', fontSize: 30, fontWeight: '700' },
  rateTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  rateSub: { fontSize: 14, color: '#64748B', marginTop: 4, marginBottom: 24, fontWeight: '500' },
  starsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  starBtn: { padding: 6 },
  starText: { fontSize: 42, color: '#E2E8F0' },
  starActive: { color: '#F59E0B' },
  labelBadge: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 24 },
  labelText: { fontSize: 15, fontWeight: '700' },
  submitBtn: { width: '100%', backgroundColor: '#1A56DB', borderRadius: 14, paddingVertical: 16, marginBottom: 12, elevation: 4, shadowColor: '#1A56DB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  submitBtnText: { color: '#FFF', textAlign: 'center', fontSize: 16, fontWeight: '700' },
  skipText: { fontSize: 14, color: '#94A3B8', fontWeight: '600' },
  successCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 2, borderColor: '#A7F3D0' },
  thankTitle: { fontSize: 28, fontWeight: '800', color: '#0F172A' },
  thankSub: { fontSize: 15, color: '#64748B', marginTop: 6, marginBottom: 16 },
  starsDisplayRow: { flexDirection: 'row', gap: 6, marginBottom: 32 },
  starLg: { fontSize: 36 },
  doneBtn: { backgroundColor: '#1A56DB', borderRadius: 14, paddingHorizontal: 44, paddingVertical: 16, elevation: 4, shadowColor: '#1A56DB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  doneBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});

export default RateDriverScreen;
