import React, { useEffect, useState } from 'react';
import { Image, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchRequestDetails } from '../api';

type Props = {
  requestId: string;
  onBack: () => void;
};

const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'Pending', color: '#F59E0B', icon: '⏳' },
  matched: { label: 'Driver Assigned', color: '#059669', icon: '✅' },
  picked_up: { label: 'Picked Up', color: '#0369A1', icon: '📦' },
  on_the_way: { label: 'On the Way', color: '#1A56DB', icon: '🚛' },
  completed: { label: 'Delivered', color: '#059669', icon: '🎉' },
  cancelled: { label: 'Cancelled', color: '#DC2626', icon: '✕' },
};

const OrderDetailScreen = ({ requestId, onBack }: Props) => {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showBuilty, setShowBuilty] = useState(false);

  useEffect(() => {
    loadOrder();
  }, []);

  const loadOrder = async () => {
    setLoading(true);
    const res = await fetchRequestDetails(requestId);
    if (res.success) setOrder(res.request);
    setLoading(false);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading || !order) {
    return (
      <View style={s.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1A56DB" />
        <View style={s.header}>
          <TouchableOpacity onPress={onBack} style={s.backBtn}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Order Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#94A3B8', fontSize: 14 }}>Loading...</Text>
        </View>
      </View>
    );
  }

  const info = STATUS_MAP[order.status] || STATUS_MAP.pending;
  const progress = order.status === 'pending' ? 0 : order.status === 'matched' ? 25 : order.status === 'picked_up' ? 50 : order.status === 'on_the_way' ? 75 : 100;

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A56DB" />
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Order Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        {/* Status banner */}
        <View style={[s.statusBanner, { backgroundColor: info.color }]}>
          <Text style={s.statusIcon}>{info.icon}</Text>
          <Text style={s.statusLabel}>{info.label}</Text>
        </View>

        {/* Progress bar */}
        {order.status !== 'cancelled' && order.status !== 'pending' && (
          <View style={s.card}>
            <View style={s.progressBarBg}>
              <View style={[s.progressBarFill, { width: `${progress}%` }]} />
            </View>
            <View style={s.progressLabels}>
              <Text style={s.progressText}>Assigned</Text>
              <Text style={s.progressText}>Picked</Text>
              <Text style={s.progressText}>On Way</Text>
              <Text style={s.progressText}>Done</Text>
            </View>
          </View>
        )}

        {/* Order Info */}
        <View style={s.card}>
          <Text style={s.cardTitle}>📋 Order Info</Text>
          <View style={s.row}>
            <Text style={s.label}>Order ID</Text>
            <Text style={s.value}>GOZO-{order.id.slice(0, 7).toUpperCase()}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.row}>
            <Text style={s.label}>Date</Text>
            <Text style={s.value}>{formatDate(order.created_at)}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.row}>
            <Text style={s.label}>Goods</Text>
            <Text style={s.value}>{order.goods_type}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.row}>
            <Text style={s.label}>Weight</Text>
            <Text style={s.value}>{order.weight_kg} kg</Text>
          </View>
          {order.accepted_price && (
            <>
              <View style={s.divider} />
              <View style={s.row}>
                <Text style={s.label}>Price</Text>
                <Text style={[s.value, { color: '#059669', fontWeight: '800' }]}>₹{order.accepted_price}</Text>
              </View>
            </>
          )}
          {order.rating && (
            <>
              <View style={s.divider} />
              <View style={s.row}>
                <Text style={s.label}>Your Rating</Text>
                <Text style={s.value}>{'★'.repeat(order.rating)}{'☆'.repeat(5 - order.rating)}</Text>
              </View>
            </>
          )}
        </View>

        {/* Driver Info (if assigned) */}
        {order.driver_name && (
          <View style={s.card}>
            <Text style={s.cardTitle}>🚛 Driver Info</Text>
            <View style={s.driverRow}>
              <View style={s.driverAvatar}>
                <Text style={s.driverAvatarText}>{order.driver_name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={s.driverName}>{order.driver_name}</Text>
                {order.driver_phone && <Text style={s.driverPhone}>📞 {order.driver_phone}</Text>}
                {order.driver_vehicle && <Text style={s.driverVehicle}>🚛 {order.driver_vehicle}</Text>}
              </View>
            </View>
          </View>
        )}

        {/* Route */}
        <View style={s.card}>
          <Text style={s.cardTitle}>📍 Route</Text>
          <View style={s.routeSection}>
            <View style={s.routeDots}>
              <View style={s.greenDot} />
              <View style={s.routeLine} />
              <View style={s.redDot} />
            </View>
            <View style={{ flex: 1 }}>
              <View>
                <Text style={s.routeLabel}>Pickup</Text>
                <Text style={s.routeAddr}>{order.pickup_address}</Text>
              </View>
              <View style={{ marginTop: 16 }}>
                <Text style={s.routeLabel}>Drop-off</Text>
                <Text style={s.routeAddr}>{order.drop_address}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Builty */}
        {order.builty_image && (
          <View style={s.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={s.cardTitle}>📄 Builty Receipt</Text>
              <View style={s.verifiedBadge}><Text style={s.verifiedText}>✓ Verified</Text></View>
            </View>
            <TouchableOpacity onPress={() => setShowBuilty(true)} activeOpacity={0.8}>
              <Image
                source={{ uri: `data:image/jpeg;base64,${order.builty_image}` }}
                style={s.builtyThumb}
                resizeMode="cover"
              />
              <View style={s.builtyOverlay}>
                <Text style={s.builtyOverlayText}>Tap to view full size</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Fullscreen builty */}
      <Modal visible={showBuilty} transparent animationType="fade">
        <View style={s.fullscreenBg}>
          <TouchableOpacity style={s.fullscreenClose} onPress={() => setShowBuilty(false)}>
            <Text style={{ color: '#FFF', fontSize: 20 }}>✕</Text>
          </TouchableOpacity>
          {order.builty_image && (
            <Image source={{ uri: `data:image/jpeg;base64,${order.builty_image}` }} style={s.fullscreenImg} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 52,
    backgroundColor: '#1A56DB',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
  backArrow: { fontSize: 22, color: '#FFF' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#FFF', textAlign: 'center' },

  statusBanner: { borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 14, elevation: 3 },
  statusIcon: { fontSize: 36 },
  statusLabel: { color: '#FFF', fontSize: 20, fontWeight: '800', marginTop: 6 },

  card: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 18, marginBottom: 14,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  label: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  value: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  divider: { height: 1, backgroundColor: '#F1F5F9' },

  progressBarBg: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: 6, backgroundColor: '#1A56DB', borderRadius: 3 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  progressText: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },

  driverRow: { flexDirection: 'row', alignItems: 'center' },
  driverAvatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#1A56DB', justifyContent: 'center', alignItems: 'center' },
  driverAvatarText: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  driverName: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  driverPhone: { fontSize: 13, color: '#64748B', marginTop: 3 },
  driverVehicle: { fontSize: 13, color: '#64748B', marginTop: 2 },

  routeSection: { flexDirection: 'row' },
  routeDots: { alignItems: 'center', marginRight: 14, paddingTop: 4 },
  greenDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#BBF7D0' },
  redDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#EF4444', borderWidth: 2, borderColor: '#FECACA' },
  routeLine: { width: 2, height: 28, backgroundColor: '#E2E8F0', marginVertical: 4 },
  routeLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  routeAddr: { fontSize: 14, fontWeight: '600', color: '#0F172A', marginTop: 2 },

  verifiedBadge: { backgroundColor: '#ECFDF5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  verifiedText: { color: '#059669', fontSize: 12, fontWeight: '700' },
  builtyThumb: { width: '100%', height: 200, borderRadius: 12, backgroundColor: '#F1F5F9' },
  builtyOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', borderBottomLeftRadius: 12, borderBottomRightRadius: 12, paddingVertical: 8,
  },
  builtyOverlayText: { color: '#FFF', textAlign: 'center', fontSize: 13, fontWeight: '600' },
  fullscreenBg: { flex: 1, backgroundColor: '#000' },
  fullscreenClose: {
    position: 'absolute', top: 40, right: 16, zIndex: 10,
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  fullscreenImg: { flex: 1, width: '100%' },
});

export default OrderDetailScreen;
