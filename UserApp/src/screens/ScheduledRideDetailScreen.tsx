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
import { fetchScheduledRideDetail, cancelScheduledRide } from '../api';

type Props = {
  rideId: string;
  onBack: () => void;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending: { label: 'Awaiting Driver Assignment', color: '#D97706', bg: '#FEF3C7', icon: '⏳' },
  assigned: { label: 'Driver Confirmed', color: '#16A34A', bg: '#DCFCE7', icon: '✅' },
  on_the_way: { label: 'Driver Heading to Pickup', color: '#2563EB', bg: '#DBEAFE', icon: '🚛' },
  arrived: { label: 'Driver at Location', color: '#7C3AED', bg: '#F3E8FF', icon: '📍' },
  picked_up: { label: 'Goods Loaded & En Route', color: '#0D9488', bg: '#CCFBF1', icon: '📦' },
  completed: { label: 'Delivered Successfully', color: '#16A34A', bg: '#DCFCE7', icon: '🎉' },
  cancelled: { label: 'Cancelled', color: '#DC2626', bg: '#FEE2E2', icon: '✕' }
};

export const ScheduledRideDetailScreen = ({ rideId, onBack }: Props) => {
  const [ride, setRide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadRideDetail();
  }, []);

  const loadRideDetail = async () => {
    setLoading(true);
    const res = await fetchScheduledRideDetail(rideId);
    if (res.success) {
      setRide(res.ride);
    } else {
      Alert.alert('Error', res.error || 'Failed to fetch ride details');
    }
    setLoading(false);
  };

  const handleCancelRide = () => {
    Alert.alert(
      'Cancel Scheduled Ride?',
      'Are you sure you want to cancel this scheduled ride? This action cannot be undone.',
      [
        { text: 'Keep Ride', style: 'cancel' },
        {
          text: 'Cancel Ride',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            const res = await cancelScheduledRide(rideId, 'user');
            setCancelling(false);
            if (res.success) {
              Alert.alert('Cancelled', 'Your scheduled ride has been cancelled.', [
                { text: 'OK', onPress: onBack }
              ]);
            } else {
              Alert.alert('Error', res.error || 'Could not cancel ride.');
            }
          }
        }
      ]
    );
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    const dateStr = date.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    const timeStr = date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
    return `${dateStr} at ${timeStr}`;
  };

  if (loading || !ride) {
    return (
      <View style={s.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={s.header}>
          <TouchableOpacity onPress={onBack} style={s.backBtn}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Ride Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.loader}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      </View>
    );
  }

  const statusInfo = STATUS_CONFIG[ride.status] || STATUS_CONFIG.pending;
  const isCancellable = ['pending', 'assigned'].includes(ride.status);

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Ride Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Status Banner */}
        <View style={[s.statusBanner, { backgroundColor: statusInfo.bg }]}>
          <Text style={s.statusIcon}>{statusInfo.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.statusLabel, { color: statusInfo.color }]}>{statusInfo.label}</Text>
            <Text style={s.bookingIdText}>{ride.booking_id}</Text>
          </View>
        </View>

        {/* Route Details Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>📍 Route Info</Text>
          <View style={s.routeContainer}>
            <View style={s.routeVisual}>
              <View style={s.greenDot} />
              <View style={s.routeLine} />
              <View style={s.redDot} />
            </View>
            <View style={s.routeTextWrap}>
              <Text style={s.routeLabel}>PICKUP LOCATION</Text>
              <Text style={s.addressText}>{ride.pickup_location}</Text>
              <View style={{ height: 16 }} />
              <Text style={s.routeLabel}>DROP-OFF LOCATION</Text>
              <Text style={s.addressText}>{ride.drop_location}</Text>
            </View>
          </View>
        </View>

        {/* Schedule Info Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>📅 Schedule Info</Text>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Scheduled For</Text>
            <Text style={s.infoValue}>{formatDateTime(ride.scheduled_time)}</Text>
          </View>
          {ride.goods_description && (
            <>
              <View style={s.divider} />
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Goods Description</Text>
                <Text style={s.infoValue}>{ride.goods_description}</Text>
              </View>
            </>
          )}
        </View>

        {/* Driver Info Card (if assigned) */}
        {ride.driver && (
          <View style={s.card}>
            <Text style={s.cardTitle}>🚛 Driver & Vehicle Details</Text>
            <View style={s.driverRow}>
              <View style={s.driverAvatar}>
                <Text style={s.driverAvatarText}>{ride.driver.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.driverName}>{ride.driver.name}</Text>
                <Text style={s.driverPhone}>📞 {ride.driver.phone}</Text>
                {ride.driver.vehicle_number && (
                  <View style={s.vehicleBadge}>
                    <Text style={s.vehicleText}>🚛 {ride.driver.vehicle_number}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Cancellation Reason (if cancelled) */}
        {ride.status === 'cancelled' && (ride.cancelled_by || ride.cancellation_reason) && (
          <View style={[s.card, { borderColor: '#FECACA', backgroundColor: '#FFF5F5' }]}>
            <Text style={[s.cardTitle, { color: '#DC2626' }]}>❌ Cancellation Details</Text>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Cancelled By</Text>
              <Text style={[s.infoValue, { textTransform: 'capitalize' }]}>{ride.cancelled_by}</Text>
            </View>
            {ride.cancellation_reason && (
              <>
                <View style={[s.divider, { backgroundColor: '#FEE2E2' }]} />
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Reason</Text>
                  <Text style={s.infoValue}>{ride.cancellation_reason}</Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* Cancel Button */}
        {isCancellable && (
          <TouchableOpacity
            style={s.cancelBtn}
            onPress={handleCancelRide}
            disabled={cancelling}
            activeOpacity={0.85}
          >
            {cancelling ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <Text style={s.cancelBtnText}>Cancel Scheduled Ride</Text>
            )}
          </TouchableOpacity>
        )}
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  backArrow: { fontSize: 20, color: '#0F172A', fontWeight: '700' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#0F172A', textAlign: 'center' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContainer: { padding: 16, paddingBottom: 40 },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  statusIcon: { fontSize: 32, marginRight: 12 },
  statusLabel: { fontSize: 16, fontWeight: '800' },
  bookingIdText: { fontSize: 13, fontWeight: '700', color: '#64748B', marginTop: 2 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#64748B', letterSpacing: 0.5, marginBottom: 14, textTransform: 'uppercase' },
  routeContainer: { flexDirection: 'row' },
  routeVisual: { alignItems: 'center', marginRight: 12, paddingTop: 4 },
  greenDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#A7F3D0' },
  redDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444', borderWidth: 2, borderColor: '#FEE2E2' },
  routeLine: { width: 2, height: 50, backgroundColor: '#E2E8F0', marginVertical: 4 },
  routeTextWrap: { flex: 1 },
  routeLabel: { fontSize: 9, fontWeight: '800', color: '#64748B', letterSpacing: 0.5, marginBottom: 2 },
  addressText: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  infoRow: { paddingVertical: 4 },
  infoLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#0F172A', marginTop: 4 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
  driverRow: { flexDirection: 'row', alignItems: 'center' },
  driverAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' },
  driverAvatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  driverName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  driverPhone: { fontSize: 13, color: '#64748B', marginTop: 2 },
  vehicleBadge: { backgroundColor: '#F1F5F9', alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginTop: 6 },
  vehicleText: { fontSize: 11, color: '#334155', fontWeight: '700' },
  cancelBtn: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 28,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  cancelBtnText: { color: '#DC2626', fontSize: 14, fontWeight: '800' }
});
