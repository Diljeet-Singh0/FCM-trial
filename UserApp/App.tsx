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
  PermissionsAndroid,
  Platform,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './src/config';
import { createRequest, fetchMyRequests, fetchPriceEstimate, createScheduledRide } from './src/api';
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
import SettingsScreen from './src/screens/SettingsScreen';
import { MAPBOX_ACCESS_TOKEN } from './src/secrets';
import { CertificateScreen } from './src/screens/CertificateScreen';
import { ScheduleRideScreen } from './src/screens/ScheduleRideScreen';
import { ScheduledRidesScreen } from './src/screens/ScheduledRidesScreen';
import { ScheduledRideDetailScreen } from './src/screens/ScheduledRideDetailScreen';

type Screen = 'home' | 'new-request' | 'my-requests' | 'browse-companies' | 'company-detail' | 'booking' | 'waiting' | 'driver-accepted' | 'rate-driver' | 'live-tracking' | 'order-detail' | 'settings' | 'certificate' | 'schedule-ride' | 'scheduled-rides' | 'scheduled-ride-detail';
type RegistrationStatus = 'pending' | 'registered' | 'error';


type RequestItem = {
  id: string;
  goods_type: string;
  weight_kg: number;
  pickup_address: string;
  drop_address: string;
  status: 'pending' | 'matched' | 'picked_up' | 'on_the_way' | 'completed' | 'cancelled';
  transporter_id?: string;
  accepted_price?: number;
  driver_name?: string;
  driver_phone?: string;
  driver_vehicle?: string;
  created_at?: string;
};

const STATUS_LABELS: Record<string, string> = {
  pending: '⏳ Pending',
  matched: '✓ Driver Assigned',
  picked_up: '📦 Picked Up',
  on_the_way: '🚛 On the Way',
  completed: '🎉 Delivered',
  cancelled: '✕ Cancelled',
};

const statusColorMap: Record<string, string> = {
  pending: '#F59E0B',
  matched: '#10B981',
  picked_up: '#10B981',
  on_the_way: '#10B981',
  completed: '#10B981',
  cancelled: '#E53935',
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
  const [priceEstimate, setPriceEstimate] = useState<{ serviceFee: number, rangeMin: number, rangeMax: number } | null>(null);
  const [distanceKmQuick, setDistanceKmQuick] = useState<number | undefined>(undefined);

  // New booking flow state
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [acceptedDriver, setAcceptedDriver] = useState<{ name: string; phone: string; vehicle: string; price: string } | null>(null);
  const [bookingPickup, setBookingPickup] = useState('');
  const [bookingDrop, setBookingDrop] = useState('');
  const [showPickupMapPicker, setShowPickupMapPicker] = useState(false);
  const [showDropMapPicker, setShowDropMapPicker] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [certificateTripId, setCertificateTripId] = useState<string | null>(null);
  const [trackingSourceScreen, setTrackingSourceScreen] = useState<'driver-accepted' | 'order-detail'>('driver-accepted');
  const [liveTrackingStatus, setLiveTrackingStatus] = useState('matched');

  // Scheduling mode state
  const [isScheduling, setIsScheduling] = useState(false);

  // Live GPS location for home screen pickup card
  const [liveAddress, setLiveAddress] = useState<string>('Fetching location...');
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [selectedScheduledRideId, setSelectedScheduledRideId] = useState<string | null>(null);

  const fetchRequests = async (ownerIdValue: string) => {
    // 1. Instantly load from cache to ensure 0ms load speed
    try {
      const cached = await AsyncStorage.getItem('gozo_cached_requests');
      if (cached) {
        setRequests(JSON.parse(cached));
      }
    } catch (e) {
      console.warn('Failed to load cached requests', e);
    }

    // 2. Fetch fresh requests from server in background
    const response = await fetchMyRequests(ownerIdValue);
    if (response.success) {
      setRequests(response.requests);
      try {
        await AsyncStorage.setItem('gozo_cached_requests', JSON.stringify(response.requests));
      } catch (e) {
        console.warn('Failed to save requests cache', e);
      }
    } else if (response.error) {
      // Do not alert on background fetch failure if we already have cached data
      const cached = await AsyncStorage.getItem('gozo_cached_requests');
      if (!cached) {
        Alert.alert('Error', response.error);
      }
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const storedId = await AsyncStorage.getItem('gozo_owner_id');
        if (storedId) {
          setOwnerId(storedId);
          // Load cached requests immediately during bootstrap
          const cached = await AsyncStorage.getItem('gozo_cached_requests');
          if (cached) {
            setRequests(JSON.parse(cached));
          }
        }
      } catch (e) {
        console.warn('Failed to load session', e);
      } finally {
        setIsAppReady(true);
      }
    };
    bootstrap();

    // ─── Live GPS Location ───
    const fetchLiveLocation = async () => {
      try {
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Location Permission',
              message: 'GoZo needs your location to show your pickup point.',
              buttonPositive: 'Allow',
              buttonNegative: 'Deny',
            },
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            setLiveAddress('Location permission denied');
            setIsLoadingLocation(false);
            return;
          }
        }
        Geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords;
            try {
              const res = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=1&types=address,neighborhood,locality,place`
              );
              const data = await res.json();
              if (data.features && data.features.length > 0) {
                setLiveAddress(data.features[0].place_name);
              } else {
                setLiveAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
              }
            } catch {
              setLiveAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
            } finally {
              setIsLoadingLocation(false);
            }
          },
          (err) => {
            console.warn('Geolocation error:', err.message);
            setLiveAddress('Unable to get location');
            setIsLoadingLocation(false);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
        );
      } catch (e) {
        setLiveAddress('Location unavailable');
        setIsLoadingLocation(false);
      }
    };
    fetchLiveLocation();

    const unsubscribeMessage = messaging().onMessage(async (remoteMessage) => {
      const messageType = readDataString(remoteMessage.data?.type);
      if (messageType === 'REQUEST_ACCEPTED') {
        const priceInr = readDataString(remoteMessage.data?.priceInr, '0');
        const dName = readDataString(remoteMessage.data?.driverName, 'Driver');
        const dPhone = readDataString(remoteMessage.data?.driverPhone, '');
        const dVehicle = readDataString(remoteMessage.data?.driverVehicle, '');
        setAcceptedDriver({ name: dName, phone: dPhone, vehicle: dVehicle, price: priceInr });
        setScreen('driver-accepted');
        if (ownerId) fetchRequests(ownerId);
      } else if (messageType === 'TRIP_STATUS_UPDATE') {
        const status = readDataString(remoteMessage.data?.status, '');
        if (status === 'completed') {
          // Will be handled by DriverAcceptedScreen's onTripCompleted
        }
      } else if (messageType === 'CERTIFICATE_ISSUED') {
        const tripId = readDataString(remoteMessage.data?.tripId);
        if (tripId) {
          Alert.alert(
            '📋 Certificate Issued',
            'Your Goods Responsibility Certificate has been issued. View it now?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'View',
                onPress: () => {
                  setCertificateTripId(tripId);
                  setScreen('certificate');
                },
              },
            ]
          );
        }
      } else if (messageType.startsWith('scheduled_ride_')) {
        const rideId = readDataString(remoteMessage.data?.rideId);
        const title = remoteMessage.notification?.title || 'Scheduled Ride Update';
        const body = remoteMessage.notification?.body || 'There is a new update on your scheduled ride.';
        if (rideId) {
          Alert.alert(
            title,
            body,
            [
              { text: 'Later', style: 'cancel' },
              {
                text: 'View Details',
                onPress: () => {
                  setSelectedScheduledRideId(rideId);
                  setScreen('scheduled-ride-detail');
                }
              }
            ]
          );
        }
      }
    });

    // Background notification tap handler (warm start)
    const unsubscribeNotificationOpened = messaging().onNotificationOpenedApp((remoteMessage) => {
      const messageType = readDataString(remoteMessage.data?.type);
      if (messageType === 'CERTIFICATE_ISSUED') {
        const tripId = readDataString(remoteMessage.data?.tripId);
        if (tripId) {
          setCertificateTripId(tripId);
          setScreen('certificate');
        }
      } else if (messageType.startsWith('scheduled_ride_')) {
        const rideId = readDataString(remoteMessage.data?.rideId);
        if (rideId) {
          setSelectedScheduledRideId(rideId);
          setScreen('scheduled-ride-detail');
        }
      }
    });

    // Cold start notification tap handler
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          const messageType = readDataString(remoteMessage.data?.type);
          if (messageType === 'CERTIFICATE_ISSUED') {
            const tripId = readDataString(remoteMessage.data?.tripId);
            if (tripId) {
              setCertificateTripId(tripId);
            }
          } else if (messageType.startsWith('scheduled_ride_')) {
            const rideId = readDataString(remoteMessage.data?.rideId);
            if (rideId) {
              setSelectedScheduledRideId(rideId);
              setScreen('scheduled-ride-detail');
            }
          }
        }
      });


    return () => {
      unsubscribeMessage();
      unsubscribeNotificationOpened();
    };
  }, [ownerId]);


  useEffect(() => {
    if (screen === 'my-requests' && ownerId) {
      fetchRequests(ownerId);
    }
  }, [screen, ownerId]);

  useEffect(() => {
    if (isAppReady && ownerId && certificateTripId) {
      setScreen('certificate');
    }
  }, [isAppReady, ownerId, certificateTripId]);


  useEffect(() => {
    const getEstimate = async () => {
      if (goodsType.length > 2 && weightKg && !isNaN(Number(weightKg))) {
        let dist: number | undefined = undefined;
        if (pickupAddress.length > 5 && dropAddress.length > 5) {
          try {
            let pLng = 0, pLat = 0, dLng = 0, dLat = 0;
            const pRes = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(pickupAddress)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=1`);
            const pData = await pRes.json();
            if (pData.features && pData.features.length > 0) {
              [pLng, pLat] = pData.features[0].center;
            }

            const dRes = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(dropAddress)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=1`);
            const dData = await dRes.json();
            if (dData.features && dData.features.length > 0) {
              [dLng, dLat] = dData.features[0].center;
            }

            if (pLng && dLng) {
              const dirRes = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${pLng},${pLat};${dLng},${dLat}?access_token=${MAPBOX_ACCESS_TOKEN}`);
              const dirData = await dirRes.json();
              if (dirData.routes && dirData.routes.length > 0) {
                dist = dirData.routes[0].distance / 1000;
              }
            }
          } catch (e) {
            console.warn('Failed to calculate distance for quick shipment', e);
          }
        }
        setDistanceKmQuick(dist);

        const res = await fetchPriceEstimate(goodsType, Number(weightKg), dist);
        if (res.success && res.estimate) {
          setPriceEstimate({
            serviceFee: res.estimate.serviceFee,
            rangeMin: res.estimate.rangeMin,
            rangeMax: res.estimate.rangeMax
          });
        }
      } else {
        setPriceEstimate(null);
        setDistanceKmQuick(undefined);
      }
    };
    const timeoutId = setTimeout(getEstimate, 800);
    return () => clearTimeout(timeoutId);
  }, [goodsType, weightKg, pickupAddress, dropAddress]);

  useEffect(() => {
    const backAction = () => {
      if (screen === 'home') {
        return false; // Exit app
      }

      switch (screen) {
        case 'new-request':
        case 'my-requests':
        case 'browse-companies':
        case 'settings':
          setIsScheduling(false);
          setScreen('home');
          return true;
        case 'order-detail':
          setScreen('my-requests');
          return true;
        case 'certificate':
          if (selectedOrderId) {
            setScreen('order-detail');
          } else {
            setScreen('my-requests');
          }
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
      distanceKmQuick,
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
      <TouchableOpacity style={s.tabItem} onPress={() => setScreen('scheduled-rides')}>
        <Text style={[s.tabIcon, (screen === 'scheduled-rides' || screen === 'scheduled-ride-detail') && s.tabIconActive]}>📅</Text>
        <Text style={[s.tabLabel, (screen === 'scheduled-rides' || screen === 'scheduled-ride-detail') && s.tabLabelActive]}>Scheduled</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.tabItem} onPress={() => setScreen('settings')}>
        <Text style={[s.tabIcon, screen === 'settings' && s.tabIconActive]}>⚙️</Text>
        <Text style={[s.tabLabel, screen === 'settings' && s.tabLabelActive]}>Settings</Text>
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
            <TouchableOpacity style={s.settingsBtn} onPress={() => setScreen('settings')}>
              <Text style={{ fontSize: 18 }}>⚙️</Text>
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
                {isLoadingLocation ? 'Fetching location...' : liveAddress}
              </Text>
            </View>
            <Text style={s.chevron}>▼</Text>
          </View>
        </View>

        {/* Service Cards */}
        <View style={s.serviceCardsRow}>
          <TouchableOpacity style={s.serviceCard} onPress={() => {
            setIsScheduling(false);
            setScreen('browse-companies');
          }}>
            <Text style={s.serviceCardIcon}>🚛</Text>
            <Text style={s.serviceCardTitle}>Book a{'\n'}Transport</Text>
            <Text style={s.serviceCardDesc}>Browse companies...</Text>
            <Text style={s.serviceCardArrow}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.serviceCard} onPress={() => {
            setIsScheduling(false);
            setScreen('new-request');
          }}>
            <Text style={s.serviceCardIcon}>🛺</Text>
            <Text style={s.serviceCardTitle}>Quick{'\n'}Shipment</Text>
            <Text style={s.serviceCardDesc}>Direct booking...</Text>
            <Text style={s.serviceCardArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Scheduled Ride Service Card */}
        <TouchableOpacity
          style={[
            s.serviceCard,
            {
              marginHorizontal: 20,
              marginTop: 14,
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16
            }
          ]}
          onPress={() => {
            setIsScheduling(true);
            setScreen('browse-companies');
          }}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: 32, marginRight: 16 }}>📅</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.serviceCardTitle, { fontSize: 15 }]}>Schedule a Future Ride</Text>
            <Text style={[s.serviceCardDesc, { marginTop: 2 }]}>Book 2 hours to 7 days in advance</Text>
          </View>
          <Text style={[s.serviceCardArrow, { alignSelf: 'center', marginTop: 0 }]}>→</Text>
        </TouchableOpacity>

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

        {/* Price Estimate */}
        {priceEstimate && (
          <View style={s.estimateCard}>
            <Text style={s.estimateTitle}>Estimated Pricing</Text>
            <View style={s.estimateRow}>
              <Text style={s.estimateLabel}>Estimated Freight (Pay to Driver)</Text>
              <Text style={s.estimateValue}>₹{priceEstimate.rangeMin} - ₹{priceEstimate.rangeMax}</Text>
            </View>
            <View style={s.estimateRow}>
              <Text style={s.estimateLabel}>Booking Fee</Text>
              <Text style={s.estimateValue}>₹{priceEstimate.serviceFee}</Text>
            </View>
          </View>
        )}

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
    <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
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
          <Text style={s.resultsBannerSub}>goods movement</Text>
        </View>
        <Text style={{ fontSize: 28 }}>📦</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {requests.map((item) => {
          const isOngoing = item.status === 'matched' || item.status === 'picked_up' || item.status === 'on_the_way';
          return (
            <TouchableOpacity key={item.id} style={[s.orderCard, isOngoing && s.orderCardOngoing]} onPress={() => { setSelectedOrderId(item.id); setScreen('order-detail'); }} activeOpacity={0.7}>
              {/* Status pill */}
              <View style={[s.orderStatusPill, { backgroundColor: statusColorMap[item.status] ?? '#607D8B' }]}>
                <Text style={s.orderStatusText}>{STATUS_LABELS[item.status] || item.status.toUpperCase()}</Text>
              </View>

              {/* Ongoing indicator */}
              {isOngoing && (
                <View style={s.ongoingBadge}>
                  <View style={s.ongoingDot} />
                  <Text style={s.ongoingText}>LIVE · Trip in progress</Text>
                </View>
              )}

              {/* Goods info */}
              <Text style={s.orderGoodsTitle}>{item.goods_type}</Text>
              <Text style={s.orderMeta}>{item.weight_kg} kg</Text>

              {/* Driver info for assigned trips */}
              {item.driver_name && (
                <View style={s.orderDriverRow}>
                  <View style={s.orderDriverAvatar}>
                    <Text style={s.orderDriverAvatarText}>{item.driver_name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={s.orderDriverName}>{item.driver_name}</Text>
                    {item.driver_phone ? <Text style={s.orderDriverPhone}>📞 {item.driver_phone}</Text> : null}
                    {item.driver_vehicle ? <Text style={s.orderDriverPhone}>🚛 {item.driver_vehicle}</Text> : null}
                  </View>
                  {item.accepted_price ? (
                    <Text style={s.orderDriverPrice}>₹{item.accepted_price}</Text>
                  ) : null}
                </View>
              )}

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

              {item.status === 'matched' && item.accepted_price && !item.driver_name && (
                <View style={s.matchedBanner}>
                  <Text style={s.matchedBannerText}>✅ Matched at ₹{item.accepted_price}</Text>
                </View>
              )}

              <View style={s.viewDetailsRow}>
                <Text style={s.viewDetailsText}>{isOngoing ? 'View Full Details  →' : 'View Details  →'}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
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

    if (isScheduling && data.scheduledTime) {
      setLoading(true);
      const res = await createScheduledRide({
        user_id: ownerId,
        pickup_location: data.pickupAddress,
        drop_location: data.dropAddress,
        goods_description: `${data.vehicleName} shipment`,
        scheduled_time: data.scheduledTime,
        company_id: data.companyId,
      });
      setLoading(false);
      if (res.success) {
        Alert.alert('Success 🎉', `Ride scheduled successfully!\nBooking ID: ${res.ride?.booking_id}`, [
          {
            text: 'OK',
            onPress: () => {
              setIsScheduling(false);
              setScreen('scheduled-rides');
            }
          }
        ]);
      } else {
        Alert.alert('Scheduling Failed', res.error || 'Unknown error');
        setScreen('home');
        setIsScheduling(false);
      }
      return;
    }

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
      data.distanceKm,
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
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#10B981" />
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
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {screen === 'home' && renderHome()}
      {screen === 'new-request' && renderNewRequest()}
      {screen === 'my-requests' && renderMyRequests()}
      {screen === 'browse-companies' && (
        <BrowseCompaniesScreen onBack={() => setScreen('home')} onSelectCompany={handleCompanySelect} ownerId={ownerId} />
      )}
      {screen === 'company-detail' && selectedCompany && (
        <CompanyDetailScreen company={selectedCompany} onBack={() => setScreen('browse-companies')} onBookNow={() => setScreen('booking')} />
      )}
      {screen === 'booking' && selectedCompany && (
        <BookingScreen company={selectedCompany} onBack={() => setScreen('company-detail')} onConfirmBooking={handleBookingConfirm} isScheduling={isScheduling} />
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
          onTrackDriver={() => {
            setTrackingSourceScreen('driver-accepted');
            setLiveTrackingStatus('matched');
            setScreen('live-tracking');
          }}
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
          onViewCertificate={(tripId) => {
            setCertificateTripId(tripId);
            setSelectedOrderId(tripId);
            setScreen('certificate');
          }}
          onTrackDriver={(driverName, driverPhone, pickupAddress, dropAddress, tripStatus) => {
            setAcceptedDriver({
              name: driverName,
              phone: driverPhone,
              vehicle: '',
              price: '',
            });
            setActiveRequestId(selectedOrderId);
            setBookingPickup(pickupAddress);
            setBookingDrop(dropAddress);
            setTrackingSourceScreen('order-detail');
            setLiveTrackingStatus(tripStatus);
            setScreen('live-tracking');
          }}
        />
      )}
      {screen === 'certificate' && certificateTripId && (
        <CertificateScreen
          tripId={certificateTripId}
          onBack={() => {
            if (selectedOrderId) {
              setScreen('order-detail');
            } else {
              setScreen('my-requests');
            }
          }}
        />
      )}
      {screen === 'settings' && ownerId && (
        <SettingsScreen
          ownerId={ownerId}
          onBack={() => setScreen('home')}
          onLogout={async () => {
            await AsyncStorage.removeItem('gozo_owner_id');
            setOwnerId(null);
            setScreen('home');
          }}
        />
      )}
      {screen === 'live-tracking' && acceptedDriver && activeRequestId && (
        <LiveTrackingScreen
          requestId={activeRequestId}
          driverName={acceptedDriver.name}
          driverPhone={acceptedDriver.phone}
          pickupAddress={bookingPickup}
          dropAddress={bookingDrop}
          tripStatus={liveTrackingStatus}
          onBack={() => setScreen(trackingSourceScreen)}
        />
      )}
      {screen === 'schedule-ride' && ownerId && (
        <ScheduleRideScreen
          userId={ownerId}
          onBack={() => setScreen('home')}
          onSuccess={() => setScreen('scheduled-rides')}
        />
      )}
      {screen === 'scheduled-rides' && ownerId && (
        <ScheduledRidesScreen
          userId={ownerId}
          onBack={() => setScreen('home')}
          onSelectRide={(rideId) => {
            setSelectedScheduledRideId(rideId);
            setScreen('scheduled-ride-detail');
          }}
        />
      )}
      {screen === 'scheduled-ride-detail' && selectedScheduledRideId && (
        <ScheduledRideDetailScreen
          rideId={selectedScheduledRideId}
          onBack={() => setScreen('scheduled-rides')}
        />
      )}
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },

  // ─── Elegant White Header ───
  blueHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 24 : 32,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoText: { fontSize: 28, fontWeight: '900', color: '#10B981', letterSpacing: 1.5, textTransform: 'uppercase' },
  settingsBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  statusChip: { flexDirection: 'row', alignItems: 'center', marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#E6F7F0', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusChipText: { color: '#10B981', fontSize: 12, fontWeight: '600' },

  // ─── Premium Floating Location Card ───
  pickupCard: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  pickupRow: { flexDirection: 'row', alignItems: 'center' },
  greenDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#10B981', borderWidth: 4, borderColor: '#D1FAE5' },
  pickupLabelRow: { flexDirection: 'row', alignItems: 'center' },
  pickupLabel: { fontSize: 13, fontWeight: '800', color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: 0.8 },
  liveGpsBadge: { marginLeft: 8, backgroundColor: '#E6F7F0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  liveGpsText: { fontSize: 10, fontWeight: '700', color: '#10B981', letterSpacing: 0.4 },
  pickupAddress: { fontSize: 15, color: '#1A1A1A', fontWeight: '700', marginTop: 4 },
  chevron: { fontSize: 14, color: '#6B6B6B', marginLeft: 8 },

  // ─── Refactored Service Cards ───
  serviceCardsRow: { flexDirection: 'row', marginHorizontal: 20, marginTop: 20, gap: 14 },
  serviceCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  serviceCardIcon: { fontSize: 44, marginBottom: 12 },
  serviceCardTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A1A', lineHeight: 22 },
  serviceCardDesc: { fontSize: 12, color: '#6B6B6B', marginTop: 6, fontWeight: '500' },
  serviceCardArrow: { fontSize: 18, color: '#10B981', fontWeight: '700', marginTop: 10, alignSelf: 'flex-end' },

  // ─── Divider ───
  divider: { height: 8, backgroundColor: '#F5F5F5', marginTop: 28 },

  // ─── Premium Announcements Card ───
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#1A1A1A', marginHorizontal: 20, marginTop: 24, marginBottom: 12, letterSpacing: 0.2 },
  announcementCard: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6
  },
  announcementRow: { flexDirection: 'row', alignItems: 'center' },
  announcementText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginLeft: 14 },
  viewAllText: { fontSize: 14, fontWeight: '800', color: '#10B981' },

  // ─── Modern Floating Bottom Tab Bar ───
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingVertical: 10,
    paddingBottom: 22,
    elevation: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.05,
    shadowRadius: 12
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabIcon: { fontSize: 22, opacity: 0.4 },
  tabIconActive: { opacity: 1 },
  tabLabel: { fontSize: 11, color: '#6B6B6B', marginTop: 4, fontWeight: '600' },
  tabLabelActive: { color: '#10B981', fontWeight: '800' },

  // ─── Premium Screen Headers ───
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  backArrow: { fontSize: 20, color: '#1A1A1A', fontWeight: '700' },
  screenTitle: { fontSize: 19, fontWeight: '800', color: '#1A1A1A', textAlign: 'center' },
  screenSubtitle: { fontSize: 13, color: '#6B6B6B', textAlign: 'center', marginTop: 2, fontWeight: '500' },

  // ─── New Request Form ───
  searchInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 4, marginBottom: 14 },
  greenDotSmall: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#10B981' },
  blackDotSmall: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#1A1A1A' },
  searchInput: { flex: 1, fontSize: 15, color: '#1A1A1A', paddingVertical: 12, marginLeft: 12, fontWeight: '500' },
  formInputContainer: { marginBottom: 18 },
  formLabel: { fontSize: 13, fontWeight: '700', color: '#6B6B6B', marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  formInput: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 16, paddingVertical: 15, fontSize: 15, color: '#1A1A1A', fontWeight: '500' },
  submitBtn: {
    backgroundColor: '#10B981',
    borderRadius: 28,
    paddingVertical: 18,
    marginTop: 12,
    elevation: 2,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', textAlign: 'center', letterSpacing: 0.2 },
  estimateCard: { backgroundColor: '#FFFFFF', padding: 18, borderRadius: 12, marginBottom: 18, borderWidth: 1, borderColor: '#E2E8F0' },
  estimateTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A1A', marginBottom: 12 },
  estimateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  estimateLabel: { fontSize: 13, color: '#6B6B6B', fontWeight: '500' },
  estimateValue: { fontSize: 15, fontWeight: '800', color: '#10B981' },

  // ─── My Requests / Orders ───
  resultsBanner: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6
  },
  resultsBannerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  resultsBannerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 3, fontWeight: '500' },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  orderStatusPill: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 10 },
  orderStatusText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  orderGoodsTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A1A' },
  orderMeta: { fontSize: 14, color: '#6B6B6B', marginTop: 3, marginBottom: 14, fontWeight: '500' },
  routeContainer: { flexDirection: 'row', marginTop: 4, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  routeDots: { alignItems: 'center', marginRight: 12, paddingTop: 4 },
  routeLine: { width: 2, height: 32, backgroundColor: '#E2E8F0', marginVertical: 4 },
  routeTexts: { flex: 1 },
  routeItem: {},
  routeLabel: { fontSize: 11, fontWeight: '800', color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: 0.8 },
  routeAddress: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginTop: 3 },
  matchedBanner: { marginTop: 12, backgroundColor: '#E6F7F0', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#A7F3D0' },
  matchedBannerText: { color: '#10B981', fontWeight: '800', fontSize: 14 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyStateText: { fontSize: 19, fontWeight: '800', color: '#1A1A1A', marginTop: 14 },
  emptyStateSub: { fontSize: 14, color: '#6B6B6B', marginTop: 6, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },
  viewDetailsRow: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 14, alignItems: 'flex-end' },
  viewDetailsText: { fontSize: 14, fontWeight: '800', color: '#10B981' },

  // ─── Ongoing Trip Card Enhancements ───
  orderCardOngoing: { borderColor: '#10B981', borderWidth: 2 },
  ongoingBadge: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, backgroundColor: '#E6F7F0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  ongoingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginRight: 6 },
  ongoingText: { fontSize: 11, fontWeight: '800', color: '#10B981', letterSpacing: 0.5 },
  orderDriverRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  orderDriverAvatar: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' },
  orderDriverAvatarText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  orderDriverName: { fontSize: 15, fontWeight: '800', color: '#1A1A1A' },
  orderDriverPhone: { fontSize: 12, color: '#6B6B6B', marginTop: 2, fontWeight: '500' },
  orderDriverPrice: { fontSize: 17, fontWeight: '900', color: '#10B981' },
});

export default App;
