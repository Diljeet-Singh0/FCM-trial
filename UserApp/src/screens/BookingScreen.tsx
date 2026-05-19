import React, { useState } from 'react';
import { Alert, PermissionsAndroid, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import type { Company } from './BrowseCompaniesScreen';
import { suggestVehicle, calculatePrice, AUTO_LOADING_CHARGE } from '../transporters';
import MapLocationPicker from '../components/MapLocationPicker';

import { MAPBOX_ACCESS_TOKEN } from '../secrets';

type Props = {
  company: Company;
  onBack: () => void;
  onConfirmBooking: (data: BookingData) => void;
};

export type BookingData = {
  weightKg: number;
  pickupAddress: string;
  dropAddress: string;
  vehicleName: string;
  vehicleIcon: string;
  companyCharge: number;
  autoCharge: number;
  totalPrice: number;
  companyId: string;
  companyName: string;
};

const BookingScreen = ({ company, onBack, onConfirmBooking }: Props) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [weightKg, setWeightKg] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropAddress, setDropAddress] = useState(company.depotAddress);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);

  const weight = Number(weightKg) || 0;
  const vehicle = suggestVehicle(weight);
  const pricing = calculatePrice(company.ratePerKg, weight);

  const getLiveLocation = async () => {
    try {
      setIsFetchingLocation(true);
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Permission Denied', 'Location permission is required to fetch your address.');
        setIsFetchingLocation(false);
        return;
      }

      Geolocation.getCurrentPosition(
        async (position) => {
          try {
            const response = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${position.coords.longitude},${position.coords.latitude}.json?access_token=${MAPBOX_ACCESS_TOKEN}&types=address,poi&limit=1`
            );
            const data = await response.json();
            if (data.features && data.features.length > 0) {
              setPickupAddress(data.features[0].place_name);
            } else {
              setPickupAddress(`${position.coords.latitude}, ${position.coords.longitude}`);
            }
          } catch (error) {
            setPickupAddress(`${position.coords.latitude}, ${position.coords.longitude}`);
          } finally {
            setIsFetchingLocation(false);
          }
        },
        (error) => {
          Alert.alert('Error', 'Could not get your location: ' + error.message);
          setIsFetchingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    } catch (err) {
      console.warn(err);
      setIsFetchingLocation(false);
    }
  };

  const goToStep2 = () => {
    if (!weightKg || !pickupAddress) {
      Alert.alert('Missing Fields', 'Please enter weight and pickup address.');
      return;
    }
    if (weight <= 0) {
      Alert.alert('Invalid Weight', 'Weight must be greater than 0.');
      return;
    }
    setStep(2);
  };

  const confirmBooking = () => {
    onConfirmBooking({
      weightKg: weight,
      pickupAddress: pickupAddress.trim(),
      dropAddress: dropAddress.trim(),
      vehicleName: vehicle.name,
      vehicleIcon: vehicle.icon,
      companyCharge: pricing.companyCharge,
      autoCharge: pricing.autoCharge,
      totalPrice: pricing.total,
      companyId: company.id,
      companyName: company.name,
    });
  };

  // Step Indicator
  const StepIndicator = () => (
    <View style={s.stepIndicator}>
      <View style={s.stepRow}>
        <View style={[s.stepDot, s.stepDotActive]}>
          <Text style={s.stepDotText}>1</Text>
        </View>
        <View style={[s.stepLine, step === 2 && s.stepLineActive]} />
        <View style={[s.stepDot, step === 2 && s.stepDotActive]}>
          <Text style={[s.stepDotText, step < 2 && { color: '#94A3B8' }]}>2</Text>
        </View>
      </View>
      <View style={s.stepLabelRow}>
        <Text style={[s.stepLabelText, s.stepLabelActive]}>Details</Text>
        <Text style={[s.stepLabelText, step === 2 && s.stepLabelActive]}>Confirm</Text>
      </View>
    </View>
  );

  const renderStep1 = () => (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8 }} showsVerticalScrollIndicator={false}>
      <StepIndicator />

      <Text style={s.stepTitle}>Shipment Details</Text>

      <View style={s.inputGroup}>
        <Text style={s.label}>Weight of Goods (kg)</Text>
        <View style={s.inputWrap}>
          <Text style={s.inputIcon}>⚖️</Text>
          <TextInput style={s.input} placeholder="e.g. 500" placeholderTextColor="#94A3B8"
            value={weightKg} onChangeText={setWeightKg} keyboardType="numeric" />
          <Text style={s.inputSuffix}>kg</Text>
        </View>
      </View>

      <View style={s.inputGroup}>
        <Text style={s.label}>Pickup Address</Text>
        <View style={s.inputWrap}>
          <View style={s.greenDot} />
          <TextInput style={[s.input, { flex: 1 }]}
            placeholder="Enter pickup location" placeholderTextColor="#94A3B8"
            value={pickupAddress} onChangeText={setPickupAddress} />
        </View>
        <View style={s.locationBtnRow}>
          <TouchableOpacity style={s.gpsBtn} onPress={getLiveLocation} disabled={isFetchingLocation}>
            {isFetchingLocation ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#1A56DB" style={{ marginRight: 6 }} />
                <Text style={s.gpsBtnText}>Fetching...</Text>
              </View>
            ) : (
              <Text style={s.gpsBtnText}>📍 Current Location</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={s.mapPickBtn} onPress={() => setShowMapPicker(true)}>
            <Text style={s.mapPickBtnText}>📌 Pick on Map</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.inputGroup}>
        <Text style={s.label}>Drop-off (Company Depot)</Text>
        <View style={[s.inputWrap, { backgroundColor: '#F8FAFC' }]}>
          <View style={s.blackDot} />
          <TextInput style={[s.input, { flex: 1, color: '#64748B' }]}
            value={dropAddress} onChangeText={setDropAddress} editable={false} />
        </View>
        <Text style={s.prefillNote}>📌 Pre-filled with {company.name} depot</Text>
      </View>

      <TouchableOpacity style={s.nextBtn} onPress={goToStep2} activeOpacity={0.8}>
        <Text style={s.nextBtnText}>Continue  →</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderStep2 = () => (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8 }} showsVerticalScrollIndicator={false}>
      <StepIndicator />

      <Text style={s.stepTitle}>Review & Confirm</Text>

      {/* Confirmation Message */}
      <View style={s.confirmCard}>
        <View style={s.confirmIconWrap}>
          <Text style={{ fontSize: 24 }}>✅</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={s.confirmTitle}>Pickup Confirmed</Text>
          <Text style={s.confirmSub}>Vehicle will be assigned by the company</Text>
        </View>
      </View>

      {/* Pricing Model */}
      <View style={s.priceCard}>
        <View style={s.priceHeader}>
          <Text style={s.priceHeaderIcon}>💰</Text>
          <Text style={s.priceTitleText}>Pricing Details</Text>
        </View>
        <View style={s.priceRow}>
          <Text style={s.priceLabel}>Rate per km</Text>
          <Text style={s.priceValue}>₹45</Text>
        </View>
        <View style={s.priceRow}>
          <Text style={s.priceLabel}>Minimum Charge</Text>
          <Text style={[s.priceValue, { color: '#059669', fontWeight: '800' }]}>₹200</Text>
        </View>
        <View style={s.priceDivider} />
        <View style={s.priceRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.priceLabel}>Waiting Charges</Text>
            <Text style={s.priceSublabel}>First 15 min free</Text>
          </View>
          <Text style={s.priceValue}>₹50 / 30 min</Text>
        </View>
      </View>

      {/* Summary */}
      <View style={s.summaryCard}>
        <Text style={s.summaryTitle}>📋 Booking Summary</Text>
        <View style={s.summaryRow}>
          <Text style={s.summaryIcon}>📦</Text>
          <Text style={s.summaryItem}>{weight} kg</Text>
        </View>
        <View style={s.summaryRow}>
          <Text style={s.summaryIcon}>📍</Text>
          <Text style={s.summaryItem} numberOfLines={1}>{pickupAddress}</Text>
        </View>
        <View style={s.summaryRow}>
          <Text style={s.summaryIcon}>🏭</Text>
          <Text style={s.summaryItem} numberOfLines={1}>{dropAddress}</Text>
        </View>
        <View style={s.summaryRow}>
          <Text style={s.summaryIcon}>🚛</Text>
          <Text style={s.summaryItem}>{company.name}</Text>
        </View>
      </View>

      <TouchableOpacity style={s.bookBtn} onPress={confirmBooking} activeOpacity={0.8}>
        <Text style={s.bookBtnText}>✓  Book Now</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.backStep} onPress={() => setStep(1)}>
        <Text style={s.backStepText}>← Back to Details</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#F0F4F8' }}>
      <StatusBar barStyle="light-content" backgroundColor="#1A56DB" />
      <View style={s.header}>
        <TouchableOpacity onPress={step === 1 ? onBack : () => setStep(1)} style={s.backBtnH}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Book {company.name}</Text>
        <View style={{ width: 40 }} />
      </View>
      {step === 1 ? renderStep1() : renderStep2()}

      <MapLocationPicker
        visible={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onConfirm={(loc) => {
          setPickupAddress(loc.address);
          setShowMapPicker(false);
        }}
      />
    </View>
  );
};

const s = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 52,
    backgroundColor: '#1A56DB',
  },
  backBtnH: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
  backArrow: { fontSize: 22, color: '#FFFFFF', fontWeight: '400' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', letterSpacing: 0.3 },

  // Step Indicator
  stepIndicator: { marginBottom: 16 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  stepDot: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center',
  },
  stepDotActive: { backgroundColor: '#1A56DB' },
  stepDotText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  stepLine: { flex: 1, height: 3, backgroundColor: '#E2E8F0', marginHorizontal: 8, borderRadius: 2 },
  stepLineActive: { backgroundColor: '#1A56DB' },
  stepLabelRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 20, marginTop: 6 },
  stepLabelText: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  stepLabelActive: { color: '#1A56DB' },

  stepTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 20, letterSpacing: 0.1 },

  // Inputs
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#E2E8F0',
    paddingHorizontal: 14, paddingVertical: 2,
  },
  inputIcon: { fontSize: 18, marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: '#0F172A', paddingVertical: 14 },
  inputSuffix: { fontSize: 14, color: '#94A3B8', fontWeight: '600' },
  greenDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#BBF7D0', marginRight: 10 },
  blackDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#334155', marginRight: 10 },

  // Location buttons
  locationBtnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  gpsBtn: { backgroundColor: '#EBF0FF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: '#C7D7FE' },
  gpsBtnText: { fontSize: 13, fontWeight: '600', color: '#1A56DB' },
  mapPickBtn: { backgroundColor: '#ECFDF5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: '#A7F3D0' },
  mapPickBtnText: { fontSize: 13, fontWeight: '600', color: '#059669' },
  prefillNote: { fontSize: 12, color: '#94A3B8', marginTop: 6, marginLeft: 4 },

  nextBtn: {
    backgroundColor: '#1A56DB', borderRadius: 14, paddingVertical: 16, marginTop: 8,
    elevation: 4, shadowColor: '#1A56DB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  nextBtnText: { color: '#FFFFFF', textAlign: 'center', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  // Step 2
  confirmCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#ECFDF5', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#A7F3D0', marginBottom: 16,
  },
  confirmIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#D1FAE5', justifyContent: 'center', alignItems: 'center',
  },
  confirmTitle: { fontSize: 16, fontWeight: '700', color: '#065F46' },
  confirmSub: { fontSize: 12, color: '#059669', marginTop: 2, fontWeight: '500' },

  priceCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18,
    borderWidth: 1.5, borderColor: '#E2E8F0', marginBottom: 16,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4,
  },
  priceHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  priceHeaderIcon: { fontSize: 20, marginRight: 8 },
  priceTitleText: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  priceLabel: { fontSize: 14, color: '#475569', fontWeight: '500' },
  priceValue: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  priceSublabel: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  priceDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 6 },

  summaryCard: {
    backgroundColor: '#FFFBEB', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#FDE68A', marginBottom: 16,
  },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: '#92400E', marginBottom: 10 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  summaryIcon: { fontSize: 14, marginRight: 10, width: 22 },
  summaryItem: { fontSize: 13, color: '#78350F', fontWeight: '500', flex: 1 },

  bookBtn: {
    backgroundColor: '#059669', borderRadius: 14, paddingVertical: 16,
    elevation: 4, shadowColor: '#059669', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    marginBottom: 8,
  },
  bookBtnText: { color: '#FFFFFF', textAlign: 'center', fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },
  backStep: { paddingVertical: 14, alignItems: 'center' },
  backStepText: { fontSize: 14, color: '#64748B', fontWeight: '600' },
});

export default BookingScreen;
