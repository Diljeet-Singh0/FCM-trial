import React, { useEffect, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { API_BASE_URL, USER_ID } from './src/config';
import { acceptRequest, declineRequest, fetchActiveRequests, registerUser, updateTripStatus } from './src/api';

type Screen = 'home' | 'active-requests';
type RegistrationStatus = 'pending' | 'registered' | 'error';

type IncomingRequest = {
  requestId: string;
  goodsType: string;
  weightKg: string;
  pickupAddress: string;
  dropAddress: string;
  ownerId: string;
  priceInr: string;
};

type ActiveRequest = {
  id: string;
  goods_type: string;
  weight_kg: number;
  pickup_address: string;
  drop_address: string;
  owner_id: string;
  price_inr: number;
};

const readDataString = (value: string | object | undefined, fallback = ''): string => {
  return typeof value === 'string' ? value : fallback;
};

const App = () => {
  const [incomingRequest, setIncomingRequest] = useState<IncomingRequest | null>(null);
  const [acceptStatus, setAcceptStatus] = useState<null | 'accepted' | 'declined'>(null);
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus>('pending');
  const [screen, setScreen] = useState<Screen>('home');
  const [transporterId, setTransporterId] = useState<string>(USER_ID);
  const [activeRequests, setActiveRequests] = useState<ActiveRequest[]>([]);
  const [tripStatus, setTripStatus] = useState<'matched' | 'picked_up' | 'on_the_way' | 'completed'>('matched');

  const loadActiveRequests = async () => {
    const response = await fetchActiveRequests();
    if (response.success) {
      setActiveRequests(response.requests);
    } else {
      Alert.alert('Error', response.error ?? 'Could not fetch active requests');
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setRegistrationStatus('pending');
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (!enabled) {
          setRegistrationStatus('error');
          return;
        }

        const token = await messaging().getToken();
        const registration = await registerUser('Transporter One', '9999999992', 'transporter', token);
        if (registration.success && registration.userId) {
          setTransporterId(registration.userId);
          setRegistrationStatus('registered');
        } else {
          setRegistrationStatus('error');
        }
      } catch (error) {
        setRegistrationStatus('error');
      }
    };

    bootstrap();

    const unsubscribeRefresh = messaging().onTokenRefresh(async (newToken) => {
      await registerUser('Transporter One', '9999999992', 'transporter', newToken);
    });

    const unsubscribeMessage = messaging().onMessage(async (remoteMessage) => {
      if (remoteMessage.data?.type === 'NEW_REQUEST') {
        setIncomingRequest({
          requestId: readDataString(remoteMessage.data.requestId),
          goodsType: readDataString(remoteMessage.data.goodsType),
          weightKg: readDataString(remoteMessage.data.weightKg),
          pickupAddress: readDataString(remoteMessage.data.pickupAddress),
          dropAddress: readDataString(remoteMessage.data.dropAddress),
          ownerId: readDataString(remoteMessage.data.ownerId),
          priceInr: readDataString(remoteMessage.data.priceInr, '0'),
        });
        setAcceptStatus(null);
      }
    });

    return () => {
      unsubscribeRefresh();
      unsubscribeMessage();
    };
  }, []);

  useEffect(() => {
    if (screen === 'active-requests') {
      loadActiveRequests();
    }
  }, [screen]);

  const onAcceptRequest = async () => {
    if (!incomingRequest) {
      return;
    }
    const response = await acceptRequest(incomingRequest.requestId, transporterId);
    if (response.success) {
      setAcceptStatus('accepted');
      setTripStatus('matched');
    } else {
      Alert.alert('Error', response.error ?? 'Could not accept request');
    }
  };

  const onUpdateTripStatus = async (newStatus: 'picked_up' | 'on_the_way' | 'completed') => {
    if (!incomingRequest) return;
    const response = await updateTripStatus(incomingRequest.requestId, transporterId, newStatus);
    if (response.success) {
      setTripStatus(newStatus);
      if (newStatus === 'completed') {
        Alert.alert('✅ Trip Completed', 'Great job! The delivery has been marked as completed.');
      }
    } else {
      Alert.alert('Error', response.error ?? 'Could not update status');
    }
  };

  const onDecline = async () => {
    if (!incomingRequest) {
      return;
    }
    const response = await declineRequest(incomingRequest.requestId, transporterId);
    if (!response.success) {
      Alert.alert('Error', response.error ?? 'Could not decline request');
      return;
    }
    setAcceptStatus('declined');
    setIncomingRequest(null);
  };

  // ─── Booking Request Card Component ───
  const BookingCard = ({ req, showActions = false }: { req: IncomingRequest; showActions?: boolean }) => {
    const gozoId = `GOZO-${req.requestId.slice(0, 7).toUpperCase()}`;
    return (
      <View style={s.bookingCard}>
        {/* Header row */}
        <View style={s.bookingHeader}>
          <View>
            <Text style={s.gozoId}>{gozoId}</Text>
            <Text style={s.customerName}>Customer</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.payoutLabel}>Driver payout</Text>
            <Text style={s.payoutAmount}>₹{req.priceInr}</Text>
          </View>
        </View>

        {/* Route */}
        <View style={s.routeContainer}>
          <View style={s.routeDots}>
            <View style={s.greenDot} />
            <View style={s.routeLine} />
            <View style={s.blueDot} />
          </View>
          <View style={s.routeTexts}>
            <View>
              <Text style={s.routeLabel}>Pickup</Text>
              <Text style={s.routeAddress}>{req.pickupAddress}</Text>
            </View>
            <View style={{ marginTop: 14 }}>
              <Text style={s.routeLabel}>Drop</Text>
              <Text style={s.routeAddress}>{req.dropAddress}</Text>
            </View>
          </View>
        </View>

        {/* Info chips */}
        <View style={s.chipsRow}>
          <View style={s.chip}>
            <Text style={s.chipIcon}>📏</Text>
            <Text style={s.chipText}>Route</Text>
          </View>
          <View style={s.chip}>
            <Text style={s.chipIcon}>⚖️</Text>
            <Text style={s.chipText}>{req.weightKg} kg</Text>
          </View>
          <View style={s.chip}>
            <Text style={s.chipIcon}>🚛</Text>
            <Text style={s.chipText}>{req.goodsType}</Text>
          </View>
        </View>

        {/* Info box */}
        <View style={s.infoBox}>
          <Text style={s.infoBoxText}>Goods: {req.goodsType}</Text>
          <Text style={s.infoBoxText}>Payment: UPI</Text>
          <Text style={s.infoBoxText}>ETA to pickup: ~15 min</Text>
        </View>

        {/* Action buttons */}
        {showActions && acceptStatus !== 'accepted' && (
          <View style={s.actionRow}>
            <TouchableOpacity style={s.rejectBtn} onPress={onDecline}>
              <Text style={s.rejectBtnText}>✕  Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.acceptBtn} onPress={onAcceptRequest}>
              <Text style={s.acceptBtnText}>✓  Accept Job</Text>
            </TouchableOpacity>
          </View>
        )}

        {acceptStatus === 'accepted' && showActions && (
          <View style={s.acceptedBanner}>
            <Text style={s.acceptedText}>✅ Job accepted! Get ready for pickup.</Text>
          </View>
        )}
      </View>
    );
  };

  // ─── Active Delivery View ───
  const renderActiveDelivery = () => {
    if (!incomingRequest || acceptStatus !== 'accepted') return null;
    const gozoId = `GOZO-${incomingRequest.requestId.slice(0, 7).toUpperCase()}`;
    const progressPercent = tripStatus === 'matched' ? 10 : tripStatus === 'picked_up' ? 40 : tripStatus === 'on_the_way' ? 75 : 100;
    const progressLabel = tripStatus === 'matched' ? 'Heading to pickup' : tripStatus === 'picked_up' ? 'Goods loaded' : tripStatus === 'on_the_way' ? 'En route to drop' : 'Delivered';

    return (
      <View style={s.activeDeliveryContainer}>
        {/* Header */}
        <View style={s.adHeader}>
          <TouchableOpacity onPress={() => { if (tripStatus === 'completed') { setAcceptStatus(null); setTripStatus('matched'); } }} style={s.backBtn}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={s.adTitle}>Active Delivery</Text>
            <Text style={s.adSubtitle}>{gozoId}</Text>
          </View>
          <View style={s.liveBadge}>
            <Text style={s.liveText}>{tripStatus === 'completed' ? 'DONE' : 'LIVE'}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
          {/* Customer card */}
          <View style={s.adCustomerCard}>
            <View>
              <Text style={s.adCustomerName}>Customer</Text>
              <Text style={s.adCustomerMeta}>{incomingRequest.weightKg} kg · {incomingRequest.goodsType}</Text>
            </View>
            <Text style={s.adPrice}>₹{incomingRequest.priceInr}</Text>
          </View>

          {/* Route */}
          <View style={s.adRouteCard}>
            <View style={s.routeContainer}>
              <View style={s.routeDots}>
                <View style={s.greenDot} />
                <View style={s.routeLine} />
                <View style={s.blueDot} />
              </View>
              <View style={s.routeTexts}>
                <View>
                  <Text style={s.routeLabel}>Pickup</Text>
                  <Text style={s.routeAddress}>{incomingRequest.pickupAddress}</Text>
                </View>
                <View style={{ marginTop: 14 }}>
                  <Text style={s.routeLabel}>Drop</Text>
                  <Text style={s.routeAddress}>{incomingRequest.dropAddress}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Progress bar */}
          <View style={s.adProgressCard}>
            <View style={s.adProgressHeader}>
              <Text style={s.adProgressTitle}>{progressLabel}</Text>
              <Text style={s.adProgressPercent}>{progressPercent}%</Text>
            </View>
            <View style={s.adProgressBarBg}>
              <View style={[s.adProgressBarFill, { width: `${progressPercent}%` as any }]} />
              <View style={[s.adProgressIcon, { left: `${Math.max(progressPercent - 5, 0)}%` as any }]}>
                <Text style={{ fontSize: 16 }}>🚛</Text>
              </View>
            </View>
            <View style={s.adProgressLabels}>
              <Text style={s.adProgressLabel}>Pickup</Text>
              <Text style={s.adProgressLabel}>Drop</Text>
            </View>
          </View>

          {/* Trip Status Buttons */}
          {tripStatus === 'matched' && (
            <TouchableOpacity style={s.reachedBtn} onPress={() => onUpdateTripStatus('picked_up')}>
              <Text style={s.reachedBtnText}>📦  Goods Picked Up</Text>
            </TouchableOpacity>
          )}
          {tripStatus === 'picked_up' && (
            <TouchableOpacity style={[s.reachedBtn, { backgroundColor: '#1A56DB' }]} onPress={() => onUpdateTripStatus('on_the_way')}>
              <Text style={s.reachedBtnText}>🚛  Start Trip — On the Way</Text>
            </TouchableOpacity>
          )}
          {tripStatus === 'on_the_way' && (
            <TouchableOpacity style={[s.reachedBtn, { backgroundColor: '#7C3AED' }]} onPress={() => onUpdateTripStatus('completed')}>
              <Text style={s.reachedBtnText}>✅  Mark as Delivered</Text>
            </TouchableOpacity>
          )}
          {tripStatus === 'completed' && (
            <View style={s.completedBanner}>
              <Text style={s.completedText}>🎉 Delivery Completed! Great job.</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  // ─── HOME SCREEN ───
  const renderHome = () => (
    <View style={{ flex: 1 }}>
      {/* Driver profile header */}
      <View style={s.profileHeader}>
        <View style={s.avatarCircle}>
          <Text style={s.avatarText}>RS</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.driverName}>Transporter One</Text>
          <Text style={s.vehicleInfo}>Eicher 14 ft · Vehicle</Text>
        </View>
        <View style={s.onlineBadge}>
          <Text style={s.onlineText}>
            {registrationStatus === 'registered' ? 'Online' : registrationStatus === 'error' ? 'Error' : 'Connecting'}
          </Text>
        </View>
      </View>

      {/* If accepted → show active delivery */}
      {acceptStatus === 'accepted' && incomingRequest ? (
        renderActiveDelivery()
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
          {/* Browse button */}
          <TouchableOpacity style={s.browseBtn} onPress={() => setScreen('active-requests')}>
            <Text style={s.browseBtnText}>📋  Browse Active Requests</Text>
          </TouchableOpacity>

          {/* Section header */}
          <Text style={s.sectionTitle}>New Booking Requests</Text>

          {incomingRequest ? (
            <BookingCard req={incomingRequest} showActions={true} />
          ) : (
            <View style={s.waitingCard}>
              <Text style={{ fontSize: 40 }}>📡</Text>
              <Text style={s.waitingTitle}>Waiting for requests...</Text>
              <Text style={s.waitingSub}>New shipment requests will appear here</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );

  // ─── ACTIVE REQUESTS SCREEN ───
  const renderActiveRequests = () => (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={s.screenHeaderBar}>
        <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.screenHeaderTitle}>Available Requests</Text>
          <Text style={s.screenHeaderSub}>{activeRequests.length} pending</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        {activeRequests.map((item) => (
          <View key={item.id} style={s.bookingCard}>
            <View style={s.bookingHeader}>
              <View>
                <Text style={s.gozoId}>GOZO-{item.id.slice(0, 7).toUpperCase()}</Text>
                <Text style={s.customerName}>{item.goods_type}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.payoutLabel}>Driver payout</Text>
                <Text style={s.payoutAmount}>₹{item.price_inr}</Text>
              </View>
            </View>

            <View style={s.routeContainer}>
              <View style={s.routeDots}>
                <View style={s.greenDot} />
                <View style={s.routeLine} />
                <View style={s.blueDot} />
              </View>
              <View style={s.routeTexts}>
                <View>
                  <Text style={s.routeLabel}>Pickup</Text>
                  <Text style={s.routeAddress}>{item.pickup_address}</Text>
                </View>
                <View style={{ marginTop: 14 }}>
                  <Text style={s.routeLabel}>Drop</Text>
                  <Text style={s.routeAddress}>{item.drop_address}</Text>
                </View>
              </View>
            </View>

            <View style={s.chipsRow}>
              <View style={s.chip}><Text style={s.chipIcon}>⚖️</Text><Text style={s.chipText}>{item.weight_kg} kg</Text></View>
              <View style={s.chip}><Text style={s.chipIcon}>🚛</Text><Text style={s.chipText}>{item.goods_type}</Text></View>
            </View>

            <TouchableOpacity
              style={s.acceptFullBtn}
              onPress={() => {
                setIncomingRequest({
                  requestId: item.id,
                  goodsType: item.goods_type,
                  weightKg: String(item.weight_kg),
                  pickupAddress: item.pickup_address,
                  dropAddress: item.drop_address,
                  ownerId: item.owner_id,
                  priceInr: String(item.price_inr),
                });
                setAcceptStatus(null);
                setScreen('home');
              }}
            >
              <Text style={s.acceptFullBtnText}>View & Accept</Text>
            </TouchableOpacity>
          </View>
        ))}
        {activeRequests.length === 0 && (
          <View style={s.waitingCard}>
            <Text style={{ fontSize: 40 }}>📭</Text>
            <Text style={s.waitingTitle}>No pending requests</Text>
            <Text style={s.waitingSub}>Check back later for new shipments</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {screen === 'home' && renderHome()}
      {screen === 'active-requests' && renderActiveRequests()}
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },

  // ─── Driver Profile Header ───
  profileHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  avatarCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1A56DB', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  driverName: { fontSize: 17, fontWeight: '700', color: '#111827' },
  vehicleInfo: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  onlineBadge: { backgroundColor: '#DCFCE7', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  onlineText: { color: '#16A34A', fontSize: 13, fontWeight: '700' },

  // ─── Section Title ───
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginHorizontal: 16, marginTop: 16, marginBottom: 12 },

  // ─── Browse Button ───
  browseBtn: { marginHorizontal: 16, marginTop: 12, backgroundColor: '#1A56DB', borderRadius: 14, paddingVertical: 14, elevation: 2 },
  browseBtnText: { color: '#FFFFFF', textAlign: 'center', fontSize: 15, fontWeight: '700' },

  // ─── Booking Card ───
  bookingCard: { marginHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, marginBottom: 14, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, borderWidth: 1, borderColor: '#F3F4F6' },
  bookingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  gozoId: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  customerName: { fontSize: 17, fontWeight: '700', color: '#111827', marginTop: 2 },
  payoutLabel: { fontSize: 11, color: '#6B7280' },
  payoutAmount: { fontSize: 22, fontWeight: '800', color: '#16A34A', marginTop: 2 },

  // ─── Route ───
  routeContainer: { flexDirection: 'row', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  routeDots: { alignItems: 'center', marginRight: 14, paddingTop: 4 },
  greenDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#22C55E', borderWidth: 2.5, borderColor: '#BBF7D0' },
  blueDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#1A56DB', borderWidth: 2.5, borderColor: '#BFDBFE' },
  routeLine: { width: 2, height: 26, backgroundColor: '#D1D5DB', marginVertical: 3 },
  routeTexts: { flex: 1 },
  routeLabel: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  routeAddress: { fontSize: 15, fontWeight: '600', color: '#111827', marginTop: 2 },

  // ─── Chips ───
  chipsRow: { flexDirection: 'row', marginTop: 12, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F9FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#E0F2FE' },
  chipIcon: { fontSize: 14, marginRight: 4 },
  chipText: { fontSize: 12, fontWeight: '600', color: '#0369A1' },

  // ─── Info Box ───
  infoBox: { marginTop: 12, backgroundColor: '#F0FDF4', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#BBF7D0' },
  infoBoxText: { fontSize: 13, color: '#166534', fontWeight: '500', lineHeight: 20 },

  // ─── Action Buttons ───
  actionRow: { flexDirection: 'row', marginTop: 14, gap: 10 },
  rejectBtn: { flex: 1, borderWidth: 2, borderColor: '#FCA5A5', borderRadius: 14, paddingVertical: 14, backgroundColor: '#FFF' },
  rejectBtnText: { textAlign: 'center', color: '#DC2626', fontSize: 15, fontWeight: '700' },
  acceptBtn: { flex: 1.3, backgroundColor: '#16A34A', borderRadius: 14, paddingVertical: 14, elevation: 2 },
  acceptBtnText: { textAlign: 'center', color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  acceptedBanner: { marginTop: 12, backgroundColor: '#DCFCE7', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#86EFAC' },
  acceptedText: { color: '#166534', fontWeight: '700', fontSize: 14 },

  // ─── Active Delivery ───
  activeDeliveryContainer: { flex: 1 },
  adHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  adTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  adSubtitle: { fontSize: 12, color: '#6B7280' },
  liveBadge: { backgroundColor: '#DCFCE7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  liveText: { color: '#16A34A', fontSize: 12, fontWeight: '800' },
  adCustomerCard: { backgroundColor: '#1A56DB', borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  adCustomerName: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  adCustomerMeta: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  adPrice: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  adRouteCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginTop: 12, elevation: 2, borderWidth: 1, borderColor: '#F3F4F6' },
  adProgressCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginTop: 12, elevation: 2, borderWidth: 1, borderColor: '#F3F4F6' },
  adProgressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  adProgressTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  adProgressPercent: { fontSize: 14, fontWeight: '700', color: '#1A56DB' },
  adProgressBarBg: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, position: 'relative' },
  adProgressBarFill: { position: 'absolute', left: 0, top: 0, height: 6, width: '20%', backgroundColor: '#1A56DB', borderRadius: 3 },
  adProgressIcon: { position: 'absolute', left: '17%', top: -12 },
  adProgressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  adProgressLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  reachedBtn: { backgroundColor: '#16A34A', borderRadius: 14, paddingVertical: 16, marginTop: 16, elevation: 2 },
  reachedBtnText: { color: '#FFFFFF', textAlign: 'center', fontSize: 16, fontWeight: '700' },
  completedBanner: { marginTop: 16, backgroundColor: '#DCFCE7', borderRadius: 14, padding: 18, borderWidth: 1, borderColor: '#86EFAC', alignItems: 'center' },
  completedText: { color: '#166534', fontWeight: '700', fontSize: 16 },

  // ─── Waiting / Empty ───
  waitingCard: { marginHorizontal: 16, alignItems: 'center', paddingVertical: 50, backgroundColor: '#FFFFFF', borderRadius: 18, elevation: 1, borderWidth: 1, borderColor: '#F3F4F6' },
  waitingTitle: { fontSize: 17, fontWeight: '700', color: '#374151', marginTop: 12 },
  waitingSub: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },

  // ─── Screen Header ───
  screenHeaderBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  screenHeaderTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  screenHeaderSub: { fontSize: 12, color: '#6B7280' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backArrow: { fontSize: 24, color: '#111827', fontWeight: '300' },

  // ─── Accept Full Width ───
  acceptFullBtn: { backgroundColor: '#1A56DB', borderRadius: 14, paddingVertical: 14, marginTop: 14 },
  acceptFullBtnText: { color: '#FFFFFF', textAlign: 'center', fontSize: 15, fontWeight: '700' },
});

export default App;
