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
  Dimensions,
  BackHandler,
  ActivityIndicator,
} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './src/config';
import { createRequest, fetchMyRequests } from './src/api';
import AuthScreens from './src/screens/AuthScreens';
import BrowseCompaniesScreen from './src/screens/BrowseCompaniesScreen';
import type { Company } from './src/screens/BrowseCompaniesScreen';
import CompanyDetailScreen from './src/screens/CompanyDetailScreen';
import BookingScreen from './src/screens/BookingScreen';
import type { BookingData } from './src/screens/BookingScreen';
import WaitingScreen from './src/screens/WaitingScreen';
import DriverAcceptedScreen from './src/screens/DriverAcceptedScreen';
import RateDriverScreen from './src/screens/RateDriverScreen';
import LiveTrackingScreen from './src/screens/LiveTrackingScreen';
import AddressInput from './src/components/AddressInput';
import MapLocationPicker from './src/components/MapLocationPicker';
import OrderDetailScreen from './src/screens/OrderDetailScreen';

type Screen = 'home' | 'new-request' | 'my-requests' | 'browse-companies' | 'company-detail' | 'booking' | 'waiting' | 'driver-accepted' | 'rate-driver' | 'live-tracking' | 'order-detail';
type RegistrationStatus = 'pending' | 'registered' | 'error';

type RequestItem = {
  id: string;
  goods_type: string;
  weight_kg: number;
  pickup_address: string;
  drop_address: string;
  status: 'pending' | 'matched' | 'cancelled';
  transporter_id?: string;
  accepted_price?: number;
};

const statusColorMap: Record<RequestItem['status'], string> = {
  pending: '#F9A825',
  matched: '#2E7D32',
  cancelled: '#C62828',
};

const readDataString = (value: string | object | undefined, fallback = ''): string => {
  return typeof value === 'string' ? value : fallback;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const App = () => {
  const [screen, setScreen] = useState<Screen>('home');
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);

  const [goodsType, setGoodsType] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropAddress, setDropAddress] = useState('');

  // New booking flow state
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [acceptedDriver, setAcceptedDriver] = useState<{name: string; phone: string; vehicle: string; price: string} | null>(null);
  const [bookingPickup, setBookingPickup] = useState('');
  const [bookingDrop, setBookingDrop] = useState('');
  const [showPickupMapPicker, setShowPickupMapPicker] = useState(false);
  const [showDropMapPicker, setShowDropMapPicker] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const fetchRequests = async (ownerIdValue: string) => {
    const response = await fetchMyRequests(ownerIdValue);
    if (response.success) {
      setRequests(response.requests);
    } else if (response.error) {
      Alert.alert('Error', response.error);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const storedId = await AsyncStorage.getItem('gozo_owner_id');
        if (storedId) {
          setOwnerId(storedId);
        }
      } catch (e) {
        console.warn('Failed to load session', e);
      } finally {
        setIsAppReady(true);
      }
    };
    bootstrap();

    const unsubscribeMessage = messaging().onMessage(async (remoteMessage) => {
      if (remoteMessage.data?.type === 'REQUEST_ACCEPTED') {
        const priceInr = readDataString(remoteMessage.data.priceInr, '0');
        const dName = readDataString(remoteMessage.data.driverName, 'Driver');
        const dPhone = readDataString(remoteMessage.data.driverPhone, '');
        const dVehicle = readDataString(remoteMessage.data.driverVehicle, '');
        setAcceptedDriver({ name: dName, phone: dPhone, vehicle: dVehicle, price: priceInr });
        setScreen('driver-accepted');
        if (ownerId) fetchRequests(ownerId);
      } else if (remoteMessage.data?.type === 'TRIP_STATUS_UPDATE') {
        const status = readDataString(remoteMessage.data.status, '');
        if (status === 'completed') {
          // Will be handled by DriverAcceptedScreen's onTripCompleted
        }
      }
    });

    return () => {
      unsubscribeMessage();
    };
  }, []);

  useEffect(() => {
    if (screen === 'my-requests' && ownerId) {
      fetchRequests(ownerId);
    }
  }, [screen, ownerId]);

  useEffect(() => {
    const backAction = () => {
      if (screen === 'home') {
        return false; // Exit app
      }
      
      switch (screen) {
        case 'new-request':
        case 'my-requests':
        case 'browse-companies':
          setScreen('home');
          return true;
        case 'order-detail':
          setScreen('my-requests');
          return true;
        case 'company-detail':
          setScreen('browse-companies');
          return true;
        case 'booking':
          setScreen('company-detail');
          return true;
        case 'waiting':
        case 'driver-accepted':
          setScreen('home');
          return true;
        case 'rate-driver':
          setScreen('home');
          setAcceptedDriver(null);
          setActiveRequestId(null);
          setSelectedCompany(null);
          return true;
        case 'live-tracking':
          setScreen('driver-accepted');
          return true;
        default:
          return false;
      }
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, [screen]);

  const submitRequest = async () => {
    if (!goodsType || !weightKg || !pickupAddress || !dropAddress || !ownerId) {
      Alert.alert('Missing Fields', 'Please fill all shipment details.');
      return;
    }

    setLoading(true);
    const result = await createRequest(
      ownerId,
      goodsType.trim(),
      Number(weightKg),
      pickupAddress.trim(),
      dropAddress.trim(),
    );
    setLoading(false);

    if (result.success) {
      Alert.alert(
        'Request Created',
        `Request ${result.requestId} created. Notified ${result.notifiedCount} transporters.`,
      );
      setGoodsType('');
      setWeightKg('');
      setPickupAddress('');
      setDropAddress('');
      setScreen('home');
    } else {
      Alert.alert('Failed', result.error ?? 'Could not create request');
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Logout', 
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('gozo_owner_id');
          setOwnerId(null);
          setScreen('home');
        }
      }
    ]);
  };

  // ─── Bottom Tab Bar ───
  const BottomTabBar = () => (
    <View style={s.tabBar}>
      <TouchableOpacity style={s.tabItem} onPress={() => setScreen('home')}>
        <Text style={[s.tabIcon, screen === 'home' && s.tabIconActive]}>🏠</Text>
        <Text style={[s.tabLabel, screen === 'home' && s.tabLabelActive]}>Home</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.tabItem} onPress={() => setScreen('my-requests')}>
        <Text style={[s.tabIcon, screen === 'my-requests' && s.tabIconActive]}>📋</Text>
        <Text style={[s.tabLabel, screen === 'my-requests' && s.tabLabelActive]}>Orders</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.tabItem} onPress={() => {}}>
        <Text style={s.tabIcon}>💳</Text>
        <Text style={s.tabLabel}>Payments</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.tabItem} onPress={handleLogout}>
        <Text style={s.tabIcon}>👤</Text>
        <Text style={s.tabLabel}>Logout</Text>
      </TouchableOpacity>
    </View>
  );

  // ─── HOME SCREEN ───
  const renderHome = () => (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Blue Header */}
        <View style={s.blueHeader}>
          <View style={s.headerRow}>
            <Text style={s.logoText}>GoZo</Text>
            <TouchableOpacity style={s.settingsBtn} onPress={handleLogout}>
              <Text style={{ fontSize: 18 }}>🚪</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Pickup Location Card */}
        <View style={s.pickupCard}>
          <View style={s.pickupRow}>
            <View style={s.greenDot} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={s.pickupLabelRow}>
                <Text style={s.pickupLabel}>Pick up from</Text>
                <View style={s.liveGpsBadge}>
                  <Text style={s.liveGpsText}>Live GPS</Text>
                </View>
              </View>
              <Text style={s.pickupAddress} numberOfLines={1}>
                RVW6+MF7, Gill, Patiala Division, Punja...
              </Text>
            </View>
            <Text style={s.chevron}>▼</Text>
          </View>
        </View>

        {/* Service Cards */}
        <View style={s.serviceCardsRow}>
          <TouchableOpacity style={s.serviceCard} onPress={() => setScreen('browse-companies')}>
            <Text style={s.serviceCardIcon}>🚛</Text>
            <Text style={s.serviceCardTitle}>Book a{'\n'}Transport</Text>
            <Text style={s.serviceCardDesc}>Browse companies...</Text>
            <Text style={s.serviceCardArrow}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.serviceCard} onPress={() => setScreen('new-request')}>
            <Text style={s.serviceCardIcon}>🛺</Text>
            <Text style={s.serviceCardTitle}>Quick{'\n'}Shipment</Text>
            <Text style={s.serviceCardDesc}>Direct booking...</Text>
            <Text style={s.serviceCardArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={s.divider} />

        {/* Announcements */}
        <Text style={s.sectionTitle}>Announcements</Text>
        <View style={s.announcementCard}>
          <View style={s.announcementRow}>
            <Text style={{ fontSize: 28 }}>📢</Text>
            <Text style={s.announcementText}>Introducing Gozo Enterprise</Text>
            <TouchableOpacity>
              <Text style={s.viewAllText}>View all</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom spacer */}
        <View style={{ height: 100 }} />
      </ScrollView>
      <BottomTabBar />
    </View>
  );

  // ─── NEW REQUEST SCREEN ───
  const renderNewRequest = () => (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {/* Header */}
      <View style={s.screenHeader}>
        <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.screenTitle}>New Shipment</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        {/* Pickup input */}
        <View style={{ zIndex: 100 }}>
          <AddressInput
            placeholder="Pickup Address"
            value={pickupAddress}
            onChangeText={setPickupAddress}
            dotColor="#22C55E"
            showLocationButton={true}
            onPickFromMap={() => setShowPickupMapPicker(true)}
          />
        </View>

        {/* Drop input */}
        <View style={{ zIndex: 90 }}>
          <AddressInput
            placeholder="Drop Address"
            value={dropAddress}
            onChangeText={setDropAddress}
            dotColor="#1F2937"
            showLocationButton={false}
            onPickFromMap={() => setShowDropMapPicker(true)}
          />
        </View>

        {/* Goods Type */}
        <View style={s.formInputContainer}>
          <Text style={s.formLabel}>Goods Type</Text>
          <TextInput
            style={s.formInput}
            placeholder="e.g. Electronics, Furniture"
            placeholderTextColor="#9CA3AF"
            value={goodsType}
            onChangeText={setGoodsType}
          />
        </View>

        {/* Weight */}
        <View style={s.formInputContainer}>
          <Text style={s.formLabel}>Weight (kg)</Text>
          <TextInput
            style={s.formInput}
            placeholder="e.g. 500"
            placeholderTextColor="#9CA3AF"
            value={weightKg}
            keyboardType="numeric"
            onChangeText={setWeightKg}
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[s.submitBtn, loading && { opacity: 0.6 }]}
          disabled={loading}
          onPress={submitRequest}
        >
          <Text style={s.submitBtnText}>{loading ? 'Submitting...' : '🚛  Find Transporters'}</Text>
        </TouchableOpacity>
      </ScrollView>

      <MapLocationPicker
        visible={showPickupMapPicker}
        onClose={() => setShowPickupMapPicker(false)}
        onConfirm={(loc) => {
          setPickupAddress(loc.address);
          setShowPickupMapPicker(false);
        }}
      />
      <MapLocationPicker
        visible={showDropMapPicker}
        onClose={() => setShowDropMapPicker(false)}
        onConfirm={(loc) => {
          setDropAddress(loc.address);
          setShowDropMapPicker(false);
        }}
      />
    </View>
  );

  // ─── MY REQUESTS SCREEN ───
  const renderMyRequests = () => (
    <View style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
      {/* Header */}
      <View style={s.screenHeader}>
        <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={s.screenTitle}>My Orders</Text>
          <Text style={s.screenSubtitle}>{requests.length} shipments</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Results count banner */}
      <View style={s.resultsBanner}>
        <View>
          <Text style={s.resultsBannerTitle}>{requests.length} orders found</Text>
          <Text style={s.resultsBannerSub}>Track your goods movement</Text>
        </View>
        <Text style={{ fontSize: 28 }}>📦</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {requests.map((item) => (
          <TouchableOpacity key={item.id} style={s.orderCard} onPress={() => { setSelectedOrderId(item.id); setScreen('order-detail'); }} activeOpacity={0.7}>
            {/* Status pill */}
            <View style={[s.orderStatusPill, { backgroundColor: statusColorMap[item.status] ?? '#607D8B' }]}>
              <Text style={s.orderStatusText}>{item.status === 'matched' ? '✓ Matched' : item.status.toUpperCase()}</Text>
            </View>

            {/* Goods info */}
            <Text style={s.orderGoodsTitle}>{item.goods_type}</Text>
            <Text style={s.orderMeta}>{item.weight_kg} kg</Text>

            {/* Route */}
            <View style={s.routeContainer}>
              <View style={s.routeDots}>
                <View style={s.greenDotSmall} />
                <View style={s.routeLine} />
                <View style={s.blackDotSmall} />
              </View>
              <View style={s.routeTexts}>
                <View style={s.routeItem}>
                  <Text style={s.routeLabel}>Pickup</Text>
                  <Text style={s.routeAddress}>{item.pickup_address}</Text>
                </View>
                <View style={[s.routeItem, { marginTop: 16 }]}>
                  <Text style={s.routeLabel}>Drop</Text>
                  <Text style={s.routeAddress}>{item.drop_address}</Text>
                </View>
              </View>
            </View>

            {item.status === 'matched' && item.accepted_price && (
              <View style={s.matchedBanner}>
                <Text style={s.matchedBannerText}>✅ Matched at ₹{item.accepted_price}</Text>
              </View>
            )}

            <View style={s.viewDetailsRow}>
              <Text style={s.viewDetailsText}>View Details  →</Text>
            </View>
          </TouchableOpacity>
        ))}
        {requests.length === 0 && (
          <View style={s.emptyState}>
            <Text style={{ fontSize: 48 }}>📭</Text>
            <Text style={s.emptyStateText}>No orders found</Text>
            <Text style={s.emptyStateSub}>Create a new shipment request to get started</Text>
          </View>
        )}
      </ScrollView>
      <BottomTabBar />
    </View>
  );

  const handleCompanySelect = (company: Company) => {
    setSelectedCompany(company);
    setScreen('company-detail');
  };

  const handleBookingConfirm = async (data: BookingData) => {
    if (!ownerId) return;
    setScreen('waiting');
    setLoading(true);
    setBookingPickup(data.pickupAddress);
    setBookingDrop(data.dropAddress);
    const result = await createRequest(
      ownerId,
      `${data.vehicleName} shipment`,
      data.weightKg,
      data.pickupAddress,
      data.dropAddress,
    );
    setLoading(false);
    if (result.success) {
      setActiveRequestId(result.requestId);
    } else {
      Alert.alert('Failed', result.error ?? 'Could not create request');
      setScreen('home');
    }
  };

  if (!isAppReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1A56DB', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FFF" />
      </View>
    );
  }

  if (!ownerId) {
    return <AuthScreens onLoginSuccess={async (id) => {
      await AsyncStorage.setItem('gozo_owner_id', id);
      setOwnerId(id);
    }} />;
  }

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A56DB" />
      {screen === 'home' && renderHome()}
      {screen === 'new-request' && renderNewRequest()}
      {screen === 'my-requests' && renderMyRequests()}
      {screen === 'browse-companies' && (
        <BrowseCompaniesScreen onBack={() => setScreen('home')} onSelectCompany={handleCompanySelect} />
      )}
      {screen === 'company-detail' && selectedCompany && (
        <CompanyDetailScreen company={selectedCompany} onBack={() => setScreen('browse-companies')} onBookNow={() => setScreen('booking')} />
      )}
      {screen === 'booking' && selectedCompany && (
        <BookingScreen company={selectedCompany} onBack={() => setScreen('company-detail')} onConfirmBooking={handleBookingConfirm} />
      )}
      {screen === 'waiting' && selectedCompany && activeRequestId && (
        <WaitingScreen 
          onBack={() => setScreen('home')} 
          companyName={selectedCompany.name} 
          requestId={activeRequestId}
          onDriverAccepted={(details) => {
            setAcceptedDriver(details);
            setScreen('driver-accepted');
          }}
        />
      )}
      {screen === 'driver-accepted' && acceptedDriver && activeRequestId && (
        <DriverAcceptedScreen
          requestId={activeRequestId}
          driverName={acceptedDriver.name}
          driverPhone={acceptedDriver.phone}
          driverVehicle={acceptedDriver.vehicle}
          priceInr={acceptedDriver.price}
          onBack={() => setScreen('home')}
          onTripCompleted={(reqId) => { setScreen('rate-driver'); }}
          onTrackDriver={() => setScreen('live-tracking')}
        />
      )}
      {screen === 'rate-driver' && acceptedDriver && activeRequestId && (
        <RateDriverScreen
          requestId={activeRequestId}
          driverName={acceptedDriver.name}
          onDone={() => { setScreen('home'); setAcceptedDriver(null); setActiveRequestId(null); setSelectedCompany(null); }}
        />
      )}
      {screen === 'order-detail' && selectedOrderId && (
        <OrderDetailScreen
          requestId={selectedOrderId}
          onBack={() => setScreen('my-requests')}
        />
      )}
      {screen === 'live-tracking' && acceptedDriver && activeRequestId && (
        <LiveTrackingScreen
          requestId={activeRequestId}
          driverName={acceptedDriver.name}
          driverPhone={acceptedDriver.phone}
          pickupAddress={bookingPickup}
          dropAddress={bookingDrop}
          tripStatus={'matched'}
          onBack={() => setScreen('driver-accepted')}
        />
      )}
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },

  // ─── Blue Header ───
  blueHeader: { backgroundColor: '#1A56DB', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoText: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1 },
  settingsBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  statusChip: { flexDirection: 'row', alignItems: 'center', marginTop: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusChipText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },

  // ─── Pickup Card ───
  pickupCard: { marginHorizontal: 16, marginTop: -14, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
  pickupRow: { flexDirection: 'row', alignItems: 'center' },
  greenDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#22C55E', borderWidth: 3, borderColor: '#BBF7D0' },
  pickupLabelRow: { flexDirection: 'row', alignItems: 'center' },
  pickupLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  liveGpsBadge: { marginLeft: 8, backgroundColor: '#DBEAFE', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  liveGpsText: { fontSize: 10, fontWeight: '700', color: '#1D4ED8' },
  pickupAddress: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  chevron: { fontSize: 14, color: '#6B7280', marginLeft: 8 },

  // ─── Service Cards ───
  serviceCardsRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 18, gap: 12 },
  serviceCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, borderWidth: 1, borderColor: '#F3F4F6' },
  serviceCardIcon: { fontSize: 40, marginBottom: 8 },
  serviceCardTitle: { fontSize: 14, fontWeight: '700', color: '#111827', lineHeight: 20 },
  serviceCardDesc: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  serviceCardArrow: { fontSize: 18, color: '#1A56DB', fontWeight: '700', marginTop: 6, alignSelf: 'flex-end' },

  // ─── Divider ───
  divider: { height: 8, backgroundColor: '#F3F4F6', marginTop: 20 },

  // ─── Announcements ───
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginHorizontal: 16, marginTop: 16, marginBottom: 10 },
  announcementCard: { marginHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, borderWidth: 1, borderColor: '#F3F4F6' },
  announcementRow: { flexDirection: 'row', alignItems: 'center' },
  announcementText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827', marginLeft: 12 },
  viewAllText: { fontSize: 13, fontWeight: '700', color: '#1A56DB' },

  // ─── Bottom Tab Bar ───
  tabBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingVertical: 8, paddingBottom: 12, elevation: 10 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabIcon: { fontSize: 22, opacity: 0.5 },
  tabIconActive: { opacity: 1 },
  tabLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 2, fontWeight: '500' },
  tabLabelActive: { color: '#1A56DB', fontWeight: '700' },

  // ─── Screen Headers ───
  screenHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backArrow: { fontSize: 24, color: '#111827', fontWeight: '300' },
  screenTitle: { fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  screenSubtitle: { fontSize: 12, color: '#6B7280', textAlign: 'center' },

  // ─── New Request Form ───
  searchInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', paddingHorizontal: 14, paddingVertical: 4, marginBottom: 14 },
  greenDotSmall: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#22C55E' },
  blackDotSmall: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#1F2937' },
  searchInput: { flex: 1, fontSize: 15, color: '#111827', paddingVertical: 12, marginLeft: 12 },
  formInputContainer: { marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginLeft: 4 },
  formInput: { backgroundColor: '#F9FAFB', borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827' },
  submitBtn: { backgroundColor: '#1A56DB', borderRadius: 14, paddingVertical: 16, marginTop: 10, elevation: 2 },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', textAlign: 'center' },

  // ─── My Requests / Orders ───
  resultsBanner: { marginHorizontal: 16, marginTop: 12, backgroundColor: '#1A56DB', borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultsBannerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  resultsBannerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  orderCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, borderWidth: 1, borderColor: '#F3F4F6' },
  orderStatusPill: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8 },
  orderStatusText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  orderGoodsTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  orderMeta: { fontSize: 13, color: '#6B7280', marginTop: 2, marginBottom: 12 },
  routeContainer: { flexDirection: 'row', marginTop: 4, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  routeDots: { alignItems: 'center', marginRight: 12, paddingTop: 4 },
  routeLine: { width: 2, height: 28, backgroundColor: '#D1D5DB', marginVertical: 4 },
  routeTexts: { flex: 1 },
  routeItem: {},
  routeLabel: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  routeAddress: { fontSize: 14, fontWeight: '600', color: '#111827', marginTop: 2 },
  matchedBanner: { marginTop: 12, backgroundColor: '#DCFCE7', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#86EFAC' },
  matchedBannerText: { color: '#166534', fontWeight: '700', fontSize: 14 },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyStateText: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 12 },
  emptyStateSub: { fontSize: 14, color: '#9CA3AF', marginTop: 4, textAlign: 'center' },
  viewDetailsRow: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12, alignItems: 'flex-end' },
  viewDetailsText: { fontSize: 13, fontWeight: '700', color: '#1A56DB' },
});

export default App;
