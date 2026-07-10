import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Linking, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchRequestDetails, cancelRequest, fetchCertificate } from '../api';
import { API_BASE_URL } from '../config';
import { saveBuiltyFromBase64 } from '../utils/downloadBuilty';
import { GoodsCertificateCard } from './GoodsCertificateCard';

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
  matched: { label: 'Driver Assigned', icon: '✅', color: '#10B981' },
  picked_up: { label: 'Goods Picked Up', icon: '📦', color: '#10B981' },
  on_the_way: { label: 'On the Way', icon: '🚛', color: '#10B981' },
  completed: { label: 'Delivered!', icon: '🎉', color: '#10B981' },
};

const DriverAcceptedScreen = ({ requestId, driverName, driverPhone, driverVehicle, priceInr, onBack, onTripCompleted, onTrackDriver }: Props) => {
  const [tripStatus, setTripStatus] = useState('matched');
  const [builtyImage, setBuiltyImage] = useState<string | null>(null);
  const [showBuiltyFullscreen, setShowBuiltyFullscreen] = useState(false);
  const [requestDetail, setRequestDetail] = useState<any>(null);
  const [certData, setCertData] = useState<any>(null);
  const [loadingCert, setLoadingCert] = useState(false);
  const checkAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(checkAnim, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  // Poll for status updates every 2 seconds
  useEffect(() => {
    let active = true;
    const interval = setInterval(async () => {
      if (!active) return;
      const res = await fetchRequestDetails(requestId);
      if (res.success && res.request && active) {
        setTripStatus(res.request.status);
        setRequestDetail(res.request);
        if (res.request.builty_image) {
          setBuiltyImage(res.request.builty_image);
        }
        if (res.request.status === 'completed' || res.request.status === 'cancelled') {
          clearInterval(interval);
          if (res.request.status === 'cancelled') {
            Alert.alert('Trip Cancelled', 'This trip has been cancelled.');
            onBack();
          }
        }
      }
    }, 2000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [requestId]);

  // Fetch certificate when goods are picked up
  useEffect(() => {
    let active = true;
    if (['picked_up', 'on_the_way', 'completed'].includes(tripStatus) && !certData) {
      const loadCert = async (retryCount = 0) => {
        if (!active) return;
        setLoadingCert(true);
        const res = await fetchCertificate(requestId);
        if (res.success && res.certificate) {
          if (active) setCertData(res.certificate);
        } else if (retryCount < 3 && active) {
          setTimeout(() => loadCert(retryCount + 1), 1500);
          return;
        }
        if (active) setLoadingCert(false);
      };
      loadCert();
    }
    return () => { active = false; };
  }, [tripStatus, requestId]);

  const handleCancelTrip = () => {
    Alert.alert(
      'Warning: Driver Assigned',
      'A driver is already assigned to this shipment. Are you sure you want to cancel this booking?',
      [
        { text: 'No, Keep Trip', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            const res = await cancelRequest(requestId);
            if (res.success) {
              Alert.alert('Cancelled', 'Your trip has been successfully cancelled.');
              onBack();
            } else {
              Alert.alert('Error', res.error || 'Failed to cancel trip');
            }
          }
        }
      ]
    );
  };

  const callDriver = () => {
    if (driverPhone) Linking.openURL(`tel:${driverPhone}`);
  };

  const statusInfo = STATUS_LABELS[tripStatus] || STATUS_LABELS.matched;
  const progress = tripStatus === 'matched' ? 25 : tripStatus === 'picked_up' ? 50 : tripStatus === 'on_the_way' ? 75 : 100;

  const getStepIndex = (status: string) => {
    const order = ['matched', 'picked_up', 'on_the_way', 'completed'];
    return order.indexOf(status);
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Trip Tracker</Text>
        <View style={s.liveBadge}><Text style={s.liveText}>● LIVE</Text></View>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Modern Status Banner */}
        <Animated.View style={[s.statusBanner, { backgroundColor: statusInfo.color, transform: [{ scale: checkAnim }] }]}>
          <Text style={s.statusIcon}>{statusInfo.icon}</Text>
          <Text style={s.statusLabel}>{statusInfo.label}</Text>
        </Animated.View>

        {/* Progress Bar Card */}
        <View style={s.card}>
          <View style={s.progressBarBg}>
            <Animated.View style={[s.progressBarFill, { width: `${progress}%` }]} />
          </View>
          <View style={s.progressLabelsRow}>
            <Text style={[s.progressDot, tripStatus !== 'pending' && s.progressDotActive]}>●</Text>
            <Text style={[s.progressDot, ['picked_up', 'on_the_way', 'completed'].includes(tripStatus) && s.progressDotActive]}>●</Text>
            <Text style={[s.progressDot, ['on_the_way', 'completed'].includes(tripStatus) && s.progressDotActive]}>●</Text>
            <Text style={[s.progressDot, tripStatus === 'completed' && s.progressDotActive]}>●</Text>
          </View>
          <View style={s.progressLabelsRow}>
            <Text style={s.progressText}>Assigned</Text>
            <Text style={s.progressText}>Picked Up</Text>
            <Text style={s.progressText}>On the Way</Text>
            <Text style={s.progressText}>Delivered</Text>
          </View>
        </View>

        {/* Goods Responsibility Certificate — shown after pickup */}
        {['picked_up', 'on_the_way', 'completed'].includes(tripStatus) && (
          <View style={s.certSection}>
            <Text style={s.certSectionTitle}>📋 Goods Responsibility Certificate</Text>
            {loadingCert && !certData ? (
              <View style={s.certLoading}>
                <ActivityIndicator size="small" color="#10B981" />
                <Text style={s.certLoadingText}>Loading certificate...</Text>
              </View>
            ) : certData ? (
              <GoodsCertificateCard certificate={certData} />
            ) : (
              <View style={s.certLoading}>
                <ActivityIndicator size="small" color="#10B981" />
                <Text style={s.certLoadingText}>Generating certificate...</Text>
              </View>
            )}
          </View>
        )}

        {/* Driver Details Card */}
        <View style={s.card}>
          <Text style={s.cardHeaderTitle}>🚛 Driver Details</Text>
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
              <Text style={s.priceTagText}>
                {requestDetail && requestDetail.weight_kg <= 500
                  ? `₹${priceInr}-${Number(priceInr) + 50}`
                  : `₹${priceInr}`}
              </Text>
            </View>
          </View>

          {tripStatus === 'completed' ? (
            <View style={s.actionRow}>
              <TouchableOpacity style={s.proceedBtn} onPress={() => onTripCompleted(requestId)} activeOpacity={0.85}>
                <Text style={s.proceedBtnText}>⭐  Rate Driver & Close Trip</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.actionRow}>
              <TouchableOpacity style={s.callBtn} onPress={callDriver} activeOpacity={0.8}>
                <Text style={s.callBtnText}>📞 Call Driver</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.trackBtn} onPress={onTrackDriver} activeOpacity={0.8}>
                <Text style={s.trackBtnText}>📍 Live Map</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Cancel button: Only allowed before picked up (matched status) */}
        {tripStatus === 'matched' && (
          <TouchableOpacity
            style={s.cancelTripBtn}
            onPress={handleCancelTrip}
            activeOpacity={0.8}
          >
            <Text style={s.cancelTripBtnText}>Cancel booking</Text>
          </TouchableOpacity>
        )}

        {/* Builty Receipt Upload Card */}
        {builtyImage && (
          <View style={[s.card, { borderColor: '#10B981', borderWidth: 1 }]}>
            <View style={s.builtyHeader}>
              <Text style={s.cardHeaderTitle}>📄 Builty Receipt</Text>
              <TouchableOpacity 
                onPress={() => builtyImage && saveBuiltyFromBase64(requestId, builtyImage)}
                style={s.cardDownloadBtn}
                activeOpacity={0.7}
              >
                <Text style={s.cardDownloadBtnText}>⬇️ Download</Text>
              </TouchableOpacity>
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

        {/* Booking Timeline */}
        <View style={s.card}>
          <Text style={s.cardHeaderTitle}>Timeline</Text>
          {[
            { key: 'matched', label: 'Driver accepted your booking', time: 'Completed' },
            { key: 'picked_up', label: 'Goods picked up from factory', time: tripStatus === 'picked_up' || ['on_the_way', 'completed'].includes(tripStatus) ? 'Completed' : 'Pending' },
            { key: 'on_the_way', label: 'On the way to destination', time: tripStatus === 'on_the_way' || tripStatus === 'completed' ? 'Completed' : 'Pending' },
            { key: 'completed', label: 'Goods delivered successfully', time: tripStatus === 'completed' ? 'Completed' : 'Pending' },
          ].map((item, i) => {
            const isDone = getStepIndex(tripStatus) >= getStepIndex(item.key);
            return (
              <View key={item.key} style={s.timelineItem}>
                <View style={[s.timelineDot, isDone && s.timelineDotDone]}>
                  {isDone && <Text style={s.timelineCheck}>✓</Text>}
                </View>
                {i < 3 && <View style={[s.timelineLine, isDone && s.timelineLineDone]} />}
                <View style={{ marginLeft: 14, flex: 1 }}>
                  <Text style={[s.timelineLabel, isDone && { color: '#1A1A1A', fontWeight: '700' }]}>{item.label}</Text>
                  <Text style={[s.timelineTime, isDone && { color: '#10B981' }]}>{item.time}</Text>
                </View>
              </View>
            );
          })}
        </View>

      </ScrollView>

      {/* Fullscreen Builty Modal */}
      <Modal visible={showBuiltyFullscreen} transparent animationType="fade">
        <View style={s.fullscreenOverlay}>
          <View style={s.fullscreenHeader}>
            <TouchableOpacity onPress={() => setShowBuiltyFullscreen(false)} style={s.fullscreenCloseBtn}>
              <Text style={s.fullscreenCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={s.fullscreenTitle}>Builty Receipt</Text>
            <TouchableOpacity 
              onPress={() => builtyImage && saveBuiltyFromBase64(requestId, builtyImage)}
              style={s.fullscreenDownloadBtn}
              activeOpacity={0.7}
            >
              <Text style={s.fullscreenDownloadBtnText}>⬇️ Download</Text>
            </TouchableOpacity>
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
    backgroundColor: '#FEE2E2',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  liveText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Status Banner
  statusBanner: {
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  statusIcon: {
    fontSize: 32,
  },
  statusLabel: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 6,
  },

  // Cards
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 14,
  },

  // Progress Bar
  progressBarBg: {
    height: 6,
    backgroundColor: '#F5F5F5',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  progressLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  progressDot: {
    fontSize: 12,
    color: '#E5E5E5',
  },
  progressDotActive: {
    color: '#10B981',
  },
  progressText: {
    fontSize: 10,
    color: '#6B6B6B',
    fontWeight: '600',
  },

  // Driver details & row
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverAvatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  driverName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  vehicleIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  vehicleNum: {
    fontSize: 12,
    color: '#6B6B6B',
    fontWeight: '500',
  },
  priceTag: {
    backgroundColor: '#E6F7F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  priceTagText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#10B981',
  },

  // Actions
  actionRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 10,
  },
  callBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  callBtnText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '700',
  },
  trackBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    borderRadius: 28,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  proceedBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    borderRadius: 28,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proceedBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // Cancel Button
  cancelTripBtn: {
    backgroundColor: '#E53935',
    borderRadius: 28,
    paddingVertical: 16,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#E53935',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cancelTripBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // Certificate Section
  certSection: {
    marginBottom: 16,
  },
  certSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 10,
  },
  certLoading: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  certLoadingText: {
    color: '#6B6B6B',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '600',
  },

  // Builty
  builtyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardDownloadBtn: {
    backgroundColor: '#E6F7F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  cardDownloadBtnText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  builtyThumbnail: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    marginTop: 8,
  },
  builtyOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    paddingVertical: 8,
  },
  builtyOverlayText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },

  // Timeline
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 20,
    position: 'relative',
  },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E5E5',
  },
  timelineDotDone: {
    backgroundColor: '#10B981',
    borderColor: '#A7F3D0',
  },
  timelineCheck: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  timelineLine: {
    position: 'absolute',
    left: 9,
    top: 22,
    width: 2,
    height: 24,
    backgroundColor: '#E5E5E5',
  },
  timelineLineDone: {
    backgroundColor: '#10B981',
  },
  timelineLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B6B6B',
  },
  timelineTime: {
    fontSize: 11,
    color: '#6B6B6B',
    marginTop: 1,
    fontWeight: '500',
  },

  // Fullscreen Modal
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fullscreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 40,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  fullscreenCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenCloseText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  fullscreenTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  fullscreenImage: {
    flex: 1,
    width: '100%',
  },
  fullscreenDownloadBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fullscreenDownloadBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});


export default DriverAcceptedScreen;
