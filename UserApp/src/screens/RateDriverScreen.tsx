import React, { useState, useRef, useEffect } from 'react';
import { Alert, Animated, StyleSheet, Text, TouchableOpacity, View, StatusBar } from 'react-native';
import { rateTrip } from '../api';

type Props = { requestId: string; driverName: string; onDone: () => void };

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent!'];
const COLORS = ['', '#EF4444', '#F59E0B', '#F59E0B', '#10B981', '#059669'];

const RateDriverScreen = ({ requestId, driverName, onDone }: Props) => {
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }).start();
  }, []);

  const submitRating = async () => {
    if (rating === 0) {
      Alert.alert('Select Rating', 'Please select a star rating.');
      return;
    }
    setSubmitting(true);
    const res = await rateTrip(requestId, rating);
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
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={s.center}>
          <View style={s.successCircle}>
            <Text style={{ fontSize: 44 }}>🎉</Text>
          </View>
          <Text style={s.thankTitle}>Thank You!</Text>
          <Text style={s.thankSub}>Your rating has been submitted successfully</Text>
          <View style={s.starsDisplayRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Text key={i} style={[s.starLg, i <= rating ? { color: '#F59E0B' } : { color: '#E2E8F0' }]}>
                ★
              </Text>
            ))}
          </View>
          <TouchableOpacity style={s.doneBtn} onPress={onDone} activeOpacity={0.85}>
            <Text style={s.doneBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={s.center}>
        <View style={s.completedBadge}>
          <Text style={{ fontSize: 18 }}>✅</Text>
          <Text style={s.completedText}>Delivery Completed</Text>
        </View>

        <Animated.View style={[s.rateCard, { transform: [{ scale: scaleAnim }] }]}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{driverName.charAt(0)}</Text>
          </View>
          <Text style={s.rateTitle}>Rate {driverName}</Text>
          <Text style={s.rateSub}>How was your experience with this delivery?</Text>
          
          <View style={s.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setRating(star)}
                style={s.starBtn}
                activeOpacity={0.7}
              >
                <Text style={[s.starText, star <= rating && s.starActive]}>
                  {star <= rating ? '★' : '☆'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {rating > 0 && (
            <View style={[s.labelBadge, { backgroundColor: COLORS[rating] + '18' }]}>
              <Text style={[s.labelText, { color: COLORS[rating] }]}>{LABELS[rating]}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[s.submitBtn, rating === 0 && s.disabledBtn, submitting && { opacity: 0.6 }]}
            onPress={submitRating}
            disabled={submitting || rating === 0}
            activeOpacity={0.85}
          >
            <Text style={s.submitBtnText}>{submitting ? 'Submitting...' : 'Submit Review'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onDone} style={s.skipBtn} activeOpacity={0.7}>
            <Text style={s.skipText}>Skip feedback</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F7F0',
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  completedText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '700',
    color: '#10B981',
  },
  rateCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 28,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 8,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
  },
  rateTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  rateSub: {
    fontSize: 13,
    color: '#6B6B6B',
    marginTop: 6,
    marginBottom: 20,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  starBtn: {
    padding: 4,
  },
  starText: {
    fontSize: 42,
    color: '#E2E8F0',
  },
  starActive: {
    color: '#F59E0B',
  },
  labelBadge: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 24,
  },
  labelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  submitBtn: {
    width: '100%',
    backgroundColor: '#10B981',
    borderRadius: 28,
    paddingVertical: 16,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  disabledBtn: {
    backgroundColor: '#D1D5DB',
    elevation: 0,
    shadowOpacity: 0,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  skipBtn: {
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 13,
    color: '#6B6B6B',
    fontWeight: '600',
  },
  successCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#E6F7F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#A7F3D0',
  },
  thankTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  thankSub: {
    fontSize: 14,
    color: '#6B6B6B',
    marginTop: 6,
    marginBottom: 20,
    textAlign: 'center',
  },
  starsDisplayRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 28,
  },
  starLg: {
    fontSize: 32,
  },
  doneBtn: {
    backgroundColor: '#10B981',
    borderRadius: 28,
    paddingHorizontal: 36,
    paddingVertical: 16,
    elevation: 2,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default RateDriverScreen;
