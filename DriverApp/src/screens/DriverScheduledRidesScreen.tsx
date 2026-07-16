import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { fetchDriverScheduledRides } from '../api';

type ScheduledRide = {
  id: string;
  booking_id: string;
  goods_description?: string;
  pickup_location: string;
  drop_location: string;
  status: string;
  scheduled_time: string;
  accepted_price: number;
};

type Props = {
  transporterId: string;
  onBack: () => void;
  onSelectRide: (rideId: string) => void;
  t: any;
};

export const DriverScheduledRidesScreen = ({ transporterId, onBack, onSelectRide, t }: Props) => {
  const [rides, setRides] = useState<ScheduledRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  const loadRides = async () => {
    setLoading(true);
    const res = await fetchDriverScheduledRides(transporterId);
    if (res.success) {
      setRides(res.rides || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRides();
  }, [transporterId]);

  const upcomingRides = rides.filter(
    (r) => ['assigned', 'on_the_way', 'arrived', 'picked_up'].includes(r.status)
  );
  const pastRides = rides.filter(
    (r) => ['completed', 'delivered', 'cancelled'].includes(r.status)
  );

  const displayedRides = activeTab === 'upcoming' ? upcomingRides : pastRides;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }) + ' ' + d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'assigned':
        return { label: 'Assigned', color: '#1A56DB', bg: '#EFF6FF' };
      case 'on_the_way':
        return { label: 'En Route', color: '#F59E0B', bg: '#FEF3C7' };
      case 'arrived':
        return { label: 'At Pickup', color: '#7C3AED', bg: '#EDE9FE' };
      case 'picked_up':
        return { label: 'Picked Up', color: '#0369A1', bg: '#E0F2FE' };
      case 'completed':
      case 'delivered':
        return { label: 'Completed', color: '#059669', bg: '#D1FAE5' };
      case 'cancelled':
        return { label: 'Cancelled', color: '#EF4444', bg: '#FEE2E2' };
      default:
        return { label: status, color: '#64748B', bg: '#F1F5F9' };
    }
  };

  const getCountdown = (scheduledTimeStr: string) => {
    const scheduled = new Date(scheduledTimeStr).getTime();
    const now = new Date().getTime();
    const diff = scheduled - now;

    if (diff <= 0) {
      return 'Due Now';
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `Starts in ${days}d ${hours % 24}h`;
    }
    return `Starts in ${hours}h ${mins}m`;
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A56DB" />
      
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Assigned Tasks</Text>
        <TouchableOpacity onPress={loadRides} style={s.refreshBtn}>
          <Text style={{ fontSize: 18, color: '#FFF' }}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={s.tabsRow}>
        <TouchableOpacity
          style={[s.tab, activeTab === 'upcoming' && s.activeTab]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[s.tabText, activeTab === 'upcoming' && s.activeTabText]}>
            Upcoming ({upcomingRides.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, activeTab === 'past' && s.activeTab]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[s.tabText, activeTab === 'past' && s.activeTabText]}>
            Past ({pastRides.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color="#1A56DB" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scrollContainer} showsVerticalScrollIndicator={false}>
          {displayedRides.map((ride) => {
            const badge = getStatusBadge(ride.status);
            return (
              <TouchableOpacity
                key={ride.id}
                style={s.card}
                onPress={() => onSelectRide(ride.id)}
                activeOpacity={0.8}
              >
                <View style={s.cardHeader}>
                  <Text style={s.bookingId}>{ride.booking_id}</Text>
                  <View style={[s.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[s.badgeText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                </View>

                <View style={s.routeSection}>
                  <View style={s.routeDots}>
                    <View style={s.greenDot} />
                    <View style={s.routeLine} />
                    <View style={s.redDot} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.addressText} numberOfLines={1}>
                      {ride.pickup_location}
                    </Text>
                    <View style={{ height: 16 }} />
                    <Text style={s.addressText} numberOfLines={1}>
                      {ride.drop_location}
                    </Text>
                  </View>
                </View>

                {ride.goods_description ? (
                  <View style={s.goodsSection}>
                    <Text style={s.goodsLabel}>Goods:</Text>
                    <Text style={s.goodsText} numberOfLines={1}>
                      {ride.goods_description}
                    </Text>
                  </View>
                ) : null}

                <View style={s.cardFooter}>
                  <View>
                    <Text style={s.timeLabel}>Scheduled Time</Text>
                    <Text style={s.timeValue}>{formatDate(ride.scheduled_time)}</Text>
                  </View>
                  {ride.status === 'assigned' && (
                    <View style={s.countdownBadge}>
                      <Text style={s.countdownText}>{getCountdown(ride.scheduled_time)}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

          {displayedRides.length === 0 && (
            <View style={s.emptyState}>
              <Text style={{ fontSize: 54, marginBottom: 12 }}>📅</Text>
              <Text style={s.emptyTitle}>No Scheduled Rides</Text>
              <Text style={s.emptySub}>
                {activeTab === 'upcoming'
                  ? "Assigned scheduled tasks will appear here."
                  : "Your past scheduled history will appear here."}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
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
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#1A56DB',
  },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  activeTabText: { color: '#1A56DB', fontWeight: '700' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContainer: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  bookingId: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  routeSection: { flexDirection: 'row', marginBottom: 14 },
  routeDots: { alignItems: 'center', marginRight: 12, paddingTop: 4 },
  greenDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22C55E' },
  redDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444' },
  routeLine: { width: 2, height: 26, backgroundColor: '#E2E8F0', marginVertical: 3 },
  addressText: { fontSize: 14, color: '#334155', fontWeight: '500' },
  goodsSection: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  goodsLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', marginRight: 6 },
  goodsText: { fontSize: 12, color: '#334155', fontWeight: '500', flex: 1 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  timeLabel: { fontSize: 10, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
  timeValue: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginTop: 2 },
  countdownBadge: { backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  countdownText: { fontSize: 12, fontWeight: '700', color: '#1A56DB' },
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginTop: 12 },
  emptySub: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 6, lineHeight: 20 },
});
