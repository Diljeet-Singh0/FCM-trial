import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { rateTrip } from '../api';

type Props = {
  requestId: string;
  driverName: string;
  onDone: () => void;
};

const RateDriverScreen = ({ requestId, driverName, onDone }: Props) => {
  const [selectedRating, setSelectedRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submitRating = async () => {
    if (selectedRating === 0) {
      Alert.alert('Select Rating', 'Please tap a star to rate the driver.');
      return;
    }
    setSubmitting(true);
    const res = await rateTrip(requestId, selectedRating);
    setSubmitting(false);
    if (res.success) {
      setSubmitted(true);
    } else {
      Alert.alert('Error', res.error ?? 'Could not submit rating');
    }
  };

  if (submitted) {
    return (
      <View style={s.container}>
        <View style={s.center}>
          <Text style={s.bigEmoji}>🎉</Text>
          <Text style={s.thankTitle}>Thank You!</Text>
          <Text style={s.thankSub}>Your rating has been submitted</Text>
          <Text style={s.starsDisplay}>{'★'.repeat(selectedRating)}{'☆'.repeat(5 - selectedRating)}</Text>
          <TouchableOpacity style={s.doneBtn} onPress={onDone}>
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
          <Text style={s.completedIcon}>✅</Text>
          <Text style={s.completedText}>Delivery Completed!</Text>
        </View>

        <View style={s.rateCard}>
          <View style={s.driverAvatar}>
            <Text style={s.avatarText}>{driverName.charAt(0)}</Text>
          </View>
          <Text style={s.rateTitle}>Rate {driverName}</Text>
          <Text style={s.rateSub}>How was your delivery experience?</Text>

          <View style={s.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setSelectedRating(star)} style={s.starBtn}>
                <Text style={[s.starText, star <= selectedRating && s.starActive]}>
                  {star <= selectedRating ? '★' : '☆'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {selectedRating > 0 && (
            <Text style={s.ratingLabel}>
              {selectedRating === 1 ? 'Poor' : selectedRating === 2 ? 'Fair' : selectedRating === 3 ? 'Good' : selectedRating === 4 ? 'Very Good' : 'Excellent!'}
            </Text>
          )}

          <TouchableOpacity
            style={[s.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={submitRating}
            disabled={submitting}
          >
            <Text style={s.submitBtnText}>{submitting ? 'Submitting...' : 'Submit Rating'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onDone}>
            <Text style={s.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  completedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DCFCE7', borderRadius: 30, paddingHorizontal: 20, paddingVertical: 10, marginBottom: 30 },
  completedIcon: { fontSize: 20 },
  completedText: { marginLeft: 8, fontSize: 16, fontWeight: '700', color: '#166534' },
  rateCard: { width: '100%', backgroundColor: '#FFF', borderRadius: 20, padding: 28, alignItems: 'center', elevation: 4, borderWidth: 1, borderColor: '#F3F4F6' },
  driverAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#1A56DB', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  avatarText: { color: '#FFF', fontSize: 28, fontWeight: '700' },
  rateTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  rateSub: { fontSize: 14, color: '#6B7280', marginTop: 4, marginBottom: 20 },
  starsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  starBtn: { padding: 4 },
  starText: { fontSize: 40, color: '#D1D5DB' },
  starActive: { color: '#F59E0B' },
  ratingLabel: { fontSize: 15, fontWeight: '700', color: '#F59E0B', marginBottom: 20 },
  submitBtn: { width: '100%', backgroundColor: '#1A56DB', borderRadius: 14, paddingVertical: 16, marginBottom: 10 },
  submitBtnText: { color: '#FFF', textAlign: 'center', fontSize: 16, fontWeight: '700' },
  skipText: { fontSize: 14, color: '#6B7280', fontWeight: '600', paddingVertical: 8 },
  bigEmoji: { fontSize: 60, marginBottom: 16 },
  thankTitle: { fontSize: 26, fontWeight: '800', color: '#111827' },
  thankSub: { fontSize: 15, color: '#6B7280', marginTop: 4, marginBottom: 12 },
  starsDisplay: { fontSize: 36, color: '#F59E0B', marginBottom: 30 },
  doneBtn: { backgroundColor: '#1A56DB', borderRadius: 14, paddingHorizontal: 40, paddingVertical: 16 },
  doneBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});

export default RateDriverScreen;
