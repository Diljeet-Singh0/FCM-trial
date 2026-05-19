import React, { useEffect, useState, useRef } from 'react';
import { Animated, Image, Linking, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  matched: { label: 'Driver Assigned', icon: '✅', color: '#059669' },
  picked_up: { label: 'Goods Picked Up', icon: '📦', color: '#0369A1' },
  on_the_way: { label: 'On the Way', icon: '🚛', color: '#1A56DB' },
  completed: { label: 'Delivered!', icon: '🎉', color: '#059669' },
};

const DriverAcceptedScreen = ({ requestId, driverName, driverPhone, driverVehicle, priceInr, onBack, onTripCompleted, onTrackDriver }: Props) => {
  const [tripStatus, setTripStatus] = useState('matched');
  const [builtyImage, setBuiltyImage] = useState<string | null>(null);
  const [showBuiltyFullscreen, setShowBuiltyFullscreen] = useState(false);
  const checkAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(checkAnim, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
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
      <StatusBar barStyle="light-content" backgroundColor="#1A56DB" />
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Trip Status</Text>
        <View style={s.liveBadge}><Text style={s.liveText}>● LIVE</Text></View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        {/* Status Banner */}
        <Animated.View style={[s.statusBanner, { backgroundColor: statusInfo.color, transform: [{ scale: checkAnim }] }]}>
          <Text style={s.statusIcon}>{statusInfo.icon}</Text>
          <Text style={s.statusLabel}>{statusInfo.label}</Text>
        </Animated.View>

        {/* Progress Bar */}
        <View style={s.progressCard}>
          <View style={s.progressBarBg}>
            <Animated.View style={[s.progressBarFill, { width: `${progress}%` }]} />
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
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={s.driverName}>{driverName}</Text>
              <View style={s.vehicleRow}>
                <Text style={s.vehicleIcon}>🚛</Text>
                <Text style={s.vehicleNum}>{driverVehicle}</Text>
              </View>
            </View>
            <View style={s.priceTag}>
              <Text style={s.priceTagText}>₹{priceInr}</Text>
            </View>
          </View>

          <View style={s.actionRow}>
            <TouchableOpacity style={s.callBtn} onPress={callDriver} activeOpacity={0.8}>
              <Text style={s.callBtnText}>📞  Call Driver</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.trackBtn} onPress={onTrackDriver} activeOpacity={0.8}>
              <Text style={s.trackBtnText}>📍  Track Driver</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Builty Image Card — shown when driver uploads builty */}
        {builtyImage && (
          <View style={s.builtyCard}>
            <View style={s.builtyHeader}>
              <Text style={s.builtyTitle}>📄 Builty Receipt</Text>
              <View style={s.builtyBadgeWrap}>
                <Text style={s.builtyBadge}>✓ Uploaded</Text>
              </View>
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
                <View style={[s.timelineDot, isDone && s.timelineDotDone]}>
                  {isDone && <Text style={s.timelineCheck}>✓</Text>}
                </View>
                {i < 3 && <View style={[s.timelineLine, isDone && s.timelineLineDone]} />}
                <View style={{ marginLeft: 14, flex: 1 }}>
                  <Text style={[s.timelineLabel, isDone && { color: '#0F172A' }]}>{item.label}</Text>
                  <Text style={[s.timelineTime, isDone && { color: '#059669' }]}>{item.time}</Text>
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
  container: { flex: 1, backgroundColor: '#F0F4F8' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 52,
    backgroundColor: '#1A56DB',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
  backArrow: { fontSize: 22, color: '#FFFFFF', fontWeight: '400' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', letterSpacing: 0.3 },
  liveBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  liveText: { color: '#4ADE80', fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  // Status
  statusBanner: { borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 14, elevation: 3 },
  statusIcon: { fontSize: 36 },
  statusLabel: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginTop: 6, letterSpacing: 0.2 },

  // Progress
  progressCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, marginBottom: 14,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  progressBarBg: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: 6, backgroundColor: '#1A56DB', borderRadius: 3 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  progressDot: { fontSize: 12, color: '#D1D5DB' },
  progressDotActive: { color: '#1A56DB' },
  progressText: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },

  // Driver
  driverCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, marginBottom: 14,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  driverRow: { flexDirection: 'row', alignItems: 'center' },
  driverAvatar: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: '#1A56DB', justifyContent: 'center', alignItems: 'center',
  },
  driverAvatarText: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  driverName: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  vehicleIcon: { fontSize: 13, marginRight: 4 },
  vehicleNum: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  priceTag: {
    backgroundColor: '#ECFDF5', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#A7F3D0',
  },
  priceTagText: { fontSize: 18, fontWeight: '800', color: '#059669' },
  actionRow: { flexDirection: 'row', marginTop: 16, gap: 10 },
  callBtn: {
    flex: 1, backgroundColor: '#059669', borderRadius: 12, paddingVertical: 13,
    elevation: 2, shadowColor: '#059669', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4,
  },
  callBtnText: { color: '#FFFFFF', textAlign: 'center', fontSize: 14, fontWeight: '700' },
  trackBtn: {
    flex: 1, backgroundColor: '#1A56DB', borderRadius: 12, paddingVertical: 13,
    elevation: 2, shadowColor: '#1A56DB', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4,
  },
  trackBtnText: { color: '#FFFFFF', textAlign: 'center', fontSize: 14, fontWeight: '700' },

  // Builty
  builtyCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 14,
    elevation: 2, borderWidth: 1.5, borderColor: '#A7F3D0',
  },
  builtyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  builtyTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  builtyBadgeWrap: { backgroundColor: '#ECFDF5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  builtyBadge: { color: '#059669', fontSize: 12, fontWeight: '700' },
  builtyThumbnail: { width: '100%', height: 200, borderRadius: 12, backgroundColor: '#F1F5F9' },
  builtyOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderBottomLeftRadius: 12, borderBottomRightRadius: 12, paddingVertical: 8,
  },
  builtyOverlayText: { color: '#FFFFFF', textAlign: 'center', fontSize: 13, fontWeight: '600' },

  // Fullscreen Modal
  fullscreenOverlay: { flex: 1, backgroundColor: '#000' },
  fullscreenHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, paddingTop: 40,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  fullscreenCloseBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  fullscreenCloseText: { color: '#FFFFFF', fontSize: 20, fontWeight: '600' },
  fullscreenTitle: { flex: 1, color: '#FFFFFF', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  fullscreenImage: { flex: 1, width: '100%' },

  // Timeline
  timelineCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  timelineTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 18, letterSpacing: 0.1 },
  timelineItem: { flexDirection: 'row', marginBottom: 22, position: 'relative' },
  timelineDot: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#D1D5DB',
  },
  timelineDotDone: { backgroundColor: '#1A56DB', borderColor: '#93C5FD' },
  timelineCheck: { fontSize: 10, color: '#FFFFFF', fontWeight: '800' },
  timelineLine: { position: 'absolute', left: 10, top: 24, width: 2, height: 26, backgroundColor: '#E2E8F0' },
  timelineLineDone: { backgroundColor: '#1A56DB' },
  timelineLabel: { fontSize: 14, fontWeight: '600', color: '#94A3B8' },
  timelineTime: { fontSize: 12, color: '#94A3B8', marginTop: 2, fontWeight: '500' },
});

export default DriverAcceptedScreen;
