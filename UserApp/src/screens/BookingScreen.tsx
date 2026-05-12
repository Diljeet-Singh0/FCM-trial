import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { Company } from './BrowseCompaniesScreen';
import { suggestVehicle, calculatePrice, AUTO_LOADING_CHARGE } from '../transporters';

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

  const weight = Number(weightKg) || 0;
  const vehicle = suggestVehicle(weight);
  const pricing = calculatePrice(company.ratePerKg, weight);

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

  const renderStep1 = () => (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <Text style={s.stepLabel}>Step 1 of 2</Text>
      <Text style={s.stepTitle}>Shipment Details</Text>

      <View style={s.inputGroup}>
        <Text style={s.label}>Weight of Goods (kg)</Text>
        <TextInput style={s.input} placeholder="e.g. 500" placeholderTextColor="#9CA3AF"
          value={weightKg} onChangeText={setWeightKg} keyboardType="numeric" />
      </View>

      <View style={s.inputGroup}>
        <Text style={s.label}>Pickup Address</Text>
        <View style={s.inputRow}>
          <View style={s.greenDot} />
          <TextInput style={[s.input, { flex: 1, marginLeft: 10, marginBottom: 0 }]}
            placeholder="Enter pickup location" placeholderTextColor="#9CA3AF"
            value={pickupAddress} onChangeText={setPickupAddress} />
        </View>
        <TouchableOpacity style={s.gpsBtn} onPress={() => setPickupAddress('RVW6+MF7, Gill, Patiala, Punjab')}>
          <Text style={s.gpsBtnText}>📍 Use Current Location</Text>
        </TouchableOpacity>
      </View>

      <View style={s.inputGroup}>
        <Text style={s.label}>Drop-off (Company Depot)</Text>
        <View style={s.inputRow}>
          <View style={s.blackDot} />
          <TextInput style={[s.input, { flex: 1, marginLeft: 10, marginBottom: 0, color: '#6B7280' }]}
            value={dropAddress} onChangeText={setDropAddress} editable={false} />
        </View>
        <Text style={s.prefillNote}>Pre-filled with {company.name} depot</Text>
      </View>

      <TouchableOpacity style={s.nextBtn} onPress={goToStep2}>
        <Text style={s.nextBtnText}>Next →</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderStep2 = () => (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <Text style={s.stepLabel}>Step 2 of 2</Text>
      <Text style={s.stepTitle}>Vehicle & Price</Text>

      {/* Suggested Vehicle */}
      <View style={s.vehicleCard}>
        <Text style={s.vehicleIcon}>{vehicle.icon}</Text>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={s.vehicleLabel}>Suggested Vehicle</Text>
          <Text style={s.vehicleName}>{vehicle.name}</Text>
          <Text style={s.vehicleCap}>Up to {vehicle.maxWeightKg.toLocaleString()} kg</Text>
        </View>
        <View style={s.autoTag}><Text style={s.autoTagText}>Auto</Text></View>
      </View>

      {/* Price Breakdown */}
      <View style={s.priceCard}>
        <Text style={s.priceTitle}>Price Breakdown</Text>
        <View style={s.priceRow}>
          <Text style={s.priceLabel}>Company charges ({company.ratePerKg}/kg × {weight} kg)</Text>
          <Text style={s.priceValue}>₹{pricing.companyCharge}</Text>
        </View>
        <View style={s.priceRow}>
          <Text style={s.priceLabel}>Auto-rickshaw loading charge</Text>
          <Text style={s.priceValue}>₹{AUTO_LOADING_CHARGE}</Text>
        </View>
        <View style={s.priceDivider} />
        <View style={s.priceRow}>
          <Text style={s.totalLabel}>Total</Text>
          <Text style={s.totalValue}>₹{pricing.total}</Text>
        </View>
      </View>

      {/* Summary */}
      <View style={s.summaryCard}>
        <Text style={s.summaryTitle}>Booking Summary</Text>
        <Text style={s.summaryItem}>📦 {weight} kg</Text>
        <Text style={s.summaryItem}>📍 {pickupAddress}</Text>
        <Text style={s.summaryItem}>🏭 {dropAddress.substring(0, 40)}...</Text>
        <Text style={s.summaryItem}>🚛 {company.name}</Text>
      </View>

      <TouchableOpacity style={s.bookBtn} onPress={confirmBooking}>
        <Text style={s.bookBtnText}>Book Now — ₹{pricing.total}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.backStep} onPress={() => setStep(1)}>
        <Text style={s.backStepText}>← Back to Step 1</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFF' }}>
      <View style={s.header}>
        <TouchableOpacity onPress={step === 1 ? onBack : () => setStep(1)} style={s.backBtnH}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Book {company.name}</Text>
        <View style={{ width: 40 }} />
      </View>
      {step === 1 ? renderStep1() : renderStep2()}
    </View>
  );
};

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtnH: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backArrow: { fontSize: 24, color: '#111827', fontWeight: '300' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111827', textAlign: 'center' },
  stepLabel: { fontSize: 12, fontWeight: '700', color: '#1A56DB', textTransform: 'uppercase', letterSpacing: 1 },
  stepTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginTop: 4, marginBottom: 20 },
  inputGroup: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginLeft: 4 },
  input: { backgroundColor: '#F9FAFB', borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827', marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  greenDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#BBF7D0' },
  blackDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#1F2937' },
  gpsBtn: { alignSelf: 'flex-start', marginTop: 6, backgroundColor: '#EEF2FF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  gpsBtnText: { fontSize: 13, fontWeight: '600', color: '#1A56DB' },
  prefillNote: { fontSize: 11, color: '#9CA3AF', marginTop: 4, marginLeft: 24 },
  nextBtn: { backgroundColor: '#1A56DB', borderRadius: 14, paddingVertical: 16, marginTop: 10 },
  nextBtnText: { color: '#FFF', textAlign: 'center', fontSize: 16, fontWeight: '700' },
  vehicleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F9FF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E0F2FE', marginBottom: 16 },
  vehicleIcon: { fontSize: 40 },
  vehicleLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600', textTransform: 'uppercase' },
  vehicleName: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 2 },
  vehicleCap: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  autoTag: { backgroundColor: '#DCFCE7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  autoTagText: { color: '#166534', fontSize: 11, fontWeight: '700' },
  priceCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#E5E7EB', marginBottom: 16 },
  priceTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  priceLabel: { fontSize: 13, color: '#6B7280', flex: 1 },
  priceValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  priceDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 8 },
  totalLabel: { fontSize: 16, fontWeight: '800', color: '#111827' },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#16A34A' },
  summaryCard: { backgroundColor: '#FFFBEB', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#FDE68A', marginBottom: 16 },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: '#92400E', marginBottom: 8 },
  summaryItem: { fontSize: 13, color: '#78350F', lineHeight: 22 },
  bookBtn: { backgroundColor: '#16A34A', borderRadius: 14, paddingVertical: 16, elevation: 3, marginBottom: 8 },
  bookBtnText: { color: '#FFF', textAlign: 'center', fontSize: 17, fontWeight: '700' },
  backStep: { paddingVertical: 12, alignItems: 'center' },
  backStepText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
});

export default BookingScreen;
