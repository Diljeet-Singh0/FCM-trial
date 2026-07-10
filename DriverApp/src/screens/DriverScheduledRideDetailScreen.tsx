import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import {
  fetchScheduledRideDetail,
  startScheduledRide,
  cancelScheduledRide,
  updateScheduledRideStatus
} from '../api';

type ScheduledRideDetail = {
  id: string;
  booking_id: string;
  pickup_location: string;
  drop_location: string;
  scheduled_time: string;
  status: 'pending' | 'assigned' | 'started' | 'on_the_way' | 'arrived' | 'picked_up' | 'delivered' | 'cancelled';
  goods_description?: string;
  accepted_price: number;
  driver_id?: string;
  user_id: string;
};

type Props = {
  rideId: string;
  transporterId: string;
  onBack: () => void;
  onRideStarted: () => void;
  t: any;
};

export const DriverScheduledRideDetailScreen = ({ rideId, transporterId, onBack, onRideStarted, t }: Props) => {
  const [ride, setRide] = useState<ScheduledRideDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  const loadDetail = async () => {
    setLoading(true);
    const res = await fetchScheduledRideDetail(rideId);
    if (res.success && res.ride) {
      setRide(res.ride);
    } else {
      Alert.alert('Error', res.error || 'Could not fetch ride details.');
      onBack();
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDetail();
  }, [rideId]);

  useEffect(() => {
    if (!ride || ride.status !== 'assigned') return;

    const timer = setInterval(() => {
      const scheduled = new Date(ride.scheduled_time).getTime();
      const now = new Date().getTime();
      const diff = scheduled - now;

      if (diff <= 0) {
        setTimeRemaining('Due Now');
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeRemaining(`${hours}h ${mins}m`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [ride]);

  const handleStartRide = async () => {
    if (!ride) return;

    // Validation: 2 hours from now
    const now = new Date().getTime();
    const scheduled = new Date(ride.scheduled_time).getTime();
    const diffHours = (scheduled - now) / (1000 * 60 * 60);

    if (diffHours > 2) {
      Alert.alert(
        'Too Early',
        'You can only start this ride up to 2 hours before the scheduled time.'
      );
      return;
    }

    setActionLoading(true);
    const res = await startScheduledRide(ride.id, transporterId);
    setActionLoading(false);

    if (res.success) {
      Alert.alert('Trip Started 🚛', 'Head to the pickup location.', [
        {
          text: 'OK',
          onPress: () => {
            onRideStarted();
          }
        }
      ]);
    } else {
      Alert.alert('Error', res.error || 'Could not start ride');
    }
  };

  const handleCancelAssignment = () => {
    if (!ride) return;

    const now = new Date().getTime();
    const scheduled = new Date(ride.scheduled_time).getTime();
    const diffHours = (scheduled - now) / (1000 * 60 * 60);

    if (diffHours < 4) {
      Alert.alert(
        'Cancellation Blocked',
        'Drivers are not allowed to cancel assignments less than 4 hours before the scheduled time. Please contact support.'
      );
      return;
    }

    Alert.alert(
      'Cancel Assignment',
      'Are you sure you want to cancel your assignment to this ride?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const res = await cancelScheduledRide(ride.id, 'driver', 'Driver self-cancelled');
            setActionLoading(false);
            if (res.success) {
              Alert.alert('Cancelled', 'Assignment cancelled successfully.', [
                { text: 'OK', onPress: onBack }
              ]);
            } else {
              Alert.alert('Error', res.error || 'Failed to cancel assignment.');
            }
          }
        }
      ]
    );
  };

  const handleUpdateStatus = async (newStatus: 'arrived' | 'picked_up' | 'delivered') => {
    if (!ride) return;

    setActionLoading(true);
    const res = await updateScheduledRideStatus(ride.id, transporterId, newStatus);
    setActionLoading(false);

    if (res.success) {
      Alert.alert(
        'Status Updated',
        `Ride status updated to: ${newStatus.replace('_', ' ').toUpperCase()}`
      );
      loadDetail();
    } else {
      Alert.alert('Error', res.error || 'Failed to update status.');
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }) + ' at ' + d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned': return '#1A56DB';
      case 'on_the_way': return '#2563EB';
      case 'arrived': return '#F59E0B';
      case 'picked_up': return '#0369A1';
      case 'delivered': return '#059669';
      case 'cancelled': return '#EF4444';
      default: return '#64748B';
    }
  };

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color="#1A56DB" />
      </View>
    );
  }

  if (!ride) return null;

  const now = new Date().getTime();
  const scheduled = new Date(ride.scheduled_time).getTime();
  const diffHours = (scheduled - now) / (1000 * 60 * 60);
  const canCancel = ride.status === 'assigned' && diffHours >= 4;

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A56DB" />
      
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Ride Detail</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Status banner */}
        <View style={[s.statusBanner, { backgroundColor: getStatusColor(ride.status) }]}>
          <Text style={s.statusBannerText}>{ride.status.toUpperCase().replace('_', ' ')}</Text>
        </View>

        {/* Booking ID and Fare */}
        <View style={s.card}>
          <View style={s.infoRow}>
            <View>
              <Text style={s.label}>Booking ID</Text>
              <Text style={s.value}>{ride.booking_id}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.label}>Driver Cut</Text>
              <Text style={[s.value, { color: '#059669', fontWeight: '800' }]}>₹{ride.accepted_price}</Text>
            </View>
          </View>
        </View>

        {/* Scheduled time & countdown */}
        <View style={s.card}>
          <Text style={s.label}>Scheduled Time</Text>
          <Text style={s.dateTimeValue}>{formatDate(ride.scheduled_time)}</Text>
          {ride.status === 'assigned' && (
            <View style={s.countdownWrapper}>
              <Text style={s.countdownLabel}>Time Remaining: </Text>
              <Text style={s.countdownValue}>{timeRemaining || 'Calculating...'}</Text>
            </View>
          )}
        </View>

        {/* Route Details */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Route</Text>
          <View style={s.routeSection}>
            <View style={s.routeDots}>
              <View style={s.greenDot} />
              <View style={s.routeLine} />
              <View style={s.redDot} />
            </View>
            <View style={{ flex: 1 }}>
              <View>
                <Text style={s.routeLabel}>Pickup Location</Text>
                <Text style={s.routeAddress}>{ride.pickup_location}</Text>
              </View>
              <View style={{ height: 20 }} />
              <View>
                <Text style={s.routeLabel}>Drop-off Location</Text>
                <Text style={s.routeAddress}>{ride.drop_location}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Goods Description */}
        {ride.goods_description && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Goods Description</Text>
            <Text style={s.goodsDescription}>{ride.goods_description}</Text>
          </View>
        )}

        {/* Actions Section */}
        <View style={{ marginTop: 10 }}>
          {actionLoading ? (
            <ActivityIndicator size="large" color="#1A56DB" />
          ) : (
            <>
              {ride.status === 'assigned' && (
                <>
                  <TouchableOpacity
                    style={[s.primaryBtn, diffHours > 2 && s.disabledBtn]}
                    onPress={handleStartRide}
                    disabled={diffHours > 2}
                  >
                    <Text style={s.primaryBtnText}>Start Ride</Text>
                  </TouchableOpacity>
                  {diffHours > 2 && (
                    <Text style={s.earlyHint}>
                      Starts working 2 hours before the scheduled time.
                    </Text>
                  )}
                  
                  <TouchableOpacity
                    style={[s.cancelBtn, !canCancel && s.disabledCancelBtn]}
                    onPress={handleCancelAssignment}
                    disabled={!canCancel}
                  >
                    <Text style={[s.cancelBtnText, !canCancel && { color: '#94A3B8' }]}>
                      Cancel Assignment
                    </Text>
                  </TouchableOpacity>
                  {!canCancel && (
                    <Text style={s.cancelHint}>
                      Assignment locked. Cancellations are blocked within 4 hours of the scheduled time.
                    </Text>
                  )}
                </>
              )}

              {ride.status === 'on_the_way' && (
                <TouchableOpacity
                  style={s.primaryBtn}
                  onPress={() => handleUpdateStatus('arrived')}
                >
                  <Text style={s.primaryBtnText}>Arrived at Pickup</Text>
                </TouchableOpacity>
              )}

              {ride.status === 'arrived' && (
                <TouchableOpacity
                  style={s.primaryBtn}
                  onPress={() => handleUpdateStatus('picked_up')}
                >
                  <Text style={s.primaryBtnText}>Goods Loaded & Started</Text>
                </TouchableOpacity>
              )}

              {ride.status === 'picked_up' && (
                <TouchableOpacity
                  style={[s.primaryBtn, { backgroundColor: '#059669' }]}
                  onPress={() => handleUpdateStatus('delivered')}
                >
                  <Text style={s.primaryBtnText}>Delivered</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 56,
    backgroundColor: '#1A56DB',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: { fontSize: 20, color: '#FFFFFF', fontWeight: '700' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  scrollContainer: { padding: 16, paddingBottom: 40 },
  statusBanner: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBannerText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginTop: 4 },
  dateTimeValue: { fontSize: 15, fontWeight: '750', color: '#0F172A', marginTop: 4 },
  countdownWrapper: { flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: '#EFF6FF', padding: 10, borderRadius: 8 },
  countdownLabel: { fontSize: 12, fontWeight: '600', color: '#1A56DB' },
  countdownValue: { fontSize: 14, fontWeight: '800', color: '#1A56DB' },
  routeSection: { flexDirection: 'row' },
  routeDots: { alignItems: 'center', marginRight: 14, paddingTop: 4 },
  greenDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#BBF7D0' },
  redDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#EF4444', borderWidth: 2, borderColor: '#FECACA' },
  routeLine: { width: 2, height: 38, backgroundColor: '#E2E8F0', marginVertical: 4 },
  routeLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  routeAddress: { fontSize: 14, fontWeight: '600', color: '#0F172A', marginTop: 2 },
  goodsDescription: { fontSize: 14, color: '#334155', fontWeight: '500', lineHeight: 20 },
  primaryBtn: {
    backgroundColor: '#1A56DB',
    borderRadius: 28,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#1A56DB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  disabledBtn: { backgroundColor: '#CBD5E1', shadowOpacity: 0 },
  earlyHint: { fontSize: 12, color: '#64748B', textAlign: 'center', marginBottom: 16, paddingHorizontal: 12 },
  cancelBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 28,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: { color: '#EF4444', fontSize: 16, fontWeight: '850' },
  disabledCancelBtn: { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  cancelHint: { fontSize: 11, color: '#EF4444', fontWeight: '600', textAlign: 'center', marginTop: 8, paddingHorizontal: 12, lineHeight: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});
