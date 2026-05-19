import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchDriverHistory } from '../api';

type HistoryItem = {
  id: string;
  goods_type: string;
  weight_kg: number;
  pickup_address: string;
  drop_address: string;
  status: string;
  accepted_price: number;
  created_at: string;
  rating?: number;
  builty_image?: string;
  driver_name?: string;
};

type Props = {
  transporterId: string;
  onBack: () => void;
};

const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  matched: { label: 'Assigned', color: '#F59E0B', icon: '🔄' },
  picked_up: { label: 'Picked Up', color: '#0369A1', icon: '📦' },
  on_the_way: { label: 'On the Way', color: '#1A56DB', icon: '🚛' },
  completed: { label: 'Delivered', color: '#059669', icon: '✅' },
};

const DriverHistoryScreen = ({ transporterId, onBack }: Props) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [showBuilty, setShowBuilty] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    const res = await fetchDriverHistory(transporterId);
    if (res.success) setHistory(res.requests);
    setLoading(false);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const totalEarnings = history
    .filter(h => h.status === 'completed')
    .reduce((sum, h) => sum + (h.accepted_price || 0), 0);

  // Detail view
  if (selectedItem) {
    const info = STATUS_MAP[selectedItem.status] || STATUS_MAP.completed;
    return (
      <View style={s.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1A56DB" />
        <View style={s.header}>
          <TouchableOpacity onPress={() => setSelectedItem(null)} style={s.backBtn}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Trip Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
          {/* Status banner */}
          <View style={[s.statusBanner, { backgroundColor: info.color }]}>
            <Text style={s.statusBannerIcon}>{info.icon}</Text>
            <Text style={s.statusBannerLabel}>{info.label}</Text>
          </View>

          {/* Trip ID & Date */}
          <View style={s.detailCard}>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Trip ID</Text>
              <Text style={s.detailValue}>GOZO-{selectedItem.id.slice(0, 7).toUpperCase()}</Text>
            </View>
            <View style={s.detailDivider} />
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Date</Text>
              <Text style={s.detailValue}>{formatDate(selectedItem.created_at)}</Text>
            </View>
            <View style={s.detailDivider} />
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Earnings</Text>
              <Text style={[s.detailValue, { color: '#059669', fontWeight: '800' }]}>₹{selectedItem.accepted_price}</Text>
            </View>
          </View>

          {/* Goods info */}
          <View style={s.detailCard}>
            <Text style={s.cardTitle}>Shipment Info</Text>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Goods</Text>
              <Text style={s.detailValue}>{selectedItem.goods_type}</Text>
            </View>
            <View style={s.detailDivider} />
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Weight</Text>
              <Text style={s.detailValue}>{selectedItem.weight_kg} kg</Text>
            </View>
            {selectedItem.rating && (
              <>
                <View style={s.detailDivider} />
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Rating</Text>
                  <Text style={s.detailValue}>{'★'.repeat(selectedItem.rating)}{'☆'.repeat(5 - selectedItem.rating)}</Text>
                </View>
              </>
            )}
          </View>

          {/* Route */}
          <View style={s.detailCard}>
            <Text style={s.cardTitle}>Route</Text>
            <View style={s.routeSection}>
              <View style={s.routeDots}>
                <View style={s.greenDot} />
                <View style={s.routeLine} />
                <View style={s.redDot} />
              </View>
              <View style={{ flex: 1 }}>
                <View>
                  <Text style={s.routeLabel}>Pickup</Text>
                  <Text style={s.routeAddr}>{selectedItem.pickup_address}</Text>
                </View>
                <View style={{ marginTop: 16 }}>
                  <Text style={s.routeLabel}>Drop-off</Text>
                  <Text style={s.routeAddr}>{selectedItem.drop_address}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Builty */}
          {selectedItem.builty_image && (
            <View style={s.detailCard}>
              <Text style={s.cardTitle}>📄 Builty Receipt</Text>
              <TouchableOpacity onPress={() => setShowBuilty(true)} activeOpacity={0.8}>
                <Image
                  source={{ uri: `data:image/jpeg;base64,${selectedItem.builty_image}` }}
                  style={s.builtyThumb}
                  resizeMode="cover"
                />
                <View style={s.builtyOverlay}>
                  <Text style={s.builtyOverlayText}>Tap to view</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Full-screen builty */}
        <Modal visible={showBuilty} transparent animationType="fade">
          <View style={s.fullscreenBg}>
            <TouchableOpacity style={s.fullscreenClose} onPress={() => setShowBuilty(false)}>
              <Text style={{ color: '#FFF', fontSize: 20 }}>✕</Text>
            </TouchableOpacity>
            {selectedItem.builty_image && (
              <Image source={{ uri: `data:image/jpeg;base64,${selectedItem.builty_image}` }} style={s.fullscreenImg} resizeMode="contain" />
            )}
          </View>
        </Modal>
      </View>
    );
  }

  // List view
  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A56DB" />
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Trip History</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Stats Banner */}
      <View style={s.statsBanner}>
        <View style={s.statCol}>
          <Text style={s.statNum}>{history.filter(h => h.status === 'completed').length}</Text>
          <Text style={s.statLbl}>Completed</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statCol}>
          <Text style={s.statNum}>₹{totalEarnings}</Text>
          <Text style={s.statLbl}>Total Earned</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statCol}>
          <Text style={s.statNum}>{history.length}</Text>
          <Text style={s.statLbl}>Total Trips</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#1A56DB" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
          {history.map((item) => {
            const info = STATUS_MAP[item.status] || STATUS_MAP.completed;
            return (
              <TouchableOpacity key={item.id} style={s.histCard} onPress={() => setSelectedItem(item)} activeOpacity={0.7}>
                <View style={s.histCardAccent} />
                <View style={s.histCardBody}>
                  <View style={s.histTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.histId}>GOZO-{item.id.slice(0, 7).toUpperCase()}</Text>
                      <Text style={s.histGoods}>{item.goods_type}</Text>
                    </View>
                    <View style={[s.histStatusBadge, { backgroundColor: info.color + '18' }]}>
                      <Text style={[s.histStatusText, { color: info.color }]}>{info.icon} {info.label}</Text>
                    </View>
                  </View>
                  <View style={s.histRouteRow}>
                    <View style={s.histRouteDot} />
                    <Text style={s.histRouteText} numberOfLines={1}>{item.pickup_address}</Text>
                  </View>
                  <View style={s.histRouteMiniLine} />
                  <View style={s.histRouteRow}>
                    <View style={[s.histRouteDot, { backgroundColor: '#EF4444' }]} />
                    <Text style={s.histRouteText} numberOfLines={1}>{item.drop_address}</Text>
                  </View>
                  <View style={s.histFooter}>
                    <Text style={s.histDate}>{formatDate(item.created_at)}</Text>
                    <Text style={s.histPrice}>₹{item.accepted_price}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
          {history.length === 0 && (
            <View style={s.emptyState}>
              <Text style={{ fontSize: 48 }}>📭</Text>
              <Text style={s.emptyTitle}>No trips yet</Text>
              <Text style={s.emptySub}>Your completed trips will appear here</Text>
            </View>
          )}
        </ScrollView>
      )}
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

  // Stats
  statsBanner: {
    flexDirection: 'row', backgroundColor: '#0F3D91', marginHorizontal: 16, marginTop: 14,
    borderRadius: 16, padding: 18, justifyContent: 'space-between',
    elevation: 4, shadowColor: '#1A56DB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8,
  },
  statCol: { alignItems: 'center', flex: 1 },
  statNum: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  statLbl: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '600', marginTop: 3 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)' },

  // History card
  histCard: {
    flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, marginBottom: 12,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4,
    overflow: 'hidden', borderWidth: 1, borderColor: '#F1F5F9',
  },
  histCardAccent: { width: 4, backgroundColor: '#1A56DB' },
  histCardBody: { flex: 1, padding: 16 },
  histTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  histId: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  histGoods: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginTop: 2 },
  histStatusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  histStatusText: { fontSize: 12, fontWeight: '700' },
  histRouteRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  histRouteDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E', marginRight: 10 },
  histRouteText: { fontSize: 13, color: '#475569', fontWeight: '500', flex: 1 },
  histRouteMiniLine: { width: 2, height: 10, backgroundColor: '#E2E8F0', marginLeft: 3 },
  histFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10,
  },
  histDate: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  histPrice: { fontSize: 18, fontWeight: '800', color: '#059669' },

  // Detail screen
  statusBanner: { borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 14, elevation: 3 },
  statusBannerIcon: { fontSize: 36 },
  statusBannerLabel: { color: '#FFF', fontSize: 20, fontWeight: '800', marginTop: 6 },
  detailCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 18, marginBottom: 14,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 14 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  detailLabel: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  detailValue: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  detailDivider: { height: 1, backgroundColor: '#F1F5F9' },
  routeSection: { flexDirection: 'row' },
  routeDots: { alignItems: 'center', marginRight: 14, paddingTop: 4 },
  greenDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#BBF7D0' },
  redDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#EF4444', borderWidth: 2, borderColor: '#FECACA' },
  routeLine: { width: 2, height: 28, backgroundColor: '#E2E8F0', marginVertical: 4 },
  routeLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  routeAddr: { fontSize: 14, fontWeight: '600', color: '#0F172A', marginTop: 2 },
  builtyThumb: { width: '100%', height: 180, borderRadius: 12, backgroundColor: '#F1F5F9' },
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
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#334155', marginTop: 12 },
  emptySub: { fontSize: 14, color: '#94A3B8', marginTop: 4 },
});

export default DriverHistoryScreen;
