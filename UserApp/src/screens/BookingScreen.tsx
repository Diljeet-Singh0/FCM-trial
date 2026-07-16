import React, { useState } from 'react';
import { Alert, PermissionsAndroid, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { Company } from './BrowseCompaniesScreen';
import { suggestVehicle, calculatePrice } from '../transporters';
import MapLocationPicker from '../components/MapLocationPicker';
import RouteIndicator from '../components/RouteIndicator';

import { MAPBOX_ACCESS_TOKEN } from '../secrets';
import { API_BASE_URL } from '../config';


type Props = {
  company: Company;
  onBack: () => void;
  onConfirmBooking: (data: BookingData) => void;
  isScheduling?: boolean;
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
  distanceKm?: number;
  priceRange?: { min: number; max: number };
  driverCut?: number;
  scheduledTime?: string;
};

const QUICK_WEIGHTS = [
  { label: '100 kg', value: '100' },
  { label: '500 kg', value: '500' },
  { label: '1,500 kg', value: '1500' },
  { label: '5,000 kg', value: '5000' },
  { label: '10,000 kg', value: '10000' },
];

const BookingScreen = ({ company, onBack, onConfirmBooking, isScheduling = false }: Props) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [weightKg, setWeightKg] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropAddress, setDropAddress] = useState(company.depotAddress);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);

  const [scheduledDate, setScheduledDate] = useState<Date>(() => {
    // Default to tomorrow 10:00 AM
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const dateStr = scheduledDate.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  const timeStr = scheduledDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const weight = Number(weightKg) || 0;
  const vehicle = suggestVehicle(weight);
  const pricing = calculatePrice(company.ratePerKg, weight);

  const [distanceKm, setDistanceKm] = useState(0);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [priceRange, setPriceRange] = useState({ rangeMin: 0, rangeMax: 0, driverCut: 0, userPrice: 0 });

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

  const calculateDistanceAndProceed = async () => {
    if (!weightKg || !pickupAddress) {
      Alert.alert('Missing Fields', 'Please enter weight and pickup address.');
      return;
    }
    if (weight <= 0) {
      Alert.alert('Invalid Weight', 'Weight must be greater than 0.');
      return;
    }

    if (isScheduling) {
      const now = new Date();
      const minTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
      const maxTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

      if (scheduledDate < minTime) {
        Alert.alert('Validation Error', 'Scheduled time must be at least 2 hours from now.');
        return;
      }

      if (scheduledDate > maxTime) {
        Alert.alert('Validation Error', 'Scheduled time must be within 7 days from now.');
        return;
      }
    }

    setIsCalculatingDistance(true);
    let computedDistance = 5;

    try {
      let pickupLng = 0, pickupLat = 0;
      const pickupRes = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(pickupAddress)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=1`);
      const pickupData = await pickupRes.json();
      if (pickupData.features && pickupData.features.length > 0) {
        [pickupLng, pickupLat] = pickupData.features[0].center;
      }

      let dropLng = 0, dropLat = 0;
      const dropRes = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(dropAddress)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=1`);
      const dropData = await dropRes.json();
      if (dropData.features && dropData.features.length > 0) {
        [dropLng, dropLat] = dropData.features[0].center;
      }

      if (pickupLng && dropLng) {
        const dirRes = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${pickupLng},${pickupLat};${dropLng},${dropLat}?access_token=${MAPBOX_ACCESS_TOKEN}`);
        const dirData = await dirRes.json();
        if (dirData.routes && dirData.routes.length > 0) {
          computedDistance = dirData.routes[0].distance / 1000;
        }
      }
    } catch (mapErr) {
      console.warn('Mapbox distance calculation failed, using default distance of 5km:', mapErr);
    }
    setDistanceKm(computedDistance);

    try {
      const response = await fetch(`${API_BASE_URL}/gozo/price-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weightKg: weight, distanceKm: computedDistance }),
      });
      const data = await response.json();
      if (data.success) {
        setPriceRange({ rangeMin: data.rangeMin, rangeMax: data.rangeMax, driverCut: data.driverCut, userPrice: data.userPrice });
      } else {
        throw new Error(data.error || 'Server returned failure');
      }
    } catch (backendErr) {
      console.warn('Backend price-preview failed, using local pricing preview fallback:', backendErr);
      if (weight <= 500) {
        const basePrice = Math.max(200, Math.round(computedDistance * 45));
        setPriceRange({
          rangeMin: basePrice,
          rangeMax: basePrice,
          driverCut: basePrice,
          userPrice: Math.max(200, Math.round(computedDistance * 50))
        });
      } else {
        // Heavy goods: ₹50/km total, driver gets ₹45/km (90%)
        const driverPayout = Math.max(450, Math.round(computedDistance * 45));
        setPriceRange({
          rangeMin: driverPayout,
          rangeMax: driverPayout,
          driverCut: driverPayout,
          userPrice: Math.max(500, Math.round(computedDistance * 50))
        });
      }
    }

    setIsCalculatingDistance(false);
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
      priceRange: { min: priceRange.rangeMin, max: priceRange.rangeMax },
      driverCut: priceRange.driverCut,
      distanceKm: distanceKm,
      companyId: company.id,
      companyName: company.name,
      scheduledTime: isScheduling ? scheduledDate.toISOString() : undefined,
    });
  };

  const StepIndicator = () => (
    <View style={s.stepIndicator}>
      <View style={s.stepRow}>
        <View style={[s.stepDot, s.stepDotActive]}>
          <Text style={s.stepDotText}>1</Text>
        </View>
        <View style={[s.stepLine, step === 2 && s.stepLineActive]} />
        <View style={[s.stepDot, step === 2 ? s.stepDotActive : s.stepDotInactive]}>
          <Text style={[s.stepDotText, step < 2 && { color: '#94A3B8' }]}>2</Text>
        </View>
      </View>
      <View style={s.stepLabelRow}>
        <Text style={[s.stepLabelText, s.stepLabelActive]}>Details</Text>
        <Text style={[s.stepLabelText, step === 2 ? s.stepLabelActive : s.stepLabelInactive]}>Confirm</Text>
      </View>
    </View>
  );

  const renderStep1 = () => (
    <ScrollView contentContainerStyle={s.scrollContainer} showsVerticalScrollIndicator={false}>
      <StepIndicator />

      {/* Modern Card for Shipment details */}
      <View style={s.card}>
        <Text style={s.cardHeaderTitle}>📦 Shipment Details</Text>

        <View style={s.inputGroup}>
          <Text style={s.label}>Weight of Goods (kg)</Text>
          <View style={s.inputWrap}>
            <Text style={s.inputIcon}>⚖️</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. 500"
              placeholderTextColor="#94A3B8"
              value={weightKg}
              onChangeText={setWeightKg}
              keyboardType="numeric"
            />
            <Text style={s.inputSuffix}>kg</Text>
          </View>
          
          {/* Quick weight selector chips */}
          <View style={s.chipsContainer}>
            {QUICK_WEIGHTS.map((w) => (
              <TouchableOpacity
                key={w.value}
                style={[s.chip, weightKg === w.value && s.chipActive]}
                onPress={() => setWeightKg(w.value)}
                activeOpacity={0.7}
              >
                <Text style={[s.chipText, weightKg === w.value && s.chipTextActive]}>
                  {w.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {weight > 0 && (
          <View style={s.suggestedVehicleCard}>
            <View style={s.vehicleIconWrap}>
              <Text style={s.vehicleIcon}>{vehicle.icon}</Text>
            </View>
            <View style={s.vehicleDetails}>
              <Text style={s.vehicleSub}>SUGGESTED VEHICLE</Text>
              <Text style={s.vehicleName}>{vehicle.name}</Text>
              <Text style={s.vehicleWeightLimit}>Handles up to {vehicle.maxWeightKg.toLocaleString()} kg</Text>
            </View>
          </View>
        )}
      </View>

      {/* Date & Time Selection Card (Scheduling Mode Only) */}
      {isScheduling && (
        <View style={s.card}>
          <Text style={s.cardHeaderTitle}>📅 Date & Time Selection</Text>
          <Text style={s.cardSubtitle}>Rides must be booked between 2 hours and 7 days in advance.</Text>

          <View style={s.dateTimeRow}>
            <TouchableOpacity style={s.pickerBtn} onPress={() => setShowDatePicker(true)}>
              <Text style={s.pickerLabel}>DATE</Text>
              <Text style={s.pickerValue}>{dateStr}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.pickerBtn} onPress={() => setShowTimePicker(true)}>
              <Text style={s.pickerLabel}>TIME</Text>
              <Text style={s.pickerValue}>{timeStr}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modern Card for Route/Timeline Details */}
      <View style={s.card}>
        <Text style={s.cardHeaderTitle}>📍 Route Details</Text>

        <View style={s.timelineContainer}>
          {/* Timeline side graphics */}
          <View style={s.timelineGraphics}>
            <View style={s.greenDotOuter}><View style={s.greenDotInner} /></View>
            <View style={s.timelineVerticalLine} />
            <View style={s.redDotOuter}><View style={s.redDotInner} /></View>
          </View>

          {/* Form fields next to graphics */}
          <View style={s.timelineForm}>
            {/* Pickup Address Field */}
            <View style={s.formBlock}>
              <Text style={s.timelineLabel}>PICKUP LOCATION</Text>
              <View style={s.embeddedInputWrap}>
                <TextInput
                  style={s.embeddedInput}
                  placeholder="Enter pickup location address"
                  placeholderTextColor="#94A3B8"
                  value={pickupAddress}
                  onChangeText={setPickupAddress}
                  multiline
                  numberOfLines={2}
                />
              </View>
              <View style={s.locationBtnRow}>
                <TouchableOpacity style={s.gpsBtn} onPress={getLiveLocation} disabled={isFetchingLocation}>
                  {isFetchingLocation ? (
                    <View style={s.flexRow}>
                      <ActivityIndicator size="small" color="#10B981" style={{ marginRight: 6 }} />
                      <Text style={s.gpsBtnText}>Fetching...</Text>
                    </View>
                  ) : (
                    <Text style={s.gpsBtnText}>📍 Current Location</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={s.mapPickBtn} onPress={() => setShowMapPicker(true)}>
                  <Text style={s.mapPickBtnText}>🗺️ Pick on Map</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Gap between pickup & dropoff */}
            <View style={{ height: 20 }} />

            {/* Dropoff Address Field */}
            <View style={s.formBlock}>
              <Text style={s.timelineLabel}>DROP-OFF LOCATION (DEPOT)</Text>
              <View style={[s.embeddedInputWrap, s.disabledInputWrap]}>
                <Text style={s.disabledInputText}>{dropAddress}</Text>
              </View>
              <View style={s.prefillBadge}>
                <Text style={s.prefillBadgeText}>🏢 Prefilled: {company.name} depot</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[s.nextBtn, (!weightKg || !pickupAddress) && s.disabledBtn]}
        onPress={calculateDistanceAndProceed}
        activeOpacity={0.8}
        disabled={isCalculatingDistance || !weightKg || !pickupAddress}
      >
        {isCalculatingDistance ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={s.nextBtnText}>Calculate Freight & Continue  →</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  const renderStep2 = () => (
    <ScrollView contentContainerStyle={s.scrollContainer} showsVerticalScrollIndicator={false}>
      <StepIndicator />

      {/* Auto-allocated Confirmation Banner or Scheduled Info Banner */}
      {isScheduling ? (
        <View style={[s.confirmCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
          <View style={[s.confirmIconWrap, { backgroundColor: '#BFDBFE' }]}>
            <Text style={{ fontSize: 22 }}>📅</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={[s.confirmTitle, { color: '#1E40AF' }]}>Scheduled Ride Request</Text>
            <Text style={[s.confirmSub, { color: '#1E40AF' }]}>
              The ride will be requested for {dateStr} at {timeStr}. Admin will assign a driver.
            </Text>
          </View>
        </View>
      ) : (
        <View style={s.confirmCard}>
          <View style={s.confirmIconWrap}>
            <Text style={{ fontSize: 22 }}>🚚</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={s.confirmTitle}>Instant Driver Allocation</Text>
            <Text style={s.confirmSub}>A driver will accept and load goods within 2 hours of confirmation.</Text>
          </View>
        </View>
      )}

      {/* Pricing Estimate Card */}
      <View style={s.card}>
        <Text style={s.cardHeaderTitle}>💰 Price Breakdown</Text>

        {vehicle.id === 'auto' ? (
          <View style={s.breakdownWrap}>
            <View style={s.breakdownRow}>
              <Text style={s.breakdownLabel}>Waiting Charges</Text>
              <Text style={s.breakdownVal}>₹50 / 30 min (First 15 min free)</Text>
            </View>
            <View style={s.totalBreakdownBox}>
              <Text style={s.totalBreakdownLabel}>Total Price</Text>
              <Text style={s.totalBreakdownValue}>₹{priceRange.userPrice || priceRange.rangeMin}</Text>
            </View>
          </View>
        ) : (
          <View style={s.breakdownWrap}>
            <View style={s.breakdownRow}>
              <Text style={s.breakdownLabel}>Company base freight</Text>
              <Text style={s.breakdownVal}>₹{pricing.companyCharge}</Text>
            </View>
            <View style={s.breakdownRow}>
              <Text style={s.breakdownLabel}>Loading/Handling fee</Text>
              <Text style={s.breakdownVal}>₹{pricing.autoCharge}</Text>
            </View>
            <View style={s.totalBreakdownBox}>
              <Text style={s.totalBreakdownLabel}>Total Freight Price</Text>
              <Text style={s.totalBreakdownValue}>₹{pricing.total}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Booking Summary Receipt */}
      <View style={s.receiptCard}>
        <Text style={s.receiptTitle}>🧾 Booking Summary</Text>
        
        <View style={s.receiptRow}>
          <Text style={s.receiptLabel}>Transporter</Text>
          <Text style={s.receiptVal}>{company.name}</Text>
        </View>

        <View style={s.receiptRow}>
          <Text style={s.receiptLabel}>Goods & Weight</Text>
          <Text style={s.receiptVal}>{weight} kg ({vehicle.name})</Text>
        </View>

        <View style={s.receiptRow}>
          <Text style={s.receiptLabel}>Estimated Distance</Text>
          <Text style={s.receiptVal}>{distanceKm.toFixed(1)} km</Text>
        </View>

        {isScheduling && (
          <View style={s.receiptRow}>
            <Text style={s.receiptLabel}>Scheduled Time</Text>
            <Text style={[s.receiptVal, { color: '#10B981' }]}>{dateStr} at {timeStr}</Text>
          </View>
        )}

        <RouteIndicator pickupAddress={pickupAddress} dropAddress={dropAddress} />
      </View>

      <TouchableOpacity style={s.bookBtn} onPress={confirmBooking} activeOpacity={0.9}>
        <Text style={s.bookBtnText}>{isScheduling ? 'Confirm & Schedule Ride' : 'Confirm & Book Now'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.backStep} onPress={() => setStep(1)} activeOpacity={0.7}>
        <Text style={s.backStepText}>← Edit Shipment Details</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={s.header}>
        <TouchableOpacity onPress={step === 1 ? onBack : () => setStep(1)} style={s.backBtnH}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={s.headerTitleContainer}>
          <Text style={s.headerSubtitle}>BOOK TRANSPORT</Text>
          <Text style={s.headerTitle} numberOfLines={1}>{company.name}</Text>
        </View>
        <View style={{ width: 42 }} />
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

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={scheduledDate}
          mode="date"
          display="default"
          minimumDate={new Date()}
          maximumDate={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)}
          onChange={(event: any, selected?: Date) => {
            setShowDatePicker(false);
            if (selected) {
              const current = new Date(scheduledDate);
              current.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
              setScheduledDate(current);
            }
          }}
        />
      )}

      {/* Time Picker Modal */}
      {showTimePicker && (
        <DateTimePicker
          value={scheduledDate}
          mode="time"
          display="default"
          is24Hour={false}
          onChange={(event: any, selected?: Date) => {
            setShowTimePicker(false);
            if (selected) {
              const current = new Date(scheduledDate);
              current.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
              setScheduledDate(current);
            }
          }}
        />
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
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
  backBtnH: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 20,
    color: '#1A1A1A',
    fontWeight: '700',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B6B6B',
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 2,
  },

  // Stepper Indicator
  stepIndicator: {
    marginBottom: 24,
    marginTop: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 60,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  stepDotActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  stepDotInactive: {
    backgroundColor: '#E5E5E5',
    borderColor: '#E5E5E5',
  },
  stepDotText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stepLine: {
    flex: 1,
    height: 4,
    backgroundColor: '#E5E5E5',
    marginHorizontal: 8,
    borderRadius: 2,
  },
  stepLineActive: {
    backgroundColor: '#10B981',
  },
  stepLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    marginTop: 8,
  },
  stepLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B6B6B',
  },
  stepLabelActive: {
    color: '#10B981',
    fontWeight: '700',
  },
  stepLabelInactive: {
    color: '#6B6B6B',
  },

  // Modern Card layouts
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
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 16,
  },

  // Inputs & elements
  inputGroup: {
    marginBottom: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B6B6B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
  },
  inputIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
    paddingVertical: 12,
    fontWeight: '600',
  },
  inputSuffix: {
    fontSize: 14,
    color: '#6B6B6B',
    fontWeight: '700',
  },

  // Selector chips
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: '#E6F7F0',
    borderColor: '#10B981',
  },
  chipText: {
    fontSize: 12,
    color: '#6B6B6B',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#10B981',
    fontWeight: '700',
  },

  // Suggested vehicle area
  suggestedVehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F7F0',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  vehicleIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  vehicleIcon: {
    fontSize: 24,
  },
  vehicleDetails: {
    flex: 1,
  },
  vehicleSub: {
    fontSize: 9,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 1,
  },
  vehicleName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 2,
  },
  vehicleWeightLimit: {
    fontSize: 11,
    color: '#6B6B6B',
    marginTop: 1,
  },

  // Modern Route Layout
  timelineContainer: {
    flexDirection: 'row',
  },
  timelineGraphics: {
    alignItems: 'center',
    marginRight: 12,
    paddingTop: 8,
  },
  greenDotOuter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#E6F7F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  greenDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  redDotOuter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  redDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E53935',
  },
  timelineVerticalLine: {
    width: 1,
    flex: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#CCCCCC',
    marginVertical: 4,
  },
  timelineForm: {
    flex: 1,
  },
  formBlock: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6B6B6B',
    letterSpacing: 1,
    marginBottom: 6,
  },
  embeddedInputWrap: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  embeddedInput: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '600',
    paddingVertical: 6,
    textAlignVertical: 'top',
  },
  disabledInputWrap: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E2E8F0',
    paddingVertical: 12,
  },
  disabledInputText: {
    fontSize: 13,
    color: '#6B6B6B',
    fontWeight: '600',
  },
  locationBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  gpsBtn: {
    backgroundColor: '#E6F7F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  gpsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  mapPickBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  mapPickBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  prefillBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  prefillBadgeText: {
    fontSize: 10,
    color: '#6B6B6B',
    fontWeight: '600',
  },

  // Action Buttons
  nextBtn: {
    backgroundColor: '#10B981',
    borderRadius: 28,
    paddingVertical: 16,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  disabledBtn: {
    backgroundColor: '#94A3B8',
    elevation: 0,
    shadowOpacity: 0,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Step 2 elements
  confirmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F7F0',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 16,
  },
  confirmIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F5132',
  },
  confirmSub: {
    fontSize: 12,
    color: '#0F5132',
    marginTop: 2,
    fontWeight: '600',
  },

  // Breakdown Card
  breakdownWrap: {
    marginTop: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#6B6B6B',
    fontWeight: '500',
  },
  breakdownVal: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '700',
  },
  breakdownValBold: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '800',
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  totalBreakdownBox: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  totalBreakdownLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  totalBreakdownValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#10B981',
  },

  // Receipt Card style
  receiptCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 18,
    marginBottom: 20,
  },
  receiptTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  receiptLabel: {
    fontSize: 12,
    color: '#6B6B6B',
    fontWeight: '600',
  },
  receiptVal: {
    fontSize: 13,
    color: '#1A1A1A',
    fontWeight: '700',
  },
  receiptDivider: {
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#CCCCCC',
    marginVertical: 10,
  },
  receiptAddressBlock: {
    flexDirection: 'column',
  },
  receiptAddrLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B6B6B',
    marginBottom: 2,
  },
  receiptAddrText: {
    fontSize: 12,
    color: '#1A1A1A',
    fontWeight: '500',
    lineHeight: 16,
  },

  bookBtn: {
    backgroundColor: '#10B981',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    marginBottom: 12,
  },
  bookBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  backStep: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  backStepText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '700',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pickerBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  pickerLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  pickerValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
});

export default BookingScreen;
