import React, { useEffect, useRef } from 'react';
import { Alert, Animated, Easing, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { fetchRequestDetails, cancelRequest } from '../api';

type Props = {
  onBack: () => void;
  companyName: string;
  requestId: string;
  onDriverAccepted: (details: { name: string; phone: string; vehicle: string; price: string }) => void;
};

const WaitingScreen = ({ onBack, companyName, requestId, onDriverAccepted }: Props) => {
  const [request, setRequest] = React.useState<any>(null);
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
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();

    let active = true;
    const fetchDetails = async () => {
      if (!requestId || !active) return;
      const res = await fetchRequestDetails(requestId);
      if (res.success && res.request && active) {
        setRequest(res.request);
        if (res.request.status !== 'pending') {
          clearInterval(interval);
          onDriverAccepted({
            name: res.request.driver_name || 'Driver',
            phone: res.request.driver_phone || '',
            vehicle: res.request.driver_vehicle || 'PB-10-AB-1234',
            price: res.request.accepted_price?.toString() || '0',
          });
        }
      }
    };

    fetchDetails();
    const interval = setInterval(fetchDetails, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [requestId, onDriverAccepted]);

  const handleCancel = () => {
    Alert.alert(
      'Cancel Booking?',
      'Are you sure you want to cancel this booking request?',
      [
        { text: 'No, Keep Request', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            const res = await cancelRequest(requestId);
            if (res.success) {
              Alert.alert('Cancelled', 'Your request has been successfully cancelled.');
              onBack();
            } else {
              Alert.alert('Error', res.error || 'Failed to cancel request');
            }
          }
        }
      ]
    );
  };

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Finding Drivers</Text>
        <View style={s.liveBadge}>
          <View style={s.liveDot} />
          <Text style={s.liveText}>SEARCHING</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Animated Radar/Radar-style Loader */}
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

        <Animated.View style={{ opacity: fadeAnim, alignItems: 'center', marginBottom: 20 }}>
          <Text style={s.title}>Matching Nearby Drivers...</Text>
          <Text style={s.subtitle}>Your shipment request has been dispatched. You will be notified instantly when a driver accepts.</Text>
        </Animated.View>

        {/* Selected Transport Company Info */}
        <View style={s.infoCard}>
          <View style={s.infoIconWrap}>
            <Text style={{ fontSize: 20 }}>🏢</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.infoLabel}>Selected Carrier</Text>
            <Text style={s.infoValue}>{companyName}</Text>
          </View>
        </View>

        {/* Pricing & Auto Charges Details Card */}
        {request && request.weight_kg <= 500 ? (
          <View style={s.priceCard}>
            <View style={s.priceHeader}>
              <Text style={s.priceHeaderIcon}>🛺</Text>
              <Text style={s.priceTitle}>Pricing Model (3-Wheeler Auto)</Text>
            </View>

            <View style={s.priceRow}>
              <Text style={s.priceLabel}>Base Rate</Text>
              <Text style={s.priceValue}>₹45 / km</Text>
            </View>

            <View style={s.priceRow}>
              <Text style={s.priceLabel}>Minimum Charge</Text>
              <Text style={[s.priceValue, { color: '#10B981', fontWeight: '700' }]}>₹200</Text>
            </View>

            <View style={s.priceDivider} />

            <Text style={s.additionalTitle}>Additional Terms</Text>

            <View style={s.priceRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.priceLabel}>Waiting Charges</Text>
                <Text style={s.priceSublabel}>First 15 min free</Text>
              </View>
              <Text style={s.priceValue}>₹50 per 30 min</Text>
            </View>
          </View>
        ) : request ? (
          <View style={s.priceCard}>
            <View style={s.priceHeader}>
              <Text style={s.priceHeaderIcon}>💰</Text>
              <Text style={s.priceTitle}>Pricing details</Text>
            </View>
            <View style={s.priceRow}>
              <Text style={s.priceLabel}>Freight Price</Text>
              <Text style={[s.priceValue, { color: '#10B981', fontWeight: '800', fontSize: 18 }]}>
                ₹{request.accepted_price || 'Calculating...'}
              </Text>
            </View>
          </View>
        ) : (
          <View style={s.priceCard}>
            <ActivityIndicator size="small" color="#10B981" />
            <Text style={s.loadingPriceText}>Calculating regional freight price...</Text>
          </View>
        )}

        <View style={s.tipsCard}>
          <Text style={s.tipsTitle}>💡 Logistics Tip</Text>
          <Text style={s.tipsText}>Drivers typically accept within 2 minutes. Feel free to keep the app open or check back via your history screen.</Text>
        </View>

        <TouchableOpacity
          style={s.cancelBtn}
          onPress={handleCancel}
          activeOpacity={0.8}
        >
          <Text style={s.cancelBtnText}>Cancel Booking Request</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 56,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 22,
    color: '#1A1A1A',
    fontWeight: '400',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F7F0',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  liveText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 30,
    paddingBottom: 40,
  },

  // Pulsing radar spinner
  spinnerSection: {
    marginBottom: 28,
  },
  spinnerOuter: {
    width: 130,
    height: 130,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerRing: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 3,
    borderColor: '#E2E8F0',
    borderTopColor: '#10B981',
    borderRightColor: '#10B981',
    position: 'absolute',
  },
  spinnerDot: {
    position: 'absolute',
    top: -1,
    left: '50%',
    marginLeft: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  truckCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#E6F7F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#A7F3D0',
  },
  truckEmoji: {
    fontSize: 34,
  },

  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
    paddingHorizontal: 12,
  },

  // Info carrier card
  infoCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  infoIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E6F7F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  infoLabel: {
    fontSize: 10,
    color: '#6B6B6B',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 2,
  },

  // Price breakdown card
  priceCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  priceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  priceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  priceHeaderIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  priceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  priceLabel: {
    fontSize: 13,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  priceSublabel: {
    fontSize: 11,
    color: '#6B6B6B',
    marginTop: 2,
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  priceDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
  additionalTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B6B6B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  loadingPriceText: {
    textAlign: 'center',
    color: '#6B6B6B',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
  },

  // Tips Card
  tipsCard: {
    width: '100%',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 24,
  },
  tipsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
    marginBottom: 4,
  },
  tipsText: {
    fontSize: 12,
    color: '#B45309',
    lineHeight: 18,
    fontWeight: '500',
  },

  // Cancel Button
  cancelBtn: {
    width: '100%',
    backgroundColor: '#E53935',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#E53935',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  cancelBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default WaitingScreen;
