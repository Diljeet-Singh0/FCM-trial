import 'react-native-gesture-handler';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
  ActivityIndicator,
  Animated,
  PanResponder,
  Dimensions,
  Image,
  Modal,
  PermissionsAndroid,
  BackHandler,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import Geolocation from 'react-native-geolocation-service';
import { launchCamera } from 'react-native-image-picker';
import { NavigationContainer, useNavigation, useFocusEffect, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator, StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { API_BASE_URL, USER_ID } from './src/config';
import { acceptRequest, declineRequest, fetchActiveRequests, registerUser, updateTripStatus, updateDriverLocation, uploadBuilty } from './src/api';
import { RootStackParamList, NavigationMode } from './src/map/types';
import { useLocation } from './src/map/hooks/useLocation';
import { useRoute } from './src/map/hooks/useRoute';
import { geocodeAddress } from './src/map/utils/mapbox';
import MapContainer from './src/map/components/MapContainer';
import MapHomeScreen from './src/map/screens/MapHomeScreen';
import NavigationScreen from './src/map/screens/NavigationScreen';
import DriverHistoryScreen from './src/screens/DriverHistoryScreen';
import DriverAuthScreens from './src/screens/DriverAuthScreens';

type RegistrationStatus = 'pending' | 'registered' | 'error';

type IncomingRequest = {
  requestId: string;
  goodsType: string;
  weightKg: string;
  pickupAddress: string;
  dropAddress: string;
  ownerId: string;
  priceInr: string;
  basePrice: string;
};

type ActiveRequest = {
  id: string;
  goods_type: string;
  weight_kg: number;
  pickup_address: string;
  drop_address: string;
  owner_id: string;
  price_inr: number;
  base_price: number;
};

const Stack = createStackNavigator<RootStackParamList>();

const readDataString = (value: string | object | undefined, fallback = ''): string => {
  return typeof value === 'string' ? value : fallback;
};

const App = () => {
  const [incomingRequest, setIncomingRequest] = useState<IncomingRequest | null>(null);
  const [acceptStatus, setAcceptStatus] = useState<null | 'accepted' | 'declined'>(null);
  const [transporterId, setTransporterId] = useState<string | null>(null);
  const [activeRequests, setActiveRequests] = useState<ActiveRequest[]>([]);
  const [tripStatus, setTripStatus] = useState<'matched' | 'picked_up' | 'on_the_way' | 'completed'>('matched');
  const [isOnline, setIsOnline] = useState(false);
  const [builtyImage, setBuiltyImage] = useState<string | null>(null);
  const [showBuiltyPreview, setShowBuiltyPreview] = useState(false);
  const [isUploadingBuilty, setIsUploadingBuilty] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isStateLoaded, setIsStateLoaded] = useState(false);

  useEffect(() => {
    const loadPersistedState = async () => {
      try {
        const storedIsOnline = await AsyncStorage.getItem('driver_isOnline');
        if (storedIsOnline !== null) setIsOnline(storedIsOnline === 'true');

        const storedIncomingRequest = await AsyncStorage.getItem('driver_incomingRequest');
        if (storedIncomingRequest) setIncomingRequest(JSON.parse(storedIncomingRequest));

        const storedAcceptStatus = await AsyncStorage.getItem('driver_acceptStatus');
        if (storedAcceptStatus) setAcceptStatus(storedAcceptStatus as any);

        const storedTripStatus = await AsyncStorage.getItem('driver_tripStatus');
        if (storedTripStatus) setTripStatus(storedTripStatus as any);

        const storedTransporterId = await AsyncStorage.getItem('gozo_driver_id');
        if (storedTransporterId) setTransporterId(storedTransporterId);

      } catch (e) {
        console.warn('Failed to load driver state', e);
      } finally {
        setIsStateLoaded(true);
      }
    };
    loadPersistedState();
  }, []);

  useEffect(() => {
    if (isStateLoaded) {
      AsyncStorage.setItem('driver_isOnline', isOnline.toString());
    }
  }, [isOnline, isStateLoaded]);

  useEffect(() => {
    if (isStateLoaded) {
      if (incomingRequest) {
        AsyncStorage.setItem('driver_incomingRequest', JSON.stringify(incomingRequest));
      } else {
        AsyncStorage.removeItem('driver_incomingRequest');
      }
    }
  }, [incomingRequest, isStateLoaded]);

  useEffect(() => {
    if (isStateLoaded) {
      if (acceptStatus) {
        AsyncStorage.setItem('driver_acceptStatus', acceptStatus);
      } else {
        AsyncStorage.removeItem('driver_acceptStatus');
      }
    }
  }, [acceptStatus, isStateLoaded]);

  useEffect(() => {
    if (isStateLoaded) {
      if (tripStatus) {
        AsyncStorage.setItem('driver_tripStatus', tripStatus);
      } else {
        AsyncStorage.removeItem('driver_tripStatus');
      }
    }
  }, [tripStatus, isStateLoaded]);

  const loadActiveRequests = async () => {
    const response = await fetchActiveRequests();
    if (response.success) {
      setActiveRequests(response.requests);
    } else {
      Alert.alert('Error', response.error ?? 'Could not fetch active requests');
    }
  };

  useEffect(() => {
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
          basePrice: readDataString(remoteMessage.data.basePrice, '0'),
        });
        setAcceptStatus(null);
      }
    });

    return () => {
      unsubscribeMessage();
    };
  }, []);

  // ─── Live Location Broadcasting ───
  useEffect(() => {
    if (acceptStatus !== 'accepted' || !incomingRequest || tripStatus === 'completed') {
      return;
    }

    let watchId: number | null = null;
    let lastSendTime = 0;
    const SEND_INTERVAL_MS = 4000; // Send location every 4 seconds

    watchId = Geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastSendTime < SEND_INTERVAL_MS) return;
        lastSendTime = now;

      if (transporterId) {
        updateDriverLocation(
          incomingRequest.requestId,
          transporterId,
          position.coords.latitude,
          position.coords.longitude,
          position.coords.heading || 0,
        ).catch((err) => console.warn('[Location] Failed to send:', err));
      }
    },
      (error) => {
        console.warn('[Location] Watch error:', error.message);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 5, // meters - only fire when moved 5m
        interval: 3000,
        fastestInterval: 2000,
      },
    );

    return () => {
      if (watchId !== null) {
        Geolocation.clearWatch(watchId);
      }
    };
  }, [acceptStatus, incomingRequest, transporterId, tripStatus]);

  const navigationRef = createNavigationContainerRef<RootStackParamList>();

  const handleAccept = async () => {
    if (!incomingRequest || !transporterId) return;
    try {
      const response = await acceptRequest(incomingRequest.requestId, transporterId);
    if (response.success) {
      setAcceptStatus('accepted');
      setTripStatus('matched');
    } else {
      Alert.alert('Error', response.error ?? 'Could not accept request');
    }
  } catch (err) { Alert.alert('Error', 'Connection failed'); }
  };

  const handleUpdateStatus = async (status: 'picked_up' | 'on_the_way' | 'completed') => {
    if (!incomingRequest || !transporterId) return;
    const response = await updateTripStatus(incomingRequest.requestId, transporterId, status);
    if (response.success) {
      setTripStatus(status);
    } else {
      Alert.alert('Error', response.error ?? 'Could not update status');
    }
  };

  const onCaptureBuilty = async () => {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'App needs camera access to capture the builty receipt.',
          buttonPositive: 'OK',
          buttonNegative: 'Cancel',
        },
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Permission Denied', 'Camera permission is required to capture the builty.');
        return;
      }
    } catch (err) {
      console.warn('Camera permission error:', err);
      return;
    }

    launchCamera(
      {
        mediaType: 'photo',
        quality: 0.5,
        maxWidth: 1200,
        maxHeight: 1600,
        includeBase64: true,
        cameraType: 'back',
      },
      (response) => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert('Camera Error', response.errorMessage || 'Could not open camera');
          return;
        }
        const asset = response.assets?.[0];
        if (asset?.base64) {
          setBuiltyImage(asset.base64);
          setShowBuiltyPreview(true);
        }
      },
    );
  };

  const uploadBuiltyPhoto = async (base64Img: string) => {
    if (!incomingRequest || !transporterId) return;
    setIsUploadingBuilty(true);
    const response = await uploadBuilty(incomingRequest.requestId, transporterId, base64Img);
    setIsUploadingBuilty(false);
    if (response.success) {
      setShowBuiltyPreview(false);
      setTripStatus('completed');
      Alert.alert('✅ Trip Completed', 'Great job! Builty uploaded and delivery marked as completed.', [
        {
          text: 'OK',
          onPress: () => {
            setAcceptStatus(null);
            setIncomingRequest(null);
            setTripStatus('matched');
            setBuiltyImage(null);
            if (navigationRef.isReady()) {
              navigationRef.reset({ index: 0, routes: [{ name: 'Home' }] });
            }
          }
        }
      ]);
    } else {
      Alert.alert('Upload Failed', response.error ?? 'Could not upload builty. Please try again.');
    }
  };

  const handleDecline = async () => {
    if (!incomingRequest || !transporterId) return;
    try {
      const response = await declineRequest(incomingRequest.requestId, transporterId);
    if (!response.success) {
      Alert.alert('Error', response.error ?? 'Could not decline request');
      return;
    }
    setAcceptStatus('declined');
    setIncomingRequest(null);
    } catch (e) { Alert.alert('Error', 'Connection failed'); }
  };

  // ─── Booking Request Card Component ───
  const BookingCard = ({ req, showActions = false }: { req: IncomingRequest; showActions?: boolean }) => {
    const gozoId = `GOZO-${req.requestId.slice(0, 7).toUpperCase()}`;
    return (
      <View style={s.bookingCard}>
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

        <View style={s.infoBox}>
          <Text style={s.infoBoxText}>Goods: {req.goodsType}</Text>
          <Text style={s.infoBoxText}>Payment: UPI</Text>
          <Text style={s.infoBoxText}>ETA to pickup: ~15 min</Text>
        </View>

        {showActions && acceptStatus !== 'accepted' && (
          <View style={s.actionRow}>
            <TouchableOpacity style={s.rejectBtn} onPress={handleDecline}>
              <Text style={s.rejectBtnText}>✕  Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.acceptBtn} onPress={handleAccept}>
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

  // ─── Embedded Route Map Component ───
  const EmbeddedRouteMap = React.memo(({ destinationAddress, navigation, incomingRequest: req }: {
    destinationAddress: string;
    navigation: StackNavigationProp<RootStackParamList>;
    incomingRequest: IncomingRequest;
  }) => {
    const { currentLocation, heading } = useLocation();
    const { route, loading, getRoute } = useRoute();
    const [destCoords, setDestCoords] = useState<{longitude: number; latitude: number} | null>(null);
    const routeFetchedRef = useRef(false);
    const lastDestRef = useRef('');
    const geocodingRef = useRef(false);

    useEffect(() => {
      if (destinationAddress && destinationAddress !== lastDestRef.current && !geocodingRef.current) {
        lastDestRef.current = destinationAddress;
        routeFetchedRef.current = false;
        geocodingRef.current = true;
        geocodeAddress(destinationAddress).then(coords => {
          geocodingRef.current = false;
          if (coords) setDestCoords(coords);
        }).catch(() => { geocodingRef.current = false; });
      }
    }, [destinationAddress]);

    useEffect(() => {
      if (currentLocation && destCoords && !routeFetchedRef.current && !loading) {
        routeFetchedRef.current = true;
        getRoute(currentLocation, destCoords);
      }
    }, [currentLocation, destCoords, loading]);

    return (
      <View style={{ flex: 1 }}>
        <MapContainer
          currentLocation={currentLocation}
          simulatedLocation={null}
          simulatedBearing={heading}
          sourceCoords={currentLocation}
          destinationCoords={destCoords}
          route={route}
          navigationMode={NavigationMode.ROUTE_PREVIEW}
        />
        {loading && (
          <View style={s.mapLoadingOverlay}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={s.mapLoadingText}>Fetching route...</Text>
          </View>
        )}
        {route && currentLocation && destCoords && (
          <TouchableOpacity
            style={s.startNavFab}
            onPress={() => navigation.navigate('Navigation', {
              route,
              sourceCoords: currentLocation,
              destinationCoords: destCoords,
              sourceName: 'Your Location',
              destinationName: destinationAddress,
            })}
          >
            <Text style={s.startNavFabText}>▶ Start Navigation</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  });

  // ─── Active Delivery View (with embedded map) ───
  const renderActiveDelivery = (navigation: StackNavigationProp<RootStackParamList>) => {
    if (!incomingRequest || acceptStatus !== 'accepted') return null;
    const gozoId = `GOZO-${incomingRequest.requestId.slice(0, 7).toUpperCase()}`;
    const progressPercent = tripStatus === 'matched' ? 10 : tripStatus === 'picked_up' ? 40 : tripStatus === 'on_the_way' ? 75 : 100;
    const progressLabel = tripStatus === 'matched' ? 'Heading to pickup' : tripStatus === 'picked_up' ? 'Goods loaded' : tripStatus === 'on_the_way' ? 'En route to drop' : 'Delivered';

    const destAddress = tripStatus === 'matched' || tripStatus === 'picked_up'
      ? incomingRequest.pickupAddress
      : incomingRequest.dropAddress;
    const destLabel = tripStatus === 'matched' || tripStatus === 'picked_up'
      ? 'Pickup'
      : 'Drop-off';

    return (
      <View style={s.activeDeliveryContainer}>
        <View style={s.embeddedMapContainer}>
          <EmbeddedRouteMap
            destinationAddress={destAddress}
            navigation={navigation}
            incomingRequest={incomingRequest}
          />
          <View style={s.mapOverlayHeader}>
            <TouchableOpacity 
              onPress={() => { 
                if (tripStatus === 'completed') { 
                  setAcceptStatus(null); 
                  setTripStatus('matched'); 
                } else {
                  Alert.alert('Delivery in Progress', 'Please complete the current delivery before going back.');
                }
              }} 
              style={s.mapOverlayBtn}
            >
              <Text style={s.mapOverlayBtnText}>←</Text>
            </TouchableOpacity>
            <View style={s.mapOverlayCenter}>
              <Text style={s.mapOverlayTitle}>{gozoId}</Text>
              <Text style={s.mapOverlaySubtitle}>Navigating to {destLabel}</Text>
            </View>
            <View style={[s.liveBadge, { backgroundColor: tripStatus === 'completed' ? '#E5E7EB' : '#DCFCE7' }]}>
              <Text style={[s.liveText, { color: tripStatus === 'completed' ? '#6B7280' : '#16A34A' }]}>
                {tripStatus === 'completed' ? 'DONE' : 'LIVE'}
              </Text>
            </View>
          </View>
          <View style={s.etaPill}>
            <Text style={s.etaPillText}>📍 {destAddress}</Text>
          </View>
        </View>

        <View style={s.bottomPanel}>
          <View style={s.bottomPanelHandle} />
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
            <View style={s.adCustomerRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.adCustomerNameInline}>Customer</Text>
                <Text style={s.adCustomerMetaInline}>{incomingRequest.weightKg} kg · {incomingRequest.goodsType}</Text>
              </View>
              <Text style={s.adPriceInline}>₹{incomingRequest.basePrice}</Text>
            </View>

            <View style={s.miniRouteRow}>
              <View style={s.miniRouteDot} />
              <Text style={s.miniRouteText} numberOfLines={1}>{incomingRequest.pickupAddress}</Text>
            </View>
            <View style={s.miniRouteLine} />
            <View style={s.miniRouteRow}>
              <View style={[s.miniRouteDot, { backgroundColor: '#1A56DB' }]} />
              <Text style={s.miniRouteText} numberOfLines={1}>{incomingRequest.dropAddress}</Text>
            </View>

            <View style={s.inlineProgressCard}>
              <View style={s.adProgressHeader}>
                <Text style={s.adProgressTitle}>{progressLabel}</Text>
                <Text style={s.adProgressPercent}>{progressPercent}%</Text>
              </View>
              <View style={s.adProgressBarBg}>
                <View style={[s.adProgressBarFill, { width: `${progressPercent}%` as any }]} />
              </View>
            </View>

            {tripStatus === 'matched' && (
              <TouchableOpacity style={s.reachedBtn} onPress={() => handleUpdateStatus('picked_up')}>
                <Text style={s.reachedBtnText}>📦  Goods Picked Up</Text>
              </TouchableOpacity>
            )}
            {tripStatus === 'picked_up' && (
              <TouchableOpacity style={[s.reachedBtn, { backgroundColor: '#1A56DB' }]} onPress={() => handleUpdateStatus('on_the_way')}>
                <Text style={s.reachedBtnText}>🚛  Start Trip — On the Way</Text>
              </TouchableOpacity>
            )}
            {tripStatus === 'on_the_way' && (
              <TouchableOpacity style={[s.reachedBtn, { backgroundColor: '#7C3AED' }]} onPress={onCaptureBuilty}>
                <Text style={s.reachedBtnText}>📸  Upload Builty & Deliver</Text>
              </TouchableOpacity>
            )}
            {tripStatus === 'completed' && (
              <View style={s.completedBanner}>
                <Text style={s.completedText}>🎉 Delivery Completed! Builty uploaded.</Text>
              </View>
            )}

            <Modal visible={showBuiltyPreview} transparent animationType="slide">
              <View style={s.builtyModalOverlay}>
                <View style={s.builtyModalCard}>
                  <Text style={s.builtyModalTitle}>📄 Confirm Builty</Text>
                  <Text style={s.builtyModalSubtitle}>Review the photo before submitting</Text>
                  {builtyImage && (
                    <Image
                      source={{ uri: `data:image/jpeg;base64,${builtyImage}` }}
                      style={s.builtyPreviewImage}
                      resizeMode="contain"
                    />
                  )}
                  <View style={s.builtyModalActions}>
                    <TouchableOpacity
                      style={s.builtyRetakeBtn}
                      onPress={() => { setShowBuiltyPreview(false); setBuiltyImage(null); onCaptureBuilty(); }}
                      disabled={isUploadingBuilty}
                    >
                      <Text style={s.builtyRetakeBtnText}>🔄 Retake</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.builtyConfirmBtn, isUploadingBuilty && { opacity: 0.6 }]}
                      onPress={() => builtyImage && uploadBuiltyPhoto(builtyImage)}
                      disabled={isUploadingBuilty}
                    >
                      {isUploadingBuilty ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={s.builtyConfirmBtnText}>✅ Confirm & Deliver</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={s.builtyCloseBtn}
                    onPress={() => { setShowBuiltyPreview(false); setBuiltyImage(null); }}
                    disabled={isUploadingBuilty}
                  >
                    <Text style={s.builtyCloseBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </ScrollView>
        </View>
      </View>
    );
  };

  const SwipeButton = ({ onSwipeSuccess }: { onSwipeSuccess: () => void }) => {
    const pan = useRef(new Animated.ValueXY()).current;
    const [swiped, setSwiped] = useState(false);
    const SWIPE_WIDTH = Dimensions.get('window').width - 64; 
    const BUTTON_WIDTH = 56;
    const swipeThreshold = SWIPE_WIDTH - BUTTON_WIDTH - 8;

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 20;
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dx > 0 && gestureState.dx < swipeThreshold && !swiped) {
            pan.setValue({ x: gestureState.dx, y: 0 });
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx >= swipeThreshold * 0.7) {
            Animated.spring(pan, {
              toValue: { x: swipeThreshold, y: 0 },
              useNativeDriver: false,
            }).start(() => {
              setSwiped(true);
              onSwipeSuccess();
            });
          } else {
            Animated.spring(pan, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: false,
            }).start();
          }
        },
      })
    ).current;

    return (
      <View style={s.swipeContainer}>
        <Text style={s.swipeText}>Swipe to go Online</Text>
        <Animated.View
          style={[s.swipeBtn, { transform: [{ translateX: pan.x }] }]}
          {...panResponder.panHandlers}
        >
          <Text style={s.swipeBtnIcon}>→</Text>
        </Animated.View>
      </View>
    );
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Logout', 
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('gozo_driver_id');
          setTransporterId(null);
          setIsOnline(false);
          setIncomingRequest(null);
        }
      }
    ]);
  };

  const HomeScreen = () => {
    const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

    const Header = () => (
      <View style={s.screenHeaderBar}>
        <View style={{ flex: 1 }}>
          <Text style={s.screenHeaderTitle}>GoZo Driver</Text>
          <Text style={s.screenHeaderSub}>{isOnline ? 'Online' : 'Offline'}</Text>
        </View>
        <TouchableOpacity style={s.historyBtnIcon} onPress={() => setShowHistory(true)}>
          <Text style={{ fontSize: 20 }}>📜</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.historyBtnIcon} onPress={handleLogout}>
          <Text style={{ fontSize: 20 }}>🚪</Text>
        </TouchableOpacity>
      </View>
    );

    useEffect(() => {
      const backAction = () => {
        if (acceptStatus === 'accepted' && tripStatus !== 'completed') {
          Alert.alert('Delivery in Progress', 'You have an active delivery. Minimize the app instead of going back.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Exit App', onPress: () => BackHandler.exitApp() }
          ]);
          return true; 
        }
        return false;
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
      return () => backHandler.remove();
    }, [acceptStatus, tripStatus]);

    useEffect(() => {
      let interval: NodeJS.Timeout;
      if (isOnline && acceptStatus !== 'accepted') {
        loadActiveRequests();
        interval = setInterval(() => {
          loadActiveRequests();
        }, 8000); 
      }
      return () => {
        if (interval) clearInterval(interval);
      };
    }, [isOnline, acceptStatus]);

    if (!isStateLoaded) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA' }}>
          <ActivityIndicator size="large" color="#1A56DB" />
        </View>
      );
    }

    return (
      <View style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
        <Header />
        <View style={s.profileHeader}>
          <View style={s.avatarCircle}>
            <Text style={s.avatarText}>RS</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.driverName}>Transporter One</Text>
            <Text style={s.vehicleInfo}>Eicher 14 ft · Vehicle</Text>
          </View>
          <View style={[s.onlineBadge, { backgroundColor: isOnline ? '#DCFCE7' : '#F3F4F6' }]}>
            <Text style={[s.onlineText, { color: isOnline ? '#16A34A' : '#6B7280' }]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>

        {acceptStatus === 'accepted' && incomingRequest ? (
          renderActiveDelivery(navigation)
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24, ...(isOnline ? {} : { flexGrow: 1 }) }}>
            
            {incomingRequest && (
              <View style={{ marginTop: 16 }}>
                <Text style={s.sectionTitle}>New Direct Request</Text>
                <BookingCard req={incomingRequest} showActions={true} />
              </View>
            )}

            {!isOnline ? (
              <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 16 }}>
                <View style={s.offlineState}>
                  <Text style={{ fontSize: 64, marginBottom: 16 }}>😴</Text>
                  <Text style={s.offlineTitle}>You are currently offline</Text>
                  <Text style={s.offlineSub}>Go online to start receiving ride requests and view the marketplace.</Text>
                </View>
                
                <SwipeButton onSwipeSuccess={() => setIsOnline(true)} />

                <View style={s.statsCard}>
                  <View style={s.statItem}>
                    <Text style={s.statValue}>⭐ 4.8</Text>
                    <Text style={s.statLabel}>My Rating</Text>
                  </View>
                  <View style={s.statDivider} />
                  <View style={s.statItem}>
                    <Text style={s.statValue}>142</Text>
                    <Text style={s.statLabel}>Past Rides</Text>
                  </View>
                  <View style={s.statDivider} />
                  <View style={s.statItem}>
                    <Text style={s.statValue}>₹12.4k</Text>
                    <Text style={s.statLabel}>Earned</Text>
                  </View>
                </View>

                <TouchableOpacity style={s.historyBtn} onPress={() => setShowHistory(true)} activeOpacity={0.8}>
                  <Text style={s.historyBtnText}>📋  Trip History</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginTop: 16, marginBottom: 8 }}>
                  <Text style={[s.sectionTitle, { marginHorizontal: 0, marginTop: 0, marginBottom: 0 }]}>Available Requests ({activeRequests.length})</Text>
                  <TouchableOpacity onPress={() => setIsOnline(false)} style={s.goOfflineBtn}>
                    <Text style={s.goOfflineBtnText}>Go Offline</Text>
                  </TouchableOpacity>
                </View>

                {activeRequests.length > 0 ? (
                  activeRequests.map((item) => (
                    <View key={item.id} style={s.bookingCard}>
                      <View style={s.bookingHeader}>
                        <View>
                          <Text style={s.gozoId}>GOZO-{item.id.slice(0, 7).toUpperCase()}</Text>
                          <Text style={s.customerName}>{item.goods_type}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={s.payoutLabel}>Driver payout</Text>
                          <Text style={s.payoutAmount}>₹{item.base_price}</Text>
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
                            basePrice: String(item.base_price),
                          });
                          setAcceptStatus(null);
                        }}
                      >
                        <Text style={s.acceptFullBtnText}>View & Accept</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                ) : (
                  <View style={s.waitingCard}>
                    <Text style={{ fontSize: 40 }}>📡</Text>
                    <Text style={s.waitingTitle}>Searching for requests...</Text>
                    <Text style={s.waitingSub}>New shipments in your area will appear here</Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    );
  };

  const ActiveRequestsScreen = () => {
    const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
    useFocusEffect(useCallback(() => { loadActiveRequests(); }, []));
    return (
      <View style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
        <View style={s.screenHeaderBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><Text style={s.backArrow}>←</Text></TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}><Text style={s.screenHeaderTitle}>Available Requests</Text></View>
        </View>
      </View>
    );
  };

  if (showHistory) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <DriverHistoryScreen transporterId={transporterId} onBack={() => setShowHistory(false)} />
      </GestureHandlerRootView>
    );
  }

  if (!isStateLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#16A34A" />
      </View>
    );
  }

  if (!transporterId) {
    return (
      <DriverAuthScreens
        onLoginSuccess={async (id) => {
          await AsyncStorage.setItem('gozo_driver_id', id);
          setTransporterId(id);
        }}
      />
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef}>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Navigation">
              {(props) => (
                <NavigationScreen
                  {...props}
                  requestId={incomingRequest?.requestId || ''}
                  transporterId={transporterId || ''}
                  pickupAddress={incomingRequest?.pickupAddress || ''}
                  dropAddress={incomingRequest?.dropAddress || ''}
                  goodsType={incomingRequest?.goodsType || ''}
                  weightKg={Number(incomingRequest?.weightKg || 0)}
                  priceInr={Number(incomingRequest?.priceInr || 0)}
                  status={tripStatus}
                  onStatusChange={(newStatus) => {
                    if (newStatus === 'completed') {
                      handleUpdateStatus('completed');
                    } else {
                      setTripStatus(newStatus);
                    }
                  }}
                />
              )}
            </Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  profileHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  avatarCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1A56DB', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  driverName: { fontSize: 17, fontWeight: '700', color: '#111827' },
  vehicleInfo: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  onlineBadge: { backgroundColor: '#DCFCE7', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  onlineText: { color: '#16A34A', fontSize: 13, fontWeight: '700' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginHorizontal: 16, marginTop: 16, marginBottom: 12 },
  bookingCard: { marginHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, marginBottom: 14, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, borderWidth: 1, borderColor: '#F3F4F6' },
  bookingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  gozoId: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  customerName: { fontSize: 17, fontWeight: '700', color: '#111827', marginTop: 2 },
  payoutLabel: { fontSize: 11, color: '#6B7280' },
  payoutAmount: { fontSize: 22, fontWeight: '800', color: '#16A34A', marginTop: 2 },
  routeContainer: { flexDirection: 'row', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  routeDots: { alignItems: 'center', marginRight: 14, paddingTop: 4 },
  greenDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#22C55E', borderWidth: 2.5, borderColor: '#BBF7D0' },
  blueDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#1A56DB', borderWidth: 2.5, borderColor: '#BFDBFE' },
  routeLine: { width: 2, height: 26, backgroundColor: '#D1D5DB', marginVertical: 3 },
  routeTexts: { flex: 1 },
  routeLabel: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  routeAddress: { fontSize: 15, fontWeight: '600', color: '#111827', marginTop: 2 },
  chipsRow: { flexDirection: 'row', marginTop: 12, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F9FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#E0F2FE' },
  chipIcon: { fontSize: 14, marginRight: 4 },
  chipText: { fontSize: 12, fontWeight: '600', color: '#0369A1' },
  infoBox: { marginTop: 12, backgroundColor: '#F0FDF4', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#BBF7D0' },
  infoBoxText: { fontSize: 13, color: '#166534', fontWeight: '500', lineHeight: 20 },
  actionRow: { flexDirection: 'row', marginTop: 14, gap: 10 },
  rejectBtn: { flex: 1, borderWidth: 2, borderColor: '#FCA5A5', borderRadius: 14, paddingVertical: 14, backgroundColor: '#FFF' },
  rejectBtnText: { textAlign: 'center', color: '#DC2626', fontSize: 15, fontWeight: '700' },
  acceptBtn: { flex: 1.3, backgroundColor: '#16A34A', borderRadius: 14, paddingVertical: 14, elevation: 2 },
  acceptBtnText: { textAlign: 'center', color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  acceptedBanner: { marginTop: 12, backgroundColor: '#DCFCE7', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#86EFAC' },
  acceptedText: { color: '#166534', fontWeight: '700', fontSize: 14 },
  activeDeliveryContainer: { flex: 1, backgroundColor: '#1A1A2E' },
  embeddedMapContainer: { flex: 1, position: 'relative' },
  mapOverlayHeader: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 10 },
  mapOverlayBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  mapOverlayBtnText: { fontSize: 20, color: '#FFFFFF', fontWeight: '300' },
  mapOverlayCenter: { flex: 1, alignItems: 'center' },
  mapOverlayTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  mapOverlaySubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  mapLoadingOverlay: { position: 'absolute', bottom: 70, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  mapLoadingText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  etaPill: { position: 'absolute', bottom: 12, left: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, zIndex: 10 },
  etaPillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  startNavFab: { position: 'absolute', bottom: 50, right: 16, backgroundColor: '#16A34A', borderRadius: 28, paddingHorizontal: 20, paddingVertical: 12, elevation: 6, shadowColor: '#16A34A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, zIndex: 10 },
  startNavFabText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  bottomPanel: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '45%', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 8 },
  bottomPanelHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', alignSelf: 'center', marginTop: 10, marginBottom: 10 },
  adCustomerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  adCustomerNameInline: { fontSize: 15, fontWeight: '700', color: '#111827' },
  adCustomerMetaInline: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  adPriceInline: { fontSize: 20, fontWeight: '800', color: '#16A34A' },
  miniRouteRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  miniRouteDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22C55E', marginRight: 10 },
  miniRouteText: { fontSize: 13, color: '#374151', fontWeight: '500', flex: 1 },
  miniRouteLine: { width: 2, height: 12, backgroundColor: '#D1D5DB', marginLeft: 4 },
  inlineProgressCard: { marginTop: 8, paddingVertical: 8 },
  liveBadge: { backgroundColor: '#DCFCE7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  liveText: { color: '#16A34A', fontSize: 12, fontWeight: '800' },
  adProgressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  adProgressTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  adProgressPercent: { fontSize: 14, fontWeight: '700', color: '#1A56DB' },
  adProgressBarBg: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, position: 'relative' },
  adProgressBarFill: { position: 'absolute', left: 0, top: 0, height: 6, width: '20%', backgroundColor: '#1A56DB', borderRadius: 3 },
  reachedBtn: { backgroundColor: '#16A34A', borderRadius: 14, paddingVertical: 14, marginTop: 12, elevation: 2 },
  reachedBtnText: { color: '#FFFFFF', textAlign: 'center', fontSize: 15, fontWeight: '700' },
  completedBanner: { marginTop: 12, backgroundColor: '#DCFCE7', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#86EFAC', alignItems: 'center' },
  completedText: { color: '#166534', fontWeight: '700', fontSize: 15 },
  waitingCard: { marginHorizontal: 16, alignItems: 'center', paddingVertical: 50, backgroundColor: '#FFFFFF', borderRadius: 18, elevation: 1, borderWidth: 1, borderColor: '#F3F4F6' },
  waitingTitle: { fontSize: 17, fontWeight: '700', color: '#374151', marginTop: 12 },
  waitingSub: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },
  screenHeaderBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  screenHeaderTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  screenHeaderSub: { fontSize: 12, color: '#6B7280' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backArrow: { fontSize: 24, color: '#111827', fontWeight: '300' },
  acceptFullBtn: { backgroundColor: '#1A56DB', borderRadius: 14, paddingVertical: 14, marginTop: 14 },
  acceptFullBtnText: { color: '#FFFFFF', textAlign: 'center', fontSize: 15, fontWeight: '700' },
  offlineState: { alignItems: 'center', marginTop: 40, marginBottom: 40 },
  offlineTitle: { fontSize: 24, fontWeight: '800', color: '#111827', textAlign: 'center' },
  offlineSub: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },
  swipeContainer: { height: 64, backgroundColor: '#E5E7EB', borderRadius: 32, justifyContent: 'center', marginBottom: 40, paddingHorizontal: 4 },
  swipeText: { position: 'absolute', width: '100%', textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#6B7280', zIndex: -1 },
  swipeBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#16A34A', justifyContent: 'center', alignItems: 'center', elevation: 4 },
  swipeBtnIcon: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
  goOfflineBtn: { backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  goOfflineBtnText: { color: '#4B5563', fontSize: 12, fontWeight: '700' },
  statsCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, elevation: 2, borderWidth: 1, borderColor: '#F3F4F6', justifyContent: 'space-between', alignItems: 'center' },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4, fontWeight: '600' },
  statDivider: { width: 1, height: 30, backgroundColor: '#E5E7EB' },
  builtyModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  builtyModalCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, width: '100%', maxWidth: 400, alignItems: 'center' },
  builtyModalTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 4 },
  builtyModalSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  builtyPreviewImage: { width: '100%', height: 300, borderRadius: 16, backgroundColor: '#F3F4F6', marginBottom: 16 },
  builtyModalActions: { flexDirection: 'row', gap: 10, width: '100%' },
  builtyRetakeBtn: { flex: 1, borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 14, paddingVertical: 14, backgroundColor: '#FFF' },
  builtyRetakeBtnText: { textAlign: 'center', color: '#374151', fontSize: 14, fontWeight: '700' },
  builtyConfirmBtn: { flex: 1.5, backgroundColor: '#16A34A', borderRadius: 14, paddingVertical: 14, elevation: 2, justifyContent: 'center', alignItems: 'center' },
  builtyConfirmBtnText: { color: '#FFFFFF', textAlign: 'center', fontSize: 14, fontWeight: '700' },
  builtyCloseBtn: { marginTop: 12, paddingVertical: 8 },
  builtyCloseBtnText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
  historyBtnIcon: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  historyBtn: { backgroundColor: '#1A56DB', borderRadius: 14, paddingVertical: 14, marginTop: 16, elevation: 2, shadowColor: '#1A56DB', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6 },
  historyBtnText: { color: '#FFFFFF', textAlign: 'center', fontSize: 15, fontWeight: '700' },
});

export default App;
