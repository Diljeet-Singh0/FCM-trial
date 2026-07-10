import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { fetchUserScheduledRides } from '../api';

type Props = {
  userId: string;
  onBack: () => void;
  onSelectRide: (rideId: string) => void;
};

const TAB_UPCOMING = 'upcoming';
const TAB_PAST = 'past';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '⏳ Awaiting Driver', color: '#D97706', bg: '#FEF3C7' },
  assigned: { label: '✅ Driver Assigned', color: '#16A34A', bg: '#DCFCE7' },
  on_the_way: { label: '🚛 Driver on Way', color: '#2563EB', bg: '#DBEAFE' },
  arrived: { label: '📍 Driver Arrived', color: '#7C3AED', bg: '#F3E8FF' },
  picked_up: { label: '📦 Goods Picked Up', color: '#0D9488', bg: '#CCFBF1' },
  completed: { label: '🎉 Delivered', color: '#16A34A', bg: '#DCFCE7' },
  cancelled: { label: '✕ Cancelled', color: '#DC2626', bg: '#FEE2E2' }
};

export const ScheduledRidesScreen = ({ userId, onBack, onSelectRide }: Props) => {
  const [activeTab, setActiveTab] = useState<typeof TAB_UPCOMING | typeof TAB_PAST>(TAB_UPCOMING);
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadRides();
  }, []);

  const loadRides = async () => {
    setLoading(true);
    const res = await fetchUserScheduledRides(userId);
    if (res.success) {
      setRides(res.rides);
    }
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    const res = await fetchUserScheduledRides(userId);
    if (res.success) {
      setRides(res.rides);
    }
    setRefreshing(false);
  };

  const filterRides = () => {
    const pastStatuses = ['completed', 'cancelled'];
    return rides.filter((r) => {
      const isPast = pastStatuses.includes(r.status);
      return activeTab === TAB_UPCOMING ? !isPast : isPast;
    });
  };

  const formatScheduledTime = (isoString: string) => {
    const date = new Date(isoString);
    const dateStr = date.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
    const timeStr = date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
    return `${dateStr} at ${timeStr}`;
  };

  const renderRideItem = ({ item }: { item: any }) => {
    const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => onSelectRide(item.id)}
        activeOpacity={0.85}
      >
        <View style={s.cardHeader}>
          <Text style={s.bookingId}>{item.booking_id}</Text>
          <View style={[s.badge, { backgroundColor: config.bg }]}>
            <Text style={[s.badgeText, { color: config.color }]}>{config.label}</Text>
          </View>
        </View>

        <Text style={s.scheduledTime}>📅 {formatScheduledTime(item.scheduled_time)}</Text>

        <View style={s.divider} />

        <View style={s.routeContainer}>
          <View style={s.routeVisual}>
            <View style={s.greenDot} />
            <View style={s.routeLine} />
            <View style={s.redDot} />
          </View>
          <View style={s.routeTextWrap}>
            <Text style={s.routeLabel}>PICKUP</Text>
            <Text style={s.addressText} numberOfLines={1}>{item.pickup_location}</Text>
            <View style={{ height: 12 }} />
            <Text style={s.routeLabel}>DROP-OFF</Text>
            <Text style={s.addressText} numberOfLines={1}>{item.drop_location}</Text>
          </View>
        </View>

        {item.goods_description && (
          <Text style={s.goodsDesc} numberOfLines={1}>
            📦 {item.goods_description}
          </Text>
        )}

        {item.company && (
          <View style={s.companyRow}>
            <Text style={s.companyLabel}>🏢</Text>
            <Text style={s.companyText}>{item.company.name}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Scheduled Rides</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={s.tabsContainer}>
        <TouchableOpacity
          style={[s.tab, activeTab === TAB_UPCOMING && s.activeTab]}
          onPress={() => setActiveTab(TAB_UPCOMING)}
        >
          <Text style={[s.tabText, activeTab === TAB_UPCOMING && s.activeTabText]}>Upcoming</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, activeTab === TAB_PAST && s.activeTab]}
          onPress={() => setActiveTab(TAB_PAST)}
        >
          <Text style={[s.tabText, activeTab === TAB_PAST && s.activeTabText]}>Past & Cancelled</Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={s.loader}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      ) : (
        <FlatList
          data={filterRides()}
          keyExtractor={(item) => item.id}
          renderItem={renderRideItem}
          contentContainerStyle={s.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#10B981']} />
          }
          ListEmptyComponent={
            <View style={s.emptyContainer}>
              <Text style={s.emptyIcon}>📅</Text>
              <Text style={s.emptyTitle}>No Scheduled Rides</Text>
              <Text style={s.emptyDesc}>
                {activeTab === TAB_UPCOMING
                  ? "You don't have any upcoming rides scheduled."
                  : "You don't have any past scheduled rides."}
              </Text>
            </View>
          }
        />
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
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#10B981' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  activeTabText: { color: '#10B981', fontWeight: '700' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContainer: { padding: 16, paddingBottom: 30 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  bookingId: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  scheduledTime: { fontSize: 13, fontWeight: '600', color: '#0F172A', marginBottom: 12 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 12 },
  routeContainer: { flexDirection: 'row', alignItems: 'center' },
  routeVisual: { alignItems: 'center', marginRight: 12 },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  routeLine: { width: 1, height: 24, backgroundColor: '#CBD5E1', marginVertical: 2 },
  routeTextWrap: { flex: 1 },
  routeLabel: { fontSize: 8, fontWeight: '700', color: '#64748B', letterSpacing: 0.5 },
  addressText: { fontSize: 13, fontWeight: '600', color: '#334155', marginTop: 2 },
  goodsDesc: { fontSize: 12, color: '#64748B', marginTop: 12, fontWeight: '500' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: '#64748B', textAlign: 'center', paddingHorizontal: 40 },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: '#F0FDF4',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  companyLabel: { fontSize: 14 },
  companyText: { fontSize: 12, fontWeight: '600', color: '#059669' },
});
