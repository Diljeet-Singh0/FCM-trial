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
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import Geolocation from 'react-native-geolocation-service';

import BuiltyCameraScreen from './src/screens/BuiltyCameraScreen';
import { NavigationContainer, useNavigation, useFocusEffect, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator, StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { API_BASE_URL, USER_ID } from './src/config';
import { acceptRequest, declineRequest, fetchActiveRequests, registerUser, updateTripStatus, updateDriverLocation, uploadBuilty, updateDriverStatus, fetchUserProfile, fetchRequestDetails, fetchDriverStats, updateDriverDbStatus } from './src/api';
import { RootStackParamList, NavigationMode } from './src/map/types';
import { useLocation }  from './src/map/hooks/useLocation';
import { useRoute } from './src/map/hooks/useRoute';
import { geocodeAddress } from './src/map/utils/mapbox';
import MapContainer from './src/map/components/MapContainer';
import MapHomeScreen from './src/map/screens/MapHomeScreen';
import NavigationScreen from './src/map/screens/NavigationScreen';
import DriverHistoryScreen from './src/screens/DriverHistoryScreen';
import DriverAuthScreens from './src/screens/DriverAuthScreens';
import DriverSettingsScreen from './src/screens/DriverSettingsScreen';
import SidebarDrawer from './src/screens/SidebarDrawer';
import { DriverScheduledRidesScreen } from './src/screens/DriverScheduledRidesScreen';
import { DriverScheduledRideDetailScreen } from './src/screens/DriverScheduledRideDetailScreen';


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
  estimatedFreight?: string;
  serviceFee?: string;
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
  estimated_freight?: number;
  service_fee?: number;
};

const Stack = createStackNavigator<RootStackParamList>();

const readDataString = (value: string | object | undefined, fallback = ''): string => {
  return typeof value === 'string' ? value : fallback;
};

const translations = {
  en: {
    online: 'Online',
    offline: 'Offline',
    swipeToOnline: 'Swipe to go Online',
    tripHistory: '📋  Trip History',
    currentlyOffline: 'You are currently offline',
    goOnlineDesc: 'Go online to start receiving ride requests and view the marketplace.',
    availableRequests: 'Available Requests',
    searching: 'Searching for requests...',
    goOffline: 'Go Offline',
    swipeToOffline: 'Swipe to go Offline',
    driver: 'GoZo Driver',
    viewAndAccept: 'View & Accept',
    logout: 'Logout',
    logoutConfirm: 'Are you sure you want to log out?',
    // BookingCard
    yourPayout: 'Your Payout',
    pickup: 'Pickup',
    drop: 'Drop',
    autoCharges: 'Auto Charges',
    ratePerKm: 'Rate per km',
    minimumCharge: 'Minimum Charge',
    additionalCharges: 'Additional Charges',
    waitingCharges: 'Waiting Charges',
    first15Free: 'First 15 min free',
    pricingDetails: 'Pricing Details',
    estimatedPayout: 'Payout',
    reject: '✕  Reject',
    acceptJob: '✓  Accept Job',
    jobAccepted: '✅ Job accepted! Get ready for pickup.',
    // ActiveDeliveryView
    headingToPickup: 'Heading to pickup',
    goodsLoaded: 'Goods loaded',
    enRouteToDrop: 'En route to drop',
    delivered: 'Delivered',
    dropOff: 'Drop-off',
    navigatingTo: 'Navigating to',
    customer: 'Customer',
    deliveryInProgress: 'Delivery in Progress',
    completeDeliveryFirst: 'Please complete the current delivery before going back.',
    goodsPickedUp: '📦  Goods Picked Up',
    startTrip: '🚛  Start Trip — On the Way',
    uploadBuilty: '📸  Upload Builty & Deliver',
    deliveryCompleted: '🎉 Delivery Completed! Builty uploaded.',
    confirmBuilty: '📄 Confirm Builty',
    reviewPhoto: 'Review the photo before submitting',
    retake: '🔄 Retake',
    confirmDeliver: '✅ Confirm & Deliver',
    cancel: 'Cancel',
    // HomeScreen
    jobDetails: 'Job Details',
    close: 'Close',
    myRating: 'My Rating',
    pastRides: 'Past Rides',
    earned: 'Earned',
    vehicle: 'Vehicle',
    newShipmentsHere: 'New shipments in your area will appear here',
    startNavigation: '▶ Start Navigation',
    fetchingRoute: 'Fetching route...',
    yourLocation: 'Your Location',
    // Alerts
    myEarnings: 'My Earnings',
    earningsComingSoon: 'Earnings analysis coming soon!',
    termsTitle: 'Terms & Conditions',
    termsComingSoon: 'Terms and conditions page coming soon!',
    exitApp: 'Exit App',
    activeDeliveryWarning: 'You have an active delivery. Minimize the app instead of going back.',
    error: 'Error',
    connectionFailed: 'Connection failed',
    tripCompletedTitle: '✅ Trip Completed',
    tripCompletedMsg: 'Great job! Builty uploaded and delivery marked as completed.',
    ok: 'OK',
    uploadFailed: 'Upload Failed',
    couldNotUpload: 'Could not upload builty. Please try again.',
    settings: 'Settings',
    driverAccount: 'Driver Account',
    driverPreferences: 'Driver Preferences',
    autoAcceptRides: 'Auto-Accept Rides',
    autoAcceptDesc: 'Automatically accept nearby jobs',
    appSounds: 'App Sounds',
    appSoundsDesc: 'Play alerts for new requests',
    supportAndLegal: 'Support & Legal',
    helpCenter: 'Help Center',
    statusAssigned: 'Assigned',
    statusPickedUp: 'Picked Up',
    statusOnTheWay: 'On the Way',
    statusDelivered: 'Delivered',
    tripDetails: 'Trip Details',
    tripId: 'Trip ID',
    date: 'Date',
    driverCut: 'Driver Cut',
    shipmentInfo: 'Shipment Info',
    goods: 'Goods',
    weight: 'Weight',
    rating: 'Rating',
    route: 'Route',
    builtyReceipt: '📄 Builty Receipt',
    tapToView: 'Tap to view',
    completed: 'Completed',
    totalEarned: 'Total Earned',
    totalTrips: 'Total Trips',
    noTripsYet: 'No trips yet',
    completedTripsHere: 'Your completed trips will appear here',
  },
  hi: {
    online: 'ऑनलाइन',
    offline: 'ऑफ़लाइन',
    swipeToOnline: 'ऑनलाइन जाने के लिए स्वाइप करें',
    tripHistory: '📋  यात्रा इतिहास',
    currentlyOffline: 'आप अभी ऑफ़लाइन हैं',
    goOnlineDesc: 'शिपमेंट अनुरोध प्राप्त करने के लिए ऑनलाइन जाएँ।',
    availableRequests: 'उपलब्ध अनुरोध',
    searching: 'अनुरोध खोज रहे हैं...',
    goOffline: 'ऑफ़लाइन जाएं',
    swipeToOffline: 'ऑफ़लाइन जाने के लिए स्वाइप करें',
    driver: 'गोज़ो ड्राइवर',
    viewAndAccept: 'देखें और स्वीकार करें',
    logout: 'लॉग आउट',
    logoutConfirm: 'क्या आप वाकई लॉग आउट करना चाहते हैं?',
    yourPayout: 'आपकी कमाई',
    pickup: 'पिकअप',
    drop: 'ड्रॉप',
    autoCharges: 'ऑटो शुल्क',
    ratePerKm: 'प्रति किमी दर',
    minimumCharge: 'न्यूनतम शुल्क',
    additionalCharges: 'अतिरिक्त शुल्क',
    waitingCharges: 'प्रतीक्षा शुल्क',
    first15Free: 'पहले 15 मिनट मुफ़्त',
    pricingDetails: 'मूल्य विवरण',
    estimatedPayout: 'कमाई',
    reject: '✕  अस्वीकार',
    acceptJob: '✓  काम स्वीकार करें',
    jobAccepted: '✅ काम स्वीकार! पिकअप के लिए तैयार हों।',
    headingToPickup: 'पिकअप की ओर जा रहे हैं',
    goodsLoaded: 'सामान लोड हो गया',
    enRouteToDrop: 'ड्रॉप की ओर जा रहे हैं',
    delivered: 'डिलीवर हो गया',
    dropOff: 'ड्रॉप-ऑफ',
    navigatingTo: 'नेविगेट कर रहे हैं',
    customer: 'ग्राहक',
    deliveryInProgress: 'डिलीवरी जारी है',
    completeDeliveryFirst: 'कृपया वापस जाने से पहले वर्तमान डिलीवरी पूरी करें।',
    goodsPickedUp: '📦  सामान पिक अप हो गया',
    startTrip: '🚛  यात्रा शुरू करें — रास्ते में',
    uploadBuilty: '📸  बिल्टी अपलोड करें और डिलीवर करें',
    deliveryCompleted: '🎉 डिलीवरी पूरी हुई! बिल्टी अपलोड हो गई।',
    confirmBuilty: '📄 बिल्टी की पुष्टि करें',
    reviewPhoto: 'जमा करने से पहले फ़ोटो की समीक्षा करें',
    retake: '🔄 दोबारा लें',
    confirmDeliver: '✅ पुष्टि करें और डिलीवर करें',
    cancel: 'रद्द करें',
    jobDetails: 'काम का विवरण',
    close: 'बंद करें',
    myRating: 'मेरी रेटिंग',
    pastRides: 'पिछली यात्राएं',
    earned: 'कमाई',
    vehicle: 'वाहन',
    newShipmentsHere: 'आपके क्षेत्र में नई शिपमेंट यहाँ दिखेंगी',
    startNavigation: '▶ नेविगेशन शुरू करें',
    fetchingRoute: 'रास्ता खोज रहे हैं...',
    yourLocation: 'आपकी लोकेशन',
    myEarnings: 'मेरी कमाई',
    earningsComingSoon: 'कमाई विश्लेषण जल्द आ रहा है!',
    termsTitle: 'नियम और शर्तें',
    termsComingSoon: 'नियम और शर्तें पेज जल्द आ रहा है!',
    exitApp: 'ऐप बंद करें',
    activeDeliveryWarning: 'आपकी एक डिलीवरी चल रही है। वापस जाने की बजाय ऐप को मिनिमाइज़ करें।',
    error: 'त्रुटि',
    connectionFailed: 'कनेक्शन विफल रहा',
    tripCompletedTitle: '✅ यात्रा पूरी हुई',
    tripCompletedMsg: 'बहुत बढ़िया! बिल्टी अपलोड हो गई है और डिलीवरी पूरी हो गई है।',
    ok: 'ठीक है',
    uploadFailed: 'अपलोड विफल रहा',
    couldNotUpload: 'बिल्टी अपलोड नहीं हो सकी। कृपया पुनः प्रयास करें।',
    settings: 'सेटिंग्स',
    driverAccount: 'ड्राइवर खाता',
    driverPreferences: 'ड्राइवर प्राथमिकताएं',
    autoAcceptRides: 'ऑटो-स्वीकार सवारी',
    autoAcceptDesc: 'आसपास के काम स्वतः स्वीकार करें',
    appSounds: 'ऐप ध्वनियाँ',
    appSoundsDesc: 'नए अनुरोधों के लिए अलर्ट बजाएं',
    supportAndLegal: 'सहायता और कानूनी',
    helpCenter: 'सहायता केंद्र',
    statusAssigned: 'सौंपा गया',
    statusPickedUp: 'पिकअप हो गया',
    statusOnTheWay: 'रास्ते में',
    statusDelivered: 'डिलीवर हो गया',
    tripDetails: 'यात्रा का विवरण',
    tripId: 'यात्रा आईडी',
    date: 'दिनांक',
    driverCut: 'ड्राइवर का हिस्सा',
    shipmentInfo: 'शिपमेंट जानकारी',
    goods: 'सामान',
    weight: 'वजन',
    rating: 'रेटिंग',
    route: 'मार्ग',
    builtyReceipt: '📄 बिल्टी रसीद',
    tapToView: 'देखने के लिए टैप करें',
    completed: 'पूरा हुआ',
    totalEarned: 'कुल कमाई',
    totalTrips: 'कुल यात्राएं',
    noTripsYet: 'अभी तक कोई यात्रा नहीं',
    completedTripsHere: 'आपकी पूरी हुई यात्राएं यहाँ दिखाई देंगी',
  },
  pa: {
    online: 'ਆਨਲਾਈਨ',
    offline: 'ਆਫਲਾਈਨ',
    swipeToOnline: 'ਆਨਲਾਈਨ ਜਾਣ ਲਈ ਸਵਾਈਪ ਕਰੋ',
    tripHistory: '📋  ਯਾਤਰਾ ਇਤਿਹਾਸ',
    currentlyOffline: 'ਤੁਸੀਂ ਹੁਣ ਆਫਲਾਈਨ ਹੋ',
    goOnlineDesc: 'ਸ਼ਿਪਮੈਂਟ ਬੇਨਤੀਆਂ ਪ੍ਰਾਪਤ ਕਰਨ ਲਈ ਆਨਲਾਈਨ ਜਾਓ।',
    availableRequests: 'ਉਪਲਬਧ ਬੇਨਤੀਆਂ',
    searching: 'ਬੇਨਤੀਆਂ ਲੱਭ ਰਿਹਾ ਹੈ...',
    goOffline: 'ਆਫਲਾਈਨ ਜਾਓ',
    swipeToOffline: 'ਆਫਲਾਈਨ ਜਾਣ ਲਈ ਸਵਾਈਪ ਕਰੋ',
    driver: 'ਗੋਜ਼ੋ ਡਰਾਈਵਰ',
    viewAndAccept: 'ਦੇਖੋ ਅਤੇ ਸਵੀਕਾਰ ਕਰੋ',
    logout: 'ਲਾਗ ਆਉਟ',
    logoutConfirm: 'ਕੀ ਤੁਸੀਂ ਵਾਕਈ ਲਾਗ ਆਉਟ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹੋ?',
    yourPayout: 'ਤੁਹਾਡੀ ਕਮਾਈ',
    pickup: 'ਪਿਕਅੱਪ',
    drop: 'ਡ੍ਰੌਪ',
    autoCharges: 'ਆਟੋ ਖਰਚੇ',
    ratePerKm: 'ਪ੍ਰਤੀ ਕਿਮੀ ਰੇਟ',
    minimumCharge: 'ਘੱਟੋ-ਘੱਟ ਖਰਚਾ',
    additionalCharges: 'ਵਾਧੂ ਖਰਚੇ',
    waitingCharges: 'ਉਡੀਕ ਖਰਚੇ',
    first15Free: 'ਪਹਿਲੇ 15 ਮਿੰਟ ਮੁਫ਼ਤ',
    pricingDetails: 'ਕੀਮਤ ਵੇਰਵੇ',
    estimatedPayout: 'ਕਮਾਈ',
    reject: '✕  ਰੱਦ ਕਰੋ',
    acceptJob: '✓  ਕੰਮ ਸਵੀਕਾਰ ਕਰੋ',
    jobAccepted: '✅ ਕੰਮ ਸਵੀਕਾਰ! ਪਿਕਅੱਪ ਲਈ ਤਿਆਰ ਹੋਵੋ।',
    headingToPickup: 'ਪਿਕਅੱਪ ਵੱਲ ਜਾ ਰਹੇ ਹਾਂ',
    goodsLoaded: 'ਸਮਾਨ ਲੋਡ ਹੋ ਗਿਆ',
    enRouteToDrop: 'ਡ੍ਰੌਪ ਵੱਲ ਜਾ ਰਹੇ ਹਾਂ',
    delivered: 'ਡਿਲੀਵਰ ਹੋ ਗਿਆ',
    dropOff: 'ਡ੍ਰੌਪ-ਆਫ',
    navigatingTo: 'ਨੈਵੀਗੇਟ ਕਰ ਰਹੇ ਹਾਂ',
    customer: 'ਗਾਹਕ',
    deliveryInProgress: 'ਡਿਲੀਵਰੀ ਜਾਰੀ ਹੈ',
    completeDeliveryFirst: 'ਕਿਰਪਾ ਕਰਕੇ ਵਾਪਸ ਜਾਣ ਤੋਂ ਪਹਿਲਾਂ ਮੌਜੂਦਾ ਡਿਲੀਵਰੀ ਪੂਰੀ ਕਰੋ।',
    goodsPickedUp: '📦  ਸਮਾਨ ਪਿਕ ਅੱਪ ਹੋ ਗਿਆ',
    startTrip: '🚛  ਯਾਤਰਾ ਸ਼ੁਰੂ ਕਰੋ — ਰਸਤੇ ਵਿੱਚ',
    uploadBuilty: '📸  ਬਿਲਟੀ ਅਪਲੋਡ ਕਰੋ ਅਤੇ ਡਿਲੀਵਰ ਕਰੋ',
    deliveryCompleted: '🎉 ਡਿਲੀਵਰੀ ਪੂਰੀ ਹੋਈ! ਬਿਲਟੀ ਅਪਲੋਡ ਹੋ ਗਈ।',
    confirmBuilty: '📄 ਬਿਲਟੀ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ',
    reviewPhoto: 'ਜਮ੍ਹਾ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਫ਼ੋਟੋ ਦੀ ਸਮੀਖਿਆ ਕਰੋ',
    retake: '🔄 ਦੁਬਾਰਾ ਲਓ',
    confirmDeliver: '✅ ਪੁਸ਼ਟੀ ਕਰੋ ਅਤੇ ਡਿਲੀਵਰ ਕਰੋ',
    cancel: 'ਰੱਦ ਕਰੋ',
    jobDetails: 'ਕੰਮ ਦੇ ਵੇਰਵੇ',
    close: 'ਬੰਦ ਕਰੋ',
    myRating: 'ਮੇਰੀ ਰੇਟਿੰਗ',
    pastRides: 'ਪਿਛਲੀਆਂ ਯਾਤਰਾਵਾਂ',
    earned: 'ਕਮਾਈ',
    vehicle: 'ਵਾਹਨ',
    newShipmentsHere: 'ਤੁਹਾਡੇ ਖੇਤਰ ਵਿੱਚ ਨਵੀਆਂ ਸ਼ਿਪਮੈਂਟਾਂ ਇੱਥੇ ਦਿਖਾਈ ਦੇਣਗੀਆਂ',
    startNavigation: '▶ ਨੈਵੀਗੇਸ਼ਨ ਸ਼ੁਰੂ ਕਰੋ',
    fetchingRoute: 'ਰਸਤਾ ਲੱਭ ਰਿਹਾ ਹੈ...',
    yourLocation: 'ਤੁਹਾਡੀ ਲੋਕੇਸ਼ਨ',
    myEarnings: 'ਮੇਰੀ ਕਮਾਈ',
    earningsComingSoon: 'ਕਮਾਈ ਵਿਸ਼ਲੇਸ਼ਣ ਜਲਦੀ ਆ ਰਿਹਾ ਹੈ!',
    termsTitle: 'ਨਿਯਮ ਅਤੇ ਸ਼ਰਤਾਂ',
    termsComingSoon: 'ਨਿਯਮ ਅਤੇ ਸ਼ਰਤਾਂ ਪੇਜ ਜਲਦੀ ਆ ਰਿਹਾ ਹੈ!',
    exitApp: 'ਐਪ ਬੰਦ ਕਰੋ',
    activeDeliveryWarning: 'ਤੁਹਾਡੀ ਇੱਕ ਡਿਲੀਵਰੀ ਚੱਲ ਰਹੀ ਹੈ। ਵਾਪਸ ਜਾਣ ਦੀ ਬਜਾਏ ਐਪ ਨੂੰ ਮਿਨੀਮਾਈਜ਼ ਕਰੋ।',
    error: 'ਗਲਤੀ',
    connectionFailed: 'ਕਨੈਕਸ਼ਨ ਅਸਫਲ ਰਿਹਾ',
    tripCompletedTitle: '✅ ਯਾਤਰਾ ਪੂਰੀ ਹੋਈ',
    tripCompletedMsg: 'ਬਹੁਤ ਵਧੀਆ! ਬਿਲਟੀ ਅਪਲੋਡ ਹੋ ਗਈ ਹੈ ਅਤੇ ਡਿਲੀਵਰੀ ਪੂਰੀ ਹੋ ਗਈ ਹੈ।',
    ok: 'ਠੀਕ ਹੈ',
    uploadFailed: 'ਅਪਲੋਡ ਅਸਫਲ ਰਿਹਾ',
    couldNotUpload: 'ਬਿਲਟੀ ਅਪਲੋਡ ਨਹੀਂ ਹੋ ਸਕੀ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
    settings: 'ਸੈਟਿੰਗਜ਼',
    driverAccount: 'ਡਰਾਈਵਰ ਖਾਤਾ',
    driverPreferences: 'ਡਰਾਈਵਰ ਤਰਜੀਹਾਂ',
    autoAcceptRides: 'ਆਟੋ-ਸਵੀਕਾਰ ਸਵਾਰੀਆਂ',
    autoAcceptDesc: 'ਨੇੜਲੇ ਕੰਮ ਆਪਣੇ ਆਪ ਸਵੀਕਾਰ ਕਰੋ',
    appSounds: 'ਐਪ ਆਵਾਜ਼ਾਂ',
    appSoundsDesc: 'ਨਵੀਆਂ ਬੇਨਤੀਆਂ ਲਈ ਅਲਰਟ ਚਲਾਓ',
    supportAndLegal: 'ਸਹਾਇਤਾ ਅਤੇ ਕਾਨੂੰਨੀ',
    helpCenter: 'ਸਹਾਇਤਾ ਕੇਂਦਰ',
    statusAssigned: 'ਸੌਂਪਿਆ ਗਿਆ',
    statusPickedUp: 'ਪਿਕਅੱਪ ਹੋ ਗਿਆ',
    statusOnTheWay: 'ਰਸਤੇ ਵਿੱਚ',
    statusDelivered: 'ਡਿਲੀਵਰ ਹੋ ਗਿਆ',
    tripDetails: 'ਯਾਤਰਾ ਦੇ ਵੇਰਵੇ',
    tripId: 'ਯਾਤਰਾ ਆਈਡੀ',
    date: 'ਮਿਤੀ',
    driverCut: 'ਡਰਾਈਵਰ ਦਾ ਹਿੱਸਾ',
    shipmentInfo: 'ਸ਼ਿਪਮੈਂਟ ਜਾਣਕਾਰੀ',
    goods: 'ਸਮਾਨ',
    weight: 'ਭਾਰ',
    rating: 'ਰੇਟਿੰਗ',
    route: 'ਰਸਤਾ',
    builtyReceipt: '📄 ਬਿਲਟੀ ਰਸੀਦ',
    tapToView: 'ਦੇਖਣ ਲਈ ਟੈਪ ਕਰੋ',
    completed: 'ਪੂਰਾ ਹੋਇਆ',
    totalEarned: 'ਕੁੱਲ ਕਮਾਈ',
    totalTrips: 'ਕੁੱਲ ਯਾਤਰਾਵਾਂ',
    noTripsYet: 'ਅਜੇ ਤੱਕ ਕੋਈ ਯਾਤਰਾ ਨਹੀਂ',
    completedTripsHere: 'ਤੁਹਾਡੀਆਂ ਪੂਰੀਆਂ ਹੋਈਆਂ ਯਾਤਰਾਵਾਂ ਇੱਥੇ ਦਿਖਾਈ ਦੇਣਗੀਆਂ',
  }
};

type Language = 'en' | 'hi' | 'pa';

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
  const [isUpdatingPickedUp, setIsUpdatingPickedUp] = useState(false);
  const [isUpdatingOnTheWay, setIsUpdatingOnTheWay] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showBuiltyCamera, setShowBuiltyCamera] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showScheduledRides, setShowScheduledRides] = useState(false);
  const [selectedScheduledRideId, setSelectedScheduledRideId] = useState<string | null>(null);
  const [isStateLoaded, setIsStateLoaded] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  const [driverName, setDriverName] = useState<string>('Driver');
  const [vehicleInfo, setVehicleInfo] = useState<string>('Vehicle');
  const t = translations[language];

  const navigationRef = createNavigationContainerRef<RootStackParamList>();

  useEffect(() => {
    const loadDriverProfile = async () => {
      if (!transporterId) return;
      try {
        const res = await fetchUserProfile(transporterId);
        if (res.success && res.user) {
          if (res.user.name) setDriverName(res.user.name);
          if (res.user.factory_name) setVehicleInfo(res.user.factory_name);
        }
      } catch (err) {
        console.warn('Error loading driver profile:', err);
      }
    };
    loadDriverProfile();
  }, [transporterId]);

  useEffect(() => {
    const loadPersistedState = async () => {
      try {
        const storedLanguage = await AsyncStorage.getItem('driver_language');
        if (storedLanguage) setLanguage(storedLanguage as Language);

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

  // ─── Active Ride Recovery: verify restored ride with backend on startup ───
  // Runs once after persisted state is loaded. If the ride is no longer
  // assigned to this driver (completed/taken by someone else), clears stale state.
  useEffect(() => {
    if (!isStateLoaded) return;
    if (acceptStatus !== 'accepted' || !incomingRequest?.requestId || !transporterId) return;

    const verifyActiveRide = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/gozo/driver-location/${incomingRequest.requestId}`);
        const data = await res.json();

        if (!data.success) {
          // Ride no longer exists — clear stale state silently
          console.warn('[GoZo] Persisted ride not found on server, clearing state.');
          setAcceptStatus(null);
          setIncomingRequest(null);
          setTripStatus('matched');
          return;
        }

        const activeStatuses = ['matched', 'on_the_way', 'arrived', 'picked_up'];
        if (!activeStatuses.includes(data.location?.status)) {
          // Ride is done or cancelled — clear stale state
          console.log('[GoZo] Persisted ride status:', data.location?.status, '— clearing.');
          setAcceptStatus(null);
          setIncomingRequest(null);
          setTripStatus('matched');
        } else {
          console.log('[GoZo] Resumed active ride:', incomingRequest.requestId, 'status:', data.location?.status);
        }
      } catch (err: any) {
        console.warn('[GoZo] Active ride verification failed:', err.message);
        // Network error — keep existing state, driver will see the ride
      }
    };

    verifyActiveRide();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStateLoaded]);

  // Sync online/offline status + GPS location with the backend
  useEffect(() => {
    if (!isStateLoaded) return;
    AsyncStorage.setItem('driver_isOnline', isOnline.toString());

    if (!transporterId) return;

    // Helper: get GPS and send status to backend
    const sendStatusWithLocation = () => {
      Geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          updateDriverStatus(transporterId, isOnline, latitude, longitude);
        },
        () => {
          // GPS failed — send status without location
          updateDriverStatus(transporterId, isOnline);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
      );
    };

    sendStatusWithLocation();

    // Sync DB status column
    if (acceptStatus === 'accepted') {
      updateDriverDbStatus(transporterId, 'in_ride');
    } else {
      updateDriverDbStatus(transporterId, isOnline ? 'available' : 'offline');
    }

    // While online, refresh location to backend every 60 seconds
    let locationInterval: any;
    if (isOnline) {
      locationInterval = setInterval(sendStatusWithLocation, 60000);
    }

    return () => {
      if (locationInterval) clearInterval(locationInterval);
    };
  }, [isOnline, isStateLoaded, transporterId, acceptStatus]);

  useEffect(() => {
    if (isStateLoaded) {
      AsyncStorage.setItem('driver_language', language);
    }
  }, [language, isStateLoaded]);

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

  const incomingRequestRef = useRef<IncomingRequest | null>(null);
  useEffect(() => {
    incomingRequestRef.current = incomingRequest;
  }, [incomingRequest]);

  useEffect(() => {
    const unsubscribeMessage = messaging().onMessage(async (remoteMessage) => {
      if (remoteMessage.data?.type === 'NEW_REQUEST') {
        const newRequest: IncomingRequest = {
          requestId: readDataString(remoteMessage.data?.requestId),
          goodsType: readDataString(remoteMessage.data?.goodsType),
          weightKg: readDataString(remoteMessage.data?.weightKg),
          pickupAddress: readDataString(remoteMessage.data?.pickupAddress),
          dropAddress: readDataString(remoteMessage.data?.dropAddress),
          ownerId: readDataString(remoteMessage.data?.ownerId),
          priceInr: readDataString(remoteMessage.data?.priceInr),
          basePrice: readDataString(remoteMessage.data?.basePrice),
          estimatedFreight: readDataString(remoteMessage.data?.estimatedFreight),
          serviceFee: readDataString(remoteMessage.data?.serviceFee),
        };
        setIncomingRequest(newRequest);
        setAcceptStatus(null);
      } else if (remoteMessage.data?.type === 'REQUEST_CANCELLED') {
        const cancelledReqId = remoteMessage.data?.requestId;
        const currentReq = incomingRequestRef.current;
        if (currentReq && currentReq.requestId === cancelledReqId) {
          Alert.alert(
            'Trip Cancelled',
            'This shipment has been cancelled by the owner. Returning to home screen.'
          );
          setAcceptStatus(null);
          setIncomingRequest(null);
          setTripStatus('matched');
          setBuiltyImage(null);
          if (transporterId) {
            updateDriverDbStatus(transporterId, isOnline ? 'available' : 'offline');
          }
          if (navigationRef.isReady()) {
            navigationRef.reset({ index: 0, routes: [{ name: 'Home' }] });
          }
        }
      } else {
        const msgType = readDataString(remoteMessage.data?.type);
        if (msgType.startsWith('scheduled_ride_')) {
          const rideId = readDataString(remoteMessage.data?.rideId);
          const title = remoteMessage.notification?.title || 'Scheduled Ride Update';
          const body = remoteMessage.notification?.body || 'You have a scheduled ride update.';
          if (rideId) {
            Alert.alert(
              title,
              body,
              [
                { text: 'Later', style: 'cancel' },
                {
                  text: 'View',
                  onPress: () => {
                    setSelectedScheduledRideId(rideId);
                    setShowScheduledRides(true);
                  }
                }
              ]
            );
          }
        }
      }
    });

    return () => {
      unsubscribeMessage();
    };
  }, []);

  // ─── Poll request status to detect cancellation ───
  useEffect(() => {
    if (acceptStatus !== 'accepted' || !incomingRequest) {
      return;
    }

    const interval = setInterval(async () => {
      const res = await fetchRequestDetails(incomingRequest.requestId);
      if (res.success && res.request) {
        if (res.request.status === 'cancelled') {
          clearInterval(interval);
          Alert.alert(
            'Trip Cancelled',
            'This shipment has been cancelled by the owner. Returning to home screen.'
          );
          setAcceptStatus(null);
          setIncomingRequest(null);
          setTripStatus('matched');
          setBuiltyImage(null);
          if (navigationRef.isReady()) {
            navigationRef.reset({ index: 0, routes: [{ name: 'Home' }] });
          }
        }
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [acceptStatus, incomingRequest]);

  // ─── Live Location Broadcasting ───
  useEffect(() => {
    if (acceptStatus !== 'accepted' || !incomingRequest || tripStatus === 'completed') {
      return;
    }

    let watchId: number | null = null;
    let lastSendTime = 0;
    const SEND_INTERVAL_MS = 4000; // Send location every 4 seconds

    // Immediately get initial position to populate database coordinates right away
    Geolocation.getCurrentPosition(
      (position) => {
        if (transporterId) {
          updateDriverLocation(
            incomingRequest.requestId,
            transporterId,
            position.coords.latitude,
            position.coords.longitude,
            position.coords.heading || 0,
          ).catch((err) => console.warn('[Location] Initial send failed:', err));
        }
      },
      (error) => {
        console.warn('[Location] Initial getCurrentPosition error:', error.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );

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

  // ─── Helper: reset all ride state and return driver to Home screen ───
  const resetRideState = (message?: string) => {
    setAcceptStatus(null);
    setIncomingRequest(null);
    setTripStatus('matched');
    setBuiltyImage(null);
    setShowBuiltyPreview(false);
    if (transporterId) {
      updateDriverDbStatus(transporterId, isOnline ? 'available' : 'offline');
    }
    if (navigationRef.isReady()) {
      navigationRef.reset({ index: 0, routes: [{ name: 'Home' }] });
    }
    if (message) {
      Alert.alert('Ride Unavailable', message);
    }
  };

  const handleAccept = async () => {
    if (!incomingRequest || !transporterId) return;
    try {
      const response = await acceptRequest(incomingRequest.requestId, transporterId);
      if (response.success) {
        try {
          // 1. Update DB status first — await so any error is caught below
          await updateDriverDbStatus(transporterId, 'in_ride');
        } catch (dbErr: any) {
          // DB status update failed — log but don't crash; ride is still accepted
          console.error('[GoZo] updateDriverDbStatus failed after acceptance:', dbErr?.message);
        }
        // 2. Update local state — persisted automatically by the useEffects above
        setAcceptStatus('accepted');
        setTripStatus('matched');
      } else {
        // Ride was already accepted by another driver (race condition)
        const errMsg = response.error ?? '';
        const alreadyTaken =
          errMsg.toLowerCase().includes('no longer available') ||
          errMsg.toLowerCase().includes('not assigned') ||
          errMsg.toLowerCase().includes('already accepted') ||
          errMsg.toLowerCase().includes('longer available');
        if (alreadyTaken) {
          resetRideState('This ride was accepted by another driver before you.');
        } else {
          Alert.alert(t.error, errMsg || 'Could not accept request');
        }
      }
    } catch (err) { Alert.alert(t.error, t.connectionFailed); }
  };

  const handleUpdateStatus = async (status: 'picked_up' | 'on_the_way' | 'completed') => {
    if (!incomingRequest || !transporterId) return;

    let setter: ((val: boolean) => void) | null = null;
    if (status === 'picked_up') {
      if (isUpdatingPickedUp) return;
      setter = setIsUpdatingPickedUp;
    } else if (status === 'on_the_way') {
      if (isUpdatingOnTheWay) return;
      setter = setIsUpdatingOnTheWay;
    }

    if (setter) setter(true);
    try {
      const response = await updateTripStatus(incomingRequest.requestId, transporterId, status);
      if (response.success) {
        setTripStatus(status);
      } else {
        // Ride belongs to another driver — auto-redirect to Home
        const errMsg = response.error ?? '';
        const notAssigned =
          errMsg.toLowerCase().includes('not assigned') ||
          errMsg.toLowerCase().includes('no longer available') ||
          errMsg.toLowerCase().includes('already accepted');
        if (notAssigned) {
          resetRideState('This ride was accepted by another driver before you.');
        } else {
          Alert.alert(t.error, errMsg || 'Could not update status');
        }
      }
    } finally {
      if (setter) setter(false);
    }
  };

  const onCaptureBuilty = async () => {
    // Show our custom full-screen camera that forces the back camera
    setShowBuiltyCamera(true);
  };

  // Callback from BuiltyCameraScreen when a base64 image is captured
  const handleBuiltyCapture = (base64Img: string) => {
    setBuiltyImage(base64Img);
    setShowBuiltyPreview(true);
    setShowBuiltyCamera(false);
  };

  // Close the custom camera without capturing
  const handleBuiltyCancel = () => {
    setShowBuiltyCamera(false);
  };

  const uploadBuiltyPhoto = async (base64Img: string) => {
    if (!incomingRequest || !transporterId || isUploadingBuilty) return;
    setIsUploadingBuilty(true);
    try {
      const response = await uploadBuilty(incomingRequest.requestId, transporterId, base64Img);
      if (response.success) {
        setShowBuiltyPreview(false);
        setTripStatus('completed');
        Alert.alert(t.tripCompletedTitle, t.tripCompletedMsg, [
          {
            text: t.ok,
            onPress: () => {
              setAcceptStatus(null);
              setIncomingRequest(null);
              setTripStatus('matched');
              setBuiltyImage(null);
              updateDriverDbStatus(transporterId, isOnline ? 'available' : 'offline');
              if (navigationRef.isReady()) {
                navigationRef.reset({ index: 0, routes: [{ name: 'Home' }] });
              }
            }
          }
        ]);
      } else {
        // Ride belongs to another driver — auto-redirect to Home
        const errMsg = response.error ?? '';
        const notAssigned =
          errMsg.toLowerCase().includes('not assigned') ||
          errMsg.toLowerCase().includes('no longer available') ||
          errMsg.toLowerCase().includes('already accepted');
        if (notAssigned) {
          resetRideState('This ride was accepted by another driver before you.');
        } else {
          Alert.alert(t.uploadFailed, errMsg || t.couldNotUpload);
        }
      }
    } catch (err: any) {
      Alert.alert(t.error, err.message || t.connectionFailed);
    } finally {
      setIsUploadingBuilty(false);
    }
  };

  const handleDecline = async () => {
    if (!incomingRequest || !transporterId) return;
    try {
      const response = await declineRequest(incomingRequest.requestId, transporterId);
    if (!response.success) {
      Alert.alert(t.error, response.error ?? 'Could not decline request');
      return;
    }
    setAcceptStatus('declined');
    setIncomingRequest(null);
    } catch (e) { Alert.alert(t.error, t.connectionFailed); }
  };

  // ─── Booking Request Card Component ───
  // (Moved outside App)

  if (showHistory) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <DriverHistoryScreen transporterId={transporterId || ''} onBack={() => setShowHistory(false)} t={t} />
      </GestureHandlerRootView>
    );
  }

  if (showScheduledRides && selectedScheduledRideId) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <DriverScheduledRideDetailScreen
          rideId={selectedScheduledRideId}
          transporterId={transporterId || ''}
          onBack={() => {
            setSelectedScheduledRideId(null);
          }}
          onRideStarted={() => {
            setSelectedScheduledRideId(null);
            setShowScheduledRides(false);
          }}
          t={t}
        />
      </GestureHandlerRootView>
    );
  }

  if (showScheduledRides) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <DriverScheduledRidesScreen
          transporterId={transporterId || ''}
          onBack={() => setShowScheduledRides(false)}
          onSelectRide={(rideId) => setSelectedScheduledRideId(rideId)}
          t={t}
        />
      </GestureHandlerRootView>
    );
  }

  if (showBuiltyCamera) {
    return (
      <BuiltyCameraScreen
        onCapture={handleBuiltyCapture}
        onCancel={handleBuiltyCancel}
      />
    );
  }

  if (showSettings) {
    return (
      <DriverSettingsScreen
        onBack={() => setShowSettings(false)}
        onLogout={async () => {
          await AsyncStorage.removeItem('gozo_driver_id');
          await AsyncStorage.removeItem('driver_isOnline');
          setTransporterId(null);
          setIsOnline(false);
          setShowSettings(false);
          setDriverName('Driver');
          setVehicleInfo('Vehicle');
          setIncomingRequest(null);
          setAcceptStatus(null);
          setTripStatus('matched');
          setBuiltyImage(null);
          setShowBuiltyPreview(false);
          setIsUploadingBuilty(false);
          setShowHistory(false);
          setShowBuiltyCamera(false);
          setShowSidebar(false);
          setShowScheduledRides(false);
          setSelectedScheduledRideId(null);
          setActiveRequests([]);
        }}
        language={language}
        setLanguage={setLanguage}
        t={t}
        driverId={transporterId || ''}
      />
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
            <Stack.Screen name="Home">
              {(props) => (
                <HomeScreen
                  {...props}
                  incomingRequest={incomingRequest}
                  setIncomingRequest={setIncomingRequest}
                  acceptStatus={acceptStatus}
                  setAcceptStatus={setAcceptStatus}
                  transporterId={transporterId}
                  setTransporterId={setTransporterId}
                  activeRequests={activeRequests}
                  tripStatus={tripStatus}
                  setTripStatus={setTripStatus}
                  isOnline={isOnline}
                  setIsOnline={setIsOnline}
                  builtyImage={builtyImage}
                  setBuiltyImage={setBuiltyImage}
                  showBuiltyPreview={showBuiltyPreview}
                  setShowBuiltyPreview={setShowBuiltyPreview}
                  isUploadingBuilty={isUploadingBuilty}
                  setIsUploadingBuilty={setIsUploadingBuilty}
                  isUpdatingPickedUp={isUpdatingPickedUp}
                  isUpdatingOnTheWay={isUpdatingOnTheWay}
                  setShowHistory={setShowHistory}
                  setShowSettings={setShowSettings}
                  showSidebar={showSidebar}
                  setShowSidebar={setShowSidebar}
                  setShowBuiltyCamera={setShowBuiltyCamera}
                  setSelectedScheduledRideId={setSelectedScheduledRideId}
                  setActiveRequests={setActiveRequests}
                  isStateLoaded={isStateLoaded}
                  language={language}
                  t={t}
                  driverName={driverName}
                  vehicleInfo={vehicleInfo}
                  loadActiveRequests={loadActiveRequests}
                  handleAccept={handleAccept}
                  handleDecline={handleDecline}
                  handleUpdateStatus={handleUpdateStatus}
                  onCaptureBuilty={onCaptureBuilty}
                  uploadBuiltyPhoto={uploadBuiltyPhoto}
                  setDriverName={setDriverName}
                  setVehicleInfo={setVehicleInfo}
                  setShowScheduledRides={setShowScheduledRides}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Navigation">
              {(props) => (
                <NavigationScreen
                  {...props}
                  // @ts-ignore
                  requestId={incomingRequest?.requestId || ''}
                  transporterId={transporterId || ''}
                  pickupAddress={incomingRequest?.pickupAddress || ''}
                  dropAddress={incomingRequest?.dropAddress || ''}
                  goodsType={incomingRequest?.goodsType || ''}
                  weightKg={Number(incomingRequest?.weightKg || 0)}
                  priceInr={Number(incomingRequest?.priceInr || 0)}
                  status={tripStatus}
                  onStatusChange={(newStatus: any) => {
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

// ─── HELPER FUNCTIONS ───
const getInitials = (name: string) => {
  if (!name) return 'D';
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
};

// ─── SWIPE BUTTON COMPONENT ───
const SwipeButton = ({ 
  onSwipeSuccess, 
  text, 
  variant = 'online',
  style,
}: { 
  onSwipeSuccess: () => void; 
  text: string; 
  variant?: 'online' | 'offline';
  style?: any;
}) => {
  const pan = useRef(new Animated.ValueXY()).current;
  const busyRef = useRef(false);
  const SWIPE_WIDTH = Dimensions.get('window').width - 64; 
  const BUTTON_WIDTH = 56;
  const swipeThreshold = SWIPE_WIDTH - BUTTON_WIDTH - 8;

  // Reset thumb position whenever the component mounts / variant changes
  useEffect(() => {
    pan.setValue({ x: 0, y: 0 });
    busyRef.current = false;
  }, [variant]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return !busyRef.current && Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 20;
      },
      onPanResponderMove: (_, gestureState) => {
        if (busyRef.current) return;
        const clampedX = Math.min(Math.max(gestureState.dx, 0), swipeThreshold);
        pan.setValue({ x: clampedX, y: 0 });
      },
      onPanResponderRelease: (_, gestureState) => {
        if (busyRef.current) return;
        if (gestureState.dx >= swipeThreshold * 0.7) {
          busyRef.current = true;
          Animated.spring(pan, {
            toValue: { x: swipeThreshold, y: 0 },
            useNativeDriver: false,
          }).start(() => {
            onSwipeSuccess();
            // Reset after a short delay so next render has thumb at start
            setTimeout(() => {
              pan.setValue({ x: 0, y: 0 });
              busyRef.current = false;
            }, 300);
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

  const isOffline = variant === 'offline';

  return (
    <View style={[s.swipeContainer, isOffline && s.swipeContainerOffline, style]}>
      <Text style={[s.swipeText, isOffline && s.swipeTextOffline]}>{text}</Text>
      <Animated.View
        style={[s.swipeBtn, isOffline && s.swipeBtnOffline, { transform: [{ translateX: pan.x }] }]}
        {...panResponder.panHandlers}
      >
        <Text style={s.swipeBtnIcon}>→</Text>
      </Animated.View>
    </View>
  );
};

// ─── BOOKING CARD COMPONENT ───
const BookingCard = ({
  req,
  showActions = true,
  acceptStatus,
  handleDecline,
  handleAccept,
  t,
}: {
  req: IncomingRequest | ActiveRequest;
  showActions?: boolean;
  acceptStatus?: string | null;
  handleDecline?: () => void;
  handleAccept?: () => void;
  t: any;
}) => {
  const isIncoming = 'requestId' in req;
  const goodsType = isIncoming ? req.goodsType : req.goods_type;
  const weightKg = isIncoming ? req.weightKg : req.weight_kg;
  const pickupAddress = isIncoming ? req.pickupAddress : req.pickup_address;
  const dropAddress = isIncoming ? req.dropAddress : req.drop_address;
  
  const totalPriceVal = isIncoming
    ? Number(req.priceInr || req.estimatedFreight || 0)
    : Number(req.price_inr || req.estimated_freight || 0);

  const payoutVal = isIncoming
    ? Number(req.estimatedFreight || (totalPriceVal * 0.9))
    : Number(req.estimated_freight || (totalPriceVal * 0.9));

  const isAuto = Number(weightKg) <= 500;
  const payoutDisplay = `₹${payoutVal}`;

  return (
    <View style={s.bookingCard}>
      <View style={s.cardHeader}>
        <View style={[s.goodsTypeBadge, { flex: 1, marginRight: 12 }]}>
          <Text style={{ fontSize: 16, marginRight: 6 }}>📦</Text>
          <Text style={[s.goodsTypeText, { flexShrink: 1 }]} numberOfLines={1}>{goodsType} • {weightKg}kg</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 2 }}>Total: ₹{totalPriceVal}</Text>
          <Text style={s.priceText}>{payoutDisplay}</Text>
          <Text style={{ fontSize: 10, fontWeight: '800', color: '#10B981', textTransform: 'uppercase', marginTop: 1 }}>{t.yourPayout}</Text>
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
            <Text style={s.routeLabel}>{t.pickup}</Text>
            <Text style={s.routeAddress}>{pickupAddress}</Text>
          </View>
          <View style={{ marginTop: 14 }}>
            <Text style={s.routeLabel}>{t.drop}</Text>
            <Text style={s.routeAddress}>{dropAddress}</Text>
          </View>
        </View>
      </View>

      {isAuto ? (
        <View style={s.pricingCardContainer}>
          <View style={s.pricingCardHeader}>
            <Text style={s.pricingCardIcon}>🛺</Text>
            <Text style={s.pricingCardTitle}>{t.autoCharges}</Text>
          </View>

          <View style={s.pricingRow}>
            <Text style={s.pricingLabel}>{t.ratePerKm}</Text>
            <Text style={s.pricingValue}>₹45</Text>
          </View>

          <View style={s.pricingRow}>
            <Text style={s.pricingLabel}>{t.minimumCharge}</Text>
            <Text style={[s.pricingValue, { color: '#059669', fontWeight: '800' }]}>₹200</Text>
          </View>

          <View style={s.pricingDivider} />

          <Text style={s.additionalTitle}>{t.additionalCharges}</Text>

          <View style={s.pricingRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.pricingLabel}>{t.waitingCharges}</Text>
              <Text style={s.pricingSublabel}>{t.first15Free}</Text>
            </View>
            <Text style={s.pricingValue}>₹50 / 30 min</Text>
          </View>
        </View>
      ) : (
        <View style={s.pricingCardContainer}>
          <View style={s.pricingCardHeader}>
            <Text style={s.pricingCardIcon}>🚛</Text>
            <Text style={s.pricingCardTitle}>{t.pricingDetails}</Text>
          </View>
          <View style={s.pricingRow}>
            <Text style={s.pricingLabel}>{t.ratePerKm || 'Rate per km'}</Text>
            <Text style={s.pricingValue}>₹50</Text>
          </View>
          <View style={s.pricingRow}>
            <Text style={s.pricingLabel}>{t.minimumCharge || 'Minimum payout'}</Text>
            <Text style={[s.pricingValue, { color: '#059669', fontWeight: '800' }]}>₹500</Text>
          </View>
          <View style={s.pricingRow}>
            <Text style={s.pricingLabel}>Total Ride Price</Text>
            <Text style={[s.pricingValue, { fontWeight: '700' }]}>₹{totalPriceVal}</Text>
          </View>
          <View style={s.pricingDivider} />
          <View style={s.pricingRow}>
            <Text style={s.pricingLabel}>{t.estimatedPayout}</Text>
            <Text style={[s.pricingValue, { fontWeight: '900', fontSize: 16, color: '#10B981' }]}>₹{payoutVal}</Text>
          </View>
        </View>
      )}

      {showActions && isIncoming && acceptStatus !== 'accepted' && (
        <View style={s.actionRow}>
          <TouchableOpacity style={s.rejectBtn} onPress={handleDecline}>
            <Text style={s.rejectBtnText}>{t.reject}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.acceptBtn} onPress={handleAccept}>
            <Text style={s.acceptBtnText}>{t.acceptJob}</Text>
          </TouchableOpacity>
        </View>
      )}

      {acceptStatus === 'accepted' && showActions && (
        <View style={s.acceptedBanner}>
          <Text style={s.acceptedText}>{t.jobAccepted}</Text>
        </View>
      )}
    </View>
  );
};

// ─── EMBEDDED ROUTE MAP COMPONENT ───
const EmbeddedRouteMap = React.memo(({ destinationAddress, navigation, incomingRequest: req, t }: {
  destinationAddress: string;
  navigation: StackNavigationProp<RootStackParamList>;
  incomingRequest: IncomingRequest;
  t: any;
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
          <Text style={s.mapLoadingText}>{t.fetchingRoute}</Text>
        </View>
      )}
      {route && currentLocation && destCoords && (
        <TouchableOpacity
          style={s.startNavFab}
          onPress={() => navigation.navigate('Navigation', {
            route,
            sourceCoords: currentLocation,
            destinationCoords: destCoords,
            sourceName: t.yourLocation,
            destinationName: destinationAddress,
          })}
        >
          <Text style={s.startNavFabText}>{t.startNavigation}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

// ─── ACTIVE DELIVERY VIEW COMPONENT ───
const ActiveDeliveryView: React.FC<{
  incomingRequest: IncomingRequest;
  acceptStatus: null | 'accepted' | 'declined';
  setAcceptStatus: (val: null | 'accepted' | 'declined') => void;
  tripStatus: 'matched' | 'picked_up' | 'on_the_way' | 'completed';
  setTripStatus: (val: 'matched' | 'picked_up' | 'on_the_way' | 'completed') => void;
  showBuiltyPreview: boolean;
  setShowBuiltyPreview: (val: boolean) => void;
  builtyImage: string | null;
  setBuiltyImage: (val: string | null) => void;
  isUploadingBuilty: boolean;
  isUpdatingPickedUp: boolean;
  isUpdatingOnTheWay: boolean;
  onCaptureBuilty: () => void;
  uploadBuiltyPhoto: (img: string) => void;
  handleUpdateStatus: (status: 'picked_up' | 'on_the_way' | 'completed') => void;
  navigation: StackNavigationProp<RootStackParamList>;
  t: any;
}> = ({
  incomingRequest,
  acceptStatus,
  setAcceptStatus,
  tripStatus,
  setTripStatus,
  showBuiltyPreview,
  setShowBuiltyPreview,
  builtyImage,
  setBuiltyImage,
  isUploadingBuilty,
  isUpdatingPickedUp,
  isUpdatingOnTheWay,
  onCaptureBuilty,
  uploadBuiltyPhoto,
  handleUpdateStatus,
  navigation,
  t,
}) => {
  const gozoId = `GOZO-${incomingRequest.requestId.slice(0, 7).toUpperCase()}`;
  const progressPercent = tripStatus === 'matched' ? 10 : tripStatus === 'picked_up' ? 40 : tripStatus === 'on_the_way' ? 75 : 100;
  const progressLabel = tripStatus === 'matched' ? t.headingToPickup : tripStatus === 'picked_up' ? t.goodsLoaded : tripStatus === 'on_the_way' ? t.enRouteToDrop : t.delivered;



  const destAddress = tripStatus === 'matched' || tripStatus === 'picked_up'
    ? incomingRequest.pickupAddress
    : incomingRequest.dropAddress;
  const destLabel = tripStatus === 'matched' || tripStatus === 'picked_up'
    ? t.pickup
    : t.dropOff;

  return (
    <View style={s.activeDeliveryContainer}>
      <View style={s.embeddedMapContainer}>
        <EmbeddedRouteMap
          destinationAddress={destAddress}
          navigation={navigation}
          incomingRequest={incomingRequest}
          t={t}
        />
        <View style={s.mapOverlayHeader}>
          <TouchableOpacity 
            onPress={() => { 
              if (tripStatus === 'completed') { 
                setAcceptStatus(null); 
                setTripStatus('matched'); 
              } else {
                Alert.alert(t.deliveryInProgress, t.completeDeliveryFirst);
              }
            }} 
            style={s.mapOverlayBtn}
          >
            <Text style={s.mapOverlayBtnText}>←</Text>
          </TouchableOpacity>
          <View style={s.mapOverlayCenter}>
            <Text style={s.mapOverlayTitle}>{gozoId}</Text>
            <Text style={s.mapOverlaySubtitle}>{t.navigatingTo} {destLabel}</Text>
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
              <Text style={s.adCustomerNameInline}>{t.customer}</Text>
              <Text style={s.adCustomerMetaInline}>{incomingRequest.weightKg} kg · {incomingRequest.goodsType}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 10, color: '#6B7280', fontWeight: '700', marginBottom: 1 }}>Total: ₹{incomingRequest.priceInr || incomingRequest.estimatedFreight}</Text>
              <Text style={s.adPriceInline}>
                {`₹${incomingRequest.estimatedFreight || incomingRequest.priceInr}`}
              </Text>
              <Text style={{ fontSize: 9, color: '#10B981', fontWeight: '800', textTransform: 'uppercase' }}>{t.yourPayout}</Text>
            </View>
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

          {Number(incomingRequest.weightKg) <= 500 ? (
            <View style={s.pricingCardContainerActive}>
              <View style={s.pricingCardHeader}>
                <Text style={s.pricingCardIcon}>🛺</Text>
                <Text style={s.pricingCardTitle}>{t.autoCharges}</Text>
              </View>

              <View style={s.pricingRow}>
                <Text style={s.pricingLabel}>{t.ratePerKm}</Text>
                <Text style={s.pricingValue}>₹45</Text>
              </View>

              <View style={s.pricingRow}>
                <Text style={s.pricingLabel}>{t.minimumCharge}</Text>
                <Text style={[s.pricingValue, { color: '#059669', fontWeight: '800' }]}>₹200</Text>
              </View>

              <View style={s.pricingDivider} />

              <Text style={s.additionalTitle}>{t.additionalCharges}</Text>

              <View style={s.pricingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.pricingLabel}>{t.waitingCharges}</Text>
                  <Text style={s.pricingSublabel}>{t.first15Free}</Text>
                </View>
                <Text style={s.pricingValue}>₹50 / 30 min</Text>
              </View>
            </View>
          ) : (
            <View style={s.pricingCardContainerActive}>
              <View style={s.pricingCardHeader}>
                <Text style={s.pricingCardIcon}>🚛</Text>
                <Text style={s.pricingCardTitle}>{t.pricingDetails}</Text>
              </View>
              <View style={s.pricingRow}>
                <Text style={s.pricingLabel}>{t.ratePerKm || 'Rate per km'}</Text>
                <Text style={s.pricingValue}>₹50</Text>
              </View>
              <View style={s.pricingRow}>
                <Text style={s.pricingLabel}>{t.minimumCharge || 'Minimum payout'}</Text>
                <Text style={[s.pricingValue, { color: '#059669', fontWeight: '800' }]}>₹500</Text>
              </View>
              <View style={s.pricingRow}>
                <Text style={s.pricingLabel}>Total Ride Price</Text>
                <Text style={[s.pricingValue, { fontWeight: '700' }]}>₹{incomingRequest.priceInr || incomingRequest.estimatedFreight}</Text>
              </View>
              <View style={s.pricingDivider} />
              <View style={s.pricingRow}>
                <Text style={s.pricingLabel}>{t.estimatedPayout}</Text>
                <Text style={[s.pricingValue, { fontWeight: '900', fontSize: 16, color: '#10B981' }]}>₹{incomingRequest.estimatedFreight || incomingRequest.priceInr}</Text>
              </View>
            </View>
          )}

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
            <TouchableOpacity
              style={[s.reachedBtn, isUpdatingPickedUp && { opacity: 0.6 }]}
              onPress={() => handleUpdateStatus('picked_up')}
              disabled={isUpdatingPickedUp}
            >
              {isUpdatingPickedUp ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.reachedBtnText}>{t.goodsPickedUp}</Text>
              )}
            </TouchableOpacity>
          )}
          {tripStatus === 'picked_up' && (
            <TouchableOpacity
              style={[s.reachedBtn, { backgroundColor: '#1A56DB' }, isUpdatingOnTheWay && { opacity: 0.6 }]}
              onPress={() => handleUpdateStatus('on_the_way')}
              disabled={isUpdatingOnTheWay}
            >
              {isUpdatingOnTheWay ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.reachedBtnText}>{t.startTrip}</Text>
              )}
            </TouchableOpacity>
          )}
          {tripStatus === 'on_the_way' && (
            <TouchableOpacity style={[s.reachedBtn, { backgroundColor: '#7C3AED' }]} onPress={onCaptureBuilty}>
              <Text style={s.reachedBtnText}>{t.uploadBuilty}</Text>
            </TouchableOpacity>
          )}
          {tripStatus === 'completed' && (
            <View style={s.completedBanner}>
              <Text style={s.completedText}>{t.deliveryCompleted}</Text>
            </View>
          )}

          <Modal visible={showBuiltyPreview} transparent animationType="slide">
            <View style={s.builtyModalOverlay}>
              <View style={s.builtyModalCard}>
                <Text style={s.builtyModalTitle}>{t.confirmBuilty}</Text>
                <Text style={s.builtyModalSubtitle}>{t.reviewPhoto}</Text>
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
                    <Text style={s.builtyRetakeBtnText}>{t.retake}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.builtyConfirmBtn, isUploadingBuilty && { opacity: 0.6 }]}
                    onPress={() => builtyImage && uploadBuiltyPhoto(builtyImage)}
                    disabled={isUploadingBuilty}
                  >
                    {isUploadingBuilty ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={s.builtyConfirmBtnText}>{t.confirmDeliver}</Text>
                    )}
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={s.builtyCloseBtn}
                  onPress={() => { setShowBuiltyPreview(false); setBuiltyImage(null); }}
                  disabled={isUploadingBuilty}
                >
                  <Text style={s.builtyCloseBtnText}>{t.cancel}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </ScrollView>
      </View>
    </View>
  );
};

// ─── HOME SCREEN COMPONENT ───
const HomeScreen = ({
  incomingRequest,
  setIncomingRequest,
  acceptStatus,
  setAcceptStatus,
  transporterId,
  setTransporterId,
  activeRequests,
  setActiveRequests,
  tripStatus,
  setTripStatus,
  isOnline,
  setIsOnline,
  builtyImage,
  setBuiltyImage,
  showBuiltyPreview,
  setShowBuiltyPreview,
  isUploadingBuilty,
  setIsUploadingBuilty,
  isUpdatingPickedUp,
  isUpdatingOnTheWay,
  setShowHistory,
  setShowSettings,
  showSidebar,
  setShowSidebar,
  setShowBuiltyCamera,
  setSelectedScheduledRideId,
  isStateLoaded,
  language,
  t,
  driverName,
  vehicleInfo,
  loadActiveRequests,
  handleAccept,
  handleDecline,
  handleUpdateStatus,
  onCaptureBuilty,
  uploadBuiltyPhoto,
  setDriverName,
  setVehicleInfo,
  setShowScheduledRides,
}: {
  incomingRequest: IncomingRequest | null;
  setIncomingRequest: (req: IncomingRequest | null) => void;
  acceptStatus: null | 'accepted' | 'declined';
  setAcceptStatus: (status: null | 'accepted' | 'declined') => void;
  transporterId: string | null;
  setTransporterId: (id: string | null) => void;
  activeRequests: ActiveRequest[];
  setActiveRequests: (reqs: ActiveRequest[]) => void;
  tripStatus: 'matched' | 'picked_up' | 'on_the_way' | 'completed';
  setTripStatus: (status: 'matched' | 'picked_up' | 'on_the_way' | 'completed') => void;
  isOnline: boolean;
  setIsOnline: (online: boolean) => void;
  builtyImage: string | null;
  setBuiltyImage: (img: string | null) => void;
  showBuiltyPreview: boolean;
  setShowBuiltyPreview: (show: boolean) => void;
  isUploadingBuilty: boolean;
  setIsUploadingBuilty: (val: boolean) => void;
  isUpdatingPickedUp: boolean;
  isUpdatingOnTheWay: boolean;
  setShowHistory: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  showSidebar: boolean;
  setShowSidebar: (show: boolean) => void;
  setShowBuiltyCamera: (show: boolean) => void;
  setSelectedScheduledRideId: (id: string | null) => void;
  isStateLoaded: boolean;
  language: Language;
  t: any;
  driverName: string;
  vehicleInfo: string;
  loadActiveRequests: () => void;
  handleAccept: () => void;
  handleDecline: () => void;
  handleUpdateStatus: (status: 'picked_up' | 'on_the_way' | 'completed') => void;
  onCaptureBuilty: () => void;
  uploadBuiltyPhoto: (img: string) => void;
  setDriverName: (name: string) => void;
  setVehicleInfo: (info: string) => void;
  setShowScheduledRides: (show: boolean) => void;
}) => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  // ─── Driver Stats from DB ───
  const [driverStats, setDriverStats] = useState<{
    totalTrips: number;
    completedTrips: number;
    totalEarned: number;
    avgRating: number | null;
  }>({ totalTrips: 0, completedTrips: 0, totalEarned: 0, avgRating: null });

  useEffect(() => {
    if (!transporterId) return;
    const loadStats = async () => {
      try {
        const res = await fetchDriverStats(transporterId);
        if (res.success && res.stats) {
          setDriverStats(res.stats);
        }
      } catch (err) {
        console.warn('Error loading driver stats:', err);
      }
    };
    loadStats();
  }, [transporterId]);

  const Header = () => (
    <View style={s.screenHeaderBar}>
      <TouchableOpacity style={s.hamburgerBtn} onPress={() => setShowSidebar(true)}>
        <Text style={s.hamburgerIcon}>☰</Text>
      </TouchableOpacity>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.screenHeaderTitle}>{t.driver}</Text>
        <Text style={s.screenHeaderSub}>{isOnline ? t.online : t.offline}</Text>
      </View>
      <View style={[s.headerStatusDot, { backgroundColor: isOnline ? '#22C55E' : '#D1D5DB' }]} />
    </View>
  );

  useEffect(() => {
    const backAction = () => {
      if (acceptStatus === 'accepted' && tripStatus !== 'completed') {
        Alert.alert(t.deliveryInProgress, t.activeDeliveryWarning, [
          { text: t.cancel, style: 'cancel' },
          { text: t.exitApp, onPress: () => BackHandler.exitApp() }
        ]);
        return true; 
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [acceptStatus, tripStatus]);

  useEffect(() => {
    let interval: any;
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
          <Text style={s.avatarText}>{getInitials(driverName)}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.driverName}>{driverName}</Text>
          <Text style={s.vehicleInfo}>{vehicleInfo ? `${vehicleInfo}` : 'Eicher 14 ft'} · {t.vehicle}</Text>
        </View>
        <View style={[s.onlineBadge, { backgroundColor: isOnline ? '#DCFCE7' : '#F3F4F6' }]}>
          <Text style={[s.onlineText, { color: isOnline ? '#16A34A' : '#6B7280' }]}>
            {isOnline ? t.online : t.offline}
          </Text>
        </View>
      </View>

      {acceptStatus === 'accepted' && incomingRequest ? (
        <ActiveDeliveryView
          incomingRequest={incomingRequest}
          acceptStatus={acceptStatus}
          setAcceptStatus={setAcceptStatus}
          tripStatus={tripStatus}
          setTripStatus={setTripStatus}
          showBuiltyPreview={showBuiltyPreview}
          setShowBuiltyPreview={setShowBuiltyPreview}
          builtyImage={builtyImage}
          setBuiltyImage={setBuiltyImage}
          isUploadingBuilty={isUploadingBuilty}
          isUpdatingPickedUp={isUpdatingPickedUp}
          isUpdatingOnTheWay={isUpdatingOnTheWay}
          onCaptureBuilty={onCaptureBuilty}
          uploadBuiltyPhoto={uploadBuiltyPhoto}
          handleUpdateStatus={handleUpdateStatus}
          navigation={navigation}
          t={t}
        />
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView 
            style={{ flex: 1 }} 
            contentContainerStyle={{ 
              paddingBottom: 120, 
              ...(isOnline ? {} : { flexGrow: 1 }) 
            }}
          >
            {incomingRequest ? (
              <View style={{ flex: 1, marginTop: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginBottom: 12 }}>
                  <Text style={[s.sectionTitle, { marginHorizontal: 0, marginTop: 0, marginBottom: 0 }]}>{t.jobDetails}</Text>
                  <TouchableOpacity onPress={() => setIncomingRequest(null)} style={{ padding: 4 }}>
                    <Text style={{ color: '#1A56DB', fontWeight: 'bold', fontSize: 14 }}>{t.close}</Text>
                  </TouchableOpacity>
                </View>
                <BookingCard 
                  req={incomingRequest} 
                  showActions={true} 
                  acceptStatus={acceptStatus}
                  handleAccept={handleAccept}
                  handleDecline={handleDecline}
                  t={t}
                />
              </View>
            ) : !isOnline ? (
              <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 16 }}>
                <View style={s.offlineState}>
                  <Text style={{ fontSize: 64, marginBottom: 16 }}>😴</Text>
                  <Text style={s.offlineTitle}>{t.currentlyOffline}</Text>
                  <Text style={s.offlineSub}>{t.goOnlineDesc}</Text>
                </View>

                <View style={s.statsCard}>
                  <View style={s.statItem}>
                    <Text style={s.statValue}>⭐ {driverStats.avgRating != null ? driverStats.avgRating.toFixed(1) : '--'}</Text>
                    <Text style={s.statLabel}>{t.myRating}</Text>
                  </View>
                  <View style={s.statDivider} />
                  <View style={s.statItem}>
                    <Text style={s.statValue}>{driverStats.totalTrips}</Text>
                    <Text style={s.statLabel}>{t.pastRides}</Text>
                  </View>
                  <View style={s.statDivider} />
                  <View style={s.statItem}>
                    <Text style={s.statValue}>{driverStats.totalEarned >= 1000 ? `\u20B9${(driverStats.totalEarned / 1000).toFixed(1)}k` : `\u20B9${driverStats.totalEarned}`}</Text>
                    <Text style={s.statLabel}>{t.earned}</Text>
                  </View>
                </View>

                <TouchableOpacity style={s.historyBtn} onPress={() => setShowHistory(true)} activeOpacity={0.8}>
                  <Text style={s.historyBtnText}>{t.tripHistory}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginTop: 16, marginBottom: 8 }}>
                  <Text style={[s.sectionTitle, { marginHorizontal: 0, marginTop: 0, marginBottom: 0 }]}>{t.availableRequests} ({activeRequests.length})</Text>
                </View>

                {activeRequests.length > 0 ? (
                  activeRequests.map((item) => (
                    <View key={item.id}>
                      <BookingCard req={item} showActions={false} t={t} />
                      <TouchableOpacity
                        style={[s.acceptFullBtn, { marginHorizontal: 16, marginTop: -6, marginBottom: 14 }]}
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
                            estimatedFreight: String(item.estimated_freight || item.price_inr),
                          });
                          setAcceptStatus(null);
                        }}
                      >
                        <Text style={s.acceptFullBtnText}>{t.viewAndAccept}</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                ) : (
                  <View style={s.waitingCard}>
                    <Text style={{ fontSize: 40 }}>📡</Text>
                    <Text style={s.waitingTitle}>{t.searching}</Text>
                    <Text style={s.waitingSub}>{t.newShipmentsHere}</Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {!incomingRequest && (
            <View style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              paddingHorizontal: 20,
              paddingBottom: 24,
              paddingTop: 12,
              backgroundColor: '#F5F7FA',
              borderTopWidth: 1,
              borderTopColor: '#EEF2F6',
            }}>
              {!isOnline ? (
                <SwipeButton 
                  key="go-online"
                  onSwipeSuccess={() => setIsOnline(true)} 
                  text={t.swipeToOnline} 
                  style={{ marginBottom: 0 }} 
                />
              ) : (
                <SwipeButton 
                  key="go-offline"
                  onSwipeSuccess={() => setIsOnline(false)} 
                  text={t.swipeToOffline} 
                  variant="offline" 
                  style={{ marginBottom: 0 }} 
                />
              )}
            </View>
          )}
        </View>
      )}

      {/* Sidebar Drawer */}
      <SidebarDrawer
        visible={showSidebar}
        onClose={() => setShowSidebar(false)}
        onNavigate={(screen) => {
          switch (screen) {
            case 'history':
              setShowHistory(true);
              break;
            case 'profile':
            case 'language':
              setShowSettings(true);
              break;
            case 'scheduled_rides':
              setShowScheduledRides(true);
              break;
            case 'earnings':
              Alert.alert('My Earnings', 'Earnings analysis coming soon!');
              break;
            case 'terms':
              Alert.alert('Terms & Conditions', 'Terms and conditions page coming soon!');
              break;
          }
        }}
        onLogout={() => {
          Alert.alert(t.logout, t.logoutConfirm, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: t.logout,
              style: 'destructive',
              onPress: async () => {
                await AsyncStorage.removeItem('gozo_driver_id');
                await AsyncStorage.removeItem('driver_isOnline');
                setTransporterId(null);
                setIsOnline(false);
                setDriverName('Driver');
                setVehicleInfo('Vehicle');
                setIncomingRequest(null);
                setAcceptStatus(null);
                setTripStatus('matched');
                setBuiltyImage(null);
                setShowBuiltyPreview(false);
                setIsUploadingBuilty(false);
                setShowHistory(false);
                setShowBuiltyCamera(false);
                setShowSidebar(false);
                setShowScheduledRides(false);
                setSelectedScheduledRideId(null);
                setActiveRequests([]);
              },
            },
          ]);
        }}
        isOnline={isOnline}
        driverName={driverName}
        language={language}
        t={t}
      />
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  profileHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1.5, borderBottomColor: '#EEF2F6', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 6 },
  avatarCircle: { width: 50, height: 50, borderRadius: 16, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  payoutLabel: { fontSize: 12, fontWeight: '800', color: '#10B981', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.8 },
  priceText: { fontSize: 20, fontWeight: '900', color: '#10B981' },
  driverName: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  vehicleInfo: { fontSize: 13, color: '#64748B', marginTop: 2, fontWeight: '600' },
  onlineBadge: { backgroundColor: '#D1FAE5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: '#A7F3D0' },
  onlineText: { color: '#065F46', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginHorizontal: 20, marginTop: 24, marginBottom: 14, letterSpacing: 0.2 },
  bookingCard: { 
    marginHorizontal: 20, 
    backgroundColor: '#FFFFFF', 
    borderRadius: 22, 
    padding: 18, 
    marginBottom: 16, 
    elevation: 4, 
    shadowColor: '#6366F1', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 10, 
    borderWidth: 1.5, 
    borderColor: '#EEF2F6' 
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  gozoId: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
  customerName: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginTop: 2 },
  payoutAmount: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginTop: 2 },
  goodsTypeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  goodsTypeText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  routeContainer: { flexDirection: 'row', paddingVertical: 14, borderTopWidth: 1.5, borderTopColor: '#F1F5F9' },
  routeDots: { alignItems: 'center', marginRight: 14, paddingTop: 4 },
  greenDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#10B981', borderWidth: 3, borderColor: '#D1FAE5' },
  blueDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#6366F1', borderWidth: 3, borderColor: '#E0E7FF' },
  routeLine: { width: 2, height: 32, backgroundColor: '#E2E8F0', marginVertical: 3 },
  routeTexts: { flex: 1 },
  routeLabel: { fontSize: 11, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8 },
  routeAddress: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginTop: 3 },
  chipsRow: { flexDirection: 'row', marginTop: 14, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2F6', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  chipIcon: { fontSize: 14, marginRight: 4 },
  chipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  infoBox: { marginTop: 14, backgroundColor: '#D1FAE5', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#A7F3D0' },
  infoBoxText: { fontSize: 13, color: '#065F46', fontWeight: '600', lineHeight: 20 },
  actionRow: { flexDirection: 'row', marginTop: 16, gap: 12 },
  rejectBtn: { flex: 1, borderWidth: 2, borderColor: '#FCA5A5', borderRadius: 16, paddingVertical: 16, backgroundColor: '#FFF' },
  rejectBtnText: { textAlign: 'center', color: '#DC2626', fontSize: 15, fontWeight: '800' },
  acceptBtn: { flex: 1.3, backgroundColor: '#10B981', borderRadius: 16, paddingVertical: 16, elevation: 4, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  acceptBtnText: { textAlign: 'center', color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  acceptedBanner: { marginTop: 14, backgroundColor: '#D1FAE5', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#A7F3D0' },
  acceptedText: { color: '#065F46', fontWeight: '800', fontSize: 14 },
  activeDeliveryContainer: { flex: 1, backgroundColor: '#0F172A' },
  embeddedMapContainer: { flex: 1, position: 'relative' },
  mapOverlayHeader: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, backgroundColor: 'rgba(15,23,42,0.85)', zIndex: 10 },
  mapOverlayBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  mapOverlayBtnText: { fontSize: 20, color: '#FFFFFF', fontWeight: '400' },
  mapOverlayCenter: { flex: 1, alignItems: 'center' },
  mapOverlayTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  mapOverlaySubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontWeight: '500' },
  mapLoadingOverlay: { position: 'absolute', bottom: 80, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  mapLoadingText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  etaPill: { position: 'absolute', bottom: 14, left: 20, right: 20, backgroundColor: 'rgba(15,23,42,0.85)', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, zIndex: 10 },
  etaPillText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  startNavFab: { position: 'absolute', bottom: 60, right: 20, backgroundColor: '#10B981', borderRadius: 30, paddingHorizontal: 22, paddingVertical: 14, elevation: 6, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, zIndex: 10 },
  startNavFabText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  bottomPanel: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '48%', elevation: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.08, shadowRadius: 12 },
  bottomPanelHandle: { width: 44, height: 5, borderRadius: 2.5, backgroundColor: '#E2E8F0', alignSelf: 'center', marginTop: 12, marginBottom: 12 },
  adCustomerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1.5, borderBottomColor: '#F1F5F9' },
  adCustomerNameInline: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  adCustomerMetaInline: { fontSize: 13, color: '#64748B', marginTop: 2, fontWeight: '500' },
  adPriceInline: { fontSize: 22, fontWeight: '900', color: '#10B981' },
  miniRouteRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  miniRouteDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981', marginRight: 10 },
  miniRouteText: { fontSize: 14, color: '#334155', fontWeight: '600', flex: 1 },
  miniRouteLine: { width: 2, height: 14, backgroundColor: '#E2E8F0', marginLeft: 4 },
  inlineProgressCard: { marginTop: 10, paddingVertical: 10 },
  liveBadge: { backgroundColor: '#D1FAE5', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  liveText: { color: '#065F46', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  adProgressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  adProgressTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  adProgressPercent: { fontSize: 15, fontWeight: '800', color: '#6366F1' },
  adProgressBarBg: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, position: 'relative' },
  adProgressBarFill: { position: 'absolute', left: 0, top: 0, height: 8, width: '20%', backgroundColor: '#6366F1', borderRadius: 4 },
  reachedBtn: { backgroundColor: '#10B981', borderRadius: 16, paddingVertical: 16, marginTop: 14, elevation: 4, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  reachedBtnText: { color: '#FFFFFF', textAlign: 'center', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  completedBanner: { marginTop: 14, backgroundColor: '#D1FAE5', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#A7F3D0', alignItems: 'center' },
  completedText: { color: '#065F46', fontWeight: '800', fontSize: 16 },
  waitingCard: { marginHorizontal: 20, alignItems: 'center', paddingVertical: 64, backgroundColor: '#FFFFFF', borderRadius: 22, elevation: 2, borderWidth: 1.5, borderColor: '#EEF2F6', shadowColor: '#6366F1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 8 },
  waitingTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginTop: 14 },
  waitingSub: { fontSize: 14, color: '#64748B', marginTop: 6, fontWeight: '500', textAlign: 'center', paddingHorizontal: 24 },
  screenHeaderBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1.5, borderBottomColor: '#EEF2F6' },
  screenHeaderTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  screenHeaderSub: { fontSize: 13, color: '#64748B', fontWeight: '500', marginTop: 1 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20, backgroundColor: '#F1F5F9' },
  backArrow: { fontSize: 20, color: '#0F172A', fontWeight: '700' },
  acceptFullBtn: { backgroundColor: '#6366F1', borderRadius: 16, paddingVertical: 16, marginTop: 16, elevation: 4, shadowColor: '#6366F1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  acceptFullBtnText: { color: '#FFFFFF', textAlign: 'center', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  offlineState: { alignItems: 'center', marginTop: 48, marginBottom: 48 },
  offlineTitle: { fontSize: 26, fontWeight: '900', color: '#0F172A', textAlign: 'center' },
  offlineSub: { fontSize: 15, color: '#64748B', textAlign: 'center', marginTop: 10, paddingHorizontal: 24, lineHeight: 22, fontWeight: '500' },
  swipeContainer: { height: 64, backgroundColor: '#DCFCE7', borderRadius: 32, justifyContent: 'center', marginBottom: 40, paddingHorizontal: 4, borderWidth: 1.5, borderColor: '#A7F3D0' },
  swipeContainerOffline: { backgroundColor: '#FEE2E2', marginBottom: 0, borderColor: '#FCA5A5' },
  swipeText: { position: 'absolute', width: '100%', textAlign: 'center', fontSize: 15, fontWeight: '800', color: '#065F46', zIndex: -1, textTransform: 'uppercase', letterSpacing: 0.5 },
  swipeTextOffline: { color: '#991B1B' },
  swipeBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#10B981', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  swipeBtnOffline: { backgroundColor: '#EF4444', shadowColor: '#EF4444' },
  swipeBtnIcon: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
  hamburgerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 14 },
  hamburgerIcon: { fontSize: 20, color: '#0F172A', fontWeight: '800' },
  headerStatusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  statsCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 22, padding: 22, elevation: 4, shadowColor: '#6366F1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 8, borderWidth: 1.5, borderColor: '#EEF2F6', justifyContent: 'space-between', alignItems: 'center' },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 19, fontWeight: '900', color: '#0F172A' },
  statLabel: { fontSize: 12, color: '#64748B', marginTop: 6, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1.5, height: 32, backgroundColor: '#E2E8F0' },
  builtyModalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  builtyModalCard: { backgroundColor: '#FFFFFF', borderRadius: 28, padding: 22, width: '100%', maxWidth: 400, alignItems: 'center' },
  builtyModalTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', marginBottom: 6 },
  builtyModalSubtitle: { fontSize: 14, color: '#64748B', marginBottom: 18, fontWeight: '500' },
  builtyPreviewImage: { width: '100%', height: 300, borderRadius: 20, backgroundColor: '#F1F5F9', marginBottom: 18, overflow: 'hidden' } as const,
  builtyModalActions: { flexDirection: 'row', gap: 12, width: '100%' },
  builtyRetakeBtn: { flex: 1, borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 16, paddingVertical: 16, backgroundColor: '#FFF' },
  builtyRetakeBtnText: { textAlign: 'center', color: '#475569', fontSize: 14, fontWeight: '800' },
  builtyConfirmBtn: { flex: 1.5, backgroundColor: '#10B981', borderRadius: 16, paddingVertical: 16, elevation: 4, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, justifyContent: 'center', alignItems: 'center' },
  builtyConfirmBtnText: { color: '#FFFFFF', textAlign: 'center', fontSize: 14, fontWeight: '800' },
  builtyCloseBtn: { marginTop: 14, paddingVertical: 8 },
  builtyCloseBtnText: { color: '#94A3B8', fontSize: 14, fontWeight: '700' },
  historyBtnIcon: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  historyBtn: { backgroundColor: '#6366F1', borderRadius: 16, paddingVertical: 16, marginTop: 18, elevation: 4, shadowColor: '#6366F1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
  historyBtnText: { color: '#FFFFFF', textAlign: 'center', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  pricingCardContainer: {
    width: '100%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: '#EEF2F6', marginTop: 14,
  },
  pricingCardContainerActive: {
    width: '100%', backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: '#E2E8F0', marginTop: 14, marginBottom: 14,
  },
  pricingCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  pricingCardIcon: { fontSize: 18, marginRight: 8 },
  pricingCardTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  pricingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  pricingLabel: { fontSize: 13, color: '#475569', fontWeight: '500' },
  pricingSublabel: { fontSize: 10, color: '#94A3B8', marginTop: 1 },
  pricingValue: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  pricingDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 6 },
  additionalTitle: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
});

export default App;
