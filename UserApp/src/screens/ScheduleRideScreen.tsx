import React, { useState, useEffect } from 'react';
import {
  Alert,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import DateTimePicker from '@react-native-community/datetimepicker';
import { createScheduledRide, fetchTransportCompanies } from '../api';
import MapLocationPicker from '../components/MapLocationPicker';
import { MAPBOX_ACCESS_TOKEN } from '../secrets';

type Props = {
  userId: string;
  onBack: () => void;
  onSuccess: () => void;
};

export const ScheduleRideScreen = ({ userId, onBack, onSuccess }: Props) => {
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupLat, setPickupLat] = useState<number | undefined>(undefined);
  const [pickupLng, setPickupLng] = useState<number | undefined>(undefined);

  const [dropAddress, setDropAddress] = useState('');
  const [dropLat, setDropLat] = useState<number | undefined>(undefined);
  const [dropLng, setDropLng] = useState<number | undefined>(undefined);

  const [goodsDescription, setGoodsDescription] = useState('');
  const [scheduledDate, setScheduledDate] = useState<Date>(() => {
    // Default to tomorrow 10:00 AM
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d;
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showPickupMap, setShowPickupMap] = useState(false);
  const [showDropMap, setShowDropMap] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [loading, setLoading] = useState(false);

  // Company selection
  const [allCompanies, setAllCompanies] = useState<any[]>([]);
  const [companyQuery, setCompanyQuery] = useState('');
  const [filteredCompanies, setFilteredCompanies] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>(undefined);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);

  useEffect(() => {
    const loadCompanies = async () => {
      setLoadingCompanies(true);
      const res = await fetchTransportCompanies(userId);
      if (res.success) {
        setAllCompanies(res.companies);
      }
      setLoadingCompanies(false);
    };
    loadCompanies();
  }, [userId]);

  // Filter companies as user types
  useEffect(() => {
    if (!companyQuery.trim()) {
      setFilteredCompanies([]);
      setShowCompanySuggestions(false);
      return;
    }
    const q = companyQuery.trim().toLowerCase();
    const matched = allCompanies.filter((c: any) => {
      const name = (c.name || '').toLowerCase();
      const location = (c.location || '').toLowerCase();
      return name.includes(q) || location.includes(q);
    });
    setFilteredCompanies(matched.slice(0, 8));
    setShowCompanySuggestions(true);
  }, [companyQuery, allCompanies]);

  const handleSelectCompany = (company: any) => {
    setSelectedCompany(company);
    setSelectedCompanyId(company.id);
    setCompanyQuery('');
    setShowCompanySuggestions(false);
  };

  const handleClearCompany = () => {
    setSelectedCompany(null);
    setSelectedCompanyId(undefined);
    setCompanyQuery('');
    setShowCompanySuggestions(false);
  };

  const getLiveLocation = async () => {
    try {
      setIsFetchingLocation(true);
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission Denied', 'Location permission is required.');
          setIsFetchingLocation(false);
          return;
        }
      }

      Geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setPickupLat(latitude);
          setPickupLng(longitude);
          try {
            const response = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_ACCESS_TOKEN}&types=address,poi&limit=1`
            );
            const data = await response.json();
            if (data.features && data.features.length > 0) {
              setPickupAddress(data.features[0].place_name);
            } else {
              setPickupAddress(`${latitude}, ${longitude}`);
            }
          } catch {
            setPickupAddress(`${latitude}, ${longitude}`);
          } finally {
            setIsFetchingLocation(false);
          }
        },
        (error) => {
          Alert.alert('Error', 'Could not get location: ' + error.message);
          setIsFetchingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    } catch (err) {
      console.warn(err);
      setIsFetchingLocation(false);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const updated = new Date(scheduledDate);
      updated.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setScheduledDate(updated);
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const updated = new Date(scheduledDate);
      updated.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
      setScheduledDate(updated);
    }
  };

  const handleConfirmSchedule = async () => {
    if (!pickupAddress.trim() || !dropAddress.trim()) {
      Alert.alert('Required Fields', 'Please fill in pickup and drop-off locations.');
      return;
    }

    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    if (scheduledDate < twoHoursFromNow) {
      Alert.alert('Validation Error', 'Scheduled time must be at least 2 hours from now.');
      return;
    }

    if (scheduledDate > sevenDaysFromNow) {
      Alert.alert('Validation Error', 'Scheduled time must be within 7 days from now.');
      return;
    }

    setLoading(true);
    const res = await createScheduledRide({
      user_id: userId,
      pickup_location: pickupAddress.trim(),
      pickup_lat: pickupLat,
      pickup_lng: pickupLng,
      drop_location: dropAddress.trim(),
      drop_lat: dropLat,
      drop_lng: dropLng,
      goods_description: goodsDescription.trim() || undefined,
      scheduled_time: scheduledDate.toISOString(),
      company_id: selectedCompanyId,
    });
    setLoading(false);

    if (res.success) {
      Alert.alert('Success 🎉', `Ride scheduled successfully!\nBooking ID: ${res.ride?.booking_id}`, [
        { text: 'OK', onPress: onSuccess }
      ]);
    } else {
      Alert.alert('Scheduling Failed', res.error || 'Unknown error');
    }
  };

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

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Schedule a Ride</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Timing Card */}
        <View style={s.card}>
          <Text style={s.cardHeaderTitle}>⏰ Date & Time Selection</Text>
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

        {/* Route Card */}
        <View style={s.card}>
          <Text style={s.cardHeaderTitle}>📍 Route Details</Text>

          <View style={s.inputGroup}>
            <Text style={s.label}>Pickup Location</Text>
            <View style={s.inputWrap}>
              <TextInput
                style={s.input}
                placeholder="Enter pickup address"
                placeholderTextColor="#94A3B8"
                value={pickupAddress}
                onChangeText={setPickupAddress}
                multiline
              />
            </View>
            <View style={s.locationBtnRow}>
              <TouchableOpacity style={s.gpsBtn} onPress={getLiveLocation} disabled={isFetchingLocation}>
                {isFetchingLocation ? (
                  <ActivityIndicator size="small" color="#10B981" />
                ) : (
                  <Text style={s.gpsBtnText}>📍 Current Location</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={s.mapPickBtn} onPress={() => setShowPickupMap(true)}>
                <Text style={s.mapPickBtnText}>🗺️ Pick on Map</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[s.inputGroup, { marginTop: 14 }]}>
            <Text style={s.label}>Drop-off Location</Text>
            <View style={s.inputWrap}>
              <TextInput
                style={s.input}
                placeholder="Enter drop-off address"
                placeholderTextColor="#94A3B8"
                value={dropAddress}
                onChangeText={setDropAddress}
                multiline
              />
            </View>
            <View style={s.locationBtnRow}>
              <TouchableOpacity style={s.mapPickBtn} onPress={() => setShowDropMap(true)}>
                <Text style={s.mapPickBtnText}>🗺️ Pick on Map</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Transport Company Card */}
        <View style={s.card}>
          <Text style={s.cardHeaderTitle}>🏢 Transport Company</Text>
          <Text style={s.cardSubtitle}>Search and select a company to ship with (optional).</Text>

          {selectedCompany ? (
            /* Selected Company Chip */
            <View style={s.selectedCompanyChip}>
              <View style={s.selectedCompanyAvatar}>
                <Text style={s.selectedCompanyAvatarText}>{selectedCompany.name?.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.selectedCompanyName}>{selectedCompany.name}</Text>
                <Text style={s.selectedCompanyLocation}>{selectedCompany.location || 'Transport Company'}</Text>
              </View>
              {selectedCompany.rating ? (
                <View style={s.ratingBadge}>
                  <Text style={s.ratingText}>⭐ {selectedCompany.rating}</Text>
                </View>
              ) : null}
              <TouchableOpacity onPress={handleClearCompany} style={s.clearCompanyBtn}>
                <Text style={s.clearCompanyBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Search Input */
            <View>
              <View style={s.companySearchWrap}>
                <Text style={s.searchIcon}>🔍</Text>
                <TextInput
                  style={s.companySearchInput}
                  placeholder="Search company by name..."
                  placeholderTextColor="#94A3B8"
                  value={companyQuery}
                  onChangeText={setCompanyQuery}
                  onFocus={() => { if (companyQuery.trim()) setShowCompanySuggestions(true); }}
                />
                {companyQuery.length > 0 && (
                  <TouchableOpacity onPress={() => { setCompanyQuery(''); setShowCompanySuggestions(false); }}>
                    <Text style={{ fontSize: 16, color: '#94A3B8', paddingHorizontal: 4 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Loading indicator */}
              {loadingCompanies && (
                <ActivityIndicator size="small" color="#10B981" style={{ marginTop: 12 }} />
              )}

              {/* Suggestions dropdown */}
              {showCompanySuggestions && filteredCompanies.length > 0 && (
                <View style={s.suggestionsContainer}>
                  {filteredCompanies.map((c: any) => (
                    <TouchableOpacity
                      key={c.id}
                      style={s.suggestionItem}
                      onPress={() => handleSelectCompany(c)}
                      activeOpacity={0.7}
                    >
                      <View style={s.suggestionAvatar}>
                        <Text style={s.suggestionAvatarText}>{c.name?.charAt(0)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.suggestionName}>{c.name}</Text>
                        <Text style={s.suggestionLocation}>{c.location || 'Transport Company'}</Text>
                      </View>
                      {c.rating ? (
                        <Text style={s.suggestionRating}>⭐ {c.rating}</Text>
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* No results */}
              {showCompanySuggestions && companyQuery.trim().length > 0 && filteredCompanies.length === 0 && !loadingCompanies && (
                <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 8, textAlign: 'center' }}>No companies match "{companyQuery}"</Text>
              )}

              {/* Hint when not searching */}
              {!companyQuery && !loadingCompanies && allCompanies.length > 0 && (
                <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 8 }}>💡 {allCompanies.length} companies available. Start typing to search.</Text>
              )}
            </View>
          )}
        </View>

        {/* Goods Description Card */}
        <View style={s.card}>
          <Text style={s.cardHeaderTitle}>📦 Goods Description</Text>
          <View style={s.inputWrap}>
            <TextInput
              style={[s.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="e.g. 50 boxes of industrial machinery parts, cotton bales, etc."
              placeholderTextColor="#94A3B8"
              value={goodsDescription}
              onChangeText={setGoodsDescription}
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[s.submitBtn, (!pickupAddress.trim() || !dropAddress.trim()) && s.disabledBtn]}
          onPress={handleConfirmSchedule}
          disabled={loading || !pickupAddress.trim() || !dropAddress.trim()}
          activeOpacity={0.9}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={s.submitBtnText}>Confirm Scheduled Ride</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={scheduledDate}
          mode="date"
          display="default"
          minimumDate={new Date()}
          maximumDate={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)}
          onChange={handleDateChange}
        />
      )}

      {/* Time Picker Modal */}
      {showTimePicker && (
        <DateTimePicker
          value={scheduledDate}
          mode="time"
          display="default"
          is24Hour={false}
          onChange={handleTimeChange}
        />
      )}

      {/* Map Pickers */}
      <MapLocationPicker
        visible={showPickupMap}
        onClose={() => setShowPickupMap(false)}
        onConfirm={(loc) => {
          setPickupAddress(loc.address);
          setPickupLat(loc.latitude);
          setPickupLng(loc.longitude);
          setShowPickupMap(false);
        }}
      />

      <MapLocationPicker
        visible={showDropMap}
        onClose={() => setShowDropMap(false)}
        onConfirm={(loc) => {
          setDropAddress(loc.address);
          setDropLat(loc.latitude);
          setDropLng(loc.longitude);
          setShowDropMap(false);
        }}
      />
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
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
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  backArrow: { fontSize: 20, color: '#0F172A', fontWeight: '700' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#0F172A', textAlign: 'center' },
  scrollContainer: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardHeaderTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 6 },
  cardSubtitle: { fontSize: 12, color: '#64748B', marginBottom: 16 },
  dateTimeRow: { flexDirection: 'row', gap: 12 },
  pickerBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  pickerLabel: { fontSize: 9, fontWeight: '800', color: '#64748B', letterSpacing: 0.5, marginBottom: 4 },
  pickerValue: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  inputGroup: { marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 6, textTransform: 'uppercase' },
  inputWrap: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 2,
  },
  input: { fontSize: 14, color: '#0F172A', fontWeight: '600' },
  locationBtnRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  gpsBtn: {
    backgroundColor: '#E6F7F0',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  gpsBtnText: { color: '#10B981', fontSize: 11, fontWeight: '700' },
  mapPickBtn: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  mapPickBtnText: { color: '#64748B', fontSize: 11, fontWeight: '700' },
  submitBtn: {
    backgroundColor: '#10B981',
    borderRadius: 28,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    elevation: 3,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  disabledBtn: { backgroundColor: '#CBD5E1', shadowOpacity: 0 },
  submitBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  // Company search styles
  companySearchWrap: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 2,
    gap: 8,
  },
  searchIcon: { fontSize: 16 },
  companySearchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#0F172A',
  },
  suggestionsContainer: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden' as const,
  },
  suggestionItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  suggestionAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10B981',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  suggestionAvatarText: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  suggestionName: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#0F172A',
  },
  suggestionLocation: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  suggestionRating: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#92400E',
  },
  selectedCompanyChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#10B981',
    padding: 12,
    gap: 10,
  },
  selectedCompanyAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10B981',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  selectedCompanyAvatarText: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  selectedCompanyName: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#059669',
  },
  selectedCompanyLocation: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  ratingBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#92400E',
  },
  clearCompanyBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginLeft: 4,
  },
  clearCompanyBtnText: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: '#DC2626',
  },
});
