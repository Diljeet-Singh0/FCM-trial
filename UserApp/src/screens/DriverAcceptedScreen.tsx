import React, { useEffect, useState, useRef } from 'react';
import { Animated, Image, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchRequestDetails } from '../api';

type Props = {
  requestId: string;
  driverName: string;
  driverPhone: string;
  driverVehicle: string;
  priceInr: string;
  onBack: () => void;
  onTripCompleted: (requestId: string) => void;
  onTrackDriver: () => void;
};

const STATUS_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  matched: { label: 'Driver Assigned', icon: '✅', color: '#16A34A' },
  picked_up: { label: 'Goods Picked Up', icon: '📦', color: '#0369A1' },
  on_the_way: { label: 'On the Way', icon: '🚛', color: '#1A56DB' },
  completed: { label: 'Delivered!', icon: '🎉', color: '#16A34A' },
};

const DriverAcceptedScreen = ({ requestId, driverName, driverPhone, driverVehicle, priceInr, onBack, onTripCompleted, onTrackDriver }: Props) => {
  const [tripStatus, setTripStatus] = useState('matched');
  const [builtyImage, setBuiltyImage] = useState<string | null>(null);
  const [showBuiltyFullscreen, setShowBuiltyFullscreen] = useState(false);
  const checkAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(checkAnim, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  }, []);

  // Poll for status updates every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetchRequestDetails(requestId);
      if (res.success && res.request) {
        setTripStatus(res.request.status);
        if (res.request.builty_image) {
          setBuiltyImage(res.request.builty_image);
        }
        if (res.request.status === 'completed') {
          clearInterval(interval);
          setTimeout(() => onTripCompleted(requestId), 2000);
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [requestId]);

  const callDriver = () => {
    if (driverPhone) Linking.openURL(`tel:${driverPhone}`);
  };

  const statusInfo = STATUS_LABELS[tripStatus] || STATUS_LABELS.matched;
  const progress = tripStatus === 'matched' ? 25 : tripStatus === 'picked_up' ? 50 : tripStatus === 'on_the_way' ? 75 : 100;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Trip Status</Text>
        <View style={s.liveBadge}><Text style={s.liveText}>LIVE</Text></View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
        {/* Status Banner */}
        <Animated.View style={[s.statusBanner, { backgroundColor: statusInfo.color, transform: [{ scale: checkAnim }] }]}>
          <Text style={s.statusIcon}>{statusInfo.icon}</Text>
          <Text style={s.statusLabel}>{statusInfo.label}</Text>
        </Animated.View>

        {/* Progress Bar */}
        <View style={s.progressCard}>
          <View style={s.progressBarBg}>
            <View style={[s.progressBarFill, { width: `${progress}%` }]} />
          </View>
          <View style={s.progressLabels}>
            <Text style={[s.progressDot, tripStatus !== 'pending' && s.progressDotActive]}>●</Text>
            <Text style={[s.progressDot, ['picked_up', 'on_the_way', 'completed'].includes(tripStatus) && s.progressDotActive]}>●</Text>
            <Text style={[s.progressDot, ['on_the_way', 'completed'].includes(tripStatus) && s.progressDotActive]}>●</Text>
            <Text style={[s.progressDot, tripStatus === 'completed' && s.progressDotActive]}>●</Text>
          </View>
          <View style={s.progressLabels}>
            <Text style={s.progressText}>Assigned</Text>
            <Text style={s.progressText}>Picked</Text>
            <Text style={s.progressText}>On Way</Text>
            <Text style={s.progressText}>Done</Text>
          </View>
        </View>

        {/* Driver Info Card */}
        <View style={s.driverCard}>
          <View style={s.driverRow}>
            <View style={s.driverAvatar}>
              <Text style={s.driverAvatarText}>{driverName.charAt(0)}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.driverName}>{driverName}</Text>
              <Text style={s.vehicleNum}>🚛 {driverVehicle}</Text>
            </View>
            <Text style={s.priceTag}>₹{priceInr}</Text>
          </View>

          <View style={s.actionRow}>
            <TouchableOpacity style={s.callBtn} onPress={callDriver}>
              <Text style={s.callBtnText}>📞  Call Driver</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.trackBtn} onPress={onTrackDriver}>
              <Text style={s.trackBtnText}>📍  Track Driver</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Builty Image Card — shown when driver uploads builty */}
        {builtyImage && (
          <View style={s.builtyCard}>
            <View style={s.builtyHeader}>
              <Text style={s.builtyTitle}>📄 Builty Receipt</Text>
              <Text style={s.builtyBadge}>Uploaded by Driver</Text>
            </View>
            <TouchableOpacity onPress={() => setShowBuiltyFullscreen(true)} activeOpacity={0.8}>
              <Image
                source={{ uri: `data:image/jpeg;base64,${builtyImage}` }}
                style={s.builtyThumbnail}
                resizeMode="cover"
              />
              <View style={s.builtyOverlay}>
                <Text style={s.builtyOverlayText}>Tap to view full size</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Trip Timeline */}
        <View style={s.timelineCard}>
          <Text style={s.timelineTitle}>Trip Timeline</Text>
          {[
            { key: 'matched', label: 'Driver accepted your booking', time: 'Just now' },
            { key: 'picked_up', label: 'Goods picked up from factory', time: tripStatus === 'picked_up' || ['on_the_way', 'completed'].includes(tripStatus) ? 'Done' : 'Pending' },
            { key: 'on_the_way', label: 'On the way to destination', time: tripStatus === 'on_the_way' || tripStatus === 'completed' ? 'Done' : 'Pending' },
            { key: 'completed', label: 'Goods delivered successfully', time: tripStatus === 'completed' ? 'Done' : 'Pending' },
          ].map((item, i) => {
            const isDone = getStepIndex(tripStatus) >= getStepIndex(item.key);
            return (
              <View key={item.key} style={s.timelineItem}>
                <View style={[s.timelineDot, isDone && s.timelineDotDone]} />
                {i < 3 && <View style={[s.timelineLine, isDone && s.timelineLineDone]} />}
                <View style={{ marginLeft: 14, flex: 1 }}>
                  <Text style={[s.timelineLabel, isDone && { color: '#111827' }]}>{item.label}</Text>
                  <Text style={s.timelineTime}>{item.time}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Full-screen Builty Modal */}
      <Modal visible={showBuiltyFullscreen} transparent animationType="fade">
        <View style={s.fullscreenOverlay}>
          <View style={s.fullscreenHeader}>
            <TouchableOpacity onPress={() => setShowBuiltyFullscreen(false)} style={s.fullscreenCloseBtn}>
              <Text style={s.fullscreenCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={s.fullscreenTitle}>Builty Receipt</Text>
            <View style={{ width: 40 }} />
          </View>
          {builtyImage && (
            <Image
              source={{ uri: `data:image/jpeg;base64,${builtyImage}` }}
              style={s.fullscreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

const getStepIndex = (status: string) => {
  const order = ['matched', 'picked_up', 'on_the_way', 'completed'];
  return order.indexOf(status);
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backArrow: { fontSize: 24, color: '#111827', fontWeight: '300' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  liveBadge: { backgroundColor: '#DCFCE7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  liveText: { color: '#16A34A', fontSize: 11, fontWeight: '800' },
  statusBanner: { borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 16 },
  statusIcon: { fontSize: 36 },
  statusLabel: { color: '#FFF', fontSize: 20, fontWeight: '800', marginTop: 6 },
  progressCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, borderWidth: 1, borderColor: '#F3F4F6' },
  progressBarBg: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3 },
  progressBarFill: { height: 6, backgroundColor: '#1A56DB', borderRadius: 3 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressDot: { fontSize: 12, color: '#D1D5DB' },
  progressDotActive: { color: '#1A56DB' },
  progressText: { fontSize: 10, color: '#9CA3AF', fontWeight: '600' },
  driverCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, borderWidth: 1, borderColor: '#F3F4F6' },
  driverRow: { flexDirection: 'row', alignItems: 'center' },
  driverAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1A56DB', justifyContent: 'center', alignItems: 'center' },
  driverAvatarText: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  driverName: { fontSize: 17, fontWeight: '700', color: '#111827' },
  vehicleNum: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  priceTag: { fontSize: 20, fontWeight: '800', color: '#16A34A' },
  actionRow: { flexDirection: 'row', marginTop: 14, gap: 10 },
  callBtn: { flex: 1, backgroundColor: '#16A34A', borderRadius: 12, paddingVertical: 12 },
  callBtnText: { color: '#FFF', textAlign: 'center', fontSize: 14, fontWeight: '700' },
  trackBtn: { flex: 1, backgroundColor: '#1A56DB', borderRadius: 12, paddingVertical: 12 },
  trackBtnText: { color: '#FFF', textAlign: 'center', fontSize: 14, fontWeight: '700' },

  // ─── Builty Card ───
  builtyCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, borderWidth: 1.5, borderColor: '#BBF7D0' },
  builtyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  builtyTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  builtyBadge: { backgroundColor: '#DCFCE7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  builtyThumbnail: { width: '100%', height: 200, borderRadius: 12, backgroundColor: '#F3F4F6' },
  builtyOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', borderBottomLeftRadius: 12, borderBottomRightRadius: 12, paddingVertical: 8 },
  builtyOverlayText: { color: '#FFF', textAlign: 'center', fontSize: 13, fontWeight: '600' },

  // ─── Full-screen Modal ───
  fullscreenOverlay: { flex: 1, backgroundColor: '#000' },
  fullscreenHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, paddingTop: 40, backgroundColor: 'rgba(0,0,0,0.8)' },
  fullscreenCloseBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  fullscreenCloseText: { color: '#FFF', fontSize: 20, fontWeight: '600' },
  fullscreenTitle: { flex: 1, color: '#FFF', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  fullscreenImage: { flex: 1, width: '100%' },

  // ─── Timeline ───
  timelineCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, elevation: 2, borderWidth: 1, borderColor: '#F3F4F6' },
  timelineTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 16 },
  timelineItem: { flexDirection: 'row', marginBottom: 20, position: 'relative' },
  timelineDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#E5E7EB', borderWidth: 2, borderColor: '#D1D5DB', marginTop: 2 },
  timelineDotDone: { backgroundColor: '#1A56DB', borderColor: '#BFDBFE' },
  timelineLine: { position: 'absolute', left: 6, top: 18, width: 2, height: 30, backgroundColor: '#E5E7EB' },
  timelineLineDone: { backgroundColor: '#1A56DB' },
  timelineLabel: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  timelineTime: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
});

export default DriverAcceptedScreen;

